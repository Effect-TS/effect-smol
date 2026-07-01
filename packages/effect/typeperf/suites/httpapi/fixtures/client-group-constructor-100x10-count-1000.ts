// Measures HttpApiClient.group type production for one selected group among 100 groups with 10 endpoints each.
import { Effect, Schema } from "effect"
import { HttpClient } from "effect/unstable/http"
import { HttpApi, HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import type { Endpoint } from "./_client-methods-1000.ts"

Schema.String
HttpApi.make("Api")
HttpApiGroup.make("group001")
HttpApiEndpoint.get("warmup", "/warmup")

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
type NonZeroDigit = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
type TwoDigit = `0${NonZeroDigit}` | `${NonZeroDigit}${Digit}`
type GroupName = `group0${TwoDigit}` | "group100"
type EndpointName = `getUser000${NonZeroDigit}` | "getUser0010"
type TenEndpoints = Extract<Endpoint, { readonly name: EndpointName }>
type Groups = {
  readonly [Name in GroupName]: HttpApiGroup.HttpApiGroup<Name, TenEndpoints>
}[GroupName]

declare const api: HttpApi.HttpApi<"Api", Groups>
declare const httpClient: HttpClient.HttpClient

const groupClient = HttpApiClient.group(api, {
  group: "group100",
  httpClient
})

type GroupClientEffect = typeof groupClient
type SelectedGroup = GroupClientEffect extends Effect.Effect<infer _A, infer _E, infer _R> ? _A : never
type Methods = SelectedGroup[keyof SelectedGroup]

export type GeneratedGroupClient = GroupClientEffect
export type GroupClient = SelectedGroup
export type GroupClientMethodNames = keyof SelectedGroup
export type GroupClientMethods = Methods
export type GroupClientMethodRequests = Parameters<Methods>[0]
export type GroupClientMethodResults = ReturnType<Methods>
