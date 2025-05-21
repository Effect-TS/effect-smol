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
import type * as SchemaAnnotations from "./SchemaAnnotations.js"
import * as SchemaAST from "./SchemaAST.js"
import * as SchemaCheck from "./SchemaCheck.js"
import * as SchemaGetter from "./SchemaGetter.js"
import * as SchemaIssue from "./SchemaIssue.js"
import * as SchemaParser from "./SchemaParser.js"
import * as SchemaResult from "./SchemaResult.js"
import * as SchemaTransformation from "./SchemaTransformation.js"
import * as Struct_ from "./Struct.js"

/**
 * @category Type-Level Programming
 * @since 4.0.0
 */
export type Simplify<T> = { [K in keyof T]: T[K] } & {}

/**
 * Used in {@link extend}.
 *
 * @category Type-Level Programming
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
  AnnotateIn extends SchemaAnnotations.Annotations,
  TypeMakeIn = T,
  TypeReadonly extends ReadonlyToken = "readonly",
  TypeIsOptional extends OptionalToken = "required",
  TypeDefault extends DefaultConstructorToken = "no-constructor-default",
  EncodedIsReadonly extends ReadonlyToken = "readonly",
  EncodedIsOptional extends OptionalToken = "required"
> extends Pipeable {
  readonly "~effect/Schema": "~effect/Schema"

  readonly ast: Ast
  readonly "~rebuild.out": RebuildOut
  readonly "~annotate.in": AnnotateIn

  readonly "Type": T
  readonly "Encoded": E
  readonly "DecodingContext": RD
  readonly "EncodingContext": RE

  readonly "~type.make.in": TypeMakeIn
  readonly "~type.isReadonly": TypeReadonly
  readonly "~type.isOptional": TypeIsOptional
  readonly "~type.default": TypeDefault

  readonly "~encoded.isReadonly": EncodedIsReadonly
  readonly "~encoded.isOptional": EncodedIsOptional

  annotate(annotations: this["~annotate.in"]): this["~rebuild.out"]
  rebuild(ast: this["ast"]): this["~rebuild.out"]
  /**
   * @throws {Error} The issue is contained in the error cause.
   */
  makeSync(input: this["~type.make.in"], options?: MakeOptions): this["Type"]
}

/**
 * Universal annotation function, works with any
 * {@link SchemaAnnotations.Annotable} (e.g. `Schema`, `SchemaCheck`, etc.).
 *
 * @since 4.0.0
 */
export function annotate<S extends Top>(annotations: S["~annotate.in"]) {
  return (self: S): S["~rebuild.out"] => {
    return self.annotate(annotations)
  }
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
  AnnotateIn extends SchemaAnnotations.Annotations,
  TypeMakeIn = T,
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

  constructor(readonly ast: Ast) {}
  abstract rebuild(ast: this["ast"]): this["~rebuild.out"]
  pipe() {
    return pipeArguments(this, arguments)
  }
  annotate(annotations: this["~annotate.in"]): this["~rebuild.out"] {
    return this.rebuild(SchemaAST.annotate(this.ast, annotations))
  }
  makeSync(input: this["~type.make.in"], options?: MakeOptions): this["Type"] {
    return Result.getOrThrowWith(
      SchemaParser.runSyncSchemaResult(SchemaParser.make(this)(input, options)),
      (issue) =>
        new globalThis.Error("makeSync failure", {
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
    SchemaAnnotations.Annotations,
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
export function decodeUnknown<T, E, RD, RE>(codec: Codec<T, E, RD, RE>) {
  const parser = SchemaParser.decodeUnknown(codec)
  return (u: unknown, options?: SchemaAST.ParseOptions): Effect.Effect<T, SchemaError, RD> => {
    return Effect.mapError(parser(u, options), (issue) => new SchemaError({ issue }))
  }
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export function decode<T, E, RD, RE>(codec: Codec<T, E, RD, RE>) {
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
export function encodeUnknown<T, E, RD, RE>(codec: Codec<T, E, RD, RE>) {
  const parser = SchemaParser.encodeUnknown(codec)
  return (u: unknown, options?: SchemaAST.ParseOptions): Effect.Effect<E, SchemaError, RE> => {
    return Effect.mapError(parser(u, options), (issue) => new SchemaError({ issue }))
  }
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export function encode<T, E, RD, RE>(codec: Codec<T, E, RD, RE>) {
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
 * @category Encoding
 * @since 4.0.0
 */
export const encodeSync = SchemaParser.encodeSync

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

class SchemaMemento$<S extends Top, Result extends Top> extends make$<Result> {
  constructor(ast: SchemaAST.AST, readonly schema: S) {
    super(ast, (ast) => new SchemaMemento$(ast, this.schema))
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
  readonly "~rebuild.out": optionalKey<S>
  readonly "~type.isOptional": "optional"
  readonly "~encoded.isOptional": "optional"
  readonly schema: S
}

/**
 * @since 4.0.0
 */
export function optionalKey<S extends Top>(schema: S): optionalKey<S> {
  return new SchemaMemento$<S, optionalKey<S>>(SchemaAST.optionalKey(schema.ast), schema)
}

/**
 * Equivalent to `optionalKey(UndefinedOr(schema))`.
 *
 * @since 4.0.0
 */
export function optional<S extends Top>(schema: S): optionalKey<Union<readonly [S, Undefined]>> {
  return optionalKey(UndefinedOr(schema))
}

/**
 * @since 4.0.0
 */
export interface mutableKey<S extends Top> extends make<S> {
  readonly "~rebuild.out": mutableKey<S>
  readonly "~type.isReadonly": "mutable"
  readonly "~encoded.isReadonly": "mutable"
  readonly schema: S
}

/**
 * @since 4.0.0
 */
export function mutableKey<S extends Top>(schema: S): mutableKey<S> {
  return new SchemaMemento$<S, mutableKey<S>>(SchemaAST.mutableKey(schema.ast), schema)
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
    SchemaAnnotations.Annotations
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
    SchemaAnnotations.Annotations,
    S["Encoded"],
    S["~encoded.isReadonly"],
    S["~encoded.isOptional"],
    DefaultConstructorToken,
    S["~type.isReadonly"],
    S["~type.isOptional"]
  >
{
  readonly "~effect/flip$": "~effect/flip$"
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
    SchemaAnnotations.Declaration<T, TypeParameters>
  >
{}

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
  extends Bottom<L, L, never, never, SchemaAST.LiteralType, Literal<L>, SchemaAnnotations.Annotations>
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
  extends Bottom<T, T, never, never, SchemaAST.TemplateLiteral, TemplateLiteral<T>, SchemaAnnotations.Annotations>
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
 * @category Api interface
 * @since 4.0.0
 */
export interface Enums<A extends { [x: string]: string | number }>
  extends Bottom<A[keyof A], A[keyof A], never, never, SchemaAST.Enums, Enums<A>, SchemaAnnotations.Annotations>
{
  readonly enums: A
}

class Enums$<A extends { [x: string]: string | number }> extends make$<Enums<A>> implements Enums<A> {
  constructor(ast: SchemaAST.Enums, readonly enums: A) {
    super(ast, (ast) => new Enums$(ast, enums))
  }
}

/**
 * @since 4.0.0
 */
export function Enums<A extends { [x: string]: string | number }>(enums: A): Enums<A> {
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
export interface Never
  extends Bottom<never, never, never, never, SchemaAST.NeverKeyword, Never, SchemaAnnotations.Annotations>
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
  extends Bottom<unknown, unknown, never, never, SchemaAST.AnyKeyword, Any, SchemaAnnotations.Annotations>
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
  extends Bottom<unknown, unknown, never, never, SchemaAST.UnknownKeyword, Unknown, SchemaAnnotations.Annotations>
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
  extends Bottom<null, null, never, never, SchemaAST.NullKeyword, Null, SchemaAnnotations.Annotations>
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
    Bottom<undefined, undefined, never, never, SchemaAST.UndefinedKeyword, Undefined, SchemaAnnotations.Annotations>
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
  extends Bottom<string, string, never, never, SchemaAST.StringKeyword, String, SchemaAnnotations.Annotations>
{}

/**
 * @since 4.0.0
 */
export const String: String = make<String>(SchemaAST.stringKeyword)

/**
 * All numbers, including `NaN`, `Infinity`, and `-Infinity`.
 *
 * @category Api interface
 * @since 4.0.0
 */
export interface Number
  extends Bottom<number, number, never, never, SchemaAST.NumberKeyword, Number, SchemaAnnotations.Annotations>
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
  extends Bottom<boolean, boolean, never, never, SchemaAST.BooleanKeyword, Boolean, SchemaAnnotations.Annotations>
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
  extends Bottom<symbol, symbol, never, never, SchemaAST.SymbolKeyword, Symbol, SchemaAnnotations.Annotations>
{}

/**
 * @since 4.0.0
 */
export const Symbol: Symbol = make<Symbol>(SchemaAST.symbolKeyword)

/**
 * @since 4.0.0
 */
export interface BigInt
  extends Bottom<bigint, bigint, never, never, SchemaAST.BigIntKeyword, BigInt, SchemaAnnotations.Annotations>
{}

/**
 * @since 4.0.0
 */
export const BigInt: BigInt = make<BigInt>(SchemaAST.bigIntKeyword)

/**
 * @since 4.0.0
 */
export interface Void
  extends Bottom<void, void, never, never, SchemaAST.VoidKeyword, Void, SchemaAnnotations.Annotations>
{}

/**
 * @since 4.0.0
 */
export const Void: Void = make<Void>(SchemaAST.voidKeyword)

/**
 * @since 4.0.0
 */
export interface Object$
  extends Bottom<object, object, never, never, SchemaAST.ObjectKeyword, Object$, SchemaAnnotations.Annotations>
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
  extends Bottom<sym, sym, never, never, SchemaAST.UniqueSymbol, UniqueSymbol<sym>, SchemaAnnotations.Annotations>
{}

/**
 * @since 4.0.0
 */
export function UniqueSymbol<const sym extends symbol>(symbol: sym): UniqueSymbol<sym> {
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
    SchemaAnnotations.Bottom<Simplify<Struct.Type<Fields>>>,
    Simplify<Struct.MakeIn<Fields>>
  >
{
  readonly fields: Fields
}

/**
 * @since 4.0.0
 */
export function extend<const NewFields extends Struct.Fields>(
  newFields: NewFields
) {
  return <const Fields extends Struct.Fields>(schema: Struct<Fields>): Struct<Simplify<Merge<Fields, NewFields>>> => {
    const fields = { ...schema.fields, ...newFields }
    let ast = getTypeLiteralFromFields(fields)
    if (schema.ast.checks) {
      ast = SchemaAST.replaceChecks(ast, schema.ast.checks)
    }
    return new Struct$<Simplify<Merge<Fields, NewFields>>>(ast, fields)
  }
}

/**
 * @since 4.0.0
 */
export function pick<const Fields extends Struct.Fields, const Keys extends keyof Fields>(
  keys: ReadonlyArray<Keys>
) {
  return (schema: Struct<Fields>): Struct<Simplify<Pick<Fields, Keys>>> => {
    return Struct(Struct_.pick(schema.fields, ...keys))
  }
}

/**
 * @since 4.0.0
 */
export function omit<const Fields extends Struct.Fields, const Keys extends keyof Fields>(
  keys: ReadonlyArray<Keys>
) {
  return (schema: Struct<Fields>): Struct<Simplify<Omit<Fields, Keys>>> => {
    return Struct(Struct_.omit(schema.fields, ...keys))
  }
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
    SchemaAnnotations.Bottom<{ readonly [P in Key["Type"]]: Value["Type"] }>,
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
    SchemaAnnotations.Bottom<Simplify<StructAndRest.Type<Fields, Records>>>,
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
    SchemaAnnotations.Bottom<Tuple.Type<Elements>>,
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
    SchemaAnnotations.Bottom<ReadonlyArray<S["Type"]>>,
    ReadonlyArray<S["~type.make.in"]>
  >
{
  readonly schema: S
}

function getArrayAST(item: SchemaAST.AST, isReadonly: boolean): SchemaAST.TupleType {
  return new SchemaAST.TupleType(isReadonly, [], [item], undefined, undefined, undefined, undefined)
}

/**
 * @since 4.0.0
 */
export function ReadonlyArray<S extends Top>(item: S): ReadonlyArray$<S> {
  return new SchemaMemento$<S, ReadonlyArray$<S>>(getArrayAST(item.ast, true), item)
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Array$<S extends Top> extends
  Bottom<
    Array<S["Type"]>,
    Array<S["Encoded"]>,
    S["DecodingContext"],
    S["EncodingContext"],
    SchemaAST.TupleType,
    Array$<S>,
    SchemaAnnotations.Bottom<Array<S["Type"]>>,
    ReadonlyArray<S["~type.make.in"]>
  >
{
  readonly schema: S
}

/**
 * @since 4.0.0
 */
export function Array<S extends Top>(item: S): Array$<S> {
  return new SchemaMemento$<S, Array$<S>>(getArrayAST(item.ast, false), item)
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
    SchemaAnnotations.Bottom<Members[number]["Type"]>,
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
    SchemaAnnotations.Bottom<L[number]>
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
 * @since 4.0.0
 */
export function NullishOr<S extends Top>(self: S) {
  return Union([self, Null, Undefined])
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
    S["~type.make.in"],
    S["~type.isReadonly"],
    S["~type.isOptional"],
    S["~type.default"],
    S["~encoded.isReadonly"],
    S["~encoded.isOptional"]
  >
{}

/**
 * @category constructors
 * @since 4.0.0
 */
export function suspend<S extends Top>(f: () => S): suspend<S> {
  return make<suspend<S>>(new SchemaAST.Suspend(() => f().ast, undefined, undefined, undefined, undefined))
}

/**
 * @category Filtering
 * @since 4.0.0
 */
export function check<S extends Top>(
  ...checks: readonly [SchemaCheck.SchemaCheck<S["Type"]>, ...ReadonlyArray<SchemaCheck.SchemaCheck<S["Type"]>>]
): (self: S) => S["~rebuild.out"] {
  return SchemaCheck.asCheck(...checks)
}

/**
 * @category Filtering
 * @since 4.0.0
 */
export function checkEncoded<S extends Top>(
  ...checks: readonly [SchemaCheck.SchemaCheck<S["Encoded"]>, ...ReadonlyArray<SchemaCheck.SchemaCheck<S["Encoded"]>>]
): (self: S) => S["~rebuild.out"] {
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
export function refine<T, S extends Top>(
  is: (value: S["Type"]) => value is T,
  annotations?: SchemaAnnotations.Documentation
) {
  return (self: S): refine<T, S> => {
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
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface decodingMiddleware<S extends Top, RD> extends make<S> {
  readonly "~rebuild.out": decodingMiddleware<S, RD>
  readonly "DecodingContext": RD
  readonly schema: S
}

/**
 * @since 4.0.0
 */
export function decodingMiddleware<S extends Top, RD>(
  decode: (
    sr: SchemaResult.SchemaResult<O.Option<S["Type"]>, S["DecodingContext"]>,
    ast: S["ast"],
    options: SchemaAST.ParseOptions
  ) => SchemaResult.SchemaResult<O.Option<S["Type"]>, RD>
) {
  return (self: S): decodingMiddleware<S, RD> => {
    return new SchemaMemento$<S, decodingMiddleware<S, RD>>(
      SchemaAST.decodingMiddleware(self.ast, new SchemaTransformation.SchemaMiddleware(decode, identity)),
      self
    )
  }
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface encodingMiddleware<S extends Top, RE> extends make<S> {
  readonly "~rebuild.out": encodingMiddleware<S, RE>
  readonly "EncodingContext": RE
  readonly schema: S
}

/**
 * @since 4.0.0
 */
export function encodingMiddleware<S extends Top, RE>(
  encode: (
    sr: SchemaResult.SchemaResult<O.Option<S["Type"]>, S["EncodingContext"]>,
    ast: S["ast"],
    options: SchemaAST.ParseOptions
  ) => SchemaResult.SchemaResult<O.Option<S["Type"]>, RE>
) {
  return (self: S): encodingMiddleware<S, RE> => {
    return new SchemaMemento$<S, encodingMiddleware<S, RE>>(
      SchemaAST.encodingMiddleware(self.ast, new SchemaTransformation.SchemaMiddleware(identity, encode)),
      self
    )
  }
}

/**
 * @category Middlewares
 * @since 4.0.0
 */
export function catchDecoding<S extends Top>(
  f: (issue: SchemaIssue.Issue) => SchemaResult.SchemaResult<O.Option<S["Type"]>>
): (self: S) => S["~rebuild.out"] {
  return catchDecodingWithContext(f)
}

/**
 * @category Middlewares
 * @since 4.0.0
 */
export function catchDecodingWithContext<S extends Top, R = never>(
  f: (issue: SchemaIssue.Issue) => SchemaResult.SchemaResult<O.Option<S["Type"]>, R>
) {
  return (self: S): decodingMiddleware<S, S["DecodingContext"] | R> => {
    return self.pipe(decodingMiddleware(SchemaResult.catch(f)))
  }
}

/**
 * @category Middlewares
 * @since 4.0.0
 */
export function catchEncoding<S extends Top>(
  f: (issue: SchemaIssue.Issue) => SchemaResult.SchemaResult<O.Option<S["Encoded"]>>
): (self: S) => S["~rebuild.out"] {
  return catchEncodingWithContext(f)
}

/**
 * @category Middlewares
 * @since 4.0.0
 */
export function catchEncodingWithContext<S extends Top, R = never>(
  f: (issue: SchemaIssue.Issue) => SchemaResult.SchemaResult<O.Option<S["Encoded"]>, R>
) {
  return (self: S): encodingMiddleware<S, S["EncodingContext"] | R> => {
    return self.pipe(encodingMiddleware(SchemaResult.catch(f)))
  }
}

/**
 * @category Middlewares
 * @since 4.0.0
 */
export function checkEffect<S extends Top>(
  f: (
    input: S["Type"],
    self: SchemaAST.AST,
    options: SchemaAST.ParseOptions
  ) => Effect.Effect<undefined | SchemaIssue.Issue>
): (self: S) => S["~rebuild.out"] {
  return checkEffectWithContext(f)
}

/**
 * @category Middlewares
 * @since 4.0.0
 */
export function checkEffectWithContext<S extends Top, R = never>(
  f: (
    input: S["Type"],
    self: SchemaAST.AST,
    options: SchemaAST.ParseOptions
  ) => Effect.Effect<undefined | SchemaIssue.Issue, never, R>
) {
  return (self: S): decodingMiddleware<S, S["DecodingContext"] | R> => {
    return self.pipe(
      decodingMiddleware((sr, ast, options) =>
        sr.pipe(SchemaResult.flatMap((oa) => {
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
        }))
      )
    )
  }
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface brand<S extends Top, B extends string | symbol> extends make<S> {
  readonly "Type": S["Type"] & Brand<B>
  readonly "~rebuild.out": brand<S, B>
  readonly schema: S
}

/**
 * @since 4.0.0
 */
export function brand<B extends string | symbol>(brand: B) {
  return <S extends Top>(self: S): brand<S, B> => {
    return new SchemaMemento$<S, brand<S, B>>(SchemaAST.brand(self.ast, brand), self)
  }
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
export function decodeTo<To extends Top, From extends Top, RD = never, RE = never>(
  to: To,
  transformation: {
    readonly decode: SchemaGetter.SchemaGetter<To["Encoded"], From["Type"], RD>
    readonly encode: SchemaGetter.SchemaGetter<From["Type"], To["Encoded"], RE>
  }
) {
  return (from: From): decodeTo<To, From, RD, RE> => {
    return new decodeTo$(
      SchemaAST.decodeTo(from.ast, to.ast, SchemaTransformation.make(transformation)),
      from,
      to
    )
  }
}

/**
 * @since 4.0.0
 */
export function encodeTo<To extends Top, From extends Top, RD = never, RE = never>(
  to: To,
  transformation: {
    readonly decode: SchemaGetter.SchemaGetter<From["Encoded"], To["Type"], RD>
    readonly encode: SchemaGetter.SchemaGetter<To["Type"], From["Encoded"], RE>
  }
) {
  return (from: From): decodeTo<From, To, RD, RE> => {
    return to.pipe(decodeTo(from, SchemaTransformation.make(transformation)))
  }
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface withConstructorDefault<S extends Top> extends make<S> {
  readonly "~rebuild.out": withConstructorDefault<S>
  readonly "~type.default": "has-constructor-default"
}

/**
 * Provide a default value when the input is `Option<undefined>`.
 *
 * @since 4.0.0
 */
export function withConstructorDefault<S extends Top & { readonly "~type.default": "no-constructor-default" }>(
  defaultValue: () => O.Option<S["~type.make.in"]> | Effect.Effect<O.Option<S["~type.make.in"]>>
) {
  return (self: S): withConstructorDefault<S> => {
    return make<withConstructorDefault<S>>(SchemaAST.withConstructorDefault(
      self.ast,
      new SchemaTransformation.SchemaTransformation(
        new SchemaGetter.SchemaGetter((o) => {
          if (O.isNone(O.filter(o, Predicate.isNotUndefined))) {
            const dv = defaultValue()
            return Effect.isEffect(dv) ? dv : Result.ok(dv)
          } else {
            return Result.ok(o)
          }
        }),
        SchemaGetter.passthrough()
      )
    ))
  }
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface tag<Tag extends SchemaAST.LiteralValue> extends withConstructorDefault<Literal<Tag>> {}

/**
 * Literal + withConstructorDefault
 *
 * @since 4.0.0
 */
export function tag<Tag extends SchemaAST.LiteralValue>(literal: Tag): tag<Tag> {
  return Literal(literal).pipe(
    withConstructorDefault(() => O.some(literal))
  )
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Option<S extends Top> extends declare<O.Option<S["Type"]>, O.Option<S["Encoded"]>, readonly [S]> {
  readonly "~rebuild.out": Option<S>
}

/**
 * @since 4.0.0
 */
export function Option<S extends Top>(value: S) {
  return declare([value])<O.Option<S["Encoded"]>>()(
    ([value]) => (oinput, ast, options) => {
      if (O.isOption(oinput)) {
        if (O.isNone(oinput)) {
          return Result.okNone
        }
        const input = oinput.value
        return SchemaParser.decodeUnknownSchemaResult(value)(input, options).pipe(SchemaResult.mapBoth(
          {
            onSuccess: O.some,
            onFailure: (issue) => {
              const actual = O.some(oinput)
              return new SchemaIssue.Composite(ast, actual, [issue])
            }
          }
        ))
      }
      return Result.err(new SchemaIssue.InvalidType(ast, O.some(oinput)))
    },
    {
      constructorTitle: "Option",
      defaultJsonSerializer: ([value]) =>
        link<O.Option<S["Encoded"]>>()(
          Union([ReadonlyTuple([value]), ReadonlyTuple([])]),
          SchemaTransformation.transform({
            decode: Arr.head,
            encode: (o) => (o._tag === "Some" ? [o.value] as const : [] as const)
          })
        )
    }
  )
}

/**
 * @since 4.0.0
 */
export const NonEmptyString = String.pipe(check(SchemaCheck.nonEmpty))

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
export function Map<Key extends Top, Value extends Top>(key: Key, value: Value) {
  return declare([key, value])<globalThis.Map<Key["Encoded"], Value["Encoded"]>>()(
    ([key, value]) => (input, ast, options) => {
      if (input instanceof globalThis.Map) {
        const array = ReadonlyArray(ReadonlyTuple([key, value]))
        return SchemaParser.decodeUnknownSchemaResult(array)([...input], options).pipe(SchemaResult.mapBoth(
          {
            onSuccess: (array: ReadonlyArray<readonly [Key["Type"], Value["Type"]]>) => new globalThis.Map(array),
            onFailure: (issue) => new SchemaIssue.Composite(ast, O.some(input), [issue])
          }
        ))
      }
      return Result.err(new SchemaIssue.InvalidType(ast, O.some(input)))
    },
    {
      constructorTitle: "Map",
      defaultJsonSerializer: ([key, value]) =>
        link<globalThis.Map<Key["Encoded"], Value["Encoded"]>>()(
          ReadonlyArray(ReadonlyTuple([key, value])),
          SchemaTransformation.transform({
            decode: (entries) => new globalThis.Map(entries),
            encode: (map) => [...map.entries()]
          })
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
  new(_: never): S["Type"]
}

/**
 * @since 4.0.0
 */
export function Opaque<Self>() {
  return <S extends Struct<Struct.Fields>>(schema: S): Opaque<Self, S> & Omit<S, "Type" | "Encoded"> => {
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    class Opaque {}
    Object.setPrototypeOf(Opaque, schema)
    return Opaque as any
  }
}

/**
 * @since 4.0.0
 */
export interface instanceOf<C> extends declare<C, C, readonly []> {}

/**
 * @since 4.0.0
 */
export function instanceOf<const C extends new(...args: Array<any>) => any>(
  options: {
    readonly constructor: C
    readonly annotations?: SchemaAnnotations.Declaration<InstanceType<C>, readonly []> | undefined
  }
): instanceOf<InstanceType<C>> {
  return declareRefinement({
    is: (u): u is InstanceType<C> => u instanceof options.constructor,
    annotations: options.annotations
  })
}

/**
 * @since 4.0.0
 */
export function link<T>() {
  return <To extends Top>(
    to: To,
    transformation: SchemaTransformation.SchemaTransformation<T, To["Type"], never, never>
  ): SchemaAST.Link => {
    return new SchemaAST.Link(to.ast, transformation)
  }
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
        SchemaTransformation.transform({
          decode: (s) => new globalThis.URL(s),
          encode: (url) => url.toString()
        })
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
        SchemaTransformation.transform({
          decode: (s) => new globalThis.Date(s),
          encode: (date) => date.toISOString()
        })
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
 * All finite numbers, excluding `NaN`, `Infinity`, and `-Infinity`.
 *
 * @since 4.0.0
 */
export const Finite = Number.pipe(check(SchemaCheck.finite))

/**
 * @since 4.0.0
 */
export const FiniteFromString = String.pipe(decodeTo(
  Finite,
  {
    decode: SchemaGetter.Number,
    encode: SchemaGetter.String
  }
))

/**
 * @since 4.0.0
 */
export function getClassSchema<C extends new(...args: Array<any>) => any, S extends Struct<Struct.Fields>>(
  constructor: C,
  options: {
    readonly encoding: S
    readonly annotations?: SchemaAnnotations.Declaration<InstanceType<C>, readonly []>
  }
): decodeTo<instanceOf<C>, S, never, never> {
  const transformation = SchemaTransformation.transform<InstanceType<C>, S["Type"]>({
    decode: (props) => new constructor(props),
    encode: identity
  })
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
    SchemaAnnotations.Declaration<Self, readonly [S]>,
    S["~type.make.in"],
    S["~type.isReadonly"],
    S["~type.isOptional"],
    S["~type.default"],
    S["~encoded.isReadonly"],
    S["~encoded.isOptional"]
  >
{
  new(props: S["~type.make.in"], options?: MakeOptions): S["Type"] & Inherited
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
    annotations?: SchemaAnnotations.Bottom<Extended>
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
  annotations?: SchemaAnnotations.Declaration<unknown, ReadonlyArray<Top>>
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
    declare static readonly "~annotate.in": SchemaAnnotations.Declaration<Self, readonly [S]>
    declare static readonly "~type.make.in": S["~type.make.in"]

    declare static readonly "~type.isReadonly": S["~type.isReadonly"]
    declare static readonly "~type.isOptional": S["~type.isOptional"]
    declare static readonly "~type.default": S["~type.default"]

    declare static readonly "~encoded.isReadonly": S["~encoded.isReadonly"]
    declare static readonly "~encoded.isOptional": S["~encoded.isOptional"]

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
    static annotate(annotations: SchemaAnnotations.Bottom<Self>): Class<Self, S, Self> {
      return this.rebuild(SchemaAST.annotate(this.ast, annotations))
    }
    static extend<Extended>(
      identifier: string
    ): <NewFields extends Struct.Fields>(
      fields: NewFields,
      annotations?: SchemaAnnotations.Bottom<Extended>
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
      SchemaGetter.transform((input) => new self(input)),
      SchemaGetter.transformOrFail((input) => {
        if (!(input instanceof self)) {
          return Result.err(new SchemaIssue.InvalidType(ast, input))
        }
        return Result.ok(input)
      })
    )
  )

function getComputeAST(
  from: SchemaAST.AST,
  annotations: SchemaAnnotations.Declaration<unknown, ReadonlyArray<Top>> | undefined,
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
      annotations?: SchemaAnnotations.Bottom<Self>
    ): ExtendableClass<Self, Struct<Fields>, Brand>
    <S extends Struct<Struct.Fields>>(
      schema: S,
      annotations?: SchemaAnnotations.Bottom<Self>
    ): ExtendableClass<Self, S, Brand>
  }
} = <Self, Brand = {}>(identifier: string) =>
(
  schema: Struct.Fields | Struct<Struct.Fields>,
  annotations?: SchemaAnnotations.Bottom<Self>
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
      annotations?: SchemaAnnotations.Bottom<Self>
    ): ErrorClass<Self, Struct<Fields>, Cause.YieldableError & Brand>
    <S extends Struct<Struct.Fields>>(
      schema: S,
      annotations?: SchemaAnnotations.Bottom<Self>
    ): ErrorClass<Self, S, Cause.YieldableError & Brand>
  }
} = <Self, Brand = {}>(identifier: string) =>
(
  schema: Struct.Fields | Struct<Struct.Fields>,
  annotations?: SchemaAnnotations.Bottom<Self>
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
      readonly annotations?: SchemaAnnotations.Bottom<Self>
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

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface declareRefinement<T> extends declare<T, T, readonly []> {}

/**
 * @since 4.0.0
 */
export function declareRefinement<T>(
  options: {
    readonly is: (u: unknown) => u is T
    annotations?: SchemaAnnotations.Declaration<T, readonly []> | undefined
  }
): declareRefinement<T> {
  return declare([])<T>()(
    () => (input, ast) =>
      options.is(input) ?
        Result.ok(input) :
        Result.err(new SchemaIssue.InvalidType(ast, O.some(input))),
    options.annotations
  )
}

/**
 * @since 4.0.0
 */
export function declare<const TypeParameters extends ReadonlyArray<Top>>(typeParameters: TypeParameters) {
  return <E>() =>
  <T>(
    run: (
      typeParameters: {
        readonly [K in keyof TypeParameters]: Codec<TypeParameters[K]["Type"], TypeParameters[K]["Encoded"]>
      }
    ) => (u: unknown, self: SchemaAST.Declaration, options: SchemaAST.ParseOptions) => SchemaResult.SchemaResult<T>,
    annotations?: SchemaAnnotations.Declaration<T, TypeParameters>
  ): declare<T, E, TypeParameters> => {
    return make<declare<T, E, TypeParameters>>(
      new SchemaAST.Declaration(
        typeParameters.map((tp) => tp.ast),
        (typeParameters) => run(typeParameters.map(make) as any),
        annotations,
        undefined,
        undefined,
        undefined
      )
    )
  }
}
