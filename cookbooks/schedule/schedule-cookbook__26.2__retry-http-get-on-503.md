---
book: "Effect `Schedule` Cookbook"
section_number: "26.2"
section_title: "Retry HTTP GET on 503"
part_title: "Part VII — Real-World Recipes"
chapter_title: "26. Backend Recipes"
status: "draft"
code_included: true
---

# 26.2 Retry HTTP GET on 503

A `503 Service Unavailable` response can be retryable for an idempotent HTTP
`GET`. Keep it narrower than a generic HTTP retry policy.

## Problem

You fetch a resource with `GET`. If the service responds with `503`, retry
briefly with backoff. If it responds with any other failure, return that failure
to the caller immediately.

The predicate decides whether the current typed failure is retryable. The
schedule decides when another attempt is allowed and when retrying stops.

## When to use it

Use this for idempotent HTTP reads where a `503` really means temporary
unavailability: dependency warm-up, rolling deploys, overloaded gateways, or a
backend pool with short-lived capacity trouble.

It is a good fit when callers need an answer quickly but a small number of
retries can hide brief service interruptions.

## When not to use it

Do not retry every HTTP status. A `400 Bad Request`, `401 Unauthorized`,
`403 Forbidden`, `404 Not Found`, or `422 Unprocessable Entity` usually needs a
different request, credentials, or domain decision.

Do not treat `503` as the same thing as `429 Too Many Requests`. A rate-limit
response often needs `Retry-After` handling, client-side admission control, or a
different budget.

Do not apply this recipe blindly to writes. `GET` is normally safe to retry; a
non-idempotent `POST` needs an idempotency key or another duplicate-safety
guarantee before adding retries.

## Schedule shape

With `Effect.retry`, failures from the error channel are the schedule inputs.
Use the options form when retryability is a predicate over the typed error.

Start with `Schedule.exponential`, then intersect it with explicit limits using
`Schedule.both`. The combined schedule recurs only while both sides still allow
another recurrence. For example, a backoff schedule combined with
`Schedule.recurs(4)` and `Schedule.during("3 seconds")` allows at most four
retries after the first request, and only while the elapsed retry budget is
still open.

Add `Schedule.jittered` when many instances may hit the same service at once.
It adjusts each recurrence delay between 80% and 120% of the original delay,
which helps avoid synchronized retry waves.

## Example

```ts
import { Console, Data, Effect, Schedule } from "effect"

type HttpStatus = 200 | 400 | 401 | 403 | 404 | 429 | 500 | 502 | 503 | 504

interface HttpResponse {
  readonly status: HttpStatus
  readonly body: string
}

class TransportError extends Data.TaggedError("TransportError")<{
  readonly url: string
  readonly reason: string
}> {}

class HttpResponseError extends Data.TaggedError("HttpResponseError")<{
  readonly method: "GET"
  readonly url: string
  readonly status: Exclude<HttpStatus, 200>
}> {}

type GetCatalogError = TransportError | HttpResponseError

let attempts = 0

const rawGet = (url: string): Effect.Effect<HttpResponse, TransportError> =>
  Effect.gen(function*() {
    attempts += 1
    yield* Console.log(`GET ${url}, attempt ${attempts}`)

    if (attempts <= 2) {
      return { status: 503, body: "warming up" }
    }

    return { status: 200, body: "catalog-v1" }
  })

const classifyGetResponse = (
  url: string,
  response: HttpResponse
): Effect.Effect<string, HttpResponseError> =>
  response.status === 200
    ? Effect.succeed(response.body)
    : Effect.fail(
        new HttpResponseError({
          method: "GET",
          url,
          status: response.status as Exclude<HttpStatus, 200>
        })
      )

const getCatalog = (url: string): Effect.Effect<string, GetCatalogError> =>
  rawGet(url).pipe(
    Effect.flatMap((response) => classifyGetResponse(url, response))
  )

const isServiceUnavailableGet = (error: GetCatalogError): boolean =>
  error._tag === "HttpResponseError" &&
  error.method === "GET" &&
  error.status === 503

const retry503WithBackoff = Schedule.exponential("10 millis").pipe(
  Schedule.both(Schedule.recurs(4)),
  Schedule.both(Schedule.during("300 millis")),
  Schedule.jittered
)

const program = getCatalog("https://api.example.test/catalog").pipe(
  Effect.retry({
    schedule: retry503WithBackoff,
    while: isServiceUnavailableGet
  }),
  Effect.tap((body) => Console.log(`received ${body}`))
)

Effect.runPromise(program).then(console.log, console.error)
```

The example uses short delays so it finishes quickly. The first `GET` is sent
immediately. A `503` is retried; any other status is surfaced immediately.

If the transport layer fails with `TransportError`, this policy also does not
retry it. That can be a separate timeout or network-failure recipe.

If every permitted retry still receives `503`, retrying stops when the count
limit or elapsed-time limit is exhausted, and the last typed failure is
propagated.

## Variants

Use a count-only policy when elapsed time is less important than a fixed number
of attempts. Use a shorter user-facing budget when the caller is waiting.

If you want the reusable schedule itself to carry the 503 filter, use
`Schedule.while(({ input }) => isServiceUnavailableGet(input))` after setting
the schedule input type to the HTTP error.

## Notes and caveats

The retry predicate is evaluated after a failed attempt. It cannot prevent the
initial request; it only decides whether another request should be attempted.

`Schedule.recurs(4)` means four retries after the original attempt, not four
total HTTP requests. With the first request included, this policy can perform up
to five `GET` requests.

`Schedule.during("3 seconds")` is checked at schedule decision points. It keeps
the retry window bounded, but it is not a timeout for the individual HTTP
request. Use request-level timeouts separately when a single attempt can hang.

Keep non-503 classification close to the HTTP adapter. The schedule should not
parse response bodies or error messages to discover whether a failure is
retryable; it should receive a typed error that already carries the status code.
