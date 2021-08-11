import * as typescriptPlugin from "@graphql-codegen/typescript";
import * as typescriptOperationsPlugin from "@graphql-codegen/typescript-operations";
import * as eslintParser from "@typescript-eslint/parser";
import * as fs from "fs";
import * as graphql from "graphql";
import * as graphqlLanguage from "graphql/language";
import * as tempy from "tempy";

import * as codeGenerator from "./codeGenerator";
import { codegen } from "./graphql-codegen-core-sync";
import * as eslintUtils from "./eslintUtils";
import * as utils from "./utils";

const getSchema = (schemaFilePath: string): graphql.GraphQLSchema => {
    const schemaStr = fs.readFileSync(schemaFilePath, "utf8");
    const schema: graphql.GraphQLSchema = graphql.buildSchema(schemaStr);
    return schema;
};

const replaceQueryName = (document: graphql.DocumentNode, name: string): graphql.DocumentNode =>
    graphqlLanguage.visit(document, {
        leave(node) {
            if (node.kind === "OperationDefinition" && node.operation === "query") {
                return {
                    ...node,
                    name: {
                        kind: "Name",
                        value: name,
                    },
                };
            }
        },
    });

// Extract the query type strings from type aliases created by graphql-code-generator.
const extractQueryTypeStrings = (typeDeclarationsStr: string, queryName: string) => {
    const typeDeclarations = eslintParser.parse(typeDeclarationsStr, { range: true });
    const argsType = eslintUtils.getTypeDeclaration(typeDeclarations, `${queryName}QueryVariables`);
    const resType = eslintUtils.getTypeDeclaration(typeDeclarations, `${queryName}Query`);

    if (argsType && resType) {
        return {
            args: typeDeclarationsStr.slice(argsType.range[0], argsType.range[1]),
            result: typeDeclarationsStr.slice(resType.range[0], resType.range[1]),
        };
    } else {
        throw new Error(
            `Cannot extract types from generated graphql code:\n>>>\m${typeDeclarationsStr}<<<`,
        );
    }
};

const QUERY_NAME_PLACEHOLDER = "QueryNamePlaceholder_";

export const inferQueryTypeAnnotationString = (
    schemaFilePath: string,
    document: graphql.DocumentNode,
): utils.ValueOrError<{ argumentsType: string; resultType: string }, any> => {
    const schema = getSchema(schemaFilePath);
    const { argumentsType, resultType } = codeGenerator.generateTypes(schema, document);

    const namedOperationDocument = replaceQueryName(document, QUERY_NAME_PLACEHOLDER);

    // from https://www.graphql-code-generator.com/docs/getting-started/programmatic-usage
    const config = {
        documents: [{ document: namedOperationDocument }],
        config: {},
        filename: tempy.file({ name: "graphQLOutput.ts" }), // Not used by plugin, but required in config.
        schema: graphql.parse(graphql.printSchema(schema)),
        plugins: [
            {
                // See https://github.com/dotansimha/graphql-code-generator/blob/master/packages/plugins/typescript/operations/src/config.ts
                typescriptOperationsPlugin: {
                    noExport: true,
                    preResolveTypes: false, // 'true' flattens structure but introduces `any` types
                    flattenGeneratedTypes: true, // does not appear to do anything
                },
            },
        ],
        pluginMap: { typescriptPlugin, typescriptOperationsPlugin },
        skipDocumentsValidation: true,
    };

    const result = utils.catchExceptions(codegen)(config);
    if (utils.isError(result)) {
        return { error: result.error };
    } else {
        const { value: inferredTypeDefinitionsStr } = result;
        const typeStrs = extractQueryTypeStrings(
            inferredTypeDefinitionsStr,
            QUERY_NAME_PLACEHOLDER,
        );
        return { value: { argumentsType, resultType } };
    }
};
