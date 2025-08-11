import * as Predicate from "../../data/Predicate.ts"
import type { Pipeable } from "../../interfaces/Pipeable.ts"
import { pipeArguments } from "../../interfaces/Pipeable.ts"
import type * as Annotations from "../../schema/Annotations.ts"
import type * as AST from "../../schema/AST.ts"

/**
 * JavaScript does not store the insertion order of properties in a way that
 * combines both string and symbol keys. The internal order groups string keys
 * and symbol keys separately. Hence concatenating the keys is fine.
 *
 * @internal
 */
export function ownKeys(o: object): Array<PropertyKey> {
  const keys: Array<PropertyKey> = Object.keys(o)
  const symbols: Array<PropertyKey> = Object.getOwnPropertySymbols(o)
  return symbols.length > 0 ? [...keys, ...symbols] : keys
}

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

/** @internal */
export function formatDate(date: Date): string {
  try {
    return date.toISOString()
  } catch {
    return String(date)
  }
}

/** @internal */
export function formatUnknown(u: unknown, checkCircular: boolean = true): string {
  if (Array.isArray(u)) {
    return `[${u.map((i) => formatUnknown(i, checkCircular)).join(",")}]`
  }
  if (Predicate.isDate(u)) {
    return formatDate(u)
  }
  if (
    Predicate.hasProperty(u, "toString")
    && Predicate.isFunction(u["toString"])
    && u["toString"] !== Object.prototype.toString
  ) {
    return u["toString"]()
  }
  if (Predicate.isString(u)) {
    return JSON.stringify(u)
  }
  if (
    Predicate.isNumber(u)
    || u == null
    || Predicate.isBoolean(u)
    || Predicate.isSymbol(u)
  ) {
    return String(u)
  }
  if (Predicate.isBigInt(u)) {
    return String(u) + "n"
  }
  if (Predicate.isIterable(u)) {
    return `${u.constructor.name}(${formatUnknown(Array.from(u), checkCircular)})`
  }
  try {
    if (checkCircular) {
      JSON.stringify(u) // check for circular references
    }
    const pojo = `{${
      ownKeys(u).map((k) =>
        `${Predicate.isString(k) ? JSON.stringify(k) : String(k)}:${formatUnknown((u as any)[k], false)}`
      )
        .join(",")
    }}`
    const name = u.constructor.name
    return u.constructor !== Object.prototype.constructor ? `${name}(${pojo})` : pojo
  } catch {
    return "<circular structure>"
  }
}

/** @internal */
export function formatPropertyKey(name: PropertyKey): string {
  return typeof name === "string" ? JSON.stringify(name) : String(name)
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
export function hasOwn<O extends object, Key extends PropertyKey>(
  o: O,
  k: Key
): o is O & { [K in Key]: unknown } {
  return Object.hasOwn(o, k)
}

/** @internal */
export const defaultParseOptions: AST.ParseOptions = {}

/**
 * Merges annotations while preserving getters from both objects
 *
 * @internal
 */
export function mergeAnnotations(
  existing: Annotations.Annotations | undefined,
  incoming: Annotations.Annotations
): Annotations.Annotations {
  if (!existing) return incoming
  const result = {}

  // Apply existing descriptors first
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(existing))) {
    Object.defineProperty(result, key, descriptor)
  }

  // Apply incoming descriptors (this will override existing ones)
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(incoming))) {
    Object.defineProperty(result, key, descriptor)
  }

  return result
}
