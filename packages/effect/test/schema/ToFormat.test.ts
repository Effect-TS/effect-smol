import { DateTime, Duration } from "effect"
import { Option, Redacted, Result } from "effect/data"
import { Check, Schema, ToFormat } from "effect/schema"
import { describe, it } from "vitest"
import { strictEqual } from "../utils/assert.ts"

describe("ToFormat", () => {
  it("Any", () => {
    const show = ToFormat.make(Schema.Any)
    strictEqual(show(1), "1")
    strictEqual(show("a"), `"a"`)
    strictEqual(show(true), "true")
    strictEqual(show(false), "false")
    strictEqual(show(null), "null")
    strictEqual(show(undefined), "undefined")
    strictEqual(show({ a: 1 }), `{"a":1}`)
    strictEqual(show([1, 2, 3]), `[1,2,3]`)
  })

  it("Unknown", () => {
    const show = ToFormat.make(Schema.Unknown)
    strictEqual(show(1), "1")
    strictEqual(show("a"), `"a"`)
    strictEqual(show(true), "true")
    strictEqual(show(false), "false")
    strictEqual(show(null), "null")
    strictEqual(show(undefined), "undefined")
    strictEqual(show({ a: 1 }), `{"a":1}`)
    strictEqual(show([1, 2, 3]), `[1,2,3]`)
  })

  it("Void", () => {
    const show = ToFormat.make(Schema.Void)
    strictEqual(show(undefined), "void")
  })

  it("Null", () => {
    const show = ToFormat.make(Schema.Null)
    strictEqual(show(null), "null")
  })

  it("String", () => {
    const show = ToFormat.make(Schema.String)
    strictEqual(show("a"), `"a"`)
  })

  it("Number", () => {
    const show = ToFormat.make(Schema.Number)
    strictEqual(show(1), "1")
  })

  it("Boolean", () => {
    const show = ToFormat.make(Schema.Boolean)
    strictEqual(show(true), "true")
    strictEqual(show(false), "false")
  })

  it("BigInt", () => {
    const show = ToFormat.make(Schema.BigInt)
    strictEqual(show(1n), "1n")
  })

  it("Symbol", () => {
    const show = ToFormat.make(Schema.Symbol)
    strictEqual(show(Symbol.for("a")), "Symbol(a)")
  })

  it("UniqueSymbol", () => {
    const show = ToFormat.make(Schema.UniqueSymbol(Symbol.for("a")))
    strictEqual(show(Symbol.for("a")), "Symbol(a)")
  })

  it("Object", () => {
    const show = ToFormat.make(Schema.Object)
    strictEqual(show({}), "{}")
    strictEqual(show({ a: 1 }), `{"a":1}`)
    strictEqual(show([1, 2, 3]), `[1,2,3]`)
  })

  describe("Literal", () => {
    it("string", () => {
      const show = ToFormat.make(Schema.Literal("a"))
      strictEqual(show("a"), `"a"`)
    })

    it("number", () => {
      const show = ToFormat.make(Schema.Literal(1))
      strictEqual(show(1), "1")
    })

    it("boolean", () => {
      const show = ToFormat.make(Schema.Literal(true))
      strictEqual(show(true), "true")
    })

    it("bigint", () => {
      const show = ToFormat.make(Schema.Literal(1n))
      strictEqual(show(1n), "1n")
    })
  })

  it("Literals", () => {
    const show = ToFormat.make(Schema.Literals(["a", "b", "c"]))
    strictEqual(show("a"), `"a"`)
    strictEqual(show("b"), `"b"`)
    strictEqual(show("c"), `"c"`)
  })

  it("TemplateLiteral", () => {
    const show = ToFormat.make(Schema.TemplateLiteral([Schema.Literal("a"), Schema.String]))
    strictEqual(show("a"), `"a"`)
    strictEqual(show("ab"), `"ab"`)
  })

  describe("Enums", () => {
    it("Numeric enums", () => {
      enum Fruits {
        Apple,
        Banana
      }
      const show = ToFormat.make(Schema.Enums(Fruits))
      strictEqual(show(Fruits.Apple), "0")
    })

    it("String enums", () => {
      enum Fruits {
        Apple = "apple",
        Banana = "banana",
        Cantaloupe = 0
      }
      const show = ToFormat.make(Schema.Enums(Fruits))
      strictEqual(show(Fruits.Apple), `"apple"`)
    })

    it("Const enums", () => {
      const Fruits = {
        Apple: "apple",
        Banana: "banana",
        Cantaloupe: 3
      } as const
      const show = ToFormat.make(Schema.Enums(Fruits))
      strictEqual(show(Fruits.Apple), `"apple"`)
    })
  })

  it("Union", () => {
    const show = ToFormat.make(Schema.Union([Schema.String, Schema.Number]))
    strictEqual(show("a"), `"a"`)
    strictEqual(show(1), "1")
  })

  describe("Tuple", () => {
    it("empty", () => {
      const show = ToFormat.make(Schema.Tuple([]))
      strictEqual(show([]), "[]")
    })

    it("elements", () => {
      const show = ToFormat.make(Schema.Tuple([Schema.Option(Schema.String)]))
      strictEqual(show([Option.some("a")]), `[some("a")]`)
      strictEqual(show([Option.none()]), `[none()]`)
    })
  })

  it("Array", () => {
    const show = ToFormat.make(Schema.Array(Schema.Option(Schema.String)))
    strictEqual(show([Option.some("a")]), `[some("a")]`)
    strictEqual(show([Option.none()]), `[none()]`)
  })

  it("TupleWithRest", () => {
    const show = ToFormat.make(
      Schema.TupleWithRest(Schema.Tuple([Schema.Option(Schema.Boolean)]), [
        Schema.Option(Schema.Number),
        Schema.Option(Schema.String)
      ])
    )
    strictEqual(show([Option.some(true), Option.some(1), Option.some("a")]), `[some(true), some(1), some("a")]`)
    strictEqual(show([Option.none(), Option.none(), Option.some("a")]), `[none(), none(), some("a")]`)
  })

  describe("Struct", () => {
    it("empty", () => {
      const show = ToFormat.make(Schema.Struct({}))
      strictEqual(show({}), "{}")
      strictEqual(show(1), "1")
      strictEqual(show("a"), `"a"`)
      strictEqual(show(true), "true")
      strictEqual(show(false), "false")
      strictEqual(show({ a: 1 }), `{"a":1}`)
      strictEqual(show([1, 2, 3]), `[1,2,3]`)
    })

    it("required fields", () => {
      const show = ToFormat.make(Schema.Struct({
        a: Schema.Option(Schema.String)
      }))
      strictEqual(show({ a: Option.some("a") }), `{ "a": some("a") }`)
      strictEqual(show({ a: Option.none() }), `{ "a": none() }`)
    })

    it("required field with undefined", () => {
      const show = ToFormat.make(Schema.Struct({
        a: Schema.Option(Schema.UndefinedOr(Schema.String))
      }))
      strictEqual(show({ a: Option.some("a") }), `{ "a": some("a") }`)
      strictEqual(show({ a: Option.some(undefined) }), `{ "a": some(undefined) }`)
      strictEqual(show({ a: Option.none() }), `{ "a": none() }`)
    })

    it("optionalKey field", () => {
      const show = ToFormat.make(Schema.Struct({
        a: Schema.optionalKey(Schema.Option(Schema.String))
      }))
      strictEqual(show({ a: Option.some("a") }), `{ "a": some("a") }`)
      strictEqual(show({ a: Option.none() }), `{ "a": none() }`)
      strictEqual(show({}), `{}`)
    })

    it("optional field", () => {
      const show = ToFormat.make(Schema.Struct({
        a: Schema.optional(Schema.Option(Schema.String))
      }))
      strictEqual(show({ a: Option.some("a") }), `{ "a": some("a") }`)
      strictEqual(show({ a: Option.none() }), `{ "a": none() }`)
      strictEqual(show({ a: undefined }), `{ "a": undefined }`)
      strictEqual(show({}), `{}`)
    })
  })

  describe("Record", () => {
    it("Record(String, Option(Number))", () => {
      const show = ToFormat.make(Schema.Record(Schema.String, Schema.Option(Schema.Number)))
      strictEqual(show({ a: Option.some(1) }), `{ "a": some(1) }`)
      strictEqual(show({ a: Option.none() }), `{ "a": none() }`)
    })

    it("Record(Symbol, Option(Number))", () => {
      const show = ToFormat.make(Schema.Record(Schema.Symbol, Schema.Option(Schema.Number)))
      strictEqual(show({ [Symbol.for("a")]: Option.some(1) }), `{ Symbol(a): some(1) }`)
      strictEqual(show({ [Symbol.for("a")]: Option.none() }), `{ Symbol(a): none() }`)
    })
  })

  it("StructWithRest", () => {
    const show = ToFormat.make(Schema.StructWithRest(
      Schema.Struct({ a: Schema.Number }),
      [Schema.Record(Schema.String, Schema.Number)]
    ))
    strictEqual(show({ a: 1, b: 2 }), `{ "a": 1, "b": 2 }`)
  })

  it("Class", () => {
    class A extends Schema.Class<A>("A")({
      a: Schema.Option(Schema.String)
    }) {}
    const show = ToFormat.make(A)
    strictEqual(show({ a: Option.some("a") }), `A({ "a": some("a") })`)
    strictEqual(show({ a: Option.none() }), `A({ "a": none() })`)
  })

  describe("suspend", () => {
    it("Tuple", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Tuple([
        Schema.Number,
        Schema.NullOr(Rec)
      ])
      const show = ToFormat.make(schema)
      strictEqual(show([1, null]), `[1, null]`)
      strictEqual(show([1, [2, null]]), `[1, [2, null]]`)
    })

    it("Array", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema: any = Schema.Array(Schema.Union([Schema.String, Rec]))
      const show = ToFormat.make(schema)
      strictEqual(show(["a"]), `["a"]`)
    })

    it("Struct", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Struct({
        a: Schema.String,
        as: Schema.Array(Rec)
      })
      const show = ToFormat.make(schema)
      strictEqual(
        show({ a: "a", as: [{ a: "b", as: [] }, { a: "c", as: [] }] }),
        `{ "a": "a", "as": [{ "a": "b", "as": [] }, { "a": "c", "as": [] }] }`
      )
    })

    it("Record", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Record(Schema.String, Rec)
      const show = ToFormat.make(schema)
      strictEqual(show({ a: { a: { a: {} } } }), `{ "a": { "a": { "a": {} } } }`)
    })

    it("optional", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema: any = Schema.Struct({
        a: Schema.optional(Rec)
      })
      const show = ToFormat.make(schema)
      strictEqual(show({ a: "a" }), `{ "a": "a" }`)
    })

    it("Array + Array", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema: any = Schema.Struct({
        a: Schema.Array(Rec),
        b: Schema.Array(Rec)
      })
      const show = ToFormat.make(schema)
      strictEqual(
        show({
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
      const show = ToFormat.make(schema)
      strictEqual(show({ a: "a", b: [{ a: "b", b: [] }] }), `{ "a": "a", "b": [{ "a": "b", "b": [] }] }`)
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
      const show = ToFormat.make(Operation)
      strictEqual(
        show({
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
      const show = ToFormat.make(schema)
      strictEqual(
        show({ a: "a", as: Option.some({ a: "b", as: Option.none() }) }),
        `{ "a": "a", "as": some({ "a": "b", "as": none() }) }`
      )
    })

    it("Map", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Map(Schema.String, Rec)
      const show = ToFormat.make(schema)
      strictEqual(
        show(new Map([["a", new Map([["b", new Map()]])]])),
        `Map(1) { "a" => Map(1) { "b" => Map(0) {} } }`
      )
    })
  })

  it("Date", () => {
    const show = ToFormat.make(Schema.Date)
    strictEqual(show(new Date(0)), "1970-01-01T00:00:00.000Z")
  })

  it("URL", () => {
    const show = ToFormat.make(Schema.URL)
    strictEqual(show(new URL("https://www.example.com")), "https://www.example.com/")
  })

  it("Option(String)", () => {
    const show = ToFormat.make(Schema.Option(Schema.String))
    strictEqual(show(Option.some("a")), `some("a")`)
    strictEqual(show(Option.none()), "none()")
  })

  it("Result(Number, String)", () => {
    const show = ToFormat.make(Schema.Result(Schema.Number, Schema.String))
    strictEqual(show(Result.succeed(1)), `success(1)`)
    strictEqual(show(Result.fail("a")), `failure("a")`)
  })

  it("Map(String, Option(Number))", () => {
    const show = ToFormat.make(Schema.Map(Schema.String, Schema.Option(Schema.Number)))
    strictEqual(show(new Map([["a", Option.some(1)]])), `Map(1) { "a" => some(1) }`)
    strictEqual(show(new Map([["a", Option.none()]])), `Map(1) { "a" => none() }`)
  })

  describe("Redacted", () => {
    it("Redacted(String)", () => {
      const show = ToFormat.make(Schema.Redacted(Schema.String))
      strictEqual(show(Redacted.make("a")), `<redacted>`)
    })

    it("with label", () => {
      const show = ToFormat.make(Schema.Redacted(Schema.String, { label: "password" }))
      strictEqual(show(Redacted.make("a", { label: "password" })), `<redacted:password>`)
    })
  })

  it("Duration", () => {
    const show = ToFormat.make(Schema.Duration)
    strictEqual(show(Duration.millis(100)), `100 millis`)
    strictEqual(show(Duration.nanos(1000n)), `1000 nanos`)
    strictEqual(show(Duration.infinity), "Infinity")
  })

  it("DateTimeUtc", () => {
    const show = ToFormat.make(Schema.DateTimeUtc)
    strictEqual(show(DateTime.makeUnsafe("2021-01-01T00:00:00.000Z")), "DateTime.Utc(2021-01-01T00:00:00.000Z)")
  })

  it("custom class", () => {
    class A {
      constructor(readonly a: string) {}
    }
    const schema = Schema.instanceOf(A)
    const show = ToFormat.make(schema)
    strictEqual(show(new A("a")), `A({"a":"a"})`)
  })

  it("custom class with a toString() method", () => {
    class A {
      constructor(readonly a: string) {}
      toString() {
        return `A(${this.a})`
      }
    }
    const schema = Schema.instanceOf(A)
    const show = ToFormat.make(schema)
    strictEqual(show(new A("a")), `A(a)`)
  })

  describe("Annotations", () => {
    describe("Override annotation", () => {
      it("String", () => {
        const schema = Schema.String.pipe(ToFormat.override(() => (s) => s.toUpperCase()))
        const show = ToFormat.make(schema)
        strictEqual(show("a"), "A")
      })

      it("String & minLength(1)", () => {
        const schema = Schema.String.check(Check.minLength(1)).pipe(ToFormat.override(() => (s) => s.toUpperCase()))
        const show = ToFormat.make(schema)
        strictEqual(show("a"), "A")
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
