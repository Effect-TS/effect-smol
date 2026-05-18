/**
 * The `Crypto` module provides a platform-agnostic service for cryptographic
 * operations. Runtime packages such as `@effect/platform-node`,
 * `@effect/platform-bun`, and `@effect/platform-browser` provide concrete
 * implementations backed by the host platform's cryptography APIs.
 *
 * Use `Crypto` for cryptographic randomness, UUID generation, random values,
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
import * as PlatformError from "./PlatformError.ts"

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
 *   const uuidv4 = yield* crypto.randomUUIDv4
 *   const uuidv7 = yield* crypto.randomUUIDv7
 *   const hash = yield* crypto.digest("SHA-256", bytes)
 *   return { uuidv4, uuidv7, hash }
 * })
 *
 * Effect.runPromise(Effect.provide(program, TestCrypto))
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface Crypto {
  readonly [TypeId]: typeof TypeId

  /**
   * Generates a random integer in the range Number.MIN_SAFE_INTEGER to
   * Number.MAX_SAFE_INTEGER.
   */
  nextIntUnsafe(): number

  /**
   * Generates a random number in the range 0 (inclusive) to 1 (exclusive).
   */
  nextDoubleUnsafe(): number

  /**
   * Generates cryptographically secure random bytes.
   */
  randomBytes(size: number): Effect.Effect<Uint8Array, PlatformError.PlatformError>

  /**
   * Computes a cryptographic digest for the supplied data.
   */
  digest(
    algorithm: DigestAlgorithm,
    data: Uint8Array
  ): Effect.Effect<Uint8Array, PlatformError.PlatformError>

  /**
   * Generates a cryptographically secure random number between 0 (inclusive)
   * and 1 (exclusive).
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
  randomBetween(min: number, max: number): Effect.Effect<number>

  /**
   * Generates a cryptographically secure random integer between `min` and `max`.
   */
  randomIntBetween(min: number, max: number, options?: {
    readonly halfOpen?: boolean | undefined
  }): Effect.Effect<number>

  /**
   * Uses the cryptographically secure random generator to shuffle the supplied
   * iterable.
   */
  randomShuffle<A>(elements: Iterable<A>): Effect.Effect<Array<A>>

  /**
   * Generates a cryptographically secure UUIDv4 string.
   */
  readonly randomUUIDv4: Effect.Effect<string, PlatformError.PlatformError>

  /**
   * Generates a cryptographically secure UUIDv7 string.
   */
  readonly randomUUIDv7: Effect.Effect<string, PlatformError.PlatformError>
}

/**
 * The service identifier for the platform `Crypto` service.
 *
 * @since 4.0.0
 * @category services
 */
export const Crypto: Context.Service<Crypto, Crypto> = Context.Service("effect/Crypto")

/**
 * Creates a `Crypto` service from the primitive implementation, deriving the
 * random generator helpers and UUID generation from those primitives.
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
  impl: {
    readonly randomBytes: (size: number) => Uint8Array
    readonly digest: (
      algorithm: DigestAlgorithm,
      data: Uint8Array
    ) => Effect.Effect<Uint8Array, PlatformError.PlatformError>
  }
): Crypto => {
  const randomBytes: Crypto["randomBytes"] = (size) =>
    Effect.map(validateSize("randomBytes", size), (validSize) => impl.randomBytes(validSize))

  const nextDoubleUnsafe = (): number => {
    const bytes = impl.randomBytes(7)
    const value = ((bytes[0] & 0x1f) * 2 ** 48) + (bytes[1] * 2 ** 40) + (bytes[2] * 2 ** 32) +
      (bytes[3] * 2 ** 24) + (bytes[4] * 2 ** 16) + (bytes[5] * 2 ** 8) + bytes[6]
    return value / 2 ** 53
  }

  const nextIntUnsafe = (): number =>
    Math.floor(nextDoubleUnsafe() * (Number.MAX_SAFE_INTEGER - Number.MIN_SAFE_INTEGER + 1)) + Number.MIN_SAFE_INTEGER

  return Crypto.of({
    [TypeId]: TypeId,
    randomBytes,
    nextDoubleUnsafe,
    nextIntUnsafe,
    digest: impl.digest,
    random: Effect.sync(() => nextDoubleUnsafe()),
    randomBoolean: Effect.sync(() => nextDoubleUnsafe() > 0.5),
    randomInt: Effect.sync(() => nextIntUnsafe()),
    randomBetween(min, max) {
      const minInt = Math.ceil(min)
      const maxInt = Math.floor(max)
      return Effect.sync(() => nextDoubleUnsafe() * (maxInt - minInt) + minInt)
    },
    randomIntBetween(min, max, options) {
      const extra = options?.halfOpen === true ? 0 : 1
      return Effect.sync(() => {
        const minInt = Math.ceil(min)
        const maxInt = Math.floor(max)
        return Math.floor(nextDoubleUnsafe() * (maxInt - minInt + extra)) + minInt
      })
    },
    randomShuffle: (elements) =>
      Effect.sync(() => {
        const buffer = Array.from(elements)
        for (let i = buffer.length - 1; i >= 1; i = i - 1) {
          const index = Math.min(i, Math.floor(nextDoubleUnsafe() * (i + 1)))
          const value = buffer[i]!
          buffer[i] = buffer[index]!
          buffer[index] = value
        }
        return buffer
      }),
    randomUUIDv4: Effect.sync(() => formatUUIDv4(impl.randomBytes(16))),
    randomUUIDv7: Effect.clockWith((clock) =>
      Effect.succeed(formatUUIDv7(clock.currentTimeMillisUnsafe(), impl.randomBytes(16)))
    )
  })
}

const validateSize = (method: string, size: number): Effect.Effect<number, PlatformError.PlatformError> =>
  Number.isSafeInteger(size) && size >= 0
    ? Effect.succeed(size)
    : Effect.fail(PlatformError.badArgument({
      module: "Crypto",
      method,
      description: "size must be a non-negative safe integer"
    }))

const hex = (byte: number): string => byte.toString(16).padStart(2, "0")

const formatUUID = (bytes: Uint8Array): string => {
  const segments = [
    bytes.subarray(0, 4),
    bytes.subarray(4, 6),
    bytes.subarray(6, 8),
    bytes.subarray(8, 10),
    bytes.subarray(10, 16)
  ]

  return segments.map((segment) => Array.from(segment, hex).join("")).join("-")
}

const formatUUIDv4 = (bytes: Uint8Array): string => {
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  return formatUUID(bytes)
}

const maxUUIDv7Timestamp = 2 ** 48 - 1

const formatUUIDv7 = (timestampMillis: number, bytes: Uint8Array): string => {
  const timestamp = Math.min(Math.max(0, Math.trunc(timestampMillis)), maxUUIDv7Timestamp)

  bytes[0] = Math.floor(timestamp / 2 ** 40)
  bytes[1] = Math.floor(timestamp / 2 ** 32) & 0xff
  bytes[2] = Math.floor(timestamp / 2 ** 24) & 0xff
  bytes[3] = Math.floor(timestamp / 2 ** 16) & 0xff
  bytes[4] = Math.floor(timestamp / 2 ** 8) & 0xff
  bytes[5] = timestamp & 0xff
  bytes[6] = (bytes[6] & 0x0f) | 0x70
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  return formatUUID(bytes)
}
