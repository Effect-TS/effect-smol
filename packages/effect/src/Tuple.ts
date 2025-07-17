/**
 * This module provides utility functions for working with tuples in TypeScript.
 *
 * @since 2.0.0
 */
import * as Equivalence from "./Equivalence.ts"
import { dual } from "./Function.ts"
import type { TypeLambda } from "./HKT.ts"
import * as order from "./Order.ts"
import type { Apply, Lambda } from "./Struct.ts"

/**
 * A type lambda for tuples with two elements, useful for higher-kinded type operations.
 *
 * @example
 * ```ts
 * import type { Tuple } from "effect"
 *
 * // Used internally for type-level operations on 2-tuples
 * type Example = Tuple.Tuple2TypeLambda
 * ```
 *
 * @category Type lambdas
 * @since 4.0.0
 */
export interface Tuple2TypeLambda extends TypeLambda {
  readonly type: [this["Out1"], this["Target"]]
}

/**
 * Constructs a new tuple from the provided values.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { make } from "effect/Tuple"
 *
 * assert.deepStrictEqual(make(1, 'hello', true), [1, 'hello', true])
 * ```
 *
 * @category Constructors
 * @since 2.0.0
 */
export const make = <Elements extends ReadonlyArray<unknown>>(...elements: Elements): Elements => elements

type Indices<T extends ReadonlyArray<unknown>> = Exclude<Partial<T>["length"], T["length"]>

/**
 * Retrieves the element at a specified index from a tuple.
 *
 * @example
 * ```ts
 * import { Tuple } from "effect"
 *
 * console.log(Tuple.get([1, true, 'hello'], 2))
 * // 'hello'
 * ```
 *
 * @category Getters
 * @since 4.0.0
 */
export const get: {
  <const T extends ReadonlyArray<unknown>, I extends Indices<T> & keyof T>(index: I): (self: T) => T[I]
  <const T extends ReadonlyArray<unknown>, I extends Indices<T> & keyof T>(self: T, index: I): T[I]
} = dual(2, <T extends ReadonlyArray<unknown>, I extends keyof T>(self: T, index: I): T[I] => self[index])

type _BuildTuple<
  T extends ReadonlyArray<unknown>,
  K,
  Acc extends ReadonlyArray<unknown> = [],
  I extends ReadonlyArray<unknown> = [] // current index counter
> = I["length"] extends T["length"] ? Acc
  : _BuildTuple<
    T,
    K,
    // If current index is in K, keep the element; otherwise skip it
    I["length"] extends K ? [...Acc, T[I["length"]]] : Acc,
    [...I, unknown]
  >

type PickTuple<T extends ReadonlyArray<unknown>, K> = _BuildTuple<T, K>

/**
 * Creates a new tuple by picking elements at the specified indices from an existing tuple.
 *
 * @example
 * ```ts
 * import { Tuple } from "effect"
 *
 * const result = Tuple.pick(["a", "b", "c", "d"], [0, 2, 3])
 * console.log(result)
 * // ["a", "c", "d"]
 * ```
 *
 * @category Utilities
 * @since 4.0.0
 */
export const pick: {
  <const T extends ReadonlyArray<unknown>, const I extends ReadonlyArray<Indices<T>>>(
    indices: I
  ): (self: T) => PickTuple<T, I[number]>
  <const T extends ReadonlyArray<unknown>, const I extends ReadonlyArray<Indices<T>>>(
    self: T,
    indices: I
  ): PickTuple<T, I[number]>
} = dual(
  2,
  <const T extends ReadonlyArray<unknown>>(
    self: T,
    indices: ReadonlyArray<number>
  ) => {
    return indices.map((i) => self[i])
  }
)

type OmitTuple<T extends ReadonlyArray<unknown>, K> = _BuildTuple<T, Exclude<Indices<T>, K>>

/**
 * Creates a new tuple by omitting elements at the specified indices from an existing tuple.
 *
 * @example
 * ```ts
 * import { Tuple } from "effect"
 *
 * const result = Tuple.omit(["a", "b", "c", "d"], [1, 3])
 * console.log(result)
 * // ["a", "c"]
 * ```
 *
 * @category Utilities
 * @since 4.0.0
 */
export const omit: {
  <const T extends ReadonlyArray<unknown>, const I extends ReadonlyArray<Indices<T>>>(
    indices: I
  ): (self: T) => OmitTuple<T, I[number]>
  <const T extends ReadonlyArray<unknown>, const I extends ReadonlyArray<Indices<T>>>(
    self: T,
    indices: I
  ): OmitTuple<T, I[number]>
} = dual(
  2,
  <const T extends ReadonlyArray<unknown>>(
    self: T,
    indices: ReadonlyArray<number>
  ) => {
    const toDrop = new Set<number>(indices)
    return self.filter((_, i) => !toDrop.has(i))
  }
)

/**
 * Return the first element of a tuple.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { getFirst } from "effect/Tuple"
 *
 * assert.deepStrictEqual(getFirst(["hello", 42]), "hello")
 * ```
 *
 * @category Getters
 * @since 2.0.0
 */
export const getFirst = <L, R>(self: readonly [L, R]): L => self[0]

/**
 * Return the second element of a tuple.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { getSecond } from "effect/Tuple"
 *
 * assert.deepStrictEqual(getSecond(["hello", 42]), 42)
 * ```
 *
 * @category Getters
 * @since 2.0.0
 */
export const getSecond = <L, R>(self: readonly [L, R]): R => self[1]

/**
 * Appends an element to the end of a tuple.
 *
 * @example
 * ```ts
 * import { Tuple } from "effect"
 *
 * const result = Tuple.appendElement([1, 2], 3)
 * console.log(result)
 * // [1, 2, 3]
 * ```
 *
 * @category Concatenating
 * @since 2.0.0
 */
export const appendElement: {
  <const E>(element: E): <const T extends ReadonlyArray<unknown>>(self: T) => [...T, E]
  <const T extends ReadonlyArray<unknown>, const E>(self: T, element: E): [...T, E]
} = dual(2, <T extends ReadonlyArray<unknown>, E>(self: T, element: E): [...T, E] => [...self, element])

/**
 * Appends a tuple to the end of another tuple.
 *
 * @example
 * ```ts
 * import { Tuple } from "effect"
 *
 * const result = Tuple.appendElements([1, 2], [3, 4])
 * console.log(result)
 * // [1, 2, 3, 4]
 * ```
 *
 * @category Concatenating
 * @since 2.0.0
 */
export const appendElements: {
  <const T2 extends ReadonlyArray<unknown>>(
    that: T2
  ): <const T1 extends ReadonlyArray<unknown>>(self: T1) => [...T1, ...T2]
  <const T1 extends ReadonlyArray<unknown>, const T2 extends ReadonlyArray<unknown>>(self: T1, that: T2): [...T1, ...T2]
} = dual(
  2,
  <T1 extends ReadonlyArray<unknown>, T2 extends ReadonlyArray<unknown>>(
    self: T1,
    that: T2
  ): [...T1, ...T2] => [...self, ...that]
)

type Evolver<T> = { readonly [I in keyof T]?: ((a: T[I]) => unknown) | undefined }

type Evolved<T, E> = { [I in keyof T]: I extends keyof E ? (E[I] extends (...a: any) => infer R ? R : T[I]) : T[I] }

/**
 * Transforms the values of a tuple using the provided transformation functions for each element.
 * If no transformation function is provided for an element, it will return the original value.
 *
 * @example
 * ```ts
 * import { Tuple } from "effect"
 *
 * // Transform specific elements by index
 * const original = ["hello", 42, true]
 * const transformers = {
 *   0: (s: string) => s.toUpperCase(),
 *   1: (n: number) => n * 2
 * }
 * // Result: ["HELLO", 84, true]
 * ```
 *
 * @category Mapping
 * @since 4.0.0
 */
export const evolve: {
  <const T extends ReadonlyArray<unknown>, const E extends Evolver<T>>(evolver: E): (self: T) => Evolved<T, E>
  <const T extends ReadonlyArray<unknown>, const E extends Evolver<T>>(self: T, evolver: E): Evolved<T, E>
} = dual(
  2,
  <const T extends ReadonlyArray<unknown>, const E extends Evolver<T>>(self: T, evolver: E) => {
    return self.map((e, i) => (evolver[i] !== undefined ? evolver[i](e) : e))
  }
)

/**
 * Renames indices in a tuple using the provided index mapping.
 *
 * @example
 * ```ts
 * import { Tuple } from "effect"
 *
 * // Example demonstrates index remapping concept
 * const original = ["a", "b", "c"]
 * const mapping = { 0: "2", 1: "0" }
 * // Result would remap indices according to the mapping
 * ```
 *
 * @category Index utilities
 * @since 4.0.0
 */
export const renameIndices: {
  <const T extends ReadonlyArray<unknown>, const M extends { readonly [I in keyof T]?: `${keyof T & string}` }>(
    mapping: M
  ): (self: T) => { [I in keyof T]: I extends keyof M ? M[I] extends keyof T ? T[M[I]] : T[I] : T[I] }
  <const T extends ReadonlyArray<unknown>, const M extends { readonly [I in keyof T]?: `${keyof T & string}` }>(
    self: T,
    mapping: M
  ): { [I in keyof T]: I extends keyof M ? M[I] extends keyof T ? T[M[I]] : T[I] : T[I] }
} = dual(
  2,
  <const T extends ReadonlyArray<unknown>, const M extends { readonly [I in keyof T]?: `${keyof T & string}` }>(
    self: T,
    mapping: M
  ) => {
    return self.map((e, i) => mapping[i] !== undefined ? self[mapping[i]] : e)
  }
)

/**
 * Applies a transformation function to all elements in a tuple.
 *
 * @example
 * ```ts
 * import { Tuple } from "effect"
 *
 * // Used with lambda functions for transforming all elements
 * const tuple = [1, 2, 3] as const
 * // Map applies transformation to each element
 * ```
 *
 * @category Mapping
 * @since 4.0.0
 */
export const map: {
  <L extends Lambda>(
    lambda: L
  ): <const T extends ReadonlyArray<unknown>>(
    self: T
  ) => { [K in keyof T]: Apply<L, T[K]> }
  <const T extends ReadonlyArray<unknown>, L extends Lambda>(
    self: T,
    lambda: L
  ): { [K in keyof T]: Apply<L, T[K]> }
} = dual(
  2,
  <const T extends ReadonlyArray<unknown>, L extends Function>(self: T, lambda: L) => {
    return self.map((e) => lambda(e))
  }
)

/**
 * Applies a transformation function only to the elements at the specified indices.
 *
 * @example
 * ```ts
 * import { Tuple } from "effect"
 *
 * // Transform only elements at specified indices
 * const tuple = [1, 2, 3] as const
 * const indices = [0, 2]
 * // Transforms elements at index 0 and 2 only
 * ```
 *
 * @category Mapping
 * @since 4.0.0
 */
export const mapPick: {
  <const T extends ReadonlyArray<unknown>, const I extends ReadonlyArray<Indices<T>>, L extends Lambda>(
    indices: I,
    lambda: L
  ): (
    self: T
  ) => { [K in keyof T]: K extends `${I[number]}` ? Apply<L, T[K]> : T[K] }
  <const T extends ReadonlyArray<unknown>, const I extends ReadonlyArray<Indices<T>>, L extends Lambda>(
    self: T,
    indices: I,
    lambda: L
  ): { [K in keyof T]: K extends `${I[number]}` ? Apply<L, T[K]> : T[K] }
} = dual(
  3,
  <const T extends ReadonlyArray<unknown>, L extends Function>(
    self: T,
    indices: ReadonlyArray<number>,
    lambda: L
  ) => {
    const toPick = new Set<number>(indices)
    return self.map((e, i) => (toPick.has(i) ? lambda(e) : e))
  }
)

/**
 * Applies a transformation function to all elements except those at the specified indices.
 *
 * @example
 * ```ts
 * import { Tuple } from "effect"
 *
 * // Transform all elements except those at specified indices
 * const tuple = [1, 2, 3] as const
 * const indicesToOmit = [1]
 * // Transforms all elements except index 1
 * ```
 *
 * @category Mapping
 * @since 4.0.0
 */
export const mapOmit: {
  <const T extends ReadonlyArray<unknown>, const I extends ReadonlyArray<Indices<T>>, L extends Lambda>(
    indices: I,
    lambda: L
  ): (
    self: T
  ) => { [K in keyof T]: K extends `${I[number]}` ? T[K] : Apply<L, T[K]> }
  <const T extends ReadonlyArray<unknown>, const I extends ReadonlyArray<Indices<T>>, L extends Lambda>(
    self: T,
    indices: I,
    lambda: L
  ): { [K in keyof T]: K extends `${I[number]}` ? T[K] : Apply<L, T[K]> }
} = dual(
  3,
  <const T extends ReadonlyArray<unknown>, L extends Function>(
    self: T,
    indices: ReadonlyArray<number>,
    lambda: L
  ) => {
    const toOmit = new Set<number>(indices)
    return self.map((e, i) => (toOmit.has(i) ? e : lambda(e)))
  }
)

/**
 * Transforms both elements of a tuple using the given functions.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { mapBoth } from "effect/Tuple"
 *
 * assert.deepStrictEqual(
 *   mapBoth(["hello", 42], { onFirst: s => s.toUpperCase(), onSecond: n => n.toString() }),
 *   ["HELLO", "42"]
 * )
 * ```
 *
 * @category Mapping
 * @since 2.0.0
 */
export const mapBoth: {
  <L1, L2, R1, R2>(options: {
    readonly onFirst: (e: L1) => L2
    readonly onSecond: (a: R1) => R2
  }): (self: readonly [L1, R1]) => [L2, R2]
  <L1, R1, L2, R2>(self: readonly [L1, R1], options: {
    readonly onFirst: (e: L1) => L2
    readonly onSecond: (a: R1) => R2
  }): [L2, R2]
} = dual(
  2,
  <L1, R1, L2, R2>(
    self: readonly [L1, R1],
    { onFirst, onSecond }: {
      readonly onFirst: (e: L1) => L2
      readonly onSecond: (a: R1) => R2
    }
  ): [L2, R2] => [onFirst(self[0]), onSecond(self[1])]
)

/**
 * Transforms the first component of a tuple using a given function.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { mapFirst } from "effect/Tuple"
 *
 * assert.deepStrictEqual(
 *   mapFirst(["hello", 42], s => s.toUpperCase()),
 *   ["HELLO", 42]
 * )
 * ```
 *
 * @category Mapping
 * @since 2.0.0
 */
export const mapFirst: {
  <L1, L2>(f: (left: L1) => L2): <R>(self: readonly [L1, R]) => [L2, R]
  <L1, R, L2>(self: readonly [L1, R], f: (left: L1) => L2): [L2, R]
} = dual(2, <L1, R, L2>(self: readonly [L1, R], f: (left: L1) => L2): [L2, R] => [f(self[0]), self[1]])

/**
 * Transforms the second component of a tuple using a given function.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { mapSecond } from "effect/Tuple"
 *
 * assert.deepStrictEqual(
 *   mapSecond(["hello", 42], n => n.toString()),
 *   ["hello", "42"]
 * )
 * ```
 *
 * @category Mapping
 * @since 2.0.0
 */
export const mapSecond: {
  <R1, R2>(f: (right: R1) => R2): <L>(self: readonly [L, R1]) => [L, R2]
  <L, R1, R2>(self: readonly [L, R1], f: (right: R1) => R2): [L, R2]
} = dual(2, <L, R1, R2>(self: readonly [L, R1], f: (right: R1) => R2): [L, R2] => [self[0], f(self[1])])

/**
 * Swaps the two elements of a tuple.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { flip } from "effect/Tuple"
 *
 * assert.deepStrictEqual(flip(["hello", 42]), [42, "hello"])
 * ```
 *
 * @category Tuple2
 * @since 4.0.0
 */
export const flip = <L, R>(self: readonly [L, R]): [R, L] => [self[1], self[0]]

/**
 * Creates an `Equivalence` for tuples by comparing corresponding elements using the provided `Equivalence`s.
 *
 * @example
 * ```ts
 * import { Tuple, String, Number } from "effect"
 *
 * // Creates an equivalence for tuples with string and number elements
 * const equivalence = Tuple.getEquivalence([String.Equivalence, Number.Equivalence])
 * ```
 *
 * @category Equivalence
 * @since 2.0.0
 */
export const getEquivalence = Equivalence.tuple

/**
 * Creates an `Order` for tuples by comparing corresponding elements using the provided `Order`s.
 *
 * @example
 * ```ts
 * import { Tuple, String, Number } from "effect"
 *
 * // Creates an order for tuples with string and number elements
 * const tupleOrder = Tuple.getOrder([String.Order, Number.Order])
 * ```
 *
 * @category Ordering
 * @since 2.0.0
 */
export const getOrder = order.tuple

export {
  /**
   * Determine if an `Array` is a tuple with exactly `N` elements, narrowing down the type to `TupleOf`.
   *
   * An `Array` is considered to be a `TupleOf` if its length is exactly `N`.
   *
   * @example
   * ```ts
   * import * as assert from "node:assert"
   * import { isTupleOf } from "effect/Tuple"
   *
   * assert.deepStrictEqual(isTupleOf([1, 2, 3], 3), true);
   * assert.deepStrictEqual(isTupleOf([1, 2, 3], 2), false);
   * assert.deepStrictEqual(isTupleOf([1, 2, 3], 4), false);
   *
   * const arr: number[] = [1, 2, 3];
   * if (isTupleOf(arr, 3)) {
   *   console.log(arr);
   *   // ^? [number, number, number]
   * }
   *
   * ```
   * @category Guards
   * @since 3.3.0
   */
  isTupleOf,
  /**
   * Determine if an `Array` is a tuple with at least `N` elements, narrowing down the type to `TupleOfAtLeast`.
   *
   * An `Array` is considered to be a `TupleOfAtLeast` if its length is at least `N`.
   *
   * @example
   * ```ts
   * import * as assert from "node:assert"
   * import { isTupleOfAtLeast } from "effect/Tuple"
   *
   * assert.deepStrictEqual(isTupleOfAtLeast([1, 2, 3], 3), true);
   * assert.deepStrictEqual(isTupleOfAtLeast([1, 2, 3], 2), true);
   * assert.deepStrictEqual(isTupleOfAtLeast([1, 2, 3], 4), false);
   *
   * const arr: number[] = [1, 2, 3, 4];
   * if (isTupleOfAtLeast(arr, 3)) {
   *   console.log(arr);
   *   // ^? [number, number, number, ...number[]]
   * }
   *
   * ```
   * @category Guards
   * @since 3.3.0
   */
  isTupleOfAtLeast
} from "./Predicate.ts"
