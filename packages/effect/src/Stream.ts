/**
 * @since 2.0.0
 */
import * as Arr from "./Array.js"
import type * as Cause from "./Cause.js"
import * as Channel from "./Channel.js"
import * as Effect from "./Effect.js"
import type { LazyArg } from "./Function.js"
import { dual, identity } from "./Function.js"
import type { TypeLambda } from "./HKT.js"
import * as Option from "./Option.js"
import { type Pipeable, pipeArguments } from "./Pipeable.js"
import { hasProperty } from "./Predicate.js"
import type * as PubSub from "./PubSub.js"
import * as Pull from "./Pull.js"
import * as Queue from "./Queue.js"
import type * as Scope from "./Scope.js"
import type * as Sink from "./Sink.js"
import type { Covariant } from "./Types.js"
import type * as Unify from "./Unify.js"

/**
 * @since 2.0.0
 * @category symbols
 */
export const StreamTypeId: unique symbol = Symbol.for("effect/Stream")

/**
 * @since 2.0.0
 * @category symbols
 */
export type StreamTypeId = typeof StreamTypeId

/**
 * A `Stream<A, E, R>` is a description of a program that, when evaluated, may
 * emit zero or more values of type `A`, may fail with errors of type `E`, and
 * uses an context of type `R`. One way to think of `Stream` is as a
 * `Effect` program that could emit multiple values.
 *
 * `Stream` is a purely functional *pull* based stream. Pull based streams offer
 * inherent laziness and backpressure, relieving users of the need to manage
 * buffers between operators. As an optimization, `Stream` does not emit
 * single values, but rather an array of values. This allows the cost of effect
 * evaluation to be amortized.
 *
 * `Stream` forms a monad on its `A` type parameter, and has error management
 * facilities for its `E` type parameter, modeled similarly to `Effect` (with
 * some adjustments for the multiple-valued nature of `Stream`). These aspects
 * allow for rich and expressive composition of streams.
 *
 * @since 2.0.0
 * @category models
 */
export interface Stream<out A, out E = never, out R = never> extends Stream.Variance<A, E, R>, Pipeable {
  readonly channel: Channel.Channel<Arr.NonEmptyReadonlyArray<A>, E, void, unknown, unknown, unknown, R>
  [Unify.typeSymbol]?: unknown
  [Unify.unifySymbol]?: StreamUnify<this>
  [Unify.ignoreSymbol]?: StreamUnifyIgnore
}

/**
 * @since 2.0.0
 * @category models
 */
export interface StreamUnify<A extends { [Unify.typeSymbol]?: any }> extends Effect.EffectUnify<A> {
  Stream?: () => A[Unify.typeSymbol] extends Stream<infer A0, infer E0, infer R0> | infer _ ? Stream<A0, E0, R0> : never
}

/**
 * @category models
 * @since 2.0.0
 */
export interface StreamUnifyIgnore extends Effect.EffectUnifyIgnore {
  Effect?: true
}

/**
 * @category type lambdas
 * @since 2.0.0
 */
export interface StreamTypeLambda extends TypeLambda {
  readonly type: Stream<this["Target"], this["Out1"], this["Out2"]>
}

/**
 * @since 2.0.0
 */
export declare namespace Stream {
  /**
   * @since 2.0.0
   * @category models
   */
  export interface Variance<out A, out E, out R> {
    readonly [StreamTypeId]: VarianceStruct<A, E, R>
  }

  /**
   * @since 3.4.0
   * @category models
   */
  export interface VarianceStruct<out A, out E, out R> {
    readonly _A: Covariant<A>
    readonly _E: Covariant<E>
    readonly _R: Covariant<R>
  }

  /**
   * @since 3.4.0
   * @category type-level
   */
  export type Success<T extends Stream<any, any, any>> = [T] extends [Stream<infer _A, infer _E, infer _R>] ? _A : never

  /**
   * @since 3.4.0
   * @category type-level
   */
  export type Error<T extends Stream<any, any, any>> = [T] extends [Stream<infer _A, infer _E, infer _R>] ? _E : never

  /**
   * @since 3.4.0
   * @category type-level
   */
  export type Context<T extends Stream<any, any, any>> = [T] extends [Stream<infer _A, infer _E, infer _R>] ? _R : never
}

const streamVariance = {
  _R: identity,
  _E: identity,
  _A: identity
}

/** @internal */
export const isStream = (u: unknown): u is Stream<unknown, unknown, unknown> => hasProperty(u, StreamTypeId)

const StreamProto = {
  [StreamTypeId]: streamVariance,
  pipe() {
    return pipeArguments(this, arguments)
  }
}

/**
 * Creates a stream from a `Channel`.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromChannel = <Arr extends Arr.NonEmptyReadonlyArray<any>, E, R>(
  channel: Channel.Channel<Arr, E, void, unknown, unknown, unknown, R>
): Stream<Arr extends Arr.NonEmptyReadonlyArray<infer A> ? A : never, E, R> => {
  const self = Object.create(StreamProto)
  self.channel = channel
  return self
}

/**
 * Creates a stream from a pull effect
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromPull = <A, E, R, EX, RX>(
  pull: Effect.Effect<Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E, void, R>, EX, RX>
): Stream<A, Pull.ExcludeHalt<E> | EX, R | RX> => fromChannel(Channel.fromPull(pull))

/**
 * Derive a Stream from a pull effect.
 *
 * @since 4.0.0
 * @category utils
 */
export const transformPull = <A, E, R, B, E2, R2, EX, RX>(
  self: Stream<A, E, R>,
  f: (pull: Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E, void, R>, scope: Scope.Scope) => Effect.Effect<
    Pull.Pull<Arr.NonEmptyReadonlyArray<B>, E2, void, R2>,
    EX,
    RX
  >
): Stream<B, EX | Pull.ExcludeHalt<E2>, R | R2 | RX> =>
  fromChannel(
    Channel.fromTransform((_, scope) =>
      Effect.flatMap(Channel.toPullScoped(self.channel, scope), (pull) => f(pull, scope))
    )
  )

/**
 * Creates a channel from a `Stream`.
 *
 * @since 2.0.0
 * @category constructors
 */
export const toChannel = <A, E, R>(
  stream: Stream<A, E, R>
): Channel.Channel<Arr.NonEmptyReadonlyArray<A>, E, void, unknown, unknown, unknown, R> => stream.channel

/**
 * Creates a stream from an external resource.
 *
 * You can use the `Queue` with the apis from the `Queue` module to emit
 * values to the stream or to signal the stream ending.
 *
 * By default it uses an "unbounded" buffer size.
 * You can customize the buffer size and strategy by passing an object as the
 * second argument with the `bufferSize` and `strategy` fields.
 *
 * @since 2.0.0
 * @category constructors
 */
export const callback = <A, E = never, R = never>(
  f: (queue: Queue.Queue<A, E>) => void | Effect.Effect<unknown, E, R | Scope.Scope>,
  options?: {
    readonly bufferSize?: number | undefined
    readonly strategy?: "sliding" | "dropping" | "suspend" | undefined
  }
): Stream<A, E, Exclude<R, Scope.Scope>> => fromChannel(Channel.callbackArray(f, options))

/**
 * Creates a `Stream` that emits no elements.
 *
 * @since 4.0.0
 * @category constructors
 */
export const empty: Stream<never> = fromChannel(Channel.empty)

/**
 * Creates a single-valued pure stream.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * // A Stream with a single number
 * const stream = Stream.succeed(3)
 *
 * // Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // [ 3 ]
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const succeed = <A>(value: A): Stream<A> => fromChannel(Channel.succeed(Arr.of(value)))

/**
 * Creates a stream from an sequence of values.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const stream = Stream.make(1, 2, 3)
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // { _id: 'Chunk', values: [ 1, 2, 3 ] }
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const make = <const As extends ReadonlyArray<any>>(...values: As): Stream<As[number]> =>
  Arr.isNonEmptyReadonlyArray(values) ? fromArray(values) : empty

/**
 * Creates a single-valued pure stream.
 *
 * @since 2.0.0
 * @category constructors
 */
export const sync = <A>(evaluate: LazyArg<A>): Stream<A> => fromChannel(Channel.sync(() => Arr.of(evaluate())))

/**
 * Returns a lazily constructed stream.
 *
 * @since 2.0.0
 * @category constructors
 */
export const suspend = <A, E, R>(stream: LazyArg<Stream<A, E, R>>): Stream<A, E, R> =>
  fromChannel(Channel.suspend(() => stream().channel))

/**
 * Terminates with the specified error.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const stream = Stream.fail("Uh oh!")
 *
 * Effect.runPromiseExit(Stream.runCollect(stream)).then(console.log)
 * // {
 * //   _id: 'Exit',
 * //   _tag: 'Failure',
 * //   cause: { _id: 'Cause', _tag: 'Fail', failure: 'Uh oh!' }
 * // }
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const fail = <E>(error: E): Stream<never, E> => fromChannel(Channel.fail(error))

/**
 * Terminates with the specified lazily evaluated error.
 *
 * @since 2.0.0
 * @category constructors
 */
export const failSync = <E>(evaluate: LazyArg<E>): Stream<never, E> => fromChannel(Channel.failSync(evaluate))

/**
 * The stream that always fails with the specified `Cause`.
 *
 * @since 2.0.0
 * @category constructors
 */
export const failCause = <E>(cause: Cause.Cause<E>): Stream<never, E> => fromChannel(Channel.failCause(cause))

/**
 * The stream that always fails with the specified lazily evaluated `Cause`.
 *
 * @since 2.0.0
 * @category constructors
 */
export const failCauseSync = <E>(evaluate: LazyArg<Cause.Cause<E>>): Stream<never, E> =>
  fromChannel(Channel.failCauseSync(evaluate))

/**
 * Creates a stream from an iterator
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromIteratorSucceed = <A>(iterator: IterableIterator<A>, maxChunkSize?: number): Stream<A> =>
  fromChannel(Channel.fromIteratorArray(() => iterator, maxChunkSize))

/**
 * Creates a new `Stream` from an iterable collection of values.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const numbers = [1, 2, 3]
 *
 * const stream = Stream.fromIterable(numbers)
 *
 * // Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // [ 1, 2, 3 ]
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromIterable = <A>(iterable: Iterable<A>): Stream<A> => fromChannel(Channel.fromIterableArray(iterable))

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromArray = <A>(array: ReadonlyArray<A>): Stream<A> =>
  Arr.isNonEmptyReadonlyArray(array) ? fromChannel(Channel.succeed(array)) : empty

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromQueue = <A, E>(queue: Queue.Dequeue<A, E>): Stream<A, E> => fromChannel(Channel.fromQueueArray(queue))

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromPubSub = <A>(pubsub: PubSub.PubSub<A>, chunkSize?: number): Stream<A> =>
  fromChannel(Channel.fromPubSubArray(pubsub, chunkSize))

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromSubscription = <A>(pubsub: PubSub.Subscription<A>, chunkSize?: number): Stream<A> =>
  fromChannel(Channel.fromSubscriptionArray(pubsub, chunkSize))

/**
 * @since 3.4.0
 * @category models
 */
export interface EventListener<A> {
  addEventListener(
    event: string,
    f: (event: A) => void,
    options?: {
      readonly capture?: boolean
      readonly passive?: boolean
      readonly once?: boolean
      readonly signal?: AbortSignal
    } | boolean
  ): void
  removeEventListener(
    event: string,
    f: (event: A) => void,
    options?: {
      readonly capture?: boolean
    } | boolean
  ): void
}

/**
 * Creates a `Stream` using addEventListener.
 *
 * @since 3.1.0
 * @category constructors
 */
export const fromEventListener = <A = unknown>(
  target: EventListener<A>,
  type: string,
  options?: boolean | {
    readonly capture?: boolean
    readonly passive?: boolean
    readonly once?: boolean
    readonly bufferSize?: number | undefined
  } | undefined
): Stream<A> =>
  callback<A>((queue) => {
    function emit(event: A) {
      Queue.unsafeOffer(queue, event)
    }
    return Effect.acquireRelease(
      Effect.sync(() => target.addEventListener(type, emit, options)),
      () => Effect.sync(() => target.removeEventListener(type, emit, options))
    )
  }, { bufferSize: typeof options === "object" ? options.bufferSize : undefined })

/**
 * Like `Stream.unfold`, but allows the emission of values to end one step further
 * than the unfolding of the state. This is useful for embedding paginated
 * APIs, hence the name.
 *
 * @example
 * ```ts
 * import { Effect, Option, Stream } from "effect"
 *
 * const stream = Stream.paginate(0, (n) => [
 *   n,
 *   n < 3 ? Option.some(n + 1) : Option.none()
 * ])
 *
 * // Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // { _id: 'Chunk', values: [ 0, 1, 2, 3 ] }
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const paginate = <S, A>(s: S, f: (s: S) => readonly [A, Option.Option<S>]): Stream<A> =>
  paginateChunk(s, (s) => {
    const [a, s2] = f(s)
    return [[a], s2]
  })

/**
 * Like `Stream.unfoldChunk`, but allows the emission of values to end one step
 * further than the unfolding of the state. This is useful for embedding
 * paginated APIs, hence the name.
 *
 * @since 2.0.0
 * @category constructors
 */
export const paginateChunk = <S, A>(
  s: S,
  f: (s: S) => readonly [ReadonlyArray<A>, Option.Option<S>]
): Stream<A> => paginateChunkEffect(s, (s) => Effect.succeed(f(s)))

/**
 * Like `Stream.unfoldChunkEffect`, but allows the emission of values to end one step
 * further than the unfolding of the state. This is useful for embedding
 * paginated APIs, hence the name.
 *
 * @since 2.0.0
 * @category constructors
 */
export const paginateChunkEffect = <S, A, E, R>(
  s: S,
  f: (s: S) => Effect.Effect<readonly [ReadonlyArray<A>, Option.Option<S>], E, R>
): Stream<A, E, R> =>
  fromPull(Effect.sync(() => {
    let state = s
    let done = false
    return Effect.suspend(function loop(): Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E, void, R> {
      if (done) return Pull.haltVoid
      return Effect.flatMap(f(state), ([a, s]) => {
        if (Option.isNone(s)) {
          done = true
        } else {
          state = s.value
        }
        if (!Arr.isNonEmptyReadonlyArray(a)) return loop()
        return Effect.succeed(a)
      })
    })
  }))

/**
 * Like `Stream.unfoldEffect` but allows the emission of values to end one step
 * further than the unfolding of the state. This is useful for embedding
 * paginated APIs, hence the name.
 *
 * @since 2.0.0
 * @category constructors
 */
export const paginateEffect = <S, A, E, R>(
  s: S,
  f: (s: S) => Effect.Effect<readonly [A, Option.Option<S>], E, R>
): Stream<A, E, R> =>
  paginateChunkEffect(s, (s) =>
    Effect.map(
      f(s),
      ([a, s]) => [[a], s]
    ))

/**
 * Creates a new `Stream` which will emit all numeric values from `min` to `max`
 * (inclusive).
 *
 * If the provided `min` is greater than `max`, the stream will not emit any
 * values.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const stream = Stream.range(1, 5)
 *
 * // Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // [ 1, 2, 3, 4, 5 ]
 * ```
 * @since 4.0.0
 * @category constructors
 */
export const range = (
  min: number,
  max: number,
  chunkSize = Channel.DefaultChunkSize
): Stream<number> =>
  min > max ? empty : fromPull(Effect.sync(() => {
    let start = min
    let done = false
    return Effect.suspend(() => {
      if (done) return Pull.haltVoid
      const remaining = max - start + 1
      if (remaining > chunkSize) {
        const chunk = Arr.range(start, start + chunkSize - 1)
        start += chunkSize
        return Effect.succeed(chunk)
      }
      const chunk = Arr.range(start, start + remaining - 1)
      done = true
      return Effect.succeed(chunk)
    })
  }))

/**
 * Creates a `Stream` that runs forever but never emits an output.
 *
 * @since 4.0.0
 * @category constructors
 */
export const never: Stream<never> = fromChannel(Channel.never)

/**
 * Creates a stream produced from a scoped `Effect`.
 *
 * @since 2.0.0
 * @category constructors
 */
export const unwrap = <A, E2, R2, E, R>(
  effect: Effect.Effect<Stream<A, E2, R2>, E, R>
): Stream<A, E | E2, R2 | Exclude<R, Scope.Scope>> => fromChannel(Channel.unwrap(Effect.map(effect, toChannel)))

/**
 * Transforms the elements of this stream using the supplied function.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const stream = Stream.fromArray([1, 2, 3]).pipe(Stream.map((n) => n + 1))
 *
 * // Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // [ 2, 3, 4 ]
 * ```
 *
 * @since 2.0.0
 * @category mapping
 */
export const map: {
  <A, B>(f: (a: A) => B): <E, R>(self: Stream<A, E, R>) => Stream<B, E, R>
  <A, E, R, B>(self: Stream<A, E, R>, f: (a: A) => B): Stream<B, E, R>
} = dual(2, <A, E, R, B>(self: Stream<A, E, R>, f: (a: A) => B): Stream<B, E, R> =>
  fromChannel(Channel.map(
    self.channel,
    Arr.map(f)
  )))

/**
 * Maps over elements of the stream with the specified effectful function.
 *
 * @since 2.0.0
 * @category mapping
 */
export const mapEffect: {
  <A, A2, E2, R2>(
    f: (a: A) => Effect.Effect<A2, E2, R2>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly unordered?: boolean | undefined
    } | undefined
  ): <E, R>(self: Stream<A, E, R>) => Stream<A2, E2 | E, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    f: (a: A) => Effect.Effect<A2, E2, R2>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly unordered?: boolean | undefined
    } | undefined
  ): Stream<A2, E | E2, R | R2>
} = dual((args) => isStream(args[0]), <A, E, R, A2, E2, R2>(
  self: Stream<A, E, R>,
  f: (a: A) => Effect.Effect<A2, E2, R2>,
  options?: {
    readonly concurrency?: number | "unbounded" | undefined
    readonly bufferSize?: number | undefined
    readonly unordered?: boolean | undefined
  } | undefined
): Stream<A2, E | E2, R | R2> =>
  self.channel.pipe(
    Channel.flattenArray,
    Channel.mapEffect(f, options),
    Channel.map(Arr.of),
    fromChannel
  ))

/**
 * Adds an effect to consumption of every element of the stream.
 *
 * @example
 * ```ts
 * import { Console, Effect, Stream } from "effect"
 *
 * const stream = Stream.fromArray([1, 2, 3]).pipe(
 *   Stream.tap((n) => Console.log(`before mapping: ${n}`)),
 *   Stream.map((n) => n * 2),
 *   Stream.tap((n) => Console.log(`after mapping: ${n}`))
 * )
 *
 * // Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // before mapping: 1
 * // after mapping: 2
 * // before mapping: 2
 * // after mapping: 4
 * // before mapping: 3
 * // after mapping: 6
 * // { _id: 'Chunk', values: [ 2, 4, 6 ] }
 * ```
 *
 * @since 2.0.0
 * @category sequencing
 */
export const tap: {
  <A, X, E2, R2>(
    f: (a: NoInfer<A>) => Effect.Effect<X, E2, R2>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
    } | undefined
  ): <E, R>(self: Stream<A, E, R>) => Stream<A, E2 | E, R2 | R>
  <A, E, R, X, E2, R2>(
    self: Stream<A, E, R>,
    f: (a: NoInfer<A>) => Effect.Effect<X, E2, R2>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
    } | undefined
  ): Stream<A, E | E2, R | R2>
} = dual((args) => isStream(args[0]), <A, E, R, X, E2, R2>(
  self: Stream<A, E, R>,
  f: (a: NoInfer<A>) => Effect.Effect<X, E2, R2>,
  options?: {
    readonly concurrency?: number | "unbounded" | undefined
  } | undefined
): Stream<A, E | E2, R | R2> =>
  self.channel.pipe(
    Channel.tap(Effect.forEach(f, { discard: true }), options),
    fromChannel
  ))

/**
 * Returns a stream made of the concatenation in strict order of all the
 * streams produced by passing each element of this stream to `f0`
 *
 * @since 2.0.0
 * @category sequencing
 */
export const flatMap: {
  <A, A2, E2, R2>(
    f: (a: A) => Stream<A2, E2, R2>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
    } | undefined
  ): <E, R>(self: Stream<A, E, R>) => Stream<A2, E2 | E, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    f: (a: A) => Stream<A2, E2, R2>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
    } | undefined
  ): Stream<A2, E | E2, R | R2>
} = dual((args) => isStream(args[0]), <A, E, R, A2, E2, R2>(
  self: Stream<A, E, R>,
  f: (a: A) => Stream<A2, E2, R2>,
  options?: {
    readonly concurrency?: number | "unbounded" | undefined
    readonly bufferSize?: number | undefined
  } | undefined
): Stream<A2, E | E2, R | R2> =>
  self.channel.pipe(
    Channel.flattenArray,
    Channel.flatMap((a) => f(a).channel, options),
    fromChannel
  ))

/**
 * @since 2.0.0
 * @category sequencing
 */
export const flatten: {
  (
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
    } | undefined
  ): <A, E, R, E2, R2>(self: Stream<Stream<A, E, R>, E2, R2>) => Stream<A, E | E2, R | R2>
  <A, E, R, E2, R2>(
    self: Stream<Stream<A, E, R>, E2, R2>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
    } | undefined
  ): Stream<A, E | E2, R | R2>
} = dual((args) => isStream(args[0]), <A, E, R, E2, R2>(
  self: Stream<Stream<A, E, R>, E2, R2>,
  options?: {
    readonly concurrency?: number | "unbounded" | undefined
    readonly bufferSize?: number | undefined
  } | undefined
): Stream<A, E | E2, R | R2> => flatMap(self, identity, options))

/**
 * @since 2.0.0
 * @category sequencing
 */
export const concat: {
  <A2, E2, R2>(that: Stream<A2, E2, R2>): <A, E, R>(self: Stream<A, E, R>) => Stream<A | A2, E | E2, R | R2>
  <A, E, R, A2, E2, R2>(self: Stream<A, E, R>, that: Stream<A2, E2, R2>): Stream<A | A2, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, A2, E2, R2>(self: Stream<A, E, R>, that: Stream<A2, E2, R2>): Stream<A | A2, E | E2, R | R2> =>
    flatten(fromArray<Stream<A | A2, E | E2, R | R2>>([self, that]))
)

/**
 * Takes the specified number of elements from this stream.
 *
 * @since 2.0.0
 * @category utils
 */
export const take: {
  (n: number): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E, R>
  <A, E, R>(self: Stream<A, E, R>, n: number): Stream<A, E, R>
} = dual(
  2,
  <A, E, R>(self: Stream<A, E, R>, n: number): Stream<A, E, R> =>
    n < 1 ? empty : takeUntil(self, (_, i) => i === (n - 1))
)

/**
 * Takes all elements of the stream until the specified predicate evaluates to
 * `true`.
 *
 * @since 2.0.0
 * @category utils
 */
export const takeUntil: {
  <A>(predicate: (a: NoInfer<A>, n: number) => boolean, options?: {
    readonly excludeLast?: boolean | undefined
  }): <E, R>(self: Stream<A, E, R>) => Stream<A, E, R>
  <A, E, R>(self: Stream<A, E, R>, predicate: (a: A, n: number) => boolean, options?: {
    readonly excludeLast?: boolean | undefined
  }): Stream<A, E, R>
} = dual(
  (args) => isStream(args[0]),
  <A, E, R>(self: Stream<A, E, R>, predicate: (a: A, n: number) => boolean, options?: {
    readonly excludeLast?: boolean | undefined
  }): Stream<A, E, R> =>
    transformPull(self, (pull, _scope) =>
      Effect.sync(() => {
        let i = 0
        let done = false
        const pump: Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E, void, R> = Effect.flatMap(
          Effect.suspend(() => done ? Pull.haltVoid : pull),
          (chunk) => {
            const index = chunk.findIndex((a) => predicate(a, i++))
            if (index >= 0) {
              done = true
              const arr = chunk.slice(0, options?.excludeLast ? index : index + 1)
              return Arr.isNonEmptyReadonlyArray(arr) ? Effect.succeed(arr) : Pull.haltVoid
            }
            return Effect.succeed(chunk)
          }
        )
        return pump
      }))
)

/**
 * Takes all elements of the stream until the specified effectual predicate
 * evaluates to `true`.
 *
 * @since 2.0.0
 * @category utils
 */
export const takeUntilEffect: {
  <A, E2, R2>(
    predicate: (a: NoInfer<A>, n: number) => Effect.Effect<boolean, E2, R2>,
    options?: {
      readonly excludeLast?: boolean | undefined
    }
  ): <E, R>(self: Stream<A, E, R>) => Stream<A, E2 | E, R2 | R>
  <A, E, R, E2, R2>(
    self: Stream<A, E, R>,
    predicate: (a: A, n: number) => Effect.Effect<boolean, E2, R2>,
    options?: {
      readonly excludeLast?: boolean | undefined
    }
  ): Stream<A, E | E2, R | R2>
} = dual((args) => isStream(args[0]), <A, E, R, E2, R2>(
  self: Stream<A, E, R>,
  predicate: (a: A, n: number) => Effect.Effect<boolean, E2, R2>,
  options?: {
    readonly excludeLast?: boolean | undefined
  }
): Stream<A, E | E2, R | R2> =>
  transformPull(self, (pull, _scope) =>
    Effect.sync(() => {
      let i = 0
      let done = false
      return Effect.gen(function*() {
        if (done) return yield* Pull.haltVoid
        const chunk = yield* pull
        for (let j = 0; j < chunk.length; j++) {
          if (yield* predicate(chunk[j], i++)) {
            done = true
            const arr = chunk.slice(0, options?.excludeLast ? j : j + 1)
            return Arr.isNonEmptyReadonlyArray(arr) ? arr : yield* Pull.haltVoid
          }
        }
        return chunk
      })
    })))

/**
 * Takes all elements of the stream for as long as the specified predicate
 * evaluates to `true`.
 *
 * @since 2.0.0
 * @category utils
 */
export const takeWhile: {
  <A, B extends A>(refinement: (a: NoInfer<A>, n: number) => a is B): <E, R>(self: Stream<A, E, R>) => Stream<B, E, R>
  <A>(predicate: (a: NoInfer<A>, n: number) => boolean): <E, R>(self: Stream<A, E, R>) => Stream<A, E, R>
  <A, E, R, B extends A>(self: Stream<A, E, R>, refinement: (a: NoInfer<A>, n: number) => a is B): Stream<B, E, R>
  <A, E, R>(self: Stream<A, E, R>, predicate: (a: NoInfer<A>, n: number) => boolean): Stream<A, E, R>
} = dual(
  2,
  <A, E, R, B extends A>(self: Stream<A, E, R>, refinement: (a: NoInfer<A>, n: number) => a is B): Stream<B, E, R> =>
    takeUntil(self, (a, n) => !refinement(a, n), { excludeLast: true }) as any
)

/**
 * Takes all elements of the stream for as long as the specified effectual predicate
 * evaluates to `true`.
 *
 * @since 2.0.0
 * @category utils
 */
export const takeWhileEffect: {
  <A, E2, R2>(
    predicate: (a: NoInfer<A>, n: number) => Effect.Effect<boolean, E2, R2>
  ): <E, R>(self: Stream<A, E, R>) => Stream<A, E | E2, R | R2>
  <A, E, R, E2, R2>(
    self: Stream<A, E, R>,
    predicate: (a: NoInfer<A>, n: number) => Effect.Effect<boolean, E2, R2>
  ): Stream<A, E | E2, R | R2>
} = dual(2, <A, E, R, E2, R2>(
  self: Stream<A, E, R>,
  predicate: (a: NoInfer<A>, n: number) => Effect.Effect<boolean, E2, R2>
) =>
  takeUntilEffect(self, (a, n) =>
    Effect.map(
      predicate(a, n),
      (b) => !b
    ), { excludeLast: true }))

/**
 * Drops the specified number of elements from this stream.
 *
 * @since 2.0.0
 * @category utils
 */
export const drop: {
  (n: number): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E, R>
  <A, E, R>(self: Stream<A, E, R>, n: number): Stream<A, E, R>
} = dual(
  2,
  <A, E, R>(self: Stream<A, E, R>, n: number): Stream<A, E, R> =>
    transformPull(self, (pull, _scope) =>
      Effect.sync(() => {
        let dropped = 0
        const pump: Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E, void, R> = pull.pipe(
          Effect.flatMap((chunk) => {
            if (dropped >= n) return Effect.succeed(chunk)
            dropped += chunk.length
            if (dropped <= n) return pump
            return Effect.succeed(chunk.slice(n - dropped) as Arr.NonEmptyArray<A>)
          })
        )
        return pump
      }))
)

/**
 * Exposes the underlying chunks of the stream as a stream of chunks of
 * elements.
 *
 * @since 2.0.0
 * @category utils
 */
export const chunks = <A, E, R>(self: Stream<A, E, R>): Stream<ReadonlyArray<A>, E, R> =>
  self.channel.pipe(
    Channel.map(Arr.of),
    fromChannel
  )

/**
 * Pipes all the values from this stream through the provided channel.
 *
 * @since 2.0.0
 * @category Pipe
 */
export const pipeThroughChannel: {
  <R2, E, E2, A, A2>(
    channel: Channel.Channel<Arr.NonEmptyReadonlyArray<A2>, E2, unknown, Arr.NonEmptyReadonlyArray<A>, E, unknown, R2>
  ): <R>(self: Stream<A, E, R>) => Stream<A2, E2, R2 | R>
  <R, R2, E, E2, A, A2>(
    self: Stream<A, E, R>,
    channel: Channel.Channel<Arr.NonEmptyReadonlyArray<A2>, E2, unknown, Arr.NonEmptyReadonlyArray<A>, E, unknown, R2>
  ): Stream<A2, E2, R | R2>
} = dual(2, <R, R2, E, E2, A, A2>(
  self: Stream<A, E, R>,
  channel: Channel.Channel<Arr.NonEmptyReadonlyArray<A2>, E2, unknown, Arr.NonEmptyReadonlyArray<A>, E, unknown, R2>
): Stream<A2, E2, R | R2> => fromChannel(Channel.pipeTo(self.channel, channel)))

/**
 * Pipes all values from this stream through the provided channel, passing
 * through any error emitted by this stream unchanged.
 *
 * @since 2.0.0
 * @category Pipe
 */
export const pipeThroughChannelOrFail: {
  <R2, E, E2, A, A2>(
    channel: Channel.Channel<Arr.NonEmptyReadonlyArray<A2>, E2, unknown, Arr.NonEmptyReadonlyArray<A>, E, unknown, R2>
  ): <R>(self: Stream<A, E, R>) => Stream<A2, E | E2, R2 | R>
  <R, R2, E, E2, A, A2>(
    self: Stream<A, E, R>,
    channel: Channel.Channel<Arr.NonEmptyReadonlyArray<A2>, E2, unknown, Arr.NonEmptyReadonlyArray<A>, E, unknown, R2>
  ): Stream<A2, E | E2, R | R2>
} = dual(2, <R, R2, E, E2, A, A2>(
  self: Stream<A, E, R>,
  channel: Channel.Channel<Arr.NonEmptyReadonlyArray<A2>, E2, unknown, Arr.NonEmptyReadonlyArray<A>, E, unknown, R2>
): Stream<A2, E | E2, R | R2> => fromChannel(Channel.pipeToOrFail(self.channel, channel)))

/**
 * Decode Uint8Array chunks into a stream of strings using the specified encoding.
 *
 * @since 2.0.0
 * @category encoding
 */
export const decodeText: {
  (encoding?: string | undefined): <E, R>(self: Stream<Uint8Array, E, R>) => Stream<string, E, R>
  <E, R>(self: Stream<Uint8Array, E, R>, encoding?: string | undefined): Stream<string, E, R>
} = dual(
  (args) => isStream(args[0]),
  <E, R>(self: Stream<Uint8Array, E, R>, encoding?: string | undefined): Stream<string, E, R> =>
    suspend(() => {
      const decoder = new TextDecoder(encoding)
      return map(self, (chunk) => decoder.decode(chunk))
    })
)

/**
 * Encode a stream of strings into a stream of Uint8Array chunks using the specified encoding.
 *
 * @since 2.0.0
 * @category encoding
 */
export const encodeText = <E, R>(self: Stream<string, E, R>): Stream<Uint8Array, E, R> =>
  suspend(() => {
    const encoder = new TextEncoder()
    return map(self, (chunk) => encoder.encode(chunk))
  })

/**
 * Runs the sink on the stream to produce either the sink's result or an error.
 *
 * @since 2.0.0
 * @category destructors
 */
export const run: {
  <A2, A, L, E2, R2>(
    sink: Sink.Sink<A2, A, L, E2, R2>
  ): <E, R>(self: Stream<A, E, R>) => Effect.Effect<A2, E2 | E, R | R2>
  <A, E, R, L, A2, E2, R2>(
    self: Stream<A, E, R>,
    sink: Sink.Sink<A2, A, L, E2, R2>
  ): Effect.Effect<A2, E | E2, R | R2>
} = dual(2, <A, E, R, L, A2, E2, R2>(
  self: Stream<A, E, R>,
  sink: Sink.Sink<A2, A, L, E2, R2>
): Effect.Effect<A2, E | E2, R | R2> =>
  self.channel.pipe(
    Channel.pipeToOrFail(sink.channel),
    Channel.runDrain
  ))

/**
 * Runs the stream and collects all of its elements to a chunk.
 *
 * @since 2.0.0
 * @category destructors
 */
export const runCollect = <A, E, R>(self: Stream<A, E, R>): Effect.Effect<Array<A>, E, R> =>
  Channel.runFold(
    self.channel,
    () => [] as Array<A>,
    (acc, chunk) => {
      for (let i = 0; i < chunk.length; i++) {
        acc.push(chunk[i])
      }
      return acc
    }
  )

/**
 * Runs the stream and emits the number of elements processed
 *
 * @since 2.0.0
 * @category destructors
 */
export const runCount = <A, E, R>(self: Stream<A, E, R>): Effect.Effect<number, E, R> =>
  Channel.runFold(self.channel, () => 0, (acc, chunk) => acc + chunk.length)

/**
 * Consumes all elements of the stream, passing them to the specified
 * callback.
 *
 * @since 2.0.0
 * @category destructors
 */
export const runForEach: {
  <A, X, E2, R2>(
    f: (a: A) => Effect.Effect<X, E2, R2>
  ): <E, R>(self: Stream<A, E, R>) => Effect.Effect<void, E2 | E, R2 | R>
  <A, E, R, X, E2, R2>(
    self: Stream<A, E, R>,
    f: (a: A) => Effect.Effect<X, E2, R2>
  ): Effect.Effect<void, E | E2, R | R2>
} = dual(2, <A, E, R, X, E2, R2>(
  self: Stream<A, E, R>,
  f: (a: A) => Effect.Effect<X, E2, R2>
): Effect.Effect<void, E | E2, R | R2> => Channel.runForEach(self.channel, Effect.forEach(f, { discard: true })))

/**
 * Consumes all elements of the stream, passing them to the specified
 * callback.
 *
 * @since 2.0.0
 * @category destructors
 */
export const runForEachChunk: {
  <A, X, E2, R2>(
    f: (a: Arr.NonEmptyReadonlyArray<A>) => Effect.Effect<X, E2, R2>
  ): <E, R>(self: Stream<A, E, R>) => Effect.Effect<void, E2 | E, R2 | R>
  <A, E, R, X, E2, R2>(
    self: Stream<A, E, R>,
    f: (a: Arr.NonEmptyReadonlyArray<A>) => Effect.Effect<X, E2, R2>
  ): Effect.Effect<void, E | E2, R | R2>
} = dual(2, <A, E, R, X, E2, R2>(
  self: Stream<A, E, R>,
  f: (a: Arr.NonEmptyReadonlyArray<A>) => Effect.Effect<X, E2, R2>
): Effect.Effect<void, E | E2, R | R2> => Channel.runForEach(self.channel, f))

/**
 * Runs the stream only for its effects. The emitted elements are discarded.
 *
 * @since 2.0.0
 * @category destructors
 */
export const runDrain = <A, E, R>(self: Stream<A, E, R>): Effect.Effect<void, E, R> => Channel.runDrain(self.channel)

/**
 * Returns in a scope an effect that can be used to repeatedly pull chunks
 * from the stream. The pull effect fails with None when the stream is
 * finished, or with Some error if it fails, otherwise it returns a chunk of
 * the stream's output.
 *
 * @since 2.0.0
 * @category destructors
 */
export const toPull = <A, E, R>(
  self: Stream<A, E, R>
): Effect.Effect<Pull.Pull<ReadonlyArray<A>, E>, never, R | Scope.Scope> => Channel.toPull(self.channel)

/**
 * Returns a combined string resulting from concatenating each of the values
 * from the stream.
 *
 * @since 2.0.0
 * @category destructors
 */
export const mkString = <E, R>(self: Stream<string, E, R>): Effect.Effect<string, E, R> =>
  Channel.runFold(
    self.channel,
    () => "",
    (acc, chunk) => acc + chunk.join("")
  )
