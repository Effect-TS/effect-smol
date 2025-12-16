/**
 * @since 4.0.0
 */
import { Clock } from "../../Clock.ts"
import * as Effect from "../../Effect.ts"
import { constant, constFalse } from "../../Function.ts"
import * as internalEffect from "../../internal/effect.ts"
import * as Layer from "../../Layer.ts"
import type { Predicate } from "../../Predicate.ts"
import type { ReadonlyRecord } from "../../Record.ts"
import { TracerEnabled } from "../../References.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import { ParentSpan } from "../../Tracer.ts"
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
    const request = ServiceMap.getUnsafe(fiber.services, HttpServerRequest)
    return Effect.withLogSpan(
      Effect.flatMap(Effect.exit(httpApp), (exit) => {
        if (fiber.getRef(LoggerDisabled)) {
          return exit
        } else if (exit._tag === "Failure") {
          const [response, cause] = causeResponseStripped(exit.cause)
          return Effect.andThen(
            Effect.annotateLogs(Effect.log(cause ?? "Sent HTTP Response"), {
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
    const request = ServiceMap.getUnsafe(fiber.services, HttpServerRequest)
    const disabled = !fiber.getRef(TracerEnabled) || fiber.getRef(TracerDisabledWhen)(request)
    if (disabled) {
      return httpApp
    }
    const nameGenerator = fiber.getRef(SpanNameGenerator)
    const span = internalEffect.makeSpanUnsafe(fiber, nameGenerator(request), {
      parent: TraceContext.fromHeaders(request.headers),
      kind: "server"
    })
    const prevSpan = ServiceMap.getOption(fiber.services, ParentSpan)
    fiber.setServices(ServiceMap.add(fiber.services, ParentSpan, span))
    return Effect.onExitInterruptible(httpApp, (exit) => {
      fiber.setServices(ServiceMap.addOrOmit(fiber.services, ParentSpan, prevSpan))
      const endTime = fiber.getRef(Clock).currentTimeNanosUnsafe()
      fiber.currentScheduler.scheduleTask(() => {
        const url = Request.toURL(request)
        if (url !== undefined && (url.username !== "" || url.password !== "")) {
          url.username = "REDACTED"
          url.password = "REDACTED"
        }
        const redactedHeaderNames = fiber.getRef(Headers.CurrentRedactedNames)
        const requestHeaders = Headers.redact(request.headers, redactedHeaderNames)
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
        for (const name in requestHeaders) {
          span.attribute(`http.request.header.${name}`, String(requestHeaders[name]))
        }
        if (request.remoteAddress !== undefined) {
          span.attribute("client.address", request.remoteAddress)
        }
        const response = exitResponse(exit)
        span.attribute("http.response.status_code", response.status)
        const responseHeaders = Headers.redact(response.headers, redactedHeaderNames)
        for (const name in responseHeaders) {
          span.attribute(`http.response.header.${name}`, String(responseHeaders[name]))
        }
        span.end(endTime, exit)
      }, 0)
    })
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
    const request = ServiceMap.getUnsafe(services, HttpServerRequest)
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
  readonly allowedOrigins?: ReadonlyArray<string> | Predicate<string> | undefined
  readonly allowedMethods?: ReadonlyArray<string> | undefined
  readonly allowedHeaders?: ReadonlyArray<string> | undefined
  readonly exposedHeaders?: ReadonlyArray<string> | undefined
  readonly maxAge?: number | undefined
  readonly credentials?: boolean | undefined
}): <E, R>(
  httpApp: Effect.Effect<HttpServerResponse, E, R>
) => Effect.Effect<HttpServerResponse, E, R | HttpServerRequest> => {
  const opts = {
    allowedOrigins: options?.allowedOrigins ?? [],
    allowedMethods: options?.allowedMethods ?? ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    allowedHeaders: options?.allowedHeaders ?? [],
    exposedHeaders: options?.exposedHeaders ?? [],
    credentials: options?.credentials ?? false,
    maxAge: options?.maxAge
  }

  const isAllowedOrigin = typeof opts.allowedOrigins === "function"
    ? opts.allowedOrigins
    : (origin: string) => (opts.allowedOrigins as ReadonlyArray<string>).includes(origin)

  const allowOrigin = typeof opts.allowedOrigins === "function" || opts.allowedOrigins.length > 1
    ? ((originHeader: string) => {
      if (!isAllowedOrigin(originHeader)) return undefined
      return {
        "access-control-allow-origin": originHeader,
        vary: "Origin"
      }
    })
    : opts.allowedOrigins.length === 0
    ? constant({
      "access-control-allow-origin": "*"
    })
    : constant({
      "access-control-allow-origin": opts.allowedOrigins[0],
      vary: "Origin"
    })

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
    return Headers.fromRecordUnsafe({
      ...allowOrigin(origin),
      ...allowCredentials,
      ...exposeHeaders
    })
  }

  const headersFromRequestOptions = (request: HttpServerRequest) => {
    const origin = request.headers["origin"]
    const accessControlRequestHeaders = request.headers["access-control-request-headers"]
    return Headers.fromRecordUnsafe({
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
      const request = ServiceMap.getUnsafe(fiber.services, HttpServerRequest)
      if (request.method === "OPTIONS") {
        return Effect.succeed(Response.empty({
          status: 204,
          headers: headersFromRequestOptions(request)
        }))
      }
      const prev = fiber.getRef(PreResponseHandlers)
      const next = prev
        ? ((req: HttpServerRequest, res: HttpServerResponse) =>
          Effect.flatMap(prev(req, res), (res) => preResponseHandler(req, res)))
        : preResponseHandler
      fiber.setServices(ServiceMap.add(fiber.services, PreResponseHandlers, next))
      return httpApp
    })
}

const PreResponseHandlers = ServiceMap.Reference<PreResponseHandler | undefined>(
  "effect/http/HttpEffect/PreResponseHandlers",
  { defaultValue: () => undefined }
)
