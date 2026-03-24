import * as NodeServices from "@effect/platform-node/NodeServices"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Stdio } from "effect"
import { TestConsole } from "effect/testing"
import { CliOutput } from "effect/unstable/cli"

const makeLayer = (args: ReadonlyArray<string>) =>
  Layer.mergeAll(
    TestConsole.layer,
    CliOutput.layer(CliOutput.defaultFormatter({ colors: false })),
    NodeServices.layer,
    Stdio.layerTest({ args: Effect.succeed(args) })
  )

const fixturePath = (fileName: string) => `${import.meta.dirname}/fixtures/${fileName}`

const runCli = Effect.fnUntraced(function*(args: ReadonlyArray<string>) {
  const module = yield* Effect.promise(() => import(new URL("../src/main.ts", import.meta.url).href))
  const run = module.run as Effect.Effect<void>
  return yield* Effect.gen(function*() {
    yield* run.pipe(Effect.ignore)
    const stdoutLines = yield* TestConsole.logLines
    const stderrLines = yield* TestConsole.errorLines
    const stdout = stdoutLines.length > 0 ? String(stdoutLines[stdoutLines.length - 1]) : ""
    const stderr = stderrLines.map(String).join("\n")
    return { stdout, stderr } as const
  }).pipe(Effect.provide(makeLayer(args)))
})

describe("openapigen CLI", () => {
  it.effect("routes --format values and defaults to httpclient", () =>
    Effect.gen(function*() {
      const spec = fixturePath("cli-basic-spec.json")

      const defaultResult = yield* runCli(["--spec", spec, "--name", "CliClient"])
      const httpclientResult = yield* runCli([
        "--spec",
        spec,
        "--name",
        "CliClient",
        "--format",
        "httpclient"
      ])
      const typeOnlyResult = yield* runCli([
        "--spec",
        spec,
        "--name",
        "CliClient",
        "--format",
        "httpclient-type-only"
      ])
      const httpapiResult = yield* runCli([
        "--spec",
        spec,
        "--name",
        "CliClient",
        "--format",
        "httpapi"
      ])

      assert.strictEqual(defaultResult.stderr, "")
      assert.strictEqual(httpclientResult.stderr, "")
      assert.strictEqual(typeOnlyResult.stderr, "")
      assert.strictEqual(httpapiResult.stderr, "")

      assert.strictEqual(defaultResult.stdout, httpclientResult.stdout)
      assert.include(httpclientResult.stdout, "import * as Schema from \"effect/Schema\"")
      assert.notInclude(typeOnlyResult.stdout, "import * as Schema from \"effect/Schema\"")
      assert.include(typeOnlyResult.stdout, "import type * as HttpClient from \"effect/unstable/http/HttpClient\"")
      assert.include(httpapiResult.stdout, "export class CliClient extends HttpApi.make(\"CliClient\") {}")
    }))

  it.effect("rejects legacy --type-only flag", () =>
    Effect.gen(function*() {
      const spec = fixturePath("cli-basic-spec.json")
      const result = yield* runCli(["--spec", spec, "--name", "CliClient", "--type-only"])

      assert.include(result.stdout, "USAGE")
      assert.include(result.stderr, "Unrecognized flag: --type-only")
    }))

  it.effect("writes warnings to stderr and keeps stdout as generated source", () =>
    Effect.gen(function*() {
      const spec = fixturePath("cli-warning-spec.json")
      const result = yield* runCli(["--spec", spec, "--name", "CliClient"])

      assert.include(result.stdout, "export const make = (")
      assert.include(result.stderr, "cookie-parameter-dropped")
      assert.notInclude(result.stdout, "cookie-parameter-dropped")
      assert.notInclude(result.stderr, "export const make = (")
    }))
})
