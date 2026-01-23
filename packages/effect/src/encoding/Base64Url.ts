/**
 * @since 2.0.0
 */
import * as Result from "../Result.ts"
import * as Base64 from "./Base64.ts"
import { EncodingError } from "./EncodingError.ts"

/**
 * Encodes the given value into a base64 (URL) `string`.
 *
 * @example
 * ```ts
 * import { Base64Url } from "effect/encoding"
 *
 * // URL-safe base64 encoding (uses - and _ instead of + and /)
 * console.log(Base64Url.encode("hello?")) // "aGVsbG8_"
 *
 * const bytes = new Uint8Array([72, 101, 108, 108, 111, 63])
 * console.log(Base64Url.encode(bytes)) // "SGVsbG8_"
 * ```
 *
 * @category encoding
 * @since 2.0.0
 */
export const encode: (input: Uint8Array | string) => string = (input) =>
  typeof input === "string" ? encodeUint8Array(encoder.encode(input)) : encodeUint8Array(input)

const encodeUint8Array = (data: Uint8Array) =>
  Base64.encode(data).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")

/**
 * Decodes a base64 (URL) encoded `string` into a `Uint8Array`.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import { Base64Url } from "effect/encoding"
 *
 * const result = Base64Url.decode("SGVsbG8_")
 * if (Result.isSuccess(result)) {
 *   console.log(Array.from(result.success)) // [72, 101, 108, 108, 111, 63]
 * }
 * ```
 *
 * @category decoding
 * @since 2.0.0
 */
export const decode = (str: string): Result.Result<Uint8Array, EncodingError> => {
  const stripped = stripCrlf(str)
  const length = stripped.length
  if (length % 4 === 1) {
    return Result.fail(
      new EncodingError({
        module: "Base64Url",
        kind: "Decode",
        input: stripped,
        message: `Length should be a multiple of 4, but is ${length}`
      })
    )
  }

  if (!/^[-_A-Z0-9]*?={0,2}$/i.test(stripped)) {
    return Result.fail(
      new EncodingError({
        module: "Base64Url",
        kind: "Decode",
        input: stripped,
        message: "Invalid input"
      })
    )
  }

  // Some variants allow or require omitting the padding '=' signs
  let sanitized = length % 4 === 2 ? `${stripped}==` : length % 4 === 3 ? `${stripped}=` : stripped
  sanitized = sanitized.replace(/-/g, "+").replace(/_/g, "/")

  return Base64.decode(sanitized)
}

/**
 * Decodes a base64 (URL) encoded `string` into a UTF-8 `string`.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import { Base64Url } from "effect/encoding"
 *
 * const result = Base64Url.decodeString("aGVsbG8_")
 * if (Result.isSuccess(result)) {
 *   console.log(result.success) // "hello?"
 * }
 * ```
 *
 * @category decoding
 * @since 2.0.0
 */
export const decodeString = (str: string) => Result.map(decode(str), (_) => decoder.decode(_))

// Internal

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const stripCrlf = (str: string) => str.replace(/[\n\r]/g, "")
