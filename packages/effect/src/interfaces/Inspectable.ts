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
import * as Predicate from "../data/Predicate.ts"
import { pipeArguments } from "../interfaces/Pipeable.ts"
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
 * const data = Inspectable.toJson(person)
 * console.log(data) // { name: "Alice", age: 30 }
 *
 * // Works with arrays
 * const people = [person, new Person("Bob", 25)]
 * const array = Inspectable.toJson(people)
 * console.log(array) // [{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }]
 * ```
 *
 * @since 2.0.0
 * @category conversions
 */
export const toJson = (input: unknown): unknown => {
  try {
    if (
      Predicate.hasProperty(input, "toJSON") &&
      Predicate.isFunction(input["toJSON"]) &&
      input["toJSON"].length === 0
    ) {
      return input.toJSON()
    } else if (Array.isArray(input)) {
      return input.map(toJson)
    }
  } catch {
    return "[toJSON threw]"
  }
  return redact(input)
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
const CIRCULAR = "[Circular]"

/** @internal */
export function formatPropertyKey(name: PropertyKey): string {
  return Predicate.isString(name) ? JSON.stringify(name) : String(name)
}

/** @internal */
export function formatPath(path: ReadonlyArray<PropertyKey>): string {
  return path.map((key) => `[${formatPropertyKey(key)}]`).join("")
}

/** @internal */
export function formatDate(date: Date): string {
  try {
    return date.toISOString()
  } catch {
    return "Invalid Date"
  }
}

function safeToString(input: any): string {
  try {
    const s = input.toString()
    return typeof s === "string" ? s : String(s)
  } catch {
    return "[toString threw]"
  }
}

/**
 * Converts any JavaScript value into a human-readable string.
 *
 * Unlike `JSON.stringify`, this formatter:
 * - Handles circular references (printed as `"[Circular]"`).
 * - Supports additional types like `BigInt`, `Symbol`, `Set`, `Map`, `Date`, `RegExp`, and
 *   objects with custom `toString` methods.
 * - Includes constructor names for class instances (e.g. `MyClass({"a":1})`).
 * - Does not guarantee valid JSON output — the result is intended for debugging and inspection.
 *
 * Formatting rules:
 * - Primitives are stringified naturally (`null`, `undefined`, `123`, `"abc"`, `true`).
 * - Strings are JSON-quoted.
 * - Arrays and objects with a single element/property are formatted inline.
 * - Larger arrays/objects are pretty-printed with optional indentation.
 * - Circular references are replaced with the literal `"[Circular]"`.
 *
 * **Options**:
 * - `space`: Indentation used when pretty-printing:
 *   - If a number, that many spaces will be used.
 *   - If a string, the string is used as the indentation unit (e.g. `"\t"`).
 *   - If `0`, empty string, or `undefined`, output is compact (no indentation).
 *   Defaults to `0`.
 * - `ignoreToString`: If `true`, the `toString` method is not called on the value.
 *   Defaults to `false`.
 *
 * @since 4.0.0
 */
export function format(
  input: unknown,
  options?: {
    readonly space?: number | string | undefined
    readonly ignoreToString?: boolean | undefined
  }
): string {
  const space = options?.space ?? 0
  const seen = new WeakSet<object>()
  const gap = !space ? "" : (Predicate.isNumber(space) ? " ".repeat(space) : space)
  const ind = (d: number) => gap.repeat(d)

  const wrap = (v: unknown, body: string): string => {
    const ctor = (v as any)?.constructor
    return ctor && ctor !== Object.prototype.constructor && ctor.name ? `${ctor.name}(${body})` : body
  }

  const ownKeys = (o: object): Array<PropertyKey> => {
    try {
      return Reflect.ownKeys(o)
    } catch {
      return ["[ownKeys threw]"]
    }
  }

  function go(v: unknown, d = 0): string {
    if (Array.isArray(v)) {
      if (seen.has(v)) return CIRCULAR
      seen.add(v)
      if (!gap || v.length <= 1) return `[${v.map((x) => go(x, d)).join(",")}]`
      const inner = v.map((x) => go(x, d + 1)).join(",\n" + ind(d + 1))
      return `[\n${ind(d + 1)}${inner}\n${ind(d)}]`
    }

    if (Predicate.isDate(v)) return formatDate(v)

    if (
      !options?.ignoreToString &&
      Predicate.hasProperty(v, "toString") &&
      Predicate.isFunction(v["toString"]) &&
      v["toString"] !== Object.prototype.toString &&
      v["toString"] !== Array.prototype.toString
    ) return safeToString(v)

    if (Predicate.isString(v)) return JSON.stringify(v)

    if (
      Predicate.isNumber(v) ||
      v == null ||
      Predicate.isBoolean(v) ||
      Predicate.isSymbol(v)
    ) return String(v)

    if (Predicate.isBigInt(v)) return String(v) + "n"

    if (v instanceof Set || v instanceof Map) {
      if (seen.has(v)) return CIRCULAR
      seen.add(v)
      return `${v.constructor.name}(${go(Array.from(v), d)})`
    }

    if (Predicate.isObject(v)) {
      if (seen.has(v)) return CIRCULAR
      seen.add(v)
      const keys = ownKeys(v)
      if (!gap || keys.length <= 1) {
        const body = `{${keys.map((k) => `${formatPropertyKey(k)}:${go((v as any)[k], d)}`).join(",")}}`
        return wrap(v, body)
      }
      const body = `{\n${
        keys.map((k) => `${ind(d + 1)}${formatPropertyKey(k)}: ${go((v as any)[k], d + 1)}`).join(",\n")
      }\n${ind(d)}}`
      return wrap(v, body)
    }

    return String(v)
  }

  return go(input, 0)
}

/**
 * Safely stringifies objects that may contain circular references.
 *
 * This function performs JSON.stringify with circular reference detection and handling.
 * It also applies redaction to sensitive values and provides a safe fallback for
 * any objects that can't be serialized normally.
 *
 * **Options**:
 * - `space`: Indentation used when pretty-printing:
 *   - If a number, that many spaces will be used.
 *   - If a string, the string is used as the indentation unit (e.g. `"\t"`).
 *   - If `0`, empty string, or `undefined`, output is compact (no indentation).
 *   Defaults to `0`.
 *
 * @example
 * ```ts
 * import { Inspectable } from "effect/interfaces"
 *
 * // Normal object
 * const simple = { name: "Alice", age: 30 }
 * console.log(Inspectable.formatJson(simple))
 * // {"name":"Alice","age":30}
 *
 * // Object with circular reference
 * const circular: any = { name: "test" }
 * circular.self = circular
 * console.log(Inspectable.formatJson(circular))
 * // {"name":"test"} (circular reference omitted)
 *
 * // With formatting
 * console.log(Inspectable.formatJson(simple, { space: 2 }))
 * // {
 * //   "name": "Alice",
 * //   "age": 30
 * // }
 * ```
 *
 * @since 2.0.0
 * @category conversions
 */
export const formatJson = (
  obj: unknown,
  options?: {
    readonly space?: number | string | undefined
  }
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
    options?.space
  )
  ;(cache as any) = undefined
  return retVal
}

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
    return toJson(this)
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
 * @since 4.0.0
 * @category symbol
 */
export const symbolRedactable: unique symbol = Symbol.for("~effect/Inspectable/redactable")

/**
 * Checks if a value implements the `Redactable` interface.
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

/** @internal */
export const currentFiberTypeId = "~effect/Fiber/currentFiber"

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
    return u[symbolRedactable]((globalThis as any)[currentFiberTypeId]?.services ?? emptyServiceMap)
  }
  return u
}

const emptyServiceMap: ServiceMap.ServiceMap<never> = {
  "~effect/ServiceMap": {} as any,
  mapUnsafe: new Map(),
  pipe() {
    return pipeArguments(this, arguments)
  }
} as any
