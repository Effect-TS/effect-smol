// Measures generated HttpApiClient error channel types for 1000 same-shaped endpoints in one group.
import { Effect, Schema } from "effect"
import { HttpClientError } from "effect/unstable/http"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware } from "effect/unstable/httpapi"
import type { Endpoint } from "./_client-methods-1000.ts"

Schema.String
HttpApi.make("Api")
HttpApiGroup.make("users")
HttpApiEndpoint.get("warmup", "/warmup")

type ResponseMode = HttpApiEndpoint.ClientResponseMode
type Method<E extends HttpApiEndpoint.ConstraintRequest> = <Mode extends ResponseMode = ResponseMode>() => Effect.Effect<
  unknown,
  | HttpApiMiddleware.Error<E["~Middleware"]>
  | HttpApiMiddleware.ClientError<E["~Middleware"]>
  | HttpClientError.HttpClientError
  | ([Mode] extends ["response-only"] ? never : E["~Error"]["Type"] | Schema.SchemaError),
  never
>

type Users = {
  readonly [E in Endpoint as HttpApiEndpoint.Name<E>]: Method<E>
}
type Methods = Users[keyof Users]

export type ClientMethodNames = keyof Users
export type ClientMethods = Methods
export type ClientMethodResults = ReturnType<Methods>
