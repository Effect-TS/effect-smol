// Measures full generated HttpApiClient method types with responseMode fixed to response-only for 1000 same-shaped endpoints in one group.
import { Effect, Schema } from "effect"
import { HttpClientError } from "effect/unstable/http"
import { HttpApi, HttpApiClient, HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware } from "effect/unstable/httpapi"
import type { Endpoint } from "./_client-methods-1000.ts"

Schema.String
HttpApi.make("Api")
HttpApiGroup.make("users")
HttpApiEndpoint.get("warmup", "/warmup")

type Simplify<A> = { readonly [K in keyof A]: A[K] } & {}
type SuccessType<S> = S extends Schema.Constraint ? S["Type"] : never
type Method<E extends HttpApiEndpoint.ConstraintRequest> = (
  request: Simplify<
    HttpApiEndpoint.ClientRequest<
      E["~Params"],
      E["~Query"],
      E["~Payload"],
      E["~Headers"],
      "response-only"
    >
  >
) => Effect.Effect<
  HttpApiClient.Client.Response<SuccessType<E["~Success"]>, "response-only">,
  | HttpApiMiddleware.Error<E["~Middleware"]>
  | HttpApiMiddleware.ClientError<E["~Middleware"]>
  | HttpClientError.HttpClientError,
  | E["~Params"]["EncodingServices"]
  | E["~Query"]["EncodingServices"]
  | E["~Payload"]["EncodingServices"]
  | E["~Headers"]["EncodingServices"]
>

type Users = {
  readonly [E in Endpoint as HttpApiEndpoint.Name<E>]: Method<E>
}
type Methods = Users[keyof Users]

export type ClientMethodNames = keyof Users
export type ClientMethods = Methods
export type ClientMethodRequests = Parameters<Methods>[0]
export type ClientMethodResults = ReturnType<Methods>
