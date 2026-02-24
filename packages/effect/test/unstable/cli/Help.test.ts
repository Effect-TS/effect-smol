import { describe, expect, it } from "@effect/vitest"
import { Effect, FileSystem, Layer, Path } from "effect"
import { TestConsole } from "effect/testing"
import { CliOutput, Command } from "effect/unstable/cli"
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

        GLOBAL FLAGS
          --help, -h              Show help information
          --version               Show version information
          --completions choice    Print shell completion script
          --log-level choice      Sets the minimum log level

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

  it.effect("command help renders examples", () =>
    Effect.gen(function*() {
      const command = Command.make("login").pipe(
        Command.withDescription("Authenticate with Supabase"),
        Command.withExamples([
          { command: "myapp login", description: "Log in with browser OAuth" },
          { command: "myapp login --token sbp_abc123", description: "Log in with a token" },
          { command: "myapp login --logout" },
          { command: "myapp login --logout" },
          { command: "myapp login", description: "Log in with browser OAuth" }
        ])
      )
      const runLogin = Command.runWith(command, { version: "1.0.0" })

      yield* runLogin(["--help"])

      const output = (yield* TestConsole.logLines).join("\n")
      expect(output).toMatchInlineSnapshot(`
        "DESCRIPTION
          Authenticate with Supabase

        USAGE
          login [flags]

        GLOBAL FLAGS
          --help, -h              Show help information
          --version               Show version information
          --completions choice    Print shell completion script
          --log-level choice      Sets the minimum log level

        EXAMPLES
          # Log in with browser OAuth
          myapp login

          # Log in with a token
          myapp login --token sbp_abc123

          myapp login --logout
          myapp login --logout

          # Log in with browser OAuth
          myapp login"
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
          --buffer-size integer    Buffer size in KB

        GLOBAL FLAGS
          --help, -h              Show help information
          --version               Show version information
          --completions choice    Print shell completion script
          --log-level choice      Sets the minimum log level"
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
          --verbose, -v      Explain what is being done

        GLOBAL FLAGS
          --help, -h              Show help information
          --version               Show version information
          --completions choice    Print shell completion script
          --log-level choice      Sets the minimum log level"
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
          --verbose, -v      Show detailed information

        GLOBAL FLAGS
          --help, -h              Show help information
          --version               Show version information
          --completions choice    Print shell completion script
          --log-level choice      Sets the minimum log level"
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
          --notify, -n     Send notification email

        GLOBAL FLAGS
          --help, -h              Show help information
          --version               Show version information
          --completions choice    Print shell completion script
          --log-level choice      Sets the minimum log level"
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

        GLOBAL FLAGS
          --help, -h              Show help information
          --version               Show version information
          --completions choice    Print shell completion script
          --log-level choice      Sets the minimum log level

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
          --config-file, -f file    Write to specific config file

        GLOBAL FLAGS
          --help, -h              Show help information
          --version               Show version information
          --completions choice    Print shell completion script
          --log-level choice      Sets the minimum log level"
      `)
    }).pipe(Effect.provide(TestLayer)))

  it.effect("grouped subcommands", () =>
    Effect.gen(function*() {
      const ungrouped = Command.make("ungrouped").pipe(
        Command.withDescription("This command is not in a group")
      )
      const init = Command.make("init").pipe(Command.withDescription("Create a new project"))
      const login = Command.make("login").pipe(Command.withDescription("Authenticate with the platform"))
      const start = Command.make("start").pipe(Command.withDescription("Start local services"))
      const stop = Command.make("stop").pipe(Command.withDescription("Stop local services"))
      const db = Command.make("db").pipe(Command.withDescription("Manage local database"))
      const projects = Command.make("projects").pipe(Command.withDescription("Manage cloud projects"))
      const functions = Command.make("functions").pipe(Command.withDescription("Manage edge functions"))

      const grouped = Command.make("tool").pipe(
        Command.withSubcommands([
          {
            group: "Quick Start",
            commands: [init, login]
          },
          {
            group: "Local Development",
            commands: [start, stop, db]
          },
          {
            group: "Management APIs",
            commands: [projects, functions]
          },
          ungrouped
        ])
      )

      const runGrouped = Command.runWith(grouped, { version: "1.0.0" })
      yield* runGrouped(["--help"])

      const helpText = (yield* TestConsole.logLines).join("\n")

      expect(helpText).toMatchInlineSnapshot(`
        "USAGE
          tool <subcommand> [flags]

        GLOBAL FLAGS
          --help, -h              Show help information
          --version               Show version information
          --completions choice    Print shell completion script
          --log-level choice      Sets the minimum log level

        SUBCOMMANDS
          ungrouped    This command is not in a group

        Quick Start:
          init     Create a new project
          login    Authenticate with the platform

        Local Development:
          start    Start local services
          stop     Stop local services
          db       Manage local database

        Management APIs:
          projects     Manage cloud projects
          functions    Manage edge functions"
      `)
    }).pipe(Effect.provide(TestLayer)))

  it.effect("subcommand aliases in listings", () =>
    Effect.gen(function*() {
      const plan = Command.make("plan").pipe(
        Command.withAlias("p"),
        Command.withDescription("Draft a plan in your editor")
      )

      const root = Command.make("tool").pipe(Command.withSubcommands([plan]))
      const runRoot = Command.runWith(root, { version: "1.0.0" })

      yield* runRoot(["--help"])

      const helpText = (yield* TestConsole.logLines).join("\n")

      expect(helpText).toMatchInlineSnapshot(`
        "USAGE
          tool <subcommand> [flags]

        GLOBAL FLAGS
          --help, -h              Show help information
          --version               Show version information
          --completions choice    Print shell completion script
          --log-level choice      Sets the minimum log level

        SUBCOMMANDS
          plan, p    Draft a plan in your editor"
      `)
    }).pipe(Effect.provide(TestLayer)))
})
