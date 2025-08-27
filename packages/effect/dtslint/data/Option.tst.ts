import { pipe } from "effect"
import type { Predicate } from "effect/data"
import { Option } from "effect/data"
import { describe, expect, it } from "tstyche"

declare const number: Option.Option<number>
declare const numberOrString: Option.Option<string | number>

declare const predicateNumberOrString: Predicate.Predicate<number | string>
declare const refinementNumberOrString: Predicate.Refinement<number | string, number>

declare const nullish: number | null | undefined
declare const nullOr: number | null
declare const undefinedOr: number | undefined

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

  it("fromNullish", () => {
    expect(Option.fromNullish(nullish)).type.toBe<Option.Option<number>>()
    expect(Option.fromNullish(nullOr)).type.toBe<Option.Option<number>>()
    expect(Option.fromNullish(undefinedOr)).type.toBe<Option.Option<number>>()
  })

  it("fromUndefinedOr", () => {
    expect(Option.fromUndefinedOr(nullish)).type.toBe<Option.Option<number | null>>()
    expect(Option.fromUndefinedOr(nullOr)).type.toBe<Option.Option<number | null>>()
    expect(Option.fromUndefinedOr(undefinedOr)).type.toBe<Option.Option<number>>()
  })

  it("fromNullOr", () => {
    expect(Option.fromNullOr(nullish)).type.toBe<Option.Option<number | undefined>>()
    expect(Option.fromNullOr(nullOr)).type.toBe<Option.Option<number>>()
    expect(Option.fromNullOr(undefinedOr)).type.toBe<Option.Option<number | undefined>>()
  })
})
