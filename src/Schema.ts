/**
 * @since 4.0.0
 */

import type { Brand } from "./Brand.js"
import type { Equivalence } from "./Equivalence.js"
import type * as FastCheck from "./FastCheck.js"
import { ownKeys } from "./internal/schema/util.js"
import * as Order from "./Order.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"
import * as Predicate from "./Predicate.js"
import * as Result from "./Result.js"
import * as SchemaAST from "./SchemaAST.js"
import * as SchemaParser from "./SchemaParser.js"
import * as Struct_ from "./Struct.js"
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
// export function asSchema<T, E, R, Fields extends Struct.Fields>(
//   schema: Schema<T, E, R> & Struct<Fields>
// ): Schema<T, Simplify<E>, R>
// export function asSchema<T, E, R>(schema: Schema<T, E, R>): Schema<T, E, R>
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
export const Never: Never = new Schema$(new SchemaAST.NeverKeyword([], undefined, {}))

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
export const String: String = new Schema$(
  new SchemaAST.StringKeyword([], undefined, {})
)

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Number extends typeSchema<number> {
  annotate(annotations: Annotations<number>): this
  make(input: number): number
}

/**
 * @since 4.0.0
 */
export const Number: Number = new Schema$(
  new SchemaAST.NumberKeyword([], undefined, {})
)

/**
 * @since 4.0.0
 */
export const NumberFromString: Schema<number, string> = new Schema$(
  new SchemaAST.NumberKeyword(
    [],
    new SchemaAST.Transformation(
      String.ast,
      new SchemaAST.FinalTransformOrFail(
        (n) => Result.ok(globalThis.String(n)),
        (s, ast) => {
          const n = globalThis.Number(s)
          return isNaN(n)
            ? Result.err(new SchemaAST.ValidationIssue(ast, s, `Cannot convert "${s}" to a number`))
            : Result.ok(n)
        }
      ),
      {}
    ),
    {}
  )
)

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
export interface Struct<Fields extends Struct.Fields>
  extends Schema<Struct.Type<Fields>, Struct.Encoded<Fields>, Struct.Context<Fields>>
{
  annotate(annotations: Annotations<Simplify<Struct.Type<Fields>>>): this
  make(input: { readonly [K in keyof Fields]: Parameters<Fields[K]["make"]>[0] }): Simplify<Struct.Type<Fields>>
  readonly fields: Fields
  pick<Keys extends ReadonlyArray<keyof Fields>>(...keys: Keys): Struct<Pick<Fields, Keys[number]>>
  omit<Keys extends ReadonlyArray<keyof Fields>>(...keys: Keys): Struct<Omit<Fields, Keys[number]>>
}

class Struct$<Fields extends Struct.Fields>
  extends Schema$<Struct.Type<Fields>, Struct.Encoded<Fields>, Struct.Context<Fields>>
{
  readonly fields: Fields
  constructor(ast: SchemaAST.AST, fields: Fields) {
    super(ast)
    this.fields = { ...fields }
  }
  annotate(annotations: SchemaAST.Annotations): Struct<Fields> {
    return new Struct$(SchemaAST.annotate(this.ast, annotations), this.fields)
  }
  pick<Keys extends ReadonlyArray<keyof Fields>>(...keys: Keys): Struct<Pick<Fields, Keys[number]>> {
    return Struct(Struct_.pick(this.fields, ...keys) as any)
  }
  omit<Keys extends ReadonlyArray<keyof Fields>>(...keys: Keys): Struct<Omit<Fields, Keys[number]>> {
    return Struct(Struct_.omit(this.fields, ...keys) as any)
  }
}

/**
 * @since 4.0.0
 */
export function Struct<Fields extends Struct.Fields>(fields: Fields): Struct<Fields> {
  const ast = new SchemaAST.TypeLiteral(
    ownKeys(fields).map((key) => new SchemaAST.PropertySignature(key, fields[key].ast, false, true, {})),
    [],
    [],
    undefined,
    {}
  )
  return new Struct$(ast, fields)
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
  new Schema$(new SchemaAST.Suspend(() => f().ast, [], undefined, {}))

/**
 * @category api interface
 * @since 4.0.0
 */
export interface filter<S extends Schema.Any> extends Schema<Schema.Type<S>, Schema.Encoded<S>, Schema.Context<S>> {
  annotate(annotations: Annotations<Schema.Type<S>>): this
}

type FilterOutput = undefined | boolean | string | SchemaAST.Issue

function filterOutputToIssue(
  output: FilterOutput,
  input: unknown,
  ast: SchemaAST.AST
): SchemaAST.Issue | undefined {
  if (output === undefined) {
    return undefined
  }
  if (Predicate.isBoolean(output)) {
    return output ? undefined : new SchemaAST.ValidationIssue(ast, input)
  }
  if (Predicate.isString(output)) {
    return new SchemaAST.ValidationIssue(ast, input, output)
  }
  return output
}

/**
 * @category filtering
 * @since 4.0.0
 */
export const filter = <S extends Schema.Any>(
  filter: (type: Schema.Type<S>, self: SchemaAST.AST, options: SchemaAST.ParseOptions) => FilterOutput,
  annotations?: Annotations<Schema.Type<S>>
) =>
(self: S): filter<S> => {
  return new Schema$(SchemaAST.filter(self.ast, {
    filter: (input, ast, options) => filterOutputToIssue(filter(input, ast, options), input, ast),
    annotations: annotations ?? {}
  }))
}

/**
 * @category Length filters
 * @since 4.0.0
 */
export const minLength = <T extends { readonly length: number }>(
  minLength: number,
  annotations?: Annotations<T>
) => {
  minLength = Math.max(0, Math.floor(minLength))
  return <S extends Schema<T, any, any>>(self: S) =>
    self.pipe(
      filter(
        (input) => input.length >= minLength,
        {
          title: `minLength(${minLength})`,
          description: `a value with a length of at least ${minLength}`,
          ...annotations
        }
      )
    )
}

/**
 * @category Length filters
 * @since 4.0.0
 */
export const nonEmpty = minLength(1)

/**
 * @category Order filters
 * @since 4.0.0
 */
const makeGreaterThan = <A>(O: Order.Order<A>) => {
  const f = Order.greaterThan(O)
  return <T extends A>(
    exclusiveMinimum: A,
    annotations?: Annotations<T>
  ) => {
    return <S extends Schema<T, any, any>>(self: S) =>
      self.pipe(
        filter(
          f(exclusiveMinimum),
          {
            title: `greaterThan(${exclusiveMinimum})`,
            description: `a value greater than ${exclusiveMinimum}`,
            ...annotations
          }
        )
      )
  }
}

/**
 * @category Number filters
 * @since 4.0.0
 */
export const greaterThan = makeGreaterThan(Order.number)

/**
 * @category API interface
 * @since 4.0.0
 */
export interface transform<F extends Schema.Any, T extends Schema.Any>
  extends Schema<Schema.Type<T>, Schema.Encoded<F>, Schema.Context<F> | Schema.Context<T>>
{}

/**
 * @since 4.0.0
 */
export function transform<F extends Schema.Any, T extends Schema.Any>(from: F, to: T, transformations: {
  readonly decode: (input: Schema.Type<F>) => Schema.Encoded<T>
  readonly encode: (input: Schema.Encoded<T>) => Schema.Type<F>
}): transform<F, T> {
  return new Schema$(SchemaAST.transform(
    from.ast,
    to.ast,
    transformations.encode,
    transformations.decode
  ))
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export const trim = <S extends Schema<string, any, any>>(self: S) =>
  transform(
    self,
    typeSchema(self),
    {
      decode: (input) => input.trim(),
      encode: (input) => input
    }
  )
