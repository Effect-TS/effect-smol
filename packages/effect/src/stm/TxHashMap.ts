/**
 * @since 2.0.0
 */

import * as HashMap from "../collections/HashMap.ts"
import { dual } from "../data/Function.ts"
import * as Option from "../data/Option.ts"
import * as Effect from "../Effect.ts"
import type { Inspectable } from "../interfaces/Inspectable.ts"
import { format, NodeInspectSymbol, toJson } from "../interfaces/Inspectable.ts"
import type { Pipeable } from "../interfaces/Pipeable.ts"
import { pipeArguments } from "../interfaces/Pipeable.ts"
import * as TxRef from "./TxRef.ts"

const TypeId = "~effect/stm/TxHashMap"

const TxHashMapProto = {
  [TypeId]: TypeId,
  [NodeInspectSymbol](this: TxHashMap<unknown, unknown>) {
    return toJson(this)
  },
  toString(this: TxHashMap<unknown, unknown>) {
    return `TxHashMap(${format(toJson((this).ref))})`
  },
  toJSON(this: TxHashMap<unknown, unknown>) {
    return {
      _id: "TxHashMap",
      ref: toJson((this).ref)
    }
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
 * import { Effect } from "effect"
 * import { Option } from "effect/data"
 * import { TxHashMap } from "effect/stm"
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
 *   yield* Effect.atomic(
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
  readonly [TypeId]: typeof TypeId
  readonly ref: TxRef.TxRef<HashMap.HashMap<K, V>>
}

/**
 * The TxHashMap namespace contains type-level utilities and helper types
 * for working with TxHashMap instances.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { HashMap } from "effect/collections"
 * import { TxHashMap } from "effect/stm"
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
   * import { Effect } from "effect"
   * import { TxHashMap } from "effect/stm"
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
   * import { Effect } from "effect"
   * import { TxHashMap } from "effect/stm"
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
   * import { Effect } from "effect"
   * import { TxHashMap } from "effect/stm"
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
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
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
 * import { Effect } from "effect"
 * import { Option } from "effect/data"
 * import { TxHashMap } from "effect/stm"
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
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
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
 * import { Effect } from "effect"
 * import { Option } from "effect/data"
 * import { TxHashMap } from "effect/stm"
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
 *     console.log((bobRole.value as { name: string, role: string }).role) // "user"
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
 * **Mutation behavior**: This function mutates the original TxHashMap by updating
 * its internal state. It does not return a new TxHashMap reference.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Option } from "effect/data"
 * import { TxHashMap } from "effect/stm"
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
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
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
 * **Mutation behavior**: This function mutates the original TxHashMap by removing
 * the specified key-value pair. It does not return a new TxHashMap reference.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
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
    Effect.atomic(
      Effect.gen(function*() {
        const currentMap = yield* TxRef.get(self.ref)
        const existed = HashMap.has(currentMap, key)
        if (existed) {
          yield* TxRef.set(self.ref, HashMap.remove(currentMap, key))
        }
        return existed
      })
    )
)

/**
 * Removes all entries from the TxHashMap.
 *
 * **Mutation behavior**: This function mutates the original TxHashMap by clearing
 * all key-value pairs. It does not return a new TxHashMap reference.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
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
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
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
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
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
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
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
 * **Mutation behavior**: This function mutates the original TxHashMap by updating
 * the value at the specified key. It does not return a new TxHashMap reference.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Option } from "effect/data"
 * import { TxHashMap } from "effect/stm"
 *
 * const program = Effect.gen(function* () {
 *   const counters = yield* TxHashMap.make(
 *     ["downloads", 100],
 *     ["views", 250]
 *   )
 *
 *   // Increment existing counter
 *   const oldDownloads = yield* TxHashMap.modify(counters, "downloads", (count: number) => count + 1)
 *   console.log(oldDownloads) // Option.some(100)
 *
 *   const newDownloads = yield* TxHashMap.get(counters, "downloads")
 *   console.log(newDownloads) // Option.some(101)
 *
 *   // Try to modify non-existent key
 *   const nonExistent = yield* TxHashMap.modify(counters, "clicks", (count: number) => count + 1)
 *   console.log(nonExistent) // Option.none()
 *
 *   // Update views counter with direct method call
 *   yield* TxHashMap.modify(counters, "views", (views: number) => views * 2)
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
    Effect.atomic(
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
)

/**
 * Updates the value for the specified key using an Option-based update function.
 *
 * **Mutation behavior**: This function mutates the original TxHashMap by updating,
 * adding, or removing the key-value pair based on the function result. It does not
 * return a new TxHashMap reference.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Option } from "effect/data"
 * import { TxHashMap } from "effect/stm"
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
    Effect.atomic(
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
)

/**
 * Returns an array of all keys in the TxHashMap.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Option } from "effect/data"
 * import { TxHashMap } from "effect/stm"
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
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
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
 *   const average = allScores.reduce((sum: number, score: number) => sum + score, 0) / allScores.length
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
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
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
 * import { Effect } from "effect"
 * import { HashMap } from "effect/collections"
 * import { TxHashMap } from "effect/stm"
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
 * **Mutation behavior**: This function mutates the original TxHashMap by merging
 * the provided HashMap into it. It does not return a new TxHashMap reference.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { HashMap } from "effect/collections"
 * import { TxHashMap } from "effect/stm"
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
 * **Mutation behavior**: This function mutates the original TxHashMap by removing
 * all specified keys. It does not return a new TxHashMap reference.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
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
 * **Mutation behavior**: This function mutates the original TxHashMap by setting
 * all provided key-value pairs. It does not return a new TxHashMap reference.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
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

/**
 * Returns `true` if the specified value is a `TxHashMap`, `false` otherwise.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
 *
 * const program = Effect.gen(function* () {
 *   const txMap = yield* TxHashMap.make(["key", "value"])
 *
 *   console.log(TxHashMap.isTxHashMap(txMap)) // true
 *   console.log(TxHashMap.isTxHashMap({})) // false
 *   console.log(TxHashMap.isTxHashMap(null)) // false
 *   console.log(TxHashMap.isTxHashMap("not a map")) // false
 *
 *   // Useful for type guards in runtime checks
 *   const validateInput = (value: unknown) => {
 *     if (TxHashMap.isTxHashMap(value)) {
 *       // TypeScript now knows this is a TxHashMap
 *       return Effect.succeed("Valid TxHashMap")
 *     }
 *     return Effect.fail("Invalid input")
 *   }
 * })
 * ```
 *
 * @since 2.0.0
 * @category guards
 */
export const isTxHashMap = <K, V>(value: unknown): value is TxHashMap<K, V> => {
  return typeof value === "object" && value !== null && TypeId in value
}

/**
 * Lookup the value for the specified key in the TxHashMap using a custom hash.
 * This can provide performance benefits when the hash is precomputed.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Option } from "effect/data"
 * import { TxHashMap } from "effect/stm"
 * import { Hash } from "effect/interfaces"
 *
 * const program = Effect.gen(function* () {
 *   // Create a cache with user sessions
 *   const cache = yield* TxHashMap.make(
 *     ["session_abc123", { userId: "user1", lastActive: Date.now() }],
 *     ["session_def456", { userId: "user2", lastActive: Date.now() }]
 *   )
 *
 *   // When you have precomputed hash (e.g., from another lookup)
 *   const sessionId = "session_abc123"
 *   const precomputedHash = Hash.string(sessionId)
 *
 *   // Use hash-optimized lookup for performance in hot paths
 *   const session = yield* TxHashMap.getHash(cache, sessionId, precomputedHash)
 *   console.log(session) // Option.some({ userId: "user1", lastActive: ... })
 *
 *   // This avoids recomputing the hash when you already have it
 *   const invalidSession = yield* TxHashMap.getHash(cache, "invalid", Hash.string("invalid"))
 *   console.log(invalidSession) // Option.none()
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const getHash: {
  <K1 extends K, K>(key: K1, hash: number): <V>(self: TxHashMap<K, V>) => Effect.Effect<Option.Option<V>>
  <K1 extends K, K, V>(self: TxHashMap<K, V>, key: K1, hash: number): Effect.Effect<Option.Option<V>>
} = dual(
  3,
  <K1 extends K, K, V>(self: TxHashMap<K, V>, key: K1, hash: number): Effect.Effect<Option.Option<V>> =>
    TxRef.get(self.ref).pipe(Effect.map((map) => HashMap.getHash(map, key, hash)))
)

/**
 * Checks if the specified key has an entry in the TxHashMap using a custom hash.
 * This can provide performance benefits when the hash is precomputed.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
 * import { Hash } from "effect/interfaces"
 *
 * const program = Effect.gen(function* () {
 *   // Create an access control map
 *   const permissions = yield* TxHashMap.make(
 *     ["admin", { read: true, write: true, delete: true }],
 *     ["user", { read: true, write: false, delete: false }]
 *   )
 *
 *   // When checking permissions frequently with same roles
 *   const role = "admin"
 *   const roleHash = Hash.string(role)
 *
 *   // Use hash-optimized existence check
 *   const hasAdminRole = yield* TxHashMap.hasHash(permissions, role, roleHash)
 *   console.log(hasAdminRole) // true
 *
 *   // Check non-existent role
 *   const hasGuestRole = yield* TxHashMap.hasHash(permissions, "guest", Hash.string("guest"))
 *   console.log(hasGuestRole) // false
 *
 *   // Useful in hot paths where hash is computed once and reused
 *   const roles = ["admin", "user", "moderator"]
 *   const roleHashes = roles.map(role => [role, Hash.string(role)] as const)
 *
 *   for (const [role, hash] of roleHashes) {
 *     const exists = yield* TxHashMap.hasHash(permissions, role, hash)
 *     console.log(`Role ${role}: ${exists}`)
 *   }
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const hasHash: {
  <K1 extends K, K>(key: K1, hash: number): <V>(self: TxHashMap<K, V>) => Effect.Effect<boolean>
  <K1 extends K, K, V>(self: TxHashMap<K, V>, key: K1, hash: number): Effect.Effect<boolean>
} = dual(
  3,
  <K1 extends K, K, V>(self: TxHashMap<K, V>, key: K1, hash: number): Effect.Effect<boolean> =>
    TxRef.get(self.ref).pipe(Effect.map((map) => HashMap.hasHash(map, key, hash)))
)

/**
 * Transforms all values in the TxHashMap using the provided function, preserving keys.
 *
 * **Return behavior**: This function returns a new TxHashMap reference with the
 * transformed values. The original TxHashMap is not modified.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
 *
 * const program = Effect.gen(function* () {
 *   // Create a user profile map
 *   const profiles = yield* TxHashMap.make(
 *     ["alice", { name: "Alice", age: 30, active: true }],
 *     ["bob", { name: "Bob", age: 25, active: false }],
 *     ["charlie", { name: "Charlie", age: 35, active: true }]
 *   )
 *
 *   // Transform to extract just names with greeting
 *   const greetings = yield* TxHashMap.map(profiles, (profile: { name: string, age: number, active: boolean }, userId: string) =>
 *     `Hello, ${profile.name}! (User: ${userId})`
 *   )
 *
 *   // Check the transformed values
 *   const aliceGreeting = yield* TxHashMap.get(greetings, "alice")
 *   console.log(aliceGreeting) // Option.some("Hello, Alice! (User: alice)")
 *
 *   // Data-last usage with pipe
 *   const ages = yield* profiles.pipe(
 *     TxHashMap.map((profile: { name: string, age: number, active: boolean }) => profile.age)
 *   )
 *
 *   const aliceAge = yield* TxHashMap.get(ages, "alice")
 *   console.log(aliceAge) // Option.some(30)
 *
 *   // Original map is unchanged
 *   const originalAlice = yield* TxHashMap.get(profiles, "alice")
 *   console.log(originalAlice) // Option.some({ name: "Alice", age: 30, active: true })
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const map: {
  <A, V, K>(f: (value: V, key: K) => A): (self: TxHashMap<K, V>) => Effect.Effect<TxHashMap<K, A>>
  <K, V, A>(self: TxHashMap<K, V>, f: (value: V, key: K) => A): Effect.Effect<TxHashMap<K, A>>
} = dual(
  2,
  <K, V, A>(self: TxHashMap<K, V>, f: (value: V, key: K) => A): Effect.Effect<TxHashMap<K, A>> =>
    Effect.atomic(
      Effect.gen(function*() {
        const currentMap = yield* TxRef.get(self.ref)
        const mappedMap = HashMap.map(currentMap, f)
        return yield* fromHashMap(mappedMap)
      })
    )
)

/**
 * Filters the TxHashMap to keep only entries that satisfy the provided predicate.
 *
 * **Return behavior**: This function returns a new TxHashMap reference containing
 * only the entries that match the condition. The original TxHashMap is not modified.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
 *
 * const program = Effect.gen(function* () {
 *   // Create a product inventory
 *   const inventory = yield* TxHashMap.make(
 *     ["laptop", { price: 999, stock: 5, category: "electronics" }],
 *     ["mouse", { price: 29, stock: 50, category: "electronics" }],
 *     ["book", { price: 15, stock: 100, category: "books" }],
 *     ["phone", { price: 699, stock: 0, category: "electronics" }]
 *   )
 *
 *   // Filter to get only electronics in stock
 *   const electronicsInStock = yield* TxHashMap.filter(
 *     inventory,
 *     (product: { price: number, stock: number, category: string }) => product.category === "electronics" && product.stock > 0
 *   )
 *
 *   const size = yield* TxHashMap.size(electronicsInStock)
 *   console.log(size) // 2 (laptop and mouse)
 *
 *   // Data-last usage with pipe
 *   const expensiveItems = yield* inventory.pipe(
 *     TxHashMap.filter((product: { price: number, stock: number, category: string }) => product.price > 500)
 *   )
 *
 *   const expensiveSize = yield* TxHashMap.size(expensiveItems)
 *   console.log(expensiveSize) // 2 (laptop and phone)
 *
 *   // Type guard usage
 *   const highValueItems = yield* TxHashMap.filter(
 *     inventory,
 *     (product: { price: number, stock: number, category: string }): product is typeof product & { price: number } => product.price > 50
 *   )
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const filter: {
  <K, V, B extends V>(
    predicate: (value: V, key: K) => value is B
  ): (self: TxHashMap<K, V>) => Effect.Effect<TxHashMap<K, B>>
  <K, V>(predicate: (value: V, key: K) => boolean): (self: TxHashMap<K, V>) => Effect.Effect<TxHashMap<K, V>>
  <K, V, B extends V>(
    self: TxHashMap<K, V>,
    predicate: (value: V, key: K) => value is B
  ): Effect.Effect<TxHashMap<K, B>>
  <K, V>(self: TxHashMap<K, V>, predicate: (value: V, key: K) => boolean): Effect.Effect<TxHashMap<K, V>>
} = dual(
  2,
  <K, V>(self: TxHashMap<K, V>, predicate: (value: V, key: K) => boolean): Effect.Effect<TxHashMap<K, V>> =>
    Effect.atomic(
      Effect.gen(function*() {
        const currentMap = yield* TxRef.get(self.ref)
        const filteredMap = HashMap.filter(currentMap, predicate)
        return yield* fromHashMap(filteredMap)
      })
    )
)

/**
 * Reduces the TxHashMap entries to a single value by applying a reducer function.
 * Iterates over all key-value pairs and accumulates them into a final result.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
 *
 * const program = Effect.gen(function* () {
 *   // Create a sales data map
 *   const sales = yield* TxHashMap.make(
 *     ["Q1", 15000],
 *     ["Q2", 18000],
 *     ["Q3", 22000],
 *     ["Q4", 25000]
 *   )
 *
 *   // Calculate total sales
 *   const totalSales = yield* TxHashMap.reduce(
 *     sales,
 *     0,
 *     (total: number, amount: number, quarter: string) => {
 *       console.log(`Adding ${quarter}: ${amount}`)
 *       return total + amount
 *     }
 *   )
 *   console.log(`Total sales: ${totalSales}`) // 80000
 *
 *   // Data-last usage with pipe
 *   const quarterlyReport = yield* sales.pipe(
 *     TxHashMap.reduce(
 *       { quarters: 0, total: 0, max: 0 },
 *       (report: { quarters: number, total: number, max: number }, amount: number, quarter: string) => ({
 *         quarters: report.quarters + 1,
 *         total: report.total + amount,
 *         max: Math.max(report.max, amount)
 *       })
 *     )
 *   )
 *   console.log(quarterlyReport) // { quarters: 4, total: 80000, max: 25000 }
 *
 *   // Build a summary string
 *   const summary = yield* TxHashMap.reduce(
 *     sales,
 *     "",
 *     (acc: string, amount: number, quarter: string) => acc + `${quarter}: $${amount.toLocaleString()}\n`
 *   )
 *   console.log(summary)
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const reduce: {
  <A, V, K>(zero: A, f: (accumulator: A, value: V, key: K) => A): (self: TxHashMap<K, V>) => Effect.Effect<A>
  <K, V, A>(self: TxHashMap<K, V>, zero: A, f: (accumulator: A, value: V, key: K) => A): Effect.Effect<A>
} = dual(
  3,
  <K, V, A>(self: TxHashMap<K, V>, zero: A, f: (accumulator: A, value: V, key: K) => A): Effect.Effect<A> =>
    TxRef.get(self.ref).pipe(Effect.map((map) => HashMap.reduce(map, zero, f)))
)

/**
 * Combines filtering and mapping in a single operation. Applies a function that returns
 * an Option to each entry, keeping only the Some values and transforming them.
 *
 * **Return behavior**: This function returns a new TxHashMap reference containing
 * only the transformed entries that returned Some values. The original TxHashMap is not modified.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Option } from "effect/data"
 * import { TxHashMap } from "effect/stm"
 *
 * const program = Effect.gen(function* () {
 *   // Create a mixed data map
 *   const userData = yield* TxHashMap.make(
 *     ["alice", { age: "30", role: "admin", active: true }],
 *     ["bob", { age: "invalid", role: "user", active: true }],
 *     ["charlie", { age: "25", role: "admin", active: false }],
 *     ["diana", { age: "28", role: "user", active: true }]
 *   )
 *
 *   // Extract valid ages for active admin users only
 *   const activeAdminAges = yield* TxHashMap.filterMap(
 *     userData,
 *     (user: { age: string, role: string, active: boolean }, username: string) => {
 *       if (!user.active || user.role !== "admin") return Option.none()
 *       const age = parseInt(user.age)
 *       if (isNaN(age)) return Option.none()
 *       return Option.some({ username, age, seniority: age > 27 ? "senior" : "junior" })
 *     }
 *   )
 *
 *   const aliceData = yield* TxHashMap.get(activeAdminAges, "alice")
 *   console.log(aliceData) // Option.some({ username: "alice", age: 30, seniority: "senior" })
 *
 *   const charlieData = yield* TxHashMap.get(activeAdminAges, "charlie")
 *   console.log(charlieData) // Option.none() (not active)
 *
 *   // Data-last usage with pipe
 *   const validAges = yield* userData.pipe(
 *     TxHashMap.filterMap((user: { age: string, role: string, active: boolean }) => {
 *       const age = parseInt(user.age)
 *       return isNaN(age) ? Option.none() : Option.some(age)
 *     })
 *   )
 *
 *   const size = yield* TxHashMap.size(validAges)
 *   console.log(size) // 3 (alice, charlie, diana have valid ages)
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const filterMap: {
  <A, V, K>(f: (value: V, key: K) => Option.Option<A>): (self: TxHashMap<K, V>) => Effect.Effect<TxHashMap<K, A>>
  <K, V, A>(self: TxHashMap<K, V>, f: (value: V, key: K) => Option.Option<A>): Effect.Effect<TxHashMap<K, A>>
} = dual(
  2,
  <K, V, A>(self: TxHashMap<K, V>, f: (value: V, key: K) => Option.Option<A>): Effect.Effect<TxHashMap<K, A>> =>
    Effect.atomic(
      Effect.gen(function*() {
        const currentMap = yield* TxRef.get(self.ref)
        const filteredMap = HashMap.filterMap(currentMap, f)
        return yield* fromHashMap(filteredMap)
      })
    )
)

/**
 * Checks if any entry in the TxHashMap matches the given predicate.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
 *
 * const program = Effect.gen(function* () {
 *   // Create a user status map
 *   const userStatuses = yield* TxHashMap.make(
 *     ["alice", { status: "online", lastSeen: Date.now() }],
 *     ["bob", { status: "offline", lastSeen: Date.now() - 3600000 }],
 *     ["charlie", { status: "online", lastSeen: Date.now() }]
 *   )
 *
 *   // Check if any users are online
 *   const hasOnlineUsers = yield* TxHashMap.hasBy(
 *     userStatuses,
 *     (user: { status: string, lastSeen: number }) => user.status === "online"
 *   )
 *   console.log(hasOnlineUsers) // true
 *
 *   // Check if any users have specific username pattern
 *   const hasAdminUser = yield* TxHashMap.hasBy(
 *     userStatuses,
 *     (user: { status: string, lastSeen: number }, username: string) => username.startsWith("admin")
 *   )
 *   console.log(hasAdminUser) // false
 *
 *   // Data-last usage with pipe
 *   const hasRecentActivity = yield* userStatuses.pipe(
 *     TxHashMap.hasBy((user: { status: string, lastSeen: number }) => Date.now() - user.lastSeen < 1800000) // 30 minutes
 *   )
 *   console.log(hasRecentActivity) // true
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const hasBy: {
  <K, V>(predicate: (value: V, key: K) => boolean): (self: TxHashMap<K, V>) => Effect.Effect<boolean>
  <K, V>(self: TxHashMap<K, V>, predicate: (value: V, key: K) => boolean): Effect.Effect<boolean>
} = dual(
  2,
  <K, V>(self: TxHashMap<K, V>, predicate: (value: V, key: K) => boolean): Effect.Effect<boolean> =>
    TxRef.get(self.ref).pipe(Effect.map((map) => HashMap.hasBy(map, predicate)))
)

/**
 * Finds the first entry in the TxHashMap that matches the given predicate.
 * Returns the key-value pair as a tuple wrapped in an Option.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Option } from "effect/data"
 * import { TxHashMap } from "effect/stm"
 *
 * const program = Effect.gen(function* () {
 *   // Create a task priority map
 *   const tasks = yield* TxHashMap.make(
 *     ["task1", { priority: 1, assignee: "alice", completed: false }],
 *     ["task2", { priority: 3, assignee: "bob", completed: true }],
 *     ["task3", { priority: 2, assignee: "alice", completed: false }]
 *   )
 *
 *   // Find first high-priority incomplete task
 *   const highPriorityTask = yield* TxHashMap.findFirst(
 *     tasks,
 *     (task: { priority: number, assignee: string, completed: boolean }) => task.priority >= 2 && !task.completed
 *   )
 *
 *   if (highPriorityTask) {
 *     const [taskId, task] = highPriorityTask
 *     console.log(`Found task: ${taskId}, priority: ${task.priority}`)
 *     // "Found task: task3, priority: 2"
 *   }
 *
 *   // Find first task assigned to specific user
 *   const aliceTask = yield* tasks.pipe(
 *     TxHashMap.findFirst((task: { priority: number, assignee: string, completed: boolean }) => task.assignee === "alice")
 *   )
 *
 *   if (aliceTask) {
 *     console.log(`Alice's task: ${aliceTask[0]}`)
 *   }
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const findFirst: {
  <K, V>(predicate: (value: V, key: K) => boolean): (self: TxHashMap<K, V>) => Effect.Effect<[K, V] | undefined>
  <K, V>(self: TxHashMap<K, V>, predicate: (value: V, key: K) => boolean): Effect.Effect<[K, V] | undefined>
} = dual(
  2,
  <K, V>(self: TxHashMap<K, V>, predicate: (value: V, key: K) => boolean): Effect.Effect<[K, V] | undefined> =>
    TxRef.get(self.ref).pipe(Effect.map((map) => HashMap.findFirst(map, predicate)))
)

/**
 * Checks if at least one entry in the TxHashMap satisfies the given predicate.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
 *
 * const program = Effect.gen(function* () {
 *   // Create a product inventory
 *   const inventory = yield* TxHashMap.make(
 *     ["laptop", { price: 999, stock: 5 }],
 *     ["mouse", { price: 29, stock: 50 }],
 *     ["keyboard", { price: 79, stock: 0 }]
 *   )
 *
 *   // Check if any products are expensive
 *   const hasExpensiveProducts = yield* TxHashMap.some(
 *     inventory,
 *     (product: { price: number, stock: number }) => product.price > 500
 *   )
 *   console.log(hasExpensiveProducts) // true
 *
 *   // Check if any products are out of stock
 *   const hasOutOfStock = yield* TxHashMap.some(
 *     inventory,
 *     (product: { price: number, stock: number }) => product.stock === 0
 *   )
 *   console.log(hasOutOfStock) // true
 *
 *   // Data-last usage with pipe
 *   const hasAffordableItems = yield* inventory.pipe(
 *     TxHashMap.some((product: { price: number, stock: number }) => product.price < 50)
 *   )
 *   console.log(hasAffordableItems) // true (mouse is $29)
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const some: {
  <K, V>(predicate: (value: V, key: K) => boolean): (self: TxHashMap<K, V>) => Effect.Effect<boolean>
  <K, V>(self: TxHashMap<K, V>, predicate: (value: V, key: K) => boolean): Effect.Effect<boolean>
} = dual(
  2,
  <K, V>(self: TxHashMap<K, V>, predicate: (value: V, key: K) => boolean): Effect.Effect<boolean> =>
    TxRef.get(self.ref).pipe(Effect.map((map) => HashMap.some(map, predicate)))
)

/**
 * Checks if all entries in the TxHashMap satisfy the given predicate.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
 *
 * const program = Effect.gen(function* () {
 *   // Create a user permissions map
 *   const permissions = yield* TxHashMap.make(
 *     ["alice", { canRead: true, canWrite: true, canDelete: false }],
 *     ["bob", { canRead: true, canWrite: false, canDelete: false }],
 *     ["charlie", { canRead: true, canWrite: true, canDelete: true }]
 *   )
 *
 *   // Check if all users can read
 *   const allCanRead = yield* TxHashMap.every(
 *     permissions,
 *     (perms: { canRead: boolean, canWrite: boolean, canDelete: boolean }) => perms.canRead
 *   )
 *   console.log(allCanRead) // true
 *
 *   // Check if all users can write
 *   const allCanWrite = yield* TxHashMap.every(
 *     permissions,
 *     (perms: { canRead: boolean, canWrite: boolean, canDelete: boolean }) => perms.canWrite
 *   )
 *   console.log(allCanWrite) // false
 *
 *   // Data-last usage with pipe
 *   const allHaveBasicAccess = yield* permissions.pipe(
 *     TxHashMap.every((perms: { canRead: boolean, canWrite: boolean, canDelete: boolean }, username: string) => perms.canRead && username.length > 2)
 *   )
 *   console.log(allHaveBasicAccess) // true
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const every: {
  <K, V>(predicate: (value: V, key: K) => boolean): (self: TxHashMap<K, V>) => Effect.Effect<boolean>
  <K, V>(self: TxHashMap<K, V>, predicate: (value: V, key: K) => boolean): Effect.Effect<boolean>
} = dual(
  2,
  <K, V>(self: TxHashMap<K, V>, predicate: (value: V, key: K) => boolean): Effect.Effect<boolean> =>
    TxRef.get(self.ref).pipe(Effect.map((map) => HashMap.every(map, predicate)))
)

/**
 * Executes a side-effect function for each entry in the TxHashMap.
 * The function receives the value and key as parameters and can perform effects.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Console } from "effect/logging"
 * import { TxHashMap } from "effect/stm"
 *
 * const program = Effect.gen(function* () {
 *   // Create a log processing map
 *   const logs = yield* TxHashMap.make(
 *     ["error.log", { size: 1024, level: "error" }],
 *     ["access.log", { size: 2048, level: "info" }],
 *     ["debug.log", { size: 512, level: "debug" }]
 *   )
 *
 *   // Process each log file with side effects
 *   yield* TxHashMap.forEach(logs, (logInfo: { size: number, level: string }, filename: string) =>
 *     Effect.gen(function* () {
 *       yield* Console.log(`Processing ${filename}: ${logInfo.size} bytes, level: ${logInfo.level}`)
 *       if (logInfo.level === "error") {
 *         yield* Console.log(`⚠️  Error log detected: ${filename}`)
 *       }
 *     })
 *   )
 *
 *   // Data-last usage with pipe
 *   yield* logs.pipe(
 *     TxHashMap.forEach((logInfo: { size: number, level: string }) =>
 *       logInfo.size > 1000
 *         ? Console.log(`Large log file: ${logInfo.size} bytes`)
 *         : Effect.void
 *     )
 *   )
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const forEach: {
  <V, K, R, E>(f: (value: V, key: K) => Effect.Effect<void, E, R>): (self: TxHashMap<K, V>) => Effect.Effect<void, E, R>
  <K, V, R, E>(self: TxHashMap<K, V>, f: (value: V, key: K) => Effect.Effect<void, E, R>): Effect.Effect<void, E, R>
} = dual(
  2,
  <K, V, R, E>(self: TxHashMap<K, V>, f: (value: V, key: K) => Effect.Effect<void, E, R>): Effect.Effect<void, E, R> =>
    Effect.gen(function*() {
      const currentMap = yield* TxRef.get(self.ref)
      const entries = HashMap.toEntries(currentMap)
      yield* Effect.forEach(entries, ([key, value]) => f(value, key))
    })
)

/**
 * Transforms the TxHashMap by applying a function that returns a TxHashMap to each entry,
 * then flattening the results. Useful for complex transformations that require creating new maps.
 *
 * **Return behavior**: This function returns a new TxHashMap reference with the
 * flattened results. The original TxHashMap is not modified.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
 *
 * const program = Effect.gen(function* () {
 *   // Create a department-employee map
 *   const departments = yield* TxHashMap.make(
 *     ["engineering", ["alice", "bob"]],
 *     ["marketing", ["charlie", "diana"]]
 *   )
 *
 *   // Expand each department into individual employee entries with metadata
 *   const employeeDetails = yield* TxHashMap.flatMap(
 *     departments,
 *     (employees: string[], department: string) =>
 *       Effect.gen(function* () {
 *         const employeeMap = yield* TxHashMap.empty<string, { department: string, role: string }>()
 *         for (let i = 0; i < employees.length; i++) {
 *           const employee = employees[i]
 *           const role = i === 0 ? "lead" : "member"
 *           yield* TxHashMap.set(employeeMap, employee, { department, role })
 *         }
 *         return employeeMap
 *       })
 *   )
 *
 *   // Check the flattened result
 *   const alice = yield* TxHashMap.get(employeeDetails, "alice")
 *   console.log(alice) // Option.some({ department: "engineering", role: "lead" })
 *
 *   const charlie = yield* TxHashMap.get(employeeDetails, "charlie")
 *   console.log(charlie) // Option.some({ department: "marketing", role: "lead" })
 *
 *   const size = yield* TxHashMap.size(employeeDetails)
 *   console.log(size) // 4 (all employees)
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const flatMap: {
  <A, V, K>(
    f: (value: V, key: K) => Effect.Effect<TxHashMap<K, A>>
  ): (self: TxHashMap<K, V>) => Effect.Effect<TxHashMap<K, A>>
  <K, V, A>(
    self: TxHashMap<K, V>,
    f: (value: V, key: K) => Effect.Effect<TxHashMap<K, A>>
  ): Effect.Effect<TxHashMap<K, A>>
} = dual(
  2,
  <K, V, A>(
    self: TxHashMap<K, V>,
    f: (value: V, key: K) => Effect.Effect<TxHashMap<K, A>>
  ): Effect.Effect<TxHashMap<K, A>> =>
    Effect.atomic(
      Effect.gen(function*() {
        const currentMap = yield* TxRef.get(self.ref)
        const result = yield* empty<K, A>()

        const mapEntries = HashMap.toEntries(currentMap)
        for (const [key, value] of mapEntries) {
          const newMap = yield* f(value, key)
          const newEntries = yield* entries(newMap)
          yield* setMany(result, newEntries)
        }

        return result
      })
    )
)

/**
 * Removes all None values from a TxHashMap containing Option values.
 *
 * **Return behavior**: This function returns a new TxHashMap reference with only
 * the Some values unwrapped. The original TxHashMap is not modified.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Option } from "effect/data"
 * import { TxHashMap } from "effect/stm"
 *
 * const program = Effect.gen(function* () {
 *   // Create a map with optional user data
 *   const userData = yield* TxHashMap.make<string, Option.Option<{ age: number, email?: string }>>(
 *     ["alice", Option.some({ age: 30, email: "alice@example.com" })],
 *     ["bob", Option.none()], // incomplete data
 *     ["charlie", Option.some({ age: 25 })],
 *     ["diana", Option.none()], // missing data
 *     ["eve", Option.some({ age: 28, email: "eve@example.com" })]
 *   )
 *
 *   // Remove all None values and unwrap Some values
 *   const validUsers = yield* TxHashMap.compact(userData)
 *
 *   const size = yield* TxHashMap.size(validUsers)
 *   console.log(size) // 3 (alice, charlie, eve)
 *
 *   const alice = yield* TxHashMap.get(validUsers, "alice")
 *   console.log(alice) // Option.some({ age: 30, email: "alice@example.com" })
 *
 *   const bob = yield* TxHashMap.get(validUsers, "bob")
 *   console.log(bob) // Option.none() (removed from map)
 *
 *   // Useful for cleaning up optional data processing results
 *   const userAges = yield* TxHashMap.map(validUsers, (user: { age: number, email?: string }) => user.age)
 *   const ageEntries = yield* TxHashMap.entries(userAges)
 *   console.log(ageEntries) // [["alice", 30], ["charlie", 25], ["eve", 28]]
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const compact = <K, A>(self: TxHashMap<K, Option.Option<A>>): Effect.Effect<TxHashMap<K, A>> =>
  Effect.atomic(
    Effect.gen(function*() {
      const currentMap = yield* TxRef.get(self.ref)
      const compactedMap = HashMap.compact(currentMap)
      return yield* fromHashMap(compactedMap)
    })
  )

/**
 * Returns an array of all key-value pairs in the TxHashMap.
 * This is an alias for the `entries` function, providing API consistency with HashMap.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
 *
 * const program = Effect.gen(function* () {
 *   const settings = yield* TxHashMap.make(
 *     ["theme", "dark"],
 *     ["language", "en-US"],
 *     ["timezone", "UTC"]
 *   )
 *
 *   // Get all entries as an array
 *   const allEntries = yield* TxHashMap.toEntries(settings)
 *   console.log(allEntries)
 *   // [["theme", "dark"], ["language", "en-US"], ["timezone", "UTC"]]
 *
 *   // Process entries
 *   for (const [setting, value] of allEntries) {
 *     console.log(`${setting}: ${value}`)
 *   }
 *
 *   // Convert to object for JSON serialization
 *   const settingsObj = Object.fromEntries(allEntries)
 *   console.log(JSON.stringify(settingsObj))
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const toEntries = <K, V>(self: TxHashMap<K, V>): Effect.Effect<Array<readonly [K, V]>> => entries(self)

/**
 * Returns an array of all values in the TxHashMap.
 * This is an alias for the `values` function, providing API consistency with HashMap.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { TxHashMap } from "effect/stm"
 *
 * const program = Effect.gen(function* () {
 *   const inventory = yield* TxHashMap.make(
 *     ["laptop", { price: 999, stock: 5 }],
 *     ["mouse", { price: 29, stock: 50 }],
 *     ["keyboard", { price: 79, stock: 20 }]
 *   )
 *
 *   // Get all product information
 *   const products = yield* TxHashMap.toValues(inventory)
 *   console.log(products)
 *   // [{ price: 999, stock: 5 }, { price: 29, stock: 50 }, { price: 79, stock: 20 }]
 *
 *   // Calculate total inventory value
 *   const totalValue = products.reduce((sum: number, product: { price: number, stock: number }) => sum + (product.price * product.stock), 0)
 *   console.log(`Total inventory value: $${totalValue}`) // $8,435
 *
 *   // Find products with low stock
 *   const lowStockProducts = products.filter((product: { price: number, stock: number }) => product.stock < 10)
 *   console.log(`${lowStockProducts.length} products with low stock`)
 * })
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
export const toValues = <K, V>(self: TxHashMap<K, V>): Effect.Effect<Array<V>> => values(self)

/**
 * Helper function to create a TxHashMap from an existing HashMap
 */
const fromHashMap = <K, V>(hashMap: HashMap.HashMap<K, V>): Effect.Effect<TxHashMap<K, V>> =>
  Effect.gen(function*() {
    const ref = yield* TxRef.make(hashMap)
    return Object.assign(Object.create(TxHashMapProto), { ref })
  })
