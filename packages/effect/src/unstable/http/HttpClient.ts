/**
 * @since 4.0.0
 */
import type { NonEmptyReadonlyArray } from "../../Array.ts"
import * as Cause from "../../Cause.ts"
import * as Effect from "../../Effect.ts"
import * as Exit from "../../Exit.ts"
import type { Fiber } from "../../Fiber.ts"
import { constFalse, constTrue, dual, flow, identity } from "../../Function.ts"
import * as Inspectable from "../../Inspectable.ts"
import * as Layer from "../../Layer.ts"
import { type Pipeable, pipeArguments } from "../../Pipeable.ts"
import * as Predicate from "../../Predicate.ts"
import * as Ref from "../../Ref.ts"
import * as Result from "../../Result.ts"
import * as Schedule from "../../Schedule.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Stream from "../../Stream.ts"
import * as Tracer from "../../Tracer.ts"
import type { EqualsWith, ExcludeTag, ExtractTag, NoExcessProperties, NoInfer, Tags } from "../../Types.ts"
import * as Cookies from "./Cookies.ts"
import * as Headers from "./Headers.ts"
import * as Error from "./HttpClientError.ts"
import * as HttpClientRequest from "./HttpClientRequest.ts"
import * as HttpClientResponse from "./HttpClientResponse.ts"
import * as HttpIncomingMessage from "./HttpIncomingMessage.ts"
import * as HttpMethod from "./HttpMethod.ts"
import * as TraceContext from "./HttpTraceContext.ts"
import * as UrlParams from "./UrlParams.ts"

const TypeId = "~effect/http/HttpClient"

/**
 * @since 4.0.0
 * @category Guards
 */
export const isHttpClient = (u: unknown): u is HttpClient => Predicate.hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category models
 */
export interface HttpClient extends HttpClient.With<Error.HttpClientError> {}

/**
 * @since 4.0.0
 */
export declare namespace HttpClient {
  /**
   * @since 4.0.0
   * @category models
   */
  export interface With<E, R = never> extends Pipeable, Inspectable.Inspectable {
    readonly [TypeId]: typeof TypeId
    readonly preprocess: Preprocess<E, R>
    readonly postprocess: Postprocess<E, R>
    readonly execute: (
      request: HttpClientRequest.HttpClientRequest
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>

    readonly get: (
      url: string | URL,
      options?: HttpClientRequest.Options.NoBody
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>
    readonly head: (
      url: string | URL,
      options?: HttpClientRequest.Options.NoBody
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>
    readonly post: (
      url: string | URL,
      options?: HttpClientRequest.Options.NoUrl
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>
    readonly patch: (
      url: string | URL,
      options?: HttpClientRequest.Options.NoUrl
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>
    readonly put: (
      url: string | URL,
      options?: HttpClientRequest.Options.NoUrl
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>
    readonly del: (
      url: string | URL,
      options?: HttpClientRequest.Options.NoUrl
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>
    readonly options: (
      url: string | URL,
      options?: HttpClientRequest.Options.NoUrl
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export type Preprocess<E, R> = (
    request: HttpClientRequest.HttpClientRequest
  ) => Effect.Effect<HttpClientRequest.HttpClientRequest, E, R>

  /**
   * @since 4.0.0
   * @category models
   */
  export type Postprocess<E = never, R = never> = (
    request: Effect.Effect<HttpClientRequest.HttpClientRequest, E, R>
  ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>
}

/**
 * @since 4.0.0
 * @category tags
 */
export const HttpClient: ServiceMap.Service<HttpClient, HttpClient> = ServiceMap.Service<HttpClient, HttpClient>(
  "effect/HttpClient"
)

const accessor = (method: keyof HttpClient) => (...args: Array<any>): Effect.Effect<any, any, any> =>
  Effect.flatMap(
    HttpClient.asEffect(),
    (client) => (client as any)[method](...args)
  )

/**
 * @since 4.0.0
 * @category accessors
 */
export const execute: (
  request: HttpClientRequest.HttpClientRequest
) => Effect.Effect<HttpClientResponse.HttpClientResponse, Error.HttpClientError, HttpClient> = accessor("execute")

/**
 * @since 4.0.0
 * @category accessors
 */
export const get: (url: string | URL, options?: HttpClientRequest.Options.NoBody | undefined) => Effect.Effect<
  HttpClientResponse.HttpClientResponse,
  Error.HttpClientError,
  HttpClient
> = accessor("get")

/**
 * @since 4.0.0
 * @category accessors
 */
export const head: (url: string | URL, options?: HttpClientRequest.Options.NoBody | undefined) => Effect.Effect<
  HttpClientResponse.HttpClientResponse,
  Error.HttpClientError,
  HttpClient
> = accessor("head")

/**
 * @since 4.0.0
 * @category accessors
 */
export const post: (url: string | URL, options?: HttpClientRequest.Options.NoUrl | undefined) => Effect.Effect<
  HttpClientResponse.HttpClientResponse,
  Error.HttpClientError,
  HttpClient
> = accessor("post")

/**
 * @since 4.0.0
 * @category accessors
 */
export const patch: (url: string | URL, options?: HttpClientRequest.Options.NoUrl | undefined) => Effect.Effect<
  HttpClientResponse.HttpClientResponse,
  Error.HttpClientError,
  HttpClient
> = accessor("patch")

/**
 * @since 4.0.0
 * @category accessors
 */
export const put: (url: string | URL, options?: HttpClientRequest.Options.NoUrl | undefined) => Effect.Effect<
  HttpClientResponse.HttpClientResponse,
  Error.HttpClientError,
  HttpClient
> = accessor("put")

/**
 * @since 4.0.0
 * @category accessors
 */
export const del: (url: string | URL, options?: HttpClientRequest.Options.NoUrl | undefined) => Effect.Effect<
  HttpClientResponse.HttpClientResponse,
  Error.HttpClientError,
  HttpClient
> = accessor("del")

/**
 * @since 4.0.0
 * @category accessors
 */
export const options: (url: string | URL, options?: HttpClientRequest.Options.NoUrl | undefined) => Effect.Effect<
  HttpClientResponse.HttpClientResponse,
  Error.HttpClientError,
  HttpClient
> = accessor("options")

/**
 * @since 4.0.0
 * @category mapping & sequencing
 */
export const transform: {
  <E, R, E1, R1>(
    f: (
      effect: Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>,
      request: HttpClientRequest.HttpClientRequest
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E1, R1>
  ): (self: HttpClient.With<E, R>) => HttpClient.With<E | E1, R | R1>
  <E, R, E1, R1>(
    self: HttpClient.With<E, R>,
    f: (
      effect: Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>,
      request: HttpClientRequest.HttpClientRequest
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E1, R1>
  ): HttpClient.With<E | E1, R | R1>
} = dual(2, <E, R, E1, R1>(
  self: HttpClient.With<E, R>,
  f: (
    effect: Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>,
    request: HttpClientRequest.HttpClientRequest
  ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E1, R1>
): HttpClient.With<E | E1, R | R1> =>
  makeWith(
    Effect.flatMap((request) => f(self.postprocess(Effect.succeed(request)), request)),
    self.preprocess
  ))

/**
 * @since 4.0.0
 * @category mapping & sequencing
 */
export const transformResponse: {
  <E, R, E1, R1>(
    f: (
      effect: Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E1, R1>
  ): (self: HttpClient.With<E, R>) => HttpClient.With<E1, R1>
  <E, R, E1, R1>(
    self: HttpClient.With<E, R>,
    f: (
      effect: Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E1, R1>
  ): HttpClient.With<E1, R1>
} = dual(2, <E, R, E1, R1>(
  self: HttpClient.With<E, R>,
  f: (
    effect: Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>
  ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E1, R1>
): HttpClient.With<E1, R1> => makeWith((request) => f(self.postprocess(request)), self.preprocess))

const catch_: {
  <E, E2, R2>(
    f: (e: E) => Effect.Effect<HttpClientResponse.HttpClientResponse, E2, R2>
  ): <R>(self: HttpClient.With<E, R>) => HttpClient.With<E2, R2 | R>
  <E, R, A2, E2, R2>(
    self: HttpClient.With<E, R>,
    f: (e: E) => Effect.Effect<A2, E2, R2>
  ): HttpClient.With<E2, R | R2>
} = dual(
  2,
  <E, R, E2, R2>(
    self: HttpClient.With<E, R>,
    f: (e: E) => Effect.Effect<HttpClientResponse.HttpClientResponse, E2, R2>
  ): HttpClient.With<E2, R | R2> => transformResponse(self, Effect.catch(f))
)

export {
  /**
   * @since 4.0.0
   * @category error handling
   */
  catch_ as catch
}

/**
 * @since 4.0.0
 * @category error handling
 */
export const catchTag: {
  <K extends Tags<E> | NonEmptyReadonlyArray<Tags<E>>, E, E1, R1>(
    tag: K,
    f: (
      e: ExtractTag<NoInfer<E>, K extends NonEmptyReadonlyArray<string> ? K[number] : K>
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E1, R1>
  ): <R>(
    self: HttpClient.With<E, R>
  ) => HttpClient.With<E1 | ExcludeTag<E, K extends NonEmptyReadonlyArray<string> ? K[number] : K>, R1 | R>
  <R, E, K extends Tags<E> | NonEmptyReadonlyArray<Tags<E>>, R1, E1>(
    self: HttpClient.With<E, R>,
    tag: K,
    f: (
      e: ExtractTag<E, K extends NonEmptyReadonlyArray<string> ? K[number] : K>
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E1, R1>
  ): HttpClient.With<E1 | ExcludeTag<E, K extends NonEmptyReadonlyArray<string> ? K[number] : K>, R1 | R>
} = dual(
  3,
  <R, E, K extends Tags<E> | NonEmptyReadonlyArray<Tags<E>>, R1, E1>(
    self: HttpClient.With<E, R>,
    tag: K,
    f: (
      e: ExtractTag<E, K extends NonEmptyReadonlyArray<string> ? K[number] : K>
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E1, R1>
  ): HttpClient.With<E1 | ExcludeTag<E, K extends NonEmptyReadonlyArray<string> ? K[number] : K>, R1 | R> =>
    transformResponse(self, Effect.catchTag(tag, f))
)

/**
 * @since 4.0.0
 * @category error handling
 */
export const catchTags: {
  <
    E,
    Cases extends
      & {
        [K in Extract<E, { _tag: string }>["_tag"]]+?: (
          error: Extract<E, { _tag: K }>
        ) => Effect.Effect<HttpClientResponse.HttpClientResponse, any, any>
      }
      & (unknown extends E ? {} : { [K in Exclude<keyof Cases, Extract<E, { _tag: string }>["_tag"]>]: never })
  >(
    cases: Cases
  ): <R>(
    self: HttpClient.With<E, R>
  ) => HttpClient.With<
    | Exclude<E, { _tag: keyof Cases }>
    | {
      [K in keyof Cases]: Cases[K] extends (...args: Array<any>) => Effect.Effect<any, infer E, any> ? E : never
    }[keyof Cases],
    | R
    | {
      [K in keyof Cases]: Cases[K] extends (...args: Array<any>) => Effect.Effect<any, any, infer R> ? R : never
    }[keyof Cases]
  >
  <
    E extends { _tag: string },
    R,
    Cases extends
      & {
        [K in Extract<E, { _tag: string }>["_tag"]]+?: (
          error: Extract<E, { _tag: K }>
        ) => Effect.Effect<HttpClientResponse.HttpClientResponse, any, any>
      }
      & (unknown extends E ? {} : { [K in Exclude<keyof Cases, Extract<E, { _tag: string }>["_tag"]>]: never })
  >(
    self: HttpClient.With<E, R>,
    cases: Cases
  ): HttpClient.With<
    | Exclude<E, { _tag: keyof Cases }>
    | {
      [K in keyof Cases]: Cases[K] extends (...args: Array<any>) => Effect.Effect<any, infer E, any> ? E : never
    }[keyof Cases],
    | R
    | {
      [K in keyof Cases]: Cases[K] extends (...args: Array<any>) => Effect.Effect<any, any, infer R> ? R : never
    }[keyof Cases]
  >
} = dual(
  2,
  <
    E extends { _tag: string },
    R,
    Cases extends
      & {
        [K in Extract<E, { _tag: string }>["_tag"]]+?: (
          error: Extract<E, { _tag: K }>
        ) => Effect.Effect<HttpClientResponse.HttpClientResponse, any, any>
      }
      & (unknown extends E ? {}
        : {
          [
            K in Exclude<
              keyof Cases,
              Extract<E, { _tag: string }>["_tag"]
            >
          ]: never
        })
  >(
    self: HttpClient.With<E, R>,
    cases: Cases
  ): HttpClient.With<
    | Exclude<E, { _tag: keyof Cases }>
    | {
      [K in keyof Cases]: Cases[K] extends (
        ...args: Array<any>
      ) => Effect.Effect<any, infer E, any> ? E
        : never
    }[keyof Cases],
    | R
    | {
      [K in keyof Cases]: Cases[K] extends (
        ...args: Array<any>
      ) => Effect.Effect<any, any, infer R> ? R
        : never
    }[keyof Cases]
  > => transformResponse(self, Effect.catchTags(cases) as any)
)

/**
 * Filters the result of a response, or runs an alternative effect if the predicate fails.
 *
 * @since 4.0.0
 * @category filters
 */
export const filterOrElse: {
  <B extends HttpClientResponse.HttpClientResponse, E2, R2>(
    refinement: Predicate.Refinement<NoInfer<HttpClientResponse.HttpClientResponse>, B>,
    orElse: (
      response: EqualsWith<
        HttpClientResponse.HttpClientResponse,
        B,
        NoInfer<HttpClientResponse.HttpClientResponse>,
        Exclude<NoInfer<HttpClientResponse.HttpClientResponse>, B>
      >
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E2, R2>
  ): <E, R>(self: HttpClient.With<E, R>) => HttpClient.With<E2 | E, R2 | R>
  <E2, R2>(
    predicate: Predicate.Predicate<NoInfer<HttpClientResponse.HttpClientResponse>>,
    orElse: (
      response: NoInfer<HttpClientResponse.HttpClientResponse>
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E2, R2>
  ): <E, R>(self: HttpClient.With<E, R>) => HttpClient.With<E2 | E, R2 | R>
  <E, R, B extends HttpClientResponse.HttpClientResponse, E2, R2>(
    self: HttpClient.With<E, R>,
    refinement: Predicate.Refinement<HttpClientResponse.HttpClientResponse, B>,
    orElse: (
      response: EqualsWith<
        HttpClientResponse.HttpClientResponse,
        B,
        HttpClientResponse.HttpClientResponse,
        Exclude<HttpClientResponse.HttpClientResponse, B>
      >
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E2, R2>
  ): HttpClient.With<E2 | E, R2 | R>
  <E, R, E2, R2>(
    self: HttpClient.With<E, R>,
    predicate: Predicate.Predicate<HttpClientResponse.HttpClientResponse>,
    orElse: (
      response: HttpClientResponse.HttpClientResponse
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E2, R2>
  ): HttpClient.With<E2 | E, R2 | R>
} = dual(3, (self, f, orElse) => transformResponse(self, Effect.filterOrElse(f, orElse)))

/**
 * Filters the result of a response, or throws an error if the predicate fails.
 *
 * @since 4.0.0
 * @category filters
 */
export const filterOrFail: {
  <B extends HttpClientResponse.HttpClientResponse, E2>(
    refinement: Predicate.Refinement<NoInfer<HttpClientResponse.HttpClientResponse>, B>,
    orFailWith: (response: NoInfer<HttpClientResponse.HttpClientResponse>) => E2
  ): <E, R>(self: HttpClient.With<E, R>) => HttpClient.With<E2 | E, R>
  <E2>(
    predicate: Predicate.Predicate<NoInfer<HttpClientResponse.HttpClientResponse>>,
    orFailWith: (response: NoInfer<HttpClientResponse.HttpClientResponse>) => E2
  ): <E, R>(self: HttpClient.With<E, R>) => HttpClient.With<E2 | E, R>
  <E, R, B extends HttpClientResponse.HttpClientResponse, E2>(
    self: HttpClient.With<E, R>,
    refinement: Predicate.Refinement<NoInfer<HttpClientResponse.HttpClientResponse>, B>,
    orFailWith: (response: NoInfer<HttpClientResponse.HttpClientResponse>) => E2
  ): HttpClient.With<E2 | E, R>
  <E, R, E2>(
    self: HttpClient.With<E, R>,
    predicate: Predicate.Predicate<NoInfer<HttpClientResponse.HttpClientResponse>>,
    orFailWith: (response: NoInfer<HttpClientResponse.HttpClientResponse>) => E2
  ): HttpClient.With<E2 | E, R>
} = dual(3, (self, f, orFailWith) => transformResponse(self, Effect.filterOrFail(f, orFailWith)))

/**
 * Filters responses by HTTP status code.
 *
 * @since 4.0.0
 * @category filters
 */
export const filterStatus: {
  (f: (status: number) => boolean): <E, R>(self: HttpClient.With<E, R>) => HttpClient.With<E | Error.HttpClientError, R>
  <E, R>(self: HttpClient.With<E, R>, f: (status: number) => boolean): HttpClient.With<E | Error.HttpClientError, R>
} = dual(
  2,
  <E, R>(self: HttpClient.With<E, R>, f: (status: number) => boolean): HttpClient.With<E | Error.HttpClientError, R> =>
    transformResponse(self, Effect.flatMap(HttpClientResponse.filterStatus(f)))
)

/**
 * Filters responses that return a 2xx status code.
 *
 * @since 4.0.0
 * @category filters
 */
export const filterStatusOk: <E, R>(self: HttpClient.With<E, R>) => HttpClient.With<E | Error.HttpClientError, R> =
  transformResponse(Effect.flatMap(HttpClientResponse.filterStatusOk))

/**
 * @since 4.0.0
 * @category constructors
 */
export const makeWith = <E2, R2, E, R>(
  postprocess: (
    request: Effect.Effect<HttpClientRequest.HttpClientRequest, E2, R2>
  ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>,
  preprocess: HttpClient.Preprocess<E2, R2>
): HttpClient.With<E, R> => {
  const self = Object.create(Proto)
  self.preprocess = preprocess
  self.postprocess = postprocess
  self.execute = function(request: HttpClientRequest.HttpClientRequest) {
    return postprocess(preprocess(request))
  }
  return self
}

const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments)
  },
  ...Inspectable.BaseProto,
  toJSON() {
    return {
      _id: "effect/HttpClient"
    }
  },
  ...Object.fromEntries(
    HttpMethod.allShort.map((
      [fullMethod, method]
    ) => [method, function(this: HttpClient, url: string | URL, options?: HttpClientRequest.Options.NoUrl) {
      return this.execute(HttpClientRequest.make(fullMethod)(url, options))
    }])
  )
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const make = (
  f: (
    request: HttpClientRequest.HttpClientRequest,
    url: URL,
    signal: AbortSignal,
    fiber: Fiber<HttpClientResponse.HttpClientResponse, Error.HttpClientError>
  ) => Effect.Effect<HttpClientResponse.HttpClientResponse, Error.HttpClientError>
): HttpClient =>
  makeWith((effect) =>
    Effect.flatMap(effect, (request) =>
      Effect.withFiber((fiber) => {
        const scopedController = scopedRequests.get(request)
        const controller = scopedController ?? new AbortController()
        const urlResult = UrlParams.makeUrl(request.url, request.urlParams, request.hash)
        if (Result.isFailure(urlResult)) {
          return Effect.fail(
            new Error.HttpClientError({
              reason: new Error.InvalidUrlError({
                request,
                cause: urlResult.failure
              })
            })
          )
        }
        const url = urlResult.success
        const tracerDisabled = fiber.getRef(Tracer.DisablePropagation) ||
          fiber.getRef(TracerDisabledWhen)(request)
        if (tracerDisabled) {
          const effect = f(request, url, controller.signal, fiber as any)
          if (scopedController) return effect
          return Effect.uninterruptibleMask((restore) =>
            Effect.matchCauseEffect(restore(effect), {
              onSuccess(response) {
                responseRegistry.register(response, controller)
                return Effect.succeed(new InterruptibleResponse(response, controller))
              },
              onFailure(cause) {
                if (Cause.hasInterrupt(cause)) {
                  controller.abort()
                }
                return Effect.failCause(cause)
              }
            })
          )
        }
        return Effect.useSpan(
          fiber.getRef(SpanNameGenerator)(request),
          { kind: "client" },
          (span) => {
            span.attribute("http.request.method", request.method)
            span.attribute("server.address", url.origin)
            if (url.port !== "") {
              span.attribute("server.port", +url.port)
            }
            span.attribute("url.full", url.toString())
            span.attribute("url.path", url.pathname)
            span.attribute("url.scheme", url.protocol.slice(0, -1))
            const query = url.search.slice(1)
            if (query !== "") {
              span.attribute("url.query", query)
            }
            const redactedHeaderNames = fiber.getRef(Headers.CurrentRedactedNames)
            const redactedHeaders = Headers.redact(request.headers, redactedHeaderNames)
            for (const name in redactedHeaders) {
              span.attribute(`http.request.header.${name}`, String(redactedHeaders[name]))
            }
            request = fiber.getRef(TracerPropagationEnabled)
              ? HttpClientRequest.setHeaders(request, TraceContext.toHeaders(span))
              : request
            return Effect.uninterruptibleMask((restore) =>
              restore(f(request, url, controller.signal, fiber as any)).pipe(
                Effect.withParentSpan(span, { captureStackTrace: false }),
                Effect.matchCauseEffect({
                  onSuccess: (response) => {
                    span.attribute("http.response.status_code", response.status)
                    const redactedHeaders = Headers.redact(response.headers, redactedHeaderNames)
                    for (const name in redactedHeaders) {
                      span.attribute(`http.response.header.${name}`, String(redactedHeaders[name]))
                    }

                    if (scopedController) return Effect.succeed(response)
                    responseRegistry.register(response, controller)
                    return Effect.succeed(new InterruptibleResponse(response, controller))
                  },
                  onFailure(cause) {
                    if (!scopedController && Cause.hasInterrupt(cause)) {
                      controller.abort()
                    }
                    return Effect.failCause(cause)
                  }
                })
              )
            )
          }
        )
      })), Effect.succeed as HttpClient.Preprocess<never, never>)

/**
 * Appends a transformation of the request object before sending it.
 *
 * @since 4.0.0
 * @category mapping & sequencing
 */
export const mapRequest: {
  (
    f: (a: HttpClientRequest.HttpClientRequest) => HttpClientRequest.HttpClientRequest
  ): <E, R>(self: HttpClient.With<E, R>) => HttpClient.With<E, R>
  <E, R>(
    self: HttpClient.With<E, R>,
    f: (a: HttpClientRequest.HttpClientRequest) => HttpClientRequest.HttpClientRequest
  ): HttpClient.With<E, R>
} = dual(
  2,
  <E, R>(
    self: HttpClient.With<E, R>,
    f: (a: HttpClientRequest.HttpClientRequest) => HttpClientRequest.HttpClientRequest
  ): HttpClient.With<E, R> => makeWith(self.postprocess, (request) => Effect.map(self.preprocess(request), f))
)

/**
 * Appends an effectful transformation of the request object before sending it.
 *
 * @since 4.0.0
 * @category mapping & sequencing
 */
export const mapRequestEffect: {
  <E2, R2>(
    f: (a: HttpClientRequest.HttpClientRequest) => Effect.Effect<HttpClientRequest.HttpClientRequest, E2, R2>
  ): <E, R>(self: HttpClient.With<E, R>) => HttpClient.With<E | E2, R | R2>
  <E, R, E2, R2>(
    self: HttpClient.With<E, R>,
    f: (a: HttpClientRequest.HttpClientRequest) => Effect.Effect<HttpClientRequest.HttpClientRequest, E2, R2>
  ): HttpClient.With<E | E2, R | R2>
} = dual(
  2,
  <E, R, E2, R2>(
    self: HttpClient.With<E, R>,
    f: (a: HttpClientRequest.HttpClientRequest) => Effect.Effect<HttpClientRequest.HttpClientRequest, E2, R2>
  ): HttpClient.With<E | E2, R | R2> =>
    makeWith(self.postprocess as any, (request) => Effect.flatMap(self.preprocess(request), f))
)

/**
 * Prepends a transformation of the request object before sending it.
 *
 * @since 4.0.0
 * @category mapping & sequencing
 */
export const mapRequestInput: {
  (
    f: (a: HttpClientRequest.HttpClientRequest) => HttpClientRequest.HttpClientRequest
  ): <E, R>(self: HttpClient.With<E, R>) => HttpClient.With<E, R>
  <E, R>(
    self: HttpClient.With<E, R>,
    f: (a: HttpClientRequest.HttpClientRequest) => HttpClientRequest.HttpClientRequest
  ): HttpClient.With<E, R>
} = dual(
  2,
  <E, R>(
    self: HttpClient.With<E, R>,
    f: (a: HttpClientRequest.HttpClientRequest) => HttpClientRequest.HttpClientRequest
  ): HttpClient.With<E, R> => makeWith(self.postprocess, (request) => self.preprocess(f(request)))
)

/**
 * Prepends an effectful transformation of the request object before sending it.
 *
 * @since 4.0.0
 * @category mapping & sequencing
 */
export const mapRequestInputEffect: {
  <E2, R2>(
    f: (a: HttpClientRequest.HttpClientRequest) => Effect.Effect<HttpClientRequest.HttpClientRequest, E2, R2>
  ): <E, R>(self: HttpClient.With<E, R>) => HttpClient.With<E | E2, R | R2>
  <E, R, E2, R2>(
    self: HttpClient.With<E, R>,
    f: (a: HttpClientRequest.HttpClientRequest) => Effect.Effect<HttpClientRequest.HttpClientRequest, E2, R2>
  ): HttpClient.With<E | E2, R | R2>
} = dual(
  2,
  <E, R, E2, R2>(
    self: HttpClient.With<E, R>,
    f: (a: HttpClientRequest.HttpClientRequest) => Effect.Effect<HttpClientRequest.HttpClientRequest, E2, R2>
  ): HttpClient.With<E | E2, R | R2> =>
    makeWith(self.postprocess as any, (request) => Effect.flatMap(f(request), self.preprocess))
)

/**
 * @since 4.0.0
 * @category error handling
 */
export declare namespace Retry {
  /**
   * @since 4.0.0
   * @category error handling
   */
  export type Return<R, E, O extends NoExcessProperties<Effect.Retry.Options<E>, O>> = HttpClient.With<
    | (O extends { schedule: Schedule.Schedule<infer _O, infer _I, infer _E, infer _R> } ? E | _E
      : O extends { until: Predicate.Refinement<E, infer E2> } ? E2
      : E)
    | (O extends { while: (...args: Array<any>) => Effect.Effect<infer _A, infer E, infer _R> } ? E : never)
    | (O extends { until: (...args: Array<any>) => Effect.Effect<infer _A, infer E, infer _R> } ? E : never),
    | R
    | (O extends { schedule: Schedule.Schedule<infer _O, infer _I, infer _E, infer R> } ? R : never)
    | (O extends { while: (...args: Array<any>) => Effect.Effect<infer _A, infer _E, infer R> } ? R : never)
    | (O extends { until: (...args: Array<any>) => Effect.Effect<infer _A, infer _E, infer R> } ? R : never)
  > extends infer Z ? Z : never
}

/**
 * Retries the request based on a provided schedule or policy.
 *
 * @since 4.0.0
 * @category error handling
 */
export const retry: {
  <E, O extends NoExcessProperties<Effect.Retry.Options<E>, O>>(
    options: O
  ): <R>(self: HttpClient.With<E, R>) => Retry.Return<R, E, O>
  <B, E, ES, R1>(
    policy: Schedule.Schedule<B, NoInfer<E>, ES, R1>
  ): <R>(self: HttpClient.With<E, R>) => HttpClient.With<E | ES, R1 | R>
  <E, R, O extends NoExcessProperties<Effect.Retry.Options<E>, O>>(
    self: HttpClient.With<E, R>,
    options: O
  ): Retry.Return<R, E, O>
  <E, R, B, ES, R1>(
    self: HttpClient.With<E, R>,
    policy: Schedule.Schedule<B, E, ES, R1>
  ): HttpClient.With<E | ES, R1 | R>
} = dual(
  2,
  <E extends E0, E0, ES, R, R1, B>(
    self: HttpClient.With<E, R>,
    policy: Schedule.Schedule<B, E0, ES, R1>
  ): HttpClient.With<E | ES, R | R1> => transformResponse(self, Effect.retry(policy))
)

/**
 * Retries common transient errors, such as rate limiting, timeouts or network issues.
 *
 * Use `mode` to focus on retrying errors, transient responses, or both.
 *
 * Specifying a `while` predicate allows you to consider other errors as
 * transient, and is ignored in "response-only" mode.
 *
 * @since 4.0.0
 * @category error handling
 */
export const retryTransient: {
  <
    B,
    E,
    ES = never,
    R1 = never,
    const Mode extends "errors-only" | "response-only" | "both" = never,
    Input = "errors-only" extends Mode ? E
      : "response-only" extends Mode ? HttpClientResponse.HttpClientResponse
      : HttpClientResponse.HttpClientResponse | E
  >(
    options: {
      readonly mode?: Mode | undefined
      readonly while?: Predicate.Predicate<NoInfer<E | ES>>
      readonly schedule?: Schedule.Schedule<B, NoInfer<Input>, ES, R1>
      readonly times?: number
    } | Schedule.Schedule<B, NoInfer<Input>, ES, R1>
  ): <R>(self: HttpClient.With<E, R>) => HttpClient.With<E | ES, R1 | R>
  <
    E,
    R,
    B,
    ES = never,
    R1 = never,
    const Mode extends "errors-only" | "response-only" | "both" = never,
    Input = "errors-only" extends Mode ? E
      : "response-only" extends Mode ? HttpClientResponse.HttpClientResponse
      : HttpClientResponse.HttpClientResponse | E
  >(
    self: HttpClient.With<E, R>,
    options: {
      readonly mode?: Mode | undefined
      readonly while?: Predicate.Predicate<NoInfer<E | ES>>
      readonly schedule?: Schedule.Schedule<B, NoInfer<Input>, ES, R1>
      readonly times?: number
    } | Schedule.Schedule<B, NoInfer<Input>, ES, R1>
  ): HttpClient.With<E | ES, R1 | R>
} = dual(
  2,
  <
    E,
    R,
    B,
    ES = never,
    R1 = never
  >(
    self: HttpClient.With<E, R>,
    options: {
      readonly mode?: "errors-only" | "response-only" | "both" | undefined
      readonly while?: Predicate.Predicate<E | ES>
      readonly schedule?: Schedule.Schedule<B, any, ES, R1>
      readonly times?: number
    } | Schedule.Schedule<B, any, ES, R1>
  ): HttpClient.With<E | ES, R1 | R> => {
    const isOnlySchedule = Schedule.isSchedule(options)
    const mode = isOnlySchedule ? "both" : options.mode ?? "both"
    const schedule = isOnlySchedule ? options : options.schedule
    const passthroughSchedule = schedule && Schedule.passthrough(schedule)
    const times = isOnlySchedule ? undefined : options.times
    return transformResponse(
      self,
      flow(
        mode === "errors-only" ? identity : Effect.repeat({
          schedule: passthroughSchedule!,
          times,
          while: isTransientResponse
        }),
        mode === "response-only" ? identity : Effect.retry({
          while: isOnlySchedule || options.while === undefined
            ? isTransientError
            : Predicate.or(isTransientError, options.while),
          schedule,
          times
        })
      )
    )
  }
)

/**
 * Performs an additional effect after a successful request.
 *
 * @since 4.0.0
 * @category mapping & sequencing
 */
export const tap: {
  <_, E2, R2>(
    f: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<_, E2, R2>
  ): <E, R>(self: HttpClient.With<E, R>) => HttpClient.With<E | E2, R | R2>
  <E, R, _, E2, R2>(
    self: HttpClient.With<E, R>,
    f: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<_, E2, R2>
  ): HttpClient.With<E | E2, R | R2>
} = dual(
  2,
  <E, R, _, E2, R2>(
    self: HttpClient.With<E, R>,
    f: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<_, E2, R2>
  ): HttpClient.With<E | E2, R | R2> => transformResponse(self, Effect.tap(f))
)

/**
 * Performs an additional effect after an unsuccessful request.
 *
 * @since 4.0.0
 * @category mapping & sequencing
 */
export const tapError: {
  <_, E, E2, R2>(
    f: (e: NoInfer<E>) => Effect.Effect<_, E2, R2>
  ): <R>(self: HttpClient.With<E, R>) => HttpClient.With<E | E2, R | R2>
  <E, R, _, E2, R2>(
    self: HttpClient.With<E, R>,
    f: (e: NoInfer<E>) => Effect.Effect<_, E2, R2>
  ): HttpClient.With<E | E2, R | R2>
} = dual(
  2,
  <E, R, _, E2, R2>(
    self: HttpClient.With<E, R>,
    f: (e: NoInfer<E>) => Effect.Effect<_, E2, R2>
  ): HttpClient.With<E | E2, R | R2> => transformResponse(self, Effect.tapError(f))
)

/**
 * Performs an additional effect on the request before sending it.
 *
 * @since 4.0.0
 * @category mapping & sequencing
 */
export const tapRequest: {
  <_, E2, R2>(
    f: (a: HttpClientRequest.HttpClientRequest) => Effect.Effect<_, E2, R2>
  ): <E, R>(self: HttpClient.With<E, R>) => HttpClient.With<E | E2, R | R2>
  <E, R, _, E2, R2>(
    self: HttpClient.With<E, R>,
    f: (a: HttpClientRequest.HttpClientRequest) => Effect.Effect<_, E2, R2>
  ): HttpClient.With<E | E2, R | R2>
} = dual(
  2,
  <E, R, _, E2, R2>(
    self: HttpClient.With<E, R>,
    f: (a: HttpClientRequest.HttpClientRequest) => Effect.Effect<_, E2, R2>
  ): HttpClient.With<E | E2, R | R2> =>
    makeWith(self.postprocess as any, (request) => Effect.tap(self.preprocess(request), f))
)

/**
 * Associates a `Ref` of cookies with the client for handling cookies across requests.
 *
 * @since 4.0.0
 * @category cookies
 */
export const withCookiesRef: {
  (ref: Ref.Ref<Cookies.Cookies>): <E, R>(self: HttpClient.With<E, R>) => HttpClient.With<E, R>
  <E, R>(self: HttpClient.With<E, R>, ref: Ref.Ref<Cookies.Cookies>): HttpClient.With<E, R>
} = dual(
  2,
  <E, R>(
    self: HttpClient.With<E, R>,
    ref: Ref.Ref<Cookies.Cookies>
  ): HttpClient.With<E, R> =>
    makeWith(
      (request: Effect.Effect<HttpClientRequest.HttpClientRequest, E, R>) =>
        Effect.tap(
          self.postprocess(request),
          (response) => Ref.update(ref, (cookies) => Cookies.merge(cookies, response.cookies))
        ),
      (request) =>
        Effect.flatMap(self.preprocess(request), (request) =>
          Effect.map(
            Ref.get(ref),
            (cookies) =>
              Cookies.isEmpty(cookies)
                ? request
                : HttpClientRequest.setHeader(request, "cookie", Cookies.toCookieHeader(cookies))
          ))
    )
)

/**
 * Ties the lifetime of the `HttpClientRequest` to a `Scope`.
 *
 * @since 4.0.0
 * @category Scope
 */
export const withScope = <E, R>(
  self: HttpClient.With<E, R>
): HttpClient.With<E, R | Scope.Scope> =>
  transform(
    self,
    (effect, request) => {
      const controller = new AbortController()
      scopedRequests.set(request, controller)
      return Effect.andThen(
        Effect.addFinalizer(() => Effect.sync(() => controller.abort())),
        effect
      )
    }
  )

/**
 * Follows HTTP redirects up to a specified number of times.
 *
 * @since 4.0.0
 * @category redirects
 */
export const followRedirects: {
  (maxRedirects?: number | undefined): <E, R>(self: HttpClient.With<E, R>) => HttpClient.With<E, R>
  <E, R>(self: HttpClient.With<E, R>, maxRedirects?: number | undefined): HttpClient.With<E, R>
} = dual((args) => isHttpClient(args[0]), <E, R>(
  self: HttpClient.With<E, R>,
  maxRedirects?: number | undefined
): HttpClient.With<E, R> =>
  makeWith(
    (request) => {
      const loop = (
        request: HttpClientRequest.HttpClientRequest,
        redirects: number
      ): Effect.Effect<HttpClientResponse.HttpClientResponse, E, R> =>
        Effect.flatMap(
          self.postprocess(Effect.succeed(request)),
          (response) =>
            response.status >= 300 && response.status < 400 && response.headers.location &&
              redirects < (maxRedirects ?? 10)
              ? loop(
                HttpClientRequest.setUrl(
                  request,
                  new URL(response.headers.location, response.request.url)
                ),
                redirects + 1
              )
              : Effect.succeed(response)
        )
      return Effect.flatMap(request, (request) => loop(request, 0))
    },
    self.preprocess
  ))

/**
 * @since 4.0.0
 * @category References
 */
export const TracerDisabledWhen = ServiceMap.Reference<
  Predicate.Predicate<HttpClientRequest.HttpClientRequest>
>("effect/http/HttpClient/TracerDisabledWhen", {
  defaultValue: () => constFalse
})

/**
 * @since 4.0.0
 * @category References
 */
export const TracerPropagationEnabled = ServiceMap.Reference<boolean>("effect/HttpClient/TracerPropagationEnabled", {
  defaultValue: constTrue
})

/**
 * @since 4.0.0
 * @category References
 */
export const SpanNameGenerator = ServiceMap.Reference<
  (request: HttpClientRequest.HttpClientRequest) => string
>("effect/http/HttpClient/SpanNameGenerator", {
  defaultValue: () => (request) => `http.client ${request.method}`
})

/**
 * @since 4.0.0
 */
export const layerMergedServices = <E, R>(
  effect: Effect.Effect<HttpClient, E, R>
): Layer.Layer<HttpClient, E, R> =>
  Layer.effect(HttpClient)(
    Effect.servicesWith((services: ServiceMap.ServiceMap<never>) =>
      Effect.map(effect, (client) =>
        transformResponse(
          client,
          Effect.updateServices((input: ServiceMap.ServiceMap<never>) => ServiceMap.merge(services, input))
        ))
    )
  )

// -----------------------------------------------------------------------------
// internal
// -----------------------------------------------------------------------------

const responseRegistry = (() => {
  if ("FinalizationRegistry" in globalThis && globalThis.FinalizationRegistry) {
    const registry = new FinalizationRegistry((controller: AbortController) => {
      controller.abort()
    })
    return {
      register(response: HttpClientResponse.HttpClientResponse, controller: AbortController) {
        registry.register(response, controller, response)
      },
      unregister(response: HttpClientResponse.HttpClientResponse) {
        registry.unregister(response)
      }
    }
  }

  const timers = new Map<HttpClientResponse.HttpClientResponse, any>()
  return {
    register(response: HttpClientResponse.HttpClientResponse, controller: AbortController) {
      timers.set(response, setTimeout(() => controller.abort(), 5000))
    },
    unregister(response: HttpClientResponse.HttpClientResponse) {
      const timer = timers.get(response)
      if (timer === undefined) return
      clearTimeout(timer)
      timers.delete(response)
    }
  }
})()

const scopedRequests = new WeakMap<HttpClientRequest.HttpClientRequest, AbortController>()

class InterruptibleResponse implements HttpClientResponse.HttpClientResponse {
  readonly original: HttpClientResponse.HttpClientResponse
  readonly controller: AbortController

  constructor(
    original: HttpClientResponse.HttpClientResponse,
    controller: AbortController
  ) {
    this.original = original
    this.controller = controller
  }

  readonly [HttpClientResponse.TypeId] = HttpClientResponse.TypeId
  readonly [HttpIncomingMessage.TypeId] = HttpIncomingMessage.TypeId

  private applyInterrupt<A, E, R>(effect: Effect.Effect<A, E, R>) {
    return Effect.suspend(() => {
      responseRegistry.unregister(this.original)
      return Effect.onInterrupt(
        effect,
        Effect.sync(() => {
          this.controller.abort()
        })
      )
    })
  }

  get request() {
    return this.original.request
  }

  get status() {
    return this.original.status
  }

  get headers() {
    return this.original.headers
  }

  get cookies() {
    return this.original.cookies
  }

  get remoteAddress() {
    return this.original.remoteAddress
  }

  get formData() {
    return this.applyInterrupt(this.original.formData)
  }

  get text() {
    return this.applyInterrupt(this.original.text)
  }

  get json() {
    return this.applyInterrupt(this.original.json)
  }

  get urlParamsBody() {
    return this.applyInterrupt(this.original.urlParamsBody)
  }

  get arrayBuffer() {
    return this.applyInterrupt(this.original.arrayBuffer)
  }

  get stream() {
    return Stream.suspend(() => {
      responseRegistry.unregister(this.original)
      return Stream.onExit(this.original.stream, (exit) => {
        if (Exit.hasInterrupt(exit)) {
          this.controller.abort()
        }
        return Effect.void
      })
    })
  }

  toJSON() {
    return this.original.toJSON()
  }

  [Inspectable.NodeInspectSymbol]() {
    return this.original[Inspectable.NodeInspectSymbol]()
  }
}

const isTransientError = (error: unknown) => Cause.isTimeoutError(error) || isTransientHttpError(error)

const isTransientHttpError = (error: unknown) =>
  Error.isHttpClientError(error) &&
  (error.reason._tag === "TransportError" ||
    (error.reason._tag === "StatusCodeError" && isTransientResponse(error.reason.response)))

const transientStatuses = new Set([
  408,
  429,
  500,
  502,
  503,
  504
])
const isTransientResponse = (response: HttpClientResponse.HttpClientResponse) => transientStatuses.has(response.status)
