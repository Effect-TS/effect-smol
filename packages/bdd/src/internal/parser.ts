import type {
  Background as CucumberBackground,
  GherkinDocument,
  Pickle,
  Rule as CucumberRule,
  Scenario as CucumberScenario,
  Step as CucumberStep
} from "@cucumber/messages"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import { ParseError } from "../Errors.ts"

/** @internal */
export type Keyword = "Given" | "When" | "Then" | "And" | "But" | "*"

/** @internal */
export interface CompiledFeature {
  readonly name: string
  readonly line: number
  readonly pickles: ReadonlyArray<Pickle>
  readonly source: SourceIndex
}

/** @internal */
export interface ParsedSource {
  readonly document: GherkinDocument
  readonly pickles: ReadonlyArray<Pickle>
}

/** @internal */
export class GherkinCompiler extends Context.Service<GherkinCompiler, {
  readonly compile: (source: string, uri: string) => Effect.Effect<ParsedSource, ParseError>
}>()("@effect/bdd/GherkinCompiler") {}

/** @internal */
export interface SourceIndex {
  readonly steps: ReadonlyMap<string, CucumberStep>
  readonly scenarios: ReadonlyMap<string, {
    readonly scenario: CucumberScenario
    readonly rule: CucumberRule | undefined
  }>
}

/** @internal */
export const parse = (source: string, uri = "<inline>"): Effect.Effect<CompiledFeature, ParseError, GherkinCompiler> =>
  Effect.flatMap(GherkinCompiler, (compiler) => pipe(compiler.compile(source, uri), Effect.flatMap(toFeature)))

const toFeature: (parsed: ParsedSource) => Effect.Effect<CompiledFeature, ParseError> = Effect.fnUntraced(function*(
  parsed
) {
  const feature = parsed.document.feature
  if (feature === undefined) {
    return yield* parseError("Expected a Feature declaration", 1, 1)
  }
  if (parsed.pickles.length === 0) {
    return yield* parseError("Expected at least one Scenario", feature.location.line, feature.location.column ?? 1)
  }

  const source = indexDocument(parsed.document)
  return {
    name: feature.name,
    line: feature.location.line,
    pickles: parsed.pickles,
    source
  }
})

const indexDocument = (document: GherkinDocument): SourceIndex => {
  const steps = new Map<string, CucumberStep>()
  const scenarios = new Map<string, { readonly scenario: CucumberScenario; readonly rule: CucumberRule | undefined }>()
  const feature = document.feature
  if (feature === undefined) {
    return { steps, scenarios }
  }
  for (const child of feature.children) {
    if (child.background !== undefined) {
      indexBackground(steps, child.background)
    }
    if (child.scenario !== undefined) {
      indexScenario(steps, scenarios, child.scenario, undefined)
    }
    if (child.rule !== undefined) {
      for (const ruleChild of child.rule.children) {
        if (ruleChild.background !== undefined) {
          indexBackground(steps, ruleChild.background)
        }
        if (ruleChild.scenario !== undefined) {
          indexScenario(steps, scenarios, ruleChild.scenario, child.rule)
        }
      }
    }
  }
  return { steps, scenarios }
}

const indexBackground = (steps: Map<string, CucumberStep>, background: CucumberBackground): void => {
  for (const step of background.steps) {
    steps.set(step.id, step)
  }
}

const indexScenario = (
  steps: Map<string, CucumberStep>,
  scenarios: Map<string, { readonly scenario: CucumberScenario; readonly rule: CucumberRule | undefined }>,
  scenario: CucumberScenario,
  rule: CucumberRule | undefined
): void => {
  scenarios.set(scenario.id, { scenario, rule })
  for (const step of scenario.steps) {
    steps.set(step.id, step)
  }
}

/** @internal */
export const findScenario = (pickle: Pickle, index: SourceIndex) =>
  pipe(
    pickle.astNodeIds,
    Option.liftPredicate((ids): ids is ReadonlyArray<string> => ids.length > 0),
    Option.flatMap(() => Option.fromNullishOr(pickle.astNodeIds.find((id) => index.scenarios.has(id)))),
    Option.flatMap((id) => Option.fromNullishOr(index.scenarios.get(id)))
  )

/** @internal */
export const findStep = (
  pickleStep: { readonly astNodeIds: ReadonlyArray<string> },
  index: SourceIndex
): CucumberStep | undefined =>
  pickleStep.astNodeIds
    .map((id) => index.steps.get(id))
    .find((step) => step !== undefined)

/** @internal */
export const stepLine = (
  step: { readonly astNodeIds: ReadonlyArray<string> },
  index: SourceIndex
): number => findStep(step, index)?.location.line ?? 1

/** @internal */
export const stepKeyword = (
  step: { readonly astNodeIds: ReadonlyArray<string> },
  index: SourceIndex
): Keyword => {
  const source = findStep(step, index)
  return source === undefined ? "Given" : normalizeKeyword(source.keyword)
}

const normalizeKeyword = (keyword: string): Keyword => {
  const trimmed = keyword.trim()
  return trimmed === "*" ? "*" : trimmed as Keyword
}

const parseError = (message: string, line: number, column: number): Effect.Effect<never, ParseError> =>
  Effect.fail(new ParseError({ message, line, column }))
