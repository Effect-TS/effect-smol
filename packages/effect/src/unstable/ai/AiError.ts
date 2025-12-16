/**
 * The `AiError` module provides comprehensive error handling for AI operations.
 *
 * This module defines a hierarchy of error types that can occur when working
 * with AI services, including HTTP request/response errors, input/output
 * validation errors, and general runtime errors. All errors follow Effect's
 * structured error patterns and provide detailed context for debugging.
 *
 * ## Error Types
 *
 * - **HttpRequestError**: Errors occurring during HTTP request processing
 * - **HttpResponseError**: Errors occurring during HTTP response processing
 * - **MalformedInput**: Errors when input data doesn't match expected format
 * - **MalformedOutput**: Errors when output data can't be parsed or validated
 * - **UnknownError**: Catch-all for unexpected runtime errors
 *
 * @example
 * ```ts
 * import { Effect, Match } from "effect"
 * import type { AiError } from "effect/unstable/ai"
 *
 * const handleAiError = Match.type<AiError.AiError>().pipe(
 *   Match.tag(
 *     "HttpRequestError",
 *     (err) => Effect.logError(`Request failed: ${err.message}`)
 *   ),
 *   Match.tag(
 *     "HttpResponseError",
 *     (err) =>
 *       Effect.logError(`Response error (${err.response.status}): ${err.message}`)
 *   ),
 *   Match.tag(
 *     "MalformedInput",
 *     (err) => Effect.logError(`Invalid input: ${err.message}`)
 *   ),
 *   Match.tag(
 *     "MalformedOutput",
 *     (err) => Effect.logError(`Invalid output: ${err.message}`)
 *   ),
 *   Match.orElse((err) => Effect.logError(`Unknown error: ${err.message}`))
 * )
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const aiOperation = Effect.gen(function*() {
 *   // Some AI operation that might fail
 *   return yield* new AiError.HttpRequestError({
 *     module: "OpenAI",
 *     method: "completion",
 *     reason: "Transport",
 *     request: {
 *       method: "POST",
 *       url: "https://api.openai.com/v1/completions",
 *       urlParams: [],
 *       hash: undefined,
 *       headers: { "Content-Type": "application/json" }
 *     }
 *   })
 * })
 *
 * const program = aiOperation.pipe(
 *   Effect.catchTag("HttpRequestError", (error) => {
 *     console.log("Request failed:", error.message)
 *     return Effect.succeed("fallback response")
 *   })
 * )
 * ```
 *
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import { format } from "../../Formatter.ts"
import * as Predicate from "../../Predicate.ts"
import { redact } from "../../Redactable.ts"
import * as Schema from "../../schema/Schema.ts"
import type * as HttpClientError from "../http/HttpClientError.ts"

const TypeId = "~effect/unstable/ai/AiError" as const

/**
 * Type guard to check if a value is an AI error.
 *
 * @param u - The value to check
 * @returns `true` if the value is an `AiError`, `false` otherwise
 *
 * @example
 * ```ts
 * import { AiError } from "effect/unstable/ai"
 *
 * const someError = new Error("generic error")
 * const aiError = new AiError.UnknownError({
 *   module: "Test",
 *   method: "example"
 * })
 *
 * console.log(AiError.isAiError(someError)) // false
 * console.log(AiError.isAiError(aiError)) // true
 * ```
 *
 * @since 4.0.0
 * @category guards
 */
export const isAiError = (u: unknown): u is AiError => Predicate.hasProperty(u, TypeId)

// =============================================================================
// Http Request Error
// =============================================================================

/**
 * Schema for HTTP request details used in error reporting.
 *
 * Captures comprehensive information about HTTP requests that failed,
 * enabling detailed error analysis and debugging.
 *
 * @example
 * ```ts
 * import type { AiError } from "effect/unstable/ai"
 *
 * const requestDetails: typeof AiError.HttpRequestDetails.Type = {
 *   method: "POST",
 *   url: "https://api.openai.com/v1/completions",
 *   urlParams: [["model", "gpt-4"], ["stream", "false"]],
 *   hash: "#section1",
 *   headers: { "Content-Type": "application/json" }
 * }
 * ```
 *
 * @since 4.0.0
 * @category schemas
 */
export const HttpRequestDetails = Schema.Struct({
  method: Schema.Literals(["GET", "POST", "PATCH", "PUT", "DELETE", "HEAD", "OPTIONS"]),
  url: Schema.String,
  urlParams: Schema.Array(Schema.Tuple([Schema.String, Schema.String])),
  hash: Schema.UndefinedOr(Schema.String),
  headers: Schema.Record(Schema.String, Schema.String)
}).annotate({ identifier: "HttpRequestDetails" })

/**
 * Error that occurs during HTTP request processing.
 *
 * This error is raised when issues arise before receiving an HTTP response,
 * such as network connectivity problems, request encoding issues, or invalid
 * URLs.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const handleNetworkError = Effect.gen(function*() {
 *   const error = new AiError.HttpRequestError({
 *     module: "OpenAI",
 *     method: "createCompletion",
 *     reason: "Transport",
 *     request: {
 *       method: "POST",
 *       url: "https://api.openai.com/v1/completions",
 *       urlParams: [],
 *       hash: undefined,
 *       headers: { "Content-Type": "application/json" }
 *     },
 *     description: "Connection timeout after 30 seconds"
 *   })
 *
 *   console.log(error.message)
 *   // "Transport: Connection timeout after 30 seconds (POST https://api.openai.com/v1/completions)"
 * })
 * ```
 *
 * @since 4.0.0
 * @category schemas
 */
export class HttpRequestError extends Schema.ErrorClass<HttpRequestError>(
  "effect/ai/AiError/HttpRequestError"
)({
  _tag: Schema.tag("HttpRequestError"),
  module: Schema.String,
  method: Schema.String,
  reason: Schema.Literals(["Transport", "Encode", "InvalidUrl"]),
  request: HttpRequestDetails,
  description: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Creates an HttpRequestError from a platform HttpClientError.RequestError.
   *
   * @example
   * ```ts
   * import { AiError } from "effect/unstable/ai"
   * import type { HttpClientError } from "effect/unstable/http"
   *
   * declare const platformError: HttpClientError.RequestError
   *
   * const aiError = AiError.HttpRequestError.fromRequestError({
   *   module: "ChatGPT",
   *   method: "sendMessage",
   *   error: platformError
   * })
   * ```
   *
   * @since 4.0.0
   * @category constructors
   */
  static fromRequestError({ error, ...params }: {
    readonly module: string
    readonly method: string
    readonly error: HttpClientError.RequestError
  }): HttpRequestError {
    return new HttpRequestError({
      ...params,
      cause: error,
      description: error.description,
      reason: error.reason,
      request: {
        hash: error.request.hash,
        headers: redact(error.request.headers) as any,
        method: error.request.method,
        url: error.request.url,
        urlParams: Array.from(error.request.urlParams)
      }
    })
  }

  override get message(): string {
    const methodAndUrl = `${this.request.method} ${this.request.url}`

    let baseMessage = this.description
      ? `${this.reason}: ${this.description}`
      : `${this.reason}: An HTTP request error occurred.`

    baseMessage += ` (${methodAndUrl})`

    let suggestion = ""
    switch (this.reason) {
      case "Encode": {
        suggestion += "Check that the request body data is properly formatted and matches the expected content type."
        break
      }

      case "InvalidUrl": {
        suggestion += "Verify that the URL format is correct and that all required parameters have been provided."
        suggestion += " Check for any special characters that may need encoding."
        break
      }

      case "Transport": {
        suggestion += "Check your network connection and verify that the requested URL is accessible."
        break
      }
    }

    baseMessage += `\n\n${suggestion}`

    return baseMessage
  }
}

// =============================================================================
// Http Response Error
// =============================================================================

/**
 * Schema for HTTP response details used in error reporting.
 *
 * Captures essential information about HTTP responses that caused errors,
 * including status codes and headers for debugging purposes.
 *
 * @example
 * ```ts
 * import type { AiError } from "effect/unstable/ai"
 *
 * const responseDetails: typeof AiError.HttpResponseDetails.Type = {
 *   status: 429,
 *   headers: {
 *     "Content-Type": "application/json",
 *     "X-RateLimit-Remaining": "0",
 *     "Retry-After": "60"
 *   }
 * }
 * ```
 *
 * @since 4.0.0
 * @category schemas
 */
export const HttpResponseDetails = Schema.Struct({
  status: Schema.Number,
  headers: Schema.Record(Schema.String, Schema.String)
}).annotate({ identifier: "HttpResponseDetails" })

/**
 * Error that occurs during HTTP response processing.
 *
 * This error is thrown when issues arise after receiving an HTTP response,
 * such as unexpected status codes, response decoding failures, or empty
 * response bodies.
 *
 * @example
 * ```ts
 * import { AiError } from "effect/unstable/ai"
 *
 * const responseError = new AiError.HttpResponseError({
 *   module: "OpenAI",
 *   method: "createCompletion",
 *   reason: "StatusCode",
 *   request: {
 *     method: "POST",
 *     url: "https://api.openai.com/v1/completions",
 *     urlParams: [],
 *     hash: undefined,
 *     headers: { "Content-Type": "application/json" }
 *   },
 *   response: {
 *     status: 429,
 *     headers: { "X-RateLimit-Remaining": "0" }
 *   },
 *   description: "Rate limit exceeded"
 * })
 *
 * console.log(responseError.message)
 * // "StatusCode: Rate limit exceeded (429 POST https://api.openai.com/v1/completions)"
 * ```
 *
 * @since 4.0.0
 * @category schemas
 */
export class HttpResponseError extends Schema.ErrorClass<HttpResponseError>(
  "effect/ai/AiError/HttpResponseError"
)({
  _tag: Schema.tag("HttpResponseError"),
  module: Schema.String,
  method: Schema.String,
  request: HttpRequestDetails,
  response: HttpResponseDetails,
  body: Schema.optional(Schema.String),
  reason: Schema.Literals(["StatusCode", "Decode", "EmptyBody"]),
  description: Schema.optional(Schema.String)
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Creates an HttpResponseError from a platform HttpClientError.ResponseError.
   *
   * @example
   * ```ts
   * import { AiError } from "effect/unstable/ai"
   * import type { HttpClientError } from "effect/unstable/http"
   *
   * declare const platformError: HttpClientError.ResponseError
   *
   * const aiError = AiError.HttpResponseError.fromResponseError({
   *   module: "OpenAI",
   *   method: "completion",
   *   error: platformError
   * })
   * ```
   *
   * @since 4.0.0
   * @category constructors
   */
  static fromResponseError({ error, ...params }: {
    readonly module: string
    readonly method: string
    readonly error: HttpClientError.ResponseError
  }): Effect.Effect<never, HttpResponseError> {
    let body: Effect.Effect<unknown, HttpClientError.ResponseError> = Effect.void
    const contentType = error.response.headers["content-type"] ?? ""
    if (contentType.includes("application/json")) {
      body = error.response.json
    } else if (contentType.includes("text/") || contentType.includes("urlencoded")) {
      body = error.response.text
    }
    return Effect.flatMap(
      Effect.matchEffect(body, {
        onFailure: Effect.succeed,
        onSuccess: Effect.succeed
      }),
      (body) =>
        Effect.fail(
          new HttpResponseError({
            ...params,
            description: error.description,
            reason: error.reason,
            request: {
              hash: error.request.hash,
              headers: redact(error.request.headers) as any,
              method: error.request.method,
              url: error.request.url,
              urlParams: Array.from(error.request.urlParams)
            },
            response: {
              headers: redact(error.response.headers) as any,
              status: error.response.status
            },
            body: format(redact(body))
          })
        )
    )
  }

  override get message(): string {
    const methodUrlStatus = `${this.response.status} ${this.request.method} ${this.request.url}`

    let baseMessage = this.description
      ? `${this.reason}: ${this.description}`
      : `${this.reason}: An HTTP response error occurred.`

    baseMessage += ` (${methodUrlStatus})`

    let suggestion = ""
    switch (this.reason) {
      case "Decode": {
        suggestion += "The response format does not match what is expected. " +
          "Verify API version compatibility, check response content-type, " +
          "and/or examine if the endpoint schema has changed."
        break
      }
      case "EmptyBody": {
        suggestion += "The response body was empty. This may indicate a server " +
          "issue, API version mismatch, or the endpoint may have changed its response format."
        break
      }
      case "StatusCode": {
        suggestion += getStatusCodeSuggestion(this.response.status)
        break
      }
    }

    baseMessage += `\n\n${suggestion}`

    if (Predicate.isNotUndefined(this.body)) {
      baseMessage += `\n\nResponse Body: ${this.body}`
    }

    return baseMessage
  }
}

// =============================================================================
// Malformed Input Error
// =============================================================================

/**
 * Error thrown when input data doesn't match the expected format or schema.
 *
 * This error occurs when the data provided to an AI operation fails validation,
 * is missing required fields, or doesn't conform to the expected structure.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const validateInput = Effect.fnUntraced(function*(data: unknown) {
 *   if (typeof data === "string" && data.length > 0) {
 *     return data
 *   }
 *   return yield* new AiError.MalformedInput({
 *     module: "ChatBot",
 *     method: "processMessage",
 *     description: "Input must be a non-empty string"
 *   })
 * })
 *
 * const program = validateInput("").pipe(
 *   Effect.catchTag("MalformedInput", (error) => {
 *     console.log(`Input validation failed: ${error.description}`)
 *     return Effect.succeed("Please provide a valid message")
 *   })
 * )
 * ```
 *
 * @since 4.0.0
 * @category schemas
 */
export class MalformedInput extends Schema.ErrorClass<MalformedInput>(
  "effect/ai/AiError/MalformedInput"
)({
  _tag: Schema.tag("MalformedInput"),
  module: Schema.String,
  method: Schema.String,
  description: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId
}

// =============================================================================
// Malformed Output Error
// =============================================================================

/**
 * Error thrown when output data can't be parsed or validated.
 *
 * This error occurs when AI service responses don't match the expected format,
 * contain invalid data structures, or fail schema validation during parsing.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Schema } from "effect/schema"
 * import { AiError } from "effect/unstable/ai"
 *
 * const ResponseSchema = Schema.Struct({
 *   message: Schema.String,
 *   tokens: Schema.Number
 * })
 *
 * const parseResponse = (data: unknown) =>
 *   Schema.decodeUnknownEffect(ResponseSchema)(data).pipe(
 *     Effect.mapError((schemaError) =>
 *       new AiError.MalformedOutput({
 *         module: "OpenAI",
 *         method: "completion",
 *         description: "Response doesn't match expected schema",
 *         cause: schemaError
 *       })
 *     )
 *   )
 *
 * const program = parseResponse({ invalid: "data" }).pipe(
 *   Effect.catchTag("MalformedOutput", (error) => {
 *     console.log(`Parsing failed: ${error.description}`)
 *     return Effect.succeed({ message: "Error", tokens: 0 })
 *   })
 * )
 * ```
 *
 * @since 4.0.0
 * @category schemas
 */
export class MalformedOutput extends Schema.ErrorClass<MalformedOutput>(
  "effect/ai/AiError/MalformedOutput"
)({
  _tag: Schema.tag("MalformedOutput"),
  module: Schema.String,
  method: Schema.String,
  description: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Creates a MalformedOutput error from a Schema ParseError.
   *
   * @example
   * ```ts
   * import { Effect } from "effect"
   * import { Schema } from "effect/schema"
   * import { AiError } from "effect/unstable/ai"
   *
   * const UserSchema = Schema.Struct({
   *   name: Schema.String,
   *   age: Schema.Number
   * })
   *
   * const parseUser = (data: unknown) =>
   *   Schema.decodeUnknownEffect(UserSchema)(data).pipe(
   *     Effect.mapError((parseError) =>
   *       AiError.MalformedOutput.fromSchemaError({
   *         module: "UserService",
   *         method: "parseUserData",
   *         error: parseError
   *       })
   *     )
   *   )
   * ```
   *
   * @since 4.0.0
   * @category constructors
   */
  static fromSchemaError({ error, ...params }: {
    readonly module: string
    readonly method: string
    readonly description?: string
    readonly error: Schema.SchemaError
  }): MalformedOutput {
    // TODO(Max): enhance
    return new MalformedOutput({
      ...params,
      cause: error
    })
  }
}

// =============================================================================
// Unknown Error
// =============================================================================

/**
 * Catch-all error for unexpected runtime errors in AI operations.
 *
 * This error is used when an unexpected exception occurs that doesn't fit
 * into the other specific error categories. It provides context about where
 * the error occurred and preserves the original cause for debugging.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const riskyOperation = () => {
 *   try {
 *     // Some operation that might throw
 *     throw new Error("Unexpected network issue")
 *   } catch (cause) {
 *     return Effect.fail(
 *       new AiError.UnknownError({
 *         module: "ChatService",
 *         method: "sendMessage",
 *         description: "An unexpected error occurred during message processing",
 *         cause
 *       })
 *     )
 *   }
 * }
 *
 * const program = riskyOperation().pipe(
 *   Effect.catchTag("UnknownError", (error) => {
 *     console.log(error.message)
 *     // "ChatService.sendMessage: An unexpected error occurred during message processing"
 *     return Effect.succeed("Service temporarily unavailable")
 *   })
 * )
 * ```
 *
 * @since 4.0.0
 * @category schemas
 */
export class UnknownError extends Schema.ErrorClass<UnknownError>(
  "effect/ai/AiError/UnknownError"
)({
  _tag: Schema.tag("UnknownError"),
  module: Schema.String,
  method: Schema.String,
  description: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  override get message(): string {
    const moduleMethod = `${this.module}.${this.method}`
    return Predicate.isUndefined(this.description)
      ? `${moduleMethod}: An error occurred`
      : `${moduleMethod}: ${this.description}`
  }
}

// =============================================================================
// AiError
// =============================================================================

/**
 * Union type representing all possible AI operation errors.
 *
 * This type encompasses all error cases that can occur during AI operations,
 * providing a comprehensive error handling surface for applications.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 * import type { AiError } from "effect/unstable/ai"
 *
 * const handleAnyAiError = Match.type<AiError.AiError>().pipe(
 *   Match.tag("HttpRequestError", (err) => `Network error: ${err.reason}`),
 *   Match.tag(
 *     "HttpResponseError",
 *     (err) => `Server error: HTTP ${err.response.status}`
 *   ),
 *   Match.tag(
 *     "MalformedInput",
 *     (err) => `Invalid input: ${err.description || "Data validation failed"}`
 *   ),
 *   Match.tag(
 *     "MalformedOutput",
 *     (err) => `Invalid response: ${err.description || "Response parsing failed"}`
 *   ),
 *   Match.orElse((err) => `Unknown error: ${err.message}`)
 * )
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export type AiError =
  | HttpRequestError
  | HttpResponseError
  | MalformedInput
  | MalformedOutput
  | UnknownError

/**
 * Schema for validating and parsing AI errors.
 *
 * This schema can be used to decode unknown values into properly typed AI
 * errors, ensuring type safety when handling errors from external sources or
 * serialized data.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Schema } from "effect/schema"
 * import { AiError } from "effect/unstable/ai"
 *
 * const parseAiError = (data: unknown) =>
 *   Schema.decodeUnknownEffect(AiError.AiError)(data).pipe(
 *     Effect.map((error) => {
 *       console.log(`Parsed AI error: ${error._tag}`)
 *       return error
 *     }),
 *     Effect.catch(() =>
 *       Effect.succeed(
 *         new AiError.UnknownError({
 *           module: "Parser",
 *           method: "parseAiError",
 *           description: "Failed to parse error data"
 *         })
 *       )
 *     )
 *   )
 * ```
 *
 * @since 4.0.0
 * @category schemas
 */
export const AiError: Schema.Union<[
  typeof HttpRequestError,
  typeof HttpResponseError,
  typeof MalformedInput,
  typeof MalformedOutput,
  typeof UnknownError
]> = Schema.Union([
  HttpRequestError,
  HttpResponseError,
  MalformedInput,
  MalformedOutput,
  UnknownError
])

// =============================================================================
// Utilities
// =============================================================================

const getStatusCodeSuggestion = (statusCode: number): string => {
  if (statusCode >= 400 && statusCode < 500) {
    switch (statusCode) {
      case 400:
        return "Bad Request - Check request parameters, headers, and body format against API documentation."
      case 401:
        return "Unauthorized - Verify API key, authentication credentials, or token expiration."
      case 403:
        return "Forbidden - Check API permissions, usage limits, or resource access rights."
      case 404:
        return "Not Found - Verify the endpoint URL, API version, and resource identifiers."
      case 408:
        return "Request Timeout - Consider increasing timeout duration or implementing retry logic."
      case 422:
        return "Unprocessable Entity - Check request data validation, required fields, and data formats."
      case 429:
        return "Rate Limited - Implement exponential backoff or reduce request frequency."
      default:
        return "Client error - Review request format, parameters, and API documentation."
    }
  } else if (statusCode >= 500) {
    return "Server error - This is likely temporary. Implement retry logic with exponential backoff."
  } else {
    return "Check API documentation for this status code."
  }
}
