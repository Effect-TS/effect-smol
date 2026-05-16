---
book: Effect `Schedule` Cookbook
section_number: "58.3"
section_title: "Redis reconnect"
part_title: "Part XIV — Reference Appendices"
chapter_title: "58. Index by Problem"
status: "draft"
code_included: false
---

# 58.3 Redis reconnect

Redis reconnect maps to a jittered, bounded backoff policy. It does not need a
new `Schedule` primitive: use `Schedule.exponential` for increasing reconnect
delays, `Schedule.jittered` to desynchronize clients, `Schedule.modifyDelay` to
apply a maximum sleep, and `Schedule.recurs`, `Schedule.take`, or
`Schedule.during` to keep the reconnect loop bounded.

## What this section is about

Use this entry when a worker, stream consumer, cache client, subscription
listener, or queue processor loses Redis and should attempt to reconnect without
turning a short outage into a synchronized connection storm.

The closest full recipe is [27.2 Jittered retries for Redis reconnects](schedule-cookbook__27.2__jittered-retries-for-redis-reconnects.md).
Related entries are [21.5 Capped exponential backoff](schedule-cookbook__21.5__capped-exponential-backoff.md),
[25.3 Cap long tails in retry behavior](schedule-cookbook__25.3__cap-long-tails-in-retry-behavior.md),
and [57.5 Single-instance behavior vs fleet-wide behavior](schedule-cookbook__57.5__single-instance-behavior-vs-fleet-wide-behavior.md).

## Why it matters

A Redis restart, failover, network flap, or rolling deployment can be observed
by many clients at nearly the same time. Plain exponential backoff reduces
pressure for each individual client, but identical delay curves can still align
across a fleet. Jitter changes each computed delay by a random factor between
`80%` and `120%`, spreading reconnect attempts while preserving the broad
backoff shape.

The cap is a different concern. It bounds the longest sleep so a worker does not
wait unexpectedly long before trying Redis again. The retry limit or elapsed
budget is separate again: it decides when reconnecting is no longer the right
behavior and the failure should surface.

## Core idea

Build the policy in named layers:

- `Schedule.exponential(base, factor)` gives a short initial delay and grows the
  delay as reconnect failures continue.
- `Schedule.jittered` spreads each computed delay between `80%` and `120%` of
  the original delay, which helps a fleet avoid lockstep reconnects.
- `Schedule.modifyDelay` can cap the resulting delay so the final wait never
  exceeds the operational maximum.
- `Schedule.recurs`, `Schedule.take`, or `Schedule.during` bounds the policy by
  retry count, recurrence count, or elapsed time.
- `Schedule.both` combines independent constraints with intersection semantics,
  so the reconnect policy continues only while both sides still allow it.

## Practical guidance

For a small service or startup readiness path, prefer a short base delay and a
small retry budget. Configuration errors such as a bad Redis URL, missing
credentials, TLS mismatch, or unsupported protocol should fail fast rather than
being hidden behind a reconnect schedule.

For long-running workers, use a larger budget or an elapsed-time bound so
operators can answer how long the worker will keep trying before surfacing the
failure. Keep the cap visible in the schedule instead of burying it in the Redis
client wrapper.

For a large fleet, keep jitter even when the cap is low. The cap limits maximum
per-client sleep; jitter reduces synchronization across clients. Neither one
limits total fleet demand by itself, so pair the reconnect policy with Redis
connection limits, readiness behavior, graceful shutdown, and any service-level
load shedding required by the deployment.
