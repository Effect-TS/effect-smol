/**
 * @since 4.0.0
 */

import type { Brand } from "./Brand.js"
import type * as Cause from "./Cause.js"
import * as Data from "./Data.js"
import * as Effect from "./Effect.js"
import type { Equivalence } from "./Equivalence.js"
import type * as FastCheck from "./FastCheck.js"
import * as Function from "./Function.js"
import * as core from "./internal/core.js"
import { formatUnknown, ownKeys } from "./internal/schema/util.js"
import * as O from "./Option.js"
import * as Order from "./Order.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"
import * as Predicate from "./Predicate.js"
import * as Result from "./Result.js"
import * as SchemaAST from "./SchemaAST.js"
import * as SchemaParser from "./SchemaParser.js"
import * as SchemaParserResult from "./SchemaParserResult.js"
import * as Struct_ from "./Struct.js"

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
type DefaultConstructorToken = "no-constructor-default" | "has-constructor-default"

/**
 * @category model
 * @since 4.0.0
 */
export interface Bottom<
  T,
  E,
  RD,
  RE,
  RI,
  Ast extends SchemaAST.AST,
  CloneOut extends Top,
  AnnotateIn extends SchemaAST.Annotations,
  MakeIn,
  TypeReadonly extends ReadonlyToken = "readonly",
  TypeIsOptional extends OptionalToken = "required",
  TypeDefault extends DefaultConstructorToken = "no-constructor-default",
  EncodedIsReadonly extends ReadonlyToken = "readonly",
  EncodedIsOptional extends OptionalToken = "required",
  EncodedKey extends PropertyKey = never
> extends Pipeable {
  readonly ast: Ast

  readonly "~effect/Schema": "~effect/Schema"

  readonly "Type": T
  readonly "Encoded": E
  readonly "DecodingContext": RD
  readonly "EncodingContext": RE
  readonly "IntrinsicContext": RI

  readonly "~clone.out": CloneOut
  readonly "~annotate.in": AnnotateIn
  readonly "~make.in": MakeIn

  readonly "~ctx.type.isReadonly": TypeReadonly
  readonly "~ctx.type.isOptional": TypeIsOptional
  readonly "~ctx.type.constructor.default": TypeDefault

  readonly "~ctx.encoded.isReadonly": EncodedIsReadonly
  readonly "~ctx.encoded.isOptional": EncodedIsOptional
  readonly "~ctx.encoded.key": EncodedKey

  // useful to retain "~make.in" when flipping twice
  readonly "~internal.encoded.make.in": E

  clone(ast: this["ast"]): this["~clone.out"]
  annotate(annotations: this["~annotate.in"]): this["~clone.out"]
  makeUnsafe(input: this["~make.in"]): this["Type"]
}

/**
 * @since 4.0.0
 */
export abstract class Bottom$<
  T,
  E,
  RD,
  RE,
  RI,
  Ast extends SchemaAST.AST,
  CloneOut extends Top,
  AnnotateIn extends SchemaAST.Annotations,
  MakeIn,
  TypeReadonly extends ReadonlyToken = "readonly",
  TypeIsOptional extends OptionalToken = "required",
  TypeDefault extends DefaultConstructorToken = "no-constructor-default",
  EncodedIsReadonly extends ReadonlyToken = "readonly",
  EncodedIsOptional extends OptionalToken = "required",
  EncodedKey extends PropertyKey = never
> implements
  Bottom<
    T,
    E,
    RD,
    RE,
    RI,
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
  readonly "~effect/Schema" = "~effect/Schema"

  declare readonly "Type": T
  declare readonly "Encoded": E
  declare readonly "DecodingContext": RD
  declare readonly "EncodingContext": RE
  declare readonly "IntrinsicContext": RI

  declare readonly "~clone.out": CloneOut
  declare readonly "~annotate.in": AnnotateIn
  declare readonly "~make.in": MakeIn

  declare readonly "~ctx.type.isReadonly": TypeReadonly
  declare readonly "~ctx.type.isOptional": TypeIsOptional
  declare readonly "~ctx.type.constructor.default": TypeDefault

  declare readonly "~ctx.encoded.isReadonly": EncodedIsReadonly
  declare readonly "~ctx.encoded.isOptional": EncodedIsOptional
  declare readonly "~ctx.encoded.key": EncodedKey

  declare readonly "~internal.encoded.make.in": E

  constructor(readonly ast: Ast) {
    this.makeUnsafe = this.makeUnsafe.bind(this)
  }
  abstract clone(ast: this["ast"]): this["~clone.out"]
  pipe() {
    return pipeArguments(this, arguments)
  }
  makeUnsafe(input: this["~make.in"]): this["Type"] {
    return SchemaParser.validateUnknownSync(this as any as Codec<T, E, RD, RE, never>)(input)
  }
  annotate(annotations: this["~annotate.in"]): this["~clone.out"] {
    return this.clone(SchemaAST.annotate(this.ast, annotations))
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export interface Top extends
  Bottom<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    SchemaAST.AST,
    Top,
    SchemaAST.Annotations,
    unknown,
    ReadonlyToken,
    OptionalToken,
    DefaultConstructorToken,
    ReadonlyToken,
    OptionalToken,
    PropertyKey
  >
{}

/**
 * @category model
 * @since 4.0.0
 */
export interface Schema<out T> extends Top {
  readonly "Type": T
  readonly "~clone.out": Schema<T>
}

/**
 * @category model
 * @since 4.0.0
 */
export interface Codec<out T, out E = T, out RD = never, out RE = never, out RI = never> extends Schema<T> {
  readonly "Encoded": E
  readonly "DecodingContext": RD
  readonly "EncodingContext": RE
  readonly "IntrinsicContext": RI
  readonly "~clone.out": Codec<T, E, RD, RE, RI>
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface make<S extends Top> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
    S["IntrinsicContext"],
    S["ast"],
    S["~clone.out"],
    S["~annotate.in"],
    S["~make.in"],
    S["~ctx.type.isReadonly"],
    S["~ctx.type.isOptional"],
    S["~ctx.type.constructor.default"],
    S["~ctx.encoded.isReadonly"],
    S["~ctx.encoded.isOptional"],
    S["~ctx.encoded.key"]
  >
{}

class make$<S extends Top> extends Bottom$<
  S["Type"],
  S["Encoded"],
  S["DecodingContext"],
  S["EncodingContext"],
  S["IntrinsicContext"],
  S["ast"],
  S["~clone.out"],
  S["~annotate.in"],
  S["~make.in"],
  S["~ctx.type.isReadonly"],
  S["~ctx.type.isOptional"],
  S["~ctx.type.constructor.default"],
  S["~ctx.encoded.isReadonly"],
  S["~ctx.encoded.isOptional"],
  S["~ctx.encoded.key"]
> {
  constructor(
    ast: S["ast"],
    readonly clone: (ast: S["ast"]) => S["~clone.out"]
  ) {
    super(ast)
  }
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function make<S extends Top>(ast: S["ast"]): make<S> {
  const clone = (ast: SchemaAST.AST) => new make$<S>(ast, clone)
  return clone(ast)
}

/**
 * Tests if a value is a `Schema`.
 *
 * @category guards
 * @since 4.0.0
 */
export function isSchema(u: unknown): u is Schema<unknown> {
  return Predicate.hasProperty(u, "~effect/Schema") && u["~effect/Schema"] === "~effect/Schema"
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface optionalKey<S extends Top> extends make<S> {
  readonly "~clone.out": optionalKey<S["~clone.out"]>
  readonly "~ctx.type.isOptional": "optional"
  readonly "~ctx.encoded.isOptional": "optional"
  readonly schema: S
}

class optionalKey$<S extends Top> extends make$<optionalKey<S>> implements optionalKey<S> {
  constructor(readonly schema: S) {
    super(
      SchemaAST.optional(schema.ast),
      (ast) => new optionalKey$(this.schema.clone(ast))
    )
  }
}

/**
 * @since 4.0.0
 */
export function optionalKey<S extends Top>(schema: S): optionalKey<S> {
  return new optionalKey$(schema)
}

/**
 * @since 4.0.0
 */
export interface mutableKey<S extends Top> extends make<S> {
  readonly "~clone.out": mutableKey<S["~clone.out"]>
  readonly "~ctx.type.isReadonly": "mutable"
  readonly "~ctx.encoded.isReadonly": "mutable"
  readonly schema: S
}

class mutableKey$<S extends Top> extends make$<mutableKey<S>> implements mutableKey<S> {
  constructor(readonly schema: S) {
    super(
      SchemaAST.mutable(schema.ast),
      (ast) => new mutableKey$(this.schema.clone(ast))
    )
  }
}

/**
 * @since 4.0.0
 */
export function mutableKey<S extends Top>(schema: S): mutableKey<S> {
  return new mutableKey$(schema)
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface typeCodec<S extends Top> extends
  Bottom<
    S["Type"],
    S["Type"],
    never,
    never,
    S["IntrinsicContext"],
    S["ast"],
    typeCodec<S>,
    S["~annotate.in"],
    S["~make.in"]
  >
{}

/**
 * @since 4.0.0
 */
export function typeCodec<S extends Top>(schema: S): typeCodec<S> {
  return make<typeCodec<S>>(SchemaAST.typeAST(schema.ast))
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface encodedCodec<S extends Top> extends
  Bottom<
    S["Encoded"],
    S["Encoded"],
    never,
    never,
    S["IntrinsicContext"],
    SchemaAST.AST,
    encodedCodec<S>,
    SchemaAST.Annotations,
    S["~make.in"]
  >
{}

/**
 * @since 4.0.0
 */
export function encodedCodec<S extends Top>(schema: S): encodedCodec<S> {
  return make<encodedCodec<S>>(SchemaAST.encodedAST(schema.ast))
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface flip<S extends Top> extends
  Bottom<
    S["Encoded"],
    S["Type"],
    S["EncodingContext"],
    S["DecodingContext"],
    S["IntrinsicContext"],
    SchemaAST.AST,
    flip<S["~clone.out"]>,
    SchemaAST.Annotations,
    S["~internal.encoded.make.in"]
  >
{
  readonly "~internal.encoded.make.in": S["~make.in"]
}

/**
 * @since 4.0.0
 */
export const flip = <S extends Top>(schema: S): flip<S> => {
  return make<flip<S>>(SchemaAST.flip(schema.ast))
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface declare<T>
  extends Bottom<T, T, never, never, never, SchemaAST.Declaration, declare<T>, SchemaAST.Annotations, T>
{
  readonly "~internal.encoded.make.in": T
}

/**
 * @since 4.0.0
 */
export const declare = <T>(options: {
  readonly guard: (u: unknown) => u is T
}): declare<T> => {
  return make<declare<T>>(
    new SchemaAST.Declaration(
      [],
      () => (input) =>
        options.guard(input) ?
          Result.ok(input) :
          Result.err(new SchemaAST.InvalidIssue(O.some(input))),
      {},
      undefined,
      undefined,
      undefined
    )
  )
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface declareParserResult<T, E, RD, RE, RI>
  extends
    Bottom<T, E, RD, RE, RI, SchemaAST.Declaration, declareParserResult<T, E, RD, RE, RI>, SchemaAST.Annotations, T>
{
  readonly "~internal.encoded.make.in": E
}

type MergeTypeParametersParsingContexts<TypeParameters extends ReadonlyArray<Top>> = {
  readonly [K in keyof TypeParameters]: Codec<
    TypeParameters[K]["Type"],
    TypeParameters[K]["Encoded"],
    TypeParameters[K]["DecodingContext"] | TypeParameters[K]["EncodingContext"],
    TypeParameters[K]["DecodingContext"] | TypeParameters[K]["EncodingContext"],
    TypeParameters[K]["IntrinsicContext"]
  >
}

/**
 * @since 4.0.0
 */
export const declareParserResult =
  <const TypeParameters extends ReadonlyArray<Top>>(typeParameters: TypeParameters) =>
  <E>() =>
  <T, R>(
    decode: (typeParameters: MergeTypeParametersParsingContexts<TypeParameters>) => (
      u: unknown,
      self: SchemaAST.Declaration,
      options: SchemaAST.ParseOptions
    ) => SchemaParserResult.SchemaParserResult<T, R>
  ): declareParserResult<
    T,
    E,
    TypeParameters[number]["DecodingContext"],
    TypeParameters[number]["EncodingContext"],
    Exclude<R, TypeParameters[number]["DecodingContext"] | TypeParameters[number]["EncodingContext"]>
  > => {
    return make<
      declareParserResult<
        T,
        E,
        TypeParameters[number]["DecodingContext"],
        TypeParameters[number]["EncodingContext"],
        Exclude<R, TypeParameters[number]["DecodingContext"] | TypeParameters[number]["EncodingContext"]>
      >
    >(
      new SchemaAST.Declaration(
        typeParameters.map((tp) => tp.ast),
        (typeParameters) => decode(typeParameters.map(make) as any),
        {},
        undefined,
        undefined,
        undefined
      )
    )
  }

/**
 * Returns the underlying `Codec<T, E, RD, RE, RI>`.
 *
 * @since 4.0.0
 */
export function revealCodec<T, E, RD, RE, RI>(codec: Codec<T, E, RD, RE, RI>): Codec<T, E, RD, RE, RI> {
  return codec
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Literal<L extends SchemaAST.LiteralValue>
  extends Bottom<L, L, never, never, never, SchemaAST.Literal, Literal<L>, SchemaAST.Annotations, L>
{}

/**
 * @since 4.0.0
 */
export const Literal = <L extends SchemaAST.LiteralValue>(literal: L): Literal<L> =>
  make<Literal<L>>(new SchemaAST.Literal(literal, {}, undefined, undefined, undefined))

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Never
  extends Bottom<never, never, never, never, never, SchemaAST.NeverKeyword, Never, SchemaAST.Annotations, never>
{}

/**
 * @since 4.0.0
 */
export const Never: Never = make<Never>(SchemaAST.neverKeyword)

/**
 * @category api interface
 * @since 4.0.0
 */
export interface String
  extends Bottom<string, string, never, never, never, SchemaAST.StringKeyword, String, SchemaAST.Annotations, string>
{}

/**
 * @since 4.0.0
 */
export const String: String = make<String>(SchemaAST.stringKeyword)

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Number
  extends Bottom<number, number, never, never, never, SchemaAST.NumberKeyword, Number, SchemaAST.Annotations, number>
{}

/**
 * @since 4.0.0
 */
export const Number: Number = make<Number>(SchemaAST.numberKeyword)

/**
 * @since 4.0.0
 */
export declare namespace StructNs {
  /**
   * @since 4.0.0
   */
  export type Field = Top

  /**
   * @since 4.0.0
   */
  export type Fields = { readonly [x: PropertyKey]: Field }

  type TypeOptionalKeys<Fields extends StructNs.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~ctx.type.isOptional": "optional" } ? K
      : never
  }[keyof Fields]

  type TypeMutableKeys<Fields extends StructNs.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~ctx.type.isReadonly": "mutable" } ? K
      : never
  }[keyof Fields]

  type Type_<
    F extends Fields,
    O extends keyof F = TypeOptionalKeys<F>,
    M extends keyof F = TypeMutableKeys<F>
  > =
    & { readonly [K in Exclude<keyof F, M | O>]: F[K]["Type"] }
    & { readonly [K in Exclude<O, M>]?: F[K]["Type"] }
    & { [K in Exclude<M, O>]: F[K]["Type"] }
    & { [K in M & O]?: F[K]["Type"] }

  /**
   * @since 4.0.0
   */
  export type Type<F extends Fields> = Simplify<Type_<F>>

  type EncodedOptionalKeys<Fields extends StructNs.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~ctx.encoded.isOptional": "optional" } ? K
      : never
  }[keyof Fields]

  type EncodedMutableKeys<Fields extends StructNs.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~ctx.encoded.isReadonly": "mutable" } ? K
      : never
  }[keyof Fields]

  type EncodedFromKey<F extends Fields, K extends keyof F> = [K] extends [never] ? never :
    F[K] extends { readonly "~ctx.encoded.key": infer EncodedKey extends PropertyKey } ?
      [EncodedKey] extends [never] ? K : [PropertyKey] extends [EncodedKey] ? K : EncodedKey :
    K

  type Encoded_<
    F extends Fields,
    O extends keyof F = EncodedOptionalKeys<F>,
    M extends keyof F = EncodedMutableKeys<F>
  > =
    & { readonly [K in Exclude<keyof F, M | O> as EncodedFromKey<F, K>]: F[K]["Encoded"] }
    & { readonly [K in Exclude<O, M> as EncodedFromKey<F, K>]?: F[K]["Encoded"] }
    & { [K in Exclude<M, O> as EncodedFromKey<F, K>]: F[K]["Encoded"] }
    & { [K in M & O as EncodedFromKey<F, K>]?: F[K]["Encoded"] }

  /**
   * @since 4.0.0
   */
  export type Encoded<F extends Fields> = Simplify<Encoded_<F>>

  /**
   * @since 4.0.0
   */
  export type DecodingContext<F extends Fields> = { readonly [K in keyof F]: F[K]["DecodingContext"] }[keyof F]

  /**
   * @since 4.0.0
   */
  export type EncodingContext<F extends Fields> = { readonly [K in keyof F]: F[K]["EncodingContext"] }[keyof F]

  /**
   * @since 4.0.0
   */
  export type IntrinsicContext<F extends Fields> = { readonly [K in keyof F]: F[K]["IntrinsicContext"] }[keyof F]

  type TypeDefaultedKeys<Fields extends StructNs.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~ctx.type.constructor.default": "has-constructor-default" } ? K
      : never
  }[keyof Fields]

  type MakeIn_<
    F extends Fields,
    O = TypeOptionalKeys<F> | TypeDefaultedKeys<F>
  > =
    & { readonly [K in keyof F as K extends O ? never : K]: F[K]["~make.in"] }
    & { readonly [K in keyof F as K extends O ? K : never]?: F[K]["~make.in"] }

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
  Bottom<
    StructNs.Type<Fields>,
    StructNs.Encoded<Fields>,
    StructNs.DecodingContext<Fields>,
    StructNs.EncodingContext<Fields>,
    StructNs.IntrinsicContext<Fields>,
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

class Struct$<Fields extends StructNs.Fields> extends make$<Struct<Fields>> implements Struct<Fields> {
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
    undefined,
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
  export type Element = Top
  /**
   * @since 4.0.0
   */
  export type Elements = ReadonlyArray<Element>
  /**
   * @since 4.0.0
   */
  export type Type<E extends Elements> = { readonly [K in keyof E]: E[K]["Type"] }
  /**
   * @since 4.0.0
   */
  export type Encoded<E extends Elements> = { readonly [K in keyof E]: E[K]["Encoded"] }
  /**
   * @since 4.0.0
   */
  export type DecodingContext<E extends Elements> = E[number]["DecodingContext"]
  /**
   * @since 4.0.0
   */
  export type EncodingContext<E extends Elements> = E[number]["EncodingContext"]
  /**
   * @since 4.0.0
   */
  export type IntrinsicContext<E extends Elements> = E[number]["IntrinsicContext"]
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Tuple<Elements extends TupleNs.Elements> extends
  Bottom<
    TupleNs.Type<Elements>,
    TupleNs.Encoded<Elements>,
    TupleNs.DecodingContext<Elements>,
    TupleNs.EncodingContext<Elements>,
    TupleNs.IntrinsicContext<Elements>,
    SchemaAST.TupleType,
    Tuple<Elements>,
    AnnotationsNs.Annotations,
    { readonly [K in keyof Elements]: Elements[K]["~make.in"] }
  >
{
  readonly elements: Elements
}

class Tuple$<Elements extends TupleNs.Elements> extends make$<Tuple<Elements>> implements Tuple<Elements> {
  readonly elements: Elements
  constructor(ast: SchemaAST.TupleType, elements: Elements) {
    super(ast, (ast) => new Tuple$(ast, elements))
    this.elements = { ...elements }
  }
}

/**
 * @since 4.0.0
 */
export function Tuple<const Elements extends ReadonlyArray<Top>>(elements: Elements): Tuple<Elements> {
  return new Tuple$(
    new SchemaAST.TupleType(
      elements.map((element) => new SchemaAST.Element(element.ast, false, {})),
      [],
      {},
      undefined,
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
export interface Array<S extends Top> extends
  Bottom<
    ReadonlyArray<S["Type"]>,
    ReadonlyArray<S["Encoded"]>,
    S["DecodingContext"],
    S["EncodingContext"],
    S["IntrinsicContext"],
    SchemaAST.TupleType,
    Array<S>,
    AnnotationsNs.Annotations,
    ReadonlyArray<S["~make.in"]>
  >
{
  readonly item: S
}

class Array$<S extends Top> extends make$<Array<S>> implements Array<S> {
  readonly item: S
  constructor(ast: SchemaAST.TupleType, item: S) {
    super(ast, (ast) => new Array$(ast, item))
    this.item = item
  }
}

/**
 * @since 4.0.0
 */
export function Array<Item extends Top>(item: Item): Array<Item> {
  return new Array$(
    new SchemaAST.TupleType([], [item.ast], {}, undefined, undefined, undefined),
    item
  )
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface brand<S extends Top, B extends string | symbol> extends make<S> {
  readonly "Type": S["Type"] & Brand<B>
  readonly "~clone.out": brand<S["~clone.out"], B>
  readonly schema: S
  readonly brand: B
}

class brand$<S extends Top, B extends string | symbol> extends make$<brand<S, B>> implements brand<S, B> {
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
export const brand = <B extends string | symbol>(brand: B) => <Self extends Top>(self: Self): brand<Self, B> => {
  return new brand$(self, brand)
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface suspend<S extends Top> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
    S["IntrinsicContext"],
    SchemaAST.Suspend,
    suspend<S>,
    S["~annotate.in"],
    S["~make.in"]
  >
{}

/**
 * @category constructors
 * @since 4.0.0
 */
export const suspend = <S extends Top>(f: () => S): suspend<S> =>
  make<suspend<S>>(
    new SchemaAST.Suspend(() => f().ast, {}, undefined, undefined, undefined)
  )

function toIssue(
  out: FilterOutSync,
  input: unknown
): SchemaAST.Issue | undefined {
  if (out === undefined) {
    return undefined
  }
  if (Predicate.isBoolean(out)) {
    return out ? undefined : new SchemaAST.InvalidIssue(O.some(input))
  }
  if (Predicate.isString(out)) {
    return new SchemaAST.InvalidIssue(O.some(input), out)
  }
  return out
}

type FilterOutSync = undefined | boolean | string | SchemaAST.Issue

/**
 * @category filtering
 * @since 4.0.0
 */
export const filter = <S extends Top>(
  filter: (type: S["Type"], options: SchemaAST.ParseOptions) => FilterOutSync,
  annotations?: AnnotationsNs.Annotations<S["Type"]>
): (self: S) => S["~clone.out"] => {
  return filterGroup([{ filter, annotations }])
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface filterEffect<S extends Top, R> extends make<S> {
  readonly "~clone.out": filterEffect<S, R>
  readonly "IntrinsicContext": S["IntrinsicContext"] | R
}

/**
 * @category filtering
 * @since 4.0.0
 */
export const filterEffect = <S extends Top, R>(
  filter: (type: S["Type"], options: SchemaAST.ParseOptions) => Effect.Effect<FilterOutSync, never, R>,
  annotations?: AnnotationsNs.Annotations<S["Type"]>
) =>
(self: S): filterEffect<S, R> => {
  return make<filterEffect<S, R>>(
    SchemaAST.filter(
      self.ast,
      new SchemaAST.Filter(
        (input, options) => Effect.map(filter(input, options), (out) => toIssue(out, input)),
        annotations
      )
    )
  )
}

/**
 * @category filtering
 * @since 4.0.0
 */
export const filterGroup = <S extends Top>(
  filters: ReadonlyArray<{
    filter: (type: S["Type"], options: SchemaAST.ParseOptions) => FilterOutSync
    annotations?: AnnotationsNs.Annotations<S["Type"]> | undefined
  }>
) =>
(self: S): S["~clone.out"] => {
  return self.clone(
    SchemaAST.filterGroup(
      self.ast,
      filters.map((f) =>
        new SchemaAST.Filter(
          (input, options) => toIssue(f.filter(input, options), input),
          f.annotations
        )
      )
    )
  )
}

/**
 * @category filtering
 * @since 4.0.0
 */
export const filterEncoded = <S extends Top>(
  filter: (encoded: S["Encoded"], options: SchemaAST.ParseOptions) => FilterOutSync,
  annotations?: AnnotationsNs.Annotations<S["Encoded"]>
) =>
(self: S): S["~clone.out"] => {
  return self.clone(
    SchemaAST.filterEncoded(
      self.ast,
      new SchemaAST.Filter(
        (input, options) => toIssue(filter(input, options), input),
        annotations
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
  return <S extends Schema<T>>(self: S) =>
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
    return <S extends Schema<T>>(self: S) =>
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
export const decodeTo = <From extends Top, To extends Top, RD, RE>(
  to: To,
  transformation: SchemaAST.Transformation<From["Type"], NoInfer<To["Encoded"]>, RD, RE>
) =>
(from: From): encodeTo<To, From, RD, RE> => {
  return make<encodeTo<To, From, RD, RE>>(SchemaAST.decodeTo(
    from.ast,
    to.ast,
    transformation
  ))
}

/**
 * @since 4.0.0
 */
export const decode = <S extends Top, RD, RE>(
  transformation: SchemaAST.Transformation<S["Type"], S["Type"], RD, RE>
) =>
(self: S): encodeTo<typeCodec<S>, S, RD, RE> => {
  return self.pipe(decodeTo(typeCodec(self), transformation))
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface encodeTo<From extends Top, To extends Top, RD, RE> extends
  Bottom<
    From["Type"],
    To["Encoded"],
    From["DecodingContext"] | To["DecodingContext"] | RD,
    From["EncodingContext"] | To["EncodingContext"] | RE,
    From["IntrinsicContext"] | To["IntrinsicContext"],
    From["ast"],
    encodeTo<From, To, RD, RE>,
    From["~annotate.in"],
    From["~make.in"],
    From["~ctx.type.isReadonly"],
    From["~ctx.type.isOptional"],
    From["~ctx.type.constructor.default"],
    To["~ctx.encoded.isReadonly"],
    To["~ctx.encoded.isOptional"],
    To["~ctx.encoded.key"]
  >
{}

/**
 * @since 4.0.0
 */
export const encodeTo = <From extends Top, To extends Top, RD, RE>(
  to: To,
  transformation: SchemaAST.Transformation<NoInfer<To["Type"]>, From["Encoded"], RD, RE>
) =>
(from: From): encodeTo<From, To, RD, RE> => {
  return to.pipe(decodeTo(from, transformation))
}

/**
 * @since 4.0.0
 */
export const encode = <S extends Top, RD, RE>(
  transformation: SchemaAST.Transformation<S["Encoded"], S["Encoded"], RD, RE>
) =>
(self: S): encodeTo<S, encodedCodec<S>, RD, RE> => {
  return self.pipe(encodeTo(encodedCodec(self), transformation))
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface encodedKey<S extends Top, K extends PropertyKey> extends make<S> {
  readonly "~clone.out": encodedKey<S, K>
  readonly "~ctx.encoded.key": K
}

/**
 * @since 4.0.0
 */
export const encodedKey = <K extends PropertyKey>(key: K) => <S extends Top>(self: S): encodedKey<S, K> => {
  return make<encodedKey<S, K>>(SchemaAST.encodedKey(self.ast, key))
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface withConstructorDefault<S extends Top> extends make<S> {
  readonly "~clone.out": withConstructorDefault<S>
  readonly "~ctx.type.constructor.default": "has-constructor-default"
}

/**
 * @since 4.0.0
 */
export const withConstructorDefault =
  <S extends Top & { readonly "~ctx.type.constructor.default": "no-constructor-default" }>(
    value: (() => unknown) | Effect.Effect<unknown>
  ) =>
  (self: S): withConstructorDefault<S> => {
    return make<withConstructorDefault<S>>(SchemaAST.withConstructorDefault(self.ast, value))
  }

/**
 * @category api interface
 * @since 4.0.0
 */
export interface encodeOptionalToRequired<From extends Top, To extends Top, RD, RE> extends
  Bottom<
    From["Type"],
    To["Encoded"],
    From["DecodingContext"] | To["DecodingContext"] | RD,
    From["EncodingContext"] | To["EncodingContext"] | RE,
    From["IntrinsicContext"] | To["IntrinsicContext"],
    From["ast"],
    encodeOptionalToRequired<From, To, RD, RE>,
    From["~annotate.in"],
    From["~make.in"],
    From["~ctx.type.isReadonly"],
    From["~ctx.type.isOptional"],
    From["~ctx.type.constructor.default"],
    To["~ctx.encoded.isReadonly"],
    "required",
    To["~ctx.encoded.key"]
  >
{}

/**
 * @since 4.0.0
 */
export const encodeOptionalToRequired = <
  From extends Top & { readonly "~ctx.encoded.isOptional": "optional" },
  To extends Top & { readonly "~ctx.type.isOptional": "required" },
  RD,
  RE
>(
  to: To,
  transformation: SchemaAST.PartialIso<To["Type"], O.Option<From["Encoded"]>, RD, RE>
) =>
(from: From): encodeOptionalToRequired<From, To, RD, RE> => {
  return make<encodeOptionalToRequired<From, To, RD, RE>>(
    SchemaAST.encodeOptionalToRequired(
      from.ast,
      new SchemaAST.PartialIso<O.Option<To["Type"]>, O.Option<From["Encoded"]>, RD, RE>(
        (o, options) => {
          if (O.isNone(o)) {
            return Result.err(SchemaAST.MissingPropertyKeyIssue.instance)
          }
          return transformation.decode(o.value, options)
        },
        (o, options) => SchemaParserResult.map(transformation.encode(o, options), O.some),
        transformation.annotations
      ),
      to.ast
    )
  )
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface encodeRequiredToOptional<From extends Top, To extends Top, RD, RE> extends
  Bottom<
    From["Type"],
    To["Encoded"],
    From["DecodingContext"] | To["DecodingContext"] | RD,
    From["EncodingContext"] | To["EncodingContext"] | RE,
    From["IntrinsicContext"] | To["IntrinsicContext"],
    From["ast"],
    encodeRequiredToOptional<From, To, RD, RE>,
    From["~annotate.in"],
    From["~make.in"],
    From["~ctx.type.isReadonly"],
    From["~ctx.type.isOptional"],
    From["~ctx.type.constructor.default"],
    To["~ctx.encoded.isReadonly"],
    "optional",
    To["~ctx.encoded.key"]
  >
{}

/**
 * @since 4.0.0
 */
export const encodeRequiredToOptional = <
  From extends Top & { readonly "~ctx.encoded.isOptional": "required" },
  To extends Top & { readonly "~ctx.type.isOptional": "required" },
  RD,
  RE
>(
  to: To,
  transformation: SchemaAST.PartialIso<O.Option<To["Type"]>, From["Encoded"], RD, RE>
) =>
(from: From): encodeRequiredToOptional<From, To, RD, RE> => {
  return make<encodeRequiredToOptional<From, To, RD, RE>>(
    SchemaAST.encodeRequiredToOptional(
      from.ast,
      new SchemaAST.PartialIso<O.Option<To["Type"]>, O.Option<From["Encoded"]>, RD, RE>(
        (o, options) => SchemaParserResult.map(transformation.decode(o, options), O.some),
        (o, options) => {
          if (O.isNone(o)) {
            return Result.err(SchemaAST.MissingPropertyKeyIssue.instance)
          }
          return transformation.encode(o.value, options)
        },
        transformation.annotations
      ),
      to.ast
    )
  )
}

/**
 * @category Transformations
 * @since 4.0.0
 */
export const identity = <T>(): SchemaAST.PartialIso<T, T, never, never> =>
  new SchemaAST.PartialIso(
    Result.ok,
    Result.ok,
    { title: "identity" }
  )

/**
 * @category Transformations
 * @since 4.0.0
 */
export const tapTransformation = <E, T, RD, RE>(
  transformation: SchemaAST.PartialIso<E, T, RD, RE>,
  options: {
    onDecode?: (input: E, options: SchemaAST.ParseOptions) => void
    onEncode?: (input: T, options: SchemaAST.ParseOptions) => void
  }
): SchemaAST.PartialIso<E, T, RD, RE> => {
  const onDecode = options.onDecode ?? Function.identity
  const onEncode = options.onEncode ?? Function.identity
  return new SchemaAST.PartialIso(
    (input, options) => {
      onDecode(input, options)
      const output = transformation.decode(input, options)
      return output
    },
    (input, options) => {
      onEncode(input, options)
      const output = transformation.encode(input, options)
      return output
    },
    transformation.annotations
  )
}

/**
 * @category Transformations
 * @since 4.0.0
 */
export const trim: SchemaAST.Transformation<string, string, never, never> = new SchemaAST.Transformation(
  (os) => {
    if (O.isNone(os)) {
      return Result.none
    }
    return Result.ok(O.some(os.value.trim()))
  },
  Result.ok,
  { title: "trim" }
)

/**
 * @category api interface
 * @since 3.10.0
 */
export interface parseNumber<S extends Codec<string, any, any, any, any>> extends encodeTo<Number, S, never, never> {}

/**
 * @category String transformations
 * @since 4.0.0
 */
export const parseNumber: SchemaAST.Transformation<string, number, never, never> = new SchemaAST.Transformation(
  (os) => {
    if (O.isNone(os)) {
      return Result.none
    }
    const s = os.value
    const n = globalThis.Number(s)
    return isNaN(n)
      ? Result.err(new SchemaAST.InvalidIssue(O.some(s), `Cannot convert "${s}" to a number`))
      : Result.ok(O.some(n))
  },
  (on) => {
    if (O.isNone(on)) {
      return Result.none
    }
    const n = on.value
    return Result.ok(O.some(globalThis.String(n)))
  },
  { title: "parseNumber" }
)

/**
 * @category String transformations
 * @since 4.0.0
 */
export const NumberFromString = String.pipe(decodeTo(Number, parseNumber))

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Class<Self, S extends Top, Inherited> extends
  Bottom<
    Self,
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
    S["IntrinsicContext"],
    S["ast"],
    Class<Self, S["~clone.out"], Self>,
    S["~annotate.in"],
    S["~make.in"],
    S["~ctx.type.isReadonly"],
    S["~ctx.type.isOptional"],
    S["~ctx.type.constructor.default"],
    S["~ctx.encoded.isReadonly"],
    S["~ctx.encoded.isOptional"],
    S["~ctx.encoded.key"]
  >
{
  new(props: S["~make.in"]): S["Type"] & Inherited
  readonly identifier: string
  readonly schema: S
}

function makeClass<Self, S extends Top, Inherited extends new(...args: ReadonlyArray<any>) => any>(
  Inherited: Inherited,
  identifier: string,
  schema: S,
  computeAST: (self: Class<Self, S, Inherited>) => SchemaAST.AST
): any {
  let astMemo: SchemaAST.AST | undefined = undefined

  return class Class$ extends Inherited implements Class<Self, S, Inherited> {
    static readonly "~effect/Schema" = "~effect/Schema"

    declare static readonly "Type": Self
    declare static readonly "Encoded": S["Encoded"]
    declare static readonly "DecodingContext": S["DecodingContext"]
    declare static readonly "EncodingContext": S["EncodingContext"]
    declare static readonly "IntrinsicContext": S["IntrinsicContext"]

    declare static readonly "~clone.out": Class<Self, S["~clone.out"], Self>
    declare static readonly "~annotate.in": S["~annotate.in"]
    declare static readonly "~make.in": S["~make.in"]

    declare static readonly "~ctx.type.isReadonly": S["~ctx.type.isReadonly"]
    declare static readonly "~ctx.type.isOptional": S["~ctx.type.isOptional"]
    declare static readonly "~ctx.type.constructor.default": S["~ctx.type.constructor.default"]

    declare static readonly "~ctx.encoded.isReadonly": S["~ctx.encoded.isReadonly"]
    declare static readonly "~ctx.encoded.key": S["~ctx.encoded.key"]
    declare static readonly "~ctx.encoded.isOptional": S["~ctx.encoded.isOptional"]

    declare static readonly "~internal.encoded.make.in": S["~internal.encoded.make.in"]

    static readonly identifier = identifier
    static readonly schema = schema

    static get ast(): S["ast"] {
      if (astMemo === undefined) {
        astMemo = computeAST(this)
      }
      return astMemo
    }
    static pipe() {
      return pipeArguments(this, arguments)
    }
    static clone(ast: S["ast"]): Class<Self, S["~clone.out"], Self> {
      return makeClass(this as any, identifier, schema.clone(ast), () => ast)
    }
    static annotate(annotations: AnnotationsNs.Annotations): Class<Self, S["~clone.out"], Self> {
      return this.clone(SchemaAST.annotate(this.ast, annotations))
    }
    static makeUnsafe(input: S["~make.in"]): Self {
      return new this(input)
    }
    static toString() {
      return `${this.ast}`
    }
  }
}

// A helper that creates the default ctor callback for both Class and TaggedError
function defaultCtorCallback<S extends Top>(
  schema: S,
  annotations?: AnnotationsNs.Annotations
) {
  return (self: any) =>
    SchemaAST.appendCtor(
      schema.ast,
      new SchemaAST.Ctor(
        self,
        self.identifier,
        (input) => {
          if (!(input instanceof self)) {
            return Result.err(new SchemaAST.MismatchIssue(schema.ast, input))
          }
          return Result.ok(input)
        },
        (input) => Result.ok(new self(input)),
        annotations
      )
    )
}

/**
 * @category model
 * @since 4.0.0
 */
export const Class: {
  <Self>(identifier: string): {
    <Fields extends StructNs.Fields>(
      fields: Fields,
      annotations?: AnnotationsNs.Annotations
    ): Class<Self, Struct<Fields>, {}>
    <S extends Top>(schema: S, annotations?: AnnotationsNs.Annotations): Class<Self, S, {}>
  }
} =
  <Self>(identifier: string) =>
  <S extends Top>(schema: S, annotations?: AnnotationsNs.Annotations): Class<Self, S, {}> => {
    schema = isSchema(schema) ? schema : Struct(schema) as any as S
    const ctor = schema.ast.modifiers?.modifiers.findLast((r) => r._tag === "Ctor")?.ctor

    const Inherited = ctor ?
      ctor :
      Data.Class

    return makeClass(Inherited, identifier, schema, defaultCtorCallback(schema, annotations))
  }

/**
 * @category api interface
 * @since 4.0.0
 */
export interface TaggedError<Self, Tag extends string, S extends Top, Inherited> extends Class<Self, S, Inherited> {
  readonly "Encoded": Simplify<S["Encoded"] & { readonly _tag: Tag }>
  readonly "~clone.out": TaggedError<Self, Tag, S["~clone.out"], Self>
  readonly "~internal.encoded.make.in": Simplify<S["~internal.encoded.make.in"] & { readonly _tag: Tag }>
  readonly _tag: Tag
}

/**
 * @category model
 * @since 4.0.0
 */
export const TaggedError: {
  <Self>(identifier?: string): {
    <Tag extends string, Fields extends StructNs.Fields>(
      tag: Tag,
      fields: Fields,
      annotations?: AnnotationsNs.Annotations
    ): TaggedError<Self, Tag, Struct<Fields>, Cause.YieldableError & { readonly _tag: Tag }>
    <Tag extends string, S extends Top>(
      tag: Tag,
      schema: S,
      annotations?: AnnotationsNs.Annotations
    ): TaggedError<Self, Tag, S, Cause.YieldableError & { readonly _tag: Tag }>
  }
} = <Self>(identifier?: string) =>
<Tag extends string, S extends Top>(
  tag: Tag,
  schema: S,
  annotations?: AnnotationsNs.Annotations
): TaggedError<Self, Tag, S, Cause.YieldableError & { readonly _tag: Tag }> => {
  identifier = identifier ?? tag
  schema = isSchema(schema) ? schema : Struct(schema) as any as S
  const ctor = schema.ast.modifiers?.modifiers.findLast((r) => r._tag === "Ctor")?.ctor

  const Inherited = ctor ?
    ctor :
    core.TaggedError(tag)

  class TaggedError$ extends Inherited {
    static readonly _tag = tag
    get message(): string {
      return formatUnknown({ ...this })
    }
    toString() {
      return `${identifier}(${this.message})`
    }
  }

  return makeClass(TaggedError$, identifier, schema, defaultCtorCallback(schema, annotations))
}

/**
 * @since 4.0.0
 */
export const File = declare({ guard: (u) => u instanceof globalThis.File })

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Option<S extends Top> extends
  declareParserResult<
    O.Option<S["Type"]>,
    O.Option<S["Encoded"]>,
    S["DecodingContext"],
    S["EncodingContext"],
    S["IntrinsicContext"]
  >
{}

/**
 * @since 4.0.0
 */
export const Option = <S extends Top>(value: S): Option<S> => {
  return declareParserResult([value])<O.Option<S["Encoded"]>>()(
    ([value]) => (oinput, ast, options) => {
      if (O.isOption(oinput)) {
        if (O.isNone(oinput)) {
          return Result.ok(oinput)
        }
        const input = oinput.value
        return SchemaParserResult.mapBoth(
          SchemaParser.decodeUnknownParserResult(value)(input, options),
          {
            onSuccess: (value) => O.some(value),
            onFailure: (issue) => new SchemaAST.CompositeIssue(ast, input, [issue], oinput)
          }
        )
      }
      return Result.err(new SchemaAST.MismatchIssue(ast, oinput))
    }
  )
}
