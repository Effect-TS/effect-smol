/**
 * @since 4.0.0
 */
import * as Predicate from "./Predicate.ts"
import { getRedacted, redact, symbolRedactable } from "./Redactable.ts"

/**
 * @category Model
 * @since 4.0.0
 */
export interface Formatter<in Value, out Format = string> {
  (value: Value): Format
}

/**
 * Converts any JavaScript value into a human-readable string.
 *
 * For objects that don't have a `toString` method, it applies redaction to
 * protect sensitive information.
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
 * **Options**:
 * - `space`: Indentation used when pretty-printing:
 *   - If a number, that many spaces will be used.
 *   - If a string, the string is used as the indentation unit (e.g. `"\t"`).
 *   - If `0`, empty string, or `undefined`, output is compact (no indentation).
 *   Defaults to `0`.
 * - `ignoreToString`: If `true`, the `toString` method is not called on the value.
 *   Defaults to `false`.
 *
 * @since 4.0.0
 */
export function format(input: unknown, options?: {
  readonly space?: number | string | undefined
  readonly ignoreToString?: boolean | undefined
}): string {
  const space = options?.space ?? 0
  const seen = new WeakSet<object>()
  const gap = !space ? "" : (typeof space === "number" ? " ".repeat(space) : space)
  const ind = (d: number) => gap.repeat(d)

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

  function recur(v: unknown, d = 0): string {
    if (Array.isArray(v)) {
      if (seen.has(v)) return CIRCULAR
      seen.add(v)
      if (!gap || v.length <= 1) return `[${v.map((x) => recur(x, d)).join(",")}]`
      const inner = v.map((x) => recur(x, d + 1)).join(",\n" + ind(d + 1))
      return `[\n${ind(d + 1)}${inner}\n${ind(d)}]`
    }

    if (v instanceof Date) return formatDate(v)

    if (
      !options?.ignoreToString &&
      Predicate.hasProperty(v, "toString") &&
      typeof v["toString"] === "function" &&
      v["toString"] !== Object.prototype.toString &&
      v["toString"] !== Array.prototype.toString
    ) {
      const s = safeToString(v)
      if (v instanceof Error && v.cause) {
        return `${s} (cause: ${recur(v.cause, d)})`
      }
      return s
    }

    if (typeof v === "string") return JSON.stringify(v)

    if (
      typeof v === "number" ||
      v == null ||
      typeof v === "boolean" ||
      typeof v === "symbol"
    ) return String(v)

    if (typeof v === "bigint") return String(v) + "n"

    if (Predicate.isObject(v)) {
      if (seen.has(v)) return CIRCULAR
      seen.add(v)

      if (symbolRedactable in v) return format(getRedacted(v as any))

      if (Symbol.iterator in v) {
        return `${v.constructor.name}(${recur(Array.from(v as any), d)})`
      }

      const keys = ownKeys(v)
      if (!gap || keys.length <= 1) {
        const body = `{${keys.map((k) => `${formatPropertyKey(k)}:${recur((v as any)[k], d)}`).join(",")}}`
        return wrap(v, body)
      }
      const body = `{\n${
        keys.map((k) => `${ind(d + 1)}${formatPropertyKey(k)}: ${recur((v as any)[k], d + 1)}`).join(",\n")
      }\n${ind(d)}}`
      return wrap(v, body)
    }

    return String(v)
  }

  return recur(input, 0)
}

const CIRCULAR = "[Circular]"

/**
 * Fast path for formatting property keys.
 *
 * @internal
 */
export function formatPropertyKey(name: PropertyKey): string {
  return typeof name === "string" ? JSON.stringify(name) : String(name)
}

/**
 * Fast path for formatting property paths.
 *
 * @internal
 */
export function formatPath(path: ReadonlyArray<PropertyKey>): string {
  return path.map((key) => `[${formatPropertyKey(key)}]`).join("")
}

/**
 * Fast path for formatting dates.
 *
 * @internal
 */
export function formatDate(date: Date): string {
  try {
    return date.toISOString()
  } catch {
    return "Invalid Date"
  }
}

function safeToString(input: any): string {
  try {
    const s = input.toString()
    return typeof s === "string" ? s : String(s)
  } catch {
    return "[toString threw]"
  }
}

/**
 * Safely stringifies objects that may contain circular references.
 *
 * This function performs JSON.stringify with circular reference detection and handling.
 * It also applies redaction to sensitive values and provides a safe fallback for
 * any objects that can't be serialized normally.
 *
 * **Options**:
 * - `space`: Indentation used when pretty-printing:
 *   - If a number, that many spaces will be used.
 *   - If a string, the string is used as the indentation unit (e.g. `"\t"`).
 *   - If `0`, empty string, or `undefined`, output is compact (no indentation).
 *   Defaults to `0`.
 *
 * @example
 * ```ts
 * import { formatJson } from "effect/Formatter"
 *
 * // Normal object
 * const simple = { name: "Alice", age: 30 }
 * console.log(formatJson(simple))
 * // {"name":"Alice","age":30}
 *
 * // Object with circular reference
 * const circular: any = { name: "test" }
 * circular.self = circular
 * console.log(formatJson(circular))
 * // {"name":"test"} (circular reference omitted)
 *
 * // With formatting
 * console.log(formatJson(simple, { space: 2 }))
 * // {
 * //   "name": "Alice",
 * //   "age": 30
 * // }
 * ```
 *
 * @since 4.0.0
 */
export function formatJson(input: unknown, options?: {
  readonly space?: number | string | undefined
}): string {
  let cache: Array<unknown> = []
  const out = JSON.stringify(
    input,
    (_key, value) =>
      typeof value === "object" && value !== null
        ? cache.includes(value)
          ? undefined // circular reference
          : cache.push(value) && redact(value)
        : value,
    options?.space
  )
  ;(cache as any) = undefined
  return out
}
