/**
 * @since 4.0.0
 */

import * as Fun from "./Function.js"
import { PipeableClass } from "./internal/schema/util.js"
import * as Option from "./Option.js"
import * as Predicate from "./Predicate.js"
import * as Result from "./Result.js"
import type * as SchemaAnnotations from "./SchemaAnnotations.js"
import type * as SchemaAST from "./SchemaAST.js"
import * as SchemaIssue from "./SchemaIssue.js"
import * as SchemaResult from "./SchemaResult.js"
import * as Str from "./String.js"

/**
 * @category model
 * @since 4.0.0
 */
export class SchemaGetter<out T, in E, R = never> extends PipeableClass
  implements
    SchemaAnnotations.Annotated,
    SchemaAnnotations.Annotable<SchemaGetter<T, E, R>, SchemaAnnotations.Documentation>
{
  declare readonly "~rebuild.out": SchemaGetter<T, E, R>
  declare readonly "~annotate.in": SchemaAnnotations.Documentation
  constructor(
    readonly getter: (
      oe: Option.Option<E>,
      ast: SchemaAST.AST,
      options: SchemaAST.ParseOptions
    ) => SchemaResult.SchemaResult<Option.Option<T>, R>,
    readonly annotations: SchemaAnnotations.Documentation | undefined
  ) {
    super()
  }
  annotate(annotations: SchemaAnnotations.Filter): SchemaGetter<T, E, R> {
    return new SchemaGetter(this.getter, { ...this.annotations, ...annotations })
  }
}

/**
 * Fail with an issue.
 *
 * @category constructors
 * @since 4.0.0
 */
export function fail<T>(
  f: (ot: Option.Option<T>) => SchemaIssue.Issue,
  annotations?: SchemaAnnotations.Documentation
): SchemaGetter<T, T> {
  return new SchemaGetter((ot) => SchemaResult.fail(f(ot)), annotations)
}

/**
 * Keep the value as is.
 *
 * @category constructors
 * @since 4.0.0
 */
export function passthrough<T>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<T, T> {
  return new SchemaGetter(SchemaResult.succeed, annotations)
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
  ) => SchemaResult.SchemaResult<Option.Option<T>, R>,
  annotations?: SchemaAnnotations.Documentation
): SchemaGetter<T, T, R> {
  return new SchemaGetter(
    (ot, ast, options) => Option.isNone(ot) ? f(ast, options) : SchemaResult.succeed(ot),
    annotations
  )
}

/**
 * Require a value to be defined.
 *
 * Use this to mark a key as required.
 *
 * @category constructors
 * @since 4.0.0
 */
export function required<T>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<T, T> {
  return onNone(() => SchemaResult.fail(new SchemaIssue.MissingKey()), {
    title: "required",
    ...annotations
  })
}

/**
 * Handle defined encoded values.
 *
 * @category constructors
 * @since 4.0.0
 */
export function onSome<T, E, R = never>(
  f: (e: E, ast: SchemaAST.AST, options: SchemaAST.ParseOptions) => SchemaResult.SchemaResult<Option.Option<T>, R>,
  annotations?: SchemaAnnotations.Documentation
): SchemaGetter<T, E, R> {
  return new SchemaGetter(
    (oe, ast, options) => Option.isNone(oe) ? SchemaResult.succeedNone : f(oe.value, ast, options),
    annotations
  )
}

/**
 * Map a defined value to a value or a failure.
 *
 * @category constructors
 * @since 4.0.0
 */
export function transformOrFail<T, E, R = never>(
  f: (e: E, ast: SchemaAST.AST, options: SchemaAST.ParseOptions) => SchemaResult.SchemaResult<T, R>,
  annotations?: SchemaAnnotations.Documentation
): SchemaGetter<T, E, R> {
  return onSome((e, ast, options) => SchemaResult.map(f(e, ast, options), Option.some), annotations)
}

/**
 * Map a defined value to a value.
 *
 * @category constructors
 * @since 4.0.0
 */
export function transform<T, E>(f: (e: E) => T, annotations?: SchemaAnnotations.Documentation): SchemaGetter<T, E> {
  return transformOptional(Option.map(f), annotations)
}

/**
 * Map a missing or a defined value to a missing or a defined value.
 *
 * @category constructors
 * @since 4.0.0
 */
export function transformOptional<T, E>(
  f: (oe: Option.Option<E>) => Option.Option<T>,
  annotations?: SchemaAnnotations.Documentation
): SchemaGetter<T, E> {
  return new SchemaGetter((oe) => SchemaResult.succeed(f(oe)), annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function toOption<T>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<Option.Option<T>, T> {
  return transformOptional(Option.some, annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function fromOption<T>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<T, Option.Option<T>> {
  return transformOptional(Option.flatten, annotations)
}

/**
 * Omit a value in the output.
 *
 * @category constructors
 * @since 4.0.0
 */
export function omit<T>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<T, T> {
  return transformOptional(Option.filter(Fun.constFalse), annotations)
}

/**
 * Omit `undefined` values in the output.
 *
 * @category constructors
 * @since 4.0.0
 */
export function omitUndefined<T>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<T, T | undefined> {
  return transformOptional(Option.filter(Predicate.isNotUndefined), annotations)
}

/**
 * Omit `null` values in the output.
 *
 * @category constructors
 * @since 4.0.0
 */
export function omitNull<T>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<T, T | null> {
  return transformOptional(Option.filter(Predicate.isNotNull), annotations)
}

/**
 * Omit `null` or `undefined` values in the output.
 *
 * @category constructors
 * @since 4.0.0
 */
export function omitNullish<T>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<T, T | null | undefined> {
  return transformOptional(Option.filter(Predicate.isNotNullish), annotations)
}

const _default = <T>(
  value: () => Option.Option<T>,
  annotations?: SchemaAnnotations.Documentation
): SchemaGetter<T, T | undefined> => {
  return transformOptional(
    (ot) => ot.pipe(Option.filter(Predicate.isNotUndefined), Option.orElse(value)),
    annotations
  )
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
export const String: SchemaGetter<string, unknown> = transform(globalThis.String, {
  title: "String coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Number: SchemaGetter<number, unknown> = transform(globalThis.Number, {
  title: "Number coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Boolean: SchemaGetter<boolean, unknown> = transform(globalThis.Boolean, {
  title: "Boolean coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const BigInt: SchemaGetter<bigint, string | number | bigint | boolean> = transform(globalThis.BigInt, {
  title: "BigInt coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Date: SchemaGetter<Date, string | number | Date> = transform((u) => new globalThis.Date(u), {
  title: "Date coercion"
})

/**
 * @category String transformations
 * @since 4.0.0
 */
export function trim<E extends string>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<string, E> {
  return transform(Str.trim, { title: "trim", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function snakeToCamel<E extends string>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<string, E> {
  return transform(Str.snakeToCamel, { title: "snakeToCamel", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function camelToSnake<E extends string>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<string, E> {
  return transform(Str.camelToSnake, { title: "camelToSnake", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toLowerCase<E extends string>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<string, E> {
  return transform(Str.toLowerCase, { title: "toLowerCase", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toUpperCase<E extends string>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<string, E> {
  return transform(Str.toUpperCase, { title: "toUpperCase", ...annotations })
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
  readonly annotations?: SchemaAnnotations.Documentation | undefined
}): SchemaGetter<unknown, E> {
  return onSome((input) =>
    Result.try({
      try: () => Option.some(JSON.parse(input, options?.options?.reviver)),
      catch: (e) =>
        new SchemaIssue.InvalidData(Option.some(input), {
          message: e instanceof Error ? e.message : globalThis.String(e)
        })
    }), { title: "parseJson", ...options?.annotations })
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
  readonly annotations?: SchemaAnnotations.Documentation | undefined
}): SchemaGetter<string, unknown> {
  return onSome((input) =>
    Result.try({
      try: () => Option.some(JSON.stringify(input, options?.options?.replacer, options?.options?.space)),
      catch: (e) =>
        new SchemaIssue.InvalidData(Option.some(input), {
          message: e instanceof Error ? e.message : globalThis.String(e)
        })
    }), { title: "stringifyJson", ...options?.annotations })
}
