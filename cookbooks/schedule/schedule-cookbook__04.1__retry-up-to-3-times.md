---
book: Effect `Schedule` Cookbook
section_number: "4.1"
section_title: "Retry up to 3 times"
part_title: "Part II — Core Retry Recipes"
chapter_title: "4. Retry a Few Times"
status: "draft"
code_included: true
---

# 4.1 Retry up to 3 times

Use `Effect.retry({ times: 3 })` when a typed failure should get up to three
more attempts before the final failure is returned.

## Problem

The operation may fail briefly, and immediate retry is acceptable. The original
attempt runs once; the policy allows up to three retries after that.

## When to use it

Use this for cheap, idempotent work where a short burst is useful: a local
resource conflict, a dependency warming up, or a read that can fail during a
brief restart.

Use a delay or backoff instead when retrying immediately would increase pressure
on a remote or overloaded dependency.

## Schedule shape

The options form is the smallest expression:

| Policy                       | Maximum total executions |
| ---------------------------- | ------------------------ |
| `Effect.retry({ times: 0 })` | 1                        |
| `Effect.retry({ times: 1 })` | 2                        |
| `Effect.retry({ times: 3 })` | 4                        |

`Schedule.recurs(3)` has the same retry-count meaning when used with
`Effect.retry`.

If an attempt succeeds, retrying stops immediately. If every permitted attempt
fails, `Effect.retry` returns the last typed failure.

## Code

```ts
import { Console, Data, Effect } from "effect"

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly attempt: number
}> {}

let attempt = 0

const callService = Effect.gen(function*() {
  attempt += 1
  yield* Console.log(`attempt ${attempt}`)

  if (attempt < 4) {
    return yield* Effect.fail(new ServiceUnavailable({ attempt }))
  }

  return "service response"
})

const program = callService.pipe(
  Effect.retry({ times: 3 }),
  Effect.tap((response) => Console.log(`completed: ${response}`))
)

Effect.runPromise(program)
```

Attempts 1, 2, and 3 fail. Attempt 4 is the third retry, so it is still inside
the budget and can succeed.

## Variants

Use `Schedule.recurs(3)` when the retry policy should be named or composed with
timing later. Use `Effect.retry(callService, Schedule.recurs(3))` when the
two-argument style reads better at the call site.

Add `while` or `until` when only some typed failures should be retried. The
retry count still caps the number of retries.

## Notes

The first execution is not counted as a retry. If a requirement says "try this
at most three times total", use `times: 2` or `Schedule.recurs(2)`.

`Effect.retry` retries typed failures from the error channel. It does not retry
defects or interruptions.
