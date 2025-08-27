/**
 * @since 4.0.0
 */
import * as Arr from "../collections/Array.ts"
import * as MutableHashMap from "../collections/MutableHashMap.ts"
import * as Option from "../data/Option.ts"
import type { Predicate } from "../data/Predicate.ts"
import * as Deferred from "../Deferred.ts"
import type * as Effect from "../Effect.ts"
import type * as Exit from "../Exit.ts"
import * as Fiber from "../Fiber.ts"
import { dual, identity } from "../Function.ts"
import type { Pipeable } from "../interfaces/Pipeable.ts"
import * as core from "../internal/core.ts"
import { PipeInspectableProto } from "../internal/core.ts"
import * as effect from "../internal/effect.ts"
import * as Scope from "../Scope.ts"
import * as ServiceMap from "../ServiceMap.ts"
import * as Duration from "../time/Duration.ts"

/**
 * @since 4.0.0
 * @category Type Identifiers
 */
export const TypeId: TypeId = "~effect/caching/ScopedCache"

/**
 * @since 4.0.0
 * @category Type Identifiers
 */
export type TypeId = "~effect/caching/ScopedCache"

/**
 * @since 4.0.0
 * @category Models
 */
export interface ScopedCache<in out Key, in out A, in out E = never, out R = never> extends Pipeable {
  readonly [TypeId]: TypeId
  state: State<Key, A, E>
  readonly capacity: number
  readonly lookup: (key: Key) => Effect.Effect<A, E, R | Scope.Scope>
  readonly timeToLive: (exit: Exit.Exit<A, E>, key: Key) => Duration.Duration
}

/**
 * @since 4.0.0
 * @category Models
 */
export type State<K, A, E> = {
  readonly _tag: "Open"
  readonly map: MutableHashMap.MutableHashMap<K, Entry<A, E>>
} | {
  readonly _tag: "Closed"
}

/**
 * Represents a cache entry containing a deferred value and optional expiration time.
 * This is used internally by the cache implementation to track cached values and their lifetimes.
 *
 * @since 4.0.0
 * @category Models
 */
export interface Entry<A, E> {
  expiresAt: number | undefined
  readonly deferred: Deferred.Deferred<A, E>
  readonly scope: Scope.Scope.Closeable
}

/**
 * @since 4.0.0
 * @category Constructors
 */
export const makeWith = <
  Key,
  A,
  E = never,
  R = never,
  ServiceMode extends "lookup" | "construction" = never
>(options: {
  readonly lookup: (key: Key) => Effect.Effect<A, E, R | Scope.Scope>
  readonly capacity: number
  readonly timeToLive?: ((exit: Exit.Exit<A, E>, key: Key) => Duration.DurationInput) | undefined
  readonly requireServicesAt?: ServiceMode | undefined
}): Effect.Effect<
  ScopedCache<Key, A, E, "lookup" extends ServiceMode ? Exclude<R, Scope.Scope> : never>,
  never,
  ("lookup" extends ServiceMode ? never : R) | Scope.Scope
> =>
  effect.servicesWith((services: ServiceMap.ServiceMap<any>) => {
    const scope = ServiceMap.unsafeGet(services, Scope.Scope)
    const self = Object.create(Proto)
    self.lookup = (key: Key): Effect.Effect<A, E> =>
      effect.updateServices(
        options.lookup(key),
        (input) => ServiceMap.merge(services, input)
      )
    const map = MutableHashMap.empty<Key, Entry<A, E>>()
    self.state = { _tag: "Open", map }
    self.capacity = options.capacity
    self.timeToLive = options.timeToLive
      ? (exit: Exit.Exit<A, E>, key: Key) => Duration.decode(options.timeToLive!(exit, key))
      : defaultTimeToLive
    return effect.as(
      Scope.addFinalizer(
        scope,
        core.withFiber((fiber) => {
          self.state = { _tag: "Closed" }
          return invalidateAllImpl(fiber, map)
        })
      ),
      self
    )
  })

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make = <
  Key,
  A,
  E = never,
  R = never,
  ServiceMode extends "lookup" | "construction" = never
>(
  options: {
    readonly lookup: (key: Key) => Effect.Effect<A, E, R | Scope.Scope>
    readonly capacity: number
    readonly timeToLive?: Duration.DurationInput | undefined
    readonly requireServicesAt?: ServiceMode | undefined
  }
): Effect.Effect<
  ScopedCache<Key, A, E, "lookup" extends ServiceMode ? Exclude<R, Scope.Scope> : never>,
  never,
  ("lookup" extends ServiceMode ? never : R) | Scope.Scope
> =>
  makeWith<Key, A, E, R, ServiceMode>({
    ...options,
    timeToLive: options.timeToLive ? () => options.timeToLive! : defaultTimeToLive
  })

const Proto = {
  ...PipeInspectableProto,
  [TypeId]: TypeId,
  toJSON(this: ScopedCache<any, any, any>) {
    return {
      _id: "ScopedCache",
      capacity: this.capacity,
      state: this.state
    }
  }
}

const defaultTimeToLive = <A, E>(_: Exit.Exit<A, E>, _key: unknown): Duration.Duration => Duration.infinity

/**
 * @since 4.0.0
 * @category Combinators
 */
export const get: {
  <Key, A>(key: Key): <E, R>(self: ScopedCache<Key, A, E, R>) => Effect.Effect<A, E, R>
  <Key, A, E, R>(self: ScopedCache<Key, A, E, R>, key: Key): Effect.Effect<A, E, R>
} = dual(
  2,
  <Key, A, E, R>(self: ScopedCache<Key, A, E, R>, key: Key): Effect.Effect<A, E, R> =>
    effect.uninterruptibleMask((restore) =>
      core.withFiber((fiber) => {
        const state = self.state
        if (state._tag === "Closed") {
          return effect.interrupt
        }
        const oentry = MutableHashMap.get(state.map, key)
        if (Option.isSome(oentry) && !hasExpired(oentry.value, fiber)) {
          // Move the entry to the end of the map to keep it fresh
          MutableHashMap.remove(state.map, key)
          MutableHashMap.set(state.map, key, oentry.value)
          return restore(Deferred.await(oentry.value.deferred))
        }
        const scope = Scope.unsafeMake()
        const deferred = Deferred.unsafeMake<A, E>()
        const entry: Entry<A, E> = {
          expiresAt: undefined,
          deferred,
          scope
        }
        MutableHashMap.set(state.map, key, entry)
        return checkCapacity(fiber, state.map, self.capacity).pipe(
          Option.isSome(oentry) ? effect.flatMap(() => oentry.value.scope.close(effect.exitVoid)) : identity,
          effect.flatMap(() => Scope.provide(restore(self.lookup(key)), scope)),
          effect.onExit((exit) => {
            Deferred.unsafeDone(deferred, exit)
            const ttl = self.timeToLive(exit, key)
            if (Duration.isFinite(ttl)) {
              entry.expiresAt = fiber.getRef(effect.ClockRef).unsafeCurrentTimeMillis() + Duration.toMillis(ttl)
            }
            return effect.void
          })
        )
      })
    )
)

const hasExpired = <A, E>(entry: Entry<A, E>, fiber: Fiber.Fiber<unknown, unknown>): boolean => {
  if (entry.expiresAt === undefined) {
    return false
  }
  return fiber.getRef(effect.ClockRef).unsafeCurrentTimeMillis() >= entry.expiresAt
}

const checkCapacity = <K, A, E>(
  parent: Fiber.Fiber<unknown, unknown>,
  map: MutableHashMap.MutableHashMap<K, Entry<A, E>>,
  capacity: number
): Effect.Effect<void> => {
  let diff = MutableHashMap.size(map) - capacity
  if (diff <= 0) return effect.void
  // MutableHashMap has insertion order, so we can remove the oldest entries
  const fibers = Arr.empty<Fiber.Fiber<unknown, unknown>>()
  for (const [key, entry] of map) {
    MutableHashMap.remove(map, key)
    fibers.push(effect.unsafeFork(parent as any, entry.scope.close(effect.exitVoid), true))
    diff--
    if (diff === 0) break
  }
  return effect.fiberAwaitAll(fibers)
}

/**
 * @since 4.0.0
 * @category Combinators
 */
export const getOption: {
  <Key, A>(key: Key): <E, R>(self: ScopedCache<Key, A, E, R>) => Effect.Effect<Option.Option<A>, E>
  <Key, A, E, R>(self: ScopedCache<Key, A, E, R>, key: Key): Effect.Effect<Option.Option<A>, E>
} = dual(
  2,
  <Key, A, E, R>(self: ScopedCache<Key, A, E, R>, key: Key): Effect.Effect<Option.Option<A>, E> =>
    effect.uninterruptibleMask((restore) =>
      core.withFiber((fiber) =>
        effect.flatMap(
          getOptionImpl(self, key, fiber),
          (oentry) =>
            Option.isSome(oentry) ? effect.asSome(restore(Deferred.await(oentry.value.deferred))) : effect.succeedNone
        )
      )
    )
)

const getOptionImpl = <Key, A, E, R>(
  self: ScopedCache<Key, A, E, R>,
  key: Key,
  fiber: Fiber.Fiber<any, any>,
  isRead = true
): Effect.Effect<Option.Option<Entry<A, E>>> => {
  if (self.state._tag === "Closed") {
    return effect.interrupt
  }
  const state = self.state
  const oentry = MutableHashMap.get(state.map, key)
  if (Option.isNone(oentry)) {
    return effect.succeedNone
  } else if (hasExpired(oentry.value, fiber)) {
    MutableHashMap.remove(state.map, key)
    return effect.as(
      oentry.value.scope.close(effect.exitVoid),
      Option.none()
    )
  } else if (isRead) {
    MutableHashMap.remove(state.map, key)
    MutableHashMap.set(state.map, key, oentry.value)
  }
  return effect.succeedSome(oentry.value)
}

/**
 * Retrieves the value associated with the specified key from the cache, only if
 * it contains a resolved successful value.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const getSuccess: {
  <Key, A, R>(key: Key): <E>(self: ScopedCache<Key, A, E, R>) => Effect.Effect<Option.Option<A>>
  <Key, A, E, R>(self: ScopedCache<Key, A, E, R>, key: Key): Effect.Effect<Option.Option<A>>
} = dual(
  2,
  <Key, A, E, R>(self: ScopedCache<Key, A, E, R>, key: Key): Effect.Effect<Option.Option<A>> =>
    effect.uninterruptible(
      core.withFiber((fiber) =>
        effect.map(
          getOptionImpl(self, key, fiber),
          (o) =>
            o.pipe(
              Option.flatMapNullishOr((entry) => entry.deferred.effect as Exit.Exit<A, E>),
              Option.flatMap((exit) => effect.exitIsSuccess(exit) ? Option.some(exit.value) : Option.none())
            )
        )
      )
    )
)

/**
 * Sets the value associated with the specified key in the cache. This will
 * overwrite any existing value for that key, skipping the lookup function.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const set: {
  <Key, A>(key: Key, value: A): <E, R>(self: ScopedCache<Key, A, E, R>) => Effect.Effect<void>
  <Key, A, E, R>(self: ScopedCache<Key, A, E, R>, key: Key, value: A): Effect.Effect<void>
} = dual(
  3,
  <Key, A, E, R>(self: ScopedCache<Key, A, E, R>, key: Key, value: A): Effect.Effect<void> =>
    effect.uninterruptible(
      core.withFiber((fiber) => {
        if (self.state._tag === "Closed") {
          return effect.interrupt
        }
        const oentry = MutableHashMap.get(self.state.map, key)
        const state = self.state
        const exit = core.exitSucceed(value)
        const deferred = Deferred.unsafeMake<A, E>()
        Deferred.unsafeDone(deferred, exit)
        const ttl = self.timeToLive(exit, key)
        MutableHashMap.set(state.map, key, {
          scope: Scope.unsafeMake(),
          deferred,
          expiresAt: Duration.isFinite(ttl)
            ? fiber.getRef(effect.ClockRef).unsafeCurrentTimeMillis() + Duration.toMillis(ttl)
            : undefined
        })
        const check = checkCapacity(fiber, state.map, self.capacity)
        return Option.isSome(oentry) ? effect.flatMap(oentry.value.scope.close(effect.exitVoid), () => check) : check
      })
    )
)

/**
 * Checks if the cache contains an entry for the specified key.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const has: {
  <Key, A>(key: Key): <E, R>(self: ScopedCache<Key, A, E, R>) => Effect.Effect<boolean>
  <Key, A, E, R>(self: ScopedCache<Key, A, E, R>, key: Key): Effect.Effect<boolean>
} = dual(
  2,
  <Key, A, E>(self: ScopedCache<Key, A, E>, key: Key): Effect.Effect<boolean> =>
    effect.uninterruptible(
      core.withFiber((fiber) => effect.map(getOptionImpl(self, key, fiber, false), Option.isSome))
    )
)

/**
 * Invalidates the entry associated with the specified key in the cache.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const invalidate: {
  <Key, A>(key: Key): <E, R>(self: ScopedCache<Key, A, E, R>) => Effect.Effect<void>
  <Key, A, E, R>(self: ScopedCache<Key, A, E, R>, key: Key): Effect.Effect<void>
} = dual(2, <Key, A, E, R>(self: ScopedCache<Key, A, E, R>, key: Key): Effect.Effect<void> =>
  effect.uninterruptible(
    effect.suspend(() => {
      if (self.state._tag === "Closed") {
        return effect.interrupt
      }
      const oentry = MutableHashMap.get(self.state.map, key)
      if (Option.isNone(oentry)) {
        return effect.void
      }
      MutableHashMap.remove(self.state.map, key)
      return oentry.value.scope.close(effect.exitVoid)
    })
  ))

/**
 * Conditionally invalidates the entry associated with the specified key in the cache
 * if the predicate returns true for the cached value.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const invalidateWhen: {
  <Key, A>(key: Key, f: Predicate<A>): <E, R>(self: ScopedCache<Key, A, E, R>) => Effect.Effect<boolean>
  <Key, A, E, R>(self: ScopedCache<Key, A, E, R>, key: Key, f: Predicate<A>): Effect.Effect<boolean>
} = dual(
  3,
  <Key, A, E, R>(self: ScopedCache<Key, A, E, R>, key: Key, f: Predicate<A>): Effect.Effect<boolean> =>
    effect.uninterruptibleMask((restore) =>
      core.withFiber((fiber) =>
        effect.flatMap(getOptionImpl(self, key, fiber, false), (oentry) => {
          if (Option.isNone(oentry)) {
            return effect.succeed(false)
          }
          return restore(Deferred.await(oentry.value.deferred)).pipe(
            effect.flatMap((value) => {
              if (self.state._tag === "Closed") {
                return effect.succeed(false)
              } else if (f(value)) {
                MutableHashMap.remove(self.state.map, key)
                return effect.as(oentry.value.scope.close(effect.exitVoid), true)
              }
              return effect.succeed(false)
            }),
            effect.catch_(() => effect.succeed(false))
          )
        })
      )
    )
)

/**
 * Forces a refresh of the value associated with the specified key in the cache.
 *
 * It will always invoke the lookup function to construct a new value,
 * overwriting any existing value for that key.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const refresh: {
  <Key, A>(key: Key): <E, R>(self: ScopedCache<Key, A, E, R>) => Effect.Effect<A, E, R>
  <Key, A, E, R>(self: ScopedCache<Key, A, E, R>, key: Key): Effect.Effect<A, E, R>
} = dual(
  2,
  <Key, A, E, R>(self: ScopedCache<Key, A, E, R>, key: Key): Effect.Effect<A, E, R> =>
    effect.uninterruptibleMask(effect.fnUntraced(function*(restore) {
      if (self.state._tag === "Closed") return yield* effect.interrupt
      const fiber = Fiber.getCurrent()!
      const scope = Scope.unsafeMake()
      const deferred = Deferred.unsafeMake<A, E>()
      const entry: Entry<A, E> = {
        scope,
        expiresAt: undefined,
        deferred
      }
      const newEntry = !MutableHashMap.has(self.state.map, key)
      if (newEntry) {
        MutableHashMap.set(self.state.map, key, entry)
        yield* checkCapacity(fiber, self.state.map, self.capacity)
      }
      const exit = yield* effect.exit(restore(Scope.provide(self.lookup(key), scope)))
      Deferred.unsafeDone(deferred, exit)
      // @ts-ignore async gap
      if (self.state._tag === "Closed") {
        if (!newEntry) {
          yield* scope.close(effect.exitVoid)
        }
        return yield* effect.interrupt
      }
      const ttl = self.timeToLive(exit, key)
      entry.expiresAt = Duration.isFinite(ttl)
        ? fiber.getRef(effect.ClockRef).unsafeCurrentTimeMillis() + Duration.toMillis(ttl)
        : undefined
      if (!newEntry) {
        const oentry = MutableHashMap.get(self.state.map, key)
        MutableHashMap.set(self.state.map, key, entry)
        if (Option.isSome(oentry)) {
          yield* oentry.value.scope.close(effect.exitVoid)
        }
      }
      return yield* exit
    }))
)

/**
 * Invalidates all entries in the cache.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const invalidateAll = <Key, A, E, R>(self: ScopedCache<Key, A, E, R>): Effect.Effect<void> =>
  core.withFiber((parent) => {
    if (self.state._tag === "Closed") {
      return effect.interrupt
    }
    return invalidateAllImpl(parent, self.state.map)
  })

const invalidateAllImpl = <Key, A, E>(
  parent: Fiber.Fiber<unknown, unknown>,
  map: MutableHashMap.MutableHashMap<Key, Entry<A, E>>
): Effect.Effect<void> => {
  const fibers = Arr.empty<Fiber.Fiber<unknown, unknown>>()
  for (const [, entry] of map) {
    fibers.push(effect.unsafeFork(parent as any, entry.scope.close(effect.exitVoid), true, true))
  }
  MutableHashMap.clear(map)
  return effect.fiberAwaitAll(fibers)
}

/**
 * Retrieves the approximate number of entries in the cache.
 *
 * Note that expired entries are counted until they are accessed and removed.
 * The size reflects the current number of entries stored, not the number
 * of valid entries.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const size = <Key, A, E, R>(self: ScopedCache<Key, A, E, R>): Effect.Effect<number> =>
  effect.sync(() => self.state._tag === "Closed" ? 0 : MutableHashMap.size(self.state.map))

/**
 * Retrieves all active keys from the cache, automatically filtering out expired entries.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const keys = <Key, A, E, R>(self: ScopedCache<Key, A, E, R>): Effect.Effect<Array<Key>> =>
  core.withFiber((fiber) => {
    if (self.state._tag === "Closed") return effect.succeed([])
    const state = self.state
    const now = fiber.getRef(effect.ClockRef).unsafeCurrentTimeMillis()
    const fibers = Arr.empty<Fiber.Fiber<unknown, unknown>>()
    const keys = Arr.filterMap(state.map, ([key, entry]) => {
      if (entry.expiresAt === undefined || entry.expiresAt > now) {
        return Option.some(key)
      }
      MutableHashMap.remove(state.map, key)
      fibers.push(effect.unsafeFork(fiber, entry.scope.close(effect.exitVoid), true, true))
      return Option.none()
    })
    return fibers.length === 0 ? effect.succeed(keys) : effect.as(effect.fiberAwaitAll(fibers), keys)
  })

/**
 * Retrieves all successfully cached values from the cache, excluding failed
 * lookups and expired entries.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const values = <Key, A, E, R>(self: ScopedCache<Key, A, E, R>): Effect.Effect<Array<A>> =>
  effect.map(entries(self), Arr.map(([, value]) => value))

/**
 * Retrieves all key-value pairs from the cache as an iterable. This function
 * only returns entries with successfully resolved values, filtering out any
 * failed lookups or expired entries.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const entries = <Key, A, E, R>(self: ScopedCache<Key, A, E, R>): Effect.Effect<Array<[Key, A]>> =>
  core.withFiber((fiber) => {
    if (self.state._tag === "Closed") return effect.succeed([])
    const state = self.state
    const now = fiber.getRef(effect.ClockRef).unsafeCurrentTimeMillis()
    const fibers = Arr.empty<Fiber.Fiber<unknown, unknown>>()
    const arr = Arr.filterMap(state.map, ([key, entry]) => {
      if (entry.expiresAt === undefined || entry.expiresAt > now) {
        const exit = entry.deferred.effect
        return !core.isExit(exit) || effect.exitIsFailure(exit)
          ? Option.none()
          : Option.some([key, exit.value as A] as [Key, A])
      }
      MutableHashMap.remove(state.map, key)
      fibers.push(effect.unsafeFork(fiber, entry.scope.close(effect.exitVoid), true, true))
      return Option.none()
    })
    return fibers.length === 0
      ? effect.succeed(arr)
      : effect.as(effect.fiberAwaitAll(fibers), arr)
  })
