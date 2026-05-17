---
book: "Effect `Schedule` Cookbook"
section_number: "13.2"
section_title: "Poll until a cache entry appears"
part_title: "Part IV — Polling Recipes"
chapter_title: "13. Poll for Resource State"
status: "draft"
code_included: true
---

# 13.2 Poll until a cache entry appears

A cache miss can be an ordinary successful observation. When another process is
expected to populate the value soon, repeat on misses and stop on the first
present entry.

## Problem

A background warm-up fiber, write-through path, or external producer may fill a
cache after the caller starts looking. The polling loop should wait between
cache reads, stop at the first present entry, and keep cache backend failures
separate from normal misses.

## When to use it

Use this when a missing cache entry is expected to be temporary and the caller
wants a short wait for population.

This fits asynchronous warm-up, write-through propagation to an in-process
cache, or a shared cache that another worker fills after a known trigger.

## When not to use it

Do not use this as a general resource-creation workflow. The recipe assumes a
cache population path is already in motion.

Do not treat cache backend failures as misses. Network errors, serialization
errors, permission errors, and unavailable cache servers should remain failures
unless the domain deliberately models them as successful misses.

Do not poll indefinitely for keys that may never be written.

## Schedule shape

Use `Schedule.spaced` for a small delay between cache reads,
`Schedule.passthrough` to keep the latest lookup, and `Schedule.while` to repeat
only while the lookup is `Missing`.

For bounded waits, handle a final `Missing` value explicitly.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

interface CacheEntry {
  readonly key: string
  readonly value: string
  readonly version: number
}

type CacheLookup =
  | { readonly _tag: "Missing" }
  | { readonly _tag: "Present"; readonly entry: CacheEntry }

type WaitForCacheEntryError = {
  readonly _tag: "CacheEntryUnavailable"
  readonly key: string
}

const scriptedLookups: ReadonlyArray<CacheLookup> = [
  { _tag: "Missing" },
  { _tag: "Missing" },
  { _tag: "Present", entry: { key: "user:1", value: "Ada", version: 3 } }
]

let readIndex = 0

const lookupCacheEntry = (key: string): Effect.Effect<CacheLookup> =>
  Effect.sync(() => {
    const lookup = scriptedLookups[
      Math.min(readIndex, scriptedLookups.length - 1)
    ]!
    readIndex += 1
    return lookup
  }).pipe(
    Effect.tap((lookup) => Console.log(`[${key}] ${lookup._tag}`))
  )

const pollUntilPresent = Schedule.spaced("10 millis").pipe(
  Schedule.satisfiesInputType<CacheLookup>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Missing"),
  Schedule.take(10)
)

const requirePresent = (
  key: string,
  lookup: CacheLookup
): Effect.Effect<CacheEntry, WaitForCacheEntryError> =>
  lookup._tag === "Present"
    ? Effect.succeed(lookup.entry)
    : Effect.fail({ _tag: "CacheEntryUnavailable", key })

const program = lookupCacheEntry("user:1").pipe(
  Effect.repeat(pollUntilPresent),
  Effect.flatMap((lookup) => requirePresent("user:1", lookup)),
  Effect.tap((entry) =>
    Console.log(`cache value: ${entry.value} v${entry.version}`)
  )
)

Effect.runPromise(program).then((entry) => {
  console.log("result:", entry)
})
```

The first cache lookup runs immediately. Misses wait before the next read. The
first present entry stops the repeat and becomes the result.

## Variants

Add `Schedule.jittered` when many callers may wait for the same key and aligned
reads would create avoidable cache traffic.

Use a small recurrence cap for user-facing waits. A cache should not become a
hidden unbounded dependency in the request path.

If a cache API represents a miss as an error, recover only that miss into
`Missing` before repeating. Keep backend failures as failures.

## Notes and caveats

`Schedule.while` sees successful lookup results only.

`Effect.repeat` repeats after success. A failed cache read stops the repeat
unless handled before repeating.

A miss should be temporary for this recipe. If no population path is active,
return a separate domain result or fail instead of polling as if the entry will
appear.
