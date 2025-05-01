/**
 * @since 4.0.0
 */

import * as Arr from "./Array.js"
import type { Brand } from "./Brand.js"
import type * as Cause from "./Cause.js"
import * as Data from "./Data.js"
import * as core from "./internal/core.js"
import { ownKeys } from "./internal/schema/util.js"
import * as O from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"
import * as Predicate from "./Predicate.js"
import * as Result from "./Result.js"
import * as SchemaAST from "./SchemaAST.js"
import * as SchemaFilter from "./SchemaFilter.js"
import * as SchemaIssue from "./SchemaIssue.js"
import * as SchemaMiddleware from "./SchemaMiddleware.js"
import * as SchemaParser from "./SchemaParser.js"
import * as SchemaResult from "./SchemaResult.js"
import * as SchemaTransformation from "./SchemaTransformation.js"
import * as SchemaValidator from "./SchemaValidator.js"

/**
 * @since 4.0.0
 */
export type Simplify<T> = { [K in keyof T]: T[K] } & {}

/**
 * @since 4.0.0
 */
export type Merge<T, U> = keyof T & keyof U extends never ? T & U : Omit<T, keyof T & keyof U> & U

type OptionalToken = "required" | "optional"
type ReadonlyToken = "readonly" | "mutable"
type DefaultConstructorToken = "no-constructor-default" | "has-constructor-default"

/**
 * @category Model
 * @since 4.0.0
 */
export interface MakeOptions {
  readonly parseOptions?: SchemaAST.ParseOptions | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Bottom<
  T,
  E,
  RD,
  RE,
  RI,
  Ast extends SchemaAST.AST,
  RebuildOut extends Top,
  AnnotateIn extends SchemaAST.Annotations,
  TypeMakeIn,
  TypeReadonly extends ReadonlyToken = "readonly",
  TypeIsOptional extends OptionalToken = "required",
  TypeDefault extends DefaultConstructorToken = "no-constructor-default",
  EncodedIsReadonly extends ReadonlyToken = "readonly",
  EncodedIsOptional extends OptionalToken = "required"
> extends Pipeable {
  readonly ast: Ast

  readonly "~effect/Schema": "~effect/Schema"

  readonly "Type": T
  readonly "Encoded": E
  readonly "DecodingContext": RD
  readonly "EncodingContext": RE
  readonly "IntrinsicContext": RI

  readonly "~rebuild.out": RebuildOut
  readonly "~annotate.in": AnnotateIn

  readonly "~type.make.in": TypeMakeIn
  readonly "~type.isReadonly": TypeReadonly
  readonly "~type.isOptional": TypeIsOptional
  readonly "~type.default": TypeDefault

  readonly "~encoded.make.in": E
  readonly "~encoded.isReadonly": EncodedIsReadonly
  readonly "~encoded.isOptional": EncodedIsOptional

  rebuild(ast: this["ast"]): this["~rebuild.out"]
  annotate(annotations: this["~annotate.in"]): this["~rebuild.out"]
  make(
    input: this["~type.make.in"],
    options?: MakeOptions
  ): SchemaResult.SchemaResult<this["Type"]>
  makeUnsafe(input: this["~type.make.in"], options?: MakeOptions): this["Type"]
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
  RebuildOut extends Top,
  AnnotateIn extends SchemaAST.Annotations,
  TypeMakeIn,
  TypeReadonly extends ReadonlyToken = "readonly",
  TypeIsOptional extends OptionalToken = "required",
  TypeDefault extends DefaultConstructorToken = "no-constructor-default",
  EncodedIsReadonly extends ReadonlyToken = "readonly",
  EncodedIsOptional extends OptionalToken = "required"
> implements
  Bottom<
    T,
    E,
    RD,
    RE,
    RI,
    Ast,
    RebuildOut,
    AnnotateIn,
    TypeMakeIn,
    TypeReadonly,
    TypeIsOptional,
    TypeDefault,
    EncodedIsReadonly,
    EncodedIsOptional
  >
{
  readonly "~effect/Schema" = "~effect/Schema"

  declare readonly "Type": T
  declare readonly "Encoded": E
  declare readonly "DecodingContext": RD
  declare readonly "EncodingContext": RE
  declare readonly "IntrinsicContext": RI

  declare readonly "~rebuild.out": RebuildOut
  declare readonly "~annotate.in": AnnotateIn

  declare readonly "~type.make.in": TypeMakeIn
  declare readonly "~type.isReadonly": TypeReadonly
  declare readonly "~type.isOptional": TypeIsOptional
  declare readonly "~type.default": TypeDefault

  declare readonly "~encoded.isReadonly": EncodedIsReadonly
  declare readonly "~encoded.isOptional": EncodedIsOptional
  declare readonly "~encoded.make.in": E

  constructor(readonly ast: Ast) {
    this.make = this.make.bind(this)
    this.makeUnsafe = this.makeUnsafe.bind(this)
  }
  abstract rebuild(ast: this["ast"]): this["~rebuild.out"]
  pipe() {
    return pipeArguments(this, arguments)
  }
  make(
    input: this["~type.make.in"],
    options?: MakeOptions
  ): SchemaResult.SchemaResult<this["Type"]> {
    const parseOptions: SchemaAST.ParseOptions = { "~variant": "make", ...options?.parseOptions }
    return SchemaValidator.validateUnknownParserResult(this)(input, parseOptions) as any
  }
  makeUnsafe(input: this["~type.make.in"], options?: MakeOptions): this["Type"] {
    return Result.getOrThrowWith(
      SchemaValidator.runSyncSchemaResult(this.make(input, options)),
      (issue) => new globalThis.Error(`makeUnsafe failure`, { cause: issue })
    )
  }
  annotate(annotations: this["~annotate.in"]): this["~rebuild.out"] {
    return this.rebuild(SchemaAST.annotate(this.ast, annotations))
  }
}

/**
 * @category Model
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
    OptionalToken
  >
{}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Schema<out T> extends Top {
  readonly "Type": T
  readonly "~rebuild.out": Schema<T>
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Codec<out T, out E = T, out RD = never, out RE = never, out RI = never> extends Schema<T> {
  readonly "Encoded": E
  readonly "DecodingContext": RD
  readonly "EncodingContext": RE
  readonly "IntrinsicContext": RI
  readonly "~rebuild.out": Codec<T, E, RD, RE, RI>
}

/**
 * @category Api interface
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
    S["~rebuild.out"],
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.isReadonly"],
    S["~type.isOptional"],
    S["~type.default"],
    S["~encoded.isReadonly"],
    S["~encoded.isOptional"]
  >
{}

class make$<S extends Top> extends Bottom$<
  S["Type"],
  S["Encoded"],
  S["DecodingContext"],
  S["EncodingContext"],
  S["IntrinsicContext"],
  S["ast"],
  S["~rebuild.out"],
  S["~annotate.in"],
  S["~type.make.in"],
  S["~type.isReadonly"],
  S["~type.isOptional"],
  S["~type.default"],
  S["~encoded.isReadonly"],
  S["~encoded.isOptional"]
> {
  constructor(
    ast: S["ast"],
    readonly rebuild: (ast: S["ast"]) => S["~rebuild.out"]
  ) {
    super(ast)
  }
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function make<S extends Top>(ast: S["ast"]): make<S> {
  const rebuild = (ast: SchemaAST.AST) => new make$<S>(ast, rebuild)
  return rebuild(ast)
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
 * @category Api interface
 * @since 4.0.0
 */
export interface optionalKey<S extends Top> extends make<S> {
  readonly "~rebuild.out": optionalKey<S["~rebuild.out"]>
  readonly "~type.isOptional": "optional"
  readonly "~encoded.isOptional": "optional"
  readonly schema: S
}

class optionalKey$<S extends Top> extends make$<optionalKey<S>> implements optionalKey<S> {
  constructor(readonly schema: S) {
    super(
      SchemaAST.optionalKey(schema.ast),
      (ast) => new optionalKey$(this.schema.rebuild(ast))
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
  readonly "~rebuild.out": mutableKey<S["~rebuild.out"]>
  readonly "~type.isReadonly": "mutable"
  readonly "~encoded.isReadonly": "mutable"
  readonly schema: S
}

class mutableKey$<S extends Top> extends make$<mutableKey<S>> implements mutableKey<S> {
  constructor(readonly schema: S) {
    super(
      SchemaAST.mutableKey(schema.ast),
      (ast) => new mutableKey$(this.schema.rebuild(ast))
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
 * @category Api interface
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
    S["~type.make.in"]
  >
{}

/**
 * @since 4.0.0
 */
export function typeCodec<S extends Top>(schema: S): typeCodec<S> {
  return make<typeCodec<S>>(SchemaAST.typeAST(schema.ast))
}

/**
 * @category Api interface
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
    S["~type.make.in"]
  >
{}

/**
 * @since 4.0.0
 */
export function encodedCodec<S extends Top>(schema: S): encodedCodec<S> {
  return make<encodedCodec<S>>(SchemaAST.encodedAST(schema.ast))
}

/**
 * @category Api interface
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
    flip<S>,
    SchemaAST.Annotations,
    S["~encoded.make.in"]
  >
{
  readonly "~effect/flip$": "~effect/flip$"
  readonly "~encoded.make.in": S["~type.make.in"]
  readonly schema: S
}

class flip$<S extends Top> extends make$<flip<S>> implements flip<S> {
  readonly "~effect/flip$" = "~effect/flip$"
  static is = (schema: Top): schema is flip<any> => {
    return Predicate.hasProperty(schema, "~effect/flip$") && schema["~effect/flip$"] === "~effect/flip$"
  }
  constructor(readonly schema: S, ast: SchemaAST.AST) {
    super(
      ast,
      (ast) => {
        return new flip$(this.schema, ast)
      }
    )
  }
}

/**
 * @since 4.0.0
 */
export function flip<S extends Top>(schema: S): S extends flip<infer F> ? F["~rebuild.out"] : flip<S> {
  if (flip$.is(schema)) {
    return schema.schema.rebuild(SchemaAST.flip(schema.ast))
  }
  const out = new flip$(schema, SchemaAST.flip(schema.ast))
  return out as any
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface declare<T>
  extends Bottom<T, T, never, never, never, SchemaAST.Declaration, declare<T>, SchemaAST.Annotations, T>
{
  readonly "~encoded.make.in": T
}

/**
 * @since 4.0.0
 */
export const declare = <T>(
  is: (u: unknown) => u is T,
  annotations?: SchemaAST.Annotations.Declaration<T> | undefined
): declare<T> => {
  return make<declare<T>>(
    new SchemaAST.Declaration(
      [],
      () => (input, ast) =>
        is(input) ?
          Result.ok(input) :
          Result.err(new SchemaIssue.MismatchIssue(ast, O.some(input))),
      annotations,
      undefined,
      undefined,
      undefined
    )
  )
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface declareConstructor<T, E, TypeParameters extends ReadonlyArray<Top>, RI> extends
  Bottom<
    T,
    E,
    TypeParameters[number]["DecodingContext"],
    TypeParameters[number]["EncodingContext"],
    RI,
    SchemaAST.Declaration,
    declareConstructor<T, E, TypeParameters, RI>,
    SchemaAST.Annotations.Declaration<T>,
    T
  >
{
  readonly "~encoded.make.in": E
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
export const declareConstructor =
  <const TypeParameters extends ReadonlyArray<Top>>(typeParameters: TypeParameters) =>
  <E>() =>
  <T, R>(
    decode: (typeParameters: MergeTypeParametersParsingContexts<TypeParameters>) => (
      u: unknown,
      self: SchemaAST.Declaration,
      options: SchemaAST.ParseOptions
    ) => SchemaResult.SchemaResult<T, R>,
    annotations?: SchemaAST.Annotations.Declaration<T>
  ): declareConstructor<
    T,
    E,
    TypeParameters,
    Exclude<R, TypeParameters[number]["DecodingContext"] | TypeParameters[number]["EncodingContext"]>
  > => {
    return make<
      declareConstructor<
        T,
        E,
        TypeParameters,
        Exclude<R, TypeParameters[number]["DecodingContext"] | TypeParameters[number]["EncodingContext"]>
      >
    >(
      new SchemaAST.Declaration(
        typeParameters.map((tp) => tp.ast),
        (typeParameters) => decode(typeParameters.map(make) as any),
        annotations,
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
 * @category Api interface
 * @since 4.0.0
 */
export interface Literal<L extends SchemaAST.LiteralValue>
  extends Bottom<L, L, never, never, never, SchemaAST.LiteralType, Literal<L>, SchemaAST.Annotations, L>
{
  readonly literal: L
}

class Literal$<L extends SchemaAST.LiteralValue> extends make$<Literal<L>> implements Literal<L> {
  constructor(ast: SchemaAST.LiteralType, readonly literal: L) {
    super(ast, (ast) => new Literal$(ast, literal))
  }
}

/**
 * @since 4.0.0
 */
export function Literal<L extends SchemaAST.LiteralValue>(literal: L): Literal<L> {
  return new Literal$(new SchemaAST.LiteralType(literal, undefined, undefined, undefined, undefined), literal)
}

/**
 * @category Api interface
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
 * @category Api interface
 * @since 4.0.0
 */
export interface Any
  extends Bottom<unknown, unknown, never, never, never, SchemaAST.AnyKeyword, Any, SchemaAST.Annotations, unknown>
{}

/**
 * @since 4.0.0
 */
export const Any: Any = make<Any>(SchemaAST.anyKeyword)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Unknown
  extends
    Bottom<unknown, unknown, never, never, never, SchemaAST.UnknownKeyword, Unknown, SchemaAST.Annotations, unknown>
{}

/**
 * @since 4.0.0
 */
export const Unknown: Unknown = make<Unknown>(SchemaAST.unknownKeyword)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Null
  extends Bottom<null, null, never, never, never, SchemaAST.NullKeyword, Null, SchemaAST.Annotations, null>
{}

/**
 * @since 4.0.0
 */
export const Null: Null = make<Null>(SchemaAST.nullKeyword)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Undefined extends
  Bottom<
    undefined,
    undefined,
    never,
    never,
    never,
    SchemaAST.UndefinedKeyword,
    Undefined,
    SchemaAST.Annotations,
    undefined
  >
{}

/**
 * @since 4.0.0
 */
export const Undefined: Undefined = make<Undefined>(SchemaAST.undefinedKeyword)

/**
 * @category Api interface
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
 * @category Api interface
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
 * @category Api interface
 * @since 4.0.0
 */
export interface Boolean
  extends
    Bottom<boolean, boolean, never, never, never, SchemaAST.BooleanKeyword, Boolean, SchemaAST.Annotations, boolean>
{}

/**
 * @since 4.0.0
 */
export const Boolean: Boolean = make<Boolean>(SchemaAST.booleanKeyword)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Symbol
  extends Bottom<symbol, symbol, never, never, never, SchemaAST.SymbolKeyword, Symbol, SchemaAST.Annotations, symbol>
{}

/**
 * @since 4.0.0
 */
export const Symbol: Symbol = make<Symbol>(SchemaAST.symbolKeyword)

/**
 * @since 4.0.0
 */
export interface BigInt
  extends Bottom<bigint, bigint, never, never, never, SchemaAST.BigIntKeyword, BigInt, SchemaAST.Annotations, bigint>
{}

/**
 * @since 4.0.0
 */
export const BigInt: BigInt = make<BigInt>(SchemaAST.bigIntKeyword)

/**
 * @since 4.0.0
 */
export interface Void
  extends Bottom<void, void, never, never, never, SchemaAST.VoidKeyword, Void, SchemaAST.Annotations, void>
{}

/**
 * @since 4.0.0
 */
export const Void: Void = make<Void>(SchemaAST.voidKeyword)

/**
 * @since 4.0.0
 */
export interface Object$
  extends Bottom<object, object, never, never, never, SchemaAST.ObjectKeyword, Object$, SchemaAST.Annotations, object>
{}

const Object_: Object$ = make<Object$>(SchemaAST.objectKeyword)

export {
  /**
   * @since 4.0.0
   */

  Object_ as Object
}

/**
 * @since 4.0.0
 */
export interface UniqueSymbol<sym extends symbol>
  extends Bottom<sym, sym, never, never, never, SchemaAST.UniqueSymbol, UniqueSymbol<sym>, SchemaAST.Annotations, sym>
{}

/**
 * @since 4.0.0
 */
export const UniqueSymbol = <const sym extends symbol>(symbol: sym): UniqueSymbol<sym> => {
  return make<UniqueSymbol<sym>>(new SchemaAST.UniqueSymbol(symbol, undefined, undefined, undefined, undefined))
}

/**
 * @since 4.0.0
 */
export declare namespace Struct {
  /**
   * @since 4.0.0
   */
  export type Field = Top

  /**
   * @since 4.0.0
   */
  export type Fields = { readonly [x: PropertyKey]: Field }

  type TypeOptionalKeys<Fields extends Struct.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~type.isOptional": "optional" } ? K
      : never
  }[keyof Fields]

  type TypeMutableKeys<Fields extends Struct.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~type.isReadonly": "mutable" } ? K
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
  export type Type<F extends Fields> = Type_<F>

  type EncodedOptionalKeys<Fields extends Struct.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~encoded.isOptional": "optional" } ? K
      : never
  }[keyof Fields]

  type EncodedMutableKeys<Fields extends Struct.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~encoded.isReadonly": "mutable" } ? K
      : never
  }[keyof Fields]

  type EncodedFromKey<F extends Fields, K extends keyof F> = [K] extends [never] ? never :
    F[K] extends { readonly "~encoded.key": infer EncodedKey extends PropertyKey } ?
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
  export type Encoded<F extends Fields> = Encoded_<F>

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

  type TypeDefaultedKeys<Fields extends Struct.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~type.default": "has-constructor-default" } ? K
      : never
  }[keyof Fields]

  type MakeIn_<
    F extends Fields,
    O = TypeOptionalKeys<F> | TypeDefaultedKeys<F>
  > =
    & { readonly [K in keyof F as K extends O ? never : K]: F[K]["~type.make.in"] }
    & { readonly [K in keyof F as K extends O ? K : never]?: F[K]["~type.make.in"] }

  /**
   * @since 4.0.0
   */
  export type MakeIn<F extends Fields> = MakeIn_<F>
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Struct<Fields extends Struct.Fields> extends
  Bottom<
    Simplify<Struct.Type<Fields>>,
    Simplify<Struct.Encoded<Fields>>,
    Struct.DecodingContext<Fields>,
    Struct.EncodingContext<Fields>,
    Struct.IntrinsicContext<Fields>,
    SchemaAST.TypeLiteral,
    Struct<Fields>,
    SchemaAST.Annotations.Bottom,
    Simplify<Struct.MakeIn<Fields>>
  >
{
  readonly fields: Fields
}

class Struct$<Fields extends Struct.Fields> extends make$<Struct<Fields>> implements Struct<Fields> {
  readonly fields: Fields
  constructor(ast: SchemaAST.TypeLiteral, fields: Fields) {
    super(ast, (ast) => new Struct$(ast, fields))
    this.fields = { ...fields }
  }
}

/**
 * @since 4.0.0
 */
export function Struct<const Fields extends Struct.Fields>(fields: Fields): Struct<Fields> {
  const ast = new SchemaAST.TypeLiteral(
    ownKeys(fields).map((key) => {
      return new SchemaAST.PropertySignature(key, fields[key].ast)
    }),
    [],
    undefined,
    undefined,
    undefined,
    undefined
  )
  return new Struct$(ast, fields)
}

/**
 * @since 4.0.0
 */
export declare namespace IndexSignature {
  /**
   * @since 4.0.0
   */
  export interface RecordKey extends Codec<PropertyKey, PropertyKey, unknown, unknown, unknown> {
    readonly "~type.make.in": PropertyKey
  }

  /**
   * @since 4.0.0
   */
  export type Records = ReadonlyArray<ReadonlyRecord$<IndexSignature.RecordKey, Top>>

  type MergeTuple<T extends ReadonlyArray<unknown>> = T extends readonly [infer Head, ...infer Tail] ?
    Head & MergeTuple<Tail>
    : {}

  /**
   * @since 4.0.0
   */
  export type Type<Records extends IndexSignature.Records> = MergeTuple<
    { readonly [K in keyof Records]: { readonly [P in Records[K]["key"]["Type"]]: Records[K]["value"]["Type"] } }
  >

  /**
   * @since 4.0.0
   */
  export type Encoded<Records extends IndexSignature.Records> = MergeTuple<
    { readonly [K in keyof Records]: { readonly [P in Records[K]["key"]["Encoded"]]: Records[K]["value"]["Encoded"] } }
  >

  /**
   * @since 4.0.0
   */
  export type DecodingContext<Records extends IndexSignature.Records> = {
    [K in keyof Records]: Records[K]["key"]["DecodingContext"] | Records[K]["value"]["DecodingContext"]
  }[number]

  /**
   * @since 4.0.0
   */
  export type EncodingContext<Records extends IndexSignature.Records> = {
    [K in keyof Records]: Records[K]["key"]["EncodingContext"] | Records[K]["value"]["EncodingContext"]
  }[number]

  /**
   * @since 4.0.0
   */
  export type IntrinsicContext<Records extends IndexSignature.Records> = {
    [K in keyof Records]: Records[K]["key"]["IntrinsicContext"] | Records[K]["value"]["IntrinsicContext"]
  }[number]

  /**
   * @since 4.0.0
   */
  export type MakeIn<Records extends IndexSignature.Records> = MergeTuple<
    {
      readonly [K in keyof Records]: {
        readonly [P in Records[K]["key"]["~type.make.in"]]: Records[K]["value"]["~type.make.in"]
      }
    }
  >
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface ReadonlyRecord$<Key extends IndexSignature.RecordKey, Value extends Top> extends
  Bottom<
    { readonly [P in Key["Type"]]: Value["Type"] },
    { readonly [P in Key["Encoded"]]: Value["Encoded"] },
    Key["DecodingContext"] | Value["DecodingContext"],
    Key["EncodingContext"] | Value["EncodingContext"],
    Key["IntrinsicContext"] | Value["IntrinsicContext"],
    SchemaAST.TypeLiteral,
    ReadonlyRecord$<Key, Value>,
    SchemaAST.Annotations.Bottom,
    { readonly [P in Key["~type.make.in"]]: Value["~type.make.in"] }
  >
{
  readonly key: Key
  readonly value: Value
}

class ReadonlyRecord$$<Key extends IndexSignature.RecordKey, Value extends Top>
  extends make$<ReadonlyRecord$<Key, Value>>
  implements ReadonlyRecord$<Key, Value>
{
  constructor(ast: SchemaAST.TypeLiteral, readonly key: Key, readonly value: Value) {
    super(ast, (ast) => new ReadonlyRecord$$(ast, key, value))
  }
}

/**
 * @since 4.0.0
 */
export function ReadonlyRecord<Key extends IndexSignature.RecordKey, Value extends Top>(
  key: Key,
  value: Value,
  options?: {
    readonly key: {
      readonly decode?: {
        readonly combine?: SchemaAST.Combine<Key["Type"], Value["Type"]> | undefined
      }
      readonly encode?: {
        readonly combine?: SchemaAST.Combine<Key["Encoded"], Value["Encoded"]> | undefined
      }
    }
  }
): ReadonlyRecord$<Key, Value> {
  const merge = options?.key?.decode?.combine || options?.key?.encode?.combine
    ? new SchemaAST.Merge(
      options.key.decode?.combine,
      options.key.encode?.combine
    )
    : undefined
  const ast = new SchemaAST.TypeLiteral(
    [],
    [new SchemaAST.IndexSignature(key.ast, value.ast, merge)],
    undefined,
    undefined,
    undefined,
    undefined
  )
  return new ReadonlyRecord$$(ast, key, value)
}

/**
 * @since 4.0.0
 */
export declare namespace StructAndRest {
  /**
   * @since 4.0.0
   */
  export type Type<Fields extends Struct.Fields, Records extends IndexSignature.Records> =
    & Struct.Type<Fields>
    & IndexSignature.Type<Records>

  /**
   * @since 4.0.0
   */
  export type Encoded<Fields extends Struct.Fields, Records extends IndexSignature.Records> =
    & Struct.Encoded<Fields>
    & IndexSignature.Encoded<Records>

  /**
   * @since 4.0.0
   */
  export type DecodingContext<Fields extends Struct.Fields, Records extends IndexSignature.Records> =
    | Struct.DecodingContext<Fields>
    | IndexSignature.DecodingContext<Records>

  /**
   * @since 4.0.0
   */
  export type EncodingContext<Fields extends Struct.Fields, Records extends IndexSignature.Records> =
    | Struct.EncodingContext<Fields>
    | IndexSignature.EncodingContext<Records>

  /**
   * @since 4.0.0
   */
  export type IntrinsicContext<Fields extends Struct.Fields, Records extends IndexSignature.Records> =
    | Struct.IntrinsicContext<Fields>
    | IndexSignature.IntrinsicContext<Records>

  /**
   * @since 4.0.0
   */
  export type MakeIn<Fields extends Struct.Fields, Records extends IndexSignature.Records> =
    & Struct.MakeIn<Fields>
    & IndexSignature.MakeIn<Records>
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface StructAndRest<
  Fields extends Struct.Fields,
  Records extends IndexSignature.Records
> extends
  Bottom<
    Simplify<StructAndRest.Type<Fields, Records>>,
    Simplify<StructAndRest.Encoded<Fields, Records>>,
    StructAndRest.DecodingContext<Fields, Records>,
    StructAndRest.EncodingContext<Fields, Records>,
    StructAndRest.IntrinsicContext<Fields, Records>,
    SchemaAST.TypeLiteral,
    StructAndRest<Fields, Records>,
    SchemaAST.Annotations.Bottom,
    Simplify<StructAndRest.MakeIn<Fields, Records>>
  >
{
  readonly fields: Fields
  readonly records: Records
}

class StructAndRest$$<const Fields extends Struct.Fields, const Records extends IndexSignature.Records>
  extends make$<StructAndRest<Fields, Records>>
  implements StructAndRest<Fields, Records>
{
  readonly fields: Fields
  readonly records: Records
  constructor(ast: SchemaAST.TypeLiteral, fields: Fields, records: Records) {
    super(ast, (ast) => new StructAndRest$$(ast, fields, records))
    this.fields = { ...fields }
    this.records = [...records] as any
  }
}

/**
 * @since 4.0.0
 */
export function StructAndRest<const Fields extends Struct.Fields, const Records extends IndexSignature.Records>(
  struct: Struct<Fields>,
  records: Records
): StructAndRest<Fields, Records> {
  const ast = new SchemaAST.TypeLiteral(
    struct.ast.propertySignatures,
    records.map((record) => {
      return new SchemaAST.IndexSignature(record.key.ast, record.value.ast, undefined)
    }),
    undefined,
    undefined,
    undefined,
    undefined
  )
  return new StructAndRest$$(ast, struct.fields, records)
}

/**
 * @since 4.0.0
 */
export declare namespace Tuple {
  /**
   * @since 4.0.0
   */
  export type Element = Top

  /**
   * @since 4.0.0
   */
  export type Elements = ReadonlyArray<Element>

  type Type_<
    E,
    Out extends ReadonlyArray<any> = readonly []
  > = E extends readonly [infer Head, ...infer Tail] ?
    Head extends { readonly "~type.isOptional": "optional"; "Type": infer T } ? Type_<Tail, readonly [...Out, T?]>
    : Head extends { readonly "~type.isOptional": OptionalToken; "Type": infer T } ? Type_<Tail, readonly [...Out, T]>
    : Out
    : Out

  /**
   * @since 4.0.0
   */
  export type Type<E extends Elements> = Type_<E>

  type Encoded_<
    E,
    Out extends ReadonlyArray<any> = readonly []
  > = E extends readonly [infer Head, ...infer Tail] ?
    Head extends { readonly "~encoded.isOptional": "optional"; "Encoded": infer T } ?
      Encoded_<Tail, readonly [...Out, T?]>
    : Head extends { readonly "~encoded.isOptional": OptionalToken; "Encoded": infer T } ?
      Encoded_<Tail, readonly [...Out, T]>
    : Out
    : Out

  /**
   * @since 4.0.0
   */
  export type Encoded<E extends Elements> = Encoded_<E>

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

  type MakeIn_<
    E,
    Out extends ReadonlyArray<any> = readonly []
  > = E extends readonly [infer Head, ...infer Tail] ?
    Head extends { readonly "~type.isOptional": "optional"; "~type.make.in": infer T } ?
      MakeIn_<Tail, readonly [...Out, T?]>
    : Head extends { readonly "~type.isOptional": "required"; "~type.make.in": infer T } ?
      MakeIn_<Tail, readonly [...Out, T]>
    : Out
    : Out

  /**
   * @since 4.0.0
   */
  export type MakeIn<E extends Elements> = MakeIn_<E>
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface ReadonlyTuple<Elements extends Tuple.Elements> extends
  Bottom<
    Tuple.Type<Elements>,
    Tuple.Encoded<Elements>,
    Tuple.DecodingContext<Elements>,
    Tuple.EncodingContext<Elements>,
    Tuple.IntrinsicContext<Elements>,
    SchemaAST.TupleType,
    ReadonlyTuple<Elements>,
    SchemaAST.Annotations.Bottom,
    Tuple.MakeIn<Elements>
  >
{
  readonly elements: Elements
}

class ReadonlyTuple$<Elements extends Tuple.Elements> extends make$<ReadonlyTuple<Elements>>
  implements ReadonlyTuple<Elements>
{
  readonly elements: Elements
  constructor(ast: SchemaAST.TupleType, elements: Elements) {
    super(ast, (ast) => new ReadonlyTuple$(ast, elements))
    this.elements = { ...elements }
  }
}

/**
 * @since 4.0.0
 */
export function ReadonlyTuple<const Elements extends ReadonlyArray<Top>>(elements: Elements): ReadonlyTuple<Elements> {
  return new ReadonlyTuple$(
    new SchemaAST.TupleType(
      true,
      elements.map((element) => element.ast),
      [],
      undefined,
      undefined,
      undefined,
      undefined
    ),
    elements
  )
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface ReadonlyArray$<S extends Top> extends
  Bottom<
    ReadonlyArray<S["Type"]>,
    ReadonlyArray<S["Encoded"]>,
    S["DecodingContext"],
    S["EncodingContext"],
    S["IntrinsicContext"],
    SchemaAST.TupleType,
    ReadonlyArray$<S>,
    SchemaAST.Annotations.Bottom,
    ReadonlyArray<S["~type.make.in"]>
  >
{
  readonly item: S
}

class ReadonlyArray$$<S extends Top> extends make$<ReadonlyArray$<S>> implements ReadonlyArray$<S> {
  readonly item: S
  constructor(ast: SchemaAST.TupleType, item: S) {
    super(ast, (ast) => new ReadonlyArray$$(ast, item))
    this.item = item
  }
}

/**
 * @since 4.0.0
 */
export function ReadonlyArray<S extends Top>(item: S): ReadonlyArray$<S> {
  return new ReadonlyArray$$(
    new SchemaAST.TupleType(true, [], [item.ast], undefined, undefined, undefined, undefined),
    item
  )
}

/**
 * @since 4.0.0
 */
export interface Union<Members extends ReadonlyArray<Top>> extends
  Bottom<
    Members[number]["Type"],
    Members[number]["Encoded"],
    Members[number]["DecodingContext"],
    Members[number]["EncodingContext"],
    Members[number]["IntrinsicContext"],
    SchemaAST.UnionType,
    Union<Members>,
    SchemaAST.Annotations.Bottom,
    Members[number]["~type.make.in"]
  >
{
  readonly members: Members
}

class Union$<Members extends ReadonlyArray<Top>> extends make$<Union<Members>> implements Union<Members> {
  constructor(readonly ast: SchemaAST.UnionType, readonly members: Members) {
    super(ast, (ast) => new Union$(ast, members))
  }
}

/**
 * @since 4.0.0
 */
export function Union<const Members extends ReadonlyArray<Top>>(members: Members): Union<Members> {
  const ast = new SchemaAST.UnionType(members.map((type) => type.ast), undefined, undefined, undefined, undefined)
  return new Union$(ast, members)
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Literals<L extends ReadonlyArray<SchemaAST.LiteralValue>> extends
  Bottom<
    L[number],
    L[number],
    never,
    never,
    never,
    SchemaAST.UnionType,
    Literals<L>,
    SchemaAST.Annotations.Bottom,
    L[number]
  >
{
  readonly literals: L
}

class Literals$<L extends ReadonlyArray<SchemaAST.LiteralValue>> extends make$<Literals<L>> implements Literals<L> {
  constructor(ast: SchemaAST.UnionType, readonly literals: L) {
    super(ast, (ast) => new Literals$(ast, literals))
  }
}

/**
 * @since 4.0.0
 */
export function Literals<const L extends ReadonlyArray<SchemaAST.LiteralValue>>(literals: L): Literals<L> {
  return new Literals$(
    new SchemaAST.UnionType(
      literals.map((literal) => Literal(literal).ast),
      undefined,
      undefined,
      undefined,
      undefined
    ),
    literals
  )
}

/**
 * @since 4.0.0
 */
export function NullOr<S extends Top>(self: S) {
  return Union([self, Null])
}

/**
 * @since 4.0.0
 */
export function UndefinedOr<S extends Top>(self: S) {
  return Union([self, Undefined])
}

/**
 * @category Api interface
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
    S["~type.make.in"]
  >
{}

/**
 * @category constructors
 * @since 4.0.0
 */
export const suspend = <S extends Top>(f: () => S): suspend<S> =>
  make<suspend<S>>(new SchemaAST.Suspend(() => f().ast, undefined, undefined, undefined, undefined))

/**
 * @category Filtering
 * @since 4.0.0
 */
export const check = <S extends Top>(
  ...filters: readonly [SchemaFilter.Filters<S["Type"]>, ...ReadonlyArray<SchemaFilter.Filters<S["Type"]>>]
) =>
(self: S): S["~rebuild.out"] => {
  return self.rebuild(SchemaAST.appendModifiers(self.ast, filters))
}

/**
 * @category Filtering
 * @since 4.0.0
 */
export const checkEncoded = <S extends Top>(
  ...filters: readonly [SchemaFilter.Filters<S["Encoded"]>, ...ReadonlyArray<SchemaFilter.Filters<S["Encoded"]>>]
) =>
(self: S): S["~rebuild.out"] => {
  return self.rebuild(SchemaAST.appendEncodedModifiers(self.ast, filters))
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface checkEffect<S extends Top, R> extends make<S> {
  readonly "~rebuild.out": checkEffect<S, R>
  readonly "IntrinsicContext": S["IntrinsicContext"] | R
}

/**
 * @category Filtering
 * @since 4.0.0
 */
export const checkEffect = <
  S extends Top,
  Filters extends readonly [
    SchemaFilter.Filters<S["Type"], any>,
    ...ReadonlyArray<SchemaFilter.Filters<S["Type"], any>>
  ]
>(
  ...filters: Filters
) =>
(self: S): checkEffect<S, Filters[number]["Context"]> => {
  return make<checkEffect<S, Filters[number]["Context"]>>(SchemaAST.appendModifiers(self.ast, filters))
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface refine<T, S extends Top> extends make<S> {
  readonly "~rebuild.out": refine<T, S>
  readonly "Type": T
}

/**
 * @category Filtering
 * @since 4.0.0
 */
export const refine = <T, S extends Top>(
  is: (value: S["Type"]) => value is T,
  annotations?: SchemaAST.Annotations.Documentation
) =>
(self: S): refine<T, S> => {
  return make<refine<T, S>>(
    SchemaAST.appendModifiers(self.ast, [
      new SchemaFilter.Filter(
        (input, ast) =>
          is(input) ?
            undefined :
            new SchemaIssue.MismatchIssue(ast, O.some(input)),
        true, // after a refinement, we always want to bail out
        annotations
      )
    ])
  )
}

const catch_ =
  <S extends Top>(f: (issue: SchemaIssue.Issue) => SchemaResult.SchemaResult<O.Option<S["Type"]>>) =>
  (self: S): S["~rebuild.out"] => {
    return self.rebuild(
      SchemaAST.appendModifiers(
        self.ast,
        [
          new SchemaAST.Middleware(
            SchemaMiddleware.catch(f),
            SchemaMiddleware.identity()
          )
        ]
      )
    )
  }

export {
  /**
   * @category Middlewares
   * @since 4.0.0
   */
  catch_ as catch
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface decodeMiddleware<S extends Top, RD, RI> extends make<S> {
  readonly "~rebuild.out": decodeMiddleware<S, RD, RI>
  readonly "DecodingContext": RD
  readonly "IntrinsicContext": RI
}

class decodeMiddleware$<S extends Top, RD, RI> extends make$<decodeMiddleware<S, RD, RI>>
  implements decodeMiddleware<S, RD, RI>
{
  constructor(ast: SchemaAST.AST, readonly schema: S) {
    super(ast, (ast) => new decodeMiddleware$(ast, this.schema))
  }
}

/**
 * @since 4.0.0
 */
export const decodeMiddleware = <S extends Top, R>(
  middleware: SchemaAST.Middleware<S["Encoded"], S["DecodingContext"], S["Type"], R>
) =>
(self: S): decodeMiddleware<S, R, Exclude<S["IntrinsicContext"], Exclude<S["DecodingContext"], R>>> => {
  return new decodeMiddleware$(SchemaAST.appendModifiers(self.ast, [middleware]), self)
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface brand<S extends Top, B extends string | symbol> extends make<S> {
  readonly "Type": S["Type"] & Brand<B>
  readonly "~rebuild.out": brand<S["~rebuild.out"], B>
  readonly schema: S
  readonly brand: B
}

class brand$<S extends Top, B extends string | symbol> extends make$<brand<S, B>> implements brand<S, B> {
  constructor(readonly schema: S, readonly brand: B) {
    super(
      schema.ast,
      (ast) => new brand$(this.schema.rebuild(ast), this.brand)
    )
  }
}

/**
 * @since 4.0.0
 */
export const brand = <B extends string | symbol>(brand: B) => <S extends Top>(self: S): brand<S, B> => {
  return new brand$(self, brand)
}

/**
 * @since 4.0.0
 */
export const decodeTo = <From extends Top, To extends Top, RD, RE>(
  to: To,
  transformation: SchemaTransformation.Transformation<From["Type"], To["Encoded"], RD, RE>
) =>
(from: From): encodeTo<To, From, RD, RE> => {
  return make(SchemaAST.decodeTo(from.ast, to.ast, transformation))
}

/**
 * @category Api interface
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
    From["~type.make.in"],
    From["~type.isReadonly"],
    From["~type.isOptional"],
    From["~type.default"],
    To["~encoded.isReadonly"],
    To["~encoded.isOptional"]
  >
{}

/**
 * @since 4.0.0
 */
export const encodeTo = <From extends Top, To extends Top, RD, RE>(
  to: To,
  transformation: SchemaTransformation.Transformation<To["Type"], From["Encoded"], RD, RE>
) =>
(from: From): encodeTo<From, To, RD, RE> => {
  return to.pipe(decodeTo(from, transformation))
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface setConstructorDefault<S extends Top> extends make<S> {
  readonly "~rebuild.out": setConstructorDefault<S>
  readonly "~type.default": "has-constructor-default"
}

/**
 * @since 4.0.0
 */
export const setConstructorDefault = <S extends Top & { readonly "~type.default": "no-constructor-default" }>(
  parser: (
    input: O.Option<unknown>,
    ast: SchemaAST.AST,
    options: SchemaAST.ParseOptions
  ) => SchemaResult.SchemaResult<O.Option<S["~type.make.in"]>>,
  annotations?: SchemaAST.Annotations.Documentation
) =>
(self: S): setConstructorDefault<S> => {
  return make<setConstructorDefault<S>>(SchemaAST.setConstructorDefault(
    self.ast,
    new SchemaTransformation.Transformation(
      new SchemaParser.Parser(
        (o, ast, options) => {
          if (O.isNone(o) || (O.isSome(o) && o.value === undefined)) {
            return parser(o, ast, options)
          } else {
            return Result.ok(o)
          }
        },
        annotations
      ),
      SchemaParser.identity()
    )
  ))
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Class<Self, S extends Struct<Struct.Fields>, Inherited> extends
  Bottom<
    Self,
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
    S["IntrinsicContext"],
    SchemaAST.Declaration,
    Class<Self, S, Self>,
    SchemaAST.Annotations.Declaration<Self>,
    S["~type.make.in"],
    S["~type.isReadonly"],
    S["~type.isOptional"],
    S["~type.default"],
    S["~encoded.isReadonly"],
    S["~encoded.isOptional"]
  >
{
  new(props: S["~type.make.in"], options?: MakeOptions): S["Type"] & Inherited
  readonly "~encoded.make.in": S["~encoded.make.in"]
  readonly identifier: string
  readonly fields: S["fields"]
}

function makeClass<
  Self,
  S extends Struct<Struct.Fields>,
  Inherited extends new(...args: ReadonlyArray<any>) => any
>(
  Inherited: Inherited,
  identifier: string,
  schema: S,
  computeAST: (self: Class<Self, S, Inherited>) => SchemaAST.Declaration
): any {
  let astMemo: SchemaAST.Declaration | undefined = undefined

  return class extends Inherited {
    constructor(...[input, options]: ReadonlyArray<any>) {
      const props = schema.makeUnsafe(input, options)
      super(props, options)
    }

    static readonly "~effect/Schema" = "~effect/Schema"

    declare static readonly "Type": Self
    declare static readonly "Encoded": S["Encoded"]
    declare static readonly "DecodingContext": S["DecodingContext"]
    declare static readonly "EncodingContext": S["EncodingContext"]
    declare static readonly "IntrinsicContext": S["IntrinsicContext"]

    declare static readonly "~rebuild.out": Class<Self, S, Self>
    declare static readonly "~annotate.in": SchemaAST.Annotations.Declaration<Self>
    declare static readonly "~type.make.in": S["~type.make.in"]

    declare static readonly "~type.isReadonly": S["~type.isReadonly"]
    declare static readonly "~type.isOptional": S["~type.isOptional"]
    declare static readonly "~type.default": S["~type.default"]

    declare static readonly "~encoded.isReadonly": S["~encoded.isReadonly"]
    declare static readonly "~encoded.isOptional": S["~encoded.isOptional"]

    declare static readonly "~encoded.make.in": S["~encoded.make.in"]

    static readonly identifier = identifier
    static readonly fields = schema.fields

    static get ast(): SchemaAST.Declaration {
      if (astMemo === undefined) {
        astMemo = computeAST(this)
      }
      return astMemo
    }
    static pipe() {
      return pipeArguments(this, arguments)
    }
    static rebuild(ast: SchemaAST.Declaration): Class<Self, S, Self> {
      const original = this.ast
      return class extends this {
        static get ast() {
          const makeEncoding = makeDefaultClassEncoding(this)
          const d = new SchemaAST.Declaration(
            [original],
            () => (input, ast) => {
              if (input instanceof this) {
                return Result.ok(input)
              }
              return Result.err(new SchemaIssue.MismatchIssue(ast, O.some(input)))
            },
            {
              serializer: ([ast]: [SchemaAST.AST]) => makeEncoding(ast),
              ...ast.annotations
            },
            ast.modifiers,
            makeEncoding(original),
            ast.context
          )
          return d
        }
      }
    }
    static annotate(annotations: SchemaAST.Annotations.Bottom): Class<Self, S, Self> {
      return this.rebuild(SchemaAST.annotate(this.ast, annotations))
    }
    static make(input: S["~type.make.in"], options?: MakeOptions): SchemaResult.SchemaResult<Self> {
      return SchemaResult.map(
        schema.make(input, options),
        (input) => new this(input, options)
      )
    }
    static makeUnsafe(input: S["~type.make.in"], options?: MakeOptions): Self {
      return new this(input, options)
    }
  }
}

const makeDefaultClassEncoding = (self: new(...args: ReadonlyArray<any>) => any) => (ast: SchemaAST.AST) =>
  new SchemaAST.Encoding([
    new SchemaAST.Link(
      new SchemaTransformation.Transformation(
        SchemaParser.onSome((input) => Result.succeedSome(new self(input))),
        SchemaParser.onSome((input) => {
          if (!(input instanceof self)) {
            return Result.err(new SchemaIssue.MismatchIssue(ast, input))
          }
          return Result.succeedSome(input)
        })
      ),
      ast
    )
  ])

function getDefaultComputeAST(
  from: SchemaAST.AST,
  annotations?: SchemaAST.Annotations.Declaration<unknown>
) {
  return (self: any) => {
    const makeEncoding = makeDefaultClassEncoding(self)
    return new SchemaAST.Declaration(
      [from],
      () => (input, ast) => {
        if (input instanceof self) {
          return Result.ok(input)
        }
        return Result.err(new SchemaIssue.MismatchIssue(ast, O.some(input)))
      },
      {
        serializer: ([ast]: [SchemaAST.AST]) => makeEncoding(ast),
        ...annotations
      },
      undefined,
      makeEncoding(from),
      undefined
    )
  }
}

/**
 * @since 4.0.0
 */
export const Class: {
  <Self>(identifier: string): {
    <const Fields extends Struct.Fields>(
      fields: Fields,
      annotations?: SchemaAST.Annotations.Bottom
    ): Class<Self, Struct<Fields>, {}>
    <S extends Struct<Struct.Fields>>(
      schema: S,
      annotations?: SchemaAST.Annotations.Bottom
    ): Class<Self, S, {}>
  }
} = <Self>(identifier: string) =>
(
  schema: Struct.Fields | Struct<Struct.Fields>,
  annotations?: SchemaAST.Annotations.Bottom
): Class<Self, Struct<Struct.Fields>, {}> => {
  const struct = isSchema(schema) ? schema : Struct(schema)

  return makeClass(
    Data.Class,
    identifier,
    struct,
    getDefaultComputeAST(struct.ast, { title: identifier, ...annotations })
  )
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Error<Self, S extends Struct<Struct.Fields>, Inherited> extends Class<Self, S, Inherited> {
  readonly "~rebuild.out": Error<Self, S, Self>
}

/**
 * @since 4.0.0
 */
export const Error: {
  <Self>(identifier: string): {
    <const Fields extends Struct.Fields>(
      fields: Fields,
      annotations?: SchemaAST.Annotations.Bottom
    ): Error<Self, Struct<Fields>, Cause.YieldableError>
    <S extends Struct<Struct.Fields>>(
      schema: S,
      annotations?: SchemaAST.Annotations.Bottom
    ): Error<Self, S, Cause.YieldableError>
  }
} = <Self>(identifier: string) =>
(
  schema: Struct.Fields | Struct<Struct.Fields>,
  annotations?: SchemaAST.Annotations.Bottom
): Error<Self, Struct<Struct.Fields>, Cause.YieldableError> => {
  const struct = isSchema(schema) ? schema : Struct(schema)

  return makeClass(
    core.Error,
    identifier,
    struct,
    getDefaultComputeAST(struct.ast, { title: identifier, ...annotations })
  )
}

/**
 * @since 4.0.0
 */
export const URL = declare((u) => u instanceof globalThis.URL, {
  title: "URL",
  serializer: () =>
    new SchemaAST.Encoding([
      new SchemaAST.Link(
        new SchemaTransformation.Transformation<string, globalThis.URL>(
          SchemaParser.lift((s) => new globalThis.URL(s)),
          SchemaParser.lift((url) => url.toString())
        ),
        SchemaAST.stringKeyword
      )
    ])
})

/**
 * @since 4.0.0
 */
export const Date = declare(
  (u) => u instanceof globalThis.Date,
  {
    title: "Date",
    serializer: () =>
      new SchemaAST.Encoding([
        new SchemaAST.Link(
          new SchemaTransformation.Transformation<string, globalThis.Date>(
            SchemaParser.lift((s) => new globalThis.Date(s)),
            SchemaParser.lift((d) => d.toISOString())
          ),
          SchemaAST.stringKeyword
        )
      ])
  }
)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Option<S extends Top> extends
  declareConstructor<
    O.Option<S["Type"]>,
    O.Option<S["Encoded"]>,
    readonly [S],
    S["IntrinsicContext"]
  >
{
  readonly "~rebuild.out": Option<S>
}

/**
 * @since 4.0.0
 */
export const Option = <S extends Top>(value: S): Option<S> => {
  return declareConstructor([value])<O.Option<S["Encoded"]>>()(
    ([value]) => (oinput, ast, options) => {
      if (O.isOption(oinput)) {
        if (O.isNone(oinput)) {
          return Result.succeedNone
        }
        const input = oinput.value
        return SchemaResult.mapBoth(
          SchemaValidator.decodeUnknownSchemaResult(value)(input, options),
          {
            onSuccess: O.some,
            onFailure: (issue) => {
              const actual = O.some(oinput)
              return new SchemaIssue.CompositeIssue(ast, actual, [issue])
            }
          }
        )
      }
      return Result.err(new SchemaIssue.MismatchIssue(ast, O.some(oinput)))
    },
    {
      declaration: {
        title: "Option"
      },
      serializer: ([value]) =>
        new SchemaAST.Encoding([
          new SchemaAST.Link(
            new SchemaTransformation.Transformation(
              SchemaParser.lift(Arr.head),
              SchemaParser.lift(O.toArray)
            ),
            Union([ReadonlyTuple([make(value)]), ReadonlyTuple([])]).ast
          )
        ])
    }
  )
}

/**
 * @since 4.0.0
 */
export const NonEmptyString = String.pipe(check(SchemaFilter.nonEmpty))

/**
 * @since 4.0.0
 */
export const Finite = Number.pipe(check(SchemaFilter.finite))

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Map$<Key extends Top, Value extends Top> extends
  declareConstructor<
    globalThis.Map<Key["Type"], Value["Type"]>,
    globalThis.Map<Key["Encoded"], Value["Encoded"]>,
    readonly [Key, Value],
    Key["IntrinsicContext"] | Value["IntrinsicContext"]
  >
{
  readonly "~rebuild.out": Map$<Key, Value>
}

/**
 * @since 4.0.0
 */
export const Map = <Key extends Top, Value extends Top>(key: Key, value: Value): Map$<Key, Value> => {
  return declareConstructor([key, value])<globalThis.Map<Key["Encoded"], Value["Encoded"]>>()(
    ([key, value]) => (input, ast, options) => {
      if (input instanceof globalThis.Map) {
        const array = ReadonlyArray(ReadonlyTuple([key, value]))
        return SchemaResult.mapBoth(
          SchemaValidator.decodeUnknownSchemaResult(array)([...input.entries()], options),
          {
            onSuccess: (array: ReadonlyArray<readonly [Key["Type"], Value["Type"]]>) => new globalThis.Map(array),
            onFailure: (issue) => new SchemaIssue.CompositeIssue(ast, O.some(input), [issue])
          }
        )
      }
      return Result.err(new SchemaIssue.MismatchIssue(ast, O.some(input)))
    },
    {
      declaration: {
        title: "Map"
      },
      serializer: ([key, value]) =>
        new SchemaAST.Encoding([
          new SchemaAST.Link(
            new SchemaTransformation.Transformation(
              SchemaParser.lift((entries) => new globalThis.Map(entries)),
              SchemaParser.lift((map) => [...map.entries()])
            ),
            ReadonlyArray(ReadonlyTuple([make(key), make(value)])).ast
          )
        ])
    }
  )
}
