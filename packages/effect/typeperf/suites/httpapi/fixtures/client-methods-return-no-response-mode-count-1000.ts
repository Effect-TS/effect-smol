// Measures generated HttpApiClient return types without responseMode conditionals for 1000 same-shaped endpoints.
import { Effect, Schema } from "effect"
import { HttpClientError } from "effect/unstable/http"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware } from "effect/unstable/httpapi"
import type { Endpoint } from "./_client-methods-1000.ts"

Schema.String
HttpApi.make("Api")
HttpApiGroup.make("users")
HttpApiEndpoint.get("warmup", "/warmup")

type SuccessType<S> = S extends Schema.Constraint ? S["Type"] : never
type SuccessDecodingServices<S> = S extends Schema.Constraint ? S["DecodingServices"] : never
type MethodReturn<E extends HttpApiEndpoint.ConstraintRequest> = Effect.Effect<
  SuccessType<E["~Success"]>,
  | HttpApiMiddleware.Error<E["~Middleware"]>
  | HttpApiMiddleware.ClientError<E["~Middleware"]>
  | HttpClientError.HttpClientError
  | E["~Error"]["Type"]
  | Schema.SchemaError,
  | E["~Params"]["EncodingServices"]
  | E["~Query"]["EncodingServices"]
  | E["~Payload"]["EncodingServices"]
  | E["~Headers"]["EncodingServices"]
  | SuccessDecodingServices<E["~Success"]>
  | E["~Error"]["DecodingServices"]
>
type Method<E extends HttpApiEndpoint.ConstraintRequest> = (request: unknown) => MethodReturn<E>

type Users = {
  readonly [E in Endpoint as HttpApiEndpoint.Name<E>]: Method<E>
}
type Methods = Users[keyof Users]

export type ClientMethodNames = keyof Users
export type ClientMethods = Methods
export type ClientMethodResults = ReturnType<Methods>
