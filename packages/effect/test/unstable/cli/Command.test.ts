import { assert, describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { Option } from "effect/data"
import { FileSystem, Path } from "effect/platform"
import { TestConsole } from "effect/testing"
import { Command, Flag, HelpFormatter } from "effect/unstable/cli"
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

describe("Command", () => {
  describe("run", () => {
    it.effect("should execute handler with parsed config", () =>
      Effect.gen(function*() {
        const path = yield* Path.Path
        const resolvedSrc = path.resolve("src.txt")
        const resolvedDest = path.resolve("dest.txt")

        yield* Cli.run(["copy", "src.txt", "dest.txt", "--recursive", "--force"])

        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 1)
        assert.deepStrictEqual(actions[0], {
          command: "copy",
          details: {
            source: resolvedSrc,
            destination: resolvedDest,
            recursive: true,
            force: true,
            bufferSize: 64
          }
        })
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should handle nested config in handler", () =>
      Effect.gen(function*() {
        const username = "john_doe"
        const email = "john@example.com"
        const role = "admin"

        yield* Cli.run(["admin", "users", "create", username, email, "--role", role, "--notify"])

        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 1)
        assert.deepStrictEqual(actions[0], {
          command: "users create",
          details: { username, email: Option.some(email), role, notify: true }
        })
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should work with effectful handlers", () =>
      Effect.gen(function*() {
        const files = ["file1.txt", "file2.txt", "dir/"]

        yield* Cli.run(["remove", ...files, "--recursive", "--force", "--verbose"])

        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 1)
        assert.deepStrictEqual(actions[0], {
          command: "remove",
          details: {
            files,
            recursive: true,
            force: true,
            verbose: true
          }
        })
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should work with option aliases in handler", () =>
      Effect.gen(function*() {
        const config = "build.json"
        const output = "dist/"

        yield* Cli.run(["build", "-o", output, "-v", "-f", config])

        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 1)
        assert.deepStrictEqual(actions[0], {
          command: "build",
          details: { output, verbose: true, config }
        })
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should merge repeated key=value flags into a single record", () =>
      Effect.gen(function*() {
        const captured: Array<Record<string, string>> = []

        const command = Command.make("env", {
          env: Flag.keyValueMap("env")
        }, (config) =>
          Effect.sync(() => {
            captured.push(config.env)
          }))

        const runCommand = Command.runWith(command, {
          version: "1.0.0"
        })

        yield* runCommand([
          "--env",
          "foo=bar",
          "--env",
          "cool=dude"
        ])

        assert.deepStrictEqual(captured, [{ foo: "bar", cool: "dude" }])
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should merge key=value flags even when interleaved with other options", () =>
      Effect.gen(function*() {
        const captured: Array<Record<string, unknown>> = []

        const command = Command.make("env", {
          env: Flag.keyValueMap("env"),
          verbose: Flag.boolean("verbose"),
          profile: Flag.string("profile")
        }, (config) =>
          Effect.sync(() => {
            captured.push(config)
          }))

        const runCommand = Command.runWith(command, {
          version: "1.0.0"
        })

        yield* runCommand([
          "--env",
          "foo=bar",
          "--profile",
          "dev",
          "--env",
          "cool=dude",
          "--verbose",
          "--env",
          "zip=zop"
        ])

        assert.deepStrictEqual(captured, [{
          env: { foo: "bar", cool: "dude", zip: "zop" },
          verbose: true,
          profile: "dev"
        }])
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should fail for malformed key=value flags", () =>
      Effect.gen(function*() {
        let invoked = false

        const command = Command.make("env", {
          env: Flag.keyValueMap("env")
        }, () =>
          Effect.sync(() => {
            invoked = true
          }))

        const runCommand = Command.runWith(command, {
          version: "1.0.0"
        })

        yield* runCommand([
          "--env",
          "invalid"
        ])

        const stderr = yield* TestConsole.errorLines
        assert.isTrue(
          stderr.some((line) => String(line).includes("Invalid key=value format")),
          "expected CLI to report invalid key=value format"
        )

        assert.isFalse(invoked)
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should handle parsing errors from run", () =>
      Effect.gen(function*() {
        const runCommand = Command.runWith(Cli.ComprehensiveCli, {
          version: "1.0.0"
        })

        yield* runCommand(["invalid-command"])

        // Check that help text was shown to stdout
        const stdout = yield* TestConsole.logLines
        assert.isTrue(stdout.some((line) => String(line).includes("DESCRIPTION")))
        assert.isTrue(stdout.some((line) => String(line).includes("comprehensive CLI tool")))

        // Check that error was shown to stderr
        const stderr = yield* TestConsole.errorLines
        assert.isTrue(stderr.some((line) => String(line).includes("ERROR")))
        assert.isTrue(stderr.some((line) => String(line).includes("Unknown subcommand")))
        assert.isTrue(stderr.some((line) => String(line).includes("invalid-command")))
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should propagate handler errors from run", () =>
      Effect.gen(function*() {
        const result = yield* Effect.flip(Cli.run(["test-failing", "--input", "test"]))
        assert.strictEqual(result, "Handler error")
      }).pipe(Effect.provide(TestLayer)))
  })

  describe("withSubcommands", () => {
    it.effect("should execute parent handler when no subcommand provided", () =>
      Effect.gen(function*() {
        const command = "git"

        yield* Cli.run([command, "--verbose"])

        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 1)
        assert.deepStrictEqual(actions[0], { command, details: { verbose: true } })
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should execute subcommand when provided", () =>
      Effect.gen(function*() {
        const command = ["git", "clone"]
        const repository = "myrepo"
        const branch = "develop"

        yield* Cli.run([...command, repository, "--branch", branch])

        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 1)
        assert.deepStrictEqual(actions[0], {
          command: command.join(" "),
          details: { repository, branch }
        })
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should handle multiple subcommands correctly", () =>
      Effect.gen(function*() {
        yield* Cli.run(["git", "clone", "repo1"])
        yield* Cli.run(["git", "add", "file1", "--update"])
        yield* Cli.run(["git", "status", "--short"])

        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 3)
        assert.deepStrictEqual(actions[0], {
          command: "git clone",
          details: { repository: "repo1", branch: "main" }
        })
        assert.deepStrictEqual(actions[1], {
          command: "git add",
          details: { files: "file1", update: true }
        })
        assert.deepStrictEqual(actions[2], {
          command: "git status",
          details: { short: true }
        })
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should handle nested config structures in subcommands", () =>
      Effect.gen(function*() {
        const service = "api-service"
        const environment = "production"
        const dbHost = "localhost"
        const dbPort = 5432

        yield* Cli.run([
          "app",
          "--env",
          "prod",
          "deploy",
          service,
          environment,
          "--db-host",
          dbHost,
          "--db-port",
          dbPort.toString(),
          "--dry-run"
        ])

        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 1)
        assert.deepStrictEqual(actions[0], {
          command: "deploy",
          details: {
            service,
            environment,
            database: { host: dbHost, port: dbPort },
            dryRun: true
          }
        })
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should execute parent handler with options when no subcommand provided", () =>
      Effect.gen(function*() {
        // Use git command with only --verbose flag (git doesn't have an "unknown" option)
        // This will execute the parent git handler instead of trying to match subcommands
        yield* Cli.run(["git", "--verbose"])

        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 1)
        assert.deepStrictEqual(actions[0], {
          command: "git",
          details: { verbose: true }
        })
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should propagate subcommand errors", () =>
      Effect.gen(function*() {
        const result = yield* Effect.flip(Cli.run(["test-failing", "--input", "test"]))
        assert.strictEqual(result, "Handler error")
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should provide parent context to subcommands", () =>
      Effect.gen(function*() {
        const messages: Array<string> = []

        const config = {
          verbose: Flag.boolean("verbose"),
          config: Flag.string("config")
        }

        // Create parent command
        const parent = Command.make("parent", config, (config) =>
          Effect.sync(() => {
            messages.push(`parent: config=${config.config}`)
          }))

        // Create subcommand that accesses parent context
        const child = Command.make("child", { action: Flag.string("action") }, (config) =>
          Effect.gen(function*() {
            // Access parent config via the auto-generated tag
            const parentConfig = yield* parent.service
            messages.push(`child: parent.verbose=${parentConfig.verbose}`)
            messages.push(`child: parent.config=${parentConfig.config}`)
            messages.push(`child: action=${config.action}`)
          }))

        // Combine parent and child
        const combined = parent.pipe(
          Command.withSubcommands(child)
        )

        const runCommand = Command.runWith(combined, {
          version: "1.0.0"
        })

        yield* runCommand([
          "--verbose",
          "--config",
          "prod.json",
          "child",
          "--action",
          "deploy"
        ])

        assert.deepStrictEqual(messages, [
          "child: parent.verbose=true",
          "child: parent.config=prod.json",
          "child: action=deploy"
        ])
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should accept parent flags before or after a subcommand (npm-style)", () =>
      Effect.gen(function*() {
        const messages: Array<string> = []

        // Parent command with a global-ish flag
        const root = Command.make("npm", {
          global: Flag.boolean("global")
        })

        const install = Command.make("install", {
          pkg: Flag.string("pkg")
        }, (config) =>
          Effect.gen(function*() {
            const parentConfig = yield* root.service
            messages.push(`install: global=${parentConfig.global}, pkg=${config.pkg}`)
          }))

        const npm = root.pipe(Command.withSubcommands(install))

        const runNpm = Command.runWith(npm, { version: "1.0.0" })

        // Global before subcommand
        yield* runNpm(["--global", "install", "--pkg", "cowsay"])
        // Global after subcommand
        yield* runNpm(["install", "--pkg", "cowsay", "--global"])

        assert.deepStrictEqual(messages, [
          "install: global=true, pkg=cowsay",
          "install: global=true, pkg=cowsay"
        ])
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should allow direct accessing parent config in subcommands", () =>
      Effect.gen(function*() {
        const messages: Array<string> = []

        // Parent command with a global-ish flag
        const root = Command.make("npm", {
          global: Flag.boolean("global")
        })

        const install = Command.make("install", {
          pkg: Flag.string("pkg")
        }, (config) =>
          Effect.gen(function*() {
            // NEW: Direct yielding of parent command instead of root.tag
            const parentConfig = yield* root
            messages.push(`install: global=${parentConfig.global}, pkg=${config.pkg}`)
          }))

        const npm = root.pipe(Command.withSubcommands(install))

        const runNpm = Command.runWith(npm, { version: "1.0.0" })

        // Test the new pattern works
        yield* runNpm(["--global", "install", "--pkg", "effect"])

        assert.deepStrictEqual(messages, [
          "install: global=true, pkg=effect"
        ])
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should handle nested subcommands with context sharing", () =>
      Effect.gen(function*() {
        const messages: Array<string> = []

        // Create root command
        const root = Command.make("app", {
          env: Flag.string("env")
        }, (config) =>
          Effect.gen(function*() {
            messages.push(`root: env=${config.env}`)
          }))

        // Create middle command that also accesses root context
        const service = Command.make("service", {
          name: Flag.string("name")
        }, (config) =>
          Effect.gen(function*() {
            const rootConfig = yield* root.service
            messages.push(`service: root.env=${rootConfig.env}`)
            messages.push(`service: name=${config.name}`)
          }))

        // Create leaf command that accesses both parent contexts
        const deploy = Command.make("deploy", {
          targetVersion: Flag.string("target-version")
        }, (config) =>
          Effect.gen(function*() {
            const rootConfig = yield* root.service
            const serviceConfig = yield* service.service
            messages.push(`deploy: root.env=${rootConfig.env}`)
            messages.push(`deploy: service.name=${serviceConfig.name}`)
            messages.push(`deploy: target-version=${config.targetVersion}`)
          }))

        // Build the nested command structure
        const serviceWithDeploy = service.pipe(
          Command.withSubcommands(deploy)
        )

        const appWithService = root.pipe(
          Command.withSubcommands(serviceWithDeploy)
        )

        const runCommand = Command.runWith(appWithService, { version: "1.0.0" })
        yield* runCommand([
          "--env",
          "production",
          "service",
          "--name",
          "api",
          "deploy",
          "--target-version",
          "1.0.0"
        ])

        assert.deepStrictEqual(messages, [
          "deploy: root.env=production",
          "deploy: service.name=api",
          "deploy: target-version=1.0.0"
        ])
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should handle boolean flags before subcommands", () =>
      Effect.gen(function*() {
        const messages: Array<string> = []

        // Create parent with boolean flag
        const parent = Command.make("app", {
          verbose: Flag.boolean("verbose"),
          config: Flag.string("config")
        }, (config) =>
          Effect.gen(function*() {
            messages.push(`parent: verbose=${config.verbose}, config=${config.config}`)
          }))

        // Create subcommand
        const deploy = Command.make("deploy", {
          targetVersion: Flag.string("target-version")
        }, (config) =>
          Effect.gen(function*() {
            const parentConfig = yield* parent.service
            messages.push(`deploy: parent.verbose=${parentConfig.verbose}`)
            messages.push(`deploy: target-version=${config.targetVersion}`)
          }))

        // Combine commands
        const combined = parent.pipe(
          Command.withSubcommands(deploy)
        )

        const runCommand = Command.runWith(combined, { version: "1.0.0" })
        yield* runCommand([
          "--config",
          "prod.json",
          "--verbose", // Boolean flag without explicit value
          "deploy", // This should be recognized as subcommand, not as value for --verbose
          "--target-version",
          "1.0.0"
        ])

        assert.deepStrictEqual(messages, [
          "deploy: parent.verbose=true",
          "deploy: target-version=1.0.0"
        ])
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should support options before, after, or between operands (relaxed POSIX Syntax Guideline No. 9)", () =>
      Effect.gen(function*() {
        // Test both orderings work: POSIX (options before operands) and modern (mixed)

        // Test 1: POSIX style - options before operands
        yield* Cli.run([
          "copy",
          "--recursive",
          "--force",
          "src.txt",
          "dest.txt"
        ])

        // Test 2: Modern style - options after operands
        yield* Cli.run([
          "copy",
          "src.txt",
          "dest.txt",
          "--recursive",
          "--force"
        ])

        // Test 3: Mixed style - some options before, some after
        yield* Cli.run([
          "copy",
          "--recursive",
          "src.txt",
          "dest.txt",
          "--force"
        ])

        // Check all three commands worked
        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 3)

        for (let i = 0; i < 3; i++) {
          assert.strictEqual(actions[i].command, "copy")
          assert.strictEqual(actions[i].details.recursive, true)
          assert.strictEqual(actions[i].details.force, true)
          assert.strictEqual(actions[i].details.bufferSize, 64)
          // Source and destination will be resolved paths - just check they contain the filenames
          assert.isTrue(String(actions[i].details.source).includes("src.txt"))
          assert.isTrue(String(actions[i].details.destination).includes("dest.txt"))
        }
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should suggest similar subcommands for unknown subcommands", () =>
      Effect.gen(function*() {
        yield* Cli.run(["cpy"])

        const errorOutput = yield* TestConsole.errorLines
        const errorText = errorOutput.join("\n")
        expect(errorText).toMatchInlineSnapshot(`
          "
          ERROR
            Unknown subcommand "cpy" for "mycli"

            Did you mean this?
              copy"
        `)
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should suggest similar subcommands for nested unknown subcommands", () =>
      Effect.gen(function*() {
        yield* Cli.run(["admin", "usrs", "list"])

        // Capture the error output
        const errorOutput = yield* TestConsole.errorLines
        const errorText = errorOutput.join("\n")
        expect(errorText).toMatchInlineSnapshot(`
          "
          ERROR
            Unknown subcommand "usrs" for "mycli admin"

            Did you mean this?
              users"
        `)
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should suggest similar options for unrecognized options", () =>
      Effect.gen(function*() {
        yield* Cli.run(["--debugs", "copy", "src.txt", "dest.txt"])

        const errorOutput = yield* TestConsole.errorLines
        const errorText = errorOutput.join("\n")
        expect(errorText).toMatchInlineSnapshot(`
          "
          ERROR
            Unrecognized flag: --debugs in command mycli

            Did you mean this?
              --debug"
        `)
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should suggest similar short options for unrecognized short options", () =>
      Effect.gen(function*() {
        yield* Cli.run(["-u", "copy", "src.txt", "dest.txt"])

        const errorOutput = yield* TestConsole.errorLines
        const errorText = errorOutput.join("\n")
        expect(errorText).toMatchInlineSnapshot(`
          "
          ERROR
            Unrecognized flag: -u in command mycli

            Did you mean this?
              -d
              -c
              -q"
        `)
      }).pipe(Effect.provide(TestLayer)))
  })
})
