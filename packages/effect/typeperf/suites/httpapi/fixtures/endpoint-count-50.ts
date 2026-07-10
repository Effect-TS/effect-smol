// Measures endpoint declaration for 50 same-shaped endpoints in one group.
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
    }),
    HttpApiEndpoint.get("getUser0011", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0012", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0013", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0014", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0015", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0016", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0017", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0018", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0019", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0020", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0021", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0022", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0023", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0024", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0025", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0026", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0027", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0028", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0029", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0030", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0031", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0032", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0033", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0034", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0035", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0036", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0037", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0038", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0039", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0040", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0041", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0042", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0043", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0044", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0045", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0046", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0047", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0048", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0049", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0050", "/users/:id", {
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
