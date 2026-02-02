import { describe, it } from "@effect/vitest"
import { strictEqual } from "@effect/vitest/utils"
import { HttpClientRequest } from "effect/unstable/http"

describe("HttpClientRequest", () => {
  describe("appendUrl", () => {
    it("joins segments without slashes", () => {
      const request = HttpClientRequest.get("base").pipe(
        HttpClientRequest.appendUrl("users")
      )

      strictEqual(request.url, "base/users")
    })

    it("avoids double slashes", () => {
      const request = HttpClientRequest.get("base/").pipe(
        HttpClientRequest.appendUrl("/users")
      )

      strictEqual(request.url, "base/users")
    })

    it("preserves existing slash", () => {
      const request = HttpClientRequest.get("base/").pipe(
        HttpClientRequest.appendUrl("users")
      )

      strictEqual(request.url, "base/users")
    })

    it("preserves leading slash", () => {
      const request = HttpClientRequest.get("base").pipe(
        HttpClientRequest.appendUrl("/users")
      )

      strictEqual(request.url, "base/users")
    })

    it("no-ops on empty path", () => {
      const request = HttpClientRequest.get("base").pipe(
        HttpClientRequest.appendUrl("")
      )

      strictEqual(request.url, "base")
    })
  })
})
