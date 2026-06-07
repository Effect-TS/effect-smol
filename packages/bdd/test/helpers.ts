import { Bdd } from "@effect/bdd"
import { assert } from "@effect/vitest"
import { Cause, Effect, Option } from "effect"

export const runBdd = <State, E, R>(feature: Bdd.Feature<State, E, R>, source: string) =>
  Bdd.run(feature, source).pipe(Effect.provide(Bdd.GherkinCompiler.Cucumber))

export const runError = <A, R>(effect: Effect.Effect<A, Bdd.RunError, R>): Effect.Effect<Bdd.RunError, never, R> =>
  Effect.gen(function*() {
    const result = yield* Effect.exit(effect)
    assert.strictEqual(result._tag, "Failure")
    if (result._tag === "Failure") {
      return Option.getOrThrow(Cause.findErrorOption(result.cause)) as Bdd.RunError
    }
    return yield* Effect.die("expected Bdd.run to fail")
  })

export const assertMatchError = (
  effect: Effect.Effect<unknown, Bdd.RunError>,
  message: RegExp = /MatchError/
): Effect.Effect<void> =>
  Effect.gen(function*() {
    const error = yield* runError(effect)
    assert.strictEqual(error._tag, "MatchError")
    assert.match(error.message, message)
  })
