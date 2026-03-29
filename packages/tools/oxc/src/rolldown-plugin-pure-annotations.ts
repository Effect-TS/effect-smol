/**
 * Rolldown transform plugin that adds `/* @__PURE__ *​/` annotations before
 * call/new expressions executed during module initialization.
 *
 * This enables bundler tree-shaking by marking top-level side-effect-free
 * calls as pure. The annotation logic mirrors the Babel
 * `annotate-pure-calls` plugin behavior, ported to work with the OXC parser
 * AST.
 *
 * @module
 */
import MagicString from "magic-string"
import { parseSync } from "oxc-parser"
import type { Plugin } from "rolldown"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AstNode {
  type?: string
  start?: number
  callee?: AstNode
  _parent?: AstNode | null
  [key: string]: unknown
}

type CallOrNewNode = AstNode & {
  type: "CallExpression" | "NewExpression"
  callee?: AstNode
}

type Visitor = (node: AstNode) => void

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PURE = "/* @__PURE__ */ "

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/**
 * Creates a Rolldown transform plugin that inserts `@__PURE__` annotations
 * before call and new expressions that are executed during module
 * initialization (top-level or inside IIFEs) and appear in assignment /
 * export-default contexts.
 */
export function pureAnnotations(): Plugin {
  return {
    name: "effect-pure-annotations",
    transform(code: string, id: string) {
      if (!/\.[jt]sx?$/.test(id)) return null
      if (id.includes("node_modules")) return null
      if (!code.trim()) return null

      const program = parseProgram(id, code)
      if (program === null) return null

      setParents(program, null)

      const positions = collectAnnotationPositions(program, code)
      if (positions.length === 0) return null

      const ms = new MagicString(code)
      for (const pos of positions) {
        ms.appendLeft(pos, PURE)
      }

      return { code: ms.toString(), map: ms.generateMap({ hires: true }) }
    }
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function parseProgram(file: string, source: string): AstNode | null {
  const result = parseSync(file, source, { sourceType: "module" }) as unknown as {
    program: AstNode
    errors: Array<{ severity: string }>
  }
  if (result.errors.some((e) => e.severity === "Error")) {
    return null
  }
  return result.program
}

// ---------------------------------------------------------------------------
// Annotation collection (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Walks the AST and collects source positions where a `@__PURE__` annotation
 * should be inserted. Positions are returned in descending order so that
 * insertions do not shift subsequent offsets.
 */
export function collectAnnotationPositions(
  program: AstNode,
  source: string
): Array<number> {
  const positions: Array<number> = []

  walk(program, (node) => {
    if (node.type !== "CallExpression" && node.type !== "NewExpression") return
    if (typeof node.start !== "number") return
    if (isPureAnnotated(source, node.start)) return
    if (isUsedAsCallee(node)) return
    if (isInCallee(node)) return
    if (!isExecutedDuringInitialization(node)) return
    if (!isInAssignmentContext(node) && !isInExportDefault(node)) return
    positions.push(node.start)
  })

  return [...new Set(positions)].sort((a, b) => b - a)
}

// ---------------------------------------------------------------------------
// AST utilities
// ---------------------------------------------------------------------------

function isNode(value: unknown): value is AstNode {
  return !!value && typeof value === "object" && "type" in value
}

/**
 * Attach `_parent` references so we can walk up the tree.
 */
export function setParents(
  node: AstNode | null | undefined,
  parent: AstNode | null
): void {
  if (!node || typeof node !== "object") return
  node._parent = parent
  for (const key of Object.keys(node)) {
    if (key === "_parent") continue
    const val = node[key]
    if (Array.isArray(val)) {
      for (const item of val) {
        if (isNode(item)) setParents(item, node)
      }
    } else if (isNode(val)) {
      setParents(val, node)
    }
  }
}

/**
 * Depth-first visitor over every AST node.
 */
function walk(
  node: AstNode | null | undefined,
  visitor: Visitor
): void {
  if (!node || typeof node !== "object") return
  visitor(node)
  for (const key of Object.keys(node)) {
    if (key === "_parent") continue
    const val = node[key]
    if (Array.isArray(val)) {
      for (const item of val) {
        if (isNode(item)) walk(item, visitor)
      }
    } else if (isNode(val)) {
      walk(val, visitor)
    }
  }
}

/**
 * Check whether a pure annotation already precedes `pos`.
 */
function isPureAnnotated(source: string, pos: number): boolean {
  const slice = source.slice(Math.max(0, pos - 30), pos)
  return /\/\*\s*[#@]__PURE__\s*\*\/\s*$/.test(slice)
}

function isCallOrNew(node: AstNode | null | undefined): node is CallOrNewNode {
  return node?.type === "CallExpression" || node?.type === "NewExpression"
}

/**
 * True when `node` is the callee of a call/new (e.g. `foo` in `foo()()`).
 * Unwraps `ParenthesizedExpression` wrappers from OXC's AST.
 */
function isUsedAsCallee(node: AstNode): boolean {
  let current: AstNode = node
  let parent = current._parent
  while (parent?.type === "ParenthesizedExpression") {
    current = parent
    parent = current._parent
  }
  return isCallOrNew(parent) && parent.callee === current
}

/**
 * True when an ancestor (before the nearest statement/function) is a callee.
 */
function isInCallee(node: AstNode): boolean {
  let current = node._parent
  while (current) {
    if (isStatement(current) || isFunction(current)) break
    if (isUsedAsCallee(current)) return true
    current = current._parent
  }
  return false
}

/**
 * True when every enclosing function is itself used as a callee (IIFE).
 * Top-level code (no function parent) counts as initialization.
 */
function isExecutedDuringInitialization(node: AstNode): boolean {
  let fn = getFunctionParent(node)
  while (fn) {
    if (!isUsedAsCallee(fn)) return false
    fn = getFunctionParent(fn)
  }
  return true
}

/**
 * True when an ancestor (up to the statement) is a variable/assignment/class.
 */
function isInAssignmentContext(node: AstNode): boolean {
  const stmt = getStatementParent(node)
  let current = node._parent
  while (current && current !== stmt?._parent) {
    const t = current.type
    if (
      t === "VariableDeclaration" ||
      t === "VariableDeclarator" ||
      t === "AssignmentExpression" ||
      t === "ClassDeclaration" ||
      t === "ClassExpression"
    ) return true
    current = current._parent
  }
  return false
}

function isInExportDefault(node: AstNode): boolean {
  return getStatementParent(node)?.type === "ExportDefaultDeclaration"
}

function getFunctionParent(node: AstNode): AstNode | null {
  let current = node._parent
  while (current) {
    if (isFunction(current)) return current
    current = current._parent
  }
  return null
}

function getStatementParent(node: AstNode): AstNode | null {
  let current = node._parent
  while (current) {
    if (isStatement(current)) return current
    current = current._parent
  }
  return null
}

function isStatement(node: AstNode | null | undefined): boolean {
  if (!node?.type) return false
  const t = node.type
  return t.endsWith("Statement") || t.endsWith("Declaration") || t === "Program"
}

function isFunction(node: AstNode | null | undefined): boolean {
  if (!node?.type) return false
  const t = node.type
  return t === "FunctionDeclaration" ||
    t === "FunctionExpression" ||
    t === "ArrowFunctionExpression"
}
