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

Startup configuration is often needed before a client can render the correct feature flags, API endpoints, or regional settings. A short retry policy is useful when the config service is momentarily unavailable, but the startup path still has to return control to the UI quickly.

## Problem

You want the first config request to happen immediately, retry a few transient failures with increasing delay, and then stop so the client can show a clear degraded state instead of hanging on a loading screen.

## When to use it

Use this for read-only startup fetches where a retry can realistically recover: a timeout, a brief network drop, a `503`, or a short CDN edge failure. The schedule should be small enough that product and support teams can understand the maximum wait before the app falls back.

## When not to use it

Do not retry configuration errors that are deterministic for this client, such as malformed JSON, an unsupported app version, a missing tenant, or an authorization failure. Those should fail fast and route the user to an upgrade, sign-in, or support path. Also avoid a long startup retry loop for optional configuration; render with defaults and refresh in the background instead.

## Schedule shape

Use exponential spacing combined with a small retry count. `Effect.retry` runs the fetch once before consulting the schedule; the schedule describes the follow-up attempts after failures. With `Schedule.exponential("100 millis").pipe(Schedule.both(Schedule.recurs(3)))`, the client makes at most three retries after the initial request.

## Code

```ts
import { Effect, Schedule } from "effect"

type ClientConfig = {
  readonly apiBaseUrl: string
  readonly featureFlags: ReadonlyArray<string>
}

type ConfigFetchError =
  | { readonly _tag: "NetworkUnavailable" }
  | { readonly _tag: "ServiceUnavailable" }

declare const fetchStartupConfig: Effect.Effect<ClientConfig, ConfigFetchError>

const startupConfigRetryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

export const loadStartupConfig = fetchStartupConfig.pipe(
  Effect.retry(startupConfigRetryPolicy)
)
```

## Variants

For a very latency-sensitive first paint, reduce the retry count or use a shorter base delay and fall back to cached defaults. For a config request made by many clients at once, add jitter after choosing the base cadence so reconnecting clients do not retry in lockstep. For mandatory configuration, keep the retry policy bounded but show a blocking error with a manual retry button after the schedule is exhausted.

## Notes and caveats

Bounded startup retries protect the user experience as much as the service. A schedule that retries forever can make the app look broken, while a schedule that gives up too quickly can turn a tiny outage into a visible failure. Keep permanent error classification near `fetchStartupConfig`, keep the retry policy short, and make the post-retry behavior explicit in the UI.
