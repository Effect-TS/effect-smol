import { Schema, SchemaStandard } from "effect"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../utils/assert.ts"

describe("toJsonSchemaMultiDocument", () => {
  it("should handle multiple schemas", () => {
    const A = Schema.String.annotate({ identifier: "id", description: "a" })
    const B = Schema.String.annotate({ identifier: "id", description: "b" })
    const C = Schema.Tuple([A, B])
    const multiDocument = SchemaStandard.fromASTs([A.ast, B.ast, C.ast])
    const jsonMultiDocument = SchemaStandard.toJsonSchemaMultiDocument(multiDocument)
    deepStrictEqual(jsonMultiDocument, {
      dialect: "draft-2020-12",
      schemas: [
        { "$ref": "#/$defs/id" },
        { "$ref": "#/$defs/id2" },
        {
          "type": "array",
          "prefixItems": [
            { "$ref": "#/$defs/id" },
            { "$ref": "#/$defs/id2" }
          ],
          "minItems": 2,
          "maxItems": 2
        }
      ],
      definitions: {
        id: {
          "type": "string",
          "description": "a"
        },
        id2: {
          "type": "string",
          "description": "b"
        }
      }
    })
  })
})
