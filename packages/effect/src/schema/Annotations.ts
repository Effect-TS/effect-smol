/**
 * @since 4.0.0
 */

import * as Predicate from "../data/Predicate.ts"
import { memoize } from "../Function.ts"
import type * as AST from "./AST.ts"
import type * as Check from "./Check.ts"
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
  readonly identifier?: string | undefined
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

/** @internal */
export const STRUCTURAL_ANNOTATION_KEY = "~structural"

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
    if (key === "identifier") continue
    Object.defineProperty(out, key, descriptor)
  }
  // Apply incoming descriptors (this will override existing ones)
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(incoming))) {
    Object.defineProperty(out, key, descriptor)
  }
  return out
}

/**
 * @since 4.0.0
 */
export function getAll(ast: AST.AST): Annotations | undefined {
  return ast.checks ? ast.checks[ast.checks.length - 1].annotations : ast.annotations
}

/**
 * @since 4.0.0
 */
export function parse<A>(parser: (annotations: Annotations | undefined) => A | undefined) {
  return (ast: AST.AST): A | undefined => parser(getAll(ast))
}

/**
 * @since 4.0.0
 */
export function getAt<A>(key: string, parser: (u: unknown) => u is A) {
  return parse((annotations) => {
    const value = annotations?.[key]
    if (parser(value)) return value
  })
}

/**
 * @since 4.0.0
 */
export const getIdentifier = getAt("identifier", Predicate.isString)

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
export function getBrand<T>(check: Check.Check<T>): string | symbol | undefined {
  const brand = check.annotations?.[BRAND_ANNOTATION_KEY]
  if (Predicate.isString(brand) || Predicate.isSymbol(brand)) {
    return brand
  }
}
