/**
 * Post-processing service for linting and formatting generated code.
 *
 * @since 1.0.0
 */
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as ServiceMap from "effect/ServiceMap"
import * as Stream from "effect/Stream"
import * as ChildProcess from "effect/unstable/process/ChildProcess"
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner"

/**
 * Error during post-processing (lint or format).
 *
 * @example
 * ```ts
 * import * as PostProcess from "@effect/ai-codegen/PostProcess"
 *
 * const error = new PostProcess.PostProcessError({
 *   step: "lint",
 *   filePath: "/path/to/file.ts",
 *   cause: new Error("Lint failed")
 * })
 * ```
 *
 * @since 1.0.0
 * @category errors
 */
export class PostProcessError extends Data.TaggedError("PostProcessError")<{
  readonly step: "lint" | "format"
  readonly filePath: string
  readonly cause: unknown
}> {}

/**
 * Service for post-processing generated code.
 *
 * @since 1.0.0
 * @category models
 */
export interface PostProcessor {
  readonly lint: (filePath: string) => Effect.Effect<void, PostProcessError>
  readonly format: (filePath: string) => Effect.Effect<void, PostProcessError>
}

/**
 * @since 1.0.0
 * @category tags
 */
export const PostProcessor: ServiceMap.Service<PostProcessor, PostProcessor> = ServiceMap.Service(
  "@effect/ai-codegen/PostProcessor"
)

/**
 * Layer providing the PostProcessor service.
 *
 * @since 1.0.0
 * @category layers
 */
export const layer: Layer.Layer<
  PostProcessor,
  never,
  ChildProcessSpawner.ChildProcessSpawner
> = Effect.gen(function*() {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner

  const runCommand = Effect.fn("runCommand")(function*(
    command: string,
    args: ReadonlyArray<string>,
    step: "lint" | "format",
    filePath: string
  ) {
    const cmd = ChildProcess.make(command, args, {
      stdout: "inherit",
      stderr: "inherit"
    })

    yield* Effect.scoped(Effect.gen(function*() {
      const handle = yield* spawner.spawn(cmd).pipe(
        Effect.mapError((cause) => new PostProcessError({ step, filePath, cause }))
      )

      // Drain stdout/stderr streams
      yield* Stream.runDrain(handle.stdout).pipe(Effect.ignore)
      yield* Stream.runDrain(handle.stderr).pipe(Effect.ignore)

      const exitCode = yield* handle.exitCode.pipe(
        Effect.mapError((cause) => new PostProcessError({ step, filePath, cause }))
      )

      if (exitCode !== 0) {
        return yield* new PostProcessError({
          step,
          filePath,
          cause: new Error(`Command exited with code ${exitCode}`)
        })
      }
    }))
  })

  const lint = Effect.fn("lint")(function*(filePath: string) {
    yield* runCommand("pnpm", ["exec", "oxlint", "--silent", "--fix", filePath], "lint", filePath)
  })

  const format = Effect.fn("format")(function*(filePath: string) {
    yield* runCommand("pnpm", ["exec", "dprint", "--log-level", "silent", "fmt", filePath], "format", filePath)
  })

  return { lint, format }
}).pipe(Layer.effect(PostProcessor))
