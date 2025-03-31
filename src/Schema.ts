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
 * @since 4.0.0
 */
export declare namespace Annotations {
  /**
   * @category model
   * @since 4.0.0
   */
  export interface Documentation extends SchemaAST.Annotations {
    readonly title?: string
    readonly description?: string
    readonly documentation?: string
  }
  /**
   * @category model
   * @since 4.0.0
   */
  export interface Annotations<T = any> extends Documentation {
    readonly default?: T
    readonly examples?: ReadonlyArray<T>
    readonly arbitrary?: (fc: typeof FastCheck) => FastCheck.Arbitrary<T>
    readonly equivalence?: Equivalence<T>
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export interface Schema<out T, out E = T, out R = never> extends Schema.Variance<T, E, R>, Pipeable {
  readonly Type: T
  readonly Encoded: E
  readonly Context: R

  readonly "~clone-out": Schema<T, E, R>
  readonly "~annotate-in": SchemaAST.Annotations
  readonly "~make-in": unknown
  readonly ast: SchemaAST.AST

  clone(ast: this["ast"]): this["~clone-out"]
  annotate(annotations: this["~annotate-in"]): this["~clone-out"]
  make(input: this["~make-in"]): T
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
  export type MakeIn<S extends Schema.Any> = S["~make-in"]
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

abstract class Schema$<
  Ast extends SchemaAST.AST,
  T,
  E,
  R,
  CloneOut extends Schema<T, E, R>,
  AnnotateIn extends SchemaAST.Annotations,
  MakeIn
> implements Schema<T, E, R> {
  [TypeId] = variance
  readonly Type!: T
  readonly Encoded!: E
  readonly Context!: R
  readonly "~clone-out": CloneOut
  readonly "~annotate-in": AnnotateIn
  readonly "~make-in": MakeIn
  constructor(readonly ast: Ast) {}
  abstract clone(ast: this["ast"]): this["~clone-out"]
  pipe() {
    return pipeArguments(this, arguments)
  }
  make(input: this["~make-in"]): T {
    return SchemaParser.validateUnknownSync(this)(input)
  }
  annotate(annotations: this["~annotate-in"]): this["~clone-out"] {
    const ast = SchemaAST.annotate(this.ast, annotations)
    return this.clone(ast)
  }
  toString() {
    return `${this.ast}`
  }
}

class DefaultSchema$<T, E, R, MakeIn> extends Schema$<
  SchemaAST.AST,
  T,
  E,
  R,
  DefaultSchema$<T, E, R, MakeIn>,
  SchemaAST.Annotations,
  MakeIn
> {
  clone(ast: this["ast"]): this["~clone-out"] {
    return new DefaultSchema$(ast)
  }
}

/**
 * Tests if a value is a `Schema`.
 *
 * @category guards
 * @since 4.0.0
 */
export const isSchema = (u: unknown): u is Schema.Any =>
  Predicate.hasProperty(u, TypeId) && Predicate.isObject(u[TypeId])

/**
 * @category api interface
 * @since 4.0.0
 */
export interface typeSchema<T, MakeIn = T> extends Schema<T> {
  readonly "~clone-out": typeSchema<T, MakeIn>
  readonly "~make-in": MakeIn
}

/**
 * @since 4.0.0
 */
export const typeSchema = <S extends Schema.Any>(schema: S): typeSchema<Schema.Type<S>, Schema.MakeIn<S>> =>
  new DefaultSchema$(SchemaAST.typeAST(schema.ast))

/**
 * @since 4.0.0
 */
// export function asSchema<T, E, R, Fields extends Struct.Fields>(
//   schema: Schema<T, E, R> & Struct<Fields>
// ): Schema<T, Simplify<E>, R>
// export function asSchema<T, E, R>(schema: Schema<T, E, R>): Schema<T, E, R>
// export function asSchema<S extends Schema.Any>(
//   schema: S
// ): Schema<Schema.Type<S>, Schema.Encoded<S>, Schema.Context<S>> {
//   return schema
// }
export function asSchema<T, E, R>(schema: Schema<T, E, R>): Schema<T, E, R> {
  return schema
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Literal<L extends SchemaAST.LiteralValue> extends typeSchema<L> {}

/**
 * @since 4.0.0
 */
export const Literal = <L extends SchemaAST.LiteralValue>(literal: L): Literal<L> =>
  new DefaultSchema$(new SchemaAST.Literal(literal, [], [], {}))

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Never extends typeSchema<never> {}

/**
 * @since 4.0.0
 */
export const Never: Never = new DefaultSchema$(new SchemaAST.NeverKeyword([], [], {}))

/**
 * @category api interface
 * @since 4.0.0
 */
export interface String extends typeSchema<string> {}

/**
 * @since 4.0.0
 */
export const String: String = new DefaultSchema$(
  new SchemaAST.StringKeyword([], [], {})
)

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Number extends typeSchema<number> {}

/**
 * @since 4.0.0
 */
export const Number: Number = new DefaultSchema$(
  new SchemaAST.NumberKeyword([], [], {})
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

  type TypeOptionalKeys<Fields extends Struct.Fields> = {
    [K in keyof Fields]: Fields[K] extends optional<any> ? K
      : never
  }[keyof Fields]

  type Type_<
    F extends Fields,
    O = TypeOptionalKeys<F>
  > =
    & { readonly [K in keyof F as K extends O ? never : K]: Schema.Type<F[K]> }
    & { readonly [K in keyof F as K extends O ? K : never]?: Schema.Type<F[K]> }

  /**
   * @since 4.0.0
   */
  export type Type<F extends Fields> = Simplify<Type_<F>>

  type EncodedOptionalKeys<Fields extends Struct.Fields> = {
    [K in keyof Fields]: Fields[K] extends optional<any> ? K
      : never
  }[keyof Fields]

  type Encoded_<
    F extends Fields,
    O = EncodedOptionalKeys<F>
  > =
    & { readonly [K in keyof F as K extends O ? never : K]: Schema.Encoded<F[K]> }
    & { readonly [K in keyof F as K extends O ? K : never]?: Schema.Encoded<F[K]> }

  /**
   * @since 4.0.0
   */
  export type Encoded<F extends Fields> = Simplify<Encoded_<F>>
  /**
   * @since 4.0.0
   */
  export type Context<F extends Fields> = { readonly [K in keyof F]: Schema.Context<F[K]> }[keyof F]
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Struct<Fields extends Struct.Fields> extends
  Schema<
    Struct.Type<Fields>,
    Struct.Encoded<Fields>,
    Struct.Context<Fields>
  >
{
  readonly "~clone-out": Struct<Fields>
  readonly "~annotate-in": SchemaAST.Annotations
  readonly "~make-in": { readonly [K in keyof Fields]: Schema.MakeIn<Fields[K]> }
  readonly ast: SchemaAST.TypeLiteral
  readonly fields: Fields
  pick<Keys extends ReadonlyArray<keyof Fields>>(...keys: Keys): Struct<Pick<Fields, Keys[number]>>
  omit<Keys extends ReadonlyArray<keyof Fields>>(...keys: Keys): Struct<Omit<Fields, Keys[number]>>
  // extend<Fields2 extends Struct.Fields>(fields: Fields2): Struct<Fields & Fields2>
}

class Struct$<Fields extends Struct.Fields> extends Schema$<
  SchemaAST.TypeLiteral,
  Struct.Type<Fields>,
  Struct.Encoded<Fields>,
  Struct.Context<Fields>,
  Struct<Fields>,
  Annotations.Annotations,
  { readonly [K in keyof Fields]: Schema.MakeIn<Fields[K]> }
> {
  readonly fields: Fields
  constructor(ast: SchemaAST.TypeLiteral, fields: Fields) {
    super(ast)
    this.fields = { ...fields }
  }
  clone(ast: this["ast"]): this["~clone-out"] {
    return new Struct$(ast, this.fields)
  }
  pick<Keys extends ReadonlyArray<keyof Fields>>(...keys: Keys): Struct<Pick<Fields, Keys[number]>> {
    return Struct(Struct_.pick(this.fields, ...keys) as any)
  }
  omit<Keys extends ReadonlyArray<keyof Fields>>(...keys: Keys): Struct<Omit<Fields, Keys[number]>> {
    return Struct(Struct_.omit(this.fields, ...keys) as any)
  }
  // extend<Fields2 extends Struct.Fields>(fields: Fields2): Struct<Fields & Fields2> {
  //   return Struct({ ...this.fields, ...fields })
  // }
}

/**
 * @since 4.0.0
 */
export function Struct<Fields extends Struct.Fields>(fields: Fields): Struct<Fields> {
  const ast = new SchemaAST.TypeLiteral(
    ownKeys(fields).map((key) => {
      const field: any = fields[key]
      return new SchemaAST.PropertySignature(key, field.ast, field["~isOptional"] === true, true, {})
    }),
    [],
    [],
    [],
    {}
  )
  return new Struct$(ast, fields)
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface optional<S extends Schema.Any> extends
  Schema<
    Schema.Type<S> | undefined,
    Schema.Encoded<S> | undefined,
    Schema.Context<S>
  >
{
  readonly "~clone-out": optional<S>
  readonly "~annotate-in": SchemaAST.Annotations
  readonly "~make-in": Schema.MakeIn<S> | undefined
  readonly "~isOptional": true
}

class optional$<S extends Schema.Any> extends Schema$<
  SchemaAST.AST,
  Schema.Type<S>,
  Schema.Encoded<S>,
  Schema.Context<S>,
  optional<S>,
  Annotations.Annotations,
  Schema.MakeIn<S> | undefined
> {
  readonly "~isOptional" = true
  clone(ast: this["ast"]): this["~clone-out"] {
    return new optional$<S>(ast)
  }
}

/**
 * @since 4.0.0
 */
export const optional = <S extends Schema.Any>(schema: S): optional<S> => new optional$<S>(schema.ast)

/**
 * @since 4.0.0
 */
export declare namespace Tuple {
  /**
   * @since 4.0.0
   */
  export type Element = Schema.Any
  /**
   * @since 4.0.0
   */
  export type Elements = ReadonlyArray<Element>
  /**
   * @since 4.0.0
   */
  export type Type<E extends Elements> = { readonly [K in keyof E]: Schema.Type<E[K]> }
  /**
   * @since 4.0.0
   */
  export type Encoded<E extends Elements> = { readonly [K in keyof E]: Schema.Encoded<E[K]> }
  /**
   * @since 4.0.0
   */
  export type Context<E extends Elements> = Schema.Context<E[number]>
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Tuple<Elements extends Tuple.Elements> extends
  Schema<
    Tuple.Type<Elements>,
    Tuple.Encoded<Elements>,
    Tuple.Context<Elements>
  >
{
  readonly "~clone-out": Tuple<Elements>
  readonly "~annotate-in": SchemaAST.Annotations
  readonly "~make-in": { readonly [K in keyof Elements]: Schema.MakeIn<Elements[K]> }
  readonly ast: SchemaAST.TupleType
  readonly elements: Elements
}

class Tuple$<Elements extends Tuple.Elements> extends Schema$<
  SchemaAST.TupleType,
  Tuple.Type<Elements>,
  Tuple.Encoded<Elements>,
  Tuple.Context<Elements>,
  Tuple<Elements>,
  Annotations.Annotations,
  { readonly [K in keyof Elements]: Schema.MakeIn<Elements[K]> }
> {
  readonly elements: Elements
  constructor(ast: SchemaAST.TupleType, elements: Elements) {
    super(ast)
    this.elements = { ...elements }
  }
  clone(ast: this["ast"]): this["~clone-out"] {
    return new Tuple$(ast, this.elements)
  }
}

/**
 * @since 4.0.0
 */
export function Tuple<Elements extends ReadonlyArray<Schema.Any>>(...elements: Elements): Tuple<Elements> {
  return new Tuple$(new SchemaAST.TupleType(elements.map((element) => element.ast), [], [], [], {}), elements)
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Array<S extends Schema.Any> extends
  Schema<
    ReadonlyArray<Schema.Type<S>>,
    ReadonlyArray<Schema.Encoded<S>>,
    Schema.Context<S>
  >
{
  readonly "~clone-out": Array<S>
  readonly "~annotate-in": SchemaAST.Annotations
  readonly "~make-in": ReadonlyArray<Schema.MakeIn<S>>
  readonly ast: SchemaAST.TupleType
  readonly item: S
}

class Array$<S extends Schema.Any> extends Schema$<
  SchemaAST.TupleType,
  ReadonlyArray<Schema.Type<S>>,
  ReadonlyArray<Schema.Encoded<S>>,
  Schema.Context<S>,
  Array<S>,
  Annotations.Annotations,
  ReadonlyArray<Schema.MakeIn<S>>
> {
  readonly item: S
  constructor(ast: SchemaAST.TupleType, item: S) {
    super(ast)
    this.item = item
  }
  clone(ast: this["ast"]): this["~clone-out"] {
    return new Array$(ast, this.item)
  }
}

/**
 * @since 4.0.0
 */
export function Array<Item extends Schema.Any>(item: Item): Array<Item> {
  return new Array$(new SchemaAST.TupleType([], [item.ast], [], [], {}), item)
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface brand<S extends Schema.Any, B extends string | symbol> extends
  Schema$<
    SchemaAST.AST,
    Schema.Type<S> & Brand<B>,
    Schema.Encoded<S>,
    Schema.Context<S>,
    brand<S, B>,
    Annotations.Annotations,
    Schema.MakeIn<S>
  >
{
  readonly schema: S
  readonly brand: B
}

class brand$<S extends Schema.Any, B extends string | symbol> extends Schema$<
  SchemaAST.AST,
  Schema.Type<S> & Brand<B>,
  Schema.Encoded<S>,
  Schema.Context<S>,
  brand<S, B>,
  Annotations.Annotations,
  Schema.MakeIn<S>
> {
  constructor(ast: SchemaAST.AST, readonly schema: S, readonly brand: B) {
    super(ast)
  }
  clone(ast: this["ast"]): this["~clone-out"] {
    return new brand$<S, B>(ast, this.schema, this.brand)
  }
}

/**
 * @since 4.0.0
 */
export const brand = <B extends string | symbol>(brand: B) => <Self extends Schema.Any>(self: Self): brand<Self, B> => {
  return new brand$<Self, B>(self.ast, self, brand)
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface suspend<T, E, R> extends Schema<T, E, R> {
  readonly "~clone-out": suspend<T, E, R>
}

/**
 * @category constructors
 * @since 4.0.0
 */
export const suspend = <T, E = T, R = never>(f: () => Schema<T, E, R>): suspend<T, E, R> =>
  new DefaultSchema$(new SchemaAST.Suspend(() => f().ast, [], [], {}))

type FilterOutput = undefined | boolean | string | SchemaAST.Issue

function filterOutputToIssue(
  output: FilterOutput,
  input: unknown
): SchemaAST.Issue | undefined {
  if (output === undefined) {
    return undefined
  }
  if (Predicate.isBoolean(output)) {
    return output ? undefined : new SchemaAST.InvalidIssue(input)
  }
  if (Predicate.isString(output)) {
    return new SchemaAST.InvalidIssue(input, output)
  }
  return output
}

/**
 * @category filtering
 * @since 4.0.0
 */
export const filter = <S extends Schema.Any>(
  filter: (type: Schema.Type<S>, options: SchemaAST.ParseOptions) => FilterOutput,
  annotations?: Annotations.Annotations<Schema.Type<S>>
) =>
(self: S): S["~clone-out"] => {
  return self.clone(SchemaAST.filter(
    self.ast,
    new SchemaAST.Refinement(
      (input, options) => filterOutputToIssue(filter(input, options), input),
      annotations ?? {}
    )
  ))
}

/**
 * @category Length filters
 * @since 4.0.0
 */
export const minLength = <T extends { readonly length: number }>(
  minLength: number,
  annotations?: Annotations.Annotations<T>
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
    annotations?: Annotations.Annotations<T>
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
}, annotations?: Annotations.Documentation): transform<F, T> {
  return new DefaultSchema$(SchemaAST.transform(
    from.ast,
    to.ast,
    transformations.decode,
    transformations.encode,
    annotations ?? {}
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
    },
    {
      title: "trim"
    }
  )

/**
 * @category String transformations
 * @since 4.0.0
 */
export const Trim = trim(String)

/**
 * @category String transformations
 * @since 4.0.0
 */
export const parseNumber = <S extends Schema<string, any, any>>(
  self: S
): Schema<number, Schema.Encoded<S>, Schema.Context<S>> =>
  new DefaultSchema$(SchemaAST.transformOrFail(
    self.ast,
    Number.ast,
    (s) => {
      const n = globalThis.Number(s)
      return isNaN(n)
        ? Result.err(new SchemaAST.InvalidIssue(s, `Cannot convert "${s}" to a number`))
        : Result.ok(n)
    },
    (n) => Result.ok(globalThis.String(n)),
    {
      title: "parseNumber"
    }
  ))

/**
 * @category String transformations
 * @since 4.0.0
 */
export const NumberFromString = parseNumber(String)

/**
 * @category api interface
 * @since 3.10.0
 */
export interface Class<Self, S extends Schema.Any> extends Schema<Self, Schema.Encoded<S>, Schema.Context<S>> {
  readonly "~clone-out": Schema<Schema.Type<S>, Schema.Encoded<S>, Schema.Context<S>>
  readonly "~annotate-in": SchemaAST.Annotations
  readonly "~make-in": Schema.MakeIn<S>
  readonly ast: SchemaAST.TypeLiteral
  new(props: Schema.MakeIn<S>): Schema.Type<S>
  readonly identifier: string
  readonly schema: S
}

type ClassOptions = {}

/**
 * @category model
 * @since 4.0.0
 */
export const Class =
  <Self = never>(identifier: string) =>
  <S extends Schema.Any>(schema: S, annotations?: Annotations.Annotations): Class<Self, S> => {
    const ast = schema.ast
    if (ast._tag !== "TypeLiteral") {
      throw new Error("schema must be a TypeLiteral")
    }
    const ctor = ast.refinements.findLast((r) => r._tag === "Constructor")
    const base = ctor ?
      class extends ctor.ctor {} :
      // eslint-disable-next-line @typescript-eslint/no-extraneous-class
      class {
        constructor(props: unknown, _options?: ClassOptions) {
          Object.assign(this, props)
        }
      }
    let astMemo: SchemaAST.TypeLiteral | undefined = undefined
    return class extends base {
      static readonly Type: Schema.Type<S>
      static readonly Encoded: Schema.Encoded<S>
      static readonly Context: Schema.Context<S>
      static readonly "~clone-out": Schema<Schema.Type<S>, Schema.Encoded<S>, Schema.Context<S>>
      static readonly "~annotate-in": SchemaAST.Annotations
      static readonly "~make-in": Schema.MakeIn<S>

      static readonly identifier = identifier
      static readonly schema = schema

      static readonly [TypeId] = variance
      static get ast(): SchemaAST.TypeLiteral {
        if (astMemo === undefined) {
          astMemo = SchemaAST.construct(
            ast,
            new SchemaAST.Constructor(this, this.identifier, annotations ?? {})
          )
        }
        return astMemo
      }
      static pipe() {
        return pipeArguments(this, arguments)
      }
      static clone(ast: SchemaAST.AST): Schema<Schema.Type<S>, Schema.Encoded<S>, Schema.Context<S>> {
        return new DefaultSchema$(ast)
      }
      static annotate(
        annotations: Annotations.Annotations
      ): Schema<Schema.Type<S>, Schema.Encoded<S>, Schema.Context<S>> {
        return new DefaultSchema$(SchemaAST.annotate(this.ast, annotations))
      }
      static make(input: Schema.MakeIn<S>): Self {
        return new this(input) as any
      }
      // static filter(refinement: SchemaAST.Refinement): Schema<Self, Schema.Encoded<S>, Schema.Context<S>> {
      //   return new Schema$(SchemaAST.filter(this.ast, refinement))
      // }
      static toString() {
        return `${this.ast}`
      }
    }
  }
