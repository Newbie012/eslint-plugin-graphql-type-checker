import * as fs from "fs";
import * as graphql from "graphql";

import * as codeGenerator from "./codeGenerator";
import * as utils from "./utils";

const getSchema = (schemaFilePath: string): graphql.GraphQLSchema => {
    const schemaStr = fs.readFileSync(schemaFilePath, "utf8");
    const schema: graphql.GraphQLSchema = graphql.buildSchema(schemaStr);
    return schema;
};

export const inferQueryTypeAnnotationString = (
    schemaFilePath: string,
    document: graphql.DocumentNode,
): utils.ValueOrError<{ argumentsType: string; resultType: string }, { errorMessage: string }> => {
    const schema = getSchema(schemaFilePath);
    const validationErrors = graphql.validate(schema, document);

    if (validationErrors.length === 0) {
        const { argumentsType, resultType } = codeGenerator.generateTypes(schema, document);
        return { value: { argumentsType, resultType } };
    } else {
        console.log("errors", validationErrors.map(graphql.printError));
        return { error: { errorMessage: validationErrors.map(graphql.printError).join("\n") } };
    }
};
