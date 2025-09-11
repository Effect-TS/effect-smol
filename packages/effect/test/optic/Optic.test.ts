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

      assertSuccess(iso.getOptic("a"), "a")
      assertSuccess(iso.setOptic("b", "b"), "b")
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
      it("Struct", () => {
        type S = { readonly a: number }
        const optic = Optic.id<S>().key("a")

        assertSuccess(optic.getOptic({ a: 1 }), 1)
        assertSuccess(optic.setOptic(2, { a: 1 }), { a: 2 })
      })

      it("Tuple", () => {
        type S = [number]
        const optic = Optic.id<S>().key(0)

        assertSuccess(optic.getOptic([1]), 1)
        assertSuccess(optic.setOptic(2, [1]), [2])
      })

      it("should throw if the key is not found", () => {
        type S = { a: string; [x: string]: number | string }
        const optic = Optic.id<S>().key("b")

        throws(() => optic.getOptic({ a: "a" }), `Key "b" not found`)
        throws(() => optic.setOptic(2, { a: "a" }), `Key "b" not found`)
      })
    })

    describe("optionalKey", () => {
      it("Struct", () => {
        type S = { readonly a?: number }
        const optic = Optic.id<S>().optionalKey("a")

        assertSuccess(optic.getOptic({ a: 1 }), 1)
        assertSuccess(optic.getOptic({}), undefined)
        assertSuccess(optic.setOptic(2, { a: 1 }), { a: 2 })
        assertSuccess(optic.setOptic(2, {}), { a: 2 })
        assertSuccess(optic.setOptic(undefined, { a: 1 }), {})
      })

      it("Tuple", () => {
        type S = readonly [number?, number?]
        const optic = Optic.id<S>().optionalKey(0)

        assertSuccess(optic.getOptic([1]), 1)
        assertSuccess(optic.getOptic([]), undefined)
        assertSuccess(optic.setOptic(2, [1]), [2])
        assertSuccess(optic.setOptic(2, []), [2])
        assertSuccess(optic.setOptic(undefined, [1]), [])
        throws(() => optic.setOptic(undefined, [1, 2]), `Cannot remove element at index 0`)
      })
    })

    describe("at", () => {
      it("Record", () => {
        type S = { [x: string]: number }
        const optic = Optic.id<S>().at("a")

        assertSuccess(optic.getOptic({ a: 1, b: 2 }), 1)
        assertFailure(optic.getOptic({ b: 2 }), `Key "a" not found`)
        assertFailure(optic.setOptic(2, { b: 2 }), `Key "a" not found`)
        assertSuccess(optic.setOptic(2, { a: 1, b: 2 }), { a: 2, b: 2 })
      })

      it("Array", () => {
        type S = ReadonlyArray<number>
        const optic = Optic.id<S>().at(0)

        assertSuccess(optic.getOptic([1, 2]), 1)
        assertFailure(optic.getOptic([]), `Key 0 not found`)
        assertFailure(optic.setOptic(2, []), `Key 0 not found`)
        assertSuccess(optic.setOptic(3, [1, 2]), [3, 2])
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

      assertSuccess(optic.getOptic(1), 1)
      assertFailure(optic.getOptic(0), `Expected a value greater than 0, got 0`)
      assertSuccess(optic.setOptic(2, 2), 2)
      assertSuccess(optic.setOptic(0, 0), 0)
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

      assertSuccess(optic.getOptic({ a: 1 }), 1)
      assertFailure(optic.getOptic({ a: 0 }), `Expected a value greater than 0, got 0`)
      assertSuccess(optic.setOptic(2, { a: 1 }), { a: 2 })
      assertSuccess(optic.setOptic(0, { a: 1 }), { a: 0 })
    })
  })

  it("modify", () => {
    type S = { readonly a: number }
    const optic = Optic.id<S>().key("a").check(Check.positive())
    const f = optic.modify((a) => a + 1)

    deepStrictEqual(f({ a: 1 }), { a: 2 })
    deepStrictEqual(f({ a: 0 }), { a: 0 }) // getOptic fails
  })

  it("refine", () => {
    const optic = Optic.id<Option.Option<number>>().refine(Check.some())

    assertSuccess(optic.getOptic(Option.some(1)), Option.some(1))
    assertFailure(optic.getOptic(Option.none()), `Expected a Some value, got none()`)
  })

  it("tag", () => {
    type S = { readonly _tag: "a"; readonly a: string } | { readonly _tag: "b"; readonly b: number }
    const optic = Optic.id<S>().tag("a").key("a")

    assertSuccess(optic.getOptic({ _tag: "a", a: "value" }), "value")
    assertFailure(optic.getOptic({ _tag: "b", b: 1 }), `Expected "a" tag, got "b"`)
  })

  it("some", () => {
    const optic = Optic.id<Option.Option<number>>().compose(Optic.some())

    assertSuccess(optic.getOptic(Option.some(1)), 1)
    assertFailure(optic.getOptic(Option.none()), `Expected a Some value, got none()`)

    assertSuccess(optic.setOptic(2, Option.some(1)), Option.some(2))
    assertSuccess(optic.setOptic(2, Option.none()), Option.some(2))
  })

  it("charAt", () => {
    const optic = Optic.id<string>().compose(Optic.charAt(0))

    assertSuccess(optic.getOptic("abc"), "a")
    assertFailure(optic.getOptic(""), `Missing character at index 0`)
    assertSuccess(optic.setOptic("d", "abc"), "dbc")
    assertFailure(optic.setOptic("", "abc"), `Expected a single character, got ""`)
    assertFailure(optic.setOptic("de", "abc"), `Expected a single character, got "de"`)
    assertFailure(optic.setOptic("d", ""), `Missing character at index 0`)
  })
})
