import rule from "@effect/oxc/oxlint/rules/no-at-prefix-in-tag-string"
import { describe, expect, it } from "vitest"
import { createTestContext } from "./utils.ts"

interface FixDescriptor {
  range: [number, number]
  text: string
}

interface CapturedReport {
  message: string
  fix: FixDescriptor | undefined
}

function runRuleOnCall(node: unknown): Array<CapturedReport> {
  const { context } = createTestContext()
  const captured: Array<CapturedReport> = []

  const reportingContext = {
    ...context,
    report(
      opts: { node: unknown; message: string; fix?: ((fixer: unknown) => FixDescriptor) | undefined }
    ) {
      const fixer = {
        replaceTextRange(range: [number, number], text: string): FixDescriptor {
          return { range, text }
        }
      }
      const fix = opts.fix ? opts.fix(fixer) : undefined
      captured.push({ message: opts.message, fix })
    }
  }

  const visitors = rule.create(reportingContext as never)
  const handler = visitors.CallExpression
  if (handler) {
    ;(handler as (node: unknown) => void)(node)
  }
  return captured
}

// AST shape helpers
const ident = (name: string) => ({ type: "Identifier", name })

const memberCallee = (object: string, property: string) => ({
  type: "MemberExpression",
  object: ident(object),
  property: ident(property),
  computed: false
})

const stringLit = (value: string, range: [number, number] = [0, value.length + 2]) => ({
  type: "Literal",
  value,
  raw: `"${value}"`,
  range
})

const singleQuoteStringLit = (value: string, range: [number, number] = [0, value.length + 2]) => ({
  type: "Literal",
  value,
  raw: `'${value}'`,
  range
})

// Direct call form: Context.Service("@effect/foo")
const directCall = (object: string, property: string, arg: unknown) => ({
  type: "CallExpression",
  callee: memberCallee(object, property),
  arguments: [arg]
})

// Class-extends form outer call: Context.Service<...>()("@effect/foo")
// Outer CallExpression's callee is the inner CallExpression
const classExtendsCall = (object: string, property: string, arg: unknown) => ({
  type: "CallExpression",
  callee: {
    type: "CallExpression",
    callee: memberCallee(object, property),
    arguments: []
  },
  arguments: [arg]
})

describe("no-at-prefix-in-tag-string", () => {
  describe("direct call form", () => {
    it("flags Context.Service(\"@effect/foo\")", () => {
      const node = directCall("Context", "Service", stringLit("@effect/foo"))
      const reports = runRuleOnCall(node)
      expect(reports).toHaveLength(1)
      expect(reports[0].fix?.text).toBe("\"effect/foo\"")
    })

    it("flags Context.Tag(\"@effect/bar\")", () => {
      const node = directCall("Context", "Tag", stringLit("@effect/bar"))
      const reports = runRuleOnCall(node)
      expect(reports).toHaveLength(1)
      expect(reports[0].fix?.text).toBe("\"effect/bar\"")
    })

    it("flags Context.Key(\"@effect/baz\")", () => {
      const node = directCall("Context", "Key", stringLit("@effect/baz"))
      const reports = runRuleOnCall(node)
      expect(reports).toHaveLength(1)
    })

    it("flags Context.GenericTag(\"@effect/qux\")", () => {
      const node = directCall("Context", "GenericTag", stringLit("@effect/qux"))
      const reports = runRuleOnCall(node)
      expect(reports).toHaveLength(1)
    })

    it("flags ServiceMap.Service(\"@effect/foo\")", () => {
      const node = directCall("ServiceMap", "Service", stringLit("@effect/foo"))
      const reports = runRuleOnCall(node)
      expect(reports).toHaveLength(1)
      expect(reports[0].fix?.text).toBe("\"effect/foo\"")
    })

    it("flags ServiceMap.Key(\"@effect/foo\")", () => {
      const node = directCall("ServiceMap", "Key", stringLit("@effect/foo"))
      const reports = runRuleOnCall(node)
      expect(reports).toHaveLength(1)
    })

    it("preserves single-quote style in fix", () => {
      const node = directCall("Context", "Service", singleQuoteStringLit("@effect/foo"))
      const reports = runRuleOnCall(node)
      expect(reports).toHaveLength(1)
      expect(reports[0].fix?.text).toBe("'effect/foo'")
    })
  })

  describe("class-extends form", () => {
    it("flags Context.Service<...>()(\"@effect/foo\")", () => {
      const node = classExtendsCall("Context", "Service", stringLit("@effect/foo"))
      const reports = runRuleOnCall(node)
      expect(reports).toHaveLength(1)
      expect(reports[0].fix?.text).toBe("\"effect/foo\"")
    })

    it("flags Context.Tag<...>()(\"@effect/foo\")", () => {
      const node = classExtendsCall("Context", "Tag", stringLit("@effect/foo"))
      const reports = runRuleOnCall(node)
      expect(reports).toHaveLength(1)
    })

    it("flags ServiceMap.Service<...>()(\"@effect/foo\")", () => {
      const node = classExtendsCall("ServiceMap", "Service", stringLit("@effect/foo"))
      const reports = runRuleOnCall(node)
      expect(reports).toHaveLength(1)
    })
  })

  describe("non-violations", () => {
    it("does not flag canonical Context.Service(\"effect/foo\")", () => {
      const node = directCall("Context", "Service", stringLit("effect/foo"))
      const reports = runRuleOnCall(node)
      expect(reports).toHaveLength(0)
    })

    it("does not flag unrelated apis: someOtherApi(\"@effect/whatever\")", () => {
      const node = {
        type: "CallExpression",
        callee: ident("someOtherApi"),
        arguments: [stringLit("@effect/whatever")]
      }
      const reports = runRuleOnCall(node)
      expect(reports).toHaveLength(0)
    })

    it("does not flag Schema.Class(\"@effect/foo\")", () => {
      const node = directCall("Schema", "Class", stringLit("@effect/foo"))
      const reports = runRuleOnCall(node)
      expect(reports).toHaveLength(0)
    })

    it("does not flag Context.Service called with non-string first arg", () => {
      const node = directCall("Context", "Service", { type: "Identifier", name: "name" })
      const reports = runRuleOnCall(node)
      expect(reports).toHaveLength(0)
    })

    it("does not flag empty Context.Service<...>()()", () => {
      const node = {
        type: "CallExpression",
        callee: {
          type: "CallExpression",
          callee: memberCallee("Context", "Service"),
          arguments: []
        },
        arguments: []
      }
      const reports = runRuleOnCall(node)
      expect(reports).toHaveLength(0)
    })

    it("does not flag Context.Service called via computed property", () => {
      const node = {
        type: "CallExpression",
        callee: {
          type: "MemberExpression",
          object: ident("Context"),
          property: { type: "Literal", value: "Service", raw: "\"Service\"" },
          computed: true
        },
        arguments: [stringLit("@effect/foo")]
      }
      const reports = runRuleOnCall(node)
      expect(reports).toHaveLength(0)
    })

    it("does not flag Context.SomethingElse(\"@effect/foo\")", () => {
      const node = directCall("Context", "SomethingElse", stringLit("@effect/foo"))
      const reports = runRuleOnCall(node)
      expect(reports).toHaveLength(0)
    })
  })
})
