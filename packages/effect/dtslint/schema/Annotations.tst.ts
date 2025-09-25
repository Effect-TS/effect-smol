import { Annotations, Schema } from "effect/schema"
import { describe, expect, it } from "tstyche"

describe("Annotations", () => {
  it("getUnsafe", () => {
    const schema = Schema.String
    const annotations = Annotations.getUnsafe(schema)
    expect(annotations).type.toBe<Annotations.Bottom<string, readonly []> | undefined>()
    const description = annotations?.description
    expect(description).type.toBe<string | undefined>()
  })
})
