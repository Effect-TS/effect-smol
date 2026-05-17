---
book: Effect `Schedule` Cookbook
section_number: "10.4"
section_title: "Retry only on 5xx responses"
part_title: "Part II — Core Retry Recipes"
chapter_title: "10. Retry Only When It Makes Sense"
status: "draft"
code_included: true
---

# 10.4 Retry only on 5xx responses

Use this recipe when an HTTP adapter should retry temporary server responses
but return client-side failures immediately. The schedule controls timing and
limits; a status predicate decides whether the current typed response is
retryable.

## Problem

Keep the HTTP status in the typed error and retry only statuses from 500
through 599. Server-side failures such as 500, 502, 503, and 504 may be
temporary; 400, 401, 403, and 404 usually need a different request or different
credentials.

Put the retry decision in `Effect.retry`:

```ts
const program = requestUser("user-123").pipe(
  Effect.retry({
    schedule: retryWithBackoff,
    while: is5xxResponse
  })
)
```

The schedule controls timing and retry limits. The `while` predicate controls
whether the current typed HTTP failure is eligible for retry at all.

## When to use it

Use this recipe when the effect's error channel contains an HTTP response error
with a structured status code. It fits service clients, API adapters, webhooks,
and gateway calls where the caller should retry temporary server-side failures
but return client-side failures immediately.

It is most useful for idempotent reads and duplicate-safe writes. Retrying the
same request after a 5xx response can still run the operation more than once
from the caller's point of view, so writes need an idempotency key, transaction
boundary, or another domain guarantee.

Use a status predicate when retryability is defined by the HTTP response class.
If your domain has more precise error tags, keep those tags and have the
predicate read from them instead of parsing messages.

## When not to use it

Do not retry all HTTP failures. Most 4xx statuses represent a request problem,
authorization problem, missing resource, or conflict that waiting will not fix.

Do not treat this as a complete rate-limit policy. `429 Too Many Requests` is
not a 5xx response; it usually needs a policy that understands `Retry-After`,
caller budgets, or admission control.

Do not retry non-idempotent work only because the server returned 5xx. The
client may not know whether the server performed the side effect before
returning the error.

## Schedule shape

With `Effect.retry`, the schedule input is the typed failure from the effect.
The retry options accept a `while` predicate over that same error type:

```ts
while?: (error: E) => boolean | Effect.Effect<boolean, any, any>
schedule?: Schedule.Schedule<any, E, any, any>
```

Here `E` is the effect's error type. In this recipe, `E` is a typed HTTP
response error with a numeric status. The predicate returns `true` only for
statuses from `500` through `599`.

If the predicate returns `false`, retrying stops and `Effect.retry` propagates
that typed failure. If the predicate returns `true`, the schedule decides
whether another retry is still available and how long to wait before it.

For real HTTP calls, combine the status predicate with a finite delay policy:

```ts
const retryWithBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)
```

`Schedule.exponential("100 millis")` supplies the retry delay. `Schedule.recurs(3)`
allows at most three retries after the original attempt. `Schedule.both`
requires both schedules to continue, so the policy stops when the retry count
is exhausted.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

type HttpStatus =
  | 400
  | 401
  | 403
  | 404
  | 409
  | 422
  | 500
  | 501
  | 502
  | 503
  | 504

class HttpResponseError extends Data.TaggedError("HttpResponseError")<{
  readonly method: "GET" | "POST"
  readonly url: string
  readonly status: HttpStatus
}> {}

interface User {
  readonly id: string
  readonly name: string
}

declare const requestUser: (
  id: string
) => Effect.Effect<User, HttpResponseError>

const is5xxResponse = (error: HttpResponseError): boolean => error.status >= 500 && error.status < 600

const retryWithBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

const program = requestUser("user-123").pipe(
  Effect.retry({
    schedule: retryWithBackoff,
    while: is5xxResponse
  })
)
```

`program` calls `requestUser("user-123")` once immediately. If the call fails
with a typed `HttpResponseError` whose status is in the 5xx range, it retries
with exponential backoff for at most three retries.

If the call fails with `400`, `401`, `403`, `404`, `409`, or `422`, the
predicate returns `false` and retrying stops immediately. If all permitted
retries fail with 5xx responses, `Effect.retry` propagates the last
`HttpResponseError`.

## Variants

Use an allow-list when your API has 5xx statuses that should not be retried:

```ts
const isRetryableServerResponse = (error: HttpResponseError): boolean =>
  error.status === 500 ||
  error.status === 502 ||
  error.status === 503 ||
  error.status === 504
```

This keeps `501 Not Implemented` out of the retry set even though it is a 5xx
status.

Use `times` when the retry count is local to one call site:

```ts
const program = requestUser("user-123").pipe(
  Effect.retry({
    schedule: Schedule.exponential("100 millis"),
    times: 3,
    while: is5xxResponse
  })
)
```

This has the same retry-count meaning as `Schedule.recurs(3)`: three retries
after the original attempt.

Use schedule input filtering when the retry decision belongs inside a reusable
schedule builder:

```ts
const program = requestUser("user-123").pipe(
  Effect.retry(($) =>
    $(Schedule.exponential("100 millis")).pipe(
      Schedule.while(({ input }) => is5xxResponse(input)),
      Schedule.both(Schedule.recurs(3))
    )
  )
)
```

The builder gives the schedule the effect's error type as its input type, so
`input` is typed as `HttpResponseError` inside `Schedule.while`.

## Notes and caveats

`Effect.retry` retries typed failures from the error channel. Defects and fiber
interruptions are not retried as typed failures.

The first HTTP request is not delayed. A `while` predicate that returns `false`
for the first failure prevents the second request; it does not prevent the
original request from running.

The status check should be explicit about the upper bound. Prefer
`status >= 500 && status < 600` over `status >= 500` unless your adapter
intentionally treats nonstandard status codes the same way.

Some 5xx responses are not useful to retry for every API. If a service uses
`501`, `505`, or another server status as a permanent capability signal, use an
allow-list instead of the whole 5xx range.

Keep rate limiting as a sibling policy, not an accidental part of this one. A
`429` response may be retryable, but it usually needs timing from server
headers or a separate client-side budget.
