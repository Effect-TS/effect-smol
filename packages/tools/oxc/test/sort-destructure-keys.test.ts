import { describe, expect, it } from "vitest"
import rule from "../src/oxlint/rules/sort-destructure-keys.ts"
import { runRule } from "./test-utils.ts"

describe("sort-destructure-keys", () => {
  const createObjectPattern = (keys: Array<string>) => ({
    type: "ObjectPattern",
    properties: keys.map((name) => ({
      type: "Property",
      key: { type: "Identifier", name }
    }))
  })

  it("should not report when keys are sorted", () => {
    const node = createObjectPattern(["a", "b", "c"])
    const errors = runRule(rule, "ObjectPattern", node)
    expect(errors).toHaveLength(0)
  })

  it("should report when keys are not sorted", () => {
    const node = createObjectPattern(["c", "a", "b"])
    const errors = runRule(rule, "ObjectPattern", node)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe("Destructure keys should be sorted alphabetically")
  })

  it("should handle case-sensitive sorting (uppercase before lowercase)", () => {
    const node = createObjectPattern(["Class", "Field", "extract"])
    const errors = runRule(rule, "ObjectPattern", node)
    expect(errors).toHaveLength(0)
  })

  it("should report when lowercase comes before uppercase", () => {
    const node = createObjectPattern(["extract", "Class", "Field"])
    const errors = runRule(rule, "ObjectPattern", node)
    expect(errors).toHaveLength(1)
  })

  it("should handle empty object pattern", () => {
    const node = createObjectPattern([])
    const errors = runRule(rule, "ObjectPattern", node)
    expect(errors).toHaveLength(0)
  })

  it("should handle single key", () => {
    const node = createObjectPattern(["foo"])
    const errors = runRule(rule, "ObjectPattern", node)
    expect(errors).toHaveLength(0)
  })

  it("should ignore non-Identifier keys", () => {
    const node = {
      type: "ObjectPattern",
      properties: [
        { type: "Property", key: { type: "Identifier", name: "b" } },
        { type: "Property", key: { type: "Literal", value: "a" } },
        { type: "Property", key: { type: "Identifier", name: "c" } }
      ]
    }
    const errors = runRule(rule, "ObjectPattern", node)
    expect(errors).toHaveLength(0)
  })

  it("should ignore RestElement properties", () => {
    const node = {
      type: "ObjectPattern",
      properties: [
        { type: "Property", key: { type: "Identifier", name: "a" } },
        { type: "RestElement" },
        { type: "Property", key: { type: "Identifier", name: "b" } }
      ]
    }
    const errors = runRule(rule, "ObjectPattern", node)
    expect(errors).toHaveLength(0)
  })
})
