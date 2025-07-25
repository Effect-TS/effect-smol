/**
 * @since 4.0.0
 */
import * as Effect from "effect/Effect"
import * as Option from "../../data/Option.ts"
import type { Predicate } from "../../data/Predicate.ts"
import type { ReadonlyRecord } from "../../data/Record.ts"
import { constFalse } from "../../Function.ts"
import * as Layer from "../../Layer.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Headers from "./Headers.ts"
import type { PreResponseHandler } from "./HttpEffect.ts"
import { causeResponseStripped, exitResponse } from "./HttpServerError.ts"
import { HttpServerRequest } from "./HttpServerRequest.ts"
import * as Request from "./HttpServerRequest.ts"
import * as Response from "./HttpServerResponse.ts"
import type { HttpServerResponse } from "./HttpServerResponse.ts"
import * as TraceContext from "./HttpTraceContext.ts"

/**
 * @since 4.0.0
 * @category models
 */
export interface HttpMiddleware {
  <E, R>(self: Effect.Effect<HttpServerResponse, E, R | HttpServerRequest>): Effect.Effect<HttpServerResponse, any, any>
}

/**
 * @since 4.0.0
 */
export declare namespace HttpMiddleware {
  /**
   * @since 4.0.0
   */
  export interface Applied<A extends Effect.Effect<HttpServerResponse, any, any>, E, R> {
    (self: Effect.Effect<HttpServerResponse, E, R>): A
  }
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const make = <M extends HttpMiddleware>(middleware: M): M => middleware

/**
 * @since 4.0.0
 * @category Logger
 */
export const LoggerDisabled = ServiceMap.Reference<boolean>("effect/http/HttpMiddleware/LoggerDisabled", {
  defaultValue: constFalse
})

/**
 * @since 4.0.0
 * @category Logger
 */
export const withLoggerDisabled = <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.withFiber((fiber) => {
    fiber.setServices(ServiceMap.add(fiber.services, LoggerDisabled, true))
    return self
  })

/**
 * @since 4.0.0
 * @category Tracer
 */
export const TracerDisabledWhen = ServiceMap.Reference<Predicate<HttpServerRequest>>(
  "effect/http/HttpMiddleware/TracerDisabledWhen",
  { defaultValue: () => constFalse }
)

/**
 * @since 4.0.0
 * @category Tracer
 */
export const layerTracerDisabledForUrls = (
  urls: ReadonlyArray<string>
): Layer.Layer<never> => Layer.succeed(TracerDisabledWhen)((req) => urls.includes(req.url))

/**
 * @since 4.0.0
 * @category Tracer
 */
export const SpanNameGenerator = ServiceMap.Reference<(request: HttpServerRequest) => string>(
  "@effect/platform/HttpMiddleware/SpanNameGenerator",
  { defaultValue: () => (request) => `http.server ${request.method}` }
)

/**
 * @since 4.0.0
 * @category Logger
 */
export const logger: <E, R>(
  httpApp: Effect.Effect<HttpServerResponse, E, HttpServerRequest | R>
) => Effect.Effect<HttpServerResponse, E, HttpServerRequest | R> = make((httpApp) => {
  let counter = 0
  return Effect.withFiber((fiber) => {
    const request = ServiceMap.unsafeGet(fiber.services, HttpServerRequest)
    return Effect.withLogSpan(
      Effect.flatMap(Effect.exit(httpApp), (exit) => {
        if (fiber.getRef(LoggerDisabled)) {
          return exit
        } else if (exit._tag === "Failure") {
          const [response, cause] = causeResponseStripped(exit.cause)
          return Effect.andThen(
            Effect.annotateLogs(Effect.log(cause._tag === "Some" ? cause.value : "Sent HTTP Response"), {
              "http.method": request.method,
              "http.url": request.url,
              "http.status": response.status
            }),
            exit
          )
        }
        return Effect.andThen(
          Effect.annotateLogs(Effect.log("Sent HTTP response"), {
            "http.method": request.method,
            "http.url": request.url,
            "http.status": exit.value.status
          }),
          exit
        )
      }),
      `http.span.${++counter}`
    )
  })
})

/**
 * @since 4.0.0
 * @category Tracer
 */
export const tracer: <E, R>(
  httpApp: Effect.Effect<HttpServerResponse, E, HttpServerRequest | R>
) => Effect.Effect<HttpServerResponse, E, HttpServerRequest | R> = make((httpApp) =>
  Effect.withFiber((fiber) => {
    const request = ServiceMap.unsafeGet(fiber.services, HttpServerRequest)
    const disabled = fiber.getRef(TracerDisabledWhen)(request)
    if (disabled) {
      return httpApp
    }
    const url = Option.getOrUndefined(Request.toURL(request))
    if (url !== undefined && (url.username !== "" || url.password !== "")) {
      url.username = "REDACTED"
      url.password = "REDACTED"
    }
    const redactedHeaderNames = fiber.getRef(Headers.CurrentRedactedNames)
    const redactedHeaders = Headers.redact(request.headers, redactedHeaderNames)
    const nameGenerator = fiber.getRef(SpanNameGenerator)
    return Effect.useSpan(
      nameGenerator(request),
      {
        parent: Option.getOrUndefined(TraceContext.fromHeaders(request.headers)),
        kind: "server",
        captureStackTrace: false
      },
      (span) => {
        span.attribute("http.request.method", request.method)
        if (url !== undefined) {
          span.attribute("url.full", url.toString())
          span.attribute("url.path", url.pathname)
          const query = url.search.slice(1)
          if (query !== "") {
            span.attribute("url.query", url.search.slice(1))
          }
          span.attribute("url.scheme", url.protocol.slice(0, -1))
        }
        if (request.headers["user-agent"] !== undefined) {
          span.attribute("user_agent.original", request.headers["user-agent"])
        }
        for (const name in redactedHeaders) {
          span.attribute(`http.request.header.${name}`, String(redactedHeaders[name]))
        }
        if (request.remoteAddress._tag === "Some") {
          span.attribute("client.address", request.remoteAddress.value)
        }
        return Effect.onExitInterruptible(Effect.withParentSpan(httpApp, span), (exit) => {
          const response = exitResponse(exit)
          span.attribute("http.response.status_code", response.status)
          const redactedHeaders = Headers.redact(response.headers, redactedHeaderNames)
          for (const name in redactedHeaders) {
            span.attribute(`http.response.header.${name}`, String(redactedHeaders[name]))
          }
          return Effect.void
        })
      }
    )
  })
)

/**
 * @since 4.0.0
 * @category Proxying
 */
export const xForwardedHeaders = make((httpApp) =>
  Effect.updateService(httpApp, HttpServerRequest, (request) =>
    request.headers["x-forwarded-host"]
      ? request.modify({
        headers: Headers.set(
          request.headers,
          "host",
          request.headers["x-forwarded-host"]
        ),
        remoteAddress: request.headers["x-forwarded-for"]?.split(",")[0].trim()
      })
      : request)
)

/**
 * @since 4.0.0
 * @category Search params
 */
export const searchParamsParser = <E, R>(
  httpApp: Effect.Effect<HttpServerResponse, E, R>
): Effect.Effect<Response.HttpServerResponse, E, HttpServerRequest | Exclude<R, Request.ParsedSearchParams>> =>
  Effect.withFiber((fiber) => {
    const services = fiber.services
    const request = ServiceMap.unsafeGet(services, HttpServerRequest)
    const params = Request.searchParamsFromURL(new URL(request.originalUrl))
    return Effect.provideService(
      httpApp,
      Request.ParsedSearchParams,
      params
    ) as any
  })

/**
 * @since 4.0.0
 * @category CORS
 */
export const cors = (options?: {
  readonly allowedOrigins?: ReadonlyArray<string> | undefined
  readonly allowedMethods?: ReadonlyArray<string> | undefined
  readonly allowedHeaders?: ReadonlyArray<string> | undefined
  readonly exposedHeaders?: ReadonlyArray<string> | undefined
  readonly maxAge?: number | undefined
  readonly credentials?: boolean | undefined
}): <E, R>(
  httpApp: Effect.Effect<HttpServerResponse, E, R>
) => Effect.Effect<HttpServerResponse, E, R | HttpServerRequest> => {
  const opts = {
    allowedOrigins: options?.allowedOrigins ?? ["*"],
    allowedMethods: options?.allowedMethods ?? ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    allowedHeaders: options?.allowedHeaders ?? [],
    exposedHeaders: options?.exposedHeaders ?? [],
    credentials: options?.credentials ?? false,
    maxAge: options?.maxAge
  }

  const isAllowedOrigin = (origin: string) => opts.allowedOrigins.includes(origin)

  const allowOrigin = (originHeader: string): ReadonlyRecord<string, string> | undefined => {
    if (opts.allowedOrigins.length === 0) {
      return { "access-control-allow-origin": "*" }
    }

    if (opts.allowedOrigins.length === 1) {
      return {
        "access-control-allow-origin": opts.allowedOrigins[0],
        vary: "Origin"
      }
    }

    if (isAllowedOrigin(originHeader)) {
      return {
        "access-control-allow-origin": originHeader,
        vary: "Origin"
      }
    }

    return undefined
  }

  const allowMethods = opts.allowedMethods.length > 0
    ? { "access-control-allow-methods": opts.allowedMethods.join(", ") }
    : undefined

  const allowCredentials = opts.credentials
    ? { "access-control-allow-credentials": "true" }
    : undefined

  const allowHeaders = (
    accessControlRequestHeaders: string | undefined
  ): ReadonlyRecord<string, string> | undefined => {
    if (opts.allowedHeaders.length === 0 && accessControlRequestHeaders) {
      return {
        vary: "Access-Control-Request-Headers",
        "access-control-allow-headers": accessControlRequestHeaders
      }
    }

    if (opts.allowedHeaders) {
      return {
        "access-control-allow-headers": opts.allowedHeaders.join(",")
      }
    }

    return undefined
  }

  const exposeHeaders = opts.exposedHeaders.length > 0
    ? { "access-control-expose-headers": opts.exposedHeaders.join(",") }
    : undefined

  const maxAge = opts.maxAge
    ? { "access-control-max-age": opts.maxAge.toString() }
    : undefined

  const headersFromRequest = (request: HttpServerRequest) => {
    const origin = request.headers["origin"]
    return Headers.unsafeFromRecord({
      ...allowOrigin(origin),
      ...allowCredentials,
      ...exposeHeaders
    })
  }

  const headersFromRequestOptions = (request: HttpServerRequest) => {
    const origin = request.headers["origin"]
    const accessControlRequestHeaders = request.headers["access-control-request-headers"]
    return Headers.unsafeFromRecord({
      ...allowOrigin(origin),
      ...allowCredentials,
      ...exposeHeaders,
      ...allowMethods,
      ...allowHeaders(accessControlRequestHeaders),
      ...maxAge
    })
  }

  const preResponseHandler = (request: HttpServerRequest, response: HttpServerResponse) =>
    Effect.succeed(Response.setHeaders(response, headersFromRequest(request)))

  return <E, R>(
    httpApp: Effect.Effect<HttpServerResponse, E, R>
  ): Effect.Effect<HttpServerResponse, E, R | HttpServerRequest> =>
    Effect.withFiber((fiber) => {
      const request = ServiceMap.unsafeGet(fiber.services, HttpServerRequest)
      if (request.method === "OPTIONS") {
        return Effect.succeed(Response.empty({
          status: 204,
          headers: headersFromRequestOptions(request)
        }))
      }
      const o = Option.match(fiber.getRef(PreResponseHandlers), {
        onNone: () => Option.some(preResponseHandler),
        onSome: (prev) =>
          Option.some<PreResponseHandler>((request, response) =>
            Effect.flatMap(prev(request, response), (response) => preResponseHandler(request, response))
          )
      })
      fiber.setServices(ServiceMap.add(fiber.services, PreResponseHandlers, o))
      return httpApp
    })
}

const PreResponseHandlers = ServiceMap.Reference<Option.Option<PreResponseHandler>>(
  "effect/http/HttpEffect/PreResponseHandlers",
  { defaultValue: Option.none }
)
