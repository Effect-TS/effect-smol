/**
 * @since 4.0.0
 */

import type { Brand } from "./Brand.js"
import type * as Effect from "./Effect.js"
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
export declare namespace AnnotationsNs {
  /**
   * @category annotations
   * @since 4.0.0
   */
  export interface Documentation extends SchemaAST.AnnotationsNs.Documentation {}

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

type OptionalToken = "required" | "optional"
type ReadonlyToken = "readonly" | "mutable"
type DefaultToken = "no-constructor-default" | "has-constructor-default"
type TypeRequiredConstraint = { readonly "~ps.type.isOptional": "required" }
type TypeNoConstructorConstraint = { readonly "~ps.type.constructor.default": "no-constructor-default" }
type EncodedOptionalConstraint = { readonly "~ps.encoded.isOptional": "optional" }
type EncodedRequiredConstraint = { readonly "~ps.encoded.isOptional": "required" }

/**
 * @category model
 * @since 4.0.0
 */
export interface AbstractSchema<
  T,
  E,
  R,
  Ast extends SchemaAST.AST,
  CloneOut extends Schema<T, E, R>,
  AnnotateIn extends SchemaAST.Annotations,
  MakeIn,
  TypeReadonly extends ReadonlyToken = "readonly",
  TypeIsOptional extends OptionalToken = "required",
  TypeDefault extends DefaultToken = "no-constructor-default",
  EncodedIsReadonly extends ReadonlyToken = "readonly",
  EncodedIsOptional extends OptionalToken = "required",
  EncodedKey extends PropertyKey = never
> extends SchemaNs.Variance<T, E, R>, Pipeable {
  readonly Type: T
  readonly Encoded: E
  readonly Context: R
  readonly ast: Ast

  readonly "~clone.out": CloneOut
  readonly "~annotate.in": AnnotateIn
  readonly "~make.in": MakeIn

  readonly "~ps.type.isReadonly": TypeReadonly
  readonly "~ps.type.isOptional": TypeIsOptional
  readonly "~ps.type.constructor.default": TypeDefault

  readonly "~ps.encoded.isReadonly": EncodedIsReadonly
  readonly "~ps.encoded.isOptional": EncodedIsOptional
  readonly "~ps.encoded.key": EncodedKey

  // useful to retain "~make.in" when flipping twice
  readonly "~internal.encoded.make.in": E

  clone(ast: this["ast"]): this["~clone.out"]
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
  CloneOut extends Schema<T, E, R>,
  AnnotateIn extends SchemaAST.Annotations,
  MakeIn,
  TypeReadonly extends ReadonlyToken = "readonly",
  TypeIsOptional extends OptionalToken = "required",
  TypeDefault extends DefaultToken = "no-constructor-default",
  EncodedIsReadonly extends ReadonlyToken = "readonly",
  EncodedIsOptional extends OptionalToken = "required",
  EncodedKey extends PropertyKey = never
> implements
  AbstractSchema<
    T,
    E,
    R,
    Ast,
    CloneOut,
    AnnotateIn,
    MakeIn,
    TypeReadonly,
    TypeIsOptional,
    TypeDefault,
    EncodedIsReadonly,
    EncodedIsOptional,
    EncodedKey
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
  readonly "~ps.type.constructor.default": TypeDefault

  readonly "~ps.encoded.isReadonly": EncodedIsReadonly
  readonly "~ps.encoded.isOptional": EncodedIsOptional
  readonly "~ps.encoded.key": EncodedKey

  readonly "~internal.encoded.make.in": E

  constructor(readonly ast: Ast) {
    this.make = this.make.bind(this)
  }
  abstract clone(ast: this["ast"]): this["~clone.out"]
  pipe() {
    return pipeArguments(this, arguments)
  }
  make(input: this["~make.in"]): T {
    return SchemaParser.validateUnknownSync(this)(input)
  }
  annotate(annotations: this["~annotate.in"]): this["~clone.out"] {
    return this.clone(SchemaAST.annotate(this.ast, annotations))
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
    Schema<T, E, R>,
    SchemaAST.Annotations,
    unknown,
    ReadonlyToken,
    OptionalToken,
    DefaultToken,
    ReadonlyToken,
    OptionalToken,
    PropertyKey
  >
{}

/**
 * @since 4.0.0
 */
export declare namespace SchemaNs {
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
  export type Type<S extends SchemaNs.Any> = S["Type"]
  /**
   * @since 4.0.0
   */
  export type Encoded<S extends SchemaNs.Any> = S["Encoded"]
  /**
   * @since 4.0.0
   */
  export type Context<S extends SchemaNs.Any> = S["Context"]
  /**
   * @since 4.0.0
   */
  export type MakeIn<S extends SchemaNs.Any> = S["~make.in"]
  /**
   * @since 4.0.0
   */
  export type Any = Schema<any, any, any>
}

class Schema$<S extends SchemaNs.Any> extends AbstractSchema$<
  SchemaNs.Type<S>,
  SchemaNs.Encoded<S>,
  SchemaNs.Context<S>,
  S["ast"],
  S["~clone.out"],
  S["~annotate.in"],
  S["~make.in"],
  S["~ps.type.isReadonly"],
  S["~ps.type.isOptional"],
  S["~ps.type.constructor.default"],
  S["~ps.encoded.isReadonly"],
  S["~ps.encoded.isOptional"],
  S["~ps.encoded.key"]
> {
  constructor(
    ast: S["ast"],
    readonly clone: (ast: S["ast"]) => S["~clone.out"]
  ) {
    super(ast)
  }
}

/**
 * @category API interface
 * @since 4.0.0
 */
export interface make<Ast extends SchemaAST.AST, T, E = T, R = never, MakeIn = T> extends
  AbstractSchema<
    T,
    E,
    R,
    Ast,
    make<Ast, T, E, R, MakeIn>,
    SchemaAST.Annotations,
    MakeIn
  >
{}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function make<Ast extends SchemaAST.AST, T, E = T, R = never, MakeIn = T>(
  ast: Ast
): make<Ast, T, E, R, MakeIn> {
  return new Schema$<make<Ast, T, E, R, MakeIn>>(ast, (ast) => make(ast))
}

/**
 * Tests if a value is a `Schema`.
 *
 * @category guards
 * @since 4.0.0
 */
export function isSchema(u: unknown): u is SchemaNs.Any {
  return Predicate.hasProperty(u, "~effect/Schema") && Predicate.isObject(u["~effect/Schema"])
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface optional<S extends SchemaNs.Any> extends
  AbstractSchema<
    SchemaNs.Type<S>,
    SchemaNs.Encoded<S>,
    SchemaNs.Context<S>,
    S["ast"],
    optional<S["~clone.out"]>,
    S["~annotate.in"],
    SchemaNs.MakeIn<S>,
    S["~ps.type.isReadonly"],
    "optional",
    S["~ps.type.constructor.default"],
    S["~ps.encoded.isReadonly"],
    "optional",
    S["~ps.encoded.key"]
  >
{
  readonly schema: S
}

class optional$<S extends SchemaNs.Any> extends Schema$<optional<S>> implements optional<S> {
  constructor(readonly schema: S) {
    super(
      SchemaAST.optional(schema.ast),
      (ast) => new optional$(this.schema.clone(ast))
    )
  }
}

/**
 * @since 4.0.0
 */
export function optional<S extends SchemaNs.Any>(
  schema: S
): optional<S> {
  return new optional$(schema)
}

/**
 * @since 4.0.0
 */
export interface mutable<S extends SchemaNs.Any> extends
  AbstractSchema<
    SchemaNs.Type<S>,
    SchemaNs.Encoded<S>,
    SchemaNs.Context<S>,
    S["ast"],
    mutable<S["~clone.out"]>,
    S["~annotate.in"],
    SchemaNs.MakeIn<S>,
    "mutable",
    S["~ps.type.isOptional"],
    S["~ps.type.constructor.default"],
    "mutable",
    S["~ps.encoded.isOptional"],
    S["~ps.encoded.key"]
  >
{
  readonly schema: S
}

class mutable$<S extends SchemaNs.Any> extends Schema$<mutable<S>> implements mutable<S> {
  constructor(readonly schema: S) {
    super(
      SchemaAST.mutable(schema.ast),
      (ast) => new mutable$(this.schema.clone(ast))
    )
  }
}

/**
 * @since 4.0.0
 */
export function mutable<S extends SchemaNs.Any>(
  schema: S
): mutable<S> {
  return new mutable$(schema)
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface typeSchema<T, MakeIn = T> extends make<SchemaAST.AST, T, T, never, MakeIn> {
  readonly "~clone.out": typeSchema<T, MakeIn>
}

/**
 * @since 4.0.0
 */
export function typeSchema<S extends SchemaNs.Any>(
  schema: S
): typeSchema<SchemaNs.Type<S>, SchemaNs.MakeIn<S>> {
  return make(SchemaAST.typeAST(schema.ast))
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface encodedSchema<E> extends make<SchemaAST.AST, E, E, never, E> {
  readonly "~clone.out": encodedSchema<E>
}

/**
 * @since 4.0.0
 */
export function encodedSchema<S extends SchemaNs.Any>(
  schema: S
): encodedSchema<SchemaNs.Encoded<S>> {
  return make(SchemaAST.encodedAST(schema.ast))
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface flip<S extends SchemaNs.Any> extends
  make<
    S["ast"],
    SchemaNs.Encoded<S>,
    SchemaNs.Type<S>,
    SchemaNs.Context<S>,
    S["~internal.encoded.make.in"]
  >
{
  readonly "~clone.out": flip<S["~clone.out"]>
  readonly "~internal.encoded.make.in": S["~make.in"]
}

/**
 * @since 4.0.0
 */
export const flip = <S extends SchemaNs.Any>(schema: S): flip<S> => {
  return make(SchemaAST.flip(schema.ast))
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface declare<T> extends make<SchemaAST.Declaration, T, T, never, T> {
  readonly "~clone.out": declare<T>
  readonly "~internal.encoded.make.in": T
}

/**
 * @since 4.0.0
 */
export const declare = <T>(options: {
  readonly guard: (u: unknown) => u is T
}): declare<T> => {
  return make(
    new SchemaAST.Declaration(
      [],
      () => (input) =>
        options.guard(input) ?
          Result.ok(input) :
          Result.err(new SchemaAST.InvalidIssue(Option.some(input))),
      {},
      [],
      undefined,
      undefined
    )
  )
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface declareResult<T, E, R> extends make<SchemaAST.Declaration, T, E, R, T> {
  readonly "~clone.out": declareResult<T, E, R>
  readonly "~internal.encoded.make.in": E
}

/**
 * @since 4.0.0
 */
export const declareResult = <const T, E, TypeParameters extends ReadonlyArray<SchemaNs.Any>>(options: {
  readonly typeParameters: TypeParameters
  readonly decode: (
    typeParameters: {
      readonly [K in keyof TypeParameters]: Schema<
        SchemaNs.Type<TypeParameters[K]>,
        SchemaNs.Encoded<TypeParameters[K]>,
        never
      >
    }
  ) => (
    input: unknown,
    options: SchemaAST.ParseOptions,
    ast: SchemaAST.Declaration
  ) => Result.Result<E, SchemaAST.Issue>
}): declareResult<T, E, SchemaNs.Context<TypeParameters[number]>> => {
  return make(
    new SchemaAST.Declaration(
      options.typeParameters.map((tp) => tp.ast),
      (typeParameters) => options.decode(typeParameters.map(make) as any),
      {},
      [],
      undefined,
      undefined
    )
  )
}

/**
 * Returns the underlying `Schema<T, E, R>`.
 *
 * @since 4.0.0
 */
export function reveal<T, E, R>(schema: Schema<T, E, R>): Schema<T, E, R> {
  return schema
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Literal<L extends SchemaAST.LiteralValue> extends make<SchemaAST.Literal, L> {
  readonly "~clone.out": Literal<L>
}

/**
 * @since 4.0.0
 */
export const Literal = <L extends SchemaAST.LiteralValue>(literal: L): Literal<L> =>
  make(new SchemaAST.Literal(literal, {}, [], undefined, undefined))

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Never extends make<SchemaAST.NeverKeyword, never> {
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
export interface String extends make<SchemaAST.StringKeyword, string> {
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
export interface Number extends make<SchemaAST.NumberKeyword, number> {
  readonly "~clone.out": Number
}

/**
 * @since 4.0.0
 */
export const Number: Number = make(SchemaAST.numberKeyword)

/**
 * @since 4.0.0
 */
export declare namespace StructNs {
  /**
   * @since 4.0.0
   */
  export type Field = SchemaNs.Any

  /**
   * @since 4.0.0
   */
  export type Fields = { readonly [x: PropertyKey]: Field }

  type TypeOptionalKeys<Fields extends StructNs.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~ps.type.isOptional": "optional" } ? K
      : never
  }[keyof Fields]

  type TypeMutableKeys<Fields extends StructNs.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~ps.type.isReadonly": "mutable" } ? K
      : never
  }[keyof Fields]

  type Type_<
    F extends Fields,
    O extends keyof F = TypeOptionalKeys<F>,
    M extends keyof F = TypeMutableKeys<F>
  > =
    & { readonly [K in Exclude<keyof F, M | O>]: SchemaNs.Type<F[K]> }
    & { readonly [K in Exclude<O, M>]?: SchemaNs.Type<F[K]> }
    & { [K in Exclude<M, O>]: SchemaNs.Type<F[K]> }
    & { [K in M & O]?: SchemaNs.Type<F[K]> }

  /**
   * @since 4.0.0
   */
  export type Type<F extends Fields> = Simplify<Type_<F>>

  type EncodedOptionalKeys<Fields extends StructNs.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~ps.encoded.isOptional": "optional" } ? K
      : never
  }[keyof Fields]

  type EncodedMutableKeys<Fields extends StructNs.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~ps.encoded.isReadonly": "mutable" } ? K
      : never
  }[keyof Fields]

  type EncodedFromKey<F extends Fields, K extends keyof F> = [K] extends [never] ? never :
    F[K] extends { readonly "~ps.encoded.key": infer EncodedKey extends PropertyKey } ?
      [EncodedKey] extends [never] ? K : [PropertyKey] extends [EncodedKey] ? K : EncodedKey :
    K

  type Encoded_<
    F extends Fields,
    O extends keyof F = EncodedOptionalKeys<F>,
    M extends keyof F = EncodedMutableKeys<F>
  > =
    & { readonly [K in Exclude<keyof F, M | O> as EncodedFromKey<F, K>]: SchemaNs.Encoded<F[K]> }
    & { readonly [K in Exclude<O, M> as EncodedFromKey<F, K>]?: SchemaNs.Encoded<F[K]> }
    & { [K in Exclude<M, O> as EncodedFromKey<F, K>]: SchemaNs.Encoded<F[K]> }
    & { [K in M & O as EncodedFromKey<F, K>]?: SchemaNs.Encoded<F[K]> }

  /**
   * @since 4.0.0
   */
  export type Encoded<F extends Fields> = Simplify<Encoded_<F>>

  /**
   * @since 4.0.0
   */
  export type Ctx<F extends Fields> = { readonly [K in keyof F]: SchemaNs.Context<F[K]> }[keyof F]

  type TypeDefaultedKeys<Fields extends StructNs.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~ps.type.constructor.default": "has-constructor-default" } ? K
      : never
  }[keyof Fields]

  type MakeIn_<
    F extends Fields,
    O = TypeOptionalKeys<F> | TypeDefaultedKeys<F>
  > =
    & { readonly [K in keyof F as K extends O ? never : K]: SchemaNs.MakeIn<F[K]> }
    & { readonly [K in keyof F as K extends O ? K : never]?: SchemaNs.MakeIn<F[K]> }

  /**
   * @since 4.0.0
   */
  export type MakeIn<F extends Fields> = Simplify<MakeIn_<F>>
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Struct<Fields extends StructNs.Fields> extends
  AbstractSchema<
    StructNs.Type<Fields>,
    StructNs.Encoded<Fields>,
    StructNs.Ctx<Fields>,
    SchemaAST.TypeLiteral,
    Struct<Fields>,
    AnnotationsNs.Annotations,
    StructNs.MakeIn<Fields>
  >
{
  readonly fields: Fields
  pick<Keys extends ReadonlyArray<keyof Fields>>(...keys: Keys): Struct<Pick<Fields, Keys[number]>>
  omit<Keys extends ReadonlyArray<keyof Fields>>(...keys: Keys): Struct<Omit<Fields, Keys[number]>>
}

class Struct$<Fields extends StructNs.Fields> extends Schema$<Struct<Fields>> implements Struct<Fields> {
  readonly fields: Fields
  constructor(ast: SchemaAST.TypeLiteral, fields: Fields) {
    super(ast, (ast) => new Struct$(ast, fields))
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
export function Struct<const Fields extends StructNs.Fields>(fields: Fields): Struct<Fields> {
  const ast = new SchemaAST.TypeLiteral(
    ownKeys(fields).map((key) => {
      return new SchemaAST.PropertySignature(key, fields[key].ast, {})
    }),
    [],
    {},
    [],
    undefined,
    undefined
  )
  return new Struct$(ast, fields)
}

/**
 * @since 4.0.0
 */
export declare namespace TupleNs {
  /**
   * @since 4.0.0
   */
  export type Element = SchemaNs.Any
  /**
   * @since 4.0.0
   */
  export type Elements = ReadonlyArray<Element>
  /**
   * @since 4.0.0
   */
  export type Type<E extends Elements> = { readonly [K in keyof E]: SchemaNs.Type<E[K]> }
  /**
   * @since 4.0.0
   */
  export type Encoded<E extends Elements> = { readonly [K in keyof E]: SchemaNs.Encoded<E[K]> }
  /**
   * @since 4.0.0
   */
  export type Context<E extends Elements> = SchemaNs.Context<E[number]>
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Tuple<Elements extends TupleNs.Elements> extends
  AbstractSchema<
    TupleNs.Type<Elements>,
    TupleNs.Encoded<Elements>,
    TupleNs.Context<Elements>,
    SchemaAST.TupleType,
    Tuple<Elements>,
    AnnotationsNs.Annotations,
    { readonly [K in keyof Elements]: SchemaNs.MakeIn<Elements[K]> }
  >
{
  readonly elements: Elements
}

class Tuple$<Elements extends TupleNs.Elements> extends Schema$<Tuple<Elements>> implements Tuple<Elements> {
  readonly elements: Elements
  constructor(ast: SchemaAST.TupleType, elements: Elements) {
    super(ast, (ast) => new Tuple$(ast, elements))
    this.elements = { ...elements }
  }
}

/**
 * @since 4.0.0
 */
export function Tuple<const Elements extends ReadonlyArray<SchemaNs.Any>>(elements: Elements): Tuple<Elements> {
  return new Tuple$(
    new SchemaAST.TupleType(
      elements.map((element) => new SchemaAST.Element(element.ast, false, {})),
      [],
      {},
      [],
      undefined,
      undefined
    ),
    elements
  )
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Array<S extends SchemaNs.Any> extends
  AbstractSchema<
    ReadonlyArray<SchemaNs.Type<S>>,
    ReadonlyArray<SchemaNs.Encoded<S>>,
    SchemaNs.Context<S>,
    SchemaAST.TupleType,
    Array<S>,
    AnnotationsNs.Annotations,
    ReadonlyArray<SchemaNs.MakeIn<S>>
  >
{
  readonly item: S
}

class Array$<S extends SchemaNs.Any> extends Schema$<Array<S>> implements Array<S> {
  readonly item: S
  constructor(ast: SchemaAST.TupleType, item: S) {
    super(ast, (ast) => new Array$(ast, item))
    this.item = item
  }
}

/**
 * @since 4.0.0
 */
export function Array<Item extends SchemaNs.Any>(item: Item): Array<Item> {
  return new Array$(
    new SchemaAST.TupleType([], [item.ast], {}, [], undefined, undefined),
    item
  )
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface brand<S extends SchemaNs.Any, B extends string | symbol> extends
  AbstractSchema<
    SchemaNs.Type<S> & Brand<B>,
    SchemaNs.Encoded<S>,
    SchemaNs.Context<S>,
    S["ast"],
    brand<S["~clone.out"], B>,
    S["~annotate.in"],
    SchemaNs.MakeIn<S>,
    S["~ps.type.isReadonly"],
    S["~ps.type.isOptional"],
    S["~ps.type.constructor.default"],
    S["~ps.encoded.isReadonly"],
    S["~ps.encoded.isOptional"],
    S["~ps.encoded.key"]
  >
{
  readonly schema: S
  readonly brand: B
}

class brand$<S extends SchemaNs.Any, B extends string | symbol> extends Schema$<brand<S, B>> implements brand<S, B> {
  constructor(readonly schema: S, readonly brand: B) {
    super(
      schema.ast,
      (ast) => new brand$(this.schema.clone(ast), this.brand)
    )
  }
}

/**
 * @since 4.0.0
 */
export const brand =
  <B extends string | symbol>(brand: B) => <Self extends SchemaNs.Any>(self: Self): brand<Self, B> => {
    return new brand$(self, brand)
  }

/**
 * @category api interface
 * @since 4.0.0
 */
export interface suspend<T, E, R> extends make<SchemaAST.Suspend, T, E, R, unknown> {
  readonly "~clone.out": suspend<T, E, R>
}

/**
 * @category constructors
 * @since 4.0.0
 */
export const suspend = <T, E = T, R = never>(f: () => Schema<T, E, R>): suspend<T, E, R> =>
  make(new SchemaAST.Suspend(() => f().ast, {}, [], undefined, undefined))

type FilterOut = undefined | boolean | string | SchemaAST.Issue

function toIssue(
  out: FilterOut,
  input: unknown
): SchemaAST.Issue | undefined {
  if (out === undefined) {
    return undefined
  }
  if (Predicate.isBoolean(out)) {
    return out ? undefined : new SchemaAST.InvalidIssue(Option.some(input))
  }
  if (Predicate.isString(out)) {
    return new SchemaAST.InvalidIssue(Option.some(input), out)
  }
  return out
}

/**
 * @category filtering
 * @since 4.0.0
 */
export const filter = <S extends SchemaNs.Any>(
  filter: (type: SchemaNs.Type<S>, options: SchemaAST.ParseOptions) => FilterOut,
  annotations?: AnnotationsNs.Annotations<SchemaNs.Type<S>>
) =>
(self: S): S["~clone.out"] => {
  return self.clone(
    SchemaAST.filter(
      self.ast,
      new SchemaAST.Refinement(
        (input, options) => toIssue(filter(input, options), input),
        annotations ?? {}
      )
    )
  )
}

/**
 * @category filtering
 * @since 4.0.0
 */
export const filterEncoded = <S extends SchemaNs.Any>(
  filter: (encoded: SchemaNs.Encoded<S>, options: SchemaAST.ParseOptions) => FilterOut,
  annotations?: AnnotationsNs.Annotations<SchemaNs.Encoded<S>>
) =>
(self: S): S["~clone.out"] => {
  return self.clone(
    SchemaAST.filterEncoded(
      self.ast,
      new SchemaAST.Refinement(
        (input, options) => toIssue(filter(input, options), input),
        annotations ?? {}
      )
    )
  )
}

/**
 * @category Length filters
 * @since 4.0.0
 */
export const minLength = <T extends { readonly length: number }>(
  minLength: number,
  annotations?: AnnotationsNs.Annotations<T>
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
export const nonEmpty = <T extends { readonly length: number }>(annotations?: AnnotationsNs.Annotations<T>) =>
  minLength(1, annotations)

/**
 * @category Order filters
 * @since 4.0.0
 */
const makeGreaterThan = <A>(O: Order.Order<A>) => {
  const f = Order.greaterThan(O)
  return <T extends A>(
    exclusiveMinimum: A,
    annotations?: AnnotationsNs.Annotations<T>
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
 * @since 4.0.0
 */
export const decodeTo = <From extends SchemaNs.Any, To extends SchemaNs.Any>(
  to: To,
  transformation: SchemaAST.SymmetricTransformation<SchemaNs.Type<From>, SchemaNs.Encoded<To>>
) =>
(from: From): encodeTo<To, From> => {
  return from.clone(SchemaAST.decodeTo(from.ast, to.ast, transformation))
}

/**
 * @since 4.0.0
 */
export const decode = <S extends SchemaNs.Any>(
  transformation: SchemaAST.SymmetricTransformation<SchemaNs.Type<S>, SchemaNs.Type<S>>
) =>
(self: S) => {
  return self.pipe(decodeTo(typeSchema(self), transformation))
}

/**
 * @category API interface
 * @since 4.0.0
 */
export interface encodeTo<From extends SchemaNs.Any, To extends SchemaNs.Any> extends
  AbstractSchema<
    SchemaNs.Type<From>,
    SchemaNs.Encoded<To>,
    SchemaNs.Context<From | To>,
    From["ast"],
    encodeTo<From["~clone.out"], To>,
    From["~annotate.in"],
    SchemaNs.MakeIn<From>,
    From["~ps.type.isReadonly"],
    From["~ps.type.isOptional"],
    From["~ps.type.constructor.default"],
    To["~ps.encoded.isReadonly"],
    To["~ps.encoded.isOptional"],
    To["~ps.encoded.key"]
  >
{}

/**
 * @since 4.0.0
 */
export const encodeTo = <From extends SchemaNs.Any, To extends SchemaNs.Any>(
  to: To,
  transformation: SchemaAST.SymmetricTransformation<SchemaNs.Type<To>, SchemaNs.Encoded<From>>
) =>
(from: From): encodeTo<From, To> => {
  return to.pipe(decodeTo(from, transformation))
}

/**
 * @since 4.0.0
 */
export const encode = <S extends SchemaNs.Any>(
  transformation: SchemaAST.SymmetricTransformation<SchemaNs.Encoded<S>, SchemaNs.Encoded<S>>
) =>
(self: S): encodeTo<S, encodedSchema<SchemaNs.Encoded<S>>> => {
  return self.pipe(encodeTo(encodedSchema(self), transformation))
}

/**
 * @category API interface
 * @since 4.0.0
 */
export interface encodeToKey<S extends SchemaNs.Any, K extends PropertyKey> extends
  AbstractSchema<
    SchemaNs.Type<S>,
    SchemaNs.Encoded<S>,
    SchemaNs.Context<S>,
    S["ast"],
    encodeToKey<S["~clone.out"], K>,
    S["~annotate.in"],
    SchemaNs.MakeIn<S>,
    S["~ps.type.isReadonly"],
    S["~ps.type.isOptional"],
    S["~ps.type.constructor.default"],
    S["~ps.encoded.isReadonly"],
    S["~ps.encoded.isOptional"],
    K
  >
{}

/**
 * @since 4.0.0
 */
export const encodeToKey = <K extends PropertyKey>(key: K) => <S extends SchemaNs.Any>(self: S): encodeToKey<S, K> => {
  return self.clone(SchemaAST.encodeToKey(self.ast, key)) as any // TODO: fix this
}

/**
 * @category API interface
 * @since 4.0.0
 */
export interface withConstructorDefault<S extends SchemaNs.Any> extends
  AbstractSchema<
    SchemaNs.Type<S>,
    SchemaNs.Encoded<S>,
    SchemaNs.Context<S>,
    S["ast"],
    withConstructorDefault<S["~clone.out"]>,
    S["~annotate.in"],
    SchemaNs.MakeIn<S>,
    S["~ps.type.isReadonly"],
    S["~ps.type.isOptional"],
    "has-constructor-default",
    S["~ps.encoded.isReadonly"],
    S["~ps.encoded.isOptional"],
    S["~ps.encoded.key"]
  >
{}

/**
 * @since 4.0.0
 */
export const withConstructorDefault = <S extends SchemaNs.Any & TypeNoConstructorConstraint>(
  value: Option.Option<SchemaNs.Type<S>> | Effect.Effect<SchemaNs.Type<S>>
) =>
(self: S): withConstructorDefault<S> => {
  return self.clone(SchemaAST.withConstructorDefault(self.ast, value)) as any // TODO: fix this
}

/**
 * @category API interface
 * @since 4.0.0
 */
export interface encodeOptionalToRequired<From extends SchemaNs.Any, To extends SchemaNs.Any> extends
  AbstractSchema<
    SchemaNs.Type<From>,
    SchemaNs.Encoded<To>,
    SchemaNs.Context<From | To>,
    From["ast"],
    encodeOptionalToRequired<From["~clone.out"], To>,
    From["~annotate.in"],
    SchemaNs.MakeIn<From>,
    From["~ps.type.isReadonly"],
    From["~ps.type.isOptional"],
    From["~ps.type.constructor.default"],
    To["~ps.encoded.isReadonly"],
    "required",
    To["~ps.encoded.key"]
  >
{}

/**
 * @since 4.0.0
 */
export const encodeOptionalToRequired =
  <From extends SchemaNs.Any & EncodedOptionalConstraint, To extends SchemaNs.Any & TypeRequiredConstraint>(
    to: To,
    transformations: {
      readonly encode: (input: Option.Option<SchemaNs.Encoded<From>>) => SchemaNs.Type<To>
      readonly decode: (input: SchemaNs.Type<To>) => Option.Option<SchemaNs.Encoded<From>>
    }
  ) =>
  (from: From): encodeOptionalToRequired<From, To> => {
    return from.clone(SchemaAST.encodeOptionalToRequired(from.ast, transformations, to.ast)) as any // TODO: fix this
  }

/**
 * @category API interface
 * @since 4.0.0
 */
export interface encodeRequiredToOptional<From extends SchemaNs.Any, To extends SchemaNs.Any> extends
  AbstractSchema<
    SchemaNs.Type<From>,
    SchemaNs.Encoded<To>,
    SchemaNs.Context<From | To>,
    From["ast"],
    encodeRequiredToOptional<From["~clone.out"], To>,
    From["~annotate.in"],
    SchemaNs.MakeIn<From>,
    From["~ps.type.isReadonly"],
    From["~ps.type.isOptional"],
    From["~ps.type.constructor.default"],
    To["~ps.encoded.isReadonly"],
    "optional",
    To["~ps.encoded.key"]
  >
{}

/**
 * @since 4.0.0
 */
export const encodeRequiredToOptional =
  <From extends SchemaNs.Any & EncodedRequiredConstraint, To extends SchemaNs.Any & TypeRequiredConstraint>(
    to: To,
    transformations: {
      readonly encode: (input: SchemaNs.Encoded<From>) => Option.Option<SchemaNs.Type<To>>
      readonly decode: (input: Option.Option<SchemaNs.Type<To>>) => SchemaNs.Encoded<From>
    }
  ) =>
  (from: From): encodeRequiredToOptional<From, To> => {
    return from.clone(SchemaAST.encodeRequiredToOptional(from.ast, transformations, to.ast)) as any // TODO: fix this
  }

/**
 * @category String transformations
 * @since 4.0.0
 */
export const trim: SchemaAST.SymmetricTransformation<string, string> = new SchemaAST.Transformation(
  new SchemaAST.Parse((input: string) => input.trim()),
  new SchemaAST.Parse((input: string) => input),
  { title: "trim" }
)

/**
 * @category api interface
 * @since 3.10.0
 */
export interface parseNumber<S extends Schema<string, any, any>> extends encodeTo<Number, S> {}

/**
 * @category String transformations
 * @since 4.0.0
 */
export const parseNumber: SchemaAST.SymmetricTransformation<string, number> = new SchemaAST.Transformation(
  new SchemaAST.ParseResult((s: string) => {
    const n = globalThis.Number(s)
    return isNaN(n)
      ? Result.err(new SchemaAST.InvalidIssue(Option.some(s), `Cannot convert "${s}" to a number`))
      : Result.ok(n)
  }),
  new SchemaAST.ParseResult((n: number) => Result.ok(globalThis.String(n))),
  { title: "parseNumber" }
)

/**
 * @category String transformations
 * @since 4.0.0
 */
export const NumberToString = String.pipe(decodeTo(Number, parseNumber))

/**
 * @category api interface
 * @since 3.10.0
 */
export interface Class<Self, S extends SchemaNs.Any> extends Schema<Self, SchemaNs.Encoded<S>, SchemaNs.Context<S>> {
  readonly "~clone.out": make<
    S["ast"],
    Self,
    SchemaNs.Encoded<S>,
    SchemaNs.Context<S>,
    SchemaNs.MakeIn<S>
  >
  readonly "~annotate.in": SchemaAST.Annotations
  readonly "~make.in": SchemaNs.MakeIn<S>

  readonly ast: SchemaAST.TypeLiteral
  new(props: SchemaNs.MakeIn<S>): SchemaNs.Type<S>
  readonly identifier: string
  readonly schema: S
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class BaseClass {
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
  <S extends SchemaNs.Any>(schema: S, annotations?: AnnotationsNs.Annotations): Class<Self, S> => {
    type CloneOut = make<
      S["ast"],
      Self,
      SchemaNs.Encoded<S>,
      SchemaNs.Context<S>,
      SchemaNs.MakeIn<S>
    >

    const ast = schema.ast
    if (ast._tag !== "TypeLiteral") {
      throw new Error("schema must be a TypeLiteral")
    }
    const ctor = ast.modifiers.findLast((r) => r._tag === "Ctor")
    const Base = ctor ?
      class extends ctor.ctor {} :
      BaseClass
    let astMemo: SchemaAST.TypeLiteral | undefined = undefined
    return class extends Base {
      static readonly Type: SchemaNs.Type<S>
      static readonly Encoded: SchemaNs.Encoded<S>
      static readonly Context: SchemaNs.Context<S>

      static readonly "~clone.out": CloneOut
      static readonly "~annotate.in": SchemaAST.Annotations
      static readonly "~make.in": SchemaNs.MakeIn<S>
      static readonly "~internal.encoded.make.in": SchemaNs.Encoded<S>
      static readonly "~ps.type.type": Self
      static readonly "~ps.type.isReadonly": ReadonlyToken
      static readonly "~ps.type.isOptional": OptionalToken
      static readonly "~ps.encoded.isReadonly": ReadonlyToken
      static readonly "~ps.encoded.key": PropertyKey
      static readonly "~ps.encoded.isOptional": OptionalToken
      static readonly "~ps.type.constructor.default": DefaultToken

      static readonly identifier = identifier
      static readonly schema = schema

      static readonly "~effect/Schema" = variance
      static get ast(): SchemaAST.TypeLiteral {
        if (astMemo === undefined) {
          astMemo = SchemaAST.appendCtor(
            ast,
            new SchemaAST.Ctor(
              this,
              this.identifier,
              (input) => {
                if (!(input instanceof this)) {
                  return Result.err(new SchemaAST.MismatchIssue(ast, input))
                }
                return Result.ok(input)
              },
              (input) => Result.ok(new this(input)),
              annotations ?? {}
            )
          )
        }
        return astMemo
      }
      static pipe() {
        return pipeArguments(this, arguments)
      }
      static clone(ast: S["ast"]): CloneOut {
        return make(ast)
      }
      static annotate(annotations: AnnotationsNs.Annotations): CloneOut {
        return this.clone(SchemaAST.annotate(this.ast, annotations))
      }
      static make(input: SchemaNs.MakeIn<S>): Self {
        return new this(input) as any
      }
      static toString() {
        return `${this.ast}`
      }
    }
  }

/**
 * @category model
 * @since 4.0.0
 */
export const File = declare({ guard: (u) => u instanceof globalThis.File })

const Option_ = <S extends SchemaNs.Any>(schema: S) => {
  return declareResult<Option.Option<SchemaNs.Type<S>>, Option.Option<SchemaNs.Encoded<S>>, [S]>({
    typeParameters: [schema],
    decode: ([item]) => (oinput, options, ast) => {
      if (Option.isOption(oinput)) {
        if (Option.isNone(oinput)) {
          return Result.ok(oinput)
        }
        const input = oinput.value
        const result = SchemaParser.decodeUnknownParserResult(item)(input, options)
        if (Result.isResult(result)) {
          return Result.isErr(result)
            ? Result.err(new SchemaAST.CompositeIssue(ast, input, [result.err], input))
            : Result.ok(Option.some(result.ok))
        }
        throw new Error("TODO: handle effects")
      }
      return Result.err(new SchemaAST.MismatchIssue(ast, oinput))
    }
  })
}

export {
  /**
   * @category model
   * @since 4.0.0
   */
  Option_ as Option
}
