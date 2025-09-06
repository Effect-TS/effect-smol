/** @internal */
export const isPlainObject = (obj: unknown): obj is Record<string, unknown> => {
  if (obj === null || typeof obj !== "object") {
    return false
  }
  // Check if it's a plain object (constructor is Object or no constructor)
  const proto = Object.getPrototypeOf(obj)
  return proto === Object.prototype || proto === null
}

/**
 * Gets all own keys of an object by traversing the prototype chain.
 * Stops at Object.prototype to avoid including Object methods.
 * @internal
 */
export const getAllObjectKeys = (obj: object): ReadonlyArray<PropertyKey> => {
  const keys = new Set<PropertyKey>()
  let current = obj
  const isError = obj instanceof Error

  while (current !== null && current !== Object.prototype) {
    const ownKeys = Reflect.ownKeys(current)
    for (const key of ownKeys) {
      // Skip constructor property only when it's the default constructor reference
      // Include it when it's a user-defined property with a different value
      if (key === "constructor") {
        // Check if this is the object's own constructor property
        const descriptor = Object.getOwnPropertyDescriptor(current, key)
        if (descriptor && current === obj) {
          // For the object itself, include constructor if it has been explicitly set to a different value
          // Skip it if it's the default constructor reference
          const proto = Object.getPrototypeOf(obj)
          const expectedConstructor = proto?.constructor
          if (descriptor.value !== expectedConstructor) {
            keys.add(key)
          }
        }
        // Always skip constructor from prototype chain as it's not meaningful for structural comparison
        continue
      }

      // Skip stack property for Error objects as it's an implementation detail
      if (isError && key === "stack") {
        continue
      }

      keys.add(key)
    }
    current = Object.getPrototypeOf(current)
  }

  return Array.from(keys)
}

/**
 * Determines if an object should be compared structurally.
 * Returns true for any non-primitive object that isn't a built-in type
 * like Date, Map, Set, etc.
 * @internal
 */
export const isStructurallyComparable = (obj: unknown): obj is Record<PropertyKey, unknown> => {
  if (obj === null || typeof obj !== "object") {
    return false
  }

  // Exclude built-in objects that have their own comparison logic
  if (
    obj instanceof Date || obj instanceof Map || obj instanceof Set ||
    obj instanceof RegExp || Array.isArray(obj)
  ) {
    return false
  }

  // Include all other objects for structural comparison
  return true
}

/** @internal */
export const instanceEqualityRegistry = new WeakMap<object | Function, true>()
