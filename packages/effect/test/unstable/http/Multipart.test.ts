import { describe, it } from "@effect/vitest"
import { Schema } from "effect/schema"
import { Multipart } from "effect/unstable/http"
import { deepStrictEqual, strictEqual } from "node:assert"

describe("Multipart", () => {
  describe("FileSchema", () => {
    it("jsonSchema", () => {
      const document = Schema.makeJsonSchema(Multipart.FileSchema)
      strictEqual(document.uri, "http://json-schema.org/draft-07/schema")
      deepStrictEqual(document.schema, {
        "$ref": "#/definitions/PersistedFile"
      })
      deepStrictEqual(document.definitions, {
        "PersistedFile": {
          "type": "string",
          "format": "binary"
        }
      })
    })
  })
})
