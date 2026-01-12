/**
 * This module provides utility functions for working with tuples in TypeScript.
 *
 * @since 2.0.0
 */
import * as Combiner from "./Combiner.ts"
import * as Equivalence from "./Equivalence.ts"
import { dual } from "./Function.ts"
import * as order from "./Order.ts"
import * as Reducer from "./Reducer.ts"
import type { Apply, Lambda } from "./Struct.ts"

/**
 * Constructs a new tuple from the provided values.
 *
 * @example
 * ```ts
 * import { make } from "effect/Tuple"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(make(1, "hello", true), [1, "hello", true])
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
 * console.log(Tuple.get([1, true, "hello"], 2))
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
 * // Transform specific elements by index
 * const evolveOriginal = ["hello", 42, true]
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
 * // Example demonstrates index remapping concept
 * const renameOriginal = ["a", "b", "c"]
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
 * // Used with lambda functions for transforming all elements
 * const mapTuple = [1, 2, 3] as const
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
 * // Transform only elements at specified indices
 * const pickTuple = [1, 2, 3] as const
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
 * // Transform all elements except those at specified indices
 * const omitTuple = [1, 2, 3] as const
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
 * Creates an `Equivalence` for tuples by comparing corresponding elements using the provided `Equivalence`s.
 *
 * @example
 * ```ts
 * import { Equivalence, Tuple } from "effect"
 *
 * // Creates an equivalence for tuples with string and number elements
 * const equivalence = Tuple.makeEquivalence([
 *   Equivalence.strictEqual<string>(),
 *   Equivalence.strictEqual<number>()
 * ])
 * ```
 *
 * @category Equivalence
 * @since 2.0.0
 */
export const makeEquivalence = Equivalence.Tuple

/**
 * Creates an `Order` for tuples by comparing corresponding elements using the provided `Order`s.
 *
 * @example
 * ```ts
 * import { Tuple } from "effect"
 * import * as N from "effect/Number"
 * import * as S from "effect/String"
 *
 * // Creates an order for tuples with string and number elements
 * const tupleOrder = Tuple.makeOrder([S.Order, N.Order])
 * ```
 *
 * @category Ordering
 * @since 2.0.0
 */
export const makeOrder = order.Tuple

export {
  /**
   * Determine if an `Array` is a tuple with exactly `N` elements, narrowing down the type to `TupleOf`.
   *
   * An `Array` is considered to be a `TupleOf` if its length is exactly `N`.
   *
   * @example
   * ```ts
   * import { isTupleOf } from "effect/Tuple"
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
   * import { isTupleOfAtLeast } from "effect/Tuple"
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
   * @category Guards
   * @since 3.3.0
   */
  isTupleOfAtLeast
} from "./Predicate.ts"

/**
 * Creates a `Combiner` for a tuple shape.
 *
 * Each element is combined using its corresponding element-specific
 * `Combiner`. Optionally, elements can be omitted from the result when the
 * merged value matches `omitKeyWhen`.
 *
 * By default the returned type is mutable. You can control this by adding an
 * explicit type annotation.
 *
 * **Example**
 *
 * ```ts
 * import { Number, String, Tuple } from "effect"
 *
 * const C = Tuple.makeCombiner<readonly [number, string]>([
 *   Number.ReducerSum,
 *   String.ReducerConcat
 * ])
 * ```
 *
 * @since 4.0.0
 */
export function makeCombiner<A extends ReadonlyArray<unknown>>(
  combiners: { readonly [K in keyof A]: Combiner.Combiner<A[K]> }
): Combiner.Combiner<A> {
  return Combiner.make((self, that) => {
    const out = []
    for (let i = 0; i < self.length; i++) {
      out.push(combiners[i].combine(self[i], that[i]))
    }
    return out as any
  })
}

/**
 * Creates a `Reducer` for a tuple shape.
 *
 * Each element is combined using its corresponding element-specific
 * `Reducer`. Optionally, elements can be omitted from the result when the
 * merged value matches `omitKeyWhen`.
 *
 * The initial value is computed by combining the initial values of the
 * elements that are not omitted.
 *
 * By default the returned type is mutable. You can control this by adding an
 * explicit type annotation.
 *
 * **Example**
 *
 * ```ts
 * import { Number, String, Tuple } from "effect"
 *
 * const R = Tuple.makeReducer<readonly [number, string]>([
 *   Number.ReducerSum,
 *   String.ReducerConcat
 * ])
 * ```
 *
 * @since 4.0.0
 */
export function makeReducer<A extends ReadonlyArray<unknown>>(
  reducers: { readonly [K in keyof A]: Reducer.Reducer<A[K]> }
): Reducer.Reducer<A> {
  const combine = makeCombiner(reducers).combine
  const initialValue = []
  for (let i = 0; i < reducers.length; i++) {
    initialValue.push(reducers[i].initialValue)
  }
  return Reducer.make(combine, initialValue as unknown as A)
}
