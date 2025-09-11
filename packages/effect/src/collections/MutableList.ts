/**
 * @fileoverview
 * MutableList is an efficient, mutable linked list implementation optimized for high-throughput
 * scenarios like logging, queuing, and streaming. It uses a bucket-based architecture where
 * elements are stored in arrays (buckets) linked together, providing optimal performance for
 * both append and prepend operations.
 *
 * The implementation uses a sophisticated bucket system:
 * - Each bucket contains an array of elements with an offset pointer
 * - Buckets can be marked as mutable or immutable for optimization
 * - Elements are taken from the head and added to the tail
 * - Memory is efficiently managed through bucket reuse and cleanup
 *
 * Key Features:
 * - Highly optimized for high-frequency append/prepend operations
 * - Memory efficient with automatic cleanup of consumed elements
 * - Support for bulk operations (appendAll, prependAll, takeN)
 * - Filtering and removal operations
 * - Zero-copy optimizations for certain scenarios
 *
 * Performance Characteristics:
 * - Append/Prepend: O(1) amortized
 * - Take/TakeN: O(1) per element taken
 * - Length: O(1)
 * - Clear: O(1)
 * - Filter: O(n)
 *
 * Ideal Use Cases:
 * - High-throughput logging systems
 * - Producer-consumer queues
 * - Streaming data buffers
 * - Real-time data processing pipelines
 *
 * @since 4.0.0
 * @category data-structures
 */
import * as Arr from "../collections/Array.ts"

/**
 * A mutable linked list data structure optimized for high-throughput operations.
 * MutableList provides efficient append/prepend operations and is ideal for
 * producer-consumer patterns, queues, and streaming scenarios.
 *
 * @example
 * ```ts
 * import { MutableList } from "effect/collections"
 *
 * // Create a mutable list
 * const list: MutableList.MutableList<number> = MutableList.make()
 *
 * // Add elements
 * MutableList.append(list, 1)
 * MutableList.append(list, 2)
 * MutableList.prepend(list, 0)
 *
 * // Access properties
 * console.log(list.length) // 3
 * console.log(list.head?.array) // Contains elements from head bucket
 * console.log(list.tail?.array) // Contains elements from tail bucket
 *
 * // Take elements
 * console.log(MutableList.take(list)) // 0
 * console.log(MutableList.take(list)) // 1
 * console.log(MutableList.take(list)) // 2
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface MutableList<in out A> {
  head: MutableList.Bucket<A> | undefined
  tail: MutableList.Bucket<A> | undefined
  length: number
}

/**
 * The MutableList namespace contains type definitions and utilities for working
 * with mutable linked lists.
 *
 * @example
 * ```ts
 * import { MutableList } from "effect/collections"
 *
 * // Type annotation using the namespace
 * const processQueue = (queue: MutableList.MutableList<string>) => {
 *   while (queue.length > 0) {
 *     const item = MutableList.take(queue)
 *     if (item !== MutableList.Empty) {
 *       console.log("Processing:", item)
 *     }
 *   }
 * }
 *
 * // Using the namespace for type definitions
 * const createProcessor = <T>(): {
 *   queue: MutableList.MutableList<T>
 *   add: (item: T) => void
 *   process: () => T[]
 * } => {
 *   const queue = MutableList.make<T>()
 *   return {
 *     queue,
 *     add: (item) => MutableList.append(queue, item),
 *     process: () => MutableList.takeAll(queue)
 *   }
 * }
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export declare namespace MutableList {
  /**
   * Internal bucket structure used by MutableList to store elements efficiently.
   * Buckets are linked together to form the list structure.
   *
   * @example
   * ```ts
   * import { MutableList } from "effect/collections"
   *
   * const list = MutableList.make<number>()
   * MutableList.append(list, 1)
   * MutableList.append(list, 2)
   *
   * // Access bucket information (for debugging or advanced usage)
   * const inspectBucket = (bucket: MutableList.MutableList.Bucket<number> | undefined) => {
   *   if (bucket) {
   *     console.log("Bucket array:", bucket.array)
   *     console.log("Bucket offset:", bucket.offset)
   *     console.log("Bucket mutable:", bucket.mutable)
   *     console.log("Has next bucket:", bucket.next !== undefined)
   *   }
   * }
   *
   * inspectBucket(list.head)
   * inspectBucket(list.tail)
   * ```
   *
   * @since 4.0.0
   * @category models
   */
  export interface Bucket<A> {
    readonly array: Array<A>
    mutable: boolean
    offset: number
    next: Bucket<A> | undefined
  }
}

/**
 * A unique symbol used to represent an empty result when taking elements from a MutableList.
 * This symbol is returned by `take` when the list is empty, allowing for safe type checking.
 *
 * @example
 * ```ts
 * import { MutableList } from "effect/collections"
 *
 * const list = MutableList.make<string>()
 *
 * // Take from empty list returns Empty symbol
 * const result = MutableList.take(list)
 * console.log(result === MutableList.Empty) // true
 *
 * // Safe pattern for checking emptiness
 * const processNext = (queue: MutableList.MutableList<string>) => {
 *   const item = MutableList.take(queue)
 *   if (item === MutableList.Empty) {
 *     console.log("Queue is empty")
 *     return null
 *   }
 *   return item.toUpperCase()
 * }
 *
 * // Compare with other empty results
 * MutableList.append(list, "hello")
 * const next = MutableList.take(list)
 * console.log(next !== MutableList.Empty) // true, got "hello"
 *
 * const empty = MutableList.take(list)
 * console.log(empty === MutableList.Empty) // true, list is empty
 * ```
 *
 * @since 4.0.0
 * @category Symbols
 */
export const Empty: unique symbol = Symbol.for("effect/MutableList/Empty")

/**
 * The type of the Empty symbol, used for type checking when taking elements from a MutableList.
 * This provides compile-time safety when checking for empty results.
 *
 * @example
 * ```ts
 * import { MutableList } from "effect/collections"
 *
 * const list = MutableList.make<number>()
 *
 * // Type-safe handling of empty results
 * const takeAndDouble = (queue: MutableList.MutableList<number>): number | null => {
 *   const item: number | MutableList.Empty = MutableList.take(queue)
 *
 *   if (item === MutableList.Empty) {
 *     return null
 *   }
 *
 *   // TypeScript knows item is number here
 *   return item * 2
 * }
 *
 * console.log(takeAndDouble(list)) // null (empty list)
 *
 * MutableList.append(list, 5)
 * console.log(takeAndDouble(list)) // 10
 *
 * // Type guard function
 * const isEmpty = (result: number | MutableList.Empty): result is MutableList.Empty => {
 *   return result === MutableList.Empty
 * }
 *
 * const value = MutableList.take(list)
 * if (isEmpty(value)) {
 *   console.log("List is empty")
 * } else {
 *   console.log("Got value:", value)
 * }
 * ```
 *
 * @since 4.0.0
 * @category Symbols
 */
export type Empty = typeof Empty

/**
 * Creates an empty MutableList.
 *
 * @example
 * ```ts
 * import { MutableList } from "effect/collections"
 *
 * const list = MutableList.make<string>()
 *
 * // Add elements
 * MutableList.append(list, "first")
 * MutableList.append(list, "second")
 * MutableList.prepend(list, "beginning")
 *
 * console.log(list.length) // 3
 *
 * // Take elements in FIFO order (from head)
 * console.log(MutableList.take(list)) // "beginning"
 * console.log(MutableList.take(list)) // "first"
 * console.log(MutableList.take(list)) // "second"
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const make = <A>(): MutableList<A> => ({
  head: undefined,
  tail: undefined,
  length: 0
})

const emptyBucket = (): MutableList.Bucket<never> => ({
  array: [],
  mutable: true,
  offset: 0,
  next: undefined
})

/**
 * Appends an element to the end of the MutableList.
 * This operation is optimized for high-frequency usage.
 *
 * @example
 * ```ts
 * import { MutableList } from "effect/collections"
 *
 * const list = MutableList.make<number>()
 *
 * // Append elements one by one
 * MutableList.append(list, 1)
 * MutableList.append(list, 2)
 * MutableList.append(list, 3)
 *
 * console.log(list.length) // 3
 *
 * // Elements are taken from head (FIFO)
 * console.log(MutableList.take(list)) // 1
 * console.log(MutableList.take(list)) // 2
 * console.log(MutableList.take(list)) // 3
 *
 * // High-throughput usage
 * for (let i = 0; i < 10000; i++) {
 *   MutableList.append(list, i)
 * }
 * ```
 *
 * @since 4.0.0
 * @category mutations
 */
export const append = <A>(self: MutableList<A>, message: A): void => {
  if (!self.tail) {
    self.head = self.tail = emptyBucket()
  } else if (!self.tail.mutable) {
    self.tail.next = emptyBucket()
    self.tail = self.tail.next
  }
  self.tail!.array.push(message)
  self.length++
}

/**
 * Prepends an element to the beginning of the MutableList.
 * This operation is optimized for high-frequency usage.
 *
 * @example
 * ```ts
 * import { MutableList } from "effect/collections"
 *
 * const list = MutableList.make<string>()
 *
 * // Prepend elements (they'll be at the front)
 * MutableList.prepend(list, "third")
 * MutableList.prepend(list, "second")
 * MutableList.prepend(list, "first")
 *
 * console.log(list.length) // 3
 *
 * // Elements taken from head (most recently prepended first)
 * console.log(MutableList.take(list)) // "first"
 * console.log(MutableList.take(list)) // "second"
 * console.log(MutableList.take(list)) // "third"
 *
 * // Use case: priority items or stack-like behavior
 * MutableList.append(list, "normal")
 * MutableList.prepend(list, "priority") // This will be taken first
 * console.log(MutableList.take(list)) // "priority"
 * ```
 *
 * @since 4.0.0
 * @category mutations
 */
export const prepend = <A>(self: MutableList<A>, message: A): void => {
  self.head = {
    array: [message],
    mutable: true,
    offset: 0,
    next: self.head
  }
  self.length++
}

/**
 * Prepends all elements from an iterable to the beginning of the MutableList.
 * The elements are added in order, so the first element in the iterable becomes
 * the new head of the list.
 *
 * @example
 * ```ts
 * import { MutableList } from "effect/collections"
 *
 * const list = MutableList.make<number>()
 * MutableList.append(list, 4)
 * MutableList.append(list, 5)
 *
 * // Prepend multiple elements
 * MutableList.prependAll(list, [1, 2, 3])
 *
 * console.log(list.length) // 5
 *
 * // Elements are taken in order: [1, 2, 3, 4, 5]
 * console.log(MutableList.takeAll(list)) // [1, 2, 3, 4, 5]
 *
 * // Works with any iterable
 * const newList = MutableList.make<string>()
 * MutableList.prependAll(newList, "hello") // Prepends each character
 * console.log(MutableList.takeAll(newList)) // ["h", "e", "l", "l", "o"]
 * ```
 *
 * @since 4.0.0
 * @category mutations
 */
export const prependAll = <A>(self: MutableList<A>, messages: Iterable<A>): void =>
  prependAllUnsafe(self, Arr.fromIterable(messages), !Array.isArray(messages))

/**
 * Prepends all elements from a ReadonlyArray to the beginning of the MutableList.
 * This is an optimized version that can reuse the array when mutable=true.
 *
 * ⚠️ **Warning**: When mutable=true, the input array may be modified internally.
 * Only use mutable=true when you control the array lifecycle.
 *
 * @example
 * ```ts
 * import { MutableList } from "effect/collections"
 *
 * const list = MutableList.make<number>()
 * MutableList.append(list, 4)
 *
 * // Safe usage (default mutable=false)
 * const items = [1, 2, 3]
 * MutableList.prependAllUnsafe(list, items)
 * console.log(items) // [1, 2, 3] - unchanged
 *
 * // Unsafe but efficient usage (mutable=true)
 * const mutableItems = [10, 20, 30]
 * MutableList.prependAllUnsafe(list, mutableItems, true)
 * // mutableItems may be modified internally for efficiency
 *
 * console.log(MutableList.takeAll(list)) // [10, 20, 30, 1, 2, 3, 4]
 * ```
 *
 * @since 4.0.0
 * @category mutations
 */
export const prependAllUnsafe = <A>(self: MutableList<A>, messages: ReadonlyArray<A>, mutable = false): void => {
  self.head = {
    array: messages as Array<A>,
    mutable,
    offset: 0,
    next: self.head
  }
  self.length += self.head.array.length
}

/**
 * Appends all elements from an iterable to the end of the MutableList.
 * Returns the number of elements added.
 *
 * @example
 * ```ts
 * import { MutableList } from "effect/collections"
 *
 * const list = MutableList.make<number>()
 * MutableList.append(list, 1)
 * MutableList.append(list, 2)
 *
 * // Append multiple elements
 * const added = MutableList.appendAll(list, [3, 4, 5])
 * console.log(added) // 3
 * console.log(list.length) // 5
 *
 * // Elements maintain order: [1, 2, 3, 4, 5]
 * console.log(MutableList.takeAll(list)) // [1, 2, 3, 4, 5]
 *
 * // Works with any iterable
 * const newList = MutableList.make<string>()
 * MutableList.appendAll(newList, new Set(["a", "b", "c"]))
 * console.log(MutableList.takeAll(newList)) // ["a", "b", "c"]
 *
 * // Useful for bulk loading
 * const bulkList = MutableList.make<number>()
 * const count = MutableList.appendAll(bulkList, Array.from({ length: 1000 }, (_, i) => i))
 * console.log(count) // 1000
 * ```
 *
 * @since 4.0.0
 * @category mutations
 */
export const appendAll = <A>(self: MutableList<A>, messages: Iterable<A>): number =>
  appendAllUnsafe(self, Arr.fromIterable(messages), !Array.isArray(messages))

/**
 * Appends all elements from a ReadonlyArray to the end of the MutableList.
 * This is an optimized version that can reuse the array when mutable=true.
 * Returns the number of elements added.
 *
 * ⚠️ **Warning**: When mutable=true, the input array may be modified internally.
 * Only use mutable=true when you control the array lifecycle.
 *
 * @example
 * ```ts
 * import { MutableList } from "effect/collections"
 *
 * const list = MutableList.make<number>()
 * MutableList.append(list, 1)
 *
 * // Safe usage (default mutable=false)
 * const items = [2, 3, 4]
 * const added = MutableList.appendAllUnsafe(list, items)
 * console.log(added) // 3
 * console.log(items) // [2, 3, 4] - unchanged
 *
 * // Unsafe but efficient usage (mutable=true)
 * const mutableItems = [5, 6, 7]
 * MutableList.appendAllUnsafe(list, mutableItems, true)
 * // mutableItems may be modified internally for efficiency
 *
 * console.log(MutableList.takeAll(list)) // [1, 2, 3, 4, 5, 6, 7]
 *
 * // High-performance bulk operations
 * const bigArray = new Array(10000).fill(0).map((_, i) => i)
 * MutableList.appendAllUnsafe(list, bigArray, true) // Very efficient
 * ```
 *
 * @since 4.0.0
 * @category mutations
 */
export const appendAllUnsafe = <A>(self: MutableList<A>, messages: ReadonlyArray<A>, mutable = false): number => {
  const chunk: MutableList.Bucket<A> = {
    array: messages as Array<A>,
    mutable,
    offset: 0,
    next: undefined
  }
  if (self.head) {
    self.tail = self.tail!.next = chunk
  } else {
    self.head = self.tail = chunk
  }
  self.length += messages.length
  return messages.length
}

/**
 * Removes all elements from the MutableList, resetting it to an empty state.
 * This operation is highly optimized and releases all internal memory.
 *
 * @example
 * ```ts
 * import { MutableList } from "effect/collections"
 *
 * const list = MutableList.make<number>()
 * MutableList.appendAll(list, [1, 2, 3, 4, 5])
 *
 * console.log(list.length) // 5
 *
 * // Clear all elements
 * MutableList.clear(list)
 *
 * console.log(list.length) // 0
 * console.log(MutableList.take(list)) // Empty
 *
 * // Can still use the list after clearing
 * MutableList.append(list, 42)
 * console.log(list.length) // 1
 *
 * // Useful for resetting queues or buffers
 * function resetBuffer<T>(buffer: MutableList.MutableList<T>) {
 *   MutableList.clear(buffer)
 *   console.log("Buffer cleared and ready for reuse")
 * }
 * ```
 *
 * @since 4.0.0
 * @category mutations
 */
export const clear = <A>(self: MutableList<A>): void => {
  self.head = self.tail = undefined
  self.length = 0
}

/**
 * Takes up to N elements from the beginning of the MutableList and returns them as an array.
 * The taken elements are removed from the list. This operation is optimized for performance
 * and includes zero-copy optimizations when possible.
 *
 * @example
 * ```ts
 * import { MutableList } from "effect/collections"
 *
 * const list = MutableList.make<number>()
 * MutableList.appendAll(list, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
 *
 * console.log(list.length) // 10
 *
 * // Take first 3 elements
 * const first3 = MutableList.takeN(list, 3)
 * console.log(first3) // [1, 2, 3]
 * console.log(list.length) // 7
 *
 * // Take more than available
 * const remaining = MutableList.takeN(list, 20)
 * console.log(remaining) // [4, 5, 6, 7, 8, 9, 10]
 * console.log(list.length) // 0
 *
 * // Take from empty list
 * const empty = MutableList.takeN(list, 5)
 * console.log(empty) // []
 *
 * // Batch processing pattern
 * const queue = MutableList.make<string>()
 * MutableList.appendAll(queue, ["task1", "task2", "task3", "task4", "task5"])
 *
 * while (queue.length > 0) {
 *   const batch = MutableList.takeN(queue, 2) // Process 2 at a time
 *   console.log("Processing batch:", batch)
 * }
 * ```
 *
 * @since 4.0.0
 * @category elements
 */
export const takeN = <A>(self: MutableList<A>, n: number): Array<A> => {
  n = Math.min(n, self.length)
  if (n === self.length && self.head?.offset === 0 && !self.head.next) {
    const array = self.head.array
    clear(self)
    return array
  }
  const array = new Array<A>(n)
  let index = 0
  let chunk: MutableList.Bucket<A> | undefined = self.head
  while (chunk) {
    while (chunk.offset < chunk.array.length) {
      array[index++] = chunk.array[chunk.offset]
      if (chunk.mutable) chunk.array[chunk.offset] = undefined as any
      chunk.offset++
      if (index === n) {
        self.length -= n
        if (self.length === 0) clear(self)
        return array
      }
    }
    chunk = chunk.next
  }
  clear(self)
  return array
}

/**
 * Takes all elements from the MutableList and returns them as an array.
 * The list becomes empty after this operation. This is equivalent to takeN(list, list.length).
 *
 * @example
 * ```ts
 * import { MutableList } from "effect/collections"
 *
 * const list = MutableList.make<string>()
 * MutableList.appendAll(list, ["apple", "banana", "cherry"])
 *
 * console.log(list.length) // 3
 *
 * // Take all elements
 * const allItems = MutableList.takeAll(list)
 * console.log(allItems) // ["apple", "banana", "cherry"]
 * console.log(list.length) // 0
 *
 * // Useful for converting to array and clearing
 * const queue = MutableList.make<number>()
 * MutableList.appendAll(queue, [1, 2, 3, 4, 5])
 *
 * const snapshot = MutableList.takeAll(queue)
 * console.log("Queue contents:", snapshot)
 * console.log("Queue is now empty:", queue.length === 0)
 *
 * // Drain pattern for processing
 * function drainAndProcess<T>(list: MutableList.MutableList<T>, processor: (items: T[]) => void) {
 *   if (list.length > 0) {
 *     const items = MutableList.takeAll(list)
 *     processor(items)
 *   }
 * }
 * ```
 *
 * @since 4.0.0
 * @category elements
 */
export const takeAll = <A>(self: MutableList<A>): Array<A> => takeN(self, self.length)

/**
 * Takes a single element from the beginning of the MutableList.
 * Returns the element if available, or the Empty symbol if the list is empty.
 * The taken element is removed from the list.
 *
 * @example
 * ```ts
 * import { MutableList } from "effect/collections"
 *
 * const list = MutableList.make<string>()
 * MutableList.appendAll(list, ["first", "second", "third"])
 *
 * // Take elements one by one
 * console.log(MutableList.take(list)) // "first"
 * console.log(list.length) // 2
 *
 * console.log(MutableList.take(list)) // "second"
 * console.log(MutableList.take(list)) // "third"
 * console.log(list.length) // 0
 *
 * // Take from empty list
 * console.log(MutableList.take(list)) // Empty symbol
 *
 * // Check for empty using the Empty symbol
 * const result = MutableList.take(list)
 * if (result === MutableList.Empty) {
 *   console.log("List is empty")
 * } else {
 *   console.log("Got element:", result)
 * }
 *
 * // Consumer pattern
 * function processNext<T>(queue: MutableList.MutableList<T>, processor: (item: T) => void): boolean {
 *   const item = MutableList.take(queue)
 *   if (item !== MutableList.Empty) {
 *     processor(item)
 *     return true
 *   }
 *   return false
 * }
 * ```
 *
 * @since 4.0.0
 * @category elements
 */
export const take = <A>(self: MutableList<A>): Empty | A => {
  if (!self.head) return Empty
  const message = self.head.array[self.head.offset]
  if (self.head.mutable) self.head.array[self.head.offset] = undefined as any
  self.head.offset++
  self.length--
  if (self.head.offset === self.head.array.length) {
    if (self.head.next) {
      self.head = self.head.next
    } else {
      clear(self)
    }
  }
  return message
}

/**
 * Filters the MutableList in place, keeping only elements that satisfy the predicate.
 * This operation modifies the list and rebuilds its internal structure for efficiency.
 *
 * @example
 * ```ts
 * import { MutableList } from "effect/collections"
 *
 * const list = MutableList.make<number>()
 * MutableList.appendAll(list, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
 *
 * console.log(list.length) // 10
 *
 * // Keep only even numbers
 * MutableList.filter(list, (n) => n % 2 === 0)
 *
 * console.log(list.length) // 5
 * console.log(MutableList.takeAll(list)) // [2, 4, 6, 8, 10]
 *
 * // Filter with index
 * const indexed = MutableList.make<string>()
 * MutableList.appendAll(indexed, ["a", "b", "c", "d", "e"])
 *
 * // Keep elements at even indices
 * MutableList.filter(indexed, (value, index) => index % 2 === 0)
 * console.log(MutableList.takeAll(indexed)) // ["a", "c", "e"]
 *
 * // Real-world example: filtering a log queue
 * const logs = MutableList.make<{ level: string, message: string }>()
 * MutableList.appendAll(logs, [
 *   { level: "INFO", message: "App started" },
 *   { level: "ERROR", message: "Connection failed" },
 *   { level: "DEBUG", message: "Cache hit" },
 *   { level: "ERROR", message: "Timeout" }
 * ])
 *
 * // Keep only errors
 * MutableList.filter(logs, (log) => log.level === "ERROR")
 * console.log(MutableList.takeAll(logs)) // Only error logs
 * ```
 *
 * @since 4.0.0
 * @category mutations
 */
export const filter = <A>(self: MutableList<A>, f: (value: A, i: number) => boolean): void => {
  const array: Array<A> = []
  let chunk: MutableList.Bucket<A> | undefined = self.head
  while (chunk) {
    for (let i = chunk.offset; i < chunk.array.length; i++) {
      if (f(chunk.array[i], i)) {
        array.push(chunk.array[i])
      }
    }
    chunk = chunk.next
  }
  self.head = self.tail = {
    array,
    mutable: true,
    offset: 0,
    next: undefined
  }
}

/**
 * Removes all occurrences of a specific value from the MutableList.
 * This operation modifies the list in place.
 *
 * @example
 * ```ts
 * import { MutableList } from "effect/collections"
 *
 * const list = MutableList.make<string>()
 * MutableList.appendAll(list, ["apple", "banana", "apple", "cherry", "apple"])
 *
 * console.log(list.length) // 5
 *
 * // Remove all occurrences of "apple"
 * MutableList.remove(list, "apple")
 *
 * console.log(list.length) // 2
 * console.log(MutableList.takeAll(list)) // ["banana", "cherry"]
 *
 * // Remove non-existent value (no effect)
 * MutableList.remove(list, "grape")
 * console.log(list.length) // 2
 *
 * // Real-world example: removing completed tasks
 * const tasks = MutableList.make<{ id: number, status: string }>()
 * MutableList.appendAll(tasks, [
 *   { id: 1, status: "pending" },
 *   { id: 2, status: "completed" },
 *   { id: 3, status: "pending" },
 *   { id: 4, status: "completed" }
 * ])
 *
 * // Remove completed tasks by filtering status
 * MutableList.filter(tasks, (task) => task.status !== "completed")
 * console.log(MutableList.takeAll(tasks)) // Only pending tasks
 * ```
 *
 * @since 4.0.0
 * @category mutations
 */
export const remove = <A>(self: MutableList<A>, value: A): void => filter(self, (v) => v !== value)
