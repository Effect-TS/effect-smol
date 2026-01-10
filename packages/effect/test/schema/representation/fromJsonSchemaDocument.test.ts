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
      {
        title: "a",
        description: "b",
        default: "c",
        examples: ["d"],
        readOnly: true,
        writeOnly: true
      },
      {
        representation: {
          _tag: "Unknown",
          annotations: {
            title: "a",
            description: "b",
            default: "c",
            examples: ["d"],
            readOnly: true,
            writeOnly: true
          }
        }
      },
      `Schema.Unknown.annotate({ "title": "a", "description": "b", "default": "c", "examples": ["d"], "readOnly": true, "writeOnly": true })`
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

    describe("checks", () => {
      it("minLength", () => {
        assertFromJsonSchema(
          { type: "string", minLength: 1 },
          {
            representation: {
              _tag: "String",
              checks: [{ _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 } }]
            }
          },
          `Schema.String.check(Schema.isMinLength(1))`
        )
      })

      it("maxLength", () => {
        assertFromJsonSchema(
          { type: "string", maxLength: 1 },
          {
            representation: {
              _tag: "String",
              checks: [{ _tag: "Filter", meta: { _tag: "isMaxLength", maxLength: 1 } }]
            }
          },
          `Schema.String.check(Schema.isMaxLength(1))`
        )
      })

      it("pattern", () => {
        assertFromJsonSchema(
          { type: "string", pattern: "a*" },
          {
            representation: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isPattern", regExp: new RegExp("a*") } }
              ]
            }
          },
          `Schema.String.check(Schema.isPattern(new RegExp("a*")))`
        )
        assertFromJsonSchema(
          { pattern: "a*" },
          {
            representation: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isPattern", regExp: new RegExp("a*") } }
              ]
            }
          },
          `Schema.String.check(Schema.isPattern(new RegExp("a*")))`
        )
      })
    })
  })

  describe("type: number", () => {
    it("type only", () => {
      assertFromJsonSchema(
        { type: "number" },
        {
          representation: {
            _tag: "Number",
            checks: [
              { _tag: "Filter", meta: { _tag: "isFinite" } }
            ]
          }
        },
        `Schema.Number.check(Schema.isFinite())`
      )
    })

    describe("checks", () => {
      it("minimum", () => {
        assertFromJsonSchema(
          { type: "number", minimum: 1 },
          {
            representation: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isFinite" } },
                { _tag: "Filter", meta: { _tag: "isGreaterThanOrEqualTo", minimum: 1 } }
              ]
            }
          },
          `Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(1))`
        )
      })

      it("maximum", () => {
        assertFromJsonSchema(
          { type: "number", maximum: 1 },
          {
            representation: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isFinite" } },
                { _tag: "Filter", meta: { _tag: "isLessThanOrEqualTo", maximum: 1 } }
              ]
            }
          },
          `Schema.Number.check(Schema.isFinite(), Schema.isLessThanOrEqualTo(1))`
        )
      })

      it("exclusiveMinimum", () => {
        assertFromJsonSchema(
          { type: "number", exclusiveMinimum: 1 },
          {
            representation: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isFinite" } },
                { _tag: "Filter", meta: { _tag: "isGreaterThan", exclusiveMinimum: 1 } }
              ]
            }
          },
          `Schema.Number.check(Schema.isFinite(), Schema.isGreaterThan(1))`
        )
      })

      it("exclusiveMaximum", () => {
        assertFromJsonSchema(
          { type: "number", exclusiveMaximum: 1 },
          {
            representation: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isFinite" } },
                { _tag: "Filter", meta: { _tag: "isLessThan", exclusiveMaximum: 1 } }
              ]
            }
          },
          `Schema.Number.check(Schema.isFinite(), Schema.isLessThan(1))`
        )
      })

      it("multipleOf", () => {
        assertFromJsonSchema(
          { type: "number", multipleOf: 1 },
          {
            representation: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isFinite" } },
                { _tag: "Filter", meta: { _tag: "isMultipleOf", divisor: 1 } }
              ]
            }
          },
          `Schema.Number.check(Schema.isFinite(), Schema.isMultipleOf(1))`
        )
      })
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

    describe("checks", () => {
      it("minimum", () => {
        assertFromJsonSchema(
          { type: "integer", minimum: 1 },
          {
            representation: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isInt" } },
                { _tag: "Filter", meta: { _tag: "isGreaterThanOrEqualTo", minimum: 1 } }
              ]
            }
          },
          `Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1))`
        )
      })

      it("maximum", () => {
        assertFromJsonSchema(
          { type: "integer", maximum: 1 },
          {
            representation: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isInt" } },
                { _tag: "Filter", meta: { _tag: "isLessThanOrEqualTo", maximum: 1 } }
              ]
            }
          },
          `Schema.Number.check(Schema.isInt(), Schema.isLessThanOrEqualTo(1))`
        )
      })

      it("exclusiveMinimum", () => {
        assertFromJsonSchema(
          { type: "integer", exclusiveMinimum: 1 },
          {
            representation: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isInt" } },
                { _tag: "Filter", meta: { _tag: "isGreaterThan", exclusiveMinimum: 1 } }
              ]
            }
          },
          `Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(1))`
        )
      })

      it("exclusiveMaximum", () => {
        assertFromJsonSchema(
          { type: "integer", exclusiveMaximum: 1 },
          {
            representation: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isInt" } },
                { _tag: "Filter", meta: { _tag: "isLessThan", exclusiveMaximum: 1 } }
              ]
            }
          },
          `Schema.Number.check(Schema.isInt(), Schema.isLessThan(1))`
        )
      })

      it("multipleOf", () => {
        assertFromJsonSchema(
          { type: "integer", multipleOf: 1 },
          {
            representation: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isInt" } },
                { _tag: "Filter", meta: { _tag: "isMultipleOf", divisor: 1 } }
              ]
            }
          },
          `Schema.Number.check(Schema.isInt(), Schema.isMultipleOf(1))`
        )
      })
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

    describe("checks", () => {
      it("minItems", () => {
        assertFromJsonSchema(
          { type: "array", minItems: 1 },
          {
            representation: {
              _tag: "Arrays",
              elements: [],
              rest: [{ _tag: "Unknown" }],
              checks: [{ _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 } }]
            }
          },
          `Schema.Array(Schema.Unknown).check(Schema.isMinLength(1))`
        )
      })

      it("maxItems", () => {
        assertFromJsonSchema(
          { type: "array", maxItems: 1 },
          {
            representation: {
              _tag: "Arrays",
              elements: [],
              rest: [{ _tag: "Unknown" }],
              checks: [{ _tag: "Filter", meta: { _tag: "isMaxLength", maxLength: 1 } }]
            }
          },
          `Schema.Array(Schema.Unknown).check(Schema.isMaxLength(1))`
        )
      })

      it("uniqueItems", () => {
        assertFromJsonSchema(
          { type: "array", uniqueItems: true },
          {
            representation: {
              _tag: "Arrays",
              elements: [],
              rest: [{ _tag: "Unknown" }],
              checks: [{ _tag: "Filter", meta: { _tag: "isUnique" } }]
            }
          },
          `Schema.Array(Schema.Unknown).check(Schema.isUnique())`
        )
      })
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

    it("patternProperties", () => {
      assertFromJsonSchema(
        {
          type: "object",
          patternProperties: {
            "a*": { type: "string" }
          },
          additionalProperties: false
        },
        {
          representation: {
            _tag: "Objects",
            propertySignatures: [],
            indexSignatures: [
              {
                parameter: {
                  _tag: "String",
                  checks: [{ _tag: "Filter", meta: { _tag: "isPattern", regExp: new RegExp("a*") } }]
                },
                type: { _tag: "String", checks: [] }
              }
            ],
            checks: []
          }
        },
        `Schema.Record(Schema.String.check(Schema.isPattern(new RegExp("a*"))), Schema.String)`
      )
      assertFromJsonSchema(
        {
          type: "object",
          patternProperties: {
            "a*": { type: "string" },
            "b*": { type: "number" }
          },
          additionalProperties: false
        },
        {
          representation: {
            _tag: "Objects",
            propertySignatures: [],
            indexSignatures: [
              {
                parameter: {
                  _tag: "String",
                  checks: [{ _tag: "Filter", meta: { _tag: "isPattern", regExp: new RegExp("a*") } }]
                },
                type: { _tag: "String", checks: [] }
              },
              {
                parameter: {
                  _tag: "String",
                  checks: [{ _tag: "Filter", meta: { _tag: "isPattern", regExp: new RegExp("b*") } }]
                },
                type: { _tag: "Number", checks: [{ _tag: "Filter", meta: { _tag: "isFinite" } }] }
              }
            ],
            checks: []
          }
        },
        `Schema.StructWithRest(Schema.Struct({  }), [Schema.Record(Schema.String.check(Schema.isPattern(new RegExp("a*"))), Schema.String), Schema.Record(Schema.String.check(Schema.isPattern(new RegExp("b*"))), Schema.Number.check(Schema.isFinite()))])`
      )
    })

    describe("checks", () => {
      it("minProperties", () => {
        assertFromJsonSchema(
          { type: "object", minProperties: 1 },
          {
            representation: {
              _tag: "Objects",
              propertySignatures: [],
              indexSignatures: [
                { parameter: { _tag: "String", checks: [] }, type: { _tag: "Unknown" } }
              ],
              checks: [{ _tag: "Filter", meta: { _tag: "isMinProperties", minProperties: 1 } }]
            }
          },
          `Schema.Record(Schema.String, Schema.Unknown).check(Schema.isMinProperties(1))`
        )
      })

      it("maxProperties", () => {
        assertFromJsonSchema(
          { type: "object", maxProperties: 1 },
          {
            representation: {
              _tag: "Objects",
              propertySignatures: [],
              indexSignatures: [
                { parameter: { _tag: "String", checks: [] }, type: { _tag: "Unknown" } }
              ],
              checks: [{ _tag: "Filter", meta: { _tag: "isMaxProperties", maxProperties: 1 } }]
            }
          },
          `Schema.Record(Schema.String, Schema.Unknown).check(Schema.isMaxProperties(1))`
        )
      })
    })
  })

  it("type: array of strings", () => {
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
    describe("type: string", () => {
      it("& minLength", () => {
        assertFromJsonSchema(
          {
            type: "string",
            allOf: [
              { minLength: 1 }
            ]
          },
          {
            representation: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 } }
              ]
            }
          },
          `Schema.String.check(Schema.isMinLength(1))`
        )
      })

      it("& minLength + description", () => {
        assertFromJsonSchema(
          {
            type: "string",
            allOf: [
              { minLength: 1, description: "b" }
            ]
          },
          {
            representation: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 }, annotations: { description: "b" } }
              ]
            }
          },
          `Schema.String.check(Schema.isMinLength(1, { "description": "b" }))`
        )
      })

      it("description & minLength", () => {
        assertFromJsonSchema(
          {
            type: "string",
            description: "a",
            allOf: [
              { minLength: 1 }
            ]
          },
          {
            representation: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 } }
              ],
              annotations: { description: "a" }
            }
          },
          `Schema.String.annotate({ "description": "a" }).check(Schema.isMinLength(1))`
        )
      })

      it("description & minLength + description", () => {
        assertFromJsonSchema(
          {
            type: "string",
            description: "a",
            allOf: [
              { minLength: 1, description: "b" }
            ]
          },
          {
            representation: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 }, annotations: { description: "b" } }
              ],
              annotations: { description: "a" }
            }
          },
          `Schema.String.annotate({ "description": "a" }).check(Schema.isMinLength(1, { "description": "b" }))`
        )
      })

      it("maxLength & minLength", () => {
        assertFromJsonSchema(
          {
            type: "string",
            maxLength: 2,
            allOf: [
              { minLength: 1 }
            ]
          },
          {
            representation: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMaxLength", maxLength: 2 } },
                { _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 } }
              ]
            }
          },
          `Schema.String.check(Schema.isMaxLength(2), Schema.isMinLength(1))`
        )
      })

      it("description + maxLength & minLength", () => {
        assertFromJsonSchema(
          {
            type: "string",
            description: "a",
            maxLength: 2,
            allOf: [
              { minLength: 1 }
            ]
          },
          {
            representation: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMaxLength", maxLength: 2 } },
                { _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 } }
              ],
              annotations: { description: "a" }
            }
          },
          `Schema.String.annotate({ "description": "a" }).check(Schema.isMaxLength(2), Schema.isMinLength(1))`
        )
      })

      it("description + maxLength & minLength + description", () => {
        assertFromJsonSchema(
          {
            type: "string",
            description: "a",
            maxLength: 2,
            allOf: [
              { minLength: 1, description: "b" }
            ]
          },
          {
            representation: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMaxLength", maxLength: 2 } },
                { _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 }, annotations: { description: "b" } }
              ],
              annotations: { description: "a" }
            }
          },
          `Schema.String.annotate({ "description": "a" }).check(Schema.isMaxLength(2), Schema.isMinLength(1, { "description": "b" }))`
        )
      })

      it("& minLength + maxLength", () => {
        assertFromJsonSchema(
          {
            type: "string",
            allOf: [
              { minLength: 1, maxLength: 2 }
            ]
          },
          {
            representation: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 } },
                { _tag: "Filter", meta: { _tag: "isMaxLength", maxLength: 2 } }
              ]
            }
          },
          `Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(2))`
        )
      })

      it("& minLength + maxLength + description", () => {
        assertFromJsonSchema(
          {
            type: "string",
            allOf: [
              { minLength: 1, maxLength: 2, description: "b" }
            ]
          },
          {
            representation: {
              _tag: "String",
              checks: [
                {
                  _tag: "FilterGroup",
                  checks: [
                    { _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 } },
                    { _tag: "Filter", meta: { _tag: "isMaxLength", maxLength: 2 } }
                  ],
                  annotations: { description: "b" }
                }
              ]
            }
          },
          `Schema.String.check(Schema.makeFilterGroup([Schema.isMinLength(1), Schema.isMaxLength(2)], { "description": "b" }))`
        )
      })

      it("& (minLength & maxLength + description)", () => {
        assertFromJsonSchema(
          {
            type: "string",
            allOf: [
              { minLength: 1, allOf: [{ maxLength: 2, description: "c" }] }
            ]
          },
          {
            representation: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 } },
                { _tag: "Filter", meta: { _tag: "isMaxLength", maxLength: 2 }, annotations: { description: "c" } }
              ]
            }
          },
          `Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(2, { "description": "c" }))`
        )
      })

      it("& (minLength + description & maxLength + description)", () => {
        assertFromJsonSchema(
          {
            type: "string",
            allOf: [
              { minLength: 1, description: "b", allOf: [{ maxLength: 2, description: "c" }] }
            ]
          },
          {
            representation: {
              _tag: "String",
              checks: [
                {
                  _tag: "FilterGroup",
                  checks: [
                    { _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 } },
                    { _tag: "Filter", meta: { _tag: "isMaxLength", maxLength: 2 }, annotations: { description: "c" } }
                  ],
                  annotations: { description: "b" }
                }
              ]
            }
          },
          `Schema.String.check(Schema.makeFilterGroup([Schema.isMinLength(1), Schema.isMaxLength(2, { "description": "c" })], { "description": "b" }))`
        )
      })
    })

    describe("type: number", () => {
      it("number & integer", () => {
        assertFromJsonSchema(
          {
            type: "number",
            allOf: [
              { type: "integer" }
            ]
          },
          {
            representation: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isFinite" } },
                { _tag: "Filter", meta: { _tag: "isInt" } }
              ]
            }
          },
          `Schema.Number.check(Schema.isFinite(), Schema.isInt())`
        )
      })

      it("number & integer & integer", () => {
        assertFromJsonSchema(
          {
            type: "number",
            allOf: [
              { type: "integer", minimum: 2 },
              { type: "integer", maximum: 2 }
            ]
          },
          {
            representation: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isFinite" } },
                { _tag: "Filter", meta: { _tag: "isInt" } },
                { _tag: "Filter", meta: { _tag: "isGreaterThanOrEqualTo", minimum: 2 } },
                { _tag: "Filter", meta: { _tag: "isLessThanOrEqualTo", maximum: 2 } }
              ]
            }
          },
          `Schema.Number.check(Schema.isFinite(), Schema.isInt(), Schema.isGreaterThanOrEqualTo(2), Schema.isLessThanOrEqualTo(2))`
        )
      })

      it("integer & number", () => {
        assertFromJsonSchema(
          {
            type: "integer",
            allOf: [
              { type: "number" }
            ]
          },
          {
            representation: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isInt" } },
                { _tag: "Filter", meta: { _tag: "isFinite" } }
              ]
            }
          },
          `Schema.Number.check(Schema.isInt(), Schema.isFinite())`
        )
      })

      it("& (minimum + description & maximum + description)", () => {
        assertFromJsonSchema(
          {
            type: "number",
            allOf: [
              { minimum: 1, description: "b", allOf: [{ maximum: 2, description: "c" }] }
            ]
          },
          {
            representation: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isFinite" } },
                {
                  _tag: "FilterGroup",
                  checks: [
                    { _tag: "Filter", meta: { _tag: "isGreaterThanOrEqualTo", minimum: 1 } },
                    {
                      _tag: "Filter",
                      meta: { _tag: "isLessThanOrEqualTo", maximum: 2 },
                      annotations: { description: "c" }
                    }
                  ],
                  annotations: { description: "b" }
                }
              ]
            }
          },
          `Schema.Number.check(Schema.isFinite(), Schema.makeFilterGroup([Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(2, { "description": "c" })], { "description": "b" }))`
        )
      })
    })

    describe("type: array", () => {
      it("uniqueItems & uniqueItems", () => {
        assertFromJsonSchema(
          {
            type: "array",
            uniqueItems: true,
            allOf: [
              { uniqueItems: true }
            ]
          },
          {
            representation: {
              _tag: "Arrays",
              elements: [],
              rest: [{ _tag: "Unknown" }],
              checks: [{ _tag: "Filter", meta: { _tag: "isUnique" } }]
            }
          },
          `Schema.Array(Schema.Unknown).check(Schema.isUnique())`
        )
      })
    })

    describe("type: object", () => {
      it("add properties", () => {
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
})
