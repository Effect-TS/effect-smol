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
 *   const id = yield* Crypto.randomUUIDv4
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
 * const program = Crypto.randomBytes(32)
 *
 * Effect.runPromise(Effect.provide(program, TestCrypto))
 * ```
 *
 * @since 4.0.0
 */
import * as Context from "./Context.ts"
import * as Data from "./Data.ts"
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
 * declare const data: Uint8Array
 *
 * const digest = Crypto.digest(Crypto.DigestAlgorithm.Sha256(), data)
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export type DigestAlgorithm = Data.TaggedEnum<{
  readonly Sha1: {}
  readonly Sha256: {}
  readonly Sha384: {}
  readonly Sha512: {}
}>

/**
 * Constructors and matchers for `DigestAlgorithm` values.
 *
 * @since 4.0.0
 * @category constructors
 */
export const DigestAlgorithm = Data.taggedEnum<DigestAlgorithm>()

/**
 * Platform-agnostic cryptographic operations.
 *
 * `Crypto` implementations must use cryptographically secure platform APIs.
 * The module-level random generators are backed by the random methods on this
 * service.
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
 *   const uuid = yield* Crypto.randomUUIDv4
 *   const hash = yield* crypto.digest(Crypto.DigestAlgorithm.Sha256(), bytes)
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
}

/**
 * The service identifier for the platform `Crypto` service.
 *
 * @since 4.0.0
 * @category services
 */
export const Crypto: Context.Service<Crypto, Crypto> = Context.Service("effect/platform/Crypto")

/**
 * Creates a `Crypto` service from a complete implementation.
 *
 * This constructor only attaches the service type identifier. UUIDv4 generation
 * is implemented as a module-level function derived from `randomBytes`.
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
export const make = (impl: Omit<Crypto, typeof TypeId>): Crypto => Crypto.of({ ...impl, [TypeId]: TypeId })

/**
 * Generates cryptographically secure random bytes.
 *
 * @since 4.0.0
 * @category accessors
 */
export const randomBytes = (size: number): Effect.Effect<Uint8Array, PlatformError, Crypto> =>
  Effect.flatMap(Crypto, (crypto) => crypto.randomBytes(size))

const cryptoWith = <A>(f: (crypto: Crypto) => A): Effect.Effect<A, never, Crypto> => Effect.map(Crypto, f)

/**
 * Generates a cryptographically secure random number between 0 (inclusive) and
 * 1 (inclusive).
 *
 * @since 4.0.0
 * @category random generators
 */
export const random: Effect.Effect<number, never, Crypto> = cryptoWith((crypto) => crypto.nextDoubleUnsafe())

/**
 * Generates a cryptographically secure random boolean.
 *
 * @since 4.0.0
 * @category random generators
 */
export const randomBoolean: Effect.Effect<boolean, never, Crypto> = cryptoWith((crypto) =>
  crypto.nextDoubleUnsafe() > 0.5
)

/**
 * Generates a cryptographically secure random integer between
 * `Number.MIN_SAFE_INTEGER` and `Number.MAX_SAFE_INTEGER`.
 *
 * @since 4.0.0
 * @category random generators
 */
export const randomInt: Effect.Effect<number, never, Crypto> = cryptoWith((crypto) => crypto.nextIntUnsafe())

/**
 * Generates a cryptographically secure random number between `min` and `max`.
 *
 * @since 4.0.0
 * @category random generators
 */
export const randomBetween = (min: number, max: number): Effect.Effect<number, never, Crypto> =>
  cryptoWith((crypto) => crypto.nextDoubleUnsafe() * (max - min) + min)

/**
 * Generates a cryptographically secure random integer between `min` and `max`.
 *
 * Set `options.halfOpen: true` to generate in the half-open range
 * `[min, max)`.
 *
 * @since 4.0.0
 * @category random generators
 */
export const randomIntBetween = (min: number, max: number, options?: {
  readonly halfOpen?: boolean | undefined
}): Effect.Effect<number, never, Crypto> => {
  const extra = options?.halfOpen === true ? 0 : 1
  return cryptoWith((crypto) => {
    const minInt = Math.ceil(min)
    const maxInt = Math.floor(max)
    return Math.floor(crypto.nextDoubleUnsafe() * (maxInt - minInt + extra)) + minInt
  })
}

/**
 * Uses the cryptographically secure random generator to shuffle the supplied
 * iterable.
 *
 * @since 4.0.0
 * @category random generators
 */
export const randomShuffle = <A>(elements: Iterable<A>): Effect.Effect<Array<A>, never, Crypto> =>
  cryptoWith((crypto) => {
    const buffer = Array.from(elements)
    for (let i = buffer.length - 1; i >= 1; i = i - 1) {
      const index = Math.min(i, Math.floor(crypto.nextDoubleUnsafe() * (i + 1)))
      const value = buffer[i]!
      buffer[i] = buffer[index]!
      buffer[index] = value
    }
    return buffer
  })

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

/**
 * Generates a cryptographically secure UUIDv4 string from 16 bytes produced by
 * the platform `Crypto` service.
 *
 * @since 4.0.0
 * @category accessors
 */
export const randomUUIDv4: Effect.Effect<string, PlatformError, Crypto> = Effect.map(randomBytes(16), formatUUIDv4)

/**
 * Computes a cryptographic digest for the supplied data.
 *
 * @since 4.0.0
 * @category accessors
 */
export const digest = (
  algorithm: DigestAlgorithm,
  data: Uint8Array
): Effect.Effect<Uint8Array, PlatformError, Crypto> =>
  Effect.flatMap(Crypto, (crypto) => crypto.digest(algorithm, data))
