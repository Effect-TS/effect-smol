import { describe, it } from "@effect/vitest"
import { Schema } from "effect/schema"
import { Multipart } from "effect/unstable/http"
import { deepStrictEqual } from "node:assert"

describe("Multipart", () => {
  describe("FileSchema", () => {
    it("jsonSchema", () => {
      const document = Schema.makeJsonSchema(Multipart.FileSchema)
      deepStrictEqual(document, {
        uri: "https://json-schema.org/draft/2020-12/schema",
        schema: {
          "$ref": "#/$defs/PersistedFile"
        },
        definitions: {
          "PersistedFile": {
            "type": "string",
            "format": "binary"
          }
        }
      })
    })
  })
})
