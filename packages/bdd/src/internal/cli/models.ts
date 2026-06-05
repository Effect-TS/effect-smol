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
  readonly scenarioLine: number
  readonly ruleName?: string
  readonly ruleLine?: number
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
  readonly features: number
  readonly total: number
  readonly passed: number
  readonly failed: number
  readonly durationMillis: number
}

/** @internal */
export type CliDiagnostic =
  | {
    readonly _tag: "UnmatchedFeature"
    readonly featurePath: string
    readonly featureName: string
    readonly line: number
    readonly message: string
  }
  | {
    readonly _tag: "UnmatchedStep"
    readonly featurePath: string
    readonly featureName: string
    readonly scenarioName: string
    readonly scenarioLine: number
    readonly step: Parser.ParsedStep
    readonly reason: "NoMatch" | "MultipleMatches"
    readonly candidates: ReadonlyArray<string>
    readonly message: string
  }
  | {
    readonly _tag: "UnmatchedScenario"
    readonly featurePath: string
    readonly featureName: string
    readonly scenarioName: string
    readonly scenarioLine: number
    readonly message: string
  }
  | {
    readonly _tag: "UnusedFeatureDefinition"
    readonly featureName: string
    readonly message: string
  }
  | {
    readonly _tag: "UnusedStepDefinition"
    readonly featureName: string
    readonly expression: string
    readonly kind: string
    readonly message: string
  }

/** @internal */
export interface CliRunResult {
  readonly results: ReadonlyArray<ScenarioResult>
  readonly diagnostics: ReadonlyArray<CliDiagnostic>
  readonly summary: RunSummary
}

/** @internal */
export interface CliFilters {
  readonly tags: ReadonlyArray<string>
  readonly names: ReadonlyArray<string>
  readonly failFast: boolean
}

/** @internal */
export interface CliOptions {
  readonly features: ReadonlyArray<string>
  readonly steps: ReadonlyArray<string>
  readonly reporters: ReadonlyArray<ReporterName>
  readonly outputFiles: {
    readonly text?: string
    readonly html?: string
    readonly json?: string
    readonly junit?: string
  }
  readonly verbose: boolean
  readonly filters: CliFilters
  readonly parallel: number
}

/** @internal */
export type ReporterName = "text" | "html" | "json" | "junit"
