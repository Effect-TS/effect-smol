/**
 * @since 2.0.0
 */
import * as Option from "../data/Option.ts"
import * as Effect from "../Effect.ts"
import { dual, identity } from "../Function.ts"
import { PipeInspectableProto } from "../internal/core.ts"
import * as PubSub from "../PubSub.ts"
import * as Ref from "../Ref.ts"
import type { Invariant } from "../types/Types.ts"
import * as Stream from "./Stream.ts"

const TypeId = "~effect/stream/SubscriptionRef"

/**
 * @since 2.0.0
 * @category models
 */
export interface SubscriptionRef<in out A> extends SubscriptionRef.Variance<A> {
  readonly backing: Ref.Ref<A>
  readonly semaphore: Effect.Semaphore
  readonly pubsub: PubSub.PubSub<A>
}

/**
 * The `SynchronizedRef` namespace containing type definitions and utilities.
 *
 * @since 2.0.0
 */
export declare namespace SubscriptionRef {
  /**
   * @since 2.0.0
   * @category models
   */
  export interface Variance<in out A> {
    readonly [TypeId]: {
      readonly _A: Invariant<A>
    }
  }
}

const Proto = {
  ...PipeInspectableProto,
  [TypeId]: {
    _A: identity
  },
  toJSON(this: SubscriptionRef<unknown>) {
    return {
      _id: "SubscriptionRef",
      value: this.backing.ref.current
    }
  }
}

/**
 * @since 2.0.0
 * @category constructors
 */
export const make: <A>(value: A) => Effect.Effect<SubscriptionRef<A>> = Effect.fnUntraced(
  function*<A>(value: A) {
    const self = Object.create(Proto)
    self.semaphore = yield* Effect.makeSemaphore(1)
    self.backing = yield* Ref.make(value)
    self.pubsub = yield* PubSub.unbounded<A>()
    return self
  }
)

export const changes = <A>(self: SubscriptionRef<A>): Stream.Stream<A> =>
  Stream.unwrap(
    self.semaphore.withPermits(1)(Effect.sync(() => {
      const current = self.backing.ref.current
      return Stream.concat(
        Stream.make(current),
        Stream.fromPubSub(self.pubsub)
      )
    }))
  )

/**
 * @since 2.0.0
 * @category getters
 */
export const getUnsafe = <A>(self: SubscriptionRef<A>): A => self.backing.ref.current

/**
 * @since 2.0.0
 * @category getters
 */
export const get = <A>(self: SubscriptionRef<A>): Effect.Effect<A> => Effect.sync(() => getUnsafe(self))

export const getAndSet: {
  <A>(value: A): (self: SubscriptionRef<A>) => Effect.Effect<A>
  <A>(self: SubscriptionRef<A>, value: A): Effect.Effect<A>
} = dual(2, <A>(self: SubscriptionRef<A>, value: A) =>
  self.semaphore.withPermit(Effect.flatMap(
    Ref.getAndSet(self.backing, value),
    (oldValue) => Effect.as(PubSub.publish(self.pubsub, value), oldValue)
  )))

export const getAndUpdate: {
  <A>(update: (a: A) => A): (self: SubscriptionRef<A>) => Effect.Effect<A>
  <A>(self: SubscriptionRef<A>, update: (a: A) => A): Effect.Effect<A>
} = dual(2, <A>(self: SubscriptionRef<A>, update: (a: A) => A) =>
  self.semaphore.withPermit(Effect.suspend(() => {
    const current = self.backing.ref.current
    const newValue = update(current)
    self.backing.ref.current = newValue
    return Effect.as(PubSub.publish(self.pubsub, newValue), current)
  })))

export const getAndUpdateEffect: {
  <A, E, R>(update: (a: A) => Effect.Effect<A, E, R>): (self: SubscriptionRef<A>) => Effect.Effect<A, E, R>
  <A, E, R>(self: SubscriptionRef<A>, update: (a: A) => Effect.Effect<A, E, R>): Effect.Effect<A, E, R>
} = dual(2, <A, E, R>(
  self: SubscriptionRef<A>,
  update: (a: A) => Effect.Effect<A, E, R>
) =>
  self.semaphore.withPermit(Effect.suspend(() => {
    const current = self.backing.ref.current
    return Effect.flatMap(update(current), (newValue) => {
      self.backing.ref.current = newValue
      return Effect.as(PubSub.publish(self.pubsub, newValue), current)
    })
  })))

export const getAndUpdateSome: {
  <A>(update: (a: A) => Option.Option<A>): (self: SubscriptionRef<A>) => Effect.Effect<A>
  <A>(self: SubscriptionRef<A>, update: (a: A) => Option.Option<A>): Effect.Effect<A>
} = dual(2, <A>(
  self: SubscriptionRef<A>,
  update: (a: A) => Option.Option<A>
) =>
  self.semaphore.withPermit(Effect.suspend(() => {
    const current = self.backing.ref.current
    const option = update(current)
    if (Option.isNone(option)) {
      return Effect.succeed(current)
    }
    self.backing.ref.current = option.value
    return Effect.map(PubSub.publish(self.pubsub, option.value), () => current)
  })))

export const getAndUpdateSomeEffect: {
  <A, R, E>(
    update: (a: A) => Effect.Effect<Option.Option<A>, E, R>
  ): (self: SubscriptionRef<A>) => Effect.Effect<A, E, R>
  <A, R, E>(
    self: SubscriptionRef<A>,
    update: (a: A) => Effect.Effect<Option.Option<A>, E, R>
  ): Effect.Effect<A, E, R>
} = dual(2, <A, R, E>(
  self: SubscriptionRef<A>,
  update: (a: A) => Effect.Effect<Option.Option<A>, E, R>
) =>
  self.semaphore.withPermit(Effect.suspend(() => {
    const current = self.backing.ref.current
    return Effect.flatMap(update(current), (option) => {
      if (Option.isNone(option)) {
        return Effect.succeed(current)
      }
      self.backing.ref.current = option.value
      return Effect.as(PubSub.publish(self.pubsub, option.value), current)
    })
  })))

export const modify: {
  <A, B>(modify: (a: A) => readonly [B, A]): (self: SubscriptionRef<A>) => Effect.Effect<B>
  <A, B>(self: SubscriptionRef<A>, f: (a: A) => readonly [B, A]): Effect.Effect<B>
} = dual(2, <A, B>(
  self: SubscriptionRef<A>,
  modify: (a: A) => readonly [B, A]
) =>
  self.semaphore.withPermit(Effect.suspend(() => {
    const [b, newValue] = modify(self.backing.ref.current)
    self.backing.ref.current = newValue
    return Effect.as(PubSub.publish(self.pubsub, newValue), b)
  })))

export const modifyEffect: {
  <B, A, E, R>(
    modify: (a: A) => Effect.Effect<readonly [B, A], E, R>
  ): (self: SubscriptionRef<A>) => Effect.Effect<B, E, R>
  <A, B, E, R>(
    self: SubscriptionRef<A>,
    modify: (a: A) => Effect.Effect<readonly [B, A], E, R>
  ): Effect.Effect<B, E, R>
} = dual(2, <A, B, E, R>(
  self: SubscriptionRef<A>,
  modify: (a: A) => Effect.Effect<readonly [B, A], E, R>
): Effect.Effect<B, E, R> =>
  self.semaphore.withPermit(Effect.suspend(() => {
    const current = self.backing.ref.current
    return Effect.flatMap(modify(current), ([b, newValue]) => {
      self.backing.ref.current = newValue
      return Effect.as(PubSub.publish(self.pubsub, newValue), b)
    })
  })))

export const modifySome: {
  <B, A>(
    modify: (a: A) => readonly [B, Option.Option<A>]
  ): (self: SubscriptionRef<A>) => Effect.Effect<B>
  <A, B>(
    self: SubscriptionRef<A>,
    modify: (a: A) => readonly [B, Option.Option<A>]
  ): Effect.Effect<B>
} = dual(2, <A, B>(
  self: SubscriptionRef<A>,
  modify: (a: A) => readonly [B, Option.Option<A>]
) =>
  self.semaphore.withPermit(Effect.suspend(() => {
    const [b, option] = modify(self.backing.ref.current)
    if (Option.isNone(option)) {
      return Effect.succeed(b)
    }
    self.backing.ref.current = option.value
    return Effect.as(PubSub.publish(self.pubsub, option.value), b)
  })))

export const modifySomeEffect: {
  <A, B, R, E>(
    modify: (a: A) => Effect.Effect<readonly [B, Option.Option<A>], E, R>
  ): (self: SubscriptionRef<A>) => Effect.Effect<B, E, R>
  <A, B, R, E>(
    self: SubscriptionRef<A>,
    modify: (a: A) => Effect.Effect<readonly [B, Option.Option<A>], E, R>
  ): Effect.Effect<B, E, R>
} = dual(2, <A, B, R, E>(
  self: SubscriptionRef<A>,
  modify: (a: A) => Effect.Effect<readonly [B, Option.Option<A>], E, R>
) =>
  self.semaphore.withPermit(Effect.suspend(() => {
    const current = self.backing.ref.current
    return Effect.flatMap(modify(current), ([b, option]) => {
      if (Option.isNone(option)) {
        return Effect.succeed(b)
      }
      self.backing.ref.current = option.value
      return Effect.as(PubSub.publish(self.pubsub, option.value), b)
    })
  })))

export const set: {
  <A>(value: A): (self: SubscriptionRef<A>) => Effect.Effect<void>
  <A>(self: SubscriptionRef<A>, value: A): Effect.Effect<void>
} = dual(2, <A>(self: SubscriptionRef<A>, value: A) =>
  self.semaphore.withPermit(Effect.suspend(() => {
    self.backing.ref.current = value
    return Effect.asVoid(PubSub.publish(self.pubsub, value))
  })))

export const setAndGet: {
  <A>(value: A): (self: SubscriptionRef<A>) => Effect.Effect<A>
  <A>(self: SubscriptionRef<A>, value: A): Effect.Effect<A>
} = dual(2, <A>(self: SubscriptionRef<A>, value: A) =>
  self.semaphore.withPermit(Effect.suspend(() => {
    self.backing.ref.current = value
    return Effect.map(PubSub.publish(self.pubsub, value), () => value)
  })))

export const update: {
  <A>(update: (a: A) => A): (self: SubscriptionRef<A>) => Effect.Effect<void>
  <A>(self: SubscriptionRef<A>, update: (a: A) => A): Effect.Effect<void>
} = dual(2, <A>(self: SubscriptionRef<A>, update: (a: A) => A) =>
  self.semaphore.withPermit(Effect.suspend(() => {
    const newValue = update(self.backing.ref.current)
    self.backing.ref.current = newValue
    return Effect.asVoid(PubSub.publish(self.pubsub, newValue))
  })))

export const updateEffect: {
  <A, E, R>(update: (a: A) => Effect.Effect<A, E, R>): (self: SubscriptionRef<A>) => Effect.Effect<void, E, R>
  <A, E, R>(self: SubscriptionRef<A>, update: (a: A) => Effect.Effect<A, E, R>): Effect.Effect<void, E, R>
} = dual(2, <A, E, R>(
  self: SubscriptionRef<A>,
  update: (a: A) => Effect.Effect<A, E, R>
) =>
  self.semaphore.withPermit(Effect.suspend(() => {
    const current = self.backing.ref.current
    return Effect.flatMap(update(current), (newValue) => {
      self.backing.ref.current = newValue
      return Effect.asVoid(PubSub.publish(self.pubsub, newValue))
    })
  })))

export const updateAndGet: {
  <A>(update: (a: A) => A): (self: SubscriptionRef<A>) => Effect.Effect<A>
  <A>(self: SubscriptionRef<A>, update: (a: A) => A): Effect.Effect<A>
} = dual(2, <A>(self: SubscriptionRef<A>, update: (a: A) => A) =>
  self.semaphore.withPermit(Effect.suspend(() => {
    const newValue = update(self.backing.ref.current)
    self.backing.ref.current = newValue
    return Effect.as(PubSub.publish(self.pubsub, newValue), newValue)
  })))

export const updateAndGetEffect: {
  <A, E, R>(update: (a: A) => Effect.Effect<A, E, R>): (self: SubscriptionRef<A>) => Effect.Effect<A, E, R>
  <A, E, R>(self: SubscriptionRef<A>, update: (a: A) => Effect.Effect<A, E, R>): Effect.Effect<A, E, R>
} = dual(2, <A, E, R>(
  self: SubscriptionRef<A>,
  update: (a: A) => Effect.Effect<A, E, R>
) =>
  self.semaphore.withPermit(Effect.suspend(() => {
    const current = self.backing.ref.current
    return Effect.flatMap(update(current), (newValue) => {
      self.backing.ref.current = newValue
      return Effect.as(PubSub.publish(self.pubsub, newValue), newValue)
    })
  })))

export const updateSome: {
  <A>(update: (a: A) => Option.Option<A>): (self: SubscriptionRef<A>) => Effect.Effect<void>
  <A>(self: SubscriptionRef<A>, update: (a: A) => Option.Option<A>): Effect.Effect<void>
} = dual(2, <A>(
  self: SubscriptionRef<A>,
  update: (a: A) => Option.Option<A>
) =>
  self.semaphore.withPermit(Effect.suspend(() => {
    const option = update(self.backing.ref.current)
    if (Option.isNone(option)) {
      return Effect.void
    }
    self.backing.ref.current = option.value
    return Effect.asVoid(PubSub.publish(self.pubsub, option.value))
  })))

export const updateSomeEffect: {
  <A, E, R>(
    update: (a: A) => Effect.Effect<Option.Option<A>, E, R>
  ): (self: SubscriptionRef<A>) => Effect.Effect<void, E, R>
  <A, E, R>(
    self: SubscriptionRef<A>,
    update: (a: A) => Effect.Effect<Option.Option<A>, E, R>
  ): Effect.Effect<void, E, R>
} = dual(2, <A, R, E>(
  self: SubscriptionRef<A>,
  update: (a: A) => Effect.Effect<Option.Option<A>, E, R>
) =>
  self.semaphore.withPermit(Effect.suspend(() => {
    const current = self.backing.ref.current
    return Effect.flatMap(update(current), (option) => {
      if (Option.isNone(option)) {
        return Effect.void
      }
      self.backing.ref.current = option.value
      return Effect.asVoid(PubSub.publish(self.pubsub, option.value))
    })
  })))

export const updateSomeAndGet: {
  <A>(update: (a: A) => Option.Option<A>): (self: SubscriptionRef<A>) => Effect.Effect<A>
  <A>(self: SubscriptionRef<A>, update: (a: A) => Option.Option<A>): Effect.Effect<A>
} = dual(2, <A>(
  self: SubscriptionRef<A>,
  update: (a: A) => Option.Option<A>
) =>
  self.semaphore.withPermit(Effect.suspend(() => {
    const current = self.backing.ref.current
    const option = update(current)
    if (Option.isNone(option)) {
      return Effect.succeed(current)
    }
    self.backing.ref.current = option.value
    return Effect.as(PubSub.publish(self.pubsub, option.value), option.value)
  })))

export const updateSomeAndGetEffect: {
  <A, E, R>(
    update: (a: A) => Effect.Effect<Option.Option<A>, E, R>
  ): (self: SubscriptionRef<A>) => Effect.Effect<A, E, R>
  <A, E, R>(self: SubscriptionRef<A>, update: (a: A) => Effect.Effect<Option.Option<A>, E, R>): Effect.Effect<A, E, R>
} = dual(2, <A, E, R>(
  self: SubscriptionRef<A>,
  update: (a: A) => Effect.Effect<Option.Option<A>, E, R>
) =>
  self.semaphore.withPermit(Effect.suspend(() => {
    const current = self.backing.ref.current
    return Effect.flatMap(update(current), (option) => {
      if (Option.isNone(option)) {
        return Effect.succeed(current)
      }
      self.backing.ref.current = option.value
      return Effect.as(PubSub.publish(self.pubsub, option.value), option.value)
    })
  })))
