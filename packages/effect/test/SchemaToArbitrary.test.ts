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
  const f = SchemaToArbitrary.mapContext(filters)
  deepStrictEqual(f({}), ctx)
}

describe("SchemaToArbitrary", () => {
  it("String", () => {
    const schema = Schema.String
    assertions.arbitrary.satisfy(schema)
  })

  it("Number", () => {
    const schema = Schema.Number
    assertions.arbitrary.satisfy(schema)
  })

  it("Boolean", () => {
    const schema = Schema.Boolean
    assertions.arbitrary.satisfy(schema)
  })

  it("BigInt", () => {
    const schema = Schema.BigInt
    assertions.arbitrary.satisfy(schema)
  })

  it("Symbol", () => {
    const schema = Schema.Symbol
    assertions.arbitrary.satisfy(schema)
  })

  it("UniqueSymbol", () => {
    const schema = Schema.UniqueSymbol(Symbol.for("a"))
    assertions.arbitrary.satisfy(schema)
  })

  it("Literal", () => {
    const schema = Schema.Literal("a")
    assertions.arbitrary.satisfy(schema)
  })

  it("TemplateLiteral", () => {
    const schema = Schema.TemplateLiteral(["a", Schema.String])
    assertions.arbitrary.satisfy(schema)
  })

  it("Enums", () => {
    enum Fruits {
      Apple,
      Banana,
      Orange = "orange"
    }
    const schema = Schema.Enums(Fruits)
    assertions.arbitrary.satisfy(schema)
  })

  it("Union", () => {
    const schema = Schema.Union([Schema.String, Schema.Number])
    assertions.arbitrary.satisfy(schema)
  })

  describe("Tuple", () => {
    it("required elements", () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number])
      assertions.arbitrary.satisfy(schema)
    })

    it("optionalKey elements", () => {
      const schema = Schema.Tuple([Schema.String, Schema.optionalKey(Schema.Number)])
      assertions.arbitrary.satisfy(schema)
    })

    it("optional elements", () => {
      const schema = Schema.Tuple([Schema.String, Schema.optional(Schema.Number)])
      assertions.arbitrary.satisfy(schema)
    })
  })

  describe("Array", () => {
    it("Array", () => {
      const schema = Schema.Array(Schema.String)
      assertions.arbitrary.satisfy(schema)
    })
  })

  describe("TupleWithRest", () => {
    it("tuple & rest", () => {
      const schema = Schema.TupleWithRest(Schema.Tuple([Schema.Boolean]), [Schema.Number, Schema.String])
      assertions.arbitrary.satisfy(schema)
    })

    it("rest", () => {
      const schema = Schema.TupleWithRest(Schema.Tuple([]), [Schema.Number, Schema.String])
      assertions.arbitrary.satisfy(schema)
    })
  })

  describe("Struct", () => {
    it("Struct", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      })
      assertions.arbitrary.satisfy(schema)
    })
  })

  describe("Record", () => {
    it("Record(String, Number)", () => {
      const schema = Schema.Record(Schema.String, Schema.Number)
      assertions.arbitrary.satisfy(schema)
    })
  })

  describe("StructWithRest", () => {
    it("Record(String, Number)", () => {
      const schema = Schema.StructWithRest(
        Schema.Struct({ a: Schema.Number }),
        [Schema.Record(Schema.String, Schema.Number)]
      )
      assertions.arbitrary.satisfy(schema)
    })
  })

  it("Option(String)", () => {
    const schema = Schema.Option(Schema.String)
    assertions.arbitrary.satisfy(schema)
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

    describe("checks", () => {
      it("minLength", () => {
        const schema = Schema.String.pipe(Schema.check(SchemaCheck.minLength(3)))
        assertions.arbitrary.satisfy(schema)
      })

      it("int", () => {
        const schema = Schema.Number.check(SchemaCheck.int)
        assertions.arbitrary.satisfy(schema)
      })

      it("int32", () => {
        const schema = Schema.Number.check(SchemaCheck.int32)
        assertions.arbitrary.satisfy(schema)
      })
    })

    it("Finite", () => {
      const schema = Schema.Finite
      assertions.arbitrary.satisfy(schema)
    })
  })

  describe("fragments", () => {
    it("String", () => {
      const schema = Schema.String
      assertFragments(schema, {
        fragments: {}
      })
    })

    it("String & minLength(1)", () => {
      const schema = Schema.String.check(SchemaCheck.minLength(1))
      assertFragments(schema, {
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

    it("String & minLength(1) & minLength(2)", () => {
      const schema = Schema.String.check(SchemaCheck.minLength(1)).check(SchemaCheck.minLength(2))
      assertFragments(schema, {
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

    it("String & minLength(2) & minLength(1)", () => {
      const schema = Schema.String.check(SchemaCheck.minLength(2)).check(SchemaCheck.minLength(1))
      assertFragments(schema, {
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

    it("String & minLength(1) & maxLength(2)", () => {
      const schema = Schema.String.check(SchemaCheck.minLength(1)).check(SchemaCheck.maxLength(2))
      assertFragments(schema, {
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
      const schema = Schema.String.check(SchemaCheck.length(2))
      assertFragments(schema, {
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
      const schema = Schema.String.check(SchemaCheck.startsWith("a"))
      assertFragments(schema, {
        fragments: {
          string: {
            type: "string",
            patterns: ["^a"]
          }
        }
      })
    })

    it("endsWith", () => {
      const schema = Schema.String.check(SchemaCheck.endsWith("a"))
      assertFragments(schema, {
        fragments: {
          string: {
            type: "string",
            patterns: ["a$"]
          }
        }
      })
    })

    it("Number", () => {
      const schema = Schema.Number
      assertFragments(schema, {
        fragments: {}
      })
    })

    it("finite", () => {
      const schema = Schema.Number.check(SchemaCheck.finite)
      assertFragments(schema, {
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
      const schema = Schema.Number.check(SchemaCheck.int)
      assertFragments(schema, {
        fragments: {
          number: {
            type: "number",
            isInteger: true
          }
        }
      })
    })

    it("finite & int", () => {
      const schema = Schema.Number.check(SchemaCheck.finite, SchemaCheck.int)
      assertFragments(schema, {
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
      const schema = Schema.Number.check(SchemaCheck.int32)
      assertFragments(schema, {
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
      const schema = Schema.Number.check(SchemaCheck.greaterThan(10))
      assertFragments(schema, {
        fragments: {
          number: {
            type: "number",
            min: 10,
            minExcluded: true
          }
        }
      })
    })
  })

  describe("mostRestrictivePattern", () => {
    it("returns the single pattern when array has one element", () => {
      const patterns = ["^hello$"] as const
      const result = SchemaToArbitrary.mostRestrictivePattern(patterns)
      strictEqual(result, "^hello$")
    })

    it("picks the pattern with more metacharacters", () => {
      // "foo" has 0 metacharacters
      // "f.o" has 1 metacharacter (the dot)
      const patterns = ["foo", "f.o"] as const
      const result = SchemaToArbitrary.mostRestrictivePattern(patterns)
      strictEqual(result, "f.o")
    })

    it("breaks ties by choosing the longer pattern", () => {
      // Both have exactly one metacharacter (the dot), but lengths differ
      const patterns = ["a.b", "x.yz"] as const
      // a.b length = 3, x.yz length = 4 → pick "x.yz"
      const result = SchemaToArbitrary.mostRestrictivePattern(patterns)
      strictEqual(result, "x.yz")
    })

    it("counts quantifier-ranges as extra complexity", () => {
      // "{2,5}" is counted as one extra unit
      // "abc\\d{2,5}" has 1 backslash, 1 "{2,5}" → total complexity = 2
      // "^hello.*world$" has anchors ^, $, dot, star → complexity = 4
      const patterns = [
        "abc\\d{2,5}",
        "^hello.*world$"
      ] as const
      const result = SchemaToArbitrary.mostRestrictivePattern(patterns)
      strictEqual(result, "^hello.*world$")
    })

    it("handles multiple patterns and picks the overall most complex", () => {
      const patterns = [
        "simple", // complexity 0
        "\\d+", // backslash, plus → 2
        "[A-Za-z]{3,}" // brackets, braces "{3,}", digits inside → count as 2 (one for [], one for {3,})
        // plus the braces count so total = 3
      ] as const
      // computeRegexComplexity("[A-Za-z]{3,}") =
      //   singleMeta: [, ], {, }, → 4
      //   range {3,} → +1 → total 5
      // "\\d+" → singleMeta: \, + → 2; no range → total 2
      // so pick "[A-Za-z]{3,}"
      const result = SchemaToArbitrary.mostRestrictivePattern(patterns)
      strictEqual(result, "[A-Za-z]{3,}")
    })

    it("correctly merges patterns with lookahead-style contents", () => {
      // Patterns may already use lookahead or grouping; count metacharacters accordingly
      const patterns = [
        "(?=foo)", // "(", "?", "=", ")", → 4
        "(bar|baz)\\d{1,2}" // "(", "|", ")", "\", "{1,2}" → singleMeta 4 + range 1 = 5
      ] as const
      const result = SchemaToArbitrary.mostRestrictivePattern(patterns)
      strictEqual(result, "(bar|baz)\\d{1,2}")
    })

    it("chooses the longer pattern when complexities and metacharachter counts tie", () => {
      // Both have two metacharacters: "^.$" has "^", ".", "$" → 3
      // "[a-b]" has "[", "-", "]" → 3 (we count "-" as literal here; singleMetaRe only counts [ and ])
      // But singleMetaRe does not count "-", so complexity("[a-b]") = 2 (for [ and ])
      // complexity("^.$") = 3. So in fact "^.$" wins by complexity
      // Let's create two truly tied examples:
      // "a.b" → ".", complexity = 1
      // "x?y" → "?", complexity = 1
      // lengths: "a.b".length = 3, "x?y".length = 3 → still tie, but our tie-breaker picks the first
      const patterns = ["a.b", "x?y"] as const
      const result = SchemaToArbitrary.mostRestrictivePattern(patterns)
      strictEqual(result, "a.b") // first wins because both complexity = 1 and same length

      // Now tie in complexity but different length:
      // "a.b" (complexity 1, length 3) vs "u.vw" (complexity 1, length 4)
      const patterns2 = ["a.b", "u.vw"] as const
      const result2 = SchemaToArbitrary.mostRestrictivePattern(patterns2)
      strictEqual(result2, "u.vw")
    })
  })
})
