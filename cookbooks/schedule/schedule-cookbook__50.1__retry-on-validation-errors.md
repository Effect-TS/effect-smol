---
book: Effect `Schedule` Cookbook
section_number: "50.1"
section_title: "Retry on validation errors"
part_title: "Part XII — Anti-Patterns"
chapter_title: "50. Retrying Everything"
status: "draft"
code_included: false
---

# 50.1 Retry on validation errors

Retrying validation errors is an anti-pattern because waiting does not change
an invalid request. A missing field, unsupported enum, malformed payload, failed
business rule, or rejected tenant boundary should be returned to the caller.

## The anti-pattern

The problematic shape is a shared retry policy around an operation whose typed
errors have not been separated. The policy might use exponential backoff, a
retry count, or a time budget, but it runs before the validation failure is
classified as terminal.

That sends validation failures through the same schedule as timeouts, temporary
unavailability, and rate limits. The invalid request is submitted again, delayed
again, logged again, and usually reported later than it should be.

## Why it happens

It usually happens when retry is added before the error model is settled. A
schedule such as `Schedule.exponential("100 millis")` is easy to reuse, and a
backoff curve can make the retry look careful. But `Schedule.exponential`
describes timing; it does not know whether the failure is retryable, and it is
unbounded unless composed with a limit such as `Schedule.recurs`,
`Schedule.take`, or `Schedule.during`.

The other common cause is placing retry too far outside the failing operation.
If a whole workflow is retried, a validation failure from one step can cause
unrelated steps to run again.

## Why it is risky

Validation failures should be fast, stable, and actionable. Retrying them turns
a deterministic rejection into delayed operational noise.

A single bad payload can appear as several failing attempts, while the real
issue is still one permanent input problem. If the retried operation contains
writes or external calls, the retry can also duplicate side effects unless the
operation is idempotent, meaning repeated attempts represent the same logical
operation.

Jitter does not fix this. `Schedule.jittered` spreads delay around a schedule's
selected timing; it does not make an invalid request valid or decide whether a
failure belongs in the retry path.

## A better approach

Classify before retrying. Keep the decision close to the domain boundary that
understands the failure:

- validation, malformed request, authentication, authorization, tenant, and
  business-rule failures should bypass retry and return immediately
- timeouts, connection resets, temporary unavailability, selected rate-limit
  responses, and other explicitly transient failures may enter the retry policy
- unsafe writes need an idempotency or deduplication story before retry is
  considered

After classification, let the schedule do schedule work. Use exponential or
fixed spacing for the delay shape. Add `Schedule.recurs`, `Schedule.take`, or
`Schedule.during` so termination is visible. Add `Schedule.jittered` when many
callers may retry at the same time. Name the policy after the retryable case,
not after a generic operator.

Use `Effect.retry`'s retry predicate at the boundary when the question is
"should this typed failure be retried?" Reserve `Schedule.while` for cases where
the schedule itself must stop based on schedule metadata such as input, output,
attempt, elapsed time, or selected delay.

## Notes and caveats

A stricter policy may make failures visible sooner. That is the point. The caller
can distinguish "this request is invalid" from "this retryable operation
exhausted its budget", and operations can tell whether the retry policy is
protecting the system or merely delaying a permanent error.

There are rare validation-like failures that are actually consistency problems,
such as a just-created reference not yet visible in another service. Model those
as transient consistency failures, not generic validation errors, and give them a
small, bounded retry policy that documents the assumption.
