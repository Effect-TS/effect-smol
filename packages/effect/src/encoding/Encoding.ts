/**
 * This module provides encoding & decoding functionality for:
 *
 * - base64 (RFC4648)
 * - base64 (URL)
 * - hex
 *
 * @since 2.0.0
 */
import * as Result from "../data/Result.ts"
import * as Base64 from "../internal/encoding/base64.ts"
import * as Base64Url from "../internal/encoding/base64Url.ts"
import * as Common from "../internal/encoding/common.ts"
import * as Hex from "../internal/encoding/hex.ts"

/**
 * Encodes the given value into a base64 (RFC4648) `string`.
 *
 * @example
 * ```ts
 * import { Encoding } from "effect/encoding"
 *
 * // Encode a string
 * console.log(Encoding.encodeBase64("hello")) // "aGVsbG8="
 *
 * // Encode binary data
 * const bytes = new Uint8Array([72, 101, 108, 108, 111])
 * console.log(Encoding.encodeBase64(bytes)) // "SGVsbG8="
 * ```
 *
 * @category encoding
 * @since 2.0.0
 */
export const encodeBase64: (input: Uint8Array | string) => string = (input) =>
  typeof input === "string" ? Base64.encode(Common.encoder.encode(input)) : Base64.encode(input)

/**
 * Decodes a base64 (RFC4648) encoded `string` into a `Uint8Array`.
 *
 * @example
 * ```ts
 * import { Encoding } from "effect/encoding"
 * import { Result } from "effect/data"
 *
 * const result = Encoding.decodeBase64("SGVsbG8=")
 * if (Result.isSuccess(result)) {
 *   console.log(Array.from(result.success)) // [72, 101, 108, 108, 111]
 * }
 * ```
 *
 * @category decoding
 * @since 2.0.0
 */
export const decodeBase64 = (str: string): Result.Result<Uint8Array, DecodeException> => Base64.decode(str)

/**
 * Decodes a base64 (RFC4648) encoded `string` into a UTF-8 `string`.
 *
 * @example
 * ```ts
 * import { Encoding } from "effect/encoding"
 * import { Result } from "effect/data"
 *
 * const result = Encoding.decodeBase64String("aGVsbG8=")
 * if (Result.isSuccess(result)) {
 *   console.log(result.success) // "hello"
 * }
 * ```
 *
 * @category decoding
 * @since 2.0.0
 */
export const decodeBase64String = (str: string) => Result.map(decodeBase64(str), (_) => Common.decoder.decode(_))

/**
 * Encodes the given value into a base64 (URL) `string`.
 *
 * @example
 * ```ts
 * import { Encoding } from "effect/encoding"
 *
 * // URL-safe base64 encoding (uses - and _ instead of + and /)
 * console.log(Encoding.encodeBase64Url("hello?")) // "aGVsbG8_"
 *
 * const bytes = new Uint8Array([72, 101, 108, 108, 111, 63])
 * console.log(Encoding.encodeBase64Url(bytes)) // "SGVsbG8_"
 * ```
 *
 * @category encoding
 * @since 2.0.0
 */
export const encodeBase64Url: (input: Uint8Array | string) => string = (input) =>
  typeof input === "string" ? Base64Url.encode(Common.encoder.encode(input)) : Base64Url.encode(input)

/**
 * Decodes a base64 (URL) encoded `string` into a `Uint8Array`.
 *
 * @example
 * ```ts
 * import { Encoding } from "effect/encoding"
 * import { Result } from "effect/data"
 *
 * const result = Encoding.decodeBase64Url("SGVsbG8_")
 * if (Result.isSuccess(result)) {
 *   console.log(Array.from(result.success)) // [72, 101, 108, 108, 111, 63]
 * }
 * ```
 *
 * @category decoding
 * @since 2.0.0
 */
export const decodeBase64Url = (str: string): Result.Result<Uint8Array, DecodeException> => Base64Url.decode(str)

/**
 * Decodes a base64 (URL) encoded `string` into a UTF-8 `string`.
 *
 * @example
 * ```ts
 * import { Encoding } from "effect/encoding"
 * import { Result } from "effect/data"
 *
 * const result = Encoding.decodeBase64UrlString("aGVsbG8_")
 * if (Result.isSuccess(result)) {
 *   console.log(result.success) // "hello?"
 * }
 * ```
 *
 * @category decoding
 * @since 2.0.0
 */
export const decodeBase64UrlString = (str: string) => Result.map(decodeBase64Url(str), (_) => Common.decoder.decode(_))

/**
 * Encodes the given value into a hex `string`.
 *
 * @example
 * ```ts
 * import { Encoding } from "effect/encoding"
 *
 * // Encode a string to hex
 * console.log(Encoding.encodeHex("hello")) // "68656c6c6f"
 *
 * // Encode binary data to hex
 * const bytes = new Uint8Array([72, 101, 108, 108, 111])
 * console.log(Encoding.encodeHex(bytes)) // "48656c6c6f"
 * ```
 *
 * @category encoding
 * @since 2.0.0
 */
export const encodeHex: (input: Uint8Array | string) => string = (input) =>
  typeof input === "string" ? Hex.encode(Common.encoder.encode(input)) : Hex.encode(input)

/**
 * Decodes a hex encoded `string` into a `Uint8Array`.
 *
 * @example
 * ```ts
 * import { Encoding } from "effect/encoding"
 * import { Result } from "effect/data"
 *
 * const result = Encoding.decodeHex("48656c6c6f")
 * if (Result.isSuccess(result)) {
 *   console.log(Array.from(result.success)) // [72, 101, 108, 108, 111]
 * }
 * ```
 *
 * @category decoding
 * @since 2.0.0
 */
export const decodeHex = (str: string): Result.Result<Uint8Array, DecodeException> => Hex.decode(str)

/**
 * Decodes a hex encoded `string` into a UTF-8 `string`.
 *
 * @example
 * ```ts
 * import { Encoding } from "effect/encoding"
 * import { Result } from "effect/data"
 *
 * const result = Encoding.decodeHexString("68656c6c6f")
 * if (Result.isSuccess(result)) {
 *   console.log(result.success) // "hello"
 * }
 * ```
 *
 * @category decoding
 * @since 2.0.0
 */
export const decodeHexString = (str: string) => Result.map(decodeHex(str), (_) => Common.decoder.decode(_))

/**
 * Unique symbol used to identify `DecodeException` instances.
 *
 * @example
 * ```ts
 * import { Encoding } from "effect/encoding"
 *
 * const error = Encoding.DecodeException("invalid input")
 * console.log(error[Encoding.DecodeExceptionTypeId]) // Symbol present
 * ```
 *
 * @category symbols
 * @since 2.0.0
 */
export const DecodeExceptionTypeId: unique symbol = Common.DecodeExceptionTypeId

/**
 * Type representing the unique identifier for `DecodeException`.
 *
 * @example
 * ```ts
 * import { Encoding } from "effect/encoding"
 *
 * type ExceptionType = Encoding.DecodeExceptionTypeId
 * const error = Encoding.DecodeException("invalid input")
 * const typeId: ExceptionType = error[Encoding.DecodeExceptionTypeId]
 * ```
 *
 * @category symbols
 * @since 2.0.0
 */
export type DecodeExceptionTypeId = typeof DecodeExceptionTypeId

/**
 * Represents a checked exception which occurs when decoding fails.
 *
 * @example
 * ```ts
 * import { Encoding } from "effect/encoding"
 * import { Result } from "effect/data"
 *
 * const result = Encoding.decodeBase64("invalid-base64")
 * if (Result.isFailure(result)) {
 *   const error: Encoding.DecodeException = result.failure
 *   console.log(error._tag) // "DecodeException"
 *   console.log(error.input) // "invalid-base64"
 *   console.log(error.message) // Error message
 * }
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface DecodeException {
  readonly _tag: "DecodeException"
  readonly [DecodeExceptionTypeId]: DecodeExceptionTypeId
  readonly input: string
  readonly message?: string
}

/**
 * Creates a checked exception which occurs when decoding fails.
 *
 * @example
 * ```ts
 * import { Encoding } from "effect/encoding"
 *
 * const error = Encoding.DecodeException("invalid-base64", "Invalid base64 character")
 * console.log(error._tag) // "DecodeException"
 * console.log(error.input) // "invalid-base64"
 * console.log(error.message) // "Invalid base64 character"
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const DecodeException: (input: string, message?: string) => DecodeException = Common.DecodeException

/**
 * Returns `true` if the specified value is an `DecodeException`, `false` otherwise.
 *
 * @example
 * ```ts
 * import { Encoding } from "effect/encoding"
 *
 * const error = Encoding.DecodeException("invalid input")
 * console.log(Encoding.isDecodeException(error)) // true
 * console.log(Encoding.isDecodeException(new Error())) // false
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isDecodeException: (u: unknown) => u is DecodeException = Common.isDecodeException
