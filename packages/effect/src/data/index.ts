/**
 * @since 4.0.0
 */

/**
 * This module provides utility functions and type class instances for working with the `BigDecimal` type in TypeScript.
 * It includes functions for basic arithmetic operations, as well as type class instances for `Equivalence` and `Order`.
 *
 * A `BigDecimal` allows storing any real number to arbitrary precision; which avoids common floating point errors
 * (such as 0.1 + 0.2 ≠ 0.3) at the cost of complexity.
 *
 * Internally, `BigDecimal` uses a `BigInt` object, paired with a 64-bit integer which determines the position of the
 * decimal point. Therefore, the precision *is not* actually arbitrary, but limited to 2<sup>63</sup> decimal places.
 *
 * It is not recommended to convert a floating point number to a decimal directly, as the floating point representation
 * may be unexpected.
 *
 * @since 2.0.0
 */
export * as BigDecimal from "./BigDecimal.ts"

/**
 * This module provides utility functions and type class instances for working with the `bigint` type in TypeScript.
 * It includes functions for basic arithmetic operations, as well as type class instances for
 * `Equivalence` and `Order`.
 *
 * @since 2.0.0
 */
export * as BigInt from "./BigInt.ts"

/**
 * This module provides utility functions and type class instances for working with the `boolean` type in TypeScript.
 * It includes functions for basic boolean operations, as well as type class instances for
 * `Equivalence` and `Order`.
 *
 * @since 2.0.0
 */
export * as Boolean from "./Boolean.ts"

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
 * This module provides utilities for working with `Cause`, a data type that represents
 * the different ways an `Effect` can fail. It includes structured error handling with
 * typed errors, defects, and interruptions.
 *
 * A `Cause` can represent:
 * - **Fail**: A typed, expected error that can be handled
 * - **Die**: An unrecoverable defect (like a programming error)
 * - **Interrupt**: A fiber interruption
 *
 * @example
 * ```ts
 * import { Cause } from "effect/data"
 * import { Effect } from "effect"
 *
 * // Creating different types of causes
 * const failCause = Cause.fail("Something went wrong")
 * const dieCause = Cause.die(new Error("Unexpected error"))
 * const interruptCause = Cause.interrupt(123)
 *
 * // Working with effects that can fail
 * const program = Effect.fail("user error").pipe(
 *   Effect.catchCause((cause) => {
 *     if (Cause.hasFail(cause)) {
 *       const error = Cause.filterError(cause)
 *       console.log("Expected error:", error)
 *     }
 *     return Effect.succeed("handled")
 *   })
 * )
 *
 * // Analyzing failure types
 * const analyzeCause = (cause: Cause.Cause<string>) => {
 *   if (Cause.hasFail(cause)) return "Has user error"
 *   if (Cause.hasDie(cause)) return "Has defect"
 *   if (Cause.hasInterrupt(cause)) return "Was interrupted"
 *   return "Unknown cause"
 * }
 * ```
 *
 * @since 2.0.0
 */
export * as Cause from "./Cause.ts"

/**
 * @since 4.0.0
 */
export * as Combiner from "./Combiner.ts"

/**
 * @since 2.0.0
 */
export * as Cron from "./Cron.ts"

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
 * @example
 * ```ts
 * import { Equal } from "effect/interfaces"
 * import { Data } from "effect/data"
 *
 * // Basic struct usage
 * const person1 = Data.struct({ name: "Alice", age: 30 })
 * const person2 = Data.struct({ name: "Alice", age: 30 })
 *
 * console.log(Equal.equals(person1, person2)) // true
 * console.log(person1 === person2) // false (different references)
 *
 * // Regular objects don't have structural equality
 * const obj1 = { name: "Alice", age: 30 }
 * const obj2 = { name: "Alice", age: 30 }
 * console.log(Equal.equals(obj1, obj2)) // false
 *
 * // Tagged enums for discriminated unions
 * const { Success, Failure, $match } = Data.taggedEnum<
 *   | { _tag: "Success"; value: number }
 *   | { _tag: "Failure"; error: string }
 * >()
 *
 * const result1 = Success({ value: 42 })
 * const result2 = Failure({ error: "Not found" })
 *
 * // Pattern matching
 * const message = $match(result1, {
 *   Success: ({ value }) => `Got value: ${value}`,
 *   Failure: ({ error }) => `Error: ${error}`
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as Data from "./Data.ts"

/**
 * @since 3.6.0
 */
export * as DateTime from "./DateTime.ts"

/**
 * This module provides utilities for working with durations of time. A `Duration`
 * is an immutable data type that represents a span of time with high precision,
 * supporting operations from nanoseconds to weeks.
 *
 * Durations support:
 * - **High precision**: Nanosecond-level accuracy using BigInt
 * - **Multiple formats**: Numbers (millis), BigInt (nanos), tuples, strings
 * - **Arithmetic operations**: Add, subtract, multiply, divide
 * - **Comparisons**: Equal, less than, greater than
 * - **Conversions**: Between different time units
 * - **Human-readable formatting**: Pretty printing and parsing
 *
 * @since 2.0.0
 */
export * as Duration from "./Duration.ts"

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
 *   age: Equivalence.number
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as Equivalence from "./Equivalence.ts"

/**
 * The `Exit` type represents the result of running an Effect computation.
 * An `Exit<A, E>` can either be:
 * - `Success`: Contains a value of type `A`
 * - `Failure`: Contains a `Cause<E>` describing why the effect failed
 *
 * `Exit` is used internally by the Effect runtime and can be useful for
 * handling the results of Effect computations in a more explicit way.
 *
 * @since 2.0.0
 */
export * as Exit from "./Exit.ts"

/**
 * @since 4.0.0
 */
export * as Filter from "./Filter.ts"

/**
 * @since 4.0.0
 */
export * as Format from "./Format.ts"

/**
 * @since 2.0.0
 */
export * as Function from "./Function.ts"

/**
 * @since 4.0.0
 */
export * as NullOr from "./NullOr.ts"

/**
 * This module provides utility functions and type class instances for working with the `number` type in TypeScript.
 * It includes functions for basic arithmetic operations, as well as type class instances for
 * `Equivalence` and `Order`.
 *
 * @since 2.0.0
 */
export * as Number from "./Number.ts"

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
 * This module provides utility functions for working with RegExp in TypeScript.
 *
 * @since 2.0.0
 */
export * as RegExp from "./RegExp.ts"

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
 * This module provides utility functions and type class instances for working with the `string` type in TypeScript.
 * It includes functions for basic string manipulation, as well as type class instances for
 * `Equivalence` and `Order`.
 *
 * @since 2.0.0
 */
export * as String from "./String.ts"

/**
 * This module provides utility functions for working with structs in TypeScript.
 *
 * @since 2.0.0
 */
export * as Struct from "./Struct.ts"

/**
 * @since 2.0.0
 */
export * as Symbol from "./Symbol.ts"

/**
 * This module provides utility functions for working with tuples in TypeScript.
 *
 * @since 2.0.0
 */
export * as Tuple from "./Tuple.ts"

/**
 * @since 4.0.0
 */
export * as UndefinedOr from "./UndefinedOr.ts"
