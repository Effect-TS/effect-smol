/**
 * @since 4.0.0
 */

import type * as AST from "./AST.ts"
import type * as Issue from "./Issue.ts"
import type * as Schema from "./Schema.ts"
import type * as ToArbitarary from "./ToArbitrary.ts"
import type * as ToEquivalence from "./ToEquivalence.ts"
import type * as ToJsonSchema from "./ToJsonSchema.ts"
import type * as ToPretty from "./ToPretty.ts"

/**
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
export interface Annotated {
  readonly annotations: Annotations | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Documentation extends Annotations {
  readonly title?: string | undefined
  readonly description?: string | undefined
  readonly documentation?: string | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Key extends Documentation {
  /**
   * The message to use when a key is missing.
   */
  readonly missingKeyMessage?: string | (() => string) | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface JsonSchema<T> extends Documentation {
  readonly identifier?: string | undefined
  readonly default?: T | undefined
  readonly examples?: ReadonlyArray<T> | undefined
  /**
   * Totally replace ("override") the default JSON Schema for this type.
   */
  readonly jsonSchema?: ToJsonSchema.Annotation.Override | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Bottom<T> extends JsonSchema<T> {
  readonly arbitrary?: ToArbitarary.Annotation.Override<T> | undefined
  readonly message?: string | (() => string) | undefined
  readonly formatter?: {
    readonly Tree?: {
      /**
       * This annotation allows you to add dynamic context to error messages by
       * generating titles based on the value being validated
       */
      readonly getTitle?: (issue: Issue.Issue) => string | undefined
    } | undefined
  } | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Struct<T> extends Bottom<T> {
  /**
   * The message to use when a key is unexpected.
   */
  readonly unexpectedKeyMessage?: string | (() => string) | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Declaration<T, TypeParameters extends ReadonlyArray<Schema.Top>> extends JsonSchema<T> {
  readonly defaultJsonSerializer?:
    | ((
      typeParameters: { readonly [K in keyof TypeParameters]: Schema.Schema<TypeParameters[K]["Encoded"]> }
    ) => AST.Link)
    | undefined
  readonly arbitrary?: ToArbitarary.Annotation.Declaration<T, TypeParameters> | undefined
  readonly equivalence?: ToEquivalence.Annotation.Declaration<T, TypeParameters> | undefined
  readonly pretty?: ToPretty.Annotation.Declaration<T, TypeParameters> | undefined
  /** @internal */
  readonly "~sentinels"?: ReadonlyArray<AST.Sentinel> | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Filter extends Documentation {
  /**
   * System annotation for branded types. Used internally to identify types that
   * carry a brand marker.
   */
  readonly "~brand.type"?: string | symbol | undefined

  /**
   * Marks the filter as *structural*, meaning it applies to the shape or
   * structure of the container (e.g., array length, object keys) rather than
   * the contents.
   *
   * Example: `minLength` on an array is a structural filter.
   */
  readonly "~structural"?: boolean | undefined

  /**
   * JSON Schema representation used for documentation or code generation. This
   * can be a single fragment or a list of fragments.
   */
  readonly jsonSchema?: ToJsonSchema.Annotation.Fragment | undefined

  /**
   * Optional metadata used to identify or extend the filter with custom data.
   */
  readonly meta?: {
    readonly _tag: string
    readonly [x: string]: unknown
  } | undefined

  readonly arbitrary?: ToArbitarary.Annotation.Fragment | ToArbitarary.Annotation.Fragments | undefined
  readonly message?: string | (() => string) | undefined
}
