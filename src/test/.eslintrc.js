module.exports = {
    root: false,
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint", "@medflyt/graphql-type-checker"],
    extends: [],
    rules: {
        "@medflyt/graphql-type-checker/check-query-types": [
            "error",
            {
                schemaFilePaths: {
                    // Note that these are relative to the project root, because eslint runs from the root.
                    // Ideally, we'd resolve against the location of this file, eslint does not seem to support this.
                    // And we cannot move this file to the root, since it needs to be in the directory with the
                    // package.json containing the "file:../.." dependency, and we cannot have that in the root package.
                    CaregiverGraphQL: "src/test/test_schema_caregiver.graphql",
                    AgencyMemberGraphQL: "src/test/test_schema_agency_member.graphql",
                },
            },
        ],
    },
};
