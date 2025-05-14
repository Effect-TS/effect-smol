/**
 * @since 4.0.0
 */

import * as Function from "./Function.js"
import type * as Option from "./Option.js"
import type * as SchemaAnnotations from "./SchemaAnnotations.js"
import type * as SchemaAST from "./SchemaAST.js"
import * as SchemaGetter from "./SchemaGetter.js"
import * as SchemaIssue from "./SchemaIssue.js"
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
}

/**
 * @since 4.0.0
 */
export const make = <T, E, RD, RE>(transformation: {
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
export function identity<T>(): SchemaTransformation<T, T> {
  const identity = SchemaGetter.identity<T>()
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
    SchemaGetter.mapSome(decode, { title: "transform" }),
    SchemaGetter.mapSome(encode, { title: "transform" })
  )
}

/**
 * @since 4.0.0
 */
export function transformOrFail<T, E, RD, RE>(
  decode: SchemaGetter.Getter<Option.Option<T>, E, RD>,
  encode: SchemaGetter.Getter<Option.Option<E>, T, RE>
): SchemaTransformation<T, E, RD, RE> {
  return new SchemaTransformation(
    SchemaGetter.parseSome(decode, { title: "transformOrFail" }),
    SchemaGetter.parseSome(encode, { title: "transformOrFail" })
  )
}

/**
 * Omit a key in the output of the decoding function when the predicate is false.
 *
 * The encoding function will always return the original value.
 *
 * @since 4.0.0
 */
export function omitKeyUnless<T extends E, E>(
  f: (e: E) => e is T,
  annotations?: SchemaAnnotations.Documentation
): SchemaTransformation<T, E>
export function omitKeyUnless<T>(
  f: (t: T) => boolean,
  annotations?: SchemaAnnotations.Documentation
): SchemaTransformation<T, T>
export function omitKeyUnless<T>(
  f: (t: T) => boolean,
  annotations?: SchemaAnnotations.Documentation
): SchemaTransformation<T, T> {
  return new SchemaTransformation<T, T>(
    SchemaGetter.omitKeyUnless(f, annotations),
    SchemaGetter.identity()
  )
}

/**
 * Omit a key in the output of the decoding function when the predicate is true.
 *
 * The encoding function will always return the original value.
 *
 * @since 4.0.0
 */
export function omitKeyWhen<T extends E, E>(
  f: (e: E) => e is T,
  annotations?: SchemaAnnotations.Documentation
): SchemaTransformation<Exclude<E, T>, E>
export function omitKeyWhen<T>(
  f: (t: T) => boolean,
  annotations?: SchemaAnnotations.Documentation
): SchemaTransformation<T, T>
export function omitKeyWhen<T>(
  f: (t: T) => boolean,
  annotations?: SchemaAnnotations.Documentation
): any {
  return new SchemaTransformation(
    SchemaGetter.omitKeyWhen(f, annotations),
    SchemaGetter.identity()
  )
}

/**
 * @since 4.0.0
 */
export function fail<T>(
  message: string,
  annotations?: SchemaAnnotations.Documentation
): SchemaTransformation<T, T> {
  const fail = SchemaGetter.fail<T>((o) => new SchemaIssue.Forbidden(o, { message }), annotations)
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
    SchemaGetter.tapInput(options.onDecode ?? Function.constVoid)(transformation.decode),
    SchemaGetter.tapInput(options.onEncode ?? Function.constVoid)(transformation.encode)
  )
}

/**
 * @since 4.0.0
 */
export function withDecodingDefault<T>(f: () => T): SchemaTransformation<T, T> {
  return new SchemaTransformation(
    SchemaGetter.withDefault(f, { title: "withDecodingDefault" }),
    SchemaGetter.required()
  )
}

/**
 * @since 4.0.0
 */
export function withEncodingDefault<E>(f: () => E): SchemaTransformation<E, E> {
  return new SchemaTransformation(
    SchemaGetter.required(),
    SchemaGetter.withDefault(f, { title: "withEncodingDefault" })
  )
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export const String: SchemaTransformation<string, unknown> = new SchemaTransformation(
  SchemaGetter.String,
  SchemaGetter.identity<unknown>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Number: SchemaTransformation<number, unknown> = new SchemaTransformation(
  SchemaGetter.Number,
  SchemaGetter.identity<unknown>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Boolean: SchemaTransformation<boolean, unknown> = new SchemaTransformation(
  SchemaGetter.Boolean,
  SchemaGetter.identity<unknown>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const BigInt: SchemaTransformation<bigint, string | number | bigint | boolean> = new SchemaTransformation(
  SchemaGetter.BigInt,
  SchemaGetter.identity<string | number | bigint | boolean>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Date: SchemaTransformation<Date, string | number | Date> = new SchemaTransformation(
  SchemaGetter.Date,
  SchemaGetter.identity<string | number | Date>()
)

/**
 * @category String transformations
 * @since 4.0.0
 */
export const trim: SchemaTransformation<string, string> = new SchemaTransformation(
  SchemaGetter.trim(),
  SchemaGetter.identity()
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
  SchemaGetter.identity()
)

/**
 * @category String transformations
 * @since 4.0.0
 */
export const toUpperCase: SchemaTransformation<string, string> = new SchemaTransformation(
  SchemaGetter.toUpperCase(),
  SchemaGetter.identity()
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
