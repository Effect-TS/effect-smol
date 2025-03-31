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
  readonly ast: SchemaAST.AST
  annotate(annotations: Annotations.Annotations): Schema<T, E, R>
  make(input: unknown): T
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
  export type Make<S extends Schema.Any> = Parameters<S["make"]>[0]
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
  annotate(annotations: Annotations.Annotations): Schema<T, E, R> {
    return new Schema$(SchemaAST.annotate(this.ast, annotations))
  }
  make(input: unknown): T {
    return SchemaParser.validateUnknownSync(this)(input)
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
export interface typeSchema<T, C = T> extends Schema<T> {
  make(input: C): T
}

/**
 * The `typeSchema` function allows you to extract the `Type` portion of a
 * schema, creating a new schema that conforms to the properties defined in the
 * original schema without considering the initial encoding or transformation
 * processes.
 *
 * @since 4.0.0
 */
export const typeSchema = <S extends Schema.Any>(schema: S): typeSchema<Schema.Type<S>, Schema.Make<S>> =>
  new Schema$(SchemaAST.typeAST(schema.ast))

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
export interface Literal<L extends SchemaAST.LiteralValue> extends typeSchema<L> {
  annotate(annotations: Annotations.Annotations): this
  make(input: L): L
}

/**
 * @since 4.0.0
 */
export const Literal = <L extends SchemaAST.LiteralValue>(literal: L): Literal<L> =>
  new Schema$(new SchemaAST.Literal(literal, [], [], {}))

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Never extends typeSchema<never> {
  annotate(annotations: Annotations.Annotations): this
}

/**
 * @since 4.0.0
 */
export const Never: Never = new Schema$(new SchemaAST.NeverKeyword([], [], {}))

/**
 * @category api interface
 * @since 4.0.0
 */
export interface String extends typeSchema<string> {
  annotate(annotations: Annotations.Annotations<string>): this
}

/**
 * @since 4.0.0
 */
export const String: String = new Schema$(
  new SchemaAST.StringKeyword([], [], {})
)

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Number extends typeSchema<number> {
  annotate(annotations: Annotations.Annotations<number>): this
}

/**
 * @since 4.0.0
 */
export const Number: Number = new Schema$(
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
export interface Struct<Fields extends Struct.Fields>
  extends Schema<Struct.Type<Fields>, Struct.Encoded<Fields>, Struct.Context<Fields>>
{
  annotate(annotations: Annotations.Annotations<Struct.Type<Fields>>): this
  make(input: { readonly [K in keyof Fields]: Schema.Make<Fields[K]> }): Struct.Type<Fields>
  readonly fields: Fields
  pick<Keys extends ReadonlyArray<keyof Fields>>(...keys: Keys): Struct<Pick<Fields, Keys[number]>>
  omit<Keys extends ReadonlyArray<keyof Fields>>(...keys: Keys): Struct<Omit<Fields, Keys[number]>>
  // extend<Fields2 extends Struct.Fields>(fields: Fields2): Struct<Fields & Fields2>
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
  annotate(annotations: Annotations.Annotations<Schema.Type<S>>): this
  make(input: Schema.Make<S> | undefined): Schema.Type<S> | undefined
  readonly "~isOptional": true
}

class optional$<S extends Schema.Any> extends Schema$<Schema.Type<S>, Schema.Encoded<S>, Schema.Context<S>> {
  readonly "~isOptional" = true
  annotate(annotations: SchemaAST.Annotations): optional<S> {
    return new optional$<S>(SchemaAST.annotate(this.ast, annotations))
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
  annotate(annotations: Annotations.Annotations<Tuple.Type<Elements>>): this
  make(input: { readonly [K in keyof Elements]: Schema.Make<Elements[K]> }): Tuple.Type<Elements>
  readonly elements: Elements
}

class Tuple$<Elements extends Tuple.Elements> extends Schema$<
  Tuple.Type<Elements>,
  Tuple.Encoded<Elements>,
  Tuple.Context<Elements>
> {
  readonly elements: Elements
  constructor(ast: SchemaAST.AST, elements: Elements) {
    super(ast)
    this.elements = { ...elements }
  }
  annotate(annotations: SchemaAST.Annotations): Tuple<Elements> {
    return new Tuple$(SchemaAST.annotate(this.ast, annotations), this.elements)
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
  annotate(annotations: Annotations.Annotations<ReadonlyArray<S>>): this
  make(input: ReadonlyArray<Schema.Make<S>>): ReadonlyArray<Schema.Type<S>>
  readonly item: S
}

class Array$<Item extends Schema.Any> extends Schema$<
  ReadonlyArray<Schema.Type<Item>>,
  ReadonlyArray<Schema.Encoded<Item>>,
  Schema.Context<Item>
> {
  readonly item: Item
  constructor(ast: SchemaAST.AST, item: Item) {
    super(ast)
    this.item = item
  }
  annotate(annotations: SchemaAST.Annotations): Array<Item> {
    return new Array$(SchemaAST.annotate(this.ast, annotations), this.item)
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
export interface brand<S extends Schema.Any, B extends string | symbol>
  extends Schema<Schema.Type<S> & Brand<B>, Schema.Encoded<S>, Schema.Context<S>>
{
  annotate(annotations: Annotations.Annotations<Schema.Type<S> & Brand<B>>): this
  make(input: Schema.Type<S>): Schema.Type<S> & Brand<B>
  readonly schema: S
  readonly brand: B
}

class brand$<S extends Schema.Any, B extends string | symbol>
  extends Schema$<Schema.Type<S> & Brand<B>, Schema.Encoded<S>, Schema.Context<S>>
{
  constructor(ast: SchemaAST.AST, readonly schema: S, readonly brand: B) {
    super(ast)
  }
  annotate(annotations: SchemaAST.Annotations): brand<S, B> {
    return new brand$<S, B>(SchemaAST.annotate(this.ast, annotations), this.schema, this.brand)
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
  annotate(annotations: Annotations.Annotations<T>): this
}

/**
 * @category constructors
 * @since 4.0.0
 */
export const suspend = <T, E = T, R = never>(f: () => Schema<T, E, R>): suspend<T, E, R> =>
  new Schema$(new SchemaAST.Suspend(() => f().ast, [], [], {}))

/**
 * @category api interface
 * @since 4.0.0
 */
export interface filter<S extends Schema.Any> extends Schema<Schema.Type<S>, Schema.Encoded<S>, Schema.Context<S>> {
  annotate(annotations: Annotations.Annotations<Schema.Type<S>>): this
  make(input: Schema.Make<S>): Schema.Type<S>
}

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
(self: S): filter<S> => {
  return new Schema$(SchemaAST.filter(
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
  return new Schema$(SchemaAST.transform(
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
  new Schema$(SchemaAST.transformOrFail(
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
  new(props: Schema.Make<S>): Schema.Type<S>
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
    let astMemo: SchemaAST.AST | undefined = undefined
    return class extends base {
      static Type: Schema.Type<S>
      static Encoded: Schema.Encoded<S>
      static Context: Schema.Context<S>

      static readonly identifier = identifier
      static readonly schema = schema

      static [TypeId] = variance
      static get ast() {
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
      static annotate(annotations: Annotations.Annotations): Schema<Self, Schema.Encoded<S>, Schema.Context<S>> {
        return new Schema$(SchemaAST.annotate(this.ast, annotations))
      }
      static make(input: Schema.Make<S>): Self {
        return new this(input) as any
      }
      static toString() {
        return `${this.ast}`
      }
    }
  }
