/**
 * @since 2.0.0
 */
import type { NonEmptyArray } from "./Array.js"
import * as Context from "./Context.js"
import * as Duration from "./Duration.js"
import type { Effect } from "./Effect.js"
import { constTrue, dual, identity } from "./Function.js"
import { exitFail, exitSucceed } from "./internal/core.js"
import * as effect from "./internal/effect.js"
import { type Pipeable, pipeArguments } from "./Pipeable.js"
import { hasProperty } from "./Predicate.js"
import * as Request from "./Request.js"
import * as Tracer from "./Tracer.js"
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
  collectWhile(entries: NonEmptyArray<Request.Entry<A>>): boolean

  /**
   * Execute a collection of requests.
   */
  runAll(entries: NonEmptyArray<Request.Entry<A>>): Effect<void>
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
  readonly collectWhile: (requests: NonEmptyArray<Request.Entry<A>>) => boolean
  readonly runAll: (entries: NonEmptyArray<Request.Entry<A>>) => Effect<void>
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
  runAll: (entries: NonEmptyArray<Request.Entry<A>>) => Effect<void>
): RequestResolver<A> => makeProto({ delay: effect.yieldNow, collectWhile: constTrue, runAll })

/**
 * Constructs a data source from a pure function.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromFunction = <A extends Request.Request<any>>(
  f: (entry: Request.Entry<A>) => Request.Request.Success<A>
): RequestResolver<A> =>
  make(
    (entries) =>
      effect.sync(() => {
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i]
          entry.unsafeComplete(exitSucceed(f(entry)))
        }
      })
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
  f: (entries: NonEmptyArray<Request.Entry<A>>) => Iterable<Request.Request.Success<A>>
): RequestResolver<A> =>
  make(
    (entries) =>
      effect.sync(() => {
        let i = 0
        for (const result of f(entries)) {
          const entry = entries[i++]
          entry.unsafeComplete(exitSucceed(result))
        }
      })
  )

/**
 * Constructs a data source from an effectual function.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromEffect = <A extends Request.Request<any>>(
  f: (entry: Request.Entry<A>) => Effect<Request.Request.Success<A>, Request.Request.Error<A>>
): RequestResolver<A> =>
  make(
    (entries) =>
      effect.forEach(entries, (entry) => Request.completeEffect(entry, f(entry)), {
        discard: true
      })
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
        (requests: Array<Request.Entry<Req>>) => Effect<Iterable<ReqA>, ReqE>
      : never
      : never
  }
>(
  fns: Fns
): RequestResolver<A> =>
  make<A>(
    (entries): Effect<void> => {
      const grouped: Record<string, Array<Request.Entry<A>>> = {}
      const tags: Array<A["_tag"]> = []
      for (let i = 0, len = entries.length; i < len; i++) {
        if (tags.includes(entries[i].request._tag)) {
          grouped[entries[i].request._tag].push(entries[i])
        } else {
          grouped[entries[i].request._tag] = [entries[i]]
          tags.push(entries[i].request._tag)
        }
      }
      return effect.forEach(
        tags,
        (tag) =>
          effect.matchCause((fns[tag] as any)(grouped[tag]) as Effect<Array<any>, unknown, unknown>, {
            onFailure: (cause) => {
              for (let i = 0; i < grouped[tag].length; i++) {
                const entry = grouped[tag][i]
                entry.unsafeComplete(exitFail(cause) as any)
              }
            },
            onSuccess: (res) => {
              for (let i = 0; i < res.length; i++) {
                const entry = grouped[tag][i]
                entry.unsafeComplete(exitSucceed(res[i]) as any)
              }
            }
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
    delay: effect.sleep(Duration.toMillis(duration))
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
    before: (entries: NonEmptyArray<Request.Entry<NoInfer<A>>>) => Effect<A2>,
    after: (entries: NonEmptyArray<Request.Entry<NoInfer<A>>>, a: A2) => Effect<X>
  ): (self: RequestResolver<A>) => RequestResolver<A>
  <A, A2, X>(
    self: RequestResolver<A>,
    before: (entries: NonEmptyArray<Request.Entry<NoInfer<A>>>) => Effect<A2>,
    after: (entries: NonEmptyArray<Request.Entry<NoInfer<A>>>, a: A2) => Effect<X>
  ): RequestResolver<A>
} = dual(3, <A, A2, X>(
  self: RequestResolver<A>,
  before: (entries: NonEmptyArray<Request.Entry<NoInfer<A>>>) => Effect<A2>,
  after: (entries: NonEmptyArray<Request.Entry<NoInfer<A>>>, a: A2) => Effect<X>
): RequestResolver<A> =>
  makeProto({
    ...self,
    runAll: (entries) =>
      effect.acquireUseRelease(
        before(entries),
        () => self.runAll(entries),
        (a) => after(entries, a)
      )
  }))

/**
 * A data source that never executes requests.
 *
 * @since 2.0.0
 * @category constructors
 */
export const never: RequestResolver<never> = make(() => effect.never)

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
    (requests) => effect.race(self.runAll(requests), that.runAll(requests))
  ))

/**
 * Add a tracing span to the request resolver, which will also add any span
 * links from the request's.
 *
 * @since 4.0.0
 * @category combinators
 */
export const withSpan: {
  (
    name: string,
    options?: Tracer.SpanOptions | undefined
  ): <A>(self: RequestResolver<A>) => RequestResolver<A>
  <A>(
    self: RequestResolver<A>,
    name: string,
    options?: Tracer.SpanOptions | undefined
  ): RequestResolver<A>
} = dual(2, <A>(
  self: RequestResolver<A>,
  name: string,
  options?: Tracer.SpanOptions | undefined
): RequestResolver<A> =>
  makeProto({
    ...self,
    runAll: (entries) =>
      effect.suspend(() => {
        const links = options?.links ? options.links.slice() : []
        const seen = new Set<Tracer.AnySpan>()
        for (const entry of entries) {
          const span = Context.getOption(entry.context, Tracer.ParentSpan)
          if (span._tag === "None" || seen.has(span.value)) continue
          seen.add(span.value)
          links.push({ span: span.value, attributes: {} })
        }
        return effect.withSpan(self.runAll(entries), name, { ...options, links })
      })
  }))
