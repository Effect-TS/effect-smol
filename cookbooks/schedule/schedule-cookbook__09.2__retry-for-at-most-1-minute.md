---
book: Effect `Schedule` Cookbook
section_number: "9.2"
section_title: "Retry for at most 1 minute"
part_title: "Part II — Core Retry Recipes"
chapter_title: "9. Retry with Deadlines and Budgets"
status: "draft"
code_included: true
---

# 9.2 Retry for at most 1 minute

Use a one-minute retry window when a dependency deserves a bounded recovery
period, but the caller must eventually get a result or the last typed failure.

## Problem

Run the operation once immediately, then retry typed failures on a one-second
cadence while the one-minute retry window remains open.

## When to use it

Use this for idempotent reads, service discovery, startup probes, short
reconnect loops, and other boundary calls where a temporary outage may clear
within a minute.

A time window is often clearer than a retry count. Slow failed attempts produce
fewer retries inside the same minute; fast failures may produce more, but both
cases stay bounded by elapsed retry time.

## When not to use it

Do not use this as an attempt timeout. `Schedule.during("1 minute")` is checked
at retry decision points and does not cancel in-flight work.

Do not use a fixed one-second cadence for many clients that can fail together
unless synchronized retries are acceptable. Add jitter or backoff when a fleet
may retry against the same dependency.

## Schedule shape

`Schedule.spaced("1 second")` supplies the retry delay. It is unbounded by
itself.

`Schedule.during("1 minute")` supplies the elapsed retry window. It does not
add spacing.

`Schedule.both` keeps retrying only while both sides continue and uses the
maximum delay, so the composed policy preserves the one-second cadence and
stops when the one-minute window closes.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class RegistryUnavailable extends Data.TaggedError("RegistryUnavailable")<{
  readonly service: string
}> {}

interface Endpoint {
  readonly host: string
  readonly port: number
}

let attempts = 0

const discoverEndpoint: Effect.Effect<Endpoint, RegistryUnavailable> = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`discovery attempt ${attempts}`)

  if (attempts === 1) {
    return yield* Effect.fail(new RegistryUnavailable({ service: "registry" }))
  }

  return { host: "api.internal", port: 443 }
})

const retryForAtMost1Minute = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.during("1 minute"))
)

const program = Effect.gen(function*() {
  const endpoint = yield* discoverEndpoint.pipe(
    Effect.retry(retryForAtMost1Minute)
  )

  yield* Console.log(`endpoint: ${endpoint.host}:${endpoint.port}`)
})

Effect.runPromise(program)
```

If every attempt keeps failing until the one-minute retry window closes,
`Effect.retry` propagates the last `RegistryUnavailable`.

## Variants and caveats

Use `Schedule.exponential("100 millis").pipe(Schedule.both(Schedule.during("1 minute")))`
when repeated failures should slow down over the same one-minute budget.

Add a `while` predicate when only some typed failures should consume the retry
window. The predicate decides eligibility; the schedule still controls cadence
and duration.

The first attempt is not delayed. The elapsed budget starts when the schedule
is first stepped after a typed failure, and a retry scheduled near the end of
the window may begin after the nominal minute.
