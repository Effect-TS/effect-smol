/**
 * @since 4.0.0
 */

import { PipeableClass } from "./internal/schema/util.js"
import * as Option from "./Option.js"
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
export type Get<T, E, R = never> = (
  i: E,
  ast: SchemaAST.AST,
  options: SchemaAST.ParseOptions
) => SchemaResult.SchemaResult<T, R>

/**
 * @category model
 * @since 4.0.0
 */
export class SchemaGetter<T, E, R = never> extends PipeableClass
  implements
    SchemaAnnotations.Annotated,
    SchemaAnnotations.Annotable<SchemaGetter<T, E, R>, SchemaAnnotations.Documentation>
{
  declare readonly "~rebuild.out": SchemaGetter<T, E, R>
  declare readonly "~annotate.in": SchemaAnnotations.Documentation
  constructor(
    readonly get: Get<Option.Option<T>, Option.Option<E>, R>,
    readonly annotations: SchemaAnnotations.Documentation | undefined
  ) {
    super()
  }
  annotate(annotations: SchemaAnnotations.Filter): SchemaGetter<T, E, R> {
    return new SchemaGetter(this.get, { ...this.annotations, ...annotations })
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

/**
 * @category constructors
 * @since 4.0.0
 */
export function identity<T>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<T, T> {
  return new SchemaGetter(SchemaResult.succeed, annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function parseNone<T, R = never>(
  onNone: Get<Option.Option<T>, Option.Option<T>, R>,
  annotations?: SchemaAnnotations.Documentation
): SchemaGetter<T, T, R> {
  return new SchemaGetter(
    (ot, ast, options) => Option.isNone(ot) ? onNone(ot, ast, options) : SchemaResult.succeed(ot),
    annotations
  )
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function parseSome<T, E, R = never>(
  onSome: Get<Option.Option<T>, E, R>,
  annotations?: SchemaAnnotations.Documentation
): SchemaGetter<T, E, R> {
  return new SchemaGetter(
    (oe, ast, options) => Option.isNone(oe) ? SchemaResult.succeedNone : onSome(oe.value, ast, options),
    annotations
  )
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function mapSome<E, T>(f: (e: E) => T, annotations?: SchemaAnnotations.Documentation): SchemaGetter<T, E> {
  return parseSome((e) => SchemaResult.succeedSome(f(e)), annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function withDefault<T>(
  defaultValue: () => T,
  annotations?: SchemaAnnotations.Documentation
): SchemaGetter<T, T> {
  return parseNone(() => SchemaResult.succeedSome(defaultValue()), annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function required<T>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<T, T> {
  return parseNone<T, never>(() => SchemaResult.fail(new SchemaIssue.MissingKey()), {
    title: "required",
    ...annotations
  })
}

/**
 * Omit a key in the output.
 *
 * @category constructors
 * @since 4.0.0
 */
export function omitKey<T>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<T, T> {
  return parseSome(() => SchemaResult.succeedNone, { title: "omit", ...annotations })
}

/**
 * @since 4.0.0
 */
export const tapInput =
  <E>(f: (o: Option.Option<E>) => void) => <T, R>(parser: SchemaGetter<T, E, R>): SchemaGetter<T, E, R> => {
    return new SchemaGetter((oe, ast, options) => {
      f(oe)
      return parser.get(oe, ast, options)
    }, parser.annotations)
  }

/**
 * @category Coercions
 * @since 4.0.0
 */
export const String: SchemaGetter<string, unknown> = mapSome(globalThis.String, {
  title: "String coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Number: SchemaGetter<number, unknown> = mapSome(globalThis.Number, {
  title: "Number coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Boolean: SchemaGetter<boolean, unknown> = mapSome(globalThis.Boolean, {
  title: "Boolean coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const BigInt: SchemaGetter<bigint, string | number | bigint | boolean> = mapSome(globalThis.BigInt, {
  title: "BigInt coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Date: SchemaGetter<Date, string | number | Date> = mapSome((u) => new globalThis.Date(u), {
  title: "Date coercion"
})

/**
 * @category String transformations
 * @since 4.0.0
 */
export function trim<E extends string>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<string, E> {
  return mapSome((s) => s.trim(), { title: "trim", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function snakeToCamel<E extends string>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<string, E> {
  return mapSome(Str.snakeToCamel, { title: "snakeToCamel", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function camelToSnake<E extends string>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<string, E> {
  return mapSome(Str.camelToSnake, { title: "camelToSnake", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toLowerCase<E extends string>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<string, E> {
  return mapSome(Str.toLowerCase, { title: "toLowerCase", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toUpperCase<E extends string>(annotations?: SchemaAnnotations.Documentation): SchemaGetter<string, E> {
  return mapSome(Str.toUpperCase, { title: "toUpperCase", ...annotations })
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
  return parseSome((input) =>
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
  return parseSome((input) =>
    Result.try({
      try: () => Option.some(JSON.stringify(input, options?.options?.replacer, options?.options?.space)),
      catch: (e) =>
        new SchemaIssue.InvalidData(Option.some(input), {
          message: e instanceof Error ? e.message : globalThis.String(e)
        })
    }), { title: "stringifyJson", ...options?.annotations })
}
