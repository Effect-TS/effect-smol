import type { Pickle, PickleDocString, PickleStep, PickleTable } from "@cucumber/messages"
import * as Arr from "effect/Array"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as Record from "effect/Record"
import * as Schema from "effect/Schema"
import { MatchError, ParseError, StepError } from "../Errors.ts"
import * as Matching from "./matching.ts"
import * as Parser from "./parser.ts"

/** @internal */
export type DataTableInput = PickleTable

/** @internal */
export type DocStringInput = PickleDocString

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
export type GherkinCompiler = Parser.GherkinCompiler

/** @internal */
export interface ScenarioTask<State, E, R> {
  readonly featureDefinition: Feature<State, E, R>
  readonly featureName: string
  readonly scenarioName: string
  readonly scenarioIndex: number
  readonly scenarioLine: number
  readonly ruleName?: string
  readonly ruleLine?: number
  readonly tags: ReadonlyArray<string>
  readonly pickle: Pickle
  readonly source: Parser.SourceIndex
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
  return (table: PickleTable): Effect.Effect<ReadonlyArray<S["Type"]>, unknown> => {
    const [headers, ...rows] = table.rows.map((row) => row.cells.map((cell) => cell.value))
    if (headers === undefined) {
      return Effect.succeed([])
    }
    return Effect.forEach(rows, (cells: ReadonlyArray<string>) => decode(rowObject(headers, cells)))
  }
}

/** @internal */
export const decodeDocString = <S extends Schema.Decoder<unknown, never>>(schema: S) => {
  const decode = Schema.decodeUnknownEffect(schema)
  return (docString: PickleDocString): Effect.Effect<S["Type"], unknown> => decode(docString.content)
}

/** @internal */
export const run = <State, E, R>(
  featureDefinition: Feature<State, E, R>,
  source: string
): Effect.Effect<Report, RunError, R | Parser.GherkinCompiler> =>
  pipe(
    Parser.parse(source),
    Effect.flatMap((feature) =>
      pipe(
        validateFeatureDefinition(featureDefinition, feature),
        Effect.flatMap(() => Effect.forEach(buildScenarioTasks(featureDefinition, feature), runScenarioTask)),
        Effect.map((scenarios): Report => ({
          feature: feature.name,
          scenarios
        }))
      )
    )
  )

const validateFeatureDefinition = <State, E, R>(
  featureDefinition: Feature<State, E, R>,
  feature: Parser.CompiledFeature
): Effect.Effect<void, MatchError> =>
  featureDefinition.name === feature.name
    ? Effect.void
    : Effect.fail(
      new MatchError({
        message: `Feature definition "${featureDefinition.name}" does not match Gherkin feature "${feature.name}"`,
        scenario: "",
        step: feature.name,
        line: feature.line,
        candidates: [featureDefinition.name]
      })
    )

/** @internal */
export const buildScenarioTasks = <State, E, R>(
  featureDefinition: Feature<State, E, R>,
  feature: Parser.CompiledFeature
): ReadonlyArray<ScenarioTask<State, E, R>> =>
  Arr.map(feature.pickles, (pickle, scenarioIndex): ScenarioTask<State, E, R> => {
    const source = Parser.findScenario(pickle, feature.source)
    const rule = pipe(
      source,
      Option.map(({ rule }) => rule),
      Option.getOrUndefined
    )
    return {
      featureDefinition,
      featureName: feature.name,
      scenarioName: pickle.name,
      scenarioIndex,
      scenarioLine: pickle.location?.line ?? pipe(
        source,
        Option.map(({ scenario }) => scenario.location.line),
        Option.getOrElse(() => feature.line)
      ),
      ...(rule === undefined ? {} : {
        ruleName: rule.name,
        ruleLine: rule.location.line
      }),
      tags: pickle.tags.map((tag) => tag.name),
      pickle,
      source: feature.source
    }
  })

/** @internal */
export const runScenarioTask = <State, E, R>(
  task: ScenarioTask<State, E, R>
): Effect.Effect<ScenarioReport, RunError, R> =>
  pipe(
    runSteps(task.featureDefinition, task.scenarioName, task.pickle.steps, task.source, task.featureDefinition.initial),
    Effect.as({
      name: task.scenarioName,
      steps: task.pickle.steps.length,
      tags: task.tags
    })
  )

const runSteps = <State, E, R>(
  featureDefinition: Feature<State, E, R>,
  scenario: string,
  steps: ReadonlyArray<PickleStep>,
  source: Parser.SourceIndex,
  state: State,
  index = 0
): Effect.Effect<State, RunError, R> =>
  index >= steps.length
    ? Effect.succeed(state)
    : pipe(
      runStep(featureDefinition, scenario, steps[index], source, state),
      Effect.flatMap((state) => runSteps(featureDefinition, scenario, steps, source, state, index + 1))
    )

const runStep = <State, E, R>(
  featureDefinition: Feature<State, E, R>,
  scenario: string,
  step: PickleStep,
  source: Parser.SourceIndex,
  state: State
): Effect.Effect<State, RunError, R> =>
  pipe(
    stepKind(step, source),
    Effect.flatMap((kind) =>
      pipe(
        resolve(featureDefinition, scenario, step, kind, source),
        Effect.flatMap(({ transition, captures }) =>
          pipe(
            decodeArgument(transition, scenario, step, source),
            Effect.flatMap((argument) =>
              pipe(
                transition.run(captures, argument, state),
                Effect.mapError((cause) =>
                  new StepError({
                    message: `Step failed: ${step.text}`,
                    scenario,
                    step: step.text,
                    line: Parser.stepLine(step, source),
                    cause
                  })
                )
              )
            )
          )
        )
      )
    )
  )

const decodeArgument = <State, E, R>(
  transition: Transition<State, E, R>,
  scenario: string,
  step: PickleStep,
  source: Parser.SourceIndex
): Effect.Effect<unknown, MatchError> => {
  const candidates = [transition.expression.source]
  if (transition.argument === undefined) {
    return hasStepArgument(step)
      ? failMatch(`Step "${step.text}" has an unexpected argument`, scenario, step, source, candidates)
      : Effect.succeed(undefined)
  }

  if (transition.argument._tag === "TableArg") {
    return step.argument?.dataTable === undefined
      ? failMatch(`Step "${step.text}" requires a DataTable`, scenario, step, source, candidates)
      : pipe(
        transition.argument.decode(step.argument.dataTable),
        Effect.mapError((cause) =>
          matchError(`Could not decode DataTable for step "${step.text}"`, scenario, step, source, candidates, cause)
        )
      )
  }

  return step.argument?.docString === undefined
    ? failMatch(`Step "${step.text}" requires a DocString`, scenario, step, source, candidates)
    : pipe(
      transition.argument.decode(step.argument.docString),
      Effect.mapError((cause) =>
        matchError(`Could not decode DocString for step "${step.text}"`, scenario, step, source, candidates, cause)
      )
    )
}

const resolve = <State, E, R>(
  featureDefinition: Feature<State, E, R>,
  scenario: string,
  step: PickleStep,
  kind: "Given" | "When" | "Then",
  source: Parser.SourceIndex
): Effect.Effect<ResolvedTransition<State, E, R>, MatchError> => {
  const textMatches = Matching.matchingTextTransitions(featureDefinition.transitions, step.text)
  const matches = Matching.matchingKeywordTransitions(textMatches, kind)

  return pipe(
    matches,
    Arr.match({
      onEmpty: () =>
        textMatches.length === 0
          ? failMatch(
            `No transition matched step "${step.text}"`,
            scenario,
            step,
            source,
            Arr.map(featureDefinition.transitions, (transition) => transition.expression.source)
          )
          : failMatch(
            `No ${kind} transition matched step "${step.text}"; matching text exists for ${
              Matching.renderTransitionKinds(Arr.map(textMatches, (match) => match.transition))
            }`,
            scenario,
            step,
            source,
            Arr.map(textMatches, (match) => match.transition.expression.source)
          ),
      onNonEmpty: (matches) =>
        matches.length === 1
          ? Effect.succeed(Arr.headNonEmpty(matches))
          : failMatch(
            `Multiple transitions matched step "${step.text}"`,
            scenario,
            step,
            source,
            Arr.map(matches, (match) => match.transition.expression.source)
          )
    })
  )
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

const hasStepArgument = (step: PickleStep): boolean => step.argument !== undefined

const stepKind = (
  step: PickleStep,
  source: Parser.SourceIndex
): Effect.Effect<"Given" | "When" | "Then", ParseError> =>
  pipe(
    Matching.concreteStepKind(step),
    Option.match({
      onNone: () =>
        Effect.fail(
          new ParseError({
            message: `${Parser.stepKeyword(step, source)} found before a Given, When, or Then step`,
            line: Parser.stepLine(step, source),
            column: 1
          })
        ),
      onSome: Effect.succeed
    })
  )

const failMatch = (
  message: string,
  scenario: string,
  step: PickleStep,
  source: Parser.SourceIndex,
  candidates: ReadonlyArray<string>,
  cause?: unknown
): Effect.Effect<never, MatchError> => Effect.fail(matchError(message, scenario, step, source, candidates, cause))

const matchError = (
  message: string,
  scenario: string,
  step: PickleStep,
  source: Parser.SourceIndex,
  candidates: ReadonlyArray<string>,
  cause?: unknown
): MatchError =>
  new MatchError({
    message,
    scenario,
    step: step.text,
    line: Parser.stepLine(step, source),
    candidates,
    ...(cause === undefined ? {} : { cause })
  })
