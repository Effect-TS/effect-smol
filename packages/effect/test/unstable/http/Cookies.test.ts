import { describe, it } from "@effect/vitest"
import { ToOptic } from "effect/schema"
import { Cookies } from "effect/unstable/http"
import { assertSuccess } from "../../utils/assert.ts"
import { assertions } from "../../utils/schema.ts"

describe("Cookies", () => {
  describe("CookiesSchema", () => {
    it("defaultIsoSerializer", () => {
      const sessionId = ToOptic.makeIso(Cookies.CookiesSchema).at("sessionId")
      const cookies = Cookies.fromSetCookie([
        "sessionId=abc123; Path=/; HttpOnly; Secure",
        "theme=dark; Path=/; Max-Age=3600",
        "language=en; Domain=.example.com; SameSite=Lax"
      ])
      assertSuccess(
        sessionId.getResult(cookies),
        Cookies.makeCookieUnsafe("sessionId", "abc123", { path: "/", httpOnly: true, secure: true })
      )
    })

    it("defaultJsonSerializer", async () => {
      const schema = Cookies.CookiesSchema
      await assertions.serialization.json.typeCodec.succeed(
        schema,
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
