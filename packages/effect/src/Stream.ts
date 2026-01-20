/**
 * @since 2.0.0
 */
// @effect-diagnostics returnEffectInGen:off
import * as Arr from "./Array.ts"
import * as Cause from "./Cause.ts"
import * as Channel from "./Channel.ts"
import { Clock } from "./Clock.ts"
import * as Duration from "./Duration.ts"
import * as Effect from "./Effect.ts"
import * as Equal from "./Equal.ts"
import * as ExecutionPlan from "./ExecutionPlan.ts"
import * as Exit from "./Exit.ts"
import * as Fiber from "./Fiber.ts"
import * as Filter from "./Filter.ts"
import type { LazyArg } from "./Function.ts"
import { constant, constTrue, constVoid, dual, identity } from "./Function.ts"
import type { TypeLambda } from "./HKT.ts"
import * as internalExecutionPlan from "./internal/executionPlan.ts"
import * as internal from "./internal/stream.ts"
import { addSpanStackTrace } from "./internal/tracer.ts"
import * as Iterable from "./Iterable.ts"
import type * as Layer from "./Layer.ts"
import * as MutableHashMap from "./MutableHashMap.ts"
import * as MutableList from "./MutableList.ts"
import * as Option from "./Option.ts"
import type { Pipeable } from "./Pipeable.ts"
import type { Predicate, Refinement } from "./Predicate.ts"
import { hasProperty, isNotUndefined, isTagged } from "./Predicate.ts"
import type * as PubSub from "./PubSub.ts"
import * as Pull from "./Pull.ts"
import * as Queue from "./Queue.ts"
import * as RcMap from "./RcMap.ts"
import * as RcRef from "./RcRef.ts"
import * as Result from "./Result.ts"
import * as Schedule from "./Schedule.ts"
import * as Scope from "./Scope.ts"
import * as ServiceMap from "./ServiceMap.ts"
import * as Sink from "./Sink.ts"
import { isString } from "./String.ts"
import type * as Take from "./Take.ts"
import type { ParentSpan, SpanOptions } from "./Tracer.ts"
import type { Covariant, ExcludeTag, ExtractTag, NoInfer, Tags } from "./Types.ts"
import type * as Unify from "./Unify.ts"

const TypeId = "~effect/Stream"

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
 *   Stream.map((n) => n * 2),
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
 * import { Effect, Stream } from "effect"
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
 * import type * as Stream from "effect/Stream"
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
 * import type { Stream } from "effect"
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
 * import type { Stream } from "effect"
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
 * import type { Stream } from "effect"
 *
 * interface Database {
 *   query: (sql: string) => unknown
 * }
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
 * console.log(Stream.isStream(stream)) // true
 * console.log(Stream.isStream(notStream)) // false
 * ```
 *
 * @since 2.0.0
 * @category guards
 */
export const isStream = (u: unknown): u is Stream<unknown, unknown, unknown> => hasProperty(u, TypeId)

/**
 * The default chunk size used by streams for batching operations.
 *
 * @example
 * ```ts
 * import { Stream } from "effect"
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
 * import { Channel, Stream } from "effect"
 *
 * const myChannel = Channel.succeed([1, 2, 3] as const)
 * const stream = Stream.fromChannel(myChannel)
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromChannel: <Arr extends Arr.NonEmptyReadonlyArray<any>, E, R>(
  channel: Channel.Channel<Arr, E, void, unknown, unknown, unknown, R>
) => Stream<Arr extends Arr.NonEmptyReadonlyArray<infer A> ? A : never, E, R> = internal.fromChannel

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
  fromPull(Effect.succeed(Effect.flatMap(effect, () => Cause.done())))

/**
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Stream.repeatEffect`
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromEffectRepeat = <A, E, R>(effect: Effect.Effect<A, E, R>): Stream<A, Pull.ExcludeDone<E>, R> =>
  fromPull(Effect.succeed(Effect.map(effect, Arr.of)))

/**
 * Creates a stream from an effect producing a value of type `A`, which is
 * repeated using the specified schedule.
 *
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Stream.repeatEffectWithSchedule`
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromEffectSchedule = <A, E, R, X, AS extends A, ES, RS>(
  effect: Effect.Effect<A, E, R>,
  schedule: Schedule.Schedule<X, AS, ES, RS>
): Stream<A, E | ES, R | RS> =>
  fromPull(Effect.gen(function*() {
    const step = yield* Schedule.toStepWithMetadata(schedule)
    let s = yield* Effect.provideService(effect, Schedule.CurrentMetadata, Schedule.CurrentMetadata.defaultValue())
    let initial = true
    const pull = Effect.suspend(() => step(s as AS)).pipe(
      Effect.flatMap((meta) => Effect.provideService(effect, Schedule.CurrentMetadata, meta)),
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
 * A stream that emits void values spaced by the specified duration.
 *
 * @since 2.0.0
 * @category constructors
 */
export const tick = (interval: Duration.DurationInput): Stream<void> =>
  fromPull(Effect.sync(() => {
    let first = true
    const effect = Effect.succeed(Arr.of<void>(undefined))
    const delayed = Effect.delay(effect, interval)
    return Effect.suspend(() => {
      if (first) {
        first = false
        return effect
      }
      return delayed
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
 * import { Effect, Stream } from "effect"
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
): Stream<A, Pull.ExcludeDone<E> | EX, R | RX> => fromChannel(Channel.fromPull(pull))

/**
 * Derive a Stream from a pull effect.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
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
): Stream<B, EX | Pull.ExcludeDone<E2>, R | R2 | RX> =>
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
): Stream<B, EX | Pull.ExcludeDone<E2>, R | R2 | RX> =>
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
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Stream.async`
 * - `Stream.asyncEffect`
 * - `Stream.asyncPush`
 * - `Stream.asyncScoped`
 *
 * @example
 * ```ts
 * import { Effect, Queue, Stream } from "effect"
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
  f: (queue: Queue.Queue<A, E | Cause.Done>) => void | Effect.Effect<unknown, E, R | Scope.Scope>,
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
 * import { Stream } from "effect"
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
 * import { Effect, Stream } from "effect"
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
 * import { Effect, Stream } from "effect"
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
 * import { Effect, Stream } from "effect"
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
 * import { Cause, Effect, Stream } from "effect"
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
 * import { Cause, Effect, Stream } from "effect"
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
 * import { Effect, Stream } from "effect"
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
 * import { Stream } from "effect"
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
): Stream<A, Pull.ExcludeDone<E>, R> => flatMap(fromEffectRepeat(iterable), fromIterable)

/**
 * Creates a stream from an array.
 *
 * This function creates a Stream that emits all values from the provided array.
 * If the array is empty, it returns an empty Stream.
 *
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Stream.fromChunk`
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
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
export const fromArrayEffect = <A, E, R>(
  effect: Effect.Effect<ReadonlyArray<A>, E, R>
): Stream<A, Pull.ExcludeDone<E>, R> => unwrap(Effect.map(effect, fromArray)) as any

/**
 * Creates a stream from some ararys.
 *
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Stream.fromChunks`
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
 * import { Effect, Queue, Stream } from "effect"
 *
 * const program = Effect.gen(function*() {
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
export const fromQueue = <A, E>(queue: Queue.Dequeue<A, E>): Stream<A, Exclude<E, Cause.Done>> =>
  fromChannel(Channel.fromQueueArray(queue))

/**
 * Creates a stream from a PubSub.
 *
 * @example
 * ```ts
 * import { Effect, PubSub, Stream } from "effect"
 *
 * const program = Effect.gen(function*() {
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
 * import { Stream } from "effect"
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
      ({ done, value }) => done ? Cause.done() : Effect.succeed(Arr.of(value))
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
      (step) => Pull.catchDone(Effect.map(step(void 0), Arr.of), () => Cause.done())
    )
  )

/**
 * Creates a stream from a PubSub subscription.
 *
 * @example
 * ```ts
 * import { Effect, PubSub, Stream } from "effect"
 *
 * const program = Effect.gen(function*() {
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
 * import { Stream } from "effect"
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
 * import { Effect, Stream } from "effect"
 *
 * const stream = Stream.unfold(1, (n) => Effect.succeed([n, n + 1]))
 *
 * Effect.runPromise(Stream.runCollect(stream.pipe(Stream.take(5)))).then(
 *   console.log
 * )
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
      if (next === undefined) return Cause.done()
      state = next[1]
      return Effect.succeed(Arr.of(next[0]))
    })
  }))

/**
 * Create a stream that allows you to wrap a paginated resource.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 * import * as Option from "effect/Option"
 *
 * const stream = Stream.paginate(0, (n: number) =>
 *   Effect.succeed(
 *     [
 *       [n],
 *       n < 3 ? Option.some(n + 1) : Option.none<number>()
 *     ] as const
 *   ))
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
      if (done) return Cause.done()
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
 * import { Effect, Stream } from "effect"
 *
 * // An infinite Stream of numbers starting from 1 and incrementing
 * const stream = Stream.iterate(1, (n) => n + 1)
 *
 * Effect.runPromise(Stream.runCollect(stream.pipe(Stream.take(10)))).then(
 *   console.log
 * )
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
 * import { Stream } from "effect"
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
      if (done) return Cause.done()
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
 * import { Stream } from "effect"
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
 * import { Effect, Stream } from "effect"
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
 * import { Stream } from "effect"
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
  <A, B>(f: (a: A, i: number) => B): <E, R>(self: Stream<A, E, R>) => Stream<B, E, R>
  <A, E, R, B>(self: Stream<A, E, R>, f: (a: A, i: number) => B): Stream<B, E, R>
} = dual(2, <A, E, R, B>(self: Stream<A, E, R>, f: (a: A, i: number) => B): Stream<B, E, R> =>
  suspend(() => {
    let i = 0
    return fromChannel(Channel.map(
      self.channel,
      Arr.map((o) => f(o, i++))
    ))
  }))

/**
 * Returns a stream whose failure and success channels have been mapped by the
 * specified `onFailure` and `onSuccess` functions.
 *
 * @since 2.0.0
 * @category utils
 */
export const mapBoth: {
  <E, E2, A, A2>(
    options: { readonly onFailure: (e: E) => E2; readonly onSuccess: (a: A) => A2 }
  ): <R>(self: Stream<A, E, R>) => Stream<A2, E2, R>
  <A, E, R, E2, A2>(
    self: Stream<A, E, R>,
    options: { readonly onFailure: (e: E) => E2; readonly onSuccess: (a: A) => A2 }
  ): Stream<A2, E2, R>
} = dual(2, <A, E, R, E2, A2>(
  self: Stream<A, E, R>,
  options: { readonly onFailure: (e: E) => E2; readonly onSuccess: (a: A) => A2 }
): Stream<A2, E2, R> =>
  self.pipe(
    map(options.onSuccess),
    mapError(options.onFailure)
  ))

/**
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Stream.mapChunks`
 *
 * @since 2.0.0
 * @category mapping
 */
export const mapArray: {
  <A, B>(
    f: (a: Arr.NonEmptyReadonlyArray<A>, i: number) => Arr.NonEmptyReadonlyArray<B>
  ): <E, R>(self: Stream<A, E, R>) => Stream<B, E, R>
  <A, E, R, B>(
    self: Stream<A, E, R>,
    f: (a: Arr.NonEmptyReadonlyArray<A>, i: number) => Arr.NonEmptyReadonlyArray<B>
  ): Stream<B, E, R>
} = dual(2, <A, E, R, B>(
  self: Stream<A, E, R>,
  f: (a: Arr.NonEmptyReadonlyArray<A>, i: number) => Arr.NonEmptyReadonlyArray<B>
): Stream<B, E, R> => fromChannel(Channel.map(self.channel, f)))

/**
 * Maps over elements of the stream with the specified effectful function.
 *
 * @example
 * ```ts
 * import { Console, Effect, Stream } from "effect"
 *
 * const stream = Stream.make(1, 2, 3)
 *
 * const mappedStream = stream.pipe(
 *   Stream.mapEffect((n) =>
 *     Effect.gen(function*() {
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
    f: (a: A, i: number) => Effect.Effect<A2, E2, R2>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly unordered?: boolean | undefined
    } | undefined
  ): <E, R>(self: Stream<A, E, R>) => Stream<A2, E2 | E, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    f: (a: A, i: number) => Effect.Effect<A2, E2, R2>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly unordered?: boolean | undefined
    } | undefined
  ): Stream<A2, E | E2, R | R2>
} = dual((args) => isStream(args[0]), <A, E, R, A2, E2, R2>(
  self: Stream<A, E, R>,
  f: (a: A, i: number) => Effect.Effect<A2, E2, R2>,
  options?: {
    readonly concurrency?: number | "unbounded" | undefined
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
      readonly unordered?: boolean | undefined
    } | undefined
  ): <A, EX, RX, E, R>(self: Stream<Effect.Effect<A, EX, RX>, E, R>) => Stream<A, EX | E, RX | R>
  <A, E, R, EX, RX>(
    self: Stream<Effect.Effect<A, EX, RX>, E, R>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly unordered?: boolean | undefined
    } | undefined
  ): Stream<A, EX | E, RX | R>
} = dual((args) => isStream(args[0]), <A, E, R, EX, RX>(
  self: Stream<Effect.Effect<A, EX, RX>, E, R>,
  options?: {
    readonly concurrency?: number | "unbounded" | undefined
    readonly unordered?: boolean | undefined
  } | undefined
): Stream<A, EX | E, RX | R> => mapEffect(self, identity, options))

/**
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Stream.mapChunksEffect`
 *
 * @since 4.0.0
 * @category mapping
 */
export const mapArrayEffect: {
  <A, B, E2, R2>(
    f: (a: Arr.NonEmptyReadonlyArray<A>, i: number) => Effect.Effect<Arr.NonEmptyReadonlyArray<B>, E2, R2>
  ): <E, R>(self: Stream<A, E, R>) => Stream<B, E | E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Stream<A, E, R>,
    f: (a: Arr.NonEmptyReadonlyArray<A>, i: number) => Effect.Effect<Arr.NonEmptyReadonlyArray<B>, E2, R2>
  ): Stream<B, E | E2, R | R2>
} = dual(2, <A, E, R, B, E2, R2>(
  self: Stream<A, E, R>,
  f: (a: Arr.NonEmptyReadonlyArray<A>, i: number) => Effect.Effect<Arr.NonEmptyReadonlyArray<B>, E2, R2>
): Stream<B, E | E2, R | R2> => fromChannel(Channel.mapEffect(self.channel, f)))

/**
 * Returns a stream whose failures and successes have been lifted into an
 * `Result`. The resulting stream cannot fail, because the failures have been
 * exposed as part of the `Result` success case.
 *
 * @note The stream will end as soon as the first error occurs.
 *
 * @since 4.0.0
 * @category utils
 */
export const result = <A, E, R>(self: Stream<A, E, R>): Stream<Result.Result<A, E>, never, R> =>
  self.pipe(
    map(Result.succeed),
    catch_((e) => succeed(Result.fail(e)))
  )

/**
 * Adds an effect to consumption of every element of the stream.
 *
 * @example
 * ```ts
 * import { Console, Stream } from "effect"
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
): Stream<A, E | E2, R | R2> =>
  mapEffect(
    self,
    (a) => Effect.as(f(a), a),
    options
  ))

/**
 * @since 2.0.0
 * @category sequencing
 */
export const tapBoth: {
  <A, E, X, E2, R2, Y, E3, R3>(
    options: {
      readonly onElement: (a: NoInfer<A>) => Effect.Effect<X, E2, R2>
      readonly onError: (a: NoInfer<E>) => Effect.Effect<Y, E3, R3>
      readonly concurrency?: number | "unbounded" | undefined
    }
  ): <R>(self: Stream<A, E, R>) => Stream<A, E | E2 | E3, R | R2 | R3>
  <A, E, R, X, E2, R2, Y, E3, R3>(
    self: Stream<A, E, R>,
    options: {
      readonly onElement: (a: NoInfer<A>) => Effect.Effect<X, E2, R2>
      readonly onError: (a: NoInfer<E>) => Effect.Effect<Y, E3, R3>
      readonly concurrency?: number | "unbounded" | undefined
    }
  ): Stream<A, E | E2 | E3, R | R2 | R3>
} = dual(2, <A, E, R, X, E2, R2, Y, E3, R3>(
  self: Stream<A, E, R>,
  options: {
    readonly onElement: (a: NoInfer<A>) => Effect.Effect<X, E2, R2>
    readonly onError: (a: NoInfer<E>) => Effect.Effect<Y, E3, R3>
    readonly concurrency?: number | "unbounded" | undefined
  }
): Stream<A, E | E2 | E3, R | R2 | R3> =>
  self.pipe(
    tapError(options.onError),
    tap(options.onElement, { concurrency: options.concurrency })
  ))

/**
 * Sends all elements emitted by this stream to the specified sink in addition
 * to emitting them.
 *
 * @since 2.0.0
 * @category sequencing
 */
export const tapSink: {
  <A, E2, R2>(sink: Sink.Sink<unknown, A, unknown, E2, R2>): <E, R>(self: Stream<A, E, R>) => Stream<A, E2 | E, R2 | R>
  <A, E, R, E2, R2>(self: Stream<A, E, R>, sink: Sink.Sink<unknown, A, unknown, E2, R2>): Stream<A, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, E2, R2>(
    self: Stream<A, E, R>,
    sink: Sink.Sink<unknown, A, unknown, E2, R2>
  ): Stream<A, E | E2, R | R2> =>
    transformPullBracket(
      self,
      Effect.fnUntraced(function*(pull, _, scope) {
        const upstreamLatch = Effect.makeLatchUnsafe()
        const sinkLatch = Effect.makeLatchUnsafe()
        let chunk: Arr.NonEmptyReadonlyArray<A> | undefined = undefined
        let causeSink: Cause.Cause<E2> | undefined = undefined
        let sinkDone = false
        let streamDone = false

        const sinkUpstream = upstreamLatch.whenOpen(Effect.suspend(() => {
          if (chunk) {
            const arr = chunk!
            chunk = undefined
            if (!streamDone) upstreamLatch.closeUnsafe()
            return Effect.as(sinkLatch.open, arr)
          }
          return Cause.done()
        }))

        yield* Effect.suspend(() => sink.transform(sinkUpstream, scope)).pipe(
          Effect.onExitInterruptible((exit) => {
            sinkDone = true
            if (Exit.isFailure(exit)) {
              causeSink = exit.cause
            }
            return sinkLatch.open
          }),
          Effect.forkIn(scope)
        )

        const pullAndOffer = pull.pipe(
          Effect.flatMap((chunk_) => {
            chunk = chunk_
            sinkLatch.closeUnsafe()
            upstreamLatch.openUnsafe()
            return Effect.as(sinkLatch.await, chunk_)
          }),
          Pull.catchDone(() => {
            streamDone = true
            sinkLatch.closeUnsafe()
            upstreamLatch.openUnsafe()
            return Effect.flatMap(sinkLatch.await, () => Cause.done())
          })
        )

        return Effect.suspend((): Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E | E2, void, R> => {
          if (causeSink) {
            return Effect.failCause(causeSink)
          } else if (sinkDone) {
            return pull
          }
          return pullAndOffer
        })
      })
    )
)

/**
 * Returns a stream made of the concatenation in strict order of all the
 * streams produced by passing each element of this stream to `f0`
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const stream = Stream.make(1, 2, 3)
 *
 * const flatMapped = stream.pipe(
 *   Stream.flatMap((n) => Stream.make(n, n * 2))
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
 * @since 4.0.0
 * @category sequencing
 */
export const switchMap: {
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
    Channel.switchMap((a) => f(a).channel, options),
    fromChannel
  ))

/**
 * Flattens a stream of streams into a single stream.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
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
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Stream.flattenChunks`
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
 * Drains the provided stream in the background for as long as this stream is
 * running. If this stream ends before `other`, `other` will be interrupted.
 * If `other` fails, this stream will fail with that error.
 *
 * @since 2.0.0
 * @category utils
 */
export const drainFork: {
  <A2, E2, R2>(that: Stream<A2, E2, R2>): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E2 | E, R2 | R>
  <A, E, R, A2, E2, R2>(self: Stream<A, E, R>, that: Stream<A2, E2, R2>): Stream<A, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, A2, E2, R2>(self: Stream<A, E, R>, that: Stream<A2, E2, R2>): Stream<A, E | E2, R | R2> =>
    mergeEffect(self, runDrain(that))
)

/**
 * Repeats the entire stream using the specified schedule. The stream will
 * execute normally, and then repeat again according to the provided schedule.
 *
 * @example
 * ```ts
 * import { Effect, Schedule, Stream } from "effect"
 *
 * const stream = Stream.repeat(Stream.succeed(1), Schedule.forever)
 *
 * Effect.runPromise(Stream.runCollect(stream.pipe(Stream.take(5)))).then(
 *   console.log
 * )
 * // { _id: 'Chunk', values: [ 1, 1, 1, 1, 1 ] }
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const repeat: {
  <B, E2, R2>(
    schedule: Schedule.Schedule<B, void, E2, R2>
  ): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E | E2, R2 | R>
  <A, E, R, B, E2, R2>(
    self: Stream<A, E, R>,
    schedule: Schedule.Schedule<B, void, E2, R2>
  ): Stream<A, E | E2, R | R2>
} = dual(2, <A, E, R, B, E2, R2>(
  self: Stream<A, E, R>,
  schedule: Schedule.Schedule<B, void, E2, R2>
): Stream<A, E | E2, R | R2> => fromChannel(Channel.repeat(self.channel, schedule)))

/**
 * Schedules the output of the stream using the provided `schedule`.
 *
 * @since 2.0.0
 * @category utils
 */
export const schedule: {
  <X, E2, R2, A>(
    schedule: Schedule.Schedule<X, NoInfer<A>, E2, R2>
  ): <E, R>(self: Stream<A, E, R>) => Stream<A, E | E2, R2 | R>
  <A, E, R, X, E2, R2>(
    self: Stream<A, E, R>,
    schedule: Schedule.Schedule<X, NoInfer<A>, E2, R2>
  ): Stream<A, E | E2, R | R2>
} = dual(2, <A, E, R, X, E2, R2>(
  self: Stream<A, E, R>,
  schedule: Schedule.Schedule<X, NoInfer<A>, E2, R2>
): Stream<A, E | E2, R | R2> =>
  self.channel.pipe(
    Channel.flattenArray,
    Channel.schedule(schedule),
    Channel.map(Arr.of),
    fromChannel
  ))

/**
 * Ends the stream if it does not produce a value after the specified duration.
 *
 * @since 2.0.0
 * @category utils
 */
export const timeout: {
  (duration: Duration.DurationInput): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E, R>
  <A, E, R>(self: Stream<A, E, R>, duration: Duration.DurationInput): Stream<A, E, R>
} = dual(
  2,
  <A, E, R>(self: Stream<A, E, R>, duration: Duration.DurationInput): Stream<A, E, R> =>
    transformPull(self, (pull, _scope) =>
      Effect.succeed(Effect.timeoutOrElse(pull, {
        duration,
        onTimeout: () => Cause.done()
      })))
)

/**
 * Repeats each element of the stream using the provided schedule. Repetitions
 * are done in addition to the first execution, which means using
 * `Schedule.recurs(1)` actually results in the original effect, plus an
 * additional recurrence, for a total of two repetitions of each value in the
 * stream.
 *
 * @since 2.0.0
 * @category utils
 */
export const repeatElements: {
  <B, E2, R2>(
    schedule: Schedule.Schedule<B, unknown, E2, R2>
  ): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E | E2, R2 | R>
  <A, E, R, B, E2, R2>(
    self: Stream<A, E, R>,
    schedule: Schedule.Schedule<B, unknown, E2, R2>
  ): Stream<A, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Stream<A, E, R>,
    schedule: Schedule.Schedule<B, unknown, E2, R2>
  ): Stream<A, E | E2, R | R2> =>
    fromChannel(Channel.fromTransform((upstream, scope) =>
      Effect.map(
        Channel.toTransform(Channel.flattenArray(self.channel))(upstream, scope),
        (pullElement) => {
          let pullRepeat: Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E | E2, void, R | R2> | undefined = undefined

          const pull: Pull.Pull<
            Arr.NonEmptyReadonlyArray<A>,
            E,
            void,
            R | R2
          > = Effect.gen(function*() {
            const element = yield* pullElement
            const chunk = Arr.of(element)
            const step = yield* Schedule.toStepWithSleep(schedule)
            pullRepeat = step(element).pipe(
              Effect.as(chunk),
              Pull.catchDone((_) => {
                pullRepeat = undefined
                return pull
              })
            )
            return chunk
          })

          return Effect.suspend(() => pullRepeat ?? pull)
        }
      )
    ))
)

/**
 * Repeats this stream forever.
 *
 * @since 2.0.0
 * @category utils
 */
export const forever = <A, E, R>(self: Stream<A, E, R>): Stream<A, E, R> => fromChannel(Channel.forever(self.channel))

/**
 * Flattens a stream of iterables into a single stream.
 *
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Stream.flattenIterables`
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
 * import { Effect, Stream } from "effect"
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
 * Emits the provided chunk before emitting any other value.
 *
 * @since 2.0.0
 * @category utils
 */
export const prepend: {
  <B>(values: Iterable<B>): <A, E, R>(self: Stream<A, E, R>) => Stream<B | A, E, R>
  <A, E, R, B>(self: Stream<A, E, R>, values: Iterable<B>): Stream<A | B, E, R>
} = dual(2, <A, E, R, B>(
  self: Stream<A, E, R>,
  values: Iterable<B>
): Stream<A | B, E, R> => concat(fromIterable(values), self))

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
 * @since 4.0.0
 * @category utils
 */
export const mergeEffect: {
  <A2, E2, R2>(effect: Effect.Effect<A2, E2, R2>): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E2 | E, R2 | R>
  <A, E, R, A2, E2, R2>(self: Stream<A, E, R>, effect: Effect.Effect<A2, E2, R2>): Stream<A, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, A2, E2, R2>(self: Stream<A, E, R>, effect: Effect.Effect<A2, E2, R2>): Stream<A, E | E2, R | R2> =>
    self.channel.pipe(
      Channel.mergeEffect(effect),
      fromChannel
    )
)

/**
 * Merges this stream and the specified stream together to produce a stream of
 * results.
 *
 * @since 2.0.0
 * @category utils
 */
export const mergeResult: {
  <A2, E2, R2>(
    that: Stream<A2, E2, R2>
  ): <A, E, R>(self: Stream<A, E, R>) => Stream<Result.Result<A, A2>, E2 | E, R2 | R>
  <A, E, R, A2, E2, R2>(self: Stream<A, E, R>, that: Stream<A2, E2, R2>): Stream<Result.Result<A, A2>, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    that: Stream<A2, E2, R2>
  ): Stream<Result.Result<A, A2>, E | E2, R | R2> =>
    merge(
      map(self, Result.succeed),
      map(that, Result.fail)
    )
)

/**
 * Merges this stream and the specified stream together, discarding the values
 * from the right stream.
 *
 * @since 2.0.0
 * @category utils
 */
export const mergeLeft: {
  <AR, ER, RR>(right: Stream<AR, ER, RR>): <AL, EL, RL>(left: Stream<AL, EL, RL>) => Stream<AL, ER | EL, RR | RL>
  <AL, EL, RL, AR, ER, RR>(left: Stream<AL, EL, RL>, right: Stream<AR, ER, RR>): Stream<AL, EL | ER, RL | RR>
} = dual(
  2,
  <AL, EL, RL, AR, ER, RR>(left: Stream<AL, EL, RL>, right: Stream<AR, ER, RR>): Stream<AL, EL | ER, RL | RR> =>
    mergeEffect(left, runDrain(right))
)

/**
 * Merges this stream and the specified stream together, discarding the values
 * from the left stream.
 *
 * @since 2.0.0
 * @category utils
 */
export const mergeRight: {
  <AR, ER, RR>(right: Stream<AR, ER, RR>): <AL, EL, RL>(left: Stream<AL, EL, RL>) => Stream<AR, ER | EL, RR | RL>
  <AL, EL, RL, AR, ER, RR>(left: Stream<AL, EL, RL>, right: Stream<AR, ER, RR>): Stream<AR, EL | ER, RL | RR>
} = dual(
  2,
  <AL, EL, RL, AR, ER, RR>(left: Stream<AL, EL, RL>, right: Stream<AR, ER, RR>): Stream<AR, EL | ER, RL | RR> =>
    mergeEffect(right, runDrain(left))
)

/**
 * Merges a variable list of streams in a non-deterministic fashion. Up to `n`
 * streams may be consumed in parallel and up to `outputBuffer` chunks may be
 * buffered by this operator.
 *
 * @since 2.0.0
 * @category utils
 */
export const mergeAll: {
  (
    options: {
      readonly concurrency: number | "unbounded"
      readonly bufferSize?: number | undefined
    }
  ): <A, E, R>(streams: Iterable<Stream<A, E, R>>) => Stream<A, E, R>
  <A, E, R>(
    streams: Iterable<Stream<A, E, R>>,
    options: {
      readonly concurrency: number | "unbounded"
      readonly bufferSize?: number | undefined
    }
  ): Stream<A, E, R>
} = dual(2, <A, E, R>(
  streams: Iterable<Stream<A, E, R>>,
  options: {
    readonly concurrency: number | "unbounded"
    readonly bufferSize?: number | undefined
  }
): Stream<A, E, R> => flatten(fromIterable(streams), options))

/**
 * Composes this stream with the specified stream to create a cartesian
 * product of elements. The `right` stream would be run multiple times, for
 * every element in the `left` stream.
 *
 * See also `Stream.zip` for the more common point-wise variant.
 *
 * @since 2.0.0
 * @category utils
 */
export const cross: {
  <AR, ER, RR>(right: Stream<AR, ER, RR>): <AL, EL, RL>(left: Stream<AL, EL, RL>) => Stream<[AL, AR], EL | ER, RL | RR>
  <AL, ER, RR, AR, EL, RL>(left: Stream<AL, ER, RR>, right: Stream<AR, EL, RL>): Stream<[AL, AR], EL | ER, RL | RR>
} = dual(2, <AL, EL, RL, AR, ER, RR>(
  left: Stream<AL, EL, RL>,
  right: Stream<AR, ER, RR>
): Stream<[AL, AR], EL | ER, RL | RR> => crossWith(left, right, (l, r) => [l, r]))

/**
 * Composes this stream with the specified stream to create a cartesian
 * product of elements with a specified function. The `right` stream would be
 * run multiple times, for every element in the `left` stream.
 *
 * See also `Stream.zipWith` for the more common point-wise variant.
 *
 * @since 2.0.0
 * @category utils
 */
export const crossWith: {
  <AR, ER, RR, AL, A>(
    right: Stream<AR, ER, RR>,
    f: (left: AL, right: AR) => A
  ): <EL, RL>(left: Stream<AL, EL, RL>) => Stream<A, EL | ER, RL | RR>
  <AL, EL, RL, AR, ER, RR, A>(
    left: Stream<AL, EL, RL>,
    right: Stream<AR, ER, RR>,
    f: (left: AL, right: AR) => A
  ): Stream<A, EL | ER, RL | RR>
} = dual(3, <AL, EL, RL, AR, ER, RR, A>(
  left: Stream<AL, EL, RL>,
  right: Stream<AR, ER, RR>,
  f: (left: AL, right: AR) => A
): Stream<A, EL | ER, RL | RR> => flatMap(left, (l) => map(right, (r) => f(l, r))))

/**
 * Zips this stream with another point-wise and applies the function to the
 * paired elements.
 *
 * The new stream will end when one of the sides ends.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const stream1 = Stream.make(1, 2, 3, 4, 5, 6)
 * const stream2 = Stream.make("a", "b", "c")
 *
 * const zipped = Stream.zipWith(stream1, stream2, (n, s) => `${n}-${s}`)
 *
 * Effect.runPromise(Stream.runCollect(zipped)).then(console.log)
 * // Output: ["1-a", "2-b", "3-c"]
 * ```
 *
 * @since 2.0.0
 * @category zipping
 */
export const zipWith: {
  <AR, ER, RR, AL, A>(
    right: Stream<AR, ER, RR>,
    f: (left: AL, right: AR) => A
  ): <EL, RL>(left: Stream<AL, EL, RL>) => Stream<A, EL | ER, RL | RR>
  <AL, EL, RL, AR, ER, RR, A>(
    left: Stream<AL, EL, RL>,
    right: Stream<AR, ER, RR>,
    f: (left: AL, right: AR) => A
  ): Stream<A, EL | ER, RL | RR>
} = dual(3, <AL, EL, RL, AR, ER, RR, A>(
  left: Stream<AL, EL, RL>,
  right: Stream<AR, ER, RR>,
  f: (left: AL, right: AR) => A
): Stream<A, EL | ER, RL | RR> => zipWithArray(left, right, zipArrays(f)))

const zipArrays = <AL, AR, A>(
  f: (left: AL, right: AR) => A
) =>
(
  leftArr: Arr.NonEmptyReadonlyArray<AL>,
  rightArr: Arr.NonEmptyReadonlyArray<AR>
) => {
  const minLength = Math.min(leftArr.length, rightArr.length)
  const result: Arr.NonEmptyArray<A> = [] as any

  for (let i = 0; i < minLength; i++) {
    result.push(f(leftArr[i], rightArr[i]))
  }

  return [result, leftArr.slice(minLength), rightArr.slice(minLength)] as const
}

/**
 * Zips this stream with another stream using a function that operates on arrays
 * (chunks) of elements rather than individual elements.
 *
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Stream.zipWithChunks`
 *
 * @since 2.0.0
 * @category zipping
 */
export const zipWithArray: {
  <AR, ER, RR, AL, A>(
    right: Stream<AR, ER, RR>,
    f: (
      left: Arr.NonEmptyReadonlyArray<AL>,
      right: Arr.NonEmptyReadonlyArray<AR>
    ) => readonly [
      output: Arr.NonEmptyReadonlyArray<A>,
      leftoverLeft: ReadonlyArray<AL>,
      leftoverRight: ReadonlyArray<AR>
    ]
  ): <EL, RL>(left: Stream<AL, EL, RL>) => Stream<A, EL | ER, RL | RR>
  <AL, EL, RL, AR, ER, RR, A>(
    left: Stream<AL, EL, RL>,
    right: Stream<AR, ER, RR>,
    f: (
      left: Arr.NonEmptyReadonlyArray<AL>,
      right: Arr.NonEmptyReadonlyArray<AR>
    ) => readonly [
      output: Arr.NonEmptyReadonlyArray<A>,
      leftoverLeft: ReadonlyArray<AL>,
      leftoverRight: ReadonlyArray<AR>
    ]
  ): Stream<A, EL | ER, RL | RR>
} = dual(3, <AL, EL, RL, AR, ER, RR, A>(
  left: Stream<AL, EL, RL>,
  right: Stream<AR, ER, RR>,
  f: (
    left: Arr.NonEmptyReadonlyArray<AL>,
    right: Arr.NonEmptyReadonlyArray<AR>
  ) => readonly [
    output: Arr.NonEmptyReadonlyArray<A>,
    leftoverLeft: ReadonlyArray<AL>,
    leftoverRight: ReadonlyArray<AR>
  ]
): Stream<A, EL | ER, RL | RR> =>
  fromChannel(Channel.fromTransformBracket(Effect.fnUntraced(function*(_, scope) {
    const pullLeft = yield* Channel.toPullScoped(left.channel, scope)
    const pullRight = yield* Channel.toPullScoped(right.channel, scope)
    const pullBoth = Effect.gen(function*() {
      const fiberLeft = yield* Effect.forkIn(pullLeft, scope)
      const fiberRight = yield* Effect.forkIn(pullRight, scope)
      return (yield* Fiber.joinAll([fiberLeft, fiberRight])) as [
        Arr.NonEmptyReadonlyArray<AL>,
        Arr.NonEmptyReadonlyArray<AR>
      ]
    })

    type State =
      | { _tag: "PullBoth" }
      | { _tag: "PullLeft"; rightArray: Arr.NonEmptyReadonlyArray<AR> }
      | { _tag: "PullRight"; leftArray: Arr.NonEmptyReadonlyArray<AL> }
    let state: State = { _tag: "PullBoth" }

    const pull: Effect.Effect<
      Arr.NonEmptyReadonlyArray<A>,
      EL | ER | Cause.Done,
      RL | RR
    > = Effect.gen(function*() {
      const [left, right] = state._tag === "PullBoth"
        ? yield* pullBoth
        : state._tag === "PullLeft"
        ? [yield* pullLeft, state.rightArray]
        : [state.leftArray, yield* pullRight]
      const result = f(left, right)
      if (Arr.isReadonlyArrayNonEmpty(result[1])) {
        state = { _tag: "PullRight", leftArray: result[1] }
      } else if (Arr.isReadonlyArrayNonEmpty(result[2])) {
        state = { _tag: "PullLeft", rightArray: result[2] }
      } else {
        state = { _tag: "PullBoth" }
      }
      return result[0]
    })

    return pull
  }))))

/**
 * Zips this stream with another point-wise and emits tuples of elements from
 * both streams.
 *
 * The new stream will end when one of the sides ends.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const stream1 = Stream.make(1, 2, 3)
 * const stream2 = Stream.make("a", "b", "c")
 *
 * const zipped = Stream.zip(stream1, stream2)
 *
 * Effect.runPromise(Stream.runCollect(zipped)).then(console.log)
 * // Output: [[1, "a"], [2, "b"], [3, "c"]]
 * ```
 *
 * @since 2.0.0
 * @category zipping
 */
export const zip: {
  <A2, E2, R2>(that: Stream<A2, E2, R2>): <A, E, R>(self: Stream<A, E, R>) => Stream<[A, A2], E2 | E, R2 | R>
  <A, E, R, A2, E2, R2>(self: Stream<A, E, R>, that: Stream<A2, E2, R2>): Stream<[A, A2], E | E2, R | R2>
} = dual(
  2,
  <A, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    that: Stream<A2, E2, R2>
  ): Stream<[A, A2], E | E2, R | R2> => zipWith(self, that, (a, a2) => [a, a2])
)

/**
 * Zips this stream with another point-wise, but keeps only the outputs of
 * the left stream.
 *
 * The new stream will end when one of the sides ends.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const stream1 = Stream.make(1, 2, 3, 4)
 * const stream2 = Stream.make("a", "b")
 *
 * const zipped = Stream.zipLeft(stream1, stream2)
 *
 * Effect.runPromise(Stream.runCollect(zipped)).then(console.log)
 * // Output: [1, 2]
 * ```
 *
 * @since 2.0.0
 * @category zipping
 */
export const zipLeft: {
  <AR, ER, RR>(right: Stream<AR, ER, RR>): <AL, EL, RL>(left: Stream<AL, EL, RL>) => Stream<AL, ER | EL, RR | RL>
  <AL, EL, RL, AR, ER, RR>(left: Stream<AL, EL, RL>, right: Stream<AR, ER, RR>): Stream<AL, EL | ER, RL | RR>
} = dual(
  2,
  <AL, EL, RL, AR, ER, RR>(
    left: Stream<AL, EL, RL>,
    right: Stream<AR, ER, RR>
  ): Stream<AL, EL | ER, RL | RR> =>
    zipWithArray(left, right, (leftArr, rightArr) => {
      const minLength = Math.min(leftArr.length, rightArr.length)
      const output = leftArr.slice(0, minLength) as Arr.NonEmptyArray<AL>
      const leftoverLeft = leftArr.slice(minLength)
      const leftoverRight = rightArr.slice(minLength)

      return [output, leftoverLeft, leftoverRight] as const
    })
)

/**
 * Zips this stream with another point-wise, but keeps only the outputs of
 * the right stream.
 *
 * The new stream will end when one of the sides ends.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const stream1 = Stream.make(1, 2)
 * const stream2 = Stream.make("a", "b", "c", "d")
 *
 * const zipped = Stream.zipRight(stream1, stream2)
 *
 * Effect.runPromise(Stream.runCollect(zipped)).then(console.log)
 * // Output: ["a", "b"]
 * ```
 *
 * @since 2.0.0
 * @category zipping
 */
export const zipRight: {
  <AR, ER, RR>(right: Stream<AR, ER, RR>): <AL, EL, RL>(left: Stream<AL, EL, RL>) => Stream<AR, ER | EL, RR | RL>
  <AL, EL, RL, AR, ER, RR>(left: Stream<AL, EL, RL>, right: Stream<AR, ER, RR>): Stream<AR, EL | ER, RL | RR>
} = dual(
  2,
  <AL, EL, RL, AR, ER, RR>(
    left: Stream<AL, EL, RL>,
    right: Stream<AR, ER, RR>
  ): Stream<AR, EL | ER, RL | RR> =>
    zipWithArray(left, right, (leftArr, rightArr) => {
      const minLength = Math.min(leftArr.length, rightArr.length)
      const output = rightArr.slice(0, minLength) as Arr.NonEmptyArray<AR>
      const leftoverLeft = leftArr.slice(minLength)
      const leftoverRight = rightArr.slice(minLength)

      return [output, leftoverLeft, leftoverRight] as const
    })
)

/**
 * Zips this stream with another point-wise and emits tuples of elements from
 * both streams, flattening the left tuple.
 *
 * The new stream will end when one of the sides ends.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const stream1 = Stream.make(
 *   [1, "a"] as const,
 *   [2, "b"] as const,
 *   [3, "c"] as const
 * )
 * const stream2 = Stream.make("x", "y", "z")
 *
 * const zipped = Stream.zipFlatten(stream1, stream2)
 *
 * Effect.runPromise(Stream.runCollect(zipped)).then(console.log)
 * // Output: [[1, "a", "x"], [2, "b", "y"], [3, "c", "z"]]
 * ```
 *
 * @since 2.0.0
 * @category zipping
 */
export const zipFlatten: {
  <A2, E2, R2>(
    that: Stream<A2, E2, R2>
  ): <A extends ReadonlyArray<any>, E, R>(self: Stream<A, E, R>) => Stream<[...A, A2], E2 | E, R2 | R>
  <A extends ReadonlyArray<any>, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    that: Stream<A2, E2, R2>
  ): Stream<[...A, A2], E | E2, R | R2>
} = dual(
  2,
  <A extends ReadonlyArray<any>, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    that: Stream<A2, E2, R2>
  ): Stream<[...A, A2], E | E2, R | R2> => zipWith(self, that, (a, a2) => [...a, a2])
)

/**
 * Zips this stream together with the index of elements.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const stream = Stream.make("a", "b", "c", "d")
 *
 * const indexed = Stream.zipWithIndex(stream)
 *
 * Effect.runPromise(Stream.runCollect(indexed)).then(console.log)
 * // Output: [["a", 0], ["b", 1], ["c", 2], ["d", 3]]
 * ```
 *
 * @since 2.0.0
 * @category zipping
 */
export const zipWithIndex = <A, E, R>(self: Stream<A, E, R>): Stream<[A, number], E, R> => map(self, (a, i) => [a, i])

/**
 * Zips each element with the next element if present.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const stream = Stream.zipWithNext(Stream.make(1, 2, 3, 4))
 *
 * Effect.runPromise(Stream.runCollect(stream)).then((chunk) => console.log(chunk))
 * // [
 * //   [ 1, { _id: 'Option', _tag: 'Some', value: 2 } ],
 * //   [ 2, { _id: 'Option', _tag: 'Some', value: 3 } ],
 * //   [ 3, { _id: 'Option', _tag: 'Some', value: 4 } ],
 * //   [ 4, { _id: 'Option', _tag: 'None' } ]
 * // ]
 * ```
 *
 * @since 2.0.0
 * @category zipping
 */
export const zipWithNext = <A, E, R>(self: Stream<A, E, R>): Stream<[A, Option.Option<A>], E, R> =>
  mapAccumArray(self, Option.none<A>, (acc, arr) => {
    let i = 0
    if (acc._tag === "None") {
      i = 1
      acc = Option.some(arr[0]) as Option.Some<A>
    }
    const pairs = Arr.empty<[A, Option.Option<A>]>()
    for (; i < arr.length; i++) {
      const value = acc.value
      acc = Option.some(arr[i]) as Option.Some<A>
      pairs.push([value, acc])
    }
    return [acc, pairs]
  }, {
    onHalt(state) {
      return state._tag === "Some" ? [[state.value, Option.none<A>()]] : []
    }
  })

/**
 * Zips each element with the previous element. Initially accompanied by
 * `None`.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const stream = Stream.zipWithPrevious(Stream.make(1, 2, 3, 4))
 *
 * Effect.runPromise(Stream.runCollect(stream)).then((chunk) => console.log(chunk))
 * // [
 * //   [ { _id: 'Option', _tag: 'None' }, 1 ],
 * //   [ { _id: 'Option', _tag: 'Some', value: 1 }, 2 ],
 * //   [ { _id: 'Option', _tag: 'Some', value: 2 }, 3 ],
 * //   [ { _id: 'Option', _tag: 'Some', value: 3 }, 4 ]
 * // ]
 * ```
 *
 * @since 2.0.0
 * @category zipping
 */
export const zipWithPrevious = <A, E, R>(self: Stream<A, E, R>): Stream<[Option.Option<A>, A], E, R> =>
  mapAccumArray(self, Option.none<A>, (acc, arr) => {
    const pairs = Arr.empty<[Option.Option<A>, A]>()
    for (let i = 0; i < arr.length; i++) {
      const value = arr[i]
      pairs.push([acc, value])
      acc = Option.some(arr[i])
    }
    return [acc, pairs]
  })

/**
 * Zips each element with both the previous and next element.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const stream = Stream.zipWithPreviousAndNext(Stream.make(1, 2, 3, 4))
 *
 * Effect.runPromise(Stream.runCollect(stream)).then((chunk) => console.log(chunk))
 * // [
 * //   [
 * //     { _id: 'Option', _tag: 'None' },
 * //     1,
 * //     { _id: 'Option', _tag: 'Some', value: 2 }
 * //   ],
 * //   [
 * //     { _id: 'Option', _tag: 'Some', value: 1 },
 * //     2,
 * //     { _id: 'Option', _tag: 'Some', value: 3 }
 * //   ],
 * //   [
 * //     { _id: 'Option', _tag: 'Some', value: 2 },
 * //     3,
 * //     { _id: 'Option', _tag: 'Some', value: 4 }
 * //   ],
 * //   [
 * //     { _id: 'Option', _tag: 'Some', value: 3 },
 * //     4,
 * //     { _id: 'Option', _tag: 'None' }
 * //   ]
 * // ]
 * ```
 *
 * @since 2.0.0
 * @category zipping
 */
export const zipWithPreviousAndNext = <A, E, R>(
  self: Stream<A, E, R>
): Stream<[Option.Option<A>, A, Option.Option<A>], E, R> =>
  mapAccumArray(self, () => ({
    prev: Option.none<A>(),
    current: Option.none<A>()
  }), (acc, arr) => {
    let i = 0
    let current: A
    if (acc.current._tag === "None") {
      i = 1
      current = arr[0]
      acc.current = Option.some(current)
    } else {
      current = acc.current.value
    }
    const pairs = Arr.empty<[Option.Option<A>, A, Option.Option<A>]>()
    for (; i < arr.length; i++) {
      const element = arr[i]
      acc.current = Option.some(element) as Option.Some<A>
      pairs.push([acc.prev, current, acc.current])
      acc.prev = Option.some(current)
      current = element
    }
    return [acc, pairs]
  }, {
    onHalt(acc) {
      return acc.current._tag === "Some" ? [[acc.prev, acc.current.value, Option.none<A>()]] : []
    }
  })

/**
 * @since 2.0.0
 * @category zipping
 */
export const zipLatestAll = <T extends ReadonlyArray<Stream<any, any, any>>>(
  ...streams: T
): Stream<
  [T[number]] extends [never] ? never
    : { [K in keyof T]: T[K] extends Stream<infer A, infer _E, infer _R> ? A : never },
  [T[number]] extends [never] ? never : T[number] extends Stream<infer _A, infer _E, infer _R> ? _E : never,
  [T[number]] extends [never] ? never : T[number] extends Stream<infer _A, infer _E, infer _R> ? _R : never
> =>
  fromChannel(Channel.suspend(() => {
    const latest: Array<any> = []
    const emitted = new Set<number>()
    const readyLatch = Effect.makeLatchUnsafe()
    return Channel.mergeAll(
      Channel.fromArray(
        streams.map((s, i) =>
          s.channel.pipe(
            Channel.flattenArray,
            Channel.mapEffect((a) => {
              latest[i] = a
              if (!emitted.has(i)) {
                emitted.add(i)
                if (emitted.size < streams.length) {
                  return readyLatch.await as Effect.Effect<undefined>
                }
                return Effect.as(readyLatch.open, Arr.of(latest.slice()))
              }
              return Effect.succeed(Arr.of(latest.slice()))
            }),
            Channel.filter(isNotUndefined)
          )
        )
      ),
      {
        concurrency: "unbounded",
        bufferSize: 0
      }
    )
  })) as any

/**
 * Zips the two streams so that when a value is emitted by either of the two
 * streams, it is combined with the latest value from the other stream to
 * produce a result.
 *
 * Note: tracking the latest value is done on a per-array basis. That means
 * that emitted elements that are not the last value in arrays will never be
 * used for zipping.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const s1 = Stream.make(1, 2, 3)
 * const s2 = Stream.make("a", "b", "c", "d")
 *
 * const stream = Stream.zipLatest(s1, s2)
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // Output combines values as they arrive
 * ```
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * // Combining sensor readings with timestamps
 * const temperatures = Stream.make(20.5, 21.0, 20.8, 22.1)
 * const timestamps = Stream.make("10:00", "10:01", "10:02", "10:03", "10:04")
 *
 * const readings = Stream.zipLatest(temperatures, timestamps)
 *
 * Effect.runPromise(Stream.runCollect(readings)).then((result) =>
 *   console.log(result)
 * )
 * // Each temperature is paired with the latest timestamp
 * ```
 *
 * @since 2.0.0
 * @category zipping
 */
export const zipLatest: {
  <AR, ER, RR>(
    right: Stream<AR, ER, RR>
  ): <AL, EL, RL>(left: Stream<AL, EL, RL>) => Stream<[AL, AR], EL | ER, RL | RR>
  <AL, EL, RL, AR, ER, RR>(
    left: Stream<AL, EL, RL>,
    right: Stream<AR, ER, RR>
  ): Stream<[AL, AR], EL | ER, RL | RR>
} = dual(
  2,
  <AL, EL, RL, AR, ER, RR>(
    left: Stream<AL, EL, RL>,
    right: Stream<AR, ER, RR>
  ): Stream<[AL, AR], EL | ER, RL | RR> => zipLatestAll(left, right)
)

/**
 * Zips the two streams so that when a value is emitted by either of the two
 * streams, it is combined with the latest value from the other stream using
 * the provided function to produce a result.
 *
 * Note: tracking the latest value is done on a per-array basis. That means
 * that emitted elements that are not the last value in arrays will never be
 * used for zipping.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const numbers = Stream.make(1, 2, 3)
 * const multipliers = Stream.make(10, 20, 30)
 *
 * const stream = Stream.zipLatestWith(
 *   numbers,
 *   multipliers,
 *   (n: number, m: number) => n * m
 * )
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // Combines values using multiplication as they arrive
 * ```
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * // Combining first and last names
 * const firstNames = Stream.make("Alice", "Bob", "Charlie")
 * const lastNames = Stream.make("Smith", "Jones")
 *
 * const fullNames = Stream.zipLatestWith(
 *   firstNames,
 *   lastNames,
 *   (first: string, last: string) => `${first} ${last}`
 * )
 *
 * Effect.runPromise(Stream.runCollect(fullNames)).then((result) =>
 *   console.log(result)
 * )
 * // ["Alice Smith", "Bob Smith", "Bob Jones", "Charlie Jones"]
 * ```
 *
 * @since 2.0.0
 * @category zipping
 */
export const zipLatestWith: {
  <AR, ER, RR, AL, A>(
    right: Stream<AR, ER, RR>,
    f: (left: AL, right: AR) => A
  ): <EL, RL>(left: Stream<AL, EL, RL>) => Stream<A, EL | ER, RL | RR>
  <AL, EL, RL, AR, ER, RR, A>(
    left: Stream<AL, EL, RL>,
    right: Stream<AR, ER, RR>,
    f: (left: AL, right: AR) => A
  ): Stream<A, EL | ER, RL | RR>
} = dual(
  3,
  <AL, EL, RL, AR, ER, RR, A>(
    left: Stream<AL, EL, RL>,
    right: Stream<AR, ER, RR>,
    f: (left: AL, right: AR) => A
  ): Stream<A, EL | ER, RL | RR> => map(zipLatestAll(left, right), ([a, a2]) => f(a, a2))
)

/**
 * @since 3.7.0
 * @category racing
 */
export const raceAll = <S extends ReadonlyArray<Stream<any, any, any>>>(
  ...streams: S
): Stream<Success<S[number]>, Error<S[number]>, Services<S[number]>> =>
  fromChannel(Channel.fromTransform((_, scope) =>
    Effect.sync(() => {
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
    })
  ))

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
  <A, B extends A>(refinement: Refinement<NoInfer<A>, B>): <E, R>(self: Stream<A, E, R>) => Stream<B, E, R>
  <A>(predicate: Predicate<NoInfer<A>>): <E, R>(self: Stream<A, E, R>) => Stream<A, E, R>
  <A, E, R, B extends A>(self: Stream<A, E, R>, refinement: Refinement<A, B>): Stream<B, E, R>
  <A, E, R>(self: Stream<A, E, R>, predicate: Predicate<A>): Stream<A, E, R>
} = dual(
  2,
  <A, E, R>(self: Stream<A, E, R>, predicate: Predicate<NoInfer<A>>): Stream<A, E, R> =>
    fromChannel(Channel.filterArray(toChannel(self), predicate))
)

/**
 * @since 2.0.0
 * @category Filtering
 */
export const filterMap: {
  <A, B, X>(filter: Filter.Filter<A, B, X>): <E, R>(self: Stream<A, E, R>) => Stream<B, E, R>
  <A, E, R, B, X>(self: Stream<A, E, R>, filter: Filter.Filter<A, B, X>): Stream<B, E, R>
} = dual(
  2,
  <A, E, R, B, X>(self: Stream<A, E, R>, filter: Filter.Filter<A, B, X>): Stream<B, E, R> =>
    fromChannel(Channel.filterMapArray(toChannel(self), filter))
)

/**
 * @since 2.0.0
 * @category Filtering
 */
export const filterMapEffect: {
  <A, B, X, EX, RX>(
    filter: Filter.FilterEffect<A, B, X, EX, RX>
  ): <E, R>(self: Stream<A, E, R>) => Stream<B, E | EX, R | RX>
  <A, E, R, B, X, EX, RX>(
    self: Stream<A, E, R>,
    filter: Filter.FilterEffect<A, B, X, EX, RX>
  ): Stream<B, E | EX, R | RX>
} = dual(
  2,
  <A, E, R, B, X, EX, RX>(
    self: Stream<A, E, R>,
    filter: Filter.FilterEffect<A, B, X, EX, RX>
  ): Stream<B, E | EX, R | RX> => fromChannel(Channel.filterMapArrayEffect(toChannel(self), filter))
)

/**
 * @since 2.0.0
 * @category Filtering
 */
export const partitionFilter: {
  <A, B, X>(filter: Filter.Filter<A, B, X>, options?: {
    readonly capacity?: number | "unbounded" | undefined
  }): <E, R>(self: Stream<A, E, R>) => Effect.Effect<
    [
      passes: Stream<B, E>,
      fails: Stream<X, E>
    ],
    never,
    R | Scope.Scope
  >
  <A, E, R, B, X>(self: Stream<A, E, R>, filter: Filter.Filter<A, B, X>, options?: {
    readonly capacity?: number | "unbounded" | undefined
  }): Effect.Effect<
    [
      passes: Stream<B, E>,
      fails: Stream<X, E>
    ],
    never,
    R | Scope.Scope
  >
} = dual(
  (args) => isStream(args[0]),
  <A, E, R, B, X>(self: Stream<A, E, R>, filter: Filter.Filter<A, B, X>, options?: {
    readonly capacity?: number | "unbounded" | undefined
  }): Effect.Effect<
    [
      passes: Stream<B, E>,
      fails: Stream<X, E>
    ],
    never,
    R | Scope.Scope
  > =>
    Effect.map(
      partitionFilterQueue(filter, options)(self),
      ([passes, fails]) => [fromQueue(passes), fromQueue(fails)] as const
    )
)

/**
 * @since 4.0.0
 * @category Filtering
 */
export const partitionFilterQueue: {
  <A, B, X>(filter: Filter.Filter<A, B, X>, options?: {
    readonly capacity?: number | "unbounded" | undefined
  }): <E, R>(self: Stream<A, E, R>) => Effect.Effect<
    [
      passes: Queue.Dequeue<B, E | Cause.Done>,
      fails: Queue.Dequeue<X, E | Cause.Done>
    ],
    never,
    R | Scope.Scope
  >
  <A, E, R, B, X>(self: Stream<A, E, R>, filter: Filter.Filter<A, B, X>, options?: {
    readonly capacity?: number | "unbounded" | undefined
  }): Effect.Effect<
    [
      passes: Queue.Dequeue<B, E | Cause.Done>,
      fails: Queue.Dequeue<X, E | Cause.Done>
    ],
    never,
    R | Scope.Scope
  >
} = dual(
  (args) => isStream(args[0]),
  Effect.fnUntraced(function*<A, E, R, B, X>(self: Stream<A, E, R>, filter: Filter.Filter<A, B, X>, options?: {
    readonly capacity?: number | "unbounded" | undefined
  }): Effect.fn.Return<
    [
      passes: Queue.Dequeue<B, E | Cause.Done>,
      fails: Queue.Dequeue<X, E | Cause.Done>
    ],
    never,
    R | Scope.Scope
  > {
    const scope = yield* Effect.scope
    const pull = yield* Channel.toPullScoped(self.channel, scope)
    const capacity = options?.capacity === "unbounded" ? undefined : options?.capacity ?? DefaultChunkSize
    const passes = yield* Queue.make<B, E | Cause.Done>({ capacity })
    const fails = yield* Queue.make<X, E | Cause.Done>({ capacity })

    const partition = Arr.partitionFilter(filter)

    yield* Effect.gen(function*() {
      while (true) {
        const chunk = yield* pull
        const results = partition(chunk)
        let passFiber: Fiber.Fiber<any> | undefined = undefined
        if (results[0].length > 0) {
          const leftover = Queue.offerAllUnsafe(passes, results[0])
          if (leftover.length > 0) {
            passFiber = yield* Effect.forkChild(Queue.offerAll(passes, leftover))
          }
        }
        if (results[1].length > 0) {
          const leftover = Queue.offerAllUnsafe(fails, results[1])
          if (leftover.length > 0) {
            yield* Queue.offerAll(fails, leftover)
          }
        }
        if (passFiber) yield* Fiber.join(passFiber)
      }
    }).pipe(
      Effect.onError((cause) => {
        Queue.failCauseUnsafe(passes, cause)
        Queue.failCauseUnsafe(fails, cause)
        return Effect.void
      }),
      Effect.forkIn(scope)
    )

    return [passes, fails]
  })
)

/**
 * @since 4.0.0
 * @category Filtering
 */
export const partitionFilterEffect: {
  <A, B, X, EX, RX>(filter: Filter.FilterEffect<A, B, X, EX, RX>, options?: {
    readonly capacity?: number | "unbounded" | undefined
    readonly concurrency?: number | "unbounded" | undefined
  }): <E, R>(self: Stream<A, E, R>) => Effect.Effect<
    [
      passes: Stream<B, E | EX>,
      fails: Stream<X, E | EX>
    ],
    never,
    R | RX | Scope.Scope
  >
  <A, E, R, B, X, EX, RX>(self: Stream<A, E, R>, filter: Filter.FilterEffect<A, B, X, EX, RX>, options?: {
    readonly capacity?: number | "unbounded" | undefined
    readonly concurrency?: number | "unbounded" | undefined
  }): Effect.Effect<
    [
      passes: Stream<B, E | EX>,
      fails: Stream<X, E | EX>
    ],
    never,
    R | RX | Scope.Scope
  >
} = dual(
  (args) => isStream(args[0]),
  <A, E, R, B, X, EX, RX>(self: Stream<A, E, R>, filter: Filter.FilterEffect<A, B, X, EX, RX>, options?: {
    readonly capacity?: number | "unbounded" | undefined
    readonly concurrency?: number | "unbounded" | undefined
  }): Effect.Effect<
    [
      passes: Stream<B, E | EX>,
      fails: Stream<X, E | EX>
    ],
    never,
    R | RX | Scope.Scope
  > =>
    self.pipe(
      mapEffect(filter, options),
      partitionFilter(identity, options)
    )
)

/**
 * Splits a stream into two substreams based on a predicate.
 *
 * The faster stream may advance up to `bufferSize` elements ahead of the slower
 * one.
 *
 * @since 4.0.0
 * @category Filtering
 */
export const partition: {
  <C extends A, B extends A, A = C>(
    refinement: Refinement<NoInfer<A>, B>,
    options?: { readonly bufferSize?: number | undefined }
  ): <E, R>(
    self: Stream<C, E, R>
  ) => Effect.Effect<
    [excluded: Stream<Exclude<C, B>, E>, satisfying: Stream<B, E>],
    never,
    R | Scope.Scope
  >
  <A>(
    predicate: Predicate<NoInfer<A>>,
    options?: { readonly bufferSize?: number | undefined }
  ): <E, R>(
    self: Stream<A, E, R>
  ) => Effect.Effect<
    [excluded: Stream<A, E>, satisfying: Stream<A, E>],
    never,
    R | Scope.Scope
  >
  <C extends A, E, R, B extends A, A = C>(
    self: Stream<C, E, R>,
    refinement: Refinement<A, B>,
    options?: { readonly bufferSize?: number | undefined }
  ): Effect.Effect<
    [excluded: Stream<Exclude<C, B>, E>, satisfying: Stream<B, E>],
    never,
    R | Scope.Scope
  >
  <A, E, R>(
    self: Stream<A, E, R>,
    predicate: Predicate<A>,
    options?: { readonly bufferSize?: number | undefined }
  ): Effect.Effect<
    [excluded: Stream<A, E>, satisfying: Stream<A, E>],
    never,
    R | Scope.Scope
  >
} = dual(
  (args) => isStream(args[0]),
  <A, E, R>(
    self: Stream<A, E, R>,
    predicate: Predicate<NoInfer<A>>,
    options?: { readonly bufferSize?: number | undefined }
  ): Effect.Effect<
    [excluded: Stream<A, E>, satisfying: Stream<A, E>],
    never,
    R | Scope.Scope
  > =>
    Effect.map(
      partitionFilter(self, Filter.fromPredicate(predicate), { capacity: options?.bufferSize ?? 16 }),
      ([passes, fails]) => [fails, passes] as const
    )
)

/**
 * Returns the specified stream if the given condition is satisfied, otherwise
 * returns an empty stream.
 *
 * @since 2.0.0
 * @category Filtering
 */
export const when: {
  <EX = never, RX = never>(
    test: LazyArg<boolean> | Effect.Effect<boolean, EX, RX>
  ): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E | EX, R | RX>
  <A, E, R, EX = never, RX = never>(
    self: Stream<A, E, R>,
    test: LazyArg<boolean> | Effect.Effect<boolean, EX, RX>
  ): Stream<A, E | EX, R | RX>
} = dual(2, <A, E, R, EX = never, RX = never>(
  self: Stream<A, E, R>,
  test: LazyArg<boolean> | Effect.Effect<boolean, EX, RX>
): Stream<A, E | EX, R | RX> => {
  const effect = Effect.isEffect(test) ? test : Effect.sync(test)
  return effect.pipe(
    Effect.map((pass) => pass ? self : empty),
    unwrap
  )
})

/**
 * Peels off enough material from the stream to construct a `Z` using the
 * provided `Sink` and then returns both the `Z` and the rest of the
 * `Stream` in a scope. Like all scoped values, the provided stream is
 * valid only within the scope.
 *
 * @since 2.0.0
 * @category utils
 */
export const peel: {
  <A2, A, E2, R2>(
    sink: Sink.Sink<A2, A, A, E2, R2>
  ): <E, R>(self: Stream<A, E, R>) => Effect.Effect<[A2, Stream<A, E, never>], E2 | E, Scope.Scope | R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    sink: Sink.Sink<A2, A, A, E2, R2>
  ): Effect.Effect<[A2, Stream<A, E, never>], E | E2, Scope.Scope | R | R2>
} = dual(
  2,
  Effect.fnUntraced(function*<A, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    sink: Sink.Sink<A2, A, A, E2, R2>
  ): Effect.fn.Return<[A2, Stream<A, E, never>], E | E2, Scope.Scope | R | R2> {
    let cause: Cause.Cause<E | Cause.Done<void>> | undefined = undefined
    const originalPull = yield* Channel.toPull(self.channel)
    const pull: Pull.Pull<
      Arr.NonEmptyReadonlyArray<A>,
      E
    > = Effect.catchCause(originalPull, (cause_) => {
      cause = cause_
      return Effect.failCause(cause_)
    })

    let stream = fromPull(Effect.succeed(pull)) as Stream<A, E>
    const leftover = yield* run(stream, sink)
    if (cause) return [leftover, empty]

    stream = fromPull(Effect.succeed(originalPull))
    return [leftover, stream]
  })
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
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Stream.bufferChunks`
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
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Stream.catchAllCause`
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
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

/**
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Stream.tapErrorCause`
 *
 * @since 4.0.0
 * @category Error handling
 */
export const tapCause: {
  <E, A2, E2, R2>(
    f: (cause: Cause.Cause<E>) => Effect.Effect<A2, E2, R2>
  ): <A, R>(self: Stream<A, E, R>) => Stream<A, E | E2, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    f: (cause: Cause.Cause<E>) => Effect.Effect<A2, E2, R2>
  ): Stream<A, E | E2, R | R2>
} = dual(2, <A, E, R, A2, E2, R2>(
  self: Stream<A, E, R>,
  f: (cause: Cause.Cause<E>) => Effect.Effect<A2, E2, R2>
): Stream<A, E | E2, R | R2> =>
  self.channel.pipe(
    Channel.tapCause(f),
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
   * **Previously Known As**
   *
   * This API replaces the following from Effect 3.x:
   *
   * - `Stream.catchAll`
   *
   * @since 4.0.0
   * @category Error handling
   */
  catch_ as catch
}

/**
 * Recovers from specific errors based on a predicate.
 *
 * @example
 * ```ts
 * import { Stream } from "effect"
 *
 * class HttpError {
 *   readonly _tag = "HttpError"
 * }
 *
 * const stream = Stream.fail(new HttpError())
 *
 * const recovered = stream.pipe(
 *   Stream.catchIf(
 *     (error) => error._tag === "HttpError",
 *     () => Stream.make("recovered")
 *   )
 * )
 * ```
 *
 * @since 4.0.0
 * @category Error handling
 */
export const catchIf: {
  <E, EB extends E, A2, E2, R2>(
    refinement: Refinement<NoInfer<E>, EB>,
    f: (e: EB) => Stream<A2, E2, R2>
  ): <A, R>(self: Stream<A, E, R>) => Stream<A2 | A, E2 | Exclude<E, EB>, R2 | R>
  <E, A2, E2, R2>(
    predicate: Predicate<NoInfer<E>>,
    f: (e: NoInfer<E>) => Stream<A2, E2, R2>
  ): <A, R>(self: Stream<A, E, R>) => Stream<A2 | A, E | E2, R2 | R>
  <A, E, R, EB extends E, A2, E2, R2>(
    self: Stream<A, E, R>,
    refinement: Refinement<E, EB>,
    f: (e: EB) => Stream<A2, E2, R2>
  ): Stream<A | A2, E2 | Exclude<E, EB>, R | R2>
  <A, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    predicate: Predicate<E>,
    f: (e: E) => Stream<A2, E2, R2>
  ): Stream<A | A2, E | E2, R | R2>
} = dual(3, <A, E, R, EB extends E, A2, E2, R2>(
  self: Stream<A, E, R>,
  predicate: Predicate<E> | Refinement<E, EB>,
  f: (e: EB) => Stream<A2, E2, R2>
): Stream<A | A2, E | E2, R | R2> =>
  catchFilter(self, Filter.fromPredicate(predicate as Predicate<E>), f as any) as any)

/**
 * @since 4.0.0
 * @category Error handling
 */
export const tapError: {
  <E, A2, E2, R2>(
    f: (error: E) => Effect.Effect<A2, E2, R2>
  ): <A, R>(self: Stream<A, E, R>) => Stream<A, E | E2, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Stream<A, E, R>,
    f: (error: E) => Effect.Effect<A2, E2, R2>
  ): Stream<A, E | E2, R | R2>
} = dual(2, <A, E, R, A2, E2, R2>(
  self: Stream<A, E, R>,
  f: (error: E) => Effect.Effect<A2, E2, R2>
): Stream<A, E | E2, R | R2> =>
  self.channel.pipe(
    Channel.tapError(f),
    fromChannel
  ))

/**
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Stream.catchSome`
 *
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
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Stream.catchSomeCause`
 *
 * @example
 * ```ts
 * import { Cause, Stream } from "effect"
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
 * import { Stream } from "effect"
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
 * When the stream fails, retry it according to the given schedule
 *
 * This retries the entire stream, so will re-execute all of the stream's
 * acquire operations.
 *
 * The schedule is reset as soon as the first element passes through the
 * stream again.
 *
 * @since 2.0.0
 * @category Error handling
 */
export const retry: {
  <E, X, E2, R2>(
    policy: Schedule.Schedule<X, NoInfer<E>, E2, R2>
  ): <A, R>(self: Stream<A, E, R>) => Stream<A, E | E2, R2 | R>
  <A, E, R, X, E2, R2>(
    self: Stream<A, E, R>,
    policy: Schedule.Schedule<X, NoInfer<E>, E2, R2>
  ): Stream<A, E | E2, R2 | R>
} = dual(
  2,
  <A, E, R, X, E2, R2>(
    self: Stream<A, E, R>,
    policy: Schedule.Schedule<X, NoInfer<E>, E2, R2>
  ): Stream<A, E | E2, R2 | R> => fromChannel(Channel.retry(self.channel, policy))
)

/**
 * Apply an `ExecutionPlan` to the stream, which allows you to fallback to
 * different resources in case of failure.
 *
 * If you have a stream that could fail with partial results, you can use
 * the `preventFallbackOnPartialStream` option to prevent contamination of
 * the final stream with partial results.
 *
 * @since 3.16.0
 * @category Error handling
 * @experimental
 */
export const withExecutionPlan: {
  <Input, R2, Provides, PolicyE>(
    policy: ExecutionPlan.ExecutionPlan<{ provides: Provides; input: Input; error: PolicyE; requirements: R2 }>,
    options?: { readonly preventFallbackOnPartialStream?: boolean | undefined }
  ): <A, E extends Input, R>(self: Stream<A, E, R>) => Stream<A, E | PolicyE, R2 | Exclude<R, Provides>>
  <A, E extends Input, R, R2, Input, Provides, PolicyE>(
    self: Stream<A, E, R>,
    policy: ExecutionPlan.ExecutionPlan<{ provides: Provides; input: Input; error: PolicyE; requirements: R2 }>,
    options?: { readonly preventFallbackOnPartialStream?: boolean | undefined }
  ): Stream<A, E | PolicyE, R2 | Exclude<R, Provides>>
} = dual((args) => isStream(args[0]), <A, E extends Input, R, R2, Input, Provides, PolicyE>(
  self: Stream<A, E, R>,
  policy: ExecutionPlan.ExecutionPlan<{
    provides: Provides
    input: Input
    error: PolicyE
    requirements: R2
  }>,
  options?: {
    readonly preventFallbackOnPartialStream?: boolean | undefined
  }
): Stream<A, E | PolicyE, R2 | Exclude<R, Provides>> =>
  suspend(() => {
    const preventFallbackOnPartialStream = options?.preventFallbackOnPartialStream ?? false
    let i = 0
    let meta: ExecutionPlan.Metadata = {
      attempt: 0,
      stepIndex: 0
    }
    const provideMeta = provideServiceEffect(
      ExecutionPlan.CurrentMetadata,
      Effect.sync(() => {
        meta = {
          attempt: meta.attempt + 1,
          stepIndex: i
        }
        return meta
      })
    )
    let lastError = Option.none<E | PolicyE>()
    const loop: Stream<
      A,
      E | PolicyE,
      R2 | Exclude<R, Provides>
    > = suspend(() => {
      const step = policy.steps[i]
      if (!step) {
        return fail(Option.getOrThrow(lastError))
      }

      let nextStream: Stream<A, E | PolicyE, R2 | Exclude<R, Provides>> = provideMeta(provide(self, step.provide))
      let receivedElements = false

      if (Option.isSome(lastError)) {
        const error = lastError.value
        let attempted = false
        const wrapped = nextStream
        // ensure the schedule is applied at least once
        nextStream = suspend(() => {
          if (attempted) return wrapped
          attempted = true
          return fail(error)
        })
        nextStream = retry(nextStream, internalExecutionPlan.scheduleFromStep(step, false) as any)
      } else {
        const schedule = internalExecutionPlan.scheduleFromStep(step, true)
        nextStream = schedule ? retry(nextStream, schedule as any) : nextStream
      }

      return catch_(
        preventFallbackOnPartialStream ?
          onFirst(nextStream, (_) => {
            receivedElements = true
            return Effect.void
          }) :
          nextStream,
        (error) => {
          i++
          if (preventFallbackOnPartialStream && receivedElements) {
            return fail(error)
          }
          lastError = Option.some(error)
          return loop
        }
      )
    })
    return loop
  }))

/**
 * Takes the specified number of elements from this stream.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
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
 * Takes the last specified number of elements from this stream.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const stream = Stream.takeRight(Stream.make(1, 2, 3, 4, 5, 6), 3)
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // { _id: 'Chunk', values: [ 4, 5, 6 ] }
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const takeRight: {
  (n: number): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E, R>
  <A, E, R>(self: Stream<A, E, R>, n: number): Stream<A, E, R>
} = dual(
  2,
  <A, E, R>(self: Stream<A, E, R>, n: number): Stream<A, E, R> =>
    mapAccumArray(self, MutableList.make<A>, (list, arr) => {
      MutableList.appendAll(list, arr)
      if (list.length > n) {
        MutableList.takeNVoid(list, list.length - n)
      }
      return [list, emptyArr]
    }, {
      onHalt(list) {
        return MutableList.takeAll(list)
      }
    })
)

/**
 * Takes all elements of the stream until the specified predicate evaluates to
 * `true`.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5, 6)
 *
 * // Take until we find a number greater than 3
 * const taken = stream.pipe(
 *   Stream.takeUntil((n) => n > 3)
 * )
 *
 * Effect.runPromise(Stream.runCollect(taken)).then(console.log)
 *
 * // Exclude the element that satisfies the predicate
 * const takenExclusive = stream.pipe(
 *   Stream.takeUntil((n) => n > 3, { excludeLast: true })
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
          Effect.suspend(() => done ? Cause.done() : pull),
          (chunk) => {
            const index = chunk.findIndex((a) => predicate(a, i++))
            if (index >= 0) {
              done = true
              const arr = chunk.slice(0, options?.excludeLast ? index : index + 1)
              return Arr.isReadonlyArrayNonEmpty(arr) ? Effect.succeed(arr) : Cause.done()
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
 * import { Effect, Stream } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 * const result = Stream.takeUntilEffect(stream, (n) => Effect.succeed(n === 3))
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
        if (done) return yield* Cause.done()
        const chunk = yield* pull
        for (let j = 0; j < chunk.length; j++) {
          if (yield* predicate(chunk[j], i++)) {
            done = true
            const arr = chunk.slice(0, options?.excludeLast ? j : j + 1)
            return Arr.isReadonlyArrayNonEmpty(arr) ? arr : yield* Cause.done()
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
 * import { Effect, Stream } from "effect"
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
 * import { Effect, Stream } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 * const result = Stream.takeWhileEffect(stream, (n) => Effect.succeed(n < 4))
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
 * import { Effect, Stream } from "effect"
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
 * Drops all elements of the stream until the specified predicate evaluates to
 * `true`.
 *
 * @since 2.0.0
 * @category utils
 */
export const dropUntil: {
  <A>(predicate: (a: NoInfer<A>, index: number) => boolean): <E, R>(self: Stream<A, E, R>) => Stream<A, E, R>
  <A, E, R>(self: Stream<A, E, R>, predicate: (a: NoInfer<A>, index: number) => boolean): Stream<A, E, R>
} = dual(2, <A, E, R>(
  self: Stream<A, E, R>,
  predicate: (a: NoInfer<A>, index: number) => boolean
): Stream<A, E, R> => drop(dropWhile(self, (a, i) => !predicate(a, i)), 1))

/**
 * Drops all elements of the stream until the specified effectful predicate
 * evaluates to `true`.
 *
 * @since 2.0.0
 * @category utils
 */
export const dropUntilEffect: {
  <A, E2, R2>(
    predicate: (a: NoInfer<A>, index: number) => Effect.Effect<boolean, E2, R2>
  ): <E, R>(self: Stream<A, E, R>) => Stream<A, E2 | E, R2 | R>
  <A, E, R, E2, R2>(
    self: Stream<A, E, R>,
    predicate: (a: NoInfer<A>, index: number) => Effect.Effect<boolean, E2, R2>
  ): Stream<A, E | E2, R | R2>
} = dual(2, <A, E, R, E2, R2>(
  self: Stream<A, E, R>,
  predicate: (a: NoInfer<A>, index: number) => Effect.Effect<boolean, E2, R2>
): Stream<A, E | E2, R | R2> =>
  drop(
    dropWhileEffect(
      self,
      (a, i) => Effect.map(predicate(a, i), (b) => !b)
    ),
    1
  ))

/**
 * Drops all elements of the stream for as long as the specified predicate
 * evaluates to `true`.
 *
 * @since 2.0.0
 * @category utils
 */
export const dropWhile: {
  <A>(predicate: (a: NoInfer<A>, index: number) => boolean): <E, R>(self: Stream<A, E, R>) => Stream<A, E, R>
  <A, E, R>(self: Stream<A, E, R>, predicate: (a: NoInfer<A>, index: number) => boolean): Stream<A, E, R>
} = dual(2, <A, E, R>(
  self: Stream<A, E, R>,
  predicate: (a: NoInfer<A>, index: number) => boolean
): Stream<A, E, R> =>
  transformPull(self, (pull, _scope) =>
    Effect.sync(() => {
      let dropping = true
      let index = 0
      const filtered: Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E> = Effect.flatMap(pull, (arr) => {
        const found = arr.findIndex((a) => !predicate(a, index++))
        if (found === -1) return filtered
        dropping = false
        return Effect.succeed(arr.slice(found) as Arr.NonEmptyArray<A>)
      })
      return Effect.suspend(() => dropping ? filtered : pull)
    })))

/**
 * Drops all elements of the stream for as long as the specified predicate
 * produces an effect that evalutates to `true`
 *
 * @since 2.0.0
 * @category utils
 */
export const dropWhileEffect: {
  <A, E2, R2>(
    predicate: (a: NoInfer<A>, index: number) => Effect.Effect<boolean, E2, R2>
  ): <E, R>(self: Stream<A, E, R>) => Stream<A, E2 | E, R2 | R>
  <A, E, R, E2, R2>(
    self: Stream<A, E, R>,
    predicate: (a: A, index: number) => Effect.Effect<boolean, E2, R2>
  ): Stream<A, E | E2, R | R2>
} = dual(2, <A, E, R, E2, R2>(
  self: Stream<A, E, R>,
  predicate: (a: NoInfer<A>, index: number) => Effect.Effect<boolean, E2, R2>
): Stream<A, E | E2, R | R2> =>
  transformPull(self, (pull, _scope) =>
    Effect.sync(() => {
      let dropping = true
      let index = 0
      const filtered: Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E | E2, void, R2> = Effect.gen(function*() {
        while (true) {
          const arr = yield* pull
          for (let i = 0; i < arr.length; i++) {
            const drop = yield* predicate(arr[i], index++)
            if (drop) continue
            dropping = false
            return arr.slice(i) as Arr.NonEmptyArray<A>
          }
        }
      })
      return Effect.suspend((): Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E | E2, void, R | R2> =>
        dropping ? filtered : pull
      )
    })))

/**
 * Drops the last specified number of elements from this stream.
 *
 * @since 2.0.0
 * @category utils
 */
export const dropRight: {
  (n: number): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E, R>
  <A, E, R>(self: Stream<A, E, R>, n: number): Stream<A, E, R>
} = dual(
  2,
  <A, E, R>(self: Stream<A, E, R>, n: number): Stream<A, E, R> => {
    if (n <= 0) return self
    return transformPull(self, (pull, _scope) =>
      Effect.sync(() => {
        const list = MutableList.make<A>()
        const emit: Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E> = Effect.flatMap(pull, (arr) => {
          MutableList.appendAllUnsafe(list, arr)
          const toTake = list.length - n
          const items = MutableList.takeN(list, toTake)
          return Arr.isArrayNonEmpty(items) ? Effect.succeed(items) : emit
        })
        return emit
      }))
  }
)

/**
 * Exposes the underlying chunks of the stream as a stream of chunks of
 * elements.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
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
        if (done) return Cause.done()
        else if (current === undefined) {
          return Effect.flatMap(pull, (arr) => {
            if (chunk.length === 0 && arr.length === target) {
              return Effect.succeed(arr)
            } else if (chunk.length + arr.length < target) {
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
        Pull.catchDone(() => {
          if (chunk.length === 0) return Cause.done()
          const result = chunk
          done = true
          chunk = [] as any
          return Effect.succeed(result)
        })
      )
    }))
})

/**
 * Emits a sliding window of `n` elements.
 *
 * @since 2.0.0
 * @category utils
 */
export const sliding: {
  (chunkSize: number): <A, E, R>(self: Stream<A, E, R>) => Stream<Arr.NonEmptyReadonlyArray<A>, E, R>
  <A, E, R>(self: Stream<A, E, R>, chunkSize: number): Stream<Arr.NonEmptyReadonlyArray<A>, E, R>
} = dual(
  2,
  <A, E, R>(self: Stream<A, E, R>, chunkSize: number): Stream<Arr.NonEmptyReadonlyArray<A>, E, R> =>
    slidingSize(self, chunkSize, 1)
)

/**
 * Like `sliding`, but with a configurable `stepSize` parameter.
 *
 * @since 2.0.0
 * @category utils
 */
export const slidingSize: {
  (chunkSize: number, stepSize: number): <A, E, R>(self: Stream<A, E, R>) => Stream<Arr.NonEmptyReadonlyArray<A>, E, R>
  <A, E, R>(self: Stream<A, E, R>, chunkSize: number, stepSize: number): Stream<Arr.NonEmptyReadonlyArray<A>, E, R>
} = dual(
  3,
  <A, E, R>(self: Stream<A, E, R>, chunkSize: number, stepSize: number): Stream<Arr.NonEmptyReadonlyArray<A>, E, R> =>
    transformPull(self, (upstream, _scope) =>
      Effect.sync(() => {
        let cause: Cause.Cause<E | Cause.Done> | null = null
        const list = MutableList.make<A>()
        let emitted = false
        const pull: Pull.Pull<
          Arr.NonEmptyReadonlyArray<Arr.NonEmptyReadonlyArray<A>>,
          E | Cause.Done
        > = Effect.matchCauseEffect(upstream, {
          onSuccess(arr) {
            MutableList.appendAllUnsafe(list, arr)
            if (list.length < chunkSize) return pull
            emitted = true
            const chunks = [] as any as Arr.NonEmptyArray<Arr.NonEmptyReadonlyArray<A>>
            while (list.length >= chunkSize) {
              if (chunkSize === stepSize) {
                chunks.push(MutableList.takeN(list, chunkSize) as any)
              } else {
                chunks.push(MutableList.toArrayN(list, chunkSize) as any)
                if (chunkSize === 1) {
                  MutableList.take(list)
                } else {
                  MutableList.takeNVoid(list, stepSize)
                }
              }
            }
            return Effect.succeed(chunks)
          },
          onFailure(cause_) {
            if (emitted) MutableList.takeNVoid(list, chunkSize - stepSize)
            if (list.length === 0) return Effect.failCause(cause_)
            cause = cause_
            return Effect.succeed(Arr.of(MutableList.takeAll(list) as any))
          }
        })

        return Effect.suspend(() => cause ? Effect.failCause(cause) : pull)
      }))
)

/**
 * Splits elements based on a predicate or refinement.
 *
 * ```ts
 * import { pipe, Stream } from "effect"
 *
 * pipe(
 *   Stream.range(1, 10),
 *   Stream.split((n) => n % 4 === 0),
 *   Stream.runCollect
 * )
 * // => [[1, 2, 3], [5, 6, 7], [9, 10]]
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const split: {
  <A, B extends A>(
    refinement: Refinement<NoInfer<A>, B>
  ): <E, R>(self: Stream<A, E, R>) => Stream<Arr.NonEmptyReadonlyArray<Exclude<A, B>>, E, R>
  <A>(predicate: Predicate<NoInfer<A>>): <E, R>(self: Stream<A, E, R>) => Stream<Arr.NonEmptyReadonlyArray<A>, E, R>
  <A, E, R, B extends A>(
    self: Stream<A, E, R>,
    refinement: Refinement<A, B>
  ): Stream<Arr.NonEmptyReadonlyArray<Exclude<A, B>>, E, R>
  <A, E, R>(self: Stream<A, E, R>, predicate: Predicate<A>): Stream<Arr.NonEmptyReadonlyArray<A>, E, R>
} = dual(2, <A, E, R>(
  self: Stream<A, E, R>,
  predicate: Predicate<NoInfer<A>>
): Stream<Arr.NonEmptyReadonlyArray<A>, E, R> =>
  mapAccumArray(self, Arr.empty<A>, (acc, arr) => {
    const out = Arr.empty<Arr.NonEmptyReadonlyArray<A>>()
    for (let i = 0; i < arr.length; i++) {
      if (predicate(arr[i])) {
        if (Arr.isArrayNonEmpty(acc)) {
          out.push(acc)
          acc = []
        }
      } else {
        acc.push(arr[i])
      }
    }
    return [acc, out]
  }, {
    onHalt(arr) {
      return Arr.isArrayNonEmpty(arr) ? Arr.of(arr) : emptyArr
    }
  }))

/**
 * Combines the elements from this stream and the specified stream by
 * repeatedly applying the function `f` to extract an element using both sides
 * and conceptually "offer" it to the destination stream. `f` can maintain
 * some internal state to control the combining process, with the initial
 * state being specified by `s`.
 *
 * Where possible, prefer `Stream.combineArray` for a more efficient
 * implementation.
 *
 * @since 2.0.0
 * @category utils
 */
export const combine: {
  <A2, E2, R2, S, E, A, A3, E3, R3>(
    that: Stream<A2, E2, R2>,
    s: LazyArg<S>,
    f: (
      s: S,
      pullLeft: Pull.Pull<A, E, void>,
      pullRight: Pull.Pull<A2, E2, void>
    ) => Effect.Effect<readonly [A3, S], E3, R3>
  ): <R>(self: Stream<A, E, R>) => Stream<A3, E3, R2 | R3 | R>
  <A, E, R, A2, E2, R2, S, A3, E3, R3>(
    self: Stream<A, E, R>,
    that: Stream<A2, E2, R2>,
    s: LazyArg<S>,
    f: (
      s: S,
      pullLeft: Pull.Pull<A, E, void>,
      pullRight: Pull.Pull<A2, E2, void>
    ) => Effect.Effect<readonly [A3, S], E3, R3>
  ): Stream<A3, E3, R | R2 | R3>
} = dual(4, <A, E, R, A2, E2, R2, S, A3, E3, R3>(
  self: Stream<A, E, R>,
  that: Stream<A2, E2, R2>,
  s: LazyArg<S>,
  f: (
    s: S,
    pullLeft: Pull.Pull<A, E, void>,
    pullRight: Pull.Pull<A2, E2, void>
  ) => Effect.Effect<readonly [A3, S], E3, R3>
): Stream<A3, E3, R | R2 | R3> =>
  Channel.combine(
    Channel.flattenArray(self.channel),
    Channel.flattenArray(that.channel),
    s,
    f
  ).pipe(
    Channel.map(Arr.of),
    fromChannel
  ))

/**
 * Combines the elements from this stream and the specified stream by
 * repeatedly applying the function `f` to extract an array using both sides
 * and conceptually "offer" it to the destination stream. `f` can maintain
 * some internal state to control the combining process, with the initial
 * state being specified by `s`.
 *
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Stream.combineChunks`
 *
 * @since 2.0.0
 * @category utils
 */
export const combineArray: {
  <A2, E2, R2, S, E, A, A3, E3, R3>(
    that: Stream<A2, E2, R2>,
    s: LazyArg<S>,
    f: (
      s: S,
      pullLeft: Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E, void>,
      pullRight: Pull.Pull<Arr.NonEmptyReadonlyArray<A2>, E2, void>
    ) => Effect.Effect<readonly [Arr.NonEmptyReadonlyArray<A3>, S], E3, R3>
  ): <R>(self: Stream<A, E, R>) => Stream<A3, Pull.ExcludeDone<E3>, R2 | R3 | R>
  <R, A2, E2, R2, S, E, A, A3, E3, R3>(
    self: Stream<A, E, R>,
    that: Stream<A2, E2, R2>,
    s: LazyArg<S>,
    f: (
      s: S,
      pullLeft: Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E, void>,
      pullRight: Pull.Pull<Arr.NonEmptyReadonlyArray<A2>, E2, void>
    ) => Effect.Effect<readonly [Arr.NonEmptyReadonlyArray<A3>, S], E3, R3>
  ): Stream<A3, Pull.ExcludeDone<E3>, R | R2 | R3>
} = dual(4, <R, A2, E2, R2, S, E, A, A3, E3, R3>(
  self: Stream<A, E, R>,
  that: Stream<A2, E2, R2>,
  s: LazyArg<S>,
  f: (
    s: S,
    pullLeft: Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E, void>,
    pullRight: Pull.Pull<Arr.NonEmptyReadonlyArray<A2>, E2, void>
  ) => Effect.Effect<readonly [Arr.NonEmptyReadonlyArray<A3>, S], E3, R3>
): Stream<A3, Pull.ExcludeDone<E3>, R | R2 | R3> =>
  fromChannel(Channel.combine(
    self.channel,
    that.channel,
    s,
    f
  )))

/**
 * @since 2.0.0
 * @category sequencing
 */
export const mapAccum: {
  <S, A, B>(
    initial: LazyArg<S>,
    f: (s: S, a: A) => readonly [state: S, values: ReadonlyArray<B>],
    options?: {
      readonly onHalt?: ((state: S) => ReadonlyArray<B>) | undefined
    }
  ): <E, R>(self: Stream<A, E, R>) => Stream<B, E, R>
  <A, E, R, S, B>(
    self: Stream<A, E, R>,
    initial: LazyArg<S>,
    f: (s: S, a: A) => readonly [state: S, values: ReadonlyArray<B>],
    options?: {
      readonly onHalt?: ((state: S) => ReadonlyArray<B>) | undefined
    }
  ): Stream<B, E, R>
} = dual((args) => isStream(args[0]), <A, E, R, S, B>(
  self: Stream<A, E, R>,
  initial: LazyArg<S>,
  f: (s: S, a: A) => readonly [state: S, values: ReadonlyArray<B>],
  options?: {
    readonly onHalt?: ((state: S) => ReadonlyArray<B>) | undefined
  }
): Stream<B, E, R> =>
  fromChannel(Channel.mapAccum(
    self.channel,
    initial,
    (state, arr) => {
      const acc = Arr.empty<B>()
      for (let index = 0; index < arr.length; index++) {
        const [newState, values] = f(state, arr[index])
        state = newState
        acc.push(...values)
      }
      return [state, Arr.isArrayNonEmpty(acc) ? Arr.of(acc) : emptyArr]
    },
    options?.onHalt ?
      {
        onHalt(state) {
          const arr = options.onHalt!(state)
          return Arr.isReadonlyArrayNonEmpty(arr) ? Arr.of(arr) : emptyArr
        }
      } :
      undefined
  )))

/**
 * @since 2.0.0
 * @category sequencing
 */
export const mapAccumArray: {
  <S, A, B>(
    initial: LazyArg<S>,
    f: (s: S, a: Arr.NonEmptyReadonlyArray<A>) => readonly [state: S, values: ReadonlyArray<B>],
    options?: {
      readonly onHalt?: ((state: S) => ReadonlyArray<B>) | undefined
    }
  ): <E, R>(self: Stream<A, E, R>) => Stream<B, E, R>
  <A, E, R, S, B>(
    self: Stream<A, E, R>,
    initial: LazyArg<S>,
    f: (s: S, a: Arr.NonEmptyReadonlyArray<A>) => readonly [state: S, values: ReadonlyArray<B>],
    options?: {
      readonly onHalt?: ((state: S) => Array<B>) | undefined
    }
  ): Stream<B, E, R>
} = dual((args) => isStream(args[0]), <A, E, R, S, B>(
  self: Stream<A, E, R>,
  initial: LazyArg<S>,
  f: (s: S, a: Arr.NonEmptyReadonlyArray<A>) => readonly [state: S, values: ReadonlyArray<B>],
  options?: {
    readonly onHalt?: ((state: S) => ReadonlyArray<B>) | undefined
  }
): Stream<B, E, R> =>
  fromChannel(Channel.mapAccum(
    self.channel,
    initial,
    (state, arr) => {
      const [newState, values] = f(state, arr)
      state = newState
      return [state, Arr.isReadonlyArrayNonEmpty(values) ? Arr.of(values) : emptyArr]
    },
    options?.onHalt ?
      {
        onHalt(state) {
          const arr = options.onHalt!(state)
          return Arr.isReadonlyArrayNonEmpty(arr) ? Arr.of(arr) : emptyArr
        }
      } :
      undefined
  )))

const emptyArr = Arr.empty<never>()

/**
 * @since 2.0.0
 * @category sequencing
 */
export const mapAccumEffect: {
  <S, A, B, E2, R2>(
    initial: LazyArg<S>,
    f: (s: S, a: A) => Effect.Effect<readonly [state: S, values: ReadonlyArray<B>], E2, R2>,
    options?: {
      readonly onHalt?: ((state: S) => ReadonlyArray<B>) | undefined
    }
  ): <E, R>(self: Stream<A, E, R>) => Stream<B, E | E2, R | R2>
  <A, E, R, S, B, E2, R2>(
    self: Stream<A, E, R>,
    initial: LazyArg<S>,
    f: (s: S, a: A) => Effect.Effect<readonly [state: S, values: ReadonlyArray<B>], E2, R2>,
    options?: {
      readonly onHalt?: ((state: S) => ReadonlyArray<B>) | undefined
    }
  ): Stream<B, E | E2, R | R2>
} = dual((args) => isStream(args[0]), <A, E, R, S, B, E2, R2>(
  self: Stream<A, E, R>,
  initial: LazyArg<S>,
  f: (s: S, a: A) => Effect.Effect<readonly [state: S, values: ReadonlyArray<B>], E2, R2>,
  options?: {
    readonly onHalt?: ((state: S) => ReadonlyArray<B>) | undefined
  }
): Stream<B, E | E2, R | R2> =>
  self.channel.pipe(
    Channel.flattenArray,
    Channel.mapAccum(
      initial,
      (state, a) =>
        Effect.map(
          f(state, a),
          ([state, values]) => [
            state,
            Arr.isReadonlyArrayNonEmpty(values) ? Arr.of(values) : Arr.empty<Arr.NonEmptyReadonlyArray<B>>()
          ]
        ),
      options?.onHalt ?
        {
          onHalt(state) {
            const arr = options.onHalt!(state)
            return Arr.isReadonlyArrayNonEmpty(arr) ? Arr.of(arr) : emptyArr
          }
        } :
        undefined
    ),
    fromChannel
  ))

/**
 * @since 2.0.0
 * @category sequencing
 */
export const mapAccumArrayEffect: {
  <S, A, B, E2, R2>(
    initial: LazyArg<S>,
    f: (s: S, a: Arr.NonEmptyReadonlyArray<A>) => Effect.Effect<readonly [state: S, values: ReadonlyArray<B>], E2, R2>,
    options?: {
      readonly onHalt?: ((state: S) => ReadonlyArray<B>) | undefined
    }
  ): <E, R>(self: Stream<A, E, R>) => Stream<B, E | E2, R | R2>
  <A, E, R, S, B, E2, R2>(
    self: Stream<A, E, R>,
    initial: LazyArg<S>,
    f: (s: S, a: Arr.NonEmptyReadonlyArray<A>) => Effect.Effect<readonly [state: S, values: ReadonlyArray<B>], E2, R2>,
    options?: {
      readonly onHalt?: ((state: S) => ReadonlyArray<B>) | undefined
    }
  ): Stream<B, E | E2, R | R2>
} = dual((args) => isStream(args), <A, E, R, S, B, E2, R2>(
  self: Stream<A, E, R>,
  initial: LazyArg<S>,
  f: (s: S, a: Arr.NonEmptyReadonlyArray<A>) => Effect.Effect<readonly [state: S, values: ReadonlyArray<B>], E2, R2>,
  options?: {
    readonly onHalt?: ((state: S) => ReadonlyArray<B>) | undefined
  }
): Stream<B, E | E2, R | R2> =>
  self.channel.pipe(
    Channel.mapAccum(
      initial,
      (state, a) =>
        Effect.map(
          f(state, a),
          ([state, values]) => [
            state,
            Arr.isReadonlyArrayNonEmpty(values) ? Arr.of(values) : emptyArr
          ]
        ),
      options?.onHalt ?
        {
          onHalt(state) {
            const arr = options.onHalt!(state)
            return Arr.isReadonlyArrayNonEmpty(arr) ? Arr.of(arr) : emptyArr
          }
        } :
        undefined
    ),
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
 * @category Rate-limiting
 */
export const debounce: {
  (duration: Duration.DurationInput): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E, R>
  <A, E, R>(self: Stream<A, E, R>, duration: Duration.DurationInput): Stream<A, E, R>
} = dual(
  2,
  <A, E, R>(self: Stream<A, E, R>, duration: Duration.DurationInput): Stream<A, E, R> =>
    transformPull(
      self,
      Effect.fnUntraced(function*(pull, scope) {
        const clock = yield* Clock
        const durationMs = Duration.toMillis(Duration.fromDurationInputUnsafe(duration))
        let lastArr: Arr.NonEmptyReadonlyArray<A> | undefined
        let cause: Cause.Cause<Cause.Done | E> | undefined
        let emitAtMs = Infinity
        const pullLatch = Effect.makeLatchUnsafe()
        const emitLatch = Effect.makeLatchUnsafe()
        const endLatch = Effect.makeLatchUnsafe()

        yield* pull.pipe(
          pullLatch.whenOpen,
          Effect.flatMap((arr) => {
            emitLatch.openUnsafe()
            lastArr = arr
            emitAtMs = clock.currentTimeMillisUnsafe() + durationMs
            return Effect.void
          }),
          Effect.forever({ autoYield: false }),
          Effect.onError((cause_) => {
            cause = cause_
            emitAtMs = clock.currentTimeMillisUnsafe()
            emitLatch.openUnsafe()
            endLatch.openUnsafe()
            return Effect.void
          }),
          Effect.forkIn(scope)
        )

        const sleepLoop = Effect.suspend(function loop(): Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E, void, R> {
          const now = clock.currentTimeMillisUnsafe()
          const timeMs = emitAtMs < now ? durationMs : Math.min(durationMs, emitAtMs - now)
          return Effect.flatMap(Effect.raceFirst(Effect.sleep(timeMs), endLatch.await), () => {
            const now = clock.currentTimeMillisUnsafe()
            if (now < emitAtMs) {
              return loop()
            } else if (lastArr) {
              emitLatch.closeUnsafe()
              pullLatch.closeUnsafe()
              const eff = Effect.succeed(Arr.of(Arr.lastNonEmpty(lastArr)))
              lastArr = undefined
              return eff
            } else if (cause) {
              return Effect.failCause(cause!)
            }
            return loop()
          })
        })

        return Effect.suspend(() => {
          if (cause) {
            if (lastArr) {
              const eff = Effect.succeed(Arr.of(Arr.lastNonEmpty(lastArr)))
              lastArr = undefined
              return eff
            }
            return Effect.failCause(cause)
          }
          pullLatch.openUnsafe()
          return emitLatch.whenOpen(sleepLoop)
        })
      })
    )
)

/**
 * Delays the arrays of this stream according to the given bandwidth
 * parameters using the token bucket algorithm. Allows for burst in the
 * processing of elements by allowing the token bucket to accumulate tokens up
 * to a `units + burst` threshold. The weight of each array is determined by
 * the effectful `cost` function.
 *
 * If using the "enforce" strategy, arrays that do not meet the bandwidth
 * constraints are dropped. If using the "shape" strategy, arrays are delayed
 * until they can be emitted without exceeding the bandwidth constraints.
 *
 * Defaults to the "shape" strategy.
 *
 * @example
 * ```ts
 * import { Effect, Schedule, Stream } from "effect"
 *
 * // Using the "shape" strategy to delay elements
 * const stream = Stream.fromSchedule(Schedule.spaced("50 millis")).pipe(
 *   Stream.take(10),
 *   Stream.throttleEffect({
 *     // Cost function that returns an Effect
 *     cost: (arr) => Effect.succeed(arr.length),
 *     units: 1,
 *     duration: "100 millis",
 *     strategy: "shape"
 *   })
 * )
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // Elements are delayed to match the specified bandwidth
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const throttleEffect: {
  <A, E2, R2>(options: {
    readonly cost: (arr: Arr.NonEmptyReadonlyArray<A>) => Effect.Effect<number, E2, R2>
    readonly units: number
    readonly duration: Duration.DurationInput
    readonly burst?: number | undefined
    readonly strategy?: "enforce" | "shape" | undefined
  }): <E, R>(self: Stream<A, E, R>) => Stream<A, E2 | E, R2 | R>
  <A, E, R, E2, R2>(
    self: Stream<A, E, R>,
    options: {
      readonly cost: (arr: Arr.NonEmptyReadonlyArray<A>) => Effect.Effect<number, E2, R2>
      readonly units: number
      readonly duration: Duration.DurationInput
      readonly burst?: number | undefined
      readonly strategy?: "enforce" | "shape" | undefined
    }
  ): Stream<A, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, E2, R2>(
    self: Stream<A, E, R>,
    options: {
      readonly cost: (arr: Arr.NonEmptyReadonlyArray<A>) => Effect.Effect<number, E2, R2>
      readonly units: number
      readonly duration: Duration.DurationInput
      readonly burst?: number | undefined
      readonly strategy?: "enforce" | "shape" | undefined
    }
  ): Stream<A, E | E2, R | R2> => {
    const burst = options.burst ?? 0
    if (options.strategy === "enforce") {
      return throttleEnforceEffect(self, options.cost, options.units, options.duration, burst)
    }
    return throttleShapeEffect(self, options.cost, options.units, options.duration, burst)
  }
)

const throttleEnforceEffect = <A, E, R, E2, R2>(
  self: Stream<A, E, R>,
  cost: (arr: Arr.NonEmptyReadonlyArray<A>) => Effect.Effect<number, E2, R2>,
  units: number,
  duration: Duration.DurationInput,
  burst: number
): Stream<A, E | E2, R | R2> =>
  transformPull(self, (pull) =>
    Effect.clockWith((clock) => {
      const durationMs = Duration.toMillis(Duration.fromDurationInputUnsafe(duration))
      const max = units + burst < 0 ? Number.POSITIVE_INFINITY : units + burst
      let tokens = units
      let timestampMs = clock.currentTimeMillisUnsafe()

      return Effect.succeed(
        Effect.flatMap(pull, function loop(arr): Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E | E2, void, R | R2> {
          return Effect.flatMap(cost(arr), (weight) => {
            const currentMs = clock.currentTimeMillisUnsafe()
            const elapsed = currentMs - timestampMs
            const cycles = elapsed / durationMs
            const sum = tokens + (cycles * units)
            const available = sum < 0 ? max : Math.min(sum, max)

            if (weight <= available) {
              tokens = available - weight
              timestampMs = currentMs
              return Effect.succeed(arr)
            }

            // Drop the array and continue
            return Effect.flatMap(pull, loop)
          })
        })
      )
    }))

const throttleShapeEffect = <A, E, R, E2, R2>(
  self: Stream<A, E, R>,
  cost: (arr: Arr.NonEmptyReadonlyArray<A>) => Effect.Effect<number, E2, R2>,
  units: number,
  duration: Duration.DurationInput,
  burst: number
): Stream<A, E | E2, R | R2> =>
  transformPull(self, (pull) =>
    Effect.clockWith((clock) => {
      const durationMs = Duration.toMillis(Duration.fromDurationInputUnsafe(duration))
      const max = units + burst < 0 ? Number.POSITIVE_INFINITY : units + burst
      let tokens = units
      let timestampMs = clock.currentTimeMillisUnsafe()

      return Effect.succeed(Effect.flatMap(pull, (arr) =>
        Effect.flatMap(cost(arr), (weight) => {
          const currentMs = clock.currentTimeMillisUnsafe()
          const elapsed = currentMs - timestampMs
          const cycles = elapsed / durationMs
          const sum = tokens + (cycles * units)
          const available = sum < 0 ? max : Math.min(sum, max)
          const remaining = available - weight

          if (remaining >= 0) {
            tokens = remaining
            timestampMs = currentMs
            return Effect.succeed(arr)
          }

          // Calculate delay needed
          const waitCycles = -remaining / units
          const delayMs = Math.max(0, waitCycles * durationMs)

          if (delayMs > 0) {
            return Effect.flatMap(Effect.sleep(delayMs), () => {
              tokens = remaining
              timestampMs = currentMs
              return Effect.succeed(arr)
            })
          }

          tokens = remaining
          timestampMs = currentMs
          return Effect.succeed(arr)
        })))
    }))

/**
 * Delays the arrays of this stream according to the given bandwidth
 * parameters using the token bucket algorithm. Allows for burst in the
 * processing of elements by allowing the token bucket to accumulate tokens up
 * to a `units + burst` threshold. The weight of each array is determined by
 * the `cost` function.
 *
 * If using the "enforce" strategy, arrays that do not meet the bandwidth
 * constraints are dropped. If using the "shape" strategy, arrays are delayed
 * until they can be emitted without exceeding the bandwidth constraints.
 *
 * Defaults to the "shape" strategy.
 *
 * @example
 * ```ts
 * import { Effect, Schedule, Stream } from "effect"
 *
 * // Rate limiting a stream to 1 element per 100ms using array length as cost
 * const stream = Stream.fromSchedule(Schedule.spaced("50 millis")).pipe(
 *   Stream.take(6),
 *   Stream.throttle({
 *     cost: (arr) => arr.length,
 *     units: 1,
 *     duration: "100 millis",
 *     strategy: "shape"
 *   })
 * )
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // Output: [0, 1, 2, 3, 4, 5]
 * // Elements are emitted respecting the bandwidth constraints
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const throttle: {
  <A>(options: {
    readonly cost: (arr: Arr.NonEmptyReadonlyArray<A>) => number
    readonly units: number
    readonly duration: Duration.DurationInput
    readonly burst?: number | undefined
    readonly strategy?: "enforce" | "shape" | undefined
  }): <E, R>(self: Stream<A, E, R>) => Stream<A, E, R>
  <A, E, R>(
    self: Stream<A, E, R>,
    options: {
      readonly cost: (arr: Arr.NonEmptyReadonlyArray<A>) => number
      readonly units: number
      readonly duration: Duration.DurationInput
      readonly burst?: number | undefined
      readonly strategy?: "enforce" | "shape" | undefined
    }
  ): Stream<A, E, R>
} = dual(
  2,
  <A, E, R>(
    self: Stream<A, E, R>,
    options: {
      readonly cost: (arr: Arr.NonEmptyReadonlyArray<A>) => number
      readonly units: number
      readonly duration: Duration.DurationInput
      readonly burst?: number | undefined
      readonly strategy?: "enforce" | "shape" | undefined
    }
  ): Stream<A, E, R> =>
    throttleEffect(self, {
      ...options,
      cost: (arr) => Effect.succeed(options.cost(arr))
    })
)

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
 * Partitions the stream with the specified `chunkSize` or until the specified
 * `duration` has passed, whichever is satisfied first.
 *
 * @since 2.0.0
 * @category Grouping
 */
export const groupedWithin: {
  (
    chunkSize: number,
    duration: Duration.DurationInput
  ): <A, E, R>(self: Stream<A, E, R>) => Stream<Array<A>, E, R>
  <A, E, R>(self: Stream<A, E, R>, chunkSize: number, duration: Duration.DurationInput): Stream<Array<A>, E, R>
} = dual(3, <A, E, R>(
  self: Stream<A, E, R>,
  chunkSize: number,
  duration: Duration.DurationInput
): Stream<Array<A>, E, R> =>
  aggregateWithin(
    self,
    Sink.take(chunkSize),
    Schedule.spaced(duration)
  ))

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
    queues: RcMap.RcMap<K, Queue.Queue<V, Cause.Done>>,
    queueMap: MutableHashMap.MutableHashMap<K, Queue.Queue<V, Cause.Done>>
  ) => Effect.Effect<void, E2, R2>,
  options?: {
    readonly bufferSize?: number | undefined
    readonly idleTimeToLive?: Duration.DurationInput | undefined
  }
): Stream<readonly [K, Stream<V>], E | E2, R | R2> =>
  transformPullBracket(
    self,
    Effect.fnUntraced(function*(pull, scope, forkedScope) {
      const out = yield* Queue.unbounded<readonly [K, Stream<V>], E | E2 | Cause.Done<void>>()
      yield* Scope.addFinalizer(scope, Queue.shutdown(out))

      const queueMap = MutableHashMap.empty<K, Queue.Queue<V, Cause.Done>>()
      const queues = yield* RcMap.make({
        lookup: (key: K) =>
          Effect.acquireRelease(
            Queue.make<V, Cause.Done>({ capacity: options?.bufferSize ?? 4096 }).pipe(
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
        Effect.catchCause((cause) => Queue.failCause(out, cause)),
        Effect.forkIn(scope)
      )

      return Queue.takeAll(out)
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
      return Pull.catchDone(Effect.suspend(() => done ? Cause.done() : loop), () => {
        done = true
        const out = group
        group = undefined
        return out && Arr.isArrayNonEmpty(out) ? Effect.succeed(Arr.of([currentKey, out])) : Cause.done()
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
        let done: Exit.Exit<never, Cause.Done<void> | E> | undefined
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
            return Cause.done()
          })
        )
        const pull = Effect.map(
          Effect.suspend(() => sink.transform(upstreamWithLeftover, scope)),
          ([value, leftover_]) => {
            leftover = leftover_
            return Arr.of(value)
          }
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
 * @category Aggregation
 */
export const aggregate: {
  <B, A, A2, E2, R2>(
    sink: Sink.Sink<B, A | A2, A2, E2, R2>
  ): <E, R>(self: Stream<A, E, R>) => Stream<B, E2 | E, R2 | R>
  <A, E, R, B, A2, E2, R2>(
    self: Stream<A, E, R>,
    sink: Sink.Sink<B, A | A2, A2, E2, R2>
  ): Stream<B, E | E2, R | R2>
} = dual(2, <A, E, R, B, A2, E2, R2>(
  self: Stream<A, E, R>,
  sink: Sink.Sink<B, A | A2, A2, E2, R2>
): Stream<B, E | E2, R | R2> => aggregateWithin(self, sink, Schedule.forever))

/**
 * @since 2.0.0
 * @category Aggregation
 */
export const aggregateWithin: {
  <B, A, A2, E2, R2, C, E3, R3>(
    sink: Sink.Sink<B, A | A2, A2, E2, R2>,
    schedule: Schedule.Schedule<C, Option.Option<B>, E3, R3>
  ): <E, R>(self: Stream<A, E, R>) => Stream<B, E2 | E | E3, R2 | R3 | R>
  <A, E, R, B, A2, E2, R2, C, E3, R3>(
    self: Stream<A, E, R>,
    sink: Sink.Sink<B, A | A2, A2, E2, R2>,
    schedule: Schedule.Schedule<C, Option.Option<B>, E3, R3>
  ): Stream<B, E | E2 | E3, R | R2 | R3>
} = dual(3, <A, E, R, B, A2, E2, R2, C, E3, R3>(
  self: Stream<A, E, R>,
  sink: Sink.Sink<B, A | A2, A2, E2, R2>,
  schedule: Schedule.Schedule<C, Option.Option<B>, E3, R3>
): Stream<B, E | E2 | E3, R | R2 | R3> =>
  fromChannel(Channel.fromTransformBracket(Effect.fnUntraced(function*(_upstream, _, scope) {
    const pull = yield* Channel.toPullScoped(self.channel, _)

    const pullLatch = Effect.makeLatchUnsafe(false)
    const scheduleStep = Symbol()
    const buffer = yield* Queue.make<Arr.NonEmptyReadonlyArray<A> | typeof scheduleStep, E | Cause.Done<void>>({
      capacity: 0
    })

    // upstream -> buffer
    let hadChunk = false
    yield* pull.pipe(
      pullLatch.whenOpen,
      Effect.flatMap((arr) => {
        hadChunk = true
        pullLatch.closeUnsafe()
        return Queue.offer(buffer, arr)
      }),
      Effect.forever, // don't disable autoYield to prevent choking the schedule
      Effect.catchCause((cause) => Queue.failCause(buffer, cause)),
      Effect.forkIn(scope)
    )

    // schedule -> buffer
    let lastOutput = Option.none<B>()
    const step = yield* Schedule.toStepWithSleep(schedule)
    const stepToBuffer = Effect.suspend(() => step(lastOutput)).pipe(
      Effect.flatMap(() => Queue.offer(buffer, scheduleStep)),
      Effect.flatMap(() => Effect.never),
      Pull.catchDone(() => Cause.done())
    )

    // buffer -> sink
    const pullFromBuffer: Pull.Pull<
      Arr.NonEmptyReadonlyArray<A>,
      E
    > = Queue.take(buffer).pipe(
      Effect.flatMap((arr) => arr === scheduleStep ? Cause.done() : Effect.succeed(arr))
    )

    let leftover: Arr.NonEmptyReadonlyArray<A2> | undefined
    const sinkUpstream = Effect.suspend((): Pull.Pull<Arr.NonEmptyReadonlyArray<A | A2>, E> => {
      if (leftover !== undefined) {
        const chunk = leftover
        leftover = undefined
        return Effect.succeed(chunk)
      }
      hadChunk = false
      pullLatch.openUnsafe()
      return pullFromBuffer
    })
    const catchSinkHalt = Effect.flatMap(([value, leftover_]: Sink.End<B, A2>) => {
      // ignore the last output if the upsteam only pulled a halt
      if (!hadChunk && buffer.state._tag === "Done") return Cause.done()
      lastOutput = Option.some(value)
      leftover = leftover_
      return Effect.succeed(Arr.of(value))
    })

    return Effect.suspend(() => {
      // if the buffer has exited and there is no more data to process
      if (buffer.state._tag === "Done") {
        return buffer.state.exit as Exit.Exit<never, Cause.Done<void> | E>
      }
      return Effect.succeed(Effect.suspend(() => sink.transform(sinkUpstream as any, scope)))
    }).pipe(
      Effect.flatMap((pull) => Effect.raceFirst(catchSinkHalt(pull), stepToBuffer))
    )
  }))))

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
 * import type { Channel } from "effect"
 * import { Console, Effect, Stream } from "effect"
 *
 * // Create a channel that processes chunks - this is a conceptual example
 * // In practice, this function is primarily used with specialized channels
 * // that properly handle chunk-based input/output, such as compression,
 * // encoding/decoding, or platform-specific transformations.
 *
 * declare const transformChannel: Channel.Channel<
 *   readonly [string, ...Array<string>],
 *   never,
 *   unknown,
 *   readonly [number, ...Array<number>],
 *   never,
 *   unknown,
 *   never
 * >
 *
 * const program = Stream.make(1, 2, 3).pipe(
 *   Stream.pipeThroughChannel(transformChannel),
 *   Stream.runCollect,
 *   Effect.flatMap((result) => Console.log(result))
 * )
 * ```
 *
 * @example
 * ```ts
 * import { Channel, Console, Effect, Stream } from "effect"
 *
 * // Practical example: combining two channels with pipeTo
 * declare const sourceChannel: Channel.Channel<
 *   readonly [number, ...Array<number>],
 *   never,
 *   void,
 *   unknown,
 *   unknown,
 *   unknown,
 *   never
 * >
 * declare const transformChannel: Channel.Channel<
 *   readonly [string, ...Array<string>],
 *   never,
 *   unknown,
 *   readonly [number, ...Array<number>],
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
 *   Effect.flatMap((result) => Console.log(result))
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
 * import type { Channel } from "effect"
 * import { Console, Effect, Stream } from "effect"
 *
 * // Channel that might fail during processing
 * declare const transformChannel: Channel.Channel<
 *   readonly [string, ...Array<string>],
 *   "ChannelError",
 *   unknown,
 *   readonly [number, ...Array<number>],
 *   never,
 *   unknown,
 *   never
 * >
 *
 * const program = Stream.make(1, 2, 3).pipe(
 *   Stream.pipeThroughChannelOrFail(transformChannel),
 *   Stream.runCollect,
 *   Effect.flatMap((result) => Console.log(result))
 * )
 * ```
 *
 * @example
 * ```ts
 * import type { Channel } from "effect"
 * import { Console, Effect, Stream } from "effect"
 *
 * // Demonstrate error preservation: both stream and channel can fail
 * const failingStream = Stream.make(1, 2, 3).pipe(
 *   Stream.flatMap((n) =>
 *     n === 2 ? Stream.fail("StreamError" as const) : Stream.succeed(n)
 *   )
 * )
 *
 * declare const numericTransformChannel: Channel.Channel<
 *   readonly [string, ...Array<string>],
 *   "ChannelError",
 *   unknown,
 *   readonly [number, ...Array<number>],
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
 * Pipes all of the values from this stream through the provided sink.
 *
 * See also `Stream.transduce`.
 *
 * @since 2.0.0
 * @category utils
 */
export const pipeThrough: {
  <A2, A, L, E2, R2>(sink: Sink.Sink<A2, A, L, E2, R2>): <E, R>(self: Stream<A, E, R>) => Stream<L, E2 | E, R2 | R>
  <A, E, R, A2, L, E2, R2>(self: Stream<A, E, R>, sink: Sink.Sink<A2, A, L, E2, R2>): Stream<L, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, A2, L, E2, R2>(self: Stream<A, E, R>, sink: Sink.Sink<A2, A, L, E2, R2>): Stream<L, E | E2, R | R2> =>
    self.channel.pipe(
      Channel.pipeToOrFail(Sink.toChannel(sink)),
      Channel.concatWith(([_, leftover]) => leftover ? Channel.succeed(leftover) : Channel.empty),
      fromChannel
    )
)

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
 * Returns a new stream that only emits elements that are not equal to the
 * previous element emitted, using natural equality to determine whether two
 * elements are equal.
 *
 * @since 2.0.0
 * @category De-duplication
 */
export const changes = <A, E, R>(self: Stream<A, E, R>): Stream<A, E, R> => changesWith(self, Equal.equals)

/**
 * Returns a new stream that only emits elements that are not equal to the
 * previous element emitted, using the specified function to determine whether
 * two elements are equal.
 *
 * @since 2.0.0
 * @category De-duplication
 */
export const changesWith: {
  <A>(f: (x: A, y: A) => boolean): <E, R>(self: Stream<A, E, R>) => Stream<A, E, R>
  <A, E, R>(self: Stream<A, E, R>, f: (x: A, y: A) => boolean): Stream<A, E, R>
} = dual(
  2,
  <A, E, R>(self: Stream<A, E, R>, f: (x: A, y: A) => boolean): Stream<A, E, R> =>
    transformPull(self, (pull, _scope) =>
      Effect.sync(() => {
        let first = true
        let last: A
        return Effect.flatMap(pull, function loop(arr): Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E> {
          const out: Array<A> = []
          let i = 0
          if (first) {
            first = false
            last = arr[0]
            i = 1
            out.push(last)
          }
          for (; i < arr.length; i++) {
            const a = arr[i]
            if (f(a, last)) continue
            last = a
            out.push(a)
          }
          return Arr.isArrayNonEmpty(out) ? Effect.succeed(out) : Effect.flatMap(pull, loop)
        })
      }))
)

/**
 * Returns a new stream that only emits elements that are not equal to the
 * previous element emitted, using the specified function to determine whether
 * two elements are equal.
 *
 * @since 2.0.0
 * @category De-duplication
 */
export const changesWithEffect: {
  <A, E2, R2>(
    f: (x: A, y: A) => Effect.Effect<boolean, E2, R2>
  ): <E, R>(self: Stream<A, E, R>) => Stream<A, E | E2, R | R2>
  <A, E, R, E2, R2>(
    self: Stream<A, E, R>,
    f: (x: A, y: A) => Effect.Effect<boolean, E2, R2>
  ): Stream<A, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, E2, R2>(
    self: Stream<A, E, R>,
    f: (x: A, y: A) => Effect.Effect<boolean, E2, R2>
  ): Stream<A, E | E2, R | R2> =>
    transformPull(self, (pull, _scope) =>
      Effect.sync(() => {
        let first = true
        let last: A
        return Effect.flatMap(
          pull,
          Effect.fnUntraced(function* loop(arr): Generator<
            Pull.Pull<any, E | E2, void, R2>,
            Arr.NonEmptyReadonlyArray<A>,
            any
          > {
            const out: Array<A> = []
            let i = 0
            if (first) {
              first = false
              last = arr[0]
              i = 1
              out.push(last)
            }
            for (; i < arr.length; i++) {
              const a = arr[i]
              if (yield* f(a, last)) continue
              last = a
              out.push(a)
            }
            return Arr.isArrayNonEmpty(out) ? out : yield* Effect.flatMap(pull, Effect.fnUntraced(loop))
          })
        )
      }))
)

/**
 * Decode Uint8Array chunks into a stream of strings using the specified encoding.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
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
 * import { Effect, Stream } from "effect"
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
 * Intersperse stream with provided `element`.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5).pipe(Stream.intersperse(0))
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // [
 * //   1, 0, 2, 0, 3,
 * //   0, 4, 0, 5
 * // ]
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const intersperse: {
  <A2>(element: A2): <A, E, R>(self: Stream<A, E, R>) => Stream<A2 | A, E, R>
  <A, E, R, A2>(self: Stream<A, E, R>, element: A2): Stream<A | A2, E, R>
} = dual(2, <A, E, R, A2>(self: Stream<A, E, R>, element: A2): Stream<A | A2, E, R> =>
  mapArray(self, (arr, i) => {
    const out: Arr.NonEmptyArray<A | A2> = i === 0 ? [] as any : [element]
    const lastIndex = arr.length - 1
    for (let j = 0; j < arr.length; j++) {
      if (j === lastIndex) {
        out.push(arr[j])
      } else {
        out.push(arr[j], element)
      }
    }
    return out
  }))

/**
 * Intersperse the specified element, also adding a prefix and a suffix.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5).pipe(
 *   Stream.intersperseAffixes({
 *     start: "[",
 *     middle: "-",
 *     end: "]"
 *   })
 * )
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // [
 * //   '[', 1,   '-', 2,   '-',
 * //   3,   '-', 4,   '-', 5,
 * //   ']'
 * // ]
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const intersperseAffixes: {
  <A2, A3, A4>(
    options: { readonly start: A2; readonly middle: A3; readonly end: A4 }
  ): <A, E, R>(self: Stream<A, E, R>) => Stream<A2 | A3 | A4 | A, E, R>
  <A, E, R, A2, A3, A4>(
    self: Stream<A, E, R>,
    options: { readonly start: A2; readonly middle: A3; readonly end: A4 }
  ): Stream<A | A2 | A3 | A4, E, R>
} = dual(2, <A, E, R, A2, A3, A4>(
  self: Stream<A, E, R>,
  options: { readonly start: A2; readonly middle: A3; readonly end: A4 }
): Stream<A | A2 | A3 | A4, E, R> =>
  succeed(options.start).pipe(
    concat(intersperse(self, options.middle)),
    concat(succeed(options.end))
  ))

/**
 * Interleaves this stream and the specified stream deterministically by
 * alternating pulling values from this stream and the specified stream. When
 * one stream is exhausted all remaining values in the other stream will be
 * pulled.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const s1 = Stream.make(1, 2, 3)
 * const s2 = Stream.make(4, 5, 6)
 *
 * const stream = Stream.interleave(s1, s2)
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // { _id: 'Chunk', values: [ 1, 4, 2, 5, 3, 6 ] }
 * ```
 * @since 2.0.0
 * @category utils
 */
export const interleave: {
  <A2, E2, R2>(that: Stream<A2, E2, R2>): <A, E, R>(self: Stream<A, E, R>) => Stream<A2 | A, E2 | E, R2 | R>
  <A, E, R, A2, E2, R2>(self: Stream<A, E, R>, that: Stream<A2, E2, R2>): Stream<A | A2, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, A2, E2, R2>(self: Stream<A, E, R>, that: Stream<A2, E2, R2>): Stream<A | A2, E | E2, R | R2> =>
    interleaveWith(
      self,
      that,
      fromIterable(Iterable.forever([true, false]))
    )
)

/**
 * Combines this stream and the specified stream deterministically using the
 * stream of boolean values `pull` to control which stream to pull from next.
 * A value of `true` indicates to pull from this stream and a value of `false`
 * indicates to pull from the specified stream. Only consumes as many elements
 * as requested by the `pull` stream. If either this stream or the specified
 * stream are exhausted further requests for values from that stream will be
 * ignored.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * const s1 = Stream.make(1, 3, 5, 7, 9)
 * const s2 = Stream.make(2, 4, 6, 8, 10)
 *
 * const booleanStream = Stream.make(true, false, false).pipe(Stream.forever)
 *
 * const stream = Stream.interleaveWith(s1, s2, booleanStream)
 *
 * Effect.runPromise(Stream.runCollect(stream)).then(console.log)
 * // [
 * //   1, 2,  4, 3, 6,
 * //   8, 5, 10, 7, 9
 * // ]
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const interleaveWith: {
  <A2, E2, R2, E3, R3>(
    that: Stream<A2, E2, R2>,
    decider: Stream<boolean, E3, R3>
  ): <A, E, R>(self: Stream<A, E, R>) => Stream<A2 | A, E2 | E3 | E, R2 | R3 | R>
  <A, E, R, A2, E2, R2, E3, R3>(
    self: Stream<A, E, R>,
    that: Stream<A2, E2, R2>,
    decider: Stream<boolean, E3, R3>
  ): Stream<A | A2, E | E2 | E3, R | R2 | R3>
} = dual(3, <A, E, R, A2, E2, R2, E3, R3>(
  self: Stream<A, E, R>,
  that: Stream<A2, E2, R2>,
  decider: Stream<boolean, E3, R3>
): Stream<A | A2, E | E2 | E3, R | R2 | R3> =>
  fromChannel(Channel.fromTransform(Effect.fnUntraced(function*(upstream, scope) {
    const pullDecider = yield* Channel.toTransform(Channel.flattenArray(decider.channel))(upstream, scope)
    const retry = Symbol()
    type retry = typeof retry
    let leftDone = false
    let rightDone = false
    const pullLeft = (yield* Channel.toTransform(Channel.flattenArray(self.channel))(
      upstream,
      scope
    )).pipe(
      Pull.catchDone(() => {
        leftDone = true
        return Effect.succeed<retry>(retry)
      })
    )
    const pullRight = (yield* Channel.toTransform(Channel.flattenArray(that.channel))(
      upstream,
      scope
    )).pipe(
      Pull.catchDone(() => {
        rightDone = true
        return Effect.succeed<retry>(retry)
      })
    )

    return Effect.gen(function*() {
      while (true) {
        if (leftDone && rightDone) {
          return yield* Cause.done()
        }
        const side = yield* pullDecider
        if (side && leftDone) continue
        if (!side && rightDone) continue
        const elem = yield* (side ? pullLeft : pullRight)
        if (elem === retry) continue
        return Arr.of(elem)
      }
    })
  }))))

/**
 * Interrupts the evaluation of this stream when the provided effect
 * completes. The given effect will be forked as part of this stream, and its
 * success will be discarded. This combinator will also interrupt any
 * in-progress element being pulled from upstream.
 *
 * If the effect completes with a failure before the stream completes, the
 * returned stream will emit that failure.
 *
 * @since 2.0.0
 * @category utils
 */
export const interruptWhen: {
  <X, E2, R2>(effect: Effect.Effect<X, E2, R2>): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E2 | E, R2 | R>
  <A, E, R, X, E2, R2>(self: Stream<A, E, R>, effect: Effect.Effect<X, E2, R2>): Stream<A, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, X, E2, R2>(self: Stream<A, E, R>, effect: Effect.Effect<X, E2, R2>): Stream<A, E | E2, R | R2> =>
    fromChannel(Channel.interruptWhen(self.channel, effect))
)

/**
 * Halts the evaluation of this stream when the provided effect completes. The
 * given effect will be forked as part of the returned stream, and its success
 * will be discarded.
 *
 * An element in the process of being pulled will not be interrupted when the
 * effect completes. See `interruptWhen` for this behavior.
 *
 * If the effect completes with a failure, the stream will emit that failure.
 *
 * @since 2.0.0
 * @category utils
 */
export const haltWhen: {
  <X, E2, R2>(effect: Effect.Effect<X, E2, R2>): <A, E, R>(self: Stream<A, E, R>) => Stream<A, E2 | E, R2 | R>
  <A, E, R, X, E2, R2>(self: Stream<A, E, R>, effect: Effect.Effect<X, E2, R2>): Stream<A, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, X, E2, R2>(self: Stream<A, E, R>, effect: Effect.Effect<X, E2, R2>): Stream<A, E | E2, R | R2> =>
    fromChannel(Channel.haltWhen(self.channel, effect))
)

/**
 * Executes the provided finalizer after this stream's finalizers run.
 *
 * @example
 * ```ts
 * import { Console, Effect, Exit, Stream } from "effect"
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
 * Runs the specified effect if this stream fails, providing the error to the
 * effect if it exists.
 *
 * Note: Unlike `Effect.onError` there is no guarantee that the provided
 * effect will not be interrupted.
 *
 * @since 2.0.0
 * @category utils
 */
export const onError: {
  <E, X, R2>(
    cleanup: (cause: Cause.Cause<E>) => Effect.Effect<X, never, R2>
  ): <A, R>(self: Stream<A, E, R>) => Stream<A, E, R2 | R>
  <A, E, R, X, R2>(
    self: Stream<A, E, R>,
    cleanup: (cause: Cause.Cause<E>) => Effect.Effect<X, never, R2>
  ): Stream<A, E, R | R2>
} = dual(2, <A, E, R, X, R2>(
  self: Stream<A, E, R>,
  cleanup: (cause: Cause.Cause<E>) => Effect.Effect<X, never, R2>
): Stream<A, E, R | R2> => fromChannel(Channel.onError(self.channel, cleanup)))

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
export const onFirst: {
  <A, X, EX, RX>(
    onFirst: (element: NoInfer<A>) => Effect.Effect<X, EX, RX>
  ): <E, R>(self: Stream<A, E, R>) => Stream<A, E | EX, R | RX>
  <A, E, R, X, EX, RX>(
    self: Stream<A, E, R>,
    onFirst: (element: NoInfer<A>) => Effect.Effect<X, EX, RX>
  ): Stream<A, E | EX, R | RX>
} = dual(2, <A, E, R, X, EX, RX>(
  self: Stream<A, E, R>,
  onFirst: (element: NoInfer<A>) => Effect.Effect<X, EX, RX>
): Stream<A, E | EX, R | RX> => fromChannel(Channel.onFirst(self.channel, (arr) => onFirst(arr[0]))))

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
 * @category Services
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
} = function() {
  const dataFirst = isStream(arguments[0])
  const name = dataFirst ? arguments[1] : arguments[0]
  const options = addSpanStackTrace(dataFirst ? arguments[1] : arguments[2])
  if (dataFirst) {
    const self = arguments[0] as Stream<any, any, any>
    return fromChannel(Channel.withSpan(self.channel, name, options))
  }
  return (self: Stream<any, any, any>) => fromChannel(Channel.withSpan(self.channel, name, options))
} as any

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
 * import { Effect, Sink, Stream } from "effect"
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
  Effect.scopedWith((scope) =>
    Channel.toPullScoped(self.channel, scope).pipe(
      Effect.flatMap((upstream) => sink.transform(upstream as any, scope)),
      Effect.map(([a]) => a)
    )
  ))

/**
 * Runs the stream and collects all of its elements to a chunk.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
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
 * import { Effect, Stream } from "effect"
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
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Stream.runForEachChunk`
 *
 * @example
 * ```ts
 * import { Console, Effect, Stream } from "effect"
 *
 * const stream = Stream.make(1, 2, 3)
 *
 * const program = Stream.runForEach(
 *   stream,
 *   (n) => Console.log(`Processing: ${n}`)
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
 * import { Console, Effect, Stream } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 * const result = Stream.runForEachArray(
 *   stream,
 *   (chunk) => Console.log(`Processing chunk: ${chunk.join(", ")}`)
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
 * import { Console, Effect, Stream } from "effect"
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
 * import { Effect, Stream } from "effect"
 *
 * const stream = Stream.make(1, 2, 3)
 * const program = Effect.scoped(
 *   Effect.gen(function*() {
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
): Effect.Effect<Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E>, never, R | Scope.Scope> => Channel.toPull(self.channel)

/**
 * Returns a combined string resulting from concatenating each of the values
 * from the stream.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
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
 * @since 4.0.0
 * @category destructors
 */
export const mkUint8Array = <E, R>(self: Stream<Uint8Array, E, R>): Effect.Effect<Uint8Array, E, R> =>
  Channel.runFold(
    self.channel,
    () => new Uint8Array(0),
    (acc, chunk) => {
      let chunkLength = 0
      for (let i = 0; i < chunk.length; i++) {
        chunkLength += chunk[i].length
      }
      const result = new Uint8Array(acc.length + chunkLength)
      result.set(acc, 0)
      let offset = acc.length
      for (let i = 0; i < chunk.length; i++) {
        result.set(chunk[i], offset)
        offset += chunk[i].length
      }
      return result
    }
  )

/**
 * Converts the stream to a `ReadableStream`.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream.
 *
 * @example
 * ```ts
 * import { ServiceMap, Stream } from "effect"
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
 * import { Effect, Stream } from "effect"
 *
 * const stream = Stream.make(1, 2, 3, 4, 5)
 * const readableStreamEffect = Stream.toReadableStreamEffect(stream)
 *
 * Effect.runPromise(readableStreamEffect).then((rs) =>
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
          } else if (Pull.isDoneCause(exit.cause)) {
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
  ): <A, E, R>(self: Stream<A, E, R>) => Effect.Effect<Queue.Dequeue<A, E | Cause.Done>, never, R | Scope.Scope>
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
  <A, E>(queue: Queue.Queue<A, E | Cause.Done>): <R>(self: Stream<A, E, R>) => Effect.Effect<void, never, R>
  <A, E, R>(self: Stream<A, E, R>, queue: Queue.Queue<A, E | Cause.Done>): Effect.Effect<void, never, R>
} = dual(2, <A, E, R>(
  self: Stream<A, E, R>,
  queue: Queue.Queue<A, E | Cause.Done>
): Effect.Effect<void, never, R> => Channel.runIntoQueueArray(self.channel, queue))
