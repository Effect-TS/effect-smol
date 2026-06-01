import { assert, describe, it } from "@effect/vitest"
import { Effect, Redacted } from "effect"
import { HttpServerRequest } from "effect/unstable/http"
import { HttpApiBuilder, HttpApiSecurity } from "effect/unstable/httpapi"

const decode = (authorization: string, security: HttpApiSecurity.Http = HttpApiSecurity.bearer) =>
  HttpApiBuilder.securityDecode(security).pipe(
    Effect.provideService(
      HttpServerRequest.HttpServerRequest,
      HttpServerRequest.fromWeb(
        new Request("http://localhost", {
          headers: { authorization }
        })
      )
    ),
    Effect.provideService(HttpServerRequest.ParsedSearchParams, {})
  )

describe("HttpApiBuilder", () => {
  describe("securityDecode", () => {
    it.effect("decodes bearer credentials without the authorization scheme separator", () =>
      Effect.gen(function*() {
        const credential = yield* decode("Bearer token")

        assert.strictEqual(Redacted.value(credential), "token")
      }))

    it.effect("rejects credentials from a different authorization scheme", () =>
      Effect.gen(function*() {
        const credential = yield* decode("Basic token")

        assert.strictEqual(Redacted.value(credential), "")
      }))

    it.effect("decodes custom HTTP authorization schemes", () =>
      Effect.gen(function*() {
        const credential = yield* decode("DPoP proof", HttpApiSecurity.http({ scheme: "DPoP" }))

        assert.strictEqual(Redacted.value(credential), "proof")
      }))
  })
})
