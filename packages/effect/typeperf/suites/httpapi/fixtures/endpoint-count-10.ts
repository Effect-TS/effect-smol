// Measures how HttpApi type instantiations scale with 10 same-shaped endpoints in one group.
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"

Schema.String
HttpApi.make("Api")
HttpApiGroup.make("users")
HttpApiEndpoint.get("warmup", "/warmup")

const Params = Schema.Struct({
  id: Schema.FiniteFromString
})

const User = Schema.Struct({
  id: Schema.String,
  name: Schema.String
})

const api = HttpApi.make("Api").add(
  HttpApiGroup.make("users").add(
    HttpApiEndpoint.get("getUser0001", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0002", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0003", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0004", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0005", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0006", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0007", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0008", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0009", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0010", "/users/:id", {
      params: Params,
      success: User
    })
  )
)

type Groups = typeof api extends HttpApi.HttpApi<string, infer Groups> ? Groups : never
type Endpoints = HttpApiGroup.Endpoints<Groups>

export type Api = typeof api
export type EndpointIdentifiers = HttpApiEndpoint.Identifier<Endpoints>
export type EndpointRequests = HttpApiEndpoint.Request<Endpoints>
export type ServerServices = HttpApiEndpoint.ServerServices<Endpoints>
export type ClientServices = HttpApiEndpoint.ClientServices<Endpoints>
