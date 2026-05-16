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

## What this section is about

This glossary entry explains the safety requirement behind retries. A
`Schedule` can decide whether, when, and how often to re-run an effect after
failure, but it does not make the effect itself safe to run again. Idempotency
belongs to the operation being retried, or to the protocol around it.

## Why it matters

Retries deliberately repeat work after a failed attempt. With reads, duplicate
execution is often harmless. With writes, a failure may mean only that the
caller did not observe the result; the remote system may already have applied
the change. Retrying that write without an idempotency guard can turn a
transient timeout into duplicated state.

Backoff, jitter, and limits reduce load and bound waiting, but they do not
remove this correctness risk. A retry policy can be well timed and still be
unsafe if every attempt may perform the side effect again.

## Core idea

Treat retry as failure-driven recurrence: each failure steps the schedule, and
the schedule either halts or permits another attempt after its computed delay.
Before applying that recurrence to a write, decide how duplicate attempts are
recognized and collapsed.

Common guards include idempotency keys, deterministic request identifiers,
conditional writes, upserts keyed by stable business identity, de-duplication at
the consumer, and transactional checks that make "already done" a successful
outcome. The important property is that every retry attempt represents the same
logical operation, not a new operation with the same payload.

## Practical guidance

Require an idempotency design before retrying any effect that writes, sends,
charges, publishes, provisions, deletes, or otherwise changes external state.
Use `Schedule.recurs`, `Schedule.take`, `Schedule.during`, backoff, and jitter
to control retry behavior, but do not treat those controls as substitutes for
idempotency. If the operation cannot be made idempotent, prefer surfacing the
failure, recording an ambiguous outcome for reconciliation, or moving the work
behind a durable queue that can enforce de-duplication.
