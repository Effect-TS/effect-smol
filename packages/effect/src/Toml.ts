/**
 * Parse TOML documents without throwing exceptions.
 *
 * TOML is useful for configuration files and other human-edited documents.
 * This module exposes parsing as a synchronous `Result` value so callers can
 * handle invalid input explicitly.
 *
 * **Common tasks**
 *
 * - Parse TOML text into a JavaScript value with {@link parse}
 * - Detect TOML failures with {@link isTomlError}
 *
 * **Gotchas**
 *
 * - The underlying TOML package supports parsing only, so this module does not
 *   expose a stringify operation.
 * - TOML values are returned as `unknown`; validate parsed values before using
 *   them in application code.
 *
 * @since 4.0.0
 */
import * as toml from "toml"
import * as Data from "./Data.ts"
import { hasProperty } from "./Predicate.ts"
import * as Result from "./Result.ts"

const TomlErrorTypeId = "~effect/Toml/TomlError"

/**
 * Represents an error raised while parsing TOML.
 *
 * **When to use**
 *
 * Use when you need to inspect a failed TOML parse returned by `parse`.
 *
 * @see {@link isTomlError} for narrowing unknown values to this error type
 *
 * @category models
 * @since 4.0.0
 */
export class TomlError extends Data.TaggedError("TomlError")<{
  readonly input: string
  readonly message: string
  readonly cause: unknown
}> {
  readonly [TomlErrorTypeId]: typeof TomlErrorTypeId = TomlErrorTypeId
}

/**
 * Checks whether a value is a `TomlError`.
 *
 * **When to use**
 *
 * Use when you need to narrow an unknown failure before handling it as a TOML
 * parse error.
 *
 * @see {@link TomlError} for the error returned by {@link parse}
 *
 * @category guards
 * @since 4.0.0
 */
export const isTomlError = (u: unknown): u is TomlError => hasProperty(u, TomlErrorTypeId)

/**
 * Parses a TOML document into a JavaScript value.
 *
 * **When to use**
 *
 * Use when you need to read TOML text while handling invalid input as a
 * `Result`.
 *
 * **Gotchas**
 *
 * The returned value is `unknown`. Validate it before relying on its shape.
 *
 * **Example** (Parsing TOML)
 *
 * ```ts
 * import { Result, Toml } from "effect"
 *
 * const result = Toml.parse('name = "example"')
 *
 * if (Result.isSuccess(result)) {
 *   console.log(result.success) // { name: "example" }
 * }
 * ```
 *
 * @category decoding
 * @since 4.0.0
 */
export const parse = (input: string): Result.Result<unknown, TomlError> =>
  Result.try({
    try: () => toml.parse(input),
    catch: (cause) =>
      new TomlError({
        input,
        message: getErrorMessage(cause),
        cause
      })
  })

const getErrorMessage = (cause: unknown): string =>
  hasProperty(cause, "message") && typeof cause.message === "string" ? cause.message : globalThis.String(cause)
