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

Randomizing behavior without sensible bounds is an anti-pattern because jitter only changes the next delay of an existing schedule. It does not decide how often work should start, how large a delay may become, or when the work should stop. Without those decisions, randomness can make unsafe recurrence look more careful than it is.

## The anti-pattern

The problematic version treats jitter as the policy instead of as a final adjustment to a policy. A retry loop gets randomized before anyone chooses the base cadence, the maximum delay, the retry budget, or the condition that should end the loop. The schedule may look operationally friendly because callers no longer line up exactly, but each caller can still keep producing load for too long or too often.

This is especially easy to miss with broad helper schedules. A random delay attached to every poll, reconnect, or retry path does not say whether the operation should run every few milliseconds, every few seconds, or only a handful of times. It only makes the selected delay less predictable.

## Why it happens

It usually happens when randomness is mistaken for safety. Jitter is useful when many fibers, clients, or processes would otherwise repeat at the same moment, but it relies on a sensible delay already being present. In Effect, `Schedule.jittered` randomly adjusts each recurrence delay between 80% and 120% of the original delay. If the original delay is too aggressive, too large, unbounded, or never-ending, jitter preserves that mistake and merely spreads it out.

The same confusion appears when jitter is added before the operation has a clear error model. Transient network errors, overload responses, invalid requests, and authorization failures should not all receive the same randomized recurrence behavior.

## Why it is risky

Randomness makes behavior harder to reason about during incidents. Operators can no longer predict exactly when the next attempt will occur, but the system may still be attempting indefinitely. That combination is worse than a plain fixed delay: the load is less synchronized, but the budget is still missing.

Unbounded randomization can also hide capacity problems. A reconnect loop without a cap can keep stretching into delays that are too slow for recovery, while a polling loop without a stop condition can keep running long after the result is no longer useful. Jitter should reduce coordination spikes, not replace explicit control over cadence and lifetime.

## A better approach

Choose the deterministic shape first. Start with a base cadence such as a fixed spacing, a fixed interval, or an exponential backoff that reflects the operation's cost and expected recovery time. Add a cap or budget with combinators such as `Schedule.recurs`, `Schedule.take`, or `Schedule.during` so the schedule has an explicit stop condition. Only then add `Schedule.jittered` when synchronized callers would be harmful.

For retries, the policy should answer three questions before randomness is introduced: what is the first delay, what is the largest acceptable delay or total retry window, and which failures are retryable. For polling, it should answer how often the poll runs, what terminal state ends the repeat, and what maximum lifetime protects the system if that state never arrives.

Name the schedule after the operational promise, such as "retry transient reads for 30 seconds" or "poll job status until completion with bounded spacing". Avoid names that only describe the mechanism, such as "jittered schedule", because jitter is not the whole policy.

## Notes and caveats

Jitter is still valuable. It is the right tool for reducing thundering-herd behavior when many callers share the same cadence. The caveat is that it should be the last mile of a bounded schedule, not the substitute for one.

Small random variation is not a cap, and a cap is not a stop condition. A robust schedule normally needs all three: a base cadence, sensible upper bounds, and a visible reason to stop.
