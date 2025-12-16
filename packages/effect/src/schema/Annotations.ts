/**
 * @since 4.0.0
 */

import type { Equivalence } from "../Equivalence.ts"
import type { Formatter } from "../Formatter.ts"
import { memoize } from "../Function.ts"
import type * as FastCheck from "../testing/FastCheck.ts"
import type * as AST from "./AST.ts"
import type * as Schema from "./Schema.ts"

/**
 * This interface is used to define the annotations that can be attached to a
 * schema. You can extend this interface to define your own annotations.
 *
 * Note that both a missing key or `undefined` is used to indicate that the
 * annotation is not present.
 *
 * This means that can remove any annotation by setting it to `undefined`.
 *
 * **Example** (Defining your own annotations)
 *
 * ```ts
 * import { Annotations, Schema } from "effect/schema"
 *
 * // Extend the Annotations interface with a custom `version` annotation
 * declare module "effect/schema/Annotations" {
 *   interface Annotations {
 *     readonly version?: readonly [major: number, minor: number, patch: number] | undefined
 *   }
 * }
 *
 * // The `version` annotation is now recognized by the TypeScript compiler
 * const schema = Schema.String.annotate({ version: [1, 2, 0] })
 *
 * // const version: readonly [major: number, minor: number, patch: number] | undefined
 * const version = Annotations.resolveInto(schema)?.["version"]
 *
 * if (version) {
 *   // Access individual parts of the version
 *   console.log(version[1])
 *   // Output: 2
 * }
 * ```
 *
 * @category Model
 * @since 4.0.0
 */
export interface Annotations {
  readonly [x: string]: unknown
}

/**
 * @since 4.0.0
 */
export interface Documentation extends Annotations {
  readonly expected?: string | undefined
  readonly title?: string | undefined
  readonly description?: string | undefined
  readonly documentation?: string | undefined
}

/**
 * @since 4.0.0
 */
export interface TypedDocumentation<T> extends Documentation {
  readonly default?: T | undefined
  readonly examples?: ReadonlyArray<T> | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Key<T> extends TypedDocumentation<T> {
  /**
   * The message to use when a key is missing.
   */
  readonly messageMissingKey?: string | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Bottom<T, TypeParameters extends ReadonlyArray<Schema.Top>> extends TypedDocumentation<T> {
  /**
   * The message to use when the value is invalid.
   */
  readonly message?: string | undefined
  /**
   * The message to use when a key is unexpected.
   */
  readonly messageUnexpectedKey?: string | undefined
  readonly identifier?: string | undefined
  readonly parseOptions?: AST.ParseOptions | undefined
  /**
   * Optional metadata used to identify or extend the filter with custom data.
   */
  readonly meta?: Meta | undefined
  readonly toJsonSchema?:
    | JsonSchema.ToJsonSchema<TypeParameters>
    | undefined
  readonly toArbitrary?:
    | Arbitrary.ToArbitrary<T, TypeParameters>
    | undefined
}

/**
 * @since 4.0.0
 */
export declare namespace TypeParameters {
  /**
   * @since 4.0.0
   */
  export type Type<TypeParameters extends ReadonlyArray<Schema.Top>> = {
    readonly [K in keyof TypeParameters]: Schema.Codec<TypeParameters[K]["Type"]>
  }
  /**
   * @since 4.0.0
   */
  export type Encoded<TypeParameters extends ReadonlyArray<Schema.Top>> = {
    readonly [K in keyof TypeParameters]: Schema.Codec<TypeParameters[K]["Encoded"]>
  }
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Declaration<T, TypeParameters extends ReadonlyArray<Schema.Top> = readonly []>
  extends Bottom<T, TypeParameters>
{
  readonly "toCodec*"?:
    | ((typeParameters: TypeParameters.Encoded<TypeParameters>) => AST.Link)
    | undefined
  readonly toCodecJson?:
    | ((typeParameters: TypeParameters.Encoded<TypeParameters>) => AST.Link)
    | undefined
  readonly toCodecIso?:
    | ((typeParameters: TypeParameters.Type<TypeParameters>) => AST.Link)
    | undefined
  readonly toJsonSchema?: JsonSchema.ToJsonSchema<TypeParameters> | undefined
  readonly toArbitrary?: Arbitrary.ToArbitrary<T, TypeParameters> | undefined
  readonly toEquivalence?: Equivalence.ToEquivalence<T, TypeParameters> | undefined
  readonly toFormatter?: Formatter.ToFormatter<T, TypeParameters> | undefined
  /**
   * Used to collect sentinels from a Declaration AST.
   *
   * @internal
   */
  readonly "~sentinels"?: ReadonlyArray<AST.Sentinel> | undefined
  readonly typeConstructor?: string | undefined
}

/** @internal */
export const STRUCTURAL_ANNOTATION_KEY = "~structural"

/**
 * **Technical Note**
 *
 * This annotation group is not parametric since it would make the filters
 * invariant
 *
 * @category Model
 * @since 4.0.0
 */
export interface Filter extends Documentation {
  readonly message?: string | undefined
  readonly identifier?: string | undefined
  /**
   * Optional metadata used to identify or extend the filter with custom data.
   */
  readonly meta?: Meta | undefined
  readonly toJsonSchemaConstraint?:
    | JsonSchema.ToJsonSchemaConstraint
    | undefined
  readonly toArbitraryConstraint?:
    | Arbitrary.ToArbitraryConstraint
    | undefined
  /**
   * Marks the filter as *structural*, meaning it applies to the shape or
   * structure of the container (e.g., array length, object keys) rather than
   * the contents.
   *
   * Example: `minLength` on an array is a structural filter.
   */
  readonly "~structural"?: boolean | undefined
}

/**
 * @since 4.0.0
 */
export declare namespace Arbitrary {
  /**
   * @since 4.0.0
   */
  export interface StringConstraints extends FastCheck.StringSharedConstraints {
    readonly patterns?: readonly [string, ...Array<string>]
  }

  /**
   * @since 4.0.0
   */
  export interface NumberConstraints extends FastCheck.FloatConstraints {
    readonly isInteger?: boolean
  }

  /**
   * @since 4.0.0
   */
  export interface BigIntConstraints extends FastCheck.BigIntConstraints {}

  /**
   * @since 4.0.0
   */
  export interface ArrayConstraints extends FastCheck.ArrayConstraints {
    readonly comparator?: (a: any, b: any) => boolean
  }

  /**
   * @since 4.0.0
   */
  export interface DateConstraints extends FastCheck.DateConstraints {}

  /**
   * @since 4.0.0
   */
  export interface ToArbitraryConstraint {
    readonly string?: StringConstraints | undefined
    readonly number?: NumberConstraints | undefined
    readonly bigint?: BigIntConstraints | undefined
    readonly array?: ArrayConstraints | undefined
    readonly date?: DateConstraints | undefined
  }

  /**
   * @since 4.0.0
   */
  export interface Context {
    /**
     * This flag is set to `true` when the current schema is a suspend. The goal
     * is to avoid infinite recursion when generating arbitrary values for
     * suspends, so implementations should try to avoid excessive recursion.
     */
    readonly isSuspend?: boolean | undefined
    readonly constraints?: Arbitrary.ToArbitraryConstraint | undefined
  }

  /**
   * @since 4.0.0
   */
  export interface ToArbitrary<T, TypeParameters extends ReadonlyArray<Schema.Top>> {
    (
      /* Arbitraries for any type parameters of the schema (if present) */
      typeParameters: { readonly [K in keyof TypeParameters]: FastCheck.Arbitrary<TypeParameters[K]["Type"]> }
    ): (fc: typeof FastCheck, context: Context) => FastCheck.Arbitrary<T>
  }
}

/**
 * @since 4.0.0
 */
export declare namespace Formatter {
  /**
   * @since 4.0.0
   */
  export interface ToFormatter<T, TypeParameters extends ReadonlyArray<Schema.Top>> {
    (
      /* Formatters for any type parameters of the schema (if present) */
      typeParameters: { readonly [K in keyof TypeParameters]: Formatter<TypeParameters[K]["Type"]> }
    ): Formatter<T>
  }
}

/**
 * @since 4.0.0
 */
export declare namespace Equivalence {
  /**
   * @since 4.0.0
   */
  export interface ToEquivalence<T, TypeParameters extends ReadonlyArray<Schema.Top>> {
    (
      /* Equivalences for any type parameters of the schema (if present) */
      typeParameters: { readonly [K in keyof TypeParameters]: Equivalence<TypeParameters[K]["Type"]> }
    ): Equivalence<T>
  }
}

/**
 * @since 4.0.0
 */
export declare namespace JsonSchema {
  /**
   * @since 4.0.0
   */
  export interface ConstraintContext {
    /** The target of the JSON Schema */
    readonly target: Schema.JsonSchema.Target
    /** The type of the JSON Schema */
    readonly type?: Schema.JsonSchema.Type | undefined
  }

  /**
   * @since 4.0.0
   */
  export interface ToJsonSchemaConstraint {
    (context: ConstraintContext): Schema.JsonSchema | undefined
  }

  /**
   * @since 4.0.0
   */
  export interface Context<TypeParameters extends ReadonlyArray<Schema.Top>> {
    /** Json Schemas for any type parameters of the schema (if present) */
    readonly typeParameters: { readonly [K in keyof TypeParameters]: Schema.JsonSchema }
    /** The target of the JSON Schema */
    readonly target: Schema.JsonSchema.Target
    /** The default JSON Schema that would be generated by the AST */
    readonly jsonSchema: Schema.JsonSchema
    /** A function that generates a JSON Schema from an AST, respecting the target and the options */
    readonly make: (ast: AST.AST) => Schema.JsonSchema
  }

  /**
   * @since 4.0.0
   */
  export interface ToJsonSchema<TypeParameters extends ReadonlyArray<Schema.Top>> {
    (context: Context<TypeParameters>): Schema.JsonSchema
  }
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Issue extends Annotations {
  readonly message?: string | undefined
}

/**
 * This MUST NOT be extended with custom meta.
 *
 * @since 4.0.0
 */
export interface BuiltInMetaRegistry {
  // String Meta
  readonly isNumberString: {
    readonly _tag: "isNumberString"
    readonly regExp: RegExp
  }
  readonly isBigIntString: {
    readonly _tag: "isBigIntString"
    readonly regExp: RegExp
  }
  readonly isSymbolString: {
    readonly _tag: "isSymbolString"
    readonly regExp: RegExp
  }
  readonly isMinLength: {
    readonly _tag: "isMinLength"
    readonly minLength: number
  }
  readonly isMaxLength: {
    readonly _tag: "isMaxLength"
    readonly maxLength: number
  }
  readonly isLength: {
    readonly _tag: "isLength"
    readonly length: number
  }
  readonly isPattern: {
    readonly _tag: "isPattern"
    readonly regExp: RegExp
  }
  readonly isTrimmed: {
    readonly _tag: "isTrimmed"
    readonly regExp: RegExp
  }
  readonly isUUID: {
    readonly _tag: "isUUID"
    readonly regExp: RegExp
    readonly version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | undefined
  }
  readonly isULID: {
    readonly _tag: "isULID"
    readonly regExp: RegExp
  }
  readonly isBase64: {
    readonly _tag: "isBase64"
    readonly regExp: RegExp
  }
  readonly isBase64Url: {
    readonly _tag: "isBase64Url"
    readonly regExp: RegExp
  }
  readonly isStartsWith: {
    readonly _tag: "isStartsWith"
    readonly startsWith: string
    readonly regExp: RegExp
  }
  readonly isEndsWith: {
    readonly _tag: "isEndsWith"
    readonly endsWith: string
    readonly regExp: RegExp
  }
  readonly isIncludes: {
    readonly _tag: "isIncludes"
    readonly includes: string
    readonly regExp: RegExp
  }
  readonly isUppercased: {
    readonly _tag: "isUppercased"
    readonly regExp: RegExp
  }
  readonly isLowercased: {
    readonly _tag: "isLowercased"
    readonly regExp: RegExp
  }
  readonly isCapitalized: {
    readonly _tag: "isCapitalized"
    readonly regExp: RegExp
  }
  readonly isUncapitalized: {
    readonly _tag: "isUncapitalized"
    readonly regExp: RegExp
  }
  // Number Meta
  readonly isFinite: {
    readonly _tag: "isFinite"
  }
  readonly isInt: {
    readonly _tag: "isInt"
  }
  readonly isMultipleOf: {
    readonly _tag: "isMultipleOf"
    readonly divisor: number
  }
  readonly isGreaterThan: {
    readonly _tag: "isGreaterThan"
    readonly exclusiveMinimum: number
  }
  readonly isGreaterThanOrEqualTo: {
    readonly _tag: "isGreaterThanOrEqualTo"
    readonly minimum: number
  }
  readonly isLessThan: {
    readonly _tag: "isLessThan"
    readonly exclusiveMaximum: number
  }
  readonly isLessThanOrEqualTo: {
    readonly _tag: "isLessThanOrEqualTo"
    readonly maximum: number
  }
  readonly isBetween: {
    readonly _tag: "isBetween"
    readonly minimum: number
    readonly maximum: number
  }
  // BigInt Meta
  readonly isGreaterThanBigInt: {
    readonly _tag: "isGreaterThanBigInt"
    readonly exclusiveMinimum: bigint
  }
  readonly isGreaterThanOrEqualToBigInt: {
    readonly _tag: "isGreaterThanOrEqualToBigInt"
    readonly minimum: bigint
  }
  readonly isLessThanBigInt: {
    readonly _tag: "isLessThanBigInt"
    readonly exclusiveMaximum: bigint
  }
  readonly isLessThanOrEqualToBigInt: {
    readonly _tag: "isLessThanOrEqualToBigInt"
    readonly maximum: bigint
  }
  readonly isBetweenBigInt: {
    readonly _tag: "isBetweenBigInt"
    readonly minimum: bigint
    readonly maximum: bigint
  }
  // Date Meta
  readonly isValidDate: {
    readonly _tag: "isValidDate"
  }
  readonly isGreaterThanDate: {
    readonly _tag: "isGreaterThanDate"
    readonly exclusiveMinimum: Date
  }
  readonly isGreaterThanOrEqualToDate: {
    readonly _tag: "isGreaterThanOrEqualToDate"
    readonly minimum: Date
  }
  readonly isLessThanDate: {
    readonly _tag: "isLessThanDate"
    readonly exclusiveMaximum: Date
  }
  readonly isLessThanOrEqualToDate: {
    readonly _tag: "isLessThanOrEqualToDate"
    readonly maximum: Date
  }
  readonly isBetweenDate: {
    readonly _tag: "isBetweenDate"
    readonly minimum: Date
    readonly maximum: Date
  }
  // Objects Meta
  readonly isMinProperties: {
    readonly _tag: "isMinProperties"
    readonly minProperties: number
  }
  readonly isMaxProperties: {
    readonly _tag: "isMaxProperties"
    readonly maxProperties: number
  }
  readonly isPropertiesLength: {
    readonly _tag: "isPropertiesLength"
    readonly length: number
  }
  // Arrays Meta
  readonly isUnique: {
    readonly _tag: "isUnique"
    readonly equivalence: Equivalence<any>
  }
  // Declaration Meta
  readonly isMinSize: {
    readonly _tag: "isMinSize"
    readonly minSize: number
  }
  readonly isMaxSize: {
    readonly _tag: "isMaxSize"
    readonly maxSize: number
  }
  readonly isSize: {
    readonly _tag: "isSize"
    readonly size: number
  }
}

/**
 * @since 4.0.0
 */
export type BuiltInMeta = BuiltInMetaRegistry[keyof BuiltInMetaRegistry]

/**
 * This MAY be extended with custom meta.
 *
 * @since 4.0.0
 */
export interface MetaRegistry extends BuiltInMetaRegistry {}

/**
 * @since 4.0.0
 */
export type Meta = MetaRegistry[keyof MetaRegistry]

/**
 * Get all annotations from the AST.
 * If the AST has checks, it will return the annotations from the last check.
 *
 * @category AST Resolvers
 * @since 4.0.0
 */
export function resolve(ast: AST.AST): Annotations | undefined {
  return ast.checks ? ast.checks[ast.checks.length - 1].annotations : ast.annotations
}

/**
 * Get an annotation from the AST.
 * If the AST has checks, it will return the annotations from the last check.
 *
 * @category AST Resolvers
 * @since 4.0.0
 */
export function resolveAt<A>(key: string) {
  return (ast: AST.AST): A | undefined => resolve(ast)?.[key] as A | undefined
}

/**
 * @category AST Resolvers
 * @since 4.0.0
 */
export const resolveIdentifier = resolveAt<string>("identifier")

/**
 * @category AST Resolvers
 * @since 4.0.0
 */
export const resolveTitle = resolveAt<string>("title")

/**
 * @category AST Resolvers
 * @since 4.0.0
 */
export const resolveDescription = resolveAt<string>("description")

/** @internal */
export const getExpected = memoize((ast: AST.AST): string => {
  return resolveIdentifier(ast) ?? ast.getExpected(getExpected)
})

/**
 * Return all the typed annotations from the schema.
 *
 * @category Schema Resolvers
 * @since 4.0.0
 */
export function resolveInto<S extends Schema.Top>(schema: S): S["~annotate.in"] | undefined {
  return resolve(schema.ast)
}
