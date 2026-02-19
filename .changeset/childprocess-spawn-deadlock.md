---
"@effect/platform-node-shared": patch
---

Fix deadlock when reading large stdout output from `ChildProcess.spawn`. The combined output stream (`.all`) no longer exerts backpressure on individual stdout/stderr streams.
