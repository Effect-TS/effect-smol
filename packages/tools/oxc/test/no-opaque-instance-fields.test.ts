import rule from "@effect/oxc/oxlint/rules/no-opaque-instance-fields"
import { describe, expect, it } from "vitest"
import { runRule } from "./utils.ts"

describe("no-opaque-instance-fields", () => {
  const createSchemaOpaqueClass = (members: Array<{ type: string; static: boolean }>) => ({
    type: "ClassDeclaration",
    superClass: {
      type: "CallExpression",
      callee: {
        type: "CallExpression",
        callee: {
          type: "MemberExpression",
          object: { type: "Identifier", name: "Schema" },
          property: { type: "Identifier", name: "Opaque" }
        }
      }
    },
    body: {
      body: members
    }
  })

  const createRegularClass = (members: Array<{ type: string; static: boolean }>) => ({
    type: "ClassDeclaration",
    superClass: {
      type: "Identifier",
      name: "SomeClass"
    },
    body: {
      body: members
    }
  })

  it("should not report for class without instance fields", () => {
    const node = createSchemaOpaqueClass([])
    const errors = runRule(rule, "ClassDeclaration", node)
    expect(errors).toHaveLength(0)
  })

  it("should not report for static fields in Schema.Opaque class", () => {
    const node = createSchemaOpaqueClass([
      { type: "PropertyDefinition", static: true }
    ])
    const errors = runRule(rule, "ClassDeclaration", node)
    expect(errors).toHaveLength(0)
  })

  it("should report for instance fields in Schema.Opaque class", () => {
    const node = createSchemaOpaqueClass([
      { type: "PropertyDefinition", static: false }
    ])
    const errors = runRule(rule, "ClassDeclaration", node)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe("Classes extending Schema.Opaque must not have instance fields")
  })

  it("should report for multiple instance fields", () => {
    const node = createSchemaOpaqueClass([
      { type: "PropertyDefinition", static: false },
      { type: "PropertyDefinition", static: true },
      { type: "PropertyDefinition", static: false }
    ])
    const errors = runRule(rule, "ClassDeclaration", node)
    expect(errors).toHaveLength(2)
  })

  it("should not report for methods", () => {
    const node = createSchemaOpaqueClass([
      { type: "MethodDefinition", static: false }
    ])
    const errors = runRule(rule, "ClassDeclaration", node)
    expect(errors).toHaveLength(0)
  })

  it("should not report for non-Schema.Opaque classes", () => {
    const node = createRegularClass([
      { type: "PropertyDefinition", static: false }
    ])
    const errors = runRule(rule, "ClassDeclaration", node)
    expect(errors).toHaveLength(0)
  })

  it("should work with ClassExpression", () => {
    const node = {
      ...createSchemaOpaqueClass([
        { type: "PropertyDefinition", static: false }
      ]),
      type: "ClassExpression"
    }
    const errors = runRule(rule, "ClassExpression", node)
    expect(errors).toHaveLength(1)
  })

  it("should not report for class without superClass", () => {
    const node = {
      type: "ClassDeclaration",
      body: {
        body: [{ type: "PropertyDefinition", static: false }]
      }
    }
    const errors = runRule(rule, "ClassDeclaration", node)
    expect(errors).toHaveLength(0)
  })

  it("should not report for class with non-CallExpression superClass", () => {
    const node = {
      type: "ClassDeclaration",
      superClass: {
        type: "Identifier",
        name: "BaseClass"
      },
      body: {
        body: [{ type: "PropertyDefinition", static: false }]
      }
    }
    const errors = runRule(rule, "ClassDeclaration", node)
    expect(errors).toHaveLength(0)
  })
})
