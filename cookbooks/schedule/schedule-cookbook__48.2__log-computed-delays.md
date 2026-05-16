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

Backoff policies are easier to operate when the chosen delay is visible in the
logs. A retry that says only "trying again" leaves operators guessing whether
the next wait is 100 milliseconds, 30 seconds, or several minutes.

`Schedule` already computes the next delay at each decision point. For schedule
constructors whose output is the delay, such as `Schedule.exponential`,
`Schedule.fibonacci`, `Schedule.duration`, and `Schedule.cron`, use
`Schedule.tapOutput` to log that output without changing the policy.

## Problem

You want retry logs to include the next computed wait while keeping the retry
policy declarative. The code should not duplicate the backoff formula just to
print it.

## When to use it

Use this recipe when retry timing needs to be explained during incident review,
capacity tuning, or support debugging. It is especially useful for exponential
or fibonacci backoff, where the wait grows over time.

## When not to use it

Do not use delay logging as a substitute for error classification. Permanent
failures should still be filtered before retrying, and sensitive error details
should not be copied into logs just because they are schedule inputs.

## Schedule shape

Start with the timing policy, add the retry limit, then tap the schedule output.
For a plain exponential policy, the output is the duration that will be used
before the next retry.

## Code

```ts
import { Console, Duration, Effect, Schedule } from "effect"

type RetryError = {
  readonly _tag: "Timeout" | "Unavailable"
}

declare const callWebhook: Effect.Effect<void, RetryError>

const retryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.take(5),
  Schedule.tapInput((error: RetryError) =>
    Console.log(`webhook failed with ${error._tag}`)
  ),
  Schedule.tapOutput((delay) =>
    Console.log(`next webhook retry in ${Duration.format(delay)}`)
  )
)

export const program = Effect.retry(callWebhook, retryPolicy)
```

The first `callWebhook` attempt still runs immediately. The schedule is
consulted only after a failure, and the tapped output describes the delay before
the next retry.

## Variants

If later combinators change the actual sleep, log the schedule metadata instead
of assuming that the output still equals the final delay. For example,
`Schedule.jittered` modifies the delay while preserving the original output, so
`metadata.duration` is the value to log.

```ts
import { Console, Duration, Effect, Schedule } from "effect"

type RetryError = {
  readonly _tag: "Timeout" | "Unavailable"
}

const jitteredRetryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.take(5),
  Schedule.while((metadata: Schedule.Metadata<Duration.Duration, RetryError>) =>
    Console.log(
      `base delay ${Duration.format(metadata.output)}, actual delay ${
        Duration.format(metadata.duration)
      }`
    ).pipe(Effect.as(true))
  )
)
```

Use the same metadata approach after `Schedule.addDelay`,
`Schedule.modifyDelay`, or combinations where the final sleep is not obvious
from a single output value.

## Notes and caveats

`Schedule.tapOutput` observes schedule outputs and does not change them.
`Schedule.tapInput` observes the values supplied to the schedule: failures for
`Effect.retry` and successful values for `Effect.repeat`.

`Schedule.while` can observe `metadata.output`, `metadata.duration`, attempt
count, elapsed time, and input together. Because it also controls whether the
schedule continues, return `true` when using it only for logging.
