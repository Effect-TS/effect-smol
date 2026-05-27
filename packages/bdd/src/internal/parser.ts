import * as Effect from "effect/Effect"
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
  table?: DataTable
  docString?: DocString
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
  readonly description: Array<string>
  readonly line: number
  readonly steps: Array<ParsedStep>
  readonly tags: ReadonlyArray<string>
}

interface BackgroundBuilder {
  readonly description: Array<string>
  readonly line: number
  readonly steps: Array<ParsedStep>
  readonly tags: ReadonlyArray<string>
}

const featureRegex = /^Feature:\s*(.*)$/
const backgroundRegex = /^Background:\s*(.*)$/
const scenarioRegex = /^Scenario:\s*(.*)$/
const stepRegex = /^(Given|When|Then|And|But)\s+(.*)$/

/** @internal */
export const parse = (source: string): Effect.Effect<Feature, ParseError> => {
  const lines = source.replace(/\r\n?/g, "\n").split("\n")
  let feature: { name: string; line: number; description: Array<string>; tags: ReadonlyArray<string> } | undefined
  let background: BackgroundBuilder | undefined
  const scenarios: Array<ScenarioBuilder> = []
  let currentScenario: ScenarioBuilder | undefined
  let lastStep: ParsedStep | undefined
  let lastConcreteKind: StepKind | undefined
  let pendingTags: Array<string> = []

  for (let index = 0; index < lines.length; index++) {
    const lineNumber = index + 1
    const raw = lines[index]
    const line = raw.trim()
    if (line === "" || line.startsWith("#")) {
      continue
    }

    if (line.startsWith("\"\"\"")) {
      if (lastStep === undefined) {
        return parseError("DocString found before a step", lineNumber, raw.indexOf("\"\"\"") + 1)
      }
      if (lastStep.table !== undefined || lastStep.docString !== undefined) {
        return parseError("Step already has an argument", lineNumber, raw.indexOf("\"\"\"") + 1)
      }
      const result = parseDocString(lines, index, lineNumber, raw)
      if (result._tag === "Left") {
        return Effect.fail(result.left)
      }
      lastStep.docString = result.right.docString
      index = result.right.nextIndex
      continue
    }

    if (line.startsWith("|")) {
      if (lastStep === undefined) {
        return parseError("DataTable found before a step", lineNumber, raw.indexOf("|") + 1)
      }
      if (lastStep.docString !== undefined) {
        return parseError("Step already has an argument", lineNumber, raw.indexOf("|") + 1)
      }
      const row = parseTableRow(line)
      if (lastStep.table === undefined) {
        lastStep.table = { rows: [row], line: lineNumber }
      } else {
        lastStep.table = { ...lastStep.table, rows: [...lastStep.table.rows, row] }
      }
      continue
    }

    if (line.startsWith("@")) {
      const tags = parseTags(line)
      if (tags === undefined) {
        return parseError(`Malformed tag line: ${line}`, lineNumber, 1)
      }
      pendingTags.push(...tags)
      lastStep = undefined
      continue
    }

    const featureMatch = featureRegex.exec(line)
    if (featureMatch !== null) {
      if (feature !== undefined) {
        return parseError("Feature declared more than once", lineNumber, raw.indexOf("Feature:") + 1)
      }
      feature = { name: featureMatch[1].trim(), line: lineNumber, description: [], tags: pendingTags }
      pendingTags = []
      continue
    }

    if (feature === undefined) {
      return parseError("Expected a Feature declaration", lineNumber, 1)
    }

    const unsupported = unsupportedKeyword(line)
    if (unsupported !== undefined) {
      return parseError(`${unsupported} is not supported in @effect/bdd v1`, lineNumber, raw.indexOf(unsupported) + 1)
    }

    const backgroundMatch = backgroundRegex.exec(line)
    if (backgroundMatch !== null) {
      if (background !== undefined) {
        return parseError("Background declared more than once", lineNumber, raw.indexOf("Background:") + 1)
      }
      if (scenarios.length > 0) {
        return parseError("Background must be declared before Scenario", lineNumber, raw.indexOf("Background:") + 1)
      }
      background = { description: [], line: lineNumber, steps: [], tags: pendingTags }
      pendingTags = []
      currentScenario = undefined
      lastStep = undefined
      lastConcreteKind = undefined
      continue
    }

    const scenarioMatch = scenarioRegex.exec(line)
    if (scenarioMatch !== null) {
      currentScenario = {
        name: scenarioMatch[1].trim(),
        description: [],
        line: lineNumber,
        steps: [],
        tags: pendingTags
      }
      scenarios.push(currentScenario)
      pendingTags = []
      lastStep = undefined
      lastConcreteKind = undefined
      continue
    }

    const stepMatch = stepRegex.exec(line)
    if (stepMatch !== null) {
      const target = currentScenario ?? background
      if (target === undefined) {
        return parseError("Step found before a Scenario or Background", lineNumber, raw.indexOf(stepMatch[1]) + 1)
      }
      const keyword = stepMatch[1] as Keyword
      const kind = effectiveKind(keyword, lastConcreteKind)
      if (kind === undefined) {
        return parseError(`${keyword} found before a Given, When, or Then step`, lineNumber, raw.indexOf(keyword) + 1)
      }
      const step: ParsedStep = {
        keyword,
        kind,
        text: stepMatch[2].trim(),
        line: lineNumber
      }
      target.steps.push(step)
      lastStep = step
      lastConcreteKind = kind
      continue
    }

    if (currentScenario !== undefined && currentScenario.steps.length === 0) {
      currentScenario.description.push(line)
      continue
    }
    if (background !== undefined && currentScenario === undefined && background.steps.length === 0) {
      background.description.push(line)
      continue
    }
    if (scenarios.length === 0 && background === undefined) {
      feature.description.push(line)
      continue
    }

    return parseError(`Unexpected Gherkin line: ${line}`, lineNumber, 1)
  }

  if (feature === undefined) {
    return parseError("Expected a Feature declaration", 1, 1)
  }
  if (scenarios.length === 0) {
    return parseError("Expected at least one Scenario", feature.line, 1)
  }

  const parsedFeature: Feature = {
    name: feature.name,
    description: joinDescription(feature.description),
    line: feature.line,
    ...(background === undefined ? {} : {
      background: {
        description: joinDescription(background.description),
        line: background.line,
        steps: background.steps,
        tags: background.tags
      }
    }),
    scenarios: scenarios.map((scenario) => ({
      ...scenario,
      description: joinDescription(scenario.description)
    })),
    tags: feature.tags
  }
  return Effect.succeed(parsedFeature)
}

const parseTableRow = (line: string): ReadonlyArray<string> => {
  const body = line.endsWith("|") ? line.slice(1, -1) : line.slice(1)
  return body.split("|").map((cell) => cell.trim())
}

const unsupportedKeyword = (line: string): string | undefined => {
  if (line.startsWith("Scenario Outline:")) return "Scenario Outline"
  if (line.startsWith("Rule:")) return "Rule"
  return undefined
}

const effectiveKind = (keyword: Keyword, previous: StepKind | undefined): StepKind | undefined => {
  if (keyword === "And" || keyword === "But") {
    return previous
  }
  return keyword
}

const parseTags = (line: string): ReadonlyArray<string> | undefined => {
  const tags = line.split(/\s+/)
  return tags.every((tag) => /^@[A-Za-z0-9][A-Za-z0-9_-]*$/.test(tag)) ? tags : undefined
}

const joinDescription = (lines: ReadonlyArray<string>): string => lines.join("\n")

const parseError = (message: string, line: number, column: number): Effect.Effect<never, ParseError> =>
  Effect.fail(new ParseError({ message, line, column }))

const parseDocString = (
  lines: ReadonlyArray<string>,
  startIndex: number,
  lineNumber: number,
  raw: string
): { readonly _tag: "Left"; readonly left: ParseError } | {
  readonly _tag: "Right"
  readonly right: {
    readonly docString: DocString
    readonly nextIndex: number
  }
} => {
  const opening = raw.trim()
  const contentType = opening.slice(3).trim() || undefined
  const content: Array<string> = []
  for (let index = startIndex + 1; index < lines.length; index++) {
    const line = lines[index]
    if (line.trim().startsWith("\"\"\"")) {
      return {
        _tag: "Right",
        right: {
          docString: {
            content: dedent(content).join("\n"),
            contentType,
            line: lineNumber
          },
          nextIndex: index
        }
      }
    }
    content.push(line)
  }
  return {
    _tag: "Left",
    left: new ParseError({
      message: "Unterminated DocString",
      line: lineNumber,
      column: raw.indexOf("\"\"\"") + 1
    })
  }
}

const dedent = (lines: ReadonlyArray<string>): ReadonlyArray<string> => {
  const nonEmpty = lines.filter((line) => line.trim() !== "")
  if (nonEmpty.length === 0) {
    return []
  }
  const indent = Math.min(...nonEmpty.map((line) => line.match(/^ */)?.[0].length ?? 0))
  return lines.map((line) => line.slice(indent))
}
