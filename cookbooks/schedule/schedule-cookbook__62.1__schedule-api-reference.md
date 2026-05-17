---
book: Effect `Schedule` Cookbook
section_number: "62.1"
section_title: "Schedule API reference"
part_title: "Part XIV — Reference Appendices"
chapter_title: "62. Further Reading"
status: "draft"
code_included: false
---

# 62.1 Schedule API reference

`Schedule<Output, Input, Error, Env>` is a stepwise recurrence policy. Each
step receives an input and either produces an output with a delay, or halts with
a final output. Retry APIs usually feed failures into the schedule. Repeat APIs
usually feed successful values into the schedule.

Read the API by role:

- Constructors: `spaced`, `fixed`, `windowed`, `exponential`, `fibonacci`,
  `recurs`, `during`, `duration`, `cron`, `forever`, `identity`, and `unfold`.
- Low-level step APIs: `fromStep`, `fromStepWithMetadata`, `toStep`,
  `toStepWithMetadata`, and `toStepWithSleep`.
- Delay utilities: `addDelay`, `modifyDelay`, `jittered`, and `delays`.
- Composition: `both`, `either`, `andThen`, plus `bothLeft`, `bothRight`,
  `bothWith`, `eitherLeft`, `eitherRight`, `eitherWith`, and `andThenResult`
  when the output shape matters.
- Output, input, and state utilities: `map`, `reduce`, `collectInputs`,
  `collectOutputs`, `collectWhile`, `passthrough`, `tapInput`, `tapOutput`,
  `while`, and `take`.
- Type helpers: `satisfiesInputType`, `setInputType`,
  `satisfiesOutputType`, `satisfiesErrorType`, and
  `satisfiesServicesType`.

Start with the constructor that names the timing shape:

- `Schedule.spaced(duration)` waits after each completed run.
- `Schedule.fixed(interval)` targets a fixed cadence and does not pile up
  missed runs when work takes longer than the interval.
- `Schedule.windowed(interval)` waits until the next interval boundary.
- `Schedule.exponential(base, factor)` and `Schedule.fibonacci(one)` produce
  increasing delays.
- `Schedule.recurs(times)` limits recurrence count and outputs a zero-based
  count.
- `Schedule.during(duration)` continues while elapsed schedule time is within
  the duration.
- `Schedule.duration(duration)` recurs once after the duration.
- `Schedule.cron(expression, tz?)` schedules from a cron expression or parsed
  cron value.
- `Schedule.forever` recurs forever with zero delay.
- `Schedule.identity<A>()` recurs forever and emits each input as output.
- `Schedule.unfold(initial, next)` keeps custom state, emits the previous
  state, and computes the next state with an effect.

Then add the operational constraint. `Schedule.both` continues only while both
schedules continue and uses the maximum delay. `Schedule.either` continues
while either schedule continues and uses the minimum delay while both sides are
active. `Schedule.andThen` runs one schedule to completion before starting the
next.

Use delay modifiers when the constructor is not enough. `Schedule.addDelay`
adds an effectfully computed duration to the existing delay.
`Schedule.modifyDelay` replaces or adjusts the computed delay with access to
the current output and delay. `Schedule.jittered` randomizes each delay between
80% and 120% of the original delay. `Schedule.delays` exposes computed delays
as schedule output.

Use metadata when a decision depends on runtime context. `InputMetadata`
contains `input`, `attempt`, `start`, `now`, `elapsed`, and
`elapsedSincePrevious`. `Metadata` adds `output` and `duration`.
`fromStepWithMetadata`, `collectWhile`, and `while` are the main APIs for
metadata-aware decisions. `CurrentMetadata` is a context reference populated by
scheduling operations so code running between schedule steps can inspect the
current schedule metadata.

Prefer named constructors over custom steps when they express the policy
directly. Reach for `fromStep` or `fromStepWithMetadata` when you need custom
step semantics, custom halt behavior, or metadata-aware logic that existing
combinators cannot express.

Keep output types intentional. Counts and durations are useful for logging,
metrics, and transformations, but they should not leak into application logic by
accident. Use `map` for pure or effectful output transformation, `tapOutput` and
`tapInput` for observation, `reduce` for accumulated state, and
`collectInputs` or `collectOutputs` only when retaining the full history is
acceptable.

Most timing constructors are unbounded by themselves. `spaced`, `fixed`,
`windowed`, `exponential`, `fibonacci`, `cron`, `forever`, `identity`, and
`unfold` usually need `take`, `recurs`, `during`, `both`, or a predicate before
they are appropriate for user-facing retries or bounded jobs. The type helpers
do not change runtime behavior; use them as compile-time documentation for the
expected schedule shape.
