// Measures generated HttpApiClient group type production for 100 groups with 10 endpoints each.
import { Schema } from "effect"
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
type Client = HttpApiClient.Client<Groups>
type GroupClients = Client[keyof Client]
type Methods = GroupClients[keyof GroupClients]

export type GeneratedClient = Client
export type ClientGroupNames = keyof Client
export type ClientGroups = GroupClients
export type ClientMethodNames = keyof GroupClients
export type ClientMethods = Methods
export type ClientMethodRequests = Parameters<Methods>[0]
export type ClientMethodResults = ReturnType<Methods>
