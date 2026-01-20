/**
 * This module provides utility functions for working with arrays in TypeScript.
 *
 * @since 2.0.0
 */
import * as Equal from "./Equal.ts"
import * as Equivalence from "./Equivalence.ts"
import * as Filter from "./Filter.ts"
import type { LazyArg } from "./Function.ts"
import { dual, identity } from "./Function.ts"
import type { TypeLambda } from "./HKT.ts"
import * as internalArray from "./internal/array.ts"
import * as internalDoNotation from "./internal/doNotation.ts"
import * as moduleIterable from "./Iterable.ts"
import * as Option from "./Option.ts"
import * as Order from "./Order.ts"
import type * as Predicate from "./Predicate.ts"
import * as Record from "./Record.ts"
import * as Reducer from "./Reducer.ts"
import * as Result from "./Result.ts"
import * as Tuple from "./Tuple.ts"
import type { NoInfer, TupleOf } from "./Types.ts"

/**
 * Reference to the global Array constructor.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const arr = new Array.Array(3)
 * console.log(arr) // [undefined, undefined, undefined]
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const Array = globalThis.Array

/**
 * Type lambda for ReadonlyArray, used for higher-kinded type operations.
 *
 * @example
 * ```ts
 * import type { ReadonlyArrayTypeLambda } from "effect/Array"
 * import type { Kind } from "effect/HKT"
 *
 * // Create a ReadonlyArray type using the type lambda
 * type NumberArray = Kind<ReadonlyArrayTypeLambda, never, never, never, number>
 * // Equivalent to: ReadonlyArray<number>
 * ```
 *
 * @category type lambdas
 * @since 2.0.0
 */
export interface ReadonlyArrayTypeLambda extends TypeLambda {
  readonly type: ReadonlyArray<this["Target"]>
}

/**
 * Type representing a readonly array that is guaranteed to have at least one element.
 *
 * @example
 * ```ts
 * import type { Array } from "effect"
 *
 * const nonEmpty: Array.NonEmptyReadonlyArray<number> = [1, 2, 3]
 * const head = nonEmpty[0] // 1 (guaranteed to exist)
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export type NonEmptyReadonlyArray<A> = readonly [A, ...Array<A>]

/**
 * Type representing a mutable array that is guaranteed to have at least one element.
 *
 * @example
 * ```ts
 * import type { Array } from "effect"
 *
 * const nonEmpty: Array.NonEmptyArray<number> = [1, 2, 3]
 * nonEmpty.push(4) // Mutable operations are allowed
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export type NonEmptyArray<A> = [A, ...Array<A>]

/**
 * Builds a `NonEmptyArray` from an non-empty collection of elements.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.make(1, 2, 3)
 * console.log(result) // [1, 2, 3]
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const make = <Elements extends NonEmptyArray<unknown>>(
  ...elements: Elements
): NonEmptyArray<Elements[number]> => elements

/**
 * Creates a new `Array` of the specified length.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.allocate<number>(3)
 * console.log(result) // [ <3 empty items> ]
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const allocate = <A = never>(n: number): Array<A | undefined> => new Array(n)

/**
 * Return a `NonEmptyArray` of length `n` with element `i` initialized with `f(i)`.
 *
 * **Note**. `n` is normalized to an integer >= 1.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.makeBy(5, (n) => n * 2)
 * console.log(result) // [0, 2, 4, 6, 8]
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const makeBy: {
  <A>(f: (i: number) => A): (n: number) => NonEmptyArray<A>
  <A>(n: number, f: (i: number) => A): NonEmptyArray<A>
} = dual(2, <A>(n: number, f: (i: number) => A) => {
  const max = Math.max(1, Math.floor(n))
  const out = new Array(max)
  for (let i = 0; i < max; i++) {
    out[i] = f(i)
  }
  return out as NonEmptyArray<A>
})

/**
 * Return a `NonEmptyArray` containing a range of integers, including both endpoints.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.range(1, 3)
 * console.log(result) // [1, 2, 3]
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const range = (start: number, end: number): NonEmptyArray<number> =>
  start <= end ? makeBy(end - start + 1, (i) => start + i) : [start]

/**
 * Return a `NonEmptyArray` containing a value repeated the specified number of times.
 *
 * **Note**. `n` is normalized to an integer >= 1.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.replicate("a", 3)
 * console.log(result) // ["a", "a", "a"]
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const replicate: {
  (n: number): <A>(a: A) => NonEmptyArray<A>
  <A>(a: A, n: number): NonEmptyArray<A>
} = dual(2, <A>(a: A, n: number): NonEmptyArray<A> => makeBy(n, () => a))

/**
 * Creates a new `Array` from an iterable collection of values.
 * If the input is already an array, it returns the input as-is.
 * Otherwise, it converts the iterable collection to an array.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.fromIterable(new Set([1, 2, 3]))
 * console.log(result) // [1, 2, 3]
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const fromIterable = <A>(collection: Iterable<A>): Array<A> =>
  Array.isArray(collection) ? collection : Array.from(collection)

/**
 * Creates a new `Array` from a value that might not be an iterable.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * console.log(Array.ensure("a")) // ["a"]
 * console.log(Array.ensure(["a"])) // ["a"]
 * console.log(Array.ensure(["a", "b", "c"])) // ["a", "b", "c"]
 * ```
 *
 * @category constructors
 * @since 3.3.0
 */
export const ensure = <A>(self: ReadonlyArray<A> | A): Array<A> => Array.isArray(self) ? self : [self as A]

/**
 * Takes a record and returns an array of tuples containing its keys and values.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.fromRecord({ a: 1, b: 2, c: 3 })
 * console.log(result) // [["a", 1], ["b", 2], ["c", 3]]
 * ```
 *
 * @category conversions
 * @since 2.0.0
 */
export const fromRecord: <K extends string, A>(self: Readonly<Record<K, A>>) => Array<[K, A]> = Record.toEntries

/**
 * Converts an `Option` to an array.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 * import * as Option from "effect/Option"
 *
 * console.log(Array.fromOption(Option.some(1))) // [1]
 * console.log(Array.fromOption(Option.none())) // []
 * ```
 *
 * @category conversions
 * @since 2.0.0
 */
export const fromOption: <A>(self: Option.Option<A>) => Array<A> = Option.toArray

/**
 * Matches the elements of an array, applying functions to cases of empty and non-empty arrays.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const match = Array.match({
 *   onEmpty: () => "empty",
 *   onNonEmpty: ([head, ...tail]) => `head: ${head}, tail: ${tail.length}`
 * })
 * console.log(match([])) // "empty"
 * console.log(match([1, 2, 3])) // "head: 1, tail: 2"
 * ```
 *
 * @category pattern matching
 * @since 2.0.0
 */
export const match: {
  <B, A, C = B>(
    options: {
      readonly onEmpty: LazyArg<B>
      readonly onNonEmpty: (self: NonEmptyReadonlyArray<A>) => C
    }
  ): (self: ReadonlyArray<A>) => B | C
  <A, B, C = B>(
    self: ReadonlyArray<A>,
    options: {
      readonly onEmpty: LazyArg<B>
      readonly onNonEmpty: (self: NonEmptyReadonlyArray<A>) => C
    }
  ): B | C
} = dual(2, <A, B, C = B>(
  self: ReadonlyArray<A>,
  { onEmpty, onNonEmpty }: {
    readonly onEmpty: LazyArg<B>
    readonly onNonEmpty: (self: NonEmptyReadonlyArray<A>) => C
  }
): B | C => isReadonlyArrayNonEmpty(self) ? onNonEmpty(self) : onEmpty())

/**
 * Matches the elements of an array from the left, applying functions to cases of empty and non-empty arrays.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const matchLeft = Array.matchLeft({
 *   onEmpty: () => "empty",
 *   onNonEmpty: (head, tail) => `head: ${head}, tail: ${tail.length}`
 * })
 * console.log(matchLeft([])) // "empty"
 * console.log(matchLeft([1, 2, 3])) // "head: 1, tail: 2"
 * ```
 *
 * @category pattern matching
 * @since 2.0.0
 */
export const matchLeft: {
  <B, A, C = B>(
    options: {
      readonly onEmpty: LazyArg<B>
      readonly onNonEmpty: (head: A, tail: Array<A>) => C
    }
  ): (self: ReadonlyArray<A>) => B | C
  <A, B, C = B>(
    self: ReadonlyArray<A>,
    options: {
      readonly onEmpty: LazyArg<B>
      readonly onNonEmpty: (head: A, tail: Array<A>) => C
    }
  ): B | C
} = dual(2, <A, B, C = B>(
  self: ReadonlyArray<A>,
  { onEmpty, onNonEmpty }: {
    readonly onEmpty: LazyArg<B>
    readonly onNonEmpty: (head: A, tail: Array<A>) => C
  }
): B | C => isReadonlyArrayNonEmpty(self) ? onNonEmpty(headNonEmpty(self), tailNonEmpty(self)) : onEmpty())

/**
 * Matches the elements of an array from the right, applying functions to cases of empty and non-empty arrays.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const matchRight = Array.matchRight({
 *   onEmpty: () => "empty",
 *   onNonEmpty: (init, last) => `init: ${init.length}, last: ${last}`
 * })
 * console.log(matchRight([])) // "empty"
 * console.log(matchRight([1, 2, 3])) // "init: 2, last: 3"
 * ```
 *
 * @category pattern matching
 * @since 2.0.0
 */
export const matchRight: {
  <B, A, C = B>(
    options: {
      readonly onEmpty: LazyArg<B>
      readonly onNonEmpty: (init: Array<A>, last: A) => C
    }
  ): (self: ReadonlyArray<A>) => B | C
  <A, B, C = B>(
    self: ReadonlyArray<A>,
    options: {
      readonly onEmpty: LazyArg<B>
      readonly onNonEmpty: (init: Array<A>, last: A) => C
    }
  ): B | C
} = dual(2, <A, B, C = B>(
  self: ReadonlyArray<A>,
  { onEmpty, onNonEmpty }: {
    readonly onEmpty: LazyArg<B>
    readonly onNonEmpty: (init: Array<A>, last: A) => C
  }
): B | C =>
  isReadonlyArrayNonEmpty(self) ?
    onNonEmpty(initNonEmpty(self), lastNonEmpty(self)) :
    onEmpty())

/**
 * Prepend an element to the front of an `Iterable`, creating a new `NonEmptyArray`.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.prepend([2, 3, 4], 1)
 * console.log(result) // [1, 2, 3, 4]
 * ```
 *
 * @category concatenating
 * @since 2.0.0
 */
export const prepend: {
  <B>(head: B): <A>(self: Iterable<A>) => NonEmptyArray<A | B>
  <A, B>(self: Iterable<A>, head: B): NonEmptyArray<A | B>
} = dual(2, <A, B>(self: Iterable<A>, head: B): NonEmptyArray<A | B> => [head, ...self])

/**
 * Prepends the specified prefix array (or iterable) to the beginning of the specified array (or iterable).
 * If either array is non-empty, the result is also a non-empty array.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.prependAll([2, 3], [0, 1])
 * console.log(result) // [0, 1, 2, 3]
 * ```
 *
 * @category concatenating
 * @since 2.0.0
 */
export const prependAll: {
  <S extends Iterable<any>, T extends Iterable<any>>(
    that: T
  ): (self: S) => ReadonlyArray.OrNonEmpty<S, T, ReadonlyArray.Infer<S> | ReadonlyArray.Infer<T>>
  <A, B>(self: Iterable<A>, that: NonEmptyReadonlyArray<B>): NonEmptyArray<A | B>
  <A, B>(self: NonEmptyReadonlyArray<A>, that: Iterable<B>): NonEmptyArray<A | B>
  <A, B>(self: Iterable<A>, that: Iterable<B>): Array<A | B>
} = dual(
  2,
  <A>(self: Iterable<A>, that: Iterable<A>): Array<A> => fromIterable(that).concat(fromIterable(self))
)

/**
 * Append an element to the end of an `Iterable`, creating a new `NonEmptyArray`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.append([1, 2, 3], 4)
 * console.log(result) // [1, 2, 3, 4]
 * ```
 *
 * @category concatenating
 * @since 2.0.0
 */
export const append: {
  <B>(last: B): <A>(self: Iterable<A>) => NonEmptyArray<A | B>
  <A, B>(self: Iterable<A>, last: B): NonEmptyArray<A | B>
} = dual(2, <A, B>(self: Iterable<A>, last: B): Array<A | B> => [...self, last])

/**
 * Concatenates two arrays (or iterables), combining their elements.
 * If either array is non-empty, the result is also a non-empty array.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.appendAll([1, 2], [3, 4])
 * console.log(result) // [1, 2, 3, 4]
 * ```
 *
 * @category concatenating
 * @since 2.0.0
 */
export const appendAll: {
  <S extends Iterable<any>, T extends Iterable<any>>(
    that: T
  ): (self: S) => ReadonlyArray.OrNonEmpty<S, T, ReadonlyArray.Infer<S> | ReadonlyArray.Infer<T>>
  <A, B>(self: Iterable<A>, that: NonEmptyReadonlyArray<B>): NonEmptyArray<A | B>
  <A, B>(self: NonEmptyReadonlyArray<A>, that: Iterable<B>): NonEmptyArray<A | B>
  <A, B>(self: Iterable<A>, that: Iterable<B>): Array<A | B>
} = dual(
  2,
  <A>(self: Iterable<A>, that: Iterable<A>): Array<A> => fromIterable(self).concat(fromIterable(that))
)

/**
 * Accumulates values from an `Iterable` starting from the left, storing
 * each intermediate result in an array. Useful for tracking the progression of
 * a value through a series of transformations.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.scan([1, 2, 3, 4], 0, (acc, value) => acc + value)
 * console.log(result) // [0, 1, 3, 6, 10]
 *
 * // Explanation:
 * // This function starts with the initial value (0 in this case)
 * // and adds each element of the array to this accumulator one by one,
 * // keeping track of the cumulative sum after each addition.
 * // Each of these sums is captured in the resulting array.
 * ```
 *
 * @category folding
 * @since 2.0.0
 */
export const scan: {
  <B, A>(b: B, f: (b: B, a: A) => B): (self: Iterable<A>) => NonEmptyArray<B>
  <A, B>(self: Iterable<A>, b: B, f: (b: B, a: A) => B): NonEmptyArray<B>
} = dual(3, <A, B>(self: Iterable<A>, b: B, f: (b: B, a: A) => B): NonEmptyArray<B> => {
  const out: NonEmptyArray<B> = [b]
  let i = 0
  for (const a of self) {
    out[i + 1] = f(out[i], a)
    i++
  }
  return out
})

/**
 * Accumulates values from an `Iterable` starting from the right, storing
 * each intermediate result in an array. Useful for tracking the progression of
 * a value through a series of transformations.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.scanRight([1, 2, 3, 4], 0, (acc, value) => acc + value)
 * console.log(result) // [10, 9, 7, 4, 0]
 * ```
 *
 * @category folding
 * @since 2.0.0
 */
export const scanRight: {
  <B, A>(b: B, f: (b: B, a: A) => B): (self: Iterable<A>) => NonEmptyArray<B>
  <A, B>(self: Iterable<A>, b: B, f: (b: B, a: A) => B): NonEmptyArray<B>
} = dual(3, <A, B>(self: Iterable<A>, b: B, f: (b: B, a: A) => B): NonEmptyArray<B> => {
  const input = fromIterable(self)
  const out: NonEmptyArray<B> = new Array(input.length + 1) as any
  out[input.length] = b
  for (let i = input.length - 1; i >= 0; i--) {
    out[i] = f(out[i + 1], input[i])
  }
  return out
})

/**
 * Determine if `unknown` is an Array.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * console.log(Array.isArray(null)) // false
 * console.log(Array.isArray([1, 2, 3])) // true
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isArray: {
  (self: unknown): self is Array<unknown>
  <T>(self: T): self is Extract<T, ReadonlyArray<any>>
} = Array.isArray

/**
 * Determine if an `Array` is empty narrowing down the type to `[]`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * console.log(Array.isArrayEmpty([])) // true
 * console.log(Array.isArrayEmpty([1, 2, 3])) // false
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isArrayEmpty = <A>(self: Array<A>): self is [] => self.length === 0

/**
 * Determine if a `ReadonlyArray` is empty narrowing down the type to `readonly []`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * console.log(Array.isReadonlyArrayEmpty([])) // true
 * console.log(Array.isReadonlyArrayEmpty([1, 2, 3])) // false
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isReadonlyArrayEmpty: <A>(self: ReadonlyArray<A>) => self is readonly [] = isArrayEmpty as any

/**
 * Determine if an `Array` is non empty narrowing down the type to `NonEmptyArray`.
 *
 * An `Array` is considered to be a `NonEmptyArray` if it contains at least one element.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * console.log(Array.isArrayNonEmpty([])) // false
 * console.log(Array.isArrayNonEmpty([1, 2, 3])) // true
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isArrayNonEmpty: <A>(self: Array<A>) => self is NonEmptyArray<A> = internalArray.isArrayNonEmpty

/**
 * Determine if a `ReadonlyArray` is non empty narrowing down the type to `NonEmptyReadonlyArray`.
 *
 * A `ReadonlyArray` is considered to be a `NonEmptyReadonlyArray` if it contains at least one element.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * console.log(Array.isReadonlyArrayNonEmpty([])) // false
 * console.log(Array.isReadonlyArrayNonEmpty([1, 2, 3])) // true
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isReadonlyArrayNonEmpty: <A>(self: ReadonlyArray<A>) => self is NonEmptyReadonlyArray<A> =
  internalArray.isArrayNonEmpty

/**
 * Return the number of elements in a `ReadonlyArray`.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.length([1, 2, 3])
 * console.log(result) // 3
 * ```
 *
 * @category getters
 * @since 2.0.0
 */
export const length = <A>(self: ReadonlyArray<A>): number => self.length

/** @internal */
export function isOutOfBounds<A>(i: number, as: ReadonlyArray<A>): boolean {
  return i < 0 || i >= as.length
}

const clamp = <A>(i: number, as: ReadonlyArray<A>): number => Math.floor(Math.min(Math.max(0, i), as.length))

/**
 * This function provides a safe way to read a value at a particular index from a `ReadonlyArray`.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.get([1, 2, 3], 1)
 * console.log(result) // Some(2)
 *
 * const outOfBounds = Array.get([1, 2, 3], 10)
 * console.log(outOfBounds) // None
 * ```
 *
 * @category getters
 * @since 2.0.0
 */
export const get: {
  (index: number): <A>(self: ReadonlyArray<A>) => Option.Option<A>
  <A>(self: ReadonlyArray<A>, index: number): Option.Option<A>
} = dual(2, <A>(self: ReadonlyArray<A>, index: number): Option.Option<A> => {
  const i = Math.floor(index)
  return isOutOfBounds(i, self) ? Option.none() : Option.some(self[i])
})

/**
 * Gets an element unsafely, will throw on out of bounds.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.getUnsafe([1, 2, 3], 1)
 * console.log(result) // 2
 *
 * // This will throw an error
 * // Array.getUnsafe([1, 2, 3], 10)
 * ```
 *
 * @since 2.0.0
 * @category unsafe
 */
export const getUnsafe: {
  (index: number): <A>(self: ReadonlyArray<A>) => A
  <A>(self: ReadonlyArray<A>, index: number): A
} = dual(2, <A>(self: ReadonlyArray<A>, index: number): A => {
  const i = Math.floor(index)
  if (isOutOfBounds(i, self)) {
    throw new Error(`Index out of bounds: ${i}`)
  }
  return self[i]
})

/**
 * Return a tuple containing the first element, and a new `Array` of the remaining elements, if any.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.unprepend([1, 2, 3, 4])
 * console.log(result) // [1, [2, 3, 4]]
 * ```
 *
 * @category splitting
 * @since 2.0.0
 */
export const unprepend = <A>(
  self: NonEmptyReadonlyArray<A>
): [firstElement: A, remainingElements: Array<A>] => [headNonEmpty(self), tailNonEmpty(self)]

/**
 * Return a tuple containing a copy of the `NonEmptyReadonlyArray` without its last element, and that last element.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.unappend([1, 2, 3, 4])
 * console.log(result) // [[1, 2, 3], 4]
 * ```
 *
 * @category splitting
 * @since 2.0.0
 */
export const unappend = <A>(
  self: NonEmptyReadonlyArray<A>
): [arrayWithoutLastElement: Array<A>, lastElement: A] => [initNonEmpty(self), lastNonEmpty(self)]

/**
 * Get the first element of a `ReadonlyArray`, or `None` if the `ReadonlyArray` is empty.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.head([1, 2, 3])
 * console.log(result) // Some(1)
 *
 * const empty = Array.head([])
 * console.log(empty) // None
 * ```
 *
 * @category getters
 * @since 2.0.0
 */
export const head: <A>(self: ReadonlyArray<A>) => Option.Option<A> = get(0)

/**
 * Get the first element of a non empty array.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.headNonEmpty([1, 2, 3, 4])
 * console.log(result) // 1
 * ```
 *
 * @category getters
 * @since 2.0.0
 */
export const headNonEmpty: <A>(self: NonEmptyReadonlyArray<A>) => A = getUnsafe(0)

/**
 * Get the last element in a `ReadonlyArray`, or `None` if the `ReadonlyArray` is empty.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.last([1, 2, 3])
 * console.log(result) // Some(3)
 *
 * const empty = Array.last([])
 * console.log(empty) // None
 * ```
 *
 * @category getters
 * @since 2.0.0
 */
export const last = <A>(self: ReadonlyArray<A>): Option.Option<A> =>
  isReadonlyArrayNonEmpty(self) ? Option.some(lastNonEmpty(self)) : Option.none()

/**
 * Get the last element of a non empty array.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.lastNonEmpty([1, 2, 3, 4])
 * console.log(result) // 4
 * ```
 *
 * @category getters
 * @since 2.0.0
 */
export const lastNonEmpty = <A>(self: NonEmptyReadonlyArray<A>): A => self[self.length - 1]

/**
 * Get all but the first element of an `Iterable`, creating a new `Array`, or `None` if the `Iterable` is empty.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * Array.tail([1, 2, 3, 4]) // [2, 3, 4]
 * Array.tail([]) // undefined
 * ```
 *
 * @category getters
 * @since 2.0.0
 */
export function tail<A>(self: Iterable<A>): Array<A> | undefined {
  const as = fromIterable(self)
  return isReadonlyArrayNonEmpty(as) ? tailNonEmpty(as) : undefined
}

/**
 * Get all but the first element of a `NonEmptyReadonlyArray`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.tailNonEmpty([1, 2, 3, 4])
 * console.log(result) // [2, 3, 4]
 * ```
 *
 * @category getters
 * @since 2.0.0
 */
export const tailNonEmpty = <A>(self: NonEmptyReadonlyArray<A>): Array<A> => self.slice(1)

/**
 * Get all but the last element of an `Iterable`, creating a new `Array`, or `None` if the `Iterable` is empty.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * Array.init([1, 2, 3, 4]) // [1, 2, 3]
 * Array.init([]) // undefined
 * ```
 *
 * @category getters
 * @since 2.0.0
 */
export function init<A>(self: Iterable<A>): Array<A> | undefined {
  const as = fromIterable(self)
  return isReadonlyArrayNonEmpty(as) ? initNonEmpty(as) : undefined
}

/**
 * Get all but the last element of a non empty array, creating a new array.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.initNonEmpty([1, 2, 3, 4])
 * console.log(result) // [1, 2, 3]
 * ```
 *
 * @category getters
 * @since 2.0.0
 */
export const initNonEmpty = <A>(self: NonEmptyReadonlyArray<A>): Array<A> => self.slice(0, -1)

/**
 * Keep only a max number of elements from the start of an `Iterable`, creating a new `Array`.
 *
 * **Note**. `n` is normalized to a non negative integer.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.take([1, 2, 3, 4, 5], 3)
 * console.log(result) // [1, 2, 3]
 * ```
 *
 * @category getters
 * @since 2.0.0
 */
export const take: {
  (n: number): <A>(self: Iterable<A>) => Array<A>
  <A>(self: Iterable<A>, n: number): Array<A>
} = dual(2, <A>(self: Iterable<A>, n: number): Array<A> => {
  const input = fromIterable(self)
  return input.slice(0, clamp(n, input))
})

/**
 * Keep only a max number of elements from the end of an `Iterable`, creating a new `Array`.
 *
 * **Note**. `n` is normalized to a non negative integer.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.takeRight([1, 2, 3, 4, 5], 3)
 * console.log(result) // [3, 4, 5]
 * ```
 *
 * @category getters
 * @since 2.0.0
 */
export const takeRight: {
  (n: number): <A>(self: Iterable<A>) => Array<A>
  <A>(self: Iterable<A>, n: number): Array<A>
} = dual(2, <A>(self: Iterable<A>, n: number): Array<A> => {
  const input = fromIterable(self)
  const i = clamp(n, input)
  return i === 0 ? [] : input.slice(-i)
})

/**
 * Calculate the longest initial subarray for which all element satisfy the specified predicate, creating a new `Array`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.takeWhile([1, 3, 2, 4, 1, 2], (x) => x < 4)
 * console.log(result) // [1, 3, 2]
 *
 * // Explanation:
 * // - The function starts with the first element (`1`), which is less than `4`, so it adds `1` to the result.
 * // - The next element (`3`) is also less than `4`, so it adds `3`.
 * // - The next element (`2`) is again less than `4`, so it adds `2`.
 * // - The function then encounters `4`, which is not less than `4`. At this point, it stops checking further elements and finalizes the result.
 * ```
 *
 * @category getters
 * @since 2.0.0
 */
export const takeWhile: {
  <A, B extends A>(refinement: (a: NoInfer<A>, i: number) => a is B): (self: Iterable<A>) => Array<B>
  <A>(predicate: (a: NoInfer<A>, i: number) => boolean): (self: Iterable<A>) => Array<A>
  <A, B extends A>(self: Iterable<A>, refinement: (a: A, i: number) => a is B): Array<B>
  <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): Array<A>
} = dual(2, <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): Array<A> => {
  let i = 0
  const out: Array<A> = []
  for (const a of self) {
    if (!predicate(a, i)) {
      break
    }
    out.push(a)
    i++
  }
  return out
})

const spanIndex = <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): number => {
  let i = 0
  for (const a of self) {
    if (!predicate(a, i)) {
      break
    }
    i++
  }
  return i
}

/**
 * Split an `Iterable` into two parts:
 *
 * 1. the longest initial subarray for which all elements satisfy the specified predicate
 * 2. the remaining elements
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.span([1, 3, 2, 4, 5], (x) => x % 2 === 1)
 * console.log(result) // [[1, 3], [2, 4, 5]]
 * ```
 *
 * @category splitting
 * @since 2.0.0
 */
export const span: {
  <A, B extends A>(
    refinement: (a: NoInfer<A>, i: number) => a is B
  ): (self: Iterable<A>) => [init: Array<B>, rest: Array<Exclude<A, B>>]
  <A>(predicate: (a: NoInfer<A>, i: number) => boolean): (self: Iterable<A>) => [init: Array<A>, rest: Array<A>]
  <A, B extends A>(
    self: Iterable<A>,
    refinement: (a: A, i: number) => a is B
  ): [init: Array<B>, rest: Array<Exclude<A, B>>]
  <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): [init: Array<A>, rest: Array<A>]
} = dual(
  2,
  <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): [init: Array<A>, rest: Array<A>] =>
    splitAt(self, spanIndex(self, predicate))
)

/**
 * Drop a max number of elements from the start of an `Iterable`, creating a new `Array`.
 *
 * **Note**. `n` is normalized to a non negative integer.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.drop([1, 2, 3, 4, 5], 2)
 * console.log(result) // [3, 4, 5]
 * ```
 *
 * @category getters
 * @since 2.0.0
 */
export const drop: {
  (n: number): <A>(self: Iterable<A>) => Array<A>
  <A>(self: Iterable<A>, n: number): Array<A>
} = dual(2, <A>(self: Iterable<A>, n: number): Array<A> => {
  const input = fromIterable(self)
  return input.slice(clamp(n, input), input.length)
})

/**
 * Drop a max number of elements from the end of an `Iterable`, creating a new `Array`.
 *
 * **Note**. `n` is normalized to a non negative integer.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.dropRight([1, 2, 3, 4, 5], 2)
 * console.log(result) // [1, 2, 3]
 * ```
 *
 * @category getters
 * @since 2.0.0
 */
export const dropRight: {
  (n: number): <A>(self: Iterable<A>) => Array<A>
  <A>(self: Iterable<A>, n: number): Array<A>
} = dual(2, <A>(self: Iterable<A>, n: number): Array<A> => {
  const input = fromIterable(self)
  return input.slice(0, input.length - clamp(n, input))
})

/**
 * Remove the longest initial subarray for which all element satisfy the specified predicate, creating a new `Array`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.dropWhile([1, 2, 3, 4, 5], (x) => x < 4)
 * console.log(result) // [4, 5]
 * ```
 *
 * @category getters
 * @since 2.0.0
 */
export const dropWhile: {
  <A>(predicate: (a: NoInfer<A>, i: number) => boolean): (self: Iterable<A>) => Array<A>
  <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): Array<A>
} = dual(
  2,
  <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): Array<A> =>
    fromIterable(self).slice(spanIndex(self, predicate))
)

/**
 * Return the first index for which a predicate holds.
 *
 * **Example**
 *
 * ```ts
 * import { Array } from "effect"
 *
 * Array.findFirstIndex(
 *   [5, 3, 8, 9],
 *   (x) => x > 5
 * ) // 2
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const findFirstIndex: {
  <A>(predicate: (a: NoInfer<A>, i: number) => boolean): (self: Iterable<A>) => number | undefined
  <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): number | undefined
} = dual(2, <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): number | undefined => {
  let i = 0
  for (const a of self) {
    if (predicate(a, i)) {
      return i
    }
    i++
  }
})

/**
 * Return the last index for which a predicate holds.
 *
 * **Example**
 *
 * ```ts
 * import { Array } from "effect"
 *
 * Array.findLastIndex(
 *   [1, 3, 8, 9],
 *   (x) => x < 5
 * ) // 1
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const findLastIndex: {
  <A>(predicate: (a: NoInfer<A>, i: number) => boolean): (self: Iterable<A>) => number | undefined
  <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): number | undefined
} = dual(2, <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): number | undefined => {
  const input = fromIterable(self)
  for (let i = input.length - 1; i >= 0; i--) {
    if (predicate(input[i], i)) {
      return i
    }
  }
})

/**
 * Returns the first element that satisfies the specified
 * predicate, or `None` if no such element exists.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.findFirst([1, 2, 3, 4, 5], (x) => x > 3)
 * console.log(result) // Option.some(4)
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const findFirst: {
  <A, B>(f: (a: NoInfer<A>, i: number) => Option.Option<B>): (self: Iterable<A>) => Option.Option<B>
  <A, B extends A>(refinement: (a: NoInfer<A>, i: number) => a is B): (self: Iterable<A>) => Option.Option<B>
  <A>(predicate: (a: NoInfer<A>, i: number) => boolean): (self: Iterable<A>) => Option.Option<A>
  <A, B>(self: Iterable<A>, f: (a: A, i: number) => Option.Option<B>): Option.Option<B>
  <A, B extends A>(self: Iterable<A>, refinement: (a: A, i: number) => a is B): Option.Option<B>
  <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): Option.Option<A>
} = moduleIterable.findFirst

/**
 * Returns a tuple of the first element that satisfies the specified
 * predicate and its index, or `None` if no such element exists.
 *
 * **Example**
 *
 * ```ts
 * import { Array } from "effect"
 *
 * Array.findFirstWithIndex([1, 2, 3, 4, 5], (x) => x > 3) // [4, 3]
 * ```
 *
 * @category elements
 * @since 3.17.0
 */
export const findFirstWithIndex: {
  <A, B>(f: (a: NoInfer<A>, i: number) => Option.Option<B>): (self: Iterable<A>) => [B, number] | undefined
  <A, B extends A>(refinement: (a: NoInfer<A>, i: number) => a is B): (self: Iterable<A>) => [B, number] | undefined
  <A>(predicate: (a: NoInfer<A>, i: number) => boolean): (self: Iterable<A>) => [A, number] | undefined
  <A, B>(self: Iterable<A>, f: (a: A, i: number) => Option.Option<B>): [B, number] | undefined
  <A, B extends A>(self: Iterable<A>, refinement: (a: A, i: number) => a is B): [B, number] | undefined
  <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): [A, number] | undefined
} = dual(
  2,
  <A>(
    self: Iterable<A>,
    f: ((a: A, i: number) => boolean) | ((a: A, i: number) => Option.Option<A>)
  ): [A, number] | undefined => {
    let i = 0
    for (const a of self) {
      const o = f(a, i)
      if (typeof o === "boolean") {
        if (o) {
          return [a, i]
        }
      } else {
        if (Option.isSome(o)) {
          return [o.value, i]
        }
      }
      i++
    }
  }
)

/**
 * Finds the last element in an iterable collection that satisfies the given predicate or refinement.
 * Returns an `Option` containing the found element, or `Option.none` if no element matches.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.findLast([1, 2, 3, 4, 5], (n) => n % 2 === 0)
 * console.log(result) // Option.some(4)
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const findLast: {
  <A, B>(f: (a: NoInfer<A>, i: number) => Option.Option<B>): (self: Iterable<A>) => Option.Option<B>
  <A, B extends A>(refinement: (a: NoInfer<A>, i: number) => a is B): (self: Iterable<A>) => Option.Option<B>
  <A>(predicate: (a: NoInfer<A>, i: number) => boolean): (self: Iterable<A>) => Option.Option<A>
  <A, B>(self: Iterable<A>, f: (a: A, i: number) => Option.Option<B>): Option.Option<B>
  <A, B extends A>(self: Iterable<A>, refinement: (a: A, i: number) => a is B): Option.Option<B>
  <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): Option.Option<A>
} = dual(
  2,
  <A>(
    self: Iterable<A>,
    f: ((a: A, i: number) => boolean) | ((a: A, i: number) => Option.Option<A>)
  ): Option.Option<A> => {
    const input = fromIterable(self)
    for (let i = input.length - 1; i >= 0; i--) {
      const a = input[i]
      const o = f(a, i)
      if (typeof o === "boolean") {
        if (o) {
          return Option.some(a)
        }
      } else {
        if (Option.isSome(o)) {
          return o
        }
      }
    }
    return Option.none()
  }
)

/**
 * Insert an element at the specified index, creating a new `NonEmptyArray`,
 * or return `None` if the index is out of bounds.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * Array.insertAt(["a", "b", "c", "e"], 3, "d") // ['a', 'b', 'c', 'd', 'e']
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const insertAt: {
  <B>(i: number, b: B): <A>(self: Iterable<A>) => NonEmptyArray<A | B> | undefined
  <A, B>(self: Iterable<A>, i: number, b: B): NonEmptyArray<A | B> | undefined
} = dual(3, <A, B>(self: Iterable<A>, i: number, b: B): NonEmptyArray<A | B> | undefined => {
  const out: Array<A | B> = Array.from(self) // copy because `splice` mutates the array
  if (i < 0 || i > out.length) {
    return undefined
  }
  out.splice(i, 0, b)
  return out as any
})

/**
 * Replaces an element in an array with the given value, returning an updated array.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.replace([1, 2, 3], 1, 4)
 * console.log(result) // [1, 4, 3]
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const replace: {
  <B>(i: number, b: B): <A, S extends Iterable<A> = Iterable<A>>(
    self: S
  ) => ReadonlyArray.With<S, ReadonlyArray.Infer<S> | B> | undefined
  <A, B, S extends Iterable<A> = Iterable<A>>(
    self: S,
    i: number,
    b: B
  ): ReadonlyArray.With<S, ReadonlyArray.Infer<S> | B> | undefined
} = dual(
  3,
  <A, B>(self: Iterable<A>, i: number, b: B): Array<A | B> | undefined => modify(self, i, () => b)
)

/**
 * Apply a function to the element at the specified index, creating a new `Array`,
 * or return `undefined` if the index is out of bounds.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const input = [1, 2, 3, 4]
 * const result = Array.modify(input, 2, (n) => n * 2)
 * console.log(result) // [1, 2, 6, 4]
 *
 * const outOfBoundsResult = Array.modify(input, 5, (n) => n * 2)
 * console.log(outOfBoundsResult) // undefined
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const modify: {
  <A, B, S extends Iterable<A> = Iterable<A>>(
    i: number,
    f: (a: ReadonlyArray.Infer<S>) => B
  ): (self: S) => ReadonlyArray.With<S, ReadonlyArray.Infer<S> | B> | undefined
  <A, B, S extends Iterable<A> = Iterable<A>>(
    self: S,
    i: number,
    f: (a: ReadonlyArray.Infer<S>) => B
  ): ReadonlyArray.With<S, ReadonlyArray.Infer<S> | B> | undefined
} = dual(3, <A, B>(self: Iterable<A>, i: number, f: (a: A) => B): Array<A | B> | undefined => {
  const arr = Array.from(self)
  if (isOutOfBounds(i, arr)) {
    return undefined
  }
  const out: Array<A | B> = arr
  const b = f(arr[i])
  out[i] = b
  return out
})

/**
 * Delete the element at the specified index, creating a new `Array`,
 * or return a copy of the input if the index is out of bounds.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const input = [1, 2, 3, 4]
 * const result = Array.remove(input, 2)
 * console.log(result) // [1, 2, 4]
 *
 * const outOfBoundsResult = Array.remove(input, 5)
 * console.log(outOfBoundsResult) // [1, 2, 3, 4]
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const remove: {
  (i: number): <A>(self: Iterable<A>) => Array<A>
  <A>(self: Iterable<A>, i: number): Array<A>
} = dual(2, <A>(self: Iterable<A>, i: number): Array<A> => {
  const out = Array.from(self)
  if (isOutOfBounds(i, out)) {
    return out
  }
  out.splice(i, 1)
  return out
})

/**
 * Reverse an `Iterable`, creating a new `Array`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.reverse([1, 2, 3, 4])
 * console.log(result) // [4, 3, 2, 1]
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const reverse = <S extends Iterable<any>>(
  self: S
): S extends NonEmptyReadonlyArray<infer A> ? NonEmptyArray<A> : S extends Iterable<infer A> ? Array<A> : never =>
  Array.from(self).reverse() as any

/**
 * Create a new array with elements sorted in increasing order based on the specified comparator.
 * If the input is a `NonEmptyReadonlyArray`, the output will also be a `NonEmptyReadonlyArray`.
 *
 * @example
 * ```ts
 * import { Array, Order } from "effect"
 *
 * const result = Array.sort([3, 1, 4, 1, 5], Order.Number)
 * console.log(result) // [1, 1, 3, 4, 5]
 * ```
 *
 * @category sorting
 * @since 2.0.0
 */
export const sort: {
  <B>(
    O: Order.Order<B>
  ): <A extends B, S extends Iterable<A>>(self: S) => ReadonlyArray.With<S, ReadonlyArray.Infer<S>>
  <A extends B, B>(self: NonEmptyReadonlyArray<A>, O: Order.Order<B>): NonEmptyArray<A>
  <A extends B, B>(self: Iterable<A>, O: Order.Order<B>): Array<A>
} = dual(2, <A extends B, B>(self: Iterable<A>, O: Order.Order<B>): Array<A> => {
  const out = Array.from(self)
  out.sort(O)
  return out
})

/**
 * Sorts an array based on a provided mapping function and order. The mapping
 * function transforms the elements into a value that can be compared, and the
 * order defines how those values should be sorted.
 *
 * @example
 *
 * ```ts
 * import { Array, Order } from "effect"
 *
 * const result = Array.sortWith(["aaa", "b", "cc"], (s) => s.length, Order.Number)
 * console.log(result) // ["b", "cc", "aaa"]
 *
 * // Explanation:
 * // The array of strings is sorted based on their lengths. The mapping function `(s) => s.length`
 * // converts each string into its length, and the `Order.Number` specifies that the lengths should
 * // be sorted in ascending order.
 * ```
 *
 * @since 2.0.0
 * @category elements
 */
export const sortWith: {
  <S extends Iterable<any>, B>(
    f: (a: ReadonlyArray.Infer<S>) => B,
    order: Order.Order<B>
  ): (self: S) => ReadonlyArray.With<S, ReadonlyArray.Infer<S>>
  <A, B>(self: NonEmptyReadonlyArray<A>, f: (a: A) => B, O: Order.Order<B>): NonEmptyArray<A>
  <A, B>(self: Iterable<A>, f: (a: A) => B, order: Order.Order<B>): Array<A>
} = dual(
  3,
  <A, B>(self: Iterable<A>, f: (a: A) => B, order: Order.Order<B>): Array<A> =>
    Array.from(self).map((a) => [a, f(a)] as const).sort(([, a], [, b]) => order(a, b)).map(([_]) => _)
)

/**
 * Sorts the elements of an `Iterable` in increasing order based on the provided
 * orders. The elements are compared using the first order in `orders`, then the
 * second order if the first comparison is equal, and so on.
 *
 * @example
 *
 * ```ts
 * import { Array, Order, pipe } from "effect"
 *
 * const users = [
 *   { name: "Alice", age: 30 },
 *   { name: "Bob", age: 25 },
 *   { name: "Charlie", age: 30 }
 * ]
 *
 * const result = pipe(
 *   users,
 *   Array.sortBy(
 *     Order.mapInput(Order.Number, (user: (typeof users)[number]) => user.age),
 *     Order.mapInput(Order.String, (user: (typeof users)[number]) => user.name)
 *   )
 * )
 *
 * console.log(result)
 * // [
 * //   { name: "Bob", age: 25 },
 * //   { name: "Alice", age: 30 },
 * //   { name: "Charlie", age: 30 }
 * // ]
 *
 * // Explanation:
 * // The array of users is sorted first by age in ascending order. When ages are equal,
 * // the users are further sorted by name in ascending order.
 * ```
 *
 * @category sorting
 * @since 2.0.0
 */
export const sortBy = <S extends Iterable<any>>(
  ...orders: ReadonlyArray<Order.Order<ReadonlyArray.Infer<S>>>
) => {
  const sortByAll = sort(Order.combineAll(orders))
  return (
    self: S
  ): S extends NonEmptyReadonlyArray<infer A> ? NonEmptyArray<A> : S extends Iterable<infer A> ? Array<A> : never => {
    const input = fromIterable(self)
    if (isReadonlyArrayNonEmpty(input)) {
      return sortByAll(input) as any
    }
    return [] as any
  }
}

/**
 * Takes two `Iterable`s and returns an `Array` of corresponding pairs.
 * If one input `Iterable` is short, excess elements of the
 * longer `Iterable` are discarded.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.zip([1, 2, 3], ["a", "b"])
 * console.log(result) // [[1, 'a'], [2, 'b']]
 * ```
 *
 * @category zipping
 * @since 2.0.0
 */
export const zip: {
  <B>(that: NonEmptyReadonlyArray<B>): <A>(self: NonEmptyReadonlyArray<A>) => NonEmptyArray<[A, B]>
  <B>(that: Iterable<B>): <A>(self: Iterable<A>) => Array<[A, B]>
  <A, B>(self: NonEmptyReadonlyArray<A>, that: NonEmptyReadonlyArray<B>): NonEmptyArray<[A, B]>
  <A, B>(self: Iterable<A>, that: Iterable<B>): Array<[A, B]>
} = dual(
  2,
  <A, B>(self: Iterable<A>, that: Iterable<B>): Array<[A, B]> => zipWith(self, that, Tuple.make)
)

/**
 * Apply a function to pairs of elements at the same index in two `Iterable`s, collecting the results in a new `Array`. If one
 * input `Iterable` is short, excess elements of the longer `Iterable` are discarded.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.zipWith([1, 2, 3], [4, 5, 6], (a, b) => a + b)
 * console.log(result) // [5, 7, 9]
 * ```
 *
 * @category zipping
 * @since 2.0.0
 */
export const zipWith: {
  <B, A, C>(that: NonEmptyReadonlyArray<B>, f: (a: A, b: B) => C): (self: NonEmptyReadonlyArray<A>) => NonEmptyArray<C>
  <B, A, C>(that: Iterable<B>, f: (a: A, b: B) => C): (self: Iterable<A>) => Array<C>
  <A, B, C>(self: NonEmptyReadonlyArray<A>, that: NonEmptyReadonlyArray<B>, f: (a: A, b: B) => C): NonEmptyArray<C>
  <B, A, C>(self: Iterable<A>, that: Iterable<B>, f: (a: A, b: B) => C): Array<C>
} = dual(3, <B, A, C>(self: Iterable<A>, that: Iterable<B>, f: (a: A, b: B) => C): Array<C> => {
  const as = fromIterable(self)
  const bs = fromIterable(that)
  if (isReadonlyArrayNonEmpty(as) && isReadonlyArrayNonEmpty(bs)) {
    const out: NonEmptyArray<C> = [f(headNonEmpty(as), headNonEmpty(bs))]
    const len = Math.min(as.length, bs.length)
    for (let i = 1; i < len; i++) {
      out[i] = f(as[i], bs[i])
    }
    return out
  }
  return []
})

/**
 * This function is the inverse of `zip`. Takes an `Iterable` of pairs and return two corresponding `Array`s.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.unzip([[1, "a"], [2, "b"], [3, "c"]])
 * console.log(result) // [[1, 2, 3], ['a', 'b', 'c']]
 * ```
 *
 * @category zipping
 * @since 2.0.0
 */
export const unzip: <S extends Iterable<readonly [any, any]>>(
  self: S
) => S extends NonEmptyReadonlyArray<readonly [infer A, infer B]> ? [NonEmptyArray<A>, NonEmptyArray<B>]
  : S extends Iterable<readonly [infer A, infer B]> ? [Array<A>, Array<B>]
  : never = (<A, B>(self: Iterable<readonly [A, B]>): [Array<A>, Array<B>] => {
    const input = fromIterable(self)
    if (isReadonlyArrayNonEmpty(input)) {
      const fa: NonEmptyArray<A> = [input[0][0]]
      const fb: NonEmptyArray<B> = [input[0][1]]
      for (let i = 1; i < input.length; i++) {
        fa[i] = input[i][0]
        fb[i] = input[i][1]
      }
      return [fa, fb]
    }
    return [[], []]
  }) as any

/**
 * Places an element in between members of an `Iterable`.
 * If the input is a non-empty array, the result is also a non-empty array.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.intersperse([1, 2, 3], 0)
 * console.log(result) // [1, 0, 2, 0, 3]
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const intersperse: {
  <B>(
    middle: B
  ): <S extends Iterable<any>>(self: S) => ReadonlyArray.With<S, ReadonlyArray.Infer<S> | B>
  <A, B>(self: NonEmptyReadonlyArray<A>, middle: B): NonEmptyArray<A | B>
  <A, B>(self: Iterable<A>, middle: B): Array<A | B>
} = dual(2, <A, B>(self: Iterable<A>, middle: B): Array<A | B> => {
  const input = fromIterable(self)
  if (isReadonlyArrayNonEmpty(input)) {
    const out: NonEmptyArray<A | B> = [headNonEmpty(input)]
    const tail = tailNonEmpty(input)
    for (let i = 0; i < tail.length; i++) {
      if (i < tail.length) {
        out.push(middle)
      }
      out.push(tail[i])
    }
    return out
  }
  return []
})

/**
 * Apply a function to the head, creating a new `NonEmptyReadonlyArray`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.modifyHeadNonEmpty([1, 2, 3], (n) => n * 10)
 * console.log(result) // [10, 2, 3]
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const modifyHeadNonEmpty: {
  <A, B>(f: (a: A) => B): (self: NonEmptyReadonlyArray<A>) => NonEmptyArray<A | B>
  <A, B>(self: NonEmptyReadonlyArray<A>, f: (a: A) => B): NonEmptyArray<A | B>
} = dual(
  2,
  <A, B>(
    self: NonEmptyReadonlyArray<A>,
    f: (a: A) => B
  ): NonEmptyArray<A | B> => [f(headNonEmpty(self)), ...tailNonEmpty(self)]
)

/**
 * Change the head, creating a new `NonEmptyReadonlyArray`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.setHeadNonEmpty([1, 2, 3], 10)
 * console.log(result) // [10, 2, 3]
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const setHeadNonEmpty: {
  <B>(b: B): <A>(self: NonEmptyReadonlyArray<A>) => NonEmptyArray<A | B>
  <A, B>(self: NonEmptyReadonlyArray<A>, b: B): NonEmptyArray<A | B>
} = dual(
  2,
  <A, B>(self: NonEmptyReadonlyArray<A>, b: B): NonEmptyArray<A | B> => modifyHeadNonEmpty(self, () => b)
)

/**
 * Apply a function to the last element, creating a new `NonEmptyReadonlyArray`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.modifyLastNonEmpty([1, 2, 3], (n) => n * 2)
 * console.log(result) // [1, 2, 6]
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const modifyLastNonEmpty: {
  <A, B>(f: (a: A) => B): (self: NonEmptyReadonlyArray<A>) => NonEmptyArray<A | B>
  <A, B>(self: NonEmptyReadonlyArray<A>, f: (a: A) => B): NonEmptyArray<A | B>
} = dual(
  2,
  <A, B>(self: NonEmptyReadonlyArray<A>, f: (a: A) => B): NonEmptyArray<A | B> =>
    append(initNonEmpty(self), f(lastNonEmpty(self)))
)

/**
 * Change the last element, creating a new `NonEmptyReadonlyArray`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.setLastNonEmpty([1, 2, 3], 4)
 * console.log(result) // [1, 2, 4]
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const setLastNonEmpty: {
  <B>(b: B): <A>(self: NonEmptyReadonlyArray<A>) => NonEmptyArray<A | B>
  <A, B>(self: NonEmptyReadonlyArray<A>, b: B): NonEmptyArray<A | B>
} = dual(
  2,
  <A, B>(self: NonEmptyReadonlyArray<A>, b: B): NonEmptyArray<A | B> => modifyLastNonEmpty(self, () => b)
)

/**
 * Rotate an `Iterable` by `n` steps.
 * If the input is a non-empty array, the result is also a non-empty array.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.rotate(["a", "b", "c", "d"], 2)
 * console.log(result) // ['c', 'd', 'a', 'b']
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const rotate: {
  (n: number): <S extends Iterable<any>>(self: S) => ReadonlyArray.With<S, ReadonlyArray.Infer<S>>
  <A>(self: NonEmptyReadonlyArray<A>, n: number): NonEmptyArray<A>
  <A>(self: Iterable<A>, n: number): Array<A>
} = dual(2, <A>(self: Iterable<A>, n: number): Array<A> => {
  const input = fromIterable(self)
  if (isReadonlyArrayNonEmpty(input)) {
    const len = input.length
    const m = Math.round(n) % len
    if (isOutOfBounds(Math.abs(m), input) || m === 0) {
      return copy(input)
    }
    if (m < 0) {
      const [f, s] = splitAtNonEmpty(input, -m)
      return appendAll(s, f)
    } else {
      return rotate(self, m - len)
    }
  }
  return []
})

/**
 * Returns a function that checks if a `ReadonlyArray` contains a given value using a provided `isEquivalent` function.
 *
 * @example
 *
 * ```ts
 * import { Array, pipe } from "effect"
 *
 * const isEquivalent = (a: number, b: number) => a === b
 * const containsNumber = Array.containsWith(isEquivalent)
 * const result = pipe([1, 2, 3, 4], containsNumber(3))
 * console.log(result) // true
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const containsWith = <A>(isEquivalent: (self: A, that: A) => boolean): {
  (a: A): (self: Iterable<A>) => boolean
  (self: Iterable<A>, a: A): boolean
} =>
  dual(2, (self: Iterable<A>, a: A): boolean => {
    for (const i of self) {
      if (isEquivalent(a, i)) {
        return true
      }
    }
    return false
  })

/**
 * Returns a function that checks if a `ReadonlyArray` contains a given value using the default `Equivalence`.
 *
 * @example
 *
 * ```ts
 * import { Array, pipe } from "effect"
 *
 * const result = pipe(["a", "b", "c", "d"], Array.contains("c"))
 * console.log(result) // true
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const contains: {
  <A>(a: A): (self: Iterable<A>) => boolean
  <A>(self: Iterable<A>, a: A): boolean
} = containsWith(Equal.asEquivalence())

/**
 * A useful recursion pattern for processing an `Iterable` to produce a new `Array`, often used for "chopping" up the input
 * `Iterable`. Typically chop is called with some function that will consume an initial prefix of the `Iterable` and produce a
 * value and the rest of the `Array`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.chop(
 *   [1, 2, 3, 4, 5],
 *   (as): [number, Array<number>] => [as[0] * 2, as.slice(1)]
 * )
 * console.log(result) // [2, 4, 6, 8, 10]
 *
 * // Explanation:
 * // The `chopFunction` takes the first element of the array, doubles it, and then returns it along with the rest of the array.
 * // The `chop` function applies this `chopFunction` recursively to the input array `[1, 2, 3, 4, 5]`,
 * // resulting in a new array `[2, 4, 6, 8, 10]`.
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const chop: {
  <S extends Iterable<any>, B>(
    f: (as: NonEmptyReadonlyArray<ReadonlyArray.Infer<S>>) => readonly [B, ReadonlyArray<ReadonlyArray.Infer<S>>]
  ): (self: S) => ReadonlyArray.With<S, ReadonlyArray.Infer<S>>
  <A, B>(
    self: NonEmptyReadonlyArray<A>,
    f: (as: NonEmptyReadonlyArray<A>) => readonly [B, ReadonlyArray<A>]
  ): NonEmptyArray<B>
  <A, B>(
    self: Iterable<A>,
    f: (as: NonEmptyReadonlyArray<A>) => readonly [B, ReadonlyArray<A>]
  ): Array<B>
} = dual(2, <A, B>(
  self: Iterable<A>,
  f: (as: NonEmptyReadonlyArray<A>) => readonly [B, ReadonlyArray<A>]
): Array<B> => {
  const input = fromIterable(self)
  if (isReadonlyArrayNonEmpty(input)) {
    const [b, rest] = f(input)
    const out: NonEmptyArray<B> = [b]
    let next: ReadonlyArray<A> = rest
    while (internalArray.isArrayNonEmpty(next)) {
      const [b, rest] = f(next)
      out.push(b)
      next = rest
    }
    return out
  }
  return []
})

/**
 * Splits an `Iterable` into two segments, with the first segment containing a maximum of `n` elements.
 * The value of `n` can be `0`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.splitAt([1, 2, 3, 4, 5], 3)
 * console.log(result) // [[1, 2, 3], [4, 5]]
 * ```
 *
 * @category splitting
 * @since 2.0.0
 */
export const splitAt: {
  (n: number): <A>(self: Iterable<A>) => [beforeIndex: Array<A>, fromIndex: Array<A>]
  <A>(self: Iterable<A>, n: number): [beforeIndex: Array<A>, fromIndex: Array<A>]
} = dual(2, <A>(self: Iterable<A>, n: number): [Array<A>, Array<A>] => {
  const input = Array.from(self)
  const _n = Math.floor(n)
  if (isReadonlyArrayNonEmpty(input)) {
    if (_n >= 1) {
      return splitAtNonEmpty(input, _n)
    }
    return [[], input]
  }
  return [input, []]
})

/**
 * Splits a `NonEmptyReadonlyArray` into two segments, with the first segment containing a maximum of `n` elements.
 * The value of `n` must be `>= 1`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.splitAtNonEmpty(["a", "b", "c", "d", "e"], 3)
 * console.log(result) // [["a", "b", "c"], ["d", "e"]]
 * ```
 *
 * @category splitting
 * @since 2.0.0
 */
export const splitAtNonEmpty: {
  (n: number): <A>(self: NonEmptyReadonlyArray<A>) => [beforeIndex: NonEmptyArray<A>, fromIndex: Array<A>]
  <A>(self: NonEmptyReadonlyArray<A>, n: number): [beforeIndex: NonEmptyArray<A>, fromIndex: Array<A>]
} = dual(2, <A>(self: NonEmptyReadonlyArray<A>, n: number): [NonEmptyArray<A>, Array<A>] => {
  const _n = Math.max(1, Math.floor(n))
  return _n >= self.length ?
    [copy(self), []] :
    [prepend(self.slice(1, _n), headNonEmpty(self)), self.slice(_n)]
})

/**
 * Splits this iterable into `n` equally sized arrays.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.split([1, 2, 3, 4, 5, 6, 7, 8], 3)
 * console.log(result) // [[1, 2, 3], [4, 5, 6], [7, 8]]
 * ```
 *
 * @since 2.0.0
 * @category splitting
 */
export const split: {
  (n: number): <A>(self: Iterable<A>) => Array<Array<A>>
  <A>(self: Iterable<A>, n: number): Array<Array<A>>
} = dual(2, <A>(self: Iterable<A>, n: number) => {
  const input = fromIterable(self)
  return chunksOf(input, Math.ceil(input.length / Math.floor(n)))
})

/**
 * Splits this iterable on the first element that matches this predicate.
 * Returns a tuple containing two arrays: the first one is before the match, and the second one is from the match onward.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.splitWhere([1, 2, 3, 4, 5], (n) => n > 3)
 * console.log(result) // [[1, 2, 3], [4, 5]]
 * ```
 *
 * @category splitting
 * @since 2.0.0
 */
export const splitWhere: {
  <A>(
    predicate: (a: NoInfer<A>, i: number) => boolean
  ): (self: Iterable<A>) => [beforeMatch: Array<A>, fromMatch: Array<A>]
  <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): [beforeMatch: Array<A>, fromMatch: Array<A>]
} = dual(
  2,
  <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): [beforeMatch: Array<A>, fromMatch: Array<A>] =>
    span(self, (a: A, i: number) => !predicate(a, i))
)

/**
 * Copies an array.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.copy([1, 2, 3])
 * console.log(result) // [1, 2, 3]
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const copy: {
  <A>(self: NonEmptyReadonlyArray<A>): NonEmptyArray<A>
  <A>(self: ReadonlyArray<A>): Array<A>
} = (<A>(self: ReadonlyArray<A>): Array<A> => self.slice()) as any

/**
 * Pads an array.
 * Returns a new array of length `n` with the elements of `array` followed by `fill` elements if `array` is shorter than `n`.
 * If `array` is longer than `n`, the returned array will be a slice of `array` containing the `n` first elements of `array`.
 * If `n` is less than or equal to 0, the returned array will be an empty array.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.pad([1, 2, 3], 6, 0)
 * console.log(result) // [1, 2, 3, 0, 0, 0]
 * ```
 *
 * @category elements
 * @since 3.8.4
 */
export const pad: {
  <A, T>(
    n: number,
    fill: T
  ): (
    self: Array<A>
  ) => Array<A | T>
  <A, T>(self: Array<A>, n: number, fill: T): Array<A | T>
} = dual(3, <A, T>(self: Array<A>, n: number, fill: T): Array<A | T> => {
  if (self.length >= n) {
    return take(self, n)
  }
  return appendAll(
    self,
    makeBy(n - self.length, () => fill)
  )
})

/**
 * Splits an `Iterable` into length-`n` pieces. The last piece will be shorter if `n` does not evenly divide the length of
 * the `Iterable`. Note that `chunksOf(n)([])` is `[]`, not `[[]]`. This is intentional, and is consistent with a recursive
 * definition of `chunksOf`; it satisfies the property that
 *
 * ```ts skip-type-checking
 * chunksOf(n)(xs).concat(chunksOf(n)(ys)) == chunksOf(n)(xs.concat(ys)))
 * ```
 *
 * whenever `n` evenly divides the length of `self`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.chunksOf([1, 2, 3, 4, 5], 2)
 * console.log(result) // [[1, 2], [3, 4], [5]]
 *
 * // Explanation:
 * // The `chunksOf` function takes an array of numbers `[1, 2, 3, 4, 5]` and a number `2`.
 * // It splits the array into chunks of length 2. Since the array length is not evenly divisible by 2,
 * // the last chunk contains the remaining elements.
 * // The result is `[[1, 2], [3, 4], [5]]`.
 * ```
 *
 * @category splitting
 * @since 2.0.0
 */
export const chunksOf: {
  (
    n: number
  ): <S extends Iterable<any>>(
    self: S
  ) => ReadonlyArray.With<S, NonEmptyArray<ReadonlyArray.Infer<S>>>
  <A>(self: NonEmptyReadonlyArray<A>, n: number): NonEmptyArray<NonEmptyArray<A>>
  <A>(self: Iterable<A>, n: number): Array<NonEmptyArray<A>>
} = dual(2, <A>(self: Iterable<A>, n: number): Array<NonEmptyArray<A>> => {
  const input = fromIterable(self)
  if (isReadonlyArrayNonEmpty(input)) {
    return chop(input, splitAtNonEmpty(n))
  }
  return []
})

/**
 * Creates sliding windows of size `n` from an `Iterable`.
 *
 * If the number of elements in the `Iterable` is less than `n` or if `n` is not
 * greater than zero, an empty array is returned.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const numbers = [1, 2, 3, 4, 5]
 *
 * console.log(Array.window(numbers, 3)) // [[1, 2, 3], [2, 3, 4], [3, 4, 5]]
 * console.log(Array.window(numbers, 6)) // []
 * ```
 *
 * @category splitting
 * @since 3.13.2
 */
export const window: {
  <N extends number>(n: N): <A>(self: Iterable<A>) => Array<TupleOf<N, A>>
  <A, N extends number>(self: Iterable<A>, n: N): Array<TupleOf<N, A>>
} = dual(2, <A>(self: Iterable<A>, n: number): Array<Array<A>> => {
  const input = fromIterable(self)
  if (n > 0 && isReadonlyArrayNonEmpty(input)) {
    return Array.from(
      { length: input.length - (n - 1) },
      (_, index) => input.slice(index, index + n)
    )
  }
  return []
})

/**
 * Group equal, consecutive elements of a `NonEmptyReadonlyArray` into `NonEmptyArray`s using the provided `isEquivalent` function.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.groupWith(
 *   ["a", "a", "b", "b", "b", "c", "a"],
 *   (x, y) => x === y
 * )
 * console.log(result) // [["a", "a"], ["b", "b", "b"], ["c"], ["a"]]
 * ```
 *
 * @category grouping
 * @since 2.0.0
 */
export const groupWith: {
  <A>(isEquivalent: (self: A, that: A) => boolean): (self: NonEmptyReadonlyArray<A>) => NonEmptyArray<NonEmptyArray<A>>
  <A>(self: NonEmptyReadonlyArray<A>, isEquivalent: (self: A, that: A) => boolean): NonEmptyArray<NonEmptyArray<A>>
} = dual(
  2,
  <A>(self: NonEmptyReadonlyArray<A>, isEquivalent: (self: A, that: A) => boolean): NonEmptyArray<NonEmptyArray<A>> =>
    chop(self, (as) => {
      const h = headNonEmpty(as)
      const out: NonEmptyArray<A> = [h]
      let i = 1
      for (; i < as.length; i++) {
        const a = as[i]
        if (isEquivalent(a, h)) {
          out.push(a)
        } else {
          break
        }
      }
      return [out, as.slice(i)]
    })
)

/**
 * Group equal, consecutive elements of a `NonEmptyReadonlyArray` into `NonEmptyArray`s.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.group([1, 1, 2, 2, 2, 3, 1])
 * console.log(result) // [[1, 1], [2, 2, 2], [3], [1]]
 * ```
 *
 * @category grouping
 * @since 2.0.0
 */
export const group: <A>(self: NonEmptyReadonlyArray<A>) => NonEmptyArray<NonEmptyArray<A>> = groupWith(
  Equal.asEquivalence()
)

/**
 * Splits an `Iterable` into sub-non-empty-arrays stored in an object, based on the result of calling a `string`-returning
 * function on each element, and grouping the results according to values returned
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const people = [
 *   { name: "Alice", group: "A" },
 *   { name: "Bob", group: "B" },
 *   { name: "Charlie", group: "A" }
 * ]
 *
 * const result = Array.groupBy(people, (person) => person.group)
 * console.log(result)
 * // {
 * //  A: [{ name: "Alice", group: "A" }, { name: "Charlie", group: "A" }],
 * //  B: [{ name: "Bob", group: "B" }]
 * // }
 * ```
 *
 * @category grouping
 * @since 2.0.0
 */
export const groupBy: {
  <A, K extends string | symbol>(
    f: (a: A) => K
  ): (self: Iterable<A>) => Record<Record.ReadonlyRecord.NonLiteralKey<K>, NonEmptyArray<A>>
  <A, K extends string | symbol>(
    self: Iterable<A>,
    f: (a: A) => K
  ): Record<Record.ReadonlyRecord.NonLiteralKey<K>, NonEmptyArray<A>>
} = dual(2, <A, K extends string | symbol>(
  self: Iterable<A>,
  f: (a: A) => K
): Record<Record.ReadonlyRecord.NonLiteralKey<K>, NonEmptyArray<A>> => {
  const out: Record<string | symbol, NonEmptyArray<A>> = {}
  for (const a of self) {
    const k = f(a)
    if (Object.hasOwn(out, k)) {
      out[k].push(a)
    } else {
      out[k] = [a]
    }
  }
  return out
})

/**
 * Calculates the union of two arrays using the provided equivalence relation.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const union = Array.unionWith([1, 2], [2, 3], (a, b) => a === b)
 * console.log(union) // [1, 2, 3]
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const unionWith: {
  <S extends Iterable<any>, T extends Iterable<any>>(
    that: T,
    isEquivalent: (self: ReadonlyArray.Infer<S>, that: ReadonlyArray.Infer<T>) => boolean
  ): (self: S) => ReadonlyArray.OrNonEmpty<S, T, ReadonlyArray.Infer<S> | ReadonlyArray.Infer<T>>
  <A, B>(
    self: NonEmptyReadonlyArray<A>,
    that: Iterable<B>,
    isEquivalent: (self: A, that: B) => boolean
  ): NonEmptyArray<A | B>
  <A, B>(
    self: Iterable<A>,
    that: NonEmptyReadonlyArray<B>,
    isEquivalent: (self: A, that: B) => boolean
  ): NonEmptyArray<A | B>
  <A, B>(self: Iterable<A>, that: Iterable<B>, isEquivalent: (self: A, that: B) => boolean): Array<A | B>
} = dual(3, <A>(self: Iterable<A>, that: Iterable<A>, isEquivalent: (self: A, that: A) => boolean): Array<A> => {
  const a = fromIterable(self)
  const b = fromIterable(that)
  if (isReadonlyArrayNonEmpty(a)) {
    if (isReadonlyArrayNonEmpty(b)) {
      const dedupe = dedupeWith(isEquivalent)
      return dedupe(appendAll(a, b))
    }
    return a
  }
  return b
})

/**
 * Creates a union of two arrays, removing duplicates.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.union([1, 2], [2, 3])
 * console.log(result) // [1, 2, 3]
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const union: {
  <T extends Iterable<any>>(
    that: T
  ): <S extends Iterable<any>>(
    self: S
  ) => ReadonlyArray.OrNonEmpty<S, T, ReadonlyArray.Infer<S> | ReadonlyArray.Infer<T>>
  <A, B>(self: NonEmptyReadonlyArray<A>, that: ReadonlyArray<B>): NonEmptyArray<A | B>
  <A, B>(self: ReadonlyArray<A>, that: NonEmptyReadonlyArray<B>): NonEmptyArray<A | B>
  <A, B>(self: Iterable<A>, that: Iterable<B>): Array<A | B>
} = dual(
  2,
  <A, B>(self: Iterable<A>, that: Iterable<B>): Array<A | B> => unionWith(self, that, Equal.asEquivalence<A | B>())
)

/**
 * Creates an `Array` of unique values that are included in all given `Iterable`s using the provided `isEquivalent` function.
 * The order and references of result values are determined by the first `Iterable`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const array1 = [{ id: 1 }, { id: 2 }, { id: 3 }]
 * const array2 = [{ id: 3 }, { id: 4 }, { id: 1 }]
 * const isEquivalent = (a: { id: number }, b: { id: number }) => a.id === b.id
 * const result = Array.intersectionWith(isEquivalent)(array2)(array1)
 * console.log(result) // [{ id: 1 }, { id: 3 }]
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const intersectionWith = <A>(isEquivalent: (self: A, that: A) => boolean): {
  (that: Iterable<A>): (self: Iterable<A>) => Array<A>
  (self: Iterable<A>, that: Iterable<A>): Array<A>
} => {
  const has = containsWith(isEquivalent)
  return dual(
    2,
    (self: Iterable<A>, that: Iterable<A>): Array<A> => fromIterable(self).filter((a) => has(that, a))
  )
}

/**
 * Creates an `Array` of unique values that are included in all given `Iterable`s.
 * The order and references of result values are determined by the first `Iterable`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.intersection([1, 2, 3], [3, 4, 1])
 * console.log(result) // [1, 3]
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const intersection: {
  <B>(that: Iterable<B>): <A>(self: Iterable<A>) => Array<A & B>
  <A, B>(self: Iterable<A>, that: Iterable<B>): Array<A & B>
} = intersectionWith(Equal.asEquivalence())

/**
 * Creates a `Array` of values not included in the other given `Iterable` using the provided `isEquivalent` function.
 * The order and references of result values are determined by the first `Iterable`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const array1 = [1, 2, 3]
 * const array2 = [2, 3, 4]
 * const difference = Array.differenceWith<number>((a, b) => a === b)(
 *   array1,
 *   array2
 * )
 * console.log(difference) // [1]
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const differenceWith = <A>(isEquivalent: (self: A, that: A) => boolean): {
  (that: Iterable<A>): (self: Iterable<A>) => Array<A>
  (self: Iterable<A>, that: Iterable<A>): Array<A>
} => {
  const has = containsWith(isEquivalent)
  return dual(
    2,
    (self: Iterable<A>, that: Iterable<A>): Array<A> => fromIterable(self).filter((a) => !has(that, a))
  )
}

/**
 * Creates a `Array` of values not included in the other given `Iterable`.
 * The order and references of result values are determined by the first `Iterable`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const difference = Array.difference([1, 2, 3], [2, 3, 4])
 * console.log(difference) // [1]
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const difference: {
  <A>(that: Iterable<A>): (self: Iterable<A>) => Array<A>
  <A>(self: Iterable<A>, that: Iterable<A>): Array<A>
} = differenceWith(Equal.asEquivalence())

/**
 * Creates an empty array.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.empty()
 * console.log(result) // []
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const empty: <A = never>() => Array<A> = () => []

/**
 * Constructs a new `NonEmptyArray<A>` from the specified value.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.of(1)
 * console.log(result) // [1]
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const of = <A>(a: A): NonEmptyArray<A> => [a]

/**
 * Namespace containing utility types and functions for ReadonlyArray.
 *
 * @example
 * ```ts
 * import type { Array } from "effect"
 *
 * type ElementType = Array.ReadonlyArray.Infer<ReadonlyArray<string>>
 * // ElementType is string
 * ```
 *
 * @since 2.0.0
 */
/**
 * A namespace containing utility types for ReadonlyArray operations.
 *
 * @example
 * ```ts
 * import type { Array } from "effect"
 *
 * // Using ReadonlyArray utility types
 * type ElementType = Array.ReadonlyArray.Infer<ReadonlyArray<string>>
 * type WithNumber = Array.ReadonlyArray.With<readonly [string], number>
 * ```
 *
 * @category types
 * @since 2.0.0
 */
export declare namespace ReadonlyArray {
  /**
   * Infers the element type of an iterable.
   *
   * @example
   * ```ts
   * import type { Array } from "effect"
   *
   * type StringArrayType = Array.ReadonlyArray.Infer<ReadonlyArray<string>>
   * // StringArrayType is string
   * ```
   *
   * @category types
   * @since 2.0.0
   */
  export type Infer<S extends Iterable<any>> = S extends ReadonlyArray<infer A> ? A
    : S extends Iterable<infer A> ? A
    : never

  /**
   * Constructs an array type preserving non-emptiness.
   *
   * @example
   * ```ts
   * import type { Array } from "effect"
   *
   * type Result = Array.ReadonlyArray.With<readonly [number], string>
   * // Result is NonEmptyArray<string>
   * ```
   *
   * @category types
   * @since 2.0.0
   */
  export type With<S extends Iterable<any>, A> = S extends NonEmptyReadonlyArray<any> ? NonEmptyArray<A>
    : Array<A>

  /**
   * Creates a non-empty array if either input is non-empty.
   *
   * @example
   * ```ts
   * import type { Array } from "effect"
   *
   * type Result = Array.ReadonlyArray.OrNonEmpty<
   *   readonly [number],
   *   ReadonlyArray<string>,
   *   number
   * >
   * // Result is NonEmptyArray<number>
   * ```
   *
   * @category types
   * @since 2.0.0
   */
  export type OrNonEmpty<
    S extends Iterable<any>,
    T extends Iterable<any>,
    A
  > = S extends NonEmptyReadonlyArray<any> ? NonEmptyArray<A>
    : T extends NonEmptyReadonlyArray<any> ? NonEmptyArray<A>
    : Array<A>

  /**
   * Creates a non-empty array only if both inputs are non-empty.
   *
   * @example
   * ```ts
   * import type { Array } from "effect"
   *
   * type Result = Array.ReadonlyArray.AndNonEmpty<
   *   readonly [number],
   *   readonly [string],
   *   boolean
   * >
   * // Result is NonEmptyArray<boolean>
   * ```
   *
   * @category types
   * @since 2.0.0
   */
  export type AndNonEmpty<
    S extends Iterable<any>,
    T extends Iterable<any>,
    A
  > = S extends NonEmptyReadonlyArray<any> ? T extends NonEmptyReadonlyArray<any> ? NonEmptyArray<A>
    : Array<A>
    : Array<A>

  /**
   * Flattens a nested array type.
   *
   * @example
   * ```ts
   * import type { Array } from "effect"
   *
   * type Nested = ReadonlyArray<ReadonlyArray<number>>
   * type Flattened = Array.ReadonlyArray.Flatten<Nested>
   * // Flattened is Array<number>
   * ```
   *
   * @category types
   * @since 2.0.0
   */
  export type Flatten<T extends ReadonlyArray<ReadonlyArray<any>>> = T extends
    NonEmptyReadonlyArray<NonEmptyReadonlyArray<any>> ? NonEmptyArray<T[number][number]>
    : Array<T[number][number]>
}

/**
 * Maps over an array with a function, creating a new array.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.map([1, 2, 3], (x) => x * 2)
 * console.log(result) // [2, 4, 6]
 * ```
 *
 * @category mapping
 * @since 2.0.0
 */
export const map: {
  <S extends ReadonlyArray<any>, B>(
    f: (a: ReadonlyArray.Infer<S>, i: number) => B
  ): (self: S) => ReadonlyArray.With<S, B>
  <S extends ReadonlyArray<any>, B>(self: S, f: (a: ReadonlyArray.Infer<S>, i: number) => B): ReadonlyArray.With<S, B>
} = dual(2, <A, B>(self: ReadonlyArray<A>, f: (a: A, i: number) => B): Array<B> => self.map(f))

/**
 * Applies a function to each element in an array and returns a new array containing the concatenated mapped elements.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.flatMap([1, 2, 3], (x) => [x, x * 2])
 * console.log(result) // [1, 2, 2, 4, 3, 6]
 * ```
 *
 * @category sequencing
 * @since 2.0.0
 */
export const flatMap: {
  <S extends ReadonlyArray<any>, T extends ReadonlyArray<any>>(
    f: (a: ReadonlyArray.Infer<S>, i: number) => T
  ): (self: S) => ReadonlyArray.AndNonEmpty<S, T, ReadonlyArray.Infer<T>>
  <A, B>(self: NonEmptyReadonlyArray<A>, f: (a: A, i: number) => NonEmptyReadonlyArray<B>): NonEmptyArray<B>
  <A, B>(self: ReadonlyArray<A>, f: (a: A, i: number) => ReadonlyArray<B>): Array<B>
} = dual(
  2,
  <A, B>(self: ReadonlyArray<A>, f: (a: A, i: number) => ReadonlyArray<B>): Array<B> => {
    if (isReadonlyArrayEmpty(self)) {
      return []
    }
    const out: Array<B> = []
    for (let i = 0; i < self.length; i++) {
      const inner = f(self[i], i)
      for (let j = 0; j < inner.length; j++) {
        out.push(inner[j])
      }
    }
    return out
  }
)

/**
 * Combines multiple arrays into a single array by concatenating all elements
 * from each nested array. This function ensures that the structure of nested
 * arrays is collapsed into a single, flat array.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.flatten([[1, 2], [], [3, 4], [], [5, 6]])
 * console.log(result) // [1, 2, 3, 4, 5, 6]
 * ```
 *
 * @category sequencing
 * @since 2.0.0
 */
export const flatten: <const S extends ReadonlyArray<ReadonlyArray<any>>>(self: S) => ReadonlyArray.Flatten<S> =
  flatMap(identity) as any

/**
 * Applies a function to each element of the `Iterable` and filters based on the result, keeping the transformed values where the function returns `Some`.
 * This method combines filtering and mapping functionalities, allowing transformations and filtering of elements based on a single function pass.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 * import * as Option from "effect/Option"
 *
 * const evenSquares = (x: number) =>
 *   x % 2 === 0 ? Option.some(x * x) : Option.none()
 *
 * const result = Array.filterMap([1, 2, 3, 4, 5], evenSquares)
 * console.log(result) // [4, 16]
 * ```
 *
 * @category filtering
 * @since 2.0.0
 */
export const filterMap: {
  <A, B>(f: (a: A, i: number) => Option.Option<B>): (self: Iterable<A>) => Array<B>
  <A, B>(self: Iterable<A>, f: (a: A, i: number) => Option.Option<B>): Array<B>
} = dual(
  2,
  <A, B>(self: Iterable<A>, f: (a: A, i: number) => Option.Option<B>): Array<B> => {
    const as = fromIterable(self)
    const out: Array<B> = []
    for (let i = 0; i < as.length; i++) {
      const o = f(as[i], i)
      if (Option.isSome(o)) {
        out.push(o.value)
      }
    }
    return out
  }
)

/**
 * Applies a function to each element of the array and filters based on the result, stopping when a condition is not met.
 * This method combines filtering and mapping in a single pass, and short-circuits, i.e., stops processing, as soon as the function returns `None`.
 * This is useful when you need to transform an array but only up to the point where a certain condition holds true.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 * import * as Option from "effect/Option"
 *
 * const toSquareTillOdd = (x: number) =>
 *   x % 2 === 0 ? Option.some(x * x) : Option.none()
 *
 * const result = Array.filterMapWhile([2, 4, 5], toSquareTillOdd)
 * console.log(result) // [4, 16]
 * ```
 *
 * @category filtering
 * @since 2.0.0
 */
export const filterMapWhile: {
  <A, B>(f: (a: A, i: number) => Option.Option<B>): (self: Iterable<A>) => Array<B>
  <A, B>(self: Iterable<A>, f: (a: A, i: number) => Option.Option<B>): Array<B>
} = dual(2, <A, B>(self: Iterable<A>, f: (a: A, i: number) => Option.Option<B>) => {
  let i = 0
  const out: Array<B> = []
  for (const a of self) {
    const b = f(a, i)
    if (Option.isSome(b)) {
      out.push(b.value)
    } else {
      break
    }
    i++
  }
  return out
})

/**
 * Applies a function to each element of the `Iterable`, categorizing the results into two separate arrays.
 * This function is particularly useful for operations where each element can result in two possible types,
 * and you want to separate these types into different collections. For instance, separating validation results
 * into successes and failures.
 *
 * @example
 *
 * ```ts
 * import { Array, Result } from "effect"
 *
 * const isEven = (x: number) => x % 2 === 0
 *
 * const result = Array.partitionMap(
 *   [1, 2, 3, 4, 5],
 *   (x) => isEven(x) ? Result.succeed(x) : Result.fail(x)
 * )
 * console.log(result)
 * // [
 * //   [1, 3, 5],
 * //   [2, 4]
 * // ]
 * ```
 *
 * @category filtering
 * @since 2.0.0
 */
export const partitionMap: {
  <A, B, C>(f: (a: A, i: number) => Result.Result<C, B>): (self: Iterable<A>) => [left: Array<B>, right: Array<C>]
  <A, B, C>(self: Iterable<A>, f: (a: A, i: number) => Result.Result<C, B>): [left: Array<B>, right: Array<C>]
} = dual(
  2,
  <A, B, C>(self: Iterable<A>, f: (a: A, i: number) => Result.Result<C, B>): [left: Array<B>, right: Array<C>] => {
    const left: Array<B> = []
    const right: Array<C> = []
    const as = fromIterable(self)
    for (let i = 0; i < as.length; i++) {
      const e = f(as[i], i)
      if (Result.isFailure(e)) {
        left.push(e.failure)
      } else {
        right.push(e.success)
      }
    }
    return [left, right]
  }
)
/**
 * @category filtering
 * @since 4.0.0
 */
export const partitionFilter: {
  <A, Pass, Fail>(f: Filter.Filter<A, Pass, Fail>): (self: Iterable<A>) => [passes: Array<Pass>, fails: Array<Fail>]
  <A, Pass, Fail>(self: Iterable<A>, f: Filter.Filter<A, Pass, Fail>): [passes: Array<Pass>, fails: Array<Fail>]
} = dual(
  2,
  <A, Pass, Fail>(self: Iterable<A>, f: Filter.Filter<A, Pass, Fail>): [passes: Array<Pass>, fails: Array<Fail>] => {
    const passes: Array<Pass> = []
    const fails: Array<Fail> = []
    for (const a of self) {
      const e = f(a)
      if (Filter.isFail(e)) {
        fails.push(e.fail)
      } else {
        passes.push(e)
      }
    }
    return [passes, fails]
  }
)

/**
 * Retrieves the `Some` values from an `Iterable` of `Option`s, collecting them into an array.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 * import * as Option from "effect/Option"
 *
 * const result = Array.getSomes([Option.some(1), Option.none(), Option.some(2)])
 * console.log(result) // [1, 2]
 * ```
 *
 * @category filtering
 * @since 2.0.0
 */

export const getSomes: <T extends Iterable<Option.Option<X>>, X = any>(
  self: T
) => Array<Option.Option.Value<ReadonlyArray.Infer<T>>> = filterMap(identity as any)

/**
 * Retrieves the `Err` values from an `Iterable` of `Result`s, collecting them into an array.
 *
 * @example
 *
 * ```ts
 * import { Array, Result } from "effect"
 *
 * const result = Array.getFailures([
 *   Result.succeed(1),
 *   Result.fail("err"),
 *   Result.succeed(2)
 * ])
 * console.log(result) // ["err"]
 * ```
 *
 * @category filtering
 * @since 2.0.0
 */
export const getFailures = <T extends Iterable<Result.Result<any, any>>>(
  self: T
): Array<Result.Result.Failure<ReadonlyArray.Infer<T>>> => {
  const out: Array<any> = []
  for (const a of self) {
    if (Result.isFailure(a)) {
      out.push(a.failure)
    }
  }

  return out
}

/**
 * Retrieves the `Ok` values from an `Iterable` of `Result`s, collecting them into an array.
 *
 * @example
 *
 * ```ts
 * import { Array, Result } from "effect"
 *
 * const result = Array.getSuccesses([
 *   Result.succeed(1),
 *   Result.fail("err"),
 *   Result.succeed(2)
 * ])
 * console.log(result) // [1, 2]
 * ```
 *
 * @category filtering
 * @since 2.0.0
 */
export const getSuccesses = <T extends Iterable<Result.Result<any, any>>>(
  self: T
): Array<Result.Result.Success<ReadonlyArray.Infer<T>>> => {
  const out: Array<any> = []
  for (const a of self) {
    if (Result.isSuccess(a)) {
      out.push(a.success)
    }
  }

  return out
}

/**
 * Filters array elements based on a predicate, creating a new array.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.filter([1, 2, 3, 4], (x) => x % 2 === 0)
 * console.log(result) // [2, 4]
 * ```
 *
 * @category filtering
 * @since 2.0.0
 */
export const filter: {
  <A, B extends A>(refinement: (a: NoInfer<A>, i: number) => a is B): (self: Iterable<A>) => Array<B>
  <A>(predicate: (a: NoInfer<A>, i: number) => boolean): (self: Iterable<A>) => Array<A>
  <A, B extends A>(self: Iterable<A>, refinement: (a: A, i: number) => a is B): Array<B>
  <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): Array<A>
} = dual(
  2,
  <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): Array<A> => {
    const as = fromIterable(self)
    const out: Array<A> = []
    for (let i = 0; i < as.length; i++) {
      if (predicate(as[i], i)) {
        out.push(as[i])
      }
    }
    return out
  }
)

/**
 * Separate elements based on a predicate that also exposes the index of the element.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.partition([1, 2, 3, 4], (n) => n % 2 === 0)
 * console.log(result) // [[1, 3], [2, 4]]
 * ```
 *
 * @category filtering
 * @since 2.0.0
 */
export const partition: {
  <A, B extends A>(refinement: (a: NoInfer<A>, i: number) => a is B): (
    self: Iterable<A>
  ) => [excluded: Array<Exclude<A, B>>, satisfying: Array<B>]
  <A>(
    predicate: (a: NoInfer<A>, i: number) => boolean
  ): (self: Iterable<A>) => [excluded: Array<A>, satisfying: Array<A>]
  <A, B extends A>(
    self: Iterable<A>,
    refinement: (a: A, i: number) => a is B
  ): [excluded: Array<Exclude<A, B>>, satisfying: Array<B>]
  <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): [excluded: Array<A>, satisfying: Array<A>]
} = dual(
  2,
  <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): [excluded: Array<A>, satisfying: Array<A>] => {
    const left: Array<A> = []
    const right: Array<A> = []
    const as = fromIterable(self)
    for (let i = 0; i < as.length; i++) {
      if (predicate(as[i], i)) {
        right.push(as[i])
      } else {
        left.push(as[i])
      }
    }
    return [left, right]
  }
)

/**
 * Separates an `Iterable` into two arrays based on a predicate.
 *
 * @example
 * ```ts
 * import { Array, Result } from "effect"
 *
 * const results = [Result.succeed(1), Result.fail("error"), Result.succeed(2)]
 * const [failures, successes] = Array.separate(results)
 * console.log(failures) // ["error"]
 * console.log(successes) // [1, 2]
 * ```
 *
 * @category filtering
 * @since 2.0.0
 */
export const separate: <T extends Iterable<Result.Result<any, any>>>(
  self: T
) => [Array<Result.Result.Failure<ReadonlyArray.Infer<T>>>, Array<Result.Result.Success<ReadonlyArray.Infer<T>>>] =
  partitionMap(
    identity
  )

/**
 * Reduces an array from the left.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.reduce([1, 2, 3], 0, (acc, n) => acc + n)
 * console.log(result) // 6
 * ```
 *
 * @category folding
 * @since 2.0.0
 */
export const reduce: {
  <B, A>(b: B, f: (b: B, a: A, i: number) => B): (self: Iterable<A>) => B
  <A, B>(self: Iterable<A>, b: B, f: (b: B, a: A, i: number) => B): B
} = dual(
  3,
  <B, A>(self: Iterable<A>, b: B, f: (b: B, a: A, i: number) => B): B =>
    fromIterable(self).reduce((b, a, i) => f(b, a, i), b)
)

/**
 * Reduces an array from the right.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.reduceRight([1, 2, 3], 0, (acc, n) => acc + n)
 * console.log(result) // 6
 * ```
 *
 * @category folding
 * @since 2.0.0
 */
export const reduceRight: {
  <B, A>(b: B, f: (b: B, a: A, i: number) => B): (self: Iterable<A>) => B
  <A, B>(self: Iterable<A>, b: B, f: (b: B, a: A, i: number) => B): B
} = dual(
  3,
  <A, B>(self: Iterable<A>, b: B, f: (b: B, a: A, i: number) => B): B =>
    fromIterable(self).reduceRight((b, a, i) => f(b, a, i), b)
)

/**
 * Lifts a predicate into an array.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const isEven = (n: number) => n % 2 === 0
 * const to = Array.liftPredicate(isEven)
 * console.log(to(1)) // []
 * console.log(to(2)) // [2]
 * ```
 *
 * @category lifting
 * @since 2.0.0
 */
export const liftPredicate: { // Note: I intentionally avoid using the NoInfer pattern here.
  <A, B extends A>(refinement: Predicate.Refinement<A, B>): (a: A) => Array<B>
  <A>(predicate: Predicate.Predicate<A>): <B extends A>(b: B) => Array<B>
} = <A>(predicate: Predicate.Predicate<A>) => <B extends A>(b: B): Array<B> => predicate(b) ? [b] : []

/**
 * Lifts a function that returns an Option into the Array context.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 * import * as Option from "effect/Option"
 *
 * const parseNumber = Array.liftOption((s: string) => {
 *   const n = Number(s)
 *   return isNaN(n) ? Option.none() : Option.some(n)
 * })
 *
 * console.log(parseNumber("123")) // [123]
 * console.log(parseNumber("abc")) // []
 * ```
 *
 * @category lifting
 * @since 2.0.0
 */
export const liftOption = <A extends Array<unknown>, B>(
  f: (...a: A) => Option.Option<B>
) =>
(...a: A): Array<B> => fromOption(f(...a))

/**
 * Converts a nullable value to an array. If the value is null or undefined, returns an empty array.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * console.log(Array.fromNullishOr(1)) // [1]
 * console.log(Array.fromNullishOr(null)) // []
 * console.log(Array.fromNullishOr(undefined)) // []
 * ```
 *
 * @category conversions
 * @since 2.0.0
 */
export const fromNullishOr = <A>(a: A): Array<NonNullable<A>> => a == null ? empty() : [a as NonNullable<A>]

/**
 * Lifts a function that returns a nullable value into the Array context.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const parseNumber = Array.liftNullishOr((s: string) => {
 *   const n = Number(s)
 *   return isNaN(n) ? null : n
 * })
 *
 * console.log(parseNumber("123")) // [123]
 * console.log(parseNumber("abc")) // []
 * ```
 *
 * @category lifting
 * @since 2.0.0
 */
export const liftNullishOr = <A extends Array<unknown>, B>(
  f: (...a: A) => B
): (...a: A) => Array<NonNullable<B>> =>
(...a) => fromNullishOr(f(...a))

/**
 * Maps over an array and flattens the result, removing null and undefined values.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.flatMapNullishOr(
 *   [1, 2, 3],
 *   (n) => (n % 2 === 0 ? null : n)
 * )
 * console.log(result) // [1, 3]
 *
 * // Explanation:
 * // The array of numbers [1, 2, 3] is mapped with a function that returns null for even numbers
 * // and the number itself for odd numbers. The resulting array [1, null, 3] is then flattened
 * // to remove null values, resulting in [1, 3].
 * ```
 *
 * @category sequencing
 * @since 2.0.0
 */
export const flatMapNullishOr: {
  <A, B>(f: (a: A) => B): (self: ReadonlyArray<A>) => Array<NonNullable<B>>
  <A, B>(self: ReadonlyArray<A>, f: (a: A) => B): Array<NonNullable<B>>
} = dual(
  2,
  <A, B>(self: ReadonlyArray<A>, f: (a: A) => B): Array<NonNullable<B>> => flatMap(self, (a) => fromNullishOr(f(a)))
)

/**
 * Lifts a function that returns an `Result` into a function that returns an array.
 * If the `Result` is an `Err`, it returns an empty array.
 * If the `Result` is an `Ok`, it returns an array with the Ok value.
 *
 * @example
 *
 * ```ts
 * import { Array, Result } from "effect"
 *
 * const parseNumber = (s: string): Result.Result<number, Error> =>
 *   isNaN(Number(s))
 *     ? Result.fail(new Error("Not a number"))
 *     : Result.succeed(Number(s))
 *
 * const liftedParseNumber = Array.liftResult(parseNumber)
 *
 * const result1 = liftedParseNumber("42")
 * console.log(result1) // [42]
 *
 * const result2 = liftedParseNumber("not a number")
 * console.log(result2) // []
 *
 * // Explanation:
 * // The function parseNumber is lifted to return an array.
 * // When parsing "42", it returns an Result.fail with the number 42, resulting in [42].
 * // When parsing "not a number", it returns an Result.succeed with an error, resulting in an empty array [].
 * ```
 *
 * @category lifting
 * @since 2.0.0
 */
export const liftResult = <A extends Array<unknown>, E, B>(
  f: (...a: A) => Result.Result<B, E>
) =>
(...a: A): Array<B> => {
  const e = f(...a)
  return Result.isFailure(e) ? [] : [e.success]
}

/**
 * Check if a predicate holds true for every `ReadonlyArray` element.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.every([2, 4, 6], (x) => x % 2 === 0)
 * console.log(result) // true
 *
 * const result2 = Array.every([2, 3, 6], (x) => x % 2 === 0)
 * console.log(result2) // false
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const every: {
  <A, B extends A>(
    refinement: (a: NoInfer<A>, i: number) => a is B
  ): (self: ReadonlyArray<A>) => self is ReadonlyArray<B>
  <A>(predicate: (a: NoInfer<A>, i: number) => boolean): (self: ReadonlyArray<A>) => boolean
  <A, B extends A>(self: ReadonlyArray<A>, refinement: (a: A, i: number) => a is B): self is ReadonlyArray<B>
  <A>(self: ReadonlyArray<A>, predicate: (a: A, i: number) => boolean): boolean
} = dual(
  2,
  <A, B extends A>(self: ReadonlyArray<A>, refinement: (a: A, i: number) => a is B): self is ReadonlyArray<B> =>
    self.every(refinement)
)

/**
 * Check if a predicate holds true for some `ReadonlyArray` element.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.some([1, 3, 4], (x) => x % 2 === 0)
 * console.log(result) // true
 *
 * const result2 = Array.some([1, 3, 5], (x) => x % 2 === 0)
 * console.log(result2) // false
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const some: {
  <A>(
    predicate: (a: NoInfer<A>, i: number) => boolean
  ): (self: ReadonlyArray<A>) => self is NonEmptyReadonlyArray<A>
  <A>(self: ReadonlyArray<A>, predicate: (a: A, i: number) => boolean): self is NonEmptyReadonlyArray<A>
} = dual(
  2,
  <A>(self: ReadonlyArray<A>, predicate: (a: A, i: number) => boolean): self is NonEmptyReadonlyArray<A> =>
    self.some(predicate)
)

/**
 * Extends an array with a function that maps each subarray to a value.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.extend([1, 2, 3], (as) => as.length)
 * console.log(result) // [3, 2, 1]
 *
 * // Explanation:
 * // The function maps each subarray starting from each element to its length.
 * // The subarrays are: [1, 2, 3], [2, 3], [3].
 * // The lengths are: 3, 2, 1.
 * // Therefore, the result is [3, 2, 1].
 * ```
 *
 * @category mapping
 * @since 2.0.0
 */
export const extend: {
  <A, B>(f: (as: ReadonlyArray<A>) => B): (self: ReadonlyArray<A>) => Array<B>
  <A, B>(self: ReadonlyArray<A>, f: (as: ReadonlyArray<A>) => B): Array<B>
} = dual(
  2,
  <A, B>(self: ReadonlyArray<A>, f: (as: ReadonlyArray<A>) => B): Array<B> => self.map((_, i, as) => f(as.slice(i)))
)

/**
 * Finds the minimum element in an array based on a comparator.
 *
 * @example
 *
 * ```ts
 * import { Array, Order } from "effect"
 *
 * const result = Array.min([3, 1, 2], Order.Number)
 * console.log(result) // 1
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const min: {
  <A>(O: Order.Order<A>): (self: NonEmptyReadonlyArray<A>) => A
  <A>(self: NonEmptyReadonlyArray<A>, O: Order.Order<A>): A
} = dual(2, <A>(self: NonEmptyReadonlyArray<A>, O: Order.Order<A>): A => self.reduce(Order.min(O)))

/**
 * Finds the maximum element in an array based on a comparator.
 *
 * @example
 *
 * ```ts
 * import { Array, Order } from "effect"
 *
 * const result = Array.max([3, 1, 2], Order.Number)
 * console.log(result) // 3
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const max: {
  <A>(O: Order.Order<A>): (self: NonEmptyReadonlyArray<A>) => A
  <A>(self: NonEmptyReadonlyArray<A>, O: Order.Order<A>): A
} = dual(2, <A>(self: NonEmptyReadonlyArray<A>, O: Order.Order<A>): A => self.reduce(Order.max(O)))

/**
 * Builds an array by repeatedly applying a function to a seed value, stopping when the function returns `None`.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.unfold(1, (n) => n <= 5 ? [n, n + 1] : undefined)
 * console.log(result) // [1, 2, 3, 4, 5]
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const unfold = <B, A>(b: B, f: (b: B) => readonly [A, B] | undefined): Array<A> => {
  const out: Array<A> = []
  let next: B = b
  let o: readonly [A, B] | undefined
  while ((o = f(next))) {
    const [a, b] = o
    out.push(a)
    next = b
  }
  return out
}

/**
 * This function creates and returns a new `Order` for an array of values based on a given `Order` for the elements of the array.
 * The returned `Order` compares two arrays by applying the given `Order` to each element in the arrays.
 * If all elements are equal, the arrays are then compared based on their length.
 * It is useful when you need to compare two arrays of the same type and you have a specific way of comparing each element of the array.
 *
 * @example
 * ```ts
 * import { Array, Order } from "effect"
 *
 * const arrayOrder = Array.makeOrder(Order.Number)
 * console.log(arrayOrder([1, 2], [1, 3])) // -1 (first is less than second)
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const makeOrder: <A>(O: Order.Order<A>) => Order.Order<ReadonlyArray<A>> = Order.Array

/**
 * Creates an equivalence relation for arrays.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const eq = Array.makeEquivalence<number>((a, b) => a === b)
 * console.log(eq([1, 2, 3], [1, 2, 3])) // true
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const makeEquivalence: <A>(
  isEquivalent: Equivalence.Equivalence<A>
) => Equivalence.Equivalence<ReadonlyArray<A>> = Equivalence.Array

/**
 * Performs a side-effect for each element of the `Iterable`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * Array.forEach([1, 2, 3], (n) => console.log(n)) // 1, 2, 3
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const forEach: {
  <A>(f: (a: A, i: number) => void): (self: Iterable<A>) => void
  <A>(self: Iterable<A>, f: (a: A, i: number) => void): void
} = dual(2, <A>(self: Iterable<A>, f: (a: A, i: number) => void): void => fromIterable(self).forEach((a, i) => f(a, i)))

/**
 * Remove duplicates from an `Iterable` using the provided `isEquivalent` function,
 * preserving the order of the first occurrence of each element.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.dedupeWith([1, 2, 2, 3, 3, 3], (a, b) => a === b)
 * console.log(result) // [1, 2, 3]
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const dedupeWith: {
  <S extends Iterable<any>>(
    isEquivalent: (self: ReadonlyArray.Infer<S>, that: ReadonlyArray.Infer<S>) => boolean
  ): (self: S) => ReadonlyArray.With<S, ReadonlyArray.Infer<S>>
  <A>(self: NonEmptyReadonlyArray<A>, isEquivalent: (self: A, that: A) => boolean): NonEmptyArray<A>
  <A>(self: Iterable<A>, isEquivalent: (self: A, that: A) => boolean): Array<A>
} = dual(
  2,
  <A>(self: Iterable<A>, isEquivalent: (self: A, that: A) => boolean): Array<A> => {
    const input = fromIterable(self)
    if (isReadonlyArrayNonEmpty(input)) {
      const out: NonEmptyArray<A> = [headNonEmpty(input)]
      const rest = tailNonEmpty(input)
      for (const r of rest) {
        if (out.every((a) => !isEquivalent(r, a))) {
          out.push(r)
        }
      }
      return out
    }
    return []
  }
)

/**
 * Remove duplicates from an `Iterable`, preserving the order of the first occurrence of each element.
 * The equivalence used to compare elements is provided by `Equal.equivalence()` from the `Equal` module.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.dedupe([1, 2, 1, 3, 2, 4])
 * console.log(result) // [1, 2, 3, 4]
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const dedupe = <S extends Iterable<any>>(
  self: S
): S extends NonEmptyReadonlyArray<infer A> ? NonEmptyArray<A> : S extends Iterable<infer A> ? Array<A> : never =>
  dedupeWith(self, Equal.asEquivalence()) as any

/**
 * Deduplicates adjacent elements that are identical using the provided `isEquivalent` function.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.dedupeAdjacentWith([1, 1, 2, 2, 3, 3], (a, b) => a === b)
 * console.log(result) // [1, 2, 3]
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const dedupeAdjacentWith: {
  <A>(isEquivalent: (self: A, that: A) => boolean): (self: Iterable<A>) => Array<A>
  <A>(self: Iterable<A>, isEquivalent: (self: A, that: A) => boolean): Array<A>
} = dual(2, <A>(self: Iterable<A>, isEquivalent: (self: A, that: A) => boolean): Array<A> => {
  const out: Array<A> = []
  let lastA: Option.Option<A> = Option.none()
  for (const a of self) {
    if (Option.isNone(lastA) || !isEquivalent(a, lastA.value)) {
      out.push(a)
      lastA = Option.some(a)
    }
  }
  return out
})

/**
 * Deduplicates adjacent elements that are identical.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.dedupeAdjacent([1, 1, 2, 2, 3, 3])
 * console.log(result) // [1, 2, 3]
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const dedupeAdjacent: <A>(self: Iterable<A>) => Array<A> = dedupeAdjacentWith(Equal.asEquivalence())

/**
 * Joins the elements together with "sep" in the middle.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const strings = ["a", "b", "c"]
 * const joined = Array.join(strings, "-")
 * console.log(joined) // "a-b-c"
 * ```
 *
 * @since 2.0.0
 * @category folding
 */
export const join: {
  (sep: string): (self: Iterable<string>) => string
  (self: Iterable<string>, sep: string): string
} = dual(2, (self: Iterable<string>, sep: string): string => fromIterable(self).join(sep))

/**
 * Statefully maps over the chunk, producing new elements of type `B`.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.mapAccum([1, 2, 3], 0, (acc, n) => [acc + n, acc + n])
 * console.log(result) // [6, [1, 3, 6]]
 * ```
 *
 * @since 2.0.0
 * @category folding
 */
export const mapAccum: {
  <S, A, B, I extends Iterable<A> = Iterable<A>>(
    s: S,
    f: (s: S, a: ReadonlyArray.Infer<I>, i: number) => readonly [S, B]
  ): (self: I) => [state: S, mappedArray: ReadonlyArray.With<I, B>]
  <S, A, B, I extends Iterable<A> = Iterable<A>>(
    self: I,
    s: S,
    f: (s: S, a: ReadonlyArray.Infer<I>, i: number) => readonly [S, B]
  ): [state: S, mappedArray: ReadonlyArray.With<I, B>]
} = dual(
  3,
  <S, A, B>(self: Iterable<A>, s: S, f: (s: S, a: A, i: number) => [S, B]): [state: S, mappedArray: Array<B>] => {
    let i = 0
    let s1 = s
    const out: Array<B> = []
    for (const a of self) {
      const r = f(s1, a, i)
      s1 = r[0]
      out.push(r[1])
      i++
    }
    return [s1, out]
  }
)

/**
 * Zips this chunk crosswise with the specified chunk using the specified combiner.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.cartesianWith([1, 2], ["a", "b"], (a, b) => `${a}-${b}`)
 * console.log(result) // ["1-a", "1-b", "2-a", "2-b"]
 * ```
 *
 * @since 2.0.0
 * @category elements
 */
export const cartesianWith: {
  <A, B, C>(that: ReadonlyArray<B>, f: (a: A, b: B) => C): (self: ReadonlyArray<A>) => Array<C>
  <A, B, C>(self: ReadonlyArray<A>, that: ReadonlyArray<B>, f: (a: A, b: B) => C): Array<C>
} = dual(
  3,
  <A, B, C>(self: ReadonlyArray<A>, that: ReadonlyArray<B>, f: (a: A, b: B) => C): Array<C> =>
    flatMap(self, (a) => map(that, (b) => f(a, b)))
)

/**
 * Zips this chunk crosswise with the specified chunk.
 *
 * @example
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.cartesian([1, 2], ["a", "b"])
 * console.log(result) // [[1, "a"], [1, "b"], [2, "a"], [2, "b"]]
 * ```
 *
 * @since 2.0.0
 * @category elements
 */
export const cartesian: {
  <B>(that: ReadonlyArray<B>): <A>(self: ReadonlyArray<A>) => Array<[A, B]>
  <A, B>(self: ReadonlyArray<A>, that: ReadonlyArray<B>): Array<[A, B]>
} = dual(
  2,
  <A, B>(self: ReadonlyArray<A>, that: ReadonlyArray<B>): Array<[A, B]> => cartesianWith(self, that, (a, b) => [a, b])
)

// -------------------------------------------------------------------------------------
// do notation
// -------------------------------------------------------------------------------------

/**
 * The "do simulation" for array allows you to sequentially apply operations to the elements of arrays, just as nested loops allow you to go through all combinations of elements in an arrays.
 *
 * It can be used to simulate "array comprehension".
 * It's a technique that allows you to create new arrays by iterating over existing ones and applying specific **conditions** or **transformations** to the elements. It's like assembling a new collection from pieces of other collections based on certain rules.
 *
 * Here's how the do simulation works:
 *
 * 1. Start the do simulation using the `Do` value
 * 2. Within the do simulation scope, you can use the `bind` function to define variables and bind them to `Array` values
 * 3. You can accumulate multiple `bind` statements to define multiple variables within the scope
 * 4. Inside the do simulation scope, you can also use the `let` function to define variables and bind them to simple values
 * 5. Regular `Option` functions like `map` and `filter` can still be used within the do simulation. These functions will receive the accumulated variables as arguments within the scope
 *
 * @example
 *
 * ```ts
 * import { Array, pipe } from "effect"
 *
 * const doResult = pipe(
 *   Array.Do,
 *   Array.bind("x", () => [1, 3, 5]),
 *   Array.bind("y", () => [2, 4, 6]),
 *   Array.filter(({ x, y }) => x < y), // condition
 *   Array.map(({ x, y }) => [x, y] as const) // transformation
 * )
 * console.log(doResult) // [[1, 2], [1, 4], [1, 6], [3, 4], [3, 6], [5, 6]]
 *
 * // equivalent
 * const x = [1, 3, 5],
 *   y = [2, 4, 6],
 *   result = []
 * for (let i = 0; i < x.length; i++) {
 *   for (let j = 0; j < y.length; j++) {
 *     const _x = x[i], _y = y[j]
 *     if (_x < _y) result.push([_x, _y] as const)
 *   }
 * }
 * ```
 *
 * @see {@link bindTo}
 * @see {@link bind}
 * @see {@link let_ let}
 *
 * @category do notation
 * @since 3.2.0
 */
export const Do: ReadonlyArray<{}> = of({})

/**
 * The "do simulation" for array allows you to sequentially apply operations to the elements of arrays, just as nested loops allow you to go through all combinations of elements in an arrays.
 *
 * It can be used to simulate "array comprehension".
 * It's a technique that allows you to create new arrays by iterating over existing ones and applying specific **conditions** or **transformations** to the elements. It's like assembling a new collection from pieces of other collections based on certain rules.
 *
 * Here's how the do simulation works:
 *
 * 1. Start the do simulation using the `Do` value
 * 2. Within the do simulation scope, you can use the `bind` function to define variables and bind them to `Array` values
 * 3. You can accumulate multiple `bind` statements to define multiple variables within the scope
 * 4. Inside the do simulation scope, you can also use the `let` function to define variables and bind them to simple values
 * 5. Regular `Option` functions like `map` and `filter` can still be used within the do simulation. These functions will receive the accumulated variables as arguments within the scope
 *
 * @example
 *
 * ```ts
 * import { Array, pipe } from "effect"
 *
 * const doResult = pipe(
 *   Array.Do,
 *   Array.bind("x", () => [1, 3, 5]),
 *   Array.bind("y", () => [2, 4, 6]),
 *   Array.filter(({ x, y }) => x < y), // condition
 *   Array.map(({ x, y }) => [x, y] as const) // transformation
 * )
 * console.log(doResult) // [[1, 2], [1, 4], [1, 6], [3, 4], [3, 6], [5, 6]]
 *
 * // equivalent
 * const x = [1, 3, 5],
 *   y = [2, 4, 6],
 *   result = []
 * for (let i = 0; i < x.length; i++) {
 *   for (let j = 0; j < y.length; j++) {
 *     const _x = x[i], _y = y[j]
 *     if (_x < _y) result.push([_x, _y] as const)
 *   }
 * }
 * ```
 *
 * @see {@link bindTo}
 * @see {@link Do}
 * @see {@link let_ let}
 *
 * @category do notation
 * @since 3.2.0
 */
export const bind: {
  <A extends object, N extends string, B>(
    tag: Exclude<N, keyof A>,
    f: (a: NoInfer<A>) => ReadonlyArray<B>
  ): (
    self: ReadonlyArray<A>
  ) => Array<{ [K in N | keyof A]: K extends keyof A ? A[K] : B }>
  <A extends object, N extends string, B>(
    self: ReadonlyArray<A>,
    tag: Exclude<N, keyof A>,
    f: (a: NoInfer<A>) => ReadonlyArray<B>
  ): Array<{ [K in N | keyof A]: K extends keyof A ? A[K] : B }>
} = internalDoNotation.bind<ReadonlyArrayTypeLambda>(map, flatMap) as any

/**
 * The "do simulation" for array allows you to sequentially apply operations to the elements of arrays, just as nested loops allow you to go through all combinations of elements in an arrays.
 *
 * It can be used to simulate "array comprehension".
 * It's a technique that allows you to create new arrays by iterating over existing ones and applying specific **conditions** or **transformations** to the elements. It's like assembling a new collection from pieces of other collections based on certain rules.
 *
 * Here's how the do simulation works:
 *
 * 1. Start the do simulation using the `Do` value
 * 2. Within the do simulation scope, you can use the `bind` function to define variables and bind them to `Array` values
 * 3. You can accumulate multiple `bind` statements to define multiple variables within the scope
 * 4. Inside the do simulation scope, you can also use the `let` function to define variables and bind them to simple values
 * 5. Regular `Option` functions like `map` and `filter` can still be used within the do simulation. These functions will receive the accumulated variables as arguments within the scope
 *
 * @example
 *
 * ```ts
 * import { Array, pipe } from "effect"
 *
 * const doResult = pipe(
 *   Array.Do,
 *   Array.bind("x", () => [1, 3, 5]),
 *   Array.bind("y", () => [2, 4, 6]),
 *   Array.filter(({ x, y }) => x < y), // condition
 *   Array.map(({ x, y }) => [x, y] as const) // transformation
 * )
 * console.log(doResult) // [[1, 2], [1, 4], [1, 6], [3, 4], [3, 6], [5, 6]]
 *
 * // equivalent
 * const x = [1, 3, 5],
 *   y = [2, 4, 6],
 *   result = []
 * for (let i = 0; i < x.length; i++) {
 *   for (let j = 0; j < y.length; j++) {
 *     const _x = x[i], _y = y[j]
 *     if (_x < _y) result.push([_x, _y] as const)
 *   }
 * }
 * ```
 *
 * @see {@link bindTo}
 * @see {@link Do}
 * @see {@link let_ let}
 *
 * @category do notation
 * @since 3.2.0
 */
export const bindTo: {
  <N extends string>(tag: N): <A>(self: ReadonlyArray<A>) => Array<{ [K in N]: A }>
  <A, N extends string>(self: ReadonlyArray<A>, tag: N): Array<{ [K in N]: A }>
} = internalDoNotation.bindTo<ReadonlyArrayTypeLambda>(map) as any

const let_: {
  <N extends string, B, A extends object>(
    tag: Exclude<N, keyof A>,
    f: (a: NoInfer<A>) => B
  ): (self: ReadonlyArray<A>) => Array<{ [K in N | keyof A]: K extends keyof A ? A[K] : B }>
  <N extends string, A extends object, B>(
    self: ReadonlyArray<A>,
    tag: Exclude<N, keyof A>,
    f: (a: NoInfer<A>) => B
  ): Array<{ [K in N | keyof A]: K extends keyof A ? A[K] : B }>
} = internalDoNotation.let_<ReadonlyArrayTypeLambda>(map) as any

export {
  /**
   * The "do simulation" for array allows you to sequentially apply operations to the elements of arrays, just as nested loops allow you to go through all combinations of elements in an arrays.
   *
   * It can be used to simulate "array comprehension".
   * It's a technique that allows you to create new arrays by iterating over existing ones and applying specific **conditions** or **transformations** to the elements. It's like assembling a new collection from pieces of other collections based on certain rules.
   *
   * Here's how the do simulation works:
   *
   * 1. Start the do simulation using the `Do` value
   * 2. Within the do simulation scope, you can use the `bind` function to define variables and bind them to `Array` values
   * 3. You can accumulate multiple `bind` statements to define multiple variables within the scope
   * 4. Inside the do simulation scope, you can also use the `let` function to define variables and bind them to simple values
   * 5. Regular `Option` functions like `map` and `filter` can still be used within the do simulation. These functions will receive the accumulated variables as arguments within the scope
   *
   * @example
   *
   * ```ts
   * import { Array, pipe } from "effect"
   *
   * const doResult = pipe(
   *   Array.Do,
   *   Array.bind("x", () => [1, 3, 5]),
   *   Array.bind("y", () => [2, 4, 6]),
   *   Array.filter(({ x, y }) => x < y), // condition
   *   Array.map(({ x, y }) => [x, y] as const) // transformation
   * )
   * console.log(doResult) // [[1, 2], [1, 4], [1, 6], [3, 4], [3, 6], [5, 6]]
   *
   * // equivalent
   * const x = [1, 3, 5],
   *   y = [2, 4, 6],
   *   result = []
   * for (let i = 0; i < x.length; i++) {
   *   for (let j = 0; j < y.length; j++) {
   *     const _x = x[i], _y = y[j]
   *     if (_x < _y) result.push([_x, _y] as const)
   *   }
   * }
   * ```
   *
   * @see {@link bindTo}
   * @see {@link bind}
   * @see {@link Do}
   *
   * @category do notation
   * @since 3.2.0
   */
  let_ as let
}

const reducer = Reducer.make((a, b) => a.concat(b), [] as any)

/**
 * A `Reducer` for combining `ReadonlyArray`s using concatenation.
 *
 * @since 4.0.0
 */
export function getReadonlyReducerConcat<A>(): Reducer.Reducer<ReadonlyArray<A>> {
  return reducer
}

/**
 * A `Reducer` for combining `Array`s using concatenation.
 *
 * @since 4.0.0
 */
export function makeReducerConcat<A>(): Reducer.Reducer<Array<A>> {
  return reducer
}

/**
 * Counts all the element of the given array that pass the given predicate
 *
 * **Example**
 *
 * ```ts
 * import { Array } from "effect"
 *
 * const result = Array.countBy([1, 2, 3, 4, 5], (n) => n % 2 === 0)
 * console.log(result) // 2
 * ```
 *
 * @category folding
 * @since 3.16.0
 */
export const countBy: {
  <A>(predicate: (a: NoInfer<A>, i: number) => boolean): (self: Iterable<A>) => number
  <A>(self: Iterable<A>, predicate: (a: A, i: number) => boolean): number
} = dual(
  2,
  <A>(
    self: Iterable<A>,
    f: (a: A, i: number) => boolean
  ): number => {
    let count = 0
    const as = fromIterable(self)
    for (let i = 0; i < as.length; i++) {
      const a = as[i]
      if (f(a, i)) {
        count++
      }
    }
    return count
  }
)
