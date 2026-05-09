import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Logger from "effect/Logger"
import * as References from "effect/References"
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"

describe("HttpMiddleware", () => {
  describe("logger", () => {
    it.effect("logs only the request path in http.url", () =>
      Effect.gen(function*() {
        const annotations: Array<Record<string, unknown>> = []
        const logger = Logger.make<unknown, void>((options) => {
          annotations.push({ ...options.fiber.getRef(References.CurrentLogAnnotations) })
        })

        const request = HttpServerRequest.fromWeb(
          new Request("http://localhost:3000/todos/1?foo=bar#top", {
            method: "GET"
          })
        )

        yield* HttpMiddleware.logger(
          Effect.succeed(HttpServerResponse.empty({ status: 204 }))
        ).pipe(
          Effect.provideService(HttpServerRequest.HttpServerRequest, request),
          Effect.provide(Logger.layer([logger]))
        )

        assert.strictEqual(annotations.length, 1)
        assert.strictEqual(annotations[0]?.["http.method"], "GET")
        assert.strictEqual(annotations[0]?.["http.url"], "/todos/1")
        assert.strictEqual(annotations[0]?.["http.status"], 204)
      }))
  })

  describe("cors", () => {
    it.effect("preflight Vary header includes both Origin and Access-Control-Request-Headers when origin is dynamic", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/resource", {
            method: "OPTIONS",
            headers: {
              "origin": "https://app-a.example.com",
              "access-control-request-method": "POST",
              "access-control-request-headers": "content-type"
            }
          })
        )

        const response = yield* HttpMiddleware.cors({
          allowedOrigins: ["https://app-a.example.com", "https://app-b.example.com"]
        })(Effect.succeed(HttpServerResponse.empty({ status: 200 }))).pipe(
          Effect.provideService(HttpServerRequest.HttpServerRequest, request)
        )

        assert.strictEqual(response.headers["access-control-allow-origin"], "https://app-a.example.com")
        // Bug: vary is just "Access-Control-Request-Headers" — the "Origin" entry
        // set by allowOrigin is overwritten by the spread from allowHeaders.
        // Without `Vary: Origin`, a shared cache may serve a preflight cached
        // for app-a.example.com to a request from app-b.example.com.
        const vary = response.headers["vary"] ?? ""
        assert.include(vary, "Origin", `expected Vary to include "Origin", got: ${vary}`)
        assert.include(
          vary,
          "Access-Control-Request-Headers",
          `expected Vary to include "Access-Control-Request-Headers", got: ${vary}`
        )
      }))

    it.effect("preflight Vary is just Origin when allowedHeaders is configured statically", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/resource", {
            method: "OPTIONS",
            headers: {
              "origin": "https://app-a.example.com",
              "access-control-request-method": "POST",
              "access-control-request-headers": "content-type"
            }
          })
        )

        const response = yield* HttpMiddleware.cors({
          allowedOrigins: ["https://app-a.example.com", "https://app-b.example.com"],
          allowedHeaders: ["content-type", "authorization"]
        })(Effect.succeed(HttpServerResponse.empty({ status: 200 }))).pipe(
          Effect.provideService(HttpServerRequest.HttpServerRequest, request)
        )

        assert.strictEqual(response.headers["vary"], "Origin")
      }))

    it.effect("preflight has no Vary header for wildcard origin", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/resource", {
            method: "OPTIONS",
            headers: {
              "origin": "https://app-a.example.com",
              "access-control-request-method": "POST"
            }
          })
        )

        const response = yield* HttpMiddleware.cors()(
          Effect.succeed(HttpServerResponse.empty({ status: 200 }))
        ).pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, request))

        assert.strictEqual(response.headers["access-control-allow-origin"], "*")
        assert.strictEqual(response.headers["vary"], undefined)
      }))
  })
})
