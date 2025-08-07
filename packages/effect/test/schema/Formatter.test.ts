import { Effect } from "effect"
import type { AST } from "effect/schema"
import { Formatter, Schema, ToParser } from "effect/schema"
import { describe, it } from "vitest"
import { assertions } from "../utils/schema.ts"

const assertStandardIssue = async <T, E>(
  schema: Schema.Codec<T, E>,
  input: unknown,
  expected: string,
  options?: {
    readonly parseOptions?: AST.ParseOptions | undefined
  } | undefined
) => {
  const r = await ToParser.decodeUnknownEffect(schema)(input, { errors: "all", ...options?.parseOptions }).pipe(
    Effect.mapError((issue) => Formatter.makeDefault().format(issue)),
    Effect.result,
    Effect.runPromise
  )

  return assertions.result.fail(r, expected)
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
