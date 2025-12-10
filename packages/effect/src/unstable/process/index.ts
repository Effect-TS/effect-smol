/**
 * @since 4.0.0
 */

/**
 * An Effect-native module for working with child processes.
 *
 * This module uses an AST-based approach where commands are built first
 * using `make` and `pipeTo`, then executed using `exec` or `spawn`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { ChildProcess } from "effect/unstable/process"
 * import { NodeChildProcessExecutor } from "@effect/platform-node"
 *
 * // Build a command
 * const cmd = ChildProcess.make`echo "hello world"`
 *
 * // Execute it
 * const result = ChildProcess.exec(cmd).pipe(
 *   Effect.provide(NodeChildProcessExecutor.layer),
 *   Effect.runPromise
 * )
 *
 * // With options
 * const withOptions = ChildProcess.make({ cwd: "/tmp" })`ls -la`
 *
 * // Piping commands
 * const pipeline = ChildProcess.make`cat package.json`.pipe(
 *   ChildProcess.pipeTo(ChildProcess.make`grep name`)
 * )
 *
 * // Execute the pipeline
 * const pipelineResult = ChildProcess.exec(pipeline).pipe(
 *   Effect.provide(NodeChildProcessExecutor.layer),
 *   Effect.runPromise
 * )
 * ```
 *
 * @since 4.0.0
 */
export * as ChildProcess from "./ChildProcess.ts"

/**
 * A module containing typed errors which can occur when working with child
 * processes.
 *
 * @since 4.0.0
 */
export * as ChildProcessError from "./ChildProcessError.ts"

/**
 * A module providing a generic service interface for executing child processes.
 *
 * This module provides the `ChildProcessExecutor` service tag which can be
 * implemented by platform-specific packages (e.g., Node.js).
 *
 * @since 4.0.0
 */
export * as ChildProcessExecutor from "./ChildProcessExecutor.ts"
