---
"effect": patch
---

Improve Schema type-level performance by avoiding eager computation of unused
schema views and by using lighter `Constraint` boundaries for APIs that only
need schema view properties and `ast`.

This reduces unnecessary structural checks against the full schema protocol
while preserving precise public schema types. Expensive `StructWithRest`
compatibility checking is now available as an opt-in type helper, and common
`Struct` projections use cheaper specialized paths for typical field shapes.
The arbitrary-generation annotation constraint is now named
`Annotations.ToArbitrary.GenerationConstraint` to avoid ambiguity with schema
constraints. New lightweight constraint views support codec, decoder, and
encoder boundaries without requiring the full schema protocol, and canonical
codec helpers now return dedicated lazy schema interfaces. `toCodecStringTree`
now preserves the canonical StringTree shape for arrays; single-value array
input coercion is available explicitly through `Schema.toCodecArrayFromSingle`.
Canonical codec, channel, SQL, HTTP body, persistence, and RPC worker helpers
now use lightweight schema constraints where they only read schema views.
