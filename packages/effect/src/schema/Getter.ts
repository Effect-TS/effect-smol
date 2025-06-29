/**
 * @since 4.0.0
 */
import type * as Effect from "../Effect.js"
import { PipeableClass } from "../internal/schema/util.js"
import * as Option from "../Option.js"
import * as Predicate from "../Predicate.js"
import * as Result from "../Result.js"
import * as Str from "../String.js"
import type * as Annotations from "./Annotations.js"
import type * as AST from "./AST.js"
import * as Check from "./Check.js"
import * as Issue from "./Issue.js"
import * as SchemaResult from "./SchemaResult.js"

/**
 * @category model
 * @since 4.0.0
 */
export class Getter<out T, in E, R = never> extends PipeableClass {
  constructor(
    readonly run: (
      input: Option.Option<E>,
      options: AST.ParseOptions
    ) => SchemaResult.SchemaResult<Option.Option<T>, R>
  ) {
    super()
  }
  compose<T2, R2>(other: Getter<T2, T, R2>): Getter<T2, E, R | R2> {
    if (isPassthrough(this)) {
      return other as any
    }
    if (isPassthrough(other)) {
      return this as any
    }
    return new Getter((oe, options) => this.run(oe, options).pipe(SchemaResult.flatMap((ot) => other.run(ot, options))))
  }
}

/**
 * Fail with an issue.
 *
 * @category constructors
 * @since 4.0.0
 */
export function fail<T, E>(f: (oe: Option.Option<E>) => Issue.Issue): Getter<T, E> {
  return new Getter((oe) => SchemaResult.fail(f(oe)))
}

const passthrough_ = new Getter<any, any>(SchemaResult.succeed)

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
  f: (options: AST.ParseOptions) => SchemaResult.SchemaResult<Option.Option<T>, R>
): Getter<T, T, R> {
  return new Getter((ot, options) => Option.isNone(ot) ? f(options) : SchemaResult.succeed(ot))
}

/**
 * Require a value to be defined.
 *
 * @category constructors
 * @since 4.0.0
 */
export function required<T>(annotations?: Annotations.Key): Getter<T, T> {
  return onNone(() => SchemaResult.fail(new Issue.MissingKey(annotations)))
}

/**
 * Handle defined encoded values.
 *
 * @category constructors
 * @since 4.0.0
 */
export function onSome<T, E, R = never>(
  f: (e: E, options: AST.ParseOptions) => SchemaResult.SchemaResult<Option.Option<T>, R>
): Getter<T, E, R> {
  return new Getter((oe, options) => Option.isNone(oe) ? SchemaResult.succeedNone : f(oe.value, options))
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
    return f(t, options).pipe(SchemaResult.flatMap((out) => {
      const issue = Check.makeIssue(t, out)
      return issue ?
        SchemaResult.fail(issue) :
        SchemaResult.succeed(Option.some(t))
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
  f: (e: E, options: AST.ParseOptions) => SchemaResult.SchemaResult<T, R>
): Getter<T, E, R> {
  return onSome((e, options) => f(e, options).pipe(SchemaResult.map(Option.some)))
}

/**
 * Map a missing or a defined value to a missing or a defined value.
 *
 * @category constructors
 * @since 4.0.0
 */
export function mapOptional<T, E>(f: (oe: Option.Option<E>) => Option.Option<T>): Getter<T, E> {
  return new Getter((oe) => SchemaResult.succeed(f(oe)))
}

/**
 * Omit a value in the output.
 *
 * @category constructors
 * @since 4.0.0
 */
export function omit<T>(): Getter<never, T> {
  return new Getter(() => SchemaResult.succeedNone)
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
    Result.try({
      try: () => Option.some(JSON.parse(input, options?.options?.reviver)),
      catch: (e) =>
        new Issue.InvalidValue(Option.some(input), {
          description: e instanceof Error ? e.message : globalThis.String(e)
        })
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
    Result.try({
      try: () => Option.some(JSON.stringify(input, options?.options?.replacer, options?.options?.space)),
      catch: (e) =>
        new Issue.InvalidValue(Option.some(input), {
          description: e instanceof Error ? e.message : globalThis.String(e)
        })
    })
  )
}
