/**
 * @since 4.0.0
 */

/**
 * An Effect-native module for working with child processes.
 *
 * This module uses an AST-based approach where commands are built first
 * using `make` and `pipeTo`, then executed using `spawn`.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 * import { ChildProcess } from "effect/unstable/process"
 * import { NodeChildProcessExecutor } from "@effect/platform-node"
 *
 * // Build a command
 * const cmd = ChildProcess.make`echo "hello world"`
 *
 * // Spawn and collect output
 * const program = Effect.gen(function* () {
 *   const handle = yield* ChildProcess.spawn(cmd)
 *   const chunks = yield* Stream.runCollect(handle.stdout)
 *   const exitCode = yield* handle.exitCode
 *   return { chunks, exitCode }
 * }).pipe(Effect.scoped, Effect.provide(NodeChildProcessExecutor.layer))
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
 * }).pipe(Effect.scoped, Effect.provide(NodeChildProcessExecutor.layer))
 * ```
 *
 * @since 4.0.0
 */
export * as ChildProcess from "./ChildProcess.ts"

/**
 * A module providing a generic service interface for executing child processes.
 *
 * This module provides the `ChildProcessExecutor` service tag which can be
 * implemented by platform-specific packages (e.g., Node.js).
 *
 * @since 4.0.0
 */
export * as ChildProcessExecutor from "./ChildProcessExecutor.ts"
