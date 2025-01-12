/**
 * @since 3.8.0
 * @experimental
 */
import * as Arr from "./Array.js"
import type { Cause } from "./Cause.js"
import type { Effect } from "./Effect.js"
import type { Exit } from "./Exit.js"
import { dual, identity } from "./Function.js"
import type { Inspectable } from "./Inspectable.js"
import * as core from "./internal/core.js"
import { PipeInspectableProto } from "./internal/effectable.js"
import * as Iterable from "./Iterable.js"
import * as MutableList from "./MutableList.js"
import * as Option from "./Option.js"
import { hasProperty } from "./Predicate.js"
import type { Scheduler } from "./Scheduler.js"
import type * as Types from "./Types.js"

/**
 * @since 3.8.0
 * @experimental
 * @category type ids
 */
export const TypeId: unique symbol = Symbol.for("effect/Mailbox")

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
export const ReadonlyTypeId: unique symbol = Symbol.for("effect/Mailbox/ReadonlyMailbox")

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
): u is Mailbox<A, E> => hasProperty(u, TypeId)

/**
 * @since 3.8.0
 * @experimental
 * @category guards
 */
export const isReadonlyMailbox = <A = unknown, E = unknown>(
  u: unknown
): u is ReadonlyMailbox<A, E> => hasProperty(u, ReadonlyTypeId)

/**
 * A `Mailbox` is a queue that can be signaled to be done or failed.
 *
 * @since 3.8.0
 * @experimental
 * @category models
 */
export interface ReadonlyMailbox<out A, out E = never> extends Inspectable {
  readonly [ReadonlyTypeId]: Mailbox.ReadonlyVariance<A, E>
  readonly strategy: "suspend" | "dropping" | "sliding"
  readonly scheduler: Scheduler
  capacity: number
  messages: MutableList.MutableList<any>
  state: Mailbox.State<any, any>
  scheduleRunning: boolean
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

const MailboxProto = {
  [TypeId]: {
    _A: identity,
    _E: identity
  },
  ...PipeInspectableProto,
  toJSON(this: Mailbox<unknown, unknown>) {
    return {
      _id: "effect/Mailbox",
      state: this.state._tag,
      size: unsafeSize(this).toJSON()
    }
  }
}

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
export const make = <A, E = never>(
  capacity?:
    | number
    | {
      readonly capacity?: number | undefined
      readonly strategy?: "suspend" | "dropping" | "sliding" | undefined
    }
    | undefined
): Effect<Mailbox<A, E>> =>
  core.withFiber((fiber) => {
    const self = Object.create(MailboxProto)
    self.scheduler = fiber.currentScheduler
    self.capacity = typeof capacity === "number" ? capacity : (capacity?.capacity ?? Number.POSITIVE_INFINITY)
    self.strategy = typeof capacity === "number" ? "suspend" : (capacity?.strategy ?? "suspend")
    self.messages = MutableList.make()
    self.scheduleRunning = false
    self.state = {
      _tag: "Open",
      takers: new Set(),
      offers: new Set(),
      awaiters: new Set()
    }
    return core.succeed(self)
  })

/**
 * Add a message to the mailbox. Returns `false` if the mailbox is done.
 *
 * @experimental
 * @category offering
 * @since 4.0.0
 */
export const offer = <A, E>(self: Mailbox<A, E>, message: A): Effect<boolean> =>
  core.suspend(() => {
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
 * Add a message to the mailbox. Returns `false` if the mailbox is done.
 *
 * @experimental
 * @category offering
 * @since 4.0.0
 */
export const unsafeOffer = <A, E>(self: Mailbox<A, E>, message: A): boolean => {
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
 * Add multiple messages to the mailbox. Returns the remaining messages that
 * were not added.
 *
 * @experimental
 * @category offering
 * @since 4.0.0
 */
export const offerAll = <A, E>(self: Mailbox<A, E>, messages: Iterable<A>): Effect<Array<A>> =>
  core.suspend(() => {
    if (self.state._tag !== "Open") {
      return core.succeed(Arr.fromIterable(messages))
    }
    const remaining = unsafeOfferAll(self, messages)
    if (remaining.length === 0) {
      return exitEmpty
    } else if (self.strategy === "dropping") {
      return core.succeed(remaining)
    }
    return offerRemainingArray(self, remaining)
  })

/**
 * Add multiple messages to the mailbox. Returns the remaining messages that
 * were not added.
 *
 * @experimental
 * @category offering
 * @since 4.0.0
 */
export const unsafeOfferAll = <A, E>(self: Mailbox<A, E>, messages: Iterable<A>): Array<A> => {
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
 * Fail the mailbox with an error. If the mailbox is already done, `false` is
 * returned.
 *
 * @experimental
 * @category completion
 * @since 4.0.0
 */
export const fail = <A, E>(self: Mailbox<A, E>, error: E) => done(self, core.exitFail(error))

/**
 * Fail the mailbox with a cause. If the mailbox is already done, `false` is
 * returned.
 *
 * @experimental
 * @category completion
 * @since 4.0.0
 */
export const failCause = <A, E>(self: Mailbox<A, E>, cause: Cause<E>) => done(self, core.exitFailCause(cause))

/**
 * Signal that the mailbox is complete. If the mailbox is already done, `false` is
 * returned.
 *
 * @experimental
 * @category completion
 * @since 4.0.0
 */
export const end = <A, E>(self: Mailbox<A, E>): Effect<boolean> => done(self, core.exitVoid)

/**
 * Signal that the mailbox is done. If the mailbox is already done, `false` is
 * returned.
 *
 * @experimental
 * @category completion
 * @since 4.0.0
 */
export const done = <A, E>(self: Mailbox<A, E>, exit: Exit<void, E>): Effect<boolean> =>
  core.sync(() => unsafeDone(self, exit))

/**
 * Signal that the mailbox is done. If the mailbox is already done, `false` is
 * returned.
 *
 * @experimental
 * @category completion
 * @since 4.0.0
 */
export const unsafeDone = <A, E>(self: Mailbox<A, E>, exit: Exit<void, E>): boolean => {
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
 * Shutdown the mailbox, canceling any pending operations.
 * If the mailbox is already done, `false` is returned.
 *
 * @experimental
 * @category completion
 * @since 4.0.0
 */
export const shutdown = <A, E>(self: Mailbox<A, E>): Effect<boolean> =>
  core.sync(() => {
    if (self.state._tag === "Done") {
      return true
    }
    MutableList.clear(self.messages)
    const offers = self.state.offers
    finalize(self, self.state._tag === "Open" ? core.exitVoid : self.state.exit)
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
 * Take all messages from the mailbox, returning an empty array if the mailbox
 * is empty or done.
 *
 * @experimental
 * @category taking
 * @since 4.0.0
 */
export const clear = <A, E>(self: ReadonlyMailbox<A, E>): Effect<Array<A>, E> =>
  core.suspend(() => {
    if (self.state._tag === "Done") {
      return core.exitAs(self.state.exit, empty)
    }
    const messages = unsafeTakeAll(self)
    releaseCapacity(self)
    return core.succeed(messages)
  })

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
export const takeAll = <A, E>(self: ReadonlyMailbox<A, E>): Effect<readonly [messages: Array<A>, done: boolean], E> =>
  takeBetween(self, 1, Number.POSITIVE_INFINITY)

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
export const takeN = <A, E>(
  self: ReadonlyMailbox<A, E>,
  n: number
): Effect<readonly [messages: Array<A>, done: boolean], E> => takeBetween(self, n, n)

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
export const takeBetween = <A, E>(
  self: ReadonlyMailbox<A, E>,
  min: number,
  max: number
): Effect<readonly [messages: Array<A>, done: boolean], E> =>
  core.suspend(() => unsafeTakeBetween(self, min, max) ?? core.andThen(awaitTake(self), takeBetween(self, 1, max)))

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
export const take = <A, E>(self: ReadonlyMailbox<A, E>): Effect<A, Option.Option<E>> =>
  core.suspend(
    () => unsafeTake(self) ?? core.andThen(awaitTakeOption(self), take(self))
  )

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
export const unsafeTake = <A, E>(self: ReadonlyMailbox<A, E>): Exit<A, Option.Option<E>> | undefined => {
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
    return self.messages.length > 0
      ? core.exitSucceed(MutableList.take(self.messages)!)
      : undefined
  }
  return undefined
}

const await_ = <A, E>(self: ReadonlyMailbox<A, E>): Effect<void, E> =>
  core.async<void, E>((resume) => {
    if (self.state._tag === "Done") {
      return resume(self.state.exit)
    }
    self.state.awaiters.add(resume)
    return core.sync(() => {
      if (self.state._tag !== "Done") {
        self.state.awaiters.delete(resume)
      }
    })
  })

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
export const size = <A, E>(self: ReadonlyMailbox<A, E>): Effect<Option.Option<number>> =>
  core.sync(() => unsafeSize(self))

/**
 * Check the size of the mailbox.
 *
 * If the mailbox is complete, it will return `None`.
 *
 * @experimental
 * @category size
 * @since 4.0.0
 */
export const unsafeSize = <A, E>(self: ReadonlyMailbox<A, E>): Option.Option<number> =>
  self.state._tag === "Done" ? Option.none() : Option.some(self.messages.length)

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
} = dual(
  2,
  <AX, E, EX extends E, RX, A>(
    effect: Effect<AX, EX, RX>,
    self: Mailbox<A, E>
  ): Effect<boolean, never, RX> =>
    core.uninterruptibleMask((restore) =>
      core.matchCauseEffect(restore(effect), {
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

const releaseTaker = <A, E>(self: Mailbox<A, E>) => {
  self.scheduleRunning = false
  if (self.state._tag === "Done") {
    return
  } else if (self.state.takers.size === 0) {
    return
  }
  const taker = Iterable.unsafeHead(self.state.takers)
  self.state.takers.delete(taker)
  taker(core.exitVoid)
}

const scheduleReleaseTaker = <A, E>(self: Mailbox<A, E>) => {
  if (self.scheduleRunning) {
    return
  }
  self.scheduleRunning = true
  self.scheduler.scheduleTask(() => releaseTaker(self), 0)
}

const unsafeTakeBetween = <A, E>(
  self: ReadonlyMailbox<A, E>,
  min: number,
  max: number
): Exit<readonly [messages: Array<A>, done: boolean], E> | undefined => {
  if (self.state._tag === "Done") {
    return core.exitAs(self.state.exit, constDone)
  } else if (max <= 0 || min <= 0) {
    return core.exitSucceed([empty, false])
  } else if (self.capacity <= 0 && self.state.offers.size > 0) {
    self.capacity = 1
    const released = releaseCapacity(self)
    self.capacity = 0
    return self.messages.length > 0
      ? core.exitSucceed([[MutableList.take(self.messages)!], released])
      : undefined
  }
  min = Math.min(min, self.capacity)
  if (min <= self.messages.length) {
    return core.exitSucceed([MutableList.takeN(self.messages, max), releaseCapacity(self)])
  }
}

const offerRemainingSingle = <A, E>(self: Mailbox<A, E>, message: A) => {
  return core.async<boolean>((resume) => {
    if (self.state._tag !== "Open") {
      return resume(exitFalse)
    }
    const entry: Mailbox.OfferEntry<A> = { _tag: "Single", message, resume }
    self.state.offers.add(entry)
    return core.sync(() => {
      if (self.state._tag === "Open") {
        self.state.offers.delete(entry)
      }
    })
  })
}

const offerRemainingArray = <A, E>(self: Mailbox<A, E>, remaining: Array<A>) => {
  return core.async<Array<A>>((resume) => {
    if (self.state._tag !== "Open") {
      return resume(core.exitSucceed(remaining))
    }
    const entry: Mailbox.OfferEntry<A> = {
      _tag: "Array",
      remaining,
      offset: 0,
      resume
    }
    self.state.offers.add(entry)
    return core.sync(() => {
      if (self.state._tag === "Open") {
        self.state.offers.delete(entry)
      }
    })
  })
}

const releaseCapacity = <A, E>(self: ReadonlyMailbox<A, E>): boolean => {
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
    if (n === 0) return false
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

const awaitTake = <A, E>(self: ReadonlyMailbox<A, E>) =>
  core.async<void, E>((resume) => {
    if (self.state._tag === "Done") {
      return resume(self.state.exit)
    }
    self.state.takers.add(resume)
    return core.sync(() => {
      if (self.state._tag !== "Done") {
        self.state.takers.delete(resume)
      }
    })
  })

const awaitTakeOption = <A, E>(self: ReadonlyMailbox<A, E>) => core.mapError(awaitTake(self), Option.some)

const unsafeTakeAll = <A, E>(self: ReadonlyMailbox<A, E>) => {
  if (self.messages.length > 0) {
    return MutableList.takeAll(self.messages)
  } else if (self.state._tag !== "Done" && self.state.offers.size > 0) {
    self.capacity = 1
    releaseCapacity(self)
    self.capacity = 0
    return [MutableList.take(self.messages)!]
  }
  return empty
}

const finalize = <A, E>(self: ReadonlyMailbox<A, E>, exit: Exit<void, E>) => {
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
