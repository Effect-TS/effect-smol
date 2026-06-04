import * as Arr from "effect/Array"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as Record from "effect/Record"
import * as Schema from "effect/Schema"
import { MatchError, type ParseError, StepError } from "../Errors.ts"
import * as Parser from "./parser.ts"

/** @internal */
export type DataTableInput = Parser.DataTable

/** @internal */
export type DocStringInput = Parser.DocString

/** @internal */
export type StepKind = "Step" | "Given" | "When" | "Then"

/** @internal */
export interface Matcher<A> {
  readonly source: string
  readonly match: (text: string) => Option.Option<A>
}

/** @internal */
export type StepArgument =
  | {
    readonly _tag: "TableArg"
    readonly decode: (argument: DataTableInput) => Effect.Effect<unknown, unknown>
  }
  | {
    readonly _tag: "DocStringArg"
    readonly decode: (argument: DocStringInput) => Effect.Effect<unknown, unknown>
  }

/** @internal */
export interface Transition<State, E, R> {
  readonly kind: StepKind
  readonly expression: Matcher<unknown>
  readonly argument?: StepArgument
  readonly run: (captures: unknown, argument: unknown, state: State) => Effect.Effect<State, E, R>
}

/** @internal */
export interface Feature<State, E, R> {
  readonly name: string
  readonly initial: State
  readonly transitions: ReadonlyArray<Transition<State, E, R>>
}

/** @internal */
export interface Report {
  readonly feature: string
  readonly scenarios: ReadonlyArray<{
    readonly name: string
    readonly steps: number
    readonly tags: ReadonlyArray<string>
  }>
}

/** @internal */
export type RunError = ParseError | MatchError | StepError

/** @internal */
export interface ScenarioTask<State, E, R> {
  readonly featureDefinition: Feature<State, E, R>
  readonly featureName: string
  readonly scenarioName: string
  readonly scenarioIndex: number
  readonly tags: ReadonlyArray<string>
  readonly steps: ReadonlyArray<Parser.ParsedStep>
}

interface ResolvedTransition<State, E, R> {
  readonly transition: Transition<State, E, R>
  readonly captures: unknown
}

/** @internal */
export type ScenarioReport = Report["scenarios"][number]

/** @internal */
export const decodeTable = <S extends Schema.Decoder<unknown, never>>(row: S) => {
  const decode = Schema.decodeUnknownEffect(row)
  return (table: Parser.DataTable): Effect.Effect<ReadonlyArray<S["Type"]>, unknown> => {
    const [headers, ...rows] = table.rows
    if (headers === undefined) {
      return Effect.succeed([])
    }
    return Effect.forEach(rows, (cells: ReadonlyArray<string>) => decode(rowObject(headers, cells)))
  }
}

/** @internal */
export const decodeDocString = <S extends Schema.Decoder<unknown, never>>(schema: S) => {
  const decode = Schema.decodeUnknownEffect(schema)
  return (docString: Parser.DocString): Effect.Effect<S["Type"], unknown> => decode(docString.content)
}

/** @internal */
export const run = <State, E, R>(
  featureDefinition: Feature<State, E, R>,
  source: string
): Effect.Effect<Report, RunError, R> =>
  pipe(
    Parser.parse(source),
    Effect.flatMap((feature) =>
      pipe(
        Effect.forEach(buildScenarioTasks(featureDefinition, feature), runScenarioTask),
        Effect.map((scenarios): Report => ({
          feature: feature.name,
          scenarios
        }))
      )
    )
  )

/** @internal */
export const buildScenarioTasks = <State, E, R>(
  featureDefinition: Feature<State, E, R>,
  feature: Parser.Feature
): ReadonlyArray<ScenarioTask<State, E, R>> =>
  Arr.map(feature.scenarios, (scenario, scenarioIndex): ScenarioTask<State, E, R> => {
    const steps = scenarioSteps(feature, scenario)
    return {
      featureDefinition,
      featureName: feature.name,
      scenarioName: scenario.name,
      scenarioIndex,
      tags: Arr.appendAll(feature.tags, scenario.tags),
      steps
    }
  })

/** @internal */
export const runScenarioTask = <State, E, R>(
  task: ScenarioTask<State, E, R>
): Effect.Effect<ScenarioReport, RunError, R> =>
  pipe(
    runSteps(task.featureDefinition, task.scenarioName, task.steps, task.featureDefinition.initial),
    Effect.as({
      name: task.scenarioName,
      steps: task.steps.length,
      tags: task.tags
    })
  )

const runSteps = <State, E, R>(
  featureDefinition: Feature<State, E, R>,
  scenario: string,
  steps: ReadonlyArray<Parser.ParsedStep>,
  state: State,
  index = 0
): Effect.Effect<State, RunError, R> =>
  index >= steps.length
    ? Effect.succeed(state)
    : pipe(
      runStep(featureDefinition, scenario, steps[index], state),
      Effect.flatMap((state) => runSteps(featureDefinition, scenario, steps, state, index + 1))
    )

const runStep = <State, E, R>(
  featureDefinition: Feature<State, E, R>,
  scenario: string,
  step: Parser.ParsedStep,
  state: State
): Effect.Effect<State, RunError, R> =>
  pipe(
    resolve(featureDefinition, scenario, step),
    Effect.flatMap(({ transition, captures }) =>
      pipe(
        decodeArgument(transition, scenario, step),
        Effect.flatMap((argument) =>
          pipe(
            transition.run(captures, argument, state),
            Effect.mapError((cause) =>
              new StepError({
                message: `Step failed: ${step.text}`,
                scenario,
                step: step.text,
                line: step.line,
                cause
              })
            )
          )
        )
      )
    )
  )

const scenarioSteps = (
  feature: Parser.Feature,
  scenario: Parser.Scenario
): ReadonlyArray<Parser.ParsedStep> => Arr.appendAll(feature.background?.steps ?? [], scenario.steps)

const decodeArgument = <State, E, R>(
  transition: Transition<State, E, R>,
  scenario: string,
  step: Parser.ParsedStep
): Effect.Effect<unknown, MatchError> => {
  const candidates = [transition.expression.source]
  if (transition.argument === undefined) {
    return hasStepArgument(step)
      ? failMatch(`Step "${step.text}" has an unexpected argument`, scenario, step, candidates)
      : Effect.succeed(undefined)
  }

  if (transition.argument._tag === "TableArg") {
    return step.table === undefined
      ? failMatch(`Step "${step.text}" requires a DataTable`, scenario, step, candidates)
      : pipe(
        transition.argument.decode(step.table),
        Effect.mapError((cause) =>
          matchError(`Could not decode DataTable for step "${step.text}"`, scenario, step, candidates, cause)
        )
      )
  }

  return step.docString === undefined
    ? failMatch(`Step "${step.text}" requires a DocString`, scenario, step, candidates)
    : pipe(
      transition.argument.decode(step.docString),
      Effect.mapError((cause) =>
        matchError(`Could not decode DocString for step "${step.text}"`, scenario, step, candidates, cause)
      )
    )
}

const resolve = <State, E, R>(
  featureDefinition: Feature<State, E, R>,
  scenario: string,
  step: Parser.ParsedStep
): Effect.Effect<ResolvedTransition<State, E, R>, MatchError> => {
  const matches = pipe(
    featureDefinition.transitions,
    Arr.map((transition): Option.Option<ResolvedTransition<State, E, R>> => {
      if (!keywordMatches(transition.kind, step.kind)) {
        return Option.none()
      }
      return pipe(
        transition.expression.match(step.text),
        Option.map((captures) => ({ transition, captures }))
      )
    }),
    Arr.getSomes
  )

  return pipe(
    matches,
    Arr.match({
      onEmpty: () =>
        failMatch(
          `No transition matched step "${step.text}"`,
          scenario,
          step,
          Arr.map(featureDefinition.transitions, (transition) => transition.expression.source)
        ),
      onNonEmpty: (matches) =>
        matches.length === 1
          ? Effect.succeed(Arr.headNonEmpty(matches))
          : failMatch(
            `Multiple transitions matched step "${step.text}"`,
            scenario,
            step,
            Arr.map(matches, (match) => match.transition.expression.source)
          )
    })
  )
}

const keywordMatches = (transition: StepKind, keyword: Parser.StepKind) => {
  if (transition === "Step") {
    return true
  }
  return transition === keyword
}

const rowObject = (
  headers: ReadonlyArray<string>,
  cells: ReadonlyArray<string>
): Record<string, string> =>
  pipe(
    headers,
    Arr.map((header, index) => [header, cells[index] ?? ""] as const),
    Record.fromEntries
  )

const hasStepArgument = (step: Parser.ParsedStep): boolean => step.table !== undefined || step.docString !== undefined

const failMatch = (
  message: string,
  scenario: string,
  step: Parser.ParsedStep,
  candidates: ReadonlyArray<string>,
  cause?: unknown
): Effect.Effect<never, MatchError> => Effect.fail(matchError(message, scenario, step, candidates, cause))

const matchError = (
  message: string,
  scenario: string,
  step: Parser.ParsedStep,
  candidates: ReadonlyArray<string>,
  cause?: unknown
): MatchError =>
  new MatchError({
    message,
    scenario,
    step: step.text,
    line: step.line,
    candidates,
    ...(cause === undefined ? {} : { cause })
  })
