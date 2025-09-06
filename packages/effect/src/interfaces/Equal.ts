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

/** @internal */
const visitedLeft = new WeakSet<object>()

/** @internal */
const visitedRight = new WeakSet<object>()

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

      // Check for circular references
      if (visitedLeft.has(self as object) && visitedRight.has(that as object)) {
        return true // Both are circular at the same level
      }
      if (visitedLeft.has(self as object) || visitedRight.has(that as object)) {
        return false // Only one is circular
      }

      if (isEqual(self) && isEqual(that)) {
        return self[symbol](that)
      } else if (self instanceof Date && that instanceof Date) {
        return self.toISOString() === that.toISOString()
      } else if (Array.isArray(self) && Array.isArray(that)) {
        return compareArraysWithVisited(self, that)
      } else if (self instanceof Map && that instanceof Map) {
        return compareMapsWithVisited(self, that)
      } else if (self instanceof Set && that instanceof Set) {
        return compareSetsWithVisited(self, that)
      } else if (isPlainObject(self) && isPlainObject(that)) {
        return compareObjectsWithVisited(self, that)
      }
    }
  }
  return false
}

function compareArraysWithVisited(self: Array<unknown>, that: Array<unknown>): boolean {
  if (self.length !== that.length) {
    return false
  }

  visitedLeft.add(self)
  visitedRight.add(that)

  let result = true
  for (let i = 0; i < self.length; i++) {
    if (!compareBoth(self[i], that[i])) {
      result = false
      break
    }
  }

  visitedLeft.delete(self)
  visitedRight.delete(that)

  return result
}

function compareObjectsWithVisited(self: Record<PropertyKey, unknown>, that: Record<PropertyKey, unknown>): boolean {
  const selfKeys = Reflect.ownKeys(self)
  const thatKeys = Reflect.ownKeys(that)

  if (selfKeys.length !== thatKeys.length) {
    return false
  }

  visitedLeft.add(self)
  visitedRight.add(that)

  let result = true
  for (const key of selfKeys) {
    if (!Object.prototype.hasOwnProperty.call(that, key)) {
      result = false
      break
    }
    if (!compareBoth(self[key], that[key])) {
      result = false
      break
    }
  }

  visitedLeft.delete(self)
  visitedRight.delete(that)

  return result
}

function compareMapsWithVisited(self: Map<unknown, unknown>, that: Map<unknown, unknown>): boolean {
  if (self.size !== that.size) {
    return false
  }

  visitedLeft.add(self)
  visitedRight.add(that)

  let result = true
  for (const [selfKey, selfValue] of self) {
    let found = false
    for (const [thatKey, thatValue] of that) {
      if (compareBoth(selfKey, thatKey) && compareBoth(selfValue, thatValue)) {
        found = true
        break
      }
    }
    if (!found) {
      result = false
      break
    }
  }

  visitedLeft.delete(self)
  visitedRight.delete(that)

  return result
}

function compareSetsWithVisited(self: Set<unknown>, that: Set<unknown>): boolean {
  if (self.size !== that.size) {
    return false
  }

  visitedLeft.add(self)
  visitedRight.add(that)

  let result = true
  for (const selfValue of self) {
    let found = false
    for (const thatValue of that) {
      if (compareBoth(selfValue, thatValue)) {
        found = true
        break
      }
    }
    if (!found) {
      result = false
      break
    }
  }

  visitedLeft.delete(self)
  visitedRight.delete(that)

  return result
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
 * Creates a proxy of an object that uses reference equality instead of structural equality.
 *
 * By default, plain objects and arrays use structural equality. This function creates
 * a proxy that behaves exactly like the original object but uses reference equality
 * for comparison purposes.
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
 * // Create reference equality version
 * const obj1ByRef = Equal.byReference(obj1)
 * console.log(Equal.equals(obj1ByRef, obj2)) // false (uses reference equality)
 * console.log(Equal.equals(obj1ByRef, obj1ByRef)) // true (same reference)
 *
 * // Each call creates a new proxy instance
 * const obj1ByRef2 = Equal.byReference(obj1)
 * console.log(Equal.equals(obj1ByRef, obj1ByRef2)) // false (different instances)
 *
 * // Proxy behaves like the original
 * console.log(obj1ByRef.a) // 1
 * ```
 *
 * @category utility
 * @since 2.0.0
 */
export const byReference = <T extends object>(obj: T): T => {
  // Create a fresh proxy that behaves exactly like the original object
  const proxy = new Proxy(obj, {})

  // Register the proxy for instance equality
  instanceEqualityRegistry.set(proxy, true)

  return proxy as T
}

/**
 * Marks an object to use reference equality instead of structural equality by mutating its behavior.
 *
 * **⚠️ WARNING: This function is "unsafe" because it mutates the original object's equality behavior.**
 * Once an object is marked with this function, it will always use reference equality, even when
 * referenced by its original variable. Use `byReference` if you want to avoid mutation.
 *
 * By default, plain objects and arrays use structural equality. This function changes the original
 * object's behavior to use reference equality instead.
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
 * // Mutate obj1 to use reference equality
 * const result = Equal.byReferenceUnsafe(obj1)
 * console.log(result === obj1) // true (same reference returned)
 * console.log(Equal.equals(obj1, obj2)) // false (obj1 now uses reference equality)
 * console.log(Equal.equals(obj1, obj1)) // true (same reference)
 *
 * // Compare with safe version
 * const obj3 = { a: 1, b: 2 }
 * const obj3Proxy = Equal.byReference(obj3)
 * console.log(obj3Proxy === obj3) // false (different reference)
 * console.log(Equal.equals(obj3, obj2)) // true (obj3 still uses structural equality)
 * console.log(Equal.equals(obj3Proxy, obj2)) // false (proxy uses reference equality)
 * ```
 *
 * @category utility
 * @since 2.0.0
 */
export const byReferenceUnsafe = <T extends object>(obj: T): T => {
  // Mark the original object for instance equality (this mutates its behavior)
  instanceEqualityRegistry.set(obj, true)

  // Return the same object
  return obj
}
