/**
 * @since 4.0.0
 */
import type { PlatformError } from "./PlatformError.ts"
import * as ServiceMap from "./ServiceMap.ts"
import type * as Sink from "./Sink.ts"
import type * as Stream from "./Stream.ts"

/**
 * @since 4.0.0
 * @category Type IDs
 */
export type TypeId = "~effect/Stdio"

/**
 * @since 4.0.0
 * @category Type IDs
 */
export const TypeId: TypeId = "~effect/Stdio"

/**
 * @since 4.0.0
 * @category Models
 */
export interface Stdio {
  readonly [TypeId]: TypeId
  readonly stdout: Sink.Sink<void, string | Uint8Array, never, PlatformError>
  readonly stderr: Sink.Sink<void, string | Uint8Array, never, PlatformError>
  readonly stdin: Stream.Stream<Uint8Array, PlatformError>
}
/**
 * @since 4.0.0
 * @category Services
 */
export const Stdio: ServiceMap.Service<Stdio, Stdio> = ServiceMap.Service<Stdio>(TypeId)

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make = (options: Omit<Stdio, TypeId>): Stdio => ({
  [TypeId]: TypeId,
  ...options
})
