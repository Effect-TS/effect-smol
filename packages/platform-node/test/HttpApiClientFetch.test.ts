import { NodeHttpServer } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Schema } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiClientFetch,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema
} from "effect/unstable/httpapi"

class MissingUser extends Schema.ErrorClass<MissingUser>("MissingUser")({
  _tag: Schema.tag("MissingUser"),
  message: Schema.String
}, {
  httpApiStatus: 404
}) {}

class GoneUser extends HttpApiSchema.EmptyError<GoneUser>()({
  tag: "GoneUser",
  status: 410
}) {}

const Api = HttpApi.make("api").add(
  HttpApiGroup.make("users").add(
    HttpApiEndpoint.get("find", "/users/:id", {
      path: {
        id: Schema.FiniteFromString
      },
      urlParams: {
        query: Schema.String
      },
      error: [MissingUser, GoneUser],
      success: Schema.Struct({
        id: Schema.Number,
        query: Schema.String
      })
    }),
    HttpApiEndpoint.post("create", "/users", {
      payload: Schema.Struct({
        name: Schema.String
      }),
      success: Schema.Struct({
        message: Schema.String
      })
    }),
    HttpApiEndpoint.post("createUrlEncoded", "/users/url-encoded", {
      payload: HttpApiSchema.withEncoding(
        Schema.Struct({
          name: Schema.String,
          count: Schema.FiniteFromString
        }),
        { kind: "UrlParams" }
      ),
      success: Schema.Struct({
        name: Schema.String,
        count: Schema.Number
      })
    })
  )
)

const UsersLive = HttpApiBuilder.group(
  Api,
  "users",
  (handlers) =>
    handlers
      .handle("find", (ctx) =>
        ctx.path.id === 0
          ? Effect.fail(new MissingUser({ message: "User not found" }))
          : ctx.path.id === -1
          ? Effect.fail(new GoneUser())
          : Effect.succeed({ id: ctx.path.id, query: ctx.urlParams.query }))
      .handle("create", (ctx) => Effect.succeed({ message: `hello ${ctx.payload.name}` }))
      .handle("createUrlEncoded", (ctx) => Effect.succeed({ name: ctx.payload.name, count: ctx.payload.count }))
)

const HttpLive = HttpRouter.serve(
  HttpApiBuilder.layer(Api).pipe(Layer.provide(UsersLive)),
  { disableListenLog: true, disableLogger: true }
).pipe(
  Layer.provideMerge(NodeHttpServer.layerTest)
)

const baseUrlEffect = Effect.gen(function*() {
  const server = yield* HttpServer.HttpServer
  const address = server.address
  if (address._tag !== "TcpAddress") {
    return yield* Effect.die(new Error("TcpAddress expected"))
  }
  const host = address.hostname === "0.0.0.0" ? "127.0.0.1" : address.hostname
  return `http://${host}:${address.port}`
})

describe("HttpApiClientFetch", () => {
  it.effect("calls HttpApi endpoints with path and query params", () =>
    Effect.gen(function*() {
      const baseUrl = yield* baseUrlEffect
      const client = HttpApiClientFetch.make<typeof Api>({ baseUrl })
      const response = yield* Effect.promise(() =>
        client("GET /users/:id", {
          path: { id: "42" },
          urlParams: { query: "search" }
        })
      )
      const body = yield* Effect.promise(() => response.json())
      assert.deepStrictEqual(body, { id: 42, query: "search" })
    }).pipe(Effect.provide(HttpLive)))

  it.effect("sends JSON payloads", () =>
    Effect.gen(function*() {
      const baseUrl = yield* baseUrlEffect
      const client = HttpApiClientFetch.make<typeof Api>({ baseUrl })
      const response = yield* Effect.promise(() =>
        client("POST /users", {
          payload: { name: "Ada" }
        })
      )
      const body = yield* Effect.promise(() => response.json())
      assert.deepStrictEqual(body, { message: "hello Ada" })
    }).pipe(Effect.provide(HttpLive)))

  it.effect("sends url-encoded payloads", () =>
    Effect.gen(function*() {
      const baseUrl = yield* baseUrlEffect
      const client = HttpApiClientFetch.make<typeof Api>({ baseUrl })
      const response = yield* Effect.promise(() =>
        client("POST /users/url-encoded", {
          payload: { name: "Ada", count: "2" },
          payloadType: "urlEncoded"
        })
      )
      const body = yield* Effect.promise(() => response.json())
      assert.deepStrictEqual(body, { name: "Ada", count: 2 })
    }).pipe(Effect.provide(HttpLive)))

  it.effect("throws on JSON error responses", () =>
    Effect.gen(function*() {
      const baseUrl = yield* baseUrlEffect
      const client = HttpApiClientFetch.make<typeof Api>({ baseUrl })
      const error = yield* Effect.tryPromise({
        try: () =>
          client("GET /users/:id", {
            path: { id: "0" },
            urlParams: { query: "search" }
          }),
        catch: (caught) => caught
      }).pipe(Effect.flip)
      assert.instanceOf(error, Error)
      assert.strictEqual(error.message, "HTTP error status: 404")
    }).pipe(Effect.provide(HttpLive)))

  it.effect("throws on empty error responses", () =>
    Effect.gen(function*() {
      const baseUrl = yield* baseUrlEffect
      const client = HttpApiClientFetch.make<typeof Api>({ baseUrl })
      const error = yield* Effect.tryPromise({
        try: () =>
          client("GET /users/:id", {
            path: { id: "-1" },
            urlParams: { query: "search" }
          }),
        catch: (caught) => caught
      }).pipe(Effect.flip)
      assert.instanceOf(error, Error)
      assert.strictEqual(error.message, "HTTP error status: 410")
    }).pipe(Effect.provide(HttpLive)))
})
