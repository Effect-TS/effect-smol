/**
 * @since 2.0.0
 */
import type { NonEmptyArray } from "./Array.js"
import * as Context from "./Context.js"
import * as Duration from "./Duration.js"
import type { Effect } from "./Effect.js"
import * as Equal from "./Equal.js"
import { constTrue, dual, identity } from "./Function.js"
import * as Hash from "./Hash.js"
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
export interface RequestResolver<in A, out R = never> extends RequestResolver.Variance<A, R>, Equal.Equal, Pipeable {
  readonly delay: Effect<void>
  readonly ids: ReadonlyArray<unknown>

  /**
   * Should the resolver continue collecting requests? Otherwise, it will
   * immediately execute the collected requests cutting the delay short.
   */
  continue(requests: NonEmptyArray<A>): boolean

  /**
   * Execute a collection of requests.
   */
  runAll(requests: NonEmptyArray<A>): Effect<void, never, R>
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
export const isRequestResolver = (u: unknown): u is RequestResolver<unknown, unknown> =>
  hasProperty(u, RequestResolverTypeId)

const makeProto = <A, R>(options: {
  readonly delay: Effect<void>
  readonly continue: (requests: NonEmptyArray<A>) => boolean
  readonly runAll: (requests: NonEmptyArray<A>) => Effect<void, never, R>
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
  runAll: (requests: NonEmptyArray<A>) => Effect<void, never, R>,
  ids: ReadonlyArray<unknown> = []
): RequestResolver<A, R> => makeProto({ delay: core.yieldNow, continue: constTrue, runAll, ids })

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
      ),
    ["FromFunction", f]
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
      }),
    ["FromFunctionBatched", f]
  )

/**
 * Constructs a data source from an effectual function.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromEffect = <R, A extends Request.Request<any, any>>(
  f: (a: A) => Effect<Request.Request.Success<A>, Request.Request.Error<A>, R>
): RequestResolver<A, R> =>
  make(
    (requests) => core.forEach(requests, (request) => Request.completeEffect(request, f(request)), { discard: true }),
    ["FromEffect", f]
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
export const fromEffectTagged = <A extends Request.Request<any, any> & { readonly _tag: string }>() =>
<
  Fns extends {
    readonly [Tag in A["_tag"]]: [Extract<A, { readonly _tag: Tag }>] extends [infer Req]
      ? Req extends Request.Request<infer ReqA, infer ReqE>
        ? (requests: Array<Req>) => Effect<Iterable<ReqA>, ReqE, any>
      : never
      : never
  }
>(
  fns: Fns
): RequestResolver<A, ReturnType<Fns[keyof Fns]> extends Effect<infer _A, infer _E, infer R> ? R : never> =>
  make(
    (requests: NonEmptyArray<A>) => {
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
      )
    },
    ["FromEffectTagged", fns]
  ) as any

/**
 * Sets the batch delay effect for this data source.
 *
 * @since 4.0.0
 * @category delay
 */
export const setDelayEffect: {
  (delay: Effect<void>): <A, R>(self: RequestResolver<A, R>) => RequestResolver<A, R>
  <A, R>(self: RequestResolver<A, R>, delay: Effect<void>): RequestResolver<A, R>
} = dual(2, <A, R>(self: RequestResolver<A, R>, delay: Effect<void>): RequestResolver<A, R> =>
  makeProto({
    ...self,
    delay,
    ids: ["SetDelayEffect", self, delay]
  }))

/**
 * Sets the batch delay window for this data source to the specified duration.
 *
 * @since 4.0.0
 * @category delay
 */
export const setDelay: {
  (duration: Duration.DurationInput): <A, R>(self: RequestResolver<A, R>) => RequestResolver<A, R>
  <A, R>(self: RequestResolver<A, R>, duration: Duration.DurationInput): RequestResolver<A, R>
} = dual(2, <A, R>(self: RequestResolver<A, R>, duration: Duration.DurationInput): RequestResolver<A, R> =>
  makeProto({
    ...self,
    delay: core.sleep(Duration.toMillis(duration)),
    ids: ["SetDelay", self, duration]
  }))

/**
 * A data source aspect that executes requests between two effects, `before`
 * and `after`, where the result of `before` can be used by `after`.
 *
 * @since 2.0.0
 * @category combinators
 */
export const around: {
  <A, A2, R2, X, R3>(
    before: (requests: NonEmptyArray<NoInfer<A>>) => Effect<A2, never, R2>,
    after: (requests: NonEmptyArray<NoInfer<A>>, a: A2) => Effect<X, never, R3>
  ): <R>(self: RequestResolver<A, R>) => RequestResolver<A, R2 | R3 | R>
  <A, R, A2, R2, X, R3>(
    self: RequestResolver<A, R>,
    before: (requests: NonEmptyArray<NoInfer<A>>) => Effect<A2, never, R2>,
    after: (requests: NonEmptyArray<NoInfer<A>>, a: A2) => Effect<X, never, R3>
  ): RequestResolver<A, R | R2 | R3>
} = dual(3, <A, R, A2, R2, X, R3>(
  self: RequestResolver<A, R>,
  before: (requests: NonEmptyArray<NoInfer<A>>) => Effect<A2, never, R2>,
  after: (requests: NonEmptyArray<NoInfer<A>>, a: A2) => Effect<X, never, R3>
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
 * A data source that never executes requests.
 *
 * @since 2.0.0
 * @category constructors
 */
export const never: RequestResolver<never> = make(() => core.never, ["Never"])

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
    continue: (requests) => requests.length < n,
    ids: ["BatchN", self, n]
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
  <A2 extends Request.Request<any, any>, R2>(
    that: RequestResolver<A2, R2>
  ): <A extends Request.Request<any, any>, R>(self: RequestResolver<A, R>) => RequestResolver<A2 | A, R2 | R>
  <A extends Request.Request<any, any>, R, A2 extends Request.Request<any, any>, R2>(
    self: RequestResolver<A, R>,
    that: RequestResolver<A2, R2>
  ): RequestResolver<A & A2, R | R2>
} = dual(2, <A extends Request.Request<any, any>, R, A2 extends Request.Request<any, any>, R2>(
  self: RequestResolver<A, R>,
  that: RequestResolver<A2, R2>
): RequestResolver<A & A2, R | R2> =>
  make(
    (requests) => core.race(self.runAll(requests), that.runAll(requests)),
    ["Race", self, that]
  ))

/**
 * Provides this data source with part of its required context.
 *
 * @since 4.0.0
 * @category context
 */
export const updateContext = dual<
  <R0, R>(
    f: (context: Context.Context<R0>) => Context.Context<R>
  ) => <A extends Request.Request<any, any>>(
    self: RequestResolver<A, R>
  ) => RequestResolver<A, R0>,
  <R, A extends Request.Request<any, any>, R0>(
    self: RequestResolver<A, R>,
    f: (context: Context.Context<R0>) => Context.Context<R>
  ) => RequestResolver<A, R0>
>(2, <R, A extends Request.Request<any, any>, R0>(
  self: RequestResolver<A, R>,
  f: (context: Context.Context<R0>) => Context.Context<R>
) =>
  makeProto({
    ...self,
    runAll: (requests) =>
      core.updateContext(
        self.runAll(requests),
        (context: Context.Context<R0>) => f(context)
      ),
    ids: ["UpdateContext", self, f]
  }))

/**
 * Provides this data source with its required context.
 *
 * @since 2.0.0
 * @category context
 */
export const provideContext: {
  <R>(
    context: Context.Context<R>
  ): <A extends Request.Request<any, any>>(self: RequestResolver<A, R>) => RequestResolver<A>
  <R, A extends Request.Request<any, any>>(
    self: RequestResolver<A, R>,
    context: Context.Context<R>
  ): RequestResolver<A>
} = dual(2, <R, A extends Request.Request<any, any>>(
  self: RequestResolver<A, R>,
  context: Context.Context<R>
): RequestResolver<A> =>
  makeProto({
    ...self,
    runAll: (requests) => core.provideContext(self.runAll(requests), context),
    ids: ["ProvideContext", self, context]
  }))

/**
 * @since 2.0.0
 * @category context
 */
export const contextFromEffect = <R, A extends Request.Request<any, any>>(self: RequestResolver<A, R>) =>
  core.map(core.context<R>(), (context) => provideContext(self, context))

/**
 * @since 2.0.0
 * @category utils
 */
export const contextFromServices =
  <Services extends ReadonlyArray<Context.Tag<any, any>>>(...services: Services) =>
  <R, A extends Request.Request<any, any>>(
    self: RequestResolver<A, R>
  ): Effect<
    RequestResolver<A, Exclude<R, Context.Tag.Identifier<Services[number]>>>,
    never,
    Context.Tag.Identifier<Services[number]>
  > => core.map(core.context(), (_) => provideContext(self as any, Context.pick(...services)(_ as any)))
