---
book: "Effect `Schedule` Cookbook"
section_number: "22.3"
section_title: "Stop when data becomes available"
part_title: "Part VI — Composition and Termination"
chapter_title: "22. Stop Conditions"
status: "draft"
code_included: true
---

# 22.3 Stop when data becomes available

Sometimes the absence of data is not an error. A cache entry may be warming in
the background, a resource record may be propagating, or another process may be
about to publish the value you need. In those cases, model "not available yet"
as a successful observation and let the schedule stop when a later successful
observation contains the data.

This recipe uses a cache lookup as the example. The lookup can succeed with
`Missing` or `Available`; only real lookup failures stay in the error channel.

## Problem

A profile lookup may hit a cache before the background warmer has published the
entry. A miss is a normal observation in that path, so the polling policy should
wait briefly for an `Available` result without converting `Missing` into an
error.

The first lookup should happen immediately. If the data is missing, wait and try
again. If the data is available, stop without another lookup. The schedule should
make that stop condition visible in one place.

## When to use it

Use this when all of these are true:

- A missing value is a normal temporary result.
- Some other path is already responsible for making the data available.
- The caller wants to wait by polling rather than subscribing to a push signal.
- Lookup failures should remain distinct from "not available yet".

Typical examples include asynchronous cache warm-up, read-through cache
population, eventually visible resource metadata, and short propagation windows
after a write.

## When not to use it

Do not use this when the data may never be produced. Invalid keys, authorization
problems, disabled producers, and malformed requests should be represented as
separate domain results or failures before the schedule is applied.

Do not treat cache backend errors as misses unless the domain explicitly says
that is safe. A network error, serialization failure, or unavailable cache
server is usually a failed lookup, not an absent value.

Prefer a push-based callback, queue message, or notification channel when the
producer already has a reliable way to signal availability.

## Schedule shape

Use a spaced schedule for the polling cadence, preserve the successful lookup
result as the schedule output, and continue only while that result is
`Missing`. The repeated program can then inspect the final observed lookup
result after the schedule stops.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type Availability<A> =
  | { readonly _tag: "Missing" }
  | { readonly _tag: "Available"; readonly value: A }

interface UserProfile {
  readonly id: string
  readonly displayName: string
}

type CacheLookupError = {
  readonly _tag: "CacheLookupError"
  readonly message: string
}

const observations: ReadonlyArray<Availability<UserProfile>> = [
  { _tag: "Missing" },
  { _tag: "Missing" },
  {
    _tag: "Available",
    value: { id: "user-1", displayName: "Ada" }
  }
]

let lookups = 0

const lookupProfileCache = (
  userId: string
): Effect.Effect<Availability<UserProfile>, CacheLookupError> =>
  Effect.gen(function*() {
    const index = yield* Effect.sync(() => {
      const current = lookups
      lookups += 1
      return current
    })
    const observation = observations[index] ?? observations[observations.length - 1]!

    yield* Console.log(`${userId} cache lookup ${index + 1}: ${observation._tag}`)
    return observation
  })

const pollUntilAvailable = Schedule.identity<Availability<UserProfile>>().pipe(
  Schedule.bothLeft(Schedule.spaced("100 millis")),
  Schedule.while(({ output }) => output._tag === "Missing")
)

const waitForProfile = (
  userId: string
): Effect.Effect<
  UserProfile,
  CacheLookupError | { readonly _tag: "ProfileUnavailable" }
> =>
  lookupProfileCache(userId).pipe(
    Effect.repeat(pollUntilAvailable),
    Effect.flatMap((availability) =>
      availability._tag === "Available"
        ? Effect.succeed(availability.value)
        : Effect.fail({ _tag: "ProfileUnavailable" as const })
    )
  )

const program = waitForProfile("user-1").pipe(
  Effect.flatMap((profile) => Console.log(`profile ready: ${profile.displayName}`))
)

Effect.runPromise(program)
```

The first cache lookup runs immediately. If it returns `Missing`, the schedule
waits before the next lookup. The runnable example uses a short delay; a
production path can use a longer cadence. If the lookup returns `Available`, the
schedule stops and `Effect.repeat` returns that final `Available` value.

The `Missing` branch after `Effect.repeat` is unreachable for this unbounded
schedule because the schedule stops only when the latest successful observation
is no longer missing. It becomes reachable when you add a limit.

## Variants

Add a recurrence cap when the caller should stop waiting after a bounded number
of misses. With the cap, `Effect.repeat` can return `Missing` because the
recurrence limit may stop the schedule before the cache entry appears. Interpret
that result explicitly instead of assuming the data was found.

Add `Schedule.jittered` when many callers may wait for the same key. It changes
the timing of each recurrence, not the stop condition.

## Notes and caveats

Use `Effect.repeat` here because the decision is based on successful lookup
results. `Effect.retry` feeds failures into the schedule, which is the wrong
shape when "missing" is ordinary data.

The schedule does not delay the first lookup. It controls only recurrences after
the first successful lookup.

Keep the lookup effect responsible for classification. Translate only expected
absence into `Missing`; leave real lookup failures in the error channel.
