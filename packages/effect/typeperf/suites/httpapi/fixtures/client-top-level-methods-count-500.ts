// Measures generated HttpApiClient top-level method type production for 500 endpoints.
import { Schema } from "effect"
import { HttpApi, HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import type { Endpoint } from "./_client-methods-500.ts"

Schema.String
HttpApi.make("Api")
HttpApiGroup.make("top", { topLevel: true })
HttpApiEndpoint.get("warmup", "/warmup")

type TopGroup = HttpApiGroup.HttpApiGroup<"top", Endpoint, true>
type Client = HttpApiClient.Client<TopGroup>
type Methods = Client[keyof Client]

export type GeneratedClient = Client
export type ClientMethodNames = keyof Client
export type ClientMethods = Methods
export type ClientMethodRequests = Parameters<Methods>[0]
export type ClientMethodResults = ReturnType<Methods>
