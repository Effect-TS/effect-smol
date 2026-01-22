import { describe, expect, it } from "@effect/vitest"
import { Effect, FileSystem, Layer, Path } from "effect"
import { TestConsole } from "effect/testing"
import { CliOutput } from "effect/unstable/cli"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import * as Cli from "./fixtures/ComprehensiveCli.ts"
import * as MockTerminal from "./services/MockTerminal.ts"
import * as TestActions from "./services/TestActions.ts"

const ActionsLayer = TestActions.layer
const ConsoleLayer = TestConsole.layer
const FileSystemLayer = FileSystem.layerNoop({})
const PathLayer = Path.layer
const TerminalLayer = MockTerminal.layer
const CliOutputLayer = CliOutput.layer(
  CliOutput.defaultFormatter({
    colors: false
  })
)

const TestLayer = Layer.mergeAll(
  ActionsLayer,
  ConsoleLayer,
  FileSystemLayer,
  PathLayer,
  TerminalLayer,
  CliOutputLayer,
  Layer.mock(ChildProcessSpawner)({})
)

const runCommand = Effect.fnUntraced(
  function*(command: ReadonlyArray<string>) {
    yield* Cli.run(command)
    const output = yield* TestConsole.logLines
    return output.join("\n")
  }
)

describe("Command help output", () => {
  it.effect("root command help", () =>
    Effect.gen(function*() {
      const helpText = yield* runCommand(["--help"])

      expect(helpText).toMatchInlineSnapshot(`
        "DESCRIPTION
          A comprehensive CLI tool demonstrating all features

        USAGE
          mycli <subcommand> [flags]

        FLAGS
          --debug, -d          Enable debug logging
          --config, -c file    Path to configuration file
          --quiet, -q          Suppress non-error output

        SUBCOMMANDS
          admin            Administrative commands
          copy             Copy files or directories
          move             Move or rename files
          remove           Remove files or directories
          build            Build the project
          git              Git version control
          test-required    Test command with required option
          test-failing     Test command that always fails
          app              Application management
          app-nested       Application with nested services"
      `)
    }).pipe(Effect.provide(TestLayer)))

  it.effect("file operation command with positional args", () =>
    Effect.gen(function*() {
      const helpText = yield* runCommand(["copy", "--help"])

      expect(helpText).toMatchInlineSnapshot(`
        "DESCRIPTION
          Copy files or directories

        USAGE
          mycli copy [flags] <source> <destination>

        ARGUMENTS
          source file         Source file or directory
          destination file    Destination path

        FLAGS
          --recursive, -r          Copy directories recursively
          --force, -f              Overwrite existing files
          --buffer-size integer    Buffer size in KB"
      `)
    }).pipe(Effect.provide(TestLayer)))

  it.effect("variadic arguments command", () =>
    Effect.gen(function*() {
      const helpText = yield* runCommand(["remove", "--help"])

      expect(helpText).toMatchInlineSnapshot(`
        "DESCRIPTION
          Remove files or directories

        USAGE
          mycli remove [flags] <files...>

        ARGUMENTS
          files... string    Files to remove

        FLAGS
          --recursive, -r    Remove directories and contents
          --force, -f        Force removal without prompts
          --verbose, -v      Explain what is being done"
      `)
    }).pipe(Effect.provide(TestLayer)))

  it.effect("deeply nested subcommand", () =>
    Effect.gen(function*() {
      const helpText = yield* runCommand(["admin", "users", "list", "--help"])

      expect(helpText).toMatchInlineSnapshot(`
        "DESCRIPTION
          List all users in the system

        USAGE
          mycli admin users list [flags]

        FLAGS
          --format string    Output format (json, table, csv)
          --active           Show only active users
          --verbose, -v      Show detailed information"
      `)
    }).pipe(Effect.provide(TestLayer)))

  it.effect("command with mixed positional args", () =>
    Effect.gen(function*() {
      const helpText = yield* runCommand(["admin", "users", "create", "--help"])

      expect(helpText).toMatchInlineSnapshot(`
        "DESCRIPTION
          Create a new user account

        USAGE
          mycli admin users create [flags] <username> [<email>]

        ARGUMENTS
          username string    Username for the new user
          email string       Email address (optional) (optional)

        FLAGS
          --role string    User role (admin, user, guest)
          --notify, -n     Send notification email"
      `)
    }).pipe(Effect.provide(TestLayer)))

  it.effect("intermediate subcommand with options", () =>
    Effect.gen(function*() {
      const helpText = yield* runCommand(["admin", "config", "--help"])

      expect(helpText).toMatchInlineSnapshot(`
        "DESCRIPTION
          Manage application configuration

        USAGE
          mycli admin config <subcommand> [flags]

        FLAGS
          --profile, -p string    Configuration profile to use

        SUBCOMMANDS
          set    Set configuration values
          get    Get configuration value"
      `)
    }).pipe(Effect.provide(TestLayer)))

  it.effect("variadic with minimum count", () =>
    Effect.gen(function*() {
      const helpText = yield* runCommand(["admin", "config", "set", "--help"])

      expect(helpText).toMatchInlineSnapshot(`
        "DESCRIPTION
          Set configuration values

        USAGE
          mycli admin config set [flags] <key=value...>

        ARGUMENTS
          key=value... string    Configuration key-value pairs

        FLAGS
          --config-file, -f file    Write to specific config file"
      `)
    }).pipe(Effect.provide(TestLayer)))
})
