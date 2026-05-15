/**
 * @since 4.0.0
 */
import * as Context from "./Context.ts"
import * as Effect from "./Effect.ts"
import * as Layer from "./Layer.ts"
import type { PlatformError } from "./PlatformError.ts"
import * as Sink from "./Sink.ts"
import * as Stream from "./Stream.ts"

/**
 * @category Type IDs
 * @since 4.0.0
 */
export type TypeId = "~effect/Stdio"

/**
 * @category Type IDs
 * @since 4.0.0
 */
export const TypeId: TypeId = "~effect/Stdio"

/**
 * @category Models
 * @since 4.0.0
 */
export interface Stdio {
  readonly [TypeId]: TypeId
  readonly args: Effect.Effect<ReadonlyArray<string>>
  stdout(options?: {
    readonly endOnDone?: boolean | undefined
  }): Sink.Sink<void, string | Uint8Array, never, PlatformError>
  stderr(options?: {
    readonly endOnDone?: boolean | undefined
  }): Sink.Sink<void, string | Uint8Array, never, PlatformError>
  readonly stdin: Stream.Stream<Uint8Array, PlatformError>
}
/**
 * @category Services
 * @since 4.0.0
 */
export const Stdio: Context.Service<Stdio, Stdio> = Context.Service<Stdio>(TypeId)

/**
 * @category Constructors
 * @since 4.0.0
 */
export const make = (options: Omit<Stdio, TypeId>): Stdio => ({
  [TypeId]: TypeId,
  ...options
})

/**
 * @category Layers
 * @since 4.0.0
 */
export const layerTest = (impl: Partial<Stdio>): Layer.Layer<Stdio> =>
  Layer.succeed(
    Stdio,
    make({
      args: Effect.succeed([]),
      stdout: () => Sink.drain,
      stderr: () => Sink.drain,
      stdin: Stream.empty,
      ...impl
    })
  )
