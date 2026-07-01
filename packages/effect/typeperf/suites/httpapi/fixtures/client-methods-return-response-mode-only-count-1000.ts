// Measures generated HttpApiClient return types with responseMode conditionals for 1000 same-shaped endpoints.
import { Effect, Schema } from "effect"
import { HttpClientError } from "effect/unstable/http"
import { HttpApi, HttpApiClient, HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware } from "effect/unstable/httpapi"
import type { Endpoint } from "./_client-methods-1000.ts"

Schema.String
HttpApi.make("Api")
HttpApiGroup.make("users")
HttpApiEndpoint.get("warmup", "/warmup")

type ResponseMode = HttpApiEndpoint.ClientResponseMode
type SuccessType<S> = S extends Schema.Constraint ? S["Type"] : never
type SuccessDecodingServices<S> = S extends Schema.Constraint ? S["DecodingServices"] : never
type MethodReturn<E extends HttpApiEndpoint.ConstraintRequest, Mode extends ResponseMode> = Effect.Effect<
  HttpApiClient.Client.Response<SuccessType<E["~Success"]>, Mode>,
  | HttpApiMiddleware.Error<E["~Middleware"]>
  | HttpApiMiddleware.ClientError<E["~Middleware"]>
  | HttpClientError.HttpClientError
  | ([Mode] extends ["response-only"] ? never : E["~Error"]["Type"] | Schema.SchemaError),
  | E["~Params"]["EncodingServices"]
  | E["~Query"]["EncodingServices"]
  | E["~Payload"]["EncodingServices"]
  | E["~Headers"]["EncodingServices"]
  | ([Mode] extends ["response-only"] ? never
    :
      | SuccessDecodingServices<E["~Success"]>
      | E["~Error"]["DecodingServices"])
>
type Method<E extends HttpApiEndpoint.ConstraintRequest> = <Mode extends ResponseMode = ResponseMode>(
  request: unknown
) => MethodReturn<E, Mode>

type Users = {
  readonly [E in Endpoint as HttpApiEndpoint.Name<E>]: Method<E>
}
type Methods = Users[keyof Users]

export type ClientMethodNames = keyof Users
export type ClientMethods = Methods
export type ClientMethodResults = ReturnType<Methods>
