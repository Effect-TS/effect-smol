import type { Effect } from "effect"
import { HttpClient, type HttpClientError, type HttpClientResponse } from "effect/unstable/http"
import { describe, expect, it } from "tstyche"

describe("HttpClient", () => {
  describe("urlParams", () => {
    it("should accept interfaces", () => {
      interface Params {
        readonly q: string
      }

      const params: Params = { q: "hello" }
      const request = HttpClient.get("", { urlParams: params })

      expect(request).type.toBe<
        Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError, HttpClient.HttpClient>
      >()
    })
  })
})
