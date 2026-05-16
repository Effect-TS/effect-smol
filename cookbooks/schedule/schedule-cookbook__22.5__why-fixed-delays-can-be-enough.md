---
book: Effect `Schedule` Cookbook
section_number: "22.5"
section_title: "Why fixed delays can be enough"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "22. Constant Delay Recipes"
status: "draft"
code_included: true
---

# 22.5 Why fixed delays can be enough

Fixed delays are sometimes dismissed as the naive option. They are not. For
predictable, low-volume work, a clear constant delay can be easier to operate
than a more elaborate backoff curve. The important question is not whether the
schedule looks sophisticated; it is whether the delay policy matches the
failure mode and the amount of pressure the workflow can create.

## Problem

You need to choose between a fixed delay, exponential backoff, and jitter. A
fixed delay is attractive because it is easy to explain: after each failed
attempt, wait the same amount of time before trying again.

That simplicity is useful when the operation is low volume, the dependency is
not overloaded, and the expected recovery time is short and predictable.

## When fixed delay is enough

Use a fixed delay when the retrying caller is not a meaningful source of load.
Examples include a single background worker reconnecting to a local service, a
low-traffic admin action retrying a temporary dependency failure, or a small
internal poller checking for state that normally appears within a few seconds.

In those cases, `Schedule.spaced` often communicates the policy better than
backoff:

```ts
import { Data, Effect, Schedule } from "effect"

class DependencyUnavailable extends Data.TaggedError("DependencyUnavailable")<{
  readonly service: string
}> {}

declare const loadConfiguration: Effect.Effect<string, DependencyUnavailable>

const retryAtSteadyCadence = Schedule.spaced("2 seconds").pipe(
  Schedule.both(Schedule.recurs(5))
)

export const program = loadConfiguration.pipe(
  Effect.retry(retryAtSteadyCadence)
)
```

This policy makes one initial attempt immediately. If it fails with
`DependencyUnavailable`, it waits two seconds before each retry and retries at
most five times after the original attempt.

## Why not always use backoff?

Backoff is a protection mechanism. It is valuable when repeated failure is a
signal that the dependency may be overloaded, rate limited, restarting, or
unable to recover under continued pressure. In those cases, increasing the
delay gives the dependency more room to recover and reduces wasted work.

But backoff also makes timing less direct. The first few retries may be fast,
while later retries can become much slower than the operator expects. For a
small workflow where one retry every few seconds is already safe, that extra
shape can be unnecessary.

Prefer `Schedule.exponential` when repeated failures should progressively slow
the caller down. Prefer a fixed delay when each retry has roughly the same cost
and the retrying workflow is already bounded and low pressure.

## When to add jitter

Jitter is mainly about synchronization. A fixed delay is safe for one worker,
but many workers using the same delay can accidentally line up. That is common
after deploys, process restarts, cron boundaries, or a shared dependency
outage.

Add `Schedule.jittered` when many clients, fibers, or service instances may
retry or poll at the same time:

```ts
const retryWithoutLockstep = Schedule.spaced("2 seconds").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)
```

`Schedule.jittered` randomly adjusts each recurrence delay between 80% and
120% of the original delay. Apply it after choosing the base cadence, so the
policy still has a recognizable operational shape.

## Notes and caveats

`Schedule.spaced("2 seconds")` waits two seconds between retry attempts. It
does not delay the first attempt.

Do not use a fixed delay to hide permanent failures. Validation errors,
authorization errors, malformed requests, and unsafe non-idempotent writes
should be classified before retrying.

For user-facing paths, pair a fixed delay with a small retry count or an elapsed
budget. For fleet-wide retry or polling, consider jitter. For overload,
rate-limit, and outage recovery, prefer backoff.
