import { Array, Effect } from "effect"
import { hole, pipe } from "effect/Function"
import { describe, expect, it } from "tstyche"

declare const iterableString: Iterable<string>

describe("Array", () => {
  describe("make", () => {
    it("should raise an error if no elements are provided", () => {
      // @ts-expect-error: Expected at least 1 arguments, but got 0
      Array.make()
    })

    it("should return a non-empty array", () => {
      expect(Array.make(1, 2, 3)).type.toBe<Array.NonEmptyArray<number>>()
      expect(Array.make("a", 1, "b")).type.toBe<Array.NonEmptyArray<string | number>>()
    })
  })

  describe("window", () => {
    it("should infer a literal for n", () => {
      expect(Array.window(iterableString, 2)).type.toBe<Array<[string, string]>>()
      expect(pipe(iterableString, Array.window(2))).type.toBe<Array<[string, string]>>()
      expect(Array.window(2)(iterableString)).type.toBe<Array<[string, string]>>()
    })

    it("n: forced number", () => {
      const n = hole<number>()
      expect(Array.window(iterableString, n)).type.toBe<Array<Array<string>>>()
      expect(pipe(iterableString, Array.window(n))).type.toBe<Array<Array<string>>>()
      expect(Array.window(n)(iterableString)).type.toBe<Array<Array<string>>>()
    })

    it("n: forced literal", () => {
      const two = hole<2>()
      expect(Array.window(iterableString, two)).type.toBe<Array<[string, string]>>()
      expect(pipe(iterableString, Array.window(two))).type.toBe<Array<[string, string]>>()
      expect(Array.window(two)(iterableString)).type.toBe<Array<[string, string]>>()

      const zero = hole<0>()
      expect(Array.window(iterableString, zero)).type.toBe<Array<[]>>()
      expect(pipe(iterableString, Array.window(zero))).type.toBe<Array<[]>>()
      expect(Array.window(zero)(iterableString)).type.toBe<Array<[]>>()

      const negativeOne = hole<-1>()
      expect(Array.window(iterableString, negativeOne)).type.toBe<Array<never>>()
      expect(pipe(iterableString, Array.window(negativeOne))).type.toBe<Array<never>>()
      expect(Array.window(negativeOne)(iterableString)).type.toBe<Array<never>>()
    })
  })

  it("flatten", () => {
    // Mutable arrays
    expect(Array.flatten(hole<Array<Array<number>>>())).type.toBe<Array<number>>()
    expect(Array.flatten(hole<Array<Array.NonEmptyArray<number>>>())).type.toBe<Array<number>>()
    expect(Array.flatten(hole<Array.NonEmptyArray<Array<number>>>())).type.toBe<Array<number>>()
    expect(Array.flatten(hole<Array.NonEmptyReadonlyArray<Array.NonEmptyReadonlyArray<number>>>()))
      .type.toBe<[number, ...Array<number>]>()

    // Readonly arrays
    expect(
      hole<Effect.Effect<ReadonlyArray<ReadonlyArray<number>>>>().pipe(Effect.map((x) => {
        expect(x).type.toBe<ReadonlyArray<ReadonlyArray<number>>>()
        return Array.flatten(x)
      }))
    ).type.toBe<Effect.Effect<Array<number>, never, never>>()
    expect(
      hole<Effect.Effect<Array.NonEmptyReadonlyArray<Array.NonEmptyReadonlyArray<number>>>>().pipe(Effect.map((x) => {
        expect(x).type.toBe<Array.NonEmptyReadonlyArray<Array.NonEmptyReadonlyArray<number>>>()
        return Array.flatten(x)
      }))
    ).type.toBe<Effect.Effect<[number, ...Array<number>], never, never>>()

    // distributive indexed access
    interface Eff<R> {
      readonly _R: (_: R) => void
    }
    interface R1 {
      readonly _r1: unique symbol
    }
    interface R2 {
      readonly _r2: unique symbol
    }
    interface R3 {
      readonly _r3: unique symbol
    }
    const arg1 = hole<Eff<R1 | R2>>()
    const arg2 = hole<Eff<R1 | R2 | R3>>()

    expect(Array.flatten([[arg1], [arg2]])).type.toBe<Array.NonEmptyArray<Eff<R1 | R2> | Eff<R1 | R2 | R3>>>()
    expect(Array.flatten([[arg2], [arg1]])).type.toBe<Array.NonEmptyArray<Eff<R1 | R2> | Eff<R1 | R2 | R3>>>()
  })
})
