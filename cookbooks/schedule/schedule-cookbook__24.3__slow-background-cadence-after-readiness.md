---
book: "Effect `Schedule` Cookbook"
section_number: "24.3"
section_title: "Slow background cadence after readiness"
part_title: "Part VI — Composition and Termination"
chapter_title: "24. Multi-Phase Policies"
status: "draft"
code_included: true
---

# 24.3 Slow background cadence after readiness

Readiness and monitoring are different phases: check quickly until the
dependency is ready, then observe at a slower cadence. `Schedule.andThen` makes
that phase transition explicit.

## Problem

A worker cannot do useful work until a dependency returns `Ready`. Probing too
slowly delays useful work, but keeping the startup cadence after readiness only
creates noise and unnecessary load.

The recurrence policy should make that operational intent visible:

- fast checks while readiness is still pending
- a clear switch once `Ready` is observed
- slow, steady background monitoring afterward

## When to use it

Use this recipe for service readiness checks, cache warm-up probes,
leader-election status checks, or control-plane watches where startup latency
matters but long-term polling pressure should stay low.

It is especially useful when the same effect can be repeated in both phases:
first to discover readiness, then to continue observing the dependency at a
maintenance cadence.

## When not to use it

Do not use this as a substitute for a real startup deadline. If the service must
fail fast when readiness never arrives, add an outer timeout or a separate
startup budget around the readiness workflow.

Also avoid polling when the dependency can push a readiness signal, emit an
event, or complete a handshake directly. In those cases, a schedule may be
unnecessary background work.

## Schedule shape

The startup phase uses `Schedule.spaced("250 millis")` so each
failed-to-be-ready observation is followed by a short pause. `Schedule.passthrough`
makes the successful value from the repeated effect available as the schedule
output, and `Schedule.while` stops the startup phase once that value is `Ready`.

The steady-state phase uses a slower `Schedule.spaced("30 seconds")`. Because
it is sequenced with `Schedule.andThen`, it starts only after the startup phase
completes.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type Readiness =
  | { readonly _tag: "Starting" }
  | { readonly _tag: "Ready" }

let probes = 0

const probeDependency = Effect.gen(function*() {
  probes += 1
  const status: Readiness = probes < 3
    ? { _tag: "Starting" }
    : { _tag: "Ready" }
  yield* Console.log(`probe ${probes}: ${status._tag}`)
  return status
})

const waitUntilReady = Schedule.spaced("10 millis").pipe(
  Schedule.satisfiesInputType<Readiness>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag !== "Ready")
)

const backgroundCadence = Schedule.spaced("40 millis").pipe(
  Schedule.take(3),
  Schedule.satisfiesInputType<Readiness>()
)

const readinessThenBackground = Schedule.andThen(
  waitUntilReady,
  backgroundCadence
)

const program = Effect.repeat(
  probeDependency,
  readinessThenBackground
).pipe(
  Effect.flatMap(() => Console.log("background monitoring sample finished"))
)

Effect.runPromise(program)
```

The example bounds the background phase with `Schedule.take(3)` so it terminates
in `scratchpad/repro.ts`. A daemon would usually omit that bound and let scope
or supervision own the lifetime.

## Variants

Use a shorter startup spacing when local readiness usually appears almost
immediately, and a longer spacing when the check itself is expensive. For
fleet-wide background monitoring, apply `Schedule.jittered` to the steady-state
cadence so ready instances do not all probe on the same boundary.

If the monitoring must run on wall-clock intervals, use `Schedule.fixed` for
the background phase instead of `Schedule.spaced`. `Schedule.fixed` targets
interval boundaries; `Schedule.spaced` waits after each probe completes.

## Notes and caveats

`Effect.repeat` feeds each successful `probeDependency` value into the schedule.
That is what lets `waitUntilReady` inspect `Readiness` and complete when it sees
`Ready`.

The schedule does not make the first probe wait. The effect runs once, then the
schedule decides whether and when to run it again. After `Ready` is observed,
the sequenced schedule switches from startup responsiveness to slow background
cadence.
