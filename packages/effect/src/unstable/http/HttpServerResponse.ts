/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.js"
import type * as FileSystem from "../../FileSystem.js"
import { dual } from "../../Function.js"
import { ServiceMap } from "../../index.js"
import * as Inspectable from "../../Inspectable.js"
import { PipeInspectableProto, YieldableProto } from "../../internal/core.js"
import type { Pipeable } from "../../Pipeable.js"
import type { PlatformError } from "../../PlatformError.js"
import { hasProperty } from "../../Predicate.js"
import type { ParseOptions } from "../../schema/AST.js"
import type * as Schema from "../../schema/Schema.js"
import * as Stream from "../../Stream.js"
import type { Mutable } from "../../Types.js"
import * as Cookies from "./Cookies.js"
import * as Headers from "./Headers.js"
import * as Body from "./HttpBody.js"
import { HttpPlatform } from "./HttpPlatform.js"
import * as Template from "./Template.js"
import * as UrlParams from "./UrlParams.js"

/**
 * @since 4.0.0
 * @category type ids
 */
export const TypeId: TypeId = "~effect/http/HttpServerResponse"

/**
 * @since 4.0.0
 * @category type ids
 */
export type TypeId = "~effect/http/HttpServerResponse"

/**
 * @since 4.0.0
 * @category models
 */
export interface HttpServerResponse
  extends Effect.Yieldable<HttpServerResponse, HttpServerResponse>, Inspectable.Inspectable, Pipeable
{
  readonly [TypeId]: TypeId
  readonly status: number
  readonly statusText?: string | undefined
  readonly headers: Headers.Headers
  readonly cookies: Cookies.Cookies
  readonly body: Body.HttpBody
}

/**
 * @since 4.0.0
 * @category models
 */
export interface Options {
  readonly status?: number | undefined
  readonly statusText?: string | undefined
  readonly headers?: Headers.Input | undefined
  readonly cookies?: Cookies.Cookies | undefined
  readonly contentType?: string | undefined
  readonly contentLength?: number | undefined
}

/**
 * @since 4.0.0
 */
export declare namespace Options {
  /**
   * @since 4.0.0
   * @category models
   */
  export interface WithContent extends Omit<Options, "contentType" | "contentLength"> {}

  /**
   * @since 4.0.0
   * @category models
   */
  export interface WithContentType extends Omit<Options, "contentLength"> {}
}

/**
 * @since 4.0.0
 */
export const isHttpServerResponse = (u: unknown): u is HttpServerResponse => hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category constructors
 */
export const empty = (options?: Options.WithContent | undefined): HttpServerResponse =>
  makeResponse({
    status: options?.status ?? 204,
    statusText: options?.statusText
  })

/**
 * @since 4.0.0
 * @category constructors
 */
export const redirect = (location: string | URL, options?: Options.WithContentType | undefined): HttpServerResponse => {
  const headers = Headers.unsafeFromRecord({ location: location.toString() })
  return makeResponse({
    status: options?.status ?? 302,
    statusText: options?.statusText,
    headers: options?.headers ?
      Headers.merge(headers, Headers.fromInput(options.headers)) :
      headers,
    cookies: options?.cookies ?? Cookies.empty
  })
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const uint8Array = (
  body: Uint8Array,
  options?: Options.WithContentType
): HttpServerResponse => {
  const headers = options?.headers ? Headers.fromInput(options.headers) : Headers.empty
  return makeResponse({
    status: options?.status ?? 200,
    statusText: options?.statusText,
    headers,
    cookies: options?.cookies ?? Cookies.empty,
    body: Body.uint8Array(body, getContentType(options, headers))
  })
}

const getContentType = (
  options: Options | undefined,
  headers: Headers.Headers
): string | undefined => {
  if (options?.contentType) {
    return options.contentType
  } else if (options?.headers) {
    return headers["content-type"]
  }
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const text = (
  body: string,
  options?: Options.WithContentType
): HttpServerResponse => {
  const headers = options?.headers ? Headers.fromInput(options.headers) : Headers.empty
  return makeResponse({
    status: options?.status ?? 200,
    statusText: options?.statusText,
    headers,
    cookies: options?.cookies ?? Cookies.empty,
    body: Body.text(body, getContentType(options, headers))
  })
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const html: {
  <A extends ReadonlyArray<Template.Interpolated>>(
    strings: TemplateStringsArray,
    ...args: A
  ): Effect.Effect<
    HttpServerResponse,
    Template.Interpolated.Error<A[number]>,
    Template.Interpolated.Context<A[number]>
  >
  (html: string): HttpServerResponse
} = (
  strings: TemplateStringsArray | string,
  ...args: ReadonlyArray<Template.Interpolated>
) => {
  if (typeof strings === "string") {
    return text(strings, { contentType: "text/html" })
  }

  return Effect.map(
    Template.make(strings, ...args),
    (_) => text(_, { contentType: "text/html" })
  ) as any
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const htmlStream = <A extends ReadonlyArray<Template.InterpolatedWithStream>>(
  strings: TemplateStringsArray,
  ...args: A
): Effect.Effect<
  HttpServerResponse,
  never,
  Template.Interpolated.Context<A[number]>
> =>
  Effect.map(
    Effect.services<Template.Interpolated.Context<A[number]>>(),
    (context) =>
      stream(
        Stream.provideServices(
          Stream.encodeText(Template.stream(strings, ...args)),
          context
        ),
        { contentType: "text/html" }
      )
  )

/**
 * @since 4.0.0
 * @category constructors
 */
export const json = (
  body: unknown,
  options?: Options.WithContent | undefined
): Effect.Effect<HttpServerResponse, Body.HttpBodyError> =>
  Effect.map(Body.json(body), (body) =>
    makeResponse({
      status: options?.status ?? 200,
      statusText: options?.statusText,
      headers: options?.headers && Headers.fromInput(options.headers),
      cookies: options?.cookies,
      body
    }))

/**
 * @since 4.0.0
 * @category constructors
 */
export const schemaJson = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  options?: ParseOptions | undefined
) => {
  const encode = Body.jsonSchema(schema, options)
  return (
    body: A,
    options?: Options.WithContent | undefined
  ): Effect.Effect<HttpServerResponse, Body.HttpBodyError, RE> =>
    Effect.map(encode(body), (body) =>
      makeResponse({
        status: options?.status ?? 200,
        statusText: options?.statusText,
        headers: options?.headers && Headers.fromInput(options.headers),
        cookies: options?.cookies,
        body
      }))
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const unsafeJson = (
  body: unknown,
  options?: Options.WithContent | undefined
): HttpServerResponse =>
  makeResponse({
    status: options?.status ?? 200,
    statusText: options?.statusText,
    headers: options?.headers && Headers.fromInput(options.headers),
    cookies: options?.cookies,
    body: Body.unsafeJson(body)
  })

/**
 * @since 4.0.0
 * @category constructors
 */
export const urlParams = (
  body: UrlParams.Input,
  options?: Options.WithContent | undefined
): HttpServerResponse =>
  makeResponse({
    status: options?.status ?? 200,
    statusText: options?.statusText,
    headers: options?.headers && Headers.fromInput(options.headers),
    cookies: options?.cookies,
    body: Body.text(UrlParams.toString(UrlParams.fromInput(body)), "application/x-www-form-urlencoded")
  })

/**
 * @since 4.0.0
 * @category constructors
 */
export const raw = (body: unknown, options?: Options | undefined): HttpServerResponse =>
  makeResponse({
    status: options?.status ?? 200,
    statusText: options?.statusText,
    headers: options?.headers && Headers.fromInput(options.headers),
    cookies: options?.cookies,
    body: Body.raw(body, {
      contentType: options?.contentType,
      contentLength: options?.contentLength
    })
  })

/**
 * @since 4.0.0
 * @category constructors
 */
export const formData = (
  body: FormData,
  options?: Options.WithContent | undefined
): HttpServerResponse =>
  makeResponse({
    status: options?.status ?? 200,
    statusText: options?.statusText,
    headers: options?.headers && Headers.fromInput(options.headers),
    cookies: options?.cookies,
    body: Body.formData(body)
  })

/**
 * @since 4.0.0
 * @category constructors
 */
export const stream = <E>(
  body: Stream.Stream<Uint8Array, E>,
  options?: Options | undefined
): HttpServerResponse => {
  const headers = options?.headers ? Headers.fromInput(options.headers) : Headers.empty
  return makeResponse({
    status: options?.status ?? 200,
    statusText: options?.statusText,
    headers,
    cookies: options?.cookies,
    body: Body.stream(body, getContentType(options, headers), options?.contentLength)
  })
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const file = (
  path: string,
  options?: (Options & FileSystem.StreamOptions) | undefined
): Effect.Effect<HttpServerResponse, PlatformError, HttpPlatform> =>
  Effect.flatMap(
    HttpPlatform.asEffect(),
    (platform) => platform.fileResponse(path, options)
  )

/**
 * @since 4.0.0
 * @category constructors
 */
export const fileWeb = (
  file: Body.HttpBody.FileLike,
  options?: (Options.WithContent & FileSystem.StreamOptions) | undefined
): Effect.Effect<HttpServerResponse, never, HttpPlatform> =>
  Effect.flatMap(
    HttpPlatform.asEffect(),
    (platform) => platform.fileWebResponse(file, options)
  )

/**
 * @since 4.0.0
 * @category combinators
 */
export const setHeader: {
  (key: string, value: string): (self: HttpServerResponse) => HttpServerResponse
  (self: HttpServerResponse, key: string, value: string): HttpServerResponse
} = dual(3, (self: HttpServerResponse, key: string, value: string): HttpServerResponse =>
  makeResponse({
    ...self,
    headers: Headers.set(self.headers, key, value)
  }))

/**
 * @since 4.0.0
 * @category combinators
 */
export const setHeaders: {
  (input: Headers.Input): (self: HttpServerResponse) => HttpServerResponse
  (self: HttpServerResponse, input: Headers.Input): HttpServerResponse
} = dual(2, (self: HttpServerResponse, input: Headers.Input): HttpServerResponse =>
  makeResponse({
    ...self,
    headers: Headers.setAll(self.headers, input)
  }))

/**
 * @since 4.0.0
 * @category combinators
 */
export const removeCookie: {
  (name: string): (self: HttpServerResponse) => HttpServerResponse
  (self: HttpServerResponse, name: string): HttpServerResponse
} = dual(2, (self: HttpServerResponse, name: string): HttpServerResponse =>
  makeResponse({
    ...self,
    cookies: Cookies.remove(self.cookies, name)
  }))

/**
 * @since 4.0.0
 * @category combinators
 */
export const replaceCookies: {
  (cookies: Cookies.Cookies): (self: HttpServerResponse) => HttpServerResponse
  (self: HttpServerResponse, cookies: Cookies.Cookies): HttpServerResponse
} = dual(
  2,
  (self: HttpServerResponse, cookies: Cookies.Cookies): HttpServerResponse => makeResponse({ ...self, cookies })
)

/**
 * @since 4.0.0
 * @category combinators
 */
export const setCookie: {
  (
    name: string,
    value: string,
    options?: Cookies.Cookie["options"]
  ): (
    self: HttpServerResponse
  ) => Effect.Effect<
    HttpServerResponse,
    Cookies.CookiesError
  >
  (
    self: HttpServerResponse,
    name: string,
    value: string,
    options?: Cookies.Cookie["options"]
  ): Effect.Effect<
    HttpServerResponse,
    Cookies.CookiesError
  >
} = dual(
  (args) => isHttpServerResponse(args[0]),
  (self: HttpServerResponse, name: string, value: string, options?: Cookies.Cookie["options"]): Effect.Effect<
    HttpServerResponse,
    Cookies.CookiesError
  > =>
    Effect.map(Cookies.set(self.cookies, name, value, options).asEffect(), (cookies) =>
      makeResponse({
        ...self,
        cookies
      }))
)

/**
 * @since 4.0.0
 * @category combinators
 */
export const unsafeSetCookie: {
  (
    name: string,
    value: string,
    options?: Cookies.Cookie["options"]
  ): (self: HttpServerResponse) => HttpServerResponse
  (
    self: HttpServerResponse,
    name: string,
    value: string,
    options?: Cookies.Cookie["options"]
  ): HttpServerResponse
} = dual(
  (args) => isHttpServerResponse(args[0]),
  (self: HttpServerResponse, name: string, value: string, options?: Cookies.Cookie["options"]): HttpServerResponse =>
    makeResponse({
      ...self,
      cookies: Cookies.unsafeSet(self.cookies, name, value, options)
    })
)

/**
 * @since 4.0.0
 * @category combinators
 */
export const updateCookies: {
  (f: (cookies: Cookies.Cookies) => Cookies.Cookies): (self: HttpServerResponse) => HttpServerResponse
  (self: HttpServerResponse, f: (cookies: Cookies.Cookies) => Cookies.Cookies): HttpServerResponse
} = dual(
  2,
  (self: HttpServerResponse, f: (cookies: Cookies.Cookies) => Cookies.Cookies): HttpServerResponse =>
    makeResponse({
      ...self,
      cookies: f(self.cookies)
    })
)

/**
 * @since 4.0.0
 * @category combinators
 */
export const mergeCookies: {
  (cookies: Cookies.Cookies): (self: HttpServerResponse) => HttpServerResponse
  (self: HttpServerResponse, cookies: Cookies.Cookies): HttpServerResponse
} = dual(
  2,
  (self: HttpServerResponse, cookies: Cookies.Cookies): HttpServerResponse =>
    makeResponse({ ...self, cookies: Cookies.merge(self.cookies, cookies) })
)

/**
 * @since 4.0.0
 * @category combinators
 */
export const setCookies: {
  (
    cookies: Iterable<
      readonly [
        name: string,
        value: string,
        options?: Cookies.Cookie["options"]
      ]
    >
  ): (self: HttpServerResponse) => Effect.Effect<HttpServerResponse, Cookies.CookiesError, never>
  (
    self: HttpServerResponse,
    cookies: Iterable<
      readonly [
        name: string,
        value: string,
        options?: Cookies.Cookie["options"]
      ]
    >
  ): Effect.Effect<HttpServerResponse, Cookies.CookiesError, never>
} = dual(2, (
  self: HttpServerResponse,
  cookies: Iterable<
    readonly [
      name: string,
      value: string,
      options?: Cookies.Cookie["options"]
    ]
  >
): Effect.Effect<HttpServerResponse, Cookies.CookiesError> =>
  Effect.map(Cookies.setAll(self.cookies, cookies).asEffect(), (cookies) =>
    makeResponse({
      ...self,
      cookies
    })))

/**
 * @since 4.0.0
 * @category combinators
 */
export const unsafeSetCookies: {
  (
    cookies: Iterable<
      readonly [
        name: string,
        value: string,
        options?: Cookies.Cookie["options"]
      ]
    >
  ): (self: HttpServerResponse) => HttpServerResponse
  (
    self: HttpServerResponse,
    cookies: Iterable<
      readonly [
        name: string,
        value: string,
        options?: Cookies.Cookie["options"]
      ]
    >
  ): HttpServerResponse
} = dual(2, (
  self: HttpServerResponse,
  cookies: Iterable<
    readonly [
      name: string,
      value: string,
      options?: Cookies.Cookie["options"]
    ]
  >
): HttpServerResponse =>
  makeResponse({
    ...self,
    cookies: Cookies.unsafeSetAll(self.cookies, cookies)
  }))

/**
 * @since 4.0.0
 * @category combinators
 */
export const setBody: {
  (body: Body.HttpBody): (self: HttpServerResponse) => HttpServerResponse
  (self: HttpServerResponse, body: Body.HttpBody): HttpServerResponse
} = dual(2, (self: HttpServerResponse, body: Body.HttpBody): HttpServerResponse => makeResponse({ ...self, body }))

/**
 * @since 4.0.0
 * @category combinators
 */
export const setStatus: {
  (status: number, statusText?: string | undefined): (self: HttpServerResponse) => HttpServerResponse
  (self: HttpServerResponse, status: number, statusText?: string | undefined): HttpServerResponse
} = dual(
  (args) => isHttpServerResponse(args[0]),
  (self: HttpServerResponse, status: number, statusText?: string | undefined): HttpServerResponse =>
    makeResponse({
      ...self,
      status,
      statusText: statusText ?? self.statusText
    })
)

/**
 * @since 4.0.0
 * @category conversions
 */
export const toWeb = (response: HttpServerResponse, options?: {
  readonly withoutBody?: boolean | undefined
  readonly services?: ServiceMap.ServiceMap<never> | undefined
}): Response => {
  const headers = new globalThis.Headers(response.headers)
  if (!Cookies.isEmpty(response.cookies)) {
    const toAdd = Cookies.toSetCookieHeaders(response.cookies)
    for (const header of toAdd) {
      headers.append("set-cookie", header)
    }
  }
  if (options?.withoutBody) {
    return new Response(undefined, {
      status: response.status,
      statusText: response.statusText as string,
      headers
    })
  }
  const body = response.body
  switch (body._tag) {
    case "Empty": {
      return new Response(undefined, {
        status: response.status,
        statusText: response.statusText as string,
        headers
      })
    }
    case "Uint8Array":
    case "Raw": {
      if (body.body instanceof Response) {
        for (const [key, value] of headers as any) {
          body.body.headers.set(key, value)
        }
        return body.body
      }
      return new Response(body.body as any, {
        status: response.status,
        statusText: response.statusText!,
        headers
      })
    }
    case "FormData": {
      return new Response(body.formData as any, {
        status: response.status,
        statusText: response.statusText!,
        headers
      })
    }
    case "Stream": {
      return new Response(Stream.toReadableStreamWith(body.stream, options?.services ?? ServiceMap.empty()), {
        status: response.status,
        statusText: response.statusText!,
        headers
      })
    }
  }
}

const Proto: Omit<HttpServerResponse, "status" | "statusText" | "headers" | "cookies" | "body"> = {
  ...PipeInspectableProto,
  ...YieldableProto,
  [TypeId]: TypeId,
  asEffect(this: HttpServerResponse) {
    return Effect.succeed(this)
  },
  toJSON(this: HttpServerResponse) {
    return {
      _id: "HttpServerResponse",
      status: this.status,
      statusText: this.statusText,
      headers: Inspectable.redact(this.headers),
      cookies: this.cookies.toJSON(),
      body: this.body.toJSON()
    }
  }
}

const makeResponse = (options: {
  readonly status: number
  readonly statusText?: string | undefined
  readonly headers?: Headers.Headers | undefined
  readonly cookies?: Cookies.Cookies | undefined
  readonly body?: Body.HttpBody | undefined
}) => {
  const self = Object.create(Proto) as Mutable<HttpServerResponse>
  self.status = options.status
  self.statusText = options.statusText
  self.cookies = options.cookies ?? Cookies.empty
  self.body = options.body ?? Body.empty
  if (self.body._tag !== "Empty" && (self.body.contentType || self.body.contentLength)) {
    const newHeaders = Headers.unsafeFromRecord({ ...options.headers }) as any
    if (self.body.contentType) {
      newHeaders["content-type"] = self.body.contentType
    }
    if (self.body.contentLength) {
      newHeaders["content-length"] = self.body.contentLength.toString()
    }
    self.headers = newHeaders
  } else {
    self.headers = options.headers ?? Headers.empty
  }
  return self
}
