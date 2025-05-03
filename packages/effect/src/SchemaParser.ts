/**
 * @since 4.0.0
 */

import * as Option from "./Option.js"
import type * as SchemaAST from "./SchemaAST.js"
import * as SchemaIssue from "./SchemaIssue.js"
import * as SchemaResult from "./SchemaResult.js"
import * as Str from "./String.js"

/**
 * @category model
 * @since 4.0.0
 */
export type Parse<T, E, R = never> = (
  i: E,
  ast: SchemaAST.AST,
  options: SchemaAST.ParseOptions
) => SchemaResult.SchemaResult<T, R>

/**
 * @category model
 * @since 4.0.0
 */
export type Annotations = SchemaAST.Annotations.Documentation

/**
 * @category model
 * @since 4.0.0
 */
export class Parser<T, E, R = never> implements SchemaAST.Annotated {
  constructor(
    readonly run: Parse<Option.Option<T>, Option.Option<E>, R>,
    readonly annotations: Annotations | undefined
  ) {}
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function succeed<T>(value: T, annotations?: Annotations): Parser<T, T> {
  return new Parser(() => SchemaResult.succeedSome(value), annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function fail<T>(f: (o: Option.Option<T>) => SchemaIssue.Issue, annotations?: Annotations): Parser<T, T> {
  return new Parser((o) => SchemaResult.fail(f(o)), annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function identity<T>(annotations?: Annotations): Parser<T, T> {
  return new Parser(SchemaResult.succeed, annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function parseNone<T, R = never>(
  onNone: Parse<Option.Option<T>, Option.Option<T>, R>,
  annotations?: Annotations
): Parser<T, T, R> {
  return new Parser(
    (ot, ast, options) => Option.isNone(ot) ? onNone(ot, ast, options) : SchemaResult.succeed(ot),
    annotations
  )
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function parseSome<T, E, R = never>(
  onSome: Parse<Option.Option<T>, E, R>,
  annotations?: Annotations
): Parser<T, E, R> {
  return new Parser(
    (oe, ast, options) => Option.isNone(oe) ? SchemaResult.succeedNone : onSome(oe.value, ast, options),
    annotations
  )
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function mapSome<E, T>(f: (e: E) => T, annotations?: Annotations): Parser<T, E> {
  return parseSome((e) => SchemaResult.succeedSome(f(e)), annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function withDefault<T>(defaultValue: () => T, annotations?: Annotations): Parser<T, T> {
  return parseNone(() => SchemaResult.succeedSome(defaultValue()), annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function required<T>(annotations?: Annotations): Parser<T, T> {
  return parseNone<T, never>(() => SchemaResult.fail(SchemaIssue.MissingIssue.instance), {
    title: "required",
    ...annotations
  })
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function omit<T>(annotations?: Annotations): Parser<T, T> {
  return parseSome(() => SchemaResult.succeedNone, { title: "omit", ...annotations })
}

/**
 * @since 4.0.0
 */
export const tapInput = <E>(f: (o: Option.Option<E>) => void) => <T, R>(parser: Parser<T, E, R>): Parser<T, E, R> => {
  return new Parser((oe, ast, options) => {
    f(oe)
    return parser.run(oe, ast, options)
  }, parser.annotations)
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export const String: Parser<string, unknown> = mapSome(globalThis.String, {
  title: "String coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Number: Parser<number, unknown> = mapSome(globalThis.Number, {
  title: "Number coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Boolean: Parser<boolean, unknown> = mapSome(globalThis.Boolean, {
  title: "Boolean coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const BigInt: Parser<bigint, string | number | bigint | boolean> = mapSome(globalThis.BigInt, {
  title: "BigInt coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Date: Parser<Date, string | number | Date> = mapSome((u) => new globalThis.Date(u), {
  title: "Date coercion"
})

/**
 * @category String transformations
 * @since 4.0.0
 */
export function trim<E extends string>(annotations?: Annotations): Parser<string, E> {
  return mapSome((s) => s.trim(), { title: "trim", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function snakeToCamel<E extends string>(annotations?: Annotations): Parser<string, E> {
  return mapSome(Str.snakeToCamel, { title: "snakeToCamel", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function camelToSnake<E extends string>(annotations?: Annotations): Parser<string, E> {
  return mapSome(Str.camelToSnake, { title: "camelToSnake", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toLowerCase<E extends string>(annotations?: Annotations): Parser<string, E> {
  return mapSome(Str.toLowerCase, { title: "toLowerCase", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toUpperCase<E extends string>(annotations?: Annotations): Parser<string, E> {
  return mapSome(Str.toUpperCase, { title: "toUpperCase", ...annotations })
}
