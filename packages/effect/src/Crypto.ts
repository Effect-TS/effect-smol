/**
 * The `Crypto` module provides a platform-agnostic service for cryptographic
 * operations. Runtime packages such as `@effect/platform-node`,
 * `@effect/platform-bun`, and `@effect/platform-browser` provide concrete
 * implementations backed by the host platform's cryptography APIs.
 *
 * Use `Crypto` for cryptographic randomness, UUIDv4 generation, random values,
 * and message digests. The base `Random` service is not cryptographically
 * secure unless you replace it with a cryptographically secure implementation.
 *
 * @example
 * ```ts
 * import { Console, Crypto, Effect, Layer } from "effect"
 *
 * const TestCrypto = Layer.succeed(
 *   Crypto.Crypto,
 *   Crypto.make({
 *     randomBytes: (size) => Effect.succeed(new Uint8Array(size)),
 *     nextIntUnsafe: () => 1,
 *     nextDoubleUnsafe: () => 0.5,
 *     digest: (_algorithm, data) => Effect.succeed(data)
 *   })
 * )
 *
 * const program = Effect.gen(function*() {
 *   const crypto = yield* Crypto.Crypto
 *   const id = yield* crypto.randomUUIDv4
 *   yield* Console.log(`Created id: ${id}`)
 * })
 *
 * Effect.runPromise(Effect.provide(program, TestCrypto))
 * ```
 *
 * @example
 * ```ts
 * import { Crypto, Effect, Layer } from "effect"
 *
 * const TestCrypto = Layer.succeed(
 *   Crypto.Crypto,
 *   Crypto.make({
 *     randomBytes: (size) => Effect.succeed(new Uint8Array(size)),
 *     nextIntUnsafe: () => 1,
 *     nextDoubleUnsafe: () => 0.5,
 *     digest: (_algorithm, data) => Effect.succeed(data)
 *   })
 * )
 *
 * const program = Effect.gen(function*() {
 *   const crypto = yield* Crypto.Crypto
 *   return yield* crypto.randomBytes(32)
 * })
 *
 * Effect.runPromise(Effect.provide(program, TestCrypto))
 * ```
 *
 * @since 4.0.0
 */
import * as Context from "./Context.ts"
import * as Effect from "./Effect.ts"
import type { PlatformError } from "./PlatformError.ts"
import type * as Random from "./Random.ts"

const TypeId = "~effect/platform/Crypto"

/**
 * Digest algorithms supported by the platform `Crypto` service.
 *
 * SHA-1 is included for interoperability with existing protocols. Do not use
 * SHA-1 for new security-sensitive designs.
 *
 * @example
 * ```ts
 * import { Crypto } from "effect"
 *
 * const algorithm: Crypto.DigestAlgorithm = "SHA-256"
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export type DigestAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512"

/**
 * Platform-agnostic cryptographic operations.
 *
 * `Crypto` implementations must use cryptographically secure platform APIs.
 * The random generator helpers are derived by the `make` constructor from
 * the random methods on this service.
 *
 * @example
 * ```ts
 * import { Crypto, Effect, Layer } from "effect"
 *
 * const TestCrypto = Layer.succeed(
 *   Crypto.Crypto,
 *   Crypto.make({
 *     randomBytes: (size) => Effect.succeed(new Uint8Array(size)),
 *     nextIntUnsafe: () => 1,
 *     nextDoubleUnsafe: () => 0.5,
 *     digest: (_algorithm, data) => Effect.succeed(data)
 *   })
 * )
 *
 * const program = Effect.gen(function*() {
 *   const crypto = yield* Crypto.Crypto
 *   const bytes = yield* crypto.randomBytes(16)
 *   const uuid = yield* crypto.randomUUIDv4
 *   const hash = yield* crypto.digest("SHA-256", bytes)
 *   return { uuid, hash }
 * })
 *
 * Effect.runPromise(Effect.provide(program, TestCrypto))
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface Crypto extends Random.Random {
  readonly [TypeId]: typeof TypeId

  /**
   * Generates cryptographically secure random bytes.
   */
  readonly randomBytes: (size: number) => Effect.Effect<Uint8Array, PlatformError>

  /**
   * Computes a cryptographic digest for the supplied data.
   */
  readonly digest: (
    algorithm: DigestAlgorithm,
    data: Uint8Array
  ) => Effect.Effect<Uint8Array, PlatformError>

  /**
   * Generates a cryptographically secure random number between 0 (inclusive)
   * and 1 (inclusive).
   */
  readonly random: Effect.Effect<number>

  /**
   * Generates a cryptographically secure random boolean.
   */
  readonly randomBoolean: Effect.Effect<boolean>

  /**
   * Generates a cryptographically secure random integer between
   * `Number.MIN_SAFE_INTEGER` and `Number.MAX_SAFE_INTEGER`.
   */
  readonly randomInt: Effect.Effect<number>

  /**
   * Generates a cryptographically secure random number between `min` and `max`.
   */
  readonly randomBetween: (min: number, max: number) => Effect.Effect<number>

  /**
   * Generates a cryptographically secure random integer between `min` and `max`.
   */
  readonly randomIntBetween: (min: number, max: number, options?: {
    readonly halfOpen?: boolean | undefined
  }) => Effect.Effect<number>

  /**
   * Uses the cryptographically secure random generator to shuffle the supplied
   * iterable.
   */
  readonly randomShuffle: <A>(elements: Iterable<A>) => Effect.Effect<Array<A>>

  /**
   * Generates a cryptographically secure UUIDv4 string.
   */
  readonly randomUUIDv4: Effect.Effect<string, PlatformError>
}

/**
 * The service identifier for the platform `Crypto` service.
 *
 * @since 4.0.0
 * @category services
 */
export const Crypto: Context.Service<Crypto, Crypto> = Context.Service("effect/platform/Crypto")

/**
 * Creates a `Crypto` service from the primitive implementation, deriving the
 * random generator helpers and UUIDv4 generation from those primitives.
 *
 * @example
 * ```ts
 * import { Crypto, Effect, Layer } from "effect"
 *
 * const TestCrypto = Layer.succeed(
 *   Crypto.Crypto,
 *   Crypto.make({
 *     randomBytes: (size) => Effect.succeed(new Uint8Array(size)),
 *     nextIntUnsafe: () => 1,
 *     nextDoubleUnsafe: () => 0.5,
 *     digest: (_algorithm, data) => Effect.succeed(data)
 *   })
 * )
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const make = (
  impl: Omit<
    Crypto,
    | typeof TypeId
    | "random"
    | "randomBoolean"
    | "randomInt"
    | "randomBetween"
    | "randomIntBetween"
    | "randomShuffle"
    | "randomUUIDv4"
  >
): Crypto => {
  const random: Crypto["random"] = Effect.sync(() => impl.nextDoubleUnsafe())
  const randomBoolean: Crypto["randomBoolean"] = Effect.sync(() => impl.nextDoubleUnsafe() > 0.5)
  const randomInt: Crypto["randomInt"] = Effect.sync(() => impl.nextIntUnsafe())
  const randomBetween: Crypto["randomBetween"] = (min, max) =>
    Effect.sync(() => impl.nextDoubleUnsafe() * (max - min) + min)
  const randomIntBetween: Crypto["randomIntBetween"] = (min, max, options) => {
    const extra = options?.halfOpen === true ? 0 : 1
    return Effect.sync(() => {
      const minInt = Math.ceil(min)
      const maxInt = Math.floor(max)
      return Math.floor(impl.nextDoubleUnsafe() * (maxInt - minInt + extra)) + minInt
    })
  }
  const randomShuffle: Crypto["randomShuffle"] = (elements) =>
    Effect.sync(() => {
      const buffer = Array.from(elements)
      for (let i = buffer.length - 1; i >= 1; i = i - 1) {
        const index = Math.min(i, Math.floor(impl.nextDoubleUnsafe() * (i + 1)))
        const value = buffer[i]!
        buffer[i] = buffer[index]!
        buffer[index] = value
      }
      return buffer
    })

  return Crypto.of({
    ...impl,
    [TypeId]: TypeId,
    random,
    randomBoolean,
    randomInt,
    randomBetween,
    randomIntBetween,
    randomShuffle,
    randomUUIDv4: Effect.suspend(() => Effect.map(impl.randomBytes(16), formatUUIDv4))
  })
}

const hex = (byte: number): string => byte.toString(16).padStart(2, "0")

const formatUUIDv4 = (bytes: Uint8Array): string => {
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const segments = [
    bytes.subarray(0, 4),
    bytes.subarray(4, 6),
    bytes.subarray(6, 8),
    bytes.subarray(8, 10),
    bytes.subarray(10, 16)
  ]

  return segments.map((segment) => Array.from(segment, hex).join("")).join("-")
}
