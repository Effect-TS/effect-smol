import { describe, it } from "@effect/vitest"
import { deepStrictEqual } from "@effect/vitest/utils"
import * as JsonSchema from "effect/JsonSchema"

describe("JsonSchema", () => {
  describe("fromSchemaDraft07", () => {
    it("should convert a simple schema without definitions", () => {
      const input: JsonSchema.JsonSchema = {
        type: "string"
      }
      const result = JsonSchema.fromSchemaDraft07(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "string"
        },
        definitions: {}
      })
    })

    it("should extract root definitions and rewrite references", () => {
      const input: JsonSchema.JsonSchema = {
        type: "object",
        properties: {
          a: { $ref: "#/definitions/A" },
          b: { $ref: "#/definitions/B" }
        },
        definitions: {
          A: {
            type: "string",
            $ref: "#/definitions/B"
          },
          B: {
            type: "number"
          }
        }
      }
      const result = JsonSchema.fromSchemaDraft07(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "object",
          properties: {
            a: { $ref: "#/$defs/A" },
            b: { $ref: "#/$defs/B" }
          }
        },
        definitions: {
          A: {
            type: "string",
            $ref: "#/$defs/B"
          },
          B: {
            type: "number"
          }
        }
      })
    })

    it("should convert items array to prefixItems", () => {
      const input: JsonSchema.JsonSchema = {
        type: "array",
        items: [
          { type: "string" },
          { type: "number" }
        ],
        additionalItems: { type: "boolean" }
      }
      const result = JsonSchema.fromSchemaDraft07(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "array",
          prefixItems: [
            { type: "string" },
            { type: "number" }
          ],
          items: { type: "boolean" }
        },
        definitions: {}
      })
    })

    it("should convert single items to items", () => {
      const input: JsonSchema.JsonSchema = {
        type: "array",
        items: { type: "string" }
      }
      const result = JsonSchema.fromSchemaDraft07(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "array",
          items: { type: "string" }
        },
        definitions: {}
      })
    })

    it("should preserve annotations", () => {
      const input: JsonSchema.JsonSchema = {
        type: "string",
        title: "My String",
        description: "A string value",
        default: "default",
        examples: ["example1", "example2"],
        format: "email",
        readOnly: true,
        writeOnly: true
      }
      const result = JsonSchema.fromSchemaDraft07(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "string",
          title: "My String",
          description: "A string value",
          default: "default",
          examples: ["example1", "example2"],
          format: "email",
          readOnly: true,
          writeOnly: true
        },
        definitions: {}
      })
    })

    it("should handle string constraints", () => {
      const input: JsonSchema.JsonSchema = {
        type: "string",
        pattern: "^[a-z]+$",
        minLength: 1,
        maxLength: 100
      }
      const result = JsonSchema.fromSchemaDraft07(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "string",
          pattern: "^[a-z]+$",
          minLength: 1,
          maxLength: 100
        },
        definitions: {}
      })
    })

    it("should handle number constraints", () => {
      const input: JsonSchema.JsonSchema = {
        type: "number",
        minimum: 0,
        maximum: 100,
        exclusiveMinimum: 0,
        exclusiveMaximum: 100,
        multipleOf: 2
      }
      const result = JsonSchema.fromSchemaDraft07(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "number",
          minimum: 0,
          maximum: 100,
          exclusiveMinimum: 0,
          exclusiveMaximum: 100,
          multipleOf: 2
        },
        definitions: {}
      })
    })

    it("should handle array constraints", () => {
      const input: JsonSchema.JsonSchema = {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 10,
        uniqueItems: true
      }
      const result = JsonSchema.fromSchemaDraft07(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 10,
          uniqueItems: true
        },
        definitions: {}
      })
    })

    it("should handle object constraints", () => {
      const input: JsonSchema.JsonSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" }
        },
        required: ["name"],
        patternProperties: {
          "^S_": { type: "string" }
        },
        additionalProperties: { type: "boolean" },
        propertyNames: { pattern: "^[A-Z]" },
        minProperties: 1,
        maxProperties: 10
      }
      const result = JsonSchema.fromSchemaDraft07(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            age: { type: "number" }
          },
          required: ["name"],
          patternProperties: {
            "^S_": { type: "string" }
          },
          additionalProperties: { type: "boolean" },
          propertyNames: { pattern: "^[A-Z]" },
          minProperties: 1,
          maxProperties: 10
        },
        definitions: {}
      })
    })

    it("should handle enum, const, allOf, anyOf, oneOf", () => {
      const input: JsonSchema.JsonSchema = {
        enum: ["a", "b", "c"],
        const: "constant",
        allOf: [
          { type: "array", items: { type: "string" } },
          { minItems: 1 }
        ],
        anyOf: [
          { type: "array", items: [{ type: "string" }] },
          { type: "number" }
        ],
        oneOf: [
          { type: "array", items: [{ type: "string" }], additionalItems: { type: "number" } },
          { type: "boolean" }
        ]
      }
      const result = JsonSchema.fromSchemaDraft07(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          enum: ["a", "b", "c"],
          const: "constant",
          allOf: [
            { type: "array", items: { type: "string" } },
            { minItems: 1 }
          ],
          anyOf: [
            { type: "array", prefixItems: [{ type: "string" }] },
            { type: "number" }
          ],
          oneOf: [
            { type: "array", prefixItems: [{ type: "string" }], items: { type: "number" } },
            { type: "boolean" }
          ]
        },
        definitions: {}
      })
    })

    it("should not rewrite nested definitions", () => {
      const input: JsonSchema.JsonSchema = {
        type: "object",
        properties: {
          nested: {
            definitions: {
              NestedType: {
                type: "number"
              }
            },
            $ref: "#/properties/nested/definitions/NestedType"
          }
        }
      }
      const result = JsonSchema.fromSchemaDraft07(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "object",
          properties: {
            nested: {
              definitions: {
                NestedType: {
                  type: "number"
                }
              },
              $ref: "#/properties/nested/definitions/NestedType"
            }
          }
        },
        definitions: {}
      })
    })

    it("should remove non-standard properties", () => {
      const input: JsonSchema.JsonSchema = {
        type: "string",
        "x-custom": "value"
      }
      const result = JsonSchema.fromSchemaDraft07(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "string"
        },
        definitions: {}
      })
    })
  })

  describe("fromSchemaDraft2020_12", () => {
    it("should convert a simple schema without definitions", () => {
      const input: JsonSchema.JsonSchema = {
        type: "string"
      }
      const result = JsonSchema.fromSchemaDraft2020_12(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "string"
        },
        definitions: {}
      })
    })

    it("should extract root definitions", () => {
      const input: JsonSchema.JsonSchema = {
        type: "object",
        properties: {
          a: { $ref: "#/$defs/A" },
          b: { $ref: "#/$defs/B" }
        },
        $defs: {
          A: {
            type: "string",
            $ref: "#/$defs/B"
          },
          B: {
            type: "number"
          }
        }
      }
      const result = JsonSchema.fromSchemaDraft2020_12(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "object",
          properties: {
            a: { $ref: "#/$defs/A" },
            b: { $ref: "#/$defs/B" }
          }
        },
        definitions: {
          A: {
            type: "string",
            $ref: "#/$defs/B"
          },
          B: {
            type: "number"
          }
        }
      })
    })

    it("should not rewrite nested definitions", () => {
      const input: JsonSchema.JsonSchema = {
        type: "object",
        properties: {
          nested: {
            definitions: {
              NestedType: {
                type: "number"
              }
            },
            $ref: "#/properties/nested/definitions/NestedType"
          }
        }
      }
      const result = JsonSchema.fromSchemaDraft2020_12(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "object",
          properties: {
            nested: {
              definitions: {
                NestedType: {
                  type: "number"
                }
              },
              $ref: "#/properties/nested/definitions/NestedType"
            }
          }
        },
        definitions: {}
      })
    })

    it("should keep non-standard properties", () => {
      const input: JsonSchema.JsonSchema = {
        type: "string",
        "x-custom": "value"
      }
      const result = JsonSchema.fromSchemaDraft2020_12(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "string",
          "x-custom": "value"
        },
        definitions: {}
      })
    })
  })

  describe("fromSchemaOpenApi3_1", () => {
    it("should rewrite all component schema references", () => {
      const input: JsonSchema.JsonSchema = {
        type: "object",
        properties: {
          a: { $ref: "#/components/schemas/A" },
          b: { $ref: "#/components/schemas/B" }
        }
      }
      const result = JsonSchema.fromSchemaOpenApi3_1(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "object",
          properties: {
            a: { $ref: "#/$defs/A" },
            b: { $ref: "#/$defs/B" }
          }
        },
        definitions: {}
      })
    })

    it("should extract $defs", () => {
      const input: JsonSchema.JsonSchema = {
        type: "object",
        properties: {
          a: {
            $ref: "#/components/schemas/A"
          }
        },
        $defs: {
          MyType: {
            type: "string"
          }
        }
      }
      const result = JsonSchema.fromSchemaOpenApi3_1(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "object",
          properties: {
            a: {
              $ref: "#/$defs/A"
            }
          }
        },
        definitions: {
          MyType: {
            type: "string"
          }
        }
      })
    })

    it("should not rewrite nested definitions", () => {
      const input: JsonSchema.JsonSchema = {
        type: "object",
        properties: {
          nested: {
            definitions: {
              NestedType: {
                type: "number"
              }
            },
            $ref: "#/properties/nested/definitions/NestedType"
          }
        }
      }
      const result = JsonSchema.fromSchemaOpenApi3_1(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "object",
          properties: {
            nested: {
              definitions: {
                NestedType: {
                  type: "number"
                }
              },
              $ref: "#/properties/nested/definitions/NestedType"
            }
          }
        },
        definitions: {}
      })
    })

    it("should keep non-standard properties", () => {
      const input: JsonSchema.JsonSchema = {
        type: "string",
        "x-custom": "value"
      }
      const result = JsonSchema.fromSchemaOpenApi3_1(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "string",
          "x-custom": "value"
        },
        definitions: {}
      })
    })
  })

  describe("fromSchemaOpenApi3_0", () => {
    function assertFromSchemaOpenApi3_0(input: JsonSchema.JsonSchema, expected: {
      readonly schema: JsonSchema.JsonSchema
      readonly definitions?: JsonSchema.Definitions
    }) {
      const result = JsonSchema.fromSchemaOpenApi3_0(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: expected.schema,
        definitions: expected.definitions ?? {}
      })
    }

    it("should rewrite all component schema references", () => {
      const input: JsonSchema.JsonSchema = {
        type: "object",
        properties: {
          a: { $ref: "#/components/schemas/A" },
          b: { $ref: "#/components/schemas/B" }
        }
      }
      const result = JsonSchema.fromSchemaOpenApi3_0(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "object",
          properties: {
            a: { $ref: "#/$defs/A" },
            b: { $ref: "#/$defs/B" }
          }
        },
        definitions: {}
      })
    })

    it("should extract definitions", () => {
      const input: JsonSchema.JsonSchema = {
        type: "object",
        properties: {
          a: {
            $ref: "#/components/schemas/A"
          }
        },
        definitions: {
          MyType: {
            type: "string"
          }
        }
      }
      const result = JsonSchema.fromSchemaOpenApi3_0(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "object",
          properties: {
            a: {
              $ref: "#/$defs/A"
            }
          }
        },
        definitions: {
          MyType: {
            type: "string"
          }
        }
      })
    })

    it("should normalize OpenAPI 3.0 schema example to draft examples array", () => {
      const input: JsonSchema.JsonSchema = {
        type: "string",
        example: "a"
      }
      const result = JsonSchema.fromSchemaOpenApi3_0(input)
      deepStrictEqual(result, {
        dialect: "draft-2020-12",
        schema: {
          type: "string",
          examples: ["a"]
        },
        definitions: {}
      })
    })

    describe("nullable", () => {
      it("nullable: true", () => {
        assertFromSchemaOpenApi3_0(
          { nullable: true },
          {
            schema: {
              anyOf: [
                {},
                { type: "null" }
              ]
            }
          }
        )
      })

      it("should handle nullable with type: string", () => {
        const input: JsonSchema.JsonSchema = {
          type: "string",
          nullable: true
        }
        const result = JsonSchema.fromSchemaOpenApi3_0(input)
        deepStrictEqual(result, {
          dialect: "draft-2020-12",
          schema: {
            type: ["string", "null"]
          },
          definitions: {}
        })
      })

      it("should handle nullable with type: array", () => {
        const input: JsonSchema.JsonSchema = {
          type: ["string", "number"],
          nullable: true
        }
        const result = JsonSchema.fromSchemaOpenApi3_0(input)
        deepStrictEqual(result, {
          dialect: "draft-2020-12",
          schema: {
            type: ["string", "number", "null"]
          },
          definitions: {}
        })
      })

      it("should handle nullable with type and const !== null", () => {
        const input: JsonSchema.JsonSchema = {
          type: "string",
          const: "a",
          nullable: true
        }
        const result = JsonSchema.fromSchemaOpenApi3_0(input)
        deepStrictEqual(result, {
          dialect: "draft-2020-12",
          schema: {
            type: ["string", "null"],
            const: "a"
          },
          definitions: {}
        })
      })

      it("should handle nullable without type and const !== null", () => {
        const input: JsonSchema.JsonSchema = {
          const: "a",
          nullable: true
        }
        const result = JsonSchema.fromSchemaOpenApi3_0(input)
        deepStrictEqual(result, {
          dialect: "draft-2020-12",
          schema: {
            anyOf: [
              { const: "a" },
              { type: "null" }
            ]
          },
          definitions: {}
        })
      })

      it("should handle nullable with const === null", () => {
        const input: JsonSchema.JsonSchema = {
          const: null,
          nullable: true
        }
        const result = JsonSchema.fromSchemaOpenApi3_0(input)
        deepStrictEqual(result, {
          dialect: "draft-2020-12",
          schema: {
            const: null
          },
          definitions: {}
        })
      })

      it("should handle nullable with enum", () => {
        const input: JsonSchema.JsonSchema = {
          type: "string",
          enum: ["a", "b"],
          nullable: true
        }
        const result = JsonSchema.fromSchemaOpenApi3_0(input)
        deepStrictEqual(result, {
          dialect: "draft-2020-12",
          schema: {
            type: ["string", "null"],
            enum: ["a", "b", null]
          },
          definitions: {}
        })
      })

      it("should handle nullable with enum that already includes null", () => {
        const input: JsonSchema.JsonSchema = {
          type: "string",
          enum: ["a", "b", null],
          nullable: true
        }
        const result = JsonSchema.fromSchemaOpenApi3_0(input)
        deepStrictEqual(result, {
          dialect: "draft-2020-12",
          schema: {
            type: ["string", "null"],
            enum: ["a", "b", null]
          },
          definitions: {}
        })
      })

      it("should handle nullable with enum that only includes null", () => {
        const input: JsonSchema.JsonSchema = {
          type: "string",
          enum: [null],
          nullable: true
        }
        const result = JsonSchema.fromSchemaOpenApi3_0(input)
        deepStrictEqual(result, {
          dialect: "draft-2020-12",
          schema: {
            type: ["string", "null"],
            enum: [null]
          },
          definitions: {}
        })
      })

      it("should handle nullable without type using anyOf", () => {
        const input: JsonSchema.JsonSchema = {
          nullable: true,
          minimum: 0
        }
        const result = JsonSchema.fromSchemaOpenApi3_0(input)
        deepStrictEqual(result, {
          dialect: "draft-2020-12",
          schema: {
            anyOf: [
              {
                minimum: 0
              },
              {
                type: "null"
              }
            ]
          },
          definitions: {}
        })
      })

      it("should remove nullable: false", () => {
        const input: JsonSchema.JsonSchema = {
          type: "string",
          nullable: false
        }
        const result = JsonSchema.fromSchemaOpenApi3_0(input)
        deepStrictEqual(result, {
          dialect: "draft-2020-12",
          schema: {
            type: "string"
          },
          definitions: {}
        })
      })

      it("should handle nullable with allOf", () => {
        assertFromSchemaOpenApi3_0(
          {
            type: "string",
            allOf: [{ nullable: true }]
          },
          {
            schema: {
              type: "string",
              allOf: [{
                anyOf: [
                  {},
                  { type: "null" }
                ]
              }]
            }
          }
        )
        assertFromSchemaOpenApi3_0(
          {
            type: "string",
            nullable: true,
            allOf: [{ nullable: true }]
          },
          {
            schema: {
              type: ["string", "null"],
              allOf: [{
                anyOf: [
                  {},
                  { type: "null" }
                ]
              }]
            }
          }
        )
      })
    })

    describe("exclusivity", () => {
      it("should convert boolean exclusiveMinimum to number", () => {
        const input: JsonSchema.JsonSchema = {
          type: "number",
          minimum: 10,
          exclusiveMinimum: true
        }
        const result = JsonSchema.fromSchemaOpenApi3_0(input)
        deepStrictEqual(result, {
          dialect: "draft-2020-12",
          schema: {
            type: "number",
            exclusiveMinimum: 10
          },
          definitions: {}
        })
      })

      it("should convert boolean exclusiveMaximum to number", () => {
        const input: JsonSchema.JsonSchema = {
          type: "number",
          maximum: 100,
          exclusiveMaximum: true
        }
        const result = JsonSchema.fromSchemaOpenApi3_0(input)
        deepStrictEqual(result, {
          dialect: "draft-2020-12",
          schema: {
            type: "number",
            exclusiveMaximum: 100
          },
          definitions: {}
        })
      })

      it("should remove exclusiveMinimum: false", () => {
        const input: JsonSchema.JsonSchema = {
          type: "number",
          minimum: 10,
          exclusiveMinimum: false
        }
        const result = JsonSchema.fromSchemaOpenApi3_0(input)
        deepStrictEqual(result, {
          dialect: "draft-2020-12",
          schema: {
            type: "number",
            minimum: 10
          },
          definitions: {}
        })
      })

      it("should remove exclusiveMaximum: false", () => {
        const input: JsonSchema.JsonSchema = {
          type: "number",
          maximum: 100,
          exclusiveMaximum: false
        }
        const result = JsonSchema.fromSchemaOpenApi3_0(input)
        deepStrictEqual(result, {
          dialect: "draft-2020-12",
          schema: {
            type: "number",
            maximum: 100
          },
          definitions: {}
        })
      })

      it("should handle exclusiveMinimum without minimum", () => {
        const input: JsonSchema.JsonSchema = {
          type: "number",
          exclusiveMinimum: true
        }
        const result = JsonSchema.fromSchemaOpenApi3_0(input)
        deepStrictEqual(result, {
          dialect: "draft-2020-12",
          schema: {
            type: "number"
          },
          definitions: {}
        })
      })

      it("should handle exclusiveMaximum without maximum", () => {
        const input: JsonSchema.JsonSchema = {
          type: "number",
          exclusiveMaximum: true
        }
        const result = JsonSchema.fromSchemaOpenApi3_0(input)
        deepStrictEqual(result, {
          dialect: "draft-2020-12",
          schema: {
            type: "number"
          },
          definitions: {}
        })
      })
    })
  })

  describe("toDocumentDraft07", () => {
    it("should rewrite $defs references to definitions", () => {
      const input: JsonSchema.Document<"draft-2020-12"> = {
        dialect: "draft-2020-12",
        schema: {
          type: "object",
          properties: {
            a: { $ref: "#/$defs/A" },
            b: { $ref: "#/$defs/B" }
          }
        },
        definitions: {
          A: {
            type: "string",
            $ref: "#/$defs/B"
          },
          B: {
            type: "number"
          }
        }
      }
      const result = JsonSchema.toDocumentDraft07(input)
      deepStrictEqual(result, {
        dialect: "draft-07",
        schema: {
          type: "object",
          properties: {
            a: { $ref: "#/definitions/A" },
            b: { $ref: "#/definitions/B" }
          }
        },
        definitions: {
          A: {
            type: "string",
            $ref: "#/definitions/B"
          },
          B: {
            type: "number"
          }
        }
      })
    })

    it("should convert prefixItems to items array", () => {
      const input: JsonSchema.Document<"draft-2020-12"> = {
        dialect: "draft-2020-12",
        schema: {
          type: "array",
          prefixItems: [
            { type: "string" },
            { type: "number" }
          ],
          items: { type: "boolean" }
        },
        definitions: {}
      }
      const result = JsonSchema.toDocumentDraft07(input)
      deepStrictEqual(result, {
        dialect: "draft-07",
        schema: {
          type: "array",
          items: [
            { type: "string" },
            { type: "number" }
          ],
          additionalItems: { type: "boolean" }
        },
        definitions: {}
      })
    })

    it("should convert single items to items", () => {
      const input: JsonSchema.Document<"draft-2020-12"> = {
        dialect: "draft-2020-12",
        schema: {
          type: "array",
          items: { type: "string" }
        },
        definitions: {}
      }
      const result = JsonSchema.toDocumentDraft07(input)
      deepStrictEqual(result, {
        dialect: "draft-07",
        schema: {
          type: "array",
          items: { type: "string" }
        },
        definitions: {}
      })
    })

    it("should remove non-standard properties", () => {
      const input: JsonSchema.Document<"draft-2020-12"> = {
        dialect: "draft-2020-12",
        schema: {
          type: "string",
          "x-custom": "value"
        },
        definitions: {}
      }
      const result = JsonSchema.toDocumentDraft07(input)
      deepStrictEqual(result, {
        dialect: "draft-07",
        schema: {
          type: "string"
        },
        definitions: {}
      })
    })
  })

  describe("toDocumentOpenApi3_1", () => {
    it("should rewrite $defs references to definitions", () => {
      const input: JsonSchema.Document<"draft-2020-12"> = {
        dialect: "draft-2020-12",
        schema: {
          type: "object",
          properties: {
            a: { $ref: "#/$defs/A" },
            b: { $ref: "#/$defs/B" }
          }
        },
        definitions: {
          A: {
            type: "string",
            $ref: "#/$defs/B"
          },
          B: {
            type: "number"
          }
        }
      }
      const result = JsonSchema.toDocumentOpenApi3_1(input)
      deepStrictEqual(result, {
        dialect: "openapi-3.1",
        schema: {
          type: "object",
          properties: {
            a: { $ref: "#/components/schemas/A" },
            b: { $ref: "#/components/schemas/B" }
          }
        },
        definitions: {
          A: {
            type: "string",
            $ref: "#/components/schemas/B"
          },
          B: {
            type: "number"
          }
        }
      })
    })
  })

  describe("roundtrip conversions", () => {
    it("should roundtrip draft-07 -> draft-2020-12 -> draft-07", () => {
      const original: JsonSchema.JsonSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          items: {
            type: "array",
            items: [
              { type: "string" },
              { type: "number" }
            ],
            additionalItems: { type: "boolean" }
          },
          ref: {
            $ref: "#/definitions/MyType"
          }
        },
        definitions: {
          MyType: {
            type: "string"
          }
        }
      }

      const to2020_12 = JsonSchema.fromSchemaDraft07(original)
      const backTo07 = JsonSchema.toDocumentDraft07(to2020_12)

      deepStrictEqual(backTo07.schema, {
        type: "object",
        properties: {
          name: { type: "string" },
          items: {
            type: "array",
            items: [
              { type: "string" },
              { type: "number" }
            ],
            additionalItems: { type: "boolean" }
          },
          ref: {
            $ref: "#/definitions/MyType"
          }
        }
      })
      deepStrictEqual(backTo07.definitions, {
        MyType: {
          type: "string"
        }
      })
    })

    it("should roundtrip openapi-3.1 -> draft-2020-12 -> openapi-3.1", () => {
      const original: JsonSchema.JsonSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          items: {
            type: "array",
            items: [
              { type: "string" },
              { type: "number" }
            ],
            additionalItems: { type: "boolean" }
          },
          ref: {
            $ref: "#/components/schemas/MyType"
          }
        }
      }

      const to2020_12 = JsonSchema.fromSchemaOpenApi3_1(original)
      const backTo31 = JsonSchema.toDocumentOpenApi3_1(to2020_12)

      deepStrictEqual(backTo31.schema, {
        type: "object",
        properties: {
          name: { type: "string" },
          items: {
            type: "array",
            items: [
              { type: "string" },
              { type: "number" }
            ],
            additionalItems: { type: "boolean" }
          },
          ref: {
            $ref: "#/components/schemas/MyType"
          }
        }
      })
    })
  })
})
