import { Schema } from "effect"
import { HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi"
import { describe, expect, it } from "tstyche"

describe("HttpApiMiddleware", () => {
  describe("Service", () => {
    it("error", () => {
      class M extends HttpApiMiddleware.Service<M>()("Http/Logger", {
        error: Schema.String
      }) {}
      expect(M.error).type.toBe<Schema.String>()
      expect(M.security).type.toBe<never>()
    })

    it("security", () => {
      class M extends HttpApiMiddleware.Service<M>()("M", {
        security: {
          cookie: HttpApiSecurity.apiKey({
            in: "cookie",
            key: "token"
          })
        }
      }) {}
      expect(M.error).type.toBe<never>()
      expect(M.security).type.toBe<{ readonly cookie: HttpApiSecurity.ApiKey }>()
    })

    it("error + security", () => {
      class M extends HttpApiMiddleware.Service<M>()("Http/Logger", {
        error: Schema.String,
        security: {
          cookie: HttpApiSecurity.apiKey({
            in: "cookie",
            key: "token"
          })
        }
      }) {}
      expect(M.error).type.toBe<Schema.String>()
      expect(M.security).type.toBe<{ readonly cookie: HttpApiSecurity.ApiKey }>()
    })
  })
})
