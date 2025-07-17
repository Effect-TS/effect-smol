/**
 * The Redacted module provides functionality for handling sensitive information
 * securely within your application. By using the `Redacted` data type, you can
 * ensure that sensitive values are not accidentally exposed in logs or error
 * messages.
 *
 * @since 3.3.0
 */
import * as Equal from "./Equal.ts"
import * as Equivalence from "./Equivalence.ts"
import * as Hash from "./Hash.ts"
import { PipeInspectableProto } from "./internal/core.ts"
import { redactedRegistry } from "./internal/redacted.ts"
import type { Pipeable } from "./Pipeable.ts"
import { hasProperty } from "./Predicate.ts"
import type { Covariant } from "./Types.ts"

/**
 * @example
 * ```ts
 * import { Redacted } from "effect"
 *
 * // The TypeId is used internally for type identification
 * const secret = Redacted.make("my-secret")
 * console.log(Redacted.TypeId) // "~effect/Redacted"
 * ```
 *
 * @since 3.3.0
 * @category symbols
 */
export const TypeId: TypeId = "~effect/Redacted"

/**
 * @example
 * ```ts
 * import { Redacted } from "effect"
 *
 * // TypeId type represents the unique identifier for Redacted instances
 * type RedactedTypeId = Redacted.TypeId // "~effect/Redacted"
 * ```
 *
 * @since 3.3.0
 * @category symbols
 */
export type TypeId = "~effect/Redacted"

/**
 * @example
 * ```ts
 * import { Redacted } from "effect"
 *
 * // Create a redacted value to protect sensitive information
 * const apiKey = Redacted.make("secret-key")
 * const userPassword = Redacted.make("user-password")
 *
 * // TypeScript will infer the types as Redacted<string>
 * ```
 *
 * @since 3.3.0
 * @category models
 */
export interface Redacted<out A = string> extends Redacted.Variance<A>, Equal.Equal, Pipeable {
  readonly label: string | undefined
}

/**
 * @example
 * ```ts
 * import { Redacted } from "effect"
 *
 * // Use the Redacted namespace for type-level operations
 * const secret = Redacted.make("my-secret")
 *
 * // The namespace contains utilities for working with Redacted values
 * const isRedacted = Redacted.isRedacted(secret) // true
 * ```
 *
 * @since 3.3.0
 * @category namespace
 */
export declare namespace Redacted {
  /**
   * @example
   * ```ts
   * import { Redacted } from "effect"
   *
   * // Variance interface ensures type safety for covariant type parameter
   * const stringSecret = Redacted.make("secret")
   * const numberSecret = Redacted.make(42)
   *
   * // TypeScript will infer the types with proper variance
   * ```
   *
   * @since 3.3.0
   * @category models
   */
  export interface Variance<out A> {
    readonly [TypeId]: {
      readonly _A: Covariant<A>
    }
  }

  /**
   * @example
   * ```ts
   * import { Redacted } from "effect"
   *
   * // Extract the value type from a Redacted instance
   * const secret = Redacted.make("my-secret")
   * const extractedValue: string = Redacted.value(secret)
   * ```
   *
   * @since 3.3.0
   * @category type-level
   */
  export type Value<T extends Redacted<any>> = [T] extends [Redacted<infer _A>] ? _A : never
}

/**
 * @example
 * ```ts
 * import { Redacted } from "effect"
 *
 * const secret = Redacted.make("my-secret")
 * const plainString = "not-secret"
 *
 * console.log(Redacted.isRedacted(secret))      // true
 * console.log(Redacted.isRedacted(plainString)) // false
 * ```
 *
 * @since 3.3.0
 * @category refinements
 */
export const isRedacted = (u: unknown): u is Redacted<unknown> => hasProperty(u, TypeId)

/**
 * This function creates a `Redacted<A>` instance from a given value `A`,
 * securely hiding its content.
 *
 * @example
 * ```ts
 * import { Redacted } from "effect"
 *
 * const API_KEY = Redacted.make("1234567890")
 * ```
 *
 * @since 3.3.0
 * @category constructors
 */
export const make = <T>(value: T, options?: {
  readonly label?: string | undefined
}): Redacted<T> => {
  const redacted = Object.create(Proto)
  if (options?.label) {
    redacted.label = options.label
  }
  redactedRegistry.set(redacted, value)
  return redacted
}

const Proto = {
  [TypeId]: {
    _A: (_: never) => _
  },
  label: undefined,
  ...PipeInspectableProto,
  toJSON() {
    return `<${this.label ?? "redacted"}>`
  },
  toString() {
    return `<${this.label ?? "redacted"}>`
  },
  [Hash.symbol]<T>(this: Redacted<T>): number {
    return Hash.cached(this, () => Hash.hash(redactedRegistry.get(this)))
  },
  [Equal.symbol]<T>(this: Redacted<T>, that: unknown): boolean {
    return (
      isRedacted(that) &&
      Equal.equals(redactedRegistry.get(this), redactedRegistry.get(that))
    )
  }
}

/**
 * Retrieves the original value from a `Redacted` instance. Use this function
 * with caution, as it exposes the sensitive data.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Redacted } from "effect"
 *
 * const API_KEY = Redacted.make("1234567890")
 *
 * assert.equal(Redacted.value(API_KEY), "1234567890")
 * ```
 *
 * @since 3.3.0
 * @category getters
 */
export const value = <T>(self: Redacted<T>): T => {
  if (redactedRegistry.has(self)) {
    return redactedRegistry.get(self)
  } else {
    throw new Error("Unable to get redacted value" + (self.label ? ` with label: "${self.label}"` : ""))
  }
}

/**
 * Erases the underlying value of a `Redacted` instance, rendering it unusable.
 * This function is intended to ensure that sensitive data does not remain in
 * memory longer than necessary.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Redacted } from "effect"
 *
 * const API_KEY = Redacted.make("1234567890")
 *
 * assert.equal(Redacted.value(API_KEY), "1234567890")
 *
 * Redacted.unsafeWipe(API_KEY)
 *
 * assert.throws(() => Redacted.value(API_KEY), new Error("Unable to get redacted value"))
 * ```
 *
 * @since 3.3.0
 * @category unsafe
 */
export const unsafeWipe = <T>(self: Redacted<T>): boolean => redactedRegistry.delete(self)

/**
 * Generates an equivalence relation for `Redacted<A>` values based on an
 * equivalence relation for the underlying values `A`. This function is useful
 * for comparing `Redacted` instances without exposing their contents.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Redacted, Equivalence } from "effect"
 *
 * const API_KEY1 = Redacted.make("1234567890")
 * const API_KEY2 = Redacted.make("1-34567890")
 * const API_KEY3 = Redacted.make("1234567890")
 *
 * const equivalence = Redacted.getEquivalence(Equivalence.string)
 *
 * assert.equal(equivalence(API_KEY1, API_KEY2), false)
 * assert.equal(equivalence(API_KEY1, API_KEY3), true)
 * ```
 *
 * @category equivalence
 * @since 3.3.0
 */
export const getEquivalence = <A>(isEquivalent: Equivalence.Equivalence<A>): Equivalence.Equivalence<Redacted<A>> =>
  Equivalence.make((x, y) => isEquivalent(value(x), value(y)))
