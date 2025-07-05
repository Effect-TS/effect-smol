/**
 * @since 4.0.0
 */

import type { StandardSchemaV1 } from "@standard-schema/spec"
import * as Arr from "../Array.js"
import type { Brand } from "../Brand.js"
import type * as Cause from "../Cause.js"
import * as Data from "../Data.js"
import * as Effect from "../Effect.js"
import * as Equivalence from "../Equivalence.js"
import * as Exit from "../Exit.js"
import { identity } from "../Function.js"
import * as core from "../internal/core.js"
import * as O from "../Option.js"
import type { Pipeable } from "../Pipeable.js"
import { pipeArguments } from "../Pipeable.js"
import * as Predicate from "../Predicate.js"
import * as R from "../Record.js"
import * as Request from "../Request.js"
import * as Result from "../Result.js"
import * as Scheduler from "../Scheduler.js"
import type { Lambda, Merge, Mutable, Simplify } from "../Struct.js"
import { lambda, renameKeys } from "../Struct.js"
import type * as Annotations from "./Annotations.js"
import * as AST from "./AST.js"
import * as Check from "./Check.js"
import * as Formatter from "./Formatter.js"
import * as Getter from "./Getter.js"
import * as Issue from "./Issue.js"
import * as ToParser from "./ToParser.js"
import * as Transformation from "./Transformation.js"

/** Is this value required or optional? */
type Optionality = "required" | "optional"

/** Is this value read-only or mutable? */
type Mutability = "readonly" | "mutable"

/** Does the constructor supply a default value? */
type ConstructorDefault = "no-default" | "with-default"

/**
 * @category Model
 * @since 4.0.0
 */
export interface MakeOptions {
  readonly parseOptions?: AST.ParseOptions | undefined
  readonly disableValidation?: boolean | undefined
}

/**
 * @since 4.0.0
 * @category Symbols
 */
export const TypeId: TypeId = "~effect/schema/Schema"

/**
 * @since 4.0.0
 * @category Symbols
 */
export type TypeId = "~effect/schema/Schema"

/**
 * @category Model
 * @since 4.0.0
 */
export interface Bottom<
  T,
  E,
  RD,
  RE,
  Ast extends AST.AST,
  RebuildOut extends Top,
  AnnotateIn extends Annotations.Annotations,
  TypeMakeIn = T,
  TypeMake = TypeMakeIn,
  TypeMutability extends Mutability = "readonly",
  TypeOptionality extends Optionality = "required",
  TypeConstructorDefault extends ConstructorDefault = "no-default",
  EncodedMutability extends Mutability = "readonly",
  EncodedOptionality extends Optionality = "required"
> extends Pipeable {
  readonly [TypeId]: TypeId

  readonly ast: Ast
  readonly "~rebuild.out": RebuildOut
  readonly "~annotate.in": AnnotateIn

  readonly "Type": T
  readonly "Encoded": E
  readonly "DecodingServices": RD
  readonly "EncodingServices": RE

  readonly "~type.make.in": TypeMakeIn
  readonly "~type.make": TypeMake
  readonly "~type.mutability": TypeMutability
  readonly "~type.optionality": TypeOptionality
  readonly "~type.constructor.default": TypeConstructorDefault

  readonly "~encoded.mutability": EncodedMutability
  readonly "~encoded.optionality": EncodedOptionality

  annotate(annotations: this["~annotate.in"]): this["~rebuild.out"]
  rebuild(ast: this["ast"]): this["~rebuild.out"]
  /**
   * @throws {Error} The issue is contained in the error cause.
   */
  makeSync(input: this["~type.make.in"], options?: MakeOptions): this["Type"]
  check(
    ...checks: readonly [
      Check.Check<this["Type"]>,
      ...ReadonlyArray<Check.Check<this["Type"]>>
    ]
  ): this["~rebuild.out"]
}

/**
 * @since 4.0.0
 */
export function revealBottom<S extends Top>(
  bottom: S
): Bottom<
  S["Type"],
  S["Encoded"],
  S["DecodingServices"],
  S["EncodingServices"],
  S["ast"],
  S["~rebuild.out"],
  S["~annotate.in"],
  S["~type.make.in"],
  S["~type.make"],
  S["~type.mutability"],
  S["~type.optionality"],
  S["~type.constructor.default"],
  S["~encoded.mutability"],
  S["~encoded.optionality"]
> {
  return bottom
}

/**
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
export function annotateKey<S extends Top>(annotations: Annotations.Key) {
  return (self: S): S["~rebuild.out"] => {
    return self.rebuild(AST.annotateKey(self.ast, annotations))
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
  Ast extends AST.AST,
  RebuildOut extends Top,
  AnnotateIn extends Annotations.Annotations,
  TypeMakeIn = T,
  TypeMake = TypeMakeIn,
  TypeMutability extends Mutability = "readonly",
  TypeOptionality extends Optionality = "required",
  TypeConstructorDefault extends ConstructorDefault = "no-default",
  EncodedMutability extends Mutability = "readonly",
  EncodedOptionality extends Optionality = "required"
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
    TypeMake,
    TypeMutability,
    TypeOptionality,
    TypeConstructorDefault,
    EncodedMutability,
    EncodedOptionality
  >
{
  readonly [TypeId]: TypeId = TypeId

  declare readonly "Type": T
  declare readonly "Encoded": E
  declare readonly "DecodingServices": RD
  declare readonly "EncodingServices": RE

  declare readonly "~rebuild.out": RebuildOut
  declare readonly "~annotate.in": AnnotateIn

  declare readonly "~type.make.in": TypeMakeIn
  declare readonly "~type.make": TypeMake
  declare readonly "~type.mutability": TypeMutability
  declare readonly "~type.optionality": TypeOptionality
  declare readonly "~type.constructor.default": TypeConstructorDefault

  declare readonly "~encoded.mutability": EncodedMutability
  declare readonly "~encoded.optionality": EncodedOptionality

  readonly makeSync: (input: this["~type.make.in"], options?: MakeOptions) => this["Type"]

  constructor(readonly ast: Ast) {
    this.makeSync = ToParser.makeSync(this)
  }
  abstract rebuild(ast: this["ast"]): this["~rebuild.out"]
  pipe() {
    return pipeArguments(this, arguments)
  }
  annotate(annotations: this["~annotate.in"]): this["~rebuild.out"] {
    return this.rebuild(AST.annotate(this.ast, annotations))
  }
  check(
    ...checks: readonly [
      Check.Check<this["Type"]>,
      ...ReadonlyArray<Check.Check<this["Type"]>>
    ]
  ): this["~rebuild.out"] {
    return this.rebuild(AST.appendChecks(this.ast, checks))
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
    AST.AST,
    Top,
    Annotations.Annotations,
    unknown,
    unknown,
    Mutability,
    Optionality,
    ConstructorDefault,
    Mutability,
    Optionality
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
  export type DecodingServices<S extends Top> = S["DecodingServices"]
  /**
   * @since 4.0.0
   */
  export type EncodingServices<S extends Top> = S["EncodingServices"]
  /**
   * @since 4.0.0
   */
  export type ToAsserts<S extends Top & { readonly DecodingServices: never }> = <I>(
    input: I
  ) => asserts input is I & S["Type"]
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Codec<out T, out E = T, out RD = never, out RE = never> extends Schema<T> {
  readonly "Encoded": E
  readonly "DecodingServices": RD
  readonly "EncodingServices": RE
  readonly "~rebuild.out": Codec<T, E, RD, RE>
}

/**
 * Returns the underlying `Codec<T, E, RD, RE>`.
 *
 * @since 4.0.0
 */
export function revealCodec<T, E, RD, RE>(codec: Codec<T, E, RD, RE>) {
  return codec
}

/**
 * @since 4.0.0
 * @category error
 */
export class SchemaError extends Data.TaggedError("SchemaError")<{
  readonly issue: Issue.Issue
}> {}

function makeStandardResult<A>(exit: Exit.Exit<StandardSchemaV1.Result<A>>): StandardSchemaV1.Result<A> {
  return Exit.isSuccess(exit) ? exit.value : {
    issues: [{ message: Formatter.formatCause(exit.cause) }]
  }
}

/**
 * Returns a "Standard Schema" object conforming to the [Standard Schema
 * v1](https://standardschema.dev/) specification.
 *
 * This function creates a schema whose `validate` method attempts to decode and
 * validate the provided input synchronously. If the underlying `Schema`
 * includes any asynchronous components (e.g., asynchronous message resolutions
 * or checks), then validation will necessarily return a `Promise` instead.
 *
 * @category Standard Schema
 * @since 4.0.0
 */
export const standardSchemaV1 = <S extends Top>(
  self: S,
  options: {
    readonly leafHook: Formatter.LeafHook
    readonly checkHook: Formatter.CheckHook
    readonly parseOptions?: AST.ParseOptions | undefined
  }
): StandardSchemaV1<S["Encoded"], S["Type"]> & S => {
  const decodeUnknownEffect = ToParser.decodeUnknownEffect(self) as (
    input: unknown,
    options?: AST.ParseOptions
  ) => Effect.Effect<S["Type"], Issue.Issue>
  const parseOptions: AST.ParseOptions = { errors: "all", ...options?.parseOptions }
  const formatter = Formatter.getStandardSchemaV1({
    leafHook: options.leafHook,
    checkHook: options.checkHook
  })
  const standard: StandardSchemaV1<S["Encoded"], S["Type"]> = {
    "~standard": {
      version: 1,
      vendor: "effect",
      validate(value) {
        const scheduler = new Scheduler.MixedScheduler()
        const fiber = Effect.runFork(
          Effect.match(decodeUnknownEffect(value, parseOptions), {
            onFailure: formatter.format,
            onSuccess: (value): StandardSchemaV1.Result<S["Type"]> => ({ value })
          }),
          { scheduler }
        )
        scheduler.flush()
        const exit = fiber.unsafePoll()
        if (exit) {
          return makeStandardResult(exit)
        }
        return new Promise((resolve) => {
          fiber.addObserver((exit) => {
            resolve(makeStandardResult(exit))
          })
        })
      }
    }
  }
  return Object.assign(self, standard)
}

/**
 * @category Asserting
 * @since 4.0.0
 */
export const is = ToParser.is

/**
 * @category Asserting
 * @since 4.0.0
 */
export const asserts = ToParser.asserts

/**
 * Creates a decoder function that parses unknown input and returns an `Effect` with either the successfully decoded value or a `SchemaError`.
 *
 * This function is the effectful version of decoding that properly handles asynchronous operations and service dependencies.
 * It wraps the lower-level `ToParser.decodeUnknownEffect` function to provide a more convenient API that uses `SchemaError` instead of raw `Issue` objects.
 *
 * @example Basic Usage
 * ```ts
 * import { Effect } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const decoder = Schema.decodeUnknownEffect(Schema.Number)
 *
 * // Successful decoding
 * const successEffect = decoder(42)
 * Effect.runPromise(successEffect).then(console.log) // 42
 *
 * // Failed decoding
 * const failureEffect = decoder("not a number")
 * Effect.runPromise(failureEffect).catch(console.log) // SchemaError with detailed issue
 * ```
 *
 * @example With Complex Schema
 * ```ts
 * import { Effect } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const decoder = Schema.decodeUnknownEffect(PersonSchema)
 *
 * // Valid input
 * const validInput = { name: "John", age: 30 }
 * const validEffect = decoder(validInput)
 * Effect.runPromise(validEffect).then(console.log) // { name: "John", age: 30 }
 *
 * // Invalid input
 * const invalidInput = { name: "John", age: "thirty" }
 * const invalidEffect = decoder(invalidInput)
 * Effect.runPromise(invalidEffect).catch(error => {
 *   console.log(error._tag) // "SchemaError"
 *   console.log(error.issue) // Contains detailed validation information
 * })
 * ```
 *
 * @example With Parse Options
 * ```ts
 * import { Effect } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const decoder = Schema.decodeUnknownEffect(Schema.Number)
 *
 * const options = { errors: "all" as const }
 * const effect = decoder("not a number", options)
 *
 * Effect.runPromise(effect).catch(error => {
 *   console.log(error._tag) // "SchemaError"
 *   // Error contains all validation issues, not just the first one
 * })
 * ```
 *
 * @category Decoding
 * @since 4.0.0
 */
export function decodeUnknownEffect<T, E, RD, RE>(codec: Codec<T, E, RD, RE>) {
  const parser = ToParser.decodeUnknownEffect(codec)
  return (input: unknown, options?: AST.ParseOptions): Effect.Effect<T, SchemaError, RD> => {
    return Effect.mapError(parser(input, options), (issue) => new SchemaError({ issue }))
  }
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeEffect: <T, E, RD, RE>(
  codec: Codec<T, E, RD, RE>
) => (input: E, options?: AST.ParseOptions) => Effect.Effect<T, SchemaError, RD> = decodeUnknownEffect

/**
 * @category Decoding
 * @since 4.0.0
 */
export function decodeUnknownResult<T, E, RE>(codec: Codec<T, E, never, RE>) {
  const parser = ToParser.decodeUnknownResult(codec)
  return (input: unknown, options?: AST.ParseOptions): Result.Result<T, SchemaError> => {
    return Result.mapError(parser(input, options), (issue) => new SchemaError({ issue }))
  }
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeResult: <T, E, RE>(
  codec: Codec<T, E, never, RE>
) => (input: E, options?: AST.ParseOptions) => Result.Result<T, SchemaError> = decodeUnknownResult

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeUnknownOption = ToParser.decodeUnknownOption

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeOption = ToParser.decodeOption

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeUnknownPromise = ToParser.decodeUnknownPromise

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodePromise = ToParser.decodePromise

/**
 * Synchronously decodes an unknown value against a schema, throwing an error if validation fails.
 *
 * This function takes a schema and returns a decoder function that accepts an unknown input
 * and synchronously validates it against the schema. If validation succeeds, it returns the
 * decoded value. If validation fails, it throws an error with the validation issue.
 *
 * Use this function when you need immediate validation results and are working in a synchronous
 * context. For asynchronous validation or when you want to handle errors as Effects, use
 * `decodeUnknownEffect` instead.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Basic usage with primitive types
 * const decoder = Schema.decodeUnknownSync(Schema.String)
 *
 * console.log(decoder("hello"))
 * // Output: "hello"
 *
 * try {
 *   decoder(42)
 * } catch (error) {
 *   console.log("Validation failed:", String(error))
 * }
 *
 * // Complex object validation
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number,
 *   email: Schema.String
 * })
 *
 * const personDecoder = Schema.decodeUnknownSync(PersonSchema)
 *
 * // Valid input
 * const person = personDecoder({
 *   name: "John Doe",
 *   age: 30,
 *   email: "john@example.com"
 * })
 * console.log(person)
 * // Output: { name: "John Doe", age: 30, email: "john@example.com" }
 *
 * // Array validation
 * const numbersDecoder = Schema.decodeUnknownSync(Schema.Array(Schema.Number))
 * console.log(numbersDecoder([1, 2, 3, 4]))
 * // Output: [1, 2, 3, 4]
 *
 * // With transformation
 * const numberDecoder = Schema.decodeUnknownSync(Schema.FiniteFromString)
 * console.log(numberDecoder("42"))
 * // Output: 42
 * ```
 *
 * @category Decoding
 * @since 4.0.0
 */
export const decodeUnknownSync = ToParser.decodeUnknownSync

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeSync = ToParser.decodeSync

/**
 * @category Encoding
 * @since 4.0.0
 */
export function encodeUnknownEffect<T, E, RD, RE>(codec: Codec<T, E, RD, RE>) {
  const parser = ToParser.encodeUnknownEffect(codec)
  return (input: unknown, options?: AST.ParseOptions): Effect.Effect<E, SchemaError, RE> => {
    return Effect.mapError(parser(input, options), (issue) => new SchemaError({ issue }))
  }
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeEffect: <T, E, RD, RE>(
  codec: Codec<T, E, RD, RE>
) => (input: T, options?: AST.ParseOptions) => Effect.Effect<E, SchemaError, RE> = encodeUnknownEffect

/**
 * @category Encoding
 * @since 4.0.0
 */
export function encodeUnknownResult<T, E, RD>(codec: Codec<T, E, RD, never>) {
  const parser = ToParser.encodeUnknownResult(codec)
  return (input: unknown, options?: AST.ParseOptions): Result.Result<E, SchemaError> => {
    return Result.mapError(parser(input, options), (issue) => new SchemaError({ issue }))
  }
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeResult: <T, E, RD>(
  codec: Codec<T, E, RD, never>
) => (input: T, options?: AST.ParseOptions) => Result.Result<E, SchemaError> = encodeUnknownResult

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeUnknownOption = ToParser.encodeUnknownOption

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeOption = ToParser.encodeOption

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeUnknownPromise = ToParser.encodeUnknownPromise

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodePromise = ToParser.encodePromise

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeUnknownSync = ToParser.encodeUnknownSync

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeSync = ToParser.encodeSync

class make$<S extends Top> extends Bottom$<
  S["Type"],
  S["Encoded"],
  S["DecodingServices"],
  S["EncodingServices"],
  S["ast"],
  S["~rebuild.out"],
  S["~annotate.in"],
  S["~type.make.in"],
  S["~type.make"],
  S["~type.mutability"],
  S["~type.optionality"],
  S["~type.constructor.default"],
  S["~encoded.mutability"],
  S["~encoded.optionality"]
> {
  constructor(
    ast: S["ast"],
    readonly rebuild: (ast: S["ast"]) => S["~rebuild.out"]
  ) {
    super(ast)
  }
}

class makeWithSchema$<S extends Top, Result extends Top> extends make$<Result> {
  constructor(ast: AST.AST, readonly schema: S) {
    super(ast, (ast) => new makeWithSchema$(ast, this.schema))
  }
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function make<S extends Top>(ast: S["ast"]): Bottom<
  S["Type"],
  S["Encoded"],
  S["DecodingServices"],
  S["EncodingServices"],
  S["ast"],
  S["~rebuild.out"],
  S["~annotate.in"],
  S["~type.make.in"],
  S["~type.make"],
  S["~type.mutability"],
  S["~type.optionality"],
  S["~type.constructor.default"],
  S["~encoded.mutability"],
  S["~encoded.optionality"]
> {
  const rebuild = (ast: AST.AST) => new make$<S>(ast, rebuild)
  return rebuild(ast)
}

/**
 * Tests if a value is a `Schema`.
 *
 * @category guards
 * @since 4.0.0
 */
export function isSchema(u: unknown): u is Schema<unknown> {
  return Predicate.hasProperty(u, TypeId) && u[TypeId] === TypeId
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface optionalKey<S extends Top> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingServices"],
    S["EncodingServices"],
    S["ast"],
    optionalKey<S>,
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.mutability"],
    "optional",
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    "optional"
  >
{
  readonly schema: S
}

interface optionalKeyLambda extends Lambda {
  <S extends Top>(self: S): optionalKey<S>
  readonly "~lambda.out": this["~lambda.in"] extends Top ? optionalKey<this["~lambda.in"]> : never
}

/**
 * @since 4.0.0
 */
export const optionalKey = lambda<optionalKeyLambda>(function optionalKey<S extends Top>(self: S): optionalKey<S> {
  return new makeWithSchema$<S, optionalKey<S>>(AST.optionalKey(self.ast), self)
})

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface optional<S extends Top> extends optionalKey<Union<readonly [S, Undefined]>> {
  readonly "~rebuild.out": optional<S>
}

interface optionalLambda extends Lambda {
  <S extends Top>(self: S): optional<S>
  readonly "~lambda.out": this["~lambda.in"] extends Top ? optional<this["~lambda.in"]> : never
}

/**
 * Creates an optional schema field that allows both the specified type and `undefined`.
 *
 * This is equivalent to `optionalKey(UndefinedOr(schema))`, creating a field that:
 * - Can be omitted from the object entirely
 * - Can be explicitly set to `undefined`
 * - Can contain the specified schema type
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a struct with an optional string field
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   nickname: Schema.optional(Schema.String)
 * })
 *
 * // All of these are valid:
 * Schema.decodeSync(PersonSchema)({ name: "John" })
 * // => { name: "John" }
 *
 * Schema.decodeSync(PersonSchema)({ name: "John", nickname: "Johnny" })
 * // => { name: "John", nickname: "Johnny" }
 *
 * Schema.decodeSync(PersonSchema)({ name: "John", nickname: undefined })
 * // => { name: "John", nickname: undefined }
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const optional = lambda<optionalLambda>(function optional<S extends Top>(self: S): optional<S> {
  return optionalKey(UndefinedOr(self))
})

/**
 * @since 4.0.0
 */
export interface mutableKey<S extends Top> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingServices"],
    S["EncodingServices"],
    S["ast"],
    mutableKey<S>,
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    "mutable",
    S["~type.optionality"],
    S["~type.constructor.default"],
    "mutable",
    S["~encoded.optionality"]
  >
{
  readonly schema: S
}

interface mutableKeyLambda extends Lambda {
  <S extends Top>(self: S): mutableKey<S>
  readonly "~lambda.out": this["~lambda.in"] extends Top ? mutableKey<this["~lambda.in"]> : never
}

/**
 * @since 4.0.0
 */
export const mutableKey = lambda<mutableKeyLambda>(function mutableKey<S extends Top>(self: S): mutableKey<S> {
  return new makeWithSchema$<S, mutableKey<S>>(AST.mutableKey(self.ast), self)
})

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
    S["~type.make.in"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{}

interface typeCodecLambda extends Lambda {
  <S extends Top>(self: S): typeCodec<S>
  readonly "~lambda.out": this["~lambda.in"] extends Top ? typeCodec<this["~lambda.in"]> : never
}

/**
 * @since 4.0.0
 */
export const typeCodec = lambda<typeCodecLambda>(function typeCodec<S extends Top>(self: S): typeCodec<S> {
  return new makeWithSchema$<S, typeCodec<S>>(AST.typeAST(self.ast), self)
})

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
    AST.AST,
    encodedCodec<S>,
    Annotations.Annotations,
    S["Encoded"],
    S["Encoded"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{}

interface encodedCodecLambda extends Lambda {
  <S extends Top>(self: S): encodedCodec<S>
  readonly "~lambda.out": this["~lambda.in"] extends Top ? encodedCodec<this["~lambda.in"]> : never
}

/**
 * @since 4.0.0
 */
export const encodedCodec = lambda<encodedCodecLambda>(function encodedCodec<S extends Top>(self: S): encodedCodec<S> {
  return new makeWithSchema$<S, encodedCodec<S>>(AST.encodedAST(self.ast), self)
})

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface flip<S extends Top> extends
  Bottom<
    S["Encoded"],
    S["Type"],
    S["EncodingServices"],
    S["DecodingServices"],
    AST.AST,
    flip<S>,
    Annotations.Bottom<S["Encoded"]>,
    S["Encoded"],
    S["Encoded"],
    S["~encoded.mutability"],
    S["~encoded.optionality"],
    ConstructorDefault,
    S["~type.mutability"],
    S["~type.optionality"]
  >
{
  readonly schema: S
}

const FLIP_ID = "~effect/flip$"

class flip$<S extends Top> extends makeWithSchema$<S, flip<S>> implements flip<S> {
  readonly [FLIP_ID] = FLIP_ID
}

function isFlip$(schema: Top): schema is flip<any> {
  return Predicate.hasProperty(schema, FLIP_ID) && schema[FLIP_ID] === FLIP_ID
}

/**
 * @since 4.0.0
 */
export function flip<S extends Top>(schema: S): S extends flip<infer F> ? F["~rebuild.out"] : flip<S>
export function flip<S extends Top>(schema: S): flip<S> {
  if (isFlip$(schema)) {
    return schema.schema.rebuild(AST.flip(schema.ast))
  }
  return new flip$(AST.flip(schema.ast), schema)
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface declare<T, E, TypeParameters extends ReadonlyArray<Top>> extends
  Bottom<
    T,
    E,
    TypeParameters[number]["DecodingServices"],
    TypeParameters[number]["EncodingServices"],
    AST.Declaration,
    declare<T, E, TypeParameters>,
    Annotations.Declaration<T, TypeParameters>
  >
{}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Literal<L extends AST.Literal>
  extends Bottom<L, L, never, never, AST.LiteralType, Literal<L>, Annotations.Annotations>
{
  readonly literal: L
}

class Literal$<L extends AST.Literal> extends make$<Literal<L>> implements Literal<L> {
  constructor(ast: AST.LiteralType, readonly literal: L) {
    super(ast, (ast) => new Literal$(ast, literal))
  }
}

/**
 * Creates a schema that validates a specific literal value.
 *
 * A literal schema only accepts the exact value provided during schema creation.
 * This is useful for creating schemas that match specific constants like
 * string literals, numbers, booleans, or bigints.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // String literal
 * const RedSchema = Schema.Literal("red")
 *
 * Schema.decodeUnknownSync(RedSchema)("red")    // "red"
 * Schema.decodeUnknownSync(RedSchema)("blue")   // throws ParseError
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Number literal
 * const FortyTwoSchema = Schema.Literal(42)
 *
 * Schema.decodeUnknownSync(FortyTwoSchema)(42)  // 42
 * Schema.decodeUnknownSync(FortyTwoSchema)(43)  // throws ParseError
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Boolean literal
 * const TrueSchema = Schema.Literal(true)
 * const FalseSchema = Schema.Literal(false)
 *
 * Schema.decodeUnknownSync(TrueSchema)(true)    // true
 * Schema.decodeUnknownSync(TrueSchema)(false)   // throws ParseError
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // BigInt literal
 * const BigIntSchema = Schema.Literal(100n)
 *
 * Schema.decodeUnknownSync(BigIntSchema)(100n)  // 100n
 * Schema.decodeUnknownSync(BigIntSchema)(200n)  // throws ParseError
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Usage in unions and structures
 * const StatusSchema = Schema.Union([
 *   Schema.Literal("pending"),
 *   Schema.Literal("completed"),
 *   Schema.Literal("failed")
 * ])
 *
 * const TaskSchema = Schema.Struct({
 *   id: Schema.Number,
 *   status: StatusSchema,
 *   priority: Schema.Literal("high")
 * })
 *
 * const task = Schema.decodeUnknownSync(TaskSchema)({
 *   id: 1,
 *   status: "pending",
 *   priority: "high"
 * })
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export function Literal<L extends AST.Literal>(literal: L): Literal<L> {
  return new Literal$(new AST.LiteralType(literal), literal)
}

/**
 * @since 4.0.0
 */
export declare namespace TemplateLiteral {
  /**
   * @since 4.0.0
   */
  export interface SchemaPart extends Top {
    readonly Encoded: string | number | bigint
  }
  /**
   * @since 4.0.0
   */
  export type Part = SchemaPart | AST.TemplateLiteral.LiteralPart
  /**
   * @since 4.0.0
   */
  export type Parts = ReadonlyArray<Part>

  type AppendType<
    Template extends string,
    Next
  > = Next extends AST.TemplateLiteral.LiteralPart ? `${Template}${Next}`
    : Next extends Codec<unknown, infer E extends AST.TemplateLiteral.LiteralPart, unknown, unknown> ? `${Template}${E}`
    : never

  /**
   * @since 4.0.0
   */
  export type Encoded<Parts> = Parts extends readonly [...infer Init, infer Last] ? AppendType<Encoded<Init>, Last>
    : ``
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface TemplateLiteral<Parts extends TemplateLiteral.Parts> extends
  Bottom<
    TemplateLiteral.Encoded<Parts>,
    TemplateLiteral.Encoded<Parts>,
    never,
    never,
    AST.TemplateLiteral,
    TemplateLiteral<Parts>,
    Annotations.Annotations
  >
{
  readonly parts: Parts
}

class TemplateLiteral$<Parts extends TemplateLiteral.Parts> extends make$<TemplateLiteral<Parts>>
  implements TemplateLiteral<Parts>
{
  constructor(ast: AST.TemplateLiteral, readonly parts: Parts) {
    super(ast, (ast) => new TemplateLiteral$(ast, parts))
  }
}

function templateLiteralFromParts<Parts extends TemplateLiteral.Parts>(parts: Parts) {
  return new AST.TemplateLiteral(parts.map((part) => isSchema(part) ? part.ast : part))
}

/**
 * @since 4.0.0
 */
export function TemplateLiteral<const Parts extends TemplateLiteral.Parts>(parts: Parts): TemplateLiteral<Parts> {
  return new TemplateLiteral$(
    templateLiteralFromParts(parts),
    [...parts] as Parts
  )
}

/**
 * @since 4.0.0
 */
export declare namespace TemplateLiteralParser {
  /**
   * @since 4.0.0
   */
  export type Type<Parts> = Parts extends readonly [infer Head, ...infer Tail] ? readonly [
      Head extends AST.TemplateLiteral.LiteralPart ? Head :
        Head extends Codec<infer T, unknown, unknown, unknown> ? T
        : never,
      ...Type<Tail>
    ]
    : []
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface TemplateLiteralParser<Parts extends TemplateLiteral.Parts> extends
  Bottom<
    TemplateLiteralParser.Type<Parts>,
    TemplateLiteral.Encoded<Parts>,
    never,
    never,
    AST.TupleType,
    TemplateLiteralParser<Parts>,
    Annotations.Annotations
  >
{
  readonly parts: Parts
}

class TemplateLiteralParser$<Parts extends TemplateLiteral.Parts> extends make$<TemplateLiteralParser<Parts>>
  implements TemplateLiteralParser<Parts>
{
  constructor(ast: AST.TupleType, readonly parts: Parts) {
    super(ast, (ast) => new TemplateLiteralParser$(ast, parts))
  }
}

/**
 * @since 4.0.0
 */
export function TemplateLiteralParser<const Parts extends TemplateLiteral.Parts>(
  parts: Parts
): TemplateLiteralParser<Parts> {
  return new TemplateLiteralParser$(
    templateLiteralFromParts(parts).asTemplateLiteralParser(),
    [...parts] as Parts
  )
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Enums<A extends { [x: string]: string | number }>
  extends Bottom<A[keyof A], A[keyof A], never, never, AST.Enums, Enums<A>, Annotations.Annotations>
{
  readonly enums: A
}

class Enums$<A extends { [x: string]: string | number }> extends make$<Enums<A>> implements Enums<A> {
  constructor(ast: AST.Enums, readonly enums: A) {
    super(ast, (ast) => new Enums$(ast, enums))
  }
}

/**
 * @since 4.0.0
 */
export function Enums<A extends { [x: string]: string | number }>(enums: A): Enums<A> {
  return new Enums$(
    new AST.Enums(
      Object.keys(enums).filter(
        (key) => typeof enums[enums[key]] !== "number"
      ).map((key) => [key, enums[key]])
    ),
    enums
  )
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Never extends Bottom<never, never, never, never, AST.NeverKeyword, Never, Annotations.Bottom<never>> {}

/**
 * @since 4.0.0
 */
export const Never: Never = make<Never>(AST.neverKeyword)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Any extends Bottom<any, any, never, never, AST.AnyKeyword, Any, Annotations.Bottom<any>> {}

/**
 * A schema for the `any` type that accepts any value without type checking.
 *
 * This schema is useful when you need to accept any value, effectively disabling
 * type checking for that part of your schema. It's typically used in scenarios
 * where you're migrating from untyped code or when you need maximum flexibility.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Basic usage
 * const schema = Schema.Any
 *
 * // Accepts any value
 * Schema.decodeUnknownSync(schema)("hello")     // "hello"
 * Schema.decodeUnknownSync(schema)(42)          // 42
 * Schema.decodeUnknownSync(schema)(true)        // true
 * Schema.decodeUnknownSync(schema)(null)        // null
 * Schema.decodeUnknownSync(schema)(undefined)   // undefined
 * Schema.decodeUnknownSync(schema)([1, 2, 3])   // [1, 2, 3]
 * Schema.decodeUnknownSync(schema)({ a: 1 })    // { a: 1 }
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Usage in structures
 * const MixedSchema = Schema.Struct({
 *   id: Schema.String,
 *   data: Schema.Any,    // Accepts any value
 *   timestamp: Schema.Number
 * })
 *
 * const result = Schema.decodeUnknownSync(MixedSchema)({
 *   id: "user-123",
 *   data: { complex: "structure", with: [1, 2, 3] },
 *   timestamp: 1234567890
 * })
 * // { id: "user-123", data: { complex: "structure", with: [1, 2, 3] }, timestamp: 1234567890 }
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Migration scenario - gradually adding type safety
 * const LegacyApiResponse = Schema.Struct({
 *   status: Schema.String,
 *   data: Schema.Any,        // Legacy field, will be typed later
 *   metadata: Schema.Any     // Legacy field, will be typed later
 * })
 *
 * // Later, you can refine to specific types
 * const TypedApiResponse = Schema.Struct({
 *   status: Schema.String,
 *   data: Schema.Struct({
 *     users: Schema.Array(Schema.String),
 *     count: Schema.Number
 *   }),
 *   metadata: Schema.Struct({
 *     version: Schema.String,
 *     timestamp: Schema.Number
 *   })
 * })
 * ```
 *
 * @category primitives
 * @since 4.0.0
 */
export const Any: Any = make<Any>(AST.anyKeyword)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Unknown
  extends Bottom<unknown, unknown, never, never, AST.UnknownKeyword, Unknown, Annotations.Bottom<unknown>>
{}

/**
 * A schema for the `unknown` type - accepts any value but provides type safety
 * by requiring type narrowing before use.
 *
 * The `Unknown` schema is useful when you need to accept values of any type
 * but want to maintain type safety. Unlike `Any`, `Unknown` forces you to
 * verify the type before using the value, preventing runtime errors.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Basic usage
 * const schema = Schema.Unknown
 *
 * // Accepts any value
 * Schema.decodeUnknownSync(schema)("hello")        // "hello"
 * Schema.decodeUnknownSync(schema)(42)             // 42
 * Schema.decodeUnknownSync(schema)(true)           // true
 * Schema.decodeUnknownSync(schema)({ a: 1 })       // { a: 1 }
 * Schema.decodeUnknownSync(schema)([1, 2, 3])      // [1, 2, 3]
 * Schema.decodeUnknownSync(schema)(null)           // null
 * Schema.decodeUnknownSync(schema)(undefined)      // undefined
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Usage in API responses where data structure is unknown
 * const ApiResponseSchema = Schema.Struct({
 *   status: Schema.String,
 *   data: Schema.Unknown  // Could be anything
 * })
 *
 * const response = Schema.decodeUnknownSync(ApiResponseSchema)({
 *   status: "success",
 *   data: { id: 123, name: "Alice" }
 * })
 * // { status: "success", data: { id: 123, name: "Alice" } }
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Usage in optional fields where value might be unknown
 * const FlexibleConfigSchema = Schema.Struct({
 *   name: Schema.String,
 *   version: Schema.String,
 *   metadata: Schema.optional(Schema.Unknown)  // Could be anything
 * })
 *
 * // Works with any metadata type
 * Schema.decodeUnknownSync(FlexibleConfigSchema)({
 *   name: "my-app",
 *   version: "1.0.0",
 *   metadata: { custom: "data", arrays: [1, 2, 3] }
 * })
 * // { name: "my-app", version: "1.0.0", metadata: { custom: "data", arrays: [1, 2, 3] } }
 * ```
 *
 * @category primitives
 * @since 4.0.0
 */
export const Unknown: Unknown = make<Unknown>(AST.unknownKeyword)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Null extends Bottom<null, null, never, never, AST.NullKeyword, Null, Annotations.Bottom<null>> {}

/**
 * A schema for the `null` primitive type.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Basic usage
 * const schema = Schema.Null
 *
 * // Valid null value
 * Schema.decodeUnknownSync(schema)(null)  // null
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Usage in structures
 * const UserProfileSchema = Schema.Struct({
 *   avatar: Schema.Null,
 *   nickname: Schema.String
 * })
 *
 * // Usage with NullOr for nullable fields
 * const OptionalFieldSchema = Schema.Struct({
 *   data: Schema.NullOr(Schema.String)
 * })
 * ```
 *
 * @category primitives
 * @since 4.0.0
 */
export const Null: Null = make<Null>(AST.nullKeyword)

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
    AST.UndefinedKeyword,
    Undefined,
    Annotations.Bottom<undefined>
  >
{}

/**
 * A schema for the `undefined` primitive type.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Basic usage
 * const schema = Schema.Undefined
 *
 * // Valid undefined values
 * Schema.decodeUnknownSync(schema)(undefined)  // undefined
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Usage in structures
 * const ConfigSchema = Schema.Struct({
 *   setting: Schema.String,
 *   value: Schema.UndefinedOr(Schema.Number)
 * })
 *
 * const config = Schema.decodeUnknownSync(ConfigSchema)({
 *   setting: "theme",
 *   value: undefined
 * })
 * // { setting: "theme", value: undefined }
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Type guards and validation
 * const isUndefined = Schema.is(Schema.Undefined)
 *
 * console.log(isUndefined(undefined))  // true
 * console.log(isUndefined(null))       // false
 * console.log(isUndefined(""))         // false
 * console.log(isUndefined(0))          // false
 * ```
 *
 * @category primitives
 * @since 4.0.0
 */
export const Undefined: Undefined = make<Undefined>(AST.undefinedKeyword)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface String
  extends Bottom<string, string, never, never, AST.StringKeyword, String, Annotations.Bottom<string>>
{}

/**
 * A schema for the `string` primitive type.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Basic usage
 * const schema = Schema.String
 *
 * // Valid strings
 * Schema.decodeUnknownSync(schema)("hello")     // "hello"
 * Schema.decodeUnknownSync(schema)("")          // ""
 * Schema.decodeUnknownSync(schema)("123")       // "123"
 * Schema.decodeUnknownSync(schema)("unicode 🌟") // "unicode 🌟"
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Usage in structures
 * const UserSchema = Schema.Struct({
 *   id: Schema.String,
 *   name: Schema.String,
 *   email: Schema.String
 * })
 *
 * const user = Schema.decodeUnknownSync(UserSchema)({
 *   id: "user-123",
 *   name: "Alice",
 *   email: "alice@example.com"
 * })
 * // { id: "user-123", name: "Alice", email: "alice@example.com" }
 * ```
 *
 * @example
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * // With validation constraints
 * const NonEmptyString = Schema.String.check(Check.nonEmpty())
 * const EmailString = Schema.String.check(Check.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
 * const TrimmedString = Schema.String.check(Check.trimmed())
 * const LengthString = Schema.String.check(Check.minLength(3), Check.maxLength(10))
 *
 * Schema.decodeUnknownSync(NonEmptyString)("hello")    // "hello"
 * Schema.decodeUnknownSync(TrimmedString)("no spaces") // "no spaces"
 * Schema.decodeUnknownSync(LengthString)("valid")      // "valid"
 * ```
 *
 * @category primitives
 * @since 4.0.0
 */
export const String: String = make<String>(AST.stringKeyword)

/**
 * All numbers, including `NaN`, `Infinity`, and `-Infinity`.
 *
 * @category Api interface
 * @since 4.0.0
 */
export interface Number
  extends Bottom<number, number, never, never, AST.NumberKeyword, Number, Annotations.Bottom<number>>
{}

/**
 * A schema for the `number` primitive type.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Basic usage
 * const schema = Schema.Number
 *
 * // Valid numbers
 * Schema.decodeUnknownSync(schema)(42)        // 42
 * Schema.decodeUnknownSync(schema)(3.14)      // 3.14
 * Schema.decodeUnknownSync(schema)(-1)        // -1
 * Schema.decodeUnknownSync(schema)(0)         // 0
 * Schema.decodeUnknownSync(schema)(Infinity)  // Infinity
 * Schema.decodeUnknownSync(schema)(NaN)       // NaN
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Usage in structures
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const person = Schema.decodeUnknownSync(PersonSchema)({
 *   name: "John",
 *   age: 30
 * })
 * // { name: "John", age: 30 }
 * ```
 *
 * @example
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * // With validation constraints
 * const PositiveNumber = Schema.Number.check(Check.positive())
 * const IntegerNumber = Schema.Number.check(Check.int())
 * const RangeNumber = Schema.Number.check(Check.between(0, 100))
 *
 * Schema.decodeUnknownSync(PositiveNumber)(5)   // 5
 * Schema.decodeUnknownSync(IntegerNumber)(42)   // 42
 * Schema.decodeUnknownSync(RangeNumber)(50)     // 50
 * ```
 *
 * @category primitives
 * @since 4.0.0
 */
export const Number: Number = make<Number>(AST.numberKeyword)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Boolean
  extends Bottom<boolean, boolean, never, never, AST.BooleanKeyword, Boolean, Annotations.Bottom<boolean>>
{}

/**
 * A schema for the `boolean` primitive type.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Basic usage
 * const schema = Schema.Boolean
 *
 * // Valid boolean values
 * Schema.decodeUnknownSync(schema)(true)   // true
 * Schema.decodeUnknownSync(schema)(false)  // false
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Usage in structures
 * const UserPreferencesSchema = Schema.Struct({
 *   darkMode: Schema.Boolean,
 *   notifications: Schema.Boolean,
 *   autoSave: Schema.Boolean
 * })
 *
 * const preferences = Schema.decodeUnknownSync(UserPreferencesSchema)({
 *   darkMode: true,
 *   notifications: false,
 *   autoSave: true
 * })
 * // { darkMode: true, notifications: false, autoSave: true }
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Usage with optional fields
 * const ConfigSchema = Schema.Struct({
 *   enabled: Schema.Boolean,
 *   debug: Schema.optional(Schema.Boolean)
 * })
 *
 * const config1 = Schema.decodeUnknownSync(ConfigSchema)({
 *   enabled: true
 * })
 * // { enabled: true, debug: undefined }
 *
 * const config2 = Schema.decodeUnknownSync(ConfigSchema)({
 *   enabled: false,
 *   debug: true
 * })
 * // { enabled: false, debug: true }
 * ```
 *
 * @category primitives
 * @since 4.0.0
 */
export const Boolean: Boolean = make<Boolean>(AST.booleanKeyword)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Symbol
  extends Bottom<symbol, symbol, never, never, AST.SymbolKeyword, Symbol, Annotations.Bottom<symbol>>
{}

/**
 * A schema for the `symbol` primitive type.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Basic usage
 * const schema = Schema.Symbol
 *
 * // Valid symbol values
 * Schema.decodeUnknownSync(schema)(Symbol("test"))         // Symbol(test)
 * Schema.decodeUnknownSync(schema)(Symbol.for("global"))   // Symbol.for(global)
 * Schema.decodeUnknownSync(schema)(Symbol.iterator)        // Symbol(Symbol.iterator)
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Usage in structures
 * const ConfigSchema = Schema.Struct({
 *   name: Schema.String,
 *   key: Schema.Symbol,
 *   version: Schema.Number
 * })
 *
 * const config = Schema.decodeUnknownSync(ConfigSchema)({
 *   name: "myConfig",
 *   key: Symbol("configKey"),
 *   version: 1
 * })
 * // { name: "myConfig", key: Symbol(configKey), version: 1 }
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Usage with Records (symbol keys)
 * const SymbolRecord = Schema.Record(Schema.Symbol, Schema.Number)
 *
 * const symbolKey1 = Symbol("key1")
 * const symbolKey2 = Symbol("key2")
 *
 * const record = Schema.decodeUnknownSync(SymbolRecord)({
 *   [symbolKey1]: 100,
 *   [symbolKey2]: 200
 * })
 * // { [Symbol(key1)]: 100, [Symbol(key2)]: 200 }
 * ```
 *
 * @category primitives
 * @since 4.0.0
 */
export const Symbol: Symbol = make<Symbol>(AST.symbolKeyword)

/**
 * @since 4.0.0
 */
export interface BigInt
  extends Bottom<bigint, bigint, never, never, AST.BigIntKeyword, BigInt, Annotations.Bottom<bigint>>
{}

/**
 * A schema for the `bigint` primitive type.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Basic usage
 * const schema = Schema.BigInt
 *
 * // Valid bigint values
 * Schema.decodeUnknownSync(schema)(42n)        // 42n
 * Schema.decodeUnknownSync(schema)(0n)         // 0n
 * Schema.decodeUnknownSync(schema)(-123n)      // -123n
 * Schema.decodeUnknownSync(schema)(9007199254740991n) // 9007199254740991n
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Usage in structures
 * const CounterSchema = Schema.Struct({
 *   id: Schema.BigInt,
 *   count: Schema.BigInt,
 *   timestamp: Schema.BigInt
 * })
 *
 * const counter = Schema.decodeUnknownSync(CounterSchema)({
 *   id: 1n,
 *   count: 100n,
 *   timestamp: 1672531200000n
 * })
 * // { id: 1n, count: 100n, timestamp: 1672531200000n }
 * ```
 *
 * @example
 * ```ts
 * import { Schema, Check } from "effect/schema"
 * import { Order } from "effect"
 *
 * // Usage with validation checks
 * const options = { order: Order.bigint }
 * const greaterThan = Check.deriveGreaterThan(options)
 * const between = Check.deriveBetween(options)
 *
 * const PositiveBigInt = Schema.BigInt.check(greaterThan(0n))
 * const RangeBigInt = Schema.BigInt.check(between(10n, 100n))
 *
 * Schema.decodeUnknownSync(PositiveBigInt)(5n)   // 5n
 * Schema.decodeUnknownSync(RangeBigInt)(50n)     // 50n
 * ```
 *
 * @category primitives
 * @since 4.0.0
 */
export const BigInt: BigInt = make<BigInt>(AST.bigIntKeyword)

/**
 * @since 4.0.0
 */
export interface Void extends Bottom<void, void, never, never, AST.VoidKeyword, Void, Annotations.Bottom<void>> {}

/**
 * A schema for the `void` primitive type.
 *
 * The `void` type represents the absence of a value. In JavaScript/TypeScript,
 * `void` is typically used for functions that don't return a value, but in
 * schema validation, it specifically validates that a value is `undefined`.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Basic usage
 * const schema = Schema.Void
 *
 * // Valid void values
 * Schema.decodeUnknownSync(schema)(undefined)  // undefined
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Usage in structures
 * const APIResponseSchema = Schema.Struct({
 *   status: Schema.String,
 *   data: Schema.Void  // API returns no data
 * })
 *
 * const response = Schema.decodeUnknownSync(APIResponseSchema)({
 *   status: "success",
 *   data: undefined
 * })
 * // { status: "success", data: undefined }
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Type guards and validation
 * const isVoid = Schema.is(Schema.Void)
 *
 * console.log(isVoid(undefined))  // true
 * console.log(isVoid(null))       // false
 * console.log(isVoid(""))         // false
 * console.log(isVoid(0))          // false
 * ```
 *
 * @category primitives
 * @since 4.0.0
 */
export const Void: Void = make<Void>(AST.voidKeyword)

/**
 * @since 4.0.0
 */
export interface Object$
  extends Bottom<object, object, never, never, AST.ObjectKeyword, Object$, Annotations.Bottom<object>>
{}

const Object_: Object$ = make<Object$>(AST.objectKeyword)

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
  extends Bottom<sym, sym, never, never, AST.UniqueSymbol, UniqueSymbol<sym>, Annotations.Bottom<sym>>
{}

/**
 * @since 4.0.0
 */
export function UniqueSymbol<const sym extends symbol>(symbol: sym): UniqueSymbol<sym> {
  return make<UniqueSymbol<sym>>(new AST.UniqueSymbol(symbol))
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
    [K in keyof Fields]: Fields[K] extends { readonly "~type.optionality": "optional" } ? K
      : never
  }[keyof Fields]

  type TypeMutableKeys<Fields extends Struct.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~type.mutability": "mutable" } ? K
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
    [K in keyof Fields]: Fields[K] extends { readonly "~encoded.optionality": "optional" } ? K
      : never
  }[keyof Fields]

  type EncodedMutableKeys<Fields extends Struct.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~encoded.mutability": "mutable" } ? K
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
  export type DecodingServices<F extends Fields> = { readonly [K in keyof F]: F[K]["DecodingServices"] }[keyof F]

  /**
   * @since 4.0.0
   */
  export type EncodingServices<F extends Fields> = { readonly [K in keyof F]: F[K]["EncodingServices"] }[keyof F]

  type TypeConstructorDefaultedKeys<Fields extends Struct.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~type.constructor.default": "with-default" } ? K
      : never
  }[keyof Fields]

  type MakeIn_<
    F extends Fields,
    O = TypeOptionalKeys<F> | TypeConstructorDefaultedKeys<F>
  > =
    & { readonly [K in keyof F as K extends O ? never : K]: F[K]["~type.make"] }
    & { readonly [K in keyof F as K extends O ? K : never]?: F[K]["~type.make"] }

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
    Struct.DecodingServices<Fields>,
    Struct.EncodingServices<Fields>,
    AST.TypeLiteral,
    Struct<Fields>,
    Annotations.Struct<Simplify<Struct.Type<Fields>>>,
    Simplify<Struct.MakeIn<Fields>>
  >
{
  readonly fields: Fields
  /**
   * Returns a new struct with the fields modified by the provided function.
   *
   * **Options**
   *
   * - `preserveChecks` - if `true`, keep any `.check(...)` constraints that
   *   were attached to the original struct. Defaults to `false`.
   */
  mapFields<To extends Struct.Fields>(
    f: (fields: Fields) => To,
    options?: {
      readonly preserveChecks?: boolean | undefined
    } | undefined
  ): Struct<Simplify<Readonly<To>>>
}

class Struct$<Fields extends Struct.Fields> extends make$<Struct<Fields>> implements Struct<Fields> {
  readonly fields: Fields
  constructor(ast: AST.TypeLiteral, fields: Fields) {
    super(ast, (ast) => new Struct$(ast, fields))
    // clone to avoid accidental external mutation
    this.fields = { ...fields }
  }
  mapFields<To extends Struct.Fields>(
    f: (fields: Fields) => To,
    options?: {
      readonly preserveChecks?: boolean | undefined
    } | undefined
  ): Struct<To> {
    const fields = f(this.fields)
    return new Struct$(AST.struct(fields, options?.preserveChecks ? this.ast.checks : undefined), fields)
  }
}

/**
 * Create a schema for a structured object with specified fields. This is the primary
 * constructor for creating schemas that represent objects with known property names
 * and types.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Basic struct schema
 * const UserSchema = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String,
 *   email: Schema.String
 * })
 *
 * // The inferred type is:
 * // {
 * //   readonly id: number;
 * //   readonly name: string;
 * //   readonly email: string;
 * // }
 * type User = Schema.Schema.Type<typeof UserSchema>
 *
 * // Parsing/validation
 * const parseUser = Schema.decodeSync(UserSchema)
 *
 * const validUser = parseUser({
 *   id: 1,
 *   name: "John Doe",
 *   email: "john@example.com"
 * })
 * // Result: { id: 1, name: "John Doe", email: "john@example.com" }
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Nested struct with optional fields
 * const ProfileSchema = Schema.Struct({
 *   user: Schema.Struct({
 *     id: Schema.Number,
 *     name: Schema.String
 *   }),
 *   settings: Schema.Struct({
 *     theme: Schema.Union([Schema.Literal("light"), Schema.Literal("dark")]),
 *     notifications: Schema.optional(Schema.Boolean)
 *   })
 * })
 *
 * const parseProfile = Schema.decodeSync(ProfileSchema)
 *
 * const profile = parseProfile({
 *   user: { id: 1, name: "Alice" },
 *   settings: { theme: "dark" }
 * })
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export function Struct<const Fields extends Struct.Fields>(fields: Fields): Struct<Fields> {
  return new Struct$(AST.struct(fields, undefined), fields)
}

/**
 * @category Struct transformations
 * @since 4.0.0
 * @experimental
 */
export function encodeKeys<
  S extends Struct<Struct.Fields>,
  const M extends { readonly [K in keyof S["fields"]]?: PropertyKey }
>(mapping: M) {
  return function(
    self: S
  ): decodeTo<
    S,
    Struct<
      {
        [
          K in keyof S["fields"] as K extends keyof M ? M[K] extends PropertyKey ? M[K] : K : K
        ]: encodedCodec<S["fields"][K]>
      }
    >,
    never,
    never
  > {
    const fields: any = {}
    const reverseMapping: any = {}
    for (const k in self.fields) {
      if (Object.hasOwn(mapping, k)) {
        fields[mapping[k]!] = encodedCodec(self.fields[k])
        reverseMapping[mapping[k]!] = k
      } else {
        fields[k] = self.fields[k]
      }
    }
    return Struct(fields).pipe(decodeTo(
      self,
      Transformation.transform<any, any>({
        decode: renameKeys(reverseMapping),
        encode: renameKeys(mapping)
      })
    ))
  }
}

/**
 * Adds new derived fields to an existing struct schema.
 *
 * The new fields are computed from the original input value.
 *
 * @category Struct transformations
 * @since 4.0.0
 * @experimental
 */
export function extendTo<S extends Struct<Struct.Fields>, const Fields extends Struct.Fields>(
  /** The new fields to add */
  fields: Fields,
  /** A function per field to derive its value from the original input */
  derive: { readonly [K in keyof Fields]: (s: S["Type"]) => O.Option<Fields[K]["Type"]> }
) {
  return (
    self: S
  ): decodeTo<Struct<Simplify<{ [K in keyof S["fields"]]: typeCodec<S["fields"][K]> } & Fields>>, S, never, never> => {
    const f = R.map(self.fields, typeCodec)
    const to = Struct({ ...f, ...fields })
    return self.pipe(decodeTo(
      to,
      Transformation.transform({
        decode: (input) => {
          const out: any = { ...input }
          for (const k in fields) {
            const f = derive[k]
            const o = f(input)
            if (O.isSome(o)) {
              out[k] = o.value
            }
          }
          return out
        },
        encode: (input) => {
          const out = { ...input }
          for (const k in fields) {
            delete out[k]
          }
          return out
        }
      })
    )) as any
  }
}

/**
 * @since 4.0.0
 */
export declare namespace Record {
  /**
   * @since 4.0.0
   */
  export interface Key extends Codec<PropertyKey, PropertyKey, unknown, unknown> {
    readonly "~type.make": PropertyKey
  }

  /**
   * @since 4.0.0
   */
  export type Record = Record$<Record.Key, Top>

  type MergeTuple<T extends ReadonlyArray<unknown>> = T extends readonly [infer Head, ...infer Tail] ?
    Head & MergeTuple<Tail>
    : {}

  /**
   * @since 4.0.0
   */
  export type Type<Key extends Record.Key, Value extends Top> = Value extends
    { readonly "~type.optionality": "optional" } ?
    Value extends { readonly "~type.mutability": "mutable" } ? { [P in Key["Type"]]?: Value["Type"] }
    : { readonly [P in Key["Type"]]?: Value["Type"] }
    : Value extends { readonly "~type.mutability": "mutable" } ? { [P in Key["Type"]]: Value["Type"] }
    : { readonly [P in Key["Type"]]: Value["Type"] }

  /**
   * @since 4.0.0
   */
  export type Encoded<Key extends Record.Key, Value extends Top> = Value extends
    { readonly "~encoded.optionality": "optional" } ?
    Value extends { readonly "~encoded.mutability": "mutable" } ? { [P in Key["Encoded"]]?: Value["Encoded"] }
    : { readonly [P in Key["Encoded"]]?: Value["Encoded"] }
    : Value extends { readonly "~encoded.mutability": "mutable" } ? { [P in Key["Encoded"]]: Value["Encoded"] }
    : { readonly [P in Key["Encoded"]]: Value["Encoded"] }

  /**
   * @since 4.0.0
   */
  export type DecodingServices<Key extends Record.Key, Value extends Top> =
    | Key["DecodingServices"]
    | Value["DecodingServices"]

  /**
   * @since 4.0.0
   */
  export type EncodingServices<Key extends Record.Key, Value extends Top> =
    | Key["EncodingServices"]
    | Value["EncodingServices"]

  /**
   * @since 4.0.0
   */
  export type MakeIn<Key extends Record.Key, Value extends Top> = Value extends
    { readonly "~encoded.optionality": "optional" } ?
    Value extends { readonly "~encoded.mutability": "mutable" } ? { [P in Key["~type.make"]]?: Value["~type.make"] }
    : { readonly [P in Key["~type.make"]]?: Value["~type.make"] }
    : Value extends { readonly "~encoded.mutability": "mutable" } ? { [P in Key["~type.make"]]: Value["~type.make"] }
    : { readonly [P in Key["~type.make"]]: Value["~type.make"] }
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Record$<Key extends Record.Key, Value extends Top> extends
  Bottom<
    Record.Type<Key, Value>,
    Record.Encoded<Key, Value>,
    Record.DecodingServices<Key, Value>,
    Record.EncodingServices<Key, Value>,
    AST.TypeLiteral,
    Record$<Key, Value>,
    Annotations.Bottom<Record.Type<Key, Value>>,
    Simplify<Record.MakeIn<Key, Value>>
  >
{
  readonly key: Key
  readonly value: Value
}

class Record$$<Key extends Record.Key, Value extends Top> extends make$<Record$<Key, Value>>
  implements Record$<Key, Value>
{
  constructor(ast: AST.TypeLiteral, readonly key: Key, readonly value: Value) {
    super(ast, (ast) => new Record$$(ast, key, value))
  }
}

/**
 * Creates a record schema with dynamic keys and values.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Basic record with string keys and number values
 * const BasicRecord = Schema.Record(Schema.String, Schema.Number)
 *
 * // type Type = { readonly [x: string]: number }
 * // type Encoded = { readonly [x: string]: number }
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Record with symbol keys
 * const SymbolRecord = Schema.Record(Schema.Symbol, Schema.String)
 *
 * // type Type = { readonly [x: symbol]: string }
 * // type Encoded = { readonly [x: symbol]: string }
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Record with literal keys creates a struct-like schema
 * const LiteralRecord = Schema.Record(Schema.Literals(["a", "b"]), Schema.Number)
 *
 * // type Type = { readonly "a": number; readonly "b": number }
 * // type Encoded = { readonly "a": number; readonly "b": number }
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Record with optional values
 * const OptionalRecord = Schema.Record(Schema.String, Schema.optional(Schema.Number))
 *
 * // type Type = { readonly [x: string]: number | undefined }
 * // type Encoded = { readonly [x: string]: number | undefined }
 * ```
 *
 * @example
 * ```ts
 * import { Schema, Transformation } from "effect/schema"
 *
 * // Record with key transformation (snake_case to camelCase)
 * const SnakeToCamel = Schema.String.pipe(
 *   Schema.decode(Transformation.snakeToCamel())
 * )
 *
 * const TransformRecord = Schema.Record(SnakeToCamel, Schema.Number)
 *
 * // Decoding transforms keys: { "user_name": 42 } -> { "userName": 42 }
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export function Record<Key extends Record.Key, Value extends Top>(
  key: Key,
  value: Value,
  options?: {
    readonly key: {
      readonly decode?: {
        readonly combine?: AST.Combine<Key["Type"], Value["Type"]> | undefined
      }
      readonly encode?: {
        readonly combine?: AST.Combine<Key["Encoded"], Value["Encoded"]> | undefined
      }
    }
  }
): Record$<Key, Value> {
  const merge = options?.key?.decode?.combine || options?.key?.encode?.combine
    ? new AST.Merge(
      options.key.decode?.combine,
      options.key.encode?.combine
    )
    : undefined
  return new Record$$(AST.record(key.ast, value.ast, merge), key, value)
}

/**
 * @since 4.0.0
 */
export declare namespace StructWithRest {
  /**
   * @since 4.0.0
   */
  export type TypeLiteral = Top & { readonly ast: AST.TypeLiteral }

  /**
   * @since 4.0.0
   */
  export type Records = ReadonlyArray<Record.Record | mutable<Record.Record>>

  type MergeTuple<T extends ReadonlyArray<unknown>> = T extends readonly [infer Head, ...infer Tail] ?
    Head & MergeTuple<Tail>
    : {}

  /**
   * @since 4.0.0
   */
  export type Type<S extends TypeLiteral, Records extends StructWithRest.Records> =
    & S["Type"]
    & MergeTuple<{ readonly [K in keyof Records]: Records[K]["Type"] }>
  /**
   * @since 4.0.0
   */
  export type Encoded<S extends TypeLiteral, Records extends StructWithRest.Records> =
    & S["Encoded"]
    & MergeTuple<{ readonly [K in keyof Records]: Records[K]["Encoded"] }>

  /**
   * @since 4.0.0
   */
  export type DecodingServices<S extends TypeLiteral, Records extends StructWithRest.Records> =
    | S["DecodingServices"]
    | { [K in keyof Records]: Records[K]["DecodingServices"] }[number]

  /**
   * @since 4.0.0
   */
  export type EncodingServices<S extends TypeLiteral, Records extends StructWithRest.Records> =
    | S["EncodingServices"]
    | { [K in keyof Records]: Records[K]["EncodingServices"] }[number]

  /**
   * @since 4.0.0
   */
  export type MakeIn<S extends TypeLiteral, Records extends StructWithRest.Records> =
    & S["~type.make"]
    & MergeTuple<{ readonly [K in keyof Records]: Records[K]["~type.make"] }>
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface StructWithRest<
  S extends StructWithRest.TypeLiteral,
  Records extends StructWithRest.Records
> extends
  Bottom<
    Simplify<StructWithRest.Type<S, Records>>,
    Simplify<StructWithRest.Encoded<S, Records>>,
    StructWithRest.DecodingServices<S, Records>,
    StructWithRest.EncodingServices<S, Records>,
    AST.TypeLiteral,
    StructWithRest<S, Records>,
    Annotations.Bottom<Simplify<StructWithRest.Type<S, Records>>>,
    Simplify<StructWithRest.MakeIn<S, Records>>
  >
{
  readonly schema: S
  readonly records: Records
}

class StructWithRest$$<S extends StructWithRest.TypeLiteral, Records extends StructWithRest.Records>
  extends make$<StructWithRest<S, Records>>
  implements StructWithRest<S, Records>
{
  readonly records: Records
  constructor(ast: AST.TypeLiteral, readonly schema: S, records: Records) {
    super(ast, (ast) => new StructWithRest$$(ast, this.schema, this.records))
    // clone to avoid accidental external mutation
    this.records = [...records] as any
  }
}

/**
 * @since 4.0.0
 */
export function StructWithRest<
  const S extends StructWithRest.TypeLiteral,
  const Records extends StructWithRest.Records
>(
  schema: S,
  rest: Records
): StructWithRest<S, Records> {
  return new StructWithRest$$(AST.structWithRest(schema.ast, rest.map(AST.getAST)), schema, rest)
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
    Elements,
    Out extends ReadonlyArray<any> = readonly []
  > = Elements extends readonly [infer Head, ...infer Tail] ?
    Head extends { readonly "Type": infer T } ?
      Head extends { readonly "~type.optionality": "optional" } ? Type_<Tail, readonly [...Out, T?]>
      : Type_<Tail, readonly [...Out, T]>
    : Out
    : Out

  /**
   * @since 4.0.0
   */
  export type Type<E extends Elements> = Type_<E>

  type Encoded_<
    Elements,
    Out extends ReadonlyArray<any> = readonly []
  > = Elements extends readonly [infer Head, ...infer Tail] ?
    Head extends { readonly "Encoded": infer T } ?
      Head extends { readonly "~encoded.optionality": "optional" } ? Encoded_<Tail, readonly [...Out, T?]>
      : Encoded_<Tail, readonly [...Out, T]>
    : Out
    : Out

  /**
   * @since 4.0.0
   */
  export type Encoded<E extends Elements> = Encoded_<E>

  /**
   * @since 4.0.0
   */
  export type DecodingServices<E extends Elements> = E[number]["DecodingServices"]

  /**
   * @since 4.0.0
   */
  export type EncodingServices<E extends Elements> = E[number]["EncodingServices"]

  type MakeIn_<
    E,
    Out extends ReadonlyArray<any> = readonly []
  > = E extends readonly [infer Head, ...infer Tail] ?
    Head extends { "~type.make": infer T } ?
      Head extends
        { readonly "~type.optionality": "optional" } | { readonly "~type.constructor.default": "with-default" } ?
        MakeIn_<Tail, readonly [...Out, T?]> :
      MakeIn_<Tail, readonly [...Out, T]>
    : Out :
    Out

  /**
   * @since 4.0.0
   */
  export type MakeIn<E extends Elements> = MakeIn_<E>
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Tuple<Elements extends Tuple.Elements> extends
  Bottom<
    Tuple.Type<Elements>,
    Tuple.Encoded<Elements>,
    Tuple.DecodingServices<Elements>,
    Tuple.EncodingServices<Elements>,
    AST.TupleType,
    Tuple<Elements>,
    Annotations.Bottom<Tuple.Type<Elements>>,
    Tuple.MakeIn<Elements>
  >
{
  readonly elements: Elements
  /**
   * Returns a new tuple with the elements modified by the provided function.
   *
   * **Options**
   *
   * - `preserveChecks` - if `true`, keep any `.check(...)` constraints that
   *   were attached to the original tuple. Defaults to `false`.
   */
  mapElements<To extends Tuple.Elements>(
    f: (elements: Elements) => To,
    options?: {
      readonly preserveChecks?: boolean | undefined
    } | undefined
  ): Tuple<Simplify<Readonly<To>>>
}

class Tuple$<Elements extends Tuple.Elements> extends make$<Tuple<Elements>> implements Tuple<Elements> {
  readonly elements: Elements
  constructor(ast: AST.TupleType, elements: Elements) {
    super(ast, (ast) => new Tuple$(ast, elements))
    // clone to avoid accidental external mutation
    this.elements = [...elements] as any
  }

  mapElements<To extends Tuple.Elements>(
    f: (elements: Elements) => To,
    options?: {
      readonly preserveChecks?: boolean | undefined
    } | undefined
  ): Tuple<Simplify<Readonly<To>>> {
    const elements = f(this.elements)
    return new Tuple$(AST.tuple(elements, options?.preserveChecks ? this.ast.checks : undefined), elements)
  }
}

/**
 * Create a schema for a tuple with a fixed number of elements at specified positions.
 * Each element can have a different type and all elements are required unless explicitly
 * marked as optional.
 *
 * @example Basic Usage
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Simple tuple with string and number
 * const CoordinateSchema = Schema.Tuple([Schema.String, Schema.Number])
 *
 * // The inferred type is:
 * // readonly [string, number]
 * type Coordinate = Schema.Schema.Type<typeof CoordinateSchema>
 *
 * // Parsing/validation
 * const parseCoordinate = Schema.decodeSync(CoordinateSchema)
 *
 * const validCoordinate = parseCoordinate(["x", 10])
 * // Result: ["x", 10]
 * ```
 *
 * @example Mixed Types
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Tuple with different types
 * const PersonTuple = Schema.Tuple([
 *   Schema.String,  // name
 *   Schema.Number,  // age
 *   Schema.Boolean  // isActive
 * ])
 *
 * type Person = Schema.Schema.Type<typeof PersonTuple>
 * // readonly [string, number, boolean]
 *
 * const parsePerson = Schema.decodeSync(PersonTuple)
 *
 * const person = parsePerson(["Alice", 30, true])
 * // Result: ["Alice", 30, true]
 * ```
 *
 * @example Optional Elements
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Tuple with optional elements
 * const OptionalTuple = Schema.Tuple([
 *   Schema.String,
 *   Schema.optional(Schema.Number),
 *   Schema.optional(Schema.Boolean)
 * ])
 *
 * type Optional = Schema.Schema.Type<typeof OptionalTuple>
 * // readonly [string, number?, boolean?]
 *
 * const parseOptional = Schema.decodeSync(OptionalTuple)
 *
 * const result1 = parseOptional(["hello"])
 * // Result: ["hello"]
 *
 * const result2 = parseOptional(["hello", 42])
 * // Result: ["hello", 42]
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export function Tuple<const Elements extends ReadonlyArray<Top>>(elements: Elements): Tuple<Elements> {
  return new Tuple$(AST.tuple(elements), elements)
}

/**
 * @since 4.0.0
 */
export declare namespace TupleWithRest {
  /**
   * @since 4.0.0
   */
  export type TupleType = Top & {
    readonly Type: ReadonlyArray<unknown>
    readonly Encoded: ReadonlyArray<unknown>
    readonly ast: AST.TupleType
    readonly "~type.make": ReadonlyArray<unknown>
  }

  /**
   * @since 4.0.0
   */
  export type Rest = readonly [Top, ...ReadonlyArray<Top>]

  /**
   * @since 4.0.0
   */
  export type Type<T extends ReadonlyArray<unknown>, Rest extends TupleWithRest.Rest> = Rest extends
    readonly [infer Head extends Top, ...infer Tail extends ReadonlyArray<Top>] ? Readonly<[
      ...T,
      ...ReadonlyArray<Head["Type"]>,
      ...{ readonly [K in keyof Tail]: Tail[K]["Type"] }
    ]> :
    T

  /**
   * @since 4.0.0
   */
  export type Encoded<E extends ReadonlyArray<unknown>, Rest extends TupleWithRest.Rest> = Rest extends
    readonly [infer Head extends Top, ...infer Tail extends ReadonlyArray<Top>] ? readonly [
      ...E,
      ...Array<Head["Encoded"]>,
      ...{ readonly [K in keyof Tail]: Tail[K]["Encoded"] }
    ] :
    E

  /**
   * @since 4.0.0
   */
  export type MakeIn<M extends ReadonlyArray<unknown>, Rest extends TupleWithRest.Rest> = Rest extends
    readonly [infer Head extends Top, ...infer Tail extends ReadonlyArray<Top>] ? readonly [
      ...M,
      ...Array<Head["~type.make"]>,
      ...{ readonly [K in keyof Tail]: Tail[K]["~type.make"] }
    ] :
    M
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface TupleWithRest<
  S extends TupleWithRest.TupleType,
  Rest extends TupleWithRest.Rest
> extends
  Bottom<
    TupleWithRest.Type<S["Type"], Rest>,
    TupleWithRest.Encoded<S["Encoded"], Rest>,
    S["DecodingServices"] | Rest[number]["DecodingServices"],
    S["EncodingServices"] | Rest[number]["EncodingServices"],
    AST.TupleType,
    TupleWithRest<S, Rest>,
    Annotations.Bottom<TupleWithRest.Type<S["Type"], Rest>>,
    TupleWithRest.MakeIn<S["~type.make"], Rest>
  >
{
  readonly schema: S
  readonly rest: Rest
}

class TupleWithRest$<S extends Tuple<Tuple.Elements> | mutable<Tuple<Tuple.Elements>>, Rest extends TupleWithRest.Rest>
  extends make$<TupleWithRest<S, Rest>>
{
  readonly rest: Rest
  constructor(ast: AST.TupleType, readonly schema: S, rest: Rest) {
    super(ast, (ast) => new TupleWithRest$(ast, this.schema, this.rest))
    // clone to avoid accidental external mutation
    this.rest = [...rest]
  }
}

/**
 * @since 4.0.0
 */
export function TupleWithRest<
  S extends Tuple<Tuple.Elements> | mutable<Tuple<Tuple.Elements>>,
  const Rest extends TupleWithRest.Rest
>(
  schema: S,
  rest: Rest
): TupleWithRest<S, Rest> {
  return new TupleWithRest$(AST.tupleWithRest(schema.ast, rest.map(AST.getAST)), schema, rest)
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Array$<S extends Top> extends
  Bottom<
    ReadonlyArray<S["Type"]>,
    ReadonlyArray<S["Encoded"]>,
    S["DecodingServices"],
    S["EncodingServices"],
    AST.TupleType,
    Array$<S>,
    Annotations.Bottom<ReadonlyArray<S["Type"]>>,
    ReadonlyArray<S["~type.make"]>
  >
{
  readonly schema: S
}

interface ArrayLambda extends Lambda {
  <S extends Top>(self: S): Array$<S>
  readonly "~lambda.out": this["~lambda.in"] extends Top ? Array$<this["~lambda.in"]> : never
}

/**
 * Creates a schema that validates an array of elements where each element must conform to the provided schema.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a schema for an array of strings
 * const stringArraySchema = Schema.Array(Schema.String)
 *
 * // This will succeed
 * const result1 = Schema.decodeUnknownSync(stringArraySchema)(["hello", "world"])
 * console.log(result1) // ["hello", "world"]
 *
 * // This will fail because one element is not a string
 * try {
 *   Schema.decodeUnknownSync(stringArraySchema)(["hello", 123])
 * } catch (error) {
 *   console.log("Validation failed:", error)
 * }
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a schema for an array of numbers
 * const numberArraySchema = Schema.Array(Schema.Number)
 *
 * // Access the item schema
 * console.log(numberArraySchema.schema === Schema.Number) // true
 *
 * // Works with complex schemas
 * const personSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const peopleArraySchema = Schema.Array(personSchema)
 *
 * const people = [
 *   { name: "Alice", age: 25 },
 *   { name: "Bob", age: 30 }
 * ]
 *
 * const result = Schema.decodeUnknownSync(peopleArraySchema)(people)
 * console.log(result) // [{ name: "Alice", age: 25 }, { name: "Bob", age: 30 }]
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const Array = lambda<ArrayLambda>(function Array<S extends Top>(item: S): Array$<S> {
  return new makeWithSchema$<S, Array$<S>>(
    new AST.TupleType(false, [], [item.ast]),
    item
  )
})

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface NonEmptyArray<S extends Top> extends
  Bottom<
    readonly [S["Type"], ...Array<S["Type"]>],
    readonly [S["Type"], ...Array<S["Encoded"]>],
    S["DecodingServices"],
    S["EncodingServices"],
    AST.TupleType,
    NonEmptyArray<S>,
    Annotations.Bottom<readonly [S["Type"], ...Array<S["Type"]>]>,
    readonly [S["~type.make"], ...Array<S["~type.make"]>]
  >
{
  readonly schema: S
}

interface NonEmptyArrayLambda extends Lambda {
  <S extends Top>(self: S): NonEmptyArray<S>
  readonly "~lambda.out": this["~lambda.in"] extends Top ? NonEmptyArray<this["~lambda.in"]> : never
}

/**
 * A schema for non-empty arrays, representing arrays with at least one element.
 *
 * This schema validates that an array contains at least one element of the specified type.
 * It exposes the inner schema through the `schema` property for accessing the item type.
 *
 * @example Basic Usage
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a schema for a non-empty array of strings
 * const stringNonEmptyArraySchema = Schema.NonEmptyArray(Schema.String)
 *
 * // Access the item schema
 * console.log(stringNonEmptyArraySchema.schema === Schema.String) // true
 *
 * // Successful validation
 * const result1 = Schema.decodeUnknownSync(stringNonEmptyArraySchema)(["hello"])
 * console.log(result1) // ["hello"]
 *
 * const result2 = Schema.decodeUnknownSync(stringNonEmptyArraySchema)(["a", "b", "c"])
 * console.log(result2) // ["a", "b", "c"]
 * ```
 *
 * @example With Complex Types
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a schema for non-empty array of structured objects
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const peopleNonEmptyArraySchema = Schema.NonEmptyArray(PersonSchema)
 *
 * const people = [
 *   { name: "Alice", age: 25 },
 *   { name: "Bob", age: 30 }
 * ]
 *
 * const result = Schema.decodeUnknownSync(peopleNonEmptyArraySchema)(people)
 * console.log(result) // [{ name: "Alice", age: 25 }, { name: "Bob", age: 30 }]
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const NonEmptyArray = lambda<NonEmptyArrayLambda>(
  function NonEmptyArray<S extends Top>(item: S): NonEmptyArray<S> {
    return new makeWithSchema$<S, NonEmptyArray<S>>(
      new AST.TupleType(false, [item.ast], [item.ast]),
      item
    )
  }
)

/**
 * @since 4.0.0
 */
export interface mutable<S extends Top> extends
  Bottom<
    Mutable<S["Type"]>,
    Mutable<S["Encoded"]>,
    S["DecodingServices"],
    S["EncodingServices"],
    S["ast"],
    mutable<S>,
    // we keep "~annotate.in", "~type.make" and "~type.make.in" as they are because they are contravariant
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  readonly schema: S
}

interface mutableLambda extends Lambda {
  <S extends Top>(self: S): mutable<S>
  readonly "~lambda.out": this["~lambda.in"] extends Top ? mutable<this["~lambda.in"]> : never
}

/**
 * Creates a schema modifier that makes array and tuple types mutable instead of readonly.
 * This is useful when you need to modify the arrays or tuples after creation.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a schema for a mutable array of strings
 * const mutableArraySchema = Schema.mutable(Schema.Array(Schema.String))
 * const result = Schema.decodeUnknownSync(mutableArraySchema)(["hello", "world"])
 * result.push("!") // This works because the array is mutable
 * console.log(result) // ["hello", "world", "!"]
 *
 * // Create a schema for a mutable tuple
 * const mutableTupleSchema = Schema.mutable(Schema.Tuple([Schema.String, Schema.Number]))
 * const tupleResult = Schema.decodeUnknownSync(mutableTupleSchema)(["hello", 42])
 * tupleResult[0] = "goodbye" // This works because the tuple is mutable
 * console.log(tupleResult) // ["goodbye", 42]
 *
 * // Create a schema for a mutable record
 * const mutableRecordSchema = Schema.mutable(Schema.Record(Schema.String, Schema.Number))
 * const recordResult = Schema.decodeUnknownSync(mutableRecordSchema)({ a: 1, b: 2 })
 * recordResult.c = 3 // This works because the record is mutable
 * console.log(recordResult) // { a: 1, b: 2, c: 3 }
 * ```
 *
 * @category modifiers
 * @since 4.0.0
 */
export const mutable = lambda<mutableLambda>(function mutable<S extends Top>(self: S): mutable<S> {
  return new makeWithSchema$<S, mutable<S>>(AST.mutable(self.ast), self)
})

/**
 * @since 4.0.0
 */
export interface readonly$<S extends Top> extends
  Bottom<
    Readonly<S["Type"]>,
    Readonly<S["Encoded"]>,
    S["DecodingServices"],
    S["EncodingServices"],
    S["ast"],
    readonly$<S>,
    // we keep "~annotate.in", "~type.make" and "~type.make.in" as they are because they are contravariant
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  readonly schema: S
}

interface readonlyLambda extends Lambda {
  <S extends Top>(self: S): readonly$<S>
  readonly "~lambda.out": this["~lambda.in"] extends Top ? readonly$<this["~lambda.in"]> : never
}

/**
 * Creates a schema modifier that makes array, tuple, and record types readonly instead of mutable.
 * This ensures data structures cannot be modified after creation, providing compile-time safety against mutations.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a schema for a readonly array of strings
 * const readonlyArraySchema = Schema.readonly(Schema.Array(Schema.String))
 * const result = Schema.decodeUnknownSync(readonlyArraySchema)(["hello", "world"])
 * // result.push("!") // TypeScript error: Cannot assign to read only property
 * console.log(result) // ["hello", "world"]
 *
 * // Create a schema for a readonly tuple
 * const readonlyTupleSchema = Schema.readonly(Schema.Tuple([Schema.String, Schema.Number]))
 * const tupleResult = Schema.decodeUnknownSync(readonlyTupleSchema)(["hello", 42])
 * // tupleResult[0] = "goodbye" // TypeScript error: Cannot assign to read only property
 * console.log(tupleResult) // ["hello", 42]
 *
 * // Create a schema for a readonly record
 * const readonlyRecordSchema = Schema.readonly(Schema.Record(Schema.String, Schema.Number))
 * const recordResult = Schema.decodeUnknownSync(readonlyRecordSchema)({ a: 1, b: 2 })
 * // recordResult.c = 3 // TypeScript error: Cannot assign to read only property
 * console.log(recordResult) // { a: 1, b: 2 }
 * ```
 *
 * @category modifiers
 * @since 4.0.0
 */
export const readonly = lambda<readonlyLambda>(function readonly<S extends Top>(self: S): readonly$<S> {
  return new makeWithSchema$<S, readonly$<S>>(AST.mutable(self.ast), self)
})

/**
 * @since 4.0.0
 */
export interface Union<Members extends ReadonlyArray<Top>> extends
  Bottom<
    Members[number]["Type"],
    Members[number]["Encoded"],
    Members[number]["DecodingServices"],
    Members[number]["EncodingServices"],
    AST.UnionType<Members[number]["ast"]>,
    Union<Members>,
    Annotations.Bottom<Members[number]["Type"]>,
    Members[number]["~type.make"]
  >
{
  readonly members: Members
  /**
   * Returns a new union with the members modified by the provided function.
   *
   * **Options**
   *
   * - `preserveChecks` - if `true`, keep any `.check(...)` constraints that
   *   were attached to the original union. Defaults to `false`.
   */
  mapMembers<To extends ReadonlyArray<Top>>(
    f: (members: Members) => To,
    options?: {
      readonly preserveChecks?: boolean | undefined
    } | undefined
  ): Union<Simplify<Readonly<To>>>
}

class Union$<Members extends ReadonlyArray<Top>> extends make$<Union<Members>> implements Union<Members> {
  constructor(readonly ast: AST.UnionType<Members[number]["ast"]>, readonly members: Members) {
    super(ast, (ast) => new Union$(ast, members))
  }

  mapMembers<To extends ReadonlyArray<Top>>(
    f: (members: Members) => To,
    options?: {
      readonly preserveChecks?: boolean | undefined
    } | undefined
  ): Union<Simplify<Readonly<To>>> {
    const members = f(this.members)
    return new Union$(
      AST.union(members, this.ast.mode, options?.preserveChecks ? this.ast.checks : undefined),
      members
    )
  }
}

/**
 * Creates a schema that represents a union of multiple schemas. Members are checked in order, and the first match is returned.
 *
 * Optionally, you can specify the `mode` to be `"anyOf"` or `"oneOf"`.
 *
 * - `"anyOf"` - The union matches if any member matches.
 * - `"oneOf"` - The union matches if exactly one member matches.
 *
 * @example Basic union of primitive types
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const StringOrNumber = Schema.Union([Schema.String, Schema.Number])
 *
 * Schema.decodeUnknownSync(StringOrNumber)("hello") // "hello"
 * Schema.decodeUnknownSync(StringOrNumber)(42) // 42
 * ```
 *
 * @example Union with struct types
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const UserOrProduct = Schema.Union([
 *   Schema.Struct({
 *     type: Schema.Literal("user"),
 *     name: Schema.String
 *   }),
 *   Schema.Struct({
 *     type: Schema.Literal("product"),
 *     price: Schema.Number
 *   })
 * ])
 *
 * Schema.decodeUnknownSync(UserOrProduct)({ type: "user", name: "Alice" })
 * // { type: "user", name: "Alice" }
 * ```
 *
 * @example Exclusive union with oneOf mode
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const ExclusiveUnion = Schema.Union([
 *   Schema.Struct({ a: Schema.String }),
 *   Schema.Struct({ b: Schema.Number })
 * ], { mode: "oneOf" })
 *
 * Schema.decodeUnknownSync(ExclusiveUnion)({ a: "hello" }) // { a: "hello" }
 * // Schema.decodeUnknownSync(ExclusiveUnion)({ a: "hello", b: 42 }) // throws - matches both schemas
 * ```
 *
 * @example Union with refined types
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * const PositiveNumberOrNonEmptyString = Schema.Union([
 *   Schema.Number.check(Check.positive()),
 *   Schema.NonEmptyString
 * ])
 *
 * Schema.decodeUnknownSync(PositiveNumberOrNonEmptyString)(5) // 5
 * Schema.decodeUnknownSync(PositiveNumberOrNonEmptyString)("hello") // "hello"
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export function Union<const Members extends ReadonlyArray<Top>>(
  members: Members,
  options?: { mode?: "anyOf" | "oneOf" }
): Union<Members> {
  return new Union$(AST.union(members, options?.mode ?? "anyOf", undefined), members)
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Literals<L extends ReadonlyArray<AST.Literal>> extends
  Bottom<
    L[number],
    L[number],
    never,
    never,
    AST.UnionType<AST.LiteralType>,
    Literals<L>,
    Annotations.Bottom<L[number]>
  >
{
  readonly literals: L
  readonly members: { readonly [K in keyof L]: Literal<L[K]> }
  /**
   * Map over the members of the union.
   */
  mapMembers<To extends ReadonlyArray<Top>>(f: (members: this["members"]) => To): Union<Simplify<Readonly<To>>>
}

class Literals$<L extends ReadonlyArray<AST.Literal>> extends make$<Literals<L>> implements Literals<L> {
  constructor(
    ast: AST.UnionType<AST.LiteralType>,
    readonly literals: L,
    readonly members: { readonly [K in keyof L]: Literal<L[K]> }
  ) {
    super(ast, (ast) => new Literals$(ast, literals, members))
  }

  mapMembers<To extends ReadonlyArray<Top>>(f: (members: this["members"]) => To): Union<Simplify<Readonly<To>>> {
    return Union(f(this.members))
  }
}

/**
 * Creates a schema that accepts any one of the provided literal values.
 *
 * This function is useful for creating schemas that match against specific constant values
 * like string literals, numbers, booleans, or bigints. The resulting schema will only
 * accept values that exactly match one of the literals provided in the array.
 *
 * @example Basic usage with string literals
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const ColorSchema = Schema.Literals(["red", "green", "blue"])
 *
 * Schema.decodeUnknownSync(ColorSchema)("red")    // "red"
 * Schema.decodeUnknownSync(ColorSchema)("green")  // "green"
 * Schema.decodeUnknownSync(ColorSchema)("blue")   // "blue"
 * Schema.decodeUnknownSync(ColorSchema)("yellow") // throws ParseError
 * ```
 *
 * @example Mixed literal types
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const MixedSchema = Schema.Literals(["active", 1, true, 42n])
 *
 * Schema.decodeUnknownSync(MixedSchema)("active") // "active"
 * Schema.decodeUnknownSync(MixedSchema)(1)        // 1
 * Schema.decodeUnknownSync(MixedSchema)(true)     // true
 * Schema.decodeUnknownSync(MixedSchema)(42n)      // 42n
 * Schema.decodeUnknownSync(MixedSchema)(false)    // throws ParseError
 * ```
 *
 * @example Use in Record keys
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const SettingsSchema = Schema.Record(
 *   Schema.Literals(["theme", "language", "timezone"]),
 *   Schema.String
 * )
 *
 * Schema.decodeUnknownSync(SettingsSchema)({
 *   theme: "dark",
 *   language: "en",
 *   timezone: "UTC"
 * })
 * // { theme: "dark", language: "en", timezone: "UTC" }
 * ```
 *
 * @example Use in template literals
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const EmailTypeSchema = Schema.Literals(["welcome_email", "newsletter"])
 * const TemplateSchema = Schema.TemplateLiteral([EmailTypeSchema, "_", Schema.String])
 *
 * Schema.decodeUnknownSync(TemplateSchema)("welcome_email_user123")  // "welcome_email_user123"
 * Schema.decodeUnknownSync(TemplateSchema)("newsletter_monthly")     // "newsletter_monthly"
 * Schema.decodeUnknownSync(TemplateSchema)("invalid_template")       // throws ParseError
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export function Literals<const L extends ReadonlyArray<AST.Literal>>(literals: L): Literals<L> {
  const members = literals.map(Literal) as { readonly [K in keyof L]: Literal<L[K]> }
  return new Literals$(AST.union(members, "anyOf", undefined), [...literals] as L, members)
}

/**
 * A union type schema that represents either the original type S or null.
 *
 * This interface extends Union and is used to create schemas that accept
 * nullable values, commonly used in API designs where fields may be
 * explicitly null rather than undefined.
 *
 * @example Basic Schema Type
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Type inference from NullOr
 * type StringOrNull = Schema.Schema.Type<Schema.NullOr<Schema.String>>
 * // StringOrNull is: string | null
 *
 * // Use in type annotations
 * const schema: Schema.NullOr<Schema.String> = Schema.NullOr(Schema.String)
 * ```
 *
 * @example Using in Schema Composition
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const UserSchema = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.NullOr(Schema.String),
 *   email: Schema.optional(Schema.NullOr(Schema.String))
 * })
 *
 * type User = Schema.Schema.Type<typeof UserSchema>
 * // User = { readonly id: number; readonly name: string | null; readonly email?: string | null }
 * ```
 *
 * @category Api interface
 * @since 4.0.0
 */
export interface NullOr<S extends Top> extends Union<readonly [S, Null]> {
  readonly "~rebuild.out": NullOr<S>
}

interface NullOrLambda extends Lambda {
  <S extends Top>(self: S): NullOr<S>
  readonly "~lambda.out": this["~lambda.in"] extends Top ? NullOr<this["~lambda.in"]> : never
}

/**
 * Creates a schema that accepts either the original type or null values.
 *
 * This is a commonly used utility for creating nullable schemas, which can be
 * particularly useful in API designs where fields may be explicitly null
 * rather than undefined.
 *
 * @example Basic Usage
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.NullOr(Schema.String)
 *
 * // Valid inputs
 * Schema.decodeUnknownSync(schema)("hello")  // "hello"
 * Schema.decodeUnknownSync(schema)(null)     // null
 * ```
 *
 * @example With Complex Schema
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const NullablePersonSchema = Schema.NullOr(PersonSchema)
 *
 * // Valid inputs
 * const validPerson = { name: "John", age: 30 }
 * Schema.decodeUnknownSync(NullablePersonSchema)(validPerson)  // { name: "John", age: 30 }
 * Schema.decodeUnknownSync(NullablePersonSchema)(null)         // null
 * ```
 *
 * @example Optional Properties with Nullability
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const UserSchema = Schema.Struct({
 *   id: Schema.Number,
 *   email: Schema.optionalKey(Schema.NullOr(Schema.String))
 * })
 *
 * // Valid inputs
 * Schema.decodeUnknownSync(UserSchema)({ id: 1 })                    // { id: 1 }
 * Schema.decodeUnknownSync(UserSchema)({ id: 1, email: null })       // { id: 1, email: null }
 * Schema.decodeUnknownSync(UserSchema)({ id: 1, email: "test@example.com" })  // { id: 1, email: "test@example.com" }
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const NullOr = lambda<NullOrLambda>(
  function NullOr<S extends Top>(self: S) {
    return Union([self, Null])
  }
)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface UndefinedOr<S extends Top> extends Union<readonly [S, Undefined]> {
  readonly "~rebuild.out": UndefinedOr<S>
}

interface UndefinedOrLambda extends Lambda {
  <S extends Top>(self: S): UndefinedOr<S>
  readonly "~lambda.out": this["~lambda.in"] extends Top ? UndefinedOr<this["~lambda.in"]> : never
}

/**
 * Creates a schema that represents a union of a schema and `undefined`.
 *
 * This is useful when you want to allow a value to be either of a specific type
 * or `undefined`. It's commonly used in optional fields, APIs that might return
 * undefined values, or when working with partial data structures.
 *
 * @example Basic usage
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const StringOrUndefined = Schema.UndefinedOr(Schema.String)
 *
 * Schema.decodeUnknownSync(StringOrUndefined)("hello") // "hello"
 * Schema.decodeUnknownSync(StringOrUndefined)(undefined) // undefined
 * ```
 *
 * @example Using with struct fields
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const UserProfile = Schema.Struct({
 *   name: Schema.String,
 *   nickname: Schema.UndefinedOr(Schema.String),
 *   age: Schema.UndefinedOr(Schema.Number)
 * })
 *
 * type UserProfile = Schema.Schema.Type<typeof UserProfile>
 * // {
 * //   readonly name: string
 * //   readonly nickname: string | undefined
 * //   readonly age: number | undefined
 * // }
 *
 * Schema.decodeUnknownSync(UserProfile)({
 *   name: "Alice",
 *   nickname: undefined,
 *   age: 25
 * })
 * // { name: "Alice", nickname: undefined, age: 25 }
 * ```
 *
 * @example API response handling
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const ApiResponse = Schema.Struct({
 *   data: Schema.UndefinedOr(Schema.String),
 *   error: Schema.UndefinedOr(Schema.String)
 * })
 *
 * // Success case
 * Schema.decodeUnknownSync(ApiResponse)({
 *   data: "success",
 *   error: undefined
 * })
 * // { data: "success", error: undefined }
 *
 * // Error case
 * Schema.decodeUnknownSync(ApiResponse)({
 *   data: undefined,
 *   error: "Something went wrong"
 * })
 * // { data: undefined, error: "Something went wrong" }
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const UndefinedOr = lambda<UndefinedOrLambda>(
  function UndefinedOr<S extends Top>(self: S) {
    return Union([self, Undefined])
  }
)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface NullishOr<S extends Top> extends Union<readonly [S, Null, Undefined]> {
  readonly "~rebuild.out": NullishOr<S>
}

interface NullishOrLambda extends Lambda {
  <S extends Top>(self: S): NullishOr<S>
  readonly "~lambda.out": this["~lambda.in"] extends Top ? NullishOr<this["~lambda.in"]> : never
}

/**
 * Creates a schema that accepts either the original type, null, or undefined values.
 *
 * This is a commonly used utility for creating nullable and optional schemas,
 * which combines the functionality of both `NullOr` and `UndefinedOr`. It's
 * particularly useful in JavaScript/TypeScript environments where values
 * can be either explicitly null or undefined.
 *
 * @example Basic Usage
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.NullishOr(Schema.String)
 *
 * // Valid inputs
 * Schema.decodeUnknownSync(schema)("hello")     // "hello"
 * Schema.decodeUnknownSync(schema)(null)        // null
 * Schema.decodeUnknownSync(schema)(undefined)   // undefined
 * ```
 *
 * @example With Complex Schema
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const NullishPersonSchema = Schema.NullishOr(PersonSchema)
 *
 * // Valid inputs
 * const validPerson = { name: "John", age: 30 }
 * Schema.decodeUnknownSync(NullishPersonSchema)(validPerson)  // { name: "John", age: 30 }
 * Schema.decodeUnknownSync(NullishPersonSchema)(null)         // null
 * Schema.decodeUnknownSync(NullishPersonSchema)(undefined)    // undefined
 * ```
 *
 * @example API Response Handling
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const ApiResponseSchema = Schema.Struct({
 *   id: Schema.Number,
 *   data: Schema.NullishOr(Schema.String),
 *   metadata: Schema.NullishOr(Schema.Struct({
 *     created: Schema.String,
 *     updated: Schema.String
 *   }))
 * })
 *
 * // Valid API responses
 * Schema.decodeUnknownSync(ApiResponseSchema)({
 *   id: 1,
 *   data: "response data",
 *   metadata: { created: "2023-01-01", updated: "2023-01-02" }
 * })
 *
 * Schema.decodeUnknownSync(ApiResponseSchema)({
 *   id: 2,
 *   data: null,
 *   metadata: undefined
 * })
 * ```
 *
 * @example With Type Extraction
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const UserSchema = Schema.NullishOr(Schema.Struct({
 *   name: Schema.String,
 *   email: Schema.String
 * }))
 *
 * type User = Schema.Schema.Type<typeof UserSchema>
 * // User = { readonly name: string; readonly email: string } | null | undefined
 *
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const NullishOr = lambda<NullishOrLambda>(
  function NullishOr<S extends Top>(self: S) {
    return Union([self, Null, Undefined])
  }
)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface suspend<S extends Top> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingServices"],
    S["EncodingServices"],
    AST.Suspend,
    suspend<S>,
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{}

/**
 * @category constructors
 * @since 4.0.0
 */
export function suspend<S extends Top>(f: () => S): suspend<S> {
  return make<suspend<S>>(new AST.Suspend(() => f().ast))
}

/**
 * @category Filtering
 * @since 4.0.0
 */
export function check<S extends Top>(
  ...checks: readonly [
    Check.Check<S["Type"]>,
    ...ReadonlyArray<Check.Check<S["Type"]>>
  ]
): (self: S) => S["~rebuild.out"] {
  return asCheck(...checks)
}

/**
 * @since 4.0.0
 */
export function asCheck<T>(
  ...checks: readonly [Check.Check<T>, ...ReadonlyArray<Check.Check<T>>]
) {
  return <S extends Schema<T>>(self: S): S["~rebuild.out"] => {
    return self.check(...checks)
  }
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface refine<T extends S["Type"], S extends Top> extends
  Bottom<
    T,
    S["Encoded"],
    S["DecodingServices"],
    S["EncodingServices"],
    S["ast"],
    refine<T, S["~rebuild.out"]>,
    S["~annotate.in"],
    S["~type.make.in"],
    T,
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{}

/**
 * Applies a refinement to a schema, adding additional validation constraints while preserving the original type.
 *
 * The `refine` function allows you to attach custom validation logic to any schema using Check.Refine objects.
 * This is particularly useful for adding type guards, brands, or complex validation rules.
 *
 * @example
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * // Using a branded type refinement for IDs
 * const UserIdBrand = Check.makeBrand("UserId", { title: "UserId" })
 * const UserId = Schema.String.pipe(Schema.refine(UserIdBrand))
 *
 * // Type: Schema<string & Brand<"UserId">, string>
 * console.log(Schema.decodeUnknownSync(UserId)("user-123")) // "user-123" with UserId brand
 * ```
 *
 * @example
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * // Using refinement groups for complex validation
 * const UsernameCheck = Check.makeGroup(
 *   [
 *     Check.minLength(3),
 *     Check.regex(/^[a-zA-Z0-9]+$/, { title: "alphanumeric" }),
 *     Check.trimmed()
 *   ],
 *   { title: "username" }
 * ).pipe(Check.brand("Username"))
 *
 * const Username = Schema.String.pipe(Schema.refine(UsernameCheck))
 *
 * // Type: Schema<string & Brand<"Username">, string>
 * console.log(Schema.decodeUnknownSync(Username)("john123")) // "john123" with Username brand
 * ```
 *
 * @example
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * // Using type guards for array shape validation
 * const NonEmptyGuard = Check.makeGuard(
 *   (arr: readonly string[]): arr is readonly [string, ...string[]] => arr.length > 0,
 *   { title: "non-empty" }
 * )
 *
 * const NonEmptyArray = Schema.Array(Schema.String).pipe(Schema.refine(NonEmptyGuard))
 *
 * // Type: Schema<readonly [string, ...string[]], readonly string[]>
 * console.log(Schema.decodeUnknownSync(NonEmptyArray)(["hello", "world"])) // ["hello", "world"]
 * ```
 *
 * @category Filtering
 * @since 4.0.0
 */
export function refine<T extends E, E>(refine: Check.Refine<T, E>) {
  return <S extends Schema<E>>(self: S): refine<S["Type"] & T, S["~rebuild.out"]> => {
    const ast = AST.appendChecks(self.ast, [refine])
    return self.rebuild(ast) as any
  }
}

/**
 * @category Filtering
 * @since 4.0.0
 */
export function guard<T extends S["Type"], S extends Top>(
  is: (value: S["Type"]) => value is T,
  annotations?: Annotations.Filter
) {
  return (self: S): refine<T, S["~rebuild.out"]> => {
    return self.pipe(refine(Check.makeGuard(is, annotations)))
  }
}

/**
 * Applies a brand to a schema type to create a branded type that is distinct from its base type.
 * A branded type helps prevent accidental misuse of values that should be treated differently
 * despite having the same underlying type.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a branded schema for user IDs
 * const UserIdSchema = Schema.NonEmptyString.pipe(
 *   Schema.brand("UserId")
 * )
 *
 * // Create a branded schema for product IDs
 * const ProductIdSchema = Schema.NonEmptyString.pipe(
 *   Schema.brand("ProductId")
 * )
 *
 * // The branded types are distinct and can't be accidentally mixed
 * const userId = Schema.decodeUnknownSync(UserIdSchema)("user-123")
 * const productId = Schema.decodeUnknownSync(ProductIdSchema)("product-456")
 *
 * // This would be a compile-time error due to brand safety:
 * // const mixedUp: typeof userId = productId // Error!
 * ```
 *
 * @category Filtering
 * @since 4.0.0
 */
export function brand<B extends string | symbol>(brand: B, annotations?: Annotations.Filter) {
  return <S extends Top>(self: S): refine<S["Type"] & Brand<B>, S["~rebuild.out"]> => {
    return self.pipe(refine(Check.makeBrand(brand, annotations)))
  }
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface decodingMiddleware<S extends Top, RD> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    RD,
    S["EncodingServices"],
    S["ast"],
    decodingMiddleware<S, RD>,
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  readonly schema: S
}

/**
 * @since 4.0.0
 */
export function decodingMiddleware<S extends Top, RD>(
  decode: (
    sr: Effect.Effect<O.Option<S["Type"]>, Issue.Issue, S["DecodingServices"]>,
    options: AST.ParseOptions
  ) => Effect.Effect<O.Option<S["Type"]>, Issue.Issue, RD>
) {
  return (self: S): decodingMiddleware<S, RD> => {
    return new makeWithSchema$<S, decodingMiddleware<S, RD>>(
      AST.decodingMiddleware(self.ast, new Transformation.Middleware(decode, identity)),
      self
    )
  }
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface encodingMiddleware<S extends Top, RE> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingServices"],
    RE,
    S["ast"],
    encodingMiddleware<S, RE>,
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  readonly schema: S
}

/**
 * @since 4.0.0
 */
export function encodingMiddleware<S extends Top, RE>(
  encode: (
    sr: Effect.Effect<O.Option<S["Type"]>, Issue.Issue, S["EncodingServices"]>,
    options: AST.ParseOptions
  ) => Effect.Effect<O.Option<S["Type"]>, Issue.Issue, RE>
) {
  return (self: S): encodingMiddleware<S, RE> => {
    return new makeWithSchema$<S, encodingMiddleware<S, RE>>(
      AST.encodingMiddleware(self.ast, new Transformation.Middleware(identity, encode)),
      self
    )
  }
}

/**
 * @category Middlewares
 * @since 4.0.0
 */
export function catchDecoding<S extends Top>(
  f: (issue: Issue.Issue) => Effect.Effect<O.Option<S["Type"]>, Issue.Issue>
): (self: S) => S["~rebuild.out"] {
  return catchDecodingWithContext(f)
}

/**
 * @category Middlewares
 * @since 4.0.0
 */
export function catchDecodingWithContext<S extends Top, R = never>(
  f: (issue: Issue.Issue) => Effect.Effect<O.Option<S["Type"]>, Issue.Issue, R>
) {
  return (self: S): decodingMiddleware<S, S["DecodingServices"] | R> => {
    return self.pipe(decodingMiddleware(Effect.catchEager(f)))
  }
}

/**
 * @category Middlewares
 * @since 4.0.0
 */
export function catchEncoding<S extends Top>(
  f: (issue: Issue.Issue) => Effect.Effect<O.Option<S["Encoded"]>, Issue.Issue>
): (self: S) => S["~rebuild.out"] {
  return catchEncodingWithContext(f)
}

/**
 * @category Middlewares
 * @since 4.0.0
 */
export function catchEncodingWithContext<S extends Top, R = never>(
  f: (issue: Issue.Issue) => Effect.Effect<O.Option<S["Encoded"]>, Issue.Issue, R>
) {
  return (self: S): encodingMiddleware<S, S["EncodingServices"] | R> => {
    return self.pipe(encodingMiddleware(Effect.catchEager(f)))
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
    To["DecodingServices"] | From["DecodingServices"] | RD,
    To["EncodingServices"] | From["EncodingServices"] | RE,
    To["ast"],
    decodeTo<To, From, RD, RE>,
    To["~annotate.in"],
    To["~type.make.in"],
    To["~type.make"],
    To["~type.mutability"],
    To["~type.optionality"],
    To["~type.constructor.default"],
    From["~encoded.mutability"],
    From["~encoded.optionality"]
  >
{
  readonly from: From
  readonly to: To
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface compose<To extends Top, From extends Top> extends decodeTo<To, From, never, never> {}

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
export function decodeTo<To extends Top>(to: To): <From extends Top>(from: From) => compose<To, From>
export function decodeTo<To extends Top, From extends Top, RD = never, RE = never>(
  to: To,
  transformation: {
    readonly decode: Getter.Getter<NoInfer<To["Encoded"]>, NoInfer<From["Type"]>, RD>
    readonly encode: Getter.Getter<NoInfer<From["Type"]>, NoInfer<To["Encoded"]>, RE>
  }
): (from: From) => decodeTo<To, From, RD, RE>
export function decodeTo<To extends Top, From extends Top, RD = never, RE = never>(
  to: To,
  transformation?: {
    readonly decode: Getter.Getter<To["Encoded"], From["Type"], RD>
    readonly encode: Getter.Getter<From["Type"], To["Encoded"], RE>
  } | undefined
) {
  return (from: From) => {
    return new decodeTo$(
      AST.decodeTo(
        from.ast,
        to.ast,
        transformation ? Transformation.make(transformation) : Transformation.passthrough()
      ),
      from,
      to
    )
  }
}

/**
 * Like {@link decodeTo}, but the transformation is applied to the type codec
 * (`typeCodec(self)`).
 *
 * @since 4.0.0
 */
export function decode<S extends Top, RD = never, RE = never>(transformation: {
  readonly decode: Getter.Getter<S["Type"], S["Type"], RD>
  readonly encode: Getter.Getter<S["Type"], S["Type"], RE>
}) {
  return (self: S): decodeTo<typeCodec<S>, S, RD, RE> => {
    return self.pipe(decodeTo(typeCodec(self), transformation))
  }
}

/**
 * @since 4.0.0
 */
export function encodeTo<To extends Top>(
  to: To
): <From extends Top>(from: From) => decodeTo<From, To, never, never>
export function encodeTo<To extends Top, From extends Top, RD = never, RE = never>(
  to: To,
  transformation: {
    readonly decode: Getter.Getter<NoInfer<From["Encoded"]>, NoInfer<To["Type"]>, RD>
    readonly encode: Getter.Getter<NoInfer<To["Type"]>, NoInfer<From["Encoded"]>, RE>
  }
): (from: From) => decodeTo<From, To, RD, RE>
export function encodeTo<To extends Top, From extends Top, RD = never, RE = never>(
  to: To,
  transformation?: {
    readonly decode: Getter.Getter<From["Encoded"], To["Type"], RD>
    readonly encode: Getter.Getter<To["Type"], From["Encoded"], RE>
  }
) {
  return (from: From): decodeTo<From, To, RD, RE> => {
    return transformation ? to.pipe(decodeTo(from, transformation)) : to.pipe(decodeTo(from))
  }
}

/**
 * Like {@link encodeTo}, but the transformation is applied to the encoded codec
 * (`encodedCodec(self)`).
 *
 * @since 4.0.0
 */
export function encode<S extends Top, RD = never, RE = never>(transformation: {
  readonly decode: Getter.Getter<S["Encoded"], S["Encoded"], RD>
  readonly encode: Getter.Getter<S["Encoded"], S["Encoded"], RE>
}) {
  return (self: S): decodeTo<S, encodedCodec<S>, RD, RE> => {
    return encodedCodec(self).pipe(decodeTo(self, transformation))
  }
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface withConstructorDefault<S extends Top> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingServices"],
    S["EncodingServices"],
    S["ast"],
    withConstructorDefault<S>,
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    "with-default",
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{}

/**
 * Provide a default value when the input is `Option<undefined>`.
 *
 * @since 4.0.0
 */
export function withConstructorDefault<S extends Top & { readonly "~type.constructor.default": "no-default" }>(
  defaultValue: (
    input: O.Option<undefined>
    // `"~type.make.in"` is intentional here because it makes easier to define the default value
  ) => O.Option<S["~type.make.in"]> | Effect.Effect<O.Option<S["~type.make.in"]>>
) {
  return (self: S): withConstructorDefault<S> => {
    return make<withConstructorDefault<S>>(AST.withConstructorDefault(self.ast, defaultValue))
  }
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface tag<Tag extends AST.Literal> extends withConstructorDefault<Literal<Tag>> {}

/**
 * Literal + withConstructorDefault
 *
 * @since 4.0.0
 */
export function tag<Tag extends AST.Literal>(literal: Tag): tag<Tag> {
  return Literal(literal).pipe(withConstructorDefault(() => O.some(literal)))
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Option<S extends Top> extends declare<O.Option<S["Type"]>, O.Option<S["Encoded"]>, readonly [S]> {
  readonly "~rebuild.out": Option<S>
}

/**
 * Creates a schema that validates `Option` values containing a value of type `S`.
 *
 * @example Basic Usage
 * ```ts
 * import { Option } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const optionalString = Schema.Option(Schema.String)
 *
 * // Successful decoding
 * Schema.decodeUnknownSync(optionalString)(Option.some("hello")) // Option.some("hello")
 * Schema.decodeUnknownSync(optionalString)(Option.none()) // Option.none()
 *
 * // Failed decoding
 * Schema.decodeUnknownSync(optionalString)(null) // throws SchemaError
 * ```
 *
 * @example With Complex Schema
 * ```ts
 * import { Option } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const optionalPerson = Schema.Option(PersonSchema)
 *
 * // Valid inputs
 * Schema.decodeUnknownSync(optionalPerson)(Option.some({ name: "John", age: 30 }))
 * // Option.some({ name: "John", age: 30 })
 *
 * Schema.decodeUnknownSync(optionalPerson)(Option.none())
 * // Option.none()
 * ```
 *
 * @example With Transformations
 * ```ts
 * import { Option } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const optionalNumber = Schema.Option(Schema.Number)
 *
 * // Validates numbers inside Option
 * Schema.decodeUnknownSync(optionalNumber)(Option.some(42))
 * // Option.some(42)
 *
 * Schema.decodeUnknownSync(optionalNumber)(Option.none())
 * // Option.none()
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export function Option<S extends Top>(value: S): Option<S> {
  return declare([value])<O.Option<S["Encoded"]>>()(
    ([value]) => (oinput, ast, options) => {
      if (O.isOption(oinput)) {
        if (O.isNone(oinput)) {
          return Effect.succeedNone
        }
        return ToParser.decodeUnknownEffect(value)(oinput.value, options).pipe(Effect.mapBothEager(
          {
            onSuccess: O.some,
            onFailure: (issue) => new Issue.Composite(ast, oinput, [new Issue.Pointer(["value"], issue)])
          }
        ))
      }
      return Effect.fail(new Issue.InvalidType(ast, O.some(oinput)))
    },
    {
      title: "Option",
      defaultJsonSerializer: ([value]) =>
        link<O.Option<S["Encoded"]>>()(
          Union([Tuple([value]), Tuple([])]),
          Transformation.transform({
            decode: Arr.head,
            encode: (o) => (O.isSome(o) ? [o.value] as const : [] as const)
          })
        ),
      arbitrary: {
        _tag: "declaration",
        declaration: ([value]) => (fc, ctx) => {
          return fc.oneof(
            ctx?.isSuspend ? { maxDepth: 2, depthIdentifier: "Option" } : {},
            fc.constant(O.none()),
            value.map(O.some)
          )
        }
      },
      equivalence: {
        _tag: "declaration",
        declaration: ([value]) => O.getEquivalence(value)
      },
      pretty: {
        _tag: "declaration",
        declaration: ([value]) =>
          O.match({
            onNone: () => "none()",
            onSome: (t) => `some(${value(t)})`
          })
      }
    }
  )
}

/**
 * @since 4.0.0
 */
export const NonEmptyString = String.check(Check.nonEmpty())

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
export function Map<Key extends Top, Value extends Top>(key: Key, value: Value): Map$<Key, Value> {
  return declare([key, value])<globalThis.Map<Key["Encoded"], Value["Encoded"]>>()(
    ([key, value]) => (input, ast, options) => {
      if (input instanceof globalThis.Map) {
        const array = Array(Tuple([key, value]))
        return ToParser.decodeUnknownEffect(array)([...input], options).pipe(Effect.mapBothEager(
          {
            onSuccess: (array: ReadonlyArray<readonly [Key["Type"], Value["Type"]]>) => new globalThis.Map(array),
            onFailure: (issue) => new Issue.Composite(ast, O.some(input), [new Issue.Pointer(["entries"], issue)])
          }
        ))
      }
      return Effect.fail(new Issue.InvalidType(ast, O.some(input)))
    },
    {
      title: "Map",
      defaultJsonSerializer: ([key, value]) =>
        link<globalThis.Map<Key["Encoded"], Value["Encoded"]>>()(
          Array(Tuple([key, value])),
          Transformation.transform({
            decode: (entries) => new globalThis.Map(entries),
            encode: (map) => [...map.entries()]
          })
        ),
      arbitrary: {
        _tag: "declaration",
        declaration: ([key, value]) => (fc, ctx) => {
          return fc.oneof(
            ctx?.isSuspend ? { maxDepth: 2, depthIdentifier: "Map" } : {},
            fc.constant([]),
            fc.array(fc.tuple(key, value), ctx?.fragments?.array)
          ).map((as) => new globalThis.Map(as))
        }
      },
      equivalence: {
        _tag: "declaration",
        declaration: ([key, value]) => {
          const entries = Arr.getEquivalence(
            Equivalence.make<[Key["Type"], Value["Type"]]>(([ka, va], [kb, vb]) => key(ka, kb) && value(va, vb))
          )
          return Equivalence.make((a, b) =>
            entries(globalThis.Array.from(a.entries()).sort(), globalThis.Array.from(b.entries()).sort())
          )
        }
      },
      pretty: {
        _tag: "declaration",
        declaration: ([key, value]) => (t) => {
          const size = t.size
          if (size === 0) {
            return "Map(0) {}"
          }
          const entries = globalThis.Array.from(t.entries()).sort().map(([k, v]) => `${key(k)} => ${value(v)}`)
          return `Map(${size}) { ${entries.join(", ")} }`
        }
      }
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
    S["DecodingServices"],
    S["EncodingServices"],
    S["ast"],
    S["~rebuild.out"],
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  new(_: never): S["Type"]
}

/**
 * @since 4.0.0
 */
export function Opaque<Self>() {
  return <S extends Top>(schema: S): Opaque<Self, S> & Omit<S, "Type" | "Encoded"> => {
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    class Opaque {}
    Object.setPrototypeOf(Opaque, schema)
    return Opaque as any
  }
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface instanceOf<T> extends declare<T, T, readonly []> {
  readonly "~rebuild.out": instanceOf<T>
}

/**
 * @since 4.0.0
 */
export function instanceOf<C extends abstract new(...args: any) => any>(
  options: {
    readonly constructor: C
    readonly annotations?: Annotations.Declaration<InstanceType<C>, readonly []> | undefined
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
export function link<T>() { // TODO: better name
  return <To extends Top>(
    encodeTo: To,
    transformation: Transformation.Transformation<T, To["Type"], never, never>
  ): AST.Link => {
    return new AST.Link(encodeTo.ast, transformation)
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
        Transformation.transform({
          decode: (s) => new globalThis.URL(s),
          encode: (url) => url.toString()
        })
      ),
    arbitrary: {
      _tag: "declaration",
      declaration: () => (fc) => fc.webUrl().map((s) => new globalThis.URL(s))
    },
    equivalence: {
      _tag: "declaration",
      declaration: () => (a, b) => a.toString() === b.toString()
    }
  }
})

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Date extends instanceOf<globalThis.Date> {
  readonly "~rebuild.out": Date
}

/**
 * A schema for JavaScript `Date` objects that validates instances of the `Date` class.
 *
 * This schema accepts any `Date` instance, including invalid dates (e.g., `new Date("invalid")`).
 * For validating only valid dates, use `ValidDate` instead.
 *
 * When used with JSON serialization, dates are automatically converted to ISO strings
 * and parsed back to Date objects.
 *
 * @example Basic Usage
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.Date
 *
 * // Valid Date instances
 * Schema.decodeUnknownSync(schema)(new Date("2023-10-01"))
 * // new Date("2023-10-01T00:00:00.000Z")
 *
 * Schema.decodeUnknownSync(schema)(new Date())
 * // Current date
 *
 * // Invalid Date instances are also accepted
 * Schema.decodeUnknownSync(schema)(new Date("invalid"))
 * // new Date("invalid") - Invalid Date object
 * ```
 *
 * @example Usage in Structures
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const EventSchema = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String,
 *   createdAt: Schema.Date,
 *   updatedAt: Schema.Date
 * })
 *
 * const event = Schema.decodeUnknownSync(EventSchema)({
 *   id: 1,
 *   name: "Meeting",
 *   createdAt: new Date("2023-10-01"),
 *   updatedAt: new Date("2023-10-02")
 * })
 * // { id: 1, name: "Meeting", createdAt: Date, updatedAt: Date }
 * ```
 *
 * @example JSON Serialization
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.Date
 *
 * // Direct validation of Date instances
 * const dateInstance = Schema.decodeUnknownSync(schema)(new Date("2023-10-01"))
 * // new Date("2023-10-01T00:00:00.000Z")
 *
 * // For JSON serialization, use with Serializer
 * const date = new Date("2023-10-01")
 * const encoded = Schema.encodeSync(schema)(date)
 * // Date object (same instance for direct encoding)
 * ```
 *
 * @example With Validation Checks
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * // Create a schema that accepts only valid dates
 * const ValidDateSchema = Schema.Date.check(Check.validDate())
 *
 * // This works
 * Schema.decodeUnknownSync(ValidDateSchema)(new Date("2023-10-01"))
 * // new Date("2023-10-01T00:00:00.000Z")
 *
 * // This fails
 * try {
 *   Schema.decodeUnknownSync(ValidDateSchema)(new Date("invalid"))
 * } catch (error) {
 *   console.log("Invalid date rejected")
 * }
 * ```
 *
 * @category instances
 * @since 4.0.0
 */
export const Date: Date = instanceOf({
  constructor: globalThis.Date,
  annotations: {
    title: "Date",
    defaultJsonSerializer: () =>
      link<globalThis.Date>()(
        String,
        Transformation.transform({
          decode: (s) => new globalThis.Date(s),
          encode: (date) => date.toISOString()
        })
      ),
    arbitrary: {
      _tag: "declaration",
      declaration: () => (fc, ctx) => fc.date(ctx?.fragments?.date)
    }
  }
})

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface ValidDate extends Date {
  readonly "~rebuild.out": ValidDate
}

/**
 * @since 4.0.0
 */
export const ValidDate = Date.check(Check.validDate())

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface UnknownFromJsonString extends decodeTo<Unknown, String, never, never> {
  readonly "~rebuild.out": UnknownFromJsonString
}

/**
 * @since 4.0.0
 */
export const UnknownFromJsonString: UnknownFromJsonString = String.pipe(
  decodeTo(
    Unknown.annotate({ title: "JSON parsed value" }),
    Transformation.json()
  )
)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Finite extends Number {
  readonly "~rebuild.out": Finite
}

/**
 * All finite numbers, excluding `NaN`, `Infinity`, and `-Infinity`.
 *
 * @since 4.0.0
 */
export const Finite = Number.check(Check.finite())

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface FiniteFromString extends decodeTo<Number, String, never, never> {
  readonly "~rebuild.out": FiniteFromString
}

/**
 * @since 4.0.0
 */
export const FiniteFromString: FiniteFromString = String.pipe(
  decodeTo(
    Finite,
    Transformation.numberFromString
  )
)

/**
 * @since 4.0.0
 */
export function getNativeClassSchema<C extends new(...args: any) => any, S extends Struct<Struct.Fields>>(
  constructor: C,
  options: {
    readonly encoding: S
    readonly annotations?: Annotations.Declaration<InstanceType<C>, readonly []>
  }
): decodeTo<instanceOf<InstanceType<C>>, S, never, never> {
  const transformation = Transformation.transform<InstanceType<C>, S["Type"]>({
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
    S["DecodingServices"],
    S["EncodingServices"],
    AST.Declaration,
    Class<Self, S, Self>,
    Annotations.Declaration<Self, readonly [S]>,
    S["~type.make.in"],
    Self,
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  new(props: S["~type.make.in"], options?: MakeOptions): S["Type"] & Inherited
  readonly identifier: string
  readonly fields: S["fields"]
}

/**
 * Not all classes are extendable (e.g. `RequestClass`).
 *
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
    annotations?: Annotations.Declaration<Extended, readonly [Struct<Simplify<Merge<S["fields"], NewFields>>>]>
  ) => ExtendableClass<Extended, Struct<Simplify<Merge<S["fields"], NewFields>>>, Self>
}

const immerable: unique symbol = globalThis.Symbol.for("immer-draftable") as any

function makeClass<
  Self,
  S extends Top & {
    readonly Type: object
    readonly fields: Struct.Fields
  },
  Inherited extends new(...args: ReadonlyArray<any>) => any
>(
  Inherited: Inherited,
  identifier: string,
  schema: S,
  annotations?: Annotations.Declaration<Self, readonly [S]>
): any {
  const computeAST = getComputeAST(schema.ast, { identifier, ...annotations })

  return class extends Inherited {
    constructor(...[input, options]: ReadonlyArray<any>) {
      if (options?.disableValidation) {
        super(input, options)
      } else {
        const validated = schema.makeSync(input, options)
        super({ ...input, ...validated }, { ...options, disableValidation: true })
      }
    }

    static readonly [TypeId]: TypeId = TypeId
    static readonly [immerable] = true

    declare static readonly "Type": Self
    declare static readonly "Encoded": S["Encoded"]
    declare static readonly "DecodingServices": S["DecodingServices"]
    declare static readonly "EncodingServices": S["EncodingServices"]

    declare static readonly "~rebuild.out": Class<Self, S, Self>
    declare static readonly "~annotate.in": Annotations.Declaration<Self, readonly [S]>
    declare static readonly "~type.make.in": S["~type.make.in"]
    declare static readonly "~type.make": Self

    declare static readonly "~type.mutability": S["~type.mutability"]
    declare static readonly "~type.optionality": S["~type.optionality"]
    declare static readonly "~type.constructor.default": S["~type.constructor.default"]

    declare static readonly "~encoded.mutability": S["~encoded.mutability"]
    declare static readonly "~encoded.optionality": S["~encoded.optionality"]

    static readonly identifier = identifier
    static readonly fields = schema.fields

    static get ast(): AST.Declaration {
      return computeAST(this)
    }
    static pipe() {
      return pipeArguments(this, arguments)
    }
    static rebuild(ast: AST.Declaration): Class<Self, S, Self> {
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
    static annotate(annotations: Annotations.Declaration<Self, readonly [S]>): Class<Self, S, Self> {
      return this.rebuild(AST.annotate(this.ast, annotations))
    }
    static check(
      ...checks: readonly [
        Check.Check<Self>,
        ...ReadonlyArray<Check.Check<Self>>
      ]
    ): Class<Self, S, Self> {
      return this.rebuild(AST.appendChecks(this.ast, checks))
    }
    static extend<Extended>(
      identifier: string
    ): <NewFields extends Struct.Fields>(
      fields: NewFields,
      annotations?: Annotations.Declaration<Extended, readonly [Struct<Simplify<Merge<S["fields"], NewFields>>>]>
    ) => Class<Extended, Struct<Simplify<Merge<S["fields"], NewFields>>>, Self> {
      return (newFields, annotations) => {
        const fields = { ...schema.fields, ...newFields }
        const struct: any = new Struct$(AST.struct(fields, schema.ast.checks), fields)
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

const makeGetLink = (self: new(...args: ReadonlyArray<any>) => any) => (ast: AST.AST) =>
  new AST.Link(
    ast,
    new Transformation.Transformation(
      Getter.map((input) => new self(input)),
      Getter.mapOrFail((input) => {
        if (!(input instanceof self)) {
          return Effect.fail(new Issue.InvalidType(ast, input))
        }
        return Effect.succeed(input)
      })
    )
  )

function getComputeAST(
  from: AST.AST,
  annotations: Annotations.Declaration<any, readonly [Schema<any>]> | undefined,
  checks: AST.Checks | undefined = undefined,
  context: AST.Context | undefined = undefined
) {
  let memo: AST.Declaration | undefined
  return (self: any) => {
    if (memo === undefined) {
      const getLink = makeGetLink(self)
      const contextLink = getLink(AST.unknownKeyword)
      memo = new AST.Declaration(
        [from],
        () => (input, ast) => {
          if (input instanceof self) {
            return Effect.succeed(input)
          }
          return Effect.fail(new Issue.InvalidType(ast, O.some(input)))
        },
        {
          defaultJsonSerializer: ([from]: [Top]) => getLink(from.ast),
          arbitrary: {
            _tag: "declaration",
            declaration: ([from]) => () => from.map((args) => new self(args))
          },
          pretty: {
            _tag: "declaration",
            declaration: ([from]) => (t) => `${self.identifier}(${from(t)})`
          },
          ...annotations
        } as Annotations.Declaration<any, readonly [Top]>,
        checks,
        [getLink(from)],
        context ?
          new AST.Context(
            context.isOptional,
            context.isMutable,
            context.defaultValue,
            context.make ? [...context.make, contextLink] : [contextLink],
            context.annotations
          ) :
          new AST.Context(false, false, undefined, [contextLink])
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
      annotations?: Annotations.Declaration<Self, readonly [Struct<Fields>]>
    ): ExtendableClass<Self, Struct<Fields>, Brand>
    <S extends Struct<Struct.Fields>>(
      schema: S,
      annotations?: Annotations.Declaration<Self, readonly [S]>
    ): ExtendableClass<Self, S, Brand>
  }
} = <Self, Brand = {}>(identifier: string) =>
(
  schema: Struct.Fields | Struct<Struct.Fields>,
  annotations?: Annotations.Declaration<Self, readonly [Struct<Struct.Fields>]>
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
      annotations?: Annotations.Declaration<Self, readonly [Struct<Fields>]>
    ): ErrorClass<Self, Struct<Fields>, Cause.YieldableError & Brand>
    <S extends Struct<Struct.Fields>>(
      schema: S,
      annotations?: Annotations.Declaration<Self, readonly [S]>
    ): ErrorClass<Self, S, Cause.YieldableError & Brand>
  }
} = <Self, Brand = {}>(identifier: string) =>
(
  schema: Struct.Fields | Struct<Struct.Fields>,
  annotations?: Annotations.Declaration<Self, readonly [Struct<Struct.Fields>]>
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
      readonly annotations?: Annotations.Declaration<Self, readonly [Payload]>
    }
  ): RequestClass<
    Self,
    Payload,
    Success,
    Error,
    Request.Request<
      Success["Type"],
      Error["Type"],
      Success["DecodingServices"] | Success["EncodingServices"] | Error["DecodingServices"] | Error["EncodingServices"]
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
export interface declareRefinement<T> extends declare<T, T, readonly []> {
  readonly "~rebuild.out": declareRefinement<T>
}

/**
 * @since 4.0.0
 */
export function declareRefinement<T>(
  options: {
    readonly is: (u: unknown) => u is T
    annotations?: Annotations.Declaration<T, readonly []> | undefined
  }
): declareRefinement<T> {
  return declare([])<T>()(
    () => (input, ast) =>
      options.is(input) ?
        Effect.succeed(input) :
        Effect.fail(new Issue.InvalidType(ast, O.some(input))),
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
    ) => (u: unknown, self: AST.Declaration, options: AST.ParseOptions) => Effect.Effect<T, Issue.Issue>,
    annotations?: Annotations.Declaration<T, TypeParameters>
  ): declare<T, E, TypeParameters> => {
    return make<declare<T, E, TypeParameters>>(
      new AST.Declaration(
        typeParameters.map(AST.getAST),
        (typeParameters) => run(typeParameters.map(make) as any),
        annotations
      )
    )
  }
}
