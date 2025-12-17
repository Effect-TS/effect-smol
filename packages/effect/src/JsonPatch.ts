/**
 * JSON Patch (RFC 6902 subset) utilities.
 *
 * This module implements a small, predictable subset of JSON Patch:
 *
 * - `add` (including array append via `/-`)
 * - `remove`
 * - `replace`
 *
 * Patches are expressed using JSON Pointer (RFC 6901) paths. A path is either:
 *
 * - `""` (the root document)
 * - `"/..."` (one or more reference tokens separated by `/`)
 *
 * Reference tokens follow the RFC 6901 escaping rules:
 *
 * - `~` is encoded as `~0`
 * - `/` is encoded as `~1`
 *
 * Notes on semantics:
 *
 * - `replace` and `remove` require the target to exist.
 * - `add` may create a missing object member.
 * - For arrays, `add` supports `/-` to append. `replace` / `remove` do not.
 * - Root `replace` (`path: ""`) returns the provided value as-is (no cloning).
 * - Root `remove` is not supported.
 *
 * The implementation is immutable: applying a patch never mutates the input
 * document; it creates updated copies along the modified path.
 *
 * @since 4.0.0
 */
import { format } from "./Formatter.ts"
import { escapeToken, unescapeToken } from "./internal/schema/json-pointer.ts"
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
     * For array targets, `path` may end with `/-` to append.
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
        if (op.path === "") return op.value
        doc = setAt(doc, op.path, op.value, "replace")
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

function isJsonObject(value: Schema.Json): value is Schema.JsonObject {
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

/**
 * Read the value at `pointer`.
 *
 * Returns `undefined` when the traversal walks into `null` / `undefined`, or when
 * an array index is out of bounds.
 */
function getAt(doc: Schema.Json, pointer: string): Schema.Json | undefined {
  if (pointer === "") return doc
  const tokens = tokenize(pointer)
  let cur: any = doc

  for (const token of tokens) {
    if (cur == null) return undefined

    if (Array.isArray(cur)) {
      const idx = toIndex(token)
      if (idx < 0 || idx >= cur.length) return undefined
      cur = cur[idx]
    } else {
      cur = (cur as any)[token]
    }
  }

  return cur
}

/**
 * Apply an `add` at `pointer`.
 *
 * - May create a missing object member.
 * - For arrays, supports `/-` to append.
 * - Throws when the parent location does not exist, is not a container, or when
 *   an array index is out of bounds.
 */
function addAt(doc: Schema.Json, pointer: string, val: Schema.Json): Schema.Json {
  if (pointer === "") return val

  const tokens = tokenize(pointer)
  const parentPath = "/" + tokens.slice(0, -1).map(escapeToken).join("/")
  const lastToken = tokens[tokens.length - 1]
  const parent = getAt(doc, parentPath === "/" ? "" : parentPath)

  if (Array.isArray(parent)) {
    const idx = lastToken === "-" ? parent.length : toIndex(lastToken)
    if (idx < 0 || idx > parent.length) throw new Error(`Array index out of bounds at "${pointer}".`)
    const updated = parent.slice()
    updated.splice(idx, 0, val)
    return setParent(doc, parentPath, updated)
  }

  if (parent && isJsonObject(parent)) {
    const updated = { ...parent }
    updated[lastToken] = val
    return setParent(doc, parentPath, updated)
  }

  throw new Error(`Cannot add at "${pointer}" (parent not found or not a container).`)
}

/**
 * Apply a `replace` or `remove` at `pointer`.
 *
 * - Requires the target to exist.
 * - For arrays, `-` is not valid (only concrete indices).
 * - Root remove is not supported.
 */
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

  const tokens = tokenize(pointer)
  const parentPath = "/" + tokens.slice(0, -1).map(escapeToken).join("/")
  const lastToken = tokens[tokens.length - 1]
  const parent = getAt(doc, parentPath === "/" ? "" : parentPath)

  if (Array.isArray(parent)) {
    if (lastToken === "-") throw new Error(`"-" is not valid for ${mode} at "${pointer}".`)
    const idx = toIndex(lastToken)
    if (idx < 0 || idx >= parent.length) throw new Error(`Array index out of bounds at "${pointer}".`)
    const updated = parent.slice()
    if (mode === "remove") updated.splice(idx, 1)
    else updated[idx] = val
    return setParent(doc, parentPath, updated)
  }

  // On objects, "-" is just a normal property name.
  if (parent && isJsonObject(parent)) {
    if (!Object.hasOwn(parent, lastToken)) {
      throw new Error(`Property "${lastToken}" does not exist at "${pointer}".`)
    }
    const updated = { ...parent }
    if (mode === "remove") delete updated[lastToken]
    else updated[lastToken] = val!
    return setParent(doc, parentPath, updated)
  }

  throw new Error(`Cannot ${mode} at "${pointer}" (parent not found or not a container).`)
}

/**
 * Immutably write `newParent` back into the document at `parentPointer`.
 *
 * This is the only “rebuild” step: it records the path containers while
 * traversing, then recreates them from the bottom up.
 */
function setParent(doc: Schema.Json, parentPointer: string, newParent: Schema.Json): Schema.Json {
  if (parentPointer === "" || parentPointer === "/") return newParent

  const tokens = tokenize(parentPointer)
  const stack: Array<{ container: unknown; token: number | string }> = []
  let cur: unknown = doc

  for (const token of tokens) {
    if (Array.isArray(cur)) {
      const idx = toIndex(token)
      if (idx < 0 || idx >= cur.length) {
        throw new Error(`Array index out of bounds while writing at "${parentPointer}".`)
      }
      stack.push({ container: cur, token: idx })
      cur = cur[idx]
    } else if (cur && typeof cur === "object") {
      if (!Object.hasOwn(cur, token)) {
        throw new Error(`Key ${token} not found while writing at "${parentPointer}".`)
      }
      stack.push({ container: cur, token })
      cur = (cur as any)[token]
    } else {
      throw new Error(`Cannot traverse non-container at "${parentPointer}".`)
    }
  }

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
