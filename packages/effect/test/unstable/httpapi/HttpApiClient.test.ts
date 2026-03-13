import { NodeHttpServer } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { strictEqual } from "@effect/vitest/utils"
import { Effect, Layer, Schema } from "effect"
import { HttpClient, HttpRouter } from "effect/unstable/http"
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiClient,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware
} from "effect/unstable/httpapi"

describe("HttpApiClient", () => {
  describe("middleware error status codes", () => {
    class Unauthorized extends Schema.TaggedErrorClass<Unauthorized>()(
      "Unauthorized",
      {},
      { httpApiStatus: 401 }
    ) {}

    class Forbidden extends Schema.TaggedErrorClass<Forbidden>()(
      "Forbidden",
      {},
      { httpApiStatus: 403 }
    ) {}

    class AuthMiddleware extends HttpApiMiddleware.Service<AuthMiddleware>()("AuthMiddleware", {
      error: Schema.Union([Unauthorized, Forbidden])
    }) {}

    const Api = HttpApi.make("Api")
      .add(
        HttpApiGroup.make("users")
          .add(
            HttpApiEndpoint.get("me", "/me", {
              success: Schema.Struct({ id: Schema.String })
            })
          )
          .middleware(AuthMiddleware)
      )

    const GroupLive = HttpApiBuilder.group(
      Api,
      "users",
      (handlers) => handlers.handle("me", () => Effect.succeed({ id: "1" }))
    )

    function makeApiLive(middlewareImpl: Layer.Layer<AuthMiddleware>) {
      return HttpRouter.serve(
        HttpApiBuilder.layer(Api).pipe(
          Layer.provide(GroupLive),
          Layer.provide(middlewareImpl)
        ),
        { disableListenLog: true, disableLogger: true }
      ).pipe(Layer.provideMerge(NodeHttpServer.layerTest))
    }

    it.effect("middleware union error: Unauthorized returns 401 (not 500)", () =>
      Effect.gen(function*() {
        const client = yield* HttpClient.HttpClient
        const response = yield* client.get("/me")
        assert.strictEqual(response.status, 401)
      }).pipe(Effect.provide(makeApiLive(
        Layer.succeed(AuthMiddleware, (_httpEffect) => Effect.fail(new Unauthorized()))
      ))))

    it.effect("middleware union error: Forbidden returns 403 (not 500)", () =>
      Effect.gen(function*() {
        const client = yield* HttpClient.HttpClient
        const response = yield* client.get("/me")
        assert.strictEqual(response.status, 403)
      }).pipe(Effect.provide(makeApiLive(
        Layer.succeed(AuthMiddleware, (_httpEffect) => Effect.fail(new Forbidden()))
      ))))
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
