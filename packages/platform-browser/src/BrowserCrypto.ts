/**
 * @since 1.0.0
 */
import * as EffectCrypto from "effect/Crypto"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PlatformError from "effect/PlatformError"

const randomValuesMaxLength = 65_536

/**
 * @since 1.0.0
 * @category models
 */
export interface CryptoBackend {
  readonly getRandomValues?: Crypto["getRandomValues"] | undefined
  readonly subtle?: Pick<SubtleCrypto, "digest"> | undefined
}

const badArgument = (method: string, description: string) =>
  PlatformError.badArgument({
    module: "Crypto",
    method,
    description
  })

const unavailable = (method: string, description: string) =>
  PlatformError.systemError({
    module: "Crypto",
    method,
    _tag: "Unknown",
    description
  })

const systemError = (method: string, description: string, cause: unknown) =>
  PlatformError.systemError({
    module: "Crypto",
    method,
    _tag: "Unknown",
    description,
    cause
  })

const validateSize = (method: string, size: number): Effect.Effect<number, PlatformError.PlatformError> =>
  Number.isSafeInteger(size) && size >= 0
    ? Effect.succeed(size)
    : Effect.fail(badArgument(method, "size must be a non-negative safe integer"))

const getCrypto = (method: string): Effect.Effect<CryptoBackend, PlatformError.PlatformError> =>
  Effect.suspend(() =>
    typeof globalThis.crypto === "object" && globalThis.crypto !== null
      ? Effect.succeed(globalThis.crypto)
      : Effect.fail(unavailable(method, "globalThis.crypto is not available"))
  )

const toSubtleAlgorithm = (algorithm: EffectCrypto.DigestAlgorithm): string => {
  switch (algorithm._tag) {
    case "Sha1":
      return "SHA-1"
    case "Sha256":
      return "SHA-256"
    case "Sha384":
      return "SHA-384"
    case "Sha512":
      return "SHA-512"
  }
}

const makeWith = (
  getBackend: (method: string) => Effect.Effect<CryptoBackend, PlatformError.PlatformError>,
  getUnsafeBackend: () => CryptoBackend | undefined
): EffectCrypto.Crypto => {
  const unsafeRandomBytes = (size: number): Uint8Array => {
    const crypto = getUnsafeBackend()
    if (typeof crypto?.getRandomValues !== "function") {
      throw new Error("crypto.getRandomValues is not available")
    }
    const bytes = new Uint8Array(size)
    crypto.getRandomValues(bytes)
    return bytes
  }

  const nextDoubleUnsafe = (): number => {
    const bytes = unsafeRandomBytes(7)
    const value = ((bytes[0] & 0x1f) * 2 ** 48) + (bytes[1] * 2 ** 40) + (bytes[2] * 2 ** 32) +
      (bytes[3] * 2 ** 24) + (bytes[4] * 2 ** 16) + (bytes[5] * 2 ** 8) + bytes[6]
    return value / 2 ** 53
  }

  const nextIntUnsafe = (): number =>
    Math.floor(nextDoubleUnsafe() * (Number.MAX_SAFE_INTEGER - Number.MIN_SAFE_INTEGER + 1)) + Number.MIN_SAFE_INTEGER

  const randomBytes: EffectCrypto.Crypto["randomBytes"] = (size) =>
    Effect.flatMap(
      validateSize("randomBytes", size),
      (validSize) =>
        Effect.flatMap(getBackend("randomBytes"), (crypto) => {
          if (typeof crypto.getRandomValues !== "function") {
            return Effect.fail(unavailable("randomBytes", "crypto.getRandomValues is not available"))
          }
          const getRandomValues = crypto.getRandomValues
          return Effect.try({
            try: () => {
              const bytes = new Uint8Array(validSize)
              for (let offset = 0; offset < bytes.length; offset += randomValuesMaxLength) {
                getRandomValues.call(
                  crypto,
                  bytes.subarray(offset, Math.min(offset + randomValuesMaxLength, bytes.length))
                )
              }
              return bytes
            },
            catch: (cause) => systemError("randomBytes", "Could not generate cryptographic random bytes", cause)
          })
        })
    )

  const digest: EffectCrypto.Crypto["digest"] = (algorithm, data) =>
    Effect.flatMap(getBackend("digest"), (crypto) => {
      if (typeof crypto.subtle?.digest !== "function") {
        return Effect.fail(unavailable("digest", "crypto.subtle.digest is not available"))
      }
      const subtle = crypto.subtle
      return Effect.map(
        Effect.tryPromise({
          try: () => subtle.digest(toSubtleAlgorithm(algorithm), new Uint8Array(data)),
          catch: (cause) => systemError("digest", "Could not compute digest", cause)
        }),
        (buffer) => new Uint8Array(buffer)
      )
    })

  return EffectCrypto.make({
    randomBytes,
    nextIntUnsafe,
    nextDoubleUnsafe,
    digest
  })
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const make = (backend: CryptoBackend): EffectCrypto.Crypto =>
  makeWith(() => Effect.succeed(backend), () => backend)

/**
 * A layer that directly interfaces with the Web Crypto API.
 *
 * @since 1.0.0
 * @category layers
 */
export const layer: Layer.Layer<EffectCrypto.Crypto> = Layer.succeed(
  EffectCrypto.Crypto,
  makeWith(getCrypto, () => globalThis.crypto)
)
