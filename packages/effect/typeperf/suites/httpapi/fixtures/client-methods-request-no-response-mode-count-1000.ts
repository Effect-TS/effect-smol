// Measures generated HttpApiClient request parameter types without responseMode for 1000 same-shaped endpoints.
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import type { Endpoint } from "./_client-methods-1000.ts"

Schema.String
HttpApi.make("Api")
HttpApiGroup.make("users")
HttpApiEndpoint.get("warmup", "/warmup")

type Simplify<A> = { readonly [K in keyof A]: A[K] } & {}
type ClientRequestNoResponseMode<
  Params extends Schema.Constraint,
  Query extends Schema.Constraint,
  Payload extends Schema.Constraint,
  Headers extends Schema.Constraint
> = (
  & ([Params["Type"]] extends [never] ? {} : { readonly params: Params["Type"] })
  & ([Query["Type"]] extends [never] ? {} : { readonly query: Query["Type"] })
  & ([Headers["Type"]] extends [never] ? {} : { readonly headers: Headers["Type"] })
  & ([Payload["Type"]] extends [never] ? {} : { readonly payload: Payload["Type"] })
) extends infer Req ? keyof Req extends never ? void : Req
  : never

type Method<E extends HttpApiEndpoint.ConstraintRequest> = (
  request: Simplify<
    ClientRequestNoResponseMode<
      E["~Params"],
      E["~Query"],
      E["~Payload"],
      E["~Headers"]
    >
  >
) => unknown

type Users = {
  readonly [E in Endpoint as HttpApiEndpoint.Name<E>]: Method<E>
}
type Methods = Users[keyof Users]

export type ClientMethodNames = keyof Users
export type ClientMethods = Methods
export type ClientMethodRequests = Parameters<Methods>[0]
