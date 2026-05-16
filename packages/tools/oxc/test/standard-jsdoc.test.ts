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

const categoryOnlyOptions = [{
  checks: {
    description: false,
    tags: false,
    category: true,
    since: false,
    examples: false
  }
}]

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

  it("can run only category checks", () => {
    const source = `/**
 * @since invalid
 */
import * as Effect from "effect/Effect"

/**
 * **Example** (Usage)
 *
 * \`\`\`ts
 * const value = 1
 * \`\`\`
 *
 * @foo
 * @category constructors
 * @since invalid
 */
export const value = 1
`
    const declaration = node(source, "export const value", "VariableDeclaration", { declarations: [] })
    const exportNode = exportNamed(source, "export const value", declaration)
    const errors = runRuleWithSource(
      source,
      [{ visitor: "ExportNamedDeclaration", node: exportNode }],
      [importDeclaration(source), exportNode],
      categoryOnlyOptions
    )

    expect(errors).toHaveLength(0)
  })

  it("category-only checks still enforce category placement", () => {
    const source = `/**
 * @since 1.0.0
 */
import * as Effect from "effect/Effect"

/**
 * Option namespace.
 *
 * @category namespaces
 * @since 1.0.0
 */
export declare namespace Option {
  /**
   * Extracts the value type.
   *
   * @since 1.0.0
   */
  export type Value<T> = T
}

/**
 * Options.
 *
 * @category models
 * @since 1.0.0
 */
export interface Options {
  /**
   * A member.
   *
   * @category models
   */
  readonly member: string
}

/**
 * A value.
 *
 * @since 1.0.0
 */
export const value = 1
`
    const namespaceValueDeclaration = node(source, "export type Value", "TSTypeAliasDeclaration", {
      typeAnnotation: null
    })
    const namespaceValueExport = exportNamed(source, "export type Value", namespaceValueDeclaration)
    const namespaceDeclaration = node(source, "export declare namespace Option", "TSModuleDeclaration", {
      body: { body: [namespaceValueExport] }
    })
    const namespaceExport = exportNamed(source, "export declare namespace Option", namespaceDeclaration)
    const member = node(source, "readonly member", "TSPropertySignature")
    const optionsDeclaration = node(source, "export interface Options", "TSInterfaceDeclaration", {
      body: { body: [member] }
    })
    const optionsExport = exportNamed(source, "export interface Options", optionsDeclaration)
    const valueDeclaration = node(source, "export const value", "VariableDeclaration", { declarations: [] })
    const valueExport = exportNamed(source, "export const value", valueDeclaration)
    const errors = runRuleWithSource(
      source,
      [
        { visitor: "ExportNamedDeclaration", node: namespaceExport },
        { visitor: "ExportNamedDeclaration", node: namespaceValueExport },
        { visitor: "ExportNamedDeclaration", node: optionsExport },
        { visitor: "ExportNamedDeclaration", node: valueExport }
      ],
      [importDeclaration(source), namespaceExport, optionsExport, valueExport],
      categoryOnlyOptions
    )

    expect(errors.map((error) => error.message)).toEqual([
      "@category is not allowed in namespace JSDoc",
      "Public JSDoc must include @category",
      "@category is not allowed in member JSDoc",
      "Public JSDoc must include @category"
    ])
  })

  it("allows @see tags with a link and trailing explanation", () => {
    const source = `/**
 * A value.
 *
 * @see {@link other} for more details
 * @category constructors
 * @since 1.0.0
 */
export const value = 1
`
    const declaration = node(source, "export const value", "VariableDeclaration", { declarations: [] })
    const exportNode = exportNamed(source, "export const value", declaration)
    const errors = runRuleWithSource(source, [{ visitor: "ExportNamedDeclaration", node: exportNode }])

    expect(errors).toHaveLength(0)
  })

  it("allows directive comments between JSDoc and an exported declaration", () => {
    const source = `/**
 * A value.
 *
 * @category constructors
 * @since 1.0.0
 */
// @ts-expect-error
export const value = 1
`
    const declaration = node(source, "export const value", "VariableDeclaration", { declarations: [] })
    const exportNode = exportNamed(source, "export const value", declaration)
    const errors = runRuleWithSource(source, [{ visitor: "ExportNamedDeclaration", node: exportNode }])

    expect(errors).toHaveLength(0)
  })

  it("allows effect diagnostic comments between JSDoc and an exported declaration", () => {
    const source = `/**
 * A service.
 *
 * @category services
 * @since 1.0.0
 */
// @effect-diagnostics effect/leakingRequirements:off
export class Service {}
`
    const declaration = node(source, "export class Service", "ClassDeclaration")
    const exportNode = exportNamed(source, "export class Service", declaration)
    const errors = runRuleWithSource(source, [{ visitor: "ExportNamedDeclaration", node: exportNode }])

    expect(errors).toHaveLength(0)
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

  it("allows undocumented members recursively in exported object types", () => {
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

    expect(errors).toHaveLength(0)
  })

  it("allows member docs without @category when present", () => {
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
  readonly outer: string
}
`
    const outer = node(source, "readonly outer", "TSPropertySignature")
    const declaration = node(source, "export interface Options", "TSInterfaceDeclaration", {
      body: { body: [outer] }
    })
    const exportNode = exportNamed(source, "export interface Options", declaration)
    const errors = runRuleWithSource(source, [{ visitor: "ExportNamedDeclaration", node: exportNode }])

    expect(errors).toHaveLength(0)
  })

  it("forbids @category when member docs are present", () => {
    const source = `/**
 * Options.
 *
 * @category models
 * @since 1.0.0
 */
export interface Options {
  /**
   * Outer options.
   *
   * @category models
   */
  readonly outer: string
}
`
    const outer = node(source, "readonly outer", "TSPropertySignature")
    const declaration = node(source, "export interface Options", "TSInterfaceDeclaration", {
      body: { body: [outer] }
    })
    const exportNode = exportNamed(source, "export interface Options", declaration)
    const errors = runRuleWithSource(source, [{ visitor: "ExportNamedDeclaration", node: exportNode }])

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe("@category is not allowed in member JSDoc")
  })

  it("validates member docs recursively when present", () => {
    const source = `/**
 * Options.
 *
 * @category models
 * @since 1.0.0
 */
export interface Options {
  readonly outer: {
    /**
     * Inner options.
     */
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

    expect(errors).toHaveLength(0)
  })

  it("does not require member docs for anonymous call signatures in exported value type literals", () => {
    const source = `/**
 * A callable value.
 *
 * @category constructors
 * @since 1.0.0
 */
export const value: {
  <A>(self: A): A
  new <A>(self: A): A
  /**
   * A named member.
   */
  readonly member: string
} = undefined as never
`
    const callSignature = node(source, "<A>(self", "TSCallSignatureDeclaration", {
      params: [],
      returnType: null
    })
    const constructSignature = node(source, "new <A>(self", "TSConstructSignatureDeclaration", {
      params: [],
      returnType: null
    })
    const member = node(source, "readonly member", "TSPropertySignature")
    const declaration = node(source, "export const value", "VariableDeclaration", {
      declarations: [{
        id: {
          typeAnnotation: {
            type: "TSTypeAnnotation",
            typeAnnotation: {
              type: "TSTypeLiteral",
              members: [callSignature, constructSignature, member]
            }
          }
        },
        init: null
      }]
    })
    const exportNode = exportNamed(source, "export const value", declaration)
    const errors = runRuleWithSource(source, [{ visitor: "ExportNamedDeclaration", node: exportNode }])

    expect(errors).toHaveLength(0)
  })

  it("does not require member docs for named members in exported value type literals", () => {
    const source = `/**
 * A callable value.
 *
 * @category constructors
 * @since 1.0.0
 */
export const value: {
  <A>(self: A): A
  readonly member: string
} = undefined as never
`
    const callSignature = node(source, "<A>(self", "TSCallSignatureDeclaration", {
      params: [],
      returnType: null
    })
    const member = node(source, "readonly member", "TSPropertySignature")
    const declaration = node(source, "export const value", "VariableDeclaration", {
      declarations: [{
        id: {
          typeAnnotation: {
            type: "TSTypeAnnotation",
            typeAnnotation: {
              type: "TSTypeLiteral",
              members: [callSignature, member]
            }
          }
        },
        init: null
      }]
    })
    const exportNode = exportNamed(source, "export const value", declaration)
    const errors = runRuleWithSource(source, [{ visitor: "ExportNamedDeclaration", node: exportNode }])

    expect(errors).toHaveLength(0)
  })

  it("does not require member docs for anonymous call signatures in exported value return types", () => {
    const source = `/**
 * Makes a callable value.
 *
 * @category constructors
 * @since 1.0.0
 */
export const make = <A>(): {
  (self: A): A
} => undefined as never
`
    const callSignature = node(source, "(self: A)", "TSCallSignatureDeclaration", {
      params: [],
      returnType: null
    })
    const declaration = node(source, "export const make", "VariableDeclaration", {
      declarations: [{
        id: { typeAnnotation: null },
        init: {
          type: "ArrowFunctionExpression",
          params: [],
          returnType: {
            type: "TSTypeAnnotation",
            typeAnnotation: {
              type: "TSTypeLiteral",
              members: [callSignature]
            }
          }
        }
      }]
    })
    const exportNode = exportNamed(source, "export const make", declaration)
    const errors = runRuleWithSource(source, [{ visitor: "ExportNamedDeclaration", node: exportNode }])

    expect(errors).toHaveLength(0)
  })

  it("does not require member docs for inline object parameters of anonymous call signatures", () => {
    const source = `/**
 * Matches a value.
 *
 * @category pattern matching
 * @since 1.0.0
 */
export const match: {
  <A, B>(options: {
    readonly onNone: () => B
    readonly onSome: (a: A) => B
  }): (self: A) => B
} = undefined as never
`
    const onNone = node(source, "readonly onNone", "TSPropertySignature")
    const onSome = node(source, "readonly onSome", "TSPropertySignature")
    const callSignature = node(source, "<A, B>(options", "TSCallSignatureDeclaration", {
      params: [{
        typeAnnotation: {
          type: "TSTypeAnnotation",
          typeAnnotation: {
            type: "TSTypeLiteral",
            members: [onNone, onSome]
          }
        }
      }],
      returnType: null
    })
    const declaration = node(source, "export const match", "VariableDeclaration", {
      declarations: [{
        id: {
          typeAnnotation: {
            type: "TSTypeAnnotation",
            typeAnnotation: {
              type: "TSTypeLiteral",
              members: [callSignature]
            }
          }
        },
        init: null
      }]
    })
    const exportNode = exportNamed(source, "export const match", declaration)
    const errors = runRuleWithSource(source, [{ visitor: "ExportNamedDeclaration", node: exportNode }])

    expect(errors).toHaveLength(0)
  })

  it("does not require public class member docs", () => {
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

    expect(errors).toHaveLength(0)
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

  it("reports module JSDoc violations on the module block", () => {
    const source = `/**
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

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe("Module JSDoc must include a description")
    expect((errors[0].node as TestNode).range).toEqual(rangeOf(
      source,
      `/**
 * @since 1.0.0
 */`
    ))
  })

  it("uses top-level ambient module JSDoc as module JSDoc", () => {
    const source = `/**
 * Declares the upstream virtual file system module.
 *
 * @since 1.0.0
 */
declare module "upstream/vfs" {
  /**
   * A virtual file system implementation.
   *
   * @category models
   * @since 1.0.0
   */
  // oxlint-disable-next-line @typescript-eslint/no-extraneous-class
  export class Vfs {}
}
`
    const declaration = node(source, "export class Vfs", "ClassDeclaration", {
      body: { body: [] }
    })
    const exportNode = exportNamed(source, "export class Vfs", declaration)
    const moduleDeclaration = node(source, "declare module", "TSModuleDeclaration", {
      body: { body: [exportNode] }
    })
    const errors = runRuleWithSource(
      source,
      [{ visitor: "ExportNamedDeclaration", node: exportNode }],
      [moduleDeclaration]
    )

    expect(errors).toHaveLength(0)
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

  it("forbids @category on namespace JSDoc", () => {
    const source = `/**
 * Option namespace.
 *
 * @category namespaces
 * @since 1.0.0
 */
export declare namespace Option {
  /**
   * Extracts the value type.
   *
   * @category type-level utils
   * @since 1.0.0
   */
  export type Value<T> = T
}
`
    const valueDeclaration = node(source, "export type Value", "TSTypeAliasDeclaration", {
      typeAnnotation: null
    })
    const valueExport = exportNamed(source, "export type Value", valueDeclaration)
    const namespaceDeclaration = node(source, "export declare namespace Option", "TSModuleDeclaration", {
      body: { body: [valueExport] }
    })
    const namespaceExport = exportNamed(source, "export declare namespace Option", namespaceDeclaration)
    const errors = runRuleWithSource(source, [
      { visitor: "ExportNamedDeclaration", node: namespaceExport },
      { visitor: "ExportNamedDeclaration", node: valueExport }
    ])

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe("@category is not allowed in namespace JSDoc")
  })

  it("requires public JSDoc tags on namespace member exports", () => {
    const source = `/**
 * Option namespace.
 *
 * @since 1.0.0
 */
export declare namespace Option {
  /**
   * Extracts the value type.
   *
   * @since 1.0.0
   */
  export type Value<T> = T
}
`
    const valueDeclaration = node(source, "export type Value", "TSTypeAliasDeclaration", {
      typeAnnotation: null
    })
    const valueExport = exportNamed(source, "export type Value", valueDeclaration)
    const namespaceDeclaration = node(source, "export declare namespace Option", "TSModuleDeclaration", {
      body: { body: [valueExport] }
    })
    const namespaceExport = exportNamed(source, "export declare namespace Option", namespaceDeclaration)
    const errors = runRuleWithSource(source, [
      { visitor: "ExportNamedDeclaration", node: namespaceExport },
      { visitor: "ExportNamedDeclaration", node: valueExport }
    ])

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe("Public JSDoc must include @category")
  })

  it("forbids @category on documented class members", () => {
    const source = `/**
 * A service.
 *
 * @category services
 * @since 1.0.0
 */
export class Service {
  /**
   * Runs the service.
   *
   * @category services
   * @since 1.0.0
   */
  run() {}
}
`
    const run = node(source, "run", "MethodDefinition", {
      kind: "method",
      value: {
        type: "FunctionExpression",
        params: [],
        returnType: null
      }
    })
    const declaration = node(source, "export class Service", "ClassDeclaration", {
      body: { body: [run] }
    })
    const exportNode = exportNamed(source, "export class Service", declaration)
    const errors = runRuleWithSource(source, [{ visitor: "ExportNamedDeclaration", node: exportNode }])

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe("@category is not allowed in member JSDoc")
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
