import { NodeHttpServer } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { strictEqual } from "@effect/vitest/utils"
import { Effect, Layer, Schema } from "effect"
import { HttpRouter } from "effect/unstable/http"
import { HttpApi, HttpApiBuilder, HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"

describe("HttpApiClient", () => {
  describe("Schema.Class with HttpApi", () => {
    // Pure data classes — no extra members.
    // TypeScript's structural typing makes plain objects indistinguishable
    // from class instances, so `{ name: "Kit", age: 30 }` satisfies `MyBody`.
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

    // Handler returns a plain object — not `new MyResponse(...)`.
    const GroupLive = HttpApiBuilder.group(
      Api,
      "users",
      (handlers) =>
        handlers.handle("createUser", (ctx) => Effect.succeed({ id: 1, name: ctx.payload.name, age: ctx.payload.age }))
    )

    const ApiLive = HttpRouter.serve(
      HttpApiBuilder.layer(Api).pipe(Layer.provide(GroupLive)),
      { disableListenLog: true, disableLogger: true }
    ).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

    it.effect("client payload: plain object typechecks and works at runtime", () =>
      Effect.gen(function*() {
        const client = yield* HttpApiClient.make(Api)
        // This typechecks because MyBody is structurally { name: string, age: number }.
        // Before the fix, it failed at runtime: "Expected MyBody, got {..}"
        const result = yield* client.users.createUser({
          payload: { name: "Kit", age: 30 }
        })
        assert.deepStrictEqual({ ...result }, { id: 1, name: "Kit", age: 30 })
      }).pipe(Effect.provide(ApiLive)))

    it.effect("client payload: class instance still works", () =>
      Effect.gen(function*() {
        const client = yield* HttpApiClient.make(Api)
        const result = yield* client.users.createUser({
          payload: new MyBody({ name: "Kit", age: 30 })
        })
        assert.deepStrictEqual({ ...result }, { id: 1, name: "Kit", age: 30 })
      }).pipe(Effect.provide(ApiLive)))

    it.effect("server encode: handler can return plain object for Schema.Class success", () =>
      Effect.gen(function*() {
        const client = yield* HttpApiClient.make(Api)
        // Handler returns `{ id, name, age }` — not `new MyResponse(...)`.
        // Before the fix, this failed: "Expected MyResponse, got {..}"
        const result = yield* client.users.createUser({
          payload: new MyBody({ name: "Kit", age: 30 })
        })
        assert.deepStrictEqual({ ...result }, { id: 1, name: "Kit", age: 30 })
      }).pipe(Effect.provide(ApiLive)))

    it.effect("server decode: plain object payload is decoded into class instance", () =>
      Effect.gen(function*() {
        const client = yield* HttpApiClient.make(Api)
        // Client sends plain object, server decodes it into a MyBody instance.
        // Handler accesses ctx.payload.name/age — works because it's a real instance.
        const result = yield* client.users.createUser({
          payload: { name: "Kit", age: 30 }
        })
        assert.deepStrictEqual({ ...result }, { id: 1, name: "Kit", age: 30 })
      }).pipe(Effect.provide(ApiLive)))

    it.effect("client decode: response is a proper class instance", () =>
      Effect.gen(function*() {
        const client = yield* HttpApiClient.make(Api)
        const result = yield* client.users.createUser({
          payload: new MyBody({ name: "Kit", age: 30 })
        })
        assert.isTrue(result instanceof MyResponse)
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
