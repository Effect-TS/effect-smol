/**
 * @since 4.0.0
 */

import type { StandardSchemaV1 } from "@standard-schema/spec"
import * as Request from "../batching/Request.ts"
import * as Cause_ from "../Cause.ts"
import * as Arr from "../collections/Array.ts"
import type { Brand } from "../data/Brand.ts"
import type * as Combiner from "../data/Combiner.ts"
import * as Data from "../data/Data.ts"
import * as Equivalence from "../data/Equivalence.ts"
import * as O from "../data/Option.ts"
import * as Predicate from "../data/Predicate.ts"
import * as R from "../data/Record.ts"
import * as Redacted_ from "../data/Redacted.ts"
import type { Lambda, Merge, Mutable, Simplify } from "../data/Struct.ts"
import { lambda, renameKeys } from "../data/Struct.ts"
import * as Effect from "../Effect.ts"
import * as Exit_ from "../Exit.ts"
import { identity } from "../Function.ts"
import * as Equal from "../interfaces/Equal.ts"
import { formatJson } from "../interfaces/Inspectable.ts"
import * as Pipeable from "../interfaces/Pipeable.ts"
import * as core from "../internal/core.ts"
import * as InternalEffect from "../internal/effect.ts"
import * as Scheduler from "../Scheduler.ts"
import * as DateTime from "../time/DateTime.ts"
import * as Duration_ from "../time/Duration.ts"
import * as Annotations from "./Annotations.ts"
import * as AST from "./AST.ts"
import * as Check from "./Check.ts"
import * as Getter from "./Getter.ts"
import * as Issue from "./Issue.ts"
import * as ToEquivalence from "./ToEquivalence.ts"
import type * as ToJsonSchema from "./ToJsonSchema.ts"
import * as ToParser from "./ToParser.ts"
import * as Transformation from "./Transformation.ts"

/**
 * Is this schema required or optional?
 *
 * @since 4.0.0
 */
export type Optionality = "required" | "optional"

/**
 * Is this schema read-only or mutable?
 *
 * @since 4.0.0
 */
export type Mutability = "readonly" | "mutable"

/**
 * Does the constructor of this schema supply a default value?
 *
 * @since 4.0.0
 */
export type ConstructorDefault = "no-default" | "with-default"

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
  Iso = T,
  TypeMake = TypeMakeIn,
  TypeMutability extends Mutability = "readonly",
  TypeOptionality extends Optionality = "required",
  TypeConstructorDefault extends ConstructorDefault = "no-default",
  EncodedMutability extends Mutability = "readonly",
  EncodedOptionality extends Optionality = "required"
> extends Pipeable.Pipeable {
  readonly [TypeId]: typeof TypeId

  readonly ast: Ast
  readonly "~rebuild.out": RebuildOut
  readonly "~annotate.in": AnnotateIn

  readonly "Type": T
  readonly "Encoded": E
  readonly "DecodingServices": RD
  readonly "EncodingServices": RE

  readonly "~type.make.in": TypeMakeIn
  readonly "~type.make": TypeMake
  readonly "~type.constructor.default": TypeConstructorDefault
  readonly "Iso": Iso

  readonly "~type.mutability": TypeMutability
  readonly "~type.optionality": TypeOptionality
  readonly "~encoded.mutability": EncodedMutability
  readonly "~encoded.optionality": EncodedOptionality

  annotate(annotations: this["~annotate.in"]): this["~rebuild.out"]
  annotateKey(annotations: Annotations.Key<this["Type"]>): this["~rebuild.out"]
  rebuild(ast: this["ast"]): this["~rebuild.out"]
  /**
   * @throws {Error} The issue is contained in the error cause.
   */
  makeSync(input: this["~type.make.in"], options?: MakeOptions): this["Type"]
  check(
    ...checks: readonly [
      Check.Check<this["Type"]>,
      ...Array<Check.Check<this["Type"]>>
    ]
  ): this["~rebuild.out"]
}

const TypeId = "~effect/schema/Schema"

abstract class BottomImpl<
  T,
  E,
  RD,
  RE,
  Ast extends AST.AST,
  RebuildOut extends Top,
  AnnotateIn extends Annotations.Annotations,
  TypeMakeIn = T,
  Iso = T,
  TypeMake = TypeMakeIn,
  TypeMutability extends Mutability = "readonly",
  TypeOptionality extends Optionality = "required",
  TypeConstructorDefault extends ConstructorDefault = "no-default",
  EncodedMutability extends Mutability = "readonly",
  EncodedOptionality extends Optionality = "required"
> extends Pipeable.Class implements
  Bottom<
    T,
    E,
    RD,
    RE,
    Ast,
    RebuildOut,
    AnnotateIn,
    TypeMakeIn,
    Iso,
    TypeMake,
    TypeMutability,
    TypeOptionality,
    TypeConstructorDefault,
    EncodedMutability,
    EncodedOptionality
  >
{
  readonly [TypeId] = TypeId

  declare readonly "Type": T
  declare readonly "Encoded": E
  declare readonly "DecodingServices": RD
  declare readonly "EncodingServices": RE

  declare readonly "~rebuild.out": RebuildOut
  declare readonly "~annotate.in": AnnotateIn

  declare readonly "~type.make.in": TypeMakeIn
  declare readonly "~type.make": TypeMake
  declare readonly "~type.constructor.default": TypeConstructorDefault
  declare readonly "Iso": Iso

  declare readonly "~type.mutability": TypeMutability
  declare readonly "~type.optionality": TypeOptionality
  declare readonly "~encoded.mutability": EncodedMutability
  declare readonly "~encoded.optionality": EncodedOptionality

  readonly ast: Ast
  readonly makeSync: (input: this["~type.make.in"], options?: MakeOptions) => this["Type"]

  constructor(ast: Ast) {
    super()
    this.ast = ast
    this.makeSync = ToParser.makeSync(this)
  }
  abstract rebuild(ast: this["ast"]): this["~rebuild.out"]
  annotate(annotations: this["~annotate.in"]): this["~rebuild.out"] {
    return this.rebuild(AST.annotate(this.ast, annotations))
  }
  annotateKey(annotations: Annotations.Key<this["Type"]>): this["~rebuild.out"] {
    return this.rebuild(AST.annotateKey(this.ast, annotations))
  }
  check(
    ...checks: readonly [
      Check.Check<this["Type"]>,
      ...Array<Check.Check<this["Type"]>>
    ]
  ): this["~rebuild.out"] {
    return this.rebuild(AST.appendChecks(this.ast, checks))
  }
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
  S["Iso"],
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
export function annotateKey<S extends Top>(annotations: Annotations.Key<S["Type"]>) {
  return (self: S): S["~rebuild.out"] => {
    return self.rebuild(AST.annotateKey(self.ast, annotations))
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
export interface Optic<out T, out Iso> extends Schema<T> {
  readonly "Iso": Iso
  readonly "DecodingServices": never
  readonly "EncodingServices": never
  readonly "~rebuild.out": Optic<T, Iso>
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
 * A `SchemaError` is returned when schema decoding or encoding fails.
 *
 * This error extends `Data.TaggedError` and contains detailed information about
 * what went wrong during schema processing. The error includes an `issue` field
 * that provides comprehensive details about the validation failure, including
 * the path to the problematic data, expected types, and actual values.
 *
 * @since 4.0.0
 */
export class SchemaError {
  constructor(issue: Issue.Issue) {
    this.issue = issue
  }
  /**
   * @since 4.0.0
   */
  readonly _tag = "SchemaError"
  /**
   * @since 4.0.0
   */
  readonly name: string = "SchemaError"
  /**
   * @since 4.0.0
   */
  readonly issue: Issue.Issue
  /**
   * @since 4.0.0
   */
  get message() {
    return this.issue.toString()
  }
  /**
   * @since 4.0.0
   */
  toString() {
    return `SchemaError(${this.message})`
  }
}

function makeStandardResult<A>(exit: Exit_.Exit<StandardSchemaV1.Result<A>>): StandardSchemaV1.Result<A> {
  return Exit_.isSuccess(exit) ? exit.value : {
    issues: [{ message: Cause_.pretty(exit.cause) }]
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
 * // Create a standard schema from a regular schema
 * const PersonSchema = Schema.Struct({
 *   name: Schema.NonEmptyString,
 *   age: Schema.Number.pipe(Schema.check(Check.between(0, 150)))
 * })
 *
 * const standardSchema = Schema.asStandardSchemaV1(PersonSchema, {
 *   leafHook
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
export const asStandardSchemaV1 = <S extends Top>(
  self: S,
  options?: {
    readonly leafHook?: Issue.LeafHook | undefined
    readonly checkHook?: Issue.CheckHook | undefined
    readonly parseOptions?: AST.ParseOptions | undefined
  }
): StandardSchemaV1<S["Encoded"], S["Type"]> & S => {
  const decodeUnknownEffect = ToParser.decodeUnknownEffect(self) as (
    input: unknown,
    options?: AST.ParseOptions
  ) => Effect.Effect<S["Type"], Issue.Issue>
  const parseOptions: AST.ParseOptions = { errors: "all", ...options?.parseOptions }
  const formatter = Issue.makeStandardSchemaV1(options)
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
        const exit = fiber.pollUnsafe()
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
    return Effect.mapErrorEager(parser(input, options), (issue) => new SchemaError(issue))
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
export function decodeUnknownExit<T, E, RE>(codec: Codec<T, E, never, RE>) {
  const parser = ToParser.decodeUnknownExit(codec)
  return (input: unknown, options?: AST.ParseOptions): Exit_.Exit<T, SchemaError> => {
    return Exit_.mapError(parser(input, options), (issue) => new SchemaError(issue))
  }
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeExit: <T, E, RE>(
  codec: Codec<T, E, never, RE>
) => (input: E, options?: AST.ParseOptions) => Exit_.Exit<T, SchemaError> = decodeUnknownExit

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
    return Effect.mapErrorEager(parser(input, options), (issue) => new SchemaError(issue))
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
export function encodeUnknownExit<T, E, RD>(codec: Codec<T, E, RD, never>) {
  const parser = ToParser.encodeUnknownExit(codec)
  return (input: unknown, options?: AST.ParseOptions): Exit_.Exit<E, SchemaError> => {
    return Exit_.mapError(parser(input, options), (issue) => new SchemaError(issue))
  }
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeExit: <T, E, RD>(
  codec: Codec<T, E, RD, never>
) => (input: T, options?: AST.ParseOptions) => Exit_.Exit<E, SchemaError> = encodeUnknownExit

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

class make$<S extends Top> extends BottomImpl<
  S["Type"],
  S["Encoded"],
  S["DecodingServices"],
  S["EncodingServices"],
  S["ast"],
  S["~rebuild.out"],
  S["~annotate.in"],
  S["~type.make.in"],
  S["Iso"],
  S["~type.make"],
  S["~type.mutability"],
  S["~type.optionality"],
  S["~type.constructor.default"],
  S["~encoded.mutability"],
  S["~encoded.optionality"]
> {
  readonly rebuild: (ast: S["ast"]) => S["~rebuild.out"]

  constructor(
    ast: S["ast"],
    rebuild: (ast: S["ast"]) => S["~rebuild.out"]
  ) {
    super(ast)
    this.rebuild = rebuild
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
  S["Iso"],
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
    S["Iso"],
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

class makeWithSchema$<S extends Top, Result extends Top> extends make$<Result> {
  readonly schema: S

  constructor(ast: AST.AST, schema: S) {
    super(ast, (ast) => new makeWithSchema$(ast, schema))
    this.schema = schema
  }
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
    S["Iso"],
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
    S["Iso"],
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

const FlipTypeId = "~effect/schema/Schema/flip$"

class flip$<S extends Top> extends makeWithSchema$<S, flip<S>> implements flip<S> {
  readonly [FlipTypeId] = FlipTypeId
}

function isFlip$(schema: Top): schema is flip<any> {
  return Predicate.hasProperty(schema, FlipTypeId) && schema[FlipTypeId] === FlipTypeId
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
export interface Literal<L extends AST.Literal>
  extends Bottom<L, L, never, never, AST.LiteralType, Literal<L>, Annotations.Annotations>
{
  readonly literal: L
}

class Literal$<L extends AST.Literal> extends make$<Literal<L>> implements Literal<L> {
  readonly literal: L

  constructor(ast: AST.LiteralType, literal: L) {
    super(ast, (ast) => new Literal$(ast, literal))
    this.literal = literal
  }
}

/**
 * @see {@link Literals} for a schema that represents a union of literals.
 * @see {@link tag} for a schema that represents a literal value that can be
 * used as a discriminator field in tagged unions and has a constructor default.
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
  export type LiteralPart = string | number | bigint

  /**
   * @since 4.0.0
   */
  export type Part = SchemaPart | LiteralPart

  /**
   * @since 4.0.0
   */
  export type Parts = ReadonlyArray<Part>

  type AppendType<
    Template extends string,
    Next
  > = Next extends LiteralPart ? `${Template}${Next}`
    : Next extends Codec<unknown, infer E extends LiteralPart, unknown, unknown> ? `${Template}${E}`
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
  readonly parts: Parts

  constructor(ast: AST.TemplateLiteral, parts: Parts) {
    super(ast, (ast) => new TemplateLiteral$(ast, parts))
    this.parts = parts
  }
}

function templateLiteralFromParts<Parts extends TemplateLiteral.Parts>(parts: Parts) {
  return new AST.TemplateLiteral(parts.map((part) => isSchema(part) ? part.ast : new AST.LiteralType(part)))
}

/**
 * @since 4.0.0
 */
export function TemplateLiteral<const Parts extends TemplateLiteral.Parts>(parts: Parts): TemplateLiteral<Parts> {
  return new TemplateLiteral$(templateLiteralFromParts(parts), [...parts] as Parts)
}

/**
 * @since 4.0.0
 */
export declare namespace TemplateLiteralParser {
  /**
   * @since 4.0.0
   */
  export type Type<Parts> = Parts extends readonly [infer Head, ...infer Tail] ? readonly [
      Head extends TemplateLiteral.LiteralPart ? Head :
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
  readonly parts: Parts

  constructor(ast: AST.TupleType, parts: Parts) {
    super(ast, (ast) => new TemplateLiteralParser$(ast, parts))
    this.parts = parts
  }
}

/**
 * @since 4.0.0
 */
export function TemplateLiteralParser<const Parts extends TemplateLiteral.Parts>(
  parts: Parts
): TemplateLiteralParser<Parts> {
  return new TemplateLiteralParser$(templateLiteralFromParts(parts).asTemplateLiteralParser(), [...parts] as Parts)
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
  readonly enums: A

  constructor(ast: AST.Enums, enums: A) {
    super(ast, (ast) => new Enums$(ast, enums))
    this.enums = enums
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
 * A schema for all strings.
 *
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
 * A schema for all numbers, including `NaN`, `Infinity`, and `-Infinity`.
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
 * A schema for all booleans.
 *
 * @category Boolean
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
 * A schema for all symbols.
 *
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
 * A schema for all bigints.
 *
 * @since 4.0.0
 */
export const BigInt: BigInt = make<BigInt>(AST.bigIntKeyword)

/**
 * @since 4.0.0
 */
export interface Void extends Bottom<void, void, never, never, AST.VoidKeyword, Void, Annotations.Bottom<void>> {}

/**
 * A schema for the `void` type.
 *
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
   * A schema for the `object` type.
   *
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
 * A schema for unique symbols.
 *
 * **Example**
 *
 * ```ts
 * import { Schema } from "effect/schema"
 * const a = Symbol.for("a")
 * const schema = Schema.UniqueSymbol(a)
 * ```
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
  export type Fields = { readonly [x: PropertyKey]: Top }

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

  type Iso_<
    F extends Fields,
    O extends keyof F = TypeOptionalKeys<F>,
    M extends keyof F = TypeMutableKeys<F>
  > =
    & { readonly [K in Exclude<keyof F, M | O>]: F[K]["Iso"] }
    & { readonly [K in Exclude<O, M>]?: F[K]["Iso"] }
    & { [K in Exclude<M, O>]: F[K]["Iso"] }
    & { [K in M & O]?: F[K]["Iso"] }

  /**
   * @since 4.0.0
   */
  export type Iso<F extends Fields> = Iso_<F>

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
    Simplify<Struct.MakeIn<Fields>>,
    Simplify<Struct.Iso<Fields>>
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
    >
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
  ): decodeTo<Struct<Simplify<{ [K in keyof S["fields"]]: typeCodec<S["fields"][K]> } & Fields>>, S> => {
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
    readonly "Iso": PropertyKey
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
  export type Iso<Key extends Record.Key, Value extends Top> = Value extends
    { readonly "~type.optionality": "optional" } ?
    Value extends { readonly "~type.mutability": "mutable" } ? { [P in Key["Iso"]]?: Value["Iso"] }
    : { readonly [P in Key["Iso"]]?: Value["Iso"] }
    : Value extends { readonly "~type.mutability": "mutable" } ? { [P in Key["Iso"]]: Value["Iso"] }
    : { readonly [P in Key["Iso"]]: Value["Iso"] }

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
    Simplify<Record.MakeIn<Key, Value>>,
    Record.Iso<Key, Value>
  >
{
  readonly key: Key
  readonly value: Value
}

class Record$$<Key extends Record.Key, Value extends Top> extends make$<Record$<Key, Value>>
  implements Record$<Key, Value>
{
  readonly key: Key
  readonly value: Value

  constructor(ast: AST.TypeLiteral, key: Key, value: Value) {
    super(ast, (ast) => new Record$$(ast, key, value))
    this.key = key
    this.value = value
  }
}

/**
 * @since 4.0.0
 */
export function Record<Key extends Record.Key, Value extends Top>(
  key: Key,
  value: Value,
  options?: {
    readonly keyValueCombiner: {
      readonly decode?: Combiner.Combiner<readonly [Key["Type"], Value["Type"]]> | undefined
      readonly encode?: Combiner.Combiner<readonly [Key["Encoded"], Value["Encoded"]]> | undefined
    }
  }
): Record$<Key, Value> {
  const keyValueCombiner = options?.keyValueCombiner?.decode || options?.keyValueCombiner?.encode
    ? new AST.KeyValueCombiner(options.keyValueCombiner.decode, options.keyValueCombiner.encode)
    : undefined
  return new Record$$(AST.record(key.ast, value.ast, keyValueCombiner), key, value)
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
  export type Iso<S extends TypeLiteral, Records extends StructWithRest.Records> =
    & S["Iso"]
    & MergeTuple<{ readonly [K in keyof Records]: Records[K]["Iso"] }>

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
    Simplify<StructWithRest.MakeIn<S, Records>>,
    Simplify<StructWithRest.Iso<S, Records>>
  >
{
  readonly schema: S
  readonly records: Records
}

class StructWithRest$$<S extends StructWithRest.TypeLiteral, Records extends StructWithRest.Records>
  extends make$<StructWithRest<S, Records>>
  implements StructWithRest<S, Records>
{
  readonly schema: S
  readonly records: Records

  constructor(ast: AST.TypeLiteral, schema: S, records: Records) {
    super(ast, (ast) => new StructWithRest$$(ast, this.schema, this.records))
    this.schema = schema
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
  export type Elements = ReadonlyArray<Top>

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

  type Iso_<
    Elements,
    Out extends ReadonlyArray<any> = readonly []
  > = Elements extends readonly [infer Head, ...infer Tail] ?
    Head extends { readonly "Iso": infer T } ?
      Head extends { readonly "~type.optionality": "optional" } ? Iso_<Tail, readonly [...Out, T?]>
      : Iso_<Tail, readonly [...Out, T]>
    : Out
    : Out

  /**
   * @since 4.0.0
   */
  export type Iso<E extends Elements> = Iso_<E>

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
    Tuple.MakeIn<Elements>,
    Tuple.Iso<Elements>
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
    readonly "Iso": ReadonlyArray<unknown>
  }

  /**
   * @since 4.0.0
   */
  export type Rest = readonly [Top, ...Array<Top>]

  /**
   * @since 4.0.0
   */
  export type Type<T extends ReadonlyArray<unknown>, Rest extends TupleWithRest.Rest> = Rest extends
    readonly [infer Head extends Top, ...infer Tail extends ReadonlyArray<Top>] ? Readonly<[
      ...T,
      ...Array<Head["Type"]>,
      ...{ readonly [K in keyof Tail]: Tail[K]["Type"] }
    ]> :
    T

  /**
   * @since 4.0.0
   */
  export type Iso<T extends ReadonlyArray<unknown>, Rest extends TupleWithRest.Rest> = Rest extends
    readonly [infer Head extends Top, ...infer Tail extends ReadonlyArray<Top>] ? Readonly<[
      ...T,
      ...Array<Head["Iso"]>,
      ...{ readonly [K in keyof Tail]: Tail[K]["Iso"] }
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
    TupleWithRest.MakeIn<S["~type.make"], Rest>,
    TupleWithRest.Iso<S["Iso"], Rest>
  >
{
  readonly schema: S
  readonly rest: Rest
}

class TupleWithRest$<S extends Tuple<Tuple.Elements> | mutable<Tuple<Tuple.Elements>>, Rest extends TupleWithRest.Rest>
  extends make$<TupleWithRest<S, Rest>>
{
  readonly schema: S
  readonly rest: Rest

  constructor(ast: AST.TupleType, schema: S, rest: Rest) {
    super(ast, (ast) => new TupleWithRest$(ast, this.schema, this.rest))
    this.schema = schema
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
    ReadonlyArray<S["~type.make"]>,
    ReadonlyArray<S["Iso"]>
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
    readonly [S["Encoded"], ...Array<S["Encoded"]>],
    S["DecodingServices"],
    S["EncodingServices"],
    AST.TupleType,
    NonEmptyArray<S>,
    Annotations.Bottom<readonly [S["Type"], ...Array<S["Type"]>]>,
    readonly [S["~type.make"], ...Array<S["~type.make"]>],
    readonly [S["Iso"], ...Array<S["Iso"]>]
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
    S["Iso"],
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
    S["Iso"],
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
    Members[number]["~type.make"],
    Members[number]["Iso"]
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
  override readonly ast: AST.UnionType<Members[number]["ast"]>
  readonly members: Members

  constructor(ast: AST.UnionType<Members[number]["ast"]>, members: Members) {
    super(ast, (ast) => new Union$(ast, members))
    this.ast = ast
    this.members = members
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

  pick<const L2 extends ReadonlyArray<L[number]>>(literals: L2): Literals<L2>
}

class Literals$<L extends ReadonlyArray<AST.Literal>> extends make$<Literals<L>> implements Literals<L> {
  readonly literals: L
  readonly members: { readonly [K in keyof L]: Literal<L[K]> }

  constructor(
    ast: AST.UnionType<AST.LiteralType>,
    literals: L,
    members: { readonly [K in keyof L]: Literal<L[K]> }
  ) {
    super(ast, (ast) => new Literals$(ast, literals, members))
    this.literals = literals
    this.members = members
  }

  mapMembers<To extends ReadonlyArray<Top>>(f: (members: this["members"]) => To): Union<Simplify<Readonly<To>>> {
    return Union(f(this.members))
  }

  pick<const L2 extends ReadonlyArray<L[number]>>(literals: L2): Literals<L2> {
    return Literals(literals)
  }
}

/**
 * @see {@link Literal} for a schema that represents a single literal.
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
    S["Iso"],
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
export function check<S extends Top>(...checks: readonly [Check.Check<S["Type"]>, ...Array<Check.Check<S["Type"]>>]) {
  return (self: S): S["~rebuild.out"] => self.check(...checks)
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
    Annotations.Bottom<T>,
    S["~type.make.in"],
    T,
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
export function refineByGuard<T extends S["Type"], S extends Top>(
  is: (value: S["Type"]) => value is T,
  annotations?: Annotations.Filter
) {
  return (self: S): refine<T, S["~rebuild.out"]> => {
    return self.pipe(refine(Check.makeRefineByGuard(is, annotations)))
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
    S["Iso"],
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
    S["Iso"],
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
export interface decodeTo<To extends Top, From extends Top, RD = never, RE = never> extends
  Bottom<
    To["Type"],
    From["Encoded"],
    To["DecodingServices"] | From["DecodingServices"] | RD,
    To["EncodingServices"] | From["EncodingServices"] | RE,
    To["ast"],
    decodeTo<To, From, RD, RE>,
    To["~annotate.in"],
    To["~type.make.in"],
    To["Iso"],
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
export interface compose<To extends Top, From extends Top> extends decodeTo<To, From> {}

class decodeTo$<To extends Top, From extends Top, RD, RE> extends make$<decodeTo<To, From, RD, RE>>
  implements decodeTo<To, From, RD, RE>
{
  override readonly ast: From["ast"]
  readonly from: From
  readonly to: To

  constructor(
    ast: From["ast"],
    from: From,
    to: To
  ) {
    super(ast, (ast) => new decodeTo$<To, From, RD, RE>(ast, from, to))
    this.ast = ast
    this.from = from
    this.to = to
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
): <From extends Top>(from: From) => decodeTo<From, To>
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
    S["Iso"],
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
export interface withDecodingDefaultKey<S extends Top> extends decodeTo<S, optionalKey<encodedCodec<S>>> {
  readonly "~rebuild.out": withDecodingDefaultKey<S>
}

/**
 * @since 4.0.0
 */
export type DecodingDefaultOptions = {
  readonly encodingStrategy?: "omit" | "passthrough" | undefined
}

/**
 * **Options**
 *
 * - `encodingStrategy`: The strategy to use when encoding.
 *   - `passthrough`: (default) Pass the default value through to the output.
 *   - `omit`: Omit the value from the output.
 *
 * @since 4.0.0
 */
export function withDecodingDefaultKey<S extends Top>(
  defaultValue: () => S["Encoded"],
  options?: DecodingDefaultOptions
) {
  const encode = options?.encodingStrategy === "omit" ? Getter.omit() : Getter.passthrough()
  return (self: S): withDecodingDefaultKey<S> => {
    return optionalKey(encodedCodec(self)).pipe(decodeTo(self, {
      decode: Getter.withDefault(defaultValue),
      encode
    }))
  }
}

/**
 * @since 4.0.0
 */
export interface withDecodingDefault<S extends Top> extends decodeTo<S, optional<encodedCodec<S>>> {
  readonly "~rebuild.out": withDecodingDefault<S>
}

/**
 * **Options**
 *
 * - `encodingStrategy`: The strategy to use when encoding.
 *   - `passthrough`: (default) Pass the default value through to the output.
 *   - `omit`: Omit the value from the output.
 *
 * @since 4.0.0
 */
export function withDecodingDefault<S extends Top>(
  defaultValue: () => S["Encoded"],
  options?: DecodingDefaultOptions
) {
  const encode = options?.encodingStrategy === "omit" ? Getter.omit() : Getter.passthrough()
  return (self: S): withDecodingDefault<S> => {
    return optional(encodedCodec(self)).pipe(decodeTo(self, {
      decode: Getter.withDefault(defaultValue),
      encode
    }))
  }
}

/**
 * @since 4.0.0
 */
export interface tag<Tag extends AST.Literal> extends withConstructorDefault<Literal<Tag>> {
  readonly "~rebuild.out": tag<Tag>
}

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
        throw new globalThis.Error("No literal found")
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
  override readonly ast: AST.UnionType<AST.TypeLiteral>
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

  constructor(
    ast: AST.UnionType<AST.TypeLiteral>,
    cases: Cases,
    isAnyOf: <const Keys>(
      keys: ReadonlyArray<Keys>
    ) => (value: Cases[keyof Cases]["Type"]) => value is Extract<Cases[keyof Cases]["Type"], { _tag: Keys }>,
    guards: { [K in keyof Cases]: (u: unknown) => u is Cases[K]["Type"] },
    match: {
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
    this.ast = ast
    this.cases = cases
    this.isAnyOf = isAnyOf
    this.guards = guards
    this.match = match
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
export interface Option<S extends Top> extends
  declareConstructor<
    O.Option<S["Type"]>,
    O.Option<S["Encoded"]>,
    readonly [S],
    { readonly _tag: "None" } | { readonly _tag: "Some"; readonly value: S["Iso"] }
  >
{
  readonly "~rebuild.out": Option<S>
}

/**
 * @category Option
 * @since 4.0.0
 */
export function Option<S extends Top>(value: S): Option<S> {
  return declareConstructor([value])<O.Option<S["Encoded"]>>()(
    ([value]) => (input, ast, options) => {
      if (O.isOption(input)) {
        if (O.isNone(input)) {
          return Effect.succeedNone
        }
        return ToParser.decodeUnknownEffect(value)(input.value, options).pipe(Effect.mapBothEager(
          {
            onSuccess: O.some,
            onFailure: (issue) => new Issue.Composite(ast, O.some(input), [new Issue.Pointer(["value"], issue)])
          }
        ))
      }
      return Effect.fail(new Issue.InvalidType(ast, O.some(input)))
    },
    {
      title: "Option",
      defaultIsoSerializer: ([value]) =>
        link<O.Option<S["Encoded"]>>()(
          Union([Struct({ _tag: Literal("Some"), value }), Struct({ _tag: Literal("None") })]),
          Transformation.transform({
            decode: (input) => input._tag === "None" ? O.none() : O.some(input.value),
            encode: (o) => (O.isSome(o) ? { _tag: "Some", value: o.value } as const : { _tag: "None" } as const)
          })
        ),
      arbitrary: {
        _tag: "Declaration",
        declaration: ([value]) => (fc, ctx) => {
          return fc.oneof(
            ctx?.isSuspend ? { maxDepth: 2, depthIdentifier: "Option" } : {},
            fc.constant(O.none()),
            value.map(O.some)
          )
        }
      },
      equivalence: {
        _tag: "Declaration",
        declaration: ([value]) => O.getEquivalence(value)
      },
      format: {
        _tag: "Declaration",
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
export interface OptionFromNullOr<S extends Top> extends decodeTo<Option<typeCodec<S>>, NullOr<S>> {
  readonly "~rebuild.out": OptionFromNullOr<S>
}

/**
 * Decodes a nullable, required value `T` to a required `Option<T>` value.
 *
 * Decoding:
 * - `null` is decoded as `None`
 * - other values are decoded as `Some`
 *
 * Encoding:
 * - `None` is encoded as `null`
 * - `Some` is encoded as the value
 *
 * @category Option
 * @since 4.0.0
 */
export function OptionFromNullOr<S extends Top>(schema: S): OptionFromNullOr<S> {
  return NullOr(schema).pipe(decodeTo(
    Option(typeCodec(schema)),
    Transformation.optionFromNullOr<any>()
  ))
}

/**
 * @since 4.0.0
 */
export interface OptionFromOptionalKey<S extends Top> extends decodeTo<Option<typeCodec<S>>, optionalKey<S>> {
  readonly "~rebuild.out": OptionFromOptionalKey<S>
}

/**
 * Decodes an optional value `A` to a required `Option<A>` value.
 *
 * Decoding:
 * - a missing key is decoded as `None`
 * - a present value is decoded as `Some`
 *
 * Encoding:
 * - `None` is encoded as missing key
 * - `Some` is encoded as the value
 *
 * @category Option
 * @since 4.0.0
 */
export function OptionFromOptionalKey<S extends Top>(schema: S): OptionFromOptionalKey<S> {
  return optionalKey(schema).pipe(decodeTo(
    Option(typeCodec(schema)),
    Transformation.optionFromOptionalKey()
  ))
}

/**
 * @since 4.0.0
 */
export interface OptionFromOptional<S extends Top> extends decodeTo<Option<typeCodec<S>>, optional<S>> {
  readonly "~rebuild.out": OptionFromOptional<S>
}

/**
 * Decodes an optional or `undefined` value `A` to an required `Option<A>`
 * value.
 *
 * Decoding:
 * - a missing key is decoded as `None`
 * - a present key with an `undefined` value is decoded as `None`
 * - all other values are decoded as `Some`
 *
 * Encoding:
 * - `None` is encoded as missing key
 * - `Some` is encoded as the value
 *
 * @category Option
 * @since 4.0.0
 */
export function OptionFromOptional<S extends Top>(schema: S): OptionFromOptional<S> {
  return optional(schema).pipe(decodeTo(
    Option(typeCodec(schema)),
    Transformation.optionFromOptional<any>()
  ))
}

/**
 * @since 4.0.0
 */
export interface Redacted<S extends Top>
  extends declareConstructor<Redacted_.Redacted<S["Type"]>, Redacted_.Redacted<S["Encoded"]>, readonly [S]>
{
  readonly "~rebuild.out": Redacted<S>
}

/**
 * Creates a schema for the `Redacted` type, providing secure handling of
 * sensitive information.
 *
 * If the wrapped schema fails, the issue will be redacted to prevent both
 * the actual value and the schema details from being exposed.
 *
 * **Options**
 *
 * - `label`: When provided, the schema will behave as follows:
 *   - Values will be validated against the label in addition to the wrapped schema
 *   - The default JSON serializer will deserialize into a `Redacted` instance with the label
 *   - The arbitrary generator will produce a `Redacted` instance with the label
 *   - The formatter will return the label
 *
 * **Default JSON serializer**
 *
 * The default JSON serializer will fail when attempting to serialize a `Redacted` value,
 * but it will deserialize a value into a `Redacted` instance.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function Redacted<S extends Top>(value: S, options?: {
  readonly label?: string | undefined
}): Redacted<S> {
  return declareConstructor([value])<Redacted_.Redacted<S["Encoded"]>>()(
    ([value]) => (input, ast, poptions) => {
      if (Redacted_.isRedacted(input)) {
        const label: Effect.Effect<void, Issue.Issue, never> = Predicate.isString(options?.label)
          ? Effect.mapErrorEager(
            ToParser.decodeUnknownEffect(Literal(options.label))(input.label, poptions),
            (issue) => new Issue.Pointer(["label"], issue)
          )
          : Effect.void
        return Effect.flatMapEager(
          label,
          () =>
            ToParser.decodeUnknownEffect(value)(Redacted_.value(input), poptions).pipe(Effect.mapBothEager(
              {
                onSuccess: () => input,
                onFailure: (/** ignore the actual issue because of security reasons */) => {
                  const oinput = O.some(input)
                  return new Issue.Composite(ast, oinput, [
                    new Issue.Pointer(["value"], new Issue.InvalidValue(oinput))
                  ])
                }
              }
            ))
        )
      }
      return Effect.fail(new Issue.InvalidType(ast, O.some(input)))
    },
    {
      title: "Redacted",
      defaultIsoSerializer: ([value]) =>
        link<Redacted_.Redacted<S["Encoded"]>>()(
          value,
          {
            decode: Getter.transform((e) => Redacted_.make(e, { label: options?.label })),
            encode: Getter.forbidden((oe) =>
              "Cannot serialize Redacted" +
              (O.isSome(oe) && Predicate.isString(oe.value.label) ? ` with label: "${oe.value.label}"` : "")
            )
          }
        ),
      arbitrary: {
        _tag: "Declaration",
        declaration: ([value]) => () => value.map((a) => Redacted_.make(a, { label: options?.label }))
      },
      format: {
        _tag: "Declaration",
        declaration: () => globalThis.String
      },
      equivalence: {
        _tag: "Declaration",
        declaration: ([value]) => Redacted_.getEquivalence(value)
      }
    }
  )
}

/**
 * @since 4.0.0
 */
export interface CauseFailure<E extends Top, D extends Top> extends
  declareConstructor<
    Cause_.Failure<E["Type"]>,
    Cause_.Failure<E["Encoded"]>,
    readonly [E, D],
    CauseFailureIso<E, D>
  >
{
  readonly "~rebuild.out": CauseFailure<E, D>
}

/**
 * @since 4.0.0
 */
export type CauseFailureIso<E extends Top, D extends Top> = {
  readonly _tag: "Fail"
  readonly error: E["Iso"]
} | {
  readonly _tag: "Die"
  readonly error: D["Iso"]
} | {
  readonly _tag: "Interrupt"
  readonly fiberId: number | undefined
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function CauseFailure<E extends Top, D extends Top>(error: E, defect: D): CauseFailure<E, D> {
  return declareConstructor([error, defect])<Cause_.Failure<E["Encoded"]>>()(
    ([error, defect]) => (input, ast, options): Effect.Effect<Cause_.Failure<E["Type"]>, Issue.Issue> => {
      if (!Cause_.isFailure(input)) {
        return Effect.fail(new Issue.InvalidType(ast, O.some(input)))
      }
      switch (input._tag) {
        case "Fail":
          return ToParser.decodeUnknownEffect(error)(input.error, options).pipe(Effect.mapBothEager(
            {
              onSuccess: Cause_.failureFail,
              onFailure: (issue) => new Issue.Composite(ast, O.some(input), [new Issue.Pointer(["error"], issue)])
            }
          ))
        case "Die":
          return ToParser.decodeUnknownEffect(defect)(input.defect, options).pipe(Effect.mapBothEager(
            {
              onSuccess: Cause_.failureDie,
              onFailure: (issue) => new Issue.Composite(ast, O.some(input), [new Issue.Pointer(["defect"], issue)])
            }
          ))
        case "Interrupt":
          return Effect.succeed(input)
      }
    },
    {
      title: "Cause.Failure",
      defaultIsoSerializer: ([error, defect]) =>
        link<Cause_.Failure<E["Encoded"]>>()(
          Union([
            TaggedStruct("Fail", { error }),
            TaggedStruct("Die", { defect }),
            TaggedStruct("Interrupt", { fiberId: UndefinedOr(Finite) })
          ]),
          Transformation.transform({
            decode: (input) => {
              switch (input._tag) {
                case "Fail":
                  return Cause_.failureFail(input.error)
                case "Die":
                  return Cause_.failureDie(input.defect)
                case "Interrupt":
                  return Cause_.failureInterrupt(input.fiberId)
              }
            },
            encode: identity
          })
        ),
      arbitrary: {
        _tag: "Declaration",
        declaration: ([error, defect]) => (fc, ctx) => {
          return fc.oneof(
            ctx?.isSuspend ? { maxDepth: 2, depthIdentifier: "Cause.Failure" } : {},
            fc.constant(Cause_.failureInterrupt()),
            fc.integer({ min: 1 }).map(Cause_.failureInterrupt),
            error.map((e) => Cause_.failureFail(e)),
            defect.map((d) => Cause_.failureDie(d))
          )
        }
      },
      equivalence: {
        _tag: "Declaration",
        declaration: ([error, defect]) => (a, b) => {
          if (a._tag !== b._tag) return false
          switch (a._tag) {
            case "Fail":
              return error(a.error, (b as Cause_.Fail<unknown>).error)
            case "Die":
              return defect(a.defect, (b as Cause_.Die).defect)
            case "Interrupt":
              return Equal.equals(a.fiberId, (b as Cause_.Interrupt).fiberId)
          }
        }
      },
      format: {
        _tag: "Declaration",
        declaration: ([error, defect]) => (t) => {
          switch (t._tag) {
            case "Fail":
              return `Fail(${error(t.error)})`
            case "Die":
              return `Die(${defect(t.defect)})`
            case "Interrupt":
              return "Interrupt"
          }
        }
      }
    }
  )
}

/**
 * @since 4.0.0
 */
export interface Cause<E extends Top, D extends Top> extends
  declareConstructor<
    Cause_.Cause<E["Type"]>,
    Cause_.Cause<E["Encoded"]>,
    readonly [CauseFailure<E, D>],
    CauseIso<E, D>
  >
{
  readonly "~rebuild.out": Cause<E, D>
}

/**
 * @since 4.0.0
 */
export type CauseIso<E extends Top, D extends Top> = ReadonlyArray<CauseFailureIso<E, D>>

/**
 * @category Constructors
 * @since 4.0.0
 */
export function Cause<E extends Top, D extends Top>(error: E, defect: D): Cause<E, D> {
  return declareConstructor([CauseFailure(error, defect)])<Cause_.Cause<E["Encoded"]>>()(
    ([failure]) => (input, ast, options) => {
      if (!Cause_.isCause(input)) {
        return Effect.fail(new Issue.InvalidType(ast, O.some(input)))
      }
      return ToParser.decodeUnknownEffect(Array(failure))(input.failures, options).pipe(Effect.mapBothEager(
        {
          onSuccess: Cause_.fromFailures,
          onFailure: (issue) => new Issue.Composite(ast, O.some(input), [new Issue.Pointer(["failures"], issue)])
        }
      ))
    },
    {
      title: "Cause",
      defaultIsoSerializer: ([failure]) =>
        link<Cause_.Cause<E["Encoded"]>>()(
          Array(failure),
          Transformation.transform({
            decode: (failures) => Cause_.fromFailures(failures),
            encode: ({ failures }) => failures
          })
        ),
      arbitrary: {
        _tag: "Declaration",
        declaration: ([failure]) => (fc, ctx) =>
          fc.array(failure, ctx?.constraints?.ArrayConstraints).map((failures) => Cause_.fromFailures(failures))
      },
      equivalence: {
        _tag: "Declaration",
        declaration: ([failure]) => (a, b) => Arr.getEquivalence(failure)(a.failures, b.failures)
      },
      format: {
        _tag: "Declaration",
        declaration: ([failure]) => (t) => {
          return `Cause([${t.failures.map((f) => failure(f)).join(", ")}])`
        }
      }
    }
  )
}

/**
 * @since 4.0.0
 */
export interface Error extends instanceOf<globalThis.Error> {
  readonly "~rebuild.out": Error
}

const ErrorJsonEncoded = Struct({
  message: String,
  name: optionalKey(String),
  stack: optionalKey(String)
})

/**
 * A schema that represents `Error` objects.
 *
 * The default json serializer decodes to a struct with `name` and `message`
 * properties (stack is omitted for security).
 *
 * @category Schemas
 * @since 4.0.0
 */
export const Error: Error = instanceOf(globalThis.Error, {
  title: "Error",
  defaultJsonSerializer: () =>
    link<globalThis.Error>()(
      ErrorJsonEncoded,
      Transformation.error()
    )
})

/**
 * @since 4.0.0
 */
export interface Defect extends
  Union<
    readonly [
      String,
      decodeTo<
        Error,
        Struct<{
          readonly message: String
          readonly name: optionalKey<String>
          readonly stack: optionalKey<String>
        }>
      >,
      decodeTo<Unknown, String>
    ]
  >
{
  readonly "~rebuild.out": Defect
}

/**
 * A schema that represents defects.
 *
 * This schema can handle both string-based error messages and structured Error objects.
 *
 * When encoding:
 * - A string returns the string as-is
 * - An Error object returns a struct with `name` and `message` properties (stack is omitted for security)
 * - Other values are converted to their string representation:
 *   - if the value has a custom `toString` method, it will be called
 *   - otherwise, the value will be converted to a string using `JSON.stringify`
 *
 * When decoding:
 * - A string input returns the string as-is
 * - A struct with `message`, `name`, and `stack` properties is converted to an Error object
 *
 * @category Constructors
 * @since 4.0.0
 */
export const Defect: Defect = Union([
  String,
  // error from struct
  ErrorJsonEncoded.pipe(decodeTo(Error, Transformation.error())),
  // unknown from string
  String.pipe(decodeTo(
    Unknown,
    {
      decode: Getter.passthrough(),
      encode: Getter.transform((a) => {
        if (Predicate.isRecord(a)) return InternalEffect.causePrettyMessage(a)
        return formatJson(a)
      })
    }
  ))
])

/**
 * @since 4.0.0
 */
export interface Exit<A extends Top, E extends Top, D extends Top> extends
  declareConstructor<
    Exit_.Exit<A["Type"], E["Type"]>,
    Exit_.Exit<A["Encoded"], E["Encoded"]>,
    readonly [A, Cause<E, D>],
    ExitIso<A, E, D>
  >
{
  readonly "~rebuild.out": Exit<A, E, D>
}

/**
 * @since 4.0.0
 */
export type ExitIso<A extends Top, E extends Top, D extends Top> = {
  readonly _tag: "Success"
  readonly value: A["Iso"]
} | {
  readonly _tag: "Failure"
  readonly cause: CauseIso<E, D>
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function Exit<A extends Top, E extends Top, D extends Top>(value: A, error: E, defect: D): Exit<A, E, D> {
  return declareConstructor([value, Cause(error, defect)])<Exit_.Exit<A["Encoded"], E["Encoded"]>>()(
    ([value, cause]) => (input, ast, options): Effect.Effect<Exit_.Exit<A["Type"], E["Type"]>, Issue.Issue> => {
      if (!Exit_.isExit(input)) {
        return Effect.fail(new Issue.InvalidType(ast, O.some(input)))
      }
      switch (input._tag) {
        case "Success":
          return ToParser.decodeUnknownEffect(value)(input.value, options).pipe(Effect.mapBothEager(
            {
              onSuccess: Exit_.succeed,
              onFailure: (issue) => new Issue.Composite(ast, O.some(input), [new Issue.Pointer(["value"], issue)])
            }
          ))
        case "Failure":
          return ToParser.decodeUnknownEffect(cause)(input.cause, options).pipe(Effect.mapBothEager(
            {
              onSuccess: Exit_.failCause,
              onFailure: (issue) => new Issue.Composite(ast, O.some(input), [new Issue.Pointer(["cause"], issue)])
            }
          ))
      }
    },
    {
      title: "Exit",
      defaultIsoSerializer: ([value, cause]) =>
        link<Exit_.Exit<A["Encoded"], E["Encoded"]>>()(
          Union([
            TaggedStruct("Success", { value }),
            TaggedStruct("Failure", { cause })
          ]),
          Transformation.transform({
            decode: (encoded): Exit_.Exit<A["Encoded"], E["Encoded"]> =>
              encoded._tag === "Success" ? Exit_.succeed(encoded.value) : Exit_.failCause(encoded.cause),
            encode: (exit) =>
              Exit_.isSuccess(exit)
                ? { _tag: "Success", value: exit.value } as const
                : { _tag: "Failure", cause: exit.cause } as const
          })
        ),
      arbitrary: {
        _tag: "Declaration",
        declaration: ([value, cause]) => (fc, ctx) =>
          fc.oneof(
            ctx?.isSuspend ? { maxDepth: 2, depthIdentifier: "Exit" } : {},
            value.map((v) => Exit_.succeed(v)),
            cause.map((cause) => Exit_.failCause(cause))
          )
      },
      equivalence: {
        _tag: "Declaration",
        declaration: ([value, cause]) => (a, b) => {
          if (a._tag !== b._tag) return false
          switch (a._tag) {
            case "Success":
              return value(a.value, (b as Exit_.Success<A["Type"]>).value)
            case "Failure":
              return cause(a.cause, (b as Exit_.Failure<E["Type"], D["Type"]>).cause)
          }
        }
      },
      format: {
        _tag: "Declaration",
        declaration: ([value, cause]) => (t) => {
          switch (t._tag) {
            case "Success":
              return `Exit.Success(${value(t.value)})`
            case "Failure":
              return `Exit.Failure(${cause(t.cause)})`
          }
        }
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
 * A schema representing a single character.
 *
 * @since 4.0.0
 */
export const Char = String.check(Check.length(1))

/**
 * @since 4.0.0
 */
export interface Map$<Key extends Top, Value extends Top> extends
  declareConstructor<
    globalThis.Map<Key["Type"], Value["Type"]>,
    globalThis.Map<Key["Encoded"], Value["Encoded"]>,
    readonly [Key, Value],
    ReadonlyArray<readonly [Key["Iso"], Value["Iso"]]>
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
  return declareConstructor([key, value])<globalThis.Map<Key["Encoded"], Value["Encoded"]>>()(
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
      defaultIsoSerializer: ([key, value]) =>
        link<globalThis.Map<Key["Encoded"], Value["Encoded"]>>()(
          Array(Tuple([key, value])),
          Transformation.transform({
            decode: (entries) => new globalThis.Map(entries),
            encode: (map) => [...map.entries()]
          })
        ),
      arbitrary: {
        _tag: "Declaration",
        declaration: ([key, value]) => (fc, ctx) => {
          return fc.oneof(
            ctx?.isSuspend ? { maxDepth: 2, depthIdentifier: "Map" } : {},
            fc.constant([]),
            fc.array(fc.tuple(key, value), ctx?.constraints?.ArrayConstraints)
          ).map((as) => new globalThis.Map(as))
        }
      },
      equivalence: {
        _tag: "Declaration",
        declaration: ([key, value]) => {
          const entries = Arr.getEquivalence(
            Equivalence.make<[Key["Type"], Value["Type"]]>(([ka, va], [kb, vb]) => key(ka, kb) && value(va, vb))
          )
          return Equivalence.make((a, b) =>
            entries(globalThis.Array.from(a.entries()).sort(), globalThis.Array.from(b.entries()).sort())
          )
        }
      },
      format: {
        _tag: "Declaration",
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
export interface Opaque<Self, S extends Top, Brand> extends
  Bottom<
    Self,
    S["Encoded"],
    S["DecodingServices"],
    S["EncodingServices"],
    S["ast"],
    S["~rebuild.out"],
    S["~annotate.in"],
    S["~type.make.in"],
    S["Iso"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  new(_: never): S["Type"] & Brand
}

/**
 * @since 4.0.0
 */
export function Opaque<Self, Brand = {}>() {
  return <S extends Top>(schema: S): Opaque<Self, S, Brand> & Omit<S, "Type" | "Encoded"> => {
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    class Opaque {}
    Object.setPrototypeOf(Opaque, schema)
    return Opaque as any
  }
}

/**
 * @since 4.0.0
 */
export interface instanceOf<T, Iso = T> extends declareConstructor<T, T, readonly [], Iso> {
  readonly "~rebuild.out": instanceOf<T, Iso>
}

/**
 * Creates a schema that validates an instance of a specific class constructor.
 *
 * It is recommended to add the `defaultJsonSerializer` annotation to the schema.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function instanceOf<C extends abstract new(...args: any) => any, Iso = InstanceType<C>>(
  constructor: C,
  annotations?: Annotations.Declaration<InstanceType<C>, readonly []> | undefined
): instanceOf<InstanceType<C>, Iso> {
  return declare((u): u is InstanceType<C> => u instanceof constructor, annotations)
}

/**
 * @since 4.0.0
 * @experimental
 */
export function link<T>() { // TODO: better name
  return <To extends Top>(
    encodeTo: To,
    transformation: {
      readonly decode: Getter.Getter<T, NoInfer<To["Type"]>>
      readonly encode: Getter.Getter<NoInfer<To["Type"]>, T>
    }
  ): AST.Link => {
    return new AST.Link(encodeTo.ast, Transformation.make(transformation))
  }
}

/**
 * @since 4.0.0
 */
export interface URL extends instanceOf<globalThis.URL> {
  readonly "~rebuild.out": URL
}

/**
 * A schema for JavaScript `URL` objects.
 *
 * **Default JSON serializer**
 * - encodes `URL` as a `string`.
 *
 * @since 4.0.0
 */
export const URL: URL = instanceOf(
  globalThis.URL,
  {
    title: "URL",
    defaultJsonSerializer: () =>
      link<globalThis.URL>()(
        String,
        Transformation.transformOrFail({
          decode: (s) =>
            Effect.try({
              try: () => new globalThis.URL(s),
              catch: (e) => new Issue.InvalidValue(O.some(s), { message: globalThis.String(e) })
            }),
          encode: (url) => Effect.succeed(url.toString())
        })
      ),
    arbitrary: {
      _tag: "Declaration",
      declaration: () => (fc) => fc.webUrl().map((s) => new globalThis.URL(s))
    },
    equivalence: {
      _tag: "Declaration",
      declaration: () => (a, b) => a.toString() === b.toString()
    }
  }
)

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
export const Date: Date = instanceOf(
  globalThis.Date,
  {
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
      _tag: "Declaration",
      declaration: () => (fc, ctx) => fc.date(ctx?.constraints?.DateConstraints)
    }
  }
)

/**
 * @since 4.0.0
 */
export interface ValidDate extends Date {
  readonly "~rebuild.out": ValidDate
}

/**
 * A schema for **valid** JavaScript `Date` objects.
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
export interface Duration extends declare<Duration_.Duration> {
  readonly "~rebuild.out": Duration
}

/**
 * A schema for `Duration` values.
 *
 * **Default JSON serializer**
 * - encodes `Duration` as a `string`
 *
 * @since 4.0.0
 */
export const Duration: Duration = declare(
  Duration_.isDuration,
  {
    title: "Duration",
    defaultJsonSerializer: () =>
      link<Duration_.Duration>()(
        Union([Number, BigInt, Literal("Infinity")]),
        Transformation.transform({
          decode: (value) => {
            if (value === "Infinity") return Duration_.infinity
            if (Predicate.isBigInt(value)) return Duration_.nanos(value)
            return Duration_.millis(value)
          },
          encode: (duration) => {
            switch (duration.value._tag) {
              case "Infinity":
                return "Infinity"
              case "Nanos":
                return duration.value.nanos
              case "Millis":
                return duration.value.millis
            }
          }
        })
      ),
    arbitrary: {
      _tag: "Declaration",
      declaration: () => (fc) =>
        fc.oneof(
          fc.constant(Duration_.infinity),
          fc.bigInt({ min: 0n }).map(Duration_.nanos),
          fc.maxSafeNat().map(Duration_.millis)
        )
    },
    format: {
      _tag: "Declaration",
      declaration: () => globalThis.String
    },
    equivalence: {
      _tag: "Declaration",
      declaration: () => Duration_.Equivalence
    }
  }
)

/**
 * @since 4.0.0
 */
export interface UnknownFromJsonString extends decodeTo<Unknown, String> {
  readonly "~rebuild.out": UnknownFromJsonString
}

/**
 * A transformation schema that decodes a JSON-encoded string into an `unknown` value.
 *
 * Decoding:
 * - A `string` is decoded as an `unknown` value.
 * - If the string is not valid JSON, decoding fails.
 *
 * Encoding:
 * - Any value is encoded as a JSON string using `JSON.stringify`.
 * - If the value is not a valid JSON value, encoding fails.
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
export const UnknownFromJsonString: UnknownFromJsonString = String.annotate({
  description: "a string that will be decoded as JSON"
}).pipe(
  decodeTo(Unknown, Transformation.unknownFromJsonString())
)

/**
 * @since 4.0.0
 */
export interface fromJsonString<S extends Top> extends decodeTo<S, UnknownFromJsonString> {
  readonly "~rebuild.out": fromJsonString<S>
}

/**
 * Returns a schema that decodes a JSON string and then decodes the parsed value
 * using the given schema.
 *
 * This is useful when working with JSON-encoded strings where the actual
 * structure of the value is known and described by an existing schema.
 *
 * The resulting schema first parses the input string as JSON, and then runs the
 * provided schema on the parsed result.
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
 *
 * **Json Schema Generation**
 *
 * When using `fromJsonString` with `draft-2020-12` or `openApi3.1`, the
 * resulting schema will be a JSON Schema with a `contentSchema` property that
 * contains the JSON Schema for the given schema.
 *
 * **Example**
 *
 * ```ts
 * import { Schema, ToJsonSchema } from "effect/schema"
 *
 * const original = Schema.Struct({ a: Schema.String })
 * const schema = Schema.fromJsonString(original)
 *
 * const jsonSchema = ToJsonSchema.makeDraft2020_12(schema)
 *
 * console.log(JSON.stringify(jsonSchema, null, 2))
 * // Output:
 * // {
 * //   "$schema": "https://json-schema.org/draft/2020-12/schema",
 * //   "type": "string",
 * //   "contentMediaType": "application/json",
 * //   "contentSchema": {
 * //     "type": "object",
 * //     "properties": {
 * //       "a": {
 * //         "type": "string"
 * //       }
 * //     },
 * //     "required": [
 * //       "a"
 * //     ],
 * //     "additionalProperties": false
 * //   }
 * // }
 * ```
 *
 * @since 4.0.0
 */
export function fromJsonString<S extends Top>(schema: S): fromJsonString<S> {
  return UnknownFromJsonString.pipe(decodeTo(schema)).annotate({
    jsonSchema: {
      _tag: "Override",
      override: (ctx: ToJsonSchema.Annotation.OverrideContext) => {
        switch (ctx.target) {
          case "draft-07":
            return {
              "type": "string",
              "description": "a string that will be decoded as JSON"
            }
          case "draft-2020-12":
            return {
              "type": "string",
              "description": "a string that will be decoded as JSON",
              "contentMediaType": "application/json",
              "contentSchema": ctx.make(schema.ast)
            }
        }
      }
    }
  })
}

/**
 * @since 4.0.0
 */
export interface Finite extends Number {
  readonly "~rebuild.out": Finite
}

/**
 * A schema for finite numbers, rejecting `NaN`, `Infinity`, and `-Infinity`.
 *
 * @since 4.0.0
 */
export const Finite = Number.check(Check.finite())

/**
 * A schema for integers, rejecting `NaN`, `Infinity`, and `-Infinity`.
 *
 * @since 4.0.0
 */
export const Int = Number.check(Check.int())

/**
 * @since 4.0.0
 */
export interface FiniteFromString extends decodeTo<Number, String> {
  readonly "~rebuild.out": FiniteFromString
}

/**
 * A transformation schema that parses a string into a finite number.
 *
 * Decoding:
 * - A `string` is decoded as a finite number, rejecting `NaN`, `Infinity`, and
 *   `-Infinity` values.
 *
 * Encoding:
 * - A finite number is encoded as a `string`.
 *
 * @since 4.0.0
 */
export const FiniteFromString: FiniteFromString = String.annotate({
  description: "a string that will be decoded as a finite number"
}).pipe(decodeTo(
  Finite,
  Transformation.numberFromString
))

/**
 * A schema for strings that contains no leading or trailing whitespaces.
 *
 * @since 4.0.0
 */
export const Trimmed = String.check(Check.trimmed())

/**
 * A transformation schema that trims whitespace from a string.
 *
 * Decoding:
 * - A `string` is decoded as a string with no leading or trailing whitespaces.
 *
 * Encoding:
 * - The trimmed string is encoded as is.
 *
 * @since 4.0.0
 */
export const Trim = String.annotate({
  description: "a string that will be trimmed"
}).pipe(decodeTo(Trimmed, Transformation.trim()))

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
    decodeTo<declareConstructor<Self, S["Encoded"], readonly [S], S["Iso"]>, S>,
    Annotations.Declaration<Self, readonly [S]>,
    S["~type.make.in"],
    S["Iso"],
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
 * @since 4.0.0
 */
export interface ExtendableClass<Self, S extends Top & { readonly fields: Struct.Fields }, Inherited>
  extends Class<Self, S, Inherited>
{
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
  const getClassSchema = getClassSchemaFactory(schema, identifier, annotations)

  return class extends Inherited {
    constructor(...[input, options]: ReadonlyArray<any>) {
      if (options?.disableValidation) {
        super(input, options)
      } else {
        const validated = schema.makeSync(input, options)
        super({ ...input, ...validated }, { ...options, disableValidation: true })
      }
    }

    static readonly [TypeId] = TypeId
    static readonly [immerable] = true

    declare static readonly "~rebuild.out": Class<Self, S, Self>
    declare static readonly "~annotate.in": Annotations.Declaration<Self, readonly [S]>

    declare static readonly "Type": Self
    declare static readonly "Encoded": S["Encoded"]
    declare static readonly "DecodingServices": S["DecodingServices"]
    declare static readonly "EncodingServices": S["EncodingServices"]

    declare static readonly "~type.make.in": S["~type.make.in"]
    declare static readonly "~type.make": Self
    declare static readonly "~type.constructor.default": S["~type.constructor.default"]
    declare static readonly "Iso": S["Iso"]

    declare static readonly "~type.mutability": S["~type.mutability"]
    declare static readonly "~type.optionality": S["~type.optionality"]
    declare static readonly "~encoded.mutability": S["~encoded.mutability"]
    declare static readonly "~encoded.optionality": S["~encoded.optionality"]

    static readonly identifier = identifier
    static readonly fields = schema.fields

    static get ast(): AST.Declaration {
      return getClassSchema(this).ast
    }
    static pipe() {
      return Pipeable.pipeArguments(this, arguments)
    }
    static rebuild(ast: AST.Declaration) {
      return getClassSchema(this).rebuild(ast)
    }
    static makeSync(input: S["~type.make.in"], options?: MakeOptions): Self {
      return new this(input, options)
    }
    static annotate(annotations: Annotations.Declaration<Self, readonly [S]>) {
      return this.rebuild(AST.annotate(this.ast, annotations))
    }
    static annotateKey(annotations: Annotations.Key<Self>) {
      return this.rebuild(AST.annotateKey(this.ast, annotations))
    }
    static check(...checks: readonly [Check.Check<Self>, ...Array<Check.Check<Self>>]) {
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
        return makeClass(this, identifier, struct, annotations)
      }
    }
  }
}

function getClassTransformation(self: new(...args: ReadonlyArray<any>) => any) {
  return new Transformation.Transformation<any, any, never, never>(
    Getter.transform((input) => new self(input)),
    Getter.passthrough()
  )
}

function getClassSchemaFactory<S extends Top>(
  from: S,
  identifier: string,
  annotations: Annotations.Declaration<any, readonly [S]> | undefined
) {
  let memo: decodeTo<declareConstructor<any, S["Encoded"], readonly [S]>, S> | undefined
  return <Self extends (new(...args: ReadonlyArray<any>) => any) & { readonly identifier: string }>(
    self: Self
  ): decodeTo<declareConstructor<Self, S["Encoded"], readonly [S]>, S> => {
    if (memo === undefined) {
      const to = make<declareConstructor<Self, S["Encoded"], readonly [S]>>(
        new AST.Declaration(
          [from.ast],
          () => (input, ast) => {
            return input instanceof self ?
              Effect.succeed(input) :
              Effect.fail(new Issue.InvalidType(ast, O.some(input)))
          },
          Annotations.combine({
            defaultIsoSerializer: ([from]: readonly [any]) => new AST.Link(from.ast, getClassTransformation(self)),
            arbitrary: {
              _tag: "Declaration",
              declaration: ([from]: readonly [any]) => () => from.map((args: any) => new self(args))
            },
            format: {
              _tag: "Declaration",
              declaration: ([from]: readonly [any]) => (t: any) => `${self.identifier}(${from(t)})`
            }
          }, annotations)
        )
      )
      memo = from.pipe(
        decodeTo(
          to,
          getClassTransformation(self)
        )
      ).annotate({ identifier })
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
  return makeClass(Data.Class, id, struct, annotations)
}

/**
 * @since 4.0.0
 */
export interface ErrorClass<Self, S extends Top & { readonly fields: Struct.Fields }, Inherited>
  extends ExtendableClass<Self, S, Inherited>
{}

/**
 * @category Constructors
 * @since 4.0.0
 */
export const ErrorClass: {
  <Self, Brand = {}>(id: string): {
    <const Fields extends Struct.Fields>(
      fields: Fields,
      annotations?: Annotations.Declaration<Self, readonly [Struct<Fields>]>
    ): ErrorClass<Self, Struct<Fields>, Cause_.YieldableError & Brand>
    <S extends Struct<Struct.Fields>>(
      schema: S,
      annotations?: Annotations.Declaration<Self, readonly [S]>
    ): ErrorClass<Self, S, Cause_.YieldableError & Brand>
  }
} = <Self, Brand = {}>(id: string) =>
(
  schema: Struct.Fields | Struct<Struct.Fields>,
  annotations?: Annotations.Declaration<Self, readonly [Struct<Struct.Fields>]>
): ErrorClass<Self, Struct<Struct.Fields>, Cause_.YieldableError & Brand> => {
  const struct = isSchema(schema) ? schema : Struct(schema)
  return makeClass(core.Error, id, struct, annotations)
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
    return class RequestClass extends makeClass(Request.Class, id, options.payload, options.annotations) {
      static readonly payload = options.payload
      static readonly success = options.success
      static readonly error = options.error
    } as any
  }

/**
 * @since 4.0.0
 */
export const PropertyKey = Union([Symbol, String, Finite])

/**
 * @since 4.0.0
 */
export const StandardSchemaV1FailureResult = Struct({
  issues: Array(Struct({
    message: String,
    path: optional(Array(Union([PropertyKey, Struct({ key: PropertyKey })])))
  }))
})

/**
 * @since 4.0.0
 */
export interface BooleanFromBit extends decodeTo<Boolean, Literals<readonly [0, 1]>> {
  readonly "~rebuild.out": BooleanFromBit
}

/**
 * A boolean parsed from 0 or 1.
 *
 * @category Boolean
 * @since 4.0.0
 */
export const BooleanFromBit: BooleanFromBit = Literals([0, 1]).pipe(
  decodeTo(
    Boolean,
    Transformation.transform({
      decode: (bit) => bit === 1,
      encode: (bool) => bool ? 1 : 0
    })
  )
)

/**
 * @since 4.0.0
 */
export interface Uint8Array extends instanceOf<globalThis.Uint8Array<ArrayBufferLike>> {
  readonly "~rebuild.out": Uint8Array
}

/**
 * A schema for JavaScript `Uint8Array` objects.
 *
 * The default JSON serializer encodes Uint8Array as a Base64 encoded string.
 *
 * @category Uint8Array
 * @since 4.0.0
 */
export const Uint8Array: Uint8Array = instanceOf(globalThis.Uint8Array<ArrayBufferLike>, {
  defaultJsonSerializer: () =>
    link<globalThis.Uint8Array<ArrayBufferLike>>()(
      String.annotate({ description: "Base64 encoded Uint8Array" }),
      {
        decode: Getter.decodeBase64(),
        encode: Getter.encodeBase64()
      }
    )
})

/**
 * @since 4.0.0
 */
export interface DateTimeUtc extends declare<DateTime.Utc> {
  readonly "~rebuild.out": DateTimeUtc
}

/**
 * A schema for `DateTime.Utc` values.
 *
 * **Default JSON serializer**
 * - encodes `DateTime.Utc` as a UTC ISO string
 *
 * @category DateTime
 * @since 4.0.0
 */
export const DateTimeUtc: DateTimeUtc = declare(
  (u) => DateTime.isDateTime(u) && DateTime.isUtc(u),
  {
    title: "DateTimeUtc",
    defaultJsonSerializer: () =>
      link<DateTime.Utc>()(
        String,
        {
          decode: Getter.dateTimeUtcFromInput(),
          encode: Getter.transform(DateTime.formatIso)
        }
      ),
    arbitrary: {
      _tag: "Declaration",
      declaration: () => (fc, ctx) =>
        fc.date({ noInvalidDate: true, ...ctx?.constraints?.DateConstraints }).map((date) =>
          DateTime.fromDateUnsafe(date)
        )
    },
    format: {
      _tag: "Declaration",
      declaration: () => (utc) => utc.toString()
    },
    equivalence: {
      _tag: "Declaration",
      declaration: () => DateTime.Equivalence
    }
  }
)

/**
 * @since 4.0.0
 */
export interface DateTimeUtcFromDate extends decodeTo<DateTimeUtc, Date> {
  readonly "~rebuild.out": DateTimeUtcFromDate
}

/**
 * A transformation schema that decodes a `Date` into a `DateTime.Utc`.
 *
 * Decoding:
 * - A **valid** `Date` is decoded as a `DateTime.Utc`
 *
 * Encoding:
 * - A `DateTime.Utc` is encoded as a `Date`
 *
 * @category DateTime
 * @since 4.0.0
 */
export const DateTimeUtcFromDate: DateTimeUtcFromDate = ValidDate.pipe(
  decodeTo(DateTimeUtc, {
    decode: Getter.dateTimeUtcFromInput(),
    encode: Getter.transform(DateTime.toDateUtc)
  })
)

/**
 * @since 4.0.0
 */
export interface DateTimeUtcFromString extends decodeTo<DateTimeUtc, String> {
  readonly "~rebuild.out": DateTimeUtcFromString
}

/**
 * A transformation schema that decodes a string into a `DateTime.Utc`.
 *
 * Decoding:
 * - A `string` that can be parsed by `Date.parse` is decoded as a
 *   `DateTime.Utc`
 *
 * Encoding:
 * - A `DateTime.Utc` is encoded as a `string` in ISO 8601 format, ignoring any
 *   time zone.
 *
 * @category DateTime
 * @since 4.0.0
 */
export const DateTimeUtcFromString: DateTimeUtcFromString = String.annotate({
  description: "a string that will be decoded as a DateTime.Utc"
}).pipe(
  decodeTo(DateTimeUtc, {
    decode: Getter.dateTimeUtcFromInput(),
    encode: Getter.transform(DateTime.formatIso)
  })
)

/**
 * @since 4.0.0
 */
export interface DateTimeUtcFromMillis extends decodeTo<instanceOf<DateTime.Utc>, Number> {}

/**
 * A transformation schema that decodes a number into a `DateTime.Utc`.
 *
 * Decoding:
 * - A number of milliseconds since the Unix epoch is decoded as a `DateTime.Utc`
 *
 * Encoding:
 * - A `DateTime.Utc` is encoded as a number of milliseconds since the Unix epoch.
 *
 * @category DateTime
 * @since 4.0.0
 */
export const DateTimeUtcFromMillis: DateTimeUtcFromMillis = Number.annotate({
  description: "a number that will be decoded as a DateTime.Utc"
}).pipe(
  decodeTo(DateTimeUtc, {
    decode: Getter.dateTimeUtcFromInput(),
    encode: Getter.transform(DateTime.toEpochMillis)
  })
)

/**
 * @since 4.0.0
 */
export interface declareConstructor<T, E, TypeParameters extends ReadonlyArray<Top>, Iso = T> extends
  Bottom<
    T,
    E,
    TypeParameters[number]["DecodingServices"],
    TypeParameters[number]["EncodingServices"],
    AST.Declaration,
    declareConstructor<T, E, TypeParameters, Iso>,
    Annotations.Declaration<T, TypeParameters>,
    T,
    Iso
  >
{}

/**
 * An API for creating schemas for parametric types.
 *
 * It is recommended to add the `defaultIsoSerializer` annotation to the schema.
 *
 * @see {@link declare} for creating schemas for non parametric types.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function declareConstructor<const TypeParameters extends ReadonlyArray<Top>>(typeParameters: TypeParameters) {
  return <E>() =>
  <T, Iso = T>(
    run: (
      typeParameters: {
        readonly [K in keyof TypeParameters]: Codec<TypeParameters[K]["Type"], TypeParameters[K]["Encoded"]>
      }
    ) => (u: unknown, self: AST.Declaration, options: AST.ParseOptions) => Effect.Effect<T, Issue.Issue>,
    annotations?: Annotations.Declaration<T, TypeParameters>
  ): declareConstructor<T, E, TypeParameters, Iso> => {
    return make<declareConstructor<T, E, TypeParameters, Iso>>(
      new AST.Declaration(
        typeParameters.map(AST.getAST),
        (typeParameters) => run(typeParameters.map(make) as any),
        annotations
      )
    )
  }
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export interface declare<T, Iso = T> extends declareConstructor<T, T, readonly [], Iso> {
  readonly "~rebuild.out": declare<T, Iso>
}

/**
 * An API for creating schemas for non parametric types.
 *
 * It is recommended to add the `defaultJsonSerializer` annotation to the schema.
 *
 * @see {@link declareConstructor} for creating schemas for parametric types.
 *
 * @since 4.0.0
 */
export function declare<T, Iso = T>(
  is: (u: unknown) => u is T,
  annotations?: Annotations.Declaration<T, readonly []> | undefined
): declare<T, Iso> {
  return declareConstructor([])<T>()(
    () => (input, ast) =>
      is(input) ?
        Effect.succeed(input) :
        Effect.fail(new Issue.InvalidType(ast, O.some(input))),
    annotations
  )
}
