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
 * import { Array, Equivalence } from "effect"
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
import { dual } from "./Function.ts"
import type { TypeLambda } from "./HKT.ts"
import * as Reducer from "./Reducer.ts"

/**
 * Represents an equivalence relation over type `A`.
 *
 * An `Equivalence<A>` is a function that takes two values of type `A` and returns
 * `true` if they are considered equivalent, `false` otherwise.
 *
 * @example
 * ```ts
 * import type { Equivalence } from "effect"
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
 * import type { Equivalence } from "effect"
 * import type { Kind } from "effect/HKT"
 *
 * // Used internally for type-level computations
 * type NumberEquivalence = Kind<
 *   Equivalence.EquivalenceTypeLambda,
 *   never,
 *   never,
 *   never,
 *   number
 * >
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
 * const tolerance = Equivalence.make<number>((a, b) => Math.abs(a - b) < 0.0001)
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
 *   Equivalence.strict<string>(),
 *   (p: Person) => p.name
 * )
 *
 * const ageEquivalence = Equivalence.mapInput(
 *   Equivalence.strict<number>(),
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
 * const xEq = Equivalence.mapInput(
 *   Equivalence.strict<number>(),
 *   (p: Point3D) => p.x
 * )
 * const yEq = Equivalence.mapInput(
 *   Equivalence.strict<number>(),
 *   (p: Point3D) => p.y
 * )
 * const zEq = Equivalence.mapInput(
 *   Equivalence.strict<number>(),
 *   (p: Point3D) => p.z
 * )
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
  make((x, y) => {
    for (const equivalence of collection) {
      if (!equivalence(x, y)) {
        return false
      }
    }
    return true
  })

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
 *   Equivalence.strict<number>(),
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
 *   Equivalence.strict<string>(),
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
 * // Create equivalence for string tuples
 * const stringTupleEq = Equivalence.tuple([
 *   Equivalence.strict<string>(),
 *   Equivalence.strict<string>(),
 *   Equivalence.strict<string>()
 * ])
 *
 * const tuple1 = ["hello", "world", "test"] as const
 * const tuple2 = ["hello", "world", "test"] as const
 * const tuple3 = ["hello", "world", "different"] as const
 *
 * console.log(stringTupleEq(tuple1, tuple2)) // true
 * console.log(stringTupleEq(tuple1, tuple3)) // false (different third element)
 *
 * // Custom equivalences for each position
 * const caseInsensitive = Equivalence.mapInput(
 *   Equivalence.strict<string>(),
 *   (s: string) => s.toLowerCase()
 * )
 *
 * const customTupleEq = Equivalence.tuple([
 *   caseInsensitive,
 *   caseInsensitive, // Case-insensitive string comparison
 *   caseInsensitive
 * ])
 *
 * console.log(
 *   customTupleEq(["Hello", "World", "Test"], ["HELLO", "WORLD", "TEST"])
 * ) // true
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export function tuple<const Elements extends ReadonlyArray<Equivalence<any>>>(
  elements: Elements
): Equivalence<{ readonly [I in keyof Elements]: [Elements[I]] extends [Equivalence<infer A>] ? A : never }> {
  return make((self, that) => {
    if (self.length !== that.length) {
      return false
    }
    for (let i = 0; i < self.length; i++) {
      if (!elements[i](self[i], that[i])) {
        return false
      }
    }
    return true
  })
}

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
 * const numberArrayEq = Equivalence.array(Equivalence.strict<number>())
 *
 * console.log(numberArrayEq([1, 2, 3], [1, 2, 3])) // true
 * console.log(numberArrayEq([1, 2, 3], [1, 2, 4])) // false
 * console.log(numberArrayEq([1, 2], [1, 2, 3])) // false (different length)
 *
 * // Case-insensitive string array
 * const caseInsensitive = Equivalence.mapInput(
 *   Equivalence.strict<string>(),
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
export function array<A>(item: Equivalence<A>): Equivalence<ReadonlyArray<A>> {
  return make((self, that) => {
    if (self.length !== that.length) return false

    for (let i = 0; i < self.length; i++) {
      if (!item(self[i], that[i])) return false
    }

    return true
  })
}

/**
 * Creates an equivalence for objects by comparing their properties using
 * provided equivalences.
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
 *   Equivalence.strict<string>(),
 *   (s: string) => s.toLowerCase()
 * )
 *
 * const personEq = Equivalence.struct({
 *   name: caseInsensitive, // Case-insensitive name comparison
 *   age: Equivalence.strict<number>(), // Exact age comparison
 *   email: caseInsensitive // Case-insensitive email comparison
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
 *   name: Equivalence.strict<string>(),
 *   age: Equivalence.strict<number>()
 * })
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export function struct<R extends Record<string, Equivalence<any>>>(
  fields: R
): Equivalence<{ readonly [K in keyof R]: [R[K]] extends [Equivalence<infer A>] ? A : never }> {
  const keys: Array<any> = Reflect.ownKeys(fields)
  return make((self, that) => {
    for (const key of keys) {
      if (!fields[key](self[key], that[key])) return false
    }
    return true
  })
}

/**
 * Creates an equivalence for objects by comparing their properties using
 * provided equivalence.
 *
 * Both string and symbol keys are supported.
 *
 * @category combinators
 * @since 2.0.0
 */
export function record<A>(value: Equivalence<A>): Equivalence<Record<PropertyKey, A>> {
  return make((self, that) => {
    const selfKeys = Reflect.ownKeys(self)
    const thatKeys = Reflect.ownKeys(that)

    if (selfKeys.length !== thatKeys.length) return false

    for (const key of selfKeys) {
      if (!Object.hasOwn(that, key) || !value(self[key], that[key])) {
        return false
      }
    }

    return true
  })
}

/**
 * @since 4.0.0
 */
export function makeReducer<A>() {
  return Reducer.make<Equivalence<A>>(
    combine,
    () => true,
    combineAll
  )
}
