/**
 * Node.js implementation of the Crypto service.
 *
 * @since 1.0.0
 */
import * as EffectCrypto from "effect/Crypto"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PlatformError from "effect/PlatformError"
import * as NodeCrypto from "node:crypto"

const validateSize = (method: string, size: number): Effect.Effect<number, PlatformError.PlatformError> =>
  Number.isSafeInteger(size) && size >= 0
    ? Effect.succeed(size)
    : Effect.fail(PlatformError.badArgument({
      module: "Crypto",
      method,
      description: "size must be a non-negative safe integer"
    }))

const toHashAlgorithm = (algorithm: EffectCrypto.DigestAlgorithm): string => {
  switch (algorithm._tag) {
    case "Sha1":
      return "sha1"
    case "Sha256":
      return "sha256"
    case "Sha384":
      return "sha384"
    case "Sha512":
      return "sha512"
  }
}

const randomBytes: EffectCrypto.Crypto["randomBytes"] = (size) =>
  Effect.flatMap(validateSize("randomBytes", size), (validSize) =>
    Effect.try({
      try: () => NodeCrypto.randomBytes(validSize),
      catch: (cause) =>
        PlatformError.systemError({
          module: "Crypto",
          method: "randomBytes",
          _tag: "Unknown",
          description: "Could not generate cryptographic random bytes",
          cause
        })
    }))

const nextDoubleUnsafe = (): number => {
  const bytes = NodeCrypto.randomBytes(7)
  const value = ((bytes[0] & 0x1f) * 2 ** 48) + (bytes[1] * 2 ** 40) + (bytes[2] * 2 ** 32) +
    (bytes[3] * 2 ** 24) + (bytes[4] * 2 ** 16) + (bytes[5] * 2 ** 8) + bytes[6]
  return value / 2 ** 53
}

const nextIntUnsafe = (): number =>
  Math.floor(nextDoubleUnsafe() * (Number.MAX_SAFE_INTEGER - Number.MIN_SAFE_INTEGER + 1)) + Number.MIN_SAFE_INTEGER

const digest: EffectCrypto.Crypto["digest"] = (algorithm, data) =>
  Effect.try({
    try: () => Uint8Array.from(NodeCrypto.createHash(toHashAlgorithm(algorithm)).update(data).digest()),
    catch: (cause) =>
      PlatformError.systemError({
        module: "Crypto",
        method: "digest",
        _tag: "Unknown",
        description: "Could not compute digest",
        cause
      })
  })

/**
 * The default Node.js Crypto service implementation.
 *
 * @since 1.0.0
 * @category constructors
 */
export const make: EffectCrypto.Crypto = EffectCrypto.make({
  randomBytes,
  nextIntUnsafe,
  nextDoubleUnsafe,
  digest
})

/**
 * A layer that provides the Node.js Crypto service implementation.
 *
 * @since 1.0.0
 * @category layers
 */
export const layer: Layer.Layer<EffectCrypto.Crypto> = Layer.succeed(EffectCrypto.Crypto, make)
