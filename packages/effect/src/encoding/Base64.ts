/**
 * This module provides encoding & decoding functionality for:
 *
 * - base64 (RFC4648)
 * - base64 (URL)
 * - hex
 *
 * @since 2.0.0
 */
import * as Result from "../Result.ts"
import { EncodingError } from "./EncodingError.ts"

/**
 * Encodes the given value into a base64 (RFC4648) `string`.
 *
 * @example
 * ```ts
 * import { Base64 } from "effect/encoding"
 *
 * // Encode a string
 * console.log(Base64.encode("hello")) // "aGVsbG8="
 *
 * // Encode binary data
 * const bytes = new Uint8Array([72, 101, 108, 108, 111])
 * console.log(Base64.encode(bytes)) // "SGVsbG8="
 * ```
 *
 * @category encoding
 * @since 2.0.0
 */
export const encode: (input: Uint8Array | string) => string = (input) =>
  typeof input === "string" ? encodeUint8Array(encoder.encode(input)) : encodeUint8Array(input)

const encodeUint8Array = (bytes: Uint8Array) => {
  const length = bytes.length

  let result = ""
  let i: number

  for (i = 2; i < length; i += 3) {
    result += base64abc[bytes[i - 2] >> 2]
    result += base64abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)]
    result += base64abc[((bytes[i - 1] & 0x0f) << 2) | (bytes[i] >> 6)]
    result += base64abc[bytes[i] & 0x3f]
  }

  if (i === length + 1) {
    // 1 octet yet to write
    result += base64abc[bytes[i - 2] >> 2]
    result += base64abc[(bytes[i - 2] & 0x03) << 4]
    result += "=="
  }

  if (i === length) {
    // 2 octets yet to write
    result += base64abc[bytes[i - 2] >> 2]
    result += base64abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)]
    result += base64abc[(bytes[i - 1] & 0x0f) << 2]
    result += "="
  }

  return result
}

/**
 * Decodes a base64 (RFC4648) encoded `string` into a `Uint8Array`.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import { Base64 } from "effect/encoding"
 *
 * const result = Base64.decode("SGVsbG8=")
 * if (Result.isSuccess(result)) {
 *   console.log(Array.from(result.success)) // [72, 101, 108, 108, 111]
 * }
 * ```
 *
 * @category decoding
 * @since 2.0.0
 */
export const decode = (str: string): Result.Result<Uint8Array, EncodingError> => {
  const stripped = stripCrlf(str)
  const length = stripped.length
  if (length % 4 !== 0) {
    return Result.fail(
      new EncodingError({
        kind: "Decode",
        module: "Base64",
        input: stripped,
        message: `Length must be a multiple of 4, but is ${length}`
      })
    )
  }

  const index = stripped.indexOf("=")
  if (index !== -1 && ((index < length - 2) || (index === length - 2 && stripped[length - 1] !== "="))) {
    return Result.fail(
      new EncodingError({
        kind: "Decode",
        module: "Base64",
        input: stripped,
        message: `Found a '=' character, but it is not at the end`
      })
    )
  }

  try {
    const missingOctets = stripped.endsWith("==") ? 2 : stripped.endsWith("=") ? 1 : 0
    const result = new Uint8Array(3 * (length / 4) - missingOctets)
    for (let i = 0, j = 0; i < length; i += 4, j += 3) {
      const buffer = getBase64Code(stripped.charCodeAt(i)) << 18 |
        getBase64Code(stripped.charCodeAt(i + 1)) << 12 |
        getBase64Code(stripped.charCodeAt(i + 2)) << 6 |
        getBase64Code(stripped.charCodeAt(i + 3))

      result[j] = buffer >> 16
      result[j + 1] = (buffer >> 8) & 0xff
      result[j + 2] = buffer & 0xff
    }

    return Result.succeed(result)
  } catch (e) {
    return Result.fail(
      new EncodingError({
        kind: "Decode",
        module: "Base64",
        input: stripped,
        message: e instanceof Error ? e.message : "Invalid input"
      })
    )
  }
}

/**
 * Decodes a base64 (RFC4648) encoded `string` into a UTF-8 `string`.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import { Base64 } from "effect/encoding"
 *
 * const result = Base64.decodeString("aGVsbG8=")
 * if (Result.isSuccess(result)) {
 *   console.log(result.success) // "hello"
 * }
 * ```
 *
 * @category decoding
 * @since 2.0.0
 */
export const decodeString = (str: string) => Result.map(decode(str), (_) => decoder.decode(_))

// Internal utils

const encoder = new TextEncoder()

const decoder = new TextDecoder()

const stripCrlf = (str: string) => str.replace(/[\n\r]/g, "")

function getBase64Code(charCode: number) {
  if (charCode >= base64codes.length) {
    throw new TypeError(`Invalid character ${String.fromCharCode(charCode)}`)
  }

  const code = base64codes[charCode]
  if (code === 255) {
    throw new TypeError(`Invalid character ${String.fromCharCode(charCode)}`)
  }

  return code
}

const base64abc = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "+",
  "/"
]

const base64codes = [
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  255,
  62,
  255,
  255,
  255,
  63,
  52,
  53,
  54,
  55,
  56,
  57,
  58,
  59,
  60,
  61,
  255,
  255,
  255,
  0,
  255,
  255,
  255,
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  255,
  255,
  255,
  255,
  255,
  255,
  26,
  27,
  28,
  29,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  45,
  46,
  47,
  48,
  49,
  50,
  51
]
