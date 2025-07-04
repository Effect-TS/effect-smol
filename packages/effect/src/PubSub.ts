/**
 * This module provides utilities for working with publish-subscribe (PubSub) systems.
 *
 * A PubSub is an asynchronous message hub where publishers can publish messages and subscribers
 * can subscribe to receive those messages. PubSub supports various backpressure strategies,
 * message replay, and concurrent access from multiple producers and consumers.
 *
 * @example
 * ```ts
 * import { Effect, PubSub, Scope } from "effect"
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
import * as Arr from "./Array.js"
import * as Deferred from "./Deferred.js"
import * as Effect from "./Effect.js"
import * as Exit from "./Exit.js"
import type { LazyArg } from "./Function.js"
import { dual, identity } from "./Function.js"
import * as MutableList from "./MutableList.js"
import * as MutableRef from "./MutableRef.js"
import { nextPow2 } from "./Number.js"
import * as Option from "./Option.js"
import { type Pipeable, pipeArguments } from "./Pipeable.js"
import * as Scope from "./Scope.js"
import type { Covariant, Invariant } from "./Types.js"

/**
 * The type identifier for PubSub instances.
 *
 * @example
 * ```ts
 * import { PubSub } from "effect"
 *
 * // Check if a value is a PubSub instance
 * declare const pubsub: PubSub.PubSub<string>
 * console.log(pubsub[PubSub.TypeId] !== undefined) // true
 * ```
 *
 * @since 4.0.0
 * @category symbols
 */
export const TypeId: TypeId = "~effect/PubSub"

/**
 * The type identifier type for PubSub instances.
 *
 * @example
 * ```ts
 * import { PubSub } from "effect"
 *
 * // Use in type guards or type checking
 * const isPubSub = (value: unknown): value is PubSub.PubSub<unknown> =>
 *   typeof value === "object" && value !== null &&
 *   PubSub.TypeId in value
 * ```
 *
 * @since 4.0.0
 * @category symbols
 */
export type TypeId = "~effect/PubSub"

/**
 * A `PubSub<A>` is an asynchronous message hub into which publishers can publish
 * messages of type `A` and subscribers can subscribe to take messages of type
 * `A`.
 *
 * @example
 * ```ts
 * import { Effect, PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // Create a bounded PubSub with capacity 10
 *   const pubsub = yield* PubSub.bounded<string>(10)
 *
 *   // Publish messages
 *   yield* PubSub.publish(pubsub, "Hello")
 *   yield* PubSub.publish(pubsub, "World")
 *
 *   // Subscribe and consume messages
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
 * @category models
 */
export interface PubSub<in out A> extends Pipeable {
  readonly [TypeId]: {
    readonly _A: Invariant<A>
  }
  readonly pubsub: PubSub.Atomic<A>
  readonly subscribers: PubSub.Subscribers<A>
  readonly scope: Scope.Scope.Closeable
  readonly shutdownHook: Effect.Latch
  readonly shutdownFlag: MutableRef.MutableRef<boolean>
  readonly strategy: PubSub.Strategy<A>
}

/**
 * The PubSub namespace containing types and interfaces used by PubSub implementations.
 *
 * @example
 * ```ts
 * import type { PubSub } from "effect"
 *
 * // Access types from the namespace
 * type PubSubType<A> = PubSub.PubSub<A>
 * type SubscriptionType<A> = PubSub.Subscription<A>
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export namespace PubSub {
  /**
   * Low-level atomic PubSub interface that handles the core message storage and retrieval.
   *
   * @example
   * ```ts
   * import { PubSub } from "effect"
   *
   * // This interface is used internally by PubSub implementations
   * // Access through the main PubSub API instead
   * declare const pubsub: PubSub.PubSub<string>
   * console.log("Atomic interface provides low-level message storage")
   * ```
   *
   * @since 4.0.0
   * @category models
   */
  export interface Atomic<in out A> {
    readonly capacity: number
    isEmpty(): boolean
    isFull(): boolean
    size(): number
    publish(value: A): boolean
    publishAll(elements: Iterable<A>): Array<A>
    slide(): void
    subscribe(): BackingSubscription<A>
    replayWindow(): ReplayWindow<A>
  }

  /**
   * Low-level subscription interface that handles message polling for individual subscribers.
   *
   * @example
   * ```ts
   * import { PubSub } from "effect"
   *
   * // This interface is used internally by subscription implementations
   * // Access through the main PubSub subscription API instead
   * declare const subscription: PubSub.Subscription<string>
   * console.log("BackingSubscription interface handles message polling")
   * ```
   *
   * @since 4.0.0
   * @category models
   */
  export interface BackingSubscription<out A> {
    isEmpty(): boolean
    size(): number
    poll(): A | MutableList.Empty
    pollUpTo(n: number): Array<A>
    unsubscribe(): void
  }

  /**
   * Internal type representing the mapping from subscriptions to their pollers.
   *
   * @example
   * ```ts
   * import { PubSub } from "effect"
   *
   * // This type is used internally to track subscribers
   * declare const pubsub: PubSub.PubSub<string>
   * console.log("Subscribers type is used internally for subscription management")
   * ```
   *
   * @since 4.0.0
   * @category models
   */
  export type Subscribers<A> = Map<
    BackingSubscription<A>,
    Set<MutableList.MutableList<Deferred.Deferred<A>>>
  >

  /**
   * Interface for accessing replay buffer contents for late subscribers.
   *
   * @example
   * ```ts
   * import { PubSub } from "effect"
   *
   * // Access replay window from a subscription
   * declare const subscription: PubSub.Subscription<string>
   * const replayWindow = subscription.replayWindow
   *
   * // Take messages from replay buffer
   * const message = replayWindow.take()
   * const messages = replayWindow.takeAll()
   * console.log("Remaining in replay:", replayWindow.remaining)
   * ```
   *
   * @since 4.0.0
   * @category models
   */
  export interface ReplayWindow<A> {
    take(): A | undefined
    takeN(n: number): Array<A>
    takeAll(): Array<A>
    readonly remaining: number
  }

  /**
   * Strategy interface defining how PubSub handles backpressure and message distribution.
   *
   * @example
   * ```ts
   * import { PubSub, Effect } from "effect"
   *
   * // Strategy defines how PubSub handles backpressure
   * const program = Effect.gen(function* () {
   *   // Create a bounded PubSub (uses BackPressure strategy by default)
   *   const pubsub = yield* PubSub.bounded<string>(10)
   *
   *   // You can also create with sliding or dropping strategies
   *   const slidingPubSub = yield* PubSub.sliding<string>(10)
   *   const droppingPubSub = yield* PubSub.dropping<string>(10)
   *
   *   return pubsub
   * })
   * ```
   *
   * @since 4.0.0
   * @category models
   */
  export interface Strategy<in out A> {
    /**
     * Describes any finalization logic associated with this strategy.
     */
    readonly shutdown: Effect.Effect<void>

    /**
     * Describes how publishers should signal to subscribers that they are
     * waiting for space to become available in the `PubSub`.
     */
    handleSurplus(
      pubsub: Atomic<A>,
      subscribers: Subscribers<A>,
      elements: Iterable<A>,
      isShutdown: MutableRef.MutableRef<boolean>
    ): Effect.Effect<boolean>

    /**
     * Describes how subscribers should signal to publishers waiting for space
     * to become available in the `PubSub` that space may be available.
     */
    unsafeOnPubSubEmptySpace(
      pubsub: Atomic<A>,
      subscribers: Subscribers<A>
    ): void

    /**
     * Describes how subscribers waiting for additional values from the `PubSub`
     * should take those values and signal to publishers that they are no
     * longer waiting for additional values.
     */
    unsafeCompletePollers(
      pubsub: Atomic<A>,
      subscribers: Subscribers<A>,
      subscription: BackingSubscription<A>,
      pollers: MutableList.MutableList<Deferred.Deferred<A>>
    ): void

    /**
     * Describes how publishers should signal to subscribers waiting for
     * additional values from the `PubSub` that new values are available.
     */
    unsafeCompleteSubscribers(
      pubsub: Atomic<A>,
      subscribers: Subscribers<A>
    ): void
  }
}

/**
 * The type identifier for Subscription instances.
 *
 * @example
 * ```ts
 * import { PubSub } from "effect"
 *
 * // Check if a value is a Subscription instance
 * declare const subscription: PubSub.Subscription<string>
 * console.log(subscription[PubSub.SubscriptionTypeId] !== undefined) // true
 * ```
 *
 * @since 4.0.0
 * @category symbols
 */
export const SubscriptionTypeId: SubscriptionTypeId = "~effect/PubSub/Subscription"

/**
 * The type identifier type for Subscription instances.
 *
 * @example
 * ```ts
 * import { PubSub } from "effect"
 *
 * // Use in type guards
 * const isSubscription = (value: unknown): value is PubSub.Subscription<unknown> =>
 *   typeof value === "object" && value !== null &&
 *   PubSub.SubscriptionTypeId in value
 * ```
 *
 * @since 4.0.0
 * @category symbols
 */
export type SubscriptionTypeId = "~effect/PubSub/Subscription"

/**
 * A subscription represents a consumer's connection to a PubSub, allowing them to take messages.
 *
 * @example
 * ```ts
 * import { Effect, PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const pubsub = yield* PubSub.bounded<string>(10)
 *
 *   // Subscribe within a scope for automatic cleanup
 *   yield* Effect.scoped(Effect.gen(function*() {
 *     const subscription: PubSub.Subscription<string> = yield* PubSub.subscribe(pubsub)
 *
 *     // Take individual messages
 *     const message = yield* PubSub.take(subscription)
 *
 *     // Take multiple messages
 *     const messages = yield* PubSub.takeUpTo(subscription, 5)
 *     const allMessages = yield* PubSub.takeAll(subscription)
 *   }))
 * })
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface Subscription<out A> extends Pipeable {
  readonly [SubscriptionTypeId]: {
    readonly _A: Covariant<A>
  }
  readonly pubsub: PubSub.Atomic<any>
  readonly subscribers: PubSub.Subscribers<any>
  readonly subscription: PubSub.BackingSubscription<A>
  readonly pollers: MutableList.MutableList<Deferred.Deferred<any>>
  readonly shutdownHook: Effect.Latch
  readonly shutdownFlag: MutableRef.MutableRef<boolean>
  readonly strategy: PubSub.Strategy<any>
  readonly replayWindow: PubSub.ReplayWindow<A>
}

/**
 * Creates a PubSub with a custom atomic implementation and strategy.
 *
 * @example
 * ```ts
 * import { PubSub, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // Create custom PubSub with specific atomic implementation and strategy
 *   const pubsub = yield* PubSub.make<string>({
 *     atomicPubSub: () => PubSub.makeAtomicBounded(100),
 *     strategy: () => new PubSub.BackPressureStrategy()
 *   })
 *
 *   // Use the created PubSub
 *   yield* PubSub.publish(pubsub, "Hello")
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const make = <A>(
  options: {
    readonly atomicPubSub: LazyArg<PubSub.Atomic<A>>
    readonly strategy: LazyArg<PubSub.Strategy<A>>
  }
): Effect.Effect<PubSub<A>> =>
  Effect.sync(() =>
    unsafeMakePubSub(
      options.atomicPubSub(),
      new Map(),
      Scope.unsafeMake(),
      Effect.unsafeMakeLatch(false),
      MutableRef.make(false),
      options.strategy()
    )
  )

/**
 * Creates a bounded PubSub with backpressure strategy.
 *
 * The PubSub will retain messages until they have been taken by all subscribers.
 * When the PubSub reaches capacity, publishers will be suspended until space becomes available.
 * This ensures message delivery guarantees but may slow down fast publishers.
 *
 * @param capacity - The maximum number of messages the PubSub can hold, or an options object
 *                   with capacity and optional replay buffer size
 * @returns An Effect that creates a bounded PubSub
 *
 * @example
 * ```ts
 * import { Effect, PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // Create bounded PubSub with capacity 100
 *   const pubsub = yield* PubSub.bounded<string>(100)
 *
 *   // Create with replay buffer for late subscribers
 *   const pubsubWithReplay = yield* PubSub.bounded<string>({
 *     capacity: 100,
 *     replay: 10 // Last 10 messages replayed to new subscribers
 *   })
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const bounded = <A>(
  capacity: number | {
    readonly capacity: number
    readonly replay?: number | undefined
  }
): Effect.Effect<PubSub<A>> =>
  make({
    atomicPubSub: () => makeAtomicBounded(capacity),
    strategy: () => new BackPressureStrategy()
  })

/**
 * Creates a bounded `PubSub` with the dropping strategy. The `PubSub` will drop new
 * messages if the `PubSub` is at capacity.
 *
 * For best performance use capacities that are powers of two.
 *
 * @example
 * ```ts
 * import { Effect, PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // Create dropping PubSub that drops new messages when full
 *   const pubsub = yield* PubSub.dropping<string>(3)
 *
 *   // With replay buffer for late subscribers
 *   const pubsubWithReplay = yield* PubSub.dropping<string>({
 *     capacity: 3,
 *     replay: 5
 *   })
 *
 *   // Fill the PubSub and see dropping behavior
 *   yield* PubSub.publish(pubsub, "msg1") // succeeds
 *   yield* PubSub.publish(pubsub, "msg2") // succeeds
 *   yield* PubSub.publish(pubsub, "msg3") // succeeds
 *   const dropped = yield* PubSub.publish(pubsub, "msg4") // returns false (dropped)
 *   console.log("Message dropped:", !dropped)
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const dropping = <A>(
  capacity: number | {
    readonly capacity: number
    readonly replay?: number | undefined
  }
): Effect.Effect<PubSub<A>> =>
  make({
    atomicPubSub: () => makeAtomicBounded(capacity),
    strategy: () => new DroppingStrategy()
  })

/**
 * Creates a bounded `PubSub` with the sliding strategy. The `PubSub` will add new
 * messages and drop old messages if the `PubSub` is at capacity.
 *
 * For best performance use capacities that are powers of two.
 *
 * @example
 * ```ts
 * import { Effect, PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // Create sliding PubSub that evicts old messages when full
 *   const pubsub = yield* PubSub.sliding<string>(3)
 *
 *   // With replay buffer
 *   const pubsubWithReplay = yield* PubSub.sliding<string>({
 *     capacity: 3,
 *     replay: 2
 *   })
 *
 *   // Fill and overflow the PubSub
 *   yield* PubSub.publish(pubsub, "msg1")
 *   yield* PubSub.publish(pubsub, "msg2")
 *   yield* PubSub.publish(pubsub, "msg3")
 *   yield* PubSub.publish(pubsub, "msg4") // "msg1" is evicted
 *
 *   yield* Effect.scoped(Effect.gen(function*() {
 *     const subscription = yield* PubSub.subscribe(pubsub)
 *     const messages = yield* PubSub.takeAll(subscription)
 *     console.log(messages) // ["msg2", "msg3", "msg4"]
 *   }))
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const sliding = <A>(
  capacity: number | {
    readonly capacity: number
    readonly replay?: number | undefined
  }
): Effect.Effect<PubSub<A>> =>
  make({
    atomicPubSub: () => makeAtomicBounded(capacity),
    strategy: () => new SlidingStrategy()
  })

/**
 * Creates an unbounded `PubSub`.
 *
 * @example
 * ```ts
 * import { Effect, PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // Create unbounded PubSub
 *   const pubsub = yield* PubSub.unbounded<string>()
 *
 *   // With replay buffer for late subscribers
 *   const pubsubWithReplay = yield* PubSub.unbounded<string>({
 *     replay: 10
 *   })
 *
 *   // Can publish unlimited messages
 *   for (let i = 0; i < 1000; i++) {
 *     yield* PubSub.publish(pubsub, `message-${i}`)
 *   }
 *
 *   yield* Effect.scoped(Effect.gen(function*() {
 *     const subscription = yield* PubSub.subscribe(pubsub)
 *     const message = yield* PubSub.take(subscription)
 *     console.log("First message:", message)
 *   }))
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const unbounded = <A>(options?: {
  readonly replay?: number | undefined
}): Effect.Effect<PubSub<A>> =>
  make({
    atomicPubSub: () => makeAtomicUnbounded(options),
    strategy: () => new DroppingStrategy()
  })

/**
 * Creates a bounded atomic PubSub implementation with optional replay buffer.
 *
 * @example
 * ```ts
 * import { PubSub } from "effect"
 *
 * // Create bounded atomic PubSub
 * const atomic1 = PubSub.makeAtomicBounded<string>(10)
 *
 * // With replay buffer for late subscribers
 * const atomic2 = PubSub.makeAtomicBounded<string>({
 *   capacity: 10,
 *   replay: 5
 * })
 *
 * // Use the atomic PubSub
 * const published = atomic1.publish("Hello")
 * console.log("Published:", published)
 * console.log("Capacity:", atomic1.capacity)
 * console.log("Size:", atomic1.size())
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const makeAtomicBounded = <A>(
  capacity: number | {
    readonly capacity: number
    readonly replay?: number | undefined
  }
): PubSub.Atomic<A> => {
  const options = typeof capacity === "number" ? { capacity } : capacity
  ensureCapacity(options.capacity)
  const replayBuffer = options.replay && options.replay > 0 ? new ReplayBuffer<A>(Math.ceil(options.replay)) : undefined
  if (options.capacity === 1) {
    return new BoundedPubSubSingle(replayBuffer)
  } else if (nextPow2(options.capacity) === options.capacity) {
    return new BoundedPubSubPow2(options.capacity, replayBuffer)
  } else {
    return new BoundedPubSubArb(options.capacity, replayBuffer)
  }
}

/**
 * Creates an unbounded atomic PubSub implementation with optional replay buffer.
 *
 * @example
 * ```ts
 * import { PubSub } from "effect"
 *
 * // Create unbounded atomic PubSub
 * const atomic1 = PubSub.makeAtomicUnbounded<string>()
 *
 * // With replay buffer
 * const atomic2 = PubSub.makeAtomicUnbounded<string>({
 *   replay: 100
 * })
 *
 * // Can publish unlimited messages
 * for (let i = 0; i < 1000; i++) {
 *   atomic1.publish(`message-${i}`)
 * }
 * console.log("Size:", atomic1.size())
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const makeAtomicUnbounded = <A>(options?: {
  readonly replay?: number | undefined
}): PubSub.Atomic<A> => new UnboundedPubSub(options?.replay ? new ReplayBuffer(options.replay) : undefined)

/**
 *  Returns the number of elements the queue can hold.
 *
 * @example
 * ```ts
 * import { Effect, PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const pubsub = yield* PubSub.bounded<string>(100)
 *   const cap = PubSub.capacity(pubsub)
 *   console.log("PubSub capacity:", cap) // 100
 *
 *   const unboundedPubsub = yield* PubSub.unbounded<string>()
 *   const unboundedCap = PubSub.capacity(unboundedPubsub)
 *   console.log("Unbounded capacity:", unboundedCap) // Number.MAX_SAFE_INTEGER
 * })
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const capacity = <A>(self: PubSub<A>): number => self.pubsub.capacity

/**
 * Retrieves the size of the queue, which is equal to the number of elements
 * in the queue. This may be negative if fibers are suspended waiting for
 * elements to be added to the queue.
 *
 * @example
 * ```ts
 * import { Effect, PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const pubsub = yield* PubSub.bounded<string>(10)
 *
 *   // Initially empty
 *   const initialSize = yield* PubSub.size(pubsub)
 *   console.log("Initial size:", initialSize) // 0
 *
 *   // Publish some messages
 *   yield* PubSub.publish(pubsub, "msg1")
 *   yield* PubSub.publish(pubsub, "msg2")
 *
 *   const afterPublish = yield* PubSub.size(pubsub)
 *   console.log("After publishing:", afterPublish) // 2
 * })
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const size = <A>(self: PubSub<A>): Effect.Effect<number> =>
  Effect.suspend(() =>
    MutableRef.get(self.shutdownFlag) ?
      Effect.interrupt :
      Effect.sync(() => self.pubsub.size())
  )
/**
 * Retrieves the size of the queue, which is equal to the number of elements
 * in the queue. This may be negative if fibers are suspended waiting for
 * elements to be added to the queue.
 *
 * @example
 * ```ts
 * import { PubSub, Option } from "effect"
 *
 * // Unsafe synchronous size check
 * declare const pubsub: PubSub.PubSub<string>
 *
 * const sizeOption = PubSub.unsafeSize(pubsub)
 * if (Option.isSome(sizeOption)) {
 *   console.log("Current size:", sizeOption.value)
 * } else {
 *   console.log("PubSub is shutdown")
 * }
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const unsafeSize = <A>(self: PubSub<A>): Option.Option<number> => {
  if (MutableRef.get(self.shutdownFlag)) {
    return Option.none()
  }
  return Option.some(self.pubsub.size())
}

/**
 * Returns `true` if the `PubSub` contains at least one element, `false`
 * otherwise.
 *
 * @example
 * ```ts
 * import { Effect, PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const pubsub = yield* PubSub.bounded<string>(2)
 *
 *   // Initially not full
 *   const initiallyFull = yield* PubSub.isFull(pubsub)
 *   console.log("Initially full:", initiallyFull) // false
 *
 *   // Fill the PubSub
 *   yield* PubSub.publish(pubsub, "msg1")
 *   yield* PubSub.publish(pubsub, "msg2")
 *
 *   const nowFull = yield* PubSub.isFull(pubsub)
 *   console.log("Now full:", nowFull) // true
 * })
 * ```
 *
 * @since 2.0.0
 * @category predicates
 */
export const isFull = <A>(self: PubSub<A>): Effect.Effect<boolean> =>
  Effect.map(size(self), (size) => size === self.pubsub.capacity)

/**
 * Returns `true` if the `Pubsub` contains zero elements, `false` otherwise.
 *
 * @example
 * ```ts
 * import { Effect, PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const pubsub = yield* PubSub.bounded<string>(10)
 *
 *   // Initially empty
 *   const initiallyEmpty = yield* PubSub.isEmpty(pubsub)
 *   console.log("Initially empty:", initiallyEmpty) // true
 *
 *   // Publish a message
 *   yield* PubSub.publish(pubsub, "Hello")
 *
 *   const nowEmpty = yield* PubSub.isEmpty(pubsub)
 *   console.log("Now empty:", nowEmpty) // false
 * })
 * ```
 *
 * @since 2.0.0
 * @category predicates
 */
export const isEmpty = <A>(self: PubSub<A>): Effect.Effect<boolean> => Effect.map(size(self), (size) => size === 0)

/**
 * Interrupts any fibers that are suspended on `offer` or `take`. Future calls
 * to `offer*` and `take*` will be interrupted immediately.
 *
 * @example
 * ```ts
 * import { Effect, PubSub, Fiber } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const pubsub = yield* PubSub.bounded<string>(1)
 *
 *   // Start a fiber that will be suspended waiting to publish
 *   const publisherFiber = yield* Effect.fork(
 *     Effect.gen(function*() {
 *       yield* PubSub.publish(pubsub, "msg1") // fills the buffer
 *       yield* PubSub.publish(pubsub, "msg2") // will suspend here
 *     })
 *   )
 *
 *   // Shutdown the PubSub
 *   yield* PubSub.shutdown(pubsub)
 *
 *   // The suspended publisher will be interrupted
 *   const result = yield* Fiber.await(publisherFiber)
 *   console.log("Publisher interrupted:", result._tag === "Failure")
 * })
 * ```
 *
 * @since 2.0.0
 * @category lifecycle
 */
export const shutdown = <A>(self: PubSub<A>): Effect.Effect<void> =>
  Effect.uninterruptible(Effect.withFiber((fiber) => {
    MutableRef.set(self.shutdownFlag, true)
    return Scope.close(self.scope, Exit.interrupt(fiber.id)).pipe(
      Effect.andThen(self.strategy.shutdown),
      Effect.when(self.shutdownHook.open),
      Effect.asVoid
    )
  }))

/**
 * Returns `true` if `shutdown` has been called, otherwise returns `false`.
 *
 * @example
 * ```ts
 * import { Effect, PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const pubsub = yield* PubSub.bounded<string>(10)
 *
 *   // Initially not shutdown
 *   const initiallyShutdown = yield* PubSub.isShutdown(pubsub)
 *   console.log("Initially shutdown:", initiallyShutdown) // false
 *
 *   // Shutdown the PubSub
 *   yield* PubSub.shutdown(pubsub)
 *
 *   const nowShutdown = yield* PubSub.isShutdown(pubsub)
 *   console.log("Now shutdown:", nowShutdown) // true
 * })
 * ```
 *
 * @since 2.0.0
 * @category predicates
 */
export const isShutdown = <A>(self: PubSub<A>): Effect.Effect<boolean> => Effect.sync(() => unsafeIsShutdown(self))

/**
 * Returns `true` if `shutdown` has been called, otherwise returns `false`.
 *
 * @example
 * ```ts
 * import { PubSub } from "effect"
 *
 * declare const pubsub: PubSub.PubSub<string>
 *
 * // Unsafe synchronous shutdown check
 * const isDown = PubSub.unsafeIsShutdown(pubsub)
 * if (isDown) {
 *   console.log("PubSub is shutdown, cannot publish")
 * } else {
 *   console.log("PubSub is active")
 * }
 * ```
 *
 * @since 4.0.0
 * @category predicates
 */
export const unsafeIsShutdown = <A>(self: PubSub<A>): boolean => self.shutdownFlag.current

/**
 * Waits until the queue is shutdown. The `Effect` returned by this method will
 * not resume until the queue has been shutdown. If the queue is already
 * shutdown, the `Effect` will resume right away.
 *
 * @example
 * ```ts
 * import { Effect, PubSub, Fiber } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const pubsub = yield* PubSub.bounded<string>(10)
 *
 *   // Start a fiber that waits for shutdown
 *   const waiterFiber = yield* Effect.fork(
 *     Effect.gen(function*() {
 *       yield* PubSub.awaitShutdown(pubsub)
 *       console.log("PubSub has been shutdown!")
 *     })
 *   )
 *
 *   // Do some work...
 *   yield* Effect.sleep("100 millis")
 *
 *   // Shutdown the PubSub
 *   yield* PubSub.shutdown(pubsub)
 *
 *   // The waiter will now complete
 *   yield* Fiber.join(waiterFiber)
 * })
 * ```
 *
 * @since 2.0.0
 * @category lifecycle
 */
export const awaitShutdown = <A>(self: PubSub<A>): Effect.Effect<void> => self.shutdownHook.await

/**
 * Publishes a message to the `PubSub`, returning whether the message was published
 * to the `PubSub`.
 *
 * @example
 * ```ts
 * import { Effect, PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const pubsub = yield* PubSub.bounded<string>(10)
 *
 *   // Publish a message
 *   const published = yield* PubSub.publish(pubsub, "Hello World")
 *   console.log("Message published:", published) // true
 *
 *   // With a full bounded PubSub using backpressure strategy
 *   const smallPubsub = yield* PubSub.bounded<string>(1)
 *   yield* PubSub.publish(smallPubsub, "msg1") // succeeds
 *
 *   // This will suspend until space becomes available
 *   const publishEffect = PubSub.publish(smallPubsub, "msg2")
 *
 *   // Create a subscriber to free up space
 *   yield* Effect.scoped(Effect.gen(function*() {
 *     const subscription = yield* PubSub.subscribe(smallPubsub)
 *     yield* PubSub.take(subscription) // frees space
 *     const result = yield* publishEffect
 *     console.log("Second message published:", result) // true
 *   }))
 * })
 * ```
 *
 * @since 2.0.0
 * @category publishing
 */
export const publish: {
  <A>(value: A): (self: PubSub<A>) => Effect.Effect<boolean>
  <A>(self: PubSub<A>, value: A): Effect.Effect<boolean>
} = dual(2, <A>(self: PubSub<A>, value: A): Effect.Effect<boolean> =>
  Effect.suspend(() => {
    if (self.shutdownFlag.current) {
      return Effect.interrupt
    }

    if (self.pubsub.publish(value)) {
      self.strategy.unsafeCompleteSubscribers(self.pubsub, self.subscribers)
      return Effect.succeed(true)
    }

    return self.strategy.handleSurplus(
      self.pubsub,
      self.subscribers,
      [value],
      self.shutdownFlag
    )
  }))

/**
 * Publishes a message to the `PubSub`, returning whether the message was published
 * to the `PubSub`.
 *
 * @example
 * ```ts
 * import { PubSub } from "effect"
 *
 * declare const pubsub: PubSub.PubSub<string>
 *
 * // Unsafe synchronous publish (non-blocking)
 * const published = PubSub.unsafePublish(pubsub, "Hello")
 * if (published) {
 *   console.log("Message published successfully")
 * } else {
 *   console.log("Message dropped (PubSub full or shutdown)")
 * }
 *
 * // Useful for scenarios where you don't want to suspend
 * const messages = ["msg1", "msg2", "msg3"]
 * const publishedCount = messages.filter(msg =>
 *   PubSub.unsafePublish(pubsub, msg)
 * ).length
 * console.log(`Published ${publishedCount} out of ${messages.length} messages`)
 * ```
 *
 * @since 4.0.0
 * @category publishing
 */
export const unsafePublish: {
  <A>(value: A): (self: PubSub<A>) => boolean
  <A>(self: PubSub<A>, value: A): boolean
} = dual(2, <A>(self: PubSub<A>, value: A): boolean => {
  if (self.shutdownFlag.current) return false
  if (self.pubsub.publish(value)) {
    self.strategy.unsafeCompleteSubscribers(self.pubsub, self.subscribers)
    return true
  }
  return false
})

/**
 * Publishes all of the specified messages to the `PubSub`, returning whether they
 * were published to the `PubSub`.
 *
 * @example
 * ```ts
 * import { Effect, PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const pubsub = yield* PubSub.bounded<string>(10)
 *
 *   // Publish multiple messages at once
 *   const messages = ["Hello", "World", "from", "Effect"]
 *   const allPublished = yield* PubSub.publishAll(pubsub, messages)
 *   console.log("All messages published:", allPublished) // true
 *
 *   // With a smaller capacity
 *   const smallPubsub = yield* PubSub.bounded<string>(2)
 *   const manyMessages = ["msg1", "msg2", "msg3", "msg4"]
 *
 *   // Will suspend until space becomes available for all messages
 *   const publishAllEffect = PubSub.publishAll(smallPubsub, manyMessages)
 *
 *   // Subscribe to consume messages and free space
 *   yield* Effect.scoped(Effect.gen(function*() {
 *     const subscription = yield* PubSub.subscribe(smallPubsub)
 *     yield* PubSub.takeAll(subscription) // consume all messages
 *     const result = yield* publishAllEffect
 *     console.log("All messages eventually published:", result)
 *   }))
 * })
 * ```
 *
 * @since 2.0.0
 * @category publishing
 */
export const publishAll: {
  <A>(elements: Iterable<A>): (self: PubSub<A>) => Effect.Effect<boolean>
  <A>(self: PubSub<A>, elements: Iterable<A>): Effect.Effect<boolean>
} = dual(2, <A>(self: PubSub<A>, elements: Iterable<A>): Effect.Effect<boolean> =>
  Effect.suspend(() => {
    if (self.shutdownFlag.current) {
      return Effect.interrupt
    }
    const surplus = self.pubsub.publishAll(elements)
    self.strategy.unsafeCompleteSubscribers(self.pubsub, self.subscribers)
    if (surplus.length === 0) {
      return Effect.succeed(true)
    }
    return self.strategy.handleSurplus(
      self.pubsub,
      self.subscribers,
      surplus,
      self.shutdownFlag
    )
  }))

/**
 * Subscribes to receive messages from the `PubSub`. The resulting subscription can
 * be evaluated multiple times within the scope to take a message from the `PubSub`
 * each time.
 *
 * @example
 * ```ts
 * import { Effect, PubSub, Scope } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const pubsub = yield* PubSub.bounded<string>(10)
 *
 *   // Publish some messages
 *   yield* PubSub.publish(pubsub, "Hello")
 *   yield* PubSub.publish(pubsub, "World")
 *
 *   // Subscribe within a scope for automatic cleanup
 *   yield* Effect.scoped(Effect.gen(function*() {
 *     const subscription = yield* PubSub.subscribe(pubsub)
 *
 *     // Take messages one by one
 *     const msg1 = yield* PubSub.take(subscription)
 *     const msg2 = yield* PubSub.take(subscription)
 *     console.log(msg1, msg2) // "Hello", "World"
 *
 *     // Subscription is automatically cleaned up when scope exits
 *   }))
 *
 *   // Multiple subscribers can receive the same messages
 *   yield* PubSub.publish(pubsub, "Broadcast")
 *
 *   yield* Effect.scoped(Effect.gen(function*() {
 *     const sub1 = yield* PubSub.subscribe(pubsub)
 *     const sub2 = yield* PubSub.subscribe(pubsub)
 *
 *     const [msg1, msg2] = yield* Effect.all([
 *       PubSub.take(sub1),
 *       PubSub.take(sub2)
 *     ])
 *     console.log("Both received:", msg1, msg2) // "Broadcast", "Broadcast"
 *   }))
 * })
 * ```
 *
 * @since 2.0.0
 * @category subscription
 */
export const subscribe = <A>(self: PubSub<A>): Effect.Effect<Subscription<A>, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => unsafeMakeSubscription(self.pubsub, self.subscribers, self.strategy)),
    unsubscribe
  )

const unsubscribe = <A>(self: Subscription<A>): Effect.Effect<void> =>
  Effect.uninterruptible(
    Effect.withFiber<void>((state) => {
      MutableRef.set(self.shutdownFlag, true)
      return Effect.forEach(
        MutableList.takeAll(self.pollers),
        (d) => Deferred.interruptWith(d, state.id),
        { discard: true, concurrency: "unbounded" }
      ).pipe(
        Effect.tap(() => {
          self.subscribers.delete(self.subscription)
          self.subscription.unsubscribe()
          self.strategy.unsafeOnPubSubEmptySpace(self.pubsub, self.subscribers)
        }),
        Effect.when(self.shutdownHook.open),
        Effect.asVoid
      )
    })
  )

/**
 * Takes a single message from the subscription. If no messages are available,
 * this will suspend until a message becomes available.
 *
 * @example
 * ```ts
 * import { Effect, PubSub, Fiber } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const pubsub = yield* PubSub.bounded<string>(10)
 *
 *   yield* Effect.scoped(Effect.gen(function*() {
 *     const subscription = yield* PubSub.subscribe(pubsub)
 *
 *     // Start a fiber to take a message (will suspend)
 *     const takeFiber = yield* Effect.fork(
 *       PubSub.take(subscription)
 *     )
 *
 *     // Publish a message
 *     yield* PubSub.publish(pubsub, "Hello")
 *
 *     // The take will now complete
 *     const message = yield* Fiber.join(takeFiber)
 *     console.log("Received:", message) // "Hello"
 *   }))
 * })
 * ```
 *
 * @since 4.0.0
 * @category subscription
 */
export const take = <A>(self: Subscription<A>): Effect.Effect<A> =>
  Effect.suspend(() => {
    if (self.shutdownFlag.current) {
      return Effect.interrupt
    }
    if (self.replayWindow.remaining > 0) {
      const message = self.replayWindow.take()!
      return Effect.succeed(message)
    }
    const message = self.pollers.length === 0
      ? self.subscription.poll()
      : MutableList.Empty
    if (message === MutableList.Empty) {
      const deferred = Deferred.unsafeMake<A>()
      return Effect.suspend(() => {
        MutableList.append(self.pollers, deferred)
        let set = self.subscribers.get(self.subscription)
        if (!set) {
          set = new Set()
          self.subscribers.set(self.subscription, set)
        }
        set.add(self.pollers)
        self.strategy.unsafeCompletePollers(
          self.pubsub,
          self.subscribers,
          self.subscription,
          self.pollers
        )
        return self.shutdownFlag.current ? Effect.interrupt : Deferred.await(deferred)
      }).pipe(
        Effect.onInterrupt(Effect.sync(() => MutableList.remove(self.pollers, deferred)))
      )
    } else {
      self.strategy.unsafeOnPubSubEmptySpace(self.pubsub, self.subscribers)
      return Effect.succeed(message)
    }
  })

/**
 * Takes all available messages from the subscription without suspending.
 *
 * @example
 * ```ts
 * import { Effect, PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const pubsub = yield* PubSub.bounded<string>(10)
 *
 *   // Publish multiple messages
 *   yield* PubSub.publishAll(pubsub, ["msg1", "msg2", "msg3"])
 *
 *   yield* Effect.scoped(Effect.gen(function*() {
 *     const subscription = yield* PubSub.subscribe(pubsub)
 *
 *     // Take all available messages at once
 *     const allMessages = yield* PubSub.takeAll(subscription)
 *     console.log("All messages:", allMessages) // ["msg1", "msg2", "msg3"]
 *
 *     // If no messages are available, returns empty array
 *     const noMessages = yield* PubSub.takeAll(subscription)
 *     console.log("No more messages:", noMessages) // []
 *   }))
 * })
 * ```
 *
 * @since 4.0.0
 * @category subscription
 */
export const takeAll = <A>(self: Subscription<A>): Effect.Effect<Array<A>> =>
  Effect.suspend(() => {
    if (self.shutdownFlag.current) {
      return Effect.interrupt
    }
    const as = self.pollers.length === 0
      ? self.subscription.pollUpTo(Number.POSITIVE_INFINITY)
      : []
    self.strategy.unsafeOnPubSubEmptySpace(self.pubsub, self.subscribers)
    if (self.replayWindow.remaining > 0) {
      return Effect.succeed(self.replayWindow.takeAll().concat(as))
    }
    return Effect.succeed(as)
  })

/**
 * Takes up to the specified number of messages from the subscription without suspending.
 *
 * @example
 * ```ts
 * import { Effect, PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const pubsub = yield* PubSub.bounded<string>(10)
 *
 *   // Publish multiple messages
 *   yield* PubSub.publishAll(pubsub, ["msg1", "msg2", "msg3", "msg4", "msg5"])
 *
 *   yield* Effect.scoped(Effect.gen(function*() {
 *     const subscription = yield* PubSub.subscribe(pubsub)
 *
 *     // Take up to 3 messages
 *     const upTo3 = yield* PubSub.takeUpTo(subscription, 3)
 *     console.log("Up to 3:", upTo3) // ["msg1", "msg2", "msg3"]
 *
 *     // Take up to 5 more (only 2 remaining)
 *     const upTo5 = yield* PubSub.takeUpTo(subscription, 5)
 *     console.log("Up to 5:", upTo5) // ["msg4", "msg5"]
 *
 *     // No more messages available
 *     const noMore = yield* PubSub.takeUpTo(subscription, 10)
 *     console.log("No more:", noMore) // []
 *   }))
 * })
 * ```
 *
 * @since 4.0.0
 * @category subscription
 */
export const takeUpTo: {
  (max: number): <A>(self: Subscription<A>) => Effect.Effect<Array<A>>
  <A>(self: Subscription<A>, max: number): Effect.Effect<Array<A>>
} = dual(2, <A>(self: Subscription<A>, max: number): Effect.Effect<Array<A>> =>
  Effect.suspend(() => {
    if (self.shutdownFlag.current) return Effect.interrupt
    let replay: Array<A> | undefined = undefined
    if (self.replayWindow.remaining >= max) {
      return Effect.succeed(self.replayWindow.takeN(max))
    } else if (self.replayWindow.remaining > 0) {
      replay = self.replayWindow.takeAll()
      max = max - replay.length
    }
    const as = self.pollers.length === 0
      ? self.subscription.pollUpTo(max)
      : []
    self.strategy.unsafeOnPubSubEmptySpace(self.pubsub, self.subscribers)
    return replay ? Effect.succeed(replay.concat(as)) : Effect.succeed(as)
  }))

/**
 * Takes between the specified minimum and maximum number of messages from the subscription.
 * Will suspend if the minimum number is not immediately available.
 *
 * @example
 * ```ts
 * import { Effect, PubSub, Fiber } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const pubsub = yield* PubSub.bounded<string>(10)
 *
 *   yield* Effect.scoped(Effect.gen(function*() {
 *     const subscription = yield* PubSub.subscribe(pubsub)
 *
 *     // Start taking between 2 and 5 messages (will suspend)
 *     const takeFiber = yield* Effect.fork(
 *       PubSub.takeBetween(subscription, 2, 5)
 *     )
 *
 *     // Publish 3 messages
 *     yield* PubSub.publishAll(pubsub, ["msg1", "msg2", "msg3"])
 *
 *     // Now the take will complete with 3 messages
 *     const messages = yield* Fiber.join(takeFiber)
 *     console.log("Between 2-5:", messages) // ["msg1", "msg2", "msg3"]
 *   }))
 * })
 * ```
 *
 * @since 4.0.0
 * @category subscription
 */
export const takeBetween: {
  (min: number, max: number): <A>(self: Subscription<A>) => Effect.Effect<Array<A>>
  <A>(self: Subscription<A>, min: number, max: number): Effect.Effect<Array<A>>
} = dual(
  3,
  <A>(self: Subscription<A>, min: number, max: number): Effect.Effect<Array<A>> =>
    Effect.suspend(() => takeRemainderLoop(self, min, max, []))
)

const takeRemainderLoop = <A>(
  self: Subscription<A>,
  min: number,
  max: number,
  acc: Array<A>
): Effect.Effect<Array<A>> => {
  if (max < min) {
    return Effect.succeed(acc)
  }
  return Effect.flatMap(takeUpTo(self, max), (bs) => {
    // eslint-disable-next-line no-restricted-syntax
    acc.push(...bs)
    const remaining = min - bs.length
    if (remaining === 1) {
      return Effect.map(take(self), (b) => {
        acc.push(b)
        return acc
      })
    }
    if (remaining > 1) {
      return Effect.flatMap(take(self), (b) => {
        acc.push(b)
        return takeRemainderLoop(
          self,
          remaining - 1,
          max - bs.length - 1,
          acc
        )
      })
    }
    return Effect.succeed(acc)
  })
}

/**
 * Returns the number of messages currently available in the subscription.
 *
 * @example
 * ```ts
 * import { Effect, PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const pubsub = yield* PubSub.bounded<string>(10)
 *
 *   // Publish some messages
 *   yield* PubSub.publishAll(pubsub, ["msg1", "msg2", "msg3"])
 *
 *   yield* Effect.scoped(Effect.gen(function*() {
 *     const subscription = yield* PubSub.subscribe(pubsub)
 *
 *     // Check how many messages are available
 *     const count = yield* PubSub.remaining(subscription)
 *     console.log("Messages available:", count) // 3
 *
 *     // Take one message
 *     yield* PubSub.take(subscription)
 *
 *     const remaining = yield* PubSub.remaining(subscription)
 *     console.log("Messages remaining:", remaining) // 2
 *   }))
 * })
 * ```
 *
 * @since 4.0.0
 * @category getters
 */
export const remaining = <A>(self: Subscription<A>): Effect.Effect<number> =>
  Effect.suspend(() =>
    self.shutdownFlag.current
      ? Effect.interrupt
      : Effect.succeed(self.subscription.size() + self.replayWindow.remaining)
  )

/**
 * Returns the number of messages currently available in the subscription.
 *
 * @example
 * ```ts
 * import { PubSub, Option } from "effect"
 *
 * declare const subscription: PubSub.Subscription<string>
 *
 * // Unsafe synchronous check for remaining messages
 * const remainingOption = PubSub.unsafeRemaining(subscription)
 * if (Option.isSome(remainingOption)) {
 *   console.log("Messages available:", remainingOption.value)
 * } else {
 *   console.log("Subscription is shutdown")
 * }
 *
 * // Useful for polling or batching scenarios
 * if (Option.isSome(remainingOption) && remainingOption.value > 10) {
 *   // Process messages in batch
 * }
 * ```
 *
 * @since 4.0.0
 * @category getters
 */
export const unsafeRemaining = <A>(self: Subscription<A>): Option.Option<number> => {
  if (self.shutdownFlag.current) {
    return Option.none()
  }
  return Option.some(self.subscription.size() + self.replayWindow.remaining)
}

// -----------------------------------------------------------------------------
// internal
// -----------------------------------------------------------------------------

const AbsentValue = Symbol.for("effect/PubSub/AbsentValue")
type AbsentValue = typeof AbsentValue

const addSubscribers = <A>(
  subscribers: PubSub.Subscribers<A>,
  subscription: PubSub.BackingSubscription<A>,
  pollers: MutableList.MutableList<Deferred.Deferred<A>>
) => {
  if (!subscribers.has(subscription)) {
    subscribers.set(subscription, new Set())
  }
  const set = subscribers.get(subscription)!
  set.add(pollers)
}

const removeSubscribers = <A>(
  subscribers: PubSub.Subscribers<A>,
  subscription: PubSub.BackingSubscription<A>,
  pollers: MutableList.MutableList<Deferred.Deferred<A>>
) => {
  if (!subscribers.has(subscription)) {
    return
  }
  const set = subscribers.get(subscription)!
  set.delete(pollers)
  if (set.size === 0) {
    subscribers.delete(subscription)
  }
}

const unsafeMakeSubscription = <A>(
  pubsub: PubSub.Atomic<A>,
  subscribers: PubSub.Subscribers<A>,
  strategy: PubSub.Strategy<A>
): Subscription<A> =>
  new SubscriptionImpl(
    pubsub,
    subscribers,
    pubsub.subscribe(),
    MutableList.make<Deferred.Deferred<A>>(),
    Effect.unsafeMakeLatch(false),
    MutableRef.make(false),
    strategy,
    pubsub.replayWindow()
  )

class BoundedPubSubArb<in out A> implements PubSub.Atomic<A> {
  array: Array<A>
  publisherIndex = 0
  subscribers: Array<number>
  subscriberCount = 0
  subscribersIndex = 0

  constructor(readonly capacity: number, readonly replayBuffer: ReplayBuffer<A> | undefined) {
    this.array = Array.from({ length: capacity })
    this.subscribers = Array.from({ length: capacity })
  }

  replayWindow(): PubSub.ReplayWindow<A> {
    return this.replayBuffer ? new ReplayWindowImpl(this.replayBuffer) : emptyReplayWindow
  }

  isEmpty(): boolean {
    return this.publisherIndex === this.subscribersIndex
  }

  isFull(): boolean {
    return this.publisherIndex === this.subscribersIndex + this.capacity
  }

  size(): number {
    return this.publisherIndex - this.subscribersIndex
  }

  publish(value: A): boolean {
    if (this.isFull()) {
      return false
    }
    if (this.subscriberCount !== 0) {
      const index = this.publisherIndex % this.capacity
      this.array[index] = value
      this.subscribers[index] = this.subscriberCount
      this.publisherIndex += 1
    }
    if (this.replayBuffer) {
      this.replayBuffer.offer(value)
    }
    return true
  }

  publishAll(elements: Iterable<A>): Array<A> {
    if (this.subscriberCount === 0) {
      if (this.replayBuffer) {
        this.replayBuffer.offerAll(elements)
      }
      return []
    }
    const chunk = Arr.fromIterable(elements)
    const n = chunk.length
    const size = this.publisherIndex - this.subscribersIndex
    const available = this.capacity - size
    const forPubSub = Math.min(n, available)
    if (forPubSub === 0) {
      return chunk
    }
    let iteratorIndex = 0
    const publishAllIndex = this.publisherIndex + forPubSub
    while (this.publisherIndex !== publishAllIndex) {
      const a = chunk[iteratorIndex++]
      const index = this.publisherIndex % this.capacity
      this.array[index] = a
      this.subscribers[index] = this.subscriberCount
      this.publisherIndex += 1
      if (this.replayBuffer) {
        this.replayBuffer.offer(a)
      }
    }
    return chunk.slice(iteratorIndex)
  }

  slide(): void {
    if (this.subscribersIndex !== this.publisherIndex) {
      const index = this.subscribersIndex % this.capacity
      this.array[index] = AbsentValue as unknown as A
      this.subscribers[index] = 0
      this.subscribersIndex += 1
    }
    if (this.replayBuffer) {
      this.replayBuffer.slide()
    }
  }

  subscribe(): PubSub.BackingSubscription<A> {
    this.subscriberCount += 1
    return new BoundedPubSubArbSubscription(this, this.publisherIndex, false)
  }
}

class BoundedPubSubArbSubscription<in out A> implements PubSub.BackingSubscription<A> {
  constructor(
    private self: BoundedPubSubArb<A>,
    private subscriberIndex: number,
    private unsubscribed: boolean
  ) {
  }

  isEmpty(): boolean {
    return (
      this.unsubscribed ||
      this.self.publisherIndex === this.subscriberIndex ||
      this.self.publisherIndex === this.self.subscribersIndex
    )
  }

  size() {
    if (this.unsubscribed) {
      return 0
    }
    return this.self.publisherIndex - Math.max(this.subscriberIndex, this.self.subscribersIndex)
  }

  poll(): A | MutableList.Empty {
    if (this.unsubscribed) {
      return MutableList.Empty
    }
    this.subscriberIndex = Math.max(this.subscriberIndex, this.self.subscribersIndex)
    if (this.subscriberIndex !== this.self.publisherIndex) {
      const index = this.subscriberIndex % this.self.capacity
      const elem = this.self.array[index]!
      this.self.subscribers[index] -= 1
      if (this.self.subscribers[index] === 0) {
        this.self.array[index] = AbsentValue as unknown as A
        this.self.subscribersIndex += 1
      }
      this.subscriberIndex += 1
      return elem
    }
    return MutableList.Empty
  }

  pollUpTo(n: number): Array<A> {
    if (this.unsubscribed) {
      return []
    }
    this.subscriberIndex = Math.max(this.subscriberIndex, this.self.subscribersIndex)
    const size = this.self.publisherIndex - this.subscriberIndex
    const toPoll = Math.min(n, size)
    if (toPoll <= 0) {
      return []
    }
    const builder: Array<A> = []
    const pollUpToIndex = this.subscriberIndex + toPoll
    while (this.subscriberIndex !== pollUpToIndex) {
      const index = this.subscriberIndex % this.self.capacity
      const a = this.self.array[index] as A
      this.self.subscribers[index] -= 1
      if (this.self.subscribers[index] === 0) {
        this.self.array[index] = AbsentValue as unknown as A
        this.self.subscribersIndex += 1
      }
      builder.push(a)
      this.subscriberIndex += 1
    }

    return builder
  }

  unsubscribe(): void {
    if (!this.unsubscribed) {
      this.unsubscribed = true
      this.self.subscriberCount -= 1
      this.subscriberIndex = Math.max(this.subscriberIndex, this.self.subscribersIndex)
      while (this.subscriberIndex !== this.self.publisherIndex) {
        const index = this.subscriberIndex % this.self.capacity
        this.self.subscribers[index] -= 1
        if (this.self.subscribers[index] === 0) {
          this.self.array[index] = AbsentValue as unknown as A
          this.self.subscribersIndex += 1
        }
        this.subscriberIndex += 1
      }
    }
  }
}

class BoundedPubSubPow2<in out A> implements PubSub.Atomic<A> {
  array: Array<A>
  mask: number
  publisherIndex = 0
  subscribers: Array<number>
  subscriberCount = 0
  subscribersIndex = 0

  constructor(readonly capacity: number, readonly replayBuffer: ReplayBuffer<A> | undefined) {
    this.array = Array.from({ length: capacity })
    this.mask = capacity - 1
    this.subscribers = Array.from({ length: capacity })
  }

  replayWindow(): PubSub.ReplayWindow<A> {
    return this.replayBuffer ? new ReplayWindowImpl(this.replayBuffer) : emptyReplayWindow
  }

  isEmpty(): boolean {
    return this.publisherIndex === this.subscribersIndex
  }

  isFull(): boolean {
    return this.publisherIndex === this.subscribersIndex + this.capacity
  }

  size(): number {
    return this.publisherIndex - this.subscribersIndex
  }

  publish(value: A): boolean {
    if (this.isFull()) {
      return false
    }
    if (this.subscriberCount !== 0) {
      const index = this.publisherIndex & this.mask
      this.array[index] = value
      this.subscribers[index] = this.subscriberCount
      this.publisherIndex += 1
    }
    if (this.replayBuffer) {
      this.replayBuffer.offer(value)
    }
    return true
  }

  publishAll(elements: Iterable<A>): Array<A> {
    if (this.subscriberCount === 0) {
      if (this.replayBuffer) {
        this.replayBuffer.offerAll(elements)
      }
      return []
    }
    const chunk = Arr.fromIterable(elements)
    const n = chunk.length
    const size = this.publisherIndex - this.subscribersIndex
    const available = this.capacity - size
    const forPubSub = Math.min(n, available)
    if (forPubSub === 0) {
      return chunk
    }
    let iteratorIndex = 0
    const publishAllIndex = this.publisherIndex + forPubSub
    while (this.publisherIndex !== publishAllIndex) {
      const elem = chunk[iteratorIndex++]
      const index = this.publisherIndex & this.mask
      this.array[index] = elem
      this.subscribers[index] = this.subscriberCount
      this.publisherIndex += 1
      if (this.replayBuffer) {
        this.replayBuffer.offer(elem)
      }
    }
    return chunk.slice(iteratorIndex)
  }

  slide(): void {
    if (this.subscribersIndex !== this.publisherIndex) {
      const index = this.subscribersIndex & this.mask
      this.array[index] = AbsentValue as unknown as A
      this.subscribers[index] = 0
      this.subscribersIndex += 1
    }
    if (this.replayBuffer) {
      this.replayBuffer.slide()
    }
  }

  subscribe(): PubSub.BackingSubscription<A> {
    this.subscriberCount += 1
    return new BoundedPubSubPow2Subscription(this, this.publisherIndex, false)
  }
}

class BoundedPubSubPow2Subscription<in out A> implements PubSub.BackingSubscription<A> {
  constructor(
    private self: BoundedPubSubPow2<A>,
    private subscriberIndex: number,
    private unsubscribed: boolean
  ) {
  }

  isEmpty(): boolean {
    return (
      this.unsubscribed ||
      this.self.publisherIndex === this.subscriberIndex ||
      this.self.publisherIndex === this.self.subscribersIndex
    )
  }

  size() {
    if (this.unsubscribed) {
      return 0
    }
    return this.self.publisherIndex - Math.max(this.subscriberIndex, this.self.subscribersIndex)
  }

  poll(): A | MutableList.Empty {
    if (this.unsubscribed) {
      return MutableList.Empty
    }
    this.subscriberIndex = Math.max(this.subscriberIndex, this.self.subscribersIndex)
    if (this.subscriberIndex !== this.self.publisherIndex) {
      const index = this.subscriberIndex & this.self.mask
      const elem = this.self.array[index]!
      this.self.subscribers[index] -= 1
      if (this.self.subscribers[index] === 0) {
        this.self.array[index] = AbsentValue as unknown as A
        this.self.subscribersIndex += 1
      }
      this.subscriberIndex += 1
      return elem
    }
    return MutableList.Empty
  }

  pollUpTo(n: number): Array<A> {
    if (this.unsubscribed) {
      return []
    }
    this.subscriberIndex = Math.max(this.subscriberIndex, this.self.subscribersIndex)
    const size = this.self.publisherIndex - this.subscriberIndex
    const toPoll = Math.min(n, size)
    if (toPoll <= 0) {
      return []
    }
    const builder: Array<A> = []
    const pollUpToIndex = this.subscriberIndex + toPoll
    while (this.subscriberIndex !== pollUpToIndex) {
      const index = this.subscriberIndex & this.self.mask
      const elem = this.self.array[index] as A
      this.self.subscribers[index] -= 1
      if (this.self.subscribers[index] === 0) {
        this.self.array[index] = AbsentValue as unknown as A
        this.self.subscribersIndex += 1
      }
      builder.push(elem)
      this.subscriberIndex += 1
    }
    return builder
  }

  unsubscribe(): void {
    if (!this.unsubscribed) {
      this.unsubscribed = true
      this.self.subscriberCount -= 1
      this.subscriberIndex = Math.max(this.subscriberIndex, this.self.subscribersIndex)
      while (this.subscriberIndex !== this.self.publisherIndex) {
        const index = this.subscriberIndex & this.self.mask
        this.self.subscribers[index] -= 1
        if (this.self.subscribers[index] === 0) {
          this.self.array[index] = AbsentValue as unknown as A
          this.self.subscribersIndex += 1
        }
        this.subscriberIndex += 1
      }
    }
  }
}

class BoundedPubSubSingle<in out A> implements PubSub.Atomic<A> {
  publisherIndex = 0
  subscriberCount = 0
  subscribers = 0
  value: A = AbsentValue as unknown as A

  readonly capacity = 1
  constructor(readonly replayBuffer: ReplayBuffer<A> | undefined) {}

  replayWindow(): PubSub.ReplayWindow<A> {
    return this.replayBuffer ? new ReplayWindowImpl(this.replayBuffer) : emptyReplayWindow
  }

  pipe() {
    return pipeArguments(this, arguments)
  }

  isEmpty(): boolean {
    return this.subscribers === 0
  }

  isFull(): boolean {
    return !this.isEmpty()
  }

  size(): number {
    return this.isEmpty() ? 0 : 1
  }

  publish(value: A): boolean {
    if (this.isFull()) {
      return false
    }
    if (this.subscriberCount !== 0) {
      this.value = value
      this.subscribers = this.subscriberCount
      this.publisherIndex += 1
    }
    if (this.replayBuffer) {
      this.replayBuffer.offer(value)
    }
    return true
  }

  publishAll(elements: Iterable<A>): Array<A> {
    if (this.subscriberCount === 0) {
      if (this.replayBuffer) {
        this.replayBuffer.offerAll(elements)
      }
      return []
    }
    const chunk = Arr.fromIterable(elements)
    if (chunk.length === 0) {
      return chunk
    }
    if (this.publish(chunk[0])) {
      return chunk.slice(1)
    } else {
      return chunk
    }
  }

  slide(): void {
    if (this.isFull()) {
      this.subscribers = 0
      this.value = AbsentValue as unknown as A
    }
    if (this.replayBuffer) {
      this.replayBuffer.slide()
    }
  }

  subscribe(): PubSub.BackingSubscription<A> {
    this.subscriberCount += 1
    return new BoundedPubSubSingleSubscription(this, this.publisherIndex, false)
  }
}

class BoundedPubSubSingleSubscription<in out A> implements PubSub.BackingSubscription<A> {
  constructor(
    private self: BoundedPubSubSingle<A>,
    private subscriberIndex: number,
    private unsubscribed: boolean
  ) {
  }

  isEmpty(): boolean {
    return (
      this.unsubscribed ||
      this.self.subscribers === 0 ||
      this.subscriberIndex === this.self.publisherIndex
    )
  }

  size() {
    return this.isEmpty() ? 0 : 1
  }

  poll(): A | MutableList.Empty {
    if (this.isEmpty()) {
      return MutableList.Empty
    }
    const elem = this.self.value
    this.self.subscribers -= 1
    if (this.self.subscribers === 0) {
      this.self.value = AbsentValue as unknown as A
    }
    this.subscriberIndex += 1
    return elem
  }

  pollUpTo(n: number): Array<A> {
    if (this.isEmpty() || n < 1) {
      return []
    }
    const a = this.self.value
    this.self.subscribers -= 1
    if (this.self.subscribers === 0) {
      this.self.value = AbsentValue as unknown as A
    }
    this.subscriberIndex += 1
    return [a]
  }

  unsubscribe(): void {
    if (!this.unsubscribed) {
      this.unsubscribed = true
      this.self.subscriberCount -= 1
      if (this.subscriberIndex !== this.self.publisherIndex) {
        this.self.subscribers -= 1
        if (this.self.subscribers === 0) {
          this.self.value = AbsentValue as unknown as A
        }
      }
    }
  }
}

interface Node<out A> {
  value: A | AbsentValue
  subscribers: number
  next: Node<A> | null
}

class UnboundedPubSub<in out A> implements PubSub.Atomic<A> {
  publisherHead: Node<A> = {
    value: AbsentValue,
    subscribers: 0,
    next: null
  }
  publisherTail = this.publisherHead
  publisherIndex = 0
  subscribersIndex = 0

  readonly capacity = Number.MAX_SAFE_INTEGER
  constructor(readonly replayBuffer: ReplayBuffer<A> | undefined) {}

  replayWindow(): PubSub.ReplayWindow<A> {
    return this.replayBuffer ? new ReplayWindowImpl(this.replayBuffer) : emptyReplayWindow
  }

  isEmpty(): boolean {
    return this.publisherHead === this.publisherTail
  }

  isFull(): boolean {
    return false
  }

  size(): number {
    return this.publisherIndex - this.subscribersIndex
  }

  publish(value: A): boolean {
    const subscribers = this.publisherTail.subscribers
    if (subscribers !== 0) {
      this.publisherTail.next = {
        value,
        subscribers,
        next: null
      }
      this.publisherTail = this.publisherTail.next
      this.publisherIndex += 1
    }
    if (this.replayBuffer) {
      this.replayBuffer.offer(value)
    }
    return true
  }

  publishAll(elements: Iterable<A>): Array<A> {
    if (this.publisherTail.subscribers !== 0) {
      for (const a of elements) {
        this.publish(a)
      }
    } else if (this.replayBuffer) {
      this.replayBuffer.offerAll(elements)
    }
    return []
  }

  slide(): void {
    if (this.publisherHead !== this.publisherTail) {
      this.publisherHead = this.publisherHead.next!
      this.publisherHead.value = AbsentValue
      this.subscribersIndex += 1
    }
    if (this.replayBuffer) {
      this.replayBuffer.slide()
    }
  }

  subscribe(): PubSub.BackingSubscription<A> {
    this.publisherTail.subscribers += 1
    return new UnboundedPubSubSubscription(
      this,
      this.publisherTail,
      this.publisherIndex,
      false
    )
  }
}

class UnboundedPubSubSubscription<in out A> implements PubSub.BackingSubscription<A> {
  constructor(
    private self: UnboundedPubSub<A>,
    private subscriberHead: Node<A>,
    private subscriberIndex: number,
    private unsubscribed: boolean
  ) {
  }

  isEmpty(): boolean {
    if (this.unsubscribed) {
      return true
    }
    let empty = true
    let loop = true
    while (loop) {
      if (this.subscriberHead === this.self.publisherTail) {
        loop = false
      } else {
        if (this.subscriberHead.next!.value !== AbsentValue) {
          empty = false
          loop = false
        } else {
          this.subscriberHead = this.subscriberHead.next!
          this.subscriberIndex += 1
        }
      }
    }
    return empty
  }

  size() {
    if (this.unsubscribed) {
      return 0
    }
    return this.self.publisherIndex - Math.max(this.subscriberIndex, this.self.subscribersIndex)
  }

  poll(): A | MutableList.Empty {
    if (this.unsubscribed) {
      return MutableList.Empty
    }
    let loop = true
    let polled: A | MutableList.Empty = MutableList.Empty
    while (loop) {
      if (this.subscriberHead === this.self.publisherTail) {
        loop = false
      } else {
        const elem = this.subscriberHead.next!.value
        if (elem !== AbsentValue) {
          polled = elem
          this.subscriberHead.subscribers -= 1
          if (this.subscriberHead.subscribers === 0) {
            this.self.publisherHead = this.self.publisherHead.next!
            this.self.publisherHead.value = AbsentValue
            this.self.subscribersIndex += 1
          }
          loop = false
        }
        this.subscriberHead = this.subscriberHead.next!
        this.subscriberIndex += 1
      }
    }
    return polled
  }

  pollUpTo(n: number): Array<A> {
    const builder: Array<A> = []
    let i = 0
    while (i !== n) {
      const a = this.poll()
      if (a === MutableList.Empty) {
        i = n
      } else {
        builder.push(a)
        i += 1
      }
    }
    return builder
  }

  unsubscribe(): void {
    if (!this.unsubscribed) {
      this.unsubscribed = true
      this.self.publisherTail.subscribers -= 1
      while (this.subscriberHead !== this.self.publisherTail) {
        if (this.subscriberHead.next!.value !== AbsentValue) {
          this.subscriberHead.subscribers -= 1
          if (this.subscriberHead.subscribers === 0) {
            this.self.publisherHead = this.self.publisherHead.next!
            this.self.publisherHead.value = AbsentValue
            this.self.subscribersIndex += 1
          }
        }
        this.subscriberHead = this.subscriberHead.next!
      }
    }
  }
}

class SubscriptionImpl<in out A> implements Subscription<A> {
  readonly [SubscriptionTypeId] = {
    _A: identity
  }

  constructor(
    readonly pubsub: PubSub.Atomic<A>,
    readonly subscribers: PubSub.Subscribers<A>,
    readonly subscription: PubSub.BackingSubscription<A>,
    readonly pollers: MutableList.MutableList<Deferred.Deferred<A>>,
    readonly shutdownHook: Effect.Latch,
    readonly shutdownFlag: MutableRef.MutableRef<boolean>,
    readonly strategy: PubSub.Strategy<A>,
    readonly replayWindow: PubSub.ReplayWindow<A>
  ) {}

  pipe() {
    return pipeArguments(this, arguments)
  }
}

class PubSubImpl<in out A> implements PubSub<A> {
  readonly [TypeId] = {
    _A: identity
  }

  constructor(
    readonly pubsub: PubSub.Atomic<A>,
    readonly subscribers: PubSub.Subscribers<A>,
    readonly scope: Scope.Scope.Closeable,
    readonly shutdownHook: Effect.Latch,
    readonly shutdownFlag: MutableRef.MutableRef<boolean>,
    readonly strategy: PubSub.Strategy<A>
  ) {}

  pipe() {
    return pipeArguments(this, arguments)
  }
}

const unsafeMakePubSub = <A>(
  pubsub: PubSub.Atomic<A>,
  subscribers: PubSub.Subscribers<A>,
  scope: Scope.Scope.Closeable,
  shutdownHook: Effect.Latch,
  shutdownFlag: MutableRef.MutableRef<boolean>,
  strategy: PubSub.Strategy<A>
): PubSub<A> => new PubSubImpl(pubsub, subscribers, scope, shutdownHook, shutdownFlag, strategy)

const ensureCapacity = (capacity: number): void => {
  if (capacity <= 0) {
    throw new Error(`Cannot construct PubSub with capacity of ${capacity}`)
  }
}

// -----------------------------------------------------------------------------
// PubSub.Strategy
// -----------------------------------------------------------------------------

/**
 * A strategy that applies back pressure to publishers when the `PubSub` is at
 * capacity. This guarantees that all subscribers will receive all messages
 * published to the `PubSub` while they are subscribed. However, it creates the
 * risk that a slow subscriber will slow down the rate at which messages
 * are published and received by other subscribers.
 *
 * @example
 * ```ts
 * import { Effect, PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // Create PubSub with back pressure strategy (default for bounded)
 *   const pubsub = yield* PubSub.bounded<string>(2)
 *
 *   // Or explicitly create with back pressure strategy
 *   const customPubsub = yield* PubSub.make<string>({
 *     atomicPubSub: () => PubSub.makeAtomicBounded(2),
 *     strategy: () => new PubSub.BackPressureStrategy()
 *   })
 *
 *   // Fill the PubSub
 *   yield* PubSub.publish(pubsub, "msg1")
 *   yield* PubSub.publish(pubsub, "msg2")
 *
 *   // This will suspend until space becomes available
 *   const publishFiber = yield* Effect.fork(
 *     PubSub.publish(pubsub, "msg3")
 *   )
 *
 *   // Create subscriber to free space
 *   yield* Effect.scoped(Effect.gen(function*() {
 *     const subscription = yield* PubSub.subscribe(pubsub)
 *     yield* PubSub.take(subscription) // frees space, publisher resumes
 *   }))
 *
 *   const published = yield* Fiber.join(publishFiber)
 *   console.log("Published after backpressure:", published) // true
 * })
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export class BackPressureStrategy<in out A> implements PubSub.Strategy<A> {
  publishers: MutableList.MutableList<
    readonly [A, Deferred.Deferred<boolean>, boolean]
  > = MutableList.make()

  get shutdown(): Effect.Effect<void> {
    return Effect.withFiber((fiber) =>
      Effect.forEach(
        MutableList.takeAll(this.publishers),
        ([_, deferred, last]) => last ? Deferred.interruptWith(deferred, fiber.id) : Effect.void,
        { concurrency: "unbounded", discard: true }
      )
    )
  }

  handleSurplus(
    pubsub: PubSub.Atomic<A>,
    subscribers: PubSub.Subscribers<A>,
    elements: Iterable<A>,
    isShutdown: MutableRef.MutableRef<boolean>
  ): Effect.Effect<boolean> {
    return Effect.suspend(() => {
      const deferred = Deferred.unsafeMake<boolean>()
      this.unsafeOffer(elements, deferred)
      this.unsafeOnPubSubEmptySpace(pubsub, subscribers)
      this.unsafeCompleteSubscribers(pubsub, subscribers)
      return (MutableRef.get(isShutdown) ? Effect.interrupt : Deferred.await(deferred)).pipe(
        Effect.onInterrupt(Effect.sync(() => this.unsafeRemove(deferred)))
      )
    })
  }

  unsafeOnPubSubEmptySpace(
    pubsub: PubSub.Atomic<A>,
    subscribers: PubSub.Subscribers<A>
  ): void {
    let keepPolling = true
    while (keepPolling && !pubsub.isFull()) {
      const publisher = MutableList.take(this.publishers)
      if (publisher === MutableList.Empty) {
        keepPolling = false
      } else {
        const [value, deferred] = publisher
        const published = pubsub.publish(value)
        if (published && publisher[2]) {
          Deferred.unsafeDone(deferred, Exit.succeed(true))
        } else if (!published) {
          MutableList.prepend(this.publishers, publisher)
        }
        this.unsafeCompleteSubscribers(pubsub, subscribers)
      }
    }
  }

  unsafeCompletePollers(
    pubsub: PubSub.Atomic<A>,
    subscribers: PubSub.Subscribers<A>,
    subscription: PubSub.BackingSubscription<A>,
    pollers: MutableList.MutableList<Deferred.Deferred<A>>
  ): void {
    return unsafeStrategyCompletePollers(this, pubsub, subscribers, subscription, pollers)
  }

  unsafeCompleteSubscribers(pubsub: PubSub.Atomic<A>, subscribers: PubSub.Subscribers<A>): void {
    return unsafeStrategyCompleteSubscribers(this, pubsub, subscribers)
  }

  private unsafeOffer(elements: Iterable<A>, deferred: Deferred.Deferred<boolean>): void {
    const iterator = elements[Symbol.iterator]()
    let next: IteratorResult<A> = iterator.next()
    if (!next.done) {
      // eslint-disable-next-line no-constant-condition
      while (1) {
        const value = next.value
        next = iterator.next()
        if (next.done) {
          MutableList.append(this.publishers, [value, deferred, true])
          break
        }
        MutableList.append(this.publishers, [value, deferred, false])
      }
    }
  }

  unsafeRemove(deferred: Deferred.Deferred<boolean>): void {
    MutableList.filter(this.publishers, ([_, d]) => d !== deferred)
  }
}

/**
 * A strategy that drops new messages when the `PubSub` is at capacity. This
 * guarantees that a slow subscriber will not slow down the rate at which
 * messages are published. However, it creates the risk that a slow
 * subscriber will slow down the rate at which messages are received by
 * other subscribers and that subscribers may not receive all messages
 * published to the `PubSub` while they are subscribed.
 *
 * @example
 * ```ts
 * import { Effect, PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // Create PubSub with dropping strategy
 *   const pubsub = yield* PubSub.dropping<string>(2)
 *
 *   // Or explicitly create with dropping strategy
 *   const customPubsub = yield* PubSub.make<string>({
 *     atomicPubSub: () => PubSub.makeAtomicBounded(2),
 *     strategy: () => new PubSub.DroppingStrategy()
 *   })
 *
 *   // Fill the PubSub
 *   const pub1 = yield* PubSub.publish(pubsub, "msg1") // true
 *   const pub2 = yield* PubSub.publish(pubsub, "msg2") // true
 *   const pub3 = yield* PubSub.publish(pubsub, "msg3") // false (dropped)
 *
 *   console.log("Publication results:", [pub1, pub2, pub3]) // [true, true, false]
 *
 *   // Subscribers will only see the first two messages
 *   yield* Effect.scoped(Effect.gen(function*() {
 *     const subscription = yield* PubSub.subscribe(pubsub)
 *     const messages = yield* PubSub.takeAll(subscription)
 *     console.log("Received messages:", messages) // ["msg1", "msg2"]
 *   }))
 * })
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export class DroppingStrategy<in out A> implements PubSub.Strategy<A> {
  get shutdown(): Effect.Effect<void> {
    return Effect.void
  }

  handleSurplus(
    _pubsub: PubSub.Atomic<A>,
    _subscribers: PubSub.Subscribers<A>,
    _elements: Iterable<A>,
    _isShutdown: MutableRef.MutableRef<boolean>
  ): Effect.Effect<boolean> {
    return Effect.succeed(false)
  }

  unsafeOnPubSubEmptySpace(
    _pubsub: PubSub.Atomic<A>,
    _subscribers: PubSub.Subscribers<A>
  ): void {
    //
  }

  unsafeCompletePollers(
    pubsub: PubSub.Atomic<A>,
    subscribers: PubSub.Subscribers<A>,
    subscription: PubSub.BackingSubscription<A>,
    pollers: MutableList.MutableList<Deferred.Deferred<A>>
  ): void {
    return unsafeStrategyCompletePollers(this, pubsub, subscribers, subscription, pollers)
  }

  unsafeCompleteSubscribers(pubsub: PubSub.Atomic<A>, subscribers: PubSub.Subscribers<A>): void {
    return unsafeStrategyCompleteSubscribers(this, pubsub, subscribers)
  }
}

/**
 * A strategy that adds new messages and drops old messages when the `PubSub` is
 * at capacity. This guarantees that a slow subscriber will not slow down
 * the rate at which messages are published and received by other
 * subscribers. However, it creates the risk that a slow subscriber will
 * not receive some messages published to the `PubSub` while it is subscribed.
 *
 * @example
 * ```ts
 * import { Effect, PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // Create PubSub with sliding strategy
 *   const pubsub = yield* PubSub.sliding<string>(2)
 *
 *   // Or explicitly create with sliding strategy
 *   const customPubsub = yield* PubSub.make<string>({
 *     atomicPubSub: () => PubSub.makeAtomicBounded(2),
 *     strategy: () => new PubSub.SlidingStrategy()
 *   })
 *
 *   // Publish messages that exceed capacity
 *   yield* PubSub.publish(pubsub, "msg1") // stored
 *   yield* PubSub.publish(pubsub, "msg2") // stored
 *   yield* PubSub.publish(pubsub, "msg3") // "msg1" evicted, "msg3" stored
 *   yield* PubSub.publish(pubsub, "msg4") // "msg2" evicted, "msg4" stored
 *
 *   // Subscribers will see the most recent messages
 *   yield* Effect.scoped(Effect.gen(function*() {
 *     const subscription = yield* PubSub.subscribe(pubsub)
 *     const messages = yield* PubSub.takeAll(subscription)
 *     console.log("Recent messages:", messages) // ["msg3", "msg4"]
 *   }))
 * })
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export class SlidingStrategy<in out A> implements PubSub.Strategy<A> {
  get shutdown(): Effect.Effect<void> {
    return Effect.void
  }

  handleSurplus(
    pubsub: PubSub.Atomic<A>,
    subscribers: PubSub.Subscribers<A>,
    elements: Iterable<A>,
    _isShutdown: MutableRef.MutableRef<boolean>
  ): Effect.Effect<boolean> {
    return Effect.sync(() => {
      this.unsafeSlidingPublish(pubsub, elements)
      this.unsafeCompleteSubscribers(pubsub, subscribers)
      return true
    })
  }

  unsafeOnPubSubEmptySpace(
    _pubsub: PubSub.Atomic<A>,
    _subscribers: PubSub.Subscribers<A>
  ): void {
    //
  }

  unsafeCompletePollers(
    pubsub: PubSub.Atomic<A>,
    subscribers: PubSub.Subscribers<A>,
    subscription: PubSub.BackingSubscription<A>,
    pollers: MutableList.MutableList<Deferred.Deferred<A>>
  ): void {
    return unsafeStrategyCompletePollers(this, pubsub, subscribers, subscription, pollers)
  }

  unsafeCompleteSubscribers(pubsub: PubSub.Atomic<A>, subscribers: PubSub.Subscribers<A>): void {
    return unsafeStrategyCompleteSubscribers(this, pubsub, subscribers)
  }

  unsafeSlidingPublish(pubsub: PubSub.Atomic<A>, elements: Iterable<A>): void {
    const it = elements[Symbol.iterator]()
    let next = it.next()
    if (!next.done && pubsub.capacity > 0) {
      let a = next.value
      let loop = true
      while (loop) {
        pubsub.slide()
        const pub = pubsub.publish(a)
        if (pub && (next = it.next()) && !next.done) {
          a = next.value
        } else if (pub) {
          loop = false
        }
      }
    }
  }
}

const unsafeStrategyCompletePollers = <A>(
  strategy: PubSub.Strategy<A>,
  pubsub: PubSub.Atomic<A>,
  subscribers: PubSub.Subscribers<A>,
  subscription: PubSub.BackingSubscription<A>,
  pollers: MutableList.MutableList<Deferred.Deferred<A>>
): void => {
  let keepPolling = true
  while (keepPolling && !subscription.isEmpty()) {
    const poller = MutableList.take(pollers)
    if (poller === MutableList.Empty) {
      removeSubscribers(subscribers, subscription, pollers)
      if (pollers.length === 0) {
        keepPolling = false
      } else {
        addSubscribers(subscribers, subscription, pollers)
      }
    } else {
      const pollResult = subscription.poll()
      if (pollResult === MutableList.Empty) {
        MutableList.prepend(pollers, poller)
      } else {
        Deferred.unsafeDone(poller, Exit.succeed(pollResult))
        strategy.unsafeOnPubSubEmptySpace(pubsub, subscribers)
      }
    }
  }
}

const unsafeStrategyCompleteSubscribers = <A>(
  strategy: PubSub.Strategy<A>,
  pubsub: PubSub.Atomic<A>,
  subscribers: PubSub.Subscribers<A>
): void => {
  for (
    const [subscription, pollersSet] of subscribers
  ) {
    for (const pollers of pollersSet) {
      strategy.unsafeCompletePollers(pubsub, subscribers, subscription, pollers)
    }
  }
}

interface ReplayNode<A> {
  value: A | AbsentValue
  next: ReplayNode<A> | null
}

class ReplayBuffer<A> {
  constructor(readonly capacity: number) {}

  head: ReplayNode<A> = { value: AbsentValue, next: null }
  tail: ReplayNode<A> = this.head
  size = 0
  index = 0

  slide() {
    this.index++
  }
  offer(a: A): void {
    this.tail.value = a
    this.tail.next = {
      value: AbsentValue,
      next: null
    }
    this.tail = this.tail.next
    if (this.size === this.capacity) {
      this.head = this.head.next!
    } else {
      this.size += 1
    }
  }
  offerAll(as: Iterable<A>): void {
    for (const a of as) {
      this.offer(a)
    }
  }
}

class ReplayWindowImpl<A> implements PubSub.ReplayWindow<A> {
  head: ReplayNode<A>
  index: number
  remaining: number
  constructor(readonly buffer: ReplayBuffer<A>) {
    this.index = buffer.index
    this.remaining = buffer.size
    this.head = buffer.head
  }
  fastForward() {
    while (this.index < this.buffer.index) {
      this.head = this.head.next!
      this.index++
    }
  }
  take(): A | undefined {
    if (this.remaining === 0) {
      return undefined
    } else if (this.index < this.buffer.index) {
      this.fastForward()
    }
    this.remaining--
    const value = this.head.value
    this.head = this.head.next!
    return value as A
  }
  takeN(n: number): Array<A> {
    if (this.remaining === 0) {
      return []
    } else if (this.index < this.buffer.index) {
      this.fastForward()
    }
    const len = Math.min(n, this.remaining)
    const items = new Array(len)
    for (let i = 0; i < len; i++) {
      const value = this.head.value as A
      this.head = this.head.next!
      items[i] = value
    }
    this.remaining -= len
    return items
  }
  takeAll(): Array<A> {
    return this.takeN(this.remaining)
  }
}

const emptyReplayWindow: PubSub.ReplayWindow<never> = {
  remaining: 0,
  take: () => undefined,
  takeN: () => [],
  takeAll: () => []
}
