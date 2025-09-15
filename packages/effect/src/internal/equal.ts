/** @internal */
export const getAllObjectKeys = (obj: object): Set<PropertyKey> => {
  const keys = new Set<PropertyKey>(Reflect.ownKeys(obj))
  if (obj.constructor === Object) return keys

  if (obj instanceof Error) {
    keys.delete("stack")
  }

  const proto = Object.getPrototypeOf(obj)
  let current = proto
  let objConstructor: Function | undefined

  while (current !== null && current !== Object.prototype) {
    const ownKeys = Reflect.ownKeys(current)
    for (let i = 0; i < ownKeys.length; i++) {
      const key = ownKeys[i]
      if (key === "constructor") {
        objConstructor ??= typeof obj.constructor === "function" && proto === obj.constructor.prototype
          ? obj.constructor
          : undefined
        if (current.constructor === objConstructor) continue
      }
      keys.add(key)
    }

    current = Object.getPrototypeOf(current)
  }

  return keys
}

/** @internal */
export const byReferenceInstances = new WeakSet<object>()
