---
"effect": patch
---

Finish the unencrypted `EventLogRemote` protocol plumbing by adding explicit
`ErrorUnencrypted` response frames, surfacing unencrypted write / subscription
rejections as `EventLogRemoteError`, and adding focused remote protocol tests
for codec usage, error propagation, and chunked unencrypted message handling.
