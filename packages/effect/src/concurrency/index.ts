/**
 * @since 4.0.0
 */

/**
 * This module provides utilities for working with `Deferred`, a powerful concurrency
 * primitive that represents an asynchronous variable that can be set exactly once.
 * Multiple fibers can await the same `Deferred` and will all be notified when it
 * completes.
 *
 * A `Deferred<A, E>` can be:
 * - **Completed successfully** with a value of type `A`
 * - **Failed** with an error of type `E`
 * - **Interrupted** if the fiber setting it is interrupted
 *
 * Key characteristics:
 * - **Single assignment**: Can only be completed once
 * - **Multiple waiters**: Many fibers can await the same `Deferred`
 * - **Fiber-safe**: Thread-safe operations across concurrent fibers
 * - **Composable**: Works seamlessly with other Effect operations
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Deferred } from "effect/concurrency"
 * import { Fiber } from "effect/runtime"
 *
 * // Basic usage: coordinate between fibers
 * const program = Effect.gen(function* () {
 *   const deferred = yield* Deferred.make<string, never>()
 *
 *   // Fiber 1: waits for the value
 *   const waiter = yield* Effect.fork(
 *     Effect.gen(function* () {
 *       const value = yield* Deferred.await(deferred)
 *       console.log("Received:", value)
 *       return value
 *     })
 *   )
 *
 *   // Fiber 2: sets the value after a delay
 *   const setter = yield* Effect.fork(
 *     Effect.gen(function* () {
 *       yield* Effect.sleep("1 second")
 *       yield* Deferred.succeed(deferred, "Hello from setter!")
 *     })
 *   )
 *
 *   // Wait for both fibers
 *   yield* Fiber.join(waiter)
 *   yield* Fiber.join(setter)
 * })
 *
 * // Producer-consumer pattern
 * const producerConsumer = Effect.gen(function* () {
 *   const buffer = yield* Deferred.make<number[], never>()
 *
 *   const producer = Effect.gen(function* () {
 *     const data = [1, 2, 3, 4, 5]
 *     yield* Deferred.succeed(buffer, data)
 *   })
 *
 *   const consumer = Effect.gen(function* () {
 *     const data = yield* Deferred.await(buffer)
 *     return data.reduce((sum, n) => sum + n, 0)
 *   })
 *
 *   const [, result] = yield* Effect.all([producer, consumer])
 *   return result // 15
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as Deferred from "./Deferred.ts"

/**
 * @since 2.0.0
 */
export * as FiberHandle from "./FiberHandle.ts"

/**
 * @since 2.0.0
 */
export * as FiberMap from "./FiberMap.ts"

/**
 * @since 2.0.0
 */
export * as FiberSet from "./FiberSet.ts"

/**
 * @fileoverview
 * MutableRef provides a mutable reference container that allows safe mutation of values
 * in functional programming contexts. It serves as a bridge between functional and imperative
 * programming paradigms, offering atomic operations for state management.
 *
 * Unlike regular variables, MutableRef encapsulates mutable state and provides controlled
 * access through a standardized API. It supports atomic compare-and-set operations for
 * thread-safe updates and integrates seamlessly with Effect's ecosystem.
 *
 * Key Features:
 * - Mutable reference semantics with functional API
 * - Atomic compare-and-set operations for safe concurrent updates
 * - Specialized operations for numeric and boolean values
 * - Chainable operations that return the reference or the value
 * - Integration with Effect's Equal interface for value comparison
 *
 * Common Use Cases:
 * - State containers in functional applications
 * - Counters and accumulators
 * - Configuration that needs to be updated at runtime
 * - Caching and memoization scenarios
 * - Inter-module communication via shared references
 *
 * Performance Characteristics:
 * - Get/Set: O(1)
 * - Compare-and-set: O(1)
 * - All operations: O(1)
 *
 * @since 2.0.0
 * @category data-structures
 */
export * as MutableRef from "./MutableRef.ts"

/**
 * This module provides utilities for working with publish-subscribe (PubSub) systems.
 *
 * A PubSub is an asynchronous message hub where publishers can publish messages and subscribers
 * can subscribe to receive those messages. PubSub supports various backpressure strategies,
 * message replay, and concurrent access from multiple producers and consumers.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Scope } from "effect/resources"
 * import { PubSub } from "effect/concurrency"
 *
 * const program = Effect.gen(function*() {
 *   const pubsub = yield* PubSub.bounded<string>(10)
 *
 *   // Publisher
 *   yield* PubSub.publish(pubsub, "Hello")
 *   yield* PubSub.publish(pubsub, "World")
 *
 *   // Subscriber
 *   yield* Effect.scoped(Effect.gen(function*() {
 *     const subscription = yield* PubSub.subscribe(pubsub)
 *     const message1 = yield* PubSub.take(subscription)
 *     const message2 = yield* PubSub.take(subscription)
 *     console.log(message1, message2) // "Hello", "World"
 *   }))
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as PubSub from "./PubSub.ts"

/**
 * This module provides utilities for working with asynchronous queues that support various backpressure strategies.
 *
 * A Queue is a data structure that allows producers to add elements and consumers to take elements
 * in a thread-safe manner. The queue supports different strategies for handling backpressure when
 * the queue reaches capacity.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Queue } from "effect/concurrency"
 *
 * // Creating a bounded queue with capacity 10
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number, Queue.Done>(10)
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
export * as Queue from "./Queue.ts"

/**
 * This module provides utilities for working with mutable references in a functional context.
 *
 * A Ref is a mutable reference that can be read, written, and atomically modified. Unlike plain
 * mutable variables, Refs are thread-safe and work seamlessly with Effect's concurrency model.
 * They provide atomic operations for safe state management in concurrent programs.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Ref } from "effect/concurrency"
 *
 * const program = Effect.gen(function*() {
 *   // Create a ref with initial value
 *   const counter = yield* Ref.make(0)
 *
 *   // Atomic operations
 *   yield* Ref.update(counter, n => n + 1)
 *   yield* Ref.update(counter, n => n * 2)
 *
 *   const value = yield* Ref.get(counter)
 *   console.log(value) // 2
 *
 *   // Atomic modify with return value
 *   const previous = yield* Ref.getAndSet(counter, 100)
 *   console.log(previous) // 2
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as Ref from "./Ref.ts"
