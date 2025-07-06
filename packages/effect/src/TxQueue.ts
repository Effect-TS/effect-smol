/**
 * TxQueue is a transactional queue data structure that provides Software Transactional Memory (STM)
 * semantics for queue operations. It uses TxRef for transactional state management and supports
 * multiple queue strategies: bounded, unbounded, dropping, and sliding.
 *
 * Accessed values are tracked by the transaction in order to detect conflicts and to track changes.
 * A transaction will retry whenever a conflict is detected or whenever the transaction explicitly
 * calls `Effect.retryTransaction` and any of the accessed TxQueue values change.
 *
 * @since 4.0.0
 */
import * as Chunk from "./Chunk.js"
import * as Effect from "./Effect.js"
import { dual } from "./Function.js"
import type { Inspectable } from "./Inspectable.js"
import { format, NodeInspectSymbol, toJSON } from "./Inspectable.js"
import * as Option from "./Option.js"
import { hasProperty } from "./Predicate.js"
import * as TxChunk from "./TxChunk.js"
import * as TxRef from "./TxRef.js"
import type * as Types from "./Types.js"

/**
 * Unique identifier for TxDequeue instances.
 *
 * @example
 * ```ts
 * import { TxQueue } from "effect"
 *
 * // Access the DequeueTypeId for runtime type checking
 * declare const dequeue: TxQueue.TxDequeue<number>
 * console.log(dequeue[TxQueue.DequeueTypeId]) // "~effect/TxQueue/Dequeue"
 * ```
 *
 * @since 4.0.0
 * @category symbols
 */
export const DequeueTypeId: DequeueTypeId = "~effect/TxQueue/Dequeue"

/**
 * Type identifier for TxDequeue instances.
 *
 * @since 4.0.0
 * @category symbols
 */
export type DequeueTypeId = "~effect/TxQueue/Dequeue"

/**
 * Unique identifier for TxQueue instances.
 *
 * @example
 * ```ts
 * import { TxQueue } from "effect"
 *
 * // Access the TypeId for runtime type checking
 * declare const queue: TxQueue.TxQueue<number>
 * console.log(queue[TxQueue.TypeId]) // "~effect/TxQueue"
 * ```
 *
 * @since 4.0.0
 * @category symbols
 */
export const TypeId: TypeId = "~effect/TxQueue"

/**
 * Type identifier for TxQueue instances.
 *
 * @since 4.0.0
 * @category symbols
 */
export type TypeId = "~effect/TxQueue"

/**
 * @since 4.0.0
 * @category models
 */
export declare namespace TxDequeue {
  /**
   * @since 4.0.0
   * @category models
   */
  export interface Variance<out A> {
    readonly _A: Types.Covariant<A>
  }
}

/**
 * @since 4.0.0
 * @category models
 */
export declare namespace TxQueue {
  /**
   * @since 4.0.0
   * @category models
   */
  export interface Variance<in out A> {
    readonly _A: Types.Invariant<A>
  }
}

/**
 * A TxDequeue represents the read-only interface of a transactional queue, providing
 * operations for consuming elements (dequeue operations) and inspecting queue state.
 *
 * @example
 * ```ts
 * import { TxQueue, Effect, Chunk } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* TxQueue.bounded<number>(10)
 *
 *   // TxDequeue operations (read-only)
 *   const dequeue: TxQueue.TxDequeue<number> = queue
 *   const item = yield* TxQueue.take(dequeue)
 *   const size = yield* TxQueue.size(dequeue)
 *   const isEmpty = yield* TxQueue.isEmpty(dequeue)
 * })
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface TxDequeue<out A> extends Inspectable {
  readonly [DequeueTypeId]: TxDequeue.Variance<A>
  readonly strategy: "bounded" | "unbounded" | "dropping" | "sliding"
  readonly capacity: number
  readonly items: TxChunk.TxChunk<any>
  readonly shutdownRef: TxRef.TxRef<boolean>
}

/**
 * A TxQueue represents a transactional queue data structure that provides both
 * enqueue and dequeue operations with Software Transactional Memory (STM) semantics.
 *
 * @example
 * ```ts
 * import { TxQueue, Effect, Chunk } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   // Create a bounded transactional queue
 *   const queue = yield* TxQueue.bounded<number>(10)
 *
 *   // Single operations - automatically transactional
 *   const accepted = yield* TxQueue.offer(queue, 42)
 *   const item = yield* TxQueue.take(queue)
 *   console.log(item) // 42
 *
 *   // Multi-step atomic operations
 *   yield* Effect.transaction(
 *     Effect.gen(function* () {
 *       yield* TxQueue.offer(queue, 1)
 *       yield* TxQueue.offer(queue, 2)
 *       yield* TxQueue.offer(queue, 3)
 *     })
 *   )
 * })
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface TxQueue<in out A> extends TxDequeue<A> {
  readonly [TypeId]: TxQueue.Variance<A>
}

/**
 * Checks if the given value is a TxDequeue.
 *
 * @example
 * ```ts
 * import { TxQueue } from "effect"
 *
 * const dequeue = // ... some value
 * if (TxQueue.isTxDequeue(dequeue)) {
 *   // dequeue is now typed as TxDequeue<unknown>
 *   console.log("This is a TxDequeue")
 * }
 * ```
 *
 * @since 4.0.0
 * @category guards
 */
export const isTxDequeue = <A = unknown>(u: unknown): u is TxDequeue<A> => hasProperty(u, DequeueTypeId)

/**
 * Checks if the given value is a TxQueue.
 *
 * @example
 * ```ts
 * import { TxQueue } from "effect"
 *
 * const queue = // ... some value
 * if (TxQueue.isTxQueue(queue)) {
 *   // queue is now typed as TxQueue<unknown>
 *   console.log("This is a TxQueue")
 * }
 * ```
 *
 * @since 4.0.0
 * @category guards
 */
export const isTxQueue = <A = unknown>(u: unknown): u is TxQueue<A> => hasProperty(u, TypeId)

// =============================================================================
// Proto
// =============================================================================

const TxQueueProto = {
  [DequeueTypeId]: { _A: (_: never) => _ },
  [TypeId]: { _A: (_: never) => _ },
  [NodeInspectSymbol](this: TxQueue<unknown>) {
    return toJSON(this)
  },
  toJSON(this: TxQueue<unknown>) {
    return {
      _id: "TxQueue",
      strategy: this.strategy,
      capacity: this.capacity
    }
  },
  toString(this: TxQueue<unknown>) {
    return format(this.toJSON())
  }
}

// =============================================================================
// Constructors
// =============================================================================

/**
 * Creates a new bounded `TxQueue` with the specified capacity.
 *
 * **Return behavior**: This function returns a new TxQueue reference with
 * the specified capacity. No existing TxQueue instances are modified.
 *
 * @example
 * ```ts
 * import { TxQueue, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   // Create a bounded queue that can hold up to 10 items
 *   const queue = yield* TxQueue.bounded<number>(10)
 *
 *   // Offer items - will succeed until capacity is reached
 *   yield* TxQueue.offer(queue, 1)
 *   yield* TxQueue.offer(queue, 2)
 *
 *   const item = yield* TxQueue.take(queue)
 *   console.log(item) // 1
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const bounded = <A = never>(capacity: number): Effect.Effect<TxQueue<A>> =>
  Effect.gen(function*() {
    const items = yield* TxChunk.empty<A>()
    const shutdownRef = yield* TxRef.make(false)

    const txQueue = Object.create(TxQueueProto)
    txQueue.strategy = "bounded"
    txQueue.capacity = capacity
    txQueue.items = items
    txQueue.shutdownRef = shutdownRef
    return txQueue
  })

/**
 * Creates a new unbounded `TxQueue` with unlimited capacity.
 *
 * **Return behavior**: This function returns a new TxQueue reference with
 * unlimited capacity. No existing TxQueue instances are modified.
 *
 * @example
 * ```ts
 * import { TxQueue, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   // Create an unbounded queue (limited only by available memory)
 *   const queue = yield* TxQueue.unbounded<string>()
 *
 *   // Can offer unlimited items
 *   yield* TxQueue.offer(queue, "hello")
 *   yield* TxQueue.offer(queue, "world")
 *
 *   const size = yield* TxQueue.size(queue)
 *   console.log(size) // 2
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const unbounded = <A = never>(): Effect.Effect<TxQueue<A>> =>
  Effect.gen(function*() {
    const items = yield* TxChunk.empty<A>()
    const shutdownRef = yield* TxRef.make(false)

    const txQueue = Object.create(TxQueueProto)
    txQueue.strategy = "unbounded"
    txQueue.capacity = Number.POSITIVE_INFINITY
    txQueue.items = items
    txQueue.shutdownRef = shutdownRef
    return txQueue
  })

/**
 * Creates a new dropping `TxQueue` with the specified capacity that drops new items when full.
 *
 * **Return behavior**: This function returns a new TxQueue reference with
 * dropping strategy. No existing TxQueue instances are modified.
 *
 * @example
 * ```ts
 * import { TxQueue, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   // Create a dropping queue with capacity 2
 *   const queue = yield* TxQueue.dropping<number>(2)
 *
 *   // Fill to capacity
 *   yield* TxQueue.offer(queue, 1)
 *   yield* TxQueue.offer(queue, 2)
 *
 *   // This will be dropped (returns false)
 *   const accepted = yield* TxQueue.offer(queue, 3)
 *   console.log(accepted) // false
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const dropping = <A = never>(capacity: number): Effect.Effect<TxQueue<A>> =>
  Effect.gen(function*() {
    const items = yield* TxChunk.empty<A>()
    const shutdownRef = yield* TxRef.make(false)

    const txQueue = Object.create(TxQueueProto)
    txQueue.strategy = "dropping"
    txQueue.capacity = capacity
    txQueue.items = items
    txQueue.shutdownRef = shutdownRef
    return txQueue
  })

/**
 * Creates a new sliding `TxQueue` with the specified capacity that evicts old items when full.
 *
 * **Return behavior**: This function returns a new TxQueue reference with
 * sliding strategy. No existing TxQueue instances are modified.
 *
 * @example
 * ```ts
 * import { TxQueue, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   // Create a sliding queue with capacity 2
 *   const queue = yield* TxQueue.sliding<number>(2)
 *
 *   // Fill to capacity
 *   yield* TxQueue.offer(queue, 1)
 *   yield* TxQueue.offer(queue, 2)
 *
 *   // This will evict item 1 and add 3
 *   yield* TxQueue.offer(queue, 3)
 *
 *   const item = yield* TxQueue.take(queue)
 *   console.log(item) // 2 (item 1 was evicted)
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const sliding = <A = never>(capacity: number): Effect.Effect<TxQueue<A>> =>
  Effect.gen(function*() {
    const items = yield* TxChunk.empty<A>()
    const shutdownRef = yield* TxRef.make(false)

    const txQueue = Object.create(TxQueueProto)
    txQueue.strategy = "sliding"
    txQueue.capacity = capacity
    txQueue.items = items
    txQueue.shutdownRef = shutdownRef
    return txQueue
  })

// =============================================================================
// Core Queue Operations
// =============================================================================

/**
 * Offers an item to the queue.
 *
 * **Mutation behavior**: This function mutates the original TxQueue by adding
 * the item according to the queue's strategy. It does not return a new TxQueue reference.
 *
 * @example
 * ```ts
 * import { TxQueue, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* TxQueue.bounded<number>(10)
 *
 *   // Offer an item - returns true if accepted
 *   const accepted = yield* TxQueue.offer(queue, 42)
 *   console.log(accepted) // true
 * })
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const offer: {
  <A>(value: A): (self: TxQueue<A>) => Effect.Effect<boolean>
  <A>(self: TxQueue<A>, value: A): Effect.Effect<boolean>
} = dual(2, <A>(self: TxQueue<A>, value: A): Effect.Effect<boolean> =>
  Effect.transaction(
    Effect.gen(function*() {
      const isShutdown = yield* TxRef.get(self.shutdownRef)
      if (isShutdown) {
        return false
      }

      const currentSize = yield* TxChunk.size(self.items)

      // Unbounded - always accept
      if (self.strategy === "unbounded") {
        yield* TxChunk.append(self.items, value)
        return true
      }

      // For bounded queues, check capacity
      if (currentSize < self.capacity) {
        yield* TxChunk.append(self.items, value)
        return true
      }

      // Queue is at capacity, strategy-specific behavior
      if (self.strategy === "dropping") {
        return false // Drop the new item
      }

      if (self.strategy === "sliding") {
        yield* TxChunk.drop(self.items, 1) // Remove oldest item
        yield* TxChunk.append(self.items, value) // Add new item
        return true
      }

      // bounded strategy - block until space is available
      return yield* Effect.retryTransaction
    })
  ))

/**
 * Offers multiple items to the queue.
 *
 * **Mutation behavior**: This function mutates the original TxQueue by adding
 * items according to the queue's strategy. It does not return a new TxQueue reference.
 *
 * @example
 * ```ts
 * import { TxQueue, Effect, Chunk } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* TxQueue.bounded<number>(10)
 *
 *   // Offer multiple items - returns rejected items
 *   const rejected = yield* TxQueue.offerAll(queue, [1, 2, 3, 4, 5])
 *   console.log(Chunk.toReadonlyArray(rejected)) // [] if all accepted
 * })
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const offerAll: {
  <A>(values: Iterable<A>): (self: TxQueue<A>) => Effect.Effect<Chunk.Chunk<A>>
  <A>(self: TxQueue<A>, values: Iterable<A>): Effect.Effect<Chunk.Chunk<A>>
} = dual(2, <A>(self: TxQueue<A>, values: Iterable<A>): Effect.Effect<Chunk.Chunk<A>> =>
  Effect.gen(function*() {
    const rejected: Array<A> = []

    for (const value of values) {
      const accepted = yield* offer(self, value)
      if (!accepted) {
        rejected.push(value)
      }
    }

    return Chunk.fromIterable(rejected)
  }))

/**
 * Takes an item from the queue.
 *
 * **Mutation behavior**: This function mutates the original TxQueue by removing
 * the first item. It does not return a new TxQueue reference.
 *
 * @example
 * ```ts
 * import { TxQueue, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* TxQueue.bounded<number>(10)
 *   yield* TxQueue.offer(queue, 42)
 *
 *   // Take an item - blocks if empty
 *   const item = yield* TxQueue.take(queue)
 *   console.log(item) // 42
 * })
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const take = <A>(self: TxDequeue<A>): Effect.Effect<A> =>
  Effect.transaction(
    Effect.gen(function*() {
      const isShutdown = yield* TxRef.get(self.shutdownRef)
      if (isShutdown) {
        return yield* Effect.interrupt
      }

      const currentSize = yield* TxChunk.size(self.items)
      if (currentSize === 0) {
        return yield* Effect.retryTransaction
      }

      const chunk = yield* TxChunk.get(self.items)
      const head = Chunk.head(chunk)
      if (Option.isNone(head)) {
        return yield* Effect.retryTransaction
      }

      yield* TxChunk.drop(self.items, 1)
      return head.value
    })
  )

/**
 * Tries to take an item from the queue without blocking.
 *
 * @example
 * ```ts
 * import { TxQueue, Effect, Option } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* TxQueue.bounded<number>(10)
 *
 *   // Poll returns Option.none if empty
 *   const maybe = yield* TxQueue.poll(queue)
 *   console.log(Option.isNone(maybe)) // true
 *
 *   yield* TxQueue.offer(queue, 42)
 *   const item = yield* TxQueue.poll(queue)
 *   console.log(Option.getOrNull(item)) // 42
 * })
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const poll = <A>(self: TxDequeue<A>): Effect.Effect<Option.Option<A>> =>
  Effect.gen(function*() {
    const isShutdown = yield* TxRef.get(self.shutdownRef)
    if (isShutdown) {
      return Option.none()
    }

    const chunk = yield* TxChunk.get(self.items)
    const head = Chunk.head(chunk)
    if (Option.isNone(head)) {
      return Option.none()
    }

    yield* TxChunk.drop(self.items, 1)
    return Option.some(head.value)
  })

/**
 * Takes all items from the queue.
 *
 * **Mutation behavior**: This function mutates the original TxQueue by removing
 * all items. It does not return a new TxQueue reference.
 *
 * @example
 * ```ts
 * import { TxQueue, Effect, Chunk } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* TxQueue.bounded<number>(10)
 *   yield* TxQueue.offerAll(queue, [1, 2, 3, 4, 5])
 *
 *   // Take all items atomically
 *   const items = yield* TxQueue.takeAll(queue)
 *   console.log(Chunk.toReadonlyArray(items)) // [1, 2, 3, 4, 5]
 * })
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const takeAll = <A>(self: TxDequeue<A>): Effect.Effect<Chunk.Chunk<A>> =>
  Effect.gen(function*() {
    const chunk = yield* TxChunk.get(self.items)
    yield* TxChunk.set(self.items, Chunk.empty())
    return chunk
  })

/**
 * Takes up to N items from the queue.
 *
 * **Mutation behavior**: This function mutates the original TxQueue by removing
 * up to N items. It does not return a new TxQueue reference.
 *
 * @example
 * ```ts
 * import { TxQueue, Effect, Chunk } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* TxQueue.bounded<number>(10)
 *   yield* TxQueue.offerAll(queue, [1, 2, 3, 4, 5])
 *
 *   // Take up to 3 items
 *   const items = yield* TxQueue.takeN(queue, 3)
 *   console.log(Chunk.toReadonlyArray(items)) // [1, 2, 3]
 * })
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const takeN: {
  (n: number): <A>(self: TxDequeue<A>) => Effect.Effect<Chunk.Chunk<A>>
  <A>(self: TxDequeue<A>, n: number): Effect.Effect<Chunk.Chunk<A>>
} = dual(2, <A>(self: TxDequeue<A>, n: number): Effect.Effect<Chunk.Chunk<A>> =>
  Effect.gen(function*() {
    const chunk = yield* TxChunk.get(self.items)
    const taken = Chunk.take(chunk, n)
    const remaining = Chunk.drop(chunk, n)
    yield* TxChunk.set(self.items, remaining)
    return taken
  }))

/**
 * Views the next item without removing it.
 *
 * @example
 * ```ts
 * import { TxQueue, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* TxQueue.bounded<number>(10)
 *   yield* TxQueue.offer(queue, 42)
 *
 *   // Peek at the next item without removing it
 *   const item = yield* TxQueue.peek(queue)
 *   console.log(item) // 42
 *
 *   // Item is still in the queue
 *   const size = yield* TxQueue.size(queue)
 *   console.log(size) // 1
 * })
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const peek = <A>(self: TxDequeue<A>): Effect.Effect<A> =>
  Effect.transaction(
    Effect.gen(function*() {
      const isShutdown = yield* TxRef.get(self.shutdownRef)
      if (isShutdown) {
        return yield* Effect.interrupt
      }

      const chunk = yield* TxChunk.get(self.items)
      const head = Chunk.head(chunk)
      if (Option.isNone(head)) {
        return yield* Effect.retryTransaction
      }

      return head.value
    })
  )

/**
 * Gets the current size of the queue.
 *
 * @example
 * ```ts
 * import { TxQueue, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* TxQueue.bounded<number>(10)
 *   yield* TxQueue.offerAll(queue, [1, 2, 3])
 *
 *   const size = yield* TxQueue.size(queue)
 *   console.log(size) // 3
 * })
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const size = <A>(self: TxDequeue<A>): Effect.Effect<number> => TxChunk.size(self.items)

/**
 * Checks if the queue is empty.
 *
 * @example
 * ```ts
 * import { TxQueue, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* TxQueue.bounded<number>(10)
 *
 *   const empty = yield* TxQueue.isEmpty(queue)
 *   console.log(empty) // true
 *
 *   yield* TxQueue.offer(queue, 42)
 *   const stillEmpty = yield* TxQueue.isEmpty(queue)
 *   console.log(stillEmpty) // false
 * })
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const isEmpty = <A>(self: TxDequeue<A>): Effect.Effect<boolean> => TxChunk.isEmpty(self.items)

/**
 * Checks if the queue is at capacity.
 *
 * @example
 * ```ts
 * import { TxQueue, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* TxQueue.bounded<number>(2)
 *
 *   const full = yield* TxQueue.isFull(queue)
 *   console.log(full) // false
 *
 *   yield* TxQueue.offerAll(queue, [1, 2])
 *   const nowFull = yield* TxQueue.isFull(queue)
 *   console.log(nowFull) // true
 * })
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const isFull = <A>(self: TxDequeue<A>): Effect.Effect<boolean> =>
  Effect.gen(function*() {
    if (self.capacity === Number.POSITIVE_INFINITY) {
      return false
    }
    const currentSize = yield* size(self)
    return currentSize >= self.capacity
  })

/**
 * Shuts down the queue.
 *
 * **Mutation behavior**: This function mutates the original TxQueue by marking
 * it as shutdown. It does not return a new TxQueue reference.
 *
 * @example
 * ```ts
 * import { TxQueue, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* TxQueue.bounded<number>(10)
 *
 *   yield* TxQueue.shutdown(queue)
 *   const isShutdown = yield* TxQueue.isShutdown(queue)
 *   console.log(isShutdown) // true
 * })
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const shutdown = <A>(self: TxQueue<A>): Effect.Effect<void> => TxRef.set(self.shutdownRef, true)

/**
 * Checks if the queue is shutdown.
 *
 * @example
 * ```ts
 * import { TxQueue, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* TxQueue.bounded<number>(10)
 *
 *   const isShutdown = yield* TxQueue.isShutdown(queue)
 *   console.log(isShutdown) // false
 *
 *   yield* TxQueue.shutdown(queue)
 *   const nowShutdown = yield* TxQueue.isShutdown(queue)
 *   console.log(nowShutdown) // true
 * })
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const isShutdown = <A>(self: TxDequeue<A>): Effect.Effect<boolean> => TxRef.get(self.shutdownRef)
