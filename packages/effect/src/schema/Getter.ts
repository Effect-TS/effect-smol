/**
 * @since 4.0.0
 */
import * as Option from "../data/Option.ts"
import * as Predicate from "../data/Predicate.ts"
import * as Result from "../data/Result.ts"
import * as DateTime from "../DateTime.ts"
import * as Effect from "../Effect.ts"
import * as Base64 from "../encoding/Base64.ts"
import * as Base64Url from "../encoding/Base64Url.ts"
import * as Hex from "../encoding/Hex.ts"
import { Class } from "../interfaces/Pipeable.ts"
import * as Str from "../String.ts"
import type * as Annotations from "./Annotations.ts"
import type * as AST from "./AST.ts"
import * as Issue from "./Issue.ts"

/**
 * @category model
 * @since 4.0.0
 */
export class Getter<out T, in E, R = never> extends Class {
  readonly run: (
    input: Option.Option<E>,
    options: AST.ParseOptions
  ) => Effect.Effect<Option.Option<T>, Issue.Issue, R>

  constructor(
    run: (
      input: Option.Option<E>,
      options: AST.ParseOptions
    ) => Effect.Effect<Option.Option<T>, Issue.Issue, R>
  ) {
    super()
    this.run = run
  }
  map<T2>(f: (t: T) => T2): Getter<T2, E, R> {
    return new Getter((oe, options) => this.run(oe, options).pipe(Effect.mapEager(Option.map(f))))
  }
  compose<T2, R2>(other: Getter<T2, T, R2>): Getter<T2, E, R | R2> {
    if (isPassthrough(this)) {
      return other as any
    }
    if (isPassthrough(other)) {
      return this as any
    }
    return new Getter((oe, options) => this.run(oe, options).pipe(Effect.flatMapEager((ot) => other.run(ot, options))))
  }
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function succeed<const T, E>(t: T): Getter<T, E> {
  return new Getter(() => Effect.succeedSome(t))
}

/**
 * Fail with an issue.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function fail<T, E>(f: (oe: Option.Option<E>) => Issue.Issue): Getter<T, E> {
  return new Getter((oe) => Effect.fail(f(oe)))
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function forbidden<T, E>(message: (oe: Option.Option<E>) => string): Getter<T, E> {
  return fail<T, E>((oe) => new Issue.Forbidden(oe, { message: message(oe) }))
}

const passthrough_ = new Getter<any, any>(Effect.succeed)

function isPassthrough<T, E, R>(getter: Getter<T, E, R>): getter is typeof passthrough_ {
  return getter.run === passthrough_.run
}

/**
 * Returns a getter that keeps the value as is.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function passthrough<T, E>(options: { readonly strict: false }): Getter<T, E>
export function passthrough<T>(): Getter<T, T>
export function passthrough<T>(): Getter<T, T> {
  return passthrough_
}

/**
 * Returns a getter that keeps the value as is.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function passthroughSupertype<T extends E, E>(): Getter<T, E>
export function passthroughSupertype<T>(): Getter<T, T> {
  return passthrough_
}

/**
 * Returns a getter that keeps the value as is.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function passthroughSubtype<T, E extends T>(): Getter<T, E>
export function passthroughSubtype<T>(): Getter<T, T> {
  return passthrough_
}

/**
 * Returns a getter that handles missing encoded values, i.e. when the input is
 * `Option.None`.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function onNone<T, E extends T = T, R = never>(
  f: (options: AST.ParseOptions) => Effect.Effect<Option.Option<T>, Issue.Issue, R>
): Getter<T, E, R> {
  return new Getter((ot, options) => Option.isNone(ot) ? f(options) : Effect.succeed(ot))
}

/**
 * Returns a getter that fails if the input is `Option.None`.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function required<T, E extends T = T>(annotations?: Annotations.Key<T>): Getter<T, E> {
  return onNone(() => Effect.fail(new Issue.MissingKey(annotations)))
}

/**
 * Returns a getter that handles defined encoded values.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function onSome<T, E, R = never>(
  f: (e: E, options: AST.ParseOptions) => Effect.Effect<Option.Option<T>, Issue.Issue, R>
): Getter<T, E, R> {
  return new Getter((oe, options) => Option.isNone(oe) ? Effect.succeedNone : f(oe.value, options))
}

/**
 * Returns a getter that effectfully checks a value and returns an issue if the
 * check fails.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function checkEffect<T, R = never>(
  f: (input: T, options: AST.ParseOptions) => Effect.Effect<
    undefined | boolean | string | Issue.Issue | {
      readonly path: ReadonlyArray<PropertyKey>
      readonly message: string
    },
    never,
    R
  >
): Getter<T, T, R> {
  return onSome((t, options) => {
    return f(t, options).pipe(Effect.flatMapEager((out) => {
      const issue = Issue.make(t, out)
      return issue ?
        Effect.fail(issue) :
        Effect.succeed(Option.some(t))
    }))
  })
}

/**
 * Returns a getter that maps a defined value to a value.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function transform<T, E>(f: (e: E) => T): Getter<T, E> {
  return transformOptional(Option.map(f))
}

/**
 * Returns a getter that maps a defined value to a value or a failure.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function transformOrFail<T, E, R = never>(
  f: (e: E, options: AST.ParseOptions) => Effect.Effect<T, Issue.Issue, R>
): Getter<T, E, R> {
  return onSome((e, options) => f(e, options).pipe(Effect.mapEager(Option.some)))
}

/**
 * Returns a getter that maps a missing or a defined value to a missing or a
 * defined value.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function transformOptional<T, E>(f: (oe: Option.Option<E>) => Option.Option<T>): Getter<T, E> {
  return new Getter((oe) => Effect.succeed(f(oe)))
}

/**
 * Returns a getter that omits a value in the output.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function omit<T>(): Getter<never, T> {
  return new Getter(() => Effect.succeedNone)
}

/**
 * Returns a getter that provides a default value when the input is
 * `Option<undefined>`.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function withDefault<T>(defaultValue: () => T): Getter<T, T | undefined> {
  return transformOptional((o) =>
    o.pipe(
      Option.filter(Predicate.isNotUndefined),
      Option.orElseSome(defaultValue)
    )
  )
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export function String<E>(): Getter<string, E> {
  return transform(globalThis.String)
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export function Number<E>(): Getter<number, E> {
  return transform(globalThis.Number)
}

/**
 * @since 4.0.0
 */
export function parseFloat<E extends string>(): Getter<number, E> {
  return transform(globalThis.parseFloat)
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export function Boolean<E>(): Getter<boolean, E> {
  return transform(globalThis.Boolean)
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export function BigInt<E extends string | number | bigint | boolean>(): Getter<bigint, E> {
  return transform(globalThis.BigInt)
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export function Date<E extends string | number | Date>(): Getter<Date, E> {
  return transform((u) => new globalThis.Date(u))
}

/**
 * @category string
 * @since 4.0.0
 */
export function trim<E extends string>(): Getter<string, E> {
  return transform(Str.trim)
}

/**
 * @category string
 * @since 4.0.0
 */
export function capitalize<E extends string>(): Getter<string, E> {
  return transform(Str.capitalize)
}

/**
 * @category string
 * @since 4.0.0
 */
export function uncapitalize<E extends string>(): Getter<string, E> {
  return transform(Str.uncapitalize)
}

/**
 * @category string
 * @since 4.0.0
 */
export function snakeToCamel<E extends string>(): Getter<string, E> {
  return transform(Str.snakeToCamel)
}

/**
 * @category string
 * @since 4.0.0
 */
export function camelToSnake<E extends string>(): Getter<string, E> {
  return transform(Str.camelToSnake)
}

/**
 * @category string
 * @since 4.0.0
 */
export function toLowerCase<E extends string>(): Getter<string, E> {
  return transform(Str.toLowerCase)
}

/**
 * @category string
 * @since 4.0.0
 */
export function toUpperCase<E extends string>(): Getter<string, E> {
  return transform(Str.toUpperCase)
}

/**
 * @since 4.0.0
 */
export interface ParseJsonOptions {
  readonly reviver?: Parameters<typeof JSON.parse>[1]
}

/**
 * @category string
 * @since 4.0.0
 */
export function parseJson<E extends string>(options?: {
  readonly options?: ParseJsonOptions | undefined
}): Getter<unknown, E> {
  return onSome((input) =>
    Effect.try({
      try: () => Option.some(JSON.parse(input, options?.options?.reviver)),
      catch: (e) => new Issue.InvalidValue(Option.some(input), { message: globalThis.String(e) })
    })
  )
}

/**
 * @since 4.0.0
 */
export interface StringifyJsonOptions {
  readonly replacer?: Parameters<typeof JSON.stringify>[1]
  readonly space?: Parameters<typeof JSON.stringify>[2]
}

/**
 * @category string
 * @since 4.0.0
 */
export function stringifyJson(options?: {
  readonly options?: StringifyJsonOptions | undefined
}): Getter<string, unknown> {
  return onSome((input) =>
    Effect.try({
      try: () => Option.some(JSON.stringify(input, options?.options?.replacer, options?.options?.space)),
      catch: (e) => new Issue.InvalidValue(Option.some(input), { message: globalThis.String(e) })
    })
  )
}

/**
 * Parse a string into a record of key-value pairs.
 *
 * **Options**
 *
 * - `separator`: The separator between key-value pairs. Defaults to `,`.
 * - `keyValueSeparator`: The separator between key and value. Defaults to `=`.
 *
 * @category string
 * @since 4.0.0
 */
export function splitKeyValue<E extends string>(options?: {
  readonly separator?: string | undefined
  readonly keyValueSeparator?: string | undefined
}): Getter<Record<string, string>, E> {
  const separator = options?.separator ?? ","
  const keyValueSeparator = options?.keyValueSeparator ?? "="
  return transform((input) =>
    input.split(separator).reduce((acc, pair) => {
      const [key, value] = pair.split(keyValueSeparator)
      if (key && value) {
        acc[key] = value
      }
      return acc
    }, {} as Record<string, string>)
  )
}

/**
 * Join a record of key-value pairs into a string.
 *
 * **Options**
 *
 * - `separator`: The separator between key-value pairs. Defaults to `,`.
 * - `keyValueSeparator`: The separator between key and value. Defaults to `=`.
 *
 * @category string
 * @since 4.0.0
 */
export function joinKeyValue<E extends Record<PropertyKey, string>>(options?: {
  readonly separator?: string | undefined
  readonly keyValueSeparator?: string | undefined
}): Getter<string, E> {
  const separator = options?.separator ?? ","
  const keyValueSeparator = options?.keyValueSeparator ?? "="
  return transform((input) =>
    Object.entries(input).map(([key, value]) => `${key}${keyValueSeparator}${value}`).join(separator)
  )
}

/**
 * Parses a string into an array of strings.
 *
 * An empty string is parsed as an empty array.
 *
 * @category string
 * @since 4.0.0
 */
export function split<E extends string>(options?: {
  readonly separator?: string | undefined
}): Getter<ReadonlyArray<string>, E> {
  const separator = options?.separator ?? ","
  return transform((input) => input === "" ? [] : input.split(separator))
}

/**
 * @category Base64
 * @since 4.0.0
 */
export function encodeBase64<E extends Uint8Array | string>(): Getter<string, E> {
  return transform(Base64.encode)
}

/**
 * @category Base64
 * @since 4.0.0
 */
export function encodeBase64Url<E extends Uint8Array | string>(): Getter<string, E> {
  return transform(Base64Url.encode)
}

/**
 * @category Hex
 * @since 4.0.0
 */
export function encodeHex<E extends Uint8Array | string>(): Getter<string, E> {
  return transform(Hex.encode)
}

/**
 * @category Base64
 * @since 4.0.0
 */
export function decodeBase64<E extends string>(): Getter<Uint8Array, E> {
  return transformOrFail((input) =>
    Result.mapError(
      Base64.decode(input),
      (e) => new Issue.InvalidValue(Option.some(input), { message: e.message })
    ).asEffect()
  )
}

/**
 * @category Base64
 * @since 4.0.0
 */
export function decodeBase64String<E extends string>(): Getter<string, E> {
  return transformOrFail((input) =>
    Result.match(Base64.decodeString(input), {
      onFailure: (e) => Effect.fail(new Issue.InvalidValue(Option.some(input), { message: e.message })),
      onSuccess: Effect.succeed
    })
  )
}

/**
 * @category Base64
 * @since 4.0.0
 */
export function decodeBase64Url<E extends string>(): Getter<Uint8Array, E> {
  return transformOrFail((input) =>
    Result.match(Base64Url.decode(input), {
      onFailure: (e) => Effect.fail(new Issue.InvalidValue(Option.some(input), { message: e.message })),
      onSuccess: Effect.succeed
    })
  )
}

/**
 * @category Base64
 * @since 4.0.0
 */
export function decodeBase64UrlString<E extends string>(): Getter<string, E> {
  return transformOrFail((input) =>
    Result.match(Base64Url.decodeString(input), {
      onFailure: (e) => Effect.fail(new Issue.InvalidValue(Option.some(input), { message: e.message })),
      onSuccess: Effect.succeed
    })
  )
}

/**
 * @category Hex
 * @since 4.0.0
 */
export function decodeHex<E extends string>(): Getter<Uint8Array, E> {
  return transformOrFail((input) =>
    Result.match(Hex.decode(input), {
      onFailure: (e) => Effect.fail(new Issue.InvalidValue(Option.some(input), { message: e.message })),
      onSuccess: Effect.succeed
    })
  )
}

/**
 * @category Hex
 * @since 4.0.0
 */
export function decodeHexString<E extends string>(): Getter<string, E> {
  return transformOrFail((input) =>
    Result.match(Hex.decodeString(input), {
      onFailure: (e) => Effect.fail(new Issue.InvalidValue(Option.some(input), { message: e.message })),
      onSuccess: Effect.succeed
    })
  )
}

/**
 * @category DateTime
 * @since 4.0.0
 */
export function dateTimeUtcFromInput<E extends DateTime.DateTime.Input>(): Getter<DateTime.Utc, E> {
  return transformOrFail((input) => {
    const dt = DateTime.make(input)
    return dt
      ? Effect.succeed(DateTime.toUtc(dt))
      : Effect.fail(new Issue.InvalidValue(Option.some(input), { message: "Invalid DateTime input" }))
  })
}
