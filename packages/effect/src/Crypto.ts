/**
 * The `Crypto` module provides a platform-agnostic service for cryptographic
 * operations. Runtime packages such as `@effect/platform-node`,
 * `@effect/platform-bun`, and `@effect/platform-browser` provide concrete
 * implementations backed by the host platform's cryptography APIs.
 *
 * Use `Crypto` for cryptographic randomness, UUIDv4 generation, and message
 * digests. Use `Random` only when you need deterministic pseudo-random values,
 * such as in tests or simulations.
 *
 * @example
 * ```ts
 * import { Console, Crypto, Effect, Layer } from "effect"
 *
 * const TestCrypto = Layer.succeed(
 *   Crypto.Crypto,
 *   Crypto.make({
 *     randomBytes: (size) => Effect.succeed(new Uint8Array(size)),
 *     randomUUIDv4: Effect.succeed("00000000-0000-4000-8000-000000000000"),
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
 *     randomUUIDv4: Effect.succeed("00000000-0000-4000-8000-000000000000"),
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
 * UUIDv4 generation should use native platform UUID APIs such as
 * `crypto.randomUUID` where available.
 *
 * @example
 * ```ts
 * import { Crypto, Effect, Layer } from "effect"
 *
 * const TestCrypto = Layer.succeed(
 *   Crypto.Crypto,
 *   Crypto.make({
 *     randomBytes: (size) => Effect.succeed(new Uint8Array(size)),
 *     randomUUIDv4: Effect.succeed("00000000-0000-4000-8000-000000000000"),
 *     digest: (_algorithm, data) => Effect.succeed(data)
 *   })
 * )
 *
 * const program = Effect.gen(function*() {
 *   const crypto = yield* Crypto.Crypto
 *   const bytes = yield* crypto.randomBytes(16)
 *   const uuid = yield* crypto.randomUUIDv4
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
export interface Crypto {
  readonly [TypeId]: typeof TypeId

  /**
   * Generates cryptographically secure random bytes.
   */
  readonly randomBytes: (size: number) => Effect.Effect<Uint8Array, PlatformError>

  /**
   * Generates a cryptographically secure UUIDv4 string.
   */
  readonly randomUUIDv4: Effect.Effect<string, PlatformError>

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
 * This constructor only attaches the service type identifier. It intentionally
 * does not derive `randomUUIDv4` from `randomBytes`, because platform-specific
 * implementations should use native UUID APIs where available.
 *
 * @example
 * ```ts
 * import { Crypto, Effect, Layer } from "effect"
 *
 * const TestCrypto = Layer.succeed(
 *   Crypto.Crypto,
 *   Crypto.make({
 *     randomBytes: (size) => Effect.succeed(new Uint8Array(size)),
 *     randomUUIDv4: Effect.succeed("00000000-0000-4000-8000-000000000000"),
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

/**
 * Generates a cryptographically secure UUIDv4 string.
 *
 * @since 4.0.0
 * @category accessors
 */
export const randomUUIDv4: Effect.Effect<string, PlatformError, Crypto> = Effect.flatMap(
  Crypto,
  (crypto) => crypto.randomUUIDv4
)

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
