/** @internal */
export const getAllObjectKeys = (obj: object): Set<PropertyKey> => {
  const keys = new Set<PropertyKey>()
  let current = obj

  while (current !== null && current !== Object.prototype) {
    const ownKeys = Reflect.ownKeys(current)
    for (const key of ownKeys) {
      // Skip constructor property only when it's the default constructor reference
      // Include it when it's a user-defined property with a different value
      if (key === "constructor") {
        const descriptor = Object.getOwnPropertyDescriptor(current, key)
        if (descriptor) {
          if (current === obj) {
            // For the object itself, include constructor if it has been explicitly set to a different value
            // Skip it if it's the default constructor reference
            const proto = Object.getPrototypeOf(obj)
            const expectedConstructor = proto?.constructor
            if (descriptor.value !== expectedConstructor) {
              keys.add(key)
            }
          } else {
            // For prototype chain, include constructor if it's a meaningful user-defined value
            // Skip it only if it's the natural constructor for this prototype
            // (i.e., the constructor property points to the function AND that function's prototype is this object)
            const isNaturalConstructor = typeof descriptor.value === "function" &&
              descriptor.value.prototype === current
            if (!isNaturalConstructor) {
              keys.add(key)
            }
          }
        }
        continue
      }

      keys.add(key)
    }

    if (obj instanceof Error) {
      keys.delete("stack")
    }

    current = Object.getPrototypeOf(current)
  }

  return keys
}

/** @internal */
export const byReferenceInstances = new WeakSet<object>()
