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

Use this entry when the first decision is not the exact delay, but whether the failure should be retried at all.

`Schedule` supplies recurrence policy. It does not classify failures for you. When a schedule is used for retrying, the failure value becomes schedule input, so classification belongs at the boundary between the domain error and the retry policy. Once an error is known to be transient, choose a schedule that gives the dependency time to recover. Once it is known to be permanent, do not hide the failure behind another delay.

## Decision matrix

| Failure shape | Retry choice | Schedule shape | Why |
| --- | --- | --- | --- |
| Temporary network interruption, timeout, connection reset, stale leader, or overloaded dependency | Retry | `Schedule.exponential` plus `Schedule.recurs` or `Schedule.during`; add `Schedule.jittered` when many clients may retry together | The operation may succeed without changing the request. Increasing delay avoids turning a temporary dependency problem into a retry storm. |
| Rate limit or explicit "try again later" response | Retry, but respect the service boundary | Prefer a delay derived from the response when available; otherwise use `Schedule.exponential`, bounded by `Schedule.during` or `Schedule.recurs`, often with `Schedule.jittered` | The failure is transient, but the downstream service is telling the caller to slow down. A tight fixed retry is usually the wrong default. |
| Conflict, lock contention, compare-and-set race, or eventually consistent read | Retry with a short, bounded policy | `Schedule.spaced` or a small `Schedule.exponential` policy, always combined with `Schedule.recurs` or `Schedule.during` | The retry is local to a race window. Keep the policy small so real logical conflicts surface quickly. |
| Validation error, malformed input, missing required data, unsupported operation, or invariant violation | Do not retry | No retry schedule, or stop the retry schedule with a `Schedule.while` classification predicate | Waiting cannot repair the request. Retrying only delays the useful error. |
| Authentication or authorization failure | Usually do not retry | No retry schedule unless the workflow includes an explicit credential refresh step before retrying | A schedule alone cannot make invalid credentials valid. Classify refreshed credentials separately from permanent denial. |
| Not found | Depends on the domain | Retry only when the object is expected to appear; otherwise fail immediately | "Not found" can mean eventual consistency, delayed provisioning, or a permanent wrong identifier. The schedule choice follows that classification, not the status code alone. |
| Unknown or mixed failure | Retry conservatively only if the operation is safe to repeat | A small `Schedule.recurs` or short `Schedule.during` budget, often with `Schedule.exponential` | Ambiguous errors should not receive an unbounded policy. Use the smallest retry budget that is operationally defensible. |

## How classification changes the schedule

For transient failures, the schedule should answer "how long are we willing to wait for the world to change?" That usually means an increasing delay such as `Schedule.exponential`, a hard count limit such as `Schedule.recurs`, and sometimes a hard elapsed budget such as `Schedule.during`. When many fibers, processes, or hosts can fail at the same time, apply `Schedule.jittered` so retries do not stay synchronized.

For permanent failures, the schedule should answer "how quickly can we stop?" Most of the time the answer is immediate failure. If the same retry policy receives both transient and permanent errors, guard it with `Schedule.while` and inspect the schedule metadata input. Continue only while the failure is classified as retryable.

For uncertain failures, avoid pretending that uncertainty is transience. Use a small bounded retry only when repeating the operation is safe, then surface the final error. This keeps classification pressure on the caller: if the domain later learns how to distinguish a permanent error from a transient one, that knowledge should narrow the retry predicate rather than expand the delay policy.

## Selection rules

Start with classification before timing:

1. If the request is wrong, do not retry.
2. If the dependency or timing window may recover, retry with backoff.
3. If the failure can happen across many clients, add jitter.
4. If the operation can duplicate side effects, require idempotency before retrying.
5. If the classifier is incomplete, keep the retry budget short.

Then choose the smallest schedule that expresses the decision. `Schedule.spaced` and `Schedule.fixed` express steady cadence. `Schedule.exponential` expresses recovery time that should grow after each failed attempt. `Schedule.recurs`, `Schedule.take`, and `Schedule.during` express hard bounds. `Schedule.both` combines bounds using the slower delay and stops when the first policy is exhausted.
