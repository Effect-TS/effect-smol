---
book: Effect `Schedule` Cookbook
section_number: "39.2"
section_title: "Fixed spacing plus success predicate"
part_title: "Part IX — Composition Recipes"
chapter_title: "39. Combine Delay Strategies and Stop Conditions"
status: "draft"
code_included: true
---

# 39.2 Fixed spacing plus success predicate

Use fixed spacing when each successful check should be followed by the same
pause, and use a success predicate when the value returned by the effect tells
you whether another check is needed.

This is a repeat policy, not a retry policy. `Effect.repeat` feeds successful
values into the schedule. The schedule can then inspect the latest value and
decide whether to continue.

## Problem

You have an effect that succeeds with an observation, such as a job status,
cache lookup, or readiness check. Some successful observations are still
non-terminal, so you want to run the effect again after a fixed pause. Once the
successful value satisfies your predicate, repetition should stop and the final
value should be returned.

## When to use it

Use this when all of these are true:

- every follow-up check should wait the same amount of time
- the effect succeeds even when the work is not done yet
- the successful value contains enough information to decide whether to poll
  again

Common examples include polling an asynchronous job until it is complete,
checking whether a provisioned resource is ready, or waiting for a read model to
catch up.

## When not to use it

Do not use this for failures that should be retried. Failed effects do not reach
the success predicate in `Effect.repeat`; they fail the whole repeat unless you
handle or retry them separately.

Also avoid this shape when the system can send a callback, queue event, or direct
acknowledgement. A push signal is usually cleaner than polling when one is
available.

## Schedule shape

Compose three small pieces:

```ts
Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isDone(input))
)
```

`Schedule.spaced` supplies the fixed pause before each recurrence.
`Schedule.satisfiesInputType<Status>()` tells TypeScript what successful value
the repeated effect feeds into the schedule. `Schedule.passthrough` changes the
schedule output from the spacing counter to the input value, so the repeated
effect returns the final observed status. `Schedule.while` continues only while
the latest successful value is still not good enough.

## Code

```ts
import { Effect, Schedule } from "effect"

type ExportStatus =
  | { readonly _tag: "Queued" }
  | { readonly _tag: "Running"; readonly percent: number }
  | { readonly _tag: "Ready"; readonly downloadUrl: string }

type ExportReadError = { readonly _tag: "ExportReadError" }

declare const readExportStatus: Effect.Effect<ExportStatus, ExportReadError>

const pollUntilReady = Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<ExportStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag !== "Ready")
)

export const program = Effect.repeat(readExportStatus, pollUntilReady)
```

The first `readExportStatus` call is made immediately. If it returns `Ready`,
the schedule stops and `program` succeeds with that ready status. If it returns
`Queued` or `Running`, the schedule waits two seconds and runs the effect again.

## Variants

- Add a time budget with `Schedule.both(Schedule.during("2 minutes").pipe(Schedule.satisfiesInputType<ExportStatus>()))` when the poll must eventually give up.
- Add a recurrence limit with `Schedule.both(Schedule.recurs(30).pipe(Schedule.satisfiesInputType<ExportStatus>()))` when an attempt count is easier to reason about than elapsed time.
- Add `Schedule.jittered` to the fixed spacing for fleet-wide polling, after you decide that exact cadence is not required.

## Notes and caveats

`Schedule.while` receives schedule metadata. In this recipe, the useful field is
`input`, which is the latest successful value produced by the repeated effect.

Without `Schedule.passthrough`, the output of `Schedule.spaced` is its recurrence
count. That is useful for some policies, but it is usually not what you want from
a poll-until-success recipe. Passing the input through keeps the terminal
domain value as the result.

This policy can repeat forever if the success predicate never becomes true. Add
a time budget, recurrence limit, external interruption, or owning fiber lifetime
when unbounded polling is not acceptable.
