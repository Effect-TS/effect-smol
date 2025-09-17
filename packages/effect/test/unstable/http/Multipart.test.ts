import { describe, it } from "@effect/vitest"
import { ToJsonSchema } from "effect/schema"
import { Multipart } from "effect/unstable/http"
import { deepStrictEqual } from "../../utils/assert.ts"

describe("Multipart", () => {
  describe("FileSchema", () => {
    it("jsonSchema", () => {
      const jsonSchema = ToJsonSchema.makeDraft07(Multipart.FileSchema)
      deepStrictEqual(jsonSchema, {
        "$schema": "http://json-schema.org/draft-07/schema",
        "type": "string",
        "title": "PersistedFile",
        "format": "binary"
      })
    })
  })
})
