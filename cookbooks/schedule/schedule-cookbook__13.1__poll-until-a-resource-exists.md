---
book: "Effect `Schedule` Cookbook"
section_number: "13.1"
section_title: "Poll until a resource exists"
part_title: "Part IV — Polling Recipes"
chapter_title: "13. Poll for Resource State"
status: "draft"
code_included: true
---

# 13.1 Poll until a resource exists

Model "not found yet" as a successful observation when absence is expected to
be temporary. The schedule can then repeat on that observation without
confusing it with transport or decoding failure.

## Problem

A lookup for a newly created object, uploaded file, provisioned endpoint, or
generated artifact may succeed and report either "missing" or "found." The loop
should wait between missing observations and stop as soon as the resource is
found.

Keep real lookup failures separate. Authorization errors, malformed responses,
network failures, and invalid identifiers should not be silently turned into
"missing" unless the domain explicitly says so.

## When to use it

Use this when absence is a normal temporary state and the caller wants to wait
until the resource becomes visible.

This fits APIs where a lookup, `HEAD` request, or metadata read can distinguish
"missing for now" from an actual failed request.

## When not to use it

Do not use this for rich status workflows with states such as `"Queued"`,
`"Running"`, `"Failed"`, and `"Completed"`. Poll the status model and handle
each terminal state instead.

Do not leave the poll unbounded when the resource may never appear. Add a cap,
time budget, or owning fiber lifetime.

## Schedule shape

Use `Schedule.spaced` for the delay, `Schedule.passthrough` to return the latest
lookup result, and `Schedule.while` to continue only while the lookup is
`Missing`.

If a bounded schedule stops first, the final observation can still be
`Missing`; interpret that case explicitly.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

interface Resource {
  readonly id: string
  readonly url: string
}

type ResourceLookup =
  | { readonly _tag: "Missing" }
  | { readonly _tag: "Found"; readonly resource: Resource }

type WaitForResourceError = {
  readonly _tag: "ResourceNotFoundInTime"
  readonly resourceId: string
}

const scriptedLookups: ReadonlyArray<ResourceLookup> = [
  { _tag: "Missing" },
  { _tag: "Missing" },
  { _tag: "Found", resource: { id: "file-1", url: "https://example.test/file-1" } }
]

let readIndex = 0

const lookupResource = (resourceId: string): Effect.Effect<ResourceLookup> =>
  Effect.sync(() => {
    const lookup = scriptedLookups[
      Math.min(readIndex, scriptedLookups.length - 1)
    ]!
    readIndex += 1
    return lookup
  }).pipe(
    Effect.tap((lookup) => Console.log(`[${resourceId}] ${lookup._tag}`))
  )

const pollUntilFound = Schedule.spaced("15 millis").pipe(
  Schedule.satisfiesInputType<ResourceLookup>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Missing"),
  Schedule.take(10)
)

const requireFound = (
  resourceId: string,
  lookup: ResourceLookup
): Effect.Effect<Resource, WaitForResourceError> =>
  lookup._tag === "Found"
    ? Effect.succeed(lookup.resource)
    : Effect.fail({ _tag: "ResourceNotFoundInTime", resourceId })

const program = lookupResource("file-1").pipe(
  Effect.repeat(pollUntilFound),
  Effect.flatMap((lookup) => requireFound("file-1", lookup)),
  Effect.tap((resource) => Console.log(`resource url: ${resource.url}`))
)

Effect.runPromise(program).then((resource) => {
  console.log("result:", resource)
})
```

The first lookup runs immediately. Missing observations wait before the next
lookup. A found observation stops the repeat and is returned as the resource.

## Variants

Add `Schedule.jittered` when many callers may wait for the same dependency and
aligned lookups would be noisy.

If the underlying API reports a temporary 404 as an error, translate only that
specific case into `Missing` before `Effect.repeat`. Leave unrelated failures in
the effect error channel or retry them with a separate retry policy.

## Notes and caveats

`Effect.repeat` repeats after success. A failed lookup stops the repeat unless
the lookup effect handles that failure first.

The first lookup is not delayed by the schedule.

Model only genuinely temporary absence as `Missing`. A permanently invalid id
or an unauthorized caller should fail or return a separate domain result.
