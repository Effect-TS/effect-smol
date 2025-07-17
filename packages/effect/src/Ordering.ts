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
import type { LazyArg } from "./Function.ts"
import { dual } from "./Function.ts"

/**
 * Represents the result of comparing two values.
 *
 * - `-1` indicates the first value is less than the second
 * - `0` indicates the values are equal
 * - `1` indicates the first value is greater than the second
 *
 * @example
 * ```ts
 * import { Ordering } from "effect"
 *
 * // Custom comparison function
 * const compareNumbers = (a: number, b: number): Ordering.Ordering => {
 *   if (a < b) return -1
 *   if (a > b) return 1
 *   return 0
 * }
 *
 * console.log(compareNumbers(5, 10)) // -1 (5 < 10)
 * console.log(compareNumbers(10, 5)) // 1 (10 > 5)
 * console.log(compareNumbers(5, 5))  // 0 (5 == 5)
 *
 * // Using with string comparison
 * const compareStrings = (a: string, b: string): Ordering.Ordering => {
 *   return a.localeCompare(b) as Ordering.Ordering
 * }
 * ```
 *
 * @category model
 * @since 2.0.0
 */
export type Ordering = -1 | 0 | 1

/**
 * Inverts the ordering of the input Ordering.
 * This is useful for creating descending sort orders from ascending ones.
 *
 * @example
 * ```ts
 * import { Ordering } from "effect"
 *
 * // Basic reversal
 * console.log(Ordering.reverse(1))  // -1 (greater becomes less)
 * console.log(Ordering.reverse(-1)) // 1 (less becomes greater)
 * console.log(Ordering.reverse(0))  // 0 (equal stays equal)
 *
 * // Creating descending sort from ascending comparison
 * const compareNumbers = (a: number, b: number): Ordering.Ordering =>
 *   a < b ? -1 : a > b ? 1 : 0
 *
 * const compareDescending = (a: number, b: number): Ordering.Ordering =>
 *   Ordering.reverse(compareNumbers(a, b))
 *
 * const numbers = [3, 1, 4, 1, 5]
 * numbers.sort(compareNumbers)    // [1, 1, 3, 4, 5] (ascending)
 * numbers.sort(compareDescending) // [5, 4, 3, 1, 1] (descending)
 *
 * // Useful for toggling sort direction
 * const createSorter = (ascending: boolean) => (a: number, b: number) => {
 *   const ordering = compareNumbers(a, b)
 *   return ascending ? ordering : Ordering.reverse(ordering)
 * }
 * ```
 *
 * @category transformations
 * @since 2.0.0
 */
export const reverse = (o: Ordering): Ordering => (o === -1 ? 1 : o === 1 ? -1 : 0)

/**
 * Depending on the `Ordering` parameter given to it, returns a value produced by one of the 3 functions provided as parameters.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Ordering } from "effect"
 * import { constant } from "effect/Function"
 *
 * const toMessage = Ordering.match({
 *   onLessThan: constant('less than'),
 *   onEqual: constant('equal'),
 *   onGreaterThan: constant('greater than')
 * })
 *
 * assert.deepStrictEqual(toMessage(-1), "less than")
 * assert.deepStrictEqual(toMessage(0), "equal")
 * assert.deepStrictEqual(toMessage(1), "greater than")
 * ```
 *
 * @category pattern matching
 * @since 2.0.0
 */
export const match: {
  <A, B, C = B>(
    options: {
      readonly onLessThan: LazyArg<A>
      readonly onEqual: LazyArg<B>
      readonly onGreaterThan: LazyArg<C>
    }
  ): (self: Ordering) => A | B | C
  <A, B, C = B>(
    o: Ordering,
    options: {
      readonly onLessThan: LazyArg<A>
      readonly onEqual: LazyArg<B>
      readonly onGreaterThan: LazyArg<C>
    }
  ): A | B | C
} = dual(2, <A, B, C = B>(
  self: Ordering,
  { onEqual, onGreaterThan, onLessThan }: {
    readonly onLessThan: LazyArg<A>
    readonly onEqual: LazyArg<B>
    readonly onGreaterThan: LazyArg<C>
  }
): A | B | C => self === -1 ? onLessThan() : self === 0 ? onEqual() : onGreaterThan())

/**
 * Combines two orderings, returning the first ordering if it's not equal (0),
 * otherwise returning the second ordering. This implements a "tie-breaking" behavior
 * where the second ordering is only used if the first comparison is equal.
 *
 * @example
 * ```ts
 * import { Ordering } from "effect"
 *
 * // Basic combination
 * console.log(Ordering.combine(-1, 1))  // -1 (first is decisive)
 * console.log(Ordering.combine(1, -1))  // 1 (first is decisive)
 * console.log(Ordering.combine(0, -1))  // -1 (second breaks tie)
 * console.log(Ordering.combine(0, 0))   // 0 (both equal)
 *
 * // Multi-level sorting example
 * interface Person {
 *   lastName: string
 *   firstName: string
 *   age: number
 * }
 *
 * const comparePeople = (a: Person, b: Person): Ordering.Ordering => {
 *   // Primary sort: last name
 *   const lastNameOrder = a.lastName.localeCompare(b.lastName) as Ordering.Ordering
 *
 *   // Secondary sort: first name (only if last names are equal)
 *   const firstNameOrder = a.firstName.localeCompare(b.firstName) as Ordering.Ordering
 *
 *   return Ordering.combine(lastNameOrder, firstNameOrder)
 * }
 *
 * // Pipe-able version
 * const combineWith = Ordering.combine(1)
 * console.log(combineWith(0)) // 1 (uses the provided ordering)
 * console.log(combineWith(-1)) // -1 (keeps the first ordering)
 * ```
 *
 * @category combining
 * @since 2.0.0
 */
export const combine: {
  (that: Ordering): (self: Ordering) => Ordering
  (self: Ordering, that: Ordering): Ordering
} = dual(2, (self: Ordering, that: Ordering): Ordering => self !== 0 ? self : that)

/**
 * Combines an initial ordering with many other orderings, returning the first non-equal ordering found.
 * This is useful for implementing complex multi-criteria sorting where each criterion acts as a tie-breaker.
 *
 * @example
 * ```ts
 * import { Ordering } from "effect"
 *
 * // Basic usage
 * const result1 = Ordering.combineMany(-1, [1, 0, -1]) // -1 (initial is decisive)
 * const result2 = Ordering.combineMany(0, [0, 0, 1])   // 1 (first non-zero wins)
 * const result3 = Ordering.combineMany(0, [0, 0, 0])   // 0 (all equal)
 *
 * // Complex sorting example
 * interface Product {
 *   category: string
 *   price: number
 *   rating: number
 *   name: string
 * }
 *
 * const compareProducts = (a: Product, b: Product): Ordering.Ordering => {
 *   const categoryOrder = a.category.localeCompare(b.category) as Ordering.Ordering
 *
 *   const additionalCriteria = [
 *     // Price (ascending)
 *     (a.price < b.price ? -1 : a.price > b.price ? 1 : 0) as Ordering.Ordering,
 *     // Rating (descending)
 *     Ordering.reverse(a.rating < b.rating ? -1 : a.rating > b.rating ? 1 : 0),
 *     // Name (ascending)
 *     a.name.localeCompare(b.name) as Ordering.Ordering
 *   ]
 *
 *   return Ordering.combineMany(categoryOrder, additionalCriteria)
 * }
 *
 * // Pipe-able version
 * const combineWithMany = Ordering.combineMany([0, 1, -1])
 * console.log(combineWithMany(0))  // 1 (first non-zero from collection)
 * console.log(combineWithMany(-1)) // -1 (initial is decisive)
 * ```
 *
 * @category combining
 * @since 2.0.0
 */
export const combineMany: {
  (collection: Iterable<Ordering>): (self: Ordering) => Ordering
  (self: Ordering, collection: Iterable<Ordering>): Ordering
} = dual(2, (self: Ordering, collection: Iterable<Ordering>): Ordering => {
  let ordering = self
  if (ordering !== 0) {
    return ordering
  }
  for (ordering of collection) {
    if (ordering !== 0) {
      return ordering
    }
  }
  return ordering
})

/**
 * Combines all orderings in a collection, returning the first non-equal ordering found.
 * This is equivalent to `combineMany(0, collection)` and is useful when you want to
 * find the first decisive comparison from a series of comparisons.
 *
 * @example
 * ```ts
 * import { Ordering } from "effect"
 *
 * // Basic usage
 * console.log(Ordering.combineAll([0, 0, 1]))    // 1 (first non-zero)
 * console.log(Ordering.combineAll([-1, 0, 1]))   // -1 (first non-zero)
 * console.log(Ordering.combineAll([0, 0, 0]))    // 0 (all equal)
 * console.log(Ordering.combineAll([]))           // 0 (empty defaults to equal)
 *
 * // Lexicographic comparison implementation
 * const compareLexicographically = (a: string[], b: string[]): Ordering.Ordering => {
 *   const comparisons: Ordering.Ordering[] = []
 *
 *   const maxLength = Math.max(a.length, b.length)
 *   for (let i = 0; i < maxLength; i++) {
 *     const aItem = a[i] ?? ""
 *     const bItem = b[i] ?? ""
 *     comparisons.push(aItem.localeCompare(bItem) as Ordering.Ordering)
 *   }
 *
 *   return Ordering.combineAll(comparisons)
 * }
 *
 * console.log(compareLexicographically(["a", "b"], ["a", "c"])) // -1
 * console.log(compareLexicographically(["x"], ["x", "y"]))       // -1
 *
 * // Combining multiple comparison results
 * const orderings: Ordering.Ordering[] = [
 *   0,  // Equal on first criterion
 *   0,  // Equal on second criterion
 *   -1, // Less than on third criterion (this will be the result)
 *   1   // This won't be reached
 * ]
 * console.log(Ordering.combineAll(orderings)) // -1
 * ```
 *
 * @category combining
 * @since 2.0.0
 */
export const combineAll = (collection: Iterable<Ordering>): Ordering => combineMany(0, collection)
