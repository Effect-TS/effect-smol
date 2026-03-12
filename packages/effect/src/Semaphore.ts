/**
 * @since 2.0.0
 */
import type * as Effect from "./Effect.ts"
import { dual } from "./Function.ts"
import * as internal from "./internal/effect.ts"
import type * as Option from "./Option.ts"
import * as PartitionedSemaphore from "./PartitionedSemaphore.ts"

/**
 * @category models
 * @since 2.0.0
 * @example
 * ```ts
 * import { Effect, Semaphore } from "effect"
 *
 * // Create and use a semaphore for controlling concurrent access
 * const program = Effect.gen(function*() {
 *   const semaphore = yield* Semaphore.make(2)
 *
 *   return yield* semaphore.withPermits(1)(
 *     Effect.succeed("Resource accessed")
 *   )
 * })
 * ```
 */
export interface Semaphore {
  /**
   * Adjusts the number of permits available in the semaphore.
   */
  resize(permits: number): Effect.Effect<void>

  /**
   * Runs an effect with the given number of permits and releases the permits
   * when the effect completes.
   *
   * **Details**
   *
   * This function acquires the specified number of permits before executing
   * the provided effect. Once the effect finishes, the permits are released.
   * If insufficient permits are available, the function will wait until they
   * are released by other tasks.
   */
  withPermits(permits: number): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>

  /**
   * Runs an effect with the given number of permits and releases the permits
   * when the effect completes.
   *
   * **Details**
   *
   * This function acquires the specified number of permits before executing
   * the provided effect. Once the effect finishes, the permits are released.
   * If insufficient permits are available, the function will wait until they
   * are released by other tasks.
   */
  withPermit<A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E, R>

  /**
   * Runs an effect only if the specified number of permits are immediately
   * available.
   *
   * **Details**
   *
   * This function attempts to acquire the specified number of permits. If they
   * are available, it runs the effect and releases the permits after the effect
   * completes. If permits are not available, the effect does not execute, and
   * the result is `Option.none`.
   */
  withPermitsIfAvailable(
    permits: number
  ): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<Option.Option<A>, E, R>

  /**
   * Acquires the specified number of permits and returns the resulting
   * available permits, suspending the task if they are not yet available.
   * Concurrent pending `take` calls are processed in a first-in, first-out manner.
   */
  take(permits: number): Effect.Effect<number>

  /**
   * Releases the specified number of permits and returns the resulting
   * available permits.
   */
  release(permits: number): Effect.Effect<number>

  /**
   * Releases all permits held by this semaphore and returns the resulting available permits.
   */
  releaseAll: Effect.Effect<number>
}

/**
 * Unsafely creates a new Semaphore.
 *
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Effect.makeSemaphoreUnsafe`
 *
 * @example
 * ```ts
 * import { Effect, Semaphore } from "effect"
 *
 * const semaphore = Semaphore.makeUnsafe(3)
 *
 * const task = (id: number) =>
 *   semaphore.withPermits(1)(
 *     Effect.gen(function*() {
 *       yield* Effect.log(`Task ${id} started`)
 *       yield* Effect.sleep("1 second")
 *       yield* Effect.log(`Task ${id} completed`)
 *     })
 *   )
 *
 * // Only 3 tasks can run concurrently
 * const program = Effect.all([
 *   task(1),
 *   task(2),
 *   task(3),
 *   task(4),
 *   task(5)
 * ], { concurrency: "unbounded" })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const makeUnsafe: (permits: number) => Semaphore = internal.makeSemaphoreUnsafe

/**
 * Creates a new Semaphore.
 *
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Effect.makeSemaphore`
 *
 * @example
 * ```ts
 * import { Effect, Semaphore } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const semaphore = yield* Semaphore.make(2)
 *
 *   const task = (id: number) =>
 *     semaphore.withPermits(1)(
 *       Effect.gen(function*() {
 *         yield* Effect.log(`Task ${id} acquired permit`)
 *         yield* Effect.sleep("1 second")
 *         yield* Effect.log(`Task ${id} releasing permit`)
 *       })
 *     )
 *
 *   // Run 4 tasks, but only 2 can run concurrently
 *   yield* Effect.all([task(1), task(2), task(3), task(4)])
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const make: (permits: number) => Effect.Effect<Semaphore> = internal.makeSemaphore

/**
 * Adjusts the number of permits available in the semaphore.
 *
 * @since 4.0.0
 * @category combinators
 */
export const resize: {
  (permits: number): (self: Semaphore) => Effect.Effect<void>
  (self: Semaphore, permits: number): Effect.Effect<void>
} = dual(2, (self: Semaphore, permits: number) => self.resize(permits))

/**
 * Runs an effect with the given number of permits and releases the permits when
 * the effect completes.
 *
 * @since 4.0.0
 * @category combinators
 */
export const withPermits: {
  (self: Semaphore, permits: number): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  <A, E, R>(effect: Effect.Effect<A, E, R>, self: Semaphore, permits: number): Effect.Effect<A, E, R>
} = dual(
  3,
  <A, E, R>(effect: Effect.Effect<A, E, R>, self: Semaphore, permits: number): Effect.Effect<A, E, R> =>
    self.withPermits(permits)(effect)
)

/**
 * Runs an effect with a single permit and releases the permit when the effect
 * completes.
 *
 * @since 4.0.0
 * @category combinators
 */
export const withPermit: {
  (self: Semaphore): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  <A, E, R>(effect: Effect.Effect<A, E, R>, self: Semaphore): Effect.Effect<A, E, R>
} = dual(
  2,
  <A, E, R>(effect: Effect.Effect<A, E, R>, self: Semaphore): Effect.Effect<A, E, R> => self.withPermit(effect)
)

/**
 * Runs an effect only if the specified number of permits are immediately
 * available.
 *
 * @since 4.0.0
 * @category combinators
 */
export const withPermitsIfAvailable: {
  (self: Semaphore, permits: number): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<Option.Option<A>, E, R>
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    self: Semaphore,
    permits: number
  ): Effect.Effect<Option.Option<A>, E, R>
} = dual(
  3,
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    self: Semaphore,
    permits: number
  ): Effect.Effect<Option.Option<A>, E, R> => self.withPermitsIfAvailable(permits)(effect)
)

/**
 * Acquires the specified number of permits and returns the resulting available
 * permits, suspending the task if they are not yet available.
 *
 * @since 4.0.0
 * @category combinators
 */
export const take: {
  (permits: number): (self: Semaphore) => Effect.Effect<number>
  (self: Semaphore, permits: number): Effect.Effect<number>
} = dual(2, (self: Semaphore, permits: number) => self.take(permits))

/**
 * Releases the specified number of permits and returns the resulting available
 * permits.
 *
 * @since 4.0.0
 * @category combinators
 */
export const release: {
  (permits: number): (self: Semaphore) => Effect.Effect<number>
  (self: Semaphore, permits: number): Effect.Effect<number>
} = dual(2, (self: Semaphore, permits: number) => self.release(permits))

/**
 * Releases all permits held by this semaphore and returns the resulting
 * available permits.
 *
 * @since 4.0.0
 * @category combinators
 */
export const releaseAll = (self: Semaphore): Effect.Effect<number> => self.releaseAll

/**
 * @since 3.19.4
 * @category models
 */
export const PartitionedTypeId: PartitionedTypeId = PartitionedSemaphore.PartitionedTypeId

/**
 * @since 3.19.4
 * @category models
 */
export type PartitionedTypeId = PartitionedSemaphore.PartitionedTypeId

/**
 * @since 3.19.4
 * @category models
 */
export interface Partitioned<in K> extends PartitionedSemaphore.PartitionedSemaphore<K> {}

/**
 * @since 3.19.4
 * @category constructors
 */
export const makePartitionedUnsafe = PartitionedSemaphore.makeUnsafe

/**
 * @since 3.19.4
 * @category constructors
 */
export const makePartitioned = PartitionedSemaphore.make
