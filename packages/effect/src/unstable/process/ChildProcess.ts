/**
 * An Effect-native module for working with child processes.
 *
 * This module uses an AST-based approach where commands are built first
 * using `make` and `pipeTo`, then executed using `spawn`.
 *
 * @example
 * ```ts
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect, Stream } from "effect"
 * import { ChildProcess } from "effect/unstable/process"
 *
 * // Build a command
 * const command = ChildProcess.make`echo "hello world"`
 *
 * // Spawn and collect output
 * const program = Effect.gen(function*() {
 *   // You can `yield*` a command, which calls `ChildProcess.spawn`
 *   const handle = yield* command
 *   const chunks = yield* Stream.runCollect(handle.stdout)
 *   const exitCode = yield* handle.exitCode
 *   return { chunks, exitCode }
 * }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
 *
 * // With options
 * const withOptions = ChildProcess.make({ cwd: "/tmp" })`ls -la`
 *
 * // Piping commands
 * const pipeline = ChildProcess.make`cat package.json`.pipe(
 *   ChildProcess.pipeTo(ChildProcess.make`grep name`)
 * )
 *
 * // Spawn the pipeline
 * const pipelineProgram = Effect.gen(function*() {
 *   const handle = yield* pipeline
 *   const chunks = yield* Stream.runCollect(handle.stdout)
 *   return chunks
 * }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
 * ```
 *
 * @since 4.0.0
 */
import type * as Duration from "../../Duration.ts"
import * as Effect from "../../Effect.ts"
import { dual } from "../../Function.ts"
import { PipeInspectableProto, YieldableProto } from "../../internal/core.ts"
import type { Pipeable } from "../../Pipeable.ts"
import type * as PlatformError from "../../PlatformError.ts"
import * as Predicate from "../../Predicate.ts"
import type * as Scope from "../../Scope.ts"
import type * as Sink from "../../Sink.ts"
import * as Stream from "../../Stream.ts"
import type { ChildProcessHandle, ExitCode } from "./ChildProcessSpawner.ts"
import { ChildProcessSpawner } from "./ChildProcessSpawner.ts"

const TypeId = "~effect/unstable/process/ChildProcess"

/**
 * A command that can be executed as a child process.
 *
 * Commands are built using `make` and can be combined using `pipeTo`.
 * They are executed using `exec` or `spawn`.
 *
 * @since 4.0.0
 * @category Models
 */
export type Command =
  | StandardCommand
  | TemplatedCommand
  | PipedCommand

/**
 * A standard command with pre-parsed command and arguments.
 *
 * @since 4.0.0
 * @category Models
 */
export interface StandardCommand extends
  Pipeable,
  Effect.Yieldable<
    StandardCommand,
    ChildProcessHandle,
    PlatformError.PlatformError,
    ChildProcessSpawner | Scope.Scope
  >
{
  readonly _tag: "StandardCommand"
  readonly command: string
  readonly args: ReadonlyArray<string>
  readonly options: CommandOptions
}

/**
 * A templated command that stores unparsed template information.
 *
 * @since 4.0.0
 * @category Models
 */
export interface TemplatedCommand extends
  Pipeable,
  Effect.Yieldable<
    TemplatedCommand,
    ChildProcessHandle,
    PlatformError.PlatformError,
    ChildProcessSpawner | Scope.Scope
  >
{
  readonly _tag: "TemplatedCommand"
  readonly templates: TemplateStringsArray
  readonly expressions: ReadonlyArray<TemplateExpression>
  readonly options: CommandOptions
}

/**
 * A pipeline of commands where the output of one is piped to the input of the
 * next.
 *
 * @since 4.0.0
 * @category Models
 */
export interface PipedCommand extends
  Pipeable,
  Effect.Yieldable<
    PipedCommand,
    ChildProcessHandle,
    PlatformError.PlatformError,
    ChildProcessSpawner | Scope.Scope
  >
{
  readonly _tag: "PipedCommand"
  readonly left: Command
  readonly right: Command
  readonly options: PipeOptions
}

/**
 * Specifies which stream to pipe from the source subprocess.
 *
 * - `"stdout"`: Pipe stdout from the source (default)
 * - `"stderr"`: Pipe stderr from the source
 * - `"all"`: Pipe both stdout and stderr interleaved
 * - `` `fd${number}` ``: Pipe from a custom file descriptor (e.g., `"fd3"`)
 *
 * @since 4.0.0
 * @category Models
 */
export type PipeFromOption = "stdout" | "stderr" | "all" | `fd${number}`

/**
 * Specifies which input to pipe to on the destination subprocess.
 *
 * - `"stdin"`: Pipe to stdin of the destination (default)
 * - `` `fd${number}` ``: Pipe to a custom file descriptor (e.g., `"fd3"`)
 *
 * @since 4.0.0
 * @category Models
 */
export type PipeToOption = "stdin" | `fd${number}`

/**
 * Options for controlling how commands are piped together.
 *
 * @example
 * ```ts
 * import { ChildProcess } from "effect/unstable/process"
 *
 * // Pipe stderr instead of stdout
 * const pipeline = ChildProcess.make`my-program`.pipe(
 *   ChildProcess.pipeTo(ChildProcess.make`grep error`, { from: "stderr" })
 * )
 * ```
 *
 * @since 4.0.0
 * @category Models
 */
export interface PipeOptions {
  /**
   * Which stream to pipe from the source subprocess.
   *
   * - `"stdout"` (default): Pipe stdout from the source
   * - `"stderr"`: Pipe stderr from the source
   * - `"all"`: Pipe both stdout and stderr interleaved
   * - `"fd3"`, `"fd4"`, etc.: Pipe from a custom file descriptor
   */
  readonly from?: PipeFromOption | undefined

  /**
   * Which input to pipe to on the destination subprocess.
   *
   * - `"stdin"` (default): Pipe to stdin of the destination
   * - `"fd3"`, `"fd4"`, etc.: Pipe to a custom file descriptor
   */
  readonly to?: PipeToOption | undefined
}

/**
 * Input type for child process stdin.
 *
 * @since 4.0.0
 * @category Models
 */
export type CommandInput =
  | "pipe"
  | "inherit"
  | "ignore"
  | "overlapped"
  | Stream.Stream<Uint8Array, PlatformError.PlatformError>

/**
 * Output type for child process stdout/stderr.
 *
 * @since 4.0.0
 * @category Models
 */
export type CommandOutput =
  | "pipe"
  | "inherit"
  | "ignore"
  | "overlapped"
  | Sink.Sink<Uint8Array, Uint8Array, never, PlatformError.PlatformError>

/**
 * A signal that can be sent to a child process.
 *
 * @since 4.0.0
 * @category Models
 */
export type Signal =
  | "SIGABRT"
  | "SIGALRM"
  | "SIGBUS"
  | "SIGCHLD"
  | "SIGCONT"
  | "SIGFPE"
  | "SIGHUP"
  | "SIGILL"
  | "SIGINT"
  | "SIGIO"
  | "SIGIOT"
  | "SIGKILL"
  | "SIGPIPE"
  | "SIGPOLL"
  | "SIGPROF"
  | "SIGPWR"
  | "SIGQUIT"
  | "SIGSEGV"
  | "SIGSTKFLT"
  | "SIGSTOP"
  | "SIGSYS"
  | "SIGTERM"
  | "SIGTRAP"
  | "SIGTSTP"
  | "SIGTTIN"
  | "SIGTTOU"
  | "SIGUNUSED"
  | "SIGURG"
  | "SIGUSR1"
  | "SIGUSR2"
  | "SIGVTALRM"
  | "SIGWINCH"
  | "SIGXCPU"
  | "SIGXFSZ"
  | "SIGBREAK"
  | "SIGLOST"
  | "SIGINFO"

/**
 * The encoding format to use for binary data.
 *
 * @since 4.0.0
 * @category Models
 */
export type Encoding =
  | "ascii"
  | "utf8"
  | "utf-8"
  | "utf16le"
  | "utf-16le"
  | "ucs2"
  | "ucs-2"
  | "base64"
  | "base64url"
  | "latin1"
  | "binary"
  | "hex"

/**
 * Options that can be used to control how a child process is terminated.
 *
 * @since 4.0.0
 * @category Models
 */
export interface KillOptions {
  /**
   * The default signal used to terminate the child process.
   *
   * Defaults to `"SIGTERM"`.
   */
  readonly killSignal?: Signal | undefined
  /**
   * The duration of time to wait after the child process has been terminated
   * before forcefully killing the child process by sending it the `"SIGKILL"`
   * signal.
   *
   * Defaults to `undefined`, which means that no timeout will be enforced by
   * default.
   */
  readonly forceKillAfter?: Duration.DurationInput | undefined
}

/**
 * Configuration for the child process standard input stream.
 *
 * @since 4.0.0
 * @category Models
 */
export interface StdinConfig {
  /**
   * The configuration for the standard input stream of the child process.
   *
   * Can be a string indicating how the operating system should configure the
   * pipe established between the child process `stdin` and the parent process.
   *
   * Can also be a `Stream`, which will pipe all elements produced into the
   * `stdin` of the child process.
   *
   * Defaults to "pipe".
   */
  readonly stream: CommandInput
  /**
   * Whether or not the child process `stdin` should be closed after the input
   * stream is finished.
   *
   * Defaults to `true`.
   */
  readonly endOnDone?: boolean | undefined
  /**
   * The buffer encoding to use to decode string chunks.
   *
   * Defaults to `utf-8`.
   */
  readonly encoding?: Encoding | undefined
}

/**
 * Configuration for the child process standard output stream.
 *
 * @since 4.0.0
 * @category Models
 */
export interface StdoutConfig {
  /**
   * The configuration for the standard ouput stream of the child process.
   *
   * Can be a string indicating how the operating system should configure the
   * pipe established between the child process `stdout` and the parent process.
   *
   * A `Sink` can also be passed, which will receive all elements produced by
   * the `stdout` of the child process.
   *
   * Defaults to "pipe".
   */
  readonly stream?: CommandOutput | undefined
}

/**
 * Configuration for the child process standard error stream.
 *
 * @since 4.0.0
 * @category Models
 */
export interface StderrConfig {
  /**
   * The configuration for the standard ouput stream of the child process.
   *
   * Can be a string indicating how the operating system should configure the
   * pipe established between the child process `stderr` and the parent process.
   *
   * A `Sink` can also be passed, which will receive all elements produced by
   * the `stderr` of the child process.
   *
   * Defaults to "pipe".
   */
  readonly stream?: CommandOutput | undefined
}

/**
 * Configuration for additional file descriptors to expose to the child process.
 *
 * @since 4.0.0
 * @category Models
 */
export type AdditionalFdConfig =
  | {
    /**
     * The direction of data flow for this file descriptor.
     * - "input": Data flows from parent to child (writable by parent)
     * - "output": Data flows from child to parent (readable by parent)
     */
    readonly type: "input"
    /**
     * For input file descriptors, an optional stream to pipe into the file
     * descriptor..
     */
    readonly stream?: Stream.Stream<Uint8Array, PlatformError.PlatformError> | undefined
  }
  | {
    /**
     * The direction of data flow for this file descriptor.
     * - "input": Data flows from parent to child (writable by parent)
     * - "output": Data flows from child to parent (readable by parent)
     */
    readonly type: "output"
    /**
     * For output file descriptors, an optional sink which receives data from
     * the file descriptor.
     */
    readonly sink?: Sink.Sink<Uint8Array, Uint8Array, never, PlatformError.PlatformError> | undefined
  }

/**
 * Options for command execution.
 *
 * @since 4.0.0
 * @category Models
 */
export interface CommandOptions extends KillOptions {
  /**
   * The current working directory of the child process.
   */
  readonly cwd?: string | undefined
  /**
   * The environment of the child process.
   *
   * If `extendEnv` is set to `true`, the value of `env` will be merged with
   * the value of `globalThis.process.env`, prioritizing the values in `env`
   * when conflicts exist.
   */
  readonly env?: Record<string, string> | undefined
  /**
   * If set to `true`, the child process uses both the values in `env` as well
   * as the values in `globalThis.process.env`, prioritizing the values in `env`
   * when conflicts exist.
   *
   * If set to `false`, only the value of `env` is used.
   */
  readonly extendEnv?: boolean | undefined
  /**
   * If set to `true`, runs the command inside of a shell, defaulting to `/bin/sh`
   * on UNIX systems and `cmd.exe` on Windows.
   *
   * Can also be set to a string representing the absolute path to a shell to
   * use on the system.
   *
   * It is generally disadvised to use this option.
   */
  readonly shell?: boolean | string | undefined
  /**
   * If set to `true`, the child process will run independently of the parent
   * process.
   *
   * The specific behavior of this option depends upon the platform. For
   * example, the NodeJS documentation outlines the differences between Windows
   * and non-Windows platforms.
   *
   * See https://nodejs.org/api/child_process.html#child_process_options_detached.
   *
   * Defaults to `true` on non-Windows platforms and `false` on Windows platforms.
   */
  readonly detached?: boolean | undefined
  /**
   * Configuration options for the standard input stream for the child process.
   */
  readonly stdin?: CommandInput | StdinConfig | undefined
  /**
   * Configuration options for the standard output stream for the child process.
   */
  readonly stdout?: CommandOutput | StdoutConfig | undefined
  /**
   * Configuration options for the standard error stream for the child process.
   */
  readonly stderr?: CommandOutput | StderrConfig | undefined
  /**
   * Additional file descriptors to expose to the child process beyond `stdin` /
   * `stdout` / `stderr`.
   *
   * Keys must be in the format `"fd3"`, `"fd4"`, etc. with a file descriptor
   * index >= 3.
   *
   * The file descriptor index is determined by the numeric suffix (i.e. `fd3`
   * has a file descriptor index of 3).
   *
   * @example
   * ```ts
   * import { ChildProcess } from "effect/unstable/process"
   *
   * // Output fd3 - read data from child
   * const cmd1 = ChildProcess.make("my-program", [], {
   *   additionalFds: {
   *     fd3: { type: "output" }
   *   }
   * })
   *
   * // Input fd3 - write data to child
   * const cmd2 = ChildProcess.make("my-program", [], {
   *   additionalFds: {
   *     fd3: { type: "input" }
   *   }
   * })
   * ```
   */
  readonly additionalFds?: Record<`fd${number}`, AdditionalFdConfig> | undefined
}

/**
 * Valid template expression item types.
 *
 * @since 4.0.0
 * @category Models
 */
export type TemplateExpressionItem = string | number | boolean

/**
 * Template expression type for interpolated values.
 *
 * @since 4.0.0
 * @category Models
 */
export type TemplateExpression = TemplateExpressionItem | ReadonlyArray<TemplateExpressionItem>

// =============================================================================
// Constructors
// =============================================================================

const Proto = {
  ...PipeInspectableProto,
  ...YieldableProto,
  [TypeId]: TypeId,
  asEffect(this: Command) {
    return spawn(this)
  }
}

/**
 * Check if a value is a `Command`.
 *
 * @since 4.0.0
 * @category Guards
 */
export const isCommand = (u: unknown): u is Command => Predicate.hasProperty(u, TypeId)

/**
 * Check if a command is a `StandardCommand`.
 *
 * @since 4.0.0
 * @category Guards
 */
export const isStandardCommand = (command: Command): command is StandardCommand => command._tag === "StandardCommand"

/**
 * Check if a command is a `TemplatedCommand`.
 *
 * @since 4.0.0
 * @category Guards
 */
export const isTemplatedCommand = (command: Command): command is TemplatedCommand => command._tag === "TemplatedCommand"

/**
 * Check if a command is a `PipedCommand`.
 *
 * @since 4.0.0
 * @category Guards
 */
export const isPipedCommand = (command: Command): command is PipedCommand => command._tag === "PipedCommand"

const makeStandardCommand = (
  command: string,
  args: ReadonlyArray<string>,
  options: CommandOptions
): StandardCommand =>
  Object.assign(Object.create(Proto), {
    _tag: "StandardCommand",
    command,
    args,
    options
  })

const makeTemplatedCommand = (
  templates: TemplateStringsArray,
  expressions: ReadonlyArray<TemplateExpression>,
  options: CommandOptions
): TemplatedCommand =>
  Object.assign(Object.create(Proto), {
    _tag: "TemplatedCommand",
    templates,
    expressions,
    options
  })

const makePipedCommand = (
  left: Command,
  right: Command,
  options: PipeOptions = {}
): PipedCommand =>
  Object.assign(Object.create(Proto), {
    _tag: "PipedCommand",
    left,
    right,
    options
  })

/**
 * Create a command from a template literal, options + template, or array form.
 *
 * This function supports three calling conventions:
 * 1. Template literal: `make\`npm run build\``
 * 2. Options + template literal: `make({ cwd: "/app" })\`npm run build\``
 * 3. Array form: `make("npm", ["run", "build"], options?)`
 *
 * Template literals are not parsed until execution time, allowing parsing
 * errors to flow through Effect's error channel.
 *
 * @example
 * ```ts
 * import { ChildProcess } from "effect/unstable/process"
 *
 * // Template literal form
 * const cmd1 = ChildProcess.make`echo "hello"`
 *
 * // With options
 * const cmd2 = ChildProcess.make({ cwd: "/tmp" })`ls -la`
 *
 * // Array form
 * const cmd3 = ChildProcess.make("git", ["status"])
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const make: {
  (
    command: string,
    options?: CommandOptions
  ): StandardCommand
  (
    command: string,
    args: ReadonlyArray<string>,
    options?: CommandOptions
  ): StandardCommand
  (
    options: CommandOptions
  ): (
    templates: TemplateStringsArray,
    ...expressions: ReadonlyArray<TemplateExpression>
  ) => TemplatedCommand
  (
    templates: TemplateStringsArray,
    ...expressions: ReadonlyArray<TemplateExpression>
  ): TemplatedCommand
} = function make(...args: Array<unknown>): any {
  // Template literal form: make`command`
  if (isTemplateString(args[0])) {
    const [templates, ...expressions] = args as [TemplateStringsArray, ...ReadonlyArray<TemplateExpression>]
    return makeTemplatedCommand(templates, expressions, {})
  }

  // Options form: make({ cwd: "/tmp" })`command`
  if (typeof args[0] === "object" && !Array.isArray(args[0]) && !isTemplateString(args[0])) {
    const options = args[0] as CommandOptions
    return function(
      templates: TemplateStringsArray,
      ...expressions: ReadonlyArray<TemplateExpression>
    ): TemplatedCommand {
      return makeTemplatedCommand(templates, expressions, options)
    }
  }

  // Standard form without arguments: make("command", options?)
  if (typeof args[0] === "string" && !Array.isArray(args[1])) {
    const [command, options = {}] = args as [string, CommandOptions?]
    return makeStandardCommand(command, [], options)
  }

  // Standard form with arguments: make("command", ["arg1", "arg2"], options?)
  const [command, cmdArgs = [], options = {}] = args as [
    string,
    ReadonlyArray<string>?,
    CommandOptions?
  ]
  return makeStandardCommand(command, cmdArgs, options)
}

/**
 * Pipe the output of one command to the input of another.
 *
 * By default, pipes `stdout` from the source to `stdin` of the destination.
 * Use the `options` parameter to customize which streams are connected.
 *
 * @example
 * ```ts
 * import { ChildProcess } from "effect/unstable/process"
 *
 * // Pipe stdout (default)
 * const pipeline1 = ChildProcess.make`cat file.txt`.pipe(
 *   ChildProcess.pipeTo(ChildProcess.make`grep pattern`)
 * )
 *
 * // Pipe stderr instead of stdout
 * const pipeline2 = ChildProcess.make`my-program`.pipe(
 *   ChildProcess.pipeTo(ChildProcess.make`grep error`, { from: "stderr" })
 * )
 *
 * // Pipe combined stdout and stderr
 * const pipeline3 = ChildProcess.make`my-program`.pipe(
 *   ChildProcess.pipeTo(ChildProcess.make`tee output.log`, { from: "all" })
 * )
 * ```
 *
 * @since 4.0.0
 * @category Combinators
 */
export const pipeTo: {
  (that: Command, options?: PipeOptions): (self: Command) => PipedCommand
  (self: Command, that: Command, options?: PipeOptions): PipedCommand
} = dual(
  (args) => isCommand(args[0]) && isCommand(args[1]),
  (self: Command, that: Command, options?: PipeOptions) => makePipedCommand(self, that, options ?? {})
)

/**
 * Set the current working directory for a command.
 *
 * For pipelines, applies to each command in the pipeline.
 *
 * @example
 * ```ts
 * import { ChildProcess } from "effect/unstable/process"
 *
 * const cmd = ChildProcess.make`ls -la`.pipe(
 *   ChildProcess.setCwd("/tmp")
 * )
 * ```
 *
 * @since 4.0.0
 * @category Combinators
 */
export const setCwd: {
  (cwd: string): (self: Command) => Command
  (self: Command, cwd: string): Command
} = dual(
  (args) => isCommand(args[0]),
  (self: Command, cwd: string): Command => {
    switch (self._tag) {
      case "StandardCommand": {
        return makeStandardCommand(self.command, self.args, { ...self.options, cwd })
      }
      case "TemplatedCommand": {
        return makeTemplatedCommand(self.templates, self.expressions, { ...self.options, cwd })
      }
      case "PipedCommand": {
        return makePipedCommand(setCwd(self.left, cwd), setCwd(self.right, cwd), self.options)
      }
    }
  }
)

/**
 * Spawn a command and return a handle for interaction.
 *
 * Unlike `exec`, this does not wait for the process to complete. Instead,
 * it returns a handle that provides access to the process's stdin, stdout,
 * stderr streams and exit code.
 *
 * Note: For piped commands, only the first command in the pipeline is spawned
 * and a handle to it is returned.
 *
 * @example
 * ```ts
 * import { NodeServices } from "@effect/platform-node"
 * import { Console, Effect, Stream } from "effect"
 * import { ChildProcess } from "effect/unstable/process"
 *
 * const program = Effect.gen(function*() {
 *   const cmd = ChildProcess.make`long-running-process`
 *   const handle = yield* ChildProcess.spawn(cmd)
 *
 *   // Stream stdout
 *   yield* handle.stdout.pipe(
 *     Stream.decodeText(),
 *     Stream.runForEach(Console.log),
 *     Effect.forkChild
 *   )
 *
 *   // Wait for exit
 *   const exitCode = yield* handle.exitCode
 *   yield* Console.log(`Process exited with code ${exitCode}`)
 * }).pipe(Effect.provide(NodeServices.layer))
 * ```
 *
 * @since 4.0.0
 * @category Execution
 */
export const spawn = (command: Command): Effect.Effect<
  ChildProcessHandle,
  PlatformError.PlatformError,
  ChildProcessSpawner | Scope.Scope
> => ChildProcessSpawner.use((_) => _.spawn(command))

/**
 * @since 4.0.0
 * @category Execution
 */
export const exitCode = (command: Command): Effect.Effect<
  ExitCode,
  PlatformError.PlatformError,
  ChildProcessSpawner
> => Effect.scoped(Effect.flatMap(spawn(command), (handle) => handle.exitCode))

/**
 * @since 4.0.0
 * @category Execution
 */
export const streamString: {
  (options?: {
    readonly includeStderr?: boolean | undefined
  }): (self: Command) => Stream.Stream<string, PlatformError.PlatformError, ChildProcessSpawner>
  (self: Command, options?: {
    readonly includeStderr?: boolean | undefined
  }): Stream.Stream<string, PlatformError.PlatformError, ChildProcessSpawner>
} = dual(
  (args) => isCommand(args[0]),
  (
    self: Command,
    options?: { readonly includeStderr?: boolean | undefined }
  ): Stream.Stream<
    string,
    PlatformError.PlatformError,
    ChildProcessSpawner
  > =>
    spawn(self).pipe(
      Effect.map((handle) =>
        Stream.decodeText(
          options?.includeStderr === true ? handle.all : handle.stdout
        )
      ),
      Stream.unwrap
    )
)

/**
 * @since 4.0.0
 * @category Execution
 */
export const streamLines: {
  (options?: {
    readonly includeStderr?: boolean | undefined
  }): (self: Command) => Stream.Stream<string, PlatformError.PlatformError, ChildProcessSpawner>
  (self: Command, options?: {
    readonly includeStderr?: boolean | undefined
  }): Stream.Stream<string, PlatformError.PlatformError, ChildProcessSpawner>
} = dual(
  (args) => isCommand(args[0]),
  (self: Command, options?: { readonly includeStderr?: boolean | undefined }): Stream.Stream<
    string,
    PlatformError.PlatformError,
    ChildProcessSpawner
  > => Stream.splitLines(streamString(self, options))
)

/**
 * @since 4.0.0
 * @category Execution
 */
export const lines: {
  (options?: {
    readonly includeStderr?: boolean | undefined
  }): (self: Command) => Effect.Effect<Array<string>, PlatformError.PlatformError, ChildProcessSpawner>
  (self: Command, options?: {
    readonly includeStderr?: boolean | undefined
  }): Effect.Effect<Array<string>, PlatformError.PlatformError, ChildProcessSpawner>
} = dual(
  (args) => isCommand(args[0]),
  (
    self: Command,
    options?: { readonly includeStderr?: boolean | undefined }
  ): Effect.Effect<
    Array<string>,
    PlatformError.PlatformError,
    ChildProcessSpawner
  > => Stream.runCollect(streamLines(self, options))
)

/**
 * @since 4.0.0
 * @category Execution
 */
export const string: {
  (options?: {
    readonly includeStderr?: boolean | undefined
  }): (self: Command) => Effect.Effect<string, PlatformError.PlatformError, ChildProcessSpawner>
  (self: Command, options?: {
    readonly includeStderr?: boolean | undefined
  }): Effect.Effect<string, PlatformError.PlatformError, ChildProcessSpawner>
} = dual(
  (args) => isCommand(args[0]),
  (
    self: Command,
    options?: { readonly includeStderr?: boolean | undefined }
  ): Effect.Effect<
    string,
    PlatformError.PlatformError,
    ChildProcessSpawner
  > => Stream.mkString(streamString(self, options))
)

const isTemplateString = (u: unknown): u is TemplateStringsArray =>
  Array.isArray(u) && "raw" in u && Array.isArray(u.raw)

// =============================================================================
// Utilities
// =============================================================================

/**
 * Parse an fd name like "fd3" to its numeric index.
 * Returns undefined if the name is invalid.
 *
 * @since 4.0.0
 * @category Utilities
 */
export const parseFdName = (name: string): number | undefined => {
  const match = /^fd(\d+)$/.exec(name)
  if (match === null) return undefined
  const fd = parseInt(match[1], 10)
  return fd >= 3 ? fd : undefined
}

/**
 * Create an fd name from its numeric index.
 *
 * @since 4.0.0
 * @category Utilities
 */
export const fdName = (fd: number): string => `fd${fd}`
