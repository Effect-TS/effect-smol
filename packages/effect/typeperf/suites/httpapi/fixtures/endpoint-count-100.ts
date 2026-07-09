// Measures how HttpApi type instantiations scale with 100 same-shaped endpoints in one group.
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
    }),
    HttpApiEndpoint.get("getUser0051", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0052", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0053", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0054", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0055", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0056", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0057", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0058", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0059", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0060", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0061", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0062", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0063", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0064", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0065", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0066", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0067", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0068", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0069", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0070", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0071", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0072", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0073", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0074", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0075", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0076", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0077", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0078", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0079", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0080", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0081", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0082", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0083", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0084", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0085", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0086", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0087", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0088", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0089", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0090", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0091", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0092", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0093", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0094", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0095", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0096", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0097", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0098", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0099", "/users/:id", {
      params: Params,
      success: User
    }),
    HttpApiEndpoint.get("getUser0100", "/users/:id", {
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
