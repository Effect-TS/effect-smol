/**
 * @since 4.0.0
 */

import type * as Schema from "./Schema.js"
import type * as SchemaAST from "./SchemaAST.js"
import type * as SchemaToArbitrary from "./SchemaToArbitrary.js"
import type * as SchemaToEquivalence from "./SchemaToEquivalence.js"
import type * as SchemaToJsonSchema from "./SchemaToJsonSchema.js"
import type * as SchemaToPretty from "./SchemaToPretty.js"

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
  readonly missingMessage?: string | (() => string) | undefined
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
   * Totally replace (“override”) the default JSON Schema for this type.
   */
  readonly jsonSchema?: SchemaToJsonSchema.Annotation.Override | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Bottom<T> extends JsonSchema<T> {
  readonly arbitrary?: SchemaToArbitrary.Annotation.Override<T> | undefined
  readonly message?: string | (() => string) | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Declaration<T, TypeParameters extends ReadonlyArray<Schema.Top>> extends JsonSchema<T> {
  readonly constructorTitle?: string | undefined
  readonly defaultJsonSerializer?:
    | ((
      typeParameters: { readonly [K in keyof TypeParameters]: Schema.Schema<TypeParameters[K]["Encoded"]> }
    ) => SchemaAST.Link)
    | undefined
  readonly arbitrary?: SchemaToArbitrary.Annotation.Declaration<T, TypeParameters> | undefined
  readonly equivalence?: SchemaToEquivalence.Annotation.Declaration<T, TypeParameters> | undefined
  readonly pretty?: SchemaToPretty.Annotation.Declaration<T, TypeParameters> | undefined
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
  readonly jsonSchema?:
    | SchemaToJsonSchema.Annotation.Fragment
    | SchemaToJsonSchema.Annotation.Fragments
    | undefined

  /**
   * Optional metadata used to identify or extend the filter with custom data.
   */
  readonly meta?: {
    readonly id: string
    readonly [x: string]: unknown
  } | undefined

  readonly arbitrary?: SchemaToArbitrary.Annotation.Fragment | SchemaToArbitrary.Annotation.Fragments | undefined
  readonly message?: string | (() => string) | undefined
}
