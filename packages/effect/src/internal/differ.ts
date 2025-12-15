import * as Predicate from "../data/Predicate.ts"
import type * as Schema from "../schema/Schema.ts"

// Mutates op.path in place for perf; safe because child ops are freshly created and not shared.
function prefixPathInPlace(op: Schema.JsonPatchOperation, parent: string): void {
  op.path = op.path === "" ? parent : parent + op.path
}

function isTreeRecord<A>(value: Schema.Tree<A>): value is Schema.TreeRecord<A> {
  return Predicate.isObject(value)
}

/** @internal */
export function getJsonPatch(oldValue: Schema.JsonValue, newValue: Schema.JsonValue): Schema.JsonPatch {
  if (Object.is(oldValue, newValue)) return []
  const patches: Array<Schema.JsonPatchOperation> = []
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    const len1 = oldValue.length
    const len2 = newValue.length

    // Handle array elements that exist in both arrays
    const shared = Math.min(len1, len2)
    for (let i = 0; i < shared; i++) {
      const path = `/${i}`
      const patch = getJsonPatch(oldValue[i], newValue[i])
      for (const op of patch) {
        prefixPathInPlace(op, path)
        patches.push(op)
      }
    }

    // Handle array elements that need to be removed
    // Remove from end to start so later indices do not shift.
    for (let i = len1 - 1; i >= len2; i--) {
      patches.push({ op: "remove", path: `/${i}` })
    }

    // Handle array elements that need to be added (from beginning to end)
    for (let i = len1; i < len2; i++) {
      patches.push({ op: "add", path: `/${i}`, value: newValue[i] })
    }
  } else if (isTreeRecord(oldValue) && isTreeRecord(newValue)) {
    // Get all keys from both objects
    const keys1 = Object.keys(oldValue)
    const keys2 = Object.keys(newValue)
    const allKeys = Array.from(new Set([...keys1, ...keys2])).sort() // <-- stable

    for (const key of allKeys) {
      const esc = escapeToken(key)
      const path = `/${esc}`
      const hasKey1 = Object.hasOwn(oldValue, key)
      const hasKey2 = Object.hasOwn(newValue, key)

      if (hasKey1 && hasKey2) {
        // Both objects have the key, recursively compare values
        const patch = getJsonPatch(oldValue[key], newValue[key])
        for (const op of patch) {
          prefixPathInPlace(op, path)
          patches.push(op)
        }
      } else if (!hasKey1 && hasKey2) {
        // Key exists only in v2, add it
        patches.push({ op: "add", path, value: newValue[key] })
      } else if (hasKey1 && !hasKey2) {
        // Key exists only in v1, remove it
        patches.push({ op: "remove", path })
      }
    }
  } else {
    patches.push({ op: "replace", path: "", value: newValue })
  }
  return patches
}

/** @internal */
export function applyJsonPatch(patch: Schema.JsonPatch, oldValue: Schema.JsonValue): Schema.JsonValue {
  let doc = oldValue

  for (const op of patch) {
    switch (op.op) {
      case "replace": {
        if (op.path === "") return op.value // root replace: write as-is
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

// RFC 6901 tokenizer ("" is root). Supports ~0 -> ~ and ~1 -> /
function tokenize(pointer: string): Array<string> {
  if (pointer === "") return []
  if (pointer.charCodeAt(0) !== 47 /* "/" */) {
    throw new Error(`Invalid JSON Pointer, it must start with "/": "${pointer}"`)
  }
  return pointer
    .split("/")
    .slice(1)
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"))
}

// Convert token to a non-negative integer index; throws on invalid
function toIndex(token: string): number {
  if (!/^(0|[1-9]\d*)$/.test(token)) {
    throw new Error(`Invalid array index: "${token}"`)
  }
  return Number(token)
}

// Read value at pointer ("" is root). Returns undefined if path walks into undefined.
function getAt(doc: Schema.JsonValue, pointer: string): Schema.JsonValue | undefined {
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

// "add" may create a missing member; for arrays supports "-" to append. Throws
// if parent is not a container or (array) index is out of bounds.
function addAt(doc: Schema.JsonValue, pointer: string, val: Schema.JsonValue): Schema.JsonValue {
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

  if (parent && typeof parent === "object") {
    const updated = { ...(parent as Schema.JsonObject) }
    updated[lastToken] = val
    return setParent(doc, parentPath, updated)
  }

  throw new Error(`Cannot add at "${pointer}" (parent not found or not a container).`)
}

// "replace" and "remove" require the target to exist (RFC 6902). "-" is not
// valid here; only concrete array indices are accepted. Removing the root ("")
// is not supported; root replace returns provided value as-is.
function setAt(
  doc: Schema.JsonValue,
  pointer: string,
  val: Schema.JsonValue | undefined,
  mode: "replace" | "remove"
): Schema.JsonValue {
  if (pointer === "") {
    if (mode === "remove" || val === undefined) throw new Error("Unsupported operation at the root")
    return val
  }

  const tokens = tokenize(pointer)
  const parentPath = "/" + tokens.slice(0, -1).map(escapeToken).join("/")
  const lastToken = tokens[tokens.length - 1]
  const parent = getAt(doc, parentPath === "/" ? "" : parentPath)

  if (Array.isArray(parent)) {
    // Here, "-" is NOT allowed: remove/replace need a concrete numeric index
    if (lastToken === "-") throw new Error(`"-" is not valid for ${mode} at "${pointer}".`)
    const idx = toIndex(lastToken)
    if (idx < 0 || idx >= parent.length) throw new Error(`Array index out of bounds at "${pointer}".`)
    const updated = parent.slice()
    if (mode === "remove") updated.splice(idx, 1)
    else updated[idx] = val
    return setParent(doc, parentPath, updated)
  }

  // On objects, "-" is just a normal property name
  if (parent && typeof parent === "object") {
    if (!Object.hasOwn(parent as object, lastToken)) {
      throw new Error(`Property "${lastToken}" does not exist at "${pointer}".`)
    }
    const updated = { ...(parent as Schema.JsonObject) }
    if (mode === "remove") delete updated[lastToken]
    else updated[lastToken] = val!
    return setParent(doc, parentPath, updated)
  }

  throw new Error(`Cannot ${mode} at "${pointer}" (parent not found or not a container).`)
}

// Immutably write an updated parent back into the document. Throws if parent
// is not a container or index is out of bounds.
function setParent(doc: Schema.JsonValue, parentPointer: string, newParent: Schema.JsonValue): Schema.JsonValue {
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
      cur = (cur as Record<string, unknown>)[token]
    } else {
      throw new Error(`Cannot traverse non-container at "${parentPointer}".`)
    }
  }

  // rebuild unchanged
  let acc: Schema.JsonValue = newParent
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

// Escape token when reconstructing a pointer fragment
function escapeToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1")
}
