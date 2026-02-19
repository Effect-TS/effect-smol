---
"effect": patch
---

Fix infinite recursion in `format()` and `String()` when called on `ServiceMap.Service`. Functions inheriting `toString` from `PipeInspectableProto` now format via `toJSON()` instead of re-entering `format` through `String(v)`.
