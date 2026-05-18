/**
 * Browser platform implementation of the Crypto service.
 *
 * @since 1.0.0
 */
import * as Context from "effect/Context"
import * as EffectCrypto from "effect/Crypto"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PlatformError from "effect/PlatformError"

const randomValuesMaxLength = 65_536

/**
 * Browser Web Crypto APIs used by the Crypto service implementation.
 *
 * @since 1.0.0
 * @category models
 */
export const WebCrypto = Context.Reference<Crypto>("@effect/platform-browser/Crypto/WebCrypto", {
  defaultValue: () => globalThis.crypto
})

/**
 * A layer that directly interfaces with the Web Crypto API.
 *
 * @since 1.0.0
 * @category layers
 */
export const layer: Layer.Layer<EffectCrypto.Crypto> = Layer.effect(
  EffectCrypto.Crypto,
  Effect.gen(function*() {
    const crypto = yield* WebCrypto
    if (!crypto) {
      return yield* Effect.die(new Error("Web Crypto API is not available"))
    }
    const unsafeRandomBytes = (size: number): Uint8Array => {
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
        (validSize) => {
          if (typeof crypto.getRandomValues !== "function") {
            return Effect.fail(PlatformError.systemError({
              module: "Crypto",
              method: "randomBytes",
              _tag: "Unknown",
              description: "crypto.getRandomValues is not available"
            }))
          }
          return Effect.try({
            try: () => {
              const bytes = new Uint8Array(validSize)
              for (let offset = 0; offset < bytes.length; offset += randomValuesMaxLength) {
                crypto.getRandomValues!(
                  bytes.subarray(offset, Math.min(offset + randomValuesMaxLength, bytes.length))
                )
              }
              return bytes
            },
            catch: (cause) =>
              PlatformError.systemError({
                module: "Crypto",
                method: "randomBytes",
                _tag: "Unknown",
                description: "Could not generate cryptographic random bytes",
                cause
              })
          })
        }
      )

    const digest: EffectCrypto.Crypto["digest"] = (algorithm, data) => {
      if (typeof crypto.subtle.digest !== "function") {
        return Effect.fail(PlatformError.systemError({
          module: "Crypto",
          method: "digest",
          _tag: "Unknown",
          description: "crypto.subtle.digest is not available"
        }))
      }
      return Effect.map(
        Effect.tryPromise({
          try: () => crypto.subtle.digest(algorithm, new Uint8Array(data)),
          catch: (cause) =>
            PlatformError.systemError({
              module: "Crypto",
              method: "digest",
              _tag: "Unknown",
              description: "Could not compute digest",
              cause
            })
        }),
        (buffer) => new Uint8Array(buffer)
      )
    }

    return EffectCrypto.make({
      randomBytes,
      nextIntUnsafe,
      nextDoubleUnsafe,
      digest
    })
  })
)

const validateSize = (method: string, size: number): Effect.Effect<number, PlatformError.PlatformError> =>
  Number.isSafeInteger(size) && size >= 0
    ? Effect.succeed(size)
    : Effect.fail(PlatformError.badArgument({
      module: "Crypto",
      method,
      description: "size must be a non-negative safe integer"
    }))
