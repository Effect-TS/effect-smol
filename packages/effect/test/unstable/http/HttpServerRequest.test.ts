import { describe, it } from "@effect/vitest"
import { assertInclude, deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import { Effect, Stream } from "effect"
import { HttpBody, HttpClientRequest, HttpServerRequest } from "effect/unstable/http"

describe("HttpServerRequest", () => {
  describe("fromClientRequest", () => {
    it.effect("preserves relative request metadata", () =>
      Effect.gen(function*() {
        const request = HttpClientRequest.post("/users").pipe(
          HttpClientRequest.appendUrlParams({
            page: 1,
            filter: ["a", "b"]
          }),
          HttpClientRequest.setHash("details"),
          HttpClientRequest.setHeader("cookie", "session=abc; theme=dark"),
          HttpClientRequest.bodyText("hello", "text/custom")
        )

        const serverRequest = HttpServerRequest.fromClientRequest(request)

        strictEqual(serverRequest.source instanceof Request, false)
        strictEqual(serverRequest.method, "POST")
        strictEqual(serverRequest.url, "/users?page=1&filter=a&filter=b#details")
        strictEqual(serverRequest.originalUrl, "/users?page=1&filter=a&filter=b#details")
        strictEqual(serverRequest.headers["content-type"], "text/custom")
        deepStrictEqual(serverRequest.cookies, {
          session: "abc",
          theme: "dark"
        })
        strictEqual(yield* serverRequest.text, "hello")
      }))

    it.effect("keeps bodies on GET requests", () =>
      Effect.gen(function*() {
        const request = HttpClientRequest.get("/search").pipe(
          HttpClientRequest.bodyText("query=effect")
        )

        const serverRequest = HttpServerRequest.fromClientRequest(request)

        strictEqual(serverRequest.method, "GET")
        strictEqual(serverRequest.url, "/search")
        strictEqual(yield* serverRequest.text, "query=effect")
      }))

    it.effect("encodes form data and streams", () =>
      Effect.gen(function*() {
        const formRequest = HttpClientRequest.post("/upload").pipe(
          HttpClientRequest.bodyFormDataRecord({ file: "contents" })
        )
        const formServerRequest = HttpServerRequest.fromClientRequest(formRequest)

        assertInclude(formServerRequest.headers["content-type"], "multipart/form-data; boundary=")
        const formBody = yield* formServerRequest.text
        assertInclude(formBody, "name=\"file\"")
        assertInclude(formBody, "contents")

        const streamRequest = HttpClientRequest.post("https://example.com/stream").pipe(
          HttpClientRequest.setBody(
            HttpBody.stream(
              Stream.make(new TextEncoder().encode("hello")),
              "text/plain"
            )
          )
        )
        const streamServerRequest = HttpServerRequest.fromClientRequest(streamRequest)

        strictEqual(streamServerRequest.url, "/stream")
        strictEqual(streamServerRequest.originalUrl, "https://example.com/stream")
        strictEqual(yield* streamServerRequest.text, "hello")
      }))
  })
})
