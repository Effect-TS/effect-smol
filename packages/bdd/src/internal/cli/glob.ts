import * as Arr from "effect/Array"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Order from "effect/Order"
import { glob } from "glob"
import { DiscoveryError } from "./errors.ts"

const resolve = Effect.fnUntraced(function*(patterns: ReadonlyArray<string>) {
  const paths = yield* Effect.forEach(patterns, resolvePattern)
  return pipe(
    paths,
    Arr.flatten,
    Arr.dedupe,
    Arr.sort(Order.String)
  )
})

/** @internal */
export class GlobResolver extends Context.Service<GlobResolver, {
  readonly resolve: (patterns: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<string>, DiscoveryError>
}>()("@effect/bdd/cli/GlobResolver") {
  static readonly Live = Layer.succeed(GlobResolver, {
    resolve
  })
}

const resolvePattern = (pattern: string): Effect.Effect<ReadonlyArray<string>, DiscoveryError> =>
  Effect.tryPromise({
    try: () => glob(pattern, { absolute: true, nodir: true }),
    catch: (cause) =>
      new DiscoveryError({
        message: `Could not resolve glob pattern "${pattern}"`,
        cause
      })
  })
