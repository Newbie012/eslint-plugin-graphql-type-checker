/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: GetGreeting2
// ====================================================

export interface GetGreeting2_greeting {
  __typename: "Greeting";
  message: string | null;
}

export interface GetGreeting2 {
  greeting: GetGreeting2_greeting;
}

export interface GetGreeting2Variables {
  language: string;
}
