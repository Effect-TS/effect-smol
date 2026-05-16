---
book: Effect `Schedule` Cookbook
section_number: "56.1"
section_title: "“I need to retry a flaky call”"
part_title: "Part XIII — Choosing the Right Recipe"
chapter_title: "56. Recipe Selection Guide"
status: "draft"
code_included: false
---

# 56.1 “I need to retry a flaky call”

Use this entry when the operation is expected to succeed if tried again, but only under a controlled policy. A flaky call is not a license to retry forever. It is a reason to choose a delay shape, a limit, and a safety rule before writing the retry.

## What this section is about

Start by naming the call shape:

- A very short local race, such as a warm cache, leader election handoff, or just-created resource, usually wants a small constant delay.
- A remote dependency that may be overloaded usually wants backoff.
- A call made by many fibers, processes, or nodes usually wants jitter.
- A user-facing call usually wants a short attempt or elapsed-time budget.
- A write with side effects must be idempotent, deduplicated, or not retried blindly.

The recipe is selected from those facts. Do not begin with the most expressive schedule and then tune it down.

## Why it matters

Retry policy is part of the load placed on the dependency. A policy that is harmless for one request can become an outage amplifier when many callers fail at the same time. The important production questions are:

- How soon is another attempt useful?
- How many attempts can the caller justify?
- How long may the workflow remain invisible to the user or caller?
- Would repeating the call duplicate a side effect?
- Will many callers retry on the same schedule?

## Core idea

Choose the smallest schedule that describes the operational promise:

- Use `Schedule.spaced` when each retry should wait a fixed duration after the previous attempt completes. This is the usual fixed-delay retry shape.
- Use `Schedule.fixed` when retries should align to a fixed interval boundary. If the action runs longer than the interval, the next run happens immediately, but missed intervals do not pile up. This is more common for repeating work than for ordinary flaky-call retries.
- Use `Schedule.exponential` when each failure should wait longer than the last one. Its delay is `base * factor.pow(n)`, with a default factor of `2`.
- Use `Schedule.jittered` when many callers may retry together. It adjusts each delay randomly between `80%` and `120%` of the original delay.
- Use `Schedule.recurs` or `Schedule.take` to bound the number of retry decisions.
- Use `Schedule.during` to bound total elapsed schedule time.
- Use `Schedule.both` when two constraints must both hold, such as backoff and a maximum retry count. The combined schedule continues only while both sides continue and uses the larger delay.

For most flaky remote calls, the default selection is exponential backoff, jitter, and a small retry limit. Use plain fixed spacing only when the failure is known to clear quickly and the dependency can tolerate the repeated load.

## Practical guidance

Use fixed delay when the call is cheap, the expected recovery window is short, and retrying does not increase pressure on an already stressed dependency. Examples include a local service startup race or a read-after-create consistency gap where a few attempts are enough.

Use backoff when failure may mean the dependency is slow, saturated, restarting, rate limiting, or temporarily unavailable. Backoff gives the dependency more room after each failure. Prefer a conservative base delay for external systems, then cap the behavior with a retry count or elapsed budget.

Add jitter when retries can synchronize. This includes HTTP clients in a fleet, background workers reading the same queue, scheduled jobs, or anything triggered by a shared deploy, outage, or clock boundary. Jitter is especially important with backoff because identical callers otherwise keep retrying in waves.

Always add a limit unless the retry is part of a deliberately supervised background loop. For request-response work, the limit is usually a small retry count, an elapsed-time budget, or both. Count limits make the worst-case number of attempts obvious; elapsed limits make the caller-visible waiting time obvious.

Check side effects before retrying writes. Retrying a `GET` or a status fetch is usually different from retrying a charge, email send, file mutation, or external workflow transition. For writes, require idempotency keys, deduplication, or a separate recovery design before selecting a retry schedule.

If the policy cannot be explained in one sentence, split the problem. Classify retryable errors first, choose delay shape second, add jitter if callers can synchronize, and add limits last so the final behavior is bounded and reviewable.
