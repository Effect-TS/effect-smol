/**
 * This module provides utilities for working with asynchronous queues that support various backpressure strategies.
 *
 * A Queue is a data structure that allows producers to add elements and consumers to take elements
 * in a thread-safe manner. The queue supports different strategies for handling backpressure when
 * the queue reaches capacity.
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * // Creating a bounded queue with capacity 10
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(10)
 *
 *   // Producer: add items to queue
 *   yield* Queue.offer(queue, 1)
 *   yield* Queue.offer(queue, 2)
 *   yield* Queue.offerAll(queue, [3, 4, 5])
 *
 *   // Consumer: take items from queue
 *   const item1 = yield* Queue.take(queue)
 *   const item2 = yield* Queue.take(queue)
 *   const remaining = yield* Queue.takeAll(queue)
 *
 *   console.log({ item1, item2, remaining }) // { item1: 1, item2: 2, remaining: [3, 4, 5] }
 *
 *   // Signal completion
 *   yield* Queue.end(queue)
 * })
 * ```
 *
 * @since 3.8.0
 */
import * as Arr from "./Array.js"
import type { Cause } from "./Cause.js"
import type { Effect } from "./Effect.js"
import type { Exit } from "./Exit.js"
import { dual, identity } from "./Function.js"
import type { Inspectable } from "./Inspectable.js"
import * as core from "./internal/core.js"
import { PipeInspectableProto } from "./internal/core.js"
import * as internalEffect from "./internal/effect.js"
import * as Iterable from "./Iterable.js"
import * as MutableList from "./MutableList.js"
import * as Option from "./Option.js"
import { hasProperty } from "./Predicate.js"
import type { Scheduler } from "./Scheduler.js"
import type * as Types from "./Types.js"

/**
 * @since 3.8.0
 * @category type ids
 */
export const TypeId: TypeId = "~effect/Queue"

/**
 * @since 3.8.0
 * @category type ids
 */
export type TypeId = "~effect/Queue"

/**
 * @since 3.8.0
 * @category type ids
 */
export const DequeueTypeId: DequeueTypeId = "~effect/Queue/Dequeue"

/**
 * @since 3.8.0
 * @category type ids
 */
export type DequeueTypeId = "~effect/Queue/Dequeue"

/**
 * @since 3.8.0
 * @category guards
 */
export const isQueue = <A = unknown, E = unknown>(
  u: unknown
): u is Queue<A, E> => hasProperty(u, TypeId)

/**
 * A `Dequeue` is a queue that can be taken from.
 *
 * @since 3.8.0
 * @category models
 */
export interface Dequeue<out A, out E = never> extends Inspectable {
  readonly [DequeueTypeId]: Dequeue.Variance<A, E>
  readonly strategy: "suspend" | "dropping" | "sliding"
  readonly scheduler: Scheduler
  capacity: number
  messages: MutableList.MutableList<any>
  state: Queue.State<any, any>
  scheduleRunning: boolean
}

/**
 * @since 4.0.0
 * @category models
 */
export declare namespace Dequeue {
  /**
   * @since 3.8.0
   * @category models
   */
  export interface Variance<A, E> {
    _A: Types.Covariant<A>
    _E: Types.Covariant<E>
  }
}

/**
 * A `Queue` is an asynchronous queue that can be offered to and taken from.
 *
 * It also supports signaling that it is done or failed.
 *
 * @since 3.8.0
 * @category models
 */
export interface Queue<in out A, in out E = never> extends Dequeue<A, E> {
  readonly [TypeId]: Queue.Variance<A, E>
}

/**
 * @since 3.8.0
 * @category models
 */
export declare namespace Queue {
  /**
   * @since 3.8.0
   * @category models
   */
  export interface Variance<A, E> {
    _A: Types.Invariant<A>
    _E: Types.Invariant<E>
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export type State<A, E> =
    | {
      readonly _tag: "Open"
      readonly takers: Set<(_: Effect<void, E>) => void>
      readonly offers: Set<OfferEntry<A>>
      readonly awaiters: Set<(_: Effect<void, E>) => void>
    }
    | {
      readonly _tag: "Closing"
      readonly takers: Set<(_: Effect<void, E>) => void>
      readonly offers: Set<OfferEntry<A>>
      readonly awaiters: Set<(_: Effect<void, E>) => void>
      readonly exit: Exit<void, E>
    }
    | {
      readonly _tag: "Done"
      readonly exit: Exit<void, E>
    }

  /**
   * @since 4.0.0
   * @category models
   */
  export type OfferEntry<A> =
    | {
      readonly _tag: "Array"
      readonly remaining: Array<A>
      offset: number
      readonly resume: (_: Effect<Array<A>>) => void
    }
    | {
      readonly _tag: "Single"
      readonly message: A
      readonly resume: (_: Effect<boolean>) => void
    }
}

const variance = {
  _A: identity,
  _E: identity
}
const QueueProto = {
  [TypeId]: variance,
  [DequeueTypeId]: variance,
  ...PipeInspectableProto,
  toJSON(this: Queue<unknown, unknown>) {
    return {
      _id: "effect/Queue",
      state: this.state._tag,
      size: unsafeSize(this).toJSON()
    }
  }
}

/**
 * A `Queue` is an asynchronous queue that can be offered to and taken from.
 *
 * It also supports signaling that it is done or failed.
 *
 * @since 3.8.0
 * @category constructors
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Effect, Queue } from "effect"
 *
 * Effect.gen(function*() {
 *   const queue = yield* Queue.make<number, string>()
 *
 *   // add messages to the queue
 *   yield* Queue.offer(queue, 1)
 *   yield* Queue.offer(queue, 2)
 *   yield* Queue.offerAll(queue, [3, 4, 5])
 *
 *   // take messages from the queue
 *   const [messages, done] = yield* Queue.takeAll(queue)
 *   assert.deepStrictEqual(messages, [1, 2, 3, 4, 5])
 *   assert.strictEqual(done, false)
 *
 *   // signal that the queue is done
 *   yield* Queue.end(queue)
 *   const [messages2, done2] = yield* Queue.takeAll(queue)
 *   assert.deepStrictEqual(messages2, [])
 *   assert.strictEqual(done2, true)
 *
 *   // signal that the queue has failed
 *   yield* Queue.fail(queue, "boom")
 * })
 * ```
 */
export const make = <A, E = never>(
  options?: {
    readonly capacity?: number | undefined
    readonly strategy?: "suspend" | "dropping" | "sliding" | undefined
  } | undefined
): Effect<Queue<A, E>> =>
  core.withFiber((fiber) => {
    const self = Object.create(QueueProto)
    self.scheduler = fiber.currentScheduler
    self.capacity = options?.capacity ?? Number.POSITIVE_INFINITY
    self.strategy = options?.strategy ?? "suspend"
    self.messages = MutableList.make()
    self.scheduleRunning = false
    self.state = {
      _tag: "Open",
      takers: new Set(),
      offers: new Set(),
      awaiters: new Set()
    }
    return internalEffect.succeed(self)
  })

/**
 * Creates a bounded queue with the specified capacity that uses backpressure strategy.
 *
 * When the queue reaches capacity, producers will be suspended until space becomes available.
 * This ensures all messages are processed but may slow down producers.
 *
 * @param capacity - The maximum number of elements the queue can hold
 * @returns An Effect that creates a bounded queue
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<string>(5)
 *
 *   // This will succeed as queue has capacity
 *   yield* Queue.offer(queue, "first")
 *   yield* Queue.offer(queue, "second")
 *
 *   const size = yield* Queue.size(queue)
 *   console.log(size) // 2
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const bounded = <A, E = never>(capacity: number): Effect<Queue<A, E>> => make({ capacity })

/**
 * Creates a bounded queue with sliding strategy. When the queue reaches capacity,
 * new elements are added and the oldest elements are dropped.
 *
 * This strategy prevents producers from being blocked but may result in message loss.
 * Useful when you want to maintain a rolling window of the most recent messages.
 *
 * @param capacity - The maximum number of elements the queue can hold
 * @returns An Effect that creates a sliding queue
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.sliding<number>(3)
 *
 *   // Fill the queue to capacity
 *   yield* Queue.offer(queue, 1)
 *   yield* Queue.offer(queue, 2)
 *   yield* Queue.offer(queue, 3)
 *
 *   // This will succeed, dropping the oldest element (1)
 *   yield* Queue.offer(queue, 4)
 *
 *   const all = yield* Queue.takeAll(queue)
 *   console.log(all) // [2, 3, 4] - oldest element (1) was dropped
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const sliding = <A, E = never>(capacity: number): Effect<Queue<A, E>> => make({ capacity, strategy: "sliding" })

/**
 * Creates a bounded queue with dropping strategy. When the queue reaches capacity,
 * new elements are dropped and the offer operation returns false.
 *
 * This strategy prevents producers from being blocked and preserves existing messages,
 * but new messages may be lost when the queue is full.
 *
 * @param capacity - The maximum number of elements the queue can hold
 * @returns An Effect that creates a dropping queue
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.dropping<number>(2)
 *
 *   // Fill the queue to capacity
 *   const success1 = yield* Queue.offer(queue, 1)
 *   const success2 = yield* Queue.offer(queue, 2)
 *   console.log(success1, success2) // true, true
 *
 *   // This will be dropped
 *   const success3 = yield* Queue.offer(queue, 3)
 *   console.log(success3) // false
 *
 *   const all = yield* Queue.takeAll(queue)
 *   console.log(all) // [1, 2] - element 3 was dropped
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const dropping = <A, E = never>(capacity: number): Effect<Queue<A, E>> =>
  make({ capacity, strategy: "dropping" })

/**
 * @since 2.0.0
 * @category constructors
 */
export const unbounded = <A, E = never>(): Effect<Queue<A, E>> => make()

/**
 * Add a message to the queue. Returns `false` if the queue is done.
 *
 * @category offering
 * @since 4.0.0
 */
export const offer = <A, E>(self: Queue<A, E>, message: A): Effect<boolean> =>
  internalEffect.suspend(() => {
    if (self.state._tag !== "Open") {
      return exitFalse
    } else if (self.messages.length >= self.capacity) {
      switch (self.strategy) {
        case "dropping":
          return exitFalse
        case "suspend":
          if (self.capacity <= 0 && self.state.takers.size > 0) {
            MutableList.append(self.messages, message)
            releaseTaker(self)
            return exitTrue
          }
          return offerRemainingSingle(self, message)
        case "sliding":
          MutableList.take(self.messages)
          MutableList.append(self.messages, message)
          return exitTrue
      }
    }
    MutableList.append(self.messages, message)
    scheduleReleaseTaker(self)
    return exitTrue
  })

/**
 * Add a message to the queue. Returns `false` if the queue is done.
 *
 * @category offering
 * @since 4.0.0
 */
export const unsafeOffer = <A, E>(self: Queue<A, E>, message: A): boolean => {
  if (self.state._tag !== "Open") {
    return false
  } else if (self.messages.length >= self.capacity) {
    if (self.strategy === "sliding") {
      MutableList.take(self.messages)
      MutableList.append(self.messages, message)
      return true
    } else if (self.capacity <= 0 && self.state.takers.size > 0) {
      MutableList.append(self.messages, message)
      releaseTaker(self)
      return true
    }
    return false
  }
  MutableList.append(self.messages, message)
  scheduleReleaseTaker(self)
  return true
}

/**
 * Add multiple messages to the queue. Returns the remaining messages that
 * were not added.
 *
 * @category offering
 * @since 4.0.0
 */
export const offerAll = <A, E>(self: Queue<A, E>, messages: Iterable<A>): Effect<Array<A>> =>
  internalEffect.suspend(() => {
    if (self.state._tag !== "Open") {
      return internalEffect.succeed(Arr.fromIterable(messages))
    }
    const remaining = unsafeOfferAll(self, messages)
    if (remaining.length === 0) {
      return exitEmpty
    } else if (self.strategy === "dropping") {
      return internalEffect.succeed(remaining)
    }
    return offerRemainingArray(self, remaining)
  })

/**
 * Add multiple messages to the queue. Returns the remaining messages that
 * were not added.
 *
 * @category offering
 * @since 4.0.0
 */
export const unsafeOfferAll = <A, E>(self: Queue<A, E>, messages: Iterable<A>): Array<A> => {
  if (self.state._tag !== "Open") {
    return Arr.fromIterable(messages)
  } else if (
    self.capacity === Number.POSITIVE_INFINITY ||
    self.strategy === "sliding"
  ) {
    MutableList.appendAll(self.messages, messages)
    if (self.strategy === "sliding") {
      MutableList.takeN(self.messages, self.messages.length - self.capacity)
    }
    scheduleReleaseTaker(self)
    return []
  }
  const free = self.capacity <= 0
    ? self.state.takers.size
    : self.capacity - self.messages.length
  if (free === 0) {
    return Arr.fromIterable(messages)
  }
  const remaining: Array<A> = []
  let i = 0
  for (const message of messages) {
    if (i < free) {
      MutableList.append(self.messages, message)
    } else {
      remaining.push(message)
    }
    i++
  }
  scheduleReleaseTaker(self)
  return remaining
}

/**
 * Fail the queue with an error. If the queue is already done, `false` is
 * returned.
 *
 * @category completion
 * @since 4.0.0
 */
export const fail = <A, E>(self: Queue<A, E>, error: E) => done(self, core.exitFail(error))

/**
 * Fail the queue with a cause. If the queue is already done, `false` is
 * returned.
 *
 * @category completion
 * @since 4.0.0
 */
export const failCause = <A, E>(self: Queue<A, E>, cause: Cause<E>) => done(self, core.exitFailCause(cause))

/**
 * Signal that the queue is complete. If the queue is already done, `false` is
 * returned.
 *
 * @category completion
 * @since 4.0.0
 */
export const end = <A, E>(self: Queue<A, E>): Effect<boolean> => done(self, internalEffect.exitVoid)

/**
 * Signal that the queue is complete. If the queue is already done, `false` is
 * returned.
 *
 * @category completion
 * @since 4.0.0
 */
export const unsafeEnd = <A, E>(self: Queue<A, E>) => unsafeDone(self, internalEffect.exitVoid)

/**
 * Signal that the queue is done. If the queue is already done, `false` is
 * returned.
 *
 * @category completion
 * @since 4.0.0
 */
export const done = <A, E>(self: Queue<A, E>, exit: Exit<void, E>): Effect<boolean> =>
  internalEffect.sync(() => unsafeDone(self, exit))

/**
 * Signal that the queue is done. If the queue is already done, `false` is
 * returned.
 *
 * @category completion
 * @since 4.0.0
 */
export const unsafeDone = <A, E>(self: Queue<A, E>, exit: Exit<void, E>): boolean => {
  if (self.state._tag !== "Open") {
    return false
  } else if (
    self.state.offers.size === 0 &&
    self.messages.length === 0
  ) {
    finalize(self, exit)
    return true
  }
  self.state = { ...self.state, _tag: "Closing", exit }
  return true
}

/**
 * Shutdown the queue, canceling any pending operations.
 * If the queue is already done, `false` is returned.
 *
 * @category completion
 * @since 4.0.0
 */
export const shutdown = <A, E>(self: Queue<A, E>): Effect<boolean> =>
  internalEffect.sync(() => {
    if (self.state._tag === "Done") {
      return true
    }
    MutableList.clear(self.messages)
    const offers = self.state.offers
    finalize(self, self.state._tag === "Open" ? internalEffect.exitVoid : self.state.exit)
    if (offers.size > 0) {
      for (const entry of offers) {
        if (entry._tag === "Single") {
          entry.resume(exitFalse)
        } else {
          entry.resume(core.exitSucceed(entry.remaining.slice(entry.offset)))
        }
      }
      offers.clear()
    }
    return true
  })

/**
 * Take all messages from the queue, returning an empty array if the queue
 * is empty or done.
 *
 * @category taking
 * @since 4.0.0
 */
export const clear = <A, E>(self: Dequeue<A, E>): Effect<Array<A>, E> =>
  internalEffect.suspend(() => {
    if (self.state._tag === "Done") {
      return internalEffect.exitAs(self.state.exit, empty)
    }
    const messages = unsafeTakeAll(self)
    releaseCapacity(self)
    return internalEffect.succeed(messages)
  })

/**
 * Take all messages from the queue, or wait for messages to be available.
 *
 * If the queue is done, the `done` flag will be `true`. If the queue
 * fails, the Effect will fail with the error.
 *
 * @category taking
 * @since 4.0.0
 */
export const takeAll = <A, E>(self: Dequeue<A, E>): Effect<readonly [messages: Array<A>, done: boolean], E> =>
  takeBetween(self, 1, Number.POSITIVE_INFINITY)

/**
 * Take a specified number of messages from the queue. It will only take
 * up to the capacity of the queue.
 *
 * If the queue is done, the `done` flag will be `true`. If the queue
 * fails, the Effect will fail with the error.
 *
 * @category taking
 * @since 4.0.0
 */
export const takeN = <A, E>(
  self: Dequeue<A, E>,
  n: number
): Effect<readonly [messages: Array<A>, done: boolean], E> => takeBetween(self, n, n)

/**
 * Take a variable number of messages from the queue, between specified min and max.
 * It will only take up to the capacity of the queue.
 *
 * If the queue is done, the `done` flag will be `true`. If the queue
 * fails, the Effect will fail with the error.
 *
 * @category taking
 * @since 4.0.0
 */
export const takeBetween = <A, E>(
  self: Dequeue<A, E>,
  min: number,
  max: number
): Effect<readonly [messages: Array<A>, done: boolean], E> =>
  internalEffect.suspend(() =>
    unsafeTakeBetween(self, min, max) ?? internalEffect.andThen(awaitTake(self), takeBetween(self, 1, max))
  )

/**
 * Take a single message from the queue, or wait for a message to be
 * available.
 *
 * If the queue is done, it will fail with `Option.None`. If the
 * queue fails, the Effect will fail with `Option.some(error)`.
 *
 * @category taking
 * @since 4.0.0
 */
export const take = <A, E>(self: Dequeue<A, E>): Effect<A, Option.Option<E>> =>
  internalEffect.suspend(
    () => unsafeTake(self) ?? internalEffect.andThen(awaitTakeOption(self), take(self))
  )

/**
 * Take a single message from the queue, or wait for a message to be
 * available.
 *
 * If the queue is done, it will fail with `Option.None`. If the
 * queue fails, the Effect will fail with `Option.some(error)`.
 *
 * @category taking
 * @since 4.0.0
 */
export const unsafeTake = <A, E>(self: Dequeue<A, E>): Exit<A, Option.Option<E>> | undefined => {
  if (self.state._tag === "Done") {
    const exit = self.state.exit
    if (exit._tag === "Success") return exitFailNone
    const fail = exit.cause.failures.find((_) => _._tag === "Fail")
    return fail ? core.exitFail(Option.some(fail.error)) : (exit as any)
  }
  if (self.messages.length > 0) {
    const message = MutableList.take(self.messages)!
    releaseCapacity(self)
    return core.exitSucceed(message)
  } else if (self.capacity <= 0 && self.state.offers.size > 0) {
    self.capacity = 1
    releaseCapacity(self)
    self.capacity = 0
    const message = MutableList.take(self.messages)!
    releaseCapacity(self)
    return core.exitSucceed(message)
  }
  return undefined
}

const await_ = <A, E>(self: Dequeue<A, E>): Effect<void, E> =>
  internalEffect.callback<void, E>((resume) => {
    if (self.state._tag === "Done") {
      return resume(self.state.exit)
    }
    self.state.awaiters.add(resume)
    return internalEffect.sync(() => {
      if (self.state._tag !== "Done") {
        self.state.awaiters.delete(resume)
      }
    })
  })

export {
  /**
   * Wait for the queue to be done.
   *
   * @category completion
   * @since 4.0.0
   */
  await_ as await
}

/**
 * Check the size of the queue.
 *
 * If the queue is complete, it will return `None`.
 *
 * @category size
 * @since 4.0.0
 */
export const size = <A, E>(self: Dequeue<A, E>): Effect<Option.Option<number>> =>
  internalEffect.sync(() => unsafeSize(self))

/**
 * Check the size of the queue.
 *
 * If the queue is complete, it will return `None`.
 *
 * @category size
 * @since 4.0.0
 */
export const unsafeSize = <A, E>(self: Dequeue<A, E>): Option.Option<number> =>
  self.state._tag === "Done" ? Option.none() : Option.some(self.messages.length)

/**
 * @since 4.0.0
 * @category conversions
 */
export const asDequeue: <A, E>(self: Queue<A, E>) => Dequeue<A, E> = identity

/**
 * Run an `Effect` into a `Queue`, where success ends the queue and failure
 * fails the queue.
 *
 * @since 3.8.0
 * @category combinators
 */
export const into: {
  <A, E>(
    self: Queue<A, E>
  ): <AX, EX extends E, RX>(
    effect: Effect<AX, EX, RX>
  ) => Effect<boolean, never, RX>
  <AX, E, EX extends E, RX, A>(
    effect: Effect<AX, EX, RX>,
    self: Queue<A, E>
  ): Effect<boolean, never, RX>
} = dual(
  2,
  <AX, E, EX extends E, RX, A>(
    effect: Effect<AX, EX, RX>,
    self: Queue<A, E>
  ): Effect<boolean, never, RX> =>
    internalEffect.uninterruptibleMask((restore) =>
      internalEffect.matchCauseEffect(restore(effect), {
        onFailure: (cause) => failCause(self, cause),
        onSuccess: (_) => end(self)
      })
    )
)

// -----------------------------------------------------------------------------
// internals
// -----------------------------------------------------------------------------
//

const empty = Arr.empty()
const exitEmpty = core.exitSucceed(empty)
const exitFalse = core.exitSucceed(false)
const exitTrue = core.exitSucceed(true)
const constDone = [empty, true] as const
const exitFailNone = core.exitFail(Option.none())

const releaseTaker = <A, E>(self: Queue<A, E>) => {
  self.scheduleRunning = false
  if (self.state._tag === "Done" || self.state.takers.size === 0) {
    return
  }
  const taker = Iterable.unsafeHead(self.state.takers)
  self.state.takers.delete(taker)
  taker(internalEffect.exitVoid)
}

const scheduleReleaseTaker = <A, E>(self: Queue<A, E>) => {
  if (self.scheduleRunning || self.state._tag === "Done" || self.state.takers.size === 0) {
    return
  }
  self.scheduleRunning = true
  self.scheduler.scheduleTask(() => releaseTaker(self), 0)
}

const unsafeTakeBetween = <A, E>(
  self: Dequeue<A, E>,
  min: number,
  max: number
): Exit<readonly [messages: Array<A>, done: boolean], E> | undefined => {
  if (self.state._tag === "Done") {
    return internalEffect.exitAs(self.state.exit, constDone)
  } else if (max <= 0 || min <= 0) {
    return core.exitSucceed([empty, false])
  } else if (self.capacity <= 0 && self.state.offers.size > 0) {
    self.capacity = 1
    releaseCapacity(self)
    self.capacity = 0
    const messages = [MutableList.take(self.messages)!]
    const released = releaseCapacity(self)
    return core.exitSucceed([messages, released])
  }
  min = Math.min(min, self.capacity)
  if (min <= self.messages.length) {
    return core.exitSucceed([MutableList.takeN(self.messages, max), releaseCapacity(self)])
  }
}

const offerRemainingSingle = <A, E>(self: Queue<A, E>, message: A) => {
  return internalEffect.callback<boolean>((resume) => {
    if (self.state._tag !== "Open") {
      return resume(exitFalse)
    }
    const entry: Queue.OfferEntry<A> = { _tag: "Single", message, resume }
    self.state.offers.add(entry)
    return internalEffect.sync(() => {
      if (self.state._tag === "Open") {
        self.state.offers.delete(entry)
      }
    })
  })
}

const offerRemainingArray = <A, E>(self: Queue<A, E>, remaining: Array<A>) => {
  return internalEffect.callback<Array<A>>((resume) => {
    if (self.state._tag !== "Open") {
      return resume(core.exitSucceed(remaining))
    }
    const entry: Queue.OfferEntry<A> = {
      _tag: "Array",
      remaining,
      offset: 0,
      resume
    }
    self.state.offers.add(entry)
    return internalEffect.sync(() => {
      if (self.state._tag === "Open") {
        self.state.offers.delete(entry)
      }
    })
  })
}

const releaseCapacity = <A, E>(self: Dequeue<A, E>): boolean => {
  if (self.state._tag === "Done") {
    return self.state.exit._tag === "Success"
  } else if (self.state.offers.size === 0) {
    if (
      self.state._tag === "Closing" &&
      self.messages.length === 0
    ) {
      finalize(self, self.state.exit)
      return self.state.exit._tag === "Success"
    }
    return false
  }
  let n = self.capacity - self.messages.length
  for (const entry of self.state.offers) {
    if (n === 0) break
    else if (entry._tag === "Single") {
      MutableList.append(self.messages, entry.message)
      n--
      entry.resume(exitTrue)
      self.state.offers.delete(entry)
    } else {
      for (; entry.offset < entry.remaining.length; entry.offset++) {
        if (n === 0) return false
        MutableList.append(self.messages, entry.remaining[entry.offset])
        n--
      }
      entry.resume(exitEmpty)
      self.state.offers.delete(entry)
    }
  }
  return false
}

const awaitTake = <A, E>(self: Dequeue<A, E>) =>
  internalEffect.callback<void, E>((resume) => {
    if (self.state._tag === "Done") {
      return resume(self.state.exit)
    }
    self.state.takers.add(resume)
    return internalEffect.sync(() => {
      if (self.state._tag !== "Done") {
        self.state.takers.delete(resume)
      }
    })
  })

const awaitTakeOption = <A, E>(self: Dequeue<A, E>) => internalEffect.mapError(awaitTake(self), Option.some)

const unsafeTakeAll = <A, E>(self: Dequeue<A, E>) => {
  if (self.messages.length > 0) {
    const messages = MutableList.takeAll(self.messages)
    releaseCapacity(self)
    return messages
  } else if (self.state._tag !== "Done" && self.state.offers.size > 0) {
    self.capacity = 1
    releaseCapacity(self)
    self.capacity = 0
    const messages = [MutableList.take(self.messages)!]
    releaseCapacity(self)
    return messages
  }
  return empty
}

const finalize = <A, E>(self: Dequeue<A, E>, exit: Exit<void, E>) => {
  if (self.state._tag === "Done") {
    return
  }
  const openState = self.state
  self.state = { _tag: "Done", exit }
  for (const taker of openState.takers) {
    taker(exit)
  }
  openState.takers.clear()
  for (const awaiter of openState.awaiters) {
    awaiter(exit)
  }
  openState.awaiters.clear()
}
