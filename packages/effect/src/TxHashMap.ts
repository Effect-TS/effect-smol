/**
 * @since 2.0.0
 */

import * as Effect from "./Effect.js"
import { dual } from "./Function.js"
import * as HashMap from "./HashMap.js"
import type { Inspectable } from "./Inspectable.js"
import { format, NodeInspectSymbol, toJSON } from "./Inspectable.js"
import * as Option from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"
import * as TxRef from "./TxRef.js"

/**
 * Unique identifier for TxHashMap instances.
 *
 * @example
 * ```ts
 * import { TxHashMap } from "effect"
 *
 * // The TypeId constant can be used for runtime identification
 * console.log(TxHashMap.TypeId) // "~effect/TxHashMap"
 *
 * // Or for creating type guards
 * const isTxHashMap = (value: unknown): value is TxHashMap.TxHashMap<any, any> => {
 *   return typeof value === "object" && value !== null && TxHashMap.TypeId in value
 * }
 * ```
 *
 * @since 2.0.0
 * @category symbols
 */
export const TypeId: "~effect/TxHashMap" = "~effect/TxHashMap" as const

/**
 * Type identifier for TxHashMap instances.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect } from "effect"
 *
 * // Use TypeId for type guards in runtime checks
 * const validateTxHashMap = <K, V>(value: unknown): value is TxHashMap.TxHashMap<K, V> => {
 *   return typeof value === "object" && value !== null && TxHashMap.TypeId in value
 * }
 *
 * const program = Effect.gen(function* () {
 *   const txMap = yield* TxHashMap.make(["key", "value"])
 *   console.log(validateTxHashMap(txMap)) // true
 * })
 * ```
 *
 * @since 2.0.0
 * @category symbols
 */
export type TypeId = typeof TypeId

const TxHashMapProto = {
  [TypeId]: TypeId,
  [NodeInspectSymbol](this: TxHashMap<unknown, unknown>) {
    return toJSON(this)
  },
  toJSON(this: TxHashMap<unknown, unknown>) {
    return {
      _id: "TxHashMap",
      ref: toJSON((this as any).ref)
    }
  },
  toString(this: TxHashMap<unknown, unknown>) {
    return format(this.toJSON())
  },
  pipe(this: TxHashMap<unknown, unknown>) {
    return pipeArguments(this, arguments)
  }
}

/**
 * A TxHashMap is a transactional hash map data structure that provides atomic operations
 * on key-value pairs within Effect transactions. It uses an immutable HashMap internally
 * with TxRef for transactional semantics, ensuring all operations are performed atomically.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect, Option } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   // Create a transactional hash map
 *   const txMap = yield* TxHashMap.make(["user1", "Alice"], ["user2", "Bob"])
 *
 *   // Single operations are automatically transactional
 *   yield* TxHashMap.set(txMap, "user3", "Charlie")
 *   const user = yield* TxHashMap.get(txMap, "user1")
 *   console.log(user) // Option.some("Alice")
 *
 *   // Multi-step atomic operations
 *   yield* Effect.transaction(
 *     Effect.gen(function* () {
 *       const currentUser = yield* TxHashMap.get(txMap, "user1")
 *       if (Option.isSome(currentUser)) {
 *         yield* TxHashMap.set(txMap, "user1", currentUser.value + "_updated")
 *         yield* TxHashMap.remove(txMap, "user2")
 *       }
 *     })
 *   )
 *
 *   const size = yield* TxHashMap.size(txMap)
 *   console.log(size) // 2
 * })
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface TxHashMap<in out K, in out V> extends Inspectable, Pipeable {
  readonly [TypeId]: TypeId
  readonly ref: TxRef.TxRef<HashMap.HashMap<K, V>>
}

/**
 * The TxHashMap namespace contains type-level utilities and helper types
 * for working with TxHashMap instances.
 *
 * @example
 * ```ts
 * import { TxHashMap, HashMap, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   // Create a transactional inventory map
 *   const inventory = yield* TxHashMap.make(
 *     ["laptop", { stock: 5, price: 999 }],
 *     ["mouse", { stock: 20, price: 29 }]
 *   )
 *
 *   // Extract types for reuse
 *   type ProductId = TxHashMap.TxHashMap.Key<typeof inventory>     // string
 *   type Product = TxHashMap.TxHashMap.Value<typeof inventory>     // { stock: number, price: number }
 *   type InventoryEntry = TxHashMap.TxHashMap.Entry<typeof inventory> // [string, Product]
 *
 *   // Use extracted types in functions
 *   const updateStock = (id: ProductId, newStock: number) =>
 *     TxHashMap.modify(inventory, id, (product) => ({ ...product, stock: newStock }))
 *
 *   yield* updateStock("laptop", 3)
 * })
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export declare namespace TxHashMap {
  /**
   * Extracts the key type from a TxHashMap type.
   *
   * @example
   * ```ts
   * import { TxHashMap, Effect } from "effect"
   *
   * const program = Effect.gen(function* () {
   *   // Create a user map to extract key type from
   *   const userMap = yield* TxHashMap.make(
   *     ["alice", { name: "Alice", age: 30 }],
   *     ["bob", { name: "Bob", age: 25 }]
   *   )
   *
   *   // Extract the key type (string)
   *   type UserKey = TxHashMap.TxHashMap.Key<typeof userMap>
   *
   *   // Use the extracted type in functions
   *   const getUserById = (id: UserKey) => TxHashMap.get(userMap, id)
   *   const alice = yield* getUserById("alice") // Option<{ name: string, age: number }>
   * })
   * ```
   *
   * @since 2.0.0
   * @category type-level
   */
  export type Key<T extends TxHashMap<any, any>> = T extends TxHashMap<infer K, any> ? K : never

  /**
   * Extracts the value type from a TxHashMap type.
   *
   * @example
   * ```ts
   * import { TxHashMap, Effect } from "effect"
   *
   * const program = Effect.gen(function* () {
   *   // Create a product catalog TxHashMap
   *   const catalog = yield* TxHashMap.make(
   *     ["laptop", { price: 999, category: "electronics" }],
   *     ["book", { price: 29, category: "education" }]
   *   )
   *
   *   // Extract the value type (Product)
   *   type Product = TxHashMap.TxHashMap.Value<typeof catalog>
   *
   *   // Use the extracted type for type-safe operations
   *   const processProduct = (product: Product) => {
   *     return `${product.category}: $${product.price}`
   *   }
   *
   *   const laptop = yield* TxHashMap.get(catalog, "laptop")
   *   // laptop has type Option<Product> thanks to type extraction
   * })
   * ```
   *
   * @since 2.0.0
   * @category type-level
   */
  export type Value<T extends TxHashMap<any, any>> = T extends TxHashMap<any, infer V> ? V : never

  /**
   * Extracts the entry type from a TxHashMap type.
   *
   * @example
   * ```ts
   * import { TxHashMap, Effect } from "effect"
   *
   * const program = Effect.gen(function* () {
   *   // Create a configuration TxHashMap
   *   const config = yield* TxHashMap.make(
   *     ["api_url", "https://api.example.com"],
   *     ["timeout", "5000"],
   *     ["retries", "3"]
   *   )
   *
   *   // Extract the entry type [string, string]
   *   type ConfigEntry = TxHashMap.TxHashMap.Entry<typeof config>
   *
   *   // Use the extracted type for processing entries
   *   const processEntry = ([key, value]: ConfigEntry) => {
   *     return `${key}=${value}`
   *   }
   *
   *   // Get all entries and process them
   *   const entries = yield* TxHashMap.entries(config)
   *   const configLines = entries.map(processEntry)
   *   console.log(configLines) // ["api_url=https://api.example.com", ...]
   * })
   * ```
   *
   * @since 2.0.0
   * @category type-level
   */
  export type Entry<T extends TxHashMap<any, any>> = T extends TxHashMap<infer K, infer V> ? readonly [K, V] : never
}

/**
 * Creates an empty TxHashMap.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   // Create an empty transactional hash map
 *   const emptyMap = yield* TxHashMap.empty<string, number>()
 *
 *   // Verify it's empty
 *   const isEmpty = yield* TxHashMap.isEmpty(emptyMap)
 *   console.log(isEmpty) // true
 *
 *   const size = yield* TxHashMap.size(emptyMap)
 *   console.log(size) // 0
 *
 *   // Start adding elements
 *   yield* TxHashMap.set(emptyMap, "first", 1)
 *   const newSize = yield* TxHashMap.size(emptyMap)
 *   console.log(newSize) // 1
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const empty = <K, V>(): Effect.Effect<TxHashMap<K, V>> =>
  Effect.gen(function*() {
    const ref = yield* TxRef.make(HashMap.empty<K, V>())
    return Object.assign(Object.create(TxHashMapProto), { ref })
  })

/**
 * Creates a TxHashMap from the provided key-value pairs.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect, Option } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   // Create a user directory
 *   const userMap = yield* TxHashMap.make(
 *     ["alice", { name: "Alice Smith", role: "admin" }],
 *     ["bob", { name: "Bob Johnson", role: "user" }],
 *     ["charlie", { name: "Charlie Brown", role: "user" }]
 *   )
 *
 *   // Check the initial size
 *   const size = yield* TxHashMap.size(userMap)
 *   console.log(size) // 3
 *
 *   // Access users
 *   const alice = yield* TxHashMap.get(userMap, "alice")
 *   console.log(alice) // Option.some({ name: "Alice Smith", role: "admin" })
 *
 *   const nonExistent = yield* TxHashMap.get(userMap, "david")
 *   console.log(nonExistent) // Option.none()
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const make = <K, V>(...entries: Array<readonly [K, V]>): Effect.Effect<TxHashMap<K, V>> =>
  Effect.gen(function*() {
    const hashMap = HashMap.make(...entries)
    const ref = yield* TxRef.make(hashMap)
    return Object.assign(Object.create(TxHashMapProto), { ref })
  })

/**
 * Creates a TxHashMap from an iterable of key-value pairs.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   // Create from various iterable sources
 *   const configEntries = [
 *     ["database.host", "localhost"],
 *     ["database.port", "5432"],
 *     ["cache.enabled", "true"],
 *     ["logging.level", "info"]
 *   ] as const
 *
 *   const configMap = yield* TxHashMap.fromIterable(configEntries)
 *
 *   // Verify the configuration was loaded
 *   const size = yield* TxHashMap.size(configMap)
 *   console.log(size) // 4
 *
 *   const dbHost = yield* TxHashMap.get(configMap, "database.host")
 *   console.log(dbHost) // Option.some("localhost")
 *
 *   // Can also create from Map, Set of tuples, etc.
 *   const jsMap = new Map([["key1", "value1"], ["key2", "value2"]])
 *   const txMapFromJs = yield* TxHashMap.fromIterable(jsMap)
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromIterable = <K, V>(entries: Iterable<readonly [K, V]>): Effect.Effect<TxHashMap<K, V>> =>
  Effect.gen(function*() {
    const hashMap = HashMap.fromIterable(entries)
    const ref = yield* TxRef.make(hashMap)
    return Object.assign(Object.create(TxHashMapProto), { ref })
  })

/**
 * Safely lookup the value for the specified key in the TxHashMap.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect, Option } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const userMap = yield* TxHashMap.make(
 *     ["alice", { name: "Alice", role: "admin" }],
 *     ["bob", { name: "Bob", role: "user" }]
 *   )
 *
 *   // Safe lookup - returns Option
 *   const alice = yield* TxHashMap.get(userMap, "alice")
 *   console.log(alice) // Option.some({ name: "Alice", role: "admin" })
 *
 *   const nonExistent = yield* TxHashMap.get(userMap, "charlie")
 *   console.log(nonExistent) // Option.none()
 *
 *   // Use with pipe syntax for type-safe access
 *   const bobRole = yield* TxHashMap.get(userMap, "bob")
 *   if (Option.isSome(bobRole)) {
 *     console.log(bobRole.value.role) // "user"
 *   }
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const get: {
  <K1 extends K, K>(key: K1): <V>(self: TxHashMap<K, V>) => Effect.Effect<Option.Option<V>>
  <K1 extends K, K, V>(self: TxHashMap<K, V>, key: K1): Effect.Effect<Option.Option<V>>
} = dual(
  2,
  <K1 extends K, K, V>(self: TxHashMap<K, V>, key: K1): Effect.Effect<Option.Option<V>> =>
    Effect.gen(function*() {
      const map = yield* TxRef.get(self.ref)
      return HashMap.get(map, key)
    })
)

/**
 * Sets the value for the specified key in the TxHashMap.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect, Option } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const inventory = yield* TxHashMap.make(
 *     ["laptop", 5],
 *     ["mouse", 20]
 *   )
 *
 *   // Update existing item
 *   yield* TxHashMap.set(inventory, "laptop", 3)
 *   const laptopStock = yield* TxHashMap.get(inventory, "laptop")
 *   console.log(laptopStock) // Option.some(3)
 *
 *   // Add new item
 *   yield* TxHashMap.set(inventory, "keyboard", 15)
 *   const keyboardStock = yield* TxHashMap.get(inventory, "keyboard")
 *   console.log(keyboardStock) // Option.some(15)
 *
 *   // Use with pipe syntax
 *   yield* TxHashMap.set("tablet", 8)(inventory)
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const set: {
  <K, V>(key: K, value: V): (self: TxHashMap<K, V>) => Effect.Effect<void>
  <K, V>(self: TxHashMap<K, V>, key: K, value: V): Effect.Effect<void>
} = dual(
  3,
  <K, V>(self: TxHashMap<K, V>, key: K, value: V): Effect.Effect<void> =>
    TxRef.update(self.ref, (map) => HashMap.set(map, key, value))
)

/**
 * Checks if the specified key exists in the TxHashMap.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const permissions = yield* TxHashMap.make(
 *     ["alice", ["read", "write"]],
 *     ["bob", ["read"]],
 *     ["charlie", ["admin"]]
 *   )
 *
 *   // Check if users exist
 *   const hasAlice = yield* TxHashMap.has(permissions, "alice")
 *   console.log(hasAlice) // true
 *
 *   const hasDavid = yield* TxHashMap.has(permissions, "david")
 *   console.log(hasDavid) // false
 *
 *   // Use direct method call for type-safe access
 *   const hasBob = yield* TxHashMap.has(permissions, "bob")
 *   console.log(hasBob) // true
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const has: {
  <K1 extends K, K>(key: K1): <V>(self: TxHashMap<K, V>) => Effect.Effect<boolean>
  <K1 extends K, K, V>(self: TxHashMap<K, V>, key: K1): Effect.Effect<boolean>
} = dual(
  2,
  <K1 extends K, K, V>(self: TxHashMap<K, V>, key: K1): Effect.Effect<boolean> =>
    Effect.gen(function*() {
      const map = yield* TxRef.get(self.ref)
      return HashMap.has(map, key)
    })
)

/**
 * Removes the specified key from the TxHashMap.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const cache = yield* TxHashMap.make(
 *     ["user:1", { name: "Alice", lastSeen: "2024-01-01" }],
 *     ["user:2", { name: "Bob", lastSeen: "2024-01-02" }],
 *     ["user:3", { name: "Charlie", lastSeen: "2023-12-30" }]
 *   )
 *
 *   // Remove expired user
 *   const removed = yield* TxHashMap.remove(cache, "user:3")
 *   console.log(removed) // true (key existed and was removed)
 *
 *   // Try to remove non-existent key
 *   const notRemoved = yield* TxHashMap.remove(cache, "user:999")
 *   console.log(notRemoved) // false (key didn't exist)
 *
 *   // Verify removal
 *   const hasUser3 = yield* TxHashMap.has(cache, "user:3")
 *   console.log(hasUser3) // false
 *
 *   const size = yield* TxHashMap.size(cache)
 *   console.log(size) // 2
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const remove: {
  <K1 extends K, K>(key: K1): <V>(self: TxHashMap<K, V>) => Effect.Effect<boolean>
  <K1 extends K, K, V>(self: TxHashMap<K, V>, key: K1): Effect.Effect<boolean>
} = dual(
  2,
  <K1 extends K, K, V>(self: TxHashMap<K, V>, key: K1): Effect.Effect<boolean> =>
    Effect.gen(function*() {
      const currentMap = yield* TxRef.get(self.ref)
      const existed = HashMap.has(currentMap, key)
      if (existed) {
        yield* TxRef.set(self.ref, HashMap.remove(currentMap, key))
      }
      return existed
    })
)

/**
 * Removes all entries from the TxHashMap.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const sessionMap = yield* TxHashMap.make(
 *     ["session1", { userId: "alice", expires: "2024-01-01T12:00:00Z" }],
 *     ["session2", { userId: "bob", expires: "2024-01-01T13:00:00Z" }],
 *     ["session3", { userId: "charlie", expires: "2024-01-01T14:00:00Z" }]
 *   )
 *
 *   // Check initial state
 *   const initialSize = yield* TxHashMap.size(sessionMap)
 *   console.log(initialSize) // 3
 *
 *   // Clear all sessions (e.g., during maintenance)
 *   yield* TxHashMap.clear(sessionMap)
 *
 *   // Verify cleared
 *   const finalSize = yield* TxHashMap.size(sessionMap)
 *   console.log(finalSize) // 0
 *
 *   const isEmpty = yield* TxHashMap.isEmpty(sessionMap)
 *   console.log(isEmpty) // true
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const clear = <K, V>(self: TxHashMap<K, V>): Effect.Effect<void> => TxRef.set(self.ref, HashMap.empty<K, V>())

/**
 * Returns the number of entries in the TxHashMap.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const metrics = yield* TxHashMap.make(
 *     ["requests", 1000],
 *     ["errors", 5],
 *     ["users", 50]
 *   )
 *
 *   const count = yield* TxHashMap.size(metrics)
 *   console.log(count) // 3
 *
 *   // Add more metrics
 *   yield* TxHashMap.set(metrics, "response_time", 250)
 *   const newCount = yield* TxHashMap.size(metrics)
 *   console.log(newCount) // 4
 *
 *   // Remove a metric
 *   yield* TxHashMap.remove(metrics, "errors")
 *   const finalCount = yield* TxHashMap.size(metrics)
 *   console.log(finalCount) // 3
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const size = <K, V>(self: TxHashMap<K, V>): Effect.Effect<number> =>
  Effect.gen(function*() {
    const map = yield* TxRef.get(self.ref)
    return HashMap.size(map)
  })

/**
 * Checks if the TxHashMap is empty.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   // Start with empty map
 *   const cache = yield* TxHashMap.empty<string, any>()
 *   const empty = yield* TxHashMap.isEmpty(cache)
 *   console.log(empty) // true
 *
 *   // Add an item
 *   yield* TxHashMap.set(cache, "key1", "value1")
 *   const stillEmpty = yield* TxHashMap.isEmpty(cache)
 *   console.log(stillEmpty) // false
 *
 *   // Clear and check again
 *   yield* TxHashMap.clear(cache)
 *   const emptyAgain = yield* TxHashMap.isEmpty(cache)
 *   console.log(emptyAgain) // true
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const isEmpty = <K, V>(self: TxHashMap<K, V>): Effect.Effect<boolean> =>
  Effect.gen(function*() {
    const map = yield* TxRef.get(self.ref)
    return HashMap.isEmpty(map)
  })

/**
 * Checks if the TxHashMap is non-empty.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const inventory = yield* TxHashMap.make(["laptop", 5])
 *
 *   const hasItems = yield* TxHashMap.isNonEmpty(inventory)
 *   console.log(hasItems) // true
 *
 *   // Clear inventory
 *   yield* TxHashMap.clear(inventory)
 *   const stillHasItems = yield* TxHashMap.isNonEmpty(inventory)
 *   console.log(stillHasItems) // false
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const isNonEmpty = <K, V>(self: TxHashMap<K, V>): Effect.Effect<boolean> =>
  Effect.map(isEmpty(self), (empty) => !empty)

/**
 * Updates the value for the specified key if it exists.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect, Option } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const counters = yield* TxHashMap.make(
 *     ["downloads", 100],
 *     ["views", 250]
 *   )
 *
 *   // Increment existing counter
 *   const oldDownloads = yield* TxHashMap.modify(counters, "downloads", (count) => count + 1)
 *   console.log(oldDownloads) // Option.some(100)
 *
 *   const newDownloads = yield* TxHashMap.get(counters, "downloads")
 *   console.log(newDownloads) // Option.some(101)
 *
 *   // Try to modify non-existent key
 *   const nonExistent = yield* TxHashMap.modify(counters, "clicks", (count) => count + 1)
 *   console.log(nonExistent) // Option.none()
 *
 *   // Update views counter with direct method call
 *   yield* TxHashMap.modify(counters, "views", (views) => views * 2)
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const modify: {
  <K, V>(key: K, f: (value: V) => V): (self: TxHashMap<K, V>) => Effect.Effect<Option.Option<V>>
  <K, V>(self: TxHashMap<K, V>, key: K, f: (value: V) => V): Effect.Effect<Option.Option<V>>
} = dual(
  3,
  <K, V>(self: TxHashMap<K, V>, key: K, f: (value: V) => V): Effect.Effect<Option.Option<V>> =>
    Effect.gen(function*() {
      const currentMap = yield* TxRef.get(self.ref)
      const currentValue = HashMap.get(currentMap, key)
      if (Option.isSome(currentValue)) {
        const newValue = f(currentValue.value)
        yield* TxRef.set(self.ref, HashMap.set(currentMap, key, newValue))
        return currentValue
      }
      return Option.none()
    })
)

/**
 * Updates the value for the specified key using an Option-based update function.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect, Option } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const storage = yield* TxHashMap.make<string, string | number>(["file1.txt", "content1"], ["access_count", 0])
 *
 *   // Increment counter or initialize to 1
 *   const updateFn = (opt: Option.Option<string | number>) =>
 *     Option.isSome(opt) && typeof opt.value === "number"
 *       ? Option.some(opt.value + 1)
 *       : Option.some(1)
 *
 *   // Increment existing counter
 *   yield* TxHashMap.modifyAt(storage, "access_count", updateFn)
 *   const count1 = yield* TxHashMap.get(storage, "access_count")
 *   console.log(count1) // Option.some(1)
 *
 *   // Increment existing counter again
 *   yield* TxHashMap.modifyAt(storage, "access_count", updateFn)
 *   const count2 = yield* TxHashMap.get(storage, "access_count")
 *   console.log(count2) // Option.some(2)
 *
 *   // Remove by returning None
 *   yield* TxHashMap.modifyAt(storage, "file1.txt", () => Option.none())
 *   const hasFile = yield* TxHashMap.has(storage, "file1.txt")
 *   console.log(hasFile) // false
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const modifyAt: {
  <K, V>(key: K, f: (value: Option.Option<V>) => Option.Option<V>): (self: TxHashMap<K, V>) => Effect.Effect<void>
  <K, V>(self: TxHashMap<K, V>, key: K, f: (value: Option.Option<V>) => Option.Option<V>): Effect.Effect<void>
} = dual(
  3,
  <K, V>(self: TxHashMap<K, V>, key: K, f: (value: Option.Option<V>) => Option.Option<V>): Effect.Effect<void> =>
    Effect.gen(function*() {
      const currentMap = yield* TxRef.get(self.ref)
      const currentValue = HashMap.get(currentMap, key)
      const newValue = f(currentValue)

      if (Option.isSome(newValue)) {
        yield* TxRef.set(self.ref, HashMap.set(currentMap, key, newValue.value))
      } else if (Option.isSome(currentValue)) {
        yield* TxRef.set(self.ref, HashMap.remove(currentMap, key))
      }
    })
)

/**
 * Returns an array of all keys in the TxHashMap.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect, Option } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const userRoles = yield* TxHashMap.make(
 *     ["alice", "admin"],
 *     ["bob", "user"],
 *     ["charlie", "moderator"]
 *   )
 *
 *   const usernames = yield* TxHashMap.keys(userRoles)
 *   console.log(usernames.sort()) // ["alice", "bob", "charlie"]
 *
 *   // Useful for iteration
 *   for (const username of usernames) {
 *     const role = yield* TxHashMap.get(userRoles, username)
 *     if (Option.isSome(role)) {
 *       console.log(`${username}: ${role.value}`)
 *     }
 *   }
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const keys = <K, V>(self: TxHashMap<K, V>): Effect.Effect<Array<K>> =>
  Effect.gen(function*() {
    const map = yield* TxRef.get(self.ref)
    return Array.from(HashMap.keys(map))
  })

/**
 * Returns an array of all values in the TxHashMap.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const scores = yield* TxHashMap.make(
 *     ["alice", 95],
 *     ["bob", 87],
 *     ["charlie", 92]
 *   )
 *
 *   const allScores = yield* TxHashMap.values(scores)
 *   console.log(allScores.sort()) // [87, 92, 95]
 *
 *   // Calculate average
 *   const average = allScores.reduce((sum, score) => sum + score, 0) / allScores.length
 *   console.log(average) // 91.33
 *
 *   // Find maximum
 *   const maxScore = Math.max(...allScores)
 *   console.log(maxScore) // 95
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const values = <K, V>(self: TxHashMap<K, V>): Effect.Effect<Array<V>> =>
  Effect.gen(function*() {
    const map = yield* TxRef.get(self.ref)
    return HashMap.toValues(map)
  })

/**
 * Returns an array of all key-value pairs in the TxHashMap.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const config = yield* TxHashMap.make(
 *     ["host", "localhost"],
 *     ["port", "3000"],
 *     ["ssl", "false"]
 *   )
 *
 *   const allEntries = yield* TxHashMap.entries(config)
 *   console.log(allEntries)
 *   // [["host", "localhost"], ["port", "3000"], ["ssl", "false"]]
 *
 *   // Process configuration entries
 *   for (const [key, value] of allEntries) {
 *     console.log(`${key}=${value}`)
 *   }
 *   // host=localhost
 *   // port=3000
 *   // ssl=false
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const entries = <K, V>(self: TxHashMap<K, V>): Effect.Effect<Array<readonly [K, V]>> =>
  Effect.gen(function*() {
    const map = yield* TxRef.get(self.ref)
    return HashMap.toEntries(map)
  })

/**
 * Returns an immutable snapshot of the current TxHashMap state.
 *
 * @example
 * ```ts
 * import { TxHashMap, HashMap, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const liveData = yield* TxHashMap.make(
 *     ["temperature", 22.5],
 *     ["humidity", 45.2],
 *     ["pressure", 1013.25]
 *   )
 *
 *   // Take snapshot for reporting
 *   const snapshot = yield* TxHashMap.snapshot(liveData)
 *
 *   // Continue modifying live data
 *   yield* TxHashMap.set(liveData, "temperature", 23.1)
 *   yield* TxHashMap.set(liveData, "wind_speed", 5.3)
 *
 *   // Snapshot remains unchanged
 *   console.log(HashMap.size(snapshot)) // 3
 *   console.log(HashMap.get(snapshot, "temperature")) // Option.some(22.5)
 *
 *   // Can use regular HashMap operations on snapshot
 *   const tempReading = HashMap.get(snapshot, "temperature")
 *   const humidityReading = HashMap.get(snapshot, "humidity")
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const snapshot = <K, V>(self: TxHashMap<K, V>): Effect.Effect<HashMap.HashMap<K, V>> => TxRef.get(self.ref)

/**
 * Merges another HashMap into this TxHashMap. If both maps contain the same key,
 * the value from the other map will be used.
 *
 * @example
 * ```ts
 * import { TxHashMap, HashMap, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   // Create initial user preferences
 *   const userPrefs = yield* TxHashMap.make(
 *     ["theme", "light"],
 *     ["language", "en"],
 *     ["notifications", "enabled"]
 *   )
 *
 *   // New preferences to merge in
 *   const newSettings = HashMap.make(
 *     ["theme", "dark"],        // will override existing
 *     ["timezone", "UTC"],      // new setting
 *     ["sound", "enabled"]      // new setting
 *   )
 *
 *   // Merge the new settings
 *   yield* TxHashMap.union(userPrefs, newSettings)
 *
 *   // Check the merged result
 *   const theme = yield* TxHashMap.get(userPrefs, "theme")
 *   console.log(theme) // Option.some("dark") - overridden
 *
 *   const language = yield* TxHashMap.get(userPrefs, "language")
 *   console.log(language) // Option.some("en") - preserved
 *
 *   const timezone = yield* TxHashMap.get(userPrefs, "timezone")
 *   console.log(timezone) // Option.some("UTC") - newly added
 *
 *   const size = yield* TxHashMap.size(userPrefs)
 *   console.log(size) // 5 total settings
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const union: {
  <K1 extends K, K, V1 extends V, V>(other: HashMap.HashMap<K1, V1>): (self: TxHashMap<K, V>) => Effect.Effect<void>
  <K1 extends K, K, V1 extends V, V>(self: TxHashMap<K, V>, other: HashMap.HashMap<K1, V1>): Effect.Effect<void>
} = dual(
  2,
  <K1 extends K, K, V1 extends V, V>(self: TxHashMap<K, V>, other: HashMap.HashMap<K1, V1>): Effect.Effect<void> =>
    TxRef.update(self.ref, (map) => HashMap.union(map, other))
)

/**
 * Removes multiple keys from the TxHashMap.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   // Create a cache with temporary data
 *   const cache = yield* TxHashMap.make(
 *     ["session_1", { user: "alice", expires: "2024-01-01" }],
 *     ["session_2", { user: "bob", expires: "2024-01-01" }],
 *     ["session_3", { user: "charlie", expires: "2024-12-31" }],
 *     ["temp_data_1", { value: "temporary" }],
 *     ["temp_data_2", { value: "also_temporary" }]
 *   )
 *
 *   console.log(yield* TxHashMap.size(cache)) // 5
 *
 *   // Remove expired sessions and temporary data
 *   const keysToRemove = ["session_1", "session_2", "temp_data_1", "temp_data_2"]
 *   yield* TxHashMap.removeMany(cache, keysToRemove)
 *
 *   console.log(yield* TxHashMap.size(cache)) // 1
 *
 *   // Verify only the valid session remains
 *   const remainingSession = yield* TxHashMap.get(cache, "session_3")
 *   console.log(remainingSession) // Option.some({ user: "charlie", expires: "2024-12-31" })
 *
 *   // Can also remove from Set, Array, or any iterable
 *   const moreKeysToRemove = new Set(["session_3"])
 *   yield* TxHashMap.removeMany(cache, moreKeysToRemove)
 *   console.log(yield* TxHashMap.isEmpty(cache)) // true
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const removeMany: {
  <K1 extends K, K>(keys: Iterable<K1>): <V>(self: TxHashMap<K, V>) => Effect.Effect<void>
  <K1 extends K, K, V>(self: TxHashMap<K, V>, keys: Iterable<K1>): Effect.Effect<void>
} = dual(
  2,
  <K1 extends K, K, V>(self: TxHashMap<K, V>, keys: Iterable<K1>): Effect.Effect<void> =>
    TxRef.update(self.ref, (map) => HashMap.removeMany(map, keys))
)

/**
 * Sets multiple key-value pairs in the TxHashMap.
 *
 * @example
 * ```ts
 * import { TxHashMap, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   // Create an empty product catalog
 *   const catalog = yield* TxHashMap.empty<string, { price: number, stock: number }>()
 *
 *   // Bulk load initial products
 *   const initialProducts: Array<readonly [string, { price: number, stock: number }]> = [
 *     ["laptop", { price: 999, stock: 5 }],
 *     ["mouse", { price: 29, stock: 50 }],
 *     ["keyboard", { price: 79, stock: 20 }],
 *     ["monitor", { price: 299, stock: 8 }]
 *   ]
 *
 *   yield* TxHashMap.setMany(catalog, initialProducts)
 *
 *   console.log(yield* TxHashMap.size(catalog)) // 4
 *
 *   // Update prices with a new batch
 *   const priceUpdates: Array<readonly [string, { price: number, stock: number }]> = [
 *     ["laptop", { price: 899, stock: 5 }],  // sale price
 *     ["mouse", { price: 25, stock: 50 }],   // sale price
 *     ["webcam", { price: 89, stock: 12 }]   // new product
 *   ]
 *
 *   yield* TxHashMap.setMany(catalog, priceUpdates)
 *
 *   console.log(yield* TxHashMap.size(catalog)) // 5 (4 original + 1 new)
 *
 *   // Verify the updates
 *   const laptop = yield* TxHashMap.get(catalog, "laptop")
 *   console.log(laptop) // Option.some({ price: 899, stock: 5 })
 *
 *   // Can also use Map, Set of tuples, or any iterable of entries
 *   const jsMap = new Map([["tablet", { price: 399, stock: 3 }]])
 *   yield* TxHashMap.setMany(catalog, jsMap)
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const setMany: {
  <K1 extends K, K, V1 extends V, V>(
    entries: Iterable<readonly [K1, V1]>
  ): (self: TxHashMap<K, V>) => Effect.Effect<void>
  <K1 extends K, K, V1 extends V, V>(self: TxHashMap<K, V>, entries: Iterable<readonly [K1, V1]>): Effect.Effect<void>
} = dual(
  2,
  <K1 extends K, K, V1 extends V, V>(
    self: TxHashMap<K, V>,
    entries: Iterable<readonly [K1, V1]>
  ): Effect.Effect<void> => TxRef.update(self.ref, (map) => HashMap.setMany(map, entries))
)
