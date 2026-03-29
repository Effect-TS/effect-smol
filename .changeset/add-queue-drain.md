---
"effect": minor
---

Add `Queue.drain` for non-blocking take of all available messages.

Unlike `Queue.takeAll` which blocks until at least one item is available,
`Queue.drain` returns whatever is currently in the queue, including an
empty array if no messages are present. Returns `[]` on graceful
completion (`Done`) and propagates non-Done errors.
