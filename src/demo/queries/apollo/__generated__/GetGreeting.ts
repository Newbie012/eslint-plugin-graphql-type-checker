/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: GetGreeting
// ====================================================

export interface GetGreeting_greeting {
  __typename: "Greeting";
  message: string | null;
}

export interface GetGreeting {
  greeting: GetGreeting_greeting;
}

export interface GetGreetingVariables {
  language: string;
}
