/**
 * @since 4.0.0
 */

import type { Brand } from "./Brand.js"
import type * as Effect from "./Effect.js"
import type { Equivalence } from "./Equivalence.js"
import type * as FastCheck from "./FastCheck.js"
import * as Function from "./Function.js"
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
  readonly "~effect/Schema": "~effect/Schema"
  readonly Type: T
  readonly Encoded: E
  readonly DecodingContext: RD
  readonly EncodingContext: RE
  readonly IntrinsicContext: RI
  readonly ast: Ast

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
  makeUnsafe(input: this["~make.in"]): T
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
  readonly Type!: T
  readonly Encoded!: E
  readonly DecodingContext!: RD
  readonly EncodingContext!: RE
  readonly IntrinsicContext!: RI

  readonly "~clone.out": CloneOut
  readonly "~annotate.in": AnnotateIn
  readonly "~make.in": MakeIn

  readonly "~ctx.type.isReadonly": TypeReadonly
  readonly "~ctx.type.isOptional": TypeIsOptional
  readonly "~ctx.type.constructor.default": TypeDefault

  readonly "~ctx.encoded.isReadonly": EncodedIsReadonly
  readonly "~ctx.encoded.isOptional": EncodedIsOptional
  readonly "~ctx.encoded.key": EncodedKey

  readonly "~internal.encoded.make.in": E

  constructor(readonly ast: Ast) {
    this.makeUnsafe = this.makeUnsafe.bind(this)
  }
  abstract clone(ast: this["ast"]): this["~clone.out"]
  pipe() {
    return pipeArguments(this, arguments)
  }
  makeUnsafe(input: this["~make.in"]): T {
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
export interface Codec<out T, out E = T, out RD = never, out RE = never, out RI = never> extends Top {
  readonly Type: T
  readonly Encoded: E
  readonly DecodingContext: RD
  readonly EncodingContext: RE
  readonly IntrinsicContext: RI
}

/**
 * @category model
 * @since 4.0.0
 */
export interface Schema<out T> extends Codec<T, unknown, unknown, unknown, unknown> {}

class Schema$<S extends Top> extends Bottom$<
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
 * @category API interface
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
{
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function make<S extends Top>(ast: S["ast"]): make<S> {
  const clone = (ast: SchemaAST.AST) => new Schema$<S>(ast, clone)
  return new Schema$<S>(ast, clone)
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
export interface optional<S extends Top> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
    S["IntrinsicContext"],
    S["ast"],
    optional<S["~clone.out"]>,
    S["~annotate.in"],
    S["~make.in"],
    S["~ctx.type.isReadonly"],
    "optional",
    S["~ctx.type.constructor.default"],
    S["~ctx.encoded.isReadonly"],
    "optional",
    S["~ctx.encoded.key"]
  >
{
  readonly schema: S
}

class optional$<S extends Top> extends Schema$<optional<S>> implements optional<S> {
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
export function optional<S extends Top>(
  schema: S
): optional<S> {
  return new optional$(schema)
}

/**
 * @since 4.0.0
 */
export interface mutable<S extends Top> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
    S["IntrinsicContext"],
    S["ast"],
    mutable<S["~clone.out"]>,
    S["~annotate.in"],
    S["~make.in"],
    "mutable",
    S["~ctx.type.isOptional"],
    S["~ctx.type.constructor.default"],
    "mutable",
    S["~ctx.encoded.isOptional"],
    S["~ctx.encoded.key"]
  >
{
  readonly schema: S
}

class mutable$<S extends Top> extends Schema$<mutable<S>> implements mutable<S> {
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
export function mutable<S extends Top>(
  schema: S
): mutable<S> {
  return new mutable$(schema)
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
    S["DecodingContext"],
    S["EncodingContext"],
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
export interface flip<S extends Top>
  extends make<Codec<S["Encoded"], S["Type"], S["EncodingContext"], S["DecodingContext"], S["IntrinsicContext"]>>
{
  readonly "~clone.out": flip<S["~clone.out"]>
  readonly "~make.in": S["~internal.encoded.make.in"]
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
export interface declareResult<T, E, RD, RE, RI>
  extends Bottom<T, E, RD, RE, RI, SchemaAST.Declaration, declareResult<T, E, RD, RE, RI>, SchemaAST.Annotations, T>
{
  readonly "~internal.encoded.make.in": E
}

/**
 * @since 4.0.0
 */
export const declareResult = <
  const T,
  E,
  TypeParameters extends ReadonlyArray<Top>,
  R
>(options: {
  readonly typeParameters: TypeParameters
  readonly decode: (
    typeParameters: { readonly [K in keyof TypeParameters]: TypeParameters[K] }
  ) => (u: unknown, self: SchemaAST.Declaration, options: SchemaAST.ParseOptions) => SchemaParser.ParserResult<T, R>
}): declareResult<
  T,
  E,
  TypeParameters[number]["DecodingContext"],
  TypeParameters[number]["EncodingContext"],
  | TypeParameters[number]["IntrinsicContext"]
  | R
> => {
  return make<
    declareResult<
      T,
      E,
      TypeParameters[number]["DecodingContext"],
      TypeParameters[number]["EncodingContext"],
      | TypeParameters[number]["IntrinsicContext"]
      | R
    >
  >(
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
 * Returns the underlying `Codec<T, E, RD, RE, RI>`.
 *
 * @since 4.0.0
 */
export function revealCodec<T, E, RD, RE, RI>(schema: Codec<T, E, RD, RE, RI>): Codec<T, E, RD, RE, RI> {
  return schema
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Literal<L extends SchemaAST.LiteralValue>
  extends make<Bottom<L, L, never, never, never, SchemaAST.Literal, Literal<L>, SchemaAST.Annotations, L>>
{}

/**
 * @since 4.0.0
 */
export const Literal = <L extends SchemaAST.LiteralValue>(literal: L): Literal<L> =>
  make<Literal<L>>(new SchemaAST.Literal(literal, {}, [], undefined, undefined))

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Never
  extends make<Bottom<never, never, never, never, never, SchemaAST.NeverKeyword, Never, SchemaAST.Annotations, never>>
{}

/**
 * @since 4.0.0
 */
export const Never: Never = make<Never>(SchemaAST.neverKeyword)

/**
 * @category api interface
 * @since 4.0.0
 */
export interface String extends
  make<
    Bottom<string, string, never, never, never, SchemaAST.StringKeyword, String, SchemaAST.Annotations, string>
  >
{}

/**
 * @since 4.0.0
 */
export const String: String = make<String>(SchemaAST.stringKeyword)

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Number extends
  make<
    Bottom<number, number, never, never, never, SchemaAST.NumberKeyword, Number, SchemaAST.Annotations, number>
  >
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
export function Tuple<const Elements extends ReadonlyArray<Top>>(elements: Elements): Tuple<Elements> {
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

class Array$<S extends Top> extends Schema$<Array<S>> implements Array<S> {
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
    new SchemaAST.TupleType([], [item.ast], {}, [], undefined, undefined),
    item
  )
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface brand<S extends Top, B extends string | symbol> extends
  Bottom<
    S["Type"] & Brand<B>,
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
    S["IntrinsicContext"],
    S["ast"],
    brand<S["~clone.out"], B>,
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
  readonly schema: S
  readonly brand: B
}

class brand$<S extends Top, B extends string | symbol> extends Schema$<brand<S, B>> implements brand<S, B> {
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
export interface suspend<T, E, RD, RE, RI> extends
  Bottom<
    T,
    E,
    RD,
    RE,
    RI,
    SchemaAST.Suspend,
    suspend<T, E, RD, RE, RI>,
    SchemaAST.Annotations,
    T
  >
{}

/**
 * @category constructors
 * @since 4.0.0
 */
export const suspend = <T, E = T, RD = never, RE = never, RI = never>(
  f: () => Codec<T, E, RD, RE, RI>
): suspend<T, E, RD, RE, RI> =>
  make<suspend<T, E, RD, RE, RI>>(new SchemaAST.Suspend(() => f().ast, {}, [], undefined, undefined))

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
export const filter = <S extends Top>(
  filter: (type: S["Type"], options: SchemaAST.ParseOptions) => FilterOut,
  annotations?: AnnotationsNs.Annotations<S["Type"]>
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
export const filterEncoded = <S extends Top>(
  filter: (encoded: S["Encoded"], options: SchemaAST.ParseOptions) => FilterOut,
  annotations?: AnnotationsNs.Annotations<S["Encoded"]>
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
export const decodeTo = <From extends Top, To extends Top>(
  to: To,
  transformation: SchemaAST.SymmetricTransformation<To["Encoded"], From["Type"]>
) =>
(from: From): encodeTo<To, From> => {
  return from.clone(SchemaAST.decodeTo(from.ast, to.ast, transformation))
}

/**
 * @since 4.0.0
 */
export const decode = <S extends Top>(
  transformation: SchemaAST.SymmetricTransformation<S["Type"], S["Type"]>
) =>
(self: S) => {
  return self.pipe(decodeTo(typeCodec(self), transformation))
}

/**
 * @category API interface
 * @since 4.0.0
 */
export interface encodeTo<From extends Top, To extends Top> extends
  Bottom<
    From["Type"],
    To["Encoded"],
    From["DecodingContext"] | To["DecodingContext"],
    From["EncodingContext"] | To["EncodingContext"],
    From["IntrinsicContext"] | To["IntrinsicContext"],
    From["ast"],
    encodeTo<From, To>,
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
export const encodeTo = <From extends Top, To extends Top>(
  to: To,
  transformation: SchemaAST.SymmetricTransformation<From["Encoded"], To["Type"]>
) =>
(from: From): encodeTo<From, To> => {
  return to.pipe(decodeTo(from, transformation))
}

/**
 * @since 4.0.0
 */
export const encode = <S extends Top>(
  transformation: SchemaAST.SymmetricTransformation<S["Encoded"], S["Encoded"]>
) =>
(self: S): encodeTo<S, S> => {
  return self.pipe(encodeTo(self, transformation))
}

/**
 * @category API interface
 * @since 4.0.0
 */
export interface encodeToKey<S extends Top, K extends PropertyKey> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
    S["IntrinsicContext"],
    S["ast"],
    encodeToKey<S, K>,
    S["~annotate.in"],
    S["~make.in"],
    S["~ctx.type.isReadonly"],
    S["~ctx.type.isOptional"],
    S["~ctx.type.constructor.default"],
    S["~ctx.encoded.isReadonly"],
    S["~ctx.encoded.isOptional"],
    K
  >
{}

/**
 * @since 4.0.0
 */
export const encodeToKey = <K extends PropertyKey>(key: K) => <S extends Top>(self: S): encodeToKey<S, K> => {
  return make<encodeToKey<S, K>>(SchemaAST.encodeToKey(self.ast, key))
}

/**
 * @category API interface
 * @since 4.0.0
 */
export interface withConstructorDefault<S extends Top> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
    S["IntrinsicContext"],
    S["ast"],
    withConstructorDefault<S>,
    S["~annotate.in"],
    S["~make.in"],
    S["~ctx.type.isReadonly"],
    S["~ctx.type.isOptional"],
    "has-constructor-default",
    S["~ctx.encoded.isReadonly"],
    S["~ctx.encoded.isOptional"],
    S["~ctx.encoded.key"]
  >
{}

/**
 * @since 4.0.0
 */
export const withConstructorDefault =
  <S extends Top & { readonly "~ctx.type.constructor.default": "no-constructor-default" }>(
    value: Option.Option<S["Type"]> | Effect.Effect<S["Type"]>
  ) =>
  (self: S): withConstructorDefault<S> => {
    return make<withConstructorDefault<S>>(SchemaAST.withConstructorDefault(self.ast, value))
  }

/**
 * @category API interface
 * @since 4.0.0
 */
export interface encodeOptionalToRequired<From extends Top, To extends Top> extends
  Bottom<
    From["Type"],
    To["Encoded"],
    From["DecodingContext"] | To["DecodingContext"],
    From["EncodingContext"] | To["EncodingContext"],
    From["IntrinsicContext"] | To["IntrinsicContext"],
    From["ast"],
    encodeOptionalToRequired<From, To>,
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
  To extends Top & { readonly "~ctx.type.isOptional": "required" }
>(
  to: To,
  transformations: {
    readonly encode: (input: Option.Option<From["Encoded"]>) => To["Type"]
    readonly decode: (input: To["Type"]) => Option.Option<From["Encoded"]>
  }
) =>
(from: From): encodeOptionalToRequired<From, To> => {
  return make<encodeOptionalToRequired<From, To>>(
    SchemaAST.encodeOptionalToRequired(from.ast, transformations, to.ast)
  )
}

/**
 * @category API interface
 * @since 4.0.0
 */
export interface encodeRequiredToOptional<From extends Top, To extends Top> extends
  Bottom<
    From["Type"],
    To["Encoded"],
    From["DecodingContext"] | To["DecodingContext"],
    From["EncodingContext"] | To["EncodingContext"],
    From["IntrinsicContext"] | To["IntrinsicContext"],
    From["ast"],
    encodeRequiredToOptional<From, To>,
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
  To extends Top & { readonly "~ctx.type.isOptional": "required" }
>(
  to: To,
  transformations: {
    readonly encode: (input: From["Encoded"]) => Option.Option<To["Type"]>
    readonly decode: (input: Option.Option<To["Type"]>) => From["Encoded"]
  }
) =>
(from: From): encodeRequiredToOptional<From, To> => {
  return make<encodeRequiredToOptional<From, To>>(
    SchemaAST.encodeRequiredToOptional(from.ast, transformations, to.ast)
  )
}

/**
 * @category Transformations
 * @since 4.0.0
 */
export const identity = <T>(): SchemaAST.SymmetricTransformation<T, T> =>
  new SchemaAST.Transformation(
    Result.ok,
    Result.ok,
    { title: "identity" }
  )

/**
 * @category Transformations
 * @since 4.0.0
 */
export const tapTransformation = <T, E>(
  transformation: SchemaAST.SymmetricTransformation<T, E>,
  options: {
    onDecode?: (
      input: E,
      output: SchemaParser.ParserResult<T, SchemaAST.Issue>,
      options: SchemaAST.ParseOptions
    ) => void
    onEncode?: (
      input: T,
      output: SchemaParser.ParserResult<E, SchemaAST.Issue>,
      options: SchemaAST.ParseOptions
    ) => void
  }
): SchemaAST.SymmetricTransformation<T, E> => {
  const onDecode = options.onDecode ?? Function.identity
  const onEncode = options.onEncode ?? Function.identity
  return new SchemaAST.Transformation(
    (input, options) => {
      const output = transformation.decode(input, options)
      onDecode(input, output, options)
      return output
    },
    (input, options) => {
      const output = transformation.encode(input, options)
      onEncode(input, output, options)
      return output
    },
    transformation.annotations
  )
}

/**
 * @category Transformations
 * @since 4.0.0
 */
export const trim: SchemaAST.SymmetricTransformation<string, string> = new SchemaAST.Transformation(
  (input: string) => Result.ok(input.trim()),
  Result.ok,
  { title: "trim" }
)

/**
 * @category api interface
 * @since 3.10.0
 */
export interface parseNumber<S extends Codec<string, any, any, any, any>> extends encodeTo<Number, S> {}

/**
 * @category String transformations
 * @since 4.0.0
 */
export const parseNumber: SchemaAST.SymmetricTransformation<number, string> = new SchemaAST.Transformation(
  (s: string) => {
    const n = globalThis.Number(s)
    return isNaN(n)
      ? Result.err(new SchemaAST.InvalidIssue(Option.some(s), `Cannot convert "${s}" to a number`))
      : Result.ok(n)
  },
  (n: number) => Result.ok(globalThis.String(n)),
  { title: "parseNumber" }
)

/**
 * @category String transformations
 * @since 4.0.0
 */
export const NumberFromString = String.pipe(decodeTo(Number, parseNumber))

/**
 * @category api interface
 * @since 3.10.0
 */
export interface Class<Self, S extends Top> extends
  Bottom<
    Self,
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
    S["IntrinsicContext"],
    S["ast"],
    Bottom<
      Self,
      S["Encoded"],
      S["DecodingContext"],
      S["EncodingContext"],
      S["IntrinsicContext"],
      S["ast"],
      Class<Self, S>,
      S["~annotate.in"],
      S["~make.in"]
    >,
    S["~annotate.in"],
    S["~make.in"]
  >
{
  new(props: S["~make.in"]): S["Type"]
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
  <S extends Top>(schema: S, annotations?: AnnotationsNs.Annotations): Class<Self, S> => {
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
      static readonly Type: Class<Self, S>["Type"]
      static readonly Encoded: Class<Self, S>["Encoded"]
      static readonly DecodingContext: Class<Self, S>["DecodingContext"]
      static readonly EncodingContext: Class<Self, S>["EncodingContext"]
      static readonly IntrinsicContext: Class<Self, S>["IntrinsicContext"]

      static readonly "~clone.out": Class<Self, S>["~clone.out"]
      static readonly "~annotate.in": Class<Self, S>["~annotate.in"]
      static readonly "~make.in": Class<Self, S>["~make.in"]

      static readonly "~ctx.type.isReadonly": Class<Self, S>["~ctx.type.isReadonly"]
      static readonly "~ctx.type.isOptional": Class<Self, S>["~ctx.type.isOptional"]
      static readonly "~ctx.type.constructor.default": Class<Self, S>["~ctx.type.constructor.default"]

      static readonly "~ctx.encoded.isReadonly": Class<Self, S>["~ctx.encoded.isReadonly"]
      static readonly "~ctx.encoded.key": Class<Self, S>["~ctx.encoded.key"]
      static readonly "~ctx.encoded.isOptional": Class<Self, S>["~ctx.encoded.isOptional"]

      static readonly "~internal.encoded.make.in": Class<Self, S>["~internal.encoded.make.in"]

      static readonly identifier = identifier
      static readonly schema = schema

      static readonly "~effect/Schema" = "~effect/Schema"
      static get ast(): S["ast"] {
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
      static clone(ast: S["ast"]): Class<Self, S>["~clone.out"] {
        return make<Class<Self, S>["~clone.out"]>(ast)
      }
      static annotate(annotations: AnnotationsNs.Annotations): Class<Self, S>["~clone.out"] {
        return this.clone(SchemaAST.annotate(this.ast, annotations))
      }
      static makeUnsafe(input: S["~make.in"]): Self {
        return new this(input) as any
      }
      static toString() {
        return `${this.ast}`
      }
    }
  }

/**
 * @since 4.0.0
 */
export const File = declare({ guard: (u) => u instanceof globalThis.File })

/**
 * @category API interface
 * @since 4.0.0
 */
export interface option<S extends Top> extends
  declareResult<
    Option.Option<S["Type"]>,
    Option.Option<S["Encoded"]>,
    S["DecodingContext"],
    S["EncodingContext"],
    S["IntrinsicContext"]
  >
{}

const Option_ = <S extends Top>(schema: S): option<S> => {
  return declareResult<
    Option.Option<S["Type"]>,
    Option.Option<S["Encoded"]>,
    [S],
    S["IntrinsicContext"]
  >({
    typeParameters: [schema],
    decode: ([item]) => (oinput, ast, options) => {
      if (Option.isOption(oinput)) {
        if (Option.isNone(oinput)) {
          return Result.ok(oinput)
        }
        const input = oinput.value
        const result = SchemaParser.decodeUnknownParserResult(item)(input, options)
        if (Result.isResult(result)) {
          return Result.isErr(result)
            ? Result.err(new SchemaAST.CompositeIssue(ast, input, [result.err], Option.some(input)))
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
   * @since 4.0.0
   */
  Option_ as Option
}
