/**
 * @since 4.0.0
 */

import type { Brand } from "./Brand.js"
import type { Equivalence } from "./Equivalence.js"
import type * as FastCheck from "./FastCheck.js"
import { ownKeys } from "./internal/schema/util.js"
import * as Option from "./Option.js"
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

interface DefaultSchemaContext {
  readonly _tag: "DefaultSchemaContext"
}

type SchemaContext = DefaultSchemaContext | PropertySignatureContext

const defaultSchemaContext: SchemaContext = {
  _tag: "DefaultSchemaContext"
}

/**
 * @category model
 * @since 4.0.0
 */
export interface Schema<out T, out E = T, out R = never> extends Schema.Variance<T, E, R>, Pipeable {
  readonly Type: T
  readonly Encoded: E
  readonly Context: R

  readonly "~clone.out": Schema<T, E, R>
  readonly "~annotate.in": SchemaAST.Annotations
  readonly "~make.in": unknown
  readonly ast: SchemaAST.AST
  readonly context: SchemaContext

  clone(ast: this["ast"], context: SchemaContext): this["~clone.out"]
  annotate(annotations: this["~annotate.in"]): this["~clone.out"]
  make(input: this["~make.in"]): T
}

/**
 * @since 4.0.0
 */
export declare namespace Schema {
  /**
   * @since 4.0.0
   */
  export interface Variance<T, E, R> {
    readonly "effect/Schema": {
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
  export type MakeIn<S extends Schema.Any> = S["~make.in"]
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

/**
 * @since 4.0.0
 */
export abstract class Schema$<
  Ast extends SchemaAST.AST,
  T,
  E,
  R,
  CloneOut extends Schema<T, E, R>,
  AnnotateIn extends SchemaAST.Annotations,
  MakeIn,
  Ctx extends SchemaContext
> implements Schema<T, E, R> {
  "effect/Schema" = variance
  readonly Type!: T
  readonly Encoded!: E
  readonly Context!: R
  readonly "~clone.out": CloneOut
  readonly "~annotate.in": AnnotateIn
  readonly "~make.in": MakeIn
  constructor(readonly ast: Ast, readonly context: Ctx) {}
  abstract clone(ast: this["ast"], context: SchemaContext): this["~clone.out"]
  #make?: (u: unknown, overrideOptions?: SchemaAST.ParseOptions) => T = undefined
  pipe() {
    return pipeArguments(this, arguments)
  }
  make(input: this["~make.in"]): T {
    if (this.#make === undefined) {
      this.#make = SchemaParser.validateUnknownSync(this)
    }
    return this.#make(input)
  }
  annotate(annotations: this["~annotate.in"]): this["~clone.out"] {
    const ast = SchemaAST.annotate(this.ast, annotations)
    return this.clone(ast, this.context)
  }
  toString() {
    return `${this.ast}`
  }
}

class make$<T, E, R, MakeIn> extends Schema$<
  SchemaAST.AST,
  T,
  E,
  R,
  make$<T, E, R, MakeIn>,
  SchemaAST.Annotations,
  MakeIn,
  SchemaContext
> {
  clone(ast: this["ast"], context: SchemaContext): this["~clone.out"] {
    return new make$(ast, context)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export interface make<T, E, R, MakeIn> extends Schema<T, E, R> {
  readonly "~clone.out": make<T, E, R, MakeIn>
  readonly "~make.in": MakeIn
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export const make = <T, E, R, MakeIn>(ast: SchemaAST.AST): make<T, E, R, MakeIn> =>
  new make$<T, E, R, MakeIn>(ast, defaultSchemaContext)

/**
 * Tests if a value is a `Schema`.
 *
 * @category guards
 * @since 4.0.0
 */
export const isSchema = (u: unknown): u is Schema.Any =>
  Predicate.hasProperty(u, "effect/Schema") && Predicate.isObject(u["effect/Schema"])

type OptionalToken = ":" | ":?"
type ReadonlyToken = "readonly" | ""
type DefaultToken = "no-default" | "has-default"

interface PropertySignatureContext {
  readonly _tag: "PropertySignatureContext"
  readonly "~ps.type.isReadonly": boolean
  readonly "~ps.type.isOptional": boolean
  readonly "~ps.encoded.isReadonly": boolean
  readonly "~ps.encoded.key": Option.Option<PropertyKey>
  readonly "~ps.encoded.isOptional": boolean
  readonly "~ps.default": Option.Option<unknown>
}

const defaultPropertySignatureContext: PropertySignatureContext = {
  _tag: "PropertySignatureContext",
  "~ps.type.isReadonly": true,
  "~ps.type.isOptional": false,
  "~ps.encoded.isReadonly": true,
  "~ps.encoded.key": Option.none(),
  "~ps.encoded.isOptional": false,
  "~ps.default": Option.none()
}

/**
 * @category model
 * @since 4.0.0
 */
export interface PropertySignature<
  TypeReadonly extends ReadonlyToken,
  TypeIsOptional extends OptionalToken,
  S extends Schema.Any,
  EncodedIsReadonly extends ReadonlyToken,
  EncodedKey extends PropertyKey,
  EncodedIsOptional extends OptionalToken,
  EncodedEncoded,
  Default extends DefaultToken
> extends Schema<Schema.Type<S>, EncodedEncoded, Schema.Context<S>> {
  readonly "~clone.out": PropertySignature<
    TypeReadonly,
    TypeIsOptional,
    S["~clone.out"],
    EncodedIsReadonly,
    EncodedKey,
    EncodedIsOptional,
    EncodedEncoded,
    Default
  >
  readonly "~annotate.in": SchemaAST.Annotations
  readonly "~make.in": Schema.MakeIn<S>

  readonly "~ps.type.isReadonly": TypeReadonly
  readonly "~ps.type.isOptional": TypeIsOptional
  readonly "~ps.encoded.isReadonly": EncodedIsReadonly
  readonly "~ps.encoded.key": EncodedKey
  readonly "~ps.encoded.isOptional": EncodedIsOptional
  readonly "~ps.encoded.encoded": EncodedEncoded
  readonly "~ps.default": Default

  readonly schema: S
}

/**
 * @since 4.0.0
 */
export const asPropertySignature = <
  TypeReadonly extends ReadonlyToken,
  TypeIsOptional extends OptionalToken,
  S extends Schema.Any,
  EncodedIsReadonly extends ReadonlyToken,
  EncodedKey extends PropertyKey,
  EncodedIsOptional extends OptionalToken,
  EncodedEncoded,
  Default extends DefaultToken
>(
  ps: PropertySignature<
    TypeReadonly,
    TypeIsOptional,
    S,
    EncodedIsReadonly,
    EncodedKey,
    EncodedIsOptional,
    EncodedEncoded,
    Default
  >
): PropertySignature<
  TypeReadonly,
  TypeIsOptional,
  S,
  EncodedIsReadonly,
  EncodedKey,
  EncodedIsOptional,
  EncodedEncoded,
  Default
> => ps

class propertySignature$<
  S extends Schema.Any,
  TypeReadonly extends ReadonlyToken,
  TypeIsOptional extends OptionalToken,
  EncodedIsReadonly extends ReadonlyToken,
  EncodedKey extends PropertyKey,
  EncodedIsOptional extends OptionalToken,
  EncodedEncoded,
  Default extends DefaultToken
> extends Schema$<
  SchemaAST.AST,
  S,
  Schema.Encoded<S>,
  Schema.Context<S>,
  PropertySignature<
    TypeReadonly,
    TypeIsOptional,
    S["~clone.out"],
    EncodedIsReadonly,
    EncodedKey,
    EncodedIsOptional,
    EncodedEncoded,
    Default
  >,
  Annotations.Annotations,
  Schema.MakeIn<S>,
  PropertySignatureContext
> {
  readonly "~ps.type.isReadonly": TypeReadonly
  readonly "~ps.type.isOptional": TypeIsOptional
  readonly "~ps.encoded.isReadonly": EncodedIsReadonly
  readonly "~ps.encoded.key": EncodedKey
  readonly "~ps.encoded.isOptional": EncodedIsOptional
  readonly "~ps.encoded.encoded": EncodedEncoded
  readonly "~ps.default": Default
  constructor(readonly schema: S, readonly context: PropertySignatureContext) {
    super(schema.ast, context)
  }
  clone(ast: this["ast"], context: SchemaContext): this["~clone.out"] {
    return new propertySignature$(this.schema.clone(ast, context), this.context)
  }
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface propertySignature<S extends Schema.Any>
  extends PropertySignature<"readonly", ":", S, "readonly", never, ":", Schema.Encoded<S>, "no-default">
{}

/**
 * @since 4.0.0
 */
export const propertySignature = <S extends Schema.Any>(schema: S): propertySignature<S> => {
  return new propertySignature$(schema, defaultPropertySignatureContext)
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface optional<S extends Schema.Any>
  extends PropertySignature<"readonly", ":?", S, "readonly", never, ":?", Schema.Encoded<S>, "no-default">
{}

/**
 * @since 4.0.0
 */
export function optional<S extends Schema.Any>(schema: S): optional<S> {
  return new propertySignature$(
    schema,
    {
      ...defaultPropertySignatureContext,
      "~ps.type.isOptional": true,
      "~ps.encoded.isOptional": true
    }
  )
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface mutable<S extends Schema.Any>
  extends PropertySignature<"", ":", S, "", never, ":", Schema.Encoded<S>, "no-default">
{}

/**
 * @since 4.0.0
 */
export function mutable<S extends Schema.Any>(schema: S): mutable<S> {
  return new propertySignature$(
    schema,
    {
      ...defaultPropertySignatureContext,
      "~ps.type.isReadonly": false,
      "~ps.encoded.isReadonly": false
    }
  )
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface typeSchema<T, MakeIn = T> extends Schema<T> {
  readonly "~clone.out": typeSchema<T, MakeIn>
  readonly "~make.in": MakeIn
}

/**
 * @since 4.0.0
 */
export const typeSchema = <S extends Schema.Any>(schema: S): typeSchema<Schema.Type<S>, Schema.MakeIn<S>> =>
  make(SchemaAST.typeAST(schema.ast))

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
export interface Literal<L extends SchemaAST.LiteralValue> extends typeSchema<L> {}

/**
 * @since 4.0.0
 */
export const Literal = <L extends SchemaAST.LiteralValue>(literal: L): Literal<L> =>
  make(new SchemaAST.Literal(literal, {}, [], []))

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Never extends typeSchema<never> {}

/**
 * @since 4.0.0
 */
export const Never: Never = make(SchemaAST.neverKeyword)

/**
 * @category api interface
 * @since 4.0.0
 */
export interface String extends typeSchema<string> {}

/**
 * @since 4.0.0
 */
export const String: String = make(SchemaAST.stringKeyword)

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Number extends typeSchema<number> {}

/**
 * @since 4.0.0
 */
export const Number: Number = make(SchemaAST.numberKeyword)

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
    [K in keyof Fields]: Fields[K] extends { readonly "~ps.type.isOptional": ":?" } ? K
      : never
  }[keyof Fields]

  type TypeMutableKeys<Fields extends Struct.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~ps.type.isReadonly": "" } ? K
      : never
  }[keyof Fields]

  type Type_<
    F extends Fields,
    O extends keyof F = TypeOptionalKeys<F>,
    M extends keyof F = TypeMutableKeys<F>
  > =
    & { readonly [K in Exclude<keyof F, M | O>]: Schema.Type<F[K]> }
    & { readonly [K in Exclude<O, M>]?: Schema.Type<F[K]> }
    & { [K in Exclude<M, O>]: Schema.Type<F[K]> }
    & { [K in M & O]?: Schema.Type<F[K]> }

  /**
   * @since 4.0.0
   */
  export type Type<F extends Fields> = Simplify<Type_<F>>

  type EncodedOptionalKeys<Fields extends Struct.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~ps.encoded.isOptional": ":?" } ? K
      : never
  }[keyof Fields]

  type EncodedMutableKeys<Fields extends Struct.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~ps.encoded.isReadonly": "" } ? K
      : never
  }[keyof Fields]

  type Encoded_<
    F extends Fields,
    O extends keyof F = EncodedOptionalKeys<F>,
    M extends keyof F = EncodedMutableKeys<F>
  > =
    & { readonly [K in Exclude<keyof F, M | O>]: F[K]["Encoded"] }
    & { readonly [K in Exclude<O, M>]?: F[K]["Encoded"] }
    & { [K in Exclude<M, O>]: F[K]["Encoded"] }
    & { [K in M & O]?: F[K]["Encoded"] }

  /**
   * @since 4.0.0
   */
  export type Encoded<F extends Fields> = Simplify<Encoded_<F>>
  /**
   * @since 4.0.0
   */
  export type Ctx<F extends Fields> = { readonly [K in keyof F]: Schema.Context<F[K]> }[keyof F]

  type MakeIn_<
    F extends Fields,
    O = TypeOptionalKeys<F>
  > =
    & { readonly [K in keyof F as K extends O ? never : K]: Schema.MakeIn<F[K]> }
    & { readonly [K in keyof F as K extends O ? K : never]?: Schema.MakeIn<F[K]> }
  /**
   * @since 4.0.0
   */
  export type MakeIn<F extends Fields> = Simplify<MakeIn_<F>>
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Struct<Fields extends Struct.Fields> extends
  Schema<
    Struct.Type<Fields>,
    Struct.Encoded<Fields>,
    Struct.Ctx<Fields>
  >
{
  readonly "~clone.out": Struct<Fields>
  readonly "~make.in": Struct.MakeIn<Fields>
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
  Struct.Ctx<Fields>,
  Struct<Fields>,
  Annotations.Annotations,
  Struct.MakeIn<Fields>,
  SchemaContext
> implements Struct<Fields> {
  readonly fields: Fields
  constructor(ast: SchemaAST.TypeLiteral, context: SchemaContext, fields: Fields) {
    super(ast, context)
    this.fields = { ...fields }
  }
  clone(ast: this["ast"], context: SchemaContext): this["~clone.out"] {
    return new Struct$(ast, context, this.fields)
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
export function Struct<const Fields extends Struct.Fields>(fields: Fields): Struct<Fields> {
  const ast = new SchemaAST.TypeLiteral(
    ownKeys(fields).map((key) => {
      const field = fields[key]
      let isOptional = false
      let isReadonly = true
      if (field.context._tag === "PropertySignatureContext") {
        isOptional = field.context["~ps.type.isOptional"]
        isReadonly = field.context["~ps.type.isReadonly"]
      }
      return new SchemaAST.PropertySignature(key, field.ast, isOptional, isReadonly, {})
    }),
    [],
    {},
    [],
    []
  )
  return new Struct$(ast, defaultSchemaContext, fields)
}

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
  export type Ctx<E extends Elements> = Schema.Context<E[number]>
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Tuple<Elements extends Tuple.Elements> extends
  Schema<
    Tuple.Type<Elements>,
    Tuple.Encoded<Elements>,
    Tuple.Ctx<Elements>
  >
{
  readonly "~clone.out": Tuple<Elements>
  readonly "~make.in": { readonly [K in keyof Elements]: Schema.MakeIn<Elements[K]> }
  readonly ast: SchemaAST.TupleType
  readonly elements: Elements
}

class Tuple$<Elements extends Tuple.Elements> extends Schema$<
  SchemaAST.TupleType,
  Tuple.Type<Elements>,
  Tuple.Encoded<Elements>,
  Tuple.Ctx<Elements>,
  Tuple<Elements>,
  Annotations.Annotations,
  { readonly [K in keyof Elements]: Schema.MakeIn<Elements[K]> },
  SchemaContext
> implements Tuple<Elements> {
  readonly elements: Elements
  constructor(ast: SchemaAST.TupleType, context: SchemaContext, elements: Elements) {
    super(ast, context)
    this.elements = { ...elements }
  }
  clone(ast: this["ast"], context: SchemaContext): this["~clone.out"] {
    return new Tuple$(ast, context, this.elements)
  }
}

/**
 * @since 4.0.0
 */
export function Tuple<const Elements extends ReadonlyArray<Schema.Any>>(...elements: Elements): Tuple<Elements> {
  return new Tuple$(
    new SchemaAST.TupleType(elements.map((element) => new SchemaAST.Element(element.ast, false, {})), [], {}, [], []),
    defaultSchemaContext,
    elements
  )
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
  readonly "~clone.out": Array<S>
  readonly "~make.in": ReadonlyArray<Schema.MakeIn<S>>
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
  ReadonlyArray<Schema.MakeIn<S>>,
  SchemaContext
> implements Array<S> {
  readonly item: S
  constructor(ast: SchemaAST.TupleType, context: SchemaContext, item: S) {
    super(ast, context)
    this.item = item
  }
  clone(ast: this["ast"], context: SchemaContext): this["~clone.out"] {
    return new Array$(ast, context, this.item)
  }
}

/**
 * @since 4.0.0
 */
export function Array<Item extends Schema.Any>(item: Item): Array<Item> {
  return new Array$(new SchemaAST.TupleType([], [item.ast], {}, [], []), defaultSchemaContext, item)
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface brand<S extends Schema.Any, B extends string | symbol> extends
  Schema<
    Schema.Type<S> & Brand<B>,
    Schema.Encoded<S>,
    Schema.Context<S>
  >
{
  readonly "~clone.out": brand<S["~clone.out"], B>
  readonly "~make.in": Schema.MakeIn<S>
  readonly schema: S
  readonly brand: B
}

class brand$<S extends Schema.Any, B extends string | symbol> extends Schema$<
  SchemaAST.AST,
  Schema.Type<S> & Brand<B>,
  Schema.Encoded<S>,
  Schema.Context<S>,
  brand<S["~clone.out"], B>,
  Annotations.Annotations,
  Schema.MakeIn<S>,
  SchemaContext
> implements brand<S, B> {
  constructor(readonly schema: S, readonly context: SchemaContext, readonly brand: B) {
    super(schema.ast, context)
  }
  clone(ast: this["ast"], context: SchemaContext): this["~clone.out"] {
    return new brand$(this.schema.clone(ast, context), context, this.brand)
  }
}

/**
 * @since 4.0.0
 */
export const brand = <B extends string | symbol>(brand: B) => <Self extends Schema.Any>(self: Self): brand<Self, B> => {
  return new brand$<Self, B>(self, defaultSchemaContext, brand)
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface suspend<T, E, R> extends Schema<T, E, R> {
  readonly "~clone.out": suspend<T, E, R>
}

/**
 * @category constructors
 * @since 4.0.0
 */
export const suspend = <T, E = T, R = never>(f: () => Schema<T, E, R>): suspend<T, E, R> =>
  make(new SchemaAST.Suspend(() => f().ast, {}, [], []))

type FilterOut = undefined | boolean | string | SchemaAST.Issue

function toIssue(
  out: FilterOut,
  input: unknown
): SchemaAST.Issue | undefined {
  if (out === undefined) {
    return undefined
  }
  if (Predicate.isBoolean(out)) {
    return out ? undefined : new SchemaAST.InvalidIssue(input)
  }
  if (Predicate.isString(out)) {
    return new SchemaAST.InvalidIssue(input, out)
  }
  return out
}

/**
 * @category filtering
 * @since 4.0.0
 */
export const filter = <S extends Schema.Any>(
  filter: (type: Schema.Type<S>, options: SchemaAST.ParseOptions) => FilterOut,
  annotations?: Annotations.Annotations<Schema.Type<S>>
) =>
(self: S): S["~clone.out"] => {
  return self.clone(
    SchemaAST.appendModifier(
      self.ast,
      new SchemaAST.Refinement(
        (input, options) => toIssue(filter(input, options), input),
        annotations ?? {}
      )
    ),
    self.context
  )
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
export interface decodeFrom<From extends Schema.Any, To extends Schema.Any>
  extends Schema<Schema.Type<To>, Schema.Encoded<From>, Schema.Context<From> | Schema.Context<To>>
{
  readonly "~make.in": Schema.MakeIn<To>
}

/**
 * @since 4.0.0
 */
export function decodeFrom<From extends Schema.Any, To extends Schema.Any>(from: From, to: To, transformations: {
  readonly decode: (input: Schema.Type<From>) => Schema.Encoded<To>
  readonly encode: (input: Schema.Encoded<To>) => Schema.Type<From>
}, annotations?: Annotations.Documentation): decodeFrom<From, To> {
  return to.pipe(encodeTo(from, { encode: transformations.encode, decode: transformations.decode }, annotations))
}

/**
 * @category API interface
 * @since 4.0.0
 */
export interface encodeTo<From extends Schema.Any, To extends Schema.Any>
  extends Schema<Schema.Type<From>, Schema.Encoded<To>, Schema.Context<From> | Schema.Context<To>>
{
  readonly "~make.in": Schema.MakeIn<From>
}

/**
 * @since 4.0.0
 */
export const encodeTo = <From extends Schema.Any, To extends Schema.Any>(to: To, transformations: {
  readonly encode: (input: Schema.Encoded<From>) => Schema.Type<To>
  readonly decode: (input: Schema.Type<To>) => Schema.Encoded<From>
}, annotations?: Annotations.Documentation) =>
(from: From): encodeTo<From, To> => {
  return make(SchemaAST.encodeTo(
    from.ast,
    to.ast,
    transformations.encode,
    transformations.decode,
    annotations ?? {}
  ))
}

/**
 * @category API interface
 * @since 4.0.0
 */
export interface encodeOptionalToRequired<From extends Schema.Any, To extends Schema.Any> extends
  PropertySignature<
    "readonly",
    ":?",
    From["~clone.out"],
    "readonly",
    never,
    ":",
    Schema.Encoded<To>,
    "no-default"
  >
{
  readonly "~make.in": Schema.MakeIn<From>
}

/**
 * @since 4.0.0
 */
export const encodeOptionalToRequired = <From extends Schema.Any, To extends Schema.Any>(
  to: To,
  transformations: {
    readonly encode: (input: Option.Option<Schema.Encoded<From>>) => Schema.Type<To>
    readonly decode: (input: Schema.Type<To>) => Option.Option<Schema.Encoded<From>>
  },
  annotations?: Annotations.Documentation
) =>
(from: From): encodeOptionalToRequired<From, To> => {
  const transformation = new SchemaAST.TransformationWithContext(
    new SchemaAST.FinalTransformation(
      (o) => Option.some(transformations.encode(o)),
      (o) => Option.flatMap(o, transformations.decode)
    ),
    undefined,
    false,
    true
  )
  return new propertySignature$(
    from.clone(
      SchemaAST.appendEncoding(from.ast, new SchemaAST.Encoding(transformation, to.ast, annotations ?? {})),
      from.context
    ),
    defaultPropertySignatureContext
  )
}

/**
 * @category API interface
 * @since 4.0.0
 */
export interface encodeRequiredToOptional<From extends Schema.Any, To extends Schema.Any> extends
  PropertySignature<
    "readonly",
    ":",
    From["~clone.out"],
    "readonly",
    never,
    ":?",
    Schema.Encoded<To>,
    "no-default"
  >
{
  readonly "~make.in": Schema.MakeIn<From>
}

/**
 * @since 4.0.0
 */
export const encodeRequiredToOptional = <From extends Schema.Any, To extends Schema.Any>(
  to: To,
  transformations: {
    readonly encode: (input: Schema.Encoded<From>) => Option.Option<Schema.Type<To>>
    readonly decode: (input: Option.Option<Schema.Type<To>>) => Schema.Encoded<From>
  },
  annotations?: Annotations.Documentation
) =>
(from: From): encodeRequiredToOptional<From, To> => {
  const transformation = new SchemaAST.TransformationWithContext(
    new SchemaAST.FinalTransformation(
      (o) => Option.flatMap(o, transformations.encode),
      (o) => Option.some(transformations.decode(o))
    ),
    undefined,
    false,
    true
  )
  return new propertySignature$(
    from.clone(
      SchemaAST.appendEncoding(from.ast, new SchemaAST.Encoding(transformation, to.ast, annotations ?? {})),
      from.context
    ),
    defaultPropertySignatureContext
  )
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export const trim = <S extends Schema<string, any, any>>(self: S) =>
  decodeFrom(
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
  make(SchemaAST.decodeOrFailFrom( // TODO: use decodeOrFailFrom when defined
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
export const NumberToString = parseNumber(String)

/**
 * @category api interface
 * @since 3.10.0
 */
export interface Class<Self, S extends Schema.Any> extends Schema<Self, Schema.Encoded<S>, Schema.Context<S>> {
  readonly "~clone.out": make<Self, Schema.Encoded<S>, Schema.Context<S>, Schema.MakeIn<S>>
  readonly "~annotate.in": SchemaAST.Annotations
  readonly "~make.in": Schema.MakeIn<S>
  readonly ast: SchemaAST.TypeLiteral
  new(props: Schema.MakeIn<S>): Schema.Type<S>
  readonly identifier: string
  readonly schema: S
}

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
    const ctor = ast.modifiers.findLast((r) => r._tag === "Ctor")
    const base = ctor ?
      class extends ctor.ctor {} :
      // eslint-disable-next-line @typescript-eslint/no-extraneous-class
      class {
        constructor(input: unknown, _options?: {}) { // TODO: options
          Object.assign(this, input)
        }
      }
    let astMemo: SchemaAST.TypeLiteral | undefined = undefined
    return class extends base {
      static readonly Type: Schema.Type<S>
      static readonly Encoded: Schema.Encoded<S>
      static readonly Context: Schema.Context<S>
      static readonly "~clone.out": make<Self, Schema.Encoded<S>, Schema.Context<S>, Schema.MakeIn<S>>
      static readonly "~annotate.in": SchemaAST.Annotations
      static readonly "~make.in": Schema.MakeIn<S>
      static readonly context: PropertySignatureContext = defaultPropertySignatureContext
      static readonly identifier = identifier
      static readonly schema = schema

      static readonly "effect/Schema" = variance
      static get ast(): SchemaAST.TypeLiteral {
        if (astMemo === undefined) {
          astMemo = SchemaAST.appendModifier(
            ast,
            new SchemaAST.Ctor(this, this.identifier, annotations ?? {})
          )
        }
        return astMemo
      }
      static pipe() {
        return pipeArguments(this, arguments)
      }
      static clone(ast: SchemaAST.TypeLiteral): make<Self, Schema.Encoded<S>, Schema.Context<S>, Schema.MakeIn<S>> {
        return make(ast)
      }
      static annotate(
        annotations: Annotations.Annotations
      ): make<Self, Schema.Encoded<S>, Schema.Context<S>, Schema.MakeIn<S>> {
        return this.clone(SchemaAST.annotate(this.ast, annotations))
      }
      static make(input: Schema.MakeIn<S>): Self {
        return new this(input) as any
      }
      static toString() {
        return `${this.ast}`
      }
    }
  }
