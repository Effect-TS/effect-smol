/**
 * @since 2.0.0
 */
import type * as Arr from "./Array.js"
import * as Cause from "./Cause.js"
import * as Chunk from "./Chunk.js"
import * as ServiceMap from "./ServiceMap.js"
import * as Effect from "./Effect.js"
import * as Exit from "./Exit.js"
import * as Fiber from "./Fiber.js"
import * as Filter from "./Filter.js"
import type { LazyArg } from "./Function.js"
import { constTrue, dual, identity } from "./Function.js"
import * as Iterable from "./Iterable.js"
import * as Option from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"
import { hasProperty } from "./Predicate.js"
import * as PubSub from "./PubSub.js"
import * as Pull from "./Pull.js"
import * as Queue from "./Queue.js"
import * as Scope from "./Scope.js"
import type * as Types from "./Types.js"
import type * as Unify from "./Unify.js"

/**
 * @since 4.0.0
 * @category symbols
 */
export const TypeId: unique symbol = Symbol.for("effect/Channel")

/**
 * @since 4.0.0
 * @category symbols
 */
export type TypeId = typeof TypeId

/**
 * @since 3.5.4
 * @category refinements
 */
export const isChannel = (
  u: unknown
): u is Channel<unknown, unknown, unknown, unknown, unknown, unknown, unknown> => hasProperty(u, TypeId)

/**
 * A `Channel` is a nexus of I/O operations, which supports both reading and
 * writing. A channel may read values of type `InElem` and write values of type
 * `OutElem`. When the channel finishes, it yields a value of type `OutDone`. A
 * channel may fail with a value of type `OutErr`.
 *
 * Channels are the foundation of Streams: both streams and sinks are built on
 * channels. Most users shouldn't have to use channels directly, as streams and
 * sinks are much more convenient and cover all common use cases. However, when
 * adding new stream and sink operators, or doing something highly specialized,
 * it may be useful to use channels directly.
 *
 * Channels compose in a variety of ways:
 *
 *  - **Piping**: One channel can be piped to another channel, assuming the
 *    input type of the second is the same as the output type of the first.
 *  - **Sequencing**: The terminal value of one channel can be used to create
 *    another channel, and both the first channel and the function that makes
 *    the second channel can be composed into a channel.
 *  - **Concatenating**: The output of one channel can be used to create other
 *    channels, which are all concatenated together. The first channel and the
 *    function that makes the other channels can be composed into a channel.
 *
 * @since 2.0.0
 * @category models
 */
export interface Channel<
  out OutElem,
  out OutErr = never,
  out OutDone = void,
  in InElem = unknown,
  in InErr = unknown,
  in InDone = unknown,
  out Env = never
> extends Channel.Variance<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>, Pipeable {
  [Unify.typeSymbol]?: unknown
  [Unify.unifySymbol]?: ChannelUnify<this>
  [Unify.ignoreSymbol]?: ChannelUnifyIgnore
}

/**
 * @since 2.0.0
 * @category models
 */
export interface ChannelUnify<A extends { [Unify.typeSymbol]?: any }> extends Effect.EffectUnify<A> {
  Channel?: () => A[Unify.typeSymbol] extends
    | Channel<infer OutElem, infer OutErr, infer OutDone, infer InElem, infer InErr, infer InDone, infer Env>
    | infer _ ? Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
    : never
}

/**
 * @category models
 * @since 2.0.0
 */
export interface ChannelUnifyIgnore extends Effect.EffectUnifyIgnore {
  Channel?: true
}

/**
 * @since 2.0.0
 */
export declare namespace Channel {
  /**
   * @since 2.0.0
   * @category models
   */
  export interface Variance<
    out OutElem,
    out OutErr,
    out OutDone,
    in InElem,
    in InErr,
    in InDone,
    out Env
  > {
    readonly [TypeId]: VarianceStruct<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
  }
  /**
   * @since 2.0.0
   * @category models
   */
  export interface VarianceStruct<
    out OutElem,
    out OutErr,
    out OutDone,
    in InElem,
    in InErr,
    in InDone,
    out Env
  > {
    _Env: Types.Covariant<Env>
    _InErr: Types.Contravariant<InErr>
    _InElem: Types.Contravariant<InElem>
    _InDone: Types.Contravariant<InDone>
    _OutErr: Types.Covariant<OutErr>
    _OutElem: Types.Covariant<OutElem>
    _OutDone: Types.Covariant<OutDone>
  }
}

const ChannelProto = {
  [TypeId]: {
    _Env: identity,
    _InErr: identity,
    _InElem: identity,
    _OutErr: identity,
    _OutElem: identity
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
}

// -----------------------------------------------------------------------------
// Constructors
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromTransform = <OutElem, OutErr, OutDone, InElem, InErr, InDone, EX, EnvX, Env>(
  transform: (
    upstream: Pull.Pull<InElem, InErr, InDone>,
    scope: Scope.Scope
  ) => Effect.Effect<Pull.Pull<OutElem, OutErr, OutDone, EnvX>, EX, Env>
): Channel<
  OutElem,
  Pull.ExcludeHalt<OutErr> | EX,
  OutDone,
  InElem,
  InErr,
  InDone,
  Env | EnvX
> => {
  const self = Object.create(ChannelProto)
  self.transform = transform
  return self
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromPull = <OutElem, OutErr, OutDone, EX, EnvX, Env>(
  effect: Effect.Effect<Pull.Pull<OutElem, OutErr, OutDone, EnvX>, EX, Env>
): Channel<OutElem, Pull.ExcludeHalt<OutErr> | EX, OutDone, unknown, unknown, unknown, Env | EnvX> =>
  fromTransform((_, __) => effect) as any

const makeImplBracket = <OutElem, OutErr, OutDone, InElem, InErr, InDone, EX, EnvX, Env>(
  f: (
    upstream: Pull.Pull<InElem, InErr, InDone>,
    scope: Scope.Scope,
    forkedScope: Scope.Scope
  ) => Effect.Effect<Pull.Pull<OutElem, OutErr, OutDone, EnvX>, EX, Env>
): Channel<OutElem, Pull.ExcludeHalt<OutErr> | EX, OutDone, InElem, InErr, InDone, Env | EnvX> =>
  fromTransform(
    Effect.fnUntraced(function*(upstream, scope) {
      const closableScope = yield* Scope.fork(scope)
      const onCause = (cause: Cause.Cause<EX | OutErr | Pull.Halt<OutDone>>) =>
        Scope.close(closableScope, Pull.haltExitFromCause(cause))
      const pull = yield* Effect.onError(
        f(upstream, scope, closableScope),
        onCause
      )
      return Effect.onError(pull, onCause)
    })
  )

/**
 * @since 4.0.0
 * @category destructors
 */
export const toTransform = <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>(
  channel: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
): (
  upstream: Pull.Pull<InElem, InErr, InDone>,
  scope: Scope.Scope
) => Effect.Effect<Pull.Pull<OutElem, OutErr, OutDone>, never, Env> => (channel as any).transform

/**
 * @since 2.0.0
 * @category models
 */
export const DefaultChunkSize: number = 4096

const asyncQueue = <A, E = never, R = never>(
  scope: Scope.Scope,
  f: (queue: Queue.Queue<A, E>) => void | Effect.Effect<unknown, E, R | Scope.Scope>,
  options?: {
    readonly bufferSize?: number | undefined
    readonly strategy?: "sliding" | "dropping" | "suspend" | undefined
  }
) =>
  Queue.make<A, E>({
    capacity: options?.bufferSize,
    strategy: options?.strategy
  }).pipe(
    Effect.tap((queue) => Scope.addFinalizer(scope, () => Queue.shutdown(queue))),
    Effect.tap((queue) => {
      const result = f(queue)
      if (Effect.isEffect(result)) {
        return Effect.forkIn(Scope.provide(result, scope), scope)
      }
    })
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const callback = <A, E = never, R = never>(
  f: (queue: Queue.Queue<A, E>) => void | Effect.Effect<unknown, E, R | Scope.Scope>,
  options?: {
    readonly bufferSize?: number | undefined
    readonly strategy?: "sliding" | "dropping" | "suspend" | undefined
  }
): Channel<A, E, void, unknown, unknown, unknown, Exclude<R, Scope.Scope>> =>
  fromTransform((_, scope) => Effect.map(asyncQueue(scope, f, options), Pull.fromQueue))

/**
 * @since 4.0.0
 * @category constructors
 */
export const callbackArray = <A, E = never, R = never>(
  f: (queue: Queue.Queue<A, E>) => void | Effect.Effect<unknown, E, R | Scope.Scope>,
  options?: {
    readonly bufferSize?: number | undefined
    readonly strategy?: "sliding" | "dropping" | "suspend" | undefined
  }
): Channel<Arr.NonEmptyReadonlyArray<A>, E, void, unknown, unknown, unknown, Exclude<R, Scope.Scope>> =>
  fromTransform((_, scope) => Effect.map(asyncQueue(scope, f, options), Pull.fromQueueArray))

/**
 * @since 2.0.0
 * @category constructors
 */
export const suspend = <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>(
  evaluate: LazyArg<Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>>
): Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env> =>
  fromTransform((upstream, scope) => Effect.suspend(() => toTransform(evaluate())(upstream, scope)))

/**
 * @since 2.0.0
 * @category constructors
 */
export const acquireUseRelease = <A, E, R, OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>(
  acquire: Effect.Effect<A, E, R>,
  use: (a: A) => Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
  release: (a: A, exit: Exit.Exit<OutDone, OutErr>) => Effect.Effect<unknown>
): Channel<OutElem, OutErr | E, OutDone, InElem, InErr, InDone, Env | R> =>
  makeImplBracket(
    Effect.fnUntraced(function*(upstream, scope, forkedScope) {
      let option = Option.none<A>()
      yield* Scope.addFinalizer(forkedScope, (exit) =>
        Option.isSome(option)
          ? release(option.value, exit as any)
          : Effect.void)
      const value = yield* Effect.uninterruptible(acquire)
      option = Option.some(value)
      return yield* toTransform(use(value))(upstream, scope)
    })
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const acquireRelease: {
  <Z, R2>(
    release: (z: Z, e: Exit.Exit<unknown, unknown>) => Effect.Effect<unknown>
  ): <E, R>(self: Effect.Effect<Z, E, R>) => Channel<Z, E, void, unknown, unknown, unknown, R2 | R>
  <Z, E, R, R2>(
    self: Effect.Effect<Z, E, R>,
    release: (z: Z, e: Exit.Exit<unknown, unknown>) => Effect.Effect<unknown>
  ): Channel<Z, E, void, unknown, unknown, unknown, R | R2>
} = dual(2, <Z, E, R, R2>(
  self: Effect.Effect<Z, E, R>,
  release: (z: Z, e: Exit.Exit<unknown, unknown>) => Effect.Effect<unknown>
): Channel<Z, E, void, unknown, unknown, unknown, R | R2> =>
  unwrap(Effect.map(
    Effect.acquireRelease(self, release),
    succeed
  )))

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromIterator = <A, L>(iterator: LazyArg<Iterator<A, L>>): Channel<A, never, L> =>
  fromPull(
    Effect.sync(() => {
      const iter = iterator()
      return Effect.suspend(() => {
        const state = iter.next()
        return state.done ? Pull.halt(state.value) : Effect.succeed(state.value)
      })
    })
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromArray = <A>(array: ReadonlyArray<A>): Channel<A> =>
  fromPull(Effect.sync(() => {
    let index = 0
    return Effect.suspend(() => index >= array.length ? Pull.haltVoid : Effect.succeed(array[index++]))
  }))

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromChunk = <A>(chunk: Chunk.Chunk<A>): Channel<A> => fromArray(Chunk.toReadonlyArray(chunk))

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromIteratorArray = <A, L>(
  iterator: LazyArg<Iterator<A, L>>,
  chunkSize = DefaultChunkSize
): Channel<Arr.NonEmptyReadonlyArray<A>, never, L> =>
  fromPull(
    Effect.sync(() => {
      const iter = iterator()
      let done = Option.none<L>()
      return Effect.suspend(() => {
        if (done._tag === "Some") return Pull.halt(done.value)
        const buffer: Array<A> = []
        while (buffer.length < chunkSize) {
          const state = iter.next()
          if (state.done) {
            if (buffer.length === 0) {
              return Pull.halt(state.value)
            }
            done = Option.some(state.value)
            break
          }
          buffer.push(state.value)
        }
        return Effect.succeed(buffer as any as Arr.NonEmptyReadonlyArray<A>)
      })
    })
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromIterable = <A, L>(iterable: Iterable<A, L>): Channel<A, never, L> =>
  fromIterator(() => iterable[Symbol.iterator]())

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromIterableArray = <A, L>(
  iterable: Iterable<A, L>
): Channel<Arr.NonEmptyReadonlyArray<A>, never, L> => fromIteratorArray(() => iterable[Symbol.iterator]())

/**
 * Writes a single value to the channel.
 *
 * @since 2.0.0
 * @category constructors
 */
export const succeed = <A>(value: A): Channel<A> => fromEffect(Effect.succeed(value))

/**
 * Writes a single value to the channel.
 *
 * @since 4.0.0
 * @category constructors
 */
export const end = <A>(value: A): Channel<never, never, A> => fromPull(Effect.succeed(Pull.halt(value)))

/**
 * Writes a single value to the channel.
 *
 * @since 2.0.0
 * @category constructors
 */
export const sync = <A>(evaluate: LazyArg<A>): Channel<A> => fromEffect(Effect.sync(evaluate))

/**
 * Represents an Channel that emits no elements
 *
 * @since 2.0.0
 * @category constructors
 */
export const empty: Channel<never> = fromPull(Effect.succeed(Pull.haltVoid))

/**
 * Represents an Channel that never completes
 *
 * @since 2.0.0
 * @category constructors
 */
export const never: Channel<never, never, never> = fromPull(Effect.succeed(Effect.never))

/**
 * Constructs a channel that fails immediately with the specified error.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fail = <E>(error: E): Channel<never, E, never> => fromPull(Effect.fail(error))

/**
 * Constructs a channel that succeeds immediately with the specified lazily
 * evaluated value.
 *
 * @since 2.0.0
 * @category constructors
 */
export const failSync = <E>(evaluate: LazyArg<E>): Channel<never, E, never> => fromPull(Effect.failSync(evaluate))

/**
 * Constructs a channel that fails immediately with the specified `Cause`.
 *
 * @since 2.0.0
 * @category constructors
 */
export const failCause = <E>(cause: Cause.Cause<E>): Channel<never, E, never> => fromPull(Effect.failCause(cause))

/**
 * Constructs a channel that succeeds immediately with the specified lazily
 * evaluated `Cause`.
 *
 * @since 2.0.0
 * @category constructors
 */
export const failCauseSync = <E>(
  evaluate: LazyArg<Cause.Cause<E>>
): Channel<never, E, never> => fromPull(Effect.failCauseSync(evaluate))

/**
 * Constructs a channel that fails immediately with the specified defect.
 *
 * @since 2.0.0
 * @category constructors
 */
export const die = (defect: unknown): Channel<never, never, never> => failCause(Cause.die(defect))

/**
 * Use an effect to write a single value to the channel.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromEffect = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Channel<A, E, void, unknown, unknown, unknown, R> =>
  fromPull(
    Effect.sync(() => {
      let done = false
      return Effect.suspend((): Pull.Pull<A, E, void, R> => {
        if (done) return Pull.haltVoid
        done = true
        return effect
      })
    })
  )

/**
 * Create a channel from a queue
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromQueue = <A, E>(
  queue: Queue.Dequeue<A, E>
): Channel<A, E> => fromPull(Effect.succeed(Pull.fromQueue(queue)))

/**
 * Create a channel from a queue
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromQueueArray = <A, E>(
  queue: Queue.Dequeue<A, E>
): Channel<Arr.NonEmptyReadonlyArray<A>, E> => fromPull(Effect.succeed(Pull.fromQueueArray(queue)))

/**
 * Create a channel from a PubSub subscription
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromSubscription = <A>(
  subscription: PubSub.Subscription<A>
): Channel<A> => fromPull(Effect.succeed(Effect.onInterrupt(PubSub.take(subscription), Pull.haltVoid)))

/**
 * Create a channel from a PubSub subscription
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromSubscriptionArray = <A>(
  subscription: PubSub.Subscription<A>,
  chunkSize = DefaultChunkSize
): Channel<Arr.NonEmptyReadonlyArray<A>> =>
  fromPull(Effect.succeed(Effect.onInterrupt(
    PubSub.takeBetween(subscription, 1, chunkSize) as Effect.Effect<Arr.NonEmptyArray<A>>,
    Pull.haltVoid
  )))

/**
 * Create a channel from a PubSub
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromPubSub = <A>(
  pubsub: PubSub.PubSub<A>
): Channel<A> => unwrap(Effect.map(PubSub.subscribe(pubsub), fromSubscription))

/**
 * Create a channel from a PubSub
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromPubSubArray = <A>(
  pubsub: PubSub.PubSub<A>,
  chunkSize = DefaultChunkSize
): Channel<Arr.NonEmptyReadonlyArray<A>> =>
  unwrap(Effect.map(PubSub.subscribe(pubsub), (sub) => fromSubscriptionArray(sub, chunkSize)))

/**
 * Maps the output of this channel using the specified function.
 *
 * @since 2.0.0
 * @category mapping
 */
export const map: {
  <OutElem, OutElem2>(
    f: (o: OutElem) => OutElem2
  ): <OutErr, OutDone, InElem, InErr, InDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
  ) => Channel<OutElem2, OutErr, OutDone, InElem, InErr, InDone, Env>
  <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env, OutElem2>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    f: (o: OutElem) => OutElem2
  ): Channel<OutElem2, OutErr, OutDone, InElem, InErr, InDone, Env>
} = dual(
  2,
  <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env, OutElem2>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    f: (o: OutElem) => OutElem2
  ): Channel<OutElem2, OutErr, OutDone, InElem, InErr, InDone, Env> =>
    fromTransform((upstream, scope) => Effect.map(toTransform(self)(upstream, scope), Effect.map(f)))
)

const concurrencyIsSequential = (
  concurrency: number | "unbounded" | undefined
) => concurrency === undefined || (concurrency !== "unbounded" && concurrency <= 1)

/**
 * Returns a new channel, which sequentially combines this channel, together
 * with the provided factory function, which creates a second channel based on
 * the output values of this channel. The result is a channel that will first
 * perform the functions of this channel, before performing the functions of
 * the created channel (including yielding its terminal value).
 *
 * @since 2.0.0
 * @category sequencing
 */
export const mapEffect: {
  <OutElem, OutElem1, OutErr1, Env1>(
    f: (d: OutElem) => Effect.Effect<OutElem1, OutErr1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
      readonly unordered?: boolean | undefined
    }
  ): <OutErr, OutDone, InElem, InErr, InDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
  ) => Channel<OutElem1, OutErr1 | OutErr, OutDone, InElem, InErr, InDone, Env1 | Env>
  <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env, OutElem1, OutErr1, Env1>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    f: (d: OutElem) => Effect.Effect<OutElem1, OutErr1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly unordered?: boolean | undefined
    }
  ): Channel<OutElem1, OutErr | OutErr1, OutDone, InElem, InErr, InDone, Env | Env1>
} = dual(
  (args) => isChannel(args[0]),
  <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env, OutElem1, OutErr1, Env1>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    f: (d: OutElem) => Effect.Effect<OutElem1, OutErr1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly unordered?: boolean | undefined
    }
  ): Channel<OutElem1, OutErr | OutErr1, OutDone, InElem, InErr, InDone, Env | Env1> =>
    concurrencyIsSequential(options?.concurrency)
      ? mapEffectSequential(self, f)
      : mapEffectConcurrent(self, f, options as any)
)

const mapEffectSequential = <
  OutElem,
  OutErr,
  OutDone,
  InElem,
  InErr,
  InDone,
  Env,
  OutElem2,
  EX,
  RX
>(
  self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
  f: (o: OutElem) => Effect.Effect<OutElem2, EX, RX>
): Channel<OutElem2, OutErr | EX, OutDone, InElem, InErr, InDone, Env | RX> =>
  fromTransform((upstream, scope) => Effect.map(toTransform(self)(upstream, scope), Effect.flatMap(f)))

const mapEffectConcurrent = <
  OutElem,
  OutErr,
  OutDone,
  InElem,
  InErr,
  InDone,
  Env,
  OutElem2,
  EX,
  RX
>(
  self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
  f: (o: OutElem) => Effect.Effect<OutElem2, EX, RX>,
  options: {
    readonly concurrency: number | "unbounded"
    readonly unordered?: boolean | undefined
  }
): Channel<OutElem2, OutErr | EX, OutDone, InElem, InErr, InDone, Env | RX> =>
  makeImplBracket(
    Effect.fnUntraced(function*(upstream, scope, forkedScope) {
      const pull = yield* toTransform(self)(upstream, scope)
      const concurrencyN = options.concurrency === "unbounded"
        ? Number.MAX_SAFE_INTEGER
        : options.concurrency
      const queue = yield* Queue.bounded<OutElem2, OutErr | EX | Pull.Halt<OutDone>>(0)
      yield* Scope.addFinalizer(forkedScope, () => Queue.shutdown(queue))

      if (options.unordered) {
        const semaphore = Effect.unsafeMakeSemaphore(concurrencyN)
        const handle = Effect.matchCauseEffect({
          onFailure: (cause: Cause.Cause<EX>) => Effect.andThen(Queue.failCause(queue, cause), semaphore.release(1)),
          onSuccess: (value: OutElem2) => Effect.andThen(Queue.offer(queue, value), semaphore.release(1))
        })
        yield* semaphore.take(1).pipe(
          Effect.flatMap(() => pull),
          Effect.flatMap((value) => Effect.fork(handle(f(value)), { startImmediately: true })),
          Effect.forever({ autoYield: false }),
          Effect.catchCause((cause) =>
            semaphore.withPermits(concurrencyN - 1)(
              Queue.failCause(queue, cause)
            )
          ),
          Effect.forkIn(forkedScope)
        )
      } else {
        // capacity is n - 2 because
        // - 1 for the offer *after* starting a fiber
        // - 1 for the current processing fiber
        const fibers = yield* Queue.bounded<
          Effect.Effect<Exit.Exit<OutElem2, OutErr | EX | Pull.Halt<OutDone>>>
        >(concurrencyN - 2)
        yield* Scope.addFinalizer(forkedScope, () => Queue.shutdown(queue))

        yield* Queue.take(fibers).pipe(
          Effect.flatMap(identity),
          Effect.flatMap((exit) => exit._tag === "Success" ? Queue.offer(queue, exit.value) : Queue.done(queue, exit)),
          Effect.forever({ autoYield: false }),
          Effect.ignore,
          Effect.forkIn(forkedScope)
        )

        const handle = Effect.tapCause((cause: Cause.Cause<Types.NoInfer<EX>>) => Queue.failCause(queue, cause))
        yield* pull.pipe(
          Effect.flatMap((value) => Effect.fork(handle(f(value)), { startImmediately: true })),
          Effect.flatMap((fiber) => Queue.offer(fibers, Fiber.await(fiber))),
          Effect.forever({ autoYield: false }),
          Effect.catchCause((cause) =>
            Queue.offer(fibers, Effect.succeed(Exit.failCause(cause))).pipe(
              Effect.andThen(Queue.end(fibers)),
              Effect.andThen(Queue.await(fibers))
            )
          ),
          Effect.forkIn(forkedScope)
        )
      }

      return Pull.fromQueue(queue)
    })
  )

/**
 * @since 4.0.0
 * @category sequencing
 */
export const tap: {
  <OutElem, X, OutErr1, Env1>(
    f: (d: Types.NoInfer<OutElem>) => Effect.Effect<X, OutErr1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
    }
  ): <OutErr, OutDone, InElem, InErr, InDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
  ) => Channel<OutElem, OutErr1 | OutErr, OutDone, InElem, InErr, InDone, Env1 | Env>
  <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env, X, OutErr1, Env1>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    f: (d: Types.NoInfer<OutElem>) => Effect.Effect<X, OutErr1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
    }
  ): Channel<OutElem, OutErr | OutErr1, OutDone, InElem, InErr, InDone, Env | Env1>
} = dual(
  (args) => isChannel(args[0]),
  <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env, X, OutErr1, Env1>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    f: (d: Types.NoInfer<OutElem>) => Effect.Effect<X, OutErr1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
    }
  ): Channel<OutElem, OutErr | OutErr1, OutDone, InElem, InErr, InDone, Env | Env1> =>
    mapEffect(self, (a) => Effect.as(f(a), a), options)
)

/**
 * Returns a new channel, which sequentially combines this channel, together
 * with the provided factory function, which creates a second channel based on
 * the output values of this channel. The result is a channel that will first
 * perform the functions of this channel, before performing the functions of
 * the created channel (including yielding its terminal value).
 *
 * @since 2.0.0
 * @category sequencing
 */
export const flatMap: {
  <OutElem, OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>(
    f: (d: OutElem) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
    }
  ): <OutErr, OutDone, InElem, InErr, InDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
  ) => Channel<
    OutElem1,
    OutErr1 | OutErr,
    OutDone,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env1 | Env
  >
  <
    OutElem,
    OutErr,
    OutDone,
    InElem,
    InErr,
    InDone,
    Env,
    OutElem1,
    OutErr1,
    OutDone1,
    InElem1,
    InErr1,
    InDone1,
    Env1
  >(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    f: (d: OutElem) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
    }
  ): Channel<
    OutElem1,
    OutErr | OutErr1,
    OutDone,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env | Env1
  >
} = dual(
  (args) => isChannel(args[0]),
  <
    OutElem,
    OutErr,
    OutDone,
    InElem,
    InErr,
    InDone,
    Env,
    OutElem1,
    OutErr1,
    OutDone1,
    InElem1,
    InErr1,
    InDone1,
    Env1
  >(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    f: (d: OutElem) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
    }
  ): Channel<
    OutElem1,
    OutErr | OutErr1,
    OutDone,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env | Env1
  > =>
    concurrencyIsSequential(options?.concurrency)
      ? flatMapSequential(self, f)
      : flatMapConcurrent(self, f, options as any)
)

const flatMapSequential = <
  OutElem,
  OutErr,
  OutDone,
  InElem,
  InErr,
  InDone,
  Env,
  OutElem1,
  OutErr1,
  OutDone1,
  InElem1,
  InErr1,
  InDone1,
  Env1
>(
  self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
  f: (d: OutElem) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>
): Channel<
  OutElem1,
  OutErr | OutErr1,
  OutDone,
  InElem & InElem1,
  InErr & InErr1,
  InDone & InDone1,
  Env | Env1
> =>
  fromTransform((upstream, scope) =>
    Effect.map(toTransform(self)(upstream, scope), (pull) => {
      let childPull: Effect.Effect<OutElem1, OutErr1, Env1> | undefined
      const makePull: Pull.Pull<OutElem1, OutErr | OutErr1, OutDone, Env1> = pull.pipe(
        Effect.flatMap((value) =>
          Effect.flatMap(Scope.fork(scope), (childScope) =>
            Effect.flatMap(toTransform(f(value))(upstream, childScope), (pull) => {
              childPull = Pull.catchHalt(pull, (_) => {
                childPull = undefined
                return Effect.andThen(Scope.close(childScope, Exit.succeed(_)), makePull)
              }) as any
              return childPull!
            }))
        )
      )
      return Effect.suspend(() => childPull ?? makePull)
    })
  )

const flatMapConcurrent = <
  OutElem,
  OutErr,
  OutDone,
  InElem,
  InErr,
  InDone,
  Env,
  OutElem1,
  OutErr1,
  OutDone1,
  InElem1,
  InErr1,
  InDone1,
  Env1
>(
  self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
  f: (d: OutElem) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>,
  options: {
    readonly concurrency: number | "unbounded"
    readonly bufferSize?: number | undefined
  }
): Channel<
  OutElem1,
  OutErr | OutErr1,
  OutDone,
  InElem & InElem1,
  InErr & InErr1,
  InDone & InDone1,
  Env | Env1
> => self.pipe(map(f), mergeAll(options))

/**
 * @since 2.0.0
 * @category sequencing
 */
export const concatWith: {
  <OutDone, OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>(
    f: (leftover: Types.NoInfer<OutDone>) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>
  ): <OutElem, OutErr, InElem, InErr, InDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
  ) => Channel<
    OutElem | OutElem1,
    OutErr1 | OutErr,
    OutDone1,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env1 | Env
  >
  <
    OutElem,
    OutErr,
    OutDone,
    InElem,
    InErr,
    InDone,
    Env,
    OutElem1,
    OutErr1,
    OutDone1,
    InElem1,
    InErr1,
    InDone1,
    Env1
  >(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    f: (leftover: Types.NoInfer<OutDone>) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>
  ): Channel<
    OutElem | OutElem1,
    OutErr1 | OutErr,
    OutDone1,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env1 | Env
  >
} = dual(2, <
  OutElem,
  OutErr,
  OutDone,
  InElem,
  InErr,
  InDone,
  Env,
  OutElem1,
  OutErr1,
  OutDone1,
  InElem1,
  InErr1,
  InDone1,
  Env1
>(
  self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
  f: (leftover: Types.NoInfer<OutDone>) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>
): Channel<
  OutElem | OutElem1,
  OutErr1 | OutErr,
  OutDone1,
  InElem & InElem1,
  InErr & InErr1,
  InDone & InDone1,
  Env1 | Env
> =>
  fromTransform((upstream, scope) =>
    Effect.sync(() => {
      let currentPull: Pull.Pull<OutElem | OutElem1, OutErr1 | OutErr, OutDone1, Env1 | Env> | undefined
      const makePull = Effect.flatMap(
        Scope.fork(scope),
        (forkedScope) =>
          Effect.flatMap(toTransform(self)(upstream, forkedScope), (pull) => {
            currentPull = Pull.catchHalt(pull, (leftover) =>
              Scope.close(forkedScope, Exit.succeed(leftover)).pipe(
                Effect.andThen(toTransform(f(leftover as OutDone))(upstream, scope)),
                Effect.flatMap((pull) => {
                  currentPull = pull
                  return pull
                })
              ))
            return currentPull
          })
      )
      return Effect.suspend(() => currentPull ?? makePull)
    })
  ))

/**
 * @since 2.0.0
 * @category sequencing
 */
export const concat: {
  <OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>(
    that: Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>
  ): <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
  ) => Channel<
    OutElem | OutElem1,
    OutErr1 | OutErr,
    OutDone1,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env1 | Env
  >
  <
    OutElem,
    OutErr,
    OutDone,
    InElem,
    InErr,
    InDone,
    Env,
    OutElem1,
    OutErr1,
    OutDone1,
    InElem1,
    InErr1,
    InDone1,
    Env1
  >(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    that: Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>
  ): Channel<
    OutElem | OutElem1,
    OutErr1 | OutErr,
    OutDone1,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env1 | Env
  >
} = dual(2, <
  OutElem,
  OutErr,
  OutDone,
  InElem,
  InErr,
  InDone,
  Env,
  OutElem1,
  OutErr1,
  OutDone1,
  InElem1,
  InErr1,
  InDone1,
  Env1
>(
  self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
  that: Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>
): Channel<
  OutElem | OutElem1,
  OutErr1 | OutErr,
  OutDone1,
  InElem & InElem1,
  InErr & InErr1,
  InDone & InDone1,
  Env1 | Env
> => concatWith(self, (_) => that))

/**
 * Flatten a channel of channels.
 *
 * @since 2.0.0
 * @category constructors
 */
export const flatten = <
  OutElem,
  OutErr,
  OutDone,
  InElem,
  InErr,
  InDone,
  Env,
  OutErr1,
  OutDone1,
  InElem1,
  InErr1,
  InDone1,
  Env1
>(
  channels: Channel<
    Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    OutErr1,
    OutDone1,
    InElem1,
    InErr1,
    InDone1,
    Env1
  >
): Channel<OutElem, OutErr | OutErr1, OutDone1, InElem & InElem1, InErr & InErr1, InDone & InDone1, Env | Env1> =>
  flatMap(channels, identity)

/**
 * @since 4.0.0
 * @category utils
 */
export const flattenArray = <
  OutElem,
  OutErr,
  OutDone,
  InElem,
  InErr,
  InDone,
  Env
>(
  self: Channel<ReadonlyArray<OutElem>, OutErr, OutDone, InElem, InErr, InDone, Env>
): Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env> =>
  fromTransform((upstream, scope) =>
    Effect.map(toTransform(self)(upstream, scope), (pull) => {
      let array: ReadonlyArray<OutElem> | undefined
      let index = 0
      const pump: Pull.Pull<OutElem, OutErr, OutDone> = Effect.suspend(() => {
        if (!array || index >= array.length) {
          return Effect.flatMap(pull, (array_) => {
            index = 0
            array = array_
            return pump
          })
        }
        return Effect.succeed(array[index++])
      })
      return pump
    })
  )

/**
 * @since 4.0.0
 * @category Error handling
 */
export const catchCause: {
  <OutErr, OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>(
    f: (d: Cause.Cause<OutErr>) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>
  ): <
    OutElem,
    OutDone,
    InElem,
    InErr,
    InDone,
    Env
  >(self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>) => Channel<
    OutElem | OutElem1,
    OutErr1,
    OutDone | OutDone1,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env | Env1
  >
  <
    OutElem,
    OutErr,
    OutDone,
    InElem,
    InErr,
    InDone,
    Env,
    OutElem1,
    OutErr1,
    OutDone1,
    InElem1,
    InErr1,
    InDone1,
    Env1
  >(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    f: (d: Cause.Cause<OutErr>) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>
  ): Channel<
    OutElem | OutElem1,
    OutErr1,
    OutDone | OutDone1,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env | Env1
  >
} = dual(2, <
  OutElem,
  OutErr,
  OutDone,
  InElem,
  InErr,
  InDone,
  Env,
  OutElem1,
  OutErr1,
  OutDone1,
  InElem1,
  InErr1,
  InDone1,
  Env1
>(
  self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
  f: (d: Cause.Cause<OutErr>) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>
): Channel<
  OutElem | OutElem1,
  OutErr1,
  OutDone | OutDone1,
  InElem & InElem1,
  InErr & InErr1,
  InDone & InDone1,
  Env | Env1
> =>
  fromTransform((upstream, scope) =>
    Effect.map(toTransform(self)(upstream, scope), (pull) => {
      let currentPull: Pull.Pull<OutElem | OutElem1, OutErr1, OutDone | OutDone1, Env | Env1> = pull.pipe(
        Effect.catchCause((cause): Pull.Pull<OutElem1, OutErr1, OutDone | OutDone1, Env1> => {
          if (Pull.isHaltCause(cause)) {
            return Effect.failCause(cause as Cause.Cause<Pull.Halt<OutDone>>)
          }
          return toTransform(f(cause as Cause.Cause<OutErr>))(upstream, scope).pipe(
            Effect.flatMap((childPull) => {
              currentPull = childPull
              return childPull
            })
          )
        })
      )
      return Effect.suspend(() => currentPull)
    })
  ))

/**
 * @since 4.0.0
 * @category Error handling
 */
export const catchCauseIf: {
  <OutErr, EB, OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>(
    filter: Filter.Filter<Cause.Cause<OutErr>, EB>,
    f: (failure: EB, cause: Cause.Cause<OutErr>) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>
  ): <
    OutElem,
    OutDone,
    InElem,
    InErr,
    InDone,
    Env
  >(self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>) => Channel<
    OutElem | OutElem1,
    Exclude<OutErr, Cause.Failure.Error<EB>> | OutErr1,
    OutDone | OutDone1,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env | Env1
  >
  <
    OutElem,
    OutErr,
    OutDone,
    InElem,
    InErr,
    InDone,
    Env,
    EB,
    OutElem1,
    OutErr1,
    OutDone1,
    InElem1,
    InErr1,
    InDone1,
    Env1
  >(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    filter: Filter.Filter<Cause.Cause<OutErr>, EB>,
    f: (failure: EB, cause: Cause.Cause<OutErr>) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>
  ): Channel<
    OutElem | OutElem1,
    Exclude<OutErr, Cause.Failure.Error<EB>> | OutErr1,
    OutDone | OutDone1,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env | Env1
  >
} = dual(3, <
  OutElem,
  OutErr,
  OutDone,
  InElem,
  InErr,
  InDone,
  Env,
  EB,
  OutElem1,
  OutErr1,
  OutDone1,
  InElem1,
  InErr1,
  InDone1,
  Env1
>(
  self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
  filter: Filter.Filter<Cause.Cause<OutErr>, EB>,
  f: (failure: EB, cause: Cause.Cause<OutErr>) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>
): Channel<
  OutElem | OutElem1,
  OutErr | OutErr1,
  OutDone | OutDone1,
  InElem & InElem1,
  InErr & InErr1,
  InDone & InDone1,
  Env | Env1
> =>
  catchCause(self, (cause): Channel<OutElem1, OutErr | OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1> => {
    const eb = filter(cause)
    return eb !== Filter.absent ? f(eb, cause) : failCause(cause)
  }))

const catch_: {
  <OutErr, OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>(
    f: (d: OutErr) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>
  ): <
    OutElem,
    OutDone,
    InElem,
    InErr,
    InDone,
    Env
  >(self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>) => Channel<
    OutElem | OutElem1,
    OutErr1,
    OutDone | OutDone1,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env | Env1
  >
  <
    OutElem,
    OutErr,
    OutDone,
    InElem,
    InErr,
    InDone,
    Env,
    OutElem1,
    OutErr1,
    OutDone1,
    InElem1,
    InErr1,
    InDone1,
    Env1
  >(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    f: (d: OutErr) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>
  ): Channel<
    OutElem | OutElem1,
    OutErr1,
    OutDone | OutDone1,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env | Env1
  >
} = dual(2, <
  OutElem,
  OutErr,
  OutDone,
  InElem,
  InErr,
  InDone,
  Env,
  OutElem1,
  OutErr1,
  OutDone1,
  InElem1,
  InErr1,
  InDone1,
  Env1
>(
  self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
  f: (d: OutErr) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>
): Channel<
  OutElem | OutElem1,
  OutErr1,
  OutDone | OutDone1,
  InElem & InElem1,
  InErr & InErr1,
  InDone & InDone1,
  Env | Env1
> => catchCauseIf(self, Cause.filterError, f) as any)

export {
  /**
   * @since 4.0.0
   * @category Error handling
   */
  catch_ as catch
}

/**
 * @since 4.0.0
 * @category Error handling
 */
export const orDie = <
  OutElem,
  OutErr,
  OutDone,
  InElem,
  InErr,
  InDone,
  Env
>(
  self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
): Channel<OutElem, never, OutDone, InElem, InErr, InDone, Env> => catch_(self, die)

/**
 * Returns a new channel, which sequentially combines this channel, together
 * with the provided factory function, which creates a second channel based on
 * the output values of this channel. The result is a channel that will first
 * perform the functions of this channel, before performing the functions of
 * the created channel (including yielding its terminal value).
 *
 * @since 2.0.0
 * @category sequencing
 */
export const switchMap: {
  <OutElem, OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>(
    f: (d: OutElem) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
    }
  ): <OutErr, OutDone, InElem, InErr, InDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
  ) => Channel<
    OutElem1,
    OutErr1 | OutErr,
    OutDone,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env1 | Env
  >
  <
    OutElem,
    OutErr,
    OutDone,
    InElem,
    InErr,
    InDone,
    Env,
    OutElem1,
    OutErr1,
    OutDone1,
    InElem1,
    InErr1,
    InDone1,
    Env1
  >(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    f: (d: OutElem) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
    }
  ): Channel<
    OutElem1,
    OutErr | OutErr1,
    OutDone,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env | Env1
  >
} = dual(
  (args) => isChannel(args[0]),
  <
    OutElem,
    OutErr,
    OutDone,
    InElem,
    InErr,
    InDone,
    Env,
    OutElem1,
    OutErr1,
    OutDone1,
    InElem1,
    InErr1,
    InDone1,
    Env1
  >(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    f: (d: OutElem) => Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
    }
  ): Channel<
    OutElem1,
    OutErr | OutErr1,
    OutDone,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env | Env1
  > =>
    self.pipe(
      map(f),
      mergeAll({
        ...options,
        concurrency: options?.concurrency ?? 1,
        switch: true
      })
    )
)

/**
 * @since 2.0.0
 * @category utils
 */
export const mergeAll: {
  (options: {
    readonly concurrency: number | "unbounded"
    readonly bufferSize?: number | undefined
    readonly switch?: boolean | undefined
  }): <OutElem, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1, OutErr, OutDone, InElem, InErr, InDone, Env>(
    channels: Channel<
      Channel<OutElem, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>,
      OutErr,
      OutDone,
      InElem,
      InErr,
      InDone,
      Env
    >
  ) => Channel<
    OutElem,
    OutErr1 | OutErr,
    OutDone,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env1 | Env
  >
  <OutElem, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1, OutErr, OutDone, InElem, InErr, InDone, Env>(
    channels: Channel<
      Channel<OutElem, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>,
      OutErr,
      OutDone,
      InElem,
      InErr,
      InDone,
      Env
    >,
    options: {
      readonly concurrency: number | "unbounded"
      readonly bufferSize?: number | undefined
      readonly switch?: boolean | undefined
    }
  ): Channel<
    OutElem,
    OutErr1 | OutErr,
    OutDone,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env1 | Env
  >
} = dual(
  2,
  <OutElem, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1, OutErr, OutDone, InElem, InErr, InDone, Env>(
    channels: Channel<
      Channel<OutElem, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>,
      OutErr,
      OutDone,
      InElem,
      InErr,
      InDone,
      Env
    >,
    { bufferSize = 16, concurrency, switch: switch_ = false }: {
      readonly concurrency: number | "unbounded"
      readonly bufferSize?: number | undefined
      readonly switch?: boolean | undefined
    }
  ): Channel<
    OutElem,
    OutErr1 | OutErr,
    OutDone,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env1 | Env
  > =>
    makeImplBracket(
      Effect.fnUntraced(function*(upstream, scope, forkedScope) {
        const concurrencyN = concurrency === "unbounded"
          ? Number.MAX_SAFE_INTEGER
          : Math.max(1, concurrency)
        const semaphore = switch_ ? undefined : Effect.unsafeMakeSemaphore(concurrencyN)
        const doneLatch = yield* Effect.makeLatch(true)
        const fibers = new Set<Fiber.Fiber<any, any>>()

        const queue = yield* Queue.bounded<OutElem, OutErr | OutErr1 | Pull.Halt<OutDone>>(
          bufferSize
        )
        yield* Scope.addFinalizer(forkedScope, () => Queue.shutdown(queue))

        const pull = yield* toTransform(channels)(upstream, scope)

        yield* Effect.gen(function*() {
          while (true) {
            if (semaphore) yield* semaphore.take(1)
            const channel = yield* pull
            const childScope = yield* Scope.fork(forkedScope)
            const childPull = yield* toTransform(channel)(upstream, childScope)

            while (fibers.size >= concurrencyN) {
              const fiber = Iterable.unsafeHead(fibers)
              fibers.delete(fiber)
              if (fibers.size === 0) yield* doneLatch.open
              yield* Fiber.interrupt(fiber)
            }

            const fiber = yield* childPull.pipe(
              Effect.flatMap((value) => Queue.offer(queue, value)),
              Effect.forever,
              Effect.onError(Effect.fnUntraced(function*(cause) {
                const halt = Pull.filterHalt(cause)
                yield* Scope.close(
                  childScope,
                  halt !== Filter.absent ? Exit.succeed(halt.leftover) : Exit.failCause(cause)
                )
                if (!fibers.has(fiber)) return
                fibers.delete(fiber)
                if (semaphore) yield* semaphore.release(1)
                if (fibers.size === 0) yield* doneLatch.open
                if (halt) return
                return yield* Queue.failCause(queue, cause as any)
              })),
              Effect.fork
            )

            doneLatch.unsafeClose()
            fibers.add(fiber)
          }
        }).pipe(
          Effect.catchCause((cause) => doneLatch.whenOpen(Queue.failCause(queue, cause))),
          Effect.forkIn(forkedScope),
          Effect.interruptible
        )

        return Pull.fromQueue(queue)
      })
    )
)

/**
 * @since 2.0.0
 * @category models
 */
export type HaltStrategy = "left" | "right" | "both" | "either"

/**
 * Returns a new channel, which is the merge of this channel and the specified
 * channel.
 *
 * @since 2.0.0
 * @category utils
 */
export const merge: {
  <OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>(
    right: Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>,
    options?: {
      readonly haltStrategy?: HaltStrategy | undefined
    } | undefined
  ): <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>(
    left: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
  ) => Channel<
    OutElem1 | OutElem,
    OutErr | OutErr1,
    OutDone | OutDone1,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env1 | Env
  >
  <
    OutElem,
    OutErr,
    OutDone,
    InElem,
    InErr,
    InDone,
    Env,
    OutElem1,
    OutErr1,
    OutDone1,
    InElem1,
    InErr1,
    InDone1,
    Env1
  >(
    left: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    right: Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>,
    options?: {
      readonly haltStrategy?: HaltStrategy | undefined
    } | undefined
  ): Channel<
    OutElem | OutElem1,
    OutErr | OutErr1,
    OutDone | OutDone1,
    InElem & InElem1,
    InErr & InErr1,
    InDone & InDone1,
    Env | Env1
  >
} = dual((args) => isChannel(args[0]) && isChannel(args[1]), <
  OutElem,
  OutErr,
  OutDone,
  InElem,
  InErr,
  InDone,
  Env,
  OutElem1,
  OutErr1,
  OutDone1,
  InElem1,
  InErr1,
  InDone1,
  Env1
>(
  left: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
  right: Channel<OutElem1, OutErr1, OutDone1, InElem1, InErr1, InDone1, Env1>,
  options?: {
    readonly haltStrategy?: HaltStrategy | undefined
  } | undefined
): Channel<
  OutElem | OutElem1,
  OutErr | OutErr1,
  OutDone | OutDone1,
  InElem & InElem1,
  InErr & InErr1,
  InDone & InDone1,
  Env | Env1
> =>
  makeImplBracket(Effect.fnUntraced(function*(upstream, _scope, forkedScope) {
    const strategy = options?.haltStrategy ?? "both"
    const queue = yield* Queue.bounded<OutElem | OutElem1, OutErr | OutErr1 | Pull.Halt<OutDone | OutDone1>>(0)
    yield* Scope.addFinalizer(forkedScope, () => Queue.shutdown(queue))
    let done = 0
    function onExit(
      side: "left" | "right",
      cause: Cause.Cause<OutErr | OutErr1 | Pull.Halt<OutDone | OutDone1>>
    ): Effect.Effect<void> {
      done++
      if (!Pull.isHaltCause(cause)) {
        return Queue.failCause(queue, cause)
      }
      switch (strategy) {
        case "both": {
          return done === 2 ? Queue.failCause(queue, cause) : Effect.void
        }
        case "left":
        case "right": {
          return side === strategy ? Queue.failCause(queue, cause) : Effect.void
        }
        case "either": {
          return Queue.failCause(queue, cause)
        }
      }
    }
    const runSide = (
      side: "left" | "right",
      channel: Channel<
        OutElem | OutElem1,
        OutErr | OutErr1,
        OutDone | OutDone1,
        InElem & InElem1,
        InErr & InErr1,
        InDone & InDone1,
        Env | Env1
      >,
      scope: Scope.Scope.Closeable
    ) =>
      toTransform(channel)(upstream, scope).pipe(
        Effect.flatMap((pull) =>
          pull.pipe(
            Effect.flatMap((value) => Queue.offer(queue, value)),
            Effect.forever
          )
        ),
        Effect.onError((cause) =>
          Effect.andThen(
            Scope.close(scope, Pull.haltExitFromCause(cause)),
            onExit(side, cause)
          )
        ),
        Effect.forkIn(forkedScope),
        Effect.interruptible
      )
    yield* runSide("left", left, yield* Scope.fork(forkedScope))
    yield* runSide("right", right, yield* Scope.fork(forkedScope))
    return Pull.fromQueue(queue)
  })))

/**
 * Returns a new channel that pipes the output of this channel into the
 * specified channel. The returned channel has the input type of this channel,
 * and the output type of the specified channel, terminating with the value of
 * the specified channel.
 *
 * @since 2.0.0
 * @category utils
 */
export const pipeTo: {
  <OutElem2, OutErr2, OutDone2, OutElem, OutErr, OutDone, Env2>(
    that: Channel<OutElem2, OutErr2, OutDone2, OutElem, OutErr, OutDone, Env2>
  ): <InElem, InErr, InDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
  ) => Channel<OutElem2, OutErr2, OutDone2, InElem, InErr, InDone, Env2 | Env>
  <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env, OutElem2, OutErr2, OutDone2, Env2>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    that: Channel<OutElem2, OutErr2, OutDone2, OutElem, OutErr, OutDone, Env2>
  ): Channel<OutElem2, OutErr2, OutDone2, InElem, InErr, InDone, Env2 | Env>
} = dual(
  2,
  <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env, OutElem2, OutErr2, OutDone2, Env2>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    that: Channel<OutElem2, OutErr2, OutDone2, OutElem, OutErr, OutDone, Env2>
  ): Channel<OutElem2, OutErr2, OutDone2, InElem, InErr, InDone, Env2 | Env> =>
    fromTransform((upstream, scope) =>
      Effect.flatMap(toTransform(self)(upstream, scope), (upstream) => toTransform(that)(upstream, scope))
    )
)

/**
 * Returns a new channel that pipes the output of this channel into the
 * specified channel and preserves this channel's failures without providing
 * them to the other channel for observation.
 *
 * @since 2.0.0
 * @category utils
 */
export const pipeToOrFail: {
  <OutElem2, OutErr2, OutDone2, OutElem, OutDone, Env2>(
    that: Channel<OutElem2, OutErr2, OutDone2, OutElem, never, OutDone, Env2>
  ): <OutErr, InElem, InErr, InDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
  ) => Channel<OutElem2, OutErr | OutErr2, OutDone2, InElem, InErr, InDone, Env2 | Env>
  <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env, OutElem2, OutErr2, OutDone2, Env2>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    that: Channel<OutElem2, OutErr2, OutDone2, OutElem, never, OutDone, Env2>
  ): Channel<OutElem2, OutErr | OutErr2, OutDone2, InElem, InErr, InDone, Env2 | Env>
} = dual(
  2,
  <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env, OutElem2, OutErr2, OutDone2, Env2>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    that: Channel<OutElem2, OutErr2, OutDone2, OutElem, never, OutDone, Env2>
  ): Channel<OutElem2, OutErr | OutErr2, OutDone2, InElem, InErr, InDone, Env2 | Env> =>
    fromTransform((upstream, scope) =>
      Effect.flatMap(toTransform(self)(upstream, scope), (upstream) => {
        const upstreamPull = Effect.catchCause(
          upstream,
          (cause) => Pull.isHaltCause(cause) ? Effect.failCause(cause) : Effect.die(new Pull.Halt(cause))
        ) as Pull.Pull<OutElem, never, OutDone>

        return Effect.map(
          toTransform(that)(upstreamPull, scope),
          (pull) =>
            Effect.catchDefect(
              pull,
              (defect) =>
                Pull.isHalt(defect) ? Effect.failCause(defect.leftover as Cause.Cause<OutErr>) : Effect.die(defect)
            )
        )
      })
    )
)

/**
 * Constructs a `Channel` from a scoped effect that will result in a
 * `Channel` if successful.
 *
 * @since 2.0.0
 * @category constructors
 */
export const unwrap = <OutElem, OutErr, OutDone, InElem, InErr, InDone, R2, E, R>(
  channel: Effect.Effect<Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, R2>, E, R>
): Channel<OutElem, E | OutErr, OutDone, InElem, InErr, InDone, Exclude<R, Scope.Scope> | R2> =>
  fromTransform((upstream, scope) =>
    Effect.flatMap(
      Scope.provide(channel, scope),
      (channel) => toTransform(channel)(upstream, scope)
    )
  )

/**
 * Returns a new channel which embeds the given input handler into a Channel.
 *
 * @since 2.0.0
 * @category utils
 */
export const embedInput: {
  <InElem, InErr, InDone, R>(
    input: (
      upstream: Pull.Pull<InElem, InErr, InDone>
    ) => Effect.Effect<void, never, R>
  ): <OutElem, OutErr, OutDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>
  ) => Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env | R>
  <OutElem, OutErr, OutDone, Env, InErr, InElem, InDone, R>(
    self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>,
    input: (
      upstream: Pull.Pull<InElem, InErr, InDone>
    ) => Effect.Effect<void, never, R>
  ): Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env | R>
} = dual(
  2,
  <OutElem, OutErr, OutDone, Env, InErr, InElem, InDone, R>(
    self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>,
    input: (
      upstream: Pull.Pull<InElem, InErr, InDone>
    ) => Effect.Effect<void, never, R>
  ): Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env | R> =>
    makeImplBracket((upstream, scope, forkedScope) =>
      Effect.andThen(
        Effect.interruptible(Effect.forkIn(input(upstream), forkedScope)),
        toTransform(self)(Pull.haltVoid, scope)
      )
    )
)

/**
 * Returns a new channel with an attached finalizer. The finalizer is
 * guaranteed to be executed so long as the channel begins execution (and
 * regardless of whether or not it completes).
 *
 * @since 4.0.0
 * @category utils
 */
export const onExit: {
  <OutDone, OutErr, Env2>(
    finalizer: (e: Exit.Exit<OutDone, OutErr>) => Effect.Effect<unknown, never, Env2>
  ): <OutElem, InElem, InErr, InDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
  ) => Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env2 | Env>
  <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env, Env2>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    finalizer: (e: Exit.Exit<OutDone, OutErr>) => Effect.Effect<unknown, never, Env2>
  ): Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env2 | Env>
} = dual(2, <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env, Env2>(
  self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
  finalizer: (e: Exit.Exit<OutDone, OutErr>) => Effect.Effect<unknown, never, Env2>
): Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env2 | Env> =>
  makeImplBracket((upstream, scope, forkedScope) =>
    Scope.addFinalizer(forkedScope, finalizer as any).pipe(
      Effect.andThen(toTransform(self)(upstream, scope))
    )
  ))

/**
 * Returns a new channel with an attached finalizer. The finalizer is
 * guaranteed to be executed so long as the channel begins execution (and
 * regardless of whether or not it completes).
 *
 * @since 2.0.0
 * @category utils
 */
export const ensuring: {
  <Env2>(
    finalizer: Effect.Effect<unknown, never, Env2>
  ): <OutElem, OutDone, OutErr, InElem, InErr, InDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
  ) => Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env2 | Env>
  <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env, Env2>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    finalizer: Effect.Effect<unknown, never, Env2>
  ): Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env2 | Env>
} = dual(2, <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env, Env2>(
  self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
  finalizer: Effect.Effect<unknown, never, Env2>
): Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env2 | Env> => onExit(self, (_) => finalizer))

const runWith = <
  OutElem,
  OutErr,
  OutDone,
  Env,
  EX,
  RX,
  AH = OutDone,
  EH = never,
  RH = never
>(
  self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>,
  f: (pull: Pull.Pull<OutElem, OutErr, OutDone>) => Effect.Effect<void, EX, RX>,
  onHalt?: (leftover: OutDone) => Effect.Effect<AH, EH, RH>
): Effect.Effect<AH, Pull.ExcludeHalt<EX> | EH, Env | RX | RH> =>
  Effect.suspend(() => {
    const scope = Scope.unsafeMake()
    const makePull = toTransform(self)(Pull.haltVoid, scope)
    return Pull.catchHalt(Effect.flatMap(makePull, f), onHalt ? onHalt : Effect.succeed as any).pipe(
      Effect.onExit((exit) => Scope.close(scope, exit))
    ) as any
  })

/**
 * @since 2.0.0
 * @category execution
 */
export const runCount = <OutElem, OutErr, OutDone, Env>(
  self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>
): Effect.Effect<void, OutErr, Env> => runFold(self, () => 0, (acc) => acc + 1)

/**
 * @since 2.0.0
 * @category execution
 */
export const runDrain = <OutElem, OutErr, OutDone, Env>(
  self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>
): Effect.Effect<OutDone, OutErr, Env> => runWith(self, (pull) => Effect.forever(pull, { autoYield: false }))

/**
 * @since 2.0.0
 * @category execution
 */
export const runForEach: {
  <OutElem, EX, RX>(
    f: (o: OutElem) => Effect.Effect<void, EX, RX>
  ): <OutErr, OutDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>
  ) => Effect.Effect<OutDone, OutErr | EX, Env | RX>
  <OutElem, OutErr, OutDone, Env, EX, RX>(
    self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>,
    f: (o: OutElem) => Effect.Effect<void, EX, RX>
  ): Effect.Effect<OutDone, OutErr | EX, Env | RX>
} = dual(
  2,
  <OutElem, OutErr, OutDone, Env, EX, RX>(
    self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>,
    f: (o: OutElem) => Effect.Effect<void, EX, RX>
  ): Effect.Effect<OutDone, OutErr | EX, Env | RX> =>
    runWith(self, (pull) => Effect.forever(Effect.flatMap(pull, f), { autoYield: false }))
)

/**
 * @since 2.0.0
 * @category execution
 */
export const runCollect = <OutElem, OutErr, OutDone, Env>(
  self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>
): Effect.Effect<Array<OutElem>, OutErr, Env> =>
  runFold(self, () => [] as Array<OutElem>, (acc, o) => {
    acc.push(o)
    return acc
  })

/**
 * @since 2.0.0
 * @category execution
 */
export const runFold: {
  <Z, OutElem>(
    initial: LazyArg<Z>,
    f: (acc: Z, o: OutElem) => Z
  ): <OutErr, OutDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>
  ) => Effect.Effect<Z, OutErr, Env>
  <OutElem, OutErr, OutDone, Env, Z>(
    self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>,
    initial: LazyArg<Z>,
    f: (acc: Z, o: OutElem) => Z
  ): Effect.Effect<Z, OutErr, Env>
} = dual(3, <OutElem, OutErr, OutDone, Env, Z>(
  self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>,
  initial: LazyArg<Z>,
  f: (acc: Z, o: OutElem) => Z
): Effect.Effect<Z, OutErr, Env> =>
  Effect.suspend(() => {
    let state = initial()
    return runWith(
      self,
      (pull) =>
        Effect.whileLoop({
          while: constTrue,
          body: () => pull,
          step: (value) => {
            state = f(state, value)
          }
        }),
      () => Effect.succeed(state)
    )
  }))

/**
 * @since 2.0.0
 * @category constructors
 */
export const toPull: <OutElem, OutErr, OutDone, Env>(
  self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>
) => Effect.Effect<
  Pull.Pull<OutElem, OutErr, OutDone>,
  never,
  Env | Scope.Scope
> = Effect.fnUntraced(
  function*<OutElem, OutErr, OutDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>
  ) {
    const semaphore = Effect.unsafeMakeSemaphore(1)
    const context = yield* Effect.services<Env | Scope.Scope>()
    const scope = ServiceMap.get(context, Scope.Scope)
    const pull = yield* toTransform(self)(Pull.haltVoid, scope)
    return pull.pipe(
      Effect.provideServices(context),
      semaphore.withPermits(1)
    )
  },
  // ensure errors are redirected to the pull effect
  Effect.catchCause((cause) => Effect.succeed(Effect.failCause(cause)))
) as any

/**
 * @since 4.0.0
 * @category constructors
 */
export const toPullScoped = <OutElem, OutErr, OutDone, Env>(
  self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>,
  scope: Scope.Scope
): Effect.Effect<Pull.Pull<OutElem, OutErr, OutDone, Env>, never, Env> => toTransform(self)(Pull.haltVoid, scope)

/**
 * @since 4.0.0
 * @category conversions
 */
export const toQueue: {
  (options?: {
    readonly bufferSize?: number | undefined
  }): <OutElem, OutErr, OutDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>
  ) => Effect.Effect<Queue.Dequeue<OutElem, OutErr>, never, Env | Scope.Scope>
  <OutElem, OutErr, OutDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>,
    options?: {
      readonly bufferSize?: number | undefined
    }
  ): Effect.Effect<Queue.Dequeue<OutElem, OutErr>, never, Env | Scope.Scope>
} = dual(
  (args) => isChannel(args[0]),
  Effect.fnUntraced(function*<OutElem, OutErr, OutDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>,
    options?: {
      readonly bufferSize?: number | undefined
    }
  ) {
    const scope = yield* Effect.scope
    const queue = yield* Queue.make<OutElem, OutErr>({
      capacity: options?.bufferSize
    })
    yield* Scope.addFinalizer(scope, () => Queue.shutdown(queue))
    yield* runForEach(self, (value) => Queue.offer(queue, value)).pipe(
      Effect.onExit((exit) => Queue.done(queue, Exit.asVoid(exit))),
      Effect.forkIn(scope),
      Effect.interruptible
    )
    return queue
  })
)
