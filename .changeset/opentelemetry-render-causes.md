---
"@effect/opentelemetry": patch
---

render nested error causes in Tracer exception events

The `Tracer` now renders an error's nested `cause` chain into the
`exception.stacktrace` attribute of recorded span exception events, mirroring
the behaviour added to `OtlpTracer` in #2480. `Cause.prettyErrors` keeps the
`cause` on each `Error` but omits it from `.stack`, so previously the cause
chain was dropped from exported spans.
