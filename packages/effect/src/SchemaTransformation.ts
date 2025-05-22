/**
 * @since 4.0.0
 */

import type * as Option from "./Option.js"
import type * as SchemaAST from "./SchemaAST.js"
import * as SchemaGetter from "./SchemaGetter.js"
import type * as SchemaResult from "./SchemaResult.js"

/**
 * @category model
 * @since 4.0.0
 */
export class SchemaMiddleware<in out T, in out E, RD1, RD2, RE1, RE2> {
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
  flip(): SchemaMiddleware<E, T, RE1, RE2, RD1, RD2> {
    return new SchemaMiddleware(this.encode, this.decode)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class SchemaTransformation<in out T, in out E, RD = never, RE = never> {
  readonly _tag = "Transformation"
  constructor(
    readonly decode: SchemaGetter.SchemaGetter<T, E, RD>,
    readonly encode: SchemaGetter.SchemaGetter<E, T, RE>
  ) {}
  flip(): SchemaTransformation<E, T, RE, RD> {
    return new SchemaTransformation(this.encode, this.decode)
  }
  compose<T2, RD2, RE2>(other: SchemaTransformation<T2, T, RD2, RE2>): SchemaTransformation<T2, E, RD | RD2, RE | RE2> {
    return new SchemaTransformation(
      this.decode.compose(other.decode),
      other.encode.compose(this.encode)
    )
  }
}

/**
 * @since 4.0.0
 */
export const make = <T, E, RD = never, RE = never>(transformation: {
  readonly decode: SchemaGetter.SchemaGetter<T, E, RD>
  readonly encode: SchemaGetter.SchemaGetter<E, T, RE>
}): SchemaTransformation<T, E, RD, RE> => {
  if (transformation instanceof SchemaTransformation) {
    return transformation
  }
  return new SchemaTransformation(transformation.decode, transformation.encode)
}

/**
 * @since 4.0.0
 */
export function transformOrFail<T, E, RD, RE>(options: {
  readonly decode: (e: E, ast: SchemaAST.AST, options: SchemaAST.ParseOptions) => SchemaResult.SchemaResult<T, RD>
  readonly encode: (t: T, ast: SchemaAST.AST, options: SchemaAST.ParseOptions) => SchemaResult.SchemaResult<E, RE>
}): SchemaTransformation<T, E, RD, RE> {
  return new SchemaTransformation(
    SchemaGetter.transformOrFail(options.decode),
    SchemaGetter.transformOrFail(options.encode)
  )
}

/**
 * @since 4.0.0
 */
export function transform<T, E>(options: {
  readonly decode: (input: E) => T
  readonly encode: (input: T) => E
}): SchemaTransformation<T, E> {
  return new SchemaTransformation(
    SchemaGetter.transform(options.decode),
    SchemaGetter.transform(options.encode)
  )
}

/**
 * @since 4.0.0
 */
export function transformOptional<T, E>(options: {
  readonly decode: (input: Option.Option<E>) => Option.Option<T>
  readonly encode: (input: Option.Option<T>) => Option.Option<E>
}): SchemaTransformation<T, E> {
  return new SchemaTransformation(
    SchemaGetter.transformOptional(options.decode),
    SchemaGetter.transformOptional(options.encode)
  )
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export const String: SchemaTransformation<string, unknown> = new SchemaTransformation(
  SchemaGetter.String,
  SchemaGetter.passthrough<unknown>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Number: SchemaTransformation<number, unknown> = new SchemaTransformation(
  SchemaGetter.Number,
  SchemaGetter.passthrough<unknown>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Boolean: SchemaTransformation<boolean, unknown> = new SchemaTransformation(
  SchemaGetter.Boolean,
  SchemaGetter.passthrough<unknown>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const BigInt: SchemaTransformation<bigint, string | number | bigint | boolean> = new SchemaTransformation(
  SchemaGetter.BigInt,
  SchemaGetter.passthrough<string | number | bigint | boolean>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Date: SchemaTransformation<Date, string | number | Date> = new SchemaTransformation(
  SchemaGetter.Date,
  SchemaGetter.passthrough<string | number | Date>()
)

/**
 * @category String transformations
 * @since 4.0.0
 */
export const trim: SchemaTransformation<string, string> = new SchemaTransformation(
  SchemaGetter.trim(),
  SchemaGetter.passthrough<string>()
)

/**
 * @category String transformations
 * @since 4.0.0
 */
export const snakeToCamel: SchemaTransformation<string, string> = new SchemaTransformation(
  SchemaGetter.snakeToCamel(),
  SchemaGetter.camelToSnake()
)

/**
 * @category String transformations
 * @since 4.0.0
 */
export const toLowerCase: SchemaTransformation<string, string> = new SchemaTransformation(
  SchemaGetter.toLowerCase(),
  SchemaGetter.passthrough()
)

/**
 * @category String transformations
 * @since 4.0.0
 */
export const toUpperCase: SchemaTransformation<string, string> = new SchemaTransformation(
  SchemaGetter.toUpperCase(),
  SchemaGetter.passthrough()
)

/**
 * @since 4.0.0
 */
export interface JsonOptions extends SchemaGetter.ParseJsonOptions, SchemaGetter.StringifyJsonOptions {}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function json(options?: JsonOptions): SchemaTransformation<unknown, string> {
  return new SchemaTransformation(
    SchemaGetter.parseJson({ options }),
    SchemaGetter.stringifyJson({ options })
  )
}

const passthrough_ = new SchemaTransformation(
  SchemaGetter.passthrough<any>(),
  SchemaGetter.passthrough<any>()
)

/**
 * @since 4.0.0
 */
export function passthrough<T, E>(options: { readonly strict: false }): SchemaTransformation<T, E>
export function passthrough<T>(): SchemaTransformation<T, T>
export function passthrough<T>(): SchemaTransformation<T, T> {
  return passthrough_
}

/**
 * @since 4.0.0
 */
export function passthroughSubtype<T extends E, E>(): SchemaTransformation<T, E>
export function passthroughSubtype<T>(): SchemaTransformation<T, T> {
  return passthrough_
}

/**
 * @since 4.0.0
 */
export function passthroughSupertype<T, E extends T>(): SchemaTransformation<T, E>
export function passthroughSupertype<T>(): SchemaTransformation<T, T> {
  return passthrough_
}
