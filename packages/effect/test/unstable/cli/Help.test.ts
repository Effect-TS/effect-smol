import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { FileSystem, Path } from "effect/platform"
import { TestConsole } from "effect/testing"
import { HelpFormatter } from "effect/unstable/cli"
import * as Cli from "./fixtures/ComprehensiveCli.ts"
import * as MockTerminal from "./services/MockTerminal.ts"
import * as TestActions from "./services/TestActions.ts"

const ActionsLayer = TestActions.layer
const ConsoleLayer = TestConsole.layer
const FileSystemLayer = FileSystem.layerNoop({})
const PathLayer = Path.layer
const TerminalLayer = MockTerminal.layer
const HelpFormatterLayer = HelpFormatter.layer(
  HelpFormatter.defaultHelpRenderer({
    colors: false
  })
)

const TestLayer = Layer.mergeAll(
  ActionsLayer,
  ConsoleLayer,
  FileSystemLayer,
  PathLayer,
  TerminalLayer,
  HelpFormatterLayer
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

describe("Command --help-full output", () => {
  it.effect("root command full help shows entire tree", () =>
    Effect.gen(function*() {
      const helpText = yield* runCommand(["--help-full"])

      expect(helpText).toMatchInlineSnapshot(`
        "mycli - A comprehensive CLI tool demonstrating all features

        Tree:
          mycli
          ├─■ admin
          │   ├─■ users
          │   │   ├─■ list
          │   │   └─■ create
          │   └─■ config
          │       ├─■ set
          │       └─■ get
          ├─■ copy
          ├─■ move
          ├─■ remove
          ├─■ build
          ├─■ git
          │   ├─■ clone
          │   ├─■ add
          │   └─■ status
          ├─■ test-required
          ├─■ test-failing
          ├─■ app
          │   └─■ deploy
          └─■ app-nested
              └─■ service
                  └─■ deploy

        Commands
        --------

        mycli
          A comprehensive CLI tool demonstrating all features
          Flags:
            -d, --debug          [boolean]  Enable debug logging
            -c, --config         [file] (required)  Path to configuration file
            -q, --quiet          [boolean]  Suppress non-error output

        mycli admin
          Administrative commands
          Flags:
            --sudo               [boolean]  Run with elevated privileges

        mycli admin users
          User management commands

        mycli admin users list
          List all users in the system
          Flags:
            --format             [string] (required)  Output format (json, table, csv)
            --active             [boolean]  Show only active users
            -v, --verbose        [boolean]  Show detailed information

        mycli admin users create <username> [email]
          Create a new user account
          Arguments:
            <username>           [string]  Username for the new user
            [email]              [string] (optional)  Email address (optional)
          Flags:
            --role               [string] (required)  User role (admin, user, guest)
            -n, --notify         [boolean]  Send notification email

        mycli admin config
          Manage application configuration
          Flags:
            -p, --profile        [string] (required)  Configuration profile to use

        mycli admin config set <key=value...>
          Set configuration values
          Arguments:
            <key=value...>       [string]  Configuration key-value pairs
          Flags:
            -f, --config-file    [file] (required)  Write to specific config file

        mycli admin config get <key>
          Get configuration value
          Arguments:
            <key>                [string]  Configuration key to retrieve
          Flags:
            --source             [string] (required)  Configuration source (local, global, system)

        mycli copy <source> <destination>
          Copy files or directories
          Arguments:
            <source>             [file]  Source file or directory
            <destination>        [file]  Destination path
          Flags:
            -r, --recursive      [boolean]  Copy directories recursively
            -f, --force          [boolean]  Overwrite existing files
            --buffer-size        [integer] (required)  Buffer size in KB

        mycli move <paths...>
          Move or rename files
          Arguments:
            <paths...>           [string]  Source path(s) and destination
          Flags:
            -i, --interactive    [boolean]  Prompt before overwrite

        mycli remove <files...>
          Remove files or directories
          Arguments:
            <files...>           [string]  Files to remove
          Flags:
            -r, --recursive      [boolean]  Remove directories and contents
            -f, --force          [boolean]  Force removal without prompts
            -v, --verbose        [boolean]  Explain what is being done

        mycli build
          Build the project
          Flags:
            -o, --output         [string] (required)  Output directory
            -v, --verbose        [boolean]  Enable verbose output
            -f, --config-file    [string] (required)  Configuration file path

        mycli git
          Git version control
          Flags:
            --verbose            [boolean]  Enable verbose output

        mycli git clone <repository>
          Clone a repository
          Arguments:
            <repository>         [string]  Repository URL or path
          Flags:
            --branch             [string] (required)  Branch to clone

        mycli git add <files>
          Add files to staging
          Arguments:
            <files>              [string]  Files to add
          Flags:
            --update             [boolean]  Update tracked files

        mycli git status
          Show repository status
          Flags:
            --short              [boolean]  Show short format

        mycli test-required
          Test command with required option
          Flags:
            --required           [string] (required)  A required option for testing

        mycli test-failing
          Test command that always fails
          Flags:
            --input              [string] (required)  Input that will cause handler to fail

        mycli app
          Application management
          Flags:
            --env                [string] (required)  Environment setting

        mycli app deploy <service> <environment>
          Deploy a service
          Arguments:
            <service>            [string]  Service to deploy
            <environment>        [string]  Target environment
          Flags:
            --db-host            [string] (required)  Database host
            --db-port            [integer] (required)  Database port
            --dry-run            [boolean]  Perform a dry run

        mycli app-nested
          Application with nested services
          Flags:
            --env                [string] (required)  Environment setting

        mycli app-nested service
          Service management
          Flags:
            --name               [string] (required)  Service name

        mycli app-nested service deploy <service> <environment>
          Deploy a service
          Arguments:
            <service>            [string]  Service to deploy
            <environment>        [string]  Target environment
          Flags:
            --db-host            [string] (required)  Database host
            --db-port            [integer] (required)  Database port
            --dry-run            [boolean]  Perform a dry run"
      `)
    }).pipe(Effect.provide(TestLayer)))

  it.effect("subcommand full help shows subtree only", () =>
    Effect.gen(function*() {
      const helpText = yield* runCommand(["admin", "--help-full"])

      expect(helpText).toMatchInlineSnapshot(`
        "admin - Administrative commands

        Tree:
          admin
          ├─■ users
          │   ├─■ list
          │   └─■ create
          └─■ config
              ├─■ set
              └─■ get

        Commands
        --------

        admin
          Administrative commands
          Flags:
            --sudo               [boolean]  Run with elevated privileges

        admin users
          User management commands

        admin users list
          List all users in the system
          Flags:
            --format             [string] (required)  Output format (json, table, csv)
            --active             [boolean]  Show only active users
            -v, --verbose        [boolean]  Show detailed information

        admin users create <username> [email]
          Create a new user account
          Arguments:
            <username>           [string]  Username for the new user
            [email]              [string] (optional)  Email address (optional)
          Flags:
            --role               [string] (required)  User role (admin, user, guest)
            -n, --notify         [boolean]  Send notification email

        admin config
          Manage application configuration
          Flags:
            -p, --profile        [string] (required)  Configuration profile to use

        admin config set <key=value...>
          Set configuration values
          Arguments:
            <key=value...>       [string]  Configuration key-value pairs
          Flags:
            -f, --config-file    [file] (required)  Write to specific config file

        admin config get <key>
          Get configuration value
          Arguments:
            <key>                [string]  Configuration key to retrieve
          Flags:
            --source             [string] (required)  Configuration source (local, global, system)"
      `)
    }).pipe(Effect.provide(TestLayer)))
})
