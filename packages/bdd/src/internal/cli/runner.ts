import * as Arr from "effect/Array"
import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"
import type * as FileSystem from "effect/FileSystem"
import { pipe } from "effect/Function"
import type * as Path from "effect/Path"
import type * as Bdd from "../../Bdd.ts"
import type { ParseError } from "../../Errors.ts"
import * as Parser from "../parser.ts"
import * as CoreRunner from "../runner.ts"
import type { DiscoveryError, ModuleLoadError } from "./errors.ts"
import type { GlobResolver } from "./glob.ts"
import { loadFeatureDefinitions, loadFeatureSources, matchFeatureDefinition } from "./loaders.ts"
import type { CliOptions, CliRunResult, FeatureSource, RunSummary, ScenarioResult, ScenarioTask } from "./models.ts"
import type { ModuleLoader } from "./moduleLoader.ts"

/** @internal */
export const run: (
  options: CliOptions
) => Effect.Effect<
  CliRunResult,
  CliRunError,
  FileSystem.FileSystem | GlobResolver | ModuleLoader | Path.Path
> = Effect.fnUntraced(function*(options: CliOptions) {
  const startedAt = yield* Clock.currentTimeMillis
  const sources = yield* loadFeatureSources(options.features)
  const definitions = yield* loadFeatureDefinitions(options.steps)
  const tasks = yield* pipe(
    sources,
    Effect.forEach((source) => buildScenarioTasks(source, definitions)),
    Effect.map(Arr.flatten)
  )
  const results = yield* Effect.forEach(tasks, runScenario, { concurrency: options.parallel })
  const finishedAt = yield* Clock.currentTimeMillis
  return {
    results,
    summary: summarize(results, finishedAt - startedAt)
  } satisfies CliRunResult
})

const buildScenarioTasks = Effect.fnUntraced(function*(
  source: FeatureSource,
  definitions: ReadonlyArray<{
    readonly name: string
    readonly definition: Bdd.Feature<unknown, unknown, never>
  }>
) {
  const parsed = yield* Parser.parse(source.source)
  const definition = yield* matchFeatureDefinition(parsed, definitions)
  return pipe(
    CoreRunner.buildScenarioTasks(definition.definition, parsed),
    Arr.map((task): ScenarioTask => ({
      featurePath: source.path,
      featureName: task.featureName,
      scenarioName: task.scenarioName,
      scenarioIndex: task.scenarioIndex,
      tags: task.tags,
      steps: task.steps,
      definition: definition.definition
    }))
  )
})

const runScenario = Effect.fnUntraced(function*(task: ScenarioTask) {
  const startedAt = yield* Clock.currentTimeMillis
  const result = yield* Effect.result(CoreRunner.runScenarioTask({
    featureDefinition: task.definition,
    featureName: task.featureName,
    scenarioName: task.scenarioName,
    scenarioIndex: task.scenarioIndex,
    tags: task.tags,
    steps: task.steps
  }))
  const finishedAt = yield* Clock.currentTimeMillis
  return {
    task,
    outcome: result._tag === "Success"
      ? { _tag: "Passed", steps: result.success.steps }
      : { _tag: "Failed", error: result.failure },
    durationMillis: finishedAt - startedAt
  } satisfies ScenarioResult
})

const summarize = (results: ReadonlyArray<ScenarioResult>, durationMillis: number): RunSummary => {
  const failed = Arr.filter(results, (result) => result.outcome._tag === "Failed").length
  return {
    total: results.length,
    passed: results.length - failed,
    failed,
    durationMillis
  }
}

/** @internal */
export type CliRunError = DiscoveryError | ModuleLoadError | ParseError
