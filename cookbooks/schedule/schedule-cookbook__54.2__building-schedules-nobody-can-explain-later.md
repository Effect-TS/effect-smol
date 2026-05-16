---
book: Effect `Schedule` Cookbook
section_number: "54.2"
section_title: "Building schedules nobody can explain later"
part_title: "Part XII — Anti-Patterns"
chapter_title: "54. Overcomplicating Schedule Composition"
status: "draft"
code_included: false
---

# 54.2 Building schedules nobody can explain later

Building schedules nobody can explain later is an anti-pattern because
recurrence policy is operational policy. A schedule decides how often work is
repeated, how long callers wait, how much pressure a dependency sees, and which
conditions are allowed to keep work alive. When that policy is compressed into a
dense anonymous pipeline, reviewers can see the operators but not the promise.

## The anti-pattern

The problematic version builds a clever schedule at the call site and leaves the
reader to reconstruct the policy from combinator mechanics:

- an unbounded base such as `Schedule.exponential` or `Schedule.spaced`
- a limit hidden several operators later with `Schedule.recurs`,
  `Schedule.take`, or `Schedule.during`
- a combination operator whose meaning must be remembered, such as
  `Schedule.both`, `Schedule.either`, or `Schedule.andThen`
- an input predicate in `Schedule.while` that is mixed into timing logic
- a delay adjustment with `Schedule.modifyDelay` whose operational purpose is
  not named

Each individual operator can be valid. The anti-pattern is making the final
policy explainable only by replaying the implementation in your head.

## Why it happens

It usually happens when `Schedule` is treated as a fluent expression language
instead of a value that carries a service contract. The Effect API is expressive
enough to combine timing, limits, input inspection, output mapping, jitter, and
phase changes in one pipeline. That power is useful, but it also makes it easy
to produce a schedule whose name says "retry policy" while its body says:

- retry with an exponential delay
- randomize the delay by the built-in jitter bounds
- stop on the earlier of a count limit and an elapsed budget
- continue only while the latest error is a particular domain case
- honor a remote delay hint when it is longer than local backoff

That should not live as an unnamed expression. It is a policy with an
operational story.

## Why it is risky

The immediate risk is review failure. A reviewer may notice that
`Schedule.recurs(5)` appears somewhere in the pipe, but miss that
`Schedule.either` keeps recurrence alive until both sides are exhausted. Another
reader may see `Schedule.both` and not realize it uses intersection semantics:
both schedules must continue, and the larger delay wins.

The operational risk is worse. A schedule that nobody can explain later becomes
hard to tune during an incident. It is unclear whether changing a duration will
reduce load, increase tail latency, shorten a retry budget, or alter a stop
condition. Logs and metrics become difficult to interpret because the policy has
no stable name that maps to an operational intent.

The maintenance risk is that later edits preserve syntax but change meaning.
Moving `Schedule.jittered`, swapping `both` for `either`, replacing `spaced`
with `fixed`, or putting `Schedule.while` before the schedule has a clear input
type can change behavior in ways that are not obvious from a dense chain.

## A better approach

Give every non-trivial schedule a policy name that describes the behavior it
promises. Prefer names such as `retryTransientHttpFailures`,
`pollPendingJobForTwoMinutes`, `reconnectWithCappedJitteredBackoff`, or
`sampleHeartbeatDuringWarmup` over names such as `retrySchedule`,
`combinedSchedule`, or `backoff`.

Build the schedule in named pieces when the pieces answer different operational
questions:

- cadence: `Schedule.spaced`, `Schedule.fixed`, `Schedule.exponential`,
  `Schedule.fibonacci`, `Schedule.cron`, or `Schedule.windowed`
- load spreading: `Schedule.jittered`
- budget: `Schedule.recurs`, `Schedule.take`, or `Schedule.during`
- classification: `Effect.retry({ while })` for ordinary retry error
  classification, or `Schedule.while` when the schedule must inspect schedule
  metadata
- phase sequencing: `Schedule.andThen` when one phase must finish before the
  next starts
- intersection: `Schedule.both` when the policy should continue only while both
  sides continue
- union: `Schedule.either` only when continuing while either side continues is
  truly intended

Then keep the final composition close to the story. A policy named
`retryRateLimitsWithServerHint` can legitimately combine exponential backoff,
jitter, retry count, input inspection, and delay modification. The name tells
the reader why those operators belong together.

## Notes and caveats

Do not name schedules after implementation details unless the detail is the
contract. `exponentialRetry` is weaker than `retryUnavailableSearchBriefly`
because it says how the delay grows but not which operation is protected, which
failures are eligible, or how long the caller may wait.

Be explicit about unbounded bases. `Schedule.exponential`,
`Schedule.fibonacci`, `Schedule.spaced`, `Schedule.fixed`, and
`Schedule.forever` can all recur indefinitely until combined with a stopping
policy. If indefinite recurrence is intended, the name should make that clear.

When a schedule predicate reads inputs, make the input story visible.
`Schedule.while` receives schedule metadata, including the latest input. For
repeat-style polling, `Schedule.passthrough` is often used so the caller receives
the last successful observation rather than an internal timing output. For
retry-style classification, `Effect.retry({ while })` is usually easier to read
than burying ordinary error classification inside the schedule.

The goal is not to avoid composition. The goal is to make composed schedules
auditable. A readable schedule lets an operator answer three questions quickly:
what may recur, how often it may recur, and what stops it.
