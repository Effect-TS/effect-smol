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

/**
 * Formats an unknown value to a string.
 *
 * This function is used to format values for display in the terminal. It
 * handles various types of values, including dates, circular references, and
 * custom objects.
 *
 * @internal
 */
export function formatUnknown(input: unknown): string {
  const seen = new WeakSet<object>()

  function safeToString(x: any): string {
    try {
      const s = x.toString()
      return Predicate.isString(s) ? s : String(s)
    } catch {
      return "[toString threw]"
    }
  }

  const CIRCULAR = "[Circular]"

  function go(input: unknown): string {
    if (Array.isArray(input)) {
      if (seen.has(input)) return CIRCULAR
      seen.add(input)
      return `[${input.map(go).join(",")}]`
    }

    if (Predicate.isDate(input)) return formatDate(input)

    if (
      Predicate.hasProperty(input, "toString")
      && Predicate.isFunction(input["toString"])
      && input["toString"] !== Object.prototype.toString
    ) {
      return safeToString(input)
    }

    if (Predicate.isString(input)) return JSON.stringify(input)

    if (
      Predicate.isNumber(input)
      || input == null // null and undefined
      || Predicate.isBoolean(input)
      || Predicate.isSymbol(input)
    ) {
      return String(input)
    }

    if (Predicate.isBigInt(input)) return String(input) + "n"

    if (input instanceof Set || input instanceof Map) {
      seen.add(input)
      return `${input.constructor.name}(${go(Array.from(input))})`
    }
    if (Predicate.isObject(input)) {
      if (seen.has(input)) return CIRCULAR
      seen.add(input)
      const object = `{${
        Reflect.ownKeys(input).map((k) => `${formatPropertyKey(k)}:${go((input as any)[k])}`)
          .join(",")
      }}`
      if (input.constructor != null && input.constructor !== Object.prototype.constructor) {
        const name = input.constructor.name
        if (name && name !== "") {
          return `${name}(${object})`
        }
      }
      return object
    }
    return String(input)
  }
  return go(input)
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
