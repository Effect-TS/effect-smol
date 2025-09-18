import { describe, it } from "@effect/vitest"
import { ToOptic } from "effect/schema"
import { UrlParams } from "effect/unstable/http"
import { assertSuccess } from "../../utils/assert.ts"

describe("UrlParams", () => {
  describe("UrlParamsSchema", () => {
    it("defaultIsoSerializer", () => {
      const iso = ToOptic.makeIso(UrlParams.UrlParamsSchema)
      const params = UrlParams.make([["a", "1"], ["b", "2"]])
      assertSuccess(iso.getResult(params), [["a", "1"], ["b", "2"]])
      assertSuccess(iso.replaceResult([["a", "1"], ["b", "3"]], params), UrlParams.make([["a", "1"], ["b", "3"]]))
    })
  })
})
