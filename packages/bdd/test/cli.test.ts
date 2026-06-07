import { NodeServices } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Cause, Effect, Exit, FileSystem, Option, Path } from "effect"
import * as CliError from "effect/unstable/cli/CliError"
import * as Command from "effect/unstable/cli/Command"
import { execFile } from "node:child_process"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFilePromise = promisify(execFile)

const runCli = (args: ReadonlyArray<string>) =>
  Effect.gen(function*() {
    const module = yield* loadMain
    return yield* Command.runWith(module.cli, { version: "0.0.0" })(args)
  })

const loadMain: Effect.Effect<{
  readonly cli: Command.Command<string, any, any, any, any>
}> = Effect.promise(() =>
  import(["../src", "main.ts"].join("/")) as Promise<{
    readonly cli: Command.Command<string, any, any, any, any>
  }>
)

describe("cli", () => {
  it.effect("runs through the Node bin entrypoint", () =>
    Effect.scoped(Effect.gen(function*() {
      const path = yield* Path.Path
      const bddRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
      const repoRoot = path.dirname(path.dirname(bddRoot))
      const fixtureRoot = path.join(bddRoot, "test", "fixtures")
      const result = yield* Effect.promise(() =>
        execFilePromise(process.execPath, [
          path.join(bddRoot, "src", "bin.ts"),
          "--features",
          path.join(fixtureRoot, "*.feature"),
          "--steps",
          path.join(fixtureRoot, "*.step.ts"),
          "--reporter",
          "text",
          "--parallel",
          "2"
        ], { cwd: repoRoot })
      )

      assert.match(result.stdout, /Features: 9, Scenarios: 27, passed: 27, failed: 0/)
      assert.strictEqual(/PASS .*fixtures/.test(result.stdout), false)
    })).pipe(Effect.provide(NodeServices.layer)))

  it.effect("runs checked-in feature and step fixtures", () =>
    Effect.scoped(Effect.gen(function*() {
      const path = yield* Path.Path
      const fixtureRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures")
      const textReport = yield* makeReportFile("e2e-report.txt")

      yield* runCli([
        "--features",
        path.join(fixtureRoot, "*.feature"),
        "--steps",
        path.join(fixtureRoot, "*.step.ts"),
        "--reporter",
        "text",
        "--output-file.text",
        textReport,
        "--verbose",
        "--parallel",
        "2"
      ])

      const fs = yield* FileSystem.FileSystem
      const text = yield* fs.readFileString(textReport)

      assert.match(text, /Features: 9, Scenarios: 27, passed: 27, failed: 0/)
      assert.match(text, /Minimal \/ minimalistic/)
      assert.match(text, /Some rules \/ A \/ Example A/)
      assert.match(text, /DocString variations \/ minimalistic/)
      assert.match(text, /Effect BDD kitchen sink \/ Checkout totals \/ capture totals include tax/)
      assert.match(text, /Effect BDD kitchen sink \/ Checkout totals \/ outline examples start from initial state/)
    })).pipe(Effect.provide(NodeServices.layer)))

  it.effect("runs repeated feature and step globs with text and html reporters", () =>
    Effect.scoped(Effect.gen(function*() {
      const fixture = yield* makeFixture({
        feature: `
Feature: Counter

  Scenario: Increment
    When increment
    Then the counter is 1

  Scenario: Starts clean
    Then the counter is 0
`,
        steps: counterSteps
      })

      const textReport = fixture.path("report.txt")
      const htmlReport = fixture.path("report.html")

      yield* runCli([
        "--features",
        fixture.path("*.feature"),
        "--steps",
        fixture.path("*.mjs"),
        "--reporter",
        "text",
        "--reporter",
        "html",
        "--output-file.text",
        textReport,
        "--output-file.html",
        htmlReport,
        "--verbose",
        "--parallel",
        "2"
      ]).pipe(Effect.provide(NodeServices.layer))

      const fs = yield* FileSystem.FileSystem
      const text = yield* fs.readFileString(textReport)
      const html = yield* fs.readFileString(htmlReport)

      assert.match(text, /Features: 1, Scenarios: 2, passed: 2, failed: 0/)
      assert.strictEqual(text.indexOf("Increment"), text.lastIndexOf("Increment"))
      assert.ok(text.indexOf("Increment") < text.indexOf("Starts clean"))
      assert.match(html, /@effect\/bdd report/)
      assert.match(html, /Starts clean/)
    })).pipe(Effect.provide(NodeServices.layer)))

  it.effect("emits reports before failing the command when a scenario fails", () =>
    Effect.scoped(Effect.gen(function*() {
      const fixture = yield* makeFixture({
        feature: `
Feature: Counter

  Scenario: Fails
    Then the counter is 1
`,
        steps: counterSteps
      })
      const textReport = fixture.path("failure.txt")

      const exit = yield* Effect.exit(
        runCli([
          "--features",
          fixture.path("*.feature"),
          "--steps",
          fixture.path("*.mjs"),
          "--reporter",
          "text",
          "--output-file.text",
          textReport
        ]).pipe(Effect.provide(NodeServices.layer))
      )

      assert.strictEqual(Exit.isFailure(exit), true)

      const fs = yield* FileSystem.FileSystem
      const text = yield* fs.readFileString(textReport)

      assert.match(text, /Features: 1, Scenarios: 1, passed: 0, failed: 1/)
      assert.match(text, /FAIL .*counter\.feature:\d+ Counter \/ Fails/)
      assert.match(text, /Cause: expected 1, got 0/)
    })).pipe(Effect.provide(NodeServices.layer)))

  it.effect("reports unmatched feature files and unused feature definitions", () =>
    Effect.scoped(Effect.gen(function*() {
      const fixture = yield* makeFixture({
        feature: `
Feature: Missing source

  Scenario: Cannot run
    Then the counter is 0
`,
        steps: counterSteps
      })
      const textReport = fixture.path("unmatched-feature.txt")

      const exit = yield* Effect.exit(
        runCli([
          "--features",
          fixture.path("*.feature"),
          "--steps",
          fixture.path("*.mjs"),
          "--reporter",
          "text",
          "--output-file.text",
          textReport
        ]).pipe(Effect.provide(NodeServices.layer))
      )

      assert.strictEqual(Exit.isFailure(exit), true)

      const fs = yield* FileSystem.FileSystem
      const text = yield* fs.readFileString(textReport)

      assert.match(text, /Unmatched source:/)
      assert.match(text, /Feature: Missing source/)
      assert.match(text, /Scenario: Cannot run/)
      assert.match(text, /Unused definitions:/)
      assert.match(text, /Feature definition exported but no feature file matched: Counter/)
    })).pipe(Effect.provide(NodeServices.layer)))

  it.effect("reports unmatched source steps", () =>
    Effect.scoped(Effect.gen(function*() {
      const fixture = yield* makeFixture({
        feature: `
Feature: Counter

  Scenario: Unknown step
    Then a missing transition runs
`,
        steps: counterSteps
      })
      const textReport = fixture.path("unmatched-step.txt")

      const exit = yield* Effect.exit(
        runCli([
          "--features",
          fixture.path("*.feature"),
          "--steps",
          fixture.path("*.mjs"),
          "--reporter",
          "text",
          "--output-file.text",
          textReport
        ]).pipe(Effect.provide(NodeServices.layer))
      )

      assert.strictEqual(Exit.isFailure(exit), true)

      const fs = yield* FileSystem.FileSystem
      const text = yield* fs.readFileString(textReport)

      assert.match(text, /FAIL .*counter\.feature:\d+ Counter \/ Unknown step/)
      assert.match(text, /Unmatched source:/)
      assert.match(text, /Step: Then a missing transition runs/)
      assert.match(text, /Reason: No transition matched step "a missing transition runs"/)
    })).pipe(Effect.provide(NodeServices.layer)))

  it.effect("reports source steps that only match a different keyword", () =>
    Effect.scoped(Effect.gen(function*() {
      const fixture = yield* makeFixture({
        feature: `
Feature: Counter

  Scenario: Wrong keyword
    Given increment
`,
        steps: counterSteps
      })
      const textReport = fixture.path("wrong-keyword.txt")

      const exit = yield* Effect.exit(
        runCli([
          "--features",
          fixture.path("*.feature"),
          "--steps",
          fixture.path("*.mjs"),
          "--reporter",
          "text",
          "--output-file.text",
          textReport
        ]).pipe(Effect.provide(NodeServices.layer))
      )

      assert.strictEqual(Exit.isFailure(exit), true)

      const fs = yield* FileSystem.FileSystem
      const text = yield* fs.readFileString(textReport)

      assert.match(text, /FAIL .*counter\.feature:\d+ Counter \/ Wrong keyword/)
      assert.match(text, /Step: Given increment/)
      assert.match(text, /Reason: No Given transition matched step "increment"; matching text exists for When/)
    })).pipe(Effect.provide(NodeServices.layer)))

  it.effect("filters scenarios by tag expression", () =>
    Effect.scoped(Effect.gen(function*() {
      const fixture = yield* makeFixture({
        feature: `
Feature: Counter

  @fast
  Scenario: Increment
    When increment
    Then the counter is 1

  @slow
  Scenario: Starts clean
    Then a missing transition runs
`,
        steps: counterSteps
      })
      const textReport = fixture.path("tags.txt")

      yield* runCli([
        "--features",
        fixture.path("*.feature"),
        "--steps",
        fixture.path("*.mjs"),
        "--reporter",
        "text",
        "--output-file.text",
        textReport,
        "--tags",
        "@fast and not @slow",
        "--verbose"
      ]).pipe(Effect.provide(NodeServices.layer))

      const fs = yield* FileSystem.FileSystem
      const text = yield* fs.readFileString(textReport)

      assert.match(text, /Features: 1, Scenarios: 1, passed: 1, failed: 0/)
      assert.match(text, /Increment/)
      assert.strictEqual(/Starts clean/.test(text), false)
      assert.strictEqual(/Unmatched source/.test(text), false)
    })).pipe(Effect.provide(NodeServices.layer)))

  it.effect("filters scenarios by name", () =>
    Effect.scoped(Effect.gen(function*() {
      const fixture = yield* makeFixture({
        feature: `
Feature: Counter

  Scenario: Increment
    When increment
    Then the counter is 1

  Scenario: Starts clean
    Then the counter is 0
`,
        steps: counterSteps
      })
      const textReport = fixture.path("name.txt")

      yield* runCli([
        "--features",
        fixture.path("*.feature"),
        "--steps",
        fixture.path("*.mjs"),
        "--reporter",
        "text",
        "--output-file.text",
        textReport,
        "--name",
        "Starts",
        "--verbose"
      ]).pipe(Effect.provide(NodeServices.layer))

      const fs = yield* FileSystem.FileSystem
      const text = yield* fs.readFileString(textReport)

      assert.match(text, /Features: 1, Scenarios: 1, passed: 1, failed: 0/)
      assert.match(text, /Starts clean/)
      assert.strictEqual(/Increment/.test(text), false)
    })).pipe(Effect.provide(NodeServices.layer)))

  it.effect("stops after the first failure with fail-fast", () =>
    Effect.scoped(Effect.gen(function*() {
      const fixture = yield* makeFixture({
        feature: `
Feature: Counter

  Scenario: Fails first
    Then the counter is 1

  Scenario: Fails later
    Then the counter is 2
`,
        steps: counterSteps
      })
      const textReport = fixture.path("fail-fast.txt")

      const exit = yield* Effect.exit(
        runCli([
          "--features",
          fixture.path("*.feature"),
          "--steps",
          fixture.path("*.mjs"),
          "--reporter",
          "text",
          "--output-file.text",
          textReport,
          "--fail-fast",
          "--verbose"
        ]).pipe(Effect.provide(NodeServices.layer))
      )

      assert.strictEqual(Exit.isFailure(exit), true)

      const fs = yield* FileSystem.FileSystem
      const text = yield* fs.readFileString(textReport)

      assert.match(text, /Features: 1, Scenarios: 1, passed: 0, failed: 1/)
      assert.match(text, /Fails first/)
      assert.strictEqual(/Fails later/.test(text), false)
    })).pipe(Effect.provide(NodeServices.layer)))

  it.effect("writes json and junit reports", () =>
    Effect.scoped(Effect.gen(function*() {
      const fixture = yield* makeFixture({
        feature: `
Feature: Counter

  Scenario: Increment
    When increment
    Then the counter is 1

  Scenario: Starts clean
    Then the counter is 0
`,
        steps: counterSteps
      })
      const jsonReport = fixture.path("report.json")
      const junitReport = fixture.path("report.xml")

      yield* runCli([
        "--features",
        fixture.path("*.feature"),
        "--steps",
        fixture.path("*.mjs"),
        "--reporter",
        "json",
        "--reporter",
        "junit",
        "--output-file.json",
        jsonReport,
        "--output-file.junit",
        junitReport
      ]).pipe(Effect.provide(NodeServices.layer))

      const fs = yield* FileSystem.FileSystem
      const json = yield* fs.readFileString(jsonReport)
      const junit = yield* fs.readFileString(junitReport)

      assert.match(json, /"summary"/)
      assert.match(json, /"status": "passed"/)
      assert.match(junit, /<testsuite name="@effect\/bdd"/)
      assert.match(junit, /<testcase classname="Counter"/)
    })).pipe(Effect.provide(NodeServices.layer)))

  it.effect("fails when multiple step modules export the same feature definition", () =>
    Effect.scoped(Effect.gen(function*() {
      const fixture = yield* makeFixture({
        feature: `
Feature: Counter

  Scenario: Starts clean
    Then the counter is 0
`,
        steps: counterSteps
      })
      const fs = yield* FileSystem.FileSystem
      yield* fs.writeFileString(fixture.path("duplicate.mjs"), counterSteps)

      const exit = yield* Effect.exit(
        runCli([
          "--features",
          fixture.path("*.feature"),
          "--steps",
          fixture.path("*.mjs"),
          "--reporter",
          "text",
          "--output-file.text",
          fixture.path("duplicate.txt")
        ]).pipe(Effect.provide(NodeServices.layer))
      )

      assert.strictEqual(Exit.isFailure(exit), true)
      if (Exit.isFailure(exit)) {
        const error = Option.getOrThrow(Cause.findErrorOption(exit.cause))
        assert.strictEqual(error instanceof CliError.UserError, true)
        assert.match(String((error as CliError.UserError).cause), /Multiple feature definitions matched/)
      }
    })).pipe(Effect.provide(NodeServices.layer)))

  it.effect("surfaces the underlying reason when a step module fails to load", () =>
    Effect.scoped(Effect.gen(function*() {
      const fixture = yield* makeFixture({
        feature: `
Feature: Counter

  Scenario: Starts clean
    Then the counter is 0
`,
        steps: `throw new Error("boom while importing step module")`
      })

      const exit = yield* Effect.exit(
        runCli([
          "--features",
          fixture.path("*.feature"),
          "--steps",
          fixture.path("steps.mjs"),
          "--reporter",
          "text",
          "--output-file.text",
          fixture.path("load-error.txt")
        ]).pipe(Effect.provide(NodeServices.layer))
      )

      assert.strictEqual(Exit.isFailure(exit), true)
      if (Exit.isFailure(exit)) {
        const error = Option.getOrThrow(Cause.findErrorOption(exit.cause))
        assert.strictEqual(error instanceof CliError.UserError, true)
        const cause = String((error as CliError.UserError).cause)
        assert.match(cause, /Could not load step module/)
        assert.match(cause, /boom while importing step module/)
      }
    })).pipe(Effect.provide(NodeServices.layer)))

  it.effect("requires an output file for the html reporter", () =>
    Effect.scoped(Effect.gen(function*() {
      const fixture = yield* makeFixture({
        feature: `
Feature: Counter

  Scenario: Starts clean
    Then the counter is 0
`,
        steps: counterSteps
      })

      const exit = yield* Effect.exit(
        runCli([
          "--features",
          fixture.path("*.feature"),
          "--steps",
          fixture.path("*.mjs"),
          "--reporter",
          "html"
        ]).pipe(Effect.provide(NodeServices.layer))
      )

      assert.strictEqual(Exit.isFailure(exit), true)
      if (Exit.isFailure(exit)) {
        const error = Option.getOrThrow(Cause.findErrorOption(exit.cause))
        assert.strictEqual(error instanceof CliError.UserError, true)
      }
    })).pipe(Effect.provide(NodeServices.layer)))
})

const makeReportFile = Effect.fnUntraced(function*(name: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const directory = yield* fs.makeTempDirectoryScoped({
    directory: path.dirname(fileURLToPath(import.meta.url)),
    prefix: ".effect-bdd-report-"
  })
  return path.join(directory, name)
})

const makeFixture = Effect.fnUntraced(function*(options: {
  readonly feature: string
  readonly steps: string
}) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const directory = yield* fs.makeTempDirectoryScoped({
    directory: path.dirname(fileURLToPath(import.meta.url)),
    prefix: ".effect-bdd-"
  })
  yield* fs.writeFileString(path.join(directory, "counter.feature"), options.feature)
  yield* fs.writeFileString(path.join(directory, "steps.mjs"), options.steps)
  return {
    path: (name: string) => path.join(directory, name)
  }
})

const counterSteps = `
import { Bdd } from "@effect/bdd"
import { Effect, Schema } from "effect"

const expected = Bdd.capture("expected", Schema.NumberFromString)

export const counter = Bdd.feature("Counter", { initial: 0 }).pipe(
  Bdd.when\`increment\`((_captures, state) => Effect.succeed(state + 1)),
  Bdd.then\`the counter is \${expected}\`(({ expected }, state) =>
    state === expected
      ? Effect.succeed(state)
      : Effect.fail(\`expected \${expected}, got \${state}\`)
  )
)
`
