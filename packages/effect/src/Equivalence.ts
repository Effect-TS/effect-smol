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
 * import { Equivalence, Array } from "effect"
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
 * const personEquivalence = Equivalence.struct<Person>({
 *   name: caseInsensitive,
 *   age: Equivalence.number
 * })
 * ```
 *
 * @since 2.0.0
 */
import { dual } from "./Function.js"
import type { TypeLambda } from "./HKT.js"

/**
 * Represents an equivalence relation over type `A`.
 *
 * An `Equivalence<A>` is a function that takes two values of type `A` and returns
 * `true` if they are considered equivalent, `false` otherwise.
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 *
 * // Simple number equivalence
 * const numberEq: Equivalence.Equivalence<number> = (a, b) => a === b
 *
 * console.log(numberEq(1, 1)) // true
 * console.log(numberEq(1, 2)) // false
 *
 * // Custom equivalence for objects
 * interface Point {
 *   x: number
 *   y: number
 * }
 *
 * const pointEq: Equivalence.Equivalence<Point> = (a, b) =>
 *   a.x === b.x && a.y === b.y
 *
 * console.log(pointEq({ x: 1, y: 2 }, { x: 1, y: 2 })) // true
 * ```
 *
 * @category type class
 * @since 2.0.0
 */
export type Equivalence<in A> = (self: A, that: A) => boolean

/**
 * Type lambda for `Equivalence`, used for higher-kinded type operations.
 *
 * This interface enables `Equivalence` to work with generic type constructors
 * and higher-order abstractions in the Effect type system.
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 * import type { Kind } from "effect/HKT"
 *
 * // Used internally for type-level computations
 * type NumberEquivalence = Kind<Equivalence.EquivalenceTypeLambda, number>
 * // Equivalent to: Equivalence.Equivalence<number>
 * ```
 *
 * @category type lambdas
 * @since 2.0.0
 */
export interface EquivalenceTypeLambda extends TypeLambda {
  readonly type: Equivalence<this["Target"]>
}

/**
 * Creates a custom equivalence relation with an optimized reference equality check.
 *
 * The resulting equivalence first performs a reference equality check (`===`) for performance,
 * then falls back to the provided equivalence function if the values are not identical.
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 *
 * // Case-insensitive string equivalence
 * const caseInsensitive = Equivalence.make<string>((a, b) =>
 *   a.toLowerCase() === b.toLowerCase()
 * )
 *
 * console.log(caseInsensitive("Hello", "HELLO")) // true
 * console.log(caseInsensitive("foo", "bar")) // false
 *
 * // Same reference optimization
 * const str = "test"
 * console.log(caseInsensitive(str, str)) // true (fast path)
 *
 * // Numeric tolerance equivalence
 * const tolerance = Equivalence.make<number>((a, b) =>
 *   Math.abs(a - b) < 0.0001
 * )
 *
 * console.log(tolerance(1.0, 1.0001)) // false
 * console.log(tolerance(1.0, 1.00001)) // true
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const make = <A>(isEquivalent: (self: A, that: A) => boolean): Equivalence<A> => (self: A, that: A): boolean =>
  self === that || isEquivalent(self, that)

const isStrictEquivalent = (x: unknown, y: unknown) => x === y

/**
 * Creates an equivalence relation that uses strict equality (`===`) to compare values.
 *
 * This is the most basic and fastest equivalence relation, suitable for primitive types
 * and when you only want to compare by reference equality.
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 *
 * const strictEq = Equivalence.strict<number>()
 *
 * console.log(strictEq(1, 1)) // true
 * console.log(strictEq(1, 2)) // false
 * console.log(strictEq(NaN, NaN)) // false (NaN !== NaN)
 *
 * // Reference equality for objects
 * const obj = { value: 42 }
 * const strictObjEq = Equivalence.strict<typeof obj>()
 *
 * console.log(strictObjEq(obj, obj)) // true
 * console.log(strictObjEq(obj, { value: 42 })) // false (different references)
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const strict: <A>() => Equivalence<A> = () => isStrictEquivalent

/**
 * An equivalence relation for strings using strict equality.
 *
 * Compares strings using the `===` operator, making it case-sensitive
 * and sensitive to all character differences.
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 *
 * console.log(Equivalence.string("hello", "hello")) // true
 * console.log(Equivalence.string("hello", "Hello")) // false
 * console.log(Equivalence.string("hello", "world")) // false
 * 
 * // Use with data structures
 * import { Array } from "effect"
 * const words = ["apple", "banana", "apple", "cherry"]
 * const unique = Array.dedupeWith(words, Equivalence.string)
 * console.log(unique) // ["apple", "banana", "cherry"]
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const string: Equivalence<string> = strict()

/**
 * An equivalence relation for numbers using strict equality.
 *
 * Compares numbers using the `===` operator. Note that `NaN` is not equal to itself
 * according to JavaScript semantics, so `NaN !== NaN` will be `true`.
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 *
 * console.log(Equivalence.number(42, 42)) // true
 * console.log(Equivalence.number(42, 43)) // false
 * console.log(Equivalence.number(0, -0)) // true (0 === -0)
 * console.log(Equivalence.number(NaN, NaN)) // false (NaN !== NaN)
 * 
 * // Use with floating point
 * console.log(Equivalence.number(0.1 + 0.2, 0.3)) // false (floating point precision)
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const number: Equivalence<number> = strict()

/**
 * An equivalence relation for booleans using strict equality.
 *
 * Compares boolean values using the `===` operator.
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 *
 * console.log(Equivalence.boolean(true, true)) // true
 * console.log(Equivalence.boolean(false, false)) // true
 * console.log(Equivalence.boolean(true, false)) // false
 * 
 * // Type safety
 * console.log(Equivalence.boolean(true, 1 as any)) // false
 * console.log(Equivalence.boolean(false, 0 as any)) // false
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const boolean: Equivalence<boolean> = strict()

/**
 * An equivalence relation for bigints using strict equality.
 *
 * Compares bigint values using the `===` operator.
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 *
 * console.log(Equivalence.bigint(123n, 123n)) // true
 * console.log(Equivalence.bigint(123n, 456n)) // false
 * console.log(Equivalence.bigint(0n, -0n)) // true
 * 
 * // BigInt precision is exact
 * const large1 = 9007199254740991n
 * const large2 = 9007199254740991n
 * console.log(Equivalence.bigint(large1, large2)) // true
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const bigint: Equivalence<bigint> = strict()

/**
 * An equivalence relation for symbols using strict equality.
 *
 * Compares symbol values using the `===` operator. Each symbol is unique,
 * except for symbols created with `Symbol.for()` which share the same key.
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 *
 * const sym1 = Symbol("test")
 * const sym2 = Symbol("test")
 * const sym3 = Symbol.for("global")
 * const sym4 = Symbol.for("global")
 *
 * console.log(Equivalence.symbol(sym1, sym1)) // true (same reference)
 * console.log(Equivalence.symbol(sym1, sym2)) // false (different symbols)
 * console.log(Equivalence.symbol(sym3, sym4)) // true (same global symbol)
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const symbol: Equivalence<symbol> = strict()

/**
 * Combines two equivalence relations using logical AND.
 *
 * The resulting equivalence considers two values equivalent only if both
 * input equivalences consider them equivalent.
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 *
 * interface Person {
 *   name: string
 *   age: number
 * }
 *
 * const nameEquivalence = Equivalence.mapInput(
 *   Equivalence.string,
 *   (p: Person) => p.name
 * )
 * 
 * const ageEquivalence = Equivalence.mapInput(
 *   Equivalence.number,
 *   (p: Person) => p.age
 * )
 *
 * const personEquivalence = Equivalence.combine(nameEquivalence, ageEquivalence)
 *
 * const person1 = { name: "Alice", age: 30 }
 * const person2 = { name: "Alice", age: 30 }
 * const person3 = { name: "Alice", age: 31 }
 *
 * console.log(personEquivalence(person1, person2)) // true
 * console.log(personEquivalence(person1, person3)) // false (different age)
 * ```
 *
 * @category combining
 * @since 2.0.0
 */
export const combine: {
  <A>(that: Equivalence<A>): (self: Equivalence<A>) => Equivalence<A>
  <A>(self: Equivalence<A>, that: Equivalence<A>): Equivalence<A>
} = dual(2, <A>(self: Equivalence<A>, that: Equivalence<A>): Equivalence<A> => make((x, y) => self(x, y) && that(x, y)))

/**
 * Combines multiple equivalence relations using logical AND.
 *
 * The resulting equivalence considers two values equivalent only if the initial
 * equivalence and all equivalences in the collection consider them equivalent.
 * Evaluation is short-circuited - stops at the first non-equivalent comparison.
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 *
 * interface Product {
 *   id: string
 *   name: string
 *   price: number
 *   category: string
 * }
 *
 * const idEq = Equivalence.mapInput(Equivalence.string, (p: Product) => p.id)
 * const nameEq = Equivalence.mapInput(Equivalence.string, (p: Product) => p.name)
 * const priceEq = Equivalence.mapInput(Equivalence.number, (p: Product) => p.price)
 * const categoryEq = Equivalence.mapInput(Equivalence.string, (p: Product) => p.category)
 *
 * const productEq = Equivalence.combineMany(idEq, [nameEq, priceEq, categoryEq])
 *
 * const product1 = { id: "1", name: "Widget", price: 9.99, category: "Tools" }
 * const product2 = { id: "1", name: "Widget", price: 9.99, category: "Tools" }
 * const product3 = { id: "1", name: "Widget", price: 10.99, category: "Tools" }
 *
 * console.log(productEq(product1, product2)) // true
 * console.log(productEq(product1, product3)) // false (different price)
 * ```
 *
 * @category combining
 * @since 2.0.0
 */
export const combineMany: {
  <A>(collection: Iterable<Equivalence<A>>): (self: Equivalence<A>) => Equivalence<A>
  <A>(self: Equivalence<A>, collection: Iterable<Equivalence<A>>): Equivalence<A>
} = dual(2, <A>(self: Equivalence<A>, collection: Iterable<Equivalence<A>>): Equivalence<A> =>
  make((x, y) => {
    if (!self(x, y)) {
      return false
    }
    for (const equivalence of collection) {
      if (!equivalence(x, y)) {
        return false
      }
    }
    return true
  }))

const isAlwaysEquivalent: Equivalence<unknown> = (_x, _y) => true

/**
 * Combines multiple equivalence relations into a single equivalence using logical AND.
 *
 * All equivalences in the collection must consider the values equivalent for the
 * result to be `true`. If the collection is empty, returns an equivalence that
 * always returns `true`.
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 *
 * interface Point3D {
 *   x: number
 *   y: number
 *   z: number
 * }
 *
 * const xEq = Equivalence.mapInput(Equivalence.number, (p: Point3D) => p.x)
 * const yEq = Equivalence.mapInput(Equivalence.number, (p: Point3D) => p.y)
 * const zEq = Equivalence.mapInput(Equivalence.number, (p: Point3D) => p.z)
 *
 * const point3DEq = Equivalence.combineAll([xEq, yEq, zEq])
 *
 * const point1 = { x: 1, y: 2, z: 3 }
 * const point2 = { x: 1, y: 2, z: 3 }
 * const point3 = { x: 1, y: 2, z: 4 }
 *
 * console.log(point3DEq(point1, point2)) // true
 * console.log(point3DEq(point1, point3)) // false (different z)
 *
 * // Empty collection always returns true
 * const alwaysEq = Equivalence.combineAll([])
 * console.log(alwaysEq("anything", "else")) // true
 * ```
 *
 * @category combining
 * @since 2.0.0
 */
export const combineAll = <A>(collection: Iterable<Equivalence<A>>): Equivalence<A> =>
  combineMany(isAlwaysEquivalent, collection)

/**
 * Transforms an equivalence relation by mapping the input values.
 *
 * This creates a new equivalence relation for type `B` by first applying a transformation
 * function to convert `B` values to `A` values, then using the original equivalence on
 * the transformed values. This is useful for creating equivalences on complex types by
 * focusing on specific properties.
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 *
 * interface User {
 *   id: number
 *   name: string
 *   email: string
 * }
 *
 * // Create equivalence based on user ID only
 * const userByIdEq = Equivalence.mapInput(
 *   Equivalence.number,
 *   (user: User) => user.id
 * )
 *
 * const user1 = { id: 1, name: "Alice", email: "alice@example.com" }
 * const user2 = { id: 1, name: "Alice Smith", email: "alice.smith@example.com" }
 * const user3 = { id: 2, name: "Bob", email: "bob@example.com" }
 *
 * console.log(userByIdEq(user1, user2)) // true (same ID)
 * console.log(userByIdEq(user1, user3)) // false (different ID)
 *
 * // Case-insensitive string equivalence
 * const caseInsensitiveEq = Equivalence.mapInput(
 *   Equivalence.string,
 *   (s: string) => s.toLowerCase()
 * )
 *
 * console.log(caseInsensitiveEq("Hello", "HELLO")) // true
 * console.log(caseInsensitiveEq("Hello", "World")) // false
 * ```
 *
 * @category mapping
 * @since 2.0.0
 */
export const mapInput: {
  <B, A>(f: (b: B) => A): (self: Equivalence<A>) => Equivalence<B>
  <A, B>(self: Equivalence<A>, f: (b: B) => A): Equivalence<B>
} = dual(
  2,
  <A, B>(self: Equivalence<A>, f: (b: B) => A): Equivalence<B> => make((x, y) => self(f(x), f(y)))
)

/**
 * An equivalence relation for `Date` objects based on their timestamp.
 *
 * Compares dates by converting them to milliseconds since epoch using `getTime()`.
 * This means dates representing the same moment in time are considered equivalent,
 * regardless of timezone or other display properties.
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 *
 * const date1 = new Date("2023-01-01T00:00:00Z")
 * const date2 = new Date("2023-01-01T00:00:00Z")
 * const date3 = new Date("2023-01-01T01:00:00Z")
 *
 * console.log(Equivalence.Date(date1, date2)) // true (same timestamp)
 * console.log(Equivalence.Date(date1, date3)) // false (different timestamp)
 *
 * // Works with different Date objects representing the same time
 * const date4 = new Date(2023, 0, 1) // January 1, 2023 in local time
 * const date5 = new Date("2023-01-01T00:00:00") // Same moment, different creation
 * // Note: Result depends on local timezone
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const Date: Equivalence<Date> = mapInput(number, (date) => date.getTime())

/**
 * Creates an equivalence for tuples by combining two equivalence relations.
 *
 * The resulting equivalence compares tuples element-wise, requiring both
 * the first elements to be equivalent (according to the first equivalence)
 * and the second elements to be equivalent (according to the second equivalence).
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 *
 * const numberStringEq = Equivalence.product(
 *   Equivalence.number,
 *   Equivalence.string
 * )
 *
 * console.log(numberStringEq([1, "hello"], [1, "hello"])) // true
 * console.log(numberStringEq([1, "hello"], [2, "hello"])) // false (different numbers)
 * console.log(numberStringEq([1, "hello"], [1, "world"])) // false (different strings)
 *
 * // Useful for comparing coordinate pairs
 * type Point = readonly [number, number]
 * const pointEq = Equivalence.product(Equivalence.number, Equivalence.number)
 *
 * const point1: Point = [1, 2]
 * const point2: Point = [1, 2]
 * const point3: Point = [1, 3]
 *
 * console.log(pointEq(point1, point2)) // true
 * console.log(pointEq(point1, point3)) // false
 * ```
 *
 * @category combining
 * @since 2.0.0
 */
export const product: {
  <B>(that: Equivalence<B>): <A>(self: Equivalence<A>) => Equivalence<readonly [A, B]> // readonly because invariant
  <A, B>(self: Equivalence<A>, that: Equivalence<B>): Equivalence<readonly [A, B]> // readonly because invariant
} = dual(
  2,
  <A, B>(self: Equivalence<A>, that: Equivalence<B>): Equivalence<readonly [A, B]> =>
    make(([xa, xb], [ya, yb]) => self(xa, ya) && that(xb, yb))
)

/**
 * Creates an equivalence for arrays by applying a sequence of equivalences element-wise.
 *
 * Each equivalence in the collection is applied to the corresponding position in the arrays.
 * The arrays are considered equivalent if all corresponding elements are equivalent according
 * to their respective equivalences. If there are more equivalences than elements, the extra
 * equivalences are ignored. If there are more elements than equivalences, the extra elements
 * are ignored.
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 *
 * // Mixed-type tuple equivalence
 * const mixedTupleEq = Equivalence.all([
 *   Equivalence.number,    // First element: number
 *   Equivalence.string,    // Second element: string
 *   Equivalence.boolean    // Third element: boolean
 * ])
 *
 * console.log(mixedTupleEq([1, "hello", true], [1, "hello", true])) // true
 * console.log(mixedTupleEq([1, "hello", true], [2, "hello", true])) // false
 * console.log(mixedTupleEq([1, "hello"], [1, "hello", true])) // true (extra element ignored)
 *
 * // Case-insensitive string array comparison (first 2 elements)
 * const caseInsensitive = Equivalence.mapInput(
 *   Equivalence.string,
 *   (s: string) => s.toLowerCase()
 * )
 * 
 * const firstTwoEq = Equivalence.all([caseInsensitive, caseInsensitive])
 * console.log(firstTwoEq(["Hello", "World", "!"], ["HELLO", "WORLD", "?"])) // true
 * ```
 *
 * @category combining
 * @since 2.0.0
 */
export const all = <A>(collection: Iterable<Equivalence<A>>): Equivalence<ReadonlyArray<A>> => {
  return make((x, y) => {
    const len = Math.min(x.length, y.length)

    let collectionLength = 0
    for (const equivalence of collection) {
      if (collectionLength >= len) {
        break
      }
      if (!equivalence(x[collectionLength], y[collectionLength])) {
        return false
      }
      collectionLength++
    }
    return true
  })
}

/**
 * Creates an equivalence for non-empty tuples with a head element and remaining elements.
 *
 * The first element is compared using the provided equivalence, and the remaining elements
 * are compared using the equivalences from the collection in order.
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 *
 * // First element is a number, rest are strings
 * const numberThenStringsEq = Equivalence.productMany(
 *   Equivalence.number,
 *   [Equivalence.string, Equivalence.string]
 * )
 *
 * type NumberThenStrings = readonly [number, string, string]
 *
 * const tuple1: NumberThenStrings = [42, "hello", "world"]
 * const tuple2: NumberThenStrings = [42, "hello", "world"]
 * const tuple3: NumberThenStrings = [42, "hello", "universe"]
 * const tuple4: NumberThenStrings = [43, "hello", "world"]
 *
 * console.log(numberThenStringsEq(tuple1, tuple2)) // true
 * console.log(numberThenStringsEq(tuple1, tuple3)) // false (different third element)
 * console.log(numberThenStringsEq(tuple1, tuple4)) // false (different first element)
 * ```
 *
 * @category combining
 * @since 2.0.0
 */
export const productMany = <A>(
  self: Equivalence<A>,
  collection: Iterable<Equivalence<A>>
): Equivalence<readonly [A, ...Array<A>]> /* readonly because invariant */ => {
  const equivalence = all(collection)
  return make((x, y) => !self(x[0], y[0]) ? false : equivalence(x.slice(1), y.slice(1)))
}

/**
 * Creates an equivalence for tuples with heterogeneous element types.
 *
 * Similar to `Promise.all` but operates on `Equivalence`s. Given a tuple of `Equivalence`s,
 * returns a new `Equivalence` that compares tuples by applying each `Equivalence` to the
 * corresponding element of the tuple.
 *
 * ```
 * [Equivalence<A>, Equivalence<B>, ...] -> Equivalence<[A, B, ...]>
 * ```
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 *
 * // Create equivalence for [number, string, boolean] tuples
 * const mixedTupleEq = Equivalence.tuple([
 *   Equivalence.number,
 *   Equivalence.string,
 *   Equivalence.boolean
 * ])
 *
 * const tuple1 = [42, "hello", true] as const
 * const tuple2 = [42, "hello", true] as const
 * const tuple3 = [42, "hello", false] as const
 *
 * console.log(mixedTupleEq(tuple1, tuple2)) // true
 * console.log(mixedTupleEq(tuple1, tuple3)) // false (different boolean)
 *
 * // Custom equivalences for each position
 * const caseInsensitive = Equivalence.mapInput(
 *   Equivalence.string,
 *   (s: string) => s.toLowerCase()
 * )
 *
 * const customTupleEq = Equivalence.tuple([
 *   Equivalence.number,
 *   caseInsensitive,  // Case-insensitive string comparison
 *   Equivalence.boolean
 * ])
 *
 * console.log(customTupleEq([1, "Hello", true], [1, "HELLO", true])) // true
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const tuple = <Elements extends ReadonlyArray<Equivalence<any>>>(
  elements: Elements
): Equivalence<Readonly<{ [I in keyof Elements]: [Elements[I]] extends [Equivalence<infer A>] ? A : never }>> =>
  all(elements) as any

/**
 * Creates an equivalence for arrays where all elements are compared using the same equivalence.
 *
 * Two arrays are considered equivalent if they have the same length and all corresponding
 * elements are equivalent according to the provided element equivalence.
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 *
 * const numberArrayEq = Equivalence.array(Equivalence.number)
 *
 * console.log(numberArrayEq([1, 2, 3], [1, 2, 3])) // true
 * console.log(numberArrayEq([1, 2, 3], [1, 2, 4])) // false
 * console.log(numberArrayEq([1, 2], [1, 2, 3])) // false (different length)
 *
 * // Case-insensitive string array
 * const caseInsensitive = Equivalence.mapInput(
 *   Equivalence.string,
 *   (s: string) => s.toLowerCase()
 * )
 * const stringArrayEq = Equivalence.array(caseInsensitive)
 *
 * console.log(stringArrayEq(["Hello", "World"], ["HELLO", "WORLD"])) // true
 * console.log(stringArrayEq(["Hello"], ["Hi"])) // false
 *
 * // Empty arrays
 * console.log(numberArrayEq([], [])) // true
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const array = <A>(item: Equivalence<A>): Equivalence<ReadonlyArray<A>> =>
  make((self, that) => {
    if (self.length !== that.length) {
      return false
    }

    for (let i = 0; i < self.length; i++) {
      const isEq = item(self[i], that[i])
      if (!isEq) {
        return false
      }
    }

    return true
  })

/**
 * Creates an equivalence for objects by comparing their properties using provided equivalences.
 *
 * Given a struct of `Equivalence`s, returns a new `Equivalence` that compares objects
 * by applying each `Equivalence` to the corresponding property of the object.
 *
 * @example
 * ```ts
 * import { Equivalence } from "effect"
 *
 * interface Person {
 *   name: string
 *   age: number
 *   email: string
 * }
 *
 * const caseInsensitive = Equivalence.mapInput(
 *   Equivalence.string,
 *   (s: string) => s.toLowerCase()
 * )
 *
 * const personEq = Equivalence.struct<Person>({
 *   name: caseInsensitive,     // Case-insensitive name comparison
 *   age: Equivalence.number,   // Exact age comparison
 *   email: caseInsensitive     // Case-insensitive email comparison
 * })
 *
 * const person1 = { name: "Alice", age: 30, email: "alice@example.com" }
 * const person2 = { name: "ALICE", age: 30, email: "ALICE@EXAMPLE.COM" }
 * const person3 = { name: "Alice", age: 31, email: "alice@example.com" }
 *
 * console.log(personEq(person1, person2)) // true (case-insensitive match)
 * console.log(personEq(person1, person3)) // false (different age)
 *
 * // Partial equivalence for specific fields
 * const nameAgeEq = Equivalence.struct({
 *   name: Equivalence.string,
 *   age: Equivalence.number
 * })
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const struct = <R extends Record<string, Equivalence<any>>>(
  fields: R
): Equivalence<{ readonly [K in keyof R]: [R[K]] extends [Equivalence<infer A>] ? A : never }> => {
  const keys = Object.keys(fields)
  return make((self, that) => {
    for (const key of keys) {
      if (!fields[key](self[key], that[key])) {
        return false
      }
    }
    return true
  })
}
