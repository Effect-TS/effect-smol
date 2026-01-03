import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { Command, Flag } from "effect/unstable/cli"
import { generateDynamicFishCompletion } from "effect/unstable/cli/internal/completions/dynamic/fish"
import {
  generateDynamicCompletions,
  getCompletionContext,
  handleCompletionRequest
} from "effect/unstable/cli/internal/completions/dynamic/handler"

describe("Dynamic Completion Handler", () => {
  describe("getCompletionContext", () => {
    it.effect("should extract context from environment variables", () =>
      Effect.gen(function*() {
        const originalEnv = { ...process.env }

        try {
          // Set up completion environment
          process.env.COMP_CWORD = "2"
          process.env.COMP_LINE = "myapp build --watch"
          process.env.COMP_POINT = "17"

          const context = getCompletionContext()

          assert.isNotNull(context)
          assert.strictEqual(context!.currentIndex, 2)
          assert.strictEqual(context!.line, "myapp build --watch")
          assert.strictEqual(context!.point, 17)
          assert.deepStrictEqual(context!.words, ["myapp", "build", "--watch"])
          assert.strictEqual(context!.currentWord, "--watch")
        } finally {
          process.env = originalEnv
        }
      }))

    it.effect("should return null when missing environment variables", () =>
      Effect.gen(function*() {
        const originalEnv = { ...process.env }

        try {
          delete process.env.COMP_CWORD
          delete process.env.COMP_LINE

          const context = getCompletionContext()

          assert.isNull(context)
        } finally {
          process.env = originalEnv
        }
      }))

    it.effect("should handle empty current word", () =>
      Effect.gen(function*() {
        const originalEnv = { ...process.env }
        const originalArgv = process.argv.slice()

        try {
          process.env.COMP_CWORD = "2"
          process.env.COMP_LINE = "myapp build "

          const context = getCompletionContext()

          assert.isNotNull(context)
          assert.strictEqual(context!.currentWord, "")
          assert.strictEqual(context!.currentIndex, 2)
        } finally {
          process.env = originalEnv
          process.argv = originalArgv
        }
      }))

    it.effect("should prefer argv tokens when provided", () =>
      Effect.gen(function*() {
        const originalEnv = { ...process.env }
        const originalArgv = process.argv.slice()

        try {
          process.env.COMP_CWORD = "2"
          process.env.COMP_LINE = "myapp build path with spaces"
          process.env.COMP_POINT = "29"

          process.argv = [
            ...originalArgv.slice(0, 2),
            "--get-completions",
            "myapp",
            "build",
            "path with spaces"
          ]

          const context = getCompletionContext()

          assert.isNotNull(context)
          assert.deepStrictEqual(context!.words, ["myapp", "build", "path with spaces"])
          assert.strictEqual(context!.currentWord, "path with spaces")
        } finally {
          process.env = originalEnv
          process.argv = originalArgv
        }
      }))
  })

  describe("generateDynamicCompletions", () => {
    const createTestCommand = () => {
      const build = Command.make("build", {
        watch: Flag.boolean("watch").pipe(Flag.withAlias("w")),
        outDir: Flag.directory("out-dir").pipe(Flag.withAlias("o")),
        target: Flag.string("target")
      }, () => Effect.void).pipe(
        Command.withDescription("Build the project")
      )

      const deploy = Command.make("deploy", {
        dryRun: Flag.boolean("dry-run")
      }).pipe(
        Command.withDescription("Deploy the application"),
        Command.withSubcommands([
          Command.make("staging", {
            force: Flag.boolean("force")
          }, () => Effect.void),
          Command.make("production", {
            confirm: Flag.boolean("confirm")
          }, () => Effect.void)
        ])
      )

      return Command.make("myapp", {
        verbose: Flag.boolean("verbose").pipe(Flag.withAlias("v")),
        config: Flag.file("config").pipe(Flag.withAlias("c"))
      }).pipe(
        Command.withSubcommands([build, deploy])
      )
    }

    it.effect("should complete root level subcommands", () =>
      Effect.gen(function*() {
        const cmd = createTestCommand()
        const context = {
          words: ["myapp", ""],
          currentWord: "",
          currentIndex: 1,
          line: "myapp ",
          point: 6
        }

        const completions = generateDynamicCompletions(cmd, context)

        assert.isTrue(completions.includes("build"))
        assert.isTrue(completions.includes("deploy"))
      }))

    it.effect("should complete partial subcommand names", () =>
      Effect.gen(function*() {
        const cmd = createTestCommand()
        const context = {
          words: ["myapp", "bu"],
          currentWord: "bu",
          currentIndex: 1,
          line: "myapp bu",
          point: 8
        }

        const completions = generateDynamicCompletions(cmd, context)

        assert.isTrue(completions.includes("build"))
        assert.isFalse(completions.includes("deploy"))
      }))

    it.effect("should complete flags when current word starts with dash", () =>
      Effect.gen(function*() {
        const cmd = createTestCommand()
        const context = {
          words: ["myapp", "build", "--"],
          currentWord: "--",
          currentIndex: 2,
          line: "myapp build --",
          point: 14
        }

        const completions = generateDynamicCompletions(cmd, context)

        assert.isTrue(completions.includes("--watch"))
        assert.isTrue(completions.includes("--out-dir"))
        assert.isTrue(completions.includes("--target"))
      }))

    it.effect("should include short aliases when completing a single dash", () =>
      Effect.gen(function*() {
        const cmd = createTestCommand()
        const context = {
          words: ["myapp", "build", "-"],
          currentWord: "-",
          currentIndex: 2,
          line: "myapp build -",
          point: 13
        }

        const completions = generateDynamicCompletions(cmd, context)

        assert.isTrue(completions.includes("-w"))
        assert.isTrue(completions.includes("-o"))
      }))

    it.effect("should complete short flag aliases when specifically requested", () =>
      Effect.gen(function*() {
        const cmd = createTestCommand()
        const context = {
          words: ["myapp", "build", "-w"],
          currentWord: "-w",
          currentIndex: 2,
          line: "myapp build -w",
          point: 14
        }

        const completions = generateDynamicCompletions(cmd, context)

        assert.isTrue(completions.includes("-w"))
      }))

    it.effect("should complete nested subcommands", () =>
      Effect.gen(function*() {
        const cmd = createTestCommand()
        const context = {
          words: ["myapp", "deploy", ""],
          currentWord: "",
          currentIndex: 2,
          line: "myapp deploy ",
          point: 13
        }

        const completions = generateDynamicCompletions(cmd, context)

        assert.isTrue(completions.includes("staging"))
        assert.isTrue(completions.includes("production"))
      }))

    it.effect("should navigate through multiple subcommand levels", () =>
      Effect.gen(function*() {
        const cmd = createTestCommand()
        const context = {
          words: ["myapp", "deploy", "staging", "--"],
          currentWord: "--",
          currentIndex: 3,
          line: "myapp deploy staging --",
          point: 23
        }

        const completions = generateDynamicCompletions(cmd, context)

        assert.isTrue(completions.includes("--force"))
        // Should not include parent command flags
        assert.isFalse(completions.includes("--dry-run"))
      }))

    it.effect("should skip option values when navigating", () =>
      Effect.gen(function*() {
        const cmd = createTestCommand()
        const context = {
          words: ["myapp", "--config", "config.json", "build", ""],
          currentWord: "",
          currentIndex: 4,
          line: "myapp --config config.json build ",
          point: 33
        }

        const completions = generateDynamicCompletions(cmd, context)

        // Should complete build flags, not root subcommands
        assert.isTrue(completions.includes("--watch"))
        assert.isFalse(completions.includes("deploy"))
      }))

    it.effect("should return empty completions for option values", () =>
      Effect.gen(function*() {
        const cmd = createTestCommand()
        const context = {
          words: ["myapp", "build", "--target", ""],
          currentWord: "",
          currentIndex: 3,
          line: "myapp build --target ",
          point: 21
        }

        const completions = generateDynamicCompletions(cmd, context)

        // Should return empty to trigger file completion
        assert.strictEqual(completions.length, 0)
      }))

    it.effect("should emit zsh file completions when option expects a directory", () =>
      Effect.gen(function*() {
        const cmd = createTestCommand()
        const originalEnv = { ...process.env }

        try {
          process.env.EFFECT_COMPLETION_FORMAT = "zsh"

          const context = {
            words: ["myapp", "build", "--out-dir", ""],
            currentWord: "",
            currentIndex: 3,
            line: "myapp build --out-dir ",
            point: 26
          }

          const completions = generateDynamicCompletions(cmd, context)

          assert.deepStrictEqual(completions, ["files\tdirectory"])
        } finally {
          process.env = originalEnv
        }
      }))

    it.effect("should support inline flag assignment for file completions", () =>
      Effect.gen(function*() {
        const cmd = createTestCommand()
        const originalEnv = { ...process.env }

        try {
          process.env.EFFECT_COMPLETION_FORMAT = "zsh"

          const context = {
            words: ["myapp", "--config="],
            currentWord: "--config=",
            currentIndex: 1,
            line: "myapp --config=",
            point: 15
          }

          const completions = generateDynamicCompletions(cmd, context)

          assert.deepStrictEqual(completions, ["files\tfile"])
        } finally {
          process.env = originalEnv
        }
      }))

    it.effect("should handle complex command line with mixed options", () =>
      Effect.gen(function*() {
        const cmd = createTestCommand()
        const context = {
          words: ["myapp", "--verbose", "deploy", "--dry-run", "production", "--"],
          currentWord: "--",
          currentIndex: 5,
          line: "myapp --verbose deploy --dry-run production --",
          point: 46
        }

        const completions = generateDynamicCompletions(cmd, context)

        // Should complete production subcommand flags
        assert.isTrue(completions.includes("--confirm"))
        // Should not include parent flags
        assert.isFalse(completions.includes("--dry-run"))
        assert.isFalse(completions.includes("--verbose"))
      }))

    it.effect("should emit grouped metadata in zsh format", () =>
      Effect.gen(function*() {
        const cmd = createTestCommand()
        const originalEnv = { ...process.env }

        try {
          process.env.EFFECT_COMPLETION_FORMAT = "zsh"

          const rootContext = {
            words: ["myapp", ""],
            currentWord: "",
            currentIndex: 1,
            line: "myapp ",
            point: 6
          }

          const buildContext = {
            words: ["myapp", "build", "--"],
            currentWord: "--",
            currentIndex: 2,
            line: "myapp build --",
            point: 14
          }

          const zshEntries = [
            ...generateDynamicCompletions(cmd, rootContext),
            ...generateDynamicCompletions(cmd, buildContext)
          ]

          assert.isTrue(zshEntries.some((entry) => entry.startsWith("command\tbuild:")))
          assert.isTrue(zshEntries.some((entry) => entry.startsWith("option\t--watch:")))
        } finally {
          process.env = originalEnv
        }
      }))

    it.effect("should emit descriptions in fish format", () =>
      Effect.gen(function*() {
        const cmd = createTestCommand()
        const originalEnv = { ...process.env }

        try {
          process.env.FISH_COMPLETION = "1"

          const rootContext = {
            words: ["myapp", ""],
            currentWord: "",
            currentIndex: 1,
            line: "myapp ",
            point: 6
          }

          const buildContext = {
            words: ["myapp", "build", "--"],
            currentWord: "--",
            currentIndex: 2,
            line: "myapp build --",
            point: 14
          }

          const fishEntries = [
            ...generateDynamicCompletions(cmd, rootContext),
            ...generateDynamicCompletions(cmd, buildContext)
          ]

          // Fish format should include descriptions with tab separation (value\tdescription)
          assert.isTrue(fishEntries.some((entry) => entry.includes("build") && entry.includes("\t")))
          assert.isTrue(fishEntries.some((entry) => entry.includes("--watch") && entry.includes("\t")))

          // Should not include type prefixes like zsh
          assert.isFalse(fishEntries.some((entry) => entry.startsWith("command\t")))
          assert.isFalse(fishEntries.some((entry) => entry.startsWith("option\t")))
        } finally {
          process.env = originalEnv
        }
      }))

    it.effect("should handle empty input gracefully", () =>
      Effect.gen(function*() {
        const cmd = createTestCommand()
        const context = {
          words: [],
          currentWord: "",
          currentIndex: 0,
          line: "",
          point: 0
        }

        const completions = generateDynamicCompletions(cmd, context)

        // Should return empty for malformed input
        assert.strictEqual(completions.length, 0)
      }))

    it.effect("should not complete unknown subcommands", () =>
      Effect.gen(function*() {
        const cmd = createTestCommand()
        const context = {
          words: ["myapp", "unknown", ""],
          currentWord: "",
          currentIndex: 2,
          line: "myapp unknown ",
          point: 14
        }

        const completions = generateDynamicCompletions(cmd, context)

        // Should not find any completions for unknown command
        assert.strictEqual(completions.length, 0)
      }))
  })

  describe("handleCompletionRequest", () => {
    it.effect("should output completions to console", () =>
      Effect.gen(function*() {
        const cmd = Command.make("test", {}).pipe(
          Command.withSubcommands([
            Command.make("sub1", {}, () => Effect.void),
            Command.make("sub2", {}, () => Effect.void)
          ])
        )

        const originalEnv = { ...process.env }
        const originalLog = console.log // oxlint-disable-line no-console
        const logs: Array<string> = []

        try {
          // Mock console.log
          console.log = (msg: string) => { // oxlint-disable-line no-console
            logs.push(msg)
          }

          // Set up completion context
          process.env.COMP_CWORD = "1"
          process.env.COMP_LINE = "test "

          handleCompletionRequest(cmd)

          assert.isTrue(logs.length > 0)
          assert.isTrue(logs.some((log) => log.includes("sub1")))
          assert.isTrue(logs.some((log) => log.includes("sub2")))
        } finally {
          process.env = originalEnv
          console.log = originalLog // oxlint-disable-line no-console
        }
      }))

    it.effect("should handle missing completion context gracefully", () =>
      Effect.gen(function*() {
        const cmd = Command.make("test", {})
        const originalEnv = { ...process.env }

        try {
          delete process.env.COMP_CWORD
          delete process.env.COMP_LINE

          // Should not throw or crash
          handleCompletionRequest(cmd)

          // Test passes if no exception is thrown
          assert.isTrue(true)
        } finally {
          process.env = originalEnv
        }
      }))
  })

  describe("generateDynamicFishCompletion", () => {
    it.effect("should generate fish completion script with function", () =>
      Effect.gen(function*() {
        const script = generateDynamicFishCompletion("myapp", "/usr/local/bin/myapp")

        // Should include function definition
        assert.isTrue(script.includes("function __myapp_complete"))

        // Should include completion registration
        assert.isTrue(script.includes("complete -c myapp -f -a '(__myapp_complete)'"))

        // Should include FISH_COMPLETION environment variable
        assert.isTrue(script.includes("FISH_COMPLETION=1"))

        // Should include installation instructions
        assert.isTrue(script.includes("Installation:"))
        assert.isTrue(script.includes("~/.config/fish/completions/myapp.fish"))

        // Should use the provided executable path
        assert.isTrue(script.includes("/usr/local/bin/myapp --get-completions"))
      }))

    it.effect("should handle executable name without path", () =>
      Effect.gen(function*() {
        const script = generateDynamicFishCompletion("myapp")

        // Should use executable name as path when no explicit path provided
        assert.isTrue(script.includes("myapp --get-completions"))
        assert.isFalse(script.includes("/myapp --get-completions"))
      }))

    it.effect("should include fish-specific command line parsing", () =>
      Effect.gen(function*() {
        const script = generateDynamicFishCompletion("myapp")

        // Should use Fish's commandline builtin
        assert.isTrue(script.includes("commandline -pco"))
        assert.isTrue(script.includes("commandline -ct"))
        assert.isTrue(script.includes("commandline -p"))

        // Should handle Fish's 1-based indexing for compatibility
        assert.isTrue(script.includes("math (count $cmd) - 1"))
      }))
  })
})
