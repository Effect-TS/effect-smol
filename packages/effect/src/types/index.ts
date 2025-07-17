/**
 * @since 4.0.0
 */

/**
 * This module provides utilities for Higher-Kinded Types (HKT) in TypeScript.
 *
 * Higher-Kinded Types are types that take other types as parameters, similar to how
 * functions take values as parameters. They enable generic programming over type
 * constructors, allowing you to write code that works with any container type
 * (like Array, Option, Effect, etc.) in a uniform way.
 *
 * The HKT system in Effect uses TypeLambdas to encode type-level functions that
 * can represent complex type relationships with multiple type parameters, including
 * contravariant, covariant, and invariant positions.
 *
 * @example
 * ```ts
 * import { HKT } from "effect/types"
 *
 * // Define a TypeLambda for Array
 * interface ArrayTypeLambda extends HKT.TypeLambda {
 *   readonly type: Array<this["Target"]>
 * }
 *
 * // Use Kind to get the concrete type
 * type MyArray = HKT.Kind<ArrayTypeLambda, never, never, never, string>
 * // MyArray is Array<string>
 *
 * // Define a TypeClass that works with any HKT
 * interface Functor<F extends HKT.TypeLambda> extends HKT.TypeClass<F> {
 *   map<A, B>(fa: HKT.Kind<F, never, never, never, A>, f: (a: A) => B): HKT.Kind<F, never, never, never, B>
 * }
 * ```
 *
 * @since 2.0.0
 */
export * as HKT from "./HKT.ts"

/**
 * A collection of types that are commonly used types.
 *
 * @since 2.0.0
 */
export * as Types from "./Types.ts"

/**
 * @since 2.0.0
 */
export * as Unify from "./Unify.ts"
