import { assert, describe, it } from "@effect/vitest"
import { Cause, Effect, Option } from "effect"

interface TagExpressionModule {
  readonly compileAll: (
    expressions: ReadonlyArray<string>
  ) => Effect.Effect<(tags: ReadonlyArray<string>) => boolean, unknown>
}

const loadTagExpression: Effect.Effect<TagExpressionModule> = Effect.promise(() =>
  import(["../src/internal/cli", "tagExpression.ts"].join("/")) as Promise<TagExpressionModule>
)

describe("tagExpression", () => {
  it.effect("matches tags with and, or, not, and parentheses", () =>
    Effect.gen(function*() {
      const TagExpression = yield* loadTagExpression
      const predicate = yield* TagExpression.compileAll([
        "@checkout and not @slow",
        "(@happy or @smoke)"
      ])

      assert.strictEqual(predicate(["@checkout", "@happy"]), true)
      assert.strictEqual(predicate(["@checkout", "@smoke"]), true)
      assert.strictEqual(predicate(["@checkout", "@slow", "@happy"]), false)
      assert.strictEqual(predicate(["@checkout"]), false)
    }))

  it.effect("combines repeated tag expressions with and", () =>
    Effect.gen(function*() {
      const TagExpression = yield* loadTagExpression
      const predicate = yield* TagExpression.compileAll(["@checkout", "not @slow"])

      assert.strictEqual(predicate(["@checkout"]), true)
      assert.strictEqual(predicate(["@checkout", "@slow"]), false)
      assert.strictEqual(predicate(["@other"]), false)
    }))

  it.effect("rejects malformed expressions", () =>
    Effect.gen(function*() {
      const TagExpression = yield* loadTagExpression
      const result = yield* Effect.exit(TagExpression.compileAll(["@checkout and"]))

      assert.strictEqual(result._tag, "Failure")
      if (result._tag === "Failure") {
        const error = Option.getOrThrow(Cause.findErrorOption(result.cause))
        assert.match(String((error as { readonly message: string }).message), /Could not parse tag expression/)
      }
    }))
})
