/**
 * @since 3.19.4
 * @experimental
 */
import * as Effect from "./Effect.ts"
import * as MutableHashMap from "./MutableHashMap.ts"
import * as Option from "./Option.ts"

/**
 * @since 3.19.4
 * @category models
 * @experimental
 */
export const TypeId: TypeId = "~effect/PartitionedSemaphore"

/**
 * @since 3.19.4
 * @category models
 * @experimental
 */
export type TypeId = "~effect/PartitionedSemaphore"

/**
 * A `PartitionedSemaphore` controls access to a shared permit pool while
 * tracking waiters by partition key.
 *
 * Waiting permits are distributed across partitions in round-robin order.
 *
 * @since 3.19.4
 * @category models
 * @experimental
 */
export interface PartitionedSemaphore<in K> {
  readonly [TypeId]: TypeId
  readonly withPermits: (
    key: K,
    permits: number
  ) => <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
}

/**
 * Creates a `PartitionedSemaphore` unsafely.
 *
 * @since 3.19.4
 * @category constructors
 * @experimental
 */
export const makeUnsafe = <K = unknown>(options: {
  readonly permits: number
}): PartitionedSemaphore<K> => {
  const maxPermits = Math.max(0, options.permits)

  if (!Number.isFinite(maxPermits)) {
    return {
      [TypeId]: TypeId,
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
    [TypeId]: TypeId,
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
 * Creates a `PartitionedSemaphore`.
 *
 * @since 3.19.4
 * @category constructors
 * @experimental
 */
export const make = <K = unknown>(options: {
  readonly permits: number
}): Effect.Effect<PartitionedSemaphore<K>> => Effect.sync(() => makeUnsafe<K>(options))
