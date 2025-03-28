/**
 * @since 4.0.0
 */

import type { Brand } from "./Brand.js"
import { ownKeys } from "./internal/schema/util.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"
import * as SchemaAST from "./SchemaAST.js"
import * as SchemaParser from "./SchemaParser.js"
import type * as Types from "./Types.js"

/**
 * @since 4.0.0
 */
export type Simplify<A> = { [K in keyof A]: A[K] } & {}

/**
 * @since 4.0.0
 * @category symbol
 */
export const TypeId: unique symbol = Symbol.for("effect/Schema")

/**
 * @since 4.0.0
 * @category symbol
 */
export type TypeId = typeof TypeId

/**
 * @category model
 * @since 4.0.0
 */
export interface Schema<T, E, R> extends Schema.Variance<T, E, R>, Pipeable {
  readonly Type: T
  readonly Encoded: E
  readonly Context: R
  readonly ast: SchemaAST.AST
  /**
   * Merges a set of new annotations with existing ones, potentially overwriting
   * any duplicates.
   */
  annotate: (annotations: SchemaAST.Annotations) => Schema<T, E, R>
  make: (type: T) => T
}

/**
 * @since 4.0.0
 */
export declare namespace Schema {
  /**
   * @since 4.0.0
   */
  export interface Variance<T, E, R> {
    readonly [TypeId]: {
      readonly _T: Types.Invariant<T>
      readonly _E: Types.Invariant<E>
      readonly _R: Types.Covariant<R>
    }
  }
}

const variance = {
  /* v8 ignore next 3 */
  _T: (_: any) => _,
  _E: (_: any) => _,
  _R: (_: never) => _
}

class Schema$<T, E, R> implements Schema<T, E, R> {
  [TypeId] = variance
  readonly Type!: T
  readonly Encoded!: E
  readonly Context!: R
  constructor(readonly ast: SchemaAST.AST) {}

  pipe() {
    return pipeArguments(this, arguments)
  }

  annotate(annotations: SchemaAST.Annotations): Schema<T, E, R> {
    return new Schema$(SchemaAST.annotate(this.ast, annotations))
  }

  make(type: T): T {
    return SchemaParser.validateUnknownSync(this)(type)
  }
}

/**
 * The `typeSchema` function allows you to extract the `Type` portion of a
 * schema, creating a new schema that conforms to the properties defined in the
 * original schema without considering the initial encoding or transformation
 * processes.
 *
 * @since 4.0.0
 */
export const typeSchema = <T, E, R>(schema: Schema<T, E, R>): Schema<T, T, never> =>
  new Schema$(SchemaAST.typeAST(schema.ast))

/**
 * @since 4.0.0
 */
export declare namespace Schema {
  /**
   * @since 4.0.0
   */
  export type Any = Schema<any, any, any>
}

/**
 * @since 4.0.0
 */
export function asSchema<A, I, R>(schema: Schema<A, I, R>): Schema<A, I, R> {
  return schema
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface String extends Schema<string, string, never> {
  annotate: (annotations: SchemaAST.Annotations) => String
}

/**
 * @since 4.0.0
 */
export const String: String = new Schema$(new SchemaAST.StringKeyword([], {}))

/**
 * @since 4.0.0
 */
export declare namespace Struct {
  /**
   * @since 4.0.0
   */
  export type Field = Schema.Any
  /**
   * @since 4.0.0
   */
  export type Fields = { readonly [x: PropertyKey]: Field }
  /**
   * @since 4.0.0
   */
  export type Type<F extends Fields> = { readonly [K in keyof F]: F[K]["Type"] }
  /**
   * @since 4.0.0
   */
  export type Encoded<F extends Fields> = { readonly [K in keyof F]: F[K]["Encoded"] }
  /**
   * @since 4.0.0
   */
  export type Context<F extends Fields> = { readonly [K in keyof F]: F[K]["Context"] }[keyof F]
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Struct<F extends Struct.Fields>
  extends Schema<Simplify<Struct.Type<F>>, Simplify<Struct.Encoded<F>>, Struct.Context<F>>
{
  readonly fields: Readonly<F>
  annotate: (annotations: SchemaAST.Annotations) => Struct<F>
  make: (type: { readonly [K in keyof F]: Parameters<F[K]["make"]>[0] }) => Simplify<Struct.Type<F>>
}

class Struct$<F extends Struct.Fields> extends Schema$<Struct.Type<F>, Struct.Encoded<F>, Struct.Context<F>> {
  readonly fields: F
  constructor(fields: F, override?: SchemaAST.AST) {
    const ast = override ?? new SchemaAST.TypeLiteral(
      ownKeys(fields).map((key) => new SchemaAST.PropertySignature(key, fields[key].ast, false, true, {})),
      [],
      [],
      {}
    )
    super(ast)
    this.fields = { ...fields }
  }

  annotate(annotations: SchemaAST.Annotations): Struct<F> {
    return new Struct$(this.fields, SchemaAST.annotate(this.ast, annotations))
  }
}

/**
 * @since 4.0.0
 */
export function Struct<F extends Struct.Fields>(fields: F): Struct<F> {
  return new Struct$(fields)
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface brand<S extends Schema.Any, B extends string | symbol>
  extends Schema<S["Type"] & Brand<B>, S["Encoded"], S["Context"]>
{
  make: (type: S["Type"]) => S["Type"] & Brand<B>
}

/**
 * @since 4.0.0
 */
export const brand = <Self extends Schema.Any, B extends string | symbol>(
  _brand: B
) =>
(self: Self): brand<Self, B> => {
  return self
}
