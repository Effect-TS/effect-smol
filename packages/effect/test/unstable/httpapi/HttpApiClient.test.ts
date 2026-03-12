import { NodeHttpServer } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { strictEqual } from "@effect/vitest/utils"
import { Effect, Layer, Schema } from "effect"
import { HttpClient, HttpRouter } from "effect/unstable/http"
import { HttpApi, HttpApiBuilder, HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"

describe("HttpApiClient", () => {
  describe("Schema.Class payload", () => {
    class MyBody extends Schema.Class<MyBody>("MyBody")({
      name: Schema.String,
      age: Schema.Number
    }) {}

    class MyResponse extends Schema.Class<MyResponse>("MyResponse")({
      id: Schema.Number,
      name: Schema.String,
      age: Schema.Number
    }) {}

    const Api = HttpApi.make("Api")
      .add(
        HttpApiGroup.make("users")
          .add(
            HttpApiEndpoint.post("createUser", "/users", {
              payload: MyBody,
              success: MyResponse
            })
          )
      )

    // Server handler returns a plain object matching MyResponse shape
    const GroupLive = HttpApiBuilder.group(
      Api,
      "users",
      (handlers) =>
        handlers.handle("createUser", (ctx) =>
          Effect.succeed({ id: 1, name: ctx.payload.name, age: ctx.payload.age }))
    )

    const ApiLive = HttpRouter.serve(
      HttpApiBuilder.layer(Api).pipe(Layer.provide(GroupLive)),
      { disableListenLog: true, disableLogger: true }
    ).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

    it.effect("client: accepts a plain object as payload for Schema.Class endpoint", () =>
      Effect.gen(function*() {
        const client = yield* HttpApiClient.make(Api)
        const result = yield* client.users.createUser({
          payload: { name: "Kit", age: 30 }
        })
        assert.deepStrictEqual(result, { id: 1, name: "Kit", age: 30 })
      }).pipe(Effect.provide(ApiLive)))

    it.effect("server: encodes a plain object as Schema.Class success response", () =>
      Effect.gen(function*() {
        const client = yield* HttpApiClient.make(Api)
        // Handler returns plain { id, name, age } — not new MyResponse(...)
        // Server must encode it successfully as MyResponse
        const result = yield* client.users.createUser({
          payload: new MyBody({ name: "Kit", age: 30 })
        })
        assert.deepStrictEqual(result, { id: 1, name: "Kit", age: 30 })
      }).pipe(Effect.provide(ApiLive)))
  })

  describe("urlBuilder", () => {
    const Api = HttpApi.make("Api")
      .add(
        HttpApiGroup.make("users")
          .add(
            HttpApiEndpoint.get("getUser", "/users/:id", {
              params: {
                id: Schema.String
              },
              query: {
                page: Schema.String,
                tags: Schema.Array(Schema.String)
              }
            }),
            HttpApiEndpoint.get("health", "/health")
          )
      )

    it("builds urls from endpoint method/path", () => {
      const builder = HttpApiClient.urlBuilder<typeof Api>({
        baseUrl: "https://api.example.com"
      })

      strictEqual(
        builder("users", "GET /users/:id", {
          params: {
            id: "123"
          },
          query: {
            page: "1",
            tags: ["a", "b"]
          }
        }),
        "https://api.example.com/users/123?page=1&tags=a&tags=b"
      )
    })

    it("returns relative urls when baseUrl is omitted", () => {
      const builder = HttpApiClient.urlBuilder<typeof Api>()

      strictEqual(builder("users", "GET /health"), "/health")
    })
  })
})
