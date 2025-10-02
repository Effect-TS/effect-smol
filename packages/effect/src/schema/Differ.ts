/**
 * @since 4.0.0
 */
import { memoize } from "../Function.ts"
import * as Optic from "../optic/Optic.ts"
import * as AST from "./AST.ts"
import * as Schema from "./Schema.ts"
import * as Serializer from "./Serializer.ts"
import * as ToParser from "./ToParser.ts"

/**
 * @since 4.0.0
 */
export interface Differ<in out Value, in out Patch> {
  readonly empty: Patch
  diff(oldValue: Value, newValue: Value): Patch
  combine(first: Patch, second: Patch): Patch
  patch(oldValue: Value, patch: Patch): Value
}

/**
 * RFC 6902 (subset) JSON Patch operations
 * Keeping only "add", "remove", "replace"
 *
 * @since 4.0.0
 */
export type JsonPatchOperation =
  | { op: "add"; path: string; value: unknown } // path may end with "-" to append to arrays
  | { op: "remove"; path: string }
  | { op: "replace"; path: string; value: unknown }

/**
 * A JSON Patch document is an array of operations
 *
 * @since 4.0.0
 */
export type JsonPatchDocument = ReadonlyArray<JsonPatchOperation>

/**
 * @since 4.0.0
 */
export function jsonPatch<S extends Schema.Top>(schema: S): Differ<S["Type"], JsonPatchDocument> {
  const serializer = Serializer.json(Schema.typeCodec(schema))
  const iso = Optic.makeIso(ToParser.encodeSync(serializer), ToParser.decodeSync(serializer))
  const diff = goDiff(AST.encodedAST(serializer.ast))
  return {
    empty: [],
    diff: (v1, v2) => diff(iso.get(v1), iso.get(v2)),
    combine: (first, second) => [...first, ...second],
    patch: (oldValue, patch) => {
      const get = iso.get(oldValue)
      const patched = applyJsonPatchDocument(patch, get)
      return Object.is(patched, get) ? oldValue : iso.set(patched)
    }
  }
}

const goDiff = memoize((ast: AST.AST): (v1: any, v2: any) => JsonPatchDocument => {
  switch (ast._tag) {
    case "NullKeyword":
      return () => []
    case "StringKeyword":
    case "NumberKeyword":
    case "BooleanKeyword":
    case "LiteralType":
    case "Enums":
    case "TemplateLiteral":
      return (v1, v2) => Object.is(v1, v2) ? [] : [{ op: "replace", path: "", value: v2 }]
    case "Suspend":
      return goDiff(ast.thunk())
    case "TupleType": {
      const elements = ast.elements.map(goDiff)
      const rest = ast.rest.map(goDiff)
      return (v1, v2) => {
        const patches: Array<JsonPatchOperation> = []
        let i = 0
        // ---------------------------------------------
        // handle elements
        // ---------------------------------------------
        for (; i < elements.length; i++) {
          const path = `/${i}`
          const elementDiff = elements[i](v1[i], v2[i])
          for (const patch of elementDiff) {
            patch.path = patch.path === "" ? path : `${path}${patch.path}`
            patches.push(patch)
          }
        }
        // ---------------------------------------------
        // handle rest element
        // ---------------------------------------------
        const len1 = v1.length
        const len2 = v2.length
        if (rest.length > 0) {
          const [head, ...tail] = rest
          for (; i < len1 - tail.length; i++) {
            const path = `/${i}`
            if (i < len2) {
              const patch = head(v1[i], v2[i])
              for (const op of patch) {
                op.path = op.path === "" ? path : `${path}${op.path}`
                patches.push(op)
              }
            } else {
              patches.push({ op: "remove", path })
            }
          }
          // ---------------------------------------------
          // handle post rest elements
          // ---------------------------------------------
          for (let j = 0; j < tail.length; j++) {
            i += j
            const path = `/${i}`
            if (i < len2) {
              const patch = tail[j](v1[i], v2[i])
              for (const op of patch) {
                op.path = op.path === "" ? path : `${path}${op.path}`
                patches.push(op)
              }
            } else {
              patches.push({ op: "remove", path })
            }
          }
        }
        if (len1 < len2) {
          for (let j = len1; j < len2; j++) {
            patches.push({ op: "add", path: `/${j}`, value: v2[j] })
          }
        }

        return patches
      }
    }
    case "TypeLiteral": {
      // ---------------------------------------------
      // handle empty struct
      // ---------------------------------------------
      if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
        throw new Error("empty structs are not supported")
      }
      const propertySignatures = ast.propertySignatures.map((ps) => [ps.name, goDiff(ps.type)] as const)
      const indexSignatures = ast.indexSignatures.map((is) => [is.parameter, goDiff(is.type)] as const)
      return (v1, v2) => {
        const patches: Array<JsonPatchOperation> = []

        // ---------------------------------------------
        // handle property signatures
        // ---------------------------------------------
        for (const [name, diff] of propertySignatures) {
          const key = String(name)
          const path = `/${escapeToken(key)}`
          const newVal = v2[key]

          if (!Object.hasOwn(v1, key)) {
            patches.push({ op: "add", path, value: newVal })
          } else if (!Object.hasOwn(v2, key)) {
            patches.push({ op: "remove", path })
          } else {
            const patch = diff(v1[key], newVal)
            for (const op of patch) {
              op.path = op.path === "" ? path : `${path}${op.path}`
              patches.push(op)
            }
          }
        }

        // ---------------------------------------------
        // handle index signatures
        // ---------------------------------------------
        if (indexSignatures.length > 0) {
          for (const [parameter, diff] of indexSignatures) {
            const keys = AST.getIndexSignatureKeys(v1, parameter)
            for (let j = 0; j < keys.length; j++) {
              const key = String(keys[j])
              const path = `/${escapeToken(key)}`
              const newVal = v2[key]
              if (!Object.hasOwn(v2, key)) {
                patches.push({ op: "remove", path })
              } else {
                const patch = diff(v1[key], newVal)
                for (const op of patch) {
                  op.path = op.path === "" ? path : `${path}${op.path}`
                  patches.push(op)
                }
              }
            }
          }
          for (const key of Object.keys(v2)) {
            if (!Object.hasOwn(v1, key)) {
              patches.push({ op: "add", path: `/${escapeToken(key)}`, value: v2[key] })
            }
          }
        }

        return patches
      }
    }
    case "UnionType":
      return (v1, v2) => {
        const candidates = AST.getCandidates(v1, ast.types)
        const types = candidates.map(ToParser.refinement)
        for (let i = 0; i < candidates.length; i++) {
          const is = types[i]
          if (is(v1) && is(v2)) {
            return goDiff(candidates[i])(v1, v2)
          }
        }
        return [{ op: "replace", path: "", value: v2 }]
      }
    default:
      throw new Error(`BUG: unsupported AST: ${ast._tag}`)
  }
})

/**
 * @since 4.0.0
 */
export function applyJsonPatchDocument(patch: JsonPatchDocument, json: unknown): unknown {
  let doc = json

  for (const op of patch) {
    switch (op.op) {
      case "add": {
        doc = addAt(doc, op.path, op.value)
        break
      }
      case "remove": {
        doc = setAt(doc, op.path, undefined, "remove")
        break
      }
      case "replace": {
        if (op.path === "") return op.value
        doc = setAt(doc, op.path, op.value, "replace")
        break
      }
    }
  }

  return doc
}

function cloneDeep<T>(x: T): T {
  if (Array.isArray(x)) return x.map((v) => cloneDeep(v)) as T
  if (typeof x === "object" && x !== null) {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(x)) out[k] = cloneDeep((x as any)[k])
    return out as T
  }
  return x
}

/** RFC 6901 tokenizer ("" is root). Supports ~0 -> ~ and ~1 -> / */
function tokenize(pointer: string): Array<string> {
  if (pointer === "") return []
  return pointer
    .split("/")
    .slice(1)
    .map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"))
}

/** Read value at pointer or throw if not found */
function getAt(doc: unknown, pointer: string): unknown {
  if (pointer === "") return doc
  const tokens = tokenize(pointer)
  let cur: any = doc

  for (const token of tokens) {
    if (Array.isArray(cur)) {
      const idx = Number(token)
      cur = cur[idx]
    } else {
      cur = cur[token]
    }
  }
  return cur
}

/** Add: on root replaces whole doc; on arrays inserts (supports "-" to append); on objects sets/creates a member */
function addAt(doc: unknown, pointer: string, val: unknown): unknown {
  if (pointer === "") {
    return cloneDeep(val)
  }

  const tokens = tokenize(pointer)
  const parentPath = "/" + tokens.slice(0, -1).map(escapeToken).join("/")
  const lastToken = tokens[tokens.length - 1]
  const parent = getAt(doc, parentPath === "/" ? "" : parentPath)

  if (Array.isArray(parent)) {
    const idx = lastToken === "-" ? parent.length : Number(lastToken)
    const updated = parent.slice()
    updated.splice(idx, 0, cloneDeep(val))
    return setParent(doc, parentPath, updated)
  } else {
    const updated = { ...(parent as Record<string, unknown>) }
    updated[lastToken] = cloneDeep(val)
    return setParent(doc, parentPath, updated)
  }
}

/** Unified writer for "replace" and "remove" */
function setAt(doc: unknown, pointer: string, val: unknown, mode: "replace" | "remove"): unknown {
  if (pointer === "") {
    return cloneDeep(val)
  }

  const tokens = tokenize(pointer)
  const parentPath = "/" + tokens.slice(0, -1).map(escapeToken).join("/")
  const lastToken = tokens[tokens.length - 1]
  const parent = getAt(doc, parentPath === "/" ? "" : parentPath)

  if (Array.isArray(parent)) {
    const idx = Number(lastToken)
    const updated = parent.slice()
    if (mode === "remove") {
      updated.splice(idx, 1)
    } else {
      updated[idx] = cloneDeep(val)
    }
    return setParent(doc, parentPath, updated)
  } else {
    const updated = { ...(parent as Record<string, unknown>) }
    if (mode === "remove") {
      delete updated[lastToken]
    } else {
      updated[lastToken] = cloneDeep(val)
    }
    return setParent(doc, parentPath, updated)
  }
}

/** Immutably write an updated parent back into the document */
function setParent(doc: unknown, parentPointer: string, newParent: unknown): unknown {
  if (parentPointer === "" || parentPointer === "/") return newParent

  const tokens = tokenize(parentPointer)
  const stack: Array<{ container: unknown; token: number | string }> = []
  let cur: unknown = doc

  for (const token of tokens) {
    if (Array.isArray(cur)) {
      const idx = Number(token)
      stack.push({ container: cur, token: idx })
      cur = cur[idx]
    } else {
      stack.push({ container: cur, token })
      cur = (cur as Record<string, unknown>)[token]
    }
  }

  // Rebuild immutably up the stack
  let acc: unknown = newParent
  for (let i = stack.length - 1; i >= 0; i--) {
    const { container, token } = stack[i]
    if (Array.isArray(container)) {
      const copy = container.slice()
      copy[token as number] = acc
      acc = copy
    } else {
      const copy = { ...(container as Record<string, unknown>) }
      copy[token as string] = acc
      acc = copy
    }
  }
  return acc
}

/** Escape token when reconstructing a pointer fragment */
function escapeToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1")
}
