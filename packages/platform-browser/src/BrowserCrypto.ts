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
  readonly randomUUID?: Crypto["randomUUID"] | undefined
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

const hex = (byte: number): string => byte.toString(16).padStart(2, "0")

const formatUUIDv4 = (bytes: Uint8Array): string => {
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return `${hex(bytes[0])}${hex(bytes[1])}${hex(bytes[2])}${hex(bytes[3])}-${hex(bytes[4])}${hex(bytes[5])}-${
    hex(bytes[6])
  }${hex(bytes[7])}-${hex(bytes[8])}${hex(bytes[9])}-${hex(bytes[10])}${hex(bytes[11])}${hex(bytes[12])}${
    hex(bytes[13])
  }${hex(bytes[14])}${hex(bytes[15])}`
}

const makeWith = (
  getBackend: (method: string) => Effect.Effect<CryptoBackend, PlatformError.PlatformError>
): EffectCrypto.Crypto => {
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

  const randomUUIDv4: EffectCrypto.Crypto["randomUUIDv4"] = Effect.flatMap(getBackend("randomUUIDv4"), (crypto) => {
    if (typeof crypto.randomUUID === "function") {
      const randomUUID = crypto.randomUUID
      return Effect.try({
        try: () => randomUUID.call(crypto),
        catch: (cause) => systemError("randomUUIDv4", "Could not generate a UUIDv4", cause)
      })
    }
    return Effect.map(randomBytes(16), formatUUIDv4)
  })

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
    randomUUIDv4,
    digest
  })
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const make = (backend: CryptoBackend): EffectCrypto.Crypto => makeWith(() => Effect.succeed(backend))

/**
 * A layer that directly interfaces with the Web Crypto API.
 *
 * @since 1.0.0
 * @category layers
 */
export const layer: Layer.Layer<EffectCrypto.Crypto> = Layer.succeed(EffectCrypto.Crypto, makeWith(getCrypto))
