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
  describe("toGeneration", () => {
    function assertToGeneration(schema: Schema.Top, expected: SchemaStandard.Generation) {
      const document = SchemaStandard.fromAST(schema.ast)
      const generation = SchemaStandard.toGeneration(document, { reviver: SchemaStandard.toGenerationDefaultReviver })
      deepStrictEqual(generation, expected)
    }

    const makeGeneration = SchemaStandard.makeGeneration

    describe("Declaration", () => {
      it("declaration without typeConstructor annotation", () => {
        assertToGeneration(Schema.instanceOf(URL), makeGeneration("Schema.Unknown", "unknown"))
      })

      describe("Date", () => {
        it("Date", () => {
          assertToGeneration(Schema.Date, makeGeneration("Schema.Date", "Date"))
        })

        it("Date & check", () => {
          assertToGeneration(
            Schema.Date.check(Schema.isGreaterThanDate(new Date(0))),
            makeGeneration("Schema.Date.check(Schema.isGreaterThanDate(new Date(0)))", "Date")
          )
        })
      })

      it("Option(String)", () => {
        assertToGeneration(
          Schema.Option(Schema.String),
          makeGeneration("Schema.Option(Schema.String)", "Option<string>")
        )
      })
    })

    it("Null", () => {
      assertToGeneration(Schema.Null, makeGeneration("Schema.Null", "null"))
      assertToGeneration(
        Schema.Null.annotate({ "description": "a" }),
        makeGeneration(`Schema.Null.annotate({ "description": "a" })`, "null")
      )
      assertToGeneration(Schema.Null.annotate({}), makeGeneration("Schema.Null", "null"))
    })

    it("Undefined", () => {
      assertToGeneration(Schema.Undefined, makeGeneration("Schema.Undefined", "undefined"))
      assertToGeneration(
        Schema.Undefined.annotate({ "description": "a" }),
        makeGeneration(`Schema.Undefined.annotate({ "description": "a" })`, "undefined")
      )
    })

    it("Void", () => {
      assertToGeneration(Schema.Void, makeGeneration("Schema.Void", "void"))
      assertToGeneration(
        Schema.Void.annotate({ "description": "a" }),
        makeGeneration(`Schema.Void.annotate({ "description": "a" })`, "void")
      )
    })

    it("Never", () => {
      assertToGeneration(Schema.Never, makeGeneration("Schema.Never", "never"))
      assertToGeneration(
        Schema.Never.annotate({ "description": "a" }),
        makeGeneration(`Schema.Never.annotate({ "description": "a" })`, "never")
      )
    })

    it("Unknown", () => {
      assertToGeneration(Schema.Unknown, makeGeneration("Schema.Unknown", "unknown"))
      assertToGeneration(
        Schema.Unknown.annotate({ "description": "a" }),
        makeGeneration(`Schema.Unknown.annotate({ "description": "a" })`, "unknown")
      )
    })

    it("Any", () => {
      assertToGeneration(Schema.Any, makeGeneration("Schema.Any", "any"))
      assertToGeneration(
        Schema.Any.annotate({ "description": "a" }),
        makeGeneration(`Schema.Any.annotate({ "description": "a" })`, "any")
      )
    })

    describe("String", () => {
      it("String", () => {
        assertToGeneration(Schema.String, makeGeneration("Schema.String", "string"))
      })

      it("String & annotations", () => {
        assertToGeneration(
          Schema.String.annotate({ "description": "a" }),
          makeGeneration(`Schema.String.annotate({ "description": "a" })`, "string")
        )
      })

      it("String & check", () => {
        assertToGeneration(
          Schema.String.check(Schema.isMinLength(1)),
          makeGeneration(`Schema.String.check(Schema.isMinLength(1))`, "string")
        )
      })

      it("String & annotations & check", () => {
        assertToGeneration(
          Schema.String.annotate({ "description": "a" }).check(Schema.isMinLength(1)),
          makeGeneration(
            `Schema.String.annotate({ "description": "a" }).check(Schema.isMinLength(1))`,
            "string"
          )
        )
      })

      it("String & check + annotations", () => {
        assertToGeneration(
          Schema.String.check(Schema.isMinLength(1, { description: "a" })),
          makeGeneration(`Schema.String.check(Schema.isMinLength(1, { "description": "a" }))`, "string")
        )
      })

      it("String & check & annotations", () => {
        assertToGeneration(
          Schema.String.check(Schema.isMinLength(1)).annotate({ "description": "a" }),
          makeGeneration(`Schema.String.check(Schema.isMinLength(1, { "description": "a" }))`, "string")
        )
      })
    })

    describe("Number", () => {
      it("Number", () => {
        assertToGeneration(Schema.Number, makeGeneration("Schema.Number", "number"))
        assertToGeneration(
          Schema.Number.annotate({ "description": "a" }),
          makeGeneration(`Schema.Number.annotate({ "description": "a" })`, "number")
        )
      })

      it("Number & check", () => {
        assertToGeneration(
          Schema.Number.check(Schema.isGreaterThan(10)),
          makeGeneration(`Schema.Number.check(Schema.isGreaterThan(10))`, "number")
        )
      })
    })

    it("Boolean", () => {
      assertToGeneration(Schema.Boolean, makeGeneration("Schema.Boolean", "boolean"))
      assertToGeneration(
        Schema.Boolean.annotate({ "description": "a" }),
        makeGeneration(`Schema.Boolean.annotate({ "description": "a" })`, "boolean")
      )
    })

    describe("BigInt", () => {
      it("BigInt", () => {
        assertToGeneration(Schema.BigInt, makeGeneration("Schema.BigInt", "bigint"))
        assertToGeneration(
          Schema.BigInt.annotate({ "description": "a" }),
          makeGeneration(`Schema.BigInt.annotate({ "description": "a" })`, "bigint")
        )
      })

      it("BigInt & check", () => {
        assertToGeneration(
          Schema.BigInt.check(Schema.isGreaterThanBigInt(10n)),
          makeGeneration(`Schema.BigInt.check(Schema.isGreaterThanBigInt(10n))`, "bigint")
        )
      })
    })

    it("Symbol", () => {
      assertToGeneration(Schema.Symbol, makeGeneration("Schema.Symbol", "symbol"))
      assertToGeneration(
        Schema.Symbol.annotate({ "description": "a" }),
        makeGeneration(`Schema.Symbol.annotate({ "description": "a" })`, "symbol")
      )
    })

    it("ObjectKeyword", () => {
      assertToGeneration(Schema.ObjectKeyword, makeGeneration("Schema.ObjectKeyword", "object"))
      assertToGeneration(
        Schema.ObjectKeyword.annotate({ "description": "a" }),
        makeGeneration(`Schema.ObjectKeyword.annotate({ "description": "a" })`, "object")
      )
    })

    describe("Literal", () => {
      it("string literal", () => {
        assertToGeneration(Schema.Literal("a"), makeGeneration(`Schema.Literal("a")`, `"a"`))
        assertToGeneration(
          Schema.Literal("a").annotate({ "description": "a" }),
          makeGeneration(`Schema.Literal("a").annotate({ "description": "a" })`, `"a"`)
        )
      })

      it("number literal", () => {
        assertToGeneration(Schema.Literal(1), makeGeneration(`Schema.Literal(1)`, "1"))
        assertToGeneration(
          Schema.Literal(1).annotate({ "description": "a" }),
          makeGeneration(`Schema.Literal(1).annotate({ "description": "a" })`, "1")
        )
      })

      it("boolean literal", () => {
        assertToGeneration(Schema.Literal(true), makeGeneration(`Schema.Literal(true)`, "true"))
        assertToGeneration(
          Schema.Literal(true).annotate({ "description": "a" }),
          makeGeneration(`Schema.Literal(true).annotate({ "description": "a" })`, "true")
        )
      })

      it("bigint literal", () => {
        assertToGeneration(Schema.Literal(100n), makeGeneration(`Schema.Literal(100n)`, "100n"))
        assertToGeneration(
          Schema.Literal(100n).annotate({ "description": "a" }),
          makeGeneration(`Schema.Literal(100n).annotate({ "description": "a" })`, "100n")
        )
      })
    })

    describe("UniqueSymbol", () => {
      it("should format unique symbol", () => {
        assertToGeneration(
          Schema.UniqueSymbol(Symbol.for("test")),
          makeGeneration(`Schema.UniqueSymbol(Symbol.for("test"))`, "symbol")
        )
      })

      it("should throw error for symbol created without Symbol.for()", () => {
        const sym = Symbol("test")
        const document = SchemaStandard.fromAST(Schema.UniqueSymbol(sym).ast)
        throws(
          () => SchemaStandard.toGeneration(document),
          "Cannot generate code for UniqueSymbol created without Symbol.for()"
        )
      })
    })

    describe("Enum", () => {
      it("should format enum with string values", () => {
        assertToGeneration(
          Schema.Enum({
            A: "a",
            B: "b"
          }),
          makeGeneration(`Schema.Enum([["A", "a"], ["B", "b"]])`, "string")
        )
        assertToGeneration(
          Schema.Enum({
            A: "a",
            B: "b"
          }).annotate({ "description": "q" }),
          makeGeneration(`Schema.Enum([["A", "a"], ["B", "b"]]).annotate({ "description": "q" })`, "string")
        )
      })

      it("should format enum with number values", () => {
        assertToGeneration(
          Schema.Enum({
            One: 1,
            Two: 2
          }),
          makeGeneration(`Schema.Enum([["One", 1], ["Two", 2]])`, "number")
        )
        assertToGeneration(
          Schema.Enum({
            One: 1,
            Two: 2
          }).annotate({ "description": "r" }),
          makeGeneration(`Schema.Enum([["One", 1], ["Two", 2]]).annotate({ "description": "r" })`, "number")
        )
      })

      it("should format enum with mixed values", () => {
        assertToGeneration(
          Schema.Enum({
            A: "a",
            One: 1
          }),
          makeGeneration(`Schema.Enum([["A", "a"], ["One", 1]])`, "string | number")
        )
        assertToGeneration(
          Schema.Enum({
            A: "a",
            One: 1
          }).annotate({ "description": "s" }),
          makeGeneration(`Schema.Enum([["A", "a"], ["One", 1]]).annotate({ "description": "s" })`, "string | number")
        )
      })
    })

    describe("TemplateLiteral", () => {
      it("empty template literal", () => {
        assertToGeneration(
          Schema.TemplateLiteral([]),
          makeGeneration(`Schema.TemplateLiteral([])`, "``")
        )
      })

      it("string literal", () => {
        assertToGeneration(
          Schema.TemplateLiteral([Schema.Literal("a")]),
          makeGeneration(`Schema.TemplateLiteral([Schema.Literal("a")])`, "`a`")
        )
      })

      it("number literal", () => {
        assertToGeneration(
          Schema.TemplateLiteral([Schema.Literal(1)]),
          makeGeneration(`Schema.TemplateLiteral([Schema.Literal(1)])`, "`1`")
        )
      })

      it("bigint literal", () => {
        assertToGeneration(
          Schema.TemplateLiteral([Schema.Literal(1n)]),
          makeGeneration(`Schema.TemplateLiteral([Schema.Literal(1n)])`, "`1`")
        )
      })

      it("multiple consecutive literals", () => {
        assertToGeneration(
          Schema.TemplateLiteral([Schema.Literal("a"), Schema.Literal("b"), Schema.Literal("c")]),
          makeGeneration(
            `Schema.TemplateLiteral([Schema.Literal("a"), Schema.Literal("b"), Schema.Literal("c")])`,
            "`abc`"
          )
        )
      })

      it("special characters in literals", () => {
        assertToGeneration(
          Schema.TemplateLiteral([Schema.Literal("a b"), Schema.String]),
          makeGeneration(
            `Schema.TemplateLiteral([Schema.Literal("a b"), Schema.String])`,
            "`a b${string}`"
          )
        )
        assertToGeneration(
          Schema.TemplateLiteral([Schema.Literal("\n"), Schema.String]),
          makeGeneration(
            `Schema.TemplateLiteral([Schema.Literal("\\n"), Schema.String])`,
            "`\n${string}`"
          )
        )
      })

      it("only schemas", () => {
        assertToGeneration(
          Schema.TemplateLiteral([Schema.String]),
          makeGeneration(`Schema.TemplateLiteral([Schema.String])`, "`${string}`")
        )
        assertToGeneration(
          Schema.TemplateLiteral([Schema.Number]),
          makeGeneration(`Schema.TemplateLiteral([Schema.Number])`, "`${number}`")
        )
        assertToGeneration(
          Schema.TemplateLiteral([Schema.BigInt]),
          makeGeneration(`Schema.TemplateLiteral([Schema.BigInt])`, "`${bigint}`")
        )
        assertToGeneration(
          Schema.TemplateLiteral([Schema.String, Schema.Number]),
          makeGeneration(
            `Schema.TemplateLiteral([Schema.String, Schema.Number])`,
            "`${string}${number}`"
          )
        )
      })

      it("schema & literal", () => {
        assertToGeneration(
          Schema.TemplateLiteral([Schema.String, Schema.Literal("a")]),
          makeGeneration(
            `Schema.TemplateLiteral([Schema.String, Schema.Literal("a")])`,
            "`${string}a`"
          )
        )
        assertToGeneration(
          Schema.TemplateLiteral([Schema.Number, Schema.Literal("a")]),
          makeGeneration(
            `Schema.TemplateLiteral([Schema.Number, Schema.Literal("a")])`,
            "`${number}a`"
          )
        )
        assertToGeneration(
          Schema.TemplateLiteral([Schema.BigInt, Schema.Literal("a")]),
          makeGeneration(
            `Schema.TemplateLiteral([Schema.BigInt, Schema.Literal("a")])`,
            "`${bigint}a`"
          )
        )
      })

      it("literal & schema", () => {
        assertToGeneration(
          Schema.TemplateLiteral([Schema.Literal("a"), Schema.String]),
          makeGeneration(
            `Schema.TemplateLiteral([Schema.Literal("a"), Schema.String])`,
            "`a${string}`"
          )
        )
        assertToGeneration(
          Schema.TemplateLiteral([Schema.Literal("a"), Schema.Number]),
          makeGeneration(
            `Schema.TemplateLiteral([Schema.Literal("a"), Schema.Number])`,
            "`a${number}`"
          )
        )
        assertToGeneration(
          Schema.TemplateLiteral([Schema.Literal("a"), Schema.BigInt]),
          makeGeneration(
            `Schema.TemplateLiteral([Schema.Literal("a"), Schema.BigInt])`,
            "`a${bigint}`"
          )
        )
      })

      it("schema & literal & schema", () => {
        assertToGeneration(
          Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]),
          makeGeneration(
            `Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number])`,
            "`${string}-${number}`"
          )
        )
        assertToGeneration(
          Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]).annotate({ "description": "ad" }),
          makeGeneration(
            `Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]).annotate({ "description": "ad" })`,
            "`${string}-${number}`"
          )
        )
      })

      it("TemplateLiteral as part", () => {
        assertToGeneration(
          Schema.TemplateLiteral([
            Schema.Literal("a"),
            Schema.TemplateLiteral([Schema.String, Schema.Literals(["-", "+"]), Schema.Number])
          ]),
          makeGeneration(
            `Schema.TemplateLiteral([Schema.Literal("a"), Schema.TemplateLiteral([Schema.String, Schema.Literals(["-", "+"]), Schema.Number])])`,
            "`a${string}-${number}` | `a${string}+${number}`"
          )
        )
      })

      it("Union as part", () => {
        assertToGeneration(
          Schema.TemplateLiteral([Schema.Literal("a"), Schema.Union([Schema.String, Schema.Number])]),
          makeGeneration(
            `Schema.TemplateLiteral([Schema.Literal("a"), Schema.Union([Schema.String, Schema.Number])])`,
            "`a${string}` | `a${number}`"
          )
        )
      })

      it("Literals as part", () => {
        assertToGeneration(
          Schema.TemplateLiteral([Schema.Literals(["a", "b"]), Schema.String]),
          makeGeneration(
            `Schema.TemplateLiteral([Schema.Literals(["a", "b"]), Schema.String])`,
            "`a${string}` | `b${string}`"
          )
        )
      })

      it("multiple unions", () => {
        assertToGeneration(
          Schema.TemplateLiteral([
            Schema.Union([Schema.Literal("a"), Schema.Literal("b")]),
            Schema.String,
            Schema.Union([Schema.Number, Schema.BigInt])
          ]),
          makeGeneration(
            `Schema.TemplateLiteral([Schema.Literals(["a", "b"]), Schema.String, Schema.Union([Schema.BigInt, Schema.Number])])`,
            "`a${string}${bigint}` | `a${string}${number}` | `b${string}${bigint}` | `b${string}${number}`"
          )
        )
      })
    })

    describe("Arrays", () => {
      describe("Tuple", () => {
        it("empty tuple", () => {
          assertToGeneration(Schema.Tuple([]), makeGeneration("Schema.Tuple([])", "readonly []"))
          assertToGeneration(
            Schema.Tuple([]).annotate({ "description": "a" }),
            makeGeneration(`Schema.Tuple([]).annotate({ "description": "a" })`, "readonly []")
          )
        })

        it("required element", () => {
          assertToGeneration(
            Schema.Tuple([Schema.String]),
            makeGeneration(`Schema.Tuple([Schema.String])`, "readonly [string]")
          )
          assertToGeneration(
            Schema.Tuple([Schema.String]).annotate({ "description": "a" }),
            makeGeneration(
              `Schema.Tuple([Schema.String]).annotate({ "description": "a" })`,
              "readonly [string]"
            )
          )
        })

        it("optional element", () => {
          assertToGeneration(
            Schema.Tuple([Schema.optionalKey(Schema.String)]),
            makeGeneration(`Schema.Tuple([Schema.optionalKey(Schema.String)])`, "readonly [string?]")
          )
          assertToGeneration(
            Schema.Tuple([Schema.optionalKey(Schema.String)]).annotate({ "description": "a" }),
            makeGeneration(
              `Schema.Tuple([Schema.optionalKey(Schema.String)]).annotate({ "description": "a" })`,
              "readonly [string?]"
            )
          )
        })

        it("annotateKey", () => {
          assertToGeneration(
            Schema.Tuple([Schema.String.annotateKey({ "description": "a" })]),
            makeGeneration(`Schema.Tuple([Schema.String.annotateKey({ "description": "a" })])`, "readonly [string]")
          )
        })
      })

      it("Array", () => {
        assertToGeneration(
          Schema.Array(Schema.String),
          makeGeneration("Schema.Array(Schema.String)", "ReadonlyArray<string>")
        )
        assertToGeneration(
          Schema.Array(Schema.String).annotate({ "description": "a" }),
          makeGeneration(
            `Schema.Array(Schema.String).annotate({ "description": "a" })`,
            "ReadonlyArray<string>"
          )
        )
      })

      it("TupleWithRest", () => {
        assertToGeneration(
          Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]),
          makeGeneration(
            `Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number])`,
            "readonly [string, ...Array<number>]"
          )
        )
        assertToGeneration(
          Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]).annotate({ "description": "a" }),
          makeGeneration(
            `Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]).annotate({ "description": "a" })`,
            "readonly [string, ...Array<number>]"
          )
        )
        assertToGeneration(
          Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number, Schema.Boolean]),
          makeGeneration(
            `Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number, Schema.Boolean])`,
            "readonly [string, ...Array<number>, boolean]"
          )
        )
      })
    })

    describe("Objects", () => {
      it("empty struct", () => {
        assertToGeneration(Schema.Struct({}), makeGeneration("Schema.Struct({  })", "{  }"))
        assertToGeneration(
          Schema.Struct({}).annotate({ "description": "a" }),
          makeGeneration(`Schema.Struct({  }).annotate({ "description": "a" })`, "{  }")
        )
      })

      it("required properties", () => {
        assertToGeneration(
          Schema.Struct({
            a: Schema.String
          }),
          makeGeneration(
            `Schema.Struct({ "a": Schema.String })`,
            `{ readonly "a": string }`
          )
        )
        assertToGeneration(
          Schema.Struct({
            a: Schema.String,
            b: Schema.Number
          }),
          makeGeneration(
            `Schema.Struct({ "a": Schema.String, "b": Schema.Number })`,
            `{ readonly "a": string, readonly "b": number }`
          )
        )
      })

      it("optional properties", () => {
        assertToGeneration(
          Schema.Struct({
            a: Schema.optionalKey(Schema.String)
          }),
          makeGeneration(
            `Schema.Struct({ "a": Schema.optionalKey(Schema.String) })`,
            `{ readonly "a"?: string }`
          )
        )
      })

      it("mutable properties", () => {
        assertToGeneration(
          Schema.Struct({
            a: Schema.mutableKey(Schema.String)
          }),
          makeGeneration(
            `Schema.Struct({ "a": Schema.mutableKey(Schema.String) })`,
            `{ "a": string }`
          )
        )
      })

      it("optional and mutable properties", () => {
        assertToGeneration(
          Schema.Struct({
            a: Schema.optionalKey(Schema.mutableKey(Schema.String))
          }),
          makeGeneration(
            `Schema.Struct({ "a": Schema.optionalKey(Schema.mutableKey(Schema.String)) })`,
            `{ "a"?: string }`
          )
        )
      })

      it("annotateKey", () => {
        assertToGeneration(
          Schema.Struct({
            a: Schema.String.annotateKey({ "description": "a" })
          }),
          makeGeneration(
            `Schema.Struct({ "a": Schema.String.annotateKey({ "description": "a" }) })`,
            `{ readonly "a": string }`
          )
        )
      })

      it("struct with symbol property key", () => {
        const sym = Symbol.for("test")
        assertToGeneration(
          Schema.Struct({
            [sym]: Schema.String
          }),
          makeGeneration(
            `Schema.Struct({ [Symbol.for("test")]: Schema.String })`,
            `{ readonly [typeof Symbol.for("test")]: string }`
          )
        )
      })
    })

    describe("Union", () => {
      it("union with anyOf mode (default)", () => {
        assertToGeneration(
          Schema.Union([Schema.String, Schema.Number]),
          makeGeneration("Schema.Union([Schema.String, Schema.Number])", "string | number")
        )
        assertToGeneration(
          Schema.Union([Schema.String, Schema.Number]).annotate({ "description": "z" }),
          makeGeneration(
            `Schema.Union([Schema.String, Schema.Number]).annotate({ "description": "z" })`,
            "string | number"
          )
        )
      })

      it("union with oneOf mode", () => {
        assertToGeneration(
          Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" }),
          makeGeneration(`Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" })`, "string | number")
        )
        assertToGeneration(
          Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" }).annotate({ "description": "aa" }),
          makeGeneration(
            `Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" }).annotate({ "description": "aa" })`,
            "string | number"
          )
        )
      })

      it("union with multiple types", () => {
        assertToGeneration(
          Schema.Union([Schema.String, Schema.Number, Schema.Boolean]),
          makeGeneration("Schema.Union([Schema.String, Schema.Number, Schema.Boolean])", "string | number | boolean")
        )
        assertToGeneration(
          Schema.Union([Schema.String, Schema.Number, Schema.Boolean]).annotate({ "description": "a" }),
          makeGeneration(
            `Schema.Union([Schema.String, Schema.Number, Schema.Boolean]).annotate({ "description": "a" })`,
            "string | number | boolean"
          )
        )
      })
    })

    describe("Suspend", () => {
      it("non-recursive", () => {
        assertToGeneration(
          Schema.suspend(() => Schema.String),
          makeGeneration(`Schema.suspend((): Schema.Codec<string, string> => Schema.String)`, "string")
        )
        assertToGeneration(
          Schema.suspend(() => Schema.String.annotate({ identifier: "ID" })),
          makeGeneration(`Schema.suspend((): Schema.Codec<ID, IDEncoded> => ID)`, "ID", "IDEncoded")
        )
      })

      describe("recursive", () => {
        it("outer identifier", () => {
          assertToGeneration(
            OuterCategory,
            makeGeneration(
              `Schema.Struct({ "name": Schema.String, "children": Schema.Array(Schema.suspend((): Schema.Codec<Category, CategoryEncoded> => Category)) }).annotate({ "identifier": "Category" })`,
              `{ readonly "name": string, readonly "children": ReadonlyArray<Category> }`,
              `{ readonly "name": string, readonly "children": ReadonlyArray<CategoryEncoded> }`
            )
          )
        })

        it("inner identifier", () => {
          assertToGeneration(
            InnerCategory,
            makeGeneration(
              `Schema.Struct({ "name": Schema.String, "children": Schema.Array(Schema.suspend((): Schema.Codec<Category, CategoryEncoded> => Category)) })`,
              `{ readonly "name": string, readonly "children": ReadonlyArray<Category> }`,
              `{ readonly "name": string, readonly "children": ReadonlyArray<CategoryEncoded> }`
            )
          )
        })
      })
    })

    describe("nested structures", () => {
      it("tuple with struct elements", () => {
        assertToGeneration(
          Schema.Tuple([
            Schema.Struct({ a: Schema.String }),
            Schema.Struct({ b: Schema.Number })
          ]),
          makeGeneration(
            `Schema.Tuple([Schema.Struct({ "a": Schema.String }), Schema.Struct({ "b": Schema.Number })])`,
            `readonly [{ readonly "a": string }, { readonly "b": number }]`
          )
        )
      })

      it("nested struct", () => {
        assertToGeneration(
          Schema.Struct({
            user: Schema.Struct({
              a: Schema.String,
              b: Schema.Number
            })
          }),
          makeGeneration(
            `Schema.Struct({ "user": Schema.Struct({ "a": Schema.String, "b": Schema.Number }) })`,
            `{ readonly "user": { readonly "a": string, readonly "b": number } }`
          )
        )
      })

      it("union of structs", () => {
        assertToGeneration(
          Schema.Union([
            Schema.Struct({ type: Schema.Literal("a"), value: Schema.String }),
            Schema.Struct({ type: Schema.Literal("b"), value: Schema.Number })
          ]),
          makeGeneration(
            `Schema.Union([Schema.Struct({ "type": Schema.Literal("a"), "value": Schema.String }), Schema.Struct({ "type": Schema.Literal("b"), "value": Schema.Number })])`,
            `{ readonly "type": "a", readonly "value": string } | { readonly "type": "b", readonly "value": number }`
          )
        )
      })
    })
  })

  describe("fromJsonSchemaDocument", () => {
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
      const document = JsonSchema.fromSchemaDraft2020_12(schema)
      deepStrictEqual(
        SchemaStandard.fromJsonSchemaDocument(document),
        expectedDocument
      )
      if (code !== undefined) {
        strictEqual(SchemaStandard.toGeneration(expectedDocument).runtime, code)
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
            $ref: "#/$defs/a",
            $defs: {
              a: {
                type: "string"
              }
            }
          },
          {
            schema: { _tag: "Reference", $ref: "a" },
            definitions: {
              a: { _tag: "String", checks: [] }
            }
          }
        )
      })

      it("should resolve the $ref if there are annotations", () => {
        assertFromJsonSchema(
          {
            $ref: "#/$defs/a",
            description: "a",
            $defs: {
              a: {
                type: "string"
              }
            }
          },
          {
            schema: { _tag: "String", checks: [], annotations: { description: "a" } },
            definitions: {
              a: { _tag: "String", checks: [] }
            }
          }
        )
      })

      it("should resolve the $ref if there is an allOf", () => {
        assertFromJsonSchema(
          {
            allOf: [
              { $ref: "#/$defs/a" },
              { description: "a" }
            ],
            $defs: {
              a: {
                type: "string"
              }
            }
          },
          {
            schema: { _tag: "String", checks: [], annotations: { description: "a" } },
            definitions: {
              a: { _tag: "String", checks: [] }
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

  describe("toJsonSchemaMultiDocument", () => {
    it("should handle multiple schemas", () => {
      const a = Schema.String.annotate({ identifier: "id", description: "a" })
      const b = a.annotate({ description: "b" })
      const multiDocument = SchemaStandard.fromASTs([a.ast, b.ast])
      const jsonMultiDocument = SchemaStandard.toJsonSchemaMultiDocument(multiDocument)
      deepStrictEqual(jsonMultiDocument, {
        dialect: "draft-2020-12",
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
      deepStrictEqual(jd, { dialect: "draft-2020-12", definitions: {}, ...expected })
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

  describe("toSchema", () => {
    function assertToSchema(schema: Schema.Top) {
      const document = SchemaStandard.fromAST(schema.ast)
      const roundtrip = SchemaStandard.fromAST(SchemaStandard.toSchema(document).ast)
      deepStrictEqual(roundtrip, document)
    }

    describe("String", () => {
      it("String", () => {
        assertToSchema(Schema.String)
      })

      it("String & check", () => {
        assertToSchema(Schema.String.check(Schema.isMinLength(1)))
      })

      describe("checks", () => {
        it("isTrimmed", () => {
          assertToSchema(Schema.String.check(Schema.isTrimmed()))
        })

        it("isULID", () => {
          assertToSchema(Schema.String.check(Schema.isULID()))
        })
      })
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

  describe("topologicalSort", () => {
    function assertTopologicalSort(
      definitions: Record<string, SchemaStandard.Standard>,
      expected: SchemaStandard.TopologicalSort
    ) {
      deepStrictEqual(SchemaStandard.topologicalSort(definitions), expected)
    }

    it("empty definitions", () => {
      assertTopologicalSort(
        {},
        { nonRecursives: [], recursives: {} }
      )
    })

    it("single definition with no dependencies", () => {
      assertTopologicalSort(
        {
          A: { _tag: "String", checks: [] }
        },
        {
          nonRecursives: [
            { $ref: "A", schema: { _tag: "String", checks: [] } }
          ],
          recursives: {}
        }
      )
    })

    it("multiple independent definitions", () => {
      assertTopologicalSort({
        A: { _tag: "String", checks: [] },
        B: { _tag: "Number", checks: [] },
        C: { _tag: "Boolean" }
      }, {
        nonRecursives: [
          { $ref: "A", schema: { _tag: "String", checks: [] } },
          { $ref: "B", schema: { _tag: "Number", checks: [] } },
          { $ref: "C", schema: { _tag: "Boolean" } }
        ],
        recursives: {}
      })
    })

    it("A -> B -> C", () => {
      assertTopologicalSort({
        A: { _tag: "String", checks: [] },
        B: { _tag: "Reference", $ref: "A" },
        C: { _tag: "Reference", $ref: "B" }
      }, {
        nonRecursives: [
          { $ref: "A", schema: { _tag: "String", checks: [] } },
          { $ref: "B", schema: { _tag: "Reference", $ref: "A" } },
          { $ref: "C", schema: { _tag: "Reference", $ref: "B" } }
        ],
        recursives: {}
      })
    })

    it("A -> B, A -> C", () => {
      assertTopologicalSort({
        A: { _tag: "String", checks: [] },
        B: { _tag: "Reference", $ref: "A" },
        C: { _tag: "Reference", $ref: "A" }
      }, {
        nonRecursives: [
          { $ref: "A", schema: { _tag: "String", checks: [] } },
          { $ref: "B", schema: { _tag: "Reference", $ref: "A" } },
          { $ref: "C", schema: { _tag: "Reference", $ref: "A" } }
        ],
        recursives: {}
      })
    })

    it("A -> B -> C, A -> D", () => {
      assertTopologicalSort({
        A: { _tag: "String", checks: [] },
        B: { _tag: "Reference", $ref: "A" },
        C: { _tag: "Reference", $ref: "B" },
        D: { _tag: "Reference", $ref: "A" }
      }, {
        nonRecursives: [
          { $ref: "A", schema: { _tag: "String", checks: [] } },
          { $ref: "B", schema: { _tag: "Reference", $ref: "A" } },
          { $ref: "D", schema: { _tag: "Reference", $ref: "A" } },
          { $ref: "C", schema: { _tag: "Reference", $ref: "B" } }
        ],
        recursives: {}
      })
    })

    it("self-referential definition (A -> A)", () => {
      assertTopologicalSort({
        A: { _tag: "Reference", $ref: "A" }
      }, {
        nonRecursives: [],
        recursives: {
          A: { _tag: "Reference", $ref: "A" }
        }
      })
    })

    it("mutual recursion (A -> B -> A)", () => {
      assertTopologicalSort({
        A: { _tag: "Reference", $ref: "B" },
        B: { _tag: "Reference", $ref: "A" }
      }, {
        nonRecursives: [],
        recursives: {
          A: { _tag: "Reference", $ref: "B" },
          B: { _tag: "Reference", $ref: "A" }
        }
      })
    })

    it("complex cycle (A -> B -> C -> A)", () => {
      assertTopologicalSort({
        A: { _tag: "Reference", $ref: "B" },
        B: { _tag: "Reference", $ref: "C" },
        C: { _tag: "Reference", $ref: "A" }
      }, {
        nonRecursives: [],
        recursives: {
          A: { _tag: "Reference", $ref: "B" },
          B: { _tag: "Reference", $ref: "C" },
          C: { _tag: "Reference", $ref: "A" }
        }
      })
    })

    it("mixed recursive and non-recursive definitions", () => {
      assertTopologicalSort({
        A: { _tag: "String", checks: [] },
        B: { _tag: "Reference", $ref: "A" },
        C: { _tag: "Reference", $ref: "C" },
        D: { _tag: "Reference", $ref: "E" },
        E: { _tag: "Reference", $ref: "D" }
      }, {
        nonRecursives: [
          { $ref: "A", schema: { _tag: "String", checks: [] } },
          { $ref: "B", schema: { _tag: "Reference", $ref: "A" } }
        ],
        recursives: {
          C: { _tag: "Reference", $ref: "C" },
          D: { _tag: "Reference", $ref: "E" },
          E: { _tag: "Reference", $ref: "D" }
        }
      })
    })

    it("nested $ref in object properties", () => {
      assertTopologicalSort({
        A: { _tag: "String", checks: [] },
        B: {
          _tag: "Objects",
          propertySignatures: [{
            name: "value",
            type: { _tag: "Reference", $ref: "A" },
            isOptional: false,
            isMutable: false
          }],
          indexSignatures: [],
          checks: []
        }
      }, {
        nonRecursives: [
          { $ref: "A", schema: { _tag: "String", checks: [] } },
          {
            $ref: "B",
            schema: {
              _tag: "Objects",
              propertySignatures: [{
                name: "value",
                type: { _tag: "Reference", $ref: "A" },
                isOptional: false,
                isMutable: false
              }],
              indexSignatures: [],
              checks: []
            }
          }
        ],
        recursives: {}
      })
    })

    it("nested $ref in array rest", () => {
      assertTopologicalSort({
        A: { _tag: "String", checks: [] },
        B: {
          _tag: "Arrays",
          elements: [],
          rest: [{ _tag: "Reference", $ref: "A" }],
          checks: []
        }
      }, {
        nonRecursives: [
          { $ref: "A", schema: { _tag: "String", checks: [] } },
          { $ref: "B", schema: { _tag: "Arrays", elements: [], rest: [{ _tag: "Reference", $ref: "A" }], checks: [] } }
        ],
        recursives: {}
      })
    })

    it("external $ref (not in definitions) should be ignored", () => {
      assertTopologicalSort({
        A: { _tag: "Reference", $ref: "#/definitions/External" },
        B: { _tag: "Reference", $ref: "A" }
      }, {
        nonRecursives: [
          { $ref: "A", schema: { _tag: "Reference", $ref: "#/definitions/External" } },
          { $ref: "B", schema: { _tag: "Reference", $ref: "A" } }
        ],
        recursives: {}
      })
    })

    it("multiple cycles with independent definitions", () => {
      assertTopologicalSort({
        Independent: { _tag: "String", checks: [] },
        A: { _tag: "Reference", $ref: "B" },
        B: { _tag: "Reference", $ref: "A" },
        C: { _tag: "Reference", $ref: "D" },
        D: { _tag: "Reference", $ref: "C" }
      }, {
        nonRecursives: [
          { $ref: "Independent", schema: { _tag: "String", checks: [] } }
        ],
        recursives: {
          A: { _tag: "Reference", $ref: "B" },
          B: { _tag: "Reference", $ref: "A" },
          C: { _tag: "Reference", $ref: "D" },
          D: { _tag: "Reference", $ref: "C" }
        }
      })
    })

    it("definition depending on recursive definition", () => {
      assertTopologicalSort({
        A: { _tag: "Reference", $ref: "A" },
        B: { _tag: "Reference", $ref: "A" }
      }, {
        nonRecursives: [
          { $ref: "B", schema: { _tag: "Reference", $ref: "A" } }
        ],
        recursives: {
          A: { _tag: "Reference", $ref: "A" }
        }
      })
    })
  })
})
