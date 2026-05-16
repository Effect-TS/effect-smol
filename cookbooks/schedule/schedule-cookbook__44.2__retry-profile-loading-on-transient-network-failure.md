---
book: Effect `Schedule` Cookbook
section_number: "44.2"
section_title: "Retry profile loading on transient network failure"
part_title: "Part X — Real-World Recipes"
chapter_title: "44. Frontend and Client Recipes"
status: "draft"
code_included: true
---

# 44.2 Retry profile loading on transient network failure

A profile screen can recover from a short network interruption, a dropped mobile
connection, or a brief `503` from the profile API. It should not keep retrying a
bad request, an unauthorized session, or a missing user. Put that distinction in
the error model, then let `Schedule` describe how many follow-up attempts are
allowed and how quickly they happen.

## Problem

You need to load the signed-in user's profile in a frontend flow. The initial
request may fail for reasons that are worth retrying, such as the browser being
temporarily offline or the server returning `502`, `503`, or `504`. Other
failures are terminal for this interaction and should reach the UI immediately.

The retry policy should therefore do two jobs:

- retry only classified transient network failures
- stop after a small number of retries so the screen can show an actionable
  failure state

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
`Effect.retry` feeds each failure into the schedule, add `Schedule.while` to
continue only while the failure is classified as transient.

The combined schedule stops as soon as either condition stops recurring: the
error is no longer transient, or the retry count has been exhausted.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

interface Profile {
  readonly id: string
  readonly name: string
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

const classifyStatus = (response: Response): ProfileLoadError => {
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

const retryTransientProfileLoad = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3)),
  Schedule.setInputType<ProfileLoadError>(),
  Schedule.while(({ input }) => Effect.succeed(isTransient(input)))
)

const decodeProfile = (response: Response) =>
  Effect.tryPromise({
    try: () => response.json() as Promise<Profile>,
    catch: (cause) => new ProfileLoadError({ reason: "BadResponse", cause })
  })

const fetchProfile = (userId: string) =>
  Effect.tryPromise({
    try: (signal) => fetch(`/api/profile/${userId}`, { signal }),
    catch: (cause) => new ProfileLoadError({ reason: "Offline", cause })
  }).pipe(
    Effect.flatMap((response) =>
      response.ok
        ? decodeProfile(response)
        : Effect.fail(classifyStatus(response))
    )
  )

export const loadProfile = (userId: string) =>
  Effect.retry(fetchProfile(userId), retryTransientProfileLoad)
```

## Variants

For a more latency-sensitive screen, reduce the cap to one or two retries. For a
less critical background refresh, increase the base delay and keep the cap
explicit. If the server returns a structured rate-limit response, classify it
separately instead of treating every `429` as an ordinary network failure.

## Notes and caveats

`Schedule.recurs(3)` allows three retries after the first profile request. With
the exponential schedule above, the planned delays start around 200ms, 400ms,
and 800ms before jitter is applied. `Schedule.jittered` randomly adjusts each
delay between 80% and 120% of the base delay.

Keep classification close to the HTTP boundary. The schedule should not parse
responses or guess whether a status is retryable; it should receive a domain
error and decide whether recurrence is still allowed.
