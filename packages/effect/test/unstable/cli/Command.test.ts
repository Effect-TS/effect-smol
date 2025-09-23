import { NodeFileSystem, NodePath } from "@effect/platform-node"
import { assert, describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { Option } from "effect/data"
import { Path } from "effect/platform"
import { TestConsole } from "effect/testing"
import { CliError, Command, Flag, HelpFormatter } from "effect/unstable/cli"
import { comprehensiveCli, runComprehensiveCli } from "./utils/comprehensiveCli.ts"
import * as TestActions from "./utils/TestActions.ts"

// Create a test layer that provides TestConsole and TestActions
const TestLayer = Layer.mergeAll(
  TestConsole.layer,
  HelpFormatter.layer(HelpFormatter.defaultHelpRenderer({ colors: false })),
  TestActions.layer,
  NodeFileSystem.layer,
  NodePath.layer
)

describe("Command", () => {
  describe("run", () => {
    it.effect("should execute handler with parsed config", () =>
      Effect.gen(function*() {
        yield* runComprehensiveCli(["copy", "src.txt", "dest.txt", "--recursive", "--force"])
        const path = yield* Path.Path
        const resolvedSrc = path.resolve("src.txt")
        const resolvedDest = path.resolve("dest.txt")

        // Check the logged actions
        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 1)
        assert.deepStrictEqual(actions[0], {
          command: "copy",
          details: {
            source: resolvedSrc,
            destination: resolvedDest,
            recursive: true,
            force: true,
            bufferSize: 64 // default value
          }
        })
      }).pipe(
        Effect.provide(TestLayer)
      ))

    it.effect("should handle nested config in handler", () =>
      Effect.gen(function*() {
        yield* runComprehensiveCli([
          "admin",
          "users",
          "create",
          "john_doe", // username (positional)
          "john@example.com", // email (optional positional)
          "--role",
          "admin", // required option
          "--notify" // boolean flag
        ])

        // Check the logged actions
        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 1)
        assert.deepStrictEqual(actions[0], {
          command: "users create",
          details: {
            username: "john_doe",
            email: Option.some("john@example.com"),
            role: "admin",
            notify: true
          }
        })
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should work with effectful handlers", () =>
      Effect.gen(function*() {
        // Use the rm command with multiple boolean flags
        yield* runComprehensiveCli([
          "remove",
          "file1.txt",
          "file2.txt",
          "dir/", // variadic files
          "--recursive", // -r flag
          "--force", // -f flag
          "--verbose" // -v flag
        ])

        // Check the logged actions
        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 1)
        assert.deepStrictEqual(actions[0], {
          command: "remove",
          details: {
            files: ["file1.txt", "file2.txt", "dir/"],
            recursive: true,
            force: true,
            verbose: true
          }
        })
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should work with option aliases in handler", () =>
      Effect.gen(function*() {
        yield* runComprehensiveCli([
          "build",
          "-o",
          "dist/",
          "-v",
          "-f",
          "build.json"
        ])

        // Check the logged actions
        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 1)
        assert.deepStrictEqual(actions[0], {
          command: "build",
          details: {
            output: "dist/",
            verbose: true,
            config: "build.json"
          }
        })
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should handle parsing errors from run", () =>
      Effect.gen(function*() {
        const result = yield* Effect.flip(runComprehensiveCli(["test-required"]).pipe(Effect.provide(TestLayer)))

        assert.isTrue(CliError.isCliError(result))
        assert.strictEqual((result as CliError.CliError)._tag, "MissingOption")
        // The exact error message may vary, but it should be a CliError indicating parsing failure
      }))

    it.effect("should propagate handler errors from run", () =>
      Effect.gen(function*() {
        const result = yield* Effect.flip(
          runComprehensiveCli(["test-failing", "--input", "test"]).pipe(Effect.provide(TestLayer))
        )
        assert.strictEqual(result, "Handler error")
      }))
  })

  describe("withSubcommands", () => {
    it.effect("should execute parent handler when no subcommand provided", () =>
      Effect.gen(function*() {
        yield* runComprehensiveCli(["git", "--verbose"])

        // Check the logged actions
        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 1)
        assert.deepStrictEqual(actions[0], {
          command: "git",
          details: {
            verbose: true
          }
        })
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should execute subcommand when provided", () =>
      Effect.gen(function*() {
        yield* runComprehensiveCli(["git", "clone", "myrepo", "--branch", "develop"])

        // Check the logged actions
        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 1)
        assert.deepStrictEqual(actions[0], {
          command: "git clone",
          details: {
            repository: "myrepo",
            branch: "develop"
          }
        })
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should handle multiple subcommands correctly", () =>
      Effect.gen(function*() {
        // Test clone subcommand
        yield* runComprehensiveCli(["git", "clone", "repo1"])

        // Test add subcommand
        yield* runComprehensiveCli(["git", "add", "file1", "--update"])

        // Test status subcommand
        yield* runComprehensiveCli(["git", "status", "--short"])

        // Check the logged actions
        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 3)
        assert.deepStrictEqual(actions[0], {
          command: "git clone",
          details: {
            repository: "repo1",
            branch: "main" // default value
          }
        })
        assert.deepStrictEqual(actions[1], {
          command: "git add",
          details: {
            files: "file1",
            update: true
          }
        })
        assert.deepStrictEqual(actions[2], {
          command: "git status",
          details: {
            short: true
          }
        })
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should handle nested config structures in subcommands", () =>
      Effect.gen(function*() {
        yield* runComprehensiveCli([
          "app",
          "--env",
          "prod",
          "deploy",
          "api-service",
          "production",
          "--db-host",
          "localhost",
          "--db-port",
          "5432",
          "--dry-run"
        ])

        // Check the logged actions
        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 1)
        assert.deepStrictEqual(actions[0], {
          command: "deploy",
          details: {
            service: "api-service",
            environment: "production",
            database: {
              host: "localhost",
              port: 5432
            },
            dryRun: true
          }
        })
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should execute parent handler with options when no subcommand provided", () =>
      Effect.gen(function*() {
        // Use git command with only --verbose flag (git doesn't have an "unknown" option)
        // This will execute the parent git handler instead of trying to match subcommands
        yield* runComprehensiveCli(["git", "--verbose"])

        // Check the logged actions
        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 1)
        assert.deepStrictEqual(actions[0], {
          command: "git",
          details: {
            verbose: true
          }
        })
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should propagate subcommand errors", () =>
      Effect.gen(function*() {
        const result = (yield* Effect.flip(
          runComprehensiveCli(["test-failing", "--input", "test"]).pipe(Effect.provide(TestLayer))
        )) as unknown as string

        assert.strictEqual(result, "Handler error")
      }))

    it.effect("should provide parent context to subcommands", () =>
      Effect.gen(function*() {
        const messages: Array<string> = []

        // Create parent command
        const parent = Command.make("parent", {
          verbose: Flag.boolean("verbose"),
          config: Flag.string("config")
        }, (config) => Effect.sync(() => messages.push(`parent: config=${config.config}`)))

        // Create subcommand that accesses parent context
        const child = Command.make("child", {
          action: Flag.string("action")
        }, (config) =>
          Effect.gen(function*() {
            // Access parent config via the auto-generated tag
            const parentConfig = yield* parent.tag
            messages.push(`child: parent.verbose=${parentConfig.verbose}`)
            messages.push(`child: parent.config=${parentConfig.config}`)
            messages.push(`child: action=${config.action}`)
          }))

        // Combine parent and child
        const combined = parent.pipe(
          Command.withSubcommands(child)
        )

        const runCommand = Command.runWithArgs(combined, { version: "1.0.0" })
        yield* runCommand([
          "--verbose",
          "--config",
          "prod.json",
          "child",
          "--action",
          "deploy"
        ]).pipe(Effect.provide(TestLayer))

        assert.deepStrictEqual(messages, [
          "child: parent.verbose=true",
          "child: parent.config=prod.json",
          "child: action=deploy"
        ])
      }))

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
            const parentConfig = yield* root.tag
            messages.push(`install: global=${parentConfig.global}, pkg=${config.pkg}`)
          }))

        const npm = root.pipe(Command.withSubcommands(install))

        const runNpm = Command.runWithArgs(npm, { version: "1.0.0" })

        // Global before subcommand
        yield* runNpm(["--global", "install", "--pkg", "cowsay"]).pipe(Effect.provide(TestLayer))
        // Global after subcommand
        yield* runNpm(["install", "--pkg", "cowsay", "--global"]).pipe(Effect.provide(TestLayer))

        assert.deepStrictEqual(messages, [
          "install: global=true, pkg=cowsay",
          "install: global=true, pkg=cowsay"
        ])
      }))

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
            const rootConfig = yield* root.tag
            messages.push(`service: root.env=${rootConfig.env}`)
            messages.push(`service: name=${config.name}`)
          }))

        // Create leaf command that accesses both parent contexts
        const deploy = Command.make("deploy", {
          targetVersion: Flag.string("target-version")
        }, (config) =>
          Effect.gen(function*() {
            const rootConfig = yield* root.tag
            const serviceConfig = yield* service.tag
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

        const runCommand = Command.runWithArgs(appWithService, { version: "1.0.0" })
        yield* runCommand([
          "--env",
          "production",
          "service",
          "--name",
          "api",
          "deploy",
          "--target-version",
          "1.0.0"
        ]).pipe(Effect.provide(TestLayer))

        assert.deepStrictEqual(messages, [
          "deploy: root.env=production",
          "deploy: service.name=api",
          "deploy: target-version=1.0.0"
        ])
      }))

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
            const parentConfig = yield* parent.tag
            messages.push(`deploy: parent.verbose=${parentConfig.verbose}`)
            messages.push(`deploy: target-version=${config.targetVersion}`)
          }))

        // Combine commands
        const combined = parent.pipe(
          Command.withSubcommands(deploy)
        )

        const runCommand = Command.runWithArgs(combined, { version: "1.0.0" })
        yield* runCommand([
          "--config",
          "prod.json",
          "--verbose", // Boolean flag without explicit value
          "deploy", // This should be recognized as subcommand, not as value for --verbose
          "--target-version",
          "1.0.0"
        ]).pipe(Effect.provide(TestLayer))

        assert.deepStrictEqual(messages, [
          "deploy: parent.verbose=true",
          "deploy: target-version=1.0.0"
        ])
      }))

    it.effect("should support options before, after, or between operands (relaxed POSIX Syntax Guideline No. 9)", () =>
      Effect.gen(function*() {
        // Test both orderings work: POSIX (options before operands) and modern (mixed)

        // Test 1: POSIX style - options before operands
        yield* runComprehensiveCli([
          "copy",
          "--recursive",
          "--force",
          "src.txt",
          "dest.txt"
        ])

        // Test 2: Modern style - options after operands
        yield* runComprehensiveCli([
          "copy",
          "src.txt",
          "dest.txt",
          "--recursive",
          "--force"
        ])

        // Test 3: Mixed style - some options before, some after
        yield* runComprehensiveCli([
          "copy",
          "--recursive",
          "src.txt",
          "dest.txt",
          "--force"
        ])

        // Check all three commands worked
        const actions = yield* TestActions.getActions
        assert.strictEqual(actions.length, 3)

        // All should have the same config regardless of order
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
        // Test unknown subcommand with suggestion - "cpy" should suggest "copy"
        const runCommand = Command.runWithArgs(comprehensiveCli, { version: "1.0.0" })
        yield* runCommand(["cpy"])

        // Capture the error output
        const errorOutput = yield* TestConsole.errorLines
        const errorText = errorOutput.join("\n")

        expect(errorText).toMatchInlineSnapshot(`
          "Unknown subcommand "cpy" for "mycli"

          Did you mean this?
          	copy"
        `)
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should suggest similar subcommands for nested unknown subcommands", () =>
      Effect.gen(function*() {
        // Test unknown nested subcommand with suggestion - "usrs" should suggest "users"
        const runCommand = Command.runWithArgs(comprehensiveCli, { version: "1.0.0" })
        yield* runCommand(["admin", "usrs", "list"])

        // Capture the error output
        const errorOutput = yield* TestConsole.errorLines
        const errorText = errorOutput.join("\n")

        expect(errorText).toMatchInlineSnapshot(`
          "Unknown subcommand "usrs" for "mycli admin"

          Did you mean this?
          	users"
        `)
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should suggest similar options for unrecognized options", () =>
      Effect.gen(function*() {
        // Test unrecognized option with suggestion - "--debugs" should suggest "--debug"
        const runCommand = Command.runWithArgs(comprehensiveCli, { version: "1.0.0" })
        yield* runCommand(["--debugs", "copy", "src.txt", "dest.txt"])

        // Capture the error output
        const errorOutput = yield* TestConsole.errorLines
        const errorText = errorOutput.join("\n")

        expect(errorText).toMatchInlineSnapshot(`
          "Unrecognized flag: --debugs in command mycli

          Did you mean this?
          	--debug"
        `)
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should suggest similar short options for unrecognized short options", () =>
      Effect.gen(function*() {
        // Test unrecognized short option with suggestion - "-u" suggests similar single-char options
        const runCommand = Command.runWithArgs(comprehensiveCli, { version: "1.0.0" })
        yield* runCommand(["-u", "copy", "src.txt", "dest.txt"])

        // Capture the error output
        const errorOutput = yield* TestConsole.errorLines
        const errorText = errorOutput.join("\n")

        expect(errorText).toMatchInlineSnapshot(`
          "Unrecognized flag: -u in command mycli

          Did you mean this?
          	-d
          	-c
          	-q"
        `)
      }).pipe(Effect.provide(TestLayer)))
  })
})
