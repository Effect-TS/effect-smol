---
"effect": patch
---

Fix HTTP API security credential decoding to strip the authorization scheme separator and reject tokens supplied with a different scheme.
