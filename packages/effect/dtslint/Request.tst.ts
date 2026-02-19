import { Request } from "effect"
import { describe, expect, it } from "tstyche"

class TaggedNoInput extends Request.TaggedClass("TaggedNoInput")<
  {},
  void
> {}

class TaggedWithInput extends Request.TaggedClass("TaggedWithInput")<
  {
    readonly foo: string
  },
  void
> {}

class UntaggedNoInput extends Request.Class<{}, void> {}

class UntaggedWithInput extends Request.Class<
  {
    readonly foo: string
  },
  void
> {}

describe("Request", () => {
  it("Input", () => {
    expect<Request.Parameters<TaggedNoInput>>().type.toBe<void>()
    expect<Request.Parameters<UntaggedNoInput>>().type.toBe<void>()
    expect<Request.Parameters<TaggedWithInput>>().type.toBe<{ readonly foo: string }>()
    expect<Request.Parameters<UntaggedWithInput>>().type.toBe<{ readonly foo: string }>()
  })
})
