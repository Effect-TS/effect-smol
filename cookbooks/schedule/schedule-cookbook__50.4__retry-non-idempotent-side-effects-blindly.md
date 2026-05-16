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

Retrying non-idempotent side effects blindly is an anti-pattern because the schedule controls timing, not meaning. `Schedule` can describe how often an operation is retried, how delays grow, when a retry budget is exhausted, and how multiple policies combine. It cannot know whether the previous attempt already charged a card, sent an email, created an order, or reserved inventory.

The dangerous case is an ambiguous failure after the request has left your process. A timeout, dropped connection, interrupted fiber, or `5xx` response may mean the dependency did nothing. It may also mean the dependency committed the side effect and failed before your service received the acknowledgement. Running the same operation again without a deduplication contract can turn uncertainty into duplication.

## The anti-pattern

The problematic version wraps a mutating operation in a broad retry policy because the failure looks transient. A shared `Schedule.exponential`, `Schedule.spaced`, or `Schedule.forever`-derived policy is attached around calls such as "capture payment", "send receipt email", "submit order", or "create shipment" before the operation has an idempotency story.

The schedule may be bounded and well tuned. It may use backoff, jitter, `Schedule.recurs`, `Schedule.take`, or `Schedule.during`. Those choices can reduce load and make the retry budget visible, but they do not change the external semantics of the operation. If each attempt creates a new side effect, the policy is still unsafe.

This often hides behind tidy infrastructure code. A generic HTTP client, queue worker, or repository helper accepts a retry schedule and applies it uniformly to every failure. That makes safe reads, deduplicated writes, validation errors, authorization failures, and unsafe writes all look like the same operational problem.

## Why it happens

It usually happens when recurrence is designed before the domain contract. `Schedule` is flexible enough to express many retry shapes, so it is tempting to start with "retry transient failures" and leave the question of replay safety for later.

Non-idempotent effects also fail in uncomfortable ways. After a payment provider times out, you may not know whether the card was charged. After an email provider closes the connection, you may not know whether the message was queued. After an order API returns an unavailable response, you may not know whether the order record was created. Retrying feels productive because doing nothing feels like dropping work, but blind retry can make the final state worse than the original uncertainty.

## Why it is risky

Duplicate payments are the clearest failure. A customer can be charged twice when the first attempt succeeded remotely but the acknowledgement was lost locally. Backoff only changes when the second charge happens.

Duplicate emails are also user-visible. A receipt, invite, password reset, or notification may be delivered multiple times, creating confusion or leaking that an internal workflow is unstable. Spacing the attempts can reduce bursts, but it still asks the provider to create another delivery unless the provider deduplicates by message identity.

Duplicate orders and fulfillment requests can be expensive to unwind. A repeated create call can allocate a second order number, reserve inventory twice, start another shipment, or enqueue another warehouse task. The retry budget may be small, but a single duplicate can still require reconciliation.

The operational signal becomes harder to read as well. Metrics may show "retry succeeded" even though the system created two side effects and observed only the last acknowledgement. The schedule reports recurrence; it does not report whether the dependency treated repeated attempts as the same logical operation.

## A better approach

Require an idempotency key or equivalent deduplication mechanism before retrying a mutating side effect. The key should identify the logical operation, not the individual attempt. Every retry of "charge this invoice", "send this notification", or "create this order" should carry the same stable key so the downstream system can return the original result or reject the duplicate instead of performing the action again.

Classify failures before applying the schedule. Retry only the cases where another attempt is both useful and replay-safe: temporary unavailability, rate limiting, connection resets, or ambiguous transport failures for an operation protected by idempotency. Do not retry malformed requests, failed validation, forbidden access, declined payments, unsubscribed recipients, or business-rule rejections.

Keep the retry policy narrow and named after the operation it protects. A policy such as "retry idempotent payment capture briefly" communicates more than a generic "remote API retry". Combine backoff or spacing with explicit limits using operators such as `Schedule.recurs`, `Schedule.take`, or `Schedule.during`, and add jitter when many callers may retry the same dependency.

When the dependency cannot deduplicate, choose a different recovery path. Record the uncertain outcome, reconcile through provider status APIs, use an outbox with a uniqueness constraint, require operator review, or return a clear pending state to the caller. Those options are less convenient than retrying, but they preserve the distinction between "we do not know what happened" and "do it again".

## Notes and caveats

Idempotency has to be end-to-end. A stable key in your request is not enough if an intermediate service drops it, generates a fresh one per attempt, or deduplicates for a shorter window than your retry and reconciliation workflow requires.

Some operations are naturally idempotent because they set a resource to a known state or use a deterministic identifier. Others can be made idempotent with request keys, unique constraints, compare-and-set updates, outbox records, or provider-specific client tokens. If neither is true, treat retries as a product and operations decision, not as a schedule choice.

The useful rule is simple: use `Schedule` to control recurrence only after the domain has made recurrence safe. Backoff, spacing, jitter, and retry limits are load-shaping tools. They are not a substitute for idempotency.
