import { JsonSchema, Schema, SchemaStandard } from "effect"
import { describe, it } from "vitest"
import { deepStrictEqual, strictEqual, throws } from "../utils/assert.ts"

type Category = {
  readonly name: string
  readonly children: ReadonlyArray<Category>
}

const OuterCategory = Schema.Struct({
  name: Schema.String,
  children: Schema.Array(Schema.suspend((): Schema.Codec<Category> => OuterCategory))
}).annotate({ identifier: "Category" })

const InnerCategory = Schema.Struct({
  name: Schema.String,
  children: Schema.Array(
    Schema.suspend((): Schema.Codec<Category> => InnerCategory.annotate({ identifier: "Category" }))
  )
})

describe("Standard", () => {
  describe("fromJsonSchema", () => {
    function assertFromJsonSchema(
      schema: JsonSchema.JsonSchema,
      expected: {
        readonly schema: SchemaStandard.Standard
        readonly definitions?: Record<string, SchemaStandard.Standard>
      },
      code?: string
    ) {
      const expectedDocument: SchemaStandard.Document = {
        schema: expected.schema,
        definitions: expected.definitions ?? {}
      }
      deepStrictEqual(
        SchemaStandard.fromJsonSchemaDocument(JsonSchema.fromSchemaDraft2020_12(schema)),
        expectedDocument
      )
      if (code !== undefined) {
        strictEqual(SchemaStandard.toCode(expectedDocument), code)
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

    it("const", () => {
      assertFromJsonSchema(
        { const: "a" },
        {
          schema: { _tag: "Literal", literal: "a" }
        },
        `Schema.Literal("a")`
      )
    })

    describe("enum", () => {
      it("single enum", () => {
        assertFromJsonSchema(
          { enum: ["a"] },
          {
            schema: { _tag: "Literal", literal: "a" }
          },
          `Schema.Literal("a")`
        )
      })

      it("multiple enum", () => {
        assertFromJsonSchema(
          { enum: ["a", "b"] },
          {
            schema: {
              _tag: "Union",
              types: [
                { _tag: "Literal", literal: "a" },
                { _tag: "Literal", literal: "b" }
              ],
              mode: "anyOf"
            }
          },
          `Schema.Literals(["a", "b"])`
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

    describe("string", () => {
      it("type", () => {
        assertFromJsonSchema(
          { type: "string" },
          {
            schema: { _tag: "String", checks: [] }
          },
          `Schema.String`
        )
      })
    })

    describe("number", () => {
      it("type", () => {
        assertFromJsonSchema(
          { type: "number" },
          {
            schema: { _tag: "Number", checks: [{ _tag: "Filter", meta: { _tag: "isFinite" } }] }
          },
          `Schema.Number.check(Schema.isFinite())`
        )
      })
    })

    describe("integer", () => {
      it("type", () => {
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

    describe("boolean", () => {
      it("type", () => {
        assertFromJsonSchema(
          { type: "boolean" },
          {
            schema: { _tag: "Boolean" }
          },
          `Schema.Boolean`
        )
      })
    })

    describe("array", () => {
      it("type", () => {
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

    describe("object", () => {
      it("type", () => {
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

    describe("$ref", () => {
      it("ref", () => {
        assertFromJsonSchema(
          {
            $ref: "#/$defs/a"
          },
          {
            schema: { _tag: "Reference", $ref: "a" }
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

  describe("toJson", () => {
    function assertToJson(
      schema: Schema.Top,
      expected: {
        readonly schema: JsonSchema.JsonSchema
        readonly definitions?: Record<string, JsonSchema.JsonSchema>
      }
    ) {
      const document = SchemaStandard.fromAST(schema.ast)
      const jd = SchemaStandard.toJson(document)
      deepStrictEqual(jd, { source: "draft-2020-12", definitions: {}, ...expected })
      deepStrictEqual(SchemaStandard.toJson(SchemaStandard.fromJson(jd)), jd)
    }

    describe("Declaration", () => {
      describe("Date", () => {
        it("Date", () => {
          assertToJson(Schema.Date, {
            schema: {
              _tag: "Declaration",
              annotations: { typeConstructor: { _tag: "Date" } },
              typeParameters: [],
              checks: [],
              Encoded: { _tag: "String", checks: [] }
            }
          })
        })

        describe("checks", () => {
          it("isGreaterThanDate", () => {
            assertToJson(Schema.Date.check(Schema.isGreaterThanDate(new Date(0))), {
              schema: {
                _tag: "Declaration",
                annotations: { typeConstructor: { _tag: "Date" } },
                typeParameters: [],
                checks: [
                  {
                    _tag: "Filter",
                    meta: { _tag: "isGreaterThanDate", exclusiveMinimum: "1970-01-01T00:00:00.000Z" }
                  }
                ],
                Encoded: { _tag: "String", checks: [] }
              }
            })
          })

          it("isGreaterThanOrEqualToDate", () => {
            assertToJson(Schema.Date.check(Schema.isGreaterThanOrEqualToDate(new Date(0))), {
              schema: {
                _tag: "Declaration",
                annotations: { typeConstructor: { _tag: "Date" } },
                typeParameters: [],
                checks: [
                  {
                    _tag: "Filter",
                    meta: { _tag: "isGreaterThanOrEqualToDate", minimum: "1970-01-01T00:00:00.000Z" }
                  }
                ],
                Encoded: { _tag: "String", checks: [] }
              }
            })
          })

          it("isLessThanDate", () => {
            assertToJson(Schema.Date.check(Schema.isLessThanDate(new Date(0))), {
              schema: {
                _tag: "Declaration",
                annotations: { typeConstructor: { _tag: "Date" } },
                typeParameters: [],
                checks: [
                  {
                    _tag: "Filter",
                    meta: { _tag: "isLessThanDate", exclusiveMaximum: "1970-01-01T00:00:00.000Z" }
                  }
                ],
                Encoded: { _tag: "String", checks: [] }
              }
            })
          })

          it("isLessThanOrEqualToDate", () => {
            assertToJson(Schema.Date.check(Schema.isLessThanOrEqualToDate(new Date(0))), {
              schema: {
                _tag: "Declaration",
                annotations: { typeConstructor: { _tag: "Date" } },
                typeParameters: [],
                checks: [
                  {
                    _tag: "Filter",
                    meta: { _tag: "isLessThanOrEqualToDate", maximum: "1970-01-01T00:00:00.000Z" }
                  }
                ],
                Encoded: { _tag: "String", checks: [] }
              }
            })
          })

          it("isBetweenDate", () => {
            assertToJson(Schema.Date.check(Schema.isBetweenDate({ minimum: new Date(0), maximum: new Date(1) })), {
              schema: {
                _tag: "Declaration",
                annotations: { typeConstructor: { _tag: "Date" } },
                typeParameters: [],
                checks: [
                  {
                    _tag: "Filter",
                    meta: {
                      _tag: "isBetweenDate",
                      minimum: "1970-01-01T00:00:00.000Z",
                      maximum: "1970-01-01T00:00:00.001Z"
                    }
                  }
                ],
                Encoded: { _tag: "String", checks: [] }
              }
            })
          })
        })
      })

      it("URL", () => {
        assertToJson(Schema.URL, {
          schema: {
            _tag: "Declaration",
            annotations: { typeConstructor: { _tag: "URL" } },
            typeParameters: [],
            checks: [],
            Encoded: { _tag: "String", checks: [] }
          }
        })
      })

      it("Option(String)", () => {
        assertToJson(Schema.Option(Schema.String), {
          schema: {
            _tag: "Declaration",
            annotations: { typeConstructor: { _tag: "effect/Option" } },
            typeParameters: [
              { _tag: "String", checks: [] }
            ],
            checks: [],
            Encoded: {
              _tag: "Union",
              types: [
                {
                  _tag: "Objects",
                  propertySignatures: [
                    {
                      name: "_tag",
                      type: { _tag: "Literal", literal: "Some" },
                      isOptional: false,
                      isMutable: false
                    },
                    {
                      name: "value",
                      type: { _tag: "String", checks: [] },
                      isOptional: false,
                      isMutable: false
                    }
                  ],
                  indexSignatures: [],
                  checks: []
                },
                {
                  _tag: "Objects",
                  propertySignatures: [
                    {
                      name: "_tag",
                      type: { _tag: "Literal", literal: "None" },
                      isOptional: false,
                      isMutable: false
                    }
                  ],
                  indexSignatures: [],
                  checks: []
                }
              ],
              mode: "anyOf"
            }
          }
        })
      })
    })

    it("Any", () => {
      assertToJson(Schema.Any, { schema: { _tag: "Any" } })
      assertToJson(Schema.Any.annotate({ description: "a" }), {
        schema: { _tag: "Any", annotations: { description: "a" } }
      })
    })

    it("Unknown", () => {
      assertToJson(Schema.Unknown, { schema: { _tag: "Unknown" } })
      assertToJson(Schema.Unknown.annotate({ description: "a" }), {
        schema: { _tag: "Unknown", annotations: { description: "a" } }
      })
    })

    it("Null", () => {
      assertToJson(Schema.Null, { schema: { _tag: "Null" } })
      assertToJson(Schema.Null.annotate({ description: "a" }), {
        schema: { _tag: "Null", annotations: { description: "a" } }
      })
    })

    it("Undefined", () => {
      assertToJson(Schema.Undefined, { schema: { _tag: "Undefined" } })
      assertToJson(Schema.Undefined.annotate({ description: "a" }), {
        schema: { _tag: "Undefined", annotations: { description: "a" } }
      })
    })

    it("Void", () => {
      assertToJson(Schema.Void, { schema: { _tag: "Void" } })
      assertToJson(Schema.Void.annotate({ description: "a" }), {
        schema: { _tag: "Void", annotations: { description: "a" } }
      })
    })

    it("Never", () => {
      assertToJson(Schema.Never, { schema: { _tag: "Never" } })
      assertToJson(Schema.Never.annotate({ description: "a" }), {
        schema: { _tag: "Never", annotations: { description: "a" } }
      })
    })

    describe("String", () => {
      it("String", () => {
        assertToJson(Schema.String, { schema: { _tag: "String", checks: [] } })
        assertToJson(Schema.String.annotate({ description: "a" }), {
          schema: { _tag: "String", annotations: { "description": "a" }, checks: [] }
        })
      })

      describe("checks", () => {
        it("isMinLength", () => {
          assertToJson(Schema.String.check(Schema.isMinLength(1)), {
            schema: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 } }
              ]
            }
          })
          assertToJson(Schema.String.check(Schema.isMinLength(1, { description: "a" })), {
            schema: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 }, annotations: { description: "a" } }
              ]
            }
          })
        })

        it("isMaxLength", () => {
          assertToJson(Schema.String.check(Schema.isMaxLength(10)), {
            schema: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMaxLength", maxLength: 10 } }
              ]
            }
          })
          assertToJson(Schema.String.check(Schema.isMaxLength(10, { description: "a" })), {
            schema: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMaxLength", maxLength: 10 }, annotations: { description: "a" } }
              ]
            }
          })
        })

        it("isPattern", () => {
          assertToJson(Schema.String.check(Schema.isPattern(new RegExp("a"))), {
            schema: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isPattern", regExp: { source: "a", flags: "" } } }
              ]
            }
          })
          assertToJson(Schema.String.check(Schema.isPattern(new RegExp("a"), { description: "a" })), {
            schema: {
              _tag: "String",
              checks: [
                {
                  _tag: "Filter",
                  meta: { _tag: "isPattern", regExp: { source: "a", flags: "" } },
                  annotations: { description: "a" }
                }
              ]
            }
          })
        })

        it("isLength", () => {
          assertToJson(Schema.String.check(Schema.isLength(5)), {
            schema: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isLength", length: 5 } }
              ]
            }
          })
          assertToJson(Schema.String.check(Schema.isLength(5, { description: "a" })), {
            schema: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isLength", length: 5 }, annotations: { description: "a" } }
              ]
            }
          })
        })
      })

      it("contentSchema", () => {
        assertToJson(
          Schema.toEncoded(Schema.fromJsonString(Schema.Struct({ a: Schema.String }))),
          {
            schema: {
              _tag: "String",
              checks: [],
              contentMediaType: "application/json",
              contentSchema: {
                _tag: "Objects",
                propertySignatures: [{
                  name: "a",
                  type: { _tag: "String", checks: [] },
                  isOptional: false,
                  isMutable: false
                }],
                indexSignatures: [],
                checks: []
              }
            }
          }
        )
      })
    })

    describe("Number", () => {
      it("Number", () => {
        assertToJson(Schema.Number, { schema: { _tag: "Number", checks: [] } })
        assertToJson(Schema.Number.annotate({ description: "a" }), {
          schema: { _tag: "Number", annotations: { description: "a" }, checks: [] }
        })
      })

      describe("checks", () => {
        it("isInt", () => {
          assertToJson(Schema.Number.check(Schema.isInt()), {
            schema: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isInt" } }
              ]
            }
          })
        })

        it("isGreaterThanOrEqualTo", () => {
          assertToJson(Schema.Number.check(Schema.isGreaterThanOrEqualTo(10)), {
            schema: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isGreaterThanOrEqualTo", minimum: 10 } }
              ]
            }
          })
        })

        it("isLessThanOrEqualTo", () => {
          assertToJson(Schema.Number.check(Schema.isLessThanOrEqualTo(10)), {
            schema: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isLessThanOrEqualTo", maximum: 10 } }
              ]
            }
          })
        })

        it("isGreaterThan", () => {
          assertToJson(Schema.Number.check(Schema.isGreaterThan(10)), {
            schema: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isGreaterThan", exclusiveMinimum: 10 } }
              ]
            }
          })
        })

        it("isLessThan", () => {
          assertToJson(Schema.Number.check(Schema.isLessThan(10)), {
            schema: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isLessThan", exclusiveMaximum: 10 } }
              ]
            }
          })
        })

        it("isMultipleOf", () => {
          assertToJson(Schema.Number.check(Schema.isMultipleOf(10)), {
            schema: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMultipleOf", divisor: 10 } }
              ]
            }
          })
        })

        it("isBetween", () => {
          assertToJson(Schema.Number.check(Schema.isBetween({ minimum: 1, maximum: 10 })), {
            schema: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isBetween", minimum: 1, maximum: 10 } }
              ]
            }
          })
        })

        it("isInt32", () => {
          assertToJson(Schema.Number.check(Schema.isInt32()), {
            schema: {
              _tag: "Number",
              checks: [
                {
                  _tag: "FilterGroup",
                  checks: [
                    { _tag: "Filter", meta: { _tag: "isInt" } },
                    { _tag: "Filter", meta: { _tag: "isBetween", minimum: -2147483648, maximum: 2147483647 } }
                  ]
                }
              ]
            }
          })
        })

        it("isUint32", () => {
          assertToJson(Schema.Number.check(Schema.isUint32()), {
            schema: {
              _tag: "Number",
              checks: [
                {
                  _tag: "FilterGroup",
                  checks: [
                    { _tag: "Filter", meta: { _tag: "isInt" } },
                    {
                      _tag: "Filter",
                      meta: { _tag: "isBetween", minimum: 0, maximum: 4294967295 }
                    }
                  ]
                }
              ]
            }
          })
        })
      })
    })

    it("Boolean", () => {
      assertToJson(Schema.Boolean, { schema: { _tag: "Boolean" } })
      assertToJson(Schema.Boolean.annotate({ description: "a" }), {
        schema: { _tag: "Boolean", annotations: { description: "a" } }
      })
    })

    describe("BigInt", () => {
      it("BigInt", () => {
        assertToJson(Schema.BigInt, { schema: { _tag: "BigInt", checks: [] } })
        assertToJson(Schema.BigInt.annotate({ description: "a" }), {
          schema: { _tag: "BigInt", annotations: { description: "a" }, checks: [] }
        })
      })

      describe("checks", () => {
        it("isGreaterThanOrEqualTo", () => {
          assertToJson(Schema.BigInt.check(Schema.isGreaterThanOrEqualToBigInt(10n)), {
            schema: {
              _tag: "BigInt",
              checks: [
                { _tag: "Filter", meta: { _tag: "isGreaterThanOrEqualToBigInt", minimum: "10" } }
              ]
            }
          })
        })
      })
    })

    it("Symbol", () => {
      assertToJson(Schema.Symbol, { schema: { _tag: "Symbol" } })
      assertToJson(Schema.Symbol.annotate({ description: "a" }), {
        schema: { _tag: "Symbol", annotations: { description: "a" } }
      })
    })

    it("Literal", () => {
      assertToJson(Schema.Literal("hello"), { schema: { _tag: "Literal", literal: "hello" } })
      assertToJson(Schema.Literal("hello").annotate({ description: "a" }), {
        schema: { _tag: "Literal", annotations: { description: "a" }, literal: "hello" }
      })
    })

    it("UniqueSymbol", () => {
      assertToJson(Schema.UniqueSymbol(Symbol.for("test")), {
        schema: { _tag: "UniqueSymbol", symbol: `Symbol(test)` }
      })
      assertToJson(Schema.UniqueSymbol(Symbol.for("test")).annotate({ description: "a" }), {
        schema: { _tag: "UniqueSymbol", annotations: { description: "a" }, symbol: `Symbol(test)` }
      })
    })

    it("ObjectKeyword", () => {
      assertToJson(Schema.ObjectKeyword, { schema: { _tag: "ObjectKeyword" } })
      assertToJson(Schema.ObjectKeyword.annotate({ description: "a" }), {
        schema: { _tag: "ObjectKeyword", annotations: { description: "a" } }
      })
    })

    it("Enum", () => {
      assertToJson(Schema.Enum({ A: "a", B: "b" }), {
        schema: { _tag: "Enum", enums: [["A", "a"], ["B", "b"]] }
      })
      assertToJson(Schema.Enum({ A: "a", B: "b" }).annotate({ description: "a" }), {
        schema: { _tag: "Enum", annotations: { description: "a" }, enums: [["A", "a"], ["B", "b"]] }
      })
    })

    it("TemplateLiteral", () => {
      assertToJson(Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]), {
        schema: {
          _tag: "TemplateLiteral",
          parts: [
            { _tag: "String", checks: [] },
            {
              _tag: "Literal",
              literal: "-"
            },
            { _tag: "Number", checks: [] }
          ]
        }
      })
      assertToJson(
        Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]).annotate({ description: "a" }),
        {
          schema: {
            _tag: "TemplateLiteral",
            annotations: { description: "a" },
            parts: [
              { _tag: "String", checks: [] },
              { _tag: "Literal", literal: "-" },
              { _tag: "Number", checks: [] }
            ]
          }
        }
      )
    })

    describe("Tuple", () => {
      it("empty tuple", () => {
        assertToJson(Schema.Tuple([]), { schema: { _tag: "Arrays", elements: [], rest: [], checks: [] } })
        assertToJson(Schema.Tuple([]).annotate({ description: "a" }), {
          schema: { _tag: "Arrays", annotations: { description: "a" }, elements: [], rest: [], checks: [] }
        })
      })

      it("required element", () => {
        assertToJson(Schema.Tuple([Schema.String]), {
          schema: {
            _tag: "Arrays",
            elements: [{ isOptional: false, type: { _tag: "String", checks: [] } }],
            rest: [],
            checks: []
          }
        })
        const MyString = Schema.String.annotate({ identifier: "id" })
        assertToJson(Schema.Tuple([MyString, MyString]), {
          schema: {
            _tag: "Arrays",
            elements: [
              { isOptional: false, type: { _tag: "Reference", $ref: "id" } },
              { isOptional: false, type: { _tag: "Reference", $ref: "id" } }
            ],
            rest: [],
            checks: []
          },
          definitions: {
            id: {
              _tag: "String",
              annotations: { identifier: "id" },
              checks: []
            }
          }
        })
      })

      it("required element & annotateKey", () => {
        const MyString = Schema.String.annotate({ identifier: "id" })
        assertToJson(Schema.Tuple([MyString, MyString.annotateKey({ description: "b" })]), {
          schema: {
            _tag: "Arrays",
            elements: [
              {
                isOptional: false,
                type: { _tag: "Reference", $ref: "id" }
              },
              {
                isOptional: false,
                type: { _tag: "Reference", $ref: "id-1" },
                annotations: { description: "b" }
              }
            ],
            rest: [],
            checks: []
          },
          definitions: {
            id: {
              _tag: "String",
              annotations: { identifier: "id" },
              checks: []
            },
            "id-1": {
              _tag: "String",
              annotations: { identifier: "id" },
              checks: []
            }
          }
        })
      })
    })

    it("Array(String)", () => {
      assertToJson(Schema.Array(Schema.String), {
        schema: {
          _tag: "Arrays",
          elements: [],
          rest: [{ _tag: "String", checks: [] }],
          checks: []
        }
      })
    })

    it("TupleWithRest(Tuple([String]), [Number])", () => {
      assertToJson(Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]), {
        schema: {
          _tag: "Arrays",
          elements: [{ isOptional: false, type: { _tag: "String", checks: [] } }],
          rest: [{ _tag: "Number", checks: [] }],
          checks: []
        }
      })
    })

    describe("Struct", () => {
      it("empty struct", () => {
        assertToJson(Schema.Struct({}), {
          schema: {
            _tag: "Objects",
            propertySignatures: [],
            indexSignatures: [],
            checks: []
          }
        })
        assertToJson(Schema.Struct({}).annotate({ description: "a" }), {
          schema: {
            _tag: "Objects",
            annotations: { description: "a" },
            propertySignatures: [],
            indexSignatures: [],
            checks: []
          }
        })
      })

      it("properties", () => {
        assertToJson(
          Schema.Struct({
            a: Schema.String,
            b: Schema.mutableKey(Schema.String),
            c: Schema.optionalKey(Schema.String),
            d: Schema.mutableKey(Schema.optionalKey(Schema.String)),
            e: Schema.optionalKey(Schema.mutableKey(Schema.String))
          }),
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
                  isOptional: false,
                  isMutable: true
                },
                {
                  name: "c",
                  type: { _tag: "String", checks: [] },
                  isOptional: true,
                  isMutable: false
                },
                {
                  name: "d",
                  type: { _tag: "String", checks: [] },
                  isOptional: true,
                  isMutable: true
                },
                {
                  name: "e",
                  type: { _tag: "String", checks: [] },
                  isOptional: true,
                  isMutable: true
                }
              ],
              indexSignatures: [],
              checks: []
            }
          }
        )
      })

      it("annotateKey", () => {
        assertToJson(
          Schema.Struct({
            a: Schema.String.annotateKey({ description: "a" })
          }),
          {
            schema: {
              _tag: "Objects",
              propertySignatures: [
                {
                  name: "a",
                  type: { _tag: "String", checks: [] },
                  isOptional: false,
                  isMutable: false,
                  annotations: { description: "a" }
                }
              ],
              indexSignatures: [],
              checks: []
            }
          }
        )
      })

      it("symbol key", () => {
        assertToJson(Schema.Struct({ [Symbol.for("a")]: Schema.String }), {
          schema: {
            _tag: "Objects",
            propertySignatures: [{
              name: "Symbol(a)",
              type: { _tag: "String", checks: [] },
              isOptional: false,
              isMutable: false
            }],
            indexSignatures: [],
            checks: []
          }
        })
      })
    })

    it("Record(String, Number)", () => {
      assertToJson(Schema.Record(Schema.String, Schema.Number), {
        schema: {
          _tag: "Objects",
          propertySignatures: [],
          indexSignatures: [
            { parameter: { _tag: "String", checks: [] }, type: { _tag: "Number", checks: [] } }
          ],
          checks: []
        }
      })
    })

    it("RecordWithRest(Record(String, Number), [Symbol])", () => {
      assertToJson(
        Schema.StructWithRest(Schema.Struct({ a: Schema.Number }), [Schema.Record(Schema.String, Schema.Number)]),
        {
          schema: {
            _tag: "Objects",
            propertySignatures: [
              { name: "a", type: { _tag: "Number", checks: [] }, isOptional: false, isMutable: false }
            ],
            indexSignatures: [
              { parameter: { _tag: "String", checks: [] }, type: { _tag: "Number", checks: [] } }
            ],
            checks: []
          }
        }
      )
    })

    describe("Union", () => {
      it("anyOf", () => {
        assertToJson(Schema.Union([Schema.String, Schema.Number]), {
          schema: {
            _tag: "Union",
            types: [
              { _tag: "String", checks: [] },
              { _tag: "Number", checks: [] }
            ],
            mode: "anyOf"
          }
        })
        assertToJson(Schema.Union([Schema.String, Schema.Number]).annotate({ description: "a" }), {
          schema: {
            _tag: "Union",
            annotations: { description: "a" },
            types: [
              { _tag: "String", checks: [] },
              { _tag: "Number", checks: [] }
            ],
            mode: "anyOf"
          }
        })
      })

      it("oneOf", () => {
        assertToJson(Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" }), {
          schema: {
            _tag: "Union",
            types: [
              { _tag: "String", checks: [] },
              { _tag: "Number", checks: [] }
            ],
            mode: "oneOf"
          }
        })
      })

      it("Literals", () => {
        assertToJson(Schema.Literals(["a", 1]), {
          schema: {
            _tag: "Union",
            types: [
              { _tag: "Literal", literal: "a" },
              { _tag: "Literal", literal: 1 }
            ],
            mode: "anyOf"
          }
        })
      })
    })

    describe("Suspend", () => {
      it("non-recursive", () => {
        assertToJson(Schema.suspend(() => Schema.String), {
          schema: { _tag: "Suspend", checks: [], thunk: { _tag: "String", checks: [] } }
        })
        assertToJson(Schema.suspend(() => Schema.String.annotate({ identifier: "id" })), {
          schema: {
            _tag: "Suspend",
            checks: [],
            thunk: {
              _tag: "Reference",
              $ref: "id"
            }
          },
          definitions: {
            id: {
              _tag: "String",
              annotations: { identifier: "id" },
              checks: []
            }
          }
        })
      })

      it("does not treat reusing the same suspended thunk result as recursion", () => {
        const inner = Schema.Struct({ a: Schema.String }).annotate({ identifier: "inner" })
        const shared = Schema.suspend(() => inner)

        const schema = Schema.Union([shared, shared])

        assertToJson(schema, {
          schema: {
            _tag: "Union",
            mode: "anyOf",
            types: [
              { _tag: "Suspend", checks: [], thunk: { _tag: "Reference", $ref: "inner" } },
              { _tag: "Suspend", checks: [], thunk: { _tag: "Reference", $ref: "inner" } }
            ]
          },
          definitions: {
            inner: {
              _tag: "Objects",
              annotations: { identifier: "inner" },
              propertySignatures: [
                { name: "a", type: { _tag: "String", checks: [] }, isOptional: false, isMutable: false }
              ],
              indexSignatures: [],
              checks: []
            }
          }
        })
      })

      describe("recursive", () => {
        it("outer identifier", () => {
          assertToJson(OuterCategory, {
            schema: {
              _tag: "Reference",
              $ref: "Category"
            },
            definitions: {
              Category: {
                _tag: "Objects",
                annotations: { identifier: "Category" },
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
                        thunk: { _tag: "Reference", $ref: "Category" }
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
          })
        })

        it("inner identifier", () => {
          assertToJson(InnerCategory, {
            schema: {
              _tag: "Objects",
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
                    rest: [
                      { _tag: "Suspend", checks: [], thunk: { _tag: "Reference", $ref: "Category" } }
                    ],
                    checks: []
                  },
                  isOptional: false,
                  isMutable: false
                }
              ],
              indexSignatures: [],
              checks: []
            },
            definitions: {
              Category: {
                _tag: "Objects",
                annotations: { identifier: "Category" },
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
                      rest: [
                        { _tag: "Suspend", checks: [], thunk: { _tag: "Reference", $ref: "Category" } }
                      ],
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
          })
        })
      })
    })
  })

  describe("toJsonSchemaMultiDocument", () => {
    it("should handle multiple schemas", () => {
      const a = Schema.String.annotate({ identifier: "id", description: "a" })
      const b = a.annotate({ description: "b" })
      const multiDocument = SchemaStandard.fromASTs([a.ast, b.ast])
      const jsonMultiDocument = SchemaStandard.toJsonSchemaMultiDocument(multiDocument)
      deepStrictEqual(jsonMultiDocument, {
        source: "draft-2020-12",
        schemas: [
          { "$ref": "#/$defs/id" },
          { "$ref": "#/$defs/id-1" }
        ],
        definitions: {
          "id": {
            "type": "string",
            "description": "a"
          },
          "id-1": {
            "type": "string",
            "description": "b"
          }
        }
      })
    })
  })

  describe("fromASTs", () => {
    it("should handle multiple schemas", () => {
      const a = Schema.String.annotate({ identifier: "id", description: "a" })
      const b = a.annotate({ description: "b" })
      const multiDocument = SchemaStandard.fromASTs([a.ast, b.ast])
      deepStrictEqual(multiDocument, {
        schemas: [
          { _tag: "Reference", $ref: "id" },
          { _tag: "Reference", $ref: "id-1" }
        ],
        definitions: {
          "id": { _tag: "String", checks: [], annotations: { identifier: "id", description: "a" } },
          "id-1": { _tag: "String", checks: [], annotations: { identifier: "id", description: "b" } }
        }
      })
    })
  })

  describe("fromAST", () => {
    function assertFromAST(schema: Schema.Top, expected: SchemaStandard.Document) {
      const document = SchemaStandard.fromAST(schema.ast)
      deepStrictEqual(document, expected)
    }

    it("String", () => {
      assertFromAST(Schema.String, {
        schema: {
          _tag: "String",
          checks: []
        },
        definitions: {}
      })
    })

    it("String & brand", () => {
      assertFromAST(Schema.String.pipe(Schema.brand("a")), {
        schema: {
          _tag: "String",
          checks: [],
          annotations: { brands: ["a"] }
        },
        definitions: {}
      })
    })

    it("String & brand & brand", () => {
      assertFromAST(Schema.String.pipe(Schema.brand("a"), Schema.brand("b")), {
        schema: {
          _tag: "String",
          checks: [],
          annotations: { brands: ["a", "b"] }
        },
        definitions: {}
      })
    })

    describe("identifier handling", () => {
      it("should throw if there is a suspended schema without an identifier", () => {
        const schema = Schema.Struct({
          name: Schema.String,
          children: Schema.Array(Schema.suspend((): Schema.Codec<Category> => schema))
        })
        throws(() => SchemaStandard.fromAST(schema.ast), "Suspended schema without identifier")
      })

      it("should handle suspended schemas with duplicate identifiers", () => {
        type Category2 = {
          readonly name: number
          readonly children: ReadonlyArray<Category2>
        }

        const OuterCategory2 = Schema.Struct({
          name: Schema.Number,
          children: Schema.Array(Schema.suspend((): Schema.Codec<Category2> => OuterCategory2))
        }).annotate({ identifier: "Category" })

        const schema = Schema.Tuple([OuterCategory, OuterCategory2])
        assertFromAST(schema, {
          schema: {
            _tag: "Arrays",
            elements: [
              {
                isOptional: false,
                type: { _tag: "Reference", $ref: "Category" }
              },
              {
                isOptional: false,
                type: { _tag: "Reference", $ref: "Category-1" }
              }
            ],
            rest: [],
            checks: []
          },
          definitions: {
            Category: {
              _tag: "Objects",
              annotations: { identifier: "Category" },
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
                    rest: [
                      {
                        _tag: "Suspend",
                        checks: [],
                        thunk: { _tag: "Reference", $ref: "Category" }
                      }
                    ],
                    checks: []
                  },
                  isOptional: false,
                  isMutable: false
                }
              ],
              indexSignatures: [],
              checks: []
            },
            "Category-1": {
              _tag: "Objects",
              annotations: { identifier: "Category" },
              propertySignatures: [
                {
                  name: "name",
                  type: { _tag: "Number", checks: [] },
                  isOptional: false,
                  isMutable: false
                },
                {
                  name: "children",
                  type: {
                    _tag: "Arrays",
                    elements: [],
                    rest: [
                      {
                        _tag: "Suspend",
                        checks: [],
                        thunk: { _tag: "Reference", $ref: "Category-1" }
                      }
                    ],
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
        })
      })

      it("should handle duplicate identifiers", () => {
        assertFromAST(
          Schema.Tuple([
            Schema.String.annotate({ identifier: "ID", description: "a" }),
            Schema.String.annotate({ identifier: "ID", description: "b" })
          ]),
          {
            schema: {
              _tag: "Arrays",
              elements: [
                {
                  isOptional: false,
                  type: { _tag: "Reference", $ref: "ID" }
                },
                {
                  isOptional: false,
                  type: { _tag: "Reference", $ref: "ID-1" }
                }
              ],
              rest: [],
              checks: []
            },
            definitions: {
              "ID": { _tag: "String", checks: [], annotations: { identifier: "ID", description: "a" } },
              "ID-1": { _tag: "String", checks: [], annotations: { identifier: "ID", description: "b" } }
            }
          }
        )
      })

      it("String & identifier", () => {
        assertFromAST(Schema.String.annotate({ identifier: "ID" }), {
          schema: {
            _tag: "Reference",
            $ref: "ID"
          },
          definitions: {
            "ID": {
              _tag: "String",
              checks: [],
              annotations: { identifier: "ID" }
            }
          }
        })
      })

      it("String& identifier & encoding ", () => {
        assertFromAST(
          Schema.String.annotate({ identifier: "ID" }).pipe(Schema.encodeTo(Schema.Literal("a"))),
          {
            schema: {
              _tag: "Literal",
              literal: "a"
            },
            definitions: {}
          }
        )
      })

      it("Tuple(ID, ID)", () => {
        const ID = Schema.String.annotate({ identifier: "ID" })
        assertFromAST(Schema.Tuple([ID, ID]), {
          schema: {
            _tag: "Arrays",
            elements: [
              {
                isOptional: false,
                type: { _tag: "Reference", $ref: "ID" }
              },
              {
                isOptional: false,
                type: { _tag: "Reference", $ref: "ID" }
              }
            ],
            rest: [],
            checks: []
          },
          definitions: {
            "ID": { _tag: "String", checks: [], annotations: { identifier: "ID" } }
          }
        })
      })

      it("Tuple(ID, ID & description)", () => {
        const ID = Schema.String.annotate({ identifier: "ID" })
        assertFromAST(Schema.Tuple([ID, ID.annotate({ description: "a" })]), {
          schema: {
            _tag: "Arrays",
            elements: [
              {
                isOptional: false,
                type: { _tag: "Reference", $ref: "ID" }
              },
              {
                isOptional: false,
                type: { _tag: "Reference", $ref: "ID-1" }
              }
            ],
            rest: [],
            checks: []
          },
          definitions: {
            "ID": { _tag: "String", checks: [], annotations: { identifier: "ID" } },
            "ID-1": { _tag: "String", checks: [], annotations: { identifier: "ID", description: "a" } }
          }
        })
      })
    })
  })

  describe("toCode", () => {
    function assertToCode(schema: Schema.Top, expected: string, reviver?: SchemaStandard.Reviver<string>) {
      const document = SchemaStandard.fromAST(schema.ast)
      strictEqual(SchemaStandard.toCode(document, { reviver }), expected)
    }

    describe("Suspend", () => {
      it("non-recursive", () => {
        assertToCode(
          Schema.suspend(() => Schema.String),
          `Schema.suspend(() => Schema.String)`
        )
        assertToCode(
          Schema.suspend(() => Schema.String.annotate({ identifier: "ID" })),
          `Schema.suspend((): Schema.Codec<ID> => ID)`
        )
      })

      describe("recursive", () => {
        it("outer identifier", () => {
          assertToCode(
            OuterCategory,
            `Schema.Struct({ "name": Schema.String, "children": Schema.Array(Schema.suspend((): Schema.Codec<Category> => Category)) }).annotate({ "identifier": "Category" })`
          )
        })

        it("inner identifier", () => {
          assertToCode(
            InnerCategory,
            `Schema.Struct({ "name": Schema.String, "children": Schema.Array(Schema.suspend((): Schema.Codec<Category> => Category)) })`
          )
        })
      })
    })

    describe("Declaration", () => {
      it("Option(String)", () => {
        assertToCode(Schema.Option(Schema.String), "Schema.Option(Schema.String)")
      })

      it("declaration without typeConstructor annotation", () => {
        assertToCode(Schema.instanceOf(URL), "Schema.Unknown")
      })
    })

    it("Null", () => {
      assertToCode(Schema.Null, "Schema.Null")
      assertToCode(Schema.Null.annotate({ "description": "a" }), `Schema.Null.annotate({ "description": "a" })`)
      assertToCode(Schema.Null.annotate({}), "Schema.Null")
    })

    it("Undefined", () => {
      assertToCode(Schema.Undefined, "Schema.Undefined")
      assertToCode(
        Schema.Undefined.annotate({ "description": "a" }),
        `Schema.Undefined.annotate({ "description": "a" })`
      )
    })

    it("Void", () => {
      assertToCode(Schema.Void, "Schema.Void")
      assertToCode(Schema.Void.annotate({ "description": "a" }), `Schema.Void.annotate({ "description": "a" })`)
    })

    it("Never", () => {
      assertToCode(Schema.Never, "Schema.Never")
      assertToCode(Schema.Never.annotate({ "description": "a" }), `Schema.Never.annotate({ "description": "a" })`)
    })

    it("Unknown", () => {
      assertToCode(Schema.Unknown, "Schema.Unknown")
      assertToCode(Schema.Unknown.annotate({ "description": "a" }), `Schema.Unknown.annotate({ "description": "a" })`)
    })

    it("Any", () => {
      assertToCode(Schema.Any, "Schema.Any")
      assertToCode(Schema.Any.annotate({ "description": "a" }), `Schema.Any.annotate({ "description": "a" })`)
    })

    describe("String", () => {
      it("String", () => {
        assertToCode(Schema.String, "Schema.String")
      })

      it("String & annotations", () => {
        assertToCode(Schema.String.annotate({ "description": "a" }), `Schema.String.annotate({ "description": "a" })`)
      })

      it("String & check", () => {
        assertToCode(Schema.String.check(Schema.isMinLength(1)), "Schema.String.check(Schema.isMinLength(1))")
      })

      it("String & annotations & check", () => {
        assertToCode(
          Schema.String.annotate({ "description": "a" }).check(Schema.isMinLength(1)),
          `Schema.String.annotate({ "description": "a" }).check(Schema.isMinLength(1))`
        )
      })

      it("String & check & annotations", () => {
        assertToCode(
          Schema.String.check(Schema.isMinLength(1, { description: "a" })),
          `Schema.String.check(Schema.isMinLength(1, { "description": "a" }))`
        )
      })
    })

    it("Number", () => {
      assertToCode(Schema.Number, "Schema.Number")
      assertToCode(Schema.Number.annotate({ "description": "a" }), `Schema.Number.annotate({ "description": "a" })`)
    })

    it("Boolean", () => {
      assertToCode(Schema.Boolean, "Schema.Boolean")
      assertToCode(Schema.Boolean.annotate({ "description": "a" }), `Schema.Boolean.annotate({ "description": "a" })`)
    })

    it("BigInt", () => {
      assertToCode(Schema.BigInt, "Schema.BigInt")
      assertToCode(Schema.BigInt.annotate({ "description": "a" }), `Schema.BigInt.annotate({ "description": "a" })`)
    })

    it("Symbol", () => {
      assertToCode(Schema.Symbol, "Schema.Symbol")
      assertToCode(Schema.Symbol.annotate({ "description": "a" }), `Schema.Symbol.annotate({ "description": "a" })`)
    })

    it("ObjectKeyword", () => {
      assertToCode(Schema.ObjectKeyword, "Schema.ObjectKeyword")
      assertToCode(
        Schema.ObjectKeyword.annotate({ "description": "a" }),
        `Schema.ObjectKeyword.annotate({ "description": "a" })`
      )
    })

    describe("Literal", () => {
      it("string literal", () => {
        assertToCode(Schema.Literal("hello"), `Schema.Literal("hello")`)
        assertToCode(
          Schema.Literal("hello").annotate({ "description": "a" }),
          `Schema.Literal("hello").annotate({ "description": "a" })`
        )
      })

      it("number literal", () => {
        assertToCode(Schema.Literal(42), "Schema.Literal(42)")
        assertToCode(
          Schema.Literal(42).annotate({ "description": "a" }),
          `Schema.Literal(42).annotate({ "description": "a" })`
        )
      })

      it("boolean literal", () => {
        assertToCode(Schema.Literal(true), "Schema.Literal(true)")
        assertToCode(
          Schema.Literal(true).annotate({ "description": "a" }),
          `Schema.Literal(true).annotate({ "description": "a" })`
        )
      })

      it("bigint literal", () => {
        assertToCode(Schema.Literal(100n), "Schema.Literal(100n)")
        assertToCode(
          Schema.Literal(100n).annotate({ "description": "a" }),
          `Schema.Literal(100n).annotate({ "description": "a" })`
        )
      })
    })

    describe("UniqueSymbol", () => {
      it("should format unique symbol", () => {
        assertToCode(Schema.UniqueSymbol(Symbol.for("test")), `Schema.UniqueSymbol(Symbol.for("test"))`)
      })

      it("should throw error for symbol created without Symbol.for()", () => {
        const sym = Symbol("test")
        const document = SchemaStandard.fromAST(Schema.UniqueSymbol(sym).ast)
        throws(
          () => SchemaStandard.toCode(document),
          "Cannot generate code for UniqueSymbol created without Symbol.for()"
        )
      })
    })

    describe("Enum", () => {
      it("should format enum with string values", () => {
        assertToCode(
          Schema.Enum({
            A: "a",
            B: "b"
          }),
          `Schema.Enum([["A", "a"], ["B", "b"]])`
        )
        assertToCode(
          Schema.Enum({
            A: "a",
            B: "b"
          }).annotate({ "description": "q" }),
          `Schema.Enum([["A", "a"], ["B", "b"]]).annotate({ "description": "q" })`
        )
      })

      it("should format enum with number values", () => {
        assertToCode(
          Schema.Enum({
            One: 1,
            Two: 2
          }),
          `Schema.Enum([["One", 1], ["Two", 2]])`
        )
        assertToCode(
          Schema.Enum({
            One: 1,
            Two: 2
          }).annotate({ "description": "r" }),
          `Schema.Enum([["One", 1], ["Two", 2]]).annotate({ "description": "r" })`
        )
      })

      it("should format enum with mixed values", () => {
        assertToCode(
          Schema.Enum({
            A: "a",
            One: 1
          }),
          `Schema.Enum([["A", "a"], ["One", 1]])`
        )
        assertToCode(
          Schema.Enum({
            A: "a",
            One: 1
          }).annotate({ "description": "s" }),
          `Schema.Enum([["A", "a"], ["One", 1]]).annotate({ "description": "s" })`
        )
      })
    })

    describe("TemplateLiteral", () => {
      it("should format template literal", () => {
        assertToCode(
          Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]),
          `Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number])`
        )
        assertToCode(
          Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]).annotate({ "description": "ad" }),
          `Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]).annotate({ "description": "ad" })`
        )
      })
    })

    describe("Arrays", () => {
      it("empty tuple", () => {
        assertToCode(Schema.Tuple([]), "Schema.Tuple([])")
        assertToCode(
          Schema.Tuple([]).annotate({ "description": "t" }),
          `Schema.Tuple([]).annotate({ "description": "t" })`
        )
      })

      it("tuple with elements", () => {
        assertToCode(
          Schema.Tuple([Schema.String, Schema.Number]),
          "Schema.Tuple([Schema.String, Schema.Number])"
        )
        assertToCode(
          Schema.Tuple([Schema.String, Schema.Number]).annotate({ "description": "u" }),
          `Schema.Tuple([Schema.String, Schema.Number]).annotate({ "description": "u" })`
        )
      })

      it("array with rest only", () => {
        assertToCode(Schema.Array(Schema.String), "Schema.Array(Schema.String)")
        assertToCode(
          Schema.Array(Schema.String).annotate({ "description": "v" }),
          `Schema.Array(Schema.String).annotate({ "description": "v" })`
        )
      })

      it("tuple with rest", () => {
        assertToCode(
          Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]),
          "Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number])"
        )
        assertToCode(
          Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]).annotate({ "description": "w" }),
          `Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]).annotate({ "description": "w" })`
        )
      })
    })

    describe("Objects", () => {
      it("empty struct", () => {
        assertToCode(Schema.Struct({}), "Schema.Struct({  })")
        assertToCode(
          Schema.Struct({}).annotate({ "description": "x" }),
          `Schema.Struct({  }).annotate({ "description": "x" })`
        )
      })

      it("struct with required properties", () => {
        assertToCode(
          Schema.Struct({
            name: Schema.String,
            age: Schema.Number
          }),
          `Schema.Struct({ "name": Schema.String, "age": Schema.Number })`
        )
        assertToCode(
          Schema.Struct({
            name: Schema.String,
            age: Schema.Number
          }).annotate({ "description": "y" }),
          `Schema.Struct({ "name": Schema.String, "age": Schema.Number }).annotate({ "description": "y" })`
        )
      })

      it("struct with optional properties", () => {
        assertToCode(
          Schema.Struct({
            name: Schema.String,
            age: Schema.optionalKey(Schema.Number)
          }),
          `Schema.Struct({ "name": Schema.String, "age": Schema.optionalKey(Schema.Number) })`
        )
      })

      it("struct with mixed required and optional properties", () => {
        assertToCode(
          Schema.Struct({
            name: Schema.String,
            age: Schema.optionalKey(Schema.Number),
            active: Schema.Boolean
          }),
          `Schema.Struct({ "name": Schema.String, "age": Schema.optionalKey(Schema.Number), "active": Schema.Boolean })`
        )
      })

      it("struct with symbol property key", () => {
        const sym = Symbol.for("test")
        assertToCode(
          Schema.Struct({
            [sym]: Schema.String
          }),
          `Schema.Struct({ ${String(sym)}: Schema.String })`
        )
      })
    })

    describe("Union", () => {
      it("union with anyOf mode (default)", () => {
        assertToCode(
          Schema.Union([Schema.String, Schema.Number]),
          "Schema.Union([Schema.String, Schema.Number])"
        )
        assertToCode(
          Schema.Union([Schema.String, Schema.Number]).annotate({ "description": "z" }),
          `Schema.Union([Schema.String, Schema.Number]).annotate({ "description": "z" })`
        )
      })

      it("union with oneOf mode", () => {
        assertToCode(
          Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" }),
          `Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" })`
        )
        assertToCode(
          Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" }).annotate({ "description": "aa" }),
          `Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" }).annotate({ "description": "aa" })`
        )
      })

      it("union with multiple types", () => {
        assertToCode(
          Schema.Union([Schema.String, Schema.Number, Schema.Boolean]),
          "Schema.Union([Schema.String, Schema.Number, Schema.Boolean])"
        )
        assertToCode(
          Schema.Union([Schema.String, Schema.Number, Schema.Boolean]).annotate({ "description": "ab" }),
          `Schema.Union([Schema.String, Schema.Number, Schema.Boolean]).annotate({ "description": "ab" })`
        )
      })
    })

    describe("nested structures", () => {
      it("nested struct", () => {
        assertToCode(
          Schema.Struct({
            user: Schema.Struct({
              name: Schema.String,
              age: Schema.Number
            })
          }),
          `Schema.Struct({ "user": Schema.Struct({ "name": Schema.String, "age": Schema.Number }) })`
        )
        assertToCode(
          Schema.Struct({
            user: Schema.Struct({
              name: Schema.String,
              age: Schema.Number
            })
          }).annotate({ "description": "ac" }),
          `Schema.Struct({ "user": Schema.Struct({ "name": Schema.String, "age": Schema.Number }) }).annotate({ "description": "ac" })`
        )
      })

      it("union of structs", () => {
        assertToCode(
          Schema.Union([
            Schema.Struct({ type: Schema.Literal("a"), value: Schema.String }),
            Schema.Struct({ type: Schema.Literal("b"), value: Schema.Number })
          ]),
          `Schema.Union([Schema.Struct({ "type": Schema.Literal("a"), "value": Schema.String }), Schema.Struct({ "type": Schema.Literal("b"), "value": Schema.Number })])`
        )
      })

      it("tuple with struct elements", () => {
        assertToCode(
          Schema.Tuple([
            Schema.Struct({ name: Schema.String }),
            Schema.Struct({ age: Schema.Number })
          ]),
          `Schema.Tuple([Schema.Struct({ "name": Schema.String }), Schema.Struct({ "age": Schema.Number })])`
        )
      })
    })
  })

  describe("toSchema", () => {
    function assertToSchema(schema: Schema.Top) {
      const document = SchemaStandard.fromAST(schema.ast)
      deepStrictEqual(SchemaStandard.fromAST(SchemaStandard.toSchema(document).ast), document)
    }

    it("String", () => {
      assertToSchema(Schema.String)
    })

    it("Struct", () => {
      assertToSchema(Schema.Struct({}))
      assertToSchema(Schema.Struct({ a: Schema.String }))
      assertToSchema(Schema.Struct({ [Symbol.for("a")]: Schema.String }))
      assertToSchema(Schema.Struct({ a: Schema.optionalKey(Schema.String) }))
      assertToSchema(Schema.Struct({ a: Schema.mutableKey(Schema.String) }))
      assertToSchema(Schema.Struct({ a: Schema.optionalKey(Schema.mutableKey(Schema.String)) }))
    })

    it("Record", () => {
      assertToSchema(Schema.Record(Schema.String, Schema.Number))
      assertToSchema(Schema.Record(Schema.Symbol, Schema.Number))
    })

    it("StructWithRest", () => {
      assertToSchema(
        Schema.StructWithRest(Schema.Struct({ a: Schema.String }), [Schema.Record(Schema.String, Schema.Number)])
      )
    })

    it("Tuple", () => {
      assertToSchema(Schema.Tuple([]))
      assertToSchema(Schema.Tuple([Schema.String, Schema.Number]))
      assertToSchema(Schema.Tuple([Schema.String, Schema.optionalKey(Schema.Number)]))
    })

    it("Array", () => {
      assertToSchema(Schema.Array(Schema.String))
    })

    it("TupleWithRest", () => {
      assertToSchema(Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]))
      assertToSchema(Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number, Schema.Boolean]))
    })

    it("Suspend", () => {
      assertToSchema(OuterCategory)
    })
  })
})
