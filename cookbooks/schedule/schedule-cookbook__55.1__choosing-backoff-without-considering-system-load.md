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

Choosing backoff without considering system load is an anti-pattern because retry timing is part of the load a system produces. A local delay that looks conservative in one process can become an incident when thousands of fibers, pods, jobs, or clients retry against the same dependency at the same time.

## The anti-pattern

The problematic version chooses a backoff curve in isolation. A retry policy such as `Schedule.exponential("100 millis")` is selected because it grows, or because it is common, without asking how many callers will use it, how expensive each attempt is, and whether the downstream service is already degraded.

This creates schedules that are mathematically reasonable but operationally aggressive. Exponential backoff can still start with a large retry burst. Fibonacci backoff grows more gently, which can be useful for responsiveness, but it can also keep more pressure on a struggling dependency. Jitter helps spread retries, but it does not reduce the total number of attempts. A cap on attempts protects the caller, but it may still allow a fleet-wide surge.

## Why it happens

It usually happens when backoff is treated as a local latency choice rather than a shared-capacity choice. The engineer asks, "How soon should this one request try again?" but not "How many extra requests per second will this create if every instance enters this path?"

The `Schedule` constructors make delay curves easy to express, which is useful, but the curve is only one part of the policy. `Schedule.exponential` defines delay growth as `base * factor.pow(n)`. `Schedule.fibonacci` grows more slowly. `Schedule.jittered` randomly adjusts each delay between 80% and 120% of the original delay. `Schedule.recurs` limits recurrence count. None of these APIs can infer the dependency's retry budget, the fleet size, or the cost of each attempt.

## Why it is risky

The risk is coordinated pressure. If 500 workers all fail at once and retry after the same short exponential delay, the dependency receives a second wave before it has recovered from the first. If the failure lasts long enough, every retry level becomes another synchronized wave of traffic.

The risk also scales with fan-out. A single logical operation may call several services, each retrying internally. Adding backoff at every layer can multiply attempts across the call graph. During partial outages, this extra traffic competes with healthy traffic, increases queueing, and can turn a dependency slowdown into a wider failure.

Jitter is not a substitute for capacity planning. It reduces alignment between callers, but a jittered fleet still consumes the same retry budget unless the schedule also limits attempts, stretches delays, or stops when the operation is no longer worth pursuing.

## A better approach

Choose backoff from the dependency outward. Start with the downstream system's safe retry budget, then divide that budget across the expected number of callers, instances, and concurrent operations. Only after that choose the local delay curve.

For small fleets and cheap transient failures, a short exponential schedule with a low recurrence limit may be reasonable. For large fleets or expensive dependencies, start slower, cap attempts tightly with `Schedule.recurs`, and add `Schedule.jittered` so callers do not align on the same retry boundaries. When recovery is expected to take minutes, prefer a policy that protects the dependency over one that minimizes a single caller's latency.

Name schedules after the operational promise they make: "retry write while within payment-api budget" is more useful than "exponential retry". The name should make the dependency, retry budget, and fleet assumption reviewable.

## Notes and caveats

Backoff is not a load-shedding mechanism by itself. Use it with error classification, timeouts, bounded concurrency, rate limits, and circuit breaking where appropriate. A schedule decides when recurrence is attempted; it does not know whether the dependency is healthy enough to accept more work unless you encode that decision into the surrounding Effect workflow.

Be especially careful with shared libraries. A default retry schedule that is harmless in one service can be dangerous when adopted across a fleet. Document the assumed fleet size and downstream budget next to the schedule, and revisit those assumptions when traffic or deployment topology changes.
