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
export class Transformation<E, T, RD = never, RE = never> {
  constructor(
    readonly decode: SchemaParser.Parser<E, T, RD>,
    readonly encode: SchemaParser.Parser<T, E, RE>
  ) {}
  flip(): Transformation<T, E, RE, RD> {
    return new Transformation(this.encode, this.decode)
  }
}

/**
 * @since 4.0.0
 */
export const identity = <T>(): Transformation<T, T> => {
  const identity = SchemaParser.identity<T>()
  return new Transformation(identity, identity)
}

/**
 * @since 4.0.0
 */
export const fail = <T>(message: string, annotations?: SchemaAST.Annotations.Documentation): Transformation<T, T> => {
  const fail = SchemaParser.fail<T>((o) => new SchemaIssue.ForbiddenIssue(o, message), annotations)
  return new Transformation(fail, fail)
}

/**
 * @since 4.0.0
 */
export const tap = <E, T, RD, RE>(
  transformation: Transformation<E, T, RD, RE>,
  options: {
    onDecode?: (input: Option.Option<E>) => void
    onEncode?: (input: Option.Option<T>) => void
  }
): Transformation<E, T, RD, RE> => {
  return new Transformation<E, T, RD, RE>(
    SchemaParser.tapInput(options.onDecode ?? Function.constVoid)(transformation.decode),
    SchemaParser.tapInput(options.onEncode ?? Function.constVoid)(transformation.encode)
  )
}

/**
 * @since 4.0.0
 */
export const setDecodingDefault = <T>(f: () => T) =>
  new Transformation(
    SchemaParser.setDefault(f, { title: "setDecodingDefault" }),
    SchemaParser.required()
  )

/**
 * @since 4.0.0
 */
export const setEncodingDefault = <E>(f: () => E) =>
  new Transformation<E, E>(
    SchemaParser.required(),
    SchemaParser.setDefault(f, { title: "setEncodingDefault" })
  )

/**
 * @category Coercions
 * @since 4.0.0
 */
export const String: Transformation<unknown, string> = new Transformation(
  SchemaParser.String,
  SchemaParser.identity<unknown>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Number: Transformation<unknown, number> = new Transformation(
  SchemaParser.Number,
  SchemaParser.identity<unknown>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Boolean: Transformation<unknown, boolean> = new Transformation(
  SchemaParser.Boolean,
  SchemaParser.identity<unknown>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const BigInt: Transformation<string | number | bigint | boolean, bigint> = new Transformation(
  SchemaParser.BigInt,
  SchemaParser.identity<string | number | bigint | boolean>()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const Date: Transformation<string | number | Date, Date> = new Transformation(
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
