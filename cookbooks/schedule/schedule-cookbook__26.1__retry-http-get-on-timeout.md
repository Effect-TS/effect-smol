---
book: "Effect `Schedule` Cookbook"
section_number: "26.1"
section_title: "Retry HTTP GET on timeout"
part_title: "Part VII — Real-World Recipes"
chapter_title: "26. Backend Recipes"
status: "draft"
code_included: true
---

# 26.1 Retry HTTP GET on timeout

Retry a `GET` only when the endpoint is safe to repeat and the failure is a
temporary transport problem.

## Problem

You call `GET /users/:id`. The request can time out, return a non-success HTTP
status, or produce a response that cannot be decoded.

In this recipe, only the timeout is retryable. Authentication failures,
authorization failures, missing resources, and decoding failures should return
immediately. Retrying them adds load without making the request valid.

## When to use it

Use this for idempotent reads, where repeating the request has the same logical
effect as sending it once. It fits metadata lookups, status reads, configuration
fetches, and similar paths where a short delay is acceptable.

Make the retryable condition explicit in the error model. A `HttpTimeout` tag is
clearer and safer than parsing exception messages.

## When not to use it

Do not retry a `GET` blindly if it starts work, marks records as viewed,
advances a cursor, or depends on one-time credentials. HTTP method names are a
signal; the endpoint behavior is what matters.

Do not leave the schedule unbounded. `Schedule.exponential("100 millis")` keeps
recurring unless you add a retry count, elapsed budget, or both.

## Schedule shape

Use `Effect.retry` with a typed `while` predicate and a finite schedule.
`Schedule.exponential` spaces retries, `Schedule.jittered` avoids synchronized
clients, `Schedule.recurs(3)` allows three retries after the first request, and
`Schedule.during` adds an elapsed retry budget. `Schedule.both` means both
limits must still allow recurrence.

## Example

```ts
import { Console, Data, Effect, Schedule } from "effect"

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

let attempts = 0

const httpGetJson = (url: string): Effect.Effect<unknown, HttpTimeout | HttpStatusError> =>
  Effect.gen(function*() {
    attempts += 1
    yield* Console.log(`GET ${url}, attempt ${attempts}`)

    if (attempts <= 2) {
      return yield* Effect.fail(new HttpTimeout({ url }))
    }

    return { id: "user-123", name: "Ada" }
  })

const decodeUser = (body: unknown): Effect.Effect<User, DecodeError> => {
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
  return Effect.fail(new DecodeError({ message: "Expected a user object" }))
}

const getUser = Effect.fnUntraced(function*(id: string) {
  const url = `/users/${id}`
  const body = yield* httpGetJson(url)
  return yield* decodeUser(body)
})

const isHttpTimeout = (error: GetUserError): error is HttpTimeout =>
  error._tag === "HttpTimeout"

const retryGetTimeouts = Schedule.exponential("10 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3)),
  Schedule.both(Schedule.during("200 millis"))
)

const program = getUser("user-123").pipe(
  Effect.retry({
    schedule: retryGetTimeouts,
    while: isHttpTimeout
  }),
  Effect.tap((user) => Console.log(`loaded ${user.name}`))
)

Effect.runPromise(program).then(console.log, console.error)
```

The example uses small delays so it terminates quickly. The first request is
immediate; only accepted timeout failures are delayed and retried.

If the request fails with `HttpStatusError`, or if decoding fails with
`DecodeError`, the predicate returns `false` and the failure is returned without
another HTTP request.

## Variants

For an interactive path, use fewer retries or a smaller elapsed budget. For a
background read path, keep the same timeout predicate but allow a wider bounded
policy.

Keep the predicate separate from the timing policy. The predicate answers
whether the failure is retryable; the schedule answers how retrying proceeds
after that failure is accepted.

## Notes and caveats

`Effect.retry` feeds typed failures from the effect's error channel into the
retry policy. The first HTTP request is not delayed.

Timeouts are ambiguous: the server may have produced a response the client did
not receive. Retrying a `GET` is normally reasonable, but only when the specific
endpoint is actually idempotent.

Bounded retry is part of the contract. A retry count protects the downstream
service from unbounded pressure; an elapsed budget protects the caller from
spending too long on one dependency.
