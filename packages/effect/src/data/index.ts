/**
 * @since 4.0.0
 */

/**
 * This module provides types and utility functions to create and work with
 * branded types, which are TypeScript types with an added type tag to prevent
 * accidental usage of a value in the wrong context.
 *
 * The `refined` and `nominal` functions are both used to create branded types
 * in TypeScript. The main difference between them is that `refined` allows for
 * validation of the data, while `nominal` does not.
 *
 * The `nominal` function is used to create a new branded type that has the same
 * underlying type as the input, but with a different name. This is useful when
 * you want to distinguish between two values of the same type that have
 * different meanings. The `nominal` function does not perform any validation of
 * the input data.
 *
 * On the other hand, the `refined` function is used to create a new branded
 * type that has the same underlying type as the input, but with a different
 * name, and it also allows for validation of the input data. The `refined`
 * function takes a predicate that is used to validate the input data. If the
 * input data fails the validation, a `BrandErrors` is returned, which provides
 * information about the specific validation failure.
 *
 * @since 2.0.0
 */
export * as Brand from "./Brand.ts"

/**
 * @since 4.0.0
 */
export * as Combiner from "./Combiner.ts"

/**
 * This module provides utilities for creating data types with structural equality
 * semantics. Unlike regular JavaScript objects, `Data` types support value-based
 * equality comparison using the `Equal` module.
 *
 * The main benefits of using `Data` types are:
 * - **Structural equality**: Two `Data` objects are equal if their contents are equal
 * - **Immutability**: `Data` types are designed to be immutable
 * - **Type safety**: Constructors ensure type safety and consistency
 * - **Effect integration**: Error types work seamlessly with Effect's error handling
 *
 * @since 2.0.0
 */
export * as Data from "./Data.ts"

/**
 * This module provides utilities for working with equivalence relations - binary relations that are
 * reflexive, symmetric, and transitive. Equivalence relations define when two values of the same type
 * should be considered equivalent, which is fundamental for comparing, deduplicating, and organizing data.
 *
 * An equivalence relation must satisfy three properties:
 * - **Reflexive**: Every value is equivalent to itself
 * - **Symmetric**: If `a` is equivalent to `b`, then `b` is equivalent to `a`
 * - **Transitive**: If `a` is equivalent to `b` and `b` is equivalent to `c`, then `a` is equivalent to `c`
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect/data"
 * import { Array } from "effect/collections"
 *
 * // Case-insensitive string equivalence
 * const caseInsensitive = Equivalence.make<string>((a, b) =>
 *   a.toLowerCase() === b.toLowerCase()
 * )
 *
 * // Use with array deduplication
 * const strings = ["Hello", "world", "HELLO", "World"]
 * const deduplicated = Array.dedupeWith(strings, caseInsensitive)
 * console.log(deduplicated) // ["Hello", "world"]
 *
 * // Product type equivalence
 * interface Person {
 *   name: string
 *   age: number
 * }
 *
 * const personEquivalence = Equivalence.struct({
 *   name: caseInsensitive,
 *   age: Equivalence.strict<number>()
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as Equivalence from "./Equivalence.ts"

/**
 * @since 4.0.0
 */
export * as Filter from "./Filter.ts"

/**
 * @since 4.0.0
 */
export * as Format from "./Format.ts"

/**
 * This module provides small, allocation-free utilities for working with values of type
 * `A | null`, where `null` means "no value".
 *
 * Why not `Option<A>`?
 * In TypeScript, `Option<A>` is often unnecessary. If `null` already models absence
 * in your domain, using `A | null` keeps types simple, avoids extra wrappers, and
 * reduces overhead. The key is that `A` itself must not include `null`; in this
 * module `null` is reserved to mean "no value".
 *
 * When to use `A | null`:
 * - Absence can be represented by `null` in your domain model.
 * - You do not need to distinguish between "no value" and "value is null".
 * - You want straightforward ergonomics and zero extra allocations.
 *
 * When to prefer `Option<A>`:
 * - You must distinguish `None` from `Some(null)` (that is, `null` is a valid
 *   payload and carries meaning on its own).
 * - You need a tagged representation for serialization or pattern matching across
 *   boundaries where `null` would be ambiguous.
 * - You want the richer `Option` API and are comfortable with the extra wrapper.
 *
 * Lawfulness note:
 * All helpers treat `null` as absence. Do not use these utilities with payloads
 * where `A` can itself be `null`, or you will lose information. If you need to
 * carry `null` as a valid payload, use `Option<A>` instead.
 *
 * @since 4.0.0
 */
export * as NullOr from "./NullOr.ts"

/**
 * @since 2.0.0
 */
export * as Option from "./Option.ts"

/**
 * This module provides an implementation of the `Order` type class which is used to define a total ordering on some type `A`.
 * An order is defined by a relation `<=`, which obeys the following laws:
 *
 * - either `x <= y` or `y <= x` (totality)
 * - if `x <= y` and `y <= x`, then `x == y` (antisymmetry)
 * - if `x <= y` and `y <= z`, then `x <= z` (transitivity)
 *
 * The truth table for compare is defined as follows:
 *
 * | `x <= y` | `x >= y` | Ordering |                       |
 * | -------- | -------- | -------- | --------------------- |
 * | `true`   | `true`   | `0`      | corresponds to x == y |
 * | `true`   | `false`  | `< 0`    | corresponds to x < y  |
 * | `false`  | `true`   | `> 0`    | corresponds to x > y  |
 *
 * @since 2.0.0
 */
export * as Order from "./Order.ts"

/**
 * @fileoverview
 * The Ordering module provides utilities for working with comparison results and ordering operations.
 * An Ordering represents the result of comparing two values, expressing whether the first value is
 * less than (-1), equal to (0), or greater than (1) the second value.
 *
 * This module is fundamental for building comparison functions, sorting algorithms, and implementing
 * ordered data structures. It provides composable operations for combining multiple comparison results
 * and pattern matching on ordering outcomes.
 *
 * Key Features:
 * - Type-safe representation of comparison results (-1, 0, 1)
 * - Composable operations for combining multiple orderings
 * - Pattern matching utilities for handling different ordering cases
 * - Ordering reversal and combination functions
 * - Integration with Effect's functional programming patterns
 *
 * Common Use Cases:
 * - Implementing custom comparison functions
 * - Building complex sorting criteria
 * - Combining multiple comparison results
 * - Creating ordered data structures
 * - Pattern matching on comparison outcomes
 *
 * @since 2.0.0
 * @category utilities
 */
export * as Ordering from "./Ordering.ts"

/**
 * @since 2.0.0
 */
export * as Predicate from "./Predicate.ts"

/**
 * This module provides utility functions for working with records in TypeScript.
 *
 * @since 2.0.0
 */
export * as Record from "./Record.ts"

/**
 * The Redacted module provides functionality for handling sensitive information
 * securely within your application. By using the `Redacted` data type, you can
 * ensure that sensitive values are not accidentally exposed in logs or error
 * messages.
 *
 * @since 3.3.0
 */
export * as Redacted from "./Redacted.ts"

/**
 * @since 4.0.0
 */
export * as Reducer from "./Reducer.ts"

/**
 * @since 4.0.0
 */
export * as Result from "./Result.ts"

/**
 * This module provides utility functions for working with structs in TypeScript.
 *
 * @since 2.0.0
 */
export * as Struct from "./Struct.ts"

/**
 * This module provides utility functions for working with tuples in TypeScript.
 *
 * @since 2.0.0
 */
export * as Tuple from "./Tuple.ts"

/**
 * This module provides small, allocation-free utilities for working with values of type
 * `A | undefined`, where `undefined` means "no value".
 *
 * Why not `Option<A>`?
 * In TypeScript, `Option<A>` is often unnecessary. If `undefined` already models absence
 * in your domain, using `A | undefined` keeps types simple, avoids extra wrappers, and
 * reduces overhead. The key is that `A` itself must not include `undefined`; in this
 * module `undefined` is reserved to mean "no value".
 *
 * When to use `A | undefined`:
 * - Absence can be represented by `undefined` in your domain model.
 * - You do not need to distinguish between "no value" and "value is undefined".
 * - You want straightforward ergonomics and zero extra allocations.
 *
 * When to prefer `Option<A>`:
 * - You must distinguish `None` from `Some(undefined)` (that is, `undefined` is a valid
 *   payload and carries meaning on its own).
 * - You need a tagged representation for serialization or pattern matching across
 *   boundaries where `undefined` would be ambiguous.
 * - You want the richer `Option` API and are comfortable with the extra wrapper.
 *
 * Lawfulness note:
 * All helpers treat `undefined` as absence. Do not use these utilities with payloads
 * where `A` can itself be `undefined`, or you will lose information. If you need to
 * carry `undefined` as a valid payload, use `Option<A>` instead.
 *
 * @since 4.0.0
 */
export * as UndefinedOr from "./UndefinedOr.ts"
