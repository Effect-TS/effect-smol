/**
 * @since 2.0.0
 */
import type { NonEmptyArray } from "./Array.js"
import * as Duration from "./Duration.js"
import type { Effect } from "./Effect.js"
import { constTrue, dual, identity } from "./Function.js"
import * as core from "./internal/core.js"
import { type Pipeable, pipeArguments } from "./Pipeable.js"
import { hasProperty } from "./Predicate.js"
import * as Request from "./Request.js"
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
export interface RequestResolver<in A> extends RequestResolver.Variance<A>, Pipeable {
  readonly delay: Effect<void>

  /**
   * Should the resolver continue collecting requests? Otherwise, it will
   * immediately execute the collected requests cutting the delay short.
   */
  collectWhile(requests: NonEmptyArray<A>): boolean

  /**
   * Execute a collection of requests.
   */
  runAll(requests: NonEmptyArray<A>): Effect<void>
}

/**
 * @since 2.0.0
 */
export declare namespace RequestResolver {
  /**
   * @since 2.0.0
   * @category models
   */
  export interface Variance<in A> {
    readonly [RequestResolverTypeId]: {
      readonly _A: Types.Contravariant<A>
    }
  }
}

const RequestResolverProto = {
  [RequestResolverTypeId]: {
    _A: identity,
    _R: identity
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
}

/**
 * Returns `true` if the specified value is a `RequestResolver`, `false` otherwise.
 *
 * @since 2.0.0
 * @category guards
 */
export const isRequestResolver = (u: unknown): u is RequestResolver<unknown> => hasProperty(u, RequestResolverTypeId)

const makeProto = <A>(options: {
  readonly delay: Effect<void>
  readonly collectWhile: (requests: NonEmptyArray<A>) => boolean
  readonly runAll: (requests: NonEmptyArray<A>) => Effect<void>
}): RequestResolver<A> => {
  const self = Object.create(RequestResolverProto)
  self.delay = options.delay
  self.collectWhile = options.collectWhile
  self.runAll = options.runAll
  return self
}

/**
 * Constructs a data source with the specified identifier and method to run
 * requests.
 *
 * @since 2.0.0
 * @category constructors
 */
export const make = <A>(
  runAll: (requests: NonEmptyArray<A>) => Effect<void>
): RequestResolver<A> => makeProto({ delay: core.yieldNow, collectWhile: constTrue, runAll })

/**
 * Constructs a data source from a pure function.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromFunction = <A extends Request.Request<any>>(
  f: (request: A) => Request.Request.Success<A>
): RequestResolver<A> =>
  make(
    (requests) =>
      core.forEach(
        requests,
        (request) => Request.complete(request, core.exitSucceed(f(request)) as any),
        { discard: true }
      )
  )

/**
 * Constructs a data source from a pure function that takes a list of requests
 * and returns a list of results of the same size. Each item in the result
 * list must correspond to the item at the same index in the request list.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromFunctionBatched = <A extends Request.Request<any>>(
  f: (requests: NonEmptyArray<A>) => Iterable<Request.Request.Success<A>>
): RequestResolver<A> =>
  make(
    (requests) =>
      core.forEach(f(requests), (result, i) => Request.complete(requests[i], core.exitSucceed(result) as any), {
        discard: true
      })
  )

/**
 * Constructs a data source from an effectual function.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromEffect = <A extends Request.Request<any>>(
  f: (a: A) => Effect<Request.Request.Success<A>, Request.Request.Error<A>>
): RequestResolver<A> =>
  make(
    (requests) => core.forEach(requests, (request) => Request.completeEffect(request, f(request)), { discard: true })
  )

/**
 * Constructs a data source from a list of tags paired to functions, that takes
 * a list of requests and returns a list of results of the same size. Each item
 * in the result list must correspond to the item at the same index in the
 * request list.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromEffectTagged = <A extends Request.Request<any, any, any> & { readonly _tag: string }>() =>
<
  Fns extends {
    readonly [Tag in A["_tag"]]: [Extract<A, { readonly _tag: Tag }>] extends [infer Req]
      ? Req extends Request.Request<infer ReqA, infer ReqE, infer _ReqR> ?
        (requests: Array<Req>) => Effect<Iterable<ReqA>, ReqE>
      : never
      : never
  }
>(
  fns: Fns
): RequestResolver<A> =>
  make(
    (requests: NonEmptyArray<A>): Effect<void> => {
      const grouped: Record<string, Array<A>> = {}
      const tags: Array<A["_tag"]> = []
      for (let i = 0, len = requests.length; i < len; i++) {
        if (tags.includes(requests[i]._tag)) {
          grouped[requests[i]._tag].push(requests[i])
        } else {
          grouped[requests[i]._tag] = [requests[i]]
          tags.push(requests[i]._tag)
        }
      }
      return core.forEach(
        tags,
        (tag) =>
          core.matchCauseEffect((fns[tag] as any)(grouped[tag]) as Effect<Array<any>, unknown, unknown>, {
            onFailure: (cause) =>
              core.forEach(grouped[tag], (req) => Request.complete(req, core.exitFail(cause) as any), {
                discard: true
              }),
            onSuccess: (res) =>
              core.forEach(grouped[tag], (req, i) => Request.complete(req, core.exitSucceed(res[i]) as any), {
                discard: true
              })
          }),
        { concurrency: "unbounded", discard: true }
      ) as Effect<void>
    }
  ) as any

/**
 * Sets the batch delay effect for this data source.
 *
 * @since 4.0.0
 * @category delay
 */
export const setDelayEffect: {
  (delay: Effect<void>): <A>(self: RequestResolver<A>) => RequestResolver<A>
  <A>(self: RequestResolver<A>, delay: Effect<void>): RequestResolver<A>
} = dual(2, <A>(self: RequestResolver<A>, delay: Effect<void>): RequestResolver<A> =>
  makeProto({
    ...self,
    delay
  }))

/**
 * Sets the batch delay window for this data source to the specified duration.
 *
 * @since 4.0.0
 * @category delay
 */
export const setDelay: {
  (duration: Duration.DurationInput): <A>(self: RequestResolver<A>) => RequestResolver<A>
  <A>(self: RequestResolver<A>, duration: Duration.DurationInput): RequestResolver<A>
} = dual(2, <A>(self: RequestResolver<A>, duration: Duration.DurationInput): RequestResolver<A> =>
  makeProto({
    ...self,
    delay: core.sleep(Duration.toMillis(duration))
  }))

/**
 * A data source aspect that executes requests between two effects, `before`
 * and `after`, where the result of `before` can be used by `after`.
 *
 * @since 2.0.0
 * @category combinators
 */
export const around: {
  <A, A2, X>(
    before: (requests: NonEmptyArray<NoInfer<A>>) => Effect<A2>,
    after: (requests: NonEmptyArray<NoInfer<A>>, a: A2) => Effect<X>
  ): (self: RequestResolver<A>) => RequestResolver<A>
  <A, A2, X>(
    self: RequestResolver<A>,
    before: (requests: NonEmptyArray<NoInfer<A>>) => Effect<A2>,
    after: (requests: NonEmptyArray<NoInfer<A>>, a: A2) => Effect<X>
  ): RequestResolver<A>
} = dual(3, <A, A2, X>(
  self: RequestResolver<A>,
  before: (requests: NonEmptyArray<NoInfer<A>>) => Effect<A2>,
  after: (requests: NonEmptyArray<NoInfer<A>>, a: A2) => Effect<X>
): RequestResolver<A> =>
  makeProto({
    ...self,
    runAll: (requests) =>
      core.acquireUseRelease(
        before(requests),
        () => self.runAll(requests),
        (a) => after(requests, a)
      )
  }))

/**
 * A data source that never executes requests.
 *
 * @since 2.0.0
 * @category constructors
 */
export const never: RequestResolver<never> = make(() => core.never)

/**
 * Returns a data source that executes at most `n` requests in parallel.
 *
 * @since 2.0.0
 * @category combinators
 */
export const batchN: {
  (n: number): <A>(self: RequestResolver<A>) => RequestResolver<A>
  <A>(self: RequestResolver<A>, n: number): RequestResolver<A>
} = dual(2, <A>(self: RequestResolver<A>, n: number): RequestResolver<A> =>
  makeProto({
    ...self,
    collectWhile: (requests) => requests.length < n
  }))

/**
 * Returns a new data source that executes requests by sending them to this
 * data source and that data source, returning the results from the first data
 * source to complete and safely interrupting the loser.
 *
 * The batch delay is determined by the first data source.
 *
 * @since 2.0.0
 * @category combinators
 */
export const race: {
  <A2 extends Request.Request<any, any, any>>(
    that: RequestResolver<A2>
  ): <A extends Request.Request<any, any, any>>(self: RequestResolver<A>) => RequestResolver<A2 | A>
  <A extends Request.Request<any, any, any>, A2 extends Request.Request<any, any, any>>(
    self: RequestResolver<A>,
    that: RequestResolver<A2>
  ): RequestResolver<A & A2>
} = dual(2, <A extends Request.Request<any, any, any>, A2 extends Request.Request<any, any, any>>(
  self: RequestResolver<A>,
  that: RequestResolver<A2>
): RequestResolver<A & A2> =>
  make(
    (requests) => core.race(self.runAll(requests), that.runAll(requests))
  ))
