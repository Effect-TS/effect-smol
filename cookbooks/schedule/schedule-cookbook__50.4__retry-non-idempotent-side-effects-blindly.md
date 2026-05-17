---
book: Effect `Schedule` Cookbook
section_number: "50.4"
section_title: "Retry non-idempotent side effects blindly"
part_title: "Part XII — Anti-Patterns"
chapter_title: "50. Retrying Everything"
status: "draft"
code_included: false
---

# 50.4 Retry non-idempotent side effects blindly

Retrying non-idempotent side effects blindly is an anti-pattern because
`Schedule` controls timing, not replay safety. Non-idempotent means that running
the operation again can create another externally visible effect.

## The anti-pattern

The problematic version wraps a mutating operation in a broad retry policy
because the failure looks transient or ambiguous. A timeout, dropped connection,
interrupted fiber, or `5xx` response around calls such as "capture payment",
"send receipt email", "submit order", or "create shipment" may mean the
dependency did nothing, or it may mean the dependency committed the side effect
before your service received the acknowledgement.

The schedule may be bounded and well tuned. It may use backoff, jitter,
`Schedule.recurs`, `Schedule.take`, or `Schedule.during`. Those choices can
reduce load and make the retry budget visible, but they do not change the
external semantics of the operation. If each attempt creates a new side effect,
the policy is still unsafe.

This often hides behind tidy infrastructure code. A generic HTTP client, queue
worker, or repository helper accepts a retry schedule and applies it uniformly to
every failure. Safe reads, deduplicated writes, validation errors,
authorization failures, and unsafe writes all start to look like the same
operational problem.

## Why it happens

It usually happens when recurrence is designed before the domain contract.
`Schedule` is flexible enough to express many retry shapes, so it is tempting to
start with "retry transient failures" and leave replay safety for later.

Non-idempotent effects also fail in uncomfortable ways. After a payment provider
times out, you may not know whether the card was charged. After an email
provider closes the connection, you may not know whether the message was queued.
Retrying feels productive because doing nothing feels like dropping work, but
blind retry can make the final state worse than the original uncertainty.

## Why it is risky

Duplicate payments are the clearest failure. A customer can be charged twice
when the first attempt succeeded remotely but the acknowledgement was lost
locally. Backoff only changes when the second charge happens.

Duplicate emails are also user-visible. A receipt, invite, password reset, or
notification may be delivered multiple times. Spacing the attempts can reduce
bursts, but it still asks the provider to create another delivery unless the
provider deduplicates by message identity.

Duplicate orders and fulfillment requests can be expensive to unwind. A repeated
create call can allocate a second order number, reserve inventory twice, start
another shipment, or enqueue another warehouse task.

The operational signal becomes harder to read as well. Metrics may show "retry
succeeded" even though the system created two side effects and observed only the
last acknowledgement. The schedule reports recurrence; it does not report
whether the dependency treated repeated attempts as the same logical operation.

## A better approach

Require an idempotency key or equivalent deduplication mechanism before retrying
a mutating side effect. The key should identify the logical operation, not the
individual attempt. Every retry of "charge this invoice", "send this
notification", or "create this order" should carry the same stable key so the
downstream system can return the original result or reject the duplicate.

Classify failures before applying the schedule. Retry only the cases where
another attempt is both useful and replay-safe: temporary unavailability, rate
limiting, connection resets, or ambiguous transport failures for an operation
protected by idempotency. Do not retry malformed requests, failed validation,
forbidden access, declined payments, unsubscribed recipients, or business-rule
rejections.

Keep the retry policy narrow and named after the operation it protects. A policy
such as "retry idempotent payment capture briefly" communicates more than a
generic "remote API retry". Combine backoff or spacing with explicit limits such
as `Schedule.recurs`, `Schedule.take`, or `Schedule.during`, and add jitter when
many callers may retry the same dependency.

When the dependency cannot deduplicate, choose a different recovery path. Record
the uncertain outcome, reconcile through provider status APIs, use an outbox
with a uniqueness constraint, require operator review, or return a clear pending
state to the caller.

## Notes and caveats

Idempotency has to be end-to-end. A stable key in your request is not enough if
an intermediate service drops it, generates a fresh one per attempt, or
deduplicates for a shorter window than your retry and reconciliation workflow
requires.

Some operations are naturally idempotent because they set a resource to a known
state or use a deterministic identifier. Others can be made idempotent with
request keys, unique constraints, compare-and-set updates, outbox records, or
provider-specific client tokens. If neither is true, treat retries as a product
and operations decision, not as a schedule choice.

Use `Schedule` to control recurrence only after the domain has made recurrence
safe. Backoff, spacing, jitter, and retry limits are load-shaping tools. They are
not a substitute for idempotency.
