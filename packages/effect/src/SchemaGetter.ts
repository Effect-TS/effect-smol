/**
 * @since 4.0.0
 */

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
 * @category constructors
 * @since 4.0.0
 */
export function succeed<T>(value: T, annotations?: SchemaAnnotations.Documentation): SchemaGetter<T, T> {
  return new SchemaGetter(() => SchemaResult.succeedSome(value), annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function fail<T>(
  f: (o: Option.Option<T>) => SchemaIssue.Issue,
  annotations?: SchemaAnnotations.Documentation
): SchemaGetter<T, T> {
  return new SchemaGetter((o) => SchemaResult.fail(f(o)), annotations)
}

const defaultIdentity = new SchemaGetter<any, unknown, never>(SchemaResult.succeed, undefined)

/**
 * @category constructors
 * @since 4.0.0
 */
export function identity<T>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<T, T> {
  return annotations ? new SchemaGetter(SchemaResult.succeed, annotations) : defaultIdentity
}

/**
 * Handle missing values.
 *
 * @category constructors
 * @since 4.0.0
 */
export function onMissing<T, R = never>(
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
 * Map a missing value to a value.
 *
 * Use this to provide a default value for missing values.
 *
 * @category constructors
 * @since 4.0.0
 */
export function mapMissing<T>(f: () => T, annotations?: SchemaAnnotations.Documentation): SchemaGetter<T, T> {
  return onMissing(() => SchemaResult.succeedSome(f()), annotations)
}

/**
 * Handle defined values.
 *
 * @category constructors
 * @since 4.0.0
 */
export function onDefined<T, E, R = never>(
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
export function mapOrFailDefined<T, E, R = never>(
  f: (e: E, ast: SchemaAST.AST, options: SchemaAST.ParseOptions) => SchemaResult.SchemaResult<T, R>,
  annotations?: SchemaAnnotations.Documentation
): SchemaGetter<T, E, R> {
  return onDefined((e, ast, options) => SchemaResult.map(f(e, ast, options), Option.some), annotations)
}

/**
 * Map a defined value to a value.
 *
 * @category constructors
 * @since 4.0.0
 */
export function mapDefined<T, E, R = never>(
  f: (input: E) => T,
  annotations?: SchemaAnnotations.Documentation
): SchemaGetter<T, E, R> {
  return onDefined((e) => SchemaResult.succeedSome(f(e)), annotations)
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
  return onMissing<T, never>(() => SchemaResult.fail(new SchemaIssue.MissingKey()), {
    title: "required",
    ...annotations
  })
}

/**
 * Omit a value in the output.
 *
 * Use this to omit a key from the output.
 *
 * @category constructors
 * @since 4.0.0
 */
export function omit<T>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<T, T> {
  return omitWhen(() => true, annotations)
}

/**
 * Omit a value in the output when the predicate is false.
 *
 * Use this to omit a key from the output when a condition is not met.
 *
 * @category constructors
 * @since 4.0.0
 */
export function omitUnless<T extends E, E>(
  f: (e: E) => e is T,
  annotations?: SchemaAnnotations.Documentation
): SchemaGetter<T, E>
export function omitUnless<T>(
  f: (t: T) => boolean,
  annotations?: SchemaAnnotations.Documentation
): SchemaGetter<T, T>
export function omitUnless<T>(
  f: (t: T) => boolean,
  annotations?: SchemaAnnotations.Documentation
): SchemaGetter<T, T> {
  return omitWhen(Predicate.not(f), annotations)
}

/**
 * Omit a value in the output when the predicate is true.
 *
 * Use this to omit a key from the output when a condition is met.
 *
 * @category constructors
 * @since 4.0.0
 */
export function omitWhen<T extends E, E>(
  f: (e: E) => e is T,
  annotations?: SchemaAnnotations.Documentation
): SchemaGetter<Exclude<E, T>, E>
export function omitWhen<T>(
  f: (t: T) => boolean,
  annotations?: SchemaAnnotations.Documentation
): SchemaGetter<T, T>
export function omitWhen<T>(
  f: (t: T) => boolean,
  annotations?: SchemaAnnotations.Documentation
): SchemaGetter<T, T> {
  return onDefined((t) => f(t) ? SchemaResult.succeedNone : SchemaResult.succeedSome(t), annotations)
}

/**
 * @since 4.0.0
 */
export const tapInput =
  <E>(f: (o: Option.Option<E>) => void) => <T, R>(getter: SchemaGetter<T, E, R>): SchemaGetter<T, E, R> => {
    return new SchemaGetter((oe, ast, options) => {
      f(oe)
      return getter.getter(oe, ast, options)
    }, getter.annotations)
  }

/**
 * @category Coercions
 * @since 4.0.0
 */
export const String: SchemaGetter<string, unknown> = mapDefined(globalThis.String, {
  title: "String coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Number: SchemaGetter<number, unknown> = mapDefined(globalThis.Number, {
  title: "Number coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Boolean: SchemaGetter<boolean, unknown> = mapDefined(globalThis.Boolean, {
  title: "Boolean coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const BigInt: SchemaGetter<bigint, string | number | bigint | boolean> = mapDefined(globalThis.BigInt, {
  title: "BigInt coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Date: SchemaGetter<Date, string | number | Date> = mapDefined((u) => new globalThis.Date(u), {
  title: "Date coercion"
})

/**
 * @category String transformations
 * @since 4.0.0
 */
export function trim<E extends string>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<string, E> {
  return mapDefined((s) => s.trim(), { title: "trim", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function snakeToCamel<E extends string>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<string, E> {
  return mapDefined(Str.snakeToCamel, { title: "snakeToCamel", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function camelToSnake<E extends string>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<string, E> {
  return mapDefined(Str.camelToSnake, { title: "camelToSnake", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toLowerCase<E extends string>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<string, E> {
  return mapDefined(Str.toLowerCase, { title: "toLowerCase", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toUpperCase<E extends string>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<string, E> {
  return mapDefined(Str.toUpperCase, { title: "toUpperCase", ...annotations })
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
  return onDefined((input) =>
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
  return onDefined((input) =>
    Result.try({
      try: () => Option.some(JSON.stringify(input, options?.options?.replacer, options?.options?.space)),
      catch: (e) =>
        new SchemaIssue.InvalidData(Option.some(input), {
          message: e instanceof Error ? e.message : globalThis.String(e)
        })
    }), { title: "stringifyJson", ...options?.annotations })
}
