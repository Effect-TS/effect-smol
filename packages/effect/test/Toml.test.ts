import { describe, it } from "@effect/vitest"
import { assertFalse, assertTrue, strictEqual } from "@effect/vitest/utils"
import { Result, Toml } from "effect"

describe("Toml", () => {
  it("isTomlError", () => {
    const result = Toml.parse("name =")
    assertTrue(Result.isFailure(result))
    assertTrue(Toml.isTomlError(result.failure))
    assertFalse(Toml.isTomlError(new Error("regular error")))
    assertFalse(Toml.isTomlError("not an error"))
  })

  it("TomlError constructor", () => {
    const cause = new Error("boom")
    const error = new Toml.TomlError({
      input: "name =",
      message: cause.message,
      cause
    })
    assertTrue(error instanceof Error)
    assertTrue(Toml.isTomlError(error))
    strictEqual(error._tag, "TomlError")
    strictEqual(error.input, "name =")
    strictEqual(error.message, "boom")
    strictEqual(error.cause, cause)
  })

  it("parse", () => {
    const result = Toml.parse(`
name = "example"
ports = [3000, 3001]
created = 1979-05-27T07:32:00Z
local = 1979-05-27T07:32:00
`)
    assertTrue(Result.isSuccess(result))
    const parsed = result.success as {
      readonly name: string
      readonly ports: ReadonlyArray<number>
      readonly created: Date
      readonly local: string
    }
    strictEqual(parsed.name, "example")
    strictEqual(parsed.ports[0], 3000)
    strictEqual(parsed.ports[1], 3001)
    strictEqual(parsed.created.toISOString(), "1979-05-27T07:32:00.000Z")
    strictEqual(parsed.local, "1979-05-27T07:32:00")
  })
})
