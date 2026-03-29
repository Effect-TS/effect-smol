// @ts-check
/**
 * Adds pure annotations to compiled output for bundler tree-shaking.
 *
 * OXC's minifier recognizes both `#__PURE__` and `@__PURE__` comments for dead
 * code elimination, so this script inserts the canonical `@__PURE__` form
 * before the same call / new-expression sites that the old Babel plugin
 * annotated.
 *
 * We keep the AST walk in JavaScript because `oxc-parser` does not currently
 * expose a generic pure-call annotation option. Source maps are updated via
 * `magic-string` + `@jridgewell/remapping` to compose the insertion map with
 * the pre-existing tsc source map.
 */
import { parseSync } from "oxc-parser"
import MagicString from "magic-string"
import remapping from "@jridgewell/remapping"
import * as fs from "node:fs"
import * as path from "node:path"
import { globSync } from "glob"

const PURE = "/* @__PURE__ */ "
const distDir = path.resolve(process.cwd(), "dist")

/**
 * @typedef {{
 *   type?: string
 *   start?: number
 *   callee?: NodeWithParent
 *   _parent?: NodeWithParent | null
 *   [key: string]: unknown
 * }} NodeWithParent
 */

/**
 * @typedef {NodeWithParent & {
 *   type: "CallExpression" | "NewExpression"
 *   callee?: NodeWithParent
 * }} CallOrNewNode
 */

/**
 * @typedef {(node: NodeWithParent) => void} Visitor
 */

main()

function main() {
  if (!fs.existsSync(distDir)) {
    return
  }

  const files = globSync("**/*.js", { cwd: distDir, absolute: true })
  for (const file of files) {
    annotateFile(file)
  }
}

/**
 * Annotate a compiled JavaScript file in place.
 *
 * If a `.js.map` file exists alongside the source, the source map is updated
 * by composing the insertion map (from `magic-string`) with the pre-existing
 * tsc source map (via `@jridgewell/remapping`), so debugger mappings remain
 * accurate through to the original `.ts` source.
 *
 * @param {string} file
 */
function annotateFile(file) {
  const source = fs.readFileSync(file, "utf-8")
  if (!source.trim()) {
    return
  }

  const program = parseProgram(file, source)
  if (program === null) {
    return
  }

  setParents(program, null)

  const positions = collectAnnotationPositions(program, source)
  if (positions.length === 0) {
    return
  }

  const ms = new MagicString(source)
  for (const pos of positions) {
    ms.appendLeft(pos, PURE)
  }

  fs.writeFileSync(file, ms.toString())

  const mapFile = file + ".map"
  if (fs.existsSync(mapFile)) {
    const basename = path.basename(file)
    const tscMap = fs.readFileSync(mapFile, "utf-8")
    const insertionMap = ms.generateMap({
      source: basename,
      file: basename,
      includeContent: false,
      hires: false
    })
    const composed = remapping(
      JSON.stringify(insertionMap),
      (f) => f === basename ? tscMap : null
    )
    fs.writeFileSync(mapFile, JSON.stringify(composed))
  }
}

/**
 * @param {string} file
 * @param {string} source
 * @returns {NodeWithParent | null}
 */
function parseProgram(file, source) {
  const result = /** @type {{ program: NodeWithParent, errors: Array<{ severity: string }> }} */ (
    /** @type {unknown} */ (parseSync(file, source, { sourceType: "module" }))
  )
  if (result.errors.some((e) => e.severity === "Error")) {
    return null
  }
  return result.program
}

/**
 * @param {NodeWithParent} program
 * @param {string} source
 * @returns {Array<number>}
 */
function collectAnnotationPositions(program, source) {
  /** @type {Array<number>} */
  const positions = []

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

/**
 * @param {unknown} value
 * @returns {value is NodeWithParent}
 */
function isNode(value) {
  return !!value && typeof value === "object" && "type" in value
}

/**
 * Attach `_parent` references so we can walk up the tree.
 *
 * @param {NodeWithParent | null | undefined} node
 * @param {NodeWithParent | null} parent
 */
function setParents(node, parent) {
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
 *
 * @param {NodeWithParent | null | undefined} node
 * @param {Visitor} visitor
 */
function walk(node, visitor) {
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
 *
 * @param {string} source
 * @param {number} pos
 */
function isPureAnnotated(source, pos) {
  const slice = source.slice(Math.max(0, pos - 30), pos)
  return /\/\*\s*[#@]__PURE__\s*\*\/\s*$/.test(slice)
}

/**
 * @param {NodeWithParent | null | undefined} node
 * @returns {node is CallOrNewNode}
 */
function isCallOrNew(node) {
  return node?.type === "CallExpression" || node?.type === "NewExpression"
}

/**
 * True when `node` is the callee of a call/new (e.g. `foo` in `foo()()`).
 * Unwraps `ParenthesizedExpression` wrappers from OXC's AST.
 *
 * @param {NodeWithParent} node
 * @returns {boolean}
 */
function isUsedAsCallee(node) {
  let current = node
  let parent = current._parent
  while (parent?.type === "ParenthesizedExpression") {
    current = parent
    parent = current._parent
  }
  return isCallOrNew(parent) && parent.callee === current
}

/**
 * True when an ancestor (before the nearest statement/function) is a callee.
 *
 * @param {NodeWithParent} node
 * @returns {boolean}
 */
function isInCallee(node) {
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
 *
 * @param {NodeWithParent} node
 * @returns {boolean}
 */
function isExecutedDuringInitialization(node) {
  let fn = getFunctionParent(node)
  while (fn) {
    if (!isUsedAsCallee(fn)) return false
    fn = getFunctionParent(fn)
  }
  return true
}

/**
 * True when an ancestor (up to the statement) is a variable/assignment/class.
 *
 * @param {NodeWithParent} node
 * @returns {boolean}
 */
function isInAssignmentContext(node) {
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

/**
 * @param {NodeWithParent} node
 * @returns {boolean}
 */
function isInExportDefault(node) {
  return getStatementParent(node)?.type === "ExportDefaultDeclaration"
}

/**
 * @param {NodeWithParent} node
 * @returns {NodeWithParent | null}
 */
function getFunctionParent(node) {
  let current = node._parent
  while (current) {
    if (isFunction(current)) return current
    current = current._parent
  }
  return null
}

/**
 * @param {NodeWithParent} node
 * @returns {NodeWithParent | null}
 */
function getStatementParent(node) {
  let current = node._parent
  while (current) {
    if (isStatement(current)) return current
    current = current._parent
  }
  return null
}

/**
 * @param {NodeWithParent | null | undefined} node
 * @returns {boolean}
 */
function isStatement(node) {
  if (!node?.type) return false
  const t = node.type
  return t.endsWith("Statement") || t.endsWith("Declaration") || t === "Program"
}

/**
 * @param {NodeWithParent | null | undefined} node
 * @returns {boolean}
 */
function isFunction(node) {
  if (!node?.type) return false
  const t = node.type
  return t === "FunctionDeclaration" ||
    t === "FunctionExpression" ||
    t === "ArrowFunctionExpression"
}
