import { describe, it } from "@effect/vitest"
import { deepStrictEqual } from "@effect/vitest/utils"
import * as JsonSchema from "effect/JsonSchema"

describe("JsonSchema", () => {
  describe("fromDraft07", () => {
    const fromDraft07 = JsonSchema.fromDraft07

    it("preserves boolean schemas", () => {
      deepStrictEqual(fromDraft07(true), true)
      deepStrictEqual(fromDraft07(false), false)
    })

    it("removes $schema at every level", () => {
      const input = {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: {
          a: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "string"
          }
        },
        allOf: [
          { $schema: "http://json-schema.org/draft-07/schema#", type: "number" }
        ]
      }

      deepStrictEqual(fromDraft07(input), {
        type: "object",
        properties: {
          a: {
            type: "string"
          }
        },
        allOf: [
          { type: "number" }
        ]
      })
    })

    it(`renames "definitions" to "$defs" (recursing into its values)`, () => {
      {
        const input = {
          $ref: "#/definitions/A",
          definitions: {
            A: {
              $schema: "http://json-schema.org/draft-07/schema#",
              type: "string"
            }
          }
        }

        deepStrictEqual(fromDraft07(input), {
          $ref: "#/$defs/A",
          $defs: {
            A: { type: "string" }
          }
        })
      }

      {
        const input = {
          "type": "object",
          "properties": {
            "city": { "$ref": "#/properties/address/definitions/City" },
            "address": {
              "type": "object",
              "properties": {
                "city": { "$ref": "#/properties/address/definitions/City" },
                "zip": { "type": "integer" }
              },
              "definitions": {
                "City": { "type": "string" }
              }
            }
          }
        }

        deepStrictEqual(fromDraft07(input), {
          "type": "object",
          "properties": {
            "city": { "$ref": "#/properties/address/$defs/City" },
            "address": {
              "type": "object",
              "properties": {
                "city": { "$ref": "#/properties/address/$defs/City" },
                "zip": { "type": "integer" }
              },
              "$defs": {
                "City": { "type": "string" }
              }
            }
          }
        })
      }
    })

    it("preserves nested local references", () => {
      const input = {
        "type": "object",
        "properties": {
          "city": { "$ref": "#/properties/address/properties/city" },
          "address": {
            "type": "object",
            "properties": {
              "city": { "type": "string" },
              "zip": { "type": "integer" }
            }
          }
        }
      }

      deepStrictEqual(fromDraft07(input), {
        "type": "object",
        "properties": {
          "city": { "$ref": "#/properties/address/properties/city" },
          "address": {
            "type": "object",
            "properties": {
              "city": { "type": "string" },
              "zip": { "type": "integer" }
            }
          }
        }
      })
    })

    it("items[] -> prefixItems and additionalItems -> items (when present)", () => {
      const input = {
        type: "array",
        items: [{ type: "number" }, { type: "string" }],
        additionalItems: { type: "boolean" }
      }

      deepStrictEqual(fromDraft07(input), {
        type: "array",
        prefixItems: [{ type: "number" }, { type: "string" }],
        items: { type: "boolean" }
      })
    })

    it("items[] without additionalItems -> prefixItems only", () => {
      const input = {
        type: "array",
        items: [{ type: "number" }, { type: "string" }]
      }

      deepStrictEqual(fromDraft07(input), {
        type: "array",
        prefixItems: [{ type: "number" }, { type: "string" }]
      })
    })

    it("items(schema) stays items and additionalItems is dropped", () => {
      const input = {
        type: "array",
        items: { type: "number" },
        additionalItems: false
      }

      deepStrictEqual(fromDraft07(input), {
        type: "array",
        items: { type: "number" }
      })
    })

    it("drops additionalItems when items is missing (no tuple context)", () => {
      const input = {
        type: "array",
        additionalItems: { type: "number" }
      }

      deepStrictEqual(fromDraft07(input), {
        type: "array"
      })
    })

    it("does not recurse into unknown keywords (leaves their contents unchanged)", () => {
      const input = {
        custom: {
          $schema: "should-stay"
        }
      }

      deepStrictEqual(fromDraft07(input), {
        custom: {
          $schema: "should-stay"
        }
      })
    })

    it("preserves existing $defs and converts schemas inside it", () => {
      const input = {
        $defs: {
          A: { $schema: "x", type: "string" },
          B: { items: [{ type: "number" }] }
        }
      }

      deepStrictEqual(fromDraft07(input), {
        $defs: {
          A: { type: "string" },
          B: { prefixItems: [{ type: "number" }] }
        }
      })
    })

    it("preserves unrelated keywords and values", () => {
      const input = {
        nullable: true
      }

      deepStrictEqual(fromDraft07(input), {
        nullable: true
      })
    })
  })

  describe("fromOpenApi3_0", () => {
    const fromOpenApi3_0 = JsonSchema.fromOpenApi3_0

    it("preserves boolean schemas", () => {
      deepStrictEqual(fromOpenApi3_0(true), true)
      deepStrictEqual(fromOpenApi3_0(false), false)
    })

    describe("nullable", () => {
      it("removes nullable: false", () => {
        deepStrictEqual(
          fromOpenApi3_0({ type: "string", nullable: false }),
          { type: "string" }
        )
        deepStrictEqual(
          fromOpenApi3_0({ type: "string", nullable: false, "description": "a" }),
          { type: "string", "description": "a" }
        )
      })

      it("nullable: true widens type: string -> [string, null]", () => {
        deepStrictEqual(
          fromOpenApi3_0({ type: "string", nullable: true }),
          { type: ["string", "null"] }
        )
        deepStrictEqual(
          fromOpenApi3_0({ type: "string", nullable: true, "description": "a" }),
          { type: ["string", "null"], "description": "a" }
        )
      })

      it("nullable: true widens type array by adding 'null' (no duplicates)", () => {
        deepStrictEqual(
          fromOpenApi3_0({ type: ["string"], nullable: true }),
          { type: ["string", "null"] }
        )

        deepStrictEqual(
          fromOpenApi3_0({ type: ["string", "null"], nullable: true }),
          { type: ["string", "null"] }
        )
      })

      it("nullable: true adds null to enum (no duplicates)", () => {
        deepStrictEqual(
          fromOpenApi3_0({ enum: ["a", "b"], nullable: true }),
          { enum: ["a", "b", null] }
        )

        deepStrictEqual(
          fromOpenApi3_0({ enum: ["a", null], nullable: true }),
          { enum: ["a", null] }
        )
      })

      it("nullable: true wraps schema in anyOf when there is no type/enum", () => {
        deepStrictEqual(
          fromOpenApi3_0({ minimum: 1, nullable: true }),
          {
            anyOf: [
              { minimum: 1 },
              { type: "null" }
            ]
          }
        )
      })

      it("nullable conversion works for nested schemas", () => {
        deepStrictEqual(
          fromOpenApi3_0({
            type: "object",
            properties: {
              a: { type: "number", nullable: true }
            },
            items: { type: "string", nullable: true } // not valid for objects, but should still be walked
          }),
          {
            type: "object",
            properties: {
              a: { type: ["number", "null"] }
            },
            items: { type: ["string", "null"] }
          }
        )
      })

      it("nullable conversion works inside arrays", () => {
        deepStrictEqual(
          fromOpenApi3_0({
            allOf: [
              { type: "string", nullable: true },
              { enum: ["x"], nullable: true }
            ]
          }),
          {
            allOf: [
              { type: ["string", "null"] },
              { enum: ["x", null] }
            ]
          }
        )
      })
    })

    describe("exclusiveMinimum / exclusiveMaximum (OpenAPI boolean form)", () => {
      it("exclusiveMinimum: true + minimum: n -> exclusiveMinimum: n and deletes minimum", () => {
        deepStrictEqual(
          fromOpenApi3_0({ minimum: 5, exclusiveMinimum: true }),
          { exclusiveMinimum: 5 }
        )
      })

      it("exclusiveMaximum: true + maximum: n -> exclusiveMaximum: n and deletes maximum", () => {
        deepStrictEqual(
          fromOpenApi3_0({ maximum: 5, exclusiveMaximum: true }),
          { exclusiveMaximum: 5 }
        )
      })

      it("exclusiveMinimum: false -> drops exclusiveMinimum (keeps minimum)", () => {
        deepStrictEqual(
          fromOpenApi3_0({ minimum: 5, exclusiveMinimum: false }),
          { minimum: 5 }
        )
      })

      it("exclusiveMaximum: false -> drops exclusiveMaximum (keeps maximum)", () => {
        deepStrictEqual(
          fromOpenApi3_0({ maximum: 5, exclusiveMaximum: false }),
          { maximum: 5 }
        )
      })

      it("exclusiveMinimum: true without minimum -> drops exclusiveMinimum", () => {
        deepStrictEqual(
          fromOpenApi3_0({ exclusiveMinimum: true }),
          {}
        )
      })

      it("exclusiveMaximum: true without maximum -> drops exclusiveMaximum", () => {
        deepStrictEqual(
          fromOpenApi3_0({ exclusiveMaximum: true }),
          {}
        )
      })

      it("does not touch numeric exclusiveMinimum/exclusiveMaximum", () => {
        deepStrictEqual(
          fromOpenApi3_0({ exclusiveMinimum: 2, minimum: 1 }),
          { exclusiveMinimum: 2, minimum: 1 }
        )
        deepStrictEqual(
          fromOpenApi3_0({ exclusiveMaximum: 9, maximum: 10 }),
          { exclusiveMaximum: 9, maximum: 10 }
        )
      })

      it("exclusive conversions work for nested schemas", () => {
        deepStrictEqual(
          fromOpenApi3_0({
            type: "object",
            properties: {
              a: { minimum: 1, exclusiveMinimum: true },
              b: { maximum: 10, exclusiveMaximum: false }
            }
          }),
          {
            type: "object",
            properties: {
              a: { exclusiveMinimum: 1 },
              b: { maximum: 10 }
            }
          }
        )
      })
    })

    it("can apply both nullable and exclusive conversions in the same schema", () => {
      deepStrictEqual(
        fromOpenApi3_0({
          type: "number",
          nullable: true,
          minimum: 1,
          exclusiveMinimum: true
        }),
        {
          type: ["number", "null"],
          exclusiveMinimum: 1
        }
      )
    })

    it.todo("nullable & $ref conversion works together", () => {
      deepStrictEqual(
        fromOpenApi3_0({
          nullable: true,
          $ref: "#/definitions/Foo",
          definitions: { Foo: { type: "string" } }
        }),
        {
          $defs: { Foo: { type: "string" } },
          anyOf: [
            {
              $ref: "#/$defs/Foo"
            },
            { type: "null" }
          ]
        }
      )
    })
  })
})
