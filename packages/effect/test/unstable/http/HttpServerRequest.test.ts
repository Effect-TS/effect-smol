import { describe, test } from "@effect/vitest"
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import { Effect, Stream } from "effect"
import { HttpClientRequest, HttpServerRequest } from "effect/unstable/http"

describe("HttpServerRequest", () => {
  test("toClientRequest", async () => {
    const serverRequest = HttpServerRequest.fromWeb(
      new Request("http://localhost:3000/todos/1?a=1&a=2#top", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "13",
          "x-test": "ok"
        },
        body: "{\"foo\":\"bar\"}"
      })
    )
    const clientRequest = HttpServerRequest.toClientRequest(serverRequest)

    strictEqual(HttpClientRequest.isHttpClientRequest(clientRequest), true)
    strictEqual(clientRequest.method, "POST")
    strictEqual(clientRequest.url, "/todos/1")
    strictEqual(clientRequest.hash, "top")
    strictEqual(clientRequest.headers["content-type"], "application/json")
    strictEqual(clientRequest.headers["content-length"], "13")
    strictEqual(clientRequest.headers["x-test"], "ok")
    deepStrictEqual([...clientRequest.urlParams], [["a", "1"], ["a", "2"]])
    strictEqual(clientRequest.body._tag, "Stream")

    if (clientRequest.body._tag === "Stream") {
      strictEqual(
        await Effect.runPromise(clientRequest.body.stream.pipe(
          Stream.decodeText(),
          Stream.mkString
        )),
        "{\"foo\":\"bar\"}"
      )
    }
  })

  test("toClientRequest keeps empty bodies empty", () => {
    const clientRequest = HttpServerRequest.toClientRequest(
      HttpServerRequest.fromWeb(
        new Request("http://localhost:3000/todos/1", {
          method: "GET",
          headers: {
            "content-type": "application/json",
            "x-test": "ok"
          }
        })
      )
    )

    strictEqual(clientRequest.body._tag, "Empty")
    strictEqual(clientRequest.headers["content-type"], "application/json")
    strictEqual(clientRequest.headers["x-test"], "ok")
  })
})
