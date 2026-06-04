/**
 * Parse and stringify YAML documents without throwing exceptions.
 *
 * YAML is useful for configuration files and other human-edited documents.
 * This module exposes the common single-document operations as synchronous
 * `Result` values so callers can handle invalid input explicitly.
 *
 * **Common tasks**
 *
 * - Parse YAML text into a JavaScript value with {@link parse}
 * - Stringify a JavaScript value as YAML text with {@link stringify}
 * - Detect YAML failures with {@link isYamlError}
 *
 * **Gotchas**
 *
 * - `parse` handles one YAML document. Multi-document streams are not exposed
 *   by this module.
 * - YAML values are returned as `unknown`; validate parsed values before using
 *   them in application code.
 *
 * @since 4.0.0
 */
import * as yaml from "yaml"
import * as Data from "./Data.ts"
import { hasProperty } from "./Predicate.ts"
import * as Result from "./Result.ts"

const YamlErrorTypeId = "~effect/Yaml/YamlError"

/**
 * Options used when parsing a YAML document.
 *
 * **When to use**
 *
 * Use when you need to customize YAML parsing, such as enabling bigint values
 * or selecting a YAML schema.
 *
 * @category models
 * @since 4.0.0
 */
export type ParseOptions = yaml.ParseOptions & yaml.DocumentOptions & yaml.SchemaOptions & yaml.ToJSOptions

/**
 * Options used when stringifying a YAML document.
 *
 * **When to use**
 *
 * Use when you need to customize YAML output, such as sorting map entries or
 * selecting a collection style.
 *
 * @category models
 * @since 4.0.0
 */
export type StringifyOptions =
  & yaml.DocumentOptions
  & yaml.SchemaOptions
  & yaml.ParseOptions
  & yaml.CreateNodeOptions
  & yaml.ToStringOptions

/**
 * Represents an error raised while parsing or stringifying YAML.
 *
 * **When to use**
 *
 * Use when you need to inspect a failed YAML conversion returned by `parse` or
 * `stringify`.
 *
 * @see {@link isYamlError} for narrowing unknown values to this error type
 *
 * @category models
 * @since 4.0.0
 */
export class YamlError extends Data.TaggedError("YamlError")<{
  readonly kind: "Parse" | "Stringify"
  readonly input: unknown
  readonly message: string
  readonly cause: unknown
}> {
  readonly [YamlErrorTypeId]: typeof YamlErrorTypeId = YamlErrorTypeId
}

/**
 * Checks whether a value is a `YamlError`.
 *
 * **When to use**
 *
 * Use when you need to narrow an unknown failure before handling it as a YAML
 * conversion error.
 *
 * @see {@link YamlError} for the error returned by YAML conversions
 *
 * @category guards
 * @since 4.0.0
 */
export const isYamlError = (u: unknown): u is YamlError => hasProperty(u, YamlErrorTypeId)

/**
 * Parses a YAML document into a JavaScript value.
 *
 * **When to use**
 *
 * Use when you need to read YAML text while handling invalid input as a
 * `Result`.
 *
 * **Gotchas**
 *
 * The returned value is `unknown`. Validate it before relying on its shape.
 *
 * **Example** (Parsing YAML)
 *
 * ```ts
 * import { Result, Yaml } from "effect"
 *
 * const result = Yaml.parse("name: example")
 *
 * if (Result.isSuccess(result)) {
 *   console.log(result.success) // { name: "example" }
 * }
 * ```
 *
 * @see {@link stringify} for converting a JavaScript value to YAML text
 *
 * @category decoding
 * @since 4.0.0
 */
export const parse = (input: string, options?: ParseOptions): Result.Result<unknown, YamlError> =>
  Result.try({
    try: () => yaml.parse(input, options),
    catch: (cause) =>
      new YamlError({
        kind: "Parse",
        input,
        message: getErrorMessage(cause),
        cause
      })
  })

/**
 * Stringifies a JavaScript value as a YAML document.
 *
 * **When to use**
 *
 * Use when you need to serialize a JavaScript value as YAML text while handling
 * conversion failures as a `Result`.
 *
 * **Details**
 *
 * The returned document ends with a newline.
 *
 * **Example** (Stringifying YAML)
 *
 * ```ts
 * import { Yaml } from "effect"
 *
 * const result = Yaml.stringify({ name: "example" })
 * // Result<string, YamlError>
 * ```
 *
 * @see {@link parse} for converting YAML text to a JavaScript value
 *
 * @category encoding
 * @since 4.0.0
 */
export const stringify = (input: unknown, options?: StringifyOptions): Result.Result<string, YamlError> =>
  Result.try({
    try: () => yaml.stringify(input, options),
    catch: (cause) =>
      new YamlError({
        kind: "Stringify",
        input,
        message: getErrorMessage(cause),
        cause
      })
  }).pipe(
    Result.flatMap((output) =>
      typeof output === "string" ?
        Result.succeed(output) :
        Result.fail(
          new YamlError({
            kind: "Stringify",
            input,
            message: "Unable to stringify input",
            cause: output
          })
        )
    )
  )

const getErrorMessage = (cause: unknown): string =>
  hasProperty(cause, "message") && typeof cause.message === "string" ? cause.message : globalThis.String(cause)
