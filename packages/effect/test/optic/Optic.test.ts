import { Option } from "effect/data"
import { Optic } from "effect/optic"
import { Check } from "effect/schema"
import { describe, it } from "vitest"
import {
  assertFailure,
  assertNone,
  assertSome,
  assertSuccess,
  deepStrictEqual,
  strictEqual,
  throws
} from "../utils/assert.ts"

describe("Optic", () => {
  describe("Iso", () => {
    it("id", () => {
      const iso = Optic.id<string>()

      strictEqual(iso.get("a"), "a")
      strictEqual(iso.set("b"), "b")
    })
  })

  describe("Lens", () => {
    it("get", () => {
      type S = { readonly a: number }
      const optic = Optic.id<S>().key("a")

      strictEqual(optic.get({ a: 1 }), 1)
    })

    it("replace", () => {
      type S = { readonly a: number }
      const optic = Optic.id<S>().key("a")

      deepStrictEqual(optic.replace(2, { a: 1 }), { a: 2 })
    })

    describe("key", () => {
      describe("Struct", () => {
        it("required key", () => {
          type S = { readonly a: number }
          const optic = Optic.id<S>().key("a")

          strictEqual(optic.get({ a: 1 }), 1)
          deepStrictEqual(optic.replace(2, { a: 1 }), { a: 2 })
        })

        it("nested key", () => {
          type S = { readonly a: { readonly b: number } }
          const optic = Optic.id<S>().key("a").key("b")

          strictEqual(optic.get({ a: { b: 1 } }), 1)
          deepStrictEqual(optic.replace(2, { a: { b: 1 } }), { a: { b: 2 } })
        })
      })

      it("Tuple", () => {
        type S = [number]
        const optic = Optic.id<S>().key(0)

        strictEqual(optic.get([1]), 1)
        deepStrictEqual(optic.replace(2, [1]), [2])
      })
    })

    describe("optionalKey", () => {
      it("Struct", () => {
        type S = { readonly a?: number }
        const optic = Optic.id<S>().optionalKey("a")

        strictEqual(optic.get({ a: 1 }), 1)
        strictEqual(optic.get({}), undefined)
        deepStrictEqual(optic.replace(2, { a: 1 }), { a: 2 })
        deepStrictEqual(optic.replace(2, {}), { a: 2 })
        deepStrictEqual(optic.replace(undefined, { a: 1 }), {})
      })

      it("Tuple", () => {
        type S = readonly [number?, number?]
        const optic = Optic.id<S>().optionalKey(0)

        strictEqual(optic.get([1]), 1)
        strictEqual(optic.get([]), undefined)
        deepStrictEqual(optic.replace(2, [1]), [2])
        deepStrictEqual(optic.replace(2, []), [2])
        deepStrictEqual(optic.replace(undefined, [1]), [])
        throws(() => optic.replace(undefined, [1, 2]), `Cannot remove element at index 0`)
      })
    })

    describe("at", () => {
      it("Record", () => {
        type S = { [x: string]: number }
        const optic = Optic.id<S>().at("a")

        assertSuccess(optic.getResult({ a: 1, b: 2 }), 1)
        assertFailure(optic.getResult({ b: 2 }), `Key "a" not found`)
        assertFailure(optic.replaceResult(2, { b: 2 }), `Key "a" not found`)
        assertSuccess(optic.replaceResult(2, { a: 1, b: 2 }), { a: 2, b: 2 })
      })

      it("Array", () => {
        type S = ReadonlyArray<number>
        const optic = Optic.id<S>().at(0)

        assertSuccess(optic.getResult([1, 2]), 1)
        assertFailure(optic.getResult([]), `Key 0 not found`)
        assertFailure(optic.replaceResult(2, []), `Key 0 not found`)
        assertSuccess(optic.replaceResult(3, [1, 2]), [3, 2])
      })
    })
  })

  describe("Prism", () => {
    it("getOption", () => {
      const optic = Optic.id<number>().check(Check.positive())

      assertSome(optic.getOption(2), 2)
      assertNone(optic.getOption(0))
    })

    it("set", () => {
      const optic = Optic.id<number>().check(Check.positive())

      strictEqual(optic.set(2), 2)
      strictEqual(optic.set(0), 0)
    })

    it("check", () => {
      const optic = Optic.id<number>().check(Check.positive())

      assertSuccess(optic.getResult(1), 1)
      assertFailure(optic.getResult(0), `Expected a value greater than 0, got 0`)
      assertSuccess(optic.replaceResult(2, 2), 2)
      assertSuccess(optic.replaceResult(0, 0), 0)
    })
  })

  describe("Optional", () => {
    it("getOption", () => {
      type S = { readonly a: number }
      const optic = Optic.id<S>().key("a").check(Check.positive())

      assertSome(optic.getOption({ a: 1 }), 1)
      assertNone(optic.getOption({ a: 0 }))
    })

    it("replace", () => {
      type S = { readonly a: number }
      const optic = Optic.id<S>().key("a").check(Check.positive())

      deepStrictEqual(optic.replace(2, { a: 1 }), { a: 2 })
      deepStrictEqual(optic.replace(0, { a: 1 }), { a: 0 })
    })

    it("key & check", () => {
      type S = { readonly a: number }
      const optic = Optic.id<S>().key("a").check(Check.positive())

      assertSuccess(optic.getResult({ a: 1 }), 1)
      assertFailure(optic.getResult({ a: 0 }), `Expected a value greater than 0, got 0`)
      assertSuccess(optic.replaceResult(2, { a: 1 }), { a: 2 })
      assertSuccess(optic.replaceResult(0, { a: 1 }), { a: 0 })
    })
  })

  it("modify", () => {
    type S = { readonly a: number }
    const optic = Optic.id<S>().key("a").check(Check.positive())
    const f = optic.modify((a) => a + 1)

    deepStrictEqual(f({ a: 1 }), { a: 2 })
    deepStrictEqual(f({ a: 0 }), { a: 0 }) // getResult fails
  })

  it("refine", () => {
    const optic = Optic.id<Option.Option<number>>().refine(Check.some())

    assertSuccess(optic.getResult(Option.some(1)), Option.some(1))
    assertFailure(optic.getResult(Option.none()), `Expected a Some value, got none()`)
  })

  it("tag", () => {
    type S = { readonly _tag: "a"; readonly a: string } | { readonly _tag: "b"; readonly b: number }
    const optic = Optic.id<S>().tag("a").key("a")

    assertSuccess(optic.getResult({ _tag: "a", a: "value" }), "value")
    assertFailure(optic.getResult({ _tag: "b", b: 1 }), `Expected "a" tag, got "b"`)
  })

  it("some", () => {
    const optic = Optic.id<Option.Option<number>>().compose(Optic.some())

    assertSuccess(optic.getResult(Option.some(1)), 1)
    assertFailure(optic.getResult(Option.none()), `Expected a Some value, got none()`)

    assertSuccess(optic.replaceResult(2, Option.some(1)), Option.some(2))
    assertSuccess(optic.replaceResult(2, Option.none()), Option.some(2))
  })

  it("charAt", () => {
    const optic = Optic.id<string>().compose(Optic.charAt(0))

    assertSuccess(optic.getResult("abc"), "a")
    assertFailure(optic.getResult(""), `Missing character at index 0`)
    assertSuccess(optic.replaceResult("d", "abc"), "dbc")
    assertFailure(optic.replaceResult("", "abc"), `Expected a single character, got ""`)
    assertFailure(optic.replaceResult("de", "abc"), `Expected a single character, got "de"`)
    assertFailure(optic.replaceResult("d", ""), `Missing character at index 0`)
  })
})
