import { Formatter, Option, Record as Rec } from "effect/data"
import { Schema, StandardAST } from "effect/schema"
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

describe("StandardAST", () => {
  describe("toJson", () => {
    function assertToJson(
      schema: Schema.Top,
      expected: {
        readonly ast: StandardAST.JsonValue
        readonly definitions?: Record<string, StandardAST.JsonValue>
      }
    ) {
      const document = StandardAST.fromAST(schema.ast)
      deepStrictEqual(StandardAST.toJson(document.ast), expected.ast)
      const ast = StandardAST.toJson(document.ast)
      const definitions = Rec.map(document.definitions, StandardAST.toJson)
      deepStrictEqual({ ast, definitions }, { ast: expected.ast, definitions: expected.definitions ?? {} })
    }

    describe("Suspend", () => {
      it("non-recursive", () => {
        assertToJson(Schema.suspend(() => Schema.String), {
          ast: { _tag: "String", checks: [] }
        })
        assertToJson(Schema.suspend(() => Schema.String.annotate({ identifier: "ID" })), {
          ast: {
            _tag: "Reference",
            $ref: "ID"
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

      describe("recursive", () => {
        it("outer identifier", () => {
          assertToJson(OuterCategory, {
            ast: {
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
                        _tag: "Reference",
                        $ref: "Category"
                      }]
                    },
                    isOptional: false,
                    isMutable: false
                  }
                ],
                indexSignatures: []
              }
            }
          })
        })

        it("inner identifier", () => {
          assertToJson(InnerCategory, {
            ast: {
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
                      {
                        _tag: "Reference",
                        $ref: "Category"
                      }
                    ]
                  },
                  isOptional: false,
                  isMutable: false
                }
              ],
              indexSignatures: []
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
                          _tag: "Reference",
                          $ref: "Category"
                        }
                      ]
                    },
                    isOptional: false,
                    isMutable: false
                  }
                ],
                indexSignatures: []
              }
            }
          })
        })
      })
    })

    it("Declaration", () => {
      assertToJson(Schema.Option(Schema.String), {
        ast: {
          _tag: "External",
          annotations: { typeConstructor: "Option" },
          typeParameters: [
            { _tag: "String", checks: [] }
          ],
          checks: []
        }
      })
    })

    it("Null", () => {
      assertToJson(Schema.Null, { ast: { _tag: "Null" } })
      assertToJson(Schema.Null.annotate({ description: "a" }), {
        ast: { _tag: "Null", annotations: { description: "a" } }
      })
    })

    it("Undefined", () => {
      assertToJson(Schema.Undefined, { ast: { _tag: "Undefined" } })
      assertToJson(Schema.Undefined.annotate({ description: "a" }), {
        ast: { _tag: "Undefined", annotations: { description: "a" } }
      })
    })

    it("Void", () => {
      assertToJson(Schema.Void, { ast: { _tag: "Void" } })
      assertToJson(Schema.Void.annotate({ description: "a" }), {
        ast: { _tag: "Void", annotations: { description: "a" } }
      })
    })

    it("Never", () => {
      assertToJson(Schema.Never, { ast: { _tag: "Never" } })
      assertToJson(Schema.Never.annotate({ description: "a" }), {
        ast: { _tag: "Never", annotations: { description: "a" } }
      })
    })

    it("Unknown", () => {
      assertToJson(Schema.Unknown, { ast: { _tag: "Unknown" } })
      assertToJson(Schema.Unknown.annotate({ description: "a" }), {
        ast: { _tag: "Unknown", annotations: { description: "a" } }
      })
    })

    it("Any", () => {
      assertToJson(Schema.Any, { ast: { _tag: "Any" } })
      assertToJson(Schema.Any.annotate({ description: "a" }), {
        ast: { _tag: "Any", annotations: { description: "a" } }
      })
    })

    describe("String", () => {
      it("String", () => {
        assertToJson(Schema.String, { ast: { _tag: "String", checks: [] } })
        assertToJson(Schema.String.annotate({ description: "a" }), {
          ast: { _tag: "String", annotations: { "description": "a" }, checks: [] }
        })
      })

      describe("checks", () => {
        it("isMinLength", () => {
          assertToJson(Schema.String.check(Schema.isMinLength(1)), {
            ast: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 } }
              ]
            }
          })
          assertToJson(Schema.String.check(Schema.isMinLength(1, { description: "a" })), {
            ast: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 }, annotations: { description: "a" } }
              ]
            }
          })
        })

        it("isMaxLength", () => {
          assertToJson(Schema.String.check(Schema.isMaxLength(10)), {
            ast: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMaxLength", maxLength: 10 } }
              ]
            }
          })
          assertToJson(Schema.String.check(Schema.isMaxLength(10, { description: "a" })), {
            ast: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMaxLength", maxLength: 10 }, annotations: { description: "a" } }
              ]
            }
          })
        })

        it("isPattern", () => {
          assertToJson(Schema.String.check(Schema.isPattern(new RegExp("a"))), {
            ast: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isPattern", regExp: { source: "a", flags: "" } } }
              ]
            }
          })
          assertToJson(Schema.String.check(Schema.isPattern(new RegExp("a"), { description: "a" })), {
            ast: {
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
            ast: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isLength", length: 5 } }
              ]
            }
          })
          assertToJson(Schema.String.check(Schema.isLength(5, { description: "a" })), {
            ast: {
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
          Schema.encodedCodec(Schema.fromJsonString(Schema.Struct({ a: Schema.String }))),
          {
            ast: {
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
                indexSignatures: []
              }
            }
          }
        )
      })
    })

    describe("Number", () => {
      it("Number", () => {
        assertToJson(Schema.Number, { ast: { _tag: "Number", checks: [] } })
        assertToJson(Schema.Number.annotate({ description: "a" }), {
          ast: { _tag: "Number", annotations: { description: "a" }, checks: [] }
        })
      })

      describe("checks", () => {
        it("isInt", () => {
          assertToJson(Schema.Number.check(Schema.isInt()), {
            ast: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isInt" } }
              ]
            }
          })
        })

        it("isGreaterThanOrEqualTo", () => {
          assertToJson(Schema.Number.check(Schema.isGreaterThanOrEqualTo(10)), {
            ast: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isGreaterThanOrEqualTo", minimum: 10 } }
              ]
            }
          })
        })

        it("isLessThanOrEqualTo", () => {
          assertToJson(Schema.Number.check(Schema.isLessThanOrEqualTo(10)), {
            ast: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isLessThanOrEqualTo", maximum: 10 } }
              ]
            }
          })
        })

        it("isGreaterThan", () => {
          assertToJson(Schema.Number.check(Schema.isGreaterThan(10)), {
            ast: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isGreaterThan", exclusiveMinimum: 10 } }
              ]
            }
          })
        })

        it("isLessThan", () => {
          assertToJson(Schema.Number.check(Schema.isLessThan(10)), {
            ast: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isLessThan", exclusiveMaximum: 10 } }
              ]
            }
          })
        })

        it("isMultipleOf", () => {
          assertToJson(Schema.Number.check(Schema.isMultipleOf(10)), {
            ast: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMultipleOf", divisor: 10 } }
              ]
            }
          })
        })

        it("isBetween", () => {
          assertToJson(Schema.Number.check(Schema.isBetween({ minimum: 1, maximum: 10 })), {
            ast: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isBetween", minimum: 1, maximum: 10 } }
              ]
            }
          })
        })

        it("isInt32", () => {
          assertToJson(Schema.Number.check(Schema.isInt32()), {
            ast: {
              _tag: "Number",
              checks: [
                {
                  _tag: "FilterGroup",
                  meta: { _tag: "isInt32" },
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
            ast: {
              _tag: "Number",
              checks: [
                {
                  _tag: "FilterGroup",
                  meta: { _tag: "isUint32" },
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
      assertToJson(Schema.Boolean, { ast: { _tag: "Boolean" } })
      assertToJson(Schema.Boolean.annotate({ description: "a" }), {
        ast: { _tag: "Boolean", annotations: { description: "a" } }
      })
    })

    describe("BigInt", () => {
      it("BigInt", () => {
        assertToJson(Schema.BigInt, { ast: { _tag: "BigInt", checks: [] } })
        assertToJson(Schema.BigInt.annotate({ description: "a" }), {
          ast: { _tag: "BigInt", annotations: { description: "a" }, checks: [] }
        })
      })

      describe("checks", () => {
        it("isGreaterThanOrEqualTo", () => {
          assertToJson(Schema.BigInt.check(Schema.isGreaterThanOrEqualToBigInt(10n)), {
            ast: {
              _tag: "BigInt",
              checks: [
                { _tag: "Filter", meta: { _tag: "isGreaterThanOrEqualTo", minimum: "10" } }
              ]
            }
          })
        })
      })
    })

    it("Symbol", () => {
      assertToJson(Schema.Symbol, { ast: { _tag: "Symbol" } })
      assertToJson(Schema.Symbol.annotate({ description: "a" }), {
        ast: { _tag: "Symbol", annotations: { description: "a" } }
      })
    })

    it("Literal", () => {
      assertToJson(Schema.Literal("hello"), { ast: { _tag: "Literal", literal: "hello" } })
      assertToJson(Schema.Literal("hello").annotate({ description: "a" }), {
        ast: { _tag: "Literal", annotations: { description: "a" }, literal: "hello" }
      })
    })

    it("UniqueSymbol", () => {
      assertToJson(Schema.UniqueSymbol(Symbol.for("test")), {
        ast: { _tag: "UniqueSymbol", symbol: `Symbol(test)` }
      })
      assertToJson(Schema.UniqueSymbol(Symbol.for("test")).annotate({ description: "a" }), {
        ast: { _tag: "UniqueSymbol", annotations: { description: "a" }, symbol: `Symbol(test)` }
      })
    })

    it("ObjectKeyword", () => {
      assertToJson(Schema.ObjectKeyword, { ast: { _tag: "ObjectKeyword" } })
      assertToJson(Schema.ObjectKeyword.annotate({ description: "a" }), {
        ast: { _tag: "ObjectKeyword", annotations: { description: "a" } }
      })
    })

    it("Enum", () => {
      assertToJson(Schema.Enum({ A: "a", B: "b" }), {
        ast: { _tag: "Enum", enums: [["A", "a"], ["B", "b"]] }
      })
      assertToJson(Schema.Enum({ A: "a", B: "b" }).annotate({ description: "a" }), {
        ast: { _tag: "Enum", annotations: { description: "a" }, enums: [["A", "a"], ["B", "b"]] }
      })
    })

    it("TemplateLiteral", () => {
      assertToJson(Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]), {
        ast: {
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
          ast: {
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
        assertToJson(Schema.Tuple([]), { ast: { _tag: "Arrays", elements: [], rest: [] } })
        assertToJson(Schema.Tuple([]).annotate({ description: "a" }), {
          ast: { _tag: "Arrays", annotations: { description: "a" }, elements: [], rest: [] }
        })
      })
    })

    describe("Objects", () => {
      it("empty struct", () => {
        assertToJson(Schema.Struct({}), {
          ast: {
            _tag: "Objects",
            propertySignatures: [],
            indexSignatures: []
          }
        })
        assertToJson(Schema.Struct({}).annotate({ description: "a" }), {
          ast: {
            _tag: "Objects",
            annotations: { description: "a" },
            propertySignatures: [],
            indexSignatures: []
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
            ast: {
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
              indexSignatures: []
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
            ast: {
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
              indexSignatures: []
            }
          }
        )
      })
    })

    describe("Union", () => {
      it("anyOf", () => {
        assertToJson(Schema.Union([Schema.String, Schema.Number]), {
          ast: {
            _tag: "Union",
            types: [
              { _tag: "String", checks: [] },
              { _tag: "Number", checks: [] }
            ],
            mode: "anyOf"
          }
        })
        assertToJson(Schema.Union([Schema.String, Schema.Number]).annotate({ description: "a" }), {
          ast: {
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
          ast: {
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
          ast: {
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
    function assertToCode(schema: Schema.Top, expected: string, resolver?: StandardAST.Resolver<string>) {
      const document = StandardAST.fromAST(schema.ast)
      strictEqual(StandardAST.toCode(document, { resolver }), expected)
    }

    const resolver: StandardAST.Resolver<string> = (node, recur) => {
      switch (node._tag) {
        case "External": {
          const typeConstructor = node.annotations?.typeConstructor
          if (typeof typeConstructor === "string") {
            return `Schema.${typeConstructor}(${node.typeParameters.map((p) => recur(p)).join(", ")})`
          }
          return `Schema.Unknown`
        }
        case "Reference":
          return `Schema.suspend((): Schema.Codec<${node.$ref}> => ${node.$ref})` +
            StandardAST.toCodeAnnotate(node.annotations)
      }
    }

    describe("Suspend", () => {
      it("non-recursive", () => {
        assertToCode(
          Schema.suspend(() => Schema.String),
          `Schema.String`,
          resolver
        )
        assertToCode(
          Schema.suspend(() => Schema.String.annotate({ identifier: "ID" })),
          `Schema.String.annotate({ "identifier": "ID" })`,
          resolver
        )
      })

      describe("recursive", () => {
        it("outer identifier", () => {
          assertToCode(
            OuterCategory,
            `Schema.Struct({ "name": Schema.String, "children": Schema.Array(Schema.suspend((): Schema.Codec<Category> => Category)) }).annotate({ "identifier": "Category" })`,
            resolver
          )
        })

        it("inner identifier", () => {
          assertToCode(
            InnerCategory,
            `Schema.Struct({ "name": Schema.String, "children": Schema.Array(Schema.suspend((): Schema.Codec<Category> => Category)) })`,
            resolver
          )
        })
      })
    })

    describe("Declaration", () => {
      it("Option", () => {
        assertToCode(Schema.Option(Schema.String), "Schema.Unknown")
        assertToCode(Schema.Option(Schema.String), "Schema.Option(Schema.String)", resolver)
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
        const document = StandardAST.fromAST(Schema.UniqueSymbol(sym).ast)
        throws(
          () => StandardAST.toCode(document),
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

  describe("toJsonSchema", () => {
    function assertToJsonSchema(
      documentOrSchema: StandardAST.Document | Schema.Top,
      expected: { schema: object; definitions?: Record<string, object> }
    ) {
      const astDocument = Schema.isSchema(documentOrSchema)
        ? StandardAST.fromAST(documentOrSchema.ast)
        : documentOrSchema
      const jsonDocument = StandardAST.toJsonSchema(astDocument)
      strictEqual(jsonDocument.source, "draft-2020-12")
      deepStrictEqual(jsonDocument.schema, expected.schema)
      deepStrictEqual(jsonDocument.definitions, expected.definitions ?? {})
    }

    describe("primitives", () => {
      it("Null", () => {
        assertToJsonSchema(Schema.Null, { schema: { type: "null" } })
      })

      it("Undefined", () => {
        assertToJsonSchema(Schema.Undefined, { schema: {} })
      })

      it("Void", () => {
        assertToJsonSchema(Schema.Void, { schema: {} })
      })

      it("Never", () => {
        assertToJsonSchema(Schema.Never, { schema: { not: {} } })
      })

      it("Unknown", () => {
        assertToJsonSchema(Schema.Unknown, { schema: {} })
      })

      it("Any", () => {
        assertToJsonSchema(Schema.Any, { schema: {} })
      })

      it("String", () => {
        assertToJsonSchema(Schema.String, { schema: { type: "string" } })
        assertToJsonSchema(
          Schema.String.annotate({
            title: "Name",
            description: "A person's name",
            default: "John",
            examples: ["John", "Jane"]
          }),
          {
            schema: {
              type: "string",
              title: "Name",
              description: "A person's name",
              default: "John",
              examples: ["John", "Jane"]
            }
          }
        )
      })

      it("Number", () => {
        assertToJsonSchema(Schema.Number, { schema: { type: "number" } })
        assertToJsonSchema(
          Schema.Number.annotate({ description: "a" }),
          { schema: { type: "number", description: "a" } }
        )
      })

      it("Boolean", () => {
        assertToJsonSchema(Schema.Boolean, { schema: { type: "boolean" } })
      })

      it("BigInt", () => {
        assertToJsonSchema(Schema.BigInt, { schema: {} })
      })

      it("Symbol", () => {
        assertToJsonSchema(Schema.Symbol, { schema: {} })
      })

      it("UniqueSymbol", () => {
        assertToJsonSchema(
          Schema.UniqueSymbol(Symbol.for("test")),
          { schema: {} }
        )
      })
    })

    describe("Literal", () => {
      it("string literal", () => {
        assertToJsonSchema(
          Schema.Literal("hello"),
          { schema: { type: "string", enum: ["hello"] } }
        )
      })

      it("number literal", () => {
        assertToJsonSchema(
          Schema.Literal(42),
          { schema: { type: "number", enum: [42] } }
        )
      })

      it("boolean literal", () => {
        assertToJsonSchema(
          Schema.Literal(true),
          { schema: { type: "boolean", enum: [true] } }
        )
      })

      it("bigint literal", () => {
        assertToJsonSchema(
          Schema.Literal(1n),
          { schema: {} }
        )
      })
    })

    describe("Enum", () => {
      it("string enum", () => {
        assertToJsonSchema(
          Schema.Enum({ A: "a", B: "b" }),
          { schema: { type: "string", enum: ["a", "b"] } }
        )
      })

      it("number enum", () => {
        assertToJsonSchema(
          Schema.Enum({ One: 1, Two: 2 }),
          { schema: { type: "number", enum: [1, 2] } }
        )
      })

      it("mixed enum", () => {
        assertToJsonSchema(
          Schema.Enum({ A: "a", One: 1 }),
          {
            schema: {
              anyOf: [
                { type: "string", enum: ["a"] },
                { type: "number", enum: [1] }
              ]
            }
          }
        )
      })
    })

    describe("ObjectKeyword", () => {
      it("should convert to anyOf object or array", () => {
        assertToJsonSchema(
          Schema.ObjectKeyword,
          { schema: { anyOf: [{ type: "object" }, { type: "array" }] } }
        )
      })
    })

    describe("TemplateLiteral", () => {
      it("should convert to string type with pattern", () => {
        assertToJsonSchema(
          Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]),
          { schema: { type: "string", pattern: "^[\\s\\S]*?-[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?$" } }
        )
      })
    })

    describe("Arrays", () => {
      it("empty tuple", () => {
        assertToJsonSchema(
          Schema.Tuple([]),
          { schema: { type: "array", items: false } }
        )
      })

      it("tuple with elements", () => {
        assertToJsonSchema(
          Schema.Tuple([Schema.String, Schema.Number]),
          {
            schema: {
              type: "array",
              prefixItems: [{ type: "string" }, { type: "number" }],
              items: false,
              minItems: 2
            }
          }
        )
      })

      it("array with rest only", () => {
        assertToJsonSchema(
          Schema.Array(Schema.String),
          {
            schema: {
              type: "array",
              items: { type: "string" }
            }
          }
        )
      })

      it("tuple with rest", () => {
        assertToJsonSchema(
          Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]),
          {
            schema: {
              type: "array",
              prefixItems: [{ type: "string" }],
              items: { type: "number" },
              minItems: 1
            }
          }
        )
      })
    })

    describe("Objects", () => {
      it("empty struct", () => {
        assertToJsonSchema(
          Schema.Struct({}),
          { schema: { anyOf: [{ type: "object" }, { type: "array" }] } }
        )
      })

      it("struct with required properties", () => {
        assertToJsonSchema(
          Schema.Struct({ a: Schema.String }),
          {
            schema: {
              type: "object",
              properties: {
                a: { type: "string" }
              },
              required: ["a"],
              additionalProperties: false
            }
          }
        )
      })

      it("struct with optional properties", () => {
        assertToJsonSchema(
          Schema.Struct({ a: Schema.optionalKey(Schema.String) }),
          {
            schema: {
              type: "object",
              properties: {
                a: { type: "string" }
              },
              additionalProperties: false
            }
          }
        )
      })

      it("struct with required property containing Undefined", () => {
        assertToJsonSchema(
          Schema.Struct({ a: Schema.UndefinedOr(Schema.String) }),
          {
            schema: {
              type: "object",
              properties: {
                a: {
                  type: "string"
                }
              },
              additionalProperties: false
            }
          }
        )
        assertToJsonSchema(
          Schema.Struct({
            a: Schema.Union([Schema.Undefined, Schema.String, Schema.Number])
          }),
          {
            schema: {
              type: "object",
              properties: {
                a: {
                  anyOf: [{ type: "string" }, { type: "number" }]
                }
              },
              additionalProperties: false
            }
          }
        )
      })

      it("struct with index signature", () => {
        assertToJsonSchema(
          Schema.Record(Schema.String, Schema.Number),
          {
            schema: {
              type: "object",
              additionalProperties: { type: "number" }
            }
          }
        )
      })
    })

    describe("Union", () => {
      it("anyOf mode", () => {
        assertToJsonSchema(
          Schema.Union([Schema.String, Schema.Number]),
          {
            schema: {
              anyOf: [{ type: "string" }, { type: "number" }]
            }
          }
        )
      })

      it("oneOf mode", () => {
        assertToJsonSchema(
          Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" }),
          {
            schema: {
              oneOf: [{ type: "string" }, { type: "number" }]
            }
          }
        )
      })
    })

    describe("String checks", () => {
      it("isMinLength", () => {
        assertToJsonSchema(
          Schema.String.check(Schema.isMinLength(5)),
          { schema: { type: "string", minLength: 5 } }
        )
        assertToJsonSchema(
          Schema.String.annotate({ description: "a" }).check(Schema.isMinLength(5)),
          { schema: { type: "string", description: "a", minLength: 5 } }
        )
        assertToJsonSchema(
          Schema.String.check(Schema.isMinLength(5, { description: "b" })),
          { schema: { type: "string", description: "b", minLength: 5 } }
        )
        assertToJsonSchema(
          Schema.String.annotate({ description: "a" }).check(Schema.isMinLength(5, { description: "b" })),
          { schema: { type: "string", description: "a", allOf: [{ description: "b", minLength: 5 }] } }
        )
      })

      it("isMaxLength", () => {
        assertToJsonSchema(
          Schema.String.check(Schema.isMaxLength(10)),
          { schema: { type: "string", maxLength: 10 } }
        )
      })

      it("isLength", () => {
        assertToJsonSchema(
          Schema.String.check(Schema.isLength(5)),
          { schema: { type: "string", minLength: 5, maxLength: 5 } }
        )
      })

      it("isPattern", () => {
        assertToJsonSchema(
          Schema.String.check(Schema.isPattern(new RegExp("^[a-z]+$"))),
          { schema: { type: "string", pattern: "^[a-z]+$" } }
        )
      })

      it("isUUID", () => {
        assertToJsonSchema(
          Schema.String.check(Schema.isUUID(undefined)),
          { schema: { type: "string", format: "uuid" } }
        )
        assertToJsonSchema(
          Schema.String.check(Schema.isUUID(1)),
          { schema: { type: "string", format: "uuid" } }
        )
      })

      it("isBase64", () => {
        assertToJsonSchema(
          Schema.String.check(Schema.isBase64()),
          { schema: { type: "string", contentEncoding: "base64" } }
        )
      })

      it("isBase64Url", () => {
        assertToJsonSchema(
          Schema.String.check(Schema.isBase64Url()),
          { schema: { type: "string", contentEncoding: "base64url" } }
        )
      })

      it("multiple checks", () => {
        assertToJsonSchema(
          Schema.String.check(Schema.isMinLength(5), Schema.isMaxLength(10)),
          { schema: { type: "string", minLength: 5, maxLength: 10 } }
        )
      })

      it("filter group", () => {
        assertToJsonSchema(
          Schema.String.check(Schema.makeFilterGroup([Schema.isMinLength(5), Schema.isMaxLength(10)])),
          { schema: { type: "string", minLength: 5, maxLength: 10 } }
        )
        assertToJsonSchema(
          Schema.String.annotate({ description: "a" }).check(
            Schema.makeFilterGroup([Schema.isMinLength(5), Schema.isMaxLength(10)])
          ),
          { schema: { type: "string", description: "a", minLength: 5, maxLength: 10 } }
        )
        assertToJsonSchema(
          Schema.String.check(
            Schema.makeFilterGroup([Schema.isMinLength(5), Schema.isMaxLength(10)], { description: "b" })
          ),
          { schema: { type: "string", description: "b", minLength: 5, maxLength: 10 } }
        )
        assertToJsonSchema(
          Schema.String.annotate({ description: "a" }).check(
            Schema.makeFilterGroup([Schema.isMinLength(5), Schema.isMaxLength(10)], { description: "b" })
          ),
          { schema: { type: "string", description: "a", allOf: [{ description: "b", minLength: 5, maxLength: 10 }] } }
        )
      })
    })

    describe("Number checks", () => {
      it("isInt", () => {
        assertToJsonSchema(
          Schema.Number.check(Schema.isInt()),
          { schema: { type: "integer" } }
        )
        assertToJsonSchema(
          Schema.Number.annotate({ description: "a" }).check(Schema.isInt()),
          { schema: { type: "integer", description: "a" } }
        )
        assertToJsonSchema(
          Schema.Number.check(Schema.isInt({ description: "b" })),
          { schema: { type: "integer", description: "b" } }
        )
        assertToJsonSchema(
          Schema.Number.annotate({ description: "a" }).check(Schema.isInt({ description: "b" })),
          { schema: { type: "integer", description: "a", allOf: [{ description: "b" }] } }
        )
      })

      it("isMultipleOf", () => {
        assertToJsonSchema(
          Schema.Number.check(Schema.isMultipleOf(5)),
          { schema: { type: "number", multipleOf: 5 } }
        )
      })

      it("isGreaterThanOrEqualTo", () => {
        assertToJsonSchema(
          Schema.Number.check(Schema.isGreaterThanOrEqualTo(10)),
          { schema: { type: "number", minimum: 10 } }
        )
      })

      it("isLessThanOrEqualTo", () => {
        assertToJsonSchema(
          Schema.Number.check(Schema.isLessThanOrEqualTo(100)),
          { schema: { type: "number", maximum: 100 } }
        )
      })

      it("isGreaterThan", () => {
        assertToJsonSchema(
          Schema.Number.check(Schema.isGreaterThan(10)),
          { schema: { type: "number", exclusiveMinimum: 10 } }
        )
      })

      it("isLessThan", () => {
        assertToJsonSchema(
          Schema.Number.check(Schema.isLessThan(100)),
          { schema: { type: "number", exclusiveMaximum: 100 } }
        )
      })

      it("isBetween", () => {
        assertToJsonSchema(
          Schema.Number.check(Schema.isBetween({ minimum: 1, maximum: 10 })),
          { schema: { type: "number", minimum: 1, maximum: 10 } }
        )
      })
    })

    describe("FilterGroup", () => {
      it("should apply all checks in group", () => {
        // Use isInt32 which creates a FilterGroup internally
        assertToJsonSchema(
          Schema.Number.check(Schema.isInt32()),
          {
            schema: {
              type: "integer",
              minimum: -2147483648,
              maximum: 2147483647
            }
          }
        )
      })
    })

    describe("annotations", () => {
      it("title", () => {
        assertToJsonSchema(
          Schema.String.annotate({ title: "Name" }),
          { schema: { type: "string", title: "Name" } }
        )
      })

      it("description", () => {
        assertToJsonSchema(
          Schema.String.annotate({ description: "A string value" }),
          { schema: { type: "string", description: "A string value" } }
        )
      })

      it("default", () => {
        assertToJsonSchema(
          Schema.String.annotate({ default: "default value" }),
          { schema: { type: "string", default: "default value" } }
        )
      })

      it("examples", () => {
        assertToJsonSchema(
          Schema.String.annotate({ examples: ["example1", "example2"] }),
          { schema: { type: "string", examples: ["example1", "example2"] } }
        )
      })

      it("multiple annotations", () => {
        assertToJsonSchema(
          Schema.String.annotate({
            title: "Name",
            description: "A name",
            default: "John",
            examples: ["John", "Jane"]
          }),
          {
            schema: {
              type: "string",
              title: "Name",
              description: "A name",
              default: "John",
              examples: ["John", "Jane"]
            }
          }
        )
      })
    })

    describe("String contentSchema", () => {
      it("with contentMediaType and contentSchema", () => {
        assertToJsonSchema(
          Schema.encodedCodec(
            Schema.fromJsonString(Schema.Struct({ a: Schema.String }))
          ),
          {
            schema: {
              type: "string",
              contentMediaType: "application/json",
              contentSchema: {
                type: "object",
                properties: {
                  a: { type: "string" }
                },
                required: ["a"],
                additionalProperties: false
              }
            }
          }
        )
      })
    })

    describe("Reference", () => {
      it("with identifier without source", () => {
        // This case is harder to represent with Schema, so we keep StandardAST
        assertToJsonSchema(
          {
            ast: {
              _tag: "Reference",
              $ref: "MyType"
            },
            definitions: {}
          },
          {
            schema: { $ref: "#/$defs/MyType" }
          }
        )
      })

      it("without identifier but with source", () => {
        assertToJsonSchema(
          Schema.suspend(() => Schema.String),
          { schema: { type: "string" } }
        )
      })
    })

    describe("identifier annotation", () => {
      it("should create definition and return $ref", () => {
        assertToJsonSchema(
          Schema.Struct({ name: Schema.String }).annotate({ identifier: "Person" }),
          {
            schema: { $ref: "#/$defs/Person" },
            definitions: {
              Person: {
                type: "object",
                properties: {
                  name: { type: "string" }
                },
                required: ["name"],
                additionalProperties: false
              }
            }
          }
        )
      })

      describe("recursive", () => {
        it("outer identifier", () => {
          assertToJsonSchema(
            OuterCategory,
            {
              schema: { $ref: "#/$defs/Category" },
              definitions: {
                Category: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    children: { type: "array", items: { $ref: "#/$defs/Category" } }
                  },
                  required: ["name", "children"],
                  additionalProperties: false
                }
              }
            }
          )
        })

        it("inner identifier", () => {
          assertToJsonSchema(
            InnerCategory,
            {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  children: { type: "array", items: { $ref: "#/$defs/Category" } }
                },
                required: ["name", "children"],
                additionalProperties: false
              },
              definitions: {
                Category: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    children: { type: "array", items: { $ref: "#/$defs/Category" } }
                  },
                  required: ["name", "children"],
                  additionalProperties: false
                }
              }
            }
          )
        })
      })
    })

    describe("External", () => {
      it("should return empty schema", () => {
        // External nodes are typically from instanceOf or other declarations
        // Keep StandardAST for this edge case
        assertToJsonSchema(
          {
            ast: {
              _tag: "External",
              typeParameters: [],
              checks: []
            },
            definitions: {}
          },
          { schema: {} }
        )
      })
    })

    describe("complex nested structures", () => {
      it("nested struct", () => {
        assertToJsonSchema(
          Schema.Struct({
            user: Schema.Struct({
              name: Schema.String,
              age: Schema.Number
            })
          }),
          {
            schema: {
              type: "object",
              properties: {
                user: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    age: { type: "number" }
                  },
                  required: ["name", "age"],
                  additionalProperties: false
                }
              },
              required: ["user"],
              additionalProperties: false
            }
          }
        )
      })

      it("union of structs", () => {
        assertToJsonSchema(
          Schema.Union([
            Schema.Struct({ type: Schema.Literal("a"), value: Schema.String }),
            Schema.Struct({ type: Schema.Literal("b"), value: Schema.Number })
          ]),
          {
            schema: {
              anyOf: [
                {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["a"] },
                    value: { type: "string" }
                  },
                  required: ["type", "value"],
                  additionalProperties: false
                },
                {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["b"] },
                    value: { type: "number" }
                  },
                  required: ["type", "value"],
                  additionalProperties: false
                }
              ]
            }
          }
        )
      })

      it("tuple with struct elements", () => {
        assertToJsonSchema(
          Schema.Tuple([
            Schema.Struct({ name: Schema.String }),
            Schema.Struct({ age: Schema.Number })
          ]),
          {
            schema: {
              type: "array",
              prefixItems: [
                {
                  type: "object",
                  properties: {
                    name: { type: "string" }
                  },
                  required: ["name"],
                  additionalProperties: false
                },
                {
                  type: "object",
                  properties: {
                    age: { type: "number" }
                  },
                  required: ["age"],
                  additionalProperties: false
                }
              ],
              items: false,
              minItems: 2
            }
          }
        )
      })
    })
  })

  describe("toFormatter", () => {
    function assertToFormatter<T>(schema: Schema.Schema<T>, t: T, expected: string) {
      const ast = StandardAST.fromAST(schema.ast).ast
      const formatter = StandardAST.toFormatter(ast, {
        onBefore: (ast) => {
          switch (ast._tag) {
            case "Boolean":
              return Option.some((b: boolean) => b ? "True" : "False")
            default:
              return Option.none()
          }
        },
        resolver: (ast, recur) => {
          switch (ast._tag) {
            case "External": {
              if (ast.annotations?.typeConstructor === "Option") {
                const value = recur(ast.typeParameters[0])
                return (o: Option.Option<unknown>) =>
                  Option.match(o, {
                    onSome: (t) => `some(${value(t)})`,
                    onNone: () => "none()"
                  })
              }
              return Formatter.format
            }
            default:
              return Formatter.format
          }
        }
      })
      strictEqual(formatter(t), expected)
    }

    it("Boolean", () => {
      assertToFormatter(Schema.Boolean, true, "True")
    })

    it("Option(Boolean)", () => {
      assertToFormatter(Schema.Option(Schema.Boolean), Option.some(true), `some(True)`)
      assertToFormatter(Schema.Option(Schema.Boolean), Option.none(), `none()`)
    })

    it("Option(Option(Boolean))", () => {
      assertToFormatter(
        Schema.Option(Schema.Option(Schema.Boolean)),
        Option.some(Option.some(true)),
        `some(some(True))`
      )
    })
  })
})
