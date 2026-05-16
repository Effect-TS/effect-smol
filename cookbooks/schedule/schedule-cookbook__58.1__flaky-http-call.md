---
book: Effect `Schedule` Cookbook
section_number: "58.1"
section_title: "Flaky HTTP call"
part_title: "Part XIV — Reference Appendices"
chapter_title: "58. Index by Problem"
status: "draft"
code_included: false
---

# 58.1 Flaky HTTP call

A flaky HTTP call is not one retry problem. It is a cluster of smaller
decisions: which failures are transient, whether repeating the request is safe,
how quickly the caller needs an answer, and how much extra traffic the
downstream service can absorb.

This reference entry maps that problem shape back to existing retry recipes. It
does not introduce a new `Schedule` primitive. Use it when the symptom is
"HTTP sometimes fails" and the next step is choosing the smallest defensible
policy.

## What this section is about

Start by classifying the call, not by picking a delay.

For read-only calls, see 11.1 Safe retries for GET requests and 43.2 Retry HTTP
GET on 503. A GET that fails with a timeout, connection reset, `502`, `503`, or
`504` is often a retry candidate. A GET that fails with `400`, `401`, `403`,
`404`, or a decode error usually needs a different request or caller decision.

For writes, see 11.2 Retrying idempotent writes and 50.4 Retry non-idempotent
side effects blindly. A `POST`, payment request, email send, or notification
delivery should not be retried only because the transport failed. Require an
idempotency key, natural request id, deduplication token, or another
duplicate-safety guarantee before applying the same retry shape.

## Why it matters

HTTP failures are easy to overgeneralize. Retrying every error can turn bad
input into latency, authorization failures into noise, and overloaded services
into a retry storm. Not retrying anything can expose callers to brief network
or deployment blips that a bounded retry would have hidden.

The important split is:

- classification decides whether the current failure is retryable
- idempotency decides whether repeating the request is safe
- the schedule decides when another attempt is allowed
- limits decide when the caller must see the final failure

Keep those decisions separate. `Effect.retry` receives failures from the typed
error channel; the predicate or schedule input filter should decide retryability
from that typed failure, while the `Schedule` describes timing and termination.

## Core idea

For a normal flaky HTTP call, start with exponential backoff, intersect it with
finite limits, then add jitter when more than one caller may retry at the same
time.

`Schedule.exponential(base, factor)` produces increasing delays from the base
duration, with a default factor of `2`. It does not stop by itself. Pair it with
`Schedule.recurs(n)` or `Schedule.take(n)` for retry-count limits, and with
`Schedule.during(duration)` when the caller has an elapsed-time budget.

Use `Schedule.both` to combine timing with stopping conditions when all
conditions must keep allowing recurrence. For example, the reference shape is
"exponential backoff AND at most a few retries AND still within the caller's
budget."

Use `Schedule.jittered` for clients, workers, or hosts that may fail together.
In `Schedule.ts`, jitter modifies each recurrence delay to a random value
between 80% and 120% of the original delay. That does not make the retry safer
for a single call; it makes many retries less synchronized.

## Practical guidance

Use this index entry to choose among the concrete recipes:

- For idempotent reads, use 11.1 when the main question is retry safety and
  43.2 when the specific retryable response is `503`.
- For transient failure classification, use 10.1 Retry only transient failures,
  10.2 Do not retry validation errors, and 37.5 Classify errors before
  retrying.
- For overloaded or unstable remote services, use 24.1 Backoff for unstable
  remote APIs and 06.3 Backoff for overloaded downstream services.
- For user-facing latency, use 09.1 Retry for at most 10 seconds, 39.1
  Exponential backoff plus time budget, or a shorter variant of those shapes.
- For fleet-wide retry pressure, use 08.4 Avoid synchronized retries in
  clustered systems and 29.1 More stability, less predictability.
- For rate limits, do not reuse the generic flaky-call policy blindly. See 10.5
  Treat rate limits differently from server errors.

A practical default for a read is small exponential backoff, two to four
retries, an elapsed budget that fits the caller, and jitter when the call can be
made by many processes. A practical default for a write is no retry until the
operation has a documented idempotency story.

Avoid policies that retry all HTTP failures, retry non-idempotent writes without
deduplication, omit a stopping condition, or hide a long retry sequence inside a
large workflow. Retry the smallest HTTP operation that can be repeated safely,
and let the final typed failure remain visible when the bounded policy is
exhausted.
