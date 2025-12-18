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
})
