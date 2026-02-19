/**
 * @since 2.0.0
 */
import * as Effect from "./Effect.ts"
import * as internal from "./internal/effect.ts"
import * as MutableHashMap from "./MutableHashMap.ts"
import * as Option from "./Option.ts"

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
 * @example
 * ```ts
 * import { Effect, Semaphore } from "effect"
 *
 * const semaphore = Semaphore.unsafeMake(3)
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
export const unsafeMake: (permits: number) => Semaphore = internal.makeSemaphoreUnsafe

/**
 * Creates a new Semaphore.
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

// -----------------------------------------------------------------------------
// Partitioned
// -----------------------------------------------------------------------------

/**
 * @since 3.19.4
 * @category models
 */
export const PartitionedTypeId: PartitionedTypeId = "~effect/PartitionedSemaphore"

/**
 * @since 3.19.4
 * @category models
 */
export type PartitionedTypeId = "~effect/PartitionedSemaphore"

/**
 * A `Partitioned` semaphore controls access to a shared permit pool while
 * tracking waiters by partition key.
 *
 * Waiting permits are distributed across partitions in round-robin order.
 *
 * @since 3.19.4
 * @category models
 */
export interface Partitioned<in K> {
  readonly [PartitionedTypeId]: PartitionedTypeId
  readonly withPermits: (
    key: K,
    permits: number
  ) => <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
}

/**
 * Creates a `Partitioned` semaphore unsafely.
 *
 * @since 3.19.4
 * @category constructors
 */
export const makePartitionedUnsafe = <K = unknown>(options: {
  readonly permits: number
}): Partitioned<K> => {
  const maxPermits = Math.max(0, options.permits)

  if (!Number.isFinite(maxPermits)) {
    return {
      [PartitionedTypeId]: PartitionedTypeId,
      withPermits: () => (effect) => effect
    }
  }

  let totalPermits = maxPermits
  let waitingPermits = 0

  type Waiter = {
    permits: number
    readonly resume: () => void
  }
  const partitions = MutableHashMap.empty<K, Set<Waiter>>()

  const take = (key: K, permits: number) =>
    Effect.callback<void>((resume) => {
      if (maxPermits < permits) {
        resume(Effect.never)
        return
      }

      if (totalPermits >= permits) {
        totalPermits -= permits
        resume(Effect.void)
        return
      }

      const needed = permits - totalPermits
      const taken = permits - needed
      if (totalPermits > 0) {
        totalPermits = 0
      }
      waitingPermits += needed

      const waiters = Option.getOrElse(
        MutableHashMap.get(partitions, key),
        () => {
          const set = new Set<Waiter>()
          MutableHashMap.set(partitions, key, set)
          return set
        }
      )

      const entry: Waiter = {
        permits: needed,
        resume: () => {
          cleanup()
          resume(Effect.void)
        }
      }

      const cleanup = () => {
        waiters.delete(entry)
        if (waiters.size === 0) {
          MutableHashMap.remove(partitions, key)
        }
      }

      waiters.add(entry)

      return Effect.sync(() => {
        cleanup()
        waitingPermits -= entry.permits
        if (taken > 0) {
          releaseUnsafe(taken)
        }
      })
    })

  let iterator = partitions[Symbol.iterator]()

  const releaseUnsafe = (permits: number): void => {
    while (permits > 0) {
      if (waitingPermits === 0) {
        totalPermits += permits
        return
      }

      let state = iterator.next()
      if (state.done) {
        iterator = partitions[Symbol.iterator]()
        state = iterator.next()
        if (state.done) {
          return
        }
      }

      const waiter = state.value[1].values().next().value
      if (waiter === undefined) {
        continue
      }

      waiter.permits -= 1
      waitingPermits -= 1

      if (waiter.permits === 0) {
        waiter.resume()
      }

      permits -= 1
    }
  }

  return {
    [PartitionedTypeId]: PartitionedTypeId,
    withPermits: (key, permits) => {
      const takePermits = take(key, permits)
      return (effect) =>
        Effect.uninterruptibleMask((restore) =>
          Effect.flatMap(
            restore(takePermits),
            () => Effect.ensuring(restore(effect), Effect.sync(() => releaseUnsafe(permits)))
          )
        )
    }
  }
}

/**
 * Creates a `Partitioned` semaphore.
 *
 * @since 3.19.4
 * @category constructors
 */
export const makePartitioned = <K = unknown>(options: {
  readonly permits: number
}): Effect.Effect<Partitioned<K>> => Effect.sync(() => makePartitionedUnsafe<K>(options))
