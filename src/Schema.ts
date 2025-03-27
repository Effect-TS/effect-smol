/**
 * @since 4.0.0
 */

import type { Brand } from "./Brand.js"
import { ownKeys } from "./internal/schema/util.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"
import * as SchemaAST from "./SchemaAST.js"

/**
 * @since 4.0.0
 */
export type Simplify<A> = { [K in keyof A]: A[K] } & {}

/**
 * @category model
 * @since 3.10.0
 */
export interface Schema<A, I, R> extends Pipeable {
  readonly Type: A
  readonly Encoded: I
  readonly Context: R
  readonly ast: SchemaAST.AST
  /**
   * Merges a set of new annotations with existing ones, potentially overwriting
   * any duplicates.
   */
  annotate(override: SchemaAST.Annotations): Schema<A, I, R>
  make(a: A): A
}

class Schema$<A, I, R> implements Schema<A, I, R> {
  readonly Type!: A
  readonly Encoded!: I
  readonly Context!: R
  constructor(readonly ast: SchemaAST.AST) {}

  pipe() {
    return pipeArguments(this, arguments)
  }

  annotate(override: SchemaAST.Annotations): Schema<A, I, R> {
    return new Schema$(SchemaAST.annotate(this.ast, override))
  }

  make(a: A): A {
    return a
  }
}

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
  annotate(override: SchemaAST.Annotations): String
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
  annotate(overrides: SchemaAST.Annotations): Struct<F>
  make(a: { readonly [K in keyof F]: Parameters<F[K]["make"]>[0] }): Simplify<Struct.Type<F>>
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

  annotate(override: SchemaAST.Annotations): Struct<F> {
    return new Struct$(this.fields, SchemaAST.annotate(this.ast, override))
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
 * @since 3.10.0
 */
export interface brand<S extends Schema.Any, B extends string | symbol>
  extends Schema<S["Type"] & Brand<B>, S["Encoded"], S["Context"]>
{
  make(a: S["Type"]): S["Type"] & Brand<B>
}

/**
 * @since 4.0.0
 */
export const brand = <S extends Schema.Any, B extends string | symbol>(
  _brand: B
) =>
(self: S): brand<S, B> => {
  return self
}
