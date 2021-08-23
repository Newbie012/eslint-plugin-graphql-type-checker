import { gql } from "@apollo/client";
import * as Apollo from "@apollo/client";

import "../../../graphql-global-types";

import { GetGreeting, GetGreetingVariables} from "./__generated__/GetGreeting";
// Example from https://github.com/apollographql/apollo-client/blob/main/docs/source/api/react/hooks.mdx#usequery
export function Hello() {
    const { loading, data } = Apollo.useQuery<
        { greeting: { __typename: "Greeting"; message: string } },
        { language: string }
    >(
        gql`
            query GetGreeting2($language: String!) {
                greeting(language: $language) {
                    __typename
                    message
                }
            }
        `,
        {
            variables: { language: "english" },
        },
    );
    if (loading || !data) return "<p>Loading ...</p>";
    return `<h1>Hello ${data.greeting.message}!</h1>`;
}

export function Hello2() {
    // eslint-disable-next-line @medflyt/graphql-type-checker/check-query-types
    const { loading, data } = Apollo.useQuery<GetGreeting, GetGreetingVariables>(
        gql`
            query GetGreeting($language: String!) {
                greeting(language: $language) {
                    __typename
                    message
                }
            }
        `,
        {
            variables: { language: "english" },
        },
    );
    if (loading || !data) return "<p>Loading ...</p>";
    return `<h1>Hello ${data.greeting.message}!</h1>`;
}
