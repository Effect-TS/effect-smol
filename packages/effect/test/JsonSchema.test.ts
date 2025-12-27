import { describe, it } from "@effect/vitest"
import { deepStrictEqual } from "@effect/vitest/utils"
import * as JsonSchema from "effect/JsonSchema"

describe("JsonSchema", () => {
  describe("fromSchemaDraft07", () => {
    const fromSchemaDraft07 = JsonSchema.fromSchemaDraft07

    it("removes $schema at every level", () => {
      const input = {
        $schema: "http://json-schema.org/draft-07/schema#",
        properties: {
          a: { $schema: "http://json-schema.org/draft-07/schema#", type: "string" }
        }
      }
      deepStrictEqual(fromSchemaDraft07(input), {
        properties: { a: { type: "string" } }
      })
    })

    describe("Root-Only 'definitions' logic", () => {
      it("renames root-level 'definitions' to '$defs' and recurses", () => {
        const input = {
          definitions: {
            A: { $schema: "x", type: "string" }
          }
        }
        deepStrictEqual(fromSchemaDraft07(input), {
          $defs: {
            A: { type: "string" }
          }
        })
      })

      it("merges root-level 'definitions' with existing '$defs' ($defs wins on collisions)", () => {
        const input = {
          $defs: { A: { type: "string" } },
          definitions: { B: { type: "number" } }
        }
        deepStrictEqual(fromSchemaDraft07(input), {
          $defs: { B: { type: "number" }, A: { type: "string" } }
        })
      })

      it("preserves 'definitions' when used as a property name (non-root)", () => {
        const input = {
          type: "object",
          properties: {
            definitions: {
              type: "string",
              description: "Business logic property, not a keyword"
            }
          }
        }
        deepStrictEqual(fromSchemaDraft07(input), {
          type: "object",
          properties: {
            definitions: {
              type: "string",
              description: "Business logic property, not a keyword"
            }
          }
        })
      })
    })

    describe("Pointer Rewriting ($ref)", () => {
      it("rewrites root-level references strictly", () => {
        const input = { $ref: "#/definitions/A" }
        deepStrictEqual(fromSchemaDraft07(input), { $ref: "#/$defs/A" })
      })

      it("rewrites #/definitions container refs too", () => {
        const input = { $ref: "#/definitions" }
        deepStrictEqual(fromSchemaDraft07(input), { $ref: "#/$defs" })
      })

      it("does NOT rewrite nested 'definitions' tokens in pointers (Root-Only Strategy)", () => {
        const input = { $ref: "#/definitions/User/definitions/Address" }
        deepStrictEqual(fromSchemaDraft07(input), { $ref: "#/$defs/User/definitions/Address" })
      })

      it("handles escaped characters at the start of the pointer", () => {
        const input = { $ref: "#/definitions/My~1Path" }
        deepStrictEqual(fromSchemaDraft07(input), { $ref: "#/$defs/My~1Path" })
      })

      it("ignores external refs or refs not pointing to definitions", () => {
        deepStrictEqual(fromSchemaDraft07({ $ref: "other.json#/definitions/A" }), { $ref: "other.json#/definitions/A" })
        deepStrictEqual(fromSchemaDraft07({ $ref: "#/properties/a" }), { $ref: "#/properties/a" })
      })
    })

    describe("Array Transformations (Tuples)", () => {
      it("converts items-array to prefixItems and additionalItems to items", () => {
        const input = {
          type: "array",
          items: [{ type: "number" }],
          additionalItems: { type: "boolean" }
        }
        deepStrictEqual(fromSchemaDraft07(input), {
          type: "array",
          prefixItems: [{ type: "number" }],
          items: { type: "boolean" }
        })
      })

      it("preserves items-schema as items and drops additionalItems", () => {
        const input = {
          type: "array",
          items: { type: "number" },
          additionalItems: false
        }
        deepStrictEqual(fromSchemaDraft07(input), {
          type: "array",
          items: { type: "number" }
        })
      })

      it("drops additionalItems if items is missing", () => {
        const input = { type: "array", additionalItems: { type: "number" } }
        deepStrictEqual(fromSchemaDraft07(input), { type: "array" })
      })
    })

    describe("Dependencies Transformation", () => {
      it("splits dependencies into dependentSchemas and dependentRequired", () => {
        const input = {
          dependencies: {
            a: { type: "string" }, // Schema
            b: ["c"] // Property
          }
        }
        deepStrictEqual(fromSchemaDraft07(input), {
          dependentSchemas: { a: { type: "string" } },
          dependentRequired: { b: ["c"] }
        })
      })

      it("merges dependencies with existing dependent schemas/required (explicit wins)", () => {
        const input = {
          dependentSchemas: { x: { type: "boolean" } },
          dependencies: { x: { type: "string" }, a: { type: "string" } }
        }
        deepStrictEqual(fromSchemaDraft07(input), {
          dependentSchemas: { x: { type: "boolean" }, a: { type: "string" } }
        })
      })
    })

    describe("Keyword Stripping", () => {
      it("strips unknown keywords (like vendor extensions)", () => {
        const input = {
          type: "object",
          "x-vendor": { type: "string" }
        }
        deepStrictEqual(fromSchemaDraft07(input), { type: "object" })
      })
    })
  })

  describe("fromSchemaOpenApi3_0", () => {
    const fromSchemaOpenApi3_0 = JsonSchema.fromSchemaOpenApi3_0

    describe("Base Migration (Inherited from Draft 07)", () => {
      it("strips $schema and renames definitions to $defs", () => {
        const input = {
          $schema: "http://json-schema.org/draft-07/schema#",
          definitions: { A: { type: "string" } },
          properties: { a: { $ref: "#/definitions/A" } }
        }
        deepStrictEqual(fromSchemaOpenApi3_0(input), {
          $defs: { A: { type: "string" } },
          properties: { a: { $ref: "#/$defs/A" } }
        })
      })
    })

    describe("Numeric Exclusivity (OA3 Boolean -> 2020-12 Numeric)", () => {
      it("converts exclusiveMinimum: true with minimum to numeric form", () => {
        deepStrictEqual(
          fromSchemaOpenApi3_0({ minimum: 5, exclusiveMinimum: true }),
          { exclusiveMinimum: 5 }
        )
      })

      it("converts exclusiveMaximum: true with maximum to numeric form", () => {
        deepStrictEqual(
          fromSchemaOpenApi3_0({ maximum: 10, exclusiveMaximum: true }),
          { exclusiveMaximum: 10 }
        )
      })

      it("removes boolean exclusivity if numeric bound is missing or false", () => {
        deepStrictEqual(fromSchemaOpenApi3_0({ exclusiveMinimum: true }), {})
        deepStrictEqual(fromSchemaOpenApi3_0({ minimum: 5, exclusiveMinimum: false }), { minimum: 5 })
      })

      it("leaves existing numeric exclusivity untouched", () => {
        deepStrictEqual(fromSchemaOpenApi3_0({ exclusiveMaximum: 100 }), { exclusiveMaximum: 100 })
      })
    })

    describe("Nullable handling", () => {
      it("removes nullable: false", () => {
        deepStrictEqual(
          fromSchemaOpenApi3_0({ type: "string", nullable: false }),
          { type: "string" }
        )
      })

      describe("nullable: true transformations", () => {
        it("widens type: string -> [string, null]", () => {
          deepStrictEqual(
            fromSchemaOpenApi3_0({ type: "string", nullable: true }),
            { type: ["string", "null"] }
          )
        })

        it("appends to existing type arrays and prevents duplicates", () => {
          deepStrictEqual(
            fromSchemaOpenApi3_0({ type: ["string", "number"], nullable: true }),
            { type: ["string", "number", "null"] }
          )
          deepStrictEqual(
            fromSchemaOpenApi3_0({ type: ["string", "null"], nullable: true }),
            { type: ["string", "null"] }
          )
        })

        it("adds null to enum AND widens type simultaneously", () => {
          deepStrictEqual(
            fromSchemaOpenApi3_0({ type: "string", enum: ["a", "b"], nullable: true }),
            { type: ["string", "null"], enum: ["a", "b", null] }
          )
        })

        it("handles fallback with anyOf (keeps root metadata for stable pointers)", () => {
          const input = {
            nullable: true,
            $ref: "#/definitions/A",
            definitions: { A: { type: "string" } },
            title: "Schema Title",
            description: "A description",
            default: "val",
            examples: ["val"]
          }
          deepStrictEqual(fromSchemaOpenApi3_0(input), {
            $defs: { A: { type: "string" } },
            title: "Schema Title",
            description: "A description",
            default: "val",
            examples: ["val"],
            anyOf: [
              { $ref: "#/$defs/A" },
              { type: "null" }
            ]
          })
        })
      })
    })

    describe("Traversal and Scope", () => {
      it("recurses into nested structures (properties, items, combinators)", () => {
        const input = {
          properties: {
            a: { type: "integer", minimum: 0, exclusiveMinimum: true }
          },
          items: [
            { type: "string", nullable: true }
          ],
          allOf: [
            { type: "number", nullable: true }
          ]
        }
        deepStrictEqual(fromSchemaOpenApi3_0(input), {
          properties: {
            a: { type: "integer", exclusiveMinimum: 0 }
          },
          prefixItems: [
            { type: ["string", "null"] }
          ],
          allOf: [
            { type: ["number", "null"] }
          ]
        })
      })

      it("strips x- vendor extensions (unknown keywords) after migration", () => {
        const input = {
          type: "object",
          "x-custom-meta": {
            type: "string",
            nullable: true,
            definitions: { B: { type: "boolean" } }
          }
        }
        deepStrictEqual(fromSchemaOpenApi3_0(input), { type: "object" })
      })

      it("does not mutate the input object", () => {
        const input: any = {
          type: "object",
          properties: { a: { type: "string", nullable: true } },
          "x-custom": { anything: { nullable: true } }
        }
        const snapshot = structuredClone(input)
        fromSchemaOpenApi3_0(input)
        deepStrictEqual(input, snapshot)
      })
    })
  })
})
