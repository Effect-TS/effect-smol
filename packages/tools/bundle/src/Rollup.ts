/**
 * @since 1.0.0
 */
import * as NodeStream from "@effect/platform-node/NodeStream"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as ServiceMap from "effect/ServiceMap"
import * as Stream from "effect/Stream"
import { createGzip } from "node:zlib"
import type { RollupOptions } from "rollup"
import { rollup } from "rollup"
import { createPlugins } from "./Plugins.ts"

/**
 * @since 1.0.0
 * @category errors
 */
export class RollupError extends Data.TaggedError("RollupError")<{
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
export class Rollup extends ServiceMap.Service<Rollup>()(
  "@effect/bundle/Rollup",
  {
    make: Effect.gen(function*() {
      const pathService = yield* Path.Path

      const getRollupOptions = (options: BundleOptions): RollupOptions => ({
        input: options.path,
        output: {
          format: "esm",
          ...(options.outputDirectory ? { dir: options.outputDirectory } : {})
        },
        plugins: createPlugins(pathService, { visualize: options.visualize }),
        onwarn: (warning, next) => {
          if (warning.code === "THIS_IS_UNDEFINED") return
          next(warning)
        }
      })

      const bundle = Effect.fn("Rollup.bundle")(
        function*(options: BundleOptions) {
          return yield* Effect.acquireUseRelease(
            Effect.tryPromise({
              try: () => rollup(getRollupOptions(options)),
              catch: (cause) => new RollupError({ cause })
            }),
            Effect.fnUntraced(function*(bundle) {
              const { output } = yield* Effect.tryPromise({
                try: () => bundle.generate({ format: "esm" }),
                catch: (cause) => new RollupError({ cause })
              })

              const sizeInBytes = yield* Stream.fromIterable(output).pipe(
                Stream.filter((output) => output.type === "chunk"),
                Stream.map((chunk) => chunk.code),
                Stream.encodeText,
                NodeStream.pipeThroughDuplex({
                  evaluate: () => createGzip({ level: 9 }),
                  onError: (cause) => new RollupError({ cause })
                }),
                Stream.runFold(
                  () => 0,
                  (totalBytes, chunkBytes) => chunkBytes.length + totalBytes
                )
              )

              yield* Effect.log(`Bundled ${options.path}`).pipe(
                Effect.annotateLogs({ size: `${(sizeInBytes / 1000).toFixed(2)} kB` })
              )

              return new BundleStats({ path: options.path, sizeInBytes })
            }),
            (bundle) =>
              Effect.tryPromise({
                try: () => bundle.close(),
                catch: (cause) => new RollupError({ cause })
              })
          )
        }
      )

      const bundleAll = Effect.fn("Rollup.bundleAll")(
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
  static layer = Layer.effect(this, this.make)
}
