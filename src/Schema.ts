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

/**
 * @category model
 * @since 4.0.0
 */
export interface DefaultSchemaContext {
  readonly _tag: "DefaultSchemaContext"
}

interface PropertySignatureContext {
  readonly _tag: "PropertySignatureContext"
  readonly "~ps.type.isReadonly": boolean
  readonly "~ps.type.isOptional": boolean
  readonly "~ps.encoded.isReadonly": boolean
  readonly "~ps.encoded.key": Option.Option<PropertyKey>
  readonly "~ps.encoded.isOptional": boolean
  readonly "~ps.constructor.default": Option.Option<unknown>
}

type SchemaContext = DefaultSchemaContext | PropertySignatureContext

type OptionalToken = ":" | ":?"
type ReadonlyToken = "readonly" | ""
type DefaultToken = "no-constructor-default" | "has-constructor-default"

/**
 * @category model
 * @since 4.0.0
 */
export interface AbstractSchema<
  T,
  E,
  R,
  Ast extends SchemaAST.AST,
  Ctx extends SchemaContext,
  CloneOut extends Schema<T, E, R>,
  AnnotateIn extends SchemaAST.Annotations,
  MakeIn,
  TypeReadonly extends ReadonlyToken = "readonly",
  TypeIsOptional extends OptionalToken = ":",
  EncodedIsReadonly extends ReadonlyToken = "readonly",
  EncodedKey extends PropertyKey = never,
  EncodedIsOptional extends OptionalToken = ":",
  Default extends DefaultToken = "no-constructor-default"
> extends Schema.Variance<T, E, R>, Pipeable {
  readonly Type: T
  readonly Encoded: E
  readonly Context: R
  readonly ast: Ast
  readonly context: Ctx

  readonly "~clone.out": CloneOut
  readonly "~annotate.in": AnnotateIn
  readonly "~make.in": MakeIn

  readonly "~ps.type.isReadonly": TypeReadonly
  readonly "~ps.type.isOptional": TypeIsOptional
  readonly "~ps.encoded.isReadonly": EncodedIsReadonly
  readonly "~ps.encoded.key": EncodedKey
  readonly "~ps.encoded.isOptional": EncodedIsOptional
  readonly "~ps.constructor.default": Default

  clone(ast: this["ast"], context: this["context"]): this["~clone.out"]
  annotate(annotations: this["~annotate.in"]): this["~clone.out"]
  make(input: this["~make.in"]): T
}

const variance = {
  /* v8 ignore next 3 */
  "~T": (_: never) => _,
  "~E": (_: never) => _,
  "~R": (_: never) => _
}

/**
 * @since 4.0.0
 */
export abstract class AbstractSchema$<
  T,
  E,
  R,
  Ast extends SchemaAST.AST,
  Ctx extends SchemaContext,
  CloneOut extends Schema<T, E, R>,
  AnnotateIn extends SchemaAST.Annotations,
  MakeIn,
  TypeReadonly extends ReadonlyToken = "readonly",
  TypeIsOptional extends OptionalToken = ":",
  EncodedIsReadonly extends ReadonlyToken = "readonly",
  EncodedKey extends PropertyKey = never,
  EncodedIsOptional extends OptionalToken = ":",
  Default extends DefaultToken = "no-constructor-default"
> implements
  AbstractSchema<
    T,
    E,
    R,
    Ast,
    Ctx,
    CloneOut,
    AnnotateIn,
    MakeIn,
    TypeReadonly,
    TypeIsOptional,
    EncodedIsReadonly,
    EncodedKey,
    EncodedIsOptional,
    Default
  >
{
  "~effect/Schema" = variance
  readonly Type!: T
  readonly Encoded!: E
  readonly Context!: R

  readonly "~clone.out": CloneOut
  readonly "~annotate.in": AnnotateIn
  readonly "~make.in": MakeIn

  readonly "~ps.type.isReadonly": TypeReadonly
  readonly "~ps.type.isOptional": TypeIsOptional
  readonly "~ps.encoded.isReadonly": EncodedIsReadonly
  readonly "~ps.encoded.key": EncodedKey
  readonly "~ps.encoded.isOptional": EncodedIsOptional
  readonly "~ps.constructor.default": Default

  constructor(readonly ast: Ast, readonly context: Ctx) {}
  abstract clone(ast: this["ast"], context: this["context"]): this["~clone.out"]
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
    return this.clone(SchemaAST.annotate(this.ast, annotations), this.context)
  }
  toString() {
    return `${this.ast}`
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export interface Schema<out T, out E = T, out R = never> extends
  AbstractSchema<
    T,
    E,
    R,
    SchemaAST.AST,
    SchemaContext,
    Schema<T, E, R>,
    SchemaAST.Annotations,
    unknown,
    ReadonlyToken,
    OptionalToken,
    ReadonlyToken,
    PropertyKey,
    OptionalToken,
    DefaultToken
  >
{}

/**
 * @since 4.0.0
 */
export declare namespace Schema {
  /**
   * @since 4.0.0
   */
  export interface Variance<T, E, R> {
    readonly "~effect/Schema": {
      readonly "~T": Types.Covariant<T>
      readonly "~E": Types.Covariant<E>
      readonly "~R": Types.Covariant<R>
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

class Schema$<S extends Schema.Any> extends AbstractSchema$<
  Schema.Type<S>,
  Schema.Encoded<S>,
  Schema.Context<S>,
  S["ast"],
  S["context"],
  S["~clone.out"],
  S["~annotate.in"],
  S["~make.in"],
  S["~ps.type.isReadonly"],
  S["~ps.type.isOptional"],
  S["~ps.encoded.isReadonly"],
  S["~ps.encoded.key"],
  S["~ps.encoded.isOptional"],
  S["~ps.constructor.default"]
> {
  constructor(
    ast: S["ast"],
    context: S["context"],
    readonly clone: (ast: S["ast"], context: S["context"]) => S["~clone.out"]
  ) {
    super(ast, context)
  }
}

/**
 * @category API interface
 * @since 4.0.0
 */
export interface make<Ast extends SchemaAST.AST, Ctx extends SchemaContext, T, E = T, R = never, MakeIn = T>
  extends
    AbstractSchema<
      T,
      E,
      R,
      Ast,
      Ctx,
      make<Ast, Ctx, T, E, R, MakeIn>,
      SchemaAST.Annotations,
      MakeIn
    >
{}

/**
 * @since 4.0.0
 */
export const defaultSchemaContext: DefaultSchemaContext = {
  _tag: "DefaultSchemaContext"
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function make<Ast extends SchemaAST.AST, Ctx extends SchemaContext, T, E = T, R = never, MakeIn = T>(
  ast: Ast,
  context: Ctx
): make<Ast, Ctx, T, E, R, MakeIn>
export function make<Ast extends SchemaAST.AST, T, E = T, R = never, MakeIn = T>(
  ast: Ast
): make<Ast, DefaultSchemaContext, T, E, R, MakeIn>
export function make<Ast extends SchemaAST.AST, T, E = T, R = never, MakeIn = T>(
  ast: Ast,
  context: SchemaContext = defaultSchemaContext
): make<Ast, SchemaContext, T, E, R, MakeIn> {
  return new Schema$<make<Ast, SchemaContext, T, E, R, MakeIn>>(ast, context, (ast, context) => make(ast, context))
}

/**
 * Tests if a value is a `Schema`.
 *
 * @category guards
 * @since 4.0.0
 */
export const isSchema = (u: unknown): u is Schema.Any =>
  Predicate.hasProperty(u, "~effect/Schema") && Predicate.isObject(u["~effect/Schema"])

const defaultPropertySignatureContext: PropertySignatureContext = {
  _tag: "PropertySignatureContext",
  "~ps.type.isReadonly": true,
  "~ps.type.isOptional": false,
  "~ps.encoded.isReadonly": true,
  "~ps.encoded.key": Option.none(),
  "~ps.encoded.isOptional": false,
  "~ps.constructor.default": Option.none()
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface optional<S extends Schema.Any> extends
  AbstractSchema<
    Schema.Type<S>,
    Schema.Encoded<S>,
    Schema.Context<S>,
    S["ast"],
    S["context"],
    optional<S["~clone.out"]>,
    S["~annotate.in"],
    Schema.MakeIn<S>,
    S["~ps.type.isReadonly"],
    ":?",
    S["~ps.encoded.isReadonly"],
    S["~ps.encoded.key"],
    ":?",
    S["~ps.constructor.default"]
  >
{
  readonly schema: S
}

class optional$<S extends Schema.Any> extends Schema$<optional<S>> implements optional<S> {
  constructor(readonly schema: S) {
    const ctx = {
      ...schema.context._tag === "PropertySignatureContext" ? schema.context : defaultPropertySignatureContext,
      "~ps.type.isOptional": true,
      "~ps.encoded.isOptional": true
    }
    super(schema.ast, ctx, (ast, context) => new optional$(this.schema.clone(ast, context)))
  }
}

/**
 * @since 4.0.0
 */
export function optional<S extends Schema.Any>(schema: S): optional<S> {
  return new optional$(schema)
}

/**
 * @since 4.0.0
 */
export interface mutable<S extends Schema.Any> extends
  AbstractSchema<
    Schema.Type<S>,
    Schema.Encoded<S>,
    Schema.Context<S>,
    S["ast"],
    S["context"],
    mutable<S["~clone.out"]>,
    S["~annotate.in"],
    Schema.MakeIn<S>,
    "",
    S["~ps.type.isOptional"],
    "",
    S["~ps.encoded.key"],
    S["~ps.encoded.isOptional"],
    S["~ps.constructor.default"]
  >
{
  readonly schema: S
}

class mutable$<S extends Schema.Any> extends Schema$<mutable<S>> implements mutable<S> {
  constructor(readonly schema: S) {
    const ctx = {
      ...schema.context._tag === "PropertySignatureContext" ? schema.context : defaultPropertySignatureContext,
      "~ps.type.isReadonly": false,
      "~ps.encoded.isReadonly": false
    }
    super(schema.ast, ctx, (ast, context) => new mutable$(this.schema.clone(ast, context)))
  }
}

/**
 * @since 4.0.0
 */
export function mutable<S extends Schema.Any>(schema: S): mutable<S> {
  return new mutable$(schema)
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface typeSchema<T, MakeIn = T> extends make<SchemaAST.AST, DefaultSchemaContext, T, T, never, MakeIn> {
  readonly "~clone.out": typeSchema<T, MakeIn>
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
export interface Literal<L extends SchemaAST.LiteralValue> extends make<SchemaAST.Literal, DefaultSchemaContext, L> {
  readonly "~clone.out": Literal<L>
}

/**
 * @since 4.0.0
 */
export const Literal = <L extends SchemaAST.LiteralValue>(literal: L): Literal<L> =>
  make(new SchemaAST.Literal(literal, {}, [], []))

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Never extends make<SchemaAST.NeverKeyword, DefaultSchemaContext, never> {
  readonly "~clone.out": Never
}

/**
 * @since 4.0.0
 */
export const Never: Never = make(SchemaAST.neverKeyword)

/**
 * @category api interface
 * @since 4.0.0
 */
export interface String extends make<SchemaAST.StringKeyword, DefaultSchemaContext, string> {
  readonly "~clone.out": String
}

/**
 * @since 4.0.0
 */
export const String: String = make(SchemaAST.stringKeyword)

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Number extends make<SchemaAST.NumberKeyword, DefaultSchemaContext, number> {
  readonly "~clone.out": Number
}

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
  AbstractSchema<
    Struct.Type<Fields>,
    Struct.Encoded<Fields>,
    Struct.Ctx<Fields>,
    SchemaAST.TypeLiteral,
    SchemaContext,
    Struct<Fields>,
    Annotations.Annotations,
    Struct.MakeIn<Fields>
  >
{
  readonly fields: Fields
  pick<Keys extends ReadonlyArray<keyof Fields>>(...keys: Keys): Struct<Pick<Fields, Keys[number]>>
  omit<Keys extends ReadonlyArray<keyof Fields>>(...keys: Keys): Struct<Omit<Fields, Keys[number]>>
}

class Struct$<Fields extends Struct.Fields> extends Schema$<Struct<Fields>> implements Struct<Fields> {
  readonly fields: Fields
  constructor(ast: SchemaAST.TypeLiteral, context: SchemaContext, fields: Fields) {
    super(ast, context, (ast, context) => new Struct$(ast, context, fields))
    this.fields = { ...fields }
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
  AbstractSchema<
    Tuple.Type<Elements>,
    Tuple.Encoded<Elements>,
    Tuple.Ctx<Elements>,
    SchemaAST.TupleType,
    SchemaContext,
    Tuple<Elements>,
    Annotations.Annotations,
    { readonly [K in keyof Elements]: Schema.MakeIn<Elements[K]> }
  >
{
  readonly elements: Elements
}

class Tuple$<Elements extends Tuple.Elements> extends Schema$<Tuple<Elements>> implements Tuple<Elements> {
  readonly elements: Elements
  constructor(ast: SchemaAST.TupleType, context: SchemaContext, elements: Elements) {
    super(ast, context, (ast, context) => new Tuple$(ast, context, elements))
    this.elements = { ...elements }
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
  AbstractSchema<
    ReadonlyArray<Schema.Type<S>>,
    ReadonlyArray<Schema.Encoded<S>>,
    Schema.Context<S>,
    SchemaAST.TupleType,
    SchemaContext,
    Array<S>,
    Annotations.Annotations,
    ReadonlyArray<Schema.MakeIn<S>>
  >
{
  readonly item: S
}

class Array$<S extends Schema.Any> extends Schema$<Array<S>> implements Array<S> {
  readonly item: S
  constructor(ast: SchemaAST.TupleType, context: SchemaContext, item: S) {
    super(ast, context, (ast, context) => new Array$(ast, context, item))
    this.item = item
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
  AbstractSchema<
    Schema.Type<S> & Brand<B>,
    Schema.Encoded<S>,
    Schema.Context<S>,
    S["ast"],
    S["context"],
    brand<S["~clone.out"], B>,
    S["~annotate.in"],
    Schema.MakeIn<S>,
    S["~ps.type.isReadonly"],
    S["~ps.type.isOptional"],
    S["~ps.encoded.isReadonly"],
    S["~ps.encoded.key"],
    S["~ps.encoded.isOptional"],
    S["~ps.constructor.default"]
  >
{
  readonly schema: S
  readonly brand: B
}

class brand$<S extends Schema.Any, B extends string | symbol> extends Schema$<brand<S, B>> implements brand<S, B> {
  constructor(readonly schema: S, readonly context: S["context"], readonly brand: B) {
    super(schema.ast, context, (ast, context) => new brand$(this.schema.clone(ast, context), context, this.brand))
  }
}

/**
 * @since 4.0.0
 */
export const brand = <B extends string | symbol>(brand: B) => <Self extends Schema.Any>(self: Self): brand<Self, B> => {
  return new brand$(self, defaultSchemaContext, brand)
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface suspend<T, E, R> extends make<SchemaAST.Suspend, DefaultSchemaContext, T, E, R, unknown> {
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
  return make(
    SchemaAST.encodeTo(
      from.ast,
      to.ast,
      transformations.encode,
      transformations.decode,
      annotations ?? {}
    )
  )
}

/**
 * @category API interface
 * @since 4.0.0
 */
export interface encodeOptionalToRequired<From extends Schema.Any, To extends Schema.Any> extends
  AbstractSchema<
    Schema.Type<To>,
    Schema.Encoded<From>,
    Schema.Context<From | To>,
    To["ast"],
    To["context"],
    encodeOptionalToRequired<From, To>,
    To["~annotate.in"],
    Schema.MakeIn<To>,
    To["~ps.type.isReadonly"],
    ":?",
    From["~ps.encoded.isReadonly"],
    From["~ps.encoded.key"],
    ":",
    To["~ps.constructor.default"]
  >
{}

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
  const ast = SchemaAST.appendEncoding(from.ast, new SchemaAST.Encoding(transformation, to.ast, annotations ?? {}))
  const context: PropertySignatureContext = from.context._tag === "PropertySignatureContext" ?
    {
      ...from.context,
      "~ps.type.isOptional": true
    } :
    {
      ...defaultPropertySignatureContext,
      "~ps.type.isOptional": true
    }
  const make = (ast: SchemaAST.AST, context: SchemaContext): encodeOptionalToRequired<From, To> =>
    new Schema$<encodeOptionalToRequired<From, To>>(ast, context, make)
  return make(ast, context)
}

/**
 * @category API interface
 * @since 4.0.0
 */
export interface encodeRequiredToOptional<From extends Schema.Any, To extends Schema.Any> extends
  AbstractSchema<
    Schema.Type<From>,
    Schema.Encoded<To>,
    Schema.Context<From | To>,
    From["ast"],
    From["context"],
    encodeRequiredToOptional<From, To>,
    From["~annotate.in"],
    Schema.MakeIn<From>,
    From["~ps.type.isReadonly"],
    ":",
    To["~ps.encoded.isReadonly"],
    To["~ps.encoded.key"],
    ":?",
    From["~ps.constructor.default"]
  >
{}

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
  const ast = SchemaAST.appendEncoding(from.ast, new SchemaAST.Encoding(transformation, to.ast, annotations ?? {}))
  const context = from.context
  const make = (ast: SchemaAST.AST, context: SchemaContext): encodeRequiredToOptional<From, To> =>
    new Schema$<encodeRequiredToOptional<From, To>>(ast, context, make)
  return make(ast, context)
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
  make(
    SchemaAST.decodeOrFailFrom( // TODO: use decodeOrFailFrom when defined
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
    )
  )

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
  readonly "~clone.out": make<
    S["ast"],
    S["context"],
    Self,
    Schema.Encoded<S>,
    Schema.Context<S>,
    Schema.MakeIn<S>
  >
  readonly "~annotate.in": SchemaAST.Annotations
  readonly "~make.in": Schema.MakeIn<S>

  readonly ast: SchemaAST.TypeLiteral
  new(props: Schema.MakeIn<S>): Schema.Type<S>
  readonly identifier: string
  readonly schema: S
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class StaticSchema {
  constructor(input: unknown, _options?: {}) { // TODO: options
    Object.assign(this, input)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export const Class =
  <Self = never>(identifier: string) =>
  <S extends Schema.Any>(schema: S, annotations?: Annotations.Annotations): Class<Self, S> => {
    type CloneOut = make<
      S["ast"],
      S["context"],
      Self,
      Schema.Encoded<S>,
      Schema.Context<S>,
      Schema.MakeIn<S>
    >

    const ast = schema.ast
    if (ast._tag !== "TypeLiteral") {
      throw new Error("schema must be a TypeLiteral")
    }
    const ctor = ast.modifiers.findLast((r) => r._tag === "Ctor")
    const base = ctor ?
      class extends ctor.ctor {} :
      StaticSchema
    let astMemo: SchemaAST.TypeLiteral | undefined = undefined
    return class extends base {
      static readonly Type: Schema.Type<S>
      static readonly Encoded: Schema.Encoded<S>
      static readonly Context: Schema.Context<S>

      static readonly "~clone.out": CloneOut
      static readonly "~annotate.in": SchemaAST.Annotations
      static readonly "~make.in": Schema.MakeIn<S>

      static readonly "~ps.type.type": Self
      static readonly "~ps.type.isReadonly": ReadonlyToken
      static readonly "~ps.type.isOptional": OptionalToken
      static readonly "~ps.encoded.isReadonly": ReadonlyToken
      static readonly "~ps.encoded.key": PropertyKey
      static readonly "~ps.encoded.isOptional": OptionalToken
      static readonly "~ps.constructor.default": DefaultToken

      static readonly context: S["context"] = schema.context
      static readonly identifier = identifier
      static readonly schema = schema

      static readonly "~effect/Schema" = variance
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
      static clone(ast: S["ast"], context: S["context"]): CloneOut {
        return make(ast, context)
      }
      static annotate(annotations: Annotations.Annotations): CloneOut {
        return this.clone(SchemaAST.annotate(this.ast, annotations), this.context)
      }
      static make(input: Schema.MakeIn<S>): Self {
        return new this(input) as any
      }
      static toString() {
        return `${this.ast}`
      }
    }
  }
