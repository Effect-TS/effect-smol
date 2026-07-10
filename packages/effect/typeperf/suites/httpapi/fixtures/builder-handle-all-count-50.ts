// Measures builder handleAll registration for 50 same-shaped endpoints in one group.
import { Effect, Schema } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"

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

const group = HttpApiGroup.make("users").add(
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

const api = HttpApi.make("Api").add(group)

const layer = HttpApiBuilder.group(api, "users", (handlers) =>
  handlers.handleAll({
    getUser0001: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0002: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0003: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0004: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0005: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0006: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0007: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0008: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0009: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0010: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0011: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0012: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0013: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0014: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0015: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0016: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0017: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0018: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0019: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0020: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0021: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0022: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0023: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0024: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0025: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0026: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0027: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0028: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0029: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0030: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0031: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0032: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0033: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0034: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0035: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0036: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0037: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0038: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0039: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0040: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0041: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0042: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0043: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0044: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0045: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0046: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0047: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0048: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0049: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }),
    getUser0050: ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      })
  }))

export type Layer = typeof layer
export type Handlers = HttpApiBuilder.Handlers.FromGroup<typeof group>
