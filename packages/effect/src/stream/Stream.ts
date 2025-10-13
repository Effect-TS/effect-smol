/**
 * @since 2.0.0
 */
// @effect-diagnostics returnEffectInGen:off
import * as Cause from "../Cause.ts"
import * as Arr from "../collections/Array.ts"
import * as MutableHashMap from "../collections/MutableHashMap.ts"
import * as Filter from "../data/Filter.ts"
import * as Option from "../data/Option.ts"
import { hasProperty, isTagged } from "../data/Predicate.ts"
import * as Duration from "../Duration.ts"
import * as Effect from "../Effect.ts"
import * as Exit from "../Exit.ts"
import * as Fiber from "../Fiber.ts"
import type { LazyArg } from "../Function.ts"
import { constant, constTrue, constVoid, dual, identity } from "../Function.ts"
import * as Equal from "../interfaces/Equal.ts"
import { type Pipeable, pipeArguments } from "../interfaces/Pipeable.ts"
import type * as Layer from "../Layer.ts"
import type * as PubSub from "../PubSub.ts"
import * as Queue from "../Queue.ts"
import * as RcMap from "../RcMap.ts"
import * as RcRef from "../RcRef.ts"
import * as Schedule from "../Schedule.ts"
import * as Scope from "../Scope.ts"
import * as ServiceMap from "../ServiceMap.ts"
import * as Channel from "../stream/Channel.ts"
import * as Pull from "../stream/Pull.ts"
import type * as Sink from "../stream/Sink.ts"
import { isString } from "../String.ts"
import type { ParentSpan, SpanOptions } from "../Tracer.ts"
import type { TypeLambda } from "../types/HKT.ts"
import type { Covariant, ExcludeTag, ExtractTag, Tags } from "../types/Types.ts"
import type * as Unify from "../types/Unify.ts"
import type * as Take from "./Take.ts"

const TypeId = "~effect/stream/Stream"

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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
 * import type * as Stream from "effect/stream/Stream"
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
 * import type { Kind } from "effect/types/HKT"
 * import type { StreamTypeLambda } from "effect/stream/Stream"
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
 * import { Stream } from "effect/stream"
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
 * import { Stream } from "effect/stream"
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
 * import { Stream } from "effect/stream"
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
 * import { Stream } from "effect/stream"
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
 */
export const isStream = (u: unknown): u is Stream<unknown, unknown, unknown> => hasProperty(u, TypeId)

const StreamProto = {
  [TypeId]: streamVariance,
  pipe() {
    return pipeArguments(this, arguments)
  }
}

/**
 * The default chunk size used by streams for batching operations.
 *
 * @example
 * ```ts
 * import { Stream } from "effect/stream"
 *
 * console.log(Stream.DefaultChunkSize) // 4096
 * ```
 *
 * @category constants
 * @since 2.0.0
 */
export const DefaultChunkSize: number = Channel.DefaultChunkSize

/**
 * @category models
 * @since 2.0.0
 */
export type HaltStrategy = Channel.HaltStrategy

/**
 * Creates a stream from a `Channel`.
 *
 * This function allows you to create a Stream by providing a Channel that
 * produces arrays of values. It's useful when you have low-level channel
 * operations that you want to expose as a higher-level Stream.
 *
 * @example
 * ```ts
 * import { Stream } from "effect/stream"
 * import { Channel } from "effect/stream"
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
 * @since 4.0.0
 * @category constructors
 */
export const fromEffectDrain = <A, E, R>(effect: Effect.Effect<A, E, R>): Stream<never, E, R> =>
  fromPull(Effect.succeed(Effect.flatMap(effect, () => Pull.haltVoid)))

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromEffectRepeat = <A, E, R>(effect: Effect.Effect<A, E, R>): Stream<A, Pull.ExcludeHalt<E>, R> =>
  fromPull(Effect.succeed(Effect.map(effect, Arr.of)))

/**
 * Creates a stream from an effect producing a value of type `A`, which is
 * repeated using the specified schedule.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromEffectSchedule = <A, E, R, X, AS extends A, ES, RS>(
  effect: Effect.Effect<A, E, R>,
  schedule: Schedule.Schedule<X, AS, ES, RS>
): Stream<A, E | ES, R | RS> =>
  fromPull(Effect.gen(function*() {
    const step = yield* Schedule.toStepWithSleep(schedule)
    let s = yield* effect
    let initial = true
    const pull = Effect.suspend(() => step(s as AS)).pipe(
      Effect.flatMap(() => effect),
      Effect.map((next) => {
        s = next
        return Arr.of(next)
      })
    ) as Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E | ES, void, R | RS>
    return Effect.suspend(() => {
      if (initial) {
        initial = false
        return Effect.succeed(Arr.of(s))
      }
      return pull
    })
  }))

/**
 * Creates a stream from a pull effect.
 *
 * A pull effect is a low-level representation of a stream that can be used
 * to produce values on demand. This function lifts a pull effect into a Stream.
 *
 * @example
 * ```ts
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * const originalStream = Stream.make(1, 2, 3)
 *
 * const transformedStream = Stream.transformPull(
 *   originalStream,
 *   (pull) => Effect.succeed(pull)
 * )
 *
 * Effect.runPromise(Stream.runCollect(transformedStream)).then(console.log)
 * ```
 *
 * @since 4.0.0
 * @category utils
 */
export const transformPull = <A, E, R, B, E2, R2, EX, RX>(
  self: Stream<A, E, R>,
  f: (pull: Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E, void>, scope: Scope.Scope) => Effect.Effect<
    Pull.Pull<Arr.NonEmptyReadonlyArray<B>, E2, void, R2>,
    EX,
    RX
  >
): Stream<B, EX | Pull.ExcludeHalt<E2>, R | R2 | RX> =>
  fromChannel(
    Channel.fromTransform((_, scope) =>
      Effect.flatMap(Channel.toPullScoped(self.channel, scope), (pull) => f(pull as any, scope))
    )
  )

/**
 * Transforms a stream by effectfully transforming its pull effect.
 *
 * A forked scope is also provided to the transformation function, which is
 * closed once the resulting stream has finished processing.
 *
 * @since 4.0.0
 * @category utils
 */
export const transformPullBracket = <A, E, R, B, E2, R2, EX, RX>(
  self: Stream<A, E, R>,
  f: (
    pull: Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E, void, R>,
    scope: Scope.Scope,
    forkedScope: Scope.Scope
  ) => Effect.Effect<
    Pull.Pull<Arr.NonEmptyReadonlyArray<B>, E2, void, R2>,
    EX,
    RX
  >
): Stream<B, EX | Pull.ExcludeHalt<E2>, R | R2 | RX> =>
  fromChannel(
    Channel.fromTransformBracket((_, scope, forkedScope) =>
      Effect.flatMap(Channel.toPullScoped(self.channel, scope), (pull) => f(pull, scope, forkedScope))
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
 * import { Stream } from "effect/stream"
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 * import { Queue } from "effect"
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * const emptyStream = Stream.empty
 *
 * // Running the empty stream produces an empty chunk
 * const program = emptyStream.pipe(Stream.runCollect)
 *
 * Effect.runPromise(program).then(console.log)
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3)
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const make = <const As extends ReadonlyArray<any>>(...values: As): Stream<As[number]> => fromArray(values)

/**
 * Creates a single-valued pure stream.
 *
 * This function creates a Stream that evaluates the provided function
 * synchronously and emits the result as a single value.
 *
 * @example
 * ```ts
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * const stream = Stream.sync(() => Math.random())
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
 * import { Effect } from "effect"
 * import { Stream } from "effect/stream"
 * import { Cause } from "effect"
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
 * @since 2.0.0
 * @category constructors
 */
export const die = (defect: unknown): Stream<never> => fromChannel(Channel.die(defect))

/**
 * The stream that always fails with the specified lazily evaluated `Cause`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Stream } from "effect/stream"
 * import { Cause } from "effect"
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
export const fromIterable = <A>(iterable: Iterable<A>): Stream<A> =>
  Array.isArray(iterable)
    ? fromArray(iterable)
    : fromChannel(Channel.fromIterableArray(iterable))

/**
 * Creates a new `Stream` from an effect that produces an iterable collection of
 * values.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromIterableEffect = <A, E, R>(iterable: Effect.Effect<Iterable<A>, E, R>): Stream<A, E, R> =>
  unwrap(Effect.map(iterable, fromIterable))

/**
 * Creates a new `Stream` from an effect that produces an iterable collection of
 * values.
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromIterableEffectRepeat = <A, E, R>(
  iterable: Effect.Effect<Iterable<A>, E, R>
): Stream<A, Pull.ExcludeHalt<E>, R> => flatMap(fromEffectRepeat(iterable), fromIterable)

/**
 * Creates a stream from an array.
 *
 * This function creates a Stream that emits all values from the provided array.
 * If the array is empty, it returns an empty Stream.
 *
 * @example
 * ```ts
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * const numbers = [1, 2, 3, 4, 5]
 * const stream = Stream.fromArray(numbers)
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromArray = <A>(array: ReadonlyArray<A>): Stream<A> =>
  Arr.isReadonlyArrayNonEmpty(array) ? fromChannel(Channel.succeed(array)) : empty

/**
 * Creates a stream from an effect that produces an array of values.
 *
 * This function creates a Stream that emits all values from the provided array.
 * If the array is empty, it returns an empty Stream.
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromArrayEffect = <A, E, R>(effect: Effect.Effect<ReadonlyArray<A>, E, R>): Stream<A, E, R> =>
  unwrap(Effect.map(effect, fromArray))

/**
 * Creates a stream from some ararys.
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromArrays = <Arr extends ReadonlyArray<ReadonlyArray<any>>>(
  ...arrays: Arr
): Stream<Arr[number][number]> => fromChannel(Channel.fromArray(Arr.filter(arrays, Arr.isReadonlyArrayNonEmpty)))

/**
 * Creates a stream from a queue.
 *
 * This function creates a Stream that consumes values from the provided Queue.
 * The stream will emit values as they become available from the queue.
 *
 * @example
 * ```ts
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 * import { Queue } from "effect"
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
 * import { Effect } from "effect"
 * import { Stream } from "effect/stream"
 * import { PubSub } from "effect"
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
export const fromPubSub = <A>(pubsub: PubSub.PubSub<A>): Stream<A> => fromChannel(Channel.fromPubSubArray(pubsub))

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromPubSubTake = <A, E>(pubsub: PubSub.PubSub<Take.Take<A, E>>): Stream<A, E> =>
  fromChannel(Channel.fromPubSubTake(pubsub))

/**
 * Creates a stream from a ReadableStream.
 *
 * @example
 * ```ts
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
 * Creates a stream from an AsyncIterable.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromAsyncIterable = <A, E>(
  iterable: AsyncIterable<A>,
  onError: (error: unknown) => E
): Stream<A, E> => fromChannel(Channel.fromAsyncIterableArray(iterable, onError))

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
 * A stream that emits void values spaced by the specified duration.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Stream } from "effect/stream"
 *
 * let last = Date.now()
 * const log = (message: string) =>
 *   Effect.sync(() => {
 *     const end = Date.now()
 *     console.log(`${message} after ${end - last}ms`)
 *     last = end
 *   })
 *
 * const stream = Stream.tick("1 seconds").pipe(Stream.tap(() => log("tick")))
 *
 * Effect.runPromise(Stream.runCollect(stream.pipe(Stream.take(5)))).then(console.log)
 * // tick after 4ms
 * // tick after 1003ms
 * // tick after 1001ms
 * // tick after 1002ms
 * // tick after 1002ms
 * // [ undefined, undefined, undefined, undefined, undefined ]
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const tick = (interval: Duration.DurationInput): Stream<void> => fromEffectRepeat(Effect.sleep(interval))

/**
 * Creates a stream from a PubSub subscription.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Stream } from "effect/stream"
 * import { PubSub } from "effect"
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
export const fromSubscription = <A>(pubsub: PubSub.Subscription<A>): Stream<A> =>
  fromChannel(Channel.fromSubscriptionArray(pubsub))

/**
 * Interface representing an event listener target.
 *
 * @example
 * ```ts
 * import { Stream } from "effect/stream"
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
      Queue.offerUnsafe(queue, event)
    }
    return Effect.acquireRelease(
      Effect.sync(() => target.addEventListener(type, emit, options)),
      () => Effect.sync(() => target.removeEventListener(type, emit, options))
    )
  }, { bufferSize: typeof options === "object" ? options.bufferSize : undefined })

/**
 * Creates a stream by peeling off the "layers" of a value of type `S`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Stream } from "effect/stream"
 *
 * const stream = Stream.unfold(1, (n) => Effect.succeed([n, n + 1]))
 *
 * Effect.runPromise(Stream.runCollect(stream.pipe(Stream.take(5)))).then(console.log)
 * // [ 1, 2, 3, 4, 5 ]
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const unfold = <S, A, E, R>(
  s: S,
  f: (s: S) => Effect.Effect<readonly [A, S] | undefined, E, R>
): Stream<A, E, R> =>
  fromPull(Effect.sync(() => {
    let state = s
    return Effect.flatMap(Effect.suspend(() => f(state)), (next) => {
      if (next === undefined) return Pull.haltVoid
      state = next[1]
      return Effect.succeed(Arr.of(next[0]))
    })
  }))

/**
 * Create a stream that allows you to wrap a paginated resource.
 *
 * @example
 * ```ts
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 * import * as Option from "effect/data/Option"
 *
 * const stream = Stream.paginate(0, (n: number) =>
 *   Effect.succeed([
 *     [n],
 *     n < 3 ? Option.some(n + 1) : Option.none<number>()
 *   ] as const)
 * )
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const paginate = <S, A, E = never, R = never>(
  s: S,
  f: (
    s: S
  ) =>
    | Effect.Effect<readonly [ReadonlyArray<A>, Option.Option<S>], E, R>
    | readonly [ReadonlyArray<A>, Option.Option<S>]
): Stream<A, E, R> =>
  fromPull(Effect.sync(() => {
    let state = s
    let done = false
    return Effect.suspend(function loop(): Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E, void, R> {
      if (done) return Pull.haltVoid
      const result = f(state)
      return Effect.flatMap(Effect.isEffect(result) ? result : Effect.succeed(result), ([a, s]) => {
        if (Option.isNone(s)) {
          done = true
        } else {
          state = s.value
        }
        if (!Arr.isReadonlyArrayNonEmpty(a)) return loop()
        return Effect.succeed(a)
      })
    })
  }))

/**
 * The infinite stream of iterative function application: a, f(a), f(f(a)),
 * f(f(f(a))), ...
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Stream } from "effect/stream"
 *
 * // An infinite Stream of numbers starting from 1 and incrementing
 * const stream = Stream.iterate(1, (n) => n + 1)
 *
 * Effect.runPromise(Stream.runCollect(stream.pipe(Stream.take(10)))).then(console.log)
 * // [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const iterate = <A>(value: A, next: (value: A) => A): Stream<A> =>
  unfold(value, (a) => Effect.succeed([a, next(a)]))

/**
 * Creates a new `Stream` which will emit all numeric values from `min` to `max`
 * (inclusive).
 *
 * If the provided `min` is greater than `max`, the stream will not emit any
 * values.
 *
 * @example
 * ```ts
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * const effectThatCreatesStream = Effect.succeed(
 *   Stream.make(1, 2, 3)
 * )
 *
 * const stream = Stream.unwrap(effectThatCreatesStream)
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const unwrap = <A, E2, R2, E, R>(
  effect: Effect.Effect<Stream<A, E2, R2>, E, R>
): Stream<A, E | E2, R2 | Exclude<R, Scope.Scope>> => fromChannel(Channel.unwrap(Effect.map(effect, toChannel)))

/**
 * @since 2.0.0
 * @category utils
 */
export const scoped = <A, E, R>(
  self: Stream<A, E, R>
): Stream<A, E, Exclude<R, Scope.Scope>> => fromChannel(Channel.scoped(self.channel))

/**
 * Transforms the elements of this stream using the supplied function.
 *
 * @example
 * ```ts
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
 * @since 2.0.0
 * @category mapping
 */
export const mapArray: {
  <A, B>(
    f: (a: Arr.NonEmptyReadonlyArray<A>) => Arr.NonEmptyReadonlyArray<B>
  ): <E, R>(self: Stream<A, E, R>) => Stream<B, E, R>
  <A, E, R, B>(
    self: Stream<A, E, R>,
    f: (a: Arr.NonEmptyReadonlyArray<A>) => Arr.NonEmptyReadonlyArray<B>
  ): Stream<B, E, R>
} = dual(2, <A, E, R, B>(
  self: Stream<A, E, R>,
  f: (a: Arr.NonEmptyReadonlyArray<A>) => Arr.NonEmptyReadonlyArray<B>
): Stream<B, E, R> => fromChannel(Channel.map(self.channel, f)))

/**
 * Maps over elements of the stream with the specified effectful function.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Stream } from "effect/stream"
 * import { Console } from "effect"
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
      readonly bufferSize?: number | undefined
      readonly unordered?: boolean | undefined
    } | undefined
  ): <E, R>(self: Stream<A, E, R>) => Stream<A2, E2 | E, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    f: (a: A) => Effect.Effect<A2, E2, R2>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
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
 * @since 2.0.0
 * @category mapping
 */
export const flattenEffect: {
  (
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
      readonly unordered?: boolean | undefined
    } | undefined
  ): <A, EX, RX, E, R>(self: Stream<Effect.Effect<A, EX, RX>, E, R>) => Stream<A, EX | E, RX | R>
  <A, E, R, EX, RX>(
    self: Stream<Effect.Effect<A, EX, RX>, E, R>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
      readonly unordered?: boolean | undefined
    } | undefined
  ): Stream<A, EX | E, RX | R>
} = dual((args) => isStream(args[0]), <A, E, R, EX, RX>(
  self: Stream<Effect.Effect<A, EX, RX>, E, R>,
  options?: {
    readonly concurrency?: number | "unbounded" | undefined
    readonly bufferSize?: number | undefined
    readonly unordered?: boolean | undefined
  } | undefined
): Stream<A, EX | E, RX | R> => mapEffect(self, identity, options))

/**
 * @since 4.0.0
 * @category mapping
 */
export const mapArrayEffect: {
  <A, B, E2, R2>(
    f: (a: Arr.NonEmptyReadonlyArray<A>) => Effect.Effect<Arr.NonEmptyReadonlyArray<B>, E2, R2>
  ): <E, R>(self: Stream<A, E, R>) => Stream<B, E | E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Stream<A, E, R>,
    f: (a: Arr.NonEmptyReadonlyArray<A>) => Effect.Effect<Arr.NonEmptyReadonlyArray<B>, E2, R2>
  ): Stream<B, E | E2, R | R2>
} = dual(2, <A, E, R, B, E2, R2>(
  self: Stream<A, E, R>,
  f: (a: Arr.NonEmptyReadonlyArray<A>) => Effect.Effect<Arr.NonEmptyReadonlyArray<B>, E2, R2>
): Stream<B, E | E2, R | R2> => fromChannel(Channel.mapEffect(self.channel, f)))

/**
 * Adds an effect to consumption of every element of the stream.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Stream } from "effect/stream"
 * import { Console } from "effect"
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
): Stream<A, E | E2, R | R2> => {
  const concurrency = options?.concurrency ?? 1
  if (concurrency === 1 || concurrency === "unbounded") {
    return self.channel.pipe(
      Channel.tap(Effect.forEach(f, { discard: true, concurrency }), options),
      fromChannel
    )
  }
  return suspend(() => {
    const withPermit = Effect.makeSemaphoreUnsafe(concurrency).withPermit
    return self.channel.pipe(
      Channel.tap(Effect.forEach((a) => withPermit(f(a)), { discard: true, concurrency }), options),
      fromChannel
    )
  })
})

/**
 * Returns a stream made of the concatenation in strict order of all the
 * streams produced by passing each element of this stream to `f0`
 *
 * @example
 * ```ts
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
 * Flattens a stream of non-empty arrays into a single stream.
 *
 * @since 4.0.0
 * @category sequencing
 */
export const flattenArray = <A, E, R>(self: Stream<Arr.NonEmptyReadonlyArray<A>, E, R>): Stream<A, E, R> =>
  fromChannel(Channel.flattenArray(self.channel))

/**
 * @since 2.0.0
 * @category sequencing
 */
export const drain = <A, E, R>(self: Stream<A, E, R>): Stream<never, E, R> => fromChannel(Channel.drain(self.channel))

/**
 * Flattens a stream of iterables into a single stream.
 *
 * @since 4.0.0
 * @category sequencing
 */
export const flattenIterable = <A, E, R>(self: Stream<Iterable<A>, E, R>): Stream<A, E, R> =>
  flatMap(self, fromIterable)

/**
 * Flattens a stream of Take's into a single stream.
 *
 * @since 4.0.0
 * @category sequencing
 */
export const flattenTake = <A, E, E2, R>(self: Stream<Take.Take<A, E>, E2, R>): Stream<A, E | E2, R> =>
  self.channel.pipe(
    Channel.flattenArray,
    Channel.flattenTake,
    fromChannel
  )

/**
 * Concatenates two streams, emitting all elements from the first stream
 * followed by all elements from the second stream.
 *
 * @example
 * ```ts
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * const stream1 = Stream.make(1, 2, 3)
 * const stream2 = Stream.make(4, 5, 6)
 *
 * const concatenated = Stream.concat(stream1, stream2)
 *
 * Effect.runPromise(Stream.runCollect(concatenated)).then(console.log)
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
 * @since 2.0.0
 * @category merging
 */
export const merge: {
  <A2, E2, R2>(
    that: Stream<A2, E2, R2>,
    options?: {
      readonly haltStrategy?: HaltStrategy | undefined
    } | undefined
  ): <A, E, R>(self: Stream<A, E, R>) => Stream<A | A2, E | E2, R | R2>
  <A, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    that: Stream<A2, E2, R2>,
    options?: {
      readonly haltStrategy?: HaltStrategy | undefined
    } | undefined
  ): Stream<A | A2, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    that: Stream<A2, E2, R2>,
    options?: {
      readonly haltStrategy?: HaltStrategy | undefined
    } | undefined
  ): Stream<A | A2, E | E2, R | R2> => fromChannel(Channel.merge(toChannel(self), toChannel(that), options))
)

/**
 * @since 3.7.0
 * @category racing
 */
export const raceAll = <S extends ReadonlyArray<Stream<any, any, any>>>(
  ...streams: S
): Stream<Success<S[number]>, Error<S[number]>, Services<S[number]>> =>
  fromChannel(Channel.fromTransform(Effect.fnUntraced(function*(_, scope) {
    let winner:
      | Pull.Pull<Arr.NonEmptyReadonlyArray<Success<S[number]>>, Error<S[number]>, void, Services<S[number]>>
      | undefined
    const race = Effect.raceAll(streams.map((stream) => {
      const childScope = Scope.forkUnsafe(scope)
      return Channel.toPullScoped(stream.channel, childScope).pipe(
        Effect.flatMap((pull) => Effect.zip(Effect.succeed(pull), pull)),
        Effect.onExit((exit) => {
          if (exit._tag === "Success") {
            if (winner) {
              return Scope.close(childScope, exit)
            }
            winner = exit.value[0]
            return Effect.void
          }
          return Scope.close(childScope, exit)
        }),
        Effect.map(([, chunk]) => chunk)
      )
    }))
    return Effect.suspend(() => winner ?? race)
  })))

/**
 * @since 3.7.0
 * @category racing
 */
export const race: {
  <AR, ER, RR>(
    right: Stream<AR, ER, RR>
  ): <AL, EL, RL>(left: Stream<AL, EL, RL>) => Stream<AL | AR, EL | ER, RL | RR>
  <AL, EL, RL, AR, ER, RR>(
    left: Stream<AL, EL, RL>,
    right: Stream<AR, ER, RR>
  ): Stream<AL | AR, EL | ER, RL | RR>
} = dual(2, <AL, EL, RL, AR, ER, RR>(
  left: Stream<AL, EL, RL>,
  right: Stream<AR, ER, RR>
): Stream<AL | AR, EL | ER, RL | RR> => raceAll(left, right))

/**
 * @since 2.0.0
 * @category Filtering
 */
export const filter: {
  <A, B, X>(filter: Filter.Filter<A, B, X>): <E, R>(self: Stream<A, E, R>) => Stream<B, E, R>
  <A, E, R, B, X>(self: Stream<A, E, R>, filter: Filter.Filter<A, B, X>): Stream<B, E, R>
} = dual(
  2,
  <A, E, R, B, X>(self: Stream<A, E, R>, filter: Filter.Filter<A, B, X>): Stream<B, E, R> =>
    fromChannel(Channel.filterArray(toChannel(self), filter))
)

/**
 * Allows a faster producer to progress independently of a slower consumer by
 * buffering up to `capacity` elements in a queue.
 *
 * Note: This combinator destroys the chunking structure. It's recommended to
 *       use rechunk afterwards.
 *
 * @since 2.0.0
 * @category utils
 */
export const buffer: {
  (
    options: { readonly capacity: "unbounded" } | {
      readonly capacity: number
      readonly strategy?: "dropping" | "sliding" | "suspend" | undefined
    }
  ): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E, R>
  <A, E, R>(
    self: Stream<A, E, R>,
    options: { readonly capacity: "unbounded" } | {
      readonly capacity: number
      readonly strategy?: "dropping" | "sliding" | "suspend" | undefined
    }
  ): Stream<A, E, R>
} = dual(2, <A, E, R>(
  self: Stream<A, E, R>,
  options: { readonly capacity: "unbounded" } | {
    readonly capacity: number
    readonly strategy?: "dropping" | "sliding" | "suspend" | undefined
  }
): Stream<A, E, R> => fromChannel(Channel.bufferArray(self.channel, options)))

/**
 * Allows a faster producer to progress independently of a slower consumer by
 * buffering up to `capacity` elements in a queue.
 *
 * @since 2.0.0
 * @category utils
 */
export const bufferArray: {
  (
    options: { readonly capacity: "unbounded" } | {
      readonly capacity: number
      readonly strategy?: "dropping" | "sliding" | "suspend" | undefined
    }
  ): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E, R>
  <A, E, R>(
    self: Stream<A, E, R>,
    options: { readonly capacity: "unbounded" } | {
      readonly capacity: number
      readonly strategy?: "dropping" | "sliding" | "suspend" | undefined
    }
  ): Stream<A, E, R>
} = dual(2, <A, E, R>(
  self: Stream<A, E, R>,
  options: { readonly capacity: "unbounded" } | {
    readonly capacity: number
    readonly strategy?: "dropping" | "sliding" | "suspend" | undefined
  }
): Stream<A, E, R> => fromChannel(Channel.buffer(self.channel, options)))

/**
 * Handles stream failures by examining the full Cause of failure.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Stream } from "effect/stream"
 * import { Cause } from "effect"
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
 * @since 4.0.0
 * @category Error handling
 */
export const catchFilter: {
  <E, EB, X, A2, E2, R2>(
    filter: Filter.Filter<E, EB, X>,
    f: (failure: EB) => Stream<A2, E2, R2>
  ): <A, R>(self: Stream<A, E, R>) => Stream<A | A2, X | E2, R | R2>
  <A, E, R, EB, X, A2, E2, R2>(
    self: Stream<A, E, R>,
    filter: Filter.Filter<E, EB, X>,
    f: (failure: EB) => Stream<A2, E2, R2>
  ): Stream<A | A2, X | E2, R | R2>
} = dual(3, <A, E, R, EB, X, A2, E2, R2>(
  self: Stream<A, E, R>,
  filter: Filter.Filter<E, EB, X>,
  f: (failure: EB) => Stream<A2, E2, R2>
): Stream<A | A2, X | E2, R | R2> => fromChannel(Channel.catchFilter(toChannel(self), filter, (e) => f(e).channel)))

/**
 * @since 4.0.0
 * @category Error handling
 */
export const catchTag: {
  <const K extends Tags<E> | Arr.NonEmptyReadonlyArray<Tags<E>>, E, A1, E1, R1>(
    k: K,
    f: (
      e: ExtractTag<NoInfer<E>, K extends Arr.NonEmptyReadonlyArray<string> ? K[number] : K>
    ) => Stream<A1, E1, R1>
  ): <A, R>(
    self: Stream<A, E, R>
  ) => Stream<A1 | A, E1 | ExcludeTag<E, K extends Arr.NonEmptyReadonlyArray<string> ? K[number] : K>, R1 | R>
  <
    A,
    E,
    R,
    const K extends Tags<E> | Arr.NonEmptyReadonlyArray<Tags<E>>,
    R1,
    E1,
    A1
  >(
    self: Stream<A, E, R>,
    k: K,
    f: (e: ExtractTag<E, K extends Arr.NonEmptyReadonlyArray<string> ? K[number] : K>) => Stream<A1, E1, R1>
  ): Stream<A1 | A, E1 | ExcludeTag<E, K extends Arr.NonEmptyReadonlyArray<string> ? K[number] : K>, R1 | R>
} = dual(
  3,
  <
    A,
    E,
    R,
    const K extends Tags<E> | Arr.NonEmptyReadonlyArray<Tags<E>>,
    R1,
    E1,
    A1
  >(
    self: Stream<A, E, R>,
    k: K,
    f: (e: ExtractTag<E, K extends Arr.NonEmptyReadonlyArray<string> ? K[number] : K>) => Stream<A1, E1, R1>
  ): Stream<A1 | A, E1 | ExcludeTag<E, K extends Arr.NonEmptyReadonlyArray<string> ? K[number] : K>, R1 | R> => {
    const pred = Array.isArray(k)
      ? ((e: E): e is any => hasProperty(e, "_tag") && k.includes(e._tag))
      : isTagged(k as string)
    return catchFilter(self, Filter.fromPredicate(pred), f) as any
  }
)

/**
 * @since 4.0.0
 * @category Error handling
 */
export const catchTags: {
  <
    E,
    Cases extends (E extends { _tag: string } ? {
        [K in E["_tag"]]+?: (error: Extract<E, { _tag: K }>) => Stream<any, any, any>
      } :
      {})
  >(
    cases: Cases
  ): <A, R>(self: Stream<A, E, R>) => Stream<
    | A
    | {
      [K in keyof Cases]: Cases[K] extends ((...args: Array<any>) => Stream<infer A, any, any>) ? A : never
    }[keyof Cases],
    | Exclude<E, { _tag: keyof Cases }>
    | {
      [K in keyof Cases]: Cases[K] extends ((...args: Array<any>) => Stream<any, infer E, any>) ? E : never
    }[keyof Cases],
    | R
    | {
      [K in keyof Cases]: Cases[K] extends ((...args: Array<any>) => Stream<any, any, infer R>) ? R : never
    }[keyof Cases]
  >
  <
    R,
    E,
    A,
    Cases extends (E extends { _tag: string } ? {
        [K in E["_tag"]]+?: (error: Extract<E, { _tag: K }>) => Stream<any, any, any>
      } :
      {})
  >(
    self: Stream<A, E, R>,
    cases: Cases
  ): Stream<
    | A
    | {
      [K in keyof Cases]: Cases[K] extends ((...args: Array<any>) => Stream<infer A, any, any>) ? A : never
    }[keyof Cases],
    | Exclude<E, { _tag: keyof Cases }>
    | {
      [K in keyof Cases]: Cases[K] extends ((...args: Array<any>) => Stream<any, infer E, any>) ? E : never
    }[keyof Cases],
    | R
    | {
      [K in keyof Cases]: Cases[K] extends ((...args: Array<any>) => Stream<any, any, infer R>) ? R : never
    }[keyof Cases]
  >
} = dual(2, (self, cases) => {
  let keys: Array<string>
  return catchFilter(
    self,
    (e) => {
      keys ??= Object.keys(cases)
      return hasProperty(e, "_tag") && isString(e["_tag"]) && keys.includes(e["_tag"]) ? e : Filter.fail(e)
    },
    (e) => cases[e["_tag"] as string](e)
  )
})

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
 * import { Effect } from "effect"
 * import { Stream } from "effect/stream"
 * import { Cause } from "effect"
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
 * @since 2.0.0
 * @category Error handling
 */
export const orElseIfEmpty: {
  <E, A2, E2, R2>(
    orElse: LazyArg<Stream<A2, E2, R2>>
  ): <A, R>(self: Stream<A, E, R>) => Stream<A | A2, E | E2, R | R2>
  <A, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    orElse: LazyArg<Stream<A2, E2, R2>>
  ): Stream<A | A2, E | E2, R | R2>
} = dual(2, <A, E, R, A2, E2, R2>(
  self: Stream<A, E, R>,
  orElse: LazyArg<Stream<A2, E2, R2>>
): Stream<A | A2, E | E2, R | R2> =>
  fromChannel(Channel.orElseIfEmpty(
    self.channel,
    (_) => toChannel(orElse())
  )))

/**
 * @since 2.0.0
 * @category Error handling
 */
export const orElseSucceed: {
  <E, A2>(
    f: (error: E) => A2
  ): <A, R>(self: Stream<A, E, R>) => Stream<A | A2, never, R>
  <A, E, R, A2>(
    self: Stream<A, E, R>,
    f: (error: E) => A2
  ): Stream<A | A2, never, R>
} = dual(2, <A, E, R, A2>(
  self: Stream<A, E, R>,
  f: (error: E) => A2
): Stream<A | A2, never, R> => catch_(self, (e) => succeed(f(e))))

/**
 * Converts stream failures into fiber terminations, making them unrecoverable.
 *
 * @example
 * ```ts
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
 * Ignore errors and convert them into an empty stream.
 *
 * @since 4.0.0
 * @category Error handling
 */
export const ignore = <A, E, R>(self: Stream<A, E, R>): Stream<A, never, R> => fromChannel(Channel.ignore(self.channel))

/**
 * Ignore errors and convert them into an empty stream.
 *
 * @since 4.0.0
 * @category Error handling
 */
export const ignoreCause = <A, E, R>(self: Stream<A, E, R>): Stream<A, never, R> =>
  fromChannel(Channel.ignoreCause(self.channel))

/**
 * Takes the specified number of elements from this stream.
 *
 * @example
 * ```ts
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 *
 * const firstThree = stream.pipe(Stream.take(3))
 *
 * const program = firstThree.pipe(Stream.runCollect)
 *
 * Effect.runPromise(program).then(console.log)
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5, 6)
 *
 * // Take until we find a number greater than 3
 * const taken = stream.pipe(
 *   Stream.takeUntil(n => n > 3)
 * )
 *
 * Effect.runPromise(Stream.runCollect(taken)).then(console.log)
 *
 * // Exclude the element that satisfies the predicate
 * const takenExclusive = stream.pipe(
 *   Stream.takeUntil(n => n > 3, { excludeLast: true })
 * )
 *
 * Effect.runPromise(Stream.runCollect(takenExclusive)).then(console.log)
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
              return Arr.isReadonlyArrayNonEmpty(arr) ? Effect.succeed(arr) : Pull.haltVoid
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 * const result = Stream.takeUntilEffect(stream, (n) =>
 *   Effect.succeed(n === 3)
 * )
 *
 * Effect.runPromise(Stream.runCollect(result)).then(console.log)
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
            return Arr.isReadonlyArrayNonEmpty(arr) ? arr : yield* Pull.haltVoid
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5, 6)
 * const result = Stream.takeWhile(stream, (n) => n < 4)
 *
 * Effect.runPromise(Stream.runCollect(result)).then(console.log)
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 * const result = Stream.takeWhileEffect(stream, (n) =>
 *   Effect.succeed(n < 4)
 * )
 *
 * Effect.runPromise(Stream.runCollect(result)).then(console.log)
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 * const result = Stream.drop(stream, 2)
 *
 * Effect.runPromise(Stream.runCollect(result)).then(console.log)
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 * const chunked = Stream.chunks(stream)
 *
 * Effect.runPromise(Stream.runCollect(chunked)).then(console.log)
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const chunks = <A, E, R>(self: Stream<A, E, R>): Stream<Arr.NonEmptyReadonlyArray<A>, E, R> =>
  self.channel.pipe(
    Channel.map(Arr.of),
    fromChannel
  )

/**
 * @since 2.0.0
 * @category utils
 */
export const rechunk: {
  (size: number): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E, R>
  <A, E, R>(self: Stream<A, E, R>, size: number): Stream<A, E, R>
} = dual(2, <A, E, R>(self: Stream<A, E, R>, target: number): Stream<A, E, R> => {
  target = Math.max(1, target)
  return transformPull(self, (pull, _scope) =>
    Effect.sync(() => {
      let chunk = Arr.empty<A>() as Arr.NonEmptyArray<A>
      let index = 0
      let current: Arr.NonEmptyReadonlyArray<A> | undefined
      let done = false

      return Effect.suspend(function loop(): Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E, void, R> {
        if (done) return Pull.haltVoid
        else if (current === undefined) {
          return Effect.flatMap(pull, (arr) => {
            if (chunk.length === 0 && arr.length === target) {
              return Effect.succeed(arr)
            } else if (chunk.length + arr.length < target) {
              // eslint-disable-next-line no-restricted-syntax
              chunk.push(...arr)
              return loop()
            }
            current = arr
            return loop()
          })
        }
        for (; index < current.length;) {
          chunk.push(current[index++])
          if (chunk.length === target) {
            const result = chunk
            chunk = [] as any
            return Effect.succeed(result)
          }
        }
        index = 0
        current = undefined
        return loop()
      }).pipe(
        Pull.catchHalt(() => {
          if (chunk.length === 0) return Pull.haltVoid
          const result = chunk
          done = true
          chunk = [] as any
          return Effect.succeed(result)
        })
      )
    }))
})

/**
 * @since 2.0.0
 * @category sequencing
 */
export const mapAccum: {
  <S, A, B>(
    initial: LazyArg<S>,
    f: (s: S, a: A) => readonly [state: S, values: ReadonlyArray<B>]
  ): <E, R>(self: Stream<A, E, R>) => Stream<B, E, R>
  <A, E, R, S, B>(
    self: Stream<A, E, R>,
    initial: LazyArg<S>,
    f: (s: S, a: A) => readonly [state: S, values: ReadonlyArray<B>]
  ): Stream<B, E, R>
} = dual(3, <A, E, R, S, B>(
  self: Stream<A, E, R>,
  initial: LazyArg<S>,
  f: (s: S, a: A) => readonly [state: S, values: ReadonlyArray<B>]
): Stream<B, E, R> =>
  fromChannel(Channel.mapAccum(self.channel, initial, (state, arr) => {
    const acc = Arr.empty<B>()
    for (let index = 0; index < arr.length; index++) {
      const [newState, values] = f(state, arr[index])
      state = newState
      // eslint-disable-next-line no-restricted-syntax
      acc.push(...values)
    }
    return [state, Arr.isArrayNonEmpty(acc) ? Arr.of(acc) : Arr.empty<Arr.NonEmptyReadonlyArray<B>>()]
  })))

/**
 * @since 2.0.0
 * @category sequencing
 */
export const mapAccumArray: {
  <S, A, B>(
    initial: LazyArg<S>,
    f: (s: S, a: Arr.NonEmptyReadonlyArray<A>) => readonly [state: S, values: ReadonlyArray<B>]
  ): <E, R>(self: Stream<A, E, R>) => Stream<B, E, R>
  <A, E, R, S, B>(
    self: Stream<A, E, R>,
    initial: LazyArg<S>,
    f: (s: S, a: Arr.NonEmptyReadonlyArray<A>) => readonly [state: S, values: ReadonlyArray<B>]
  ): Stream<B, E, R>
} = dual(3, <A, E, R, S, B>(
  self: Stream<A, E, R>,
  initial: LazyArg<S>,
  f: (s: S, a: Arr.NonEmptyReadonlyArray<A>) => readonly [state: S, values: ReadonlyArray<B>]
): Stream<B, E, R> =>
  fromChannel(Channel.mapAccum(self.channel, initial, (state, arr) => {
    const [newState, values] = f(state, arr)
    state = newState
    return [state, Arr.isReadonlyArrayNonEmpty(values) ? Arr.of(values) : emptyArr]
  })))

const emptyArr = Arr.empty<Arr.NonEmptyReadonlyArray<never>>()

/**
 * @since 2.0.0
 * @category sequencing
 */
export const mapAccumEffect: {
  <S, A, B, E2, R2>(
    initial: LazyArg<S>,
    f: (s: S, a: A) => Effect.Effect<readonly [state: S, values: ReadonlyArray<B>], E2, R2>
  ): <E, R>(self: Stream<A, E, R>) => Stream<B, E | E2, R | R2>
  <A, E, R, S, B, E2, R2>(
    self: Stream<A, E, R>,
    initial: LazyArg<S>,
    f: (s: S, a: A) => Effect.Effect<readonly [state: S, values: ReadonlyArray<B>], E2, R2>
  ): Stream<B, E | E2, R | R2>
} = dual(3, <A, E, R, S, B, E2, R2>(
  self: Stream<A, E, R>,
  initial: LazyArg<S>,
  f: (s: S, a: A) => Effect.Effect<readonly [state: S, values: ReadonlyArray<B>], E2, R2>
): Stream<B, E | E2, R | R2> =>
  self.channel.pipe(
    Channel.flattenArray,
    Channel.mapAccum(initial, (state, a) =>
      Effect.map(
        f(state, a),
        ([state, values]) => [
          state,
          Arr.isReadonlyArrayNonEmpty(values) ? Arr.of(values) : Arr.empty<Arr.NonEmptyReadonlyArray<B>>()
        ]
      )),
    fromChannel
  ))

/**
 * @since 2.0.0
 * @category sequencing
 */
export const mapAccumArrayEffect: {
  <S, A, B, E2, R2>(
    initial: LazyArg<S>,
    f: (s: S, a: Arr.NonEmptyReadonlyArray<A>) => Effect.Effect<readonly [state: S, values: ReadonlyArray<B>], E2, R2>
  ): <E, R>(self: Stream<A, E, R>) => Stream<B, E | E2, R | R2>
  <A, E, R, S, B, E2, R2>(
    self: Stream<A, E, R>,
    initial: LazyArg<S>,
    f: (s: S, a: Arr.NonEmptyReadonlyArray<A>) => Effect.Effect<readonly [state: S, values: ReadonlyArray<B>], E2, R2>
  ): Stream<B, E | E2, R | R2>
} = dual(3, <A, E, R, S, B, E2, R2>(
  self: Stream<A, E, R>,
  initial: LazyArg<S>,
  f: (s: S, a: Arr.NonEmptyReadonlyArray<A>) => Effect.Effect<readonly [state: S, values: ReadonlyArray<B>], E2, R2>
): Stream<B, E | E2, R | R2> =>
  self.channel.pipe(
    Channel.mapAccum(initial, (state, a) =>
      Effect.map(
        f(state, a),
        ([state, values]) => [
          state,
          Arr.isReadonlyArrayNonEmpty(values) ? Arr.of(values) : emptyArr
        ]
      )),
    fromChannel
  ))

/**
 * @since 2.0.0
 * @category sequencing
 */
export const scan: {
  <S, A>(
    initial: S,
    f: (s: S, a: A) => S
  ): <E, R>(self: Stream<A, E, R>) => Stream<S, E, R>
  <A, E, R, S>(
    self: Stream<A, E, R>,
    initial: S,
    f: (s: S, a: A) => S
  ): Stream<S, E, R>
} = dual(3, <A, E, R, S>(
  self: Stream<A, E, R>,
  initial: S,
  f: (s: S, a: A) => S
): Stream<S, E, R> =>
  suspend(() => {
    let isFirst = true
    return fromChannel(Channel.mapAccum(self.channel, constant(initial), (state, arr) => {
      const states = Arr.empty<S>() as Arr.NonEmptyArray<S>
      if (isFirst) {
        isFirst = false
        states.push(state)
      }
      for (let index = 0; index < arr.length; index++) {
        state = f(state, arr[index])
        states.push(state)
      }
      return [state, Arr.of(states)]
    }))
  }))

/**
 * @since 2.0.0
 * @category sequencing
 */
export const scanEffect: {
  <S, A, E2, R2>(
    initial: S,
    f: (s: S, a: A) => Effect.Effect<S, E2, R2>
  ): <E, R>(self: Stream<A, E, R>) => Stream<S, E | E2, R | R2>
  <A, E, R, S, E2, R2>(
    self: Stream<A, E, R>,
    initial: S,
    f: (s: S, a: A) => Effect.Effect<S, E2, R2>
  ): Stream<S, E | E2, R | R2>
} = dual(3, <A, E, R, S, E2, R2>(
  self: Stream<A, E, R>,
  initial: S,
  f: (s: S, a: A) => Effect.Effect<S, E2, R2>
): Stream<S, E | E2, R | R2> =>
  self.channel.pipe(
    Channel.flattenArray,
    Channel.scanEffect(initial, f),
    Channel.map(Arr.of),
    fromChannel
  ))

/**
 * @since 2.0.0
 * @category Grouping
 */
export const grouped: {
  (n: number): <A, E, R>(self: Stream<A, E, R>) => Stream<Arr.NonEmptyReadonlyArray<A>, E, R>
  <A, E, R>(self: Stream<A, E, R>, n: number): Stream<Arr.NonEmptyReadonlyArray<A>, E, R>
} = dual(
  2,
  <A, E, R>(self: Stream<A, E, R>, n: number): Stream<Arr.NonEmptyReadonlyArray<A>, E, R> => chunks(rechunk(self, n))
)

/**
 * @since 2.0.0
 * @category Grouping
 */
export const groupBy: {
  <A, K, V, E2, R2>(
    f: (a: NoInfer<A>) => Effect.Effect<readonly [K, V], E2, R2>,
    options?: {
      readonly bufferSize?: number | undefined
      readonly idleTimeToLive?: Duration.DurationInput | undefined
    }
  ): <E, R>(self: Stream<A, E, R>) => Stream<readonly [K, Stream<V>], E | E2, R | R2>
  <A, E, R, K, V, E2, R2>(
    self: Stream<A, E, R>,
    f: (a: NoInfer<A>) => Effect.Effect<readonly [K, V], E2, R2>,
    options?: {
      readonly bufferSize?: number | undefined
      readonly idleTimeToLive?: Duration.DurationInput | undefined
    }
  ): Stream<readonly [K, Stream<V>], E | E2, R | R2>
} = dual((args) => isStream(args[0]), <A, E, R, K, V, E2, R2>(
  self: Stream<A, E, R>,
  f: (a: NoInfer<A>) => Effect.Effect<readonly [K, V], E2, R2>,
  options?: {
    readonly bufferSize?: number | undefined
    readonly idleTimeToLive?: Duration.DurationInput | undefined
  }
): Stream<readonly [K, Stream<V>], E | E2, R | R2> =>
  groupByImpl(
    self,
    Effect.fnUntraced(function*(arr, queues, queueMap) {
      for (let i = 0; i < arr.length; i++) {
        const [key, value] = yield* f(arr[i])
        const oentry = MutableHashMap.get(queueMap, key)
        const queue = Option.isSome(oentry)
          ? oentry.value
          : yield* Effect.scoped(RcMap.get(queues, key))
        yield* RcMap.touch(queues, key)
        yield* Queue.offer(queue, value)
      }
    }),
    options
  ))

/**
 * @since 2.0.0
 * @category Grouping
 */
export const groupByKey: {
  <A, K>(
    f: (a: NoInfer<A>) => K,
    options?: {
      readonly bufferSize?: number | undefined
      readonly idleTimeToLive?: Duration.DurationInput | undefined
    }
  ): <E, R>(self: Stream<A, E, R>) => Stream<readonly [K, Stream<A>], E, R>
  <A, E, R, K>(
    self: Stream<A, E, R>,
    f: (a: NoInfer<A>) => K,
    options?: {
      readonly bufferSize?: number | undefined
      readonly idleTimeToLive?: Duration.DurationInput | undefined
    }
  ): Stream<readonly [K, Stream<A>], E, R>
} = dual((args) => isStream(args[0]), <A, E, R, K>(
  self: Stream<A, E, R>,
  f: (a: NoInfer<A>) => K,
  options?: {
    readonly bufferSize?: number | undefined
    readonly idleTimeToLive?: Duration.DurationInput | undefined
  }
): Stream<readonly [K, Stream<A>], E, R> =>
  suspend(() => {
    const batch = MutableHashMap.empty<K, Arr.NonEmptyArray<A>>()
    return groupByImpl(
      self,
      Effect.fnUntraced(function*(arr, queues, queueMap) {
        for (let i = 0; i < arr.length; i++) {
          const key = f(arr[i])
          const ovalues = MutableHashMap.get(batch, key)
          if (Option.isNone(ovalues)) {
            MutableHashMap.set(batch, key, [arr[i]])
          } else {
            ovalues.value.push(arr[i])
          }
        }
        for (const [key, values] of batch) {
          const oentry = MutableHashMap.get(queueMap, key)
          const queue = Option.isSome(oentry)
            ? oentry.value
            : yield* Effect.scoped(RcMap.get(queues, key))
          yield* RcMap.touch(queues, key)
          yield* Queue.offerAll(queue, values)
        }
        MutableHashMap.clear(batch)
      }),
      options
    )
  }))

const groupByImpl = <A, E, R, K, V, E2, R2>(
  self: Stream<A, E, R>,
  f: (
    arr: Arr.NonEmptyReadonlyArray<A>,
    queues: RcMap.RcMap<K, Queue.Queue<V, Queue.Done>>,
    queueMap: MutableHashMap.MutableHashMap<K, Queue.Queue<V, Queue.Done>>
  ) => Effect.Effect<void, E2, R2>,
  options?: {
    readonly bufferSize?: number | undefined
    readonly idleTimeToLive?: Duration.DurationInput | undefined
  }
): Stream<readonly [K, Stream<V>], E | E2, R | R2> =>
  transformPullBracket(
    self,
    Effect.fnUntraced(function*(pull, scope, forkedScope) {
      const out = yield* Queue.unbounded<readonly [K, Stream<V>], E | E2 | Pull.Halt<void>>()
      yield* Scope.addFinalizer(scope, Queue.shutdown(out))

      const queueMap = MutableHashMap.empty<K, Queue.Queue<V, Queue.Done>>()
      const queues = yield* RcMap.make({
        lookup: (key: K) =>
          Effect.acquireRelease(
            Queue.make<V, Queue.Done>({ capacity: options?.bufferSize ?? 4096 }).pipe(
              Effect.tap((queue) => {
                MutableHashMap.set(queueMap, key, queue)
                return Queue.offer(out, [key, fromQueue(queue)])
              })
            ),
            (queue) => {
              MutableHashMap.remove(queueMap, key)
              return Queue.end(queue)
            }
          ),
        idleTimeToLive: options?.idleTimeToLive ?? Duration.infinity
      }).pipe(Scope.provide(forkedScope))

      yield* Effect.whileLoop({
        while: constTrue,
        body: constant(Effect.flatMap(pull, (arr) => f(arr, queues, queueMap))),
        step: constVoid
      }).pipe(
        Queue.into(out),
        Effect.forkIn(scope)
      )

      return Queue.toPullArray(out)
    })
  )

/**
 * @since 2.0.0
 * @category Grouping
 */
export const groupAdjacentBy: {
  <A, K>(
    f: (a: NoInfer<A>) => K
  ): <E, R>(self: Stream<A, E, R>) => Stream<readonly [K, Arr.NonEmptyArray<A>], E, R>
  <A, E, R, K>(
    self: Stream<A, E, R>,
    f: (a: NoInfer<A>) => K
  ): Stream<readonly [K, Arr.NonEmptyArray<A>], E, R>
} = dual(2, <A, E, R, K>(
  self: Stream<A, E, R>,
  f: (a: NoInfer<A>) => K
): Stream<readonly [K, Arr.NonEmptyArray<A>], E, R> =>
  transformPull(self, (pull, _scope) =>
    Effect.sync(() => {
      let currentKey: K = undefined as any
      let group: Arr.NonEmptyArray<A> | undefined
      let toEmit = Arr.empty<readonly [K, Arr.NonEmptyArray<A>]>()
      const loop: Pull.Pull<
        Arr.NonEmptyReadonlyArray<readonly [K, Arr.NonEmptyArray<A>]>,
        E
      > = pull.pipe(
        Effect.flatMap((chunk) => {
          for (let i = 0; i < chunk.length; i++) {
            const item = chunk[i]
            const key = f(item)
            if (group === undefined) {
              currentKey = key
              group = [item]
              continue
            } else if (Equal.equals(key, currentKey)) {
              group.push(item)
              continue
            }
            toEmit.push([currentKey, group])
            currentKey = key
            group = [item]
          }
          if (Arr.isArrayNonEmpty(toEmit)) {
            const out = toEmit
            toEmit = []
            return Effect.succeed(out)
          }
          return loop
        })
      )
      let done = false
      return Pull.catchHalt(Effect.suspend(() => done ? Pull.haltVoid : loop), () => {
        done = true
        const out = group
        group = undefined
        return out && Arr.isArrayNonEmpty(out) ? Effect.succeed(Arr.of([currentKey, out])) : Pull.haltVoid
      })
    })))

/**
 * Applies the Sink transducer to the stream and emits its outputs.
 *
 * @since 2.0.0
 * @category utils
 */
export const transduce = dual<
  <A2, A, E2, R2>(
    sink: Sink.Sink<A2, A, A, E2, R2>
  ) => <E, R>(self: Stream<A, E, R>) => Stream<A2, E2 | E, R2 | R>,
  <A, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    sink: Sink.Sink<A2, A, A, E2, R2>
  ) => Stream<A2, E2 | E, R2 | R>
>(
  2,
  <A, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    sink: Sink.Sink<A2, A, A, E2, R2>
  ): Stream<A2, E2 | E, R2 | R> =>
    transformPull(self, (upstream, scope) =>
      Effect.sync(() => {
        let done: Exit.Exit<never, Pull.Halt<void> | E> | undefined
        let leftover: Arr.NonEmptyReadonlyArray<A> | undefined
        const upstreamWithLeftover = Effect.suspend(() => {
          if (leftover !== undefined) {
            const chunk = leftover
            leftover = undefined
            return Effect.succeed(chunk)
          }
          return upstream
        }).pipe(
          Effect.catch((error) => {
            done = Exit.fail(error)
            return Pull.haltVoid
          })
        )
        const pull = Effect.flatMap(
          Effect.suspend(() => Channel.toTransform(sink.channel)(upstreamWithLeftover, scope)),
          (pull) =>
            Pull.catchHalt(pull, (end_) => {
              const [value, leftover_] = end_ as Sink.End<A2, A>
              leftover = leftover_
              return Effect.succeed(Arr.of(value))
            })
        )
        return Effect.suspend((): Pull.Pull<
          Arr.NonEmptyReadonlyArray<A2>,
          E | E2,
          void,
          R2
        > => done ? done : pull)
      }))
)

/**
 * @since 2.0.0
 * @category Broadcast
 */
export const broadcast: {
  (
    options: {
      readonly capacity: "unbounded"
      readonly replay?: number | undefined
    } | {
      readonly capacity: number
      readonly strategy?: "sliding" | "dropping" | "suspend" | undefined
      readonly replay?: number | undefined
    }
  ): <A, E, R>(self: Stream<A, E, R>) => Effect.Effect<Stream<A, E>, never, Scope.Scope | R>
  <A, E, R>(
    self: Stream<A, E, R>,
    options: {
      readonly capacity: "unbounded"
      readonly replay?: number | undefined
    } | {
      readonly capacity: number
      readonly strategy?: "sliding" | "dropping" | "suspend" | undefined
      readonly replay?: number | undefined
    }
  ): Effect.Effect<Stream<A, E>, never, Scope.Scope | R>
} = dual(2, <A, E, R>(
  self: Stream<A, E, R>,
  options: {
    readonly capacity: "unbounded"
    readonly replay?: number | undefined
  } | {
    readonly capacity: number
    readonly strategy?: "sliding" | "dropping" | "suspend" | undefined
    readonly replay?: number | undefined
  }
): Effect.Effect<Stream<A, E>, never, Scope.Scope | R> => Effect.map(toPubSubTake(self, options), fromPubSubTake))

/**
 * @since 2.0.0
 * @category Broadcast
 */
export const share: {
  (
    options: {
      readonly capacity: "unbounded"
      readonly replay?: number | undefined
      readonly idleTimeToLive?: Duration.DurationInput | undefined
    } | {
      readonly capacity: number
      readonly strategy?: "sliding" | "dropping" | "suspend" | undefined
      readonly replay?: number | undefined
      readonly idleTimeToLive?: Duration.DurationInput | undefined
    }
  ): <A, E, R>(self: Stream<A, E, R>) => Effect.Effect<Stream<A, E>, never, Scope.Scope | R>
  <A, E, R>(
    self: Stream<A, E, R>,
    options: {
      readonly capacity: "unbounded"
      readonly replay?: number | undefined
      readonly idleTimeToLive?: Duration.DurationInput | undefined
    } | {
      readonly capacity: number
      readonly strategy?: "sliding" | "dropping" | "suspend" | undefined
      readonly replay?: number | undefined
      readonly idleTimeToLive?: Duration.DurationInput | undefined
    }
  ): Effect.Effect<Stream<A, E>, never, Scope.Scope | R>
} = dual(2, <A, E, R>(
  self: Stream<A, E, R>,
  options: {
    readonly capacity: "unbounded"
    readonly replay?: number | undefined
    readonly idleTimeToLive?: Duration.DurationInput | undefined
  } | {
    readonly capacity: number
    readonly strategy?: "sliding" | "dropping" | "suspend" | undefined
    readonly replay?: number | undefined
    readonly idleTimeToLive?: Duration.DurationInput | undefined
  }
): Effect.Effect<Stream<A, E>, never, Scope.Scope | R> =>
  Effect.map(
    RcRef.make({
      acquire: broadcast(self, options),
      idleTimeToLive: options.idleTimeToLive
    }),
    (ref) => unwrap(RcRef.get(ref))
  ))

/**
 * Pipes all the values from this stream through the provided channel.
 *
 * The channel processes chunks of values (NonEmptyReadonlyArray) and can transform both
 * the values and error types. Any errors from the original stream are handled by the channel.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Stream, Channel } from "effect/stream"
 * import { Console } from "effect"
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
 * import { Effect } from "effect"
 * import { Stream, Channel } from "effect/stream"
 * import { Console } from "effect"
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
 * import { Effect } from "effect"
 * import { Stream, Channel } from "effect/stream"
 * import { Console } from "effect"
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
 * import { Effect } from "effect"
 * import { Stream, Channel } from "effect/stream"
 * import { Console } from "effect"
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
 * @since 2.0.0
 * @category accumulation
 */
export const collect = <A, E, R>(self: Stream<A, E, R>): Stream<Array<A>, E, R> => fromEffect(runCollect(self))

/**
 * @since 2.0.0
 * @category accumulation
 */
export const accumulate = <A, E, R>(self: Stream<A, E, R>): Stream<Arr.NonEmptyArray<A>, E, R> =>
  mapAccumArray(self, Arr.empty<A>, (acc, as) => {
    const combined = Arr.appendAll(acc, as)
    return [combined, [combined]]
  })

/**
 * Decode Uint8Array chunks into a stream of strings using the specified encoding.
 *
 * @example
 * ```ts
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * const encoder = new TextEncoder()
 * const stream = Stream.make(
 *   encoder.encode("Hello"),
 *   encoder.encode(" World")
 * )
 * const decoded = Stream.decodeText(stream)
 *
 * Effect.runPromise(Stream.runCollect(decoded)).then(console.log)
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * const stream = Stream.make("Hello", " ", "World")
 * const encoded = Stream.encodeText(stream)
 *
 * Effect.runPromise(Stream.runCollect(encoded)).then(console.log)
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
 * @since 2.0.0
 * @category encoding
 */
export const splitLines = <E, R>(self: Stream<string, E, R>): Stream<string, E, R> =>
  self.channel.pipe(
    Channel.pipeTo(Channel.splitLines()),
    fromChannel
  )

/**
 * Executes the provided finalizer after this stream's finalizers run.
 *
 * @example
 * ```ts
 * import { Effect, Exit } from "effect"
 * import { Console } from "effect"
 * import { Stream } from "effect/stream"
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
export const onStart: {
  <X, EX, RX>(
    onStart: Effect.Effect<X, EX, RX>
  ): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E | EX, R | RX>
  <A, E, R, X, EX, RX>(
    self: Stream<A, E, R>,
    onStart: Effect.Effect<X, EX, RX>
  ): Stream<A, E | EX, R | RX>
} = dual(2, <A, E, R, X, EX, RX>(
  self: Stream<A, E, R>,
  onStart: Effect.Effect<X, EX, RX>
): Stream<A, E | EX, R | RX> => fromChannel(Channel.onStart(self.channel, onStart)))

/**
 * @since 4.0.0
 * @category utils
 */
export const onEnd: {
  <X, EX, RX>(
    onEnd: Effect.Effect<X, EX, RX>
  ): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E | EX, R | RX>
  <A, E, R, X, EX, RX>(
    self: Stream<A, E, R>,
    onEnd: Effect.Effect<X, EX, RX>
  ): Stream<A, E | EX, R | RX>
} = dual(2, <A, E, R, X, EX, RX>(
  self: Stream<A, E, R>,
  onEnd: Effect.Effect<X, EX, RX>
): Stream<A, E | EX, R | RX> => fromChannel(Channel.onEnd(self.channel, onEnd)))

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
 * @since 4.0.0
 * @category Services
 */
export const provide: {
  <AL, EL = never, RL = never>(
    layer: Layer.Layer<AL, EL, RL> | ServiceMap.ServiceMap<AL>
  ): <A, E, R>(
    self: Stream<A, E, R>
  ) => Stream<A, E | EL, Exclude<R, AL> | RL>
  <A, E, R, AL, EL = never, RL = never>(
    self: Stream<A, E, R>,
    layer: Layer.Layer<AL, EL, RL> | ServiceMap.ServiceMap<AL>
  ): Stream<A, E | EL, Exclude<R, AL> | RL>
} = dual(2, <A, E, R, AL, EL = never, RL = never>(
  self: Stream<A, E, R>,
  layer: Layer.Layer<AL, EL, RL> | ServiceMap.ServiceMap<AL>
): Stream<A, E | EL, Exclude<R, AL> | RL> => fromChannel(Channel.provide(self.channel, layer)))

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
 * @since 4.0.0
 * @category Services
 */
export const provideService: {
  <I, S>(
    key: ServiceMap.Service<I, S>,
    service: NoInfer<S>
  ): <A, E, R>(
    self: Stream<A, E, R>
  ) => Stream<A, E, Exclude<R, I>>
  <A, E, R, I, S>(
    self: Stream<A, E, R>,
    key: ServiceMap.Service<I, S>,
    service: NoInfer<S>
  ): Stream<A, E, Exclude<R, I>>
} = dual(3, <A, E, R, I, S>(
  self: Stream<A, E, R>,
  key: ServiceMap.Service<I, S>,
  service: NoInfer<S>
): Stream<A, E, Exclude<R, I>> => fromChannel(Channel.provideService(self.channel, key, service)))

/**
 * @since 4.0.0
 * @category Services
 */
export const provideServiceEffect: {
  <I, S, ES, RS>(
    key: ServiceMap.Service<I, S>,
    service: Effect.Effect<NoInfer<S>, ES, RS>
  ): <A, E, R>(
    self: Stream<A, E, R>
  ) => Stream<A, E | ES, Exclude<R, I> | RS>
  <A, E, R, I, S, ES, RS>(
    self: Stream<A, E, R>,
    key: ServiceMap.Service<I, S>,
    service: Effect.Effect<NoInfer<S>, ES, RS>
  ): Stream<A, E | ES, Exclude<R, I> | RS>
} = dual(3, <A, E, R, I, S, ES, RS>(
  self: Stream<A, E, R>,
  key: ServiceMap.Service<I, S>,
  service: Effect.Effect<NoInfer<S>, ES, RS>
): Stream<A, E | ES, Exclude<R, I> | RS> => fromChannel(Channel.provideServiceEffect(self.channel, key, service)))

/**
 * @since 2.0.0
 * @category Services
 */
export const updateServices: {
  <R, R2>(
    f: (services: ServiceMap.ServiceMap<R2>) => ServiceMap.ServiceMap<R>
  ): <A, E>(
    self: Stream<A, E, R>
  ) => Stream<A, E, R2>
  <A, E, R, R2>(
    self: Stream<A, E, R>,
    f: (services: ServiceMap.ServiceMap<R2>) => ServiceMap.ServiceMap<R>
  ): Stream<A, E, R2>
} = dual(2, <A, E, R, R2>(
  self: Stream<A, E, R>,
  f: (services: ServiceMap.ServiceMap<R2>) => ServiceMap.ServiceMap<R>
): Stream<A, E, R2> => fromChannel(Channel.updateServices(self.channel, f)))

/**
 * @since 2.0.0
 * @category Services
 */
export const updateService: {
  <I, S>(
    key: ServiceMap.Service<I, S>,
    f: (service: NoInfer<S>) => S
  ): <A, E, R>(
    self: Stream<A, E, R>
  ) => Stream<A, E, R | I>
  <A, E, R, I, S>(
    self: Stream<A, E, R>,
    key: ServiceMap.Service<I, S>,
    f: (service: NoInfer<S>) => S
  ): Stream<A, E, R | I>
} = dual(3, <A, E, R, I, S>(
  self: Stream<A, E, R>,
  service: ServiceMap.Service<I, S>,
  f: (service: NoInfer<S>) => S
): Stream<A, E, R | I> =>
  updateServices(self, (services) =>
    ServiceMap.add(
      services,
      service,
      f(ServiceMap.get(services, service))
    )))

/**
 * @since 4.0.0
 * @category Tracing
 */
export const withSpan: {
  (name: string, options?: SpanOptions): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E, Exclude<R, ParentSpan>>
  <A, E, R>(self: Stream<A, E, R>, name: string, options?: SpanOptions): Stream<A, E, Exclude<R, ParentSpan>>
} = dual(
  (args) => isStream(args[0]),
  <A, E, R>(self: Stream<A, E, R>, name: string, options?: SpanOptions): Stream<A, E, Exclude<R, ParentSpan>> =>
    fromChannel(Channel.withSpan(self.channel, name, options))
)

/**
 * @since 4.0.0
 * @category Do notation
 */
export const Do: Stream<{}> = succeed({})

const let_: {
  <N extends string, A extends object, B>(
    name: Exclude<N, keyof A>,
    f: (a: NoInfer<A>) => B
  ): <E, R>(self: Stream<A, E, R>) => Stream<{ [K in N | keyof A]: K extends keyof A ? A[K] : B }, E, R>
  <A extends object, E, R, N extends string, B>(
    self: Stream<A, E, R>,
    name: Exclude<N, keyof A>,
    f: (a: NoInfer<A>) => B
  ): Stream<{ [K in N | keyof A]: K extends keyof A ? A[K] : B }, E, R>
} = dual(3, <A extends object, E, R, N extends string, B>(
  self: Stream<A, E, R>,
  name: Exclude<N, keyof A>,
  f: (a: NoInfer<A>) => B
): Stream<{ [K in N | keyof A]: K extends keyof A ? A[K] : B }, E, R> =>
  map(self, (a) => ({ ...a, [name]: f(a) } as any)))
export {
  /**
   * @since 4.0.0
   * @category Do notation
   */
  let_ as let
}

/**
 * @since 4.0.0
 * @category Do notation
 */
export const bind: {
  <N extends string, A, B, E2, R2>(
    tag: Exclude<N, keyof A>,
    f: (_: NoInfer<A>) => Stream<B, E2, R2>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
    } | undefined
  ): <E, R>(self: Stream<A, E, R>) => Stream<{ [K in N | keyof A]: K extends keyof A ? A[K] : B }, E2 | E, R2 | R>
  <A, E, R, N extends string, B, E2, R2>(
    self: Stream<A, E, R>,
    tag: Exclude<N, keyof A>,
    f: (_: NoInfer<A>) => Stream<B, E2, R2>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
    } | undefined
  ): Stream<{ [K in N | keyof A]: K extends keyof A ? A[K] : B }, E | E2, R | R2>
} = dual((args) => isStream(args[0]), <A, E, R, N extends string, B, E2, R2>(
  self: Stream<A, E, R>,
  tag: Exclude<N, keyof A>,
  f: (_: NoInfer<A>) => Stream<B, E2, R2>,
  options?: {
    readonly concurrency?: number | "unbounded" | undefined
    readonly bufferSize?: number | undefined
  } | undefined
): Stream<{ [K in N | keyof A]: K extends keyof A ? A[K] : B }, E | E2, R | R2> =>
  flatMap(self, (a) => map(f(a), (b) => ({ ...a, [tag]: b } as any)), options))

/**
 * @category Do notation
 * @since 4.0.0
 */
export const bindEffect: {
  <N extends string, A, B, E2, R2>(
    tag: Exclude<N, keyof A>,
    f: (_: NoInfer<A>) => Effect.Effect<B, E2, R2>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
      readonly unordered?: boolean | undefined
    }
  ): <E, R>(self: Stream<A, E, R>) => Stream<{ [K in keyof A | N]: K extends keyof A ? A[K] : B }, E | E2, R | R2>
  <A, E, R, N extends string, B, E2, R2>(
    self: Stream<A, E, R>,
    tag: Exclude<N, keyof A>,
    f: (_: NoInfer<A>) => Effect.Effect<B, E2, R2>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
      readonly unordered?: boolean | undefined
    }
  ): Stream<{ [K in keyof A | N]: K extends keyof A ? A[K] : B }, E | E2, R | R2>
} = dual((args) => isStream(args[0]), <A, E, R, N extends string, B, E2, R2>(
  self: Stream<A, E, R>,
  tag: Exclude<N, keyof A>,
  f: (_: NoInfer<A>) => Effect.Effect<B, E2, R2>,
  options?: {
    readonly concurrency?: number | "unbounded" | undefined
    readonly bufferSize?: number | undefined
    readonly unordered?: boolean | undefined
  } | undefined
): Stream<{ [K in keyof A | N]: K extends keyof A ? A[K] : B }, E | E2, R | R2> =>
  mapEffect(self, (a) => Effect.map(f(a), (b) => ({ ...a, [tag]: b } as any)), options))

/**
 * @category Do notation
 * @since 4.0.0
 */
export const bindTo: {
  <N extends string>(name: N): <A, E, R>(self: Stream<A, E, R>) => Stream<{ [K in N]: A }, E, R>
  <A, E, R, N extends string>(self: Stream<A, E, R>, name: N): Stream<{ [K in N]: A }, E, R>
} = dual(2, <A, E, R, N extends string>(
  self: Stream<A, E, R>,
  name: N
): Stream<{ [K in N]: A }, E, R> => map(self, (a) => ({ [name]: a } as any)))

/**
 * Runs the sink on the stream to produce either the sink's result or an error.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Stream, Sink } from "effect/stream"
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
    Channel.runDrain,
    Effect.map(([a]) => a)
  ))

/**
 * Runs the stream and collects all of its elements to a chunk.
 *
 * @example
 * ```ts
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
 * @since 2.0.0
 * @category destructors
 */
export const runSum = <E, R>(self: Stream<number, E, R>): Effect.Effect<number, E, R> =>
  Channel.runFold(self.channel, () => 0, (acc, chunk) => {
    for (let i = 0; i < chunk.length; i++) {
      acc += chunk[i]
    }
    return acc
  })

/**
 * @since 2.0.0
 * @category destructors
 */
export const runFold: {
  <Z, A>(
    initial: LazyArg<Z>,
    f: (acc: Z, a: A) => Z
  ): <E, R>(
    self: Stream<A, E, R>
  ) => Effect.Effect<Z, E, R>
  <A, E, R, Z>(
    self: Stream<A, E, R>,
    initial: LazyArg<Z>,
    f: (acc: Z, a: A) => Z
  ): Effect.Effect<Z, E, R>
} = dual(3, <A, E, R, Z>(
  self: Stream<A, E, R>,
  initial: LazyArg<Z>,
  f: (acc: Z, a: A) => Z
): Effect.Effect<Z, E, R> =>
  Channel.runFold(self.channel, initial, (acc, arr) => {
    for (let i = 0; i < arr.length; i++) {
      acc = f(acc, arr[i])
    }
    return acc
  }))

/**
 * @since 2.0.0
 * @category destructors
 */
export const runFoldEffect: {
  <Z, A, EX, RX>(
    initial: LazyArg<Z>,
    f: (acc: Z, a: A) => Effect.Effect<Z, EX, RX>
  ): <E, R>(
    self: Stream<A, E, R>
  ) => Effect.Effect<Z, E | EX, R | RX>
  <A, E, R, Z, EX, RX>(
    self: Stream<A, E, R>,
    initial: LazyArg<Z>,
    f: (acc: Z, a: A) => Effect.Effect<Z, EX, RX>
  ): Effect.Effect<Z, E | EX, R | RX>
} = dual(3, <A, E, R, Z, EX, RX>(
  self: Stream<A, E, R>,
  initial: LazyArg<Z>,
  f: (acc: Z, a: A) => Effect.Effect<Z, EX, RX>
): Effect.Effect<Z, E | EX, R | RX> =>
  Channel.runFoldEffect(self.channel, initial, (acc, arr) => {
    let i = 0
    let s = acc
    return Effect.map(
      Effect.whileLoop({
        while: () => i < arr.length,
        body: () => f(s, arr[i]),
        step(z) {
          s = z
          i++
        }
      }),
      () => s
    )
  }))

/**
 * @since 2.0.0
 * @category destructors
 */
export const runHead = <A, E, R>(self: Stream<A, E, R>): Effect.Effect<Option.Option<A>, E, R> =>
  Effect.map(Channel.runHead(self.channel), Option.map(Arr.getUnsafe(0)))

/**
 * @since 2.0.0
 * @category destructors
 */
export const runLast = <A, E, R>(self: Stream<A, E, R>): Effect.Effect<Option.Option<A>, E, R> =>
  Effect.map(Channel.runLast(self.channel), Option.map(Arr.lastNonEmpty))

/**
 * Consumes all elements of the stream, passing them to the specified
 * callback.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Stream } from "effect/stream"
 * import { Console } from "effect"
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
): Effect.Effect<void, E | E2, R | R2> =>
  Channel.runForEach(self.channel, (arr) => {
    let i = 0
    return Effect.whileLoop({
      while: () => i < arr.length,
      body: () => f(arr[i++]),
      step: constVoid
    })
  }))

/**
 * @since 2.0.0
 * @category destructors
 */
export const runForEachWhile: {
  <A, E2, R2>(
    f: (a: A) => Effect.Effect<boolean, E2, R2>
  ): <E, R>(self: Stream<A, E, R>) => Effect.Effect<void, E2 | E, R2 | R>
  <A, E, R, E2, R2>(
    self: Stream<A, E, R>,
    f: (a: A) => Effect.Effect<boolean, E2, R2>
  ): Effect.Effect<void, E | E2, R | R2>
} = dual(2, <A, E, R, E2, R2>(
  self: Stream<A, E, R>,
  f: (a: A) => Effect.Effect<boolean, E2, R2>
): Effect.Effect<void, E | E2, R | R2> =>
  Channel.runForEachWhile(self.channel, (arr) => {
    let done = false
    let i = 0
    return Effect.map(
      Effect.whileLoop({
        while: () => !done && i < arr.length,
        body: () => f(arr[i]),
        step(b) {
          i++
          if (!b) done = true
        }
      }),
      () => done
    )
  }))

/**
 * Consumes all elements of the stream, passing them to the specified
 * callback.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Stream } from "effect/stream"
 * import { Console } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 * const result = Stream.runForEachArray(stream, (chunk) =>
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
export const runForEachArray: {
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
 * import { Effect } from "effect"
 * import { Stream } from "effect/stream"
 * import { Console } from "effect"
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 * import { Scope } from "effect"
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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
 * import { Stream } from "effect/stream"
 * import { ServiceMap } from "effect"
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
    const latch = Effect.makeLatchUnsafe(false)

    return new ReadableStream<A>({
      start(controller) {
        fiber = Effect.runFork(Effect.provideServices(
          runForEachArray(self, (chunk) =>
            latch.whenOpen(Effect.sync(() => {
              latch.closeUnsafe()
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
          latch.openUnsafe()
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
 * import { Stream } from "effect/stream"
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
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
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

/**
 * @since 2.0.0
 * @category destructors
 */
export const toAsyncIterableWith: {
  <XR>(services: ServiceMap.ServiceMap<XR>): <A, E, R extends XR>(self: Stream<A, E, R>) => AsyncIterable<A>
  <A, E, XR, R extends XR>(
    self: Stream<A, E, R>,
    services: ServiceMap.ServiceMap<XR>
  ): AsyncIterable<A>
} = dual(
  2,
  <A, E, XR, R extends XR>(
    self: Stream<A, E, R>,
    services: ServiceMap.ServiceMap<XR>
  ): AsyncIterable<A> => ({
    [Symbol.asyncIterator]() {
      const runPromise = Effect.runPromiseWith(services)
      const runPromiseExit = Effect.runPromiseExitWith(services)
      const scope = Scope.makeUnsafe()
      let pull: Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E, void, R> | undefined
      let currentIter: Iterator<A> | undefined
      return {
        async next(): Promise<IteratorResult<A>> {
          if (currentIter) {
            const next = currentIter.next()
            if (!next.done) return next
            currentIter = undefined
          }
          pull ??= await runPromise(Channel.toPullScoped(self.channel, scope))
          const exit = await runPromiseExit(pull)
          if (Exit.isSuccess(exit)) {
            currentIter = exit.value[Symbol.iterator]()
            return currentIter.next()
          } else if (Pull.isHaltCause(exit.cause)) {
            return { done: true, value: undefined }
          }
          throw Cause.squash(exit.cause)
        },
        return(_) {
          return runPromise(Effect.as(
            Scope.close(scope, Exit.void),
            { done: true, value: undefined }
          ))
        }
      }
    }
  })
)

/**
 * @since 2.0.0
 * @category destructors
 */
export const toAsyncIterableEffect = <A, E, R>(self: Stream<A, E, R>): Effect.Effect<AsyncIterable<A>, never, R> =>
  Effect.map(
    Effect.services<R>(),
    (services) => toAsyncIterableWith(self, services)
  )

/**
 * @since 2.0.0
 * @category destructors
 */
export const toAsyncIterable = <A, E>(self: Stream<A, E>): AsyncIterable<A> =>
  toAsyncIterableWith(self, ServiceMap.empty())

/**
 * @since 2.0.0
 * @category destructors
 */
export const runIntoPubSub: {
  <A>(
    pubsub: PubSub.PubSub<A>,
    options?: {
      readonly shutdownOnEnd?: boolean | undefined
    } | undefined
  ): <E, R>(self: Stream<A, E, R>) => Effect.Effect<void, E, R>
  <A, E, R>(
    self: Stream<A, E, R>,
    pubsub: PubSub.PubSub<A>,
    options?: {
      readonly shutdownOnEnd?: boolean | undefined
    } | undefined
  ): Effect.Effect<void, never, R>
} = dual((args) => isStream(args[0]), <A, E, R>(
  self: Stream<A, E, R>,
  pubsub: PubSub.PubSub<A>,
  options?: {
    readonly shutdownOnEnd?: boolean | undefined
  } | undefined
): Effect.Effect<void, E, R> => Channel.runIntoPubSubArray(self.channel, pubsub, options))

/**
 * @since 2.0.0
 * @category destructors
 */
export const toPubSub: {
  (
    options: {
      readonly capacity: "unbounded"
      readonly replay?: number | undefined
      readonly shutdownOnEnd?: boolean | undefined
    } | {
      readonly capacity: number
      readonly strategy?: "dropping" | "sliding" | "suspend" | undefined
      readonly replay?: number | undefined
      readonly shutdownOnEnd?: boolean | undefined
    }
  ): <A, E, R>(self: Stream<A, E, R>) => Effect.Effect<PubSub.PubSub<A>, never, R | Scope.Scope>
  <A, E, R>(
    self: Stream<A, E, R>,
    options: {
      readonly capacity: "unbounded"
      readonly replay?: number | undefined
      readonly shutdownOnEnd?: boolean | undefined
    } | {
      readonly capacity: number
      readonly strategy?: "dropping" | "sliding" | "suspend" | undefined
      readonly replay?: number | undefined
      readonly shutdownOnEnd?: boolean | undefined
    }
  ): Effect.Effect<PubSub.PubSub<A>, never, R | Scope.Scope>
} = dual(
  2,
  <A, E, R>(
    self: Stream<A, E, R>,
    options: {
      readonly capacity: "unbounded"
      readonly replay?: number | undefined
      readonly shutdownOnEnd?: boolean | undefined
    } | {
      readonly capacity: number
      readonly strategy?: "dropping" | "sliding" | "suspend" | undefined
      readonly replay?: number | undefined
      readonly shutdownOnEnd?: boolean | undefined
    }
  ): Effect.Effect<PubSub.PubSub<A>, never, R | Scope.Scope> => Channel.toPubSubArray(self.channel, options)
)

/**
 * @since 4.0.0
 * @category destructors
 */
export const toPubSubTake: {
  (
    options: {
      readonly capacity: "unbounded"
      readonly replay?: number | undefined
    } | {
      readonly capacity: number
      readonly strategy?: "dropping" | "sliding" | "suspend" | undefined
      readonly replay?: number | undefined
    }
  ): <A, E, R>(self: Stream<A, E, R>) => Effect.Effect<PubSub.PubSub<Take.Take<A, E>>, never, R | Scope.Scope>
  <A, E, R>(
    self: Stream<A, E, R>,
    options: {
      readonly capacity: "unbounded"
      readonly replay?: number | undefined
    } | {
      readonly capacity: number
      readonly strategy?: "dropping" | "sliding" | "suspend" | undefined
      readonly replay?: number | undefined
    }
  ): Effect.Effect<PubSub.PubSub<Take.Take<A, E>>, never, R | Scope.Scope>
} = dual(
  2,
  <A, E, R>(
    self: Stream<A, E, R>,
    options: {
      readonly capacity: "unbounded"
      readonly replay?: number | undefined
    } | {
      readonly capacity: number
      readonly strategy?: "dropping" | "sliding" | "suspend" | undefined
      readonly replay?: number | undefined
    }
  ): Effect.Effect<PubSub.PubSub<Take.Take<A, E>>, never, R | Scope.Scope> =>
    Channel.toPubSubTake(self.channel, options)
)

/**
 * @since 2.0.0
 * @category destructors
 */
export const toQueue: {
  (
    options: {
      readonly capacity: "unbounded"
    } | {
      readonly capacity: number
      readonly strategy?: "dropping" | "sliding" | "suspend" | undefined
    }
  ): <A, E, R>(self: Stream<A, E, R>) => Effect.Effect<Queue.Dequeue<A, E | Queue.Done>, never, R | Scope.Scope>
  <A, E, R>(
    self: Stream<A, E, R>,
    options: {
      readonly capacity: "unbounded"
    } | {
      readonly capacity: number
      readonly strategy?: "dropping" | "sliding" | "suspend" | undefined
    }
  ): Effect.Effect<PubSub.PubSub<A>, never, R | Scope.Scope>
} = dual(
  2,
  <A, E, R>(
    self: Stream<A, E, R>,
    options: {
      readonly capacity: "unbounded"
      readonly replay?: number | undefined
      readonly shutdownOnEnd?: boolean | undefined
    } | {
      readonly capacity: number
      readonly strategy?: "dropping" | "sliding" | "suspend" | undefined
      readonly replay?: number | undefined
      readonly shutdownOnEnd?: boolean | undefined
    }
  ): Effect.Effect<PubSub.PubSub<A>, never, R | Scope.Scope> => Channel.toPubSubArray(self.channel, options)
)

/**
 * @since 2.0.0
 * @category destructors
 */
export const runIntoQueue: {
  <A, E>(queue: Queue.Queue<A, E | Queue.Done>): <R>(self: Stream<A, E, R>) => Effect.Effect<void, never, R>
  <A, E, R>(self: Stream<A, E, R>, queue: Queue.Queue<A, E | Queue.Done>): Effect.Effect<void, never, R>
} = dual(2, <A, E, R>(
  self: Stream<A, E, R>,
  queue: Queue.Queue<A, E | Queue.Done>
): Effect.Effect<void, never, R> => Channel.runIntoQueueArray(self.channel, queue))
