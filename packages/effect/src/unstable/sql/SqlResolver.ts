/**
 * @since 1.0.0
 */
import * as Request from "../../batching/Request.ts"
import * as RequestResolver from "../../batching/RequestResolver.ts"
import type { NonEmptyArray } from "../../collections/Array.ts"
import * as MutableHashMap from "../../collections/MutableHashMap.ts"
import * as Option from "../../data/Option.ts"
import * as Effect from "../../Effect.ts"
import * as Exit from "../../Exit.ts"
import * as Equal from "../../interfaces/Equal.ts"
import * as Hash from "../../interfaces/Hash.ts"
import * as Tracer from "../../observability/Tracer.ts"
import * as Schema from "../../schema/Schema.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as Types from "../../types/Types.ts"
import * as SqlClient from "./SqlClient.ts"
import { ResultLengthMismatch } from "./SqlError.ts"

/**
 * @since 1.0.0
 * @category requests
 */
export interface SqlRequest<In, A, E, R> extends Request.Request<A, E | Schema.SchemaError, R> {
  readonly payload: In
}

const SqlRequestProto = {
  ...Request.Class.prototype,
  [Equal.symbol](
    this: SqlRequest<any, any, any, any>,
    that: SqlRequest<any, any, any, any>
  ): boolean {
    return Equal.equals(this.payload, that.payload)
  },
  [Hash.symbol](this: SqlRequest<any, any, any, any>): number {
    return Hash.cached(this, () => Hash.hash(this.payload))
  }
}

/**
 * @since 1.0.0
 * @category requests
 */
export const request = <In, A, E, R>(
  resolver: RequestResolver.RequestResolver<SqlRequest<In, A, E, R>>
) =>
(payload: In): Effect.Effect<A, E | Schema.SchemaError, R> =>
  Effect.request(makeRequest<In, A, E, R>(payload), resolver)

const makeRequest = <In, A, E, R>(payload: In): SqlRequest<In, A, E, R> => {
  const self = Object.create(SqlRequestProto)
  self.payload = payload
  return self
}

const partitionRequests = <In, A, E, R>(
  requests: ReadonlyArray<Request.Entry<SqlRequest<In, A, E, R>>>
) => {
  const len = requests.length
  const inputs: Array<In> = new Array(len)

  for (let i = 0; i < len; i++) {
    const request = requests[i]
    inputs[i] = request.request.payload
  }

  return inputs
}

const partitionRequestsById = <In, A, E, R>(requests: ReadonlyArray<Request.Entry<SqlRequest<In, A, E, R>>>) => {
  const len = requests.length
  const inputs: Array<In> = new Array(len)
  const byIdMap = MutableHashMap.empty<In, Request.Entry<SqlRequest<In, A, E, R>>>()

  for (let i = 0; i < len; i++) {
    const request = requests[i]
    inputs[i] = request.request.payload
    MutableHashMap.set(byIdMap, request.request.payload, request)
  }

  return [inputs, byIdMap] as const
}

/**
 * @since 1.0.0
 * @category resolvers
 */
export interface SqlResolver<T extends string, I, A, E, R>
  extends RequestResolver.RequestResolver<SqlRequest<T, A, E>>
{
  readonly execute: (input: I) => Effect.Effect<A, E | ParseError, R>
  readonly makeExecute: (
    resolver: RequestResolver.RequestResolver<SqlRequest<T, A, E>>
  ) => (input: I) => Effect.Effect<A, E | ParseError, R>
  readonly cachePopulate: (
    id: I,
    result: A
  ) => Effect.Effect<void>
  readonly cacheInvalidate: (id: I) => Effect.Effect<void>
  readonly request: (input: I) => Effect.Effect<SqlRequest<T, A, E>, ParseError, R>
}

const makeResolver = <T extends string, A, E, I, II, RI, R>(
  self: RequestResolver.RequestResolver<SqlRequest<T, A, E>>,
  tag: T,
  Request: Schema.Schema<I, II, RI>,
  withContext?: boolean
): Effect.Effect<SqlResolver<T, I, A, E, RI>, never, R> => {
  function make(context: ServiceMap.Context<R> | undefined) {
    const encode = Schema.encode(Request)
    function makeExecute(self: RequestResolver.RequestResolver<SqlRequest<T, A, E>>) {
      return function(input: I) {
        return Effect.useSpan(
          `sql.Resolver.execute ${tag}`,
          { kind: "client", captureStackTrace: false },
          (span) =>
            Effect.withFiberRuntime<A, E | ParseError, RI>((fiber) => {
              span.attribute("request.input", input)
              const currentContext = fiber.currentContext
              const connection = currentContext.unsafeMap.get(
                SqlClient.TransactionConnection.key
              )
              let toProvide: ServiceMap.ServiceMap<R> | undefined = context
              if (connection !== undefined) {
                if (toProvide === undefined) {
                  toProvide = ServiceMap.make(
                    internalClient.TransactionConnection,
                    connection
                  ) as ServiceMap.Context<R>
                } else {
                  toProvide = ServiceMap.add(
                    toProvide,
                    internalClient.TransactionConnection,
                    connection
                  )
                }
              }
              const resolver = toProvide === undefined
                ? self
                : RequestResolver.provideContext(self, toProvide)
              return Effect.flatMap(
                encode(input),
                (encoded) => Effect.request(makeRequest<T, I, II, A, E>(tag, input, encoded, span), resolver)
              )
            })
        )
      }
    }
    return Object.assign(self, {
      request(input: I) {
        return Effect.withFiberRuntime<SqlRequest<T, A, E>, ParseError, RI>(
          (fiber) => {
            const span = fiber.currentContext.unsafeMap.get(Tracer.ParentSpan.key)
            return Effect.map(encode(input), (encoded) => makeRequest(tag, input, encoded, span))
          }
        )
      },
      cachePopulate(input: I, value: A) {
        return Effect.cacheRequestResult(makeRequest(tag, input, null as any, null as any), Exit.succeed(value))
      },
      cacheInvalidate(input: I) {
        return Effect.withFiberRuntime<void>((fiber) => {
          const cache = fiber.getFiberRef(FiberRef.currentRequestCache)
          return cache.invalidate(makeRequest(tag, input, null as any, null as any))
        })
      },
      makeExecute,
      execute: makeExecute(self)
    })
  }

  return withContext === true ? Effect.map(Effect.context<R>(), make) : Effect.succeed(make(undefined))
}

/**
 * Create a resolver for a sql query with a request schema and a result schema.
 *
 * The request schema is used to validate the input of the query.
 * The result schema is used to validate the output of the query.
 *
 * Results are mapped to the requests in order, so the length of the results must match the length of the requests.
 *
 * @since 1.0.0
 * @category resolvers
 */
export const ordered = <T extends string, I, II, RI, A, IA, _, E, RA = never, R = never>(
  tag: T,
  options:
    | {
      readonly Request: Schema.Schema<I, II, RI>
      readonly Result: Schema.Schema<A, IA>
      readonly execute: (
        requests: Array<Types.NoInfer<II>>
      ) => Effect.Effect<ReadonlyArray<_>, E>
      readonly withContext?: false
    }
    | {
      readonly Request: Schema.Schema<I, II, RI>
      readonly Result: Schema.Schema<A, IA, RA>
      readonly execute: (
        requests: Array<Types.NoInfer<II>>
      ) => Effect.Effect<ReadonlyArray<_>, E, R>
      readonly withContext: true
    }
): Effect.Effect<
  SqlResolver<T, I, A, E | ResultLengthMismatch, RI>,
  never,
  RA | R
> => {
  const decodeResults = Schema.decodeUnknown(Schema.Array(options.Result))
  const resolver = RequestResolver.makeBatched(
    (requests: NonEmptyArray<SqlRequest<T, A, E | ResultLengthMismatch>>) => {
      const [inputs, spanLinks] = partitionRequests(requests)
      return options.execute(inputs as any).pipe(
        Effect.filterOrFail(
          (results) => results.length === inputs.length,
          ({ length }) =>
            new ResultLengthMismatch({
              expected: inputs.length,
              actual: length
            })
        ),
        Effect.flatMap(decodeResults),
        Effect.flatMap(
          Effect.forEach((result, i) => Request.succeed(requests[i], result), {
            discard: true
          })
        ),
        Effect.catchAllCause((cause) =>
          Effect.forEach(
            requests,
            (request) => Request.failCause(request, cause),
            { discard: true }
          )
        ),
        Effect.withSpan(`sql.Resolver.batch ${tag}`, {
          kind: "client",
          links: spanLinks,
          attributes: { "request.count": inputs.length },
          captureStackTrace: false
        })
      ) as Effect.Effect<void>
    }
  ).identified(`@effect/sql/SqlResolver.ordered/${tag}`)
  return makeResolver(resolver, tag, options.Request, options.withContext)
}

/**
 * Create a resolver the can return multiple results for a single request.
 *
 * Results are grouped by a common key extracted from the request and result.
 *
 * @since 1.0.0
 * @category resolvers
 */
export const grouped = <T extends string, I, II, K, RI, A, IA, Row, E, RA = never, R = never>(
  tag: T,
  options:
    | {
      readonly Request: Schema.Schema<I, II, RI>
      readonly RequestGroupKey: (request: Types.NoInfer<I>) => K
      readonly Result: Schema.Schema<A, IA>
      readonly ResultGroupKey: (result: Types.NoInfer<A>, row: Types.NoInfer<Row>) => K
      readonly execute: (
        requests: Array<Types.NoInfer<II>>
      ) => Effect.Effect<ReadonlyArray<Row>, E>
      readonly withContext?: false
    }
    | {
      readonly Request: Schema.Schema<I, II, RI>
      readonly RequestGroupKey: (request: Types.NoInfer<I>) => K
      readonly Result: Schema.Schema<A, IA, RA>
      readonly ResultGroupKey: (result: Types.NoInfer<A>, row: Types.NoInfer<Row>) => K
      readonly execute: (
        requests: Array<Types.NoInfer<II>>
      ) => Effect.Effect<ReadonlyArray<Row>, E, R>
      readonly withContext: true
    }
): Effect.Effect<SqlResolver<T, I, Array<A>, E, RI>, never, RA | R> => {
  const decodeResults = Schema.decodeUnknown(Schema.Array(options.Result))
  const resolver = RequestResolver.makeBatched(
    (requests: NonEmptyArray<SqlRequest<T, Array<A>, E>>) => {
      const [inputs, spanLinks] = partitionRequests(requests)
      const resultMap = MutableHashMap.empty<K, Array<A>>()
      return options.execute(inputs as any).pipe(
        Effect.bindTo("rawResults"),
        Effect.bind("results", ({ rawResults }) => decodeResults(rawResults)),
        Effect.tap(({ rawResults, results }) => {
          for (let i = 0, len = results.length; i < len; i++) {
            const result = results[i]
            const key = options.ResultGroupKey(result, rawResults[i])
            const group = MutableHashMap.get(resultMap, key)
            if (group._tag === "None") {
              MutableHashMap.set(resultMap, key, [result])
            } else {
              group.value.push(result)
            }
          }

          return Effect.forEach(
            requests,
            (request) => {
              const key = options.RequestGroupKey(request.input as I)
              const result = MutableHashMap.get(resultMap, key)
              return Request.succeed(request, result._tag === "None" ? [] : result.value)
            },
            { discard: true }
          )
        }),
        Effect.catchAllCause((cause) =>
          Effect.forEach(
            requests,
            (request) => Request.failCause(request, cause),
            { discard: true }
          )
        ),
        Effect.withSpan(`sql.Resolver.batch ${tag}`, {
          kind: "client",
          links: spanLinks,
          attributes: { "request.count": inputs.length },
          captureStackTrace: false
        })
      ) as Effect.Effect<void>
    }
  ).identified(`@effect/sql/SqlResolver.grouped/${tag}`)
  return makeResolver(resolver, tag, options.Request, options.withContext)
}

/**
 * Create a resolver that resolves results by id.
 *
 * @since 1.0.0
 * @category resolvers
 */
export const findById = <T extends string, I, II, RI, A, IA, Row, E, RA = never, R = never>(
  tag: T,
  options:
    | {
      readonly Id: Schema.Schema<I, II, RI>
      readonly Result: Schema.Schema<A, IA>
      readonly ResultId: (result: Types.NoInfer<A>, row: Types.NoInfer<Row>) => I
      readonly execute: (
        requests: Array<Types.NoInfer<II>>
      ) => Effect.Effect<ReadonlyArray<Row>, E>
      readonly withContext?: false
    }
    | {
      readonly Id: Schema.Schema<I, II, RI>
      readonly Result: Schema.Schema<A, IA, RA>
      readonly ResultId: (result: Types.NoInfer<A>, row: Types.NoInfer<Row>) => I
      readonly execute: (
        requests: Array<Types.NoInfer<II>>
      ) => Effect.Effect<ReadonlyArray<Row>, E, R>
      readonly withContext: true
    }
): Effect.Effect<SqlResolver<T, I, Option.Option<A>, E, RI>, never, RA | R> => {
  const decodeResults = Schema.decodeUnknown(Schema.Array(options.Result))
  const resolver = RequestResolver.makeBatched(
    (requests: NonEmptyArray<SqlRequest<T, Option.Option<A>, E>>) => {
      const [inputs, spanLinks, idMap] = partitionRequestsById<I, II>()(requests)
      return options.execute(inputs as any).pipe(
        Effect.bindTo("rawResults"),
        Effect.bind("results", ({ rawResults }) => decodeResults(rawResults)),
        Effect.flatMap(({ rawResults, results }) =>
          Effect.forEach(
            results,
            (result, i) => {
              const id = options.ResultId(result, rawResults[i])
              const request = MutableHashMap.get(idMap, id)
              if (request._tag === "None") {
                return Effect.void
              }
              MutableHashMap.remove(idMap, id)
              return Request.succeed(request.value, Option.some(result))
            },
            { discard: true }
          )
        ),
        Effect.tap((_) => {
          if (MutableHashMap.size(idMap) === 0) {
            return Effect.void
          }
          return Effect.forEach(
            idMap,
            ([, request]) => Request.succeed(request, Option.none()),
            { discard: true }
          )
        }),
        Effect.catchAllCause((cause) =>
          Effect.forEach(
            requests,
            (request) => Request.failCause(request, cause),
            { discard: true }
          )
        ),
        Effect.withSpan(`sql.Resolver.batch ${tag}`, {
          kind: "client",
          links: spanLinks,
          attributes: { "request.count": inputs.length },
          captureStackTrace: false
        })
      ) as Effect.Effect<void>
    }
  ).identified(`@effect/sql/SqlResolver.findById/${tag}`)
  return makeResolver(resolver, tag, options.Id, options.withContext)
}
const void_ = <T extends string, I, II, RI, E, R = never>(
  tag: T,
  options:
    | {
      readonly Request: Schema.Schema<I, II, RI>
      readonly execute: (
        requests: Array<Types.NoInfer<II>>
      ) => Effect.Effect<ReadonlyArray<unknown>, E>
      readonly withContext?: false
    }
    | {
      readonly Request: Schema.Schema<I, II, RI>
      readonly execute: (
        requests: Array<Types.NoInfer<II>>
      ) => Effect.Effect<unknown, E, R>
      readonly withContext: true
    }
): Effect.Effect<SqlResolver<T, I, void, E, RI>, never, R> => {
  const resolver = RequestResolver.makeBatched(
    (requests: NonEmptyArray<SqlRequest<T, void, E>>) => {
      const [inputs, spanLinks] = partitionRequests(requests)
      return options.execute(inputs as any).pipe(
        Effect.andThen(
          Effect.forEach(
            requests,
            (request) => Request.complete(request, Exit.void),
            { discard: true }
          )
        ),
        Effect.catchAllCause((cause) =>
          Effect.forEach(
            requests,
            (request) => Request.failCause(request, cause),
            { discard: true }
          )
        ),
        Effect.withSpan(`sql.Resolver.batch ${tag}`, {
          kind: "client",
          links: spanLinks,
          attributes: { "request.count": inputs.length },
          captureStackTrace: false
        })
      ) as Effect.Effect<void>
    }
  ).identified(`@effect/sql/SqlResolver.void/${tag}`)
  return makeResolver(resolver, tag, options.Request, options.withContext)
}

export {
  /**
   * Create a resolver that performs side effects.
   *
   * @since 1.0.0
   * @category resolvers
   */
  void_ as void
}
