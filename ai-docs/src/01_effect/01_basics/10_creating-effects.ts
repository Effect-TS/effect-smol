/**
 * @title Creating effects from common data sources
 *
 * Learn how to create effects from various sources, including plain values,
 * synchronous and asynchronous code, optional values, and callback-based APIs.
 */
import { Effect, Result, Schema } from "effect"

class InvalidPayload extends Schema.TaggedErrorClass<InvalidPayload>()("InvalidPayload", {
  input: Schema.String,
  cause: Schema.Defect
}) {}

class UserLookupError extends Schema.TaggedErrorClass<UserLookupError>()("UserLookupError", {
  userId: Schema.Number,
  cause: Schema.Defect
}) {}

class MissingWorkspaceId extends Schema.TaggedErrorClass<MissingWorkspaceId>()("MissingWorkspaceId", {}) {}

// `Effect.succeed` wraps values you already have in memory.
export const fromValue = Effect.succeed({ env: "prod", retries: 3 })

let processedEvents = 0

// `Effect.sync` wraps synchronous side effects that should not throw.
export const fromSyncSideEffect = Effect.sync(() => {
  processedEvents += 1
  return processedEvents
})

// `Effect.try` wraps synchronous code that may throw.
export const parsePayload = Effect.fnUntraced(function*(input: string) {
  return yield* Effect.try({
    try: () => JSON.parse(input) as { readonly userId: number },
    catch: (cause) => new InvalidPayload({ input, cause })
  })
})

const users = new Map<number, { readonly id: number; readonly name: string }>([
  [1, { id: 1, name: "Ada" }],
  [2, { id: 2, name: "Lin" }]
])

// `Effect.tryPromise` wraps Promise-based APIs that can reject or throw.
export const fetchUser = Effect.fnUntraced(function*(userId: number) {
  return yield* Effect.tryPromise({
    try: async () => {
      const user = users.get(userId)
      if (!user) {
        throw new Error(`Missing user ${userId}`)
      }
      return user
    },
    catch: (cause) => new UserLookupError({ userId, cause })
  })
})

// `Effect.fromResult` converts validation/parsing results into an effect.
export const fromResult = Effect.fromResult(
  Result.succeed({ region: "us-east-1" })
)

// `Effect.fromNullishOr` turns nullable values into a typed effect.
export const fromNullableConfig = Effect.fromNullishOr("team-a").pipe(
  Effect.mapError(() => new MissingWorkspaceId())
)

// `Effect.callback` wraps callback-style asynchronous APIs.
export const fromCallback = Effect.callback<number>((resume) => {
  const timeoutId = setTimeout(() => {
    resume(Effect.succeed(200))
  }, 10)

  // Return a finalizer so interruption can cancel the callback source.
  return Effect.sync(() => {
    clearTimeout(timeoutId)
  })
})
