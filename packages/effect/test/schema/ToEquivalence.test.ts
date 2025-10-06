import { DateTime, Duration } from "effect"
import { Equivalence, Option, Redacted, Result } from "effect/data"
import { Check, Schema, ToEquivalence } from "effect/schema"
import { describe, it } from "vitest"
import { assertFalse, assertTrue } from "../utils/assert.ts"

const Modulo2 = Schema.Number.annotate({
  equivalence: {
    _tag: "Override",
    override: (): Equivalence.Equivalence<number> => Equivalence.make((a, b) => a % 2 === b % 2)
  }
})

const Modulo3 = Schema.Number.annotate({
  equivalence: {
    _tag: "Override",
    override: (): Equivalence.Equivalence<number> => Equivalence.make((a, b) => a % 3 === b % 3)
  }
})

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
      assertTrue(equivalence({}, {})) // Now supports structural equality
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

  it("Option(Modulo2)", () => {
    const schema = Schema.Option(Modulo2)
    const equivalence = ToEquivalence.make(schema)

    assertTrue(equivalence(Option.none(), Option.none()))
    assertTrue(equivalence(Option.some(0), Option.some(2)))
    assertTrue(equivalence(Option.some(1), Option.some(3)))

    assertFalse(equivalence(Option.none(), Option.some(0)))
    assertFalse(equivalence(Option.some(0), Option.none()))
    assertFalse(equivalence(Option.some(0), Option.some(1)))
  })

  it("Result(Modulo2, Modulo3)", () => {
    const schema = Schema.Result(Modulo2, Modulo3)
    const equivalence = ToEquivalence.make(schema)

    assertTrue(equivalence(Result.succeed(0), Result.succeed(2)))
    assertTrue(equivalence(Result.succeed(1), Result.succeed(3)))
    assertTrue(equivalence(Result.fail(0), Result.fail(3)))
    assertTrue(equivalence(Result.fail(1), Result.fail(4)))
    assertTrue(equivalence(Result.fail(2), Result.fail(5)))

    assertFalse(equivalence(Result.succeed(0), Result.fail(2)))
    assertFalse(equivalence(Result.fail(0), Result.succeed(3)))
  })

  it("ReadonlySet(Modulo2)", () => {
    const schema = Schema.ReadonlySet(Modulo2)
    const equivalence = ToEquivalence.make(schema)

    assertTrue(equivalence(new Set(), new Set()))
    assertTrue(equivalence(new Set([0]), new Set([0])))
    assertTrue(equivalence(new Set([0]), new Set([2])))
    assertTrue(equivalence(new Set([0, 1]), new Set([1, 0])))
    assertTrue(equivalence(new Set([0, 1]), new Set([2, 3])))

    assertFalse(equivalence(new Set([0]), new Set([1])))
    assertFalse(equivalence(new Set([0, 1]), new Set([2, 2])))
  })

  it("ReadonlyMap(Modulo2, Modulo3)", () => {
    const schema = Schema.ReadonlyMap(Modulo2, Modulo3)
    const equivalence = ToEquivalence.make(schema)

    assertTrue(equivalence(new Map(), new Map()))
    assertTrue(equivalence(new Map([[0, 1]]), new Map([[0, 1]])))
    assertTrue(equivalence(new Map([[0, 1]]), new Map([[2, 4]])))
    assertTrue(equivalence(new Map([[0, 1], [1, 2]]), new Map([[0, 1], [1, 2]])))
    assertTrue(equivalence(new Map([[0, 1], [1, 2]]), new Map([[1, 2], [0, 1]])))

    assertFalse(equivalence(new Map([[0, 1]]), new Map([[1, 1]])))
    assertFalse(equivalence(new Map([[0, 1]]), new Map([[0, 2]])))
    assertFalse(equivalence(new Map([[0, 1], [1, 2]]), new Map([[0, 1], [1, 3]])))
    assertFalse(equivalence(new Map([[0, 1], [1, 2]]), new Map([[0, 1], [2, 2]])))
  })

  it("Duration", () => {
    const schema = Schema.Duration
    const equivalence = ToEquivalence.make(schema)
    assertTrue(equivalence(Duration.millis(1), Duration.millis(1)))
    assertFalse(equivalence(Duration.millis(1), Duration.millis(2)))
    assertTrue(equivalence(Duration.nanos(1n), Duration.nanos(1n)))
    assertFalse(equivalence(Duration.nanos(1n), Duration.nanos(2n)))
    assertTrue(equivalence(Duration.infinity, Duration.infinity))
    assertFalse(equivalence(Duration.infinity, Duration.millis(1)))
  })

  it("DateTimeUtc", () => {
    const schema = Schema.DateTimeUtc
    const equivalence = ToEquivalence.make(schema)
    assertTrue(
      equivalence(DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"), DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"))
    )
    assertFalse(
      equivalence(DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"), DateTime.makeUnsafe("2021-01-01T00:00:00.001Z"))
    )
  })

  describe("Annotations", () => {
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
