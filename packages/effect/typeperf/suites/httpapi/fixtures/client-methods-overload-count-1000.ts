// Measures overload-style generated HttpApiClient method types for 1000 same-shaped endpoints in one group.
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
type SuccessDecodingServices<S> = S extends Schema.Constraint ? S["DecodingServices"] : never
type DecodedError<E extends HttpApiEndpoint.ConstraintRequest> =
  | HttpApiMiddleware.Error<E["~Middleware"]>
  | HttpApiMiddleware.ClientError<E["~Middleware"]>
  | HttpClientError.HttpClientError
  | E["~Error"]["Type"]
  | Schema.SchemaError
type ResponseOnlyError<E extends HttpApiEndpoint.ConstraintRequest> =
  | HttpApiMiddleware.Error<E["~Middleware"]>
  | HttpApiMiddleware.ClientError<E["~Middleware"]>
  | HttpClientError.HttpClientError
type RequestServices<E extends HttpApiEndpoint.ConstraintRequest> =
  | E["~Params"]["EncodingServices"]
  | E["~Query"]["EncodingServices"]
  | E["~Payload"]["EncodingServices"]
  | E["~Headers"]["EncodingServices"]
type DecodingServices<E extends HttpApiEndpoint.ConstraintRequest> =
  | SuccessDecodingServices<E["~Success"]>
  | E["~Error"]["DecodingServices"]
type Request<E extends HttpApiEndpoint.ConstraintRequest, Mode extends HttpApiEndpoint.ClientResponseMode> = Simplify<
  HttpApiEndpoint.ClientRequest<
    E["~Params"],
    E["~Query"],
    E["~Payload"],
    E["~Headers"],
    Mode
  >
>
type Method<E extends HttpApiEndpoint.ConstraintRequest> =
  & ((request: Request<E, "decoded-only">) => Effect.Effect<
    HttpApiClient.Client.Response<SuccessType<E["~Success"]>, "decoded-only">,
    DecodedError<E>,
    RequestServices<E> | DecodingServices<E>
  >)
  & ((request: Request<E, "decoded-and-response">) => Effect.Effect<
    HttpApiClient.Client.Response<SuccessType<E["~Success"]>, "decoded-and-response">,
    DecodedError<E>,
    RequestServices<E> | DecodingServices<E>
  >)
  & ((request: Request<E, "response-only">) => Effect.Effect<
    HttpApiClient.Client.Response<SuccessType<E["~Success"]>, "response-only">,
    ResponseOnlyError<E>,
    RequestServices<E>
  >)

type Users = {
  readonly [E in Endpoint as HttpApiEndpoint.Name<E>]: Method<E>
}
type Methods = Users[keyof Users]

export type ClientMethodNames = keyof Users
export type ClientMethods = Methods
export type ClientMethodRequests = Parameters<Methods>[0]
export type ClientMethodResults = ReturnType<Methods>
