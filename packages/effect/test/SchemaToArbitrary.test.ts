import { Schema, SchemaAST, SchemaCheck, SchemaToArbitrary } from "effect"
import { describe, it } from "vitest"
import * as Util from "./SchemaTest.js"
import { deepStrictEqual, fail, strictEqual, throws } from "./utils/assert.js"

const assertions = Util.assertions({
  deepStrictEqual,
  strictEqual,
  throws,
  fail
})

function assertFragments(schema: Schema.Schema<any>, ctx: SchemaToArbitrary.Context) {
  const ast = schema.ast
  const filters = SchemaAST.getFilters(ast.checks)
  const f = SchemaToArbitrary.mergeChecksFragments(filters)
  deepStrictEqual(f({}), ctx)
}

describe("SchemaToArbitrary", () => {
  it("Any", () => {
    assertions.arbitrary.satisfy(Schema.Any)
  })

  it("Unknown", () => {
    assertions.arbitrary.satisfy(Schema.Unknown)
  })

  it("Void", () => {
    assertions.arbitrary.satisfy(Schema.Void)
  })

  it("Null", () => {
    assertions.arbitrary.satisfy(Schema.Null)
  })

  it("String", () => {
    assertions.arbitrary.satisfy(Schema.String)
  })

  it("Number", () => {
    assertions.arbitrary.satisfy(Schema.Number)
  })

  it("Boolean", () => {
    assertions.arbitrary.satisfy(Schema.Boolean)
  })

  it("BigInt", () => {
    assertions.arbitrary.satisfy(Schema.BigInt)
  })

  it("Symbol", () => {
    assertions.arbitrary.satisfy(Schema.Symbol)
  })

  it("UniqueSymbol", () => {
    assertions.arbitrary.satisfy(Schema.UniqueSymbol(Symbol.for("a")))
  })

  it("Object", () => {
    assertions.arbitrary.satisfy(Schema.Object)
  })

  describe("Literal", () => {
    it("string", () => {
      assertions.arbitrary.satisfy(Schema.Literal("a"))
    })

    it("number", () => {
      assertions.arbitrary.satisfy(Schema.Literal(1))
    })

    it("boolean", () => {
      assertions.arbitrary.satisfy(Schema.Literal(true))
    })

    it("bigint", () => {
      assertions.arbitrary.satisfy(Schema.Literal(1n))
    })
  })

  it("Literals", () => {
    assertions.arbitrary.satisfy(Schema.Literals(["a", "b", "c"]))
  })

  describe("TemplateLiteral", () => {
    it("a", () => {
      const schema = Schema.TemplateLiteral([Schema.Literal("a")])
      assertions.arbitrary.satisfy(schema)
    })

    it("a b", () => {
      const schema = Schema.TemplateLiteral([Schema.Literal("a"), Schema.Literal(" "), Schema.Literal("b")])
      assertions.arbitrary.satisfy(schema)
    })

    it("a${string}", () => {
      const schema = Schema.TemplateLiteral([Schema.Literal("a"), Schema.String])
      assertions.arbitrary.satisfy(schema)
    })

    it("a${number}", () => {
      const schema = Schema.TemplateLiteral([Schema.Literal("a"), Schema.Number])
      assertions.arbitrary.satisfy(schema)
    })

    it("a", () => {
      const schema = Schema.TemplateLiteral([Schema.Literal("a")])
      assertions.arbitrary.satisfy(schema)
    })

    it("${string}", () => {
      const schema = Schema.TemplateLiteral([Schema.String])
      assertions.arbitrary.satisfy(schema)
    })

    it("a${string}b", () => {
      const schema = Schema.TemplateLiteral([Schema.Literal("a"), Schema.String, Schema.Literal("b")])
      assertions.arbitrary.satisfy(schema)
    })

    it("https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html", async () => {
      const EmailLocaleIDs = Schema.Literals(["welcome_email", "email_heading"])
      const FooterLocaleIDs = Schema.Literals(["footer_title", "footer_sendoff"])
      const schema = Schema.TemplateLiteral([Schema.Union([EmailLocaleIDs, FooterLocaleIDs]), "_id"])
      assertions.arbitrary.satisfy(schema)
    })

    it("< + h + (1|2) + >", async () => {
      const schema = Schema.TemplateLiteral([
        Schema.Literal("<"),
        Schema.TemplateLiteral([Schema.Literal("h"), Schema.Union([Schema.Literal(1), Schema.Literal(2)])]),
        Schema.Literal(">")
      ])
      assertions.arbitrary.satisfy(schema)
    })
  })

  describe("Enums", () => {
    it("Numeric enums", () => {
      enum Fruits {
        Apple,
        Banana
      }
      assertions.arbitrary.satisfy(Schema.Enums(Fruits))
    })

    it("String enums", () => {
      enum Fruits {
        Apple = "apple",
        Banana = "banana",
        Cantaloupe = 0
      }
      assertions.arbitrary.satisfy(Schema.Enums(Fruits))
    })

    it("Const enums", () => {
      const Fruits = {
        Apple: "apple",
        Banana: "banana",
        Cantaloupe: 3
      } as const
      assertions.arbitrary.satisfy(Schema.Enums(Fruits))
    })
  })

  it("Union", () => {
    assertions.arbitrary.satisfy(
      Schema.Union([Schema.String, Schema.Number])
    )
  })

  describe("Tuple", () => {
    it("empty", () => {
      assertions.arbitrary.satisfy(
        Schema.Tuple([])
      )
    })

    it("required element", () => {
      assertions.arbitrary.satisfy(
        Schema.Tuple([Schema.String])
      )
      assertions.arbitrary.satisfy(
        Schema.Tuple([Schema.String, Schema.Number])
      )
    })

    it("optionalKey element", () => {
      assertions.arbitrary.satisfy(
        Schema.Tuple([Schema.optionalKey(Schema.Number)])
      )
      assertions.arbitrary.satisfy(
        Schema.Tuple([Schema.String, Schema.optionalKey(Schema.Number)])
      )
    })

    it("optional element", () => {
      assertions.arbitrary.satisfy(
        Schema.Tuple([Schema.optional(Schema.Number)])
      )
      assertions.arbitrary.satisfy(
        Schema.Tuple([Schema.String, Schema.optional(Schema.Number)])
      )
    })
  })

  describe("Array", () => {
    it("Array", () => {
      assertions.arbitrary.satisfy(Schema.Array(Schema.String))
    })
  })

  it("TupleWithRest", () => {
    assertions.arbitrary.satisfy(
      Schema.TupleWithRest(Schema.Tuple([Schema.Boolean]), [Schema.Number, Schema.String])
    )
    assertions.arbitrary.satisfy(
      Schema.TupleWithRest(Schema.Tuple([]), [Schema.Number, Schema.String])
    )
    assertions.arbitrary.satisfy(
      Schema.TupleWithRest(Schema.Tuple([Schema.optionalKey(Schema.Boolean)]), [Schema.Number]).check(
        SchemaCheck.minLength(3)
      )
    )
  })

  describe("Struct", () => {
    it("empty", () => {
      assertions.arbitrary.satisfy(Schema.Struct({}))
    })

    it("required fields", () => {
      assertions.arbitrary.satisfy(Schema.Struct({
        a: Schema.String
      }))
      assertions.arbitrary.satisfy(Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }))
    })

    it("required field with undefined", () => {
      assertions.arbitrary.satisfy(Schema.Struct({
        a: Schema.UndefinedOr(Schema.String)
      }))
    })

    it("optionalKey field", () => {
      assertions.arbitrary.satisfy(Schema.Struct({
        a: Schema.optionalKey(Schema.String)
      }))
    })

    it("optional field", () => {
      assertions.arbitrary.satisfy(Schema.Struct({
        a: Schema.optional(Schema.String)
      }))
    })
  })

  describe("Record", () => {
    it("Record(String, Number)", () => {
      assertions.arbitrary.satisfy(Schema.Record(Schema.String, Schema.Number))
    })

    it("Record(Symbol, Number)", () => {
      assertions.arbitrary.satisfy(Schema.Record(Schema.Symbol, Schema.Number))
    })
  })

  it("StructWithRest", () => {
    assertions.arbitrary.satisfy(Schema.StructWithRest(
      Schema.Struct({ a: Schema.Number }),
      [Schema.Record(Schema.String, Schema.Number)]
    ))
    assertions.arbitrary.satisfy(Schema.StructWithRest(
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
      assertions.arbitrary.satisfy(schema)
    })
  })

  describe("suspend", () => {
    it("Tuple", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Tuple([
        Schema.Number,
        Schema.NullOr(Rec)
      ])
      assertions.arbitrary.satisfy(schema)
    })

    it("Array", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema: any = Schema.Array(Schema.Union([Schema.String, Rec]))
      assertions.arbitrary.satisfy(schema)
    })

    it("Struct", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Struct({
        a: Schema.String,
        as: Schema.Array(Rec)
      })
      assertions.arbitrary.satisfy(schema)
    })

    it("Record", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Record(Schema.String, Rec)
      assertions.arbitrary.satisfy(schema)
    })

    it("optional", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema: any = Schema.Struct({
        a: Schema.optional(Rec)
      })
      assertions.arbitrary.satisfy(schema)
    })

    it("Array + Array", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema: any = Schema.Struct({
        a: Schema.Array(Rec),
        b: Schema.Array(Rec)
      })
      assertions.arbitrary.satisfy(schema)
    })

    it("optional + Array", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema: any = Schema.Struct({
        a: Schema.optional(Rec),
        b: Schema.Array(Rec)
      })
      assertions.arbitrary.satisfy(schema)
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
      assertions.arbitrary.satisfy(Operation)
    })

    it("Option", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Struct({
        a: Schema.String,
        as: Schema.Option(Rec)
      })
      assertions.arbitrary.satisfy(schema)
    })

    it("Map", () => {
      const Rec = Schema.suspend((): Schema.Codec<any> => schema)
      const schema = Schema.Map(Schema.String, Rec)
      assertions.arbitrary.satisfy(schema)
    })
  })

  describe("checks", () => {
    it("minLength(2)", () => {
      assertions.arbitrary.satisfy(Schema.String.pipe(Schema.check(SchemaCheck.minLength(2))))
      assertions.arbitrary.satisfy(Schema.Array(Schema.String).pipe(Schema.check(SchemaCheck.minLength(2))))
    })

    it("maxLength(2)", () => {
      assertions.arbitrary.satisfy(Schema.String.pipe(Schema.check(SchemaCheck.maxLength(2))))
      assertions.arbitrary.satisfy(Schema.Array(Schema.String).pipe(Schema.check(SchemaCheck.maxLength(2))))
    })

    it("minLength(2) & maxLength(4)", () => {
      assertions.arbitrary.satisfy(Schema.String.pipe(Schema.check(SchemaCheck.minLength(2), SchemaCheck.maxLength(4))))
      assertions.arbitrary.satisfy(
        Schema.Array(Schema.String).pipe(Schema.check(SchemaCheck.minLength(2), SchemaCheck.maxLength(4)))
      )
    })

    it("length(2)", () => {
      assertions.arbitrary.satisfy(Schema.String.pipe(Schema.check(SchemaCheck.length(2))))
      assertions.arbitrary.satisfy(Schema.Array(Schema.String).pipe(Schema.check(SchemaCheck.length(2))))
    })

    it("minEntries(2)", () => {
      assertions.arbitrary.satisfy(
        Schema.Record(Schema.String, Schema.Number).check(SchemaCheck.minEntries(2))
      )
    })

    it("maxEntries(2)", () => {
      assertions.arbitrary.satisfy(
        Schema.Record(Schema.String, Schema.Number).check(SchemaCheck.maxEntries(2))
      )
    })

    it("minEntries(2) & maxEntries(4)", () => {
      assertions.arbitrary.satisfy(
        Schema.Record(Schema.String, Schema.Number).check(SchemaCheck.minEntries(2), SchemaCheck.maxEntries(4))
      )
    })

    it("entries(2)", () => {
      assertions.arbitrary.satisfy(
        Schema.Record(Schema.String, Schema.Number).check(SchemaCheck.entries(2))
      )
    })

    it("int", () => {
      const schema = Schema.Number.check(SchemaCheck.int)
      assertions.arbitrary.satisfy(schema)
    })

    it("int32", () => {
      const schema = Schema.Number.check(SchemaCheck.int32)
      assertions.arbitrary.satisfy(schema)
    })

    it("regex", () => {
      assertions.arbitrary.satisfy(Schema.String.check(SchemaCheck.regex(/^[A-Z]{3}[0-9]{3}$/)))
    })

    it("nonEmpty + regex", () => {
      assertions.arbitrary.satisfy(Schema.String.check(SchemaCheck.nonEmpty, SchemaCheck.regex(/^[-]*$/)))
    })

    it("regex + regex", () => {
      assertions.arbitrary.satisfy(
        Schema.String.check(SchemaCheck.regex(/^[^A-Z]*$/), SchemaCheck.regex(/^0x[0-9a-f]{40}$/))
      )
    })

    it("greaterThanOrEqualToDate", () => {
      assertions.arbitrary.satisfy(Schema.Date.check(SchemaCheck.greaterThanOrEqualToDate(new Date(0))))
    })

    it("lessThanOrEqualToDate", () => {
      assertions.arbitrary.satisfy(Schema.Date.check(SchemaCheck.lessThanOrEqualToDate(new Date(10))))
    })

    it("betweenDate", () => {
      assertions.arbitrary.satisfy(Schema.Date.check(SchemaCheck.betweenDate(new Date(0), new Date(10))))
    })

    it("ValidDate", () => {
      assertions.arbitrary.satisfy(Schema.ValidDate)
    })

    it("greaterThanOrEqualToBigInt", () => {
      assertions.arbitrary.satisfy(Schema.BigInt.check(SchemaCheck.greaterThanOrEqualToBigInt(BigInt(0))))
    })

    it("lessThanOrEqualToBigInt", () => {
      assertions.arbitrary.satisfy(Schema.BigInt.check(SchemaCheck.lessThanOrEqualToBigInt(BigInt(10))))
    })

    it("betweenBigInt", () => {
      assertions.arbitrary.satisfy(Schema.BigInt.check(SchemaCheck.betweenBigInt(BigInt(0), BigInt(10))))
    })
  })

  it("Finite", () => {
    assertions.arbitrary.satisfy(Schema.Finite)
  })

  it("Date", () => {
    assertions.arbitrary.satisfy(Schema.Date)
  })

  it("URL", () => {
    assertions.arbitrary.satisfy(Schema.URL)
  })

  it("UnknownFromJsonString", () => {
    assertions.arbitrary.satisfy(Schema.UnknownFromJsonString)
  })

  it("Option(String)", () => {
    assertions.arbitrary.satisfy(Schema.Option(Schema.String))
  })

  describe("Map", () => {
    it("Map(String, Number)", () => {
      assertions.arbitrary.satisfy(Schema.Map(Schema.String, Schema.Number))
    })

    it("minSize(2)", () => {
      assertions.arbitrary.satisfy(
        Schema.Map(Schema.String, Schema.Number).check(SchemaCheck.minSize(2))
      )
    })

    it("maxSize(4)", () => {
      assertions.arbitrary.satisfy(
        Schema.Map(Schema.String, Schema.Number).check(SchemaCheck.maxSize(4))
      )
    })

    it("minSize(2) & maxSize(4)", () => {
      assertions.arbitrary.satisfy(
        Schema.Map(Schema.String, Schema.Number).check(SchemaCheck.minSize(2), SchemaCheck.maxSize(4))
      )
    })

    it("size(2)", () => {
      assertions.arbitrary.satisfy(
        Schema.Map(Schema.String, Schema.Number).check(SchemaCheck.size(2))
      )
    })
  })

  describe("fragments", () => {
    it("String", () => {
      assertFragments(Schema.String, {
        fragments: {}
      })
    })

    it("String & nonEmpty", () => {
      assertFragments(Schema.String.check(SchemaCheck.nonEmpty), {
        fragments: {
          array: {
            type: "array",
            minLength: 1
          },
          string: {
            type: "string",
            minLength: 1
          }
        }
      })
    })

    it("String & nonEmpty & minLength(2)", () => {
      assertFragments(Schema.String.check(SchemaCheck.nonEmpty).check(SchemaCheck.minLength(2)), {
        fragments: {
          array: {
            type: "array",
            minLength: 2
          },
          string: {
            type: "string",
            minLength: 2
          }
        }
      })
    })

    it("String & minLength(2) & nonEmpty", () => {
      assertFragments(Schema.String.check(SchemaCheck.minLength(2)).check(SchemaCheck.nonEmpty), {
        fragments: {
          array: {
            type: "array",
            minLength: 2
          },
          string: {
            type: "string",
            minLength: 2
          }
        }
      })
    })

    it("String & nonEmpty & maxLength(2)", () => {
      assertFragments(Schema.String.check(SchemaCheck.nonEmpty).check(SchemaCheck.maxLength(2)), {
        fragments: {
          array: {
            type: "array",
            minLength: 1,
            maxLength: 2
          },
          string: {
            type: "string",
            minLength: 1,
            maxLength: 2
          }
        }
      })
    })

    it("String & length(2)", () => {
      assertFragments(Schema.String.check(SchemaCheck.length(2)), {
        fragments: {
          array: {
            type: "array",
            minLength: 2,
            maxLength: 2
          },
          string: {
            type: "string",
            minLength: 2,
            maxLength: 2
          }
        }
      })
    })

    it("startsWith", () => {
      assertFragments(Schema.String.check(SchemaCheck.startsWith("a")), {
        fragments: {
          string: {
            type: "string",
            patterns: ["^a"]
          }
        }
      })
    })

    it("endsWith", () => {
      assertFragments(Schema.String.check(SchemaCheck.endsWith("a")), {
        fragments: {
          string: {
            type: "string",
            patterns: ["a$"]
          }
        }
      })
    })

    it("Number", () => {
      assertFragments(Schema.Number, {
        fragments: {}
      })
    })

    it("finite", () => {
      assertFragments(Schema.Number.check(SchemaCheck.finite), {
        fragments: {
          number: {
            type: "number",
            noDefaultInfinity: true,
            noNaN: true
          }
        }
      })
    })

    it("int", () => {
      assertFragments(Schema.Number.check(SchemaCheck.int), {
        fragments: {
          number: {
            type: "number",
            isInteger: true
          }
        }
      })
    })

    it("finite & int", () => {
      assertFragments(Schema.Number.check(SchemaCheck.finite, SchemaCheck.int), {
        fragments: {
          number: {
            type: "number",
            noDefaultInfinity: true,
            noNaN: true,
            isInteger: true
          }
        }
      })
    })

    it("int32", () => {
      assertFragments(Schema.Number.check(SchemaCheck.int32), {
        fragments: {
          number: {
            type: "number",
            isInteger: true,
            max: 2147483647,
            min: -2147483648
          }
        }
      })
    })

    it("greaterThan", () => {
      assertFragments(Schema.Number.check(SchemaCheck.greaterThan(10)), {
        fragments: {
          number: {
            type: "number",
            min: 10,
            minExcluded: true
          }
        }
      })
    })

    it("greaterThanOrEqualToDate", () => {
      assertFragments(Schema.Date.check(SchemaCheck.greaterThanOrEqualToDate(new Date(0))), {
        fragments: {
          date: {
            type: "date",
            min: new Date(0)
          }
        }
      })
    })

    it("lessThanOrEqualToDate", () => {
      assertFragments(Schema.Date.check(SchemaCheck.lessThanOrEqualToDate(new Date(10))), {
        fragments: {
          date: {
            type: "date",
            max: new Date(10)
          }
        }
      })
    })

    it("betweenDate", () => {
      assertFragments(Schema.Date.check(SchemaCheck.betweenDate(new Date(0), new Date(10))), {
        fragments: {
          date: {
            type: "date",
            min: new Date(0),
            max: new Date(10)
          }
        }
      })
    })

    it("validDate", () => {
      assertFragments(Schema.Date.check(SchemaCheck.validDate), {
        fragments: {
          date: {
            type: "date",
            noInvalidDate: true
          }
        }
      })
    })

    it("validDate & greaterThanOrEqualToDate", () => {
      assertFragments(Schema.Date.check(SchemaCheck.validDate, SchemaCheck.greaterThanOrEqualToDate(new Date(0))), {
        fragments: {
          date: {
            type: "date",
            noInvalidDate: true,
            min: new Date(0)
          }
        }
      })
    })

    it("greaterThanOrEqualToBigInt", () => {
      assertFragments(Schema.BigInt.check(SchemaCheck.greaterThanOrEqualToBigInt(BigInt(0))), {
        fragments: {
          bigint: {
            type: "bigint",
            min: BigInt(0)
          }
        }
      })
    })

    it("lessThanOrEqualToBigInt", () => {
      assertFragments(Schema.BigInt.check(SchemaCheck.lessThanOrEqualToBigInt(BigInt(10))), {
        fragments: {
          bigint: {
            type: "bigint",
            max: BigInt(10)
          }
        }
      })
    })

    it("betweenBigInt", () => {
      assertFragments(Schema.BigInt.check(SchemaCheck.betweenBigInt(BigInt(0), BigInt(10))), {
        fragments: {
          bigint: {
            type: "bigint",
            min: BigInt(0),
            max: BigInt(10)
          }
        }
      })
    })
  })
})
