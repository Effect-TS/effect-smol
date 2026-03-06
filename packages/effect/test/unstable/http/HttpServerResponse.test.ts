import { describe, test } from "@effect/vitest"
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import { Effect, References, Stream } from "effect"
import { HttpClientRequest, HttpServerResponse } from "effect/unstable/http"

describe("HttpServerResponse", () => {
  test("toClientResponse", async () => {
    const request = HttpClientRequest.get("http://localhost:3000/todos/1")
    const response = HttpServerResponse.jsonUnsafe({ foo: "bar" }, { status: 201 }).pipe(
      HttpServerResponse.setHeader("x-test", "ok"),
      HttpServerResponse.setCookieUnsafe("session", "123")
    )
    const clientResponse = HttpServerResponse.toClientResponse(response, { request })

    strictEqual(clientResponse.request, request)
    strictEqual(clientResponse.status, 201)
    strictEqual(clientResponse.headers["content-type"], "application/json")
    strictEqual(clientResponse.headers["x-test"], "ok")
    strictEqual(clientResponse.cookies.cookies.session?.value, "123")
    deepStrictEqual(await Effect.runPromise(clientResponse.json), { foo: "bar" })
  })

  test("toClientResponse stream", async () => {
    const clientResponse = HttpServerResponse.toClientResponse(
      HttpServerResponse.stream(
        Stream.fromEffect(References.CurrentConcurrency.asEffect()).pipe(
          Stream.map(String),
          Stream.encodeText
        )
      )
    )

    strictEqual(
      await Effect.runPromise(clientResponse.text.pipe(
        Effect.provideService(References.CurrentConcurrency, 420)
      )),
      "420"
    )
  })

  test("toClientResponse formData", async () => {
    const formData = new FormData()
    formData.set("foo", "bar")

    const clientResponse = HttpServerResponse.toClientResponse(
      HttpServerResponse.formData(formData)
    )

    strictEqual((await Effect.runPromise(clientResponse.formData)).get("foo"), "bar")
  })
})
