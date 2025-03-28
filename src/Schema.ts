/**
 * @since 4.0.0
 */

import type { Brand } from "./Brand.js"
import type { Equivalence } from "./Equivalence.js"
import type * as FastCheck from "./FastCheck.js"
import { ownKeys } from "./internal/schema/util.js"
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
export interface Schema<out T, out E, out R> extends Schema.Variance<T, E, R>, Pipeable {
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
  export type Type<S> = S extends Schema<infer T, infer _E, infer _R> ? T : never
  /**
   * @since 4.0.0
   */
  export type Encoded<S> = S extends Schema<infer _T, infer E, infer _R> ? E : never
  /**
   * @since 4.0.0
   */
  export type Context<S> = S extends Schema<infer _T, infer _E, infer R> ? R : never
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
export interface typeSchema<T> extends Schema<T, T, never> {}

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
export interface Never extends Schema<never, never, never> {
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
export interface String extends Schema<string, string, never> {
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
  readonly fields: Readonly<F>
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
export const suspend = <T, E, R>(f: () => Schema<T, E, R>): suspend<T, E, R> =>
  new Schema$(new SchemaAST.Suspend(() => f().ast, [], {}))

// /**
//  * @category filtering
//  * @since 4.0.0
//  */
// export function filter<S extends Schema.Any>(
//   refinement: SchemaAST.Refinement
// ): (self: S) => filter<S>
// export function filter<A>(
//   refinement: SchemaAST.Refinement
// ): <I, R>(self: Schema<A, I, R>) => filter<S> {
//   return <I, R>(self: Schema<A, I, R>) => {
//     function filter(input: A, options: AST.ParseOptions, ast: AST.Refinement) {
//       return toFilterParseIssue(predicate(input, options, ast), ast, input)
//     }
//     const ast = new AST.Refinement(
//       self.ast,
//       filter,
//       toASTAnnotations(annotations)
//     )
//     return makeRefineClass(self, filter, ast)
//   }
// }
