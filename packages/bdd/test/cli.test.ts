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
      const fixtureRoot = path.join(bddRoot, "test", "e2e")
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

      assert.match(result.stdout, /Scenarios: 4, passed: 4, failed: 0/)
    })).pipe(Effect.provide(NodeServices.layer)))

  it.effect("runs checked-in e2e feature and step fixtures", () =>
    Effect.scoped(Effect.gen(function*() {
      const path = yield* Path.Path
      const fixtureRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "e2e")
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
        "--parallel",
        "2"
      ])

      const fs = yield* FileSystem.FileSystem
      const text = yield* fs.readFileString(textReport)

      assert.match(text, /Scenarios: 4, passed: 4, failed: 0/)
      assert.match(text, /CLI account access \/ Allows an active account/)
      assert.match(text, /CLI account access \/ Denies a locked account/)
      assert.match(text, /CLI shopping cart \/ Adds one item from captures/)
      assert.match(text, /CLI shopping cart \/ Adds multiple items from a DataTable/)
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
        "--parallel",
        "2"
      ]).pipe(Effect.provide(NodeServices.layer))

      const fs = yield* FileSystem.FileSystem
      const text = yield* fs.readFileString(textReport)
      const html = yield* fs.readFileString(htmlReport)

      assert.match(text, /Scenarios: 2, passed: 2, failed: 0/)
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

      assert.match(text, /Scenarios: 1, passed: 0, failed: 1/)
      assert.match(text, /FAIL Counter \/ Fails/)
      assert.match(text, /Cause: expected 1, got 0/)
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
