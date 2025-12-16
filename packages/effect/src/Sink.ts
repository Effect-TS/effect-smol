/**
 * @since 2.0.0
 */
import type { NonEmptyReadonlyArray } from "./Array.ts"
import * as Arr from "./Array.ts"
import type * as Cause from "./Cause.ts"
import * as Channel from "./Channel.ts"
import * as Chunk from "./Chunk.ts"
import * as Effect from "./Effect.ts"
import * as Filter from "./Filter.ts"
import type { LazyArg } from "./Function.ts"
import { constant, constTrue, constVoid, dual, identity } from "./Function.ts"
import * as Option from "./Option.ts"
import { type Pipeable, pipeArguments } from "./Pipeable.ts"
import type { Predicate } from "./Predicate.ts"
import { hasProperty } from "./Predicate.ts"
import * as Pull from "./Pull.ts"
import type * as Scope from "./Scope.ts"
import type * as Types from "./types/Types.ts"
import type * as Unify from "./types/Unify.ts"

const TypeId = "~effect/Sink"

/**
 * A `Sink<A, In, L, E, R>` is used to consume elements produced by a `Stream`.
 * You can think of a sink as a function that will consume a variable amount of
 * `In` elements (could be 0, 1, or many), might fail with an error of type `E`,
 * and will eventually yield a value of type `A` together with a remainder of
 * type `L` (i.e. any leftovers).
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as Sink from "effect/Sink"
 * import * as Stream from "effect/Stream"
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
  readonly channel: Channel.Channel<
    never,
    E,
    End<A, L>,
    NonEmptyReadonlyArray<In>,
    never,
    void,
    R
  >
}

/**
 * @since 2.0.0
 * @category models
 */
export type End<A, L = never> = readonly [value: A, leftover?: NonEmptyReadonlyArray<L> | undefined]

const endVoid = Pull.halt([void 0] as End<void, never>)

/**
 * Interface for Sink unification, used internally by the Effect type system
 * to provide proper type inference when using Sink with other Effect types.
 *
 * @example
 * ```ts
 * import type { Effect } from "effect"
 * import type * as Sink from "effect/Sink"
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
 * import type * as Sink from "effect/Sink"
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
 * import type * as Sink from "effect/Sink"
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
   * import type * as Sink from "effect/Sink"
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
   * import type * as Sink from "effect/Sink"
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
 * Checks if a value is a Sink.
 *
 * @example
 * ```ts
 * import { Sink } from "effect"
 *
 * const sink = Sink.never
 * const notStream = { data: [1, 2, 3] }
 *
 * console.log(Sink.isSink(sink)) // true
 * console.log(Sink.isSink(notStream)) // false
 * ```
 *
 * @since 2.0.0
 * @category guards
 */
export const isSink = (u: unknown): u is Sink<unknown, never, unknown, unknown, unknown> => hasProperty(u, TypeId)

/**
 * Creates a sink from a `Channel`.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromChannel = <L, In, E, A, R>(
  channel: Channel.Channel<
    never,
    E,
    End<A, L>,
    NonEmptyReadonlyArray<In>,
    never,
    void,
    R
  >
): Sink<A, In, L, E, R> => {
  const self = Object.create(SinkProto)
  self.channel = channel
  return self
}

/**
 * Creates a sink from a `Channel`.
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromTransform = <L, In, E, A, R, EX, RX>(
  transform: (
    upstream: Pull.Pull<NonEmptyReadonlyArray<In>, never, void>,
    scope: Scope.Scope
  ) => Effect.Effect<Pull.Pull<never, E, End<A, L>, R>, EX, RX>
): Sink<A, In, L, Pull.ExcludeHalt<E> | EX, R | RX> => fromChannel(Channel.fromTransform(transform))

/**
 * Creates a `Channel` from a Sink.
 *
 * @example
 * ```ts
 * import { Sink } from "effect"
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
): Channel.Channel<never, E, End<A, L>, NonEmptyReadonlyArray<In>, never, void, R> => self.channel

/**
 * A sink that immediately ends with the specified value.
 *
 * @example
 * ```ts
 * import { Effect, Sink, Stream } from "effect"
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
export const succeed = <A, L = never>(a: A, leftovers?: NonEmptyReadonlyArray<L> | undefined): Sink<A, unknown, L> =>
  fromChannel(Channel.end([a, leftovers]))

/**
 * A sink that immediately ends with the specified lazily evaluated value.
 *
 * @since 2.0.0
 * @category constructors
 */
export const sync = <A>(a: LazyArg<A>): Sink<A, unknown, never> => fromChannel(Channel.endSync(() => [a()]))

/**
 * A sink that is created from a lazily evaluated sink.
 *
 * @since 2.0.0
 * @category constructors
 */
export const suspend = <A, In, L, E, R>(evaluate: LazyArg<Sink<A, In, L, E, R>>): Sink<A, In, L, E, R> =>
  fromChannel(Channel.suspend(() => evaluate().channel))

/**
 * A sink that always fails with the specified error.
 *
 * @example
 * ```ts
 * import { Effect, Sink, Stream } from "effect"
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
 * import { Effect, Sink, Stream } from "effect"
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
 * import { Cause, Effect, Sink, Stream } from "effect"
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
 * import { Cause, Effect, Sink, Stream } from "effect"
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
 * import { Effect, Sink, Stream } from "effect"
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
 * A sink that never completes.
 *
 * @since 2.0.0
 * @category constructors
 */
export const never: Sink<unknown> = fromChannel(Channel.never)

/**
 * Drains the remaining elements from the stream after the sink finishes
 *
 * @since 2.0.0
 * @category utils
 */
export const ignoreLeftover = <A, In, L, E, R>(self: Sink<A, In, L, E, R>): Sink<A, In, never, E, R> =>
  fromChannel(Channel.mapDone(self.channel, ([a]) => [a]))

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromEffect = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Sink<A, unknown, never, Pull.ExcludeHalt<E>, R> =>
  fromChannel(Channel.fromPull(Effect.succeed(Effect.flatMap(
    effect,
    (a) => Pull.halt<End<A>>([a])
  ))))

/**
 * Drains elements from the stream by ignoring all inputs.
 *
 * @since 2.0.0
 * @category constructors
 */
export const drain: Sink<void, unknown> = fromTransform((upstream) =>
  Effect.succeed(Pull.catchHalt(
    Effect.forever(upstream, { autoYield: false }),
    () => endVoid
  ))
)

/**
 * A sink that folds its inputs with the provided function, termination
 * predicate and initial state.
 *
 * @since 2.0.0
 * @category folding
 */
export const fold = <S, In, E = never, R = never>(
  s: LazyArg<S>,
  contFn: Predicate<S>,
  f: (s: S, input: In) => S | Effect.Effect<S, E, R>
): Sink<S, In, In, E, R> =>
  fromTransform((upstream) =>
    Effect.sync(() => {
      let state = s()
      const pull = upstream.pipe(
        Pull.catchHalt(() => Pull.halt<End<S, In>>([state]))
      )
      return Effect.gen(function*() {
        while (true) {
          const arr = yield* pull
          for (let i = 0; i < arr.length; i++) {
            const result = f(state, arr[i])
            state = Effect.isEffect(result) ? yield* result : result
            if (contFn(state)) continue
            return yield* Pull.halt<End<S, In>>([
              state,
              (i + 1) < arr.length ? (arr.slice(i + 1) as any) : undefined
            ])
          }
        }
      })
    })
  )

/**
 * @since 2.0.0
 * @category folding
 */
export const foldArray = <S, In, E = never, R = never>(
  s: LazyArg<S>,
  contFn: Predicate<S>,
  f: (s: S, input: Arr.NonEmptyReadonlyArray<In>) => S | Effect.Effect<S, E, R>
): Sink<S, In, never, E, R> =>
  fromTransform((upstream) =>
    Effect.sync(() => {
      let state = s()
      const pull = upstream.pipe(
        Pull.catchHalt(() => Pull.halt<End<S>>([state]))
      )
      return Effect.gen(function*() {
        while (true) {
          const arr = yield* pull
          const result = f(state, arr)
          state = Effect.isEffect(result) ? yield* result : result
          if (contFn(state)) continue
          return yield* Pull.halt<End<S>>([state])
        }
      })
    })
  )

/**
 * @since 2.0.0
 * @category folding
 */
export const foldUntil = <S, In, E = never, R = never>(
  s: LazyArg<S>,
  max: number,
  f: (s: S, input: In) => S | Effect.Effect<S, E, R>
): Sink<S, In, In, E, R> =>
  fold<readonly [S, number], In, E, R>(
    () => [s(), 0],
    (tuple) => tuple[1] < max,
    ([output, count], input) => {
      const result = f(output, input)
      return Effect.isEffect(result)
        ? Effect.map(result, (s) => [s, count + 1] as const)
        : [result, count + 1] as const
    }
  ).pipe(
    map((tuple) => tuple[0])
  )

/**
 * Transforms this sink's result.
 *
 * @since 2.0.0
 * @category mapping
 */
export const map: {
  <A, A2>(f: (a: A) => A2): <In, L, E, R>(self: Sink<A, In, L, E, R>) => Sink<A2, In, L, E, R>
  <A, In, L, E, R, A2>(self: Sink<A, In, L, E, R>, f: (a: A) => A2): Sink<A2, In, L, E, R>
} = dual(
  2,
  <A, In, L, E, R, A2>(self: Sink<A, In, L, E, R>, f: (a: A) => A2): Sink<A2, In, L, E, R> =>
    fromChannel(Channel.mapDone(self.channel, ([a, l]) => [f(a), l]))
)

/**
 * Effectfully transforms this sink's result.
 *
 * @since 2.0.0
 * @category mapping
 */
export const mapEffect: {
  <A, A2, E2, R2>(
    f: (a: A) => Effect.Effect<A2, E2, R2>
  ): <In, L, E, R>(self: Sink<A, In, L, E, R>) => Sink<A2, In, L, E2 | E, R2 | R>
  <A, In, L, E, R, A2, E2, R2>(
    self: Sink<A, In, L, E, R>,
    f: (a: A) => Effect.Effect<A2, E2, R2>
  ): Sink<A2, In, L, E | E2, R | R2>
} = dual(2, <A, In, L, E, R, A2, E2, R2>(
  self: Sink<A, In, L, E, R>,
  f: (a: A) => Effect.Effect<A2, E2, R2>
): Sink<A2, In, L, E | E2, R | R2> =>
  fromChannel(Channel.mapDoneEffect(
    self.channel,
    ([a, l]) => Effect.map(f(a), (a2) => [a2, l])
  )))

/**
 * Transforms the errors emitted by this sink using `f`.
 *
 * @since 2.0.0
 * @category mapping
 */
export const mapError: {
  <E, E2>(f: (error: E) => E2): <A, In, L, R>(self: Sink<A, In, L, E, R>) => Sink<A, In, L, E2, R>
  <A, In, L, E, R, E2>(self: Sink<A, In, L, E, R>, f: (error: E) => E2): Sink<A, In, L, E2, R>
} = dual(2, <A, In, L, E, R, E2>(
  self: Sink<A, In, L, E, R>,
  f: (error: E) => E2
): Sink<A, In, L, E2, R> => fromChannel(Channel.mapError(self.channel, f)))

/**
 * Transforms the leftovers emitted by this sink using `f`.
 *
 * @since 2.0.0
 * @category mapping
 */
export const mapLeftover: {
  <L, L2>(f: (leftover: L) => L2): <A, In, E, R>(self: Sink<A, In, L, E, R>) => Sink<A, In, L2, E, R>
  <A, In, L, E, R, L2>(self: Sink<A, In, L, E, R>, f: (leftover: L) => L2): Sink<A, In, L2, E, R>
} = dual(2, <A, In, L, E, R, L2>(
  self: Sink<A, In, L, E, R>,
  f: (leftover: L) => L2
): Sink<A, In, L2, E, R> => fromChannel(Channel.mapDone(self.channel, ([a, l]) => l ? [a, Arr.map(l, f)] : [a])))

/**
 * @since 2.0.0
 * @category collecting
 */
export const take = <In>(n: number): Sink<Array<In>, In, In> =>
  fromTransform((upstream) =>
    Effect.sync(() => {
      const taken: Array<In> = []
      if (n <= 0) {
        return Pull.halt([taken])
      }
      let leftover: NonEmptyReadonlyArray<In> | undefined = undefined
      return upstream.pipe(
        Effect.flatMap((arr) => {
          if (taken.length + arr.length <= n) {
            // eslint-disable-next-line no-restricted-syntax
            taken.push(...arr)
            if (taken.length === n) {
              return Pull.haltVoid
            }
            return Effect.void
          }
          for (let i = 0; i < arr.length; i++) {
            taken.push(arr[i])
            if (taken.length === n) {
              if ((i + 1) < arr.length) {
                leftover = arr.slice(i + 1) as any
              }
              return Pull.haltVoid
            }
          }
          return Effect.void
        }),
        Effect.forever({ autoYield: false }),
        Pull.catchHalt(() => Pull.halt([taken, leftover]))
      )
    })
  )

/**
 * A sink that reduces its inputs using the provided function `f` starting from
 * the provided `initial` state while the specified `predicate` returns `true`.
 *
 * @since 2.0.0
 * @category reducing
 */
export const reduceWhile = <S, In>(
  initial: LazyArg<S>,
  predicate: Predicate<S>,
  f: (s: S, input: In) => S
): Sink<S, In, In> =>
  fromTransform((upstream) =>
    Effect.sync(() => {
      let state = initial()
      let leftover: NonEmptyReadonlyArray<In> | undefined = undefined
      if (!predicate(state)) {
        return Pull.halt([state])
      }
      return upstream.pipe(
        Effect.flatMap((arr) => {
          for (let i = 0; i < arr.length; i++) {
            state = f(state, arr[i])
            if (!predicate(state)) {
              if ((i + 1) < arr.length) {
                leftover = arr.slice(i + 1) as any
              }
              return Pull.haltVoid
            }
          }
          return Effect.void
        }),
        Effect.forever({ autoYield: false }),
        Pull.catchHalt(() => Pull.halt([state, leftover]))
      )
    })
  )

/**
 * A sink that reduces its inputs using the provided effectful function `f`
 * starting from the provided `initial` state while the specified `predicate`
 * returns `true`.
 *
 * @since 2.0.0
 * @category reducing
 */
export const reduceWhileEffect = <S, In, E, R>(
  initial: LazyArg<S>,
  predicate: Predicate<S>,
  f: (s: S, input: In) => Effect.Effect<S, E, R>
): Sink<S, In, In, E, R> =>
  fromTransform((upstream) =>
    Effect.sync(() => {
      let state = initial()
      let leftover: NonEmptyReadonlyArray<In> | undefined = undefined
      if (!predicate(state)) {
        return Pull.halt([state])
      }
      return upstream.pipe(
        Effect.flatMap((arr) => {
          let i = 0
          return Effect.whileLoop({
            while: () => i < arr.length,
            body: constant(Effect.flatMap(Effect.suspend(() => f(state, arr[i++])), (s) => {
              state = s
              if (!predicate(state)) {
                if (i < arr.length) {
                  leftover = arr.slice(i) as any
                }
                return Pull.haltVoid
              }
              return Effect.void
            })),
            step: constVoid
          })
        }),
        Effect.forever({ autoYield: false }),
        Pull.catchHalt(() => Pull.halt([state, leftover]))
      )
    })
  )

/**
 * A sink that reduces its inputs using the provided function `f` starting from
 * the provided `initial` state while the specified `predicate` returns `true`.
 *
 * @since 2.0.0
 * @category reducing
 */
export const reduceWhileArray = <S, In>(
  initial: LazyArg<S>,
  contFn: Predicate<S>,
  f: (s: S, input: NonEmptyReadonlyArray<In>) => S
): Sink<S, In> =>
  fromTransform((upstream) =>
    Effect.sync(() => {
      let state = initial()
      if (!contFn(state)) {
        return Pull.halt([state])
      }
      return upstream.pipe(
        Effect.flatMap((arr) => {
          for (let i = 0; i < arr.length; i++) {
            state = f(state, arr)
            if (!contFn(state)) {
              return Pull.haltVoid
            }
          }
          return Effect.void
        }),
        Effect.forever({ autoYield: false }),
        Pull.catchHalt(() => Pull.halt([state]))
      )
    })
  )

/**
 * A sink that reduces its inputs using the provided effectful function `f`
 * starting from the provided `initial` state while the specified `predicate`
 * returns `true`.
 *
 * @since 2.0.0
 * @category reducing
 */
export const reduceWhileArrayEffect = <S, In, E, R>(
  initial: LazyArg<S>,
  predicate: Predicate<S>,
  f: (s: S, input: NonEmptyReadonlyArray<In>) => Effect.Effect<S, E, R>
): Sink<S, In, never, E, R> =>
  fromTransform((upstream) =>
    Effect.sync(() => {
      let state = initial()
      if (!predicate(state)) {
        return Pull.halt([state])
      }
      return upstream.pipe(
        Effect.flatMap((arr) => f(state, arr)),
        Effect.flatMap((s) => {
          state = s
          if (!predicate(state)) {
            return Pull.haltVoid
          }
          return Effect.void
        }),
        Effect.forever({ autoYield: false }),
        Pull.catchHalt(() => Pull.halt([state]))
      )
    })
  )

/**
 * A sink that reduces its inputs using the provided function `f` starting from
 * the provided `initial` state.
 *
 * @since 2.0.0
 * @category reducing
 */
export const reduce = <S, In>(initial: LazyArg<S>, f: (s: S, input: In) => S): Sink<S, In> =>
  reduceArray(initial, (s, arr) => {
    for (let i = 0; i < arr.length; i++) {
      s = f(s, arr[i])
    }
    return s
  })

/**
 * A sink that reduces its inputs using the provided function `f` starting from
 * the specified `initial` state.
 *
 * @since 2.0.0
 * @category reducing
 */
export const reduceArray = <S, In>(
  initial: LazyArg<S>,
  f: (s: S, input: NonEmptyReadonlyArray<In>) => S
): Sink<S, In> =>
  fromTransform((upstream) =>
    Effect.sync(() => {
      let state = initial()
      return upstream.pipe(
        Effect.flatMap((arr) => {
          state = f(state, arr)
          return Effect.void
        }),
        Effect.forever({ autoYield: false }),
        Pull.catchHalt(() => Pull.halt([state]))
      )
    })
  )

/**
 * A sink that reduces its inputs using the provided effectful function `f`
 * starting from the specified `initial` state.
 *
 * @since 2.0.0
 * @category reducing
 */
export const reduceEffect = <S, In, E, R>(
  initial: LazyArg<S>,
  f: (s: S, input: In) => Effect.Effect<S, E, R>
): Sink<S, In, never, E, R> => reduceWhileEffect(initial, constTrue, f) as any

const head_ = reduceWhile(Option.none<unknown>, Option.isNone, (_, in_) => Option.some(in_))

/**
 * Creates a sink containing the first value.
 *
 * @since 2.0.0
 * @category constructors
 */
export const head: <In>() => Sink<Option.Option<In>, In, In> = head_ as any

const last_ = reduceArray(Option.none<unknown>, (_, arr) => Arr.last(arr))

/**
 * Creates a sink containing the last value.
 *
 * @since 2.0.0
 * @category constructors
 */
export const last: <In>() => Sink<Option.Option<In>, In> = last_ as any

/**
 * Creates a sink which transforms it's inputs into a string.
 *
 * @since 2.0.0
 * @category constructors
 */
export const mkString: Sink<string, string> = reduceArray(() => "", (s, arr) => s + arr.join(""))

/**
 * Creates a sink which sums up its inputs.
 *
 * @since 2.0.0
 * @category constructors
 */
export const sum: Sink<number, number> = reduceArray(() => 0, (s, arr) => {
  for (let i = 0; i < arr.length; i++) {
    s += arr[i]
  }
  return s
})

const collectAll_ = reduceArray(Chunk.empty<unknown>, (s, arr) => Chunk.appendAll(s, Chunk.fromArrayUnsafe(arr)))

/**
 * Accumulates incoming elements into a Chunk. It return a Chunk to reduce
 * copying.
 *
 * @since 4.0.0
 * @category constructors
 */
export const collectAllChunk = <In>(): Sink<Chunk.Chunk<In>, In> => collectAll_ as any

/**
 * Accumulates incoming elements into an array.
 *
 * @since 2.0.0
 * @category constructors
 */
export const collectAll = <In>(): Sink<Array<In>, In> =>
  reduceArray(Arr.empty<In>, (s, arr) => {
    // eslint-disable-next-line no-restricted-syntax
    s.push(...arr)
    return s
  })

/**
 * Accumulates incoming elements into an array, up to the specified number `n`.
 *
 * @since 4.0.0
 * @category constructors
 */
export const collectN = <In>(n: number): Sink<Array<In>, In, In> =>
  fromTransform((upstream) =>
    Effect.sync(() => {
      const taken: Array<In> = []
      return upstream.pipe(
        Pull.catchHalt(() => Pull.halt<End<Array<In>, In>>([taken])),
        Effect.flatMap((arr) => {
          const isFinal = taken.length + arr.length >= n
          const toTake = isFinal ? n - taken.length : arr.length
          for (let i = 0; i < toTake; i++) {
            taken.push(arr[i])
          }
          if (!isFinal) return Effect.void
          return Pull.halt<End<Array<In>, In>>([
            taken,
            toTake < arr.length ? (arr.slice(toTake) as any) : undefined
          ])
        }),
        Effect.forever({ autoYield: false })
      )
    })
  )

/**
 * Accumulates incoming elements into an array as long as they verify predicate
 * `p`.
 *
 * @since 2.0.0
 * @category constructors
 */
export const collectAllFilter = <In, Out, X>(filter: Filter.Filter<In, Out, X>): Sink<Array<Out>, In, In> =>
  fromTransform((upstream) =>
    Effect.sync(() => {
      const out = Arr.empty<Out>()
      return upstream.pipe(
        Effect.flatMap((arr) => {
          for (let i = 0; i < arr.length; i++) {
            const result = filter(arr[i])
            if (Filter.isFail(result)) {
              const leftover: Arr.NonEmptyReadonlyArray<In> | undefined = (i + 1) < arr.length
                ? arr.slice(i + 1) as any
                : undefined
              return Pull.halt([out, leftover] as const)
            }
            out.push(result)
          }
          return Effect.void
        }),
        Effect.forever({ autoYield: false })
      )
    })
  )

/**
 * Accumulates incoming elements into an array as long as they verify effectful
 *
 * @since 2.0.0
 * @category constructors
 */
export const collectAllFilterEffect = <In, Out, X, E, R>(
  filter: Filter.FilterEffect<In, Out, X, E, R>
): Sink<Array<Out>, In, In, E, R> =>
  fromTransform((upstream) =>
    Effect.sync(() => {
      const out = Arr.empty<Out>()
      let leftover: Arr.NonEmptyReadonlyArray<In> | undefined = undefined
      return upstream.pipe(
        Effect.flatMap((arr) => {
          let i = 0
          return Effect.whileLoop({
            while: () => i < arr.length,
            body: constant(Effect.flatMap(Effect.suspend(() => filter(arr[i++])), (result) => {
              if (Filter.isFail(result)) {
                if (i < arr.length) {
                  leftover = arr.slice(i) as any
                }
                return Pull.haltVoid
              }
              out.push(result)
              return Effect.void
            })),
            step: constVoid
          })
        }),
        Effect.forever({ autoYield: false }),
        Pull.catchHalt(() => Pull.halt([out, leftover] as const))
      )
    })
  )

/**
 * A sink that executes the provided effectful function for every item fed
 * to it.
 *
 * @example
 * ```ts
 * import { Console, Effect, Sink, Stream } from "effect"
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
): Sink<void, In, never, E, R> => forEachArray(Effect.forEach((_) => f(_), { discard: true }))

/**
 * A sink that executes the provided effectful function for every Chunk fed
 * to it.
 *
 * @example
 * ```ts
 * import { Console, Effect, Sink, Stream } from "effect"
 *
 * // Create a sink that processes chunks
 * const sink = Sink.forEachArray((chunk: ReadonlyArray<number>) =>
 *   Console.log(
 *     `Processing chunk of ${chunk.length} items: [${chunk.join(", ")}]`
 *   )
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
export const forEachArray = <In, X, E, R>(
  f: (input: NonEmptyReadonlyArray<In>) => Effect.Effect<X, E, R>
): Sink<void, In, never, E, R> =>
  fromTransform((upstream) =>
    Effect.sync(() =>
      upstream.pipe(
        Effect.flatMap(f),
        Effect.forever({ autoYield: false }),
        Pull.catchHalt(() => endVoid)
      )
    )
  )

/**
 * Creates a sink produced from a scoped effect.
 *
 * @example
 * ```ts
 * import { Console, Effect, Sink, Stream } from "effect"
 *
 * // Create a sink from an effect that produces a sink
 * const sinkEffect = Effect.succeed(
 *   Sink.forEach((item: number) => Console.log(`Item: ${item}`))
 * )
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
