import { describe, it } from "@effect/vitest"
import { Schema, Serializer, ToOptic } from "effect/schema"
import { TestSchema } from "effect/testing"
import { Cookies } from "effect/unstable/http"
import { assertSuccess } from "../../utils/assert.ts"

describe("Cookies", () => {
  describe("CookiesSchema", () => {
    it("defaultIsoSerializer", () => {
      const _sessionId = ToOptic.makeIso(Cookies.CookiesSchema).at("sessionId")
      const cookies = Cookies.fromSetCookie([
        "sessionId=abc123; Path=/; HttpOnly; Secure",
        "theme=dark; Path=/; Max-Age=3600",
        "language=en; Domain=.example.com; SameSite=Lax"
      ])
      assertSuccess(
        _sessionId.getResult(cookies),
        Cookies.makeCookieUnsafe("sessionId", "abc123", { path: "/", httpOnly: true, secure: true })
      )
    })

    it("defaultJsonSerializer", async () => {
      const schema = Cookies.CookiesSchema
      const asserts = new TestSchema.Asserts(Serializer.json(Schema.typeCodec(schema)))

      const encoding = asserts.encoding()

      await encoding.succeed(
        Cookies.fromSetCookie([
          "sessionId=abc123; Path=/; HttpOnly; Secure",
          "theme=dark; Path=/; Max-Age=3600",
          "language=en; Domain=.example.com; SameSite=Lax"
        ]),
        [
          "sessionId=abc123; Path=/; HttpOnly; Secure",
          "theme=dark; Max-Age=3600; Path=/",
          "language=en; Domain=example.com; SameSite=Lax"
        ]
      )
    })
  })
})
