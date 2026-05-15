import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as GlobLib from "glob"

/**
 * @category errors
 * @since 1.0.0
 */
export class GlobError extends Data.TaggedError("GlobError")<{
  readonly pattern: string | ReadonlyArray<string>
  readonly cause: unknown
}> {}

/**
 * @category models
 * @since 1.0.0
 */
export interface Glob {
  readonly glob: (
    pattern: string | ReadonlyArray<string>,
    options?: GlobLib.GlobOptions
  ) => Effect.Effect<Array<string>, GlobError>
}

/**
 * @category tags
 * @since 1.0.0
 */
export const Glob: Context.Service<Glob, Glob> = Context.Service("@effect/utils/Glob")

/**
 * @category layers
 * @since 1.0.0
 */
export const layer: Layer.Layer<Glob> = Layer.succeed(Glob, {
  glob: (pattern, options) =>
    Effect.tryPromise({
      try: () => GlobLib.glob(pattern as string | Array<string>, options ?? {}) as Promise<Array<string>>,
      catch: (cause) => new GlobError({ pattern, cause })
    })
})
