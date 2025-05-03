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
export type Parse<E, T, R = never> = (
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
export class Parser<E, T, R = never> implements SchemaAST.Annotated {
  constructor(
    readonly run: Parse<Option.Option<E>, Option.Option<T>, R>,
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
export function parseSome<E, T, R = never>(
  onSome: Parse<E, Option.Option<T>, R>,
  annotations?: Annotations
): Parser<E, T, R> {
  return new Parser(
    (oe, ast, options) => Option.isNone(oe) ? SchemaResult.succeedNone : onSome(oe.value, ast, options),
    annotations
  )
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function mapSome<E, T>(f: (e: E) => T, annotations?: Annotations): Parser<E, T> {
  return parseSome((e) => SchemaResult.succeedSome(f(e)), annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function withDefault<T>(defaultValue: () => T, annotations?: Annotations): Parser<T, T, never> {
  return parseNone(() => SchemaResult.succeedSome(defaultValue()), annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function required<T>(annotations?: Annotations): Parser<T, T, never> {
  return parseNone<T, never>(() => SchemaResult.fail(SchemaIssue.MissingIssue.instance), {
    title: "required",
    ...annotations
  })
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function omit<T>(annotations?: Annotations): Parser<T, T, never> {
  return parseSome<T, never>(() => SchemaResult.succeedNone, { title: "omit", ...annotations })
}

/**
 * @since 4.0.0
 */
export const tapInput = <E>(f: (o: Option.Option<E>) => void) => <T, R>(parser: Parser<E, T, R>): Parser<E, T, R> => {
  return new Parser((oe, ast, options) => {
    f(oe)
    return parser.run(oe, ast, options)
  }, parser.annotations)
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export const String: Parser<unknown, string> = mapSome(globalThis.String, {
  title: "String coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Number: Parser<unknown, number> = mapSome(globalThis.Number, {
  title: "Number coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Boolean: Parser<unknown, boolean> = mapSome(globalThis.Boolean, {
  title: "Boolean coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const BigInt: Parser<string | number | bigint | boolean, bigint> = mapSome(globalThis.BigInt, {
  title: "BigInt coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Date: Parser<string | number | Date, Date> = mapSome((u) => new globalThis.Date(u), {
  title: "Date coercion"
})

/**
 * @category String transformations
 * @since 4.0.0
 */
export function trim<E extends string>(annotations?: Annotations): Parser<E, string> {
  return mapSome((s) => s.trim(), { title: "trim", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function snakeToCamel<E extends string>(annotations?: Annotations): Parser<E, string> {
  return mapSome(Str.snakeToCamel, { title: "snakeToCamel", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function camelToSnake<E extends string>(annotations?: Annotations): Parser<E, string> {
  return mapSome(Str.camelToSnake, { title: "camelToSnake", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toLowerCase<E extends string>(annotations?: Annotations): Parser<E, string> {
  return mapSome(Str.toLowerCase, { title: "toLowerCase", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toUpperCase<E extends string>(annotations?: Annotations): Parser<E, string> {
  return mapSome(Str.toUpperCase, { title: "toUpperCase", ...annotations })
}
