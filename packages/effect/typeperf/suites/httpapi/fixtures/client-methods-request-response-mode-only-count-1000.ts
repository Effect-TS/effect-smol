// Measures generated HttpApiClient request responseMode-only types for 1000 same-shaped endpoints in one group.
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import type { Endpoint } from "./_client-methods-1000.ts"

Schema.String
HttpApi.make("Api")
HttpApiGroup.make("users")
HttpApiEndpoint.get("warmup", "/warmup")

type Simplify<A> = { readonly [K in keyof A]: A[K] } & {}
type ResponseMode = HttpApiEndpoint.ClientResponseMode
type Method = <Mode extends ResponseMode = ResponseMode>(
  request: Simplify<{ readonly responseMode?: Mode }>
) => unknown

type Users = {
  readonly [E in Endpoint as HttpApiEndpoint.Name<E>]: Method
}
type Methods = Users[keyof Users]

export type ClientMethodNames = keyof Users
export type ClientMethods = Methods
export type ClientMethodRequests = Parameters<Methods>[0]
