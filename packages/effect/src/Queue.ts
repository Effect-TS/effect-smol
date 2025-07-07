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
import * as Pull from "./Pull.js"
import type { Scheduler } from "./Scheduler.js"
import type * as Types from "./Types.js"

/**
 * The type identifier for Queue values.
 *
 * @example
 * ```ts
 * import { Queue } from "effect"
 *
 * // Check if a value is a Queue by using the TypeId
 * console.log(Queue.TypeId) // "~effect/Queue"
 * ```
 *
 * @since 3.8.0
 * @category type ids
 */
export const TypeId: TypeId = "~effect/Queue"

/**
 * The type-level identifier for Queue values.
 *
 * @example
 * ```ts
 * import { Queue } from "effect"
 *
 * // The TypeId is used internally for type checking
 * const checkTypeId = (id: Queue.TypeId) => {
 *   console.log(id) // "~effect/Queue"
 * }
 * ```
 *
 * @since 3.8.0
 * @category type ids
 */
export type TypeId = "~effect/Queue"

/**
 * The type identifier for Dequeue values.
 *
 * @example
 * ```ts
 * import { Queue } from "effect"
 *
 * // Check the Dequeue TypeId
 * console.log(Queue.DequeueTypeId) // "~effect/Queue/Dequeue"
 * ```
 *
 * @since 3.8.0
 * @category type ids
 */
export const DequeueTypeId: DequeueTypeId = "~effect/Queue/Dequeue"

/**
 * The type-level identifier for Dequeue values.
 *
 * @example
 * ```ts
 * import { Queue } from "effect"
 *
 * // The DequeueTypeId is used internally for type checking
 * const checkDequeueTypeId = (id: Queue.DequeueTypeId) => {
 *   console.log(id) // "~effect/Queue/Dequeue"
 * }
 * ```
 *
 * @since 3.8.0
 * @category type ids
 */
export type DequeueTypeId = "~effect/Queue/Dequeue"

/**
 * Type guard to check if a value is a Queue.
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(10)
 *   const notQueue = { value: 42 }
 *
 *   console.log(Queue.isQueue(queue))    // true
 *   console.log(Queue.isQueue(notQueue)) // false
 * })
 * ```
 *
 * @since 3.8.0
 * @category guards
 */
export const isQueue = <A = unknown, E = unknown>(
  u: unknown
): u is Queue<A, E> => hasProperty(u, TypeId)

/**
 * A `Dequeue` is a queue that can be taken from.
 *
 * This interface represents the read-only part of a Queue, allowing you to take
 * elements from the queue but not offer elements to it.
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<string>(10)
 *
 *   // A Dequeue can only take elements
 *   const dequeue: Queue.Dequeue<string> = queue
 *
 *   // Pre-populate the queue
 *   yield* Queue.offerAll(queue, ["a", "b", "c"])
 *
 *   // Take elements using dequeue interface
 *   const item = yield* Queue.take(dequeue)
 *   console.log(item) // "a"
 * })
 * ```
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
 * The Dequeue namespace containing type definitions and utilities.
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<string>(10)
 *
 *   // Use Dequeue namespace types
 *   const processDequeue = (deq: Queue.Dequeue<string>) =>
 *     Queue.take(deq)
 *
 *   const result = yield* processDequeue(queue)
 * })
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export declare namespace Dequeue {
  /**
   * Variance interface for Dequeue types, defining the type parameter constraints.
   *
   * @example
   * ```ts
   * import { Effect, Queue } from "effect"
   *
   * // Dequeue variance is covariant in both A and E
   * const program = Effect.gen(function*() {
   *   const stringQueue = yield* Queue.bounded<string>(10)
   *
   *   // Covariant in A - can treat Dequeue<string> as Dequeue<unknown>
   *   const unknownDequeue: Queue.Dequeue<unknown> = stringQueue
   * })
   * ```
   *
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
 * It also supports signaling that it is done or failed. Queues provide
 * thread-safe operations for concurrent producer-consumer scenarios.
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // Create a bounded queue
 *   const queue = yield* Queue.bounded<string>(10)
 *
 *   // Producer: offer items to the queue
 *   yield* Queue.offer(queue, "hello")
 *   yield* Queue.offerAll(queue, ["world", "!"])
 *
 *   // Consumer: take items from the queue
 *   const item1 = yield* Queue.take(queue)
 *   const item2 = yield* Queue.take(queue)
 *   const item3 = yield* Queue.take(queue)
 *
 *   console.log([item1, item2, item3]) // ["hello", "world", "!"]
 * })
 * ```
 *
 * @since 3.8.0
 * @category models
 */
export interface Queue<in out A, in out E = never> extends Dequeue<A, E> {
  readonly [TypeId]: Queue.Variance<A, E>
}

/**
 * The Queue namespace containing type definitions and utilities.
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // Create different types of queues
 *   const bounded = yield* Queue.bounded<number>(10)
 *   const unbounded = yield* Queue.unbounded<string>()
 *
 *   // Use Queue types in function signatures
 *   const processQueue = (q: Queue.Queue<number>) =>
 *     Effect.gen(function*() {
 *       yield* Queue.offer(q, 42)
 *       return yield* Queue.take(q)
 *     })
 *
 *   // Process the bounded queue
 *   const result = yield* processQueue(bounded)
 *   console.log(result) // 42
 * })
 * ```
 *
 * @since 3.8.0
 * @category models
 */
export declare namespace Queue {
  /**
   * Variance interface for Queue types, defining the type parameter constraints.
   *
   * @example
   * ```ts
   * import { Effect, Queue } from "effect"
   *
   * // Queue variance is invariant in both A and E
   * const program = Effect.gen(function*() {
   *   const numberQueue = yield* Queue.bounded<number>(10)
   *
   *   // Invariant in A - Queue<number> is exactly Queue<number>
   *   // Cannot be treated as Queue<unknown> or Queue<any>
   *   const processNumbers = (q: Queue.Queue<number>) =>
   *     Effect.gen(function*() {
   *       yield* Queue.offer(q, 42)
   *       return yield* Queue.take(q)
   *     })
   * })
   * ```
   *
   * @since 3.8.0
   * @category models
   */
  export interface Variance<A, E> {
    _A: Types.Invariant<A>
    _E: Types.Invariant<E>
  }

  /**
   * Represents the internal state of a Queue.
   *
   * @example
   * ```ts
   * import { Effect, Queue } from "effect"
   *
   * const program = Effect.gen(function*() {
   *   const queue = yield* Queue.bounded<number>(10)
   *
   *   // The queue starts in "Open" state
   *   // You can check queue state through inspection
   *   console.log(queue.state._tag) // "Open"
   *
   *   // After calling end(), queue moves to "Closing" then "Done"
   *   yield* Queue.end(queue)
   * })
   * ```
   *
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
   * Represents an entry in the queue's offer buffer.
   *
   * @example
   * ```ts
   * import { Effect, Queue } from "effect"
   *
   * const program = Effect.gen(function*() {
   *   const queue = yield* Queue.bounded<number>(1) // Small capacity
   *
   *   // When queue is full, offers create OfferEntry objects
   *   // internally to track pending offers
   *   yield* Queue.offer(queue, 1) // Goes directly to queue
   *
   *   // This offer will create an OfferEntry since queue is full
   *   const offerEffect = Queue.offer(queue, 2)
   *
   *   // Take an item to make room
   *   const taken = yield* Queue.take(queue)
   *   console.log(taken) // 1
   *
   *   // Now the pending offer can complete
   *   yield* offerEffect
   * })
   * ```
   *
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
 * Creates an unbounded queue that can grow to any size without blocking producers.
 *
 * Unlike bounded queues, unbounded queues never apply backpressure - producers
 * can always add messages successfully. This is useful when you want to prioritize
 * producer throughput over memory usage control.
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.unbounded<string>()
 *
 *   // Producers can always add messages without blocking
 *   yield* Queue.offer(queue, "message1")
 *   yield* Queue.offer(queue, "message2")
 *   yield* Queue.offerAll(queue, ["message3", "message4", "message5"])
 *
 *   // Check current size
 *   const size = yield* Queue.size(queue)
 *   console.log(size) // Some(5)
 *
 *   // Take all messages
 *   const [messages, done] = yield* Queue.takeAll(queue)
 *   console.log(messages) // ["message1", "message2", "message3", "message4", "message5"]
 *   console.log(done) // false
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const unbounded = <A, E = never>(): Effect<Queue<A, E>> => make()

/**
 * Add a message to the queue. Returns `false` if the queue is done.
 *
 * For bounded queues, this operation may suspend if the queue is at capacity,
 * depending on the backpressure strategy. For dropping/sliding queues, it may
 * return false or succeed immediately by dropping/sliding existing messages.
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(3)
 *
 *   // Successfully add messages to queue
 *   const success1 = yield* Queue.offer(queue, 1)
 *   const success2 = yield* Queue.offer(queue, 2)
 *   console.log(success1, success2) // true, true
 *
 *   // Queue state
 *   const size = yield* Queue.size(queue)
 *   console.log(size) // Some(2)
 *
 *   // End the queue
 *   yield* Queue.end(queue)
 *
 *   // Offer fails after queue is done
 *   const success3 = yield* Queue.offer(queue, 3)
 *   console.log(success3) // false
 * })
 * ```
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
 * Add a message to the queue synchronously. Returns `false` if the queue is done.
 *
 * This is an unsafe operation that directly modifies the queue without Effect wrapping.
 * Use this only when you're certain about the synchronous nature of the operation.
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * // Create a queue effect and extract the queue for unsafe operations
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(3)
 *
 *   // Add messages synchronously using unsafe API
 *   const success1 = Queue.unsafeOffer(queue, 1)
 *   const success2 = Queue.unsafeOffer(queue, 2)
 *   console.log(success1, success2) // true, true
 *
 *   // Check current size
 *   const size = Queue.unsafeSize(queue)
 *   console.log(size) // Some(2)
 * })
 * ```
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
 * For bounded queues, this operation may suspend if the queue doesn't have
 * enough capacity. The operation returns an array of messages that couldn't
 * be added (empty array means all messages were successfully added).
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(3)
 *
 *   // Try to add more messages than capacity
 *   const remaining1 = yield* Queue.offerAll(queue, [1, 2, 3, 4, 5])
 *   console.log(remaining1) // [4, 5] - couldn't fit the last 2
 *
 *   // Check what's in the queue
 *   const [messages] = yield* Queue.takeAll(queue)
 *   console.log(messages) // [1, 2, 3]
 *
 *   // Try adding to empty queue
 *   const remaining2 = yield* Queue.offerAll(queue, [10, 20])
 *   console.log(remaining2) // [] - all messages added successfully
 * })
 * ```
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
 * Add multiple messages to the queue synchronously. Returns the remaining messages that
 * were not added.
 *
 * This is an unsafe operation that directly modifies the queue without Effect wrapping.
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * // Create a bounded queue and use unsafe API
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(3)
 *
 *   // Try to add 5 messages to capacity-3 queue using unsafe API
 *   const remaining = Queue.unsafeOfferAll(queue, [1, 2, 3, 4, 5])
 *   console.log(remaining) // [4, 5] - couldn't fit the last 2
 *
 *   // Check what's in the queue
 *   const size = Queue.unsafeSize(queue)
 *   console.log(size) // Some(3)
 * })
 * ```
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
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number, string>(10)
 *
 *   // Add some messages
 *   yield* Queue.offer(queue, 1)
 *   yield* Queue.offer(queue, 2)
 *
 *   // Fail the queue with an error
 *   const failed = yield* Queue.fail(queue, "Something went wrong")
 *   console.log(failed) // true
 *
 *   // Subsequent operations will reflect the failure
 *   // Taking from failed queue will fail with the error
 * })
 * ```
 *
 * @category completion
 * @since 4.0.0
 */
export const fail = <A, E>(self: Queue<A, E>, error: E) => done(self, core.exitFail(error))

/**
 * Fail the queue with a cause. If the queue is already done, `false` is
 * returned.
 *
 * @example
 * ```ts
 * import { Effect, Queue, Cause } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number, string>(10)
 *
 *   // Add some messages
 *   yield* Queue.offer(queue, 1)
 *
 *   // Create a cause and fail the queue
 *   const cause = Cause.fail("Queue processing failed")
 *   const failed = yield* Queue.failCause(queue, cause)
 *   console.log(failed) // true
 *
 *   // The queue is now in failed state with the specified cause
 * })
 * ```
 *
 * @category completion
 * @since 4.0.0
 */
export const failCause = <A, E>(self: Queue<A, E>, cause: Cause<E>) => done(self, core.exitFailCause(cause))

/**
 * Signal that the queue is complete. If the queue is already done, `false` is
 * returned.
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(10)
 *
 *   // Add some messages
 *   yield* Queue.offer(queue, 1)
 *   yield* Queue.offer(queue, 2)
 *
 *   // Signal completion - no more messages will be accepted
 *   const ended = yield* Queue.end(queue)
 *   console.log(ended) // true
 *
 *   // Trying to offer more messages will return false
 *   const offerResult = yield* Queue.offer(queue, 3)
 *   console.log(offerResult) // false
 *
 *   // But we can still take existing messages
 *   const message = yield* Queue.take(queue)
 *   console.log(message) // 1
 * })
 * ```
 *
 * @category completion
 * @since 4.0.0
 */
export const end = <A, E>(self: Queue<A, E>): Effect<boolean> => done(self, internalEffect.exitVoid)

/**
 * Signal that the queue is complete synchronously. If the queue is already done, `false` is
 * returned.
 *
 * This is an unsafe operation that directly modifies the queue without Effect wrapping.
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * // Create a queue and use unsafe operations
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(10)
 *
 *   // Add some messages
 *   Queue.unsafeOffer(queue, 1)
 *   Queue.unsafeOffer(queue, 2)
 *
 *   // End the queue synchronously
 *   const ended = Queue.unsafeEnd(queue)
 *   console.log(ended) // true
 *
 *   // The queue is now done
 *   console.log(queue.state._tag) // "Done"
 * })
 * ```
 *
 * @category completion
 * @since 4.0.0
 */
export const unsafeEnd = <A, E>(self: Queue<A, E>) => unsafeDone(self, internalEffect.exitVoid)

/**
 * Signal that the queue is done with a specific exit value. If the queue is already done, `false` is
 * returned.
 *
 * @example
 * ```ts
 * import { Effect, Queue, Exit } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(10)
 *
 *   // Add some messages
 *   yield* Queue.offer(queue, 1)
 *   yield* Queue.offer(queue, 2)
 *
 *   // Create a success exit and mark queue as done
 *   const successExit = Exit.succeed(undefined)
 *   const isDone = yield* Queue.done(queue, successExit)
 *   console.log(isDone) // true
 *
 *   // Or create a failure exit
 *   const failureExit = Exit.fail("Processing error")
 *   const queue2 = yield* Queue.bounded<number, string>(10)
 *   const isDone2 = yield* Queue.done(queue2, failureExit)
 *   console.log(isDone2) // true
 * })
 * ```
 *
 * @category completion
 * @since 4.0.0
 */
export const done = <A, E>(self: Queue<A, E>, exit: Exit<void, E>): Effect<boolean> =>
  internalEffect.sync(() => unsafeDone(self, exit))

/**
 * Signal that the queue is done synchronously with a specific exit value. If the queue is already done, `false` is
 * returned.
 *
 * This is an unsafe operation that directly modifies the queue without Effect wrapping.
 *
 * @example
 * ```ts
 * import { Effect, Queue, Exit } from "effect"
 *
 * // Create a queue and use unsafe operations
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(10)
 *
 *   // Add some messages
 *   Queue.unsafeOffer(queue, 1)
 *   Queue.unsafeOffer(queue, 2)
 *
 *   // Mark as done with success exit
 *   const successExit = Exit.succeed(undefined)
 *   const isDone = Queue.unsafeDone(queue, successExit)
 *   console.log(isDone) // true
 *   console.log(queue.state._tag) // "Done"
 * })
 * ```
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
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(2)
 *
 *   // Add messages
 *   yield* Queue.offer(queue, 1)
 *   yield* Queue.offer(queue, 2)
 *
 *   // Try to add more than capacity (will be pending)
 *   const pendingOffer = Queue.offer(queue, 3)
 *
 *   // Shutdown cancels pending operations and clears the queue
 *   const wasShutdown = yield* Queue.shutdown(queue)
 *   console.log(wasShutdown) // true
 *
 *   // Queue is now done and cleared
 *   const size = yield* Queue.size(queue)
 *   console.log(size) // None
 * })
 * ```
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
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(10)
 *
 *   // Add several messages
 *   yield* Queue.offerAll(queue, [1, 2, 3, 4, 5])
 *
 *   // Clear all messages from the queue
 *   const messages = yield* Queue.clear(queue)
 *   console.log(messages) // [1, 2, 3, 4, 5]
 *
 *   // Queue is now empty
 *   const size = yield* Queue.size(queue)
 *   console.log(size) // Some(0)
 *
 *   // Clearing empty queue returns empty array
 *   const empty = yield* Queue.clear(queue)
 *   console.log(empty) // []
 * })
 * ```
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

export {
  /**
   * @category Done
   * @since 4.0.0
   */
  Done,
  /**
   * @category Done
   * @since 4.0.0
   */
  filterDone,
  /**
   * @category Done
   * @since 4.0.0
   */
  isDone
} from "./Pull.js"

/**
 * Take all messages from the queue, or wait for messages to be available.
 *
 * If the queue is done, the `done` flag will be `true`. If the queue
 * fails, the Effect will fail with the error.
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(5)
 *
 *   // Add several messages
 *   yield* Queue.offerAll(queue, [1, 2, 3, 4, 5])
 *
 *   // Take all available messages
 *   const [messages1, done1] = yield* Queue.takeAll(queue)
 *   console.log(messages1) // [1, 2, 3, 4, 5]
 *   console.log(done1) // false
 *
 *   // Add more messages and end the queue
 *   yield* Queue.offerAll(queue, [10, 20])
 *   yield* Queue.end(queue)
 *
 *   // Take remaining messages, done flag indicates completion
 *   const [messages2, done2] = yield* Queue.takeAll(queue)
 *   console.log(messages2) // [10, 20]
 *   console.log(done2) // true
 * })
 * ```
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
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(10)
 *
 *   // Add several messages
 *   yield* Queue.offerAll(queue, [1, 2, 3, 4, 5, 6, 7])
 *
 *   // Take exactly 3 messages
 *   const [first3, done1] = yield* Queue.takeN(queue, 3)
 *   console.log(first3) // [1, 2, 3]
 *   console.log(done1) // false
 *
 *   // Take exactly 2 more messages
 *   const [next2, done2] = yield* Queue.takeN(queue, 2)
 *   console.log(next2) // [4, 5]
 *   console.log(done2) // false
 *
 *   // Take remaining messages (will take 2, even though we asked for 5)
 *   const [remaining, done3] = yield* Queue.takeN(queue, 5)
 *   console.log(remaining) // [6, 7]
 *   console.log(done3) // false
 * })
 * ```
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
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(10)
 *
 *   // Add several messages
 *   yield* Queue.offerAll(queue, [1, 2, 3, 4, 5, 6, 7, 8])
 *
 *   // Take between 2 and 5 messages
 *   const [batch1, done1] = yield* Queue.takeBetween(queue, 2, 5)
 *   console.log(batch1) // [1, 2, 3, 4, 5] - took 5 (up to max)
 *   console.log(done1) // false
 *
 *   // Take between 1 and 10 messages (but only 3 remain)
 *   const [batch2, done2] = yield* Queue.takeBetween(queue, 1, 10)
 *   console.log(batch2) // [6, 7, 8] - took 3 (all remaining)
 *   console.log(done2) // false
 *
 *   // No more messages available, will wait or return done
 *   // const [batch3, done3] = yield* Queue.takeBetween(queue, 1, 3)
 * })
 * ```
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
 * If the queue is done, it will fail with `Done`. If the
 * queue fails, the Effect will fail with the error.
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<string>(3)
 *
 *   // Add some messages
 *   yield* Queue.offer(queue, "first")
 *   yield* Queue.offer(queue, "second")
 *
 *   // Take messages one by one
 *   const msg1 = yield* Queue.take(queue)
 *   const msg2 = yield* Queue.take(queue)
 *   console.log(msg1, msg2) // "first", "second"
 *
 *   // End the queue
 *   yield* Queue.end(queue)
 *
 *   // Taking from ended queue fails with None
 *   const result = yield* Effect.match(Queue.take(queue), {
 *     onFailure: (error: Queue.Done) => true,
 *     onSuccess: (value: string) => false
 *   })
 *   console.log("Queue ended:", result) // true
 * })
 * ```
 *
 * @category taking
 * @since 4.0.0
 */
export const take = <A, E>(self: Dequeue<A, E>): Effect<A, E | Pull.Done> =>
  internalEffect.suspend(
    () => unsafeTake(self) ?? internalEffect.andThen(awaitTake(self), take(self))
  )

/**
 * Take a single message from the queue synchronously, or wait for a message to be
 * available.
 *
 * If the queue is done, it will fail with `Done`. If the
 * queue fails, the Effect will fail with the error.
 * Returns `undefined` if no message is immediately available.
 *
 * This is an unsafe operation that directly accesses the queue without Effect wrapping.
 *
 * @example
 * ```ts
 * import { Effect, Queue, Exit } from "effect"
 *
 * // Create a queue and use unsafe operations
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(10)
 *
 *   // Add some messages
 *   Queue.unsafeOffer(queue, 1)
 *   Queue.unsafeOffer(queue, 2)
 *
 *   // Take a message synchronously
 *   const result1 = Queue.unsafeTake(queue)
 *   console.log(result1) // Success(1) or Exit containing value 1
 *
 *   const result2 = Queue.unsafeTake(queue)
 *   console.log(result2) // Success(2)
 *
 *   // No more messages - returns undefined
 *   const result3 = Queue.unsafeTake(queue)
 *   console.log(result3) // undefined
 * })
 * ```
 *
 * @category taking
 * @since 4.0.0
 */
export const unsafeTake = <A, E>(self: Dequeue<A, E>): Exit<A, E | Pull.Done> | undefined => {
  if (self.state._tag === "Done") {
    const exit = self.state.exit
    if (exit._tag === "Success") return exitFailDone
    const fail = exit.cause.failures.find((_) => _._tag === "Fail")
    return fail ? core.exitFail(fail.error) : (exit as any)
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
 * @example
 * ```ts
 * import { Effect, Queue, Option } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(10)
 *
 *   // Check size of empty queue
 *   const size1 = yield* Queue.size(queue)
 *   console.log(size1) // Some(0)
 *
 *   // Add some messages
 *   yield* Queue.offerAll(queue, [1, 2, 3, 4, 5])
 *
 *   // Check size after adding messages
 *   const size2 = yield* Queue.size(queue)
 *   console.log(size2) // Some(5)
 *
 *   // End the queue
 *   yield* Queue.end(queue)
 *
 *   // Size of ended queue is None
 *   const size3 = yield* Queue.size(queue)
 *   console.log(Option.isNone(size3)) // true
 * })
 * ```
 *
 * @category size
 * @since 4.0.0
 */
export const size = <A, E>(self: Dequeue<A, E>): Effect<Option.Option<number>> =>
  internalEffect.sync(() => unsafeSize(self))

/**
 * Check the size of the queue synchronously.
 *
 * If the queue is complete, it will return `None`.
 * This is an unsafe operation that directly accesses the queue without Effect wrapping.
 *
 * @example
 * ```ts
 * import { Effect, Queue, Option } from "effect"
 *
 * // Create a queue and use unsafe operations
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(10)
 *
 *   // Check size of empty queue
 *   const size1 = Queue.unsafeSize(queue)
 *   console.log(Option.getOrElse(size1, () => -1)) // 0
 *
 *   // Add some messages
 *   Queue.unsafeOffer(queue, 1)
 *   Queue.unsafeOffer(queue, 2)
 *   Queue.unsafeOffer(queue, 3)
 *
 *   // Check size after adding messages
 *   const size2 = Queue.unsafeSize(queue)
 *   console.log(Option.getOrElse(size2, () => -1)) // 3
 *
 *   // End the queue
 *   Queue.unsafeEnd(queue)
 *
 *   // Size of ended queue is None
 *   const size3 = Queue.unsafeSize(queue)
 *   console.log(Option.isNone(size3)) // true
 * })
 * ```
 *
 * @category size
 * @since 4.0.0
 */
export const unsafeSize = <A, E>(self: Dequeue<A, E>): Option.Option<number> =>
  self.state._tag === "Done" ? Option.none() : Option.some(self.messages.length)

/**
 * Convert a Queue to a Dequeue, allowing only read operations.
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(10)
 *
 *   // Convert to dequeue (read-only interface)
 *   const dequeue = Queue.asDequeue(queue)
 *
 *   // Add messages using the full queue
 *   yield* Queue.offer(queue, 1)
 *   yield* Queue.offer(queue, 2)
 *
 *   // Take messages using the dequeue interface
 *   const message1 = yield* Queue.take(dequeue)
 *   const message2 = yield* Queue.take(dequeue)
 *
 *   console.log(message1, message2) // 1, 2
 *
 *   // Can't offer through dequeue - only take operations
 *   // Queue.offer(dequeue, 3) // TypeScript error
 * })
 * ```
 *
 * @since 4.0.0
 * @category conversions
 */
export const asDequeue: <A, E>(self: Queue<A, E>) => Dequeue<A, E> = identity

/**
 * Run an `Effect` into a `Queue`, where success ends the queue and failure
 * fails the queue.
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(10)
 *
 *   // Create an effect that succeeds
 *   const dataProcessing = Effect.gen(function*() {
 *     yield* Effect.sleep("100 millis")
 *     return "Processing completed successfully"
 *   })
 *
 *   // Pipe the effect into the queue
 *   // If dataProcessing succeeds, queue ends successfully
 *   // If dataProcessing fails, queue fails with the error
 *   const effectIntoQueue = Queue.into(queue)(dataProcessing)
 *
 *   const wasCompleted = yield* effectIntoQueue
 *   console.log("Queue operation completed:", wasCompleted) // true
 *
 *   // Queue state now reflects the effect's outcome
 *   console.log("Queue state:", queue.state._tag) // "Done"
 * })
 * ```
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

/**
 * Creates a Pull from a queue that takes individual values.
 *
 * @example
 * ```ts
 * import { Queue, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* Queue.bounded<number, string>(10)
 *   const pull = Queue.toPull(queue)
 *
 *   // The pull will take values from the queue
 *   // and halt when the queue is closed
 * })
 * ```
 *
 * @since 4.0.0
 * @category Queue
 */
export const toPull: <A, E, L = void>(self: Dequeue<A, E>) => Pull.Pull<A, E, L> = take as any

/**
 * Creates a Pull from a queue that takes all available values as an array.
 *
 * @example
 * ```ts
 * import { Queue, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* Queue.bounded<number, string>(10)
 *   const pull = Queue.toPullArray(queue)
 *
 *   // The pull will take all available values from the queue
 *   // as a non-empty array, or halt if no values are available
 * })
 * ```
 *
 * @since 4.0.0
 * @category Queue
 */
export const toPullArray = <A, E>(self: Dequeue<A, E>): Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E> =>
  internalEffect.flatMap(
    takeAll(self),
    ([values]) => Arr.isNonEmptyReadonlyArray(values) ? internalEffect.succeed(values) : Pull.haltVoid
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
const exitFailDone = core.exitFail(Pull.done)

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
