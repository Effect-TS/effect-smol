/**
 * @since 2.0.0
 */
import * as Cause from "./Cause.js"
import * as Chunk from "./Chunk.js"
import * as Context from "./Context.js"
import * as Effect from "./Effect.js"
import * as Exit from "./Exit.js"
import * as Fiber from "./Fiber.js"
import type { LazyArg } from "./Function.js"
import { constTrue, dual, identity } from "./Function.js"
import * as internalMailbox from "./internal/mailbox.js"
import * as Iterable from "./Iterable.js"
import type { Mailbox, ReadonlyMailbox } from "./Mailbox.js"
import * as Option from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"
import { hasProperty } from "./Predicate.js"
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

// -----------------------------------------------------------------------------
// Halt
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 * @category Halt
 */
export const HaltTypeId: unique symbol = Symbol.for("effect/Channel/Halt")

/**
 * @since 4.0.0
 * @category Halt
 */
export type HaltTypeId = typeof HaltTypeId

/**
 * @since 4.0.0
 * @category Halt
 */
export class Halt<out L> {
  /**
   * @since 4.0.0
   */
  readonly [HaltTypeId]: HaltTypeId = HaltTypeId
  /**
   * @since 4.0.0
   */
  readonly _tag = "Halt"
  constructor(readonly leftover: L) {}
}

/**
 * @since 4.0.0
 * @category Halt
 */
export declare namespace Halt {
  /**
   * @since 4.0.0
   * @category Halt
   */
  export type ExcludeHalt<E> = Exclude<E, Halt<any>>

  /**
   * @since 4.0.0
   * @category Halt
   */
  export type Extract<E> = E extends Halt<infer L> ? L : never

  /**
   * @since 4.0.0
   * @category Halt
   */
  export type Only<E> = E extends Halt<infer L> ? Halt<L> : never
}

/**
 * @since 4.0.0
 * @category Halt
 */
export function catchHalt<A, R, E, A2, E2, R2>(
  effect: Effect.Effect<A, E, R>,
  f: (leftover: Halt.Extract<E>) => Effect.Effect<A2, E2, R2>
): Effect.Effect<A | A2, Halt.ExcludeHalt<E> | E2, R | R2> {
  return Effect.catchFailure(effect, isHaltFailure, (failure) => f(failure.error.leftover)) as any
}

/**
 * @since 4.0.0
 * @category Halt
 */
export const isHalt = (u: unknown): u is Halt<unknown> => hasProperty(u, HaltTypeId)

/**
 * @since 4.0.0
 * @category Halt
 */
export const isHaltCause = <E>(cause: Cause.Cause<E>): boolean => cause.failures.some(isHaltFailure)

/**
 * @since 4.0.0
 * @category Halt
 */
export const isHaltFailure = <E>(
  failure: Cause.Failure<E>
): failure is Cause.Fail<E & Halt<any>> => failure._tag === "Fail" && isHalt(failure.error)

/**
 * @since 4.0.0
 * @category Halt
 */
export const halt = <L>(leftover: L): Effect.Effect<never, Halt<L>> => Effect.fail(new Halt(leftover))

/**
 * @since 4.0.0
 * @category Halt
 */
export const haltVoid: Effect.Effect<never, Halt<void>> = Effect.fail(new Halt(void 0))

/**
 * @since 4.0.0
 * @category Halt
 */
export const haltFromCause = <E>(cause: Cause.Cause<E>): Halt<Halt.Extract<E>> | undefined =>
  cause.failures.find(isHaltFailure)?.error

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
    upstream: Effect.Effect<InElem, InErr | Halt<InDone>>,
    scope: Scope.Scope
  ) => Effect.Effect<Effect.Effect<OutElem, OutErr | Halt<OutDone>, EnvX>, EX, Env>
): Channel<OutElem, OutErr | EX, OutDone, InElem, InErr, InDone, Env | EnvX> => {
  const self = Object.create(ChannelProto)
  self.transform = transform
  return self
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromPull = <OutElem, OutErr, OutDone, EX, EnvX, Env>(
  effect: Effect.Effect<Effect.Effect<OutElem, OutErr | Halt<OutDone>, EnvX>, EX, Env>
): Channel<OutElem, Halt.ExcludeHalt<OutErr> | EX, OutDone, unknown, unknown, unknown, Env | EnvX> =>
  fromTransform((_, __) => effect) as any

const makeImplBracket = <OutElem, OutErr, OutDone, InElem, InErr, InDone, EX, EnvX, Env>(
  f: (
    upstream: Effect.Effect<InElem, InErr | Halt<InDone>>,
    scope: Scope.Scope,
    forkedScope: Scope.Scope
  ) => Effect.Effect<Effect.Effect<OutElem, OutErr | Halt<OutDone>, EnvX>, EX, Env>
): Channel<OutElem, OutErr | EX, OutDone, InElem, InErr, InDone, Env | EnvX> =>
  fromTransform(
    Effect.fnUntraced(function*(upstream, scope) {
      const closableScope = yield* scope.fork
      const onCause = (cause: Cause.Cause<EX | OutErr | Halt<OutDone>>) => {
        const halt = haltFromCause(cause)
        return closableScope.close(halt ? Exit.succeed(halt.leftover) : Exit.failCause(cause))
      }
      const pull = yield* Effect.onError(
        f(upstream, scope, closableScope),
        onCause
      )
      return Effect.onError(pull, onCause)
    })
  )

const toTransform = <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>(
  channel: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
): (
  upstream: Effect.Effect<InElem, InErr | Halt<InDone>>,
  scope: Scope.Scope
) => Effect.Effect<Effect.Effect<OutElem, OutErr | Halt<OutDone>>, never, Env> => (channel as any).transform

/**
 * @since 2.0.0
 * @category models
 */
export const DefaultChunkSize: number = 4096

/**
 * @since 2.0.0
 * @category models
 */
export interface Emit<in A, in E> {
  /**
   * Terminates with a cause that dies with the specified defect.
   */
  die<Err>(defect: Err): void

  /**
   * Either emits the specified value if this `Exit` is a `Success` or else
   * terminates with the specified cause if this `Exit` is a `Failure`.
   */
  done(exit: Exit.Exit<A, E>): void

  /**
   * Terminates with an end of stream signal.
   */
  end(): void

  /**
   * Terminates with the specified error.
   */
  fail(error: E): void

  /**
   * Terminates the channel with the specified cause.
   */
  failCause(cause: Cause.Cause<E>): void

  /**
   * Emits a value
   */
  single(value: A): boolean
}

const emitFromMailbox = <A, E>(mailbox: Mailbox<A, E>): Emit<A, E> => ({
  die: (defect) => mailbox.unsafeDone(Exit.die(defect)),
  done: (exit) => mailbox.unsafeDone(Exit.asVoid(exit)),
  end: () => mailbox.unsafeDone(Exit.void),
  fail: (error) => mailbox.unsafeDone(Exit.fail(error)),
  failCause: (cause) => mailbox.unsafeDone(Exit.failCause(cause)),
  single: (value) => mailbox.unsafeOffer(value)
})

const mailboxToPull = <A, E, L>(mailbox: ReadonlyMailbox<A, E>): Effect.Effect<A, Halt<L> | E> =>
  Effect.catch(
    mailbox.take,
    (o): Effect.Effect<never, Halt<void> | E> => Option.isSome(o) ? Effect.fail(o.value) : haltVoid
  ) as any

/**
 * @since 2.0.0
 * @category constructors
 */
export const asyncPush = <A, E = never, R = never>(
  f: (emit: Emit<A, E>) => Effect.Effect<unknown, E, R | Scope.Scope>,
  options?: {
    readonly bufferSize?: number | undefined
    readonly strategy?: "sliding" | "dropping" | undefined
  }
): Channel<A, E, void, unknown, unknown, unknown, Exclude<R, Scope.Scope>> =>
  fromTransform(
    Effect.fnUntraced(function*(_, scope) {
      const mailbox = yield* internalMailbox.make<A, E>({
        capacity: options?.bufferSize,
        strategy: options?.strategy
      })
      yield* scope.addFinalizer(() => mailbox.shutdown)
      const emit = emitFromMailbox(mailbox)
      yield* Effect.forkIn(Scope.provideScope(f(emit), scope), scope)
      return mailboxToPull(mailbox)
    })
  )

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
      yield* forkedScope.addFinalizer((exit) =>
        Option.isSome(option)
          ? release(option.value, exit as any)
          : Effect.void
      )
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
  unwrapScoped(Effect.map(
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
        return state.done ? halt(state.value) : Effect.succeed(state.value)
      })
    })
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromArray = <A>(array: ReadonlyArray<A>): Channel<A> =>
  fromPull(
    Effect.sync(() => {
      let index = 0
      return Effect.suspend(() => {
        return index >= array.length ? haltVoid : Effect.succeed(array[index++])
      })
    })
  )

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
): Channel<ReadonlyArray<A>, never, L> =>
  fromPull(
    Effect.sync(() => {
      const iter = iterator()
      let done = Option.none<L>()
      return Effect.suspend(() => {
        if (done._tag === "Some") return halt(done.value)
        const buffer: Array<A> = []
        while (buffer.length < chunkSize) {
          const state = iter.next()
          if (state.done) {
            if (buffer.length === 0) {
              return halt(state.value)
            }
            done = Option.some(state.value)
            break
          }
          buffer.push(state.value)
        }
        return Effect.succeed(buffer)
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
): Channel<ReadonlyArray<A>, never, L> => fromIteratorArray(() => iterable[Symbol.iterator]())

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
export const empty: Channel<never> = fromPull(Effect.succeed(haltVoid))

/**
 * Represents an Channel that never completes
 *
 * @since 2.0.0
 * @category constructors
 */
export const never: Channel<never> = fromPull(
  Effect.succeed(Effect.never)
)

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
      return Effect.suspend((): Effect.Effect<A, E | Halt<void>, R> => {
        if (done) return haltVoid
        done = true
        return effect
      })
    })
  )

/**
 * Create a channel from a ReadonlyMailbox
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromMailbox = <A, E>(
  mailbox: ReadonlyMailbox<A, E>
): Channel<A, E> => fromPull(Effect.sync(() => mailboxToPull(mailbox)))

/**
 * Create a channel from a ReadonlyMailbox
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromMailboxChunk = <A, E>(
  mailbox: ReadonlyMailbox<A, E>
): Channel<Chunk.Chunk<A>, E> =>
  fromPull(
    Effect.succeed(
      Effect.flatMap(mailbox.takeAll, ([values]) => values.length === 0 ? haltVoid : Effect.succeed(values))
    )
  )

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
    }
  ): <OutErr, OutDone, InElem, InErr, InDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
  ) => Channel<OutElem1, OutErr1 | OutErr, OutDone, InElem, InErr, InDone, Env1 | Env>
  <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env, OutElem1, OutErr1, Env1>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    f: (d: OutElem) => Effect.Effect<OutElem1, OutErr1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
    }
  ): Channel<OutElem1, OutErr | OutErr1, OutDone, InElem, InErr, InDone, Env | Env1>
} = dual(
  (args) => isChannel(args[0]),
  <OutElem, OutErr, OutDone, InElem, InErr, InDone, Env, OutElem1, OutErr1, Env1>(
    self: Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>,
    f: (d: OutElem) => Effect.Effect<OutElem1, OutErr1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded" | undefined
      readonly bufferSize?: number | undefined
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
    readonly bufferSize?: number | undefined
  }
): Channel<OutElem2, OutErr | EX, OutDone, InElem, InErr, InDone, Env | RX> =>
  makeImplBracket(
    Effect.fnUntraced(function*(upstream, scope, forkedScope) {
      const pull = yield* toTransform(self)(upstream, scope)
      const concurrencyN = options.concurrency === "unbounded"
        ? Number.MAX_SAFE_INTEGER
        : options.concurrency
      const semaphore = Effect.unsafeMakeSemaphore(concurrencyN)
      const mailbox = yield* internalMailbox.make<OutElem2, OutErr | EX | Halt<OutDone>>(
        options.bufferSize ?? 16
      )
      yield* forkedScope.addFinalizer(() => mailbox.shutdown)

      yield* Effect.gen(function*() {
        while (true) {
          yield* semaphore.take(1)
          const value = yield* pull
          yield* f(value).pipe(
            Effect.flatMap((value) => mailbox.offer(value)),
            Effect.ensuring(semaphore.release(1)),
            Effect.fork
          )
        }
      }).pipe(
        Effect.tapCause(() => semaphore.take(concurrencyN - 1)),
        Effect.onExit((exit) => mailbox.done(exit)),
        Effect.forkIn(forkedScope)
      )

      return mailboxToPull(mailbox)
    })
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
      let childPull: Effect.Effect<OutElem1, OutErr1, Env1> | null = null
      const makePull: Effect.Effect<OutElem1, OutErr | OutErr1 | Halt<OutDone>, Env1> = pull.pipe(
        Effect.flatMap((value) => toTransform(f(value))(upstream, scope)),
        Effect.flatMap((pull) => {
          childPull = catchHalt(pull, (_) => {
            childPull = null
            return makePull
          }) as any
          return childPull!
        })
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

        const mailbox = yield* internalMailbox.make<OutElem, OutErr | OutErr1 | Halt<OutDone>>(
          bufferSize
        )
        yield* forkedScope.addFinalizer(() => mailbox.shutdown)

        const pull = yield* toTransform(channels)(upstream, scope)

        yield* Effect.gen(function*() {
          while (true) {
            if (semaphore) yield* semaphore.take(1)
            const channel = yield* pull
            const childPull = yield* toTransform(channel)(upstream, scope)

            while (fibers.size >= concurrencyN) {
              const fiber = Iterable.unsafeHead(fibers)
              fibers.delete(fiber)
              if (fibers.size === 0) yield* doneLatch.open
              yield* Fiber.interrupt(fiber)
            }

            const fiber = yield* childPull.pipe(
              Effect.flatMap((value) => mailbox.offer(value)),
              Effect.forever,
              Effect.onError(Effect.fnUntraced(function*(cause) {
                if (!fibers.has(fiber)) return
                fibers.delete(fiber)
                if (semaphore) yield* semaphore.release(1)
                if (fibers.size === 0) yield* doneLatch.open
                if (isHaltCause(cause) || Cause.isOnlyInterrupt(cause)) return
                return yield* mailbox.failCause(cause as any)
              })),
              Effect.fork
            )

            doneLatch.unsafeClose()
            fibers.add(fiber)
          }
        }).pipe(
          Effect.tapCause(() => doneLatch.await),
          Effect.onExit((exit) => mailbox.done(exit)),
          Effect.forkIn(forkedScope),
          Effect.interruptible
        )

        return mailboxToPull(mailbox)
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
  makeImplBracket(Effect.fnUntraced(function*(upstream, scope, forkedScope) {
    const strategy = options?.haltStrategy ?? "both"
    const mailbox = yield* internalMailbox.make<OutElem | OutElem1, OutErr | OutErr1 | Halt<OutDone | OutDone1>>(0)
    yield* forkedScope.addFinalizer(() => mailbox.shutdown)
    let done = 0
    function onExit(
      side: "left" | "right",
      cause: Cause.Cause<OutErr | OutErr1 | Halt<OutDone | OutDone1>>
    ): Effect.Effect<void> {
      done++
      if (!isHaltCause(cause)) {
        return mailbox.failCause(cause)
      }
      switch (strategy) {
        case "both": {
          return done === 2 ? mailbox.failCause(cause) : Effect.void
        }
        case "left":
        case "right": {
          return side === strategy ? mailbox.failCause(cause) : Effect.void
        }
        case "either": {
          return mailbox.failCause(cause)
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
      >
    ) =>
      toTransform(channel)(upstream, scope).pipe(
        Effect.flatMap((pull) =>
          pull.pipe(
            Effect.flatMap((value) => mailbox.offer(value)),
            Effect.forever
          )
        ),
        Effect.onError((cause) => onExit(side, cause)),
        Effect.forkIn(forkedScope),
        Effect.interruptible
      )
    yield* runSide("left", left)
    yield* runSide("right", right)
    return mailboxToPull(mailbox)
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
          (cause) => isHaltCause(cause) ? Effect.failCause(cause) : Effect.die(new Halt(cause))
        ) as Effect.Effect<OutElem, Halt<OutDone>>

        return Effect.map(
          toTransform(that)(upstreamPull, scope),
          (pull) =>
            Effect.catchDefect(
              pull,
              (defect) => isHalt(defect) ? Effect.failCause(defect.leftover as Cause.Cause<OutErr>) : Effect.die(defect)
            )
        )
      })
    )
)

/**
 * Constructs a `Channel` from an effect that will result in a `Channel` if
 * successful.
 *
 * @since 2.0.0
 * @category constructors
 */
export const unwrap = <OutElem, OutErr, OutDone, InElem, InErr, InDone, R2, E, R>(
  channel: Effect.Effect<Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, R2>, E, R>
): Channel<OutElem, E | OutErr, OutDone, InElem, InErr, InDone, R | R2> =>
  fromTransform((upstream, scope) =>
    Effect.flatMap(
      channel,
      (channel) => toTransform(channel)(upstream, scope)
    )
  )

/**
 * Constructs a `Channel` from a scoped effect that will result in a
 * `Channel` if successful.
 *
 * @since 2.0.0
 * @category constructors
 */
export const unwrapScoped = <OutElem, OutErr, OutDone, InElem, InErr, InDone, R2, E, R>(
  channel: Effect.Effect<Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, R2>, E, R>
): Channel<OutElem, E | OutErr, OutDone, InElem, InErr, InDone, Exclude<R, Scope.Scope> | R2> =>
  fromTransform((upstream, scope) =>
    Effect.flatMap(
      Scope.provideScope(channel, scope),
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
      upstream: Effect.Effect<InElem, InErr | Halt<InDone>>
    ) => Effect.Effect<void, never, R>
  ): <OutElem, OutErr, OutDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>
  ) => Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env | R>
  <OutElem, OutErr, OutDone, Env, InErr, InElem, InDone, R>(
    self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>,
    input: (
      upstream: Effect.Effect<InElem, InErr | Halt<InDone>>
    ) => Effect.Effect<void, never, R>
  ): Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env | R>
} = dual(
  2,
  <OutElem, OutErr, OutDone, Env, InErr, InElem, InDone, R>(
    self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>,
    input: (
      upstream: Effect.Effect<InElem, InErr | Halt<InDone>>
    ) => Effect.Effect<void, never, R>
  ): Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env | R> =>
    makeImplBracket(
      Effect.fnUntraced(function*(upstream, scope, forkedScope) {
        yield* Effect.interruptible(Effect.forkIn(input(upstream), forkedScope))
        return yield* toTransform(self)(haltVoid, scope)
      })
    )
)

/**
 * Returns a new channel with an attached finalizer. The finalizer is
 * guaranteed to be executed so long as the channel begins execution (and
 * regardless of whether or not it completes).
 *
 * @since 2.0.0
 * @category utils
 */
export const ensuringWith: {
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
    forkedScope.addFinalizer(finalizer as any).pipe(
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
): Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env2 | Env> => ensuringWith(self, (_) => finalizer))

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
  f: (pull: Effect.Effect<OutElem, OutErr | Halt<OutDone>>) => Effect.Effect<void, EX, RX>,
  onHalt?: (leftover: OutDone) => Effect.Effect<AH, EH, RH>
): Effect.Effect<AH, Halt.ExcludeHalt<EX> | EH, Env | RX | RH> =>
  Effect.suspend(() => {
    const scope = Scope.unsafeMake()
    const makePull = toTransform(self)(haltVoid, scope)
    return catchHalt(Effect.flatMap(makePull, f), onHalt ? onHalt : Effect.succeed as any).pipe(
      Effect.onExit((exit) => scope.close(exit))
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
  Effect.Effect<OutElem, OutErr | Halt<OutDone>>,
  never,
  Exclude<Env, Scope.Scope> | Scope.Scope
> = Effect.fnUntraced(
  function*<OutElem, OutErr, OutDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>
  ) {
    const semaphore = Effect.unsafeMakeSemaphore(1)
    const context = yield* Effect.context<Env | Scope.Scope>()
    const scope = Context.get(context, Scope.Scope)
    const pull = yield* toTransform(self)(haltVoid, scope)
    return pull.pipe(
      Effect.provideContext(context),
      semaphore.withPermits(1)
    )
  },
  // ensure errors are redirected to the pull effect
  Effect.catchCause((cause) => Effect.succeed(Effect.failCause(cause)))
) as any

/**
 * @since 4.0.0
 * @category conversions
 */
export const toMailbox: {
  (options?: {
    readonly bufferSize?: number | undefined
  }): <OutElem, OutErr, OutDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>
  ) => Effect.Effect<ReadonlyMailbox<OutElem, OutErr>, never, Env | Scope.Scope>
  <OutElem, OutErr, OutDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>,
    options?: {
      readonly bufferSize?: number | undefined
    }
  ): Effect.Effect<ReadonlyMailbox<OutElem, OutErr>, never, Env | Scope.Scope>
} = dual(
  (args) => isChannel(args[0]),
  Effect.fnUntraced(function*<OutElem, OutErr, OutDone, Env>(
    self: Channel<OutElem, OutErr, OutDone, unknown, unknown, unknown, Env>,
    options?: {
      readonly bufferSize?: number | undefined
    }
  ) {
    const scope = yield* Effect.scope
    const mailbox = yield* internalMailbox.make<OutElem, OutErr>(
      options?.bufferSize
    )
    yield* scope.addFinalizer(() => mailbox.shutdown)
    yield* runForEach(self, (value) => mailbox.offer(value)).pipe(
      Effect.onExit((exit) => mailbox.done(Exit.asVoid(exit))),
      Effect.forkIn(scope),
      Effect.interruptible
    )
    return mailbox
  })
)
