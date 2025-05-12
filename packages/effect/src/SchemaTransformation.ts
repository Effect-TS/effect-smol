/**
 * @since 4.0.0
 */

import * as Function from "./Function.js"
import type * as Option from "./Option.js"
import type * as SchemaAST from "./SchemaAST.js"
import * as SchemaParser from "./SchemaGetter.js"
import * as SchemaIssue from "./SchemaIssue.js"
import type * as SchemaResult from "./SchemaResult.js"

/**
 * @category model
 * @since 4.0.0
 */
export class SchemaMiddleware<T, E, RD1, RD2, RE1, RE2> {
  readonly _tag = "Middleware"
  constructor(
    readonly decode: (
      sr: SchemaResult.SchemaResult<Option.Option<E>, RD1>,
      ast: SchemaAST.AST,
      options: SchemaAST.ParseOptions
    ) => SchemaResult.SchemaResult<Option.Option<T>, RD2>,
    readonly encode: (
      sr: SchemaResult.SchemaResult<Option.Option<T>, RE1>,
      ast: SchemaAST.AST,
      options: SchemaAST.ParseOptions
    ) => SchemaResult.SchemaResult<Option.Option<E>, RE2>
  ) {}
  /** @internal */
  flip(): SchemaMiddleware<E, T, RE1, RE2, RD1, RD2> {
    return new SchemaMiddleware(this.encode, this.decode)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class SchemaTransformation<T, E, RD = never, RE = never> {
  readonly _tag = "Transformation"
  constructor(
    readonly decode: SchemaParser.SchemaGetter<T, E, RD>,
    readonly encode: SchemaParser.SchemaGetter<E, T, RE>
  ) {}
  /** @internal */
  flip(): SchemaTransformation<E, T, RE, RD> {
    return new SchemaTransformation(this.encode, this.decode)
  }
}

/**
 * @since 4.0.0
 */
export function identity<T>(): SchemaTransformation<T, T> {
  const identity = SchemaParser.identity<T>()
  return new SchemaTransformation(identity, identity)
}

/**
 * @since 4.0.0
 */
export function transform<T, E>(
  decode: (input: E) => T,
  encode: (input: T) => E
): SchemaTransformation<T, E> {
  return new SchemaTransformation(
    SchemaParser.mapSome(decode, { title: "transform" }),
    SchemaParser.mapSome(encode, { title: "transform" })
  )
}

/**
 * @since 4.0.0
 */
export function transformOrFail<T, E, RD, RE>(
  decode: SchemaParser.Getter<Option.Option<T>, E, RD>,
  encode: SchemaParser.Getter<Option.Option<E>, T, RE>
): SchemaTransformation<T, E, RD, RE> {
  return new SchemaTransformation(
    SchemaParser.parseSome(decode, { title: "transformOrFail" }),
    SchemaParser.parseSome(encode, { title: "transformOrFail" })
  )
}

/**
 * @since 4.0.0
 */
export function fail<T>(
  message: string,
  annotations?: SchemaAST.Annotations.Documentation
): SchemaTransformation<T, T> {
  const fail = SchemaParser.fail<T>((o) => new SchemaIssue.Forbidden(o, { message }), annotations)
  return new SchemaTransformation(fail, fail)
}

/**
 * @since 4.0.0
 */
export function tap<T, E, RD, RE>(
  transformation: SchemaTransformation<T, E, RD, RE>,
  options: {
    onDecode?: (input: Option.Option<E>) => void
    onEncode?: (input: Option.Option<T>) => void
  }
): SchemaTransformation<T, E, RD, RE> {
  return new SchemaTransformation<T, E, RD, RE>(
    SchemaParser.tapInput(options.onDecode ?? Function.constVoid)(transformation.decode),
    SchemaParser.tapInput(options.onEncode ?? Function.constVoid)(transformation.encode)
  )
}

/**
 * @since 4.0.0
 */
export function withDecodingDefault<T>(f: () => T): SchemaTransformation<T, T> {
  return new SchemaTransformation(
    SchemaParser.withDefault(f, { title: "withDecodingDefault" }),
    SchemaParser.required()
  )
}

/**
 * @since 4.0.0
 */
export function withEncodingDefault<E>(f: () => E): SchemaTransformation<E, E> {
  return new SchemaTransformation(
    SchemaParser.required(),
    SchemaParser.withDefault(f, { title: "withEncodingDefault" })
  )
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export const String: SchemaTransformation<string, unknown> = new SchemaTransformation(
  SchemaParser.String,
  SchemaParser.identity<unknown>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Number: SchemaTransformation<number, unknown> = new SchemaTransformation(
  SchemaParser.Number,
  SchemaParser.identity<unknown>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Boolean: SchemaTransformation<boolean, unknown> = new SchemaTransformation(
  SchemaParser.Boolean,
  SchemaParser.identity<unknown>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const BigInt: SchemaTransformation<bigint, string | number | bigint | boolean> = new SchemaTransformation(
  SchemaParser.BigInt,
  SchemaParser.identity<string | number | bigint | boolean>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Date: SchemaTransformation<Date, string | number | Date> = new SchemaTransformation(
  SchemaParser.Date,
  SchemaParser.identity<string | number | Date>()
)

/**
 * @category String transformations
 * @since 4.0.0
 */
export const trim: SchemaTransformation<string, string> = new SchemaTransformation(
  SchemaParser.trim(),
  SchemaParser.identity()
)

/**
 * @category String transformations
 * @since 4.0.0
 */
export const snakeToCamel: SchemaTransformation<string, string> = new SchemaTransformation(
  SchemaParser.snakeToCamel(),
  SchemaParser.camelToSnake()
)

/**
 * @category String transformations
 * @since 4.0.0
 */
export const toLowerCase: SchemaTransformation<string, string> = new SchemaTransformation(
  SchemaParser.toLowerCase(),
  SchemaParser.identity()
)

/**
 * @category String transformations
 * @since 4.0.0
 */
export const toUpperCase: SchemaTransformation<string, string> = new SchemaTransformation(
  SchemaParser.toUpperCase(),
  SchemaParser.identity()
)

/**
 * @since 4.0.0
 */
export interface JsonOptions extends SchemaParser.ParseJsonOptions, SchemaParser.StringifyJsonOptions {}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function json(options?: JsonOptions): SchemaTransformation<unknown, string> {
  return new SchemaTransformation(
    SchemaParser.parseJson({ options }),
    SchemaParser.stringifyJson({ options })
  )
}

/**
 * @since 4.0.0
 */
export function compose<T, E>(options: { readonly strict: false }): SchemaTransformation<T, E>
export function compose<T>(): SchemaTransformation<T, T>
export function compose<T, E>(): SchemaTransformation<T, E> {
  return identity() as any
}

/**
 * @since 4.0.0
 */
export function composeSubtype<T extends E, E>(): SchemaTransformation<T, E> {
  return identity() as any
}

/**
 * @since 4.0.0
 */
export function composeSupertype<T, E extends T>(): SchemaTransformation<T, E> {
  return identity() as any
}
