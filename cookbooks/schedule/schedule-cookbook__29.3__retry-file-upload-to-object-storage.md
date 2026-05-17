---
book: "Effect `Schedule` Cookbook"
section_number: "29.3"
section_title: "Retry file upload to object storage"
part_title: "Part VII — Real-World Recipes"
chapter_title: "29. Data and Batch Recipes"
status: "draft"
code_included: true
---

# 29.3 Retry file upload to object storage

Object storage uploads are retryable only when duplicate attempts are harmless.
The upload protocol supplies the stable identity; the schedule supplies bounded
retry pressure.

## Problem

A batch worker is writing a deterministic export object to storage. The network
can drop, the service can throttle, and the worker can lose the response after
the server has already accepted bytes.

Blind retrying is risky. A second attempt might create a duplicate object, leave
an incomplete multipart upload behind, or put avoidable pressure on a shared
storage account. The retry policy must be bounded, and the upload operation must
be written so a repeated attempt has a well-defined outcome.

## When to use it

Use this recipe when the upload target is idempotent by design: the object key
is deterministic, the content checksum is stable, conditional writes are used,
or the storage API supports an idempotency token or resumable upload id.

It is a good fit for batch exports, reports, media processing outputs, data lake
ingestion, and checkpoint files where transient failures should recover without
requiring an operator to restart the whole job.

## When not to use it

Do not apply this schedule to an upload that generates a new object key on every
attempt. That turns a transient failure into possible duplicate data.

Do not retry validation failures, forbidden writes, missing buckets, unsupported
storage classes, checksum mismatches, or request bodies that cannot be replayed.
Those are not timing problems.

Do not rely on retry alone for multipart uploads. Multipart protocols also need
cleanup or resume rules for abandoned parts, and retries must not complete two
different upload sessions for the same logical file.

## Schedule shape

`Schedule.exponential("250 millis")` spaces repeated failures with a growing
delay. This reduces pressure on object storage when the service is already slow
or throttling.

`Schedule.jittered` randomizes the selected delay so many workers do not retry
the same storage bucket at the same instant.

`Schedule.recurs(5)` caps the number of retries after the original attempt. The
first upload still runs immediately; the schedule only controls follow-up
attempts after typed failures.

`Schedule.during("30 seconds")` caps the elapsed retry window. Combining the
count limit and elapsed budget with `Schedule.both` means both limits must
allow another retry.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class UploadError extends Data.TaggedError("UploadError")<{
  readonly reason:
    | "Timeout"
    | "Throttled"
    | "Unavailable"
    | "ChecksumMismatch"
    | "Forbidden"
    | "BadRequest"
}> {}

interface UploadRequest {
  readonly bucket: string
  readonly key: string
  readonly body: Uint8Array
  readonly checksumSha256: string
  readonly idempotencyKey: string
}

let attempts = 0

const uploadObject: (request: UploadRequest) => Effect.Effect<void, UploadError> =
  Effect.fnUntraced(function*(request: UploadRequest) {
    attempts += 1
    yield* Console.log(`upload attempt ${attempts}: ${request.bucket}/${request.key}`)

    if (attempts === 1) {
      return yield* Effect.fail(new UploadError({ reason: "Throttled" }))
    }
    if (attempts === 2) {
      return yield* Effect.fail(new UploadError({ reason: "Timeout" }))
    }

    yield* Console.log(`stored checksum ${request.checksumSha256}`)
  })

const isTransientStorageError = (error: UploadError) =>
  error.reason === "Timeout" ||
  error.reason === "Throttled" ||
  error.reason === "Unavailable"

const uploadRetryPolicy = Schedule.exponential("10 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5)),
  Schedule.both(Schedule.during("200 millis"))
)

const uploadReport = (body: Uint8Array, checksumSha256: string) =>
  uploadObject({
    bucket: "reports",
    key: `daily/${checksumSha256}.json`,
    body,
    checksumSha256,
    idempotencyKey: checksumSha256
  }).pipe(
    Effect.retry({
      schedule: uploadRetryPolicy,
      while: isTransientStorageError
    })
  )

const program = uploadReport(
  new TextEncoder().encode("{\"rows\":3}"),
  "sha256-demo"
).pipe(
  Effect.flatMap(() => Console.log("upload complete")),
  Effect.catch((error: UploadError) => Console.log(`upload failed: ${error.reason}`))
)

void Effect.runPromise(program)
```

The object key and idempotency key are derived from the content checksum. If the
worker retries after losing a response, it is still asking storage to create the
same logical object, not a new one. In a real client, pair this with the storage
provider's conditional write, checksum, or idempotency feature so a duplicate
attempt is recognized as the same upload.

If the service returns `Timeout`, `Throttled`, or `Unavailable`, the failure is
fed to the schedule. If it returns `ChecksumMismatch`, `Forbidden`, or
`BadRequest`, retrying stops immediately and the typed failure is returned.

## Variants

For small user-facing uploads, shorten both limits. For large batch uploads,
prefer a slower policy over a larger retry count.

For multipart uploads, retry the smallest safe unit. Retrying an individual part
with a stable upload id, part number, and part checksum is usually safer than
restarting the whole object. Retrying completion is only safe when the complete
request is deterministic and the provider treats duplicate completion as
idempotent or already completed.

## Notes and caveats

`Effect.retry` feeds typed failures into the schedule. The `while` predicate
classifies storage errors before the schedule spends another retry.

`Schedule.during` bounds the retry window at recurrence decision points. It does
not cancel an upload attempt that is already in flight. If each attempt needs an
individual deadline, apply a timeout to `uploadObject` separately.

Retry policy cannot replace storage-level correctness. Use deterministic object
names, checksums, conditional writes, idempotency keys, resumable upload ids, and
multipart cleanup rules so retrying a failed attempt is operationally safe.
