/**
 * @since 4.0.0
 */
import type * as Arr from "../../Array.ts"
import * as Channel from "../../Channel.ts"
import * as Effect from "../../Effect.ts"
import * as Inspectable from "../../Inspectable.ts"
import * as Option from "../../Option.ts"
import type * as FileSystem from "../../platform/FileSystem.ts"
import type * as Path from "../../platform/Path.ts"
import type { ReadonlyRecord } from "../../Record.ts"
import type { ParseOptions } from "../../schema/AST.ts"
import * as Schema from "../../schema/Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Stream from "../../Stream.ts"
import * as Socket from "../socket/Socket.ts"
import * as Cookies from "./Cookies.ts"
import * as Headers from "./Headers.ts"
import * as HttpIncomingMessage from "./HttpIncomingMessage.ts"
import type { HttpMethod } from "./HttpMethod.ts"
import { type HttpServerError, RequestError } from "./HttpServerError.ts"
import * as Multipart from "./Multipart.ts"
import * as UrlParams from "./UrlParams.ts"

export {
  /**
   * @since 4.0.0
   * @category fiber refs
   */
  MaxBodySize
} from "./HttpIncomingMessage.ts"

/**
 * @since 4.0.0
 * @category type ids
 */
export const TypeId: TypeId = "~effect/http/HttpServerRequest"

/**
 * @since 4.0.0
 * @category type ids
 */
export type TypeId = "~effect/http/HttpServerRequest"

/**
 * @since 4.0.0
 * @category models
 */
export interface HttpServerRequest extends HttpIncomingMessage.HttpIncomingMessage<HttpServerError> {
  readonly [TypeId]: TypeId
  readonly source: unknown
  readonly url: string
  readonly originalUrl: string
  readonly method: HttpMethod
  readonly cookies: ReadonlyRecord<string, string>

  readonly multipart: Effect.Effect<
    Multipart.Persisted,
    Multipart.MultipartError,
    Scope.Scope | FileSystem.FileSystem | Path.Path
  >
  readonly multipartStream: Stream.Stream<Multipart.Part, Multipart.MultipartError>

  readonly upgrade: Effect.Effect<Socket.Socket, HttpServerError>

  readonly modify: (
    options: {
      readonly url?: string
      readonly headers?: Headers.Headers
      readonly remoteAddress?: string
    }
  ) => HttpServerRequest
}

/**
 * @since 4.0.0
 * @category context
 */
export const HttpServerRequest: ServiceMap.Key<HttpServerRequest, HttpServerRequest> = ServiceMap.Key(
  "effect/http/HttpServerRequest"
)

/**
 * @since 4.0.0
 * @category search params
 */
export class ParsedSearchParams extends ServiceMap.Key<
  ParsedSearchParams,
  ReadonlyRecord<string, string | Array<string>>
>()("effect/http/ParsedSearchParams") {}

/**
 * @since 4.0.0
 * @category search params
 */
export const searchParamsFromURL = (url: URL): ReadonlyRecord<string, string | Array<string>> => {
  const out: Record<string, string | Array<string>> = {}
  for (const [key, value] of url.searchParams.entries()) {
    const entry = out[key]
    if (entry !== undefined) {
      if (Array.isArray(entry)) {
        entry.push(value)
      } else {
        out[key] = [entry, value]
      }
    } else {
      out[key] = value
    }
  }
  return out
}

/**
 * @since 4.0.0
 * @category accessors
 */
export const upgradeChannel = <IE = never>(): Channel.Channel<
  Arr.NonEmptyReadonlyArray<Uint8Array>,
  HttpServerError | IE | Socket.SocketError,
  void,
  Arr.NonEmptyReadonlyArray<string | Uint8Array | Socket.CloseEvent>,
  IE,
  unknown,
  HttpServerRequest
> =>
  HttpServerRequest.asEffect().pipe(
    Effect.flatMap((_) => _.upgrade),
    Effect.map(Socket.toChannelWith<IE>()),
    Channel.unwrap
  )

/**
 * @since 4.0.0
 * @category schema
 */
export const schemaCookies = <A, I extends Readonly<Record<string, string | undefined>>, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  options?: ParseOptions | undefined
): Effect.Effect<A, Schema.SchemaError, RD | HttpServerRequest> => {
  const parse = Schema.decodeUnknownEffect(schema)
  return Effect.flatMap(HttpServerRequest.asEffect(), (req) => parse(req.cookies, options))
}

/**
 * @since 4.0.0
 * @category schema
 */
export const schemaHeaders = <A, I extends Readonly<Record<string, string | undefined>>, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  options?: ParseOptions | undefined
): Effect.Effect<A, Schema.SchemaError, HttpServerRequest | RD> => {
  const parse = Schema.decodeUnknownEffect(schema)
  return Effect.flatMap(HttpServerRequest.asEffect(), (req) => parse(req.headers, options))
}

/**
 * @since 4.0.0
 * @category schema
 */
export const schemaSearchParams = <
  A,
  I extends Readonly<Record<string, string | ReadonlyArray<string> | undefined>>,
  RD,
  RE
>(
  schema: Schema.Codec<A, I, RD, RE>,
  options?: ParseOptions | undefined
): Effect.Effect<A, Schema.SchemaError, ParsedSearchParams | RD> => {
  const parse = Schema.decodeUnknownEffect(schema)
  return Effect.flatMap(ParsedSearchParams.asEffect(), (params) => parse(params, options))
}
/**
 * @since 4.0.0
 * @category schema
 */
export const schemaBodyJson = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  options?: ParseOptions | undefined
): Effect.Effect<A, HttpServerError | Schema.SchemaError, HttpServerRequest | RD> => {
  const parse = HttpIncomingMessage.schemaBodyJson(schema, options)
  return Effect.flatMap(HttpServerRequest.asEffect(), parse)
}

const isMultipart = (request: HttpServerRequest) =>
  request.headers["content-type"]?.toLowerCase().includes("multipart/form-data")

/**
 * @since 4.0.0
 * @category schema
 */

/** @internal */
export const schemaBodyForm = <A, I extends Partial<Multipart.Persisted>, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  options?: ParseOptions | undefined
) => {
  const parseMultipart = Multipart.schemaPersisted(schema)
  const parseUrlParams = HttpIncomingMessage.schemaBodyUrlParams(schema as Schema.Codec<A, any, RD, RE>, options)
  return Effect.flatMap(HttpServerRequest.asEffect(), (request): Effect.Effect<
    A,
    Multipart.MultipartError | Schema.SchemaError | HttpServerError,
    RD | HttpServerRequest | Scope.Scope | FileSystem.FileSystem | Path.Path
  > => {
    if (isMultipart(request)) {
      return Effect.flatMap(request.multipart, (_) => parseMultipart(_, options))
    }
    return parseUrlParams(request)
  })
}

/**
 * @since 4.0.0
 * @category schema
 */
export const schemaBodyUrlParams = <
  A,
  I extends Readonly<Record<string, string | ReadonlyArray<string> | undefined>>,
  RD,
  RE
>(
  schema: Schema.Codec<A, I, RD, RE>,
  options?: ParseOptions | undefined
): Effect.Effect<A, HttpServerError | Schema.SchemaError, HttpServerRequest | RD> => {
  const parse = HttpIncomingMessage.schemaBodyUrlParams(schema, options)
  return Effect.flatMap(HttpServerRequest.asEffect(), parse)
}

/**
 * @since 4.0.0
 * @category schema
 */
export const schemaBodyMultipart = <A, I extends Partial<Multipart.Persisted>, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  options?: ParseOptions | undefined
): Effect.Effect<
  A,
  Multipart.MultipartError | Schema.SchemaError,
  HttpServerRequest | Scope.Scope | FileSystem.FileSystem | Path.Path | RD
> => {
  const parse = Multipart.schemaPersisted(schema)
  return HttpServerRequest.asEffect().pipe(
    Effect.flatMap((_) => _.multipart),
    Effect.flatMap((_) => parse(_, options))
  )
}

/**
 * @since 4.0.0
 * @category schema
 */
export const schemaBodyFormJson = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  options?: ParseOptions | undefined
) => {
  const parseMultipart = Multipart.schemaJson(schema, options)
  return (field: string) => {
    const parseUrlParams = UrlParams.schemaJsonField(field).pipe(
      Schema.decodeTo(schema),
      Schema.decodeEffect
    )
    return Effect.flatMap(
      HttpServerRequest.asEffect(),
      (request): Effect.Effect<
        A,
        Schema.SchemaError | HttpServerError,
        RD | FileSystem.FileSystem | Path.Path | Scope.Scope | HttpServerRequest
      > => {
        if (isMultipart(request)) {
          return Effect.flatMap(
            Effect.mapError(request.multipart, (cause) =>
              new RequestError({
                request,
                reason: "RequestParseError",
                cause
              })),
            parseMultipart(field)
          )
        }
        return Effect.flatMap(request.urlParamsBody, (_) => parseUrlParams(_, options))
      }
    )
  }
}

/**
 * @since 4.0.0
 * @category conversions
 */
export const fromWeb = (request: globalThis.Request): HttpServerRequest =>
  new ServerRequestImpl(request, removeHost(request.url))

const removeHost = (url: string) => {
  if (url[0] === "/") {
    return url
  }
  const index = url.indexOf("/", url.indexOf("//") + 2)
  return index === -1 ? "/" : url.slice(index)
}

class ServerRequestImpl extends Inspectable.Class implements HttpServerRequest {
  readonly [TypeId]: TypeId
  readonly [HttpIncomingMessage.TypeId]: HttpIncomingMessage.TypeId
  constructor(
    readonly source: Request,
    readonly url: string,
    public headersOverride?: Headers.Headers,
    private remoteAddressOverride?: string
  ) {
    super()
    this[TypeId] = TypeId
    this[HttpIncomingMessage.TypeId] = HttpIncomingMessage.TypeId
  }
  toJSON(): unknown {
    return HttpIncomingMessage.inspect(this, {
      _id: "HttpServerRequest",
      method: this.method,
      url: this.originalUrl
    })
  }
  modify(
    options: {
      readonly url?: string | undefined
      readonly headers?: Headers.Headers | undefined
      readonly remoteAddress?: string | undefined
    }
  ) {
    return new ServerRequestImpl(
      this.source,
      options.url ?? this.url,
      options.headers ?? this.headersOverride,
      options.remoteAddress ?? this.remoteAddressOverride
    )
  }
  get method(): HttpMethod {
    return this.source.method.toUpperCase() as HttpMethod
  }
  get originalUrl() {
    return this.source.url
  }
  get remoteAddress(): Option.Option<string> {
    return this.remoteAddressOverride ? Option.some(this.remoteAddressOverride) : Option.none()
  }
  get headers(): Headers.Headers {
    this.headersOverride ??= Headers.fromInput(this.source.headers as any)
    return this.headersOverride
  }

  private cachedCookies: ReadonlyRecord<string, string> | undefined
  get cookies() {
    if (this.cachedCookies) {
      return this.cachedCookies
    }
    return this.cachedCookies = Cookies.parseHeader(this.headers.cookie ?? "")
  }

  get stream(): Stream.Stream<Uint8Array, HttpServerError> {
    return this.source.body
      ? Stream.fromReadableStream({
        evaluate: () => this.source.body as any,
        onError: (cause) =>
          new RequestError({
            request: this,
            reason: "RequestParseError",
            cause
          })
      })
      : Stream.fail(
        new RequestError({
          request: this,
          reason: "RequestParseError",
          description: "can not create stream from empty body"
        })
      )
  }

  private textEffect: Effect.Effect<string, HttpServerError> | undefined
  get text(): Effect.Effect<string, HttpServerError> {
    if (this.textEffect) {
      return this.textEffect
    }
    this.textEffect = Effect.runSync(Effect.cached(
      Effect.tryPromise({
        try: () => this.source.text(),
        catch: (cause) =>
          new RequestError({
            request: this,
            reason: "RequestParseError",
            cause
          })
      })
    ))
    return this.textEffect
  }

  get json(): Effect.Effect<unknown, HttpServerError> {
    return Effect.flatMap(this.text, (text) =>
      Effect.try({
        try: () => JSON.parse(text) as unknown,
        catch: (cause) =>
          new RequestError({
            request: this,
            reason: "RequestParseError",
            cause
          })
      }))
  }

  get urlParamsBody(): Effect.Effect<UrlParams.UrlParams, HttpServerError> {
    return Effect.flatMap(this.text, (_) =>
      Effect.try({
        try: () => UrlParams.fromInput(new URLSearchParams(_)),
        catch: (cause) =>
          new RequestError({
            request: this,
            reason: "RequestParseError",
            cause
          })
      }))
  }

  private multipartEffect:
    | Effect.Effect<
      Multipart.Persisted,
      Multipart.MultipartError,
      Scope.Scope | FileSystem.FileSystem | Path.Path
    >
    | undefined
  get multipart(): Effect.Effect<
    Multipart.Persisted,
    Multipart.MultipartError,
    Scope.Scope | FileSystem.FileSystem | Path.Path
  > {
    if (this.multipartEffect) {
      return this.multipartEffect
    }
    this.multipartEffect = Effect.runSync(Effect.cached(
      Multipart.toPersisted(this.multipartStream)
    ))
    return this.multipartEffect
  }

  get multipartStream(): Stream.Stream<Multipart.Part, Multipart.MultipartError> {
    return Stream.pipeThroughChannel(
      Stream.mapError(this.stream, (cause) => new Multipart.MultipartError({ reason: "InternalError", cause })),
      Multipart.makeChannel(this.headers)
    )
  }

  private arrayBufferEffect: Effect.Effect<ArrayBuffer, HttpServerError> | undefined
  get arrayBuffer(): Effect.Effect<ArrayBuffer, HttpServerError> {
    if (this.arrayBufferEffect) {
      return this.arrayBufferEffect
    }
    this.arrayBufferEffect = Effect.runSync(Effect.cached(
      Effect.tryPromise({
        try: () => this.source.arrayBuffer(),
        catch: (cause) =>
          new RequestError({
            request: this,
            reason: "RequestParseError",
            cause
          })
      })
    ))
    return this.arrayBufferEffect
  }

  get upgrade(): Effect.Effect<Socket.Socket, HttpServerError> {
    return Effect.fail(
      new RequestError({
        request: this,
        reason: "RequestParseError",
        description: "Not an upgradeable ServerRequest"
      })
    )
  }
}

/**
 * @since 4.0.0
 * @category conversions
 */
export const toURL = (self: HttpServerRequest): Option.Option<URL> => {
  const host = self.headers.host ?? "localhost"
  const protocol = self.headers["x-forwarded-proto"] === "https" ? "https" : "http"
  try {
    return Option.some(new URL(self.url, `${protocol}://${host}`))
  } catch {
    return Option.none()
  }
}
