/**
 * @since 4.0.0
 */
import type * as Arr from "../../Array.ts"
import * as Channel from "../../Channel.ts"
import * as Effect from "../../Effect.ts"
import type * as FileSystem from "../../FileSystem.ts"
import * as Inspectable from "../../Inspectable.ts"
import type * as Path from "../../Path.ts"
import type { ReadonlyRecord } from "../../Record.ts"
import * as Result from "../../Result.ts"
import * as Schema from "../../Schema.ts"
import type { ParseOptions } from "../../SchemaAST.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Stream from "../../Stream.ts"
import * as Socket from "../socket/Socket.ts"
import * as Cookies from "./Cookies.ts"
import * as Headers from "./Headers.ts"
import type * as HttpClientRequest from "./HttpClientRequest.ts"
import * as HttpIncomingMessage from "./HttpIncomingMessage.ts"
import { hasBody, type HttpMethod } from "./HttpMethod.ts"
import { HttpServerError, type RequestError, RequestParseError } from "./HttpServerError.ts"
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
 * @category Type IDs
 */
export const TypeId = "~effect/http/HttpServerRequest"

/**
 * @since 4.0.0
 * @category models
 */
export interface HttpServerRequest extends HttpIncomingMessage.HttpIncomingMessage<HttpServerError> {
  readonly [TypeId]: typeof TypeId
  readonly source: object
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
export const HttpServerRequest: ServiceMap.Service<HttpServerRequest, HttpServerRequest> = ServiceMap.Service(
  "effect/http/HttpServerRequest"
)

/**
 * @since 4.0.0
 * @category search params
 */
export class ParsedSearchParams extends ServiceMap.Service<
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
              new HttpServerError({
                reason: new RequestParseError({
                  request,
                  cause
                })
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

/**
 * @since 4.0.0
 * @category conversions
 */
export const fromClientRequest = (
  request: HttpClientRequest.HttpClientRequest,
  options?: {
    readonly services?: ServiceMap.ServiceMap<never> | undefined
  }
): HttpServerRequest => {
  const url = new URL(request.url, clientRequestBaseUrl)
  for (let i = 0; i < request.urlParams.params.length; i++) {
    const [key, value] = request.urlParams.params[i]
    url.searchParams.append(key, value)
  }
  if (request.hash !== undefined) {
    url.hash = request.hash
  }
  return new ClientRequestServerRequestImpl(
    request,
    removeHost(url.toString()),
    isAbsoluteClientUrl(request.url) ? url.toString() : removeHost(url.toString()),
    options?.services ?? ServiceMap.empty()
  )
}

const removeHost = (url: string) => {
  if (url[0] === "/") {
    return url
  }
  const index = url.indexOf("/", url.indexOf("//") + 2)
  return index === -1 ? "/" : url.slice(index)
}

const clientRequestBaseUrl = "http://effect-http.invalid"

const isAbsoluteClientUrl = (url: string) => /^[A-Za-z][A-Za-z\d+.-]*:/.test(url)

const requestParseError = (
  request: HttpServerRequest,
  options: {
    readonly cause?: unknown
    readonly description?: string
  }
): HttpServerError =>
  new HttpServerError({
    reason: new RequestParseError({
      request,
      ...(options.cause === undefined ? undefined : { cause: options.cause }),
      ...(options.description === undefined ? undefined : { description: options.description })
    })
  })

abstract class BaseServerRequestImpl extends Inspectable.Class implements HttpServerRequest {
  readonly [TypeId]: typeof TypeId
  readonly [HttpIncomingMessage.TypeId]: typeof HttpIncomingMessage.TypeId
  abstract readonly source: object
  readonly url: string
  protected headersOverride?: Headers.Headers | undefined
  protected remoteAddressOverride?: string | undefined

  constructor(
    url: string,
    headersOverride?: Headers.Headers,
    remoteAddressOverride?: string
  ) {
    super()
    this[TypeId] = TypeId
    this[HttpIncomingMessage.TypeId] = HttpIncomingMessage.TypeId
    this.url = url
    this.headersOverride = headersOverride
    this.remoteAddressOverride = remoteAddressOverride
  }
  toJSON(): unknown {
    return HttpIncomingMessage.inspect(this, {
      _id: "HttpServerRequest",
      method: this.method,
      url: this.originalUrl
    })
  }
  abstract modify(
    options: {
      readonly url?: string | undefined
      readonly headers?: Headers.Headers | undefined
      readonly remoteAddress?: string | undefined
    }
  ): HttpServerRequest
  abstract get method(): HttpMethod
  abstract get originalUrl(): string
  protected abstract get sourceHeaders(): Headers.Headers | globalThis.Headers
  protected abstract get sourceStream(): Stream.Stream<Uint8Array, HttpServerError> | undefined
  protected abstract sourceText(): Promise<string>
  protected abstract sourceArrayBuffer(): Promise<ArrayBuffer>
  get remoteAddress(): string | undefined {
    return this.remoteAddressOverride ? this.remoteAddressOverride : undefined
  }
  get headers(): Headers.Headers {
    this.headersOverride ??= Headers.fromInput(this.sourceHeaders as any)
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
    return this.sourceStream ?? Stream.fail(requestParseError(this, {
      description: "can not create stream from empty body"
    }))
  }

  private textEffect: Effect.Effect<string, HttpServerError> | undefined
  get text(): Effect.Effect<string, HttpServerError> {
    if (this.textEffect) {
      return this.textEffect
    }
    this.textEffect = Effect.runSync(Effect.cached(
      Effect.tryPromise({
        try: () => this.sourceText(),
        catch: (cause) => requestParseError(this, { cause })
      })
    ))
    return this.textEffect
  }

  get json(): Effect.Effect<unknown, HttpServerError> {
    return Effect.flatMap(this.text, (text) =>
      Effect.try({
        try: () => JSON.parse(text) as unknown,
        catch: (cause) =>
          new HttpServerError({
            reason: new RequestParseError({
              request: this,
              cause
            })
          })
      }))
  }

  get urlParamsBody(): Effect.Effect<UrlParams.UrlParams, HttpServerError> {
    return Effect.flatMap(this.text, (_) =>
      Effect.try({
        try: () => UrlParams.fromInput(new URLSearchParams(_)),
        catch: (cause) => requestParseError(this, { cause })
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
      Stream.mapError(this.stream, (cause) => Multipart.MultipartError.fromReason("InternalError", cause)),
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
        try: () => this.sourceArrayBuffer(),
        catch: (cause) => requestParseError(this, { cause })
      })
    ))
    return this.arrayBufferEffect
  }

  get upgrade(): Effect.Effect<Socket.Socket, HttpServerError> {
    return Effect.fail(requestParseError(this, {
      description: "Not an upgradeable ServerRequest"
    }))
  }
}

class ServerRequestImpl extends BaseServerRequestImpl {
  readonly source: Request

  constructor(
    source: Request,
    url: string,
    headersOverride?: Headers.Headers,
    remoteAddressOverride?: string
  ) {
    super(url, headersOverride, remoteAddressOverride)
    this.source = source
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
  protected get sourceHeaders(): globalThis.Headers {
    return this.source.headers
  }
  protected get sourceStream(): Stream.Stream<Uint8Array, HttpServerError> | undefined {
    return this.source.body ?
      Stream.fromReadableStream({
        evaluate: () => this.source.body as any,
        onError: (cause) => requestParseError(this, { cause })
      }) :
      undefined
  }
  protected sourceText(): Promise<string> {
    return this.source.text()
  }
  protected sourceArrayBuffer(): Promise<ArrayBuffer> {
    return this.source.arrayBuffer()
  }
}

class ClientRequestServerRequestImpl extends BaseServerRequestImpl {
  readonly source: HttpClientRequest.HttpClientRequest
  readonly originalUrl: string
  private readonly services: ServiceMap.ServiceMap<never>
  private bodyResponseCache: Response | undefined

  constructor(
    source: HttpClientRequest.HttpClientRequest,
    url: string,
    originalUrl: string,
    services: ServiceMap.ServiceMap<never>,
    headersOverride?: Headers.Headers,
    remoteAddressOverride?: string
  ) {
    super(url, headersOverride, remoteAddressOverride)
    this.source = source
    this.originalUrl = originalUrl
    this.services = services
  }
  modify(
    options: {
      readonly url?: string | undefined
      readonly headers?: Headers.Headers | undefined
      readonly remoteAddress?: string | undefined
    }
  ) {
    return new ClientRequestServerRequestImpl(
      this.source,
      options.url ?? this.url,
      this.originalUrl,
      this.services,
      options.headers ?? this.headersOverride,
      options.remoteAddress ?? this.remoteAddressOverride
    )
  }
  get method(): HttpMethod {
    return this.source.method
  }
  protected get sourceHeaders(): Headers.Headers | globalThis.Headers {
    return this.source.body._tag === "FormData" ? this.bodyResponse.headers : this.source.headers
  }
  protected get sourceStream(): Stream.Stream<Uint8Array, HttpServerError> | undefined {
    switch (this.source.body._tag) {
      case "Empty": {
        return undefined
      }
      case "Stream": {
        return Stream.mapError(this.source.body.stream, (cause) => requestParseError(this, { cause }))
      }
      default: {
        const body = this.bodyResponse.body
        return body ?
          Stream.fromReadableStream({
            evaluate: () => body as any,
            onError: (cause) => requestParseError(this, { cause })
          }) :
          undefined
      }
    }
  }
  protected sourceText(): Promise<string> {
    return this.source.body._tag === "Empty" ? Promise.resolve("") : this.bodyResponse.text()
  }
  protected sourceArrayBuffer(): Promise<ArrayBuffer> {
    return this.source.body._tag === "Empty" ? Promise.resolve(new ArrayBuffer(0)) : this.bodyResponse.arrayBuffer()
  }

  private get bodyResponse(): Response {
    if (this.bodyResponseCache) {
      return this.bodyResponseCache
    }
    switch (this.source.body._tag) {
      case "Empty": {
        this.bodyResponseCache = new Response(undefined, {
          headers: this.source.headers
        })
        return this.bodyResponseCache
      }
      case "Raw":
      case "Uint8Array": {
        this.bodyResponseCache = new Response(this.source.body.body as any, {
          headers: this.source.headers
        })
        return this.bodyResponseCache
      }
      case "FormData": {
        this.bodyResponseCache = new Response(this.source.body.formData, {
          headers: this.source.headers
        })
        return this.bodyResponseCache
      }
      case "Stream": {
        this.bodyResponseCache = new Response(
          Stream.toReadableStreamWith(this.source.body.stream, this.services),
          {
            headers: this.source.headers
          }
        )
        return this.bodyResponseCache
      }
    }
  }
}

/**
 * @since 4.0.0
 * @category conversions
 */
export const toURL = (self: HttpServerRequest): URL | undefined => {
  const host = self.headers.host ?? "localhost"
  const protocol = self.headers["x-forwarded-proto"] === "https" ? "https" : "http"
  try {
    return new URL(self.url, `${protocol}://${host}`)
  } catch {
    return undefined
  }
}

/**
 * @since 4.0.0
 * @category conversions
 */
export const toWebResult = (self: HttpServerRequest, options?: {
  readonly signal?: AbortSignal | undefined
  readonly services?: ServiceMap.ServiceMap<never> | undefined
}): Result.Result<Request, RequestError> => {
  if (self.source instanceof Request) {
    return Result.succeed(self.source)
  }
  const url = toURL(self)
  if (url === undefined) {
    return Result.fail(
      new RequestParseError({
        request: self,
        description: "Invalid URL"
      })
    )
  }
  const requestInit: RequestInit = {
    method: self.method,
    headers: self.headers
  }
  if (options?.signal) {
    requestInit.signal = options.signal
  }
  if (hasBody(self.method)) {
    requestInit.body = Stream.toReadableStreamWith(self.stream, options?.services ?? ServiceMap.empty())
    ;(requestInit as any).duplex = "half"
  }
  return Result.succeed(new Request(url, requestInit))
}

/**
 * @since 4.0.0
 * @category conversions
 */
export const toWeb = (self: HttpServerRequest, options?: {
  readonly signal?: AbortSignal | undefined
}): Effect.Effect<Request, RequestError> =>
  Effect.servicesWith((services) =>
    toWebResult(self, {
      services,
      signal: options?.signal
    }).asEffect()
  )
