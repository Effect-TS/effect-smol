/**
 * This module provides utility functions for working with structs in TypeScript.
 *
 * @since 2.0.0
 */

import * as Combiner from "./Combiner.ts"
import * as Equivalence from "./Equivalence.ts"
import { dual } from "./Function.ts"
import * as order from "./Order.ts"
import * as Reducer from "./Reducer.ts"

/**
 * A utility type that simplifies the appearance of a type by flattening intersection types.
 *
 * @example
 * ```ts
 * import type { Struct } from "effect"
 *
 * type Original = { a: string } & { b: number }
 * type Simplified = Struct.Simplify<Original>
 * // Result: { a: string; b: number }
 * ```
 *
 * @category Type-Level Programming
 * @since 4.0.0
 */
export type Simplify<T> = { [K in keyof T]: T[K] } & {}

/**
 * A utility type that removes readonly modifiers from all properties of an object type.
 *
 * @example
 * ```ts
 * import type { Struct } from "effect"
 *
 * type ReadOnly = { readonly a: string; readonly b: number }
 * type Mutable = Struct.Mutable<ReadOnly>
 * // Result: { a: string; b: number }
 * ```
 *
 * @category Type-Level Programming
 * @since 4.0.0
 */
export type Mutable<T> = { -readonly [K in keyof T]: T[K] } & {}

/**
 * A utility type that merges two object types, with properties from the second
 * type taking precedence (similar to `Object.assign`).
 *
 * @example
 * ```ts
 * import type { Struct } from "effect"
 *
 * type A = { a: string; b: number }
 * type B = { b: boolean; c: string }
 * type Merged = Struct.Assign<A, B>
 * // Result: { a: string; b: boolean; c: string }
 * ```
 *
 * @category Type-Level Programming
 * @since 4.0.0
 */
export type Assign<T, U> = keyof T & keyof U extends never ? T & U : Omit<T, keyof T & keyof U> & U

/**
 * Retrieves the value associated with the specified key from a struct.
 *
 * @example
 * ```ts
 * import { pipe, Struct } from "effect"
 *
 * console.log(pipe({ a: 1, b: 2 }, Struct.get("a")))
 * // 1
 * ```
 *
 * @category Getters
 * @since 2.0.0
 */
export const get: {
  <S extends object, const K extends keyof S>(key: K): (self: S) => S[K]
  <S extends object, const K extends keyof S>(self: S, key: K): S[K]
} = dual(2, <S extends object, const K extends keyof S>(self: S, key: K): S[K] => self[key])

/**
 * Retrieves the object keys that are strings in a typed manner
 *
 * @example
 * ```ts
 * import { Struct } from "effect"
 *
 * const value = {
 *   a: 1,
 *   b: 2,
 *   [Symbol.for("c")]: 3
 * }
 *
 * const keys: Array<"a" | "b"> = Struct.keys(value)
 *
 * console.log(keys)
 * // ["a", "b"]
 * ```
 *
 * @category Key utilities
 * @since 3.6.0
 */
export const keys = <S extends object>(self: S): Array<(keyof S) & string> =>
  Object.keys(self) as Array<(keyof S) & string>

/**
 * Create a new object by picking properties of an existing object.
 *
 * @example
 * ```ts
 * import { pipe, Struct } from "effect"
 *
 * console.log(pipe({ a: "a", b: 1, c: true }, Struct.pick(["a", "b"])))
 * // { a: "a", b: 1 }
 * ```
 *
 * @category filtering
 * @since 2.0.0
 */
export const pick: {
  <S extends object, const Keys extends ReadonlyArray<keyof S>>(keys: Keys): (self: S) => Pick<S, Keys[number]>
  <S extends object, const Keys extends ReadonlyArray<keyof S>>(self: S, keys: Keys): Pick<S, Keys[number]>
} = dual(
  2,
  <S extends object, const Keys extends ReadonlyArray<keyof S>>(self: S, keys: Keys) => {
    return buildStruct(self, (k, v) => (keys.includes(k) ? [k, v] : undefined))
  }
)

/**
 * Create a new object by omitting properties of an existing object.
 *
 * @example
 * ```ts
 * import { pipe, Struct } from "effect"
 *
 * console.log(pipe({ a: "a", b: 1, c: true }, Struct.omit(["c"])))
 * // { a: "a", b: 1 }
 * ```
 *
 * @category filtering
 * @since 2.0.0
 */
export const omit: {
  <S extends object, const Keys extends ReadonlyArray<keyof S>>(keys: Keys): (self: S) => Omit<S, Keys[number]>
  <S extends object, const Keys extends ReadonlyArray<keyof S>>(self: S, keys: Keys): Omit<S, Keys[number]>
} = dual(
  2,
  <S extends object, Keys extends ReadonlyArray<keyof S>>(self: S, keys: Keys) => {
    return buildStruct(self, (k, v) => (!keys.includes(k) ? [k, v] : undefined))
  }
)

/**
 * Merges two structs into a new struct.
 *
 * If the two structs have the same key, the value from the second struct will be used.
 *
 * @example
 * ```ts
 * import { pipe, Struct } from "effect"
 *
 * console.log(pipe({ a: "a", b: 1 }, Struct.assign({ b: 2, c: 3 })))
 * // { a: "a", b: 2, c: 3 }
 * ```
 *
 * @category combining
 * @since 4.0.0
 */
export const assign: {
  <O extends object>(that: O): <S extends object>(self: S) => Simplify<Assign<S, O>>
  <O extends object, S extends object>(self: S, that: O): Simplify<Assign<S, O>>
} = dual(
  2,
  <O extends object, S extends object>(self: S, that: O) => {
    return { ...self, ...that }
  }
)

type Evolver<S> = { readonly [K in keyof S]?: (a: S[K]) => unknown }

type Evolved<S, E> = Simplify<
  { [K in keyof S]: K extends keyof E ? (E[K] extends (...a: any) => infer R ? R : S[K]) : S[K] }
>

/**
 * Transforms the values of a Struct provided a transformation function for each
 * key. If no transformation function is provided for a key, it will return the
 * origional value for that key.
 *
 * @example
 * ```ts
 * import { pipe, Struct } from "effect"
 *
 * console.log(
 *   pipe(
 *     { a: "a", b: 1, c: 3 },
 *     Struct.evolve({
 *       a: (a) => a.length,
 *       b: (b) => b * 2
 *     })
 *   )
 * )
 * // { a: 1, b: 2, c: 3 }
 * ```
 *
 * @category transforming
 * @since 2.0.0
 */
export const evolve: {
  <S extends object, E extends Evolver<S>>(e: E): (self: S) => Evolved<S, E>
  <S extends object, E extends Evolver<S>>(self: S, e: E): Evolved<S, E>
} = dual(
  2,
  <S extends object, E extends Evolver<S>>(self: S, e: E): Evolved<S, E> => {
    return buildStruct(self, (k, v) => [k, Object.hasOwn(e, k) ? (e as any)[k](v) : v])
  }
)

type KeyEvolver<S> = { readonly [K in keyof S]?: (k: K) => PropertyKey }

type KeyEvolved<S, E> = Simplify<
  { [K in keyof S as K extends keyof E ? (E[K] extends ((k: K) => infer R extends PropertyKey) ? R : K) : K]: S[K] }
>

/**
 * Transforms the keys of a struct using the provided transformation functions.
 *
 * @example
 * ```ts
 * import { pipe, Struct } from "effect"
 *
 * const result = pipe(
 *   { a: 1, b: 2 },
 *   Struct.evolveKeys({
 *     a: (key) => key.toUpperCase(),
 *     b: (key) => `prefix_${key}`
 *   })
 * )
 * console.log(result)
 * // { A: 1, prefix_b: 2 }
 * ```
 *
 * @category Key utilities
 * @since 4.0.0
 */
export const evolveKeys: {
  <S extends object, E extends KeyEvolver<S>>(e: E): (self: S) => KeyEvolved<S, E>
  <S extends object, E extends KeyEvolver<S>>(self: S, e: E): KeyEvolved<S, E>
} = dual(
  2,
  <S extends object, E extends KeyEvolver<S>>(self: S, e: E): KeyEvolved<S, E> => {
    return buildStruct(self, (k, v) => [Object.hasOwn(e, k) ? (e as any)[k](k) : k, v])
  }
)

type EntryEvolver<S> = { readonly [K in keyof S]?: (k: K, v: S[K]) => [PropertyKey, unknown] }

type EntryEvolved<S, E> = {
  [
    K in keyof S as K extends keyof E ?
      E[K] extends ((k: K, v: S[K]) => [infer NK extends PropertyKey, infer _V]) ? NK : K
      : K
  ]: K extends keyof E ? E[K] extends ((k: K, v: S[K]) => [infer _NK, infer V]) ? V
    : S[K] :
    S[K]
}

/**
 * Transforms both keys and values of a struct using the provided transformation functions.
 *
 * @example
 * ```ts
 * import { pipe, Struct } from "effect"
 *
 * const result = pipe(
 *   { a: 1, b: 2 },
 *   Struct.evolveEntries({
 *     a: (key, value) => [key.toUpperCase(), value * 2],
 *     b: (key, value) => [`prefix_${key}`, value.toString()]
 *   })
 * )
 * console.log(result)
 * // { A: 2, prefix_b: "2" }
 * ```
 *
 * @category Utilities
 * @since 4.0.0
 */
export const evolveEntries: {
  <S extends object, E extends EntryEvolver<S>>(e: E): (self: S) => EntryEvolved<S, E>
  <S extends object, E extends EntryEvolver<S>>(self: S, e: E): EntryEvolved<S, E>
} = dual(
  2,
  <S extends object, E extends EntryEvolver<S>>(self: S, e: E): EntryEvolved<S, E> => {
    return buildStruct(self, (k, v) => (Object.hasOwn(e, k) ? (e as any)[k](k, v) : [k, v]))
  }
)

/**
 * Renames keys in a struct using the provided key mapping.
 *
 * @example
 * ```ts
 * import { pipe, Struct } from "effect"
 *
 * const result = pipe(
 *   { a: 1, b: 2, c: 3 },
 *   Struct.renameKeys({ a: "x", b: "y" })
 * )
 * console.log(result)
 * // { x: 1, y: 2, c: 3 }
 * ```
 *
 * @category Key utilities
 * @since 4.0.0
 */
export const renameKeys: {
  <S extends object, const M extends { readonly [K in keyof S]?: PropertyKey }>(
    mapping: M
  ): (self: S) => { [K in keyof S as K extends keyof M ? M[K] extends PropertyKey ? M[K] : K : K]: S[K] }
  <S extends object, const M extends { readonly [K in keyof S]?: PropertyKey }>(
    self: S,
    mapping: M
  ): { [K in keyof S as K extends keyof M ? M[K] extends PropertyKey ? M[K] : K : K]: S[K] }
} = dual(2, <S extends object, const M extends { readonly [K in keyof S]?: PropertyKey }>(self: S, mapping: M) => {
  return buildStruct(self, (k, v) => [Object.hasOwn(mapping, k) ? mapping[k]! : k, v])
})

/**
 * Given a struct of `Equivalence`s returns a new `Equivalence` that compares values of a struct
 * by applying each `Equivalence` to the corresponding property of the struct.
 *
 * Alias of {@link Equivalence.Struct}.
 *
 * @example
 * ```ts
 * import { Equivalence, Struct } from "effect"
 *
 * const PersonEquivalence = Struct.makeEquivalence({
 *   name: Equivalence.strictEqual<string>(),
 *   age: Equivalence.strictEqual<number>()
 * })
 *
 * console.log(
 *   PersonEquivalence({ name: "John", age: 25 }, { name: "John", age: 25 })
 * )
 * // true
 *
 * console.log(
 *   PersonEquivalence({ name: "John", age: 25 }, { name: "John", age: 40 })
 * )
 * // false
 * ```
 *
 * @category Equivalence
 * @since 2.0.0
 */
export const makeEquivalence = Equivalence.Struct

/**
 * Creates an `Order` for a struct of values based on the given `Order`s for each property.
 *
 * Alias of {@link order.Struct}.
 *
 * @example
 * ```ts
 * import { Struct } from "effect"
 * import * as N from "effect/Number"
 * import * as S from "effect/String"
 *
 * const PersonOrder = Struct.makeOrder({
 *   name: S.Order,
 *   age: N.Order
 * })
 *
 * const person1 = { name: "Alice", age: 30 }
 * const person2 = { name: "Bob", age: 25 }
 *
 * console.log(PersonOrder(person1, person2))
 * // -1 (person1 comes before person2)
 * ```
 *
 * @category Ordering
 * @since 2.0.0
 */
export const makeOrder = order.Struct

/**
 * A higher-kinded type interface for representing type-level functions.
 *
 * @example
 * ```ts
 * import type { Struct } from "effect"
 *
 * // Lambda is used internally for type-level operations
 * type MyLambda = Struct.Lambda
 * ```
 *
 * @category Lambda
 * @since 4.0.0
 */
export interface Lambda {
  readonly "~lambda.in": unknown
  readonly "~lambda.out": unknown
}

/**
 * Applies a type-level function to a value type.
 *
 * @example
 * ```ts
 * import type { Struct } from "effect"
 *
 * // Applied to a concrete lambda type
 * type StringToNumber = Struct.Lambda & {
 *   readonly "~lambda.in": string
 *   readonly "~lambda.out": number
 * }
 * type Result = Struct.Apply<StringToNumber, string>
 * // Result: number
 * ```
 *
 * @category Lambda
 * @since 4.0.0
 */
export type Apply<L extends Lambda, V> = (L & { readonly "~lambda.in": V })["~lambda.out"]

/**
 * Creates a type-level function that can be used with struct mapping operations.
 *
 * @example
 * ```ts
 * import { Struct } from "effect"
 *
 * const toString = (n: number) => n.toString()
 * const lambdaFn = Struct.lambda(toString)
 * ```
 *
 * @category Lambda
 * @since 4.0.0
 */
export const lambda = <L extends (a: any) => any>(
  f: (a: Parameters<L>[0]) => ReturnType<L>
): L => f as any

/**
 * Applies a transformation function to all values in a struct.
 *
 * @example
 * ```ts
 * // Used with lambda functions for type-level operations
 * const original = { a: 1, b: 2, c: 3 }
 * // Map transforms all values using the provided lambda
 * ```
 *
 * @category Mapping
 * @since 4.0.0
 */
export const map: {
  <L extends Lambda>(
    lambda: L
  ): <S extends object>(self: S) => { [K in keyof S]: Apply<L, S[K]> }
  <S extends object, L extends Lambda>(
    self: S,
    lambda: L
  ): { [K in keyof S]: Apply<L, S[K]> }
} = dual(
  2,
  <S extends object, L extends Function>(self: S, lambda: L) => {
    return buildStruct(self, (k, v) => [k, lambda(v)])
  }
)

/**
 * Applies a transformation function only to the specified keys in a struct.
 *
 * @example
 * ```ts
 * // Used with lambda functions for selective transformation
 * const data = { a: 1, b: 2, c: 3 }
 * const keys = ["a", "c"]
 * // Transforms only the specified keys
 * ```
 *
 * @category Mapping
 * @since 4.0.0
 */
export const mapPick: {
  <S extends object, const Keys extends ReadonlyArray<keyof S>, L extends Lambda>(
    keys: Keys,
    lambda: L
  ): (
    self: S
  ) => { [K in keyof S]: K extends Keys[number] ? Apply<L, S[K]> : S[K] }
  <S extends object, const Keys extends ReadonlyArray<keyof S>, L extends Lambda>(
    self: S,
    keys: Keys,
    lambda: L
  ): { [K in keyof S]: K extends Keys[number] ? Apply<L, S[K]> : S[K] }
} = dual(
  3,
  <S extends object, const Keys extends ReadonlyArray<keyof S>, L extends Function>(
    self: S,
    keys: Keys,
    lambda: L
  ) => {
    return buildStruct(self, (k, v) => [k, keys.includes(k) ? lambda(v) : v])
  }
)

/**
 * Applies a transformation function to all keys except the specified ones in a struct.
 *
 * @example
 * ```ts
 * // Used with lambda functions for selective omission
 * const source = { a: 1, b: 2, c: 3 }
 * const keysToOmit = ["b"]
 * // Transforms all keys except the omitted ones
 * ```
 *
 * @category Mapping
 * @since 4.0.0
 */
export const mapOmit: {
  <S extends object, const Keys extends ReadonlyArray<keyof S>, L extends Lambda>(
    keys: Keys,
    lambda: L
  ): (
    self: S
  ) => { [K in keyof S]: K extends Keys[number] ? S[K] : Apply<L, S[K]> }
  <S extends object, const Keys extends ReadonlyArray<keyof S>, L extends Lambda>(
    self: S,
    keys: Keys,
    lambda: L
  ): { [K in keyof S]: K extends Keys[number] ? S[K] : Apply<L, S[K]> }
} = dual(
  3,
  <S extends object, const Keys extends ReadonlyArray<keyof S>, L extends Function>(
    self: S,
    keys: Keys,
    lambda: L
  ) => {
    return buildStruct(self, (k, v) => [k, !keys.includes(k) ? lambda(v) : v])
  }
)

/**
 * Walk `source`; for each key decide what to emit via the small callback.
 *
 * The callback returns either
 *   • `undefined`  → nothing is copied, or
 *   • `[newKey, newVal]`
 *
 * so every public API just supplies a different callback.
 */
function buildStruct<
  S extends object,
  f extends (k: keyof S, v: S[keyof S]) => [PropertyKey, unknown] | undefined
>(
  source: S,
  f: f
): any {
  const out: Record<PropertyKey, unknown> = {}
  for (const k in source) {
    const res = f(k, source[k])
    if (res) {
      const [nk, nv] = res
      out[nk] = nv
    }
  }
  return out
}

/**
 * Creates a `Combiner` for a struct shape.
 *
 * Each property is combined using its corresponding property-specific
 * `Combiner`. Optionally, properties can be omitted from the result when the
 * merged value matches `omitKeyWhen`.
 *
 * By default the returned type is mutable. You can control this by adding an
 * explicit type annotation.
 *
 * **Example**
 *
 * ```ts
 * import { Number, String, Struct } from "effect"
 *
 * const C = Struct.makeCombiner<{ readonly n: number; readonly s: string }>({
 *   n: Number.ReducerSum,
 *   s: String.ReducerConcat
 * })
 * ```
 *
 * @since 4.0.0
 */
export function makeCombiner<A>(
  combiners: { readonly [K in keyof A]: Combiner.Combiner<A[K]> },
  options?: {
    readonly omitKeyWhen?: ((a: A[keyof A]) => boolean) | undefined
  }
): Combiner.Combiner<A> {
  const omitKeyWhen = options?.omitKeyWhen ?? (() => false)
  return Combiner.make((self, that) => {
    const keys = Reflect.ownKeys(combiners) as Array<keyof A>
    const out = {} as A
    for (const key of keys) {
      const merge = combiners[key].combine(self[key], that[key])
      if (omitKeyWhen(merge)) continue
      out[key] = merge
    }
    return out
  })
}

/**
 * Creates a `Reducer` for a struct (object) shape.
 *
 * Each property is combined using its corresponding property-specific
 * `Reducer`. Optionally, properties can be omitted from the result when the
 * merged value matches `omitKeyWhen`.
 *
 * The initial value is computed by combining the initial values of the
 * properties that are not omitted.
 *
 * By default the returned type is mutable. You can control this by adding an
 * explicit type annotation.
 *
 * **Example**
 *
 * ```ts
 * import { Number, String, Struct } from "effect"
 *
 * const R = Struct.makeReducer<{ readonly n: number; readonly s: string }>({
 *   n: Number.ReducerSum,
 *   s: String.ReducerConcat
 * })
 * ```
 *
 * @since 4.0.0
 */
export function makeReducer<A>(
  reducers: { readonly [K in keyof A]: Reducer.Reducer<A[K]> },
  options?: {
    readonly omitKeyWhen?: ((a: A[keyof A]) => boolean) | undefined
  }
): Reducer.Reducer<A> {
  const combine = makeCombiner(reducers, options).combine
  const initialValue = {} as A
  for (const key of Reflect.ownKeys(reducers) as Array<keyof A>) {
    const iv = reducers[key].initialValue
    if (options?.omitKeyWhen?.(iv)) continue
    initialValue[key] = iv
  }
  return Reducer.make(combine, initialValue)
}
