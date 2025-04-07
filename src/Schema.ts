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
type DefaultConstructorToken = "no-constructor-default" | "has-constructor-default"

/**
 * @category model
 * @since 4.0.0
 */
export interface AbstractSchema<
  T,
  E,
  RD,
  RE,
  RI,
  Ast extends SchemaAST.AST,
  CloneOut extends Schema<T, E, RD, RE, RI>,
  AnnotateIn extends SchemaAST.Annotations,
  MakeIn,
  TypeReadonly extends ReadonlyToken = "readonly",
  TypeIsOptional extends OptionalToken = "required",
  TypeDefault extends DefaultConstructorToken = "no-constructor-default",
  EncodedIsReadonly extends ReadonlyToken = "readonly",
  EncodedIsOptional extends OptionalToken = "required",
  EncodedKey extends PropertyKey = never
> extends SchemaNs.Variance<T, E, RD, RE, RI>, Pipeable {
  readonly Type: T
  readonly Encoded: E
  readonly DecodingContext: RD
  readonly EncodingContext: RE
  readonly IntrinsicContext: RI
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
  makeUnsafe(input: this["~make.in"]): T
}

const variance = {
  /* v8 ignore next 5 */
  "~T": (_: never) => _,
  "~E": (_: never) => _,
  "~RD": (_: never) => _,
  "~RE": (_: never) => _,
  "~RI": (_: never) => _
}

/**
 * @since 4.0.0
 */
export abstract class AbstractSchema$<
  T,
  E,
  RD,
  RE,
  RI,
  Ast extends SchemaAST.AST,
  CloneOut extends Schema<T, E, RD, RE, RI>,
  AnnotateIn extends SchemaAST.Annotations,
  MakeIn,
  TypeReadonly extends ReadonlyToken = "readonly",
  TypeIsOptional extends OptionalToken = "required",
  TypeDefault extends DefaultConstructorToken = "no-constructor-default",
  EncodedIsReadonly extends ReadonlyToken = "readonly",
  EncodedIsOptional extends OptionalToken = "required",
  EncodedKey extends PropertyKey = never
> implements
  AbstractSchema<
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
  "~effect/Schema" = variance
  readonly Type!: T
  readonly Encoded!: E
  readonly DecodingContext!: RD
  readonly EncodingContext!: RE
  readonly IntrinsicContext!: RI

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
    this.makeUnsafe = this.makeUnsafe.bind(this)
  }
  abstract clone(ast: this["ast"]): this["~clone.out"]
  pipe() {
    return pipeArguments(this, arguments)
  }
  makeUnsafe(input: this["~make.in"]): T {
    return SchemaParser.validateUnknownSync(this as any as Schema<T, E, RD, RE, never>)(input)
  }
  annotate(annotations: this["~annotate.in"]): this["~clone.out"] {
    return this.clone(SchemaAST.annotate(this.ast, annotations))
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export interface Schema<out T, out E = T, out RD = never, out RE = never, out RI = never> extends
  AbstractSchema<
    T,
    E,
    RD,
    RE,
    RI,
    SchemaAST.AST,
    Schema<T, E, RD, RE, RI>,
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
export interface DefaultSchema<
  T,
  E,
  RD,
  RE,
  RI,
  Ast extends SchemaAST.AST,
  CloneOut extends Schema<T, E, RD, RE, RI>,
  AnnotateIn extends SchemaAST.Annotations,
  MakeIn
> extends
  AbstractSchema<
    T,
    E,
    RD,
    RE,
    RI,
    Ast,
    CloneOut,
    AnnotateIn,
    MakeIn,
    "readonly",
    "required",
    "no-constructor-default",
    "readonly",
    "required",
    never
  >
{
  readonly "~internal.encoded.make.in": E
}

/**
 * @since 4.0.0
 */
export declare namespace SchemaNs {
  /**
   * @since 4.0.0
   */
  export interface Variance<T, E, RD, RE, RI> {
    readonly "~effect/Schema": {
      readonly "~T": Types.Covariant<T>
      readonly "~E": Types.Covariant<E>
      readonly "~RD": Types.Covariant<RD>
      readonly "~RE": Types.Covariant<RE>
      readonly "~RI": Types.Covariant<RI>
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
  export type DecodingContext<S extends SchemaNs.Any> = S["DecodingContext"]
  /**
   * @since 4.0.0
   */
  export type EncodingContext<S extends SchemaNs.Any> = S["EncodingContext"]
  /**
   * @since 4.0.0
   */
  export type IntrinsicContext<S extends SchemaNs.Any> = S["IntrinsicContext"]
  /**
   * @since 4.0.0
   */
  export type MakeIn<S extends SchemaNs.Any> = S["~make.in"]
  /**
   * @since 4.0.0
   */
  export type Any = Schema<any, any, any, any, any>
}

class Schema$<S extends SchemaNs.Any> extends AbstractSchema$<
  SchemaNs.Type<S>,
  SchemaNs.Encoded<S>,
  SchemaNs.DecodingContext<S>,
  SchemaNs.EncodingContext<S>,
  SchemaNs.IntrinsicContext<S>,
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
export interface make<S extends SchemaNs.Any> extends
  AbstractSchema<
    SchemaNs.Type<S>,
    SchemaNs.Encoded<S>,
    SchemaNs.DecodingContext<S>,
    SchemaNs.EncodingContext<S>,
    SchemaNs.IntrinsicContext<S>,
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
  >
{
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function make<S extends SchemaNs.Any>(ast: S["ast"]): make<S> {
  const clone = (ast: SchemaAST.AST) => new Schema$<S>(ast, clone)
  return new Schema$<S>(ast, clone)
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
    SchemaNs.DecodingContext<S>,
    SchemaNs.EncodingContext<S>,
    SchemaNs.IntrinsicContext<S>,
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
    SchemaNs.DecodingContext<S>,
    SchemaNs.EncodingContext<S>,
    SchemaNs.IntrinsicContext<S>,
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
export interface typeSchema<S extends SchemaNs.Any> extends
  DefaultSchema<
    S["Type"],
    S["Type"],
    never,
    never,
    S["IntrinsicContext"],
    S["ast"],
    typeSchema<S>,
    S["~annotate.in"],
    S["~make.in"]
  >
{}

/**
 * @since 4.0.0
 */
export function typeSchema<S extends SchemaNs.Any>(schema: S): typeSchema<S> {
  return make<typeSchema<S>>(SchemaAST.typeAST(schema.ast))
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface encodedSchema<S extends SchemaNs.Any> extends
  DefaultSchema<
    S["Encoded"],
    S["Encoded"],
    never,
    never,
    S["IntrinsicContext"],
    S["ast"],
    encodedSchema<S>,
    S["~annotate.in"],
    S["~make.in"]
  >
{}

/**
 * @since 4.0.0
 */
export function encodedSchema<S extends SchemaNs.Any>(schema: S): encodedSchema<S> {
  return make<encodedSchema<S>>(SchemaAST.encodedAST(schema.ast))
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface flip<S extends SchemaNs.Any>
  extends make<Schema<S["Encoded"], S["Type"], S["DecodingContext"], S["EncodingContext"], S["IntrinsicContext"]>>
{
  readonly "~clone.out": flip<S["~clone.out"]>
  readonly "~make.in": S["~internal.encoded.make.in"]
  readonly "~internal.encoded.make.in": S["~make.in"]
}

/**
 * @since 4.0.0
 */
export const flip = <S extends SchemaNs.Any>(schema: S): flip<S> => {
  return make<flip<S>>(SchemaAST.flip(schema.ast))
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface declare<T>
  extends DefaultSchema<T, T, never, never, never, SchemaAST.Declaration, declare<T>, SchemaAST.Annotations, T>
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
  extends
    DefaultSchema<T, E, RD, RE, RI, SchemaAST.Declaration, declareResult<T, E, RD, RE, RI>, SchemaAST.Annotations, T>
{
  readonly "~internal.encoded.make.in": E
}

/**
 * @since 4.0.0
 */
export const declareResult = <
  const T,
  E,
  TypeParameters extends ReadonlyArray<SchemaNs.Any>,
  R
>(options: {
  readonly typeParameters: TypeParameters
  readonly decode: (
    typeParameters: { readonly [K in keyof TypeParameters]: TypeParameters[K] }
  ) => (u: unknown, self: SchemaAST.Declaration, options: SchemaAST.ParseOptions) => SchemaParser.ParserResult<T, R>
}): declareResult<
  T,
  E,
  SchemaNs.DecodingContext<TypeParameters[number]>,
  SchemaNs.EncodingContext<TypeParameters[number]>,
  | SchemaNs.IntrinsicContext<TypeParameters[number]>
  | R
> => {
  return make<
    declareResult<
      T,
      E,
      SchemaNs.DecodingContext<TypeParameters[number]>,
      SchemaNs.EncodingContext<TypeParameters[number]>,
      | SchemaNs.IntrinsicContext<TypeParameters[number]>
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
 * Returns the underlying `Schema<T, E, RD, RE, RI>`.
 *
 * @since 4.0.0
 */
export function reveal<T, E, RD, RE, RI>(schema: Schema<T, E, RD, RE, RI>): Schema<T, E, RD, RE, RI> {
  return schema
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Literal<L extends SchemaAST.LiteralValue>
  extends make<DefaultSchema<L, L, never, never, never, SchemaAST.Literal, Literal<L>, SchemaAST.Annotations, L>>
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
  extends
    make<DefaultSchema<never, never, never, never, never, SchemaAST.NeverKeyword, Never, SchemaAST.Annotations, never>>
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
    DefaultSchema<string, string, never, never, never, SchemaAST.StringKeyword, String, SchemaAST.Annotations, string>
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
    DefaultSchema<number, number, never, never, never, SchemaAST.NumberKeyword, Number, SchemaAST.Annotations, number>
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
  export type DecodingContext<F extends Fields> = { readonly [K in keyof F]: SchemaNs.DecodingContext<F[K]> }[keyof F]

  /**
   * @since 4.0.0
   */
  export type EncodingContext<F extends Fields> = { readonly [K in keyof F]: SchemaNs.EncodingContext<F[K]> }[keyof F]

  /**
   * @since 4.0.0
   */
  export type IntrinsicContext<F extends Fields> = { readonly [K in keyof F]: SchemaNs.IntrinsicContext<F[K]> }[keyof F]

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
  export type DecodingContext<E extends Elements> = SchemaNs.DecodingContext<E[number]>
  /**
   * @since 4.0.0
   */
  export type EncodingContext<E extends Elements> = SchemaNs.EncodingContext<E[number]>
  /**
   * @since 4.0.0
   */
  export type IntrinsicContext<E extends Elements> = SchemaNs.IntrinsicContext<E[number]>
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Tuple<Elements extends TupleNs.Elements> extends
  AbstractSchema<
    TupleNs.Type<Elements>,
    TupleNs.Encoded<Elements>,
    TupleNs.DecodingContext<Elements>,
    TupleNs.EncodingContext<Elements>,
    TupleNs.IntrinsicContext<Elements>,
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
    SchemaNs.DecodingContext<S>,
    SchemaNs.EncodingContext<S>,
    SchemaNs.IntrinsicContext<S>,
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
    SchemaNs.DecodingContext<S>,
    SchemaNs.EncodingContext<S>,
    SchemaNs.IntrinsicContext<S>,
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
export interface suspend<T, E, RD, RE, RI> extends
  DefaultSchema<
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
  f: () => Schema<T, E, RD, RE, RI>
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
  return <S extends Schema<T, any, any, any, any>>(self: S) =>
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
    return <S extends Schema<T, any, any, any, any>>(self: S) =>
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
  transformation: SchemaAST.SymmetricTransformation<SchemaNs.Encoded<To>, SchemaNs.Type<From>>
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
    SchemaNs.DecodingContext<From | To>,
    SchemaNs.EncodingContext<From | To>,
    SchemaNs.IntrinsicContext<From | To>,
    From["ast"],
    encodeTo<From, To>,
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
  transformation: SchemaAST.SymmetricTransformation<SchemaNs.Encoded<From>, SchemaNs.Type<To>>
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
    SchemaNs.DecodingContext<S>,
    SchemaNs.EncodingContext<S>,
    SchemaNs.IntrinsicContext<S>,
    S["ast"],
    encodeToKey<S, K>,
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
  return make<encodeToKey<S, K>>(SchemaAST.encodeToKey(self.ast, key))
}

/**
 * @category API interface
 * @since 4.0.0
 */
export interface withConstructorDefault<S extends SchemaNs.Any> extends
  AbstractSchema<
    SchemaNs.Type<S>,
    SchemaNs.Encoded<S>,
    SchemaNs.DecodingContext<S>,
    SchemaNs.EncodingContext<S>,
    SchemaNs.IntrinsicContext<S>,
    S["ast"],
    withConstructorDefault<S>,
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
export const withConstructorDefault =
  <S extends SchemaNs.Any & { readonly "~ps.type.constructor.default": "no-constructor-default" }>(
    value: Option.Option<SchemaNs.Type<S>> | Effect.Effect<SchemaNs.Type<S>>
  ) =>
  (self: S): withConstructorDefault<S> => {
    return make<withConstructorDefault<S>>(SchemaAST.withConstructorDefault(self.ast, value))
  }

/**
 * @category API interface
 * @since 4.0.0
 */
export interface encodeOptionalToRequired<From extends SchemaNs.Any, To extends SchemaNs.Any> extends
  AbstractSchema<
    SchemaNs.Type<From>,
    SchemaNs.Encoded<To>,
    SchemaNs.DecodingContext<From | To>,
    SchemaNs.EncodingContext<From | To>,
    SchemaNs.IntrinsicContext<From | To>,
    From["ast"],
    encodeOptionalToRequired<From, To>,
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
export const encodeOptionalToRequired = <
  From extends SchemaNs.Any & { readonly "~ps.encoded.isOptional": "optional" },
  To extends SchemaNs.Any & { readonly "~ps.type.isOptional": "required" }
>(
  to: To,
  transformations: {
    readonly encode: (input: Option.Option<SchemaNs.Encoded<From>>) => SchemaNs.Type<To>
    readonly decode: (input: SchemaNs.Type<To>) => Option.Option<SchemaNs.Encoded<From>>
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
export interface encodeRequiredToOptional<From extends SchemaNs.Any, To extends SchemaNs.Any> extends
  AbstractSchema<
    SchemaNs.Type<From>,
    SchemaNs.Encoded<To>,
    SchemaNs.DecodingContext<From | To>,
    SchemaNs.EncodingContext<From | To>,
    SchemaNs.IntrinsicContext<From | To>,
    From["ast"],
    encodeRequiredToOptional<From, To>,
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
export const encodeRequiredToOptional = <
  From extends SchemaNs.Any & { readonly "~ps.encoded.isOptional": "required" },
  To extends SchemaNs.Any & { readonly "~ps.type.isOptional": "required" }
>(
  to: To,
  transformations: {
    readonly encode: (input: SchemaNs.Encoded<From>) => Option.Option<SchemaNs.Type<To>>
    readonly decode: (input: Option.Option<SchemaNs.Type<To>>) => SchemaNs.Encoded<From>
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
export const trim: SchemaAST.SymmetricTransformation<string, string> = new SchemaAST.Transformation(
  (input: string) => Result.ok(input.trim()),
  Result.ok,
  { title: "trim" }
)

/**
 * @category api interface
 * @since 3.10.0
 */
export interface parseNumber<S extends Schema<string, any, any, any, any>> extends encodeTo<Number, S> {}

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
export const NumberToString = String.pipe(decodeTo(Number, parseNumber))

/**
 * @category api interface
 * @since 3.10.0
 */
export interface Class<Self, S extends SchemaNs.Any> extends
  DefaultSchema<
    Self,
    SchemaNs.Encoded<S>,
    SchemaNs.DecodingContext<S>,
    SchemaNs.EncodingContext<S>,
    SchemaNs.IntrinsicContext<S>,
    S["ast"],
    DefaultSchema<
      Self,
      SchemaNs.Encoded<S>,
      SchemaNs.DecodingContext<S>,
      SchemaNs.EncodingContext<S>,
      SchemaNs.IntrinsicContext<S>,
      S["ast"],
      Class<Self, S>,
      S["~annotate.in"],
      SchemaNs.MakeIn<S>
    >,
    S["~annotate.in"],
    SchemaNs.MakeIn<S>
  >
{
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

      static readonly "~ps.type.isReadonly": Class<Self, S>["~ps.type.isReadonly"]
      static readonly "~ps.type.isOptional": Class<Self, S>["~ps.type.isOptional"]
      static readonly "~ps.type.constructor.default": Class<Self, S>["~ps.type.constructor.default"]

      static readonly "~ps.encoded.isReadonly": Class<Self, S>["~ps.encoded.isReadonly"]
      static readonly "~ps.encoded.key": Class<Self, S>["~ps.encoded.key"]
      static readonly "~ps.encoded.isOptional": Class<Self, S>["~ps.encoded.isOptional"]

      static readonly "~internal.encoded.make.in": Class<Self, S>["~internal.encoded.make.in"]

      static readonly identifier = identifier
      static readonly schema = schema

      static readonly "~effect/Schema" = variance
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
      static makeUnsafe(input: SchemaNs.MakeIn<S>): Self {
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
export interface option<S extends SchemaNs.Any> extends
  declareResult<
    Option.Option<SchemaNs.Type<S>>,
    Option.Option<SchemaNs.Encoded<S>>,
    SchemaNs.DecodingContext<S>,
    SchemaNs.EncodingContext<S>,
    SchemaNs.IntrinsicContext<S>
  >
{}

const Option_ = <S extends SchemaNs.Any>(schema: S): option<S> => {
  return declareResult<
    Option.Option<SchemaNs.Type<S>>,
    Option.Option<SchemaNs.Encoded<S>>,
    [S],
    SchemaNs.IntrinsicContext<S>
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
