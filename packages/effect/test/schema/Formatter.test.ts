import { Effect } from "effect"
import { Result } from "effect/data"
import type { AST } from "effect/schema"
import { Schema, ToParser } from "effect/schema"
import * as assert from "node:assert"
import { describe, it } from "vitest"

const assertStandardIssue = async <T, E>(
  schema: Schema.Codec<T, E>,
  input: unknown,
  expected: string,
  options?: {
    readonly parseOptions?: AST.ParseOptions | undefined
  } | undefined
) => {
  const r = await ToParser.decodeUnknownEffect(schema)(input, { errors: "all", ...options?.parseOptions }).pipe(
    Effect.mapError((issue) => issue.toString()),
    Effect.result,
    Effect.runPromise
  )

  assert.deepStrictEqual(r, Result.fail(expected))
}

describe("makeDefault", () => {
  it("should format the issue", async () => {
    const schema = Schema.Struct({
      a: Schema.String,
      b: Schema.Struct({
        c: Schema.NonEmptyString
      })
    })

    await assertStandardIssue(
      schema,
      null,
      `Expected object, got null`
    )
    await assertStandardIssue(
      schema,
      { b: { c: "" } },
      `Missing key
  at ["a"]
Expected a value with a length of at least 1, got ""
  at ["b"]["c"]`
    )
  })
})
