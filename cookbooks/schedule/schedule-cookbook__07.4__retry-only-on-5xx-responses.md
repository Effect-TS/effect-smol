---
book: "Effect `Schedule` Cookbook"
section_number: "7.4"
section_title: "Retry only on 5xx responses"
part_title: "Part II — Retry Recipes"
chapter_title: "7. Error-Aware Retries"
status: "draft"
code_included: true
---

# 7.4 Retry only on 5xx responses

Use this when an HTTP adapter should retry temporary server responses but
return client-side failures immediately.

## Problem

Keep the HTTP status in the typed error and retry only responses from 500
through 599. Server failures such as 500, 502, 503, and 504 may be temporary.
Most 4xx statuses need a different request, resource, or credential.

## When to use it

Use this when the effect's error channel contains a structured HTTP response
error. It fits service clients, API adapters, webhooks, and gateway calls where
retryability follows the response class.

It is safest for idempotent reads and duplicate-safe writes. A 5xx response
does not prove the server skipped the side effect.

## When not to use it

Do not retry all HTTP failures. Most 4xx statuses represent request,
authorization, missing-resource, or conflict failures.

Do not treat this as a rate-limit policy. `429 Too Many Requests` is not a 5xx
response and usually needs timing from `Retry-After`, caller budgets, or
admission control.

## Schedule shape

`Effect.retry` feeds each typed HTTP failure to the `while` predicate. If the
predicate returns `false`, retrying stops with that failure. If it returns
`true`, the finite schedule decides whether another retry is available and how
long to wait.

For most clients, combine the predicate with a finite backoff schedule.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

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

const is5xxResponse = (error: HttpResponseError): boolean =>
  error.status >= 500 && error.status < 600

const retryWithBackoff = Schedule.exponential("50 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

const makeRequestUser = (
  label: string,
  failures: ReadonlyArray<HttpResponseError>
): Effect.Effect<User, HttpResponseError> => {
  let attempt = 0

  return Effect.gen(function*() {
    attempt += 1
    yield* Console.log(`${label}: HTTP attempt ${attempt}`)

    const failure = failures[attempt - 1]
    if (failure !== undefined) {
      return yield* Effect.fail(failure)
    }

    return { id: "user-123", name: "Ada" }
  })
}

const runRequest = (
  label: string,
  request: Effect.Effect<User, HttpResponseError>
) =>
  request.pipe(
    Effect.retry({
      schedule: retryWithBackoff,
      while: is5xxResponse
    }),
    Effect.matchEffect({
      onFailure: (error) => Console.log(`${label}: failed with HTTP ${error.status}`),
      onSuccess: (user) => Console.log(`${label}: user ${user.name}`)
    })
  )

const program = Effect.gen(function*() {
  yield* runRequest(
    "server-recovers",
    makeRequestUser("server-recovers", [
      new HttpResponseError({ method: "GET", url: "/users/123", status: 503 }),
      new HttpResponseError({ method: "GET", url: "/users/123", status: 502 })
    ])
  )

  yield* runRequest(
    "client-error",
    makeRequestUser("client-error", [
      new HttpResponseError({ method: "GET", url: "/users/missing", status: 404 })
    ])
  )
})

Effect.runPromise(program)
```

The server-error case retries and succeeds. The 404 case stops immediately.

## Variants and caveats

Use an allow-list when some 5xx responses are permanent for your API, for
example retrying 500, 502, 503, and 504 but not 501.

Use `status >= 500 && status < 600` unless your adapter intentionally treats
nonstandard status codes as server failures.

Keep rate limiting as a sibling policy. A `429` may be retryable, but it
usually needs different timing and admission-control behavior from generic 5xx
responses.
