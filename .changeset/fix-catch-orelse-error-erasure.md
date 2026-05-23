---
"effect": patch
---

Fixed the `catch*` combinators silently dropping unhandled error types, closes #2142.

Affected: `catchTag`, `catchTags`, `catchIf`, `catchFilter`, `catchReason`, and `catchReasons` on `Effect`, `Stream`, and `Channel`.

Two related soundness bugs are fixed:

- The unhandled-error type was a defaulted-but-inferable type parameter, so an explicit result annotation (or any contextual type) could collapse it to `never`, hiding errors that were never handled. These combinators now use the `unassigned` sentinel (matching `catchReason`) so the omitted-`orElse` path always reports the unhandled errors.
- A re-failing `orElse` (one whose success type is `never`, e.g. `Effect.fail`) caused the sentinel's conditional type to distribute over `never` and erase the still-unhandled error tags. The error channel is now structured so those tags are preserved regardless of the `orElse` return type.
