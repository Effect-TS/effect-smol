/**
 * @since 1.0.0
 */
import * as NodeStream from "@effect/platform-node/NodeStream"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as FiberSet from "effect/FiberSet"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as ServiceMap from "effect/ServiceMap"
import * as Stream from "effect/Stream"
import { createGzip } from "node:zlib"
import type { InputOptions } from "rolldown"
import { rolldown } from "rolldown"
import { createPlugins } from "./Plugins.ts"

/**
 * @since 1.0.0
 * @category errors
 */
export class RolldownError extends Data.TaggedError("RolldownError")<{
  readonly cause: unknown
}> {}

/**
 * @since 1.0.0
 * @category models
 */
export class BundleStats extends Data.TaggedClass("BundleStats")<{
  readonly path: string
  readonly sizeInBytes: number
}> {}

/**
 * @since 1.0.0
 * @category models
 */
export interface BundleOptions {
  readonly path: string
  readonly visualize?: boolean | undefined
  readonly outputDirectory?: string | undefined
}

/**
 * @since 1.0.0
 * @category models
 */
export interface BundleAllOptions {
  readonly paths: ReadonlyArray<string>
  readonly visualize?: boolean | undefined
  readonly outputDirectory?: string | undefined
}

/**
 * @since 1.0.0
 * @category services
 */
export class Rolldown extends ServiceMap.Service<Rolldown>()(
  "@effect/bundle/Rolldown",
  {
    make: Effect.gen(function*() {
      const pathService = yield* Path.Path
      const fs = yield* FileSystem.FileSystem

      const getRolldownOptions = (options: BundleOptions): InputOptions => ({
        input: options.path,
        plugins: createPlugins(pathService, { visualize: options.visualize }),
        onwarn: (warning, next) => {
          if (warning.code === "THIS_IS_UNDEFINED") return
          next(warning)
        },
        transform: {
          define: {
            "process.env.NODE_ENV": JSON.stringify("production")
          }
        }
      })

      const bundle = Effect.fn("Rolldown.bundle")(
        function*(options: BundleOptions) {
          const bundleInstance = yield* Effect.acquireRelease(
            Effect.tryPromise({
              try: () => rolldown(getRolldownOptions(options)),
              catch: (cause) => new RolldownError({ cause })
            }),
            (b) => Effect.promise(() => b.close())
          )
          const fibers = yield* FiberSet.make()

          const { output } = yield* Effect.tryPromise({
            try: () =>
              bundleInstance.generate({
                format: "esm",
                minify: true,
                comments: "none"
              }),
            catch: (cause) => new RolldownError({ cause })
          })

          const stream = yield* Stream.fromIterable(output).pipe(
            Stream.filter((output) => output.type === "chunk"),
            Stream.map((chunk) => chunk.code),
            Stream.encodeText,
            Stream.broadcast({ capacity: 8, replay: 8 })
          )

          if (options.outputDirectory) {
            const outputPath = pathService.join(
              options.outputDirectory,
              `${pathService.parse(options.path).name}.min.js`
            )
            yield* FiberSet.run(
              fibers,
              stream.pipe(
                Stream.run(fs.sink(outputPath))
              )
            )
          }

          const sizeInBytes = yield* stream.pipe(
            NodeStream.pipeThroughDuplex({
              evaluate: () => createGzip({ level: 9 }),
              onError: (cause) => new RolldownError({ cause })
            }),
            Stream.runFold(
              () => 0,
              (totalBytes, chunkBytes) => chunkBytes.length + totalBytes
            )
          )

          yield* FiberSet.awaitEmpty(fibers)

          yield* Effect.log(`Bundled ${options.path}`).pipe(
            Effect.annotateLogs({ size: `${(sizeInBytes / 1000).toFixed(2)} kB` })
          )

          return new BundleStats({ path: options.path, sizeInBytes })
        },
        Effect.scoped
      )

      const bundleAll = Effect.fn("Rolldown.bundleAll")(
        function*(options: BundleAllOptions) {
          return yield* Effect.forEach(
            options.paths,
            (path) => bundle({ path, visualize: options.visualize, outputDirectory: options.outputDirectory }),
            { concurrency: options.paths.length }
          )
        }
      )

      return {
        bundle,
        bundleAll
      } as const
    })
  }
) {
  static readonly layer = Layer.effect(this, this.make)
}
