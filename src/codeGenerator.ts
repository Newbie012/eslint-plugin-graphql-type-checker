import * as graphql from "graphql";

const scalarTypes: Record<string, string> = {
    ID: "string",
    String: "string",
    Boolean: "boolean",
    Int: "number",
    Float: "number",
};

const genArgumentsType_OperationDefinition = (operationDef: graphql.OperationDefinitionNode) => {
    const variableDefinitions = operationDef.variableDefinitions ?? [];
    const variableDefinitionsStr = variableDefinitions
        .map(genArgumentsType_VariableDefinition)
        .join(", ");
    return `{ ${variableDefinitionsStr} }`;
};

const genArgumentsType_VariableDefinition = (variableDef: graphql.VariableDefinitionNode) => {
    const variableType = genArgumentsType_Type(variableDef.type);
    return `${variableDef.variable.name.value}: ${variableType}`;
};

const genArgumentsType_Type = (typeNode: graphql.TypeNode): string => {
    switch (typeNode.kind) {
        case "NamedType": {
            return convertScalars(typeNode.name.value);
        }
        case "ListType": {
            return `ReadonlyArray<${genArgumentsType_Type(typeNode.type)}>`;
        }
        case "NonNullType": {
            return `${genArgumentsType_Type(typeNode.type)} | null`;
        }
    }
};

const convertScalars = (typeName: string): string => scalarTypes[typeName] ?? typeName;

const genResultType_OperationDefinition = (
    schema: graphql.GraphQLSchema,
    operationDef: graphql.OperationDefinitionNode,
) => {
    console.log("rootType:", graphql.getOperationRootType(schema, operationDef).name);
    const fieldMap = graphql.getOperationRootType(schema, operationDef).getFields();
    // console.log("fieldMap", Object.keys(fieldMap));
    const selectionSet = operationDef.selectionSet;
    const result = selectionSet.selections
        .map(genResultType_Selection(schema, fieldMap))
        .join(", ");
    return `{ ${result} }`; // TODO: name
};

const extractWrapperTypes = (
    t: graphql.GraphQLType,
    isNonNull: boolean = false,
): ((typeName: string) => string) => {
    //: { namedType: graphql.GraphQLNamedType; wrap: (typeName: string) => string } =>
    if (graphql.isNonNullType(t)) {
        const oftype = t.ofType;
        const wrap = extractWrapperTypes(oftype, true);
        return wrap;
    } else if (graphql.isListType(t)) {
        const oftype = t.ofType;
        const wrap = extractWrapperTypes(oftype, false);
        return (t) => `Array<${wrap(t)}>${isNonNull ? " | null" : ""}`;
    } else {
        return (t) => `${t}${isNonNull ? "" : " | null"}`;
    }
};

const genResultType_Selection =
    (schema: graphql.GraphQLSchema, parentFieldMap: graphql.GraphQLFieldMap<any, any>) =>
    (selection: graphql.SelectionNode): string => {
        switch (selection.kind) {
            case "Field": {
                const fieldNode: graphql.FieldNode = selection;
                const field = parentFieldMap[fieldNode.name.value];
                console.log(
                    "Field:",
                    fieldNode.name.value,
                    Object.keys(parentFieldMap),
                    graphql.getNamedType(field?.type),
                );
                const fieldType = field?.type;
                const namedType: graphql.GraphQLNamedType = graphql.getNamedType(fieldType);
                const wrap = extractWrapperTypes(fieldType);
                console.log("namedType", wrap(namedType.name));
                const fieldMap =
                    namedType instanceof graphql.GraphQLObjectType ? namedType.getFields() : {};
                // const fieldType: graphql.GraphQLOutputType = fieldType
                // const fieldMap2 =fieldType fieldType.getFields()
                // return 'x'
                const result = fieldNode.selectionSet
                    ? `{${fieldNode.selectionSet.selections
                          .map(genResultType_Selection(schema, fieldMap))
                          .join(", ")}}`
                    : convertScalars(graphql.getNamedType(fieldType).name);
                console.log("children", result);
                return `${fieldNode.name.value}: ${wrap(result)}`;
            }
            case "FragmentSpread": {
                throw new Error("generateTypes: Unsupported SelectionNode: FragmentSpreadNode");
            }
            case "InlineFragment": {
                throw new Error("generateTypes: Unsupported SelectionNode: InlineFragmentNode");
            }
        }
    };

export const generateTypes = (
    schema: graphql.GraphQLSchema,
    document: graphql.DocumentNode,
): { argumentsType: string; resultType: string } => {
    if (
        document.definitions.length === 1 &&
        document.definitions[0].kind === "OperationDefinition"
    ) {
        const argumentsType = genArgumentsType_OperationDefinition(document.definitions[0]);
        console.log(argumentsType);
        const resultType = genResultType_OperationDefinition(schema, document.definitions[0]);
        console.log(resultType);
        return { argumentsType, resultType };
    } else {
        throw new Error("generateTypes: Not a single operation definition");
    }
};
