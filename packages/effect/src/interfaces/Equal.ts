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
import { getAllObjectKeys } from "../internal/equal.ts"

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

/** Helper to run comparison with proper visited tracking */
function withVisitedTracking(
  self: object,
  that: object,
  fn: () => boolean
): boolean {
  const hasLeft = visitedLeft.has(self)
  const hasRight = visitedRight.has(that)
  // Check for circular references before adding
  if (hasLeft && hasRight) {
    return true // Both are circular at the same level
  }
  if (hasLeft || hasRight) {
    return false // Only one is circular
  }
  visitedLeft.add(self)
  visitedRight.add(that)
  const result = fn()
  visitedLeft.delete(self)
  visitedRight.delete(that)
  return result
}

function compareBoth(self: unknown, that: unknown): boolean {
  if (self === that) return true
  if (self == null || that == null) return false
  const selfType = typeof self
  if (selfType !== typeof that) {
    return false
  }
  // Special case for NaN: NaN should be considered equal to NaN
  if (selfType === "number" && self !== self && that !== that) {
    return true
  }
  if (selfType !== "object" && selfType !== "function") {
    return false
  }
  if (self instanceof Date) {
    if (!(that instanceof Date)) return false
    return self.toISOString() === that.toISOString()
  } else if (self instanceof RegExp) {
    if (!(that instanceof RegExp)) return false
    return self.toString() === that.toString()
  }
  const selfIsEqual = isEqual(self)
  const thatIsEqual = isEqual(that)
  if (selfIsEqual !== thatIsEqual) {
    return false
  }
  if (!selfIsEqual && selfType !== "object") {
    return false
  }
  const bothEqual = selfIsEqual && thatIsEqual
  if (bothEqual && (self[Hash.symbol]() !== that[Hash.symbol]())) {
    return false
  }
  return withVisitedTracking(self as object, that as object, () => {
    if (bothEqual) {
      return self[symbol](that)
    } else if (Array.isArray(self)) {
      if (!Array.isArray(that) || self.length !== that.length) {
        return false
      }
      return compareArrays(self, that)
    } else if (self instanceof Map) {
      if (!(that instanceof Map) || self.size !== that.size) {
        return false
      }
      return compareMaps(self, that)
    } else if (self instanceof Set) {
      if (!(that instanceof Set) || self.size !== that.size) {
        return false
      }
      return compareSets(self, that)
    }
    return compareObjects(self as any, that as any)
  })
}

function compareArrays(self: Array<unknown>, that: Array<unknown>): boolean {
  for (let i = 0; i < self.length; i++) {
    if (!compareBoth(self[i], that[i])) {
      return false
    }
  }

  return true
}

function compareObjects(self: Record<PropertyKey, unknown>, that: Record<PropertyKey, unknown>): boolean {
  const selfKeys = getAllObjectKeys(self)
  const thatKeys = getAllObjectKeys(that)

  if (selfKeys.length !== thatKeys.length) {
    return false
  }

  for (let i = 0; i < selfKeys.length; i++) {
    const key = selfKeys[i]
    if (!(key in that) || !compareBoth(self[key], that[key])) {
      return false
    }
  }

  return true
}

function compareMaps(self: Map<unknown, unknown>, that: Map<unknown, unknown>): boolean {
  for (const [selfKey, selfValue] of self) {
    let found = false
    for (const [thatKey, thatValue] of that) {
      if (compareBoth(selfKey, thatKey) && compareBoth(selfValue, thatValue)) {
        found = true
        break
      }
    }
    if (!found) {
      return false
    }
  }

  return true
}

function compareSets(self: Set<unknown>, that: Set<unknown>): boolean {
  for (const selfValue of self) {
    let found = false
    for (const thatValue of that) {
      if (compareBoth(selfValue, thatValue)) {
        found = true
        break
      }
    }
    if (!found) {
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
  const h = Hash.random({})
  const p = new Proxy(obj, {
    get(target, prop, receiver) {
      if (prop === symbol) return (that: Equal) => receiver === that
      if (prop === Hash.symbol) return () => h
      const value = Reflect.get(target, prop, target)
      return typeof value === "function" ? value.bind(target) : value
    },
    has(target, prop) {
      return prop === symbol || prop === Hash.symbol || Reflect.has(target, prop)
    },
    ownKeys(target) {
      const keys = Reflect.ownKeys(target)
      if (!keys.includes(symbol)) {
        keys.push(symbol)
      }
      if (!keys.includes(Hash.symbol)) {
        keys.push(Hash.symbol)
      }
      return keys
    },
    getOwnPropertyDescriptor(target, prop) {
      return prop === symbol ?
        { value: (that: Equal) => p === that, configurable: true }
        : prop === Hash.symbol ?
        { value: () => h, configurable: true }
        : Reflect.getOwnPropertyDescriptor(target, prop)
    }
  })
  return p as T
}
