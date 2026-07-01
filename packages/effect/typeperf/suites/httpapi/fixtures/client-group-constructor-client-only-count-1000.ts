// Measures only the client value side of HttpApiClient.group's return type for one 1000-endpoint group.
import { Effect } from "effect"
import { HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import type { UsersGroup } from "./_client-methods-1000.ts"

HttpApiGroup.make("users")
HttpApiEndpoint.get("warmup", "/warmup")

type GroupClientEffect = Effect.Effect<
  HttpApiClient.Client.Group<UsersGroup, never, never>,
  never,
  never
>
type Users = GroupClientEffect extends Effect.Effect<infer _A, infer _E, infer _R> ? _A : never
type Methods = Users[keyof Users]

export type GeneratedGroupClient = GroupClientEffect
export type GroupClient = Users
export type GroupClientMethodNames = keyof Users
export type GroupClientMethods = Methods
export type GroupClientMethodRequests = Parameters<Methods>[0]
export type GroupClientMethodResults = ReturnType<Methods>
