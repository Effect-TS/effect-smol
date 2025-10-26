import { describe, it } from "@effect/vitest"
import { Schema } from "effect/schema"
import { Multipart } from "effect/unstable/http"
import { deepStrictEqual, strictEqual } from "node:assert"

describe("Multipart", () => {
  describe("FileSchema", () => {
    it("jsonSchema", () => {
      const { definitions, jsonSchema, uri } = Schema.makeJsonSchemaDraft07(Multipart.FileSchema)
      strictEqual(uri, "http://json-schema.org/draft-07/schema")
      deepStrictEqual(jsonSchema, {
        "$ref": "#/definitions/PersistedFile"
      })
      deepStrictEqual(definitions, {
        "PersistedFile": {
          "type": "string",
          "format": "binary"
        }
      })
    })
  })
})
