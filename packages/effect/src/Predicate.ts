/**
 * @since 2.0.0
 */
import { dual, isFunction as isFunction_ } from "./Function.ts"
import type { TypeLambda } from "./HKT.ts"
import type { TupleOf, TupleOfAtLeast } from "./Types.ts"

/**
 * A `Predicate<A>` is a function that takes a value of type `A` and returns a boolean.
 * Predicates are fundamental for filtering, testing conditions, and type narrowing.
 *
 * @example
 * ```ts
 * import type { Predicate } from "effect"
 *
 * const isPositive: Predicate.Predicate<number> = (n) => n > 0
 * const isEven: Predicate.Predicate<number> = (n) => n % 2 === 0
 *
 * console.log(isPositive(5)) // true
 * console.log(isPositive(-1)) // false
 * console.log(isEven(4)) // true
 * console.log(isEven(3)) // false
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export interface Predicate<in A> {
  (a: A): boolean
}

/**
 * A type lambda for the `Predicate` type constructor.
 * Used for higher-kinded type operations and generic abstractions.
 *
 * @example
 * ```ts
 * import type { Predicate } from "effect"
 *
 * // Type lambda allows Predicate to work with higher-kinded type operations
 * // This is used internally by the Effect ecosystem for generic abstractions
 * type PredicateLambda = Predicate.PredicateTypeLambda
 *
 * // Demonstrates the type structure - in practice this is used by generic utilities
 * type NumberPredicate = Predicate.Predicate<number>
 * const isPositive: NumberPredicate = (n: number) => n > 0
 * console.log(isPositive(5)) // true
 * ```
 *
 * @category type lambdas
 * @since 2.0.0
 */
export interface PredicateTypeLambda extends TypeLambda {
  readonly type: Predicate<this["Target"]>
}

/**
 * A `Refinement<A, B>` is a special type of predicate that narrows type `A` to a subtype `B`.
 * It serves as a type guard that not only tests a condition but also refines the TypeScript type.
 *
 * @example
 * ```ts
 * import type { Predicate } from "effect"
 *
 * // A refinement that narrows string to non-empty string
 * const isNonEmpty: Predicate.Refinement<string, string> = (s): s is string =>
 *   s.length > 0
 *
 * // A refinement that narrows unknown to string
 * const isString: Predicate.Refinement<unknown, string> = (u): u is string =>
 *   typeof u === "string"
 *
 * const value: unknown = "hello"
 * if (isString(value)) {
 *   // TypeScript now knows value is string
 *   console.log(value.length) // ✓ TypeScript knows this is safe
 * }
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export interface Refinement<in A, out B extends A> {
  (a: A): a is B
}

/**
 * A namespace containing type-level utilities for working with `Predicate` types.
 * These utilities help extract type information from predicate type signatures.
 *
 * @example
 * ```ts
 * import type { Predicate } from "effect"
 *
 * // Extract the input type from a predicate
 * type StringPredicate = Predicate.Predicate<string>
 * type InputType = Predicate.Predicate.In<StringPredicate> // string
 *
 * // Use the any type for generic predicate operations
 * type AnyPredicate = Predicate.Predicate.Any
 * ```
 *
 * @since 3.6.0
 * @category type-level
 */
export declare namespace Predicate {
  /**
   * Extracts the input type `A` from a `Predicate<A>` type.
   *
   * @example
   * ```ts
   * import type { Predicate } from "effect"
   *
   * type StringPredicate = Predicate.Predicate<string>
   * type InputType = Predicate.Predicate.In<StringPredicate> // string
   *
   * type NumberPredicate = Predicate.Predicate<number>
   * type NumberInputType = Predicate.Predicate.In<NumberPredicate> // number
   * ```
   *
   * @since 3.6.0
   * @category type-level
   */
  export type In<T extends Any> = [T] extends [Predicate<infer _A>] ? _A : never
  /**
   * A utility type representing any predicate type.
   * Used for generic operations where the specific predicate type doesn't matter.
   *
   * @example
   * ```ts
   * import type { Predicate } from "effect"
   *
   * // A utility type for generic predicate operations
   * type AnyPredicate = Predicate.Predicate.Any
   *
   * // Function that negates any predicate - simplified version for demonstration
   * const negatePredicate = <A>(predicate: Predicate.Predicate<A>) => (input: A) =>
   *   !predicate(input)
   *
   * const isPositive = (n: number) => n > 0
   * const isNegative = negatePredicate(isPositive)
   * console.log(isNegative(-1)) // true
   * ```
   *
   * @since 3.6.0
   * @category type-level
   */
  export type Any = Predicate<never>
}

/**
 * A namespace containing type-level utilities for working with `Refinement` types.
 * These utilities help extract type information from refinement type signatures.
 *
 * @example
 * ```ts
 * import type { Predicate } from "effect"
 *
 * // Extract types from a refinement
 * type StringFromUnknown = Predicate.Refinement<unknown, string>
 * type InputType = Predicate.Refinement.In<StringFromUnknown> // unknown
 * type OutputType = Predicate.Refinement.Out<StringFromUnknown> // string
 *
 * // Use the any type for generic refinement operations
 * type AnyRefinement = Predicate.Refinement.Any
 * ```
 *
 * @since 3.6.0
 * @category type-level
 */
export declare namespace Refinement {
  /**
   * Extracts the input type `A` from a `Refinement<A, B>` type.
   *
   * @example
   * ```ts
   * import type { Predicate } from "effect"
   *
   * type StringFromUnknown = Predicate.Refinement<unknown, string>
   * type InputType = Predicate.Refinement.In<StringFromUnknown> // unknown
   *
   * type NumberFromValue = Predicate.Refinement<unknown, number>
   * type NumberInputType = Predicate.Refinement.In<NumberFromValue> // unknown
   * ```
   *
   * @since 3.6.0
   * @category type-level
   */
  export type In<T extends Any> = [T] extends [Refinement<infer _A, infer _>] ? _A : never
  /**
   * Extracts the output type `B` from a `Refinement<A, B>` type.
   *
   * @example
   * ```ts
   * import type { Predicate } from "effect"
   *
   * type StringFromUnknown = Predicate.Refinement<unknown, string>
   * type OutputType = Predicate.Refinement.Out<StringFromUnknown> // string
   *
   * type NumberFromValue = Predicate.Refinement<unknown, number>
   * type NumberOutputType = Predicate.Refinement.Out<NumberFromValue> // number
   * ```
   *
   * @since 3.6.0
   * @category type-level
   */
  export type Out<T extends Any> = [T] extends [Refinement<infer _, infer _B>] ? _B : never
  /**
   * A utility type representing any refinement type.
   * Used for generic operations where the specific refinement type doesn't matter.
   *
   * @example
   * ```ts
   * import type { Predicate } from "effect"
   *
   * // Function that composes any refinement with a predicate
   * const composeRefinement = <R extends Predicate.Refinement.Any>(
   *   refinement: R
   * ) =>
   * <A extends Predicate.Refinement.Out<R>>(
   *   predicate: Predicate.Predicate<A>
   * ): Predicate.Refinement<Predicate.Refinement.In<R>, A> =>
   * (input): input is A => refinement(input) && predicate(input as A)
   *
   * const isString = (u: unknown): u is string => typeof u === "string"
   * const isLong = (s: string) => s.length > 5
   * const isLongString = composeRefinement(isString)(isLong)
   * ```
   *
   * @since 3.6.0
   * @category type-level
   */
  export type Any = Refinement<any, any>
}

/**
 * Given a `Predicate<A>` returns a `Predicate<B>`
 *
 * @example
 * ```ts
 * import { Predicate } from "effect"
 * import * as N from "effect/Number"
 * import * as assert from "node:assert"
 *
 * const minLength3 = Predicate.mapInput(N.isGreaterThan(2), (s: string) => s.length)
 *
 * assert.deepStrictEqual(minLength3("a"), false)
 * assert.deepStrictEqual(minLength3("aa"), false)
 * assert.deepStrictEqual(minLength3("aaa"), true)
 * assert.deepStrictEqual(minLength3("aaaa"), true)
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const mapInput: {
  <B, A>(f: (b: B) => A): (self: Predicate<A>) => Predicate<B>
  <A, B>(self: Predicate<A>, f: (b: B) => A): Predicate<B>
} = dual(2, <A, B>(self: Predicate<A>, f: (b: B) => A): Predicate<B> => (b) => self(f(b)))

/**
 * Determine if an `Array` is a tuple with exactly `N` elements, narrowing down the type to `TupleOf`.
 *
 * An `Array` is considered to be a `TupleOf` if its length is exactly `N`.
 *
 * @example
 * ```ts
 * import { isTupleOf } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isTupleOf([1, 2, 3], 3), true)
 * assert.deepStrictEqual(isTupleOf([1, 2, 3], 2), false)
 * assert.deepStrictEqual(isTupleOf([1, 2, 3], 4), false)
 *
 * const arr: Array<number> = [1, 2, 3]
 * if (isTupleOf(arr, 3)) {
 *   console.log(arr)
 *   // ^? [number, number, number]
 * }
 * ```
 *
 * @category guards
 * @since 3.3.0
 */
export const isTupleOf: {
  <N extends number>(n: N): <T>(self: ReadonlyArray<T>) => self is TupleOf<N, T>
  <T, N extends number>(self: ReadonlyArray<T>, n: N): self is TupleOf<N, T>
} = dual(2, <T, N extends number>(self: ReadonlyArray<T>, n: N): self is TupleOf<N, T> => self.length === n)

/**
 * Determine if an `Array` is a tuple with at least `N` elements, narrowing down the type to `TupleOfAtLeast`.
 *
 * An `Array` is considered to be a `TupleOfAtLeast` if its length is at least `N`.
 *
 * @example
 * ```ts
 * import { isTupleOfAtLeast } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isTupleOfAtLeast([1, 2, 3], 3), true)
 * assert.deepStrictEqual(isTupleOfAtLeast([1, 2, 3], 2), true)
 * assert.deepStrictEqual(isTupleOfAtLeast([1, 2, 3], 4), false)
 *
 * const arr: Array<number> = [1, 2, 3, 4]
 * if (isTupleOfAtLeast(arr, 3)) {
 *   console.log(arr)
 *   // ^? [number, number, number, ...number[]]
 * }
 * ```
 *
 * @category guards
 * @since 3.3.0
 */
export const isTupleOfAtLeast: {
  <N extends number>(n: N): <T>(self: ReadonlyArray<T>) => self is TupleOfAtLeast<N, T>
  <T, N extends number>(self: ReadonlyArray<T>, n: N): self is TupleOfAtLeast<N, T>
} = dual(2, <T, N extends number>(self: ReadonlyArray<T>, n: N): self is TupleOfAtLeast<N, T> => self.length >= n)

/**
 * Tests if a value is `truthy`.
 *
 * @example
 * ```ts
 * import { isTruthy } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isTruthy(1), true)
 * assert.deepStrictEqual(isTruthy(0), false)
 * assert.deepStrictEqual(isTruthy(""), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isTruthy = (input: unknown) => !!input

/**
 * Tests if a value is a `Set`.
 *
 * @example
 * ```ts
 * import { isSet } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isSet(new Set([1, 2])), true)
 * assert.deepStrictEqual(isSet(new Set()), true)
 * assert.deepStrictEqual(isSet({}), false)
 * assert.deepStrictEqual(isSet(null), false)
 * assert.deepStrictEqual(isSet(undefined), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isSet = (input: unknown): input is Set<unknown> => input instanceof Set

/**
 * Tests if a value is a `Map`.
 *
 * @example
 * ```ts
 * import { isMap } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isMap(new Map()), true)
 * assert.deepStrictEqual(isMap({}), false)
 * assert.deepStrictEqual(isMap(null), false)
 * assert.deepStrictEqual(isMap(undefined), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isMap = (input: unknown): input is Map<unknown, unknown> => input instanceof Map

/**
 * Tests if a value is a `string`.
 *
 * @example
 * ```ts
 * import { isString } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isString("a"), true)
 *
 * assert.deepStrictEqual(isString(1), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isString = (input: unknown): input is string => typeof input === "string"

/**
 * Tests if a value is a `number`.
 *
 * @example
 * ```ts
 * import { isNumber } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isNumber(2), true)
 *
 * assert.deepStrictEqual(isNumber("2"), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isNumber = (input: unknown): input is number => typeof input === "number"

/**
 * Tests if a value is a `boolean`.
 *
 * @example
 * ```ts
 * import { isBoolean } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isBoolean(true), true)
 *
 * assert.deepStrictEqual(isBoolean("true"), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isBoolean = (input: unknown): input is boolean => typeof input === "boolean"

/**
 * Tests if a value is a `bigint`.
 *
 * @example
 * ```ts
 * import { isBigInt } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isBigInt(1n), true)
 *
 * assert.deepStrictEqual(isBigInt(1), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isBigInt = (input: unknown): input is bigint => typeof input === "bigint"

/**
 * Tests if a value is a `symbol`.
 *
 * @example
 * ```ts
 * import { isSymbol } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isSymbol(Symbol.for("a")), true)
 *
 * assert.deepStrictEqual(isSymbol("a"), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isSymbol = (input: unknown): input is symbol => typeof input === "symbol"

/**
 * @category guards
 * @since 4.0.0
 */
export const isPropertyKey = (u: unknown): u is PropertyKey => isString(u) || isNumber(u) || isSymbol(u)

/**
 * Tests if a value is a `function`.
 *
 * @example
 * ```ts
 * import { isFunction } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isFunction(isFunction), true)
 *
 * assert.deepStrictEqual(isFunction("function"), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isFunction: (input: unknown) => input is Function = isFunction_

/**
 * Tests if a value is `undefined`.
 *
 * @example
 * ```ts
 * import { isUndefined } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isUndefined(undefined), true)
 *
 * assert.deepStrictEqual(isUndefined(null), false)
 * assert.deepStrictEqual(isUndefined("undefined"), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isUndefined = (input: unknown): input is undefined => input === undefined

/**
 * Tests if a value is not `undefined`.
 *
 * @example
 * ```ts
 * import { isNotUndefined } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isNotUndefined(null), true)
 * assert.deepStrictEqual(isNotUndefined("undefined"), true)
 *
 * assert.deepStrictEqual(isNotUndefined(undefined), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isNotUndefined = <A>(input: A): input is Exclude<A, undefined> => input !== undefined

/**
 * Tests if a value is `null`.
 *
 * @example
 * ```ts
 * import { isNull } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isNull(null), true)
 *
 * assert.deepStrictEqual(isNull(undefined), false)
 * assert.deepStrictEqual(isNull("null"), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isNull = (input: unknown): input is null => input === null

/**
 * Tests if a value is not `null`.
 *
 * @example
 * ```ts
 * import { isNotNull } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isNotNull(undefined), true)
 * assert.deepStrictEqual(isNotNull("null"), true)
 *
 * assert.deepStrictEqual(isNotNull(null), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isNotNull = <A>(input: A): input is Exclude<A, null> => input !== null

/**
 * Tests if a value is nullish (`null` or `undefined`).
 *
 * @example
 * ```ts
 * import { isNullish } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isNullish(null), true)
 * assert.deepStrictEqual(isNullish(undefined), true)
 *
 * assert.deepStrictEqual(isNullish(0), false)
 * assert.deepStrictEqual(isNullish(""), false)
 * assert.deepStrictEqual(isNullish(false), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isNullish = (input: unknown): input is null | undefined => input === null || input === undefined

/**
 * Tests if a value is not nullish (not `null` and not `undefined`).
 *
 * @example
 * ```ts
 * import { isNotNullish } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isNotNullish(0), true)
 * assert.deepStrictEqual(isNotNullish(""), true)
 * assert.deepStrictEqual(isNotNullish(false), true)
 *
 * assert.deepStrictEqual(isNotNullish(null), false)
 * assert.deepStrictEqual(isNotNullish(undefined), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isNotNullish = <A>(input: A): input is NonNullable<A> => input != null

/**
 * A guard that always fails.
 *
 * @example
 * ```ts
 * import { isNever } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isNever(null), false)
 * assert.deepStrictEqual(isNever(undefined), false)
 * assert.deepStrictEqual(isNever({}), false)
 * assert.deepStrictEqual(isNever([]), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isNever: (input: unknown) => input is never = (_: unknown): _ is never => false

/**
 * A guard that always succeeds.
 *
 * @example
 * ```ts
 * import { isUnknown } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isUnknown(null), true)
 * assert.deepStrictEqual(isUnknown(undefined), true)
 *
 * assert.deepStrictEqual(isUnknown({}), true)
 * assert.deepStrictEqual(isUnknown([]), true)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isUnknown: (input: unknown) => input is unknown = (_): _ is unknown => true

/**
 * Tests if a value is an object or an array.
 *
 * Equivalent to `typeof input === "object" && input !== null`.
 *
 * @category guards
 * @since 4.0.0
 */
export const isObjectOrArray = (input: unknown): input is { [x: PropertyKey]: unknown } | Array<unknown> =>
  typeof input === "object" && input !== null

/**
 * Tests if a value is an object.
 *
 * @example
 * ```ts
 * import { isObject } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isObject({}), true)
 * assert.deepStrictEqual(isObject({ a: 1 }), true)
 *
 * assert.deepStrictEqual(isObject([]), false)
 * assert.deepStrictEqual(isObject([1, 2, 3]), false)
 * assert.deepStrictEqual(isObject(null), false)
 * assert.deepStrictEqual(isObject(undefined), false)
 * assert.deepStrictEqual(isObject(() => null), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isObject = (input: unknown): input is { [x: PropertyKey]: unknown } =>
  typeof input === "object" && input !== null && !Array.isArray(input)

/**
 * Tests if a value is a readonly object.
 *
 * @example
 * ```ts
 * import { isReadonlyObject } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isReadonlyObject({ a: 1 }), true)
 *
 * assert.deepStrictEqual(isReadonlyObject([1, 2, 3]), false)
 * assert.deepStrictEqual(isReadonlyObject(null), false)
 * assert.deepStrictEqual(isReadonlyObject(undefined), false)
 * ```x
 *
 * @category guards
 * @since 2.0.0
 */
export const isReadonlyObject: (input: unknown) => input is { readonly [x: PropertyKey]: unknown } = isObject

/**
 * Tests if a value is an `object` (i.e. objects, arrays, functions).
 *
 * @example
 * ```ts
 * import { isObjectKeyword } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isObjectKeyword({}), true)
 * assert.deepStrictEqual(isObjectKeyword([]), true)
 * assert.deepStrictEqual(isObjectKeyword(() => 1), true)
 *
 * assert.deepStrictEqual(isObjectKeyword(null), false)
 * assert.deepStrictEqual(isObjectKeyword(undefined), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isObjectKeyword = (input: unknown): input is object =>
  (typeof input === "object" && input !== null) || isFunction(input)

/**
 * Checks whether a value is an `object` containing a specified property key.
 * This is useful for safely accessing object properties and creating type guards.
 *
 * @example
 * ```ts
 * import { Predicate } from "effect"
 * import * as assert from "node:assert"
 *
 * const hasName = Predicate.hasProperty("name")
 * const hasAge = Predicate.hasProperty("age")
 *
 * assert.deepStrictEqual(hasName({ name: "Alice" }), true)
 * assert.deepStrictEqual(hasName({ age: 30 }), false)
 * assert.deepStrictEqual(hasName(null), false)
 *
 * // Curried usage
 * assert.deepStrictEqual(
 *   Predicate.hasProperty({ name: "Bob", age: 25 }, "name"),
 *   true
 * )
 * assert.deepStrictEqual(
 *   Predicate.hasProperty({ name: "Bob", age: 25 }, "email"),
 *   false
 * )
 *
 * // Type guard usage
 * const data: unknown = { name: "Charlie", age: 35 }
 * if (hasName(data) && hasAge(data)) {
 *   // TypeScript knows data has name and age properties
 *   console.log(`${data.name} is ${data.age} years old`)
 * }
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const hasProperty: {
  <P extends PropertyKey>(property: P): (self: unknown) => self is { [K in P]: unknown }
  <P extends PropertyKey>(self: unknown, property: P): self is { [K in P]: unknown }
} = dual(
  2,
  <P extends PropertyKey>(self: unknown, property: P): self is { [K in P]: unknown } =>
    isObjectKeyword(self) && (property in self)
)

/**
 * Tests if a value is an `object` with a property `_tag` that matches the given tag.
 *
 * @example
 * ```ts
 * import { isTagged } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isTagged(1, "a"), false)
 * assert.deepStrictEqual(isTagged(null, "a"), false)
 * assert.deepStrictEqual(isTagged({}, "a"), false)
 * assert.deepStrictEqual(isTagged({ a: "a" }, "a"), false)
 * assert.deepStrictEqual(isTagged({ _tag: "a" }, "a"), true)
 * assert.deepStrictEqual(isTagged("a")({ _tag: "a" }), true)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isTagged: {
  <K extends string>(tag: K): (self: unknown) => self is { _tag: K }
  <K extends string>(self: unknown, tag: K): self is { _tag: K }
} = dual(
  2,
  <K extends string>(self: unknown, tag: K): self is { _tag: K } => hasProperty(self, "_tag") && self["_tag"] === tag
)

/**
 * A guard that succeeds when the input is an `Error`.
 *
 * @example
 * ```ts
 * import { isError } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isError(new Error()), true)
 *
 * assert.deepStrictEqual(isError(null), false)
 * assert.deepStrictEqual(isError({}), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isError = (input: unknown): input is Error => input instanceof Error

/**
 * A guard that succeeds when the input is a `Uint8Array`.
 *
 * @example
 * ```ts
 * import { isUint8Array } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isUint8Array(new Uint8Array()), true)
 *
 * assert.deepStrictEqual(isUint8Array(null), false)
 * assert.deepStrictEqual(isUint8Array({}), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isUint8Array = (input: unknown): input is Uint8Array => input instanceof Uint8Array

/**
 * A guard that succeeds when the input is a `Date`.
 *
 * @example
 * ```ts
 * import { isDate } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isDate(new Date()), true)
 *
 * assert.deepStrictEqual(isDate(null), false)
 * assert.deepStrictEqual(isDate({}), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isDate = (input: unknown): input is Date => input instanceof Date

/**
 * A guard that succeeds when the input is an `Iterable`.
 *
 * @example
 * ```ts
 * import { isIterable } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isIterable([]), true)
 * assert.deepStrictEqual(isIterable(new Set()), true)
 *
 * assert.deepStrictEqual(isIterable(null), false)
 * assert.deepStrictEqual(isIterable({}), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export function isIterable(input: unknown): input is Iterable<unknown> {
  return hasProperty(input, Symbol.iterator) || isString(input)
}

/**
 * A guard that succeeds when the input is a Promise.
 *
 * @example
 * ```ts
 * import { isPromise } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isPromise({}), false)
 * assert.deepStrictEqual(isPromise(Promise.resolve("hello")), true)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isPromise = (
  input: unknown
): input is Promise<unknown> =>
  hasProperty(input, "then") && "catch" in input && isFunction(input.then) && isFunction(input.catch)

/**
 * Tests if a value is a `PromiseLike` object (has a `then` method).
 *
 * @example
 * ```ts
 * import { isPromiseLike } from "effect/Predicate"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(isPromiseLike(Promise.resolve("hello")), true)
 * assert.deepStrictEqual(isPromiseLike({ then: () => {} }), true)
 *
 * assert.deepStrictEqual(isPromiseLike({}), false)
 * assert.deepStrictEqual(isPromiseLike(null), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isPromiseLike = (
  input: unknown
): input is PromiseLike<unknown> => hasProperty(input, "then") && isFunction(input.then)

/**
 * Tests if a value is a `RegExp`.
 *
 * @example
 * ```ts
 * import { Predicate } from "effect"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(Predicate.isRegExp(/a/), true)
 * assert.deepStrictEqual(Predicate.isRegExp("a"), false)
 * ```
 *
 * @category guards
 * @since 3.9.0
 */
export const isRegExp = (input: unknown): input is RegExp => input instanceof RegExp

/**
 * Composes two predicates or refinements into a single predicate that returns `true` if both succeed.
 * When composing refinements, the result narrows the type through both refinements.
 *
 * @example
 * ```ts
 * import { Predicate } from "effect"
 * import * as assert from "node:assert"
 *
 * const isPositive = (n: number): n is number => n > 0
 * const isInteger = (n: number): n is number => Number.isInteger(n)
 * const isPositiveInteger = Predicate.compose(isPositive, isInteger)
 *
 * assert.deepStrictEqual(isPositiveInteger(42), true)
 * assert.deepStrictEqual(isPositiveInteger(3.14), false)
 * assert.deepStrictEqual(isPositiveInteger(-5), false)
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const compose: {
  <A, B extends A, C extends B>(bc: Refinement<B, C>): (ab: Refinement<A, B>) => Refinement<A, C>
  <A, B extends A>(bc: Predicate<NoInfer<B>>): (ab: Refinement<A, B>) => Refinement<A, B>
  <A, B extends A, C extends B>(ab: Refinement<A, B>, bc: Refinement<B, C>): Refinement<A, C>
  <A, B extends A>(ab: Refinement<A, B>, bc: Predicate<NoInfer<B>>): Refinement<A, B>
} = dual(
  2,
  <A, B extends A, C extends B>(ab: Refinement<A, B>, bc: Refinement<B, C>): Refinement<A, C> => (a): a is C =>
    ab(a) && bc(a)
)

/**
 * Combines two predicates to create a predicate for tuples that returns `true` if both predicates return `true` for their respective elements.
 *
 * @example
 * ```ts
 * import { Predicate } from "effect"
 * import * as assert from "node:assert"
 *
 * const isPositive = (n: number) => n > 0
 * const isLongString = (s: string) => s.length > 3
 * const tupleCheck = Predicate.product(isPositive, isLongString)
 *
 * assert.deepStrictEqual(tupleCheck([5, "hello"]), true)
 * assert.deepStrictEqual(tupleCheck([-1, "hello"]), false)
 * assert.deepStrictEqual(tupleCheck([5, "hi"]), false)
 * ```
 *
 * @category combining
 * @since 2.0.0
 */
export const product =
  <A, B>(self: Predicate<A>, that: Predicate<B>): Predicate<readonly [A, B]> /* readonly because contravariant */ =>
  ([a, b]) => self(a) && that(b)

/**
 * Creates a predicate for arrays that returns `true` if all corresponding predicates return `true` for their respective elements.
 *
 * @example
 * ```ts
 * import { Predicate } from "effect"
 * import * as assert from "node:assert"
 *
 * const isPositive = (n: number) => n > 0
 * const isEven = (n: number) => n % 2 === 0
 * const arrayCheck = Predicate.all([isPositive, isEven])
 *
 * assert.deepStrictEqual(arrayCheck([2, 4]), true)
 * assert.deepStrictEqual(arrayCheck([-1, 4]), false)
 * assert.deepStrictEqual(arrayCheck([2, 3]), false)
 * ```
 *
 * @category combining
 * @since 2.0.0
 */
export const all = <A>(
  collection: Iterable<Predicate<A>>
): Predicate<ReadonlyArray<A>> => {
  return (as) => {
    let collectionIndex = 0
    for (const p of collection) {
      if (collectionIndex >= as.length) {
        break
      }
      if (p(as[collectionIndex]) === false) {
        return false
      }
      collectionIndex++
    }
    return true
  }
}

/**
 * Combines a primary predicate with multiple predicates to create a predicate for non-empty tuples.
 * The first element is tested with the primary predicate, and subsequent elements are tested with the collection.
 *
 * @example
 * ```ts
 * import { Predicate } from "effect"
 * import * as assert from "node:assert"
 *
 * const isPositive = (n: number) => n > 0
 * const isEven = (n: number) => n % 2 === 0
 * const tupleCheck = Predicate.productMany(isPositive, [isEven, isPositive])
 *
 * assert.deepStrictEqual(tupleCheck([1, 2, 3]), true)
 * assert.deepStrictEqual(tupleCheck([-1, 2, 3]), false)
 * assert.deepStrictEqual(tupleCheck([1, 3, 3]), false)
 * ```
 *
 * @category combining
 * @since 2.0.0
 */
export const productMany = <A>(
  self: Predicate<A>,
  collection: Iterable<Predicate<A>>
): Predicate<readonly [A, ...Array<A>]> /* readonly because contravariant */ => {
  const rest = all(collection)
  return ([head, ...tail]) => self(head) === false ? false : rest(tail)
}

/**
 * Creates a predicate for tuples by applying predicates to corresponding tuple elements.
 * Similar to `Promise.all` but operates on `Predicate`s.
 *
 * @example
 * ```ts
 * import { Predicate } from "effect"
 * import * as assert from "node:assert"
 *
 * const isPositive = (n: number) => n > 0
 * const isString = (s: unknown): s is string => typeof s === "string"
 * const tupleCheck = Predicate.tuple(isPositive, isString)
 *
 * assert.deepStrictEqual(tupleCheck([5, "hello"]), true)
 * assert.deepStrictEqual(tupleCheck([-1, "hello"]), false)
 * assert.deepStrictEqual(tupleCheck([5, 42]), false)
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const tuple: {
  <T extends ReadonlyArray<Predicate.Any>>(
    ...elements: T
  ): [Extract<T[number], Refinement.Any>] extends [never] ? Predicate<{ readonly [I in keyof T]: Predicate.In<T[I]> }>
    : Refinement<
      { readonly [I in keyof T]: T[I] extends Refinement.Any ? Refinement.In<T[I]> : Predicate.In<T[I]> },
      { readonly [I in keyof T]: T[I] extends Refinement.Any ? Refinement.Out<T[I]> : Predicate.In<T[I]> }
    >
} = (...elements: ReadonlyArray<Predicate.Any>) => all(elements) as any

/**
 * Creates a predicate for objects by applying predicates to corresponding object properties.
 *
 * @example
 * ```ts
 * import { Predicate } from "effect"
 * import * as assert from "node:assert"
 *
 * const isPositive = (n: number) => n > 0
 * const isString = (s: unknown): s is string => typeof s === "string"
 * const structCheck = Predicate.struct({ age: isPositive, name: isString })
 *
 * assert.deepStrictEqual(structCheck({ age: 25, name: "Alice" }), true)
 * assert.deepStrictEqual(structCheck({ age: -1, name: "Alice" }), false)
 * assert.deepStrictEqual(structCheck({ age: 25, name: 42 }), false)
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const struct: {
  <R extends Record<string, Predicate.Any>>(
    fields: R
  ): [Extract<R[keyof R], Refinement.Any>] extends [never] ?
    Predicate<{ readonly [K in keyof R]: Predicate.In<R[K]> }> :
    Refinement<
      { readonly [K in keyof R]: R[K] extends Refinement.Any ? Refinement.In<R[K]> : Predicate.In<R[K]> },
      { readonly [K in keyof R]: R[K] extends Refinement.Any ? Refinement.Out<R[K]> : Predicate.In<R[K]> }
    >
} = (<R extends Record<string, Predicate.Any>>(fields: R) => {
  const keys = Object.keys(fields)
  return (a: Record<string, unknown>) => {
    for (const key of keys) {
      if (!fields[key](a[key] as never)) {
        return false
      }
    }
    return true
  }
}) as any

/**
 * Negates the result of a given predicate.
 *
 * @example
 * ```ts
 * import { Predicate } from "effect"
 * import * as N from "effect/Number"
 * import * as assert from "node:assert"
 *
 * const isPositive = Predicate.not(N.isLessThan(0))
 *
 * assert.deepStrictEqual(isPositive(-1), false)
 * assert.deepStrictEqual(isPositive(0), true)
 * assert.deepStrictEqual(isPositive(1), true)
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const not = <A>(self: Predicate<A>): Predicate<A> => (a) => !self(a)

/**
 * Combines two predicates into a new predicate that returns `true` if at least one of the predicates returns `true`.
 *
 * @example
 * ```ts
 * import { Predicate } from "effect"
 * import * as N from "effect/Number"
 * import * as assert from "node:assert"
 *
 * const nonZero = Predicate.or(N.isLessThan(0), N.isGreaterThan(0))
 *
 * assert.deepStrictEqual(nonZero(-1), true)
 * assert.deepStrictEqual(nonZero(0), false)
 * assert.deepStrictEqual(nonZero(1), true)
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const or: {
  <A, C extends A>(that: Refinement<A, C>): <B extends A>(self: Refinement<A, B>) => Refinement<A, B | C>
  <A, B extends A, C extends A>(self: Refinement<A, B>, that: Refinement<A, C>): Refinement<A, B | C>
  <A>(that: Predicate<A>): (self: Predicate<A>) => Predicate<A>
  <A>(self: Predicate<A>, that: Predicate<A>): Predicate<A>
} = dual(2, <A>(self: Predicate<A>, that: Predicate<A>): Predicate<A> => (a) => self(a) || that(a))

/**
 * Combines two predicates into a new predicate that returns `true` if both of the predicates returns `true`.
 *
 * @example
 * ```ts
 * import { Predicate } from "effect"
 * import * as assert from "node:assert"
 *
 * const minLength = (n: number) => (s: string) => s.length >= n
 * const maxLength = (n: number) => (s: string) => s.length <= n
 *
 * const length = (n: number) => Predicate.and(minLength(n), maxLength(n))
 *
 * assert.deepStrictEqual(length(2)("aa"), true)
 * assert.deepStrictEqual(length(2)("a"), false)
 * assert.deepStrictEqual(length(2)("aaa"), false)
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const and: {
  <A, C extends A>(that: Refinement<A, C>): <B extends A>(self: Refinement<A, B>) => Refinement<A, B & C>
  <A, B extends A, C extends A>(self: Refinement<A, B>, that: Refinement<A, C>): Refinement<A, B & C>
  <A>(that: Predicate<A>): (self: Predicate<A>) => Predicate<A>
  <A>(self: Predicate<A>, that: Predicate<A>): Predicate<A>
} = dual(2, <A>(self: Predicate<A>, that: Predicate<A>): Predicate<A> => (a) => self(a) && that(a))

/**
 * Combines two predicates into a new predicate that returns `true` if exactly one of the predicates returns `true` (exclusive or).
 *
 * @example
 * ```ts
 * import { Predicate } from "effect"
 * import * as assert from "node:assert"
 *
 * const isEven = (n: number) => n % 2 === 0
 * const isPositive = (n: number) => n > 0
 * const eitherEvenOrPositive = Predicate.xor(isEven, isPositive)
 *
 * assert.deepStrictEqual(eitherEvenOrPositive(2), false) // even and positive
 * assert.deepStrictEqual(eitherEvenOrPositive(-2), true) // even but not positive
 * assert.deepStrictEqual(eitherEvenOrPositive(3), true) // positive but not even
 * assert.deepStrictEqual(eitherEvenOrPositive(-3), false) // neither even nor positive
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const xor: {
  <A>(that: Predicate<A>): (self: Predicate<A>) => Predicate<A>
  <A>(self: Predicate<A>, that: Predicate<A>): Predicate<A>
} = dual(2, <A>(self: Predicate<A>, that: Predicate<A>): Predicate<A> => (a) => self(a) !== that(a))

/**
 * Combines two predicates into a new predicate that returns `true` if both predicates return the same boolean value (equivalence).
 *
 * @example
 * ```ts
 * import { Predicate } from "effect"
 * import * as assert from "node:assert"
 *
 * const isEven = (n: number) => n % 2 === 0
 * const isDivisibleBy2 = (n: number) => n % 2 === 0
 * const sameResult = Predicate.eqv(isEven, isDivisibleBy2)
 *
 * assert.deepStrictEqual(sameResult(4), true) // both return true
 * assert.deepStrictEqual(sameResult(3), true) // both return false
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const eqv: {
  <A>(that: Predicate<A>): (self: Predicate<A>) => Predicate<A>
  <A>(self: Predicate<A>, that: Predicate<A>): Predicate<A>
} = dual(2, <A>(self: Predicate<A>, that: Predicate<A>): Predicate<A> => (a) => self(a) === that(a))

/**
 * Represents the logical implication combinator for predicates. In formal
 * logic, the implication operator `->` denotes that if the first proposition
 * (antecedent) is true, then the second proposition (consequent) must also be
 * true. In simpler terms, `p implies q` can be interpreted as "if p then q". If
 * the first predicate holds, then the second predicate must hold
 * for the given context.
 *
 * In practical terms within TypeScript, `p implies q` is equivalent to `!p || (p && q)`.
 *
 * Note that if the antecedent is `false`, the result is `true` by default
 * because the outcome of the consequent cannot be determined.
 *
 * This function is useful in situations where you need to enforce rules or
 * constraints that are contingent on certain conditions.
 * It proves especially helpful in defining property tests.
 *
 * The example below illustrates the transitive property of order using the
 * `implies` function. In simple terms, if `a <= b` and `b <= c`, then `a <= c`
 * must be true.
 *
 * @example
 * ```ts
 * import { Predicate } from "effect"
 * import * as assert from "node:assert"
 *
 * type Triple = {
 *   readonly a: number
 *   readonly b: number
 *   readonly c: number
 * }
 *
 * const transitivity = Predicate.implies(
 *   // antecedent
 *   (input: Triple) => input.a <= input.b && input.b <= input.c,
 *   // consequent
 *   (input: Triple) => input.a <= input.c
 * )
 *
 * assert.equal(transitivity({ a: 1, b: 2, c: 3 }), true)
 * // antecedent is `false`, so the result is `true`
 * assert.equal(transitivity({ a: 1, b: 0, c: 0 }), true)
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const implies: {
  <A>(consequent: Predicate<A>): (antecedent: Predicate<A>) => Predicate<A>
  <A>(antecedent: Predicate<A>, consequent: Predicate<A>): Predicate<A>
} = dual(
  2,
  <A>(antecedent: Predicate<A>, consequent: Predicate<A>): Predicate<A> => (a) => antecedent(a) ? consequent(a) : true
)

/**
 * Combines two predicates into a new predicate that returns `true` if neither predicate returns `true` (logical NOR).
 *
 * @example
 * ```ts
 * import { Predicate } from "effect"
 * import * as assert from "node:assert"
 *
 * const isEven = (n: number) => n % 2 === 0
 * const isPositive = (n: number) => n > 0
 * const neitherEvenNorPositive = Predicate.nor(isEven, isPositive)
 *
 * assert.deepStrictEqual(neitherEvenNorPositive(-3), true) // neither even nor positive
 * assert.deepStrictEqual(neitherEvenNorPositive(2), false) // even
 * assert.deepStrictEqual(neitherEvenNorPositive(3), false) // positive
 * assert.deepStrictEqual(neitherEvenNorPositive(-2), false) // even
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const nor: {
  <A>(that: Predicate<A>): (self: Predicate<A>) => Predicate<A>
  <A>(self: Predicate<A>, that: Predicate<A>): Predicate<A>
} = dual(
  2,
  <A>(self: Predicate<A>, that: Predicate<A>): Predicate<A> => (a) => !(self(a) || that(a))
)

/**
 * Combines two predicates into a new predicate that returns `true` if not both predicates return `true` (logical NAND).
 *
 * @example
 * ```ts
 * import { Predicate } from "effect"
 * import * as assert from "node:assert"
 *
 * const isEven = (n: number) => n % 2 === 0
 * const isPositive = (n: number) => n > 0
 * const notBothEvenAndPositive = Predicate.nand(isEven, isPositive)
 *
 * assert.deepStrictEqual(notBothEvenAndPositive(2), false) // both even and positive
 * assert.deepStrictEqual(notBothEvenAndPositive(-2), true) // even but not positive
 * assert.deepStrictEqual(notBothEvenAndPositive(3), true) // positive but not even
 * assert.deepStrictEqual(notBothEvenAndPositive(-3), true) // neither even nor positive
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const nand: {
  <A>(that: Predicate<A>): (self: Predicate<A>) => Predicate<A>
  <A>(self: Predicate<A>, that: Predicate<A>): Predicate<A>
} = dual(
  2,
  <A>(self: Predicate<A>, that: Predicate<A>): Predicate<A> => (a) => !(self(a) && that(a))
)

/**
 * Creates a predicate that returns `true` if all predicates in the collection return `true` for the given input.
 *
 * @example
 * ```ts
 * import { Predicate } from "effect"
 * import * as assert from "node:assert"
 *
 * const isPositive = (n: number) => n > 0
 * const isEven = (n: number) => n % 2 === 0
 * const isLessThan10 = (n: number) => n < 10
 * const allChecks = Predicate.every([isPositive, isEven, isLessThan10])
 *
 * assert.deepStrictEqual(allChecks(8), true)
 * assert.deepStrictEqual(allChecks(-2), false)
 * assert.deepStrictEqual(allChecks(12), false)
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const every = <A>(collection: Iterable<Predicate<A>>): Predicate<A> => (a: A) => {
  for (const p of collection) {
    if (!p(a)) {
      return false
    }
  }
  return true
}

/**
 * Creates a predicate that returns `true` if at least one predicate in the collection returns `true` for the given input.
 *
 * @example
 * ```ts
 * import { Predicate } from "effect"
 * import * as assert from "node:assert"
 *
 * const isPositive = (n: number) => n > 0
 * const isEven = (n: number) => n % 2 === 0
 * const anyCheck = Predicate.some([isPositive, isEven])
 *
 * assert.deepStrictEqual(anyCheck(3), true) // positive
 * assert.deepStrictEqual(anyCheck(-2), true) // even
 * assert.deepStrictEqual(anyCheck(-3), false) // neither positive nor even
 * ```
 *
 * @category elements
 * @since 2.0.0
 */
export const some = <A>(collection: Iterable<Predicate<A>>): Predicate<A> => (a) => {
  for (const p of collection) {
    if (p(a)) {
      return true
    }
  }
  return false
}
