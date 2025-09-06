import { Option, Result } from "effect/data"
import { Optic } from "effect/optic"
import { Check } from "effect/schema"
import { describe, it } from "vitest"
import { assertFailure, assertNone, assertSome, assertSuccess, deepStrictEqual } from "../utils/assert.ts"

describe("Optic", () => {
  describe("Iso", () => {
    it("id", () => {
      const iso = Optic.id<string>()

      assertSuccess(iso.getOptic("a"), "a")
      assertSuccess(iso.setOptic("b", "a"), "b")
    })
  })

  describe("Lens", () => {
    it("makeLens", () => {
      type S = { readonly a: number }
      const optic = Optic.id<S>()
        .at("a")

      assertSuccess(optic.getOptic({ a: 1 }), 1)
      assertSuccess(optic.setOptic(2, { a: 1 }), { a: 2 })
    })
  })

  describe("Prism", () => {
    it("makePrism", () => {
      const optic = Optic.id<number>()
        .check(Check.positive())

      assertSuccess(optic.getOptic(1), 1)
      assertFailure(optic.getOptic(0), [new Error("Expected a value greater than 0, got 0"), 0])
      assertSuccess(optic.setOptic(2, undefined), 2)
      assertSuccess(optic.setOptic(0, undefined), 0)
    })
  })

  describe("Optional", () => {
    it("makeOptional", () => {
      type S = { readonly a: number }
      const optic = Optic.id<S>()
        .at("a")
        .check(Check.positive())

      assertSuccess(optic.getOptic({ a: 1 }), 1)
      assertFailure(optic.getOptic({ a: 0 }), [new Error("Expected a value greater than 0, got 0"), { a: 0 }])
      assertSuccess(optic.setOptic(2, { a: 1 }), { a: 2 })
      assertSuccess(optic.setOptic(0, { a: 1 }), { a: 0 })
    })
  })

  it("getOption", () => {
    type S = { readonly a: number }
    const optic = Optic.id<S>()
      .at("a")
      .check(Check.positive())
    const f = Optic.getOption(optic)

    assertSome(f({ a: 1 }), 1)
    assertNone(f({ a: 0 }))
  })

  it("replace", () => {
    type S = { readonly a: number }
    const optic = Optic.makeOptional<S, number>(
      (s) => Result.succeed(s.a),
      (a, s) => a > 0 ? Result.succeed({ ...s, a }) : Result.fail(new Error("Value must be positive"))
    )
    const f = Optic.replace(optic)

    deepStrictEqual(f({ a: 1 }, 2), { a: 2 })
    deepStrictEqual(f({ a: 1 }, 0), { a: 1 }) // (fallback behavior)
  })

  it("replaceOption", () => {
    type S = { readonly a: number }
    const optic = Optic.makeOptional<S, number>(
      (s) => Result.succeed(s.a),
      (a, s) => a > 0 ? Result.succeed({ ...s, a }) : Result.fail(new Error("Value must be positive"))
    )
    const f = Optic.replaceOption(optic)

    assertSome(f({ a: 1 }, 2), { a: 2 })
    assertNone(f({ a: 1 }, 0))
  })

  it("modify", () => {
    type S = { readonly a: number }
    const optic = Optic.makeOptional<S, number>(
      (s) => s.a === 1 ? Result.fail(new Error("Value must be different from 1")) : Result.succeed(s.a),
      (a, s) => a > 0 ? Result.succeed({ ...s, a }) : Result.fail(new Error("Value must be positive"))
    )
    const f = Optic.modify(optic, (a) => a + 1)

    deepStrictEqual(f({ a: 2 }), { a: 3 })
    deepStrictEqual(f({ a: 1 }), { a: 1 }) // getOptic fails
    deepStrictEqual(f({ a: -1 }), { a: -1 }) // setOptic fails
  })

  it("refine", () => {
    const isSome = <A>() =>
      Check.makeRefine<Option.Some<A>, Option.Option<A>>(Option.isSome, { message: "Expected a value to be some" })
    const optic = Optic.id<Option.Option<number>>()
      .refine(isSome<number>())
    assertSuccess(optic.getOptic(Option.some(1)), Option.some(1))
    assertFailure(optic.getOptic(Option.none()), [new Error("Expected a value to be some"), Option.none()])
  })
})
