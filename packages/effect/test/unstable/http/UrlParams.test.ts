import { describe, it } from "@effect/vitest"
import { Schema } from "effect"
import { UrlParams } from "effect/unstable/http"
import { assertSuccess } from "../../utils/assert.ts"

describe("UrlParams", () => {
  describe("UrlParamsSchema", () => {
    it("serializer annotation", () => {
      const iso = Schema.toIso(UrlParams.UrlParamsSchema)
      const params = UrlParams.make([["a", "1"], ["b", "2"]])
      assertSuccess(iso.getResult(params), [["a", "1"], ["b", "2"]])
      assertSuccess(iso.replaceResult([["a", "1"], ["b", "3"]], params), UrlParams.make([["a", "1"], ["b", "3"]]))
    })
  })
})
