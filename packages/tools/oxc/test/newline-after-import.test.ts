import rule from "@effect/oxc/oxlint/rules/newline-after-import"
import { describe, expect, it } from "vitest"
import { runRule } from "./test-utils.ts"

describe("newline-after-import", () => {
  it("should report when no newline after imports", () => {
    const node = {
      type: "Program",
      body: [
        { type: "ImportDeclaration", loc: { start: { line: 1 }, end: { line: 1 } } },
        { type: "ImportDeclaration", loc: { start: { line: 2 }, end: { line: 2 } } },
        { type: "ExpressionStatement", loc: { start: { line: 3 }, end: { line: 3 } } }
      ]
    }
    const errors = runRule(rule, "Program", node)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe("Expected newline after import statements")
  })

  it("should not report when newline exists after imports", () => {
    const node = {
      type: "Program",
      body: [
        { type: "ImportDeclaration", loc: { start: { line: 1 }, end: { line: 1 } } },
        { type: "ImportDeclaration", loc: { start: { line: 2 }, end: { line: 2 } } },
        { type: "ExpressionStatement", loc: { start: { line: 4 }, end: { line: 4 } } }
      ]
    }
    const errors = runRule(rule, "Program", node)
    expect(errors).toHaveLength(0)
  })

  it("should not report when no imports", () => {
    const node = {
      type: "Program",
      body: [
        { type: "ExpressionStatement", loc: { start: { line: 1 }, end: { line: 1 } } }
      ]
    }
    const errors = runRule(rule, "Program", node)
    expect(errors).toHaveLength(0)
  })

  it("should not report when imports are at end of file", () => {
    const node = {
      type: "Program",
      body: [
        { type: "ImportDeclaration", loc: { start: { line: 1 }, end: { line: 1 } } }
      ]
    }
    const errors = runRule(rule, "Program", node)
    expect(errors).toHaveLength(0)
  })

  it("should not report when empty program", () => {
    const node = {
      type: "Program",
      body: []
    }
    const errors = runRule(rule, "Program", node)
    expect(errors).toHaveLength(0)
  })

  it("should check last import, not first", () => {
    const node = {
      type: "Program",
      body: [
        { type: "ImportDeclaration", loc: { start: { line: 1 }, end: { line: 1 } } },
        { type: "ImportDeclaration", loc: { start: { line: 5 }, end: { line: 5 } } },
        { type: "ExpressionStatement", loc: { start: { line: 6 }, end: { line: 6 } } }
      ]
    }
    const errors = runRule(rule, "Program", node)
    expect(errors).toHaveLength(1)
  })
})
