---
book: Effect `Schedule` Cookbook
section_number: "62.4"
section_title: "Idempotency and safe retries"
part_title: "Part XIV — Reference Appendices"
chapter_title: "62. Further Reading"
status: "draft"
code_included: false
---

# 62.4 Idempotency and safe retries

Use this entry as a boundary check before applying retry recipes to writes,
publishing, notifications, payments, or any workflow with externally visible
side effects.

Idempotency means that a logical operation can be attempted more than once
without producing more than one logical result. `Schedule` can decide when
another attempt is allowed, how long to wait, and when the retry budget is
exhausted, but it cannot create that property for a write. For retries, the
important word is "logical": the network request may be sent twice, the
database statement may run twice, or the remote service may observe duplicate
traffic, but the business result should remain one order, one charge, one
reservation, one message, or one state transition.

The usual mechanism is an idempotency key. Generate one key for the logical
operation and reuse that same key for every retry attempt. Do not create the key
inside the retried effect if that would produce a fresh key per attempt. A fresh
key turns retries into new operations.

Safe writes can also be expressed with stable resource identifiers, unique
constraints, compare-and-set updates, transactional upserts, inbox or outbox
deduplication, or remote APIs that honor an idempotency header. The exact
mechanism is domain-specific, but the retry policy should assume that the
mechanism exists before it repeats the write.

A failed attempt does not prove that the side effect did not happen. The caller
may time out after the database commits. A payment provider may accept a charge
and drop the response. A message broker may receive a publish request while the
client loses the acknowledgement. Retrying those cases without duplicate
protection can create the exact incident the retry was meant to prevent.

This is why retry safety is not the same as transient-failure handling.
`Effect.retry` retries typed failures according to a `Schedule`; the first
attempt runs immediately, and the schedule is consulted after failures. If the
failure says "response was lost", the schedule can delay and limit the next
attempt, but only the operation's idempotency boundary can decide whether the
next attempt is semantically safe.

Duplicate side effects are especially easy to hide in large workflows. A retry
around "create user, send email, publish event, update search index" may repeat
all four steps even though only one step was transient. Put the retry around the
smallest operation that is safe to repeat, and give each externally visible
effect its own deduplication story.

Separate the retry question from the safety question.

The safety question is: if this exact logical operation is observed twice, what
prevents duplicate business effects? Answer that with an idempotency key,
conditional write, dedupe table, unique constraint, or transactional protocol
before adding a schedule.

The retry question is: after a retryable typed failure, how much more work is
acceptable? Answer that with the smallest `Schedule` that matches the
operational promise. Use `Schedule.recurs` or `Schedule.take` for a count
budget, `Schedule.during` for an elapsed-time budget, `Schedule.spaced` for a
constant wait, `Schedule.exponential` for growing waits, and `Schedule.jittered`
when many callers may otherwise align on the same retry boundaries.

When combining budgets, remember the semantics. `Schedule.both` continues only
while both schedules continue and uses the larger delay, which is usually the
conservative shape for "retry with backoff, but stop after this many attempts or
this much time." `Schedule.either` continues while either side continues and
uses the smaller delay; that can accidentally extend unsafe retry work if used
as a fallback instead of a deliberate union.

Treat idempotency keys as part of the request contract. Persist enough
information to recognize a repeated logical operation and return the original
result when that is the correct behavior. For writes that create resources, a
client-supplied operation key or stable resource id is often more useful than a
server-generated id that is only known after the first attempt succeeds.

Classify failures before they enter the retry budget. Timeouts, connection
resets, rate limits, and temporary unavailability may be retryable when the
operation is idempotent. Validation failures, authorization failures, malformed
requests, semantic conflicts, and permanent business-rule failures should stop
without spending the schedule.

Keep retry boundaries narrow. If a workflow must read, write, publish, and
notify, retry only the step whose failure is transient and whose side effect is
duplicate-safe. If later steps need their own retry policy, give them their own
idempotency key or dedupe mechanism instead of relying on the first step's
protection.

Prefer finite schedules for writes. A small `Schedule.recurs` or `Schedule.take`
budget makes the maximum duplicate pressure reviewable. Add `Schedule.during`
when user-facing latency or downstream recovery windows matter. Add
`Schedule.jittered` for fleet-wide retries, but do not treat jitter as a safety
mechanism; it spreads attempts over time and does not reduce the number of
logical retries.

Document the promise next to the policy. A name such as
`retryCreateInvoiceWithIdempotencyKey` is better than `writeRetryPolicy`
because it records both halves of the design: the write is protected against
duplicates, and the schedule is only the timing and budget for transient
failures.
