/**
 * @since 4.0.0
 */
import * as Data from "../../data/Data.ts"
import * as Option from "../../data/Option.ts"
import * as Predicate from "../../data/Predicate.ts"
import * as Record from "../../data/Record.ts"
import * as Result from "../../data/Result.ts"
import { dual, identity } from "../../Function.ts"
import * as Inspectable from "../../interfaces/Inspectable.ts"
import { type Pipeable, pipeArguments } from "../../interfaces/Pipeable.ts"
import * as Schema from "../../schema/Schema.ts"
import * as Transformation from "../../schema/Transformation.ts"
import * as Duration from "../../time/Duration.ts"
import type * as Types from "../../types/Types.ts"

/**
 * @since 4.0.0
 * @category type ids
 */
export const TypeId: TypeId = "~effect/http/Cookies"

/**
 * @since 4.0.0
 * @category type ids
 */
export type TypeId = "~effect/http/Cookies"

/**
 * @since 4.0.0
 * @category refinements
 */
export const isCookies = (u: unknown): u is Cookies => Predicate.hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category models
 */
export interface Cookies extends Pipeable, Inspectable.Inspectable {
  readonly [TypeId]: TypeId
  readonly cookies: Record.ReadonlyRecord<string, Cookie>
}

/**
 * @since 4.0.0
 * @category Schemas
 */
export const schema: Schema.Codec<Cookies> = Schema.declare(
  isCookies,
  {
    identifier: "Cookies",
    defaultJsonSerializer: () =>
      Schema.link<Cookies>()(
        Schema.Array(Schema.String),
        Transformation.transform({
          decode: (input) => fromSetCookie(input),
          encode: (cookies) => toSetCookieHeaders(cookies)
        })
      )
  }
)

/**
 * @since 4.0.0
 * @category type ids
 */
export const CookieTypeId: CookieTypeId = "~effect/http/Cookies/Cookie"

/**
 * @since 4.0.0
 * @category type ids
 */
export type CookieTypeId = "~effect/http/Cookies/Cookie"

/**
 * @since 4.0.0
 * @category cookie
 */
export interface Cookie extends Inspectable.Inspectable {
  readonly [CookieTypeId]: CookieTypeId
  readonly name: string
  readonly value: string
  readonly valueEncoded: string
  readonly options?: {
    readonly domain?: string | undefined
    readonly expires?: Date | undefined
    readonly maxAge?: Duration.DurationInput | undefined
    readonly path?: string | undefined
    readonly priority?: "low" | "medium" | "high" | undefined
    readonly httpOnly?: boolean | undefined
    readonly secure?: boolean | undefined
    readonly partitioned?: boolean | undefined
    readonly sameSite?: "lax" | "strict" | "none" | undefined
  } | undefined
}

/**
 * @since 4.0.0
 * @category Guards
 */
export const isCookie = (u: unknown): u is Cookie => Predicate.hasProperty(u, CookieTypeId)

/**
 * @since 4.0.0
 * @category type ids
 */
export const ErrorTypeId: ErrorTypeId = "~effect/http/Cookies/CookieError"

/**
 * @since 4.0.0
 * @category type ids
 */
export type ErrorTypeId = "~effect/http/Cookies/CookieError"

/**
 * @since 4.0.0
 * @category errors
 */
export class CookiesError extends Data.TaggedError("CookieError")<{
  readonly reason: "InvalidName" | "InvalidValue" | "InvalidDomain" | "InvalidPath" | "InfinityMaxAge"
  readonly cause?: unknown
}> {
  /**
   * @since 4.0.0
   */
  readonly [ErrorTypeId]: ErrorTypeId = ErrorTypeId

  /**
   * @since 4.0.0
   */
  override get message() {
    return this.reason
  }
}

const Proto: Omit<Cookies, "cookies"> = {
  [TypeId]: TypeId,
  ...Inspectable.BaseProto,
  toJSON(this: Cookies) {
    return {
      _id: "effect/Cookies",
      cookies: Record.map(this.cookies, (cookie) => cookie.toJSON())
    }
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
}

/**
 * Create a Cookies object from an Iterable
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromReadonlyRecord = (cookies: Record.ReadonlyRecord<string, Cookie>): Cookies => {
  const self = Object.create(Proto)
  self.cookies = cookies
  return self
}

/**
 * Create a Cookies object from an Iterable
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromIterable = (cookies: Iterable<Cookie>): Cookies => {
  const record: Record<string, Cookie> = {}
  for (const cookie of cookies) {
    record[cookie.name] = cookie
  }
  return fromReadonlyRecord(record)
}

/**
 * Create a Cookies object from a set of Set-Cookie headers
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromSetCookie = (headers: Iterable<string> | string): Cookies => {
  const arrayHeaders = typeof headers === "string" ? [headers] : headers
  const cookies: Array<Cookie> = []
  for (const header of arrayHeaders) {
    const cookie = parseSetCookie(header.trim())
    if (Option.isSome(cookie)) {
      cookies.push(cookie.value)
    }
  }

  return fromIterable(cookies)
}

function parseSetCookie(header: string): Option.Option<Cookie> {
  const parts = header.split(";").map((_) => _.trim()).filter((_) => _ !== "")
  if (parts.length === 0) {
    return Option.none()
  }

  const firstEqual = parts[0].indexOf("=")
  if (firstEqual === -1) {
    return Option.none()
  }
  const name = parts[0].slice(0, firstEqual)
  if (!fieldContentRegExp.test(name)) {
    return Option.none()
  }

  const valueEncoded = parts[0].slice(firstEqual + 1)
  const value = tryDecodeURIComponent(valueEncoded)

  if (parts.length === 1) {
    return Option.some(Object.assign(Object.create(CookieProto), {
      name,
      value,
      valueEncoded
    }))
  }

  const options: Types.Mutable<Cookie["options"]> = {}

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    const equalIndex = part.indexOf("=")
    const key = equalIndex === -1 ? part : part.slice(0, equalIndex).trim()
    const value = equalIndex === -1 ? undefined : part.slice(equalIndex + 1).trim()

    switch (key.toLowerCase()) {
      case "domain": {
        if (value === undefined) {
          break
        }
        const domain = value.trim().replace(/^\./, "")
        if (domain) {
          options.domain = domain
        }
        break
      }
      case "expires": {
        if (value === undefined) {
          break
        }
        const date = new Date(value)
        if (!isNaN(date.getTime())) {
          options.expires = date
        }
        break
      }
      case "max-age": {
        if (value === undefined) {
          break
        }
        const maxAge = parseInt(value, 10)
        if (!isNaN(maxAge)) {
          options.maxAge = Duration.seconds(maxAge)
        }
        break
      }
      case "path": {
        if (value === undefined) {
          break
        }
        if (value[0] === "/") {
          options.path = value
        }
        break
      }
      case "priority": {
        if (value === undefined) {
          break
        }
        switch (value.toLowerCase()) {
          case "low":
            options.priority = "low"
            break
          case "medium":
            options.priority = "medium"
            break
          case "high":
            options.priority = "high"
            break
        }
        break
      }
      case "httponly": {
        options.httpOnly = true
        break
      }
      case "secure": {
        options.secure = true
        break
      }
      case "partitioned": {
        options.partitioned = true
        break
      }
      case "samesite": {
        if (value === undefined) {
          break
        }
        switch (value.toLowerCase()) {
          case "lax":
            options.sameSite = "lax"
            break
          case "strict":
            options.sameSite = "strict"
            break
          case "none":
            options.sameSite = "none"
            break
        }
        break
      }
    }
  }

  return Option.some(Object.assign(Object.create(CookieProto), {
    name,
    value,
    valueEncoded,
    options: Object.keys(options).length > 0 ? options : undefined
  }))
}

/**
 * An empty Cookies object
 *
 * @since 4.0.0
 * @category constructors
 */
export const empty: Cookies = fromIterable([])

/**
 * @since 4.0.0
 * @category refinements
 */
export const isEmpty = (self: Cookies): boolean => Record.isEmptyRecord(self.cookies)

// eslint-disable-next-line no-control-regex
const fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/

const CookieProto = {
  [CookieTypeId]: CookieTypeId,
  ...Inspectable.BaseProto,
  toJSON(this: Cookie) {
    return {
      _id: "effect/Cookies/Cookie",
      name: this.name,
      value: this.value,
      options: this.options
    }
  }
}

/**
 * Create a new cookie
 *
 * @since 4.0.0
 * @category constructors
 */
export function makeCookie(
  name: string,
  value: string,
  options?: Cookie["options"] | undefined
): Result.Result<Cookie, CookiesError> {
  if (!fieldContentRegExp.test(name)) {
    return Result.fail(new CookiesError({ reason: "InvalidName" }))
  }
  const encodedValue = encodeURIComponent(value)
  if (encodedValue && !fieldContentRegExp.test(encodedValue)) {
    return Result.fail(new CookiesError({ reason: "InvalidValue" }))
  }

  if (options !== undefined) {
    if (options.domain !== undefined && !fieldContentRegExp.test(options.domain)) {
      return Result.fail(new CookiesError({ reason: "InvalidDomain" }))
    }

    if (options.path !== undefined && !fieldContentRegExp.test(options.path)) {
      return Result.fail(new CookiesError({ reason: "InvalidPath" }))
    }

    if (options.maxAge !== undefined && !Duration.isFinite(Duration.decode(options.maxAge))) {
      return Result.fail(new CookiesError({ reason: "InfinityMaxAge" }))
    }
  }

  return Result.succeed(Object.assign(Object.create(CookieProto), {
    name,
    value,
    valueEncoded: encodedValue,
    options
  }))
}

/**
 * Create a new cookie, throwing an error if invalid
 *
 * @since 4.0.0
 * @category constructors
 */
export const makeCookieUnsafe = (
  name: string,
  value: string,
  options?: Cookie["options"] | undefined
): Cookie => Result.getOrThrowWith(makeCookie(name, value, options), identity)

/**
 * Add a cookie to a Cookies object
 *
 * @since 4.0.0
 * @category combinators
 */
export const setCookie: {
  (cookie: Cookie): (self: Cookies) => Cookies
  (
    self: Cookies,
    cookie: Cookie
  ): Cookies
} = dual(
  2,
  (self: Cookies, cookie: Cookie) =>
    fromReadonlyRecord(Record.set(
      self.cookies,
      cookie.name,
      cookie
    ))
)

/**
 * Add multiple cookies to a Cookies object
 *
 * @since 4.0.0
 * @category combinators
 */
export const setAllCookie: {
  (cookies: Iterable<Cookie>): (self: Cookies) => Cookies
  (
    self: Cookies,
    cookies: Iterable<Cookie>
  ): Cookies
} = dual(2, (self: Cookies, cookies: Iterable<Cookie>) => {
  const record = { ...self.cookies }
  for (const cookie of cookies) {
    record[cookie.name] = cookie
  }
  return fromReadonlyRecord(record)
})

/**
 * Combine two Cookies objects, removing duplicates from the first
 *
 * @since 4.0.0
 * @category combinators
 */
export const merge: {
  (that: Cookies): (self: Cookies) => Cookies
  (
    self: Cookies,
    that: Cookies
  ): Cookies
} = dual(2, (self: Cookies, that: Cookies) =>
  fromReadonlyRecord({
    ...self.cookies,
    ...that.cookies
  }))

/**
 * Remove a cookie by name
 *
 * @since 4.0.0
 * @category combinators
 */
export const remove: {
  (name: string): (self: Cookies) => Cookies
  (
    self: Cookies,
    name: string
  ): Cookies
} = dual(2, (self: Cookies, name: string) => fromReadonlyRecord(Record.remove(self.cookies, name)))

/**
 * Get a cookie from a Cookies object
 *
 * @since 4.0.0
 * @category combinators
 */
export const get: {
  (name: string): (self: Cookies) => Option.Option<Cookie>
  (self: Cookies, name: string): Option.Option<Cookie>
} = dual(
  (args) => isCookies(args[0]),
  (self: Cookies, name: string): Option.Option<Cookie> => Record.get(self.cookies, name)
)

/**
 * Get a cookie from a Cookies object
 *
 * @since 4.0.0
 * @category combinators
 */
export const getValue: {
  (name: string): (self: Cookies) => Option.Option<string>
  (self: Cookies, name: string): Option.Option<string>
} = dual(
  (args) => isCookies(args[0]),
  (self: Cookies, name: string): Option.Option<string> =>
    Option.map(Record.get(self.cookies, name), (cookie) => cookie.value)
)

/**
 * Add a cookie to a Cookies object
 *
 * @since 4.0.0
 * @category combinators
 */
export const set: {
  (
    name: string,
    value: string,
    options?: Cookie["options"]
  ): (self: Cookies) => Result.Result<Cookies, CookiesError>
  (
    self: Cookies,
    name: string,
    value: string,
    options?: Cookie["options"]
  ): Result.Result<Cookies, CookiesError>
} = dual(
  (args) => isCookies(args[0]),
  (self: Cookies, name: string, value: string, options?: Cookie["options"]) =>
    Result.map(
      makeCookie(name, value, options),
      (cookie) => fromReadonlyRecord(Record.set(self.cookies, name, cookie))
    )
)

/**
 * Add a cookie to a Cookies object
 *
 * @since 4.0.0
 * @category combinators
 */
export const setUnsafe: {
  (
    name: string,
    value: string,
    options?: Cookie["options"]
  ): (self: Cookies) => Cookies
  (
    self: Cookies,
    name: string,
    value: string,
    options?: Cookie["options"]
  ): Cookies
} = dual(
  (args) => isCookies(args[0]),
  (self: Cookies, name: string, value: string, options?: Cookie["options"]) =>
    fromReadonlyRecord(Record.set(
      self.cookies,
      name,
      makeCookieUnsafe(name, value, options)
    ))
)

/**
 * Add multiple cookies to a Cookies object
 *
 * @since 4.0.0
 * @category combinators
 */
export const setAll: {
  (
    cookies: Iterable<readonly [name: string, value: string, options?: Cookie["options"]]>
  ): (self: Cookies) => Result.Result<Cookies, CookiesError>
  (
    self: Cookies,
    cookies: Iterable<readonly [name: string, value: string, options?: Cookie["options"]]>
  ): Result.Result<Cookies, CookiesError>
} = dual(
  2,
  (
    self: Cookies,
    cookies: Iterable<readonly [name: string, value: string, options?: Cookie["options"]]>
  ): Result.Result<Cookies, CookiesError> => {
    const record: Record<string, Cookie> = { ...self.cookies }
    for (const [name, value, options] of cookies) {
      const result = makeCookie(name, value, options)
      if (Result.isFailure(result)) {
        return result as Result.Failure<never, CookiesError>
      }
      record[name] = result.success
    }
    return Result.succeed(fromReadonlyRecord(record))
  }
)

/**
 * Add multiple cookies to a Cookies object, throwing an error if invalid
 *
 * @since 4.0.0
 * @category combinators
 */
export const setAllUnsafe: {
  (
    cookies: Iterable<readonly [name: string, value: string, options?: Cookie["options"]]>
  ): (self: Cookies) => Cookies
  (
    self: Cookies,
    cookies: Iterable<readonly [name: string, value: string, options?: Cookie["options"]]>
  ): Cookies
} = dual(
  2,
  (
    self: Cookies,
    cookies: Iterable<readonly [name: string, value: string, options?: Cookie["options"]]>
  ): Cookies => Result.getOrThrowWith(setAll(self, cookies), identity)
)

/**
 * Serialize a cookie into a string
 *
 * Adapted from https://github.com/fastify/fastify-cookie under MIT License
 *
 * @since 4.0.0
 * @category encoding
 */
export function serializeCookie(self: Cookie): string {
  let str = self.name + "=" + self.valueEncoded

  if (self.options === undefined) {
    return str
  }
  const options = self.options

  if (options.maxAge !== undefined) {
    const maxAge = Duration.toSeconds(options.maxAge)
    str += "; Max-Age=" + Math.trunc(maxAge)
  }

  if (options.domain !== undefined) {
    str += "; Domain=" + options.domain
  }

  if (options.path !== undefined) {
    str += "; Path=" + options.path
  }

  if (options.priority !== undefined) {
    switch (options.priority) {
      case "low":
        str += "; Priority=Low"
        break
      case "medium":
        str += "; Priority=Medium"
        break
      case "high":
        str += "; Priority=High"
        break
    }
  }

  if (options.expires !== undefined) {
    str += "; Expires=" + options.expires.toUTCString()
  }

  if (options.httpOnly) {
    str += "; HttpOnly"
  }

  if (options.secure) {
    str += "; Secure"
  }

  // Draft implementation to support Chrome from 2024-Q1 forward.
  // See https://datatracker.ietf.org/doc/html/draft-cutler-httpbis-partitioned-cookies#section-2.1
  if (options.partitioned) {
    str += "; Partitioned"
  }

  if (options.sameSite !== undefined) {
    switch (options.sameSite) {
      case "lax":
        str += "; SameSite=Lax"
        break
      case "strict":
        str += "; SameSite=Strict"
        break
      case "none":
        str += "; SameSite=None"
        break
    }
  }

  return str
}

/**
 * Serialize a Cookies object into a Cookie header
 *
 * @since 4.0.0
 * @category encoding
 */
export const toCookieHeader = (self: Cookies): string =>
  Object.values(self.cookies).map((cookie) => `${cookie.name}=${cookie.valueEncoded}`).join("; ")

/**
 * @since 4.0.0
 * @category encoding
 */
export const toRecord = (self: Cookies): Record<string, string> => {
  const record: Record<string, string> = {}
  const cookies = Object.values(self.cookies)
  for (let index = 0; index < cookies.length; index++) {
    const cookie = cookies[index]
    record[cookie.name] = cookie.value
  }
  return record
}

/**
 * @since 4.0.0
 * @category Schemas
 */
export const schemaRecord: Schema.Codec<
  Record<string, string>,
  Cookies
> = schema.pipe(
  Schema.decodeTo(
    Schema.Record(Schema.String, Schema.String),
    Transformation.transform({
      decode: toRecord,
      encode: (self) => fromIterable(Object.entries(self).map(([name, value]) => makeCookieUnsafe(name, value)))
    })
  )
)

/**
 * Serialize a Cookies object into Headers object containing one or more Set-Cookie headers
 *
 * @since 4.0.0
 * @category encoding
 */
export const toSetCookieHeaders = (self: Cookies): Array<string> => Object.values(self.cookies).map(serializeCookie)

/**
 * Parse a cookie header into a record of key-value pairs
 *
 * Adapted from https://github.com/fastify/fastify-cookie under MIT License
 *
 * @since 4.0.0
 * @category decoding
 */
export function parseHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {}

  const strLen = header.length
  let pos = 0
  let terminatorPos = 0

  while (true) {
    if (terminatorPos === strLen) break
    terminatorPos = header.indexOf(";", pos)
    if (terminatorPos === -1) terminatorPos = strLen // This is the last pair

    let eqIdx = header.indexOf("=", pos)
    if (eqIdx === -1) break // No key-value pairs left
    if (eqIdx > terminatorPos) {
      // Malformed key-value pair
      pos = terminatorPos + 1
      continue
    }

    const key = header.substring(pos, eqIdx++).trim()
    if (result[key] === undefined) {
      const val = header.charCodeAt(eqIdx) === 0x22
        ? header.substring(eqIdx + 1, terminatorPos - 1).trim()
        : header.substring(eqIdx, terminatorPos).trim()

      result[key] = !(val.indexOf("%") === -1)
        ? tryDecodeURIComponent(val)
        : val
    }

    pos = terminatorPos + 1
  }

  return result
}

const tryDecodeURIComponent = (str: string): string => {
  try {
    return decodeURIComponent(str)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) {
    return str
  }
}
