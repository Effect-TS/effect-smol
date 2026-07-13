import { assert, describe, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as HttpServerRespondable from "effect/unstable/http/HttpServerRespondable"
import { HttpApiError, HttpApiSchema } from "effect/unstable/httpapi"

describe("HttpApiError", () => {
  describe("UnprocessableEntity", () => {
    it("uses status 422", () => {
      assert.strictEqual(HttpApiSchema.getStatusError(HttpApiError.UnprocessableEntity.ast), 422)
      assert.strictEqual(HttpApiSchema.getStatusError(HttpApiError.UnprocessableEntityNoContent.ast), 422)
    })

    it("decodes an empty response", () => {
      assert.deepStrictEqual(
        Schema.decodeUnknownSync(HttpApiError.UnprocessableEntityNoContent)(undefined),
        new HttpApiError.UnprocessableEntity({})
      )
    })

    it.effect("renders as an empty 422 response", () =>
      Effect.gen(function*() {
        const response = yield* HttpServerRespondable.toResponse(new HttpApiError.UnprocessableEntity({}))
        assert.strictEqual(response.status, 422)
      }))
  })
})
