import { describe, it } from "@effect/vitest"
import { Schema } from "effect/schema"
import { Multipart } from "effect/unstable/http"
import { deepStrictEqual } from "node:assert"

describe("Multipart", () => {
  describe("FileSchema", () => {
    it("jsonSchema", () => {
      const document = Schema.makeJsonSchema(Multipart.FileSchema, { target: "draft-07" })
      deepStrictEqual(document, {
        source: "draft-07",
        schema: {
          "$ref": "#/definitions/PersistedFile"
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
