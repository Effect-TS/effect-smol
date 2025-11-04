import type { Types } from "effect/types"
import { describe, expect, it } from "tstyche"

describe("Types", () => {
  it("IsUnion", () => {
    expect<Types.IsUnion<string | number>>().type.toBe(true)
    expect<Types.IsUnion<string>>().type.toBe(false)
  })

  it("TupleOf", () => {
    expect<Types.TupleOf<0, number>>()
      .type.toBe<[]>()
    expect<Types.TupleOf<2, number>>()
      .type.toBe<[number, number]>()

    // negative number
    expect<Types.TupleOf<-1, number>>()
      .type.toBe<never>()
  })
})
