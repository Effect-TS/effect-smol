import { JsonSchema, SchemaStandard } from "effect"
import { describe, it } from "vitest"
import { deepStrictEqual, strictEqual } from "../utils/assert.ts"

describe("fromJsonSchemaDocument", () => {
  function assertFromJsonSchema(
    schema: JsonSchema.JsonSchema,
    expected: {
      readonly schema: SchemaStandard.Standard
      readonly definitions?: Record<string, SchemaStandard.Standard>
    },
    runtime?: string
  ) {
    const expectedDocument: SchemaStandard.Document = {
      schema: expected.schema,
      references: expected.definitions ?? {}
    }
    const jsonDocument = JsonSchema.fromSchemaDraft2020_12(schema)
    const document = SchemaStandard.fromJsonSchemaDocument(jsonDocument)
    deepStrictEqual(document, expectedDocument)
    const multiDocument: SchemaStandard.MultiDocument = {
      schemas: [document.schema],
      references: document.references
    }
    if (runtime !== undefined) {
      strictEqual(SchemaStandard.toGenerationDocument(multiDocument).generations[0].runtime, runtime)
    }
  }

  it("{}", () => {
    assertFromJsonSchema(
      {},
      {
        schema: { _tag: "Unknown" }
      },
      "Schema.Unknown"
    )
    assertFromJsonSchema(
      { description: "a" },
      {
        schema: { _tag: "Unknown", annotations: { description: "a" } }
      },
      `Schema.Unknown.annotate({ "description": "a" })`
    )
  })

  describe("const", () => {
    it("const: literal (string)", () => {
      assertFromJsonSchema(
        { const: "a" },
        {
          schema: { _tag: "Literal", literal: "a" }
        },
        `Schema.Literal("a")`
      )
      assertFromJsonSchema(
        { const: "a", description: "a" },
        {
          schema: { _tag: "Literal", literal: "a", annotations: { description: "a" } }
        },
        `Schema.Literal("a").annotate({ "description": "a" })`
      )
    })

    it("const: literal (number)", () => {
      assertFromJsonSchema(
        { const: 1 },
        {
          schema: { _tag: "Literal", literal: 1 }
        },
        `Schema.Literal(1)`
      )
    })

    it("const: literal (boolean)", () => {
      assertFromJsonSchema(
        { const: true },
        {
          schema: { _tag: "Literal", literal: true }
        },
        `Schema.Literal(true)`
      )
    })

    it("const: null", () => {
      assertFromJsonSchema(
        { const: null },
        {
          schema: { _tag: "Null" }
        },
        `Schema.Null`
      )
      assertFromJsonSchema(
        { const: null, description: "a" },
        {
          schema: { _tag: "Null", annotations: { description: "a" } }
        },
        `Schema.Null.annotate({ "description": "a" })`
      )
    })

    it("const: non-literal", () => {
      assertFromJsonSchema(
        { const: {} },
        {
          schema: { _tag: "Unknown" }
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
          schema: { _tag: "Literal", literal: "a" }
        },
        `Schema.Literal("a")`
      )
      assertFromJsonSchema(
        { enum: ["a"], description: "a" },
        {
          schema: { _tag: "Literal", literal: "a", annotations: { description: "a" } }
        },
        `Schema.Literal("a").annotate({ "description": "a" })`
      )
    })

    it("single enum (number)", () => {
      assertFromJsonSchema(
        { enum: [1] },
        {
          schema: { _tag: "Literal", literal: 1 }
        },
        `Schema.Literal(1)`
      )
    })

    it("single enum (boolean)", () => {
      assertFromJsonSchema(
        { enum: [true] },
        {
          schema: { _tag: "Literal", literal: true }
        },
        `Schema.Literal(true)`
      )
    })

    it("multiple enum (literals)", () => {
      assertFromJsonSchema(
        { enum: ["a", 1] },
        {
          schema: {
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
          schema: {
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
          schema: {
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
        schema: {
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
        schema: {
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
          schema: { _tag: "Null" }
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
          schema: { _tag: "String", checks: [] }
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
          schema: { _tag: "Number", checks: [{ _tag: "Filter", meta: { _tag: "isFinite" } }] }
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
          schema: {
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
          schema: { _tag: "Boolean" }
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
          schema: {
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
          schema: { _tag: "Arrays", elements: [], rest: [{ _tag: "String", checks: [] }], checks: [] }
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
          schema: {
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
          schema: {
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
          schema: {
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
          schema: {
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
          schema: {
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
          schema: {
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
          schema: {
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
          schema: {
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
        schema: {
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
        schema: {
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
          schema: { _tag: "Reference", $ref: "A" },
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
          schema: {
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
          schema: {
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
          schema: { _tag: "Reference", $ref: "A" },
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
          schema: {
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
          schema: {
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
