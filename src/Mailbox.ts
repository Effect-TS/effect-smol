/**
 * @since 3.8.0
 * @experimental
 */
import type { Cause } from "./Cause.js"
import type { Effect } from "./Effect.js"
import type { Exit } from "./Exit.js"
import { identity } from "./Function.js"
import type { Inspectable } from "./Inspectable.js"
import * as internal from "./internal/mailbox.js"
import type { Option } from "./Option.js"
import { hasProperty } from "./Predicate.js"
import type * as Types from "./Types.js"

/**
 * @since 3.8.0
 * @experimental
 * @category type ids
 */
export const TypeId: unique symbol = internal.TypeId

/**
 * @since 3.8.0
 * @experimental
 * @category type ids
 */
export type TypeId = typeof TypeId

/**
 * @since 3.8.0
 * @experimental
 * @category type ids
 */
export const ReadonlyTypeId: unique symbol = internal.ReadonlyTypeId

/**
 * @since 3.8.0
 * @experimental
 * @category type ids
 */
export type ReadonlyTypeId = typeof ReadonlyTypeId

/**
 * @since 3.8.0
 * @experimental
 * @category guards
 */
export const isMailbox = <A = unknown, E = unknown>(
  u: unknown
): u is ReadonlyMailbox<A, E> => hasProperty(u, TypeId)

/**
 * A `Mailbox` is a queue that can be signaled to be done or failed.
 *
 * @since 3.8.0
 * @experimental
 * @category models
 */
export interface ReadonlyMailbox<out A, out E = never> extends Inspectable {
  readonly [ReadonlyTypeId]: Mailbox.ReadonlyVariance<A, E>
}

/**
 * A `Mailbox` is a queue that can be signaled to be done or failed.
 *
 * @since 3.8.0
 * @experimental
 * @category models
 */
export interface Mailbox<in out A, in out E = never> extends ReadonlyMailbox<A, E> {
  readonly [TypeId]: Mailbox.Variance<A, E>
}

/**
 * @since 3.8.0
 * @experimental
 * @category models
 */
export declare namespace Mailbox {
  /**
   * @since 3.8.0
   * @experimental
   * @category models
   */
  export interface ReadonlyVariance<A, E> {
    _A: Types.Covariant<A>
    _E: Types.Covariant<E>
  }

  /**
   * @since 3.8.0
   * @experimental
   * @category models
   */
  export interface Variance<A, E> {
    _A: Types.Invariant<A>
    _E: Types.Invariant<E>
  }
}

/**
 * Add a message to the mailbox. Returns `false` if the mailbox is done.
 *
 * @experimental
 * @category offering
 * @since 4.0.0
 */
export const offer: <A, E>(self: Mailbox<A, E>, message: A) => Effect<boolean> = internal.offer as any

/**
 * Add a message to the mailbox. Returns `false` if the mailbox is done.
 *
 * @experimental
 * @category offering
 * @since 4.0.0
 */
export const unsafeOffer: <A, E>(self: Mailbox<A, E>, message: A) => boolean = internal.unsafeOffer as any

/**
 * Add multiple messages to the mailbox. Returns the remaining messages that
 * were not added.
 *
 * @experimental
 * @category offering
 * @since 4.0.0
 */
export const offerAll: <A, E>(self: Mailbox<A, E>, messages: Iterable<A>) => Effect<Array<A>> = internal.offerAll as any

/**
 * Add multiple messages to the mailbox. Returns the remaining messages that
 * were not added.
 *
 * @experimental
 * @category offering
 * @since 4.0.0
 */
export const unsafeOfferAll: <A, E>(self: Mailbox<A, E>, messages: Iterable<A>) => Array<A> = internal
  .unsafeOfferAll as any

/**
 * Fail the mailbox with an error. If the mailbox is already done, `false` is
 * returned.
 *
 * @experimental
 * @category completion
 * @since 4.0.0
 */
export const fail: <A, E>(self: Mailbox<A, E>, error: E) => Effect<boolean> = internal.fail as any

/**
 * Fail the mailbox with a cause. If the mailbox is already done, `false` is
 * returned.
 *
 * @experimental
 * @category completion
 * @since 4.0.0
 */
export const failCause: <A, E>(self: Mailbox<A, E>, cause: Cause<E>) => Effect<boolean> = internal.failCause as any

/**
 * Signal that the mailbox is complete. If the mailbox is already done, `false` is
 * returned.
 *
 * @experimental
 * @category completion
 * @since 4.0.0
 */
export const end: <A, E>(self: Mailbox<A, E>) => Effect<boolean> = internal.end as any

/**
 * Signal that the mailbox is done. If the mailbox is already done, `false` is
 * returned.
 *
 * @experimental
 * @category completion
 * @since 4.0.0
 */
export const done: <A, E>(self: Mailbox<A, E>, exit: Exit<void, E>) => Effect<boolean> = internal.done as any

/**
 * Signal that the mailbox is done. If the mailbox is already done, `false` is
 * returned.
 *
 * @experimental
 * @category completion
 * @since 4.0.0
 */
export const unsafeDone: <A, E>(self: Mailbox<A, E>, exit: Exit<void, E>) => boolean = internal.unsafeDone as any

/**
 * Shutdown the mailbox, canceling any pending operations.
 * If the mailbox is already done, `false` is returned.
 *
 * @experimental
 * @category completion
 * @since 4.0.0
 */
export const shutdown: <A, E>(self: Mailbox<A, E>) => Effect<boolean> = internal.shutdown as any

/**
 * Take all messages from the mailbox, returning an empty array if the mailbox
 * is empty or done.
 *
 * @experimental
 * @category taking
 * @since 4.0.0
 */
export const clear: <A, E>(self: ReadonlyMailbox<A, E>) => Effect<Array<A>, E> = internal.clear as any

/**
 * Take all messages from the mailbox, or wait for messages to be available.
 *
 * If the mailbox is done, the `done` flag will be `true`. If the mailbox
 * fails, the Effect will fail with the error.
 *
 * @experimental
 * @category taking
 * @since 4.0.0
 */
export const takeAll: <A, E>(
  self: ReadonlyMailbox<A, E>
) => Effect<readonly [messages: Array<A>, done: boolean], E> = internal.takeAll as any

/**
 * Take a specified number of messages from the mailbox. It will only take
 * up to the capacity of the mailbox.
 *
 * If the mailbox is done, the `done` flag will be `true`. If the mailbox
 * fails, the Effect will fail with the error.
 *
 * @experimental
 * @category taking
 * @since 4.0.0
 */
export const takeN: <A, E>(
  self: ReadonlyMailbox<A, E>,
  n: number
) => Effect<readonly [messages: Array<A>, done: boolean], E> = internal.takeN as any

/**
 * Take a variable number of messages from the mailbox, between specified min and max.
 * It will only take up to the capacity of the mailbox.
 *
 * If the mailbox is done, the `done` flag will be `true`. If the mailbox
 * fails, the Effect will fail with the error.
 *
 * @experimental
 * @category taking
 * @since 4.0.0
 */
export const takeBetween: <A, E>(
  self: ReadonlyMailbox<A, E>,
  min: number,
  max: number
) => Effect<readonly [messages: Array<A>, done: boolean], E> = internal.takeBetween as any

/**
 * Take a single message from the mailbox, or wait for a message to be
 * available.
 *
 * If the mailbox is done, it will fail with `Option.None`. If the
 * mailbox fails, the Effect will fail with `Option.some(error)`.
 *
 * @experimental
 * @category taking
 * @since 4.0.0
 */
export const take: <A, E>(
  self: ReadonlyMailbox<A, E>
) => Effect<A, Option<E>> = internal.take as any

const await_: <A, E>(
  self: ReadonlyMailbox<A, E>
) => Effect<void, E> = internal.await_ as any

export {
  /**
   * Wait for the mailbox to be done.
   *
   * @experimental
   * @category completion
   * @since 4.0.0
   */
  await_ as await
}

/**
 * Check the size of the mailbox.
 *
 * If the mailbox is complete, it will return `None`.
 *
 * @experimental
 * @category size
 * @since 4.0.0
 */
export const size: <A, E>(
  self: ReadonlyMailbox<A, E>
) => Effect<Option<number>> = internal.size as any

/**
 * Check the size of the mailbox.
 *
 * If the mailbox is complete, it will return `None`.
 *
 * @experimental
 * @category size
 * @since 4.0.0
 */
export const unsafeSize: <A, E>(
  self: ReadonlyMailbox<A, E>
) => Option<number> = internal.unsafeSize as any

/**
 * A `Mailbox` is a queue that can be signaled to be done or failed.
 *
 * @since 3.8.0
 * @experimental
 * @category constructors
 * @example
 * ```ts
 * import { Effect, Mailbox } from "effect"
 *
 * Effect.gen(function*() {
 *   const mailbox = yield* Mailbox.make<number, string>()
 *
 *   // add messages to the mailbox
 *   yield* mailbox.offer(1)
 *   yield* mailbox.offer(2)
 *   yield* mailbox.offerAll([3, 4, 5])
 *
 *   // take messages from the mailbox
 *   const [messages, done] = yield* mailbox.takeAll
 *   assert.deepStrictEqual(messages, [1, 2, 3, 4, 5])
 *   assert.strictEqual(done, false)
 *
 *   // signal that the mailbox is done
 *   yield* mailbox.end
 *   const [messages2, done2] = yield* mailbox.takeAll
 *   assert.deepStrictEqual(messages2, [])
 *   assert.strictEqual(done2, true)
 *
 *   // signal that the mailbox has failed
 *   yield* mailbox.fail("boom")
 * })
 * ```
 */
export const make: <A, E = never>(
  capacity?:
    | number
    | {
      readonly capacity?: number | undefined
      readonly strategy?: "suspend" | "dropping" | "sliding" | undefined
    }
    | undefined
) => Effect<Mailbox<A, E>> = internal.make

/**
 * @since 4.0.0
 * @experimental
 * @category conversions
 */
export const asReadonly: <A, E>(self: Mailbox<A, E>) => ReadonlyMailbox<A, E> = identity

/**
 * Run an `Effect` into a `Mailbox`, where success ends the mailbox and failure
 * fails the mailbox.
 *
 * @since 3.8.0
 * @experimental
 * @category combinators
 */
export const into: {
  <A, E>(
    self: Mailbox<A, E>
  ): <AX, EX extends E, RX>(
    effect: Effect<AX, EX, RX>
  ) => Effect<boolean, never, RX>
  <AX, E, EX extends E, RX, A>(
    effect: Effect<AX, EX, RX>,
    self: Mailbox<A, E>
  ): Effect<boolean, never, RX>
} = internal.into as any
