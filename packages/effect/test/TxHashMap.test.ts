import * as Effect from "effect/Effect"
import * as HashMap from "effect/HashMap"
import * as Option from "effect/Option"
import * as TxHashMap from "effect/TxHashMap"
import { describe, expect, it } from "vitest"

describe("TxHashMap", () => {
  describe("constructors", () => {
    it("empty", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.empty<string, number>()
        const isEmpty = yield* TxHashMap.isEmpty(txMap)
        const size = yield* TxHashMap.size(txMap)

        expect(isEmpty).toBe(true)
        expect(size).toBe(0)
      }).pipe(Effect.runSync))

    it("make", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1], ["b", 2], ["c", 3])
        const size = yield* TxHashMap.size(txMap)
        const a = yield* TxHashMap.get(txMap, "a")
        const b = yield* TxHashMap.get(txMap, "b")
        const c = yield* TxHashMap.get(txMap, "c")

        expect(size).toBe(3)
        expect(a).toEqual(Option.some(1))
        expect(b).toEqual(Option.some(2))
        expect(c).toEqual(Option.some(3))
      }).pipe(Effect.runSync))

    it("fromIterable", () =>
      Effect.gen(function*() {
        const entries = [["a", 1], ["b", 2], ["c", 3]] as const
        const txMap = yield* TxHashMap.fromIterable(entries)
        const size = yield* TxHashMap.size(txMap)
        const a = yield* TxHashMap.get(txMap, "a")
        const b = yield* TxHashMap.get(txMap, "b")
        const c = yield* TxHashMap.get(txMap, "c")

        expect(size).toBe(3)
        expect(a).toEqual(Option.some(1))
        expect(b).toEqual(Option.some(2))
        expect(c).toEqual(Option.some(3))
      }).pipe(Effect.runSync))
  })

  describe("basic operations", () => {
    it("get - existing key", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1], ["b", 2])
        const a = yield* TxHashMap.get(txMap, "a")
        const b = yield* TxHashMap.get(txMap, "b")

        expect(a).toEqual(Option.some(1))
        expect(b).toEqual(Option.some(2))
      }).pipe(Effect.runSync))

    it("get - non-existing key", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1], ["b", 2])
        const c = yield* TxHashMap.get(txMap, "c")

        expect(c).toEqual(Option.none())
      }).pipe(Effect.runSync))

    it("has - existing key", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1], ["b", 2])
        const hasA = yield* TxHashMap.has(txMap, "a")
        const hasB = yield* TxHashMap.has(txMap, "b")

        expect(hasA).toBe(true)
        expect(hasB).toBe(true)
      }).pipe(Effect.runSync))

    it("has - non-existing key", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1], ["b", 2])
        const hasC = yield* TxHashMap.has(txMap, "c")

        expect(hasC).toBe(false)
      }).pipe(Effect.runSync))

    it("set - new key", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1], ["b", 2])
        yield* TxHashMap.set(txMap, "c", 3)

        const size = yield* TxHashMap.size(txMap)
        const c = yield* TxHashMap.get(txMap, "c")

        expect(size).toBe(3)
        expect(c).toEqual(Option.some(3))
      }).pipe(Effect.runSync))

    it("set - existing key", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1], ["b", 2])
        yield* TxHashMap.set(txMap, "a", 10)

        const size = yield* TxHashMap.size(txMap)
        const a = yield* TxHashMap.get(txMap, "a")

        expect(size).toBe(2) // size unchanged
        expect(a).toEqual(Option.some(10))
      }).pipe(Effect.runSync))

    it("remove - existing key", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1], ["b", 2], ["c", 3])
        const removed = yield* TxHashMap.remove(txMap, "b")

        const size = yield* TxHashMap.size(txMap)
        const hasB = yield* TxHashMap.has(txMap, "b")

        expect(removed).toBe(true)
        expect(size).toBe(2)
        expect(hasB).toBe(false)
      }).pipe(Effect.runSync))

    it("remove - non-existing key", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1], ["b", 2])
        const removed = yield* TxHashMap.remove(txMap, "c")

        const size = yield* TxHashMap.size(txMap)

        expect(removed).toBe(false)
        expect(size).toBe(2)
      }).pipe(Effect.runSync))

    it("clear", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1], ["b", 2], ["c", 3])
        yield* TxHashMap.clear(txMap)

        const size = yield* TxHashMap.size(txMap)
        const isEmpty = yield* TxHashMap.isEmpty(txMap)

        expect(size).toBe(0)
        expect(isEmpty).toBe(true)
      }).pipe(Effect.runSync))
  })

  describe("query operations", () => {
    it("size", () =>
      Effect.gen(function*() {
        const empty = yield* TxHashMap.empty<string, number>()
        const small = yield* TxHashMap.make(["a", 1])
        const large = yield* TxHashMap.make(["a", 1], ["b", 2], ["c", 3], ["d", 4])

        expect(yield* TxHashMap.size(empty)).toBe(0)
        expect(yield* TxHashMap.size(small)).toBe(1)
        expect(yield* TxHashMap.size(large)).toBe(4)
      }).pipe(Effect.runSync))

    it("isEmpty", () =>
      Effect.gen(function*() {
        const empty = yield* TxHashMap.empty<string, number>()
        const nonEmpty = yield* TxHashMap.make(["a", 1])

        expect(yield* TxHashMap.isEmpty(empty)).toBe(true)
        expect(yield* TxHashMap.isEmpty(nonEmpty)).toBe(false)
      }).pipe(Effect.runSync))

    it("isNonEmpty", () =>
      Effect.gen(function*() {
        const empty = yield* TxHashMap.empty<string, number>()
        const nonEmpty = yield* TxHashMap.make(["a", 1])

        expect(yield* TxHashMap.isNonEmpty(empty)).toBe(false)
        expect(yield* TxHashMap.isNonEmpty(nonEmpty)).toBe(true)
      }).pipe(Effect.runSync))
  })

  describe("advanced operations", () => {
    it("modify - existing key", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["counter", 5])
        const oldValue = yield* TxHashMap.modify(txMap, "counter", (n) => n * 2)
        const newValue = yield* TxHashMap.get(txMap, "counter")

        expect(oldValue).toEqual(Option.some(5))
        expect(newValue).toEqual(Option.some(10))
      }).pipe(Effect.runSync))

    it("modify - non-existing key", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.empty<string, number>()
        const oldValue = yield* TxHashMap.modify(txMap, "counter", (n) => n * 2)
        const size = yield* TxHashMap.size(txMap)

        expect(oldValue).toEqual(Option.none())
        expect(size).toBe(0)
      }).pipe(Effect.runSync))

    it("modifyAt - insert new value", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1])
        yield* TxHashMap.modifyAt(txMap, "b", () => Option.some(2))

        const size = yield* TxHashMap.size(txMap)
        const b = yield* TxHashMap.get(txMap, "b")

        expect(size).toBe(2)
        expect(b).toEqual(Option.some(2))
      }).pipe(Effect.runSync))

    it("modifyAt - remove existing value", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1], ["b", 2])
        yield* TxHashMap.modifyAt(txMap, "a", () => Option.none())

        const size = yield* TxHashMap.size(txMap)
        const hasA = yield* TxHashMap.has(txMap, "a")

        expect(size).toBe(1)
        expect(hasA).toBe(false)
      }).pipe(Effect.runSync))

    it("keys", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1], ["b", 2], ["c", 3])
        const keys = yield* TxHashMap.keys(txMap)

        expect(keys.sort()).toEqual(["a", "b", "c"])
      }).pipe(Effect.runSync))

    it("values", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1], ["b", 2], ["c", 3])
        const values = yield* TxHashMap.values(txMap)

        expect(values.sort()).toEqual([1, 2, 3])
      }).pipe(Effect.runSync))

    it("entries", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1], ["b", 2])
        const entries = yield* TxHashMap.entries(txMap)

        expect(entries.sort()).toEqual([["a", 1], ["b", 2]])
      }).pipe(Effect.runSync))

    it("snapshot", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1], ["b", 2])
        const snapshot = yield* TxHashMap.snapshot(txMap)

        // Modify the TxHashMap after taking snapshot
        yield* TxHashMap.set(txMap, "c", 3)

        // Snapshot should be unchanged
        expect(HashMap.size(snapshot)).toBe(2)
        expect(HashMap.get(snapshot, "a")).toEqual(Option.some(1))
        expect(HashMap.get(snapshot, "b")).toEqual(Option.some(2))
        expect(HashMap.get(snapshot, "c")).toEqual(Option.none())

        // Original should be modified
        expect(yield* TxHashMap.size(txMap)).toBe(3)
      }).pipe(Effect.runSync))
  })

  describe("bulk operations", () => {
    it("union", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1], ["b", 2])
        const other = HashMap.make(["b", 20], ["c", 3]) // "b" should be overwritten

        yield* TxHashMap.union(txMap, other)

        const size = yield* TxHashMap.size(txMap)
        const a = yield* TxHashMap.get(txMap, "a")
        const b = yield* TxHashMap.get(txMap, "b")
        const c = yield* TxHashMap.get(txMap, "c")

        expect(size).toBe(3)
        expect(a).toEqual(Option.some(1))
        expect(b).toEqual(Option.some(20)) // overwritten
        expect(c).toEqual(Option.some(3))
      }).pipe(Effect.runSync))

    it("removeMany", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1], ["b", 2], ["c", 3], ["d", 4])
        yield* TxHashMap.removeMany(txMap, ["b", "d"])

        const size = yield* TxHashMap.size(txMap)
        const hasA = yield* TxHashMap.has(txMap, "a")
        const hasB = yield* TxHashMap.has(txMap, "b")
        const hasC = yield* TxHashMap.has(txMap, "c")
        const hasD = yield* TxHashMap.has(txMap, "d")

        expect(size).toBe(2)
        expect(hasA).toBe(true)
        expect(hasB).toBe(false)
        expect(hasC).toBe(true)
        expect(hasD).toBe(false)
      }).pipe(Effect.runSync))

    it("setMany", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1], ["b", 2])
        const newEntries = [["c", 3], ["d", 4], ["a", 10]] as const // "a" should be overwritten

        yield* TxHashMap.setMany(txMap, newEntries)

        const size = yield* TxHashMap.size(txMap)
        const a = yield* TxHashMap.get(txMap, "a")
        const b = yield* TxHashMap.get(txMap, "b")
        const c = yield* TxHashMap.get(txMap, "c")
        const d = yield* TxHashMap.get(txMap, "d")

        expect(size).toBe(4)
        expect(a).toEqual(Option.some(10)) // overwritten
        expect(b).toEqual(Option.some(2)) // preserved
        expect(c).toEqual(Option.some(3)) // new
        expect(d).toEqual(Option.some(4)) // new
      }).pipe(Effect.runSync))
  })

  describe("transactional semantics", () => {
    it("single operations are automatically transactional", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["counter", 0])

        // These operations should be individually atomic
        yield* TxHashMap.set(txMap, "counter", 1)
        yield* TxHashMap.modify(txMap, "counter", (n) => n + 1)

        const result = yield* TxHashMap.get(txMap, "counter")
        expect(result).toEqual(Option.some(2))
      }).pipe(Effect.runSync))

    it("multi-step operations in explicit transaction", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.make(["a", 1], ["b", 2])

        // Multi-step atomic operation
        yield* Effect.transaction(
          Effect.gen(function*() {
            const currentA = yield* TxHashMap.get(txMap, "a")
            if (Option.isSome(currentA)) {
              yield* TxHashMap.set(txMap, "a", currentA.value * 10)
              yield* TxHashMap.remove(txMap, "b")
              yield* TxHashMap.set(txMap, "c", 3)
            }
          })
        )

        const a = yield* TxHashMap.get(txMap, "a")
        const hasB = yield* TxHashMap.has(txMap, "b")
        const c = yield* TxHashMap.get(txMap, "c")
        const size = yield* TxHashMap.size(txMap)

        expect(a).toEqual(Option.some(10))
        expect(hasB).toBe(false)
        expect(c).toEqual(Option.some(3))
        expect(size).toBe(2)
      }).pipe(Effect.runSync))
  })

  describe("pipe syntax", () => {
    it("supports data-last operations", () =>
      Effect.gen(function*() {
        const txMap = yield* TxHashMap.empty<string, number>()

        // Test data-last pipe operations
        yield* Effect.flatMap(TxHashMap.set(txMap, "a", 1), () => Effect.void)
        yield* Effect.flatMap(TxHashMap.set(txMap, "b", 2), () => Effect.void)

        const result = yield* TxHashMap.get(txMap, "a")
        const size = yield* TxHashMap.size(txMap)

        expect(result).toEqual(Option.some(1))
        expect(size).toBe(2)
      }).pipe(Effect.runSync))
  })
})
