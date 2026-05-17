---
book: Effect `Schedule` Cookbook
section_number: "4.2"
section_title: "Retry up to 5 times"
part_title: "Part II — Core Retry Recipes"
chapter_title: "4. Retry a Few Times"
status: "draft"
code_included: true
---

# 4.2 Retry up to 5 times

Use `Schedule.recurs(5)` with `Effect.retry` when an operation may need a little
more room than a tiny retry burst but must still stop at a fixed count.

## Problem

The retry budget is five additional attempts after the original execution. If
every attempt fails, the effect can run six times total.

## When to use it

Use this for cheap, idempotent operations where five immediate retries are still
reasonable. It can be a practical ceiling for local or low-latency work that
occasionally races with startup or cache refresh.

Do not use five immediate retries for expensive calls, rate-limited APIs, or
dependencies that may already be overloaded. Add spacing or backoff for those
cases.

## Schedule shape

`Schedule.recurs(5)` is count-limited. In retry, each typed failure is offered
to the schedule:

- attempt 1 is the original execution.
- attempts 2 through 6 are the possible retries.
- if attempt 6 fails, that last typed failure is returned.

The schedule output is a recurrence count, but plain `Effect.retry` succeeds
with the retried effect's successful value.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class LookupError extends Data.TaggedError("LookupError")<{
  readonly attempt: number
}> {}

interface Profile {
  readonly id: string
  readonly displayName: string
}

let attempt = 0

const loadProfile = Effect.gen(function*() {
  attempt += 1
  yield* Console.log(`attempt ${attempt}`)

  if (attempt <= 5) {
    return yield* Effect.fail(new LookupError({ attempt }))
  }

  return { id: "user-123", displayName: "Ada" } satisfies Profile
})

const program = loadProfile.pipe(
  Effect.retry(Schedule.recurs(5)),
  Effect.tap((profile) => Console.log(`loaded ${profile.displayName}`))
)

Effect.runPromise(program)
```

This uses the whole budget: five failures followed by a successful sixth
attempt.

## Variants

For one local call site, `Effect.retry({ times: 5 })` has the same count. Use
the schedule form when you want to compose the count with another policy, for
example `Schedule.exponential("100 millis").pipe(Schedule.both(Schedule.recurs(5)))`.

## Notes

`Schedule.recurs(5)` means five retries, not five total attempts. If a product
requirement says "try five times total", use `Schedule.recurs(4)`.

Keep the retry boundary small. Put `Effect.retry` around the operation that may
transiently fail, not around logging, notifications, writes, or other effects
that should not be repeated.
