import * as Arr from "effect/Array"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import { pipe } from "effect/Function"
import * as Path from "effect/Path"
import * as Str from "effect/String"
import * as Parser from "../parser.ts"
import { ReporterError } from "./errors.ts"
import type { CliDiagnostic, CliRunResult, ReporterName, ScenarioResult } from "./models.ts"

/** @internal */
export interface Reporter {
  readonly name: ReporterName
  readonly emit: (
    result: CliRunResult
  ) => Effect.Effect<void, ReporterError, FileSystem.FileSystem | Path.Path>
}

/** @internal */
export const makeReporters = (
  names: ReadonlyArray<ReporterName>,
  outputFiles: {
    readonly text?: string
    readonly html?: string
    readonly json?: string
    readonly junit?: string
  },
  options: {
    readonly verbose: boolean
  }
): Effect.Effect<ReadonlyArray<Reporter>, ReporterError> =>
  Effect.forEach(names, (name) => {
    switch (name) {
      case "text": {
        return Effect.succeed(textReporter(outputFiles.text, options.verbose))
      }
      case "html": {
        return outputFiles.html === undefined
          ? Effect.fail(new ReporterError({ message: "Reporter html requires --output-file.html" }))
          : Effect.succeed(htmlReporter(outputFiles.html))
      }
      case "json": {
        return Effect.succeed(jsonReporter(outputFiles.json))
      }
      case "junit": {
        return outputFiles.junit === undefined
          ? Effect.fail(new ReporterError({ message: "Reporter junit requires --output-file.junit" }))
          : Effect.succeed(junitReporter(outputFiles.junit))
      }
    }
  })

/** @internal */
export const emitAll: (
  reporters: ReadonlyArray<Reporter>,
  result: CliRunResult
) => Effect.Effect<void, ReporterError, FileSystem.FileSystem | Path.Path> = Effect.fnUntraced(function*(
  reporters: ReadonlyArray<Reporter>,
  result: CliRunResult
) {
  const exits = yield* Effect.forEach(
    reporters,
    (reporter) => Effect.exit(reporter.emit(result)),
    { concurrency: "unbounded" }
  )
  const failures = pipe(
    exits,
    Arr.filter((exit) => exit._tag === "Failure"),
    Arr.map((exit) => exit.cause)
  )
  if (failures.length > 0) {
    return yield* Effect.fail(
      new ReporterError({
        message: "One or more reporters failed",
        cause: failures
      })
    )
  }
})

const textReporter = (outputFile: string | undefined, verbose: boolean): Reporter => ({
  name: "text",
  emit: (result) =>
    outputFile === undefined
      ? Console.log(renderText(result, verbose))
      : writeFile(outputFile, renderText(result, verbose))
})

const htmlReporter = (outputFile: string): Reporter => ({
  name: "html",
  emit: (result) => writeFile(outputFile, renderHtml(result))
})

const jsonReporter = (outputFile: string | undefined): Reporter => ({
  name: "json",
  emit: (result) =>
    outputFile === undefined
      ? Console.log(renderJson(result))
      : writeFile(outputFile, renderJson(result))
})

const junitReporter = (outputFile: string): Reporter => ({
  name: "junit",
  emit: (result) => writeFile(outputFile, renderJunit(result))
})

const writeFile: (
  outputFile: string,
  content: string
) => Effect.Effect<void, ReporterError, FileSystem.FileSystem | Path.Path> = Effect.fnUntraced(function*(
  outputFile: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const directory = path.dirname(outputFile)
  if (directory !== ".") {
    yield* fs.makeDirectory(directory, { recursive: true }).pipe(
      Effect.mapError((cause) =>
        new ReporterError({
          message: `Could not create report directory "${directory}"`,
          cause
        })
      )
    )
  }
  yield* fs.writeFileString(outputFile, content).pipe(
    Effect.mapError((cause) =>
      new ReporterError({
        message: `Could not write report file "${outputFile}"`,
        cause
      })
    )
  )
})

const renderText = (result: CliRunResult, verbose: boolean): string => {
  const summary = [
    `Features: ${result.summary.features}, Scenarios: ${result.summary.total}, passed: ${result.summary.passed}, failed: ${result.summary.failed}`,
    `Duration: ${result.summary.durationMillis}ms`,
    ""
  ]
  const scenarioLines = verbose
    ? Arr.map(result.results, renderScenarioText)
    : pipe(
      result.results,
      Arr.filter((scenario) => scenario.outcome._tag === "Failed"),
      Arr.map(renderScenarioText)
    )
  const diagnosticLines = renderDiagnosticsText(result.diagnostics)
  return pipe(
    summary,
    Arr.appendAll(scenarioLines),
    Arr.appendAll(diagnosticLines),
    Arr.join("\n")
  )
}

const renderScenarioText = (result: ScenarioResult): string => {
  const prefix = result.outcome._tag === "Passed" ? "PASS" : "FAIL"
  const base = `${prefix} ${result.task.featurePath}:${result.task.core.scenarioLine} ${
    renderScenarioName(result)
  } (${result.durationMillis}ms)`
  return result.outcome._tag === "Passed"
    ? base
    : `${base}\n  ${renderError(result.outcome.error)}`
}

const renderHtml = (result: CliRunResult): string =>
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>@effect/bdd report</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
      .passed { color: #166534; }
      .failed { color: #991b1b; }
    </style>
  </head>
  <body>
    <h1>@effect/bdd report</h1>
    <p>Features: ${result.summary.features}, scenarios: ${result.summary.total}, passed: ${result.summary.passed}, failed: ${result.summary.failed}</p>
    <p>Duration: ${result.summary.durationMillis}ms</p>
    <table>
      <thead>
        <tr><th>Status</th><th>Source</th><th>Feature</th><th>Scenario</th><th>Tags</th><th>Duration</th><th>Error</th></tr>
      </thead>
      <tbody>
${pipe(result.results, Arr.map(renderScenarioHtml), Arr.join("\n"))}
      </tbody>
    </table>
    <h2>Diagnostics</h2>
    <pre>${escapeHtml(pipe(renderDiagnosticsText(result.diagnostics), Arr.join("\n")))}</pre>
  </body>
</html>
`

const renderScenarioHtml = (result: ScenarioResult): string => {
  const status = result.outcome._tag === "Passed" ? "passed" : "failed"
  const error = result.outcome._tag === "Passed"
    ? ""
    : renderError(result.outcome.error)
  return `        <tr>
          <td class="${status}">${status}</td>
          <td>${escapeHtml(`${result.task.featurePath}:${result.task.core.scenarioLine}`)}</td>
          <td>${escapeHtml(result.task.core.featureName)}</td>
          <td>${escapeHtml(renderScenarioName(result))}</td>
          <td>${escapeHtml(pipe(result.task.core.tags, Arr.join(", ")))}</td>
          <td>${result.durationMillis}ms</td>
          <td>${escapeHtml(error)}</td>
        </tr>`
}

const renderDiagnosticsText = (diagnostics: ReadonlyArray<CliDiagnostic>): ReadonlyArray<string> => {
  if (diagnostics.length === 0) {
    return []
  }
  const unmatched = pipe(
    diagnostics,
    Arr.filter((diagnostic) =>
      diagnostic._tag === "UnmatchedFeature" ||
      diagnostic._tag === "UnmatchedScenario" ||
      diagnostic._tag === "UnmatchedStep"
    )
  )
  const unused = pipe(
    diagnostics,
    Arr.filter((diagnostic) =>
      diagnostic._tag === "UnusedFeatureDefinition" ||
      diagnostic._tag === "UnusedStepDefinition"
    )
  )
  return pipe(
    unmatched.length === 0 ? [] : ["", "Unmatched source:"],
    Arr.appendAll(Arr.map(unmatched, renderDiagnosticText)),
    Arr.appendAll(unused.length === 0 ? [] : ["", "Unused definitions:"]),
    Arr.appendAll(Arr.map(unused, renderDiagnosticText))
  )
}

const renderDiagnosticText = (diagnostic: CliDiagnostic): string => {
  switch (diagnostic._tag) {
    case "UnmatchedFeature": {
      return `  ${diagnostic.featurePath}:${diagnostic.line}\n    Feature: ${diagnostic.featureName}\n    Reason: ${diagnostic.message}`
    }
    case "UnmatchedScenario": {
      return `  ${diagnostic.featurePath}:${diagnostic.scenarioLine}\n    Scenario: ${diagnostic.scenarioName}\n    Reason: ${diagnostic.message}`
    }
    case "UnmatchedStep": {
      return `  ${diagnostic.featurePath}:${
        Parser.stepLine(diagnostic.step, diagnostic.source)
      }\n    Scenario: ${diagnostic.featureName} / ${diagnostic.scenarioName}\n    Step: ${
        Parser.stepKeyword(diagnostic.step, diagnostic.source)
      } ${diagnostic.step.text}\n    Reason: ${diagnostic.message}`
    }
    case "UnusedFeatureDefinition": {
      return `  ${diagnostic.message}`
    }
    case "UnusedStepDefinition": {
      return `  ${diagnostic.message}`
    }
  }
}

const renderJson = (result: CliRunResult): string =>
  JSON.stringify(
    {
      summary: result.summary,
      scenarios: Arr.map(result.results, (scenario) => ({
        source: {
          path: scenario.task.featurePath,
          line: scenario.task.core.scenarioLine
        },
        feature: scenario.task.core.featureName,
        rule: scenario.task.core.ruleName === undefined
          ? undefined
          : {
            name: scenario.task.core.ruleName,
            line: scenario.task.core.ruleLine
          },
        scenario: scenario.task.core.scenarioName,
        tags: scenario.task.core.tags,
        durationMillis: scenario.durationMillis,
        outcome: scenario.outcome._tag === "Passed"
          ? {
            status: "passed",
            steps: scenario.outcome.steps
          }
          : {
            status: "failed",
            error: renderError(scenario.outcome.error)
          }
      })),
      diagnostics: result.diagnostics
    },
    null,
    2
  )

const renderJunit = (result: CliRunResult): string => {
  const diagnostics = result.diagnostics.length
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="@effect/bdd" tests="${result.summary.total + diagnostics}" failures="${
    result.summary.failed + diagnostics
  }" time="${result.summary.durationMillis / 1000}">
${pipe(result.results, Arr.map(renderJunitScenario), Arr.join("\n"))}
${pipe(result.diagnostics, Arr.map(renderJunitDiagnostic), Arr.join("\n"))}
</testsuite>
`
}

const renderJunitScenario = (result: ScenarioResult): string => {
  const name = renderScenarioName(result)
  const failure = result.outcome._tag === "Passed"
    ? ""
    : `
    <failure message="${escapeXml(renderError(result.outcome.error))}">${
      escapeXml(renderError(result.outcome.error))
    }</failure>`
  return `  <testcase classname="${escapeXml(result.task.core.featureName)}" name="${escapeXml(name)}" file="${
    escapeXml(result.task.featurePath)
  }" line="${result.task.core.scenarioLine}" time="${result.durationMillis / 1000}">${failure}
  </testcase>`
}

const renderJunitDiagnostic = (diagnostic: CliDiagnostic): string =>
  `  <testcase classname="@effect/bdd diagnostics" name="${escapeXml(diagnostic.message)}">
    <failure message="${escapeXml(diagnostic.message)}">${escapeXml(renderDiagnosticText(diagnostic))}</failure>
  </testcase>`

const renderScenarioName = (result: ScenarioResult): string =>
  result.task.core.ruleName === undefined
    ? `${result.task.core.featureName} / ${result.task.core.scenarioName}`
    : `${result.task.core.featureName} / ${result.task.core.ruleName} / ${result.task.core.scenarioName}`

const renderError = (error: { readonly _tag: string; readonly message: string; readonly cause?: unknown }): string => {
  const cause = renderCause(error.cause)
  return cause === undefined
    ? `${error._tag}: ${error.message}`
    : `${error._tag}: ${error.message}\n  Cause: ${cause}`
}

const renderCause = (cause: unknown): string | undefined => {
  if (cause === undefined) {
    return undefined
  }
  if (typeof cause === "object" && cause !== null && "message" in cause && typeof cause.message === "string") {
    return cause.message
  }
  return String(cause)
}

const escapeHtml = (text: string): string =>
  pipe(
    text,
    Str.replaceAll("&", "&amp;"),
    Str.replaceAll("<", "&lt;"),
    Str.replaceAll(">", "&gt;"),
    Str.replaceAll("\"", "&quot;"),
    Str.replaceAll("'", "&#039;")
  )

const escapeXml = escapeHtml
