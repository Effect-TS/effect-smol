import * as Arr from "effect/Array"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import { pipe } from "effect/Function"
import * as Path from "effect/Path"
import * as Str from "effect/String"
import { ReporterError } from "./errors.ts"
import type { CliRunResult, ReporterName, ScenarioResult } from "./models.ts"

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
  }
): Effect.Effect<ReadonlyArray<Reporter>, ReporterError> =>
  Effect.forEach(names, (name) => {
    switch (name) {
      case "text": {
        return Effect.succeed(textReporter(outputFiles.text))
      }
      case "html": {
        return outputFiles.html === undefined
          ? Effect.fail(new ReporterError({ message: "Reporter html requires --output-file.html" }))
          : Effect.succeed(htmlReporter(outputFiles.html))
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

const textReporter = (outputFile: string | undefined): Reporter => ({
  name: "text",
  emit: (result) =>
    outputFile === undefined
      ? Console.log(renderText(result))
      : writeFile(outputFile, renderText(result))
})

const htmlReporter = (outputFile: string): Reporter => ({
  name: "html",
  emit: (result) => writeFile(outputFile, renderHtml(result))
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

const renderText = (result: CliRunResult): string => {
  const summary = [
    `Scenarios: ${result.summary.total}, passed: ${result.summary.passed}, failed: ${result.summary.failed}`,
    `Duration: ${result.summary.durationMillis}ms`,
    ""
  ]
  return pipe(
    summary,
    Arr.appendAll(pipe(result.results, Arr.map(renderScenarioText))),
    Arr.join("\n")
  )
}

const renderScenarioText = (result: ScenarioResult): string => {
  const prefix = result.outcome._tag === "Passed" ? "PASS" : "FAIL"
  const base = `${prefix} ${result.task.featureName} / ${result.task.scenarioName} (${result.durationMillis}ms)`
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
    <p>Scenarios: ${result.summary.total}, passed: ${result.summary.passed}, failed: ${result.summary.failed}</p>
    <p>Duration: ${result.summary.durationMillis}ms</p>
    <table>
      <thead>
        <tr><th>Status</th><th>Feature</th><th>Scenario</th><th>Tags</th><th>Duration</th><th>Error</th></tr>
      </thead>
      <tbody>
${pipe(result.results, Arr.map(renderScenarioHtml), Arr.join("\n"))}
      </tbody>
    </table>
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
          <td>${escapeHtml(result.task.featureName)}</td>
          <td>${escapeHtml(result.task.scenarioName)}</td>
          <td>${escapeHtml(pipe(result.task.tags, Arr.join(", ")))}</td>
          <td>${result.durationMillis}ms</td>
          <td>${escapeHtml(error)}</td>
        </tr>`
}

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
