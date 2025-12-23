import type { JsonSchema } from "effect"
import { Schema, SchemaStandard } from "effect"
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

function assertToCode(schema: Schema.Top, expected: string, reviver?: SchemaStandard.Reviver<string>) {
  const document = SchemaStandard.fromAST(schema.ast)
  strictEqual(SchemaStandard.toCode(document, { reviver }), expected)
}

function assertJsonSchemaRoundtrip(schema: Schema.Top, expected: string, reviver?: SchemaStandard.Reviver<string>) {
  const document = SchemaStandard.fromAST(schema.ast)
  const toJsonSchema = SchemaStandard.toJsonSchemaDocument(document)
  const decodedDocument = SchemaStandard.fromJsonSchema(toJsonSchema)
  const code = SchemaStandard.toCode(decodedDocument, { reviver })
  strictEqual(code, expected)
  const decodedSchema = SchemaStandard.toSchema(decodedDocument)
  deepStrictEqual(SchemaStandard.toJsonSchemaDocument(SchemaStandard.fromAST(decodedSchema.ast)), toJsonSchema)
}

function assertStandardDocument(schema: Schema.Top, expected: SchemaStandard.Document) {
  const document = SchemaStandard.fromAST(schema.ast)
  deepStrictEqual(document, expected)
}

describe("Standard", () => {
  describe("standardToJsonSchemaMultiDocument", () => {
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
    it("should throw if there is a suspended schema without an identifier", () => {
      const schema = Schema.Struct({
        name: Schema.String,
        children: Schema.Array(Schema.suspend((): Schema.Codec<Category> => schema))
      })
      throws(() => SchemaStandard.fromAST(schema.ast), "Suspended schema without identifier")
    })

    it("should throw if there are suspended schemas with duplicate identifiers", () => {
      type Category2 = {
        readonly name: number
        readonly children: ReadonlyArray<Category2>
      }

      const OuterCategory2 = Schema.Struct({
        name: Schema.Number,
        children: Schema.Array(Schema.suspend((): Schema.Codec<Category2> => OuterCategory2))
      }).annotate({ identifier: "Category" })

      const schema = Schema.Tuple([OuterCategory, OuterCategory2])
      assertStandardDocument(schema, {
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

    it("duplicate identifier", () => {
      assertStandardDocument(
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

    it("String", () => {
      assertStandardDocument(Schema.String, {
        schema: {
          _tag: "String",
          checks: []
        },
        definitions: {}
      })
    })

    it("String & identifier", () => {
      assertStandardDocument(Schema.String.annotate({ identifier: "ID" }), {
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
      assertStandardDocument(Schema.String.annotate({ identifier: "ID" }).pipe(Schema.encodeTo(Schema.Literal("a"))), {
        schema: {
          _tag: "Literal",
          literal: "a"
        },
        definitions: {}
      })
    })

    it("Tuple(ID, ID)", () => {
      const ID = Schema.String.annotate({ identifier: "ID" })
      assertStandardDocument(Schema.Tuple([ID, ID]), {
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
      assertStandardDocument(Schema.Tuple([ID, ID.annotate({ description: "a" })]), {
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

  describe("Json Schema Roundtrip", () => {
    it("Unknown", () => {
      assertJsonSchemaRoundtrip(Schema.Unknown, "Schema.Unknown")
      assertJsonSchemaRoundtrip(
        Schema.Unknown.annotate({ description: "a" }),
        `Schema.Unknown.annotate({ "description": "a" })`
      )
    })

    it("Null", () => {
      assertJsonSchemaRoundtrip(Schema.Null, "Schema.Null")
      assertJsonSchemaRoundtrip(
        Schema.Null.annotate({ description: "a" }),
        `Schema.Null.annotate({ "description": "a" })`
      )
    })

    describe("String", () => {
      it("String", () => {
        assertJsonSchemaRoundtrip(Schema.String, "Schema.String")
        assertJsonSchemaRoundtrip(
          Schema.String.annotate({ description: "a" }),
          `Schema.String.annotate({ "description": "a" })`
        )
      })

      describe("checks", () => {
        it("isMinLength", () => {
          assertJsonSchemaRoundtrip(
            Schema.String.check(Schema.isMinLength(10)),
            `Schema.String.check(Schema.isMinLength(10))`
          )
          assertJsonSchemaRoundtrip(
            Schema.String.check(Schema.isMinLength(10, { description: "a" })),
            `Schema.String.check(Schema.isMinLength(10, { "description": "a" }))`
          )
        })

        it("isMaxLength", () => {
          assertJsonSchemaRoundtrip(
            Schema.String.check(Schema.isMaxLength(10)),
            `Schema.String.check(Schema.isMaxLength(10))`
          )
          assertJsonSchemaRoundtrip(
            Schema.String.check(Schema.isMaxLength(10, { description: "a" })),
            `Schema.String.check(Schema.isMaxLength(10, { "description": "a" }))`
          )
        })

        it("isPattern", () => {
          assertJsonSchemaRoundtrip(
            Schema.String.check(Schema.isPattern(new RegExp("a"))),
            `Schema.String.check(Schema.isPattern(new RegExp("a", "")))`
          )
          assertJsonSchemaRoundtrip(
            Schema.String.check(Schema.isPattern(new RegExp("a"), { description: "a" })),
            `Schema.String.check(Schema.isPattern(new RegExp("a", ""), { "description": "a" }))`
          )
        })

        it("isLength", () => {
          assertJsonSchemaRoundtrip(
            Schema.String.check(Schema.isLength(10)),
            `Schema.String.check(Schema.isMinLength(10), Schema.isMaxLength(10))`
          )
          // assertJsonSchemaRoundtrip(
          //   Schema.String.check(Schema.isLength(10, { description: "a" })),
          //   `Schema.String.check(Schema.isMinLength(10), Schema.isMaxLength(10), { "description": "a" })`
          // )
        })
      })
    })

    describe("Number", () => {
      it("Number", () => {
        assertJsonSchemaRoundtrip(Schema.Number, "Schema.Number")
        assertJsonSchemaRoundtrip(
          Schema.Number.annotate({ description: "a" }),
          `Schema.Number.annotate({ "description": "a" })`
        )
      })

      describe("checks", () => {
        it("isGreaterThan", () => {
          assertJsonSchemaRoundtrip(
            Schema.Number.check(Schema.isGreaterThan(10)),
            `Schema.Number.check(Schema.isGreaterThan(10))`
          )
          assertJsonSchemaRoundtrip(
            Schema.Number.check(Schema.isGreaterThan(10, { description: "a" })),
            `Schema.Number.check(Schema.isGreaterThan(10, { "description": "a" }))`
          )
        })

        it("isGreaterThanOrEqualTo", () => {
          assertJsonSchemaRoundtrip(
            Schema.Number.check(Schema.isGreaterThanOrEqualTo(10)),
            `Schema.Number.check(Schema.isGreaterThanOrEqualTo(10))`
          )
          assertJsonSchemaRoundtrip(
            Schema.Number.check(Schema.isGreaterThanOrEqualTo(10, { description: "a" })),
            `Schema.Number.check(Schema.isGreaterThanOrEqualTo(10, { "description": "a" }))`
          )
        })

        it("isLessThan", () => {
          assertJsonSchemaRoundtrip(
            Schema.Number.check(Schema.isLessThan(10)),
            `Schema.Number.check(Schema.isLessThan(10))`
          )
          assertJsonSchemaRoundtrip(
            Schema.Number.check(Schema.isLessThan(10, { description: "a" })),
            `Schema.Number.check(Schema.isLessThan(10, { "description": "a" }))`
          )
        })

        it("isLessThanOrEqualTo", () => {
          assertJsonSchemaRoundtrip(
            Schema.Number.check(Schema.isLessThanOrEqualTo(10)),
            `Schema.Number.check(Schema.isLessThanOrEqualTo(10))`
          )
          assertJsonSchemaRoundtrip(
            Schema.Number.check(Schema.isLessThanOrEqualTo(10, { description: "a" })),
            `Schema.Number.check(Schema.isLessThanOrEqualTo(10, { "description": "a" }))`
          )
        })

        it("isMultipleOf", () => {
          assertJsonSchemaRoundtrip(
            Schema.Number.check(Schema.isMultipleOf(10)),
            `Schema.Number.check(Schema.isMultipleOf(10))`
          )
          assertJsonSchemaRoundtrip(
            Schema.Number.check(Schema.isMultipleOf(10, { description: "a" })),
            `Schema.Number.check(Schema.isMultipleOf(10, { "description": "a" }))`
          )
        })
      })
    })

    it("Boolean", () => {
      assertJsonSchemaRoundtrip(Schema.Boolean, "Schema.Boolean")
      assertJsonSchemaRoundtrip(
        Schema.Boolean.annotate({ description: "a" }),
        `Schema.Boolean.annotate({ "description": "a" })`
      )
    })

    it("Literals", () => {
      assertJsonSchemaRoundtrip(
        Schema.Literal("a"),
        `Schema.Literal("a")`
      )
      assertJsonSchemaRoundtrip(
        Schema.Literals(["a", "b"]),
        `Schema.Literals(["a", "b"])`
      )
    })

    describe("Struct", () => {
      it("required property", () => {
        assertJsonSchemaRoundtrip(
          Schema.Struct({ a: Schema.String }),
          `Schema.Struct({ "a": Schema.String })`
        )
      })

      it("optionalKey", () => {
        assertJsonSchemaRoundtrip(
          Schema.Struct({ a: Schema.optionalKey(Schema.String) }),
          `Schema.Struct({ "a": Schema.optionalKey(Schema.String) })`
        )
      })

      it("optional", () => {
        assertJsonSchemaRoundtrip(
          Schema.Struct({ a: Schema.optional(Schema.String) }),
          `Schema.Struct({ "a": Schema.optionalKey(Schema.Union([Schema.String, Schema.Null])) })`
        )
      })

      it("property with Undefined", () => {
        assertJsonSchemaRoundtrip(
          Schema.Struct({ a: Schema.UndefinedOr(Schema.String) }),
          `Schema.Struct({ "a": Schema.Union([Schema.String, Schema.Null]) })`
        )
      })
    })

    describe("Record", () => {
      it("Record(String, Number)", () => {
        assertJsonSchemaRoundtrip(
          Schema.Record(Schema.String, Schema.Number),
          `Schema.Record(Schema.String, Schema.Number)`
        )
      })

      it("Record(Literals(['a', 'b']), Number)", () => {
        assertJsonSchemaRoundtrip(
          Schema.Record(Schema.Literals(["a", "b"]), Schema.Number),
          `Schema.Struct({ "a": Schema.Number, "b": Schema.Number })`
        )
      })
    })

    describe("Tuple", () => {
      it("empty", () => {
        assertJsonSchemaRoundtrip(
          Schema.Tuple([]),
          `Schema.Tuple([])`
        )
      })

      it.todo("required element", () => {
        assertJsonSchemaRoundtrip(
          Schema.Tuple([Schema.String, Schema.Number]),
          `Schema.Tuple([Schema.String, Schema.Number])`
        )
      })

      it.todo("optionalKey", () => {
        assertJsonSchemaRoundtrip(
          Schema.Tuple([Schema.String, Schema.optionalKey(Schema.Number)]),
          `Schema.Tuple([Schema.String, Schema.optionalKey(Schema.Number)])`
        )
      })

      it.todo("optional", () => {
        assertJsonSchemaRoundtrip(
          Schema.Tuple([Schema.String, Schema.optional(Schema.Number)]),
          `Schema.Tuple([Schema.String, Schema.optionalKey(Schema.Number)])`
        )
      })

      it.todo("element with Undefined", () => {
        assertJsonSchemaRoundtrip(
          Schema.Tuple([Schema.String, Schema.UndefinedOr(Schema.Number)]),
          `Schema.Tuple([Schema.String, Schema.optionalKey(Schema.Number)])`
        )
      })
    })

    describe("Array", () => {
      it("Array(String)", () => {
        assertJsonSchemaRoundtrip(
          Schema.Array(Schema.String),
          `Schema.Array(Schema.String)`
        )
        assertJsonSchemaRoundtrip(
          Schema.Array(Schema.String).annotate({ description: "a" }),
          `Schema.Array(Schema.String).annotate({ "description": "a" })`
        )
      })

      describe("checks", () => {
        it("isMinLength", () => {
          assertJsonSchemaRoundtrip(
            Schema.Array(Schema.String).check(Schema.isMinLength(3)),
            `Schema.Array(Schema.String).check(Schema.isMinLength(3))`
          )
          assertJsonSchemaRoundtrip(
            Schema.Array(Schema.String).check(Schema.isMinLength(3, { description: "a" })),
            `Schema.Array(Schema.String).check(Schema.isMinLength(3, { "description": "a" }))`
          )
        })

        it("isMaxLength", () => {
          assertJsonSchemaRoundtrip(
            Schema.Array(Schema.String).check(Schema.isMaxLength(3)),
            `Schema.Array(Schema.String).check(Schema.isMaxLength(3))`
          )
          assertJsonSchemaRoundtrip(
            Schema.Array(Schema.String).check(Schema.isMaxLength(3, { description: "a" })),
            `Schema.Array(Schema.String).check(Schema.isMaxLength(3, { "description": "a" }))`
          )
        })

        it("isLength", () => {
          assertJsonSchemaRoundtrip(
            Schema.Array(Schema.String).check(Schema.isLength(3)),
            `Schema.Array(Schema.String).check(Schema.isMinLength(3), Schema.isMaxLength(3))`
          )
          // assertJsonSchemaRoundtrip(
          //   Schema.Array(Schema.String).check(Schema.isLength(3, { description: "a" })),
          //   `Schema.Array(Schema.String).check(Schema.isMinLength(3), Schema.isMaxLength(3), { "description": "a" })`
          // )
        })
      })
    })

    describe("Union", () => {
      it("String | Number", () => {
        assertJsonSchemaRoundtrip(
          Schema.Union([Schema.String, Schema.Number]),
          `Schema.Union([Schema.String, Schema.Number])`
        )
      })
    })

    // TODO
    describe("fromJsonString", () => {
      it("top level fromJsonString", () => {
        assertJsonSchemaRoundtrip(
          Schema.fromJsonString(Schema.FiniteFromString),
          `Schema.fromJsonString(Schema.String)`
        )
      })

      it("nested fromJsonString", () => {
        assertJsonSchemaRoundtrip(
          Schema.fromJsonString(Schema.Struct({
            a: Schema.fromJsonString(Schema.FiniteFromString)
          })),
          `Schema.fromJsonString(Schema.Struct({ "a": Schema.fromJsonString(Schema.String) }))`
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
      const json = SchemaStandard.toJson(document)
      deepStrictEqual(json, { source: "draft-2020-12", definitions: {}, ...expected })
    }

    describe("Suspend", () => {
      it("non-recursive", () => {
        assertToJson(Schema.suspend(() => Schema.String), {
          schema: { _tag: "Suspend", checks: [], thunk: { _tag: "String", checks: [] } }
        })
        assertToJson(Schema.suspend(() => Schema.String.annotate({ identifier: "ID" })), {
          schema: {
            _tag: "Suspend",
            checks: [],
            thunk: {
              _tag: "Reference",
              $ref: "ID"
            }
          },
          definitions: {
            ID: {
              _tag: "String",
              annotations: { identifier: "ID" },
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

    it("Declaration", () => {
      assertToJson(Schema.Option(Schema.String), {
        schema: {
          _tag: "Declaration",
          annotations: { typeConstructor: "Option" },
          typeParameters: [
            { _tag: "String", checks: [] }
          ],
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

    it("Unknown", () => {
      assertToJson(Schema.Unknown, { schema: { _tag: "Unknown" } })
      assertToJson(Schema.Unknown.annotate({ description: "a" }), {
        schema: { _tag: "Unknown", annotations: { description: "a" } }
      })
    })

    it("Any", () => {
      assertToJson(Schema.Any, { schema: { _tag: "Any" } })
      assertToJson(Schema.Any.annotate({ description: "a" }), {
        schema: { _tag: "Any", annotations: { description: "a" } }
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

    describe("Arrays", () => {
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
        const ID = Schema.String.annotate({ identifier: "ID" })
        assertToJson(Schema.Tuple([ID, ID]), {
          schema: {
            _tag: "Arrays",
            elements: [
              { isOptional: false, type: { _tag: "Reference", $ref: "ID" } },
              { isOptional: false, type: { _tag: "Reference", $ref: "ID" } }
            ],
            rest: [],
            checks: []
          },
          definitions: {
            ID: {
              _tag: "String",
              annotations: { identifier: "ID" },
              checks: []
            }
          }
        })
      })

      it("required element & annotateKey", () => {
        const ID = Schema.String.annotate({ identifier: "ID" })
        assertToJson(Schema.Tuple([ID, ID.annotateKey({ description: "b" })]), {
          schema: {
            _tag: "Arrays",
            elements: [
              {
                isOptional: false,
                type: { _tag: "Reference", $ref: "ID" }
              },
              {
                isOptional: false,
                type: { _tag: "Reference", $ref: "ID-1" },
                annotations: { description: "b" }
              }
            ],
            rest: [],
            checks: []
          },
          definitions: {
            ID: {
              _tag: "String",
              annotations: { identifier: "ID" },
              checks: []
            },
            "ID-1": {
              _tag: "String",
              annotations: { identifier: "ID" },
              checks: []
            }
          }
        })
      })
    })

    describe("Objects", () => {
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
  })

  describe("toCode", () => {
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
      it("Option", () => {
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
    function assertToSchema(schema: Schema.Top, expected: string) {
      const document = SchemaStandard.fromAST(schema.ast)
      const toSchema = SchemaStandard.toSchema(document)
      assertToCode(toSchema, expected)
    }

    it("String", () => {
      assertToSchema(Schema.String, "Schema.String")
    })

    it("Struct", () => {
      assertToSchema(
        Schema.Struct({}),
        `Schema.Struct({  })`
      )
      assertToSchema(
        Schema.Struct({ a: Schema.String }),
        `Schema.Struct({ "a": Schema.String })`
      )
      assertToSchema(
        Schema.Struct({ a: Schema.optionalKey(Schema.String) }),
        `Schema.Struct({ "a": Schema.optionalKey(Schema.String) })`
      )
      assertToSchema(
        Schema.Struct({ a: Schema.mutableKey(Schema.String) }),
        `Schema.Struct({ "a": Schema.mutableKey(Schema.String) })`
      )
      assertToSchema(
        Schema.Struct({ a: Schema.optionalKey(Schema.mutableKey(Schema.String)) }),
        `Schema.Struct({ "a": Schema.mutableKey(Schema.optionalKey(Schema.String)) })`
      )
    })

    it("Record", () => {
      assertToSchema(
        Schema.Record(Schema.String, Schema.Number),
        `Schema.Record(Schema.String, Schema.Number)`
      )
    })

    it("StructWithRest", () => {
      assertToSchema(
        Schema.StructWithRest(Schema.Struct({ a: Schema.String }), [Schema.Record(Schema.String, Schema.Number)]),
        `Schema.StructWithRest(Schema.Struct({ "a": Schema.String }), [Schema.Record(Schema.String, Schema.Number)])`
      )
    })

    it("Tuple", () => {
      assertToSchema(
        Schema.Tuple([]),
        `Schema.Tuple([])`
      )
      assertToSchema(
        Schema.Tuple([Schema.String, Schema.Number]),
        `Schema.Tuple([Schema.String, Schema.Number])`
      )
      assertToSchema(
        Schema.Tuple([Schema.String, Schema.optionalKey(Schema.Number)]),
        `Schema.Tuple([Schema.String, Schema.optionalKey(Schema.Number)])`
      )
    })

    it("Array", () => {
      assertToSchema(
        Schema.Array(Schema.String),
        `Schema.Array(Schema.String)`
      )
    })

    it("TupleWithRest", () => {
      assertToSchema(
        Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]),
        `Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number])`
      )
      assertToSchema(
        Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number, Schema.Boolean]),
        `Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number, Schema.Boolean])`
      )
    })

    it("Suspend", () => {
      assertToSchema(
        OuterCategory,
        `Schema.Struct({ "name": Schema.String, "children": Schema.Array(Schema.suspend((): Schema.Codec<Category> => Category)) }).annotate({ "identifier": "Category" })`
      )
    })
  })
})
