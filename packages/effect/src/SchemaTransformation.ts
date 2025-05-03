/**
 * @since 4.0.0
 */

import * as Function from "./Function.js"
import type * as Option from "./Option.js"
import type * as SchemaAST from "./SchemaAST.js"
import * as SchemaIssue from "./SchemaIssue.js"
import * as SchemaParser from "./SchemaParser.js"

/**
 * @category model
 * @since 4.0.0
 */
export class Transformation<T, E, RD = never, RE = never> {
  constructor(
    readonly decode: SchemaParser.Parser<T, E, RD>,
    readonly encode: SchemaParser.Parser<E, T, RE>
  ) {}
  flip(): Transformation<E, T, RE, RD> {
    return new Transformation(this.encode, this.decode)
  }
}

/**
 * @since 4.0.0
 */
export function identity<T>(): Transformation<T, T> {
  const identity = SchemaParser.identity<T>()
  return new Transformation(identity, identity)
}

/**
 * @since 4.0.0
 */
export function transform<T, E>(
  decode: (input: E) => T,
  encode: (input: T) => E
): Transformation<T, E> {
  return new Transformation(
    SchemaParser.mapSome(decode, { title: "transform" }),
    SchemaParser.mapSome(encode, { title: "transform" })
  )
}

/**
 * @since 4.0.0
 */
export function fail<T>(message: string, annotations?: SchemaAST.Annotations.Documentation): Transformation<T, T> {
  const fail = SchemaParser.fail<T>((o) => new SchemaIssue.ForbiddenIssue(o, message), annotations)
  return new Transformation(fail, fail)
}

/**
 * @since 4.0.0
 */
export function tap<T, E, RD, RE>(
  transformation: Transformation<T, E, RD, RE>,
  options: {
    onDecode?: (input: Option.Option<E>) => void
    onEncode?: (input: Option.Option<T>) => void
  }
): Transformation<T, E, RD, RE> {
  return new Transformation<T, E, RD, RE>(
    SchemaParser.tapInput(options.onDecode ?? Function.constVoid)(transformation.decode),
    SchemaParser.tapInput(options.onEncode ?? Function.constVoid)(transformation.encode)
  )
}

/**
 * @since 4.0.0
 */
export function withDecodingDefault<T>(f: () => T): Transformation<T, T> {
  return new Transformation(
    SchemaParser.withDefault(f, { title: "withDecodingDefault" }),
    SchemaParser.required()
  )
}

/**
 * @since 4.0.0
 */
export function withEncodingDefault<E>(f: () => E): Transformation<E, E> {
  return new Transformation(
    SchemaParser.required(),
    SchemaParser.withDefault(f, { title: "withEncodingDefault" })
  )
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export const String: Transformation<string, unknown> = new Transformation(
  SchemaParser.String,
  SchemaParser.identity<unknown>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Number: Transformation<number, unknown> = new Transformation(
  SchemaParser.Number,
  SchemaParser.identity<unknown>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Boolean: Transformation<boolean, unknown> = new Transformation(
  SchemaParser.Boolean,
  SchemaParser.identity<unknown>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const BigInt: Transformation<bigint, string | number | bigint | boolean> = new Transformation(
  SchemaParser.BigInt,
  SchemaParser.identity<string | number | bigint | boolean>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Date: Transformation<Date, string | number | Date> = new Transformation(
  SchemaParser.Date,
  SchemaParser.identity<string | number | Date>()
)

/**
 * @category String transformations
 * @since 4.0.0
 */
export const trim: Transformation<string, string> = new Transformation(
  SchemaParser.trim(),
  SchemaParser.identity()
)

/**
 * @category String transformations
 * @since 4.0.0
 */
export const snakeToCamel: Transformation<string, string> = new Transformation(
  SchemaParser.snakeToCamel(),
  SchemaParser.camelToSnake()
)

/**
 * @category String transformations
 * @since 4.0.0
 */
export const toLowerCase: Transformation<string, string> = new Transformation(
  SchemaParser.toLowerCase(),
  SchemaParser.identity()
)

/**
 * @category String transformations
 * @since 4.0.0
 */
export const toUpperCase: Transformation<string, string> = new Transformation(
  SchemaParser.toUpperCase(),
  SchemaParser.identity()
)
