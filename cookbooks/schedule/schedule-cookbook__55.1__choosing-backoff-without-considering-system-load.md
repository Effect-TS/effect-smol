---
book: Effect `Schedule` Cookbook
section_number: "55.1"
section_title: "Choosing backoff without considering system load"
part_title: "Part XII — Anti-Patterns"
chapter_title: "55. Ignoring Operational Context"
status: "draft"
code_included: false
---

# 55.1 Choosing backoff without considering system load

Backoff timing is part of the load a system produces. Treat it as an
operational policy, not just a delay curve for one call.

## The anti-pattern

The mistake is choosing a retry curve in isolation. A policy such as
`Schedule.exponential("100 millis")` is selected because it grows, or because it
is familiar, without checking how many callers will use it, how expensive each
attempt is, or whether the downstream service is already degraded.

That can produce schedules that look reasonable locally and remain too
aggressive in production. Exponential backoff can still start with a large
retry wave. Fibonacci backoff grows more gently, which may improve
responsiveness but can keep pressure on a struggling dependency. Jitter spreads
timing; it does not reduce the number of attempts. Count limits protect one
execution; they do not by themselves protect the fleet.

## Why it happens

Backoff often gets treated as a latency choice instead of a capacity choice.
The code answers "how soon should this request try again?" but not "how much
extra traffic appears if every instance enters this path?"

`Schedule` makes the recurrence policy explicit, but it cannot infer the
dependency's retry budget, fleet size, or cost per attempt.
`Schedule.exponential` starts at the base delay and multiplies by the factor on
each recurrence, defaulting to `2`. `Schedule.fibonacci` grows more slowly.
`Schedule.jittered` adjusts each delay between 80% and 120% of the computed
delay. `Schedule.recurs` limits the number of recurrences. Those are local
mechanics; the capacity decision remains yours.

## Why it is risky

The risk is coordinated pressure. If 500 workers fail together and retry after
the same short delay, the dependency receives another wave before it has
recovered from the first. If the outage continues, each retry level can become
another synchronized wave.

The risk also scales with fan-out. One logical operation may call several
services, each with its own retry policy. Backoff at every layer can multiply
attempts across the call graph. During partial outages, that traffic competes
with healthy traffic, increases queueing, and can turn a dependency slowdown
into a wider failure.

Jitter is not capacity planning. It reduces alignment between callers, but a
jittered fleet still spends the same retry budget unless the policy also limits
attempts, stretches delays, or stops when the operation is no longer useful.

## A better approach

Choose backoff from the dependency outward. Start with the downstream system's
safe retry budget, divide it across expected callers and concurrent operations,
and only then choose the local delay curve.

For small fleets and cheap transient failures, a short exponential schedule
with a low recurrence limit may be enough. For large fleets or expensive
dependencies, start slower, cap attempts tightly with `Schedule.recurs`, and
add `Schedule.jittered` when callers could align on the same retry boundary.
When recovery may take minutes, protect the dependency before optimizing one
caller's latency.

Name schedules after the operational promise: `retryPaymentApiWritesWithinBudget`
is more useful than `exponentialRetry`. The name should make the dependency,
retry budget, and fleet assumption reviewable.

## Notes and caveats

Backoff is not a load-shedding mechanism by itself. Use it with error
classification, timeouts, bounded concurrency, rate limits, and circuit
breaking where appropriate. A schedule decides when recurrence is attempted; it
does not know whether the dependency is healthy enough to accept more work
unless that decision is encoded in the surrounding Effect workflow.

Be careful with shared libraries. A default retry schedule that is harmless in
one service can become dangerous when adopted across a fleet. Keep the assumed
fleet size and downstream budget near the schedule, and revisit them when
traffic or deployment topology changes.
