module.exports = {
    client: {
        tagName: "gql",
        globalTypesFile: "./src/graphql-global-types.ts",
        addTypename: true,

        includes: ["./src/demo/queries/apollo/*.ts"],
        service: {
            name: "my-service-name",
            localSchemaFile: "./src/schemas/apollo-schema.graphql",
        },
    },
};
