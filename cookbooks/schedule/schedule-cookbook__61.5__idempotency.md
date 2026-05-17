---
book: Effect `Schedule` Cookbook
section_number: "61.5"
section_title: "Idempotency"
part_title: "Part XIV — Reference Appendices"
chapter_title: "61. Glossary"
status: "draft"
code_included: false
---

# 61.5 Idempotency

Idempotency is the property that running the same operation more than once has
the same intended effect as running it once. For retryable writes and other side
effects, it means a repeated attempt does not create duplicate orders, duplicate
payments, duplicate messages, or any other extra externally visible change.

The safety requirement lives outside the schedule. A `Schedule` can time and
bound a retry, but duplicate safety belongs to the operation being retried or
to the protocol around it.

Retries deliberately repeat work after failure. With reads, duplicate execution
is often harmless. With writes, a failure may only mean the caller did not
observe the result; the remote system may already have committed the change.
Retrying that write without a duplicate guard can turn a transient timeout into
duplicated state.

Before retrying a side effect, decide how duplicate attempts are recognized and
collapsed. Common guards include idempotency keys, deterministic request
identifiers, conditional writes, upserts keyed by stable business identity,
consumer-side de-duplication, and transactional checks that make "already done"
a successful outcome. The important property is that every retry attempt
represents the same logical operation, not a new operation with the same
payload.

Use `Schedule.recurs`, `Schedule.take`, `Schedule.during`, backoff, and jitter
to control retry behavior, but do not treat those controls as substitutes for
idempotency. A well-timed retry policy is still unsafe if each attempt may
perform the side effect again.

If the operation cannot be made idempotent, prefer surfacing the failure,
recording an ambiguous outcome for reconciliation, or moving the work behind a
durable queue that can enforce de-duplication.
