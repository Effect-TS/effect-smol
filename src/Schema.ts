/**
 * @since 4.0.0
 */

import type { Brand } from "./Brand.js"
import type { Equivalence } from "./Equivalence.js"
import type * as FastCheck from "./FastCheck.js"
import { ownKeys } from "./internal/schema/util.js"
import * as Option from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"
import * as SchemaAST from "./SchemaAST.js"
import * as SchemaParser from "./SchemaParser.js"
import type * as Types from "./Types.js"

/**
 * @since 4.0.0
 */
export type Simplify<T> = { [K in keyof T]: T[K] } & {}

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
export interface Annotations<T = any> extends SchemaAST.Annotations {
  readonly title?: string
  readonly description?: string
  readonly documentation?: string
  readonly default?: T
  readonly examples?: ReadonlyArray<T>
  readonly arbitrary?: (fc: typeof FastCheck) => FastCheck.Arbitrary<T>
  readonly equivalence?: Equivalence<T>
}

/**
 * @category model
 * @since 4.0.0
 */
export interface Schema<out T, out E = T, out R = never> extends Schema.Variance<T, E, R>, Pipeable {
  readonly Type: T
  readonly Encoded: E
  readonly Context: R
  readonly ast: SchemaAST.AST
  annotate(annotations: Annotations): Schema<T, E, R>
  make(input: NoInfer<T>): T
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
      readonly _T: Types.Covariant<T>
      readonly _E: Types.Covariant<E>
      readonly _R: Types.Covariant<R>
    }
  }
  /**
   * @since 4.0.0
   */
  export type Type<S extends Schema.Any> = S["Type"]
  /**
   * @since 4.0.0
   */
  export type Encoded<S extends Schema.Any> = S["Encoded"]
  /**
   * @since 4.0.0
   */
  export type Context<S extends Schema.Any> = S["Context"]
  /**
   * @since 4.0.0
   */
  export type Any = Schema<any, any, any>
}

const variance = {
  /* v8 ignore next 3 */
  _T: (_: never) => _,
  _E: (_: never) => _,
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
  annotate(annotations: Annotations): Schema<T, E, R> {
    return new Schema$(SchemaAST.annotate(this.ast, annotations))
  }
  make(input: T): T {
    return SchemaParser.validateUnknownSync(this)(input)
  }
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface typeSchema<T> extends Schema<T> {}

/**
 * The `typeSchema` function allows you to extract the `Type` portion of a
 * schema, creating a new schema that conforms to the properties defined in the
 * original schema without considering the initial encoding or transformation
 * processes.
 *
 * @since 4.0.0
 */
export const typeSchema = <T, E, R>(schema: Schema<T, E, R>): typeSchema<T> =>
  new Schema$(SchemaAST.typeAST(schema.ast))

/**
 * @since 4.0.0
 */
export function asSchema<T, E, R>(schema: Schema<T, E, R>): Schema<T, E, R> {
  return schema
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Never extends typeSchema<never> {
  annotate(annotations: Annotations): this
}

/**
 * @since 4.0.0
 */
export const Never: Never = new Schema$(new SchemaAST.NeverKeyword([], {}))

/**
 * @category api interface
 * @since 4.0.0
 */
export interface String extends typeSchema<string> {
  annotate(annotations: Annotations<string>): this
  make(input: string): string
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
  export type Type<F extends Fields> = { readonly [K in keyof F]: Schema.Type<F[K]> }
  /**
   * @since 4.0.0
   */
  export type Encoded<F extends Fields> = { readonly [K in keyof F]: Schema.Encoded<F[K]> }
  /**
   * @since 4.0.0
   */
  export type Context<F extends Fields> = { readonly [K in keyof F]: Schema.Context<F[K]> }[keyof F]
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Struct<F extends Struct.Fields>
  extends Schema<Simplify<Struct.Type<F>>, Simplify<Struct.Encoded<F>>, Struct.Context<F>>
{
  readonly fields: { readonly [K in keyof F]: F[K] }
  annotate(annotations: Annotations<Simplify<Struct.Type<F>>>): this
  make(input: { readonly [K in keyof F]: Parameters<F[K]["make"]>[0] }): Simplify<Struct.Type<F>>
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
  extends Schema<Schema.Type<S> & Brand<B>, Schema.Encoded<S>, Schema.Context<S>>
{
  annotate(annotations: Annotations<Schema.Type<S> & Brand<B>>): this
  make(input: Schema.Type<S>): Schema.Type<S> & Brand<B>
}

/**
 * @since 4.0.0
 */
export const brand =
  <B extends string | symbol>(_brand: B) => <Self extends Schema.Any>(self: Self): brand<Self, B> => {
    return self
  }

/**
 * @category api interface
 * @since 4.0.0
 */
export interface suspend<T, E, R> extends Schema<T, E, R> {
  annotate(annotations: Annotations<T>): this
}

/**
 * @category constructors
 * @since 4.0.0
 */
export const suspend = <T, E = T, R = never>(f: () => Schema<T, E, R>): suspend<T, E, R> =>
  new Schema$(new SchemaAST.Suspend(() => f().ast, [], {}))

/**
 * @category api interface
 * @since 4.0.0
 */
export interface filter<S extends Schema.Any> extends Schema<Schema.Type<S>, Schema.Encoded<S>, Schema.Context<S>> {
  annotate(annotations: Annotations<Schema.Type<S>>): this
}

/**
 * @category filtering
 * @since 4.0.0
 */
export const filter = <S extends Schema.Any>(
  filter: (
    type: Schema.Type<S>,
    self: SchemaAST.AST,
    options: SchemaAST.ParseOptions
  ) => Option.Option<SchemaAST.Issue>,
  annotations?: Annotations<Schema.Type<S>>
) =>
(self: S): filter<S> => {
  const refinement: SchemaAST.Refinement = { filter, annotations: annotations ?? {} }
  return new Schema$(SchemaAST.filter(self.ast, refinement))
}

/**
 * @category Length filters
 * @since 4.0.0
 */
export const minLength = <T extends { readonly length: number }>(
  minLength: number,
  annotations?: Annotations<T>
) =>
<S extends Schema<T, any, any>>(self: S): filter<S> =>
  self.pipe(
    filter(
      (a, ast) =>
        a.length >= minLength
          ? Option.none()
          : Option.some(new SchemaAST.ValidationIssue(ast, a, `must be at least ${minLength} characters long`)),
      {
        title: `minLength(${minLength})`,
        description: `a string at least ${minLength} character(s) long`,
        ...annotations
      }
    )
  )
