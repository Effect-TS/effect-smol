/**
 * @since 4.0.0
 */

import * as Option from "./Option.js"
import type * as SchemaAST from "./SchemaAST.js"
import * as SchemaIssue from "./SchemaIssue.js"
import * as SchemaParserResult from "./SchemaResult.js"
import * as Str from "./String.js"

/**
 * @category model
 * @since 4.0.0
 */
export type Parse<E, T, R = never> = (
  i: E,
  ast: SchemaAST.AST,
  options: SchemaAST.ParseOptions
) => SchemaParserResult.SchemaResult<T, R>

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
  return new Parser(() => SchemaParserResult.succeedSome(value), annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function fail<T>(f: (o: Option.Option<T>) => SchemaIssue.Issue, annotations?: Annotations): Parser<T, T> {
  return new Parser((o) => SchemaParserResult.fail(f(o)), annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function identity<T>(annotations?: Annotations): Parser<T, T> {
  return new Parser(SchemaParserResult.succeed, annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function onNone<T, R = never>(
  onNone: () => SchemaParserResult.SchemaResult<Option.Option<T>, R>,
  annotations?: Annotations
): Parser<T, T, R> {
  return new Parser((ot) => {
    if (Option.isNone(ot)) {
      return onNone()
    } else {
      return SchemaParserResult.succeed(ot)
    }
  }, annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export const setDefault = <T>(defaultValue: () => T, annotations?: Annotations) =>
  onNone<T, never>(() => SchemaParserResult.succeedSome(defaultValue()), annotations)

/**
 * @category constructors
 * @since 4.0.0
 */
export const required = <T>(annotations?: Annotations) =>
  onNone<T, never>(() => SchemaParserResult.fail(SchemaIssue.MissingIssue.instance), {
    title: "required",
    ...annotations
  })

/**
 * @category constructors
 * @since 4.0.0
 */
export const omit = <T>(annotations?: Annotations) =>
  onSome<T, never>(() => SchemaParserResult.succeedNone, { title: "omit", ...annotations })

/**
 * @category constructors
 * @since 4.0.0
 */
export function onSome<E, T, R = never>(
  onSome: Parse<E, Option.Option<T>, R>,
  annotations?: Annotations
): Parser<E, T, R> {
  return new Parser((oe, ast, options) => {
    if (Option.isNone(oe)) {
      return SchemaParserResult.succeedNone
    } else {
      return onSome(oe.value, ast, options)
    }
  }, annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function lift<E, T>(f: (e: E) => T, annotations?: Annotations): Parser<E, T> {
  return onSome((e) => SchemaParserResult.succeedSome(f(e)), annotations)
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
export const String: Parser<unknown, string> = lift(globalThis.String, {
  title: "String coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Number: Parser<unknown, number> = lift(globalThis.Number, {
  title: "Number coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Boolean: Parser<unknown, boolean> = lift(globalThis.Boolean, {
  title: "Boolean coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const BigInt: Parser<string | number | bigint | boolean, bigint> = lift(globalThis.BigInt, {
  title: "BigInt coercion"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Date: Parser<string | number | Date, Date> = lift((u) => new globalThis.Date(u), {
  title: "Date coercion"
})

/**
 * @category String transformations
 * @since 4.0.0
 */
export function trim<E extends string>(annotations?: Annotations): Parser<E, string> {
  return lift((s) => s.trim(), { title: "trim", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function snakeToCamel<E extends string>(annotations?: Annotations): Parser<E, string> {
  return lift(Str.snakeToCamel, { title: "snakeToCamel", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function camelToSnake<E extends string>(annotations?: Annotations): Parser<E, string> {
  return lift(Str.camelToSnake, { title: "camelToSnake", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toLowerCase<E extends string>(annotations?: Annotations): Parser<E, string> {
  return lift(Str.toLowerCase, { title: "toLowerCase", ...annotations })
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toUpperCase<E extends string>(annotations?: Annotations): Parser<E, string> {
  return lift(Str.toUpperCase, { title: "toUpperCase", ...annotations })
}
