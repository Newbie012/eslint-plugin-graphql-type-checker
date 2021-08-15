import { gql } from "@apollo/client";
import * as Apollo from "@apollo/client";

// Example from https://github.com/apollographql/apollo-client/blob/main/docs/source/api/react/hooks.mdx#usequery
export function Hello() {
    const {
        loading,
        error: _error,
        data,
    } = Apollo.useQuery<{ greeting: { message: string } }, { language: string }>(
        gql`
            query GetGreeting($language: String!) {
                greeting(language: $language) {
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
