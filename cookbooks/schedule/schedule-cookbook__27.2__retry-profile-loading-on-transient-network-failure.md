---
book: "Effect `Schedule` Cookbook"
section_number: "27.2"
section_title: "Retry profile loading on transient network failure"
part_title: "Part VII — Real-World Recipes"
chapter_title: "27. Frontend and Client Recipes"
status: "draft"
code_included: true
---

# 27.2 Retry profile loading on transient network failure

Profile reads are user-facing, but they are usually safe to retry only when the
failure is clearly transient.

## Problem

You need to load the signed-in user's profile in a frontend flow. The initial
request may fail for reasons that are worth retrying, such as the browser being
temporarily offline or the server returning `502`, `503`, or `504`. Other
failures are terminal for this interaction and should reach the UI immediately.

The retry policy should retry only classified transient failures and stop after
a small number of attempts so the screen can show an actionable failure state.

## When to use it

Use this recipe for idempotent profile reads where a short delay is acceptable
and a successful retry improves the user experience. It fits page boot, account
menus, settings screens, and other client reads where the same GET can be safely
attempted again.

## When not to use it

Do not use this policy for authentication failures, validation errors, `404`
responses, or other outcomes that another attempt cannot fix. Also avoid it for
profile writes: changing display names, avatars, or preferences needs separate
idempotency and conflict-handling rules.

## Schedule shape

Use a short exponential backoff, add jitter so many clients do not retry at the
same instant, and combine it with `Schedule.recurs` to cap retries. Because
`Effect.retry` sees each typed failure, use the retry `while` predicate to
continue only while the failure is classified as transient.

The combined schedule stops as soon as either condition stops recurring: the
error is no longer transient, or the retry count has been exhausted.

## Example

```ts
import { Console, Data, Effect, Schedule } from "effect"

interface Profile {
  readonly id: string
  readonly name: string
}

interface HttpResponse {
  readonly status: number
  readonly body: unknown
}

class ProfileLoadError extends Data.TaggedError("ProfileLoadError")<{
  readonly reason:
    | "BadResponse"
    | "Forbidden"
    | "NotFound"
    | "Offline"
    | "ServerUnavailable"
  readonly status?: number
  readonly cause?: unknown
}> {}

const isTransient = (error: ProfileLoadError): boolean =>
  error.reason === "Offline" || error.reason === "ServerUnavailable"

const classifyHttpStatus = (response: HttpResponse): ProfileLoadError => {
  if (response.status === 401 || response.status === 403) {
    return new ProfileLoadError({ reason: "Forbidden", status: response.status })
  }
  if (response.status === 404) {
    return new ProfileLoadError({ reason: "NotFound", status: response.status })
  }
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    return new ProfileLoadError({ reason: "ServerUnavailable", status: response.status })
  }
  return new ProfileLoadError({ reason: "BadResponse", status: response.status })
}

const retryTransientProfileLoad = Schedule.exponential("10 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3))
)

const decodeProfile = (body: unknown): Effect.Effect<Profile, ProfileLoadError> => {
  if (
    typeof body === "object" &&
    body !== null &&
    "id" in body &&
    "name" in body &&
    typeof body.id === "string" &&
    typeof body.name === "string"
  ) {
    return Effect.succeed({ id: body.id, name: body.name })
  }
  return Effect.fail(new ProfileLoadError({ reason: "BadResponse", cause: body }))
}

let attempts = 0

const requestProfile = (userId: string): Effect.Effect<HttpResponse, ProfileLoadError> =>
  Effect.gen(function*() {
    attempts += 1
    yield* Console.log(`load profile ${userId}, attempt ${attempts}`)

    if (attempts === 1) {
      return yield* Effect.fail(new ProfileLoadError({ reason: "Offline" }))
    }
    if (attempts === 2) {
      return { status: 503, body: "service unavailable" }
    }
    return { status: 200, body: { id: userId, name: "Ada" } }
  })

const fetchProfile = (userId: string): Effect.Effect<Profile, ProfileLoadError> =>
  requestProfile(userId).pipe(
    Effect.flatMap((response) =>
      response.status === 200
        ? decodeProfile(response.body)
        : Effect.fail(classifyHttpStatus(response))
    )
  )

const loadProfile = (userId: string) =>
  fetchProfile(userId).pipe(
    Effect.retry({
      schedule: retryTransientProfileLoad,
      while: isTransient
    }),
    Effect.tap((profile) => Console.log(`loaded ${profile.name}`))
  )

Effect.runPromise(loadProfile("user-123")).then(console.log, console.error)
```

## Variants

For a more latency-sensitive screen, reduce the cap to one or two retries. For a
less critical background refresh, increase the base delay and keep the cap
explicit. If the server returns a structured rate-limit response, classify it
separately instead of treating every `429` as an ordinary network failure.

## Notes and caveats

`Schedule.recurs(3)` allows three retries after the first profile request. The
example uses tiny delays so it terminates quickly; use larger delays for a real
frontend path. `Schedule.jittered` randomly adjusts each delay between 80% and
120% of the base delay.

Keep classification close to the HTTP boundary. The schedule should not parse
responses or guess whether a status is retryable; it should receive a domain
error and decide whether recurrence is still allowed.
