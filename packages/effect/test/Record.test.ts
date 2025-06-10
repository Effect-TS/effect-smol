import { Record } from "effect"
import { describe, it } from "vitest"
import { assertTrue, deepStrictEqual } from "./utils/assert.js"

describe("Record", () => {
  it("singleton", () => {
    deepStrictEqual(Record.singleton("a", 1), { a: 1 })
    const proto = Record.singleton("__proto__", 1)
    assertTrue(Object.hasOwn(proto, "__proto__"))
    deepStrictEqual(proto["__proto__"], 1)
  })
})
