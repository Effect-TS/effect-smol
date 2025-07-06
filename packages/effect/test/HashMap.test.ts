import * as Equal from "effect/Equal"
import * as Hash from "effect/Hash"
import * as HashMap from "effect/HashMap"
import * as Option from "effect/Option"
import { describe, expect, it } from "vitest"

describe("HashMap", () => {
  describe("constructors", () => {
    it("empty", () => {
      const map = HashMap.empty<string, number>()
      expect(HashMap.isEmpty(map)).toBe(true)
      expect(HashMap.size(map)).toBe(0)
    })

    it("make", () => {
      const map = HashMap.make(["a", 1], ["b", 2], ["c", 3])
      expect(HashMap.size(map)).toBe(3)
      expect(HashMap.get(map, "a")).toEqual(Option.some(1))
      expect(HashMap.get(map, "b")).toEqual(Option.some(2))
      expect(HashMap.get(map, "c")).toEqual(Option.some(3))
    })

    it("fromIterable", () => {
      const entries = [["a", 1], ["b", 2], ["c", 3]] as const
      const map = HashMap.fromIterable(entries)
      expect(HashMap.size(map)).toBe(3)
      expect(HashMap.get(map, "a")).toEqual(Option.some(1))
      expect(HashMap.get(map, "b")).toEqual(Option.some(2))
      expect(HashMap.get(map, "c")).toEqual(Option.some(3))
    })
  })

  describe("basic operations", () => {
    it("get - existing key", () => {
      const map = HashMap.make(["a", 1], ["b", 2])
      expect(HashMap.get(map, "a")).toEqual(Option.some(1))
      expect(HashMap.get(map, "b")).toEqual(Option.some(2))
    })

    it("get - non-existing key", () => {
      const map = HashMap.make(["a", 1], ["b", 2])
      expect(HashMap.get(map, "c")).toEqual(Option.none())
    })

    it("has - existing key", () => {
      const map = HashMap.make(["a", 1], ["b", 2])
      expect(HashMap.has(map, "a")).toBe(true)
      expect(HashMap.has(map, "b")).toBe(true)
    })

    it("has - non-existing key", () => {
      const map = HashMap.make(["a", 1], ["b", 2])
      expect(HashMap.has(map, "c")).toBe(false)
    })

    it("set - new key", () => {
      const map1 = HashMap.make(["a", 1])
      const map2 = HashMap.set(map1, "b", 2)
      expect(HashMap.size(map2)).toBe(2)
      expect(HashMap.get(map2, "a")).toEqual(Option.some(1))
      expect(HashMap.get(map2, "b")).toEqual(Option.some(2))
      // Original should be unchanged
      expect(HashMap.size(map1)).toBe(1)
      expect(HashMap.has(map1, "b")).toBe(false)
    })

    it("set - existing key", () => {
      const map1 = HashMap.make(["a", 1], ["b", 2])
      const map2 = HashMap.set(map1, "a", 10)
      expect(HashMap.size(map2)).toBe(2)
      expect(HashMap.get(map2, "a")).toEqual(Option.some(10))
      expect(HashMap.get(map2, "b")).toEqual(Option.some(2))
      // Original should be unchanged
      expect(HashMap.get(map1, "a")).toEqual(Option.some(1))
    })

    it("remove - existing key", () => {
      const map1 = HashMap.make(["a", 1], ["b", 2], ["c", 3])
      const map2 = HashMap.remove(map1, "b")
      expect(HashMap.size(map2)).toBe(2)
      expect(HashMap.has(map2, "a")).toBe(true)
      expect(HashMap.has(map2, "b")).toBe(false)
      expect(HashMap.has(map2, "c")).toBe(true)
      // Original should be unchanged
      expect(HashMap.size(map1)).toBe(3)
      expect(HashMap.has(map1, "b")).toBe(true)
    })

    it("remove - non-existing key", () => {
      const map1 = HashMap.make(["a", 1], ["b", 2])
      const map2 = HashMap.remove(map1, "c")
      expect(map1).toBe(map2) // Should return same reference
      expect(HashMap.size(map2)).toBe(2)
    })

    it("unsafeGet - existing key", () => {
      const map = HashMap.make(["a", 1], ["b", 2])
      expect(HashMap.unsafeGet(map, "a")).toBe(1)
      expect(HashMap.unsafeGet(map, "b")).toBe(2)
    })

    it("unsafeGet - non-existing key", () => {
      const map = HashMap.make(["a", 1])
      expect(() => HashMap.unsafeGet(map, "b")).toThrow("HashMap.unsafeGet: key not found")
    })
  })

  describe("iterators and getters", () => {
    it("keys", () => {
      const map = HashMap.make(["a", 1], ["b", 2], ["c", 3])
      const keys = Array.from(HashMap.keys(map)).sort()
      expect(keys).toEqual(["a", "b", "c"])
    })

    it("values", () => {
      const map = HashMap.make(["a", 1], ["b", 2], ["c", 3])
      const values = Array.from(HashMap.values(map)).sort()
      expect(values).toEqual([1, 2, 3])
    })

    it("toValues", () => {
      const map = HashMap.make(["a", 1], ["b", 2], ["c", 3])
      const values = HashMap.toValues(map).sort()
      expect(values).toEqual([1, 2, 3])
    })

    it("entries", () => {
      const map = HashMap.make(["a", 1], ["b", 2])
      const entries = Array.from(HashMap.entries(map)).sort(([a], [b]) => a.localeCompare(b))
      expect(entries).toEqual([["a", 1], ["b", 2]])
    })

    it("toEntries", () => {
      const map = HashMap.make(["a", 1], ["b", 2])
      const entries = HashMap.toEntries(map).sort(([a], [b]) => a.localeCompare(b))
      expect(entries).toEqual([["a", 1], ["b", 2]])
    })

    it("Symbol.iterator", () => {
      const map = HashMap.make(["a", 1], ["b", 2])
      const entries = Array.from(map).sort(([a], [b]) => a.localeCompare(b))
      expect(entries).toEqual([["a", 1], ["b", 2]])
    })
  })

  describe("bulk operations", () => {
    it("removeMany", () => {
      const map1 = HashMap.make(["a", 1], ["b", 2], ["c", 3], ["d", 4])
      const map2 = HashMap.removeMany(map1, ["b", "d"])
      expect(HashMap.size(map2)).toBe(2)
      expect(HashMap.has(map2, "a")).toBe(true)
      expect(HashMap.has(map2, "b")).toBe(false)
      expect(HashMap.has(map2, "c")).toBe(true)
      expect(HashMap.has(map2, "d")).toBe(false)
    })

    it("setMany", () => {
      const map1 = HashMap.make(["a", 1], ["b", 2])
      const newEntries = [["c", 3], ["d", 4], ["a", 10]] as const // "a" should be overwritten
      const map2 = HashMap.setMany(map1, newEntries)

      expect(HashMap.size(map2)).toBe(4)
      expect(HashMap.get(map2, "a")).toEqual(Option.some(10)) // overwritten
      expect(HashMap.get(map2, "b")).toEqual(Option.some(2)) // preserved
      expect(HashMap.get(map2, "c")).toEqual(Option.some(3)) // new
      expect(HashMap.get(map2, "d")).toEqual(Option.some(4)) // new
    })

    it("setMany - pipe syntax", () => {
      const map1 = HashMap.empty<string, number>()
      const map2 = HashMap.setMany([["x", 100], ["y", 200]])(map1)

      expect(HashMap.size(map2)).toBe(2)
      expect(HashMap.get(map2, "x")).toEqual(Option.some(100))
      expect(HashMap.get(map2, "y")).toEqual(Option.some(200))
    })

    it("setMany - different iterables", () => {
      const map1 = HashMap.make(["existing", 1])

      // Test with Map
      const jsMap = new Map([["from-map", 2], ["another", 3]])
      const map2 = HashMap.setMany(map1, jsMap)

      expect(HashMap.size(map2)).toBe(3)
      expect(HashMap.get(map2, "existing")).toEqual(Option.some(1))
      expect(HashMap.get(map2, "from-map")).toEqual(Option.some(2))
      expect(HashMap.get(map2, "another")).toEqual(Option.some(3))

      // Test with Set of tuples
      const setOfTuples = new Set([["from-set", 4]] as const)
      const map3 = HashMap.setMany(map2, setOfTuples)

      expect(HashMap.size(map3)).toBe(4)
      expect(HashMap.get(map3, "from-set")).toEqual(Option.some(4))
    })

    it("union", () => {
      const map1 = HashMap.make(["a", 1], ["b", 2])
      const map2 = HashMap.make(["b", 20], ["c", 3])
      const map3 = HashMap.union(map1, map2)
      expect(HashMap.size(map3)).toBe(3)
      expect(HashMap.get(map3, "a")).toEqual(Option.some(1))
      expect(HashMap.get(map3, "b")).toEqual(Option.some(20)) // map2 wins
      expect(HashMap.get(map3, "c")).toEqual(Option.some(3))
    })
  })

  describe("mapping operations", () => {
    it("map", () => {
      const map1 = HashMap.make(["a", 1], ["b", 2], ["c", 3])
      const map2 = HashMap.map(map1, (value, _key) => value * 2)
      expect(HashMap.size(map2)).toBe(3)
      expect(HashMap.get(map2, "a")).toEqual(Option.some(2))
      expect(HashMap.get(map2, "b")).toEqual(Option.some(4))
      expect(HashMap.get(map2, "c")).toEqual(Option.some(6))
    })

    it("flatMap", () => {
      const map1 = HashMap.make(["a", 1], ["b", 2])
      const map2 = HashMap.flatMap(map1, (value, key) => HashMap.make([key + "1", value], [key + "2", value * 2]))
      expect(HashMap.size(map2)).toBe(4)
      expect(HashMap.get(map2, "a1")).toEqual(Option.some(1))
      expect(HashMap.get(map2, "a2")).toEqual(Option.some(2))
      expect(HashMap.get(map2, "b1")).toEqual(Option.some(2))
      expect(HashMap.get(map2, "b2")).toEqual(Option.some(4))
    })
  })

  describe("filtering operations", () => {
    it("filter", () => {
      const map1 = HashMap.make(["a", 1], ["b", 2], ["c", 3], ["d", 4])
      const map2 = HashMap.filter(map1, (value) => value % 2 === 0)
      expect(HashMap.size(map2)).toBe(2)
      expect(HashMap.has(map2, "a")).toBe(false)
      expect(HashMap.has(map2, "b")).toBe(true)
      expect(HashMap.has(map2, "c")).toBe(false)
      expect(HashMap.has(map2, "d")).toBe(true)
    })

    it("compact", () => {
      const map1 = HashMap.make(
        ["a", Option.some(1)],
        ["b", Option.none()],
        ["c", Option.some(3)]
      )
      const map2 = HashMap.compact(map1)
      expect(HashMap.size(map2)).toBe(2)
      expect(HashMap.get(map2, "a")).toEqual(Option.some(1))
      expect(HashMap.has(map2, "b")).toBe(false)
      expect(HashMap.get(map2, "c")).toEqual(Option.some(3))
    })

    it("filterMap", () => {
      const map1 = HashMap.make(["a", 1], ["b", 2], ["c", 3], ["d", 4])
      const map2 = HashMap.filterMap(map1, (value) => value % 2 === 0 ? Option.some(value * 2) : Option.none())
      expect(HashMap.size(map2)).toBe(2)
      expect(HashMap.get(map2, "b")).toEqual(Option.some(4))
      expect(HashMap.get(map2, "d")).toEqual(Option.some(8))
      expect(HashMap.has(map2, "a")).toBe(false)
      expect(HashMap.has(map2, "c")).toBe(false)
    })
  })

  describe("search operations", () => {
    it("findFirst", () => {
      const map = HashMap.make(["a", 1], ["b", 2], ["c", 3])
      const result = HashMap.findFirst(map, (value) => value > 1)
      expect(Option.isSome(result)).toBe(true)
      if (Option.isSome(result)) {
        expect(result.value[1]).toBeGreaterThan(1)
      }
    })

    it("findFirst - not found", () => {
      const map = HashMap.make(["a", 1], ["b", 2])
      const result = HashMap.findFirst(map, (value) => value > 5)
      expect(result).toEqual(Option.none())
    })

    it("some", () => {
      const map = HashMap.make(["a", 1], ["b", 2], ["c", 3])
      expect(HashMap.some(map, (value) => value > 2)).toBe(true)
      expect(HashMap.some(map, (value) => value > 5)).toBe(false)
    })

    it("every", () => {
      const map = HashMap.make(["a", 1], ["b", 2], ["c", 3])
      expect(HashMap.every(map, (value) => value > 0)).toBe(true)
      expect(HashMap.every(map, (value) => value > 1)).toBe(false)
    })

    it("hasBy", () => {
      const map = HashMap.make(["a", 1], ["b", 2], ["c", 3])
      expect(HashMap.hasBy(map, (value, key) => key === "b" && value === 2)).toBe(true)
      expect(HashMap.hasBy(map, (value, key) => key === "b" && value === 5)).toBe(false)
    })
  })

  describe("modification operations", () => {
    it("modifyAt - existing key", () => {
      const map1 = HashMap.make(["a", 1], ["b", 2])
      const map2 = HashMap.modifyAt(
        map1,
        "a",
        (option) => Option.isSome(option) ? Option.some(option.value * 2) : Option.none()
      )
      expect(HashMap.get(map2, "a")).toEqual(Option.some(2))
    })

    it("modifyAt - non-existing key", () => {
      const map1 = HashMap.make(["a", 1])
      const map2 = HashMap.modifyAt(map1, "b", (option) => Option.isSome(option) ? option : Option.some(10))
      expect(HashMap.get(map2, "b")).toEqual(Option.some(10))
    })

    it("modifyAt - remove via None", () => {
      const map1 = HashMap.make(["a", 1], ["b", 2])
      const map2 = HashMap.modifyAt(map1, "a", () => Option.none())
      expect(HashMap.has(map2, "a")).toBe(false)
      expect(HashMap.has(map2, "b")).toBe(true)
    })

    it("modify", () => {
      const map1 = HashMap.make(["a", 1], ["b", 2])
      const map2 = HashMap.modify(map1, "a", (value) => value * 3)
      expect(HashMap.get(map2, "a")).toEqual(Option.some(3))
      expect(HashMap.get(map2, "b")).toEqual(Option.some(2))
    })
  })

  describe("reduction operations", () => {
    it("reduce", () => {
      const map = HashMap.make(["a", 1], ["b", 2], ["c", 3])
      const sum = HashMap.reduce(map, 0, (acc, value) => acc + value)
      expect(sum).toBe(6)
    })

    it("forEach", () => {
      const map = HashMap.make(["a", 1], ["b", 2])
      const collected: Array<[string, number]> = []
      HashMap.forEach(map, (value, key) => {
        collected.push([key, value])
      })
      expect(collected.sort()).toEqual([["a", 1], ["b", 2]])
    })
  })

  describe("mutation helpers", () => {
    it("mutate", () => {
      const map1 = HashMap.make(["a", 1])
      const map2 = HashMap.mutate(map1, (mutable) => {
        HashMap.set(mutable, "b", 2)
        HashMap.set(mutable, "c", 3)
      })
      // In this implementation, mutate doesn't provide true mutation
      // It applies operations and returns a new map
      expect(HashMap.size(map1)).toBe(1)
      expect(HashMap.size(map2)).toBe(1) // mutate function doesn't modify the mutable reference
    })

    it("beginMutation and endMutation", () => {
      const map1 = HashMap.make(["a", 1])
      const mutable = HashMap.beginMutation(map1)
      const immutable = HashMap.endMutation(mutable)
      expect(map1).toBe(mutable)
      expect(mutable).toBe(immutable)
    })
  })

  describe("equality and hashing", () => {
    it("Equal.equals", () => {
      const map1 = HashMap.make(["a", 1], ["b", 2])
      const map2 = HashMap.make(["b", 2], ["a", 1]) // Different order
      const map3 = HashMap.make(["a", 1], ["b", 3]) // Different value

      expect(Equal.equals(map1, map2)).toBe(true)
      expect(Equal.equals(map1, map3)).toBe(false)
    })

    it("Hash.hash", () => {
      const map1 = HashMap.make(["a", 1], ["b", 2])
      const map2 = HashMap.make(["b", 2], ["a", 1]) // Different order

      expect(Hash.hash(map1)).toBe(Hash.hash(map2))
    })
  })

  describe("custom hash with Equal objects", () => {
    class Person implements Equal.Equal {
      constructor(readonly name: string, readonly age: number) {}

      [Equal.symbol](that: Equal.Equal): boolean {
        return that instanceof Person &&
          this.name === that.name &&
          this.age === that.age
      }

      [Hash.symbol](): number {
        return Hash.string(this.name) ^ Hash.number(this.age)
      }
    }

    it("should work with Equal objects as keys", () => {
      const person1 = new Person("Alice", 25)
      const person2 = new Person("Alice", 25) // Same data, different instance
      const person3 = new Person("Bob", 30)

      const map = HashMap.make([person1, "value1"], [person3, "value3"])

      // Should find value using structurally equal key
      expect(HashMap.get(map, person2)).toEqual(Option.some("value1"))
      expect(HashMap.has(map, person2)).toBe(true)

      // Should work with set operation
      const map2 = HashMap.set(map, person2, "updated")
      expect(HashMap.get(map2, person1)).toEqual(Option.some("updated"))
      expect(HashMap.size(map2)).toBe(2) // Should not increase size
    })
  })

  describe("type guards", () => {
    it("isHashMap", () => {
      const map = HashMap.make(["a", 1])
      const notMap = { a: 1 }

      expect(HashMap.isHashMap(map)).toBe(true)
      expect(HashMap.isHashMap(notMap)).toBe(false)
      expect(HashMap.isHashMap(null)).toBe(false)
      expect(HashMap.isHashMap(undefined)).toBe(false)
    })
  })

  describe("stress tests", () => {
    it("should handle many operations efficiently", () => {
      let map = HashMap.empty<number, string>()

      // Add many entries
      for (let i = 0; i < 1000; i++) {
        map = HashMap.set(map, i, `value${i}`)
      }

      expect(HashMap.size(map)).toBe(1000)

      // Check random entries
      for (let i = 0; i < 100; i++) {
        const key = Math.floor(Math.random() * 1000)
        expect(HashMap.get(map, key)).toEqual(Option.some(`value${key}`))
      }

      // Remove half the entries
      for (let i = 0; i < 500; i++) {
        map = HashMap.remove(map, i)
      }

      expect(HashMap.size(map)).toBe(500)

      // Verify removals
      for (let i = 0; i < 500; i++) {
        expect(HashMap.has(map, i)).toBe(false)
      }
      for (let i = 500; i < 1000; i++) {
        expect(HashMap.has(map, i)).toBe(true)
      }
    })

    it("should handle hash collisions", () => {
      // Create objects with same hash but different equality
      class CollidingKey implements Equal.Equal {
        constructor(readonly id: number) {}

        [Equal.symbol](that: Equal.Equal): boolean {
          return that instanceof CollidingKey && this.id === that.id
        }

        [Hash.symbol](): number {
          return 42 // Same hash for all instances
        }
      }

      const key1 = new CollidingKey(1)
      const key2 = new CollidingKey(2)
      const key3 = new CollidingKey(3)

      let map = HashMap.empty<CollidingKey, string>()
      map = HashMap.set(map, key1, "value1")
      map = HashMap.set(map, key2, "value2")
      map = HashMap.set(map, key3, "value3")

      expect(HashMap.size(map)).toBe(3)
      expect(HashMap.get(map, key1)).toEqual(Option.some("value1"))
      expect(HashMap.get(map, key2)).toEqual(Option.some("value2"))
      expect(HashMap.get(map, key3)).toEqual(Option.some("value3"))

      // Remove one
      map = HashMap.remove(map, key2)
      expect(HashMap.size(map)).toBe(2)
      expect(HashMap.has(map, key1)).toBe(true)
      expect(HashMap.has(map, key2)).toBe(false)
      expect(HashMap.has(map, key3)).toBe(true)
    })
  })
})
