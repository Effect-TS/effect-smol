/**
 * This module provides utility functions for working with structs in TypeScript.
 *
 * @since 2.0.0
 */

import * as Equivalence from "./Equivalence.js"
import { dual } from "./Function.js"
import * as order from "./Order.js"

/**
 * @category Type-Level Programming
 * @since 4.0.0
 */
export type Simplify<T> = { [K in keyof T]: T[K] } & {}

/**
 * @category Type-Level Programming
 * @since 4.0.0
 */
export type Mutable<T> = { -readonly [K in keyof T]: T[K] } & {}

/**
 * @category Type-Level Programming
 * @since 4.0.0
 */
export type Merge<T, U> = keyof T & keyof U extends never ? T & U : Omit<T, keyof T & keyof U> & U

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
 * console.log(pipe({ a: "a", b: 1 }, Struct.merge({ b: 2, c: 3 })))
 * // { a: "a", b: 2, c: 3 }
 * ```
 *
 * @since 4.0.0
 */
export const merge: {
  <O extends object>(that: O): <S extends object>(self: S) => Simplify<Merge<S, O>>
  <O extends object, S extends object>(self: S, that: O): Simplify<Merge<S, O>>
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
 *     { a: 'a', b: 1, c: 3 },
 *     Struct.evolve({
 *       a: (a) => a.length,
 *       b: (b) => b * 2
 *     })
 *   )
 * )
 * // { a: 1, b: 2, c: 3 }
 * ```
 *
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
 * Alias of {@link Equivalence.struct}.
 *
 * @example
 * ```ts
 * import { Struct, String, Number } from "effect"
 *
 * const PersonEquivalence = Struct.getEquivalence({
 *   name: String.Equivalence,
 *   age: Number.Equivalence
 * })
 *
 * console.log(PersonEquivalence({ name: "John", age: 25 }, { name: "John", age: 25 }))
 * // true
 *
 * console.log(PersonEquivalence({ name: "John", age: 25 }, { name: "John", age: 40 }))
 * // false
 * ```
 *
 * @category Equivalence
 * @since 2.0.0
 */
export const getEquivalence = Equivalence.struct

/**
 * This function creates and returns a new `Order` for a struct of values based on the given `Order`s
 * for each property in the struct.
 *
 * Alias of {@link order.struct}.
 *
 * @category Ordering
 * @since 2.0.0
 */
export const getOrder = order.struct

/**
 * @category Lambda
 * @since 4.0.0
 */
export interface Lambda {
  readonly "~lambda.in": unknown
  readonly "~lambda.out": unknown
}

/**
 * @category Lambda
 * @since 4.0.0
 */
export type Apply<L extends Lambda, V> = (L & { readonly "~lambda.in": V })["~lambda.out"]

/**
 * @category Lambda
 * @since 4.0.0
 */
export const lambda = <L extends (a: any) => any>(
  f: (a: Parameters<L>[0]) => ReturnType<L>
): L => f as any

/**
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
 * @since 4.0.0
 */
export const mapPick: {
  <S extends object, const Keys extends ReadonlyArray<keyof S>, L extends Lambda>(
    keys: Keys,
    lambda: L
  ): (
    fieldself: S
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
 * @since 4.0.0
 */
export const mapOmit: {
  <S extends object, const Keys extends ReadonlyArray<keyof S>, L extends Lambda>(
    keys: Keys,
    lambda: L
  ): (
    fieldself: S
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
