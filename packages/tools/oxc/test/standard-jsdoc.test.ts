import rule from "@effect/oxc/oxlint/rules/standard-jsdoc"
import { describe, expect, it } from "vitest"
import { createTestContext } from "./utils.ts"

interface TestNode {
  readonly type: string
  readonly range: [number, number]
  readonly [key: string]: any
}

function rangeOf(source: string, search: string): [number, number] {
  const start = source.indexOf(search)
  if (start === -1) {
    throw new Error(`Unable to find ${search}`)
  }
  return [start, start + search.length]
}

function node(source: string, search: string, type: string, extra: Record<string, unknown> = {}): TestNode {
  return {
    type,
    range: rangeOf(source, search),
    ...extra
  }
}

function exportNamed(source: string, search: string, declaration: TestNode): TestNode {
  return node(source, search, "ExportNamedDeclaration", {
    declaration,
    source: null,
    specifiers: []
  })
}

function importDeclaration(source: string, search = "import"): TestNode {
  return node(source, search, "ImportDeclaration")
}

function runRuleWithSource(
  source: string,
  entries: Array<{ readonly visitor: string; readonly node: TestNode }>,
  programBody?: Array<TestNode>,
  ruleOptions: Array<unknown> = []
) {
  const { context, errors } = createTestContext({
    sourceCode: source,
    filename: "/repo/packages/sample/src/Foo.ts",
    cwd: "/repo",
    ruleOptions
  })
  const visitors = rule.create(context as never)
  const program = programBody
    ? ({
      type: "Program",
      range: [0, source.length],
      body: programBody
    } as TestNode)
    : undefined

  if (program && visitors.Program) {
    visitors.Program(program as never)
  }
  for (const { visitor, node } of entries) {
    const handler = visitors[visitor as keyof typeof visitors]
    if (handler) {
      ;(handler as (node: unknown) => void)(node)
    }
  }
  if (program && visitors["Program:exit"]) {
    visitors["Program:exit"](program as never)
  }

  return errors
}

describe("standard-jsdoc", () => {
  it("accepts a documented public value and module", () => {
    const source = `/**
 * Module docs.
 *
 * @since 1.0.0
 */
import * as Effect from "effect/Effect"

/**
 * A value.
 *
 * @category constructors
 * @since 1.0.0
 */
export const value = 1
`
    const declaration = node(source, "export const value", "VariableDeclaration", { declarations: [] })
    const exportNode = exportNamed(source, "export const value", declaration)
    const errors = runRuleWithSource(
      source,
      [{ visitor: "ExportNamedDeclaration", node: exportNode }],
      [importDeclaration(source), exportNode]
    )

    expect(errors).toHaveLength(0)
  })

  it("reports only missing JSDoc when an exported declaration has no block", () => {
    const source = `export const value = 1`
    const declaration = node(source, "export const value", "VariableDeclaration", { declarations: [] })
    const exportNode = exportNamed(source, "export const value", declaration)
    const errors = runRuleWithSource(source, [{ visitor: "ExportNamedDeclaration", node: exportNode }])

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe("Public JSDoc is required")
  })

  it("forbids examples on exported types", () => {
    const source = `/**
 * An option type.
 *
 * **Example** (Usage)
 *
 * \`\`\`ts
 * type A = Options
 * \`\`\`
 *
 * @category models
 * @since 1.0.0
 */
export interface Options {}
`
    const declaration = node(source, "export interface Options", "TSInterfaceDeclaration", {
      body: { body: [] }
    })
    const exportNode = exportNamed(source, "export interface Options", declaration)
    const errors = runRuleWithSource(source, [{ visitor: "ExportNamedDeclaration", node: exportNode }])

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe("Examples are not allowed in this JSDoc block")
  })

  it("rejects @example tags", () => {
    const source = `/**
 * A value.
 *
 * @example
 * value
 * @category constructors
 * @since 1.0.0
 */
export const value = 1
`
    const declaration = node(source, "export const value", "VariableDeclaration", { declarations: [] })
    const exportNode = exportNamed(source, "export const value", declaration)
    const errors = runRuleWithSource(source, [{ visitor: "ExportNamedDeclaration", node: exportNode }])

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe("@example is not allowed; use a canonical **Example** (Title) section")
  })

  it("rejects loose TypeScript fences on values", () => {
    const source = `/**
 * A value.
 *
 * \`\`\`ts
 * const value = 1
 * \`\`\`
 *
 * @category constructors
 * @since 1.0.0
 */
export const value = 1
`
    const declaration = node(source, "export const value", "VariableDeclaration", { declarations: [] })
    const exportNode = exportNamed(source, "export const value", declaration)
    const errors = runRuleWithSource(source, [{ visitor: "ExportNamedDeclaration", node: exportNode }])

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe(
      "TypeScript examples must use **Example** (Title), a blank line, and a non-empty ```ts fence"
    )
  })

  it("lets @internal declarations opt out but rejects additional tags", () => {
    const source = `/**
 * Private.
 *
 * @internal
 * @since 1.0.0
 */
export interface Secret {
  readonly missing: string
}
`
    const missing = node(source, "readonly missing", "TSPropertySignature")
    const declaration = node(source, "export interface Secret", "TSInterfaceDeclaration", {
      body: { body: [missing] }
    })
    const exportNode = exportNamed(source, "export interface Secret", declaration)
    const errors = runRuleWithSource(source, [{ visitor: "ExportNamedDeclaration", node: exportNode }])

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe("JSDoc blocks with @internal must not contain other block tags")
  })

  it("requires member descriptions recursively in exported object types", () => {
    const source = `/**
 * Options.
 *
 * @category models
 * @since 1.0.0
 */
export interface Options {
  /**
   * Outer options.
   */
  readonly outer: {
    readonly inner: string
  }
}
`
    const inner = node(source, "readonly inner", "TSPropertySignature")
    const outer = node(source, "readonly outer", "TSPropertySignature", {
      typeAnnotation: {
        type: "TSTypeAnnotation",
        typeAnnotation: {
          type: "TSTypeLiteral",
          members: [inner]
        }
      }
    })
    const declaration = node(source, "export interface Options", "TSInterfaceDeclaration", {
      body: { body: [outer] }
    })
    const exportNode = exportNamed(source, "export interface Options", declaration)
    const errors = runRuleWithSource(source, [{ visitor: "ExportNamedDeclaration", node: exportNode }])

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe("Member JSDoc is required")
  })

  it("requires public class member docs but ignores constructors and private members", () => {
    const source = `/**
 * A service.
 *
 * @category services
 * @since 1.0.0
 */
export class Service {
  constructor() {}
  private secret() {}
  run() {}
}
`
    const constructor = node(source, "constructor", "MethodDefinition", { kind: "constructor" })
    const secret = node(source, "private secret", "MethodDefinition", {
      kind: "method",
      accessibility: "private"
    })
    const run = node(source, "run", "MethodDefinition", { kind: "method" })
    const declaration = node(source, "export class Service", "ClassDeclaration", {
      body: { body: [constructor, secret, run] }
    })
    const exportNode = exportNamed(source, "export class Service", declaration)
    const errors = runRuleWithSource(source, [{ visitor: "ExportNamedDeclaration", node: exportNode }])

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe("Member JSDoc is required")
  })

  it("requires module JSDoc only when the file has public exports", () => {
    const source = `import * as Effect from "effect/Effect"

/**
 * A value.
 *
 * @category constructors
 * @since 1.0.0
 */
export const value = 1
`
    const declaration = node(source, "export const value", "VariableDeclaration", { declarations: [] })
    const exportNode = exportNamed(source, "export const value", declaration)
    const errors = runRuleWithSource(
      source,
      [{ visitor: "ExportNamedDeclaration", node: exportNode }],
      [importDeclaration(source), exportNode]
    )

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe("Module JSDoc is required")
  })

  it("ignores re-export-only files", () => {
    const source = `export { Foo } from "./Foo"`
    const exportNode = node(source, "export { Foo }", "ExportNamedDeclaration", {
      declaration: null,
      source: { value: "./Foo" },
      specifiers: []
    })
    const errors = runRuleWithSource(
      source,
      [{ visitor: "ExportNamedDeclaration", node: exportNode }],
      [exportNode]
    )

    expect(errors).toHaveLength(0)
  })

  it("checks only the first exported overload in a function overload group", () => {
    const source = `/**
 * Decode input.
 *
 * @category decoding
 * @since 1.0.0
 */
export function decode(input: string): string
export function decode(input: unknown): string
export function decode(input: unknown): string {
  return String(input)
}
`
    const firstDeclaration = node(source, "export function decode(input: string)", "FunctionDeclaration", {
      id: { name: "decode" },
      body: null,
      params: []
    })
    const firstExport = exportNamed(source, "export function decode(input: string)", firstDeclaration)
    const secondDeclaration = node(source, "export function decode(input: unknown): string", "FunctionDeclaration", {
      id: { name: "decode" },
      body: null,
      params: []
    })
    const secondExport = exportNamed(source, "export function decode(input: unknown): string", secondDeclaration)
    const implementationDeclaration = node(
      source,
      "export function decode(input: unknown): string {",
      "FunctionDeclaration",
      {
        id: { name: "decode" },
        body: {},
        params: []
      }
    )
    const implementationExport = exportNamed(
      source,
      "export function decode(input: unknown): string {",
      implementationDeclaration
    )
    const errors = runRuleWithSource(source, [
      { visitor: "ExportNamedDeclaration", node: firstExport },
      { visitor: "ExportNamedDeclaration", node: secondExport },
      { visitor: "ExportNamedDeclaration", node: implementationExport }
    ])

    expect(errors).toHaveLength(0)
  })

  it("skips files outside the configured include globs", () => {
    const source = `export const value = 1`
    const declaration = node(source, "export const value", "VariableDeclaration", { declarations: [] })
    const exportNode = exportNamed(source, "export const value", declaration)
    const errors = runRuleWithSource(
      source,
      [{ visitor: "ExportNamedDeclaration", node: exportNode }],
      undefined,
      [{ include: [] }]
    )

    expect(errors).toHaveLength(0)
  })
})
