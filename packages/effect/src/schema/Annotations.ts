/**
 * @since 4.0.0
 */

import type { Equivalence } from "../data/Equivalence.ts"
import type { Format } from "../data/Format.ts"
import * as Predicate from "../data/Predicate.ts"
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
 * // Retrieve the annotation using `getUnsafe`
 * const version = Annotations.getUnsafe(schema)?.["version"]
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
 * @category Model
 * @since 4.0.0
 */
export interface Documentation<T> extends Annotations {
  readonly expected?: string | undefined
  readonly title?: string | undefined
  readonly description?: string | undefined
  readonly documentation?: string | undefined
  readonly default?: T | undefined
  readonly examples?: ReadonlyArray<T> | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Key<T> extends Documentation<T> {
  /**
   * The message to use when a key is missing.
   */
  readonly messageMissingKey?: string | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Bottom<T, TypeParameters extends ReadonlyArray<Schema.Top>> extends Documentation<T> {
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
  readonly jsonSchema?:
    | JsonSchema.Override<TypeParameters>
    | undefined
  readonly arbitrary?:
    | Arbitrary.Override<T, TypeParameters>
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
  /** Used by both JSON and ISO serializers */
  readonly serializer?:
    | ((typeParameters: TypeParameters.Encoded<TypeParameters>) => AST.Link)
    | undefined
  /** Used only by JSON serializers */
  readonly defaultJsonSerializer?:
    | ((typeParameters: TypeParameters.Encoded<TypeParameters>) => AST.Link)
    | undefined
  /** Used only by ISO serializers */
  readonly defaultIsoSerializer?:
    | ((typeParameters: TypeParameters.Type<TypeParameters>) => AST.Link)
    | undefined
  readonly jsonSchema?: JsonSchema.Override<TypeParameters> | undefined
  readonly arbitrary?: Arbitrary.Override<T, TypeParameters> | undefined
  readonly equivalence?: Equivalence.Override<T, TypeParameters> | undefined
  readonly format?: Format.Override<T, TypeParameters> | undefined
  /** @internal */
  readonly "~sentinels"?: ReadonlyArray<AST.Sentinel> | undefined
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
export interface Filter extends Annotations {
  readonly expected?: string | undefined
  readonly title?: string | undefined
  readonly description?: string | undefined
  readonly documentation?: string | undefined
  readonly message?: string | undefined
  readonly identifier?: string | undefined
  /**
   * Optional metadata used to identify or extend the filter with custom data.
   */
  readonly meta?: Meta | undefined
  readonly jsonSchema?:
    | JsonSchema.Constraint
    | undefined
  readonly arbitrary?:
    | Arbitrary.Constraint
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
  export type FastCheckConstraint =
    | StringConstraints
    | NumberConstraints
    | BigIntConstraints
    | ArrayConstraints
    | DateConstraints

  /**
   * @since 4.0.0
   */
  export type Constraint = {
    readonly _tag: "Constraint"
    readonly constraint: {
      readonly string?: StringConstraints | undefined
      readonly number?: NumberConstraints | undefined
      readonly bigint?: BigIntConstraints | undefined
      readonly array?: ArrayConstraints | undefined
      readonly date?: DateConstraints | undefined
    }
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
    readonly constraints?: Arbitrary.Constraint["constraint"] | undefined
  }

  /**
   * @since 4.0.0
   */
  export type Override<T, TypeParameters extends ReadonlyArray<Schema.Top>> = {
    readonly _tag: "Override"
    readonly override: (
      /* Arbitraries for any type parameters of the schema (if present) */
      typeParameters: { readonly [K in keyof TypeParameters]: FastCheck.Arbitrary<TypeParameters[K]["Type"]> }
    ) => (fc: typeof FastCheck, context?: Context) => FastCheck.Arbitrary<T>
  }
}

/**
 * @since 4.0.0
 */
export declare namespace Format {
  /**
   * @since 4.0.0
   */
  export type Override<T, TypeParameters extends ReadonlyArray<Schema.Top>> = {
    readonly _tag: "Override"
    readonly override: (
      /* Formatters for any type parameters of the schema (if present) */
      typeParameters: { readonly [K in keyof TypeParameters]: Format<TypeParameters[K]["Type"]> }
    ) => Format<T>
  }
}

/**
 * @since 4.0.0
 */
export declare namespace Equivalence {
  /**
   * @since 4.0.0
   */
  export type Override<T, TypeParameters extends ReadonlyArray<Schema.Top>> = {
    readonly _tag: "Override"
    readonly override: (
      /* Equivalences for any type parameters of the schema (if present) */
      typeParameters: { readonly [K in keyof TypeParameters]: Equivalence<TypeParameters[K]["Type"]> }
    ) => Equivalence<T>
  }
}

/**
 * @since 4.0.0
 */
export declare namespace JsonSchema {
  /**
   * @since 4.0.0
   */
  export type Target = "draft-07" | "2020-12" | "oas3.1"

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
  export interface JsonSchema {
    type?: Type
    [x: string]: unknown
  }

  /**
   * @since 4.0.0
   */
  export type ConstraintContext = {
    /** The target of the JSON Schema */
    readonly target: Target
    /** The type of the JSON Schema */
    readonly type?: Type | undefined
  }

  /**
   * @since 4.0.0
   */
  export type Constraint = {
    readonly _tag: "Constraint"
    readonly constraint: (context: ConstraintContext) => Fragment | undefined
  }

  /**
   * @since 4.0.0
   */
  export type Context<TypeParameters extends ReadonlyArray<Schema.Top>> = {
    /** Json Schemas for any type parameters of the schema (if present) */
    readonly typeParameters: { readonly [K in keyof TypeParameters]: JsonSchema }
    /** The target of the JSON Schema */
    readonly target: Target
    /** The default JSON Schema that would be generated by the AST */
    readonly jsonSchema: JsonSchema
    /** A function that generates a JSON Schema from an AST, respecting the target and the options */
    readonly make: (ast: AST.AST) => JsonSchema
  }

  /**
   * @since 4.0.0
   */
  export type Override<TypeParameters extends ReadonlyArray<Schema.Top>> = {
    readonly _tag: "Override"
    readonly override: (context: Context<TypeParameters>) => JsonSchema
  }
}

/**
 * Merges annotations while preserving getters from both objects.
 *
 * **Warning**. Any existing `identifier` annotation will be removed.
 *
 * @internal
 */
export function combine<A extends Annotations>(existing: A, incoming: A | undefined): A
export function combine<A extends Annotations>(existing: A | undefined, incoming: A): A
export function combine<A extends Annotations>(existing: A | undefined, incoming: A | undefined): A | undefined
export function combine<A extends Annotations>(existing: A | undefined, incoming: A | undefined): A | undefined {
  if (!existing) return incoming
  if (!incoming) return existing

  const out: any = {}
  // Apply existing descriptors first
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(existing))) {
    Object.defineProperty(out, key, descriptor)
  }
  // Apply incoming descriptors (this will override existing ones)
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(incoming))) {
    Object.defineProperty(out, key, descriptor)
  }
  return out
}

/**
 * Get all annotations from the AST.
 * If the AST has checks, it will return the annotations from the last check.
 *
 * @since 4.0.0
 */
export function get(ast: AST.AST): Annotations | undefined {
  return ast.checks ? ast.checks[ast.checks.length - 1].annotations : ast.annotations
}

/**
 * Get an annotation from the AST.
 * If the AST has checks, it will return the annotations from the last check.
 *
 * @since 4.0.0
 */
export function getAt<A>(key: string, parser: (u: unknown) => u is A) {
  return (ast: AST.AST): A | undefined => {
    const value = get(ast)?.[key]
    if (parser(value)) return value
  }
}

/**
 * @since 4.0.0
 */
export const getIdentifier = getAt("identifier", Predicate.isString)

/**
 * @since 4.0.0
 */
export const getTitle = getAt("title", Predicate.isString)

/**
 * @since 4.0.0
 */
export const getDescription = getAt("description", Predicate.isString)

/** @internal */
export const getExpected = memoize((ast: AST.AST): string => {
  return getIdentifier(ast) ?? ast.getExpected(getExpected)
})

/** @internal */
export const BRAND_ANNOTATION_KEY = "~effect/schema/Check/brand"

/** @internal */
export function getBrand<T>(check: AST.Check<T>): string | symbol | undefined {
  const brand = check.annotations?.[BRAND_ANNOTATION_KEY]
  if (Predicate.isString(brand) || Predicate.isSymbol(brand)) {
    return brand
  }
}

/**
 * Return all the typed annotations from the schema.
 *
 * This function is potentially unsafe because it returns the annotations as
 * they are stored in the AST, without any validation.
 *
 * @since 4.0.0
 */
export function getUnsafe<S extends Schema.Top>(schema: S): S["~annotate.in"] | undefined {
  return get(schema.ast)
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Issue extends Annotations {
  readonly message?: string | undefined
}

/**
 * @since 4.0.0
 */
export interface MetaRegistry {
  readonly isNumberString: {
    readonly _tag: "isNumberString"
    readonly regex: RegExp
  }
  readonly isBigIntString: {
    readonly _tag: "isBigIntString"
    readonly regex: RegExp
  }
  readonly isSymbolString: {
    readonly _tag: "isSymbolString"
    readonly regex: RegExp
  }
  readonly isPattern: {
    readonly _tag: "isPattern"
    readonly regex: RegExp
  }
  readonly isTrimmed: {
    readonly _tag: "isTrimmed"
  }
  readonly isUUID: {
    readonly _tag: "isUUID"
    readonly regex: RegExp
  }
  readonly isULID: {
    readonly _tag: "isULID"
    readonly regex: RegExp
  }
  readonly isBase64: {
    readonly _tag: "isBase64"
    readonly regex: RegExp
  }
  readonly isBase64Url: {
    readonly _tag: "isBase64Url"
    readonly regex: RegExp
  }
  readonly isStartsWith: {
    readonly _tag: "isStartsWith"
    readonly startsWith: string
  }
  readonly isEndsWith: {
    readonly _tag: "isEndsWith"
    readonly endsWith: string
  }
  readonly isIncludes: {
    readonly _tag: "isIncludes"
    readonly includes: string
  }
  readonly isUppercased: {
    readonly _tag: "isUppercased"
  }
  readonly isLowercased: {
    readonly _tag: "isLowercased"
  }
  readonly isCapitalized: {
    readonly _tag: "isCapitalized"
  }
  readonly isUncapitalized: {
    readonly _tag: "isUncapitalized"
  }
  readonly isFinite: {
    readonly _tag: "isFinite"
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
  readonly isInt: {
    readonly _tag: "isInt"
  }
  readonly isInt32: {
    readonly _tag: "isInt32"
  }
  readonly isUint32: {
    readonly _tag: "isUint32"
  }
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
  readonly isMinEntries: {
    readonly _tag: "isMinEntries"
    readonly minEntries: number
  }
  readonly isMaxEntries: {
    readonly _tag: "isMaxEntries"
    readonly maxEntries: number
  }
  readonly isEntriesLength: {
    readonly _tag: "isEntriesLength"
    readonly length: number
  }
  readonly isUnique: {
    readonly _tag: "isUnique"
    readonly equivalence: Equivalence<any>
  }
}

/**
 * @since 4.0.0
 */
export type Meta = MetaRegistry[keyof MetaRegistry]
