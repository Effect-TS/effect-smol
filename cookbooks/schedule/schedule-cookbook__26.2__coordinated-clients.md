---
book: Effect `Schedule` Cookbook
section_number: "26.2"
section_title: "Coordinated clients"
part_title: "Part VI — Jitter Recipes"
chapter_title: "26. Why Jitter Exists"
status: "draft"
code_included: true
---

# 26.2 Coordinated clients

Use jitter when clients share a start signal and would otherwise make follow-up
calls as one wave.

## Problem

Coordinated clients start from the same signal and keep following the same
cadence. A deploy, cache expiry, feature flag flip, or upstream outage can make
hundreds of clients fail or poll together. If all of them retry after exactly
`100 millis`, then `200 millis`, then `400 millis`, a policy that is polite for
one client becomes noisy for the service receiving all of them.

## When to use it

Use it for browser reconnects, service instances retrying the same dependency,
workers polling jobs created in batches, and scheduled processes released or
restarted together. The more actors share the cadence, the more useful jitter
becomes.

## When not to use it

Do not add jitter when exact timing is the product or protocol requirement. A
metronomic heartbeat, fixed billing boundary, or protocol timeout may need a
predictable `Schedule.fixed` or `Schedule.spaced` cadence.

Do not use jitter to disguise errors that should not be retried. Classify
validation failures, authorization failures, malformed requests, and unsafe
non-idempotent writes before applying the schedule.

## Schedule shape

Choose the deterministic shape first, then jitter it:

1. Start with the cadence: `Schedule.exponential`, `Schedule.spaced`, or another
   base schedule.
2. Apply `Schedule.jittered` so each recurrence delay is spread around that
   cadence.
3. Add limits such as `Schedule.recurs` or `Schedule.during`.

That order keeps the policy readable: exponential retry, jittered, bounded.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type ClientError = {
  readonly _tag: "ClientError"
  readonly client: string
  readonly attempt: number
}

const clientRetry = Schedule.exponential("25 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)

const makeClientCall = (client: string) => {
  let attempts = 0

  const call = Effect.gen(function*() {
    attempts += 1
    yield* Console.log(`${client} call ${attempts}`)

    if (attempts < 3) {
      return yield* Effect.fail<ClientError>({
        _tag: "ClientError",
        client,
        attempt: attempts
      })
    }

    return `${client} done`
  })

  return call.pipe(
    Effect.retry(clientRetry),
    Effect.flatMap(Console.log)
  )
}

const program = Effect.forEach(
  ["browser-a", "browser-b", "browser-c"],
  makeClientCall,
  { concurrency: 3, discard: true }
)

Effect.runPromise(program)
```

Each client has the same retry policy, but each recurrence samples its own
jittered delay. The policy remains easy to review because the base cadence,
jitter, and retry limit are all visible.

## Variants

Use `Schedule.exponential(...).pipe(Schedule.jittered)` for retries after
failures. Use `Schedule.spaced(...).pipe(Schedule.jittered)` for polling. Pair
jitter with `Schedule.recurs` for count limits or `Schedule.during` for
elapsed-time budgets.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. `Effect.repeat` feeds
successful values into the schedule. That distinction matters when adding
predicates: retry policies usually inspect errors, while polling policies
usually inspect returned statuses.

Jitter reduces accidental coordination; it is not fairness or rate limiting. If
the downstream system needs a strict cap, use a rate limiter, queue, or server
side backpressure mechanism.
