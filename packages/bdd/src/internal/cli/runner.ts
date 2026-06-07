import * as Arr from "effect/Array"
import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"
import type * as FileSystem from "effect/FileSystem"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type * as Path from "effect/Path"
import type * as Bdd from "../../Bdd.ts"
import type { ParseError } from "../../Errors.ts"
import * as Matching from "../matching.ts"
import * as Parser from "../parser.ts"
import * as CoreRunner from "../runner.ts"
import { DiscoveryError, type ModuleLoadError } from "./errors.ts"
import type { GlobResolver } from "./glob.ts"
import { loadFeatureDefinitions, loadFeatureSources } from "./loaders.ts"
import type {
  CliDiagnostic,
  CliOptions,
  CliRunResult,
  FeatureSource,
  RunSummary,
  ScenarioResult,
  ScenarioTask
} from "./models.ts"
import type { ModuleLoader } from "./moduleLoader.ts"
import * as TagExpression from "./tagExpression.ts"

interface BuiltScenarios {
  readonly tasks: ReadonlyArray<ScenarioTask>
  readonly diagnostics: ReadonlyArray<CliDiagnostic>
  readonly matchedFeatureNames: ReadonlyArray<string>
}

interface StepCoverage {
  readonly diagnostics: ReadonlyArray<CliDiagnostic>
  readonly usedTransitionKeys: ReadonlyArray<string>
}

/** @internal */
export const run: (
  options: CliOptions
) => Effect.Effect<
  CliRunResult,
  CliRunError,
  FileSystem.FileSystem | GlobResolver | ModuleLoader | Path.Path | Parser.GherkinCompiler
> = Effect.fnUntraced(function*(options: CliOptions) {
  const startedAt = yield* Clock.currentTimeMillis
  const sources = yield* loadFeatureSources(options.features)
  const definitions = yield* loadFeatureDefinitions(options.steps)
  const built = yield* pipe(
    sources,
    Effect.forEach((source) => buildScenarioTasks(source, definitions)),
    Effect.map(combineBuiltScenarios)
  )
  const filteredTasks = yield* filterTasks(options, built.tasks)
  const coverage = collectStepCoverage(filteredTasks)
  const results = yield* runScenarios(options, filteredTasks)
  const finishedAt = yield* Clock.currentTimeMillis
  const diagnostics: ReadonlyArray<CliDiagnostic> = pipe(
    built.diagnostics,
    Arr.appendAll(coverage.diagnostics),
    Arr.appendAll(unusedFeatureDefinitions(definitions, built.matchedFeatureNames)),
    Arr.appendAll(
      hasScenarioFilter(options)
        ? []
        : unusedStepDefinitions(definitions, built.matchedFeatureNames, coverage.usedTransitionKeys)
    )
  )
  return {
    results,
    diagnostics,
    summary: summarize(sources.length, results, finishedAt - startedAt)
  } satisfies CliRunResult
})

const buildScenarioTasks: (
  source: FeatureSource,
  definitions: ReadonlyArray<Bdd.Feature<unknown, unknown, never>>
) => Effect.Effect<BuiltScenarios, DiscoveryError | ParseError, Parser.GherkinCompiler> = Effect.fnUntraced(function*(
  source: FeatureSource,
  definitions: ReadonlyArray<Bdd.Feature<unknown, unknown, never>>
) {
  const parsed = yield* Parser.parse(source.source, source.path)
  const matches = Arr.filter(definitions, (definition) => definition.name === parsed.name)
  if (matches.length > 1) {
    return yield* Effect.fail(
      new DiscoveryError({
        message: `Multiple feature definitions matched "${parsed.name}"`
      })
    )
  }
  const definition = matches[0]
  if (definition === undefined) {
    return {
      tasks: [],
      diagnostics: pipe(
        [
          {
            _tag: "UnmatchedFeature",
            featurePath: source.path,
            featureName: parsed.name,
            line: parsed.line,
            message: `Feature file has no matching Bdd.feature export: ${parsed.name}`
          } satisfies CliDiagnostic
        ],
        Arr.appendAll(Arr.map(parsed.pickles, (pickle): CliDiagnostic => ({
          _tag: "UnmatchedScenario",
          featurePath: source.path,
          featureName: parsed.name,
          scenarioName: pickle.name,
          scenarioLine: pickle.location?.line ?? parsed.line,
          message: `Scenario cannot run because no feature definition matched "${parsed.name}"`
        })))
      ),
      matchedFeatureNames: []
    }
  }
  return pipe(
    CoreRunner.buildScenarioTasks(definition, parsed),
    Arr.map((task): ScenarioTask => ({
      featurePath: source.path,
      core: task
    })),
    (tasks): BuiltScenarios => ({
      tasks,
      diagnostics: [],
      matchedFeatureNames: [definition.name]
    })
  )
})

const runScenario = Effect.fnUntraced(function*(task: ScenarioTask) {
  const startedAt = yield* Clock.currentTimeMillis
  const result = yield* Effect.result(CoreRunner.runScenarioTask(task.core))
  const finishedAt = yield* Clock.currentTimeMillis
  return {
    task,
    outcome: result._tag === "Success"
      ? { _tag: "Passed", steps: result.success.steps }
      : { _tag: "Failed", error: result.failure },
    durationMillis: finishedAt - startedAt
  } satisfies ScenarioResult
})

const runScenarios = (
  options: CliOptions,
  tasks: ReadonlyArray<ScenarioTask>
): Effect.Effect<ReadonlyArray<ScenarioResult>, never, never> =>
  options.filters.failFast
    ? runScenariosFailFast(tasks, [])
    : Effect.forEach(tasks, runScenario, { concurrency: options.parallel })

const runScenariosFailFast = (
  tasks: ReadonlyArray<ScenarioTask>,
  results: ReadonlyArray<ScenarioResult>,
  index = 0
): Effect.Effect<ReadonlyArray<ScenarioResult>, never, never> => {
  if (index >= tasks.length) {
    return Effect.succeed(results)
  }
  return pipe(
    runScenario(tasks[index]),
    Effect.flatMap((result) =>
      result.outcome._tag === "Failed"
        ? Effect.succeed(Arr.append(results, result))
        : runScenariosFailFast(tasks, Arr.append(results, result), index + 1)
    )
  )
}

const filterTasks = (
  options: CliOptions,
  tasks: ReadonlyArray<ScenarioTask>
): Effect.Effect<ReadonlyArray<ScenarioTask>, DiscoveryError> =>
  pipe(
    TagExpression.compileAll(options.filters.tags),
    Effect.map((tagPredicate) => {
      const filtered = Arr.filter(tasks, (task) =>
        tagPredicate(task.core.tags) && matchesNameFilter(options.filters.names, task))
      return filtered
    }),
    Effect.flatMap((filtered) =>
      tasks.length > 0 && filtered.length === 0
        ? Effect.fail(new DiscoveryError({ message: "No scenarios matched the provided filters" }))
        : Effect.succeed(filtered)
    )
  )

const matchesNameFilter = (patterns: ReadonlyArray<string>, task: ScenarioTask): boolean =>
  patterns.length === 0 ||
  Arr.some(patterns, (pattern) => `${task.core.featureName} / ${task.core.scenarioName}`.includes(pattern))

const hasScenarioFilter = (options: CliOptions): boolean =>
  options.filters.tags.length > 0 || options.filters.names.length > 0

const summarize = (features: number, results: ReadonlyArray<ScenarioResult>, durationMillis: number): RunSummary => {
  const failed = Arr.filter(results, (result) => result.outcome._tag === "Failed").length
  return {
    features,
    total: results.length,
    passed: results.length - failed,
    failed,
    durationMillis
  }
}

const combineBuiltScenarios = (built: ReadonlyArray<BuiltScenarios>): BuiltScenarios => ({
  tasks: pipe(built, Arr.flatMap((item) => item.tasks)),
  diagnostics: pipe(built, Arr.flatMap((item) => item.diagnostics)),
  matchedFeatureNames: pipe(
    built,
    Arr.flatMap((item) => item.matchedFeatureNames),
    Arr.dedupe
  )
})

const collectStepCoverage = (tasks: ReadonlyArray<ScenarioTask>): StepCoverage =>
  pipe(
    tasks,
    Arr.reduce({ diagnostics: [], usedTransitionKeys: [] } as StepCoverage, (coverage, task) =>
      pipe(
        task.core.pickle.steps,
        Arr.reduce(coverage, (coverage, step) => appendStepCoverage(coverage, task, step))
      ))
  )

const appendStepCoverage = (
  coverage: StepCoverage,
  task: ScenarioTask,
  step: CoreRunner.ScenarioTask<unknown, unknown, never>["pickle"]["steps"][number]
): StepCoverage => {
  const kind = Matching.concreteStepKind(step)
  const textMatches = Matching.matchingTextTransitions(task.core.featureDefinition.transitions, step.text)
  const matches = pipe(
    kind,
    Option.match({
      onNone: () => [],
      onSome: (kind) => Matching.matchingKeywordTransitions(textMatches, kind)
    })
  )
  if (matches.length === 0) {
    return {
      diagnostics: Arr.append(coverage.diagnostics, {
        _tag: "UnmatchedStep",
        featurePath: task.featurePath,
        featureName: task.core.featureName,
        scenarioName: task.core.scenarioName,
        scenarioLine: task.core.scenarioLine,
        step,
        source: task.core.source,
        reason: textMatches.length === 0 ? "NoMatch" : "WrongKeyword",
        candidates: textMatches.length === 0
          ? Arr.map(task.core.featureDefinition.transitions, (transition) => transition.expression.source)
          : Arr.map(textMatches, (match) => match.transition.expression.source),
        message: textMatches.length === 0
          ? `No transition matched step "${step.text}"`
          : `No ${
            pipe(kind, Option.getOrElse(() => "Step"))
          } transition matched step "${step.text}"; matching text exists for ${
            Matching.renderTransitionKinds(Arr.map(textMatches, (match) => match.transition))
          }`
      }),
      usedTransitionKeys: coverage.usedTransitionKeys
    }
  }
  if (matches.length > 1) {
    return {
      diagnostics: Arr.append(coverage.diagnostics, {
        _tag: "UnmatchedStep",
        featurePath: task.featurePath,
        featureName: task.core.featureName,
        scenarioName: task.core.scenarioName,
        scenarioLine: task.core.scenarioLine,
        step,
        source: task.core.source,
        reason: "MultipleMatches",
        candidates: Arr.map(matches, (match) => match.transition.expression.source),
        message: `Multiple transitions matched step "${step.text}"`
      }),
      usedTransitionKeys: coverage.usedTransitionKeys
    }
  }
  return {
    diagnostics: coverage.diagnostics,
    usedTransitionKeys: pipe(
      coverage.usedTransitionKeys,
      Arr.append(transitionKey(task.core.featureName, matches[0].transition)),
      Arr.dedupe
    )
  }
}

const unusedFeatureDefinitions = (
  definitions: ReadonlyArray<Bdd.Feature<unknown, unknown, never>>,
  matchedFeatureNames: ReadonlyArray<string>
): ReadonlyArray<CliDiagnostic> =>
  pipe(
    definitions,
    Arr.filter((definition) => !Arr.contains(definition.name)(matchedFeatureNames)),
    Arr.map((definition): CliDiagnostic => ({
      _tag: "UnusedFeatureDefinition",
      featureName: definition.name,
      message: `Feature definition exported but no feature file matched: ${definition.name}`
    }))
  )

const unusedStepDefinitions = (
  definitions: ReadonlyArray<Bdd.Feature<unknown, unknown, never>>,
  matchedFeatureNames: ReadonlyArray<string>,
  usedTransitionKeys: ReadonlyArray<string>
): ReadonlyArray<CliDiagnostic> =>
  pipe(
    definitions,
    Arr.filter((definition) => Arr.contains(definition.name)(matchedFeatureNames)),
    Arr.flatMap((definition) =>
      pipe(
        definition.transitions,
        Arr.filter((transition) => !Arr.contains(transitionKey(definition.name, transition))(usedTransitionKeys)),
        Arr.map((transition): CliDiagnostic => ({
          _tag: "UnusedStepDefinition",
          featureName: definition.name,
          expression: transition.expression.source,
          kind: transition.kind,
          message: `Step definition never matched: ${transition.expression.source}`
        }))
      )
    )
  )

const transitionKey = (
  featureName: string,
  transition: Bdd.Transition<unknown, unknown, never>
): string => `${featureName}:${transition.kind}:${transition.expression.source}`

/** @internal */
export type CliRunError = DiscoveryError | ModuleLoadError | ParseError
