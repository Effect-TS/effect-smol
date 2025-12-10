/**
 * Node.js implementation of ChildProcessExecutor.
 *
 * @since 4.0.0
 */
import type * as Arr from "effect/collections/Array"
import * as Predicate from "effect/data/Predicate"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { identity } from "effect/Function"
import * as Layer from "effect/Layer"
import * as FileSystem from "effect/platform/FileSystem"
import * as Path from "effect/platform/Path"
import type * as PlatformError from "effect/platform/PlatformError"
import type * as Scope from "effect/Scope"
import * as Sink from "effect/stream/Sink"
import * as Stream from "effect/stream/Stream"
import * as ChildProcess from "effect/unstable/process/ChildProcess"
import type { ChildProcessHandle } from "effect/unstable/process/ChildProcessExecutor"
import { ChildProcessExecutor, ExitCode, ProcessId } from "effect/unstable/process/ChildProcessExecutor"
import * as NodeChildProcess from "node:child_process"
import { parseTemplates } from "./internal/process.ts"
import { handleErrnoException } from "./internal/utils.ts"
import * as NodeSink from "./NodeSink.ts"
import * as NodeStream from "./NodeStream.ts"

const toError = (error: unknown): Error =>
  error instanceof globalThis.Error
    ? error
    : new globalThis.Error(String(error))

const toPlatformError = (
  method: string,
  error: NodeJS.ErrnoException,
  command: ChildProcess.Command
): PlatformError.PlatformError => {
  const commands = flattenCommand(command).reduce((acc, curr) => {
    const command = `${curr.command} ${curr.args.join(" ")}`
    return acc.length === 0 ? command : `${acc} | ${command}`
  }, "")
  return handleErrnoException("ChildProcess", method)(error, [commands])
}

type ExitCodeWithSignal = readonly [code: number | null, signal: NodeJS.Signals | null]
type ExitSignal = Deferred.Deferred<ExitCodeWithSignal>

const make = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const resolveCommand = Effect.fnUntraced(function*(
    command: ChildProcess.StandardCommand | ChildProcess.TemplatedCommand
  ) {
    if (ChildProcess.isStandardCommand(command)) return command
    const parsed = yield* Effect.orDie(Effect.try({
      try: () => parseTemplates(command.templates, command.expressions),
      catch: identity
    }))
    return ChildProcess.make(parsed[0], parsed.slice(1), command.options)
  })

  const resolveWorkingDirectory = Effect.fnUntraced(
    function*(options: ChildProcess.CommandOptions) {
      if (Predicate.isUndefined(options.cwd)) return undefined
      // Validate that the specified directory is accessible
      yield* fs.access(options.cwd)
      return path.resolve(options.cwd)
    }
  )

  const resolveEnvironment = (options: ChildProcess.CommandOptions) => {
    return options.extendEnv
      ? { ...globalThis.process.env, ...options.env }
      : options.env
  }

  const resolveStdio = (
    option: ChildProcess.CommandInput | ChildProcess.CommandOutput | undefined
  ): NodeChildProcess.IOType => typeof option === "string" ? option : "pipe"

  const setupChildInputStream = Effect.fnUntraced(function*(
    command: ChildProcess.StandardCommand,
    childProcess: NodeChildProcess.ChildProcess
  ) {
    const stdin = command.options.stdin
    let sink: Sink.Sink<void, unknown, never, PlatformError.PlatformError> = Sink.drain
    if (Predicate.isNotNull(childProcess.stdin)) {
      sink = NodeSink.fromWritable({
        evaluate: () => childProcess.stdin!,
        onError: (error) => toPlatformError("fromWritable(stdin)", toError(error), command),
        endOnDone: stdin?.endOnDone,
        encoding: stdin?.encoding
      })
    }
    if (
      Predicate.isNotUndefined(stdin) &&
      Predicate.isNotUndefined(stdin.stdioOption) &&
      typeof stdin.stdioOption !== "string"
    ) {
      yield* Effect.forkScoped(Stream.run(stdin.stdioOption, sink))
    }
    return sink
  })

  const setupChildOutputStream = Effect.fnUntraced(function*(
    command: ChildProcess.StandardCommand,
    childProcess: NodeChildProcess.ChildProcess,
    streamName: "stdout" | "stderr"
  ) {
    const output = command.options[streamName]
    const nodeStream = childProcess[streamName]
    let stream: Stream.Stream<Uint8Array, PlatformError.PlatformError> = Stream.empty
    if (Predicate.isNotNull(nodeStream)) {
      stream = NodeStream.fromReadable({
        evaluate: () => nodeStream,
        onError: (error) => toPlatformError(`fromReadable(${streamName})`, toError(error), command)
      })
    }
    if (
      Predicate.isNotUndefined(output) &&
      Predicate.isNotUndefined(output.stdioOption) &&
      typeof output.stdioOption !== "string"
    ) {
      stream = Stream.transduce(stream, output.stdioOption)
    }
    return stream
  })

  const spawn = Effect.fnUntraced(
    function*(
      command: ChildProcess.StandardCommand,
      spawnOptions: NodeChildProcess.SpawnOptions
    ) {
      const deferred = yield* Deferred.make<ExitCodeWithSignal>()

      return yield* Effect.callback<
        readonly [NodeChildProcess.ChildProcess, ExitSignal],
        PlatformError.PlatformError
      >((resume) => {
        const handle = NodeChildProcess.spawn(
          command.command,
          command.args,
          spawnOptions
        )
        handle.on("error", (error) => {
          resume(Effect.fail(toPlatformError("spawn", error, command)))
        })
        handle.on("exit", (...args) => {
          Deferred.doneUnsafe(deferred, Exit.succeed(args))
        })
        handle.on("spawn", () => {
          resume(Effect.succeed([handle, deferred]))
        })
        return Effect.sync(() => {
          handle.kill("SIGTERM")
        })
      })
    }
  )

  const killProcessGroup = Effect.fnUntraced(function*(
    command: ChildProcess.StandardCommand,
    childProcess: NodeChildProcess.ChildProcess,
    signal: NodeJS.Signals
  ) {
    if (globalThis.process.platform === "win32") {
      return yield* Effect.callback<void, PlatformError.PlatformError>((resume) => {
        NodeChildProcess.exec(`taskkill /pid ${childProcess.pid} /T /F`, (error) => {
          if (error) {
            resume(Effect.fail(toPlatformError("kill", toError(error), command)))
          } else {
            resume(Effect.void)
          }
        })
      })
    }
    return yield* Effect.try({
      try: () => {
        globalThis.process.kill(-childProcess.pid!, signal)
      },
      catch: (error) => toPlatformError("kill", toError(error), command)
    })
  })

  const killProcess = Effect.fnUntraced(function*(
    command: ChildProcess.StandardCommand,
    childProcess: NodeChildProcess.ChildProcess,
    signal: NodeJS.Signals
  ) {
    const killed = childProcess.kill(signal)
    if (!killed) {
      const error = new globalThis.Error("Failed to kill child process")
      return yield* Effect.fail(toPlatformError("kill", error, command))
    }
    return yield* Effect.void
  })

  const withTimeout = (
    childProcess: NodeChildProcess.ChildProcess,
    command: ChildProcess.StandardCommand,
    options: ChildProcess.KillOptions | undefined
  ) =>
  <A, E, R>(
    kill: (
      command: ChildProcess.StandardCommand,
      childProcess: NodeChildProcess.ChildProcess,
      signal: NodeJS.Signals
    ) => Effect.Effect<A, E, R>
  ) => {
    const killSignal = options?.killSignal ?? "SIGTERM"
    return Predicate.isUndefined(options?.forceKillAfter)
      ? kill(command, childProcess, killSignal)
      : Effect.timeoutOrElse(kill(command, childProcess, killSignal), {
        duration: options.forceKillAfter,
        onTimeout: () => kill(command, childProcess, "SIGKILL")
      })
  }

  const spawnCommand: (
    command: ChildProcess.Command
  ) => Effect.Effect<
    ChildProcessHandle,
    PlatformError.PlatformError,
    Scope.Scope
  > = Effect.fnUntraced(function*(cmd) {
    switch (cmd._tag) {
      case "StandardCommand":
      case "TemplatedCommand": {
        const command = yield* resolveCommand(cmd)
        const options = command.options

        const cwd = yield* resolveWorkingDirectory(options)
        const env = resolveEnvironment(options)
        const stdio = [
          resolveStdio(options.stdin?.stdioOption),
          resolveStdio(options.stdout?.stdioOption),
          resolveStdio(options.stderr?.stdioOption)
        ]

        const [childProcess, exitSignal] = yield* Effect.acquireRelease(
          spawn(command, { cwd, env, stdio, shell: options.shell }),
          Effect.fnUntraced(function*([childProcess, exitSignal]) {
            const exited = yield* Deferred.isDone(exitSignal)
            const killWithTimeout = withTimeout(childProcess, command, options)
            if (exited) {
              // Process already exited, check if children need cleanup
              const [code] = yield* Deferred.await(exitSignal)
              if (code !== 0 && Predicate.isNotNull(code)) {
                // Non-zero exit code ,attempt to clean up process group
                return yield* Effect.ignore(killWithTimeout(killProcessGroup))
              }
              return yield* Effect.void
            }
            // Process is still running, kill it
            return yield* Effect.ignore(
              killWithTimeout((command, childProcess, signal) =>
                Effect.catch(
                  killProcessGroup(command, childProcess, signal),
                  () => killProcess(command, childProcess, signal)
                )
              )
            )
          })
        )

        const pid = ProcessId(childProcess.pid!)
        const stdin = yield* setupChildInputStream(command, childProcess)
        const stdout = yield* setupChildOutputStream(command, childProcess, "stdout")
        const stderr = yield* setupChildOutputStream(command, childProcess, "stderr")
        const isRunning = Effect.map(Deferred.isDone(exitSignal), (done) => !done)
        const exitCode = Effect.flatMap(Deferred.await(exitSignal), ([code, signal]) => {
          if (Predicate.isNotNull(code)) {
            return Effect.succeed(ExitCode(code))
          }
          // If code is `null`, then `signal` must be defined. See the NodeJS
          // documentation for the `"exit"` event on a `child_process`.
          // https://nodejs.org/api/child_process.html#child_process_event_exit
          const error = new globalThis.Error(`Process interrupted due to receipt of signal: '${signal}'`)
          return Effect.fail(toPlatformError("exitCode", error, command))
        })
        const kill = (options?: ChildProcess.KillOptions | undefined) => {
          const killWithTimeout = withTimeout(childProcess, command, options)
          return killWithTimeout((command, childProcess, signal) =>
            Effect.catch(
              killProcessGroup(command, childProcess, signal),
              () => killProcess(command, childProcess, signal)
            )
          )
        }

        return {
          pid,
          exitCode,
          isRunning,
          kill,
          stdin,
          stdout,
          stderr
        }
      }
      case "PipedCommand": {
        const [root, ...pipeline] = flattenCommand(cmd)
        let handle = spawnCommand(root)
        for (const command of pipeline) {
          // TODO: allow configurable pipe from / to
          // https://github.com/sindresorhus/execa/blob/main/docs/api.md#pipeoptions
          const stream = Stream.unwrap(Effect.map(handle, (handle) => handle.stdout))
          handle = spawnCommand(ChildProcess.make(command.command, command.args, {
            ...command.options,
            stdin: {
              ...command.options.stdin,
              stdioOption: stream
            }
          }))
        }
        return yield* handle
      }
    }
  })

  return ChildProcessExecutor.of({
    spawn: spawnCommand
  })
})

/**
 * Layer providing the NodeChildProcessExecutor implementation.
 *
 * @since 4.0.0
 * @category Layers
 */
export const layer: Layer.Layer<
  ChildProcessExecutor,
  never,
  FileSystem.FileSystem | Path.Path
> = Layer.effect(ChildProcessExecutor, make)

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Flattens a `Command` into an array of `StandardCommand`s.
 *
 * @since 4.0.0
 * @category Utilities
 */
export const flattenCommand = (
  command: ChildProcess.Command
): Arr.NonEmptyReadonlyArray<ChildProcess.StandardCommand> => {
  const stack: Array<ChildProcess.Command> = [command]
  const flattened: Array<ChildProcess.StandardCommand> = []
  while (stack.length > 0) {
    const current = stack.pop()!
    switch (current._tag) {
      case "StandardCommand": {
        flattened.push(current)
        break
      }
      case "TemplatedCommand": {
        const parsed = parseTemplates(
          current.templates,
          current.expressions
        )
        flattened.push(ChildProcess.make(
          parsed[0],
          parsed.slice(1),
          current.options
        ))
        break
      }
      case "PipedCommand": {
        stack.push(current.right)
        stack.push(current.left)
        break
      }
    }
  }
  return flattened as any
}
//
// const collectOutput = (
//   readable: Readable,
//   maxBuffer?: number
// ): Effect.Effect<Uint8Array, SpawnError, Scope.Scope> =>
//   Effect.gen(function*() {
//     const chunks: Array<Uint8Array> = []
//     let totalBytes = 0
//
//     yield* Effect.callback<void, SpawnError>((resume) => {
//       readable.on("data", (chunk: Buffer) => {
//         const uint8 = new Uint8Array(chunk)
//         chunks.push(uint8)
//         totalBytes += uint8.length
//
//         if (maxBuffer && totalBytes > maxBuffer) {
//           readable.destroy()
//           resume(
//             Effect.fail(
//               new SpawnError({
//                 executable: "",
//                 args: [],
//                 cause: new Error(`Output exceeded maxBuffer limit of ${maxBuffer} bytes`)
//               })
//             )
//           )
//         }
//       })
//
//       readable.on("end", () => {
//         resume(Effect.void)
//       })
//
//       readable.on("error", (error) => {
//         resume(
//           Effect.fail(
//             new SpawnError({
//               executable: "",
//               args: [],
//               cause: error
//             })
//           )
//         )
//       })
//
//       return Effect.sync(() => {
//         readable.destroy()
//       })
//     })
//
//     // Concatenate all chunks
//     if (chunks.length === 0) {
//       return new Uint8Array(0)
//     }
//
//     const result = new Uint8Array(totalBytes)
//     let offset = 0
//     for (const chunk of chunks) {
//       result.set(chunk, offset)
//       offset += chunk.length
//     }
//
//     return result
//   })
//
// interface ExitInfo {
//   readonly exitCode: number | undefined
//   readonly signal: string | undefined
// }
//
// const waitForExit = (
//   childProcess: CP.ChildProcess,
//   executable: string,
//   args: ReadonlyArray<string>,
//   timeout?: Duration.Duration
// ): Effect.Effect<ExitInfo, SpawnError | KilledError | TimeoutError, Scope.Scope> => {
//   const exitEffect = Effect.callback<ExitInfo, SpawnError | KilledError>((resume) => {
//     childProcess.on("exit", (code, signal) => {
//       if (signal) {
//         resume(
//           Effect.fail(
//             new KilledError({
//               executable,
//               args: [...args],
//               signal
//             })
//           )
//         )
//       } else {
//         resume(
//           Effect.succeed({
//             exitCode: code ?? undefined,
//             signal: signal ?? undefined
//           })
//         )
//       }
//     })
//
//     childProcess.on("error", (error) => {
//       resume(
//         Effect.fail(
//           new SpawnError({
//             executable,
//             args: [...args],
//             cause: error
//           })
//         )
//       )
//     })
//
//     return Effect.sync(() => {
//       childProcess.kill()
//     })
//   })
//
//   if (timeout) {
//     return pipe(
//       exitEffect,
//       Effect.timeoutOrElse({
//         duration: timeout,
//         onTimeout: () =>
//           Effect.fail(
//             new TimeoutError({
//               executable,
//               args: [...args],
//               timeout
//             })
//           )
//       })
//     )
//   }
//
//   return exitEffect
// }
//
// // =============================================================================
// // Single Command Execution
// // =============================================================================
//
// const execResolvedCommand = (
//   cmd: ResolvedCommand
// ): Effect.Effect<ChildProcessResult, ChildProcessError, Scope.Scope> =>
//   Effect.gen(function*() {
//     const startTime = Date.now()
//     const { args, executable, options } = cmd
//
//     // Build spawn options
//     const spawnOptions: CP.SpawnOptions = {
//       cwd: options.cwd,
//       env: options.env
//         ? { ...globalThis.process.env, ...options.env }
//         : globalThis.process.env,
//       shell: options.shell ?? false,
//       stdio: ["pipe", "pipe", "pipe"]
//     }
//
//     // Spawn the process
//     const childProcess = yield* Effect.try({
//       try: () => CP.spawn(executable, [...args], spawnOptions),
//       catch: (error) =>
//         new SpawnError({
//           executable,
//           args: [...args],
//           cause: error
//         })
//     })
//
//     // Collect stdout
//     const stdoutEffect = childProcess.stdout
//       ? collectOutput(childProcess.stdout)
//       : Effect.succeed(new Uint8Array(0))
//
//     // Collect stderr
//     const stderrEffect = childProcess.stderr
//       ? collectOutput(childProcess.stderr)
//       : Effect.succeed(new Uint8Array(0))
//
//     // Wait for process to exit - run concurrently with output collection
//     const timeout = options.timeout ? Duration.fromDurationInputUnsafe(options.timeout) : undefined
//     const [stdout, stderr, exitInfo] = yield* Effect.all(
//       [stdoutEffect, stderrEffect, waitForExit(childProcess, executable, args, timeout)],
//       { concurrency: "unbounded" }
//     )
//
//     const duration = Duration.millis(Date.now() - startTime)
//
//     // Check for non-zero exit code
//     if (exitInfo.exitCode !== 0 && exitInfo.exitCode !== undefined) {
//       return yield* Effect.fail(
//         new ExitCodeError({
//           executable,
//           args: [...args],
//           exitCode: exitInfo.exitCode,
//           stdout: options.encoding === "utf8" ? new TextDecoder().decode(stdout) : stdout,
//           stderr: options.encoding === "utf8" ? new TextDecoder().decode(stderr) : stderr
//         })
//       )
//     }
//
//     return {
//       executable,
//       args,
//       exitCode: exitInfo.exitCode ?? 0,
//       stdout: options.encoding === "utf8" ? new TextDecoder().decode(stdout) : stdout,
//       stderr: options.encoding === "utf8" ? new TextDecoder().decode(stderr) : stderr,
//       duration
//     }
//   })
//
// // =============================================================================
// // Pipeline Execution
// // =============================================================================
//
// /**
//  * Execute a pipeline of resolved commands, connecting outputs to inputs based on pipeStdio settings.
//  */
// const execPipeline = (
//   commands: ReadonlyArray<ResolvedCommand>,
//   pipeStdioSettings: ReadonlyArray<PipeStdio>
// ): Effect.Effect<ChildProcessResult, ChildProcessError, Scope.Scope> =>
//   Effect.gen(function*() {
//     if (commands.length === 0) {
//       return yield* Effect.fail(
//         new SpawnError({
//           executable: "",
//           args: [],
//           cause: new Error("Pipeline must have at least one command")
//         })
//       )
//     }
//
//     if (commands.length === 1) {
//       return yield* execResolvedCommand(commands[0])
//     }
//
//     const startTime = Date.now()
//
//     // Spawn all processes
//     const processes: Array<CP.ChildProcess> = []
//     for (const cmd of commands) {
//       const spawnOptions: CP.SpawnOptions = {
//         cwd: cmd.options.cwd,
//         env: cmd.options.env
//           ? { ...globalThis.process.env, ...cmd.options.env }
//           : globalThis.process.env,
//         shell: cmd.options.shell ?? false,
//         stdio: ["pipe", "pipe", "pipe"]
//       }
//
//       const childProcess = yield* Effect.try({
//         try: () => CP.spawn(cmd.executable, [...cmd.args], spawnOptions),
//         catch: (error) =>
//           new SpawnError({
//             executable: cmd.executable,
//             args: [...cmd.args],
//             cause: error
//           })
//       })
//
//       processes.push(childProcess)
//     }
//
//     // Connect processes based on pipeStdio settings
//     for (let i = 0; i < processes.length - 1; i++) {
//       const current = processes[i]
//       const next = processes[i + 1]
//       const pipeStdio = pipeStdioSettings[i] ?? "stdout"
//
//       if (next.stdin) {
//         if (pipeStdio === "stdout" || pipeStdio === "both") {
//           if (current.stdout) {
//             current.stdout.pipe(next.stdin)
//           }
//         }
//         if (pipeStdio === "stderr" || pipeStdio === "both") {
//           if (current.stderr) {
//             // For "both", we need to handle merging streams
//             // For "stderr" only, pipe stderr to stdin
//             if (pipeStdio === "stderr") {
//               current.stderr.pipe(next.stdin)
//             } else {
//               // For "both", we already piped stdout above, now also pipe stderr
//               current.stderr.on("data", (chunk) => {
//                 next.stdin?.write(chunk)
//               })
//             }
//           }
//         }
//       }
//     }
//
//     // Collect stderr from all processes
//     const stderrChunks: Array<Uint8Array> = []
//     for (const proc of processes) {
//       if (proc.stderr) {
//         proc.stderr.on("data", (chunk: Buffer) => {
//           stderrChunks.push(new Uint8Array(chunk))
//         })
//       }
//     }
//
//     // Collect stdout from the last process
//     const lastProcess = processes[processes.length - 1]
//     const lastCmd = commands[commands.length - 1]
//     const stdoutEffect = lastProcess.stdout
//       ? collectOutput(lastProcess.stdout)
//       : Effect.succeed(new Uint8Array(0))
//
//     // Wait for last process to exit - run concurrently with output collection
//     const timeout = lastCmd.options.timeout ? Duration.fromDurationInputUnsafe(lastCmd.options.timeout) : undefined
//     const [stdout, exitInfo] = yield* Effect.all(
//       [stdoutEffect, waitForExit(lastProcess, lastCmd.executable, lastCmd.args, timeout)],
//       { concurrency: "unbounded" }
//     )
//
//     // Combine all stderr
//     const totalStderrBytes = stderrChunks.reduce((acc, chunk) => acc + chunk.length, 0)
//     const stderr = new Uint8Array(totalStderrBytes)
//     let offset = 0
//     for (const chunk of stderrChunks) {
//       stderr.set(chunk, offset)
//       offset += chunk.length
//     }
//
//     const duration = Duration.millis(Date.now() - startTime)
//
//     // Check for non-zero exit code
//     if (exitInfo.exitCode !== 0 && exitInfo.exitCode !== undefined) {
//       return yield* Effect.fail(
//         new ExitCodeError({
//           executable: lastCmd.executable,
//           args: [...lastCmd.args],
//           exitCode: exitInfo.exitCode,
//           stdout: lastCmd.options.encoding === "utf8" ? new TextDecoder().decode(stdout) : stdout,
//           stderr: lastCmd.options.encoding === "utf8" ? new TextDecoder().decode(stderr) : stderr
//         })
//       )
//     }
//
//     return {
//       executable: lastCmd.executable,
//       args: lastCmd.args,
//       exitCode: exitInfo.exitCode ?? 0,
//       stdout: lastCmd.options.encoding === "utf8" ? new TextDecoder().decode(stdout) : stdout,
//       stderr: lastCmd.options.encoding === "utf8" ? new TextDecoder().decode(stderr) : stderr,
//       duration
//     }
//   })
//
// // =============================================================================
// // Spawn Implementation
// // =============================================================================
//
// const spawnResolvedCommand = (
//   cmd: ResolvedCommand
// ): Effect.Effect<ChildProcessHandle, SpawnError> =>
//   Effect.gen(function*() {
//     const { args, executable, options } = cmd
//
//     // TODO: fix
//     const spawnOptions: CP.SpawnOptions = {
//       cwd: options.cwd,
//       env: options.extendEnv
//         ? { ...globalThis.process.env, ...options.env }
//         : options.env,
//       shell: options.shell ?? false,
//       stdio: ["pipe", "pipe", "pipe"]
//     }
//
//     const childProcess = CP.spawn(executable, [...args], spawnOptions)
//
//     const stdin: Sink.Sink<void, Uint8Array, never, SpawnError> = childProcess.stdin
//       ? NodeSink.fromWritable<SpawnError, Uint8Array>({
//         evaluate: () => childProcess.stdin as Writable,
//         onError: (error) =>
//           new SpawnError({
//             executable,
//             args: [...args],
//             cause: error
//           })
//       })
//       : Sink.fail(
//         new SpawnError({
//           executable,
//           args: [...args],
//           cause: new Error("stdin not available")
//         })
//       )
//
//     const stdout: Stream.Stream<Uint8Array, SpawnError> = childProcess.stdout
//       ? NodeStream.fromReadable<Uint8Array, SpawnError>({
//         evaluate: () => childProcess.stdout as Readable,
//         onError: (error) =>
//           new SpawnError({
//             executable,
//             args: [...args],
//             cause: error
//           })
//       })
//       : Stream.fail(
//         new SpawnError({
//           executable,
//           args: [...args],
//           cause: new Error("stdout not available")
//         })
//       )
//
//     const stderr: Stream.Stream<Uint8Array, SpawnError> = childProcess.stderr
//       ? NodeStream.fromReadable<Uint8Array, SpawnError>({
//         evaluate: () => childProcess.stderr as Readable,
//         onError: (error) =>
//           new SpawnError({
//             executable,
//             args: [...args],
//             cause: error
//           })
//       })
//       : Stream.fail(
//         new SpawnError({
//           executable,
//           args: [...args],
//           cause: new Error("stderr not available")
//         })
//       )
//
//     const exitCode: Effect.Effect<number, ChildProcessError> = Effect.scoped(
//       Effect.flatMap(
//         waitForExit(childProcess, executable, args, undefined),
//         (info) => Effect.succeed(info.exitCode ?? 0)
//       )
//     )
//
//     const kill = (signal?: string): Effect.Effect<void> =>
//       Effect.sync(() => {
//         childProcess.kill(signal as NodeJS.Signals | undefined)
//       })
//
//     return {
//       pid: childProcess.pid !== undefined ? Option.some(childProcess.pid) : Option.none(),
//       stdin,
//       stdout,
//       stderr,
//       exitCode,
//       kill
//     }
//   })
//
