---
"effect": patch
---

Enforce EventLog server-side session authentication in both encrypted and unencrypted handlers by gating pre-auth requests, verifying Authenticate challenges/signatures, and rejecting post-auth publicKey mismatches.
