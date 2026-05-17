---
book: "Effect `Schedule` Cookbook"
section_number: "31.1"
section_title: "Log each retry attempt"
part_title: "Part VIII — Observability and Testing"
chapter_title: "31. Observability, Logging, and Diagnostics"
status: "draft"
code_included: true
---

# 31.1 Log each retry attempt

Retry logs should answer what failed, which policy handled it, and whether
another attempt was scheduled. Logging belongs at the boundary that owns the
retry policy.

## Problem

You have a retried dependency call and want one clear log event for retry
behavior without duplicating final error reporting.

## When to use it

Use this around HTTP requests, database calls, queue publishing, cache fills,
and startup probes where retry behavior matters during incident review.

## When not to use it

Do not log large payloads, credentials, or full causes on every retry. Do not
use logging as a substitute for filtering permanent failures before retrying.

## Schedule shape

Use `Schedule.tapInput` to observe the failure fed to `Effect.retry`. Use
`Schedule.tapOutput` to log only accepted retry steps.

## Example

```ts
import { Console, Duration, Effect, Schedule } from "effect"

type RequestError =
  | { readonly _tag: "RequestTimeout"; readonly endpoint: string }
  | { readonly _tag: "ServiceUnavailable"; readonly endpoint: string }

let attempts = 0

const fetchInventory = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`inventory attempt ${attempts}`)

  if (attempts < 3) {
    return yield* Effect.fail({
      _tag: "RequestTimeout",
      endpoint: "/inventory"
    } as const)
  }

  return ["sku-1", "sku-2"]
})

const retryInventoryPolicy = Schedule.exponential("10 millis").pipe(
  Schedule.satisfiesInputType<RequestError>(),
  Schedule.both(Schedule.recurs(5)),
  Schedule.tapInput((error) =>
    Console.log(`retry input: ${error._tag} at ${error.endpoint}`)
  ),
  Schedule.tapOutput(([delay, retry]) =>
    Console.log(
      `retry ${retry + 1} scheduled after ${Duration.format(delay)}`
    )
  )
)

const program = fetchInventory.pipe(
  Effect.retry(retryInventoryPolicy),
  Effect.flatMap((items) => Console.log(`loaded ${items.length} items`))
)

Effect.runPromise(program)
```

The input log records the typed failure. The output log runs only when the
schedule accepts another recurrence.

## Variants

For hot paths, log only `tapOutput` so final non-retried failures are not logged
twice. Keep detailed error reporting at the final failure boundary.

## Notes and caveats

`Schedule.recurs(5)` outputs a zero-based recurrence count, so the log prints
`retry + 1` for a human-facing retry number.
