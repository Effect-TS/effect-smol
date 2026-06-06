import { BigDecimal, DateTime, Order, Schema } from "effect"
import { TestSchema } from "effect/testing"
import { describe, it } from "vitest"
import { deepStrictEqual, throws } from "../utils/assert.ts"

function assertUnsupportedSchema(schema: Schema.Top, message: string) {
  throws(() => Schema.toArbitrary(schema), message)
}

function verifyGeneration<S extends Schema.Codec<unknown, unknown, never, unknown>>(schema: S, numRuns?: number) {
  const asserts = new TestSchema.Asserts(schema)
  if (numRuns === undefined) {
    asserts.arbitrary().verifyGeneration()
  } else {
    asserts.arbitrary().verifyGeneration({ params: { numRuns } })
  }
}

describe("Arbitrary generation", () => {
  describe("Thrown errors", () => {
    it("Declaration", () => {
      assertUnsupportedSchema(
        Schema.Struct({ a: Schema.instanceOf(globalThis.URL) }),
        `Unsupported AST Declaration
  at ["a"]`
      )
    })

    it("Never", () => {
      assertUnsupportedSchema(
        Schema.Struct({ a: Schema.Never }),
        `Unsupported AST Never
  at ["a"]`
      )
    })
  })

  it("should pass constraints to the override annotation", () => {
    let constraints: Schema.Annotations.ToArbitrary.Constraint | undefined
    const schema = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 })).annotate({
      toArbitrary: () => (fc, ctx) => {
        constraints = ctx.constraints
        return fc.constant(1)
      }
    })
    verifyGeneration(schema)
    deepStrictEqual(constraints, {
      number: {
        isInteger: true
      },
      ordered: {
        order: Order.Number,
        min: 1,
        max: 100
      }
    })
  })

  it("Any", () => {
    verifyGeneration(Schema.Any)
  })

  it("Unknown", () => {
    verifyGeneration(Schema.Unknown)
  })

  it("Void", () => {
    verifyGeneration(Schema.Void)
  })

  it("Null", () => {
    verifyGeneration(Schema.Null)
  })

  it("String", () => {
    verifyGeneration(Schema.String)
  })

  it("Number", () => {
    verifyGeneration(Schema.Number)
  })

  it("Boolean", () => {
    verifyGeneration(Schema.Boolean)
  })

  it("BigInt", () => {
    verifyGeneration(Schema.BigInt)
  })

  it("Symbol", () => {
    verifyGeneration(Schema.Symbol)
  })

  it("UniqueSymbol", () => {
    verifyGeneration(Schema.UniqueSymbol(Symbol.for("a")))
  })

  it("ObjectKeyword", () => {
    verifyGeneration(Schema.ObjectKeyword)
  })

  describe("Literal", () => {
    it("string", () => {
      verifyGeneration(Schema.Literal("a"))
    })

    it("number", () => {
      verifyGeneration(Schema.Literal(1))
    })

    it("boolean", () => {
      verifyGeneration(Schema.Literal(true))
    })

    it("bigint", () => {
      verifyGeneration(Schema.Literal(1n))
    })
  })

  it("Literals", () => {
    verifyGeneration(Schema.Literals(["a", "b", "c"]))
  })

  describe("TemplateLiteral", () => {
    it("a", () => {
      const schema = Schema.TemplateLiteral([Schema.Literal("a")])
      verifyGeneration(schema)
    })

    it("a b", () => {
      const schema = Schema.TemplateLiteral([Schema.Literal("a"), Schema.Literal(" "), Schema.Literal("b")])
      verifyGeneration(schema)
    })

    it("a${string}", () => {
      const schema = Schema.TemplateLiteral([Schema.Literal("a"), Schema.String])
      verifyGeneration(schema)
    })

    it("a${number}", () => {
      const schema = Schema.TemplateLiteral([Schema.Literal("a"), Schema.Number])
      verifyGeneration(schema)
    })

    it("a", () => {
      const schema = Schema.TemplateLiteral([Schema.Literal("a")])
      verifyGeneration(schema)
    })

    it("${string}", () => {
      const schema = Schema.TemplateLiteral([Schema.String])
      verifyGeneration(schema)
    })

    it("a${string}b", () => {
      const schema = Schema.TemplateLiteral([Schema.Literal("a"), Schema.String, Schema.Literal("b")])
      verifyGeneration(schema)
    })

    it("https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html", async () => {
      const EmailLocaleIDs = Schema.Literals(["welcome_email", "email_heading"])
      const FooterLocaleIDs = Schema.Literals(["footer_title", "footer_sendoff"])
      const schema = Schema.TemplateLiteral([Schema.Union([EmailLocaleIDs, FooterLocaleIDs]), "_id"])
      verifyGeneration(schema)
    })

    it("< + h + (1|2) + >", async () => {
      const schema = Schema.TemplateLiteral([
        Schema.Literal("<"),
        Schema.TemplateLiteral([Schema.Literal("h"), Schema.Union([Schema.Literal(1), Schema.Literal(2)])]),
        Schema.Literal(">")
      ])
      verifyGeneration(schema)
    })
  })

  describe("Enum", () => {
    it("Numeric enum", () => {
      enum Fruits {
        Apple,
        Banana
      }
      verifyGeneration(Schema.Enum(Fruits))
    })

    it("String enum", () => {
      enum Fruits {
        Apple = "apple",
        Banana = "banana",
        Cantaloupe = 0
      }
      verifyGeneration(Schema.Enum(Fruits))
    })

    it("Const enum", () => {
      const Fruits = {
        Apple: "apple",
        Banana: "banana",
        Cantaloupe: 3
      } as const
      verifyGeneration(Schema.Enum(Fruits))
    })
  })

  it("Union", () => {
    verifyGeneration(
      Schema.Union([Schema.String, Schema.Number])
    )
  })

  describe("Tuple", () => {
    it("empty", () => {
      verifyGeneration(
        Schema.Tuple([])
      )
    })

    it("required element", () => {
      verifyGeneration(
        Schema.Tuple([Schema.String])
      )
      verifyGeneration(
        Schema.Tuple([Schema.String, Schema.Number])
      )
    })

    it("optionalKey element", () => {
      verifyGeneration(
        Schema.Tuple([Schema.optionalKey(Schema.Number)])
      )
      verifyGeneration(
        Schema.Tuple([Schema.String, Schema.optionalKey(Schema.Number)])
      )
    })

    it("optional element", () => {
      verifyGeneration(
        Schema.Tuple([Schema.optional(Schema.Number)])
      )
      verifyGeneration(
        Schema.Tuple([Schema.String, Schema.optional(Schema.Number)])
      )
    })
  })

  describe("Array", () => {
    it("Array", () => {
      verifyGeneration(Schema.Array(Schema.String))
    })
  })

  it("TupleWithRest", () => {
    verifyGeneration(
      Schema.TupleWithRest(Schema.Tuple([Schema.Boolean]), [Schema.Number, Schema.String])
    )
    verifyGeneration(
      Schema.TupleWithRest(Schema.Tuple([]), [Schema.Number, Schema.String])
    )
    verifyGeneration(
      Schema.TupleWithRest(Schema.Tuple([Schema.optionalKey(Schema.Boolean)]), [Schema.Number]).check(
        Schema.isMinLength(3)
      )
    )
  })

  describe("Struct", () => {
    it("empty", () => {
      verifyGeneration(Schema.Struct({}))
    })

    it("required fields", () => {
      verifyGeneration(Schema.Struct({
        a: Schema.String
      }))
      verifyGeneration(Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }))
    })

    it("required field with undefined", () => {
      verifyGeneration(Schema.Struct({
        a: Schema.UndefinedOr(Schema.String)
      }))
    })

    it("optionalKey field", () => {
      verifyGeneration(Schema.Struct({
        a: Schema.optionalKey(Schema.String)
      }))
    })

    it("optional field", () => {
      verifyGeneration(Schema.Struct({
        a: Schema.optional(Schema.String)
      }))
    })
  })

  describe("Record", () => {
    it("Record(String, Number)", () => {
      verifyGeneration(Schema.Record(Schema.String, Schema.Number))
    })

    it("Record(Symbol, Number)", () => {
      verifyGeneration(Schema.Record(Schema.Symbol, Schema.Number))
    })
  })

  it("StructWithRest", () => {
    verifyGeneration(Schema.StructWithRest(
      Schema.Struct({ a: Schema.Number }),
      [Schema.Record(Schema.String, Schema.Number)]
    ))
    verifyGeneration(Schema.StructWithRest(
      Schema.Struct({ a: Schema.Number }),
      [Schema.Record(Schema.Symbol, Schema.Number)]
    ))
  })

  describe("Class", () => {
    it("Class", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}
      const schema = A
      verifyGeneration(schema)
    })
  })

  describe("suspend", () => {
    it("Tuple", () => {
      const Rec = Schema.suspend((): Schema.Codec<unknown> => schema)
      const schema = Schema.Tuple([
        Schema.Number,
        Schema.NullOr(Rec)
      ])
      verifyGeneration(schema)
    })

    it("Array", () => {
      const Rec = Schema.suspend((): Schema.Codec<unknown> => schema)
      const schema: any = Schema.Array(Schema.Union([Schema.String, Rec]))
      verifyGeneration(schema)
    })

    it("Struct", () => {
      const Rec = Schema.suspend((): Schema.Codec<unknown> => schema)
      const schema = Schema.Struct({
        a: Schema.String,
        as: Schema.Array(Rec)
      })
      verifyGeneration(schema)
    })

    it("Record", () => {
      const Rec = Schema.suspend((): Schema.Codec<unknown> => schema)
      const schema = Schema.Record(Schema.String, Rec)
      verifyGeneration(schema)
    })

    it("optional", () => {
      const Rec = Schema.suspend((): Schema.Codec<unknown> => schema)
      const schema: any = Schema.Struct({
        a: Schema.optional(Rec)
      })
      verifyGeneration(schema)
    })

    it("Array + Array", () => {
      const Rec = Schema.suspend((): Schema.Codec<unknown> => schema)
      const schema: any = Schema.Struct({
        a: Schema.Array(Rec),
        b: Schema.Array(Rec)
      })
      verifyGeneration(schema)
    })

    it("optional + Array", () => {
      const Rec = Schema.suspend((): Schema.Codec<unknown> => schema)
      const schema: any = Schema.Struct({
        a: Schema.optional(Rec),
        b: Schema.Array(Rec)
      })
      verifyGeneration(schema)
    })

    it.skip("mutually suspended schemas", { retry: 5 }, () => {
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
      verifyGeneration(Operation)
    })

    it("Option", () => {
      const Rec = Schema.suspend((): Schema.Codec<unknown> => schema)
      const schema = Schema.Struct({
        a: Schema.String,
        as: Schema.Option(Rec)
      })
      verifyGeneration(schema)
    })

    it("ReadonlySet", () => {
      const Rec = Schema.suspend((): Schema.Codec<unknown> => schema)
      const schema = Schema.ReadonlySet(Rec)
      verifyGeneration(schema)
    })

    it("ReadonlyMap", () => {
      const Rec = Schema.suspend((): Schema.Codec<unknown> => schema)
      const schema = Schema.ReadonlyMap(Schema.String, Rec)
      verifyGeneration(schema)
    })

    it("HashMap", () => {
      const Rec = Schema.suspend((): Schema.Codec<unknown> => schema)
      const schema = Schema.HashMap(Schema.String, Rec)
      verifyGeneration(schema)
    })
  })

  describe("checks", () => {
    it("isMinLength(2)", () => {
      verifyGeneration(Schema.String.pipe(Schema.check(Schema.isMinLength(2))))
      verifyGeneration(Schema.Array(Schema.String).pipe(Schema.check(Schema.isMinLength(2))))
    })

    it("isMaxLength(2)", () => {
      verifyGeneration(Schema.String.pipe(Schema.check(Schema.isMaxLength(2))))
      verifyGeneration(Schema.Array(Schema.String).pipe(Schema.check(Schema.isMaxLength(2))))
    })

    it("isMinLength(2) & isMaxLength(4)", () => {
      verifyGeneration(Schema.String.pipe(Schema.check(Schema.isMinLength(2), Schema.isMaxLength(4))))
      verifyGeneration(
        Schema.Array(Schema.String).pipe(Schema.check(Schema.isMinLength(2), Schema.isMaxLength(4)))
      )
    })

    it("isLength(2)", () => {
      verifyGeneration(Schema.String.pipe(Schema.check(Schema.isLengthBetween(2, 2))))
      verifyGeneration(Schema.Array(Schema.String).pipe(Schema.check(Schema.isLengthBetween(2, 2))))
    })

    it("isMinProperties(2)", () => {
      verifyGeneration(
        Schema.Record(Schema.String, Schema.Number).check(Schema.isMinProperties(2))
      )
    })

    it("isMaxProperties(2)", () => {
      verifyGeneration(
        Schema.Record(Schema.String, Schema.Number).check(Schema.isMaxProperties(2))
      )
    })

    it("isMinProperties(2) & isMaxProperties(4)", () => {
      verifyGeneration(
        Schema.Record(Schema.String, Schema.Number).check(Schema.isMinProperties(2), Schema.isMaxProperties(4))
      )
    })

    it("isPropertiesLengthBetween(2, 2)", () => {
      verifyGeneration(
        Schema.Record(Schema.String, Schema.Number).check(Schema.isPropertiesLengthBetween(2, 2))
      )
    })

    it("isBetween(1, 100)", () => {
      verifyGeneration(Schema.Number.check(Schema.isBetween({ minimum: 1, maximum: 100 })))
    })

    it("isInt", () => {
      verifyGeneration(Schema.Number.check(Schema.isInt()))
    })

    it("isInt & isBetween(1, 100)", () => {
      verifyGeneration(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 })))
    })

    it("isInt & isGreaterThan(1.2)", () => {
      verifyGeneration(Schema.Int.check(Schema.isGreaterThan(1.2)))
    })

    it("isInt & isLessThan(10.8)", () => {
      verifyGeneration(Schema.Int.check(Schema.isLessThan(10.8)))
    })

    it("isInt & isBetween(1, 10) with exclusive bounds", () => {
      verifyGeneration(Schema.Int.check(Schema.isBetween({
        minimum: 1,
        maximum: 10,
        exclusiveMinimum: true,
        exclusiveMaximum: true
      })))
    })

    it("isInt32", () => {
      verifyGeneration(Schema.Number.check(Schema.isInt32()))
    })

    it("isPattern", () => {
      verifyGeneration(Schema.String.check(Schema.isPattern(/^[A-Z]{3}[0-9]{3}$/)))
    })

    it("isNonEmpty + isPattern", () => {
      verifyGeneration(Schema.NonEmptyString.check(Schema.isPattern(/^[-]*$/)))
    })

    it("isPattern + isPattern", () => {
      verifyGeneration(
        Schema.String.check(Schema.isPattern(/^[^A-Z]*$/), Schema.isPattern(/^0x[0-9a-f]{40}$/))
      )
    })

    it("isGreaterThanOrEqualToDate", () => {
      verifyGeneration(Schema.Date.check(Schema.isGreaterThanOrEqualToDate(new Date(0))))
    })

    it("isGreaterThanDate", () => {
      verifyGeneration(Schema.Date.check(Schema.isGreaterThanDate(new Date(0))))
    })

    it("isLessThanOrEqualToDate", () => {
      verifyGeneration(Schema.Date.check(Schema.isLessThanOrEqualToDate(new Date(10))))
    })

    it("isLessThanDate", () => {
      verifyGeneration(Schema.Date.check(Schema.isLessThanDate(new Date(10))))
    })

    it("isBetweenDate", () => {
      verifyGeneration(Schema.Date.check(Schema.isBetweenDate({ minimum: new Date(0), maximum: new Date(10) })))
    })

    it("isBetweenDate with exclusive bounds", () => {
      verifyGeneration(Schema.Date.check(Schema.isBetweenDate({
        minimum: new Date(0),
        maximum: new Date(10),
        exclusiveMinimum: true,
        exclusiveMaximum: true
      })))
    })

    it("DateValid", () => {
      verifyGeneration(Schema.DateValid)
    })

    it("isGreaterThanOrEqualToBigInt", () => {
      verifyGeneration(Schema.BigInt.check(Schema.isGreaterThanOrEqualToBigInt(BigInt(0))))
    })

    it("isGreaterThanBigInt", () => {
      verifyGeneration(Schema.BigInt.check(Schema.isGreaterThanBigInt(BigInt(0))))
    })

    it("isLessThanOrEqualToBigInt", () => {
      verifyGeneration(Schema.BigInt.check(Schema.isLessThanOrEqualToBigInt(BigInt(10))))
    })

    it("isLessThanBigInt", () => {
      verifyGeneration(Schema.BigInt.check(Schema.isLessThanBigInt(BigInt(10))))
    })

    it("isBetweenBigInt", () => {
      verifyGeneration(Schema.BigInt.check(Schema.isBetweenBigInt({ minimum: BigInt(0), maximum: BigInt(10) })))
    })

    it("isBetweenBigInt with exclusive bounds", () => {
      verifyGeneration(Schema.BigInt.check(Schema.isBetweenBigInt({
        minimum: BigInt(0),
        maximum: BigInt(10),
        exclusiveMinimum: true,
        exclusiveMaximum: true
      })))
    })

    it("isBetweenBigDecimal", () => {
      verifyGeneration(
        Schema.BigDecimal.check(
          Schema.isBetweenBigDecimal({
            minimum: BigDecimal.make(100n, 0),
            maximum: BigDecimal.make(200n, 0)
          })
        )
      )
    })

    it("isBetweenBigDecimal with decimal scale", () => {
      verifyGeneration(
        Schema.BigDecimal.check(
          Schema.isBetweenBigDecimal({
            minimum: BigDecimal.fromStringUnsafe("1.01"),
            maximum: BigDecimal.fromStringUnsafe("1.02")
          })
        )
      )
    })

    it("non-natural Number order", () => {
      const order = Order.flip(Order.Number)
      verifyGeneration(Schema.Finite.check(Schema.makeIsGreaterThan({ order })(0)))
    })

    it("non-natural Int order", () => {
      const order = Order.flip(Order.Number)
      verifyGeneration(Schema.Int.check(Schema.makeIsGreaterThan({ order })(0)))
    })

    it("non-natural Date order", () => {
      const order = Order.flip(Order.Date)
      verifyGeneration(Schema.DateValid.check(Schema.makeIsGreaterThan({ order })(new Date(0))))
    })

    it("non-natural BigInt order", () => {
      const order = Order.flip(Order.BigInt)
      verifyGeneration(Schema.BigInt.check(Schema.makeIsGreaterThan({ order })(BigInt(0))))
    })

    it("non-natural BigDecimal order", () => {
      const order = Order.flip(BigDecimal.Order)
      verifyGeneration(Schema.BigDecimal.check(Schema.makeIsGreaterThan({ order })(BigDecimal.make(0n, 0))))
    })
  })

  it("Finite", () => {
    verifyGeneration(Schema.Finite)
  })

  it("Date", () => {
    verifyGeneration(Schema.Date)
  })

  it("URL", () => {
    verifyGeneration(Schema.URL)
  })

  it("RegExp", () => {
    verifyGeneration(Schema.RegExp)
  })

  it("Duration", () => {
    verifyGeneration(Schema.Duration)
  })

  it("BigDecimal", () => {
    verifyGeneration(Schema.BigDecimal)
  })

  it("DateTimeUtc", () => {
    verifyGeneration(Schema.DateTimeUtc)
  })

  it("DateTimeUtc with ordered DateTime constraints", () => {
    const start = DateTime.makeUnsafe(0)
    verifyGeneration(
      Schema.DateTimeUtc.check(
        Schema.makeIsGreaterThan({ order: DateTime.Order })(start)
      )
    )
  })

  it("DateTimeUtc with non-natural DateTime order", () => {
    const order = Order.flip(DateTime.Order)
    verifyGeneration(
      Schema.DateTimeUtc.check(
        Schema.makeIsGreaterThan({ order })(DateTime.makeUnsafe(0))
      )
    )
  })

  it("TimeZoneOffset", () => {
    verifyGeneration(Schema.TimeZoneOffset)
  })

  it("TimeZoneNamed", () => {
    verifyGeneration(Schema.TimeZoneNamed)
  })

  it("TimeZone", () => {
    verifyGeneration(Schema.TimeZone)
  })

  it("DateTimeZoned", () => {
    verifyGeneration(Schema.DateTimeZoned)
  })

  it("DateTimeZoned with ordered DateTime constraints", () => {
    const start = DateTime.makeZonedUnsafe(0, { timeZone: "UTC" })
    verifyGeneration(
      Schema.DateTimeZoned.check(
        Schema.makeIsGreaterThan({ order: DateTime.Order })(start)
      )
    )
  })

  it("DateTimeZoned with non-natural DateTime order", () => {
    const order = Order.flip(DateTime.Order)
    verifyGeneration(
      Schema.DateTimeZoned.check(
        Schema.makeIsGreaterThan({ order })(DateTime.makeZonedUnsafe(0, { timeZone: "UTC" }))
      )
    )
  })

  it("Uint8Array", () => {
    verifyGeneration(Schema.Uint8Array)
  })

  it("UnknownFromJsonString", () => {
    verifyGeneration(Schema.UnknownFromJsonString)
  })

  it("Option(String)", () => {
    verifyGeneration(Schema.Option(Schema.String))
  })

  it("Result(Number, String)", () => {
    verifyGeneration(Schema.Result(Schema.Number, Schema.String))
  })

  describe("ReadonlySet", () => {
    it("ReadonlySet(Number)", () => {
      verifyGeneration(Schema.ReadonlySet(Schema.Number))
    })
  })

  describe("ReadonlyMap", () => {
    it("ReadonlyMap(String, Number)", () => {
      verifyGeneration(Schema.ReadonlyMap(Schema.String, Schema.Number))
    })

    it("isMinSize(2)", () => {
      verifyGeneration(
        Schema.ReadonlyMap(Schema.String, Schema.Number).check(Schema.isMinSize(2))
      )
    })

    it("isMaxSize(4)", () => {
      verifyGeneration(
        Schema.ReadonlyMap(Schema.String, Schema.Number).check(Schema.isMaxSize(4))
      )
    })

    it("isMinSize(2) & isMaxSize(4)", () => {
      verifyGeneration(
        Schema.ReadonlyMap(Schema.String, Schema.Number).check(Schema.isMinSize(2), Schema.isMaxSize(4))
      )
    })

    it("isSizeBetween(2, 2)", () => {
      verifyGeneration(
        Schema.ReadonlyMap(Schema.String, Schema.Number).check(Schema.isSizeBetween(2, 2))
      )
    })
  })

  describe("HashMap", () => {
    it("HashMap(String, Number)", () => {
      verifyGeneration(Schema.HashMap(Schema.String, Schema.Number))
    })
  })

  describe("Redacted", () => {
    it("Redacted(String)", () => {
      const schema = Schema.Redacted(Schema.String)
      verifyGeneration(schema)
    })

    it("with label", () => {
      const schema = Schema.Redacted(Schema.String, { label: "password" })
      verifyGeneration(schema)
    })
  })

  describe("constraint behavior", () => {
    it("String", () => {
      verifyGeneration(Schema.String)
    })

    it("String & nonEmpty", () => {
      verifyGeneration(Schema.NonEmptyString)
    })

    it("String & isNonEmpty & isMinLength(2)", () => {
      verifyGeneration(Schema.String.check(Schema.isNonEmpty()).check(Schema.isMinLength(2)))
    })

    it("String & isMinLength(2) & isNonEmpty", () => {
      verifyGeneration(Schema.String.check(Schema.isMinLength(2)).check(Schema.isNonEmpty()))
    })

    it("String & isNonEmpty & isMaxLength(2)", () => {
      verifyGeneration(Schema.String.check(Schema.isNonEmpty()).check(Schema.isMaxLength(2)))
    })

    it("String & isLength(2)", () => {
      verifyGeneration(Schema.String.check(Schema.isLengthBetween(2, 2)))
    })

    it("isStartsWith", () => {
      verifyGeneration(Schema.String.check(Schema.isStartsWith("a")))
    })

    it("isEndsWith", () => {
      verifyGeneration(Schema.String.check(Schema.isEndsWith("a")))
    })

    it("Number", () => {
      verifyGeneration(Schema.Number)
    })

    it("isFinite", () => {
      verifyGeneration(Schema.Number.check(Schema.isFinite()))
    })

    it("isInt", () => {
      verifyGeneration(Schema.Number.check(Schema.isInt()))
    })

    it("isFinite & isInt", () => {
      verifyGeneration(Schema.Number.check(Schema.isFinite(), Schema.isInt()))
    })

    it("isInt32", () => {
      verifyGeneration(Schema.Number.check(Schema.isInt32()))
    })

    it("isGreaterThan", () => {
      verifyGeneration(Schema.Number.check(Schema.isGreaterThan(10)))
    })

    it("isBetween", () => {
      verifyGeneration(Schema.Number.check(Schema.isBetween({ minimum: 1, maximum: 10 })))
    })

    it("Number with non-natural order", () => {
      const order = Order.flip(Order.Number)
      verifyGeneration(Schema.Finite.check(Schema.makeIsGreaterThan({ order })(0)))
    })

    it("ordered lower bounds keep the strongest bound", () => {
      verifyGeneration(Schema.Number.check(Schema.isGreaterThan(1), Schema.isGreaterThanOrEqualTo(3)))
    })

    it("ordered lower bounds preserve exclusivity for equal bounds", () => {
      verifyGeneration(Schema.Number.check(Schema.isGreaterThan(1), Schema.isGreaterThanOrEqualTo(1)))
    })

    it("ordered upper bounds keep the strongest bound", () => {
      verifyGeneration(Schema.Number.check(Schema.isLessThan(10), Schema.isLessThanOrEqualTo(8)))
    })

    it("ordered upper bounds preserve exclusivity for equal bounds", () => {
      verifyGeneration(Schema.Number.check(Schema.isLessThan(1), Schema.isLessThanOrEqualTo(1)))
    })

    it("isInt & isGreaterThan", () => {
      verifyGeneration(Schema.Int.check(Schema.isGreaterThan(1)))
    })

    it("isInt & isGreaterThan fractional", () => {
      verifyGeneration(Schema.Int.check(Schema.isGreaterThan(1.2)))
    })

    it("isInt & isLessThan", () => {
      verifyGeneration(Schema.Int.check(Schema.isLessThan(10)))
    })

    it("isInt & isLessThan fractional", () => {
      verifyGeneration(Schema.Int.check(Schema.isLessThan(10.8)))
    })

    it("isInt & isBetween with fractional bounds", () => {
      verifyGeneration(Schema.Int.check(Schema.isBetween({ minimum: 1.2, maximum: 10.8 })))
    })

    it("isInt & isBetween with exclusive bounds", () => {
      verifyGeneration(Schema.Int.check(Schema.isBetween({
        minimum: 1,
        maximum: 10,
        exclusiveMinimum: true,
        exclusiveMaximum: true
      })))
    })

    it("Int with non-natural order", () => {
      const order = Order.flip(Order.Number)
      verifyGeneration(Schema.Int.check(Schema.makeIsGreaterThan({ order })(0)))
    })

    it("isGreaterThanDate", () => {
      verifyGeneration(Schema.Date.check(Schema.isGreaterThanDate(new Date(0))))
    })

    it("isGreaterThanOrEqualToDate", () => {
      verifyGeneration(Schema.Date.check(Schema.isGreaterThanOrEqualToDate(new Date(0))))
    })

    it("isLessThanDate", () => {
      verifyGeneration(Schema.Date.check(Schema.isLessThanDate(new Date(10))))
    })

    it("isLessThanOrEqualToDate", () => {
      verifyGeneration(Schema.Date.check(Schema.isLessThanOrEqualToDate(new Date(10))))
    })

    it("isBetweenDate", () => {
      verifyGeneration(Schema.Date.check(Schema.isBetweenDate({ minimum: new Date(0), maximum: new Date(10) })))
    })

    it("isBetweenDate with exclusive bounds", () => {
      verifyGeneration(Schema.Date.check(Schema.isBetweenDate({
        minimum: new Date(0),
        maximum: new Date(10),
        exclusiveMinimum: true,
        exclusiveMaximum: true
      })))
    })

    it("isValidDate", () => {
      verifyGeneration(Schema.Date.check(Schema.isDateValid()))
    })

    it("isValidDate & isGreaterThanOrEqualToDate", () => {
      verifyGeneration(Schema.Date.check(Schema.isDateValid(), Schema.isGreaterThanOrEqualToDate(new Date(0))))
    })

    it("Date with non-natural order", () => {
      const order = Order.flip(Order.Date)
      verifyGeneration(Schema.DateValid.check(Schema.makeIsGreaterThan({ order })(new Date(0))))
    })

    it("isGreaterThanOrEqualToBigInt", () => {
      verifyGeneration(Schema.BigInt.check(Schema.isGreaterThanOrEqualToBigInt(BigInt(0))))
    })

    it("isGreaterThanBigInt", () => {
      verifyGeneration(Schema.BigInt.check(Schema.isGreaterThanBigInt(BigInt(0))))
    })

    it("isLessThanOrEqualToBigInt", () => {
      verifyGeneration(Schema.BigInt.check(Schema.isLessThanOrEqualToBigInt(BigInt(10))))
    })

    it("isLessThanBigInt", () => {
      verifyGeneration(Schema.BigInt.check(Schema.isLessThanBigInt(BigInt(10))))
    })

    it("isBetweenBigInt", () => {
      verifyGeneration(Schema.BigInt.check(Schema.isBetweenBigInt({ minimum: BigInt(0), maximum: BigInt(10) })))
    })

    it("isBetweenBigInt with exclusive bounds", () => {
      verifyGeneration(Schema.BigInt.check(Schema.isBetweenBigInt({
        minimum: BigInt(0),
        maximum: BigInt(10),
        exclusiveMinimum: true,
        exclusiveMaximum: true
      })))
    })

    it("BigInt with non-natural order", () => {
      const order = Order.flip(Order.BigInt)
      verifyGeneration(Schema.BigInt.check(Schema.makeIsGreaterThan({ order })(BigInt(0))))
    })

    it("isGreaterThanOrEqualToBigDecimal", () => {
      verifyGeneration(Schema.BigDecimal.check(Schema.isGreaterThanOrEqualToBigDecimal(BigDecimal.make(0n, 0))))
    })

    it("isGreaterThanBigDecimal", () => {
      verifyGeneration(Schema.BigDecimal.check(Schema.isGreaterThanBigDecimal(BigDecimal.make(0n, 0))))
    })

    it("isLessThanOrEqualToBigDecimal", () => {
      verifyGeneration(Schema.BigDecimal.check(Schema.isLessThanOrEqualToBigDecimal(BigDecimal.make(10n, 0))))
    })

    it("isLessThanBigDecimal", () => {
      verifyGeneration(Schema.BigDecimal.check(Schema.isLessThanBigDecimal(BigDecimal.make(10n, 0))))
    })

    it("isBetweenBigDecimal", () => {
      verifyGeneration(Schema.BigDecimal.check(Schema.isBetweenBigDecimal({
        minimum: BigDecimal.make(100n, 0),
        maximum: BigDecimal.make(200n, 0)
      })))
    })

    it("isBetweenBigDecimal with decimal scale", () => {
      verifyGeneration(Schema.BigDecimal.check(Schema.isBetweenBigDecimal({
        minimum: BigDecimal.fromStringUnsafe("1.01"),
        maximum: BigDecimal.fromStringUnsafe("1.02")
      })))
    })

    it("isBetweenBigDecimal with exclusive decimal bounds", () => {
      verifyGeneration(
        Schema.BigDecimal.check(Schema.isBetweenBigDecimal({
          minimum: BigDecimal.fromStringUnsafe("1.01"),
          maximum: BigDecimal.fromStringUnsafe("1.02"),
          exclusiveMinimum: true,
          exclusiveMaximum: true
        })),
        1_000
      )
    })

    it("isBetweenBigDecimal with exclusive negative decimal bounds", () => {
      verifyGeneration(
        Schema.BigDecimal.check(Schema.isBetweenBigDecimal({
          minimum: BigDecimal.fromStringUnsafe("-1.02"),
          maximum: BigDecimal.fromStringUnsafe("-1.01"),
          exclusiveMinimum: true,
          exclusiveMaximum: true
        })),
        1_000
      )
    })

    it("isBetweenBigDecimal with a single inclusive decimal value", () => {
      verifyGeneration(
        Schema.BigDecimal.check(Schema.isBetweenBigDecimal({
          minimum: BigDecimal.fromStringUnsafe("1.01"),
          maximum: BigDecimal.fromStringUnsafe("1.01")
        })),
        1_000
      )
    })

    it("isBetweenBigDecimal with exclusive bounds requiring a higher scale", () => {
      verifyGeneration(
        Schema.BigDecimal.check(Schema.isBetweenBigDecimal({
          minimum: BigDecimal.fromStringUnsafe("0"),
          maximum: BigDecimal.fromStringUnsafe("0.00000000000000000001"),
          exclusiveMinimum: true,
          exclusiveMaximum: true
        })),
        1_000
      )
    })

    it("isBetweenBigDecimal with impossible exclusive bounds", () => {
      throws(() =>
        Schema.toArbitrary(Schema.BigDecimal.check(Schema.isBetweenBigDecimal({
          minimum: BigDecimal.fromStringUnsafe("1.01"),
          maximum: BigDecimal.fromStringUnsafe("1.01"),
          exclusiveMinimum: true,
          exclusiveMaximum: true
        }))), "Unable to derive an arbitrary for the ordered BigDecimal constraints")
    })

    it("isGreaterThanBigDecimal + isLessThanBigDecimal with impossible bounds", () => {
      throws(() =>
        Schema.toArbitrary(Schema.BigDecimal.check(
          Schema.isGreaterThanBigDecimal(BigDecimal.fromStringUnsafe("1.01")),
          Schema.isLessThanBigDecimal(BigDecimal.fromStringUnsafe("1.01"))
        )), "Unable to derive an arbitrary for the ordered BigDecimal constraints")
    })

    it("isGreaterThanBigDecimal + isLessThanBigDecimal", () => {
      verifyGeneration(
        Schema.BigDecimal.check(
          Schema.isGreaterThanBigDecimal(BigDecimal.fromStringUnsafe("1.01")),
          Schema.isLessThanBigDecimal(BigDecimal.fromStringUnsafe("1.02"))
        ),
        1_000
      )
    })

    it("BigDecimal with non-natural order", () => {
      const order = Order.flip(BigDecimal.Order)
      verifyGeneration(Schema.BigDecimal.check(Schema.makeIsGreaterThan({ order })(BigDecimal.make(0n, 0))))
    })

    it("DateTimeUtc with non-natural order", () => {
      const order = Order.flip(DateTime.Order)
      verifyGeneration(Schema.DateTimeUtc.check(Schema.makeIsGreaterThan({ order })(DateTime.makeUnsafe(0))))
    })

    it("DateTimeZoned with non-natural order", () => {
      const order = Order.flip(DateTime.Order)
      verifyGeneration(
        Schema.DateTimeZoned.check(
          Schema.makeIsGreaterThan({ order })(DateTime.makeZonedUnsafe(0, { timeZone: "UTC" }))
        )
      )
    })

    it("UniqueArray", () => {
      verifyGeneration(Schema.UniqueArray(Schema.String))
      verifyGeneration(Schema.UniqueArray(Schema.String).check(Schema.isMaxLength(2)))
    })
  })
})
