// Measures generated HttpApiClient request parameter types without Simplify for 1000 same-shaped endpoints in one group.
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import type { Endpoint } from "./_client-methods-1000.ts"

Schema.String
HttpApi.make("Api")
HttpApiGroup.make("users")
HttpApiEndpoint.get("warmup", "/warmup")

type ResponseMode = HttpApiEndpoint.ClientResponseMode
type Method<E extends HttpApiEndpoint.ConstraintRequest> = <Mode extends ResponseMode = ResponseMode>(
  request: HttpApiEndpoint.ClientRequest<
    E["~Params"],
    E["~Query"],
    E["~Payload"],
    E["~Headers"],
    Mode
  >
) => unknown

type Users = {
  readonly [E in Endpoint as HttpApiEndpoint.Name<E>]: Method<E>
}
type Methods = Users[keyof Users]

export type ClientMethodNames = keyof Users
export type ClientMethods = Methods
export type ClientMethodRequests = Parameters<Methods>[0]
