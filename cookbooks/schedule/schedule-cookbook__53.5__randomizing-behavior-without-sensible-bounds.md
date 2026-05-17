---
book: Effect `Schedule` Cookbook
section_number: "53.5"
section_title: "Randomizing behavior without sensible bounds"
part_title: "Part XII — Anti-Patterns"
chapter_title: "53. Misusing Jitter"
status: "draft"
code_included: false
---

# 53.5 Randomizing behavior without sensible bounds

Jitter is useful only after the underlying recurrence policy is sensible. Add
randomness after choosing cadence, limits, and termination.

## Anti-pattern

Jitter is treated as the policy instead of a final adjustment to one. A retry
loop is randomized before anyone chooses the base cadence, maximum delay, retry
budget, or condition that should end the loop. Callers no longer line up
exactly, but each caller can still produce too much load for too long.

Broad helpers make this easy to miss. A random delay attached to every poll,
reconnect, or retry path does not say whether the operation should run every few
milliseconds, every few seconds, or only a handful of times. It only makes the
selected delay less predictable.

## Why it happens

Randomness is mistaken for safety. Jitter helps when many fibers, clients, or
processes would otherwise repeat at the same moment, but it relies on a sensible
delay already being present. In Effect, `Schedule.jittered` adjusts each delay
between `80%` and `120%` of the original delay. If the original delay is too
aggressive, too large, unbounded, or never-ending, jitter preserves that mistake
and spreads it out.

The same confusion appears when jitter is added before the operation has a clear
error model. Transient network errors, overload responses, invalid requests, and
authorization failures should not all receive the same randomized recurrence
behavior.

## Why it is risky

Randomness makes behavior harder to reason about during incidents. Operators can
no longer predict exactly when the next attempt will occur, but the system may
still be attempting indefinitely. The load is less synchronized, but the budget
is still missing.

Unbounded randomization can also hide capacity problems. A reconnect loop
without a maximum delay can drift into waits that are too slow for recovery. A
polling loop without a stop condition can keep running after the result no
longer matters. Jitter should reduce coordination spikes, not replace control
over cadence and lifetime.

## A better approach

Choose the deterministic shape first. Start with a base cadence such as
`Schedule.spaced`, `Schedule.fixed`, or `Schedule.exponential` that reflects the
operation's cost and expected recovery time. Use `Schedule.modifyDelay` when
the maximum individual delay must be capped. Add a recurrence budget with
`Schedule.recurs` or `Schedule.take`, or an elapsed budget with
`Schedule.during`, so the schedule has an explicit stop condition. Only then add
`Schedule.jittered` when synchronized callers would be harmful.

For retries, the policy should answer three questions before randomness is
introduced: what is the first delay, what is the largest acceptable delay or
total retry window, and which failures are retryable. For polling, it should
answer how often the poll runs, what terminal state ends the repeat, and what
maximum lifetime protects the system if that state never arrives.

Name the schedule after the operational promise, such as "retry transient reads
for 30 seconds" or "poll job status until completion with bounded spacing".
Avoid names that only describe the mechanism, such as "jittered schedule",
because jitter is not the whole policy.

## Caveats

Jitter is still valuable. It is the right tool for reducing thundering-herd
behavior, where many callers share a cadence and hit the same dependency
together. The caveat is that it should be the last step of a bounded schedule,
not the substitute for one.

Small random variation is not a cap, and a cap is not a stop condition. A robust
schedule normally needs all three: a base cadence, sensible upper bounds, and a
visible reason to stop.
