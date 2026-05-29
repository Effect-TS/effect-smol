import { describe, it } from "@effect/vitest"
import { strictEqual } from "@effect/vitest/utils"
import { Effect, Redacted } from "effect"
import { HttpClientRequest, HttpServerRequest } from "effect/unstable/http"
import { HttpApiBuilder, HttpApiSecurity } from "effect/unstable/httpapi"

const decode = (security: HttpApiSecurity.HttpApiSecurity, authorization: string) =>
  HttpApiBuilder.securityDecode(security).pipe(
    Effect.provideService(
      HttpServerRequest.HttpServerRequest,
      HttpServerRequest.fromWeb(new Request("http://localhost/", { headers: { authorization } }))
    ),
    Effect.provideService(HttpServerRequest.ParsedSearchParams, {})
  )

describe("HttpApiSecurity", () => {
  describe("securityDecode", () => {
    it.effect("decodes a bearer token without a leading space", () =>
      Effect.gen(function*() {
        const token = "abc123"
        // build the header exactly as a client does
        const { headers } = HttpClientRequest.get("http://localhost/").pipe(
          HttpClientRequest.bearerToken(token)
        )
        const credential = yield* decode(HttpApiSecurity.bearer, headers.authorization!)
        strictEqual(Redacted.value(credential), token)
      }))

    it.effect("decodes a custom http scheme without a leading space", () =>
      Effect.gen(function*() {
        const credential = yield* decode(HttpApiSecurity.http({ scheme: "Token" }), "Token abc123")
        strictEqual(Redacted.value(credential), "abc123")
      }))
  })
})
