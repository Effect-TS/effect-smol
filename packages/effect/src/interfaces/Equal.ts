/**
 * This module provides functionality for defining and working with equality between values.
 * It includes the `Equal` interface for types that can determine equality with other values
 * of the same type, and utilities for comparing values.
 *
 * @since 2.0.0
 */
import type { Equivalence } from "../data/Equivalence.ts"
import { hasProperty } from "../data/Predicate.ts"
import * as Hash from "../interfaces/Hash.ts"
import { instanceEqualityRegistry, isPlainObject } from "../internal/equal.ts"

/**
 * The unique identifier used to identify objects that implement the `Equal` interface.
 *
 * @since 2.0.0
 */
export const symbol = "~effect/interfaces/Equal"

/**
 * An interface defining objects that can determine equality with other `Equal` objects.
 * Objects implementing this interface must also implement `Hash` for consistency.
 *
 * @example
 * ```ts
 * import { Equal, Hash } from "effect/interfaces"
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
 * import { Equal } from "effect/interfaces"
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
  // Special case for NaN: NaN should be considered equal to NaN
  if (typeof self === "number" && typeof that === "number" && self !== self && that !== that) {
    return true
  }
  const selfType = typeof self
  if (selfType !== typeof that) {
    return false
  }
  const selfHash = Hash.hash(self)
  const thatHash = Hash.hash(that)
  if (selfHash !== thatHash) {
    return false
  }
  if (selfType === "object" || selfType === "function") {
    if (self !== null && that !== null) {
      // Check if either object is marked for instance equality
      if (
        ((typeof self === "object" || typeof self === "function") && instanceEqualityRegistry.has(self)) ||
        ((typeof that === "object" || typeof that === "function") && instanceEqualityRegistry.has(that))
      ) {
        return false // Use reference equality (self === that already checked above)
      }
      if (isEqual(self) && isEqual(that)) {
        return self[symbol](that)
      } else if (self instanceof Date && that instanceof Date) {
        return self.toISOString() === that.toISOString()
      } else if (Array.isArray(self) && Array.isArray(that)) {
        return compareArrays(self, that)
      } else if (isPlainObject(self) && isPlainObject(that)) {
        return compareObjects(self, that)
      }
    }
  }
  return false
}

function compareArrays(self: Array<unknown>, that: Array<unknown>): boolean {
  if (self.length !== that.length) {
    return false
  }
  for (let i = 0; i < self.length; i++) {
    if (!compareBoth(self[i], that[i])) {
      return false
    }
  }
  return true
}

function compareObjects(self: Record<string, unknown>, that: Record<string, unknown>): boolean {
  const selfKeys = Object.keys(self)
  const thatKeys = Object.keys(that)

  if (selfKeys.length !== thatKeys.length) {
    return false
  }

  for (const key of selfKeys) {
    if (!Object.prototype.hasOwnProperty.call(that, key)) {
      return false
    }
    if (!compareBoth(self[key], that[key])) {
      return false
    }
  }

  return true
}

/**
 * Determines if a value implements the `Equal` interface.
 *
 * @example
 * ```ts
 * import { Equal, Hash } from "effect/interfaces"
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
 * import { Equal } from "effect/interfaces"
 * import { Array } from "effect/collections"
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

/**
 * Marks an object or function to use instance (reference) equality instead of structural equality.
 *
 * By default, plain objects and arrays use structural equality. This function allows
 * you to opt specific objects or functions back to reference equality for performance or semantic reasons.
 *
 * @example
 * ```ts
 * import { Equal } from "effect/interfaces"
 *
 * const obj1 = { a: 1, b: 2 }
 * const obj2 = { a: 1, b: 2 }
 *
 * // Normal structural equality
 * console.log(Equal.equals(obj1, obj2)) // true
 *
 * // Mark obj1 for instance equality
 * Equal.useInstanceEquality(obj1)
 * console.log(Equal.equals(obj1, obj2)) // false (now uses reference equality)
 * console.log(Equal.equals(obj1, obj1)) // true (same reference)
 *
 * // Works with functions too
 * const fn1 = () => 42
 * const fn2 = () => 42
 * Equal.useInstanceEquality(fn1)
 * console.log(Equal.equals(fn1, fn2)) // false (reference equality)
 * console.log(Equal.equals(fn1, fn1)) // true (same reference)
 * ```
 *
 * @category utility
 * @since 2.0.0
 */
export const useInstanceEquality = <T extends object>(obj: T): T => {
  instanceEqualityRegistry.set(obj, true)
  return obj
}
