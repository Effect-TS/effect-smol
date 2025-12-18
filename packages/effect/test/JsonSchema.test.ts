import { describe, it } from "@effect/vitest"
import { deepStrictEqual } from "@effect/vitest/utils"
import * as JsonSchema from "effect/JsonSchema"

describe("JsonSchema", () => {
  describe("fromDraft07", () => {
    const fromDraft07 = JsonSchema.fromDraft07

    it("preserves boolean schemas", () => {
      deepStrictEqual(fromDraft07(true as any), true)
      deepStrictEqual(fromDraft07(false as any), false)
    })

    it("strips $schema at the root", () => {
      const input = {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "string"
      }

      deepStrictEqual(fromDraft07(input), {
        type: "string"
      })
    })

    it("strips $schema at every level (including nested subschemas)", () => {
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

    it("renames \"definitions\" to \"$defs\" (recursing into its values)", () => {
      const input = {
        definitions: {
          Foo: {
            type: "object",
            properties: {
              x: { $schema: "http://json-schema.org/draft-07/schema#", type: "string" }
            }
          },
          Bar: true
        }
      }

      deepStrictEqual(fromDraft07(input), {
        $defs: {
          Foo: {
            type: "object",
            properties: {
              x: { type: "string" }
            }
          },
          Bar: true
        }
      })
    })

    it("does not create $defs when definitions is not an object", () => {
      deepStrictEqual(fromDraft07({ definitions: 123 } as any), {})
      deepStrictEqual(fromDraft07({ definitions: null } as any), {})
      deepStrictEqual(fromDraft07({ definitions: ["x"] } as any), {})
    })

    it("rewrites local $ref fragments from \"#/definitions/...\" to \"#/$defs/...\"", () => {
      const input = {
        $ref: "#/definitions/Foo",
        definitions: {
          Foo: { type: "string" }
        }
      }

      deepStrictEqual(fromDraft07(input), {
        $ref: "#/$defs/Foo",
        $defs: {
          Foo: { type: "string" }
        }
      })
    })

    it("does not rewrite $ref when it is not a string", () => {
      deepStrictEqual(fromDraft07({ $ref: 123 } as any), { $ref: 123 })
      deepStrictEqual(fromDraft07({ $ref: null } as any), { $ref: null })
    })

    it("converts tuple validation: items[] -> prefixItems and additionalItems -> items (when present)", () => {
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

    it("converts tuple validation: items[] without additionalItems -> prefixItems only", () => {
      const input = {
        type: "array",
        items: [{ type: "number" }, { type: "string" }]
      }

      deepStrictEqual(fromDraft07(input), {
        type: "array",
        prefixItems: [{ type: "number" }, { type: "string" }]
      })
    })

    it("keeps list validation: items(schema) stays items and additionalItems is dropped", () => {
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

    it("recurses into known schema locations (properties, additionalProperties, anyOf, etc.)", () => {
      const input = {
        type: "object",
        properties: {
          a: { definitions: { X: { type: "string", $schema: "x" } } }
        },
        additionalProperties: {
          items: [{ $ref: "#/definitions/T" }],
          additionalItems: { $ref: "#/definitions/U" }
        },
        anyOf: [
          { definitions: { Y: { type: "number" } } }
        ]
      }

      deepStrictEqual(fromDraft07(input), {
        type: "object",
        properties: {
          a: { $defs: { X: { type: "string" } } }
        },
        additionalProperties: {
          prefixItems: [{ $ref: "#/$defs/T" }],
          items: { $ref: "#/$defs/U" }
        },
        anyOf: [
          { $defs: { Y: { type: "number" } } }
        ]
      })
    })

    it("does not recurse into unknown keywords (leaves their contents unchanged)", () => {
      const input = {
        custom: {
          $schema: "should-stay",
          definitions: { Foo: { type: "string" } },
          items: [{ type: "number" }],
          additionalItems: false,
          $ref: "#/definitions/Foo"
        }
      }

      deepStrictEqual(fromDraft07(input), {
        custom: {
          $schema: "should-stay",
          definitions: { Foo: { type: "string" } },
          items: [{ type: "number" }],
          additionalItems: false,
          $ref: "#/definitions/Foo"
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
        title: "Example",
        default: 123,
        examples: [1, 2, 3],
        nullable: true
      }

      deepStrictEqual(fromDraft07(input), {
        title: "Example",
        default: 123,
        examples: [1, 2, 3],
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
