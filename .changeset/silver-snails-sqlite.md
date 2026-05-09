---
"effect": patch
---

Classify SQLite unique constraint violations as `UniqueViolation` instead of `ConstraintError`. The new classification includes a normalized `constraint` descriptor when available and falls back to `"unknown"`.
