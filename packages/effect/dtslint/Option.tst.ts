import type { Predicate } from "effect"
import { Option, pipe } from "effect"
import { describe, expect, it } from "tstyche"

declare const number: Option.Option<number>
declare const numberOrString: Option.Option<string | number>

declare const predicateNumberOrString: Predicate.Predicate<number | string>
declare const refinementNumberOrString: Predicate.Refinement<number | string, number>

describe("Option", () => {
  it("filter", () => {
    expect(Option.filter(number, predicateNumberOrString)).type.toBe<Option.Option<number>>()
    expect(pipe(number, Option.filter(predicateNumberOrString))).type.toBe<Option.Option<number>>()

    expect(pipe(numberOrString, Option.filter(refinementNumberOrString))).type.toBe<Option.Option<number>>()
    expect(Option.filter(numberOrString, refinementNumberOrString)).type.toBe<Option.Option<number>>()

    expect(
      Option.filter(number, (value) => {
        expect(value).type.toBe<number>()
        return true
      })
    ).type.toBe<Option.Option<number>>()
    expect(
      pipe(
        number,
        Option.filter((value) => {
          expect(value).type.toBe<number>()
          return true
        })
      )
    ).type.toBe<Option.Option<number>>()
  })
})
