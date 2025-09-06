import * as HashMap from "effect/collections/HashMap"
import * as Option from "effect/data/Option"
import * as Equal from "effect/interfaces/Equal"
import * as Hash from "effect/interfaces/Hash"
import { describe, expect, it } from "vitest"

describe("Equal - Structural Equality Behavior", () => {
  describe("plain objects", () => {
    it("should return true for structurally identical objects (structural equality)", () => {
      const obj1 = { a: 1, b: 2 }
      const obj2 = { a: 1, b: 2 }
      expect(Equal.equals(obj1, obj2)).toBe(true)
    })

    it("should return true for same reference", () => {
      const obj = { a: 1, b: 2 }
      expect(Equal.equals(obj, obj)).toBe(true)
    })

    it("should return true for empty objects", () => {
      expect(Equal.equals({}, {})).toBe(true)
    })

    it("should return false for objects with different values", () => {
      const obj1 = { a: 1, b: 2 }
      const obj2 = { a: 1, b: 3 }
      expect(Equal.equals(obj1, obj2)).toBe(false)
    })

    it("should return false for objects with different keys", () => {
      const obj1 = { a: 1, b: 2 }
      const obj2 = { a: 1, c: 2 }
      expect(Equal.equals(obj1, obj2)).toBe(false)
    })
  })

  describe("plain arrays", () => {
    it("should return true for structurally identical arrays (structural equality)", () => {
      const arr1 = [1, 2, 3]
      const arr2 = [1, 2, 3]
      expect(Equal.equals(arr1, arr2)).toBe(true)
    })

    it("should return true for same reference", () => {
      const arr = [1, 2, 3]
      expect(Equal.equals(arr, arr)).toBe(true)
    })

    it("should return true for empty arrays", () => {
      expect(Equal.equals([], [])).toBe(true)
    })

    it("should return false for arrays with different elements", () => {
      const arr1 = [1, 2, 3]
      const arr2 = [1, 2, 4]
      expect(Equal.equals(arr1, arr2)).toBe(false)
    })

    it("should return false for arrays with different lengths", () => {
      const arr1 = [1, 2, 3]
      const arr2 = [1, 2]
      expect(Equal.equals(arr1, arr2)).toBe(false)
    })
  })

  describe("primitives", () => {
    it("should work correctly for numbers", () => {
      expect(Equal.equals(42, 42)).toBe(true)
      expect(Equal.equals(42, 43)).toBe(false)
    })

    it("should work correctly for strings", () => {
      expect(Equal.equals("hello", "hello")).toBe(true)
      expect(Equal.equals("hello", "world")).toBe(false)
    })

    it("should work correctly for booleans", () => {
      expect(Equal.equals(true, true)).toBe(true)
      expect(Equal.equals(false, false)).toBe(true)
      expect(Equal.equals(true, false)).toBe(false)
    })

    it("should work correctly for null and undefined", () => {
      expect(Equal.equals(null, null)).toBe(true)
      expect(Equal.equals(undefined, undefined)).toBe(true)
      expect(Equal.equals(null, undefined)).toBe(false)
    })
  })

  describe("Date objects", () => {
    it("should compare dates by ISO string", () => {
      const date1 = new Date("2023-01-01T00:00:00.000Z")
      const date2 = new Date("2023-01-01T00:00:00.000Z")
      expect(Equal.equals(date1, date2)).toBe(true)
    })

    it("should return false for different dates", () => {
      const date1 = new Date("2023-01-01T00:00:00.000Z")
      const date2 = new Date("2023-01-02T00:00:00.000Z")
      expect(Equal.equals(date1, date2)).toBe(false)
    })
  })

  describe("Effect data structures", () => {
    it("should work with HashMap (implements Equal interface)", () => {
      const map1 = HashMap.make(["a", 1], ["b", 2])
      const map2 = HashMap.make(["a", 1], ["b", 2])
      expect(Equal.equals(map1, map2)).toBe(true)
    })

    it("should work with Option (implements Equal interface)", () => {
      const opt1 = Option.some(42)
      const opt2 = Option.some(42)
      expect(Equal.equals(opt1, opt2)).toBe(true)
    })

    it("HashMap should not equal plain objects", () => {
      const map = HashMap.make(["a", 1], ["b", 2])
      const obj = { a: 1, b: 2 }
      expect(Equal.equals(map, obj)).toBe(false)
    })
  })

  describe("custom Equal implementations", () => {
    class CustomPoint implements Equal.Equal {
      constructor(readonly x: number, readonly y: number) {}

      [Equal.symbol](that: Equal.Equal): boolean {
        return that instanceof CustomPoint &&
          this.x === that.x &&
          this.y === that.y
      }

      [Hash.symbol](): number {
        return 0
      }
    }

    it("should work with custom Equal implementation", () => {
      const point1 = new CustomPoint(1, 2)
      const point2 = new CustomPoint(1, 2)
      expect(Equal.equals(point1, point2)).toBe(true)
    })
  })

  describe("nested structures", () => {
    it("should return true for nested objects (deep structural equality)", () => {
      const obj1 = { a: { b: 1 }, c: [1, 2] }
      const obj2 = { a: { b: 1 }, c: [1, 2] }
      expect(Equal.equals(obj1, obj2)).toBe(true)
    })

    it("should return true for nested arrays (deep structural equality)", () => {
      const arr1 = [[1, 2], [3, 4]]
      const arr2 = [[1, 2], [3, 4]]
      expect(Equal.equals(arr1, arr2)).toBe(true)
    })

    it("should return false for nested objects with different values", () => {
      const obj1 = { a: { b: 1 }, c: [1, 2] }
      const obj2 = { a: { b: 2 }, c: [1, 2] }
      expect(Equal.equals(obj1, obj2)).toBe(false)
    })

    it("should return false for nested arrays with different values", () => {
      const arr1 = [[1, 2], [3, 4]]
      const arr2 = [[1, 3], [3, 4]]
      expect(Equal.equals(arr1, arr2)).toBe(false)
    })
  })

  describe("special values", () => {
    describe("NaN", () => {
      it("should handle NaN correctly (structural equality - NaN equals NaN)", () => {
        expect(Equal.equals(NaN, NaN)).toBe(true)
      })

      it("should return false when comparing NaN with regular numbers", () => {
        expect(Equal.equals(NaN, 0)).toBe(false)
        expect(Equal.equals(NaN, 42)).toBe(false)
        expect(Equal.equals(42, NaN)).toBe(false)
      })

      it("should return false when comparing NaN with Infinity", () => {
        expect(Equal.equals(NaN, Infinity)).toBe(false)
        expect(Equal.equals(NaN, -Infinity)).toBe(false)
        expect(Equal.equals(Infinity, NaN)).toBe(false)
        expect(Equal.equals(-Infinity, NaN)).toBe(false)
      })

      it("should handle NaN in arrays", () => {
        expect(Equal.equals([NaN], [NaN])).toBe(true)
        expect(Equal.equals([NaN, 1], [NaN, 1])).toBe(true)
        expect(Equal.equals([NaN, 1], [NaN, 2])).toBe(false)
        expect(Equal.equals([NaN], [Infinity])).toBe(false)
      })

      it("should handle NaN in objects", () => {
        expect(Equal.equals({ a: NaN }, { a: NaN })).toBe(true)
        expect(Equal.equals({ a: NaN, b: 1 }, { a: NaN, b: 1 })).toBe(true)
        expect(Equal.equals({ a: NaN }, { a: Infinity })).toBe(false)
        expect(Equal.equals({ a: NaN }, { a: 42 })).toBe(false)
      })

      it("should handle NaN in nested structures", () => {
        expect(Equal.equals({ arr: [NaN] }, { arr: [NaN] })).toBe(true)
        expect(Equal.equals([{ val: NaN }], [{ val: NaN }])).toBe(true)
        expect(Equal.equals({ nested: { deep: NaN } }, { nested: { deep: NaN } })).toBe(true)
        expect(Equal.equals({ arr: [NaN] }, { arr: [Infinity] })).toBe(false)
      })
    })

    describe("Infinity", () => {
      it("should handle Infinity correctly (structural equality)", () => {
        expect(Equal.equals(Infinity, Infinity)).toBe(true)
      })

      it("should return false when comparing Infinity with regular numbers", () => {
        expect(Equal.equals(Infinity, 0)).toBe(false)
        expect(Equal.equals(Infinity, 42)).toBe(false)
        expect(Equal.equals(42, Infinity)).toBe(false)
        expect(Equal.equals(Infinity, Number.MAX_VALUE)).toBe(false)
      })

      it("should return false when comparing Infinity with -Infinity", () => {
        expect(Equal.equals(Infinity, -Infinity)).toBe(false)
        expect(Equal.equals(-Infinity, Infinity)).toBe(false)
      })

      it("should handle Infinity in arrays", () => {
        expect(Equal.equals([Infinity], [Infinity])).toBe(true)
        expect(Equal.equals([Infinity, 1], [Infinity, 1])).toBe(true)
        expect(Equal.equals([Infinity, 1], [Infinity, 2])).toBe(false)
        expect(Equal.equals([Infinity], [-Infinity])).toBe(false)
      })

      it("should handle Infinity in objects", () => {
        expect(Equal.equals({ a: Infinity }, { a: Infinity })).toBe(true)
        expect(Equal.equals({ a: Infinity, b: 1 }, { a: Infinity, b: 1 })).toBe(true)
        expect(Equal.equals({ a: Infinity }, { a: -Infinity })).toBe(false)
        expect(Equal.equals({ a: Infinity }, { a: 42 })).toBe(false)
      })

      it("should handle Infinity in nested structures", () => {
        expect(Equal.equals({ arr: [Infinity] }, { arr: [Infinity] })).toBe(true)
        expect(Equal.equals([{ val: Infinity }], [{ val: Infinity }])).toBe(true)
        expect(Equal.equals({ nested: { deep: Infinity } }, { nested: { deep: Infinity } })).toBe(true)
        expect(Equal.equals({ arr: [Infinity] }, { arr: [-Infinity] })).toBe(false)
      })
    })

    describe("-Infinity", () => {
      it("should handle -Infinity correctly (structural equality)", () => {
        expect(Equal.equals(-Infinity, -Infinity)).toBe(true)
      })

      it("should return false when comparing -Infinity with regular numbers", () => {
        expect(Equal.equals(-Infinity, 0)).toBe(false)
        expect(Equal.equals(-Infinity, -42)).toBe(false)
        expect(Equal.equals(-42, -Infinity)).toBe(false)
        expect(Equal.equals(-Infinity, Number.MIN_VALUE)).toBe(false)
      })

      it("should handle -Infinity in arrays", () => {
        expect(Equal.equals([-Infinity], [-Infinity])).toBe(true)
        expect(Equal.equals([-Infinity, 1], [-Infinity, 1])).toBe(true)
        expect(Equal.equals([-Infinity, 1], [-Infinity, 2])).toBe(false)
        expect(Equal.equals([-Infinity], [Infinity])).toBe(false)
      })

      it("should handle -Infinity in objects", () => {
        expect(Equal.equals({ a: -Infinity }, { a: -Infinity })).toBe(true)
        expect(Equal.equals({ a: -Infinity, b: 1 }, { a: -Infinity, b: 1 })).toBe(true)
        expect(Equal.equals({ a: -Infinity }, { a: Infinity })).toBe(false)
        expect(Equal.equals({ a: -Infinity }, { a: -42 })).toBe(false)
      })

      it("should handle -Infinity in nested structures", () => {
        expect(Equal.equals({ arr: [-Infinity] }, { arr: [-Infinity] })).toBe(true)
        expect(Equal.equals([{ val: -Infinity }], [{ val: -Infinity }])).toBe(true)
        expect(Equal.equals({ nested: { deep: -Infinity } }, { nested: { deep: -Infinity } })).toBe(true)
        expect(Equal.equals({ arr: [-Infinity] }, { arr: [Infinity] })).toBe(false)
      })
    })

    describe("mixed special values", () => {
      it("should handle arrays with multiple special values", () => {
        expect(Equal.equals([NaN, Infinity, -Infinity], [NaN, Infinity, -Infinity])).toBe(true)
        expect(Equal.equals([NaN, Infinity], [Infinity, NaN])).toBe(false) // order matters
        expect(Equal.equals([NaN, Infinity, 0], [NaN, Infinity, 0])).toBe(true)
      })

      it("should handle objects with multiple special values", () => {
        expect(Equal.equals(
          { nan: NaN, inf: Infinity, negInf: -Infinity },
          { nan: NaN, inf: Infinity, negInf: -Infinity }
        )).toBe(true)
        expect(Equal.equals(
          { nan: NaN, inf: Infinity },
          { nan: NaN, inf: -Infinity }
        )).toBe(false)
      })

      it("should handle complex nested structures with special values", () => {
        const obj1 = {
          data: [
            { value: NaN, meta: { type: "special" } },
            { value: Infinity, meta: { type: "infinite" } },
            { value: -Infinity, meta: { type: "negative-infinite" } }
          ]
        }
        const obj2 = {
          data: [
            { value: NaN, meta: { type: "special" } },
            { value: Infinity, meta: { type: "infinite" } },
            { value: -Infinity, meta: { type: "negative-infinite" } }
          ]
        }
        const obj3 = {
          data: [
            { value: NaN, meta: { type: "special" } },
            { value: -Infinity, meta: { type: "infinite" } }, // swapped values
            { value: Infinity, meta: { type: "negative-infinite" } }
          ]
        }

        expect(Equal.equals(obj1, obj2)).toBe(true)
        expect(Equal.equals(obj1, obj3)).toBe(false)
      })
    })

    describe("zero values", () => {
      it("should handle -0 and +0 correctly", () => {
        expect(Equal.equals(-0, +0)).toBe(true)
        expect(Equal.equals(0, -0)).toBe(true)
        expect(Equal.equals(+0, -0)).toBe(true)
      })

      it("should handle zero values in arrays", () => {
        expect(Equal.equals([-0], [+0])).toBe(true)
        expect(Equal.equals([0], [-0])).toBe(true)
        expect(Equal.equals([-0, 1], [+0, 1])).toBe(true)
      })

      it("should handle zero values in objects", () => {
        expect(Equal.equals({ a: -0 }, { a: +0 })).toBe(true)
        expect(Equal.equals({ a: 0 }, { a: -0 })).toBe(true)
      })
    })
  })

  describe("useInstanceEquality", () => {
    it("should allow objects to opt out of structural equality", () => {
      const obj1 = { a: 1, b: 2 }
      const obj2 = { a: 1, b: 2 }

      // Normal structural equality
      expect(Equal.equals(obj1, obj2)).toBe(true)

      // Mark obj1 for instance equality
      Equal.useInstanceEquality(obj1)
      expect(Equal.equals(obj1, obj2)).toBe(false)
      expect(Equal.equals(obj1, obj1)).toBe(true)
    })

    it("should work with arrays", () => {
      const arr1 = [1, 2, 3]
      const arr2 = [1, 2, 3]

      // Normal structural equality
      expect(Equal.equals(arr1, arr2)).toBe(true)

      // Mark arr1 for instance equality
      Equal.useInstanceEquality(arr1)
      expect(Equal.equals(arr1, arr2)).toBe(false)
      expect(Equal.equals(arr1, arr1)).toBe(true)
    })

    it("should return the same object for chaining", () => {
      const obj = { a: 1 }
      const result = Equal.useInstanceEquality(obj)
      expect(result).toBe(obj)
    })

    it("should work when either object is marked for instance equality", () => {
      const obj1 = { a: 1, b: 2 }
      const obj2 = { a: 1, b: 2 }

      // Mark obj2 for instance equality
      Equal.useInstanceEquality(obj2)
      expect(Equal.equals(obj1, obj2)).toBe(false)
      expect(Equal.equals(obj2, obj1)).toBe(false)
    })

    it("should work with nested structures", () => {
      const obj1 = { a: { b: 1 }, c: [1, 2] }
      const obj2 = { a: { b: 1 }, c: [1, 2] }

      // Normal structural equality
      expect(Equal.equals(obj1, obj2)).toBe(true)

      // Mark obj1 for instance equality
      Equal.useInstanceEquality(obj1)
      expect(Equal.equals(obj1, obj2)).toBe(false)
    })
  })
})
