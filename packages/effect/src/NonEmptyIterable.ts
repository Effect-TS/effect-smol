/**
 * @since 2.0.0
 *
 * The `NonEmptyIterable` module provides types and utilities for working with iterables
 * that are guaranteed to contain at least one element. This provides compile-time
 * safety when working with collections that must not be empty.
 *
 * ## Key Features
 *
 * - **Type Safety**: Compile-time guarantee that the iterable contains at least one element
 * - **Iterator Protocol**: Fully compatible with JavaScript's built-in iteration protocol
 * - **Functional Operations**: Safe operations that preserve the non-empty property
 * - **Lightweight**: Minimal overhead with maximum type safety
 *
 * ## Why NonEmptyIterable?
 *
 * Many operations require non-empty collections to be meaningful:
 * - Finding the maximum or minimum value
 * - Getting the first or last element
 * - Reducing without an initial value
 * - Operations that would otherwise need runtime checks
 *
 * ## Basic Usage
 *
 * ```ts
 * import { NonEmptyIterable } from "effect"
 *
 * // NonEmptyIterable is a type that represents any iterable with at least one element
 * function processNonEmpty<A>(data: NonEmptyIterable<A>): A {
 *   // Safe to get the first element - guaranteed to exist
 *   const [first] = NonEmptyIterable.unprepend(data)
 *   return first
 * }
 *
 * // Arrays with at least one element are NonEmptyIterables
 * const numbers = [1, 2, 3, 4, 5] as const
 * const firstNumber = processNonEmpty(numbers) // number
 *
 * // Sets with at least one element are NonEmptyIterables
 * const uniqueValues = new Set([1, 2, 3])
 * const firstValue = processNonEmpty(uniqueValues) // number
 *
 * // Custom iterables that are guaranteed non-empty
 * function* generateNumbers(): NonEmptyIterable<number> {
 *   yield 1
 *   yield 2
 *   yield 3
 * }
 *
 * const firstGenerated = processNonEmpty(generateNumbers()) // number
 * ```
 *
 * ## Working with Different Iterable Types
 *
 * ```ts
 * import { NonEmptyIterable, Array, pipe } from "effect"
 *
 * // Creating non-empty arrays
 * const nonEmptyArray = Array.of(1, 2, 3) // This is a NonEmptyArray<number>
 *
 * // Working with strings (which are iterables)
 * const nonEmptyString = "hello" // string is iterable and non-empty
 * const [firstChar] = NonEmptyIterable.unprepend(nonEmptyString)
 * console.log(firstChar) // "h"
 *
 * // Working with Maps
 * const nonEmptyMap = new Map([
 *   ["key1", "value1"],
 *   ["key2", "value2"]
 * ])
 * const [firstEntry] = NonEmptyIterable.unprepend(nonEmptyMap)
 * console.log(firstEntry) // ["key1", "value1"]
 *
 * // Custom generator functions
 * function* fibonacci(): NonEmptyIterable<number> {
 *   let a = 1, b = 1
 *   yield a
 *   while (true) {
 *     yield b
 *     const next = a + b
 *     a = b
 *     b = next
 *   }
 * }
 *
 * const [firstFib, restFib] = NonEmptyIterable.unprepend(fibonacci())
 * console.log(firstFib) // 1
 * ```
 *
 * ## Integration with Effect Arrays
 *
 * ```ts
 * import { NonEmptyIterable, Array, pipe } from "effect"
 *
 * // Many Array functions work with NonEmptyIterable
 * declare const nonEmptyData: NonEmptyIterable<number>
 *
 * const processData = pipe(
 *   nonEmptyData,
 *   Array.fromIterable,
 *   Array.map(x => x * 2),
 *   Array.filter(x => x > 5),
 *   // Result is a regular array since filtering might make it empty
 * )
 *
 * // Safe operations that preserve non-emptiness
 * const doubledData = pipe(
 *   nonEmptyData,
 *   Array.fromIterable,
 *   Array.map(x => x * 2)
 *   // This would still be non-empty if the source was non-empty
 * )
 * ```
 */

/**
 * A unique symbol used to brand the `NonEmptyIterable` type.
 *
 * This symbol ensures that `NonEmptyIterable<A>` is a distinct type from regular
 * `Iterable<A>`, providing compile-time guarantees about non-emptiness while
 * maintaining full compatibility with the JavaScript iteration protocol.
 *
 * @example
 * ```ts
 * import { NonEmptyIterable } from "effect"
 *
 * // The symbol is used internally for type branding
 * declare const data: NonEmptyIterable<number>
 * 
 * // This has the nonEmpty symbol property (not accessible at runtime)
 * // but is still a regular Iterable for all practical purposes
 * for (const item of data) {
 *   console.log(item) // Works normally
 * }
 *
 * // Can be used with any function expecting an Iterable
 * const array = Array.from(data)
 * const set = new Set(data)
 * ```
 *
 * @category symbol
 * @since 2.0.0
 */
export declare const nonEmpty: unique symbol

/**
 * Represents an iterable that is guaranteed to contain at least one element.
 *
 * `NonEmptyIterable<A>` extends the standard `Iterable<A>` interface with a type-level
 * guarantee of non-emptiness. This allows for safe operations that would otherwise
 * require runtime checks or could throw exceptions.
 *
 * The type is branded with a unique symbol to ensure type safety while maintaining
 * full compatibility with JavaScript's iteration protocol.
 *
 * @example
 * ```ts
 * import { NonEmptyIterable } from "effect"
 *
 * // Function that requires non-empty data
 * function getFirst<A>(data: NonEmptyIterable<A>): A {
 *   // Safe - guaranteed to have at least one element
 *   const [first] = NonEmptyIterable.unprepend(data)
 *   return first
 * }
 *
 * // Works with any non-empty iterable
 * const numbers = [1, 2, 3] as const
 * const firstNumber = getFirst(numbers) // 1
 *
 * const chars = "hello"
 * const firstChar = getFirst(chars) // "h"
 *
 * const entries = new Map([["a", 1], ["b", 2]])
 * const firstEntry = getFirst(entries) // ["a", 1]
 *
 * // Custom generator
 * function* countdown(): NonEmptyIterable<number> {
 *   yield 3
 *   yield 2
 *   yield 1
 * }
 * const firstCount = getFirst(countdown()) // 3
 * ```
 *
 * @category model
 * @since 2.0.0
 */
export interface NonEmptyIterable<out A> extends Iterable<A> {
  readonly [nonEmpty]: A
}

/**
 * Safely extracts the first element and remaining elements from a non-empty iterable.
 *
 * This function provides a safe way to deconstruct a `NonEmptyIterable` into its
 * head (first element) and tail (remaining elements as an iterator). Since the
 * iterable is guaranteed to be non-empty, the first element is always available.
 *
 * @param self - The non-empty iterable to deconstruct
 * @returns A tuple containing the first element and an iterator for the remaining elements
 *
 * @example
 * ```ts
 * import { NonEmptyIterable } from "effect"
 *
 * // With arrays
 * const numbers = [1, 2, 3, 4, 5] as const
 * const [first, rest] = NonEmptyIterable.unprepend(numbers)
 * console.log(first) // 1
 * console.log(Array.from(rest)) // [2, 3, 4, 5]
 *
 * // With strings
 * const text = "hello"
 * const [firstChar, restChars] = NonEmptyIterable.unprepend(text)
 * console.log(firstChar) // "h"
 * console.log(Array.from(restChars).join("")) // "ello"
 *
 * // With Sets
 * const uniqueNumbers = new Set([10, 20, 30])
 * const [firstUnique, restUnique] = NonEmptyIterable.unprepend(uniqueNumbers)
 * console.log(firstUnique) // 10 (or any element, Set order is not guaranteed)
 * console.log(Array.from(restUnique)) // [20, 30] (in some order)
 *
 * // With Maps
 * const keyValuePairs = new Map([["a", 1], ["b", 2], ["c", 3]])
 * const [firstPair, restPairs] = NonEmptyIterable.unprepend(keyValuePairs)
 * console.log(firstPair) // ["a", 1]
 * console.log(Array.from(restPairs)) // [["b", 2], ["c", 3]]
 *
 * // With custom generators
 * function* fibonacci(): NonEmptyIterable<number> {
 *   let a = 1, b = 1
 *   yield a
 *   for (let i = 0; i < 10; i++) {
 *     yield b
 *     const next = a + b
 *     a = b
 *     b = next
 *   }
 * }
 *
 * const [firstFib, restFib] = NonEmptyIterable.unprepend(fibonacci())
 * console.log(firstFib) // 1
 * console.log(Array.from(restFib)) // [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
 *
 * // Practical usage: implementing reduce for non-empty iterables
 * function reduceNonEmpty<A, B>(
 *   data: NonEmptyIterable<A>,
 *   f: (acc: B, current: A) => B,
 *   initial: B
 * ): B {
 *   const [first, rest] = NonEmptyIterable.unprepend(data)
 *   let result = f(initial, first)
 *   
 *   for (const item of rest) {
 *     result = f(result, item)
 *   }
 *   
 *   return result
 * }
 *
 * const sum = reduceNonEmpty([1, 2, 3, 4], (acc, x) => acc + x, 0) // 10
 * ```
 *
 * @category getters
 * @since 2.0.0
 */
export const unprepend = <A>(self: NonEmptyIterable<A>): [firstElement: A, remainingElements: Iterator<A>] => {
  const iterator = self[Symbol.iterator]()
  const next = iterator.next()
  if (next.done) {
    throw new Error(
      "BUG: NonEmptyIterator should not be empty - please report an issue at https://github.com/Effect-TS/effect/issues"
    )
  }
  return [next.value, iterator]
}
