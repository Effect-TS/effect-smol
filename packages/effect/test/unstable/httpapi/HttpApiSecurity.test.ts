import { describe, it } from "@effect/vitest"
import { strictEqual } from "@effect/vitest/utils"
import { Effect, Redacted } from "effect"
import { HttpClientRequest, HttpServerRequest } from "effect/unstable/http"
import { HttpApiBuilder, HttpApiSecurity } from "effect/unstable/httpapi"

describe("HttpApiSecurity", () => {
  describe("securityDecode", () => {
    it.effect("decodes a bearer token without a leading space", () =>
      Effect.gen(function*() {
        const token = "abc123"
        const { headers } = HttpClientRequest.get("http://localhost/").pipe(
          HttpClientRequest.bearerToken(token)
        )
        const credential = yield* HttpApiBuilder.securityDecode(HttpApiSecurity.bearer).pipe(
          Effect.provideService(
            HttpServerRequest.HttpServerRequest,
            HttpServerRequest.fromWeb(new Request("http://localhost/", { headers }))
          ),
          Effect.provideService(HttpServerRequest.ParsedSearchParams, {})
        )

        strictEqual(Redacted.value(credential), token)
      }))

    it.effect("decodes a custom http scheme without a leading space", () =>
      Effect.gen(function*() {
        const credential = yield* HttpApiBuilder.securityDecode(HttpApiSecurity.http({ scheme: "Token" })).pipe(
          Effect.provideService(
            HttpServerRequest.HttpServerRequest,
            HttpServerRequest.fromWeb(new Request("http://localhost/", { headers: { authorization: "Token abc123" } }))
          ),
          Effect.provideService(HttpServerRequest.ParsedSearchParams, {})
        )
        strictEqual(Redacted.value(credential), "abc123")
      }))
  })
})
