import * as graphql from "graphql";
import gql from "graphql-tag";

type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };

type Scalars = {
    ID: string;
    String: string;
    Boolean: boolean;
    Int: number;
    Float: number;
};

type AgencyMember = {
    id: string;
    firstName: string;
};

type Agency = {
    website: string;
};

const AgencyMemberGraphQL = {
    query<Args, Res>(_conn: any, _gqlDoc: graphql.DocumentNode, _args: Args): Res {
        return {} as any;
    },
};

const conn = undefined;

export const test = async () =>
    AgencyMemberGraphQL.query<
        Exact<{
            name: Scalars["String"];
        }>,
        { __typename?: "Query" } & {
            agencyMembers: Array<
                { __typename?: "AgencyMember" } & Pick<AgencyMember, "id" | "firstName"> & {
                        agency: { __typename?: "Agency" } & Pick<Agency, "website">;
                    }
            >;
        }
    >(
        conn,
        gql`
            query ($name: String!) {
                agencyMembers(nameSearch: $name) {
                    id
                    firstName
                    agency {
                        website
                    }
                }
            }
        `,
        {
            name: "Bob Ross",
        },
    );
