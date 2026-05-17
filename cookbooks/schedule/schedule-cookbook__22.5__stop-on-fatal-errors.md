---
book: "Effect `Schedule` Cookbook"
section_number: "22.5"
section_title: "Stop on fatal errors"
part_title: "Part VI — Composition and Termination"
chapter_title: "22. Stop Conditions"
status: "draft"
code_included: true
---

# 22.5 Stop on fatal errors

Fatal errors should bypass retry timing. Classify raw failures into domain
errors first, then let only recoverable failures reach the retry schedule.

## Problem

One operation can fail for temporary reasons, such as a timeout or overloaded
dependency, or for fatal reasons, such as bad input or missing authorization.
The retry budget should be spent only on failures that may recover without
changing the request.

## When to use it

Use this recipe when a single operation can produce both retryable and
non-retryable failures. It fits HTTP clients, database calls, message
publication, and worker steps where a timeout may recover but validation or
authorization should stop immediately.

The classification belongs next to the boundary that understands the failure.
For example, translate HTTP `408`, `429`, and `503` into transient domain errors,
and translate HTTP `400`, `401`, and `403` into fatal domain errors before the
retry boundary.

## When not to use it

Do not ask a schedule to discover whether an error is fatal. If the error is
known to be permanent, classify it before retrying and let it bypass the
schedule.

Also avoid retrying non-idempotent writes unless the operation has a clear
deduplication or transaction guarantee. Idempotent means safe to run more than
once with the same effect; a retry policy does not provide that guarantee.

## Schedule shape

Use a normal timing schedule for retryable failures, then add the retry gate at
the `Effect.retry` call site:

- `schedule` controls delay and retry count
- `while` decides whether the current typed failure is retryable

This keeps the responsibilities separate. The schedule answers "when and how
many times?", while the predicate answers "is this failure retryable?"

## Example

```ts
import { Console, Data, Effect, Schedule } from "effect"

class TransientDownstreamError extends Data.TaggedError("TransientDownstreamError")<{
  readonly reason: "Timeout" | "Unavailable" | "RateLimited"
}> {}

class FatalDownstreamError extends Data.TaggedError("FatalDownstreamError")<{
  readonly reason: "BadRequest" | "Unauthorized" | "Forbidden"
}> {}

type DownstreamError = TransientDownstreamError | FatalDownstreamError

let attempts = 0

const callDownstream = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`attempt ${attempts}`)

  if (attempts === 1) {
    return yield* Effect.fail(
      new TransientDownstreamError({ reason: "Timeout" })
    )
  }

  return yield* Effect.fail(
    new FatalDownstreamError({ reason: "Unauthorized" })
  )
})

const isTransient = (error: DownstreamError): error is TransientDownstreamError =>
  error._tag === "TransientDownstreamError"

const retryPolicy = Schedule.exponential("20 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)

const program = callDownstream.pipe(
  Effect.retry({
    schedule: retryPolicy,
    while: isTransient
  }),
  Effect.matchEffect({
    onFailure: (error) =>
      Console.log(
        `stopped on ${error._tag}/${error.reason} after ${attempts} attempts`
      ),
    onSuccess: (value) => Console.log(`succeeded with ${value}`)
  })
)

Effect.runPromise(program)
```

## Variants

For a user-facing request, keep the retry budget small or add an elapsed budget
with `Schedule.during` so callers get a prompt answer.

For a background worker, use a larger budget and add logging or metrics around
classification. The useful signal is often "fatal error bypassed retry", not
just "retry exhausted".

If the downstream error carries retry metadata, classify that data before retry
as well. For example, a rate-limit response can become a transient error with a
parsed delay, and a custom schedule can use that delay without inspecting raw
HTTP headers elsewhere.

## Notes and caveats

`Schedule.recurs(5)` means at most five retries after the original attempt. The
first call is not counted as a schedule recurrence.

`Effect.retry` observes failures, not successes. If `callDownstream` fails with
`FatalDownstreamError`, `while: isTransient` rejects it and the program fails
with that fatal error immediately. If it fails with `TransientDownstreamError`,
the schedule decides the next delay until the retry budget is exhausted.

Keep fatal and transient error types separate when possible. A single loose
error type with a boolean flag tends to spread retry decisions through the code
base. Tagged domain errors make the stop condition explicit at the retry
boundary.
