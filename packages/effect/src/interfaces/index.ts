/**
 * @since 4.0.0
 */

/**
 * This module provides functionality for defining and working with equality between values.
 * It includes the `Equal` interface for types that can determine equality with other values
 * of the same type, and utilities for comparing values.
 *
 * @since 2.0.0
 */
export * as Equal from "./Equal.ts"

/**
 * This module provides utilities for hashing values in TypeScript.
 *
 * Hashing is the process of converting data into a fixed-size numeric value,
 * typically used for data structures like hash tables, equality comparisons,
 * and efficient data storage.
 *
 * @since 2.0.0
 */
export * as Hash from "./Hash.ts"

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
export * as Inspectable from "./Inspectable.ts"

/**
 * @since 2.0.0
 */
export * as Pipeable from "./Pipeable.ts"

/**
 * This module provides functionality for working with primary keys.
 * A `PrimaryKey` is a simple interface that represents a unique identifier
 * that can be converted to a string representation.
 *
 * Primary keys are useful for creating unique identifiers for objects,
 * database records, cache keys, or any scenario where you need a
 * string-based unique identifier.
 *
 * @since 2.0.0
 */
export * as PrimaryKey from "./PrimaryKey.ts"
