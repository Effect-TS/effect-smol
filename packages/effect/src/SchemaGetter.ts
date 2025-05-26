/**
 * @since 4.0.0
 */

import * as Effect from "./Effect.js"
import { PipeableClass } from "./internal/schema/util.js"
import * as Option from "./Option.js"
import * as Predicate from "./Predicate.js"
import * as Result from "./Result.js"
import type * as SchemaAST from "./SchemaAST.js"
import * as SchemaIssue from "./SchemaIssue.js"
import * as SchemaResult from "./SchemaResult.js"
import * as Str from "./String.js"

/**
 * @category model
 * @since 4.0.0
 */
export class SchemaGetter<out T, in E, R = never> extends PipeableClass {
  constructor(
    readonly run: (
      input: Option.Option<E>,
      ast: SchemaAST.AST,
      options: SchemaAST.ParseOptions
    ) => SchemaResult.SchemaResult<Option.Option<T>, R>
  ) {
    super()
  }
  compose<T2, R2>(other: SchemaGetter<T2, T, R2>): SchemaGetter<T2, E, R | R2> {
    if (isPassthrough(this)) {
      return other as any
    }
    if (isPassthrough(other)) {
      return this as any
    }
    return new SchemaGetter((oe, ast, options) =>
      this.run(oe, ast, options).pipe(SchemaResult.flatMap((ot) => other.run(ot, ast, options)))
    )
  }
}

/**
 * Fail with an issue.
 *
 * @category constructors
 * @since 4.0.0
 */
export function fail<T, E>(f: (oe: Option.Option<E>) => SchemaIssue.Issue): SchemaGetter<T, E> {
  return new SchemaGetter((oe) => SchemaResult.fail(f(oe)))
}

const passthrough_ = new SchemaGetter<any, any>(SchemaResult.succeed)

function isPassthrough<T, E, R>(getter: SchemaGetter<T, E, R>): getter is typeof passthrough_ {
  return getter.run === passthrough_.run
}

/**
 * Keep the value as is.
 *
 * @category constructors
 * @since 4.0.0
 */
export function passthrough<T, E>(options: { readonly strict: false }): SchemaGetter<T, E>
export function passthrough<T>(): SchemaGetter<T, T>
export function passthrough<T>(): SchemaGetter<T, T> {
  return passthrough_
}

/**
 * @since 4.0.0
 */
export function passthroughSupertype<T extends E, E>(): SchemaGetter<T, E>
export function passthroughSupertype<T>(): SchemaGetter<T, T> {
  return passthrough_
}

/**
 * @since 4.0.0
 */
export function passthroughSubtype<T, E extends T>(): SchemaGetter<T, E>
export function passthroughSubtype<T>(): SchemaGetter<T, T> {
  return passthrough_
}

/**
 * Handle missing encoded values.
 *
 * @category constructors
 * @since 4.0.0
 */
export function onNone<T, R = never>(
  f: (
    ast: SchemaAST.AST,
    options: SchemaAST.ParseOptions
  ) => SchemaResult.SchemaResult<Option.Option<T>, R>
): SchemaGetter<T, T, R> {
  return new SchemaGetter((ot, ast, options) => Option.isNone(ot) ? f(ast, options) : SchemaResult.succeed(ot))
}

/**
 * Require a value to be defined.
 *
 * @category constructors
 * @since 4.0.0
 */
export function required<T>(): SchemaGetter<T, T> {
  return onNone(() => SchemaResult.fail(new SchemaIssue.MissingKey()))
}

/**
 * Handle defined encoded values.
 *
 * @category constructors
 * @since 4.0.0
 */
export function onSome<T, E, R = never>(
  f: (e: E, ast: SchemaAST.AST, options: SchemaAST.ParseOptions) => SchemaResult.SchemaResult<Option.Option<T>, R>
): SchemaGetter<T, E, R> {
  return new SchemaGetter((oe, ast, options) =>
    Option.isNone(oe) ? SchemaResult.succeedNone : f(oe.value, ast, options)
  )
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function check<T, R>(
  f: (
    input: T,
    self: SchemaAST.AST,
    options: SchemaAST.ParseOptions
  ) => Effect.Effect<undefined | SchemaIssue.Issue, never, R>
): SchemaGetter<T, T, R> {
  return onSome((t, ast, options) => {
    return Effect.flatMap(f(t, ast, options), (issue) => {
      if (issue) {
        return Effect.fail(issue)
      } else {
        return Effect.succeed(Option.some(t))
      }
    })
  })
}

/**
 * Map a defined value to a value.
 *
 * @category constructors
 * @since 4.0.0
 */
export function transform<T, E>(f: (e: E) => T): SchemaGetter<T, E> {
  return transformOptional(Option.map(f))
}

/**
 * Map a defined value to a value or a failure.
 *
 * @category constructors
 * @since 4.0.0
 */
export function transformOrFail<T, E, R = never>(
  f: (e: E, ast: SchemaAST.AST, options: SchemaAST.ParseOptions) => SchemaResult.SchemaResult<T, R>
): SchemaGetter<T, E, R> {
  return onSome((e, ast, options) => f(e, ast, options).pipe(SchemaResult.map(Option.some)))
}

/**
 * Map a missing or a defined value to a missing or a defined value.
 *
 * @category constructors
 * @since 4.0.0
 */
export function transformOptional<T, E>(f: (oe: Option.Option<E>) => Option.Option<T>): SchemaGetter<T, E> {
  return new SchemaGetter((oe) => SchemaResult.succeed(f(oe)))
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function transformOptionalOrFail<T, E, R>(
  f: (
    oe: Option.Option<E>,
    ast: SchemaAST.AST,
    options: SchemaAST.ParseOptions
  ) => SchemaResult.SchemaResult<Option.Option<T>, R>
): SchemaGetter<T, E, R> {
  return new SchemaGetter(f)
}

/**
 * Omit a value in the output.
 *
 * @category constructors
 * @since 4.0.0
 */
export function omit<T>(): SchemaGetter<never, T> {
  return new SchemaGetter(() => SchemaResult.succeedNone)
}

/**
 * Provide a default value when the input is `Option<undefined>`.
 *
 * @category constructors
 * @since 4.0.0
 */
export function withDefault<T>(defaultValue: () => T): SchemaGetter<T, T | undefined> {
  return transformOptional((oe) => oe.pipe(Option.filter(Predicate.isNotUndefined), Option.orElseSome(defaultValue)))
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export function String<E>(): SchemaGetter<string, E> {
  return transform(globalThis.String)
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export function Number<E>(): SchemaGetter<number, E> {
  return transform(globalThis.Number)
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export function Boolean<E>(): SchemaGetter<boolean, E> {
  return transform(globalThis.Boolean)
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export function BigInt<E extends string | number | bigint | boolean>(): SchemaGetter<bigint, E> {
  return transform(globalThis.BigInt)
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export function Date<E extends string | number | Date>(): SchemaGetter<Date, E> {
  return transform((u) => new globalThis.Date(u))
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function trim<E extends string>(): SchemaGetter<string, E> {
  return transform(Str.trim)
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function snakeToCamel<E extends string>(): SchemaGetter<string, E> {
  return transform(Str.snakeToCamel)
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function camelToSnake<E extends string>(): SchemaGetter<string, E> {
  return transform(Str.camelToSnake)
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toLowerCase<E extends string>(): SchemaGetter<string, E> {
  return transform(Str.toLowerCase)
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toUpperCase<E extends string>(): SchemaGetter<string, E> {
  return transform(Str.toUpperCase)
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
}): SchemaGetter<unknown, E> {
  return onSome((input) =>
    Result.try({
      try: () => Option.some(JSON.parse(input, options?.options?.reviver)),
      catch: (e) =>
        new SchemaIssue.InvalidData(Option.some(input), {
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
}): SchemaGetter<string, unknown> {
  return onSome((input) =>
    Result.try({
      try: () => Option.some(JSON.stringify(input, options?.options?.replacer, options?.options?.space)),
      catch: (e) =>
        new SchemaIssue.InvalidData(Option.some(input), {
          description: e instanceof Error ? e.message : globalThis.String(e)
        })
    })
  )
}
