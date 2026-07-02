// Measures HttpApiClient.endpoint method type production for one selected endpoint in a 500-endpoint group.
import { Effect, Schema } from "effect"
import { HttpClient } from "effect/unstable/http"
import { HttpApi, HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { api } from "./_client-methods-500.ts"

Schema.String
HttpApi.make("Api")
HttpApiGroup.make("users")
HttpApiEndpoint.get("warmup", "/warmup")

declare const httpClient: HttpClient.HttpClient

const endpointClient = HttpApiClient.endpoint(api, {
  group: "users",
  endpoint: "getUser0500",
  httpClient
})

type EndpointClient = typeof endpointClient
type Method = typeof endpointClient extends Effect.Effect<infer _A, infer _E, infer _R> ? _A : never

export type Api = typeof api
export type GeneratedEndpointClient = EndpointClient
export type EndpointClientMethod = Method
export type EndpointClientRequest = Parameters<Method>[0]
export type EndpointClientResult = ReturnType<Method>
