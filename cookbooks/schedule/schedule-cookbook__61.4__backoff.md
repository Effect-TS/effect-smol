---
book: Effect `Schedule` Cookbook
section_number: "61.4"
section_title: "Backoff"
part_title: "Part XIV — Reference Appendices"
chapter_title: "61. Glossary"
status: "draft"
code_included: false
---

# 61.4 Backoff

Backoff is the delay shape used by a `Schedule` when recurrence should become
less aggressive over time, most commonly for retrying transient failures. It is
not a separate Effect primitive. It is a way to describe the delays a schedule
offers between attempts.

## What this section is about

This glossary entry defines backoff as schedule timing. A backoff policy says
how long to wait before the next recurrence, while other schedule combinators
decide how many recurrences are allowed, which inputs may continue, and when an
elapsed-time budget has expired.

## Why it matters

Backoff controls pressure on the system being called. Immediate or synchronized
retries can make an outage worse, while unbounded waits can hide failure from
users and callers. Naming the delay shape makes the policy easier to review:
fixed, linear, exponential, and capped policies have different load and latency
tradeoffs.

## Core idea

A fixed backoff uses the same delay each time. In `Schedule`, `Schedule.spaced`
models a fixed wait after each completed attempt, while `Schedule.fixed` models
a fixed cadence aligned to interval boundaries and does not let missed runs pile
up.

A linear backoff increases by a constant amount on each recurrence. There is no
dedicated `Schedule.linear` constructor in `Schedule.ts`; model this shape with
state, for example by unfolding the next delay and applying it as the recurrence
delay.

An exponential backoff multiplies the delay by a factor each time.
`Schedule.exponential(base, factor)` computes delays as `base * factor^n`,
where `n` is the number of repetitions so far. The implementation uses the
schedule attempt count minus one, so the first delay is the base duration. The
default factor is `2`.

A capped backoff is any increasing shape with an upper bound on the delay. The
cap is part of the delay policy, not the recurrence budget: a capped exponential
policy may continue to recur after it reaches the maximum delay. Use a separate
count or elapsed-time limit when the policy must eventually stop.

## Practical guidance

Use fixed backoff when a stable retry pace is acceptable and the downstream
system can tolerate it. Use linear backoff when pressure should increase gently.
Use exponential backoff for failures that may be caused by overload or temporary
unavailability. Add a cap when the exponential tail would otherwise wait longer
than the workflow can justify.

Backoff should usually be combined with an explicit stop condition such as
`Schedule.recurs`, `Schedule.take`, or `Schedule.during`. Add
`Schedule.jittered` when many fibers, processes, or clients could otherwise
retry on the same delay boundaries; in `Schedule.ts`, jitter adjusts each delay
randomly between 80% and 120% of the original delay.
