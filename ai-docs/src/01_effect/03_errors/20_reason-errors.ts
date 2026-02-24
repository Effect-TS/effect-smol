/**
 * @title Creating and handling errors with reasons
 *
 * Define a tagged error with a tagged `reason` field, then recover with
 * `Effect.catchReason`, `Effect.catchReasons`, or by unwrapping the reason into
 * the error channel with `Effect.unwrapReason`.
 */

import { Effect, Schema } from "effect"

export class RateLimitError extends Schema.TaggedErrorClass<RateLimitError>()("RateLimitError", {
  retryAfter: Schema.Number
}) {}

export class QuotaExceededError extends Schema.TaggedErrorClass<QuotaExceededError>()("QuotaExceededError", {
  limit: Schema.Number
}) {}

export class SafetyBlockedError extends Schema.TaggedErrorClass<SafetyBlockedError>()("SafetyBlockedError", {
  category: Schema.String
}) {}

export class AiError extends Schema.TaggedErrorClass<AiError>()("AiError", {
  reason: Schema.Union([RateLimitError, QuotaExceededError, SafetyBlockedError])
}) {}

declare const callModel: Effect.Effect<string, AiError>

export const handleOneReason = callModel.pipe(
  Effect.catchReason(
    "AiError",
    "RateLimitError",
    (reason) => Effect.succeed(`Retry after ${reason.retryAfter} seconds`),
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
    (reason) => Effect.succeed(`Unhandled reason: ${reason._tag}`)
  )
)

export const unwrapAndHandle = callModel.pipe(
  Effect.unwrapReason("AiError"),
  Effect.catchTags({
    RateLimitError: (reason) => Effect.succeed(`Back off for ${reason.retryAfter} seconds`),
    QuotaExceededError: (reason) => Effect.succeed(`Increase quota beyond ${reason.limit}`),
    SafetyBlockedError: (reason) => Effect.succeed(`Blocked by safety category: ${reason.category}`)
  })
)
