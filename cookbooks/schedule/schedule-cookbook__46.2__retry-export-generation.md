---
book: Effect `Schedule` Cookbook
section_number: "46.2"
section_title: "Retry export generation"
part_title: "Part X — Real-World Recipes"
chapter_title: "46. Data and Batch Recipes"
status: "draft"
code_included: true
---

# 46.2 Retry export generation

Export retries spend real batch capacity, so the policy should be conservative.
Keep transient-error classification and the retry limit visible next to the
generation call.

## Problem

A report, invoice bundle, or customer data export may fail because the database
is temporarily unavailable, the renderer is saturated, or object storage is
down. Invalid requests and permission failures should surface immediately.

The retry schedule should recover from short outages without regenerating a
large export indefinitely.

## When to use it

Use this recipe when export generation is idempotent or protected by an export
job id, so a repeated attempt resumes or replaces the same logical export rather
than creating duplicate user-visible artifacts. It is also a good fit when the
caller can wait a short time for recovery, but the system must not keep retrying
large batch work indefinitely.

## When not to use it

Do not retry malformed filters, missing authorization, unsupported formats, or
other permanent request problems. Do not use this policy for non-idempotent
exports that create a new billable artifact on every attempt unless the
generation layer has a deduplication key.

## Schedule shape

Use `Effect.retry` because export generation is retried after failures. The
schedule receives each failure as its input, so `Schedule.while` can stop the
retry loop for non-transient errors. Combine that classifier with a bounded
backoff, and add jitter so several export workers do not retry in lockstep.

## Code

```ts
import { Effect, Schedule } from "effect"

type ExportRequest = {
  readonly exportId: string
  readonly accountId: string
  readonly format: "csv" | "parquet"
}

type ExportFile = {
  readonly exportId: string
  readonly location: string
}

type ExportError =
  | { readonly _tag: "DatabaseUnavailable" }
  | { readonly _tag: "RendererBusy" }
  | { readonly _tag: "ObjectStorageUnavailable" }
  | { readonly _tag: "InvalidExportRequest"; readonly reason: string }
  | { readonly _tag: "PermissionDenied" }

declare const generateExport: (
  request: ExportRequest
) => Effect.Effect<ExportFile, ExportError>

const isTransientExportError = (error: ExportError): boolean => {
  switch (error._tag) {
    case "DatabaseUnavailable":
    case "RendererBusy":
    case "ObjectStorageUnavailable":
      return true
    case "InvalidExportRequest":
    case "PermissionDenied":
      return false
  }
}

const retryTransientExportFailures = Schedule.exponential("500 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(4)),
  Schedule.satisfiesInputType<ExportError>(),
  Schedule.while(({ input }) => isTransientExportError(input))
)

export const runExport = (request: ExportRequest) =>
  Effect.retry(
    generateExport(request),
    retryTransientExportFailures
  )
```

## Variants

For an interactive download, reduce the retry count or add
`Schedule.during("10 seconds")` so the caller gets a timely failure. For a
background export queue, use a larger job-level timeout outside the retry policy
and keep this schedule focused on short transient recovery. For a large worker
fleet, keep `Schedule.jittered`; synchronized retries from many failed exports
can become a second incident.

## Notes and caveats

`Schedule.recurs(4)` allows at most four retries after the first generation
attempt. `Schedule.while` inspects the error passed by `Effect.retry`; when the
error is permanent, the schedule stops and the original export error is returned.
Keep the classifier conservative. It is better to surface a permanent export
failure than to repeatedly regenerate a large file that can never succeed.
