## eslint-plugin-graphql-type-checker [![npm version](https://badge.fury.io/js/@medflyt%2Feslint-plugin-graphql-type-checker.svg)](https://www.npmjs.com/package/@medflyt/eslint-plugin-graphql-type-checker) [![Build Status](https://github.com/MedFlyt/eslint-plugin-graphql-type-checker/actions/workflows/build-test.yml/badge.svg?branch=master)](https://github.com/MedFlyt/eslint-plugin-graphql-type-checker/actions/workflows/build-test.yml?query=branch%3Amaster)

The [`eslint-plugin-graphql-type-checker`](https://www.npmjs.com/package/@medflyt/eslint-plugin-graphql-type-checker) package is an ESLint plugin that generates and validates TypeScript type annotations for GraphQL queries. It contains a single rule `@medflyt/graphql-type-checker/check-query-types`, which triggers on configured object method calls (e.g. `Apollo.useQuery(..)`) and inspects queries passed as GraphQL template literals (i.e. ``gql`query ..` ``). From the query and the schema associated with the object name, it infers an annotation for the result and argument types, which can be applied to the code as an ESLint fix.

**NOTE:** The plugin is still a work in progress, and currently only supports query operations, without fragments, union types or interfaces.

## Example

As an example, consider an object named `GraphQLOperations` with a generic method `query<Res, Args>`, that takes a
GraphQL query and returns a promise of the query result:

```typescript
declare const GraphQLOperations : {
  query<Res, Args>(gqlQuery: graphql.DocumentNode, args: Args): Promise<Res>
};
```

Also assume that the queries created with `GraphQLOperations` use this basic schema:

```graphql
type Query {
  greeting(language: String!): Greeting!
}

type Greeting {
  greeting_id: ID!
  message: String!
}
```

We can call the `query` method with a GraphQL template literal parameter like this:

```typescript
const result = GraphQLOperations.query(gql`
  query GetGreeting($language: String!) {
    greeting(language: $language) {
      message
    }
  }
`);
```

If the plugin is configured for `GraphQLOperations.query` with the appropriate schema, the code above will trigger this lint error:

```
Query should have a type annotation that matches the GraphQL query type
```

with a suggestion to fix the code to

```typescript
const result = GraphQLOperations.query<{ greeting: { message: string } }, { language: string }>(gql`
  query GetGreeting($language: String!) {
    greeting(language: $language) {
      message
    }
  }
`);
```

If the `GraphQLOperations.query` call already has a type annotation, the plugin compares it to the inferred one (disregarding layout and redundant syntax, like extra parentheses), and propose a fix in case of a difference.

To minimize the need to reformat after applying a fix, the suggested code fixes are formatted with prettier, using the target project's prettier configuration, if it has one.

# Installation

Install the plugin with

```bash
npm install -D @medflyt/eslint-plugin-graphql-type-checker
```

# Configuration

The plugin only has a single rule `@medflyt/graphql-type-checker/check-query-types`, which has the following configuration (expressed as a TypeScript type):

```typescript
type RuleOptions = [
  {
    gqlOperationObjects: Record<
      string, // gqlOperationObject name
      {
        schemaFilePath: string;
        operationMethodName: string;
        gqlLiteralArgumentIndex: number;
      }
    >;
  },
];
```

The keys of `gqlOperationObjects` are the names of the objects on which the rule should trigger, with the values being the corresponding configuration. Besides the schema file path and the name of the operation method, the configuration also specifies the index of the GraphQL template literal argument (`gqlLiteralArgumentIndex`).

For example, to trigger the plugin on objects named `Apollo` with a method `useQuery` that takes a GraphQL template literal as its first agument, the `.eslintrc.js` could look like this:

```javascript
module.exports = {
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "@medflyt/graphql-type-checker"],
  extends: [],
  rules: {
    "@medflyt/graphql-type-checker/check-query-types": [
      "error", {
        graphqlObjects: {
          Apollo: {
            schemaFilePath: "src/schemas/apollo-schema.graphql",
            operationMethodName: "useQuery",
            gqlLiteralArgumentIndex: 0,
          },
        },
      },
    ],
  // ... other rules
  },
};
```

For more examples, see [`src/demo/.eslintrc.js`](https://github.com/MedFlyt/eslint-plugin-graphql-type-checker/blob/master/src/demo/.eslintrc.js)
.
# Demo

To run the plugin directly from the sources, clone this repository, and run

```bash
npm install
npm run install-demo
```

followed by either `npm run build` or `npm run build-watch`.

The plugin can now be called from the command line on the examples in `src/demo/queries`, for example with:

```bash
npx eslint src/demo/queries/apollo/apolloTestQuery.ts
```

(To see an error message, try changing `{ message: string }` to `{ message: number }` in the type annotation.)

If you have an ESLint editor extension, you can also open the samples in `src/demo/queries` in your editor and use the quick-fix suggestions to update the type annotations. Note that after changing the plugin sources and rebuilding, you will have to reload or restart the editor to see the effects.
