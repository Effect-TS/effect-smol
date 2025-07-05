/**
 * @since 3.5.0
 */
import * as Cause from "./Cause.js"
import * as Deferred from "./Deferred.js"
import * as Duration from "./Duration.js"
import * as Effect from "./Effect.js"
import * as Exit from "./Exit.js"
import * as Fiber from "./Fiber.js"
import { dual } from "./Function.js"
import * as MutableHashMap from "./MutableHashMap.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"
import * as Scope from "./Scope.js"
import * as ServiceMap from "./ServiceMap.js"

/**
 * The unique identifier for the RcMap type.
 *
 * @since 3.5.0
 * @category type ids
 * @example
 * ```ts
 * import { RcMap } from "effect"
 *
 * // TypeId is used internally for type identification
 * console.log(RcMap.TypeId) // "~effect/RcMap"
 *
 * // Check if an object is an RcMap
 * declare const value: unknown
 * const isRcMap = typeof value === "object" &&
 *   value !== null &&
 *   RcMap.TypeId in value
 * ```
 */
export const TypeId: TypeId = "~effect/RcMap"

/**
 * The type representing the unique identifier for RcMap.
 *
 * @since 3.5.0
 * @category type ids
 * @example
 * ```ts
 * import { RcMap } from "effect"
 *
 * // TypeId type represents the literal string identifier
 * type Id = RcMap.TypeId // "~effect/RcMap"
 *
 * // Used in type-level operations and pattern matching
 * declare const id: RcMap.TypeId
 * if (id === "~effect/RcMap") {
 *   console.log("This is an RcMap type identifier")
 * }
 * ```
 */
export type TypeId = "~effect/RcMap"

/**
 * An `RcMap` is a reference-counted map data structure that manages the lifecycle
 * of resources indexed by keys. Resources are lazily acquired and automatically
 * released when no longer in use.
 *
 * @since 3.5.0
 * @category models
 * @example
 * ```ts
 * import { Effect, RcMap } from "effect"
 *
 * Effect.gen(function*() {
 *   // Create an RcMap that manages database connections
 *   const dbConnectionMap = yield* RcMap.make({
 *     lookup: (dbName: string) =>
 *       Effect.acquireRelease(
 *         Effect.succeed(`Connection to ${dbName}`),
 *         (conn) => Effect.log(`Closing ${conn}`)
 *       ),
 *     capacity: 10,
 *     idleTimeToLive: "5 minutes"
 *   })
 *
 *   // The RcMap interface provides access to:
 *   // - lookup: Function to acquire resources
 *   // - capacity: Maximum number of resources
 *   // - idleTimeToLive: Time before idle resources are released
 *   // - semaphore: Concurrency control
 *   // - state: Current state of the map
 *
 *   console.log(`Capacity: ${dbConnectionMap.capacity}`)
 * }).pipe(Effect.scoped)
 * ```
 */
export interface RcMap<in out K, in out A, in out E = never> extends Pipeable {
  readonly [TypeId]: TypeId
  readonly lookup: (key: K) => Effect.Effect<A, E, Scope.Scope>
  readonly services: ServiceMap.ServiceMap<never>
  readonly scope: Scope.Scope
  readonly idleTimeToLive: Duration.Duration | undefined
  readonly capacity: number
  readonly semaphore: Effect.Semaphore
  state: State<K, A, E>
}

/**
 * Represents the internal state of an RcMap, which can be either Open (active)
 * or Closed (shutdown and no longer accepting operations).
 *
 * @since 4.0.0
 * @category Models
 * @example
 * ```ts
 * import { RcMap } from "effect"
 *
 * // State is a union type that can be either:
 * declare const openState: RcMap.State.Open<string, number, never>
 * declare const closedState: RcMap.State.Closed
 *
 * // Check the state type
 * declare const state: RcMap.State<string, number, never>
 * if (state._tag === "Open") {
 *   // Access the internal map when open
 *   console.log("Map is open, contains entries")
 * } else {
 *   // State is closed
 *   console.log("Map is closed")
 * }
 * ```
 */
export type State<K, A, E> = State.Open<K, A, E> | State.Closed

/**
 * Namespace containing the internal state types for RcMap.
 *
 * @since 4.0.0
 * @category Models
 * @example
 * ```ts
 * import { RcMap } from "effect"
 *
 * // The State namespace contains types for RcMap internal state:
 * // - Open: Contains the active resource map
 * // - Closed: Indicates the map is shut down
 * // - Entry: Individual resource entries with metadata
 *
 * declare const openState: RcMap.State.Open<string, number, never>
 * declare const closedState: RcMap.State.Closed
 * declare const entry: RcMap.State.Entry<number, never>
 * ```
 */
export declare namespace State {
  /**
   * Represents the open/active state of an RcMap, containing the actual
   * resource map that stores entries.
   *
   * @since 4.0.0
   * @category Models
   * @example
   * ```ts
   * import { MutableHashMap, RcMap } from "effect"
   *
   * // State.Open contains the active resource map
   * declare const openState: RcMap.State.Open<string, number, never>
   *
   * // Access the internal map when state is open
   * if (openState._tag === "Open") {
   *   // The map contains Entry objects indexed by keys
   *   const hasKey = MutableHashMap.has(openState.map, "someKey")
   *   console.log(`Map contains key: ${hasKey}`)
   * }
   * ```
   */
  export interface Open<K, A, E> {
    readonly _tag: "Open"
    readonly map: MutableHashMap.MutableHashMap<K, Entry<A, E>>
  }

  /**
   * Represents the closed state of an RcMap, indicating that the map has been
   * shut down and will no longer accept new operations.
   *
   * @since 4.0.0
   * @category Models
   * @example
   * ```ts
   * import { RcMap } from "effect"
   *
   * // State.Closed indicates the RcMap is shut down
   * declare const closedState: RcMap.State.Closed
   *
   * // Check for closed state
   * if (closedState._tag === "Closed") {
   *   console.log("RcMap is closed, no operations allowed")
   *   // Any attempt to get resources will result in interruption
   * }
   * ```
   */
  export interface Closed {
    readonly _tag: "Closed"
  }

  /**
   * Represents an individual entry in the RcMap, containing the resource's
   * metadata including reference count, expiration time, and lifecycle management.
   *
   * @since 4.0.0
   * @category Models
   * @example
   * ```ts
   * import { Deferred, Effect, Fiber, RcMap, Scope } from "effect"
   *
   * // Entry contains all metadata for a resource in the map
   * declare const entry: RcMap.State.Entry<string, never>
   *
   * // Entry properties:
   * // - deferred: Promise-like structure for the resource value
   * // - scope: Manages the resource's lifecycle
   * // - finalizer: Effect to run when cleaning up
   * // - fiber: Optional background fiber for expiration
   * // - expiresAt: Timestamp when resource expires
   * // - refCount: Number of active references
   *
   * console.log(`Reference count: ${entry.refCount}`)
   * console.log(`Expires at: ${entry.expiresAt}`)
   * ```
   */
  export interface Entry<A, E> {
    readonly deferred: Deferred.Deferred<A, E>
    readonly scope: Scope.Scope.Closeable
    readonly finalizer: Effect.Effect<void>
    fiber: Fiber.Fiber<void> | undefined
    expiresAt: number
    refCount: number
  }
}

const unsafeMake = <K, A, E>(options: {
  readonly lookup: (key: K) => Effect.Effect<A, E, Scope.Scope>
  readonly services: ServiceMap.ServiceMap<never>
  readonly scope: Scope.Scope
  readonly idleTimeToLive: Duration.Duration | undefined
  readonly capacity: number
}): RcMap<K, A, E> => ({
  [TypeId]: TypeId,
  lookup: options.lookup,
  services: options.services,
  scope: options.scope,
  idleTimeToLive: options.idleTimeToLive,
  capacity: options.capacity,
  semaphore: Effect.unsafeMakeSemaphore(1),
  state: {
    _tag: "Open",
    map: MutableHashMap.empty()
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
})

/**
 * An `RcMap` can contain multiple reference counted resources that can be indexed
 * by a key. The resources are lazily acquired on the first call to `get` and
 * released when the last reference is released.
 *
 * Complex keys can extend `Equal` and `Hash` to allow lookups by value.
 *
 * **Options**
 *
 * - `capacity`: The maximum number of resources that can be held in the map.
 * - `idleTimeToLive`: When the reference count reaches zero, the resource will be released after this duration.
 *
 * @since 3.5.0
 * @category models
 * @example
 * ```ts
 * import { Effect, RcMap } from "effect"
 *
 * Effect.gen(function*() {
 *   const map = yield* RcMap.make({
 *     lookup: (key: string) =>
 *       Effect.acquireRelease(
 *         Effect.succeed(`acquired ${key}`),
 *         () => Effect.log(`releasing ${key}`)
 *       )
 *   })
 *
 *   // Get "foo" from the map twice, which will only acquire it once.
 *   // It will then be released once the scope closes.
 *   yield* RcMap.get(map, "foo").pipe(
 *     Effect.andThen(RcMap.get(map, "foo")),
 *     Effect.scoped
 *   )
 * })
 * ```
 */
export const make: {
  <K, A, E, R>(options: {
    readonly lookup: (key: K) => Effect.Effect<A, E, R>
    readonly idleTimeToLive?: Duration.DurationInput | undefined
    readonly capacity?: undefined
  }): Effect.Effect<RcMap<K, A, E>, never, Scope.Scope | R>
  <K, A, E, R>(options: {
    readonly lookup: (key: K) => Effect.Effect<A, E, R>
    readonly idleTimeToLive?: Duration.DurationInput | undefined
    readonly capacity: number
  }): Effect.Effect<RcMap<K, A, E | Cause.ExceededCapacityError>, never, Scope.Scope | R>
} = <K, A, E, R>(options: {
  readonly lookup: (key: K) => Effect.Effect<A, E, R>
  readonly idleTimeToLive?: Duration.DurationInput | undefined
  readonly capacity?: number | undefined
}) =>
  Effect.withFiber<RcMap<K, A, E>, never, R | Scope.Scope>((fiber) => {
    const services = fiber.services as ServiceMap.ServiceMap<R | Scope.Scope>
    const scope = ServiceMap.get(services, Scope.Scope)
    const self = unsafeMake<K, A, E>({
      lookup: options.lookup as any,
      services,
      scope,
      idleTimeToLive: options.idleTimeToLive ? Duration.decode(options.idleTimeToLive) : undefined,
      capacity: Math.max(options.capacity ?? Number.POSITIVE_INFINITY, 0)
    })
    return Effect.as(
      Scope.addFinalizerExit(scope, () => {
        if (self.state._tag === "Closed") {
          return Effect.void
        }
        const map = self.state.map
        self.state = { _tag: "Closed" }
        return Effect.forEach(
          map,
          ([, entry]) => Scope.close(entry.scope, Exit.void)
        ).pipe(
          Effect.tap(() => {
            MutableHashMap.clear(map)
          }),
          self.semaphore.withPermits(1)
        )
      }),
      self
    )
  })

/**
 * Retrieves a value from the RcMap by key. If the resource doesn't exist, it will be
 * acquired using the lookup function. The resource is reference counted and will be
 * released when the scope closes.
 *
 * @since 3.5.0
 * @category combinators
 * @example
 * ```ts
 * import { Effect, RcMap } from "effect"
 *
 * Effect.gen(function*() {
 *   const map = yield* RcMap.make({
 *     lookup: (key: string) =>
 *       Effect.acquireRelease(
 *         Effect.succeed(`Resource: ${key}`),
 *         () => Effect.log(`Released ${key}`)
 *       )
 *   })
 *
 *   // Get a resource - it will be acquired on first access
 *   const resource = yield* RcMap.get(map, "database")
 *   console.log(resource) // "Resource: database"
 * }).pipe(Effect.scoped)
 * ```
 */
export const get: {
  <K>(key: K): <A, E>(self: RcMap<K, A, E>) => Effect.Effect<A, E, Scope.Scope>
  <K, A, E>(self: RcMap<K, A, E>, key: K): Effect.Effect<A, E, Scope.Scope>
} = dual(2, <K, A, E>(self: RcMap<K, A, E>, key: K): Effect.Effect<A, E, Scope.Scope> => {
  return Effect.uninterruptibleMask((restore) => getImpl(self, key, restore as any))
})

const getImpl = Effect.fnUntraced(function*<K, A, E>(self: RcMap<K, A, E>, key: K, restore: <A>(a: A) => A) {
  if (self.state._tag === "Closed") {
    return yield* Effect.interrupt
  }
  const state = self.state
  const o = MutableHashMap.get(state.map, key)
  let entry: State.Entry<A, E>
  if (o._tag === "Some") {
    entry = o.value
    entry.refCount++
  } else if (Number.isFinite(self.capacity) && MutableHashMap.size(self.state.map) >= self.capacity) {
    return yield* Effect.fail(
      new Cause.ExceededCapacityError(`RcMap attempted to exceed capacity of ${self.capacity}`)
    ) as Effect.Effect<never>
  } else {
    entry = yield* self.semaphore.withPermits(1)(acquire(self, key, restore))
  }
  const scope = yield* Scope.Scope
  yield* Scope.addFinalizer(scope, entry.finalizer)
  return yield* restore(Deferred.await(entry.deferred))
})

const acquire = Effect.fnUntraced(function*<K, A, E>(self: RcMap<K, A, E>, key: K, restore: <A>(a: A) => A) {
  const scope = Scope.unsafeMake()
  const deferred = Deferred.unsafeMake<A, E>()
  const acquire = self.lookup(key)
  const servicesMap = new Map(self.services.unsafeMap)
  yield* restore(Effect.updateServices(
    acquire as Effect.Effect<A, E>,
    (inputServices: ServiceMap.ServiceMap<never>) => {
      inputServices.unsafeMap.forEach((value, key) => {
        servicesMap.set(key, value)
      })
      servicesMap.set(Scope.Scope.key, scope)
      return ServiceMap.unsafeMake(servicesMap)
    }
  )).pipe(
    Effect.exit,
    Effect.flatMap((exit) => Deferred.done(deferred, exit)),
    Effect.forkIn(scope)
  )
  const entry: State.Entry<A, E> = {
    deferred,
    scope,
    finalizer: undefined as any,
    fiber: undefined,
    expiresAt: 0,
    refCount: 1
  }
  ;(entry as any).finalizer = release(self, key, entry)
  if (self.state._tag === "Open") {
    MutableHashMap.set(self.state.map, key, entry)
  }
  return entry
})

const release = <K, A, E>(self: RcMap<K, A, E>, key: K, entry: State.Entry<A, E>) =>
  Effect.clockWith((clock) => {
    entry.refCount--
    if (entry.refCount > 0) {
      return Effect.void
    } else if (
      self.state._tag === "Closed"
      || !MutableHashMap.has(self.state.map, key)
      || self.idleTimeToLive === undefined
    ) {
      if (self.state._tag === "Open") {
        MutableHashMap.remove(self.state.map, key)
      }
      return Scope.close(entry.scope, Exit.void)
    }

    if (!Duration.isFinite(self.idleTimeToLive)) {
      return Effect.void
    }

    entry.expiresAt = clock.unsafeCurrentTimeMillis() + Duration.toMillis(self.idleTimeToLive)
    if (entry.fiber) return Effect.void

    return Effect.interruptibleMask(function loop(restore): Effect.Effect<void> {
      const now = clock.unsafeCurrentTimeMillis()
      const remaining = entry.expiresAt - now
      if (remaining <= 0) {
        if (self.state._tag === "Closed" || entry.refCount > 0) return Effect.void
        MutableHashMap.remove(self.state.map, key)
        return restore(Scope.close(entry.scope, Exit.void))
      }
      return Effect.flatMap(clock.sleep(Duration.millis(remaining)), () => loop(restore))
    }).pipe(
      Effect.ensuring(Effect.sync(() => {
        entry.fiber = undefined
      })),
      Effect.forkIn(self.scope),
      Effect.tap((fiber) => {
        entry.fiber = fiber
      }),
      self.semaphore.withPermits(1)
    )
  })

/**
 * Returns an array of all keys currently stored in the RcMap.
 *
 * @since 3.5.0
 * @category combinators
 * @example
 * ```ts
 * import { Effect, RcMap } from "effect"
 *
 * Effect.gen(function*() {
 *   const map = yield* RcMap.make({
 *     lookup: (key: string) => Effect.succeed(`value-${key}`)
 *   })
 *
 *   // Add some resources to the map
 *   yield* RcMap.get(map, "foo")
 *   yield* RcMap.get(map, "bar")
 *   yield* RcMap.get(map, "baz")
 *
 *   // Get all keys currently in the map
 *   const allKeys = yield* RcMap.keys(map)
 *   console.log(allKeys) // ["foo", "bar", "baz"]
 * }).pipe(Effect.scoped)
 * ```
 */
export const keys = <K, A, E>(self: RcMap<K, A, E>): Effect.Effect<Array<K>> => {
  return Effect.suspend(() =>
    self.state._tag === "Closed" ? Effect.interrupt : Effect.succeed(MutableHashMap.keys(self.state.map))
  )
}

/**
 * Invalidates and removes a specific key from the RcMap. If the resource is not
 * currently in use (reference count is 0), it will be immediately released.
 *
 * @since 3.5.0
 * @category combinators
 * @example
 * ```ts
 * import { Effect, RcMap } from "effect"
 *
 * Effect.gen(function*() {
 *   const map = yield* RcMap.make({
 *     lookup: (key: string) =>
 *       Effect.acquireRelease(
 *         Effect.succeed(`Resource: ${key}`),
 *         () => Effect.log(`Released ${key}`)
 *       )
 *   })
 *
 *   // Get a resource
 *   yield* RcMap.get(map, "cache")
 *
 *   // Invalidate the resource - it will be removed from the map
 *   // and released if no longer in use
 *   yield* RcMap.invalidate(map, "cache")
 *
 *   // Next access will create a new resource
 *   yield* RcMap.get(map, "cache")
 * }).pipe(Effect.scoped)
 * ```
 */
export const invalidate: {
  <K>(key: K): <A, E>(self: RcMap<K, A, E>) => Effect.Effect<void>
  <K, A, E>(self: RcMap<K, A, E>, key: K): Effect.Effect<void>
} = dual(
  2,
  Effect.fnUntraced(function*<K, A, E>(self: RcMap<K, A, E>, key: K) {
    if (self.state._tag === "Closed") return
    const o = MutableHashMap.get(self.state.map, key)
    if (o._tag === "None") return
    const entry = o.value
    MutableHashMap.remove(self.state.map, key)
    if (entry.refCount > 0) return
    yield* Scope.close(entry.scope, Exit.void)
    if (entry.fiber) yield* Fiber.interrupt(entry.fiber)
  })
)

/**
 * Extends the idle time for a resource in the RcMap. If the RcMap has an
 * `idleTimeToLive` configured, calling `touch` will reset the expiration
 * timer for the specified key.
 *
 * @since 3.5.0
 * @category combinators
 * @example
 * ```ts
 * import { Effect, RcMap } from "effect"
 *
 * Effect.gen(function*() {
 *   const map = yield* RcMap.make({
 *     lookup: (key: string) =>
 *       Effect.acquireRelease(
 *         Effect.succeed(`Resource: ${key}`),
 *         () => Effect.log(`Released ${key}`)
 *       ),
 *     idleTimeToLive: "10 seconds"
 *   })
 *
 *   // Get a resource
 *   yield* RcMap.get(map, "session")
 *
 *   // Touch the resource to extend its idle time
 *   // This resets the 10-second expiration timer
 *   yield* RcMap.touch(map, "session")
 *
 *   // The resource will now live for another 10 seconds
 *   // from the time it was touched
 * }).pipe(Effect.scoped)
 * ```
 */
export const touch: {
  <K>(key: K): <A, E>(self: RcMap<K, A, E>) => Effect.Effect<void>
  <K, A, E>(self: RcMap<K, A, E>, key: K): Effect.Effect<void>
} = dual(
  2,
  <K, A, E>(self: RcMap<K, A, E>, key: K) =>
    Effect.clockWith((clock) => {
      if (!self.idleTimeToLive || self.state._tag === "Closed") return Effect.void
      const o = MutableHashMap.get(self.state.map, key)
      if (o._tag === "None") return Effect.void
      o.value.expiresAt = clock.unsafeCurrentTimeMillis() + Duration.toMillis(self.idleTimeToLive)
      return Effect.void
    })
)
