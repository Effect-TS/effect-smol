import { AST, Check, Schema, ToArbitrary, ToEquivalence } from "effect/schema"
import { TestSchema } from "effect/testing"
import { deepStrictEqual } from "node:assert"
import { describe, it } from "vitest"

function assertFragments(schema: Schema.Schema<any>, ctx: ToArbitrary.Context) {
  const ast = schema.ast
  const filters = AST.getFilters(ast.checks)
  const f = ToArbitrary.mergeFiltersConstraints(filters)
  deepStrictEqual(f({}), ctx)
}

function verifyGeneration<S extends Schema.Codec<unknown, unknown, never, unknown>>(schema: S) {
  const asserts = new TestSchema.Asserts(schema)
  asserts.arbitrary().verifyGeneration()
}

describe("ToArbitrary", () => {
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

  it("Object", () => {
    verifyGeneration(Schema.Object)
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

  describe("Enums", () => {
    it("Numeric enums", () => {
      enum Fruits {
        Apple,
        Banana
      }
      verifyGeneration(Schema.Enums(Fruits))
    })

    it("String enums", () => {
      enum Fruits {
        Apple = "apple",
        Banana = "banana",
        Cantaloupe = 0
      }
      verifyGeneration(Schema.Enums(Fruits))
    })

    it("Const enums", () => {
      const Fruits = {
        Apple: "apple",
        Banana: "banana",
        Cantaloupe: 3
      } as const
      verifyGeneration(Schema.Enums(Fruits))
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
        Check.minLength(3)
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

    it("Map", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Map(Schema.String, Rec)
      verifyGeneration(schema)
    })
  })

  describe("checks", () => {
    it("minLength(2)", () => {
      verifyGeneration(Schema.String.pipe(Schema.check(Check.minLength(2))))
      verifyGeneration(Schema.Array(Schema.String).pipe(Schema.check(Check.minLength(2))))
    })

    it("maxLength(2)", () => {
      verifyGeneration(Schema.String.pipe(Schema.check(Check.maxLength(2))))
      verifyGeneration(Schema.Array(Schema.String).pipe(Schema.check(Check.maxLength(2))))
    })

    it("minLength(2) & maxLength(4)", () => {
      verifyGeneration(Schema.String.pipe(Schema.check(Check.minLength(2), Check.maxLength(4))))
      verifyGeneration(
        Schema.Array(Schema.String).pipe(Schema.check(Check.minLength(2), Check.maxLength(4)))
      )
    })

    it("length(2)", () => {
      verifyGeneration(Schema.String.pipe(Schema.check(Check.length(2))))
      verifyGeneration(Schema.Array(Schema.String).pipe(Schema.check(Check.length(2))))
    })

    it("minEntries(2)", () => {
      verifyGeneration(
        Schema.Record(Schema.String, Schema.Number).check(Check.minEntries(2))
      )
    })

    it("maxEntries(2)", () => {
      verifyGeneration(
        Schema.Record(Schema.String, Schema.Number).check(Check.maxEntries(2))
      )
    })

    it("minEntries(2) & maxEntries(4)", () => {
      verifyGeneration(
        Schema.Record(Schema.String, Schema.Number).check(Check.minEntries(2), Check.maxEntries(4))
      )
    })

    it("entries(2)", () => {
      verifyGeneration(
        Schema.Record(Schema.String, Schema.Number).check(Check.entries(2))
      )
    })

    it("int", () => {
      const schema = Schema.Number.check(Check.int())
      verifyGeneration(schema)
    })

    it("int32", () => {
      const schema = Schema.Number.check(Check.int32())
      verifyGeneration(schema)
    })

    it("regex", () => {
      verifyGeneration(Schema.String.check(Check.regex(/^[A-Z]{3}[0-9]{3}$/)))
    })

    it("nonEmpty + regex", () => {
      verifyGeneration(Schema.NonEmptyString.check(Check.regex(/^[-]*$/)))
    })

    it("regex + regex", () => {
      verifyGeneration(
        Schema.String.check(Check.regex(/^[^A-Z]*$/), Check.regex(/^0x[0-9a-f]{40}$/))
      )
    })

    it("greaterThanOrEqualToDate", () => {
      verifyGeneration(Schema.Date.check(Check.greaterThanOrEqualToDate(new Date(0))))
    })

    it("lessThanOrEqualToDate", () => {
      verifyGeneration(Schema.Date.check(Check.lessThanOrEqualToDate(new Date(10))))
    })

    it("betweenDate", () => {
      verifyGeneration(Schema.Date.check(Check.betweenDate(new Date(0), new Date(10))))
    })

    it("ValidDate", () => {
      verifyGeneration(Schema.ValidDate)
    })

    it("greaterThanOrEqualToBigInt", () => {
      verifyGeneration(Schema.BigInt.check(Check.greaterThanOrEqualToBigInt(BigInt(0))))
    })

    it("lessThanOrEqualToBigInt", () => {
      verifyGeneration(Schema.BigInt.check(Check.lessThanOrEqualToBigInt(BigInt(10))))
    })

    it("betweenBigInt", () => {
      verifyGeneration(Schema.BigInt.check(Check.betweenBigInt(BigInt(0), BigInt(10))))
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

  it("UnknownFromJsonString", () => {
    verifyGeneration(Schema.UnknownFromJsonString)
  })

  it("Option(String)", () => {
    verifyGeneration(Schema.Option(Schema.String))
  })

  it("Result(Number, String)", () => {
    verifyGeneration(Schema.Result(Schema.Number, Schema.String))
  })

  describe("Map", () => {
    it("Map(String, Number)", () => {
      verifyGeneration(Schema.Map(Schema.String, Schema.Number))
    })

    it("minSize(2)", () => {
      verifyGeneration(
        Schema.Map(Schema.String, Schema.Number).check(Check.minSize(2))
      )
    })

    it("maxSize(4)", () => {
      verifyGeneration(
        Schema.Map(Schema.String, Schema.Number).check(Check.maxSize(4))
      )
    })

    it("minSize(2) & maxSize(4)", () => {
      verifyGeneration(
        Schema.Map(Schema.String, Schema.Number).check(Check.minSize(2), Check.maxSize(4))
      )
    })

    it("size(2)", () => {
      verifyGeneration(
        Schema.Map(Schema.String, Schema.Number).check(Check.size(2))
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
          ArrayConstraints: {
            _tag: "ArrayConstraints",
            minLength: 1
          },
          StringConstraints: {
            _tag: "StringConstraints",
            minLength: 1
          }
        }
      })
    })

    it("String & nonEmpty & minLength(2)", () => {
      assertFragments(Schema.String.check(Check.nonEmpty()).check(Check.minLength(2)), {
        constraints: {
          ArrayConstraints: {
            _tag: "ArrayConstraints",
            minLength: 2
          },
          StringConstraints: {
            _tag: "StringConstraints",
            minLength: 2
          }
        }
      })
    })

    it("String & minLength(2) & nonEmpty", () => {
      assertFragments(Schema.String.check(Check.minLength(2)).check(Check.nonEmpty()), {
        constraints: {
          ArrayConstraints: {
            _tag: "ArrayConstraints",
            minLength: 2
          },
          StringConstraints: {
            _tag: "StringConstraints",
            minLength: 2
          }
        }
      })
    })

    it("String & nonEmpty & maxLength(2)", () => {
      assertFragments(Schema.String.check(Check.nonEmpty()).check(Check.maxLength(2)), {
        constraints: {
          ArrayConstraints: {
            _tag: "ArrayConstraints",
            minLength: 1,
            maxLength: 2
          },
          StringConstraints: {
            _tag: "StringConstraints",
            minLength: 1,
            maxLength: 2
          }
        }
      })
    })

    it("String & length(2)", () => {
      assertFragments(Schema.String.check(Check.length(2)), {
        constraints: {
          ArrayConstraints: {
            _tag: "ArrayConstraints",
            minLength: 2,
            maxLength: 2
          },
          StringConstraints: {
            _tag: "StringConstraints",
            minLength: 2,
            maxLength: 2
          }
        }
      })
    })

    it("startsWith", () => {
      assertFragments(Schema.String.check(Check.startsWith("a")), {
        constraints: {
          StringConstraints: {
            _tag: "StringConstraints",
            patterns: ["^a"]
          }
        }
      })
    })

    it("endsWith", () => {
      assertFragments(Schema.String.check(Check.endsWith("a")), {
        constraints: {
          StringConstraints: {
            _tag: "StringConstraints",
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

    it("finite", () => {
      assertFragments(Schema.Number.check(Check.finite()), {
        constraints: {
          NumberConstraints: {
            _tag: "NumberConstraints",
            noDefaultInfinity: true,
            noNaN: true
          }
        }
      })
    })

    it("int", () => {
      assertFragments(Schema.Number.check(Check.int()), {
        constraints: {
          NumberConstraints: {
            _tag: "NumberConstraints",
            isInteger: true
          }
        }
      })
    })

    it("finite & int", () => {
      assertFragments(Schema.Number.check(Check.finite(), Check.int()), {
        constraints: {
          NumberConstraints: {
            _tag: "NumberConstraints",
            noDefaultInfinity: true,
            noNaN: true,
            isInteger: true
          }
        }
      })
    })

    it("int32", () => {
      assertFragments(Schema.Number.check(Check.int32()), {
        constraints: {
          NumberConstraints: {
            _tag: "NumberConstraints",
            isInteger: true,
            max: 2147483647,
            min: -2147483648
          }
        }
      })
    })

    it("greaterThan", () => {
      assertFragments(Schema.Number.check(Check.greaterThan(10)), {
        constraints: {
          NumberConstraints: {
            _tag: "NumberConstraints",
            min: 10,
            minExcluded: true
          }
        }
      })
    })

    it("greaterThanOrEqualToDate", () => {
      assertFragments(Schema.Date.check(Check.greaterThanOrEqualToDate(new Date(0))), {
        constraints: {
          DateConstraints: {
            _tag: "DateConstraints",
            min: new Date(0)
          }
        }
      })
    })

    it("lessThanOrEqualToDate", () => {
      assertFragments(Schema.Date.check(Check.lessThanOrEqualToDate(new Date(10))), {
        constraints: {
          DateConstraints: {
            _tag: "DateConstraints",
            max: new Date(10)
          }
        }
      })
    })

    it("betweenDate", () => {
      assertFragments(Schema.Date.check(Check.betweenDate(new Date(0), new Date(10))), {
        constraints: {
          DateConstraints: {
            _tag: "DateConstraints",
            min: new Date(0),
            max: new Date(10)
          }
        }
      })
    })

    it("validDate", () => {
      assertFragments(Schema.Date.check(Check.validDate()), {
        constraints: {
          DateConstraints: {
            _tag: "DateConstraints",
            noInvalidDate: true
          }
        }
      })
    })

    it("validDate & greaterThanOrEqualToDate", () => {
      assertFragments(Schema.Date.check(Check.validDate(), Check.greaterThanOrEqualToDate(new Date(0))), {
        constraints: {
          DateConstraints: {
            _tag: "DateConstraints",
            noInvalidDate: true,
            min: new Date(0)
          }
        }
      })
    })

    it("greaterThanOrEqualToBigInt", () => {
      assertFragments(Schema.BigInt.check(Check.greaterThanOrEqualToBigInt(BigInt(0))), {
        constraints: {
          BigIntConstraints: {
            _tag: "BigIntConstraints",
            min: BigInt(0)
          }
        }
      })
    })

    it("lessThanOrEqualToBigInt", () => {
      assertFragments(Schema.BigInt.check(Check.lessThanOrEqualToBigInt(BigInt(10))), {
        constraints: {
          BigIntConstraints: {
            _tag: "BigIntConstraints",
            max: BigInt(10)
          }
        }
      })
    })

    it("betweenBigInt", () => {
      assertFragments(Schema.BigInt.check(Check.betweenBigInt(BigInt(0), BigInt(10))), {
        constraints: {
          BigIntConstraints: {
            _tag: "BigIntConstraints",
            min: BigInt(0),
            max: BigInt(10)
          }
        }
      })
    })

    it("UniqueArray", () => {
      const comparator = ToEquivalence.make(Schema.String)
      assertFragments(Schema.UniqueArray(Schema.String), {
        constraints: {
          ArrayConstraints: {
            _tag: "ArrayConstraints",
            comparator
          }
        }
      })
      assertFragments(Schema.UniqueArray(Schema.String).check(Check.maxLength(2)), {
        constraints: {
          ArrayConstraints: {
            _tag: "ArrayConstraints",
            maxLength: 2,
            comparator
          },
          StringConstraints: {
            _tag: "StringConstraints",
            maxLength: 2
          }
        }
      })
    })
  })
})
