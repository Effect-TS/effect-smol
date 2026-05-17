---
book: "Effect `Schedule` Cookbook"
section_number: "24.1"
section_title: "Aggressive at startup, relaxed afterward"
part_title: "Part VI — Composition and Termination"
chapter_title: "24. Multi-Phase Policies"
status: "draft"
code_included: true
---

# 24.1 Aggressive at startup, relaxed afterward

Some startup workflows benefit from a short fast phase before settling into a
calmer cadence. Model that handoff as two named schedules sequenced with
`Schedule.andThen`.

## Problem

You need a readiness probe that catches the quick startup path without hammering
a service that takes longer to become ready. A single fast
`Schedule.spaced("100 millis")` policy is too noisy for a long startup, while a
single slow policy gives poor startup responsiveness. Scattered sleeps make the
transition hard to review.

Use a bounded warm-up phase followed by a steady-state phase: after the first
observation, check quickly for a limited number of recurrences, then check less
often.

## When to use it

Use this recipe for readiness checks, startup dependency probes, leader election
observation, background job startup, cache warm-up, and similar workflows where
early completion is common but longer startup is still valid.

The key requirement is that both phases are operationally acceptable. The fast
phase should have a visible bound, and the relaxed phase should be slow enough
that it can continue for the expected startup window without creating avoidable
load.

## When not to use it

Do not use this schedule to hide a failed startup. If the domain has a clear
terminal failure, stop on that value. If startup must fail after a known budget,
add `Schedule.during` or another explicit limit.

Do not apply an aggressive warm-up phase to many instances without considering
coordination. If a whole fleet starts at once, a deterministic 100 millisecond
cadence can still synchronize callers. Add jitter where that matters.

## Schedule shape

The phase boundary belongs in the schedule, not in a loop:

1. `warmUp` is fast and finite.
2. `steadyState` is slower and may continue until the status or budget stops it.
3. `Schedule.andThen(warmUp, steadyState)` sequences the phases.
4. `Schedule.passthrough` lets the latest successful status decide whether to
   continue.
5. `Schedule.while` stops when the status is no longer a startup state.

The first effect run is not delayed. With `Effect.repeat`, the successful value
from each run is fed into the schedule. That is what allows the schedule to stop
when readiness is reached.

## Example

```ts
import { Console, Effect, Schedule } from "effect"

type Readiness =
  | { readonly _tag: "Starting" }
  | { readonly _tag: "Ready" }
  | { readonly _tag: "Failed"; readonly reason: string }

const observations: ReadonlyArray<Readiness> = [
  { _tag: "Starting" },
  { _tag: "Starting" },
  { _tag: "Starting" },
  { _tag: "Starting" },
  { _tag: "Ready" }
]

let checks = 0

const checkReadiness = Effect.gen(function*() {
  const status = observations[Math.min(checks, observations.length - 1)]
  checks += 1
  yield* Console.log(`readiness check ${checks}: ${status._tag}`)
  return status
})

const warmUp = Schedule.spaced("10 millis").pipe(
  Schedule.take(3)
)

const steadyState = Schedule.spaced("40 millis")

const startupThenRelaxed = Schedule.andThen(warmUp, steadyState).pipe(
  Schedule.satisfiesInputType<Readiness>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Starting"),
  Schedule.bothLeft(
    Schedule.during("200 millis").pipe(
      Schedule.satisfiesInputType<Readiness>()
    )
  )
)

const program = Effect.repeat(checkReadiness, startupThenRelaxed).pipe(
  Effect.flatMap((status) => Console.log(`finished with ${status._tag}`))
)

Effect.runPromise(program)
```

`program` performs one readiness check immediately. If that check returns
`Starting`, the schedule allows another check after the warm-up delay. Once the
fast phase is exhausted, the policy switches to the slower phase.

The repeat stops when `checkReadiness` returns `Ready` or `Failed`, because the
`Schedule.while` predicate only continues for `Starting`. The elapsed budget
prevents an indefinitely starting service from polling forever under this
workflow.

## Variants

Use a smaller warm-up for user-facing paths, and a wider steady-state interval
for platform checks that can continue longer. For a fleet-wide startup policy,
add `Schedule.jittered` before the status predicate and elapsed budget.

## Notes and caveats

`Schedule.andThen` is sequencing, not parallel composition. The second phase
does not participate until the first phase completes.

Keep the warm-up phase finite. If the first phase is an unbounded schedule, the
relaxed phase will never run.

`Schedule.take(20)` limits scheduled recurrences after the initial effect run.
It does not mean 20 total calls.

`Schedule.while` sees schedule metadata. In this recipe the predicate checks
`metadata.input`, because `Effect.repeat` feeds the successful `Readiness` value
into the schedule after each check.

The schedule controls the delay between checks. It does not time out an
individual readiness probe. If one probe can hang, apply a timeout to
`checkReadiness` itself before repeating it.
