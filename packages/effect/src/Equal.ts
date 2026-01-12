/**
 * This module provides functionality for defining and working with equality between values.
 * It includes the `Equal` interface for types that can determine equality with other values
 * of the same type, and utilities for comparing values.
 *
 * @since 2.0.0
 */
import type { Equivalence } from "./Equivalence.ts"
import * as Hash from "./Hash.ts"
import { byReferenceInstances, getAllObjectKeys } from "./internal/equal.ts"
import { hasProperty } from "./Predicate.ts"

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
 * import { Equal, Hash } from "effect"
 *
 * class Coordinate implements Equal.Equal {
 *   constructor(readonly x: number, readonly y: number) {}
 *
 *   [Equal.symbol](that: Equal.Equal): boolean {
 *     return that instanceof Coordinate &&
 *       this.x === that.x &&
 *       this.y === that.y
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
 * Compares two values for structural equality. Returns `true` if the values are structurally equal, `false` otherwise.
 *
 * This function performs deep structural comparison:
 * - For primitive values: uses value equality (including NaN === NaN)
 * - For objects implementing `Equal` interface: uses their custom equality logic
 * - For Date objects: compares ISO string representations
 * - For RegExp objects: compares string representations
 * - For Arrays: recursively compares each element
 * - For Maps: compares keys and values structurally (order-independent)
 * - For Sets: compares values structurally (order-independent)
 * - For plain objects: compares all properties recursively
 * - Handles circular references correctly
 *
 * **Performance**: Results of object comparisons are cached using WeakMaps to optimize
 * repeated equality checks between the same object pairs.
 *
 * **⚠️ CRITICAL IMMUTABILITY REQUIREMENT**: Objects being compared must be treated as
 * immutable after their first equality computation. Equality results are cached, so
 * mutating an object after comparison will lead to stale cached values and incorrect
 * equality results. For mutable objects, use referential equality by implementing
 * custom `Equal` interface that compares object references, not content.
 *
 * **FORBIDDEN**: Modifying objects after `Equal.equals()` has been called on them
 * **ALLOWED**: Using immutable objects, or mutable objects with custom `Equal` interface
 * that uses referential equality (compares object references, not content)
 *
 * @example
 * ```ts
 * import { Equal } from "effect"
 * import * as assert from "node:assert"
 *
 * // Primitive values
 * assert(Equal.equals(1, 1) === true)
 * assert(Equal.equals(NaN, NaN) === true)
 *
 * // Objects - structural comparison
 * assert(Equal.equals({ a: 1, b: 2 }, { a: 1, b: 2 }) === true)
 * assert(Equal.equals({ a: 1 }, { a: 1, b: 2 }) === false)
 *
 * // Arrays - recursive comparison
 * assert(Equal.equals([1, [2, 3]], [1, [2, 3]]) === true)
 * assert(Equal.equals([1, 2], [1, 3]) === false)
 *
 * // Date equality by ISO string
 * const date1 = new Date("2023-01-01")
 * const date2 = new Date("2023-01-01")
 * assert(Equal.equals(date1, date2) === true)
 *
 * // Maps and Sets - structural comparison
 * const map1 = new Map([["a", 1], ["b", 2]])
 * const map2 = new Map([["b", 2], ["a", 1]]) // different order
 * assert(Equal.equals(map1, map2) === true)
 *
 * // Curried version
 * const isEqualTo5 = Equal.equals(5)
 * assert(isEqualTo5(5) === true)
 * assert(isEqualTo5(3) === false)
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

  if (byReferenceInstances.has(self) || byReferenceInstances.has(that)) {
    return false
  }

  // For objects and functions, use cached comparison
  return withCache(self, that, compareObjects)
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

const visitedLeft = new WeakSet<object>()
const visitedRight = new WeakSet<object>()

/** Helper to perform cached object comparison */
function compareObjects(self: object, that: object): boolean {
  if (Hash.hash(self) !== Hash.hash(that)) {
    return false
  } else if (self instanceof Date) {
    if (!(that instanceof Date)) return false
    return self.toISOString() === that.toISOString()
  } else if (self instanceof RegExp) {
    if (!(that instanceof RegExp)) return false
    return self.toString() === that.toString()
  }
  const selfIsEqual = isEqual(self)
  const thatIsEqual = isEqual(that)
  if (selfIsEqual !== thatIsEqual) return false
  const bothEquals = selfIsEqual && thatIsEqual
  if (typeof self === "function" && !bothEquals) {
    return false
  }
  return withVisitedTracking(self, that, () => {
    if (bothEquals) {
      return (self as any)[symbol](that)
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
    return compareRecords(self as any, that as any)
  })
}

function withCache(self: object, that: object, f: (a: any, b: any) => boolean): boolean {
  // Check cache first
  let selfMap = equalityCache.get(self)
  if (!selfMap) {
    selfMap = new WeakMap()
    equalityCache.set(self, selfMap)
  } else if (selfMap.has(that)) {
    return selfMap.get(that)!
  }

  // Perform the comparison
  const result = f(self, that)

  // Cache the result bidirectionally
  selfMap.set(that, result)

  let thatMap = equalityCache.get(that)
  if (!thatMap) {
    thatMap = new WeakMap()
    equalityCache.set(that, thatMap)
  }
  thatMap.set(self, result)

  return result
}

const equalityCache = new WeakMap<object, WeakMap<object, boolean>>()

function compareArrays(self: Array<unknown>, that: Array<unknown>): boolean {
  for (let i = 0; i < self.length; i++) {
    if (!compareBoth(self[i], that[i])) {
      return false
    }
  }

  return true
}

function compareRecords(
  self: Record<PropertyKey, unknown>,
  that: Record<PropertyKey, unknown>
): boolean {
  const selfKeys = getAllObjectKeys(self)
  const thatKeys = getAllObjectKeys(that)

  if (selfKeys.size !== thatKeys.size) {
    return false
  }

  for (const key of selfKeys) {
    if (!(thatKeys.has(key)) || !compareBoth(self[key], that[key])) {
      return false
    }
  }

  return true
}

/** @internal */
export function makeCompareMap<K, V>(keyEquivalence: Equivalence<K>, valueEquivalence: Equivalence<V>) {
  return function compareMaps(self: ReadonlyMap<K, V>, that: ReadonlyMap<K, V>): boolean {
    for (const [selfKey, selfValue] of self) {
      let found = false
      for (const [thatKey, thatValue] of that) {
        if (keyEquivalence(selfKey, thatKey) && valueEquivalence(selfValue, thatValue)) {
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
}

const compareMaps = makeCompareMap(compareBoth, compareBoth)

/** @internal */
export function makeCompareSet<A>(equivalence: Equivalence<A>) {
  return function compareSets(self: ReadonlySet<A>, that: ReadonlySet<A>): boolean {
    for (const selfValue of self) {
      let found = false
      for (const thatValue of that) {
        if (equivalence(selfValue, thatValue)) {
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
}

const compareSets = makeCompareSet(compareBoth)

/**
 * Determines if a value implements the `Equal` interface.
 *
 * @example
 * ```ts
 * import { Equal, Hash } from "effect"
 * import * as assert from "node:assert"
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
 * assert(Equal.isEqual(instance) === true)
 * assert(Equal.isEqual({}) === false)
 * assert(Equal.isEqual(42) === false)
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
 * import { Array, Equal } from "effect"
 *
 * const eq = Equal.asEquivalence<number>()
 * const result = Array.dedupeWith([1, 2, 2, 3, 1], eq)
 * console.log(result) // [1, 2, 3]
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const asEquivalence: <A>() => Equivalence<A> = () => equals

/**
 * Creates a proxy of an object that uses reference equality instead of structural equality.
 *
 * By default, plain objects and arrays use structural equality. This function creates
 * a proxy that behaves exactly like the original object but uses reference equality
 * for comparison purposes.
 *
 * @example
 * ```ts
 * import { Equal } from "effect"
 * import * as assert from "node:assert"
 *
 * const obj1 = { a: 1, b: 2 }
 * const obj2 = { a: 1, b: 2 }
 *
 * // Normal structural equality
 * assert(Equal.equals(obj1, obj2) === true)
 *
 * // Create reference equality version
 * const obj1ByRef = Equal.byReference(obj1)
 * assert(Equal.equals(obj1ByRef, obj2) === false) // uses reference equality
 * assert(Equal.equals(obj1ByRef, obj1ByRef) === true) // same reference
 *
 * // Each call creates a new proxy instance
 * const obj1ByRef2 = Equal.byReference(obj1)
 * assert(Equal.equals(obj1ByRef, obj1ByRef2) === false) // different instances
 *
 * // Proxy behaves like the original
 * assert(obj1ByRef.a === 1)
 * ```
 *
 * @category utility
 * @since 2.0.0
 */
export const byReference = <T extends object>(obj: T): T => byReferenceUnsafe(new Proxy(obj, {}))

/**
 * Marks an object to use reference equality instead of structural equality, without creating a proxy.
 *
 * Unlike `byReference`, this function directly modifies the object's equality behavior
 * without creating a proxy wrapper. This is more performant but "unsafe" because
 * it permanently changes how the object is compared.
 *
 * @example
 * ```ts
 * import { Equal } from "effect"
 * import * as assert from "node:assert"
 *
 * const obj1 = { a: 1, b: 2 }
 * const obj2 = { a: 1, b: 2 }
 *
 * // Mark obj1 for reference equality (modifies obj1 directly)
 * const obj1ByRef = Equal.byReferenceUnsafe(obj1)
 * assert(obj1ByRef === obj1) // Same object, no proxy created
 * assert(Equal.equals(obj1ByRef, obj2) === false) // uses reference equality
 * assert(Equal.equals(obj1ByRef, obj1ByRef) === true) // same reference
 *
 * // The original obj1 is now permanently marked for reference equality
 * assert(Equal.equals(obj1, obj2) === false) // obj1 uses reference equality
 * ```
 *
 * @category utility
 * @since 2.0.0
 */
export const byReferenceUnsafe = <T extends object>(obj: T): T => {
  byReferenceInstances.add(obj)
  return obj
}
