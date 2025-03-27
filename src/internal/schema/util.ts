import * as Predicate from "../../Predicate.js"
import type * as SchemaAST from "../../SchemaAST.js"
/**
 * JavaScript does not store the insertion order of properties in a way that
 * combines both string and symbol keys. The internal order groups string keys
 * and symbol keys separately. Hence concatenating the keys is fine.
 *
 * @internal
 */
export const ownKeys = (o: object): Array<PropertyKey> =>
  (Object.keys(o) as Array<PropertyKey>).concat(Object.getOwnPropertySymbols(o))

/** @internal */
export const memoizeThunk = <A>(f: () => A): () => A => {
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
export const formatDate = (date: Date): string => {
  try {
    return date.toISOString()
  } catch {
    return String(date)
  }
}

/** @internal */
export const formatUnknown = (u: unknown, checkCircular: boolean = true): string => {
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
export const formatPropertyKey = (name: PropertyKey): string =>
  typeof name === "string" ? JSON.stringify(name) : String(name)

/** @internal */
export const formatPathKey = (key: PropertyKey): string => `[${formatPropertyKey(key)}]`

/** @internal */
export const formatPath = (path: SchemaAST.PropertyKeyPath): string => path.map(formatPathKey).join("")
