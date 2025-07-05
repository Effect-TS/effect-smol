/**
 * @since 2.0.0
 */
import type { NonEmptyArray } from "./Array.js"
import * as Duration from "./Duration.js"
import type { Effect } from "./Effect.js"
import { constTrue, dual, identity } from "./Function.js"
import { exitFail, exitSucceed } from "./internal/core.js"
import * as effect from "./internal/effect.js"
import * as MutableHashMap from "./MutableHashMap.js"
import { type Pipeable, pipeArguments } from "./Pipeable.js"
import { hasProperty } from "./Predicate.js"
import * as Request from "./Request.js"
import * as ServiceMap from "./ServiceMap.js"
import * as Tracer from "./Tracer.js"
import type * as Types from "./Types.js"

/**
 * @example
 * ```ts
 * import { RequestResolver, Effect } from "effect"
 *
 * // The TypeId is used internally to identify RequestResolver instances
 * const resolver = RequestResolver.make((entries) =>
 *   Effect.void
 * )
 *
 * console.log(resolver[RequestResolver.TypeId]) // Object with type information
 * ```
 *
 * @since 2.0.0
 * @category symbols
 */
export const TypeId: TypeId = "~effect/RequestResolver"

/**
 * @example
 * ```ts
 * import { RequestResolver } from "effect"
 *
 * // TypeId is the unique identifier type for RequestResolver
 * const checkType = (value: unknown): value is { [RequestResolver.TypeId]: any } => {
 *   return typeof value === "object" && value !== null && RequestResolver.TypeId in value
 * }
 * ```
 *
 * @since 2.0.0
 * @category symbols
 */
export type TypeId = "~effect/RequestResolver"

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
 * @example
 * ```ts
 * import { RequestResolver, Request, Effect } from "effect"
 *
 * interface GetUserRequest extends Request.Request<string, Error> {
 *   readonly _tag: "GetUserRequest"
 *   readonly id: number
 * }
 *
 * // In practice, you would typically use RequestResolver.make() instead
 * const resolver = RequestResolver.make<GetUserRequest>((entries) =>
 *   Effect.sync(() => {
 *     for (const entry of entries) {
 *       entry.unsafeComplete(Effect.succeed(`User ${entry.request.id}`))
 *     }
 *   })
 * )
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface RequestResolver<in A> extends RequestResolver.Variance<A>, Pipeable {
  readonly delay: Effect<void>

  /**
   * Get a batch key for the given request.
   */
  batchKey(entry: A): object

  /**
   * Should the resolver continue collecting requests? Otherwise, it will
   * immediately execute the collected requests cutting the delay short.
   */
  collectWhile(entries: ReadonlySet<Request.Entry<A>>): boolean

  /**
   * Execute a collection of requests.
   */
  runAll(entries: NonEmptyArray<Request.Entry<A>>): Effect<void>
}

/**
 * @example
 * ```ts
 * import { RequestResolver } from "effect"
 *
 * // The RequestResolver namespace contains types and utilities
 * type Util = typeof RequestResolver
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export declare namespace RequestResolver {
  /**
   * @example
   * ```ts
   * import type { Types } from "effect"
   *
   * // The Variance interface is used internally for type safety
   * // It uses contravariant position for the request type parameter
   * type ExampleVariance = {
   *   readonly _A: Types.Contravariant<string>
   * }
   * ```
   *
   * @since 2.0.0
   * @category models
   */
  export interface Variance<in A> {
    readonly [TypeId]: {
      readonly _A: Types.Contravariant<A>
    }
  }
}

const RequestResolverProto = {
  [TypeId]: {
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
 * @example
 * ```ts
 * import { RequestResolver, Effect } from "effect"
 *
 * const resolver = RequestResolver.make((entries) => Effect.void)
 *
 * console.log(RequestResolver.isRequestResolver(resolver)) // true
 * console.log(RequestResolver.isRequestResolver({})) // false
 * console.log(RequestResolver.isRequestResolver(null)) // false
 * ```
 *
 * @since 2.0.0
 * @category guards
 */
export const isRequestResolver = (u: unknown): u is RequestResolver<unknown> => hasProperty(u, TypeId)

const makeProto = <A>(options: {
  readonly batchKey: (request: A) => object
  readonly delay: Effect<void>
  readonly collectWhile: (requests: ReadonlySet<Request.Entry<A>>) => boolean
  readonly runAll: (entries: NonEmptyArray<Request.Entry<A>>) => Effect<void>
}): RequestResolver<A> => {
  const self = Object.create(RequestResolverProto)
  self.batchKey = options.batchKey
  self.delay = options.delay
  self.collectWhile = options.collectWhile
  self.runAll = options.runAll
  return self
}

const defaultKeyObject = {}
const defaultKey = (_request: unknown): object => defaultKeyObject

/**
 * Constructs a request resolver with the specified method to run requests.
 *
 * @example
 * ```ts
 * import { RequestResolver, Request, Effect } from "effect"
 *
 * // Define a request type
 * interface GetUserRequest extends Request.Request<string, Error> {
 *   readonly _tag: "GetUserRequest"
 *   readonly id: number
 * }
 * const GetUserRequest = Request.tagged<GetUserRequest>("GetUserRequest")
 *
 * // Create a resolver that handles the requests
 * const UserResolver = RequestResolver.make<GetUserRequest>((entries) =>
 *   Effect.sync(() => {
 *     for (const entry of entries) {
 *       // Complete each request with a result
 *       entry.unsafeComplete(Effect.succeed(`User ${entry.request.id}`))
 *     }
 *   })
 * )
 *
 * // Use the resolver to handle requests
 * const getUserEffect = Effect.request(GetUserRequest({ id: 123 }), UserResolver)
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const make = <A>(
  runAll: (entries: NonEmptyArray<Request.Entry<A>>) => Effect<void>
): RequestResolver<A> =>
  makeProto({
    batchKey: defaultKey,
    delay: effect.yieldNow,
    collectWhile: constTrue,
    runAll
  })

/**
 * Constructs a request resolver with the requests grouped by a calculated key.
 *
 * The key can use the Equal trait to determine if two keys are equal.
 *
 * @example
 * ```ts
 * import { RequestResolver, Request, Effect } from "effect"
 *
 * interface GetUserByRole extends Request.Request<string, Error> {
 *   readonly _tag: "GetUserByRole"
 *   readonly role: string
 *   readonly id: number
 * }
 * const GetUserByRole = Request.tagged<GetUserByRole>("GetUserByRole")
 *
 * // Group requests by role for efficient batch processing
 * const UserByRoleResolver = RequestResolver.makeGrouped<GetUserByRole, string>({
 *   key: (request) => request.role,
 *   resolver: (entries, role) =>
 *     Effect.sync(() => {
 *       console.log(`Processing ${entries.length} requests for role: ${role}`)
 *       for (const entry of entries) {
 *         entry.unsafeComplete(Effect.succeed(`User ${entry.request.id} with role ${role}`))
 *       }
 *     })
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const makeGrouped = <A, K>(options: {
  readonly key: (entry: A) => K
  readonly resolver: (entries: NonEmptyArray<Request.Entry<A>>, key: K) => Effect<void>
}): RequestResolver<A> => {
  const groupKeys = MutableHashMap.empty<K, {}>()
  const getKey = (request: A): {} => {
    const okey = MutableHashMap.get(groupKeys, options.key(request))
    if (okey._tag === "Some") {
      return okey.value
    }
    const key = {}
    MutableHashMap.set(groupKeys, options.key(request), key)
    return key
  }
  return makeProto({
    batchKey: getKey,
    delay: effect.yieldNow,
    collectWhile: constTrue,
    runAll(entries) {
      const key = options.key(entries[0].request)
      return options.resolver(entries, key)
    }
  })
}

/**
 * Constructs a request resolver from a pure function.
 *
 * @example
 * ```ts
 * import { RequestResolver, Request, Effect } from "effect"
 *
 * interface GetSquareRequest extends Request.Request<number> {
 *   readonly _tag: "GetSquareRequest"
 *   readonly value: number
 * }
 * const GetSquareRequest = Request.tagged<GetSquareRequest>("GetSquareRequest")
 *
 * // Create a resolver from a pure function
 * const SquareResolver = RequestResolver.fromFunction<GetSquareRequest>(
 *   (entry) => entry.request.value * entry.request.value
 * )
 *
 * // Usage
 * const getSquareEffect = Effect.request(GetSquareRequest({ value: 5 }), SquareResolver)
 * // Will resolve to 25
 * ```
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
 * Constructs a request resolver from a pure function that takes a list of requests
 * and returns a list of results of the same size. Each item in the result
 * list must correspond to the item at the same index in the request list.
 *
 * @example
 * ```ts
 * import { RequestResolver, Request, Effect } from "effect"
 *
 * interface GetDoubleRequest extends Request.Request<number> {
 *   readonly _tag: "GetDoubleRequest"
 *   readonly value: number
 * }
 * const GetDoubleRequest = Request.tagged<GetDoubleRequest>("GetDoubleRequest")
 *
 * // Create a resolver that processes multiple requests in a batch
 * const DoubleResolver = RequestResolver.fromFunctionBatched<GetDoubleRequest>(
 *   (entries) => entries.map((entry) => entry.request.value * 2)
 * )
 *
 * // Usage with multiple requests
 * const effects = [1, 2, 3].map(value =>
 *   Effect.request(GetDoubleRequest({ value }), DoubleResolver)
 * )
 * const batchedEffect = Effect.all(effects) // [2, 4, 6]
 * ```
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
 * Constructs a request resolver from an effectual function.
 *
 * @example
 * ```ts
 * import { RequestResolver, Request, Effect } from "effect"
 *
 * interface GetUserFromAPIRequest extends Request.Request<string> {
 *   readonly _tag: "GetUserFromAPIRequest"
 *   readonly id: number
 * }
 * const GetUserFromAPIRequest = Request.tagged<GetUserFromAPIRequest>("GetUserFromAPIRequest")
 *
 * // Create a resolver that uses effects (like HTTP calls)
 * const UserAPIResolver = RequestResolver.fromEffect<GetUserFromAPIRequest>(
 *   (entry) =>
 *     Effect.gen(function* () {
 *       // Simulate an API call
 *       yield* Effect.sleep("100 millis")
 *       // Just return the result without error handling for simplicity
 *       return `User ${entry.request.id} from API`
 *     })
 * )
 *
 * // Usage
 * const getUserEffect = Effect.request(GetUserFromAPIRequest({ id: 123 }), UserAPIResolver)
 * ```
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
 * Constructs a request resolver from a list of tags paired to functions, that takes
 * a list of requests and returns a list of results of the same size. Each item
 * in the result list must correspond to the item at the same index in the
 * request list.
 *
 * @example
 * ```ts
 * import { RequestResolver, Request, Effect } from "effect"
 *
 * interface GetUser extends Request.Request<string, Error> {
 *   readonly _tag: "GetUser"
 *   readonly id: number
 * }
 *
 * interface GetPost extends Request.Request<string, Error> {
 *   readonly _tag: "GetPost"
 *   readonly id: number
 * }
 *
 * type MyRequest = GetUser | GetPost
 *
 * // Create a resolver that handles different request types
 * const MyResolver = RequestResolver.fromEffectTagged<MyRequest>()({
 *   GetUser: (requests) =>
 *     Effect.succeed(requests.map((req) => `User ${req.request.id}`)),
 *   GetPost: (requests) =>
 *     Effect.succeed(requests.map((req) => `Post ${req.request.id}`))
 * })
 * ```
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
      const grouped = new Map<A["_tag"], Array<Request.Entry<A>>>()
      for (let i = 0, len = entries.length; i < len; i++) {
        const group = grouped.get(entries[i].request._tag)
        if (group) {
          group.push(entries[i])
        } else {
          grouped.set(entries[i].request._tag, [entries[i]])
        }
      }
      return effect.forEach(
        grouped,
        ([tag, requests]) =>
          effect.matchCause((fns[tag] as any)(requests) as Effect<Array<any>, unknown, unknown>, {
            onFailure: (cause) => {
              for (let i = 0; i < requests.length; i++) {
                const entry = requests[i]
                entry.unsafeComplete(exitFail(cause) as any)
              }
            },
            onSuccess: (res) => {
              for (let i = 0; i < res.length; i++) {
                const entry = requests[i]
                entry.unsafeComplete(exitSucceed(res[i]) as any)
              }
            }
          }),
        { concurrency: "unbounded", discard: true }
      ) as Effect<void>
    }
  ) as any

/**
 * Sets the batch delay effect for this request resolver.
 *
 * @example
 * ```ts
 * import { RequestResolver, Request, Effect } from "effect"
 *
 * interface GetDataRequest extends Request.Request<string> {
 *   readonly _tag: "GetDataRequest"
 * }
 * const GetDataRequest = Request.tagged<GetDataRequest>("GetDataRequest")
 *
 * const resolver = RequestResolver.make<GetDataRequest>((entries) =>
 *   Effect.sync(() => {
 *     for (const entry of entries) {
 *       entry.unsafeComplete(Effect.succeed("data"))
 *     }
 *   })
 * )
 *
 * // Set a custom delay effect (e.g., with logging)
 * const resolverWithCustomDelay = RequestResolver.setDelayEffect(
 *   resolver,
 *   Effect.gen(function* () {
 *     yield* Effect.log("Waiting before processing batch...")
 *     yield* Effect.sleep("50 millis")
 *   })
 * )
 * ```
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
 * Sets the batch delay window for this request resolver to the specified duration.
 *
 * @example
 * ```ts
 * import { RequestResolver, Request, Effect } from "effect"
 *
 * interface GetDataRequest extends Request.Request<string> {
 *   readonly _tag: "GetDataRequest"
 * }
 * const GetDataRequest = Request.tagged<GetDataRequest>("GetDataRequest")
 *
 * const resolver = RequestResolver.make<GetDataRequest>((entries) =>
 *   Effect.sync(() => {
 *     for (const entry of entries) {
 *       entry.unsafeComplete(Effect.succeed("data"))
 *     }
 *   })
 * )
 *
 * // Add a 100ms delay to batch requests together
 * const delayedResolver = RequestResolver.setDelay(resolver, "100 millis")
 *
 * // Can also use number for milliseconds
 * const delayedResolver2 = RequestResolver.setDelay(resolver, 100)
 * ```
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
 * A request resolver aspect that executes requests between two effects, `before`
 * and `after`, where the result of `before` can be used by `after`.
 *
 * @example
 * ```ts
 * import { RequestResolver, Request, Effect } from "effect"
 *
 * interface GetDataRequest extends Request.Request<string> {
 *   readonly _tag: "GetDataRequest"
 * }
 * const GetDataRequest = Request.tagged<GetDataRequest>("GetDataRequest")
 *
 * const resolver = RequestResolver.make<GetDataRequest>((entries) =>
 *   Effect.sync(() => {
 *     for (const entry of entries) {
 *       entry.unsafeComplete(Effect.succeed("data"))
 *     }
 *   })
 * )
 *
 * // Add setup and cleanup around request execution
 * const resolverWithAround = RequestResolver.around(
 *   resolver,
 *   (entries) => Effect.gen(function* () {
 *     yield* Effect.log(`Starting batch of ${entries.length} requests`)
 *     return Date.now()
 *   }),
 *   (entries, startTime) => Effect.gen(function* () {
 *     const duration = Date.now() - startTime
 *     yield* Effect.log(`Batch completed in ${duration}ms`)
 *   })
 * )
 * ```
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
 * A request resolver that never executes requests.
 *
 * @example
 * ```ts
 * import { RequestResolver, Request, Effect } from "effect"
 *
 * // A resolver that will never complete
 * const neverResolver = RequestResolver.never
 *
 * // For testing timeout behavior with any request type
 * interface TestRequest extends Request.Request<string> {
 *   readonly _tag: "TestRequest"
 * }
 * const TestRequest = Request.tagged<TestRequest>("TestRequest")
 *
 * // This will never resolve
 * const neverEffect = Effect.request(TestRequest({}), neverResolver as any)
 *
 * // Useful for testing timeout behavior
 * const timeoutTest = Effect.timeout(neverEffect, "1 second")
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const never: RequestResolver<never> = make(() => effect.never)

/**
 * Returns a request resolver that executes at most `n` requests in parallel.
 *
 * @example
 * ```ts
 * import { RequestResolver, Request, Effect } from "effect"
 *
 * interface GetDataRequest extends Request.Request<string> {
 *   readonly _tag: "GetDataRequest"
 *   readonly id: number
 * }
 * const GetDataRequest = Request.tagged<GetDataRequest>("GetDataRequest")
 *
 * const resolver = RequestResolver.make<GetDataRequest>((entries) =>
 *   Effect.sync(() => {
 *     console.log(`Processing batch of ${entries.length} requests`)
 *     for (const entry of entries) {
 *       entry.unsafeComplete(Effect.succeed(`data-${entry.request.id}`))
 *     }
 *   })
 * )
 *
 * // Limit batches to maximum 5 requests
 * const limitedResolver = RequestResolver.batchN(resolver, 5)
 *
 * // When more than 5 requests are made, they'll be split into multiple batches
 * const requests = Array.from({ length: 12 }, (_, i) =>
 *   Effect.request(GetDataRequest({ id: i }), limitedResolver)
 * )
 * ```
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
    collectWhile: (requests) => requests.size < n
  }))

/**
 * Transform a request resolver by grouping requests using the specified key
 * function.
 *
 * @example
 * ```ts
 * import { RequestResolver, Request, Effect } from "effect"
 *
 * interface GetUserRequest extends Request.Request<string> {
 *   readonly _tag: "GetUserRequest"
 *   readonly userId: number
 *   readonly department: string
 * }
 * const GetUserRequest = Request.tagged<GetUserRequest>("GetUserRequest")
 *
 * const resolver = RequestResolver.make<GetUserRequest>((entries) =>
 *   Effect.sync(() => {
 *     console.log(`Processing ${entries.length} users`)
 *     for (const entry of entries) {
 *       entry.unsafeComplete(Effect.succeed(`User ${entry.request.userId}`))
 *     }
 *   })
 * )
 *
 * // Group requests by department for more efficient processing
 * const groupedResolver = RequestResolver.grouped(
 *   resolver,
 *   (request) => request.department
 * )
 *
 * // Requests for the same department will be batched together
 * const requests = [
 *   Effect.request(GetUserRequest({ userId: 1, department: "Engineering" }), groupedResolver),
 *   Effect.request(GetUserRequest({ userId: 2, department: "Engineering" }), groupedResolver),
 *   Effect.request(GetUserRequest({ userId: 3, department: "Marketing" }), groupedResolver)
 * ]
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const grouped: {
  <A, K>(f: (request: A) => K): (self: RequestResolver<A>) => RequestResolver<A>
  <A, K>(self: RequestResolver<A>, f: (request: A) => K): RequestResolver<A>
} = dual(2, <A, K>(self: RequestResolver<A>, f: (request: A) => K): RequestResolver<A> =>
  makeGrouped({
    key: f,
    resolver: self.runAll
  }))

/**
 * Returns a new request resolver that executes requests by sending them to this
 * request resolver and that request resolver, returning the results from the first data
 * source to complete and safely interrupting the loser.
 *
 * The batch delay is determined by the first request resolver.
 *
 * @example
 * ```ts
 * import { RequestResolver, Request, Effect } from "effect"
 *
 * interface GetDataRequest extends Request.Request<string> {
 *   readonly _tag: "GetDataRequest"
 *   readonly id: number
 * }
 * const GetDataRequest = Request.tagged<GetDataRequest>("GetDataRequest")
 *
 * // Fast resolver (simulating cache)
 * const fastResolver = RequestResolver.make<GetDataRequest>((entries) =>
 *   Effect.gen(function* () {
 *     yield* Effect.sleep("10 millis")
 *     for (const entry of entries) {
 *       entry.unsafeComplete(Effect.succeed(`fast-${entry.request.id}`))
 *     }
 *   })
 * )
 *
 * // Slow resolver (simulating database)
 * const slowResolver = RequestResolver.make<GetDataRequest>((entries) =>
 *   Effect.gen(function* () {
 *     yield* Effect.sleep("100 millis")
 *     for (const entry of entries) {
 *       entry.unsafeComplete(Effect.succeed(`slow-${entry.request.id}`))
 *     }
 *   })
 * )
 *
 * // Race resolvers - will use whichever completes first
 * const racingResolver = RequestResolver.race(fastResolver, slowResolver)
 * ```
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
 * @example
 * ```ts
 * import { RequestResolver, Request, Effect } from "effect"
 *
 * interface GetDataRequest extends Request.Request<string> {
 *   readonly _tag: "GetDataRequest"
 *   readonly id: number
 * }
 * const GetDataRequest = Request.tagged<GetDataRequest>("GetDataRequest")
 *
 * const resolver = RequestResolver.make<GetDataRequest>((entries) =>
 *   Effect.sync(() => {
 *     for (const entry of entries) {
 *       entry.unsafeComplete(Effect.succeed(`data-${entry.request.id}`))
 *     }
 *   })
 * )
 *
 * // Add tracing span with custom name and attributes
 * const tracedResolver = RequestResolver.withSpan(
 *   resolver,
 *   "user-data-resolver",
 *   {
 *     attributes: {
 *       "resolver.type": "user-data",
 *       "resolver.version": "1.0"
 *     }
 *   }
 * )
 *
 * // Spans will automatically include batch size and request links
 * const effect = Effect.request(GetDataRequest({ id: 123 }), tracedResolver)
 * ```
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
          const span = ServiceMap.getOption(entry.services, Tracer.ParentSpan)
          if (span._tag === "None" || seen.has(span.value)) continue
          seen.add(span.value)
          links.push({ span: span.value, attributes: {} })
        }
        return effect.withSpan(self.runAll(entries), name, {
          ...options,
          links,
          attributes: {
            batchSize: entries.length,
            ...options?.attributes
          }
        })
      })
  }))
