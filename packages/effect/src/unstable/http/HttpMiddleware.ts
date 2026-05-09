/**
 * @since 4.0.0
 */
import { Clock } from "../../Clock.ts"
import * as Context from "../../Context.ts"
import * as Effect from "../../Effect.ts"
import { constant, constFalse } from "../../Function.ts"
import * as internalEffect from "../../internal/effect.ts"
import * as Layer from "../../Layer.ts"
import * as Option from "../../Option.ts"
import type { Predicate } from "../../Predicate.ts"
import type { ReadonlyRecord } from "../../Record.ts"
import { TracerEnabled } from "../../References.ts"
import * as Stream from "../../Stream.ts"
import { ParentSpan } from "../../Tracer.ts"
import * as Headers from "./Headers.ts"
import * as HttpBody from "./HttpBody.ts"
import { causeResponseStripped, exitResponse } from "./HttpServerError.ts"
import { HttpServerRequest } from "./HttpServerRequest.ts"
import * as Request from "./HttpServerRequest.ts"
import * as Response from "./HttpServerResponse.ts"
import type { HttpServerResponse } from "./HttpServerResponse.ts"
import * as TraceContext from "./HttpTraceContext.ts"
import { appendPreResponseHandlerUnsafe } from "./internal/preResponseHandler.ts"

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

const loggerDisabledRequests = new WeakSet<object>()

const stripSearchAndHash = (url: string): string => {
  const queryIndex = url.indexOf("?")
  const hashIndex = url.indexOf("#")

  if (queryIndex === -1) {
    return hashIndex === -1 ? url : url.slice(0, hashIndex)
  }
  if (hashIndex === -1) {
    return url.slice(0, queryIndex)
  }
  return url.slice(0, Math.min(queryIndex, hashIndex))
}

/**
 * @since 4.0.0
 * @category Logger
 */
export const withLoggerDisabled = <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E, R | HttpServerRequest> =>
  Effect.withFiber((fiber) => {
    const request = Context.getUnsafe(fiber.context, HttpServerRequest)
    loggerDisabledRequests.add(request.source)
    return self
  })

/**
 * @since 4.0.0
 * @category Tracer
 */
export const TracerDisabledWhen = Context.Reference<Predicate<HttpServerRequest>>(
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
export const SpanNameGenerator = Context.Reference<(request: HttpServerRequest) => string>(
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
    const request = Context.getUnsafe(fiber.context, HttpServerRequest)
    const path = stripSearchAndHash(request.url)
    return Effect.withLogSpan(
      Effect.flatMap(Effect.exit(httpApp), (exit) => {
        if (loggerDisabledRequests.has(request.source)) {
          return exit
        } else if (exit._tag === "Failure") {
          const [response, cause] = causeResponseStripped(exit.cause)
          return Effect.andThen(
            Effect.annotateLogs(Effect.log(Option.getOrElse(cause, () => "Sent HTTP Response")), {
              "http.method": request.method,
              "http.url": path,
              "http.status": response.status
            }),
            exit
          )
        }
        return Effect.andThen(
          Effect.annotateLogs(Effect.log("Sent HTTP response"), {
            "http.method": request.method,
            "http.url": path,
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
    const request = Context.getUnsafe(fiber.context, HttpServerRequest)
    const disabled = !fiber.getRef(TracerEnabled) || fiber.getRef(TracerDisabledWhen)(request)
    if (disabled) {
      return httpApp
    }
    const nameGenerator = fiber.getRef(SpanNameGenerator)
    const span = internalEffect.makeSpanUnsafe(fiber, nameGenerator(request), {
      parent: Option.getOrUndefined(TraceContext.fromHeaders(request.headers)),
      kind: "server"
    })
    const prevServices = fiber.context
    fiber.setContext(Context.add(fiber.context, ParentSpan, span))
    return Effect.onExitPrimitive(httpApp, (exit) => {
      fiber.setContext(prevServices)
      const endTime = fiber.getRef(Clock).currentTimeNanosUnsafe()
      fiber.currentDispatcher.scheduleTask(() => {
        const url = Request.toURL(request)
        if (Option.isSome(url) && (url.value.username !== "" || url.value.password !== "")) {
          url.value.username = "REDACTED"
          url.value.password = "REDACTED"
        }
        const redactedHeaderNames = fiber.getRef(Headers.CurrentRedactedNames)
        const requestHeaders = Headers.redact(request.headers, redactedHeaderNames)
        span.attribute("http.request.method", request.method)
        if (Option.isSome(url)) {
          span.attribute("url.full", url.value.toString())
          span.attribute("url.path", url.value.pathname)
          const query = url.value.search.slice(1)
          if (query !== "") {
            span.attribute("url.query", url.value.search.slice(1))
          }
          span.attribute("url.scheme", url.value.protocol.slice(0, -1))
        }
        if (request.headers["user-agent"] !== undefined) {
          span.attribute("user_agent.original", request.headers["user-agent"])
        }
        for (const name in requestHeaders) {
          span.attribute(`http.request.header.${name}`, String(requestHeaders[name]))
        }
        if (Option.isSome(request.remoteAddress)) {
          span.attribute("client.address", request.remoteAddress.value)
        }
        const response = exitResponse(exit)
        span.attribute("http.response.status_code", response.status)
        const responseHeaders = Headers.redact(response.headers, redactedHeaderNames)
        for (const name in responseHeaders) {
          span.attribute(`http.response.header.${name}`, String(responseHeaders[name]))
        }
        span.end(endTime, exit)
      }, 0)
      return undefined
    }, true)
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
        remoteAddress: Option.fromNullishOr(request.headers["x-forwarded-for"]?.split(",")[0].trim())
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
    const services = fiber.context
    const request = Context.getUnsafe(services, HttpServerRequest)
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
      const request = Context.getUnsafe(fiber.context, HttpServerRequest)
      if (request.method === "OPTIONS") {
        return Effect.succeed(Response.empty({
          status: 204,
          headers: headersFromRequestOptions(request)
        }))
      }
      appendPreResponseHandlerUnsafe(request, preResponseHandler)
      return httpApp
    })
}

/**
 * @since 4.0.0
 * @category Compression
 */
export type CompressionEncoding = "gzip" | "deflate"

const compressionEncodingsDefault: ReadonlyArray<CompressionEncoding> = ["gzip", "deflate"]

// Mirrors Hono's compressible content-type allowlist.
const compressibleContentTypeDefault =
  /^\s*(?:text\/[^;\s]+|application\/(?:javascript|json|xml|xml-dtd|ecmascript|dart|postscript|rtf|tar|toml|vnd\.dart|vnd\.ms-fontobject|vnd\.ms-opentype|wasm|x-httpd-php|x-javascript|xhtml\+xml)|font\/(?:otf|ttf)|image\/(?:bmp|svg\+xml|vnd\.adobe\.photoshop|vnd\.microsoft\.icon|vnd\.ms-dds|x-icon|x-ms-bmp)|message\/rfc822|model\/gltf-binary|x-shader\/x-fragment|x-shader\/x-vertex|[^;\s]+?\+(?:json|text|xml|yaml))(?:[;\s]|$)/i

const pickCompressionEncoding = (
  acceptEncoding: string | undefined,
  preferred: ReadonlyArray<CompressionEncoding>
): CompressionEncoding | undefined => {
  if (!acceptEncoding) return undefined
  const lower = acceptEncoding.toLowerCase()
  for (const enc of preferred) {
    if (lower.includes(enc)) return enc
  }
  return undefined
}

const varyAcceptEncoding = (existing: string | undefined): string => {
  if (!existing) return "Accept-Encoding"
  const parts = existing.split(",").map((part) => part.trim())
  if (parts.some((part) => part.toLowerCase() === "accept-encoding")) {
    return existing
  }
  return `${existing}, Accept-Encoding`
}

const compressBytes = (
  bytes: globalThis.Uint8Array,
  encoding: CompressionEncoding
): Effect.Effect<globalThis.Uint8Array> =>
  Effect.promise(async () => {
    const transform = new globalThis.CompressionStream(encoding)
    const writer = transform.writable.getWriter() as WritableStreamDefaultWriter<globalThis.Uint8Array>
    await writer.write(bytes)
    await writer.close()
    const reader = transform.readable.getReader() as ReadableStreamDefaultReader<globalThis.Uint8Array>
    const chunks: Array<globalThis.Uint8Array> = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      total += value.length
    }
    const out = new globalThis.Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      out.set(chunk, offset)
      offset += chunk.length
    }
    return out
  })

const compressStream = (
  body: HttpBody.Stream,
  encoding: CompressionEncoding
): HttpBody.Stream => {
  const compressed = Stream.fromReadableStream<globalThis.Uint8Array, unknown>({
    evaluate: () => {
      const source = Stream.toReadableStream(body.stream) as ReadableStream<globalThis.Uint8Array>
      const transform = new globalThis.CompressionStream(encoding) as unknown as ReadableWritablePair<
        globalThis.Uint8Array,
        globalThis.Uint8Array
      >
      return source.pipeThrough(transform)
    },
    onError: (cause) => cause
  })
  return new HttpBody.Stream(compressed, body.contentType, undefined)
}

/**
 * Compresses HTTP response bodies using gzip or deflate based on the request's
 * `Accept-Encoding` header.
 *
 * Skips responses that:
 * - Are for `HEAD` requests
 * - Already have a `Content-Encoding` header
 * - Have `Cache-Control: no-transform`
 * - Have a content type that is not in the configured allowlist (defaults to a
 *   list mirroring Hono's `compress` middleware; `text/event-stream` is always
 *   excluded)
 * - Have a known `Content-Length` smaller than the configured threshold
 *   (defaults to 1024 bytes)
 * - Have a body that is not `Uint8Array` or `Stream`
 *
 * When compression is applied, the response body is replaced, `Content-Encoding`
 * is set, `Content-Length` is dropped, `Vary` gains `Accept-Encoding`, and any
 * strong `ETag` is weakened.
 *
 * @since 4.0.0
 * @category Compression
 */
export const compression = (options?: {
  readonly threshold?: number | undefined
  readonly skip?: ((request: Request.HttpServerRequest) => boolean) | undefined
  readonly compressibleContentType?: RegExp | undefined
  readonly encodings?: ReadonlyArray<CompressionEncoding> | undefined
}): <E, R>(
  httpApp: Effect.Effect<HttpServerResponse, E, R>
) => Effect.Effect<HttpServerResponse, E, R | HttpServerRequest> => {
  const threshold = options?.threshold ?? 1024
  const skip = options?.skip
  const compressibleContentType = options?.compressibleContentType ?? compressibleContentTypeDefault
  const encodings = options?.encodings ?? compressionEncodingsDefault

  const preResponseHandler = (request: Request.HttpServerRequest, response: HttpServerResponse) => {
    if (request.method === "HEAD") return Effect.succeed(response)
    if (skip?.(request)) return Effect.succeed(response)
    if (response.headers["content-encoding"]) return Effect.succeed(response)

    const cacheControl = response.headers["cache-control"]
    if (cacheControl && cacheControl.toLowerCase().includes("no-transform")) {
      return Effect.succeed(response)
    }

    const encoding = pickCompressionEncoding(request.headers["accept-encoding"], encodings)
    if (!encoding) return Effect.succeed(response)

    const body = response.body
    if (body._tag !== "Uint8Array" && body._tag !== "Stream") {
      return Effect.succeed(response)
    }

    const contentType = body.contentType
    if (!contentType || contentType.toLowerCase().includes("text/event-stream")) {
      return Effect.succeed(response)
    }
    if (!compressibleContentType.test(contentType)) {
      return Effect.succeed(response)
    }

    if (body.contentLength !== undefined && body.contentLength < threshold) {
      return Effect.succeed(response)
    }

    const applyHeaders = (next: HttpServerResponse): HttpServerResponse => {
      let out = Response.setHeader(next, "content-encoding", encoding)
      out = Response.setHeader(out, "vary", varyAcceptEncoding(out.headers["vary"]))
      // Stream bodies have unknown compressed length; remove any stale value
      // that survived the body swap.
      if (out.body._tag === "Stream" && out.headers["content-length"] !== undefined) {
        out = Response.removeHeader(out, "content-length")
      }
      const etag = out.headers["etag"]
      if (etag && !etag.startsWith("W/")) {
        out = Response.setHeader(out, "etag", `W/${etag}`)
      }
      return out
    }

    if (body._tag === "Stream") {
      return Effect.succeed(applyHeaders(Response.setBody(response, compressStream(body, encoding))))
    }

    return compressBytes(body.body, encoding).pipe(
      Effect.map((compressed) =>
        applyHeaders(Response.setBody(response, HttpBody.uint8Array(compressed, body.contentType)))
      )
    )
  }

  return <E, R>(
    httpApp: Effect.Effect<HttpServerResponse, E, R>
  ): Effect.Effect<HttpServerResponse, E, R | HttpServerRequest> =>
    Effect.withFiber((fiber) => {
      const request = Context.getUnsafe(fiber.context, HttpServerRequest)
      appendPreResponseHandlerUnsafe(request, preResponseHandler)
      return httpApp
    })
}
