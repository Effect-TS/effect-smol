/**
 * @since 2.0.0
 */
import * as Arr from "./Array.js"
import * as Cause from "./Cause.js"
import * as Channel from "./Channel.js"
import * as Effect from "./Effect.js"
import type * as Exit from "./Exit.js"
import * as Fiber from "./Fiber.js"
import type * as Filter from "./Filter.js"
import type { LazyArg } from "./Function.js"
import { dual, identity } from "./Function.js"
import type { TypeLambda } from "./HKT.js"
import * as Option from "./Option.js"
import { type Pipeable, pipeArguments } from "./Pipeable.js"
import { hasProperty } from "./Predicate.js"
import type * as PubSub from "./PubSub.js"
import * as Pull from "./Pull.js"
import * as Queue from "./Queue.js"
import * as Schedule from "./Schedule.js"
import * as Scope from "./Scope.js"
import * as ServiceMap from "./ServiceMap.js"
import type * as Sink from "./Sink.js"
import type { Covariant } from "./Types.js"
import type * as Unify from "./Unify.js"

/**
 * The type identifier for Stream.
 *
 * @example
 * ```ts
 * import { Stream } from "effect"
 *
 * declare const stream: Stream.Stream<number>
 *
 * // TypeId is used internally for type safety
 * const hasTypeId = Stream.TypeId in stream
 * ```
 *
 * @since 2.0.0
 * @category symbols
 */
export const TypeId: TypeId = "~effect/Stream"

/**
 * The type-level identifier for the Stream type.
 *
 * @example
 * ```ts
 * import type { Stream } from "effect"
 *
 * // TypeId can be used in type-level operations
 * type StreamTypeId = Stream.TypeId
 * // TypeId is "~effect/Stream"
 * ```
 *
 * @since 2.0.0
 * @category symbols
 */
export type TypeId = "~effect/Stream"

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
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * // Create a stream that emits numbers 1, 2, 3
 * const stream: Stream.Stream<number> = Stream.make(1, 2, 3)
 *
 * // Transform the stream and run it
 * const program = stream.pipe(
 *   Stream.map(n => n * 2),
 *   Stream.runCollect
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: { _id: "Chunk", values: [2, 4, 6] }
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface Stream<out A, out E = never, out R = never> extends Variance<A, E, R>, Pipeable {
  readonly channel: Channel.Channel<Arr.NonEmptyReadonlyArray<A>, E, void, unknown, unknown, unknown, R>
  [Unify.typeSymbol]?: unknown
  [Unify.unifySymbol]?: StreamUnify<this>
  [Unify.ignoreSymbol]?: StreamUnifyIgnore
}

/**
 * Interface for Stream unification, used internally by the Effect type system
 * to provide proper type inference when using Stream with other Effect types.
 *
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * // StreamUnify helps unify Stream and Effect types
 * declare const stream: Stream.Stream<number>
 * declare const effect: Effect.Effect<string>
 *
 * // The unification system handles mixed operations
 * const combined = Effect.zip(stream.pipe(Stream.runCollect), effect)
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface StreamUnify<A extends { [Unify.typeSymbol]?: any }> extends Effect.EffectUnify<A> {
  Stream?: () => A[Unify.typeSymbol] extends Stream<infer A0, infer E0, infer R0> | infer _ ? Stream<A0, E0, R0> : never
}

/**
 * Interface used to ignore certain types during Stream unification.
 * Part of the internal type system machinery.
 *
 * @example
 * ```ts
 * import type { Stream } from "effect"
 *
 * // Used internally by the type system
 * // Users typically don't interact with this directly
 * type StreamIgnore = Stream.StreamUnifyIgnore
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export interface StreamUnifyIgnore extends Effect.EffectUnifyIgnore {
  Effect?: true
}

/**
 * Type lambda for Stream, used for higher-kinded type operations.
 *
 * @example
 * ```ts
 * import type { Kind } from "effect/HKT"
 * import type { StreamTypeLambda } from "effect/Stream"
 *
 * // Create a Stream type using the type lambda
 * type NumberStream = Kind<StreamTypeLambda, never, string, never, number>
 * // Equivalent to: Stream<number, string, never>
 * ```
 *
 * @category type lambdas
 * @since 2.0.0
 */
export interface StreamTypeLambda extends TypeLambda {
  readonly type: Stream<this["Target"], this["Out1"], this["Out2"]>
}

/**
 * Variance interface for Stream, encoding the type parameters' variance.
 *
 * @since 2.0.0
 * @category models
 */
export interface Variance<out A, out E, out R> {
  readonly [TypeId]: VarianceStruct<A, E, R>
}

/**
 * Structure encoding the variance of Stream type parameters.
 *
 * @since 3.4.0
 * @category models
 */
export interface VarianceStruct<out A, out E, out R> {
  readonly _A: Covariant<A>
  readonly _E: Covariant<E>
  readonly _R: Covariant<R>
}

/**
 * Extract the success type from a Stream type.
 *
 * @example
 * ```ts
 * import { Stream } from "effect"
 *
 * type NumberStream = Stream.Stream<number, string, never>
 * type SuccessType = Stream.Success<NumberStream>
 * // SuccessType is number
 * ```
 *
 * @since 3.4.0
 * @category type-level
 */
export type Success<T extends Stream<any, any, any>> = [T] extends [Stream<infer _A, infer _E, infer _R>] ? _A : never

/**
 * Extract the error type from a Stream type.
 *
 * @example
 * ```ts
 * import { Stream } from "effect"
 *
 * type NumberStream = Stream.Stream<number, string, never>
 * type ErrorType = Stream.Error<NumberStream>
 * // ErrorType is string
 * ```
 *
 * @since 3.4.0
 * @category type-level
 */
export type Error<T extends Stream<any, any, any>> = [T] extends [Stream<infer _A, infer _E, infer _R>] ? _E : never

/**
 * Extract the context type from a Stream type.
 *
 * @example
 * ```ts
 * import { Stream } from "effect"
 *
 * interface Database { query: (sql: string) => unknown }
 * type NumberStream = Stream.Stream<number, string, { db: Database }>
 * type Services = Stream.Services<NumberStream>
 * // Services is { db: Database }
 * ```
 *
 * @since 3.4.0
 * @category type-level
 */
export type Services<T extends Stream<any, any, any>> = [T] extends [Stream<infer _A, infer _E, infer _R>] ? _R
  : never

const streamVariance = {
  _R: identity,
  _E: identity,
  _A: identity
}

/**
 * Checks if a value is a Stream.
 *
 * @example
 * ```ts
 * import { Stream } from "effect"
 *
 * const stream = Stream.make(1, 2, 3)
 * const notStream = { data: [1, 2, 3] }
 *
 * console.log(Stream.isStream(stream))    // true
 * console.log(Stream.isStream(notStream)) // false
 * ```
 *
 * @since 2.0.0
 * @category guards
 * @internal
 */
export const isStream = (u: unknown): u is Stream<unknown, unknown, unknown> => hasProperty(u, TypeId)

const StreamProto = {
  [TypeId]: streamVariance,
  pipe() {
    return pipeArguments(this, arguments)
  }
}

/**
 * Creates a stream from a `Channel`.
 *
 * This function allows you to create a Stream by providing a Channel that
 * produces arrays of values. It's useful when you have low-level channel
 * operations that you want to expose as a higher-level Stream.
 *
 * @example
 * ```ts
 * import { Stream, Channel } from "effect"
 *
 * const myChannel = Channel.succeed([1, 2, 3] as const)
 * const stream = Stream.fromChannel(myChannel)
 * ```
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
 * Either emits the success value of this effect or terminates the stream
 * with the failure value of this effect.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromEffect = <A, E, R>(effect: Effect.Effect<A, E, R>): Stream<A, E, R> =>
  fromChannel(Channel.fromEffect(Effect.map(effect, Arr.of)))

/**
 * Creates a stream from a pull effect.
 *
 * A pull effect is a low-level representation of a stream that can be used
 * to produce values on demand. This function lifts a pull effect into a Stream.
 *
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const pullEffect = Effect.succeed(Effect.succeed([1, 2, 3] as const))
 * const stream = Stream.fromPull(pullEffect)
 * ```
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
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const originalStream = Stream.make(1, 2, 3)
 *
 * const transformedStream = Stream.transformPull(
 *   originalStream,
 *   (pull) => Effect.succeed(pull)
 * )
 *
 * Effect.runPromise(Stream.runCollect(transformedStream)).then(console.log)
 * // { _id: 'Chunk', values: [1, 2, 3] }
 * ```
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
 * This function extracts the underlying Channel from a Stream, allowing you
 * to work with the lower-level Channel API when needed.
 *
 * @example
 * ```ts
 * import { Stream } from "effect"
 *
 * const stream = Stream.make(1, 2, 3)
 * const channel = Stream.toChannel(stream)
 * ```
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
 * @example
 * ```ts
 * import { Stream, Queue, Effect } from "effect"
 *
 * const stream = Stream.callback<number>((queue) => {
 *   // Emit values to the stream
 *   Queue.offer(queue, 1)
 *   Queue.offer(queue, 2)
 *   Queue.offer(queue, 3)
 *   // Signal completion
 *   Queue.shutdown(queue)
 * })
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // { _id: "Chunk", values: [1, 2, 3] }
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const callback = <A, E = never, R = never>(
  f: (queue: Queue.Queue<A, E | Queue.Done>) => void | Effect.Effect<unknown, E, R | Scope.Scope>,
  options?: {
    readonly bufferSize?: number | undefined
    readonly strategy?: "sliding" | "dropping" | "suspend" | undefined
  }
): Stream<A, E, Exclude<R, Scope.Scope>> => fromChannel(Channel.callbackArray(f, options))

/**
 * Creates a `Stream` that emits no elements.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const emptyStream = Stream.empty
 *
 * // Running the empty stream produces an empty chunk
 * const program = emptyStream.pipe(Stream.runCollect)
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: { _id: "Chunk", values: [] }
 * ```
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
 * This function creates a Stream that evaluates the provided function
 * synchronously and emits the result as a single value.
 *
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const stream = Stream.sync(() => Math.random())
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // { _id: 'Chunk', values: [ 0.8241872817945143 ] }
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const sync = <A>(evaluate: LazyArg<A>): Stream<A> => fromChannel(Channel.sync(() => Arr.of(evaluate())))

/**
 * Returns a lazily constructed stream.
 *
 * This function defers the creation of a Stream until it is actually consumed.
 * The provided function will be called each time the stream is run.
 *
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const lazyStream = Stream.suspend(() => {
 *   console.log("Creating stream...")
 *   return Stream.make(1, 2, 3)
 * })
 *
 * // "Creating stream..." will be printed when the stream is run
 * Effect.runPromise(Stream.runCollect(lazyStream))
 * ```
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
 * This function creates a Stream that fails with an error computed by the
 * provided function. The error is evaluated lazily when the stream is run.
 *
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const stream = Stream.failSync(() => new Error("Something went wrong"))
 *
 * Effect.runPromiseExit(Stream.runCollect(stream)).then(console.log)
 * // Exit.Failure with the error
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const failSync = <E>(evaluate: LazyArg<E>): Stream<never, E> => fromChannel(Channel.failSync(evaluate))

/**
 * The stream that always fails with the specified `Cause`.
 *
 * This function creates a Stream that fails with the provided Cause,
 * which provides detailed information about the failure.
 *
 * @example
 * ```ts
 * import { Stream, Cause, Effect } from "effect"
 *
 * const cause = Cause.fail("Database connection failed")
 * const stream = Stream.failCause(cause)
 *
 * Effect.runPromiseExit(Stream.runCollect(stream)).then(console.log)
 * // Exit.Failure with the specified cause
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const failCause = <E>(cause: Cause.Cause<E>): Stream<never, E> => fromChannel(Channel.failCause(cause))

/**
 * The stream that always fails with the specified lazily evaluated `Cause`.
 *
 * @example
 * ```ts
 * import { Stream, Cause, Effect } from "effect"
 *
 * const stream = Stream.failCauseSync(() =>
 *   Cause.fail("Connection timeout after retries")
 * )
 *
 * Effect.runPromiseExit(Stream.runCollect(stream)).then(console.log)
 * // Exit.Failure with the lazily evaluated cause
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const failCauseSync = <E>(evaluate: LazyArg<Cause.Cause<E>>): Stream<never, E> =>
  fromChannel(Channel.failCauseSync(evaluate))

/**
 * Creates a stream from an iterator.
 *
 * This function creates a Stream from an IterableIterator, consuming values
 * from the iterator. The maxChunkSize parameter controls how many values
 * are pulled from the iterator at once.
 *
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * function* numbers() {
 *   yield 1
 *   yield 2
 *   yield 3
 * }
 *
 * const stream = Stream.fromIteratorSucceed(numbers())
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // { _id: 'Chunk', values: [ 1, 2, 3 ] }
 * ```
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
 * Creates a stream from an array.
 *
 * This function creates a Stream that emits all values from the provided array.
 * If the array is empty, it returns an empty Stream.
 *
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const numbers = [1, 2, 3, 4, 5]
 * const stream = Stream.fromArray(numbers)
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // { _id: 'Chunk', values: [ 1, 2, 3, 4, 5 ] }
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromArray = <A>(array: ReadonlyArray<A>): Stream<A> =>
  Arr.isNonEmptyReadonlyArray(array) ? fromChannel(Channel.succeed(array)) : empty

/**
 * Creates a stream from a queue.
 *
 * This function creates a Stream that consumes values from the provided Queue.
 * The stream will emit values as they become available from the queue.
 *
 * @example
 * ```ts
 * import { Stream, Queue, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* Queue.unbounded<number>()
 *   yield* Queue.offer(queue, 1)
 *   yield* Queue.offer(queue, 2)
 *   yield* Queue.offer(queue, 3)
 *   yield* Queue.shutdown(queue)
 *
 *   const stream = Stream.fromQueue(queue)
 *   return yield* Stream.runCollect(stream)
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromQueue = <A, E>(queue: Queue.Dequeue<A, E>): Stream<A, Exclude<E, Queue.Done>> =>
  fromChannel(Channel.fromQueueArray(queue))

/**
 * Creates a stream from a PubSub.
 *
 * @example
 * ```ts
 * import { Stream, PubSub, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const pubsub = yield* PubSub.unbounded<number>()
 *
 *   // Publish some values
 *   yield* PubSub.publish(pubsub, 1)
 *   yield* PubSub.publish(pubsub, 2)
 *   yield* PubSub.publish(pubsub, 3)
 *
 *   const stream = Stream.fromPubSub(pubsub)
 *   return yield* Stream.take(stream, 3).pipe(Stream.runCollect)
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromPubSub = <A>(pubsub: PubSub.PubSub<A>, chunkSize?: number): Stream<A> =>
  fromChannel(Channel.fromPubSubArray(pubsub, chunkSize))

/**
 * Creates a stream from a ReadableStream.
 *
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const readableStream = new ReadableStream({
 *   start(controller) {
 *     controller.enqueue(1)
 *     controller.enqueue(2)
 *     controller.enqueue(3)
 *     controller.close()
 *   }
 * })
 *
 * const stream = Stream.fromReadableStream({
 *   evaluate: () => readableStream,
 *   onError: (error) => new Error(String(error))
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromReadableStream = <A, E>(
  options: {
    readonly evaluate: LazyArg<ReadableStream<A>>
    readonly onError: (error: unknown) => E
    readonly releaseLockOnEnd?: boolean | undefined
  }
): Stream<A, E> =>
  fromChannel(Channel.fromTransform(Effect.fnUntraced(function*(_, scope) {
    const reader = options.evaluate().getReader()
    yield* Scope.addFinalizer(
      scope,
      options.releaseLockOnEnd
        ? Effect.sync(() => reader.releaseLock())
        : Effect.promise(() => reader.cancel())
    )
    return Effect.flatMap(
      Effect.tryPromise({
        try: () => reader.read(),
        catch: (reason) => options.onError(reason)
      }),
      ({ done, value }) => done ? Pull.haltVoid : Effect.succeed(Arr.of(value))
    )
  })))

/**
 * Creates a stream from a Schedule.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromSchedule = <O, E, R>(schedule: Schedule.Schedule<O, unknown, E, R>): Stream<O, E, R> =>
  fromPull(
    Effect.map(
      Schedule.toStepWithSleep(schedule),
      (step) => Pull.catchHalt(Effect.map(step(void 0), Arr.of), () => Pull.haltVoid)
    )
  )

/**
 * Creates a stream from a PubSub subscription.
 *
 * @example
 * ```ts
 * import { Stream, PubSub, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const pubsub = yield* PubSub.unbounded<number>()
 *   const subscription = yield* PubSub.subscribe(pubsub)
 *
 *   yield* PubSub.publish(pubsub, 1)
 *   yield* PubSub.publish(pubsub, 2)
 *
 *   const stream = Stream.fromSubscription(subscription)
 *   return yield* Stream.take(stream, 2).pipe(Stream.runCollect)
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromSubscription = <A>(pubsub: PubSub.Subscription<A>, chunkSize?: number): Stream<A> =>
  fromChannel(Channel.fromSubscriptionArray(pubsub, chunkSize))

/**
 * Interface representing an event listener target.
 *
 * @example
 * ```ts
 * import { Stream } from "effect"
 *
 * // DOM element implementing EventListener
 * declare const button: HTMLButtonElement
 *
 * // Can be used with Stream.fromEventListener
 * const clickStream = Stream.fromEventListener(button, "click")
 * ```
 *
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
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * // In a browser environment
 * const clickStream = Stream.fromEventListener(document, "click")
 *
 * const program = clickStream.pipe(
 *   Stream.take(3),
 *   Stream.runCollect
 * )
 * ```
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
 * @example
 * ```ts
 * import { Stream, Option, Effect } from "effect"
 *
 * const stream = Stream.paginateChunk(0, (n) => [
 *   [n], // emit single element as chunk
 *   n < 3 ? Option.some(n + 1) : Option.none()
 * ])
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // { _id: 'Chunk', values: [0, 1, 2, 3] }
 * ```
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
 * @example
 * ```ts
 * import { Stream, Option, Effect } from "effect"
 *
 * const stream = Stream.paginateChunkEffect(0, (n: number) =>
 *   Effect.succeed([
 *     [n],
 *     n < 3 ? Option.some(n + 1) : Option.none<number>()
 *   ] as const)
 * )
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // { _id: 'Chunk', values: [0, 1, 2, 3] }
 * ```
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
 * @example
 * ```ts
 * import { Stream, Option, Effect } from "effect"
 *
 * const stream = Stream.paginateEffect(0, (n: number) =>
 *   Effect.succeed([
 *     n, // emit single value
 *     n < 3 ? Option.some(n + 1) : Option.none<number>()
 *   ] as const)
 * )
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // { _id: 'Chunk', values: [0, 1, 2, 3] }
 * ```
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
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * // A stream that never emits values or completes
 * const neverStream = Stream.never
 *
 * // This will run indefinitely (be careful in practice!)
 * // const program = neverStream.pipe(Stream.runCollect)
 * // Effect.runPromise(program) // Never resolves
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const never: Stream<never> = fromChannel(Channel.never)

/**
 * Creates a stream produced from a scoped `Effect`.
 *
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const effectThatCreatesStream = Effect.succeed(
 *   Stream.make(1, 2, 3)
 * )
 *
 * const stream = Stream.unwrap(effectThatCreatesStream)
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // { _id: 'Chunk', values: [1, 2, 3] }
 * ```
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
 * @example
 * ```ts
 * import { Stream, Effect, Console } from "effect"
 *
 * const stream = Stream.make(1, 2, 3)
 *
 * const mappedStream = stream.pipe(
 *   Stream.mapEffect(n =>
 *     Effect.gen(function* () {
 *       yield* Console.log(`Processing: ${n}`)
 *       return n * 2
 *     })
 *   )
 * )
 *
 * Effect.runPromise(Stream.runCollect(mappedStream)).then(console.log)
 * // Processing: 1
 * // Processing: 2
 * // Processing: 3
 * // { _id: 'Chunk', values: [2, 4, 6] }
 * ```
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
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3)
 *
 * const flatMapped = stream.pipe(
 *   Stream.flatMap(n => Stream.make(n, n * 2))
 * )
 *
 * const program = flatMapped.pipe(Stream.runCollect)
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: { _id: "Chunk", values: [1, 2, 2, 4, 3, 6] }
 * ```
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
 * Flattens a stream of streams into a single stream.
 *
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const streamOfStreams = Stream.make(
 *   Stream.make(1, 2),
 *   Stream.make(3, 4),
 *   Stream.make(5, 6)
 * )
 *
 * const flattened = Stream.flatten(streamOfStreams)
 *
 * Effect.runPromise(Stream.runCollect(flattened)).then(console.log)
 * // { _id: 'Chunk', values: [1, 2, 3, 4, 5, 6] }
 * ```
 *
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
 * Concatenates two streams, emitting all elements from the first stream
 * followed by all elements from the second stream.
 *
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const stream1 = Stream.make(1, 2, 3)
 * const stream2 = Stream.make(4, 5, 6)
 *
 * const concatenated = Stream.concat(stream1, stream2)
 *
 * Effect.runPromise(Stream.runCollect(concatenated)).then(console.log)
 * // { _id: 'Chunk', values: [1, 2, 3, 4, 5, 6] }
 * ```
 *
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
 * Handles stream failures by examining the full Cause of failure.
 *
 * @example
 * ```ts
 * import { Stream, Cause, Effect } from "effect"
 *
 * const failingStream = Stream.make(1, 2).pipe(
 *   Stream.concat(Stream.fail("Oops!")),
 *   Stream.concat(Stream.make(3, 4))
 * )
 *
 * const recovered = Stream.catchCause(failingStream, (cause) => {
 *   console.log("Caught cause:", cause)
 *   return Stream.make(999) // Recovery stream
 * })
 *
 * Effect.runPromise(Stream.runCollect(recovered)).then(console.log)
 * // { _id: 'Chunk', values: [1, 2, 999] }
 * ```
 *
 * @since 4.0.0
 * @category Error handling
 */
export const catchCause: {
  <E, A2, E2, R2>(
    f: (cause: Cause.Cause<E>) => Stream<A2, E2, R2>
  ): <A, R>(self: Stream<A, E, R>) => Stream<A | A2, E2, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    f: (cause: Cause.Cause<E>) => Stream<A2, E2, R2>
  ): Stream<A | A2, E2, R | R2>
} = dual(2, <A, E, R, A2, E2, R2>(
  self: Stream<A, E, R>,
  f: (cause: Cause.Cause<E>) => Stream<A2, E2, R2>
): Stream<A | A2, E2, R | R2> =>
  self.channel.pipe(
    Channel.catchCause((cause) => f(cause).channel),
    fromChannel
  ))

const catch_: {
  <E, A2, E2, R2>(
    f: (error: E) => Stream<A2, E2, R2>
  ): <A, R>(self: Stream<A, E, R>) => Stream<A | A2, E2, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    f: (error: E) => Stream<A2, E2, R2>
  ): Stream<A | A2, E2, R | R2>
} = dual(2, <A, E, R, A2, E2, R2>(
  self: Stream<A, E, R>,
  f: (error: E) => Stream<A2, E2, R2>
): Stream<A | A2, E2, R | R2> => fromChannel(Channel.catch(self.channel, (error) => f(error).channel)))

export {
  /**
   * @since 4.0.0
   * @category Error handling
   */
  catch_ as catch
}

/**
 * Transforms the errors emitted by this stream using `f`.
 *
 * @since 2.0.0
 * @category Error handling
 */
export const mapError: {
  <E, E2>(f: (error: E) => E2): <A, R>(self: Stream<A, E, R>) => Stream<A, E2, R>
  <A, E, R, E2>(self: Stream<A, E, R>, f: (error: E) => E2): Stream<A, E2, R>
} = dual(2, <A, E, R, E2>(
  self: Stream<A, E, R>,
  f: (error: E) => E2
): Stream<A, E2, R> => fromChannel(Channel.mapError(self.channel, f)))

/**
 * Conditionally handles stream failures based on a predicate applied to the Cause.
 *
 * @example
 * ```ts
 * import { Stream, Cause, Effect } from "effect"
 *
 * const failingStream = Stream.fail("NetworkError")
 *
 * const recovered = Stream.catchCauseFilter(
 *   failingStream,
 *   Cause.hasFail,
 *   (error, cause) => Stream.make("Recovered from network error")
 * )
 * ```
 *
 * @since 4.0.0
 * @category Error handling
 */
export const catchCauseFilter: {
  <E, EB, X extends Cause.Cause<any>, A2, E2, R2>(
    filter: Filter.Filter<Cause.Cause<E>, EB, X>,
    f: (failure: EB, cause: Cause.Cause<E>) => Stream<A2, E2, R2>
  ): <A, R>(self: Stream<A, E, R>) => Stream<A | A2, Cause.Cause.Error<X> | E2, R2 | R>
  <A, E, R, EB, X extends Cause.Cause<any>, A2, E2, R2>(
    self: Stream<A, E, R>,
    filter: Filter.Filter<Cause.Cause<E>, EB, X>,
    f: (failure: EB, cause: Cause.Cause<E>) => Stream<A2, E2, R2>
  ): Stream<A | A2, Cause.Cause.Error<X> | E2, R | R2>
} = dual(3, <A, E, R, EB, X extends Cause.Cause<any>, A2, E2, R2>(
  self: Stream<A, E, R>,
  filter: Filter.Filter<Cause.Cause<E>, EB, X>,
  f: (failure: EB, cause: Cause.Cause<E>) => Stream<A2, E2, R2>
): Stream<A | A2, Cause.Cause.Error<X> | E2, R | R2> =>
  self.channel.pipe(
    Channel.catchCauseFilter(filter, (failure, cause) => f(failure, cause).channel),
    fromChannel
  ))

/**
 * Converts stream failures into fiber terminations, making them unrecoverable.
 *
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const failingStream = Stream.fail("This will become a defect")
 * const stream = Stream.orDie(failingStream)
 *
 * // This will terminate the fiber with a defect instead of a recoverable error
 * // Effect.runPromise(Stream.runCollect(stream)) // Would throw
 * ```
 *
 * @since 2.0.0
 * @category Error handling
 */
export const orDie = <A, E, R>(self: Stream<A, E, R>): Stream<A, never, R> => fromChannel(Channel.orDie(self.channel))

/**
 * Takes the specified number of elements from this stream.
 *
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 *
 * const firstThree = stream.pipe(Stream.take(3))
 *
 * const program = firstThree.pipe(Stream.runCollect)
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: { _id: "Chunk", values: [1, 2, 3] }
 * ```
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
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5, 6)
 *
 * // Take until we find a number greater than 3
 * const taken = stream.pipe(
 *   Stream.takeUntil(n => n > 3)
 * )
 *
 * Effect.runPromise(Stream.runCollect(taken)).then(console.log)
 * // { _id: 'Chunk', values: [1, 2, 3, 4] }
 *
 * // Exclude the element that satisfies the predicate
 * const takenExclusive = stream.pipe(
 *   Stream.takeUntil(n => n > 3, { excludeLast: true })
 * )
 *
 * Effect.runPromise(Stream.runCollect(takenExclusive)).then(console.log)
 * // { _id: 'Chunk', values: [1, 2, 3] }
 * ```
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
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 * const result = Stream.takeUntilEffect(stream, (n) =>
 *   Effect.succeed(n === 3)
 * )
 *
 * Effect.runPromise(Stream.runCollect(result)).then(console.log)
 * // { _id: 'Chunk', values: [1, 2] }
 * ```
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
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5, 6)
 * const result = Stream.takeWhile(stream, (n) => n < 4)
 *
 * Effect.runPromise(Stream.runCollect(result)).then(console.log)
 * // { _id: 'Chunk', values: [1, 2, 3] }
 * ```
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
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 * const result = Stream.takeWhileEffect(stream, (n) =>
 *   Effect.succeed(n < 4)
 * )
 *
 * Effect.runPromise(Stream.runCollect(result)).then(console.log)
 * // { _id: 'Chunk', values: [1, 2, 3] }
 * ```
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
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 * const result = Stream.drop(stream, 2)
 *
 * Effect.runPromise(Stream.runCollect(result)).then(console.log)
 * // { _id: 'Chunk', values: [3, 4, 5] }
 * ```
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
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 * const chunked = Stream.chunks(stream)
 *
 * Effect.runPromise(Stream.runCollect(chunked)).then(console.log)
 * // { _id: 'Chunk', values: [[1, 2, 3, 4, 5]] }
 * ```
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
 * The channel processes chunks of values (NonEmptyReadonlyArray) and can transform both
 * the values and error types. Any errors from the original stream are handled by the channel.
 *
 * @example
 * ```ts
 * import { Stream, Channel, Effect, Console } from "effect"
 *
 * // Create a channel that processes chunks - this is a conceptual example
 * // In practice, this function is primarily used with specialized channels
 * // that properly handle chunk-based input/output, such as compression,
 * // encoding/decoding, or platform-specific transformations.
 *
 * declare const transformChannel: Channel.Channel<
 *   readonly [string, ...string[]],
 *   never,
 *   unknown,
 *   readonly [number, ...number[]],
 *   never,
 *   unknown,
 *   never
 * >
 *
 * const program = Stream.make(1, 2, 3).pipe(
 *   Stream.pipeThroughChannel(transformChannel),
 *   Stream.runCollect,
 *   Effect.flatMap(result => Console.log(result))
 * )
 * ```
 *
 * @example
 * ```ts
 * import { Stream, Channel, Effect, Console } from "effect"
 *
 * // Practical example: combining two channels with pipeTo
 * declare const sourceChannel: Channel.Channel<
 *   readonly [number, ...number[]],
 *   never,
 *   void,
 *   unknown,
 *   unknown,
 *   unknown,
 *   never
 * >
 * declare const transformChannel: Channel.Channel<
 *   readonly [string, ...string[]],
 *   never,
 *   unknown,
 *   readonly [number, ...number[]],
 *   never,
 *   void,
 *   never
 * >
 *
 * const combinedChannel = Channel.pipeTo(sourceChannel, transformChannel)
 *
 * const program = Stream.empty.pipe(
 *   Stream.pipeThroughChannel(combinedChannel),
 *   Stream.runCollect,
 *   Effect.flatMap(result => Console.log(result))
 * )
 * ```
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
 * This function is similar to `pipeThroughChannel` but preserves the original stream's
 * error type in addition to any errors the channel might produce. The result stream
 * can fail with either E (original stream errors) or E2 (channel errors).
 *
 * @example
 * ```ts
 * import { Stream, Channel, Effect, Console } from "effect"
 *
 * // Channel that might fail during processing
 * declare const transformChannel: Channel.Channel<
 *   readonly [string, ...string[]],
 *   "ChannelError",
 *   unknown,
 *   readonly [number, ...number[]],
 *   never,
 *   unknown,
 *   never
 * >
 *
 * const program = Stream.make(1, 2, 3).pipe(
 *   Stream.pipeThroughChannelOrFail(transformChannel),
 *   Stream.runCollect,
 *   Effect.flatMap(result => Console.log(result))
 * )
 * ```
 *
 * @example
 * ```ts
 * import { Stream, Channel, Effect, Console } from "effect"
 *
 * // Demonstrate error preservation: both stream and channel can fail
 * const failingStream = Stream.make(1, 2, 3).pipe(
 *   Stream.flatMap(n => n === 2 ? Stream.fail("StreamError" as const) : Stream.succeed(n))
 * )
 *
 * declare const numericTransformChannel: Channel.Channel<
 *   readonly [string, ...string[]],
 *   "ChannelError",
 *   unknown,
 *   readonly [number, ...number[]],
 *   "StreamError",
 *   unknown,
 *   never
 * >
 *
 * const program = failingStream.pipe(
 *   Stream.pipeThroughChannelOrFail(numericTransformChannel),
 *   Stream.runCollect,
 *   Effect.catch((error: "StreamError" | "ChannelError") =>
 *     Console.log(`Caught error: ${error}`) // Could be "StreamError" or "ChannelError"
 *   )
 * )
 * ```
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
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const encoder = new TextEncoder()
 * const stream = Stream.make(
 *   encoder.encode("Hello"),
 *   encoder.encode(" World")
 * )
 * const decoded = Stream.decodeText(stream)
 *
 * Effect.runPromise(Stream.runCollect(decoded)).then(console.log)
 * // { _id: 'Chunk', values: ["Hello", " World"] }
 * ```
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
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const stream = Stream.make("Hello", " ", "World")
 * const encoded = Stream.encodeText(stream)
 *
 * Effect.runPromise(Stream.runCollect(encoded)).then(console.log)
 * // { _id: 'Chunk', values: [Uint8Array, Uint8Array, Uint8Array] }
 * ```
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
 * Executes the provided finalizer after this stream's finalizers run.
 *
 * @example
 * ```ts
 * import { Stream, Effect, Console, Exit } from "effect"
 *
 * const stream = Stream.make(1, 2, 3).pipe(
 *   Stream.onExit((exit) =>
 *     Exit.isSuccess(exit)
 *       ? Console.log("Stream completed successfully")
 *       : Console.log("Stream failed")
 *   )
 * )
 *
 * Effect.runPromise(Stream.runCollect(stream))
 * // Stream completed successfully
 * ```
 *
 * @since 4.0.0
 * @category utils
 */
export const onExit: {
  <E, R2>(
    finalizer: (exit: Exit.Exit<unknown, E>) => Effect.Effect<unknown, never, R2>
  ): <A, R>(self: Stream<A, E, R>) => Stream<A, E, R | R2>
  <A, E, R, R2>(
    self: Stream<A, E, R>,
    finalizer: (exit: Exit.Exit<unknown, E>) => Effect.Effect<unknown, never, R2>
  ): Stream<A, E, R | R2>
} = dual(2, <A, E, R, R2>(
  self: Stream<A, E, R>,
  finalizer: (exit: Exit.Exit<unknown, E>) => Effect.Effect<unknown, never, R2>
): Stream<A, E, R | R2> => fromChannel(Channel.onExit(self.channel, finalizer)))

/**
 * @since 4.0.0
 * @category utils
 */
export const ensuring: {
  <R2>(finalizer: Effect.Effect<unknown, never, R2>): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E, R | R2>
  <A, E, R, R2>(self: Stream<A, E, R>, finalizer: Effect.Effect<unknown, never, R2>): Stream<A, E, R | R2>
} = dual(
  2,
  <A, E, R, R2>(self: Stream<A, E, R>, finalizer: Effect.Effect<unknown, never, R2>): Stream<A, E, R | R2> =>
    fromChannel(Channel.ensuring(self.channel, finalizer))
)

/**
 * Provides the stream with some of its required services, which eliminates its
 * dependency on `R`.
 *
 * @since 4.0.0
 * @category context
 */
export const provideServices: {
  <R2>(services: ServiceMap.ServiceMap<R2>): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E, Exclude<R, R2>>
  <A, E, R, R2>(self: Stream<A, E, R>, services: ServiceMap.ServiceMap<R2>): Stream<A, E, Exclude<R, R2>>
} = dual(
  2,
  <A, E, R, R2>(self: Stream<A, E, R>, services: ServiceMap.ServiceMap<R2>): Stream<A, E, Exclude<R, R2>> =>
    fromChannel(Channel.provideServices(self.channel, services))
)

/**
 * Runs the sink on the stream to produce either the sink's result or an error.
 *
 * @example
 * ```ts
 * import { Stream, Sink, Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 * const collectSink = Sink.succeed(42)
 * const result = Stream.run(stream, collectSink)
 *
 * Effect.runPromise(result).then(console.log)
 * // 42
 * ```
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
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 *
 * const program = Stream.runCollect(stream)
 *
 * Effect.runPromise(program).then(console.log)
 * // [1, 2, 3, 4, 5]
 * ```
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
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 *
 * const program = Stream.runCount(stream)
 *
 * Effect.runPromise(program).then(console.log)
 * // 5
 * ```
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
 * @example
 * ```ts
 * import { Stream, Effect, Console } from "effect"
 *
 * const stream = Stream.make(1, 2, 3)
 *
 * const program = Stream.runForEach(stream, (n) =>
 *   Console.log(`Processing: ${n}`)
 * )
 *
 * Effect.runPromise(program)
 * // Processing: 1
 * // Processing: 2
 * // Processing: 3
 * ```
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
 * @example
 * ```ts
 * import { Stream, Effect, Console } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 * const result = Stream.runForEachChunk(stream, (chunk) =>
 *   Console.log(`Processing chunk: ${chunk.join(", ")}`)
 * )
 *
 * Effect.runPromise(result)
 * // Processing chunk: 1, 2, 3, 4, 5
 * ```
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
 * @example
 * ```ts
 * import { Stream, Effect, Console } from "effect"
 *
 * const stream = Stream.make(1, 2, 3).pipe(
 *   Stream.mapEffect((n) => Console.log(`Processing: ${n}`))
 * )
 *
 * Effect.runPromise(Stream.runDrain(stream))
 * // Processing: 1
 * // Processing: 2
 * // Processing: 3
 * ```
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
 * @example
 * ```ts
 * import { Stream, Effect, Scope } from "effect"
 *
 * const stream = Stream.make(1, 2, 3)
 * const program = Effect.scoped(
 *   Effect.gen(function* () {
 *     const pull = yield* Stream.toPull(stream)
 *     const chunk1 = yield* pull
 *     console.log(chunk1) // [1, 2, 3]
 *   })
 * )
 *
 * Effect.runPromise(program)
 * ```
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
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const stream = Stream.make("Hello", " ", "World", "!")
 * const result = Stream.mkString(stream)
 *
 * Effect.runPromise(result).then(console.log)
 * // "Hello World!"
 * ```
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

/**
 * Converts the stream to a `ReadableStream`.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream.
 *
 * @example
 * ```ts
 * import { Stream, ServiceMap } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 * const readableStream = Stream.toReadableStreamWith(stream, ServiceMap.empty())
 *
 * console.log(readableStream instanceof ReadableStream) // true
 * ```
 *
 * @since 2.0.0
 * @category destructors
 */
export const toReadableStreamWith = dual<
  <A, XR>(
    services: ServiceMap.ServiceMap<XR>,
    options?: { readonly strategy?: QueuingStrategy<A> | undefined }
  ) => <E, R extends XR>(self: Stream<A, E, R>) => ReadableStream<A>,
  <A, E, XR, R extends XR>(
    self: Stream<A, E, R>,
    services: ServiceMap.ServiceMap<XR>,
    options?: { readonly strategy?: QueuingStrategy<A> | undefined }
  ) => ReadableStream<A>
>(
  (args) => isStream(args[0]),
  <A, E, XR, R extends XR>(
    self: Stream<A, E, R>,
    services: ServiceMap.ServiceMap<XR>,
    options?: { readonly strategy?: QueuingStrategy<A> | undefined }
  ): ReadableStream<A> => {
    let currentResolve: (() => void) | undefined = undefined
    let fiber: Fiber.Fiber<void, E> | undefined = undefined
    const latch = Effect.unsafeMakeLatch(false)

    return new ReadableStream<A>({
      start(controller) {
        fiber = Effect.runFork(Effect.provideServices(
          runForEachChunk(self, (chunk) =>
            latch.whenOpen(Effect.sync(() => {
              latch.unsafeClose()
              for (let i = 0; i < chunk.length; i++) {
                controller.enqueue(chunk[i])
              }
              currentResolve!()
              currentResolve = undefined
            }))),
          services
        ))
        fiber.addObserver((exit) => {
          if (exit._tag === "Failure") {
            controller.error(Cause.squash(exit.cause))
          } else {
            controller.close()
          }
        })
      },
      pull() {
        return new Promise<void>((resolve) => {
          currentResolve = resolve
          latch.unsafeOpen()
        })
      },
      cancel() {
        if (!fiber) return
        return Effect.runPromise(Effect.asVoid(Fiber.interrupt(fiber)))
      }
    }, options?.strategy)
  }
)

/**
 * Converts the stream to a `ReadableStream`.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream.
 *
 * @example
 * ```ts
 * import { Stream } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 * const readableStream = Stream.toReadableStream(stream)
 *
 * console.log(readableStream instanceof ReadableStream) // true
 * ```
 *
 * @since 2.0.0
 * @category destructors
 */
export const toReadableStream: {
  <A>(
    options?: { readonly strategy?: QueuingStrategy<A> | undefined }
  ): <E>(
    self: Stream<A, E>
  ) => ReadableStream<A>
  <A, E>(
    self: Stream<A, E>,
    options?: { readonly strategy?: QueuingStrategy<A> | undefined }
  ): ReadableStream<A>
} = dual(
  (args) => isStream(args[0]),
  <A, E>(
    self: Stream<A, E>,
    options?: { readonly strategy?: QueuingStrategy<A> | undefined }
  ): ReadableStream<A> => toReadableStreamWith(self, ServiceMap.empty(), options)
)

/**
 * Converts the stream to a `Effect<ReadableStream>`.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream.
 *
 * @example
 * ```ts
 * import { Stream, Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 * const readableStreamEffect = Stream.toReadableStreamEffect(stream)
 *
 * Effect.runPromise(readableStreamEffect).then(rs =>
 *   console.log(rs instanceof ReadableStream) // true
 * )
 * ```
 *
 * @since 2.0.0
 * @category destructors
 */
export const toReadableStreamEffect: {
  <A>(
    options?: { readonly strategy?: QueuingStrategy<A> | undefined }
  ): <E, R>(
    self: Stream<A, E, R>
  ) => Effect.Effect<ReadableStream<A>, never, R>
  <A, E, R>(
    self: Stream<A, E, R>,
    options?: { readonly strategy?: QueuingStrategy<A> | undefined }
  ): Effect.Effect<ReadableStream<A>, never, R>
} = dual(
  (args) => isStream(args[0]),
  <A, E, R>(
    self: Stream<A, E, R>,
    options?: { readonly strategy?: QueuingStrategy<A> | undefined }
  ): Effect.Effect<ReadableStream<A>, never, R> =>
    Effect.map(
      Effect.services<R>(),
      (context) => toReadableStreamWith(self, context, options)
    )
)
