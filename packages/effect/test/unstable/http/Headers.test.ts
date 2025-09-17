import { describe, it } from "@effect/vitest"
import { ToOptic } from "effect/schema"
import { Headers } from "effect/unstable/http"
import { assertSuccess } from "../../utils/assert.ts"

describe("Headers", () => {
  describe("HeadersSchema", () => {
    it("defaultIsoSerializer", () => {
      const _Accept = ToOptic.makeIso(Headers.HeadersSchema).at("Accept")
      const headers = Headers.fromRecordUnsafe({
        "Accept": "application/json, text/plain, */*",
        "Cache-Control": "no-cache"
      })
      assertSuccess(
        _Accept.getResult(headers),
        "application/json, text/plain, */*"
      )
      assertSuccess(
        _Accept.replaceResult("application/json", headers),
        Headers.fromRecordUnsafe({
          "accept": "application/json",
          "cache-control": "no-cache"
        })
      )
    })
  })
})
