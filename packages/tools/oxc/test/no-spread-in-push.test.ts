import { describe, expect, it } from "vitest"
import rule from "../src/oxlint/rules/no-spread-in-push.js"
import { runRule } from "./test-utils.js"

describe("no-spread-in-push", () => {
  const createPushCall = (args: Array<{ type: string }>) => ({
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: { type: "Identifier", name: "arr" },
      property: { name: "push" }
    },
    arguments: args
  })

  const createOtherMethodCall = (methodName: string, args: Array<{ type: string }>) => ({
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: { type: "Identifier", name: "arr" },
      property: { name: methodName }
    },
    arguments: args
  })

  it("should not report for push without spread", () => {
    const node = createPushCall([
      { type: "Identifier" },
      { type: "Literal" }
    ])
    const errors = runRule(rule, "CallExpression", node)
    expect(errors).toHaveLength(0)
  })

  it("should report for push with spread argument", () => {
    const node = createPushCall([
      { type: "SpreadElement" }
    ])
    const errors = runRule(rule, "CallExpression", node)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe("Do not use spread arguments in Array.push")
  })

  it("should report for each spread argument", () => {
    const node = createPushCall([
      { type: "SpreadElement" },
      { type: "Identifier" },
      { type: "SpreadElement" }
    ])
    const errors = runRule(rule, "CallExpression", node)
    expect(errors).toHaveLength(2)
  })

  it("should not report for other methods with spread", () => {
    const node = createOtherMethodCall("concat", [
      { type: "SpreadElement" }
    ])
    const errors = runRule(rule, "CallExpression", node)
    expect(errors).toHaveLength(0)
  })

  it("should not report for non-MemberExpression callee", () => {
    const node = {
      type: "CallExpression",
      callee: {
        type: "Identifier",
        name: "push"
      },
      arguments: [{ type: "SpreadElement" }]
    }
    const errors = runRule(rule, "CallExpression", node)
    expect(errors).toHaveLength(0)
  })

  it("should handle empty arguments", () => {
    const node = createPushCall([])
    const errors = runRule(rule, "CallExpression", node)
    expect(errors).toHaveLength(0)
  })

  it("should handle mixed arguments with spread at end", () => {
    const node = createPushCall([
      { type: "Literal" },
      { type: "Literal" },
      { type: "SpreadElement" }
    ])
    const errors = runRule(rule, "CallExpression", node)
    expect(errors).toHaveLength(1)
  })
})
