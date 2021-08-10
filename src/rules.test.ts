import { ESLintUtils, TSESTree } from "@typescript-eslint/experimental-utils";

import { rules } from "./rules";

const ruleTester = new ESLintUtils.RuleTester({
    parser: "@typescript-eslint/parser",
});

ruleTester.run("check-query-types", rules["check-query-types"], {
    valid: [],

    invalid: [
        {
            options: [
                { schemaFilePaths: { CaregiverGraphQL: "src/test/test_schema_caregiver.graphql" } },
            ],
            code: `
const test = async (conn: CaregiverConn) => {
    const results = await CaregiverGraphQL.query(
        conn,
        gql\`
            query ($bundleId: TrainingCenterBundleId!) {
                visibleTrainingCenterBundles(bundle_id: { eq: $bundleId }) {
                    caregiver_id
                    bundle_due_date_id
                    agency_id
                    caregiver_visible_date
                    agency {
                        id
                        name
                        website
                    }
                }
            }
        \`,
        {
            bundleId: SchemaTypes.TrainingCenterBundleId.wrap(1),
        },
    );
    return results;
};
`,
            output: `
const test = async (conn: CaregiverConn) => {
    const results = await CaregiverGraphQL.query<
        Exact<{
            bundleId: Scalars[\"TrainingCenterBundleId\"];
        }>,
        { __typename?: \"Query\" } & {
            visibleTrainingCenterBundles: Array<
                { __typename?: \"VisibleTrainingCenterBundle\" } & Pick<
                    VisibleTrainingCenterBundle,
                    \"caregiver_id\" | \"bundle_due_date_id\" | \"agency_id\" | \"caregiver_visible_date\"
                > & { agency: { __typename?: \"Agency\" } & Pick<Agency, \"id\" | \"name\" | \"website\"> }
            >;
        }
    >(
        conn,
        gql\`
            query ($bundleId: TrainingCenterBundleId!) {
                visibleTrainingCenterBundles(bundle_id: { eq: $bundleId }) {
                    caregiver_id
                    bundle_due_date_id
                    agency_id
                    caregiver_visible_date
                    agency {
                        id
                        name
                        website
                    }
                }
            }
        \`,
        {
            bundleId: SchemaTypes.TrainingCenterBundleId.wrap(1),
        },
    );
    return results;
};
`,
            errors: [
                {
                    type: TSESTree.AST_NODE_TYPES.CallExpression,
                    messageId: "invalidQueryType",
                    line: 3,
                    column: 27,
                },
            ],
        },
    ],
});
