import { Filter } from "effect"
import type * as FilterModule from "effect/Filter"
import { describe, expect, it } from "tstyche"

describe("Filter", () => {
  it("constructors", () => {
    expect(Filter.fromPredicate((n: number) => n > 0)).type.toBe<Filter.Filter<number>>()
    expect(Filter.toPredicate(Filter.number)).type.toBe<(input: unknown) => boolean>()
  })

  it("does not expose removed apply helpers", () => {
    expect<"apply" extends keyof typeof FilterModule ? true : false>().type.toBe<false>()
    // @ts-expect-error!
    type _OrPredicate = Filter.OrPredicate<number, boolean>
    // @ts-expect-error!
    type _ResultOrBool = Filter.ResultOrBool<number>
    // @ts-expect-error!
    type _Pass = Filter.Pass<number, boolean>
    // @ts-expect-error!
    type _Fail = Filter.Fail<number, boolean>
    // @ts-expect-error!
    type _ApplyResult = Filter.ApplyResult<number, boolean>
  })
})
