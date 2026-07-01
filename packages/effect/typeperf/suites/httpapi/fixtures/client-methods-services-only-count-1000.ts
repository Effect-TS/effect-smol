// Measures generated HttpApiClient service channel types for 1000 same-shaped endpoints in one group.
import { Effect, Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import type { Endpoint } from "./_client-methods-1000.ts"

Schema.String
HttpApi.make("Api")
HttpApiGroup.make("users")
HttpApiEndpoint.get("warmup", "/warmup")

type ResponseMode = HttpApiEndpoint.ClientResponseMode
type SuccessDecodingServices<S> = S extends Schema.Constraint ? S["DecodingServices"] : never
type Method<E extends HttpApiEndpoint.ConstraintRequest> = <Mode extends ResponseMode = ResponseMode>() =>
  Effect.Effect<
    unknown,
    never,
    | E["~Params"]["EncodingServices"]
    | E["~Query"]["EncodingServices"]
    | E["~Payload"]["EncodingServices"]
    | E["~Headers"]["EncodingServices"]
    | ([Mode] extends ["response-only"] ? never
      : SuccessDecodingServices<E["~Success"]> | E["~Error"]["DecodingServices"])
  >

type Users = {
  readonly [E in Endpoint as HttpApiEndpoint.Name<E>]: Method<E>
}
type Methods = Users[keyof Users]

export type ClientMethodNames = keyof Users
export type ClientMethods = Methods
export type ClientMethodResults = ReturnType<Methods>
