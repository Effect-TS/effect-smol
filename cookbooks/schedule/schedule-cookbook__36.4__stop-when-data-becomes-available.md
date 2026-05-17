---
book: Effect `Schedule` Cookbook
section_number: "36.4"
section_title: "Stop when data becomes available"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "36. Stop on Output Conditions"
status: "draft"
code_included: true
---

# 36.4 Stop when data becomes available

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

Use a spaced schedule for the polling cadence, pass the successful lookup result
through as the schedule output, and continue only while the latest lookup is
missing:

```ts
const pollUntilAvailable = Schedule.spaced("500 millis").pipe(
  Schedule.satisfiesInputType<Availability<unknown>>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Missing")
)
```

`Schedule.while` receives schedule metadata. In this recipe the important field
is `input`, which is the latest successful value produced by `Effect.repeat`.

`Schedule.passthrough` changes the schedule output to that latest input. That
means the repeated program can inspect the final observed lookup result after
the schedule stops.

## Code

```ts
import { Effect, Schedule } from "effect"

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

declare const lookupProfileCache: (
  userId: string
) => Effect.Effect<Availability<UserProfile>, CacheLookupError>

const pollUntilAvailable = Schedule.spaced("500 millis").pipe(
  Schedule.satisfiesInputType<Availability<UserProfile>>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Missing")
)

const waitForProfile = (
  userId: string
): Effect.Effect<UserProfile, CacheLookupError> =>
  lookupProfileCache(userId).pipe(
    Effect.repeat(pollUntilAvailable),
    Effect.flatMap((availability) => {
      switch (availability._tag) {
        case "Available":
          return Effect.succeed(availability.value)
        case "Missing":
          return Effect.never
      }
    })
  )
```

The first cache lookup runs immediately. If it returns `Missing`, the schedule
waits 500 milliseconds before the next lookup. If it returns `Available`, the
schedule stops and `Effect.repeat` returns that final `Available` value.

The `Missing` branch after `Effect.repeat` is unreachable for this unbounded
schedule because the schedule stops only when the latest successful observation
is no longer missing. It becomes reachable when you add a limit.

## Variants

Add a recurrence cap when the caller should stop waiting after a bounded number
of misses:

```ts
type WaitForProfileError =
  | CacheLookupError
  | { readonly _tag: "ProfileUnavailable" }

const pollUntilAvailableAtMostTenTimes = pollUntilAvailable.pipe(
  Schedule.bothLeft(
    Schedule.recurs(10).pipe(
      Schedule.satisfiesInputType<Availability<UserProfile>>()
    )
  )
)

const waitForProfileAtMostTenTimes = (
  userId: string
): Effect.Effect<UserProfile, WaitForProfileError> =>
  lookupProfileCache(userId).pipe(
    Effect.repeat(pollUntilAvailableAtMostTenTimes),
    Effect.flatMap((availability) =>
      availability._tag === "Available"
        ? Effect.succeed(availability.value)
        : Effect.fail({ _tag: "ProfileUnavailable" })
    )
  )
```

With the cap, `Effect.repeat` can return `Missing`: the recurrence limit may
stop the schedule before the cache entry appears. Interpret that result
explicitly instead of assuming the data was found.

Add jitter when many callers may wait for the same key:

```ts
const jitteredPollUntilAvailable = pollUntilAvailable.pipe(
  Schedule.jittered
)
```

`Schedule.jittered` changes the timing of each recurrence. It does not change
the stop condition.

## Notes and caveats

Use `Effect.repeat` here because the decision is based on successful lookup
results. `Effect.retry` feeds failures into the schedule, which is the wrong
shape when "missing" is ordinary data.

The schedule does not delay the first lookup. It controls only recurrences after
the first successful lookup.

Keep the lookup effect responsible for classification. Translate only expected
absence into `Missing`; leave real lookup failures in the error channel.
