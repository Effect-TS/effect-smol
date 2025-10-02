export const symbol = "~effect/interfaces/Clonable"

export interface Clonable {
  [symbol]<T extends object>(this: T, patch?: T extends T ? Partial<T> : T): T
}

export const isClonable = (u: unknown): u is Clonable => {
  return typeof u === "object" && u != null && symbol in u
}

export const cloneArray = <T>(arr: Array<T>): Array<T> => {
  return arr.map(clone)
}

export const cloneSet = <T>(set: Set<T>): Set<T> => {
  const result = new Set<T>()
  for (const item of set) {
    result.add(clone(item))
  }
  return result
}

export const cloneMap = <K, V>(map: Map<K, V>): Map<K, V> => {
  const result = new Map<K, V>()
  for (const [key, value] of map) {
    result.set(clone(key), clone(value))
  }
  return result
}

export const cloneObject = <T extends Record<string, any>>(obj: T): T => {
  const result: any = {}
  for (const [k, v] of Object.entries(obj)) {
    result[k] = clone(v)
  }
  return result
}

export const clone = <T>(obj: T): T => {
  const objType = typeof obj
  switch (objType) {
    case "bigint":
    case "boolean":
    case "number":
    case "string":
    case "undefined":
    case "function": // !
      return obj
    case "symbol": {
      return structuredClone(obj)
    }
    case "object": {
      if (obj === null) {
        return obj
      } else if (isClonable(obj)) {
        return obj[symbol]()
      } else if (Array.isArray(obj)) {
        return obj.map(clone) as unknown as T
      } else if (Object.getPrototypeOf(obj) === Object.prototype) {
        return cloneObject(obj as Record<string, unknown>) as unknown as T
      } else if (obj instanceof Set) {
        return cloneSet(obj) as unknown as T
      } else if (obj instanceof Map) {
        return cloneMap(obj) as unknown as T
      } else if (obj instanceof URL) {
        return new URL(obj) as unknown as T
      } else {
        return structuredClone(obj)
      }
    }
  }
}
