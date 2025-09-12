/**
 * @since 4.0.0
 */

/**
 * This module provides utility functions for working with arrays in TypeScript.
 *
 * @since 2.0.0
 */
export * as Array from "./Array.ts"

/**
 * The `Chunk` module provides an immutable, high-performance sequence data structure
 * optimized for functional programming patterns. A `Chunk` is a persistent data structure
 * that supports efficient append, prepend, and concatenation operations.
 *
 * ## What is a Chunk?
 *
 * A `Chunk<A>` is an immutable sequence of elements of type `A` that provides:
 * - **O(1) append and prepend operations**
 * - **Efficient concatenation** through tree-like structure
 * - **Memory efficiency** with structural sharing
 * - **Rich API** with functional programming operations
 * - **Type safety** with full TypeScript integration
 *
 * ## Key Features
 *
 * - **Immutable**: All operations return new chunks without modifying the original
 * - **Efficient**: Optimized data structure with logarithmic complexity for most operations
 * - **Functional**: Rich set of transformation and combination operators
 * - **Lazy evaluation**: Many operations are deferred until needed
 * - **Interoperable**: Easy conversion to/from arrays and other collections
 *
 * ## Performance Characteristics
 *
 * - **Append/Prepend**: O(1) amortized
 * - **Random Access**: O(log n)
 * - **Concatenation**: O(log min(m, n))
 * - **Iteration**: O(n)
 * - **Memory**: Structural sharing minimizes allocation
 *
 * @example
 * ```ts
 * import { Chunk } from "effect/collections"
 *
 * // Creating chunks
 * const chunk1 = Chunk.fromIterable([1, 2, 3])
 * const chunk2 = Chunk.fromIterable([4, 5, 6])
 * const empty = Chunk.empty<number>()
 *
 * // Combining chunks
 * const combined = Chunk.appendAll(chunk1, chunk2)
 * console.log(Chunk.toReadonlyArray(combined)) // [1, 2, 3, 4, 5, 6]
 * ```
 *
 * @example
 * ```ts
 * import { Chunk } from "effect/collections"
 *
 * // Functional transformations
 * const numbers = Chunk.range(1, 5) // [1, 2, 3, 4, 5]
 * const doubled = Chunk.map(numbers, (n) => n * 2) // [2, 4, 6, 8, 10]
 * const evens = Chunk.filter(doubled, (n) => n % 4 === 0) // [4, 8]
 * const sum = Chunk.reduce(evens, 0, (acc, n) => acc + n) // 12
 * ```
 *
 * @example
 * ```ts
 * import { Chunk } from "effect/collections"
import { Effect } from "effect"
 *
 * // Working with Effects
 * const processChunk = (chunk: Chunk.Chunk<number>) =>
 *   Effect.gen(function* () {
 *     const mapped = Chunk.map(chunk, (n) => n * 2)
 *     const filtered = Chunk.filter(mapped, (n) => n > 5)
 *     return Chunk.toReadonlyArray(filtered)
 *   })
 * ```
 *
 * @since 2.0.0
 */
export * as Chunk from "./Chunk.ts"

/**
 * @since 4.0.0
 */
export * as Graph from "./Graph.ts"

/**
 * @since 2.0.0
 */
export * as HashMap from "./HashMap.ts"

/**
 * @since 4.0.0
 */
export * as HashRing from "./HashRing.ts"

/**
 * @since 2.0.0
 */
export * as HashSet from "./HashSet.ts"

/**
 * This module provides utility functions for working with Iterables in TypeScript.
 *
 * Iterables are objects that implement the iterator protocol, allowing them to be
 * consumed with `for...of` loops, spread syntax, and other iteration constructs.
 * This module provides a comprehensive set of functions for creating, transforming,
 * and working with iterables in a functional programming style.
 *
 * Unlike arrays, iterables can be lazy and potentially infinite, making them suitable
 * for stream processing and memory-efficient data manipulation. All functions in this
 * module preserve the lazy nature of iterables where possible.
 *
 * @example
 * ```ts
 * import { Iterable } from "effect/collections"
 *
 * // Create iterables
 * const numbers = Iterable.range(1, 5)
 * const doubled = Iterable.map(numbers, x => x * 2)
 * const filtered = Iterable.filter(doubled, x => x > 5)
 *
 * console.log(Array.from(filtered)) // [6, 8, 10]
 *
 * // Infinite iterables
 * const fibonacci = Iterable.unfold([0, 1], ([a, b]) => [a, [b, a + b]])
 * const first10 = Iterable.take(fibonacci, 10)
 * console.log(Array.from(first10)) // [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
 * ```
 *
 * @since 2.0.0
 */
export * as Iterable from "./Iterable.ts"

/**
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
export * as MutableHashMap from "./MutableHashMap.ts"

/**
 * @fileoverview
 * MutableHashSet is a high-performance, mutable set implementation that provides efficient storage
 * and retrieval of unique values. Built on top of MutableHashMap, it inherits the same performance
 * characteristics and support for both structural and referential equality.
 *
 * The implementation uses a MutableHashMap internally where each value is stored as a key with a
 * boolean flag, providing O(1) average-case performance for all operations.
 *
 * Key Features:
 * - Mutable operations for performance-critical scenarios
 * - Supports both structural and referential equality
 * - Efficient duplicate detection and removal
 * - Iterable interface for easy traversal
 * - Memory-efficient storage with automatic deduplication
 * - Seamless integration with Effect's Equal and Hash interfaces
 *
 * Performance Characteristics:
 * - Add/Has/Remove: O(1) average, O(n) worst case (hash collisions)
 * - Clear: O(1)
 * - Size: O(1)
 * - Iteration: O(n)
 *
 * @since 2.0.0
 * @category data-structures
 */
export * as MutableHashSet from "./MutableHashSet.ts"

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
export * as MutableList from "./MutableList.ts"

/**
 * @since 2.0.0
 *
 * The `NonEmptyIterable` module provides types and utilities for working with iterables
 * that are guaranteed to contain at least one element. This provides compile-time
 * safety when working with collections that must not be empty.
 *
 * ## Key Features
 *
 * - **Type Safety**: Compile-time guarantee that the iterable contains at least one element
 * - **Iterator Protocol**: Fully compatible with JavaScript's built-in iteration protocol
 * - **Functional Operations**: Safe operations that preserve the non-empty property
 * - **Lightweight**: Minimal overhead with maximum type safety
 *
 * ## Why NonEmptyIterable?
 *
 * Many operations require non-empty collections to be meaningful:
 * - Finding the maximum or minimum value
 * - Getting the first or last element
 * - Reducing without an initial value
 * - Operations that would otherwise need runtime checks
 *
 * ## Basic Usage
 *
 * ```ts
 * import * as NonEmptyIterable from "effect/collections/NonEmptyIterable"
 *
 * // NonEmptyIterable is a type that represents any iterable with at least one element
 * function processNonEmpty<A>(data: NonEmptyIterable.NonEmptyIterable<A>): A {
 *   // Safe to get the first element - guaranteed to exist
 *   const [first] = NonEmptyIterable.unprepend(data)
 *   return first
 * }
 *
 * // Using Array.make to create non-empty arrays
 * const numbers = Array.make(1, 2, 3, 4, 5) as unknown as NonEmptyIterable.NonEmptyIterable<number>
 * const firstNumber = processNonEmpty(numbers) // number
 *
 * // Regular arrays can be asserted as NonEmptyIterable when known to be non-empty
 * const values = [1, 2, 3] as unknown as NonEmptyIterable.NonEmptyIterable<number>
 * const firstValue = processNonEmpty(values) // number
 *
 * // Custom iterables that are guaranteed non-empty
 * function* generateNumbers(): NonEmptyIterable.NonEmptyIterable<number> {
 *   yield 1
 *   yield 2
 *   yield 3
 * }
 *
 * const firstGenerated = processNonEmpty(generateNumbers()) // number
 * ```
 *
 * ## Working with Different Iterable Types
 *
 * ```ts
 * import { pipe } from "effect"
 * import * as NonEmptyIterable from "effect/collections/NonEmptyIterable"
 * import { Array } from "effect/collections"
 * import * as Chunk from "effect/collections/Chunk"
 *
 * // Creating non-empty arrays
 * const nonEmptyArray = Array.make(1, 2, 3) as unknown as NonEmptyIterable.NonEmptyIterable<number>
 *
 * // Working with strings (assert as NonEmptyIterable when known to be non-empty)
 * const nonEmptyString = "hello" as unknown as NonEmptyIterable.NonEmptyIterable<string>
 * const [firstChar] = NonEmptyIterable.unprepend(nonEmptyString)
 * console.log(firstChar) // "h"
 *
 * // Working with Maps (assert when known to be non-empty)
 * const nonEmptyMap = new Map([
 *   ["key1", "value1"],
 *   ["key2", "value2"]
 * ]) as unknown as NonEmptyIterable.NonEmptyIterable<[string, string]>
 * const [firstEntry] = NonEmptyIterable.unprepend(nonEmptyMap)
 * console.log(firstEntry) // ["key1", "value1"]
 *
 * // Custom generator functions
 * function* fibonacci(): NonEmptyIterable.NonEmptyIterable<number> {
 *   let a = 1, b = 1
 *   yield a
 *   while (true) {
 *     yield b
 *     const next = a + b
 *     a = b
 *     b = next
 *   }
 * }
 *
 * const [firstFib, restFib] = NonEmptyIterable.unprepend(fibonacci() as unknown as NonEmptyIterable.NonEmptyIterable<number>)
 * console.log(firstFib) // 1
 * ```
 *
 * ## Integration with Effect Arrays
 *
 * ```ts
 * import { pipe } from "effect"
 * import * as NonEmptyIterable from "effect/collections/NonEmptyIterable"
 * import { Array } from "effect/collections"
 * import * as Chunk from "effect/collections/Chunk"
 *
 * // Many Array functions work with NonEmptyIterable
 * declare const nonEmptyData: NonEmptyIterable.NonEmptyIterable<number>
 *
 * const processData = pipe(
 *   nonEmptyData,
 *   Array.fromIterable,
 *   Array.map(x => x * 2),
 *   Array.filter(x => x > 5),
 *   // Result is a regular array since filtering might make it empty
 * )
 *
 * // Safe operations that preserve non-emptiness
 * const doubledData = pipe(
 *   nonEmptyData,
 *   Array.fromIterable,
 *   Array.map(x => x * 2)
 *   // This would still be non-empty if the source was non-empty
 * )
 * ```
 */
export * as NonEmptyIterable from "./NonEmptyIterable.ts"

/**
 * A `Trie` is used for locating specific `string` keys from within a set.
 *
 * It works similar to `HashMap`, but with keys required to be `string`.
 * This constraint unlocks some performance optimizations and new methods to get string prefixes (e.g. `keysWithPrefix`, `longestPrefixOf`).
 *
 * Prefix search is also the main feature that makes a `Trie` more suited than `HashMap` for certain usecases.
 *
 * A `Trie` is often used to store a dictionary (list of words) that can be searched
 * in a manner that allows for efficient generation of completion lists
 * (e.g. predict the rest of a word a user is typing).
 *
 * A `Trie` has O(n) lookup time where `n` is the size of the key,
 * or even less than `n` on search misses.
 *
 * @since 2.0.0
 */
export * as Trie from "./Trie.ts"
