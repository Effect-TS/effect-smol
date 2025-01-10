import * as Arr from "../Array.js"
import type { Cause } from "../Cause.js"
import type { Effect } from "../Effect.js"
import type { Exit } from "../Exit.js"
import { dual, identity } from "../Function.js"
import * as Iterable from "../Iterable.js"
import type * as Api from "../Mailbox.js"
import * as MutableList from "../MutableList.js"
import * as Option from "../Option.js"
import { hasProperty } from "../Predicate.js"
import { CurrentScheduler } from "../References.js"
import type { Scheduler } from "../Scheduler.js"
import * as core from "./core.js"
import { PipeInspectableProto } from "./effectable.js"

/** @internal */
export const TypeId: Api.TypeId = Symbol.for("effect/Mailbox") as Api.TypeId

/** @internal */
export const ReadonlyTypeId: Api.ReadonlyTypeId = Symbol.for("effect/Mailbox/ReadonlyMailbox") as Api.ReadonlyTypeId

/** @internal */
export const isMailbox = (u: unknown): u is Api.Mailbox<unknown, unknown> => hasProperty(u, TypeId)

/** @internal */
export const isReadonlyMailbox = (u: unknown): u is Api.ReadonlyMailbox<unknown, unknown> =>
  hasProperty(u, ReadonlyTypeId)

const empty = Arr.empty()
const exitEmpty = core.exitSucceed(empty)
const exitFalse = core.exitSucceed(false)
const exitTrue = core.exitSucceed(true)
const constDone = [empty, true] as const
const exitFailNone = core.exitFail(Option.none())

interface MailboxImpl<A, E> extends Api.Mailbox<A, E> {
  readonly strategy: "suspend" | "dropping" | "sliding"
  readonly scheduler: Scheduler
  messages: MutableList.MutableList<A>
  capacity: number
  scheduleRunning: boolean
  state: State<A, E>
}

type State<A, E> =
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

type OfferEntry<A> =
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

/** @internal */
export const offer = <A, E>(self: MailboxImpl<A, E>, message: A): Effect<boolean> =>
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

const releaseTaker = <A, E>(self: MailboxImpl<A, E>) => {
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

const scheduleReleaseTaker = <A, E>(self: MailboxImpl<A, E>) => {
  if (self.scheduleRunning) {
    return
  }
  self.scheduleRunning = true
  self.scheduler.scheduleTask(() => releaseTaker(self), 0)
}

/** @internal */
export const unsafeOffer = <A, E>(self: MailboxImpl<A, E>, message: A): boolean => {
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

/** @internal */
export const offerAll = <A, E>(self: MailboxImpl<A, E>, messages: Iterable<A>): Effect<Array<A>> =>
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

/** @internal */
export const unsafeOfferAll = <A, E>(self: MailboxImpl<A, E>, messages: Iterable<A>): Array<A> => {
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

/** @internal */
export const fail = <A, E>(self: MailboxImpl<A, E>, error: E) => done(self, core.exitFail(error))

/** @internal */
export const failCause = <A, E>(self: MailboxImpl<A, E>, cause: Cause<E>) => done(self, core.exitFailCause(cause))

/** @internal */
export const unsafeDone = <A, E>(self: MailboxImpl<A, E>, exit: Exit<void, E>): boolean => {
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

/** @internal */
export const shutdown = <A, E>(self: MailboxImpl<A, E>) =>
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

/** @internal */
export const done = <A, E>(self: MailboxImpl<A, E>, exit: Exit<void, E>) => core.sync(() => unsafeDone(self, exit))

/** @internal */
export const end = <A, E>(self: MailboxImpl<A, E>) => done(self, core.exitVoid)

/** @internal */
export const clear = <A, E>(self: MailboxImpl<A, E>) =>
  core.suspend(() => {
    if (self.state._tag === "Done") {
      return core.exitAs(self.state.exit, empty)
    }
    const messages = unsafeTakeAll(self)
    releaseCapacity(self)
    return core.succeed(messages)
  })

/** @internal */
export const takeAll = <A, E>(self: MailboxImpl<A, E>) => takeBetween(self, 1, Number.POSITIVE_INFINITY)

/** @internal */
export const takeN = <A, E>(
  self: MailboxImpl<A, E>,
  n: number
): Effect<readonly [messages: Array<A>, done: boolean], E> => takeBetween(self, n, n)

/** @internal */
export const takeBetween = <A, E>(
  self: MailboxImpl<A, E>,
  min: number,
  max: number
): Effect<readonly [messages: Array<A>, done: boolean], E> =>
  core.suspend(() => unsafeTakeBetween(self, min, max) ?? core.andThen(awaitTake(self), takeBetween(self, 1, max)))

/** @internal */
export const unsafeTake = <A, E>(self: MailboxImpl<A, E>): Exit<A, Option.Option<E>> | undefined => {
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

const unsafeTakeBetween = <A, E>(
  self: MailboxImpl<A, E>,
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

/** @internal */
export const take = <A, E>(self: MailboxImpl<A, E>): Effect<A, Option.Option<E>> =>
  core.suspend(
    () => unsafeTake(self) ?? core.andThen(awaitTakeOption(self), take(self))
  )

/** @internal */
export const await_ = <A, E>(self: MailboxImpl<A, E>): Effect<void, E> =>
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

/** @internal */
export const unsafeSize = <A, E>(self: MailboxImpl<A, E>): Option.Option<number> => {
  return self.state._tag === "Done" ? Option.none() : Option.some(self.messages.length)
}

/** @internal */
export const size = <A, E>(self: MailboxImpl<A, E>) => core.sync(() => unsafeSize(self))

const offerRemainingSingle = <A, E>(self: MailboxImpl<A, E>, message: A) => {
  return core.async<boolean>((resume) => {
    if (self.state._tag !== "Open") {
      return resume(exitFalse)
    }
    const entry: OfferEntry<A> = { _tag: "Single", message, resume }
    self.state.offers.add(entry)
    return core.sync(() => {
      if (self.state._tag === "Open") {
        self.state.offers.delete(entry)
      }
    })
  })
}

const offerRemainingArray = <A, E>(self: MailboxImpl<A, E>, remaining: Array<A>) => {
  return core.async<Array<A>>((resume) => {
    if (self.state._tag !== "Open") {
      return resume(core.exitSucceed(remaining))
    }
    const entry: OfferEntry<A> = {
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

const releaseCapacity = <A, E>(self: MailboxImpl<A, E>): boolean => {
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

const awaitTake = <A, E>(self: MailboxImpl<A, E>) =>
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

const awaitTakeOption = <A, E>(self: MailboxImpl<A, E>) => core.mapError(awaitTake(self), Option.some)

const unsafeTakeAll = <A, E>(self: MailboxImpl<A, E>) => {
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

const finalize = <A, E>(self: MailboxImpl<A, E>, exit: Exit<void, E>) => {
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

const MailboxProto = {
  [TypeId]: {
    _A: identity,
    _E: identity
  },
  ...PipeInspectableProto,
  toJSON(this: MailboxImpl<unknown, unknown>) {
    return {
      _id: "effect/Mailbox",
      state: this.state._tag,
      size: unsafeSize(this).toJSON()
    }
  }
}

/** @internal */
export const make = <A, E = never>(
  capacity?:
    | number
    | {
      readonly capacity?: number | undefined
      readonly strategy?: "suspend" | "dropping" | "sliding" | undefined
    }
    | undefined
): Effect<Api.Mailbox<A, E>> =>
  core.withFiber((fiber) => {
    const self = Object.create(MailboxProto)
    self.scheduler = fiber.getRef(CurrentScheduler)
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

/** @internal */
export const into: {
  <A, E>(
    self: MailboxImpl<A, E>
  ): <AX, EX extends E, RX>(
    effect: Effect<AX, EX, RX>
  ) => Effect<boolean, never, RX>
  <AX, E, EX extends E, RX, A>(
    effect: Effect<AX, EX, RX>,
    self: MailboxImpl<A, E>
  ): Effect<boolean, never, RX>
} = dual(
  2,
  <AX, E, EX extends E, RX, A>(
    effect: Effect<AX, EX, RX>,
    self: MailboxImpl<A, E>
  ): Effect<boolean, never, RX> =>
    core.uninterruptibleMask((restore) =>
      core.matchCauseEffect(restore(effect), {
        onFailure: (cause) => failCause(self, cause),
        onSuccess: (_) => end(self)
      })
    )
)
