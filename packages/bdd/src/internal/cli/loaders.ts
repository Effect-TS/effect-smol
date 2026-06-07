import * as Arr from "effect/Array"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import { pipe } from "effect/Function"
import type * as Path from "effect/Path"
import * as Record_ from "effect/Record"
import type * as Bdd from "../../Bdd.ts"
import { DiscoveryError, type ModuleLoadError } from "./errors.ts"
import { GlobResolver } from "./glob.ts"
import type { FeatureSource } from "./models.ts"
import { ModuleLoader } from "./moduleLoader.ts"

/** @internal */
export const loadFeatureSources: (
  patterns: ReadonlyArray<string>
) => Effect.Effect<ReadonlyArray<FeatureSource>, DiscoveryError, FileSystem.FileSystem | GlobResolver> = Effect
  .fnUntraced(function*(
    patterns: ReadonlyArray<string>
  ) {
    const fs = yield* FileSystem.FileSystem
    const glob = yield* GlobResolver
    const paths = yield* nonEmptyPaths(
      yield* glob.resolve(patterns),
      "No feature files matched --features"
    )
    return yield* Effect.forEach(paths, (path) =>
      pipe(
        fs.readFileString(path),
        Effect.map((source): FeatureSource => ({ path, source })),
        Effect.mapError((cause) =>
          new DiscoveryError({
            message: `Could not read feature file "${path}"`,
            cause
          })
        )
      ))
  })

/** @internal */
export const loadFeatureDefinitions: (
  patterns: ReadonlyArray<string>
) => Effect.Effect<
  ReadonlyArray<Bdd.Feature<unknown, unknown, never>>,
  DiscoveryError | ModuleLoadError,
  GlobResolver | ModuleLoader | Path.Path
> = Effect.fnUntraced(function*(
  patterns: ReadonlyArray<string>
) {
  const glob = yield* GlobResolver
  const loader = yield* ModuleLoader
  const paths = yield* nonEmptyPaths(
    yield* glob.resolve(patterns),
    "No step definition modules matched --steps"
  )
  const definitions = yield* Effect.forEach(paths, (path) =>
    pipe(
      loader.load(path),
      Effect.map(extractFeatureDefinitions)
    ))
  return yield* nonEmptyDefinitions(Arr.flatten(definitions))
})

const nonEmptyPaths = (
  paths: ReadonlyArray<string>,
  message: string
): Effect.Effect<ReadonlyArray<string>, DiscoveryError> =>
  paths.length === 0
    ? Effect.fail(new DiscoveryError({ message }))
    : Effect.succeed(paths)

const nonEmptyDefinitions = (
  definitions: ReadonlyArray<Bdd.Feature<unknown, unknown, never>>
): Effect.Effect<ReadonlyArray<Bdd.Feature<unknown, unknown, never>>, DiscoveryError> =>
  definitions.length === 0
    ? Effect.fail(new DiscoveryError({ message: "No Bdd.Feature exports found in matched step definition modules" }))
    : Effect.succeed(definitions)

const extractFeatureDefinitions = (
  module: Record<string, unknown>
): ReadonlyArray<Bdd.Feature<unknown, unknown, never>> =>
  pipe(
    Record_.values(module),
    Arr.filter(isFeatureDefinition)
  )

const isFeatureDefinition = (value: unknown): value is Bdd.Feature<unknown, unknown, never> => {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const candidate = value as {
    readonly _tag?: unknown
    readonly initial?: unknown
    readonly name?: unknown
    readonly transitions?: unknown
  }
  return candidate._tag === "Feature" &&
    "initial" in candidate &&
    typeof candidate.name === "string" &&
    Array.isArray(candidate.transitions)
}
