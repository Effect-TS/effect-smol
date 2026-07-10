// Measures chained builder handle registration for 10 same-shaped endpoints in one group.
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
  })
)

const api = HttpApi.make("Api").add(group)

const layer = HttpApiBuilder.group(api, "users", (handlers) =>
  handlers
    .handle("getUser0001", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handle("getUser0002", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handle("getUser0003", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handle("getUser0004", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handle("getUser0005", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handle("getUser0006", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handle("getUser0007", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handle("getUser0008", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handle("getUser0009", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handle("getUser0010", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      })))

export type Layer = typeof layer
export type Handlers = HttpApiBuilder.Handlers.FromGroup<typeof group>
