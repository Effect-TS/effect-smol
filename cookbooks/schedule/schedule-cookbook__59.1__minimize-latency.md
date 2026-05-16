---
book: Effect `Schedule` Cookbook
section_number: "59.1"
section_title: "Minimize latency"
part_title: "Part XIV — Reference Appendices"
chapter_title: "59. Index by Operational Goal"
status: "draft"
code_included: false
---

# 59.1 Minimize latency

Minimizing latency means choosing the fastest recurrence policy that is still
defensible for the caller, the dependency, and the failure mode. This is a
reference-index entry, not a new `Schedule` primitive. Use it to find the
recipes where immediate retries, short fixed delays, responsive polling, and
explicit stopping rules are the main operational concern.

## What this section is about

Use low-latency scheduling when the caller is actively waiting and a short
extra attempt is more valuable than conserving every request. The strongest
examples are narrow local races, brief optimistic-concurrency conflicts,
freshly started in-process services, and user-facing readiness checks where a
successful answer is expected soon.

The first execution of an effect is already immediate. A schedule controls only
the recurrences after that first execution. For retries, `Effect.retry` runs the
effect once, then consults the schedule after a typed failure. For polling with
`Effect.repeat`, the first observation runs once, then the schedule decides
whether and when to observe again.

## Why it matters

Fast policies are useful because they avoid needless waiting when the problem
is likely to clear almost immediately. They are also risky because they can
turn one failure into many requests before a human or an upstream system has
time to react.

Low latency justifies immediate or very fast recurrence only when the operation
is cheap, safe to repeat, expected to settle quickly, and run by a small number
of callers. If the dependency is shared, rate limited, overloaded, or touched by
many fibers or nodes at once, latency is no longer the only budget. Prefer
spacing, backoff, jitter, or a visible failure path.

## Core idea

Start with the smallest fast policy that explains the behavior:

- Use `Schedule.recurs(n)` for immediate retries with no scheduled delay. This
  is the lowest-latency retry shape. `n` is the number of retries after the
  original attempt, not the total number of attempts.
- Use a very small `Schedule.spaced` delay when a tight loop would be too
  aggressive but the caller still benefits from a quick second attempt.
  `spaced` waits the chosen duration between recurrences after the previous run
  completes.
- Use `Schedule.fixed` when the work should target regular interval
  boundaries. If a run takes longer than the interval, the next run can happen
  immediately, but missed runs do not pile up.
- Use `Schedule.while` or an `Effect.retry` `while` predicate when the operation
  has a domain-specific reason to stop before the count or time budget is
  exhausted.
- Add `Schedule.recurs`, `Schedule.take`, or `Schedule.during` whenever the
  fast path must have a clear end. A low-latency policy without a stop condition
  is usually an overload policy by accident.

## Recipe index

Use section 21.1, "Immediate retries", when the failure window is shorter than
any meaningful sleep and the retry count is deliberately tiny.

Use section 5.1, "Retry every 100 milliseconds", when you need a small fixed
delay between retry attempts instead of a zero-delay retry loop.

Use section 18.2, "Slow polling after initial responsiveness matters less",
when the first responsive phase has passed and the workflow should trade
instant feedback for lower background load.

Use section 57.2, "Immediate responsiveness vs infrastructure safety", when the
choice is not purely local and you need to compare user-visible latency against
aggregate load.

Use section 59.4, "Bound total retry time", when the low-latency policy should
be governed by an elapsed user-facing budget instead of only an attempt count.

## Practical guidance

Treat low latency as a short exception, not a default. A fast policy should
usually be bounded by a small recurrence count, a short elapsed-time budget, or
a domain predicate that stops as soon as the condition is no longer transient.

Stop immediately for validation errors, authorization failures, missing
configuration, malformed requests, known permanent states, and non-idempotent
writes that cannot be safely repeated. The schedule can decide timing and
recurrence, but the surrounding Effect code must still classify errors and
domain states.

Move away from immediate or fast recurrence when failures persist beyond the
responsive window. At that point, either fail visibly, switch to `Schedule.spaced`
with a slower cadence, use `Schedule.exponential` or `Schedule.fibonacci` for
backoff, and consider `Schedule.jittered` when many callers may otherwise align
their retries.
