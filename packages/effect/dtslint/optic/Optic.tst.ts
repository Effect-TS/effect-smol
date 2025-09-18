import { Optic } from "effect/optic"
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
})
