import { Optic } from "effect/optic"
import { describe, expect, it } from "tstyche"

describe("Optic", () => {
  it("optional key", () => {
    type S = { readonly a?: number | undefined }
    const optic = Optic.id<S>().key("a")

    expect(optic).type.toBe<Optic.Lens<S, number | undefined>>()
  })

  it("exact optional key", () => {
    type S = { readonly a?: number }
    const optic = Optic.id<S>().optionalKey("a")

    expect(optic).type.toBe<Optic.Lens<S, number | undefined>>()
  })
})
