import { DateTime, Duration } from "effect"
import { Option, Redacted, Result } from "effect/data"
import { Schema, ToFormat } from "effect/schema"
import { describe, it } from "vitest"
import { strictEqual } from "../utils/assert.ts"

describe("ToFormat", () => {
  it("Any", () => {
    const format = ToFormat.make(Schema.Any)
    strictEqual(format(1), "1")
    strictEqual(format("a"), `"a"`)
    strictEqual(format(true), "true")
    strictEqual(format(false), "false")
    strictEqual(format(null), "null")
    strictEqual(format(undefined), "undefined")
    strictEqual(format({ a: 1 }), `{"a":1}`)
    strictEqual(format([1, 2, 3]), `[1,2,3]`)
  })

  it("Unknown", () => {
    const format = ToFormat.make(Schema.Unknown)
    strictEqual(format(1), "1")
    strictEqual(format("a"), `"a"`)
    strictEqual(format(true), "true")
    strictEqual(format(false), "false")
    strictEqual(format(null), "null")
    strictEqual(format(undefined), "undefined")
    strictEqual(format({ a: 1 }), `{"a":1}`)
    strictEqual(format([1, 2, 3]), `[1,2,3]`)
  })

  it("Void", () => {
    const format = ToFormat.make(Schema.Void)
    strictEqual(format(undefined), "void")
  })

  it("Null", () => {
    const format = ToFormat.make(Schema.Null)
    strictEqual(format(null), "null")
  })

  it("String", () => {
    const format = ToFormat.make(Schema.String)
    strictEqual(format("a"), `"a"`)
  })

  it("Number", () => {
    const format = ToFormat.make(Schema.Number)
    strictEqual(format(1), "1")
  })

  it("Boolean", () => {
    const format = ToFormat.make(Schema.Boolean)
    strictEqual(format(true), "true")
    strictEqual(format(false), "false")
  })

  it("BigInt", () => {
    const format = ToFormat.make(Schema.BigInt)
    strictEqual(format(1n), "1n")
  })

  it("Symbol", () => {
    const format = ToFormat.make(Schema.Symbol)
    strictEqual(format(Symbol.for("a")), "Symbol(a)")
  })

  it("UniqueSymbol", () => {
    const format = ToFormat.make(Schema.UniqueSymbol(Symbol.for("a")))
    strictEqual(format(Symbol.for("a")), "Symbol(a)")
  })

  it("Object", () => {
    const format = ToFormat.make(Schema.Object)
    strictEqual(format({}), "{}")
    strictEqual(format({ a: 1 }), `{"a":1}`)
    strictEqual(format([1, 2, 3]), `[1,2,3]`)
  })

  describe("Literal", () => {
    it("string", () => {
      const format = ToFormat.make(Schema.Literal("a"))
      strictEqual(format("a"), `"a"`)
    })

    it("number", () => {
      const format = ToFormat.make(Schema.Literal(1))
      strictEqual(format(1), "1")
    })

    it("boolean", () => {
      const format = ToFormat.make(Schema.Literal(true))
      strictEqual(format(true), "true")
    })

    it("bigint", () => {
      const format = ToFormat.make(Schema.Literal(1n))
      strictEqual(format(1n), "1n")
    })
  })

  it("Literals", () => {
    const format = ToFormat.make(Schema.Literals(["a", "b", "c"]))
    strictEqual(format("a"), `"a"`)
    strictEqual(format("b"), `"b"`)
    strictEqual(format("c"), `"c"`)
  })

  it("TemplateLiteral", () => {
    const format = ToFormat.make(Schema.TemplateLiteral([Schema.Literal("a"), Schema.String]))
    strictEqual(format("a"), `"a"`)
    strictEqual(format("ab"), `"ab"`)
  })

  describe("Enums", () => {
    it("Numeric enums", () => {
      enum Fruits {
        Apple,
        Banana
      }
      const format = ToFormat.make(Schema.Enums(Fruits))
      strictEqual(format(Fruits.Apple), "0")
    })

    it("String enums", () => {
      enum Fruits {
        Apple = "apple",
        Banana = "banana",
        Cantaloupe = 0
      }
      const format = ToFormat.make(Schema.Enums(Fruits))
      strictEqual(format(Fruits.Apple), `"apple"`)
    })

    it("Const enums", () => {
      const Fruits = {
        Apple: "apple",
        Banana: "banana",
        Cantaloupe: 3
      } as const
      const format = ToFormat.make(Schema.Enums(Fruits))
      strictEqual(format(Fruits.Apple), `"apple"`)
    })
  })

  it("Union", () => {
    const format = ToFormat.make(Schema.Union([Schema.String, Schema.Number]))
    strictEqual(format("a"), `"a"`)
    strictEqual(format(1), "1")
  })

  describe("Tuple", () => {
    it("empty", () => {
      const format = ToFormat.make(Schema.Tuple([]))
      strictEqual(format([]), "[]")
    })

    it("elements", () => {
      const format = ToFormat.make(Schema.Tuple([Schema.Option(Schema.String)]))
      strictEqual(format([Option.some("a")]), `[some("a")]`)
      strictEqual(format([Option.none()]), `[none()]`)
    })
  })

  it("Array", () => {
    const format = ToFormat.make(Schema.Array(Schema.Option(Schema.String)))
    strictEqual(format([Option.some("a")]), `[some("a")]`)
    strictEqual(format([Option.none()]), `[none()]`)
  })

  it("TupleWithRest", () => {
    const format = ToFormat.make(
      Schema.TupleWithRest(Schema.Tuple([Schema.Option(Schema.Boolean)]), [
        Schema.Option(Schema.Number),
        Schema.Option(Schema.String)
      ])
    )
    strictEqual(format([Option.some(true), Option.some(1), Option.some("a")]), `[some(true), some(1), some("a")]`)
    strictEqual(format([Option.none(), Option.none(), Option.some("a")]), `[none(), none(), some("a")]`)
  })

  describe("Struct", () => {
    it("empty", () => {
      const format = ToFormat.make(Schema.Struct({}))
      strictEqual(format({}), "{}")
      strictEqual(format(1), "1")
      strictEqual(format("a"), `"a"`)
      strictEqual(format(true), "true")
      strictEqual(format(false), "false")
      strictEqual(format({ a: 1 }), `{"a":1}`)
      strictEqual(format([1, 2, 3]), `[1,2,3]`)
    })

    it("required fields", () => {
      const format = ToFormat.make(Schema.Struct({
        a: Schema.Option(Schema.String)
      }))
      strictEqual(format({ a: Option.some("a") }), `{ "a": some("a") }`)
      strictEqual(format({ a: Option.none() }), `{ "a": none() }`)
    })

    it("required field with undefined", () => {
      const format = ToFormat.make(Schema.Struct({
        a: Schema.Option(Schema.UndefinedOr(Schema.String))
      }))
      strictEqual(format({ a: Option.some("a") }), `{ "a": some("a") }`)
      strictEqual(format({ a: Option.some(undefined) }), `{ "a": some(undefined) }`)
      strictEqual(format({ a: Option.none() }), `{ "a": none() }`)
    })

    it("optionalKey field", () => {
      const format = ToFormat.make(Schema.Struct({
        a: Schema.optionalKey(Schema.Option(Schema.String))
      }))
      strictEqual(format({ a: Option.some("a") }), `{ "a": some("a") }`)
      strictEqual(format({ a: Option.none() }), `{ "a": none() }`)
      strictEqual(format({}), `{}`)
    })

    it("optional field", () => {
      const format = ToFormat.make(Schema.Struct({
        a: Schema.optional(Schema.Option(Schema.String))
      }))
      strictEqual(format({ a: Option.some("a") }), `{ "a": some("a") }`)
      strictEqual(format({ a: Option.none() }), `{ "a": none() }`)
      strictEqual(format({ a: undefined }), `{ "a": undefined }`)
      strictEqual(format({}), `{}`)
    })
  })

  describe("Record", () => {
    it("Record(String, Option(Number))", () => {
      const format = ToFormat.make(Schema.Record(Schema.String, Schema.Option(Schema.Number)))
      strictEqual(format({ a: Option.some(1) }), `{ "a": some(1) }`)
      strictEqual(format({ a: Option.none() }), `{ "a": none() }`)
    })

    it("Record(Symbol, Option(Number))", () => {
      const format = ToFormat.make(Schema.Record(Schema.Symbol, Schema.Option(Schema.Number)))
      strictEqual(format({ [Symbol.for("a")]: Option.some(1) }), `{ Symbol(a): some(1) }`)
      strictEqual(format({ [Symbol.for("a")]: Option.none() }), `{ Symbol(a): none() }`)
    })
  })

  it("StructWithRest", () => {
    const format = ToFormat.make(Schema.StructWithRest(
      Schema.Struct({ a: Schema.Number }),
      [Schema.Record(Schema.String, Schema.Number)]
    ))
    strictEqual(format({ a: 1, b: 2 }), `{ "a": 1, "b": 2 }`)
  })

  it("Class", () => {
    class A extends Schema.Class<A>("A")({
      a: Schema.Option(Schema.String)
    }) {}
    const format = ToFormat.make(A)
    strictEqual(format({ a: Option.some("a") }), `A({ "a": some("a") })`)
    strictEqual(format({ a: Option.none() }), `A({ "a": none() })`)
  })

  describe("suspend", () => {
    it("Tuple", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Tuple([
        Schema.Number,
        Schema.NullOr(Rec)
      ])
      const format = ToFormat.make(schema)
      strictEqual(format([1, null]), `[1, null]`)
      strictEqual(format([1, [2, null]]), `[1, [2, null]]`)
    })

    it("Array", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema: any = Schema.Array(Schema.Union([Schema.String, Rec]))
      const format = ToFormat.make(schema)
      strictEqual(format(["a"]), `["a"]`)
    })

    it("Struct", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Struct({
        a: Schema.String,
        as: Schema.Array(Rec)
      })
      const format = ToFormat.make(schema)
      strictEqual(
        format({ a: "a", as: [{ a: "b", as: [] }, { a: "c", as: [] }] }),
        `{ "a": "a", "as": [{ "a": "b", "as": [] }, { "a": "c", "as": [] }] }`
      )
    })

    it("Record", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Record(Schema.String, Rec)
      const format = ToFormat.make(schema)
      strictEqual(format({ a: { a: { a: {} } } }), `{ "a": { "a": { "a": {} } } }`)
    })

    it("optional", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema: any = Schema.Struct({
        a: Schema.optional(Rec)
      })
      const format = ToFormat.make(schema)
      strictEqual(format({ a: "a" }), `{ "a": "a" }`)
    })

    it("Array + Array", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema: any = Schema.Struct({
        a: Schema.Array(Rec),
        b: Schema.Array(Rec)
      })
      const format = ToFormat.make(schema)
      strictEqual(
        format({
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
      const format = ToFormat.make(schema)
      strictEqual(format({ a: "a", b: [{ a: "b", b: [] }] }), `{ "a": "a", "b": [{ "a": "b", "b": [] }] }`)
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
      const format = ToFormat.make(Operation)
      strictEqual(
        format({
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
      const format = ToFormat.make(schema)
      strictEqual(
        format({ a: "a", as: Option.some({ a: "b", as: Option.none() }) }),
        `{ "a": "a", "as": some({ "a": "b", "as": none() }) }`
      )
    })

    it("ReadonlySet", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.ReadonlySet(Rec)
      const format = ToFormat.make(schema)
      strictEqual(format(new Set()), `ReadonlySet(0) {}`)
      strictEqual(format(new Set([new Set([new Set()])])), `ReadonlySet(1) { ReadonlySet(1) { ReadonlySet(0) {} } }`)
    })

    it("ReadonlyMap", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.ReadonlyMap(Schema.String, Rec)
      const format = ToFormat.make(schema)
      strictEqual(format(new Map()), `ReadonlyMap(0) {}`)
      strictEqual(
        format(new Map([["a", new Map([["b", new Map()]])]])),
        `ReadonlyMap(1) { "a" => ReadonlyMap(1) { "b" => ReadonlyMap(0) {} } }`
      )
    })
  })

  it("Date", () => {
    const format = ToFormat.make(Schema.Date)
    strictEqual(format(new Date(0)), "1970-01-01T00:00:00.000Z")
  })

  it("URL", () => {
    const format = ToFormat.make(Schema.URL)
    strictEqual(format(new URL("https://www.example.com")), "https://www.example.com/")
  })

  it("Option(String)", () => {
    const format = ToFormat.make(Schema.Option(Schema.String))
    strictEqual(format(Option.some("a")), `some("a")`)
    strictEqual(format(Option.none()), "none()")
  })

  it("Result(Number, String)", () => {
    const format = ToFormat.make(Schema.Result(Schema.Number, Schema.String))
    strictEqual(format(Result.succeed(1)), `success(1)`)
    strictEqual(format(Result.fail("a")), `failure("a")`)
  })

  it("ReadonlyMap(String, Option(Number))", () => {
    const format = ToFormat.make(Schema.ReadonlyMap(Schema.String, Schema.Option(Schema.Number)))
    strictEqual(format(new Map([["a", Option.some(1)]])), `ReadonlyMap(1) { "a" => some(1) }`)
    strictEqual(format(new Map([["a", Option.none()]])), `ReadonlyMap(1) { "a" => none() }`)
  })

  describe("Redacted", () => {
    it("Redacted(String)", () => {
      const format = ToFormat.make(Schema.Redacted(Schema.String))
      strictEqual(format(Redacted.make("a")), `<redacted>`)
    })

    it("with label", () => {
      const format = ToFormat.make(Schema.Redacted(Schema.String, { label: "password" }))
      strictEqual(format(Redacted.make("a", { label: "password" })), `<redacted:password>`)
    })
  })

  it("Duration", () => {
    const format = ToFormat.make(Schema.Duration)
    strictEqual(format(Duration.millis(100)), `100 millis`)
    strictEqual(format(Duration.nanos(1000n)), `1000 nanos`)
    strictEqual(format(Duration.infinity), "Infinity")
  })

  it("DateTimeUtc", () => {
    const format = ToFormat.make(Schema.DateTimeUtc)
    strictEqual(format(DateTime.makeUnsafe("2021-01-01T00:00:00.000Z")), "DateTime.Utc(2021-01-01T00:00:00.000Z)")
  })

  it("custom class", () => {
    class A {
      constructor(readonly a: string) {}
    }
    const schema = Schema.instanceOf(A)
    const format = ToFormat.make(schema)
    strictEqual(format(new A("a")), `A({"a":"a"})`)
  })

  it("custom class with a toString() method", () => {
    class A {
      constructor(readonly a: string) {}
      toString() {
        return `A(${this.a})`
      }
    }
    const schema = Schema.instanceOf(A)
    const format = ToFormat.make(schema)
    strictEqual(format(new A("a")), `A(a)`)
  })

  describe("Annotations", () => {
    describe("Override annotation", () => {
      it("String", () => {
        const schema = Schema.String.pipe(ToFormat.override(() => (s) => s.toUpperCase()))
        const format = ToFormat.make(schema)
        strictEqual(format("a"), "A")
      })

      it("String & isMinLength(1)", () => {
        const schema = Schema.String.check(Schema.isMinLength(1)).pipe(ToFormat.override(() => (s) => s.toUpperCase()))
        const format = ToFormat.make(schema)
        strictEqual(format("a"), "A")
      })
    })
  })

  it("should allow for custom compilers", () => {
    const alg = {
      ...ToFormat.defaultReducerAlg,
      "BooleanKeyword": () => (b: boolean) => b ? "True" : "False"
    }
    const make = ToFormat.getReducer(alg)
    strictEqual(make(Schema.Boolean)(true), `True`)
    const schema = Schema.Tuple([Schema.String, Schema.Boolean])
    strictEqual(make(schema)(["a", true]), `["a", True]`)
  })
})
