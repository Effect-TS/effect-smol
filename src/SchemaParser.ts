/**
 * @since 4.0.0
 */

import * as Option from "./Option.js"
import * as SchemaAST from "./SchemaAST.js"
import * as SchemaParserResult from "./SchemaParserResult.js"

/**
 * @category model
 * @since 4.0.0
 */
export type Parse<E, T, R = never> = (
  i: E,
  options: SchemaAST.ParseOptions
) => SchemaParserResult.SchemaParserResult<T, R>

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
    readonly parse: Parse<Option.Option<E>, Option.Option<T>, R>,
    readonly annotations: Annotations | undefined
  ) {}
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function succeed<T>(value: T, annotations?: Annotations): Parser<T, T> {
  return new Parser(() => SchemaParserResult.some(value), annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function fail<T>(f: (o: Option.Option<T>) => SchemaAST.Issue, annotations?: Annotations): Parser<T, T> {
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
  onNone: () => SchemaParserResult.SchemaParserResult<Option.Option<T>, R>,
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
export const missing = <T, R = never>(annotations?: Annotations) =>
  onNone<T, R>(() => SchemaParserResult.fail(SchemaAST.MissingIssue.instance), annotations)

/**
 * @category constructors
 * @since 4.0.0
 */
export function onSome<E, T, R = never>(
  onSome: Parse<E, Option.Option<T>, R>,
  annotations?: Annotations
): Parser<E, T, R> {
  return new Parser((oe, options) => {
    if (Option.isNone(oe)) {
      return SchemaParserResult.none
    } else {
      return onSome(oe.value, options)
    }
  }, annotations)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function lift<E, T>(f: (e: E) => T, annotations?: Annotations): Parser<E, T> {
  return onSome((e) => SchemaParserResult.some(f(e)), annotations)
}

/**
 * @since 4.0.0
 */
export const tapInput = <E>(f: (o: Option.Option<E>) => void) => <T, R>(parser: Parser<E, T, R>): Parser<E, T, R> => {
  return new Parser((oe, options) => {
    f(oe)
    return parser.parse(oe, options)
  }, parser.annotations)
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export const String: Parser<unknown, string> = lift(globalThis.String, {
  title: "String",
  description: "Coerces to string"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Number: Parser<unknown, number> = lift(globalThis.Number, {
  title: "Number",
  description: "Coerces to number"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Boolean: Parser<unknown, boolean> = lift(globalThis.Boolean, {
  title: "Boolean",
  description: "Coerces to boolean"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const BigInt: Parser<string | number | bigint | boolean, bigint> = lift(globalThis.BigInt, {
  title: "BigInt",
  description: "Coerces to bigint"
})

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Date: Parser<string | number | Date, Date> = lift((u) => new globalThis.Date(u), {
  title: "Date",
  description: "Coerces to date"
})

/**
 * @category String transformations
 * @since 4.0.0
 */
export function trim<E extends string>(annotations?: Annotations): Parser<E, string> {
  return lift((s) => s.trim(), { title: "trim", ...annotations })
}
