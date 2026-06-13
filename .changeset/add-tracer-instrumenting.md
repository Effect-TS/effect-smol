---
"effect": minor
---

Add `Tracer.instrumenting` to auto-instrument matched services with one span per method, surfacing the business call chain in failures with zero per-method ceremony. It hooks the public `Tracer` `context` seam only — no monkey-patching, no `node:inspector` — so it works on every runtime.
