/**
 * @since 4.0.0
 */

import * as Arr from "./Array.js"
import type { Brand } from "./Brand.js"
import type * as Cause from "./Cause.js"
import * as Data from "./Data.js"
import * as Effect from "./Effect.js"
import { identity } from "./Function.js"
import * as core from "./internal/core.js"
import { ownKeys } from "./internal/schema/util.js"
import * as O from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"
import * as Predicate from "./Predicate.js"
import * as Request from "./Request.js"
import * as Result from "./Result.js"
import * as SchemaAST from "./SchemaAST.js"
import * as SchemaCheck from "./SchemaCheck.js"
import * as SchemaGetter from "./SchemaGetter.js"
import * as SchemaIssue from "./SchemaIssue.js"
import * as SchemaParser from "./SchemaParser.js"
import * as SchemaResult from "./SchemaResult.js"
import * as SchemaTransformation from "./SchemaTransformation.js"
import * as Struct_ from "./Struct.js"

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
  /**
   * @throws {Error} The issue is contained in the error cause.
   */
  makeSync(input: this["~type.make.in"], options?: MakeOptions): this["Type"]
}

/**
 * @since 4.0.0
 */
export const annotate = <S extends Top>(annotations: S["~annotate.in"]) => (schema: S): S["~rebuild.out"] => {
  return schema.rebuild(SchemaAST.annotate(schema.ast, annotations))
}

/**
 * @since 4.0.0
 */
export abstract class Bottom$<
  T,
  E,
  RD,
  RE,
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

  declare readonly "~rebuild.out": RebuildOut
  declare readonly "~annotate.in": AnnotateIn

  declare readonly "~type.make.in": TypeMakeIn
  declare readonly "~type.isReadonly": TypeReadonly
  declare readonly "~type.isOptional": TypeIsOptional
  declare readonly "~type.default": TypeDefault

  declare readonly "~encoded.isReadonly": EncodedIsReadonly
  declare readonly "~encoded.isOptional": EncodedIsOptional
  declare readonly "~encoded.make.in": E

  constructor(readonly ast: Ast) {}
  abstract rebuild(ast: this["ast"]): this["~rebuild.out"]
  pipe() {
    return pipeArguments(this, arguments)
  }
  makeSync(input: this["~type.make.in"], options?: MakeOptions): this["Type"] {
    return Result.getOrThrowWith(
      SchemaParser.runSyncSchemaResult(SchemaParser.make(this)(input, options)),
      (issue) =>
        new globalThis.Error(`makeSync failure, actual ${globalThis.String(input)}`, {
          cause: issue
        })
    )
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
 * @since 4.0.0
 */
export declare namespace Schema {
  /**
   * @since 4.0.0
   */
  export type Type<S extends Top> = S["Type"]
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Schema<out T> extends Top {
  readonly "Type": T
  readonly "~rebuild.out": Schema<T>
}

/**
 * @since 4.0.0
 */
export declare namespace Codec {
  /**
   * @since 4.0.0
   */
  export type Encoded<S extends Top> = S["Encoded"]
  /**
   * @since 4.0.0
   */
  export type DecodingContext<S extends Top> = S["DecodingContext"]
  /**
   * @since 4.0.0
   */
  export type EncodingContext<S extends Top> = S["EncodingContext"]
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Codec<out T, out E = T, out RD = never, out RE = never> extends Schema<T> {
  readonly "Encoded": E
  readonly "DecodingContext": RD
  readonly "EncodingContext": RE
  readonly "~rebuild.out": Codec<T, E, RD, RE>
}

/**
 * @since 4.0.0
 * @category error
 */
export class SchemaError extends Data.TaggedError("SchemaError")<{
  readonly issue: SchemaIssue.Issue
}> {}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeUnknown = <T, E, RD, RE>(codec: Codec<T, E, RD, RE>) => {
  const parser = SchemaParser.decodeUnknown(codec)
  return (u: unknown, options?: SchemaAST.ParseOptions): Effect.Effect<T, SchemaError, RD> => {
    return Effect.mapError(parser(u, options), (issue) => new SchemaError({ issue }))
  }
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decode = <T, E, RD, RE>(codec: Codec<T, E, RD, RE>) => {
  const parser = SchemaParser.decode(codec)
  return (e: E, options?: SchemaAST.ParseOptions): Effect.Effect<T, SchemaError, RD> => {
    return Effect.mapError(parser(e, options), (issue) => new SchemaError({ issue }))
  }
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeUnknownSync = SchemaParser.decodeUnknownSync

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeUnknown = <T, E, RD, RE>(codec: Codec<T, E, RD, RE>) => {
  const parser = SchemaParser.encodeUnknown(codec)
  return (u: unknown, options?: SchemaAST.ParseOptions): Effect.Effect<E, SchemaError, RE> => {
    return Effect.mapError(parser(u, options), (issue) => new SchemaError({ issue }))
  }
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encode = <T, E, RD, RE>(codec: Codec<T, E, RD, RE>) => {
  const parser = SchemaParser.encode(codec)
  return (t: T, options?: SchemaAST.ParseOptions): Effect.Effect<E, SchemaError, RE> => {
    return Effect.mapError(parser(t, options), (issue) => new SchemaError({ issue }))
  }
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeUnknownSync = SchemaParser.encodeUnknownSync

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

class schema$<S extends Top, Result extends Top> extends make$<Result> {
  constructor(ast: SchemaAST.AST, readonly schema: S) {
    super(ast, (ast) => new schema$(ast, this.schema))
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
export interface declare<T, E, TypeParameters extends ReadonlyArray<Top>> extends
  Bottom<
    T,
    E,
    TypeParameters[number]["DecodingContext"],
    TypeParameters[number]["EncodingContext"],
    SchemaAST.Declaration,
    declare<T, E, TypeParameters>,
    SchemaAST.Annotations.Declaration<T, TypeParameters>,
    T
  >
{
  readonly "~encoded.make.in": E
}

/**
 * @since 4.0.0
 */
export const declare =
  <const TypeParameters extends ReadonlyArray<Top>>(typeParameters: TypeParameters) =>
  <E>() =>
  <T>(
    is: (
      typeParameters: {
        readonly [K in keyof TypeParameters]: Codec<TypeParameters[K]["Type"], TypeParameters[K]["Encoded"]>
      }
    ) => (
      u: unknown,
      self: SchemaAST.Declaration,
      options: SchemaAST.ParseOptions
    ) => SchemaResult.SchemaResult<T>,
    annotations?: SchemaAST.Annotations.Declaration<T, TypeParameters>
  ): declare<
    T,
    E,
    TypeParameters
  > => {
    return make<declare<T, E, TypeParameters>>(
      new SchemaAST.Declaration(
        typeParameters.map((tp) => tp.ast),
        (typeParameters) => is(typeParameters.map(make) as any),
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
export interface declareRefinement<T> extends declare<T, T, readonly []> {}

/**
 * @since 4.0.0
 */
export const declareRefinement = <T>(
  options: {
    readonly is: (u: unknown) => u is T
    annotations?: SchemaAST.Annotations.Declaration<T, readonly []> | undefined
  }
): declareRefinement<T> => {
  return declare([])<T>()(
    () => (input, ast) =>
      options.is(input) ?
        Result.ok(input) :
        Result.err(new SchemaIssue.InvalidType(ast, O.some(input))),
    options.annotations
  )
}

/**
 * Returns the underlying `Codec<T, E, RD, RE>`.
 *
 * @since 4.0.0
 */
export function revealCodec<T, E, RD, RE>(codec: Codec<T, E, RD, RE>): Codec<T, E, RD, RE> {
  return codec
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Literal<L extends SchemaAST.LiteralValue>
  extends Bottom<L, L, never, never, SchemaAST.LiteralType, Literal<L>, SchemaAST.Annotations, L>
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
 * @since 4.0.0
 */
export declare namespace TemplateLiteral {
  /**
   * @since 4.0.0
   */
  export type Param = (Top & { readonly ast: SchemaAST.TemplateLiteralSpanType }) | SchemaAST.LiteralValue

  /**
   * @since 4.0.0
   */
  export type Params = readonly [Param, ...ReadonlyArray<Param>]

  type AppendType<
    Template extends string,
    Next
  > = Next extends SchemaAST.LiteralValue ? `${Template}${Next}`
    : Next extends Schema<infer A extends SchemaAST.LiteralValue> ? `${Template}${A}`
    : never

  /**
   * @since 4.0.0
   */
  export type Type<Params> = Params extends [...infer Init, infer Last] ? AppendType<Type<Init>, Last>
    : ``
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface TemplateLiteral<T>
  extends Bottom<T, T, never, never, SchemaAST.TemplateLiteral, TemplateLiteral<T>, SchemaAST.Annotations, T>
{}

/**
 * @since 4.0.0
 */
export function TemplateLiteral<Params extends TemplateLiteral.Params>(
  ...[head, ...tail]: Params
): TemplateLiteral<TemplateLiteral.Type<Params>> {
  const spans: Array<SchemaAST.TemplateLiteralSpan> = []
  let h = ""
  let ts = tail

  if (isSchema(head)) {
    if (SchemaAST.isLiteral(head.ast)) {
      h = globalThis.String(head.ast.literal)
    } else {
      ts = [head, ...ts]
    }
  } else {
    h = globalThis.String(head)
  }

  for (let i = 0; i < ts.length; i++) {
    const item = ts[i]
    if (isSchema(item)) {
      if (i < ts.length - 1) {
        const next = ts[i + 1]
        if (isSchema(next)) {
          if (SchemaAST.isLiteral(next.ast)) {
            spans.push(new SchemaAST.TemplateLiteralSpan(item.ast, globalThis.String(next.ast.literal)))
            i++
            continue
          }
        } else {
          spans.push(new SchemaAST.TemplateLiteralSpan(item.ast, globalThis.String(next)))
          i++
          continue
        }
      }
      spans.push(new SchemaAST.TemplateLiteralSpan(item.ast, ""))
    } else {
      spans.push(
        new SchemaAST.TemplateLiteralSpan(
          new SchemaAST.LiteralType(item, undefined, undefined, undefined, undefined),
          ""
        )
      )
    }
  }

  if (Arr.isNonEmptyArray(spans)) {
    return make<TemplateLiteral<TemplateLiteral.Type<Params>>>(
      new SchemaAST.TemplateLiteral(h, spans, undefined, undefined, undefined, undefined)
    )
  } else {
    return make<TemplateLiteral<TemplateLiteral.Type<Params>>>(
      new SchemaAST.TemplateLiteral(
        "",
        [
          new SchemaAST.TemplateLiteralSpan(
            new SchemaAST.LiteralType(h, undefined, undefined, undefined, undefined),
            ""
          )
        ],
        undefined,
        undefined,
        undefined,
        undefined
      )
    )
  }
}

/**
 * @since 4.0.0
 */
export type EnumsDefinition = { [x: string]: string | number }

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Enums<A extends EnumsDefinition>
  extends Bottom<A[keyof A], A[keyof A], never, never, SchemaAST.Enums, Enums<A>, SchemaAST.Annotations, A[keyof A]>
{
  readonly enums: A
}

class Enums$<A extends EnumsDefinition> extends make$<Enums<A>> implements Enums<A> {
  constructor(ast: SchemaAST.Enums, readonly enums: A) {
    super(ast, (ast) => new Enums$(ast, enums))
  }
}

/**
 * @since 4.0.0
 */
export const Enums = <A extends EnumsDefinition>(enums: A): Enums<A> => {
  return new Enums$(
    new SchemaAST.Enums(
      Object.keys(enums).filter(
        (key) => typeof enums[enums[key]] !== "number"
      ).map((key) => [key, enums[key]]),
      undefined,
      undefined,
      undefined,
      undefined
    ),
    enums
  )
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface tag<Tag extends SchemaAST.LiteralValue> extends setConstructorDefault<Literal<Tag>> {}

/**
 * @since 4.0.0
 */
export function tag<Tag extends SchemaAST.LiteralValue>(literal: Tag): tag<Tag> {
  return Literal(literal).pipe(
    withConstructorDefault(() => Result.succeedSome(literal))
  )
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Never
  extends Bottom<never, never, never, never, SchemaAST.NeverKeyword, Never, SchemaAST.Annotations, never>
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
  extends Bottom<unknown, unknown, never, never, SchemaAST.AnyKeyword, Any, SchemaAST.Annotations, unknown>
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
  extends Bottom<unknown, unknown, never, never, SchemaAST.UnknownKeyword, Unknown, SchemaAST.Annotations, unknown>
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
  extends Bottom<null, null, never, never, SchemaAST.NullKeyword, Null, SchemaAST.Annotations, null>
{}

/**
 * @since 4.0.0
 */
export const Null: Null = make<Null>(SchemaAST.nullKeyword)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Undefined
  extends
    Bottom<undefined, undefined, never, never, SchemaAST.UndefinedKeyword, Undefined, SchemaAST.Annotations, undefined>
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
  extends Bottom<string, string, never, never, SchemaAST.StringKeyword, String, SchemaAST.Annotations, string>
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
  extends Bottom<number, number, never, never, SchemaAST.NumberKeyword, Number, SchemaAST.Annotations, number>
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
  extends Bottom<boolean, boolean, never, never, SchemaAST.BooleanKeyword, Boolean, SchemaAST.Annotations, boolean>
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
  extends Bottom<symbol, symbol, never, never, SchemaAST.SymbolKeyword, Symbol, SchemaAST.Annotations, symbol>
{}

/**
 * @since 4.0.0
 */
export const Symbol: Symbol = make<Symbol>(SchemaAST.symbolKeyword)

/**
 * @since 4.0.0
 */
export interface BigInt
  extends Bottom<bigint, bigint, never, never, SchemaAST.BigIntKeyword, BigInt, SchemaAST.Annotations, bigint>
{}

/**
 * @since 4.0.0
 */
export const BigInt: BigInt = make<BigInt>(SchemaAST.bigIntKeyword)

/**
 * @since 4.0.0
 */
export interface Void
  extends Bottom<void, void, never, never, SchemaAST.VoidKeyword, Void, SchemaAST.Annotations, void>
{}

/**
 * @since 4.0.0
 */
export const Void: Void = make<Void>(SchemaAST.voidKeyword)

/**
 * @since 4.0.0
 */
export interface Object$
  extends Bottom<object, object, never, never, SchemaAST.ObjectKeyword, Object$, SchemaAST.Annotations, object>
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
  extends Bottom<sym, sym, never, never, SchemaAST.UniqueSymbol, UniqueSymbol<sym>, SchemaAST.Annotations, sym>
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
    SchemaAST.TypeLiteral,
    Struct<Fields>,
    SchemaAST.Annotations.Bottom<Simplify<Struct.Type<Fields>>>,
    Simplify<Struct.MakeIn<Fields>>
  >
{
  readonly fields: Fields
}

/**
 * @since 4.0.0
 */
export const extend = <const NewFields extends Struct.Fields>(
  newFields: NewFields
) =>
<const Fields extends Struct.Fields>(schema: Struct<Fields>): Struct<Simplify<Merge<Fields, NewFields>>> => {
  const fields = { ...schema.fields, ...newFields }
  let ast = getTypeLiteralFromFields(fields)
  if (schema.ast.checks) {
    ast = SchemaAST.replaceChecks(ast, schema.ast.checks)
  }
  return new Struct$<Simplify<Merge<Fields, NewFields>>>(ast, fields)
}

/**
 * @since 4.0.0
 */
export const pick = <const Fields extends Struct.Fields, const Keys extends keyof Fields>(
  keys: ReadonlyArray<Keys>
) =>
(schema: Struct<Fields>): Struct<Simplify<Pick<Fields, Keys>>> => {
  return Struct(Struct_.pick(schema.fields, ...keys))
}

/**
 * @since 4.0.0
 */
export const omit = <const Fields extends Struct.Fields, const Keys extends keyof Fields>(
  keys: ReadonlyArray<Keys>
) =>
(schema: Struct<Fields>): Struct<Simplify<Omit<Fields, Keys>>> => {
  return Struct(Struct_.omit(schema.fields, ...keys))
}

function getTypeLiteralFromFields<Fields extends Struct.Fields>(fields: Fields): SchemaAST.TypeLiteral {
  return new SchemaAST.TypeLiteral(
    ownKeys(fields).map((key) => {
      return new SchemaAST.PropertySignature(key, fields[key].ast)
    }),
    [],
    undefined,
    undefined,
    undefined,
    undefined
  )
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
  return new Struct$(getTypeLiteralFromFields(fields), fields)
}

/**
 * @since 4.0.0
 */
export declare namespace IndexSignature {
  /**
   * @since 4.0.0
   */
  export interface RecordKey extends Codec<PropertyKey, PropertyKey, unknown, unknown> {
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
    SchemaAST.TypeLiteral,
    ReadonlyRecord$<Key, Value>,
    SchemaAST.Annotations.Bottom<{ readonly [P in Key["Type"]]: Value["Type"] }>,
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
    SchemaAST.TypeLiteral,
    StructAndRest<Fields, Records>,
    SchemaAST.Annotations.Bottom<Simplify<StructAndRest.Type<Fields, Records>>>,
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
    SchemaAST.TupleType,
    ReadonlyTuple<Elements>,
    SchemaAST.Annotations.Bottom<Tuple.Type<Elements>>,
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
    this.elements = [...elements] as any
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
    SchemaAST.TupleType,
    ReadonlyArray$<S>,
    SchemaAST.Annotations.Bottom<ReadonlyArray<S["Type"]>>,
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
    SchemaAST.UnionType<Members[number]["ast"]>,
    Union<Members>,
    SchemaAST.Annotations.Bottom<Members[number]["Type"]>,
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
 * Members are checked in order, and the first match is returned.
 *
 * Optionally, you can specify the `mode` to be `"anyOf"` or `"oneOf"`.
 *
 * - `"anyOf"` - The union matches if any member matches.
 * - `"oneOf"` - The union matches if exactly one member matches.
 *
 * @since 4.0.0
 */
export function Union<const Members extends ReadonlyArray<Top>>(
  members: Members,
  options?: { mode?: "anyOf" | "oneOf" }
): Union<Members> {
  const ast = new SchemaAST.UnionType(
    members.map((type) => type.ast),
    options?.mode ?? "anyOf",
    undefined,
    undefined,
    undefined,
    undefined
  )
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
    SchemaAST.UnionType<SchemaAST.LiteralType>,
    Literals<L>,
    SchemaAST.Annotations.Bottom<L[number]>,
    L[number]
  >
{
  readonly literals: L
}

class Literals$<L extends ReadonlyArray<SchemaAST.LiteralValue>> extends make$<Literals<L>> implements Literals<L> {
  constructor(ast: SchemaAST.UnionType<SchemaAST.LiteralType>, readonly literals: L) {
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
      "anyOf",
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
  ...checks: readonly [SchemaCheck.SchemaCheck<S["Type"]>, ...ReadonlyArray<SchemaCheck.SchemaCheck<S["Type"]>>]
): (self: S) => S["~rebuild.out"] => {
  return SchemaCheck.asCheck(...checks)
}

/**
 * @category Filtering
 * @since 4.0.0
 */
export const checkEncoded = <S extends Top>(
  ...checks: readonly [SchemaCheck.SchemaCheck<S["Encoded"]>, ...ReadonlyArray<SchemaCheck.SchemaCheck<S["Encoded"]>>]
): (self: S) => S["~rebuild.out"] => {
  return SchemaCheck.asCheckEncoded(...checks)
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
    SchemaAST.appendChecks(self.ast, [
      new SchemaCheck.Filter(
        (input, ast) =>
          is(input) ?
            undefined :
            [new SchemaIssue.InvalidType(ast, O.some(input)), true], // after a refinement, we always want to abort
        annotations
      )
    ])
  )
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface decodingMiddleware<S extends Top, RD> extends make<S> {
  readonly "~rebuild.out": decodingMiddleware<S, RD>
  readonly "DecodingContext": RD
}

/**
 * @since 4.0.0
 */
export const decodingMiddleware = <S extends Top, RD>(
  decode: (
    sr: SchemaResult.SchemaResult<O.Option<S["Type"]>, S["DecodingContext"]>,
    ast: S["ast"],
    options: SchemaAST.ParseOptions
  ) => SchemaResult.SchemaResult<O.Option<S["Type"]>, RD>
) =>
(self: S): decodingMiddleware<S, RD> => {
  const ast = SchemaAST.decodingMiddleware(self.ast, new SchemaTransformation.SchemaMiddleware(decode, identity))
  return new schema$<S, decodingMiddleware<S, RD>>(ast, self)
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface encodingMiddleware<S extends Top, RE> extends make<S> {
  readonly "~rebuild.out": encodingMiddleware<S, RE>
  readonly "EncodingContext": RE
}

/**
 * @since 4.0.0
 */
export const encodingMiddleware = <S extends Top, RE>(
  encode: (
    sr: SchemaResult.SchemaResult<O.Option<S["Type"]>, S["EncodingContext"]>,
    ast: S["ast"],
    options: SchemaAST.ParseOptions
  ) => SchemaResult.SchemaResult<O.Option<S["Type"]>, RE>
) =>
(self: S): encodingMiddleware<S, RE> => {
  const ast = SchemaAST.encodingMiddleware(self.ast, new SchemaTransformation.SchemaMiddleware(identity, encode))
  return new schema$<S, encodingMiddleware<S, RE>>(ast, self)
}

/**
 * @category Middlewares
 * @since 4.0.0
 */
export const catchDecoding = <S extends Top>(
  f: (issue: SchemaIssue.Issue) => SchemaResult.SchemaResult<O.Option<S["Type"]>>
): (self: S) => S["~rebuild.out"] => {
  return catchDecodingWithContext(f)
}

/**
 * @category Middlewares
 * @since 4.0.0
 */
export const catchDecodingWithContext =
  <S extends Top, R = never>(f: (issue: SchemaIssue.Issue) => SchemaResult.SchemaResult<O.Option<S["Type"]>, R>) =>
  (self: S): decodingMiddleware<S, S["DecodingContext"] | R> => {
    return self.pipe(decodingMiddleware((sr) => SchemaResult.catch(sr, f)))
  }

/**
 * @category Middlewares
 * @since 4.0.0
 */
export const catchEncoding = <S extends Top>(
  f: (issue: SchemaIssue.Issue) => SchemaResult.SchemaResult<O.Option<S["Encoded"]>>
): (self: S) => S["~rebuild.out"] => {
  return catchEncodingWithContext(f)
}

/**
 * @category Middlewares
 * @since 4.0.0
 */
export const catchEncodingWithContext =
  <S extends Top, R = never>(f: (issue: SchemaIssue.Issue) => SchemaResult.SchemaResult<O.Option<S["Encoded"]>, R>) =>
  (self: S): encodingMiddleware<S, S["EncodingContext"] | R> => {
    return self.pipe(encodingMiddleware((sr) => SchemaResult.catch(sr, f)))
  }

/**
 * @category Middlewares
 * @since 4.0.0
 */
export const checkEffect = <S extends Top>(
  f: (
    input: S["Type"],
    self: SchemaAST.AST,
    options: SchemaAST.ParseOptions
  ) => Effect.Effect<undefined | SchemaIssue.Issue>
): (self: S) => S["~rebuild.out"] => {
  return checkEffectWithContext(f)
}

/**
 * @category Middlewares
 * @since 4.0.0
 */
export const checkEffectWithContext = <S extends Top, R = never>(
  f: (
    input: S["Type"],
    self: SchemaAST.AST,
    options: SchemaAST.ParseOptions
  ) => Effect.Effect<undefined | SchemaIssue.Issue, never, R>
) =>
(self: S): decodingMiddleware<S, S["DecodingContext"] | R> => {
  return self.pipe(
    decodingMiddleware((sr, ast, options) =>
      SchemaResult.flatMap(sr, (oa) => {
        if (O.isNone(oa)) {
          return Effect.succeed<O.Option<S["Type"]>>(oa)
        }
        return Effect.flatMap(f(oa.value, ast, options), (issue) => {
          if (issue) {
            return Effect.fail(issue)
          } else {
            return Effect.succeed(oa)
          }
        })
      })
    )
  )
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
 * @category Api interface
 * @since 4.0.0
 */
export interface decodeTo<To extends Top, From extends Top, RD, RE> extends
  Bottom<
    To["Type"],
    From["Encoded"],
    To["DecodingContext"] | From["DecodingContext"] | RD,
    To["EncodingContext"] | From["EncodingContext"] | RE,
    To["ast"],
    decodeTo<To, From, RD, RE>,
    To["~annotate.in"],
    To["~type.make.in"],
    To["~type.isReadonly"],
    To["~type.isOptional"],
    To["~type.default"],
    From["~encoded.isReadonly"],
    From["~encoded.isOptional"]
  >
{
  readonly from: From
  readonly to: To
}

class decodeTo$<To extends Top, From extends Top, RD, RE> extends make$<decodeTo<To, From, RD, RE>>
  implements decodeTo<To, From, RD, RE>
{
  constructor(
    readonly ast: From["ast"],
    readonly from: From,
    readonly to: To
  ) {
    super(ast, (ast) => new decodeTo$<To, From, RD, RE>(ast, this.from, this.to))
  }
}

/**
 * @since 4.0.0
 */
export const decodeTo = <To extends Top, From extends Top, RD, RE>(
  to: To,
  transformation: SchemaTransformation.SchemaTransformation<To["Encoded"], From["Type"], RD, RE>
) =>
(from: From): decodeTo<To, From, RD, RE> => {
  return new decodeTo$(SchemaAST.decodeTo(from.ast, to.ast, transformation), from, to)
}

/**
 * @since 4.0.0
 */
export const encodeTo = <To extends Top, From extends Top, RD, RE>(
  to: To,
  transformation: SchemaTransformation.SchemaTransformation<From["Encoded"], To["Type"], RD, RE>
) =>
(from: From): decodeTo<From, To, RD, RE> => {
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
export const withConstructorDefault = <S extends Top & { readonly "~type.default": "no-constructor-default" }>(
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
    new SchemaTransformation.SchemaTransformation(
      new SchemaGetter.SchemaGetter(
        (o, ast, options) => {
          if (O.isNone(o) || (O.isSome(o) && o.value === undefined)) {
            return parser(o, ast, options)
          } else {
            return Result.ok(o)
          }
        },
        annotations
      ),
      SchemaGetter.identity()
    )
  ))
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Option<S extends Top> extends
  declare<
    O.Option<S["Type"]>,
    O.Option<S["Encoded"]>,
    readonly [S]
  >
{
  readonly "~rebuild.out": Option<S>
}

/**
 * @since 4.0.0
 */
export const Option = <S extends Top>(value: S): Option<S> => {
  return declare([value])<O.Option<S["Encoded"]>>()(
    ([value]) => (oinput, ast, options) => {
      if (O.isOption(oinput)) {
        if (O.isNone(oinput)) {
          return Result.succeedNone
        }
        const input = oinput.value
        return SchemaResult.mapBoth(
          SchemaParser.decodeUnknownSchemaResult(value)(input, options),
          {
            onSuccess: O.some,
            onFailure: (issue) => {
              const actual = O.some(oinput)
              return new SchemaIssue.Composite(ast, actual, [issue])
            }
          }
        )
      }
      return Result.err(new SchemaIssue.InvalidType(ast, O.some(oinput)))
    },
    {
      declaration: {
        title: "Option"
      },
      defaultJsonSerializer: ([value]) =>
        link<O.Option<S["Encoded"]>>()(
          Union([ReadonlyTuple([value]), ReadonlyTuple([])]),
          SchemaTransformation.transform(
            Arr.head,
            (o) => (o._tag === "Some" ? [o.value] as const : [] as const)
          )
        )
    }
  )
}

/**
 * @since 4.0.0
 */
export const NonEmptyString = String.pipe(check(SchemaCheck.nonEmpty))

/**
 * @since 4.0.0
 */
export const Finite = Number.pipe(check(SchemaCheck.finite))

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Map$<Key extends Top, Value extends Top> extends
  declare<
    globalThis.Map<Key["Type"], Value["Type"]>,
    globalThis.Map<Key["Encoded"], Value["Encoded"]>,
    readonly [Key, Value]
  >
{
  readonly "~rebuild.out": Map$<Key, Value>
}

/**
 * @since 4.0.0
 */
export const Map = <Key extends Top, Value extends Top>(key: Key, value: Value): Map$<Key, Value> => {
  return declare([key, value])<globalThis.Map<Key["Encoded"], Value["Encoded"]>>()(
    ([key, value]) => (input, ast, options) => {
      if (input instanceof globalThis.Map) {
        const array = ReadonlyArray(ReadonlyTuple([key, value]))
        return SchemaResult.mapBoth(
          SchemaParser.decodeUnknownSchemaResult(array)([...input], options),
          {
            onSuccess: (array: ReadonlyArray<readonly [Key["Type"], Value["Type"]]>) => new globalThis.Map(array),
            onFailure: (issue) => new SchemaIssue.Composite(ast, O.some(input), [issue])
          }
        )
      }
      return Result.err(new SchemaIssue.InvalidType(ast, O.some(input)))
    },
    {
      declaration: {
        title: "Map"
      },
      defaultJsonSerializer: ([key, value]) =>
        link<globalThis.Map<Key["Encoded"], Value["Encoded"]>>()(
          ReadonlyArray(ReadonlyTuple([key, value])),
          SchemaTransformation.transform(
            (entries) => new globalThis.Map(entries),
            (map) => [...map.entries()]
          )
        )
    }
  )
}

/**
 * @since 4.0.0
 */
export interface Opaque<Self, S extends Top> extends
  Bottom<
    Self,
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
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
{
  readonly "~encoded.make.in": S["~encoded.make.in"]
  new(_: never): S["Type"]
}

/**
 * @since 4.0.0
 */
export const Opaque =
  <Self>() => <S extends Struct<Struct.Fields>>(schema: S): Opaque<Self, S> & Omit<S, "Type" | "Encoded"> => {
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    class Opaque {}
    Object.setPrototypeOf(Opaque, schema)
    return Opaque as any
  }

/**
 * @since 4.0.0
 */
export interface instanceOf<C> extends declare<C, C, readonly []> {}

/**
 * @since 4.0.0
 */
export const instanceOf = <const C extends new(...args: Array<any>) => any>(
  options: {
    readonly constructor: C
    readonly annotations?: SchemaAST.Annotations.Declaration<InstanceType<C>, readonly []> | undefined
  }
): instanceOf<InstanceType<C>> => {
  return declareRefinement({
    is: (u): u is InstanceType<C> => u instanceof options.constructor,
    annotations: options.annotations
  })
}

/**
 * @since 4.0.0
 */
export const link = <T>() =>
<To extends Top>(
  to: To,
  transformation: SchemaTransformation.SchemaTransformation<T, To["Type"], never, never>
): SchemaAST.Link => {
  return new SchemaAST.Link(to.ast, transformation)
}

/**
 * @since 4.0.0
 */
export const URL = instanceOf({
  constructor: globalThis.URL,
  annotations: {
    title: "URL",
    defaultJsonSerializer: () =>
      link<URL>()(
        String,
        SchemaTransformation.transform(
          (s) => new globalThis.URL(s),
          (url) => url.toString()
        )
      )
  }
})

/**
 * @since 4.0.0
 */
export const Date = instanceOf({
  constructor: globalThis.Date,
  annotations: {
    title: "Date",
    defaultJsonSerializer: () =>
      link<Date>()(
        String,
        SchemaTransformation.transform(
          (s) => new globalThis.Date(s),
          (date) => date.toISOString()
        )
      )
  }
})

/**
 * @since 4.0.0
 */
export const UnknownFromJsonString = String.pipe(
  decodeTo(
    Unknown,
    SchemaTransformation.json()
  )
)

/**
 * @since 4.0.0
 */
export const getClassSchema = <C extends new(...args: Array<any>) => any, S extends Struct<Struct.Fields>>(
  constructor: C,
  options: {
    readonly encoding: S
    readonly annotations?: SchemaAST.Annotations.Declaration<InstanceType<C>, readonly []>
  }
): decodeTo<instanceOf<C>, S, never, never> => {
  const transformation = SchemaTransformation.transform<InstanceType<C>, S["Type"]>(
    (props) => new constructor(props),
    identity
  )
  return instanceOf({
    constructor,
    annotations: {
      defaultJsonSerializer: () => link<InstanceType<C>>()(options.encoding, transformation),
      ...options.annotations
    }
  }).pipe(encodeTo(options.encoding, transformation))
}

//
// Class APIs
//

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Class<Self, S extends Top & { readonly fields: Struct.Fields }, Inherited> extends
  Bottom<
    Self,
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
    SchemaAST.Declaration,
    Class<Self, S, Self>,
    SchemaAST.Annotations.Declaration<Self, readonly [S]>,
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

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface ExtendableClass<Self, S extends Top & { readonly fields: Struct.Fields }, Inherited>
  extends Class<Self, S, Inherited>
{
  readonly "~rebuild.out": ExtendableClass<Self, S, Self>
  extend<Extended>(
    identifier: string
  ): <NewFields extends Struct.Fields>(
    fields: NewFields,
    annotations?: SchemaAST.Annotations.Bottom<Extended>
  ) => ExtendableClass<Extended, Struct<Simplify<Merge<S["fields"], NewFields>>>, Self>
}

function makeClass<
  Self,
  S extends Struct<Struct.Fields>,
  Inherited extends new(...args: ReadonlyArray<any>) => any
>(
  Inherited: Inherited,
  identifier: string,
  schema: S,
  annotations?: SchemaAST.Annotations.Declaration<unknown, ReadonlyArray<Top>>
): any {
  const computeAST = getComputeAST(schema.ast, { title: identifier, ...annotations }, undefined, undefined)

  return class extends Inherited {
    constructor(...[input, options]: ReadonlyArray<any>) {
      super({ ...input, ...schema.makeSync(input, options) })
    }

    static readonly "~effect/Schema" = "~effect/Schema"

    declare static readonly "Type": Self
    declare static readonly "Encoded": S["Encoded"]
    declare static readonly "DecodingContext": S["DecodingContext"]
    declare static readonly "EncodingContext": S["EncodingContext"]

    declare static readonly "~rebuild.out": Class<Self, S, Self>
    declare static readonly "~annotate.in": SchemaAST.Annotations.Declaration<Self, readonly [S]>
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
      return computeAST(this)
    }
    static pipe() {
      return pipeArguments(this, arguments)
    }
    static rebuild(ast: SchemaAST.Declaration): Class<Self, S, Self> {
      const computeAST = getComputeAST(this.ast, ast.annotations, ast.checks, ast.context)
      return class extends this {
        static get ast() {
          return computeAST(this)
        }
      }
    }
    static makeSync(input: S["~type.make.in"], options?: MakeOptions): Self {
      return new this(input, options)
    }
    static extend<Extended>(
      identifier: string
    ): <NewFields extends Struct.Fields>(
      fields: NewFields,
      annotations?: SchemaAST.Annotations.Bottom<Extended>
    ) => Class<Extended, Struct<Simplify<Merge<S["fields"], NewFields>>>, Self> {
      return (fields, annotations) => {
        const struct = schema.pipe(extend(fields))
        return makeClass(
          this,
          identifier,
          struct,
          annotations
        )
      }
    }
  }
}

const makeDefaultClassLink = (self: new(...args: ReadonlyArray<any>) => any) => (ast: SchemaAST.AST) =>
  new SchemaAST.Link(
    ast,
    new SchemaTransformation.SchemaTransformation(
      SchemaGetter.mapSome((input) => new self(input)),
      SchemaGetter.parseSome((input) => {
        if (!(input instanceof self)) {
          return Result.err(new SchemaIssue.InvalidType(ast, input))
        }
        return Result.succeedSome(input)
      })
    )
  )

function getComputeAST(
  from: SchemaAST.AST,
  annotations: SchemaAST.Annotations.Declaration<unknown, ReadonlyArray<Top>> | undefined,
  checks: SchemaAST.Checks | undefined,
  context: SchemaAST.Context | undefined
) {
  let memo: SchemaAST.Declaration | undefined
  return (self: any) => {
    if (memo === undefined) {
      const makeLink = makeDefaultClassLink(self)
      memo = new SchemaAST.Declaration(
        [from],
        () => (input, ast) => {
          if (input instanceof self) {
            return Result.ok(input)
          }
          return Result.err(new SchemaIssue.InvalidType(ast, O.some(input)))
        },
        {
          defaultJsonSerializer: ([schema]: [Schema<any>]) => makeLink(schema.ast),
          ...annotations
        },
        checks,
        [makeLink(from)],
        context
      )
    }
    return memo
  }
}

/**
 * @since 4.0.0
 */
export const Class: {
  <Self, Brand = {}>(identifier: string): {
    <const Fields extends Struct.Fields>(
      fields: Fields,
      annotations?: SchemaAST.Annotations.Bottom<Self>
    ): ExtendableClass<Self, Struct<Fields>, Brand>
    <S extends Struct<Struct.Fields>>(
      schema: S,
      annotations?: SchemaAST.Annotations.Bottom<Self>
    ): ExtendableClass<Self, S, Brand>
  }
} = <Self, Brand = {}>(identifier: string) =>
(
  schema: Struct.Fields | Struct<Struct.Fields>,
  annotations?: SchemaAST.Annotations.Bottom<Self>
): ExtendableClass<Self, Struct<Struct.Fields>, Brand> => {
  const struct = isSchema(schema) ? schema : Struct(schema)

  return makeClass(
    Data.Class,
    identifier,
    struct,
    annotations
  )
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface ErrorClass<Self, S extends Top & { readonly fields: Struct.Fields }, Inherited>
  extends ExtendableClass<Self, S, Inherited>
{
  readonly "~rebuild.out": ErrorClass<Self, S, Self>
}

/**
 * @since 4.0.0
 */
export const ErrorClass: {
  <Self, Brand = {}>(identifier: string): {
    <const Fields extends Struct.Fields>(
      fields: Fields,
      annotations?: SchemaAST.Annotations.Bottom<Self>
    ): ErrorClass<Self, Struct<Fields>, Cause.YieldableError & Brand>
    <S extends Struct<Struct.Fields>>(
      schema: S,
      annotations?: SchemaAST.Annotations.Bottom<Self>
    ): ErrorClass<Self, S, Cause.YieldableError & Brand>
  }
} = <Self, Brand = {}>(identifier: string) =>
(
  schema: Struct.Fields | Struct<Struct.Fields>,
  annotations?: SchemaAST.Annotations.Bottom<Self>
): ErrorClass<Self, Struct<Struct.Fields>, Cause.YieldableError & Brand> => {
  const struct = isSchema(schema) ? schema : Struct(schema)

  return makeClass(
    core.Error,
    identifier,
    struct,
    annotations
  )
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface RequestClass<
  Self,
  Payload extends Struct<Struct.Fields>,
  Success extends Top,
  Error extends Top,
  Inherited
> extends Class<Self, Payload, Inherited> {
  readonly "~rebuild.out": RequestClass<Self, Payload, Success, Error, Self>
  readonly payload: Payload
  readonly success: Success
  readonly error: Error
}

/**
 * @since 4.0.0
 */
export const RequestClass =
  <Self, Brand = {}>(identifier: string) =>
  <Payload extends Struct<Struct.Fields>, Success extends Top, Error extends Top>(
    options: {
      readonly payload: Payload
      readonly success: Success
      readonly error: Error
      readonly annotations?: SchemaAST.Annotations.Bottom<Self>
    }
  ): RequestClass<
    Self,
    Payload,
    Success,
    Error,
    Request.Request<
      Success["Type"],
      Error["Type"],
      Success["DecodingContext"] | Success["EncodingContext"] | Error["DecodingContext"] | Error["EncodingContext"]
    > & Brand
  > => {
    return class RequestClass extends makeClass(
      Request.Class,
      identifier,
      options.payload,
      options.annotations
    ) {
      static readonly payload = options.payload
      static readonly success = options.success
      static readonly error = options.error
    } as any
  }
