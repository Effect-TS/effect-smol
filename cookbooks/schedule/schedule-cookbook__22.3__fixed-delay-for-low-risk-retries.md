---
book: Effect `Schedule` Cookbook
section_number: "22.3"
section_title: "Fixed delay for low-risk retries"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "22. Constant Delay Recipes"
status: "draft"
code_included: true
---

# 22.3 Fixed delay for low-risk retries

Use a fixed delay when a retry is cheap, safe, and expected to recover quickly.
The policy should still be bounded: even low-risk retries can create steady
background load if every caller keeps trying forever.

## Problem

Feature flags, cached metadata, or small control-plane documents can often be
read again without changing server state. You want the first read to run
immediately, then a few more attempts at a predictable cadence before the
surrounding Effect decides how to recover.

## Schedule shape

For retry delay, use `Schedule.spaced(interval)` and combine it with
`Schedule.recurs(n)`. `Schedule.spaced` waits after each failed attempt
completes. Use `Schedule.fixed` only when you need wall-clock interval
boundaries for repeated successful work.

With `Effect.retry`, the schedule observes failures. In this example the
original feature-flag read is attempted once, then retried up to three times.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

type FeatureFlag = {
  readonly key: string
  readonly enabled: boolean
  readonly source: "remote" | "default"
}

class FlagReadError extends Data.TaggedError("FlagReadError")<{
  readonly reason: "Timeout" | "Unavailable"
}> {}

let attempts = 0

const fetchFeatureFlag = Effect.fnUntraced(function*(key: string) {
  attempts += 1
  yield* Console.log(`flag read attempt ${attempts}`)

  if (attempts < 10) {
    return yield* Effect.fail(
      new FlagReadError({ reason: "Unavailable" })
    )
  }

  return { key, enabled: true, source: "remote" } satisfies FeatureFlag
})

const defaultCheckoutFlag: FeatureFlag = {
  key: "checkout.v2",
  enabled: false,
  source: "default"
}

const flagRetryPolicy = Schedule.spaced("30 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

const loadCheckoutFlag = fetchFeatureFlag("checkout.v2").pipe(
  Effect.retry(flagRetryPolicy),
  Effect.catch(() => Effect.succeed(defaultCheckoutFlag))
)

Effect.runPromise(loadCheckoutFlag).then((flag) => {
  console.log(`${flag.key}: ${flag.enabled} from ${flag.source}`)
})
```

The feature flag read fails in this scratchpad example, so the bounded retry
finishes by returning the conservative default.

## Why this is low risk

The retry is safe because reading a feature flag is idempotent: repeating the
same request does not create another order, charge a customer, send another
email, or advance a workflow. The fallback is also acceptable because the caller
can continue with a conservative default.

That combination is what makes a fixed delay appropriate. If the operation is a
write, has side effects, or lacks a safe fallback, classify the error and design
the retry policy more carefully before applying a schedule.

## Keep it bounded

A fixed delay is easy to reason about, but it also creates a stable request
rate. For one process, a few retries with a short delay may be harmless. Across
a large deployment, an unbounded fixed retry can become permanent pressure on
the service that is already failing.

Keep the retry count small for request-path reads. If many instances may retry
the same dependency at the same time, consider adding jitter after choosing the
base cadence so the fleet does not move in lockstep.
