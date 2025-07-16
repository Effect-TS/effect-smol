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
import * as MutableHashMap from "../MutableHashMap.js"
import * as Option from "../Option.js"
import type { Pipeable } from "../Pipeable.js"
import type * as ServiceMap from "../ServiceMap.js"

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
  readonly capacity: number | undefined
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
export const makeOptions = <Key, A, E, R>(options: {
  readonly lookup: (key: Key) => Effect.Effect<A, E, R>
  readonly capacity?: number | undefined
  readonly timeToLive?: ((exit: Exit.Exit<A, E>, key: Key) => Duration.DurationInput) | undefined
}): Effect.Effect<Cache<Key, A, E>, never, R> =>
  Effect.servicesWith((services: ServiceMap.ServiceMap<R>) => {
    const self = Object.create(Proto)
    self.lookup = (key: Key): Effect.Effect<A, E> => Effect.provideServices(options.lookup(key), services)
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
export const make = <Key, A, E, R>(options: {
  readonly lookup: (key: Key) => Effect.Effect<A, E, R>
  readonly capacity?: number | undefined
  readonly timeToLive?: Duration.DurationInput | undefined
}): Effect.Effect<Cache<Key, A, E>, never, R> =>
  makeOptions<Key, A, E, R>({
    ...options,
    timeToLive: options.timeToLive ? () => options.timeToLive! : defaultTimeToLive
  })

const Proto = {
  ...PipeInspectableProto,
  [TypeId]: TypeId,
  toJSON(this: Cache<any, any, any>) {
    return {
      _id: "Cache",
      map: this.map
    }
  }
}

const defaultTimeToLive = <A, E>(_: Exit.Exit<A, E>, _key: unknown): Duration.Duration => Duration.infinity

/**
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
        if (!Duration.isFinite(ttl)) {
          return Effect.void
        }
        entry.expiresAt = fiber.getRef(Clock).unsafeCurrentTimeMillis() + Duration.toMillis(ttl)
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
  if (self.capacity === undefined) return
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
      const oentry = MutableHashMap.get(self.map, key)
      if (Option.isNone(oentry)) {
        return Effect.succeedNone
      } else if (hasExpired(oentry.value, fiber)) {
        MutableHashMap.remove(self.map, key)
        return Effect.succeedNone
      }
      return Effect.asSome(Deferred.await(oentry.value.deferred))
    })
)

/**
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
      MutableHashMap.set(self.map, key, {
        deferred,
        expiresAt: Duration.isFinite(ttl)
          ? fiber.getRef(Clock).unsafeCurrentTimeMillis() + Duration.toMillis(ttl)
          : undefined
      })
      return Effect.void
    })
)

/**
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
      const oentry = MutableHashMap.get(self.map, key)
      if (Option.isNone(oentry)) {
        return Effect.succeed(false)
      } else if (hasExpired(oentry.value, fiber)) {
        MutableHashMap.remove(self.map, key)
        return Effect.succeed(false)
      }
      return Effect.succeed(true)
    })
)
