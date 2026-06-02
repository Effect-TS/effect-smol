import { describe, it } from "@effect/vitest"
import { assertFalse, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import { Result, Yaml } from "effect"

describe("Yaml", () => {
  it("isYamlError", () => {
    const result = Yaml.parse("a: [")
    assertTrue(Result.isFailure(result))
    assertTrue(Yaml.isYamlError(result.failure))
    assertFalse(Yaml.isYamlError(new Error("regular error")))
    assertFalse(Yaml.isYamlError("not an error"))
  })

  it("YamlError constructor", () => {
    const cause = new Error("boom")
    const error = new Yaml.YamlError({
      kind: "Parse",
      input: "a: [",
      message: cause.message,
      cause
    })
    assertTrue(error instanceof Error)
    assertTrue(Yaml.isYamlError(error))
    strictEqual(error._tag, "YamlError")
    strictEqual(error.kind, "Parse")
    strictEqual(error.input, "a: [")
    strictEqual(error.message, "boom")
    strictEqual(error.cause, cause)
  })

  it("parse", () => {
    deepStrictEqual(
      Yaml.parse(`
name: example
ports:
  - 3000
  - 3001
`),
      Result.succeed({
        name: "example",
        ports: [3000, 3001]
      })
    )
    deepStrictEqual(Yaml.parse("value: 1", { intAsBigInt: true }), Result.succeed({ value: 1n }))
  })

  it("parse fails for multiple documents", () => {
    const result = Yaml.parse(`
---
a: 1
---
b: 2
`)
    assertTrue(Result.isFailure(result))
    strictEqual(result.failure.kind, "Parse")
    assertTrue(result.failure.message.includes("Source contains multiple documents"))
  })

  it("stringify", () => {
    deepStrictEqual(
      Yaml.stringify({ name: "example", ports: [3000, 3001] }),
      Result.succeed(`name: example
ports:
  - 3000
  - 3001
`)
    )
  })

  it("stringify fails for unsupported values", () => {
    const result = Yaml.stringify(undefined)
    assertTrue(Result.isFailure(result))
    strictEqual(result.failure.kind, "Stringify")
    strictEqual(result.failure.message, "Unable to stringify input")
  })
})
