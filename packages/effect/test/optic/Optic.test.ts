import { Array as Arr } from "effect/collections"
import type { Predicate } from "effect/data"
import { Option, Result } from "effect/data"
import { identity } from "effect/Function"
import { Optic } from "effect/optic"
import { AST, Check, Formatter, Issue, ToParser } from "effect/schema"
import { describe, it } from "vitest"
import { assertFailure, assertNone, assertSome, assertSuccess, deepStrictEqual } from "../utils/assert.ts"

function at<S, Key extends keyof S & (string | symbol)>(key: Key): Optic.Lens<S, S[Key]> {
  return Optic.makeLens((s) => s[key], (b, s) => {
    if (Array.isArray(s)) {
      const out: any = s.slice()
      out[key] = b
      return out
    }
    return { ...s, [key]: b }
  })
}

export function filter<S>(predicate: Predicate.Predicate<S>, message: string): Optic.Prism<S, S> {
  return Optic.makePrism(
    (s) =>
      predicate(s) ?
        Result.succeed(s) :
        Result.fail(new Error(message)),
    identity
  )
}

function check<T>(...checks: readonly [Check.Check<T>, ...Array<Check.Check<T>>]): Optic.Prism<T, T> {
  return Optic.makePrism(
    (s) => {
      const issues: Array<Issue.Issue> = []
      ToParser.runChecks(checks, s, issues, AST.unknownKeyword, { errors: "all" })
      if (Arr.isArrayNonEmpty(issues)) {
        const issue = new Issue.Composite(AST.unknownKeyword, Option.some(s), issues)
        return Result.fail(new Error(Formatter.makeDefault().format(issue)))
      }
      return Result.succeed(s)
    },
    identity
  )
}

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
      const optic = Optic.id<S>().compose(at("a"))
      assertSuccess(optic.getOptic({ a: 1 }), 1)
      assertSuccess(optic.setOptic(2, { a: 1 }), { a: 2 })
    })
  })

  describe("Prism", () => {
    it("makePrism", () => {
      const optic = Optic.id<number>().compose(check(Check.positive()))
      assertSuccess(optic.getOptic(1), 1)
      assertFailure(optic.getOptic(0), [new Error("Expected a value greater than 0, got 0"), 0])
      assertSuccess(optic.setOptic(2, undefined), 2)
      assertSuccess(optic.setOptic(0, undefined), 0)
    })
  })

  describe("Optional", () => {
    it("makeOptional", () => {
      type S = { readonly a: number }
      const optic = Optic.id<S>().compose(at("a")).compose(check(Check.positive()))
      assertSuccess(optic.getOptic({ a: 1 }), 1)
      assertFailure(optic.getOptic({ a: 0 }), [new Error("Expected a value greater than 0, got 0"), { a: 0 }])
      assertSuccess(optic.setOptic(2, { a: 1 }), { a: 2 })
      assertSuccess(optic.setOptic(0, { a: 1 }), { a: 0 })
    })
  })

  it("getOption", () => {
    type S = { readonly a: number }
    const optic = Optic.id<S>().compose(at("a")).compose(check(Check.positive()))
    const f = Optic.getOption(optic)
    assertSome(f({ a: 1 }), 1)
    assertNone(f({ a: 0 }))
  })

  it("replace", () => {
    type S = { readonly a: number }
    const optic = Optic.id<S>().compose(at("a")).compose(check(Check.positive()))
    const f = Optic.replace(optic)
    deepStrictEqual(f({ a: 1 }, 2), { a: 2 })
    deepStrictEqual(f({ a: 0 }, 2), { a: 2 })
  })

  it("replaceOption", () => {
    type S = { readonly a: number }
    const optic = Optic.id<S>().compose(at("a")).compose(check(Check.positive()))
    const f = Optic.replaceOption(optic)
    assertSome(f({ a: 1 }, 2), { a: 2 })
    assertSome(f({ a: 0 }, 2), { a: 2 })
  })

  it("modify", () => {
    type S = { readonly a: number }
    const optic = Optic.id<S>().compose(at("a")).compose(check(Check.positive()))
    const f = Optic.modify(optic, (a) => a + 1)
    deepStrictEqual(f({ a: 1 }), { a: 2 })
    deepStrictEqual(f({ a: 0 }), { a: 0 })
  })
})
