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

The retry schedule should recover from short outages without regenerating large
exports indefinitely.

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
retry options receive each failure in `while`, so the classifier can stop the
retry loop for permanent errors. Combine that classifier with bounded backoff
and jitter so export workers do not retry in lockstep.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

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

let attempts = 0

const generateExport: (request: ExportRequest) => Effect.Effect<ExportFile, ExportError> =
  Effect.fnUntraced(function*(request: ExportRequest) {
    attempts += 1
    yield* Console.log(`export attempt ${attempts}: ${request.exportId}`)

    if (attempts === 1) {
      return yield* Effect.fail({ _tag: "RendererBusy" } satisfies ExportError)
    }
    if (attempts === 2) {
      return yield* Effect.fail({ _tag: "ObjectStorageUnavailable" } satisfies ExportError)
    }

    return {
      exportId: request.exportId,
      location: `s3://exports/${request.accountId}/${request.exportId}.${request.format}`
    }
  })

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

const retryTransientExportFailures = Schedule.exponential("10 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(4))
)

const runExport = (request: ExportRequest) =>
  generateExport(request).pipe(
    Effect.retry({
      schedule: retryTransientExportFailures,
      while: isTransientExportError
    })
  )

const program = runExport({
  exportId: "export-2026-05-17",
  accountId: "acct-123",
  format: "csv"
}).pipe(
  Effect.flatMap((file) => Console.log(`export ready: ${file.location}`)),
  Effect.catch((error: ExportError) => Console.log(`export failed: ${error._tag}`))
)

void Effect.runPromise(program)
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
attempt. The `while` predicate passed to `Effect.retry` inspects each typed
failure; when the error is permanent, retrying stops and the original export
error is returned. Keep the classifier conservative. It is better to surface a
permanent export failure than to repeatedly regenerate a large file that can
never succeed.
