/**
 * @since 3.5.0
 */
import * as Cause from "./Cause.js"
import * as Context from "./Context.js"
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

/**
 * @since 3.5.0
 * @category type ids
 */
export const TypeId: unique symbol = Symbol.for("effect/RcMap")

/**
 * @since 3.5.0
 * @category type ids
 */
export type TypeId = typeof TypeId

/**
 * @since 3.5.0
 * @category models
 */
export interface RcMap<in out K, in out A, in out E = never> extends Pipeable {
  readonly [TypeId]: TypeId
  readonly lookup: (key: K) => Effect.Effect<A, E, Scope.Scope>
  readonly context: Context.Context<never>
  readonly scope: Scope.Scope
  readonly idleTimeToLive: Duration.Duration | undefined
  readonly capacity: number
  readonly semaphore: Effect.Semaphore
  state: State<K, A, E>
}

/**
 * @since 4.0.0
 * @category Models
 */
export type State<K, A, E> = State.Open<K, A, E> | State.Closed

/**
 * @since 4.0.0
 * @category Models
 */
export declare namespace State {
  /**
   * @since 4.0.0
   * @category Models
   */
  export interface Open<K, A, E> {
    readonly _tag: "Open"
    readonly map: MutableHashMap.MutableHashMap<K, Entry<A, E>>
  }

  /**
   * @since 4.0.0
   * @category Models
   */
  export interface Closed {
    readonly _tag: "Closed"
  }

  /**
   * @since 4.0.0
   * @category Models
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
  readonly context: Context.Context<never>
  readonly scope: Scope.Scope
  readonly idleTimeToLive: Duration.Duration | undefined
  readonly capacity: number
}): RcMap<K, A, E> => ({
  [TypeId]: TypeId,
  lookup: options.lookup,
  context: options.context,
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
    const context = fiber.context as Context.Context<R | Scope.Scope>
    const scope = Context.get(context, Scope.Scope)
    const self = unsafeMake<K, A, E>({
      lookup: options.lookup as any,
      context,
      scope,
      idleTimeToLive: options.idleTimeToLive ? Duration.decode(options.idleTimeToLive) : undefined,
      capacity: Math.max(options.capacity ?? Number.POSITIVE_INFINITY, 0)
    })
    return Effect.as(
      Scope.addFinalizer(scope, () =>
        Effect.suspend(() => {
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
        })),
      self
    )
  })

/**
 * @since 3.5.0
 * @category combinators
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
  yield* Scope.addFinalizer(scope, () => entry.finalizer)
  return yield* restore(Deferred.await(entry.deferred))
})

const acquire = Effect.fnUntraced(function*<K, A, E>(self: RcMap<K, A, E>, key: K, restore: <A>(a: A) => A) {
  const scope = Scope.unsafeMake()
  const deferred = Deferred.unsafeMake<A, E>()
  const acquire = self.lookup(key)
  const contextMap = new Map(self.context.unsafeMap)
  yield* restore(Effect.updateContext(
    acquire as Effect.Effect<A, E>,
    (inputContext: Context.Context<never>) => {
      inputContext.unsafeMap.forEach((value, key) => {
        contextMap.set(key, value)
      })
      contextMap.set(Scope.Scope.key, scope)
      return Context.unsafeMake(contextMap)
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
 * @since 3.5.0
 * @category combinators
 */
export const keys = <K, A, E>(self: RcMap<K, A, E>): Effect.Effect<Array<K>> => {
  return Effect.suspend(() =>
    self.state._tag === "Closed" ? Effect.interrupt : Effect.succeed(MutableHashMap.keys(self.state.map))
  )
}

/**
 * @since 3.5.0
 * @category combinators
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
 * @since 3.5.0
 * @category combinators
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
