/**
 * @since 2.0.0
 */
import type { NonEmptyArray } from "./Array.js"
import type * as Effect from "./Effect.js"
import * as Equal from "./Equal.js"
import { constTrue, dual, identity } from "./Function.js"
import * as Hash from "./Hash.js"
import * as core from "./internal/core.js"
import type { Pipeable } from "./Pipeable.js"
import type * as Types from "./Types.js"

/**
 * @since 2.0.0
 * @category symbols
 */
export const RequestResolverTypeId: unique symbol = Symbol.for("effect/RequestResolver")

/**
 * @since 2.0.0
 * @category symbols
 */
export type RequestResolverTypeId = typeof RequestResolverTypeId

/**
 * The `RequestResolver<A, R>` interface requires an environment `R` and handles
 * the execution of requests of type `A`.
 *
 * Implementations must provide a `runAll` method, which processes a collection
 * of requests and produces an effect that fulfills these requests. Requests are
 * organized into a `Array<Array<A>>`, where the outer `Array` groups requests
 * into batches that are executed sequentially, and each inner `Array` contains
 * requests that can be executed in parallel. This structure allows
 * implementations to analyze all incoming requests collectively and optimize
 * query execution accordingly.
 *
 * Implementations are typically specialized for a subtype of `Request<A, E>`.
 * However, they are not strictly limited to these subtypes as long as they can
 * map any given request type to `Request<A, E>`. Implementations should inspect
 * the collection of requests to identify the needed information and execute the
 * corresponding queries. It is imperative that implementations resolve all the
 * requests they receive. Failing to do so will lead to a `QueryFailure` error
 * during query execution.
 *
 * @since 2.0.0
 * @category models
 */
export interface RequestResolver<in A, out R = never> extends RequestResolver.Variance<A, R>, Equal.Equal, Pipeable {
  readonly delay: Effect.Effect<void>
  readonly ids: ReadonlyArray<unknown>

  /**
   * Should the resolver continue collecting requests? Otherwise, it will
   * immediately execute the collected requests cutting the delay short.
   */
  continue(requests: NonEmptyArray<A>): boolean

  /**
   * Execute a collection of requests.
   */
  runAll(requests: NonEmptyArray<A>): Effect.Effect<void, never, R>
}

/**
 * @since 2.0.0
 */
export declare namespace RequestResolver {
  /**
   * @since 2.0.0
   * @category models
   */
  export interface Variance<in A, out R> {
    readonly [RequestResolverTypeId]: {
      readonly _A: Types.Contravariant<A>
      readonly _R: Types.Covariant<R>
    }
  }
}

const RequestResolverProto = {
  [RequestResolverTypeId]: {
    _A: identity,
    _R: identity
  },
  [Hash.symbol](this: RequestResolver<any, any>) {
    return Hash.cached(this, this.ids.length === 0 ? Hash.random(this) : Hash.array(this.ids))
  },
  [Equal.symbol](this: RequestResolver<any, any>, that: RequestResolver<any, any>) {
    return this === that || (this.ids.length > 0
      ? this.ids.length === that.ids.length && this.ids.every((id, i) => Equal.equals(id, that.ids[i]))
      : false)
  }
}

const makeProto = <A, R>(options: {
  readonly delay: Effect.Effect<void>
  readonly continue: (requests: NonEmptyArray<A>) => boolean
  readonly runAll: (requests: NonEmptyArray<A>) => Effect.Effect<void, never, R>
  readonly ids: ReadonlyArray<unknown>
}): RequestResolver<A, R> => {
  const self = Object.create(RequestResolverProto)
  self.delay = options.delay
  self.continue = options.continue
  self.runAll = options.runAll
  self.ids = options.ids
  return self
}

/**
 * Constructs a data source with the specified identifier and method to run
 * requests.
 *
 * @since 2.0.0
 * @category constructors
 */
export const make = <A, R>(
  runAll: (requests: NonEmptyArray<A>) => Effect.Effect<void, never, R>,
  ids: ReadonlyArray<unknown> = []
): RequestResolver<A, R> => makeProto({ delay: core.yieldNow, continue: constTrue, runAll, ids })

/**
 * A data source aspect that executes requests between two effects, `before`
 * and `after`, where the result of `before` can be used by `after`.
 *
 * @since 2.0.0
 * @category combinators
 */
export const around: {
  <A, A2, R2, X, R3>(
    before: (requests: NonEmptyArray<NoInfer<A>>) => Effect.Effect<A2, never, R2>,
    after: (requests: NonEmptyArray<NoInfer<A>>, a: A2) => Effect.Effect<X, never, R3>
  ): <R>(self: RequestResolver<A, R>) => RequestResolver<A, R2 | R3 | R>
  <A, R, A2, R2, X, R3>(
    self: RequestResolver<A, R>,
    before: (requests: NonEmptyArray<NoInfer<A>>) => Effect.Effect<A2, never, R2>,
    after: (requests: NonEmptyArray<NoInfer<A>>, a: A2) => Effect.Effect<X, never, R3>
  ): RequestResolver<A, R | R2 | R3>
} = dual(3, <A, R, A2, R2, X, R3>(
  self: RequestResolver<A, R>,
  before: (requests: NonEmptyArray<NoInfer<A>>) => Effect.Effect<A2, never, R2>,
  after: (requests: NonEmptyArray<NoInfer<A>>, a: A2) => Effect.Effect<X, never, R3>
): RequestResolver<A, R | R2 | R3> =>
  makeProto({
    ...self,
    runAll: (requests) =>
      core.acquireUseRelease(
        before(requests),
        () => self.runAll(requests),
        (a) => after(requests, a)
      ),
    ids: ["Around", self, before, after]
  }))

/**
 * Returns a data source that executes at most `n` requests in parallel.
 *
 * @since 2.0.0
 * @category combinators
 */
export const batchN: {
  (n: number): <A, R>(self: RequestResolver<A, R>) => RequestResolver<A, R>
  <A, R>(self: RequestResolver<A, R>, n: number): RequestResolver<A, R>
} = dual(2, <A, R>(self: RequestResolver<A, R>, n: number): RequestResolver<A, R> =>
  makeProto({
    ...self,
    continue: (requests) => requests.length <= n
  }))
