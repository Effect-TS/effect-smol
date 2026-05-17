---
book: Effect `Schedule` Cookbook
section_number: "20.2"
section_title: "Poll until a resource exists"
part_title: "Part IV — Polling Recipes"
chapter_title: "20. Poll Until a Desired Output Appears"
status: "draft"
code_included: true
---

# 20.2 Poll until a resource exists

Polling for a resource to exist is best modeled as repeated successful
observations. The schedule should be driven by lookup results, leaving the
caller to return the resource once the final observation is found.

## Problem

You have an operation that checks whether a resource exists, such as a newly
created object, uploaded file, provisioned endpoint, or generated artifact. The
operation can successfully observe either:

- the resource is still missing
- the resource now exists and can be returned

The polling loop should wait between checks, stop as soon as the resource is
found, and keep transport or decoding failures separate from "not found yet".

## When to use it

Use this when absence is a normal, temporary observation and the caller wants to
wait until the resource becomes visible.

This is a good fit for APIs where a lookup, `HEAD` request, or metadata read can
distinguish "missing for now" from real failures such as authorization errors,
network errors, malformed responses, or a permanently invalid identifier.

## When not to use it

Do not use this when the operation reports progress through a richer status
model. If the system has states such as `"Queued"`, `"Running"`, `"Failed"`, and
`"Completed"`, use a status-polling recipe and handle every terminal state
explicitly.

Do not treat every lookup failure as "missing". A `404` or equivalent may be a
successful missing observation for this recipe, but authorization, validation,
transport, and decoding failures should remain effect failures unless your
domain says otherwise.

Do not leave the poll unbounded when the resource may never appear. Add a
recurrence cap, time budget, or owning fiber lifetime when the caller needs a
bounded wait.

## Schedule shape

Poll again only while the latest successful lookup says the resource is missing:

```ts
Schedule.spaced("1 second").pipe(
  Schedule.satisfiesInputType<ResourceLookup>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Missing")
)
```

`Schedule.spaced("1 second")` supplies the delay between later lookups.
`Schedule.satisfiesInputType<ResourceLookup>()` constrains the timing schedule
before `Schedule.while` reads `metadata.input`. `Schedule.passthrough` keeps the
latest successful lookup result as the schedule output, so `Effect.repeat`
returns the final observed `ResourceLookup`.

The schedule stops when the lookup is no longer missing. In the unbounded shape,
that means the final observed value is the found resource.

## Code

```ts
import { Effect, Schedule } from "effect"

interface Resource {
  readonly id: string
  readonly url: string
}

type ResourceLookup =
  | { readonly _tag: "Missing" }
  | { readonly _tag: "Found"; readonly resource: Resource }

type ResourceLookupError = {
  readonly _tag: "ResourceLookupError"
  readonly message: string
}

declare const lookupResource: (
  resourceId: string
) => Effect.Effect<ResourceLookup, ResourceLookupError>

const pollUntilFound = Schedule.spaced("1 second").pipe(
  Schedule.satisfiesInputType<ResourceLookup>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Missing")
)

const waitForResource = (
  resourceId: string
): Effect.Effect<Resource, ResourceLookupError> =>
  lookupResource(resourceId).pipe(
    Effect.repeat(pollUntilFound),
    Effect.flatMap((lookup) => {
      switch (lookup._tag) {
        case "Found":
          return Effect.succeed(lookup.resource)
        case "Missing":
          return Effect.never
      }
    })
  )
```

The first lookup runs immediately. If it returns `Missing`, the schedule waits
one second before running the lookup again. If it returns `Found`, the schedule
stops without another delay.

The `Missing` branch after `Effect.repeat` is unreachable for the unbounded
schedule because `pollUntilFound` stops only when the latest lookup is `Found`.
It becomes relevant when you add a limit, because a bounded schedule can stop
with the last missing observation.

## Variants

Add a recurrence cap when the caller needs a bounded wait:

```ts
type WaitForResourceError =
  | ResourceLookupError
  | { readonly _tag: "ResourceNotFoundInTime" }

const pollUntilFoundAtMostTwentyTimes = pollUntilFound.pipe(
  Schedule.bothLeft(
    Schedule.recurs(20).pipe(
      Schedule.satisfiesInputType<ResourceLookup>()
    )
  )
)

const waitForResourceAtMostTwentyTimes = (
  resourceId: string
): Effect.Effect<Resource, WaitForResourceError> =>
  lookupResource(resourceId).pipe(
    Effect.repeat(pollUntilFoundAtMostTwentyTimes),
    Effect.flatMap((lookup) =>
      lookup._tag === "Found"
        ? Effect.succeed(lookup.resource)
        : Effect.fail({ _tag: "ResourceNotFoundInTime" })
    )
  )
```

With a cap, the final observed value can be `Missing` because the recurrence
limit stopped the schedule before the resource appeared. Interpret that case
explicitly instead of pretending the resource exists.

When many callers may poll the same dependency, add jitter to avoid synchronized
lookups:

```ts
const jitteredPollUntilFound = pollUntilFound.pipe(
  Schedule.jittered
)
```

`Schedule.jittered` randomly adjusts each delay to between 80% and 120% of the
original delay.

If the lookup operation represents "not found" as an error, translate only that
specific case into `Missing` before repeating. Use `Effect.retry` separately for
failures that should be retried because the lookup itself could not be
performed.

## Notes and caveats

`Schedule.while` sees successful lookup results only. It does not inspect
failures from `lookupResource`.

`Effect.repeat` repeats after success. A failed lookup stops the repeat unless
you retry or recover that failure before the repeat.

The first lookup is not delayed by the schedule. Delays apply only before later
recurrences.

Model only genuinely temporary absence as `Missing`. A permanently invalid
resource id or a caller that is not allowed to see the resource should fail or
return a separate domain result.
