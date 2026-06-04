import type * as Bdd from "../../Bdd.ts"
import type * as Parser from "../parser.ts"

/** @internal */
export interface FeatureSource {
  readonly path: string
  readonly source: string
}

/** @internal */
export interface FeatureDefinitionRef {
  readonly name: string
  readonly definition: Bdd.Feature<unknown, unknown, never>
}

/** @internal */
export interface ScenarioTask {
  readonly featurePath: string
  readonly featureName: string
  readonly scenarioName: string
  readonly scenarioIndex: number
  readonly tags: ReadonlyArray<string>
  readonly steps: ReadonlyArray<Parser.ParsedStep>
  readonly definition: Bdd.Feature<unknown, unknown, never>
}

/** @internal */
export type ScenarioOutcome =
  | {
    readonly _tag: "Passed"
    readonly steps: number
  }
  | {
    readonly _tag: "Failed"
    readonly error: Bdd.RunError
  }

/** @internal */
export interface ScenarioResult {
  readonly task: ScenarioTask
  readonly outcome: ScenarioOutcome
  readonly durationMillis: number
}

/** @internal */
export interface RunSummary {
  readonly total: number
  readonly passed: number
  readonly failed: number
  readonly durationMillis: number
}

/** @internal */
export interface CliRunResult {
  readonly results: ReadonlyArray<ScenarioResult>
  readonly summary: RunSummary
}

/** @internal */
export interface CliOptions {
  readonly features: ReadonlyArray<string>
  readonly steps: ReadonlyArray<string>
  readonly reporters: ReadonlyArray<ReporterName>
  readonly outputFiles: {
    readonly text?: string
    readonly html?: string
  }
  readonly parallel: number
}

/** @internal */
export type ReporterName = "text" | "html"
