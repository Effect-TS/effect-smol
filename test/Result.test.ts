import { Cause, Chunk, Effect, Equal, flow, Number as Num, Option, pipe, Result, String as Str } from "effect"
import { inspect } from "node:util"
import { describe, it } from "vitest"
import {
  assertErr,
  assertFailure,
  assertFalse,
  assertNone,
  assertOk,
  assertSome,
  assertSuccess,
  assertTrue,
  deepStrictEqual,
  strictEqual,
  throws
} from "./utils/assert.js"

describe("Result", () => {
  describe("Constructors", () => {
    it("void", () => {
      deepStrictEqual(Result.void, Result.ok(undefined))
    })

    it("try", () => {
      deepStrictEqual(Result.try(() => 1), Result.ok(1))
      deepStrictEqual(
        Result.try(() => {
          throw "b"
        }),
        Result.err("b")
      )
      deepStrictEqual(Result.try({ try: () => 1, catch: (e) => new Error(String(e)) }), Result.ok(1))
      deepStrictEqual(
        Result.try({
          try: () => {
            throw "b"
          },
          catch: (e) => new Error(String(e))
        }),
        Result.err(new Error("b"))
      )
    })

    it("fromNullable", () => {
      deepStrictEqual(Result.fromNullable(null, () => "fallback"), Result.err("fallback"))
      deepStrictEqual(Result.fromNullable(undefined, () => "fallback"), Result.err("fallback"))
      deepStrictEqual(Result.fromNullable(1, () => "fallback"), Result.ok(1))
    })

    it("fromOption", () => {
      deepStrictEqual(Result.fromOption(Option.none(), () => "none"), Result.err("none"))
      deepStrictEqual(Result.fromOption(Option.some(1), () => "none"), Result.ok(1))
    })
  })

  describe("Methods", () => {
    it("toString", () => {
      strictEqual(
        String(Result.ok(1)),
        `{
  "_id": "Result",
  "_tag": "Ok",
  "ok": 1
}`
      )
      strictEqual(
        String(Result.err("e")),
        `{
  "_id": "Result",
  "_tag": "Err",
  "err": "e"
}`
      )
      strictEqual(
        String(Result.ok(Chunk.make(1, 2, 3))),
        `{
  "_id": "Result",
  "_tag": "Ok",
  "ok": {
    "_id": "Chunk",
    "values": [
      1,
      2,
      3
    ]
  }
}`
      )
      strictEqual(
        String(Result.err(Chunk.make(1, 2, 3))),
        `{
  "_id": "Result",
  "_tag": "Err",
  "err": {
    "_id": "Chunk",
    "values": [
      1,
      2,
      3
    ]
  }
}`
      )
    })

    it("toJSON", () => {
      deepStrictEqual(Result.ok(1).toJSON(), { _id: "Result", _tag: "Ok", ok: 1 })
      deepStrictEqual(Result.err("e").toJSON(), { _id: "Result", _tag: "Err", err: "e" })
    })

    it("inspect", () => {
      deepStrictEqual(inspect(Result.ok(1)), inspect({ _id: "Result", _tag: "Ok", ok: 1 }))
      deepStrictEqual(inspect(Result.err("e")), inspect({ _id: "Result", _tag: "Err", err: "e" }))
    })

    it("Equal trait", () => {
      assertTrue(Equal.equals(Result.ok(1), Result.ok(1)))
      assertTrue(Equal.equals(Result.err("e"), Result.err("e")))
      assertFalse(Equal.equals(Result.ok(1), Result.err("e")))
      assertFalse(Equal.equals(Result.err("e"), Result.ok(1)))
    })

    it("asEffect", () => {
      assertSuccess(Effect.runSyncExit(Result.ok(1).asEffect()), 1)
      assertFailure(Effect.runSyncExit(Result.err("e").asEffect()), Cause.fail("e"))
    })

    it("pipe()", () => {
      assertOk(Result.ok(1).pipe(Result.map((n) => n + 1)), 2)
    })
  })

  describe("Type Guards", () => {
    it("isResult", () => {
      assertTrue(pipe(Result.ok(1), Result.isResult))
      assertTrue(pipe(Result.err("e"), Result.isResult))
      assertFalse(pipe(Option.some(1), Result.isResult))
    })

    it("isErr", () => {
      assertFalse(Result.isErr(Result.ok(1)))
      assertTrue(Result.isErr(Result.err(1)))
    })

    it("isOk", () => {
      assertTrue(Result.isOk(Result.ok(1)))
      assertFalse(Result.isOk(Result.err(1)))
    })
  })

  describe("Getters", () => {
    it("getOk", () => {
      assertSome(pipe(Result.ok(1), Result.getOk), 1)
      assertNone(pipe(Result.err("a"), Result.getOk))
    })

    it("getErr", () => {
      assertNone(pipe(Result.ok(1), Result.getErr))
      assertSome(pipe(Result.err("e"), Result.getErr), "e")
    })

    it("getOrElse", () => {
      strictEqual(Result.getOrElse(Result.ok(1), (error) => error + "!"), 1)
      strictEqual(Result.getOrElse(Result.err("not a number"), (error) => error + "!"), "not a number!")
    })

    it("getOrNull", () => {
      strictEqual(Result.getOrNull(Result.ok(1)), 1)
      strictEqual(Result.getOrNull(Result.err("a")), null)
    })

    it("getOrUndefined", () => {
      strictEqual(Result.getOrUndefined(Result.ok(1)), 1)
      strictEqual(Result.getOrUndefined(Result.err("a")), undefined)
    })

    it("getOrThrowWith", () => {
      strictEqual(pipe(Result.ok(1), Result.getOrThrowWith((e) => new Error(`Unexpected Left: ${e}`))), 1)
      throws(() => pipe(Result.err("e"), Result.getOrThrowWith((e) => new Error(`Unexpected Left: ${e}`))))
    })

    it("getOrThrow", () => {
      strictEqual(pipe(Result.ok(1), Result.getOrThrow), 1)
      throws(() => pipe(Result.err(new Error("e")), Result.getOrThrow), new Error("e"))
    })

    it("merge", () => {
      deepStrictEqual(Result.merge(Result.ok(1)), 1)
      deepStrictEqual(Result.merge(Result.err("a")), "a")
    })
  })

  describe("Mapping", () => {
    it("map", () => {
      const f = Result.map(Str.length)
      assertOk(pipe(Result.ok("abc"), f), 3)
      assertErr(pipe(Result.err("s"), f), "s")
    })

    it("mapBoth", () => {
      const f = Result.mapBoth({
        onErr: Str.length,
        onOk: (n: number) => n > 2
      })
      assertOk(pipe(Result.ok(1), f), false)
      assertErr(pipe(Result.err("a"), f), 1)
    })

    it("mapErr", () => {
      const f = Result.mapErr((n: number) => n * 2)
      assertOk(pipe(Result.ok("a"), f), "a")
      assertErr(pipe(Result.err(1), f), 2)
    })
  })

  describe("Pattern Matching", () => {
    it("match", () => {
      const onErr = (s: string) => `err${s.length}`
      const onOk = (s: string) => `ok${s.length}`
      const match = Result.match({ onErr, onOk })
      strictEqual(match(Result.err("abc")), "err3")
      strictEqual(match(Result.ok("abc")), "ok3")
    })
  })

  describe("Utils", () => {
    it("flip", () => {
      assertErr(Result.flip(Result.ok("a")), "a")
      assertOk(Result.flip(Result.err("b")), "b")
    })

    it("liftPredicate", () => {
      const isPositivePredicate = (n: number) => n > 0
      const onPositivePredicateError = (n: number) => `${n} is not positive`
      const isNumberRefinement = (n: string | number): n is number => typeof n === "number"
      const onNumberRefinementError = (n: string | number) => `${n} is not a number`

      assertOk(
        pipe(1, Result.liftPredicate(isPositivePredicate, onPositivePredicateError)),
        1
      )
      assertErr(
        pipe(-1, Result.liftPredicate(isPositivePredicate, onPositivePredicateError)),
        "-1 is not positive"
      )
      assertOk(
        pipe(1, Result.liftPredicate(isNumberRefinement, onNumberRefinementError)),
        1
      )
      assertErr(
        pipe("string", Result.liftPredicate(isNumberRefinement, onNumberRefinementError)),
        "string is not a number"
      )

      assertOk(
        Result.liftPredicate(1, isPositivePredicate, onPositivePredicateError),
        1
      )
      assertErr(
        Result.liftPredicate(-1, isPositivePredicate, onPositivePredicateError),
        "-1 is not positive"
      )
      assertOk(
        Result.liftPredicate(1, isNumberRefinement, onNumberRefinementError),
        1
      )
      assertErr(
        Result.liftPredicate("string", isNumberRefinement, onNumberRefinementError),
        "string is not a number"
      )
    })
  })

  describe("Filtering", () => {
    it("filterOrErr", () => {
      deepStrictEqual(Result.filterOrErr(Result.ok(1), (n) => n > 0, () => "a"), Result.ok(1))
      deepStrictEqual(Result.filterOrErr(Result.ok(1), (n) => n > 1, () => "a"), Result.err("a"))
      deepStrictEqual(Result.filterOrErr(Result.err(1), (n) => n > 0, () => "a"), Result.err(1))

      deepStrictEqual(Result.ok(1).pipe(Result.filterOrErr((n) => n > 0, () => "a")), Result.ok(1))
      deepStrictEqual(Result.ok(1).pipe(Result.filterOrErr((n) => n > 1, () => "a")), Result.err("a"))
      deepStrictEqual(Result.err(1).pipe(Result.filterOrErr((n) => n > 0, () => "a")), Result.err(1))
    })
  })

  describe("Equivalence", () => {
    it("getEquivalence", () => {
      const isEquivalent = Result.getEquivalence({ ok: Num.Equivalence, err: Str.Equivalence })
      deepStrictEqual(isEquivalent(Result.ok(1), Result.ok(1)), true)
      deepStrictEqual(isEquivalent(Result.ok(1), Result.ok(2)), false)
      deepStrictEqual(isEquivalent(Result.ok(1), Result.err("foo")), false)
      deepStrictEqual(isEquivalent(Result.err("foo"), Result.err("foo")), true)
      deepStrictEqual(isEquivalent(Result.err("foo"), Result.err("bar")), false)
      deepStrictEqual(isEquivalent(Result.err("foo"), Result.ok(1)), false)
    })
  })

  describe("Sequencing", () => {
    it("flatMap", () => {
      const f = Result.flatMap(flow(Str.length, Result.ok))
      assertOk(pipe(Result.ok("abc"), f), 3)
      assertErr(pipe(Result.err("maError"), f), "maError")
    })

    it("andThen", () => {
      assertOk(pipe(Result.ok(1), Result.andThen(() => Result.ok(2))), 2)
      assertOk(pipe(Result.ok(1), Result.andThen(Result.ok(2))), 2)
      assertOk(pipe(Result.ok(1), Result.andThen(2)), 2)
      assertOk(pipe(Result.ok(1), Result.andThen(() => 2)), 2)
      assertOk(pipe(Result.ok(1), Result.andThen((a) => a)), 1)
      assertOk(Result.andThen(Result.ok(1), () => Result.ok(2)), 2)
      assertOk(Result.andThen(Result.ok(1), Result.ok(2)), 2)
      assertOk(Result.andThen(Result.ok(1), () => 2), 2)
      assertOk(Result.andThen(Result.ok(1), 2), 2)
      assertOk(Result.andThen(Result.ok(1), (a) => a), 1)
    })

    it("all", () => {
      // tuples and arrays
      assertOk(Result.all([]), [])
      assertOk(Result.all([Result.ok(1)]), [1])
      assertOk(Result.all([Result.ok(1), Result.ok(true)]), [1, true])
      assertErr(Result.all([Result.ok(1), Result.err("e")]), "e")
      // structs and records
      assertOk(Result.all({}), {})
      assertOk(Result.all({ a: Result.ok(1) }), { a: 1 })
      assertOk(Result.all({ a: Result.ok(1), b: Result.ok(true) }), { a: 1, b: true })
      assertErr(Result.all({ a: Result.ok(1), b: Result.err("e") }), "e")
    })
  })

  describe("Error Handling", () => {
    it("orElse", () => {
      assertOk(pipe(Result.ok(1), Result.orElse(() => Result.ok(2))), 1)
      assertOk(pipe(Result.ok(1), Result.orElse(() => Result.err("b"))), 1)
      assertOk(pipe(Result.err("a"), Result.orElse(() => Result.ok(2))), 2)
      assertErr(pipe(Result.err("a"), Result.orElse(() => Result.err("b"))), "b")
    })
  })

  describe("Do Notation", () => {
    it("Do", () => {
      assertOk(Result.Do, {})
    })

    it("bindTo", () => {
      assertOk(pipe(Result.ok(1), Result.bindTo("a")), { a: 1 })
      assertErr(pipe(Result.err("left"), Result.bindTo("a")), "left")
    })

    it("bind", () => {
      assertOk(pipe(Result.ok(1), Result.bindTo("a"), Result.bind("b", ({ a }) => Result.ok(a + 1))), {
        a: 1,
        b: 2
      })
      assertErr(
        pipe(Result.ok(1), Result.bindTo("a"), Result.bind("b", () => Result.err("left"))),
        "left"
      )
      assertErr(
        pipe(Result.err("left"), Result.bindTo("a"), Result.bind("b", () => Result.ok(2))),
        "left"
      )
    })

    it("let", () => {
      assertOk(pipe(Result.ok(1), Result.bindTo("a"), Result.let("b", ({ a }) => a + 1)), { a: 1, b: 2 })
      assertErr(
        pipe(Result.err("left"), Result.bindTo("a"), Result.let("b", () => 2)),
        "left"
      )
    })
  })

  describe("Generators", () => {
    it("gen", () => {
      const a = Result.gen(function*() {
        const x = yield* Result.ok(1)
        const y = yield* Result.ok(2)
        return x + y
      })
      const b = Result.gen(function*() {
        return 10
      })
      const c = Result.gen(function*() {
        yield* Result.ok(1)
        yield* Result.ok(2)
      })
      const d = Result.gen(function*() {
        yield* Result.ok(1)
        return yield* Result.ok(2)
      })
      const e = Result.gen(function*() {
        yield* Result.ok(1)
        yield* Result.err("err")
        return yield* Result.ok(2)
      })
      const f = Result.gen(function*() {
        yield* Result.err("err")
      })
      const g = Result.gen({ context: "testContext" as const }, function*() {
        return yield* Result.ok(this.context)
      })

      assertOk(a, 3)
      assertOk(b, 10)
      assertOk(c, undefined)
      assertOk(d, 2)
      assertErr(e, "err")
      assertErr(f, "err")
      assertOk(g, "testContext")
    })
  })
})
