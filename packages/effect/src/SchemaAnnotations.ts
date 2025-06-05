/**
 * @since 4.0.0
 */

import * as Option from "./Option.js"
import type * as Schema from "./Schema.js"
import type * as SchemaAST from "./SchemaAST.js"
import type { JsonSchema } from "./SchemaToJsonSchema.js"

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
export interface Bottom<T> extends Documentation {
  readonly identifier?: string | undefined
  readonly default?: T | undefined
  readonly examples?: ReadonlyArray<T> | undefined
  /**
   * Totally replace (“override”) the default JSON Schema for this type.
   */
  readonly jsonSchema?: {
    readonly type: "override"
    readonly override: (defaultJson: JsonSchema) => JsonSchema
  } | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Declaration<T, TypeParameters extends ReadonlyArray<Schema.Top>> extends Bottom<T> {
  readonly constructorTitle?: string | undefined
  readonly defaultJsonSerializer?:
    | ((
      typeParameters: { readonly [K in keyof TypeParameters]: Schema.Schema<TypeParameters[K]["Encoded"]> }
    ) => SchemaAST.Link)
    | undefined
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
  readonly jsonSchema?: {
    readonly type: "fragment"
    readonly fragment: JsonSchema
  } | {
    readonly type: "fragments"
    readonly fragments: Record<string, JsonSchema>
  } | undefined

  /**
   * Optional metadata used to identify or extend the filter with custom data.
   */
  readonly meta?: {
    readonly id: string
    readonly [x: string]: unknown
  } | undefined
}

/**
 * @since 4.0.0
 */
export const get = (key: string) => (annotations: Annotations | undefined): Option.Option<unknown> => {
  if (annotations && Object.hasOwn(annotations, key)) {
    return Option.some(annotations[key])
  }
  return Option.none()
}
