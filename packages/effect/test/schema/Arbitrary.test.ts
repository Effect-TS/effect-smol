import * as InternalArbitrary from "effect/internal/arbitrary"
import type { Annotations } from "effect/schema"
import { Schema } from "effect/schema"
import { TestSchema } from "effect/testing"
import { describe, it } from "vitest"
import { deepStrictEqual, throws } from "../utils/assert.ts"

function assertUnsupportedSchema(schema: Schema.Top, message: string) {
  throws(() => Schema.makeArbitrary(schema), message)
}

function assertFragments(schema: Schema.Schema<any>, ctx: Annotations.Arbitrary.Context) {
  const ast = schema.ast
  const filters = InternalArbitrary.getFilters(ast.checks)
  const f = InternalArbitrary.constraintContext(filters)
  deepStrictEqual(f({}), ctx)
}

function verifyGeneration<S extends Schema.Codec<unknown, unknown, never, unknown>>(schema: S) {
  const asserts = new TestSchema.Asserts(schema)
  asserts.arbitrary().verifyGeneration()
}

describe("Arbitrary generation", () => {
  describe("Thrown errors", () => {
    it("Declaration", () => {
      assertUnsupportedSchema(
        Schema.Struct({ a: Schema.instanceOf(globalThis.URL) }),
        `Unsupported schema Declaration
  at ["a"]`
      )
    })

    it("Never", () => {
      assertUnsupportedSchema(
        Schema.Struct({ a: Schema.Never }),
        `Unsupported schema Never
  at ["a"]`
      )
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
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Tuple([
        Schema.Number,
        Schema.NullOr(Rec)
      ])
      verifyGeneration(schema)
    })

    it("Array", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema: any = Schema.Array(Schema.Union([Schema.String, Rec]))
      verifyGeneration(schema)
    })

    it("Struct", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Struct({
        a: Schema.String,
        as: Schema.Array(Rec)
      })
      verifyGeneration(schema)
    })

    it("Record", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Record(Schema.String, Rec)
      verifyGeneration(schema)
    })

    it("optional", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema: any = Schema.Struct({
        a: Schema.optional(Rec)
      })
      verifyGeneration(schema)
    })

    it("Array + Array", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema: any = Schema.Struct({
        a: Schema.Array(Rec),
        b: Schema.Array(Rec)
      })
      verifyGeneration(schema)
    })

    it("optional + Array", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
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
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Struct({
        a: Schema.String,
        as: Schema.Option(Rec)
      })
      verifyGeneration(schema)
    })

    it("ReadonlySet", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.ReadonlySet(Rec)
      verifyGeneration(schema)
    })

    it("ReadonlyMap", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.ReadonlyMap(Schema.String, Rec)
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
      verifyGeneration(Schema.String.pipe(Schema.check(Schema.isLength(2))))
      verifyGeneration(Schema.Array(Schema.String).pipe(Schema.check(Schema.isLength(2))))
    })

    it("isMinEntries(2)", () => {
      verifyGeneration(
        Schema.Record(Schema.String, Schema.Number).check(Schema.isMinEntries(2))
      )
    })

    it("isMaxEntries(2)", () => {
      verifyGeneration(
        Schema.Record(Schema.String, Schema.Number).check(Schema.isMaxEntries(2))
      )
    })

    it("isMinEntries(2) & isMaxEntries(4)", () => {
      verifyGeneration(
        Schema.Record(Schema.String, Schema.Number).check(Schema.isMinEntries(2), Schema.isMaxEntries(4))
      )
    })

    it("isEntriesLength(2)", () => {
      verifyGeneration(
        Schema.Record(Schema.String, Schema.Number).check(Schema.isEntriesLength(2))
      )
    })

    it("isBetween(1, 100)", () => {
      const schema = Schema.Number.check(Schema.isBetween(1, 100))
      verifyGeneration(schema)
    })

    it("isInt", () => {
      const schema = Schema.Number.check(Schema.isInt())
      verifyGeneration(schema)
    })

    it("isInt & isBetween(1, 100)", () => {
      const schema = Schema.Int.check(Schema.isBetween(1, 100))
      verifyGeneration(schema)
    })

    it("isInt32", () => {
      const schema = Schema.Number.check(Schema.isInt32())
      verifyGeneration(schema)
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

    it("isLessThanOrEqualToDate", () => {
      verifyGeneration(Schema.Date.check(Schema.isLessThanOrEqualToDate(new Date(10))))
    })

    it("isBetweenDate", () => {
      verifyGeneration(Schema.Date.check(Schema.isBetweenDate(new Date(0), new Date(10))))
    })

    it("ValidDate", () => {
      verifyGeneration(Schema.ValidDate)
    })

    it("isGreaterThanOrEqualToBigInt", () => {
      verifyGeneration(Schema.BigInt.check(Schema.isGreaterThanOrEqualToBigInt(BigInt(0))))
    })

    it("isLessThanOrEqualToBigInt", () => {
      verifyGeneration(Schema.BigInt.check(Schema.isLessThanOrEqualToBigInt(BigInt(10))))
    })

    it("isBetweenBigInt", () => {
      verifyGeneration(Schema.BigInt.check(Schema.isBetweenBigInt(BigInt(0), BigInt(10))))
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

  it("Duration", () => {
    verifyGeneration(Schema.Duration)
  })

  it("DateTimeUtc", () => {
    verifyGeneration(Schema.DateTimeUtc)
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

    it("isSize(2)", () => {
      verifyGeneration(
        Schema.ReadonlyMap(Schema.String, Schema.Number).check(Schema.isSize(2))
      )
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

  describe("fragments", () => {
    it("String", () => {
      assertFragments(Schema.String, {
        constraints: {}
      })
    })

    it("String & nonEmpty", () => {
      assertFragments(Schema.NonEmptyString, {
        constraints: {
          array: {
            minLength: 1
          },
          string: {
            minLength: 1
          }
        }
      })
    })

    it("String & isNonEmpty & isMinLength(2)", () => {
      assertFragments(Schema.String.check(Schema.isNonEmpty()).check(Schema.isMinLength(2)), {
        constraints: {
          array: {
            minLength: 2
          },
          string: {
            minLength: 2
          }
        }
      })
    })

    it("String & isMinLength(2) & isNonEmpty", () => {
      assertFragments(Schema.String.check(Schema.isMinLength(2)).check(Schema.isNonEmpty()), {
        constraints: {
          array: {
            minLength: 2
          },
          string: {
            minLength: 2
          }
        }
      })
    })

    it("String & isNonEmpty & isMaxLength(2)", () => {
      assertFragments(Schema.String.check(Schema.isNonEmpty()).check(Schema.isMaxLength(2)), {
        constraints: {
          array: {
            minLength: 1,
            maxLength: 2
          },
          string: {
            minLength: 1,
            maxLength: 2
          }
        }
      })
    })

    it("String & isLength(2)", () => {
      assertFragments(Schema.String.check(Schema.isLength(2)), {
        constraints: {
          array: {
            minLength: 2,
            maxLength: 2
          },
          string: {
            minLength: 2,
            maxLength: 2
          }
        }
      })
    })

    it("isStartsWith", () => {
      assertFragments(Schema.String.check(Schema.isStartsWith("a")), {
        constraints: {
          string: {
            patterns: ["^a"]
          }
        }
      })
    })

    it("isEndsWith", () => {
      assertFragments(Schema.String.check(Schema.isEndsWith("a")), {
        constraints: {
          string: {
            patterns: ["a$"]
          }
        }
      })
    })

    it("Number", () => {
      assertFragments(Schema.Number, {
        constraints: {}
      })
    })

    it("isFinite", () => {
      assertFragments(Schema.Number.check(Schema.isFinite()), {
        constraints: {
          number: {
            noDefaultInfinity: true,
            noNaN: true
          }
        }
      })
    })

    it("isInt", () => {
      assertFragments(Schema.Number.check(Schema.isInt()), {
        constraints: {
          number: {
            isInteger: true
          }
        }
      })
    })

    it("isFinite & isInt", () => {
      assertFragments(Schema.Number.check(Schema.isFinite(), Schema.isInt()), {
        constraints: {
          number: {
            noDefaultInfinity: true,
            noNaN: true,
            isInteger: true
          }
        }
      })
    })

    it("isInt32", () => {
      assertFragments(Schema.Number.check(Schema.isInt32()), {
        constraints: {
          number: {
            isInteger: true,
            max: 2147483647,
            min: -2147483648
          }
        }
      })
    })

    it("isGreaterThan", () => {
      assertFragments(Schema.Number.check(Schema.isGreaterThan(10)), {
        constraints: {
          number: {
            min: 10,
            minExcluded: true
          }
        }
      })
    })

    it("isGreaterThanOrEqualToDate", () => {
      assertFragments(Schema.Date.check(Schema.isGreaterThanOrEqualToDate(new Date(0))), {
        constraints: {
          date: {
            min: new Date(0)
          }
        }
      })
    })

    it("isLessThanOrEqualToDate", () => {
      assertFragments(Schema.Date.check(Schema.isLessThanOrEqualToDate(new Date(10))), {
        constraints: {
          date: {
            max: new Date(10)
          }
        }
      })
    })

    it("isBetweenDate", () => {
      assertFragments(Schema.Date.check(Schema.isBetweenDate(new Date(0), new Date(10))), {
        constraints: {
          date: {
            min: new Date(0),
            max: new Date(10)
          }
        }
      })
    })

    it("isValidDate", () => {
      assertFragments(Schema.Date.check(Schema.isValidDate()), {
        constraints: {
          date: {
            noInvalidDate: true
          }
        }
      })
    })

    it("isValidDate & isGreaterThanOrEqualToDate", () => {
      assertFragments(Schema.Date.check(Schema.isValidDate(), Schema.isGreaterThanOrEqualToDate(new Date(0))), {
        constraints: {
          date: {
            noInvalidDate: true,
            min: new Date(0)
          }
        }
      })
    })

    it("isGreaterThanOrEqualToBigInt", () => {
      assertFragments(Schema.BigInt.check(Schema.isGreaterThanOrEqualToBigInt(BigInt(0))), {
        constraints: {
          bigint: {
            min: BigInt(0)
          }
        }
      })
    })

    it("isLessThanOrEqualToBigInt", () => {
      assertFragments(Schema.BigInt.check(Schema.isLessThanOrEqualToBigInt(BigInt(10))), {
        constraints: {
          bigint: {
            max: BigInt(10)
          }
        }
      })
    })

    it("isBetweenBigInt", () => {
      assertFragments(Schema.BigInt.check(Schema.isBetweenBigInt(BigInt(0), BigInt(10))), {
        constraints: {
          bigint: {
            min: BigInt(0),
            max: BigInt(10)
          }
        }
      })
    })

    it("UniqueArray", () => {
      const comparator = Schema.makeEquivalence(Schema.String)
      assertFragments(Schema.UniqueArray(Schema.String), {
        constraints: {
          array: {
            comparator
          }
        }
      })
      assertFragments(Schema.UniqueArray(Schema.String).check(Schema.isMaxLength(2)), {
        constraints: {
          array: {
            maxLength: 2,
            comparator
          },
          string: {
            maxLength: 2
          }
        }
      })
    })
  })
})
