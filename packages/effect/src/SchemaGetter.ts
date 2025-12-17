/**
 * @since 4.0.0
 */
import * as DateTime from "./DateTime.ts"
import * as Effect from "./Effect.ts"
import * as Base64 from "./encoding/Base64.ts"
import * as Base64Url from "./encoding/Base64Url.ts"
import * as Hex from "./encoding/Hex.ts"
import * as Option from "./Option.ts"
import { Class } from "./Pipeable.ts"
import * as Predicate from "./Predicate.ts"
import * as Result from "./Result.ts"
import type * as Schema from "./Schema.ts"
import type * as AST from "./SchemaAST.ts"
import * as Issue from "./SchemaIssue.ts"
import * as Str from "./String.ts"

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
export function required<T, E extends T = T>(annotations?: Schema.Annotations.Key<T>): Getter<T, E> {
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

type ParseJsonOptions = {
  readonly reviver?: Parameters<typeof JSON.parse>[1]
}

/**
 * @category Json
 * @since 4.0.0
 */
export function parseJson<E extends string>(): Getter<Schema.MutableJson, E>
export function parseJson<E extends string>(options: ParseJsonOptions): Getter<unknown, E>
export function parseJson<E extends string>(options?: ParseJsonOptions | undefined): Getter<unknown, E> {
  return onSome((input) =>
    Effect.try({
      try: () => Option.some(JSON.parse(input, options?.reviver)),
      catch: (e) => new Issue.InvalidValue(Option.some(input), { message: globalThis.String(e) })
    })
  )
}

type StringifyJsonOptions = {
  readonly replacer?: Parameters<typeof JSON.stringify>[1]
  readonly space?: Parameters<typeof JSON.stringify>[2]
}

/**
 * @category Json
 * @since 4.0.0
 */
export function stringifyJson(options?: StringifyJsonOptions): Getter<string, unknown> {
  return onSome((input) =>
    Effect.try({
      try: () => Option.some(JSON.stringify(input, options?.replacer, options?.space)),
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

/**
 * @category FormData
 * @since 4.0.0
 */
export function decodeFormData(): Getter<Schema.TreeObject<string | Blob>, FormData> {
  return transform((input) => makeTreeRecord(Array.from(input.entries())))
}

const collectFormDataEntries = collectBracketPathEntries((value): value is string | Blob =>
  typeof value === "string" || (typeof Blob !== "undefined" && value instanceof Blob)
)

/**
 * @category FormData
 * @since 4.0.0
 */
export function encodeFormData(): Getter<FormData, unknown> {
  return transform((input) => {
    const out = new FormData()
    if (typeof input === "object" && input !== null) {
      const entries = collectFormDataEntries(input)
      entries.forEach(([key, value]) => {
        out.append(key, value)
      })
    }
    return out
  })
}

/**
 * @category URLSearchParams
 * @since 4.0.0
 */
export function decodeURLSearchParams(): Getter<Schema.TreeObject<string>, URLSearchParams> {
  return transform((input) => makeTreeRecord(Array.from(input.entries())))
}

const collectURLSearchParamsEntries = collectBracketPathEntries(Predicate.isString)

/**
 * @category URLSearchParams
 * @since 4.0.0
 */
export function encodeURLSearchParams(): Getter<URLSearchParams, unknown> {
  return transform((input) => {
    if (typeof input === "object" && input !== null) {
      return new URLSearchParams(collectURLSearchParamsEntries(input))
    }
    return new URLSearchParams()
  })
}

const INDEX_REGEXP = /^\d+$/

function bracketPathToTokens(bracketPath: string): Array<string | number> {
  // real empty path (from append("", value))
  if (bracketPath === "") {
    return [""]
  }

  const replaced = bracketPath.replace(/\[(.*?)\]/g, ".$1")
  const parts = replaced.split(".")
  // if bracket path started with "[...]" we get ".foo" => ["", "foo"]; drop the synthetic first ""
  const start = replaced.startsWith(".") ? 1 : 0

  return parts
    .slice(start)
    .map((part) => (INDEX_REGEXP.test(part) ? globalThis.Number(part) : part))
}

/**
 * Makes a tree record from a list of bracket path entries.
 *
 * A bracket path is a string that describes how to navigate or build a nested
 * tree structure made of objects and arrays.
 *
 * Supported syntax:
 * - "foo"                     → object key "foo"
 * - "foo[bar]"                → nested key "foo" → "bar"
 * - "foo[0]"                  → array index 0
 * - "foo[0][id]"              → mixed object/array nesting
 * - "foo[]"                   → append to array "foo"
 * - "foo[][id]"               → append a new element, then descend into "id"
 * - ""                        → a real empty path key
 *
 * Parsing rules:
 * - Each "[segment]" becomes a path segment.
 * - Numeric segments become numbers (array indexes).
 * - "[]" produces an empty-string segment "" which instructs array appends.
 *
 * Construction rules:
 * - If the next segment is a number or "", create an array.
 * - Otherwise, create an object.
 * - When inside an array and the current token is "":
 *   - last segment: push value
 *   - not last: push a new element (array or object), then continue
 *
 * @category Tree
 * @since 4.0.0
 */
export function makeTreeRecord<A>(
  bracketPathEntries: ReadonlyArray<readonly [bracketPath: string, value: A]>
): Schema.TreeObject<A> {
  const out: any = {}
  bracketPathEntries.forEach(([key, value]) => {
    const tokens = bracketPathToTokens(key)
    let cur: any = out
    tokens.forEach((token, i) => {
      const isLast = i === tokens.length - 1

      // We are inside an array and see "[]" (empty token) => append
      if (Array.isArray(cur) && token === "") {
        if (isLast) {
          cur.push(value)
        } else {
          // bracket path: "foo[][bar]" => push a new element and descend into it
          const next = tokens[i + 1]
          const shouldBeArray = typeof next === "number" || next === ""
          const index = cur.length

          if (cur[index] === undefined) {
            cur[index] = shouldBeArray ? [] : {}
          }

          cur = cur[index]
        }
      } else if (isLast) {
        // If we're setting a value at a path that already exists
        // convert it to an array to support multiple values for the same key
        if (Array.isArray(cur[token])) {
          cur[token].push(value)
        } else if (Object.prototype.hasOwnProperty.call(cur, token)) {
          cur[token] = [cur[token], value]
        } else {
          cur[token] = value
        }
      } else {
        const next = tokens[i + 1]
        // if next is a number OR "" (from []), we are building an array
        const shouldBeArray = typeof next === "number" || next === ""

        if (cur[token] === undefined) {
          cur[token] = shouldBeArray ? [] : {}
        }

        cur = cur[token]
      }
    })
  })
  return out
}

/**
 * Collects all bracket path entries from an object, ignoring leaf values that
 * are not of type `A`.
 *
 * @category Tree
 * @since 4.0.0
 */
export function collectBracketPathEntries<A>(isLeaf: (value: unknown) => value is A) {
  return (input: object): Array<[bracketPath: string, value: A]> => {
    const bracketPathEntries: Array<[string, A]> = []

    function append(key: string, value: unknown): void {
      if (isLeaf(value)) {
        bracketPathEntries.push([key, value])
      } else if (Array.isArray(value)) {
        // If all values are leaves, encode as multiple entries with the same key
        const allLeaves = value.every(isLeaf)
        if (allLeaves) {
          value.forEach((v) => {
            bracketPathEntries.push([key, v])
          })
        } else {
          value.forEach((v, i) => {
            append(`${key}[${i}]`, v)
          })
        }
      } else if (typeof value === "object" && value !== null) {
        for (const [k, v] of Object.entries(value)) {
          append(`${key}[${k}]`, v)
        }
      }
    }

    for (const [key, value] of Object.entries(input)) {
      append(key, value)
    }

    return bracketPathEntries
  }
}
