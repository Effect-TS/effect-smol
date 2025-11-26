/**
 * @since 1.0.0
 */
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import type * as Sink from "effect/stream/Sink"
import * as Stream from "effect/stream/Stream"
import * as ChildProcess from "effect/unstable/process/ChildProcess"
import * as CP from "node:child_process"
import type { Readable } from "node:stream"
import * as NodeSink from "./NodeSink.ts"
import * as NodeStream from "./NodeStream.ts"

// ═══════════════════════════════════════════════════════════════
// STDIO NORMALIZATION
// ═══════════════════════════════════════════════════════════════

type NodeStdioValue = "pipe" | "inherit" | "ignore" | number

interface NormalizedStdio {
  readonly stdin: NodeStdioValue
  readonly stdout: NodeStdioValue
  readonly stderr: NodeStdioValue
  readonly inputStream?: Stream.Stream<Uint8Array, never, never>
  readonly outputSink?: Sink.Sink<void, Uint8Array, never, never, never>
  readonly errorSink?: Sink.Sink<void, Uint8Array, never, never, never>
}

const normalizeStdio = (options: ChildProcess.ChildProcessOptions): NormalizedStdio => {
  const stdio = options.stdio ?? {}

  // Normalize stdin
  let stdin: NodeStdioValue = "pipe"
  let inputStream: Stream.Stream<Uint8Array, never, never> | undefined

  if (stdio.stdin !== undefined) {
    const value = stdio.stdin
    if (typeof value === "string" || typeof value === "number") {
      stdin = value
    } else if ("pipe" in value) {
      // It's a Stream.Stream
      stdin = "pipe"
      inputStream = value as Stream.Stream<Uint8Array, never, never>
    }
  }

  // Normalize stdout
  let stdout: NodeStdioValue = "pipe"
  let outputSink: Sink.Sink<void, Uint8Array, never, never, never> | undefined

  if (stdio.stdout !== undefined) {
    const value = stdio.stdout
    if (typeof value === "string" || typeof value === "number") {
      stdout = value
    } else {
      // It's a Sink.Sink
      stdout = "pipe"
      outputSink = value as Sink.Sink<void, Uint8Array, never, never, never>
    }
  }

  // Normalize stderr
  let stderr: NodeStdioValue = "pipe"
  let errorSink: Sink.Sink<void, Uint8Array, never, never, never> | undefined

  if (stdio.stderr !== undefined) {
    const value = stdio.stderr
    if (typeof value === "string" || typeof value === "number") {
      stderr = value
    } else {
      // It's a Sink.Sink
      stderr = "pipe"
      errorSink = value as Sink.Sink<void, Uint8Array, never, never, never>
    }
  }

  return {
    stdin,
    stdout,
    stderr,
    inputStream,
    outputSink,
    errorSink
  }
}

// ═══════════════════════════════════════════════════════════════
// EXECUTOR IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════

const ExecutorTypeId = "~effect/process/ChildProcessExecutor"

const makeExecutor = (): ChildProcess.ChildProcessExecutor => ({
  [ExecutorTypeId]: ExecutorTypeId,

  execute: (process: ChildProcess.ChildProcess) =>
    Effect.gen(function*() {
      const startTime = Date.now()
      const normalizedStdio = normalizeStdio(process.options)

      // Build spawn options
      const spawnOptions: CP.SpawnOptions = {
        cwd: process.options.cwd,
        env: process.options.env ? { ...process.env, ...process.options.env } : process.env,
        shell: process.options.shell ?? false,
        windowsHide: process.options.windowsHide,
        uid: process.options.uid,
        gid: process.options.gid,
        detached: process.options.detached,
        stdio: [normalizedStdio.stdin, normalizedStdio.stdout, normalizedStdio.stderr]
      }

      // Spawn the process
      const childProcess = yield* Effect.try({
        try: () => {
          if (process.options.shell && typeof process.options.shell === "string") {
            return CP.spawn(process.command, process.args, { ...spawnOptions, shell: process.options.shell })
          }
          return CP.spawn(process.command, process.args, spawnOptions)
        },
        catch: (error) =>
          new ChildProcess.SpawnError({
            command: `${process.command} ${process.args.join(" ")}`,
            cause: error
          })
      })

      // Handle input stream if provided
      if (normalizedStdio.inputStream && childProcess.stdin) {
        yield* pipe(
          normalizedStdio.inputStream,
          Stream.run(NodeSink.fromWritable({
            evaluate: () => childProcess.stdin!,
            onError: (error) =>
              new ChildProcess.StdioError({
                fd: "stdin",
                cause: error
              })
          })),
          Effect.fork,
          Effect.ignore
        )
      }

      // Collect stdout if needed
      const stdoutPromise = childProcess.stdout
        ? collectOutput(childProcess.stdout, process.options.maxBuffer)
        : Effect.succeed(undefined)

      // Collect stderr if needed
      const stderrPromise = childProcess.stderr
        ? collectOutput(childProcess.stderr, process.options.maxBuffer)
        : Effect.succeed(undefined)

      // Run custom sinks if provided
      if (normalizedStdio.outputSink && childProcess.stdout) {
        yield* pipe(
          NodeStream.fromReadable({
            evaluate: () => childProcess.stdout!,
            onError: (error) =>
              new ChildProcess.StdioError({
                fd: "stdout",
                cause: error
              })
          }),
          Stream.run(normalizedStdio.outputSink),
          Effect.fork,
          Effect.ignore
        )
      }

      if (normalizedStdio.errorSink && childProcess.stderr) {
        yield* pipe(
          NodeStream.fromReadable({
            evaluate: () => childProcess.stderr!,
            onError: (error) =>
              new ChildProcess.StdioError({
                fd: "stderr",
                cause: error
              })
          }),
          Stream.run(normalizedStdio.errorSink),
          Effect.fork,
          Effect.ignore
        )
      }

      // Wait for process to exit
      const exitInfo = yield* waitForExit(childProcess, process.options.timeout)

      // Collect outputs
      const stdout = yield* stdoutPromise
      const stderr = yield* stderrPromise

      const duration = Duration.millis(Date.now() - startTime)
      const command = `${process.command} ${process.args.join(" ")}`

      // Check for errors
      if (exitInfo.signal !== undefined) {
        return yield* Effect.fail(
          new ChildProcess.SignalError({
            command,
            signal: exitInfo.signal,
            stdout,
            stderr
          })
        )
      }

      if (exitInfo.exitCode !== 0 && exitInfo.exitCode !== undefined) {
        return yield* Effect.fail(
          new ChildProcess.ExitCodeError({
            command,
            exitCode: exitInfo.exitCode,
            stdout,
            stderr
          })
        )
      }

      return {
        command,
        exitCode: exitInfo.exitCode,
        signal: exitInfo.signal,
        stdout,
        stderr,
        all: undefined, // TODO: Implement interleaved output if needed
        duration
      }
    }).pipe(Effect.scoped),

  spawn: (process: ChildProcess.ChildProcess) =>
    Effect.gen(function*() {
      const normalizedStdio = normalizeStdio(process.options)

      // Build spawn options
      const spawnOptions: CP.SpawnOptions = {
        cwd: process.options.cwd,
        env: process.options.env ? { ...process.env, ...process.options.env } : process.env,
        shell: process.options.shell ?? false,
        windowsHide: process.options.windowsHide,
        uid: process.options.uid,
        gid: process.options.gid,
        detached: process.options.detached,
        stdio: [normalizedStdio.stdin, normalizedStdio.stdout, normalizedStdio.stderr]
      }

      // Spawn the process
      const childProcess = yield* Effect.try({
        try: () => {
          if (process.options.shell && typeof process.options.shell === "string") {
            return CP.spawn(process.command, process.args, { ...spawnOptions, shell: process.options.shell })
          }
          return CP.spawn(process.command, process.args, spawnOptions)
        },
        catch: (error) =>
          new ChildProcess.SpawnError({
            command: `${process.command} ${process.args.join(" ")}`,
            cause: error
          })
      })

      // Create stdin sink if available
      const stdin = childProcess.stdin
        ? NodeSink.fromWritable<ChildProcess.ChildProcessError, Uint8Array>({
          evaluate: () => childProcess.stdin!,
          onError: (error) =>
            new ChildProcess.StdioError({
              fd: "stdin",
              cause: error
            })
        })
        : undefined

      // Create stdout stream if available
      const stdout = childProcess.stdout
        ? NodeStream.fromReadable<Uint8Array, ChildProcess.ChildProcessError>({
          evaluate: () => childProcess.stdout!,
          onError: (error) =>
            new ChildProcess.StdioError({
              fd: "stdout",
              cause: error
            })
        })
        : undefined

      // Create stderr stream if available
      const stderr = childProcess.stderr
        ? NodeStream.fromReadable<Uint8Array, ChildProcess.ChildProcessError>({
          evaluate: () => childProcess.stderr!,
          onError: (error) =>
            new ChildProcess.StdioError({
              fd: "stderr",
              cause: error
            })
        })
        : undefined

      // Create exit code effect
      const exitCode = waitForExit(childProcess, process.options.timeout)

      // Create kill function
      const kill = (signal?: string) =>
        Effect.sync(() => {
          childProcess.kill(signal)
        })

      return {
        pid: childProcess.pid,
        stdin,
        stdout,
        stderr,
        all: undefined, // TODO: Implement interleaved output if needed
        exitCode,
        kill
      }
    }).pipe(Effect.scoped)
})

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

const collectOutput = (
  readable: Readable,
  maxBuffer?: number
): Effect.Effect<Uint8Array, ChildProcess.ChildProcessError> =>
  Effect.gen(function*() {
    const chunks: Array<Uint8Array> = []
    let totalBytes = 0

    yield* Effect.callback<void, ChildProcess.ChildProcessError>((resume) => {
      readable.on("data", (chunk: Buffer) => {
        const uint8Array = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
        chunks.push(uint8Array)
        totalBytes += uint8Array.length

        if (maxBuffer && totalBytes > maxBuffer) {
          readable.destroy()
          resume(
            Effect.fail(
              new ChildProcess.MaxBufferError({
                command: "",
                maxBuffer,
                stdout: undefined,
                stderr: undefined
              })
            )
          )
        }
      })

      readable.on("end", () => {
        resume(Effect.void)
      })

      readable.on("error", (error) => {
        resume(
          Effect.fail(
            new ChildProcess.StdioError({
              fd: "stdout",
              cause: error
            })
          )
        )
      })

      return Effect.sync(() => {
        readable.destroy()
      })
    })

    // Concatenate all chunks
    if (chunks.length === 0) {
      return new Uint8Array(0)
    }

    const result = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }

    return result
  })

const waitForExit = (
  childProcess: CP.ChildProcess,
  timeout?: Duration.Duration
): Effect.Effect<ChildProcess.ExitInfo, ChildProcess.ChildProcessError, Scope.Scope> => {
  const exitEffect = Effect.callback<ChildProcess.ExitInfo, ChildProcess.ChildProcessError>((resume) => {
    childProcess.on("exit", (code, signal) => {
      resume(
        Effect.succeed({
          exitCode: code ?? undefined,
          signal: signal ?? undefined
        })
      )
    })

    childProcess.on("error", (error) => {
      resume(
        Effect.fail(
          new ChildProcess.SpawnError({
            command: "",
            cause: error
          })
        )
      )
    })

    return Effect.sync(() => {
      childProcess.kill()
    })
  })

  if (timeout) {
    return pipe(
      exitEffect,
      Effect.timeout(timeout),
      Effect.flatMap((result) =>
        result._tag === "None"
          ? Effect.fail(
            new ChildProcess.TimeoutError({
              command: "",
              timeout,
              stdout: undefined,
              stderr: undefined
            })
          )
          : Effect.succeed(result.value)
      )
    )
  }

  return exitEffect
}

// ═══════════════════════════════════════════════════════════════
// LAYER
// ═══════════════════════════════════════════════════════════════

/**
 * @since 1.0.0
 * @category layers
 */
export const layer: Layer.Layer<ChildProcess.ChildProcessExecutor> = Layer.succeed(
  ChildProcess.ChildProcessExecutor,
  makeExecutor()
)
