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
export type Merge<T, U> = keyof T & keyof U extends never ? T & U : Omit<T, keyof T & keyof U> & U

/**
 * @since 4.0.0
 */
export declare namespace Annotations {
  /**
   * @category annotations
   * @since 4.0.0
   */
  export interface Documentation extends SchemaAST.Annotations.Documentation {}

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
export interface MakeOptions {
  readonly skipValidation?: boolean | undefined
  readonly parseOptions?: SchemaAST.ParseOptions | undefined
}

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
  ): SchemaParserResult.SchemaParserResult<this["Type"]>
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
  ): SchemaParserResult.SchemaParserResult<this["Type"]> {
    if (options?.skipValidation) {
      return Result.ok(input) as any
    }
    const parseOptions: SchemaAST.ParseOptions = { variant: "make", ...options?.parseOptions }
    return SchemaParser.validateUnknownParserResult(this)(input, parseOptions) as any
  }
  makeUnsafe(input: this["~type.make.in"], options?: MakeOptions): this["Type"] {
    return Result.getOrThrowWith(
      SchemaParser.runSyncResult(this.make(input, options)),
      (issue) => new Error(`makeUnsafe failure`, { cause: issue })
    )
  }
  annotate(annotations: this["~annotate.in"]): this["~rebuild.out"] {
    return this.rebuild(SchemaAST.annotate(this.ast, annotations))
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
    OptionalToken
  >
{}

/**
 * @category model
 * @since 4.0.0
 */
export interface Schema<out T> extends Top {
  readonly "Type": T
  readonly "~rebuild.out": Schema<T>
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
  readonly "~rebuild.out": Codec<T, E, RD, RE, RI>
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
 * @category api interface
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
 * @category api interface
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
export const declare = <T>(options: {
  readonly guard: (u: unknown) => u is T
}): declare<T> => {
  return make<declare<T>>(
    new SchemaAST.Declaration(
      [],
      () => (input) =>
        options.guard(input) ?
          Result.ok(input) :
          Result.err(new SchemaAST.InvalidValueIssue(O.some(input))),
      undefined,
      undefined,
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
        undefined,
        undefined,
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
{
  readonly literal: L
}

class Literal$<L extends SchemaAST.LiteralValue> extends make$<Literal<L>> implements Literal<L> {
  constructor(ast: SchemaAST.Literal, readonly literal: L) {
    super(ast, (ast) => new Literal$(ast, literal))
  }
}

/**
 * @since 4.0.0
 */
export const Literal = <L extends SchemaAST.LiteralValue>(literal: L): Literal<L> =>
  new Literal$(new SchemaAST.Literal(literal, undefined, undefined, undefined, undefined), literal)

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
export interface Unknown
  extends
    Bottom<unknown, unknown, never, never, never, SchemaAST.UnknownKeyword, Unknown, SchemaAST.Annotations, unknown>
{}

/**
 * @since 4.0.0
 */
export const Unknown: Unknown = make<Unknown>(SchemaAST.unknownKeyword)

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
  export type Type<F extends Fields> = Simplify<Type_<F>>

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
  export type MakeIn<F extends Fields> = Simplify<MakeIn_<F>>
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Struct<Fields extends Struct.Fields> extends
  Bottom<
    Struct.Type<Fields>,
    Struct.Encoded<Fields>,
    Struct.DecodingContext<Fields>,
    Struct.EncodingContext<Fields>,
    Struct.IntrinsicContext<Fields>,
    SchemaAST.TypeLiteral,
    Struct<Fields>,
    Annotations.Annotations,
    Struct.MakeIn<Fields>
  >
{
  readonly fields: Fields
  extend<NewFields extends Struct.Fields>(newFields: NewFields): Struct<Simplify<Fields & NewFields>>
  pick<Keys extends keyof Fields>(keys: ReadonlyArray<Keys>): Struct<Simplify<Pick<Fields, Keys>>>
  omit<Keys extends keyof Fields>(keys: ReadonlyArray<Keys>): Struct<Simplify<Omit<Fields, Keys>>>
}

class Struct$<Fields extends Struct.Fields> extends make$<Struct<Fields>> implements Struct<Fields> {
  readonly fields: Fields
  constructor(ast: SchemaAST.TypeLiteral, fields: Fields) {
    super(ast, (ast) => new Struct$(ast, fields))
    this.fields = { ...fields }
  }
  extend<NewFields extends Struct.Fields>(newFields: NewFields): Struct<Fields & NewFields> {
    const fields = { ...this.fields, ...newFields }
    const out = Struct(fields)
    const filters = this.ast.filters
    if (filters) {
      const ast = SchemaAST.replaceFilters(out.ast, filters)
      return new Struct$(ast, fields)
    } else {
      return out
    }
  }
  pick<Keys extends keyof Fields>(keys: ReadonlyArray<Keys>): Struct<Pick<Fields, Keys>> {
    return Struct(Struct_.pick(this.fields, ...keys))
  }
  omit<Keys extends keyof Fields>(keys: ReadonlyArray<Keys>): Struct<Omit<Fields, Keys>> {
    return Struct(Struct_.omit(this.fields, ...keys))
  }
}

/**
 * @since 4.0.0
 */
export function Struct<const Fields extends Struct.Fields>(fields: Fields): Struct<Fields> {
  const ast = new SchemaAST.TypeLiteral(
    ownKeys(fields).map((key) => {
      return new SchemaAST.PropertySignature(key, fields[key].ast, undefined)
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
export declare namespace Tuple {
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
export interface Tuple<Elements extends Tuple.Elements> extends
  Bottom<
    Tuple.Type<Elements>,
    Tuple.Encoded<Elements>,
    Tuple.DecodingContext<Elements>,
    Tuple.EncodingContext<Elements>,
    Tuple.IntrinsicContext<Elements>,
    SchemaAST.TupleType,
    Tuple<Elements>,
    Annotations.Annotations,
    { readonly [K in keyof Elements]: Elements[K]["~type.make.in"] }
  >
{
  readonly elements: Elements
}

class Tuple$<Elements extends Tuple.Elements> extends make$<Tuple<Elements>> implements Tuple<Elements> {
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
      elements.map((element) => new SchemaAST.Element(element.ast, undefined)),
      [],
      true,
      undefined,
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
    Annotations.Annotations,
    ReadonlyArray<S["~type.make.in"]>
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
    new SchemaAST.TupleType([], [item.ast], true, undefined, undefined, undefined, undefined),
    item
  )
}

/**
 * @category api interface
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
    S["~type.make.in"]
  >
{}

/**
 * @category constructors
 * @since 4.0.0
 */
export const suspend = <S extends Top>(f: () => S): suspend<S> =>
  make<suspend<S>>(new SchemaAST.Suspend(() => f().ast, undefined, undefined, undefined, undefined))

function issueFromFilterOut(out: FilterOut, input: unknown): SchemaAST.Issue | undefined {
  if (out === undefined) {
    return undefined
  }
  if (Predicate.isBoolean(out)) {
    return out ? undefined : new SchemaAST.InvalidValueIssue(O.some(input))
  }
  if (Predicate.isString(out)) {
    return new SchemaAST.InvalidValueIssue(O.some(input), out)
  }
  return out
}

type FilterOut = undefined | boolean | string | SchemaAST.Issue

/**
 * @category filtering
 * @since 4.0.0
 */
export const predicate = <T>(
  filter: (input: T, options: SchemaAST.ParseOptions) => FilterOut,
  annotations?: Annotations.Documentation
): SchemaAST.Filter<T> => {
  return new SchemaAST.Filter<T>(
    (input, options) => issueFromFilterOut(filter(input, options), input),
    false,
    annotations
  )
}

/**
 * @category filtering
 * @since 4.0.0
 */
export const filter = <S extends Top>(
  ...filters: SchemaAST.Filters<S["Type"]>
) =>
(self: S): S["~rebuild.out"] => {
  return self.rebuild(SchemaAST.filterGroup(self.ast, filters))
}

/**
 * @category filtering
 * @since 4.0.0
 */
export const filterEncoded = <S extends Top>(
  filter: (encoded: S["Encoded"], options: SchemaAST.ParseOptions) => FilterOut,
  annotations?: Annotations.Documentation
) =>
(self: S): S["~rebuild.out"] => {
  return self.rebuild(
    SchemaAST.filterGroupEncoded(
      self.ast,
      [
        new SchemaAST.Filter(
          (input, options) => issueFromFilterOut(filter(input, options), input),
          false,
          annotations
        )
      ]
    )
  )
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface filterEffect<S extends Top, R> extends make<S> {
  readonly "~rebuild.out": filterEffect<S, R>
  readonly "IntrinsicContext": S["IntrinsicContext"] | R
}

/**
 * @category filtering
 * @since 4.0.0
 */
export const filterEffect = <S extends Top, R>(
  filter: (type: S["Type"], options: SchemaAST.ParseOptions) => Effect.Effect<FilterOut, never, R>,
  annotations?: Annotations.Documentation
) =>
(self: S): filterEffect<S, R> => {
  return make<filterEffect<S, R>>(
    SchemaAST.filterGroup(
      self.ast,
      [
        new SchemaAST.Filter(
          (input, options) => Effect.map(filter(input, options), (out) => issueFromFilterOut(out, input)),
          false,
          annotations
        )
      ]
    )
  )
}

/**
 * @category String filters
 * @since 4.0.0
 */
export const trimmed = new SchemaAST.Filter<string>(
  (s) => issueFromFilterOut(s.trim() === s, s),
  false,
  {
    title: "trimmed",
    description: "a trimmed string"
  }
)

/**
 * @category Length filters
 * @since 4.0.0
 */
export const minLength = <T extends { readonly length: number }>(
  minLength: number
) => {
  minLength = Math.max(0, Math.floor(minLength))
  return predicate<T>((input) => input.length >= minLength, {
    title: `minLength(${minLength})`,
    description: `a value with a length of at least ${minLength}`
  })
}

/**
 * @category Length filters
 * @since 4.0.0
 */
export const maxLength = <T extends { readonly length: number }>(
  maxLength: number
) => {
  maxLength = Math.max(0, Math.floor(maxLength))
  return predicate<T>((input) => input.length <= maxLength, {
    title: `maxLength(${maxLength})`,
    description: `a value with a length of at most ${maxLength}`
  })
}

/**
 * @category Length filters
 * @since 4.0.0
 */
export const nonEmpty = minLength(1)

/**
 * @category Length filters
 * @since 4.0.0
 */
export const NonEmptyString = String.pipe(filter(nonEmpty))

/**
 * @category Order filters
 * @since 4.0.0
 */
const makeGreaterThan = <T>(O: Order.Order<T>) => {
  const greaterThan = Order.greaterThan(O)
  return (exclusiveMinimum: T) => {
    return predicate<T>((input) => greaterThan(input, exclusiveMinimum), {
      title: `greaterThan(${exclusiveMinimum})`,
      description: `a value greater than ${exclusiveMinimum}`
    })
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
  return make(SchemaAST.decodeTo(
    from.ast,
    to.ast,
    transformation
  ))
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
  transformation: SchemaAST.Transformation<NoInfer<To["Type"]>, From["Encoded"], RD, RE>
) =>
(from: From): encodeTo<From, To, RD, RE> => {
  return to.pipe(decodeTo(from, transformation))
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface withConstructorDefault<S extends Top> extends make<S> {
  readonly "~rebuild.out": withConstructorDefault<S>
  readonly "~type.default": "has-constructor-default"
}

/**
 * @since 4.0.0
 */
export const withConstructorDefault = <S extends Top & { readonly "~type.default": "no-constructor-default" }>(
  value: (
    input: O.Option<unknown>,
    options: SchemaAST.ParseOptions
  ) => SchemaParserResult.SchemaParserResult<O.Option<S["~type.make.in"]>>,
  annotations?: Annotations.Documentation
) =>
(self: S): withConstructorDefault<S> => {
  return make<withConstructorDefault<S>>(SchemaAST.withConstructorDefault(self.ast, value, annotations))
}

/**
 * @category Parsings
 * @since 4.0.0
 */
export function identityParsing<T>(annotations?: Annotations.Documentation): SchemaAST.Parsing<T, T, never> {
  return new SchemaAST.Parsing(Result.ok, { title: "identity", ...annotations })
}

/**
 * @category Parsings
 * @since 4.0.0
 */
export function trimParsing(
  annotations?: Annotations.Documentation
): SchemaAST.Parsing<O.Option<string>, O.Option<string>, never> {
  return new SchemaAST.Parsing(
    (os) => {
      if (O.isNone(os)) {
        return Result.none
      }
      return Result.some(os.value.trim())
    },
    { title: "trim", ...annotations }
  )
}

/**
 * @category Parsings
 * @since 4.0.0
 */
export function toStringParsing<T>(
  annotations?: Annotations.Documentation
): SchemaAST.Parsing<O.Option<T>, O.Option<string>, never> {
  return new SchemaAST.Parsing(
    (on) => {
      if (O.isNone(on)) {
        return Result.none
      }
      return Result.some(globalThis.String(on.value))
    },
    { title: "toStringParsing", ...annotations }
  )
}

/**
 * @category Parsings
 * @since 4.0.0
 */
export function failParsing<T>(
  issue: (o: O.Option<T>) => SchemaAST.Issue,
  annotations?: Annotations.Documentation
): SchemaAST.Parsing<O.Option<T>, O.Option<string>, never> {
  return new SchemaAST.Parsing((o) => Result.err(issue(o)), { title: "failParsing", ...annotations })
}

/**
 * @category Transformations
 * @since 4.0.0
 */
export const identityTransformation = <T>(): SchemaAST.PartialIso<T, T, never, never> => {
  const identity = identityParsing<T>()
  return new SchemaAST.PartialIso(identity, identity)
}

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
    new SchemaAST.Parsing(
      (input, options) => {
        onDecode(input, options)
        const output = transformation.decode.parser(input, options)
        return output
      },
      transformation.decode.annotations
    ),
    new SchemaAST.Parsing(
      (input, options) => {
        onEncode(input, options)
        const output = transformation.encode.parser(input, options)
        return output
      },
      transformation.encode.annotations
    )
  )
}

/**
 * @category Transformations
 * @since 4.0.0
 */
export const trim: SchemaAST.Transformation<string, string, never, never> = new SchemaAST.Transformation(
  trimParsing(),
  identityParsing()
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
  new SchemaAST.Parsing(
    (os) => {
      if (O.isNone(os)) {
        return Result.none
      }
      const s = os.value
      const n = globalThis.Number(s)
      return isNaN(n)
        ? Result.err(new SchemaAST.InvalidValueIssue(O.some(s), `Cannot convert "${s}" to a number`))
        : Result.some(n)
    },
    { title: "parseNumber" }
  ),
  toStringParsing()
)

/**
 * @category String transformations
 * @since 4.0.0
 */
export const NumberFromString = String.pipe(decodeTo(Number, parseNumber))

/**
 * @category Generic transformations
 * @since 4.0.0
 */
export const withDecodingDefault = <A>(a: () => A) =>
  new SchemaAST.Transformation<A, A>(
    new SchemaAST.Parsing(
      (oa) => Result.ok(O.orElse(oa, () => O.some(a()))),
      { title: "withDecodingDefault" }
    ),
    new SchemaAST.Parsing(
      (oa) => {
        if (O.isNone(oa)) {
          return Result.err(SchemaAST.MissingValueIssue.instance)
        }
        return Result.some(oa.value)
      },
      { title: "withEncodingDefault" }
    )
  )

/**
 * @category Generic transformations
 * @since 4.0.0
 */
export const withEncodingDefault = <A>(a: () => A) => withDecodingDefault(a).flip()

/**
 * @category api interface
 * @since 4.0.0
 */
export interface Class<Self, Fields extends Struct.Fields, S extends Top, Inherited> extends
  Bottom<
    Self,
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
    S["IntrinsicContext"],
    SchemaAST.Declaration,
    Class<Self, Fields, S, Self>,
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.isReadonly"],
    S["~type.isOptional"],
    S["~type.default"],
    S["~encoded.isReadonly"],
    S["~encoded.isOptional"]
  >
{
  new(fields: Struct.MakeIn<Fields>, options?: MakeOptions): S["Type"] & Inherited
  readonly identifier: string
  readonly fields: Fields
  readonly schema: S
  extend<NewFields extends Struct.Fields>(
    newFields: NewFields
  ): Class<Self, Fields & NewFields, Struct<Fields & NewFields>, Self>
}

function makeClass<
  Self,
  Fields extends Struct.Fields,
  S extends Top,
  Inherited extends new(...args: ReadonlyArray<any>) => any
>(
  Inherited: Inherited,
  identifier: string,
  fields: Fields,
  schema: S,
  computeAST: (self: Class<Self, Fields, S, Inherited>) => SchemaAST.Declaration
): any {
  let astMemo: SchemaAST.Declaration | undefined = undefined

  return class Class$ extends Inherited {
    constructor(...[input, options]: ReadonlyArray<any>) {
      const props = schema.makeUnsafe(input, options)
      super(props, { ...options, skipValidation: true })
    }

    static readonly "~effect/Schema" = "~effect/Schema"
    static readonly "~effect/Schema/Class" = "~effect/Schema/Class"

    declare static readonly "Type": Self
    declare static readonly "Encoded": S["Encoded"]
    declare static readonly "DecodingContext": S["DecodingContext"]
    declare static readonly "EncodingContext": S["EncodingContext"]
    declare static readonly "IntrinsicContext": S["IntrinsicContext"]

    declare static readonly "~rebuild.out": Class<Self, Fields, S, Self>
    declare static readonly "~annotate.in": S["~annotate.in"]
    declare static readonly "~type.make.in": Struct.MakeIn<Fields>

    declare static readonly "~type.isReadonly": S["~type.isReadonly"]
    declare static readonly "~type.isOptional": S["~type.isOptional"]
    declare static readonly "~type.default": S["~type.default"]

    declare static readonly "~encoded.isReadonly": S["~encoded.isReadonly"]
    declare static readonly "~encoded.isOptional": S["~encoded.isOptional"]

    declare static readonly "~encoded.make.in": S["~encoded.make.in"]

    static readonly identifier = identifier
    static readonly fields = fields
    static readonly schema = schema

    static extend<NewFields extends Struct.Fields>(
      newFields: NewFields
    ): Class<Self, Fields & NewFields, Struct<Fields & NewFields>, Self> {
      const struct = Struct({ ...fields, ...newFields })
      return makeClass(
        this,
        identifier,
        struct.fields,
        struct,
        defaultComputeAST(struct, identifier)
      )
    }

    static get ast(): SchemaAST.Declaration {
      if (astMemo === undefined) {
        astMemo = computeAST(this)
      }
      return astMemo
    }
    static pipe() {
      return pipeArguments(this, arguments)
    }
    static rebuild(ast: SchemaAST.Declaration): Class<Self, Fields, S, Self> {
      return makeClass(this, identifier, fields, schema, () => ast)
    }
    static annotate(annotations: Annotations.Annotations): Class<Self, Fields, S, Self> {
      return this.rebuild(SchemaAST.annotate(this.ast, annotations))
    }
    static make(input: S["~type.make.in"], options?: MakeOptions): SchemaParserResult.SchemaParserResult<Self> {
      return SchemaParserResult.map(
        schema.make(input, options),
        (input) => new this(input, { ...options, skipValidation: true })
      )
    }
    static makeUnsafe(input: S["~type.make.in"], options?: MakeOptions): Self {
      return new this(input, options)
    }
    static toString() {
      return `${this.ast}`
    }
  }
}

function defaultComputeAST<const Fields extends Struct.Fields, S extends Top & { readonly fields: Fields }>(
  schema: S,
  identifier: string,
  annotations?: Annotations.Annotations
) {
  return (self: any) => {
    return new SchemaAST.Declaration(
      [],
      () => (input) => {
        if (!(input instanceof self)) {
          return Result.err(new SchemaAST.MismatchIssue(schema.ast, O.some(input)))
        }
        return Result.ok(input)
      },
      new SchemaAST.Ctor(self, identifier),
      annotations,
      undefined,
      new SchemaAST.Encoding([
        new SchemaAST.Link(
          new SchemaAST.Transformation(
            new SchemaAST.Parsing(
              (oinput) => {
                if (O.isNone(oinput)) {
                  return Result.none
                }
                return Result.some(new self(oinput.value))
              },
              undefined
            ),
            new SchemaAST.Parsing(
              (oinput) => {
                if (O.isNone(oinput)) {
                  return Result.none
                }
                const input = oinput.value
                if (!(input instanceof self)) {
                  return Result.err(new SchemaAST.MismatchIssue(schema.ast, input))
                }
                return Result.some(input)
              },
              undefined
            )
          ),
          schema.ast
        )
      ]),
      undefined
    )
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export const Class: {
  <Self>(identifier: string): {
    <const Fields extends Struct.Fields>(
      fields: Fields,
      annotations?: Annotations.Annotations
    ): Class<Self, Fields, Struct<Fields>, {}>
    <const Fields extends Struct.Fields, S extends Top & { readonly fields: Fields }>(
      schema: S,
      annotations?: Annotations.Annotations
    ): Class<Self, S["fields"], S, {}>
  }
} = <Self>(identifier: string) =>
<const Fields extends Struct.Fields>(
  schema: Fields | Top & { readonly fields: Fields },
  annotations?: Annotations.Annotations
): Class<Self, Fields, Struct<Fields>, {}> => {
  const struct = isSchema(schema) ? schema : Struct(schema)

  const Inherited = isSchema(schema) && schema.ast._tag === "Declaration" && schema.ast.ctor
    ? schema.ast.ctor.ctor :
    Data.Class

  return makeClass(
    Inherited,
    identifier,
    struct.fields,
    struct,
    defaultComputeAST(struct, identifier, annotations)
  )
}

/**
 * @category api interface
 * @since 4.0.0
 */
export interface TaggedError<Self, Tag extends string, Fields extends Struct.Fields, S extends Top, Inherited>
  extends Class<Self, Fields, S, Inherited>
{
  readonly "Encoded": Simplify<S["Encoded"] & { readonly _tag: Tag }>
  readonly "~rebuild.out": TaggedError<Self, Tag, Fields, S, Self>
  readonly "~encoded.make.in": Simplify<S["~encoded.make.in"] & { readonly _tag: Tag }>
  readonly _tag: Tag
}

/**
 * @category model
 * @since 4.0.0
 */
export const TaggedError: {
  <Self>(identifier?: string): {
    <Tag extends string, const Fields extends Struct.Fields>(
      tag: Tag,
      fields: Fields,
      annotations?: Annotations.Annotations
    ): TaggedError<Self, Tag, Fields, Struct<Fields>, Cause.YieldableError & { readonly _tag: Tag }>
    <
      Tag extends string,
      const Fields extends Struct.Fields,
      S extends Struct<Fields>
    >(
      tag: Tag,
      schema: S,
      annotations?: Annotations.Annotations
    ): TaggedError<Self, Tag, S["fields"], S, Cause.YieldableError & { readonly _tag: Tag }>
  }
} = <Self>(identifier?: string) =>
<Tag extends string, const Fields extends Struct.Fields>(
  tag: Tag,
  schema: Fields | Struct<Fields>,
  annotations?: Annotations.Annotations
): TaggedError<Self, Tag, Fields, Struct<Fields>, Cause.YieldableError & { readonly _tag: Tag }> => {
  identifier = identifier ?? tag
  const struct = isSchema(schema) ? schema : Struct(schema)

  class TaggedError$ extends core.TaggedError(tag) {
    static readonly _tag = tag
    get message(): string {
      return formatUnknown({ ...this })
    }
    toString() {
      return `${tag}(${this.message})`
    }
  }

  return makeClass(
    TaggedError$,
    tag,
    struct.fields,
    struct,
    defaultComputeAST(struct, identifier, annotations)
  )
}

const File_ = declare({ guard: (u) => u instanceof File })

export {
  /**
   * @since 4.0.0
   */
  File_ as File
}

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
    ([valueCodec]) => (input, ast, options) => {
      if (O.isOption(input)) {
        if (O.isNone(input)) {
          return Result.none
        }
        const value = input.value
        return SchemaParserResult.mapBoth(
          SchemaParser.decodeUnknownSchemaParserResult(valueCodec)(value, options),
          {
            onSuccess: O.some,
            onFailure: (issue) => {
              const actual = O.some(input)
              return new SchemaAST.CompositeIssue(ast, actual, [issue], actual)
            }
          }
        )
      }
      return Result.err(new SchemaAST.MismatchIssue(ast, O.some(input)))
    }
  )
}
