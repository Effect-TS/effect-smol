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

Jitter is a small random adjustment to retry delays. It keeps callers that fail
together from retrying at exactly the same time.

## What this section is about

`Schedule.jittered` wraps an existing schedule and modifies each delay it
produces. In Effect, the adjusted delay is between 80% and 120% of the original
delay.

Jitter is not a retry strategy by itself. First choose the main timing policy:
fixed spacing, exponential backoff, capped backoff, a retry count, and any error
predicate. Then add jitter when many callers might otherwise line up on the
same retry boundary.

## Why it matters

Without jitter, similar callers can stay synchronized. If many fibers, clients,
or worker processes fail at roughly the same time, a fixed delay makes them
retry together. Exponential backoff lowers pressure over time, but callers that
started together can still follow the same rhythm.

That synchronization can turn retries into another burst against a recovering
dependency. Jitter spreads the attempts across a small range around the intended
delay, so the policy keeps its shape while the callers stop moving in lockstep.

## Core idea

A one-second delay becomes a random delay between 800 milliseconds and 1.2
seconds. A five-second delay becomes a random delay between 4 and 6 seconds.

The range is narrow enough that a backoff policy still backs off and a capped
policy still stays near its cap. The benefit is distribution: independent
callers are less likely to retry in a single wave.

## Common mistakes

Do not use jitter as a retry limit. It changes when retries happen, not when
they stop.

Do not use jitter to make unsafe operations safe to retry. Non-idempotent writes
still need idempotency keys, transactions, de-duplication, or a domain-specific
recovery plan.

Do not assume configurable bounds. Effect's `Schedule.jittered` uses the fixed
80% to 120% range.

Do not add jitter to hide an aggressive or unbounded base policy. Randomness
will make a flawed policy less predictable, not safer.

## Practical guidance

Use jitter for retry policies that may run across many concurrent callers:
service clients, worker fleets, queue consumers, reconnect loops, and background
jobs observing the same failure.

For a single user-facing request, jitter is usually secondary to latency budget,
retry count, retry safety, and error eligibility. Once the same policy can run
concurrently across many users or fibers, jitter becomes more important.

Keep the mental model simple: jitter is a small randomized adjustment around
the delay your schedule already chose.
