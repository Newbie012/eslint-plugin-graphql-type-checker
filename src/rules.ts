import { ESLintUtils, TSESTree, TSESLint } from "@typescript-eslint/experimental-utils";
import * as parser from "@typescript-eslint/parser";
import * as fs from "fs";
import * as graphql from "graphql";
import * as path from "path";
import * as prettier from "prettier";

import * as codeGenerator from "./codeGenerator";
import * as eslintUtils from "./eslintUtils";
import * as utils from "./utils";

const createRule = ESLintUtils.RuleCreator(
    (name) =>
        `https://github.com/MedFlyt/medflyt_server2/blob/packages/eslint-plugin-graphql-type-checker/docs/rules/${name}.md`,
);

const messages = {
    noInterpolation: "Interpolation not allowed in gql template literals",
    gqlLiteralParseError: "Parse error in GraphQL template literal:\n\n{{errorMessage}}",
    unreadableSchemaFile:
        "Cannot read GraphQL schema file at '{{schemaFilePath}}':\n\n{{errorMessage}}",
    invalidGqlSchema: "Invalid GraphQL schema at '{{schemaFilePath}}':\n\n{{errorMessage}}",
    invalidGqlLiteral: "Invalid GraphQL document in template literal:\n\n{{errorMessage}}",
    noMultipleDefinitions: "Only a single definition is allowed in gql template literals",
    onlyQueryOperations: "Only query operations are allowed in gql template literals",
    missingQueryType: "Query should have a type annotation that matches the GraphQL query type",
    invalidQueryType: "Query type annotation does not match GraphQL query type",
    unhandledPluginException:
        "Unhandled exception in graphql-type-checker plugin, probably due to a bug in the plugin. " +
        "Note that the query type annotations may be incorrect.\n\n{{errorMessage}}",
};
type MessageId = keyof typeof messages;

export type RuleOptions = [{ schemaFilePaths: Record<string, string> }];

type RuleContext = TSESLint.RuleContext<MessageId, RuleOptions>;

type RuleReporter = (report: TSESLint.ReportDescriptor<MessageId>) => void;

const checkQueryTypesRuleSchema = [
    {
        type: "object",
        properties: {
            schemaFilePaths: {
                type: "object",
                additionalProperties: { type: "string" },
            },
        },
        required: ["schemaFilePaths"],
        additionalProperties: false,
    },
];

const checkQueryTypes_RuleListener = (context: RuleContext): TSESLint.RuleListener => {
    const listener: TSESLint.RuleListener = {
        // Easy AST viewing: https://ts-ast-viewer.com/
        CallExpression(callExpression) {
            try {
                const schemaFilePaths = context.options[0].schemaFilePaths;
                const schemaNames = Object.keys(schemaFilePaths);

                const { callee, arguments: args } = callExpression;
                // console.log("CallExpression", callExpression);
                if (
                    callee.type === "MemberExpression" &&
                    callee.property.type === "Identifier" &&
                    callee.property.name === "query" &&
                    callee.object.type === "Identifier"
                ) {
                    const connIdentifierName = callee.object.name;
                    if (schemaNames.includes(connIdentifierName)) {
                        const typeAnnotation = callExpression.typeParameters;
                        // console.log("TYPE ANNOTATION", typeAnnotation);
                        // console.log("PROPERTY", callee.property.type, callee.property.name);
                        // console.log("OBJECT", callee.object);
                        const taggedGqlTemplate = eslintUtils.getTaggedGqlTemplateArg(args);
                        // console.log(taggedGqlTemplate);
                        if (taggedGqlTemplate !== null) {
                            const schemaFilePath = schemaFilePaths[connIdentifierName];

                            const gqlStr = getQglString(context.report, taggedGqlTemplate);
                            // console.log("gqlStr", gqlStr);
                            if (gqlStr !== null) {
                                checkQueryTypes_Rule(
                                    context,
                                    schemaFilePath,
                                    taggedGqlTemplate,
                                    gqlStr,
                                    callExpression,
                                    callee.property, // i.e. the `query` property
                                    typeAnnotation,
                                );
                            }
                        }
                    }
                }
            } catch (error) {
                context.report({
                    node: callExpression.callee,
                    messageId: "unhandledPluginException",
                    data: { errorMessage: `${error.message}\n${error.stack}` },
                });
            }
        },
    };
    return listener;
};
const checkQueryTypes_Rule = (
    context: RuleContext,
    schemaFilePath: string,
    taggedGqlTemplate: TSESTree.TaggedTemplateExpression,
    gqlStr: string,
    callExpression: TSESTree.CallExpression,
    calleeProperty: TSESTree.Identifier,
    typeAnnotation?: TSESTree.TSTypeParameterInstantiation,
) => {
    const absoluteSchemaFilePath = path.resolve(schemaFilePath);
    const schemaFileContentsResult = readSchema(absoluteSchemaFilePath);
    if (utils.isError(schemaFileContentsResult)) {
        context.report({
            node: callExpression.callee, // Don't report on gql literal because it will squiggle over gql plugin errors.
            messageId: "unreadableSchemaFile",
            data: {
                schemaFilePath: absoluteSchemaFilePath,
                errorMessage: schemaFileContentsResult.error,
            },
        });
    } else {
        const schemaFileContents = schemaFileContentsResult.value;
        const schemaResult = utils.catchExceptions(graphql.buildSchema)(schemaFileContents);

        if (utils.isError(schemaResult)) {
            context.report({
                // Don't report on gql literal because it will squiggle over gql plugin errors.
                node: callExpression.callee,
                messageId: "invalidGqlSchema",
                data: { schemaFilePath: absoluteSchemaFilePath, errorMessage: schemaResult.error },
            });
        } else {
            const schema = schemaResult.value;
            {
                const res = utils.catchExceptions(graphql.parse)(gqlStr);
                if (utils.isError(res)) {
                    context.report({
                        node: callExpression.callee,
                        messageId: "gqlLiteralParseError",
                        data: { errorMessage: res.error.message },
                    });
                } else {
                    const gqlOperationDocument = res.value;

                    const validationReportDescriptor = validateGraphQLDoc(
                        schema,
                        callExpression.callee,
                        taggedGqlTemplate,
                        gqlOperationDocument,
                    );
                    if (validationReportDescriptor) {
                        context.report(validationReportDescriptor);
                    } else {
                        const { argumentsType, resultType } = codeGenerator.generateTypes(
                            schema,
                            gqlOperationDocument,
                        );
                        const inferredTypeAnnotationStr = `<${argumentsType}, ${resultType}>`;
                        // console.log("INFERRED ANNOTATION", inferredTypeAnnotationStr);

                        const currentTypeAnnotationStr = typeAnnotation
                            ? context
                                  .getSourceCode()
                                  .text.slice(typeAnnotation.range[0], typeAnnotation.range[1])
                            : "";

                        if (
                            !compareTypeAnnotations(
                                currentTypeAnnotationStr,
                                inferredTypeAnnotationStr,
                            )
                        ) {
                            const {
                                messageId,
                                node,
                                inferredAnnotationRange,
                            }: {
                                messageId: MessageId;
                                node: TSESTree.Node;
                                inferredAnnotationRange: [number, number];
                            } = typeAnnotation
                                ? {
                                      messageId: "invalidQueryType",
                                      node: typeAnnotation,
                                      inferredAnnotationRange: typeAnnotation.range,
                                  }
                                : {
                                      messageId: "missingQueryType",
                                      node: callExpression.callee,
                                      inferredAnnotationRange: [
                                          callExpression.callee.range[1],
                                          callExpression.callee.range[1],
                                      ],
                                  };
                            // console.log("annotationRange", annotationRange);

                            const typeStr = prettifyAnnotationInPlace(
                                context,
                                calleeProperty,
                                inferredAnnotationRange,
                                inferredTypeAnnotationStr,
                            );
                            const reportDescriptor: TSESLint.ReportDescriptor<MessageId> = {
                                messageId,
                                node,
                                fix(fix) {
                                    return fix.replaceTextRange(inferredAnnotationRange, typeStr);
                                },
                            };
                            context.report(reportDescriptor);
                        }
                    }
                }
            }
        }
    }
};

function getQglString(report: RuleReporter, expr: TSESTree.TaggedTemplateExpression) {
    if (expr.quasi.expressions.length) {
        report({
            node: expr.quasi.expressions[0],
            messageId: "noInterpolation",
        });

        return null;
    }
    return expr.quasi.quasis[0].value.cooked;
}

const readSchema = (schemaFilePath: string): utils.ValueOrError<string, string> => {
    try {
        return { value: fs.readFileSync(schemaFilePath, "utf8") };
    } catch (error) {
        return { error };
    }
};

// Validation the GraphQL document against the schema and perform extra checks required for code generation.
const validateGraphQLDoc = (
    schema: graphql.GraphQLSchema,
    generalValidationSquigglyNode: TSESTree.Node,
    codeGenValidationSquigglyNode: TSESTree.Node,
    gqlOperationDocument: graphql.DocumentNode,
): { node: TSESTree.Node; messageId: MessageId; data?: Record<string, string> } | null => {
    const validationErrors = graphql.validate(schema, gqlOperationDocument);
    if (validationErrors.length > 0) {
        return {
            node: generalValidationSquigglyNode,
            messageId: "invalidGqlLiteral",
            data: { errorMessage: validationErrors.map(graphql.printError).join("\n") },
        };
    } else {
        if (gqlOperationDocument.definitions.length > 1) {
            return { node: codeGenValidationSquigglyNode, messageId: "noMultipleDefinitions" };
        } else {
            const gqlDefinition = gqlOperationDocument.definitions[0];

            if (
                gqlDefinition.kind !== "OperationDefinition" ||
                gqlDefinition.operation !== "query"
            ) {
                return { node: codeGenValidationSquigglyNode, messageId: "onlyQueryOperations" };
            }
        }
    }
    return null;
};

// helper to parse module as a TSESLint.SourceCode.Program, which requires extra properties.
const parseSourceCodeProgram = (moduleStr: string): TSESLint.SourceCode.Program => {
    const prettyModuleAst = parser.parse(moduleStr, {
        loc: true,
        range: true,
        tokens: true,
        comment: true,
    });
    const loc = prettyModuleAst.loc;
    const range = prettyModuleAst.range;
    const tokens = prettyModuleAst.tokens;
    const comments = prettyModuleAst.comments;
    if (!loc || !range || !tokens || !comments) {
        throw new Error(
            "parseSourceCodeProgram: Parsed module source missing loc, range, tokens. or comments",
        );
    }
    return { ...prettyModuleAst, loc, range, tokens, comments };
};

// There appears to be no way to print an abstract syntax tree, so we represent the annotations as strings everywhere.
//  To compare these while ignoring layout and redundant syntax, we format both annotations in dummy code fragments and
// compare the resulting strings. For efficiency, we don't use the (large) module source for formatting here. nly the
// inferred annotation will be formatted in the module source (in prettifyAnnotationInPlace).
const getNormalizedAnnotationStr = (str: string) => {
    const statementStr = `query${str}()`;
    const normalizedStatementStr = prettier.format(statementStr, { parser: "typescript" });
    // console.log('normalizedStatement', normalizedStatement);

    const normalizedStatement = parser.parse(normalizedStatementStr).body[0];
    if (
        normalizedStatement.type === "ExpressionStatement" &&
        normalizedStatement.expression.type === "CallExpression"
    ) {
        return JSON.stringify(normalizedStatement.expression.typeParameters);
    } else {
        throw new Error("getNormalizedAnnotationStr: Parsed statement has an incorrect structure.");
    }
};

const compareTypeAnnotations = (
    leftTypeAnnotationStr: string,
    rightTypeAnnotationStr: string,
): boolean =>
    getNormalizedAnnotationStr(leftTypeAnnotationStr) ===
    getNormalizedAnnotationStr(rightTypeAnnotationStr);

// Prettify the type annotation at its destination in the full module source, and extract the prettified text to get
// the right indentation when it is applied as a quick fix.
const prettifyAnnotationInPlace = (
    context: RuleContext,
    calleeProperty: TSESTree.Identifier,
    annotationRange: [number, number],
    annotation: string,
) => {
    const PLACEHOLDER = "Q____"; // Needs to have the same length as calleeProperty for optimal layout.

    // Replace the callee property in the module source with the placeholder:
    const placeholderModuleStr =
        context.getSourceCode().text.slice(0, calleeProperty.range[0]) +
        PLACEHOLDER +
        context.getSourceCode().text.slice(calleeProperty.range[1]);

    // Insert inferred type annotation in the module source with the placeholder property name:
    const annotatedPlaceholderModuleStr =
        placeholderModuleStr.slice(0, annotationRange[0]) +
        annotation +
        placeholderModuleStr.slice(annotationRange[1]);

    const prettierConfig = prettier.resolveConfig.sync(context.getFilename());

    const prettyModuleStr = prettier.format(
        annotatedPlaceholderModuleStr,
        prettierConfig ? prettierConfig : { parser: "typescript" },
    );
    // console.log(`>>>prettyModuleStr:\n${prettyModuleStr}\n<<<`);

    const sourceCodeProgram = parseSourceCodeProgram(prettyModuleStr);
    const moduleSource = new TSESLint.SourceCode(prettyModuleStr, sourceCodeProgram);

    // Extract the callExpression of the placeholder property:
    const callExpression = [...eslintUtils.getNodes(moduleSource, moduleSource.ast)].find(
        (node): node is TSESTree.CallExpression =>
            node.type === "CallExpression" &&
            node.callee.type === "MemberExpression" &&
            node.callee.property.type === "Identifier" &&
            node.callee.property.name === PLACEHOLDER,
    );
    if (!callExpression) {
        throw new Error(
            "prettifyAnnotationInPlace: Parsed module source missing 'QUERY' call expression.",
        );
    }

    const prettyAnnotationRange = callExpression.typeParameters?.range;
    if (!prettyAnnotationRange) {
        // This should not happen, because we explicitly inserted this type annotation above.
        throw new Error("prettifyAnnotationInPlace: Call expression missing type annotation.");
    }

    const prettyAnnotationStr = moduleSource.text.slice(
        prettyAnnotationRange[0],
        prettyAnnotationRange[1],
    );
    // console.log("nodes", prettyAnnotationStr);
    return prettyAnnotationStr;
};

export const rules = {
    "check-query-types": createRule<RuleOptions, MessageId>({
        name: "ts-gql",
        meta: {
            fixable: "code",
            docs: {
                requiresTypeChecking: false,
                category: "Possible Errors",
                recommended: "error",
                description:
                    "Generates & validates TypeScript type annotations for GraphQL queries.",
            },
            messages,
            type: "problem",
            schema: checkQueryTypesRuleSchema,
        },
        defaultOptions: [{ schemaFilePaths: {} }],
        create: checkQueryTypes_RuleListener,
    }),
};
