import { NodeHttpServer } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Schema } from "effect"
import { HttpRouter } from "effect/unstable/http"
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiClient,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema
} from "effect/unstable/httpapi"

describe("HttpApiClient", () => {
  describe("success option", () => {
    it.effect("no content", () => {
      const Api = HttpApi.make("api")
        .add(
          HttpApiGroup.make("group")
            .add(
              HttpApiEndpoint.get("a", "/a", {
                success: Schema.Void
              }),
              HttpApiEndpoint.get("b", "/b", {
                success: HttpApiSchema.NoContent
              }),
              HttpApiEndpoint.get("c", "/c", {
                success: Schema.String.pipe(HttpApiSchema.asNoContent({ decode: () => "c" }))
              })
            )
        )
      const GroupLive = HttpApiBuilder.group(
        Api,
        "group",
        (handlers) =>
          handlers
            .handle("a", () => Effect.void)
            .handle("b", () => Effect.succeed(HttpApiSchema.NoContent.makeUnsafe()))
            .handle("c", () => Effect.succeed(""))
      )

      const ApiLive = HttpRouter.serve(
        HttpApiBuilder.layer(Api).pipe(Layer.provide(GroupLive)),
        { disableListenLog: true, disableLogger: true }
      ).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

      return Effect.gen(function*() {
        const client = yield* HttpApiClient.make(Api)
        const a = yield* client.group.a()
        assert.strictEqual(a, undefined)
        const b = yield* client.group.b()
        assert.strictEqual(b, undefined)
        const c = yield* client.group.c()
        assert.strictEqual(c, "c")
      }).pipe(Effect.provide(ApiLive))
    })
  })

  describe("error option", () => {
    it.effect("no content", () => {
      const Api = HttpApi.make("api")
        .add(
          HttpApiGroup.make("group")
            .add(
              HttpApiEndpoint.get("a", "/a", {
                error: Schema.Void.pipe(HttpApiSchema.status(403))
              }),
              HttpApiEndpoint.get("b", "/b", {
                error: HttpApiSchema.NoContent,
                success: Schema.String
              }),
              HttpApiEndpoint.get("c", "/c", {
                error: Schema.String.pipe(
                  HttpApiSchema.asNoContent({ decode: () => "c" }),
                  HttpApiSchema.status(403)
                )
              })
            )
        )
      const GroupLive = HttpApiBuilder.group(
        Api,
        "group",
        (handlers) =>
          handlers
            .handle("a", () => Effect.fail(undefined))
            .handle("b", () => Effect.fail(HttpApiSchema.NoContent.makeUnsafe()))
            .handle("c", () => Effect.fail(""))
      )

      const ApiLive = HttpRouter.serve(
        HttpApiBuilder.layer(Api).pipe(Layer.provide(GroupLive)),
        { disableListenLog: true, disableLogger: true }
      ).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

      return Effect.gen(function*() {
        const client = yield* HttpApiClient.make(Api)
        const a = yield* Effect.flip(client.group.a())
        assert.strictEqual(a, undefined)
        const b = yield* Effect.flip(client.group.b())
        assert.strictEqual(b, undefined)
        const c = yield* Effect.flip(client.group.c())
        assert.strictEqual(c, "c")
      }).pipe(Effect.provide(ApiLive))
    })
  })
})
