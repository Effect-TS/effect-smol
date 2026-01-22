import { assert, describe, expect, it } from "@effect/vitest"
import { Effect, FileSystem, Layer, Option, Path } from "effect"
import { TestConsole } from "effect/testing"
import { Argument, CliOutput, Command, Flag } from "effect/unstable/cli"
import { ChildProcessSpawner } from "effect/unstable/process"
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
  Layer.mock(ChildProcessSpawner.ChildProcessSpawner)({})
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
          env: Flag.keyValuePair("env")
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
          env: Flag.keyValuePair("env"),
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
          env: Flag.keyValuePair("env")
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
            // Access parent config by yielding the parent command
            const parentConfig = yield* parent
            messages.push(`child: parent.verbose=${parentConfig.verbose}`)
            messages.push(`child: parent.config=${parentConfig.config}`)
            messages.push(`child: action=${config.action}`)
          }))

        // Combine parent and child
        const combined = parent.pipe(
          Command.withSubcommands([child])
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
            const parentConfig = yield* root
            messages.push(`install: global=${parentConfig.global}, pkg=${config.pkg}`)
          }))

        const npm = root.pipe(Command.withSubcommands([install]))

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

        const npm = root.pipe(Command.withSubcommands([install]))

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
            const rootConfig = yield* root
            messages.push(`service: root.env=${rootConfig.env}`)
            messages.push(`service: name=${config.name}`)
          }))

        // Create leaf command that accesses both parent contexts
        const deploy = Command.make("deploy", {
          targetVersion: Flag.string("target-version")
        }, (config) =>
          Effect.gen(function*() {
            const rootConfig = yield* root
            const serviceConfig = yield* service
            messages.push(`deploy: root.env=${rootConfig.env}`)
            messages.push(`deploy: service.name=${serviceConfig.name}`)
            messages.push(`deploy: target-version=${config.targetVersion}`)
          }))

        // Build the nested command structure
        const serviceWithDeploy = service.pipe(
          Command.withSubcommands([deploy])
        )

        const appWithService = root.pipe(
          Command.withSubcommands([serviceWithDeploy])
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
            const parentConfig = yield* parent
            messages.push(`deploy: parent.verbose=${parentConfig.verbose}`)
            messages.push(`deploy: target-version=${config.targetVersion}`)
          }))

        // Combine commands
        const combined = parent.pipe(
          Command.withSubcommands([deploy])
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

    it.effect("should treat tokens after -- as operands (no subcommand or flags)", () =>
      Effect.gen(function*() {
        const captured: Array<ReadonlyArray<string>> = []
        let childInvoked = false

        const root = Command.make("tool", {
          rest: Argument.string("rest").pipe(Argument.variadic())
        }, (config) =>
          Effect.sync(() => {
            captured.push(config.rest)
          }))

        const child = Command.make("child", {
          value: Flag.string("value")
        }, () =>
          Effect.sync(() => {
            childInvoked = true
          }))

        const cli = root.pipe(Command.withSubcommands([child]))
        const runCli = Command.runWith(cli, { version: "1.0.0" })

        yield* runCli(["--", "child", "--value", "x"])

        assert.isFalse(childInvoked)
        assert.deepStrictEqual(captured, [["child", "--value", "x"]])
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should coerce boolean flags to false when given falsey literals", () =>
      Effect.gen(function*() {
        const captured: Array<boolean> = []

        const cmd = Command.make("tool", {
          verbose: Flag.boolean("verbose")
        }, (config) => Effect.sync(() => captured.push(config.verbose)))

        const runCmd = Command.runWith(cmd, { version: "1.0.0" })

        yield* runCmd(["--verbose", "false"])
        yield* runCmd(["--verbose", "0"])

        assert.deepStrictEqual(captured, [false, false])
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should fail when a required flag value is missing", () =>
      Effect.gen(function*() {
        let invoked = false

        const cmd = Command.make("tool", {
          pkg: Flag.string("pkg")
        }, () =>
          Effect.sync(() => {
            invoked = true
          }))

        const runCmd = Command.runWith(cmd, { version: "1.0.0" })

        yield* runCmd(["--pkg"])

        assert.isFalse(invoked)
        const stderr = yield* TestConsole.errorLines
        assert.isAbove(stderr.length, 0)
        assert.isTrue(stderr.join("\n").includes("--pkg"))
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should parse combined short flags including one that expects a value", () =>
      Effect.gen(function*() {
        const captured: Array<{ all: boolean; verbose: boolean; pkg: string }> = []

        const cmd = Command.make("tool", {
          all: Flag.boolean("all").pipe(Flag.withAlias("a")),
          verbose: Flag.boolean("verbose").pipe(Flag.withAlias("v")),
          pkg: Flag.string("pkg").pipe(Flag.withAlias("p"))
        }, (config) =>
          Effect.sync(() => {
            captured.push(config)
          }))

        const runCmd = Command.runWith(cmd, { version: "1.0.0" })

        yield* runCmd(["-avp", "cowsay"])

        assert.deepStrictEqual(captured, [{ all: true, verbose: true, pkg: "cowsay" }])
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should honor -- while still applying parent flags", () =>
      Effect.gen(function*() {
        const captured: Array<{ global: boolean; rest: ReadonlyArray<string> }> = []

        const root = Command.make("tool", {
          global: Flag.boolean("global"),
          rest: Argument.string("rest").pipe(Argument.variadic())
        }, (config) => Effect.sync(() => captured.push({ global: config.global, rest: config.rest })))

        const child = Command.make("child", {
          value: Flag.string("value")
        })

        const cli = root.pipe(Command.withSubcommands([child]))
        const runCli = Command.runWith(cli, { version: "1.0.0" })

        yield* runCli(["--global", "--", "child", "--value", "x"])

        assert.deepStrictEqual(captured, [{ global: true, rest: ["child", "--value", "x"] }])
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should report unknown flag even when subcommand is unknown", () =>
      Effect.gen(function*() {
        const root = Command.make("root", {})
        const known = Command.make("known", {})
        const cli = root.pipe(Command.withSubcommands([known]))
        const runCli = Command.runWith(cli, { version: "1.0.0" })

        yield* runCli(["--unknown", "bogus"])

        const stderr = yield* TestConsole.errorLines
        const text = stderr.join("\n")
        assert.isTrue(text.includes("Unrecognized flag: --unknown"))
        // Parser may also surface the unknown subcommand; ensure at least one error is emitted.
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should keep variadic argument order when options are interleaved", () =>
      Effect.gen(function*() {
        const captured: Array<{ files: ReadonlyArray<string>; verbose: boolean }> = []

        const cmd = Command.make("copy", {
          verbose: Flag.boolean("verbose"),
          files: Argument.string("file").pipe(Argument.variadic())
        }, (config) => Effect.sync(() => captured.push({ files: config.files, verbose: config.verbose })))

        const runCmd = Command.runWith(cmd, { version: "1.0.0" })

        yield* runCmd(["--verbose", "a.txt", "b.txt", "--verbose", "c.txt"])

        assert.deepStrictEqual(captured, [{ files: ["a.txt", "b.txt", "c.txt"], verbose: true }])
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

    it.effect("should print version and exit even with subcommands (global precedence)", () =>
      Effect.gen(function*() {
        // --version should work on a command with subcommands
        yield* Cli.run(["--version"])

        const output = yield* TestConsole.logLines
        const outputText = output.join("\n")
        expect(outputText).toContain("1.0.0")
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should print version and exit when --version appears before subcommand", () =>
      Effect.gen(function*() {
        // --version should take precedence over subcommand
        yield* Cli.run(["--version", "copy", "src.txt", "dest.txt"])

        const output = yield* TestConsole.logLines
        const outputText = output.join("\n")
        expect(outputText).toContain("1.0.0")

        // Subcommand should NOT have run
        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 0)
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should print help when invoked with no arguments", () =>
      Effect.gen(function*() {
        yield* Cli.run([])

        // Check that help text was shown to stdout
        const stdout = yield* TestConsole.logLines
        assert.isTrue(stdout.some((line) => String(line).includes("DESCRIPTION")))
        assert.isTrue(stdout.some((line) => String(line).includes("comprehensive CLI tool")))

        // Handler should NOT have run
        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 0)
      }).pipe(Effect.provide(TestLayer)))
  })
})
