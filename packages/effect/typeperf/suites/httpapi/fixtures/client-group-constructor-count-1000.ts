// Measures HttpApiClient.group type production for one selected group with 1000 endpoints.
import { Effect } from "effect"
import { HttpClient } from "effect/unstable/http"
import { HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { api } from "./_client-methods-1000.ts"

HttpApiGroup.make("users")
HttpApiEndpoint.get("warmup", "/warmup")

declare const httpClient: HttpClient.HttpClient

const groupClient = HttpApiClient.group(api, {
  group: "users",
  httpClient
})

type GroupClientEffect = typeof groupClient
type Users = GroupClientEffect extends Effect.Effect<infer _A, infer _E, infer _R> ? _A : never
type Methods = Users[keyof Users]

export type GeneratedGroupClient = GroupClientEffect
export type GroupClient = Users
export type GroupClientMethodNames = keyof Users
export type GroupClientMethods = Methods
export type GroupClientMethodRequests = Parameters<Methods>[0]
export type GroupClientMethodResults = ReturnType<Methods>
