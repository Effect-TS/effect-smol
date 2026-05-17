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

`Schedule.fixed(interval)` recurs on fixed interval boundaries. Combining it
with `Schedule.take(n)` keeps the policy finite.

```ts
const policy = Schedule.fixed("750 millis").pipe(
  Schedule.take(3)
)
```

With `Effect.retry`, the schedule observes failures. In this example the
original feature-flag read is attempted once, then retried up to three times.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

type FeatureFlag = {
  readonly key: string
  readonly enabled: boolean
  readonly source: "remote" | "default"
}

class FlagReadError extends Data.TaggedError("FlagReadError")<{
  readonly reason: "Timeout" | "Unavailable"
}> {}

declare const fetchFeatureFlag: (
  key: string
) => Effect.Effect<FeatureFlag, FlagReadError>

const defaultCheckoutFlag: FeatureFlag = {
  key: "checkout.v2",
  enabled: false,
  source: "default"
}

const flagRetryPolicy = Schedule.fixed("750 millis").pipe(
  Schedule.take(3)
)

export const loadCheckoutFlag = fetchFeatureFlag("checkout.v2").pipe(
  Effect.retry(flagRetryPolicy),
  Effect.catchAll(() => Effect.succeed(defaultCheckoutFlag))
)
```

## Why this is low risk

The retry is safe because reading a feature flag is idempotent: repeating the
same request does not create another order, charge a customer, send another
email, or advance a workflow. The fallback is also acceptable because the caller
can continue with a conservative default.

That combination is what makes a fixed delay appropriate. If the operation is a
write, has side effects, or lacks a safe fallback, classify the error and design
the retry policy more carefully before applying a schedule.

## Keep it bounded

A fixed delay is easy to reason about, but it also creates a stable request rate.
For one process, three retries every 750 milliseconds may be harmless. Across a
large deployment, an unbounded fixed retry can become permanent pressure on the
service that is already failing.

Keep the retry count small for request-path reads. If many instances may retry
the same dependency at the same time, consider adding jitter after choosing the
base cadence so the fleet does not move in lockstep.
