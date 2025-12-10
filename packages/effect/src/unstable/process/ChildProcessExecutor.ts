/**
 * A module providing a generic service interface for executing child processes.
 *
 * This module provides the `ChildProcessExecutor` service tag which can be
 * implemented by platform-specific packages (e.g., Node.js).
 *
 * @since 4.0.0
 */
import * as Brand from "../../data/Brand.ts"
import type * as Duration from "../../Duration.ts"
import type * as Effect from "../../Effect.ts"
import type * as PlatformError from "../../platform/PlatformError.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as Sink from "../../stream/Sink.ts"
import type * as Stream from "../../stream/Stream.ts"
import type { Command, KillOptions } from "./ChildProcess.ts"

/**
 * @since 4.0.0
 * @category Models
 */
export type ExitCode = Brand.Branded<number, "ExitCode">

/**
 * @since 4.0.0
 * @category Constructors
 */
export const ExitCode: Brand.Constructor<ExitCode> = Brand.nominal<ExitCode>()

/**
 * @since 4.0.0
 * @category Models
 */
export type ProcessId = Brand.Branded<number, "ProcessId">

/**
 * @since 4.0.0
 * @category Constructors
 */
export const ProcessId: Brand.Constructor<ProcessId> = Brand.nominal<ProcessId>()

/**
 * The result of executing a child process to completion.
 *
 * @since 4.0.0
 * @category Models
 */
export interface ChildProcessResult {
  readonly executable: string
  readonly args: ReadonlyArray<string>
  readonly exitCode: number
  readonly stdout: string | Uint8Array
  readonly stderr: string | Uint8Array
  readonly duration: Duration.Duration
}

/**
 * A handle to a running child process.
 *
 * @since 4.0.0
 * @category Models
 */
export interface ChildProcessHandle {
  /**
   * The child process process identifier.
   */
  readonly pid: ProcessId
  /**
   * Waits for the child process to exit and returns the `ExitCode` of the
   * command that was run.
   */
  readonly exitCode: Effect.Effect<ExitCode, PlatformError.PlatformError>
  /**
   * Returns `true` if the child process is still running, otherwise returns
   * `false`.
   */
  readonly isRunning: Effect.Effect<boolean, PlatformError.PlatformError>
  /**
   * Kills the child process with the provided signal.
   *
   * If no signal option is provided, the signal defaults to `SIGTERM`.
   */
  readonly kill: (options?: KillOptions | undefined) => Effect.Effect<void, PlatformError.PlatformError>
  /**
   * The standard input sink for the child process.
   */
  readonly stdin: Sink.Sink<void, Uint8Array, never, PlatformError.PlatformError>
  /**
   * The standard output stream for the child process.
   */
  readonly stdout: Stream.Stream<Uint8Array, PlatformError.PlatformError>
  /**
   * The standard error stream for the child process.
   */
  readonly stderr: Stream.Stream<Uint8Array, PlatformError.PlatformError>
}

/**
 * Service interface for executing child processes.
 *
 * @since 4.0.0
 * @category Models
 */
export interface ChildProcessExecutor {
  /**
   * Spawn a command and return a handle for interaction.
   */
  readonly spawn: (
    command: Command
  ) => Effect.Effect<ChildProcessHandle, PlatformError.PlatformError, Scope.Scope>
}

/**
 * Service tag for child process executor.
 *
 * @since 4.0.0
 * @category Tag
 */
export const ChildProcessExecutor: ServiceMap.Service<
  ChildProcessExecutor,
  ChildProcessExecutor
> = ServiceMap.Service("effect/process/ChildProcessExecutor")
