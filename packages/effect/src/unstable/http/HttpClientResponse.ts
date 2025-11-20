/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import { dual } from "../../Function.ts"
import * as Inspectable from "../../interfaces/Inspectable.ts"
import type { ParseOptions } from "../../schema/AST.ts"
import * as Schema from "../../schema/Schema.ts"
import * as Stream from "../../stream/Stream.ts"
import type { Unify } from "../../types/Unify.ts"
import * as Cookies from "./Cookies.ts"
import * as Headers from "./Headers.ts"
import * as Error from "./HttpClientError.ts"
import type * as HttpClientRequest from "./HttpClientRequest.ts"
import * as HttpIncomingMessage from "./HttpIncomingMessage.ts"
import * as UrlParams from "./UrlParams.ts"

export {
  /**
   * @since 4.0.0
   * @category schema
   */
  schemaBodyJson,
  /**
   * @since 4.0.0
   * @category schema
   */
  schemaBodyUrlParams,
  /**
   * @since 4.0.0
   * @category schema
   */
  schemaHeaders
} from "./HttpIncomingMessage.ts"

/**
 * @since 4.0.0
 * @category Type IDs
 */
export const TypeId = "~effect/http/HttpClientResponse"

/**
 * @since 4.0.0
 * @category models
 */
export interface HttpClientResponse extends HttpIncomingMessage.HttpIncomingMessage<Error.ResponseError> {
  readonly [TypeId]: typeof TypeId
  readonly request: HttpClientRequest.HttpClientRequest
  readonly status: number
  readonly cookies: Cookies.Cookies
  readonly formData: Effect.Effect<FormData, Error.ResponseError>
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromWeb = (request: HttpClientRequest.HttpClientRequest, source: Response): HttpClientResponse =>
  new WebHttpClientResponse(request, source)

/**
 * @since 4.0.0
 * @category schema
 */
export const schemaJson = <
  A,
  I extends {
    readonly status?: number | undefined
    readonly headers?: Readonly<Record<string, string | undefined>> | undefined
    readonly body?: unknown
  },
  RD,
  RE
>(
  schema: Schema.Codec<A, I, RD, RE>,
  options?: ParseOptions | undefined
) => {
  const decode = Schema.decodeEffect(Schema.toSerializerJson(schema).annotate({ options }))
  return (
    self: HttpClientResponse
  ): Effect.Effect<A, Schema.SchemaError | Error.ResponseError, RD> =>
    Effect.flatMap(self.json, (body) =>
      decode({
        status: self.status,
        headers: self.headers,
        body
      }))
}

/**
 * @since 4.0.0
 * @category schema
 */
export const schemaNoBody = <
  A,
  I extends {
    readonly status?: number | undefined
    readonly headers?: Readonly<Record<string, string>> | undefined
  },
  RD,
  RE
>(
  schema: Schema.Codec<A, I, RD, RE>,
  options?: ParseOptions | undefined
) => {
  const decode = Schema.decodeEffect(schema.annotate({ options }))
  return (self: HttpClientResponse): Effect.Effect<A, Schema.SchemaError, RD> =>
    decode({
      status: self.status,
      headers: self.headers
    } as any as I)
}

/**
 * @since 4.0.0
 * @category accessors
 */
export const stream = <E, R>(
  effect: Effect.Effect<HttpClientResponse, E, R>
): Stream.Stream<Uint8Array, Error.ResponseError | E, R> => Stream.unwrap(Effect.map(effect, (self) => self.stream))

/**
 * @since 4.0.0
 * @category pattern matching
 */
export const matchStatus: {
  <
    const Cases extends {
      readonly [status: number]: (_: HttpClientResponse) => any
      readonly "2xx"?: (_: HttpClientResponse) => any
      readonly "3xx"?: (_: HttpClientResponse) => any
      readonly "4xx"?: (_: HttpClientResponse) => any
      readonly "5xx"?: (_: HttpClientResponse) => any
      readonly orElse: (_: HttpClientResponse) => any
    }
  >(cases: Cases): (self: HttpClientResponse) => Cases[keyof Cases] extends (_: any) => infer R ? Unify<R> : never
  <
    const Cases extends {
      readonly [status: number]: (_: HttpClientResponse) => any
      readonly "2xx"?: (_: HttpClientResponse) => any
      readonly "3xx"?: (_: HttpClientResponse) => any
      readonly "4xx"?: (_: HttpClientResponse) => any
      readonly "5xx"?: (_: HttpClientResponse) => any
      readonly orElse: (_: HttpClientResponse) => any
    }
  >(self: HttpClientResponse, cases: Cases): Cases[keyof Cases] extends (_: any) => infer R ? Unify<R> : never
} = dual(2, <
  const Cases extends {
    readonly [status: number]: (_: HttpClientResponse) => any
    readonly "2xx"?: (_: HttpClientResponse) => any
    readonly "3xx"?: (_: HttpClientResponse) => any
    readonly "4xx"?: (_: HttpClientResponse) => any
    readonly "5xx"?: (_: HttpClientResponse) => any
    readonly orElse: (_: HttpClientResponse) => any
  }
>(self: HttpClientResponse, cases: Cases) => {
  const status = self.status
  if (cases[status]) {
    return cases[status](self)
  } else if (status >= 200 && status < 300 && cases["2xx"]) {
    return cases["2xx"](self)
  } else if (status >= 300 && status < 400 && cases["3xx"]) {
    return cases["3xx"](self)
  } else if (status >= 400 && status < 500 && cases["4xx"]) {
    return cases["4xx"](self)
  } else if (status >= 500 && status < 600 && cases["5xx"]) {
    return cases["5xx"](self)
  }
  return cases.orElse(self)
})

/**
 * @since 4.0.0
 * @category filters
 */
export const filterStatus: {
  (f: (status: number) => boolean): (self: HttpClientResponse) => Effect.Effect<HttpClientResponse, Error.ResponseError>
  (self: HttpClientResponse, f: (status: number) => boolean): Effect.Effect<HttpClientResponse, Error.ResponseError>
} = dual(
  2,
  (self: HttpClientResponse, f: (status: number) => boolean) =>
    Effect.suspend(() =>
      f(self.status) ? Effect.succeed(self) : Effect.fail(
        new Error.ResponseError({
          response: self,
          request: self.request,
          reason: "StatusCode",
          description: "invalid status code"
        })
      )
    )
)

/**
 * @since 4.0.0
 * @category filters
 */
export const filterStatusOk = (self: HttpClientResponse): Effect.Effect<HttpClientResponse, Error.ResponseError> =>
  self.status >= 200 && self.status < 300 ? Effect.succeed(self) : Effect.fail(
    new Error.ResponseError({
      response: self,
      request: self.request,
      reason: "StatusCode",
      description: "non 2xx status code"
    })
  )

// -----------------------------------------------------------------------------
// internal
// -----------------------------------------------------------------------------

class WebHttpClientResponse extends Inspectable.Class implements HttpClientResponse {
  readonly [HttpIncomingMessage.TypeId]: typeof HttpIncomingMessage.TypeId
  readonly [TypeId]: typeof TypeId

  readonly request: HttpClientRequest.HttpClientRequest
  private readonly source: globalThis.Response

  constructor(
    request: HttpClientRequest.HttpClientRequest,
    source: globalThis.Response
  ) {
    super()
    this.request = request
    this.source = source
    this[HttpIncomingMessage.TypeId] = HttpIncomingMessage.TypeId
    this[TypeId] = TypeId
  }

  toJSON(): unknown {
    return HttpIncomingMessage.inspect(this, {
      _id: "HttpClientResponse",
      request: this.request.toJSON(),
      status: this.status
    })
  }

  get status(): number {
    return this.source.status
  }

  get headers(): Headers.Headers {
    return Headers.fromInput(this.source.headers)
  }

  cachedCookies?: Cookies.Cookies
  get cookies(): Cookies.Cookies {
    if (this.cachedCookies) {
      return this.cachedCookies
    }
    return this.cachedCookies = Cookies.fromSetCookie(this.source.headers.getSetCookie())
  }

  get remoteAddress(): string | undefined {
    return undefined
  }

  get stream(): Stream.Stream<Uint8Array, Error.ResponseError> {
    return this.source.body
      ? Stream.fromReadableStream({
        evaluate: () => this.source.body!,
        onError: (cause) =>
          new Error.ResponseError({
            request: this.request,
            response: this,
            reason: "Decode",
            cause
          })
      })
      : Stream.fail(
        new Error.ResponseError({
          request: this.request,
          response: this,
          reason: "EmptyBody",
          description: "can not create stream from empty body"
        })
      )
  }

  get json(): Effect.Effect<unknown, Error.ResponseError> {
    return Effect.flatMap(this.text, (text) =>
      Effect.try({
        try: () => text === "" ? null : JSON.parse(text) as unknown,
        catch: (cause) =>
          new Error.ResponseError({
            request: this.request,
            response: this,
            reason: "Decode",
            cause
          })
      }))
  }

  private textBody?: Effect.Effect<string, Error.ResponseError>
  get text(): Effect.Effect<string, Error.ResponseError> {
    return this.textBody ??= Effect.tryPromise({
      try: () => this.source.text(),
      catch: (cause) =>
        new Error.ResponseError({
          request: this.request,
          response: this,
          reason: "Decode",
          cause
        })
    }).pipe(Effect.cached, Effect.runSync)
  }

  get urlParamsBody(): Effect.Effect<UrlParams.UrlParams, Error.ResponseError> {
    return Effect.flatMap(this.text, (_) =>
      Effect.try({
        try: () => UrlParams.fromInput(new URLSearchParams(_)),
        catch: (cause) =>
          new Error.ResponseError({
            request: this.request,
            response: this,
            reason: "Decode",
            cause
          })
      }))
  }

  private formDataBody?: Effect.Effect<FormData, Error.ResponseError>
  get formData(): Effect.Effect<FormData, Error.ResponseError> {
    return this.formDataBody ??= Effect.tryPromise({
      try: () => this.source.formData(),
      catch: (cause) =>
        new Error.ResponseError({
          request: this.request,
          response: this,
          reason: "Decode",
          cause
        })
    }).pipe(Effect.cached, Effect.runSync)
  }

  private arrayBufferBody?: Effect.Effect<ArrayBuffer, Error.ResponseError>
  get arrayBuffer(): Effect.Effect<ArrayBuffer, Error.ResponseError> {
    return this.arrayBufferBody ??= Effect.tryPromise({
      try: () => this.source.arrayBuffer(),
      catch: (cause) =>
        new Error.ResponseError({
          request: this.request,
          response: this,
          reason: "Decode",
          cause
        })
    }).pipe(Effect.cached, Effect.runSync)
  }
}
