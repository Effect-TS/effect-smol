/**
 * An Effect-native module for working with child processes.
 *
 * This module uses an AST-based approach where commands are built first
 * using `make` and `pipeTo`, then executed using `spawn`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Stream } from "effect/stream"
 * import { ChildProcess } from "effect/unstable/process"
 * import { NodeServices } from "@effect/platform-node"
 *
 * // Build a command
 * const command = ChildProcess.make`echo "hello world"`
 *
 * // Spawn and collect output
 * const program = Effect.gen(function* () {
 *   const handle = yield* ChildProcess.spawn(command)
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
 * const pipelineProgram = Effect.gen(function* () {
 *   const handle = yield* ChildProcess.spawn(pipeline)
 *   const chunks = yield* Stream.runCollect(handle.stdout)
 *   return chunks
 * }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
 * ```
 *
 * @since 4.0.0
 */
import * as Predicate from "../../data/Predicate.ts"
import type * as Duration from "../../Duration.ts"
import * as Effect from "../../Effect.ts"
import { dual } from "../../Function.ts"
import type { Pipeable } from "../../interfaces/Pipeable.ts"
import { pipeArguments } from "../../interfaces/Pipeable.ts"
import type * as PlatformError from "../../platform/PlatformError.ts"
import type * as Scope from "../../Scope.ts"
import type * as Sink from "../../stream/Sink.ts"
import type * as Stream from "../../stream/Stream.ts"
import type { ChildProcessHandle } from "./ChildProcessExecutor.ts"
import { ChildProcessExecutor } from "./ChildProcessExecutor.ts"

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
export interface StandardCommand extends Pipeable {
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
export interface TemplatedCommand extends Pipeable {
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
export interface PipedCommand extends Pipeable {
  readonly _tag: "PipedCommand"
  readonly left: Command
  readonly right: Command
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
   * Configuration options for the standard input stream for the child process.
   */
  readonly stdin?: {
    /**
     * A string indicating how the operating system should configure the pipe
     * established between the child process `stdin` and the parent process.
     *
     * A `Stream` can also be passed, which will pipe all elements produced by
     * the `stdin` of the child process.
     *
     * Defaults to "pipe".
     */
    readonly stdioOption?: CommandInput | undefined
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
    readonly encoding?: BufferEncoding | undefined
  }
  /**
   * Configuration options for the standard output stream for the child process.
   */
  readonly stdout?: {
    /**
     * A string indicating how the operating system should configure the pipe
     * established between the child process `stdout` and the parent process.
     *
     * A `Sink` can also be passed, which will receive all elements produced by
     * the `stdout` of the child process.
     *
     * Defaults to "pipe".
     */
    readonly stdioOption?: CommandOutput | undefined
  } | undefined
  /**
   * Configuration options for the standard error stream for the child process.
   */
  readonly stderr?: {
    /**
     * A string indicating how the operating system should configure the pipe
     * established between the child process `stdout` and the parent process.
     *
     * A `Sink` can also be passed, which will receive all elements produced by
     * the `stdout` of the child process.
     *
     * Defaults to "pipe".
     */
    readonly stdioOption?: CommandOutput | undefined
  } | undefined
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
    templates: TemplateStringsArray,
    ...expressions: ReadonlyArray<TemplateExpression>
  ): TemplatedCommand
  (
    options: CommandOptions
  ): (
    templates: TemplateStringsArray,
    ...expressions: ReadonlyArray<TemplateExpression>
  ) => TemplatedCommand
  (
    command: string,
    args?: ReadonlyArray<string>,
    options?: CommandOptions
  ): StandardCommand
} = function make(...args: Array<unknown>): any {
  // Template literal form: make`command`
  if (isTemplateString(args[0])) {
    const [templates, ...expressions] = args as [TemplateStringsArray, ...ReadonlyArray<TemplateExpression>]
    return makeTemplatedCommand(templates, expressions, {})
  }

  // Options form: make({ cwd: "/tmp" })`command`
  if (typeof args[0] === "object" && args[0] !== null && !Array.isArray(args[0]) && !isTemplateString(args[0])) {
    const options = args[0] as CommandOptions
    return function(
      templates: TemplateStringsArray,
      ...expressions: ReadonlyArray<TemplateExpression>
    ): TemplatedCommand {
      return makeTemplatedCommand(templates, expressions, options)
    }
  }

  // Array form: make("command", ["arg1", "arg2"], options?)
  const [command, cmdArgs = [], options = {}] = args as [
    string,
    ReadonlyArray<string>?,
    CommandOptions?
  ]
  return makeStandardCommand(command, cmdArgs, options)
}

const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments)
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
  right: Command
): PipedCommand =>
  Object.assign(Object.create(Proto), {
    _tag: "PipedCommand",
    left,
    right
  })

/**
 * Pipe the output of one command to the input of another.
 *
 * @example
 * ```ts
 * import { ChildProcess } from "effect/unstable/process"
 *
 * // Pipe stdout (default)
 * const pipeline = ChildProcess.make`cat file.txt`.pipe(
 *   ChildProcess.pipeTo(ChildProcess.make`grep pattern`)
 * )
 * ```
 *
 * @since 4.0.0
 * @category Combinators
 */
export const pipeTo: {
  (that: Command): (self: Command) => PipedCommand
  (self: Command, that: Command): PipedCommand
} = dual(2, (self: Command, that: Command) => makePipedCommand(self, that))

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
 * import { Console, Effect } from "effect"
 * import { Stream } from "effect/stream"
 * import { ChildProcess } from "effect/unstable/process"
 * import { NodeServices } from "@effect/platform-node"
 *
 * const program = Effect.gen(function* () {
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
export const spawn: (command: Command) => Effect.Effect<
  ChildProcessHandle,
  PlatformError.PlatformError,
  ChildProcessExecutor | Scope.Scope
> = Effect.fnUntraced(function*(command) {
  const executor = yield* ChildProcessExecutor
  return yield* executor.spawn(command)
})

const isTemplateString = (u: unknown): u is TemplateStringsArray =>
  Array.isArray(u) && "raw" in u && Array.isArray(u.raw)
