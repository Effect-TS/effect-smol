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
 * @since 2.0.0
 */
export const get = <const S extends object, const K extends keyof S>(key: K) => (s: S): S[K] => s[key]

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
export const keys = <const S extends object>(s: S): Array<(keyof S) & string> =>
  Object.keys(s) as Array<(keyof S) & string>

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
  <const S extends object, const Keys extends ReadonlyArray<keyof S>>(keys: Keys): (s: S) => Pick<S, Keys[number]>
  <const S extends object, const Keys extends ReadonlyArray<keyof S>>(s: S, keys: Keys): Pick<S, Keys[number]>
} = dual(
  2,
  <const S extends object, const Keys extends ReadonlyArray<keyof S>>(s: S, keys: Keys) => {
    const out: any = {}
    for (const k of keys) {
      if (Object.hasOwn(s, k)) {
        out[k] = (s as any)[k]
      }
    }
    return out
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
  <const S extends object, const Keys extends ReadonlyArray<keyof S>>(keys: Keys): (s: S) => Omit<S, Keys[number]>
  <const S extends object, const Keys extends ReadonlyArray<keyof S>>(s: S, keys: Keys): Omit<S, Keys[number]>
} = dual(
  2,
  <const S extends object, Keys extends ReadonlyArray<keyof S>>(s: S, keys: Keys) => {
    const out: any = { ...s }
    for (const k of keys) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete out[k]
    }
    return out
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
  <const O extends object>(o: O): <const S extends object>(s: S) => Simplify<Merge<S, O>>
  <const S extends object, const O extends object>(s: S, o: O): Simplify<Merge<S, O>>
} = dual(
  2,
  <const S extends object, const O extends object>(s: S, o: O) => {
    return { ...s, ...o }
  }
)

type Evolver<O> = { readonly [K in keyof O]?: (a: O[K]) => unknown }

type Evolved<O, E> = {
  [K in keyof O]: K extends keyof E ? (E[K] extends (...a: any) => infer R ? R : O[K]) : O[K]
}

/**
 * Transforms the values of a Struct provided a transformation function for each key.
 * If no transformation function is provided for a key, it will return the origional value for that key.
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
  <const O extends object, const E extends Evolver<O>>(e: E): (o: O) => Evolved<O, E>
  <const O extends object, const E extends Evolver<O>>(o: O, e: E): Evolved<O, E>
} = dual(
  2,
  <const O extends object, const E extends Evolver<O>>(o: O, e: E): Evolved<O, E> => {
    const out: any = { ...o }
    for (const k in e) {
      if (Object.hasOwn(o, k)) {
        out[k] = e[k]!(out[k])
      }
    }
    return out
  }
)

type KeyEvolver<O> = { readonly [K in keyof O]?: (k: K) => PropertyKey }

type KeyEvolved<O, E> = {
  [K in keyof O as K extends keyof E ? (E[K] extends ((k: K) => infer R extends PropertyKey) ? R : K) : K]: O[K]
}

/**
 * @category Key utilities
 * @since 4.0.0
 */
export const evolveKeys: {
  <const O extends object, const E extends KeyEvolver<O>>(e: E): (o: O) => KeyEvolved<O, E>
  <const O extends object, const E extends KeyEvolver<O>>(o: O, e: E): KeyEvolved<O, E>
} = dual(
  2,
  <const O extends object, const E extends KeyEvolver<O>>(o: O, e: E): KeyEvolved<O, E> => {
    const out: any = {}
    for (const k in o) {
      if (Object.hasOwn(e, k)) {
        out[e[k]!(k)] = o[k]
      } else {
        out[k] = o[k]
      }
    }
    return out
  }
)

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
 * @category combinators
 * @since 2.0.0
 */
export const getEquivalence = Equivalence.struct

/**
 * This function creates and returns a new `Order` for a struct of values based on the given `Order`s
 * for each property in the struct.
 *
 * Alias of {@link order.struct}.
 *
 * @category combinators
 * @since 2.0.0
 */
export const getOrder = order.struct
