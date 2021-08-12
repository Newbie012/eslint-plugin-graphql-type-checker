import { ESLintUtils, TSESTree } from "@typescript-eslint/experimental-utils";

import { RuleOptions, rules } from "./rules";

const ruleTester = new ESLintUtils.RuleTester({
    parser: "@typescript-eslint/parser",
});

const ruleOptions: RuleOptions = [
    {
        schemaFilePaths: {
            CaregiverGraphQL: "src/test/test_schema_caregiver.graphql",
            AgencyMemberGraphQL: "src/test/test_schema_agency_member.graphql",
        },
    },
];

ruleTester.run(
    "Missing query-type annotation with CaregiverGraphQL schema",
    rules["check-query-types"],
    {
        valid: [],
        invalid: [
            {
                options: ruleOptions,
                code: `
await CaregiverGraphQL.query(
    conn,
    gql\`
        query ($bundleId: TrainingCenterBundleId!) {
            visibleTrainingCenterBundles(bundle_id: { eq: $bundleId }) {
                caregiver_id
                agency_id
                caregiver_visible_date
                agency {
                    name
                    website
                }
            }
        }
    \`,
    args,
);
`,
                output: `
await CaregiverGraphQL.query<
    Exact<{
        bundleId: Scalars[\"TrainingCenterBundleId\"];
    }>,
    { __typename?: \"Query\" } & {
        visibleTrainingCenterBundles: Array<
            { __typename?: \"VisibleTrainingCenterBundle\" } & Pick<
                VisibleTrainingCenterBundle,
                \"caregiver_id\" | \"agency_id\" | \"caregiver_visible_date\"
            > & { agency: { __typename?: \"Agency\" } & Pick<Agency, \"name\" | \"website\"> }
        >;
    }
>(
    conn,
    gql\`
        query ($bundleId: TrainingCenterBundleId!) {
            visibleTrainingCenterBundles(bundle_id: { eq: $bundleId }) {
                caregiver_id
                agency_id
                caregiver_visible_date
                agency {
                    name
                    website
                }
            }
        }
    \`,
    args,
);
`,
                errors: [
                    {
                        type: TSESTree.AST_NODE_TYPES.MemberExpression,
                        messageId: "missingQueryType",
                        line: 2,
                        column: 7,
                        endLine: 2,
                        endColumn: 29,
                    },
                ],
            },
        ],
    },
);

ruleTester.run(
    "Invalid query-type annotation with AgencyMemberGraphQL schema",
    rules["check-query-types"],
    {
        valid: [],
        invalid: [
            {
                options: ruleOptions,
                code: `
await AgencyMemberGraphQL.query<{}, {}>(
    conn,
    gql\`
        query ($name: String!) {
            agencyMembers(nameSearch: $name) {
                id
                firstName
                agency {
                    website
                }
            }
        }
    \`,
    args,
);
`,
                output: `
await AgencyMemberGraphQL.query<
    Exact<{
        name: Scalars[\"String\"];
    }>,
    { __typename?: \"Query\" } & {
        agencyMembers: Array<
            { __typename?: \"AgencyMember\" } & Pick<AgencyMember, \"id\" | \"firstName\"> & {
                    agency: { __typename?: \"Agency\" } & Pick<Agency, \"website\">;
                }
        >;
    }
>(
    conn,
    gql\`
        query ($name: String!) {
            agencyMembers(nameSearch: $name) {
                id
                firstName
                agency {
                    website
                }
            }
        }
    \`,
    args,
);
`,
                errors: [
                    {
                        type: TSESTree.AST_NODE_TYPES.TSTypeParameterInstantiation,
                        messageId: "invalidQueryType",
                        line: 2,
                        column: 32,
                        endLine: 2,
                        endColumn: 40,
                    },
                ],
            },
        ],
    },
);

ruleTester.run("Parse error in GraphQL template literal string", rules["check-query-types"], {
    valid: [],
    invalid: [
        {
            options: ruleOptions,
            code: "CaregiverGraphQL.query(conn, gql`not a graphql document`, {});",
            errors: [
                {
                    type: TSESTree.AST_NODE_TYPES.MemberExpression,
                    messageId: "gqlLiteralParseError",
                    data: { errorMessage: 'Syntax Error: Unexpected Name "not".' },
                    line: 1,
                    column: 1,
                    endLine: 1,
                    endColumn: 23,
                },
            ],
        },
    ],
});

ruleTester.run("Validation error in GraphQL template literal string", rules["check-query-types"], {
    valid: [],
    invalid: [
        {
            options: ruleOptions,
            code: "CaregiverGraphQL.query(conn, gql`query {nonexistent_field}`, {});",
            errors: [
                {
                    type: TSESTree.AST_NODE_TYPES.MemberExpression,
                    messageId: "invalidGqlLiteral",
                    data: {
                        errorMessage:
                            "- Unknown field 'nonexistent_field' on type 'Query'.\n" +
                            "  \n" + // Explicit string to avoid auto-removal of indentation on empty line.
                            `  GraphQL request:1:8
  1 | query {nonexistent_field}
    |        ^`,
                    },

                    line: 1,
                    column: 1,
                    endLine: 1,
                    endColumn: 23,
                },
            ],
        },
    ],
});
