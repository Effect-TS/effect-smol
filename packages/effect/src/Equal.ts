/**
 * This module provides functionality for defining and working with equality between values.
 * It includes the `Equal` interface for types that can determine equality with other values
 * of the same type, and utilities for comparing values.
 *
 * @since 2.0.0
 */
import type { Equivalence } from "./Equivalence.js"
import * as Hash from "./Hash.js"
import { hasProperty } from "./Predicate.js"

/**
 * The unique symbol used to identify objects that implement the `Equal` interface.
 *
 * @example
 * ```ts
 * import { Equal, Hash } from "effect"
 *
 * class Person implements Equal.Equal {
 *   constructor(private name: string, private age: number) {}
 *
 *   [Equal.symbol](that: Equal.Equal): boolean {
 *     return that instanceof Person &&
 *            this.name === that.name &&
 *            this.age === that.age
 *   }
 *
 *   [Hash.symbol](): number {
 *     return Hash.string(this.name) + this.age
 *   }
 * }
 * ```
 *
 * @category symbols
 * @since 2.0.0
 */
export const symbol: "~effect/Equal" = "~effect/Equal" as const

/**
 * An interface defining objects that can determine equality with other `Equal` objects.
 * Objects implementing this interface must also implement `Hash` for consistency.
 *
 * @example
 * ```ts
 * import { Equal, Hash } from "effect"
 *
 * class Coordinate implements Equal.Equal {
 *   constructor(readonly x: number, readonly y: number) {}
 *
 *   [Equal.symbol](that: Equal.Equal): boolean {
 *     return that instanceof Coordinate &&
 *            this.x === that.x &&
 *            this.y === that.y
 *   }
 *
 *   [Hash.symbol](): number {
 *     return Hash.string(`${this.x},${this.y}`)
 *   }
 * }
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export interface Equal extends Hash.Hash {
  [symbol](that: Equal): boolean
}

/**
 * Compares two values for equality. Returns `true` if the values are equal, `false` otherwise.
 *
 * For objects implementing the `Equal` interface, uses their custom equality logic.
 * For `Date` objects, compares their ISO string representations.
 * For other values, uses reference equality and type checking.
 *
 * @example
 * ```ts
 * import { Equal } from "effect"
 *
 * // Basic equality
 * console.log(Equal.equals(1, 1)) // true
 * console.log(Equal.equals(1, 2)) // false
 *
 * // Date equality
 * const date1 = new Date("2023-01-01")
 * const date2 = new Date("2023-01-01")
 * console.log(Equal.equals(date1, date2)) // true
 *
 * // Curried version
 * const isEqualTo5 = Equal.equals(5)
 * console.log(isEqualTo5(5)) // true
 * console.log(isEqualTo5(3)) // false
 * ```
 *
 * @category equality
 * @since 2.0.0
 */
export function equals<B>(that: B): <A>(self: A) => boolean
export function equals<A, B>(self: A, that: B): boolean
export function equals(): any {
  if (arguments.length === 1) {
    return (self: unknown) => compareBoth(self, arguments[0])
  }
  return compareBoth(arguments[0], arguments[1])
}

function compareBoth(self: unknown, that: unknown): boolean {
  if (self === that) {
    return true
  }
  const selfType = typeof self
  if (selfType !== typeof that) {
    return false
  }
  if (selfType === "object" || selfType === "function") {
    if (self !== null && that !== null) {
      if (isEqual(self) && isEqual(that)) {
        return Hash.hash(self) === Hash.hash(that) && self[symbol](that)
      } else if (self instanceof Date && that instanceof Date) {
        return self.toISOString() === that.toISOString()
      }
    }
  }
  return false
}

/**
 * Determines if a value implements the `Equal` interface.
 *
 * @example
 * ```ts
 * import { Equal, Hash } from "effect"
 *
 * class MyClass implements Equal.Equal {
 *   [Equal.symbol](that: Equal.Equal): boolean {
 *     return that instanceof MyClass
 *   }
 *   [Hash.symbol](): number {
 *     return 0
 *   }
 * }
 *
 * const instance = new MyClass()
 * console.log(Equal.isEqual(instance)) // true
 * console.log(Equal.isEqual({})) // false
 * console.log(Equal.isEqual(42)) // false
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isEqual = (u: unknown): u is Equal => hasProperty(u, symbol)

/**
 * Creates an `Equivalence` instance using the `equals` function.
 * This allows the equality logic to be used with APIs that expect an `Equivalence`.
 *
 * @example
 * ```ts
 * import { Equal, Array } from "effect"
 *
 * const eq = Equal.equivalence<number>()
 * const result = Array.dedupeWith([1, 2, 2, 3, 1], eq)
 * console.log(result) // [1, 2, 3]
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const equivalence: <A>() => Equivalence<A> = () => equals
