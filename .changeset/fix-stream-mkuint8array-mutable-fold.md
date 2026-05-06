---
"effect": patch
---

Fix `Stream.mkUint8Array` crash in Bun compiled+minified binaries.

Reverted to the pre-beta.59 immutable `Channel.runFold` pattern where each fold iteration returns a new `Uint8Array` instead of mutating a shared accumulator. The beta.59 refactor introduced in-place mutation (`acc.bytes +=`, `acc.arrays.push`) which throws in Bun `--compile --minify` binaries.
