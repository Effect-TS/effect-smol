import { Option, Redacted } from "effect/data"
import { Check, Schema, ToPretty } from "effect/schema"
import { DateTime, Duration } from "effect/time"
import { describe, it } from "vitest"
import { strictEqual, throws } from "../utils/assert.ts"

describe("ToPretty", () => {
  it("Any", () => {
    const pretty = ToPretty.make(Schema.Any)
    strictEqual(pretty(1), "1")
    strictEqual(pretty("a"), `"a"`)
    strictEqual(pretty(true), "true")
    strictEqual(pretty(false), "false")
    strictEqual(pretty(null), "null")
    strictEqual(pretty(undefined), "undefined")
    strictEqual(pretty({ a: 1 }), `{"a":1}`)
    strictEqual(pretty([1, 2, 3]), `[1,2,3]`)
  })

  it("Unknown", () => {
    const pretty = ToPretty.make(Schema.Unknown)
    strictEqual(pretty(1), "1")
    strictEqual(pretty("a"), `"a"`)
    strictEqual(pretty(true), "true")
    strictEqual(pretty(false), "false")
    strictEqual(pretty(null), "null")
    strictEqual(pretty(undefined), "undefined")
    strictEqual(pretty({ a: 1 }), `{"a":1}`)
    strictEqual(pretty([1, 2, 3]), `[1,2,3]`)
  })

  it("Void", () => {
    const pretty = ToPretty.make(Schema.Void)
    strictEqual(pretty(undefined), "void(0)")
  })

  it("Null", () => {
    const pretty = ToPretty.make(Schema.Null)
    strictEqual(pretty(null), "null")
  })

  it("String", () => {
    const pretty = ToPretty.make(Schema.String)
    strictEqual(pretty("a"), `"a"`)
  })

  it("Number", () => {
    const pretty = ToPretty.make(Schema.Number)
    strictEqual(pretty(1), "1")
  })

  it("Boolean", () => {
    const pretty = ToPretty.make(Schema.Boolean)
    strictEqual(pretty(true), "true")
    strictEqual(pretty(false), "false")
  })

  it("BigInt", () => {
    const pretty = ToPretty.make(Schema.BigInt)
    strictEqual(pretty(1n), "1n")
  })

  it("Symbol", () => {
    const pretty = ToPretty.make(Schema.Symbol)
    strictEqual(pretty(Symbol.for("a")), "Symbol(a)")
  })

  it("UniqueSymbol", () => {
    const pretty = ToPretty.make(Schema.UniqueSymbol(Symbol.for("a")))
    strictEqual(pretty(Symbol.for("a")), "Symbol(a)")
  })

  it("Object", () => {
    const pretty = ToPretty.make(Schema.Object)
    strictEqual(pretty({}), "{}")
    strictEqual(pretty({ a: 1 }), `{"a":1}`)
    strictEqual(pretty([1, 2, 3]), `[1,2,3]`)
  })

  describe("Literal", () => {
    it("string", () => {
      const pretty = ToPretty.make(Schema.Literal("a"))
      strictEqual(pretty("a"), `"a"`)
    })

    it("number", () => {
      const pretty = ToPretty.make(Schema.Literal(1))
      strictEqual(pretty(1), "1")
    })

    it("boolean", () => {
      const pretty = ToPretty.make(Schema.Literal(true))
      strictEqual(pretty(true), "true")
    })

    it("bigint", () => {
      const pretty = ToPretty.make(Schema.Literal(1n))
      strictEqual(pretty(1n), "1n")
    })
  })

  it("Literals", () => {
    const pretty = ToPretty.make(Schema.Literals(["a", "b", "c"]))
    strictEqual(pretty("a"), `"a"`)
    strictEqual(pretty("b"), `"b"`)
    strictEqual(pretty("c"), `"c"`)
  })

  it("TemplateLiteral", () => {
    const pretty = ToPretty.make(Schema.TemplateLiteral([Schema.Literal("a"), Schema.String]))
    strictEqual(pretty("a"), `"a"`)
    strictEqual(pretty("ab"), `"ab"`)
  })

  describe("Enums", () => {
    it("Numeric enums", () => {
      enum Fruits {
        Apple,
        Banana
      }
      const pretty = ToPretty.make(Schema.Enums(Fruits))
      strictEqual(pretty(Fruits.Apple), "0")
    })

    it("String enums", () => {
      enum Fruits {
        Apple = "apple",
        Banana = "banana",
        Cantaloupe = 0
      }
      const pretty = ToPretty.make(Schema.Enums(Fruits))
      strictEqual(pretty(Fruits.Apple), `"apple"`)
    })

    it("Const enums", () => {
      const Fruits = {
        Apple: "apple",
        Banana: "banana",
        Cantaloupe: 3
      } as const
      const pretty = ToPretty.make(Schema.Enums(Fruits))
      strictEqual(pretty(Fruits.Apple), `"apple"`)
    })
  })

  it("Union", () => {
    const pretty = ToPretty.make(Schema.Union([Schema.String, Schema.Number]))
    strictEqual(pretty("a"), `"a"`)
    strictEqual(pretty(1), "1")
  })

  describe("Tuple", () => {
    it("empty", () => {
      const pretty = ToPretty.make(Schema.Tuple([]))
      strictEqual(pretty([]), "[]")
    })

    it("elements", () => {
      const pretty = ToPretty.make(Schema.Tuple([Schema.Option(Schema.String)]))
      strictEqual(pretty([Option.some("a")]), `[some("a")]`)
      strictEqual(pretty([Option.none()]), `[none()]`)
    })
  })

  it("Array", () => {
    const pretty = ToPretty.make(Schema.Array(Schema.Option(Schema.String)))
    strictEqual(pretty([Option.some("a")]), `[some("a")]`)
    strictEqual(pretty([Option.none()]), `[none()]`)
  })

  it("TupleWithRest", () => {
    const pretty = ToPretty.make(
      Schema.TupleWithRest(Schema.Tuple([Schema.Option(Schema.Boolean)]), [
        Schema.Option(Schema.Number),
        Schema.Option(Schema.String)
      ])
    )
    strictEqual(pretty([Option.some(true), Option.some(1), Option.some("a")]), `[some(true), some(1), some("a")]`)
    strictEqual(pretty([Option.none(), Option.none(), Option.some("a")]), `[none(), none(), some("a")]`)
  })

  describe("Struct", () => {
    it("empty", () => {
      const pretty = ToPretty.make(Schema.Struct({}))
      strictEqual(pretty({}), "{}")
      strictEqual(pretty(1), "1")
      strictEqual(pretty("a"), `"a"`)
      strictEqual(pretty(true), "true")
      strictEqual(pretty(false), "false")
      strictEqual(pretty({ a: 1 }), `{"a":1}`)
      strictEqual(pretty([1, 2, 3]), `[1,2,3]`)
    })

    it("required fields", () => {
      const pretty = ToPretty.make(Schema.Struct({
        a: Schema.Option(Schema.String)
      }))
      strictEqual(pretty({ a: Option.some("a") }), `{ "a": some("a") }`)
      strictEqual(pretty({ a: Option.none() }), `{ "a": none() }`)
    })

    it("required field with undefined", () => {
      const pretty = ToPretty.make(Schema.Struct({
        a: Schema.Option(Schema.UndefinedOr(Schema.String))
      }))
      strictEqual(pretty({ a: Option.some("a") }), `{ "a": some("a") }`)
      strictEqual(pretty({ a: Option.some(undefined) }), `{ "a": some(undefined) }`)
      strictEqual(pretty({ a: Option.none() }), `{ "a": none() }`)
    })

    it("optionalKey field", () => {
      const pretty = ToPretty.make(Schema.Struct({
        a: Schema.optionalKey(Schema.Option(Schema.String))
      }))
      strictEqual(pretty({ a: Option.some("a") }), `{ "a": some("a") }`)
      strictEqual(pretty({ a: Option.none() }), `{ "a": none() }`)
      strictEqual(pretty({}), `{}`)
    })

    it("optional field", () => {
      const pretty = ToPretty.make(Schema.Struct({
        a: Schema.optional(Schema.Option(Schema.String))
      }))
      strictEqual(pretty({ a: Option.some("a") }), `{ "a": some("a") }`)
      strictEqual(pretty({ a: Option.none() }), `{ "a": none() }`)
      strictEqual(pretty({ a: undefined }), `{ "a": undefined }`)
      strictEqual(pretty({}), `{}`)
    })
  })

  describe("Record", () => {
    it("Record(String, Option(Number))", () => {
      const pretty = ToPretty.make(Schema.Record(Schema.String, Schema.Option(Schema.Number)))
      strictEqual(pretty({ a: Option.some(1) }), `{ "a": some(1) }`)
      strictEqual(pretty({ a: Option.none() }), `{ "a": none() }`)
    })

    it("Record(Symbol, Option(Number))", () => {
      const pretty = ToPretty.make(Schema.Record(Schema.Symbol, Schema.Option(Schema.Number)))
      strictEqual(pretty({ [Symbol.for("a")]: Option.some(1) }), `{ Symbol(a): some(1) }`)
      strictEqual(pretty({ [Symbol.for("a")]: Option.none() }), `{ Symbol(a): none() }`)
    })
  })

  it("StructWithRest", () => {
    const pretty = ToPretty.make(Schema.StructWithRest(
      Schema.Struct({ a: Schema.Number }),
      [Schema.Record(Schema.String, Schema.Number)]
    ))
    strictEqual(pretty({ a: 1, b: 2 }), `{ "a": 1, "b": 2 }`)
  })

  it("Class", () => {
    class A extends Schema.Class<A>("A")({
      a: Schema.Option(Schema.String)
    }) {}
    const pretty = ToPretty.make(A)
    strictEqual(pretty({ a: Option.some("a") }), `A({ "a": some("a") })`)
    strictEqual(pretty({ a: Option.none() }), `A({ "a": none() })`)
  })

  describe("suspend", () => {
    it("Tuple", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Tuple([
        Schema.Number,
        Schema.NullOr(Rec)
      ])
      const pretty = ToPretty.make(schema)
      strictEqual(pretty([1, null]), `[1, null]`)
      strictEqual(pretty([1, [2, null]]), `[1, [2, null]]`)
    })

    it("Array", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema: any = Schema.Array(Schema.Union([Schema.String, Rec]))
      const pretty = ToPretty.make(schema)
      strictEqual(pretty(["a"]), `["a"]`)
    })

    it("Struct", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Struct({
        a: Schema.String,
        as: Schema.Array(Rec)
      })
      const pretty = ToPretty.make(schema)
      strictEqual(
        pretty({ a: "a", as: [{ a: "b", as: [] }, { a: "c", as: [] }] }),
        `{ "a": "a", "as": [{ "a": "b", "as": [] }, { "a": "c", "as": [] }] }`
      )
    })

    it("Record", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Record(Schema.String, Rec)
      const pretty = ToPretty.make(schema)
      strictEqual(pretty({ a: { a: { a: {} } } }), `{ "a": { "a": { "a": {} } } }`)
    })

    it("optional", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema: any = Schema.Struct({
        a: Schema.optional(Rec)
      })
      const pretty = ToPretty.make(schema)
      strictEqual(pretty({ a: "a" }), `{ "a": "a" }`)
    })

    it("Array + Array", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema: any = Schema.Struct({
        a: Schema.Array(Rec),
        b: Schema.Array(Rec)
      })
      const pretty = ToPretty.make(schema)
      strictEqual(
        pretty({
          a: [{ a: [{ a: [], b: [] }], b: [] }],
          b: [{ a: [], b: [] }]
        }),
        `{ "a": [{ "a": [{ "a": [], "b": [] }], "b": [] }], "b": [{ "a": [], "b": [] }] }`
      )
    })

    it("optional + Array", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema: any = Schema.Struct({
        a: Schema.optional(Rec),
        b: Schema.Array(Rec)
      })
      const pretty = ToPretty.make(schema)
      strictEqual(pretty({ a: "a", b: [{ a: "b", b: [] }] }), `{ "a": "a", "b": [{ "a": "b", "b": [] }] }`)
    })

    it("mutually suspended schemas", () => {
      interface Expression {
        readonly type: "expression"
        readonly value: number | Operation
      }

      interface Operation {
        readonly type: "operation"
        readonly operator: "+" | "-"
        readonly left: Expression
        readonly right: Expression
      }

      const Expression = Schema.Struct({
        type: Schema.Literal("expression"),
        value: Schema.Union([Schema.Finite, Schema.suspend((): Schema.Codec<Operation> => Operation)])
      })

      const Operation = Schema.Struct({
        type: Schema.Literal("operation"),
        operator: Schema.Literals(["+", "-"]),
        left: Expression,
        right: Expression
      })
      const pretty = ToPretty.make(Operation)
      strictEqual(
        pretty({
          type: "operation",
          operator: "+",
          left: { type: "expression", value: 1 },
          right: { type: "expression", value: 2 }
        }),
        `{ "type": "operation", "operator": "+", "left": { "type": "expression", "value": 1 }, "right": { "type": "expression", "value": 2 } }`
      )
    })

    it("Option", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Struct({
        a: Schema.String,
        as: Schema.Option(Rec)
      })
      const pretty = ToPretty.make(schema)
      strictEqual(
        pretty({ a: "a", as: Option.some({ a: "b", as: Option.none() }) }),
        `{ "a": "a", "as": some({ "a": "b", "as": none() }) }`
      )
    })

    it("Map", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Map(Schema.String, Rec)
      const pretty = ToPretty.make(schema)
      strictEqual(
        pretty(new Map([["a", new Map([["b", new Map()]])]])),
        `Map(1) { "a" => Map(1) { "b" => Map(0) {} } }`
      )
    })
  })

  it("Date", () => {
    const pretty = ToPretty.make(Schema.Date)
    strictEqual(pretty(new Date(0)), "1970-01-01T00:00:00.000Z")
  })

  it("URL", () => {
    const pretty = ToPretty.make(Schema.URL)
    strictEqual(pretty(new URL("https://www.example.com")), "https://www.example.com/")
  })

  it("Option(String)", () => {
    const pretty = ToPretty.make(Schema.Option(Schema.String))
    strictEqual(pretty(Option.some("a")), `some("a")`)
    strictEqual(pretty(Option.none()), "none()")
  })

  it("Map(String, Number)", () => {
    const pretty = ToPretty.make(Schema.Map(Schema.String, Schema.Option(Schema.Number)))
    strictEqual(pretty(new Map([["a", Option.some(1)]])), `Map(1) { "a" => some(1) }`)
    strictEqual(pretty(new Map([["a", Option.none()]])), `Map(1) { "a" => none() }`)
  })

  it("Redacted(String)", () => {
    const pretty = ToPretty.make(Schema.Redacted(Schema.String))
    strictEqual(pretty(Redacted.make("a")), `<redacted>`)
  })

  it("Duration", () => {
    const pretty = ToPretty.make(Schema.Duration)
    strictEqual(pretty(Duration.millis(100)), `100 millis`)
    strictEqual(pretty(Duration.nanos(1000n)), `1000 nanos`)
    strictEqual(pretty(Duration.infinity), "Infinity")
  })

  it("DateTimeUtc", () => {
    const pretty = ToPretty.make(Schema.DateTimeUtc)
    strictEqual(pretty(DateTime.unsafeMake("2021-01-01T00:00:00.000Z")), "DateTime.Utc(2021-01-01T00:00:00.000Z)")
  })

  describe("Annotations", () => {
    it("should throw on non-declaration ASTs", () => {
      const schema = Schema.String.annotate({
        pretty: { _tag: "Declaration", declaration: () => (s: string) => s.toUpperCase() }
      })
      throws(() => ToPretty.make(schema), new Error("Declaration annotation found on non-declaration AST"))
    })

    describe("Override annotation", () => {
      it("String", () => {
        const schema = Schema.String.pipe(ToPretty.override(() => (s) => s.toUpperCase()))
        const pretty = ToPretty.make(schema)
        strictEqual(pretty("a"), "A")
      })

      it("String & minLength(1)", () => {
        const schema = Schema.String.check(Check.minLength(1)).pipe(ToPretty.override(() => (s) => s.toUpperCase()))
        const pretty = ToPretty.make(schema)
        strictEqual(pretty("a"), "A")
      })
    })
  })

  it("should allow for custom compilers", () => {
    const alg = {
      ...ToPretty.defaultReducerAlg,
      "BooleanKeyword": () => (b: boolean) => b ? "True" : "False"
    }
    const make = ToPretty.getReducer(alg)
    strictEqual(make(Schema.Boolean)(true), `True`)
    const schema = Schema.Tuple([Schema.String, Schema.Boolean])
    strictEqual(make(schema)(["a", true]), `["a", True]`)
  })
})
