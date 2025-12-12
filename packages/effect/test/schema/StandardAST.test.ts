import { Schema, StandardAST } from "effect/schema"
import { describe, it } from "vitest"
import { deepStrictEqual, strictEqual, throws } from "../utils/assert.ts"

describe("StandardAST", () => {
  function assertFromAST(schema: Schema.Top, standardAST: StandardAST.StandardAST) {
    const ast = StandardAST.fromAST(schema.ast)
    deepStrictEqual(ast, standardAST)
  }

  describe("fromAST", () => {
    it("Declaration", () => {
      assertFromAST(Schema.Option(Schema.String), {
        _tag: "External",
        annotations: { typeConstructor: "Option" },
        typeParameters: [
          { _tag: "String", annotations: undefined, checks: [] }
        ],
        checks: []
      })
    })

    it("Null", () => {
      assertFromAST(Schema.Null, { _tag: "Null", annotations: undefined })
      assertFromAST(Schema.Null.annotate({ description: "a" }), { _tag: "Null", annotations: { description: "a" } })
    })

    it("Undefined", () => {
      assertFromAST(Schema.Undefined, { _tag: "Undefined", annotations: undefined })
      assertFromAST(Schema.Undefined.annotate({ description: "a" }), {
        _tag: "Undefined",
        annotations: { description: "a" }
      })
    })

    it("Void", () => {
      assertFromAST(Schema.Void, { _tag: "Void", annotations: undefined })
      assertFromAST(Schema.Void.annotate({ description: "a" }), { _tag: "Void", annotations: { description: "a" } })
    })

    it("Never", () => {
      assertFromAST(Schema.Never, { _tag: "Never", annotations: undefined })
      assertFromAST(Schema.Never.annotate({ description: "a" }), { _tag: "Never", annotations: { description: "a" } })
    })

    it("Unknown", () => {
      assertFromAST(Schema.Unknown, { _tag: "Unknown", annotations: undefined })
      assertFromAST(Schema.Unknown.annotate({ description: "a" }), {
        _tag: "Unknown",
        annotations: { description: "a" }
      })
    })

    it("Any", () => {
      assertFromAST(Schema.Any, { _tag: "Any", annotations: undefined })
      assertFromAST(Schema.Any.annotate({ description: "a" }), { _tag: "Any", annotations: { description: "a" } })
    })

    describe("String", () => {
      it("String", () => {
        assertFromAST(Schema.String, { _tag: "String", annotations: undefined, checks: [] })
        assertFromAST(Schema.String.annotate({ description: "a" }), {
          _tag: "String",
          annotations: { "description": "a" },
          checks: []
        })
      })

      describe("checks", () => {
        it("isMinLength", () => {
          assertFromAST(Schema.String.check(Schema.isMinLength(1)), {
            _tag: "String",
            annotations: undefined,
            checks: [
              { _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 }, annotations: undefined }
            ]
          })
          assertFromAST(Schema.String.check(Schema.isMinLength(1, { description: "a" })), {
            _tag: "String",
            annotations: undefined,
            checks: [
              { _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 }, annotations: { description: "a" } }
            ]
          })
        })

        it("isMaxLength", () => {
          assertFromAST(Schema.String.check(Schema.isMaxLength(10)), {
            _tag: "String",
            annotations: undefined,
            checks: [
              { _tag: "Filter", meta: { _tag: "isMaxLength", maxLength: 10 }, annotations: undefined }
            ]
          })
          assertFromAST(Schema.String.check(Schema.isMaxLength(10, { description: "a" })), {
            _tag: "String",
            annotations: undefined,
            checks: [
              { _tag: "Filter", meta: { _tag: "isMaxLength", maxLength: 10 }, annotations: { description: "a" } }
            ]
          })
        })

        it("isPattern", () => {
          assertFromAST(Schema.String.check(Schema.isPattern(new RegExp("a"))), {
            _tag: "String",
            annotations: undefined,
            checks: [
              { _tag: "Filter", meta: { _tag: "isPattern", regExp: new RegExp("a") }, annotations: undefined }
            ]
          })
          assertFromAST(Schema.String.check(Schema.isPattern(new RegExp("a"), { description: "a" })), {
            _tag: "String",
            annotations: undefined,
            checks: [
              {
                _tag: "Filter",
                meta: { _tag: "isPattern", regExp: new RegExp("a") },
                annotations: { description: "a" }
              }
            ]
          })
        })

        it("isLength", () => {
          assertFromAST(Schema.String.check(Schema.isLength(5)), {
            _tag: "String",
            annotations: undefined,
            checks: [
              { _tag: "Filter", meta: { _tag: "isLength", length: 5 }, annotations: undefined }
            ]
          })
          assertFromAST(Schema.String.check(Schema.isLength(5, { description: "a" })), {
            _tag: "String",
            annotations: undefined,
            checks: [
              { _tag: "Filter", meta: { _tag: "isLength", length: 5 }, annotations: { description: "a" } }
            ]
          })
        })
      })

      it("contentSchema", () => {
        assertFromAST(
          Schema.encodedCodec(Schema.fromJsonString(Schema.Struct({ a: Schema.String }))),
          {
            _tag: "String",
            annotations: undefined,
            checks: [],
            contentMediaType: "application/json",
            contentSchema: {
              _tag: "Objects",
              annotations: undefined,
              propertySignatures: [{
                name: "a",
                type: { _tag: "String", annotations: undefined, checks: [] },
                isOptional: false,
                isMutable: false,
                annotations: undefined
              }],
              indexSignatures: []
            }
          }
        )
      })
    })

    describe("Number", () => {
      it("Number", () => {
        assertFromAST(Schema.Number, { _tag: "Number", annotations: undefined, checks: [] })
        assertFromAST(Schema.Number.annotate({ description: "a" }), {
          _tag: "Number",
          annotations: { description: "a" },
          checks: []
        })
      })

      describe("checks", () => {
        it("isInt", () => {
          assertFromAST(Schema.Number.check(Schema.isInt()), {
            _tag: "Number",
            annotations: undefined,
            checks: [
              { _tag: "Filter", meta: { _tag: "isInt" }, annotations: undefined }
            ]
          })
        })

        it("isGreaterThanOrEqualTo", () => {
          assertFromAST(Schema.Number.check(Schema.isGreaterThanOrEqualTo(10)), {
            _tag: "Number",
            annotations: undefined,
            checks: [
              { _tag: "Filter", meta: { _tag: "isGreaterThanOrEqualTo", minimum: 10 }, annotations: undefined }
            ]
          })
        })

        it("isLessThanOrEqualTo", () => {
          assertFromAST(Schema.Number.check(Schema.isLessThanOrEqualTo(10)), {
            _tag: "Number",
            annotations: undefined,
            checks: [
              { _tag: "Filter", meta: { _tag: "isLessThanOrEqualTo", maximum: 10 }, annotations: undefined }
            ]
          })
        })

        it("isGreaterThan", () => {
          assertFromAST(Schema.Number.check(Schema.isGreaterThan(10)), {
            _tag: "Number",
            annotations: undefined,
            checks: [
              { _tag: "Filter", meta: { _tag: "isGreaterThan", exclusiveMinimum: 10 }, annotations: undefined }
            ]
          })
        })

        it("isLessThan", () => {
          assertFromAST(Schema.Number.check(Schema.isLessThan(10)), {
            _tag: "Number",
            annotations: undefined,
            checks: [
              { _tag: "Filter", meta: { _tag: "isLessThan", exclusiveMaximum: 10 }, annotations: undefined }
            ]
          })
        })

        it("isMultipleOf", () => {
          assertFromAST(Schema.Number.check(Schema.isMultipleOf(10)), {
            _tag: "Number",
            annotations: undefined,
            checks: [
              { _tag: "Filter", meta: { _tag: "isMultipleOf", divisor: 10 }, annotations: undefined }
            ]
          })
        })

        it("isBetween", () => {
          assertFromAST(Schema.Number.check(Schema.isBetween({ minimum: 1, maximum: 10 })), {
            _tag: "Number",
            annotations: undefined,
            checks: [
              { _tag: "Filter", meta: { _tag: "isBetween", minimum: 1, maximum: 10 }, annotations: undefined }
            ]
          })
        })

        it("isInt32", () => {
          assertFromAST(Schema.Number.check(Schema.isInt32()), {
            _tag: "Number",
            annotations: undefined,
            checks: [
              {
                _tag: "FilterGroup",
                annotations: undefined,
                meta: { _tag: "isInt32" },
                checks: [
                  { _tag: "Filter", meta: { _tag: "isInt" }, annotations: undefined },
                  {
                    _tag: "Filter",
                    meta: { _tag: "isBetween", minimum: -2147483648, maximum: 2147483647 },
                    annotations: undefined
                  }
                ]
              }
            ]
          })
        })

        it("isUint32", () => {
          assertFromAST(Schema.Number.check(Schema.isUint32()), {
            _tag: "Number",
            annotations: undefined,
            checks: [
              {
                _tag: "FilterGroup",
                meta: { _tag: "isUint32" },
                annotations: undefined,
                checks: [
                  { _tag: "Filter", meta: { _tag: "isInt" }, annotations: undefined },
                  {
                    _tag: "Filter",
                    meta: { _tag: "isBetween", minimum: 0, maximum: 4294967295 },
                    annotations: undefined
                  }
                ]
              }
            ]
          })
        })
      })
    })

    it("Boolean", () => {
      assertFromAST(Schema.Boolean, { _tag: "Boolean", annotations: undefined })
      assertFromAST(Schema.Boolean.annotate({ description: "a" }), {
        _tag: "Boolean",
        annotations: { description: "a" }
      })
    })

    describe("BigInt", () => {
      it("BigInt", () => {
        assertFromAST(Schema.BigInt, { _tag: "BigInt", annotations: undefined, checks: [] })
        assertFromAST(Schema.BigInt.annotate({ description: "a" }), {
          _tag: "BigInt",
          annotations: { description: "a" },
          checks: []
        })
      })

      describe("checks", () => {
        it("isGreaterThanOrEqualTo", () => {
          assertFromAST(Schema.BigInt.check(Schema.isGreaterThanOrEqualToBigInt(10n)), {
            _tag: "BigInt",
            annotations: undefined,
            checks: [
              { _tag: "Filter", meta: { _tag: "isGreaterThanOrEqualTo", minimum: 10n }, annotations: undefined }
            ]
          })
        })
      })
    })

    it("Symbol", () => {
      assertFromAST(Schema.Symbol, { _tag: "Symbol", annotations: undefined })
      assertFromAST(Schema.Symbol.annotate({ description: "a" }), {
        _tag: "Symbol",
        annotations: { description: "a" }
      })
    })

    it("Literal", () => {
      assertFromAST(Schema.Literal("hello"), { _tag: "Literal", annotations: undefined, literal: "hello" })
      assertFromAST(Schema.Literal("hello").annotate({ description: "a" }), {
        _tag: "Literal",
        annotations: { description: "a" },
        literal: "hello"
      })
    })

    it("UniqueSymbol", () => {
      assertFromAST(Schema.UniqueSymbol(Symbol.for("test")), {
        _tag: "UniqueSymbol",
        annotations: undefined,
        symbol: Symbol.for("test")
      })
      assertFromAST(Schema.UniqueSymbol(Symbol.for("test")).annotate({ description: "a" }), {
        _tag: "UniqueSymbol",
        annotations: { description: "a" },
        symbol: Symbol.for("test")
      })
    })

    it("ObjectKeyword", () => {
      assertFromAST(Schema.ObjectKeyword, { _tag: "ObjectKeyword", annotations: undefined })
      assertFromAST(Schema.ObjectKeyword.annotate({ description: "a" }), {
        _tag: "ObjectKeyword",
        annotations: { description: "a" }
      })
    })

    it("Enum", () => {
      assertFromAST(Schema.Enum({ A: "a", B: "b" }), {
        _tag: "Enum",
        annotations: undefined,
        enums: [["A", "a"], ["B", "b"]]
      })
      assertFromAST(Schema.Enum({ A: "a", B: "b" }).annotate({ description: "a" }), {
        _tag: "Enum",
        annotations: { description: "a" },
        enums: [["A", "a"], ["B", "b"]]
      })
    })

    it("TemplateLiteral", () => {
      assertFromAST(Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]), {
        _tag: "TemplateLiteral",
        annotations: undefined,
        parts: [
          { _tag: "String", annotations: undefined, checks: [] },
          {
            _tag: "Literal",
            annotations: undefined,
            literal: "-"
          },
          { _tag: "Number", annotations: undefined, checks: [] }
        ]
      })
      assertFromAST(
        Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]).annotate({ description: "a" }),
        {
          _tag: "TemplateLiteral",
          annotations: { description: "a" },
          parts: [
            { _tag: "String", annotations: undefined, checks: [] },
            { _tag: "Literal", annotations: undefined, literal: "-" },
            { _tag: "Number", annotations: undefined, checks: [] }
          ]
        }
      )
    })

    describe("Arrays", () => {
      it("empty tuple", () => {
        assertFromAST(Schema.Tuple([]), { _tag: "Arrays", annotations: undefined, elements: [], rest: [] })
        assertFromAST(Schema.Tuple([]).annotate({ description: "a" }), {
          _tag: "Arrays",
          annotations: { description: "a" },
          elements: [],
          rest: []
        })
      })
    })

    describe("Objects", () => {
      it("empty struct", () => {
        assertFromAST(Schema.Struct({}), {
          _tag: "Objects",
          annotations: undefined,
          propertySignatures: [],
          indexSignatures: []
        })
        assertFromAST(Schema.Struct({}).annotate({ description: "a" }), {
          _tag: "Objects",
          annotations: { description: "a" },
          propertySignatures: [],
          indexSignatures: []
        })
      })

      it("properties", () => {
        assertFromAST(
          Schema.Struct({
            a: Schema.String,
            b: Schema.mutableKey(Schema.String),
            c: Schema.optionalKey(Schema.String),
            d: Schema.mutableKey(Schema.optionalKey(Schema.String)),
            e: Schema.optionalKey(Schema.mutableKey(Schema.String))
          }),
          {
            _tag: "Objects",
            annotations: undefined,
            propertySignatures: [
              {
                name: "a",
                type: { _tag: "String", annotations: undefined, checks: [] },
                isOptional: false,
                isMutable: false,
                annotations: undefined
              },
              {
                name: "b",
                type: { _tag: "String", annotations: undefined, checks: [] },
                isOptional: false,
                isMutable: true,
                annotations: undefined
              },
              {
                name: "c",
                type: { _tag: "String", annotations: undefined, checks: [] },
                isOptional: true,
                isMutable: false,
                annotations: undefined
              },
              {
                name: "d",
                type: { _tag: "String", annotations: undefined, checks: [] },
                isOptional: true,
                isMutable: true,
                annotations: undefined
              },
              {
                name: "e",
                type: { _tag: "String", annotations: undefined, checks: [] },
                isOptional: true,
                isMutable: true,
                annotations: undefined
              }
            ],
            indexSignatures: []
          }
        )
      })

      it("annotateKey", () => {
        assertFromAST(
          Schema.Struct({
            a: Schema.String.annotateKey({ description: "a" })
          }),
          {
            _tag: "Objects",
            annotations: undefined,
            propertySignatures: [
              {
                name: "a",
                type: { _tag: "String", annotations: undefined, checks: [] },
                isOptional: false,
                isMutable: false,
                annotations: { description: "a" }
              }
            ],
            indexSignatures: []
          }
        )
      })
    })

    describe("Union", () => {
      it("anyOf", () => {
        assertFromAST(Schema.Union([Schema.String, Schema.Number]), {
          _tag: "Union",
          annotations: undefined,
          types: [
            { _tag: "String", annotations: undefined, checks: [] },
            { _tag: "Number", annotations: undefined, checks: [] }
          ],
          mode: "anyOf"
        })
        assertFromAST(Schema.Union([Schema.String, Schema.Number]).annotate({ description: "a" }), {
          _tag: "Union",
          annotations: { description: "a" },
          types: [
            { _tag: "String", annotations: undefined, checks: [] },
            { _tag: "Number", annotations: undefined, checks: [] }
          ],
          mode: "anyOf"
        })
      })

      it("oneOf", () => {
        assertFromAST(Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" }), {
          _tag: "Union",
          annotations: undefined,
          types: [
            { _tag: "String", annotations: undefined, checks: [] },
            { _tag: "Number", annotations: undefined, checks: [] }
          ],
          mode: "oneOf"
        })
      })

      it("Literals", () => {
        assertFromAST(Schema.Literals(["a", 1]), {
          _tag: "Union",
          annotations: undefined,
          types: [
            { _tag: "Literal", annotations: undefined, literal: "a" },
            { _tag: "Literal", annotations: undefined, literal: 1 }
          ],
          mode: "anyOf"
        })
      })
    })
  })

  describe("toCode", () => {
    function assertToCode(schema: Schema.Top, expected: string) {
      const ast = StandardAST.fromAST(schema.ast)
      strictEqual(StandardAST.toCode(ast), expected)
    }

    describe("Declaration", () => {
      it("Option", () => {
        assertToCode(Schema.Option(Schema.String), "Schema.Option(Schema.String)")
      })

      it("declaration without typeConstructor annotation", () => {
        const schema = Schema.instanceOf(URL)
        assertFromAST(schema, { _tag: "External", annotations: undefined, typeParameters: [], checks: [] })
        assertToCode(schema, "Schema.Unknown")
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
        const ast = StandardAST.fromAST(Schema.UniqueSymbol(sym).ast)
        throws(
          () => StandardAST.toCode(ast),
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
})
