import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Logger from "effect/Logger"
import * as References from "effect/References"
import * as Stream from "effect/Stream"
import * as HttpBody from "effect/unstable/http/HttpBody"
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import { requestPreResponseHandlers } from "effect/unstable/http/internal/preResponseHandler"

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

    it.effect("uses a stable http.span log span name", () =>
      Effect.gen(function*() {
        const spans: Array<Array<string>> = []
        const logger = Logger.make<unknown, void>((options) => {
          spans.push(options.fiber.getRef(References.CurrentLogSpans).map(([label]) => label))
        })

        const loggedApp = HttpMiddleware.logger(
          Effect.succeed(HttpServerResponse.empty({ status: 204 }))
        ).pipe(Effect.provide(Logger.layer([logger])))

        const request1 = HttpServerRequest.fromWeb(new Request("http://localhost:3000/one"))
        const request2 = HttpServerRequest.fromWeb(new Request("http://localhost:3000/two"))

        yield* loggedApp.pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, request1))
        yield* loggedApp.pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, request2))

        assert.deepStrictEqual(spans, [["http.span"], ["http.span"]])
      }))
  })

  describe("compression", () => {
    const decompress = async (
      bytes: globalThis.Uint8Array,
      encoding: "gzip" | "deflate"
    ): Promise<string> => {
      const ds = new globalThis.DecompressionStream(encoding)
      const writer = ds.writable.getWriter() as WritableStreamDefaultWriter<globalThis.Uint8Array>
      void writer.write(bytes)
      void writer.close()
      const reader = ds.readable.getReader() as ReadableStreamDefaultReader<globalThis.Uint8Array>
      const chunks: Array<globalThis.Uint8Array> = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
      let total = 0
      for (const c of chunks) total += c.length
      const out = new globalThis.Uint8Array(total)
      let offset = 0
      for (const c of chunks) {
        out.set(c, offset)
        offset += c.length
      }
      return new TextDecoder().decode(out)
    }

    const runCompression = (
      request: HttpServerRequest.HttpServerRequest,
      response: HttpServerResponse.HttpServerResponse,
      options?: Parameters<typeof HttpMiddleware.compression>[0]
    ) =>
      Effect.gen(function*() {
        yield* HttpMiddleware.compression(options)(Effect.succeed(response)).pipe(
          Effect.provideService(HttpServerRequest.HttpServerRequest, request)
        )
        const handler = requestPreResponseHandlers.get(request.source)
        assert.exists(handler, "compression should register a preResponseHandler")
        return yield* handler!(request, response)
      })

    const largeBody = "x".repeat(2048)

    it.effect("compresses Uint8Array bodies with gzip when accepted", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/data", {
            method: "GET",
            headers: { "accept-encoding": "gzip, deflate" }
          })
        )
        const response = HttpServerResponse.text(largeBody, { contentType: "text/plain" })
        const compressed = yield* runCompression(request, response)

        assert.strictEqual(compressed.headers["content-encoding"], "gzip")
        assert.strictEqual(compressed.headers["vary"], "Accept-Encoding")
        assert.strictEqual(compressed.body._tag, "Uint8Array")
        const body = compressed.body as HttpBody.Uint8Array
        assert.strictEqual(compressed.headers["content-length"], body.contentLength.toString())
        assert.isBelow(body.contentLength, largeBody.length, "compressed body should be smaller")
        const decoded = yield* Effect.promise(() => decompress(body.body, "gzip"))
        assert.strictEqual(decoded, largeBody)
      }))

    it.effect("prefers gzip over deflate", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/data", {
            method: "GET",
            headers: { "accept-encoding": "deflate, gzip" }
          })
        )
        const response = HttpServerResponse.text(largeBody)
        const compressed = yield* runCompression(request, response)
        assert.strictEqual(compressed.headers["content-encoding"], "gzip")
      }))

    it.effect("compresses Stream bodies and clears stale Content-Length", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/data", {
            method: "GET",
            headers: { "accept-encoding": "gzip" }
          })
        )
        const encoder = new TextEncoder()
        const body = HttpBody.stream(
          Stream.fromIterable([encoder.encode(largeBody)]),
          "text/plain",
          largeBody.length
        )
        const response = HttpServerResponse.empty().pipe(HttpServerResponse.setBody(body))
        const compressed = yield* runCompression(request, response)

        assert.strictEqual(compressed.headers["content-encoding"], "gzip")
        assert.strictEqual(compressed.headers["content-length"], undefined)
        assert.strictEqual(compressed.body._tag, "Stream")
      }))

    it.effect("skips when Accept-Encoding is missing", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/data", { method: "GET" })
        )
        const response = HttpServerResponse.text(largeBody)
        const out = yield* runCompression(request, response)
        assert.strictEqual(out.headers["content-encoding"], undefined)
        assert.strictEqual(out.body, response.body)
      }))

    it.effect("skips when no encoding is supported", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/data", {
            method: "GET",
            headers: { "accept-encoding": "br" }
          })
        )
        const response = HttpServerResponse.text(largeBody)
        const out = yield* runCompression(request, response)
        assert.strictEqual(out.headers["content-encoding"], undefined)
      }))

    it.effect("does not match unrelated tokens that share a prefix with gzip", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/data", {
            method: "GET",
            headers: { "accept-encoding": "gzipold, identity" }
          })
        )
        const response = HttpServerResponse.text(largeBody)
        const out = yield* runCompression(request, response)
        assert.strictEqual(out.headers["content-encoding"], undefined)
      }))

    it.effect("ignores q-values when matching encodings", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/data", {
            method: "GET",
            headers: { "accept-encoding": "gzip;q=0.5, deflate;q=1.0" }
          })
        )
        const response = HttpServerResponse.text(largeBody)
        const out = yield* runCompression(request, response)
        // We honour the configured priority (gzip first), not q-values yet.
        assert.strictEqual(out.headers["content-encoding"], "gzip")
      }))

    it.effect("skips bodies smaller than threshold", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/data", {
            method: "GET",
            headers: { "accept-encoding": "gzip" }
          })
        )
        const response = HttpServerResponse.text("tiny")
        const out = yield* runCompression(request, response)
        assert.strictEqual(out.headers["content-encoding"], undefined)
      }))

    it.effect("skips non-compressible content types", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/data", {
            method: "GET",
            headers: { "accept-encoding": "gzip" }
          })
        )
        const response = HttpServerResponse.uint8Array(
          new TextEncoder().encode(largeBody),
          { contentType: "image/png" }
        )
        const out = yield* runCompression(request, response)
        assert.strictEqual(out.headers["content-encoding"], undefined)
      }))

    // Locks the default content-type policy against the IANA mime-db
    // `compressible` flags. The "skip" cases are formats that are already
    // compressed (woff is zlib-wrapped, woff2 is brotli-wrapped, png/jpeg/mp4
    // are inherently compressed) and re-compressing wastes CPU for no gain.
    const compressiblePolicyCases: ReadonlyArray<[string, boolean]> = [
      ["text/plain", true],
      ["text/html; charset=utf-8", true],
      ["application/json", true],
      ["application/wasm", true],
      ["application/ld+json", true],
      ["application/manifest+json", true],
      ["application/xhtml+xml", true],
      ["image/svg+xml", true],
      ["image/bmp", true],
      ["font/otf", true],
      ["font/ttf", true],
      ["text/event-stream", false],
      ["font/woff", false],
      ["font/woff2", false],
      ["image/png", false],
      ["image/jpeg", false],
      ["video/mp4", false],
      ["audio/mpeg", false],
      ["application/zip", false],
      ["application/octet-stream", false]
    ]
    for (const [contentType, shouldCompress] of compressiblePolicyCases) {
      it.effect(`${shouldCompress ? "compresses" : "skips"} ${contentType}`, () =>
        Effect.gen(function*() {
          const request = HttpServerRequest.fromWeb(
            new Request("http://api.example.com/data", {
              method: "GET",
              headers: { "accept-encoding": "gzip" }
            })
          )
          const response = HttpServerResponse.uint8Array(
            new TextEncoder().encode(largeBody),
            { contentType }
          )
          const out = yield* runCompression(request, response)
          assert.strictEqual(
            out.headers["content-encoding"],
            shouldCompress ? "gzip" : undefined,
            `${contentType} should ${shouldCompress ? "compress" : "skip"}`
          )
        }))
    }

    it.effect("skips text/event-stream", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/data", {
            method: "GET",
            headers: { "accept-encoding": "gzip" }
          })
        )
        const response = HttpServerResponse.text(largeBody, { contentType: "text/event-stream" })
        const out = yield* runCompression(request, response)
        assert.strictEqual(out.headers["content-encoding"], undefined)
      }))

    it.effect("skips when response already has Content-Encoding", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/data", {
            method: "GET",
            headers: { "accept-encoding": "gzip" }
          })
        )
        const response = HttpServerResponse.text(largeBody).pipe(
          HttpServerResponse.setHeader("content-encoding", "br")
        )
        const out = yield* runCompression(request, response)
        assert.strictEqual(out.headers["content-encoding"], "br")
      }))

    it.effect("skips when Cache-Control: no-transform", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/data", {
            method: "GET",
            headers: { "accept-encoding": "gzip" }
          })
        )
        const response = HttpServerResponse.text(largeBody).pipe(
          HttpServerResponse.setHeader("cache-control", "public, no-transform")
        )
        const out = yield* runCompression(request, response)
        assert.strictEqual(out.headers["content-encoding"], undefined)
      }))

    it.effect("skips HEAD requests", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/data", {
            method: "HEAD",
            headers: { "accept-encoding": "gzip" }
          })
        )
        const response = HttpServerResponse.text(largeBody)
        const out = yield* runCompression(request, response)
        assert.strictEqual(out.headers["content-encoding"], undefined)
      }))

    it.effect("respects user skip predicate", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/skip-me", {
            method: "GET",
            headers: { "accept-encoding": "gzip" }
          })
        )
        const response = HttpServerResponse.text(largeBody)
        const out = yield* runCompression(request, response, {
          skip: (req) => req.url.includes("/skip-me")
        })
        assert.strictEqual(out.headers["content-encoding"], undefined)
      }))

    it.effect("merges Accept-Encoding into existing Vary", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/data", {
            method: "GET",
            headers: { "accept-encoding": "gzip" }
          })
        )
        const response = HttpServerResponse.text(largeBody).pipe(
          HttpServerResponse.setHeader("vary", "Origin")
        )
        const out = yield* runCompression(request, response)
        assert.strictEqual(out.headers["vary"], "Origin, Accept-Encoding")
      }))

    it.effect("weakens strong ETag when compressing", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/data", {
            method: "GET",
            headers: { "accept-encoding": "gzip" }
          })
        )
        const response = HttpServerResponse.text(largeBody).pipe(
          HttpServerResponse.setHeader("etag", "\"abc123\"")
        )
        const out = yield* runCompression(request, response)
        assert.strictEqual(out.headers["etag"], "W/\"abc123\"")
      }))

    it.effect("leaves weak ETag unchanged", () =>
      Effect.gen(function*() {
        const request = HttpServerRequest.fromWeb(
          new Request("http://api.example.com/data", {
            method: "GET",
            headers: { "accept-encoding": "gzip" }
          })
        )
        const response = HttpServerResponse.text(largeBody).pipe(
          HttpServerResponse.setHeader("etag", "W/\"abc123\"")
        )
        const out = yield* runCompression(request, response)
        assert.strictEqual(out.headers["etag"], "W/\"abc123\"")
      }))
  })
})
