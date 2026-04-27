---
"@effect/platform-node": patch
---

Fix Node HTTP server request body caching so `text`, `json`, and `arrayBuffer` can all be read from the same request body without consuming the stream more than once.
