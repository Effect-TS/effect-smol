/**
 * @since 4.0.0
 */
import * as Arr from "../../collections/Array.ts"
import * as Data from "../../data/Data.ts"
import * as Predicate from "../../data/Predicate.ts"
import * as Duration from "../../Duration.ts"
import * as Effect from "../../Effect.ts"
import { dual } from "../../Function.ts"
import * as Inspectable from "../../interfaces/Inspectable.ts"
import { type Pipeable, pipeArguments } from "../../interfaces/Pipeable.ts"
import * as Schema from "../../schema/Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as Sink from "../../stream/Sink.ts"
import type * as Stream from "../../stream/Stream.ts"
import { isTemplateString, parseTemplates } from "./internal/template.ts"

const TypeId = "~effect/process/ChildProcess"

/**
 * @since 4.0.0
 * @category guards
 */
export const isChildProcess = (u: unknown): u is ChildProcess => Predicate.hasProperty(u, TypeId)

// ═══════════════════════════════════════════════════════════════
// STDIO TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Simplified stdio configuration value.
 *
 * - `"pipe"`: Create an Effect Stream (default for capturing output)
 * - `"inherit"`: Use parent process's stdio (for terminal I/O)
 * - `"ignore"`: Discard the stream
 * - `number`: File descriptor number (for advanced use cases)
 * - `Stream`: Input stream (stdin only)
 * - `Sink`: Output sink (stdout/stderr only)
 *
 * Note: Transforms, file I/O, and multiple targets are intentionally excluded.
 * Users should compose these features using Effect Stream operators:
 * - Transforms: Use `Stream.map()`, `Stream.mapEffect()`
 * - File I/O: Use `Sink.toFile()`, `Stream.fromFile()`
 * - Multiple targets: Use `Stream.broadcast()`, `Stream.tap()`
 *
 * @since 4.0.0
 * @category models
 */
export type StdioValue =
  | "pipe"
  | "inherit"
  | "ignore"
  | number
  | Stream.Stream<Uint8Array, never, never>
  | Sink.Sink<void, Uint8Array, never, never, never>

/**
 * Stdio configuration for child process.
 *
 * @since 4.0.0
 * @category models
 */
export interface StdioOptions {
  readonly stdin?: StdioValue
  readonly stdout?: StdioValue
  readonly stderr?: StdioValue
  readonly all?: boolean
}

/**
 * Options for child process execution.
 *
 * @since 4.0.0
 * @category models
 */
export interface ChildProcessOptions {
  readonly cwd?: string
  readonly env?: Record<string, string>
  readonly timeout?: Duration.Duration
  readonly stdio?: StdioOptions
  readonly encoding?: "utf8" | "buffer"
  readonly maxBuffer?: number
  readonly shell?: boolean | string
  readonly windowsHide?: boolean
  readonly killSignal?: string
  readonly uid?: number
  readonly gid?: number
  readonly detached?: boolean
}

// ═══════════════════════════════════════════════════════════════
// ERROR TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Error when spawning a child process fails.
 *
 * @since 4.0.0
 * @category errors
 */
export class SpawnError extends Data.TaggedError("SpawnError")<{
  readonly command: string
  readonly cause: unknown
}> {}

/**
 * Error when child process exits with non-zero exit code.
 *
 * @since 4.0.0
 * @category errors
 */
export class ExitCodeError extends Data.TaggedError("ExitCodeError")<{
  readonly command: string
  readonly exitCode: number
  readonly stdout?: Uint8Array
  readonly stderr?: Uint8Array
}> {}

/**
 * Error when child process is terminated by a signal.
 *
 * @since 4.0.0
 * @category errors
 */
export class SignalError extends Data.TaggedError("SignalError")<{
  readonly command: string
  readonly signal: string
  readonly stdout?: Uint8Array
  readonly stderr?: Uint8Array
}> {}

/**
 * Error when child process exceeds timeout.
 *
 * @since 4.0.0
 * @category errors
 */
export class TimeoutError extends Data.TaggedError("TimeoutError")<{
  readonly command: string
  readonly timeout: Duration.Duration
  readonly stdout?: Uint8Array
  readonly stderr?: Uint8Array
}> {}

/**
 * Error when output exceeds maxBuffer limit.
 *
 * @since 4.0.0
 * @category errors
 */
export class MaxBufferError extends Data.TaggedError("MaxBufferError")<{
  readonly command: string
  readonly maxBuffer: number
  readonly stdout?: Uint8Array
  readonly stderr?: Uint8Array
}> {}

/**
 * Error related to stdio stream operations.
 *
 * @since 4.0.0
 * @category errors
 */
export class StdioError extends Data.TaggedError("StdioError")<{
  readonly fd: "stdin" | "stdout" | "stderr"
  readonly cause: unknown
}> {}

/**
 * Error related to parsing command arguments.
 *
 * @since 4.0.0
 * @category errors
 */
export class ParseArgumentsError extends Schema.ErrorClass(
  "effect/unstable/process/ChildProcess/ParseArgumentsError"
)({ message: Schema.String }) {}

/**
 * Union of all child process error types.
 *
 * @since 4.0.0
 * @category errors
 */
export type ChildProcessError =
  | SpawnError
  | ExitCodeError
  | SignalError
  | TimeoutError
  | MaxBufferError
  | StdioError

// ═══════════════════════════════════════════════════════════════
// RESULT TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Process exit information.
 *
 * @since 4.0.0
 * @category models
 */
export interface ExitInfo {
  readonly exitCode: number | undefined
  readonly signal: string | undefined
}

/**
 * Handle to a running child process with streaming I/O.
 *
 * @since 4.0.0
 * @category models
 */
export interface ChildProcessHandle {
  readonly pid: number | undefined
  readonly stdin: Sink.Sink<void, Uint8Array, never, never, Scope.Scope> | undefined
  readonly stdout: Stream.Stream<Uint8Array, ChildProcessError, Scope.Scope> | undefined
  readonly stderr: Stream.Stream<Uint8Array, ChildProcessError, Scope.Scope> | undefined
  readonly all: Stream.Stream<Uint8Array, ChildProcessError, Scope.Scope> | undefined
  readonly exitCode: Effect.Effect<ExitInfo, ChildProcessError, Scope.Scope>
  readonly kill: (signal?: string) => Effect.Effect<void, ChildProcessError>
}

/**
 * Result of a completed child process.
 *
 * @since 4.0.0
 * @category models
 */
export interface ChildProcessResult {
  readonly command: string
  readonly exitCode: number | undefined
  readonly signal: string | undefined
  readonly stdout: Uint8Array | undefined
  readonly stderr: Uint8Array | undefined
  readonly all: Uint8Array | undefined
  readonly duration: Duration.Duration
}

// ═══════════════════════════════════════════════════════════════
// CHILD PROCESS
// ═══════════════════════════════════════════════════════════════

/**
 * A description of a child process to be spawned.
 * Immutable and composable.
 *
 * @since 4.0.0
 * @category models
 */
export interface ChildProcess extends Pipeable, Inspectable.Inspectable {
  readonly [TypeId]: typeof TypeId
  readonly command: string
  readonly args: ReadonlyArray<string>
  readonly options: ChildProcessOptions
}

const ChildProcessProto: Omit<ChildProcess, "command" | "args" | "options"> = {
  ...Inspectable.BaseProto,
  [TypeId]: TypeId,
  toJSON(this: ChildProcess) {
    return {
      _id: "ChildProcess",
      command: this.command,
      args: this.args,
      options: this.options
    }
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
}

const makeChildProcess = (
  command: string,
  args: ReadonlyArray<string>,
  options: ChildProcessOptions
): ChildProcess => {
  const self = Object.create(ChildProcessProto)
  self.command = command
  self.args = args
  self.options = options
  return self
}

// ═══════════════════════════════════════════════════════════════
// CONSTRUCTORS
// ═══════════════════════════════════════════════════════════════

/**
 * Create a child process description.
 *
 * @example
 * ```ts
 * import { ChildProcess } from "effect/unstable/process"
 *
 * const process = ChildProcess.make("node", ["--version"])
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const make = (command: string, args: ReadonlyArray<string> = []): ChildProcess =>
  makeChildProcess(command, args, {})

/**
 * Create a child process that runs in a shell.
 *
 * @example
 * ```ts
 * import { ChildProcess } from "effect/unstable/process"
 *
 * const process = ChildProcess.shell("npm run build")
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const shell = (command: string): ChildProcess => makeChildProcess(command, [], { shell: true })

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/**
 * Set the working directory for the child process.
 *
 * @since 4.0.0
 * @category configuration
 */
export const withCwd: {
  (cwd: string): (self: ChildProcess) => ChildProcess
  (self: ChildProcess, cwd: string): ChildProcess
} = dual(
  2,
  (self: ChildProcess, cwd: string): ChildProcess => makeChildProcess(self.command, self.args, { ...self.options, cwd })
)

/**
 * Set environment variables for the child process.
 *
 * @since 4.0.0
 * @category configuration
 */
export const withEnv: {
  (env: Record<string, string>): (self: ChildProcess) => ChildProcess
  (self: ChildProcess, env: Record<string, string>): ChildProcess
} = dual(
  2,
  (self: ChildProcess, env: Record<string, string>): ChildProcess =>
    makeChildProcess(self.command, self.args, { ...self.options, env })
)

/**
 * Set a timeout for the child process.
 *
 * @since 4.0.0
 * @category configuration
 */
export const withTimeout: {
  (duration: Duration.DurationInput): (self: ChildProcess) => ChildProcess
  (self: ChildProcess, duration: Duration.DurationInput): ChildProcess
} = dual(
  2,
  (self: ChildProcess, duration: Duration.DurationInput): ChildProcess =>
    makeChildProcess(self.command, self.args, { ...self.options, timeout: Duration.fromDurationInputUnsafe(duration) })
)

/**
 * Configure stdin for the child process.
 *
 * @since 4.0.0
 * @category configuration
 */
export const withStdin: {
  (stdin: StdioValue): (self: ChildProcess) => ChildProcess
  (self: ChildProcess, stdin: StdioValue): ChildProcess
} = dual(
  2,
  (self: ChildProcess, stdin: StdioValue): ChildProcess =>
    makeChildProcess(self.command, self.args, {
      ...self.options,
      stdio: { ...self.options.stdio, stdin }
    })
)

/**
 * Configure stdout for the child process.
 *
 * @since 4.0.0
 * @category configuration
 */
export const withStdout: {
  (stdout: StdioValue): (self: ChildProcess) => ChildProcess
  (self: ChildProcess, stdout: StdioValue): ChildProcess
} = dual(
  2,
  (self: ChildProcess, stdout: StdioValue): ChildProcess =>
    makeChildProcess(self.command, self.args, {
      ...self.options,
      stdio: { ...self.options.stdio, stdout }
    })
)

/**
 * Configure stderr for the child process.
 *
 * @since 4.0.0
 * @category configuration
 */
export const withStderr: {
  (stderr: StdioValue): (self: ChildProcess) => ChildProcess
  (self: ChildProcess, stderr: StdioValue): ChildProcess
} = dual(
  2,
  (self: ChildProcess, stderr: StdioValue): ChildProcess =>
    makeChildProcess(self.command, self.args, {
      ...self.options,
      stdio: { ...self.options.stdio, stderr }
    })
)

/**
 * Enable interleaved stdout and stderr output.
 *
 * @since 4.0.0
 * @category configuration
 */
export const withAll: {
  (all: boolean): (self: ChildProcess) => ChildProcess
  (self: ChildProcess, all: boolean): ChildProcess
} = dual(
  2,
  (self: ChildProcess, all: boolean): ChildProcess =>
    makeChildProcess(self.command, self.args, {
      ...self.options,
      stdio: { ...self.options.stdio, all }
    })
)

// ═══════════════════════════════════════════════════════════════
// EXECUTOR SERVICE
// ═══════════════════════════════════════════════════════════════

const ExecutorTypeId = "~effect/process/ChildProcessExecutor"

/**
 * Platform-specific service for executing child processes.
 *
 * @since 4.0.0
 * @category services
 */
export interface ChildProcessExecutor {
  readonly [ExecutorTypeId]: typeof ExecutorTypeId
  readonly execute: (
    process: ChildProcess
  ) => Effect.Effect<ChildProcessResult, ChildProcessError, Scope.Scope>
  readonly spawn: (
    process: ChildProcess
  ) => Effect.Effect<ChildProcessHandle, ChildProcessError, Scope.Scope>
}

/**
 * Service tag for ChildProcessExecutor.
 *
 * @since 4.0.0
 * @category tags
 */
export const ChildProcessExecutor: ServiceMap.Service<
  ChildProcessExecutor,
  ChildProcessExecutor
> = ServiceMap.Service("effect/ChildProcess/Executor")

// ═══════════════════════════════════════════════════════════════
// EXECUTION
// ═══════════════════════════════════════════════════════════════

/**
 * Execute a child process and collect its output.
 *
 * @example
 * ```ts
 * import { ChildProcess } from "effect/unstable/process"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const process = ChildProcess.make("node", ["--version"])
 *   const result = yield* ChildProcess.execute(process)
 *   console.log(new TextDecoder().decode(result.stdout))
 * })
 * ```
 *
 * @since 4.0.0
 * @category execution
 */
export const execute = (
  process: ChildProcess
): Effect.Effect<ChildProcessResult, ChildProcessError, ChildProcessExecutor | Scope.Scope> =>
  Effect.gen(function*() {
    const executor = yield* ChildProcessExecutor
    return yield* executor.execute(process)
  })

/**
 * Spawn a child process for streaming I/O.
 *
 * @example
 * ```ts
 * import { ChildProcess } from "effect/unstable/process"
 * import { Effect } from "effect"
 * import { Stream } from "effect/stream"
 *
 * const program = Effect.gen(function* () {
 *   const process = ChildProcess.make("npm", ["run", "build"])
 *   const handle = yield* ChildProcess.spawn(process)
 *
 *   if (handle.stdout) {
 *     const output = yield* Stream.runCollect(handle.stdout)
 *     const exit = yield* handle.exitCode
 *     return { output, exit }
 *   }
 * })
 * ```
 *
 * @since 4.0.0
 * @category execution
 */
export const spawn = (
  process: ChildProcess
): Effect.Effect<ChildProcessHandle, ChildProcessError, ChildProcessExecutor | Scope.Scope> =>
  Effect.gen(function*() {
    const executor = yield* ChildProcessExecutor
    return yield* executor.spawn(process)
  })

// =============================================================================
// Executor
// =============================================================================

export type TemplateExpressionItem =
  | string
  | number

export type TemplateExpression = TemplateExpressionItem | ReadonlyArray<TemplateExpressionItem>

export interface Executor {
  execute(cmd: string, args: ReadonlyArray<string>): void
  execute(strings: TemplateStringsArray, ...args: ReadonlyArray<TemplateExpression>): void
}

declare const executor: Executor

const _ = executor.execute`foo ${1}`

export const make = Effect.fnUntraced(
  function*() {
    const execute: {
      (cmd: TemplateStringsArray, ...args: ReadonlyArray<TemplateExpression>): void
      (cmd: string, ...args: ReadonlyArray<string>): void
    } = Effect.fnUntraced(function*(cmd: unknown, ...args: ReadonlyArray<any>) {
      const parsedArgs = yield* parseArguments(cmd, args)
    })
  }
)

const parseArguments: (cmd: unknown, ...args: ReadonlyArray<any>) => Effect.Effect<
  Arr.NonEmptyReadonlyArray<string>,
  ParseArgumentsError
> = Effect.fnUntraced(
  function*(cmd, ...args: ReadonlyArray<any>) {
    if (isTemplateString(cmd)) {
      return yield* parseTemplates(cmd, args).pipe(
        Effect.mapError((message) => new ParseArgumentsError({ message }))
      )
    }
    return Arr.prepend(args, cmd)
  }
)
