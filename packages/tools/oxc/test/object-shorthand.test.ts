import { describe, expect, it } from "vitest"
import rule from "../src/oxlint/rules/object-shorthand.ts"
import { runRule } from "./test-utils.ts"

describe("object-shorthand", () => {
  const createProperty = (options: {
    keyName: string
    valueName: string
    shorthand?: boolean
    method?: boolean
    computed?: boolean
  }) => ({
    type: "Property",
    shorthand: options.shorthand ?? false,
    method: options.method ?? false,
    computed: options.computed ?? false,
    key: { type: "Identifier", name: options.keyName },
    value: { type: "Identifier", name: options.valueName }
  })

  it("should report when key and value have the same name", () => {
    const node = createProperty({ keyName: "foo", valueName: "foo" })
    const errors = runRule(rule, "Property", node)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe("Expected property shorthand")
  })

  it("should not report when key and value have different names", () => {
    const node = createProperty({ keyName: "foo", valueName: "bar" })
    const errors = runRule(rule, "Property", node)
    expect(errors).toHaveLength(0)
  })

  it("should not report when already shorthand", () => {
    const node = createProperty({ keyName: "foo", valueName: "foo", shorthand: true })
    const errors = runRule(rule, "Property", node)
    expect(errors).toHaveLength(0)
  })

  it("should not report for methods", () => {
    const node = createProperty({ keyName: "foo", valueName: "foo", method: true })
    const errors = runRule(rule, "Property", node)
    expect(errors).toHaveLength(0)
  })

  it("should not report for computed properties", () => {
    const node = createProperty({ keyName: "foo", valueName: "foo", computed: true })
    const errors = runRule(rule, "Property", node)
    expect(errors).toHaveLength(0)
  })

  it("should not report when key is not an Identifier", () => {
    const node = {
      type: "Property",
      shorthand: false,
      method: false,
      computed: false,
      key: { type: "Literal", value: "foo" },
      value: { type: "Identifier", name: "foo" }
    }
    const errors = runRule(rule, "Property", node)
    expect(errors).toHaveLength(0)
  })

  it("should not report when value is not an Identifier", () => {
    const node = {
      type: "Property",
      shorthand: false,
      method: false,
      computed: false,
      key: { type: "Identifier", name: "foo" },
      value: { type: "Literal", value: 123 }
    }
    const errors = runRule(rule, "Property", node)
    expect(errors).toHaveLength(0)
  })
})
