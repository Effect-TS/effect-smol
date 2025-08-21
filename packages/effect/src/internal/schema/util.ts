import * as Predicate from "../../data/Predicate.ts"
import type { Pipeable } from "../../interfaces/Pipeable.ts"
import { pipeArguments } from "../../interfaces/Pipeable.ts"
import type * as AST from "../../schema/AST.ts"

/** @internal */
export function memoizeThunk<A>(f: () => A): () => A {
  let done = false
  let a: A
  return () => {
    if (done) {
      return a
    }
    a = f()
    done = true
    return a
  }
}

function formatDate(date: Date): string {
  try {
    return date.toISOString()
  } catch {
    return String(date)
  }
}

const CIRCULAR = "[Circular]"

/**
 * Converts any JavaScript value into a human-readable string.
 *
 * Unlike `JSON.stringify`, this formatter:
 * - Handles circular references (printed as `"[Circular]"`).
 * - Supports additional types like `BigInt`, `Symbol`, `Set`, `Map`, `Date`, `RegExp`, and
 *   objects with custom `toString` methods.
 * - Includes constructor names for class instances (e.g. `MyClass({"a":1})`).
 * - Does not guarantee valid JSON output — the result is intended for debugging and inspection.
 *
 * Formatting rules:
 * - Primitives are stringified naturally (`null`, `undefined`, `123`, `"abc"`, `true`).
 * - Strings are JSON-quoted.
 * - Arrays and objects with a single element/property are formatted inline.
 * - Larger arrays/objects are pretty-printed with optional indentation.
 * - Circular references are replaced with the literal `"[Circular]"`.
 *
 * @param input - The value to format.
 * @param whitespace - Indentation used when pretty-printing:
 *   - If a number, that many spaces will be used.
 *   - If a string, the string is used as the indentation unit (e.g. `"\t"`).
 *   - If `0`, empty string, or `undefined`, output is compact (no indentation).
 *   Defaults to `0`.
 *
 * @internal
 */
export function formatUnknown(input: unknown, whitespace: number | string | undefined = 0): string {
  const seen = new WeakSet<object>()
  const gap = !whitespace ? "" : (typeof whitespace === "number" ? " ".repeat(whitespace) : whitespace)
  const ind = (d: number) => gap.repeat(d)

  const safeToString = (x: any): string => {
    try {
      const s = x.toString()
      return typeof s === "string" ? s : String(s)
    } catch {
      return "[toString threw]"
    }
  }

  const wrap = (v: unknown, body: string): string => {
    const ctor = (v as any)?.constructor
    return ctor && ctor !== Object.prototype.constructor && ctor.name ? `${ctor.name}(${body})` : body
  }

  const ownKeys = (o: object): Array<PropertyKey> => {
    try {
      return Reflect.ownKeys(o)
    } catch {
      return ["[ownKeys threw]"]
    }
  }

  function go(v: unknown, d = 0): string {
    if (Array.isArray(v)) {
      if (seen.has(v)) return CIRCULAR
      seen.add(v)
      if (!gap || v.length <= 1) return `[${v.map((x) => go(x, d)).join(",")}]`
      const inner = v.map((x) => go(x, d + 1)).join(",\n" + ind(d + 1))
      return `[\n${ind(d + 1)}${inner}\n${ind(d)}]`
    }

    if (Predicate.isDate(v)) return formatDate(v)

    if (
      Predicate.hasProperty(v, "toString") &&
      Predicate.isFunction((v as any)["toString"]) &&
      (v as any)["toString"] !== Object.prototype.toString
    ) return safeToString(v)

    if (Predicate.isString(v)) return JSON.stringify(v)

    if (
      Predicate.isNumber(v) ||
      v == null ||
      Predicate.isBoolean(v) ||
      Predicate.isSymbol(v)
    ) return String(v)

    if (Predicate.isBigInt(v)) return String(v) + "n"

    if (v instanceof Set || v instanceof Map) {
      if (seen.has(v)) return CIRCULAR
      seen.add(v)
      return `${v.constructor.name}(${go(Array.from(v), d)})`
    }

    if (Predicate.isObject(v)) {
      if (seen.has(v)) return CIRCULAR
      seen.add(v)
      const keys = ownKeys(v)
      if (!gap || keys.length <= 1) {
        const body = `{${keys.map((k) => `${formatPropertyKey(k)}:${go((v as any)[k], d)}`).join(",")}}`
        return wrap(v, body)
      }
      const body = `{\n${
        keys.map((k) => `${ind(d + 1)}${formatPropertyKey(k)}: ${go((v as any)[k], d + 1)}`).join(",\n")
      }\n${ind(d)}}`
      return wrap(v, body)
    }

    return String(v)
  }

  return go(input, 0)
}

/** @internal */
export function formatPropertyKey(name: PropertyKey): string {
  return Predicate.isString(name) ? JSON.stringify(name) : String(name)
}

/** @internal */
export function formatPath(path: ReadonlyArray<PropertyKey>): string {
  return path.map((key) => `[${formatPropertyKey(key)}]`).join("")
}

// TODO: replace with v3 implementation
/** @internal */
export const PipeableClass: new() => Pipeable = class {
  pipe() {
    return pipeArguments(this, arguments)
  }
}
/** @internal */
export const defaultParseOptions: AST.ParseOptions = {}
