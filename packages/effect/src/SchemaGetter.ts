/**
 * @since 4.0.0
 */

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
      oe: Option.Option<E>,
      ast: SchemaAST.AST,
      options: SchemaAST.ParseOptions
    ) => SchemaResult.SchemaResult<Option.Option<T>, R>
  ) {
    super()
  }
  compose<T2, R2 = never>(other: SchemaGetter<T2, T, R2>): SchemaGetter<T2, E, R | R2> {
    return new SchemaGetter((oe, ast, options) =>
      SchemaResult.flatMap(this.run(oe, ast, options), (ot) => other.run(ot, ast, options))
    )
  }
}

/**
 * Fail with an issue.
 *
 * @category constructors
 * @since 4.0.0
 */
export function fail<T>(f: (ot: Option.Option<T>) => SchemaIssue.Issue): SchemaGetter<T, T> {
  return new SchemaGetter((ot) => SchemaResult.fail(f(ot)))
}

/**
 * Keep the value as is.
 *
 * @category constructors
 * @since 4.0.0
 */
export function passthrough<T>(): SchemaGetter<T, T> {
  return new SchemaGetter(SchemaResult.succeed)
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
 * Use this to mark a key as required.
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
 * Map a defined value to a value or a failure.
 *
 * @category constructors
 * @since 4.0.0
 */
export function transformOrFail<T, E, R = never>(
  f: (e: E, ast: SchemaAST.AST, options: SchemaAST.ParseOptions) => SchemaResult.SchemaResult<T, R>
): SchemaGetter<T, E, R> {
  return onSome((e, ast, options) => SchemaResult.map(f(e, ast, options), Option.some))
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
 * Map a missing or a defined value to a missing or a defined value.
 *
 * @category constructors
 * @since 4.0.0
 */
export function transformOptional<T, E>(
  f: (oe: Option.Option<E>) => Option.Option<T>
): SchemaGetter<T, E> {
  return new SchemaGetter((oe) => SchemaResult.succeed(f(oe)))
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function toOption<T>(): SchemaGetter<Option.Option<T>, T> {
  return transformOptional(Option.some)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function fromOption<T>(): SchemaGetter<T, Option.Option<T>> {
  return transformOptional(Option.flatten)
}

/**
 * Filter a value based on a predicate.
 *
 * When the predicate returns false, the value is transformed to `None`
 *
 * @category constructors
 * @since 4.0.0
 */
export function filter<T extends E, E>(refinement: (e: E) => e is T): SchemaGetter<T, E>
export function filter<T>(predicate: (t: T) => boolean): SchemaGetter<T, T>
export function filter<T>(predicate: (t: T) => boolean): SchemaGetter<T, T> {
  return transformOptional(Option.filter(predicate))
}

/**
 * Provide a default value when the input is `None`.
 *
 * @category constructors
 * @since 4.0.0
 */
export function orElseOption<T>(f: () => Option.Option<T>): SchemaGetter<T, T> {
  return transformOptional(Option.orElse(f))
}

/**
 * Provide a default value when the input is `None`.
 *
 * @category constructors
 * @since 4.0.0
 */
export function orElseSome<T>(f: () => T): SchemaGetter<T, T> {
  return transformOptional(Option.orElseSome(f))
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
 * Omit `undefined` values in the output.
 *
 * @category constructors
 * @since 4.0.0
 */
export function omitUndefined<T>(): SchemaGetter<T, T | undefined> {
  return filter(Predicate.isNotUndefined)
}

/**
 * Omit `null` values in the output.
 *
 * @category constructors
 * @since 4.0.0
 */
export function omitNull<T>(): SchemaGetter<T, T | null> {
  return filter(Predicate.isNotNull)
}

/**
 * Omit `null` or `undefined` values in the output.
 *
 * @category constructors
 * @since 4.0.0
 */
export function omitNullish<T>(): SchemaGetter<T, T | null | undefined> {
  return filter(Predicate.isNotNullish)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function omitEmptyString(): SchemaGetter<string, string> {
  return filter(Str.isNonEmpty)
}

const _default = <T>(value: () => T): SchemaGetter<T, T | undefined> => {
  return omitUndefined<T>().compose(orElseSome(value))
}

export {
  /**
   * Provide a default value when the input is `None` or `undefined`.
   *
   * @category constructors
   * @since 4.0.0
   */
  _default as default
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export const String: SchemaGetter<string, unknown> = transform(globalThis.String)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Number: SchemaGetter<number, unknown> = transform(globalThis.Number)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Boolean: SchemaGetter<boolean, unknown> = transform(globalThis.Boolean)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const BigInt: SchemaGetter<bigint, string | number | bigint | boolean> = transform(globalThis.BigInt)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Date: SchemaGetter<Date, string | number | Date> = transform((u) => new globalThis.Date(u))

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
