import { AST, Optic2 as Optic } from "effect/optic"
import { Check } from "effect/schema"
import { describe, it } from "vitest"
import { assertFailure, assertSuccess, assertTrue, deepStrictEqual, strictEqual } from "../utils/assert.ts"

const addOne = (n: number) => n + 1

describe("Optic", () => {
  describe("AST", () => {
    const iso = new AST.Iso<1, 2>(() => 2, () => 1)

    it("composing an identity with another ast should return the other ast", () => {
      const path = new AST.Path(["a"])
      strictEqual(AST.compose(AST.identity, path), path)
    })

    it("composing two path asts should return a path ast with the two paths concatenated", () => {
      const path1 = new AST.Path(["a"])
      const path2 = new AST.Path(["b"])
      const composed = AST.compose(AST.compose(iso, path1), path2)
      assertTrue(composed._tag === "Composition")
      strictEqual(composed.asts.length, 2)
      strictEqual(composed.asts[0], iso)
      deepStrictEqual(composed.asts[1], new AST.Path(["a", "b"]))
    })

    it("composing two checks asts should return a checks ast with the two checks concatenated", () => {
      const checks1 = new AST.Checks([Check.positive()])
      const checks2 = new AST.Checks([Check.int()])
      const composed = AST.compose(AST.compose(iso, checks1), checks2)
      assertTrue(composed._tag === "Composition")
      strictEqual(composed.asts.length, 2)
      strictEqual(composed.asts[0], iso)
      deepStrictEqual(composed.asts[1], new AST.Checks([...checks1.checks, ...checks2.checks]))
    })
  })

  describe("Iso", () => {
    it("id", () => {
      const iso = Optic.id<number>()

      strictEqual(iso.get(1), 1)
      strictEqual(iso.set(1), 1)
      strictEqual(iso.modify(addOne)(1), 2)
    })
  })

  describe("Lens", () => {
    describe("key", () => {
      describe("Struct", () => {
        it("required key", () => {
          type S = { readonly a: number }
          const optic = Optic.id<S>().key("a")

          strictEqual(optic.get({ a: 1 }), 1)
          deepStrictEqual(optic.replace(2, { a: 1 }), { a: 2 })
          deepStrictEqual(optic.modify(addOne)({ a: 1 }), { a: 2 })
        })

        it("nested required keys", () => {
          type S = {
            readonly a: {
              readonly b: number
            }
          }
          const optic = Optic.id<S>().key("a").key("b")

          strictEqual(optic.get({ a: { b: 1 } }), 1)
          deepStrictEqual(optic.replace(2, { a: { b: 1 } }), { a: { b: 2 } })
          deepStrictEqual(optic.modify(addOne)({ a: { b: 1 } }), { a: { b: 2 } })
        })
      })

      describe("Tuple", () => {
        it("required element", () => {
          type S = readonly [number]
          const optic = Optic.id<S>().key(0)

          strictEqual(optic.get([1]), 1)
          deepStrictEqual(optic.replace(2, [1]), [2])
          deepStrictEqual(optic.modify(addOne)([1]), [2])
        })

        it("nested required element", () => {
          type S = readonly [string, readonly [number]]
          const optic = Optic.id<S>().key(1).key(0)

          strictEqual(optic.get(["a", [1]]), 1)
          deepStrictEqual(optic.replace(2, ["a", [1]]), ["a", [2]])
          deepStrictEqual(optic.modify(addOne)(["a", [1]]), ["a", [2]])
        })
      })

      it("Mixed structs and tuples", () => {
        type S = {
          readonly a: readonly [number]
        }
        const optic = Optic.id<S>().key("a").key(0)

        strictEqual(optic.get({ a: [1] }), 1)
        deepStrictEqual(optic.replace(2, { a: [1] }), { a: [2] })
        deepStrictEqual(optic.modify(addOne)({ a: [1] }), { a: [2] })
      })
    })
  })

  describe("Prism", () => {
    describe("check", () => {
      it("single check", () => {
        type S = number
        const optic = Optic.id<S>().check(Check.positive())
        assertSuccess(optic.getResult(1), 1)
        assertFailure(optic.getResult(0), `Expected a value greater than 0, got 0`)
        strictEqual(optic.set(1), 1)
        strictEqual(optic.set(0), 0)
        deepStrictEqual(optic.modify(addOne)(1), 2)
        deepStrictEqual(optic.modify(addOne)(0), 0)
      })

      it("multiple checks", () => {
        type S = number
        const optic = Optic.id<S>().check(Check.int(), Check.positive())
        assertSuccess(optic.getResult(1), 1)
        assertFailure(optic.getResult(0), `Expected a value greater than 0, got 0`)
        assertFailure(optic.getResult(1.1), `Expected an integer, got 1.1`)
        assertFailure(
          optic.getResult(-1.1),
          `Expected an integer, got -1.1
Expected a value greater than 0, got -1.1`
        )
        deepStrictEqual(optic.modify(addOne)(1), 2)
        deepStrictEqual(optic.modify(addOne)(0), 0)
        deepStrictEqual(optic.modify(addOne)(1.1), 1.1)
        deepStrictEqual(optic.modify(addOne)(-1.1), -1.1)
      })
    })

    it("refine", () => {
      type B = { readonly _tag: "b"; readonly b: number }
      type S = { readonly _tag: "a"; readonly a: string } | B
      const optic = Optic.id<S>().refine(
        Check.makeRefineByGuard((s: S): s is B => s._tag === "b", { title: `"b" tag` })
      ).key("b")

      assertSuccess(optic.getResult({ _tag: "b", b: 1 }), 1)
      assertFailure(optic.getResult({ _tag: "a", a: "value" }), `Expected "b" tag, got {"_tag":"a","a":"value"}`)
      deepStrictEqual(optic.modify(addOne)({ _tag: "a", a: "value" }), { _tag: "a", a: "value" })
      deepStrictEqual(optic.modify(addOne)({ _tag: "b", b: 1 }), { _tag: "b", b: 2 })
    })

    it("tag", () => {
      type S = { readonly _tag: "a"; readonly a: string } | { readonly _tag: "b"; readonly b: number }
      const optic = Optic.id<S>().tag("b").key("b")

      assertSuccess(optic.getResult({ _tag: "b", b: 1 }), 1)
      assertFailure(optic.getResult({ _tag: "a", a: "value" }), `Expected "b" tag, got "a"`)
      deepStrictEqual(optic.modify(addOne)({ _tag: "a", a: "value" }), { _tag: "a", a: "value" })
      deepStrictEqual(optic.modify(addOne)({ _tag: "b", b: 1 }), { _tag: "b", b: 2 })
    })

    describe("at", () => {
      it("Record", () => {
        type S = { [x: string]: number }
        const optic = Optic.id<S>().at("a")

        assertSuccess(optic.getResult({ a: 1, b: 2 }), 1)
        assertFailure(optic.getResult({ b: 2 }), `Key "a" not found`)
        deepStrictEqual(optic.replace(2, { b: 2 }), { b: 2 })
        deepStrictEqual(optic.replace(2, { a: 1, b: 2 }), { a: 2, b: 2 })
      })

      it("Array", () => {
        type S = ReadonlyArray<number>
        const optic = Optic.id<S>().at(0)

        assertSuccess(optic.getResult([1, 2]), 1)
        assertFailure(optic.getResult([]), `Key 0 not found`)
        deepStrictEqual(optic.replace(2, []), [])
        deepStrictEqual(optic.replace(3, [1, 2]), [3, 2])
      })
    })
  })

  describe("Optional", () => {
    it("key & check", () => {
      type S = { readonly a: number }
      const optic = Optic.id<S>().key("a").check(Check.positive())
      assertSuccess(optic.getResult({ a: 1 }), 1)
      assertFailure(optic.getResult({ a: 0 }), `Expected a value greater than 0, got 0`)
      deepStrictEqual(optic.replace(2, { a: 1 }), { a: 2 })
      deepStrictEqual(optic.replace(2, { a: 0 }), { a: 0 })
    })
  })
})
