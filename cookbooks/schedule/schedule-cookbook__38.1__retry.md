---
book: "Effect `Schedule` Cookbook"
section_number: "38.1"
section_title: "Retry"
part_title: "Part X — Choosing the Right Recipe"
chapter_title: "38. Glossary"
status: "draft"
code_included: false
---

# 38.1 Retry

Retry reruns an effect after a typed failure. In `Effect.retry`, the first
attempt runs immediately. After each failure, that failure value becomes the
input to the `Schedule`; the schedule either halts, propagating the last
failure, or continues after the delay it computes.

"Typed failure" means a value in the effect's error channel. Defects and
interruptions are not treated as retryable failures by `Effect.retry`.

Retry differs from repeat by the signal that advances the schedule. Retry
advances after failure and stops on success. Repeat advances after success and
stops on failure. That difference decides what the schedule can inspect, what
the surrounding effect returns, and whether the policy is recovery logic or
normal recurrence.

Use retry when a later attempt may succeed because the failure is transient:
for example, a timeout, connection reset, temporary service unavailability, or
rate-limit response with a valid retry path. Bound retry with an attempt limit,
an elapsed-time budget, or both. Add backoff and jitter when many callers could
otherwise create synchronized extra load.

For writes, sends, publishes, payments, provisioning, deletes, and other
externally visible side effects, only retry when duplicate execution is safe or
guarded by the operation's protocol. A schedule can time and limit retries; it
cannot make an unsafe side effect idempotent.
