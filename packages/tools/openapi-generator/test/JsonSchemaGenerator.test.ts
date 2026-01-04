import { describe, expect, it } from "@effect/vitest"
import * as JsonSchemaGenerator from "../src/JsonSchemaGenerator.js"

describe("JsonSchemaGenerator", () => {
  it("schema & no definitions", () => {
    const generator = JsonSchemaGenerator.make()
    generator.addSchema("A", { type: "string" })
    const definitions = {}
    const result = generator.generate("openapi-3.1", definitions, false)
    expect(result).toBe(`// schemas
export type A = string
export type AEncoded = A
export const A = Schema.String
`)
  })

  it("schema & definitions", () => {
    const generator = JsonSchemaGenerator.make()
    generator.addSchema("A", { $ref: "#/components/schemas/B" })
    const definitions = {
      B: { type: "string" }
    }
    const result = generator.generate("openapi-3.1", definitions, false)
    expect(result).toBe(`// schemas
export type A = B
export type AEncoded = BEncoded
export const A = B
// non-recursive definitions
export type B = string
export type BEncoded = B
export const B = Schema.String.annotate({ "identifier": "B" })
`)
  })

  it.todo("recursive schema", () => {
    const generator = JsonSchemaGenerator.make()
    generator.addSchema("A", { $ref: "#/components/schemas/B" })
    const definitions = {
      B: {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "children": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/B"
            }
          }
        },
        "required": [
          "name",
          "children"
        ],
        "additionalProperties": false
      }
    }
    const result = generator.generate("openapi-3.1", definitions, false)
    expect(result).toBe(`// schemas
export type A = B
export type AEncoded = BEncoded
export const A = B
// recursive definitions
export type B = { readonly "name": string, readonly "children": ReadonlyArray<B> }
export type BEncoded = { readonly "name": string, readonly "children": ReadonlyArray<BEncoded> }
export const B = Schema.Struct({ "name": Schema.String, "children": Schema.Array(Schema.suspend((): Schema.Codec<B, BEncoded> => B)) }).annotate({ "identifier": "B" })
`)
  })
})
