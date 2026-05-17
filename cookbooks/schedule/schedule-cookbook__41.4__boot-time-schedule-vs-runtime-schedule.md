---
book: Effect `Schedule` Cookbook
section_number: "41.4"
section_title: "Boot-time schedule vs runtime schedule"
part_title: "Part IX — Composition Recipes"
chapter_title: "41. Build Multi-Phase Policies"
status: "draft"
code_included: true
---

# 41.4 Boot-time schedule vs runtime schedule

Startup and steady-state failures usually deserve different retry shapes. During
boot, the service may be racing DNS, migrations, a database primary election, or
a dependency that is still becoming reachable. The schedule can be aggressive
because readiness has not opened traffic yet, and a quick recovery is worth a
short burst of attempts.

After the service is running, the same dependency failure should usually be
handled more steadily. A runtime retry policy should avoid adding pressure to an
already unhealthy dependency, spread retries across instances, and make the
maximum retry work obvious to operators.

## Problem

Define separate retry schedules for the same dependency operation when it is used
in two contexts:

- a boot-time readiness check that must succeed before the service is marked
  ready
- a runtime call that may fail after the service is already serving traffic

Using the same retry policy for both contexts hides the operational intent and
makes the different budgets harder to review.

## When to use it

Use this recipe when the same dependency is contacted during startup and again
during normal request or worker processing. Typical examples are database
connectivity checks, message broker readiness, cache warmup probes, feature flag
client initialization, and search cluster health checks.

It is especially useful when readiness is allowed to fail the process quickly,
but runtime failures should be retried conservatively so the service does not
turn a partial outage into a traffic spike.

## When not to use it

Do not retry permanent boot failures. Invalid configuration, missing secrets,
bad credentials, incompatible schema versions, and malformed endpoints should
fail startup without a Schedule.

Do not use a runtime schedule to make unsafe side effects look resilient. If the
operation is not idempotent, classify the failure before retrying and keep the
retry boundary around only the part that is safe to repeat.

## Schedule shape

Use two named schedules instead of a single shared constant.

For boot:

- start with a very small `Schedule.exponential` base delay
- add `Schedule.jittered` if many instances may start together
- combine the timing with `Schedule.recurs` so readiness fails quickly when the
  dependency stays unavailable

For runtime:

- use a larger base delay or a simple `Schedule.spaced` cadence
- keep jitter enabled for fleet-wide spreading
- cap the delay when an exponential policy would otherwise wait too long
- combine the policy with a recurrence limit or elapsed budget

`Schedule.both` is useful for adding limits because the combined schedule
continues only while both schedules continue, and it uses the larger delay.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class DependencyUnavailable extends Data.TaggedError("DependencyUnavailable")<{
  readonly phase: "boot" | "runtime"
}> {}

declare const checkDependency: Effect.Effect<void, DependencyUnavailable>
declare const callDependency: Effect.Effect<string, DependencyUnavailable>

const bootReadinessPolicy = Schedule.exponential("25 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(6))
)

const runtimePolicy = Schedule.exponential("250 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(3)))
  ),
  Schedule.both(Schedule.recurs(4))
)

export const boot = checkDependency.pipe(
  Effect.retry(bootReadinessPolicy)
)

export const runtime = callDependency.pipe(
  Effect.retry(runtimePolicy)
)
```

The boot policy tries to recover quickly from short startup races. The original
readiness check runs once, then the schedule allows at most six scheduled
retries with very small exponential delays. If the dependency is still
unavailable after that, startup fails instead of waiting in readiness forever.

The runtime policy starts slower, jitters each delay, caps the maximum sleep at
three seconds, and stops after four scheduled retries. That gives an in-flight
operation a chance to survive a transient dependency blip without turning every
instance into a tight retry loop.

## Variants

For a readiness probe that should stay simple, use a fixed short cadence:

```ts
const bootProbePolicy = Schedule.spaced("100 millis").pipe(
  Schedule.both(Schedule.recurs(10))
)
```

For a runtime worker that should keep trying but at a calm cadence, avoid
exponential growth and use spaced retries with a visible count:

```ts
const workerReconnectPolicy = Schedule.spaced("5 seconds").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(12))
)
```

For a deployment where hundreds of instances may start at the same time, keep
jitter on both policies. Boot jitter spreads readiness pressure during rollout;
runtime jitter spreads retries during incidents.

## Notes and caveats

`Effect.retry` feeds each failure into the schedule after the effect fails. The
first attempt is not delayed. The schedule controls only the follow-up retries:
whether another attempt is allowed, and how long to sleep before it.

`Schedule.exponential` and `Schedule.spaced` recur forever by themselves. Pair
them with `Schedule.recurs`, `Schedule.take`, `Schedule.during`, or an input
predicate when the policy must have a clear end.

Keep the phase distinction in the schedule names. A generic `retryPolicy`
constant invites reuse in the wrong place; `bootReadinessPolicy` and
`runtimePolicy` make different load profiles explicit.
