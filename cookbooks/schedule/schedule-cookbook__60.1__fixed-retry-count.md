---
book: Effect `Schedule` Cookbook
section_number: "60.1"
section_title: "Fixed retry count"
part_title: "Part XIV — Reference Appendices"
chapter_title: "60. Index by Pattern"
status: "draft"
code_included: false
---

# 60.1 Fixed retry count

Fixed retry count means "try the original effect once, then allow at most `n`
follow-up retries if it fails." In `Schedule` terms, the primitive for this
shape is `Schedule.recurs(n)`.

Use this index entry when the primary question is count-based: how many more
times may this failing operation run before the last failure is returned?

## Source-of-truth mapping

`Schedule.recurs(times)` creates a schedule that can be stepped the specified
number of `times` before it terminates. The implementation in
`packages/effect/src/Schedule.ts` continues while schedule metadata satisfies
`attempt <= times`.

With `Effect.retry`, the schedule is consulted after a typed failure from the
original effect. That makes `Schedule.recurs(n)` a retry limit, not a total
attempt limit.

- `Schedule.recurs(0)` means no retries.
- `Schedule.recurs(1)` means one retry, for up to two total attempts.
- `Schedule.recurs(3)` means three retries, for up to four total attempts.

If an external requirement says "try three times total", translate that to
`Schedule.recurs(2)`: one original attempt plus two retries.

## Recipes

Start with [3.2 Retry a fixed number of times](schedule-cookbook__03.2__retry-a-fixed-number-of-times.md)
for the smallest count-only policy. It shows the basic off-by-one rule and the
compact `Effect.retry({ times: n })` variant.

Use [34.1 Maximum retry count](schedule-cookbook__34.1__maximum-retry-count.md)
when the fixed count is a production guardrail. It frames `Schedule.recurs` as a
visible upper bound and shows how to combine it with timing policies.

Use [49.1 Assert retry count](schedule-cookbook__49.1__assert-retry-count.md)
when tests need to prove the operation runs the original attempt plus the
allowed retries.

Use [38.2 Retry 5 times with exponential backoff](schedule-cookbook__38.2__retry-5-times-with-exponential-backoff.md)
or [38.3 Retry 10 times with jittered backoff](schedule-cookbook__38.3__retry-10-times-with-jittered-backoff.md)
when the count limit should be paired with safer retry spacing.

Use [9.5 Prefer time budget limits over attempt counts](schedule-cookbook__09.5__prefer-time-budget-limits-over-attempt-counts.md)
when the operational requirement is better expressed as elapsed time than as a
fixed number of retries.

## How to choose

Use a fixed retry count when the operation is safe to run more than once, the
failure mode is plausibly transient, and the team needs an exact bound on
follow-up attempts.

Prefer a low count for user-facing requests. A small retry budget can smooth
over a short race or network hiccup without making the user wait through a long
invisible loop.

For calls that cross a process or network boundary, `Schedule.recurs(n)` is
usually only the limit. Combine it with `Schedule.spaced`, `Schedule.fixed`,
`Schedule.exponential`, `Schedule.jittered`, or `Schedule.during` when cadence,
fleet behavior, or elapsed budget matters.

## Caveats

`Schedule.recurs` has no delay by itself. A fast-failing operation can retry
immediately up to the count limit.

Do not use a retry count to hide deterministic failures such as validation
errors, malformed requests, authorization failures, or unsafe non-idempotent
writes.

The same schedule has different operational wording under `Effect.repeat`.
With `Effect.retry`, `Schedule.recurs(3)` means three retries after failures.
With `Effect.repeat`, it means three recurrences after successful executions.
