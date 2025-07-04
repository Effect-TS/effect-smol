/**
 * The `Channel` module provides a powerful abstraction for bi-directional communication
 * and streaming operations. A `Channel` is a nexus of I/O operations that supports both
 * reading and writing, forming the foundation for Effect's Stream and Sink abstractions.
 *
 * ## What is a Channel?
 *
 * A `Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>` represents:
 * - **OutElem**: The type of elements the channel outputs
 * - **OutErr**: The type of errors the channel can produce
 * - **OutDone**: The type of the final value when the channel completes
 * - **InElem**: The type of elements the channel reads
 * - **InErr**: The type of errors the channel can receive
 * - **InDone**: The type of the final value from upstream
 * - **Env**: The environment/context required by the channel
 *
 * ## Key Features
 *
 * - **Bi-directional**: Channels can both read and write
 * - **Composable**: Channels can be piped, sequenced, and concatenated
 * - **Resource-safe**: Automatic cleanup and resource management
 * - **Error-handling**: Built-in error propagation and handling
 * - **Concurrent**: Support for concurrent operations
 *
 * ## Composition Patterns
 *
 * 1. **Piping**: Connect channels where output of one becomes input of another
 * 2. **Sequencing**: Use the result of one channel to create another
 * 3. **Concatenating**: Combine multiple channels into a single channel
 *
 * @example
 * ```ts
 * import { Channel, Effect } from "effect"
 *
 * // Simple channel that outputs numbers
 * const numberChannel = Channel.succeed(42)
 *
 * // Transform channel that doubles values
 * const doubleChannel = Channel.map(numberChannel, (n) => n * 2)
 *
 * // Running the channel would output: 84
 * ```
 *
 * @example
 * ```ts
 * import { Channel, Effect } from "effect"
 *
 * // Channel from an array of values
 * const arrayChannel = Channel.fromArray([1, 2, 3, 4, 5])
 *
 * // Transform the channel by mapping over values
 * const transformedChannel = Channel.map(arrayChannel, (n) => n * 2)
 *
 * // This channel will output: 2, 4, 6, 8, 10
 * ```
 *
 * @since 2.0.0
 */
import type * as Arr from "./Array.js"
import * as Cause from "./Cause.js"
import * as Chunk from "./Chunk.js"
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
import * as ServiceMap from "./ServiceMap.js"
import type * as Types from "./Types.js"
import type * as Unify from "./Unify.js"

/**
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * console.log(Channel.TypeId) // "~effect/Channel"
 * ```
 *
 * @since 4.0.0
 * @category symbols
 */
export const TypeId: TypeId = "~effect/Channel"

/**
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * // TypeId is used for type identification
 * type MyTypeId = Channel.TypeId // "~effect/Channel"
 * ```
 *
 * @since 4.0.0
 * @category symbols
 */
export type TypeId = "~effect/Channel"

/**
 * Tests if a value is a `Channel`.
 *
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * const channel = Channel.succeed(42)
 * console.log(Channel.isChannel(channel)) // true
 * console.log(Channel.isChannel("not a channel")) // false
 * ```
 *
 * @category guards
 * @since 3.5.4
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
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * // A channel that outputs numbers and requires no environment
 * type NumberChannel = Channel.Channel<number>
 *
 * // A channel that outputs strings, can fail with Error, completes with boolean
 * type StringChannel = Channel.Channel<string, Error, boolean>
 *
 * // A channel with all type parameters specified
 * type FullChannel = Channel.Channel<
 *   string,        // OutElem - output elements
 *   Error,         // OutErr - output errors
 *   number,        // OutDone - completion value
 *   number,        // InElem - input elements
 *   string,        // InErr - input errors
 *   boolean,       // InDone - input completion
 *   { db: string } // Env - required environment
 * >
 * ```
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
 * @example
 * ```ts
 * import { Channel, Unify } from "effect"
 *
 * // ChannelUnify helps with type inference when using generic operations
 * // This is typically used internally by the Effect system
 * type SampleChannel = Channel.Channel<string, Error, number>
 * type UnifiedChannel = Channel.ChannelUnify<{
 *   [Unify.typeSymbol]?: SampleChannel
 * }>
 * ```
 *
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
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * // ChannelUnifyIgnore is used to control type unification behavior
 * // This is typically used internally by the Effect system
 * type IgnoreConfig = Channel.ChannelUnifyIgnore
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export interface ChannelUnifyIgnore extends Effect.EffectUnifyIgnore {
  Channel?: true
}

/**
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * // The Channel namespace contains types and utilities
 * type ChannelType = Channel.Channel<string>
 * type ChannelWithError = Channel.Channel<string, Error, number>
 * ```
 *
 * @since 2.0.0
 * @category namespace
 */
export declare namespace Channel {
  /**
   * @example
   * ```ts
   * import { Channel } from "effect"
   *
   * // Variance interface defines the variance annotations for Channel types
   * // This ensures proper type safety for contravariant and covariant positions
   * type StringChannel = Channel.Channel<string, Error, number>
   * ```
   *
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
   * @example
   * ```ts
   * import { Channel } from "effect"
   *
   * // VarianceStruct contains the actual variance markers for type checking
   * // This is used internally to ensure proper subtyping relationships
   * type StringChannel = Channel.Channel<string, Error, number>
   * // VarianceStruct is used internally for type variance
   * ```
   *
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
 * Creates a `Channel` from a transformation function that operates on upstream pulls.
 *
 * @example
 * ```ts
 * import { Channel, Effect } from "effect"
 *
 * const channel = Channel.fromTransform((upstream, scope) =>
 *   Effect.succeed(upstream)
 * )
 * ```
 *
 * @category constructors
 * @since 4.0.0
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
 * Creates a `Channel` from an `Effect` that produces a `Pull`.
 *
 * @example
 * ```ts
 * import { Channel, Effect } from "effect"
 *
 * const channel = Channel.fromPull(
 *   Effect.succeed(Effect.succeed(42))
 * )
 * ```
 *
 * @category constructors
 * @since 4.0.0
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
 * Converts a `Channel` back to its underlying transformation function.
 *
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * const channel = Channel.succeed(42)
 * const transform = Channel.toTransform(channel)
 * // transform can now be used directly
 * ```
 *
 * @category destructors
 * @since 4.0.0
 */
export const toTransform = <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>(
  channel: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
): (
  upstream: Pull.Pull<InElem, InErr, InDone>,
  scope: Scope.Scope
) => Effect.Effect<Pull.Pull<OutElem, OutErr, OutDone>, never, Env> => (channel as any).transform

/**
 * The default chunk size used by channels for batching operations.
 *
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * console.log(Channel.DefaultChunkSize) // 4096
 * ```
 *
 * @category constants
 * @since 2.0.0
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
    Effect.tap((queue) => Scope.addFinalizer(scope, Queue.shutdown(queue))),
    Effect.tap((queue) => {
      const result = f(queue)
      if (Effect.isEffect(result)) {
        return Effect.forkIn(Scope.provide(result, scope), scope)
      }
    })
  )

/**
 * Creates a `Channel` that interacts with a callback function using a queue.
 *
 * @example
 * ```ts
 * import { Channel, Queue } from "effect"
 *
 * const channel = Channel.callback<number>((queue) => {
 *   Queue.offer(queue, 1)
 *   Queue.offer(queue, 2)
 *   Queue.offer(queue, 3)
 * })
 * ```
 *
 * @category constructors
 * @since 2.0.0
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
 * Creates a `Channel` that interacts with a callback function using a queue, emitting arrays.
 *
 * @example
 * ```ts
 * import { Channel, Queue } from "effect"
 *
 * const channel = Channel.callbackArray<number>((queue) => {
 *   Queue.offer(queue, 1)
 *   Queue.offer(queue, 2)
 * })
 * // Emits arrays of numbers instead of individual numbers
 * ```
 *
 * @category constructors
 * @since 4.0.0
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
 * Creates a `Channel` that lazily evaluates to another channel.
 *
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * const channel = Channel.suspend(() => Channel.succeed(42))
 * // The inner channel is not created until the suspended channel is run
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const suspend = <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>(
  evaluate: LazyArg<Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>>
): Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env> =>
  fromTransform((upstream, scope) => Effect.suspend(() => toTransform(evaluate())(upstream, scope)))

/**
 * Creates a `Channel` with resource management using acquire-use-release pattern.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Exit } from "effect"
 *
 * const channel = Channel.acquireUseRelease(
 *   Effect.succeed("resource"),
 *   (resource) => Channel.succeed(resource.toUpperCase()),
 *   (resource, exit) => Effect.log(`Released: ${resource}`)
 * )
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const acquireUseRelease = <A, E, R, OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>(
  acquire: Effect.Effect<A, E, R>,
  use: (a: A) => Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
  release: (a: A, exit: Exit.Exit<OutDone, OutErr>) => Effect.Effect<unknown>
): Channel<OutElem, OutErr | E, OutDone, InElem, InErr, InDone, Env | R> =>
  makeImplBracket(
    Effect.fnUntraced(function*(upstream, scope, forkedScope) {
      let option = Option.none<A>()
      yield* Scope.addFinalizerExit(forkedScope, (exit) =>
        Option.isSome(option)
          ? release(option.value, exit as any)
          : Effect.void)
      const value = yield* Effect.uninterruptible(acquire)
      option = Option.some(value)
      return yield* toTransform(use(value))(upstream, scope)
    })
  )

/**
 * Creates a `Channel` with resource management using acquire-release pattern.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Exit } from "effect"
 *
 * const channel = Channel.acquireRelease(
 *   Effect.succeed("resource"),
 *   (resource, exit) => Effect.log(`Released: ${resource}`)
 * )
 * ```
 *
 * @category constructors
 * @since 2.0.0
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
 * Creates a `Channel` from an iterator.
 *
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * const numbers = [1, 2, 3, 4, 5]
 * const channel = Channel.fromIterator(() => numbers[Symbol.iterator]())
 * // Emits: 1, 2, 3, 4, 5
 * ```
 *
 * @category constructors
 * @since 2.0.0
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
 * Creates a `Channel` that emits all elements from an array.
 *
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * const channel = Channel.fromArray([1, 2, 3, 4, 5])
 * // Emits: 1, 2, 3, 4, 5
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const fromArray = <A>(array: ReadonlyArray<A>): Channel<A> =>
  fromPull(Effect.sync(() => {
    let index = 0
    return Effect.suspend(() => index >= array.length ? Pull.haltVoid : Effect.succeed(array[index++]))
  }))

/**
 * Creates a `Channel` that emits all elements from a chunk.
 *
 * @example
 * ```ts
 * import { Channel, Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3)
 * const channel = Channel.fromChunk(chunk)
 * // Emits: 1, 2, 3
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const fromChunk = <A>(chunk: Chunk.Chunk<A>): Channel<A> => fromArray(Chunk.toReadonlyArray(chunk))

/**
 * Creates a `Channel` from an iterator that emits arrays of elements.
 *
 * @example
 * ```ts
 * import { Channel, Effect } from "effect"
 *
 * // Create a channel from a simple iterator
 * const numberIterator = (): Iterator<number, string> => {
 *   let count = 0
 *   return {
 *     next: () => {
 *       if (count < 3) {
 *         return { value: count++, done: false }
 *       }
 *       return { value: "finished", done: true }
 *     }
 *   }
 * }
 *
 * const channel = Channel.fromIteratorArray(() => numberIterator(), 2)
 * // This will emit arrays: [0, 1], [2], then complete with "finished"
 * ```
 *
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * // Create channel from a generator function
 * function* fibonacci(): Generator<number, void, unknown> {
 *   let a = 0, b = 1
 *   for (let i = 0; i < 5; i++) {
 *     yield a;
 *     [a, b] = [b, a + b]
 *   }
 * }
 *
 * const fibChannel = Channel.fromIteratorArray(() => fibonacci(), 3)
 * // Emits: [0, 1, 1], [2, 3], then completes
 * ```
 *
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
 * Creates a `Channel` that emits all elements from an iterable.
 *
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * const set = new Set([1, 2, 3])
 * const channel = Channel.fromIterable(set)
 * // Emits: 1, 2, 3
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const fromIterable = <A, L>(iterable: Iterable<A, L>): Channel<A, never, L> =>
  fromIterator(() => iterable[Symbol.iterator]())

/**
 * Creates a `Channel` that emits arrays of elements from an iterable.
 *
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * const numbers = [1, 2, 3, 4, 5]
 * const channel = Channel.fromIterableArray(numbers)
 * // Emits arrays like: [1, 2, 3, 4], [5] (based on chunk size)
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const fromIterableArray = <A, L>(
  iterable: Iterable<A, L>
): Channel<Arr.NonEmptyReadonlyArray<A>, never, L> => fromIteratorArray(() => iterable[Symbol.iterator]())

/**
 * Creates a `Channel` that emits a single value and then ends.
 *
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * const channel = Channel.succeed(42)
 * // Emits: 42
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const succeed = <A>(value: A): Channel<A> => fromEffect(Effect.succeed(value))

/**
 * Creates a `Channel` that immediately ends with the specified value.
 *
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * const channel = Channel.end("done")
 * // Ends immediately with "done", emits nothing
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const end = <A>(value: A): Channel<never, never, A> => fromPull(Effect.succeed(Pull.halt(value)))

/**
 * Creates a `Channel` that emits a single value computed by a lazy evaluation.
 *
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * const channel = Channel.sync(() => Math.random())
 * // Emits a random number computed when the channel runs
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const sync = <A>(evaluate: LazyArg<A>): Channel<A> => fromEffect(Effect.sync(evaluate))

/**
 * Represents an Channel that emits no elements
 *
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * // Create an empty channel
 * const emptyChannel = Channel.empty
 *
 * // Use empty channel in composition
 * const combined = Channel.concatWith(emptyChannel, () => Channel.succeed(42))
 * // Will immediately provide the second channel's output
 *
 * // Empty channel can be used as a no-op in conditional logic
 * const conditionalChannel = (shouldEmit: boolean) =>
 *   shouldEmit ? Channel.succeed("data") : Channel.empty
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const empty: Channel<never> = fromPull(Effect.succeed(Pull.haltVoid))

/**
 * Represents an Channel that never completes
 *
 * @example
 * ```ts
 * import { Channel, Effect } from "effect"
 *
 * // Create a channel that never completes
 * const neverChannel = Channel.never
 *
 * // Use in conditional logic
 * const withFallback = Channel.concatWith(
 *   neverChannel,
 *   () => Channel.succeed("fallback")
 * )
 *
 * // Never channel is useful for testing or as a placeholder
 * const conditionalChannel = (shouldComplete: boolean) =>
 *   shouldComplete ? Channel.succeed("done") : Channel.never
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const never: Channel<never, never, never> = fromPull(Effect.succeed(Effect.never))

/**
 * Constructs a channel that fails immediately with the specified error.
 *
 * @example
 * ```ts
 * import { Channel, Effect } from "effect"
 *
 * // Create a channel that fails with a string error
 * const failedChannel = Channel.fail("Something went wrong")
 *
 * // Create a channel that fails with a custom error
 * class CustomError extends Error {
 *   constructor(message: string) {
 *     super(message)
 *     this.name = "CustomError"
 *   }
 * }
 * const customErrorChannel = Channel.fail(new CustomError("Custom error"))
 *
 * // Use in error handling by piping to another channel
 * const channelWithFallback = Channel.concatWith(
 *   failedChannel,
 *   () => Channel.succeed("fallback value")
 * )
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const fail = <E>(error: E): Channel<never, E, never> => fromPull(Effect.fail(error))

/**
 * Constructs a channel that fails immediately with the specified lazily
 * evaluated error.
 *
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * // Create a channel that fails with a lazily computed error
 * const failedChannel = Channel.failSync(() => {
 *   console.log("Computing error...")
 *   return new Error("Computed at runtime")
 * })
 *
 * // The error computation is deferred until the channel runs
 * const conditionalError = Channel.failSync(() =>
 *   Math.random() > 0.5 ? "Error A" : "Error B"
 * )
 *
 * // Use with expensive error construction
 * const expensiveError = Channel.failSync(() => {
 *   const timestamp = Date.now()
 *   return new Error(`Failed at: ${timestamp}`)
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const failSync = <E>(evaluate: LazyArg<E>): Channel<never, E, never> => fromPull(Effect.failSync(evaluate))

/**
 * Constructs a channel that fails immediately with the specified `Cause`.
 *
 * @example
 * ```ts
 * import { Channel, Cause } from "effect"
 *
 * // Create a channel that fails with a simple cause
 * const simpleCause = Cause.fail("Simple error")
 * const failedChannel = Channel.failCause(simpleCause)
 *
 * // Create a channel with a die cause
 * const dieCause = Cause.die(new Error("System error"))
 * const dieFailure = Channel.failCause(dieCause)
 *
 * // Create a channel with a simple fail cause
 * const failCause = Cause.fail("Simple error")
 * const simpleFail = Channel.failCause(failCause)
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const failCause = <E>(cause: Cause.Cause<E>): Channel<never, E, never> => fromPull(Effect.failCause(cause))

/**
 * Constructs a channel that fails immediately with the specified lazily
 * evaluated `Cause`.
 *
 * @example
 * ```ts
 * import { Channel, Cause } from "effect"
 *
 * // Create a channel that fails with a lazily computed cause
 * const failedChannel = Channel.failCauseSync(() => {
 *   const errorType = Math.random() > 0.5 ? "A" : "B"
 *   return Cause.fail(`Runtime error ${errorType}`)
 * })
 *
 * // Create a channel with die cause computation
 * const dieCauseChannel = Channel.failCauseSync(() => {
 *   const timestamp = Date.now()
 *   return Cause.die(`Error at ${timestamp}`)
 * })
 * ```
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
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * // Create a channel that dies with a string defect
 * const diedChannel = Channel.die("Unrecoverable error")
 *
 * // Create a channel that dies with an Error object
 * const errorDefect = Channel.die(new Error("System failure"))
 *
 * // Die with any value as a defect
 * const objectDefect = Channel.die({
 *   code: "SYSTEM_FAILURE",
 *   details: "Critical system component failed"
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const die = (defect: unknown): Channel<never, never, never> => failCause(Cause.die(defect))

/**
 * Use an effect to write a single value to the channel.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Data } from "effect"
 *
 * class DatabaseError extends Data.TaggedError("DatabaseError")<{
 *   readonly message: string
 * }> {}
 *
 * // Create a channel from a successful effect
 * const successChannel = Channel.fromEffect(
 *   Effect.succeed("Hello from effect!")
 * )
 *
 * // Create a channel from an effect that might fail
 * const fetchUserChannel = Channel.fromEffect(
 *   Effect.tryPromise({
 *     try: () => fetch("/api/user").then(res => res.json()),
 *     catch: (error) => new DatabaseError({ message: String(error) })
 *   })
 * )
 *
 * // Channel from effect with async computation
 * const asyncChannel = Channel.fromEffect(
 *   Effect.gen(function* () {
 *     yield* Effect.sleep("100 millis")
 *     return "Async result"
 *   })
 * )
 * ```
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
 * @example
 * ```ts
 * import { Channel, Queue, Effect, Data } from "effect"
 *
 * class QueueError extends Data.TaggedError("QueueError")<{
 *   readonly reason: string
 * }> {}
 *
 * const program = Effect.gen(function* () {
 *   // Create a bounded queue
 *   const queue = yield* Queue.bounded<string, QueueError>(10)
 *
 *   // Add some items to the queue
 *   yield* Queue.offer(queue, "item1")
 *   yield* Queue.offer(queue, "item2")
 *   yield* Queue.offer(queue, "item3")
 *
 *   // Create a channel from the queue
 *   const channel = Channel.fromQueue(queue)
 *
 *   // The channel will read items from the queue one by one
 *   return channel
 * })
 *
 * // Sliding queue example
 * const slidingProgram = Effect.gen(function* () {
 *   const slidingQueue = yield* Queue.sliding<number, QueueError>(5)
 *   yield* Queue.offerAll(slidingQueue, [1, 2, 3, 4, 5, 6])
 *   return Channel.fromQueue(slidingQueue)
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromQueue = <A, E>(
  queue: Queue.Dequeue<A, E>
): Channel<A, E> => fromPull(Effect.succeed(Pull.fromQueue(queue)))

/**
 * Create a channel from a queue that emits arrays of elements
 *
 * @example
 * ```ts
 * import { Channel, Queue, Effect, Data } from "effect"
 *
 * class ProcessingError extends Data.TaggedError("ProcessingError")<{
 *   readonly stage: string
 * }> {}
 *
 * const program = Effect.gen(function* () {
 *   // Create a queue for batch processing
 *   const queue = yield* Queue.bounded<number, ProcessingError>(100)
 *
 *   // Fill queue with data
 *   yield* Queue.offerAll(queue, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
 *
 *   // Create a channel that reads arrays from the queue
 *   const arrayChannel = Channel.fromQueueArray(queue)
 *
 *   // This will emit non-empty arrays of elements instead of individual items
 *   // Useful for batch processing scenarios
 *   return arrayChannel
 * })
 *
 * // High-throughput processing example
 * const batchProcessor = Effect.gen(function* () {
 *   const dataQueue = yield* Queue.dropping<string, ProcessingError>(1000)
 *   const batchChannel = Channel.fromQueueArray(dataQueue)
 *
 *   // Process data in batches for better performance
 *   return Channel.map(batchChannel, (batch) =>
 *     batch.map(item => item.toUpperCase())
 *   )
 * })
 * ```
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
 * @example
 * ```ts
 * import { Channel, PubSub, Effect, Data } from "effect"
 *
 * class SubscriptionError extends Data.TaggedError("SubscriptionError")<{
 *   readonly reason: string
 * }> {}
 *
 * const program = Effect.gen(function* () {
 *   // Create a PubSub
 *   const pubsub = yield* PubSub.bounded<string>(32)
 *
 *   // Create a subscription
 *   const subscription = yield* PubSub.subscribe(pubsub)
 *
 *   // Publish some messages
 *   yield* PubSub.publish(pubsub, "Hello")
 *   yield* PubSub.publish(pubsub, "World")
 *   yield* PubSub.publish(pubsub, "from")
 *   yield* PubSub.publish(pubsub, "PubSub")
 *
 *   // Create a channel from the subscription
 *   const channel = Channel.fromSubscription(subscription)
 *
 *   // The channel will receive all published messages
 *   return channel
 * })
 *
 * // Real-time notifications example
 * const notificationChannel = Effect.gen(function* () {
 *   const eventBus = yield* PubSub.unbounded<{ type: string; payload: any }>()
 *   const userSubscription = yield* PubSub.subscribe(eventBus)
 *
 *   return Channel.fromSubscription(userSubscription)
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromSubscription = <A>(
  subscription: PubSub.Subscription<A>
): Channel<A> => fromPull(Effect.succeed(Effect.onInterrupt(PubSub.take(subscription), Pull.haltVoid)))

/**
 * Create a channel from a PubSub subscription that outputs arrays of values.
 *
 * This constructor creates a channel that reads from a PubSub subscription and outputs
 * arrays of values in chunks. It's useful when you want to process multiple values at once
 * for better performance.
 *
 * @param subscription - The PubSub subscription to read from
 * @param chunkSize - The maximum number of elements to read in each chunk (default: 4096)
 *
 * @example
 * ```ts
 * import { Channel, PubSub, Effect, Data } from "effect"
 *
 * class StreamError extends Data.TaggedError("StreamError")<{
 *   readonly message: string
 * }> {}
 *
 * const program = Effect.gen(function* () {
 *   const pubsub = yield* PubSub.bounded<number>(16)
 *   const subscription = yield* PubSub.subscribe(pubsub)
 *
 *   // Create a channel that reads arrays of values
 *   const channel = Channel.fromSubscriptionArray(subscription, 3)
 *
 *   // Publish some values
 *   yield* PubSub.publish(pubsub, 1)
 *   yield* PubSub.publish(pubsub, 2)
 *   yield* PubSub.publish(pubsub, 3)
 *   yield* PubSub.publish(pubsub, 4)
 *
 *   // The channel will output arrays like [1, 2, 3] and [4]
 *   return channel
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Channel, PubSub, Effect, Data } from "effect"
 *
 * class BatchProcessingError extends Data.TaggedError("BatchProcessingError")<{
 *   readonly reason: string
 * }> {}
 *
 * const batchProcessor = Effect.gen(function* () {
 *   const pubsub = yield* PubSub.bounded<string>(32)
 *   const subscription = yield* PubSub.subscribe(pubsub)
 *
 *   // Create a channel that processes items in batches
 *   const batchChannel = Channel.fromSubscriptionArray(subscription, 5)
 *
 *   // Transform to process each batch
 *   const processedChannel = Channel.map(batchChannel, (batch) => {
 *     console.log(`Processing batch of ${batch.length} items:`, batch)
 *     return batch.map(item => item.toUpperCase())
 *   })
 *
 *   return processedChannel
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Channel, PubSub, Effect, Data } from "effect"
 *
 * class MetricsError extends Data.TaggedError("MetricsError")<{
 *   readonly cause: string
 * }> {}
 *
 * const metricsAggregator = Effect.gen(function* () {
 *   const metricsPubSub = yield* PubSub.bounded<{ timestamp: number; value: number }>(100)
 *   const subscription = yield* PubSub.subscribe(metricsPubSub)
 *
 *   // Create a channel that collects metrics in chunks
 *   const metricsChannel = Channel.fromSubscriptionArray(subscription, 10)
 *
 *   // Transform to calculate aggregate statistics
 *   const aggregatedChannel = Channel.map(metricsChannel, (metrics) => {
 *     const values = metrics.map(m => m.value)
 *     const sum = values.reduce((a, b) => a + b, 0)
 *     const avg = sum / values.length
 *     const min = Math.min(...values)
 *     const max = Math.max(...values)
 *
 *     return {
 *       count: values.length,
 *       sum,
 *       average: avg,
 *       min,
 *       max,
 *       timestamp: Date.now()
 *     }
 *   })
 *
 *   return aggregatedChannel
 * })
 * ```
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
 * Create a channel from a PubSub that outputs individual values.
 *
 * This constructor creates a channel that reads from a PubSub by automatically
 * subscribing to it. The channel outputs individual values as they are published
 * to the PubSub, making it ideal for real-time streaming scenarios.
 *
 * @param pubsub - The PubSub to read from
 *
 * @example
 * ```ts
 * import { Channel, PubSub, Effect, Data } from "effect"
 *
 * class StreamError extends Data.TaggedError("StreamError")<{
 *   readonly message: string
 * }> {}
 *
 * const program = Effect.gen(function* () {
 *   const pubsub = yield* PubSub.bounded<number>(16)
 *
 *   // Create a channel that reads individual values
 *   const channel = Channel.fromPubSub(pubsub)
 *
 *   // Publish some values
 *   yield* PubSub.publish(pubsub, 1)
 *   yield* PubSub.publish(pubsub, 2)
 *   yield* PubSub.publish(pubsub, 3)
 *
 *   // The channel will output: 1, 2, 3 (individual values)
 *   return channel
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Channel, PubSub, Effect, Data } from "effect"
 *
 * class NotificationError extends Data.TaggedError("NotificationError")<{
 *   readonly reason: string
 * }> {}
 *
 * const notificationService = Effect.gen(function* () {
 *   const notificationPubSub = yield* PubSub.bounded<string>(50)
 *
 *   // Create a channel for real-time notifications
 *   const notificationChannel = Channel.fromPubSub(notificationPubSub)
 *
 *   // Transform notifications to add timestamps
 *   const timestampedChannel = Channel.map(notificationChannel, (message) => ({
 *     message,
 *     timestamp: new Date().toISOString(),
 *     id: Math.random().toString(36).substr(2, 9)
 *   }))
 *
 *   return timestampedChannel
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Channel, PubSub, Effect, Data } from "effect"
 *
 * class EventProcessingError extends Data.TaggedError("EventProcessingError")<{
 *   readonly eventType: string
 *   readonly cause: string
 * }> {}
 *
 * interface DomainEvent {
 *   readonly type: string
 *   readonly payload: unknown
 *   readonly timestamp: number
 * }
 *
 * const eventProcessor = Effect.gen(function* () {
 *   const eventPubSub = yield* PubSub.bounded<DomainEvent>(100)
 *
 *   // Create a channel for processing domain events
 *   const eventChannel = Channel.fromPubSub(eventPubSub)
 *
 *   // Filter and transform events
 *   const processedChannel = Channel.map(eventChannel, (event) => {
 *     if (event.type === "user.created") {
 *       return {
 *         ...event,
 *         processed: true,
 *         processedAt: Date.now()
 *       }
 *     }
 *     return event
 *   })
 *
 *   return processedChannel
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromPubSub = <A>(
  pubsub: PubSub.PubSub<A>
): Channel<A> => unwrap(Effect.map(PubSub.subscribe(pubsub), fromSubscription))

/**
 * Create a channel from a PubSub that outputs arrays of values.
 *
 * This constructor creates a channel that reads from a PubSub by automatically
 * subscribing to it and collecting values into arrays. The channel outputs
 * arrays of values in chunks, making it ideal for batch processing scenarios.
 *
 * @param pubsub - The PubSub to read from
 * @param chunkSize - The maximum number of elements to collect in each array (default: 4096)
 *
 * @example
 * ```ts
 * import { Channel, PubSub, Effect, Data } from "effect"
 *
 * class BatchError extends Data.TaggedError("BatchError")<{
 *   readonly message: string
 * }> {}
 *
 * const program = Effect.gen(function* () {
 *   const pubsub = yield* PubSub.bounded<number>(16)
 *
 *   // Create a channel that reads arrays of values
 *   const channel = Channel.fromPubSubArray(pubsub, 3)
 *
 *   // Publish some values
 *   yield* PubSub.publish(pubsub, 1)
 *   yield* PubSub.publish(pubsub, 2)
 *   yield* PubSub.publish(pubsub, 3)
 *   yield* PubSub.publish(pubsub, 4)
 *
 *   // The channel will output arrays like [1, 2, 3] and [4]
 *   return channel
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Channel, PubSub, Effect, Data } from "effect"
 *
 * class OrderProcessingError extends Data.TaggedError("OrderProcessingError")<{
 *   readonly orderId: string
 *   readonly reason: string
 * }> {}
 *
 * interface Order {
 *   readonly id: string
 *   readonly customerId: string
 *   readonly items: ReadonlyArray<string>
 *   readonly total: number
 * }
 *
 * const orderBatchProcessor = Effect.gen(function* () {
 *   const orderPubSub = yield* PubSub.bounded<Order>(100)
 *
 *   // Create a channel that processes orders in batches
 *   const orderChannel = Channel.fromPubSubArray(orderPubSub, 10)
 *
 *   // Transform to process each batch of orders
 *   const processedChannel = Channel.map(orderChannel, (orderBatch) => {
 *     const totalRevenue = orderBatch.reduce((sum, order) => sum + order.total, 0)
 *     const customerCount = new Set(orderBatch.map(order => order.customerId)).size
 *
 *     return {
 *       batchSize: orderBatch.length,
 *       totalRevenue,
 *       uniqueCustomers: customerCount,
 *       processedAt: Date.now(),
 *       orders: orderBatch
 *     }
 *   })
 *
 *   return processedChannel
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Channel, PubSub, Effect, Data } from "effect"
 *
 * class LogProcessingError extends Data.TaggedError("LogProcessingError")<{
 *   readonly batchId: string
 *   readonly cause: string
 * }> {}
 *
 * interface LogEntry {
 *   readonly timestamp: number
 *   readonly level: "info" | "warn" | "error"
 *   readonly message: string
 *   readonly source: string
 * }
 *
 * const logAggregator = Effect.gen(function* () {
 *   const logPubSub = yield* PubSub.bounded<LogEntry>(500)
 *
 *   // Create a channel that collects logs in batches
 *   const logChannel = Channel.fromPubSubArray(logPubSub, 50)
 *
 *   // Transform to analyze log batches
 *   const analysisChannel = Channel.map(logChannel, (logBatch) => {
 *     const errorCount = logBatch.filter(log => log.level === "error").length
 *     const warnCount = logBatch.filter(log => log.level === "warn").length
 *     const infoCount = logBatch.filter(log => log.level === "info").length
 *
 *     const timeRange = {
 *       start: Math.min(...logBatch.map(log => log.timestamp)),
 *       end: Math.max(...logBatch.map(log => log.timestamp))
 *     }
 *
 *     return {
 *       batchId: Math.random().toString(36).substr(2, 9),
 *       totalEntries: logBatch.length,
 *       errorCount,
 *       warnCount,
 *       infoCount,
 *       timeRange,
 *       sources: [...new Set(logBatch.map(log => log.source))]
 *     }
 *   })
 *
 *   return analysisChannel
 * })
 * ```
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
 * @example
 * ```ts
 * import { Channel, Effect, Data } from "effect"
 *
 * class TransformError extends Data.TaggedError("TransformError")<{
 *   readonly reason: string
 * }> {}
 *
 * // Basic mapping of channel values
 * const numbersChannel = Channel.fromIterable([1, 2, 3, 4, 5])
 * const doubledChannel = Channel.map(numbersChannel, (n) => n * 2)
 * // Outputs: 2, 4, 6, 8, 10
 *
 * // Transform string data
 * const wordsChannel = Channel.fromIterable(["hello", "world", "effect"])
 * const upperCaseChannel = Channel.map(wordsChannel, (word) => word.toUpperCase())
 * // Outputs: "HELLO", "WORLD", "EFFECT"
 *
 * // Complex object transformation
 * type User = { id: number; name: string }
 * type UserDisplay = { displayName: string; isActive: boolean }
 *
 * const usersChannel = Channel.fromIterable([
 *   { id: 1, name: "Alice" },
 *   { id: 2, name: "Bob" }
 * ])
 * const displayChannel = Channel.map(usersChannel, (user): UserDisplay => ({
 *   displayName: `User: ${user.name}`,
 *   isActive: true
 * }))
 * ```
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
 * @example
 * ```ts
 * import { Channel, Effect, Data } from "effect"
 *
 * class NetworkError extends Data.TaggedError("NetworkError")<{
 *   readonly url: string
 * }> {}
 *
 * // Transform values using effectful operations
 * const urlsChannel = Channel.fromIterable([
 *   "/api/users/1",
 *   "/api/users/2",
 *   "/api/users/3"
 * ])
 *
 * const fetchDataChannel = Channel.mapEffect(
 *   urlsChannel,
 *   (url) => Effect.tryPromise({
 *     try: () => fetch(url).then(res => res.json()),
 *     catch: () => new NetworkError({ url })
 *   })
 * )
 *
 * // Concurrent processing with options
 * const numbersChannel = Channel.fromIterable([1, 2, 3, 4, 5])
 * const processedChannel = Channel.mapEffect(
 *   numbersChannel,
 *   (n) => Effect.gen(function* () {
 *     yield* Effect.sleep("100 millis") // Simulate async work
 *     return n * n
 *   }),
 *   { concurrency: 3, unordered: true }
 * )
 * ```
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
      yield* Scope.addFinalizer(forkedScope, Queue.shutdown(queue))

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
        yield* Scope.addFinalizer(forkedScope, Queue.shutdown(queue))

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
 * Applies a side effect function to each output element of the channel,
 * returning a new channel that emits the same elements.
 *
 * The `tap` function allows you to perform side effects (like logging or
 * debugging) on each element emitted by a channel without modifying the
 * elements themselves.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Console, Data } from "effect"
 *
 * class LogError extends Data.TaggedError("LogError")<{
 *   readonly message: string
 * }> {}
 *
 * // Create a channel that outputs numbers
 * const numberChannel = Channel.fromIterable([1, 2, 3])
 *
 * // Tap into each output element to perform side effects
 * const tappedChannel = Channel.tap(numberChannel, (n) =>
 *   Console.log(`Processing number: ${n}`)
 * )
 *
 * // The channel still outputs the same elements but logs each one
 * // Outputs: 1, 2, 3 (while logging each)
 * ```
 *
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
 * @example
 * ```ts
 * import { Channel, Effect, Data } from "effect"
 *
 * class ProcessError extends Data.TaggedError("ProcessError")<{
 *   readonly cause: string
 * }> {}
 *
 * // Create a channel that outputs numbers
 * const numberChannel = Channel.fromIterable([1, 2, 3])
 *
 * // FlatMap each number to create new channels
 * const flatMappedChannel = Channel.flatMap(numberChannel, (n) =>
 *   Channel.fromIterable(Array.from({ length: n }, (_, i) => `item-${n}-${i}`))
 * )
 *
 * // Flattens nested channels into a single stream
 * // Outputs: "item-1-0", "item-2-0", "item-2-1", "item-3-0", "item-3-1", "item-3-2"
 * ```
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
 * Concatenates this channel with another channel created from the terminal value
 * of this channel. The new channel is created using the provided function.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Data } from "effect"
 *
 * class ConcatError extends Data.TaggedError("ConcatError")<{
 *   readonly reason: string
 * }> {}
 *
 * // Create a channel that outputs numbers and terminates with sum
 * const numberChannel = Channel.fromIterable([1, 2, 3]).pipe(
 *   Channel.concatWith((sum: void) =>
 *     Channel.succeed(`Completed processing`)
 *   )
 * )
 *
 * // Concatenates additional channel based on completion value
 * // Outputs: 1, 2, 3, then "Completed processing"
 * ```
 *
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
 * Concatenates this channel with another channel, so that the second channel
 * starts emitting values after the first channel has completed.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Data } from "effect"
 *
 * class ConcatError extends Data.TaggedError("ConcatError")<{
 *   readonly reason: string
 * }> {}
 *
 * // Create two channels
 * const firstChannel = Channel.fromIterable([1, 2, 3])
 * const secondChannel = Channel.fromIterable(["a", "b", "c"])
 *
 * // Concatenate them
 * const concatenatedChannel = Channel.concat(firstChannel, secondChannel)
 *
 * // Outputs: 1, 2, 3, "a", "b", "c"
 * ```
 *
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
 * @example
 * ```ts
 * import { Channel, Effect, Data } from "effect"
 *
 * class FlattenError extends Data.TaggedError("FlattenError")<{
 *   readonly cause: string
 * }> {}
 *
 * // Create a channel that outputs channels
 * const nestedChannels = Channel.fromIterable([
 *   Channel.fromIterable([1, 2]),
 *   Channel.fromIterable([3, 4]),
 *   Channel.fromIterable([5, 6])
 * ])
 *
 * // Flatten the nested channels
 * const flattenedChannel = Channel.flatten(nestedChannels)
 *
 * // Outputs: 1, 2, 3, 4, 5, 6
 * ```
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
 * Flattens a channel that outputs arrays into a channel that outputs individual elements.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Data } from "effect"
 *
 * class FlattenError extends Data.TaggedError("FlattenError")<{
 *   readonly message: string
 * }> {}
 *
 * // Create a channel that outputs arrays
 * const arrayChannel = Channel.fromIterable([
 *   [1, 2, 3],
 *   [4, 5],
 *   [6, 7, 8, 9]
 * ])
 *
 * // Flatten the arrays into individual elements
 * const flattenedChannel = Channel.flattenArray(arrayChannel)
 *
 * // Outputs: 1, 2, 3, 4, 5, 6, 7, 8, 9
 * ```
 *
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
 * Catches any cause of failure from the channel and allows recovery by
 * creating a new channel based on the caught cause.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Cause, Data } from "effect"
 *
 * class ProcessError extends Data.TaggedError("ProcessError")<{
 *   readonly reason: string
 * }> {}
 *
 * class RecoveryError extends Data.TaggedError("RecoveryError")<{
 *   readonly message: string
 * }> {}
 *
 * // Create a failing channel
 * const failingChannel = Channel.fail(new ProcessError({ reason: "network error" }))
 *
 * // Catch the cause and provide recovery
 * const recoveredChannel = Channel.catchCause(failingChannel, (cause) => {
 *   if (Cause.hasFail(cause)) {
 *     return Channel.succeed("Recovered from failure")
 *   }
 *   return Channel.succeed("Recovered from interruption")
 * })
 *
 * // The channel recovers gracefully from errors
 * ```
 *
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
 * Catches causes of failure that match a specific filter, allowing
 * conditional error recovery based on the type of failure.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Cause, Filter, Data } from "effect"
 *
 * class NetworkError extends Data.TaggedError("NetworkError")<{
 *   readonly code: number
 * }> {}
 *
 * class ValidationError extends Data.TaggedError("ValidationError")<{
 *   readonly field: string
 * }> {}
 *
 * // Create a failing channel
 * const failingChannel = Channel.fail(new NetworkError({ code: 500 }))
 *
 * // Catch only network errors with specific codes
 * const recoveredChannel = Channel.catchCauseIf(
 *   failingChannel,
 *   (cause): cause is Cause.Cause<NetworkError> => Cause.hasFail(cause),
 *   (networkError) => Channel.succeed("Network recovered")
 * )
 * ```
 *
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
 * Converts all errors in the channel to defects (unrecoverable failures).
 * This is useful when you want to treat errors as programming errors.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Data } from "effect"
 *
 * class ValidationError extends Data.TaggedError("ValidationError")<{
 *   readonly field: string
 * }> {}
 *
 * // Create a channel that might fail
 * const failingChannel = Channel.fail(new ValidationError({ field: "email" }))
 *
 * // Convert failures to defects
 * const fatalChannel = Channel.orDie(failingChannel)
 *
 * // Any failure will now become a defect (uncaught exception)
 * ```
 *
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
 * @example
 * ```ts
 * import { Channel, Effect, Data } from "effect"
 *
 * class SwitchError extends Data.TaggedError("SwitchError")<{
 *   readonly reason: string
 * }> {}
 *
 * // Create a channel that outputs numbers
 * const numberChannel = Channel.fromIterable([1, 2, 3])
 *
 * // Switch to new channels based on each value
 * const switchedChannel = Channel.switchMap(numberChannel, (n) =>
 *   Channel.fromIterable([`value-${n}`])
 * )
 *
 * // Outputs: "value-1", "value-2", "value-3"
 * ```
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
 * Merges multiple channels with specified concurrency and buffering options.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Data } from "effect"
 *
 * class MergeAllError extends Data.TaggedError("MergeAllError")<{
 *   readonly reason: string
 * }> {}
 *
 * // Create channels that output other channels
 * const nestedChannels = Channel.fromIterable([
 *   Channel.fromIterable([1, 2]),
 *   Channel.fromIterable([3, 4]),
 *   Channel.fromIterable([5, 6])
 * ])
 *
 * // Merge all channels with bounded concurrency
 * const mergedChannel = Channel.mergeAll({
 *   concurrency: 2,
 *   bufferSize: 16
 * })(nestedChannels)
 *
 * // Outputs: 1, 2, 3, 4, 5, 6 (order may vary due to concurrency)
 * ```
 *
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
        yield* Scope.addFinalizer(forkedScope, Queue.shutdown(queue))

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
 * Represents strategies for halting merged channels when one completes or fails.
 *
 * @example
 * ```ts
 * import { Channel } from "effect"
 *
 * // Different halt strategies for channel merging
 * const leftFirst: Channel.HaltStrategy = "left"   // Stop when left channel halts
 * const rightFirst: Channel.HaltStrategy = "right"  // Stop when right channel halts
 * const both: Channel.HaltStrategy = "both"         // Stop when both channels halt
 * const either: Channel.HaltStrategy = "either"     // Stop when either channel halts
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type HaltStrategy = "left" | "right" | "both" | "either"

/**
 * Returns a new channel, which is the merge of this channel and the specified
 * channel.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Data } from "effect"
 *
 * class MergeError extends Data.TaggedError("MergeError")<{
 *   readonly source: string
 * }> {}
 *
 * // Create two channels
 * const leftChannel = Channel.fromIterable([1, 2, 3])
 * const rightChannel = Channel.fromIterable(["a", "b", "c"])
 *
 * // Merge them with "either" halt strategy
 * const mergedChannel = Channel.merge(leftChannel, rightChannel, {
 *   haltStrategy: "either"
 * })
 *
 * // Outputs elements from both channels concurrently
 * // Order may vary: 1, "a", 2, "b", 3, "c"
 * ```
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
    yield* Scope.addFinalizer(forkedScope, Queue.shutdown(queue))
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
 * @example
 * ```ts
 * import { Channel, Effect, Data } from "effect"
 *
 * class PipeError extends Data.TaggedError("PipeError")<{
 *   readonly stage: string
 * }> {}
 *
 * // Create source and transform channels
 * const sourceChannel = Channel.fromIterable([1, 2, 3])
 * const transformChannel = Channel.map(sourceChannel, (n: number) => n * 2)
 *
 * // Pipe the source into the transform
 * const pipedChannel = Channel.pipeTo(sourceChannel, transformChannel)
 *
 * // Outputs: 2, 4, 6
 * ```
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
 * @example
 * ```ts
 * import { Channel, Effect, Data } from "effect"
 *
 * class SourceError extends Data.TaggedError("SourceError")<{
 *   readonly code: number
 * }> {}
 *
 * // Create a failing source channel
 * const failingSource = Channel.fail(new SourceError({ code: 404 }))
 * const safeTransform = Channel.succeed("transformed")
 *
 * // Pipe while preserving source failures
 * const safePipedChannel = Channel.pipeToOrFail(failingSource, safeTransform)
 *
 * // Source errors are preserved and not sent to transform channel
 * ```
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
 * @example
 * ```ts
 * import { Channel, Effect, Scope, Data } from "effect"
 *
 * class UnwrapError extends Data.TaggedError("UnwrapError")<{
 *   readonly reason: string
 * }> {}
 *
 * // Create an effect that produces a channel
 * const channelEffect = Effect.succeed(
 *   Channel.fromIterable([1, 2, 3])
 * )
 *
 * // Unwrap the effect to get the channel
 * const unwrappedChannel = Channel.unwrap(channelEffect)
 *
 * // The resulting channel outputs: 1, 2, 3
 * ```
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
 * @example
 * ```ts
 * import { Channel, Effect, Data } from "effect"
 *
 * class EmbedError extends Data.TaggedError("EmbedError")<{
 *   readonly stage: string
 * }> {}
 *
 * // Create a base channel
 * const baseChannel = Channel.fromIterable([1, 2, 3])
 *
 * // Embed input handling - simplified example
 * const embeddedChannel = Channel.embedInput(baseChannel, (_upstream) =>
 *   Effect.void
 * )
 * ```
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
 * @example
 * ```ts
 * import { Channel, Effect, Exit, Console, Data } from "effect"
 *
 * class ExitError extends Data.TaggedError("ExitError")<{
 *   readonly stage: string
 * }> {}
 *
 * // Create a channel
 * const dataChannel = Channel.fromIterable([1, 2, 3])
 *
 * // Attach exit handler
 * const channelWithExit = Channel.onExit(dataChannel, (exit) => {
 *   if (Exit.isSuccess(exit)) {
 *     return Console.log(`Channel completed successfully with: ${exit.value}`)
 *   } else {
 *     return Console.log(`Channel failed with: ${exit.cause}`)
 *   }
 * })
 * ```
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
    Scope.addFinalizerExit(forkedScope, finalizer as any).pipe(
      Effect.andThen(toTransform(self)(upstream, scope))
    )
  ))

/**
 * Returns a new channel with an attached finalizer. The finalizer is
 * guaranteed to be executed so long as the channel begins execution (and
 * regardless of whether or not it completes).
 *
 * @example
 * ```ts
 * import { Channel, Effect, Console, Data } from "effect"
 *
 * class EnsureError extends Data.TaggedError("EnsureError")<{
 *   readonly operation: string
 * }> {}
 *
 * // Create a channel
 * const dataChannel = Channel.fromIterable([1, 2, 3])
 *
 * // Ensure cleanup always runs
 * const channelWithCleanup = Channel.ensuring(dataChannel,
 *   Console.log("Cleanup executed regardless of success or failure")
 * )
 * ```
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
 * Runs a channel and counts the number of elements it outputs.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Data } from "effect"
 *
 * class CountError extends Data.TaggedError("CountError")<{
 *   readonly reason: string
 * }> {}
 *
 * // Create a channel with multiple elements
 * const numbersChannel = Channel.fromIterable([1, 2, 3, 4, 5])
 *
 * // Count the elements
 * const countEffect = Channel.runCount(numbersChannel)
 *
 * // Effect.runSync(countEffect) // Returns: 5
 * ```
 *
 * @since 2.0.0
 * @category execution
 */
export const runCount = <OutElem, OutErr, OutDone, Env>(
  self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>
): Effect.Effect<void, OutErr, Env> => runFold(self, () => 0, (acc) => acc + 1)

/**
 * Runs a channel and discards all output elements, returning only the final result.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Data } from "effect"
 *
 * class DrainError extends Data.TaggedError("DrainError")<{
 *   readonly stage: string
 * }> {}
 *
 * // Create a channel that outputs elements and completes with a result
 * const resultChannel = Channel.fromIterable([1, 2, 3])
 * const completedChannel = Channel.concatWith(resultChannel, () => Channel.succeed("completed"))
 *
 * // Drain all elements and get only the final result
 * const drainEffect = Channel.runDrain(completedChannel)
 *
 * // Effect.runSync(drainEffect) // Returns: "completed"
 * ```
 *
 * @since 2.0.0
 * @category execution
 */
export const runDrain = <OutElem, OutErr, OutDone, Env>(
  self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>
): Effect.Effect<OutDone, OutErr, Env> => runWith(self, (pull) => Effect.forever(pull, { autoYield: false }))

/**
 * Runs a channel and applies an effect to each output element.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Console, Data } from "effect"
 *
 * class ForEachError extends Data.TaggedError("ForEachError")<{
 *   readonly element: unknown
 * }> {}
 *
 * // Create a channel with numbers
 * const numbersChannel = Channel.fromIterable([1, 2, 3])
 *
 * // Run forEach to log each element
 * const forEachEffect = Channel.runForEach(numbersChannel, (n) =>
 *   Console.log(`Processing: ${n}`)
 * )
 *
 * // Logs: "Processing: 1", "Processing: 2", "Processing: 3"
 * ```
 *
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
 * Runs a channel and collects all output elements into an array.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Data } from "effect"
 *
 * class CollectError extends Data.TaggedError("CollectError")<{
 *   readonly reason: string
 * }> {}
 *
 * // Create a channel with elements
 * const numbersChannel = Channel.fromIterable([1, 2, 3, 4, 5])
 *
 * // Collect all elements into an array
 * const collectEffect = Channel.runCollect(numbersChannel)
 *
 * // Effect.runSync(collectEffect) // Returns: [1, 2, 3, 4, 5]
 * ```
 *
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
 * Runs a channel and folds over all output elements with an accumulator.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Data } from "effect"
 *
 * class FoldError extends Data.TaggedError("FoldError")<{
 *   readonly operation: string
 * }> {}
 *
 * // Create a channel with numbers
 * const numbersChannel = Channel.fromIterable([1, 2, 3, 4, 5])
 *
 * // Fold to calculate sum
 * const sumEffect = Channel.runFold(numbersChannel, () => 0, (acc, n) => acc + n)
 *
 * // Effect.runSync(sumEffect) // Returns: 15
 * ```
 *
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
 * Converts a channel to a Pull data structure for low-level consumption.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Scope, Data } from "effect"
 *
 * class PullError extends Data.TaggedError("PullError")<{
 *   readonly step: string
 * }> {}
 *
 * // Create a channel
 * const numbersChannel = Channel.fromIterable([1, 2, 3])
 *
 * // Convert to Pull within a scope
 * const pullEffect = Effect.scoped(
 *   Channel.toPull(numbersChannel)
 * )
 *
 * // Use the Pull to manually consume elements
 * ```
 *
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
 * Converts a channel to a Pull within an existing scope.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Scope, Data } from "effect"
 *
 * class ScopedPullError extends Data.TaggedError("ScopedPullError")<{
 *   readonly reason: string
 * }> {}
 *
 * // Create a channel
 * const numbersChannel = Channel.fromIterable([1, 2, 3])
 *
 * // Convert to Pull with explicit scope
 * const scopedPullEffect = Effect.gen(function* () {
 *   const scope = yield* Scope.make()
 *   const pull = yield* Channel.toPullScoped(numbersChannel, scope)
 *   return pull
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const toPullScoped = <OutElem, OutErr, OutDone, Env>(
  self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>,
  scope: Scope.Scope
): Effect.Effect<Pull.Pull<OutElem, OutErr, OutDone, Env>, never, Env> => toTransform(self)(Pull.haltVoid, scope)

/**
 * Converts a channel to a queue for concurrent consumption.
 *
 * @example
 * ```ts
 * import { Channel, Effect, Queue, Data } from "effect"
 *
 * class QueueError extends Data.TaggedError("QueueError")<{
 *   readonly operation: string
 * }> {}
 *
 * // Create a channel with data
 * const dataChannel = Channel.fromIterable([1, 2, 3, 4, 5])
 *
 * // Convert to queue for concurrent processing
 * const queueEffect = Channel.toQueue({ bufferSize: 32 })(dataChannel)
 *
 * // The queue can be used for concurrent consumption
 * // Multiple consumers can read from the queue
 * ```
 *
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
    yield* Scope.addFinalizer(scope, Queue.shutdown(queue))
    yield* runForEach(self, (value) => Queue.offer(queue, value)).pipe(
      Effect.onExit((exit) => Queue.done(queue, Exit.asVoid(exit))),
      Effect.forkIn(scope),
      Effect.interruptible
    )
    return queue
  })
)
