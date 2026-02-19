/**
 * @since 3.8.0
 */
import type * as Effect from "./Effect.ts"
import * as internal from "./internal/effect.ts"

/**
 * @category models
 * @since 3.8.0
 * @example
 * ```ts
 * import { Effect, Latch } from "effect"
 *
 * // Create and use a latch for coordination between fibers
 * const program = Effect.gen(function*() {
 *   const latch = yield* Latch.make()
 *
 *   // Wait for the latch to be opened
 *   yield* latch.await
 *
 *   return "Latch was opened!"
 * })
 * ```
 */
export interface Latch {
  /** open the latch, releasing all fibers waiting on it */
  readonly open: Effect.Effect<boolean>
  /** open the latch, releasing all fibers waiting on it */
  readonly openUnsafe: () => boolean
  /** release all fibers waiting on the latch, without opening it */
  readonly release: Effect.Effect<boolean>
  /** wait for the latch to be opened */
  readonly await: Effect.Effect<void>
  /** close the latch */
  readonly close: Effect.Effect<boolean>
  /** close the latch */
  readonly closeUnsafe: () => boolean
  /** only run the given effect when the latch is open */
  readonly whenOpen: <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
}

/**
 * Creates a new Latch unsafely.
 *
 * @example
 * ```ts
 * import { Effect, Latch } from "effect"
 *
 * const latch = Latch.unsafeMake(false)
 *
 * const waiter = Effect.gen(function*() {
 *   yield* Effect.log("Waiting for latch to open...")
 *   yield* latch.await
 *   yield* Effect.log("Latch opened! Continuing...")
 * })
 *
 * const opener = Effect.gen(function*() {
 *   yield* Effect.sleep("2 seconds")
 *   yield* Effect.log("Opening latch...")
 *   yield* latch.open
 * })
 *
 * const program = Effect.all([waiter, opener])
 * ```
 *
 * @category constructors
 * @since 3.8.0
 */
export const unsafeMake: (open?: boolean | undefined) => Latch = internal.makeLatchUnsafe

/**
 * Creates a new Latch.
 *
 * @example
 * ```ts
 * import { Effect, Latch } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const latch = yield* Latch.make(false)
 *
 *   const waiter = Effect.gen(function*() {
 *     yield* Effect.log("Waiting for latch to open...")
 *     yield* latch.await
 *     yield* Effect.log("Latch opened! Continuing...")
 *   })
 *
 *   const opener = Effect.gen(function*() {
 *     yield* Effect.sleep("2 seconds")
 *     yield* Effect.log("Opening latch...")
 *     yield* latch.open
 *   })
 *
 *   yield* Effect.all([waiter, opener])
 * })
 * ```
 *
 * @category constructors
 * @since 3.8.0
 */
export const make: (open?: boolean | undefined) => Effect.Effect<Latch> = internal.makeLatch
