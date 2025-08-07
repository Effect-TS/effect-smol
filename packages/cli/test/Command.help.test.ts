import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import * as NodePath from "@effect/platform-node/NodePath"
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/services/Layer"
import * as TestConsole from "effect/testing/TestConsole"
import * as Command from "../src/Command.ts"
import * as HelpFormatter from "../src/HelpFormatter.ts"
import { comprehensiveCli } from "./utils/comprehensiveCli.ts"
import * as TestActions from "./utils/TestActions.ts"

const TestLayer = Layer.mergeAll(
  NodeFileSystem.layer,
  NodePath.layer,
  TestConsole.layer,
  HelpFormatter.layer(HelpFormatter.defaultHelpRenderer({ colors: false })),
  TestActions.layer
)

/**
 * Use the shared comprehensive CLI tool for testing
 */
const cli = comprehensiveCli

const runCommand = Command.run(cli, { name: "mycli", version: "1.0.0" })

const runCommandAndGetOutput = (command: ReadonlyArray<string>) =>
  Effect.gen(function*() {
    yield* runCommand(command)
    const output = yield* TestConsole.logLines
    return output.join("\n")
  })

describe("Command help output", () => {
  it.effect("root command help", () =>
    Effect.gen(function*() {
      const helpText = yield* runCommandAndGetOutput(["--help"])

      expect(helpText).toMatchInlineSnapshot(`
        "DESCRIPTION
          A comprehensive CLI tool demonstrating all features

        USAGE
          mycli <subcommand> [flags]

        FLAGS
          -d, --debug          Enable debug logging
          -c, --config file    Path to configuration file
          -q, --quiet          Suppress non-error output

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
      const helpText = yield* runCommandAndGetOutput(["cp", "--help"])

      expect(helpText).toMatchInlineSnapshot(`
        "DESCRIPTION
          A comprehensive CLI tool demonstrating all features

        USAGE
          mycli <subcommand> [flags]

        FLAGS
          -d, --debug          Enable debug logging
          -c, --config file    Path to configuration file
          -q, --quiet          Suppress non-error output

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

  it.effect("variadic arguments command", () =>
    Effect.gen(function*() {
      const helpText = yield* runCommandAndGetOutput(["rm", "--help"])

      expect(helpText).toMatchInlineSnapshot(`
        "DESCRIPTION
          A comprehensive CLI tool demonstrating all features

        USAGE
          mycli <subcommand> [flags]

        FLAGS
          -d, --debug          Enable debug logging
          -c, --config file    Path to configuration file
          -q, --quiet          Suppress non-error output

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

  it.effect("deeply nested subcommand", () =>
    Effect.gen(function*() {
      const helpText = yield* runCommandAndGetOutput(["admin", "users", "list", "--help"])

      expect(helpText).toMatchInlineSnapshot(`
        "DESCRIPTION
          List all users in the system

        USAGE
          mycli admin users list [flags]

        FLAGS
          --format string    Output format (json, table, csv)
          --active           Show only active users
          -v, --verbose      Show detailed information"
      `)
    }).pipe(Effect.provide(TestLayer)))

  it.effect("command with mixed positional args", () =>
    Effect.gen(function*() {
      const helpText = yield* runCommandAndGetOutput(["admin", "users", "create", "--help"])

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
          -n, --notify     Send notification email"
      `)
    }).pipe(Effect.provide(TestLayer)))

  it.effect("intermediate subcommand with options", () =>
    Effect.gen(function*() {
      const helpText = yield* runCommandAndGetOutput(["admin", "config", "--help"])

      expect(helpText).toMatchInlineSnapshot(`
        "DESCRIPTION
          Manage application configuration

        USAGE
          mycli admin config <subcommand> [flags]

        FLAGS
          -p, --profile string    Configuration profile to use

        SUBCOMMANDS
          set    Set configuration values
          get    Get configuration value"
      `)
    }).pipe(Effect.provide(TestLayer)))

  it.effect("variadic with minimum count", () =>
    Effect.gen(function*() {
      const helpText = yield* runCommandAndGetOutput(["admin", "config", "set", "--help"])

      expect(helpText).toMatchInlineSnapshot(`
        "DESCRIPTION
          Set configuration values

        USAGE
          mycli admin config set [flags] <key=value...>

        ARGUMENTS
          key=value... string    Configuration key-value pairs

        FLAGS
          -f, --config-file file    Write to specific config file"
      `)
    }).pipe(Effect.provide(TestLayer)))
})
