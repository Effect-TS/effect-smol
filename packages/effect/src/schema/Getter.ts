/**
 * @since 4.0.0
 */
import * as Option from "../data/Option.ts"
import * as Predicate from "../data/Predicate.ts"
import * as Result from "../data/Result.ts"
import * as Effect from "../Effect.ts"
import * as Encoding from "../encoding/Encoding.ts"
import { PipeableClass } from "../internal/schema/util.ts"
import * as Str from "../primitives/String.ts"
import * as DateTime from "../time/DateTime.ts"
import type * as Annotations from "./Annotations.ts"
import type * as AST from "./AST.ts"
import * as Issue from "./Issue.ts"

/**
 * @category model
 * @since 4.0.0
 */
export class Getter<out T, in E, R = never> extends PipeableClass {
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
 * @category constructors
 * @since 4.0.0
 */
export function succeed<const T, E>(t: T): Getter<T, E> {
  return new Getter(() => Effect.succeedSome(t))
}

/**
 * Fail with an issue.
 *
 * @category constructors
 * @since 4.0.0
 */
export function fail<T, E>(f: (oe: Option.Option<E>) => Issue.Issue): Getter<T, E> {
  return new Getter((oe) => Effect.fail(f(oe)))
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function forbidden<T, E>(message: string): Getter<T, E> {
  return fail<T, E>((oe) => new Issue.Forbidden(oe, { message }))
}

const passthrough_ = new Getter<any, any>(Effect.succeed)

function isPassthrough<T, E, R>(getter: Getter<T, E, R>): getter is typeof passthrough_ {
  return getter.run === passthrough_.run
}

/**
 * Keep the value as is.
 *
 * @category constructors
 * @since 4.0.0
 */
export function passthrough<T, E>(options: { readonly strict: false }): Getter<T, E>
export function passthrough<T>(): Getter<T, T>
export function passthrough<T>(): Getter<T, T> {
  return passthrough_
}

/**
 * @since 4.0.0
 */
export function passthroughSupertype<T extends E, E>(): Getter<T, E>
export function passthroughSupertype<T>(): Getter<T, T> {
  return passthrough_
}

/**
 * @since 4.0.0
 */
export function passthroughSubtype<T, E extends T>(): Getter<T, E>
export function passthroughSubtype<T>(): Getter<T, T> {
  return passthrough_
}

/**
 * Handle missing encoded values.
 *
 * @category constructors
 * @since 4.0.0
 */
export function onNone<T, R = never>(
  f: (options: AST.ParseOptions) => Effect.Effect<Option.Option<T>, Issue.Issue, R>
): Getter<T, T, R> {
  return new Getter((ot, options) => Option.isNone(ot) ? f(options) : Effect.succeed(ot))
}

/**
 * Require a value to be defined.
 *
 * @category constructors
 * @since 4.0.0
 */
export function required<T>(annotations?: Annotations.Key<T>): Getter<T, T> {
  return onNone(() => Effect.fail(new Issue.MissingKey(annotations)))
}

/**
 * Handle defined encoded values.
 *
 * @category constructors
 * @since 4.0.0
 */
export function onSome<T, E, R = never>(
  f: (e: E, options: AST.ParseOptions) => Effect.Effect<Option.Option<T>, Issue.Issue, R>
): Getter<T, E, R> {
  return new Getter((oe, options) => Option.isNone(oe) ? Effect.succeedNone : f(oe.value, options))
}

/**
 * @category constructors
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
 * Map a defined value to a value.
 *
 * @category constructors
 * @since 4.0.0
 */
export function map<T, E>(f: (e: E) => T): Getter<T, E> {
  return mapOptional(Option.map(f))
}

/**
 * Map a defined value to a value or a failure.
 *
 * @category constructors
 * @since 4.0.0
 */
export function mapOrFail<T, E, R = never>(
  f: (e: E, options: AST.ParseOptions) => Effect.Effect<T, Issue.Issue, R>
): Getter<T, E, R> {
  return onSome((e, options) => f(e, options).pipe(Effect.mapEager(Option.some)))
}

/**
 * Map a missing or a defined value to a missing or a defined value.
 *
 * @category constructors
 * @since 4.0.0
 */
export function mapOptional<T, E>(f: (oe: Option.Option<E>) => Option.Option<T>): Getter<T, E> {
  return new Getter((oe) => Effect.succeed(f(oe)))
}

/**
 * Omit a value in the output.
 *
 * @category constructors
 * @since 4.0.0
 */
export function omit<T>(): Getter<never, T> {
  return new Getter(() => Effect.succeedNone)
}

/**
 * Provide a default value when the input is `Option<undefined>`.
 *
 * @category constructors
 * @since 4.0.0
 */
export function withDefault<T>(defaultValue: () => T): Getter<T, T | undefined> {
  return mapOptional((oe) => oe.pipe(Option.filter(Predicate.isNotUndefined), Option.orElseSome(defaultValue)))
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export function String<E>(): Getter<string, E> {
  return map(globalThis.String)
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export function Number<E>(): Getter<number, E> {
  return map(globalThis.Number)
}

/**
 * @since 4.0.0
 */
export function parseFloat<E extends string>(): Getter<number, E> {
  return map(globalThis.parseFloat)
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export function Boolean<E>(): Getter<boolean, E> {
  return map(globalThis.Boolean)
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export function BigInt<E extends string | number | bigint | boolean>(): Getter<bigint, E> {
  return map(globalThis.BigInt)
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export function Date<E extends string | number | Date>(): Getter<Date, E> {
  return map((u) => new globalThis.Date(u))
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function trim<E extends string>(): Getter<string, E> {
  return map(Str.trim)
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function capitalize<E extends string>(): Getter<string, E> {
  return map(Str.capitalize)
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function uncapitalize<E extends string>(): Getter<string, E> {
  return map(Str.uncapitalize)
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function snakeToCamel<E extends string>(): Getter<string, E> {
  return map(Str.snakeToCamel)
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function camelToSnake<E extends string>(): Getter<string, E> {
  return map(Str.camelToSnake)
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toLowerCase<E extends string>(): Getter<string, E> {
  return map(Str.toLowerCase)
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toUpperCase<E extends string>(): Getter<string, E> {
  return map(Str.toUpperCase)
}

/**
 * @since 4.0.0
 */
export interface ParseJsonOptions {
  readonly reviver?: Parameters<typeof JSON.parse>[1]
}

/**
 * @category String transformations
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
 * @category String transformations
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
 * @category String transformations
 * @since 4.0.0
 */
export function splitKeyValue<E extends string>(options?: {
  readonly separator?: string | undefined
  readonly keyValueSeparator?: string | undefined
}): Getter<Record<string, string>, E> {
  const separator = options?.separator ?? ","
  const keyValueSeparator = options?.keyValueSeparator ?? "="
  return map((input) =>
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
 * @category String transformations
 * @since 4.0.0
 */
export function joinKeyValue<E extends Record<PropertyKey, string>>(options?: {
  readonly separator?: string | undefined
  readonly keyValueSeparator?: string | undefined
}): Getter<string, E> {
  const separator = options?.separator ?? ","
  const keyValueSeparator = options?.keyValueSeparator ?? "="
  return map((input) =>
    Object.entries(input).map(([key, value]) => `${key}${keyValueSeparator}${value}`).join(separator)
  )
}

/**
 * Parses a string into an array of strings.
 *
 * An empty string is parsed as an empty array.
 *
 * @category String transformations
 * @since 4.0.0
 */
export function split<E extends string>(options?: {
  readonly separator?: string | undefined
}): Getter<ReadonlyArray<string>, E> {
  const separator = options?.separator ?? ","
  return map((input) => input === "" ? [] : input.split(separator))
}

/**
 * @since 4.0.0
 */
export function encodeBase64<E extends Uint8Array | string>(): Getter<string, E> {
  return map(Encoding.encodeBase64)
}

/**
 * @since 4.0.0
 */
export function decodeBase64<E extends string>(): Getter<Uint8Array, E> {
  return mapOrFail((input) =>
    Result.match(Encoding.decodeBase64(input), {
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
  return mapOrFail((input) => {
    const o = DateTime.make(input)
    return Option.isSome(o)
      ? Effect.succeed(DateTime.toUtc(o.value))
      : Effect.fail(new Issue.InvalidValue(Option.some(input), { message: "Invalid DateTime input" }))
  })
}
