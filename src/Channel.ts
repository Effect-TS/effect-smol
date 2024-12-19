/**
 * @since 2.0.0
 */
import { Pipeable, pipeArguments } from "./Pipeable.js"
import * as Unify from "./Unify.js"
import * as Effect from "./Effect.js"
import * as Types from "./Types.js"
import {
  LazyArg,
  constant,
  constTrue,
  constVoid,
  dual,
  identity,
} from "./Function.js"
import * as Cause from "./Cause.js"
import * as internalMailbox from "./internal/mailbox.js"
import type { Mailbox, ReadonlyMailbox } from "./Mailbox.js"
import * as Exit from "./Exit.js"
import * as Scope from "./Scope.js"
import * as Chunk from "effect/Chunk"
import * as Context from "./Context.js"
import * as Option from "./Option.js"

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
  in InElem = unknown,
  out OutErr = never,
  in InErr = unknown,
  out Env = never,
> extends Channel.Variance<OutElem, InElem, OutErr, InErr, Env>,
    Pipeable {
  [Unify.typeSymbol]?: unknown
  [Unify.unifySymbol]?: ChannelUnify<this>
  [Unify.ignoreSymbol]?: ChannelUnifyIgnore
}

/**
 * @since 2.0.0
 * @category models
 */
export interface ChannelUnify<A extends { [Unify.typeSymbol]?: any }>
  extends Effect.EffectUnify<A> {
  Channel?: () => A[Unify.typeSymbol] extends
    | Channel<infer OutElem, infer InElem, infer OutErr, infer InErr, infer Env>
    | infer _
    ? Channel<OutElem, InElem, OutErr, InErr, Env>
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
    in InElem,
    out OutErr,
    in InErr,
    out Env,
  > {
    readonly [TypeId]: VarianceStruct<OutElem, InElem, OutErr, InErr, Env>
  }
  /**
   * @since 2.0.0
   * @category models
   */
  export interface VarianceStruct<
    out OutElem,
    in InElem,
    out OutErr,
    in InErr,
    out Env,
  > {
    _Env: Types.Covariant<Env>
    _InErr: Types.Contravariant<InErr>
    _InElem: Types.Contravariant<InElem>
    _OutErr: Types.Covariant<OutErr>
    _OutElem: Types.Covariant<OutElem>
  }
}

// -----------------------------------------------------------------------------
// Halt
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 * @category Halt
 */
export const Halt: unique symbol = Symbol.for("effect/Channel/Halt")

/**
 * @since 4.0.0
 * @category Halt
 */
export type Halt = typeof Halt

function catchHalt<A, R, E, A2, E2, R2>(
  effect: Effect.Effect<A, E, R>,
  f: (halt: Halt) => Effect.Effect<A2, E2, R2>,
) {
  return Effect.catchFailure(effect, isHaltFailure, (failure) =>
    f(failure.defect),
  )
}

function haltFromCause<E>(cause: Cause.Cause<E>): Halt | undefined {
  return cause.failures.find(isHaltFailure)?.defect
}

/**
 * @since 4.0.0
 * @category Halt
 */
export const isHalt = (u: unknown): u is Halt => u === Halt

/**
 * @since 4.0.0
 * @category Halt
 */
export const isHaltCause = <E>(cause: Cause.Cause<E>): boolean =>
  cause.failures.some(isHaltFailure)

/**
 * @since 4.0.0
 * @category Halt
 */
export const isHaltFailure = <E>(
  failure: Cause.Failure<E>,
): failure is Cause.Die & { readonly defect: Halt } =>
  failure._tag === "Die" && failure.defect === Halt

/**
 * @since 4.0.0
 * @category Halt
 */
export const halt: Effect.Effect<never> = Effect.die(Halt)

const ChannelProto = {
  [TypeId]: {
    _Env: identity,
    _InErr: identity,
    _InElem: identity,
    _OutErr: identity,
    _OutElem: identity,
  },
  pipe() {
    return pipeArguments(this, arguments)
  },
}

// -----------------------------------------------------------------------------
// Constructors
// -----------------------------------------------------------------------------

const makeImpl = <OutElem, InElem, OutErr, InErr, EX, EnvX, Env>(
  transform: (
    upstream: Effect.Effect<InElem, InErr>,
    scope: Scope.Scope,
  ) => Effect.Effect<Effect.Effect<OutElem, OutErr, EnvX>, EX, Env>,
): Channel<OutElem, InElem, OutErr | EX, InErr, Env | EnvX> => {
  const self = Object.create(ChannelProto)
  self.transform = transform
  return self
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromPull = <OutElem, OutErr, EX, EnvX, Env>(
  effect: Effect.Effect<Effect.Effect<OutElem, OutErr, EnvX>, EX, Env>,
): Channel<OutElem, unknown, OutErr | EX, unknown, Env | EnvX> =>
  makeImpl((_, __) => effect)

const makeImplScoped = <OutElem, InElem, OutErr, InErr, EX, EnvX, Env>(
  f: (
    upstream: Effect.Effect<InElem, InErr>,
    scope: Scope.Scope,
    forkedScope: Scope.Scope,
  ) => Effect.Effect<Effect.Effect<OutElem, OutErr, EnvX>, EX, Env>,
): Channel<OutElem, InElem, OutErr | EX, InErr, Env | EnvX> =>
  makeImpl(
    Effect.fnUntraced(function* (upstream, scope) {
      const closableScope = yield* scope.fork
      const pull = yield* f(upstream, scope, closableScope)
      return Effect.onError(pull, (cause) =>
        closableScope.close(
          isHaltCause(cause) ? Exit.void : Exit.failCause(cause),
        ),
      )
    }),
  )

const toTransform = <OutElem, InElem, OutErr, InErr, Env>(
  channel: Channel<OutElem, InElem, OutErr, InErr, Env>,
): ((
  upstream: Effect.Effect<InElem, InErr>,
  scope: Scope.Scope,
) => Effect.Effect<Effect.Effect<OutElem, OutErr>, never, Env>) =>
  (channel as any).transform

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
  single: (value) => mailbox.unsafeOffer(value),
})

const mailboxToPull = <A, E>(mailbox: ReadonlyMailbox<A, E>) => {
  let buffer: ReadonlyArray<A> = []
  let index = 0
  let done = false
  const refill = Effect.map(mailbox.takeAll, ([values, done_]) => {
    buffer = Chunk.toReadonlyArray(values)
    index = 0
    done = done_
    return buffer[index++]
  })
  return Effect.suspend((): Effect.Effect<A, E> => {
    if (index < buffer.length) {
      return Effect.succeed(buffer[index++])
    } else if (done) {
      buffer = []
      return halt
    }
    return refill
  })
}

/**
 * @since 2.0.0
 * @category constructors
 */
export const asyncPush = <A, E = never, R = never>(
  f: (emit: Emit<A, E>) => Effect.Effect<unknown, E, R | Scope.Scope>,
): Channel<A, unknown, E, unknown, Exclude<R, Scope.Scope>> =>
  makeImplScoped(
    Effect.fnUntraced(function* (_, __, scope) {
      const mailbox = yield* internalMailbox.make<A, E>()
      yield* scope.addFinalizer(() => mailbox.shutdown)
      const emit = emitFromMailbox(mailbox)
      yield* Effect.forkIn(Scope.provideScope(f(emit), scope), scope)
      return mailboxToPull(mailbox)
    }),
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const acquireUseRelease = <A, E, R, OutElem, InElem, OutErr, InErr, Env>(
  acquire: Effect.Effect<A, E, R>,
  use: (a: A) => Channel<OutElem, InElem, OutErr, InErr, Env>,
  release: (a: A, exit: Exit.Exit<void, OutErr>) => Effect.Effect<void>,
): Channel<OutElem, InElem, OutErr | E, InErr, Env | R> =>
  makeImpl(
    Effect.fnUntraced(function* (upstream, scope) {
      const value = yield* acquire
      const pull = yield* toTransform(use(value))(upstream, scope)
      return Effect.onExit(pull, (exit) => {
        if (exit._tag === "Success") return Effect.void
        const halt = haltFromCause(exit.cause)
        return halt ? release(value, Exit.void) : release(value, exit as any)
      })
    }),
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromIterator = <A>(iterator: LazyArg<Iterator<A>>): Channel<A> =>
  fromPull(
    Effect.sync(() => {
      const iter = iterator()
      return Effect.suspend(() => {
        const state = iter.next()
        if (state.done) {
          return halt
        } else {
          return Effect.succeed(state.value)
        }
      })
    }),
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromIteratorChunk = <A>(
  iterator: LazyArg<Iterator<A>>,
  chunkSize = DefaultChunkSize,
): Channel<Chunk.Chunk<A>> =>
  fromPull(
    Effect.sync(() => {
      const iter = iterator()
      let done = false
      return Effect.suspend(() => {
        if (done) return halt
        const buffer: A[] = []
        while (buffer.length < chunkSize) {
          const state = iter.next()
          if (state.done) {
            if (buffer.length === 0) {
              return halt
            }
            done = true
            break
          }
          buffer.push(state.value)
        }
        return Effect.succeed(Chunk.unsafeFromArray(buffer))
      })
    }),
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromIterable = <A>(iterable: Iterable<A>): Channel<A> =>
  fromIterator(() => iterable[Symbol.iterator]())

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromIterableChunk = <A>(
  iterable: Iterable<A>,
): Channel<Chunk.Chunk<A>> =>
  fromIteratorChunk(() => iterable[Symbol.iterator]())

/**
 * Writes a single value to the channel.
 *
 * @since 2.0.0
 * @category constructors
 */
export const succeed = <A>(value: A): Channel<A> =>
  fromPull(
    Effect.sync(() => {
      let done = false
      return Effect.suspend(() => {
        if (done) {
          return halt
        } else {
          done = true
          return Effect.succeed(value)
        }
      })
    }),
  )

/**
 * Represents an Channel that emits no elements
 *
 * @since 2.0.0
 * @category constructors
 */
export const empty: Channel<never> = fromPull(Effect.succeed(halt))

/**
 * Represents an Channel that never completes
 *
 * @since 2.0.0
 * @category constructors
 */
export const never: Channel<never> = fromPull(Effect.succeed(Effect.never))

/**
 * Use an effect to write a single value to the channel.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromEffect = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Channel<A, unknown, E, unknown, R> =>
  fromPull(
    Effect.sync(() => {
      let done = false
      return Effect.suspend(() => {
        if (done) return halt
        done = true
        return effect
      })
    }),
  )

/**
 * Create a channel from a ReadonlyMailbox
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromMailbox = <A, E>(
  mailbox: ReadonlyMailbox<A, E>,
): Channel<A, unknown, E> => fromPull(Effect.sync(() => mailboxToPull(mailbox)))

/**
 * Create a channel from a ReadonlyMailbox
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromMailboxChunk = <A, E>(
  mailbox: ReadonlyMailbox<A, E>,
): Channel<Chunk.Chunk<A>, unknown, E> =>
  fromPull(
    Effect.succeed(
      Effect.flatMap(mailbox.takeAll, ([values]) =>
        values.length === 0 ? halt : Effect.succeed(values),
      ),
    ),
  )

/**
 * Maps the output of this channel using the specified function.
 *
 * @since 2.0.0
 * @category mapping
 */
export const map: {
  <OutElem, OutElem2>(
    f: (o: OutElem) => OutElem2,
  ): <InElem, OutErr, InErr, Env>(
    self: Channel<OutElem, InElem, OutErr, InErr, Env>,
  ) => Channel<OutElem2, InElem, OutErr, InErr, Env>
  <OutElem, InElem, OutErr, InErr, Env, OutElem2>(
    self: Channel<OutElem, InElem, OutErr, InErr, Env>,
    f: (o: OutElem) => OutElem2,
  ): Channel<OutElem2, InElem, OutErr, InErr, Env>
} = dual(
  2,
  <OutElem, InElem, OutErr, InErr, Env, OutElem2>(
    self: Channel<OutElem, InElem, OutErr, InErr, Env>,
    f: (o: OutElem) => OutElem2,
  ): Channel<OutElem2, InElem, OutErr, InErr, Env> =>
    makeImpl((upstream, scope) =>
      Effect.map(toTransform(self)(upstream, scope), Effect.map(f)),
    ),
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
  <OutElem, OutElem1, InElem1, OutErr1, InErr1, Env1>(
    f: (d: OutElem) => Channel<OutElem1, InElem1, OutErr1, InErr1, Env1>,
  ): <OutElem, InElem, OutErr, InErr, Env>(
    self: Channel<OutElem, InElem, OutErr, InErr, Env>,
  ) => Channel<
    OutElem1,
    InElem & InElem1,
    OutErr1 | OutErr,
    InErr & InErr1,
    Env1 | Env
  >
  <
    OutElem,
    InElem,
    OutErr,
    InErr,
    Env,
    OutElem1,
    InElem1,
    OutErr1,
    InErr1,
    Env1,
  >(
    self: Channel<OutElem, InElem, OutErr, InErr, Env>,
    f: (d: OutElem) => Channel<OutElem1, InElem1, OutErr1, InErr1, Env1>,
  ): Channel<
    OutElem1,
    InElem & InElem1,
    OutErr | OutErr1,
    InErr & InErr1,
    Env | Env1
  >
} = dual(
  2,
  <
    OutElem,
    InElem,
    OutErr,
    InErr,
    Env,
    OutElem1,
    InElem1,
    OutErr1,
    InErr1,
    Env1,
  >(
    self: Channel<OutElem, InElem, OutErr, InErr, Env>,
    f: (d: OutElem) => Channel<OutElem1, InElem1, OutErr1, InErr1, Env1>,
  ): Channel<
    OutElem1,
    InElem & InElem1,
    OutErr | OutErr1,
    InErr & InErr1,
    Env | Env1
  > =>
    makeImpl(
      Effect.fnUntraced(function* (upstream, scope) {
        const pull = yield* toTransform(self)(upstream, scope)
        let childPull: Effect.Effect<OutElem1, OutErr1, Env1> | null = null
        const makePull: Effect.Effect<OutElem1, OutErr | OutErr1, Env1> =
          pull.pipe(
            Effect.flatMap((value) => toTransform(f(value))(upstream, scope)),
            Effect.flatMap((pull) => {
              childPull = catchHalt(pull, (_) => {
                childPull = null
                return makePull
              }) as any
              return childPull!
            }),
          )
        return Effect.suspend(() => childPull ?? makePull)
      }),
    ),
)

export const mapEffectSequential = <
  OutElem,
  InElem,
  OutErr,
  InErr,
  Env,
  OutElem2,
  EX,
  RX,
>(
  self: Channel<OutElem, InElem, OutErr, InErr, Env>,
  f: (o: OutElem) => Effect.Effect<OutElem2, EX, RX>,
): Channel<OutElem2, InElem, OutErr | EX, InErr, Env | RX> =>
  makeImpl((upstream, scope) =>
    Effect.map(toTransform(self)(upstream, scope), Effect.flatMap(f)),
  )

/**
 * @since 2.0.0
 * @category utils
 */
export const mergeAll: {
  (options: {
    readonly concurrency: number | "unbounded"
    readonly bufferSize?: number | undefined
  }): <OutElem, InElem1, OutErr1, InErr1, Env1, InElem, OutErr, InErr, Env>(
    channels: Channel<
      Channel<OutElem, InElem1, OutErr1, InErr1, Env1>,
      InElem,
      OutErr,
      InErr,
      Env
    >,
  ) => Channel<
    OutElem,
    InElem & InElem1,
    OutErr1 | OutErr,
    InErr & InErr1,
    Env1 | Env
  >
  <OutElem, InElem1, OutErr1, InErr1, Env1, InElem, OutErr, InErr, Env>(
    channels: Channel<
      Channel<OutElem, InElem1, OutErr1, InErr1, Env1>,
      InElem,
      OutErr,
      InErr,
      Env
    >,
    options: {
      readonly concurrency: number | "unbounded"
      readonly bufferSize?: number | undefined
    },
  ): Channel<
    OutElem,
    InElem & InElem1,
    OutErr1 | OutErr,
    InErr & InErr1,
    Env1 | Env
  >
} = dual(
  2,
  <OutElem, InElem1, OutErr1, InErr1, Env1, InElem, OutErr, InErr, Env>(
    channels: Channel<
      Channel<OutElem, InElem1, OutErr1, InErr1, Env1>,
      InElem,
      OutErr,
      InErr,
      Env
    >,
    {
      concurrency,
      bufferSize = 16,
    }: {
      readonly concurrency: number | "unbounded"
      readonly bufferSize?: number | undefined
    },
  ): Channel<
    OutElem,
    InElem & InElem1,
    OutErr1 | OutErr,
    InErr & InErr1,
    Env1 | Env
  > =>
    makeImplScoped(
      Effect.fnUntraced(function* (upstream, parentScope, scope) {
        const concurrencyN =
          concurrency === "unbounded"
            ? Number.MAX_SAFE_INTEGER
            : Math.max(1, concurrency)
        const semaphore = Effect.unsafeMakeSemaphore(concurrencyN)

        const mailbox = yield* internalMailbox.make<OutElem, OutErr | OutErr1>(
          bufferSize,
        )
        yield* scope.addFinalizer(() => mailbox.shutdown)

        const pull = yield* toTransform(channels)(upstream, parentScope)

        yield* Effect.gen(function* () {
          while (true) {
            yield* semaphore.take(1)
            const channel = yield* pull
            const childPull = yield* toTransform(channel)(upstream, parentScope)
            yield* Effect.whileLoop({
              while: constTrue,
              body: constant(
                Effect.flatMap(childPull, (value) => mailbox.offer(value)),
              ),
              step: constVoid,
            }).pipe(
              Effect.onExit(
                (exit): Effect.Effect<void> =>
                  exit._tag === "Failure" && !isHaltCause(exit.cause)
                    ? Effect.andThen(
                        semaphore.release(1),
                        mailbox.failCause(exit.cause as Cause.Cause<OutErr1>),
                      )
                    : semaphore.release(1),
              ),
              Effect.forkIn(scope),
            )
          }
        }).pipe(
          Effect.onError((cause) =>
            // n-1 because of the failure
            semaphore.withPermits(concurrencyN - 1)(mailbox.failCause(cause)),
          ),
          Effect.forkIn(scope),
        )

        return mailboxToPull(mailbox)
      }),
    ),
)

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
  <OutElem2, OutElem, OutErr2, OutErr, Env2>(
    that: Channel<OutElem2, OutElem, OutErr2, OutErr, Env2>,
  ): <InElem, InErr, Env>(
    self: Channel<OutElem, InElem, OutErr, InErr, Env>,
  ) => Channel<OutElem2, InElem, OutErr2, InErr, Env2 | Env>
  <OutElem, InElem, OutErr, InErr, Env, OutElem2, OutErr2, Env2>(
    self: Channel<OutElem, InElem, OutErr, InErr, Env>,
    that: Channel<OutElem2, OutElem, OutErr2, OutErr, Env2>,
  ): Channel<OutElem2, InElem, OutErr2, InErr, Env | Env2>
} = dual(
  2,
  <OutElem, InElem, OutErr, InErr, Env, OutElem2, OutErr2, Env2>(
    self: Channel<OutElem, InElem, OutErr, InErr, Env>,
    that: Channel<OutElem2, OutElem, OutErr2, OutErr, Env2>,
  ): Channel<OutElem2, InElem, OutErr2, InErr, Env | Env2> =>
    makeImpl((upstream, scope) =>
      Effect.flatMap(toTransform(self)(upstream, scope), (upstream) =>
        toTransform(that)(upstream, scope),
      ),
    ),
)

/**
 * Returns a new channel which embeds the given input handler into a Channel.
 *
 * @since 2.0.0
 * @category utils
 */
export const embedInput: {
  <InErr, InElem, R>(
    input: (
      upstream: Effect.Effect<InElem, InErr>,
    ) => Effect.Effect<void, never, R>,
  ): <OutElem, OutErr, Env>(
    self: Channel<OutElem, unknown, OutErr, unknown, Env>,
  ) => Channel<OutElem, InElem, OutErr, InErr, Env | R>
  <OutElem, OutErr, Env, InErr, InElem, R>(
    self: Channel<OutElem, unknown, OutErr, unknown, Env>,
    input: (
      upstream: Effect.Effect<InElem, InErr>,
    ) => Effect.Effect<void, never, R>,
  ): Channel<OutElem, InElem, OutErr, InErr, Env | R>
} = dual(
  2,
  <OutElem, OutErr, Env, InErr, InElem, R>(
    self: Channel<OutElem, unknown, OutErr, unknown, Env>,
    input: (
      upstream: Effect.Effect<InElem, InErr>,
    ) => Effect.Effect<void, never, R>,
  ): Channel<OutElem, InElem, OutErr, InErr, Env | R> =>
    makeImplScoped(
      Effect.fnUntraced(function* (upstream, scope, forkedScope) {
        yield* Effect.forkIn(input(upstream), forkedScope)
        return yield* toTransform(self)(halt, scope)
      }),
    ),
)

const runWith = <
  OutElem,
  InElem,
  OutErr,
  InErr,
  Env,
  EX,
  RX,
  AH = void,
  EH = never,
  RH = never,
>(
  self: Channel<OutElem, InElem, OutErr, InErr, Env>,
  f: (pull: Effect.Effect<OutElem, OutErr>) => Effect.Effect<void, EX, RX>,
  onHalt?: Effect.Effect<AH, EH, RH>,
): Effect.Effect<AH, EX | EH, Env | RX | RH> =>
  Effect.suspend(() => {
    const scope = Scope.unsafeMake()
    const makePull = toTransform(self)(halt, scope)
    return catchHalt(Effect.flatMap(makePull, f), (_) =>
      onHalt ? onHalt : (Effect.void as any),
    ).pipe(Effect.onExit((exit) => scope.close(exit))) as any
  })

/**
 * @since 2.0.0
 * @category execution
 */
export const runDrain = <OutElem, InElem, OutErr, InErr, Env>(
  self: Channel<OutElem, InElem, OutErr, InErr, Env>,
): Effect.Effect<void, OutErr, Env> =>
  runWith(self, (pull) =>
    Effect.whileLoop({
      while: constTrue,
      body: () => pull,
      step: constVoid,
    }),
  )

/**
 * @since 2.0.0
 * @category execution
 */
export const runForEach: {
  <OutElem, EX, RX>(
    f: (o: OutElem) => Effect.Effect<void, EX, RX>,
  ): <InElem, OutErr, InErr, Env>(
    self: Channel<OutElem, InElem, OutErr, InErr, Env>,
  ) => Effect.Effect<void, OutErr | EX, Env | RX>
  <OutElem, InElem, OutErr, InErr, Env, EX, RX>(
    self: Channel<OutElem, InElem, OutErr, InErr, Env>,
    f: (o: OutElem) => Effect.Effect<void, EX, RX>,
  ): Effect.Effect<void, OutErr | EX, Env | RX>
} = dual(
  2,
  <OutElem, InElem, OutErr, InErr, Env, EX, RX>(
    self: Channel<OutElem, InElem, OutErr, InErr, Env>,
    f: (o: OutElem) => Effect.Effect<void, EX, RX>,
  ): Effect.Effect<void, OutErr | EX, Env | RX> =>
    runWith(self, (pull) => {
      const pump = Effect.flatMap(pull, f)
      return Effect.whileLoop({
        while: constTrue,
        body: () => pump,
        step: constVoid,
      })
    }),
)

/**
 * @since 2.0.0
 * @category execution
 */
export const runCollect = <OutElem, InElem, OutErr, InErr, Env>(
  self: Channel<OutElem, InElem, OutErr, InErr, Env>,
): Effect.Effect<Array<OutElem>, OutErr, Env> =>
  Effect.suspend(() => {
    const result: Array<OutElem> = []
    return runWith(
      self,
      (pull) =>
        Effect.whileLoop({
          while: constTrue,
          body: () => pull,
          step: (value) => {
            result.push(value)
          },
        }),
      Effect.succeed(result),
    )
  })

/**
 * @since 2.0.0
 * @category constructors
 */
export const toPull: <OutElem, InElem, OutErr, InErr, Env>(
  self: Channel<OutElem, InElem, OutErr, InErr, Env>,
) => Effect.Effect<
  Effect.Effect<OutElem, Option.Option<OutErr>>,
  never,
  Env | Scope.Scope
> = Effect.fnUntraced(
  function* (self) {
    const context = yield* Effect.context<Scope.Scope>()
    const scope = Context.get(context, Scope.Scope)
    const pull = yield* toTransform(self)(halt, scope)
    return pull.pipe(
      Effect.provideContext(context),
      Effect.mapError(Option.some),
      Effect.catchFailure(isHaltFailure, (_) => Effect.fail(Option.none())),
    )
  },
  // ensure errors are redirected to the pull effect
  Effect.catchCause((cause) => Effect.succeed(Effect.failCause(cause))),
)
