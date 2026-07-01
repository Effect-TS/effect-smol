// Measures generated HttpApiClient success response types for 1000 same-shaped endpoints in one group.
import { Effect, Schema } from "effect"
import { HttpApi, HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import type { Endpoint } from "./_client-methods-1000.ts"

Schema.String
HttpApi.make("Api")
HttpApiGroup.make("users")
HttpApiEndpoint.get("warmup", "/warmup")

type ResponseMode = HttpApiEndpoint.ClientResponseMode
type SuccessType<S> = S extends Schema.Constraint ? S["Type"] : never
type Method<E extends HttpApiEndpoint.ConstraintRequest> = <Mode extends ResponseMode = ResponseMode>() =>
  Effect.Effect<
    HttpApiClient.Client.Response<SuccessType<E["~Success"]>, Mode>,
    never,
    never
  >

type Users = {
  readonly [E in Endpoint as HttpApiEndpoint.Name<E>]: Method<E>
}
type Methods = Users[keyof Users]

export type ClientMethodNames = keyof Users
export type ClientMethods = Methods
export type ClientMethodResults = ReturnType<Methods>
