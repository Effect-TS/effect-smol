/** @internal */
export const isPlainObject = (obj: unknown): obj is Record<string, unknown> => {
  if (obj === null || typeof obj !== "object") {
    return false
  }
  // Check if it's a plain object (constructor is Object or no constructor)
  const proto = Object.getPrototypeOf(obj)
  return proto === Object.prototype || proto === null
}

/** @internal */
export const instanceEqualityRegistry = new WeakMap<object | Function, true>()
