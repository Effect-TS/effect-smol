import { Equivalence, Option, Redacted } from "effect/data"
import { Check, Schema, ToEquivalence } from "effect/schema"
import { describe, it } from "vitest"
import { assertFalse, assertTrue, throws } from "../utils/assert.ts"

describe("ToEquivalence", () => {
  it("String", () => {
    const schema = Schema.String
    const equivalence = ToEquivalence.make(schema)
    assertTrue(equivalence("a", "a"))
    assertFalse(equivalence("a", "b"))
  })

  describe("Tuple", () => {
    it("should fail on non-array inputs", () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number])
      const equivalence = ToEquivalence.make(schema)
      assertFalse(equivalence(["a", 1], null as never))
    })

    it("empty", () => {
      const schema = Schema.Tuple([])
      const equivalence = ToEquivalence.make(schema)
      assertTrue(equivalence([], []))
    })

    it("required elements", () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number])
      const equivalence = ToEquivalence.make(schema)
      assertTrue(equivalence(["a", 1], ["a", 1]))
      assertFalse(equivalence(["a", 1], ["b", 1]))
    })

    it("optionalKey elements", () => {
      const schema = Schema.Tuple([Schema.String, Schema.optionalKey(Schema.Number)])
      const equivalence = ToEquivalence.make(schema)
      assertTrue(equivalence(["a", 1], ["a", 1]))
      assertTrue(equivalence(["a"], ["a"]))
      assertFalse(equivalence(["a", 1], ["b", 1]))
      assertFalse(equivalence(["a"], ["b"]))
    })

    it("optional elements", () => {
      const schema = Schema.Tuple([Schema.String, Schema.optional(Schema.Number)])
      const equivalence = ToEquivalence.make(schema)
      assertTrue(equivalence(["a", 1], ["a", 1]))
      assertTrue(equivalence(["a"], ["a"]))
      assertTrue(equivalence(["a", undefined], ["a", undefined]))
      assertFalse(equivalence(["a", 1], ["b", 1]))
      assertFalse(equivalence(["a"], ["b"]))
      assertFalse(equivalence(["a", undefined], ["b", undefined]))
    })
  })

  it("Array", () => {
    const schema = Schema.Array(Schema.String)
    const equivalence = ToEquivalence.make(schema)
    assertTrue(equivalence(["a", "b", "c"], ["a", "b", "c"]))
    assertFalse(equivalence(["a", "b", "c"], ["a", "b", "d"]))
    assertFalse(equivalence(["a", "b", "c"], ["a", "b"]))
    assertFalse(equivalence(["a", "b", "c"], ["a", "b", "c", "d"]))
  })

  it("TupleWithRest", () => {
    const schema = Schema.TupleWithRest(Schema.Tuple([Schema.String, Schema.Number]), [Schema.String, Schema.Number])
    const equivalence = ToEquivalence.make(schema)
    assertTrue(equivalence(["a", 1, 2], ["a", 1, 2]))
    assertTrue(equivalence(["a", 1, "b", 2], ["a", 1, "b", 2]))

    assertFalse(equivalence(["a", 1, 2], ["a", 2, 2]))
    assertFalse(equivalence(["a", 1, 2], ["a", 1, 3]))
    assertFalse(equivalence(["a", 1, "b", 2], ["c", 1, "b", 2]))
    assertFalse(equivalence(["a", 1, "b", 2], ["a", 1, "c", 2]))
    assertFalse(equivalence(["a", 1, "b", 2], ["a", 2, "b", 2]))
    assertFalse(equivalence(["a", 1, "b", 2], ["a", 1, "b", 3]))
  })

  describe("Struct", () => {
    it("should fail on non-record inputs", () => {
      const schema = Schema.Struct({ a: Schema.String })
      const equivalence = ToEquivalence.make(schema)
      assertFalse(equivalence({ a: "a" }, 1 as never))
    })

    it("empty", () => {
      const schema = Schema.Struct({})
      const equivalence = ToEquivalence.make(schema)
      const a = {}
      assertTrue(equivalence(a, a))
      assertFalse(equivalence({}, {}))
    })

    it("required fields", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      })
      const equivalence = ToEquivalence.make(schema)
      assertTrue(equivalence({ a: "a", b: 1 }, { a: "a", b: 1 }))
      assertFalse(equivalence({ a: "a", b: 1 }, { a: "b", b: 1 }))
      assertFalse(equivalence({ a: "a", b: 1 }, { a: "a", b: 2 }))
    })

    it("symbol keys", () => {
      const a = Symbol.for("a")
      const b = Symbol.for("b")
      const schema = Schema.Struct({
        [a]: Schema.String,
        [b]: Schema.Number
      })
      const equivalence = ToEquivalence.make(schema)
      assertTrue(
        equivalence({ [a]: "a", [b]: 1 }, { [a]: "a", [b]: 1 })
      )
      assertFalse(
        equivalence({ [a]: "a", [b]: 1 }, { [a]: "b", [b]: 1 })
      )
      assertFalse(
        equivalence({ [a]: "a", [b]: 1 }, { [a]: "a", [b]: 2 })
      )
    })

    it("optionalKey fields", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.optionalKey(Schema.Number)
      })
      const equivalence = ToEquivalence.make(schema)
      assertTrue(equivalence({ a: "a", b: 1 }, { a: "a", b: 1 }))
      assertTrue(equivalence({ a: "a" }, { a: "a" }))
      assertFalse(equivalence({ a: "a" }, { a: "b" }))
      assertFalse(equivalence({ a: "a", b: 1 }, { a: "b", b: 1 }))
      assertFalse(equivalence({ a: "a", b: 1 }, { a: "a", b: 2 }))
    })

    it("optional fields", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.optional(Schema.Number)
      })
      const equivalence = ToEquivalence.make(schema)
      assertTrue(equivalence({ a: "a", b: 1 }, { a: "a", b: 1 }))
      assertTrue(equivalence({ a: "a" }, { a: "a" }))
      assertTrue(equivalence({ a: "a", b: undefined }, { a: "a", b: undefined }))
      assertFalse(equivalence({ a: "a", b: 1 }, { a: "b", b: 1 }))
      assertFalse(equivalence({ a: "a", b: 1 }, { a: "a", b: 2 }))
      assertFalse(equivalence({ a: "a", b: 1 }, { a: "a", b: undefined }))
      assertFalse(equivalence({ a: "a", b: undefined }, { a: "a", b: 1 }))
    })
  })

  describe("Record", () => {
    it("Record(String, Number)", () => {
      const schema = Schema.Record(Schema.String, Schema.Number)
      const equivalence = ToEquivalence.make(schema)
      assertTrue(equivalence({ a: 1, b: 2 }, { a: 1, b: 2 }))
      assertFalse(equivalence({ a: 1, b: 2 }, { a: 1, b: 3 }))
      assertFalse(equivalence({ a: 1, b: 2 }, { a: 2, b: 2 }))
      assertFalse(equivalence({ a: 1, b: 2 }, { a: 1, b: 2, c: 3 }))
      assertFalse(equivalence({ a: 1, b: 2, c: 3 }, { a: 1, b: 2 }))
    })

    it("Record(String, Number)", () => {
      const schema = Schema.Record(Schema.String, Schema.UndefinedOr(Schema.Number))
      const equivalence = ToEquivalence.make(schema)
      assertTrue(equivalence({ a: 1, b: undefined }, { a: 1, b: undefined }))
      assertFalse(equivalence({ a: 1, b: undefined }, { a: 1 }))
      assertFalse(equivalence({ a: 1 }, { a: 1, b: undefined }))
    })

    it("Record(Symbol, Number)", () => {
      const a = Symbol.for("a")
      const b = Symbol.for("b")
      const c = Symbol.for("c")
      const schema = Schema.Record(Schema.Symbol, Schema.Number)
      const equivalence = ToEquivalence.make(schema)
      assertTrue(
        equivalence({ [a]: 1, [b]: 2 }, { [a]: 1, [b]: 2 })
      )
      assertFalse(
        equivalence({ [a]: 1, [b]: 2 }, { [a]: 1, [b]: 3 })
      )
      assertFalse(
        equivalence({ [a]: 1, [b]: 2 }, { [a]: 2, [b]: 2 })
      )
      assertFalse(
        equivalence({ [a]: 1, [b]: 2 }, {
          [a]: 1,
          [b]: 2,
          [c]: 3
        })
      )
      assertFalse(
        equivalence({ [a]: 1, [b]: 2, [c]: 3 }, {
          [a]: 1,
          [b]: 2
        })
      )
    })
  })

  describe("suspend", () => {
    it("recursive schema", () => {
      interface A {
        readonly a: string
        readonly as: ReadonlyArray<A>
      }
      const schema = Schema.Struct({
        a: Schema.String,
        as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema))
      })
      const equivalence = ToEquivalence.make(schema)
      assertTrue(equivalence({ a: "a", as: [] }, { a: "a", as: [] }))
      assertFalse(equivalence({ a: "a", as: [] }, { a: "b", as: [] }))
      assertFalse(equivalence({ a: "a", as: [{ a: "a", as: [] }] }, { a: "a", as: [] }))
      assertFalse(equivalence({ a: "a", as: [] }, { a: "a", as: [{ a: "a", as: [] }] }))
    })

    it("mutually recursive schemas", () => {
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

      const schema = Operation
      const equivalence = ToEquivalence.make(schema)
      assertTrue(
        equivalence({
          type: "operation",
          operator: "+",
          left: { type: "expression", value: 1 },
          right: { type: "expression", value: 2 }
        }, {
          type: "operation",
          operator: "+",
          left: { type: "expression", value: 1 },
          right: { type: "expression", value: 2 }
        })
      )
      assertFalse(
        equivalence({
          type: "operation",
          operator: "+",
          left: { type: "expression", value: 1 },
          right: { type: "expression", value: 2 }
        }, {
          type: "operation",
          operator: "+",
          left: { type: "expression", value: 1 },
          right: { type: "expression", value: 3 }
        })
      )
      assertFalse(
        equivalence({
          type: "operation",
          operator: "+",
          left: { type: "expression", value: 1 },
          right: { type: "expression", value: 2 }
        }, {
          type: "operation",
          operator: "-",
          left: { type: "expression", value: 1 },
          right: { type: "expression", value: 2 }
        })
      )
      assertFalse(
        equivalence({
          type: "operation",
          operator: "+",
          left: { type: "expression", value: 1 },
          right: { type: "expression", value: 2 }
        }, {
          type: "operation",
          operator: "+",
          left: { type: "expression", value: 2 },
          right: { type: "expression", value: 2 }
        })
      )
    })
  })

  it("Date", () => {
    const schema = Schema.Date
    const equivalence = ToEquivalence.make(schema)
    assertTrue(equivalence(new Date(0), new Date(0)))
    assertFalse(equivalence(new Date(0), new Date(1)))
  })

  it("URL", () => {
    const schema = Schema.URL
    const equivalence = ToEquivalence.make(schema)
    assertTrue(equivalence(new URL("https://example.com"), new URL("https://example.com")))
    assertFalse(equivalence(new URL("https://example.com"), new URL("https://example.org")))
  })

  it("Redacted(String)", () => {
    const schema = Schema.Redacted(Schema.String)
    const equivalence = ToEquivalence.make(schema)
    assertTrue(equivalence(Redacted.make("a"), Redacted.make("a")))
    assertFalse(equivalence(Redacted.make("a"), Redacted.make("b")))
  })

  it("Option(Number)", () => {
    const schema = Schema.Option(Schema.Number)
    const equivalence = ToEquivalence.make(schema)
    assertTrue(equivalence(Option.none(), Option.none()))
    assertTrue(equivalence(Option.some(1), Option.some(1)))
    assertFalse(equivalence(Option.none(), Option.some(1)))
    assertFalse(equivalence(Option.some(1), Option.none()))
    assertFalse(equivalence(Option.some(1), Option.some(2)))
  })

  it("Map(String, Number)", () => {
    const schema = Schema.Map(Schema.String, Schema.Number)
    const equivalence = ToEquivalence.make(schema)
    assertTrue(equivalence(new Map(), new Map()))
    assertTrue(equivalence(new Map([["a", 1]]), new Map([["a", 1]])))
    assertTrue(equivalence(new Map([["a", 1], ["b", 2]]), new Map([["a", 1], ["b", 2]])))
    assertTrue(equivalence(new Map([["b", 2], ["a", 1]]), new Map([["a", 1], ["b", 2]])))
    assertFalse(equivalence(new Map([["a", 1]]), new Map([["a", 2]])))
    assertFalse(equivalence(new Map([["a", 1]]), new Map([["a", 1], ["b", 2]])))
    assertFalse(equivalence(new Map([["a", 1], ["b", 2]]), new Map([["a", 1]])))
  })

  describe("Annotations", () => {
    it("should throw on non-declaration ASTs", () => {
      const schema = Schema.String.annotate({
        equivalence: { _tag: "Declaration", declaration: () => Equivalence.make((a, b) => a === b) }
      })
      throws(() => ToEquivalence.make(schema), new Error("Declaration annotation found on non-declaration AST"))
    })

    describe("Override annotation", () => {
      it("String", () => {
        const schema = Schema.String.pipe(
          ToEquivalence.override(() => Equivalence.make((a, b) => a.substring(0, 1) === b.substring(0, 1)))
        )
        const equivalence = ToEquivalence.make(schema)
        assertTrue(equivalence("ab", "ac"))
      })

      it("String & minLength(1)", () => {
        const schema = Schema.String.check(Check.minLength(1)).pipe(
          ToEquivalence.override(() => Equivalence.make((a, b) => a.substring(0, 1) === b.substring(0, 1)))
        )
        const equivalence = ToEquivalence.make(schema)
        assertTrue(equivalence("ab", "ac"))
      })
    })
  })
})
