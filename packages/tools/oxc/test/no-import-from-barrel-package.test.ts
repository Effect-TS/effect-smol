import rule from "@effect/oxc/oxlint/rules/no-import-from-barrel-package"
import { describe, expect, it } from "vitest"
import { runRule } from "./utils.ts"

describe("no-import-from-barrel-package", () => {
  const createImportDeclaration = (
    source: string,
    specifiers: Array<{
      type: string
      importKind?: "type" | "value"
      imported: { type: string; name?: string; value?: string }
      local: { name: string }
    }>,
    importKind?: "type" | "value"
  ) => ({
    type: "ImportDeclaration",
    importKind,
    source: { value: source },
    specifiers,
    range: [0, 50] as [number, number]
  })

  const createNamedSpecifier = (
    name: string,
    local?: string,
    importKind?: "type" | "value"
  ) => ({
    type: "ImportSpecifier",
    importKind,
    imported: { type: "Identifier", name },
    local: { name: local ?? name }
  })

  it("should not report for imports from non-barrel packages", () => {
    const node = createImportDeclaration("effect/Effect", [
      createNamedSpecifier("Effect")
    ])
    const errors = runRule(rule, "ImportDeclaration", node)
    expect(errors).toHaveLength(0)
  })

  it("should report for named imports from effect barrel", () => {
    const node = createImportDeclaration("effect", [
      createNamedSpecifier("Effect")
    ])
    const errors = runRule(rule, "ImportDeclaration", node)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe(
      `Use import * as Effect from "effect/Effect" instead`
    )
  })

  it("should report for multiple named imports from effect barrel", () => {
    const node = createImportDeclaration("effect", [
      createNamedSpecifier("Effect"),
      createNamedSpecifier("Option"),
      createNamedSpecifier("Either")
    ])
    const errors = runRule(rule, "ImportDeclaration", node)
    expect(errors).toHaveLength(3)
  })

  it("should not report for type-only import declarations", () => {
    const node = createImportDeclaration(
      "effect",
      [createNamedSpecifier("Effect")],
      "type"
    )
    const errors = runRule(rule, "ImportDeclaration", node)
    expect(errors).toHaveLength(0)
  })

  it("should not report for type imports within named specifiers", () => {
    const node = createImportDeclaration("effect", [
      createNamedSpecifier("Effect", "Effect", "type")
    ])
    const errors = runRule(rule, "ImportDeclaration", node)
    expect(errors).toHaveLength(0)
  })

  it("should handle aliased imports", () => {
    const node = createImportDeclaration("effect", [
      createNamedSpecifier("Effect", "Eff")
    ])
    const errors = runRule(rule, "ImportDeclaration", node)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe(
      `Use import * as Eff from "effect/Effect" instead`
    )
  })

  it("should not report for namespace imports", () => {
    const node = createImportDeclaration("effect", [
      {
        type: "ImportNamespaceSpecifier",
        local: { name: "Effect" }
      }
    ])
    const errors = runRule(rule, "ImportDeclaration", node)
    expect(errors).toHaveLength(0)
  })

  it("should not report for default imports", () => {
    const node = createImportDeclaration("effect", [
      {
        type: "ImportDefaultSpecifier",
        local: { name: "Effect" }
      }
    ])
    const errors = runRule(rule, "ImportDeclaration", node)
    expect(errors).toHaveLength(0)
  })
})
