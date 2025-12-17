import { Array } from "effect"
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
})
