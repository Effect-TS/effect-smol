---
book: Effect `Schedule` Cookbook
section_number: "16.4"
section_title: "Poll a video transcode until complete"
part_title: "Part IV — Polling Recipes"
chapter_title: "16. Poll Until Completion"
status: "draft"
code_included: true
---

# 16.4 Poll a video transcode until complete

You submitted a video transcode job and received a transcode id. The transcoding service
exposes a status endpoint that reports ordinary domain states such as `"queued"`,
`"probing"`, `"transcoding"`, `"complete"`, `"failed"`, or `"canceled"`. This recipe
treats polling as repeated successful observations. The schedule controls cadence and
the condition for taking another observation, while the surrounding Effect code
interprets terminal states, missing data, stale reads, and real failures. Keeping those
responsibilities separate makes the polling loop easier to bound and diagnose.

## Problem

You submitted a video transcode job and received a transcode id. The transcoding
service exposes a status endpoint that reports ordinary domain states such as
`"queued"`, `"probing"`, `"transcoding"`, `"complete"`, `"failed"`, or
`"canceled"`.

You want to poll successful status observations until the transcode reaches a
terminal state. A transcode status of `"failed"` is a successful observation of
the video domain. It is not the same thing as the status request failing because
the service could not be reached or the response could not be decoded.

## When to use it

Use this when the polling operation is read-only and each successful request
returns the current state of a previously submitted transcode.

This is a good fit for media workflows where the caller needs the final
manifest, output asset id, or failure reason, and where in-progress states mean
"wait and observe again".

## When not to use it

Do not use this to retry failed status requests. With `Effect.repeat`, a failure
from the status-check effect stops the repeat immediately. Add retry behavior
around the status check when transient transport or decoding failures should be
retried.

Do not use this for the transcode submission itself. Submitting work is a
separate operation with its own idempotency and duplicate-job concerns.

Do not turn every terminal transcode state into an effect failure during the
polling loop. First observe the terminal status, then decide how the caller wants
to interpret `"complete"`, `"failed"`, or `"canceled"`.

## Schedule shape

Use a spacing schedule for the pause between observations, constrain its input
to the transcode status type, pass the observed status through as the schedule
output, and continue only while the latest successful observation is not
terminal:

```ts
Schedule.spaced("5 seconds").pipe(
  Schedule.satisfiesInputType<TranscodeStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input))
)
```

`Effect.repeat` runs the first status request immediately. The schedule controls
only later recurrences. After each successful request, that `TranscodeStatus`
becomes `metadata.input` for `Schedule.while`.

`Schedule.satisfiesInputType<TranscodeStatus>()` appears before the predicate
reads `metadata.input`, because `Schedule.spaced` is a timing schedule. It does
not get its input type from the transcode domain unless you provide that type
constraint.

## Code

```ts
import { Effect, Schedule } from "effect"

type TranscodeStatus =
  | { readonly state: "queued"; readonly id: string }
  | { readonly state: "probing"; readonly id: string }
  | { readonly state: "transcoding"; readonly id: string; readonly percent: number }
  | { readonly state: "complete"; readonly id: string; readonly assetId: string; readonly manifestUrl: string }
  | { readonly state: "failed"; readonly id: string; readonly reason: string }
  | { readonly state: "canceled"; readonly id: string }

type TranscodeStatusError = {
  readonly _tag: "TranscodeStatusError"
  readonly message: string
}

const isTerminal = (status: TranscodeStatus): boolean =>
  status.state === "complete" ||
  status.state === "failed" ||
  status.state === "canceled"

declare const getTranscodeStatus: (
  id: string
) => Effect.Effect<TranscodeStatus, TranscodeStatusError>

const pollUntilComplete = Schedule.spaced("5 seconds").pipe(
  Schedule.satisfiesInputType<TranscodeStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input))
)

const pollTranscode = (id: string) =>
  getTranscodeStatus(id).pipe(
    Effect.repeat(pollUntilComplete)
  )
```

`pollTranscode` succeeds with the terminal `TranscodeStatus` that stopped the
schedule. That value may be `"complete"`, `"failed"`, or `"canceled"`.

The resulting effect fails with `TranscodeStatusError` only when
`getTranscodeStatus` fails. A successful response whose state is `"failed"` is
still a successful response from the status endpoint.

## Variants

If the caller wants a completed asset instead of the final status, keep polling
separate from interpretation and inspect the terminal value afterward:

```ts
const pollForCompletedAsset = (id: string) =>
  pollTranscode(id).pipe(
    Effect.flatMap((status) => {
      switch (status.state) {
        case "complete":
          return Effect.succeed({
            assetId: status.assetId,
            manifestUrl: status.manifestUrl
          })
        case "failed":
          return Effect.fail(status)
        case "canceled":
          return Effect.fail(status)
        default:
          return Effect.die(new Error("pollTranscode returned a non-terminal status"))
      }
    })
  )
```

This variant still treats polling as successful observation. The later
`Effect.flatMap` chooses to fail the caller when the final domain status is not a
completed asset.

For production systems, choose a polling interval that reflects expected
transcode duration, queue depth, and API limits. A short interval may be useful
for small preview encodes, while larger transcodes often need slower polling.

## Notes and caveats

`Schedule.while` sees successful outputs from `getTranscodeStatus`. It does not
handle effect failures from the status request.

The first status request is not delayed. `Schedule.spaced("5 seconds")` controls
the pause before each additional observation.

Use `Schedule.passthrough` when the timing schedule's own output is not useful
and the caller needs the last observed transcode status.

Keep terminal domain states distinct from effect failures. `"failed"` and
`"canceled"` usually describe the transcode job, while `TranscodeStatusError`
describes the attempt to read the job status.

Timeouts, deadlines, and fallback behavior are separate concerns from this
basic poll-until-terminal shape.
