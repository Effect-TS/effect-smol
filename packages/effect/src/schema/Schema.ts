/**
 * @since 4.0.0
 */

import type { StandardSchemaV1 } from "@standard-schema/spec"
import * as Arr from "../Array.js"
import type { Brand } from "../Brand.js"
import * as Cause from "../Cause.js"
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
import * as ToEquivalence from "./ToEquivalence.js"
import * as ToParser from "./ToParser.js"
import * as Transformation from "./Transformation.js"

/** Is this value required or optional? */
type Optionality = "required" | "optional"

/** Is this value read-only or mutable? */
type Mutability = "readonly" | "mutable"

/** Does the constructor supply a default value? */
type ConstructorDefault = "no-default" | "with-default"

/**
 * Configuration options for the `makeSync` method, providing control over
 * parsing behavior and validation.
 *
 * @since 4.0.0
 */
export interface MakeOptions {
  /**
   * The parse options to use for the schema.
   */
  readonly parseOptions?: AST.ParseOptions | undefined
  /**
   * Whether to disable validation for the schema.
   */
  readonly disableValidation?: boolean | undefined
}

/**
 * The unique identifier for Schema values.
 *
 * @since 4.0.0
 */
export const TypeId: TypeId = "~effect/schema/Schema"

/**
 * The unique identifier type for Schema values.
 *
 * @since 4.0.0
 * @category symbols
 */
export type TypeId = "~effect/schema/Schema"

/**
 * The base interface for all schemas in the Effect Schema library, exposing all
 * 14 type parameters that control schema behavior and type inference. Bottom
 * sits at the root of the schema type hierarchy and provides access to the
 * complete internal type information of schemas.
 *
 * Bottom is primarily used for advanced type-level operations, schema
 * introspection, and when you need precise control over all aspects of schema
 * behavior including mutability, optionality, service dependencies, and
 * transformation characteristics.
 *
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
 * Reveals the complete Bottom interface type of a schema, exposing all 14 type
 * parameters.
 *
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
 * Adds metadata annotations to a schema without changing its runtime behavior.
 * Annotations are used to provide additional context for documentation,
 * JSON schema generation, error formatting, and other tooling.
 *
 * @category Annotations
 * @since 4.0.0
 */
export function annotate<S extends Top>(annotations: S["~annotate.in"]) {
  return (self: S): S["~rebuild.out"] => {
    return self.annotate(annotations)
  }
}

/**
 * Adds key-specific annotations to a schema field. This is useful for providing
 * custom error messages and documentation for individual fields within
 * structures.
 *
 * @category Annotations
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
 * @since 4.0.0
 */
export interface Codec<out T, out E = T, out RD = never, out RE = never> extends Schema<T> {
  readonly "Encoded": E
  readonly "DecodingServices": RD
  readonly "EncodingServices": RE
  readonly "~rebuild.out": Codec<T, E, RD, RE>
}

/**
 * @since 4.0.0
 */
export function revealCodec<T, E, RD, RE>(codec: Codec<T, E, RD, RE>) {
  return codec
}

/**
 * A `SchemaError` is thrown when schema decoding or encoding fails.
 *
 * This error extends `Data.TaggedError` and contains detailed information about
 * what went wrong during schema processing. The error includes an `issue` field
 * that provides comprehensive details about the validation failure, including
 * the path to the problematic data, expected types, and actual values.
 *
 * @since 4.0.0
 */
export class SchemaError extends Data.TaggedError("SchemaError")<{
  readonly issue: Issue.Issue
}> {}

function makeStandardResult<A>(exit: Exit.Exit<StandardSchemaV1.Result<A>>): StandardSchemaV1.Result<A> {
  return Exit.isSuccess(exit) ? exit.value : {
    issues: [{ message: Cause.pretty(exit.cause) }]
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
 * **Example** (Creating a standard schema from a regular schema)
 *
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * // Define custom hook functions for error formatting
 * const leafHook = (issue: any) => {
 *   switch (issue._tag) {
 *     case "InvalidType":
 *       return "Expected different type"
 *     case "InvalidValue":
 *       return "Invalid value provided"
 *     case "MissingKey":
 *       return "Required property missing"
 *     case "UnexpectedKey":
 *       return "Unexpected property found"
 *     case "Forbidden":
 *       return "Operation not allowed"
 *     case "OneOf":
 *       return "Multiple valid options available"
 *     default:
 *       return "Validation error"
 *   }
 * }
 *
 * const checkHook = (issue: any) => {
 *   return `Check failed: ${issue.filter.annotations?.description || "validation error"}`
 * }
 *
 * // Create a standard schema from a regular schema
 * const PersonSchema = Schema.Struct({
 *   name: Schema.NonEmptyString,
 *   age: Schema.Number.pipe(Schema.check(Check.between(0, 150)))
 * })
 *
 * const standardSchema = Schema.standardSchemaV1(PersonSchema, {
 *   leafHook,
 *   checkHook
 * })
 *
 * // The standard schema can be used with any Standard Schema v1 compatible library
 * const validResult = standardSchema["~standard"].validate({
 *   name: "Alice",
 *   age: 30
 * })
 * console.log(validResult) // { value: { name: "Alice", age: 30 } }
 *
 * const invalidResult = standardSchema["~standard"].validate({
 *   name: "",
 *   age: 200
 * })
 * console.log(invalidResult) // { issues: [{ path: ["name"], message: "..." }, { path: ["age"], message: "..." }] }
 * ```
 *
 * @since 4.0.0
 */
export const standardSchemaV1 = <S extends Top>(
  self: S,
  options?: {
    readonly leafHook?: Formatter.LeafHook | undefined
    readonly checkHook?: Formatter.CheckHook | undefined
    readonly parseOptions?: AST.ParseOptions | undefined
  }
): StandardSchemaV1<S["Encoded"], S["Type"]> & S => {
  const decodeUnknownEffect = ToParser.decodeUnknownEffect(self) as (
    input: unknown,
    options?: AST.ParseOptions
  ) => Effect.Effect<S["Type"], Issue.Issue>
  const parseOptions: AST.ParseOptions = { errors: "all", ...options?.parseOptions }
  const formatter = Formatter.makeStandardSchemaV1(options)
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
 * Creates a type guard function that checks if a value conforms to a given
 * schema.
 *
 * This function returns a predicate that performs a type-safe check, narrowing
 * the type of the input value if the check passes. It's particularly useful for
 * runtime type validation and TypeScript type narrowing.
 *
 * **Example** (Basic Type Guard)
 *
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const isString = Schema.is(Schema.String)
 *
 * console.log(isString("hello")) // true
 * console.log(isString(42)) // false
 *
 * // Type narrowing in action
 * const value: unknown = "hello"
 * if (isString(value)) {
 *   // value is now typed as string
 *   console.log(value.toUpperCase()) // "HELLO"
 * }
 * ```
 *
 * @category Asserting
 * @since 4.0.0
 */
export const is = ToParser.is

/**
 * Creates an assertion function that throws an error if the input doesn't match
 * the schema.
 *
 * This function is useful for runtime type checking with TypeScript's `asserts`
 * type guard. It narrows the type of the input if the assertion succeeds, or
 * throws an error if it fails.
 *
 * **Example** (Basic Usage)
 *
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const assertString: (u: unknown) => asserts u is string = Schema.asserts(Schema.String)
 *
 * // This will pass silently (no return value)
 * try {
 *   assertString("hello")
 *   console.log("String assertion passed")
 * } catch (error) {
 *   console.log("String assertion failed")
 * }
 *
 * // This will throw an error
 * try {
 *   assertString(123)
 * } catch (error) {
 *   console.log("Non-string assertion failed as expected")
 * }
 * ```
 *
 * @category Asserting
 * @since 4.0.0
 */
export const asserts = ToParser.asserts

/**
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
 * Creates a schema from an AST (Abstract Syntax Tree) node.
 *
 * This is the fundamental constructor for all schemas in the Effect Schema
 * library. It takes an AST node and wraps it in a fully-typed schema that
 * preserves all type information and provides the complete schema API.
 *
 * The `make` function is used internally to create all primitive schemas like
 * `String`, `Number`, `Boolean`, etc., as well as more complex schemas. It's
 * the bridge between the untyped AST representation and the strongly-typed
 * schema.
 *
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
 * @category Guards
 * @since 4.0.0
 */
export function isSchema(u: unknown): u is Schema<unknown> {
  return Predicate.hasProperty(u, TypeId) && u[TypeId] === TypeId
}

/**
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
 * Creates an exact optional key schema for struct fields. Unlike `optional`,
 * this creates exact optional properties (not `| undefined`) that can be
 * completely omitted from the object.
 *
 * **Example** (Creating a struct with optional key)
 *
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.optionalKey(Schema.Number)
 * })
 *
 * // Type: { readonly name: string; readonly age?: number }
 * type Person = typeof schema["Type"]
 * ```
 *
 * @since 4.0.0
 */
export const optionalKey = lambda<optionalKeyLambda>(function optionalKey<S extends Top>(self: S): optionalKey<S> {
  return new makeWithSchema$<S, optionalKey<S>>(AST.optionalKey(self.ast), self)
})

/**
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
 * Creates an optional schema field that allows both the specified type and
 * `undefined`.
 *
 * This is equivalent to `optionalKey(UndefinedOr(schema))`, creating a field
 * that:
 * - Can be omitted from the object entirely
 * - Can be explicitly set to `undefined`
 * - Can contain the specified schema type
 *
 * **Example** (Creating a struct with optional)
 *
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.optionalKey(Schema.Number)
 * })
 *
 * // Type: { readonly name: string; readonly age?: number | undefined }
 * type Person = typeof schema["Type"]
 * ```
 *
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
 * @since 4.0.0
 */
export interface Never extends Bottom<never, never, never, never, AST.NeverKeyword, Never, Annotations.Bottom<never>> {}

/**
 * @since 4.0.0
 */
export const Never: Never = make<Never>(AST.neverKeyword)

/**
 * @since 4.0.0
 */
export interface Any extends Bottom<any, any, never, never, AST.AnyKeyword, Any, Annotations.Bottom<any>> {}

/**
 * @since 4.0.0
 */
export const Any: Any = make<Any>(AST.anyKeyword)

/**
 * @since 4.0.0
 */
export interface Unknown
  extends Bottom<unknown, unknown, never, never, AST.UnknownKeyword, Unknown, Annotations.Bottom<unknown>>
{}

/**
 * @since 4.0.0
 */
export const Unknown: Unknown = make<Unknown>(AST.unknownKeyword)

/**
 * @since 4.0.0
 */
export interface Null extends Bottom<null, null, never, never, AST.NullKeyword, Null, Annotations.Bottom<null>> {}

/**
 * @since 4.0.0
 */
export const Null: Null = make<Null>(AST.nullKeyword)

/**
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
 * @since 4.0.0
 */
export const Undefined: Undefined = make<Undefined>(AST.undefinedKeyword)

/**
 * @since 4.0.0
 */
export interface String
  extends Bottom<string, string, never, never, AST.StringKeyword, String, Annotations.Bottom<string>>
{}

/**
 * @since 4.0.0
 */
export const String: String = make<String>(AST.stringKeyword)

/**
 * @since 4.0.0
 */
export interface Number
  extends Bottom<number, number, never, never, AST.NumberKeyword, Number, Annotations.Bottom<number>>
{}

/**
 * All numbers, including `NaN`, `Infinity`, and `-Infinity`.
 *
 * @since 4.0.0
 */
export const Number: Number = make<Number>(AST.numberKeyword)

/**
 * @since 4.0.0
 */
export interface Boolean
  extends Bottom<boolean, boolean, never, never, AST.BooleanKeyword, Boolean, Annotations.Bottom<boolean>>
{}

/**
 * @since 4.0.0
 */
export const Boolean: Boolean = make<Boolean>(AST.booleanKeyword)

/**
 * @since 4.0.0
 */
export interface Symbol
  extends Bottom<symbol, symbol, never, never, AST.SymbolKeyword, Symbol, Annotations.Bottom<symbol>>
{}

/**
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
 * @since 4.0.0
 */
export const BigInt: BigInt = make<BigInt>(AST.bigIntKeyword)

/**
 * @since 4.0.0
 */
export interface Void extends Bottom<void, void, never, never, AST.VoidKeyword, Void, Annotations.Bottom<void>> {}

/**
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
 * @since 4.0.0
 */
export function Struct<const Fields extends Struct.Fields>(fields: Fields): Struct<Fields> {
  return new Struct$(AST.struct(fields, undefined), fields)
}

/**
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
 * @category Constructors
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
 * @category Constructors
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
 * @category Constructors
 * @since 4.0.0
 */
export const Array = lambda<ArrayLambda>(function Array<S extends Top>(item: S): Array$<S> {
  return new makeWithSchema$<S, Array$<S>>(
    new AST.TupleType(false, [], [item.ast]),
    item
  )
})

/**
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
 * @category Constructors
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
export interface UniqueArray<S extends Top> extends Array$<S> {
  readonly "~rebuild.out": UniqueArray<S>
}

/**
 * Returns a new array schema that ensures all elements are unique.
 *
 * The equivalence used to determine uniqueness is the one provided by
 * `ToEquivalence.make(item)`.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function UniqueArray<S extends Top>(item: S): UniqueArray<S> {
  return Array(item).check(Check.unique(ToEquivalence.make(item)))
}

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
 * @category Constructors
 * @since 4.0.0
 */
export function Union<const Members extends ReadonlyArray<Top>>(
  members: Members,
  options?: { mode?: "anyOf" | "oneOf" }
): Union<Members> {
  return new Union$(AST.union(members, options?.mode ?? "anyOf", undefined), members)
}

/**
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
 * @category Constructors
 * @since 4.0.0
 */
export function Literals<const L extends ReadonlyArray<AST.Literal>>(literals: L): Literals<L> {
  const members = literals.map(Literal) as { readonly [K in keyof L]: Literal<L[K]> }
  return new Literals$(AST.union(members, "anyOf", undefined), [...literals] as L, members)
}

/**
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
 * @category Constructors
 * @since 4.0.0
 */
export const NullOr = lambda<NullOrLambda>(
  function NullOr<S extends Top>(self: S) {
    return Union([self, Null])
  }
)

/**
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
 * @category Constructors
 * @since 4.0.0
 */
export const UndefinedOr = lambda<UndefinedOrLambda>(
  function UndefinedOr<S extends Top>(self: S) {
    return Union([self, Undefined])
  }
)

/**
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
 * @category Constructors
 * @since 4.0.0
 */
export const NullishOr = lambda<NullishOrLambda>(
  function NullishOr<S extends Top>(self: S) {
    return Union([self, Null, Undefined])
  }
)

/**
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
 * Creates a suspended schema that defers evaluation until needed. This is
 * essential for creating recursive schemas where a schema references itself,
 * preventing infinite recursion during schema definition.
 *
 * @category Constructors
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
 * @category Filtering
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
 * @category Filtering
 * @since 4.0.0
 */
export function brand<B extends string | symbol>(brand: B, annotations?: Annotations.Filter) {
  return <S extends Top>(self: S): refine<S["Type"] & Brand<B>, S["~rebuild.out"]> => {
    return self.pipe(refine(Check.makeBrand(brand, annotations)))
  }
}

/**
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
 * @since 4.0.0
 */
export function catchDecoding<S extends Top>(
  f: (issue: Issue.Issue) => Effect.Effect<O.Option<S["Type"]>, Issue.Issue>
): (self: S) => S["~rebuild.out"] {
  return catchDecodingWithContext(f)
}

/**
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
 * @since 4.0.0
 */
export function catchEncoding<S extends Top>(
  f: (issue: Issue.Issue) => Effect.Effect<O.Option<S["Encoded"]>, Issue.Issue>
): (self: S) => S["~rebuild.out"] {
  return catchEncodingWithContext(f)
}

/**
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
{
  readonly schema: S
}

/**
 * @since 4.0.0
 */
export function withConstructorDefault<S extends Top & { readonly "~type.constructor.default": "no-default" }>(
  defaultValue: (
    input: O.Option<undefined>
    // `S["~type.make.in"]` instead of `S["Type"]` is intentional here because
    // it makes easier to define the default value if there are nested defaults
  ) => O.Option<S["~type.make.in"]> | Effect.Effect<O.Option<S["~type.make.in"]>>
) {
  return (self: S): withConstructorDefault<S> => {
    return new makeWithSchema$<S, withConstructorDefault<S>>(AST.withConstructorDefault(self.ast, defaultValue), self)
  }
}

/**
 * @since 4.0.0
 */
export interface withDecodingDefaultKey<S extends Top> extends decodeTo<S, optionalKey<encodedCodec<S>>, never, never> {
  readonly "~rebuild.out": withDecodingDefaultKey<S>
}

/**
 * @since 4.0.0
 */
export function withDecodingDefaultKey<S extends Top>(defaultValue: () => S["Encoded"]) {
  return (self: S): withDecodingDefaultKey<S> => {
    return optionalKey(encodedCodec(self)).pipe(decodeTo(self, {
      decode: Getter.withDefault(defaultValue),
      encode: Getter.passthrough()
    }))
  }
}

/**
 * @since 4.0.0
 */
export interface withDecodingDefault<S extends Top> extends decodeTo<S, optional<encodedCodec<S>>, never, never> {
  readonly "~rebuild.out": withDecodingDefault<S>
}

/**
 * @since 4.0.0
 */
export function withDecodingDefault<S extends Top>(defaultValue: () => S["Encoded"]) {
  return (self: S): withDecodingDefault<S> => {
    return optional(encodedCodec(self)).pipe(decodeTo(self, {
      decode: Getter.withDefault(defaultValue),
      encode: Getter.passthrough()
    }))
  }
}

/**
 * @since 4.0.0
 */
export interface tag<Tag extends AST.Literal> extends withConstructorDefault<Literal<Tag>> {}

/**
 * Creates a schema for a literal value that automatically provides itself as a
 * default.
 *
 * The `tag` function combines a literal schema with a constructor default,
 * making it perfect for discriminated unions and tagged data structures. The
 * tag value is automatically provided when the field is missing during
 * construction.
 *
 * @since 4.0.0
 */
export function tag<Tag extends AST.Literal>(literal: Tag): tag<Tag> {
  return Literal(literal).pipe(withConstructorDefault(() => O.some(literal)))
}

/**
 * @since 4.0.0
 */
export type TaggedStruct<Tag extends AST.Literal, Fields extends Struct.Fields> = Struct<
  { readonly _tag: tag<Tag> } & Fields
>

/**
 * A tagged struct is a struct that includes a `_tag` field. This field is used
 * to identify the specific variant of the object, which is especially useful
 * when working with union types.
 *
 * When using the `makeSync` method, the `_tag` field is optional and will be
 * added automatically. However, when decoding or encoding, the `_tag` field
 * must be present in the input.
 *
 * **Example** (Tagged struct as a shorthand for a struct with a `_tag` field)
 *
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Defines a struct with a fixed `_tag` field
 * const tagged = Schema.TaggedStruct("A", {
 *   a: Schema.String
 * })
 *
 * // This is the same as writing:
 * const equivalent = Schema.Struct({
 *   _tag: Schema.tag("A"),
 *   a: Schema.String
 * })
 * ```
 *
 * **Example** (Accessing the literal value of the tag)
 *
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const tagged = Schema.TaggedStruct("A", {
 *   a: Schema.String
 * })
 *
 * // literal: "A"
 * const literal = tagged.fields._tag.schema.literal
 * ```
 *
 * @category Constructors
 * @since 4.0.0
 */
export function TaggedStruct<const Tag extends AST.Literal, const Fields extends Struct.Fields>(
  value: Tag,
  fields: Fields
): TaggedStruct<Tag, Fields> {
  return Struct({ _tag: tag(value), ...fields })
}

/**
 * Recursively flatten any nested Schema.Union members into a single tuple of leaf schemas.
 */
type Flatten<Schemas> = Schemas extends readonly [infer Head, ...infer Tail]
  ? Head extends Union<infer Inner> ? [...Flatten<Inner>, ...Flatten<Tail>]
  : [Head, ...Flatten<Tail>]
  : []

type TaggedUnionUtils<
  Tag extends PropertyKey,
  Members extends ReadonlyArray<Top & { readonly Type: { readonly [K in Tag]: PropertyKey } }>,
  Flattened extends ReadonlyArray<Top & { readonly Type: { readonly [K in Tag]: PropertyKey } }> = Flatten<
    Members
  >
> = {
  readonly cases: Simplify<{ [M in Flattened[number] as M["Type"][Tag]]: M }>
  readonly isAnyOf: <const Keys>(
    keys: ReadonlyArray<Keys>
  ) => (value: Members[number]["Type"]) => value is Extract<Members[number]["Type"], { _tag: Keys }>
  readonly guards: { [M in Flattened[number] as M["Type"][Tag]]: (u: unknown) => u is M["Type"] }
  readonly match: {
    <Output>(
      value: Members[number]["Type"],
      cases: { [M in Flattened[number] as M["Type"][Tag]]: (value: M["Type"]) => Output }
    ): Output
    <Output>(
      cases: { [M in Flattened[number] as M["Type"][Tag]]: (value: M["Type"]) => Output }
    ): (value: Members[number]["Type"]) => Output
  }
}

function getTag(tag: PropertyKey, ast: AST.AST): PropertyKey | undefined {
  if (AST.isTypeLiteral(ast)) {
    const ps = ast.propertySignatures.find((p) => p.name === tag)
    if (ps) {
      if (AST.isLiteralType(ps.type) && Predicate.isPropertyKey(ps.type.literal)) {
        return ps.type.literal
      } else if (AST.isUniqueSymbol(ps.type)) {
        return ps.type.symbol
      }
    }
  }
}

/**
 * @since 4.0.0
 * @experimental
 */
export type asTaggedUnion<
  Tag extends PropertyKey,
  Members extends ReadonlyArray<Top & { readonly Type: { readonly [K in Tag]: PropertyKey } }>
> = Union<Members> & TaggedUnionUtils<Tag, Members>

/**
 * @since 4.0.0
 * @experimental
 */
export function asTaggedUnion<const Tag extends PropertyKey>(tag: Tag) {
  return <const Members extends ReadonlyArray<Top & { readonly Type: { readonly [K in Tag]: PropertyKey } }>>(
    self: Union<Members>
  ): asTaggedUnion<Tag, Members> => {
    const cases: Record<PropertyKey, unknown> = {}
    const guards: Record<PropertyKey, (u: unknown) => boolean> = {}
    const isAnyOf = (keys: ReadonlyArray<PropertyKey>) => (value: Members[number]["Type"]) => keys.includes(value[tag])

    function process(schema: any) {
      const ast = schema.ast
      if (AST.isUnionType(ast)) {
        schema.members.forEach(process)
      } else if (AST.isTypeLiteral(ast)) {
        const value = getTag(tag, ast)
        if (value) {
          cases[value] = schema
          guards[value] = is(typeCodec(schema))
        }
      } else {
        throw new Error("No literal found")
      }
    }

    process(self)

    function match() {
      if (arguments.length === 1) {
        const cases = arguments[0]
        return function(value: any) {
          return cases[value[tag]](value)
        }
      }
      const value = arguments[0]
      const cases = arguments[1]
      return cases[value[tag]](value)
    }

    return Object.assign(self, { cases, isAnyOf, guards, match }) as any
  }
}

/**
 * @since 4.0.0
 * @experimental
 */
export interface TaggedUnion<Cases extends Record<string, Top>> extends
  Bottom<
    { [K in keyof Cases]: Cases[K]["Type"] }[keyof Cases],
    { [K in keyof Cases]: Cases[K]["Encoded"] }[keyof Cases],
    { [K in keyof Cases]: Cases[K]["DecodingServices"] }[keyof Cases],
    { [K in keyof Cases]: Cases[K]["EncodingServices"] }[keyof Cases],
    AST.UnionType<AST.TypeLiteral>,
    TaggedUnion<Cases>,
    Annotations.Bottom<{ [K in keyof Cases]: Cases[K]["Type"] }[keyof Cases]>,
    { [K in keyof Cases]: Cases[K]["~type.make"] }[keyof Cases]
  >
{
  readonly cases: Cases
  readonly isAnyOf: <const Keys>(
    keys: ReadonlyArray<Keys>
  ) => (value: Cases[keyof Cases]["Type"]) => value is Extract<Cases[keyof Cases]["Type"], { _tag: Keys }>
  readonly guards: { [K in keyof Cases]: (u: unknown) => u is Cases[K]["Type"] }
  readonly match: {
    <Output>(
      value: Cases[keyof Cases]["Type"],
      cases: { [K in keyof Cases]: (value: Cases[K]["Type"]) => Output }
    ): Output
    <Output>(
      cases: { [K in keyof Cases]: (value: Cases[K]["Type"]) => Output }
    ): (value: Cases[keyof Cases]["Type"]) => Output
  }
}

class TaggedUnion$<Cases extends Record<string, Top>> extends make$<TaggedUnion<Cases>> implements TaggedUnion<Cases> {
  constructor(
    readonly ast: AST.UnionType<AST.TypeLiteral>,
    readonly cases: Cases,
    readonly isAnyOf: <const Keys>(
      keys: ReadonlyArray<Keys>
    ) => (value: Cases[keyof Cases]["Type"]) => value is Extract<Cases[keyof Cases]["Type"], { _tag: Keys }>,
    readonly guards: { [K in keyof Cases]: (u: unknown) => u is Cases[K]["Type"] },
    readonly match: {
      <Output>(
        value: Cases[keyof Cases]["Type"],
        cases: { [K in keyof Cases]: (value: Cases[K]["Type"]) => Output }
      ): Output
      <Output>(
        cases: { [K in keyof Cases]: (value: Cases[K]["Type"]) => Output }
      ): (value: Cases[keyof Cases]["Type"]) => Output
    }
  ) {
    super(ast, (ast) => new TaggedUnion$(ast, cases, isAnyOf, guards, match))
  }
}

/**
 * @since 4.0.0
 * @experimental
 */
export function TaggedUnion<const CasesByTag extends Record<string, Struct.Fields>>(
  casesByTag: CasesByTag
): TaggedUnion<{ readonly [K in keyof CasesByTag & string]: TaggedStruct<K, CasesByTag[K]> }> {
  const cases: any = {}
  const members: any = []
  for (const key of Object.keys(casesByTag)) {
    members.push(cases[key] = TaggedStruct(key, casesByTag[key]))
  }
  const union = Union(members)
  const { guards, isAnyOf, match } = asTaggedUnion("_tag")(union)
  return new TaggedUnion$(union.ast, cases, isAnyOf, guards, match) as any
}

/**
 * @since 4.0.0
 */
export interface Option<S extends Top> extends declare<O.Option<S["Type"]>, O.Option<S["Encoded"]>, readonly [S]> {
  readonly "~rebuild.out": Option<S>
}

/**
 * @category Constructors
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
 * A schema for non-empty strings. Validates that a string has at least one
 * character.
 *
 * @since 4.0.0
 */
export const NonEmptyString = String.check(Check.nonEmpty())

/**
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
 * Creates a schema that validates a Map where keys and values must conform to
 * the provided schemas.
 *
 * @category Constructors
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
 * @since 4.0.0
 */
export interface instanceOf<T> extends declare<T, T, readonly []> {
  readonly "~rebuild.out": instanceOf<T>
}

/**
 * Creates a schema that validates an instance of a specific class constructor.
 *
 * @category Constructors
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
 * A schema for JavaScript `URL` objects.
 *
 * @since 4.0.0
 */
export const URL = instanceOf({
  constructor: globalThis.URL,
  annotations: {
    title: "URL",
    defaultJsonSerializer: () =>
      link<URL>()(
        String,
        Transformation.transformOrFail({
          decode: (s) =>
            Effect.try({
              try: () => new globalThis.URL(s),
              catch: (error) => new Issue.InvalidValue(O.some(s), { cause: error })
            }),
          encode: (url) => Effect.succeed(url.toString())
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
 * @since 4.0.0
 */
export interface Date extends instanceOf<globalThis.Date> {
  readonly "~rebuild.out": Date
}

/**
 * A schema for JavaScript `Date` objects.
 *
 * This schema accepts any `Date` instance, including invalid dates (e.g., `new
 * Date("invalid")`). For validating only valid dates, use `ValidDate` instead.
 *
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
 * @since 4.0.0
 */
export interface ValidDate extends Date {
  readonly "~rebuild.out": ValidDate
}

/**
 * A schema for JavaScript `Date` objects that validates only valid dates.
 *
 * This schema accepts `Date` instances but rejects invalid dates (such as `new
 * Date("invalid")`).
 *
 * @since 4.0.0
 */
export const ValidDate = Date.check(Check.validDate())

/**
 * @since 4.0.0
 */
export interface UnknownFromJsonString extends decodeTo<Unknown, String, never, never> {
  readonly "~rebuild.out": UnknownFromJsonString
}

/**
 * A schema that decodes a JSON-encoded string into an `unknown` value.
 *
 * This schema takes a `string` as input and attempts to parse it as JSON during decoding.
 * If parsing succeeds, the result is passed along as an `unknown` value.
 * If the string is not valid JSON, decoding fails.
 *
 * When encoding, any value is converted back into a JSON string using `JSON.stringify`.
 * If the value is not a valid JSON value, encoding fails.
 *
 * **Example**
 *
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * Schema.decodeUnknownSync(Schema.UnknownFromJsonString)(`{"a":1,"b":2}`)
 * // => { a: 1, b: 2 }
 * ```
 *
 * @since 4.0.0
 */
export const UnknownFromJsonString: UnknownFromJsonString = String.pipe(
  decodeTo(Unknown, Transformation.unknownFromJsonString())
)

/**
 * @since 4.0.0
 */
export interface fromJsonString<S extends Top> extends decodeTo<S, UnknownFromJsonString, never, never> {
  readonly "~rebuild.out": fromJsonString<S>
}

/**
 * Returns a schema that decodes a JSON string and then decodes the parsed value using the given schema.
 *
 * This is useful when working with JSON-encoded strings where the actual structure
 * of the value is known and described by an existing schema.
 *
 * The resulting schema first parses the input string as JSON, and then runs the provided
 * schema on the parsed result.
 *
 * **Example**
 *
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.Struct({ a: Schema.Number })
 * const schemaFromJsonString = Schema.fromJsonString(schema)
 *
 * Schema.decodeUnknownSync(schemaFromJsonString)(`{"a":1,"b":2}`)
 * // => { a: 1 }
 * ```
 * @since 4.0.0
 */
export function fromJsonString<S extends Top>(schema: S): fromJsonString<S> {
  return UnknownFromJsonString.pipe(decodeTo(schema))
}

/**
 * @since 4.0.0
 */
export interface Finite extends Number {
  readonly "~rebuild.out": Finite
}

/**
 * A schema for finite numbers that validates and ensures the value is a finite number,
 * excluding `NaN`, `Infinity`, and `-Infinity`.
 *
 * @since 4.0.0
 */
export const Finite = Number.check(Check.finite())

/**
 * @since 4.0.0
 */
export interface FiniteFromString extends decodeTo<Number, String, never, never> {
  readonly "~rebuild.out": FiniteFromString
}

/**
 * A transformation schema that parses a string into a finite number, rejecting
 * `NaN`, `Infinity`, and `-Infinity` values.
 *
 * @since 4.0.0
 */
export const FiniteFromString: FiniteFromString = String.pipe(
  decodeTo(
    Finite,
    Transformation.numberFromString
  )
)

//
// Class APIs
//

/**
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
  readonly id: string
  readonly fields: S["fields"]
}

/**
 * Not all classes are extendable (e.g. `RequestClass`).
 *
 * @since 4.0.0
 */
export interface ExtendableClass<Self, S extends Top & { readonly fields: Struct.Fields }, Inherited>
  extends Class<Self, S, Inherited>
{
  readonly "~rebuild.out": ExtendableClass<Self, S, Self>
  extend<Extended>(
    id: string
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
  id: string,
  schema: S,
  annotations?: Annotations.Declaration<Self, readonly [S]>
): any {
  const computeAST = getComputeAST(schema.ast, { id, ...annotations })

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

    static readonly id = id
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
      id: string
    ): <NewFields extends Struct.Fields>(
      fields: NewFields,
      annotations?: Annotations.Declaration<Extended, readonly [Struct<Simplify<Merge<S["fields"], NewFields>>>]>
    ) => Class<Extended, Struct<Simplify<Merge<S["fields"], NewFields>>>, Self> {
      return (newFields, annotations) => {
        const fields = { ...schema.fields, ...newFields }
        const struct: any = new Struct$(AST.struct(fields, schema.ast.checks), fields)
        return makeClass(
          this,
          id,
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
            declaration: ([from]) => (t) => `${self.id}(${from(t)})`
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
 * @category Constructors
 * @since 4.0.0
 */
export const Class: {
  <Self, Brand = {}>(id: string): {
    <const Fields extends Struct.Fields>(
      fields: Fields,
      annotations?: Annotations.Declaration<Self, readonly [Struct<Fields>]>
    ): ExtendableClass<Self, Struct<Fields>, Brand>
    <S extends Struct<Struct.Fields>>(
      schema: S,
      annotations?: Annotations.Declaration<Self, readonly [S]>
    ): ExtendableClass<Self, S, Brand>
  }
} = <Self, Brand = {}>(id: string) =>
(
  schema: Struct.Fields | Struct<Struct.Fields>,
  annotations?: Annotations.Declaration<Self, readonly [Struct<Struct.Fields>]>
): ExtendableClass<Self, Struct<Struct.Fields>, Brand> => {
  const struct = isSchema(schema) ? schema : Struct(schema)

  return makeClass(
    Data.Class,
    id,
    struct,
    annotations
  )
}

/**
 * @since 4.0.0
 */
export interface ErrorClass<Self, S extends Top & { readonly fields: Struct.Fields }, Inherited>
  extends ExtendableClass<Self, S, Inherited>
{
  readonly "~rebuild.out": ErrorClass<Self, S, Self>
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export const ErrorClass: {
  <Self, Brand = {}>(id: string): {
    <const Fields extends Struct.Fields>(
      fields: Fields,
      annotations?: Annotations.Declaration<Self, readonly [Struct<Fields>]>
    ): ErrorClass<Self, Struct<Fields>, Cause.YieldableError & Brand>
    <S extends Struct<Struct.Fields>>(
      schema: S,
      annotations?: Annotations.Declaration<Self, readonly [S]>
    ): ErrorClass<Self, S, Cause.YieldableError & Brand>
  }
} = <Self, Brand = {}>(id: string) =>
(
  schema: Struct.Fields | Struct<Struct.Fields>,
  annotations?: Annotations.Declaration<Self, readonly [Struct<Struct.Fields>]>
): ErrorClass<Self, Struct<Struct.Fields>, Cause.YieldableError & Brand> => {
  const struct = isSchema(schema) ? schema : Struct(schema)

  return makeClass(
    core.Error,
    id,
    struct,
    annotations
  )
}

/**
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
 * @category Constructors
 * @since 4.0.0
 */
export const RequestClass =
  <Self, Brand = {}>(id: string) =>
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
      id,
      options.payload,
      options.annotations
    ) {
      static readonly payload = options.payload
      static readonly success = options.success
      static readonly error = options.error
    } as any
  }

/**
 * @category Constructors
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
 * @category Constructors
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
