import * as graphql from "graphql";
import gql from "graphql-tag";

type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };

export type Scalars = {
    ID: string;
    String: string;
    Boolean: boolean;
    Int: number;
    Float: number;
}

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
        {
            __typename?: "Query";
            agencyMembers: Array<{
                __typename?: "AgencyMember";
                id: any;
                firstName: string;
                agency: { __typename?: "Agency"; website: string };
            }>;
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
