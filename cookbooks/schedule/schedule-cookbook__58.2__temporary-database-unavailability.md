---
book: Effect `Schedule` Cookbook
section_number: "58.2"
section_title: "Temporary database unavailability"
part_title: "Part XIV — Reference Appendices"
chapter_title: "58. Index by Problem"
status: "draft"
code_included: false
---

# 58.2 Temporary database unavailability

Use this reference when a database is temporarily unreachable, overloaded,
restarting, or failing over and a retry policy must protect recovery.

## What this section is about

Attach the schedule to the failed database effect with `Effect.retry`. The
timing policy should answer how quickly retries back off and where the retry
budget stops; the retry predicate should admit only temporary unavailability.

Validation failures, constraint violations, authorization errors, and permanent
query-shape errors should not be hidden behind the same schedule.

## Why it matters

Database retry storms can make an outage worse. A fixed retry loop from every application instance can keep the database saturated after it starts recovering. A retry policy for temporary unavailability should therefore combine increasing delay, a hard retry or elapsed-time limit, and jitter when many processes may retry at the same time.

## Core idea

Start from `Schedule.exponential` for backoff. In `Schedule.ts`, `Schedule.exponential(base, factor)` produces increasing delay durations from the attempt number. Combine it with `Schedule.recurs` or `Schedule.take` when the operational contract is "try at most N more times". Combine it with `Schedule.during` when the contract is "keep trying only within this elapsed budget".

Use `Schedule.both` when both constraints must remain true. `Schedule.both` continues only while both schedules continue and uses the maximum delay between them, which is the conservative shape for "exponential backoff, but stop after the retry budget is exhausted". Use `Schedule.either` only when the longer-lived union is intentional; it continues while either schedule continues and uses the minimum delay, which is usually too permissive for database recovery.

Add `Schedule.jittered` when many clients may retry together. Effect's `Schedule.jittered` randomly adjusts each recurrence delay between 80% and 120% of the original delay, which helps avoid synchronized reconnect or retry waves.

## Practical guidance

For user-facing reads, prefer a short exponential policy with a small count or elapsed-time budget. For background maintenance or queue workers, a larger budget can be reasonable, but it should still have a cap and should surface exhaustion to monitoring instead of waiting invisibly forever.

For writes and transactions, retry only when the operation is safe to repeat. A transaction that inserted a row, emitted an external event, or advanced a sequence before the client observed failure may run twice unless the transaction is idempotent. Use idempotency keys, unique constraints, compare-and-set updates, or outbox-style coordination before applying a database-unavailability retry policy to mutating work.

Keep the retry predicate separate from the timing policy. The schedule describes recurrence; the surrounding error handling decides whether a database error is actually transient enough to retry.
