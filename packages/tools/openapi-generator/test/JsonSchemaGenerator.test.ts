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
})
