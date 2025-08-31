/**
 * @since 2.0.0
 */
import type * as Cause from "../Cause.ts"
import type { NonEmptyReadonlyArray } from "../collections/Array.ts"
import * as Effect from "../Effect.ts"
import type { LazyArg } from "../Function.ts"
import { identity } from "../Function.ts"
import { type Pipeable, pipeArguments } from "../interfaces/Pipeable.ts"
import type * as Scope from "../Scope.ts"
import * as Channel from "../stream/Channel.ts"
import type * as Types from "../types/Types.ts"
import type * as Unify from "../types/Unify.ts"

const TypeId = "~effect/stream/Sink"

/**
 * A `Sink<A, In, L, E, R>` is used to consume elements produced by a `Stream`.
 * You can think of a sink as a function that will consume a variable amount of
 * `In` elements (could be 0, 1, or many), might fail with an error of type `E`,
 * and will eventually yield a value of type `A` together with a remainder of
 * type `L` (i.e. any leftovers).
 *
 * @example
 * ```ts
 * import * as Sink from "effect/stream/Sink"
 * import * as Stream from "effect/stream/Stream"
 * import { Effect } from "effect"
 *
 * // Create a simple sink that always succeeds with a value
 * const sink: Sink.Sink<number> = Sink.succeed(42)
 *
 * // Use the sink to consume a stream
 * const stream = Stream.make(1, 2, 3)
 * const program = Stream.run(stream, sink)
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: 42
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface Sink<out A, in In = unknown, out L = never, out E = never, out R = never>
  extends Sink.Variance<A, In, L, E, R>, Pipeable
{
  readonly channel: Channel.Channel<NonEmptyReadonlyArray<L>, E, A, NonEmptyReadonlyArray<In>, never, void, R>
}

/**
 * Interface for Sink unification, used internally by the Effect type system
 * to provide proper type inference when using Sink with other Effect types.
 *
 * @example
 * ```ts
 * import type * as Sink from "effect/stream/Sink"
 * import type { Effect } from "effect"
 * import type * as Unify from "effect/types/Unify"
 *
 * // SinkUnify helps unify Sink and Effect types
 * declare const sink: Sink.Sink<number>
 * declare const effect: Effect.Effect<string>
 *
 * // The unification system handles mixed operations
 * type Combined = Sink.SinkUnify<{ [Unify.typeSymbol]?: any }>
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface SinkUnify<A extends { [Unify.typeSymbol]?: any }> extends Effect.EffectUnify<A> {
  Sink?: () => A[Unify.typeSymbol] extends
    | Sink<
      infer A,
      infer In,
      infer L,
      infer E,
      infer R
    >
    | infer _ ? Sink<A, In, L, E, R>
    : never
}

/**
 * Interface used to ignore certain types during Sink unification.
 * Part of the internal type system machinery.
 *
 * @example
 * ```ts
 * import type * as Sink from "effect/stream/Sink"
 *
 * // Used internally by the type system
 * type IgnoreConfig = Sink.SinkUnifyIgnore
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export interface SinkUnifyIgnore extends Effect.EffectUnifyIgnore {
  Sink?: true
}

/**
 * Namespace containing types and interfaces for Sink variance and type relationships.
 *
 * @example
 * ```ts
 * import type * as Sink from "effect/stream/Sink"
 *
 * // The Sink namespace contains internal type definitions
 * // These are used internally for type safety and variance
 * type SinkType<A, In, L, E, R> = Sink.Sink<A, In, L, E, R>
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export declare namespace Sink {
  /**
   * Represents the variance annotations for a Sink type.
   * Used internally to track how type parameters flow through the Sink.
   *
   * @example
   * ```ts
   * import type * as Sink from "effect/stream/Sink"
   *
   * // The variance interface is used internally
   * // It defines how type parameters behave in Sink
   * type SinkWithVariance = Sink.Sink<string> & { variance: "internal" }
   * ```
   *
   * @since 2.0.0
   * @category models
   */
  export interface Variance<out A, in In, out L, out E, out R> {
    readonly [TypeId]: VarianceStruct<A, In, L, E, R>
  }
  /**
   * The internal structure representing Sink variance annotations.
   * Contains the actual variance markers for each type parameter.
   *
   * @example
   * ```ts
   * import type * as Sink from "effect/stream/Sink"
   *
   * // The variance structure is used internally by the type system
   * // It ensures proper type safety for Sink operations
   * type SinkInstance = Sink.Sink<number, string>
   * ```
   *
   * @since 2.0.0
   * @category models
   */
  export interface VarianceStruct<out A, in In, out L, out E, out R> {
    _A: Types.Covariant<A>
    _In: Types.Contravariant<In>
    _L: Types.Covariant<L>
    _E: Types.Covariant<E>
    _R: Types.Covariant<R>
  }
}

const sinkVariance = {
  _A: identity,
  _In: identity,
  _L: identity,
  _E: identity,
  _R: identity
}

const SinkProto = {
  [TypeId]: sinkVariance,
  pipe() {
    return pipeArguments(this, arguments)
  }
}

/**
 * Creates a sink from a `Channel`.
 *
 * @example
 * ```ts
 * import { Sink } from "effect/stream"
 * import { Channel } from "effect/stream"
 *
 * // Create a sink from a channel that ends immediately
 * const channel = Channel.end(42)
 * const sink = Sink.fromChannel(channel)
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromChannel = <L, In, E, A, R>(
  channel: Channel.Channel<NonEmptyReadonlyArray<L>, E, A, NonEmptyReadonlyArray<In>, never, void, R>
): Sink<A, In, L, E, R> => {
  const self = Object.create(SinkProto)
  self.channel = channel
  return self
}

/**
 * Creates a `Channel` from a Sink.
 *
 * @example
 * ```ts
 * import { Sink } from "effect/stream"
 * import { Channel } from "effect/stream"
 *
 * // Create a sink and extract its channel
 * const sink = Sink.succeed(42)
 * const channel = Sink.toChannel(sink)
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const toChannel = <A, In, L, E, R>(
  self: Sink<A, In, L, E, R>
): Channel.Channel<NonEmptyReadonlyArray<L>, E, A, NonEmptyReadonlyArray<In>, never, void, R> => self.channel

/**
 * A sink that immediately ends with the specified value.
 *
 * @example
 * ```ts
 * import { Sink } from "effect/stream"
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * // Create a sink that always yields the same value
 * const sink = Sink.succeed(42)
 *
 * // Use it with a stream
 * const stream = Stream.make(1, 2, 3)
 * const program = Stream.run(stream, sink)
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: 42
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const succeed = <A>(a: A): Sink<A> => fromChannel(Channel.end(a))

/**
 * A sink that always fails with the specified error.
 *
 * @example
 * ```ts
 * import { Sink } from "effect/stream"
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * // Create a sink that always fails
 * const sink = Sink.fail(new Error("Sink failed"))
 *
 * // Use it with a stream
 * const stream = Stream.make(1, 2, 3)
 * const program = Stream.run(stream, sink)
 *
 * Effect.runPromise(program).catch(console.log)
 * // Output: Error: Sink failed
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const fail = <E>(e: E): Sink<never, unknown, never, E> => fromChannel(Channel.fail(e))

/**
 * A sink that always fails with the specified lazily evaluated error.
 *
 * @example
 * ```ts
 * import { Sink } from "effect/stream"
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * // Create a sink that fails with a lazy error
 * const sink = Sink.failSync(() => new Error("Lazy error"))
 *
 * // Use it with a stream
 * const stream = Stream.make(1, 2, 3)
 * const program = Stream.run(stream, sink)
 *
 * Effect.runPromise(program).catch(console.log)
 * // Output: Error: Lazy error
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const failSync = <E>(evaluate: LazyArg<E>): Sink<never, unknown, never, E> =>
  fromChannel(Channel.failSync(evaluate))

/**
 * Creates a sink halting with a specified `Cause`.
 *
 * @example
 * ```ts
 * import { Sink } from "effect/stream"
 * import { Stream } from "effect/stream"
 * import { Effect, Cause } from "effect"
 *
 * // Create a sink that fails with a specific cause
 * const sink = Sink.failCause(Cause.fail(new Error("Custom cause")))
 *
 * // Use it with a stream
 * const stream = Stream.make(1, 2, 3)
 * const program = Stream.run(stream, sink)
 *
 * Effect.runPromise(program).catch(console.log)
 * // Output: Error: Custom cause
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const failCause = <E>(cause: Cause.Cause<E>): Sink<never, unknown, never, E> =>
  fromChannel(Channel.failCause(cause))

/**
 * Creates a sink halting with a specified lazily evaluated `Cause`.
 *
 * @example
 * ```ts
 * import { Sink } from "effect/stream"
 * import { Stream } from "effect/stream"
 * import { Effect, Cause } from "effect"
 *
 * // Create a sink that fails with a lazy cause
 * const sink = Sink.failCauseSync(() => Cause.fail(new Error("Lazy cause")))
 *
 * // Use it with a stream
 * const stream = Stream.make(1, 2, 3)
 * const program = Stream.run(stream, sink)
 *
 * Effect.runPromise(program).catch(console.log)
 * // Output: Error: Lazy cause
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const failCauseSync = <E>(evaluate: LazyArg<Cause.Cause<E>>): Sink<never, unknown, never, E> =>
  fromChannel(
    Channel.failCauseSync(evaluate)
  )

/**
 * Creates a sink halting with a specified defect.
 *
 * @example
 * ```ts
 * import { Sink } from "effect/stream"
 * import { Stream } from "effect/stream"
 * import { Effect } from "effect"
 *
 * // Create a sink that dies with a defect
 * const sink = Sink.die(new Error("Defect error"))
 *
 * // Use it with a stream
 * const stream = Stream.make(1, 2, 3)
 * const program = Stream.run(stream, sink)
 *
 * Effect.runPromise(program).catch(console.log)
 * // Output: Error: Defect error
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const die = (defect: unknown): Sink<never> => fromChannel(Channel.die(defect))

/**
 * A sink that executes the provided effectful function for every item fed
 * to it.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Console } from "effect/logging"
 * import { Sink, Stream } from "effect/stream"
 *
 * // Create a sink that logs each item
 * const sink = Sink.forEach((item: number) => Console.log(`Processing: ${item}`))
 *
 * // Use it with a stream
 * const stream = Stream.make(1, 2, 3)
 * const program = Stream.run(stream, sink)
 *
 * Effect.runPromise(program)
 * // Output:
 * // Processing: 1
 * // Processing: 2
 * // Processing: 3
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const forEach = <In, X, E, R>(
  f: (input: In) => Effect.Effect<X, E, R>
): Sink<void, In, never, E, R> => forEachChunk(Effect.forEach((_) => f(_), { discard: true }))

/**
 * A sink that executes the provided effectful function for every Chunk fed
 * to it.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Console } from "effect/logging"
 * import { Sink, Stream } from "effect/stream"
 *
 * // Create a sink that processes chunks
 * const sink = Sink.forEachChunk((chunk: readonly number[]) =>
 *   Console.log(`Processing chunk of ${chunk.length} items: [${chunk.join(", ")}]`)
 * )
 *
 * // Use it with a stream
 * const stream = Stream.make(1, 2, 3, 4, 5)
 * const program = Stream.run(stream, sink)
 *
 * Effect.runPromise(program)
 * // Output: Processing chunk of 5 items: [1, 2, 3, 4, 5]
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const forEachChunk = <In, X, E, R>(
  f: (input: NonEmptyReadonlyArray<In>) => Effect.Effect<X, E, R>
): Sink<void, In, never, E, R> =>
  fromChannel(
    Channel.fromTransform((upstream) =>
      Effect.succeed(Effect.forever(Effect.flatMap(upstream, f), { autoYield: false }))
    )
  )

/**
 * Creates a sink produced from a scoped effect.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Console } from "effect/logging"
 * import { Sink, Stream } from "effect/stream"
 *
 * // Create a sink from an effect that produces a sink
 * const sinkEffect = Effect.succeed(Sink.forEach((item: number) => Console.log(`Item: ${item}`)))
 * const sink = Sink.unwrap(sinkEffect)
 *
 * // Use it with a stream
 * const stream = Stream.make(1, 2, 3)
 * const program = Stream.run(stream, sink)
 *
 * Effect.runPromise(program)
 * // Output:
 * // Item: 1
 * // Item: 2
 * // Item: 3
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const unwrap = <A, In, L, E, R, R2>(
  effect: Effect.Effect<Sink<A, In, L, E, R2>, E, R>
): Sink<A, In, L, E, Exclude<R, Scope.Scope> | R2> => fromChannel(Channel.unwrap(Effect.map(effect, toChannel)))
