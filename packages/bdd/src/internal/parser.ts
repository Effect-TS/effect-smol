import * as Arr from "effect/Array"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as Str from "effect/String"
import { ParseError } from "./errors.ts"

/** @internal */
export type Keyword = "Given" | "When" | "Then" | "And" | "But"

/** @internal */
export type StepKind = "Given" | "When" | "Then"

/** @internal */
export interface DataTable {
  readonly rows: ReadonlyArray<ReadonlyArray<string>>
  readonly line: number
}

/** @internal */
export interface DocString {
  readonly content: string
  readonly contentType: string | undefined
  readonly line: number
}

/** @internal */
export interface ParsedStep {
  readonly keyword: Keyword
  readonly kind: StepKind
  readonly text: string
  readonly line: number
  readonly table?: DataTable
  readonly docString?: DocString
}

/** @internal */
export interface Background {
  readonly description: string
  readonly line: number
  readonly steps: ReadonlyArray<ParsedStep>
  readonly tags: ReadonlyArray<string>
}

/** @internal */
export interface Scenario {
  readonly name: string
  readonly description: string
  readonly line: number
  readonly steps: ReadonlyArray<ParsedStep>
  readonly tags: ReadonlyArray<string>
}

/** @internal */
export interface Feature {
  readonly name: string
  readonly description: string
  readonly line: number
  readonly background?: Background
  readonly scenarios: ReadonlyArray<Scenario>
  readonly tags: ReadonlyArray<string>
}

interface ScenarioBuilder {
  readonly name: string
  readonly description: ReadonlyArray<string>
  readonly line: number
  readonly steps: ReadonlyArray<ParsedStep>
  readonly tags: ReadonlyArray<string>
}

interface BackgroundBuilder {
  readonly description: ReadonlyArray<string>
  readonly line: number
  readonly steps: ReadonlyArray<ParsedStep>
  readonly tags: ReadonlyArray<string>
}

interface FeatureBuilder {
  readonly name: string
  readonly description: ReadonlyArray<string>
  readonly line: number
  readonly tags: ReadonlyArray<string>
}

type Active =
  | { readonly _tag: "Background"; readonly background: BackgroundBuilder }
  | { readonly _tag: "Scenario"; readonly scenario: ScenarioBuilder }

interface ParseState {
  readonly feature: FeatureBuilder | undefined
  readonly background: BackgroundBuilder | undefined
  readonly scenarios: ReadonlyArray<ScenarioBuilder>
  readonly active: Active | undefined
  readonly lastStep: ParsedStep | undefined
  readonly lastConcreteKind: StepKind | undefined
  readonly pendingTags: ReadonlyArray<string>
}

interface LineResult {
  readonly state: ParseState
  readonly nextIndex: number
}

const featureRegex = /^Feature:\s*(.*)$/
const backgroundRegex = /^Background:\s*(.*)$/
const scenarioRegex = /^Scenario:\s*(.*)$/
const stepRegex = /^(Given|When|Then|And|But)\s+(.*)$/

/** @internal */
export const parse = (source: string): Effect.Effect<Feature, ParseError> =>
  pipe(
    source,
    Str.replace(/\r\n?/g, "\n"),
    Str.split("\n"),
    (lines) => parseLines(lines, 0, initialState),
    Effect.flatMap(finalizeFeature)
  )

const initialState: ParseState = {
  feature: undefined,
  background: undefined,
  scenarios: [],
  active: undefined,
  lastStep: undefined,
  lastConcreteKind: undefined,
  pendingTags: []
}

const parseLines = (
  lines: ReadonlyArray<string>,
  index: number,
  state: ParseState
): Effect.Effect<ParseState, ParseError> =>
  index >= lines.length
    ? Effect.succeed(closeActive(state))
    : pipe(
      parseLine(lines, index, state),
      Effect.flatMap(({ state, nextIndex }) => parseLines(lines, nextIndex, state))
    )

const parseLine = (
  lines: ReadonlyArray<string>,
  index: number,
  state: ParseState
): Effect.Effect<LineResult, ParseError> => {
  const lineNumber = index + 1
  const nextIndex = index + 1
  const raw = lines[index]
  const line = Str.trim(raw)
  const next = (state: ParseState, nextIndex = index + 1): LineResult => ({ state, nextIndex })

  if (Str.isEmpty(line) || pipe(line, Str.startsWith("#"))) {
    return Effect.succeed(next(state))
  }

  if (pipe(line, Str.startsWith("\"\"\""))) {
    if (state.lastStep === undefined) {
      return parseError("DocString found before a step", lineNumber, raw.indexOf("\"\"\"") + 1)
    }
    if (state.lastStep.table !== undefined || state.lastStep.docString !== undefined) {
      return parseError("Step already has an argument", lineNumber, raw.indexOf("\"\"\"") + 1)
    }
    return pipe(
      parseDocString(lines, index, lineNumber, raw),
      Effect.flatMap(({ docString, nextIndex }) =>
        pipe(
          updateLastStep(state, lineNumber, raw.indexOf("\"\"\"") + 1, (step) => withDocString(step, docString)),
          Effect.map((state) => next(state, nextIndex + 1))
        )
      )
    )
  }

  if (pipe(line, Str.startsWith("|"))) {
    if (state.lastStep === undefined) {
      return parseError("DataTable found before a step", lineNumber, raw.indexOf("|") + 1)
    }
    if (state.lastStep.docString !== undefined) {
      return parseError("Step already has an argument", lineNumber, raw.indexOf("|") + 1)
    }
    return pipe(
      updateLastStep(state, lineNumber, raw.indexOf("|") + 1, (step) => withTableRow(step, line, lineNumber)),
      Effect.map((state) => next(state))
    )
  }

  if (pipe(line, Str.startsWith("@"))) {
    const tags = parseTags(line)
    const closed = closeActive(state)
    return tags === undefined
      ? parseError(`Malformed tag line: ${line}`, lineNumber, 1)
      : Effect.succeed(next({
        ...closed,
        lastStep: undefined,
        pendingTags: Arr.appendAll(closed.pendingTags, tags)
      }))
  }

  return pipe(
    parseFeatureLine(state, line, lineNumber, raw, nextIndex),
    Option.orElse(() => parseAfterFeature(state, line, lineNumber, raw, nextIndex)),
    Option.match({
      onNone: () => parseError(`Unexpected Gherkin line: ${line}`, lineNumber, 1),
      onSome: (effect) => effect
    })
  )
}

const parseAfterFeature = (
  state: ParseState,
  line: string,
  lineNumber: number,
  raw: string,
  nextIndex: number
): Option.Option<Effect.Effect<LineResult, ParseError>> => {
  if (state.feature === undefined) {
    return Option.some(parseError("Expected a Feature declaration", lineNumber, 1))
  }

  const unsupported = unsupportedKeyword(line)
  if (unsupported !== undefined) {
    return Option.some(
      parseError(`${unsupported} is not supported in @effect/bdd v1`, lineNumber, raw.indexOf(unsupported) + 1)
    )
  }

  return pipe(
    parseBackgroundLine(state, line, lineNumber, raw, nextIndex),
    Option.orElse(() => parseScenarioLine(state, line, lineNumber, nextIndex)),
    Option.orElse(() => parseStepLine(state, line, lineNumber, raw, nextIndex)),
    Option.orElse(() => parseDescriptionLine(state, line, nextIndex))
  )
}

const parseFeatureLine = (
  state: ParseState,
  line: string,
  lineNumber: number,
  raw: string,
  nextIndex: number
): Option.Option<Effect.Effect<LineResult, ParseError>> =>
  pipe(
    line,
    Str.match(featureRegex),
    Option.map((match) =>
      state.feature !== undefined
        ? parseError("Feature declared more than once", lineNumber, raw.indexOf("Feature:") + 1)
        : Effect.succeed({
          state: {
            ...state,
            feature: {
              name: Str.trim(match[1]),
              description: [],
              line: lineNumber,
              tags: state.pendingTags
            },
            pendingTags: []
          },
          nextIndex
        })
    )
  )

const parseBackgroundLine = (
  state: ParseState,
  line: string,
  lineNumber: number,
  raw: string,
  nextIndex: number
): Option.Option<Effect.Effect<LineResult, ParseError>> =>
  pipe(
    line,
    Str.match(backgroundRegex),
    Option.map(() => {
      const closed = closeActive(state)
      if (closed.background !== undefined) {
        return parseError("Background declared more than once", lineNumber, raw.indexOf("Background:") + 1)
      }
      if (closed.scenarios.length > 0) {
        return parseError("Background must be declared before Scenario", lineNumber, raw.indexOf("Background:") + 1)
      }
      return Effect.succeed({
        state: {
          ...closed,
          active: {
            _tag: "Background",
            background: {
              description: [],
              line: lineNumber,
              steps: [],
              tags: closed.pendingTags
            }
          },
          lastStep: undefined,
          lastConcreteKind: undefined,
          pendingTags: []
        },
        nextIndex
      })
    })
  )

const parseScenarioLine = (
  state: ParseState,
  line: string,
  lineNumber: number,
  nextIndex: number
): Option.Option<Effect.Effect<LineResult, ParseError>> =>
  pipe(
    line,
    Str.match(scenarioRegex),
    Option.map((match) => {
      const closed = closeActive(state)
      return Effect.succeed({
        state: {
          ...closed,
          active: {
            _tag: "Scenario",
            scenario: {
              name: Str.trim(match[1]),
              description: [],
              line: lineNumber,
              steps: [],
              tags: closed.pendingTags
            }
          },
          lastStep: undefined,
          lastConcreteKind: undefined,
          pendingTags: []
        },
        nextIndex
      })
    })
  )

const parseStepLine = (
  state: ParseState,
  line: string,
  lineNumber: number,
  raw: string,
  nextIndex: number
): Option.Option<Effect.Effect<LineResult, ParseError>> =>
  pipe(
    line,
    Str.match(stepRegex),
    Option.map((match) => {
      if (state.active === undefined) {
        return parseError("Step found before a Scenario or Background", lineNumber, raw.indexOf(match[1]) + 1)
      }

      const keyword = match[1] as Keyword
      const kind = effectiveKind(keyword, state.lastConcreteKind)
      if (kind === undefined) {
        return parseError(`${keyword} found before a Given, When, or Then step`, lineNumber, raw.indexOf(keyword) + 1)
      }

      const step: ParsedStep = {
        keyword,
        kind,
        text: Str.trim(match[2]),
        line: lineNumber
      }

      return Effect.succeed({
        state: appendStep(state, step),
        nextIndex
      })
    })
  )

const parseDescriptionLine = (
  state: ParseState,
  line: string,
  nextIndex: number
): Option.Option<Effect.Effect<LineResult, ParseError>> => {
  if (state.active !== undefined && activeHasNoSteps(state.active)) {
    return Option.some(Effect.succeed({
      state: updateActiveDescription(state, line),
      nextIndex
    }))
  }
  if (
    state.feature !== undefined && state.active === undefined && state.background === undefined &&
    state.scenarios.length === 0
  ) {
    return Option.some(Effect.succeed({
      state: {
        ...state,
        feature: {
          ...state.feature,
          description: Arr.append(state.feature.description, line)
        }
      },
      nextIndex
    }))
  }
  return Option.none()
}

const finalizeFeature = (state: ParseState): Effect.Effect<Feature, ParseError> => {
  if (state.feature === undefined) {
    return parseError("Expected a Feature declaration", 1, 1)
  }
  if (state.scenarios.length === 0) {
    return parseError("Expected at least one Scenario", state.feature.line, 1)
  }

  return Effect.succeed({
    name: state.feature.name,
    description: joinDescription(state.feature.description),
    line: state.feature.line,
    ...(state.background === undefined ? {} : {
      background: {
        description: joinDescription(state.background.description),
        line: state.background.line,
        steps: state.background.steps,
        tags: state.background.tags
      }
    }),
    scenarios: Arr.map(state.scenarios, (scenario) => ({
      ...scenario,
      description: joinDescription(scenario.description)
    })),
    tags: state.feature.tags
  })
}

const closeActive = (state: ParseState): ParseState => {
  if (state.active === undefined) {
    return state
  }
  if (state.active._tag === "Background") {
    return {
      ...state,
      background: state.active.background,
      active: undefined,
      lastStep: undefined,
      lastConcreteKind: undefined
    }
  }
  return {
    ...state,
    scenarios: Arr.append(state.scenarios, state.active.scenario),
    active: undefined,
    lastStep: undefined,
    lastConcreteKind: undefined
  }
}

const appendStep = (state: ParseState, step: ParsedStep): ParseState => {
  if (state.active?._tag === "Background") {
    return {
      ...state,
      active: {
        _tag: "Background",
        background: {
          ...state.active.background,
          steps: Arr.append(state.active.background.steps, step)
        }
      },
      lastStep: step,
      lastConcreteKind: step.kind
    }
  }
  if (state.active?._tag === "Scenario") {
    return {
      ...state,
      active: {
        _tag: "Scenario",
        scenario: {
          ...state.active.scenario,
          steps: Arr.append(state.active.scenario.steps, step)
        }
      },
      lastStep: step,
      lastConcreteKind: step.kind
    }
  }
  return state
}

const updateLastStep = (
  state: ParseState,
  lineNumber: number,
  column: number,
  f: (step: ParsedStep) => ParsedStep
): Effect.Effect<ParseState, ParseError> => {
  if (state.lastStep === undefined || state.active === undefined) {
    return parseError("Step argument found before a step", lineNumber, column)
  }
  return Effect.succeed(replaceLastStep(state, f(state.lastStep)))
}

const replaceLastStep = (state: ParseState, step: ParsedStep): ParseState => {
  if (state.active?._tag === "Background") {
    return {
      ...state,
      active: {
        _tag: "Background",
        background: {
          ...state.active.background,
          steps: replaceLast(state.active.background.steps, step)
        }
      },
      lastStep: step
    }
  }
  if (state.active?._tag === "Scenario") {
    return {
      ...state,
      active: {
        _tag: "Scenario",
        scenario: {
          ...state.active.scenario,
          steps: replaceLast(state.active.scenario.steps, step)
        }
      },
      lastStep: step
    }
  }
  return state
}

const replaceLast = <A>(self: ReadonlyArray<A>, value: A): ReadonlyArray<A> =>
  Arr.map(self, (item, index) => index === self.length - 1 ? value : item)

const activeHasNoSteps = (active: Active): boolean =>
  active._tag === "Background" ? active.background.steps.length === 0 : active.scenario.steps.length === 0

const updateActiveDescription = (state: ParseState, line: string): ParseState => {
  if (state.active?._tag === "Background") {
    return {
      ...state,
      active: {
        _tag: "Background",
        background: {
          ...state.active.background,
          description: Arr.append(state.active.background.description, line)
        }
      }
    }
  }
  if (state.active?._tag === "Scenario") {
    return {
      ...state,
      active: {
        _tag: "Scenario",
        scenario: {
          ...state.active.scenario,
          description: Arr.append(state.active.scenario.description, line)
        }
      }
    }
  }
  return state
}

const withTableRow = (step: ParsedStep, line: string, lineNumber: number): ParsedStep => {
  const row = parseTableRow(line)
  return {
    ...step,
    table: step.table === undefined
      ? { rows: [row], line: lineNumber }
      : { ...step.table, rows: Arr.append(step.table.rows, row) }
  }
}

const withDocString = (step: ParsedStep, docString: DocString): ParsedStep => ({
  ...step,
  docString
})

const parseTableRow = (line: string): ReadonlyArray<string> => {
  const body = pipe(line, Str.endsWith("|")) ? line.slice(1, -1) : line.slice(1)
  return pipe(body, Str.split("|"), Arr.map(Str.trim))
}

const unsupportedKeyword = (line: string): string | undefined => {
  if (pipe(line, Str.startsWith("Scenario Outline:"))) return "Scenario Outline"
  if (pipe(line, Str.startsWith("Rule:"))) return "Rule"
  return undefined
}

const effectiveKind = (keyword: Keyword, previous: StepKind | undefined): StepKind | undefined => {
  if (keyword === "And" || keyword === "But") {
    return previous
  }
  return keyword
}

const parseTags = (line: string): ReadonlyArray<string> | undefined => {
  const tags = pipe(line, Str.split(/\s+/))
  return Arr.every(tags, (tag) => /^@[A-Za-z0-9][A-Za-z0-9_-]*$/.test(tag)) ? tags : undefined
}

const joinDescription = (lines: ReadonlyArray<string>): string => Arr.join(lines, "\n")

const parseError = (message: string, line: number, column: number): Effect.Effect<never, ParseError> =>
  Effect.fail(new ParseError({ message, line, column }))

const parseDocString = (
  lines: ReadonlyArray<string>,
  startIndex: number,
  lineNumber: number,
  raw: string
): Effect.Effect<{
  readonly docString: DocString
  readonly nextIndex: number
}, ParseError> => {
  const opening = Str.trim(raw)
  const mediaType = Str.trim(opening.slice(3))
  const contentType = Str.isEmpty(mediaType) ? undefined : mediaType
  return collectDocString(lines, startIndex + 1, [], lineNumber, raw.indexOf("\"\"\"") + 1, contentType)
}

const collectDocString = (
  lines: ReadonlyArray<string>,
  index: number,
  content: ReadonlyArray<string>,
  lineNumber: number,
  column: number,
  contentType: string | undefined
): Effect.Effect<{
  readonly docString: DocString
  readonly nextIndex: number
}, ParseError> => {
  if (index >= lines.length) {
    return parseError("Unterminated DocString", lineNumber, column)
  }

  const line = lines[index]
  return pipe(Str.trim(line), Str.startsWith("\"\"\""))
    ? Effect.succeed({
      docString: {
        content: pipe(dedent(content), Arr.join("\n")),
        contentType,
        line: lineNumber
      },
      nextIndex: index
    })
    : collectDocString(lines, index + 1, Arr.append(content, line), lineNumber, column, contentType)
}

const dedent = (lines: ReadonlyArray<string>): ReadonlyArray<string> => {
  const nonEmpty = Arr.filter(lines, (line) => !Str.isEmpty(Str.trim(line)))
  if (nonEmpty.length === 0) {
    return []
  }
  const indent = Arr.reduce(nonEmpty, Number.POSITIVE_INFINITY, (min, line) => Math.min(min, indentation(line)))
  return Arr.map(lines, (line) => line.slice(indent))
}

const indentation = (line: string): number =>
  pipe(
    line,
    Str.match(/^ */),
    Option.map((match) => match[0].length),
    Option.getOrElse(() => 0)
  )
