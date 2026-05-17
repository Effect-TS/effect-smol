---
book: Effect `Schedule` Cookbook
section_number: "44.1"
section_title: "Retry config fetch at startup"
part_title: "Part X — Real-World Recipes"
chapter_title: "44. Frontend and Client Recipes"
status: "draft"
code_included: true
---

# 44.1 Retry config fetch at startup

Startup configuration fetches sit on the first-render path, where a tiny outage
should not leave the UI stuck on a loading screen.

## Problem

You want the first config request to happen immediately, retry a few transient
failures with increasing delay, and then stop so the client can show a clear
degraded state.

## When to use it

Use this for read-only startup fetches where a retry can realistically recover:
a timeout, a brief network drop, a `503`, or a short CDN edge failure. The
schedule should be small enough that the maximum wait before fallback is easy to
explain.

## When not to use it

Do not retry configuration errors that are deterministic for this client:
malformed JSON, an unsupported app version, a missing tenant, or an
authorization failure. Those should fail fast and route the user to an upgrade,
sign-in, or support path.

Avoid a long startup retry loop for optional configuration. Render with defaults
and refresh in the background instead.

## Schedule shape

Use exponential spacing combined with a small retry count. `Effect.retry` runs
the fetch once before consulting the schedule; the schedule describes the
follow-up attempts after failures. `Schedule.recurs(3)` means at most three
retries after the initial request.

Add `while` classification so deterministic configuration failures do not spend
the transient-failure budget.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type ClientConfig = {
  readonly apiBaseUrl: string
  readonly featureFlags: ReadonlyArray<string>
}

type ConfigFetchError =
  | { readonly _tag: "NetworkUnavailable" }
  | { readonly _tag: "ServiceUnavailable" }
  | { readonly _tag: "MalformedConfig" }

let attempts = 0

const fetchStartupConfig: Effect.Effect<ClientConfig, ConfigFetchError> = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`fetch config attempt ${attempts}`)

  if (attempts <= 2) {
    return yield* Effect.fail({ _tag: "ServiceUnavailable" })
  }

  return {
    apiBaseUrl: "https://api.example.test",
    featureFlags: ["new-profile"]
  }
})

const isTransientConfigFailure = (error: ConfigFetchError): boolean =>
  error._tag === "NetworkUnavailable" || error._tag === "ServiceUnavailable"

const startupConfigRetryPolicy = Schedule.exponential("10 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

const loadStartupConfig = fetchStartupConfig.pipe(
  Effect.retry({
    schedule: startupConfigRetryPolicy,
    while: isTransientConfigFailure
  }),
  Effect.tap((config) => Console.log(`loaded config for ${config.apiBaseUrl}`))
)

Effect.runPromise(loadStartupConfig).then(console.log, console.error)
```

## Variants

For a very latency-sensitive first paint, reduce the retry count or use a
shorter base delay and fall back to cached defaults. For a config request made
by many clients at once, add jitter after choosing the base cadence so clients
do not retry in lockstep. For mandatory configuration, keep the retry policy
bounded but show a blocking error with a manual retry button after exhaustion.

## Notes and caveats

Bounded startup retries protect the user experience as much as the service. A
schedule that retries forever can make the app look broken, while a schedule
that gives up too quickly can turn a tiny outage into a visible failure.

Keep permanent error classification near `fetchStartupConfig`, keep the retry
policy short, and make the post-retry UI behavior explicit.
