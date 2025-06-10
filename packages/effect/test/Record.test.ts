import { Record } from "effect"
import { describe, it } from "vitest"
import { deepStrictEqual } from "./utils/assert.js"

describe("Record", () => {
  it("singleton", () => {
    deepStrictEqual(Record.singleton("a", 1), { a: 1 })
    deepStrictEqual(Record.singleton("__proto__", 1), { ["__proto__"]: 1 })
  })
})
