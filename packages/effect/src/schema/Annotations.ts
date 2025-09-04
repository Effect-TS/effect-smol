/**
 * @since 4.0.0
 */

import type * as AST from "./AST.ts"
import type * as Schema from "./Schema.ts"
import type * as ToArbitrary from "./ToArbitrary.ts"
import type * as ToEquivalence from "./ToEquivalence.ts"
import type * as ToFormat from "./ToFormat.ts"
import type * as ToJsonSchema from "./ToJsonSchema.ts"

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
  readonly contentEncoding?: string | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Key<T> extends Documentation {
  /**
   * The message to use when a key is missing.
   */
  readonly missingKeyMessage?: string | undefined

  readonly default?: T | undefined
  readonly examples?: ReadonlyArray<T> | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Bottom<T> extends Documentation {
  readonly id?: string | undefined
  readonly default?: T | undefined
  readonly examples?: ReadonlyArray<T> | undefined
  readonly jsonSchema?: ToJsonSchema.Annotation.Override | ToJsonSchema.Annotation.Constraint | undefined
  readonly arbitrary?: ToArbitrary.Annotation.Override<T> | undefined
  readonly message?: string | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Struct<T> extends Bottom<T> {
  /**
   * The message to use when a key is unexpected.
   */
  readonly unexpectedKeyMessage?: string | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Declaration<T, TypeParameters extends ReadonlyArray<Schema.Top>> extends Documentation {
  readonly id?: string | undefined
  readonly default?: T | undefined
  readonly examples?: ReadonlyArray<T> | undefined
  readonly jsonSchema?: ToJsonSchema.Annotation.Override | undefined
  readonly defaultJsonSerializer?:
    | ((
      typeParameters: { readonly [K in keyof TypeParameters]: Schema.Schema<TypeParameters[K]["Encoded"]> }
    ) => AST.Link)
    | undefined
  readonly arbitrary?: ToArbitrary.Annotation.Declaration<T, TypeParameters> | undefined
  readonly equivalence?: ToEquivalence.Annotation.Declaration<T, TypeParameters> | undefined
  readonly format?: ToFormat.Annotation.Declaration<T, TypeParameters> | undefined
  /** @internal */
  readonly "~sentinels"?: ReadonlyArray<AST.Sentinel> | undefined
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Filter extends Documentation { // This annotation group is not parametric since it would make the filters invariant
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
   * JSON Schema representation used for documentation or code generation.
   */
  readonly jsonSchema?: ToJsonSchema.Annotation.Override | ToJsonSchema.Annotation.Constraint | undefined

  /**
   * Optional metadata used to identify or extend the filter with custom data.
   */
  readonly meta?: {
    readonly _tag: string
    readonly [x: string]: unknown
  } | undefined

  readonly arbitrary?: ToArbitrary.Annotation.Constraint | ToArbitrary.Annotation.Constraints | undefined
  readonly message?: string | undefined
}

/**
 * Merges annotations while preserving getters from both objects.
 *
 * **Warning**. Any existing `id` annotation will be removed.
 *
 * @internal
 */
export function merge(existing: Filter, incoming: Annotations | undefined): Filter
export function merge(existing: Annotations | undefined, incoming: Annotations | undefined): Annotations | undefined
export function merge(existing: Annotations | undefined, incoming: Annotations | undefined): Annotations | undefined {
  if (!existing) return incoming
  if (!incoming) return existing

  const out = {}
  // Apply existing descriptors first
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(existing))) {
    if (key === "id") continue
    Object.defineProperty(out, key, descriptor)
  }
  // Apply incoming descriptors (this will override existing ones)
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(incoming))) {
    Object.defineProperty(out, key, descriptor)
  }
  return out
}
