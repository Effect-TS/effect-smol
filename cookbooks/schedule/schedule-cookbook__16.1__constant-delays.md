---
book: "Effect `Schedule` Cookbook"
section_number: "16.1"
section_title: "Constant delays"
part_title: "Part V — Delay, Backoff, and Load Control"
chapter_title: "16. Choose a Delay Strategy"
status: "draft"
code_included: true
---

# 16.1 Constant delays

A constant delay waits the same amount of time before each retry or repeated
iteration. It keeps timing predictable without introducing an adaptive backoff
curve.

## Problem

You need a visible pause between attempts, but the dependency does not need
progressively increasing delays. Immediate retries are too aggressive, while
exponential backoff would obscure a deliberately steady cadence. The policy
should say two things clearly:

- how long to wait between attempts
- when to stop retrying

## When to use it

Use a constant delay for stable dependencies that occasionally return temporary
failures: a local service restarting, a short network hiccup, a lock that clears
quickly, or an idempotent request to a dependency that normally recovers within
a few seconds.

It is also useful as a conservative first production policy. The delay is easy
to explain in logs and dashboards, and changing `"250 millis"` to `"1 second"`
does not change the shape of the schedule.

## When not to use it

Do not use a constant delay as the only protection for overload. If every retry
waits the same amount of time, a busy caller can keep applying steady pressure
to a dependency that is already failing.

Do not use it without a stop condition unless the workflow is intentionally
unbounded. `Schedule.spaced("1 second")` by itself keeps recurring forever.

Do not use it for unsafe side effects. Retrying writes requires idempotency,
deduplication, or a domain-specific recovery plan before the schedule is chosen.

## Schedule shape

For retrying with a constant delay, start with `Schedule.spaced(duration)` and
combine it with a limit such as `Schedule.recurs(n)`.

`Schedule.spaced(duration)` waits that duration after each completed attempt
before allowing the next recurrence. Use this for ordinary retry spacing and
for repeat loops where the gap after work completes is what matters.

`Schedule.fixed(duration)` is different: it targets fixed interval boundaries.
That is useful for fixed-cadence repeating work, but it is usually not what you
mean by "wait 500 milliseconds before retrying." For retry policies, reach for
`spaced` first unless you specifically need clock-like cadence.

## Example

```ts
import { Console, Data, Effect, Schedule } from "effect"

class TemporaryProfileError extends Data.TaggedError("TemporaryProfileError")<{
  readonly reason: "Timeout" | "Unavailable"
}> {}

let attempts = 0

const fetchProfile = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`profile attempt ${attempts}`)

  if (attempts < 3) {
    return yield* Effect.fail(
      new TemporaryProfileError({ reason: "Unavailable" })
    )
  }

  return { id: "user-123", name: "Ada" }
})

const retryWithConstantDelay = Schedule.spaced("50 millis").pipe(
  Schedule.both(Schedule.recurs(4))
)

const program = fetchProfile.pipe(
  Effect.retry(retryWithConstantDelay)
)

Effect.runPromise(program).then((profile) => {
  console.log(`loaded profile: ${profile.name}`)
})
```

The example uses a short delay so it terminates quickly in `scratchpad/repro.ts`.
In a real retry, choose the delay from the dependency's recovery behavior.

## Variants

For a user-facing request, keep both the delay and the retry count small so the
caller gets an answer quickly. For a background worker, increase the delay
before increasing the retry count. That keeps the policy simple while reducing
pressure on the dependency.

If many instances run the same policy at the same time, a constant delay can
synchronize retries. Add jitter only after the base delay and retry limit are
correct.

## Notes and caveats

`Effect.retry` feeds typed failures into the schedule. The first execution is
not delayed, and defects or interruptions are not retried as ordinary typed
failures.

The output of `Schedule.spaced` is a recurrence count. In a retry, that output
is used to drive the policy; the successful value of the retried effect is what
the program returns.

Keep classification close to the effect being retried. The schedule should
describe timing and limits, while the domain code decides which failures are
safe to retry.
