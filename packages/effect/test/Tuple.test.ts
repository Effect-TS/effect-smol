import { pipe, Tuple } from "effect"
import { describe, it } from "vitest"
import { deepStrictEqual, strictEqual } from "./utils/assert.js"

const tuple = ["a", 2, true] as [string, number, boolean]

describe("Tuple", () => {
  it("get", () => {
    strictEqual(pipe(tuple, Tuple.get(0)), "a")
    strictEqual(pipe(tuple, Tuple.get(1)), 2)

    strictEqual(Tuple.get(tuple, 0), "a")
    strictEqual(Tuple.get(tuple, 1), 2)
  })

  it("pick", () => {
    deepStrictEqual(pipe(tuple, Tuple.pick([0, 2])), ["a", true])
    deepStrictEqual(Tuple.pick(tuple, [0, 2]), ["a", true])
  })

  it("omit", () => {
    deepStrictEqual(pipe(tuple, Tuple.omit([1])), ["a", true])
    deepStrictEqual(Tuple.omit(tuple, [1]), ["a", true])
  })

  it("evolve", () => {
    deepStrictEqual(
      pipe(
        tuple,
        Tuple.evolve([
          (s) => s.length,
          undefined,
          (b) => `b: ${b}`
        ])
      ),
      [1, 2, "b: true"]
    )
    deepStrictEqual(
      Tuple.evolve(
        tuple,
        [
          (s) => s.length,
          undefined,
          (b) => `b: ${b}`
        ] as const
      ),
      [1, 2, "b: true"]
    )
  })
})
