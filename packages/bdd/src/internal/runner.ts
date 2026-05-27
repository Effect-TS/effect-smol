import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { MatchError, type ParseError, StepError } from "./errors.ts"
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
export interface Transition<State, E, R> {
  readonly kind: StepKind
  readonly expression: Matcher<any>
  readonly argument?: {
    readonly _tag: "TableArg" | "DocStringArg"
    readonly decode: (argument: any) => Effect.Effect<any, unknown>
  }
  readonly run: (captures: any, table: any, state: State) => Effect.Effect<State, E, R>
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
export const decodeTable = <S extends Schema.Top>(row: S) => {
  const decode = Schema.decodeUnknownEffect(row)
  return (table: Parser.DataTable): Effect.Effect<ReadonlyArray<Schema.Schema.Type<S>>, unknown> => {
    const [headers, ...rows] = table.rows
    if (headers === undefined) {
      return Effect.succeed([])
    }
    return Effect.forEach(rows, (cells: ReadonlyArray<string>) => decode(rowObject(headers, cells))) as any
  }
}

/** @internal */
export const decodeDocString = <S extends Schema.Top>(schema: S) => {
  const decode = Schema.decodeUnknownEffect(schema)
  return (docString: Parser.DocString): Effect.Effect<Schema.Schema.Type<S>, unknown> =>
    decode(docString.content) as any
}

/** @internal */
export const run = <State, E, R>(
  featureDefinition: Feature<State, E, R>,
  source: string
): Effect.Effect<Report, RunError, R> =>
  Effect.gen(function*() {
    const feature = yield* Parser.parse(source)
    const reports: Array<{ readonly name: string; readonly steps: number; readonly tags: ReadonlyArray<string> }> = []

    for (const scenario of feature.scenarios) {
      let state = featureDefinition.initial
      const steps = [...(feature.background?.steps ?? []), ...scenario.steps]
      for (const step of steps) {
        const resolved = yield* resolve(featureDefinition, scenario.name, step)
        const argument = yield* decodeArgument(resolved.transition, scenario.name, step)

        state = yield* Effect.mapError(
          resolved.transition.run(resolved.captures, argument, state),
          (cause) =>
            new StepError({
              message: `Step failed: ${step.text}`,
              scenario: scenario.name,
              step: step.text,
              line: step.line,
              cause
            })
        )
      }
      reports.push({
        name: scenario.name,
        steps: steps.length,
        tags: [...feature.tags, ...scenario.tags]
      })
    }

    return {
      feature: feature.name,
      scenarios: reports
    }
  })

const decodeArgument = <State, E, R>(
  transition: Transition<State, E, R>,
  scenario: string,
  step: Parser.ParsedStep
): Effect.Effect<any, MatchError> => {
  if (transition.argument === undefined) {
    if (step.table !== undefined || step.docString !== undefined) {
      return Effect.fail(
        new MatchError({
          message: `Step "${step.text}" has an unexpected argument`,
          scenario,
          step: step.text,
          line: step.line,
          candidates: [transition.expression.source]
        })
      )
    }
    return Effect.succeed(undefined)
  }

  if (transition.argument._tag === "TableArg") {
    if (step.table === undefined) {
      return Effect.fail(
        new MatchError({
          message: `Step "${step.text}" requires a DataTable`,
          scenario,
          step: step.text,
          line: step.line,
          candidates: [transition.expression.source]
        })
      )
    }
    return Effect.mapError(transition.argument.decode(step.table), () =>
      new MatchError({
        message: `Could not decode DataTable for step "${step.text}"`,
        scenario,
        step: step.text,
        line: step.line,
        candidates: [transition.expression.source]
      }))
  }

  if (step.docString === undefined) {
    return Effect.fail(
      new MatchError({
        message: `Step "${step.text}" requires a DocString`,
        scenario,
        step: step.text,
        line: step.line,
        candidates: [transition.expression.source]
      })
    )
  }
  return Effect.mapError(transition.argument.decode(step.docString), () =>
    new MatchError({
      message: `Could not decode DocString for step "${step.text}"`,
      scenario,
      step: step.text,
      line: step.line,
      candidates: [transition.expression.source]
    }))
}

const resolve = <State, E, R>(
  featureDefinition: Feature<State, E, R>,
  scenario: string,
  step: Parser.ParsedStep
): Effect.Effect<{
  readonly transition: Transition<State, E, R>
  readonly captures: unknown
}, MatchError> => {
  const matches: Array<{
    readonly transition: Transition<State, E, R>
    readonly captures: unknown
  }> = []

  for (const transition of featureDefinition.transitions) {
    if (!keywordMatches(transition.kind, step.kind)) {
      continue
    }
    const captures = transition.expression.match(step.text)
    if (Option.isSome(captures)) {
      matches.push({ transition, captures: captures.value })
    }
  }

  if (matches.length === 0) {
    return Effect.fail(
      new MatchError({
        message: `No transition matched step "${step.text}"`,
        scenario,
        step: step.text,
        line: step.line,
        candidates: featureDefinition.transitions.map((transition) => transition.expression.source)
      })
    )
  }

  if (matches.length > 1) {
    return Effect.fail(
      new MatchError({
        message: `Multiple transitions matched step "${step.text}"`,
        scenario,
        step: step.text,
        line: step.line,
        candidates: matches.map((match) => match.transition.expression.source)
      })
    )
  }

  const match = matches[0]
  return Effect.succeed(match)
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
): Record<string, string> => {
  const out: Record<string, string> = {}
  for (let i = 0; i < headers.length; i++) {
    out[headers[i]] = cells[i] ?? ""
  }
  return out
}
