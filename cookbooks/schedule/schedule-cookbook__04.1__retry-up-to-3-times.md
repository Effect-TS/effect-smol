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

You have an effect that may fail for a short-lived reason, and you want to try it again
a small, fixed number of times before returning the final failure. This recipe keeps the
retry policy explicit: the schedule decides when another typed failure should be
attempted again and where retrying stops. The surrounding Effect code remains
responsible for domain safety, including which failures are transient, whether the
operation is idempotent, and how the final failure is reported.

## Problem

In Effect, "retry up to 3 times" means the original effect runs once, then may
run up to three more times after typed failures. If every attempt fails, the
effect can run four times total.

## When to use it

Use this when a failure is likely to be transient and retrying immediately is
acceptable: a brief resource conflict, a flaky local dependency, or an
idempotent request that sometimes fails once during a restart.

This is also a useful first retry budget before adding timing. The count limit
keeps the policy bounded even if the operation keeps failing.

## When not to use it

Do not use immediate retries for operations that should slow down under load,
such as remote HTTP calls, database reconnects, queue consumers, or rate-limited
APIs. Add spacing, backoff, or jitter for those cases.

Do not use retry for defects or interruptions. `Effect.retry` retries typed
failures from the error channel; defects and interruptions are not retried as
typed failures.

Do not retry a larger workflow if only one step is safe to run more than once.
Put the retry around the smallest idempotent operation.

## Schedule shape

The smallest policy is the `times` option:

```ts
Effect.retry({ times: 3 })
```

That option allows up to three retries after the first execution. It is
equivalent in count to `Schedule.recurs(3)` for retrying:

```ts
Effect.retry(Schedule.recurs(3))
```

The counting rule is:

| Policy                       | Maximum total executions |
| ---------------------------- | ------------------------ |
| `Effect.retry({ times: 0 })` | 1                        |
| `Effect.retry({ times: 1 })` | 2                        |
| `Effect.retry({ times: 3 })` | 4                        |

If an attempt succeeds, retrying stops immediately and the successful value is
returned. If the retry policy is exhausted while attempts are still failing, the
last typed failure is returned.

## Code

```ts
import { Data, Effect } from "effect"

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly attempt: number
}> {}

let attempt = 0

const callService = Effect.gen(function*() {
  attempt += 1

  if (attempt < 4) {
    return yield* Effect.fail(new ServiceUnavailable({ attempt }))
  }

  return "service response"
})

const program = callService.pipe(
  Effect.retry({ times: 3 })
)
```

Here `callService` fails on attempts 1, 2, and 3. The retry policy allows three
retries, so attempt 4 is allowed and `program` succeeds with
`"service response"`. If attempt 4 also failed, `program` would fail with that
last `ServiceUnavailable`.

## Variants

Use `Schedule.recurs(3)` when you want a named schedule or expect to compose the
policy with timing:

```ts
import { Effect, Schedule } from "effect"

const retryUpTo3Times = Schedule.recurs(3)

const program = callService.pipe(
  Effect.retry(retryUpTo3Times)
)
```

Use the two-argument form when it reads better in surrounding code:

```ts
const program = Effect.retry(callService, Schedule.recurs(3))
```

Use an error predicate when only some typed failures should be retried:

```ts
const program = callService.pipe(
  Effect.retry({
    times: 3,
    while: (error) => error._tag === "ServiceUnavailable"
  })
)
```

## Notes and caveats

The first execution is not counted as a retry. If an external requirement says
"try this at most 3 times total", use `times: 2` or `Schedule.recurs(2)`.

`Effect.retry` does not run the policy after a success. The retry tests verify
that a successful effect is evaluated once even with a large retry count.

With the options form, `Effect.retry({ times: 3 })` succeeds with the retried
effect's successful value. With the schedule form, `Effect.retry` also succeeds
with the retried effect's successful value; the schedule output is not the final
success value.

Keep this recipe count-only. Once the operation crosses a process or network
boundary, combine the retry budget with a delay policy before using it in
production.
