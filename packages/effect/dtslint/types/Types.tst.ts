import type { Types } from "effect/types"
import { describe, expect, it } from "tstyche"

describe("Types", () => {
  it("IsUnion", () => {
    expect<Types.IsUnion<string | number>>().type.toBe(true)
    expect<Types.IsUnion<string>>().type.toBe(false)
  })
})
