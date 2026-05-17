---
book: Effect `Schedule` Cookbook
section_number: "48.2"
section_title: "Log computed delays"
part_title: "Part XI — Observability and Testing"
chapter_title: "48. Observability, Logging, and Diagnostics"
status: "draft"
code_included: true
---

# 48.2 Log computed delays

Backoff policies are easier to operate when the selected wait is visible. A log
line that only says "retrying" leaves operators guessing whether the next wait
is milliseconds or seconds.

## Problem

You want retry logs to include the computed delay while keeping the policy
declarative. Do not duplicate the backoff formula in logging code.

## When to use it

Use this for exponential, fibonacci, capped, or jittered policies where timing
explains caller latency and downstream pressure.

## When not to use it

Do not log sensitive request or response data just because it is available near
the retry. Keep permanent-error classification separate from delay logging.

## Schedule shape

For `Schedule.exponential`, the output is the base duration. Log it with
`Schedule.tapOutput`. If later combinators modify the actual delay, log close
to the combinator whose output you want to observe.

## Code

```ts
import { Console, Duration, Effect, Schedule } from "effect"

type RetryError = {
  readonly _tag: "Timeout" | "Unavailable"
}

let attempts = 0

const callWebhook = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`webhook attempt ${attempts}`)

  if (attempts < 3) {
    return yield* Effect.fail({ _tag: "Timeout" } as const)
  }
})

const retryPolicy = Schedule.exponential("10 millis").pipe(
  Schedule.satisfiesInputType<RetryError>(),
  Schedule.tapOutput((delay) =>
    Console.log(`base retry delay: ${Duration.format(delay)}`)
  ),
  Schedule.jittered,
  Schedule.take(5)
)

const program = callWebhook.pipe(
  Effect.retry(retryPolicy),
  Effect.flatMap(() => Console.log("webhook delivered"))
)

Effect.runPromise(program)
```

The example logs the base exponential delay. `Schedule.jittered` changes the
sleep around that base delay, but the log still explains the shape of the
policy.

## Variants

For a capped policy, log both the base delay and the capped delay at the point
where the cap is applied. For high-volume paths, export the delay as a metric
instead of logging every retry.

## Notes and caveats

`Schedule.tapOutput` observes outputs and does not change them. With
`Effect.retry`, schedule inputs are failures; with `Effect.repeat`, inputs are
successful values.
