module.exports = {
    root: false,
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint", "@medflyt/graphql-type-checker"],
    extends: [],
    rules: {
        "@medflyt/graphql-type-checker/check-query-types": [
            "error",
            {
                gqlOperationObjects: {
                    // Note that the paths are relative to the project root, because eslint runs from the root.
                    // Ideally, we'd resolve against the location of this file, but eslint does not seem to support
                    // this. We also cannot move this file to the root, since it needs to be in the directory with the
                    // package.json containing the "file:../.." dependency, and we cannot have that in the root package.
                    Apollo: {
                        schemaFilePath: "src/schemas/apollo-schema.graphql",
                        operationMethodName: "useQuery",
                        gqlLiteralArgumentIndex: 0,
                    },
                    AgencyMemberGraphQL: {
                        schemaFilePath: "src/schemas/agency-member-schema.graphql",
                        operationMethodName: "query",
                        gqlLiteralArgumentIndex: 1,
                    },
                    CaregiverGraphQL: {
                        schemaFilePath: "src/schemas/caregiver-schema.graphql",
                        operationMethodName: "query",
                        gqlLiteralArgumentIndex: 1,
                    },
                    NonexistentSchemaGraphQL: {
                        schemaFilePath: "this/schemas/file/does/not/exist.graphql",
                        operationMethodName: "query",
                        gqlLiteralArgumentIndex: 0,
                    },
                    InvalidSchemaGraphQL: {
                        schemaFilePath: "src/schemas/invalid-schema.txt",
                        operationMethodName: "query",
                        gqlLiteralArgumentIndex: 0,
                    },
                },
            },
        ],
    },
};
