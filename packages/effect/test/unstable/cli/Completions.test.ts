import { describe, expect, it } from "vitest"
import * as Command from "../../../src/unstable/cli/Command.js"
import * as Flag from "../../../src/unstable/cli/Flag.js"
import {
  generateBashCompletions,
  generateFishCompletions,
  generateZshCompletions
} from "../../../src/unstable/cli/internal/completions.js"

const buildSampleCli = () => {
  const build = Command.make("build", {
    "out-dir": Flag.directory("out-dir").pipe(Flag.withDescription("Output directory")),
    target: Flag.string("target").pipe(Flag.withDescription("Target name"))
  })

  const deploy = Command.make("deploy", {
    env: Flag.choice("env", ["staging", "prod"]).pipe(Flag.withDescription("Environment")),
    file: Flag.file("file").pipe(Flag.withDescription("Artifact file"))
  })

  const root = Command
    .make("forge", {
      verbose: Flag.boolean("verbose").pipe(Flag.withAlias("v"), Flag.withDescription("Verbose output")),
      "log-level": Flag.choice("log-level", ["debug", "info", "warn", "error"]).pipe(
        Flag.withDescription("Set log level")
      )
    })
    .pipe(Command.withSubcommands(build, deploy))

  return root
}

describe("completions", () => {
  const cli = buildSampleCli()
  const exe = "forge"

  it("bash", () => {
    const script = generateBashCompletions(cli, exe)
    expect(script).toMatchSnapshot()
  })

  it("fish", () => {
    const script = generateFishCompletions(cli, exe)
    expect(script).toMatchSnapshot()
  })

  it("zsh", () => {
    const script = generateZshCompletions(cli, exe)
    expect(script).toMatchSnapshot()
  })
})
