import Apollo, { gql } from "@apollo/client";
import React from "react";

function App() {
  const { data } = Apollo.useQuery<
    { greeting: { __typename: "Greeting"; message: string } },
    { language: string }
  >(
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

  return <div className="App">{data && data.greeting.message}!</div>;
}

export default App;
