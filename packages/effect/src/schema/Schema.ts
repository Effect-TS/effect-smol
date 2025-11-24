/**
 * @since 4.0.0
 */

import type { StandardSchemaV1 } from "@standard-schema/spec"
import * as Cause_ from "../Cause.ts"
import * as Arr from "../collections/Array.ts"
import type * as Brand from "../data/Brand.ts"
import type * as Combiner from "../data/Combiner.ts"
import * as Data from "../data/Data.ts"
import type * as Equivalence from "../data/Equivalence.ts"
import type { Formatter } from "../data/Formatter.ts"
import { format, formatDate, formatPropertyKey } from "../data/Formatter.ts"
import * as Option_ from "../data/Option.ts"
import * as Order from "../data/Order.ts"
import * as Predicate from "../data/Predicate.ts"
import * as Record_ from "../data/Record.ts"
import * as Redacted_ from "../data/Redacted.ts"
import * as Result_ from "../data/Result.ts"
import type { Assign, Lambda, Mutable, Simplify } from "../data/Struct.ts"
import * as Struct_ from "../data/Struct.ts"
import * as DateTime from "../DateTime.ts"
import type { Differ } from "../Differ.ts"
import * as Duration_ from "../Duration.ts"
import * as Effect from "../Effect.ts"
import * as Exit_ from "../Exit.ts"
import { identity, memoize } from "../Function.ts"
import * as Equal from "../interfaces/Equal.ts"
import * as Pipeable from "../interfaces/Pipeable.ts"
import * as InternalArbitrary from "../internal/arbitrary.ts"
import * as core from "../internal/core.ts"
import * as InternalDiffer from "../internal/differ.ts"
import * as InternalEquivalence from "../internal/equivalence.ts"
import * as InternalJsonSchema from "../internal/json-schema.ts"
import { remainder } from "../Number.ts"
import * as Optic_ from "../Optic.ts"
import * as Request from "../Request.ts"
import * as Scheduler from "../Scheduler.ts"
import * as FastCheck from "../testing/FastCheck.ts"
import type { UnionToIntersection } from "../types/Types.ts"
import * as Annotations from "./Annotations.ts"
import * as AST from "./AST.ts"
import * as Getter from "./Getter.ts"
import * as Issue from "./Issue.ts"
import * as Parser from "./Parser.ts"
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
 * Configuration options for the `makeUnsafe` method, providing control over
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
  out T,
  out E,
  out RD,
  out RE,
  out Ast extends AST.AST,
  out RebuildOut extends Top,
  out TypeMakeIn = T,
  out Iso = T,
  in out TypeParameters extends ReadonlyArray<Top> = readonly [],
  out TypeMake = TypeMakeIn,
  out TypeMutability extends Mutability = "readonly",
  out TypeOptionality extends Optionality = "required",
  out TypeConstructorDefault extends ConstructorDefault = "no-default",
  out EncodedMutability extends Mutability = "readonly",
  out EncodedOptionality extends Optionality = "required"
> extends Pipeable.Pipeable {
  readonly [TypeId]: typeof TypeId

  readonly ast: Ast
  readonly "~rebuild.out": RebuildOut
  readonly "~type.parameters": TypeParameters
  readonly "~annotate.in": Annotations.Bottom<T, TypeParameters>

  readonly "Type": T
  readonly "Encoded": E
  readonly "DecodingServices": RD
  readonly "EncodingServices": RE

  readonly "~type.make.in": TypeMakeIn
  readonly "~type.make": TypeMake // useful to type the `refine` interface
  readonly "~type.constructor.default": TypeConstructorDefault
  readonly "Iso": Iso

  readonly "~type.mutability": TypeMutability
  readonly "~type.optionality": TypeOptionality
  readonly "~encoded.mutability": EncodedMutability
  readonly "~encoded.optionality": EncodedOptionality

  annotate(annotations: this["~annotate.in"]): this["~rebuild.out"]
  annotateKey(annotations: Annotations.Key<this["Type"]>): this["~rebuild.out"]
  check(...checks: readonly [AST.Check<this["Type"]>, ...Array<AST.Check<this["Type"]>>]): this["~rebuild.out"]
  rebuild(ast: this["ast"]): this["~rebuild.out"]
  /**
   * @throws {Error} The issue is contained in the error cause.
   */
  makeUnsafe(input: this["~type.make.in"], options?: MakeOptions): this["Type"]
}

const TypeId = "~effect/schema/Schema"

const SchemaProto = {
  [TypeId]: TypeId,
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
  annotate(this: Top, annotations: Annotations.Annotations) {
    return this.rebuild(AST.annotate(this.ast, annotations))
  },
  annotateKey(this: Top, annotations: Annotations.Key<unknown>) {
    return this.rebuild(AST.annotateKey(this.ast, annotations))
  },
  check(this: Top, ...checks: readonly [AST.Check<unknown>, ...Array<AST.Check<unknown>>]) {
    return this.rebuild(AST.appendChecks(this.ast, checks))
  }
}

/** @internal */
export function makeProto<S extends Top>(ast: AST.AST, options: object): S {
  const self = Object.create(SchemaProto)
  Object.assign(self, options)
  self.ast = ast
  self.rebuild = (ast: AST.AST) => makeProto(ast, options)
  self.makeUnsafe = Parser.makeUnsafe(self)
  return self
}

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
    T,
    Iso,
    TypeParameters
  >
{
  readonly "~rebuild.out": this
}

/**
 * An API for creating schemas for parametric types.
 *
 * @see {@link declare} for creating schemas for non parametric types.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function declareConstructor<T, E = T, Iso = T>() {
  return <const TypeParameters extends ReadonlyArray<Top>>(
    typeParameters: TypeParameters,
    run: (
      typeParameters: {
        readonly [K in keyof TypeParameters]: Codec<TypeParameters[K]["Type"], TypeParameters[K]["Encoded"]>
      }
    ) => (u: unknown, self: AST.Declaration, options: AST.ParseOptions) => Effect.Effect<T, Issue.Issue>,
    annotations?: Annotations.Declaration<T, TypeParameters>
  ): declareConstructor<T, E, TypeParameters, Iso> => {
    return make(
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
export interface declare<T, Iso = T> extends declareConstructor<T, T, readonly [], Iso> {}

/**
 * An API for creating schemas for non parametric types.
 *
 * @see {@link declareConstructor} for creating schemas for parametric types.
 *
 * @since 4.0.0
 */
export function declare<T, Iso = T>(
  is: (u: unknown) => u is T,
  annotations?: Annotations.Declaration<T> | undefined
): declare<T, Iso> {
  return declareConstructor<T, T, Iso>()(
    [],
    () => (input, ast) =>
      is(input) ?
        Effect.succeed(input) :
        Effect.fail(new Issue.InvalidType(ast, Option_.some(input))),
    annotations
  )
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
  S["~type.make.in"],
  S["Iso"],
  S["~type.parameters"],
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
    unknown,
    unknown,
    any, // this is because TypeParameters is invariant
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
  readonly _tag = "SchemaError"
  readonly name: string = "SchemaError"
  readonly issue: Issue.Issue
  constructor(issue: Issue.Issue) {
    this.issue = issue
  }
  get message() {
    return this.issue.toString()
  }
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
 * import { Schema } from "effect/schema"
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
 *   age: Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: 150 }))
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
export function asStandardSchemaV1<
  S extends Top & { readonly DecodingServices: never }
>(
  self: S,
  options?: {
    readonly leafHook?: Issue.LeafHook | undefined
    readonly checkHook?: Issue.CheckHook | undefined
    readonly parseOptions?: AST.ParseOptions | undefined
  }
): StandardSchemaV1<S["Encoded"], S["Type"]> & S {
  const decodeUnknownEffect = Parser.decodeUnknownEffect(self) as (
    input: unknown,
    options?: AST.ParseOptions
  ) => Effect.Effect<S["Type"], Issue.Issue>
  const parseOptions: AST.ParseOptions = { errors: "all", ...options?.parseOptions }
  const formatter = Issue.makeFormatterStandardSchemaV1(options)
  const standard: StandardSchemaV1<S["Encoded"], S["Type"]> = {
    "~standard": {
      version: 1,
      vendor: "effect",
      validate(value) {
        const scheduler = new Scheduler.MixedScheduler()
        const fiber = Effect.runFork(
          Effect.match(decodeUnknownEffect(value, parseOptions), {
            onFailure: formatter,
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
export const is = Parser.is

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
export const asserts = Parser.asserts

/**
 * @category Decoding
 * @since 4.0.0
 */
export function decodeUnknownEffect<S extends Top>(schema: S) {
  const parser = Parser.decodeUnknownEffect(schema)
  return (input: unknown, options?: AST.ParseOptions): Effect.Effect<S["Type"], SchemaError, S["DecodingServices"]> => {
    return Effect.mapErrorEager(parser(input, options), (issue) => new SchemaError(issue))
  }
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeEffect: <S extends Top>(
  schema: S
) => (input: S["Encoded"], options?: AST.ParseOptions) => Effect.Effect<S["Type"], SchemaError, S["DecodingServices"]> =
  decodeUnknownEffect

/**
 * @category Decoding
 * @since 4.0.0
 */
export function decodeUnknownExit<S extends Top & { readonly DecodingServices: never }>(schema: S) {
  const parser = Parser.decodeUnknownExit(schema)
  return (input: unknown, options?: AST.ParseOptions): Exit_.Exit<S["Type"], SchemaError> => {
    return Exit_.mapError(parser(input, options), (issue) => new SchemaError(issue))
  }
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeExit: <S extends Top & { readonly DecodingServices: never }>(
  schema: S
) => (input: S["Encoded"], options?: AST.ParseOptions) => Exit_.Exit<S["Type"], SchemaError> = decodeUnknownExit

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeUnknownOption = Parser.decodeUnknownOption

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeOption = Parser.decodeOption

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeUnknownPromise = Parser.decodeUnknownPromise

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodePromise = Parser.decodePromise

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeUnknownSync = Parser.decodeUnknownSync

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeSync = Parser.decodeSync

/**
 * @category Encoding
 * @since 4.0.0
 */
export function encodeUnknownEffect<S extends Top>(schema: S) {
  const parser = Parser.encodeUnknownEffect(schema)
  return (
    input: unknown,
    options?: AST.ParseOptions
  ): Effect.Effect<S["Encoded"], SchemaError, S["EncodingServices"]> => {
    return Effect.mapErrorEager(parser(input, options), (issue) => new SchemaError(issue))
  }
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeEffect: <S extends Top>(
  schema: S
) => (input: S["Type"], options?: AST.ParseOptions) => Effect.Effect<S["Encoded"], SchemaError, S["EncodingServices"]> =
  encodeUnknownEffect

/**
 * @category Encoding
 * @since 4.0.0
 */
export function encodeUnknownExit<S extends Top & { readonly EncodingServices: never }>(schema: S) {
  const parser = Parser.encodeUnknownExit(schema)
  return (input: unknown, options?: AST.ParseOptions): Exit_.Exit<S["Encoded"], SchemaError> => {
    return Exit_.mapError(parser(input, options), (issue) => new SchemaError(issue))
  }
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeExit: <S extends Top & { readonly EncodingServices: never }>(
  schema: S
) => (input: S["Type"], options?: AST.ParseOptions) => Exit_.Exit<S["Encoded"], SchemaError> = encodeUnknownExit

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeUnknownOption = Parser.encodeUnknownOption

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeOption = Parser.encodeOption

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeUnknownPromise = Parser.encodeUnknownPromise

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodePromise = Parser.encodePromise

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeUnknownSync = Parser.encodeUnknownSync

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeSync = Parser.encodeSync

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
export function make<S extends Top>(ast: S["ast"]): S {
  return makeProto(ast, {})
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
    S["~type.make.in"],
    S["Iso"],
    S["~type.parameters"],
    S["~type.make"],
    S["~type.mutability"],
    "optional",
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    "optional"
  >
{
  readonly "~rebuild.out": this
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
export const optionalKey = Struct_.lambda<optionalKeyLambda>((schema) =>
  makeProto(AST.optionalKey(schema.ast), { schema })
)

interface requiredKeyLambda extends Lambda {
  <S extends Top>(self: optionalKey<S>): S
  readonly "~lambda.out": this["~lambda.in"] extends optionalKey<Top> ? this["~lambda.in"]["schema"]
    : "Error: schema not eligible for requiredKey"
}

/**
 * @since 4.0.0
 */
export const requiredKey = Struct_.lambda<requiredKeyLambda>((self) => self.schema)

/**
 * @since 4.0.0
 */
export interface optional<S extends Top> extends optionalKey<UndefinedOr<S>> {}

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
export const optional = Struct_.lambda<optionalLambda>((self) => optionalKey(UndefinedOr(self)))

interface requiredLambda extends Lambda {
  <S extends Top>(self: optional<S>): S
  readonly "~lambda.out": this["~lambda.in"] extends optional<Top> ? this["~lambda.in"]["schema"]["members"][0]
    : "Error: schema not eligible for required"
}

/**
 * @since 4.0.0
 */
export const required = Struct_.lambda<requiredLambda>((self) => self.schema.members[0])

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
    S["~type.make.in"],
    S["Iso"],
    S["~type.parameters"],
    S["~type.make"],
    "mutable",
    S["~type.optionality"],
    S["~type.constructor.default"],
    "mutable",
    S["~encoded.optionality"]
  >
{
  readonly "~rebuild.out": this
  readonly schema: S
}

interface mutableKeyLambda extends Lambda {
  <S extends Top>(self: S): mutableKey<S>
  readonly "~lambda.out": this["~lambda.in"] extends Top ? mutableKey<this["~lambda.in"]> : never
}

/**
 * @since 4.0.0
 */
export const mutableKey = Struct_.lambda<mutableKeyLambda>((schema) =>
  makeProto(AST.mutableKey(schema.ast), { schema })
)

interface readonlyKeyLambda extends Lambda {
  <S extends Top>(self: mutableKey<S>): S
  readonly "~lambda.out": this["~lambda.in"] extends mutableKey<Top> ? this["~lambda.in"]["schema"]
    : "Error: schema not eligible for readonlyKey"
}

/**
 * @since 4.0.0
 */
export const readonlyKey = Struct_.lambda<readonlyKeyLambda>((self) => self.schema)

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
    S["~type.make.in"],
    S["Iso"],
    S["~type.parameters"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  readonly "~rebuild.out": this
}

interface typeCodecLambda extends Lambda {
  <S extends Top>(self: S): typeCodec<S>
  readonly "~lambda.out": this["~lambda.in"] extends Top ? typeCodec<this["~lambda.in"]> : never
}

/**
 * @since 4.0.0
 */
export const typeCodec = Struct_.lambda<typeCodecLambda>((schema) => makeProto(AST.typeAST(schema.ast), { schema }))

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
    S["Encoded"],
    S["Encoded"],
    ReadonlyArray<Top>,
    S["Encoded"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  readonly "~rebuild.out": this
}

interface encodedCodecLambda extends Lambda {
  <S extends Top>(self: S): encodedCodec<S>
  readonly "~lambda.out": this["~lambda.in"] extends Top ? encodedCodec<this["~lambda.in"]> : never
}

/**
 * @since 4.0.0
 */
export const encodedCodec = Struct_.lambda<encodedCodecLambda>((schema) =>
  makeProto(AST.encodedAST(schema.ast), { schema })
)

const FlipTypeId = "~effect/schema/Schema/flip"

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
    S["Encoded"],
    S["Encoded"],
    ReadonlyArray<Top>,
    S["Encoded"],
    S["~encoded.mutability"],
    S["~encoded.optionality"],
    ConstructorDefault,
    S["~type.mutability"],
    S["~type.optionality"]
  >
{
  readonly "~rebuild.out": this
  readonly [FlipTypeId]: typeof FlipTypeId
  readonly schema: S
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
  return makeProto(AST.flip(schema.ast), { [FlipTypeId]: FlipTypeId, schema })
}

/**
 * @since 4.0.0
 */
export interface Literal<L extends AST.LiteralValue> extends Bottom<L, L, never, never, AST.Literal, Literal<L>> {
  readonly "~rebuild.out": this
  readonly literal: L
  transform<L2 extends AST.LiteralValue>(to: L2): decodeTo<Literal<L2>, Literal<L>>
}

/**
 * @see {@link Literals} for a schema that represents a union of literals.
 * @see {@link tag} for a schema that represents a literal value that can be
 * used as a discriminator field in tagged unions and has a constructor default.
 * @since 4.0.0
 */
export function Literal<L extends AST.LiteralValue>(literal: L): Literal<L> {
  const out = makeProto<Literal<L>>(new AST.Literal(literal), {
    literal,
    transform<L2 extends AST.LiteralValue>(to: L2): decodeTo<Literal<L2>, Literal<L>> {
      return out.pipe(decodeTo(Literal(to), {
        decode: Getter.transform(() => to),
        encode: Getter.transform(() => literal)
      }))
    }
  })
  return out
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
    TemplateLiteral<Parts>
  >
{
  readonly "~rebuild.out": this
  readonly parts: Parts
}

function templateLiteralFromParts<Parts extends TemplateLiteral.Parts>(parts: Parts) {
  return new AST.TemplateLiteral(parts.map((part) => isSchema(part) ? part.ast : new AST.Literal(part)))
}

/**
 * @since 4.0.0
 */
export function TemplateLiteral<const Parts extends TemplateLiteral.Parts>(parts: Parts): TemplateLiteral<Parts> {
  return makeProto(templateLiteralFromParts(parts), { parts })
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
    AST.Arrays,
    TemplateLiteralParser<Parts>
  >
{
  readonly "~rebuild.out": this
  readonly parts: Parts
}

/**
 * @since 4.0.0
 */
export function TemplateLiteralParser<const Parts extends TemplateLiteral.Parts>(
  parts: Parts
): TemplateLiteralParser<Parts> {
  return makeProto(templateLiteralFromParts(parts).asTemplateLiteralParser(), { parts: [...parts] })
}

/**
 * @since 4.0.0
 */
export interface Enum<A extends { [x: string]: string | number }>
  extends Bottom<A[keyof A], A[keyof A], never, never, AST.Enum, Enum<A>>
{
  readonly "~rebuild.out": this
  readonly enums: A
}

/**
 * @since 4.0.0
 */
export function Enum<A extends { [x: string]: string | number }>(enums: A): Enum<A> {
  return makeProto(
    new AST.Enum(
      Object.keys(enums).filter(
        (key) => typeof enums[enums[key]] !== "number"
      ).map((key) => [key, enums[key]])
    ),
    { enums }
  )
}

/**
 * @since 4.0.0
 */
export interface Never extends Bottom<never, never, never, never, AST.Never, Never> {
  readonly "~rebuild.out": this
}

/**
 * @since 4.0.0
 */
export const Never: Never = make(AST.never)

/**
 * @since 4.0.0
 */
export interface Any extends Bottom<any, any, never, never, AST.Any, Any> {
  readonly "~rebuild.out": this
}

/**
 * @since 4.0.0
 */
export const Any: Any = make(AST.any)

/**
 * @since 4.0.0
 */
export interface Unknown extends Bottom<unknown, unknown, never, never, AST.Unknown, Unknown> {
  readonly "~rebuild.out": this
}

/**
 * @since 4.0.0
 */
export const Unknown: Unknown = make(AST.unknown)

/**
 * @since 4.0.0
 */
export interface Null extends Bottom<null, null, never, never, AST.Null, Null> {
  readonly "~rebuild.out": this
}

/**
 * @since 4.0.0
 */
export const Null: Null = make(AST.null)

/**
 * @since 4.0.0
 */
export interface Undefined extends Bottom<undefined, undefined, never, never, AST.Undefined, Undefined> {
  readonly "~rebuild.out": this
}

/**
 * @since 4.0.0
 */
export const Undefined: Undefined = make(AST.undefined)

/**
 * @since 4.0.0
 */
export interface String extends Bottom<string, string, never, never, AST.String, String> {
  readonly "~rebuild.out": this
}

/**
 * A schema for all strings.
 *
 * @since 4.0.0
 */
export const String: String = make(AST.string)

/**
 * @since 4.0.0
 */
export interface Number extends Bottom<number, number, never, never, AST.Number, Number> {
  readonly "~rebuild.out": this
}

/**
 * A schema for all numbers, including `NaN`, `Infinity`, and `-Infinity`.
 *
 * **Default Json Serializer**
 *
 * - If the number is finite, it is serialized as a number.
 * - Otherwise, it is serialized as a string ("NaN", "Infinity", or "-Infinity").
 *
 * @since 4.0.0
 */
export const Number: Number = make(AST.number)

/**
 * @since 4.0.0
 */
export interface Boolean extends Bottom<boolean, boolean, never, never, AST.Boolean, Boolean> {
  readonly "~rebuild.out": this
}

/**
 * A schema for all booleans.
 *
 * @category Boolean
 * @since 4.0.0
 */
export const Boolean: Boolean = make(AST.boolean)

/**
 * @since 4.0.0
 */
export interface Symbol extends Bottom<symbol, symbol, never, never, AST.Symbol, Symbol> {
  readonly "~rebuild.out": this
}

/**
 * A schema for all symbols.
 *
 * @since 4.0.0
 */
export const Symbol: Symbol = make(AST.symbol)

/**
 * @since 4.0.0
 */
export interface BigInt extends Bottom<bigint, bigint, never, never, AST.BigInt, BigInt> {
  readonly "~rebuild.out": this
}

/**
 * A schema for all bigints.
 *
 * @since 4.0.0
 */
export const BigInt: BigInt = make(AST.bigInt)

/**
 * @since 4.0.0
 */
export interface Void extends Bottom<void, void, never, never, AST.Void, Void> {
  readonly "~rebuild.out": this
}

/**
 * A schema for the `void` type.
 *
 * @since 4.0.0
 */
export const Void: Void = make(AST.void)

/**
 * @since 4.0.0
 */
export interface ObjectKeyword extends Bottom<object, object, never, never, AST.ObjectKeyword, ObjectKeyword> {
  readonly "~rebuild.out": this
}

/**
 * A schema for the `object` type.
 *
 * @since 4.0.0
 */
export const ObjectKeyword: ObjectKeyword = make(AST.objectKeyword)

/**
 * @since 4.0.0
 */
export interface UniqueSymbol<sym extends symbol>
  extends Bottom<sym, sym, never, never, AST.UniqueSymbol, UniqueSymbol<sym>>
{
  readonly "~rebuild.out": this
}

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
  return make(new AST.UniqueSymbol(symbol))
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
    AST.Objects,
    Struct<Fields>,
    Simplify<Struct.MakeIn<Fields>>,
    Simplify<Struct.Iso<Fields>>
  >
{
  readonly "~rebuild.out": this
  readonly fields: Fields
  /**
   * Returns a new struct with the fields modified by the provided function.
   *
   * **Options**
   *
   * - `unsafePreserveChecks` - if `true`, keep any `.check(...)` constraints
   *   that were attached to the original union. Defaults to `false`.
   *
   *   **Warning**: This is an unsafe operation. Since `mapFields`
   *   transformations change the schema type, the original refinement functions
   *   may no longer be valid or safe to apply to the transformed schema. Only
   *   use this option if you have verified that your refinements remain correct
   *   after the transformation.
   */
  mapFields<To extends Struct.Fields>(
    f: (fields: Fields) => To,
    options?: {
      readonly unsafePreserveChecks?: boolean | undefined
    } | undefined
  ): Struct<Simplify<Readonly<To>>>
}

function makeStruct<const Fields extends Struct.Fields>(ast: AST.Objects, fields: Fields): Struct<Fields> {
  return makeProto(ast, {
    fields,
    mapFields<To extends Struct.Fields>(
      this: Struct<Fields>,
      f: (fields: Fields) => To,
      options?: {
        readonly unsafePreserveChecks?: boolean | undefined
      } | undefined
    ): Struct<To> {
      const fields = f(this.fields)
      return makeStruct(AST.struct(fields, options?.unsafePreserveChecks ? this.ast.checks : undefined), fields)
    }
  })
}

/**
 * @since 4.0.0
 */
export function Struct<const Fields extends Struct.Fields>(fields: Fields): Struct<Fields> {
  return makeStruct(AST.struct(fields, undefined), fields)
}

interface fieldsAssign<NewFields extends Struct.Fields> extends Lambda {
  <Fields extends Struct.Fields>(
    struct: Struct<Fields>
  ): Struct<Struct_.Simplify<Struct_.Assign<Fields, NewFields>>>
  readonly "~lambda.out": this["~lambda.in"] extends Struct<Struct.Fields>
    ? Struct<Struct_.Simplify<Struct_.Assign<this["~lambda.in"]["fields"], NewFields>>>
    : "Error: schema not eligible for fieldsAssign"
}

/**
 * A shortcut for `MyStruct.mapFields(Struct.assign(fields))`. This is useful
 * when you want to add new fields to an existing struct or a union of structs.
 *
 * **Example** (Adding fields to a union of structs)
 *
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Tuple } from "effect/data"
 *
 * // Add a new field to all members of a union of structs
 * const schema = Schema.Union([
 *   Schema.Struct({ a: Schema.String }),
 *   Schema.Struct({ b: Schema.Number })
 * ]).mapMembers(Tuple.map(Schema.fieldsAssign({ c: Schema.Number })))
 * ```
 *
 * @since 4.0.0
 */
export function fieldsAssign<const NewFields extends Struct.Fields>(fields: NewFields) {
  return Struct_.lambda<fieldsAssign<NewFields>>((struct) => struct.mapFields(Struct_.assign(fields)))
}

/**
 * @category Struct transformations
 * @since 4.0.0
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
        decode: Struct_.renameKeys(reverseMapping),
        encode: Struct_.renameKeys(mapping)
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
  derive: { readonly [K in keyof Fields]: (s: S["Type"]) => Option_.Option<Fields[K]["Type"]> }
) {
  return (
    self: S
  ): decodeTo<Struct<Simplify<{ [K in keyof S["fields"]]: typeCodec<S["fields"][K]> } & Fields>>, S> => {
    const f = Record_.map(self.fields, typeCodec)
    const to = Struct({ ...f, ...fields })
    return self.pipe(decodeTo(
      to,
      Transformation.transform({
        decode: (input) => {
          const out: any = { ...input }
          for (const k in fields) {
            const f = derive[k]
            const o = f(input)
            if (Option_.isSome(o)) {
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
    AST.Objects,
    Record$<Key, Value>,
    Simplify<Record.MakeIn<Key, Value>>,
    Record.Iso<Key, Value>
  >
{
  readonly "~rebuild.out": this
  readonly key: Key
  readonly value: Value
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
  return makeProto(AST.record(key.ast, value.ast, keyValueCombiner), { key, value })
}

/**
 * @since 4.0.0
 */
export declare namespace StructWithRest {
  /**
   * @since 4.0.0
   */
  export type Objects = Top & { readonly ast: AST.Objects }

  /**
   * @since 4.0.0
   */
  export type Records = ReadonlyArray<Record.Record>

  type MergeTuple<T extends ReadonlyArray<unknown>> = T extends readonly [infer Head, ...infer Tail] ?
    Head & MergeTuple<Tail>
    : {}

  /**
   * @since 4.0.0
   */
  export type Type<S extends Objects, Records extends StructWithRest.Records> =
    & S["Type"]
    & MergeTuple<{ readonly [K in keyof Records]: Records[K]["Type"] }>

  /**
   * @since 4.0.0
   */
  export type Iso<S extends Objects, Records extends StructWithRest.Records> =
    & S["Iso"]
    & MergeTuple<{ readonly [K in keyof Records]: Records[K]["Iso"] }>

  /**
   * @since 4.0.0
   */
  export type Encoded<S extends Objects, Records extends StructWithRest.Records> =
    & S["Encoded"]
    & MergeTuple<{ readonly [K in keyof Records]: Records[K]["Encoded"] }>

  /**
   * @since 4.0.0
   */
  export type DecodingServices<S extends Objects, Records extends StructWithRest.Records> =
    | S["DecodingServices"]
    | { [K in keyof Records]: Records[K]["DecodingServices"] }[number]

  /**
   * @since 4.0.0
   */
  export type EncodingServices<S extends Objects, Records extends StructWithRest.Records> =
    | S["EncodingServices"]
    | { [K in keyof Records]: Records[K]["EncodingServices"] }[number]

  /**
   * @since 4.0.0
   */
  export type MakeIn<S extends Objects, Records extends StructWithRest.Records> =
    & S["~type.make"]
    & MergeTuple<{ readonly [K in keyof Records]: Records[K]["~type.make"] }>
}

/**
 * @since 4.0.0
 */
export interface StructWithRest<
  S extends StructWithRest.Objects,
  Records extends StructWithRest.Records
> extends
  Bottom<
    Simplify<StructWithRest.Type<S, Records>>,
    Simplify<StructWithRest.Encoded<S, Records>>,
    StructWithRest.DecodingServices<S, Records>,
    StructWithRest.EncodingServices<S, Records>,
    AST.Objects,
    StructWithRest<S, Records>,
    Simplify<StructWithRest.MakeIn<S, Records>>,
    Simplify<StructWithRest.Iso<S, Records>>
  >
{
  readonly "~rebuild.out": this
  readonly schema: S
  readonly records: Records
}

/**
 * @since 4.0.0
 */
export function StructWithRest<
  const S extends StructWithRest.Objects,
  const Records extends StructWithRest.Records
>(
  schema: S,
  records: Records
): StructWithRest<S, Records> {
  return makeProto(AST.structWithRest(schema.ast, records.map(AST.getAST)), { schema, records })
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
    AST.Arrays,
    Tuple<Elements>,
    Tuple.MakeIn<Elements>,
    Tuple.Iso<Elements>
  >
{
  readonly "~rebuild.out": this
  readonly elements: Elements
  /**
   * Returns a new tuple with the elements modified by the provided function.
   *
   * **Options**
   *
   * - `unsafePreserveChecks` - if `true`, keep any `.check(...)` constraints
   *   that were attached to the original union. Defaults to `false`.
   *
   *   **Warning**: This is an unsafe operation. Since `mapFields`
   *   transformations change the schema type, the original refinement functions
   *   may no longer be valid or safe to apply to the transformed schema. Only
   *   use this option if you have verified that your refinements remain correct
   *   after the transformation.
   */
  mapElements<To extends Tuple.Elements>(
    f: (elements: Elements) => To,
    options?: {
      readonly unsafePreserveChecks?: boolean | undefined
    } | undefined
  ): Tuple<Simplify<Readonly<To>>>
}

function makeTuple<Elements extends Tuple.Elements>(ast: AST.Arrays, elements: Elements): Tuple<Elements> {
  return makeProto(ast, {
    elements,
    mapElements<To extends Tuple.Elements>(
      this: Tuple<Elements>,
      f: (elements: Elements) => To,
      options?: {
        readonly unsafePreserveChecks?: boolean | undefined
      } | undefined
    ): Tuple<Simplify<Readonly<To>>> {
      const elements = f(this.elements)
      return makeTuple(AST.tuple(elements, options?.unsafePreserveChecks ? this.ast.checks : undefined), elements)
    }
  })
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function Tuple<const Elements extends ReadonlyArray<Top>>(elements: Elements): Tuple<Elements> {
  return makeTuple(AST.tuple(elements), elements)
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
    readonly ast: AST.Arrays
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
    AST.Arrays,
    TupleWithRest<S, Rest>,
    TupleWithRest.MakeIn<S["~type.make"], Rest>,
    TupleWithRest.Iso<S["Iso"], Rest>
  >
{
  readonly "~rebuild.out": this
  readonly schema: S
  readonly rest: Rest
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function TupleWithRest<S extends Tuple<Tuple.Elements>, const Rest extends TupleWithRest.Rest>(
  schema: S,
  rest: Rest
): TupleWithRest<S, Rest> {
  return makeProto(AST.tupleWithRest(schema.ast, rest.map(AST.getAST)), { schema, rest })
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
    AST.Arrays,
    Array$<S>,
    ReadonlyArray<S["~type.make"]>,
    ReadonlyArray<S["Iso"]>
  >
{
  readonly "~rebuild.out": this
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
export const Array = Struct_.lambda<ArrayLambda>((schema) =>
  makeProto(new AST.Arrays(false, [], [schema.ast]), { schema })
)

/**
 * @since 4.0.0
 */
export interface NonEmptyArray<S extends Top> extends
  Bottom<
    readonly [S["Type"], ...Array<S["Type"]>],
    readonly [S["Encoded"], ...Array<S["Encoded"]>],
    S["DecodingServices"],
    S["EncodingServices"],
    AST.Arrays,
    NonEmptyArray<S>,
    readonly [S["~type.make"], ...Array<S["~type.make"]>],
    readonly [S["Iso"], ...Array<S["Iso"]>]
  >
{
  readonly "~rebuild.out": this
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
export const NonEmptyArray = Struct_.lambda<NonEmptyArrayLambda>((schema) =>
  makeProto(new AST.Arrays(false, [schema.ast], [schema.ast]), { schema })
)

/**
 * @since 4.0.0
 */
export interface UniqueArray<S extends Top> extends Array$<S> {}

/**
 * Returns a new array schema that ensures all elements are unique.
 *
 * The equivalence used to determine uniqueness is the one provided by
 * `Schema.makeEquivalence(item)`.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function UniqueArray<S extends Top>(item: S): UniqueArray<S> {
  return Array(item).check(isUnique(makeEquivalence(item)))
}

/**
 * @since 4.0.0
 */
export interface mutable<S extends Top & { readonly "ast": AST.Arrays }> extends
  Bottom<
    Mutable<S["Type"]>,
    Mutable<S["Encoded"]>,
    S["DecodingServices"],
    S["EncodingServices"],
    S["ast"],
    mutable<S>,
    // "~type.make" and "~type.make.in" as they are because they are contravariant
    S["~type.make.in"],
    S["Iso"],
    S["~type.parameters"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  readonly "~rebuild.out": this
  readonly schema: S
}

interface mutableLambda extends Lambda {
  <S extends Top & { readonly "ast": AST.Arrays }>(self: S): mutable<S>
  readonly "~lambda.out": this["~lambda.in"] extends Top & { readonly "ast": AST.Arrays } ? mutable<this["~lambda.in"]>
    : "Error: schema not eligible for mutable"
}

/**
 * Makes arrays or tuples mutable.
 *
 * @since 4.0.0
 */
export const mutable = Struct_.lambda<mutableLambda>((schema) => {
  return makeProto(new AST.Arrays(true, schema.ast.elements, schema.ast.rest), { schema })
})

/**
 * @since 4.0.0
 */
export interface Union<Members extends ReadonlyArray<Top>> extends
  Bottom<
    { [K in keyof Members]: Members[K]["Type"] }[number],
    { [K in keyof Members]: Members[K]["Encoded"] }[number],
    { [K in keyof Members]: Members[K]["DecodingServices"] }[number],
    { [K in keyof Members]: Members[K]["EncodingServices"] }[number],
    AST.Union<{ [K in keyof Members]: Members[K]["ast"] }[number]>,
    Union<Members>,
    { [K in keyof Members]: Members[K]["~type.make"] }[number],
    { [K in keyof Members]: Members[K]["Iso"] }[number]
  >
{
  readonly "~rebuild.out": this
  readonly members: Members
  /**
   * Returns a new union with the members modified by the provided function.
   *
   * **Options**
   *
   * - `unsafePreserveChecks` - if `true`, keep any `.check(...)` constraints
   *   that were attached to the original union. Defaults to `false`.
   *
   *   **Warning**: This is an unsafe operation. Since `mapFields`
   *   transformations change the schema type, the original refinement functions
   *   may no longer be valid or safe to apply to the transformed schema. Only
   *   use this option if you have verified that your refinements remain correct
   *   after the transformation.
   */
  mapMembers<To extends ReadonlyArray<Top>>(
    f: (members: Members) => To,
    options?: {
      readonly unsafePreserveChecks?: boolean | undefined
    } | undefined
  ): Union<Simplify<Readonly<To>>>
}

function makeUnion<Members extends ReadonlyArray<Top>>(
  ast: AST.Union<Members[number]["ast"]>,
  members: Members
): Union<Members> {
  return makeProto(ast, {
    members,
    mapMembers<To extends ReadonlyArray<Top>>(
      this: Union<Members>,
      f: (members: Members) => To,
      options?: {
        readonly unsafePreserveChecks?: boolean | undefined
      } | undefined
    ): Union<Simplify<Readonly<To>>> {
      const members = f(this.members)
      return makeUnion(
        AST.union(members, this.ast.mode, options?.unsafePreserveChecks ? this.ast.checks : undefined),
        members
      )
    }
  })
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
  return makeUnion(AST.union(members, options?.mode ?? "anyOf", undefined), members)
}

/**
 * @since 4.0.0
 */
export interface Literals<L extends ReadonlyArray<AST.LiteralValue>>
  extends Bottom<L[number], L[number], never, never, AST.Union<AST.Literal>, Literals<L>>
{
  readonly "~rebuild.out": this
  readonly literals: L
  readonly members: { readonly [K in keyof L]: Literal<L[K]> }
  /**
   * Map over the members of the union.
   */
  mapMembers<To extends ReadonlyArray<Top>>(f: (members: this["members"]) => To): Union<Simplify<Readonly<To>>>

  pick<const L2 extends ReadonlyArray<L[number]>>(literals: L2): Literals<L2>

  transform<const L2 extends { readonly [I in keyof L]: AST.LiteralValue }>(
    to: L2
  ): Union<{ [I in keyof L]: decodeTo<Literal<L2[I]>, Literal<L[I]>> }>
}

/**
 * @see {@link Literal} for a schema that represents a single literal.
 * @category Constructors
 * @since 4.0.0
 */
export function Literals<const L extends ReadonlyArray<AST.LiteralValue>>(literals: L): Literals<L> {
  const members = literals.map(Literal) as { readonly [K in keyof L]: Literal<L[K]> }
  return makeProto(AST.union(members, "anyOf", undefined), {
    literals,
    members,
    mapMembers<To extends ReadonlyArray<Top>>(
      this: Literals<L>,
      f: (members: Literals<L>["members"]) => To
    ): Union<Simplify<Readonly<To>>> {
      return Union(f(this.members))
    },
    pick<const L2 extends ReadonlyArray<L[number]>>(literals: L2): Literals<L2> {
      return Literals(literals)
    },
    transform<const L2 extends { readonly [I in keyof L]: AST.LiteralValue }>(
      to: L2
    ): Union<{ [I in keyof L]: decodeTo<Literal<L2[I]>, Literal<L[I]>> }> {
      return Union(members.map((member, index) => member.transform(to[index]))) as any
    }
  })
}

/**
 * @since 4.0.0
 */
export interface NullOr<S extends Top> extends Union<readonly [S, Null]> {}

interface NullOrLambda extends Lambda {
  <S extends Top>(self: S): NullOr<S>
  readonly "~lambda.out": this["~lambda.in"] extends Top ? NullOr<this["~lambda.in"]> : never
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export const NullOr = Struct_.lambda<NullOrLambda>((self) => Union([self, Null]))

/**
 * @since 4.0.0
 */
export interface UndefinedOr<S extends Top> extends Union<readonly [S, Undefined]> {}

interface UndefinedOrLambda extends Lambda {
  <S extends Top>(self: S): UndefinedOr<S>
  readonly "~lambda.out": this["~lambda.in"] extends Top ? UndefinedOr<this["~lambda.in"]> : never
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export const UndefinedOr = Struct_.lambda<UndefinedOrLambda>((self) => Union([self, Undefined]))

/**
 * @since 4.0.0
 */
export interface NullishOr<S extends Top> extends Union<readonly [S, Null, Undefined]> {}

interface NullishOrLambda extends Lambda {
  <S extends Top>(self: S): NullishOr<S>
  readonly "~lambda.out": this["~lambda.in"] extends Top ? NullishOr<this["~lambda.in"]> : never
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export const NullishOr = Struct_.lambda<NullishOrLambda>((self) => Union([self, Null, Undefined]))

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
    S["~type.make.in"],
    S["Iso"],
    S["~type.parameters"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  readonly "~rebuild.out": this
}

/**
 * Creates a suspended schema that defers evaluation until needed. This is
 * essential for creating recursive schemas where a schema references itself,
 * preventing infinite recursion during schema definition.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function suspend<S extends Top>(f: () => S): suspend<S> {
  return make(new AST.Suspend(() => f().ast))
}

/**
 * @category Filtering
 * @since 4.0.0
 */
export function check<S extends Top>(...checks: readonly [AST.Check<S["Type"]>, ...Array<AST.Check<S["Type"]>>]) {
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
    refine<T, S>,
    S["~type.make.in"],
    T,
    S["~type.parameters"],
    T,
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  readonly "~rebuild.out": this
  readonly schema: S
}

/**
 * @category Filtering
 * @since 4.0.0
 */
export function refine<T extends E, E>(refine: AST.Refine<T, E>) {
  return <S extends Schema<E>>(schema: S): refine<S["Type"] & T, S> =>
    makeProto(AST.appendChecks(schema.ast, [refine]), { schema })
}

/**
 * @category Filtering
 * @since 4.0.0
 */
export function refineByGuard<T extends S["Type"], S extends Top>(
  is: (value: S["Type"]) => value is T,
  annotations?: Annotations.Filter
) {
  return (self: S): refine<T, S> => self.pipe(refine(makeRefinedByGuard(is, annotations)))
}

type DistributeBrands<T, B> =
  & T
  & UnionToIntersection<B extends infer U extends string | symbol ? Brand.Brand<U> : never>

/**
 * @since 4.0.0
 */
export interface brand<S extends Top, B> extends
  Bottom<
    DistributeBrands<S["Type"], B>,
    S["Encoded"],
    S["DecodingServices"],
    S["EncodingServices"],
    S["ast"],
    brand<S, B>,
    S["~type.make.in"],
    DistributeBrands<S["Type"], B>,
    S["~type.parameters"],
    DistributeBrands<S["Type"], B>,
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  readonly "~rebuild.out": this
  readonly schema: S
}

/**
 * @category Branding
 * @since 4.0.0
 */
export function brand<B extends string | symbol>() {
  return <S extends Top>(schema: S): brand<S, B> => makeProto(schema.ast, { schema })
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function fromBrand<A extends Brand.Brand<any>>(ctor: Brand.Constructor<A>) {
  return <S extends Top & { readonly "Type": Brand.Brand.Unbranded<A> }>(
    self: S
  ): brand<S["~rebuild.out"], Brand.Brand.Keys<A>> => {
    return (ctor.checks ? self.check(...ctor.checks) : self.annotate({})).pipe(brand<any>())
  }
}

/**
 * @since 4.0.0
 */
export interface middlewareDecoding<S extends Top, RD> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    RD,
    S["EncodingServices"],
    S["ast"],
    middlewareDecoding<S, RD>,
    S["~type.make.in"],
    S["Iso"],
    S["~type.parameters"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  readonly "~rebuild.out": this
  readonly schema: S
}

/**
 * @since 4.0.0
 */
export function middlewareDecoding<S extends Top, RD>(
  decode: (
    effect: Effect.Effect<Option_.Option<S["Type"]>, Issue.Issue, S["DecodingServices"]>,
    options: AST.ParseOptions
  ) => Effect.Effect<Option_.Option<S["Type"]>, Issue.Issue, RD>
) {
  return (schema: S): middlewareDecoding<S, RD> =>
    makeProto(
      AST.decodingMiddleware(schema.ast, new Transformation.Middleware(decode, identity)),
      { schema }
    )
}

/**
 * @since 4.0.0
 */
export interface middlewareEncoding<S extends Top, RE> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingServices"],
    RE,
    S["ast"],
    middlewareEncoding<S, RE>,
    S["~type.make.in"],
    S["Iso"],
    S["~type.parameters"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  readonly "~rebuild.out": this
  readonly schema: S
}

/**
 * @since 4.0.0
 */
export function middlewareEncoding<S extends Top, RE>(
  encode: (
    effect: Effect.Effect<Option_.Option<S["Encoded"]>, Issue.Issue, S["EncodingServices"]>,
    options: AST.ParseOptions
  ) => Effect.Effect<Option_.Option<S["Encoded"]>, Issue.Issue, RE>
) {
  return (schema: S): middlewareEncoding<S, RE> =>
    makeProto(
      AST.encodingMiddleware(schema.ast, new Transformation.Middleware(identity, encode)),
      { schema }
    )
}

/**
 * @since 4.0.0
 */
export function catchDecoding<S extends Top>(
  f: (issue: Issue.Issue) => Effect.Effect<Option_.Option<S["Type"]>, Issue.Issue>
): (self: S) => S["~rebuild.out"] {
  return catchDecodingWithContext(f)
}

/**
 * @since 4.0.0
 */
export function catchDecodingWithContext<S extends Top, R = never>(
  f: (issue: Issue.Issue) => Effect.Effect<Option_.Option<S["Type"]>, Issue.Issue, R>
) {
  return (self: S): middlewareDecoding<S, S["DecodingServices"] | R> =>
    self.pipe(middlewareDecoding(Effect.catchEager(f)))
}

/**
 * @since 4.0.0
 */
export function catchEncoding<S extends Top>(
  f: (issue: Issue.Issue) => Effect.Effect<Option_.Option<S["Encoded"]>, Issue.Issue>
): (self: S) => S["~rebuild.out"] {
  return catchEncodingWithContext(f)
}

/**
 * @since 4.0.0
 */
export function catchEncodingWithContext<S extends Top, R = never>(
  f: (issue: Issue.Issue) => Effect.Effect<Option_.Option<S["Encoded"]>, Issue.Issue, R>
) {
  return (self: S): middlewareEncoding<S, S["EncodingServices"] | R> =>
    self.pipe(middlewareEncoding(Effect.catchEager(f)))
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
    To["~type.make.in"],
    To["Iso"],
    To["~type.parameters"],
    To["~type.make"],
    To["~type.mutability"],
    To["~type.optionality"],
    To["~type.constructor.default"],
    From["~encoded.mutability"],
    From["~encoded.optionality"]
  >
{
  readonly "~rebuild.out": this
  readonly from: From
  readonly to: To
}

/**
 * @since 4.0.0
 */
export interface compose<To extends Top, From extends Top> extends decodeTo<To, From> {}

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
    return makeProto(
      AST.decodeTo(
        from.ast,
        to.ast,
        transformation ? Transformation.make(transformation) : Transformation.passthrough()
      ),
      {
        from,
        to
      }
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
    return transformation ?
      to.pipe(decodeTo(from, transformation)) :
      to.pipe(decodeTo(from))
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
export interface WithoutConstructorDefault {
  readonly "~type.constructor.default": "no-default"
}

/**
 * @since 4.0.0
 */
export interface withConstructorDefault<S extends Top & WithoutConstructorDefault> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingServices"],
    S["EncodingServices"],
    S["ast"],
    withConstructorDefault<S>,
    S["~type.make.in"],
    S["Iso"],
    S["~type.parameters"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    "with-default",
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  readonly "~rebuild.out": this
  readonly schema: S
}

/**
 * @since 4.0.0
 */
export function withConstructorDefault<S extends Top & WithoutConstructorDefault>(
  defaultValue: (
    input: Option_.Option<undefined>
    // `S["~type.make.in"]` instead of `S["Type"]` is intentional here because
    // it makes easier to define the default value if there are nested defaults
  ) => Option_.Option<S["~type.make.in"]> | Effect.Effect<Option_.Option<S["~type.make.in"]>>
) {
  return (schema: S): withConstructorDefault<S> => {
    return makeProto(
      AST.withConstructorDefault(schema.ast, defaultValue),
      { schema }
    )
  }
}

/**
 * @since 4.0.0
 */
export interface withDecodingDefaultKey<S extends Top> extends decodeTo<S, optionalKey<encodedCodec<S>>> {}

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
export interface withDecodingDefault<S extends Top> extends decodeTo<S, optional<encodedCodec<S>>> {}

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
export interface tag<Tag extends AST.LiteralValue> extends withConstructorDefault<Literal<Tag>> {}

/**
 * Creates a schema for a literal value and automatically provides itself as a
 * default.
 *
 * The `tag` function combines a literal schema with a constructor default,
 * making it perfect for discriminated unions and tagged data structures. The
 * tag value is automatically provided when the field is missing during
 * construction.
 *
 * @since 4.0.0
 */
export function tag<Tag extends AST.LiteralValue>(literal: Tag): tag<Tag> {
  return Literal(literal).pipe(withConstructorDefault(() => Option_.some(literal)))
}

/**
 * Similar to `tag`, but provides itself as a default when decoding and omits
 * the value from the output when encoding.
 *
 * @since 4.0.0
 */
export function tagDefaultOmit<Tag extends AST.LiteralValue>(literal: Tag) {
  return tag(literal).pipe(withDecodingDefaultKey(() => literal, { encodingStrategy: "omit" }))
}

/**
 * @since 4.0.0
 */
export type TaggedStruct<Tag extends AST.LiteralValue, Fields extends Struct.Fields> = Struct<
  { readonly _tag: tag<Tag> } & Fields
>

/**
 * A tagged struct is a struct that includes a `_tag` field. This field is used
 * to identify the specific variant of the object, which is especially useful
 * when working with union types.
 *
 * When using the `makeUnsafe` method, the `_tag` field is optional and will be
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
export function TaggedStruct<const Tag extends AST.LiteralValue, const Fields extends Struct.Fields>(
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

/** @internal */
export function getTag(tag: PropertyKey, ast: AST.AST): PropertyKey | undefined {
  if (AST.isObjects(ast)) {
    const ps = ast.propertySignatures.find((p) => p.name === tag)
    if (ps) {
      if (AST.isLiteral(ps.type) && Predicate.isPropertyKey(ps.type.literal)) {
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
      if (AST.isUnion(ast)) {
        schema.members.forEach(process)
      } else if (AST.isObjects(ast)) {
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
    AST.Union<AST.Objects>,
    TaggedUnion<Cases>,
    { [K in keyof Cases]: Cases[K]["~type.make"] }[keyof Cases]
  >
{
  readonly "~rebuild.out": this
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

/**
 * @category Constructors
 * @since 4.0.0
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
  return makeProto(union.ast, { cases, isAnyOf, guards, match })
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
    S["~type.make.in"],
    S["Iso"],
    S["~type.parameters"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  // intentionally left without `readonly "~rebuild.out": this`
  new(_: never): S["Type"] & Brand
}

/**
 * @since 4.0.0
 */
export function Opaque<Self, Brand = {}>() {
  return <S extends Top>(schema: S): Opaque<Self, S, Brand> & Omit<S, "Type"> => {
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    class Opaque {}
    Object.setPrototypeOf(Opaque, schema)
    return Opaque as any
  }
}

/**
 * @since 4.0.0
 */
export interface instanceOf<T, Iso = T> extends declare<T, Iso> {
  readonly "~rebuild.out": this
}

/**
 * Creates a schema that validates an instance of a specific class constructor.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function instanceOf<C extends abstract new(...args: any) => any, Iso = InstanceType<C>>(
  constructor: C,
  annotations?: Annotations.Declaration<InstanceType<C>> | undefined
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

// -----------------------------------------------------------------------------
// Checks
// -----------------------------------------------------------------------------

/**
 * @category Checks Constructors
 * @since 4.0.0
 */
export const makeRefinedByGuard: <T extends E, E>(
  is: (value: E) => value is T,
  annotations?: Annotations.Filter
) => AST.Refinement<T, E> = AST.makeRefinedByGuard

/**
 * @category Checks Combinators
 * @since 4.0.0
 */
export function isRefinedByGuard<T extends E, E>(
  is: (value: E) => value is T,
  annotations?: Annotations.Filter
) {
  return (self: AST.Check<E>): AST.RefinementGroup<T, E> => {
    return self.and(makeRefinedByGuard(is, annotations))
  }
}

/**
 * @category Checks Combinators
 * @since 4.0.0
 */
export function isBranded<B extends string | symbol>() {
  return <T>(self: AST.Check<T>): AST.RefinementGroup<T & Brand.Brand<B>, T> => {
    return self as any
  }
}

/**
 * @category Checks Constructors
 * @since 4.0.0
 */
export const makeFilter: <T>(
  filter: (input: T, ast: AST.AST, options: AST.ParseOptions) => undefined | boolean | string | Issue.Issue | {
    readonly path: ReadonlyArray<PropertyKey>
    readonly message: string
  },
  annotations?: Annotations.Filter | undefined,
  abort?: boolean
) => AST.Filter<T> = AST.makeFilter

/**
 * @category Checks Constructors
 * @since 4.0.0
 */
export function makeFilterGroup<T>(
  checks: readonly [AST.Check<T>, AST.Check<T>, ...Array<AST.Check<T>>],
  annotations: Annotations.Filter | undefined = undefined
): AST.FilterGroup<T> {
  return new AST.FilterGroup(checks, annotations)
}

const TRIMMED_PATTERN = "^\\S[\\s\\S]*\\S$|^\\S$|^$"

/**
 * Validates that a string has no leading or trailing whitespace.
 *
 * **JSON Schema**
 *
 * This check corresponds to a `pattern` constraint in JSON Schema that
 * matches strings without leading or trailing whitespace.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `patterns`
 * constraint to ensure generated strings match the trimmed pattern.
 *
 * @category String checks
 * @since 4.0.0
 */
export function isTrimmed(annotations?: Annotations.Filter) {
  return makeFilter(
    (s: string) => s.trim() === s,
    Annotations.combine({
      expected: "a string with no leading or trailing whitespace",
      jsonSchemaConstraint: () => ({ pattern: TRIMMED_PATTERN }),
      meta: {
        _tag: "isTrimmed"
      },
      arbitraryConstraint: {
        string: {
          patterns: [TRIMMED_PATTERN]
        }
      }
    }, annotations)
  )
}

/**
 * Validates that a string matches the specified regular expression pattern.
 *
 * **JSON Schema**
 *
 * This check corresponds to the `pattern` constraint in JSON Schema.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `patterns`
 * constraint to ensure generated strings match the specified regex pattern.
 *
 * @category String checks
 * @since 4.0.0
 */
export const isPattern: (regex: RegExp, annotations?: Annotations.Filter) => AST.Filter<string> = AST.isPattern

/**
 * Validates that a string represents a valid number (can be parsed as a number).
 *
 * **JSON Schema**
 *
 * This check corresponds to a `pattern` constraint in JSON Schema that matches
 * strings representing numbers.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `patterns`
 * constraint to ensure generated strings match the number string pattern.
 *
 * @category String checks
 * @since 4.0.0
 */
export const isNumberString: (annotations?: Annotations.Filter) => AST.Filter<string> = AST.isNumberString

/**
 * Validates that a string represents a valid BigInt (can be parsed as a BigInt).
 *
 * **JSON Schema**
 *
 * This check corresponds to a `pattern` constraint in JSON Schema that matches
 * strings representing BigInt values.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `patterns`
 * constraint to ensure generated strings match the BigInt string pattern.
 *
 * @category String checks
 * @since 4.0.0
 */
export const isBigIntString: (annotations?: Annotations.Filter) => AST.Filter<string> = AST.isBigIntString

/**
 * Validates that a string represents a valid Symbol (can be parsed as a Symbol).
 *
 * **JSON Schema**
 *
 * This check corresponds to a `pattern` constraint in JSON Schema that matches
 * strings representing Symbol values.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `patterns`
 * constraint to ensure generated strings match the Symbol string pattern.
 *
 * @category String checks
 * @since 4.0.0
 */
export const isSymbolString: (annotations?: Annotations.Filter) => AST.Filter<string> = AST.isSymbolString

/**
 * Returns a regex for validating an RFC 4122 UUID.
 *
 * Optionally specify a version 1-8. If no version is specified, all versions are supported.
 */
const getUUIDRegex = (version?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8): RegExp => {
  if (version) {
    return new RegExp(
      `^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`
    )
  }
  return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000)$/
}

/**
 * Validates that a string is a valid Universally Unique Identifier (UUID).
 * Optionally specify a version (1-8) to validate against a specific UUID version.
 *
 * **JSON Schema**
 *
 * This check corresponds to a `pattern` constraint in JSON Schema that matches
 * UUID format, and includes a `format: "uuid"` annotation.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `patterns`
 * constraint to ensure generated strings match the UUID pattern.
 *
 * @category String checks
 * @since 4.0.0
 */
export function isUUID(version?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) {
  const re = getUUIDRegex(version)
  return isPattern(re, {
    expected: version ? `a UUID v${version}` : "a UUID",
    jsonSchemaConstraint: () => ({
      pattern: re.source,
      format: "uuid"
    })
  })
}

/**
 * Validates that a string is a valid ULID (Universally Unique Lexicographically
 * Sortable Identifier).
 *
 * **JSON Schema**
 *
 * This check corresponds to a `pattern` constraint in JSON Schema that matches
 * the ULID format.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `patterns`
 * constraint to ensure generated strings match the ULID pattern.
 *
 * @category String checks
 * @since 4.0.0
 */
export function isULID(annotations?: Annotations.Filter) {
  const regex = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/
  return isPattern(
    regex,
    Annotations.combine({
      meta: {
        _tag: "isULID",
        regex
      }
    }, annotations)
  )
}

/**
 * Validates that a string is valid Base64 encoded data.
 *
 * **JSON Schema**
 *
 * This check corresponds to a `pattern` constraint in JSON Schema that matches
 * Base64 format.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `patterns`
 * constraint to ensure generated strings match the Base64 pattern.
 *
 * @category String checks
 * @since 4.0.0
 */
export function isBase64(annotations?: Annotations.Filter) {
  const regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/
  return isPattern(
    regex,
    Annotations.combine({
      expected: "a base64 encoded string",
      meta: {
        _tag: "isBase64",
        regex
      }
    }, annotations)
  )
}

/**
 * Validates that a string is valid Base64URL encoded data (Base64 with URL-safe
 * characters).
 *
 * **JSON Schema**
 *
 * This check corresponds to a `pattern` constraint in JSON Schema that matches
 * Base64URL format.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `patterns`
 * constraint to ensure generated strings match the Base64URL pattern.
 *
 * @category String checks
 * @since 4.0.0
 */
export function isBase64Url(annotations?: Annotations.Filter) {
  const regex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/
  return isPattern(
    regex,
    Annotations.combine({
      expected: "a base64url encoded string",
      meta: {
        _tag: "isBase64Url",
        regex
      }
    }, annotations)
  )
}

/**
 * Validates that a string starts with the specified prefix.
 *
 * **JSON Schema**
 *
 * This check corresponds to a `pattern` constraint in JSON Schema that matches
 * strings starting with the specified prefix.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `patterns`
 * constraint to ensure generated strings start with the required prefix.
 *
 * @category String checks
 * @since 4.0.0
 */
export function isStartsWith(startsWith: string, annotations?: Annotations.Filter) {
  const formatted = JSON.stringify(startsWith)
  return makeFilter(
    (s: string) => s.startsWith(startsWith),
    Annotations.combine({
      expected: `a string starting with ${formatted}`,
      jsonSchemaConstraint: () => ({ pattern: `^${startsWith}` }),
      meta: {
        _tag: "isStartsWith",
        startsWith
      },
      arbitraryConstraint: {
        string: {
          patterns: [`^${startsWith}`]
        }
      }
    }, annotations)
  )
}

/**
 * Validates that a string ends with the specified suffix.
 *
 * **JSON Schema**
 *
 * This check corresponds to a `pattern` constraint in JSON Schema that matches
 * strings ending with the specified suffix.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `patterns`
 * constraint to ensure generated strings end with the required suffix.
 *
 * @category String checks
 * @since 4.0.0
 */
export function isEndsWith(endsWith: string, annotations?: Annotations.Filter) {
  const formatted = JSON.stringify(endsWith)
  return makeFilter(
    (s: string) => s.endsWith(endsWith),
    Annotations.combine({
      expected: `a string ending with ${formatted}`,
      jsonSchemaConstraint: () => ({ pattern: `${endsWith}$` }),
      meta: {
        _tag: "isEndsWith",
        endsWith
      },
      arbitraryConstraint: {
        string: {
          patterns: [`${endsWith}$`]
        }
      }
    }, annotations)
  )
}

/**
 * Validates that a string contains the specified substring.
 *
 * **JSON Schema**
 *
 * This check corresponds to a `pattern` constraint in JSON Schema that matches
 * strings containing the specified substring.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `patterns`
 * constraint to ensure generated strings contain the required substring.
 *
 * @category String checks
 * @since 4.0.0
 */
export function isIncludes(includes: string, annotations?: Annotations.Filter) {
  const formatted = JSON.stringify(includes)
  return makeFilter(
    (s: string) => s.includes(includes),
    Annotations.combine({
      expected: `a string including ${formatted}`,
      jsonSchemaConstraint: () => ({ pattern: includes }),
      meta: {
        _tag: "isIncludes",
        includes
      },
      arbitraryConstraint: {
        string: {
          patterns: [includes]
        }
      }
    }, annotations)
  )
}

const UPPERCASED_PATTERN = "^[^a-z]*$"

/**
 * Validates that a string contains only uppercase characters.
 *
 * **JSON Schema**
 *
 * This check corresponds to a `pattern` constraint in JSON Schema that matches
 * strings with only uppercase characters.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `patterns`
 * constraint to ensure generated strings contain only uppercase characters.
 *
 * @category String checks
 * @since 4.0.0
 */
export function isUppercased(annotations?: Annotations.Filter) {
  return makeFilter(
    (s: string) => s.toUpperCase() === s,
    Annotations.combine({
      expected: "a string with all characters in uppercase",
      jsonSchemaConstraint: () => ({ pattern: UPPERCASED_PATTERN }),
      meta: {
        _tag: "isUppercased"
      },
      arbitraryConstraint: {
        string: {
          patterns: [UPPERCASED_PATTERN]
        }
      }
    }, annotations)
  )
}

const LOWERCASED_PATTERN = "^[^A-Z]*$"

/**
 * Validates that a string contains only lowercase characters.
 *
 * **JSON Schema**
 *
 * This check corresponds to a `pattern` constraint in JSON Schema that matches
 * strings with only lowercase characters.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `patterns`
 * constraint to ensure generated strings contain only lowercase characters.
 *
 * @category String checks
 * @since 4.0.0
 */
export function isLowercased(annotations?: Annotations.Filter) {
  return makeFilter(
    (s: string) => s.toLowerCase() === s,
    Annotations.combine({
      expected: "a string with all characters in lowercase",
      jsonSchemaConstraint: () => ({ pattern: LOWERCASED_PATTERN }),
      meta: {
        _tag: "isLowercased"
      },
      arbitraryConstraint: {
        string: {
          patterns: [LOWERCASED_PATTERN]
        }
      }
    }, annotations)
  )
}

const CAPITALIZED_PATTERN = "^[^a-z]?.*$"

/**
 * Validates that a string has its first character in uppercase.
 *
 * **JSON Schema**
 *
 * This check corresponds to a `pattern` constraint in JSON Schema that matches
 * strings with the first character in uppercase.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `patterns`
 * constraint to ensure generated strings have the first character in uppercase.
 *
 * @category String checks
 * @since 4.0.0
 */
export function isCapitalized(annotations?: Annotations.Filter) {
  return makeFilter(
    (s: string) => s.charAt(0).toUpperCase() === s.charAt(0),
    Annotations.combine({
      expected: "a string with the first character in uppercase",
      jsonSchemaConstraint: () => ({ pattern: CAPITALIZED_PATTERN }),
      meta: {
        _tag: "isCapitalized"
      },
      arbitraryConstraint: {
        string: {
          patterns: [CAPITALIZED_PATTERN]
        }
      }
    }, annotations)
  )
}

const UNCAPITALIZED_PATTERN = "^[^A-Z]?.*$"

/**
 * Validates that a string has its first character in lowercase.
 *
 * **JSON Schema**
 *
 * This check corresponds to a `pattern` constraint in JSON Schema that matches
 * strings with the first character in lowercase.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `patterns`
 * constraint to ensure generated strings have the first character in lowercase.
 *
 * @category String checks
 * @since 4.0.0
 */
export function isUncapitalized(annotations?: Annotations.Filter) {
  return makeFilter(
    (s: string) => s.charAt(0).toLowerCase() === s.charAt(0),
    Annotations.combine({
      expected: "a string with the first character in lowercase",
      jsonSchemaConstraint: () => ({ pattern: UNCAPITALIZED_PATTERN }),
      meta: {
        _tag: "isUncapitalized"
      },
      arbitraryConstraint: {
        string: {
          patterns: [UNCAPITALIZED_PATTERN]
        }
      }
    }, annotations)
  )
}

/**
 * Validates that a number is finite (not `Infinity`, `-Infinity`, or `NaN`).
 *
 * **JSON Schema**
 *
 * This check does not have a direct JSON Schema equivalent, but ensures the
 * number is valid and finite.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies `noDefaultInfinity`
 * and `noNaN` constraints to ensure generated numbers are finite.
 *
 * @category Number checks
 * @since 4.0.0
 */
export function isFinite(annotations?: Annotations.Filter) {
  return makeFilter(
    (n: number) => globalThis.Number.isFinite(n),
    Annotations.combine({
      expected: "a finite number",
      meta: {
        _tag: "isFinite"
      },
      arbitraryConstraint: {
        number: {
          noDefaultInfinity: true,
          noNaN: true
        }
      }
    }, annotations)
  )
}

/**
 * @category Order checks
 * @since 4.0.0
 */
export function deriveIsGreaterThan<T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((exclusiveMinimum: T) => Annotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) {
  const greaterThan = Order.greaterThan(options.order)
  const fmt = options.format ?? format
  return (exclusiveMinimum: T, annotations?: Annotations.Filter) => {
    return makeFilter<T>(
      (input) => greaterThan(input, exclusiveMinimum),
      Annotations.combine({
        expected: `a value greater than ${fmt(exclusiveMinimum)}`,
        ...options.annotate?.(exclusiveMinimum)
      }, annotations)
    )
  }
}

/**
 * @category Order checks
 * @since 4.0.0
 */
export function deriveIsGreaterThanOrEqualTo<T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((exclusiveMinimum: T) => Annotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) {
  const greaterThanOrEqualTo = Order.greaterThanOrEqualTo(options.order)
  const fmt = options.format ?? format
  return (minimum: T, annotations?: Annotations.Filter) => {
    return makeFilter<T>(
      (input) => greaterThanOrEqualTo(input, minimum),
      Annotations.combine({
        expected: `a value greater than or equal to ${fmt(minimum)}`,
        ...options.annotate?.(minimum)
      }, annotations)
    )
  }
}

/**
 * @category Order checks
 * @since 4.0.0
 */
export function deriveIsLessThan<T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((exclusiveMaximum: T) => Annotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) {
  const lessThan = Order.lessThan(options.order)
  const fmt = options.format ?? format
  return (exclusiveMaximum: T, annotations?: Annotations.Filter) => {
    return makeFilter<T>(
      (input) => lessThan(input, exclusiveMaximum),
      Annotations.combine({
        expected: `a value less than ${fmt(exclusiveMaximum)}`,
        ...options.annotate?.(exclusiveMaximum)
      }, annotations)
    )
  }
}

/**
 * @category Order checks
 * @since 4.0.0
 */
export function deriveIsLessThanOrEqualTo<T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((exclusiveMaximum: T) => Annotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) {
  const lessThanOrEqualTo = Order.lessThanOrEqualTo(options.order)
  const fmt = options.format ?? format
  return (maximum: T, annotations?: Annotations.Filter) => {
    return makeFilter<T>(
      (input) => lessThanOrEqualTo(input, maximum),
      Annotations.combine({
        expected: `a value less than or equal to ${fmt(maximum)}`,
        ...options.annotate?.(maximum)
      }, annotations)
    )
  }
}

/**
 * @category Order checks
 * @since 4.0.0
 */
export function deriveIsBetween<T>(deriveOptions: {
  readonly order: Order.Order<T>
  readonly annotate?:
    | ((options: {
      readonly minimum: T
      readonly maximum: T
      readonly exclusiveMinimum?: boolean | undefined
      readonly exclusiveMaximum?: boolean | undefined
    }) => Annotations.Filter)
    | undefined
  readonly format?: (value: T) => string | undefined
}) {
  const greaterThanOrEqualTo = Order.greaterThanOrEqualTo(deriveOptions.order)
  const greaterThan = Order.greaterThan(deriveOptions.order)
  const lessThanOrEqualTo = Order.lessThanOrEqualTo(deriveOptions.order)
  const lessThan = Order.lessThan(deriveOptions.order)
  const fmt = deriveOptions.format ?? format
  return (options: {
    readonly minimum: T
    readonly maximum: T
    readonly exclusiveMinimum?: boolean | undefined
    readonly exclusiveMaximum?: boolean | undefined
  }, annotations?: Annotations.Filter) => {
    const gte = options.exclusiveMinimum ? greaterThan : greaterThanOrEqualTo
    const lte = options.exclusiveMaximum ? lessThan : lessThanOrEqualTo
    return makeFilter<T>(
      (input) => gte(input, options.minimum) && lte(input, options.maximum),
      Annotations.combine({
        expected: `a value between ${fmt(options.minimum)}${options.exclusiveMinimum ? " (excluded)" : ""} and ${
          fmt(options.maximum)
        }${options.exclusiveMaximum ? " (excluded)" : ""}`,
        jsonSchemaConstraint: () => ({
          minimum: options.exclusiveMinimum ? options.minimum : undefined,
          maximum: options.exclusiveMaximum ? options.maximum : undefined,
          exclusiveMinimum: options.exclusiveMinimum,
          exclusiveMaximum: options.exclusiveMaximum
        }),
        ...deriveOptions.annotate?.(options)
      }, annotations)
    )
  }
}

/**
 * @category Numeric checks
 * @since 4.0.0
 */
export function deriveIsMultipleOf<T>(options: {
  readonly remainder: (input: T, divisor: T) => T
  readonly zero: NoInfer<T>
  readonly annotate?: ((divisor: T) => Annotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) {
  return (divisor: T, annotations?: Annotations.Filter) => {
    const fmt = options.format ?? format
    return makeFilter<T>(
      (input) => options.remainder(input, divisor) === options.zero,
      Annotations.combine({
        expected: `a value that is a multiple of ${fmt(divisor)}`,
        ...options.annotate?.(divisor)
      }, annotations)
    )
  }
}

/**
 * Validates that a number is greater than the specified value (exclusive).
 *
 * **JSON Schema**
 *
 * This check corresponds to the `exclusiveMinimum` constraint in JSON Schema.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `min` constraint
 * with `minExcluded: true` to ensure generated numbers are greater than the
 * specified value.
 *
 * @category Number checks
 * @since 4.0.0
 */
export const isGreaterThan = deriveIsGreaterThan({
  order: Order.number,
  annotate: (exclusiveMinimum) => ({
    jsonSchemaConstraint: () => ({ exclusiveMinimum }),
    meta: {
      _tag: "isGreaterThan",
      exclusiveMinimum
    },
    arbitraryConstraint: {
      number: {
        min: exclusiveMinimum,
        minExcluded: true
      }
    }
  })
})

/**
 * Validates that a number is greater than or equal to the specified value
 * (inclusive).
 *
 * **JSON Schema**
 *
 * This check corresponds to the `minimum` constraint in JSON Schema.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `min` constraint
 * to ensure generated numbers are greater than or equal to the specified value.
 *
 * @category Number checks
 * @since 4.0.0
 */
export const isGreaterThanOrEqualTo = deriveIsGreaterThanOrEqualTo({
  order: Order.number,
  annotate: (minimum) => ({
    jsonSchemaConstraint: () => ({ minimum }),
    meta: {
      _tag: "isGreaterThanOrEqualTo",
      minimum
    },
    arbitraryConstraint: {
      number: {
        min: minimum
      }
    }
  })
})

/**
 * Validates that a number is less than the specified value (exclusive).
 *
 * **JSON Schema**
 *
 * This check corresponds to the `exclusiveMaximum` constraint in JSON Schema.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `max` constraint
 * with `maxExcluded: true` to ensure generated numbers are less than the
 * specified value.
 *
 * @category Number checks
 * @since 4.0.0
 */
export const isLessThan = deriveIsLessThan({
  order: Order.number,
  annotate: (exclusiveMaximum) => ({
    jsonSchemaConstraint: () => ({ exclusiveMaximum }),
    meta: {
      _tag: "isLessThan",
      exclusiveMaximum
    },
    arbitraryConstraint: {
      number: {
        max: exclusiveMaximum,
        maxExcluded: true
      }
    }
  })
})

/**
 * Validates that a number is less than or equal to the specified value
 * (inclusive).
 *
 * **JSON Schema**
 *
 * This check corresponds to the `maximum` constraint in JSON Schema.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `max` constraint
 * to ensure generated numbers are less than or equal to the specified value.
 *
 * @category Number checks
 * @since 4.0.0
 */
export const isLessThanOrEqualTo = deriveIsLessThanOrEqualTo({
  order: Order.number,
  annotate: (maximum) => ({
    jsonSchemaConstraint: () => ({ maximum }),
    meta: {
      _tag: "isLessThanOrEqualTo",
      maximum
    },
    arbitraryConstraint: {
      number: {
        max: maximum
      }
    }
  })
})

/**
 * Validates that a number is within a specified range. The range boundaries can
 * be inclusive or exclusive based on the provided options.
 *
 * **JSON Schema**
 *
 * This check corresponds to `minimum`/`maximum` or `exclusiveMinimum`/`exclusiveMaximum`
 * constraints in JSON Schema, depending on the options provided.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies `min` and `max`
 * constraints with optional `minExcluded` and `maxExcluded` flags to ensure
 * generated numbers fall within the specified range.
 *
 * @category Number checks
 * @since 4.0.0
 */
export const isBetween = deriveIsBetween({
  order: Order.number,
  annotate: (options) => {
    return {
      jsonSchemaConstraint: () => {
        const out: Record<string, unknown> = {}
        if (options.exclusiveMinimum) {
          out.exclusiveMinimum = options.minimum
        } else {
          out.minimum = options.minimum
        }
        if (options.exclusiveMaximum) {
          out.exclusiveMaximum = options.maximum
        } else {
          out.maximum = options.maximum
        }
        return out
      },
      meta: {
        _tag: "isBetween",
        ...options
      },
      arbitraryConstraint: {
        number: {
          min: options.minimum,
          max: options.maximum,
          ...(options.exclusiveMinimum && { minExcluded: true }),
          ...(options.exclusiveMaximum && { maxExcluded: true })
        }
      }
    }
  }
})

/**
 * Validates that a number is positive (greater than zero).
 *
 * **JSON Schema**
 *
 * This check corresponds to the `exclusiveMinimum: 0` constraint in JSON Schema.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `min` constraint
 * with `minExcluded: true` set to 0 to ensure generated numbers are positive.
 *
 * @category Number checks
 * @since 4.0.0
 */
export function isPositive(annotations?: Annotations.Filter) {
  return isGreaterThan(0, annotations)
}

/**
 * Validates that a number is negative (less than zero).
 *
 * **JSON Schema**
 *
 * This check corresponds to the `exclusiveMaximum: 0` constraint in JSON Schema.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `max` constraint
 * with `maxExcluded: true` set to 0 to ensure generated numbers are negative.
 *
 * @category Number checks
 * @since 4.0.0
 */
export function isNegative(annotations?: Annotations.Filter) {
  return isLessThan(0, annotations)
}

/**
 * Validates that a number is non-negative (greater than or equal to zero).
 *
 * **JSON Schema**
 *
 * This check corresponds to the `minimum: 0` constraint in JSON Schema.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `min` constraint
 * set to 0 to ensure generated numbers are non-negative.
 *
 * @category Number checks
 * @since 4.0.0
 */
export function isNonNegative(annotations?: Annotations.Filter) {
  return isGreaterThanOrEqualTo(0, annotations)
}

/**
 * Validates that a number is non-positive (less than or equal to zero).
 *
 * **JSON Schema**
 *
 * This check corresponds to the `maximum: 0` constraint in JSON Schema.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `max` constraint
 * set to 0 to ensure generated numbers are non-positive.
 *
 * @category Number checks
 * @since 4.0.0
 */
export function isNonPositive(annotations?: Annotations.Filter) {
  return isLessThanOrEqualTo(0, annotations)
}

/**
 * Validates that a number is a multiple of the specified divisor.
 *
 * **JSON Schema**
 *
 * This check corresponds to the `multipleOf` constraint in JSON Schema.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies constraints to ensure
 * generated numbers are multiples of the specified divisor.
 *
 * @category Number checks
 * @since 4.0.0
 */
export const isMultipleOf = deriveIsMultipleOf({
  remainder,
  zero: 0,
  annotate: (divisor) => ({
    expected: `a value that is a multiple of ${divisor}`,
    jsonSchemaConstraint: () => ({ multipleOf: Math.abs(divisor) })
  })
})

/**
 * Validates that a number is a safe integer (within the safe integer range
 * that can be exactly represented in JavaScript).
 *
 * **JSON Schema**
 *
 * This check corresponds to the `type: "integer"` constraint in JSON Schema.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies an `isInteger: true`
 * constraint to ensure generated numbers are integers.
 *
 * @category Integer checks
 * @since 4.0.0
 */
export function isInt(annotations?: Annotations.Filter) {
  return makeFilter(
    (n: number) => globalThis.Number.isSafeInteger(n),
    Annotations.combine({
      expected: "an integer",
      jsonSchemaConstraint: () => ({ type: "integer" }),
      meta: {
        _tag: "isInt"
      },
      arbitraryConstraint: {
        number: {
          isInteger: true
        }
      }
    }, annotations)
  )
}

/**
 * Validates that a number is a 32-bit signed integer (range: -2,147,483,648 to
 * 2,147,483,647).
 *
 * **JSON Schema**
 *
 * This check corresponds to the `format: "int32"` constraint in OpenAPI 3.1,
 * or `minimum`/`maximum` constraints in other JSON Schema targets.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies integer and range
 * constraints to ensure generated numbers are 32-bit signed integers.
 *
 * @category Integer checks
 * @since 4.0.0
 */
export function isInt32(annotations?: Annotations.Filter) {
  return new AST.FilterGroup(
    [
      isInt(annotations),
      isBetween({ minimum: -2147483648, maximum: 2147483647 })
    ],
    Annotations.combine({
      expected: "a 32-bit integer",
      jsonSchemaConstraint: (ctx) =>
        ctx.target === "oas3.1" ?
          { format: "int32" } :
          undefined,
      meta: {
        _tag: "isInt32"
      }
    }, annotations)
  )
}

/**
 * Validates that a number is a 32-bit unsigned integer (range: 0 to
 * 4,294,967,295).
 *
 * **JSON Schema**
 *
 * This check corresponds to the `format: "uint32"` constraint in OpenAPI 3.1,
 * or `minimum`/`maximum` constraints in other JSON Schema targets.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies integer and range
 * constraints to ensure generated numbers are 32-bit unsigned integers.
 *
 * @category Integer checks
 * @since 4.0.0
 */
export function isUint32(annotations?: Annotations.Filter) {
  return new AST.FilterGroup(
    [
      isInt(),
      isBetween({ minimum: 0, maximum: 4294967295 })
    ],
    Annotations.combine({
      expected: "a 32-bit unsigned integer",
      jsonSchemaConstraint: (ctx) =>
        ctx.target === "oas3.1" ?
          { format: "uint32" } :
          undefined,
      meta: {
        _tag: "isUint32"
      }
    }, annotations)
  )
}

/**
 * Validates that a Date object represents a valid date (not an invalid date
 * like `new Date("invalid")`).
 *
 * **JSON Schema**
 *
 * This check does not have a direct JSON Schema equivalent, as JSON Schema
 * validates date strings, not Date objects.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `noInvalidDate`
 * constraint to ensure generated Date objects are valid.
 *
 * @category Date checks
 * @since 4.0.0
 */
export function isValidDate(annotations?: Annotations.Filter) {
  return makeFilter<globalThis.Date>(
    (date) => !isNaN(date.getTime()),
    Annotations.combine({
      expected: "a valid date",
      meta: {
        _tag: "isValidDate"
      },
      arbitraryConstraint: {
        date: {
          noInvalidDate: true
        }
      }
    }, annotations)
  )
}

/**
 * Validates that a Date is greater than or equal to the specified date
 * (inclusive).
 *
 * **JSON Schema**
 *
 * This check does not have a direct JSON Schema equivalent, as JSON Schema
 * validates date strings, not Date objects.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `min` constraint
 * to ensure generated Date objects are greater than or equal to the specified
 * date.
 *
 * @category Date checks
 * @since 4.0.0
 */
export const isGreaterThanOrEqualToDate = deriveIsGreaterThanOrEqualTo({
  order: Order.Date,
  annotate: (minimum) => ({
    meta: {
      _tag: "isGreaterThanOrEqualToDate",
      minimum
    },
    arbitraryConstraint: {
      date: {
        min: minimum
      }
    }
  })
})

/**
 * Validates that a Date is less than or equal to the specified date
 * (inclusive).
 *
 * **JSON Schema**
 *
 * This check does not have a direct JSON Schema equivalent, as JSON Schema
 * validates date strings, not Date objects.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `max` constraint
 * to ensure generated Date objects are less than or equal to the specified
 * date.
 *
 * @category Date checks
 * @since 4.0.0
 */
export const isLessThanOrEqualToDate = deriveIsLessThanOrEqualTo({
  order: Order.Date,
  annotate: (maximum) => ({
    meta: {
      _tag: "isLessThanOrEqualToDate",
      maximum
    },
    arbitraryConstraint: {
      date: {
        max: maximum
      }
    }
  })
})

/**
 * Validates that a Date is within a specified range. The range boundaries can
 * be inclusive or exclusive based on the provided options.
 *
 * **JSON Schema**
 *
 * This check does not have a direct JSON Schema equivalent, as JSON Schema
 * validates date strings, not Date objects.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies `min` and `max`
 * constraints to ensure generated Date objects fall within the specified range.
 *
 * @category Date checks
 * @since 4.0.0
 */
export const isBetweenDate = deriveIsBetween({
  order: Order.Date,
  annotate: (options) => ({
    meta: {
      _tag: "isBetweenDate",
      ...options
    },
    arbitraryConstraint: {
      date: {
        min: options.minimum,
        max: options.maximum
      }
    }
  })
})

/**
 * Validates that a BigInt is greater than or equal to the specified value
 * (inclusive).
 *
 * **JSON Schema**
 *
 * This check does not have a direct JSON Schema equivalent, as JSON Schema
 * does not natively support BigInt. It would need to be represented as a
 * string with validation.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `min` constraint
 * to ensure generated BigInt values are greater than or equal to the specified
 * value.
 *
 * @category BigInt checks
 * @since 4.0.0
 */
export const isGreaterThanOrEqualToBigInt = deriveIsGreaterThanOrEqualTo({
  order: Order.bigint,
  annotate: (minimum) => ({
    meta: {
      _tag: "isGreaterThanOrEqualToBigInt",
      minimum
    },
    arbitraryConstraint: {
      bigint: {
        min: minimum
      }
    }
  })
})

/**
 * Validates that a BigInt is less than or equal to the specified value
 * (inclusive).
 *
 * **JSON Schema**
 *
 * This check does not have a direct JSON Schema equivalent, as JSON Schema
 * does not natively support BigInt. It would need to be represented as a
 * string with validation.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `max` constraint
 * to ensure generated BigInt values are less than or equal to the specified
 * value.
 *
 * @category BigInt checks
 * @since 4.0.0
 */
export const isLessThanOrEqualToBigInt = deriveIsLessThanOrEqualTo({
  order: Order.bigint,
  annotate: (maximum) => ({
    meta: {
      _tag: "isLessThanOrEqualToBigInt",
      maximum
    },
    arbitraryConstraint: {
      bigint: {
        max: maximum
      }
    }
  })
})

/**
 * Validates that a BigInt is within a specified range. The range boundaries can
 * be inclusive or exclusive based on the provided options.
 *
 * **JSON Schema**
 *
 * This check does not have a direct JSON Schema equivalent, as JSON Schema
 * does not natively support BigInt. It would need to be represented as a
 * string with validation.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies `min` and `max`
 * constraints to ensure generated BigInt values fall within the specified
 * range.
 *
 * @category BigInt checks
 * @since 4.0.0
 */
export const isBetweenBigInt = deriveIsBetween({
  order: Order.bigint,
  annotate: (options) => ({
    meta: {
      _tag: "isBetweenBigInt",
      ...options
    },
    arbitraryConstraint: {
      bigint: {
        min: options.minimum,
        max: options.maximum
      }
    }
  })
})

/**
 * Validates that a BigInt is non-negative (greater than or equal to zero).
 *
 * **JSON Schema**
 *
 * This check does not have a direct JSON Schema equivalent, as JSON Schema
 * does not natively support BigInt. It would need to be represented as a
 * string with validation.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `min` constraint
 * set to 0n to ensure generated BigInt values are non-negative.
 *
 * @category BigInt checks
 * @since 4.0.0
 */
export function isNonNegativeBigInt(annotations?: Annotations.Filter) {
  return isGreaterThanOrEqualToBigInt(0n, annotations)
}

/**
 * Validates that a BigInt is non-positive (less than or equal to zero).
 *
 * **JSON Schema**
 *
 * This check does not have a direct JSON Schema equivalent, as JSON Schema
 * does not natively support BigInt. It would need to be represented as a
 * string with validation.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `max` constraint
 * set to 0n to ensure generated BigInt values are non-positive.
 *
 * @category BigInt checks
 * @since 4.0.0
 */
export function isNonPositiveBigInt(annotations?: Annotations.Filter) {
  return isLessThanOrEqualToBigInt(0n, annotations)
}

/**
 * Validates that a value has at least the specified length. Works with strings
 * and arrays.
 *
 * **JSON Schema**
 *
 * This check corresponds to the `minLength` constraint for strings or the
 * `minItems` constraint for arrays in JSON Schema.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `minLength`
 * constraint to ensure generated strings or arrays have at least the required
 * length.
 *
 * @category Length checks
 * @since 4.0.0
 */
export function isMinLength(minLength: number, annotations?: Annotations.Filter) {
  minLength = Math.max(0, Math.floor(minLength))
  return makeFilter<{ readonly length: number }>(
    (input) => input.length >= minLength,
    Annotations.combine({
      expected: `a value with a length of at least ${minLength}`,
      jsonSchemaConstraint: (ctx) => {
        switch (ctx.type) {
          case "string":
            return { minLength }
          case "array":
            return { minItems: minLength }
        }
      },
      meta: {
        _tag: "isMinLength",
        minLength
      },
      [Annotations.STRUCTURAL_ANNOTATION_KEY]: true,
      arbitraryConstraint: {
        string: {
          minLength
        },
        array: {
          minLength
        }
      }
    }, annotations)
  )
}

/**
 * Validates that a value has at least one element. Works with strings and arrays.
 * This is equivalent to `isMinLength(1)`.
 *
 * **JSON Schema**
 *
 * This check corresponds to the `minLength: 1` constraint for strings or the
 * `minItems: 1` constraint for arrays in JSON Schema.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `minLength: 1`
 * constraint to ensure generated strings or arrays are non-empty.
 *
 * @category Length checks
 * @since 4.0.0
 */
export function isNonEmpty(annotations?: Annotations.Filter) {
  return isMinLength(1, annotations)
}

/**
 * Validates that a value has at most the specified length. Works with strings
 * and arrays.
 *
 * **JSON Schema**
 *
 * This check corresponds to the `maxLength` constraint for strings or the
 * `maxItems` constraint for arrays in JSON Schema.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `maxLength`
 * constraint to ensure generated strings or arrays have at most the required
 * length.
 *
 * @category Length checks
 * @since 4.0.0
 */
export function isMaxLength(maxLength: number, annotations?: Annotations.Filter) {
  maxLength = Math.max(0, Math.floor(maxLength))
  return makeFilter<{ readonly length: number }>(
    (input) => input.length <= maxLength,
    Annotations.combine({
      expected: `a value with a length of at most ${maxLength}`,
      jsonSchemaConstraint: (ctx) => {
        switch (ctx.type) {
          case "string":
            return { maxLength }
          case "array":
            return { maxItems: maxLength }
        }
      },
      meta: {
        _tag: "isMaxLength",
        maxLength
      },
      [Annotations.STRUCTURAL_ANNOTATION_KEY]: true,
      arbitraryConstraint: {
        string: {
          maxLength
        },
        array: {
          maxLength
        }
      }
    }, annotations)
  )
}

/**
 * Validates that a value has exactly the specified length. Works with strings
 * and arrays.
 *
 * **JSON Schema**
 *
 * This check corresponds to both `minLength`/`maxLength` constraints for strings
 * or `minItems`/`maxItems` constraints for arrays in JSON Schema, both set to
 * the same value.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies both `minLength` and
 * `maxLength` constraints set to the same value to ensure generated strings or
 * arrays have exactly the required length.
 *
 * @category Length checks
 * @since 4.0.0
 */
export function isLength(length: number, annotations?: Annotations.Filter) {
  length = Math.max(0, Math.floor(length))
  return makeFilter<{ readonly length: number }>(
    (input) => input.length === length,
    Annotations.combine({
      expected: `a value with a length of ${length}`,
      jsonSchemaConstraint: (ctx) => {
        switch (ctx.type) {
          case "string":
            return { minLength: length, maxLength: length }
          case "array":
            return { minItems: length, maxItems: length }
        }
      },
      meta: {
        _tag: "isLength",
        length
      },
      [Annotations.STRUCTURAL_ANNOTATION_KEY]: true,
      arbitraryConstraint: {
        string: {
          minLength: length,
          maxLength: length
        },
        array: {
          minLength: length,
          maxLength: length
        }
      }
    }, annotations)
  )
}

/**
 * Validates that a value has at least the specified size. Works with values
 * that have a `size` property, such as objects with a `size` property.
 *
 * **JSON Schema**
 *
 * This check does not have a direct JSON Schema equivalent, as it applies to
 * values with a `size` property rather than standard JSON Schema types.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `minLength`
 * constraint to the array representation to ensure generated values have at
 * least the required size.
 *
 * @category Size checks
 * @since 4.0.0
 */
export function isMinSize(minSize: number, annotations?: Annotations.Filter) {
  minSize = Math.max(0, Math.floor(minSize))
  return makeFilter<{ readonly size: number }>(
    (input) => input.size >= minSize,
    Annotations.combine({
      expected: `a value with a size of at least ${minSize}`,
      meta: {
        _tag: "isMinSize",
        minSize
      },
      [Annotations.STRUCTURAL_ANNOTATION_KEY]: true,
      arbitraryConstraint: {
        array: {
          minLength: minSize
        }
      }
    }, annotations)
  )
}

/**
 * Validates that a value has at most the specified size. Works with values
 * that have a `size` property, such as objects with a `size` property.
 *
 * **JSON Schema**
 *
 * This check does not have a direct JSON Schema equivalent, as it applies to
 * values with a `size` property rather than standard JSON Schema types.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `maxLength`
 * constraint to the array representation to ensure generated values have at
 * most the required size.
 *
 * @category Size checks
 * @since 4.0.0
 */
export function isMaxSize(maxSize: number, annotations?: Annotations.Filter) {
  maxSize = Math.max(0, Math.floor(maxSize))
  return makeFilter<{ readonly size: number }>(
    (input) => input.size <= maxSize,
    Annotations.combine({
      expected: `a value with a size of at most ${maxSize}`,
      meta: {
        _tag: "isMaxSize",
        maxSize
      },
      [Annotations.STRUCTURAL_ANNOTATION_KEY]: true,
      arbitraryConstraint: {
        array: {
          maxLength: maxSize
        }
      }
    }, annotations)
  )
}

/**
 * Validates that a value has exactly the specified size. Works with values
 * that have a `size` property, such as objects with a `size` property.
 *
 * **JSON Schema**
 *
 * This check does not have a direct JSON Schema equivalent, as it applies to
 * values with a `size` property rather than standard JSON Schema types.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies both `minLength` and
 * `maxLength` constraints set to the same value to ensure generated values have
 * exactly the required size.
 *
 * @category Size checks
 * @since 4.0.0
 */
export function isSize(size: number, annotations?: Annotations.Filter) {
  size = Math.max(0, Math.floor(size))
  return makeFilter<{ readonly size: number }>(
    (input) => input.size === size,
    Annotations.combine({
      expected: `a value with a size of ${size}`,
      meta: {
        _tag: "isSize",
        size
      },
      [Annotations.STRUCTURAL_ANNOTATION_KEY]: true,
      arbitraryConstraint: {
        array: {
          minLength: size,
          maxLength: size
        }
      }
    }, annotations)
  )
}

/**
 * Validates that an object contains at least the specified number of
 * properties. This includes both string and symbol keys when counting
 * properties.
 *
 * **JSON Schema**
 *
 * This check corresponds to the `minProperties` constraint in JSON Schema.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `minLength`
 * constraint to the array of entries that is generated before being converted
 * to an object, ensuring the resulting object has at least the required number
 * of properties.
 *
 * @category Object checks
 * @since 4.0.0
 */
export function isMinProperties(minProperties: number, annotations?: Annotations.Filter) {
  minProperties = Math.max(0, Math.floor(minProperties))
  return makeFilter<object>(
    (input) => Reflect.ownKeys(input).length >= minProperties,
    Annotations.combine({
      expected: `an object with at least ${minProperties} properties`,
      jsonSchemaConstraint: () => ({ minProperties }),
      meta: {
        _tag: "isMinProperties",
        minProperties
      },
      [Annotations.STRUCTURAL_ANNOTATION_KEY]: true,
      arbitraryConstraint: {
        array: {
          minLength: minProperties
        }
      }
    }, annotations)
  )
}

/**
 * Validates that an object contains at most the specified number of properties.
 * This includes both string and symbol keys when counting properties.
 *
 * **JSON Schema**
 *
 * This check corresponds to the `maxProperties` constraint in JSON Schema.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `maxLength`
 * constraint to the array of entries that is generated before being converted
 * to an object, ensuring the resulting object has at most the required number
 * of properties.
 *
 * @category Object checks
 * @since 4.0.0
 */
export function isMaxProperties(maxProperties: number, annotations?: Annotations.Filter) {
  maxProperties = Math.max(0, Math.floor(maxProperties))
  return makeFilter<object>(
    (input) => Reflect.ownKeys(input).length <= maxProperties,
    Annotations.combine({
      expected: `an object with at most ${maxProperties} properties`,
      jsonSchemaConstraint: () => ({ maxProperties }),
      meta: {
        _tag: "isMaxProperties",
        maxProperties
      },
      [Annotations.STRUCTURAL_ANNOTATION_KEY]: true,
      arbitraryConstraint: {
        array: {
          maxLength: maxProperties
        }
      }
    }, annotations)
  )
}

/**
 * Validates that an object contains exactly the specified number of properties.
 * This includes both string and symbol keys when counting properties.
 *
 * **JSON Schema**
 *
 * This check corresponds to both `minProperties` and `maxProperties`
 * constraints in JSON Schema, both set to the same value.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies both `minLength` and
 * `maxLength` constraints to the array of entries that is generated before
 * being converted to an object, ensuring the resulting object has exactly the
 * required number of properties.
 *
 * @category Object checks
 * @since 4.0.0
 */
export function isPropertiesLength(length: number, annotations?: Annotations.Filter) {
  length = Math.max(0, Math.floor(length))
  return makeFilter<object>(
    (input) => Reflect.ownKeys(input).length === length,
    Annotations.combine({
      expected: `an object with exactly ${length} properties`,
      jsonSchemaConstraint: () => ({ minProperties: length, maxProperties: length }),
      meta: {
        _tag: "isPropertiesLength",
        length
      },
      [Annotations.STRUCTURAL_ANNOTATION_KEY]: true,
      arbitraryConstraint: {
        array: {
          minLength: length,
          maxLength: length
        }
      }
    }, annotations)
  )
}

/**
 * Validates that all items in an array are unique according to the provided
 * equivalence function.
 *
 * **JSON Schema**
 *
 * This check corresponds to the `uniqueItems: true` constraint in JSON Schema.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this applies a `comparator`
 * constraint using the provided equivalence function to ensure generated arrays
 * contain only unique items.
 *
 * @since 4.0.0
 */
export function isUnique<T>(equivalence?: Equivalence.Equivalence<T>, annotations?: Annotations.Filter) {
  equivalence = equivalence ?? Equal.equivalence()
  return makeFilter<ReadonlyArray<T>>(
    (input) => Arr.dedupeWith(input, equivalence).length === input.length,
    Annotations.combine({
      expected: "an array with unique items",
      jsonSchemaConstraint: () => ({ uniqueItems: true }),
      meta: {
        _tag: "isUnique",
        equivalence
      },
      arbitraryConstraint: {
        array: {
          comparator: equivalence
        }
      }
    }, annotations)
  )
}

/**
 * Validates that a value is not `undefined`.
 *
 * **JSON Schema**
 *
 * This check does not have a direct JSON Schema equivalent, as JSON Schema does
 * not distinguish `undefined` (it's not part of JSON). It can be represented
 * by excluding `undefined` from a union type in TypeScript.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this ensures generated values are
 * not `undefined`.
 *
 * @since 4.0.0
 */
export const isNotUndefined: <A>(annotations?: Annotations.Filter) => AST.Refinement<Exclude<A, undefined>, A> =
  AST.isNotUndefined

/**
 * Validates that a value is not `null`.
 *
 * **JSON Schema**
 *
 * This check does not have a direct JSON Schema equivalent, but can be
 * represented by excluding `null` from a union type.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this ensures generated values
 * are not `null`.
 *
 * @since 4.0.0
 */
export function isNotNull<A>(annotations?: Annotations.Filter) {
  return makeRefinedByGuard<Exclude<A, null>, A>(
    Predicate.isNotNull,
    Annotations.combine({ expected: "a value other than `null`" }, annotations)
  )
}

/**
 * Validates that a value is neither `null` nor `undefined`.
 *
 * **JSON Schema**
 *
 * This check does not have a direct JSON Schema equivalent, but can be
 * represented by excluding `null` from a union type. Note that JSON Schema
 * does not distinguish `undefined` as it's not part of JSON.
 *
 * **Arbitrary**
 *
 * When generating test data with fast-check, this ensures generated values
 * are neither `null` nor `undefined`.
 *
 * @since 4.0.0
 */
export function isNotNullish<A>(annotations?: Annotations.Filter) {
  return makeRefinedByGuard<NonNullable<A>, A>(
    Predicate.isNotNullish,
    Annotations.combine(
      { expected: "a value other than `null` or `undefined  `" },
      annotations
    )
  )
}

// -----------------------------------------------------------------------------
// Built-in Schemas
// -----------------------------------------------------------------------------

/**
 * A schema for non-empty strings. Validates that a string has at least one
 * character.
 *
 * @since 4.0.0
 */
export const NonEmptyString = String.check(isNonEmpty())

/**
 * A schema representing a single character.
 *
 * @since 4.0.0
 */
export const Char = String.check(isLength(1))

/**
 * @category Option
 * @since 4.0.0
 */
export interface Option<A extends Top> extends
  declareConstructor<
    Option_.Option<A["Type"]>,
    Option_.Option<A["Encoded"]>,
    readonly [A],
    OptionIso<A>
  >
{
  readonly value: A
}

/**
 * @category Option
 * @since 4.0.0
 */
export type OptionIso<A extends Top> =
  | { readonly _tag: "None" }
  | { readonly _tag: "Some"; readonly value: A["Iso"] }

/**
 * @category Option
 * @since 4.0.0
 */
export function Option<A extends Top>(value: A): Option<A> {
  const schema = declareConstructor<
    Option_.Option<A["Type"]>,
    Option_.Option<A["Encoded"]>,
    OptionIso<A>
  >()(
    [value],
    ([value]) => (input, ast, options) => {
      if (Option_.isOption(input)) {
        if (Option_.isNone(input)) {
          return Effect.succeedNone
        }
        return Effect.mapBothEager(
          Parser.decodeUnknownEffect(value)(input.value, options),
          {
            onSuccess: Option_.some,
            onFailure: (issue) => new Issue.Composite(ast, Option_.some(input), [new Issue.Pointer(["value"], issue)])
          }
        )
      }
      return Effect.fail(new Issue.InvalidType(ast, Option_.some(input)))
    },
    {
      expected: "Option",
      serializer: ([value]) =>
        link<Option_.Option<A["Encoded"]>>()(
          Union([Struct({ _tag: Literal("Some"), value }), Struct({ _tag: Literal("None") })]),
          Transformation.transform({
            decode: (input) => input._tag === "None" ? Option_.none() : Option_.some(input.value),
            encode: (o) => (Option_.isSome(o) ? { _tag: "Some", value: o.value } as const : { _tag: "None" } as const)
          })
        ),
      arbitrary: ([value]) => (fc, ctx) => {
        return fc.oneof(
          ctx?.isSuspend ? { maxDepth: 2, depthIdentifier: "Option" } : {},
          fc.constant(Option_.none()),
          value.map(Option_.some)
        )
      },
      equivalence: ([value]) => Option_.getEquivalence(value),
      formatter: ([value]) =>
        Option_.match({
          onNone: () => "none()",
          onSome: (t) => `some(${value(t)})`
        })
    }
  )
  return makeProto(schema.ast, { value })
}

/**
 * @since 4.0.0
 */
export interface OptionFromNullOr<S extends Top> extends decodeTo<Option<typeCodec<S>>, NullOr<S>> {}

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
    Transformation.optionFromNullOr()
  ))
}

/**
 * @since 4.0.0
 */
export interface OptionFromOptionalKey<S extends Top> extends decodeTo<Option<typeCodec<S>>, optionalKey<S>> {}

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
export interface OptionFromOptional<S extends Top> extends decodeTo<Option<typeCodec<S>>, optional<S>> {}

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
 * @category Result
 * @since 4.0.0
 */
export interface Result<A extends Top, E extends Top> extends
  declareConstructor<
    Result_.Result<A["Type"], E["Type"]>,
    Result_.Result<A["Encoded"], E["Encoded"]>,
    readonly [A, E],
    ResultIso<A, E>
  >
{
  readonly success: A
  readonly failure: E
}

/**
 * @category Result
 * @since 4.0.0
 */
export type ResultIso<A extends Top, E extends Top> =
  | { readonly _tag: "Success"; readonly success: A["Iso"] }
  | { readonly _tag: "Failure"; readonly failure: E["Iso"] }

/**
 * @category Result
 * @since 4.0.0
 */
export function Result<A extends Top, E extends Top>(
  success: A,
  failure: E
): Result<A, E> {
  const schema = declareConstructor<
    Result_.Result<A["Type"], E["Type"]>,
    Result_.Result<A["Encoded"], E["Encoded"]>,
    ResultIso<A, E>
  >()(
    [success, failure],
    ([success, failure]) => (input, ast, options) => {
      if (!Result_.isResult(input)) {
        return Effect.fail(new Issue.InvalidType(ast, Option_.some(input)))
      }
      switch (input._tag) {
        case "Success":
          return Effect.mapBothEager(Parser.decodeEffect(success)(input.success, options), {
            onSuccess: Result_.succeed,
            onFailure: (issue) => new Issue.Composite(ast, Option_.some(input), [new Issue.Pointer(["success"], issue)])
          })
        case "Failure":
          return Effect.mapBothEager(Parser.decodeEffect(failure)(input.failure, options), {
            onSuccess: Result_.fail,
            onFailure: (issue) => new Issue.Composite(ast, Option_.some(input), [new Issue.Pointer(["failure"], issue)])
          })
      }
    },
    {
      expected: "Result",
      serializer: ([success, failure]) =>
        link<Result_.Result<A["Encoded"], E["Encoded"]>>()(
          Union([
            Struct({ _tag: Literal("Success"), success }),
            Struct({ _tag: Literal("Failure"), failure })
          ]),
          Transformation.transform({
            decode: (input) => input._tag === "Success" ? Result_.succeed(input.success) : Result_.fail(input.failure),
            encode: (r) =>
              Result_.isSuccess(r)
                ? { _tag: "Success", success: r.success } as const
                : { _tag: "Failure", failure: r.failure } as const
          })
        ),
      arbitrary: ([success, failure]) => (fc, ctx) => {
        return fc.oneof(
          ctx?.isSuspend ? { maxDepth: 2, depthIdentifier: "Result" } : {},
          success.map(Result_.succeed),
          failure.map(Result_.fail)
        )
      },
      equivalence: ([success, failure]) => Result_.getEquivalence(success, failure),
      formatter: ([success, failure]) =>
        Result_.match({
          onSuccess: (t) => `success(${success(t)})`,
          onFailure: (t) => `failure(${failure(t)})`
        })
    }
  )
  return makeProto(schema.ast, { success, failure })
}

/**
 * @category Redacted
 * @since 4.0.0
 */
export interface Redacted<S extends Top> extends
  declareConstructor<
    Redacted_.Redacted<S["Type"]>,
    Redacted_.Redacted<S["Encoded"]>,
    readonly [S]
  >
{
  readonly value: S
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
 * @category Redacted
 * @since 4.0.0
 */
export function Redacted<S extends Top>(value: S, options?: {
  readonly label?: string | undefined
}): Redacted<S> {
  const schema = declareConstructor<Redacted_.Redacted<S["Type"]>, Redacted_.Redacted<S["Encoded"]>>()(
    [value],
    ([value]) => (input, ast, poptions) => {
      if (Redacted_.isRedacted(input)) {
        const label: Effect.Effect<void, Issue.Issue, never> = typeof options?.label === "string"
          ? Effect.mapErrorEager(
            Parser.decodeUnknownEffect(Literal(options.label))(input.label, poptions),
            (issue) => new Issue.Pointer(["label"], issue)
          )
          : Effect.void
        return Effect.flatMapEager(
          label,
          () =>
            Effect.mapBothEager(
              Parser.decodeUnknownEffect(value)(Redacted_.value(input), poptions),
              {
                onSuccess: () => input,
                onFailure: (/** ignore the actual issue because of security reasons */) => {
                  const oinput = Option_.some(input)
                  return new Issue.Composite(ast, oinput, [
                    new Issue.Pointer(["value"], new Issue.InvalidValue(oinput))
                  ])
                }
              }
            )
        )
      }
      return Effect.fail(new Issue.InvalidType(ast, Option_.some(input)))
    },
    {
      expected: "Redacted",
      serializerJson: ([value]) =>
        link<Redacted_.Redacted<S["Encoded"]>>()(
          value,
          {
            decode: Getter.transform((e) => Redacted_.make(e, { label: options?.label })),
            encode: Getter.forbidden((oe) =>
              "Cannot serialize Redacted" +
              (Option_.isSome(oe) && typeof oe.value.label === "string" ? ` with label: "${oe.value.label}"` : "")
            )
          }
        ),
      arbitrary: ([value]) => () => value.map((a) => Redacted_.make(a, { label: options?.label })),
      formatter: () => globalThis.String,
      equivalence: ([value]) => Redacted_.getEquivalence(value)
    }
  )
  return makeProto(schema.ast, { value })
}

/**
 * @category CauseFailure
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
  readonly error: E
  readonly defect: D
}

/**
 * @category CauseFailure
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
 * @category CauseFailure
 * @since 4.0.0
 */
export function CauseFailure<E extends Top, D extends Top>(error: E, defect: D): CauseFailure<E, D> {
  const schema = declareConstructor<Cause_.Failure<E["Type"]>, Cause_.Failure<E["Encoded"]>, CauseFailureIso<E, D>>()(
    [error, defect],
    ([error, defect]) => (input, ast, options) => {
      if (!Cause_.isFailure(input)) {
        return Effect.fail(new Issue.InvalidType(ast, Option_.some(input)))
      }
      switch (input._tag) {
        case "Fail":
          return Effect.mapBothEager(
            Parser.decodeUnknownEffect(error)(input.error, options),
            {
              onSuccess: Cause_.failureFail,
              onFailure: (issue) => new Issue.Composite(ast, Option_.some(input), [new Issue.Pointer(["error"], issue)])
            }
          )
        case "Die":
          return Effect.mapBothEager(
            Parser.decodeUnknownEffect(defect)(input.defect, options),
            {
              onSuccess: Cause_.failureDie,
              onFailure: (issue) =>
                new Issue.Composite(ast, Option_.some(input), [new Issue.Pointer(["defect"], issue)])
            }
          )
        case "Interrupt":
          return Effect.succeed(input)
      }
    },
    {
      expected: "Cause.Failure",
      serializer: ([error, defect]) =>
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
      arbitrary: ([error, defect]) => (fc, ctx) => {
        return fc.oneof(
          ctx?.isSuspend ? { maxDepth: 2, depthIdentifier: "Cause.Failure" } : {},
          fc.constant(Cause_.failureInterrupt()),
          fc.integer({ min: 1 }).map(Cause_.failureInterrupt),
          error.map((e) => Cause_.failureFail(e)),
          defect.map((d) => Cause_.failureDie(d))
        )
      },
      equivalence: ([error, defect]) => (a, b) => {
        if (a._tag !== b._tag) return false
        switch (a._tag) {
          case "Fail":
            return error(a.error, (b as Cause_.Fail<unknown>).error)
          case "Die":
            return defect(a.defect, (b as Cause_.Die).defect)
          case "Interrupt":
            return Equal.equals(a.fiberId, (b as Cause_.Interrupt).fiberId)
        }
      },
      formatter: ([error, defect]) => (t) => {
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
  )
  return makeProto(schema.ast, { error, defect })
}

/**
 * @category Cause
 * @since 4.0.0
 */
export interface Cause<E extends Top, D extends Top> extends
  declareConstructor<
    Cause_.Cause<E["Type"]>,
    Cause_.Cause<E["Encoded"]>,
    readonly [Array$<CauseFailure<E, D>>],
    CauseIso<E, D>
  >
{
  readonly error: E
  readonly defect: D
}

/**
 * @category Cause
 * @since 4.0.0
 */
export type CauseIso<E extends Top, D extends Top> = ReadonlyArray<CauseFailureIso<E, D>>

/**
 * @category Cause
 * @since 4.0.0
 */
export function Cause<E extends Top, D extends Top>(error: E, defect: D): Cause<E, D> {
  const schema = declareConstructor<Cause_.Cause<E["Type"]>, Cause_.Cause<E["Encoded"]>, CauseIso<E, D>>()(
    [Array(CauseFailure(error, defect))],
    ([failures]) => (input, ast, options) => {
      if (!Cause_.isCause(input)) {
        return Effect.fail(new Issue.InvalidType(ast, Option_.some(input)))
      }
      return Effect.mapBothEager(Parser.decodeUnknownEffect(failures)(input.failures, options), {
        onSuccess: Cause_.fromFailures,
        onFailure: (issue) => new Issue.Composite(ast, Option_.some(input), [new Issue.Pointer(["failures"], issue)])
      })
    },
    {
      expected: "Cause",
      serializer: ([failures]) =>
        link<Cause_.Cause<E["Encoded"]>>()(
          failures,
          Transformation.transform({
            decode: Cause_.fromFailures,
            encode: ({ failures }) => failures
          })
        ),
      arbitrary: ([failures]) => () => failures.map(Cause_.fromFailures),
      equivalence: ([failures]) => (a, b) => failures(a.failures, b.failures),
      formatter: ([failures]) => (t) => `Cause(${failures(t.failures)})`
    }
  )
  return makeProto(schema.ast, { error, defect })
}

/**
 * @since 4.0.0
 */
export interface Error extends instanceOf<globalThis.Error> {}

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
  expected: "Error",
  serializerJson: () => link<globalThis.Error>()(ErrorJsonEncoded, Transformation.errorFromErrorJsonEncoded),
  arbitrary: () => (fc) => fc.string().map((message) => new globalThis.Error(message))
})

/**
 * @since 4.0.0
 */
export interface Defect extends
  Union<
    readonly [
      decodeTo<
        Error,
        Struct<{
          readonly message: String
          readonly name: optionalKey<String>
          readonly stack: optionalKey<String>
        }>
      >,
      decodeTo<Unknown, Any>
    ]
  >
{}

const defectTransformation = new Transformation.Transformation(
  Getter.passthrough(),
  Getter.transform((u) => {
    try {
      return JSON.parse(JSON.stringify(u))
    } catch {
      return format(u)
    }
  })
)

/**
 * A schema that represents defects.
 *
 * @category Constructors
 * @since 4.0.0
 */
export const Defect: Defect = Union([
  ErrorJsonEncoded.pipe(decodeTo(Error, Transformation.errorFromErrorJsonEncoded)),
  Any.pipe(decodeTo(
    Unknown.annotate({
      serializerJson: () => link<unknown>()(Any, defectTransformation),
      arbitrary: () => (fc) => fc.json()
    }),
    defectTransformation
  ))
])

/**
 * @category Exit
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
  readonly value: A
  readonly error: E
  readonly defect: D
}

/**
 * @category Exit
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
 * @category Exit
 * @since 4.0.0
 */
export function Exit<A extends Top, E extends Top, D extends Top>(value: A, error: E, defect: D): Exit<A, E, D> {
  const schema = declareConstructor<
    Exit_.Exit<A["Type"], E["Type"]>,
    Exit_.Exit<A["Encoded"], E["Encoded"]>,
    ExitIso<A, E, D>
  >()(
    [value, Cause(error, defect)],
    ([value, cause]) => (input, ast, options) => {
      if (!Exit_.isExit(input)) {
        return Effect.fail(new Issue.InvalidType(ast, Option_.some(input)))
      }
      switch (input._tag) {
        case "Success":
          return Effect.mapBothEager(
            Parser.decodeUnknownEffect(value)(input.value, options),
            {
              onSuccess: Exit_.succeed,
              onFailure: (issue) => new Issue.Composite(ast, Option_.some(input), [new Issue.Pointer(["value"], issue)])
            }
          )
        case "Failure":
          return Effect.mapBothEager(
            Parser.decodeUnknownEffect(cause)(input.cause, options),
            {
              onSuccess: Exit_.failCause,
              onFailure: (issue) => new Issue.Composite(ast, Option_.some(input), [new Issue.Pointer(["cause"], issue)])
            }
          )
      }
    },
    {
      expected: "Exit",
      serializer: ([value, cause]) =>
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
      arbitrary: ([value, cause]) => (fc, ctx) =>
        fc.oneof(
          ctx?.isSuspend ? { maxDepth: 2, depthIdentifier: "Exit" } : {},
          value.map((v) => Exit_.succeed(v)),
          cause.map((cause) => Exit_.failCause(cause))
        ),
      equivalence: ([value, cause]) => (a, b) => {
        if (a._tag !== b._tag) return false
        switch (a._tag) {
          case "Success":
            return value(a.value, (b as Exit_.Success<A["Type"]>).value)
          case "Failure":
            return cause(a.cause, (b as Exit_.Failure<E["Type"], D["Type"]>).cause)
        }
      },
      formatter: ([value, cause]) => (t) => {
        switch (t._tag) {
          case "Success":
            return `Exit.Success(${value(t.value)})`
          case "Failure":
            return `Exit.Failure(${cause(t.cause)})`
        }
      }
    }
  )
  return makeProto(schema.ast, { value, error, defect })
}

/**
 * @category ReadonlyMap
 * @since 4.0.0
 */
export interface ReadonlyMap$<Key extends Top, Value extends Top> extends
  declareConstructor<
    globalThis.ReadonlyMap<Key["Type"], Value["Type"]>,
    globalThis.ReadonlyMap<Key["Encoded"], Value["Encoded"]>,
    readonly [Key, Value],
    ReadonlyMapIso<Key, Value>
  >
{
  readonly key: Key
  readonly value: Value
}

/**
 * @category ReadonlyMap
 * @since 4.0.0
 */
export type ReadonlyMapIso<Key extends Top, Value extends Top> = ReadonlyArray<readonly [Key["Iso"], Value["Iso"]]>

/**
 * Creates a schema that validates a `ReadonlyMap` where keys and values must
 * conform to the provided schemas.
 *
 * @category ReadonlyMap
 * @since 4.0.0
 */
export function ReadonlyMap<Key extends Top, Value extends Top>(key: Key, value: Value): ReadonlyMap$<Key, Value> {
  const schema = declareConstructor<
    globalThis.ReadonlyMap<Key["Type"], Value["Type"]>,
    globalThis.ReadonlyMap<Key["Encoded"], Value["Encoded"]>,
    ReadonlyMapIso<Key, Value>
  >()(
    [key, value],
    ([key, value]) => (input, ast, options) => {
      if (input instanceof globalThis.Map) {
        const array = Array(Tuple([key, value]))
        return Effect.mapBothEager(
          Parser.decodeUnknownEffect(array)([...input], options),
          {
            onSuccess: (array: ReadonlyArray<readonly [Key["Type"], Value["Type"]]>) => new globalThis.Map(array),
            onFailure: (issue) => new Issue.Composite(ast, Option_.some(input), [new Issue.Pointer(["entries"], issue)])
          }
        )
      }
      return Effect.fail(new Issue.InvalidType(ast, Option_.some(input)))
    },
    {
      expected: "ReadonlyMap",
      serializer: ([key, value]) =>
        link<globalThis.Map<Key["Encoded"], Value["Encoded"]>>()(
          Array(Tuple([key, value])),
          Transformation.transform({
            decode: (entries) => new globalThis.Map(entries),
            encode: (map) => [...map.entries()]
          })
        ),
      arbitrary: ([key, value]) => (fc, ctx) => {
        return fc.oneof(
          ctx?.isSuspend ? { maxDepth: 2, depthIdentifier: "ReadonlyMap" } : {},
          fc.constant([]),
          fc.array(fc.tuple(key, value), ctx?.constraints?.array)
        ).map((as) => new globalThis.Map(as))
      },
      equivalence: ([key, value]) => Equal.makeCompareMap(key, value),
      formatter: ([key, value]) => (t) => {
        const size = t.size
        if (size === 0) {
          return "ReadonlyMap(0) {}"
        }
        const entries = globalThis.Array.from(t.entries()).sort().map(([k, v]) => `${key(k)} => ${value(v)}`)
        return `ReadonlyMap(${size}) { ${entries.join(", ")} }`
      }
    }
  )
  return makeProto(schema.ast, { key, value })
}

/**
 * @category ReadonlySet
 * @since 4.0.0
 */
export interface ReadonlySet$<Value extends Top> extends
  declareConstructor<
    globalThis.ReadonlySet<Value["Type"]>,
    globalThis.ReadonlySet<Value["Encoded"]>,
    readonly [Value],
    ReadonlySetIso<Value>
  >
{
  readonly value: Value
}

/**
 * @category ReadonlySet
 * @since 4.0.0
 */
export type ReadonlySetIso<Value extends Top> = ReadonlyArray<Value["Iso"]>

/**
 * @category ReadonlySet
 * @since 4.0.0
 */
export function ReadonlySet<Value extends Top>(value: Value): ReadonlySet$<Value> {
  const schema = declareConstructor<
    globalThis.ReadonlySet<Value["Type"]>,
    globalThis.ReadonlySet<Value["Encoded"]>,
    ReadonlySetIso<Value>
  >()(
    [value],
    ([value]) => (input, ast, options) => {
      if (input instanceof globalThis.Set) {
        const array = Array(value)
        return Effect.mapBothEager(
          Parser.decodeUnknownEffect(array)([...input], options),
          {
            onSuccess: (array: ReadonlyArray<Value["Type"]>) => new globalThis.Set(array),
            onFailure: (issue) => new Issue.Composite(ast, Option_.some(input), [new Issue.Pointer(["values"], issue)])
          }
        )
      }
      return Effect.fail(new Issue.InvalidType(ast, Option_.some(input)))
    },
    {
      expected: "ReadonlySet",
      serializer: ([value]) =>
        link<globalThis.Set<Value["Encoded"]>>()(
          Array(value),
          Transformation.transform({
            decode: (entries) => new globalThis.Set(entries),
            encode: (set) => [...set.values()]
          })
        ),
      arbitrary: ([value]) => (fc, ctx) => {
        return fc.oneof(
          ctx?.isSuspend ? { maxDepth: 2, depthIdentifier: "ReadonlySet" } : {},
          fc.constant([]),
          fc.array(value, ctx?.constraints?.array)
        ).map((as) => new globalThis.Set(as))
      },
      equivalence: ([value]) => Equal.makeCompareSet(value),
      formatter: ([value]) => (t) => {
        const size = t.size
        if (size === 0) {
          return "ReadonlySet(0) {}"
        }
        const values = globalThis.Array.from(t.values()).sort().map((v) => `${value(v)}`)
        return `ReadonlySet(${size}) { ${values.join(", ")} }`
      }
    }
  )
  return makeProto(schema.ast, { value })
}

/**
 * @since 4.0.0
 */
export interface URL extends instanceOf<globalThis.URL> {}

/**
 * A schema for JavaScript `URL` objects.
 *
 * **Default JSON serializer**
 *
 * - encodes `URL` as a `string`
 *
 * @since 4.0.0
 * @category URL
 */
export const URL: URL = instanceOf(
  globalThis.URL,
  {
    expected: "URL",
    serializerJson: () => link<globalThis.URL>()(String, Transformation.urlFromString),
    arbitrary: () => (fc) => fc.webUrl().map((s) => new globalThis.URL(s)),
    equivalence: () => (a, b) => a.toString() === b.toString()
  }
)

/**
 * @since 4.0.0
 */
export interface URLFromString extends decodeTo<URL, String> {}

/**
 * A transformation schema that decodes a `string` into a `URL`.
 *
 * Decoding:
 * - A **valid** URL `string` is decoded as a `URL`
 *
 * Encoding:
 * - A `URL` is encoded as a `string`
 *
 * @category URL
 * @since 4.0.0
 */
export const URLFromString: URLFromString = String.pipe(
  decodeTo(URL, Transformation.urlFromString)
)

/**
 * @since 4.0.0
 */
export interface Date extends instanceOf<globalThis.Date> {}

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
    expected: "Date",
    serializerJson: () =>
      link<globalThis.Date>()(
        String.annotate({ description: "a string that will be decoded as a date" }),
        Transformation.transform({
          decode: (s) => new globalThis.Date(s),
          encode: formatDate
        })
      ),
    arbitrary: () => (fc, ctx) => fc.date(ctx?.constraints?.date)
  }
)

/**
 * @since 4.0.0
 */
export interface ValidDate extends Date {}

/**
 * A schema for **valid** JavaScript `Date` objects.
 *
 * This schema accepts `Date` instances but rejects invalid dates (such as `new
 * Date("invalid")`).
 *
 * @since 4.0.0
 */
export const ValidDate = Date.check(isValidDate())

/**
 * @since 4.0.0
 */
export interface Duration extends declare<Duration_.Duration> {}

/**
 * A schema for `Duration` values.
 *
 * **Default JSON serializer**
 *
 * - encodes `Duration` as a `string`
 *
 * @since 4.0.0
 */
export const Duration: Duration = declare(
  Duration_.isDuration,
  {
    expected: "Duration",
    serializerJson: () =>
      link<Duration_.Duration>()(
        Union([Number, BigInt, Literal("Infinity")]),
        Transformation.transform({
          decode: (value) => {
            if (value === "Infinity") return Duration_.infinity
            if (typeof value === "bigint") return Duration_.nanos(value)
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
    arbitrary: () => (fc) =>
      fc.oneof(
        fc.constant(Duration_.infinity),
        fc.bigInt({ min: 0n }).map(Duration_.nanos),
        fc.maxSafeNat().map(Duration_.millis)
      ),
    formatter: () => globalThis.String,
    equivalence: () => Duration_.Equivalence
  }
)

/**
 * @since 4.0.0
 */
export interface DurationFromNanos extends decodeTo<Duration, BigInt> {}

/**
 * A transformation schema that decodes a non-negative `bigint` into a
 * `Duration`, treating the `bigint` value as the duration in nanoseconds.
 *
 * Decoding:
 * - A non-negative `bigint` representing nanoseconds is decoded as a `Duration`
 *
 * Encoding:
 * - A `Duration` is encoded to a non-negative `bigint` representing nanoseconds
 *
 * @category Duration
 * @since 4.0.0
 */
export const DurationFromNanos: DurationFromNanos = BigInt.check(isNonNegativeBigInt()).pipe(
  decodeTo(Duration, Transformation.durationFromNanos)
)

/**
 * @since 4.0.0
 */
export interface DurationFromMillis extends decodeTo<Duration, Number> {}

/**
 * A transformation schema that decodes a non-negative (possibly infinite)
 * integer into a `Duration`, treating the integer value as the duration in
 * milliseconds.
 *
 * Decoding:
 * - A non-negative (possibly infinite) integer representing milliseconds is
 *   decoded as a `Duration`
 *
 * Encoding:
 * - A `Duration` is encoded to a non-negative (possibly infinite) integer
 *   representing milliseconds
 *
 * @category Duration
 * @since 4.0.0
 */
export const DurationFromMillis: DurationFromMillis = Number.check(isNonNegative()).pipe(
  decodeTo(Duration, Transformation.durationFromMillis)
)

/**
 * @since 4.0.0
 */
export interface UnknownFromJsonString extends decodeTo<Unknown, String> {}

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
}).pipe(decodeTo(Unknown, Transformation.fromJsonString))

/**
 * @since 4.0.0
 */
export interface fromJsonString<S extends Top> extends decodeTo<S, String> {}

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
 * import { Schema } from "effect/schema"
 *
 * const original = Schema.Struct({ a: Schema.String })
 * const schema = Schema.fromJsonString(original)
 *
 * const jsonSchema = Schema.makeJsonSchemaDraft2020_12(schema)
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
  return String.annotate({
    description: "a string that will be decoded as JSON",
    jsonSchema: (ctx) => {
      switch (ctx.target) {
        case "draft-07":
          return {
            "type": "string"
          }
        case "2020-12":
        case "oas3.1":
          return {
            "type": "string",
            "contentMediaType": "application/json",
            "contentSchema": ctx.make(schema.ast)
          }
      }
    }
  }).pipe(decodeTo(schema, Transformation.fromJsonString))
}

/**
 * @since 4.0.0
 */
export interface FormData extends instanceOf<globalThis.FormData> {}

/**
 * @since 4.0.0
 */
export const FormData: FormData = instanceOf(globalThis.FormData)

/**
 * @since 4.0.0
 */
export interface fromFormData<S extends Top> extends decodeTo<S, FormData> {}

/**
 * `Schema.fromFormData` returns a schema that reads a `FormData` instance,
 * converts it into a tree record using bracket notation, and then decodes the
 * resulting structure using the provided schema.
 *
 * The decoding process has two steps:
 *
 * 1. Parse `FormData` into a nested tree record.
 * 2. Decode the parsed value with the given schema.
 *
 * **Example** (Decoding a flat structure)
 *
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.fromFormData(
 *   Schema.Struct({
 *     a: Schema.String
 *   })
 * )
 *
 * const formData = new FormData()
 * formData.append("a", "1")
 * formData.append("b", "2")
 *
 * console.log(String(Schema.decodeUnknownExit(schema)(formData)))
 * // Success({"a":"1"})
 * ```
 *
 * You can express nested values using bracket notation.
 *
 * **Example** (Nested fields)
 *
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.fromFormData(
 *   Schema.toSerializerStringTreeLoose(
 *     Schema.Struct({
 *       a: Schema.String,
 *       b: Schema.Struct({
 *         c: Schema.String,
 *         d: Schema.String
 *       })
 *     })
 *   )
 * )
 *
 * const formData = new FormData()
 * formData.append("a", "1")
 * formData.append("b[c]", "2")
 * formData.append("b[d]", "3")
 *
 * console.log(String(Schema.decodeUnknownExit(schema)(formData)))
 * // Success({"a":"1","b":{"c":"2","d":"3"}})
 * ```
 *
 * If you want to decode values that are not strings, use
 * `Schema.toSerializerStringTreeLoose`. This serializer preserves values such
 * as numbers and `Blob` objects when compatible with the schema.
 *
 * **Example** (Parsing non-string values)
 *
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.fromFormData(
 *   Schema.toSerializerStringTreeLoose(
 *     Schema.Struct({
 *       a: Schema.Int
 *     })
 *   )
 * )
 *
 * const formData = new FormData()
 * formData.append("a", "1")
 *
 * console.log(String(Schema.decodeUnknownExit(schema)(formData)))
 * // Success({"a":1}) // Note: the value is a number
 * ```
 *
 * @since 4.0.0
 */
export function fromFormData<S extends Top>(schema: S): fromFormData<S> {
  return FormData.pipe(decodeTo(schema, Transformation.fromFormData))
}

/**
 * @since 4.0.0
 */
export interface URLSearchParams extends instanceOf<globalThis.URLSearchParams> {}

/**
 * @since 4.0.0
 */
export const URLSearchParams: URLSearchParams = instanceOf(globalThis.URLSearchParams)

/**
 * @since 4.0.0
 */
export interface fromURLSearchParams<S extends Top> extends decodeTo<S, URLSearchParams> {}

/**
 * `Schema.fromURLSearchParams` returns a schema that reads a `URLSearchParams`
 * instance, converts it into a tree record using bracket notation, and then
 * decodes the resulting structure using the provided schema.
 *
 * The decoding process has two steps:
 *
 * 1. Parse `URLSearchParams` into a nested tree record.
 * 2. Decode the parsed value with the given schema.
 *
 * **Example** (Decoding a flat structure)
 *
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.fromURLSearchParams(
 *   Schema.Struct({
 *     a: Schema.String
 *   })
 * )
 *
 * const urlSearchParams = new URLSearchParams("a=1&b=2")
 *
 * console.log(String(Schema.decodeUnknownExit(schema)(urlSearchParams)))
 * // Success({"a":"1"})
 * ```
 * You can express nested values using bracket notation.
 *
 * **Example** (Nested fields)
 *
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.fromURLSearchParams(
 *   Schema.Struct({
 *     a: Schema.String,
 *     b: Schema.Struct({
 *       c: Schema.String,
 *       d: Schema.String
 *     })
 *   })
 * )
 *
 * const urlSearchParams = new URLSearchParams("a=1&b[c]=2&b[d]=3")
 *
 * console.log(String(Schema.decodeUnknownExit(schema)(urlSearchParams)))
 * // Success({"a":"1","b":{"c":"2","d":"3"}})
 * ```
 *
 * If you want to decode values that are not strings, use
 * `Schema.toSerializerStringTree`. This serializer preserves values such as
 * numbers when compatible with the schema.
 *
 * **Example** (Parsing non-string values)
 *
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.fromURLSearchParams(
 *   Schema.toSerializerStringTree(
 *     Schema.Struct({
 *       a: Schema.Int
 *     })
 *   )
 * )
 *
 * const urlSearchParams = new URLSearchParams("a=1&b=2")
 *
 * console.log(String(Schema.decodeUnknownExit(schema)(urlSearchParams)))
 * // Success({"a":1}) // Note: the value is a number
 * ```
 *
 * @since 4.0.0
 */
export function fromURLSearchParams<S extends Top>(schema: S): fromURLSearchParams<S> {
  return URLSearchParams.pipe(decodeTo(schema, Transformation.fromURLSearchParams))
}

/**
 * @since 4.0.0
 */
export interface Finite extends Number {}

/**
 * A schema for finite numbers, rejecting `NaN`, `Infinity`, and `-Infinity`.
 *
 * @since 4.0.0
 */
export const Finite: Finite = Number.check(isFinite())

/**
 * @since 4.0.0
 */
export interface Int extends Number {}

/**
 * A schema for integers, rejecting `NaN`, `Infinity`, and `-Infinity`.
 *
 * @since 4.0.0
 */
export const Int: Int = Number.check(isInt())

/**
 * @since 4.0.0
 */
export interface NumberFromString extends decodeTo<Finite, String> {}

/**
 * A transformation schema that parses a string into a number.
 *
 * Decoding:
 * - A `string` is decoded as a finite number.
 *
 * Encoding:
 * - A number is encoded as a `string`.
 *
 * @since 4.0.0
 */
export const NumberFromString: NumberFromString = String.annotate({
  description: "a string that will be decoded as a number"
}).pipe(decodeTo(
  Number,
  Transformation.numberFromString
))

/**
 * @since 4.0.0
 */
export interface FiniteFromString extends decodeTo<Finite, String> {}

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
 * @since 4.0.0
 */
export interface Trimmed extends String {}

/**
 * A schema for strings that contains no leading or trailing whitespaces.
 *
 * @since 4.0.0
 */
export const Trimmed: Trimmed = String.check(isTrimmed())

/**
 * @since 4.0.0
 */
export interface Trim extends decodeTo<Trimmed, String> {}

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
export const Trim: Trim = String.annotate({
  description: "a string that will be trimmed"
}).pipe(decodeTo(Trimmed, Transformation.trim()))

/**
 * @since 4.0.0
 */
export const PropertyKey = Union([Finite, Symbol, String])

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
export interface BooleanFromBit extends decodeTo<Boolean, Literals<readonly [0, 1]>> {}

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
export interface Uint8Array extends instanceOf<globalThis.Uint8Array<ArrayBufferLike>> {}

const StringBase64 = String.annotate({ description: "a string that will be decoded as Uint8Array" })

/**
 * A schema for JavaScript `Uint8Array` objects.
 *
 * **Default JSON serializer**
 *
 * The default JSON serializer encodes Uint8Array as a Base64 encoded string.
 *
 * @category Uint8Array
 * @since 4.0.0
 */
export const Uint8Array: Uint8Array = instanceOf(globalThis.Uint8Array<ArrayBufferLike>, {
  serializerJson: () =>
    link<globalThis.Uint8Array<ArrayBufferLike>>()(StringBase64, Transformation.uint8ArrayFromString),
  expected: "Uint8Array",
  arbitrary: () => (fc) => fc.uint8Array()
})

/**
 * @since 4.0.0
 */
export interface Uint8ArrayFromBase64 extends decodeTo<Uint8Array, String> {}

/**
 * A transformation schema that decodes a base64 encoded string into a
 * `Uint8Array`.
 *
 * Decoding:
 * - A **valid** base64 encoded string is decoded as a `Uint8Array`.
 *
 * Encoding:
 * - A `Uint8Array` is encoded as a base64-encoded string.
 *
 * @category Uint8Array
 * @since 4.0.0
 */
export const Uint8ArrayFromBase64: Uint8ArrayFromBase64 = StringBase64.pipe(
  decodeTo(Uint8Array, Transformation.uint8ArrayFromString)
)

/**
 * @since 4.0.0
 */
export interface Uint8ArrayFromBase64Url extends decodeTo<Uint8Array, String> {}

/**
 * A transformation schema that decodes a base64 (URL) encoded string into a
 * `Uint8Array`.
 *
 * Decoding:
 * - A **valid** base64 (URL) encoded string is decoded as a `Uint8Array`.
 *
 * Encoding:
 * - A `Uint8Array` is encoded as a base64 (URL) encoded string.
 *
 * @category Uint8Array
 * @since 4.0.0
 */
export const Uint8ArrayFromBase64Url: Uint8ArrayFromBase64Url = String.annotate({
  description: "a string that will be decoded as Uint8Array"
}).pipe(
  decodeTo(Uint8Array, {
    decode: Getter.decodeBase64Url(),
    encode: Getter.encodeBase64Url()
  })
)

/**
 * @since 4.0.0
 */
export interface Uint8ArrayFromHex extends decodeTo<Uint8Array, String> {}

/**
 * A transformation schema that decodes a hex encoded string into a
 * `Uint8Array`.
 *
 * Decoding:
 * - A **valid** hex encoded string is decoded as a `Uint8Array`.
 *
 * Encoding:
 * - A `Uint8Array` is encoded as a hex encoded string.
 *
 * @category Uint8Array
 * @since 4.0.0
 */
export const Uint8ArrayFromHex: Uint8ArrayFromHex = String.annotate({
  description: "a string that will be decoded as Uint8Array"
}).pipe(
  decodeTo(Uint8Array, {
    decode: Getter.decodeHex(),
    encode: Getter.encodeHex()
  })
)

/**
 * @since 4.0.0
 */
export interface DateTimeUtc extends declare<DateTime.Utc> {}

/**
 * A schema for `DateTime.Utc` values.
 *
 * **Default JSON serializer**
 *
 * - encodes `DateTime.Utc` as a UTC ISO string
 *
 * @category DateTime
 * @since 4.0.0
 */
export const DateTimeUtc: DateTimeUtc = declare(
  (u) => DateTime.isDateTime(u) && DateTime.isUtc(u),
  {
    expected: "DateTimeUtc",
    serializerJson: () =>
      link<DateTime.Utc>()(
        String,
        {
          decode: Getter.dateTimeUtcFromInput(),
          encode: Getter.transform(DateTime.formatIso)
        }
      ),
    arbitrary: () => (fc, ctx) =>
      fc.date({ noInvalidDate: true, ...ctx?.constraints?.date }).map((date) => DateTime.fromDateUnsafe(date)),
    formatter: () => (utc) => utc.toString(),
    equivalence: () => DateTime.Equivalence
  }
)

/**
 * @since 4.0.0
 */
export interface DateTimeUtcFromDate extends decodeTo<DateTimeUtc, Date> {}

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
export interface DateTimeUtcFromString extends decodeTo<DateTimeUtc, String> {}

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
  decodeTo(
    DateTimeUtc,
    Transformation.transform({
      decode: DateTime.makeUnsafe,
      encode: DateTime.formatIso
    })
  )
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

// -----------------------------------------------------------------------------
// Class APIs
// -----------------------------------------------------------------------------

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
    S["~type.make.in"],
    S["Iso"],
    readonly [S],
    Self,
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  // intentionally left without `readonly "~rebuild.out": this`
  new(props: S["~type.make.in"], options?: MakeOptions): S["Type"] & Inherited
  readonly identifier: string
  readonly fields: S["fields"]
  /**
   * Returns a new struct with the fields modified by the provided function.
   *
   * **Options**
   *
   * - `unsafePreserveChecks` - if `true`, keep any `.check(...)` constraints
   *   that were attached to the original struct. Defaults to `false`.
   *
   *   **Warning**: This is an unsafe operation. Since `mapFields`
   *   transformations change the schema type, the original refinement functions
   *   may no longer be valid or safe to apply to the transformed schema. Only
   *   use this option if you have verified that your refinements remain correct
   *   after the transformation.
   */
  mapFields<To extends Struct.Fields>(
    f: (fields: S["fields"]) => To,
    options?: {
      readonly unsafePreserveChecks?: boolean | undefined
    } | undefined
  ): Struct<Simplify<Readonly<To>>>
}

type AddStaticMembers<C, Static> = C & Pick<Static, Exclude<keyof Static, keyof C>>

/**
 * Not all classes are extendable (e.g. `RequestClass`).
 *
 * @since 4.0.0
 */
export interface ExtendableClass<Self, S extends Top & { readonly fields: Struct.Fields }, Inherited>
  extends Class<Self, S, Inherited>
{
  extend<Extended, Static = {}, Brand = {}>(
    identifier: string
  ): <NewFields extends Struct.Fields>(
    fields: NewFields,
    annotations?: Annotations.Declaration<Extended, readonly [Struct<Simplify<Assign<S["fields"], NewFields>>>]>
  ) => AddStaticMembers<
    ExtendableClass<Extended, Struct<Simplify<Assign<S["fields"], NewFields>>>, Self & Brand>,
    Static
  >
}

const immerable: unique symbol = globalThis.Symbol.for("immer-draftable") as any

function makeClass<
  Self,
  S extends Struct<Struct.Fields>,
  Inherited extends new(...args: ReadonlyArray<any>) => any
>(
  Inherited: Inherited,
  identifier: string,
  struct: S,
  annotations?: Annotations.Declaration<Self, readonly [S]>
): any {
  const getClassSchema = getClassSchemaFactory(struct, identifier, annotations)

  return class extends Inherited {
    constructor(...[input, options]: ReadonlyArray<any>) {
      if (options?.disableValidation) {
        super(input, options)
      } else {
        const validated = struct.makeUnsafe(input, options)
        super({ ...input, ...validated }, { ...options, disableValidation: true })
      }
    }

    toString() {
      return `${identifier}(${format({ ...this })})`
    }

    static readonly [TypeId] = TypeId
    static readonly [immerable] = true

    declare static readonly "~rebuild.out": decodeTo<declareConstructor<Self, S["Encoded"], readonly [S], S["Iso"]>, S>
    declare static readonly "~annotate.in": Annotations.Bottom<Self, readonly [S]>

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
    static readonly fields = struct.fields

    static get ast(): AST.Declaration {
      return getClassSchema(this).ast
    }
    static pipe() {
      return Pipeable.pipeArguments(this, arguments)
    }
    static rebuild(ast: AST.Declaration) {
      return getClassSchema(this).rebuild(ast)
    }
    static makeUnsafe(input: S["~type.make.in"], options?: MakeOptions): Self {
      return new this(input, options)
    }
    static annotate(annotations: Annotations.Declaration<Self, readonly [S]>) {
      return this.rebuild(AST.annotate(this.ast, annotations))
    }
    static annotateKey(annotations: Annotations.Key<Self>) {
      return this.rebuild(AST.annotateKey(this.ast, annotations))
    }
    static check(...checks: readonly [AST.Check<Self>, ...Array<AST.Check<Self>>]) {
      return this.rebuild(AST.appendChecks(this.ast, checks))
    }
    static extend<Extended>(
      identifier: string
    ): <NewFields extends Struct.Fields>(
      fields: NewFields,
      annotations?: Annotations.Declaration<Extended, readonly [Struct<Simplify<Assign<S["fields"], NewFields>>>]>
    ) => Class<Extended, Struct<Simplify<Assign<S["fields"], NewFields>>>, Self> {
      return (newFields, annotations) => {
        const fields = { ...struct.fields, ...newFields }
        return makeClass(this, identifier, makeStruct(AST.struct(fields, struct.ast.checks), fields), annotations)
      }
    }
    static mapFields<To extends Struct.Fields>(
      f: (fields: S["fields"]) => To,
      options?: {
        readonly unsafePreserveChecks?: boolean | undefined
      } | undefined
    ): Struct<Simplify<Readonly<To>>> {
      return struct.mapFields(f, options)
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
      const transformation = getClassTransformation(self)
      const to = make<declareConstructor<Self, S["Encoded"], readonly [S]>>(
        new AST.Declaration(
          [from.ast],
          () => (input, ast) => {
            return input instanceof self ?
              Effect.succeed(input) :
              Effect.fail(new Issue.InvalidType(ast, Option_.some(input)))
          },
          Annotations.combine({
            identifier,
            [AST.ClassTypeId]: ([from]: readonly [AST.AST]) => new AST.Link(from, transformation),
            serializer: ([from]) => new AST.Link(from.ast, transformation),
            arbitrary: ([from]) => () => from.map((args) => new self(args)),
            formatter: ([from]) => (t: Self) => `${self.identifier}(${from(t)})`
          }, annotations)
        )
      )
      memo = from.pipe(
        decodeTo(
          to,
          getClassTransformation(self)
        )
      )
    }
    return memo
  }
}

function isStruct(schema: Struct.Fields | Struct<Struct.Fields>): schema is Struct<Struct.Fields> {
  return isSchema(schema)
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
  const struct = isStruct(schema) ? schema : Struct(schema)
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
  const struct = isStruct(schema) ? schema : Struct(schema)
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

// TODO: remove this?
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

// -----------------------------------------------------------------------------
// Arbitrary APIs
// -----------------------------------------------------------------------------

/**
 * @category Arbitrary
 * @since 4.0.0
 */
export type LazyArbitrary<T> = (fc: typeof FastCheck) => FastCheck.Arbitrary<T>

/**
 * @category Arbitrary
 * @since 4.0.0
 */
export function makeArbitraryLazy<S extends Top>(schema: S): LazyArbitrary<S["Type"]> {
  const lawc = InternalArbitrary.memoized(schema.ast)
  return (fc) => lawc(fc, {})
}

/**
 * @category Arbitrary
 * @since 4.0.0
 */
export function makeArbitrary<S extends Top>(schema: S): FastCheck.Arbitrary<S["Type"]> {
  return makeArbitraryLazy(schema)(FastCheck)
}

// -----------------------------------------------------------------------------
// Formatter APIs
// -----------------------------------------------------------------------------

/**
 * **Technical Note**
 *
 * This annotation cannot be added to `Annotations.Bottom` because it would make
 * the schema invariant.
 *
 * @category Formatter
 * @since 4.0.0
 */
export function overrideFormatter<S extends Top>(formatter: () => Formatter<S["Type"]>) {
  return (self: S): S["~rebuild.out"] => {
    return self.annotate({ formatter })
  }
}

type FormatterOverride<A extends AST.AST> = (ast: A, visit: (ast: AST.AST) => Formatter<any>) => Formatter<any>

/**
 * @category Formatter
 * @since 4.0.0
 */
export function makeFormatterCompiler(options: {
  readonly onDeclaration?:
    | FormatterOverride<AST.Declaration>
    | undefined
  readonly onNull?: FormatterOverride<AST.Null> | undefined
  readonly onUndefined?: FormatterOverride<AST.Undefined> | undefined
  readonly onVoid?: FormatterOverride<AST.Void> | undefined
  readonly onNever?: FormatterOverride<AST.Never> | undefined
  readonly onUnknown?: FormatterOverride<AST.Unknown> | undefined
  readonly onAny?: FormatterOverride<AST.Any> | undefined
  readonly onString?: FormatterOverride<AST.String> | undefined
  readonly onNumber?: FormatterOverride<AST.Number> | undefined
  readonly onBoolean?: FormatterOverride<AST.Boolean> | undefined
  readonly onSymbol?: FormatterOverride<AST.Symbol> | undefined
  readonly onBigInt?: FormatterOverride<AST.BigInt> | undefined
  readonly onUniqueSymbol?: FormatterOverride<AST.UniqueSymbol> | undefined
  readonly onObjectKeyword?: FormatterOverride<AST.ObjectKeyword> | undefined
  readonly onEnum?: FormatterOverride<AST.Enum> | undefined
  readonly onLiteral?: FormatterOverride<AST.Literal> | undefined
  readonly onTemplateLiteral?: FormatterOverride<AST.TemplateLiteral> | undefined
  readonly onArrays?: FormatterOverride<AST.Arrays> | undefined
  readonly onObjects?: FormatterOverride<AST.Objects> | undefined
  readonly onUnion?:
    | ((
      ast: AST.Union,
      visit: (ast: AST.AST) => Formatter<any>,
      getCandidates: (input: unknown) => ReadonlyArray<AST.AST>
    ) => Formatter<any>)
    | undefined
  readonly onSuspend?: FormatterOverride<AST.Suspend> | undefined
}): <T>(schema: Schema<T>) => Formatter<T> {
  const visit = memoize((ast: AST.AST): (t: any) => string => {
    // ---------------------------------------------
    // handle annotation
    // ---------------------------------------------
    const annotation = Annotations.resolve(ast)?.["formatter"] as
      | Annotations.Formatter.Override<any, ReadonlyArray<any>>
      | undefined
    if (annotation) {
      return annotation(AST.isDeclaration(ast) ? ast.typeParameters.map(visit) : [])
    }
    switch (ast._tag) {
      case "Never":
        if (options.onNever) return options.onNever(ast, visit)
        throw new globalThis.Error("required `formatter` annotation", { cause: ast })
      case "Arrays": {
        if (options.onArrays) return options.onArrays(ast, visit)
        const elements = ast.elements.map(visit)
        const rest = ast.rest.map(visit)
        return (t) => {
          const out: Array<string> = []
          let i = 0
          // ---------------------------------------------
          // handle elements
          // ---------------------------------------------
          for (; i < elements.length; i++) {
            if (t.length < i + 1) {
              if (AST.isOptional(ast.elements[i])) {
                continue
              }
            } else {
              out.push(elements[i](t[i]))
            }
          }
          // ---------------------------------------------
          // handle rest element
          // ---------------------------------------------
          if (rest.length > 0) {
            const [head, ...tail] = rest
            for (; i < t.length - tail.length; i++) {
              out.push(head(t[i]))
            }
            // ---------------------------------------------
            // handle post rest elements
            // ---------------------------------------------
            for (let j = 0; j < tail.length; j++) {
              i += j
              out.push(tail[j](t[i]))
            }
          }

          return "[" + out.join(", ") + "]"
        }
      }
      case "Objects": {
        if (options.onObjects) return options.onObjects(ast, visit)
        const propertySignatures = ast.propertySignatures.map((ps) => visit(ps.type))
        const indexSignatures = ast.indexSignatures.map((is) => visit(is.type))
        if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
          return format
        }
        return (t) => {
          const out: Array<string> = []
          const visited = new Set<PropertyKey>()
          // ---------------------------------------------
          // handle property signatures
          // ---------------------------------------------
          for (let i = 0; i < propertySignatures.length; i++) {
            const ps = ast.propertySignatures[i]
            const name = ps.name
            visited.add(name)
            if (AST.isOptional(ps.type) && !Object.hasOwn(t, name)) {
              continue
            }
            out.push(`${formatPropertyKey(name)}: ${propertySignatures[i](t[name])}`)
          }
          // ---------------------------------------------
          // handle index signatures
          // ---------------------------------------------
          for (let i = 0; i < indexSignatures.length; i++) {
            const keys = AST.getIndexSignatureKeys(t, ast.indexSignatures[i].parameter)
            for (const key of keys) {
              if (visited.has(key)) {
                continue
              }
              visited.add(key)
              out.push(`${formatPropertyKey(key)}: ${indexSignatures[i](t[key])}`)
            }
          }

          return out.length > 0 ? "{ " + out.join(", ") + " }" : "{}"
        }
      }
      case "Union": {
        const getCandidates = (t: any) => AST.getCandidates(t, ast.types)
        if (options.onUnion) return options.onUnion(ast, visit, getCandidates)
        return (t) => {
          const candidates = getCandidates(t)
          const refinements = candidates.map(Parser.refinement)
          for (let i = 0; i < candidates.length; i++) {
            const is = refinements[i]
            if (is(t)) {
              return visit(candidates[i])(t)
            }
          }
          return format(t)
        }
      }
      case "Suspend": {
        if (options.onSuspend) return options.onSuspend(ast, visit)
        const get = AST.memoizeThunk(() => visit(ast.thunk()))
        return (t) => get()(t)
      }
      case "Void":
        if (options.onVoid) return options.onVoid(ast, visit)
        return () => "void"
      default: {
        const handler: any = options[`on${ast._tag}`]
        if (handler) return handler(ast, visit)
        return format
      }
    }
  })
  return (schema) => visit(schema.ast)
}

/**
 * @category Formatter
 * @since 4.0.0
 */
export const makeFormatter = makeFormatterCompiler({})

// -----------------------------------------------------------------------------
// Equivalence APIs
// -----------------------------------------------------------------------------

/**
 * **Technical Note**
 *
 * This annotation cannot be added to `Annotations.Bottom` because it would make
 * the schema invariant.
 *
 * @category Equivalence
 * @since 4.0.0
 */
export function overrideEquivalence<S extends Top>(equivalence: () => Equivalence.Equivalence<S["Type"]>) {
  return (self: S): S["~rebuild.out"] => {
    return self.annotate({ equivalence })
  }
}

/**
 * @category Equivalence
 * @since 4.0.0
 */
export function makeEquivalence<T>(schema: Schema<T>): Equivalence.Equivalence<T> {
  return InternalEquivalence.memoized(schema.ast)
}

// -----------------------------------------------------------------------------
// JsonSchema APIs
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 */
export interface JsonSchemaOptions {
  /**
   * A record of definitions which are included in the schema.
   *
   * Defaults to the empty object `{}`.
   */
  readonly definitions?: Record<string, JsonSchema.Schema> | undefined
  /**
   * Controls how additional properties are handled while resolving the JSON
   * schema.
   *
   * Possible values include:
   * - `false`: Disallow additional properties (default)
   * - `true`: Allow additional properties
   * - `JsonSchema`: Use the provided JSON Schema for additional properties
   */
  readonly additionalProperties?: true | false | JsonSchema.Schema | undefined
  /**
   * Controls how references are handled while resolving the JSON schema.
   *
   * Possible values include:
   * - `"keep"`: Keep references (default)
   * - `"skip"`: Skip all references (recursive schemas excluded)
   * - `"skip-top-level"`: Skip top-level references
   */
  readonly referenceStrategy?: "keep" | "skip" | "skip-top-level" | undefined
  /**
   * A function that is called when a JSON Schema annotation is missing. This
   * will be the default result instead of throwing an error.
   */
  readonly onMissingJsonSchemaAnnotation?: ((ast: AST.AST) => JsonSchema.Schema | undefined) | undefined
  /**
   * Controls whether to generate descriptions for checks (if the user has not
   * provided them) based on the `expected` annotation of the check.
   */
  readonly generateDescriptions?: boolean | undefined
}

/**
 * @category JsonSchema
 * @since 4.0.0
 */
export declare namespace JsonSchema {
  /**
   * @since 4.0.0
   */
  export type Type = "string" | "number" | "boolean" | "array" | "object" | "null" | "integer"

  /**
   * @since 4.0.0
   */
  export type Fragment = {
    [x: string]: unknown
  }

  /**
   * @since 4.0.0
   */
  export interface Schema extends Fragment {
    type?: Type
  }

  /**
   * @since 4.0.0
   */
  export interface Definitions extends Record<string, Schema> {}

  /**
   * @since 4.0.0
   */
  export interface Document {
    readonly uri: string
    readonly schema: Schema
    readonly definitions: Definitions
  }
}

/**
 * Returns a JSON Schema Draft 07 result.
 *
 * @category JsonSchema
 * @since 4.0.0
 */
export function makeJsonSchemaDraft07<S extends Top>(schema: S, options?: JsonSchemaOptions): JsonSchema.Document {
  return InternalJsonSchema.make(schema, {
    ...options,
    target: "draft-07"
  })
}

/**
 * Returns a JSON Schema 2020-12 result.
 *
 * @category JsonSchema
 * @since 4.0.0
 */
export function makeJsonSchemaDraft2020_12<S extends Top>(schema: S, options?: JsonSchemaOptions): JsonSchema.Document {
  return InternalJsonSchema.make(schema, {
    ...options,
    target: "2020-12"
  })
}

/**
 * Returns a JSON Schema OpenAPI 3.1 result.
 *
 * @category JsonSchema
 * @since 4.0.0
 */
export function makeJsonSchemaOpenApi3_1<S extends Top>(schema: S, options?: JsonSchemaOptions): JsonSchema.Document {
  return InternalJsonSchema.make(schema, {
    ...options,
    target: "oas3.1"
  })
}

// -----------------------------------------------------------------------------
// Serializer APIs
// -----------------------------------------------------------------------------

/**
 * @category Serializer
 * @since 4.0.0
 */
export function toSerializerJson<T, E, RD, RE>(schema: Codec<T, E, RD, RE>): Codec<T, unknown, RD, RE> {
  return make(serializerJson(schema.ast))
}

/**
 * @category Serializer
 * @since 4.0.0
 */
export function toSerializerIso<S extends Top>(schema: S): Codec<S["Type"], S["Iso"]> {
  return make(serializerIso(AST.typeAST(schema.ast)))
}

/**
 * @category Serializer
 * @since 4.0.0
 */
export type StringTree = Getter.Tree<string | undefined>

/**
 * @category Serializer
 * @since 4.0.0
 */
export function toSerializerStringTree<T, E, RD, RE>(schema: Codec<T, E, RD, RE>): Codec<T, StringTree, RD, RE> {
  return make(serializerStringTree(schema.ast))
}

/**
 * @category Serializer
 * @since 4.0.0
 */
export function toSerializerStringTreeLoose<T, E, RD, RE>(schema: Codec<T, E, RD, RE>): Codec<T, unknown, RD, RE> {
  return make(serializerStringTreeLoose(schema.ast))
}

/**
 * @category Serializer
 * @since 4.0.0
 */
export function toSerializerEnsureArray<T, RD, RE>(schema: Codec<T, unknown, RD, RE>): Codec<T, unknown, RD, RE>
export function toSerializerEnsureArray<T, RD, RE>(schema: Codec<T, StringTree, RD, RE>): Codec<T, StringTree, RD, RE>
export function toSerializerEnsureArray<T, RD, RE>(schema: Codec<T, unknown, RD, RE>): Codec<T, unknown, RD, RE> {
  return make(serializerEnsureArray(schema.ast))
}

type XmlEncoderOptions = {
  /** Root element name for the returned XML string. Default: "root" */
  readonly rootName?: string | undefined
  /** When an array doesn't have a natural item name, use this. Default: "item" */
  readonly arrayItemName?: string | undefined
  /** Pretty-print output. Default: true */
  readonly pretty?: boolean | undefined
  /** Indentation used when pretty-printing. Default: "  " (two spaces) */
  readonly indent?: string | undefined
  /** Sort object keys for stable output. Default: true */
  readonly sortKeys?: boolean | undefined
}

/**
 * @category Serializer
 * @since 4.0.0
 */
export function makeEncoderXml<T, E, RD, RE>(
  codec: Codec<T, E, RD, RE>,
  options?: XmlEncoderOptions
) {
  const rootName = Annotations.resolveIdentifier(codec.ast) ?? Annotations.resolveTitle(codec.ast)
  const serialize = encodeEffect(toSerializerStringTree(codec))
  return (t: T): Effect.Effect<string, SchemaError, RE> =>
    serialize(t).pipe(Effect.map((pojo) => stringTreeToXml(pojo, { rootName, ...options })))
}

function serializerJsonBase(ast: AST.AST): AST.AST {
  switch (ast._tag) {
    case "Unknown":
    case "ObjectKeyword":
    case "Declaration": {
      const getLink = ast.annotations?.serializerJson ?? ast.annotations?.serializer
      if (Predicate.isFunction(getLink)) {
        const tps = AST.isDeclaration(ast)
          ? ast.typeParameters.map((tp) => make(serializerJson(AST.encodedAST(tp))))
          : []
        const link = getLink(tps)
        const to = serializerJson(link.to)
        return AST.replaceEncoding(ast, to === link.to ? [link] : [new AST.Link(to, link.transformation)])
      }
      return AST.replaceEncoding(ast, [unknownToNull])
    }
    case "Undefined":
    case "Void":
      return ast.encodeToNull()
    case "UniqueSymbol":
    case "Symbol":
    case "BigInt":
      return ast.encodeToString()
    case "Literal":
      return ast.encodeToStringOrNumberOrBoolean()
    case "Number":
      return ast.encodeToNumberOrNonFiniteLiterals()
    case "Objects":
    case "Arrays":
    case "Union":
    case "Suspend": {
      if (AST.isObjects(ast) && ast.propertySignatures.some((ps) => typeof ps.name !== "string")) {
        throw new globalThis.Error("Objects property names must be strings", { cause: ast })
      }
      return ast.recur(serializerJson)
    }
  }
  // `Schema.Any` is used as an escape hatch
  return ast
}

const unknownToNull = new AST.Link(
  AST.null,
  new Transformation.Transformation(
    Getter.passthrough(),
    Getter.transform(() => null)
  )
)

const serializerJson = AST.serializer((ast) => {
  const out = serializerJsonBase(ast)
  if (out !== ast && AST.isOptional(ast)) {
    return AST.optionalKeyLastLink(out)
  }
  return out
})

function serializerIsoBase(ast: AST.AST): AST.AST {
  switch (ast._tag) {
    case "Declaration": {
      const getLink = ast.annotations?.serializerIso ?? ast.annotations?.serializer
      if (Predicate.isFunction(getLink)) {
        const link = getLink(ast.typeParameters.map((tp) => make(serializerIso(tp))))
        const to = serializerIso(link.to)
        return AST.replaceEncoding(ast, to === link.to ? [link] : [new AST.Link(to, link.transformation)])
      }
      return ast
    }
    case "Arrays":
    case "Objects":
    case "Union":
    case "Suspend":
      return ast.recur(serializerIso)
  }
  return ast
}

const serializerIso = memoize((ast: AST.AST): AST.AST => {
  const out = serializerIsoBase(ast)
  if (out !== ast && AST.isOptional(ast)) {
    return AST.optionalKeyLastLink(out)
  }
  return out
})

function serializerTree(
  ast: AST.AST,
  recur: (ast: AST.AST) => AST.AST,
  onMissingAnnotation: (ast: AST.AST) => AST.AST
): AST.AST {
  switch (ast._tag) {
    case "Unknown":
    case "ObjectKeyword":
    case "Declaration": {
      const getLink = ast.annotations?.serializerJson ?? ast.annotations?.serializer
      if (Predicate.isFunction(getLink)) {
        const tps = AST.isDeclaration(ast)
          ? ast.typeParameters.map((tp) => make(recur(AST.encodedAST(tp))))
          : []
        const link = getLink(tps)
        const to = recur(link.to)
        return AST.replaceEncoding(ast, to === link.to ? [link] : [new AST.Link(to, link.transformation)])
      }
      return onMissingAnnotation(ast)
    }
    case "Null":
      return AST.replaceEncoding(ast, [nullToUndefined])
    case "Boolean":
      return AST.replaceEncoding(ast, [booleanToString])
    case "Enum":
    case "Number":
    case "Literal":
    case "UniqueSymbol":
    case "Symbol":
    case "BigInt":
      return ast.encodeToString()
    case "Objects":
    case "Arrays":
    case "Union":
    case "Suspend": {
      if (AST.isObjects(ast) && ast.propertySignatures.some((ps) => typeof ps.name !== "string")) {
        throw new globalThis.Error("Objects property names must be strings", { cause: ast })
      }
      return ast.recur(recur)
    }
  }
  // `Schema.Any` is used as an escape hatch
  return ast
}

const nullToUndefined = new AST.Link(
  AST.undefined,
  new Transformation.Transformation(
    Getter.transform(() => null),
    Getter.transform(() => undefined)
  )
)

const booleanToString = new AST.Link(
  new AST.Union([new AST.Literal("true"), new AST.Literal("false")], "anyOf"),
  new Transformation.Transformation(
    Getter.transform((s) => s === "true"),
    Getter.String()
  )
)

const serializerStringTree = AST.serializer((ast) => {
  const out = serializerTree(ast, serializerStringTree, (ast) => AST.replaceEncoding(ast, [unknownToUndefined]))
  if (out !== ast && AST.isOptional(ast)) {
    return AST.optionalKeyLastLink(out)
  }
  return out
})

const unknownToUndefined = new AST.Link(
  AST.undefined,
  new Transformation.Transformation(
    Getter.passthrough(),
    Getter.transform(() => undefined)
  )
)

const serializerStringTreeLoose = AST.serializer((ast) => {
  const out = serializerTree(ast, serializerStringTreeLoose, identity)
  if (out !== ast && AST.isOptional(ast)) {
    return AST.optionalKeyLastLink(out)
  }
  return out
})

const SERIALIZER_ENSURE_ARRAY = "~effect/schema/Schema/SERIALIZER_ENSURE_ARRAY"

function serializerEnsureArrayBase(ast: AST.AST): AST.AST {
  switch (ast._tag) {
    case "Declaration":
    case "Arrays":
    case "Objects":
    case "Union":
    case "Suspend":
      return ast.recur(serializerEnsureArray)
    default:
      return ast
  }
}

const serializerEnsureArray = AST.serializer((ast) => {
  if (AST.isUnion(ast) && ast.annotations?.[SERIALIZER_ENSURE_ARRAY]) {
    return ast
  }
  const out = serializerEnsureArrayBase(ast)
  if (AST.isArrays(out)) {
    const ensure = new AST.Union(
      [
        out,
        AST.decodeTo(
          AST.string,
          out,
          new Transformation.Transformation(
            Getter.split(),
            Getter.passthrough()
          )
        )
      ],
      "anyOf",
      { [SERIALIZER_ENSURE_ARRAY]: true }
    )
    return AST.isOptional(ast) ? AST.optionalKey(ensure) : ensure
  }
  return out
})

function stringTreeToXml(value: StringTree, options: XmlEncoderOptions): string {
  const opts: { [P in keyof XmlEncoderOptions]-?: Exclude<XmlEncoderOptions[P], undefined> } = {
    rootName: options.rootName ?? "root",
    arrayItemName: options.arrayItemName ?? "item",
    pretty: options.pretty ?? true,
    indent: options.indent ?? "  ",
    sortKeys: options.sortKeys ?? true
  }

  const seen = new Set<{ readonly [x: string]: StringTree } | ReadonlyArray<StringTree>>()
  const lines: Array<string> = []
  const push = (depth: number, text: string) => lines.push(opts.pretty ? opts.indent.repeat(depth) + text : text)

  const tagInfo = (name: string, original?: string) => {
    const { changed, safe } = parseTagName(name)
    const needsMeta = changed || (original && original !== name)
    const attrs = needsMeta ? ` data-name="${escapeAttribute(original ?? name)}"` : ""
    return { safe, attrs }
  }

  const render = (tagName: string, node: StringTree, depth: number, originalNameForMeta?: string): void => {
    if (node === undefined) {
      const { attrs, safe } = tagInfo(tagName, originalNameForMeta)
      push(depth, `<${safe}${attrs}/>`)
      return
    }

    if (typeof node === "string") {
      const { attrs, safe } = tagInfo(tagName, originalNameForMeta)
      push(depth, `<${safe}${attrs}>${escapeText(node)}</${safe}>`)
      return
    }

    if (seen.has(node)) throw new globalThis.Error("Cycle detected while serializing to XML.", { cause: node })
    seen.add(node)
    try {
      // this try / catch is necessary because if there are cycles, the encoder will throw an error
      if (globalThis.Array.isArray(node)) {
        const { attrs, safe: safeParent } = tagInfo(tagName, originalNameForMeta)
        if (node.length === 0) {
          push(depth, `<${safeParent}${attrs}/>`)
        } else {
          push(depth, `<${safeParent}${attrs}>`)
          for (const item of node) render(opts.arrayItemName, item, depth + 1)
          push(depth, `</${safeParent}>`)
        }
      } else {
        const obj = node as { readonly [x: string]: StringTree }
        const { attrs, safe } = tagInfo(tagName, originalNameForMeta)
        const keys = Object.keys(obj)
        if (opts.sortKeys) keys.sort()
        if (keys.length === 0) {
          push(depth, `<${safe}${attrs}/>`)
          return
        }
        push(depth, `<${safe}${attrs}>`)
        for (const k of keys) {
          const { safe: childSafe } = parseTagName(k)
          render(childSafe, obj[k], depth + 1, k)
        }
        push(depth, `</${safe}>`)
      }
    } finally {
      seen.delete(node)
    }
  }

  render(opts.rootName, value, 0)
  return opts.pretty ? lines.join("\n") : lines.join("")
}

const escapeText = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const escapeAttribute = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const parseTagName = (name: string): { safe: string; changed: boolean } => {
  const original = name
  let safe = name
  if (!/^[A-Za-z_]/.test(safe)) safe = "_" + safe
  safe = safe.replace(/[^A-Za-z0-9._-]/g, "_")
  if (/^xml/i.test(safe)) safe = "_" + safe
  return { safe, changed: safe !== original }
}

// -----------------------------------------------------------------------------
// Optic APIs
// -----------------------------------------------------------------------------

/**
 * @category Optic
 * @since 4.0.0
 */
export function makeIso<S extends Top>(schema: S): Optic_.Iso<S["Type"], S["Iso"]> {
  const serializer = toSerializerIso(schema)
  return Optic_.makeIso(Parser.encodeSync(serializer), Parser.decodeSync(serializer))
}

/**
 * @category Optic
 * @since 4.0.0
 */
export function makeIsoSource<S extends Top>(_: S): Optic_.Iso<S["Type"], S["Type"]> {
  return Optic_.id()
}

/**
 * @category Optic
 * @since 4.0.0
 */
export function makeIsoFocus<S extends Top>(_: S): Optic_.Iso<S["Iso"], S["Iso"]> {
  return Optic_.id()
}

/**
 * @category Optic
 * @since 4.0.0
 */
export interface overrideIso<S extends Top, Iso> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingServices"],
    S["EncodingServices"],
    S["ast"],
    overrideIso<S, Iso>,
    S["~type.make.in"],
    Iso,
    S["~type.parameters"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  readonly "~rebuild.out": this
  readonly schema: S
}

/**
 * **Technical Note**
 *
 * This annotation cannot be added to `Annotations.Bottom` because it changes
 * the schema type.
 *
 * @category Optic
 * @since 4.0.0
 */
export function overrideIso<S extends Top, Iso>(
  to: Codec<Iso>,
  transformation: {
    readonly decode: Getter.Getter<S["Type"], Iso>
    readonly encode: Getter.Getter<Iso, S["Type"]>
  }
) {
  return (schema: S): overrideIso<S, Iso> => {
    return makeProto(
      AST.annotate(schema.ast, {
        serializerIso: () => new AST.Link(to.ast, Transformation.make(transformation))
      }),
      { schema }
    )
  }
}

// -----------------------------------------------------------------------------
// Differ APIs
// -----------------------------------------------------------------------------

/**
 * RFC 6902 (subset) JSON Patch operations
 * Keeping only "add", "remove", "replace"
 *
 * @category JsonPatch Differ
 * @since 4.0.0
 */
export type JsonPatchOperation =
  | { op: "add"; path: string; value: unknown } // path may end with "-" to append to arrays
  | { op: "remove"; path: string }
  | { op: "replace"; path: string; value: unknown }

/**
 * A JSON Patch document is an array of operations
 *
 * @category JsonPatch Differ
 * @since 4.0.0
 */
export type JsonPatch = ReadonlyArray<JsonPatchOperation>

/**
 * @category JsonPatch Differ
 * @since 4.0.0
 */
export function makeDifferJsonPatch<T, E>(codec: Codec<T, E>): Differ<T, JsonPatch> {
  const serializer = toSerializerJson(codec)
  const get = Parser.encodeSync(serializer)
  const set = Parser.decodeSync(serializer)
  return {
    empty: [],
    diff: (oldValue, newValue) => InternalDiffer.getJsonPatch(get(oldValue), get(newValue)),
    combine: (first, second) => [...first, ...second],
    patch: (oldValue, patch) => {
      const value = get(oldValue)
      const patched = InternalDiffer.applyJsonPatch(patch, value)
      return Object.is(patched, value) ? oldValue : set(patched)
    }
  }
}
