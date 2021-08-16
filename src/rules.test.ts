import { ESLintUtils, TSESTree } from "@typescript-eslint/experimental-utils";
import * as path from "path";

import { RuleOptions, rules } from "./rules";

const ruleTester = new ESLintUtils.RuleTester({
    parser: "@typescript-eslint/parser",
});

const invalidSchemaPath = "src/schemas/invalid-schema.txt";
const ruleOptions: RuleOptions = [
    {
        schemaFilePaths: {
            AgencyMemberGraphQL: "src/schemas/agency-member-schema.graphql",
            CaregiverGraphQL: "src/schemas/caregiver-schema.graphql",
            NonexistentSchemaGraphQL: "this/schemas/file/does/not/exist.graphql",
            InvalidSchemaGraphQL: invalidSchemaPath,
        },
    },
];

ruleTester.run("Nonexistent schema file", rules["check-query-types"], {
    valid: [],
    invalid: [
        {
            options: ruleOptions,
            code: "NonexistentSchemaGraphQL.query(conn, gql``, {});",
            errors: [
                {
                    type: TSESTree.AST_NODE_TYPES.MemberExpression,
                    messageId: "unreadableSchemaFile",
                    // We don't test data as data.errorMessage may be platform specific.
                    line: 1,
                    column: 1,
                    endLine: 1,
                    endColumn: 31,
                },
            ],
        },
    ],
});

ruleTester.run("Invalid schema file", rules["check-query-types"], {
    valid: [],
    invalid: [
        {
            options: ruleOptions,
            code: "InvalidSchemaGraphQL.query(conn, gql``, {});",
            errors: [
                {
                    type: TSESTree.AST_NODE_TYPES.MemberExpression,
                    messageId: "invalidGqlSchema",
                    data: {
                        schemaFilePath: path.resolve(invalidSchemaPath),
                        errorMessage: `Syntax Error: Unexpected Name "a".

GraphQL request:1:10
1 | type not a valid schema
  |          ^
2 |`,
                    },
                    line: 1,
                    column: 1,
                    endLine: 1,
                    endColumn: 27,
                },
            ],
        },
    ],
});

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
                        errorMessage: `Cannot query field "nonexistent_field" on type "Query".

GraphQL request:1:8
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
        query ($memberName: String!, $id: AgencyMemberId_Filter) {
            agencyMembers(nameSearch: $memberName, id: $id) {
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
    {
        agencyMembers: ReadonlyArray<{
            id: AgencyMemberId;
            firstName: string;
            agency: { website: string };
        }>;
    },
    { memberName: string; id: AgencyMemberId_Filter | null }
>(
    conn,
    gql\`
        query ($memberName: String!, $id: AgencyMemberId_Filter) {
            agencyMembers(nameSearch: $memberName, id: $id) {
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
    {
        visibleTrainingCenterBundles: ReadonlyArray<{
            caregiver_id: CaregiverId;
            agency_id: AgencyId;
            caregiver_visible_date: LocalDate;
            agency: { name: string; website: string };
        }>;
    },
    { bundleId: TrainingCenterBundleId }
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
