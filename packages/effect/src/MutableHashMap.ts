/**
 * @fileoverview
 * MutableHashMap is a high-performance, mutable hash map implementation designed for efficient key-value storage 
 * with support for both structural and referential equality. It provides O(1) average-case performance for 
 * basic operations and integrates seamlessly with Effect's Equal and Hash interfaces.
 *
 * The implementation uses a hybrid approach:
 * - Referential keys (without Equal implementation) are stored in a native Map
 * - Structural keys (with Equal implementation) are stored in hash buckets with collision handling
 *
 * Key Features:
 * - Mutable operations for performance-critical scenarios
 * - Supports both structural and referential equality
 * - Efficient collision handling through bucketing
 * - Iterable interface for easy traversal
 * - Memory-efficient storage with automatic bucket management
 *
 * Performance Characteristics:
 * - Get/Set/Has: O(1) average, O(n) worst case (hash collisions)
 * - Remove: O(1) average, O(n) worst case
 * - Clear: O(1)
 * - Size: O(1)
 * - Iteration: O(n)
 *
 * @since 2.0.0
 * @category data-structures
 */
import type { NonEmptyArray } from "./Array.js"
import * as Equal from "./Equal.js"
import { dual } from "./Function.js"
import * as Hash from "./Hash.js"
import { format, type Inspectable, NodeInspectSymbol, toJSON } from "./Inspectable.js"
import * as Option from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"

const TypeId: TypeId = "~effect/MutableHashMap"

/**
 * @since 2.0.0
 * @category symbol
 */
export type TypeId = "~effect/MutableHashMap"

/**
 * @since 2.0.0
 * @category models
 */
export interface MutableHashMap<out K, out V> extends Iterable<[K, V]>, Pipeable, Inspectable {
  readonly [TypeId]: TypeId
  /** @internal */
  readonly referential: Map<K, V>
  /** @internal */
  readonly buckets: Map<number, NonEmptyArray<readonly [K & Equal.Equal, V]>>
  /** @internal */
  bucketsSize: number
}

const MutableHashMapProto: Omit<MutableHashMap<unknown, unknown>, "referential" | "buckets" | "bucketsSize"> = {
  [TypeId]: TypeId,
  [Symbol.iterator](this: MutableHashMap<unknown, unknown>): Iterator<[unknown, unknown]> {
    return new MutableHashMapIterator(this)
  },
  toString() {
    return format(this.toJSON())
  },
  toJSON() {
    return {
      _id: "MutableHashMap",
      values: Array.from(this).map(toJSON)
    }
  },
  [NodeInspectSymbol]() {
    return this.toJSON()
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
}

class MutableHashMapIterator<K, V> implements IterableIterator<[K, V]> {
  readonly referentialIterator: Iterator<[K, V]>
  bucketIterator: Iterator<[K, V]> | undefined

  constructor(readonly self: MutableHashMap<K, V>) {
    this.referentialIterator = self.referential[Symbol.iterator]()
  }
  next(): IteratorResult<[K, V]> {
    if (this.bucketIterator !== undefined) {
      return this.bucketIterator.next()
    }
    const result = this.referentialIterator.next()
    if (result.done) {
      this.bucketIterator = new BucketIterator(this.self.buckets.values())
      return this.next()
    }
    return result
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return new MutableHashMapIterator(this.self)
  }
}

class BucketIterator<K, V> implements Iterator<[K, V]> {
  constructor(readonly backing: Iterator<NonEmptyArray<readonly [K, V]>>) {}
  currentBucket: Iterator<readonly [K, V]> | undefined
  next(): IteratorResult<[K, V]> {
    if (this.currentBucket === undefined) {
      const result = this.backing.next()
      if (result.done) {
        return result
      }
      this.currentBucket = result.value[Symbol.iterator]()
    }
    const result = this.currentBucket.next()
    if (result.done) {
      this.currentBucket = undefined
      return this.next()
    }
    return result as IteratorResult<[K, V]>
  }
}

/**
 * Creates an empty MutableHashMap.
 *
 * @example
 * ```ts
 * import { MutableHashMap } from "effect"
 *
 * const map = MutableHashMap.empty<string, number>()
 * 
 * // Add some entries
 * MutableHashMap.set(map, "key1", 42)
 * MutableHashMap.set(map, "key2", 100)
 * 
 * console.log(MutableHashMap.size(map)) // 2
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const empty = <K, V>(): MutableHashMap<K, V> => {
  const self = Object.create(MutableHashMapProto)
  self.referential = new Map()
  self.buckets = new Map()
  self.bucketsSize = 0
  return self
}

/**
 * Creates a MutableHashMap from a variable number of key-value pairs.
 *
 * @example
 * ```ts
 * import { MutableHashMap } from "effect"
 *
 * const map = MutableHashMap.make(
 *   ["key1", 42],
 *   ["key2", 100],
 *   ["key3", 200]
 * )
 * 
 * console.log(MutableHashMap.get(map, "key1")) // Some(42)
 * console.log(MutableHashMap.size(map)) // 3
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const make: <Entries extends Array<readonly [any, any]>>(
  ...entries: Entries
) => MutableHashMap<
  Entries[number] extends readonly [infer K, any] ? K : never,
  Entries[number] extends readonly [any, infer V] ? V : never
> = (...entries) => fromIterable(entries)

/**
 * Creates a MutableHashMap from an iterable collection of key-value pairs.
 *
 * @example
 * ```ts
 * import { MutableHashMap } from "effect"
 *
 * const entries = [
 *   ["apple", 1],
 *   ["banana", 2],
 *   ["cherry", 3]
 * ] as const
 * 
 * const map = MutableHashMap.fromIterable(entries)
 * 
 * console.log(MutableHashMap.get(map, "banana")) // Some(2)
 * console.log(MutableHashMap.size(map)) // 3
 * 
 * // Works with any iterable
 * const fromMap = MutableHashMap.fromIterable(new Map([['x', 10], ['y', 20]]))
 * console.log(MutableHashMap.get(fromMap, "x")) // Some(10)
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromIterable = <K, V>(entries: Iterable<readonly [K, V]>): MutableHashMap<K, V> => {
  const self = empty<K, V>()
  for (const [key, value] of entries) {
    set(self, key, value)
  }
  return self
}

/**
 * Retrieves the value associated with the specified key from the MutableHashMap.
 *
 * @example
 * ```ts
 * import { MutableHashMap, Option } from "effect"
 *
 * const map = MutableHashMap.make(["key1", 42], ["key2", 100])
 * 
 * console.log(MutableHashMap.get(map, "key1")) // Some(42)
 * console.log(MutableHashMap.get(map, "key3")) // None
 * 
 * // Pipe-able version
 * const getValue = MutableHashMap.get("key1")
 * console.log(getValue(map)) // Some(42)
 * ```
 *
 * @since 2.0.0
 * @category elements
 */
export const get: {
  <K>(key: K): <V>(self: MutableHashMap<K, V>) => Option.Option<V>
  <K, V>(self: MutableHashMap<K, V>, key: K): Option.Option<V>
} = dual<
  <K>(key: K) => <V>(self: MutableHashMap<K, V>) => Option.Option<V>,
  <K, V>(self: MutableHashMap<K, V>, key: K) => Option.Option<V>
>(2, <K, V>(self: MutableHashMap<K, V>, key: K): Option.Option<V> => {
  if (Equal.isEqual(key) === false) {
    return self.referential.has(key) ? Option.some(self.referential.get(key)!) : Option.none()
  }

  const hash = key[Hash.symbol]()
  const bucket = self.buckets.get(hash)
  if (bucket === undefined) {
    return Option.none()
  }

  return getFromBucket(self, bucket, key)
})

/**
 * Extracts all keys from the MutableHashMap into an array.
 *
 * @example
 * ```ts
 * import { MutableHashMap } from "effect"
 *
 * const map = MutableHashMap.make(
 *   ["apple", 1],
 *   ["banana", 2],
 *   ["cherry", 3]
 * )
 * 
 * const allKeys = MutableHashMap.keys(map)
 * console.log(allKeys) // ["apple", "banana", "cherry"]
 * 
 * // Useful for iteration or validation
 * const hasRequiredKeys = allKeys.includes("apple") && allKeys.includes("banana")
 * ```
 *
 * @since 3.8.0
 * @category elements
 */
export const keys = <K, V>(self: MutableHashMap<K, V>): Array<K> => {
  const keys: Array<K> = []
  for (const [key] of self) {
    keys.push(key)
  }
  return keys
}

/**
 * @since 3.8.0
 * @category elements
 */
export const values = <K, V>(self: MutableHashMap<K, V>): Array<V> => {
  const values = Array.from(self.referential.values())
  for (const bucket of self.buckets.values()) {
    for (let i = 0, len = bucket.length; i < len; i++) {
      values.push(bucket[i][1])
    }
  }
  return values
}

const getFromBucket = <K, V>(
  self: MutableHashMap<K, V>,
  bucket: NonEmptyArray<readonly [K & Equal.Equal, V]>,
  key: K & Equal.Equal,
  remove = false
): Option.Option<V> => {
  for (let i = 0, len = bucket.length; i < len; i++) {
    if (key[Equal.symbol](bucket[i][0])) {
      const value = bucket[i][1]
      if (remove) {
        bucket.splice(i, 1)
        self.bucketsSize--
      }
      return Option.some(value)
    }
  }

  return Option.none()
}

/**
 * Checks if the MutableHashMap contains the specified key.
 *
 * @example
 * ```ts
 * import { MutableHashMap } from "effect"
 *
 * const map = MutableHashMap.make(["key1", 42], ["key2", 100])
 * 
 * console.log(MutableHashMap.has(map, "key1")) // true
 * console.log(MutableHashMap.has(map, "key3")) // false
 * 
 * // Pipe-able version
 * const hasKey = MutableHashMap.has("key1")
 * console.log(hasKey(map)) // true
 * ```
 *
 * @since 2.0.0
 * @category elements
 */
export const has: {
  <K>(key: K): <V>(self: MutableHashMap<K, V>) => boolean
  <K, V>(self: MutableHashMap<K, V>, key: K): boolean
} = dual<
  <K>(key: K) => <V>(self: MutableHashMap<K, V>) => boolean,
  <K, V>(self: MutableHashMap<K, V>, key: K) => boolean
>(2, (self, key) => Option.isSome(get(self, key)))

/**
 * Sets a key-value pair in the MutableHashMap, mutating the map in place.
 * If the key already exists, its value is updated.
 *
 * @example
 * ```ts
 * import { MutableHashMap } from "effect"
 *
 * const map = MutableHashMap.empty<string, number>()
 * 
 * // Add new entries
 * MutableHashMap.set(map, "key1", 42)
 * MutableHashMap.set(map, "key2", 100)
 * 
 * console.log(MutableHashMap.get(map, "key1")) // Some(42)
 * console.log(MutableHashMap.size(map)) // 2
 * 
 * // Update existing entry
 * MutableHashMap.set(map, "key1", 999)
 * console.log(MutableHashMap.get(map, "key1")) // Some(999)
 * 
 * // Pipe-able version
 * const setKey = MutableHashMap.set("key3", 300)
 * setKey(map)
 * console.log(MutableHashMap.size(map)) // 3
 * ```
 *
 * @since 2.0.0
 * @category mutations
 */
export const set: {
  <K, V>(key: K, value: V): (self: MutableHashMap<K, V>) => MutableHashMap<K, V>
  <K, V>(self: MutableHashMap<K, V>, key: K, value: V): MutableHashMap<K, V>
} = dual<
  <K, V>(key: K, value: V) => (self: MutableHashMap<K, V>) => MutableHashMap<K, V>,
  <K, V>(self: MutableHashMap<K, V>, key: K, value: V) => MutableHashMap<K, V>
>(3, <K, V>(self: MutableHashMap<K, V>, key: K, value: V) => {
  if (Equal.isEqual(key) === false) {
    self.referential.set(key, value)
    return self
  }

  const hash = key[Hash.symbol]()
  const bucket = self.buckets.get(hash)
  if (bucket === undefined) {
    self.buckets.set(hash, [[key, value]])
    self.bucketsSize++
    return self
  }

  removeFromBucket(self, bucket, key)
  bucket.push([key, value])
  self.bucketsSize++
  return self
})

const removeFromBucket = <K, V>(
  self: MutableHashMap<K, V>,
  bucket: NonEmptyArray<readonly [K & Equal.Equal, V]>,
  key: K & Equal.Equal
) => {
  for (let i = 0, len = bucket.length; i < len; i++) {
    if (key[Equal.symbol](bucket[i][0])) {
      bucket.splice(i, 1)
      self.bucketsSize--
      return
    }
  }
}

/**
 * Updates the value of the specified key within the MutableHashMap if it exists.
 * If the key doesn't exist, the map remains unchanged.
 *
 * @example
 * ```ts
 * import { MutableHashMap } from "effect"
 *
 * const map = MutableHashMap.make(["count", 5], ["total", 100])
 * 
 * // Increment existing value
 * MutableHashMap.modify(map, "count", (n) => n + 1)
 * console.log(MutableHashMap.get(map, "count")) // Some(6)
 * 
 * // Double existing value
 * MutableHashMap.modify(map, "total", (n) => n * 2)
 * console.log(MutableHashMap.get(map, "total")) // Some(200)
 * 
 * // Try to modify non-existent key (no effect)
 * MutableHashMap.modify(map, "missing", (n) => n + 1)
 * console.log(MutableHashMap.has(map, "missing")) // false
 * 
 * // Pipe-able version
 * const increment = MutableHashMap.modify("count", (n: number) => n + 1)
 * increment(map)
 * ```
 *
 * @since 2.0.0
 * @category mutations
 */
export const modify: {
  <K, V>(key: K, f: (v: V) => V): (self: MutableHashMap<K, V>) => MutableHashMap<K, V>
  <K, V>(self: MutableHashMap<K, V>, key: K, f: (v: V) => V): MutableHashMap<K, V>
} = dual<
  <K, V>(key: K, f: (v: V) => V) => (self: MutableHashMap<K, V>) => MutableHashMap<K, V>,
  <K, V>(self: MutableHashMap<K, V>, key: K, f: (v: V) => V) => MutableHashMap<K, V>
>(3, <K, V>(self: MutableHashMap<K, V>, key: K, f: (v: V) => V) => {
  if (Equal.isEqual(key) === false) {
    if (self.referential.has(key)) {
      self.referential.set(key, f(self.referential.get(key)!))
    }
    return self
  }

  const hash = key[Hash.symbol]()
  const bucket = self.buckets.get(hash)
  if (bucket === undefined) {
    return self
  }

  const value = getFromBucket(self, bucket, key, true)
  if (Option.isNone(value)) {
    return self
  }
  bucket.push([key, f(value.value)])
  self.bucketsSize++
  return self
})

/**
 * Sets or removes the specified key in the MutableHashMap using an update function.
 * The function receives the current value as an Option and returns an Option.
 * If the function returns Some, the key is set to that value.
 * If the function returns None, the key is removed.
 *
 * @example
 * ```ts
 * import { MutableHashMap, Option } from "effect"
 *
 * const map = MutableHashMap.make(["count", 5])
 * 
 * // Update existing key
 * MutableHashMap.modifyAt(map, "count", (option) => 
 *   Option.map(option, (n) => n * 2)
 * )
 * console.log(MutableHashMap.get(map, "count")) // Some(10)
 * 
 * // Add new key
 * MutableHashMap.modifyAt(map, "new", (option) => 
 *   Option.isNone(option) ? Option.some(42) : option
 * )
 * console.log(MutableHashMap.get(map, "new")) // Some(42)
 * 
 * // Remove key by returning None
 * MutableHashMap.modifyAt(map, "count", () => Option.none())
 * console.log(MutableHashMap.has(map, "count")) // false
 * 
 * // Conditional update
 * MutableHashMap.modifyAt(map, "new", (option) => 
 *   Option.filter(option, (n) => n > 50) // Remove if <= 50
 * )
 * console.log(MutableHashMap.has(map, "new")) // false (42 <= 50)
 * ```
 *
 * @since 2.0.0
 * @category mutations
 */
export const modifyAt: {
  <K, V>(key: K, f: (value: Option.Option<V>) => Option.Option<V>): (self: MutableHashMap<K, V>) => MutableHashMap<K, V>
  <K, V>(self: MutableHashMap<K, V>, key: K, f: (value: Option.Option<V>) => Option.Option<V>): MutableHashMap<K, V>
} = dual<
  <K, V>(
    key: K,
    f: (value: Option.Option<V>) => Option.Option<V>
  ) => (self: MutableHashMap<K, V>) => MutableHashMap<K, V>,
  <K, V>(
    self: MutableHashMap<K, V>,
    key: K,
    f: (value: Option.Option<V>) => Option.Option<V>
  ) => MutableHashMap<K, V>
>(3, (self, key, f) => {
  if (Equal.isEqual(key) === false) {
    const result = f(get(self, key))
    if (Option.isSome(result)) {
      set(self, key, result.value)
    } else {
      remove(self, key)
    }
    return self
  }

  const hash = key[Hash.symbol]()
  const bucket = self.buckets.get(hash)
  if (bucket === undefined) {
    const result = f(Option.none())
    return Option.isSome(result) ? set(self, key, result.value) : self
  }

  const result = f(getFromBucket(self, bucket, key, true))
  if (Option.isNone(result)) {
    if (bucket.length === 0) {
      self.buckets.delete(hash)
    }
    return self
  }
  bucket.push([key, result.value])
  self.bucketsSize++
  return self
})

/**
 * Removes the specified key from the MutableHashMap, mutating the map in place.
 * If the key doesn't exist, the map remains unchanged.
 *
 * @example
 * ```ts
 * import { MutableHashMap } from "effect"
 *
 * const map = MutableHashMap.make(
 *   ["key1", 42],
 *   ["key2", 100],
 *   ["key3", 200]
 * )
 * 
 * console.log(MutableHashMap.size(map)) // 3
 * 
 * // Remove existing key
 * MutableHashMap.remove(map, "key2")
 * console.log(MutableHashMap.size(map)) // 2
 * console.log(MutableHashMap.has(map, "key2")) // false
 * 
 * // Remove non-existent key (no effect)
 * MutableHashMap.remove(map, "nonexistent")
 * console.log(MutableHashMap.size(map)) // 2
 * 
 * // Pipe-able version
 * const removeKey = MutableHashMap.remove("key1")
 * removeKey(map)
 * console.log(MutableHashMap.size(map)) // 1
 * ```
 *
 * @since 2.0.0
 * @category mutations
 */
export const remove: {
  <K>(key: K): <V>(self: MutableHashMap<K, V>) => MutableHashMap<K, V>
  <K, V>(self: MutableHashMap<K, V>, key: K): MutableHashMap<K, V>
} = dual<
  <K>(key: K) => <V>(self: MutableHashMap<K, V>) => MutableHashMap<K, V>,
  <K, V>(self: MutableHashMap<K, V>, key: K) => MutableHashMap<K, V>
>(2, <K, V>(self: MutableHashMap<K, V>, key: K) => {
  if (Equal.isEqual(key) === false) {
    self.referential.delete(key)
    return self
  }

  const hash = key[Hash.symbol]()
  const bucket = self.buckets.get(hash)
  if (bucket === undefined) {
    return self
  }
  removeFromBucket(self, bucket, key)
  if (bucket.length === 0) {
    self.buckets.delete(hash)
  }
  return self
})

/**
 * Removes all key-value pairs from the MutableHashMap, mutating the map in place.
 * The map becomes empty after this operation.
 *
 * @example
 * ```ts
 * import { MutableHashMap } from "effect"
 *
 * const map = MutableHashMap.make(
 *   ["key1", 42],
 *   ["key2", 100],
 *   ["key3", 200]
 * )
 * 
 * console.log(MutableHashMap.size(map)) // 3
 * 
 * // Clear all entries
 * MutableHashMap.clear(map)
 * 
 * console.log(MutableHashMap.size(map)) // 0
 * console.log(MutableHashMap.has(map, "key1")) // false
 * 
 * // Can still add new entries after clearing
 * MutableHashMap.set(map, "new", 999)
 * console.log(MutableHashMap.size(map)) // 1
 * ```
 *
 * @since 2.0.0
 * @category mutations
 */
export const clear = <K, V>(self: MutableHashMap<K, V>) => {
  self.referential.clear()
  self.buckets.clear()
  self.bucketsSize = 0
  return self
}

/**
 * Returns the number of key-value pairs in the MutableHashMap.
 *
 * @example
 * ```ts
 * import { MutableHashMap } from "effect"
 *
 * const map = MutableHashMap.empty<string, number>()
 * console.log(MutableHashMap.size(map)) // 0
 * 
 * MutableHashMap.set(map, "key1", 42)
 * MutableHashMap.set(map, "key2", 100)
 * console.log(MutableHashMap.size(map)) // 2
 * 
 * MutableHashMap.remove(map, "key1")
 * console.log(MutableHashMap.size(map)) // 1
 * 
 * MutableHashMap.clear(map)
 * console.log(MutableHashMap.size(map)) // 0
 * ```
 *
 * @since 2.0.0
 * @category elements
 */
export const size = <K, V>(self: MutableHashMap<K, V>): number => {
  return self.referential.size + self.bucketsSize
}
