/**
 * @since 2.0.0
 */
import * as Cause from "./Cause.ts"
import * as Filter from "./data/Filter.ts"
import * as Predicate from "./data/Predicate.ts"
import * as Deferred from "./Deferred.ts"
import * as Effect from "./Effect.ts"
import * as Exit from "./Exit.ts"
import * as Fiber from "./Fiber.ts"
import { dual } from "./Function.ts"
import type * as Inspectable from "./interfaces/Inspectable.ts"
import { type Pipeable } from "./interfaces/Pipeable.ts"
import { PipeInspectableProto } from "./internal/core.ts"
import type { Scheduler } from "./Scheduler.ts"
import type * as Scope from "./Scope.ts"

/**
 * @since 2.0.0
 * @category type ids
 * @example
 * ```ts
 * import { FiberHandle } from "effect"
 *
 * const typeId = FiberHandle.TypeId
 * console.log(typeId) // "~effect/FiberHandle"
 * ```
 */
export const TypeId: TypeId = "~effect/FiberHandle"

/**
 * @since 2.0.0
 * @category type ids
 * @example
 * ```ts
 * import type { FiberHandle } from "effect"
 *
 * // TypeId is used to identify FiberHandle instances
 * type MyTypeId = FiberHandle.TypeId
 * ```
 */
export type TypeId = "~effect/FiberHandle"

/**
 * @since 2.0.0
 * @category models
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { FiberHandle } from "effect"
 * import { Fiber } from "effect"
 *
 * Effect.gen(function*() {
 *   // Create a FiberHandle that can hold fibers producing strings
 *   const handle = yield* FiberHandle.make<string, never>()
 *
 *   // The handle can store and manage a single fiber
 *   const fiber = yield* FiberHandle.run(handle, Effect.succeed("hello"))
 *   const result = yield* Fiber.await(fiber)
 *   console.log(result) // "hello"
 * })
 * ```
 */
export interface FiberHandle<out A = unknown, out E = unknown> extends Pipeable, Inspectable.Inspectable {
  readonly [TypeId]: TypeId
  readonly deferred: Deferred.Deferred<void, unknown>
  state: {
    readonly _tag: "Open"
    fiber: Fiber.Fiber<A, E> | undefined
  } | {
    readonly _tag: "Closed"
  }
}

/**
 * @since 2.0.0
 * @category refinements
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { FiberHandle } from "effect"
 *
 * Effect.gen(function*() {
 *   const handle = yield* FiberHandle.make()
 *
 *   console.log(FiberHandle.isFiberHandle(handle)) // true
 *   console.log(FiberHandle.isFiberHandle("not a handle")) // false
 * })
 * ```
 */
export const isFiberHandle = (u: unknown): u is FiberHandle => Predicate.hasProperty(u, TypeId)

const Proto = {
  [TypeId]: TypeId,
  ...PipeInspectableProto,
  toJSON(this: FiberHandle) {
    return {
      _id: "FiberHandle",
      state: this.state
    }
  }
}

const makeUnsafe = <A = unknown, E = unknown>(): FiberHandle<A, E> => {
  const self = Object.create(Proto)
  self.state = { _tag: "Open", fiber: undefined }
  self.deferred = Deferred.makeUnsafe()
  return self
}

/**
 * A FiberHandle can be used to store a single fiber.
 * When the associated Scope is closed, the contained fiber will be interrupted.
 *
 * You can add a fiber to the handle using `FiberHandle.run`, and the fiber will
 * be automatically removed from the FiberHandle when it completes.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { FiberHandle } from "effect"
 *
 * Effect.gen(function*() {
 *   const handle = yield* FiberHandle.make()
 *
 *   // run some effects
 *   yield* FiberHandle.run(handle, Effect.never)
 *   // this will interrupt the previous fiber
 *   yield* FiberHandle.run(handle, Effect.never)
 *
 *   yield* Effect.sleep(1000)
 * }).pipe(
 *   Effect.scoped // The fiber will be interrupted when the scope is closed
 * )
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const make = <A = unknown, E = unknown>(): Effect.Effect<FiberHandle<A, E>, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => makeUnsafe<A, E>()),
    (handle) => {
      const state = handle.state
      if (state._tag === "Closed") return Effect.void
      handle.state = { _tag: "Closed" }
      return state.fiber ?
        Deferred.into(
          Effect.asVoid(Fiber.interruptAs(state.fiber, internalFiberId)),
          handle.deferred
        ) :
        Deferred.done(handle.deferred, Exit.void)
    }
  )

/**
 * Create an Effect run function that is backed by a FiberHandle.
 *
 * @since 2.0.0
 * @category constructors
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { FiberHandle } from "effect"
 * import { Fiber } from "effect"
 *
 * Effect.gen(function*() {
 *   const run = yield* FiberHandle.makeRuntime<never>()
 *
 *   // Run effects and get fibers back
 *   const fiberA = run(Effect.succeed("first"))
 *   const fiberB = run(Effect.succeed("second"))
 *
 *   // The second fiber will interrupt the first
 *   const resultA = yield* Fiber.await(fiberA)
 *   const resultB = yield* Fiber.await(fiberB)
 * }).pipe(Effect.scoped)
 * ```
 */
export const makeRuntime = <R, E = unknown, A = unknown>(): Effect.Effect<
  <XE extends E, XA extends A>(
    effect: Effect.Effect<XA, XE, R>,
    options?:
      | {
        readonly signal?: AbortSignal | undefined
        readonly scheduler?: Scheduler | undefined
        readonly onlyIfMissing?: boolean | undefined
        readonly propagateInterruption?: boolean | undefined
      }
      | undefined
  ) => Fiber.Fiber<XA, XE>,
  never,
  Scope.Scope | R
> =>
  Effect.flatMap(
    make<A, E>(),
    (self) => runtime(self)<R>()
  )

/**
 * Create an Effect run function that is backed by a FiberHandle.
 *
 * @since 3.13.0
 * @category constructors
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { FiberHandle } from "effect"
 *
 * Effect.gen(function*() {
 *   const run = yield* FiberHandle.makeRuntimePromise()
 *
 *   // Run effects and get promises back
 *   const promise = run(Effect.succeed("hello"))
 *   const result = yield* Effect.promise(() => promise)
 *   console.log(result) // "hello"
 * }).pipe(Effect.scoped)
 * ```
 */
export const makeRuntimePromise = <R = never, A = unknown, E = unknown>(): Effect.Effect<
  <XE extends E, XA extends A>(
    effect: Effect.Effect<XA, XE, R>,
    options?: {
      readonly signal?: AbortSignal | undefined
      readonly scheduler?: Scheduler | undefined
      readonly onlyIfMissing?: boolean | undefined
      readonly propagateInterruption?: boolean | undefined
    } | undefined
  ) => Promise<XA>,
  never,
  Scope.Scope | R
> =>
  Effect.flatMap(
    make<A, E>(),
    (self) => runtimePromise(self)<R>()
  )

const internalFiberId = -1
const isInternalInterruption = Filter.toPredicate(Filter.compose(
  Cause.filterInterruptors,
  Filter.has(internalFiberId)
))

/**
 * Set the fiber in a FiberHandle. When the fiber completes, it will be removed from the FiberHandle.
 * If a fiber is already running, it will be interrupted unless `options.onlyIfMissing` is set.
 *
 * @since 2.0.0
 * @category combinators
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { FiberHandle } from "effect"
 * import { Fiber } from "effect"
 *
 * Effect.gen(function*() {
 *   const handle = yield* FiberHandle.make()
 *   const fiber = Effect.runFork(Effect.succeed("hello"))
 *
 *   // Set the fiber directly (unsafe)
 *   FiberHandle.setUnsafe(handle, fiber)
 *
 *   // The fiber is now managed by the handle
 *   const result = yield* Fiber.await(fiber)
 *   console.log(result) // "hello"
 * })
 * ```
 */
export const setUnsafe: {
  <A, E, XE extends E, XA extends A>(
    fiber: Fiber.Fiber<XA, XE>,
    options?: {
      readonly onlyIfMissing?: boolean | undefined
      readonly propagateInterruption?: boolean | undefined
    }
  ): (self: FiberHandle<A, E>) => void
  <A, E, XE extends E, XA extends A>(
    self: FiberHandle<A, E>,
    fiber: Fiber.Fiber<XA, XE>,
    options?: {
      readonly onlyIfMissing?: boolean | undefined
      readonly propagateInterruption?: boolean | undefined
    }
  ): void
} = dual((args) => isFiberHandle(args[0]), <A, E, XE extends E, XA extends A>(
  self: FiberHandle<A, E>,
  fiber: Fiber.Fiber<XA, XE>,
  options?: {
    readonly onlyIfMissing?: boolean | undefined
    readonly propagateInterruption?: boolean | undefined
  }
): void => {
  if (self.state._tag === "Closed") {
    fiber.interruptUnsafe(internalFiberId)
    return
  } else if (self.state.fiber !== undefined) {
    if (options?.onlyIfMissing === true) {
      fiber.interruptUnsafe(internalFiberId)
      return
    } else if (self.state.fiber === fiber) {
      return
    }
    self.state.fiber.interruptUnsafe(internalFiberId)
    self.state.fiber = undefined
  }

  self.state.fiber = fiber
  fiber.addObserver((exit) => {
    if (self.state._tag === "Open" && fiber === self.state.fiber) {
      self.state.fiber = undefined
    }
    if (
      Exit.isFailure(exit) &&
      (
        options?.propagateInterruption === true ?
          !isInternalInterruption(exit.cause) :
          !Cause.isInterruptedOnly(exit.cause)
      )
    ) {
      Deferred.doneUnsafe(self.deferred, exit as any)
    }
  })
})

/**
 * Set the fiber in the FiberHandle. When the fiber completes, it will be removed from the FiberHandle.
 * If a fiber already exists in the FiberHandle, it will be interrupted unless `options.onlyIfMissing` is set.
 *
 * @since 2.0.0
 * @category combinators
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { FiberHandle } from "effect"
 * import { Fiber } from "effect"
 *
 * Effect.gen(function*() {
 *   const handle = yield* FiberHandle.make()
 *   const fiber = Effect.runFork(Effect.succeed("hello"))
 *
 *   // Set the fiber safely
 *   yield* FiberHandle.set(handle, fiber)
 *
 *   // The fiber is now managed by the handle
 *   const result = yield* Fiber.await(fiber)
 *   console.log(result) // "hello"
 * })
 * ```
 */
export const set: {
  <A, E, XE extends E, XA extends A>(
    fiber: Fiber.Fiber<XA, XE>,
    options?: {
      readonly onlyIfMissing?: boolean
      readonly propagateInterruption?: boolean | undefined
    }
  ): (self: FiberHandle<A, E>) => Effect.Effect<void>
  <A, E, XE extends E, XA extends A>(
    self: FiberHandle<A, E>,
    fiber: Fiber.Fiber<XA, XE>,
    options?: {
      readonly onlyIfMissing?: boolean
      readonly propagateInterruption?: boolean | undefined
    }
  ): Effect.Effect<void>
} = dual((args) => isFiberHandle(args[0]), <A, E, XE extends E, XA extends A>(
  self: FiberHandle<A, E>,
  fiber: Fiber.Fiber<XA, XE>,
  options?: {
    readonly onlyIfMissing?: boolean
    readonly propagateInterruption?: boolean | undefined
  }
): Effect.Effect<void> =>
  Effect.sync(() =>
    setUnsafe(self, fiber, {
      onlyIfMissing: options?.onlyIfMissing,
      propagateInterruption: options?.propagateInterruption
    })
  ))

/**
 * Retrieve the fiber from the FiberHandle.
 *
 * @since 2.0.0
 * @category combinators
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { FiberHandle } from "effect"
 *
 * Effect.gen(function*() {
 *   const handle = yield* FiberHandle.make()
 *
 *   // No fiber initially
 *   const emptyFiber = FiberHandle.getUnsafe(handle)
 *   console.log(emptyFiber === undefined) // true
 *
 *   // Add a fiber
 *   yield* FiberHandle.run(handle, Effect.succeed("hello"))
 *   const fiber = FiberHandle.getUnsafe(handle)
 *   console.log(fiber !== undefined) // true
 * })
 * ```
 */
export function getUnsafe<A, E>(self: FiberHandle<A, E>): Fiber.Fiber<A, E> | undefined {
  return self.state._tag === "Closed" ? undefined : self.state.fiber
}

/**
 * Retrieve the fiber from the FiberHandle.
 *
 * @since 2.0.0
 * @category combinators
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { FiberHandle } from "effect"
 * import { Fiber } from "effect"
 *
 * Effect.gen(function*() {
 *   const handle = yield* FiberHandle.make()
 *
 *   // Add a fiber
 *   yield* FiberHandle.run(handle, Effect.succeed("hello"))
 *
 *   // Get the fiber (fails if no fiber)
 *   const fiber = yield* FiberHandle.get(handle)
 *   if (fiber) {
 *     const result = yield* Fiber.await(fiber)
 *     console.log(result) // "hello"
 *   }
 * })
 * ```
 */
export function get<A, E>(self: FiberHandle<A, E>): Effect.Effect<Fiber.Fiber<A, E> | undefined> {
  return Effect.suspend(() => Effect.succeed(getUnsafe(self)))
}

/**
 * @since 2.0.0
 * @category combinators
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { FiberHandle } from "effect"
 *
 * Effect.gen(function*() {
 *   const handle = yield* FiberHandle.make()
 *
 *   // Add a fiber
 *   yield* FiberHandle.run(handle, Effect.never)
 *
 *   // Clear the handle, interrupting the fiber
 *   yield* FiberHandle.clear(handle)
 *
 *   // The handle is now empty
 *   const fiber = FiberHandle.getUnsafe(handle)
 *   console.log(fiber) // undefined
 * })
 * ```
 */
export const clear = <A, E>(self: FiberHandle<A, E>): Effect.Effect<void> =>
  Effect.uninterruptibleMask((restore) => {
    if (self.state._tag === "Closed" || self.state.fiber === undefined) {
      return Effect.void
    }
    return Effect.andThen(
      restore(Fiber.interruptAs(self.state.fiber, internalFiberId)),
      Effect.sync(() => {
        if (self.state._tag === "Open") {
          self.state.fiber = undefined
        }
      })
    )
  })

const constInterruptedFiber = (function() {
  let fiber: Fiber.Fiber<never, never> | undefined = undefined
  return () => {
    if (fiber === undefined) {
      fiber = Effect.runFork(Effect.interrupt)
    }
    return fiber
  }
})()

/**
 * Run an Effect and add the forked fiber to the FiberHandle.
 * When the fiber completes, it will be removed from the FiberHandle.
 *
 * @since 2.0.0
 * @category combinators
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { FiberHandle } from "effect"
 * import { Fiber } from "effect"
 *
 * Effect.gen(function*() {
 *   const handle = yield* FiberHandle.make()
 *
 *   // Run an effect and get the fiber
 *   const fiber = yield* FiberHandle.run(handle, Effect.succeed("hello"))
 *   const result = yield* Fiber.await(fiber)
 *   console.log(result) // "hello"
 *
 *   // Running another effect will interrupt the previous one
 *   const fiber2 = yield* FiberHandle.run(handle, Effect.succeed("world"))
 *   const result2 = yield* Fiber.await(fiber2)
 *   console.log(result2) // "world"
 * })
 * ```
 */
export const run: {
  <A, E>(
    self: FiberHandle<A, E>,
    options?: {
      readonly onlyIfMissing?: boolean
      readonly propagateInterruption?: boolean | undefined
      readonly startImmediately?: boolean | undefined
    }
  ): <R, XE extends E, XA extends A>(
    effect: Effect.Effect<XA, XE, R>
  ) => Effect.Effect<Fiber.Fiber<XA, XE>, never, R>
  <A, E, R, XE extends E, XA extends A>(
    self: FiberHandle<A, E>,
    effect: Effect.Effect<XA, XE, R>,
    options?: {
      readonly onlyIfMissing?: boolean
      readonly propagateInterruption?: boolean | undefined
      readonly startImmediately?: boolean | undefined
    }
  ): Effect.Effect<Fiber.Fiber<XA, XE>, never, R>
} = function() {
  const self = arguments[0] as FiberHandle
  if (Effect.isEffect(arguments[1])) {
    return runImpl(self, arguments[1], arguments[2]) as any
  }
  const options = arguments[1]
  return (effect: Effect.Effect<unknown, unknown, any>) => runImpl(self, effect, options)
}

const runImpl = <A, E, R, XE extends E, XA extends A>(
  self: FiberHandle<A, E>,
  effect: Effect.Effect<XA, XE, R>,
  options?: {
    readonly onlyIfMissing?: boolean | undefined
    readonly startImmediately?: boolean | undefined
  }
): Effect.Effect<Fiber.Fiber<XA, XE>, never, R> =>
  Effect.suspend(() => {
    if (self.state._tag === "Closed") {
      return Effect.interrupt
    } else if (self.state.fiber !== undefined && options?.onlyIfMissing === true) {
      return Effect.sync(constInterruptedFiber)
    }
    return Effect.tap(
      Effect.forkDaemon(effect, options),
      (fiber) => setUnsafe(self, fiber, options)
    )
  })

/**
 * Capture a Runtime and use it to fork Effect's, adding the forked fibers to the FiberHandle.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { ServiceMap } from "effect"
 * import { FiberHandle } from "effect"
 *
 * interface Users {
 *   readonly _: unique symbol
 * }
 * const Users = ServiceMap.Key<Users, {
 *    getAll: Effect.Effect<Array<unknown>>
 * }>("Users")
 *
 * Effect.gen(function*() {
 *   const handle = yield* FiberHandle.make()
 *   const run = yield* FiberHandle.runtime(handle)<Users>()
 *
 *   // run an effect and set the fiber in the handle
 *   run(Effect.andThen(Users.asEffect(), _ => _.getAll))
 *
 *   // this will interrupt the previous fiber
 *   run(Effect.andThen(Users.asEffect(), _ => _.getAll))
 * }).pipe(
 *   Effect.scoped // The fiber will be interrupted when the scope is closed
 * )
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const runtime: <A, E>(
  self: FiberHandle<A, E>
) => <R = never>() => Effect.Effect<
  <XE extends E, XA extends A>(
    effect: Effect.Effect<XA, XE, R>,
    options?:
      | {
        readonly signal?: AbortSignal | undefined
        readonly scheduler?: Scheduler | undefined
        readonly onlyIfMissing?: boolean | undefined
        readonly propagateInterruption?: boolean | undefined
      }
      | undefined
  ) => Fiber.Fiber<XA, XE>,
  never,
  R
> = <A, E>(self: FiberHandle<A, E>) => <R>() =>
  Effect.map(
    Effect.services<R>(),
    (services) => {
      const runFork = Effect.runForkWith(services)
      return <XE extends E, XA extends A>(
        effect: Effect.Effect<XA, XE, R>,
        options?:
          | {
            readonly signal?: AbortSignal | undefined
            readonly scheduler?: Scheduler | undefined
            readonly onlyIfMissing?: boolean | undefined
            readonly propagateInterruption?: boolean | undefined
          }
          | undefined
      ) => {
        if (self.state._tag === "Closed") {
          return constInterruptedFiber()
        } else if (self.state.fiber !== undefined && options?.onlyIfMissing === true) {
          return constInterruptedFiber()
        }
        const fiber = runFork(effect, options)
        setUnsafe(self, fiber, options)
        return fiber
      }
    }
  )

/**
 * Capture a Runtime and use it to fork Effect's, adding the forked fibers to the FiberHandle.
 *
 * The returned run function will return Promise's that will resolve when the
 * fiber completes.
 *
 * @since 3.13.0
 * @category combinators
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { FiberHandle } from "effect"
 *
 * Effect.gen(function*() {
 *   const handle = yield* FiberHandle.make()
 *   const runPromise = yield* FiberHandle.runtimePromise(handle)<never>()
 *
 *   // Run an effect and get a promise
 *   const promise = runPromise(Effect.succeed("hello"))
 *   const result = yield* Effect.promise(() => promise)
 *   console.log(result) // "hello"
 * })
 * ```
 */
export const runtimePromise = <A, E>(self: FiberHandle<A, E>): <R = never>() => Effect.Effect<
  <XE extends E, XA extends A>(
    effect: Effect.Effect<XA, XE, R>,
    options?:
      | {
        readonly signal?: AbortSignal | undefined
        readonly scheduler?: Scheduler | undefined
        readonly onlyIfMissing?: boolean | undefined
        readonly propagateInterruption?: boolean | undefined
      }
      | undefined
  ) => Promise<XA>,
  never,
  R
> =>
<R>() =>
  Effect.map(
    runtime(self)<R>(),
    (runFork) =>
    <XE extends E, XA extends A>(
      effect: Effect.Effect<XA, XE, R>,
      options?:
        | {
          readonly signal?: AbortSignal | undefined
          readonly scheduler?: Scheduler | undefined
          readonly onlyIfMissing?: boolean | undefined
          readonly propagateInterruption?: boolean | undefined
        }
        | undefined
    ): Promise<XA> =>
      new Promise((resolve, reject) =>
        runFork(effect, options).addObserver((exit) => {
          if (Exit.isSuccess(exit)) {
            resolve(exit.value)
          } else {
            reject(Cause.squash(exit.cause))
          }
        })
      )
  )

/**
 * If any of the Fiber's in the handle terminate with a failure,
 * the returned Effect will terminate with the first failure that occurred.
 *
 * @since 2.0.0
 * @category combinators
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { FiberHandle } from "effect";
 *
 * Effect.gen(function* () {
 *   const handle = yield* FiberHandle.make()
 *   yield* FiberHandle.set(handle, Effect.runFork(Effect.fail("error")))
 *
 *   // parent fiber will fail with "error"
 *   yield* FiberHandle.join(handle)
 * });
 * ```
 */
export const join = <A, E>(self: FiberHandle<A, E>): Effect.Effect<void, E> =>
  Deferred.await(self.deferred as Deferred.Deferred<void, E>)

/**
 * Wait for the fiber in the FiberHandle to complete.
 *
 * @since 3.13.0
 * @category combinators
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { FiberHandle } from "effect"
 *
 * Effect.gen(function*() {
 *   const handle = yield* FiberHandle.make()
 *
 *   // Start a long-running effect
 *   yield* FiberHandle.run(handle, Effect.sleep(1000))
 *
 *   // Wait for the fiber to complete
 *   yield* FiberHandle.awaitEmpty(handle)
 *
 *   console.log("Fiber completed")
 * })
 * ```
 */
export const awaitEmpty = <A, E>(self: FiberHandle<A, E>): Effect.Effect<void, E> =>
  Effect.suspend(() => {
    if (self.state._tag === "Closed" || self.state.fiber === undefined) {
      return Effect.void
    }
    return Fiber.await(self.state.fiber)
  })
