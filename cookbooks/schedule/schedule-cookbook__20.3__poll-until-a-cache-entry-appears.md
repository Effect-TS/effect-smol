---
book: Effect `Schedule` Cookbook
section_number: "20.3"
section_title: "Poll until a cache entry appears"
part_title: "Part IV — Polling Recipes"
chapter_title: "20. Poll Until a Desired Output Appears"
status: "draft"
code_included: true
---

# 20.3 Poll until a cache entry appears

Cache polling is a narrower form of output-driven polling: the lookup succeeds
even when the entry is not present yet. That missing result is ordinary data,
not a failure, and it should be the value that drives the schedule. Use a small
spaced poll to observe asynchronous warm-up, a write-through delay, or another
process populating the cache, then stop as soon as the latest successful lookup
reports a present entry.

## Problem

You need to read a cache entry that may not be populated yet. A background
warm-up fiber, a delayed write-through path, or an external producer is expected
to put the value into the cache shortly.

The cache lookup can successfully observe either:

- the entry is still missing
- the entry is now present and can be returned

The polling loop should wait between cache reads, stop at the first present
entry, and keep lookup failures separate from a normal cache miss.

## When to use it

Use this when a missing cache entry is a normal temporary observation and the
caller wants to wait briefly for the cache to be populated.

This is a good fit for asynchronous cache warm-up, write-through propagation to
an in-process cache, or another worker filling a shared cache after a known
trigger.

## When not to use it

Do not use this as a general resource-creation workflow. The recipe assumes the
entry is expected to appear because some cache population path is already in
motion.

Do not treat cache backend failures as misses. A network error, serialization
problem, permission error, or unavailable cache server should remain an effect
failure unless your domain explicitly models it as a successful missing
observation.

Do not poll indefinitely for entries that may never be written. Add a recurrence
cap or another owner-controlled interruption point when the wait must be
bounded.

## Schedule shape

Poll again only while the latest successful cache lookup is still missing:

```ts
Schedule.spaced("500 millis").pipe(
  Schedule.satisfiesInputType<CacheLookup>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Missing")
)
```

`Schedule.spaced("500 millis")` supplies the delay between later cache reads.
`Schedule.satisfiesInputType<CacheLookup>()` constrains the timing schedule
before `Schedule.while` reads `metadata.input`. `Schedule.passthrough` keeps the
latest successful lookup result as the schedule output, so `Effect.repeat`
returns the final observed `CacheLookup`.

The schedule stops when the lookup is no longer missing. In the unbounded shape,
that means the final observed value is the present cache entry.

## Code

```ts
import { Effect, Schedule } from "effect"

interface CacheEntry {
  readonly key: string
  readonly value: string
  readonly version: number
}

type CacheLookup =
  | { readonly _tag: "Missing" }
  | { readonly _tag: "Present"; readonly entry: CacheEntry }

type CacheLookupError = {
  readonly _tag: "CacheLookupError"
  readonly message: string
}

declare const lookupCacheEntry: (
  key: string
) => Effect.Effect<CacheLookup, CacheLookupError>

const pollUntilPresent = Schedule.spaced("500 millis").pipe(
  Schedule.satisfiesInputType<CacheLookup>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Missing")
)

const waitForCacheEntry = (
  key: string
): Effect.Effect<CacheEntry, CacheLookupError> =>
  lookupCacheEntry(key).pipe(
    Effect.repeat(pollUntilPresent),
    Effect.flatMap((lookup) => {
      switch (lookup._tag) {
        case "Present":
          return Effect.succeed(lookup.entry)
        case "Missing":
          return Effect.never
      }
    })
  )
```

The first cache lookup runs immediately. If it returns `Missing`, the schedule
waits 500 milliseconds before reading the cache again. If it returns `Present`,
the schedule stops without another delay.

The `Missing` branch after `Effect.repeat` is unreachable for the unbounded
schedule because `pollUntilPresent` stops only when the latest lookup is
`Present`. It becomes relevant when you add a limit, because a bounded schedule
can stop with the last missing observation.

## Variants

Add a recurrence cap when the caller should stop waiting after a bounded number
of cache misses:

```ts
type WaitForCacheEntryError =
  | CacheLookupError
  | { readonly _tag: "CacheEntryUnavailable" }

const pollUntilPresentAtMostTenTimes = pollUntilPresent.pipe(
  Schedule.bothLeft(
    Schedule.recurs(10).pipe(
      Schedule.satisfiesInputType<CacheLookup>()
    )
  )
)

const waitForCacheEntryAtMostTenTimes = (
  key: string
): Effect.Effect<CacheEntry, WaitForCacheEntryError> =>
  lookupCacheEntry(key).pipe(
    Effect.repeat(pollUntilPresentAtMostTenTimes),
    Effect.flatMap((lookup) =>
      lookup._tag === "Present"
        ? Effect.succeed(lookup.entry)
        : Effect.fail({ _tag: "CacheEntryUnavailable" })
    )
  )
```

With a cap, the final observed value can still be `Missing` because the
recurrence limit stopped the schedule before the cache entry appeared. Interpret
that result explicitly.

When many callers may wait for the same cache key, add jitter to avoid aligned
cache reads:

```ts
const jitteredPollUntilPresent = pollUntilPresent.pipe(
  Schedule.jittered
)
```

`Schedule.jittered` randomly adjusts each delay to between 80% and 120% of the
original delay.

If the cache API represents a miss as a special error, translate only that
specific miss into `Missing` before repeating. Keep real lookup failures in the
effect error channel.

## Notes and caveats

`Schedule.while` sees successful cache lookup results only. It does not inspect
failures from `lookupCacheEntry`.

`Effect.repeat` repeats after success. A failed cache lookup stops the repeat
unless the lookup effect handles that failure before the repeat.

The first cache read is not delayed by the schedule. Delays apply only before
later recurrences.

A cache miss should be temporary for this recipe. If the key is invalid, the
caller is not authorized, or no cache population path is active, return a
separate domain result or fail instead of polling as if the entry will appear.
