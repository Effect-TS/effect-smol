/**
 * @since 2.0.0
 */
import * as Channel from "./Channel.js"
import * as Effect from "./Effect.js"
import { identity } from "./Function.js"
import { type Pipeable, pipeArguments } from "./Pipeable.js"
import type * as Types from "./Types.js"
import type * as Unify from "./Unify.js"

/**
 * @since 2.0.0
 * @category symbols
 */
export const SinkTypeId: unique symbol = Symbol.for("effect/Sink")

/**
 * @since 2.0.0
 * @category symbols
 */
export type SinkTypeId = typeof SinkTypeId

/**
 * A `Sink<A, In, L, E, R>` is used to consume elements produced by a `Stream`.
 * You can think of a sink as a function that will consume a variable amount of
 * `In` elements (could be 0, 1, or many), might fail with an error of type `E`,
 * and will eventually yield a value of type `A` together with a remainder of
 * type `L` (i.e. any leftovers).
 *
 * @since 2.0.0
 * @category models
 */
export interface Sink<out A, in In = unknown, out L = never, out E = never, out R = never>
  extends Sink.Variance<A, In, L, E, R>, Pipeable
{
  readonly channel: Channel.Channel<ReadonlyArray<L>, E, A, ReadonlyArray<In>, never, void, R>
}

/**
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
 * @category models
 * @since 2.0.0
 */
export interface SinkUnifyIgnore extends Effect.EffectUnifyIgnore {
  Sink?: true
}

/**
 * @since 2.0.0
 */
export declare namespace Sink {
  /**
   * @since 2.0.0
   * @category models
   */
  export interface Variance<out A, in In, out L, out E, out R> {
    readonly [SinkTypeId]: VarianceStruct<A, In, L, E, R>
  }
  /**
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
  [SinkTypeId]: sinkVariance,
  pipe() {
    return pipeArguments(this, arguments)
  }
}

/**
 * Creates a sink from a `Channel`.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromChannel = <L, In, E, A, R>(
  channel: Channel.Channel<ReadonlyArray<L>, E, A, ReadonlyArray<In>, never, void, R>
): Sink<A, In, L, E, R> => {
  const self = Object.create(SinkProto)
  self.channel = channel
  return self
}

/**
 * Creates a `Channel` from a Sink.
 *
 * @since 2.0.0
 * @category constructors
 */
export const toChannel = <A, In, L, E, R>(
  self: Sink<A, In, L, E, R>
): Channel.Channel<ReadonlyArray<L>, E, A, ReadonlyArray<In>, never, void, R> => self.channel

/**
 * A sink that executes the provided effectful function for every item fed
 * to it.
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
 * @since 2.0.0
 * @category constructors
 */
export const forEachChunk = <In, X, E, R>(
  f: (input: ReadonlyArray<In>) => Effect.Effect<X, E, R>
): Sink<void, In, never, E, R> =>
  fromChannel(
    Channel.fromTransform((upstream) =>
      Effect.succeed(Effect.forever(Effect.flatMap(upstream, f), { autoYield: false }))
    )
  )
