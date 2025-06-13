import { pipe, Tuple } from "effect"
import { describe, it } from "vitest"
import { deepStrictEqual, strictEqual } from "./utils/assert.js"

const tuple = ["a", 2, true] as [string, number, boolean]

describe("Tuple", () => {
  it("get", () => {
    strictEqual(pipe(["a", 1], Tuple.get(0)), "a")
    strictEqual(pipe(["a", 1], Tuple.get(1)), 1)

    strictEqual(Tuple.get(["a", 1], 0), "a")
    strictEqual(Tuple.get(["a", 1], 1), 1)
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
