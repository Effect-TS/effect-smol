---
book: Effect `Schedule` Cookbook
section_number: "8.1"
section_title: "Why jitter matters"
part_title: "Part II — Core Retry Recipes"
chapter_title: "8. Retry with Jitter"
status: "draft"
code_included: false
---

# 8.1 Why jitter matters

This subsection explains Why jitter matters as a practical Effect `Schedule` recipe.
This recipe keeps the retry policy explicit: the schedule decides when another typed
failure should be attempted again and where retrying stops. The surrounding Effect code
remains responsible for domain safety, including which failures are transient, whether
the operation is idempotent, and how the final failure is reported.

## What this section is about

This section explains why a retry policy can need randomness even when its
delay shape already looks reasonable.

Jitter is the practice of slightly randomizing retry delays so that callers do
not all retry at the same instant. In Effect, `Schedule.jittered` adjusts each
delay requested by an existing schedule. The adjusted delay is chosen between
80% and 120% of the original delay.

The important point is that jitter is not a separate retry strategy. It is a
load-shaping refinement applied to a schedule that already describes the main
timing behavior, such as fixed spacing, exponential backoff, or capped backoff.

## Why it matters

Without jitter, similar callers can stay synchronized. If many fibers, clients,
or worker processes fail at roughly the same time, a fixed delay makes them
retry together. Exponential backoff reduces pressure over time, but it can still
preserve the same rhythm across callers that started together.

That synchronization is often the thing you were trying to avoid. A dependency
that briefly failed can receive a burst of retries exactly when it starts to
recover. If the burst is large enough, retries can become part of the outage
rather than a recovery mechanism.

Jitter spreads those retry attempts over a small range around the intended
delay. The policy still mostly follows the original schedule, but callers no
longer land on the same retry boundary as precisely.

## Core idea

First choose the retry shape you actually want. For example, decide whether the
operation needs constant spacing, exponential backoff, capped backoff, a retry
limit, or an error predicate.

Then add jitter when many attempts might otherwise line up. `Schedule.jittered`
does not decide whether retrying is appropriate, how many retries are allowed,
or whether a delay should grow. It only randomizes each delay produced by the
schedule it wraps.

Because Effect jitters between 80% and 120% of the original delay, a requested
delay of 1 second becomes a randomized delay somewhere from 800 milliseconds to
1.2 seconds. A requested delay of 5 seconds becomes a randomized delay somewhere
from 4 seconds to 6 seconds.

That range is deliberately small enough to preserve the shape of the underlying
policy. A backoff policy still backs off. A capped policy still stays near its
cap. The difference is that independent callers are less likely to retry in a
single coordinated wave.

## Common mistakes

Do not treat jitter as a substitute for a retry limit. Jitter changes when
retries happen; it does not decide when retries stop.

Do not use jitter to make an unsafe operation safe to retry. Non-idempotent
writes still need idempotency keys, transactions, deduplication, or a
domain-specific recovery strategy.

Do not assume `Schedule.jittered` has configurable bounds. In Effect, it adjusts
delays between 80% and 120% of the original delay.

Do not add jitter before you understand the base policy. If a retry policy is
too aggressive, unbounded, or missing an error predicate, randomness will only
make that flawed policy less predictable.

## Practical guidance

Use jitter for retry policies that may run across many concurrent callers:
service clients, worker fleets, queue consumers, reconnect loops, and
background jobs that can all observe the same failure.

It is especially useful with exponential or capped backoff. Backoff reduces the
rate of repeated failures from each caller, while jitter reduces synchronization
between callers.

For a single user-facing request, jitter is usually a secondary concern. The
first questions are still the latency budget, the retry count, whether the
operation is safe to run again, and which failures are transient. Once the same
policy can run concurrently across many users or fibers, jitter becomes more
important.

Keep the mental model simple: jitter is a small randomized adjustment around
the delay your schedule already chose. Use it to spread out retry pressure, not
to hide unclear retry semantics.
