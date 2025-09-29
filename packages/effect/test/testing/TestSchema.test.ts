import { Check, Schema } from "effect/schema"
import { TestSchema } from "effect/testing"
import { describe, it } from "vitest"

describe("TestSchema", () => {
  it("decoding", async () => {
    const schema = Schema.FiniteFromString.check(Check.positive())
    const assert = new TestSchema.Asserts(schema)
    const decoding = assert.decoding()
    await decoding.succeed("1", 1)
    await decoding.fail("-1", `Expected a value greater than 0, got -1`)
    await decoding.fail("a", `Expected a finite number, got NaN`)
  })

  it("encoding", async () => {
    const schema = Schema.FiniteFromString.check(Check.positive())
    const assert = new TestSchema.Asserts(schema)
    const encoding = assert.encoding()
    await encoding.succeed(1, "1")
    await encoding.fail(-1, `Expected a value greater than 0, got -1`)
  })

  it("verifyLosslessTransformation", async () => {
    const schema = Schema.FiniteFromString.check(Check.positive())
    const assert = new TestSchema.Asserts(schema)
    await assert.verifyLosslessTransformation()
  })
})
