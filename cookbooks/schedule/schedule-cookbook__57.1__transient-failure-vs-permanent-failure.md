---
book: Effect `Schedule` Cookbook
section_number: "57.1"
section_title: "Transient failure vs permanent failure"
part_title: "Part XIII — Choosing the Right Recipe"
chapter_title: "57. Decision Matrix by Problem Shape"
status: "draft"
code_included: false
---

# 57.1 Transient failure vs permanent failure

Use this entry when the first decision is whether a failure should be retried at
all. Delay choice comes after classification.

`Schedule` describes recurrence; it does not decide which domain errors are
retryable. In `Effect.retry`, the typed failure is the schedule input, so keep
classification close to the retry policy. A transient failure may succeed later
without changing the request. A permanent failure will not be repaired by
waiting.

## Decision matrix

| Failure shape | Retry choice | Schedule shape | Why |
| --- | --- | --- | --- |
| Temporary network interruption, timeout, connection reset, stale leader, or overloaded dependency | Retry | `Schedule.exponential` plus `Schedule.recurs` or `Schedule.during`; add `Schedule.jittered` when many clients may retry together | The request may succeed after the dependency recovers. Increasing delay avoids turning a temporary problem into a retry storm. |
| Rate limit or explicit "try again later" response | Retry, but slow down | Prefer a delay derived from the response when available; otherwise use bounded `Schedule.exponential`, often with `Schedule.jittered` | The downstream service is telling the caller to reduce pressure. A tight fixed retry ignores that signal. |
| Conflict, lock contention, compare-and-set race, or eventually consistent read | Retry briefly | `Schedule.spaced` or a small `Schedule.exponential`, bounded by `Schedule.recurs` or `Schedule.during` | The retry is local to a race window. Keep it small so real logical conflicts surface quickly. |
| Validation error, malformed input, missing required data, unsupported operation, or invariant violation | Do not retry | No retry schedule, or stop with `Schedule.while` when a shared schedule handles mixed errors | Waiting cannot repair the request. Retrying only delays the useful error. |
| Authentication or authorization failure | Usually do not retry | No retry schedule unless the workflow includes an explicit credential refresh step before retrying | A schedule alone cannot make invalid credentials valid. Classify refreshed credentials separately from permanent denial. |
| Not found | Depends on the domain | Retry only when the object is expected to appear; otherwise fail immediately | "Not found" can mean eventual consistency, delayed provisioning, or a wrong identifier. The schedule follows the domain meaning, not the status code alone. |
| Unknown or mixed failure | Retry conservatively only if the operation is safe to repeat | A small `Schedule.recurs` or short `Schedule.during` budget, often with `Schedule.exponential` | Ambiguous errors should not receive an unbounded policy. Use the smallest retry budget you can defend operationally. |

## How classification changes the schedule

For transient failures, the schedule answers: how long are we willing to wait
for the external condition to change? A typical shape is `Schedule.exponential`
for increasing delay, `Schedule.recurs` or `Schedule.take` for a hard recurrence
limit, and sometimes `Schedule.during` for an elapsed budget. Add
`Schedule.jittered` when many fibers, processes, or hosts can fail together.

For permanent failures, the schedule should stop immediately. If one retry
policy receives both transient and permanent errors, guard it with
`Schedule.while` and inspect `metadata.input`. Continue only while the failure
is classified as retryable.

For uncertain failures, do not treat uncertainty as transience. Use a small
bounded retry only when repeating the operation is safe, then surface the final
error. If the domain later learns how to distinguish permanent from transient
cases, narrow the retry predicate instead of expanding the delay policy.

## Selection rules

Start with classification before timing:

1. If the request is wrong, do not retry.
2. If the dependency or timing window may recover, retry with backoff.
3. If the failure can happen across many clients, add jitter.
4. If the operation can duplicate side effects, require idempotency before retrying.
5. If the classifier is incomplete, keep the retry budget short.

Then choose the smallest schedule that expresses the decision. `Schedule.spaced`
and `Schedule.fixed` express steady cadence. `Schedule.exponential` expresses a
delay that grows after each failed attempt. `Schedule.recurs`, `Schedule.take`,
and `Schedule.during` express hard bounds. `Schedule.both` uses the larger delay
from its two inputs and stops when either input schedule stops.
