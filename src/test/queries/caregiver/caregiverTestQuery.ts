import * as graphql from "graphql";
import gql from "graphql-tag";

type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };

type Scalars = {
    ID: string;
    String: string;
    Boolean: boolean;
    Int: number;
    Float: number;

    TrainingCenterBundleId: TrainingCenterBundleId;
};

type TrainingCenterBundleId = string;
type CaregiverId = string;
type AgencyId = string;
type LocalDate = Date;

type VisibleTrainingCenterBundle = {
    caregiver_id: CaregiverId;
    agency_id: AgencyId;
    caregiver_visible_date: LocalDate;
    agency: Agency;
};

type Agency = {
    name: string;
    website: string;
};

const CaregiverGraphQL = {
    query<Args, Res>(_conn: any, _gqlDoc: graphql.DocumentNode, _args: Args): Res {
        return {} as any;
    },
};

const conn = undefined;

export const test = async () =>
    CaregiverGraphQL.query<
        Exact<{
            bundleId: Scalars["TrainingCenterBundleId"];
        }>,
        { __typename?: "Query" } & {
            visibleTrainingCenterBundles: Array<
                { __typename?: "VisibleTrainingCenterBundle" } & Pick<
                    VisibleTrainingCenterBundle,
                    "caregiver_id" | "agency_id" | "caregiver_visible_date"
                > & { agency: { __typename?: "Agency" } & Pick<Agency, "name" | "website"> }
            >;
        }
    >(
        conn,
        gql`
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
        `,
        {
            bundleId: "42",
        },
    );
