/** @internal */
export const getAllObjectKeys = (obj: object): ReadonlyArray<PropertyKey> => {
  const keys = Reflect.ownKeys(obj)
  let current = Object.getPrototypeOf(obj)
  if (current === Object.prototype || current === null) {
    // Fast path for plain objects
    return keys
  }
  if (obj instanceof Error) {
    const index = keys.indexOf("stack")
    if (index !== -1) {
      keys.splice(index, 1)
    }
  }

  while (current !== null && current !== Object.prototype) {
    const ownKeys = Reflect.ownKeys(current)
    const proto = Object.getPrototypeOf(current)
    for (let i = 0; i < ownKeys.length; i++) {
      const key = ownKeys[i]
      // Skip constructor property only when it's the default constructor reference
      // Include it when it's a user-defined property with a different value
      if (key === "constructor" && typeof current["constructor"] === "function") {
        // Check if this is the object's own constructor property
        const descriptor = Object.getOwnPropertyDescriptor(current, key)
        if (descriptor && current === obj) {
          // For the object itself, include constructor if it has been explicitly set to a different value
          // Skip it if it's the default constructor reference
          const proto = Object.getPrototypeOf(obj)
          const expectedConstructor = proto?.constructor
          if (descriptor.value !== expectedConstructor) {
            keys.push(key)
          }
        }
        continue
      }
      if (!keys.includes(key)) {
        keys.push(key)
      }
    }
    current = proto
  }

  return keys
}
