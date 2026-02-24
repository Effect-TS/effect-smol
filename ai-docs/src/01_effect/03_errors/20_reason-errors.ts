/**
 * @title Creating and handling errors with reasons
 *
 * Define a tagged error with a tagged `reason` field, then recover with
 * `Effect.catchReason`, `Effect.catchReasons`, or by unwrapping the reason into
 * the error channel with `Effect.unwrapReason`.
 */

import { Data, Effect } from "effect"

export class RateLimitError extends Data.TaggedError("RateLimitError")<{
  readonly retryAfter: number
}> {}

export class QuotaExceededError extends Data.TaggedError("QuotaExceededError")<{
  readonly limit: number
}> {}

export class SafetyBlockedError extends Data.TaggedError("SafetyBlockedError")<{
  readonly category: string
}> {}

export class AiError extends Data.TaggedError("AiError")<{
  readonly reason: RateLimitError | QuotaExceededError | SafetyBlockedError
}> {}

declare const callModel: Effect.Effect<string, AiError>

export const handleOneReason = callModel.pipe(
  Effect.catchReason(
    "AiError",
    "RateLimitError",
    (reason) => Effect.succeed(`Retry after ${reason.retryAfter} seconds`),
    // `orElse` is the fallback for all non-matching reasons.
    (reason) => Effect.succeed(`Model call failed for reason: ${reason._tag}`)
  )
)

export const handleMultipleReasons = callModel.pipe(
  Effect.catchReasons(
    "AiError",
    {
      RateLimitError: (reason) => Effect.succeed(`Retry after ${reason.retryAfter} seconds`),
      QuotaExceededError: (reason) => Effect.succeed(`Quota exceeded at ${reason.limit} tokens`)
    },
    // Fallback for reasons not present in the handlers object.
    (reason) => Effect.succeed(`Unhandled reason: ${reason._tag}`)
  )
)

export const unwrapAndHandle = callModel.pipe(
  // Convert `AiError` into its nested reason union.
  Effect.unwrapReason("AiError"),
  Effect.catchTag("RateLimitError", (reason) => Effect.succeed(`Back off for ${reason.retryAfter} seconds`)),
  Effect.catchTag("QuotaExceededError", (reason) => Effect.succeed(`Increase quota beyond ${reason.limit}`)),
  Effect.catchTag("SafetyBlockedError", (reason) => Effect.succeed(`Blocked by safety category: ${reason.category}`))
)
