import { ESLintUtils, TSESTree, TSESLint } from "@typescript-eslint/experimental-utils";
import * as parser from "@typescript-eslint/parser";
import * as graphql from "graphql";
import * as prettier from "prettier";

import * as eslintUtils from "./eslintUtils";
import * as graphqlUtils from "./graphqlUtils";
import * as utils from "./utils";

/*
TODO:
- Cleanup
- Add docs/rules/check-query-types.md
- Add README.md
- Add graphql to peerdeps
*/

const createRule = ESLintUtils.RuleCreator(
    (name) =>
        `https://github.com/MedFlyt/medflyt_server2/blob/packages/eslint-plugin-graphql-type-checker/docs/rules/${name}.md`,
);

const messages = {
    unhandledPluginException:
        "Unhandled exception in graphql-type-checker plugin, probably due to a bug in the plugin. " +
        "Note that the query type annotations may be incorrect. Exception:\n{{errorMessage}}",
    missingQueryType: "Query should have a type annotation that matches the GraphQL query type",
    invalidQueryType: "Query type annotation does not match GraphQL query type",
    gqlLiteralParseError: "Parse error in GraphQL template literal:\n{{errorMessage}}",
    noInterpolation: "Interpolation not allowed in gql template literals",
    noMultipleDefinitions: "Only a single definition is allowed in gql template literals",
    onlyQueryOperations: "Only query operations are allowed in gql template literals",
    invalidGqlLiteral: "Invalid GraphQL document in template literal:\n{{errorMessage}}",
    // TODO: graphql-codegen does not provide nice validation exceptions, even with skipDocumentsValidation true, so
    // maybe we shouldn't include these in the invalidGqlLiteral message.
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
    const res = utils.catchExceptions(graphql.parse)(gqlStr);
    if (utils.isError(res)) {
        context.report({
            node: callExpression.callee, // Don't report on gql literal because it will obscure gql plugin errors.
            messageId: "gqlLiteralParseError",
            data: { errorMessage: res.error.message },
        });
    } else {
        const gqlAst = res.value;
        const validationMessageId = validateGraphQLDoc(gqlAst);
        if (validationMessageId) {
            context.report({
                node: taggedGqlTemplate,
                messageId: validationMessageId,
            });
        } else {
            const result = graphqlUtils.inferQueryTypeAnnotationString(schemaFilePath, gqlAst);

            if (utils.isError(result)) {
                context.report({
                    node: callExpression.callee,
                    messageId: "invalidGqlLiteral",
                    data: { errorMessage: result.error.message },
                });
            } else {
                const inferredTypeAnnotationStr = result.value;
                const currentTypeAnnotationStr = typeAnnotation
                    ? context
                          .getSourceCode()
                          .text.slice(typeAnnotation.range[0], typeAnnotation.range[1])
                    : "";

                if (!compareTypeAnnotations(currentTypeAnnotationStr, inferredTypeAnnotationStr)) {
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

const validateGraphQLDoc = (gqlAst: graphql.DocumentNode): MessageId | null => {
    if (gqlAst.definitions.length > 1) {
        return "noMultipleDefinitions";
    } else {
        const gqlDefinition = gqlAst.definitions[0];

        if (gqlDefinition.kind !== "OperationDefinition" || gqlDefinition.operation !== "query") {
            return "onlyQueryOperations";
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
