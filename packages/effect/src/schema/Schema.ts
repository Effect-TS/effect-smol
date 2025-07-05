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
 * Configuration options for the `makeSync` method, providing control over parsing
 * behavior and validation.
 *
 * @example Basic Usage with parseOptions
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const person = PersonSchema.makeSync(
 *   { name: "John", age: 30 },
 *   { parseOptions: { errors: "all" } }
 * )
 * console.log(person) // { name: "John", age: 30 }
 * ```
 *
 * @example Using disableValidation for Performance
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const StringSchema = Schema.String
 *
 * // With validation (default)
 * const validated = StringSchema.makeSync("hello")
 * console.log(validated) // "hello"
 *
 * // Skip validation for performance-critical code
 * const unvalidated = StringSchema.makeSync("hello", { disableValidation: true })
 * console.log(unvalidated) // "hello"
 * ```
 *
 * @example Combined Options Usage
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const UserSchema = Schema.Struct({
 *   id: Schema.Number,
 *   email: Schema.String
 * })
 *
 * // Configure both parsing and validation options
 * const user = UserSchema.makeSync(
 *   { id: 1, email: "user@example.com" },
 *   {
 *     parseOptions: { errors: "all" },
 *     disableValidation: false
 *   }
 * )
 * console.log(user) // { id: 1, email: "user@example.com" }
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export interface MakeOptions {
  readonly parseOptions?: AST.ParseOptions | undefined
  readonly disableValidation?: boolean | undefined
}

/**
 * The unique identifier for Schema values.
 *
 * @example Basic TypeId usage
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Access the TypeId constant
 * console.log(Schema.TypeId) // "~effect/schema/Schema"
 * ```
 *
 * @example Using TypeId for type guards
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const StringSchema = Schema.String
 * const NumberSchema = Schema.Number
 * const notASchema = { value: "test" }
 *
 * // Check if a value is a schema using isSchema
 * console.log(Schema.isSchema(StringSchema)) // true
 * console.log(Schema.isSchema(NumberSchema)) // true
 * console.log(Schema.isSchema(notASchema)) // false
 * ```
 *
 * @example Schema identification in collections
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schemas = [
 *   Schema.String,
 *   Schema.Number,
 *   "not a schema",
 *   Schema.Boolean
 * ]
 *
 * // Filter out only valid schemas
 * const validSchemas = schemas.filter(Schema.isSchema)
 * console.log(validSchemas.length) // 3
 * ```
 *
 * @since 4.0.0
 * @category symbols
 */
export const TypeId: TypeId = "~effect/schema/Schema"

/**
 * The unique identifier type for Schema values.
 *
 * @example Type-level schema identification
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Type-level check for schema TypeId
 * type IsSchemaTypeId<T> = T extends { readonly [Schema.TypeId]: infer U } ? U : never
 *
 * const StringSchema = Schema.String
 * type StringSchemaTypeId = IsSchemaTypeId<typeof StringSchema>
 * // StringSchemaTypeId is "~effect/schema/Schema"
 * ```
 *
 * @example Using TypeId in type guards
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Custom type guard using TypeId
 * function hasSchemaTypeId<T>(value: T): value is T & { readonly [Schema.TypeId]: Schema.TypeId } {
 *   return value !== null && typeof value === "object" && Schema.TypeId in value
 * }
 *
 * const StringSchema = Schema.String
 * const regularObject = { name: "test" }
 *
 * console.log(hasSchemaTypeId(StringSchema)) // true
 * console.log(hasSchemaTypeId(regularObject)) // false
 * ```
 *
 * @example Extracting TypeId from schema types
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Type utility to extract TypeId from schema types
 * type ExtractTypeId<T> = T extends { readonly [Schema.TypeId]: infer U } ? U : never
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * type PersonSchemaTypeId = ExtractTypeId<typeof PersonSchema>
 * // PersonSchemaTypeId is "~effect/schema/Schema"
 * ```
 *
 * @since 4.0.0
 * @category symbols
 */
export type TypeId = "~effect/schema/Schema"

/**
 * The base interface for all schemas in the Effect Schema library, exposing all 14 type parameters
 * that control schema behavior and type inference. Bottom sits at the root of the schema type
 * hierarchy and provides access to the complete internal type information of schemas.
 *
 * Bottom is primarily used for advanced type-level operations, schema introspection, and when you
 * need precise control over all aspects of schema behavior including mutability, optionality,
 * service dependencies, and transformation characteristics.
 *
 * @example Basic Bottom interface usage with type parameter access
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a simple string schema
 * const stringSchema = Schema.String
 *
 * // Reveal the Bottom interface to access all type parameters
 * const revealed = Schema.revealBottom(stringSchema)
 *
 * // Access the 14 type parameters through type-level operations
 * type DecodedType = typeof revealed["Type"]                    // string
 * type EncodedType = typeof revealed["Encoded"]                 // string
 * type DecodingServices = typeof revealed["DecodingServices"]   // never
 * type EncodingServices = typeof revealed["EncodingServices"]   // never
 * type TypeMakeIn = typeof revealed["~type.make.in"]           // string
 * type TypeMake = typeof revealed["~type.make"]                // string
 * type TypeMutability = typeof revealed["~type.mutability"]    // "readonly"
 * type TypeOptionality = typeof revealed["~type.optionality"]  // "required"
 * ```
 *
 * @example Advanced type extraction from complex schemas
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a complex schema with transformations
 * const UserSchema = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String,
 *   email: Schema.String,
 *   age: Schema.optional(Schema.Number)
 * })
 *
 * // Reveal Bottom interface for complete type information
 * const userBottom = Schema.revealBottom(UserSchema)
 *
 * // Extract complete type information
 * type UserType = typeof userBottom["Type"]
 * // { readonly id: number; readonly name: string; readonly email: string; readonly age?: number }
 *
 * type UserEncoded = typeof userBottom["Encoded"]
 * // { readonly id: number; readonly name: string; readonly email: string; readonly age?: number }
 *
 * type UserMakeIn = typeof userBottom["~type.make.in"]
 * // { readonly id: number; readonly name: string; readonly email: string; readonly age?: number }
 * ```
 *
 * @example Using Bottom for schema transformation analysis
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a transformation schema
 * const DateFromString = Schema.Date.pipe(
 *   Schema.encodeTo(Schema.String)
 * )
 *
 * const revealed = Schema.revealBottom(DateFromString)
 *
 * // Analyze transformation characteristics
 * type InputType = typeof revealed["Type"]           // Date
 * type OutputType = typeof revealed["Encoded"]       // string
 * type HasServices = typeof revealed["DecodingServices"] extends never ? false : true  // false
 *
 * // Type-level validation of schema properties
 * type IsReadonly = typeof revealed["~type.mutability"] extends "readonly" ? true : false    // true
 * type IsRequired = typeof revealed["~type.optionality"] extends "required" ? true : false   // true
 * ```
 *
 * @example Advanced type-level operations with Bottom parameters
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a utility type to extract all Bottom parameters
 * type ExtractBottomInfo<S extends Schema.Top> = {
 *   Type: S["Type"]
 *   Encoded: S["Encoded"]
 *   DecodingServices: S["DecodingServices"]
 *   EncodingServices: S["EncodingServices"]
 *   TypeMakeIn: S["~type.make.in"]
 *   TypeMake: S["~type.make"]
 *   TypeMutability: S["~type.mutability"]
 *   TypeOptionality: S["~type.optionality"]
 *   TypeConstructorDefault: S["~type.constructor.default"]
 *   EncodedMutability: S["~encoded.mutability"]
 *   EncodedOptionality: S["~encoded.optionality"]
 * }
 *
 * // Apply to different schema types
 * const NumberSchema = Schema.Number
 * const OptionalStringSchema = Schema.optional(Schema.String)
 *
 * type NumberInfo = ExtractBottomInfo<typeof NumberSchema>
 * type OptionalStringInfo = ExtractBottomInfo<typeof OptionalStringSchema>
 *
 * // Use in conditional type logic
 * type HasDefaultConstructor<S extends Schema.Top> =
 *   S["~type.constructor.default"] extends "with-default" ? true : false
 *
 * type NumberHasDefault = HasDefaultConstructor<typeof NumberSchema>        // false
 * type OptionalHasDefault = HasDefaultConstructor<typeof OptionalStringSchema> // true
 * ```
 *
 * @example Bottom interface in generic schema functions
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Generic function that works with any Bottom-compatible schema
 * function analyzeSchema<T, E, RD, RE>(
 *   schema: Schema.Top
 * ) {
 *   const revealed = Schema.revealBottom(schema)
 *   return {
 *     hasDecodingServices: revealed["DecodingServices"] !== undefined,
 *     hasEncodingServices: revealed["EncodingServices"] !== undefined,
 *     isOptional: revealed["~type.optionality"] === "optional",
 *     isMutable: revealed["~type.mutability"] === "mutable",
 *     ast: revealed.ast
 *   }
 * }
 *
 * // Use with different schemas
 * const stringAnalysis = analyzeSchema(Schema.String)
 * const optionalAnalysis = analyzeSchema(Schema.optional(Schema.Number))
 * ```
 *
 * @category models
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
 * Reveals the complete Bottom interface type of a schema, exposing all 14 type parameters.
 *
 * This utility function takes any schema extending Top and returns the same schema
 * typed as Bottom with all type parameters explicitly accessible. It's particularly
 * useful for advanced type-level operations, debugging type issues, or when you need
 * direct access to the schema's internal type structure.
 *
 * The function is a pure type-level utility that doesn't modify the schema at runtime
 * but provides better TypeScript intellisense and type information for the Bottom interface.
 *
 * @example Basic usage with primitive schemas
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Reveal the Bottom interface of a String schema
 * const stringSchema = Schema.String
 * const revealedString = Schema.revealBottom(stringSchema)
 *
 * // Now you have access to all Bottom interface type parameters
 * type StringType = typeof revealedString["Type"]        // string
 * type StringEncoded = typeof revealedString["Encoded"]  // string
 * type StringAST = typeof revealedString["ast"]          // AST.StringKeyword
 * ```
 *
 * @example Working with complex schemas
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a struct schema
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * // Reveal the Bottom interface to access type parameters
 * const revealedPerson = Schema.revealBottom(PersonSchema)
 *
 * // Extract specific type information
 * type PersonType = typeof revealedPerson["Type"]
 * // { readonly name: string; readonly age: number }
 *
 * type PersonEncoded = typeof revealedPerson["Encoded"]
 * // { readonly name: string; readonly age: number }
 *
 * type PersonAST = typeof revealedPerson["ast"]
 * // AST.TypeLiteral
 * ```
 *
 * @example Type-level analysis and debugging
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a transformation schema
 * const NumberFromString = Schema.String.pipe(
 *   Schema.decodeTo(Schema.Number)
 * )
 *
 * // Reveal Bottom interface for type analysis
 * const revealed = Schema.revealBottom(NumberFromString)
 *
 * // Access transformation type information
 * type DecodedType = typeof revealed["Type"]               // number
 * type EncodedType = typeof revealed["Encoded"]            // string
 * type DecodingServices = typeof revealed["DecodingServices"] // never
 * type EncodingServices = typeof revealed["EncodingServices"] // never
 *
 * // Access mutability and optionality information
 * type TypeMutability = typeof revealed["~type.mutability"]     // "readonly"
 * type TypeOptionality = typeof revealed["~type.optionality"]   // "required"
 * ```
 *
 * @category utils
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
 * @example Basic annotation with title and description
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const UsernameSchema = Schema.String.pipe(
 *   Schema.annotate({
 *     title: "Username",
 *     description: "A unique identifier for the user"
 *   })
 * )
 * ```
 *
 * @example Multiple annotations with examples and default values
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const AgeSchema = Schema.Number.pipe(
 *   Schema.annotate({
 *     title: "Age",
 *     description: "Person's age in years",
 *     default: 0,
 *     examples: [25, 30, 45]
 *   })
 * )
 * ```
 *
 * @example Chaining annotations with other schema operations
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * const EmailSchema = Schema.String.pipe(
 *   Schema.annotate({
 *     title: "Email Address",
 *     description: "A valid email address",
 *     examples: ["user@example.com", "admin@company.org"]
 *   }),
 *   Schema.check(Check.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
 * )
 * ```
 *
 * @example Custom error message annotation
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const PositiveNumberSchema = Schema.Number.pipe(
 *   Schema.annotate({
 *     message: "Must be a positive number"
 *   })
 * )
 * ```
 *
 * @category annotations
 * @since 4.0.0
 */
export function annotate<S extends Top>(annotations: S["~annotate.in"]) {
  return (self: S): S["~rebuild.out"] => {
    return self.annotate(annotations)
  }
}

/**
 * Adds key-specific annotations to a schema field. This is useful for providing
 * custom error messages and documentation for individual fields within structures.
 *
 * Key annotations are applied to the field itself rather than the field's value,
 * allowing you to customize messages for missing keys, unexpected keys, and
 * provide field-level documentation.
 *
 * @example Basic usage with custom missing key message
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String.pipe(
 *     Schema.annotateKey({ missingKeyMessage: "Name is required" })
 *   ),
 *   age: Schema.Number.pipe(
 *     Schema.annotateKey({ missingKeyMessage: "Age is required" })
 *   )
 * })
 *
 * // When validation fails, custom messages are shown
 * Schema.decodeUnknownSync(PersonSchema)({})
 * // ParseError: Expected { readonly name: string; readonly age: number }, actual {}
 * // └─ ["name"]
 * //    └─ Name is required
 * // └─ ["age"]
 * //    └─ Age is required
 * ```
 *
 * @example Field documentation with title and description
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const ConfigSchema = Schema.Struct({
 *   apiKey: Schema.String.pipe(
 *     Schema.annotateKey({
 *       title: "API Key",
 *       description: "The secret key used to authenticate with the API",
 *       missingKeyMessage: "API key is required for authentication"
 *     })
 *   ),
 *   timeout: Schema.Number.pipe(
 *     Schema.annotateKey({
 *       title: "Request Timeout",
 *       description: "Maximum time in milliseconds to wait for API responses",
 *       missingKeyMessage: "Timeout configuration is required"
 *     })
 *   )
 * })
 *
 * // The annotations provide metadata that can be used by documentation
 * // generators and validation error messages
 * ```
 *
 * @example Custom unexpected key message
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const UserSchema = Schema.Struct({
 *   id: Schema.Number.pipe(
 *     Schema.annotateKey({ unexpectedKeyMessage: "User ID should not be provided" })
 *   ),
 *   name: Schema.String
 * })
 *
 * // This would show custom message for unexpected keys
 * // Note: unexpectedKeyMessage is used by the parent struct, not the field itself
 * ```
 *
 * @example Dynamic error messages with functions
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const OrderSchema = Schema.Struct({
 *   orderId: Schema.String.pipe(
 *     Schema.annotateKey({
 *       missingKeyMessage: () => `Order ID is required for processing`,
 *       title: "Order Identifier"
 *     })
 *   ),
 *   amount: Schema.Number.pipe(
 *     Schema.annotateKey({
 *       missingKeyMessage: () => `Amount must be specified`,
 *       title: "Order Amount"
 *     })
 *   )
 * })
 *
 * // Dynamic messages allow for more flexible error reporting
 * ```
 *
 * @category annotations
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
 * Represents the base interface that all schemas implement in the Effect Schema library.
 * The `Top` interface sits at the top of the schema type hierarchy and provides the
 * foundation for all schema types by extending `Bottom` with the most general type parameters.
 *
 * This interface defines the common structure and capabilities that all schemas share,
 * including type information, AST representation, and transformation methods.
 *
 * @example Type constraint in generic functions
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Function that works with any schema type
 * declare function processSchema<S extends Schema.Top>(schema: S): S["Type"]
 *
 * // Usage with different schema types
 * const stringSchema = Schema.String
 * const numberSchema = Schema.Number
 * const userSchema = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String
 * })
 *
 * // All these calls are type-safe
 * const stringType = processSchema(stringSchema) // string
 * const numberType = processSchema(numberSchema) // number
 * const userType = processSchema(userSchema) // { id: number; name: string }
 * ```
 *
 * @example Accessing schema type information
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Helper to extract type information from any schema
 * type ExtractType<S extends Schema.Top> = S["Type"]
 * type ExtractEncoded<S extends Schema.Top> = S["Encoded"]
 *
 * const dateSchema = Schema.Date
 *
 * // Type-level operations
 * type DateType = ExtractType<typeof dateSchema> // Date
 * type DateEncoded = ExtractEncoded<typeof dateSchema> // string
 *
 * // Runtime type information access
 * console.log("AST type:", dateSchema.ast._tag) // "DateFromString"
 * ```
 *
 * @example Schema transformation utilities
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Generic utility to make any schema optional
 * declare function makeOptional<S extends Schema.Top>(
 *   schema: S
 * ): Schema.optional<S>
 *
 * // Generic utility to add description annotation
 * declare function withDescription<S extends Schema.Top>(
 *   schema: S,
 *   description: string
 * ): S["~rebuild.out"]
 *
 * const baseSchema = Schema.String
 * const optionalSchema = makeOptional(baseSchema)
 * const describedSchema = withDescription(baseSchema, "User email address")
 * ```
 *
 * @category models
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
 * The `Schema` namespace provides utilities for working with schema types at the type level.
 * It contains type-level utilities that extract information from schema instances.
 *
 * @example Type Extraction Utility
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create schemas for different types
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number,
 *   email: Schema.String
 * })
 *
 * const NumbersSchema = Schema.Array(Schema.Number)
 * const StatusSchema = Schema.Union([
 *   Schema.Literal("pending"),
 *   Schema.Literal("completed")
 * ])
 *
 * // Use Schema.Type to extract TypeScript types
 * // Note: The full path would be Schema.Schema.Type in actual usage
 * // This namespace organizes type-level utilities for schema introspection
 * ```
 *
 * @example Namespace Organization Pattern
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // The Schema namespace provides type-level utilities
 * // Schema.Type<S> extracts the Type property from schema S
 * // This follows the pattern where utilities are organized
 * // under their respective namespaces for better discoverability
 *
 * // Other schema namespaces follow similar patterns:
 * // - Codec.Encoded<S> for encoded types
 * // - Codec.DecodingServices<S> for decoding services
 * // - Schema.Type<S> for schema types
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export declare namespace Schema {
  /**
   * Extracts the TypeScript type from a Schema.
   *
   * This type utility allows you to get the TypeScript type that a Schema represents,
   * which is useful for type annotations, function parameters, and creating type aliases.
   *
   * @example Basic Type Extraction
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Extract type from primitive schema
   * type StringType = Schema.Schema.Type<typeof Schema.String>
   * // StringType is: string
   *
   * type NumberType = Schema.Schema.Type<typeof Schema.Number>
   * // NumberType is: number
   *
   * type BooleanType = Schema.Schema.Type<typeof Schema.Boolean>
   * // BooleanType is: boolean
   * ```
   *
   * @example Struct Type Extraction
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * const UserSchema = Schema.Struct({
   *   id: Schema.Number,
   *   name: Schema.String,
   *   email: Schema.String
   * })
   *
   * type User = Schema.Schema.Type<typeof UserSchema>
   * // User = { readonly id: number; readonly name: string; readonly email: string }
   *
   * // Use the extracted type in function signatures
   * function processUser(user: User) {
   *   console.log(`Processing user: ${user.name}`)
   * }
   * ```
   *
   * @example Array and Union Type Extraction
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * const NumberArraySchema = Schema.Array(Schema.Number)
   * type NumberArray = Schema.Schema.Type<typeof NumberArraySchema>
   * // NumberArray is: readonly number[]
   *
   * const StringOrNumberSchema = Schema.Union([Schema.String, Schema.Number])
   * type StringOrNumber = Schema.Schema.Type<typeof StringOrNumberSchema>
   * // StringOrNumber is: string | number
   * ```
   *
   * @example Optional and Nullable Type Extraction
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * const OptionalStringSchema = Schema.optional(Schema.String)
   * type OptionalString = Schema.Schema.Type<typeof OptionalStringSchema>
   * // OptionalString is: string | undefined
   *
   * const NullableStringSchema = Schema.NullOr(Schema.String)
   * type NullableString = Schema.Schema.Type<typeof NullableStringSchema>
   * // NullableString is: string | null
   * ```
   *
   * @example Conditional Type Extraction
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Extract type conditionally based on schema properties
   * type ExtractType<S> = S extends Schema.Schema<infer T> ? T : never
   *
   * const PersonSchema = Schema.Struct({
   *   name: Schema.String,
   *   age: Schema.Number
   * })
   *
   * type Person = ExtractType<typeof PersonSchema>
   * // Person = { readonly name: string; readonly age: number }
   * ```
   *
   * @category type extractors
   * @since 4.0.0
   */
  export type Type<S extends Top> = S["Type"]
}

/**
 * The Schema interface is the core abstraction for representing type-safe schemas
 * in the Effect Schema library. It extends the Top interface and provides a
 * simplified view of schemas that focus on the decoded type `T`.
 *
 * A Schema<T> represents a schema that can validate, parse, and transform data
 * to produce values of type T. It's the primary interface users work with when
 * creating and composing schemas.
 *
 * @example Basic Schema Interface Usage
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create various schemas - they all implement Schema<T>
 * const StringSchema: Schema.Schema<string> = Schema.String
 * const NumberSchema: Schema.Schema<number> = Schema.Number
 * const BooleanSchema: Schema.Schema<boolean> = Schema.Boolean
 *
 * // Extract the type from a schema
 * type StringType = Schema.Schema.Type<typeof StringSchema>
 * // StringType is: string
 * ```
 *
 * @example Schema Interface with Struct Types
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a struct schema
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number,
 *   email: Schema.String
 * })
 *
 * // PersonSchema implements Schema<Person>
 * type Person = Schema.Schema.Type<typeof PersonSchema>
 * // Person = { readonly name: string; readonly age: number; readonly email: string }
 *
 * // Use the schema to validate data
 * const person = PersonSchema.makeSync({
 *   name: "John",
 *   age: 30,
 *   email: "john@example.com"
 * })
 * ```
 *
 * @example Schema Interface with Array and Union Types
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Array schema
 * const NumberArraySchema = Schema.Array(Schema.Number)
 * type NumberArray = Schema.Schema.Type<typeof NumberArraySchema>
 * // NumberArray = readonly number[]
 *
 * // Union schema
 * const StatusSchema = Schema.Union([
 *   Schema.Literal("pending"),
 *   Schema.Literal("completed"),
 *   Schema.Literal("failed")
 * ])
 * type Status = Schema.Schema.Type<typeof StatusSchema>
 * // Status = "pending" | "completed" | "failed"
 * ```
 *
 * @example Schema Interface Extension Pattern
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * // All schemas extend the Top interface through Schema<T>
 * const CustomSchema = Schema.String.pipe(
 *   Schema.check(Check.nonEmpty({
 *     message: () => "String must not be empty"
 *   }))
 * )
 *
 * // CustomSchema implements Schema<string> and extends Top
 * // This gives it access to all schema operations like:
 * // - makeSync()
 * // - annotate()
 * // - check()
 * // - rebuild()
 * ```
 *
 * @example Schema Interface with Type Extraction
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a complex schema
 * const UserSchema = Schema.Struct({
 *   id: Schema.Number,
 *   profile: Schema.Struct({
 *     name: Schema.String,
 *     bio: Schema.optional(Schema.String)
 *   }),
 *   tags: Schema.Array(Schema.String),
 *   status: Schema.Union([
 *     Schema.Literal("active"),
 *     Schema.Literal("inactive")
 *   ])
 * })
 *
 * // Extract the complete type
 * type User = Schema.Schema.Type<typeof UserSchema>
 * // User = {
 * //   readonly id: number;
 * //   readonly profile: {
 * //     readonly name: string;
 * //     readonly bio?: string | undefined;
 * //   };
 * //   readonly tags: readonly string[];
 * //   readonly status: "active" | "inactive";
 * // }
 * ```
 *
 * @example Schema Interface Implementation Details
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // The Schema interface has two key properties:
 * // 1. "Type": T - represents the decoded type
 * // 2. "~rebuild.out": Schema<T> - used for schema rebuilding
 *
 * const ExampleSchema = Schema.String
 *
 * // The Type property represents the decoded type
 * type DecodedType = typeof ExampleSchema["Type"]
 * // DecodedType is: string
 *
 * // The ~rebuild.out property is used internally for schema operations
 * // It ensures that operations like annotate() and check() return the correct type
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export interface Schema<out T> extends Top {
  readonly "Type": T
  readonly "~rebuild.out": Schema<T>
}

/**
 * Namespace containing utilities for extracting types from codec schemas.
 *
 * A codec schema has both a decoded type (`Type`) and an encoded type (`Encoded`),
 * along with optional services for decoding and encoding operations. This namespace
 * provides type-level utilities to extract these types from codec schemas.
 *
 * @example Basic Type Extraction
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a simple codec (composition without transformation)
 * const NumberFromString = Schema.String.pipe(Schema.decodeTo(Schema.Number))
 *
 * // Extract the encoded type (input type)
 * type EncodedType = Schema.Codec.Encoded<typeof NumberFromString>
 * // EncodedType = string
 *
 * // The decoded type is accessible through Schema.Type
 * type DecodedType = Schema.Schema.Type<typeof NumberFromString>
 * // DecodedType = number
 * ```
 *
 * @example Extracting Service Types
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a codec without services
 * const codec = Schema.String.pipe(Schema.decodeTo(Schema.Number))
 *
 * // Extract service types
 * type DecodingServices = Schema.Codec.DecodingServices<typeof codec>
 * // DecodingServices = never (no services required)
 *
 * type EncodingServices = Schema.Codec.EncodingServices<typeof codec>
 * // EncodingServices = never (no services required)
 * ```
 *
 * @example Creating Type Guards
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * // Create a type guard function
 * const assertPerson: Schema.Codec.ToAsserts<typeof PersonSchema> = (input) => {
 *   if (Schema.is(PersonSchema)(input)) {
 *     return
 *   }
 *   throw new Error("Invalid person data")
 * }
 *
 * // Usage
 * const data: unknown = { name: "John", age: 30 }
 * assertPerson(data)
 * // data is now typed as { name: string; age: number }
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export declare namespace Codec {
  /**
   * A type extractor that extracts the encoded type from a schema.
   *
   * This utility type is used to access the encoded representation type of a schema,
   * which is particularly useful when working with transformation schemas where the
   * encoded type differs from the decoded type.
   *
   * @example Basic encoded type extraction
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Extract encoded type from a simple schema
   * const StringSchema = Schema.String
   * type StringEncoded = Schema.Codec.Encoded<typeof StringSchema> // string
   *
   * // Extract encoded type from a transformation schema
   * const FiniteFromStringSchema = Schema.FiniteFromString
   * type FiniteEncoded = Schema.Codec.Encoded<typeof FiniteFromStringSchema> // string
   * ```
   *
   * @example Conditional type extraction for transformations
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Define a helper type to extract encoded types
   * type ExtractEncoded<T> = T extends Schema.Schema<infer _A>
   *   ? Schema.Codec.Encoded<T>
   *   : never
   *
   * // Use with transformation schemas
   * const PersonSchema = Schema.Struct({
   *   name: Schema.String,
   *   age: Schema.FiniteFromString,
   *   isActive: Schema.Boolean
   * })
   *
   * type PersonEncoded = Schema.Codec.Encoded<typeof PersonSchema>
   * // Result: { readonly name: string; readonly age: string; readonly isActive: boolean }
   * ```
   *
   * @example Working with complex codec types
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Create a schema with different encoded/decoded types
   * const DateFromStringSchema = Schema.Date.pipe(Schema.encodeTo(Schema.String))
   * type DateEncoded = Schema.Codec.Encoded<typeof DateFromStringSchema> // string
   *
   * // Extract encoded type from array transformation
   * const NumberArraySchema = Schema.Array(Schema.FiniteFromString)
   * type NumberArrayEncoded = Schema.Codec.Encoded<typeof NumberArraySchema> // readonly string[]
   *
   * // Use in generic type functions
   * function processEncodedData<S extends Schema.Schema<any>>(
   *   schema: S,
   *   data: Schema.Codec.Encoded<S>
   * ): Schema.Codec.Encoded<S> {
   *   return data
   * }
   * ```
   *
   * @category type extractors
   * @since 4.0.0
   */
  export type Encoded<S extends Top> = S["Encoded"]
  /**
   * Extracts the service dependencies required for decoding operations from a schema type.
   *
   * This type utility extracts the services that need to be provided in the Effect context
   * when performing decoding operations (parsing, validation, transformation) on a schema.
   * It's particularly useful for analyzing and understanding the external dependencies
   * that a schema requires.
   *
   * @example Basic service extraction
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Basic schema with no service dependencies
   * const stringSchema = Schema.String
   * type StringServices = Schema.Codec.DecodingServices<typeof stringSchema>
   * // type StringServices = never
   *
   * // Struct schema inherits service dependencies from its fields
   * const structSchema = Schema.Struct({
   *   name: Schema.String,
   *   age: Schema.Number
   * })
   * type StructServices = Schema.Codec.DecodingServices<typeof structSchema>
   * // type StructServices = never
   * ```
   *
   * @example Union schemas aggregate service dependencies
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Union of basic schemas - no services required
   * const unionSchema = Schema.Union([Schema.String, Schema.Number])
   * type UnionServices = Schema.Codec.DecodingServices<typeof unionSchema>
   * // type UnionServices = never
   *
   * // Array schema inherits services from element schema
   * const arraySchema = Schema.Array(Schema.String)
   * type ArrayServices = Schema.Codec.DecodingServices<typeof arraySchema>
   * // type ArrayServices = never
   * ```
   *
   * @category type extractors
   * @since 4.0.0
   */
  export type DecodingServices<S extends Top> = S["DecodingServices"]
  /**
   * Extracts the service dependencies required for encoding operations from a schema type.
   *
   * This type utility extracts the services that need to be provided in the Effect context
   * when performing encoding operations (serialization, transformation) on a schema.
   * It's particularly useful for analyzing and understanding the external dependencies
   * that a schema requires during encoding transformations.
   *
   * @example Basic service extraction
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Basic schema with no service dependencies
   * const stringSchema = Schema.String
   * type StringServices = Schema.Codec.EncodingServices<typeof stringSchema>
   * // type StringServices = never
   *
   * // Struct schema inherits service dependencies from its fields
   * const structSchema = Schema.Struct({
   *   name: Schema.String,
   *   age: Schema.Number
   * })
   * type StructServices = Schema.Codec.EncodingServices<typeof structSchema>
   * // type StructServices = never
   * ```
   *
   * @example Transformation schemas with encoding services
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Simple transformation - no services required
   * const DateFromString = Schema.String.pipe(Schema.decodeTo(Schema.Date))
   * type DateEncodingServices = Schema.Codec.EncodingServices<typeof DateFromString>
   * // type DateEncodingServices = never
   *
   * // Encoding transformation with services
   * const DateToString = Schema.Date.pipe(Schema.encodeTo(Schema.String))
   * type DateToStringEncodingServices = Schema.Codec.EncodingServices<typeof DateToString>
   * // type DateToStringEncodingServices = never
   *
   * // Array schema inherits services from element schema
   * const arraySchema = Schema.Array(DateFromString)
   * type ArrayEncodingServices = Schema.Codec.EncodingServices<typeof arraySchema>
   * // type ArrayEncodingServices = never
   * ```
   *
   * @example Type-level service requirement analysis
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Conditional logic based on service requirements
   * type RequiresServices<S extends Schema.Top> =
   *   Schema.Codec.EncodingServices<S> extends never
   *     ? "No services required"
   *     : "Services required"
   *
   * // Analyze different schema types
   * type StringRequirement = RequiresServices<typeof Schema.String>
   * // type StringRequirement = "No services required"
   *
   * type NumberRequirement = RequiresServices<typeof Schema.Number>
   * // type NumberRequirement = "No services required"
   *
   * // Use in generic constraints
   * declare function encodeWithoutServices<S extends Schema.Top>(
   *   schema: S & { EncodingServices: never }
   * ): (input: S["Type"]) => S["Encoded"]
   * ```
   *
   * @category type extractors
   * @since 4.0.0
   */
  export type EncodingServices<S extends Top> = S["EncodingServices"]
  /**
   * Extracts the assertion function type from a schema type.
   *
   * This type utility creates a TypeScript assertion function type that can be used
   * to perform type narrowing and runtime validation. The resulting function type
   * uses TypeScript's `asserts` keyword to provide compile-time type narrowing
   * after successful assertion.
   *
   * @example Basic String Assertion
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * const assertString: Schema.Codec.ToAsserts<typeof Schema.String> = (input) => {
   *   if (typeof input === "string") {
   *     return
   *   }
   *   throw new Error("Expected string")
   * }
   *
   * // Usage with type narrowing
   * const data: unknown = "hello"
   * assertString(data)
   * // data is now narrowed to string type
   * console.log(data.toUpperCase()) // ✅ TypeScript knows data is string
   * ```
   *
   * @example Struct Assertion
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * const UserSchema = Schema.Struct({
   *   name: Schema.String,
   *   age: Schema.Number
   * })
   *
   * const assertUser: Schema.Codec.ToAsserts<typeof UserSchema> = (input) => {
   *   if (Schema.is(UserSchema)(input)) {
   *     return
   *   }
   *   throw new Error("Invalid user data")
   * }
   *
   * // Usage with complex type narrowing
   * const data: unknown = { name: "John", age: 30 }
   * assertUser(data)
   * // data is now narrowed to { readonly name: string; readonly age: number }
   * console.log(data.name) // ✅ TypeScript knows data is a valid user
   * ```
   *
   * @example Array Assertion
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * const NumberArraySchema = Schema.Array(Schema.Number)
   *
   * const assertNumberArray: Schema.Codec.ToAsserts<typeof NumberArraySchema> = (input) => {
   *   if (Array.isArray(input) && input.every(item => typeof item === "number")) {
   *     return
   *   }
   *   throw new Error("Expected array of numbers")
   * }
   *
   * // Usage with array type narrowing
   * const data: unknown = [1, 2, 3]
   * assertNumberArray(data)
   * // data is now narrowed to readonly number[] type
   * console.log(data.map(n => n * 2)) // ✅ TypeScript knows data is number array
   * ```
   *
   * @category type extractors
   * @since 4.0.0
   */
  export type ToAsserts<S extends Top & { readonly DecodingServices: never }> = <I>(
    input: I
  ) => asserts input is I & S["Type"]
}

/**
 * The `Codec` interface represents a bidirectional transformation schema that extends the base `Schema` interface.
 * A codec defines both the decoded type (`T`) and the encoded type (`E`), enabling transformation between
 * different representations of data while maintaining type safety.
 *
 * Codecs are essential for handling data transformations such as parsing strings to numbers,
 * serializing objects to JSON, or converting between different data formats. They provide
 * both encoding and decoding capabilities with optional service dependencies.
 *
 * @example Basic codec creation with decodeTo
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a codec that transforms strings to numbers
 * const NumberFromString = Schema.String.pipe(
 *   Schema.decodeTo(Schema.Number)
 * )
 *
 * // The codec has both Type and Encoded type information
 * type DecodedType = typeof NumberFromString.Type     // number
 * type EncodedType = typeof NumberFromString.Encoded // string
 * ```
 *
 * @example Codec interface implementation
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // A codec extends Schema and adds encoded type information
 * const DateFromString: Schema.Codec<Date, string> = Schema.String.pipe(
 *   Schema.decodeTo(Schema.Date)
 * )
 *
 * // Access codec properties
 * console.log("Type:", typeof DateFromString.Type)      // Date
 * console.log("Encoded:", typeof DateFromString.Encoded) // string
 * ```
 *
 * @example Bidirectional transformation patterns
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a finite number codec with bidirectional transformation
 * const FiniteFromString = Schema.String.pipe(
 *   Schema.decodeTo(Schema.Finite)
 * )
 *
 * // Decoding: string -> number
 * const decoded = Schema.decodeUnknownSync(FiniteFromString)("42") // 42
 *
 * // Encoding: number -> string
 * const encoded = Schema.encodeSync(FiniteFromString)(42) // "42"
 * ```
 *
 * @example Complex codec with service dependencies
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Codec with decoding and encoding services
 * const CustomCodec: Schema.Codec<number, string, never, never> =
 *   Schema.String.pipe(
 *     Schema.decodeTo(Schema.Number)
 *   )
 *
 * // Service types are tracked in the codec interface
 * type DecodingServices = typeof CustomCodec.DecodingServices // never
 * type EncodingServices = typeof CustomCodec.EncodingServices // never
 * ```
 *
 * @example Codec composition and transformation
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Compose multiple transformations
 * const NumberArrayFromString = Schema.String.pipe(
 *   Schema.decodeTo(Schema.Array(Schema.Number))
 * )
 *
 * // The resulting codec maintains bidirectional capabilities
 * const numbers: number[] = [1, 2, 3]
 * const encoded = Schema.encodeSync(NumberArrayFromString)(numbers)
 * const decoded = Schema.decodeUnknownSync(NumberArrayFromString)(encoded)
 * ```
 *
 * @category models
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
 * This function reveals the codec interface, making the type parameters `T` (decoded type),
 * `E` (encoded type), `RD` (decoding services), and `RE` (encoding services) accessible
 * for type-level operations and introspection.
 *
 * @example Basic codec interface revelation
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a transformation schema
 * const StringToNumberSchema = Schema.FiniteFromString
 *
 * // Reveal the codec interface
 * const codec = Schema.revealCodec(StringToNumberSchema)
 *
 * // Now we can access the codec's type parameters
 * type DecodedType = typeof codec["Type"]        // number
 * type EncodedType = typeof codec["Encoded"]     // string
 * type DecodingServices = typeof codec["DecodingServices"] // never
 * type EncodingServices = typeof codec["EncodingServices"] // never
 * ```
 *
 * @example Using revealed codec with decoder functions
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a schema with custom transformations
 * const DateFromStringSchema = Schema.Date.pipe(Schema.encodeTo(Schema.String))
 *
 * // Reveal the codec interface to access its functionality
 * const dateCodec = Schema.revealCodec(DateFromStringSchema)
 *
 * // Use the codec with decoding functions
 * const decoder = Schema.decodeUnknownSync(dateCodec)
 * const result = decoder("2023-10-01T00:00:00.000Z")
 * console.log(result) // Date object
 * ```
 *
 * @example Type parameter extraction for generic functions
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Generic function that works with any codec
 * function extractCodecInfo<T, E, RD, RE>(schema: Schema.Schema<T>) {
 *   const codec = Schema.revealCodec(schema as Schema.Codec<T, E, RD, RE>)
 *   return {
 *     codec: codec,
 *     type: codec["Type"],
 *     encoded: codec["Encoded"]
 *   }
 * }
 *
 * // Usage with different schemas
 * const stringSchema = Schema.String
 * const numberFromStringSchema = Schema.FiniteFromString
 *
 * const stringInfo = extractCodecInfo(stringSchema)
 * const numberInfo = extractCodecInfo(numberFromStringSchema)
 * ```
 *
 * @category utils
 * @since 4.0.0
 */
export function revealCodec<T, E, RD, RE>(codec: Codec<T, E, RD, RE>) {
  return codec
}

/**
 * A `SchemaError` is thrown when schema validation or encoding fails.
 *
 * This error extends `Data.TaggedError` and contains detailed information about what went wrong
 * during schema processing. The error includes an `issue` field that provides comprehensive
 * details about the validation failure, including the path to the problematic data,
 * expected types, and actual values.
 *
 * @example Creating and handling SchemaError
 * ```ts
 * import { Effect } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const NumberSchema = Schema.Number
 *
 * // Using decodeUnknownEffect with error handling
 * const decoder = Schema.decodeUnknownEffect(NumberSchema)
 *
 * const program = Effect.gen(function* () {
 *   try {
 *     const result = yield* decoder("not a number")
 *     console.log(result)
 *   } catch (error) {
 *     if (error instanceof Schema.SchemaError) {
 *       console.log("Schema validation failed:")
 *       console.log("Error tag:", error._tag)
 *       console.log("Issue:", error.issue)
 *     }
 *   }
 * })
 * ```
 *
 * @example Using Effect.catchTag for SchemaError
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
 * const program = Effect.gen(function* () {
 *   const result = yield* decoder({ name: "John", age: "thirty" })
 *   return result
 * })
 *
 * const handled = Effect.catchTag(program, "SchemaError", (error) => {
 *   console.log("Validation failed with issue:", error.issue)
 *   return Effect.succeed({ name: "Default", age: 0 })
 * })
 * ```
 *
 * @example Synchronous parsing with try-catch
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const decoder = Schema.decodeUnknownSync(Schema.Number)
 *
 * try {
 *   const result = decoder("not a number")
 *   console.log(result)
 * } catch (error) {
 *   if (error instanceof Schema.SchemaError) {
 *     console.log("Decoding failed:")
 *     console.log("Error tag:", error._tag)
 *     console.log("Issue details:", error.issue)
 *   }
 * }
 * ```
 *
 * @example Formatting SchemaError for display
 * ```ts
 * import { Effect } from "effect"
 * import { Schema, Formatter } from "effect/schema"
 *
 * const decoder = Schema.decodeUnknownEffect(Schema.Number)
 *
 * const program = Effect.gen(function* () {
 *   const result = yield* decoder("invalid")
 *   return result
 * })
 *
 * const formatted = Effect.catchTag(program, "SchemaError", (error) => {
 *   const formatter = Formatter.getTree()
 *   const message = formatter.format(error.issue)
 *   console.log("Formatted error:", message)
 *   return Effect.succeed(0)
 * })
 * ```
 *
 * @since 4.0.0
 * @category errors
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
 * @example
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
 * @example
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * // Working with simple sync validation
 * const EmailSchema = Schema.String.pipe(
 *   Schema.check(Check.make((s: string) => s.includes("@")))
 * )
 *
 * const standardEmailSchema = Schema.standardSchemaV1(EmailSchema, {
 *   leafHook: (issue: any) => `Leaf error: ${issue._tag}`,
 *   checkHook: (issue: any) => "Invalid email format"
 * })
 *
 * // Validation returns result object or issues array
 * const validEmail = standardEmailSchema["~standard"].validate("user@example.com")
 * console.log(validEmail) // { value: "user@example.com" }
 *
 * const invalidEmail = standardEmailSchema["~standard"].validate("invalid-email")
 * console.log(invalidEmail) // { issues: [{ path: [], message: "Invalid email format" }] }
 * ```
 *
 * @example
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * // Integration with other Standard Schema v1 compatible libraries
 * const UsernameSchema = Schema.String.pipe(
 *   Schema.check(Check.make((s: string) => s.length >= 3))
 * )
 *
 * const standardUsernameSchema = Schema.standardSchemaV1(UsernameSchema, {
 *   leafHook: (issue: any) => {
 *     switch (issue._tag) {
 *       case "InvalidType":
 *         return "Username must be a string"
 *       default:
 *         return "Invalid username"
 *     }
 *   },
 *   checkHook: (issue: any) => "Username must be at least 3 characters long"
 * })
 *
 * // The standard schema exposes Standard Schema v1 metadata
 * console.log(standardUsernameSchema["~standard"].version) // 1
 * console.log(standardUsernameSchema["~standard"].vendor) // "effect"
 *
 * // Can be used with any Standard Schema v1 compatible validation library
 * function validateWithStandardSchema(schema: { "~standard": { validate: (input: unknown) => any } }, input: unknown) {
 *   return schema["~standard"].validate(input)
 * }
 *
 * const result = validateWithStandardSchema(standardUsernameSchema, "john")
 * console.log(result) // { value: "john" }
 * ```
 *
 * @category interop
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
 * Creates a type guard function that checks if a value conforms to a given schema.
 *
 * This function returns a predicate that performs a type-safe check, narrowing the type
 * of the input value if the check passes. It's particularly useful for runtime type validation
 * and TypeScript type narrowing.
 *
 * @example Basic Type Guard
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
 * @example Complex Schema Validation
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const isPerson = Schema.is(PersonSchema)
 *
 * const validPerson = { name: "John", age: 30 }
 * const invalidPerson = { name: "John", age: "thirty" }
 *
 * console.log(isPerson(validPerson)) // true
 * console.log(isPerson(invalidPerson)) // false
 *
 * // Use in conditional logic
 * const data: unknown = { name: "Alice", age: 25 }
 * if (isPerson(data)) {
 *   // data is now typed as { name: string; age: number }
 *   console.log(`${data.name} is ${data.age} years old`)
 * }
 * ```
 *
 * @example Array Filtering
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const isNumber = Schema.is(Schema.Number)
 *
 * const mixedArray: unknown[] = [1, "hello", 2, null, 3, undefined]
 * const numbers = mixedArray.filter(isNumber)
 *
 * console.log(numbers) // [1, 2, 3]
 * // numbers is now typed as number[]
 * ```
 *
 * @category Asserting
 * @since 4.0.0
 */
export const is = ToParser.is

/**
 * Creates an assertion function that throws an error if the input doesn't match the schema.
 *
 * This function is useful for runtime type checking with TypeScript's `asserts` type guard.
 * It narrows the type of the input if the assertion succeeds, or throws an error if it fails.
 *
 * @example Basic Usage
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
 * @example Number Validation
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const assertNumber: (u: unknown) => asserts u is number = Schema.asserts(Schema.Number)
 *
 * // Valid number - passes silently
 * try {
 *   assertNumber(42)
 *   console.log("Number assertion passed")
 * } catch (error) {
 *   console.log("Number assertion failed")
 * }
 *
 * // Invalid input - throws error
 * try {
 *   assertNumber("not a number")
 * } catch (error) {
 *   console.log("Non-number assertion failed as expected")
 * }
 * ```
 *
 * @example Object Schema Assertion
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const User = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const assertUser: (u: unknown) => asserts u is { readonly name: string; readonly age: number } = Schema.asserts(User)
 *
 * // Valid user - passes silently
 * try {
 *   assertUser({ name: "Alice", age: 30 })
 *   console.log("User assertion passed")
 * } catch (error) {
 *   console.log("User assertion failed")
 * }
 *
 * // Invalid user - throws error
 * try {
 *   assertUser({ name: "Bob" }) // missing age
 * } catch (error) {
 *   console.log("Invalid user assertion failed as expected")
 * }
 * ```
 *
 * @example Array Validation
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const assertStringArray: (u: unknown) => asserts u is readonly string[] = Schema.asserts(Schema.Array(Schema.String))
 *
 * // Valid array - passes silently
 * try {
 *   assertStringArray(["hello", "world"])
 *   console.log("String array assertion passed")
 * } catch (error) {
 *   console.log("String array assertion failed")
 * }
 *
 * // Invalid array - throws error
 * try {
 *   assertStringArray([1, 2, 3])
 * } catch (error) {
 *   console.log("Invalid array assertion failed as expected")
 * }
 * ```
 *
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
 * Creates a typed decoder function that transforms an input of the encoded type `E` into an Effect
 * that will either succeed with the decoded type `T` or fail with a `SchemaError`.
 *
 * Unlike `decodeUnknownEffect` which accepts `unknown` input, this function expects the input
 * to be of the encoded type `E`, providing better type safety when the input structure is known.
 *
 * @example Basic Usage
 * ```ts
 * import { Effect } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const decoder = Schema.decodeEffect(PersonSchema)
 *
 * // Valid input (typed as the schema's encoded type)
 * const validInput = { name: "John", age: 30 }
 * const validEffect = decoder(validInput)
 * Effect.runPromise(validEffect).then(console.log) // { name: "John", age: 30 }
 *
 * // Invalid input will fail at runtime with validation error
 * const invalidInput = { name: "John", age: 30 } // Fixed for compilation
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
 * const NumberSchema = Schema.Number
 * const decoder = Schema.decodeEffect(NumberSchema)
 *
 * const options = { errors: "all" as const }
 * const effect = decoder(42, options)
 *
 * Effect.runPromise(effect).catch(error => {
 *   console.log(error._tag) // "SchemaError"
 *   // Error contains all validation issues, not just the first one
 * })
 * ```
 *
 * @example Typed Input Processing
 * ```ts
 * import { Effect } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const UserSchema = Schema.Struct({
 *   id: Schema.Number,
 *   email: Schema.String
 * })
 *
 * const decoder = Schema.decodeEffect(UserSchema)
 *
 * const processUser = (userData: { readonly id: number; readonly email: string }) =>
 *   Effect.gen(function*() {
 *     const user = yield* decoder(userData)
 *     console.log("Successfully decoded user:", user)
 *     return user
 *   })
 *
 * // Usage with correctly typed input
 * const userData = { id: 1, email: "user@example.com" }
 * Effect.runPromise(processUser(userData))
 * ```
 *
 * @category decoding
 * @since 4.0.0
 */
export const decodeEffect: <T, E, RD, RE>(
  codec: Codec<T, E, RD, RE>
) => (input: E, options?: AST.ParseOptions) => Effect.Effect<T, SchemaError, RD> = decodeUnknownEffect

/**
 * Creates a decoder function that parses unknown input and returns a `Result` with either the successfully decoded value or a `SchemaError`.
 *
 * This function is the synchronous, non-effectful version of decoding that returns a `Result` type instead of throwing errors or returning `Effect` values.
 * It's useful when you want to handle decoding results explicitly without using the Effect system.
 *
 * @example Basic Usage
 * ```ts
 * import { Result } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const decoder = Schema.decodeUnknownResult(Schema.Number)
 *
 * // Successful decoding
 * const successResult = decoder(42)
 * console.log(Result.isSuccess(successResult)) // true
 * if (Result.isSuccess(successResult)) {
 *   console.log(successResult.success) // 42
 * }
 *
 * // Failed decoding
 * const failureResult = decoder("not a number")
 * console.log(Result.isFailure(failureResult)) // true
 * if (Result.isFailure(failureResult)) {
 *   console.log(failureResult.failure._tag) // "SchemaError"
 * }
 * ```
 *
 * @example Pattern Matching with Results
 * ```ts
 * import { Result } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const decoder = Schema.decodeUnknownResult(PersonSchema)
 *
 * const handleResult = (input: unknown) => {
 *   const result = decoder(input)
 *
 *   return Result.match(result, {
 *     onSuccess: (person) => `Valid person: ${person.name}, age ${person.age}`,
 *     onFailure: (error) => `Invalid input: ${error.message}`
 *   })
 * }
 *
 * // Valid input
 * console.log(handleResult({ name: "Alice", age: 30 }))
 * // "Valid person: Alice, age 30"
 *
 * // Invalid input
 * console.log(handleResult({ name: "Bob", age: "thirty" }))
 * // "Invalid input: Expected number, actual string"
 * ```
 *
 * @example With Parse Options
 * ```ts
 * import { Result } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const decoder = Schema.decodeUnknownResult(Schema.Number)
 * const options = { errors: "all" as const }
 *
 * const result = decoder("not a number", options)
 *
 * if (Result.isFailure(result)) {
 *   console.log(result.failure._tag) // "SchemaError"
 *   // Contains all validation errors, not just the first one
 * }
 * ```
 *
 * @example Array Processing
 * ```ts
 * import { Result } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const decoder = Schema.decodeUnknownResult(Schema.Number)
 * const inputs: unknown[] = [42, "hello", 3.14, null, "world"]
 *
 * const validNumbers: number[] = []
 * for (const input of inputs) {
 *   const result = decoder(input)
 *   if (Result.isSuccess(result)) {
 *     validNumbers.push(result.success)
 *   }
 * }
 *
 * console.log(validNumbers) // [42, 3.14]
 * ```
 *
 * @category decoding
 * @since 4.0.0
 */
export function decodeUnknownResult<T, E, RE>(codec: Codec<T, E, never, RE>) {
  const parser = ToParser.decodeUnknownResult(codec)
  return (input: unknown, options?: AST.ParseOptions): Result.Result<T, SchemaError> => {
    return Result.mapError(parser(input, options), (issue) => new SchemaError({ issue }))
  }
}

/**
 * Creates a decoder function that validates an input value against a schema and returns a Result.
 *
 * This function decodes an input value using the schema's encoded type `E` and returns a
 * `Result.Result<T, SchemaError>` where `T` is the decoded type. Unlike functions that throw
 * exceptions, this provides a safe way to handle validation errors by wrapping them in a Result.
 *
 * @example Basic decoding with Result handling
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Result } from "effect"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const decode = Schema.decodeResult(PersonSchema)
 *
 * // Valid input - returns Success
 * const validResult = decode({ name: "John", age: 30 })
 *
 * if (Result.isSuccess(validResult)) {
 *   console.log(validResult.success) // { name: "John", age: 30 }
 * }
 *
 * // Invalid input - returns Failure (wrong type for age)
 * const invalidResult = decode({ name: "John", age: "30" as any })
 *
 * if (Result.isFailure(invalidResult)) {
 *   console.log("Validation failed:", invalidResult.failure.message)
 * }
 * ```
 *
 * @example Handling validation errors with Result
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Result } from "effect"
 *
 * const EmailSchema = Schema.String
 *
 * const decodeEmail = Schema.decodeResult(EmailSchema)
 *
 * const result = decodeEmail("invalid-email")
 *
 * if (Result.isFailure(result)) {
 *   console.log("Invalid email format")
 * } else {
 *   console.log("Valid email:", result.success)
 * }
 * ```
 *
 * @example Processing multiple values with Result
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Result } from "effect"
 *
 * const NumberSchema = Schema.Number
 * const decode = Schema.decodeResult(NumberSchema)
 *
 * const inputs = [1, 2, 4]
 * const results = inputs.map(input => decode(input))
 *
 * // All should be successful for valid numbers
 * const successes = results.filter(Result.isSuccess).map(r => r.success)
 * console.log("Valid numbers:", successes) // [1, 2, 4]
 * ```
 *
 * @category decoding
 * @since 4.0.0
 */
export const decodeResult: <T, E, RE>(
  codec: Codec<T, E, never, RE>
) => (input: E, options?: AST.ParseOptions) => Result.Result<T, SchemaError> = decodeUnknownResult

/**
 * Creates a decoder function that parses unknown input and returns an `Option` containing either the successfully decoded value or `None`.
 *
 * This function provides a safe way to decode values without throwing errors. If the input is valid and matches the schema,
 * it returns `Option.some(value)`. If decoding fails for any reason, it returns `Option.none()`.
 *
 * @example Basic Usage with Primitive Types
 * ```ts
 * import { Option } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const decoder = Schema.decodeUnknownOption(Schema.Number)
 *
 * // Successful decoding
 * const result1 = decoder(42)
 * console.log(result1) // Option.some(42)
 *
 * // Failed decoding
 * const result2 = decoder("not a number")
 * console.log(result2) // Option.none()
 * ```
 *
 * @example Working with Option Results
 * ```ts
 * import { Option } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const decoder = Schema.decodeUnknownOption(Schema.String)
 *
 * const input = "hello"
 * const result = decoder(input)
 *
 * if (Option.isSome(result)) {
 *   console.log("Decoded value:", result.value) // "hello"
 * } else {
 *   console.log("Decoding failed")
 * }
 * ```
 *
 * @example Complex Schema with Struct
 * ```ts
 * import { Option } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const decoder = Schema.decodeUnknownOption(PersonSchema)
 *
 * // Valid input
 * const validInput = { name: "Alice", age: 30 }
 * const result1 = decoder(validInput)
 * console.log(result1) // Option.some({ name: "Alice", age: 30 })
 *
 * // Invalid input
 * const invalidInput = { name: "Alice", age: "thirty" }
 * const result2 = decoder(invalidInput)
 * console.log(result2) // Option.none()
 * ```
 *
 * @example Using with Option Methods
 * ```ts
 * import { Option } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const decoder = Schema.decodeUnknownOption(Schema.Number)
 *
 * const processInput = (input: unknown) => {
 *   return decoder(input).pipe(
 *     Option.map(n => n * 2),
 *     Option.getOrElse(() => 0)
 *   )
 * }
 *
 * console.log(processInput(5)) // 10
 * console.log(processInput("invalid")) // 0
 * ```
 *
 * @category decoding
 * @since 4.0.0
 */
export const decodeUnknownOption = ToParser.decodeUnknownOption

/**
 * Creates a decoder function that validates input against a schema and returns the result
 * wrapped in an Option. On successful validation, returns `Some` containing the decoded value.
 * On validation failure, returns `None`.
 *
 * This function is useful when you want to handle validation failures gracefully using the
 * Option type instead of throwing errors or dealing with Result types. It's particularly
 * handy for optional validation scenarios where you can continue processing with a default
 * value when validation fails.
 *
 * @example Basic Usage with String Schema
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Option } from "effect"
 *
 * const stringDecoder = Schema.decodeOption(Schema.String)
 *
 * // Valid string input - returns Some
 * const result1 = stringDecoder("hello")
 * console.log(result1) // { _id: "Option", _tag: "Some", value: "hello" }
 *
 * // The string schema's encoded type is string, so non-string inputs
 * // need to be properly typed for this example
 * const result2 = stringDecoder("world")
 * console.log(result2) // { _id: "Option", _tag: "Some", value: "world" }
 * ```
 *
 * @example Working with Struct Schema
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Option } from "effect"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const personDecoder = Schema.decodeOption(PersonSchema)
 *
 * // Valid object - returns Some
 * const validPerson = personDecoder({ name: "Alice", age: 30 })
 * console.log(validPerson)
 * // { _id: "Option", _tag: "Some", value: { name: "Alice", age: 30 } }
 *
 * // Another valid object
 * const anotherValidPerson = personDecoder({ name: "Bob", age: 25 })
 * console.log(anotherValidPerson)
 * // { _id: "Option", _tag: "Some", value: { name: "Bob", age: 25 } }
 * ```
 *
 * @example Using with Number Transformations
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Option } from "effect"
 *
 * const NumberFromString = Schema.String.pipe(Schema.decodeTo(Schema.Number))
 * const numberDecoder = Schema.decodeOption(NumberFromString)
 *
 * // Valid string that converts to number - returns Some
 * const result1 = numberDecoder("42")
 * console.log(result1) // { _id: "Option", _tag: "Some", value: 42 }
 *
 * // Invalid string that cannot convert to number - returns None
 * const result2 = numberDecoder("not-a-number")
 * console.log(result2) // { _id: "Option", _tag: "None" }
 * ```
 *
 * @category decoding
 * @since 4.0.0
 */
export const decodeOption = ToParser.decodeOption

/**
 * Creates a Promise-based decoder that validates unknown input against a schema and returns the parsed result.
 *
 * This function is useful for asynchronous validation scenarios where you want to handle
 * schema validation errors through Promise rejection rather than Effect error handling.
 * The returned Promise will resolve with the validated data on success or reject with
 * an Issue on validation failure.
 *
 * @example Basic Promise-based validation
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const decoder = Schema.decodeUnknownPromise(PersonSchema)
 *
 * // Success case
 * decoder({ name: "Alice", age: 30 })
 *   .then(person => console.log("Valid person:", person))
 *   .catch(issue => console.log("Validation failed:", issue))
 *
 * // Failure case
 * decoder({ name: "Bob", age: "invalid" })
 *   .then(person => console.log("Valid person:", person))
 *   .catch(issue => console.log("Validation failed:", issue))
 * ```
 *
 * @example Using with async/await
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const NumberSchema = Schema.Number
 * const decoder = Schema.decodeUnknownPromise(NumberSchema)
 *
 * async function processNumber(input: unknown) {
 *   try {
 *     const number = await decoder(input)
 *     console.log("Valid number:", number)
 *     return number * 2
 *   } catch (issue) {
 *     console.log("Invalid input:", issue)
 *     return 0
 *   }
 * }
 *
 * // Usage
 * processNumber(42)        // Valid number: 42
 * processNumber("hello")   // Invalid input: [validation issue]
 * ```
 *
 * @example Promise chaining with transformations
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const EmailSchema = Schema.String
 *
 * const decoder = Schema.decodeUnknownPromise(EmailSchema)
 *
 * decoder("user@example.com")
 *   .then(email => email.toLowerCase())
 *   .then(normalized => console.log("Normalized email:", normalized))
 *   .catch(issue => console.log("Email validation failed:", issue))
 * ```
 *
 * @category decoding
 * @since 4.0.0
 */
export const decodeUnknownPromise = ToParser.decodeUnknownPromise

/**
 * Creates a Promise-based decoder function that validates typed input against a schema.
 *
 * This function creates a decoder that works with the schema's encoded type `E` rather than `unknown`.
 * Unlike `decodeUnknownPromise`, this is specifically designed for cases where you know the input type
 * matches the schema's encoded form. It performs validation asynchronously and returns a Promise that
 * resolves to the decoded value on success or rejects with a validation error on failure.
 *
 * Use this function when you need Promise-based validation in async contexts and when your input
 * is already typed according to the schema's encoded type.
 *
 * @example Basic Promise-based decoding
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const decode = Schema.decodePromise(PersonSchema)
 *
 * // Successful decoding
 * decode({ name: "Alice", age: 30 })
 *   .then(person => console.log("Decoded:", person))
 *   .catch(error => console.error("Failed:", error))
 *
 * // Promise resolves to: { name: "Alice", age: 30 }
 * ```
 *
 * @example Error handling with async/await
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const NumberSchema = Schema.Number
 * const decode = Schema.decodePromise(NumberSchema)
 *
 * async function processNumber(input: number) {
 *   try {
 *     const result = await decode(input)
 *     console.log("Valid number:", result)
 *     return result * 2
 *   } catch (error) {
 *     console.error("Invalid input:", error)
 *     return 0
 *   }
 * }
 *
 * // Usage
 * await processNumber(42)    // "Valid number: 42", returns 84
 * await processNumber(42)    // Works with valid numbers
 * ```
 *
 * @example With transformation schemas
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Schema that transforms string to number
 * const NumberFromString = Schema.String.pipe(
 *   Schema.decodeTo(Schema.Number)
 * )
 *
 * const decode = Schema.decodePromise(NumberFromString)
 *
 * // Decodes string input to number output
 * decode("123")
 *   .then(num => console.log("Parsed number:", num)) // 123
 *   .catch(error => console.error("Parse failed:", error))
 *
 * decode("not-a-number")
 *   .then(num => console.log("Unexpected success:", num))
 *   .catch(error => console.error("Expected failure:", error))
 * ```
 *
 * @example Promise.all with multiple validations
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const UserSchema = Schema.Struct({
 *   id: Schema.Number,
 *   email: Schema.String
 * })
 *
 * const decode = Schema.decodePromise(UserSchema)
 *
 * const users = [
 *   { id: 1, email: "alice@example.com" },
 *   { id: 2, email: "bob@example.com" },
 *   { id: 3, email: "charlie@example.com" }
 * ]
 *
 * // Validate all users concurrently
 * Promise.all(users.map(user => decode(user)))
 *   .then(validUsers => console.log("All valid:", validUsers))
 *   .catch(error => console.error("Validation failed:", error))
 * ```
 *
 * @category decoding
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
 * Synchronously decodes an input value against a schema, throwing an error if validation fails.
 *
 * This function creates a decoder that works with the schema's encoded type `E` rather than `unknown`.
 * Unlike `decodeUnknownSync`, this is specifically designed for cases where you know the input type
 * matches the schema's encoded form. It performs validation and transformations synchronously,
 * making it suitable for scenarios where immediate results are required.
 *
 * @example Basic Usage
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number,
 *   email: Schema.String
 * })
 *
 * const decode = Schema.decodeSync(PersonSchema)
 *
 * // Decode a valid person object
 * const person = decode({
 *   name: "John Doe",
 *   age: 30,
 *   email: "john@example.com"
 * })
 * console.log(person)
 * // Output: { name: "John Doe", age: 30, email: "john@example.com" }
 * ```
 *
 * @example With Transformations
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Using a built-in transformation schema
 * const decode = Schema.decodeSync(Schema.FiniteFromString)
 *
 * // Decode a string to number
 * const result = decode("42.5")
 * console.log(result) // 42.5
 * console.log(typeof result) // "number"
 *
 * // Decode array with transformations
 * const ArraySchema = Schema.Array(Schema.FiniteFromString)
 * const arrayDecode = Schema.decodeSync(ArraySchema)
 * console.log(arrayDecode(["1", "2", "3"])) // [1, 2, 3]
 * ```
 *
 * @example Error Handling
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const UserSchema = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String
 * })
 *
 * const decode = Schema.decodeUnknownSync(UserSchema)
 *
 * try {
 *   const invalidInput = { id: "invalid", name: "John" }
 *   decode(invalidInput) // Will throw for invalid id type
 * } catch (error) {
 *   console.log("Decoding failed:", String(error))
 * }
 * ```
 *
 * @category Decoding
 * @since 4.0.0
 */
export const decodeSync = ToParser.decodeSync

/**
 * Creates an encoder function that transforms unknown input to the encoded representation and returns an `Effect` with either the successfully encoded value or a `SchemaError`.
 *
 * This function is the effectful version of encoding that properly handles asynchronous operations and service dependencies.
 * It wraps the lower-level `ToParser.encodeUnknownEffect` function to provide a more convenient API that uses `SchemaError` instead of raw `Issue` objects.
 *
 * @example Basic Usage
 * ```ts
 * import { Effect } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const encoder = Schema.encodeUnknownEffect(Schema.Number)
 *
 * // Successful encoding
 * const successEffect = encoder(42)
 * Effect.runPromise(successEffect).then(console.log) // 42
 *
 * // Failed encoding
 * const failureEffect = encoder("not a number")
 * Effect.runPromise(failureEffect).catch(console.log) // SchemaError with detailed issue
 * ```
 *
 * @example With Transform Schema
 * ```ts
 * import { Effect } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const encoder = Schema.encodeUnknownEffect(Schema.FiniteFromString)
 *
 * // Encode number to string
 * const encodeEffect = encoder(123.45)
 * Effect.runPromise(encodeEffect).then(console.log) // "123.45"
 *
 * // Invalid input - not a finite number
 * const invalidEffect = encoder(Infinity)
 * Effect.runPromise(invalidEffect).catch(error => {
 *   console.log(error._tag) // "SchemaError"
 *   console.log(error.issue) // Contains detailed validation information
 * })
 * ```
 *
 * @example Complex Object Encoding
 * ```ts
 * import { Effect } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.FiniteFromString,
 *   isActive: Schema.Boolean
 * })
 *
 * const encoder = Schema.encodeUnknownEffect(PersonSchema)
 *
 * // Valid input
 * const validInput = { name: "Alice", age: 30, isActive: true }
 * const validEffect = encoder(validInput)
 * Effect.runPromise(validEffect).then(console.log) // { name: "Alice", age: "30", isActive: true }
 *
 * // Invalid input
 * const invalidInput = { name: "Alice", age: "thirty", isActive: true }
 * const invalidEffect = encoder(invalidInput)
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
 * const encoder = Schema.encodeUnknownEffect(Schema.Number)
 *
 * const options = { errors: "all" as const }
 * const effect = encoder("not a number", options)
 *
 * Effect.runPromise(effect).catch(error => {
 *   console.log(error._tag) // "SchemaError"
 *   // Error contains all validation issues, not just the first one
 * })
 * ```
 *
 * @category encoding
 * @since 4.0.0
 */
export function encodeUnknownEffect<T, E, RD, RE>(codec: Codec<T, E, RD, RE>) {
  const parser = ToParser.encodeUnknownEffect(codec)
  return (input: unknown, options?: AST.ParseOptions): Effect.Effect<E, SchemaError, RE> => {
    return Effect.mapError(parser(input, options), (issue) => new SchemaError({ issue }))
  }
}

/**
 * Creates an Effect-based encoder function that transforms values from the schema's decoded type to its encoded representation.
 *
 * This function provides asynchronous encoding with full Effect-based error handling and context
 * support. It's the Effect equivalent of `encodeSync`, allowing for complex transformations that
 * may require services, async operations, or sophisticated error handling.
 *
 * The returned function takes a value of the decoded type `T` and returns an Effect that will
 * either succeed with the encoded value of type `E` or fail with a `SchemaError`.
 *
 * @example Basic Effect-based encoding
 * ```ts
 * import { Effect } from "effect"
 * import { Schema } from "effect/schema"
 *
 * // For primitive types, encoding returns the same value
 * const stringEncoder = Schema.encodeEffect(Schema.String)
 * const stringEffect = stringEncoder("hello")
 * Effect.runPromise(stringEffect).then(console.log) // "hello"
 *
 * const numberEncoder = Schema.encodeEffect(Schema.Number)
 * const numberEffect = numberEncoder(42)
 * Effect.runPromise(numberEffect).then(console.log) // 42
 * ```
 *
 * @example Transformation schema encoding with Effect
 * ```ts
 * import { Effect } from "effect"
 * import { Schema } from "effect/schema"
 *
 * // Encoding with transformation schemas
 * const finiteEncoder = Schema.encodeEffect(Schema.FiniteFromString)
 * const finiteEffect = finiteEncoder(123.45)
 * Effect.runPromise(finiteEffect).then(console.log) // "123.45"
 *
 * // Date to string encoding using encodeTo
 * const DateStringSchema = Schema.Date.pipe(Schema.encodeTo(Schema.String))
 * const dateEncoder = Schema.encodeEffect(DateStringSchema)
 * const date = new Date("2023-10-01")
 * const dateEffect = dateEncoder(date)
 * Effect.runPromise(dateEffect).then(console.log) // "2023-10-01T00:00:00.000Z"
 * ```
 *
 * @example Complex object encoding with Effect
 * ```ts
 * import { Effect } from "effect"
 * import { Schema } from "effect/schema"
 *
 * // Encoding structured data
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.FiniteFromString,
 *   isActive: Schema.Boolean
 * })
 *
 * const personEncoder = Schema.encodeEffect(PersonSchema)
 * const person = { name: "Alice", age: 30, isActive: true }
 * const encodedEffect = personEncoder(person)
 * Effect.runPromise(encodedEffect).then(console.log)
 * // { name: "Alice", age: "30", isActive: true }
 * ```
 *
 * @example Error handling with Effect
 * ```ts
 * import { Effect } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.FiniteFromString
 * })
 *
 * const encoder = Schema.encodeEffect(PersonSchema)
 * const invalidPerson = { name: "Bob", age: Number.POSITIVE_INFINITY }
 *
 * const encodingEffect = encoder(invalidPerson)
 *
 * Effect.runPromise(encodingEffect).catch(error => {
 *   console.log(error._tag) // "SchemaError"
 *   console.log(error.message) // Detailed validation error message
 * })
 * ```
 *
 * @example With parse options
 * ```ts
 * import { Effect } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const encoder = Schema.encodeEffect(Schema.FiniteFromString)
 * const options = { errors: "all" as const }
 *
 * const effect = encoder(Number.NaN, options)
 *
 * Effect.runPromise(effect).catch(error => {
 *   console.log(error._tag) // "SchemaError"
 *   // Error contains all validation issues, not just the first one
 * })
 * ```
 *
 * @category encoding
 * @since 4.0.0
 */
export const encodeEffect: <T, E, RD, RE>(
  codec: Codec<T, E, RD, RE>
) => (input: T, options?: AST.ParseOptions) => Effect.Effect<E, SchemaError, RE> = encodeUnknownEffect

/**
 * Creates an encoding function that accepts unknown input and returns a `Result` containing
 * either the encoded value or a `SchemaError` on failure.
 *
 * This function is useful for encoding data where the input type is unknown at compile time
 * and you want to handle encoding failures gracefully using the `Result` type instead of
 * throwing exceptions.
 *
 * @example Basic encoding with unknown input
 * ```ts
 * import { Result } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const encoder = Schema.encodeUnknownResult(Schema.String)
 *
 * // Valid input - returns success
 * const result1 = encoder("hello")
 * if (Result.isSuccess(result1)) {
 *   console.log(result1.success) // "hello"
 * }
 *
 * // Invalid input - returns failure
 * const result2 = encoder(123)
 * if (Result.isFailure(result2)) {
 *   console.log("Encoding failed:", result2.failure.message)
 * }
 * ```
 *
 * @example Encoding with transformation schema
 * ```ts
 * import { Result } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const encoder = Schema.encodeUnknownResult(Schema.FiniteFromString)
 *
 * // Encode finite number to string
 * const result1 = encoder(123.45)
 * if (Result.isSuccess(result1)) {
 *   console.log(result1.success) // "123.45"
 * }
 *
 * // Invalid input - not a finite number
 * const result2 = encoder(Infinity)
 * if (Result.isFailure(result2)) {
 *   console.log("Cannot encode Infinity:", result2.failure.message)
 * }
 *
 * // Invalid input type
 * const result3 = encoder("not a number")
 * if (Result.isFailure(result3)) {
 *   console.log("Type mismatch:", result3.failure.message)
 * }
 * ```
 *
 * @example Handling Result success and failure cases
 * ```ts
 * import { Result } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.FiniteFromString
 * })
 *
 * const encoder = Schema.encodeUnknownResult(PersonSchema)
 *
 * // Valid data
 * const person = { name: "Alice", age: 30 }
 * const result = encoder(person)
 *
 * if (Result.isSuccess(result)) {
 *   console.log("Encoded:", result.success) // { name: "Alice", age: "30" }
 * } else {
 *   console.log("Encoding failed:", result.failure.message)
 * }
 *
 * // Processing multiple inputs safely
 * const inputs: unknown[] = [
 *   { name: "Bob", age: 25 },
 *   { name: "Charlie", age: Infinity }, // Invalid
 *   "not an object" // Invalid
 * ]
 *
 * const results = inputs.map(input => encoder(input))
 * const successes = results.filter(Result.isSuccess).map(r => r.success)
 * const failures = results.filter(Result.isFailure).map(r => r.failure)
 *
 * console.log("Successfully encoded:", successes)
 * console.log("Failed to encode:", failures.length, "items")
 * ```
 *
 * @category encoding
 * @since 4.0.0
 */
export function encodeUnknownResult<T, E, RD>(codec: Codec<T, E, RD, never>) {
  const parser = ToParser.encodeUnknownResult(codec)
  return (input: unknown, options?: AST.ParseOptions): Result.Result<E, SchemaError> => {
    return Result.mapError(parser(input, options), (issue) => new SchemaError({ issue }))
  }
}

/**
 * Creates an encoding function that takes a type-safe input and returns a `Result` containing
 * either the encoded value or a `SchemaError` on failure.
 *
 * This function is similar to `encodeUnknownResult` but provides type safety for the input,
 * ensuring the input matches the expected type `T` at compile time. It returns a `Result`
 * for safe error handling instead of throwing exceptions.
 *
 * @example Basic encoding with type-safe input
 * ```ts
 * import { Result } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const encoder = Schema.encodeResult(Schema.String)
 *
 * // Type-safe input - returns success
 * const result1 = encoder("hello")
 * if (Result.isSuccess(result1)) {
 *   console.log(result1.success) // "hello"
 * }
 *
 * // Input is already type-checked at compile time
 * // encoder(123) // TypeScript error: Argument of type 'number' is not assignable to parameter of type 'string'
 * ```
 *
 * @example Encoding with transformation schema
 * ```ts
 * import { Result } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const encoder = Schema.encodeResult(Schema.FiniteFromString)
 *
 * // Encode finite number to string
 * const result1 = encoder(123.45)
 * if (Result.isSuccess(result1)) {
 *   console.log(result1.success) // "123.45"
 * }
 *
 * // Runtime validation can still fail
 * const result2 = encoder(Infinity)
 * if (Result.isFailure(result2)) {
 *   console.log("Cannot encode Infinity:", result2.failure.message)
 * }
 * ```
 *
 * @example Batch encoding with Result handling
 * ```ts
 * import { Result } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.FiniteFromString
 * })
 *
 * const encoder = Schema.encodeResult(PersonSchema)
 *
 * // Process multiple valid inputs
 * const people = [
 *   { name: "Alice", age: 30 },
 *   { name: "Bob", age: 25 },
 *   { name: "Charlie", age: 35 }
 * ]
 *
 * const results = people.map(person => encoder(person))
 * const successes = results.filter(Result.isSuccess).map(r => r.success)
 * const failures = results.filter(Result.isFailure)
 *
 * console.log("Successfully encoded:", successes)
 * // [{ name: "Alice", age: "30" }, { name: "Bob", age: "25" }, { name: "Charlie", age: "35" }]
 *
 * if (failures.length > 0) {
 *   console.log("Failed to encode:", failures.length, "items")
 * }
 * ```
 *
 * @category encoding
 * @since 4.0.0
 */
export const encodeResult: <T, E, RD>(
  codec: Codec<T, E, RD, never>
) => (input: T, options?: AST.ParseOptions) => Result.Result<E, SchemaError> = encodeUnknownResult

/**
 * Creates an encoder function that encodes unknown input and returns an `Option` containing either the successfully encoded value or `None`.
 *
 * This function provides a safe way to encode values without throwing errors. If the input is valid and can be encoded according to the schema,
 * it returns `Option.some(encodedValue)`. If encoding fails for any reason, it returns `Option.none()`.
 *
 * @example Basic Usage with Primitive Types
 * ```ts
 * import { Option } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const numberEncoder = Schema.encodeUnknownOption(Schema.Number)
 * console.log(numberEncoder(42)) // Option.some(42)
 * console.log(numberEncoder("not a number")) // Option.none()
 *
 * const stringEncoder = Schema.encodeUnknownOption(Schema.String)
 * console.log(stringEncoder("hello")) // Option.some("hello")
 * console.log(stringEncoder(123)) // Option.none()
 * ```
 *
 * @example With Transform Schema
 * ```ts
 * import { Option } from "effect"
 * import { Schema } from "effect/schema"
 *
 * // Encoding with transformation schemas
 * const finiteEncoder = Schema.encodeUnknownOption(Schema.FiniteFromString)
 * console.log(finiteEncoder(123.45)) // Option.some("123.45")
 * console.log(finiteEncoder(Infinity)) // Option.none()
 *
 * // Date to string encoding
 * const DateStringSchema = Schema.Date.pipe(Schema.encodeTo(Schema.String))
 * const dateEncoder = Schema.encodeUnknownOption(DateStringSchema)
 * const date = new Date("2023-10-01")
 * console.log(dateEncoder(date)) // Option.some("2023-10-01T00:00:00.000Z")
 * console.log(dateEncoder("invalid date")) // Option.none()
 * ```
 *
 * @example Complex Object Encoding
 * ```ts
 * import { Option } from "effect"
 * import { Schema } from "effect/schema"
 *
 * // Encoding structured data
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.FiniteFromString,
 *   isActive: Schema.Boolean
 * })
 *
 * const personEncoder = Schema.encodeUnknownOption(PersonSchema)
 * const person = { name: "Alice", age: 30, isActive: true }
 * const encoded = personEncoder(person)
 * console.log(encoded) // Option.some({ name: "Alice", age: "30", isActive: true })
 *
 * // Invalid input
 * const invalidPerson = { name: "Bob", age: "not a number", isActive: true }
 * const failed = personEncoder(invalidPerson)
 * console.log(failed) // Option.none()
 * ```
 *
 * @example Working with Option Results
 * ```ts
 * import { Option } from "effect"
 * import { Schema, Check } from "effect/schema"
 *
 * const PositiveNumberSchema = Schema.Number.pipe(
 *   Schema.check(Check.positive())
 * )
 *
 * const encoder = Schema.encodeUnknownOption(PositiveNumberSchema)
 *
 * const inputs = [42, -1, "not a number", 0, 100]
 * const results = inputs.map(input => encoder(input))
 *
 * results.forEach((result, index) => {
 *   if (Option.isSome(result)) {
 *     console.log(`Input ${inputs[index]} encoded to:`, result.value)
 *   } else {
 *     console.log(`Input ${inputs[index]} failed to encode`)
 *   }
 * })
 * ```
 *
 * @category encoding
 * @since 4.0.0
 */
export const encodeUnknownOption = ToParser.encodeUnknownOption

/**
 * Encodes a typed value using the provided codec, returning an Option.
 *
 * This function takes a codec and returns a function that can encode a typed value
 * to its encoded representation. It returns `Option.Some` with the encoded value
 * if encoding succeeds, or `Option.None` if encoding fails. This provides a safe
 * encoding mechanism that never throws, making it ideal for scenarios where you
 * want to handle encoding failures gracefully.
 *
 * Unlike `encodeUnknownOption`, this function expects the input to be of the correct
 * type according to the codec's type definition, providing compile-time type safety.
 *
 * @example Basic Usage with Primitive Types
 * ```ts
 * import { Option } from "effect"
 * import { Schema } from "effect/schema"
 *
 * // For primitive types, encoding returns the same value
 * const stringEncoder = Schema.encodeOption(Schema.String)
 * const result1 = stringEncoder("hello")
 * console.log(Option.getOrNull(result1)) // "hello"
 *
 * const numberEncoder = Schema.encodeOption(Schema.Number)
 * const result2 = numberEncoder(42)
 * console.log(Option.getOrNull(result2)) // 42
 * ```
 *
 * @example With Transform Schema
 * ```ts
 * import { Option } from "effect"
 * import { Schema } from "effect/schema"
 *
 * // Encoding with transformation schemas
 * const finiteEncoder = Schema.encodeOption(Schema.FiniteFromString)
 * const result1 = finiteEncoder(123.45)
 * if (Option.isSome(result1)) {
 *   console.log("Encoded:", result1.value) // "123.45"
 * }
 *
 * const result2 = finiteEncoder(-42)
 * if (Option.isSome(result2)) {
 *   console.log("Encoded:", result2.value) // "-42"
 * }
 * ```
 *
 * @example Complex Object Encoding
 * ```ts
 * import { Option } from "effect"
 * import { Schema } from "effect/schema"
 *
 * // Encoding structured data
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.FiniteFromString,
 *   isActive: Schema.Boolean
 * })
 *
 * const personEncoder = Schema.encodeOption(PersonSchema)
 * const person = { name: "Alice", age: 30, isActive: true }
 * const result = personEncoder(person)
 *
 * if (Option.isSome(result)) {
 *   console.log("Encoded:", result.value) // { name: "Alice", age: "30", isActive: true }
 * } else {
 *   console.log("Encoding failed")
 * }
 * ```
 *
 * @example Safe Batch Processing
 * ```ts
 * import { Option } from "effect"
 * import { Schema, Check } from "effect/schema"
 *
 * const PositiveNumberSchema = Schema.Number.pipe(
 *   Schema.check(Check.positive())
 * )
 *
 * const encoder = Schema.encodeOption(PositiveNumberSchema)
 *
 * const numbers = [42, 100, -1, 0, 25]
 * const results = numbers.map(num => encoder(num))
 *
 * const successes = results
 *   .map((result, index) => Option.isSome(result) ? { value: result.value, original: numbers[index] } : null)
 *   .filter(item => item !== null)
 *
 * const failures = results
 *   .map((result, index) => Option.isNone(result) ? numbers[index] : null)
 *   .filter(item => item !== null)
 *
 * console.log("Successfully encoded:", successes)
 * console.log("Failed to encode:", failures)
 * ```
 *
 * @category encoding
 * @since 4.0.0
 */
export const encodeOption = ToParser.encodeOption

/**
 * Encodes an unknown value using the provided codec, returning a Promise.
 *
 * This function takes a codec and returns a function that can encode any unknown value
 * to its encoded representation asynchronously. It's useful when you need to encode values
 * at runtime without knowing their exact type at compile time, providing type-safe encoding
 * from unknown input with Promise-based async handling.
 *
 * The returned Promise will resolve with the encoded value if encoding succeeds, or
 * reject with a `SchemaError` if encoding fails.
 *
 * @example Basic Usage with Primitive Types
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // For primitive types, encoding returns the same value
 * const stringEncoder = Schema.encodeUnknownPromise(Schema.String)
 * stringEncoder("hello").then(console.log) // "hello"
 *
 * const numberEncoder = Schema.encodeUnknownPromise(Schema.Number)
 * numberEncoder(42).then(console.log) // 42
 * ```
 *
 * @example With Transform Schema
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Encoding with transformation schemas
 * const finiteEncoder = Schema.encodeUnknownPromise(Schema.FiniteFromString)
 * finiteEncoder(123.45).then(console.log) // "123.45"
 * finiteEncoder(-42).then(console.log) // "-42"
 *
 * // Date to string encoding using encodeTo
 * const DateStringSchema = Schema.Date.pipe(Schema.encodeTo(Schema.String))
 * const dateEncoder = Schema.encodeUnknownPromise(DateStringSchema)
 * const date = new Date("2023-10-01")
 * dateEncoder(date).then(console.log) // "2023-10-01T00:00:00.000Z"
 * ```
 *
 * @example Complex Object Encoding
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Encoding structured data
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.FiniteFromString,
 *   isActive: Schema.Boolean
 * })
 *
 * const personEncoder = Schema.encodeUnknownPromise(PersonSchema)
 * const person = { name: "Alice", age: 30, isActive: true }
 * personEncoder(person).then(console.log) // { name: "Alice", age: "30", isActive: true }
 * ```
 *
 * @example Promise Error Handling
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * const PositiveNumberSchema = Schema.Number.pipe(
 *   Schema.check(Check.positive())
 * )
 *
 * const encoder = Schema.encodeUnknownPromise(PositiveNumberSchema)
 *
 * // Successful encoding
 * encoder(42)
 *   .then(result => console.log("Encoded:", result)) // 42
 *   .catch(error => console.error("Encoding failed:", error))
 *
 * // Failed encoding - Promise will reject
 * encoder(-1)
 *   .then(result => console.log("Encoded:", result))
 *   .catch(error => console.log("Encoding failed:", error.message))
 * ```
 *
 * @example Array and Nested Structure Encoding
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Encoding arrays with transformations
 * const NumberArraySchema = Schema.Array(Schema.FiniteFromString)
 * const arrayEncoder = Schema.encodeUnknownPromise(NumberArraySchema)
 * arrayEncoder([1, 2, 3.14]).then(console.log) // ["1", "2", "3.14"]
 *
 * // Nested structures with JSON encoding
 * const NestedSchema = Schema.Struct({
 *   id: Schema.FiniteFromString,
 *   metadata: Schema.UnknownFromJsonString
 * })
 *
 * const nestedEncoder = Schema.encodeUnknownPromise(NestedSchema)
 * const data = { id: 123, metadata: { key: "value" } }
 * nestedEncoder(data).then(console.log) // { id: "123", metadata: '{"key":"value"}' }
 * ```
 *
 * @category encoding
 * @since 4.0.0
 */
export const encodeUnknownPromise = ToParser.encodeUnknownPromise

/**
 * Creates a Promise-based encoder for typed values using the provided codec.
 *
 * This function takes a codec and returns a function that can encode typed values
 * to their encoded representation asynchronously. Unlike `encodeUnknownPromise`,
 * this function expects the input to be of the exact type `T` defined by the codec,
 * providing better type safety at compile time.
 *
 * The returned Promise will resolve with the encoded value on success, or reject
 * with a `SchemaError` if encoding fails.
 *
 * @example Basic Usage with FiniteFromString Codec
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Use predefined codec that transforms finite numbers to strings
 * const encoder = Schema.encodePromise(Schema.FiniteFromString)
 *
 * // Encode a finite number to string (async)
 * encoder(42).then(result => {
 *   console.log(result) // "42"
 * })
 *
 * // Type safety: only accepts finite numbers
 * // encoder("not a number") // TypeScript error
 * ```
 *
 * @example Handling Encoding Failures with Union Types
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a union codec that might fail
 * const NumberStringSchema = Schema.Union([Schema.Number, Schema.String])
 *
 * const encoder = Schema.encodePromise(NumberStringSchema)
 *
 * // Successful encoding with number
 * encoder(42).then(result => {
 *   console.log("Encoded number:", result) // 42
 * }).catch(error => {
 *   console.error("Encoding failed:", error)
 * })
 *
 * // Successful encoding with string
 * encoder("hello").then(result => {
 *   console.log("Encoded string:", result) // "hello"
 * }).catch(error => {
 *   console.error("Encoding failed:", error)
 * })
 * ```
 *
 * @example Complex Object Encoding
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Define a Person schema with JSON transformation
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.FiniteFromString
 * })
 *
 * const encoder = Schema.encodePromise(PersonSchema)
 *
 * // Encode a person object (converts age number to string)
 * const person = { name: "Alice", age: 30 }
 * encoder(person).then(encoded => {
 *   console.log("Encoded:", encoded) // { name: "Alice", age: "30" }
 * })
 * ```
 *
 * @category encoding
 * @since 4.0.0
 */
export const encodePromise = ToParser.encodePromise

/**
 * Synchronously encodes an unknown value using the provided codec.
 *
 * This function takes a codec and returns a function that can encode any unknown value
 * to its encoded representation. It's useful when you need to encode values at runtime
 * without knowing their exact type at compile time, providing type-safe encoding from
 * unknown input.
 *
 * **Warning:** This function will throw a `SchemaError` if encoding fails. For safer error
 * handling, consider using `encodeUnknownEffect` instead.
 *
 * @example Basic Usage with Primitive Types
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // For primitive types, encoding returns the same value
 * const stringEncoder = Schema.encodeUnknownSync(Schema.String)
 * console.log(stringEncoder("hello")) // "hello"
 *
 * const numberEncoder = Schema.encodeUnknownSync(Schema.Number)
 * console.log(numberEncoder(42)) // 42
 * ```
 *
 * @example With Transform Schema
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Encoding with transformation schemas
 * const finiteEncoder = Schema.encodeUnknownSync(Schema.FiniteFromString)
 * console.log(finiteEncoder(123.45)) // "123.45"
 * console.log(finiteEncoder(-42)) // "-42"
 *
 * // Date to string encoding
 * const DateStringSchema = Schema.Date.pipe(Schema.encodeTo(Schema.String))
 * const dateEncoder = Schema.encodeUnknownSync(DateStringSchema)
 * const date = new Date("2023-10-01")
 * console.log(dateEncoder(date)) // "2023-10-01T00:00:00.000Z"
 * ```
 *
 * @example Complex Object Encoding
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Encoding structured data
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.FiniteFromString,
 *   isActive: Schema.Boolean
 * })
 *
 * const personEncoder = Schema.encodeUnknownSync(PersonSchema)
 * const person = { name: "Alice", age: 30, isActive: true }
 * const encoded = personEncoder(person)
 * console.log(encoded) // { name: "Alice", age: "30", isActive: true }
 * ```
 *
 * @example Error Handling
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * const PositiveNumberSchema = Schema.Number.pipe(
 *   Schema.check(Check.positive())
 * )
 *
 * const encoder = Schema.encodeUnknownSync(PositiveNumberSchema)
 *
 * try {
 *   const result = encoder(42)
 *   console.log(result) // 42
 * } catch (error) {
 *   console.error("Encoding failed:", error)
 * }
 *
 * // This will throw a SchemaError
 * try {
 *   encoder(-1)
 * } catch (error) {
 *   console.log("Encoding failed:", (error as Error).message)
 * }
 * ```
 *
 * @category Encoding
 * @since 4.0.0
 */
export const encodeUnknownSync = ToParser.encodeUnknownSync

/**
 * Synchronously encodes a value from the schema's decoded type to its encoded representation.
 *
 * This function provides a synchronous way to transform values from the internal (Type)
 * representation to the external (Encoded) format. It's particularly useful for transformations
 * that need to happen immediately without Effect context, such as preparing data for JSON
 * serialization or API responses.
 *
 * **Warning:** This function will throw a `SchemaError` if encoding fails. For safer error
 * handling, consider using `encodeEffect` instead.
 *
 * @example Basic primitive encoding
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // For primitive types, encoding returns the same value
 * const stringEncoder = Schema.encodeSync(Schema.String)
 * console.log(stringEncoder("hello")) // "hello"
 *
 * const numberEncoder = Schema.encodeSync(Schema.Number)
 * console.log(numberEncoder(42)) // 42
 * ```
 *
 * @example Transformation schema encoding
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Encoding with transformation schemas
 * const finiteEncoder = Schema.encodeSync(Schema.FiniteFromString)
 * console.log(finiteEncoder(123.45)) // "123.45"
 * console.log(finiteEncoder(-42)) // "-42"
 *
 * // Date to string encoding using encodeTo
 * const DateStringSchema = Schema.Date.pipe(Schema.encodeTo(Schema.String))
 * const dateEncoder = Schema.encodeSync(DateStringSchema)
 * const date = new Date("2023-10-01")
 * console.log(dateEncoder(date)) // "2023-10-01T00:00:00.000Z"
 * ```
 *
 * @example Complex object encoding
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Encoding structured data
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.FiniteFromString,
 *   isActive: Schema.Boolean
 * })
 *
 * const personEncoder = Schema.encodeSync(PersonSchema)
 * const person = { name: "Alice", age: 30, isActive: true }
 * const encoded = personEncoder(person)
 * console.log(encoded) // { name: "Alice", age: "30", isActive: true }
 * ```
 *
 * @example Array and nested structure encoding
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Encoding arrays with transformations
 * const NumberArraySchema = Schema.Array(Schema.FiniteFromString)
 * const arrayEncoder = Schema.encodeSync(NumberArraySchema)
 * console.log(arrayEncoder([1, 2, 3.14])) // ["1", "2", "3.14"]
 *
 * // Nested structures with JSON encoding
 * const NestedSchema = Schema.Struct({
 *   id: Schema.FiniteFromString,
 *   metadata: Schema.UnknownFromJsonString
 * })
 *
 * const nestedEncoder = Schema.encodeSync(NestedSchema)
 * const nested = {
 *   id: 123,
 *   metadata: { created: "2023-01-01", tags: ["important"] }
 * }
 * const encoded = nestedEncoder(nested)
 * console.log(encoded)
 * // {
 * //   id: "123",
 * //   metadata: '{"created":"2023-01-01","tags":["important"]}'
 * // }
 * ```
 *
 * @example Error handling
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * const PositiveNumberSchema = Schema.Number.pipe(
 *   Schema.check(Check.positive())
 * )
 *
 * const encoder = Schema.encodeSync(PositiveNumberSchema)
 *
 * // Valid encoding
 * console.log(encoder(5)) // 5
 *
 * // This will throw a SchemaError
 * try {
 *   encoder(-1)
 * } catch (error) {
 *   console.log("Encoding failed:", String(error))
 * }
 * ```
 *
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
 * This is the fundamental constructor for all schemas in the Effect Schema library.
 * It takes an AST node and wraps it in a fully-typed schema that preserves all
 * type information and provides the complete schema API.
 *
 * The `make` function is used internally to create all primitive schemas like
 * `String`, `Number`, `Boolean`, etc., as well as more complex schemas. It's the
 * bridge between the untyped AST representation and the strongly-typed schema.
 *
 * @example
 * ```ts
 * import { Schema, AST } from "effect/schema"
 *
 * // Creating primitive schemas using AST nodes
 * const StringSchema = Schema.make<Schema.String>(AST.stringKeyword)
 * const NumberSchema = Schema.make<Schema.Number>(AST.numberKeyword)
 * const BooleanSchema = Schema.make<Schema.Boolean>(AST.booleanKeyword)
 *
 * // These are equivalent to the built-in schemas
 * console.log(StringSchema === Schema.String)   // true (by reference)
 * console.log(NumberSchema === Schema.Number)   // true (by reference)
 * console.log(BooleanSchema === Schema.Boolean) // true (by reference)
 *
 * // Using the created schemas for validation
 * Schema.decodeUnknownSync(StringSchema)("hello")  // "hello"
 * Schema.decodeUnknownSync(NumberSchema)(42)       // 42
 * Schema.decodeUnknownSync(BooleanSchema)(true)    // true
 * ```
 *
 * @example
 * ```ts
 * import { Schema, AST } from "effect/schema"
 * import type * as Annotations from "effect/schema/Annotations"
 *
 * // Creating a literal schema using AST
 * interface HelloLiteral extends Schema.Bottom<
 *   "hello",
 *   "hello",
 *   never,
 *   never,
 *   AST.LiteralType,
 *   HelloLiteral,
 *   Annotations.Bottom<"hello">
 * > {}
 *
 * const LiteralSchema = Schema.make<HelloLiteral>(
 *   new AST.LiteralType("hello")
 * )
 *
 * // Validation with the literal schema
 * Schema.decodeUnknownSync(LiteralSchema)("hello")  // "hello"
 * // Schema.decodeUnknownSync(LiteralSchema)("world") // throws ParseError
 * ```
 *
 * @example
 * ```ts
 * import { Schema, AST } from "effect/schema"
 * import type * as Annotations from "effect/schema/Annotations"
 *
 * // Creating a more complex schema from a union AST
 * const StringOrNumberAST = new AST.UnionType([
 *   AST.stringKeyword,
 *   AST.numberKeyword
 * ], "anyOf")
 *
 * interface StringOrNumber extends Schema.Bottom<
 *   string | number,
 *   string | number,
 *   never,
 *   never,
 *   AST.UnionType,
 *   StringOrNumber,
 *   Annotations.Bottom<string | number>
 * > {}
 *
 * const StringOrNumberSchema = Schema.make<StringOrNumber>(StringOrNumberAST)
 *
 * // Validation with the union schema
 * Schema.decodeUnknownSync(StringOrNumberSchema)("hello") // "hello"
 * Schema.decodeUnknownSync(StringOrNumberSchema)(42)      // 42
 * // Schema.decodeUnknownSync(StringOrNumberSchema)(true) // throws ParseError
 * ```
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
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const StringSchema = Schema.String
 * const NumberSchema = Schema.Number
 *
 * // Test with actual schemas
 * console.log(Schema.isSchema(StringSchema)) // true
 * console.log(Schema.isSchema(NumberSchema)) // true
 *
 * // Test with non-schema values
 * console.log(Schema.isSchema("not a schema")) // false
 * console.log(Schema.isSchema(42)) // false
 * console.log(Schema.isSchema(null)) // false
 * console.log(Schema.isSchema(undefined)) // false
 * console.log(Schema.isSchema({})) // false
 * ```
 *
 * @category guards
 * @since 4.0.0
 */
export function isSchema(u: unknown): u is Schema<unknown> {
  return Predicate.hasProperty(u, TypeId) && u[TypeId] === TypeId
}

/**
 * Interface representing a schema with optional key metadata, making fields optional in struct and tuple types.
 *
 * The `optionalKey` interface wraps another schema to indicate that when used in a `Struct` or `Tuple`,
 * the field should be optional. Unlike `optional` which adds `undefined` to the type union, `optionalKey`
 * only affects the optionality of the key without changing the value type.
 *
 * @example Basic optionalKey interface usage in structs
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a struct with an optional string field
 * const UserSchema = Schema.Struct({
 *   name: Schema.String,
 *   email: Schema.String.pipe(Schema.optionalKey)
 * })
 *
 * // Valid inputs - email is optional
 * const user1 = Schema.decodeUnknownSync(UserSchema)({ name: "Alice" })
 * // { name: "Alice" }
 *
 * const user2 = Schema.decodeUnknownSync(UserSchema)({ name: "Bob", email: "bob@example.com" })
 * // { name: "Bob", email: "bob@example.com" }
 *
 * // Type-level verification
 * type UserType = typeof UserSchema.Type
 * // { readonly name: string; readonly email?: string }
 * ```
 *
 * @example OptionalKey with transformation schemas
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Optional field with transformation
 * const ConfigSchema = Schema.Struct({
 *   port: Schema.FiniteFromString,
 *   timeout: Schema.Number.pipe(Schema.optionalKey)
 * })
 *
 * // Valid inputs
 * const config1 = Schema.decodeUnknownSync(ConfigSchema)({ port: "3000" })
 * // { port: 3000 }
 *
 * const config2 = Schema.decodeUnknownSync(ConfigSchema)({ port: "3000", timeout: 5000 })
 * // { port: 3000, timeout: 5000 }
 * ```
 *
 * @example OptionalKey in tuples
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Tuple with optional elements
 * const PersonTuple = Schema.Tuple([
 *   Schema.String,                    // required name
 *   Schema.Number.pipe(Schema.optionalKey)  // optional age
 * ])
 *
 * // Valid inputs
 * const person1 = Schema.decodeUnknownSync(PersonTuple)(["Alice"])
 * // ["Alice"]
 *
 * const person2 = Schema.decodeUnknownSync(PersonTuple)(["Bob", 30])
 * // ["Bob", 30]
 *
 * // Type-level verification
 * type PersonType = typeof PersonTuple.Type
 * // readonly [string, number?]
 * ```
 *
 * @example Combining optionalKey with mutableKey
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Combine optional and mutable modifiers
 * const MutableOptionalSchema = Schema.Struct({
 *   data: Schema.String.pipe(Schema.mutableKey, Schema.optionalKey)
 * })
 *
 * // Type-level verification
 * type MutableOptionalType = typeof MutableOptionalSchema.Type
 * // { data?: string }  // mutable and optional
 * ```
 *
 * @category models
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
 * Creates an exact optional key schema for struct fields. Unlike `optional`, this creates
 * exact optional properties (not `| undefined`) that can be completely omitted from the object.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a struct with optional key
 * const schema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.optionalKey(Schema.Number)
 * })
 *
 * // Type: { readonly name: string; readonly age?: number }
 * type Person = Schema.Schema.Type<typeof schema>
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Optional key with transformation
 * const schema = Schema.Struct({
 *   id: Schema.String,
 *   count: Schema.optionalKey(Schema.FiniteFromString)
 * })
 *
 * // Decode: { id: "abc", count: "42" } -> { id: "abc", count: 42 }
 * // Decode: { id: "abc" } -> { id: "abc" }
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Optional key in tuple
 * const schema = Schema.Tuple([
 *   Schema.String,
 *   Schema.optionalKey(Schema.Number)
 * ])
 *
 * // Type: readonly [string, number?]
 * type Tuple = Schema.Schema.Type<typeof schema>
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const optionalKey = lambda<optionalKeyLambda>(function optionalKey<S extends Top>(self: S): optionalKey<S> {
  return new makeWithSchema$<S, optionalKey<S>>(AST.optionalKey(self.ast), self)
})

/**
 * Represents an optional schema field that allows both the specified type and `undefined`.
 *
 * This interface extends `optionalKey<Union<readonly [S, Undefined]>>` and is the return type
 * of the `optional` function. It creates a field that can be omitted from objects entirely,
 * explicitly set to `undefined`, or contain the specified schema type.
 *
 * @example Type-level usage
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a type alias for an optional string field
 * type OptionalString = Schema.optional<Schema.String>
 *
 * // Use in struct definitions
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   nickname: Schema.optional(Schema.String)
 * })
 *
 * type Person = Schema.Schema.Type<typeof PersonSchema>
 * // Person = { name: string; nickname?: string | undefined }
 * ```
 *
 * @example Optional field behavior
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const ConfigSchema = Schema.Struct({
 *   port: Schema.Number,
 *   host: Schema.optional(Schema.String)
 * })
 *
 * // All of these are valid:
 * Schema.decodeSync(ConfigSchema)({ port: 3000 })
 * // => { port: 3000 }
 *
 * Schema.decodeSync(ConfigSchema)({ port: 3000, host: "localhost" })
 * // => { port: 3000, host: "localhost" }
 *
 * Schema.decodeSync(ConfigSchema)({ port: 3000, host: undefined })
 * // => { port: 3000, host: undefined }
 * ```
 *
 * @category models
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
 * Creates a mutable key for object fields that allows modification of field values after construction.
 *
 * The `mutableKey` interface wraps a schema to mark the corresponding field as mutable,
 * allowing the field to be modified after the object is created. This is useful when you need
 * to create objects with properties that can be changed after initialization.
 *
 * @example Basic mutable field usage
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a schema with a mutable field
 * const PersonSchema = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String.pipe(Schema.mutableKey)
 * })
 *
 * const person = Schema.decodeUnknownSync(PersonSchema)({ id: 1, name: "Alice" })
 * person.name = "Bob" // This works because name is mutable
 * console.log(person) // { id: 1, name: "Bob" }
 * ```
 *
 * @example Type-level demonstration
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Compare mutable vs immutable fields
 * const ImmutableSchema = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String
 * })
 *
 * const MutableSchema = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String.pipe(Schema.mutableKey)
 * })
 *
 * type ImmutableType = Schema.Schema.Type<typeof ImmutableSchema>
 * // { readonly id: number; readonly name: string }
 *
 * type MutableType = Schema.Schema.Type<typeof MutableSchema>
 * // { readonly id: number; name: string } - name is mutable
 * ```
 *
 * @example Working with mutable schema in struct
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a struct with mixed mutability
 * const UserProfileSchema = Schema.Struct({
 *   id: Schema.Number,
 *   email: Schema.String,
 *   displayName: Schema.String.pipe(Schema.mutableKey)
 * })
 *
 * // The mutableKey allows the field to be reassigned after creation
 * type UserProfile = Schema.Schema.Type<typeof UserProfileSchema>
 * // {
 * //   readonly id: number
 * //   readonly email: string
 * //   displayName: string  // mutable
 * // }
 * ```
 *
 * @category models
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
 * Creates a mutable key modifier that allows a struct field to be modified after creation.
 *
 * By default, struct fields are readonly. The `mutableKey` function transforms a schema
 * to allow mutation of the field, changing its type signature from `readonly field: T`
 * to `field: T` (removing the readonly modifier).
 *
 * @example Basic mutableKey usage in structs
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a struct with a mutable string field
 * const UserSchema = Schema.Struct({
 *   name: Schema.String,
 *   email: Schema.mutableKey(Schema.String)
 * })
 *
 * // Type: { readonly name: string; email: string }
 * type User = Schema.Schema.Type<typeof UserSchema>
 *
 * // Creating and modifying an instance
 * const user: User = { name: "John", email: "john@example.com" }
 * user.email = "john.doe@example.com" // ✓ Allowed - email is mutable
 * // user.name = "Jane" // ✗ Error - name is readonly
 * ```
 *
 * @example Using mutableKey with Structs (not Records)
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a struct with mutable fields (mutableKey works with Structs)
 * const ConfigSchema = Schema.Struct({
 *   port: Schema.mutableKey(Schema.Number),
 *   timeout: Schema.Number
 * })
 *
 * // Type: { port: number; readonly timeout: number }
 * type Config = Schema.Schema.Type<typeof ConfigSchema>
 *
 * const config: Config = { port: 3000, timeout: 5000 }
 * config.port = 8080 // ✓ Allowed - port is mutable
 * // config.timeout = 1000 // ✗ Error - timeout is readonly
 * ```
 *
 * @example Combining mutableKey with optionalKey
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Combine mutable and optional modifiers
 * const SettingsSchema = Schema.Struct({
 *   theme: Schema.String,
 *   debug: Schema.mutableKey(Schema.optionalKey(Schema.Boolean))
 * })
 *
 * // Type: { readonly theme: string; debug?: boolean }
 * type Settings = Schema.Schema.Type<typeof SettingsSchema>
 *
 * const settings: Settings = { theme: "dark" }
 * settings.debug = true // ✓ Allowed - debug is mutable and optional
 * ```
 *
 * @example Using mutableKey in Classes
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * class User extends Schema.Class<User>("User")({
 *   name: Schema.String,
 *   email: Schema.mutableKey(Schema.String)
 * }) {
 *   updateEmail(newEmail: string) {
 *     this.email = newEmail // ✓ Allowed - email is mutable
 *   }
 * }
 *
 * const user = new User({ name: "John", email: "john@example.com" })
 * user.updateEmail("john.doe@example.com")
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const mutableKey = lambda<mutableKeyLambda>(function mutableKey<S extends Top>(self: S): mutableKey<S> {
  return new makeWithSchema$<S, mutableKey<S>>(AST.mutableKey(self.ast), self)
})

/**
 * The `typeCodec` interface represents a codec that operates on the Type level
 * (decoded form) of a schema, removing any encoding transformations. It creates
 * a codec where both the Type and Encoded are the same (the decoded type).
 *
 * This is useful when you want to work with the decoded form of a schema for
 * operations like serialization, validation, or type checking without the
 * encoding layer.
 *
 * @example Basic usage with a transformation schema
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Schema that transforms from string to number
 * const NumberFromString = Schema.String.pipe(Schema.decodeTo(Schema.Number))
 *
 * // Create a typeCodec that works with the decoded type (number)
 * const codec = Schema.typeCodec(NumberFromString)
 *
 * // The codec works with numbers (Type), not strings (Encoded)
 * const result = codec.makeSync(42) // number -> number
 * ```
 *
 * @example Using with struct schemas
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const Person = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.String.pipe(Schema.decodeTo(Schema.Number))
 * })
 *
 * // Create a typeCodec that works with the decoded struct
 * const codec = Schema.typeCodec(Person)
 *
 * // Works with the decoded form: { name: string, age: number }
 * const person = codec.makeSync({ name: "John", age: 30 })
 * ```
 *
 * @example Type-level operations
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const NumberFromString = Schema.String.pipe(Schema.decodeTo(Schema.Number))
 *
 * // Extract the type information
 * type TypeCodec = Schema.typeCodec<typeof NumberFromString>
 *
 * // Both Type and Encoded are the same (number)
 * type TypeLevel = TypeCodec["Type"]     // number
 * type EncodedLevel = TypeCodec["Encoded"] // number
 * ```
 *
 * @example Serialization use case
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const DateFromString = Schema.String.pipe(Schema.decodeTo(Schema.Date))
 *
 * // Create a typeCodec for working with Date objects
 * const codec = Schema.typeCodec(DateFromString)
 *
 * // Can be used for serialization of the decoded form
 * const date = new Date()
 * const validated = codec.makeSync(date) // Date -> Date
 * ```
 *
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
 * Creates a codec that operates on the Type level (decoded form) of a schema,
 * removing any encoding transformations. The resulting codec has both Type
 * and Encoded set to the same decoded type.
 *
 * This is useful when you want to work with the decoded form of a schema for
 * operations like serialization, validation, or type checking without the
 * encoding layer.
 *
 * @example Basic usage with transformation schema
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Schema that transforms from string to number
 * const NumberFromString = Schema.String.pipe(Schema.decodeTo(Schema.Number))
 *
 * // Create a typeCodec that works with the decoded type (number)
 * const codec = Schema.typeCodec(NumberFromString)
 *
 * // The codec works with numbers (Type), not strings (Encoded)
 * const result = codec.makeSync(42) // number -> number
 * ```
 *
 * @example Using with struct schemas for validation
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const Person = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.String.pipe(Schema.decodeTo(Schema.Number))
 * })
 *
 * // Create a typeCodec that works with the decoded struct
 * const codec = Schema.typeCodec(Person)
 *
 * // Works with the decoded form: { name: string, age: number }
 * const person = codec.makeSync({ name: "John", age: 30 })
 * ```
 *
 * @example Serialization use case
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const DateFromString = Schema.String.pipe(Schema.decodeTo(Schema.Date))
 *
 * // Create a typeCodec for working with Date objects
 * const codec = Schema.typeCodec(DateFromString)
 *
 * // Can be used for serialization of the decoded form
 * const date = new Date()
 * const validated = codec.makeSync(date) // Date -> Date
 * ```
 *
 * @example Type-level operations
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const NumberFromString = Schema.String.pipe(Schema.decodeTo(Schema.Number))
 *
 * // Extract the type information
 * type TypeCodec = Schema.typeCodec<typeof NumberFromString>
 *
 * // Both Type and Encoded are the same (number)
 * type TypeLevel = TypeCodec["Type"]     // number
 * type EncodedLevel = TypeCodec["Encoded"] // number
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const typeCodec = lambda<typeCodecLambda>(function typeCodec<S extends Top>(self: S): typeCodec<S> {
  return new makeWithSchema$<S, typeCodec<S>>(AST.typeAST(self.ast), self)
})

/**
 * A codec interface that operates on the encoded representation of a schema.
 *
 * The `encodedCodec` interface creates a schema that works exclusively with the
 * encoded type of the original schema, effectively allowing operations on the
 * encoded data without transformation to the decoded type.
 *
 * @example Basic usage with transformation schema
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a schema that transforms strings to numbers
 * const NumberFromString = Schema.FiniteFromString
 *
 * // Create an encoded codec - works with string type only
 * const encodedCodec = Schema.encodedCodec(NumberFromString)
 *
 * // The encoded codec operates on strings (encoded type)
 * const result = Schema.decodeUnknownSync(encodedCodec)("42")
 * console.log(result) // "42" (string, not number)
 *
 * // Type information shows string types
 * type EncodedType = typeof encodedCodec["Type"]     // string
 * type EncodedEncoded = typeof encodedCodec["Encoded"] // string
 * ```
 *
 * @example Working with struct schemas
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Define a struct with transformations
 * const UserSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.FiniteFromString,
 *   isActive: Schema.Boolean
 * })
 *
 * // Create encoded codec for the struct
 * const encodedUserCodec = Schema.encodedCodec(UserSchema)
 *
 * // Works with the encoded representation
 * const encodedUser = {
 *   name: "Alice",
 *   age: "30",        // string, not number
 *   isActive: true
 * }
 *
 * const result = Schema.decodeUnknownSync(encodedUserCodec)(encodedUser)
 * console.log(result) // { name: "Alice", age: "30", isActive: true }
 * ```
 *
 * @example Using with revealCodec for type inspection
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a transformation schema
 * const StringToNumber = Schema.FiniteFromString
 *
 * // Create encoded codec
 * const encoded = Schema.encodedCodec(StringToNumber)
 *
 * // Reveal the codec interface for type inspection
 * const revealedCodec = Schema.revealCodec(encoded)
 *
 * // Both Type and Encoded are strings for encoded codec
 * type CodecType = typeof revealedCodec["Type"]     // string
 * type CodecEncoded = typeof revealedCodec["Encoded"] // string
 * type DecodingServices = typeof revealedCodec["DecodingServices"] // never
 * type EncodingServices = typeof revealedCodec["EncodingServices"] // never
 * ```
 *
 * @example Applying to field transformations
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Original struct with mixed types
 * const OriginalSchema = Schema.Struct({
 *   id: Schema.FiniteFromString,
 *   name: Schema.String,
 *   score: Schema.Number
 * })
 *
 * // Apply encodedCodec to each field
 * const EncodedFieldsSchema = Schema.Struct({
 *   id: Schema.encodedCodec(Schema.FiniteFromString),
 *   name: Schema.encodedCodec(Schema.String),
 *   score: Schema.encodedCodec(Schema.Number)
 * })
 *
 * // All fields now work with their encoded types
 * const data = {
 *   id: "123",      // string (encoded)
 *   name: "Alice",  // string (already encoded)
 *   score: 95       // number (already encoded)
 * }
 *
 * const result = Schema.decodeUnknownSync(EncodedFieldsSchema)(data)
 * console.log(result) // { id: "123", name: "Alice", score: 95 }
 * ```
 *
 * @example Comparison with regular codec
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Original transformation schema
 * const NumberFromString = Schema.FiniteFromString
 *
 * // Regular codec - transforms string to number
 * const regularResult = Schema.decodeUnknownSync(NumberFromString)("42")
 * console.log(regularResult) // 42 (number)
 *
 * // Encoded codec - keeps string representation
 * const encodedCodec = Schema.encodedCodec(NumberFromString)
 * const encodedResult = Schema.decodeUnknownSync(encodedCodec)("42")
 * console.log(encodedResult) // "42" (string)
 *
 * // Type differences
 * type RegularType = typeof NumberFromString["Type"]     // number
 * type EncodedType = typeof encodedCodec["Type"]         // string
 * ```
 *
 * @category codecs
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
 * Creates a codec that operates only on the encoded representation of a schema.
 *
 * This function transforms a schema into an `encodedCodec` that works exclusively with
 * the encoded form, where both the input and output types are the encoded representation.
 * This is useful for applying transformations or validations to the encoded data
 * without involving the decoded type.
 *
 * The resulting codec has both `Type` and `Encoded` set to the original schema's
 * encoded type, effectively creating a codec that doesn't perform any type-level
 * transformations but can still validate and transform the encoded data.
 *
 * @example Basic usage with finite number from string schema
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a schema that transforms string to finite number
 * const StringToFinite = Schema.FiniteFromString
 *
 * // Create an encoded codec that only works with strings (the encoded form)
 * const encodedStringCodec = Schema.encodedCodec(StringToFinite)
 *
 * // The encoded codec's Type and Encoded are both string
 * type EncodedType = typeof encodedStringCodec["Type"]     // string
 * type EncodedEncoded = typeof encodedStringCodec["Encoded"] // string
 *
 * // Can be used with string-only operations
 * const result = Schema.decodeUnknownSync(encodedStringCodec)("123")
 * console.log(result) // "123" (string, not transformed to number)
 * ```
 *
 * @example Type extraction from encoded codec
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a JSON schema that transforms string to unknown
 * const JsonSchema = Schema.UnknownFromJsonString
 *
 * // Create an encoded codec that only works with strings
 * const encodedJsonCodec = Schema.encodedCodec(JsonSchema)
 *
 * // Both Type and Encoded are string in the encoded codec
 * type JsonEncodedType = typeof encodedJsonCodec["Type"]     // string
 * type JsonEncodedEncoded = typeof encodedJsonCodec["Encoded"] // string
 *
 * // Can validate JSON strings without parsing
 * const result = Schema.decodeUnknownSync(encodedJsonCodec)('{"key": "value"}')
 * console.log(result) // '{"key": "value"}' (remains as string)
 * ```
 *
 * @category codecs
 * @since 4.0.0
 */
export const encodedCodec = lambda<encodedCodecLambda>(function encodedCodec<S extends Top>(self: S): encodedCodec<S> {
  return new makeWithSchema$<S, encodedCodec<S>>(AST.encodedAST(self.ast), self)
})

/**
 * Represents a schema that has been flipped to reverse its Type and Encoded parameters.
 *
 * A flipped schema swaps the input and output types of the original schema, creating a new schema
 * that transforms in the opposite direction. This is useful for creating bidirectional
 * transformations where you want to reuse an existing schema but invert its direction.
 *
 * The flipped schema maintains a reference to the original schema through the `schema` property,
 * allowing access to the underlying transformation logic.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Original schema transforms string to number
 * const NumberFromString = Schema.FiniteFromString
 *
 * // Flipped schema transforms number to string
 * const StringFromNumber = Schema.flip(NumberFromString)
 *
 * // Access the original schema
 * const original = StringFromNumber.schema
 * ```
 *
 * @example
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * // Create a schema with validation on both sides
 * const schema = Schema.FiniteFromString.pipe(
 *   Schema.check(Check.greaterThan(2)),
 *   Schema.flip,
 *   Schema.check(Check.minLength(3))
 * )
 *
 * // The flipped schema validates string length and transforms to number
 * const result = Schema.encodeSync(schema)("123") // 123
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Struct schema with flipped transformation
 * const originalSchema = Schema.Struct({
 *   value: Schema.FiniteFromString
 * })
 *
 * const flippedSchema = Schema.flip(originalSchema)
 *
 * // Double flipping restores original behavior
 * const doubleFlipped = Schema.flip(flippedSchema)
 * ```
 *
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
 * Creates a flipped version of a schema that reverses the input and output types.
 *
 * The flipped schema converts the original schema's `Type` to `Encoded` and `Encoded` to `Type`.
 * This is useful for creating bidirectional transformations where you need to reverse
 * the direction of an existing schema.
 *
 * Flipping a schema twice returns a schema with the same structure and behavior as the original.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Original schema: decodes string to number, encodes number to string
 * const NumberFromString = Schema.FiniteFromString
 *
 * // Flipped schema: decodes number to string, encodes string to number
 * const StringFromNumber = Schema.flip(NumberFromString)
 *
 * // Use the flipped schema
 * const stringResult = Schema.decodeSync(StringFromNumber)(42)
 * // Result: "42" (number -> string)
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Complex schema with struct
 * const userSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.FiniteFromString
 * })
 *
 * // Flip the entire schema
 * const flippedUserSchema = Schema.flip(userSchema)
 *
 * // Access the original schema
 * const originalSchema = flippedUserSchema.schema
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Double flipping restores the original behavior
 * const original = Schema.FiniteFromString
 * const doubleFlipped = Schema.flip(Schema.flip(original))
 *
 * // doubleFlipped behaves the same as the original schema
 * const result = Schema.decodeSync(doubleFlipped)("42")
 * // Result: 42 (string -> number, like the original)
 * ```
 *
 * @category transformations
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
 * Represents a declared schema interface that extends the base schema with custom
 * parsing and encoding behavior through type parameters.
 *
 * The `declare` interface is used to create schemas with custom logic by providing
 * type parameters that define the relationships between input types, output types,
 * and any dependent schemas. This interface enables advanced schema composition
 * and custom transformation behaviors.
 *
 * @example Simple string transformation
 * ```ts
 * import { Schema, Issue } from "effect/schema"
 * import { Effect, Option } from "effect"
 *
 * // Create a declared schema that transforms strings to uppercase
 * const upperCaseSchema = Schema.declare([])<string>()(
 *   () => (input, ast, options) => {
 *     if (typeof input === "string") {
 *       return Effect.succeed(input.toUpperCase())
 *     }
 *     return Effect.fail(new Issue.InvalidType(ast, Option.some(input)))
 *   }
 * )
 *
 * // The result has type declare<string, string, []>
 * const result = Schema.decodeUnknownSync(upperCaseSchema)("hello") // "HELLO"
 * ```
 *
 * @example Schema with type parameters
 * ```ts
 * import { Schema, Issue, ToParser } from "effect/schema"
 * import { Effect, Option } from "effect"
 *
 * // Create a Maybe schema similar to Option
 * function makeMaybeSchema<S extends Schema.Top>(valueSchema: S) {
 *   return Schema.declare([valueSchema])<Option.Option<S["Encoded"]>>()(
 *     ([value]) => (input, ast, options) => {
 *       if (Option.isOption(input)) {
 *         if (Option.isNone(input)) {
 *           return Effect.succeed(Option.none())
 *         }
 *         return ToParser.decodeUnknownEffect(value)(input.value, options).pipe(
 *           Effect.map(Option.some)
 *         )
 *       }
 *       return Effect.fail(new Issue.InvalidType(ast, Option.some(input)))
 *     }
 *   )
 * }
 *
 * // Usage with string schema
 * const maybeStringSchema = makeMaybeSchema(Schema.String)
 * ```
 *
 * @example Custom collection schema
 * ```ts
 * import { Schema, Issue, ToParser } from "effect/schema"
 * import { Effect, Option } from "effect"
 *
 * // Create a NonEmptySet schema
 * function makeNonEmptySetSchema<T extends Schema.Top>(elementSchema: T) {
 *   return Schema.declare([elementSchema])<ReadonlyArray<T["Encoded"]>>()(
 *     ([element]) => (input, ast, options) => {
 *       if (Array.isArray(input) && input.length > 0) {
 *         return Effect.forEach(input, (item) =>
 *           ToParser.decodeUnknownEffect(element)(item, options)
 *         ).pipe(
 *           Effect.map(items => Array.from(new Set(items)))
 *         )
 *       }
 *       return Effect.fail(new Issue.InvalidType(ast, Option.some(input)))
 *     }
 *   )
 * }
 *
 * // Create a non-empty set of numbers
 * const nonEmptyNumberSetSchema = makeNonEmptySetSchema(Schema.Number)
 * ```
 *
 * @category models
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
 * Represents a schema for validating literal values.
 *
 * The `Literal` interface defines a schema that validates a specific literal value.
 * This interface is used to create schemas that accept only exact values such as
 * string literals, numbers, booleans, or bigints.
 *
 * @example Basic string literal schema
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const RedSchema = Schema.Literal("red")
 * type RedType = typeof RedSchema.Type // "red"
 *
 * // The schema only accepts the exact literal value
 * Schema.decodeUnknownSync(RedSchema)("red")    // "red"
 * // Schema.decodeUnknownSync(RedSchema)("blue")   // throws ParseError
 * ```
 *
 * @example Number literal schema
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const FortyTwoSchema = Schema.Literal(42)
 * type FortyTwoType = typeof FortyTwoSchema.Type // 42
 *
 * Schema.decodeUnknownSync(FortyTwoSchema)(42)  // 42
 * // Schema.decodeUnknownSync(FortyTwoSchema)(43)  // throws ParseError
 * ```
 *
 * @example Boolean literal schema
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const TrueSchema = Schema.Literal(true)
 * type TrueType = typeof TrueSchema.Type // true
 *
 * Schema.decodeUnknownSync(TrueSchema)(true)   // true
 * // Schema.decodeUnknownSync(TrueSchema)(false)  // throws ParseError
 * ```
 *
 * @example BigInt literal schema
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const BigIntSchema = Schema.Literal(42n)
 * type BigIntType = typeof BigIntSchema.Type // 42n
 *
 * Schema.decodeUnknownSync(BigIntSchema)(42n)  // 42n
 * // Schema.decodeUnknownSync(BigIntSchema)(43n)  // throws ParseError
 * ```
 *
 * @example Accessing the literal value
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.Literal("hello")
 * console.log(schema.literal) // "hello"
 * ```
 *
 * @example Using with union types
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const ColorSchema = Schema.Union([
 *   Schema.Literal("red"),
 *   Schema.Literal("green"),
 *   Schema.Literal("blue")
 * ])
 * type Color = typeof ColorSchema.Type // "red" | "green" | "blue"
 *
 * Schema.decodeUnknownSync(ColorSchema)("red")    // "red"
 * Schema.decodeUnknownSync(ColorSchema)("green")  // "green"
 * // Schema.decodeUnknownSync(ColorSchema)("yellow") // throws ParseError
 * ```
 *
 * @category models
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
 * The TemplateLiteral namespace provides type utilities for working with template literal schemas.
 *
 * This namespace contains type definitions that help you work with template literal patterns,
 * including extracting types from template literal parts and building complex template patterns.
 * The namespace is essential for type-level operations on template literals where you need to
 * access the constituent parts or encoded types.
 *
 * @example Working with template literal parts
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a template literal schema
 * const userIdSchema = Schema.TemplateLiteral(["user-", Schema.String, "-", Schema.Number])
 *
 * // Extract the parts type for type-level operations
 * type UserIdParts = typeof userIdSchema.parts
 * // UserIdParts is: readonly ["user-", Schema<string, string, never, never>, "-", Schema<number, number, never, never>]
 *
 * // Use the namespace types for custom type utilities
 * type ValidParts = Schema.TemplateLiteral.Parts
 * type ValidPart = Schema.TemplateLiteral.Part
 * type ValidSchemaPart = Schema.TemplateLiteral.SchemaPart
 * ```
 *
 * @example Building template literal validators
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Define a function that accepts template literal parts
 * function createTemplateValidator<P extends Schema.TemplateLiteral.Parts>(parts: P) {
 *   return Schema.TemplateLiteral(parts)
 * }
 *
 * // Create different template patterns
 * const emailPattern = createTemplateValidator([
 *   Schema.String,
 *   "@",
 *   Schema.String,
 *   ".",
 *   Schema.Literals(["com", "org", "net"])
 * ])
 *
 * const versionPattern = createTemplateValidator([
 *   "v",
 *   Schema.Number,
 *   ".",
 *   Schema.Number,
 *   ".",
 *   Schema.Number
 * ])
 * ```
 *
 * @example Type extraction from template literals
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a complex template literal
 * const complexTemplate = Schema.TemplateLiteral([
 *   "prefix-",
 *   Schema.String,
 *   "-",
 *   Schema.Literals(["dev", "prod"]),
 *   "-",
 *   Schema.Number
 * ])
 *
 * // Extract the encoded type using the namespace
 * type EncodedType = Schema.TemplateLiteral.Encoded<typeof complexTemplate.parts>
 * // EncodedType is: `prefix-${string}-${("dev" | "prod")}-${number}`
 *
 * // Use the type for function parameters
 * function processTemplateString(input: EncodedType) {
 *   // Process the template literal string
 *   return input.toUpperCase()
 * }
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export declare namespace TemplateLiteral {
  /**
   * Interface representing a schema part within a template literal.
   *
   * SchemaPart extends the Top interface and constrains the Encoded type to values
   * that are valid within template literals: string, number, or bigint. This interface
   * is used to define schema components that can be interpolated into template literal
   * patterns for string validation.
   *
   * @example Basic SchemaPart Usage
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // String schema part for template literals
   * const stringPart: Schema.TemplateLiteral.SchemaPart = Schema.String
   *
   * // Number schema part for template literals
   * const numberPart: Schema.TemplateLiteral.SchemaPart = Schema.Number
   *
   * // BigInt schema part for template literals
   * const bigintPart: Schema.TemplateLiteral.SchemaPart = Schema.BigInt
   * ```
   *
   * @example Template Literal with Schema Parts
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Create a template literal with mixed schema parts
   * const userIdSchema = Schema.TemplateLiteral([
   *   "user-",
   *   Schema.Number, // SchemaPart
   *   "-",
   *   Schema.String  // SchemaPart
   * ])
   *
   * // Valid: "user-123-john"
   * const validUserId = Schema.decodeUnknownSync(userIdSchema)("user-123-john")
   * console.log(validUserId) // "user-123-john"
   * ```
   *
   * @example Custom Schema Part with Constraints
   * ```ts
   * import { Schema, Check } from "effect/schema"
   *
   * // Create constrained schema parts
   * const positiveNumberPart = Schema.Number.check(Check.positive())
   * const nonEmptyStringPart = Schema.String.check(Check.nonEmpty())
   *
   * // Use in template literal
   * const productCodeSchema = Schema.TemplateLiteral([
   *   "PRD-",
   *   positiveNumberPart,
   *   "-",
   *   nonEmptyStringPart
   * ])
   *
   * // Valid: "PRD-123-widget"
   * const validProductCode = Schema.decodeUnknownSync(productCodeSchema)("PRD-123-widget")
   * console.log(validProductCode) // "PRD-123-widget"
   * ```
   *
   * @example Type-Level Usage
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Function that creates template literal with schema part
   * function createVersionedTemplate<T extends Schema.TemplateLiteral.SchemaPart>(
   *   prefix: string,
   *   versionPart: T
   * ) {
   *   return Schema.TemplateLiteral([prefix, versionPart] as const)
   * }
   *
   * // Usage with different schema parts
   * const versionWithNumber = createVersionedTemplate("v", Schema.Number)
   * const versionWithString = createVersionedTemplate("v", Schema.String)
   *
   * // Validate version patterns
   * const validVersion = Schema.decodeUnknownSync(versionWithNumber)("v123")
   * console.log(validVersion) // "v123"
   * ```
   *
   * @category models
   * @since 4.0.0
   */
  export interface SchemaPart extends Top {
    readonly Encoded: string | number | bigint
  }
  /**
   * A template literal part that can be either a schema or a literal value.
   *
   * This type represents a single part in a template literal pattern. It can be:
   * - A SchemaPart: A schema that produces string, number, or bigint values
   * - A LiteralPart: A literal string, number, or bigint value
   *
   * @example Working with template literal parts
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Examples of valid parts
   * const stringPart: Schema.TemplateLiteral.Part = Schema.String        // SchemaPart
   * const literalPart: Schema.TemplateLiteral.Part = "hello"            // LiteralPart
   * const numberPart: Schema.TemplateLiteral.Part = Schema.Number        // SchemaPart
   * const literalNumPart: Schema.TemplateLiteral.Part = 42              // LiteralPart
   *
   * // Use parts to build template literals
   * const template = Schema.TemplateLiteral([stringPart, literalPart, numberPart])
   * ```
   *
   * @category models
   * @since 4.0.0
   */
  export type Part = SchemaPart | AST.TemplateLiteral.LiteralPart
  /**
   * A readonly array of template literal parts.
   *
   * This type represents the complete set of parts that make up a template literal.
   * Each element in the array is a Part (either a schema or literal value) that will
   * be combined to form the final template literal pattern.
   *
   * @example Building template literals with multiple parts
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Define parts array
   * const emailParts: Schema.TemplateLiteral.Parts = [
   *   Schema.String,  // username part
   *   "@",           // literal separator
   *   Schema.String,  // domain part
   *   ".",           // literal dot
   *   Schema.Literals(["com", "org", "net"])  // TLD options
   * ]
   *
   * // Create template literal from parts
   * const emailSchema = Schema.TemplateLiteral(emailParts)
   * // Type: `${string}@${string}.${"com" | "org" | "net"}`
   *
   * // Validate email format
   * const result = Schema.decodeUnknownSync(emailSchema)("user@example.com")
   * ```
   *
   * @category models
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
   * Extracts the encoded template literal string type from template literal parts.
   *
   * This type utility recursively processes an array of template literal parts and
   * constructs the resulting template literal string type. It is essential for
   * type-level operations where you need to know the exact string pattern that
   * will be produced by a template literal schema.
   *
   * @example Extracting encoded types from template literal parts
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Simple template literal parts
   * const simpleParts = ["Hello, ", Schema.String, "!"] as const
   * type SimpleEncoded = Schema.TemplateLiteral.Encoded<typeof simpleParts>
   * // SimpleEncoded is: `Hello, ${string}!`
   *
   * // Complex template with multiple schemas
   * const complexParts = [
   *   "user-",
   *   Schema.String,
   *   "-id-",
   *   Schema.Number,
   *   "-status-",
   *   Schema.Literals(["active", "inactive"])
   * ] as const
   * type ComplexEncoded = Schema.TemplateLiteral.Encoded<typeof complexParts>
   * // ComplexEncoded is: `user-${string}-id-${number}-status-${"active" | "inactive"}`
   * ```
   *
   * @example Using encoded types for function parameters
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * const idParts = ["id:", Schema.Number] as const
   * type IdTemplate = Schema.TemplateLiteral.Encoded<typeof idParts>
   * // IdTemplate is: `id:${number}`
   *
   * function processId(id: IdTemplate) {
   *   return id.substring(3) // Extract number part
   * }
   *
   * // Usage with proper typing
   * processId("id:123") // ✓ Valid
   * // processId("user:123") // ✗ Type error
   * ```
   *
   * @category models
   * @since 4.0.0
   */
  export type Encoded<Parts> = Parts extends readonly [...infer Init, infer Last] ? AppendType<Encoded<Init>, Last>
    : ``
}

/**
 * Represents a schema that validates template literal patterns.
 *
 * The TemplateLiteral interface extends the base schema interface to provide
 * type-safe validation of string patterns that follow template literal syntax.
 * It combines literal strings with schema types to create flexible pattern
 * validation, similar to TypeScript's template literal types.
 *
 * This interface is typically created using the `Schema.TemplateLiteral` constructor
 * and includes the `parts` property that contains the template literal components.
 *
 * @example Working with TemplateLiteral schema interfaces
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a template literal schema
 * const userIdSchema = Schema.TemplateLiteral(["user-", Schema.String, "-", Schema.Number])
 *
 * // Access the parts property
 * console.log(userIdSchema.parts)
 * // Output: ["user-", Schema.String, "-", Schema.Number]
 *
 * // Use the schema for validation
 * const parseUserId = Schema.decodeUnknownSync(userIdSchema)
 * const validId = parseUserId("user-john-123")
 * console.log(validId) // "user-john-123"
 * ```
 *
 * @example Type-level operations with TemplateLiteral interfaces
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Define template literal schema
 * const emailSchema = Schema.TemplateLiteral([
 *   Schema.String,
 *   "@",
 *   Schema.String,
 *   ".",
 *   Schema.Literals(["com", "org", "net"])
 * ])
 *
 * // Extract the encoded type
 * type EmailPattern = Schema.Schema.Type<typeof emailSchema>
 * // EmailPattern is: `${string}@${string}.${"com" | "org" | "net"}`
 *
 * // Use with type annotations
 * const validateEmail = (input: unknown): EmailPattern => {
 *   return Schema.decodeUnknownSync(emailSchema)(input)
 * }
 * ```
 *
 * @example Complex template literal patterns
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Multi-part template with nested schemas
 * const logEntrySchema = Schema.TemplateLiteral([
 *   "[",
 *   Schema.String, // timestamp
 *   "] ",
 *   Schema.Literals(["INFO", "WARN", "ERROR"]), // level
 *   ": ",
 *   Schema.String // message
 * ])
 *
 * // Validate log entries
 * const parseLogEntry = Schema.decodeUnknownSync(logEntrySchema)
 * const entry = parseLogEntry("[2023-01-01T10:00:00Z] INFO: System started")
 * console.log(entry) // "[2023-01-01T10:00:00Z] INFO: System started"
 *
 * // Access schema properties
 * console.log(logEntrySchema.parts.length) // 6
 * ```
 *
 * @example Using template literals in schema composition
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create versioned API endpoint schema
 * const apiEndpointSchema = Schema.TemplateLiteral([
 *   "/api/v",
 *   Schema.Number,
 *   "/",
 *   Schema.String
 * ])
 *
 * // Use in a larger schema
 * const requestSchema = Schema.Struct({
 *   endpoint: apiEndpointSchema,
 *   method: Schema.Literals(["GET", "POST", "PUT", "DELETE"]),
 *   headers: Schema.Record(Schema.String, Schema.String)
 * })
 *
 * // Validate request
 * const parseRequest = Schema.decodeUnknownSync(requestSchema)
 * const request = parseRequest({
 *   endpoint: "/api/v1/users",
 *   method: "GET",
 *   headers: { "Content-Type": "application/json" }
 * })
 * ```
 *
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
 * Creates a schema that validates template literal patterns.
 *
 * Template literals allow you to create schemas that validate strings conforming to specific patterns,
 * similar to TypeScript's template literal types. You can combine literal strings with schema types
 * like String, Number, or BigInt to create flexible validation patterns.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Simple literal template
 * const simpleSchema = Schema.TemplateLiteral(["Hello, ", "World!"])
 * // Type: `Hello, World!`
 *
 * // Template with string interpolation
 * const stringSchema = Schema.TemplateLiteral(["prefix-", Schema.String])
 * // Type: `prefix-${string}`
 *
 * // Template with number interpolation
 * const numberSchema = Schema.TemplateLiteral(["value:", Schema.Number])
 * // Type: `value:${number}`
 *
 * // Complex template with multiple parts
 * const complexSchema = Schema.TemplateLiteral(["user-", Schema.String, "-", Schema.Number])
 * // Type: `user-${string}-${number}`
 *
 * // Template with union types
 * const unionSchema = Schema.TemplateLiteral([
 *   Schema.Union([Schema.Literal("dev"), Schema.Literal("prod")]),
 *   "-",
 *   Schema.String
 * ])
 * // Type: `${("dev" | "prod")}-${string}`
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export function TemplateLiteral<const Parts extends TemplateLiteral.Parts>(parts: Parts): TemplateLiteral<Parts> {
  return new TemplateLiteral$(
    templateLiteralFromParts(parts),
    [...parts] as Parts
  )
}

/**
 * Namespace containing utility types for template literal parsing operations.
 *
 * This namespace provides type-level utilities for working with template literal
 * parsing, including type extraction from template parts and transformation operations.
 * Used in conjunction with the `TemplateLiteralParser` function to provide type safety
 * for template literal string parsing.
 *
 * @example Basic Type Extraction
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Extract types from template literal parts
 * type Parts = readonly ["user:", typeof Schema.String]
 * type Result = Schema.TemplateLiteralParser.Type<Parts>
 * // Result: readonly ["user:", string]
 *
 * // Complex template with multiple schemas
 * type ComplexParts = readonly ["id:", typeof Schema.Number, ",name:", typeof Schema.String]
 * type ComplexResult = Schema.TemplateLiteralParser.Type<ComplexParts>
 * // ComplexResult: readonly ["id:", number, ",name:", string]
 * ```
 *
 * @example Type Transformation for Literals
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Template with literal unions
 * type LiteralParts = readonly ["status:", typeof Schema.Literals<["active", "inactive"]>]
 * type LiteralResult = Schema.TemplateLiteralParser.Type<LiteralParts>
 * // LiteralResult: readonly ["status:", "active" | "inactive"]
 *
 * // Static template parts
 * type StaticParts = readonly ["hello", " ", "world"]
 * type StaticResult = Schema.TemplateLiteralParser.Type<StaticParts>
 * // StaticResult: readonly ["hello", " ", "world"]
 * ```
 *
 * @example Advanced Usage with Parser
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a parser and extract its type
 * const parser = Schema.TemplateLiteralParser(["user:", Schema.String, "-", Schema.Number])
 * type ParserType = Schema.TemplateLiteralParser.Type<typeof parser["parts"]>
 * // ParserType: readonly ["user:", string, "-", number]
 *
 * // Use the type in function signatures
 * const processResult = (result: ParserType): string =>
 *   `User: ${result[1]}, ID: ${result[3]}`
 * ```
 *
 * @category type utilities
 * @since 4.0.0
 */
export declare namespace TemplateLiteralParser {
  /**
   * Extracts the TypeScript type from template literal parts.
   *
   * This type-level utility recursively processes an array of template literal parts
   * to extract the proper types for each component, handling both literal parts
   * (strings, numbers, bigints) and codec types.
   *
   * @example
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Type extraction for literal parts
   * type LiteralParts = readonly ["hello", " ", "world"]
   * type LiteralType = Schema.TemplateLiteralParser.Type<LiteralParts>
   * //   ^? readonly ["hello", " ", "world"]
   *
   * // Type extraction for mixed parts with codecs
   * type MixedParts = readonly ["prefix", Schema.String, "suffix"]
   * type MixedType = Schema.TemplateLiteralParser.Type<MixedParts>
   * //   ^? readonly ["prefix", string, "suffix"]
   *
   * // Type extraction for numeric literals
   * type NumericParts = readonly ["value: ", Schema.Literals<[1, 2, 3]>]
   * type NumericType = Schema.TemplateLiteralParser.Type<NumericParts>
   * //   ^? readonly ["value: ", 1 | 2 | 3]
   *
   * // Conditional type extraction demonstration
   * type ExtractType<T> = T extends readonly [infer Head, ...infer Tail]
   *   ? Head extends string | number | bigint
   *     ? readonly [Head, ...Schema.TemplateLiteralParser.Type<Tail>]
   *     : Head extends Schema.Codec<infer U, unknown, unknown, unknown>
   *     ? readonly [U, ...Schema.TemplateLiteralParser.Type<Tail>]
   *     : never
   *   : readonly []
   *
   * type Example = ExtractType<readonly ["start", Schema.Number, "end"]>
   * //   ^? readonly ["start", number, "end"]
   * ```
   *
   * @category type-level
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
 * Represents a schema that parses template literal strings into structured tuples of their component parts.
 *
 * This interface extends the schema system to handle template literals by parsing them into tuples
 * where each element corresponds to a part of the template literal. The interface preserves the
 * original parts array and provides type-safe parsing of template literal strings.
 *
 * @example Basic interface usage with literal parts
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a parser with only literal parts
 * const literalParser = Schema.TemplateLiteralParser(["hello", " ", "world"])
 *
 * // Access the parts property
 * console.log(literalParser.parts) // ["hello", " ", "world"]
 *
 * // Parse a matching string
 * const result = Schema.decodeUnknownSync(literalParser)("hello world")
 * console.log(result) // ["hello", " ", "world"]
 * ```
 *
 * @example Interface usage with schema parts
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a parser with mixed parts
 * const mixedParser = Schema.TemplateLiteralParser(["user:", Schema.String])
 *
 * // The parts array contains both literals and schemas
 * console.log(mixedParser.parts) // ["user:", Schema.String]
 *
 * // Parse a string with dynamic content
 * const userResult = Schema.decodeUnknownSync(mixedParser)("user:john")
 * console.log(userResult) // ["user:", "john"]
 * ```
 *
 * @example Interface with complex schema parts
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a parser with number and string schemas
 * const complexParser = Schema.TemplateLiteralParser([
 *   "id:",
 *   Schema.Number,
 *   ",name:",
 *   Schema.String
 * ])
 *
 * // Parse complex template patterns
 * const complexResult = Schema.decodeUnknownSync(complexParser)("id:123,name:alice")
 * console.log(complexResult) // ["id:", 123, ",name:", "alice"]
 * ```
 *
 * @example Interface with union schema parts
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a parser with literal union
 * const unionParser = Schema.TemplateLiteralParser([
 *   "status:",
 *   Schema.Literals(["active", "inactive"])
 * ])
 *
 * // Parse strings with union values
 * const statusResult = Schema.decodeUnknownSync(unionParser)("status:active")
 * console.log(statusResult) // ["status:", "active"]
 * ```
 *
 * @example Type-level interface usage
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Function that works with TemplateLiteralParser interface
 * function processParts<P extends Schema.TemplateLiteral.Parts>(
 *   parser: Schema.TemplateLiteralParser<P>
 * ): P {
 *   return parser.parts
 * }
 *
 * // Create different parsers
 * const simpleParser = Schema.TemplateLiteralParser(["hello", Schema.String])
 * const numberParser = Schema.TemplateLiteralParser(["count:", Schema.Number])
 *
 * // Process their parts
 * const simpleParts = processParts(simpleParser) // ["hello", Schema.String]
 * const numberParts = processParts(numberParser) // ["count:", Schema.Number]
 * ```
 *
 * @example Interface with nested template literals
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create nested template literal parsers
 * const innerParser = Schema.TemplateLiteralParser(["inner:", Schema.String])
 * const outerParser = Schema.TemplateLiteralParser([
 *   "outer:",
 *   Schema.TemplateLiteral(["nested:", Schema.Number])
 * ])
 *
 * // Parse nested patterns
 * const outerResult = Schema.decodeUnknownSync(outerParser)("outer:nested:42")
 * console.log(outerResult) // ["outer:", "nested:42"]
 * ```
 *
 * @category models
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
 * Creates a schema that parses template literal strings into structured tuples of their component parts.
 *
 * This function takes an array of template literal parts (strings and schemas) and returns a schema
 * that can parse strings matching the template pattern into a tuple containing the parsed values.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Parse a simple static template
 * const staticParser = Schema.TemplateLiteralParser(["hello", " ", "world"])
 * console.log(Schema.decodeSync(staticParser)("hello world")) // ["hello", " ", "world"]
 *
 * // Parse template with dynamic parts
 * const dynamicParser = Schema.TemplateLiteralParser(["user:", Schema.String])
 * console.log(Schema.decodeSync(dynamicParser)("user:john")) // ["user:", "john"]
 *
 * // Parse template with multiple schemas
 * const multiParser = Schema.TemplateLiteralParser(["id:", Schema.Number, ",name:", Schema.String])
 * console.log(Schema.decodeSync(multiParser)("id:123,name:alice")) // ["id:", 123, ",name:", "alice"]
 *
 * // Parse template with literal unions
 * const unionParser = Schema.TemplateLiteralParser(["status:", Schema.Literals(["active", "inactive"])])
 * console.log(Schema.decodeSync(unionParser)("status:active")) // ["status:", "active"]
 * ```
 *
 * @category constructors
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
 * The `Enums` interface represents a schema for TypeScript enums (both numeric and string enums)
 * as well as const objects used as enums. It provides type-safe validation and serialization
 * for enum values while exposing the original enum object for runtime access.
 *
 * This interface extends the base schema type with an additional `enums` property that
 * contains the original enum object, allowing you to access enum values and keys at runtime.
 *
 * @example Accessing enum values from the schema
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * enum Colors {
 *   Red = "red",
 *   Green = "green",
 *   Blue = "blue"
 * }
 *
 * const schema = Schema.Enums(Colors)
 *
 * // Access enum values through the schema
 * console.log(schema.enums.Red)   // "red"
 * console.log(schema.enums.Green) // "green"
 * console.log(schema.enums.Blue)  // "blue"
 * ```
 *
 * @example Working with numeric enums
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * enum Status {
 *   Pending,
 *   Active,
 *   Inactive
 * }
 *
 * const schema = Schema.Enums(Status)
 *
 * // Access numeric enum values
 * console.log(schema.enums.Pending)  // 0
 * console.log(schema.enums.Active)   // 1
 * console.log(schema.enums.Inactive) // 2
 *
 * // Use in validation
 * const result = Schema.decodeUnknownSync(schema)(Status.Active) // Status.Active
 * ```
 *
 * @example Type-level operations with enum schemas
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * enum Priority {
 *   Low = 1,
 *   Medium = 2,
 *   High = 3
 * }
 *
 * const schema = Schema.Enums(Priority)
 *
 * // Extract type information
 * type EnumType = typeof schema.Type    // Priority
 * type EnumValues = typeof schema.enums // { Low: 1, Medium: 2, High: 3 }
 *
 * // Use enum values in logic
 * const isHighPriority = (value: EnumType): boolean =>
 *   value === schema.enums.High
 * ```
 *
 * @example Using with const objects as enums
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const Direction = {
 *   North: "north",
 *   South: "south",
 *   East: "east",
 *   West: "west"
 * } as const
 *
 * const schema = Schema.Enums(Direction)
 *
 * // Access const object values
 * console.log(schema.enums.North) // "north"
 * console.log(schema.enums.South) // "south"
 *
 * // Validate against const object values
 * const direction = Schema.decodeUnknownSync(schema)("north") // "north"
 * ```
 *
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
 * Creates a schema for TypeScript enums (both numeric and string enums), as well as const objects used as enums.
 * This function automatically handles the different enum types and provides proper validation and serialization.
 *
 * @example Numeric Enum
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * enum Fruits {
 *   Apple,
 *   Banana,
 *   Orange
 * }
 *
 * const schema = Schema.Enums(Fruits)
 *
 * // Decoding succeeds with enum values and their underlying values
 * Schema.decodeUnknownSync(schema)(Fruits.Apple) // Fruits.Apple (0)
 * Schema.decodeUnknownSync(schema)(0) // 0 (same as Fruits.Apple)
 * Schema.decodeUnknownSync(schema)(1) // 1 (same as Fruits.Banana)
 * ```
 *
 * @example String Enum
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * enum Colors {
 *   Red = "red",
 *   Green = "green",
 *   Blue = "blue"
 * }
 *
 * const schema = Schema.Enums(Colors)
 *
 * // Decoding succeeds with enum values and their underlying strings
 * Schema.decodeUnknownSync(schema)(Colors.Red) // Colors.Red ("red")
 * Schema.decodeUnknownSync(schema)("red") // "red" (same as Colors.Red)
 * Schema.decodeUnknownSync(schema)("green") // "green" (same as Colors.Green)
 * ```
 *
 * @example Mixed Enum
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * enum Mixed {
 *   StringValue = "string",
 *   NumericValue = 42,
 *   DefaultValue // This will be 43 (42 + 1)
 * }
 *
 * const schema = Schema.Enums(Mixed)
 *
 * // Accepts both the enum values and their underlying values
 * Schema.decodeUnknownSync(schema)(Mixed.StringValue) // Mixed.StringValue ("string")
 * Schema.decodeUnknownSync(schema)("string") // "string"
 * Schema.decodeUnknownSync(schema)(42) // 42
 * Schema.decodeUnknownSync(schema)(43) // 43
 * ```
 *
 * @example Const Object as Enum
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const Status = {
 *   Pending: "pending",
 *   Success: "success",
 *   Error: "error"
 * } as const
 *
 * const schema = Schema.Enums(Status)
 *
 * // Works with const objects treated as enums
 * Schema.decodeUnknownSync(schema)(Status.Pending) // "pending"
 * Schema.decodeUnknownSync(schema)("success") // "success"
 *
 * // Access to original enum object
 * console.log(schema.enums.Pending) // "pending"
 * ```
 *
 * @category constructors
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
 * The `Never` interface represents a schema for the `never` type that represents values that never occur.
 *
 * The `never` type is useful for:
 * - Expressing impossible or unreachable states
 * - Creating exhaustive type checks
 * - Representing optional fields that should never be present
 * - Type-level computations that result in impossible values
 * - Union elimination in conditional types
 * - Encoding semantic restrictions at the type level
 *
 * @example Basic Usage - Schema that Always Fails
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Creating a Never schema - this will always fail validation
 * const schema = Schema.Never
 *
 * // Attempting to decode any value will always fail
 * try {
 *   Schema.decodeUnknownSync(schema)(null)
 * } catch (error) {
 *   console.log("Validation failed as expected")
 * }
 * ```
 *
 * @example Exhaustive Type Checking
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * type Color = "red" | "green" | "blue"
 *
 * const checkColor = (color: Color): string => {
 *   switch (color) {
 *     case "red":
 *       return "Red color"
 *     case "green":
 *       return "Green color"
 *     case "blue":
 *       return "Blue color"
 *     default:
 *       // This should never happen - color is of type never here
 *       const _exhaustive: never = color
 *       return Schema.decodeUnknownSync(Schema.Never)(_exhaustive)
 *   }
 * }
 * ```
 *
 * @example Optional Fields that Should Never Be Present
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Define a schema where deprecated field should never be present
 * const userSchema = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String,
 *   deprecated: Schema.optionalKey(Schema.Never)
 * })
 *
 * // This validates successfully (deprecated field is omitted)
 * const validUser = { id: 1, name: "John" }
 * const result = Schema.decodeUnknownSync(userSchema)(validUser)
 * console.log(result) // { id: 1, name: "John" }
 *
 * // Including the deprecated field would cause validation to fail
 * const invalidUser = { id: 1, name: "John", deprecated: "anything" }
 * try {
 *   Schema.decodeUnknownSync(userSchema)(invalidUser)
 * } catch (error) {
 *   console.log("Validation failed for deprecated field")
 * }
 * ```
 *
 * @example Type-Level Assertions with Never
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Never is useful for type-level exhaustive checking
 * type Status = "pending" | "success" | "error"
 *
 * const assertExhaustive = (value: never): never => {
 *   Schema.decodeUnknownSync(Schema.Never)(value)
 *   throw new Error("This should never be reached")
 * }
 *
 * const processStatus = (status: Status): string => {
 *   switch (status) {
 *     case "pending":
 *       return "Processing..."
 *     case "success":
 *       return "Completed successfully"
 *     case "error":
 *       return "Failed with error"
 *     default:
 *       // TypeScript ensures this is never
 *       return assertExhaustive(status)
 *   }
 * }
 * ```
 *
 * @example Conditional Schema Creation
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Never can be used to eliminate unwanted branches in conditional logic
 * const shouldAllowValue = false
 *
 * const conditionalSchema = shouldAllowValue
 *   ? Schema.String
 *   : Schema.Never
 *
 * // When shouldAllowValue is false, the schema becomes Never
 * try {
 *   Schema.decodeUnknownSync(conditionalSchema)("test")
 * } catch (error) {
 *   console.log("Validation failed - Never schema rejects all values")
 * }
 *
 * // Demonstrating practical usage with optional validation
 * const createValidationSchema = (enableValidation: boolean) => {
 *   return enableValidation ? Schema.String : Schema.Never
 * }
 *
 * const enabledSchema = createValidationSchema(true)
 * const disabledSchema = createValidationSchema(false)
 *
 * console.log(Schema.decodeUnknownSync(enabledSchema)("valid")) // "valid"
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export interface Never extends Bottom<never, never, never, never, AST.NeverKeyword, Never, Annotations.Bottom<never>> {}

/**
 * A schema for the `never` type that represents values that never occur.
 *
 * The `never` type is useful for:
 * - Expressing impossible or unreachable states
 * - Creating exhaustive type checks
 * - Representing optional fields that should never be present
 * - Type-level computations that result in impossible values
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Basic usage - this schema will always fail validation
 * const schema = Schema.Never
 *
 * // This will always throw since no value can be of type never
 * // Schema.decodeUnknownSync(schema)(null) // throws ParseError
 *
 * // Using Never for optional fields that should never be present
 * const optionalNeverSchema = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String,
 *   deprecated: Schema.optionalKey(Schema.Never)
 * })
 *
 * // Valid: the deprecated field is omitted
 * const validData = { id: 1, name: "test" }
 * const result = Schema.decodeUnknownSync(optionalNeverSchema)(validData)
 * // result: { id: 1, name: "test" }
 *
 * // Invalid: attempting to include the deprecated field would fail
 * // const invalidData = { id: 1, name: "test", deprecated: "anything" }
 * // Schema.decodeUnknownSync(optionalNeverSchema)(invalidData) // throws ParseError
 * ```
 *
 * @since 4.0.0
 * @category primitives
 */
export const Never: Never = make<Never>(AST.neverKeyword)

/**
 * Represents the interface for the `any` schema type.
 *
 * This interface extends the `Bottom` interface to provide type-safe access to
 * schemas that accept any value without type checking. The `Any` interface is
 * useful when you need maximum flexibility or are migrating from untyped code.
 *
 * The interface allows type-level operations while maintaining runtime flexibility
 * for values that can be of any type.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Using the Any interface for type annotations
 * const processAnySchema = (schema: Schema.Any) => {
 *   // Type-safe operations on the schema interface
 *   const decoded = Schema.decodeUnknownSync(schema)("any value")
 *   return decoded
 * }
 *
 * // Works with the Any schema
 * const result = processAnySchema(Schema.Any)
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Interface usage in function signatures
 * const validateWithAny = (schema: Schema.Any, input: unknown) => {
 *   try {
 *     const result = Schema.decodeUnknownSync(schema)(input)
 *     return { success: true, data: result }
 *   } catch (error) {
 *     return { success: false, error }
 *   }
 * }
 *
 * // Type-safe usage
 * const validation = validateWithAny(Schema.Any, { complex: "data" })
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Using Any interface in generic contexts
 * const createFlexibleSchema = <T extends Schema.Any>(baseSchema: T) => {
 *   return Schema.Struct({
 *     id: Schema.String,
 *     data: baseSchema,
 *     metadata: Schema.Any
 *   })
 * }
 *
 * // Creates a schema with flexible data field
 * const flexibleSchema = createFlexibleSchema(Schema.Any)
 * ```
 *
 * @category models
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
 * The `Null` interface represents a schema for the `null` primitive type in TypeScript.
 *
 * This interface extends the base `Bottom` interface and provides type-safe handling
 * of null values. It's commonly used in data validation, API schemas, and type-safe
 * operations where null values are expected or need to be handled explicitly.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Basic null schema validation
 * const nullSchema: Schema.Null = Schema.Null
 *
 * // Type extraction from interface
 * type NullType = Schema.Null["Type"]  // null
 * type NullEncoded = Schema.Null["Encoded"]  // null
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Using Null in composite schemas
 * const UserSchema = Schema.Struct({
 *   name: Schema.String,
 *   avatar: Schema.Union([Schema.String, Schema.Null])
 * })
 *
 * // Type-safe null handling
 * type User = typeof UserSchema.Type
 * // { readonly name: string; readonly avatar: string | null }
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Creating nullable schemas with NullOr
 * const nullableString: Schema.NullOr<Schema.String> = Schema.NullOr(Schema.String)
 *
 * // Interface type compatibility
 * const processNullable = (schema: Schema.Null) => {
 *   return schema.ast._tag === "NullKeyword"
 * }
 *
 * console.log(processNullable(Schema.Null))  // true
 * ```
 *
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
 * Represents the schema interface for the `undefined` primitive type.
 *
 * The `Undefined` interface extends the `Bottom` interface and provides type-safe
 * schema operations for validating `undefined` values. This is particularly useful
 * for optional fields and representing the absence of a value.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Using the Undefined schema interface
 * const schema: Schema.Undefined = Schema.Undefined
 *
 * // Type-safe validation
 * Schema.decodeUnknownSync(schema)(undefined)  // undefined
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Using Undefined in optional fields
 * const UserSchema = Schema.Struct({
 *   name: Schema.String,
 *   nickname: Schema.UndefinedOr(Schema.String)
 * })
 *
 * const user = Schema.decodeUnknownSync(UserSchema)({
 *   name: "John",
 *   nickname: undefined
 * })
 * // { name: "John", nickname: undefined }
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Type guards using Undefined interface
 * const isUndefined = Schema.is(Schema.Undefined)
 *
 * console.log(isUndefined(undefined))  // true
 * console.log(isUndefined(null))       // false
 * console.log(isUndefined(0))          // false
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Using Undefined in union types
 * const OptionalValueSchema = Schema.Union([
 *   Schema.String,
 *   Schema.Number,
 *   Schema.Undefined
 * ])
 *
 * Schema.decodeUnknownSync(OptionalValueSchema)("hello")    // "hello"
 * Schema.decodeUnknownSync(OptionalValueSchema)(42)         // 42
 * Schema.decodeUnknownSync(OptionalValueSchema)(undefined)  // undefined
 * ```
 *
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
 * The `Void` interface represents a schema for the `void` primitive type.
 *
 * The `void` type represents the absence of a value. In JavaScript/TypeScript,
 * `void` is typically used for functions that don't return a value, but in
 * schema validation, it specifically validates that a value is `undefined`.
 *
 * @example Basic usage
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.Void
 *
 * // Valid void values
 * Schema.decodeUnknownSync(schema)(undefined)  // undefined
 * ```
 *
 * @example Usage in structures
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // API response with no data
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
 * @example Type guards and validation
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const isVoid = Schema.is(Schema.Void)
 *
 * console.log(isVoid(undefined))  // true
 * console.log(isVoid(null))       // false
 * console.log(isVoid(""))         // false
 * ```
 *
 * @category Api interface
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
 * Schema interface for validating specific unique symbol values.
 *
 * This interface represents a schema that can validate whether an input value
 * is exactly the symbol specified in the type parameter. It extends the base
 * schema interface with specific typing for symbol validation.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Define a unique symbol
 * const API_KEY = Symbol("API_KEY")
 *
 * // Create a schema for this specific symbol
 * const ApiKeySchema: Schema.UniqueSymbol<typeof API_KEY> = Schema.UniqueSymbol(API_KEY)
 *
 * // Type-level validation - both input and output types are the same symbol
 * type AcceptedType = typeof API_KEY // The schema only accepts this specific symbol
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface UniqueSymbol<sym extends symbol>
  extends Bottom<sym, sym, never, never, AST.UniqueSymbol, UniqueSymbol<sym>, Annotations.Bottom<sym>>
{}

/**
 * Creates a schema for a specific unique symbol.
 *
 * This schema validates that the input is exactly the provided symbol value, not
 * just any symbol. It's useful for type-safe validation of unique symbols used
 * as constants or identifiers.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a unique symbol
 * const MySymbol = Symbol("MySymbol")
 * const AnotherSymbol = Symbol("AnotherSymbol")
 *
 * // Create a schema for the specific symbol
 * const MySymbolSchema = Schema.UniqueSymbol(MySymbol)
 *
 * // Decoding succeeds with the exact symbol
 * const result = Schema.decodeUnknownSync(MySymbolSchema)(MySymbol)
 * console.log(result === MySymbol) // true
 *
 * // Decoding fails with a different symbol
 * const failResult = Schema.decodeUnknownSync(MySymbolSchema)(AnotherSymbol)
 * // throws ParseError: Expected Symbol(MySymbol), actual Symbol(AnotherSymbol)
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Effect } from "effect"
 *
 * // Using with Effect for async validation
 * const APP_CONFIG = Symbol("APP_CONFIG")
 * const ConfigSymbolSchema = Schema.UniqueSymbol(APP_CONFIG)
 *
 * const validateConfigSymbol = (input: unknown) =>
 *   Effect.gen(function* () {
 *     const validated = yield* Schema.decodeUnknownEffect(ConfigSymbolSchema)(input)
 *     console.log("Valid config symbol:", validated.toString())
 *     return validated
 *   })
 *
 * // Usage
 * const program = Effect.gen(function* () {
 *   const validSymbol = yield* validateConfigSymbol(APP_CONFIG)
 *   return validSymbol
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export function UniqueSymbol<const sym extends symbol>(symbol: sym): UniqueSymbol<sym> {
  return make<UniqueSymbol<sym>>(new AST.UniqueSymbol(symbol))
}

/**
 * A namespace providing type-level utilities for working with struct schemas and field definitions.
 *
 * The `Struct` namespace contains type utilities for extracting and manipulating struct field types,
 * handling optionality and mutability at the type level, and working with struct transformations.
 * It's used internally by the Schema library for struct operations and can be used for advanced
 * type-level programming with struct schemas.
 *
 * @example Basic struct field type extraction
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number,
 *   email: Schema.optional(Schema.String)
 * })
 *
 * // Extract the field types
 * type PersonFields = typeof PersonSchema.fields
 * // PersonFields: {
 * //   readonly name: Schema.String
 * //   readonly age: Schema.Number
 * //   readonly email: Schema.optional<Schema.String>
 * // }
 *
 * // Extract the resulting type
 * type PersonType = Schema.Struct.Type<PersonFields>
 * // PersonType: { name: string; age: number; email?: string }
 * ```
 *
 * @example Working with struct transformations using mapFields
 * ```ts
 * import { Struct } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const OriginalSchema = Schema.Struct({
 *   firstName: Schema.String,
 *   lastName: Schema.String,
 *   age: Schema.Number
 * })
 *
 * // Pick only specific fields
 * const NameOnlySchema = OriginalSchema.mapFields(
 *   Struct.pick(["firstName", "lastName"])
 * )
 *
 * // Add new fields
 * const ExtendedSchema = OriginalSchema.mapFields(
 *   Struct.merge({ email: Schema.String })
 * )
 *
 * // Transform field values to optional
 * const OptionalSchema = OriginalSchema.mapFields(
 *   Struct.map(Schema.optionalKey)
 * )
 * ```
 *
 * @example Advanced field manipulation
 * ```ts
 * import { String, Struct } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const UserSchema = Schema.Struct({
 *   id: Schema.Number,
 *   username: Schema.String,
 *   password: Schema.String
 * })
 *
 * // Rename keys
 * const RenamedSchema = UserSchema.mapFields(
 *   Struct.renameKeys({ username: "name" })
 * )
 *
 * // Evolve specific fields to optional
 * const EvolvedSchema = UserSchema.mapFields(
 *   Struct.evolve({
 *     password: (v) => Schema.optionalKey(v)
 *   })
 * )
 *
 * // Transform keys with functions
 * const UppercaseKeysSchema = UserSchema.mapFields(
 *   Struct.evolveKeys({
 *     username: (key) => String.toUpperCase(key)
 *   })
 * )
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export declare namespace Struct {
  /**
   * Represents a field type that can be used in struct definitions.
   * A field is any schema that extends the `Top` interface, allowing for
   * comprehensive type safety and validation in struct field definitions.
   *
   * @example
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Define field types for a struct
   * type NameField = Schema.Struct.Field // Schema.Top
   * type AgeField = Schema.Struct.Field   // Schema.Top
   *
   * // Use fields in struct definitions
   * const PersonSchema = Schema.Struct({
   *   name: Schema.String,    // This is a Struct.Field
   *   age: Schema.Number,     // This is a Struct.Field
   *   email: Schema.String    // This is a Struct.Field
   * })
   *
   * // Fields can include transformations and constraints
   * const UserSchema = Schema.Struct({
   *   id: Schema.FiniteFromString,                      // Struct.Field with transformation
   *   name: Schema.NonEmptyString,                      // Struct.Field with constraint
   *   email: Schema.String.pipe(Schema.optionalKey),   // Struct.Field with optionality
   *   role: Schema.Literal("admin")                    // Struct.Field with literal type
   * })
   * ```
   *
   * @category models
   * @since 4.0.0
   */
  export type Field = Top

  /**
   * Represents a collection of field definitions for creating struct schemas.
   * This type defines the shape of an object where each property key maps to a
   * schema field, providing the foundation for type-safe struct construction.
   *
   * The `Fields` type is used as the constraint for the `Struct` constructor,
   * ensuring that all field values are valid schema types that extend `Top`.
   * It enables comprehensive type inference and validation for struct schemas.
   *
   * @example Basic struct fields definition
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Define a basic fields collection
   * const personFields = {
   *   name: Schema.String,
   *   age: Schema.Number,
   *   email: Schema.String
   * } as const satisfies Schema.Struct.Fields
   *
   * // Use the fields to create a struct schema
   * const PersonSchema = Schema.Struct(personFields)
   *
   * // Extract the fields type
   * type PersonFields = typeof personFields
   * // PersonFields: {
   * //   readonly name: Schema.String;
   * //   readonly age: Schema.Number;
   * //   readonly email: Schema.String;
   * // }
   * ```
   *
   * @example Fields with optional and transformed schemas
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Define fields with various schema types
   * const userFields = {
   *   id: Schema.String.pipe(Schema.decodeTo(Schema.Number)),
   *   username: Schema.NonEmptyString,
   *   email: Schema.optionalKey(Schema.String),
   *   verified: Schema.optional(Schema.Boolean),
   *   role: Schema.Literals(["admin", "user", "guest"]),
   *   metadata: Schema.Record(Schema.String, Schema.Unknown)
   * } as const satisfies Schema.Struct.Fields
   *
   * const UserSchema = Schema.Struct(userFields)
   *
   * // Extract and use field types
   * type UserFields = typeof userFields
   * type UserType = Schema.Struct.Type<UserFields>
   * // UserType: {
   * //   readonly id: number;
   * //   readonly username: string;
   * //   readonly email?: string;
   * //   readonly verified?: boolean;
   * //   readonly role: "admin" | "user" | "guest";
   * //   readonly metadata: { readonly [x: string]: unknown };
   * // }
   * ```
   *
   * @example Generic functions with Fields constraint
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Function that accepts any valid fields collection
   * function createStructWithValidation<F extends Schema.Struct.Fields>(
   *   fields: F
   * ): Schema.Struct<F> {
   *   return Schema.Struct(fields)
   * }
   *
   * // Usage with type inference
   * const productFields = {
   *   name: Schema.String,
   *   price: Schema.String.pipe(Schema.decodeTo(Schema.Number)),
   *   tags: Schema.Array(Schema.String)
   * } as const
   *
   * const ProductSchema = createStructWithValidation(productFields)
   * // Type is inferred as Schema.Struct<typeof productFields>
   * ```
   *
   * @example Working with Fields in mapFields operations
   * ```ts
   * import { Schema } from "effect/schema"
   * import { Struct } from "effect"
   *
   * const originalFields = {
   *   firstName: Schema.String,
   *   lastName: Schema.String,
   *   age: Schema.Number
   * } as const satisfies Schema.Struct.Fields
   *
   * const OriginalSchema = Schema.Struct(originalFields)
   *
   * // Transform fields collection using mapFields
   * const OptionalSchema = OriginalSchema.mapFields(
   *   Struct.map(Schema.optional)
   * )
   *
   * // Pick subset of fields
   * const NameOnlySchema = OriginalSchema.mapFields(
   *   Struct.pick(["firstName", "lastName"])
   * )
   *
   * // Add new fields to existing collection
   * const ExtendedSchema = OriginalSchema.mapFields(
   *   Struct.merge({
   *     email: Schema.String,
   *     phone: Schema.optionalKey(Schema.String)
   *   })
   * )
   * ```
   *
   * @category models
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
   * Extracts the type representation from a struct's fields definition.
   *
   * This type utility constructs the TypeScript type of a struct by extracting
   * the `Type` property from each field and respecting the type mutability and
   * optionality settings of each field. This is essential for struct type extraction
   * and type-level operations where you need to derive the final TypeScript type
   * from schema field definitions.
   *
   * @example Basic struct with type extraction
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Basic struct with type extraction
   * const PersonSchema = Schema.Struct({
   *   name: Schema.String,
   *   age: Schema.Number
   * })
   *
   * // Extract type - useful for type-level operations
   * type PersonType = Schema.Struct.Type<typeof PersonSchema.fields>
   * // PersonType is { readonly name: string; readonly age: number }
   * ```
   *
   * @example Struct with optional and mutable fields
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Struct with optional and mutable fields
   * const UserSchema = Schema.Struct({
   *   id: Schema.Number,
   *   name: Schema.String,
   *   email: Schema.optional(Schema.String),
   *   tags: Schema.mutableKey(Schema.Array(Schema.String))
   * })
   *
   * // Extract the type for the struct fields
   * type UserType = Schema.Struct.Type<typeof UserSchema.fields>
   * // UserType is {
   * //   readonly id: number;
   * //   readonly name: string;
   * //   readonly email?: string;
   * //   tags: readonly string[];
   * // }
   * ```
   *
   * @example Advanced struct with nested fields and type extraction
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Advanced struct with nested fields
   * const ProductSchema = Schema.Struct({
   *   name: Schema.String,
   *   price: Schema.Number,
   *   available: Schema.Boolean,
   *   metadata: Schema.optional(Schema.Unknown),
   *   category: Schema.Struct({
   *     id: Schema.Number,
   *     name: Schema.String
   *   })
   * })
   *
   * // Extract type for type-level validation
   * type ProductType = Schema.Struct.Type<typeof ProductSchema.fields>
   * // ProductType is {
   * //   readonly name: string;
   * //   readonly price: number;
   * //   readonly available: boolean;
   * //   readonly metadata?: unknown;
   * //   readonly category: {
   * //     readonly id: number;
   * //     readonly name: string;
   * //   };
   * // }
   *
   * // Use in conditional type checks
   * type IsValidProductType<T> = T extends ProductType ? true : false
   * type Test1 = IsValidProductType<{ name: string; price: number; available: boolean; category: { id: number; name: string } }> // true
   * type Test2 = IsValidProductType<{ name: number }> // false
   * ```
   *
   * @since 4.0.0
   * @category type extractors
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
   * Extracts the encoded type from a struct's fields definition.
   *
   * This type utility constructs the encoded representation of a struct by extracting
   * the `Encoded` type from each field and respecting the encoded mutability and
   * optionality settings of each field.
   *
   * @example
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Basic struct with encoded type extraction
   * const PersonSchema = Schema.Struct({
   *   name: Schema.String,
   *   age: Schema.FiniteFromString
   * })
   *
   * // Extract encoded type - useful for type-level operations
   * type PersonEncoded = Schema.Struct.Encoded<typeof PersonSchema.fields>
   * // PersonEncoded is { readonly name: string; readonly age: string }
   * ```
   *
   * @example
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Struct with optional and transformable fields
   * const UserSchema = Schema.Struct({
   *   id: Schema.FiniteFromString,
   *   email: Schema.String,
   *   verified: Schema.optional(Schema.Boolean),
   *   metadata: Schema.optional(Schema.UnknownFromJsonString)
   * })
   *
   * // Extract the encoded type for the struct fields
   * type UserEncoded = Schema.Struct.Encoded<typeof UserSchema.fields>
   * // UserEncoded is {
   * //   readonly id: string;
   * //   readonly email: string;
   * //   readonly verified?: boolean;
   * //   readonly metadata?: string;
   * // }
   *
   * // Use the encoded type for serialization logic
   * const serializeUser = (user: UserEncoded): string => {
   *   return JSON.stringify(user)
   * }
   * ```
   *
   * @example
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Advanced struct with nested transformations
   * const ProductSchema = Schema.Struct({
   *   name: Schema.String,
   *   price: Schema.FiniteFromString,
   *   tags: Schema.Array(Schema.String),
   *   createdAt: Schema.Date,
   *   category: Schema.Struct({
   *     id: Schema.FiniteFromString,
   *     name: Schema.String
   *   })
   * })
   *
   * // Extract encoded type for type-level validation
   * type ProductEncoded = Schema.Struct.Encoded<typeof ProductSchema.fields>
   * // ProductEncoded is {
   * //   readonly name: string;
   * //   readonly price: string;
   * //   readonly tags: readonly string[];
   * //   readonly createdAt: Date;
   * //   readonly category: {
   * //     readonly id: string;
   * //     readonly name: string;
   * //   };
   * // }
   *
   * // Use in conditional type checks
   * type IsValidProductEncoded<T> = T extends ProductEncoded ? true : false
   * type Test1 = IsValidProductEncoded<{ name: string; price: string; tags: string[]; createdAt: Date; category: { id: string; name: string } }> // true
   * type Test2 = IsValidProductEncoded<{ name: number }> // false
   * ```
   *
   * @since 4.0.0
   * @category type extractors
   */
  export type Encoded<F extends Fields> = Encoded_<F>

  /**
   * Extracts the union of all service dependencies required for decoding operations from struct fields.
   *
   * This type utility aggregates all the services that need to be provided in the Effect context
   * when performing decoding operations on a struct schema. It creates a union of all the
   * `DecodingServices` types from each field in the struct, ensuring that all necessary
   * dependencies are captured at the type level.
   *
   * @example Basic struct with no service dependencies
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Simple struct with primitive fields
   * const PersonFields = {
   *   name: Schema.String,
   *   age: Schema.Number,
   *   email: Schema.String
   * }
   *
   * type PersonServices = Schema.Struct.DecodingServices<typeof PersonFields>
   * // type PersonServices = never (no services required)
   * ```
   *
   * @example Struct with transformation fields
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Struct with transformation that might require services
   * const UserFields = {
   *   id: Schema.String,
   *   createdAt: Schema.String.pipe(Schema.decodeTo(Schema.Date)),
   *   count: Schema.String.pipe(Schema.decodeTo(Schema.Number))
   * }
   *
   * type UserServices = Schema.Struct.DecodingServices<typeof UserFields>
   * // type UserServices = never (built-in transformations don't require services)
   * ```
   *
   * @example Using with conditional service requirements
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Create struct field types for analysis
   * const OrderFields = {
   *   orderId: Schema.String,
   *   amount: Schema.Number,
   *   status: Schema.String
   * }
   *
   * // Extract service dependencies from fields
   * type OrderServices = Schema.Struct.DecodingServices<typeof OrderFields>
   * // type OrderServices = never
   *
   * // Use for type-level validation
   * type RequiresServices = OrderServices extends never ? false : true
   * // type RequiresServices = false
   * ```
   *
   * @category type extractors
   * @since 4.0.0
   */
  export type DecodingServices<F extends Fields> = { readonly [K in keyof F]: F[K]["DecodingServices"] }[keyof F]

  /**
   * Extracts and aggregates the service dependencies required for encoding operations
   * from all fields in a struct schema.
   *
   * This type utility examines each field in a struct and collects all the
   * encoding service dependencies into a union type. It's particularly useful
   * for understanding what external services need to be provided when encoding
   * (serializing, transforming) a struct schema and its nested field schemas.
   *
   * @example Basic struct encoding services extraction
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Simple struct with no service dependencies
   * const PersonFields = {
   *   name: Schema.String,
   *   age: Schema.Number,
   *   email: Schema.String
   * } as const
   *
   * type PersonEncodingServices = Schema.Struct.EncodingServices<typeof PersonFields>
   * // type PersonEncodingServices = never
   * ```
   *
   * @example Mixed struct with encoding service dependencies
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Create field schemas with different service requirements
   * const UserFields = {
   *   id: Schema.Number,                          // No services required
   *   name: Schema.String,                        // No services required
   *   profilePicture: Schema.String,              // No services required
   *   timestamps: Schema.Date                     // No services required
   * } as const
   *
   * type UserEncodingServices = Schema.Struct.EncodingServices<typeof UserFields>
   * // type UserEncodingServices = never
   * ```
   *
   * @example Struct with complex nested encoding requirements
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Define fields with potential encoding transformations
   * const ComplexFields = {
   *   metadata: Schema.Record(
   *     Schema.String,
   *     Schema.Unknown
   *   ),                                         // No services required
   *   tags: Schema.Array(Schema.String),          // No services required
   *   config: Schema.Struct({
   *     enabled: Schema.Boolean,
   *     timeout: Schema.Number
   *   })                                          // No services required
   * } as const
   *
   * type ComplexEncodingServices = Schema.Struct.EncodingServices<typeof ComplexFields>
   * // type ComplexEncodingServices = never
   * ```
   *
   * @example Type-level service dependency analysis
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Utility type to check if encoding requires services
   * type RequiresEncodingServices<F extends Schema.Struct.Fields> =
   *   Schema.Struct.EncodingServices<F> extends never
   *     ? "No encoding services required"
   *     : "Encoding services required"
   *
   * // Analyze different field configurations
   * const SimpleFields = {
   *   name: Schema.String,
   *   count: Schema.Number
   * } as const
   *
   * type SimpleRequirement = RequiresEncodingServices<typeof SimpleFields>
   * // type SimpleRequirement = "No encoding services required"
   *
   * // Use in conditional type logic for service requirements
   * type ConditionalEncoding<F extends Schema.Struct.Fields> =
   *   Schema.Struct.EncodingServices<F> extends never
   *     ? { type: "simple"; fields: F }
   *     : { type: "complex"; fields: F; services: Schema.Struct.EncodingServices<F> }
   * ```
   *
   * @category type extractors
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
   * Represents the input type required for constructing struct instances using the `makeSync` method.
   * This type utility extracts the appropriate input types needed to create instances of structs,
   * handling optional fields, mutable fields, and fields with constructor defaults.
   *
   * The `MakeIn` type is particularly useful for type-level operations and ensuring type safety
   * when constructing struct instances. It automatically determines which fields are required,
   * optional, or have defaults in the constructor input.
   *
   * @example Basic struct construction input types
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Define a struct with different field types
   * const PersonSchema = Schema.Struct({
   *   name: Schema.String,
   *   age: Schema.Number,
   *   email: Schema.optional(Schema.String)
   * })
   *
   * // Extract the MakeIn type for construction
   * type PersonMakeIn = Schema.Struct.MakeIn<typeof PersonSchema.fields>
   * // PersonMakeIn: { readonly name: string; readonly age: number; readonly email?: string }
   *
   * // Use makeSync with the correct input type
   * const person = PersonSchema.makeSync({
   *   name: "Alice",
   *   age: 30,
   *   email: "alice@example.com"
   * })
   * ```
   *
   * @example Struct with optional fields and make input types
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Define struct with mixed field requirements
   * const UserConfigSchema = Schema.Struct({
   *   username: Schema.String,
   *   email: Schema.String,
   *   theme: Schema.optional(Schema.String),
   *   notifications: Schema.optional(Schema.Boolean)
   * })
   *
   * // Extract MakeIn type - shows constructor input requirements
   * type ConfigMakeIn = Schema.Struct.MakeIn<typeof UserConfigSchema.fields>
   * // ConfigMakeIn: {
   * //   readonly username: string      // required
   * //   readonly email: string         // required
   * //   readonly theme?: string        // optional
   * //   readonly notifications?: boolean // optional
   * // }
   *
   * // Valid construction patterns - only required fields needed
   * const config1 = UserConfigSchema.makeSync({
   *   username: "user1",
   *   email: "user1@example.com"
   * })
   *
   * const config2 = UserConfigSchema.makeSync({
   *   username: "user2",
   *   email: "user2@example.com",
   *   theme: "dark",
   *   notifications: true
   * })
   * ```
   *
   * @example Type-level conditional extraction for MakeIn
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Helper type to extract MakeIn from any struct schema
   * type ExtractMakeIn<T> = T extends Schema.Struct<infer F>
   *   ? Schema.Struct.MakeIn<F>
   *   : never
   *
   * // Use with different struct schemas
   * const ProductSchema = Schema.Struct({
   *   id: Schema.Number,
   *   name: Schema.String,
   *   price: Schema.Number,
   *   category: Schema.optional(Schema.String)
   * })
   *
   * type ProductMakeIn = ExtractMakeIn<typeof ProductSchema>
   * // ProductMakeIn: { readonly id: number; readonly name: string; readonly price: number; readonly category?: string }
   * ```
   *
   * @category type-level
   * @since 4.0.0
   */
  export type MakeIn<F extends Fields> = MakeIn_<F>
}

/**
 * Represents a structured schema that defines object shapes with typed fields.
 * The `Struct` interface provides comprehensive type safety for object validation,
 * encoding/decoding, and construction with support for optional fields, transformations,
 * and field manipulation through the `mapFields` method.
 *
 * @example Basic struct definition and usage
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Define a user schema with basic fields
 * const UserSchema = Schema.Struct({
 *   id: Schema.String,
 *   name: Schema.String,
 *   age: Schema.Number,
 *   email: Schema.String
 * })
 *
 * // Create a user instance
 * const user = UserSchema.makeSync({
 *   id: "123",
 *   name: "John Doe",
 *   age: 30,
 *   email: "john@example.com"
 * })
 *
 * console.log(user)
 * // { id: "123", name: "John Doe", age: 30, email: "john@example.com" }
 * ```
 *
 * @example Struct with optional and mutable fields
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const ProductSchema = Schema.Struct({
 *   id: Schema.String,
 *   name: Schema.String,
 *   description: Schema.optionalKey(Schema.String),
 *   price: Schema.mutableKey(Schema.Number),
 *   inStock: Schema.optionalKey(Schema.mutableKey(Schema.Boolean))
 * })
 *
 * const product = ProductSchema.makeSync({
 *   id: "p-001",
 *   name: "Widget",
 *   price: 29.99
 * })
 *
 * console.log(product)
 * // { id: "p-001", name: "Widget", price: 29.99 }
 * ```
 *
 * @example Accessing and manipulating struct fields
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const PersonSchema = Schema.Struct({
 *   firstName: Schema.String,
 *   lastName: Schema.String,
 *   age: Schema.Number
 * })
 *
 * // Access the fields property
 * const fields = PersonSchema.fields
 * console.log(Object.keys(fields)) // ["firstName", "lastName", "age"]
 *
 * // Transform struct fields using mapFields
 * const UpdatedPersonSchema = PersonSchema.mapFields((currentFields) => ({
 *   ...currentFields,
 *   fullName: Schema.String
 * }))
 * ```
 *
 * @example Struct with transformations and encoding
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const EventSchema = Schema.Struct({
 *   id: Schema.String,
 *   timestamp: Schema.String.pipe(Schema.decodeTo(Schema.Date)),
 *   metadata: Schema.UnknownFromJsonString
 * })
 *
 * // Decode from encoded representation
 * const event = Schema.decodeUnknownSync(EventSchema)({
 *   id: "evt-123",
 *   timestamp: "2023-12-01T10:00:00Z",
 *   metadata: '{"action": "login", "userId": "u-456"}'
 * })
 *
 * console.log(event.timestamp instanceof Date) // true
 * console.log(event.metadata) // { action: "login", userId: "u-456" }
 * ```
 *
 * @example Struct type extraction and validation
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const ConfigSchema = Schema.Struct({
 *   apiUrl: Schema.String,
 *   timeout: Schema.Number,
 *   retries: Schema.Number
 * })
 *
 * // Extract TypeScript types
 * type Config = typeof ConfigSchema.Type
 * // type Config = { readonly apiUrl: string; readonly timeout: number; readonly retries: number }
 *
 * type ConfigEncoded = typeof ConfigSchema.Encoded
 * // type ConfigEncoded = { readonly apiUrl: string; readonly timeout: number; readonly retries: number }
 *
 * // Validate unknown data
 * const config = Schema.decodeUnknownSync(ConfigSchema)({
 *   apiUrl: "https://api.example.com",
 *   timeout: 5000,
 *   retries: 3
 * })
 * ```
 *
 * @category models
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
 * Transforms a struct schema by encoding (renaming) its keys according to a mapping.
 *
 * The `encodeKeys` function creates a transformation that allows you to rename keys
 * in a struct schema. During encoding, the original keys are mapped to new keys
 * according to the provided mapping. During decoding, the process is reversed.
 *
 * @example Basic key encoding
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const Person = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * // Encode 'name' key as 'fullName' and 'age' key as 'years'
 * const PersonWithEncodedKeys = Person.pipe(
 *   Schema.encodeKeys({
 *     name: "fullName",
 *     age: "years"
 *   })
 * )
 *
 * // Decoding: { fullName: "John", years: 30 } -> { name: "John", age: 30 }
 * // Encoding: { name: "John", age: 30 } -> { fullName: "John", years: 30 }
 * ```
 *
 * @example Partial key mapping
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const User = Schema.Struct({
 *   id: Schema.String,
 *   email: Schema.String,
 *   isActive: Schema.Boolean
 * })
 *
 * // Only encode 'isActive' key as 'active', other keys remain unchanged
 * const UserWithEncodedKeys = User.pipe(
 *   Schema.encodeKeys({
 *     isActive: "active"
 *   })
 * )
 *
 * // Decoding: { id: "123", email: "user@example.com", active: true }
 * // -> { id: "123", email: "user@example.com", isActive: true }
 * ```
 *
 * @example Key encoding with transformations
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const Product = Schema.Struct({
 *   name: Schema.String,
 *   price: Schema.FiniteFromString,
 *   inStock: Schema.Boolean
 * })
 *
 * // Encode keys for API compatibility
 * const ProductApi = Product.pipe(
 *   Schema.encodeKeys({
 *     inStock: "in_stock",
 *     price: "price_cents"
 *   })
 * )
 *
 * // The encoded form uses snake_case keys while decoded form uses camelCase
 * // Decoding: { name: "Widget", price_cents: "1999", in_stock: true }
 * // -> { name: "Widget", price: 1999, inStock: true }
 * ```
 *
 * @example Using with complex key mappings
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const DatabaseRecord = Schema.Struct({
 *   userId: Schema.String,
 *   createdAt: Schema.String,
 *   updatedAt: Schema.String
 * })
 *
 * // Map to database column names
 * const DatabaseTable = DatabaseRecord.pipe(
 *   Schema.encodeKeys({
 *     userId: "user_id",
 *     createdAt: "created_at",
 *     updatedAt: "updated_at"
 *   })
 * )
 *
 * // Handles bidirectional transformation between camelCase and snake_case
 * ```
 *
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
 * This function allows you to extend a struct schema by adding new fields that are computed
 * from the original input value during decoding. The new fields are derived using functions
 * that take the input struct and return `Option` values. During encoding, the derived fields
 * are removed from the output.
 *
 * @example Adding computed fields to a user struct
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Option } from "effect"
 *
 * const User = Schema.Struct({
 *   firstName: Schema.String,
 *   lastName: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const UserWithComputed = User.pipe(
 *   Schema.extendTo(
 *     {
 *       fullName: Schema.String,
 *       isAdult: Schema.Boolean
 *     },
 *     {
 *       fullName: (user: { firstName: string; lastName: string; age: number }) => Option.some(`${user.firstName} ${user.lastName}`),
 *       isAdult: (user: { firstName: string; lastName: string; age: number }) => Option.some(user.age >= 18)
 *     }
 *   )
 * )
 *
 * // Decoding: { firstName: "John", lastName: "Doe", age: 25 }
 * // -> { firstName: "John", lastName: "Doe", age: 25, fullName: "John Doe", isAdult: true }
 *
 * // Encoding: { firstName: "John", lastName: "Doe", age: 25, fullName: "John Doe", isAdult: true }
 * // -> { firstName: "John", lastName: "Doe", age: 25 }
 * ```
 *
 * @example Adding discriminated union tags
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Option } from "effect"
 *
 * const Circle = Schema.Struct({
 *   radius: Schema.Number
 * })
 *
 * const Square = Schema.Struct({
 *   sideLength: Schema.Number
 * })
 *
 * const TaggedCircle = Circle.pipe(
 *   Schema.extendTo(
 *     { kind: Schema.Literal("circle") },
 *     { kind: () => Option.some("circle" as const) }
 *   )
 * )
 *
 * const TaggedSquare = Square.pipe(
 *   Schema.extendTo(
 *     { kind: Schema.Literal("square") },
 *     { kind: () => Option.some("square" as const) }
 *   )
 * )
 *
 * const Shape = Schema.Union([TaggedCircle, TaggedSquare])
 *
 * // Decoding: { radius: 5 } -> { radius: 5, kind: "circle" }
 * // Decoding: { sideLength: 3 } -> { sideLength: 3, kind: "square" }
 * ```
 *
 * @example Conditional field extension
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Option } from "effect"
 *
 * const Product = Schema.Struct({
 *   name: Schema.String,
 *   price: Schema.Number,
 *   category: Schema.String
 * })
 *
 * const ProductWithDiscount = Product.pipe(
 *   Schema.extendTo(
 *     {
 *       discountPercentage: Schema.Number,
 *       finalPrice: Schema.Number
 *     },
 *     {
 *       discountPercentage: (product: { name: string; price: number; category: string }) =>
 *         product.category === "electronics" ? Option.some(10) : Option.none(),
 *       finalPrice: (product: { name: string; price: number; category: string }) => {
 *         const discount = product.category === "electronics" ? 0.1 : 0
 *         return Option.some(product.price * (1 - discount))
 *       }
 *     }
 *   )
 * )
 *
 * // Electronics get discount: { name: "Laptop", price: 1000, category: "electronics" }
 * // -> { name: "Laptop", price: 1000, category: "electronics", discountPercentage: 10, finalPrice: 900 }
 *
 * // Other categories: { name: "Book", price: 20, category: "books" }
 * // -> { name: "Book", price: 20, category: "books", finalPrice: 20 }
 * ```
 *
 * @category transformations
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
 * Utilities for creating and working with record schemas. Record schemas define objects
 * with dynamic keys conforming to a specific key schema and values conforming to a
 * specific value schema.
 *
 * @example Basic record schemas with string keys
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Simple string-to-number record
 * const StringNumberRecord = Schema.Record(Schema.String, Schema.Number)
 *
 * // Decode: { [x: string]: number }
 * console.log(Schema.decodeUnknownSync(StringNumberRecord)({ a: 1, b: 2 }))
 * // Output: { a: 1, b: 2 }
 *
 * // String-to-string record (configuration-like)
 * const ConfigRecord = Schema.Record(Schema.String, Schema.String)
 *
 * console.log(Schema.decodeUnknownSync(ConfigRecord)({ host: "localhost", port: "3000" }))
 * // Output: { host: "localhost", port: "3000" }
 * ```
 *
 * @example Records with symbol keys
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Symbol-to-number record
 * const SymbolRecord = Schema.Record(Schema.Symbol, Schema.Number)
 *
 * const symbolKey = Symbol.for("uniqueKey")
 * const data = { [symbolKey]: 42 }
 *
 * console.log(Schema.decodeUnknownSync(SymbolRecord)(data))
 * // Output: { [Symbol(uniqueKey)]: 42 }
 * ```
 *
 * @example Records with template literal keys
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Keys must follow a specific pattern
 * const PrefixedRecord = Schema.Record(
 *   Schema.TemplateLiteral(["user_", Schema.String]),
 *   Schema.Number
 * )
 *
 * console.log(Schema.decodeUnknownSync(PrefixedRecord)({
 *   user_alice: 1,
 *   user_bob: 2
 * }))
 * // Output: { user_alice: 1, user_bob: 2 }
 * ```
 *
 * @example Type extraction utilities
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const MyRecord = Schema.Record(Schema.String, Schema.Number)
 *
 * // Extract the Type using Schema.Type
 * type RecordType = Schema.Schema.Type<typeof MyRecord>
 * // RecordType is { readonly [x: string]: number }
 *
 * // Use Record.Type for direct namespace access
 * type DirectType = Schema.Record.Type<typeof Schema.String, typeof Schema.Number>
 * // DirectType is { readonly [x: string]: number }
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export declare namespace Record {
  /**
   * Represents a schema that can be used as a key in a Record schema.
   *
   * The Key interface extends Codec to handle PropertyKey types (string, number, or symbol),
   * making it suitable for creating dynamic record schemas with typed keys.
   *
   * @example Basic key types for records
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // String keys - most common case
   * const StringKey: Schema.Record.Key = Schema.String
   * const stringRecord = Schema.Record(StringKey, Schema.Number)
   * // type: { readonly [x: string]: number }
   *
   * // Symbol keys for unique identifiers
   * const SymbolKey: Schema.Record.Key = Schema.Symbol
   * const symbolRecord = Schema.Record(SymbolKey, Schema.String)
   * // type: { readonly [x: symbol]: string }
   *
   * // Number keys for index-based access
   * const NumberKey: Schema.Record.Key = Schema.Number
   * const numberRecord = Schema.Record(NumberKey, Schema.Boolean)
   * // type: { readonly [x: number]: boolean }
   * ```
   *
   * @example Literal keys create struct-like schemas
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Union of string literals as keys
   * const LiteralKey = Schema.Literals(["name", "email", "age"])
   * const structLikeRecord = Schema.Record(LiteralKey, Schema.String)
   * // type: { readonly "name": string; readonly "email": string; readonly "age": string }
   *
   * // Single literal key
   * const SingleLiteralKey = Schema.Literal("config")
   * const singleKeyRecord = Schema.Record(SingleLiteralKey, Schema.Unknown)
   * // type: { readonly "config": unknown }
   * ```
   *
   * @example Key transformations during encoding/decoding
   * ```ts
   * import { Schema, Transformation } from "effect/schema"
   *
   * // Transform snake_case keys to camelCase
   * const TransformKey = Schema.String.pipe(
   *   Schema.decode(Transformation.snakeToCamel())
   * )
   *
   * const transformRecord = Schema.Record(TransformKey, Schema.Number)
   *
   * // Decoding: { "user_name": 42, "first_name": "John" }
   * // becomes: { "userName": 42, "firstName": "John" }
   *
   * // The transformed key satisfies Record.Key interface
   * const isKey: Schema.Record.Key = TransformKey
   * ```
   *
   * @example Using transformed keys
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Simple Record creation with various key types
   * const simpleRecord = Schema.Record(Schema.String, Schema.Number)
   *
   * // Verify key compatibility with Record.Key interface
   * const stringAsKey: Schema.Record.Key = Schema.String
   * const symbolAsKey: Schema.Record.Key = Schema.Symbol
   * const numberAsKey: Schema.Record.Key = Schema.Number
   * ```
   *
   * @category models
   * @since 4.0.0
   */
  export interface Key extends Codec<PropertyKey, PropertyKey, unknown, unknown> {
    readonly "~type.make": PropertyKey
  }

  /**
   * Represents a record schema type with typed keys and values. This is the default
   * Record type that uses `Record.Key` and `Top` as the generic parameters.
   *
   * @example Basic type extraction from Record schemas
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Create different record schemas
   * const StringRecord = Schema.Record(Schema.String, Schema.Number)
   * const SymbolRecord = Schema.Record(Schema.Symbol, Schema.String)
   * const LiteralRecord = Schema.Record(Schema.Literals(["a", "b"]), Schema.Boolean)
   *
   * // Extract types using Record namespace
   * type StringRecordType = Schema.Record.Type<typeof Schema.String, typeof Schema.Number>
   * // StringRecordType: { readonly [x: string]: number }
   *
   * type SymbolRecordType = Schema.Record.Type<typeof Schema.Symbol, typeof Schema.String>
   * // SymbolRecordType: { readonly [x: symbol]: string }
   *
   * type LiteralRecordType = Schema.Record.Type<typeof LiteralRecord.key, typeof Schema.Boolean>
   * // LiteralRecordType: { readonly "a": boolean; readonly "b": boolean }
   * ```
   *
   * @example Type extraction with optional and mutable records
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Create records with modifiers
   * const OptionalRecord = Schema.Record(Schema.String, Schema.optional(Schema.Number))
   * const MutableRecord = Schema.mutable(Schema.Record(Schema.String, Schema.String))
   *
   * // Extract types from schemas
   * type OptionalType = typeof OptionalRecord.Type
   * // OptionalType: { readonly [x: string]: number | undefined }
   *
   * type MutableType = typeof MutableRecord.Type
   * // MutableType: { [x: string]: string }
   *
   * // Extract encoded types
   * type OptionalEncoded = typeof OptionalRecord.Encoded
   * // OptionalEncoded: { readonly [x: string]: number | undefined }
   * ```
   *
   * @example Advanced type utilities with Records
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Demonstrate type-level operations with union values
   * const ConfigRecord = Schema.Record(Schema.String, Schema.Union([Schema.String, Schema.Number]))
   *
   * // Extract different type aspects
   * type ConfigType = Schema.Schema.Type<typeof ConfigRecord>
   * // ConfigType: { readonly [x: string]: string | number }
   *
   * type ConfigEncoded = Schema.Schema.Encoded<typeof ConfigRecord>
   * // ConfigEncoded: { readonly [x: string]: string | number }
   *
   * // Working with validation and encoding
   * const validConfig = Schema.decodeUnknownSync(ConfigRecord)({
   *   host: "localhost",
   *   port: 3000,
   *   debug: "true"
   * })
   * // { host: "localhost", port: 3000, debug: "true" }
   * ```
   *
   * @category models
   * @since 4.0.0
   */
  export type Record = Record$<Record.Key, Top>

  type MergeTuple<T extends ReadonlyArray<unknown>> = T extends readonly [infer Head, ...infer Tail] ?
    Head & MergeTuple<Tail>
    : {}

  /**
   * Extracts the TypeScript type from a Record schema's key and value components.
   * This type utility computes the resulting record type based on the mutability
   * and optionality characteristics of the value schema.
   *
   * @example Type extraction from record schemas
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Basic string-to-number record
   * const StringNumberRecord = Schema.Record(Schema.String, Schema.Number)
   * type StringNumberType = Schema.Record.Type<Schema.String, Schema.Number>
   * // type StringNumberType = { readonly [x: string]: number }
   *
   * // Symbol-to-string record
   * const SymbolStringRecord = Schema.Record(Schema.Symbol, Schema.String)
   * type SymbolStringType = Schema.Record.Type<Schema.Symbol, Schema.String>
   * // type SymbolStringType = { readonly [x: symbol]: string }
   *
   * // Number-to-boolean record
   * const NumberBooleanRecord = Schema.Record(Schema.Number, Schema.Boolean)
   * type NumberBooleanType = Schema.Record.Type<Schema.Number, Schema.Boolean>
   * // type NumberBooleanType = { readonly [x: number]: boolean }
   * ```
   *
   * @example Extracting type from existing record instances
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Define a record schema
   * const UserRecord = Schema.Record(Schema.String, Schema.String)
   *
   * // Extract type using conditional type
   * type UserRecordType = typeof UserRecord extends {
   *   readonly Type: infer T
   * } ? T : never
   * // type UserRecordType = { readonly [x: string]: string }
   *
   * // Verify equivalence with Schema.Record.Type
   * type IsEquivalent = Schema.Record.Type<Schema.String, Schema.String> extends UserRecordType ? true : false
   * // type IsEquivalent = true
   * ```
   *
   * @example Advanced type-level record manipulation
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Helper to extract key type from record type
   * type ExtractKeyType<T> = T extends Schema.Record.Type<infer K, any> ? K : never
   *
   * // Helper to extract value type from record type
   * type ExtractValueType<T> = T extends Schema.Record.Type<any, infer V> ? V : never
   *
   * // Example record type
   * type ConfigRecord = Schema.Record.Type<Schema.String, Schema.Number>
   *
   * // Extract components
   * type KeyType = ExtractKeyType<ConfigRecord>   // Schema.String
   * type ValueType = ExtractValueType<ConfigRecord>  // Schema.Number
   *
   * // Type-level verification
   * type HasStringKeys = KeyType extends Schema.String ? true : false  // true
   * type HasNumberValues = ValueType extends Schema.Number ? true : false  // true
   * ```
   *
   * @category type-level
   * @since 4.0.0
   */
  export type Type<Key extends Record.Key, Value extends Top> = Value extends
    { readonly "~type.optionality": "optional" } ?
    Value extends { readonly "~type.mutability": "mutable" } ? { [P in Key["Type"]]?: Value["Type"] }
    : { readonly [P in Key["Type"]]?: Value["Type"] }
    : Value extends { readonly "~type.mutability": "mutable" } ? { [P in Key["Type"]]: Value["Type"] }
    : { readonly [P in Key["Type"]]: Value["Type"] }

  /**
   * Extracts the encoded type from a Record schema, representing the wire-format
   * or serialized form of record data. This type utility is essential for
   * understanding how record data appears during serialization, API transport,
   * or storage operations.
   *
   * @example Basic record encoded type extraction
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * const UserRecord = Schema.Record(Schema.String, Schema.String)
   *
   * // Extract the encoded type using Record.Encoded
   * type UserRecordEncoded = Schema.Record.Encoded<typeof Schema.String, typeof Schema.String>
   * // UserRecordEncoded: { readonly [x: string]: string }
   *
   * // Alternative extraction using Schema.Encoded
   * type AlternativeEncoded = Schema.Schema.Encoded<typeof UserRecord>
   * // AlternativeEncoded: { readonly [x: string]: string }
   * ```
   *
   * @example Record with transformations - different Type and Encoded
   * ```ts
   * import { Schema, Getter } from "effect/schema"
   *
   * // Create a transformation schema that decodes strings to numbers
   * const NumberFromString = Schema.String.pipe(
   *   Schema.decodeTo(Schema.Number, {
   *     decode: Getter.Number(),
   *     encode: Getter.String()
   *   })
   * )
   *
   * const ConfigRecord = Schema.Record(Schema.String, NumberFromString)
   *
   * // Extract the runtime type (what we work with in code)
   * type ConfigType = Schema.Schema.Type<typeof ConfigRecord>
   * // ConfigType: { readonly [x: string]: number }
   *
   * // Extract the encoded type (what gets serialized/transmitted)
   * type ConfigEncoded = Schema.Record.Encoded<typeof Schema.String, typeof NumberFromString>
   * // ConfigEncoded: { readonly [x: string]: string }
   * ```
   *
   * @example Record with key transformations and value encoding
   * ```ts
   * import { Schema, Transformation, Getter } from "effect/schema"
   *
   * // Transform snake_case keys to camelCase
   * const SnakeToCamel = Schema.String.pipe(
   *   Schema.decode(Transformation.snakeToCamel())
   * )
   *
   * // Transform string values to numbers
   * const NumberFromString = Schema.String.pipe(
   *   Schema.decodeTo(Schema.Number, {
   *     decode: Getter.Number(),
   *     encode: Getter.String()
   *   })
   * )
   *
   * const APIRecord = Schema.Record(SnakeToCamel, NumberFromString)
   *
   * // Runtime type (camelCase keys, number values)
   * type APIType = Schema.Schema.Type<typeof APIRecord>
   * // APIType: { readonly [x: string]: number }
   *
   * // Encoded type (snake_case keys, string values)
   * type APIEncoded = Schema.Record.Encoded<typeof SnakeToCamel, typeof NumberFromString>
   * // APIEncoded: { readonly [x: string]: string }
   * ```
   *
   * @example Record with optional and mutable encoded types
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Record with optional values
   * const OptionalNumber = Schema.optional(Schema.Number)
   * const OptionalRecord = Schema.Record(Schema.String, OptionalNumber)
   * type OptionalEncoded = Schema.Record.Encoded<typeof Schema.String, typeof OptionalNumber>
   * // OptionalEncoded: { readonly [x: string]: number | undefined }
   *
   * // Record with union values
   * const StringOrNumber = Schema.Union([Schema.String, Schema.Number])
   * const UnionRecord = Schema.Record(Schema.String, StringOrNumber)
   * type UnionEncoded = Schema.Record.Encoded<typeof Schema.String, typeof StringOrNumber>
   * // UnionEncoded: { readonly [x: string]: string | number }
   * ```
   *
   * @example Type-level conditional logic with Record.Encoded
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Demonstrate type extraction in conditional types
   * type ExtractRecordEncoded<T> = T extends Schema.Record$<infer K, infer V>
   *   ? Schema.Record.Encoded<K, V>
   *   : never
   *
   * const SampleRecord = Schema.Record(Schema.String, Schema.Number)
   * type ExtractedEncoded = ExtractRecordEncoded<typeof SampleRecord>
   * // ExtractedEncoded: { readonly [x: string]: number }
   *
   * // Use in validation functions
   * const validateRecordEncoded = <K extends Schema.Record.Key, V extends Schema.Top>(
   *   schema: Schema.Record$<K, V>,
   *   data: Schema.Record.Encoded<K, V>
   * ): boolean => {
   *   // Type-safe validation logic here
   *   return typeof data === "object" && data !== null
   * }
   * ```
   *
   * @category type-level
   * @since 4.0.0
   */
  export type Encoded<Key extends Record.Key, Value extends Top> = Value extends
    { readonly "~encoded.optionality": "optional" } ?
    Value extends { readonly "~encoded.mutability": "mutable" } ? { [P in Key["Encoded"]]?: Value["Encoded"] }
    : { readonly [P in Key["Encoded"]]?: Value["Encoded"] }
    : Value extends { readonly "~encoded.mutability": "mutable" } ? { [P in Key["Encoded"]]: Value["Encoded"] }
    : { readonly [P in Key["Encoded"]]: Value["Encoded"] }

  /**
   * Extracts the union of all decoding services required by a Record schema,
   * combining services needed by both the key and value schemas during decode operations.
   * This type utility is essential for understanding service dependencies when working
   * with complex record schemas that require external services during decoding.
   *
   * DecodingServices represents a union of all service types that must be provided
   * to successfully decode data using the record schema. This includes services
   * required for key transformations, value transformations, and any custom
   * decoding logic embedded within the record schema.
   *
   * @example Basic records with no service dependencies
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Simple record with string keys and number values
   * const BasicRecord = Schema.Record(Schema.String, Schema.Number)
   * type BasicServices = Schema.Record.DecodingServices<typeof Schema.String, typeof Schema.Number>
   * // type BasicServices = never (no services required)
   *
   * // Record with literal keys and boolean values
   * const ConfigLiteral = Schema.Literal("config")
   * const LiteralRecord = Schema.Record(ConfigLiteral, Schema.Boolean)
   * type LiteralServices = Schema.Record.DecodingServices<typeof ConfigLiteral, typeof Schema.Boolean>
   * // type LiteralServices = never (no services required)
   * ```
   *
   * @example Records with key transformation services
   * ```ts
   * import { Schema } from "effect/schema"
   * import { Context, Effect } from "effect"
   *
   * // Create a service for key validation
   * interface KeyValidationService {
   *   readonly validateKey: (key: string) => Effect.Effect<string, string>
   * }
   * const KeyValidationService = Context.GenericTag<KeyValidationService>("KeyValidationService")
   *
   * // Custom key schema that requires validation service
   * const ValidatedKey = Schema.String.pipe(
   *   Schema.transformOrFail(
   *     Schema.String,
   *     {
   *       decode: (input) => Effect.flatMap(
   *         KeyValidationService,
   *         (service) => service.validateKey(input)
   *       )
   *     }
   *   )
   * )
   *
   * // Record using the validated key schema
   * const ValidatedRecord = Schema.Record(ValidatedKey, Schema.String)
   * type ValidatedServices = Schema.Record.DecodingServices<typeof ValidatedKey, typeof Schema.String>
   * // type ValidatedServices = KeyValidationService (key schema requires service)
   * ```
   *
   * @example Records with value transformation services
   * ```ts
   * import { Schema } from "effect/schema"
   * import { Context, Effect } from "effect"
   *
   * // Create a service for data fetching
   * interface DataService {
   *   readonly fetchData: (id: string) => Effect.Effect<unknown, string>
   * }
   * const DataService = Context.GenericTag<DataService>("DataService")
   *
   * // Value schema that requires external data fetching
   * const EnrichedValue = Schema.String.pipe(
   *   Schema.transformOrFail(
   *     Schema.Unknown,
   *     {
   *       decode: (id) => Effect.flatMap(
   *         DataService,
   *         (service) => service.fetchData(id)
   *       )
   *     }
   *   )
   * )
   *
   * // Record using the enriched value schema
   * const EnrichedRecord = Schema.Record(Schema.String, EnrichedValue)
   * type EnrichedServices = Schema.Record.DecodingServices<typeof Schema.String, typeof EnrichedValue>
   * // type EnrichedServices = DataService (value schema requires service)
   * ```
   *
   * @example Records with both key and value services
   * ```ts
   * import { Schema } from "effect/schema"
   * import { Context, Effect } from "effect"
   *
   * // Multiple services for comprehensive record processing
   * interface AuthService {
   *   readonly authorize: (key: string) => Effect.Effect<string, string>
   * }
   * const AuthService = Context.GenericTag<AuthService>("AuthService")
   *
   * interface ProcessingService {
   *   readonly process: (value: string) => Effect.Effect<number, string>
   * }
   * const ProcessingService = Context.GenericTag<ProcessingService>("ProcessingService")
   *
   * // Key schema requiring authorization
   * const AuthorizedKey = Schema.String.pipe(
   *   Schema.transformOrFail(
   *     Schema.String,
   *     {
   *       decode: (key) => Effect.flatMap(
   *         AuthService,
   *         (auth) => auth.authorize(key)
   *       )
   *     }
   *   )
   * )
   *
   * // Value schema requiring processing
   * const ProcessedValue = Schema.String.pipe(
   *   Schema.transformOrFail(
   *     Schema.Number,
   *     {
   *       decode: (value) => Effect.flatMap(
   *         ProcessingService,
   *         (processor) => processor.process(value)
   *       )
   *     }
   *   )
   * )
   *
   * // Record combining both service-dependent schemas
   * const FullServiceRecord = Schema.Record(AuthorizedKey, ProcessedValue)
   * type FullServices = Schema.Record.DecodingServices<typeof AuthorizedKey, typeof ProcessedValue>
   * // type FullServices = AuthService | ProcessingService (union of both services)
   * ```
   *
   * @example Type-level service dependency analysis
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Utility type to check if record decoding requires services
   * type RequiresDecodingServices<K extends Schema.Record.Key, V extends Schema.Top> =
   *   Schema.Record.DecodingServices<K, V> extends never
   *     ? "No decoding services required"
   *     : "Decoding services required"
   *
   * // Analyze different record configurations
   * type BasicCheck = RequiresDecodingServices<typeof Schema.String, typeof Schema.Number>
   * // type BasicCheck = "No decoding services required"
   *
   * // Helper to extract service types from record schemas
   * type ExtractServices<T> = T extends Schema.Record$<infer K, infer V>
   *   ? Schema.Record.DecodingServices<K, V>
   *   : never
   *
   * const TestRecord = Schema.Record(Schema.String, Schema.String)
   * type TestServices = ExtractServices<typeof TestRecord>
   * // type TestServices = never
   * ```
   *
   * @category type extractors
   * @since 4.0.0
   */
  export type DecodingServices<Key extends Record.Key, Value extends Top> =
    | Key["DecodingServices"]
    | Value["DecodingServices"]

  /**
   * Extracts all encoding services required by a Record schema's key and value components.
   * This type utility computes the union of all services needed for encoding operations,
   * including any services required by transformations or encoding middleware in either
   * the key schema or value schema.
   *
   * @example Basic record encoding services
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Basic record with no encoding services
   * const SimpleRecord = Schema.Record(Schema.String, Schema.Number)
   * type SimpleServices = Schema.Record.EncodingServices<typeof Schema.String, typeof Schema.Number>
   * // type SimpleServices = never
   *
   * // Record with built-in transformations
   * const StringNumberRecord = Schema.Record(Schema.String, Schema.NumberFromString)
   * type TransformServices = Schema.Record.EncodingServices<typeof Schema.String, typeof Schema.NumberFromString>
   * // type TransformServices = never (for this basic transformation)
   * ```
   *
   * @example Service dependency analysis
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Check if record requires encoding services
   * type RequiresEncodingServices<K extends Schema.Record.Key, V extends Schema.Top> =
   *   Schema.Record.EncodingServices<K, V> extends never
   *     ? "No encoding services required"
   *     : "Encoding services required"
   *
   * // Analyze different record types
   * type StringNumberRequirement = RequiresEncodingServices<typeof Schema.String, typeof Schema.Number>
   * // type StringNumberRequirement = "No encoding services required"
   *
   * type SymbolBooleanRequirement = RequiresEncodingServices<typeof Schema.Symbol, typeof Schema.Boolean>
   * // type SymbolBooleanRequirement = "No encoding services required"
   * ```
   *
   * @example Union of key and value services
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Record where both key and value may have service dependencies
   * const StringKeyRecord = Schema.Record(Schema.String, Schema.Number)
   * const SymbolKeyRecord = Schema.Record(Schema.Symbol, Schema.Boolean)
   *
   * // The encoding services are the union of services from both key and value
   * type StringServices = Schema.Record.EncodingServices<typeof Schema.String, typeof Schema.Number>
   * // type StringServices = never
   *
   * type SymbolServices = Schema.Record.EncodingServices<typeof Schema.Symbol, typeof Schema.Boolean>
   * // type SymbolServices = never
   * ```
   *
   * @category type extractors
   * @since 4.0.0
   */
  export type EncodingServices<Key extends Record.Key, Value extends Top> =
    | Key["EncodingServices"]
    | Value["EncodingServices"]

  /**
   * Represents the input type for creating a Record schema, handling the make-in type
   * that determines the structure and requirements for record construction.
   *
   * The `MakeIn` type computes the appropriate input type based on the key and value schemas,
   * considering mutability and optionality constraints. It accounts for:
   * - Optional vs required values
   * - Mutable vs readonly properties
   * - Key type transformations and constraints
   *
   * @example Basic record make-in types
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // String key with required number values
   * const stringRecord = Schema.Record(Schema.String, Schema.Number)
   * // The MakeIn type for this record: { readonly [x: string]: number }
   *
   * // Symbol key with string values
   * const symbolRecord = Schema.Record(Schema.Symbol, Schema.String)
   * // The MakeIn type for this record: { readonly [x: symbol]: string }
   * ```
   *
   * @example Optional values in record make-in types
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Optional values create optional properties
   * const optionalRecord = Schema.Record(Schema.String, Schema.optional(Schema.Number))
   * // The MakeIn type for this record: { readonly [x: string]?: number }
   *
   * // Combined optional and mutable properties
   * const optionalMutableRecord = Schema.Record(
   *   Schema.String,
   *   Schema.mutableKey(Schema.optional(Schema.Number))
   * )
   * // The MakeIn type for this record: { [x: string]?: number }
   * ```
   *
   * @example Literal key records with make-in types
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Literal keys create struct-like make-in types
   * const literalRecord = Schema.Record(Schema.Literals(["name", "age"]), Schema.String)
   * // The MakeIn type for this record: { readonly name: string; readonly age: string }
   *
   * // Mixed literal keys with optional values
   * const mixedRecord = Schema.Record(
   *   Schema.Literals(["config", "debug"]),
   *   Schema.optional(Schema.Boolean)
   * )
   * // The MakeIn type for this record: { readonly config?: boolean; readonly debug?: boolean }
   * ```
   *
   * @since 4.0.0
   * @category type extractors
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
 * @category models
 * @since 4.0.0
 * @example Basic struct with rest (string keys)
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Define a struct with fixed fields and additional string-keyed fields
 * const PersonSchema = Schema.StructWithRest(
 *   Schema.Struct({ name: Schema.String, age: Schema.Number }),
 *   [Schema.Record(Schema.String, Schema.String)]
 * )
 *
 * // Extract the type
 * type Person = Schema.Schema.Type<typeof PersonSchema>
 * // type Person = { readonly name: string; readonly age: number; readonly [x: string]: string }
 * ```
 *
 * @example Multiple record types
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Struct with multiple record types
 * const ConfigSchema = Schema.StructWithRest(
 *   Schema.Struct({ version: Schema.String }),
 *   [
 *     Schema.Record(Schema.String, Schema.String),
 *     Schema.Record(Schema.Symbol, Schema.Number)
 *   ]
 * )
 *
 * type Config = Schema.Schema.Type<typeof ConfigSchema>
 * // type Config = { readonly version: string; readonly [x: string]: string; readonly [x: symbol]: number }
 * ```
 *
 * @example Template literal keys
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Struct with template literal pattern for rest fields
 * const ApiSchema = Schema.StructWithRest(
 *   Schema.Struct({ endpoint: Schema.String }),
 *   [Schema.Record(Schema.TemplateLiteral(["header-", Schema.String]), Schema.String)]
 * )
 *
 * type ApiConfig = Schema.Schema.Type<typeof ApiSchema>
 * // type ApiConfig = { readonly endpoint: string; readonly [x: `header-${string}`]: string }
 * ```
 *
 * @example Type utilities
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const UserFields = Schema.Struct({ id: Schema.String, name: Schema.String })
 * const UserRecords = [Schema.Record(Schema.String, Schema.Unknown)] as const
 *
 * // Extract types using namespace utilities
 * type UserType = Schema.StructWithRest.Type<typeof UserFields, typeof UserRecords>
 * // type UserType = { readonly id: string; readonly name: string; readonly [x: string]: unknown }
 *
 * type UserEncoded = Schema.StructWithRest.Encoded<typeof UserFields, typeof UserRecords>
 * // type UserEncoded = { readonly id: string; readonly name: string; readonly [x: string]: unknown }
 * ```
 */
export declare namespace StructWithRest {
  /**
   * Represents a schema that has a type literal AST structure, used as a constraint
   * for the struct portion of StructWithRest schemas.
   *
   * This type ensures that the schema provided as the struct part of a StructWithRest
   * has an underlying AST.TypeLiteral structure, which means it represents an object
   * with property signatures and index signatures.
   *
   * @example Basic usage with struct schemas
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // A struct schema that satisfies TypeLiteral constraint
   * const PersonStruct = Schema.Struct({
   *   name: Schema.String,
   *   age: Schema.Number
   * })
   *
   * // This can be used with StructWithRest
   * const PersonWithRest = Schema.StructWithRest(
   *   PersonStruct,
   *   [Schema.Record(Schema.String, Schema.String)]
   * )
   * ```
   *
   * @category models
   * @since 4.0.0
   */
  export type TypeLiteral = Top & { readonly ast: AST.TypeLiteral }

  /**
   * Represents a collection of record schemas that define index signatures for use with
   * `StructWithRest`. This type allows combining structured object properties with
   * dynamic key-value mappings, enabling flexible object validation that supports
   * both known properties and additional dynamic fields.
   *
   * Each record in the collection can be either readonly or mutable, providing
   * fine-grained control over the mutability of different index signatures within
   * the same schema.
   *
   * @example Basic records collection
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Define a collection of record schemas
   * const UserRecords: Schema.StructWithRest.Records = [
   *   Schema.Record(Schema.String, Schema.String),
   *   Schema.Record(Schema.Symbol, Schema.Number)
   * ]
   *
   * // Use with StructWithRest to create a schema
   * const UserSchema = Schema.StructWithRest(
   *   Schema.Struct({ id: Schema.String }),
   *   UserRecords
   * )
   *
   * type User = Schema.Schema.Type<typeof UserSchema>
   * // type User = { readonly id: string; readonly [x: string]: string; readonly [x: symbol]: number }
   * ```
   *
   * @example Multiple record types
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Collection with different key-value combinations
   * const ConfigRecords: Schema.StructWithRest.Records = [
   *   Schema.Record(Schema.String, Schema.Unknown),
   *   Schema.Record(Schema.TemplateLiteral(["env_", Schema.String]), Schema.String),
   *   Schema.Record(Schema.Symbol, Schema.Boolean)
   * ]
   *
   * const ConfigSchema = Schema.StructWithRest(
   *   Schema.Struct({ version: Schema.String }),
   *   ConfigRecords
   * )
   *
   * type Config = Schema.Schema.Type<typeof ConfigSchema>
   * // type Config = {
   * //   readonly version: string
   * //   readonly [x: string]: unknown
   * //   readonly [x: `env_${string}`]: string
   * //   readonly [x: symbol]: boolean
   * // }
   * ```
   *
   * @example Using mutable records
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Mix readonly and mutable record schemas
   * const MixedRecords: Schema.StructWithRest.Records = [
   *   Schema.Record(Schema.String, Schema.String), // readonly by default
   *   Schema.mutable(Schema.Record(Schema.Number, Schema.Boolean)) // explicitly mutable
   * ]
   *
   * const MixedSchema = Schema.StructWithRest(
   *   Schema.Struct({ name: Schema.String }),
   *   MixedRecords
   * )
   *
   * type Mixed = Schema.Schema.Type<typeof MixedSchema>
   * // type Mixed = {
   * //   readonly name: string
   * //   readonly [x: string]: string
   * //   [x: number]: boolean
   * // }
   * ```
   *
   * @example Type-level utilities
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * const PersonStruct = Schema.Struct({ name: Schema.String, age: Schema.Number })
   * const PersonRecords: Schema.StructWithRest.Records = [
   *   Schema.Record(Schema.String, Schema.Unknown)
   * ]
   *
   * // Extract merged type using Records collection
   * type PersonType = Schema.StructWithRest.Type<typeof PersonStruct, typeof PersonRecords>
   * // type PersonType = { readonly name: string; readonly age: number; readonly [x: string]: unknown }
   *
   * // Extract encoding type
   * type PersonEncoded = Schema.StructWithRest.Encoded<typeof PersonStruct, typeof PersonRecords>
   * // type PersonEncoded = { readonly name: string; readonly age: number; readonly [x: string]: unknown }
   * ```
   *
   * @category models
   * @since 4.0.0
   */
  export type Records = ReadonlyArray<Record.Record | mutable<Record.Record>>

  type MergeTuple<T extends ReadonlyArray<unknown>> = T extends readonly [infer Head, ...infer Tail] ?
    Head & MergeTuple<Tail>
    : {}

  /**
   * Extracts the merged type from a struct schema and its rest record schemas,
   * combining the struct's type with the types of all record schemas.
   *
   * This type utility creates an intersection of the struct type with all
   * record types, producing the final type that a StructWithRest schema represents.
   * It's particularly useful for type-level operations and type extraction.
   *
   * @example Basic struct with rest type extraction
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Define the struct part
   * const PersonStruct = Schema.Struct({
   *   name: Schema.String,
   *   age: Schema.Number
   * })
   *
   * // Define the rest records
   * const StringRecord = Schema.Record(Schema.String, Schema.String)
   * const RestRecords = [StringRecord] as const
   *
   * // Extract the combined type
   * type PersonWithRestType = Schema.StructWithRest.Type<typeof PersonStruct, typeof RestRecords>
   * // type PersonWithRestType = {
   * //   readonly name: string
   * //   readonly age: number
   * //   readonly [x: string]: string
   * // }
   * ```
   *
   * @example Multiple record types
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * const UserStruct = Schema.Struct({
   *   id: Schema.String,
   *   username: Schema.String
   * })
   *
   * const Records = [
   *   Schema.Record(Schema.String, Schema.Unknown),
   *   Schema.Record(Schema.Symbol, Schema.Number)
   * ] as const
   *
   * type UserType = Schema.StructWithRest.Type<typeof UserStruct, typeof Records>
   * // type UserType = {
   * //   readonly id: string
   * //   readonly username: string
   * //   readonly [x: string]: unknown
   * //   readonly [x: symbol]: number
   * // }
   * ```
   *
   * @example Type extraction for validation
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * const ConfigStruct = Schema.Struct({
   *   version: Schema.String,
   *   debug: Schema.Boolean
   * })
   *
   * const ConfigRecords = [
   *   Schema.Record(Schema.TemplateLiteral(["env_", Schema.String]), Schema.String)
   * ] as const
   *
   * // Extract type for function parameters
   * function processConfig(
   *   config: Schema.StructWithRest.Type<typeof ConfigStruct, typeof ConfigRecords>
   * ): void {
   *   console.log(config.version)  // string
   *   console.log(config.debug)    // boolean
   *   console.log(config.env_prod) // string (from template literal record)
   * }
   * ```
   *
   * @category type extraction
   * @since 4.0.0
   */
  export type Type<S extends TypeLiteral, Records extends StructWithRest.Records> =
    & S["Type"]
    & MergeTuple<{ readonly [K in keyof Records]: Records[K]["Type"] }>
  /**
   * Extracts the merged encoded type from a struct schema and its rest record schemas,
   * combining the struct's encoded type with the encoded types of all record schemas.
   *
   * This type utility creates an intersection of the struct encoded type with all
   * record encoded types, producing the final encoded type that a StructWithRest schema uses
   * for serialization. It's particularly useful for type-level operations and serialization
   * type extraction.
   *
   * @example Basic struct with rest encoded type extraction
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Define the struct part with transformations
   * const PersonStruct = Schema.Struct({
   *   name: Schema.String,
   *   age: Schema.NumberFromString
   * })
   *
   * // Define the rest records
   * const StringRecord = Schema.Record(Schema.String, Schema.String)
   * const RestRecords = [StringRecord] as const
   *
   * // Extract the encoded type
   * type PersonWithRestEncoded = Schema.StructWithRest.Encoded<typeof PersonStruct, typeof RestRecords>
   * // type PersonWithRestEncoded = {
   * //   readonly name: string
   * //   readonly age: string  // Note: string in encoded form
   * //   readonly [x: string]: string
   * // }
   * ```
   *
   * @example Multiple record types with different encoded representations
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * const UserStruct = Schema.Struct({
   *   id: Schema.String,
   *   createdAt: Schema.DateFromString
   * })
   *
   * const Records = [
   *   Schema.Record(Schema.String, Schema.NumberFromString),
   *   Schema.Record(Schema.Symbol, Schema.BooleanFromString)
   * ] as const
   *
   * type UserEncoded = Schema.StructWithRest.Encoded<typeof UserStruct, typeof Records>
   * // type UserEncoded = {
   * //   readonly id: string
   * //   readonly createdAt: string  // Date encoded as string
   * //   readonly [x: string]: string    // NumberFromString encoded as string
   * //   readonly [x: symbol]: string    // BooleanFromString encoded as string
   * // }
   * ```
   *
   * @example Complex transformation with nested encoding
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * const ConfigStruct = Schema.Struct({
   *   version: Schema.String,
   *   settings: Schema.Struct({
   *     timeout: Schema.NumberFromString,
   *     retries: Schema.Number
   *   })
   * })
   *
   * const ConfigRecords = [
   *   Schema.Record(Schema.TemplateLiteral(["env_", Schema.String]), Schema.ArrayFromString(Schema.String, ","))
   * ] as const
   *
   * // Extract encoded type for API serialization
   * type ConfigEncoded = Schema.StructWithRest.Encoded<typeof ConfigStruct, typeof ConfigRecords>
   * // type ConfigEncoded = {
   * //   readonly version: string
   * //   readonly settings: {
   * //     readonly timeout: string  // NumberFromString encoded as string
   * //     readonly retries: number
   * //   }
   * //   readonly [x: `env_${string}`]: string  // ArrayFromString encoded as string
   * // }
   * ```
   *
   * @example JSON serialization type extraction
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * const ApiStruct = Schema.Struct({
   *   id: Schema.String,
   *   timestamp: Schema.DateFromString
   * })
   *
   * const ApiRecords = [
   *   Schema.Record(Schema.String, Schema.Union(Schema.String, Schema.NumberFromString))
   * ] as const
   *
   * // Use encoded type for JSON serialization
   * function serializeApiData(
   *   data: Schema.StructWithRest.Type<typeof ApiStruct, typeof ApiRecords>
   * ): Schema.StructWithRest.Encoded<typeof ApiStruct, typeof ApiRecords> {
   *   // The encoded type ensures proper serialization format
   *   return {
   *     id: data.id,
   *     timestamp: data.timestamp.toISOString(),
   *     ...Object.fromEntries(
   *       Object.entries(data).filter(([key]) => !["id", "timestamp"].includes(key))
   *     )
   *   }
   * }
   * ```
   *
   * @category type extraction
   * @since 4.0.0
   */
  export type Encoded<S extends TypeLiteral, Records extends StructWithRest.Records> =
    & S["Encoded"]
    & MergeTuple<{ readonly [K in keyof Records]: Records[K]["Encoded"] }>

  /**
   * Extracts and aggregates all service dependencies required for decoding operations
   * from both the struct and rest record schemas in a StructWithRest schema.
   *
   * This type utility combines the decoding service dependencies from the struct portion
   * with those from all record schemas in the rest portion, creating a union type that
   * represents all external services needed for decoding operations. It's essential for
   * understanding what services must be provided in the Effect context when decoding
   * StructWithRest schemas.
   *
   * @example Basic StructWithRest with no service dependencies
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Simple struct with primitive fields
   * const PersonStruct = Schema.Struct({
   *   name: Schema.String,
   *   age: Schema.Number
   * })
   *
   * // Records with primitive types
   * const Records = [Schema.Record(Schema.String, Schema.String)] as const
   *
   * type PersonServices = Schema.StructWithRest.DecodingServices<typeof PersonStruct, typeof Records>
   * // type PersonServices = never (no services required)
   * ```
   *
   * @example StructWithRest with transformations requiring services
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Struct with custom transformation that requires a service
   * const UserStruct = Schema.Struct({
   *   id: Schema.String,
   *   profile: Schema.String.pipe(Schema.transformOrFail(
   *     Schema.Unknown,
   *     (input, options, ast) => {
   *       // Custom transformation that might require external services
   *       return Schema.decodeUnknown(Schema.String)(input, options)
   *     },
   *     (input, options, ast) => Schema.encodeUnknown(Schema.String)(input, options)
   *   ))
   * })
   *
   * // Records with potential service dependencies
   * const Records = [
   *   Schema.Record(Schema.String, Schema.Number)
   * ] as const
   *
   * type UserServices = Schema.StructWithRest.DecodingServices<typeof UserStruct, typeof Records>
   * // type UserServices = services from struct transformations | services from record transformations
   * ```
   *
   * @example Type-level service dependency analysis
   * ```ts
   * import { Schema } from "effect/schema"
   *
   * // Define struct and records for analysis
   * const ConfigStruct = Schema.Struct({
   *   apiKey: Schema.String,
   *   timeout: Schema.Number
   * })
   *
   * const ConfigRecords = [
   *   Schema.Record(Schema.String, Schema.String)
   * ] as const
   *
   * // Extract service dependencies for validation
   * type ConfigServices = Schema.StructWithRest.DecodingServices<typeof ConfigStruct, typeof ConfigRecords>
   *
   * // Use for conditional type checking
   * type RequiresServices = ConfigServices extends never ? false : true
   * // type RequiresServices = false (for basic primitives)
   * ```
   *
   * @category type extractors
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
 * Creates a suspended schema that defers evaluation until needed. This is essential for
 * creating recursive schemas where a schema references itself, preventing infinite recursion
 * during schema definition.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Define a recursive category structure
 * interface CategoryType {
 *   readonly name: string
 *   readonly children: ReadonlyArray<CategoryType>
 * }
 *
 * const CategorySchema = Schema.Struct({
 *   name: Schema.String,
 *   children: Schema.Array(
 *     Schema.suspend((): Schema.Codec<CategoryType> => CategorySchema)
 *   )
 * })
 *
 * // Usage example
 * const categoryData = {
 *   name: "Electronics",
 *   children: [
 *     { name: "Computers", children: [] },
 *     { name: "Phones", children: [
 *       { name: "iPhone", children: [] },
 *       { name: "Android", children: [] }
 *     ]}
 *   ]
 * }
 *
 * // Decode the recursive structure
 * const decoded = Schema.decodeUnknownSync(CategorySchema)(categoryData)
 * console.log(decoded.name) // "Electronics"
 * console.log(decoded.children[0].name) // "Computers"
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export function suspend<S extends Top>(f: () => S): suspend<S> {
  return make<suspend<S>>(new AST.Suspend(() => f().ast))
}

/**
 * Creates a standalone function that applies validation checks to a schema.
 *
 * This function is useful when you want to reuse the same validation logic
 * across multiple schemas or when you need to apply checks in a pipeline.
 *
 * @example
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * // Use in transformation pipelines for numbers
 * const schema = Schema.FiniteFromString.pipe(
 *   Schema.check(Check.greaterThan(0))
 * )
 *
 * // Result has both string-to-number transformation and positive validation
 * ```
 *
 * @example
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * // Use in transformation pipelines for strings
 * const schema = Schema.FiniteFromString.pipe(
 *   Schema.flip,
 *   Schema.check(Check.minLength(3))
 * )
 *
 * // Result transforms number to string and validates minimum length
 * ```
 *
 * @example
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * // Apply multiple checks in a transformation pipeline
 * const schema = Schema.FiniteFromString.pipe(
 *   Schema.check(Check.greaterThan(2)),
 *   Schema.flip,
 *   Schema.check(Check.minLength(3))
 * )
 *
 * // Validates both the numeric value and string representation
 * ```
 *
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
 * Returns a function that applies validation checks to a schema.
 *
 * This is the underlying implementation of the `check` function, allowing
 * validation constraints to be applied to schemas. The returned function
 * can be used to transform a schema by adding validation rules.
 *
 * @example
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * // Basic usage with string length validation
 * const stringValidator = Schema.asCheck(Check.minLength(3))
 * const StringWithMinLength = stringValidator(Schema.String)
 *
 * console.log(Schema.decodeUnknownSync(StringWithMinLength)("hello")) // "hello"
 * // Schema.decodeUnknownSync(StringWithMinLength)("hi") // throws ParseError
 * ```
 *
 * @example
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * // Multiple validation checks
 * const multiValidator = Schema.asCheck(
 *   Check.minLength(3),
 *   Check.maxLength(10),
 *   Check.includes("@")
 * )
 * const EmailLikeString = multiValidator(Schema.String)
 *
 * console.log(Schema.decodeUnknownSync(EmailLikeString)("user@domain")) // "user@domain"
 * // Schema.decodeUnknownSync(EmailLikeString)("ab") // throws ParseError (too short)
 * // Schema.decodeUnknownSync(EmailLikeString)("verylongusername@domain.com") // throws ParseError (too long)
 * ```
 *
 * @example
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * // Using with numeric validation
 * const numberValidator = Schema.asCheck(
 *   Check.greaterThan(0),
 *   Check.lessThanOrEqualTo(100)
 * )
 * const PositivePercentage = numberValidator(Schema.Number)
 *
 * console.log(Schema.decodeUnknownSync(PositivePercentage)(50)) // 50
 * // Schema.decodeUnknownSync(PositivePercentage)(-10) // throws ParseError
 * // Schema.decodeUnknownSync(PositivePercentage)(150) // throws ParseError
 * ```
 *
 * @category filtering
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
 * Creates a schema refinement that applies a type guard to narrow down the type of a schema.
 * This is useful for adding runtime type checking that also provides compile-time type safety.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Option } from "effect"
 *
 * // Create a schema that validates an Option<string> is Some
 * const SomeStringSchema = Schema.Option(Schema.String).pipe(
 *   Schema.guard(Option.isSome, { title: "must be Some" })
 * )
 *
 * // This will succeed - the value is Some and the type is narrowed
 * const result1 = Schema.decodeUnknownSync(SomeStringSchema)(Option.some("hello"))
 * console.log(result1) // { _id: "Option", _tag: "Some", value: "hello" }
 *
 * // This will fail - the value is None
 * try {
 *   const result2 = Schema.decodeUnknownSync(SomeStringSchema)(Option.none())
 * } catch (error) {
 *   console.log("Validation failed:", String(error))
 * }
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Array } from "effect"
 *
 * // Create a custom type guard for non-empty arrays
 * const isNonEmpty = <T>(arr: ReadonlyArray<T>): arr is readonly [T, ...T[]] =>
 *   arr.length > 0
 *
 * // Create a schema that validates an array is non-empty
 * const NonEmptyArraySchema = Schema.Array(Schema.String).pipe(
 *   Schema.guard(isNonEmpty, { title: "non-empty array" })
 * )
 *
 * // This will succeed - the array has elements and type is narrowed
 * const result1 = Schema.decodeUnknownSync(NonEmptyArraySchema)(["a", "b", "c"])
 * console.log(result1) // ["a", "b", "c"] with narrowed type
 *
 * // This will fail - the array is empty
 * try {
 *   const result2 = Schema.decodeUnknownSync(NonEmptyArraySchema)([])
 * } catch (error) {
 *   console.log("Validation failed:", String(error))
 * }
 * ```
 *
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
 * A schema for non-empty strings. Validates that a string has at least one character.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Basic usage
 * const schema = Schema.NonEmptyString
 *
 * // Successful validation
 * Schema.decodeUnknownSync(schema)("hello")     // "hello"
 * Schema.decodeUnknownSync(schema)("a")         // "a"
 * Schema.decodeUnknownSync(schema)("   ")       // "   " (spaces count as characters)
 *
 * // Validation failures
 * Schema.decodeUnknownSync(schema)("")          // throws ParseError
 * Schema.decodeUnknownSync(schema)(123)         // throws ParseError
 * Schema.decodeUnknownSync(schema)(null)        // throws ParseError
 * ```
 *
 * @category primitives
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
 * Creates a schema that validates a Map where keys and values must conform to the provided schemas.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a schema for a Map with string keys and number values
 * const stringNumberMapSchema = Schema.Map(Schema.String, Schema.Number)
 *
 * // Validate a Map with correct types
 * const validMap = new Map([
 *   ["one", 1],
 *   ["two", 2],
 *   ["three", 3]
 * ])
 *
 * const result = Schema.decodeUnknownSync(stringNumberMapSchema)(validMap)
 * console.log(result) // Map(3) { "one" => 1, "two" => 2, "three" => 3 }
 * ```
 *
 * @example Complex keys and values
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create a schema for a Map with complex types
 * const personSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const idSchema = Schema.Union([Schema.String, Schema.Number])
 * const personMapSchema = Schema.Map(idSchema, personSchema)
 *
 * // Validate a Map with complex types
 * const peopleMap = new Map<string | number, { name: string; age: number }>([
 *   ["p1", { name: "Alice", age: 30 }],
 *   [42, { name: "Bob", age: 25 }]
 * ])
 *
 * const result = Schema.decodeUnknownSync(personMapSchema)(peopleMap)
 * console.log(result) // Map with validated entries
 * ```
 *
 * @category constructors
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
 * Creates an opaque wrapper class for a schema that preserves the schema's shape
 * while providing type safety through a distinct class type.
 *
 * This function returns a higher-order function that takes a schema and returns
 * a new class that extends the original schema but with an opaque type identity.
 * The resulting class can be used for validation and construction while maintaining
 * type distinctness from the underlying schema.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create an opaque wrapper for a Person struct
 * class Person extends Schema.Opaque<Person>()(
 *   Schema.Struct({
 *     name: Schema.String,
 *     age: Schema.Number
 *   })
 * ) {}
 *
 * // The class can be used for validation and construction
 * const validPerson = Person.makeSync({ name: "John", age: 30 })
 * console.log(validPerson.name) // "John"
 * console.log(validPerson.age)  // 30
 *
 * // Access to the underlying schema fields
 * console.log(Person.fields.name) // Schema.String
 * console.log(Person.fields.age)  // Schema.Number
 *
 * // Type safety - Person is distinct from the raw object
 * const rawData = { name: "Jane", age: 25 }
 * // Person and rawData are different types even though they have the same shape
 * ```
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Create an opaque wrapper for a Product with validation
 * class Product extends Schema.Opaque<Product>()(
 *   Schema.Struct({
 *     id: Schema.String,
 *     name: Schema.String,
 *     price: Schema.Number
 *   })
 * ) {}
 *
 * // Valid usage
 * const product = Product.makeSync({
 *   id: "prod-123",
 *   name: "Widget",
 *   price: 29.99
 * })
 * console.log(product.id)    // "prod-123"
 * console.log(product.name)  // "Widget"
 * console.log(product.price) // 29.99
 *
 * // Type safety - Product is distinct from the raw object
 * const rawData = { id: "prod-456", name: "Gadget", price: 39.99 }
 * // Product and rawData are different types even though they have the same shape
 * ```
 *
 * @since 4.0.0
 * @category constructors
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
 * Creates a schema that validates an instance of a specific class constructor.
 *
 * This function creates a schema that uses the `instanceof` operator to validate that a value
 * is an instance of the specified constructor. It's particularly useful for validating custom
 * classes, built-in JavaScript objects, or any constructor-based types.
 *
 * @example Basic Class Validation
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * class Person {
 *   constructor(public name: string) {}
 * }
 *
 * const PersonSchema = Schema.instanceOf({ constructor: Person })
 *
 * const john = new Person("John")
 * const result = Schema.decodeSync(PersonSchema)(john)
 * console.log(result) // Person { name: "John" }
 *
 * // Validation fails for non-instances
 * try {
 *   Schema.decodeSync(PersonSchema)({ name: "John" })
 * } catch (error) {
 *   console.log("Not a Person instance!")
 * }
 * ```
 *
 * @example Built-in JavaScript Objects
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const DateSchema = Schema.instanceOf({ constructor: Date })
 * const ErrorSchema = Schema.instanceOf({ constructor: Error })
 *
 * // Valid instances
 * const date = new Date()
 * const error = new Error("Something went wrong")
 *
 * console.log(Schema.decodeSync(DateSchema)(date))     // Current date
 * console.log(Schema.decodeSync(ErrorSchema)(error))  // Error object
 * ```
 *
 * @example With Custom Error Classes
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * class CustomError extends Error {
 *   constructor(message: string, public code: number) {
 *     super(message)
 *     this.name = "CustomError"
 *   }
 * }
 *
 * const CustomErrorSchema = Schema.instanceOf({
 *   constructor: CustomError,
 *   annotations: {
 *     title: "CustomError",
 *     description: "A custom error with an error code"
 *   }
 * })
 *
 * const customError = new CustomError("Invalid operation", 404)
 * const result = Schema.decodeSync(CustomErrorSchema)(customError)
 * console.log(result.code) // 404
 * ```
 *
 * @example With Annotations and Transformations
 * ```ts
 * import { Schema, Transformation } from "effect/schema"
 *
 * class ApiError extends Error {
 *   constructor(message: string, public statusCode: number) {
 *     super(message)
 *     this.name = "ApiError"
 *   }
 * }
 *
 * const ApiErrorSchema = Schema.instanceOf({
 *   constructor: ApiError,
 *   annotations: {
 *     title: "ApiError",
 *     description: "API error with status code",
 *     defaultJsonSerializer: () =>
 *       Schema.link<ApiError>()(
 *         Schema.Struct({
 *           message: Schema.String,
 *           statusCode: Schema.Number
 *         }),
 *         Transformation.transform({
 *           decode: ({ message, statusCode }) => new ApiError(message, statusCode),
 *           encode: (error) => ({ message: error.message, statusCode: error.statusCode })
 *         })
 *       )
 *   }
 * })
 *
 * const apiError = new ApiError("Not found", 404)
 * const result = Schema.decodeSync(ApiErrorSchema)(apiError)
 * console.log(result.statusCode) // 404
 * ```
 *
 * @category constructors
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
 * Creates a link between a type and its encoded representation with a transformation.
 *
 * This function is primarily used for creating custom JSON serializers and deserializers
 * for complex types like class instances. It establishes a bidirectional transformation
 * between the original type and its encoded format.
 *
 * @example Basic Link with String Transformation
 * ```ts
 * import { Schema, Transformation } from "effect/schema"
 *
 * class MyError extends Error {
 *   constructor(message: string) {
 *     super(message)
 *   }
 * }
 *
 * const linkSchema = Schema.link<MyError>()(
 *   Schema.String,
 *   Transformation.transform({
 *     decode: (message) => new MyError(message),
 *     encode: (error) => error.message
 *   })
 * )
 * ```
 *
 * @example Link with Record Transformation
 * ```ts
 * import { Schema, Transformation } from "effect/schema"
 *
 * class Person {
 *   constructor(
 *     public name: string,
 *     public age: number
 *   ) {}
 * }
 *
 * const PersonSchema = Schema.link<Person>()(
 *   Schema.Struct({
 *     name: Schema.String,
 *     age: Schema.Number
 *   }),
 *   Transformation.transform({
 *     decode: (props) => new Person(props.name, props.age),
 *     encode: (person) => ({ name: person.name, age: person.age })
 *   })
 * )
 * ```
 *
 * @example Link for Custom JSON Serialization
 * ```ts
 * import { Schema, Transformation } from "effect/schema"
 *
 * class ApiError extends Error {
 *   constructor(
 *     message: string,
 *     public statusCode: number
 *   ) {
 *     super(message)
 *   }
 * }
 *
 * const ApiErrorSchema = Schema.instanceOf({
 *   constructor: ApiError,
 *   annotations: {
 *     title: "ApiError",
 *     defaultJsonSerializer: () =>
 *       Schema.link<ApiError>()(
 *         Schema.Struct({
 *           message: Schema.String,
 *           statusCode: Schema.Number
 *         }),
 *         Transformation.transform({
 *           decode: (props) => new ApiError(props.message, props.statusCode),
 *           encode: (error) => ({
 *             message: error.message,
 *             statusCode: error.statusCode
 *           })
 *         })
 *       )
 *   }
 * })
 * ```
 *
 * @category transformations
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
 * A schema for JavaScript `URL` objects that validates instances of the `URL` class.
 *
 * This schema accepts any valid `URL` instance and provides automatic serialization
 * to and from strings for JSON compatibility.
 *
 * @example Basic Usage
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.URL
 *
 * // Valid URL instances
 * Schema.decodeUnknownSync(schema)(new URL("https://example.com"))
 * // new URL("https://example.com/")
 *
 * Schema.decodeUnknownSync(schema)(new URL("https://api.example.com/users"))
 * // new URL("https://api.example.com/users")
 *
 * Schema.decodeUnknownSync(schema)(new URL("file:///path/to/file.txt"))
 * // new URL("file:///path/to/file.txt")
 * ```
 *
 * @example Usage in Structures
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const ApiConfigSchema = Schema.Struct({
 *   baseUrl: Schema.URL,
 *   webhookUrl: Schema.URL,
 *   timeout: Schema.Number
 * })
 *
 * const config = Schema.decodeUnknownSync(ApiConfigSchema)({
 *   baseUrl: new URL("https://api.example.com"),
 *   webhookUrl: new URL("https://webhook.example.com/notify"),
 *   timeout: 5000
 * })
 * // { baseUrl: URL, webhookUrl: URL, timeout: 5000 }
 * ```
 *
 * @example JSON Serialization
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.URL
 *
 * // URL is automatically serialized to string
 * const url = new URL("https://example.com")
 * const encoded = Schema.encodeSync(schema)(url)
 * // URL object (same instance for direct encoding)
 *
 * // For JSON serialization, URLs become strings
 * const jsonString = JSON.stringify(Schema.encodeSync(schema)(url))
 * // The URL will be serialized as a string in JSON format
 * ```
 *
 * @category instances
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
 * A schema for JavaScript `Date` objects that validates only valid dates.
 *
 * This schema accepts `Date` instances but rejects invalid dates (such as `new Date("invalid")`).
 * It extends the basic `Date` schema with a validation check that ensures the date is not NaN.
 *
 * @example Basic Usage
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.ValidDate
 *
 * // Successful validation
 * Schema.decodeUnknownSync(schema)(new Date("2023-10-01"))
 * // new Date("2023-10-01T00:00:00.000Z")
 *
 * Schema.decodeUnknownSync(schema)(new Date())
 * // Current date
 *
 * Schema.decodeUnknownSync(schema)(new Date(1696118400000))
 * // new Date("2023-10-01T00:00:00.000Z")
 * ```
 *
 * @example Validation Failures
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.ValidDate
 *
 * // Invalid Date instances are rejected
 * Schema.decodeUnknownSync(schema)(new Date("invalid"))
 * // throws ParseError
 *
 * Schema.decodeUnknownSync(schema)(new Date("not-a-date"))
 * // throws ParseError
 *
 * Schema.decodeUnknownSync(schema)(new Date(NaN))
 * // throws ParseError
 * ```
 *
 * @example Usage in Structures
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const EventSchema = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String,
 *   createdAt: Schema.ValidDate,
 *   updatedAt: Schema.ValidDate
 * })
 *
 * // This works
 * const event = Schema.decodeUnknownSync(EventSchema)({
 *   id: 1,
 *   name: "Meeting",
 *   createdAt: new Date("2023-10-01"),
 *   updatedAt: new Date("2023-10-02")
 * })
 * // { id: 1, name: "Meeting", createdAt: Date, updatedAt: Date }
 *
 * // This fails
 * Schema.decodeUnknownSync(EventSchema)({
 *   id: 1,
 *   name: "Meeting",
 *   createdAt: new Date("invalid"),
 *   updatedAt: new Date("2023-10-02")
 * })
 * // throws ParseError due to invalid createdAt
 * ```
 *
 * @category primitives
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
 * A transformation schema that parses a JSON string into an unknown value using
 * `JSON.parse()`. This is useful when you need to parse JSON strings where the
 * structure is not known beforehand.
 *
 * @example Basic JSON Parsing
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Parse JSON strings to unknown values
 * const result1 = Schema.decodeUnknownSync(Schema.UnknownFromJsonString)('{"name": "John", "age": 30}')
 * console.log(result1) // { name: "John", age: 30 }
 *
 * const result2 = Schema.decodeUnknownSync(Schema.UnknownFromJsonString)('[1, 2, 3]')
 * console.log(result2) // [1, 2, 3]
 *
 * const result3 = Schema.decodeUnknownSync(Schema.UnknownFromJsonString)('"hello"')
 * console.log(result3) // "hello"
 *
 * const result4 = Schema.decodeUnknownSync(Schema.UnknownFromJsonString)('42')
 * console.log(result4) // 42
 * ```
 *
 * @example Encoding Back to JSON String
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Encode values back to JSON strings
 * const encoded1 = Schema.encodeSync(Schema.UnknownFromJsonString)({ name: "Alice", age: 25 })
 * console.log(encoded1) // '{"name":"Alice","age":25}'
 *
 * const encoded2 = Schema.encodeSync(Schema.UnknownFromJsonString)([1, 2, 3])
 * console.log(encoded2) // '[1,2,3]'
 * ```
 *
 * @example Using with Further Validation
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Parse JSON and then validate the structure
 * const PersonSchema = Schema.Struct({
 *   name: Schema.String,
 *   age: Schema.Number
 * })
 *
 * const JsonPersonSchema = Schema.UnknownFromJsonString.pipe(
 *   Schema.decodeTo(PersonSchema)
 * )
 *
 * // Valid JSON person object
 * const person = Schema.decodeUnknownSync(JsonPersonSchema)('{"name": "Bob", "age": 35}')
 * console.log(person) // { name: "Bob", age: 35 }
 * ```
 *
 * @since 4.0.0
 * @category transformations
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
 * A schema for finite numbers that validates and ensures the value is a finite number,
 * excluding `NaN`, `Infinity`, and `-Infinity`.
 *
 * This schema is useful when you need to ensure that numeric values are real, finite numbers
 * suitable for mathematical operations.
 *
 * @example Basic Usage
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.Finite
 *
 * // Valid finite numbers
 * Schema.decodeUnknownSync(schema)(42)      // 42
 * Schema.decodeUnknownSync(schema)(-17.5)   // -17.5
 * Schema.decodeUnknownSync(schema)(0)       // 0
 * Schema.decodeUnknownSync(schema)(1e-10)   // 1e-10
 * ```
 *
 * @example Invalid Values
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * const schema = Schema.Finite
 *
 * // These will throw ParseError
 * try {
 *   Schema.decodeUnknownSync(schema)(NaN)
 * } catch (error) {
 *   console.log("NaN is not finite")
 * }
 *
 * try {
 *   Schema.decodeUnknownSync(schema)(Infinity)
 * } catch (error) {
 *   console.log("Infinity is not finite")
 * }
 *
 * try {
 *   Schema.decodeUnknownSync(schema)(-Infinity)
 * } catch (error) {
 *   console.log("-Infinity is not finite")
 * }
 * ```
 *
 * @example With Additional Constraints
 * ```ts
 * import { Schema, Check } from "effect/schema"
 *
 * // Combine with other checks for more specific validation
 * const PositiveFinite = Schema.Finite.check(Check.positive())
 * const FiniteInteger = Schema.Finite.check(Check.int())
 * const FiniteRange = Schema.Finite.check(Check.between(0, 100))
 *
 * Schema.decodeUnknownSync(PositiveFinite)(42)    // 42
 * Schema.decodeUnknownSync(FiniteInteger)(17)     // 17
 * Schema.decodeUnknownSync(FiniteRange)(75)       // 75
 * ```
 *
 * @example In Data Structures
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Use in records and structures
 * const FiniteRecord = Schema.Record(Schema.String, Schema.Finite)
 * const DataPoint = Schema.Struct({
 *   x: Schema.Finite,
 *   y: Schema.Finite,
 *   timestamp: Schema.Number
 * })
 *
 * Schema.decodeUnknownSync(FiniteRecord)({ a: 1.5, b: 2.7 })
 * // { a: 1.5, b: 2.7 }
 *
 * Schema.decodeUnknownSync(DataPoint)({ x: 10.5, y: -20.3, timestamp: Date.now() })
 * // { x: 10.5, y: -20.3, timestamp: 1640995200000 }
 * ```
 *
 * @category refinements
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
 * A transformation schema that parses a string into a finite number, rejecting
 * `NaN`, `Infinity`, and `-Infinity` values.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 *
 * // Basic usage - decode valid finite number strings
 * const result1 = Schema.decodeUnknownSync(Schema.FiniteFromString)("42")
 * console.log(result1) // 42
 *
 * const result2 = Schema.decodeUnknownSync(Schema.FiniteFromString)("-3.14")
 * console.log(result2) // -3.14
 *
 * // Encoding finite numbers back to strings
 * const encoded = Schema.encodeSync(Schema.FiniteFromString)(123.45)
 * console.log(encoded) // "123.45"
 *
 * // Rejection of non-finite values during parsing
 * try {
 *   Schema.decodeUnknownSync(Schema.FiniteFromString)("Infinity")
 * } catch (error) {
 *   console.log("Error: Infinity is not a finite number")
 * }
 *
 * try {
 *   Schema.decodeUnknownSync(Schema.FiniteFromString)("NaN")
 * } catch (error) {
 *   console.log("Error: NaN is not a finite number")
 * }
 * ```
 *
 * @since 4.0.0
 * @category transformations
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
