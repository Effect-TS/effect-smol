/**
 * @since 4.0.0
 */
import { format } from "./Formatter.ts"
import { escapeToken, unescapeToken } from "./JsonPointer.ts"
import * as Predicate from "./Predicate.ts"
import type * as Schema from "./Schema.ts"

/**
 * A single JSON Patch operation.
 *
 * This is a subset of RFC 6902, restricted to operations that can be applied
 * deterministically without additional context.
 *
 * Paths are JSON Pointers. The empty string (`""`) refers to the root document.
 *
 * @category Model
 * @since 4.0.0
 */
export type JsonPatchOperation =
  | {
    readonly op: "add"
    /**
     * JSON Pointer to the target location.
     *
     * For arrays, the last token may be `-` to append.
     */
    readonly path: string
    readonly value: Schema.Json
    readonly description?: string
  }
  | {
    readonly op: "remove"
    /** JSON Pointer to the target location. */
    readonly path: string
    readonly description?: string
  }
  | {
    readonly op: "replace"
    /** JSON Pointer to the target location. Use `""` to replace the root document. */
    readonly path: string
    readonly value: Schema.Json
    readonly description?: string
  }

/**
 * A JSON Patch document (an ordered list of operations).
 *
 * Operations are applied in sequence, and later operations observe the changes
 * made by earlier ones.
 *
 * @category Model
 * @since 4.0.0
 */
export type JsonPatch = ReadonlyArray<JsonPatchOperation>

/**
 * Compute a patch that transforms `oldValue` into `newValue`.
 *
 * This is a structural diff:
 *
 * - Primitives become a root `replace`.
 * - Arrays are compared by index (no move/copy detection).
 * - Objects are compared by key; keys are processed in sorted order to keep the
 *   output stable across runs.
 *
 * The generated patch is deterministic, but not guaranteed to be minimal.
 *
 * Array removals are emitted from highest index to lowest to avoid index
 * shifting when the patch is applied.
 *
 * @since 4.0.0
 */
export function get(oldValue: Schema.Json, newValue: Schema.Json): JsonPatch {
  if (Object.is(oldValue, newValue)) return []
  const patches: Array<JsonPatchOperation> = []

  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    const len1 = oldValue.length
    const len2 = newValue.length

    // Compare shared prefix by index
    const shared = Math.min(len1, len2)
    for (let i = 0; i < shared; i++) {
      const path = `/${i}`
      const patch = get(oldValue[i], newValue[i])
      for (const op of patch) {
        prefixPathInPlace(op, path)
        patches.push(op)
      }
    }

    // Remove from end to start so later indices do not shift.
    for (let i = len1 - 1; i >= len2; i--) {
      patches.push({ op: "remove", path: `/${i}` })
    }

    // Add from beginning to end.
    for (let i = len1; i < len2; i++) {
      patches.push({ op: "add", path: `/${i}`, value: newValue[i] })
    }

    return patches
  }

  if (isJsonObject(oldValue) && isJsonObject(newValue)) {
    const keys1 = Object.keys(oldValue)
    const keys2 = Object.keys(newValue)
    const allKeys = Array.from(new Set([...keys1, ...keys2])).sort()

    for (const key of allKeys) {
      const esc = escapeToken(key)
      const path = `/${esc}`
      const hasKey1 = Object.hasOwn(oldValue, key)
      const hasKey2 = Object.hasOwn(newValue, key)

      if (hasKey1 && hasKey2) {
        const patch = get(oldValue[key], newValue[key])
        for (const op of patch) {
          prefixPathInPlace(op, path)
          patches.push(op)
        }
      } else if (!hasKey1 && hasKey2) {
        patches.push({ op: "add", path, value: newValue[key] })
      } else if (hasKey1 && !hasKey2) {
        patches.push({ op: "remove", path })
      }
    }

    return patches
  }

  patches.push({ op: "replace", path: "", value: newValue })
  return patches
}

/**
 * Apply a JSON Patch to a document.
 *
 * The input is never mutated. If the patch is empty, the original reference is
 * returned.
 *
 * Root replace (`path: ""`) returns the provided value as-is.
 *
 * @since 4.0.0
 */
export function apply(patch: JsonPatch, oldValue: Schema.Json): Schema.Json {
  let doc = oldValue

  for (const op of patch) {
    switch (op.op) {
      case "replace": {
        doc = op.path === "" ? op.value : setAt(doc, op.path, op.value, "replace")
        break
      }
      case "add": {
        doc = addAt(doc, op.path, op.value)
        break
      }
      case "remove": {
        doc = setAt(doc, op.path, undefined, "remove")
        break
      }
    }
  }

  return doc
}

// Mutates op.path in place for perf; safe because child ops are freshly created and not shared.
function prefixPathInPlace(op: JsonPatchOperation, parent: string): void {
  ;(op as any).path = op.path === "" ? parent : parent + op.path
}

function isJsonObject(value: unknown): value is Schema.JsonObject {
  return Predicate.isObject(value)
}

/**
 * Tokenize a JSON Pointer into unescaped reference tokens.
 *
 * - `""` (empty pointer) refers to the root and returns `[]`
 * - Non-empty pointers must start with `/`
 */
function tokenize(pointer: string): Array<string> {
  if (pointer === "") return []
  if (pointer.charCodeAt(0) !== 47 /* "/" */) {
    throw new Error(`Invalid JSON Pointer, it must start with "/": ${format(pointer)}`)
  }
  return pointer.split("/").slice(1).map(unescapeToken)
}

/** Convert a reference token to a non-negative array index (rejects `-` and negatives). */
function toIndex(token: string): number {
  if (!/^(0|[1-9]\d*)$/.test(token)) {
    throw new Error(`Invalid array index: "${token}"`)
  }
  return Number(token)
}

function addAt(doc: Schema.Json, pointer: string, val: Schema.Json): Schema.Json {
  if (pointer === "") return val

  const resolved = resolveParent(doc, pointer)
  if (resolved === null) {
    throw new Error(`Cannot add at "${pointer}" (parent not found or not a container).`)
  }

  const { lastToken, parent, stack } = resolved

  if (Array.isArray(parent)) {
    const idx = lastToken === "-" ? parent.length : toIndex(lastToken)
    if (idx < 0 || idx > parent.length) throw new Error(`Array index out of bounds at "${pointer}".`)
    const updated = parent.slice()
    updated.splice(idx, 0, val)
    return rebuildFromStack(stack, updated)
  }

  if (isJsonObject(parent)) {
    const updated = { ...parent }
    updated[lastToken] = val
    return rebuildFromStack(stack, updated)
  }

  throw new Error(`Cannot add at "${pointer}" (parent not found or not a container).`)
}

function setAt(
  doc: Schema.Json,
  pointer: string,
  val: Schema.Json | undefined,
  mode: "replace" | "remove"
): Schema.Json {
  if (pointer === "") {
    if (mode === "remove" || val === undefined) throw new Error("Unsupported operation at the root")
    return val
  }

  const resolved = resolveParent(doc, pointer)
  if (resolved === null) {
    throw new Error(`Cannot ${mode} at "${pointer}" (parent not found or not a container).`)
  }

  const { lastToken, parent, stack } = resolved

  if (Array.isArray(parent)) {
    if (lastToken === "-") throw new Error(`"-" is not valid for ${mode} at "${pointer}".`)
    const idx = toIndex(lastToken)
    if (idx < 0 || idx >= parent.length) throw new Error(`Array index out of bounds at "${pointer}".`)
    const updated = parent.slice()
    if (mode === "remove") updated.splice(idx, 1)
    else updated[idx] = val
    return rebuildFromStack(stack, updated)
  }

  if (isJsonObject(parent)) {
    if (!Object.hasOwn(parent, lastToken)) {
      throw new Error(`Property "${lastToken}" does not exist at "${pointer}".`)
    }
    const updated = { ...parent }
    if (mode === "remove") delete updated[lastToken]
    else updated[lastToken] = val!
    return rebuildFromStack(stack, updated)
  }

  throw new Error(`Cannot ${mode} at "${pointer}" (parent not found or not a container).`)
}

type StackEntry = { readonly container: unknown; readonly token: number | string }

// Walk to the parent of `pointer`, recording the path.
// Returns null if the parent path cannot be resolved.
function resolveParent(
  doc: Schema.Json,
  pointer: string
): { readonly stack: ReadonlyArray<StackEntry>; readonly parent: unknown; readonly lastToken: string } | null {
  const tokens = tokenize(pointer)
  if (tokens.length === 0) return null // caller handles root

  const lastToken = tokens[tokens.length - 1]
  const stack: Array<StackEntry> = []
  let cur: unknown = doc

  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i]

    if (cur == null) return null

    if (Array.isArray(cur)) {
      const idx = toIndex(token)
      if (idx < 0 || idx >= cur.length) return null
      stack.push({ container: cur, token: idx })
      cur = cur[idx]
      continue
    }

    if (cur && typeof cur === "object") {
      if (!Object.hasOwn(cur, token)) return null
      stack.push({ container: cur, token })
      cur = (cur as any)[token]
      continue
    }

    return null
  }

  return { stack, parent: cur, lastToken }
}

// Rebuild the document by writing `newParent` back through `stack`.
function rebuildFromStack(stack: ReadonlyArray<StackEntry>, newParent: Schema.Json): Schema.Json {
  let acc: Schema.Json = newParent

  for (let i = stack.length - 1; i >= 0; i--) {
    const { container, token } = stack[i]

    if (Array.isArray(container)) {
      const copy = container.slice()
      copy[token as number] = acc
      acc = copy
    } else {
      const copy = { ...(container as Schema.JsonObject) }
      copy[token as string] = acc
      acc = copy
    }
  }

  return acc
}
