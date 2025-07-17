/**
 * @since 4.0.0
 */
import { Clock } from "../Clock.js"
import * as Deferred from "../Deferred.js"
import * as Duration from "../Duration.js"
import * as Effect from "../Effect.js"
import * as Exit from "../Exit.js"
import { dual } from "../Function.js"
import type { Fiber } from "../index.js"
import { PipeInspectableProto } from "../internal/core.js"
import * as Iterable from "../Iterable.js"
import * as MutableHashMap from "../MutableHashMap.js"
import * as Option from "../Option.js"
import type { Pipeable } from "../Pipeable.js"
import type { Predicate } from "../Predicate.js"
import * as ServiceMap from "../ServiceMap.js"

/**
 * @since 4.0.0
 * @category Type Identifiers
 */
export const TypeId: TypeId = "~effect/caching/Cache"

/**
 * @since 4.0.0
 * @category Type Identifiers
 */
export type TypeId = "~effect/caching/Cache"

/**
 * @since 4.0.0
 * @category Models
 */
export interface Cache<in out Key, in out A, in out E> extends Pipeable {
  readonly [TypeId]: TypeId
  readonly map: MutableHashMap.MutableHashMap<Key, Entry<A, E>>
  readonly capacity: number
  readonly lookup: (key: Key) => Effect.Effect<A, E>
  readonly timeToLive: (exit: Exit.Exit<A, E>, key: Key) => Duration.Duration
}

/**
 * @since 4.0.0
 * @category Models
 */
export interface Entry<A, E> {
  expiresAt: number | undefined
  readonly deferred: Deferred.Deferred<A, E>
}

/**
 * @since 4.0.0
 * @category Constructors
 */
export const makeWithTtl = <Key, A, E = never, R = never>(options: {
  readonly lookup: (key: Key) => Effect.Effect<A, E, R>
  readonly capacity: number
  readonly timeToLive?: ((exit: Exit.Exit<A, E>, key: Key) => Duration.DurationInput) | undefined
}): Effect.Effect<Cache<Key, A, E>, never, R> =>
  Effect.servicesWith((services: ServiceMap.ServiceMap<R>) => {
    const self = Object.create(Proto)
    self.lookup = (key: Key): Effect.Effect<A, E> =>
      Effect.updateServices(
        options.lookup(key),
        (input) => ServiceMap.merge(services, input)
      )
    self.map = MutableHashMap.make()
    self.capacity = options.capacity
    self.timeToLive = options.timeToLive
      ? (exit: Exit.Exit<A, E>, key: Key) => Duration.decode(options.timeToLive!(exit, key))
      : defaultTimeToLive
    return Effect.succeed(self as Cache<Key, A, E>)
  })

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make = <Key, A, E = never, R = never>(options: {
  readonly lookup: (key: Key) => Effect.Effect<A, E, R>
  readonly capacity: number
  readonly timeToLive?: Duration.DurationInput | undefined
}): Effect.Effect<Cache<Key, A, E>, never, R> =>
  makeWithTtl<Key, A, E, R>({
    ...options,
    timeToLive: options.timeToLive ? () => options.timeToLive! : defaultTimeToLive
  })

const Proto = {
  ...PipeInspectableProto,
  [TypeId]: TypeId,
  toJSON(this: Cache<any, any, any>) {
    return {
      _id: "Cache",
      capacity: this.capacity,
      map: this.map
    }
  }
}

const defaultTimeToLive = <A, E>(_: Exit.Exit<A, E>, _key: unknown): Duration.Duration => Duration.infinity

/**
 * Retrieves the value associated with the specified key from the cache.
 *
 * If the key is not present or has expired, it will invoke the lookup function
 * to construct the value, store it in the cache, and return it.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const get: {
  <Key, A>(key: Key): <E>(self: Cache<Key, A, E>) => Effect.Effect<A, E>
  <Key, A, E>(self: Cache<Key, A, E>, key: Key): Effect.Effect<A, E>
} = dual(
  2,
  <Key, A, E>(self: Cache<Key, A, E>, key: Key): Effect.Effect<A, E> =>
    Effect.withFiber((fiber) => {
      const oentry = MutableHashMap.get(self.map, key)
      if (Option.isSome(oentry) && !hasExpired(oentry.value, fiber)) {
        // Move the entry to the end of the map to keep it fresh
        MutableHashMap.remove(self.map, key)
        MutableHashMap.set(self.map, key, oentry.value)
        return Deferred.await(oentry.value.deferred)
      }
      const deferred = Deferred.unsafeMake<A, E>()
      const entry: Entry<A, E> = {
        expiresAt: undefined,
        deferred
      }
      MutableHashMap.set(self.map, key, entry)
      checkCapacity(self)
      return Effect.onExit(self.lookup(key), (exit) => {
        Deferred.unsafeDone(deferred, exit)
        const ttl = self.timeToLive(exit, key)
        if (Duration.isFinite(ttl)) {
          entry.expiresAt = fiber.getRef(Clock).unsafeCurrentTimeMillis() + Duration.toMillis(ttl)
        } else if (Duration.isZero(ttl)) {
          MutableHashMap.remove(self.map, key)
        }
        return Effect.void
      })
    })
)

const hasExpired = <A, E>(entry: Entry<A, E>, fiber: Fiber.Fiber<unknown, unknown>): boolean => {
  if (entry.expiresAt === undefined) {
    return false
  }
  return fiber.getRef(Clock).unsafeCurrentTimeMillis() >= entry.expiresAt
}

const checkCapacity = <K, A, E>(self: Cache<K, A, E>) => {
  let diff = MutableHashMap.size(self.map) - self.capacity
  if (diff <= 0) return
  // MutableHashMap has insertion order, so we can remove the oldest entries
  for (const [key] of self.map) {
    MutableHashMap.remove(self.map, key)
    diff--
    if (diff === 0) return
  }
}

/**
 * Retrieves the value associated with the specified key from the cache,
 * returning an `Option` that is `Some` if the key exists and has not expired,
 * or `None` if the key does not exist or has expired.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const getOption: {
  <Key, A>(key: Key): <E>(self: Cache<Key, A, E>) => Effect.Effect<Option.Option<A>, E>
  <Key, A, E>(self: Cache<Key, A, E>, key: Key): Effect.Effect<Option.Option<A>, E>
} = dual(
  2,
  <Key, A, E>(self: Cache<Key, A, E>, key: Key): Effect.Effect<Option.Option<A>, E> =>
    Effect.withFiber((fiber) => {
      const oentry = getOptionImpl(self, key, fiber)
      return Option.isSome(oentry) ? Effect.asSome(Deferred.await(oentry.value.deferred)) : Effect.succeedNone
    })
)

const getOptionImpl = <Key, A, E>(
  self: Cache<Key, A, E>,
  key: Key,
  fiber: Fiber.Fiber<any, any>,
  isRead = true
): Option.Option<Entry<A, E>> => {
  const oentry = MutableHashMap.get(self.map, key)
  if (Option.isNone(oentry)) {
    return oentry
  } else if (hasExpired(oentry.value, fiber)) {
    MutableHashMap.remove(self.map, key)
    return Option.none()
  } else if (isRead) {
    MutableHashMap.remove(self.map, key)
    MutableHashMap.set(self.map, key, oentry.value)
  }
  return Option.some(oentry.value)
}

/**
 * Retrieves the value associated with the specified key from the cache, only if
 * it contains a resolved successful value.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const getSuccess: {
  <Key, A>(key: Key): <E>(self: Cache<Key, A, E>) => Effect.Effect<Option.Option<A>>
  <Key, A, E>(self: Cache<Key, A, E>, key: Key): Effect.Effect<Option.Option<A>>
} = dual(
  2,
  <Key, A, E>(self: Cache<Key, A, E>, key: Key): Effect.Effect<Option.Option<A>> =>
    Effect.withFiber((fiber) =>
      Effect.succeed(
        getOptionImpl(self, key, fiber).pipe(
          Option.flatMapNullable((entry) => entry.deferred.effect as Exit.Exit<A, E>),
          Option.flatMap((exit) => Exit.isSuccess(exit) ? Option.some(exit.value) : Option.none())
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
  <Key, A>(key: Key, value: A): <E>(self: Cache<Key, A, E>) => Effect.Effect<void>
  <Key, A, E>(self: Cache<Key, A, E>, key: Key, value: A): Effect.Effect<void>
} = dual(
  3,
  <Key, A, E>(self: Cache<Key, A, E>, key: Key, value: A): Effect.Effect<void> =>
    Effect.withFiber((fiber) => {
      const exit = Exit.succeed(value)
      const deferred = Deferred.unsafeMake<A, E>()
      Deferred.unsafeDone(deferred, exit)
      const ttl = self.timeToLive(exit, key)
      if (Duration.isZero(ttl)) {
        MutableHashMap.remove(self.map, key)
        return Effect.void
      }
      MutableHashMap.set(self.map, key, {
        deferred,
        expiresAt: Duration.isFinite(ttl)
          ? fiber.getRef(Clock).unsafeCurrentTimeMillis() + Duration.toMillis(ttl)
          : undefined
      })
      checkCapacity(self)
      return Effect.void
    })
)

/**
 * Checks if the cache contains an entry for the specified key.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const has: {
  <Key, A>(key: Key): <E>(self: Cache<Key, A, E>) => Effect.Effect<boolean>
  <Key, A, E>(self: Cache<Key, A, E>, key: Key): Effect.Effect<boolean>
} = dual(
  2,
  <Key, A, E>(self: Cache<Key, A, E>, key: Key): Effect.Effect<boolean> =>
    Effect.withFiber((fiber) => {
      const oentry = getOptionImpl(self, key, fiber, false)
      return Effect.succeed(Option.isSome(oentry))
    })
)

/**
 * Invalidates the entry associated with the specified key in the cache.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const invalidate: {
  <Key, A>(key: Key): <E>(self: Cache<Key, A, E>) => Effect.Effect<void>
  <Key, A, E>(self: Cache<Key, A, E>, key: Key): Effect.Effect<void>
} = dual(2, <Key, A, E>(self: Cache<Key, A, E>, key: Key): Effect.Effect<void> =>
  Effect.sync(() => {
    MutableHashMap.remove(self.map, key)
  }))

/**
 * @since 4.0.0
 * @category Combinators
 */
export const invalidateWhen: {
  <Key, A>(key: Key, f: Predicate<A>): <E>(self: Cache<Key, A, E>) => Effect.Effect<boolean>
  <Key, A, E>(self: Cache<Key, A, E>, key: Key, f: Predicate<A>): Effect.Effect<boolean>
} = dual(
  3,
  <Key, A, E>(self: Cache<Key, A, E>, key: Key, f: Predicate<A>): Effect.Effect<boolean> =>
    Effect.withFiber((fiber) => {
      const oentry = getOptionImpl(self, key, fiber, false)
      if (Option.isNone(oentry)) {
        return Effect.succeed(false)
      }
      return Deferred.await(oentry.value.deferred).pipe(
        Effect.map((value) => {
          if (f(value)) {
            MutableHashMap.remove(self.map, key)
            return true
          }
          return false
        }),
        Effect.catchCause(() => Effect.succeed(false))
      )
    })
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
  <Key, A>(key: Key): <E>(self: Cache<Key, A, E>) => Effect.Effect<A, E>
  <Key, A, E>(self: Cache<Key, A, E>, key: Key): Effect.Effect<A, E>
} = dual(
  2,
  <Key, A, E>(self: Cache<Key, A, E>, key: Key): Effect.Effect<A, E> =>
    Effect.withFiber((fiber) => {
      const deferred = Deferred.unsafeMake<A, E>()
      const entry: Entry<A, E> = {
        expiresAt: undefined,
        deferred
      }
      const existing = Option.isSome(getOptionImpl(self, key, fiber, false))
      if (!existing) {
        MutableHashMap.set(self.map, key, entry)
        checkCapacity(self)
      }
      return Effect.onExit(self.lookup(key), (exit) => {
        Deferred.unsafeDone(deferred, exit)
        const ttl = self.timeToLive(exit, key)
        if (Duration.isZero(ttl)) {
          MutableHashMap.remove(self.map, key)
          return Effect.void
        }
        entry.expiresAt = Duration.isFinite(ttl)
          ? fiber.getRef(Clock).unsafeCurrentTimeMillis() + Duration.toMillis(ttl)
          : undefined
        if (existing) {
          MutableHashMap.set(self.map, key, entry)
        }
        return Effect.void
      })
    })
)

/**
 * Invalidates all entries in the cache.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const invalidateAll = <Key, A, E>(self: Cache<Key, A, E>): Effect.Effect<void> =>
  Effect.sync(() => {
    MutableHashMap.clear(self.map)
  })

/**
 * Retrieves the approximate number of entries in the cache.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const size = <Key, A, E>(self: Cache<Key, A, E>): Effect.Effect<number> =>
  Effect.sync(() => MutableHashMap.size(self.map))

/**
 * @since 4.0.0
 * @category Combinators
 */
export const keys = <Key, A, E>(self: Cache<Key, A, E>): Effect.Effect<Iterable<Key>> =>
  Effect.withFiber((fiber) => {
    const now = fiber.getRef(Clock).unsafeCurrentTimeMillis()
    return Effect.succeed(Iterable.filterMap(self.map, ([key, entry]) => {
      if (entry.expiresAt === undefined || entry.expiresAt > now) {
        return Option.some(key)
      }
      MutableHashMap.remove(self.map, key)
      return Option.none()
    }))
  })

/**
 * @since 4.0.0
 * @category Combinators
 */
export const values = <Key, A, E>(self: Cache<Key, A, E>): Effect.Effect<Iterable<A>> =>
  Effect.map(entries(self), Iterable.map(([, value]) => value))

/**
 * @since 4.0.0
 * @category Combinators
 */
export const entries = <Key, A, E>(self: Cache<Key, A, E>): Effect.Effect<Iterable<[Key, A]>> =>
  Effect.withFiber((fiber) => {
    const now = fiber.getRef(Clock).unsafeCurrentTimeMillis()
    return Effect.succeed(Iterable.filterMap(self.map, ([key, entry]) => {
      if (entry.expiresAt === undefined || entry.expiresAt > now) {
        const exit = entry.deferred.effect
        return !Exit.isExit(exit) || Exit.isFailure(exit)
          ? Option.none()
          : Option.some([key, exit.value as A])
      }
      MutableHashMap.remove(self.map, key)
      return Option.none()
    }))
  })
