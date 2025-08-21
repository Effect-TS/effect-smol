/**
 * This module provides utilities for making values inspectable and debuggable in TypeScript.
 *
 * The Inspectable interface provides a standard way to implement custom string representations
 * for objects, making them easier to debug and inspect. It includes support for JSON
 * serialization, Node.js inspection, and safe circular reference handling.
 *
 * The module also includes redaction capabilities for sensitive data, allowing objects
 * to provide different representations based on the current execution context.
 *
 * @example
 * ```ts
 * import { Inspectable } from "effect/interfaces"
 *
 * class User extends Inspectable.Class {
 *   constructor(
 *     public readonly name: string,
 *     public readonly email: string
 *   ) {
 *     super()
 *   }
 *
 *   toJSON() {
 *     return {
 *       _tag: "User",
 *       name: this.name,
 *       email: this.email
 *     }
 *   }
 * }
 *
 * const user = new User("Alice", "alice@example.com")
 * console.log(user.toString()) // Pretty printed JSON
 * console.log(Inspectable.format(user)) // Same as toString()
 * ```
 *
 * @since 2.0.0
 */
import { hasProperty, isFunction } from "../data/Predicate.ts"
import { pipeArguments } from "../interfaces/Pipeable.ts"
import { formatUnknown } from "../internal/schema/util.ts"
import type * as ServiceMap from "../ServiceMap.ts"

/**
 * Symbol used by Node.js for custom object inspection.
 *
 * This symbol is recognized by Node.js's `util.inspect()` function and the REPL
 * for custom object representation. When an object has a method with this symbol,
 * it will be called to determine how the object should be displayed.
 *
 * @example
 * ```ts
 * import { Inspectable } from "effect/interfaces"
 *
 * class CustomObject {
 *   constructor(private value: string) {}
 *
 *   [Inspectable.NodeInspectSymbol]() {
 *     return `CustomObject(${this.value})`
 *   }
 * }
 *
 * const obj = new CustomObject("hello")
 * console.log(obj) // Displays: CustomObject(hello)
 * ```
 *
 * @since 2.0.0
 * @category symbols
 */
export const NodeInspectSymbol = Symbol.for("nodejs.util.inspect.custom")

/**
 * The type of the Node.js inspection symbol used for custom object inspection.
 * This symbol type is used to implement custom inspection behavior in Node.js
 * environments.
 *
 * @example
 * ```ts
 * import { Inspectable } from "effect/interfaces"
 *
 * class CustomObject {
 *   constructor(private value: string) {}
 *
 *   [Inspectable.NodeInspectSymbol]() {
 *     return `CustomObject(${this.value})`
 *   }
 * }
 *
 * const obj = new CustomObject("test")
 * console.log(obj) // CustomObject(test)
 * ```
 *
 * @since 2.0.0
 * @category symbols
 */
export type NodeInspectSymbol = typeof NodeInspectSymbol

/**
 * Interface for objects that can be inspected and provide custom string representations.
 *
 * Objects implementing this interface can control how they appear in debugging contexts,
 * JSON serialization, and Node.js inspection. This is particularly useful for creating
 * custom data types that display meaningful information during development.
 *
 * @example
 * ```ts
 * import { Inspectable } from "effect/interfaces"
 *
 * class Result implements Inspectable.Inspectable {
 *   constructor(
 *     private readonly tag: "Success" | "Failure",
 *     private readonly value: unknown
 *   ) {}
 *
 *   toString(): string {
 *     return Inspectable.format(this.toJSON())
 *   }
 *
 *   toJSON() {
 *     return { _tag: this.tag, value: this.value }
 *   }
 *
 *   [Inspectable.NodeInspectSymbol]() {
 *     return this.toJSON()
 *   }
 * }
 *
 * const success = new Result("Success", 42)
 * console.log(success.toString()) // Pretty formatted JSON
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface Inspectable {
  toString(): string
  toJSON(): unknown
  [NodeInspectSymbol](): unknown
}

/**
 * Safely converts a value to a JSON-serializable representation.
 *
 * This function attempts to extract JSON data from objects that implement the
 * `toJSON` method, recursively processes arrays, and handles errors gracefully.
 * For objects that don't have a `toJSON` method, it applies redaction to
 * protect sensitive information.
 *
 * @example
 * ```ts
 * import { Inspectable } from "effect/interfaces"
 *
 * class Person {
 *   constructor(
 *     public name: string,
 *     public age: number
 *   ) {}
 *
 *   toJSON() {
 *     return { name: this.name, age: this.age }
 *   }
 * }
 *
 * const person = new Person("Alice", 30)
 * const data = Inspectable.toJSON(person)
 * console.log(data) // { name: "Alice", age: 30 }
 *
 * // Works with arrays
 * const people = [person, new Person("Bob", 25)]
 * const array = Inspectable.toJSON(people)
 * console.log(array) // [{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }]
 * ```
 *
 * @since 2.0.0
 * @category conversions
 */
export const toJSON = (x: unknown): unknown => {
  try {
    if (
      hasProperty(x, "toJSON") &&
      isFunction(x["toJSON"]) &&
      x["toJSON"].length === 0
    ) {
      return x.toJSON()
    } else if (Array.isArray(x)) {
      return x.map(toJSON)
    }
  } catch {
    return {}
  }
  return redact(x)
}

/**
 * Formats a value as a pretty-printed JSON string.
 *
 * This function takes any value and converts it to a nicely formatted JSON string
 * with 2-space indentation. It's commonly used for debugging and logging purposes.
 *
 * @example
 * ```ts
 * import { Inspectable } from "effect/interfaces"
 *
 * const data = {
 *   name: "Alice",
 *   details: {
 *     age: 30,
 *     hobbies: ["reading", "coding"]
 *   }
 * }
 *
 * console.log(Inspectable.format(data))
 * // {
 * //   "name": "Alice",
 * //   "details": {
 * //     "age": 30,
 * //     "hobbies": [
 * //       "reading",
 * //       "coding"
 * //     ]
 * //   }
 * // }
 * ```
 *
 * @since 2.0.0
 * @category formatting
 */
export const format = (x: unknown): string => JSON.stringify(x, null, 2)

/**
 * A base prototype object that implements the Inspectable interface.
 *
 * This object provides default implementations for the Inspectable methods.
 * It can be used as a prototype for objects that want to be inspectable,
 * or as a mixin to add inspection capabilities to existing objects.
 *
 * @example
 * ```ts
 * import { Inspectable } from "effect/interfaces"
 *
 * // Use as prototype
 * const myObject = Object.create(Inspectable.BaseProto)
 * myObject.name = "example"
 * myObject.value = 42
 *
 * console.log(myObject.toString()) // Pretty printed representation
 *
 * // Or extend in a constructor
 * function MyClass(this: any, name: string) {
 *   this.name = name
 * }
 * MyClass.prototype = Object.create(Inspectable.BaseProto)
 * MyClass.prototype.constructor = MyClass
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const BaseProto: Inspectable = {
  toJSON() {
    return toJSON(this)
  },
  [NodeInspectSymbol]() {
    return this.toJSON()
  },
  toString() {
    return format(this.toJSON())
  }
}

/**
 * Abstract base class that implements the Inspectable interface.
 *
 * This class provides a convenient way to create inspectable objects by extending it.
 * Subclasses only need to implement the `toJSON()` method, and they automatically
 * get proper `toString()` and Node.js inspection support.
 *
 * @example
 * ```ts
 * import { Inspectable } from "effect/interfaces"
 *
 * class User extends Inspectable.Class {
 *   constructor(
 *     public readonly id: number,
 *     public readonly name: string,
 *     public readonly email: string
 *   ) {
 *     super()
 *   }
 *
 *   toJSON() {
 *     return {
 *       _tag: "User",
 *       id: this.id,
 *       name: this.name,
 *       email: this.email
 *     }
 *   }
 * }
 *
 * const user = new User(1, "Alice", "alice@example.com")
 * console.log(user.toString()) // Pretty printed JSON with _tag, id, name, email
 * console.log(user) // In Node.js, shows the same formatted output
 * ```
 *
 * @since 2.0.0
 * @category classes
 */
export abstract class Class {
  /**
   * Returns a JSON representation of this object.
   *
   * Subclasses must implement this method to define how the object
   * should be serialized for debugging and inspection purposes.
   *
   * @since 2.0.0
   */
  abstract toJSON(): unknown
  /**
   * Node.js custom inspection method.
   *
   * @since 2.0.0
   */
  [NodeInspectSymbol]() {
    return this.toJSON()
  }
  /**
   * Returns a formatted string representation of this object.
   *
   * @since 2.0.0
   */
  toString() {
    return format(this.toJSON())
  }
}

/**
 * Safely converts any unknown value to a string representation.
 *
 * This function handles various types of values and provides safe string conversion
 * even for complex objects with circular references. It's designed to never throw
 * errors and always return a meaningful string representation.
 *
 * @param u - The value to convert to string
 * @param whitespace - Number of spaces or string to use for indentation (default: 2)
 *
 * @example
 * ```ts
 * import { Inspectable } from "effect/interfaces"
 *
 * // Simple values
 * console.log(Inspectable.toStringUnknown("hello"))    // "hello"
 * console.log(Inspectable.toStringUnknown(42))         // "42"
 * console.log(Inspectable.toStringUnknown(true))       // "true"
 *
 * // Objects with custom formatting
 * const obj = { name: "Alice", age: 30 }
 * console.log(Inspectable.toStringUnknown(obj))        // Pretty printed JSON
 * console.log(Inspectable.toStringUnknown(obj, 4))     // With 4-space indentation
 *
 * // Handles circular references safely
 * const circular: any = { name: "test" }
 * circular.self = circular
 * console.log(Inspectable.toStringUnknown(circular))   // Safe string representation
 * ```
 *
 * @since 2.0.0
 * @category conversions
 */
export const toStringUnknown = (
  u: unknown,
  whitespace: number | string | undefined = 2
): string => {
  return formatUnknown(u, whitespace)
}

/**
 * Safely stringifies objects that may contain circular references.
 *
 * This function performs JSON.stringify with circular reference detection and handling.
 * It also applies redaction to sensitive values and provides a safe fallback for
 * any objects that can't be serialized normally.
 *
 * @param obj - The object to stringify
 * @param whitespace - Number of spaces or string to use for indentation
 *
 * @example
 * ```ts
 * import { Inspectable } from "effect/interfaces"
 *
 * // Normal object
 * const simple = { name: "Alice", age: 30 }
 * console.log(Inspectable.stringifyCircular(simple))
 * // {"name":"Alice","age":30}
 *
 * // Object with circular reference
 * const circular: any = { name: "test" }
 * circular.self = circular
 * console.log(Inspectable.stringifyCircular(circular))
 * // {"name":"test"} (circular reference omitted)
 *
 * // With formatting
 * console.log(Inspectable.stringifyCircular(simple, 2))
 * // {
 * //   "name": "Alice",
 * //   "age": 30
 * // }
 * ```
 *
 * @since 2.0.0
 * @category conversions
 */
export const stringifyCircular = (
  obj: unknown,
  whitespace?: number | string | undefined
): string => {
  let cache: Array<unknown> = []
  const retVal = JSON.stringify(
    obj,
    (_key, value) =>
      typeof value === "object" && value !== null
        ? cache.includes(value)
          ? undefined // circular reference
          : cache.push(value) && (isRedactable(value) ? redact(value) : value)
        : value,
    whitespace
  )
  ;(cache as any) = undefined
  return retVal
}

/**
 * Interface for objects that can provide redacted representations.
 *
 * Redactable objects can provide different representations of themselves based on
 * the current execution context. This is useful for sensitive data that should
 * be hidden or modified in certain environments (like production logs).
 *
 * @example
 * ```ts
 * import { Inspectable } from "effect/interfaces"
 * import { ServiceMap } from "effect"
 *
 * class SensitiveData implements Inspectable.Redactable {
 *   constructor(private secret: string) {}
 *
 *   [Inspectable.symbolRedactable](context: ServiceMap.ServiceMap<never>) {
 *     // In production, hide the actual secret
 *     return { secret: "[REDACTED]" }
 *   }
 * }
 *
 * const data = new SensitiveData("my-secret-key")
 * // The redacted version will be used when converting to JSON in certain contexts
 * ```
 *
 * @since 3.10.0
 * @category redactable
 */
export interface Redactable {
  readonly [symbolRedactable]: (context: ServiceMap.ServiceMap<never>) => unknown
}

/**
 * Symbol used to identify objects that implement redaction capabilities.
 *
 * Objects that have a method with this symbol can provide alternative
 * representations of themselves based on the current execution context.
 * This is particularly useful for hiding sensitive information in logs.
 *
 * @example
 * ```ts
 * import { Inspectable } from "effect/interfaces"
 *
 * class APIKey {
 *   constructor(private key: string) {}
 *
 *   [Inspectable.symbolRedactable]() {
 *     return { key: "[REDACTED]" }
 *   }
 * }
 *
 * const apiKey = new APIKey("secret-key-123")
 * console.log(Inspectable.redact(apiKey)) // { key: "[REDACTED]" }
 * ```
 *
 * @since 3.10.0
 * @category redactable
 */
export const symbolRedactable: unique symbol = Symbol.for("effect/Inspectable/redactable")

/**
 * Checks if a value implements the Redactable interface.
 *
 * This function determines whether a given value has redaction capabilities,
 * meaning it can provide alternative representations based on context.
 *
 * @param u - The value to check
 *
 * @example
 * ```ts
 * import { Inspectable } from "effect/interfaces"
 *
 * class RedactableSecret {
 *   [Inspectable.symbolRedactable]() {
 *     return "[REDACTED]"
 *   }
 * }
 *
 * const secret = new RedactableSecret()
 * const normal = { value: 42 }
 *
 * console.log(Inspectable.isRedactable(secret)) // true
 * console.log(Inspectable.isRedactable(normal)) // false
 * console.log(Inspectable.isRedactable("string")) // false
 * ```
 *
 * @since 3.10.0
 * @category redactable
 */
export const isRedactable = (u: unknown): u is Redactable =>
  typeof u === "object" && u !== null && symbolRedactable in u

const currentFiberUri = "effect/Fiber/currentFiber"

/**
 * Applies redaction to a value if it implements the Redactable interface.
 *
 * This function checks if the value is redactable and applies the redaction
 * transformation if a current fiber context is available. Otherwise, it returns
 * the value unchanged.
 *
 * @param u - The value to potentially redact
 *
 * @example
 * ```ts
 * import { Inspectable } from "effect/interfaces"
 *
 * class CreditCard {
 *   constructor(private number: string) {}
 *
 *   [Inspectable.symbolRedactable]() {
 *     return {
 *       number: this.number.slice(0, 4) + "****"
 *     }
 *   }
 * }
 *
 * const card = new CreditCard("1234567890123456")
 * console.log(Inspectable.redact(card)) // { number: "1234****" }
 *
 * // Non-redactable values are returned unchanged
 * console.log(Inspectable.redact("normal string")) // "normal string"
 * console.log(Inspectable.redact({ id: 123 })) // { id: 123 }
 * ```
 *
 * @since 3.10.0
 * @category redactable
 */
export const redact = (u: unknown): unknown => {
  if (isRedactable(u)) {
    return u[symbolRedactable]((globalThis as any)[currentFiberUri]?.services ?? emptyServiceMap)
  }
  return u
}

const emptyServiceMap: ServiceMap.ServiceMap<never> = {
  "~effect/ServiceMap": {} as any,
  unsafeMap: new Map(),
  pipe() {
    return pipeArguments(this, arguments)
  }
} as any
