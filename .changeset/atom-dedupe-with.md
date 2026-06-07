---
"effect": patch
---

Add `Atom.dedupe` and `Atom.dedupeWith` to opt into value-equality emission for atoms.

By default an `Atom` only suppresses an emission when the new value is reference-identical (`Object.is`) to the current one. The standalone v3 `@effect-atom/atom` package deduped on `Equal.equals` (value equality) instead, and the sibling `AtomRef` in this package still does; the `Object.is` guard in `AtomRegistry`'s node `setValue` appears to be a regression from that v3 behavior.

The pair mirrors `Array.dedupe` / `Array.dedupeWith`:

- `Atom.dedupe(self)` returns a copy of the atom whose emission guard uses the default `Equal.equals` (value equality).
- `Atom.dedupeWith(self, equivalence)` (also pipeable as `Atom.dedupeWith(equivalence)`) returns a copy whose emission guard uses the supplied `Equivalence`.

Writing or recomputing a value that is equivalent to the current one then suppresses the notification and skips invalidating downstream atoms. Applying either to a derived atom (for example one from `Atom.map`/`Atom.transform`) dedupes that atom's own computed output, so downstream atoms stay silent when the inputs change but the output is equivalent.

The default behavior is unchanged; existing atoms keep `Object.is` semantics until `dedupe`/`dedupeWith` is applied. `Equal.equals` short-circuits on reference identity before any structural work, so the dedup cost is only paid when references actually differ.
