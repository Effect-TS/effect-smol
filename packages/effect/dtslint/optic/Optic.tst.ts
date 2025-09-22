import type { Option, Result } from "effect/data"
import { Optic } from "effect/optic"
import { Check } from "effect/schema"
import { describe, expect, it } from "tstyche"

describe("Optic", () => {
  describe("key", () => {
    it("optional key (with undefined)", () => {
      type S = { readonly a?: number | undefined }
      const optic = Optic.id<S>().key("a")

      expect(optic).type.toBe<Optic.Lens<S, number | undefined>>()
    })
  })

  describe("optionalKey", () => {
    describe("Struct", () => {
      it("exact optional key (without undefined)", () => {
        type S = { readonly a?: number }
        const optic = Optic.id<S>().optionalKey("a")

        expect(optic).type.toBe<Optic.Lens<S, number | undefined>>()
      })
    })

    it("Record", () => {
      type S = { [x: string]: number }
      const optic = Optic.id<S>().optionalKey("a")

      expect(optic).type.toBe<Optic.Lens<S, number | undefined>>()
    })

    describe("Tuple", () => {
      it("exact optional element (without undefined)", () => {
        type S = readonly [number, number?]
        const optic = Optic.id<S>().optionalKey(1)

        expect(optic).type.toBe<Optic.Lens<S, number | undefined>>()
      })
    })

    it("Array", () => {
      type S = ReadonlyArray<number>
      const optic = Optic.id<S>().optionalKey(1)

      expect(optic).type.toBe<Optic.Lens<S, number | undefined>>()
    })
  })

  describe("pick", () => {
    it("Struct", () => {
      type S = { readonly a: string; readonly b: number; readonly c: boolean }
      const optic = Optic.id<S>().pick(["a", "c"])

      expect(optic).type.toBe<Optic.Lens<S, { readonly a: string; readonly c: boolean }>>()
    })
  })

  describe("omit", () => {
    it("Struct", () => {
      type S = { readonly a: string; readonly b: number; readonly c: boolean }
      const optic = Optic.id<S>().omit(["b"])

      expect(optic).type.toBe<Optic.Lens<S, { readonly a: string; readonly c: boolean }>>()
    })
  })

  it("fromChecks", () => {
    const optic = Optic.id<number>().compose(Optic.fromChecks(Check.positive(), Check.int()))
    expect(optic).type.toBe<Optic.Prism<number, number>>()
  })

  it("fromRefine", () => {
    const optic = Optic.id<Option.Option<number>>().compose(Optic.fromRefine(Check.some()))
    expect(optic).type.toBe<Optic.Prism<Option.Option<number>, Option.Some<number>>>()
  })

  describe("Option", () => {
    it("some", () => {
      const optic = Optic.id<Option.Option<number>>().compose(Optic.some())
      expect(optic).type.toBe<Optic.Prism<Option.Option<number>, number>>()
    })

    it("none", () => {
      const optic = Optic.id<Option.Option<number>>().compose(Optic.none())
      expect(optic).type.toBe<Optic.Prism<Option.Option<number>, undefined>>()
    })
  })

  describe("Result", () => {
    it("success", () => {
      const optic = Optic.id<Result.Result<number, string>>().compose(Optic.success())
      expect(optic).type.toBe<Optic.Prism<Result.Result<number, string>, number>>()
    })

    it("failure", () => {
      const optic = Optic.id<Result.Result<number, string>>().compose(Optic.failure())
      expect(optic).type.toBe<Optic.Prism<Result.Result<number, string>, string>>()
    })
  })
})
