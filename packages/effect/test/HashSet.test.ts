import { HashSet } from "effect/collections"
import { Equal, Hash } from "effect/interfaces"
import { describe, expect, it } from "vitest"

describe("HashSet", () => {
  describe("constructors", () => {
    it("empty", () => {
      const set = HashSet.empty<string>()
      expect(HashSet.size(set)).toBe(0)
      expect(HashSet.isEmpty(set)).toBe(true)
    })

    it("make", () => {
      const set = HashSet.make("a", "b", "c")
      expect(HashSet.size(set)).toBe(3)
      expect(HashSet.has(set, "a")).toBe(true)
      expect(HashSet.has(set, "b")).toBe(true)
      expect(HashSet.has(set, "c")).toBe(true)
      expect(HashSet.has(set, "d")).toBe(false)
    })

    it("make with duplicates", () => {
      const set = HashSet.make("a", "b", "a", "c", "b")
      expect(HashSet.size(set)).toBe(3)
      expect(HashSet.has(set, "a")).toBe(true)
      expect(HashSet.has(set, "b")).toBe(true)
      expect(HashSet.has(set, "c")).toBe(true)
    })

    it("fromIterable", () => {
      const set = HashSet.fromIterable(["a", "b", "c", "b", "a"])
      expect(HashSet.size(set)).toBe(3)
      expect(HashSet.has(set, "a")).toBe(true)
      expect(HashSet.has(set, "b")).toBe(true)
      expect(HashSet.has(set, "c")).toBe(true)
    })
  })

  describe("basic operations", () => {
    it("add", () => {
      const original = HashSet.make("a", "b")
      const updated = HashSet.add(original, "c")

      // Original unchanged
      expect(HashSet.size(original)).toBe(2)
      expect(HashSet.has(original, "c")).toBe(false)

      // Updated has new element
      expect(HashSet.size(updated)).toBe(3)
      expect(HashSet.has(updated, "c")).toBe(true)
      expect(HashSet.has(updated, "a")).toBe(true)
      expect(HashSet.has(updated, "b")).toBe(true)
    })

    it("add existing element", () => {
      const original = HashSet.make("a", "b")
      const same = HashSet.add(original, "a")

      expect(HashSet.size(same)).toBe(2)
      expect(same).toBe(original) // Should return same reference
    })

    it("remove", () => {
      const original = HashSet.make("a", "b", "c")
      const updated = HashSet.remove(original, "b")

      // Original unchanged
      expect(HashSet.size(original)).toBe(3)
      expect(HashSet.has(original, "b")).toBe(true)

      // Updated has element removed
      expect(HashSet.size(updated)).toBe(2)
      expect(HashSet.has(updated, "b")).toBe(false)
      expect(HashSet.has(updated, "a")).toBe(true)
      expect(HashSet.has(updated, "c")).toBe(true)
    })

    it("remove non-existent element", () => {
      const original = HashSet.make("a", "b")
      const same = HashSet.remove(original, "c")

      expect(HashSet.size(same)).toBe(2)
      expect(same).toBe(original) // Should return same reference
    })

    it("has", () => {
      const set = HashSet.make("a", "b", "c")

      expect(HashSet.has(set, "a")).toBe(true)
      expect(HashSet.has(set, "b")).toBe(true)
      expect(HashSet.has(set, "c")).toBe(true)
      expect(HashSet.has(set, "d")).toBe(false)
    })

    it("size and isEmpty", () => {
      const empty = HashSet.empty<string>()
      expect(HashSet.size(empty)).toBe(0)
      expect(HashSet.isEmpty(empty)).toBe(true)

      const single = HashSet.make("a")
      expect(HashSet.size(single)).toBe(1)
      expect(HashSet.isEmpty(single)).toBe(false)

      const multiple = HashSet.make("a", "b", "c")
      expect(HashSet.size(multiple)).toBe(3)
      expect(HashSet.isEmpty(multiple)).toBe(false)
    })
  })

  describe("set operations", () => {
    it("union", () => {
      const set1 = HashSet.make("a", "b")
      const set2 = HashSet.make("b", "c")
      const result = HashSet.union(set1, set2)

      expect(HashSet.size(result)).toBe(3)
      expect(HashSet.has(result, "a")).toBe(true)
      expect(HashSet.has(result, "b")).toBe(true)
      expect(HashSet.has(result, "c")).toBe(true)
    })

    it("intersection", () => {
      const set1 = HashSet.make("a", "b", "c")
      const set2 = HashSet.make("b", "c", "d")
      const result = HashSet.intersection(set1, set2)

      expect(HashSet.size(result)).toBe(2)
      expect(HashSet.has(result, "b")).toBe(true)
      expect(HashSet.has(result, "c")).toBe(true)
      expect(HashSet.has(result, "a")).toBe(false)
      expect(HashSet.has(result, "d")).toBe(false)
    })

    it("difference", () => {
      const set1 = HashSet.make("a", "b", "c")
      const set2 = HashSet.make("b", "d")
      const result = HashSet.difference(set1, set2)

      expect(HashSet.size(result)).toBe(2)
      expect(HashSet.has(result, "a")).toBe(true)
      expect(HashSet.has(result, "c")).toBe(true)
      expect(HashSet.has(result, "b")).toBe(false)
    })

    it("isSubset", () => {
      const small = HashSet.make("a", "b")
      const large = HashSet.make("a", "b", "c", "d")
      const other = HashSet.make("x", "y")

      expect(HashSet.isSubset(small, large)).toBe(true)
      expect(HashSet.isSubset(large, small)).toBe(false)
      expect(HashSet.isSubset(small, other)).toBe(false)
      expect(HashSet.isSubset(small, small)).toBe(true)
    })
  })

  describe("functional operations", () => {
    it("map", () => {
      const numbers = HashSet.make(1, 2, 3)
      const doubled = HashSet.map(numbers, (n) => n * 2)

      expect(HashSet.size(doubled)).toBe(3)
      expect(HashSet.has(doubled, 2)).toBe(true)
      expect(HashSet.has(doubled, 4)).toBe(true)
      expect(HashSet.has(doubled, 6)).toBe(true)
    })

    it("map with duplicates", () => {
      const strings = HashSet.make("apple", "banana", "cherry")
      const lengths = HashSet.map(strings, (s) => s.length)

      expect(HashSet.size(lengths)).toBe(2) // 5 and 6 (apple=5, banana=6, cherry=6)
      expect(HashSet.has(lengths, 5)).toBe(true)
      expect(HashSet.has(lengths, 6)).toBe(true)
    })

    it("filter", () => {
      const numbers = HashSet.make(1, 2, 3, 4, 5, 6)
      const evens = HashSet.filter(numbers, (n) => n % 2 === 0)

      expect(HashSet.size(evens)).toBe(3)
      expect(HashSet.has(evens, 2)).toBe(true)
      expect(HashSet.has(evens, 4)).toBe(true)
      expect(HashSet.has(evens, 6)).toBe(true)
      expect(HashSet.has(evens, 1)).toBe(false)
    })

    it("some", () => {
      const numbers = HashSet.make(1, 2, 3, 4, 5)

      expect(HashSet.some(numbers, (n) => n > 3)).toBe(true)
      expect(HashSet.some(numbers, (n) => n > 10)).toBe(false)

      const empty = HashSet.empty<number>()
      expect(HashSet.some(empty, (n) => n > 0)).toBe(false)
    })

    it("every", () => {
      const evens = HashSet.make(2, 4, 6, 8)

      expect(HashSet.every(evens, (n) => n % 2 === 0)).toBe(true)
      expect(HashSet.every(evens, (n) => n > 5)).toBe(false)

      const empty = HashSet.empty<number>()
      expect(HashSet.every(empty, (n) => n > 0)).toBe(true) // vacuously true
    })

    it("reduce", () => {
      const numbers = HashSet.make(1, 2, 3, 4, 5)
      const sum = HashSet.reduce(numbers, 0, (acc, n) => acc + n)

      expect(sum).toBe(15)

      const empty = HashSet.empty<number>()
      const zeroSum = HashSet.reduce(empty, 0, (acc, n) => acc + n)
      expect(zeroSum).toBe(0)
    })
  })

  describe("iteration", () => {
    it("Symbol.iterator", () => {
      const set = HashSet.make("a", "b", "c")
      const values = Array.from(set).sort()

      expect(values).toEqual(["a", "b", "c"])
    })

    it("for...of loop", () => {
      const set = HashSet.make("x", "y", "z")
      const collected = []

      for (const value of set) {
        collected.push(value)
      }

      expect(collected.sort()).toEqual(["x", "y", "z"])
    })
  })

  describe("equality and hashing", () => {
    it("structural equality", () => {
      const set1 = HashSet.make("a", "b", "c")
      const set2 = HashSet.make("c", "b", "a") // Different order
      const set3 = HashSet.make("a", "b", "d") // Different content

      expect(Equal.equals(set1, set2)).toBe(true)
      expect(Equal.equals(set1, set3)).toBe(false)
    })

    it("hash consistency", () => {
      const set1 = HashSet.make("a", "b", "c")
      const set2 = HashSet.make("c", "b", "a") // Same content, different order

      expect(Hash.hash(set1)).toBe(Hash.hash(set2))
    })
  })

  describe("custom Equal objects", () => {
    class Person implements Equal.Equal {
      constructor(readonly id: string, readonly name: string) {}

      [Equal.symbol](other: unknown): boolean {
        return other instanceof Person && this.id === other.id
      }

      [Hash.symbol](): number {
        return Hash.string(this.id)
      }
    }

    it("works with custom Equal implementation", () => {
      const alice1 = new Person("1", "Alice")
      const alice2 = new Person("1", "Alice") // Same ID
      const bob = new Person("2", "Bob")

      const people = HashSet.make(alice1, bob)

      expect(HashSet.has(people, alice2)).toBe(true) // Should find by ID
      expect(HashSet.size(people)).toBe(2)

      const withDuplicate = HashSet.add(people, alice2)
      expect(HashSet.size(withDuplicate)).toBe(2) // Should not add duplicate
    })
  })

  describe("type guards", () => {
    it("isHashSet", () => {
      const set = HashSet.make("a", "b", "c")
      const array = ["a", "b", "c"]
      const object = { a: 1, b: 2 }

      expect(HashSet.isHashSet(set)).toBe(true)
      expect(HashSet.isHashSet(array)).toBe(false)
      expect(HashSet.isHashSet(object)).toBe(false)
      expect(HashSet.isHashSet(null)).toBe(false)
      expect(HashSet.isHashSet(undefined)).toBe(false)
    })
  })
})
