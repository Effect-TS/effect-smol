import { addKeyToObject, appendToArray, parseValue, removeAtPath, setAtPath } from "@effect/atom-devtools/ValueUtils"
import { describe, expect, it } from "vitest"

describe("ValueUtils", () => {
  describe("setAtPath", () => {
    it("sets root value with empty path", () => {
      expect(setAtPath(42, [], 99)).toBe(99)
    })

    it("sets nested object value", () => {
      expect(setAtPath({ a: { b: 1 } }, ["a", "b"], 2)).toEqual({ a: { b: 2 } })
    })

    it("sets nested array value", () => {
      expect(setAtPath([10, 20, 30], ["1"], 99)).toEqual([10, 99, 30])
    })

    it("sets deeply nested mixed value", () => {
      const root = { items: [{ name: "a" }, { name: "b" }] }
      expect(setAtPath(root, ["items", "1", "name"], "c")).toEqual({
        items: [{ name: "a" }, { name: "c" }]
      })
    })
  })

  describe("removeAtPath", () => {
    it("removes object key", () => {
      expect(removeAtPath({ a: 1, b: 2 }, ["a"])).toEqual({ b: 2 })
    })

    it("removes array element", () => {
      expect(removeAtPath([10, 20, 30], ["1"])).toEqual([10, 30])
    })

    it("removes nested key", () => {
      expect(removeAtPath({ x: { a: 1, b: 2 } }, ["x", "a"])).toEqual({ x: { b: 2 } })
    })

    it("returns root unchanged for empty path", () => {
      const obj = { a: 1 }
      expect(removeAtPath(obj, [])).toBe(obj)
    })
  })

  describe("appendToArray", () => {
    it("appends to root array", () => {
      expect(appendToArray([1, 2], [], 3)).toEqual([1, 2, 3])
    })

    it("appends to nested array", () => {
      expect(appendToArray({ items: [1] }, ["items"], 2)).toEqual({ items: [1, 2] })
    })

    it("returns root unchanged if target is not array", () => {
      expect(appendToArray({ a: 1 }, [], 2)).toEqual({ a: 1 })
    })
  })

  describe("addKeyToObject", () => {
    it("adds key to root object", () => {
      expect(addKeyToObject({ a: 1 }, [], "b", 2)).toEqual({ a: 1, b: 2 })
    })

    it("adds key to nested object", () => {
      expect(addKeyToObject({ x: { a: 1 } }, ["x"], "b", 2)).toEqual({ x: { a: 1, b: 2 } })
    })
  })

  describe("parseValue", () => {
    it("parses null", () => {
      expect(parseValue("null", "anything")).toBe(null)
    })

    it("parses undefined", () => {
      expect(parseValue("undefined", "anything")).toBe(undefined)
    })

    it("parses true", () => {
      expect(parseValue("true", false)).toBe(true)
    })

    it("parses false", () => {
      expect(parseValue("false", true)).toBe(false)
    })

    it("parses number when current is number", () => {
      expect(parseValue("42", 0)).toBe(42)
    })

    it("parses float when current is number", () => {
      expect(parseValue("3.14", 0)).toBe(3.14)
    })

    it("falls back to string for non-numeric input with number current", () => {
      expect(parseValue("abc", 0)).toBe("abc")
    })

    it("parses JSON array", () => {
      expect(parseValue("[1,2]", undefined)).toEqual([1, 2])
    })

    it("returns raw string as fallback", () => {
      expect(parseValue("hello", "world")).toBe("hello")
    })
  })
})
