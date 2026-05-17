---
book: Effect `Schedule` Cookbook
section_number: "43.1"
section_title: "Retry HTTP GET on timeout"
part_title: "Part X — Real-World Recipes"
chapter_title: "43. Backend Recipes"
status: "draft"
code_included: true
---

# 43.1 Retry HTTP GET on timeout

HTTP GET retries are useful only when the read is safe and the failure is truly
transient.

## Problem

You call a downstream HTTP endpoint with `GET /users/:id`. The request can fail
because the client timed out, because the server returned a non-success status,
or because the response could not be decoded.

Only the timeout is considered transient in this recipe. A `404`, `401`, `403`,
or decode failure should return immediately. Retrying those failures adds load
without making the request more likely to become valid.

Use `Effect.retry` with a typed `while` predicate and a finite `Schedule`.

## When to use it

Use this policy for HTTP GET calls where the operation is safe to run again and
the caller can tolerate a short delay. It fits metadata lookups, status reads,
configuration fetches, and other read paths where the remote side treats
duplicate requests as the same request.

The retryable condition should be explicit in the error model. A timeout tag is
better than parsing an exception message or retrying a broad `unknown` failure.

## When not to use it

Do not retry a GET blindly if the endpoint has side effects, starts work, marks
records as viewed, advances a cursor, or depends on one-time credentials. HTTP
method names are a useful signal, but the real safety property is the endpoint's
behavior.

Do not retry permanent failures. Authentication, authorization, malformed
requests, missing resources, and decoding problems should fail fast unless your
domain has a specific reason to classify them as transient.

Do not leave the schedule unbounded. `Schedule.exponential("100 millis")` by
itself can keep recurring. Add a retry count, elapsed budget, or both.

## Schedule shape

The policy has two parts:

- `while` classifies the typed failure and allows only timeout failures through
- `Schedule` controls spacing and termination for the accepted timeout failures

```ts
const retryGetTimeouts = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3)),
  Schedule.both(Schedule.during("2 seconds"))
)
```

`Schedule.exponential` backs off after each accepted failure. `Schedule.jittered`
spreads retries so many callers do not retry at exactly the same moments.
`Schedule.recurs(3)` allows at most three retries after the original request.
`Schedule.during("2 seconds")` adds a wall-clock budget; because `both` recurs
only while both schedules recur, whichever limit stops first ends the retry.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

interface User {
  readonly id: string
  readonly name: string
}

class HttpTimeout extends Data.TaggedError("HttpTimeout")<{
  readonly url: string
}> {}

class HttpStatusError extends Data.TaggedError("HttpStatusError")<{
  readonly url: string
  readonly status: number
}> {}

class DecodeError extends Data.TaggedError("DecodeError")<{
  readonly message: string
}> {}

type GetUserError = HttpTimeout | HttpStatusError | DecodeError

declare const httpGetJson: (
  url: string
) => Effect.Effect<unknown, HttpTimeout | HttpStatusError>

declare const decodeUser: (body: unknown) => Effect.Effect<User, DecodeError>

const getUser = Effect.fnUntraced(function*(id: string) {
  const url = `/users/${id}`
  const body = yield* httpGetJson(url)
  return yield* decodeUser(body)
})

const isHttpTimeout = (error: GetUserError): error is HttpTimeout =>
  error._tag === "HttpTimeout"

const retryGetTimeouts = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3)),
  Schedule.both(Schedule.during("2 seconds"))
)

export const program = getUser("user-123").pipe(
  Effect.retry({
    schedule: retryGetTimeouts,
    while: isHttpTimeout
  })
)
```

`program` performs the GET once immediately. If `httpGetJson` fails with
`HttpTimeout`, `Effect.retry` waits according to `retryGetTimeouts` and tries
again while the retry count and elapsed budget still allow it.

If the request fails with `HttpStatusError`, or if decoding fails with
`DecodeError`, `isHttpTimeout` returns `false` and the failure is returned
without another HTTP request.

## Variants

For an interactive request path, use fewer retries or a smaller elapsed budget:

```ts
const interactiveGetRetry = Schedule.exponential("50 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(2)),
  Schedule.both(Schedule.during("500 millis"))
)
```

For a background read path, the same timeout classification can use a wider
policy:

```ts
const backgroundGetRetry = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5)),
  Schedule.both(Schedule.during("10 seconds"))
)
```

Keep the predicate separate from the schedule. The predicate answers whether the
failure is retryable; the schedule answers how retrying proceeds once the
failure has been accepted.

## Notes and caveats

`Effect.retry` feeds typed failures from the effect's error channel into the
retry policy. The first HTTP request is not delayed. Schedule delays apply only
after a failure is accepted by `while`.

Timeouts are ambiguous. The server may have produced a response that the client
did not receive, or the request may not have reached the server at all. Retrying
a GET is normally reasonable because GET should be idempotent, but verify that
the specific endpoint does not perform unsafe work.

Bounded retry is part of the contract. A small `Schedule.recurs` limit protects
the downstream service from unbounded pressure, and `Schedule.during` protects
the caller from spending too long on one dependency.
