import { JsonSchema, SchemaRepresentation } from "effect"
import { describe, it } from "vitest"
import { deepStrictEqual, strictEqual } from "../../utils/assert.ts"

describe("fromJsonSchemaDocument", () => {
  function assertFromJsonSchema(
    schema: JsonSchema.JsonSchema,
    expected: {
      readonly representation: SchemaRepresentation.Representation
      readonly definitions?: Record<string, SchemaRepresentation.Representation>
    },
    runtime?: string
  ) {
    const expectedDocument: SchemaRepresentation.Document = {
      representation: expected.representation,
      references: expected.definitions ?? {}
    }
    const jsonDocument = JsonSchema.fromSchemaDraft2020_12(schema)
    const document = SchemaRepresentation.fromJsonSchemaDocument(jsonDocument)
    deepStrictEqual(document, expectedDocument)
    const multiDocument = SchemaRepresentation.toMultiDocument(document)
    if (runtime !== undefined) {
      strictEqual(SchemaRepresentation.toCodeDocument(multiDocument).codes[0].runtime, runtime)
    }
  }

  it("{}", () => {
    assertFromJsonSchema(
      {},
      {
        representation: { _tag: "Unknown" }
      },
      "Schema.Unknown"
    )
    assertFromJsonSchema(
      { description: "a" },
      {
        representation: { _tag: "Unknown", annotations: { description: "a" } }
      },
      `Schema.Unknown.annotate({ "description": "a" })`
    )
  })

  describe("const", () => {
    it("const: literal (string)", () => {
      assertFromJsonSchema(
        { const: "a" },
        {
          representation: { _tag: "Literal", literal: "a" }
        },
        `Schema.Literal("a")`
      )
      assertFromJsonSchema(
        { const: "a", description: "a" },
        {
          representation: { _tag: "Literal", literal: "a", annotations: { description: "a" } }
        },
        `Schema.Literal("a").annotate({ "description": "a" })`
      )
    })

    it("const: literal (number)", () => {
      assertFromJsonSchema(
        { const: 1 },
        {
          representation: { _tag: "Literal", literal: 1 }
        },
        `Schema.Literal(1)`
      )
    })

    it("const: literal (boolean)", () => {
      assertFromJsonSchema(
        { const: true },
        {
          representation: { _tag: "Literal", literal: true }
        },
        `Schema.Literal(true)`
      )
    })

    it("const: null", () => {
      assertFromJsonSchema(
        { const: null },
        {
          representation: { _tag: "Null" }
        },
        `Schema.Null`
      )
      assertFromJsonSchema(
        { const: null, description: "a" },
        {
          representation: { _tag: "Null", annotations: { description: "a" } }
        },
        `Schema.Null.annotate({ "description": "a" })`
      )
    })

    it("const: non-literal", () => {
      assertFromJsonSchema(
        { const: {} },
        {
          representation: { _tag: "Unknown" }
        },
        `Schema.Unknown`
      )
    })
  })

  describe("enum", () => {
    it("single enum (string)", () => {
      assertFromJsonSchema(
        { enum: ["a"] },
        {
          representation: { _tag: "Literal", literal: "a" }
        },
        `Schema.Literal("a")`
      )
      assertFromJsonSchema(
        { enum: ["a"], description: "a" },
        {
          representation: { _tag: "Literal", literal: "a", annotations: { description: "a" } }
        },
        `Schema.Literal("a").annotate({ "description": "a" })`
      )
    })

    it("single enum (number)", () => {
      assertFromJsonSchema(
        { enum: [1] },
        {
          representation: { _tag: "Literal", literal: 1 }
        },
        `Schema.Literal(1)`
      )
    })

    it("single enum (boolean)", () => {
      assertFromJsonSchema(
        { enum: [true] },
        {
          representation: { _tag: "Literal", literal: true }
        },
        `Schema.Literal(true)`
      )
    })

    it("multiple enum (literals)", () => {
      assertFromJsonSchema(
        { enum: ["a", 1] },
        {
          representation: {
            _tag: "Union",
            types: [
              { _tag: "Literal", literal: "a" },
              { _tag: "Literal", literal: 1 }
            ],
            mode: "anyOf"
          }
        },
        `Schema.Literals(["a", 1])`
      )
      assertFromJsonSchema(
        { enum: ["a", 1], description: "a" },
        {
          representation: {
            _tag: "Union",
            types: [
              { _tag: "Literal", literal: "a" },
              { _tag: "Literal", literal: 1 }
            ],
            mode: "anyOf",
            annotations: { description: "a" }
          }
        },
        `Schema.Literals(["a", 1]).annotate({ "description": "a" })`
      )
    })

    it("enum containing null", () => {
      assertFromJsonSchema(
        { enum: ["a", null] },
        {
          representation: {
            _tag: "Union",
            types: [
              { _tag: "Literal", literal: "a" },
              { _tag: "Null" }
            ],
            mode: "anyOf"
          }
        },
        `Schema.Union([Schema.Literal("a"), Schema.Null])`
      )
    })
  })

  it("anyOf", () => {
    assertFromJsonSchema(
      { anyOf: [{ const: "a" }, { enum: [1, 2] }] },
      {
        representation: {
          _tag: "Union",
          types: [
            { _tag: "Literal", literal: "a" },
            {
              _tag: "Union",
              types: [
                { _tag: "Literal", literal: 1 },
                { _tag: "Literal", literal: 2 }
              ],
              mode: "anyOf"
            }
          ],
          mode: "anyOf"
        }
      },
      `Schema.Union([Schema.Literal("a"), Schema.Literals([1, 2])])`
    )
  })

  it("oneOf", () => {
    assertFromJsonSchema(
      { oneOf: [{ const: "a" }, { enum: [1, 2] }] },
      {
        representation: {
          _tag: "Union",
          types: [
            { _tag: "Literal", literal: "a" },
            {
              _tag: "Union",
              types: [
                { _tag: "Literal", literal: 1 },
                { _tag: "Literal", literal: 2 }
              ],
              mode: "anyOf"
            }
          ],
          mode: "oneOf"
        }
      },
      `Schema.Union([Schema.Literal("a"), Schema.Literals([1, 2])], { mode: "oneOf" })`
    )
  })

  describe("type: null", () => {
    it("type only", () => {
      assertFromJsonSchema(
        { type: "null" },
        {
          representation: { _tag: "Null" }
        },
        `Schema.Null`
      )
    })
  })

  describe("type: string", () => {
    it("type only", () => {
      assertFromJsonSchema(
        { type: "string" },
        {
          representation: { _tag: "String", checks: [] }
        },
        `Schema.String`
      )
    })
  })

  describe("type: number", () => {
    it("type only", () => {
      assertFromJsonSchema(
        { type: "number" },
        {
          representation: { _tag: "Number", checks: [{ _tag: "Filter", meta: { _tag: "isFinite" } }] }
        },
        `Schema.Number.check(Schema.isFinite())`
      )
    })
  })

  describe("type: integer", () => {
    it("type only", () => {
      assertFromJsonSchema(
        { type: "integer" },
        {
          representation: {
            _tag: "Number",
            checks: [
              { _tag: "Filter", meta: { _tag: "isInt" } }
            ]
          }
        },
        `Schema.Number.check(Schema.isInt())`
      )
    })
  })

  describe("type: boolean", () => {
    it("type only", () => {
      assertFromJsonSchema(
        { type: "boolean" },
        {
          representation: { _tag: "Boolean" }
        },
        `Schema.Boolean`
      )
    })
  })

  describe("type: array", () => {
    it("type only", () => {
      assertFromJsonSchema(
        { type: "array" },
        {
          representation: {
            _tag: "Arrays",
            elements: [],
            rest: [{ _tag: "Unknown" }],
            checks: []
          }
        },
        `Schema.Array(Schema.Unknown)`
      )
    })

    it("items", () => {
      assertFromJsonSchema(
        {
          type: "array",
          items: { type: "string" }
        },
        {
          representation: { _tag: "Arrays", elements: [], rest: [{ _tag: "String", checks: [] }], checks: [] }
        },
        `Schema.Array(Schema.String)`
      )
    })

    it("prefixItems", () => {
      assertFromJsonSchema(
        {
          type: "array",
          prefixItems: [{ type: "string" }],
          maxItems: 1
        },
        {
          representation: {
            _tag: "Arrays",
            elements: [
              { isOptional: true, type: { _tag: "String", checks: [] } }
            ],
            rest: [],
            checks: []
          }
        },
        `Schema.Tuple([Schema.optionalKey(Schema.String)])`
      )

      assertFromJsonSchema(
        {
          type: "array",
          prefixItems: [{ type: "string" }],
          minItems: 1,
          maxItems: 1
        },
        {
          representation: {
            _tag: "Arrays",
            elements: [
              { isOptional: false, type: { _tag: "String", checks: [] } }
            ],
            rest: [],
            checks: []
          }
        },
        `Schema.Tuple([Schema.String])`
      )
    })

    it("prefixItems & minItems", () => {
      assertFromJsonSchema(
        {
          type: "array",
          prefixItems: [{ type: "string" }],
          minItems: 1,
          items: { type: "number" }
        },
        {
          representation: {
            _tag: "Arrays",
            elements: [
              { isOptional: false, type: { _tag: "String", checks: [] } }
            ],
            rest: [
              { _tag: "Number", checks: [{ _tag: "Filter", meta: { _tag: "isFinite" } }] }
            ],
            checks: []
          }
        },
        `Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number.check(Schema.isFinite())])`
      )
    })
  })

  describe("type: object", () => {
    it("type only", () => {
      assertFromJsonSchema(
        { type: "object" },
        {
          representation: {
            _tag: "Objects",
            propertySignatures: [],
            indexSignatures: [
              { parameter: { _tag: "String", checks: [] }, type: { _tag: "Unknown" } }
            ],
            checks: []
          }
        },
        `Schema.Record(Schema.String, Schema.Unknown)`
      )
      assertFromJsonSchema(
        {
          type: "object",
          additionalProperties: false
        },
        {
          representation: {
            _tag: "Objects",
            propertySignatures: [],
            indexSignatures: [],
            checks: []
          }
        },
        `Schema.Struct({  })`
      )
    })

    it("additionalProperties", () => {
      assertFromJsonSchema(
        {
          type: "object",
          additionalProperties: { type: "boolean" }
        },
        {
          representation: {
            _tag: "Objects",
            propertySignatures: [],
            indexSignatures: [
              { parameter: { _tag: "String", checks: [] }, type: { _tag: "Boolean" } }
            ],
            checks: []
          }
        },
        `Schema.Record(Schema.String, Schema.Boolean)`
      )
    })

    it("properties", () => {
      assertFromJsonSchema(
        {
          type: "object",
          properties: { a: { type: "string" }, b: { type: "string" } },
          required: ["a"],
          additionalProperties: false
        },
        {
          representation: {
            _tag: "Objects",
            propertySignatures: [
              {
                name: "a",
                type: { _tag: "String", checks: [] },
                isOptional: false,
                isMutable: false
              },
              {
                name: "b",
                type: { _tag: "String", checks: [] },
                isOptional: true,
                isMutable: false
              }
            ],
            indexSignatures: [],
            checks: []
          }
        },
        `Schema.Struct({ "a": Schema.String, "b": Schema.optionalKey(Schema.String) })`
      )
    })

    it("properties & additionalProperties", () => {
      assertFromJsonSchema(
        {
          type: "object",
          properties: { a: { type: "string" } },
          required: ["a"],
          additionalProperties: { type: "boolean" }
        },
        {
          representation: {
            _tag: "Objects",
            propertySignatures: [{
              name: "a",
              type: { _tag: "String", checks: [] },
              isOptional: false,
              isMutable: false
            }],
            indexSignatures: [
              { parameter: { _tag: "String", checks: [] }, type: { _tag: "Boolean" } }
            ],
            checks: []
          }
        },
        `Schema.StructWithRest(Schema.Struct({ "a": Schema.String }), [Schema.Record(Schema.String, Schema.Boolean)])`
      )
    })
  })

  it("type: Array", () => {
    assertFromJsonSchema(
      {
        type: ["string", "null"]
      },
      {
        representation: {
          _tag: "Union",
          types: [{ _tag: "String", checks: [] }, { _tag: "Null" }],
          mode: "anyOf"
        }
      },
      `Schema.Union([Schema.String, Schema.Null])`
    )
    assertFromJsonSchema(
      {
        type: ["string", "null"],
        description: "a"
      },
      {
        representation: {
          _tag: "Union",
          types: [{ _tag: "String", checks: [] }, { _tag: "Null" }],
          mode: "anyOf",
          annotations: { description: "a" }
        }
      },
      `Schema.Union([Schema.String, Schema.Null]).annotate({ "description": "a" })`
    )
  })

  describe("$ref", () => {
    it("should create a Reference and a definition", () => {
      assertFromJsonSchema(
        {
          $ref: "#/$defs/A",
          $defs: {
            A: {
              type: "string"
            }
          }
        },
        {
          representation: { _tag: "Reference", $ref: "A" },
          definitions: {
            A: {
              _tag: "String",
              checks: [],
              annotations: { identifier: "A" }
            }
          }
        }
      )
    })

    // TODO: remove unnecessary definition
    it("should resolve the $ref if there are annotations", () => {
      assertFromJsonSchema(
        {
          $ref: "#/$defs/A",
          description: "a",
          $defs: {
            A: {
              type: "string"
            }
          }
        },
        {
          representation: {
            _tag: "String",
            checks: [],
            annotations: { description: "a", identifier: "A" }
          },
          definitions: {
            A: {
              _tag: "String",
              checks: [],
              annotations: { identifier: "A" }
            }
          }
        }
      )
    })

    // TODO: remove unnecessary definition
    it("should resolve the $ref if there is an allOf", () => {
      assertFromJsonSchema(
        {
          allOf: [
            { $ref: "#/$defs/A" },
            { description: "a" }
          ],
          $defs: {
            A: {
              type: "string"
            }
          }
        },
        {
          representation: {
            _tag: "String",
            checks: [],
            annotations: { description: "a", identifier: "A" }
          },
          definitions: {
            A: {
              _tag: "String",
              checks: [],
              annotations: { identifier: "A" }
            }
          }
        }
      )
    })

    it("recursive schema", () => {
      assertFromJsonSchema(
        {
          $ref: "#/$defs/A",
          $defs: {
            A: {
              "type": "object",
              "properties": {
                "name": {
                  "type": "string"
                },
                "children": {
                  "type": "array",
                  "items": {
                    "$ref": "#/$defs/A"
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
        },
        {
          representation: { _tag: "Reference", $ref: "A" },
          definitions: {
            A: {
              _tag: "Objects",
              annotations: { identifier: "A" },
              propertySignatures: [
                {
                  name: "name",
                  type: { _tag: "String", checks: [] },
                  isOptional: false,
                  isMutable: false
                },
                {
                  name: "children",
                  type: {
                    _tag: "Arrays",
                    elements: [],
                    rest: [{
                      _tag: "Suspend",
                      checks: [],
                      thunk: {
                        _tag: "Reference",
                        $ref: "A"
                      }
                    }],
                    checks: []
                  },
                  isOptional: false,
                  isMutable: false
                }
              ],
              indexSignatures: [],
              checks: []
            }
          }
        }
      )
    })
  })

  describe("allOf", () => {
    it("add property", () => {
      assertFromJsonSchema(
        {
          type: "object",
          additionalProperties: false,
          allOf: [
            { properties: { a: { type: "string" } } }
          ]
        },
        {
          representation: {
            _tag: "Objects",
            propertySignatures: [
              {
                name: "a",
                type: { _tag: "String", checks: [] },
                isOptional: true,
                isMutable: false
              }
            ],
            indexSignatures: [],
            checks: []
          }
        },
        `Schema.Struct({ "a": Schema.optionalKey(Schema.String) })`
      )
    })

    it("add additionalProperties", () => {
      assertFromJsonSchema(
        {
          type: "object",
          allOf: [
            { additionalProperties: { type: "boolean" } }
          ]
        },
        {
          representation: {
            _tag: "Objects",
            propertySignatures: [],
            indexSignatures: [
              { parameter: { _tag: "String", checks: [] }, type: { _tag: "Boolean" } }
            ],
            checks: []
          }
        },
        `Schema.Record(Schema.String, Schema.Boolean)`
      )
    })
  })
})
