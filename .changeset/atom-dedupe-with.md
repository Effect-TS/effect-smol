---
"effect": patch
---

Add `Atom.dedupe` and `Atom.dedupeWith` to opt into value-equality emission for atoms.

The pair mirrors `Array.dedupe` / `Array.dedupeWith`:

- `Atom.dedupe(self)` returns a copy of the atom whose emission guard uses the default `Equal.equals` (value equality).
- `Atom.dedupeWith(self, equivalence)` (also pipeable as `Atom.dedupeWith(equivalence)`) returns a copy whose emission guard uses the supplied `Equivalence`.

Writing or recomputing a value that is equivalent to the current one then suppresses the notification and skips invalidating downstream atoms. Applying either to a derived atom (for example one from `Atom.map`/`Atom.transform`) dedupes that atom's own computed output, so downstream atoms stay silent when the inputs change but the output is equivalent.

The default behavior is unchanged; existing atoms keep `Object.is` semantics until `dedupe`/`dedupeWith` is applied. `Equal.equals` short-circuits on reference identity before any structural work, so the dedup cost is only paid when references actually differ.
