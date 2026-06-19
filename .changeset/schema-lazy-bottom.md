---
"effect": patch
---

Add `Schema.BottomLazy` and use it for schema combinators that compute several independent public views.

Previously, combinators such as `Schema.Struct`, `Schema.Union`, `Schema.Tuple`, and `Schema.decodeTo` extended `Schema.Bottom` by passing fully computed `Type`, `Encoded`, service, constructor input, and `Iso` views as type arguments. TypeScript has to instantiate those type arguments when it checks the inherited `Bottom` shape, so reading a single view like `schema.Type` could also force the unused encoded, service, make, and iso views.

`Schema.BottomLazy` keeps the `Bottom` protocol with lightweight `unknown` view arguments and lets each concrete schema interface redeclare its precise public views. This preserves the same public types while allowing TypeScript to compute only the view that generic code actually reads.

Focused `tsc --extendedDiagnostics` audit, using delta instantiations over a minimal `Schema.String` import baseline:

| Fixture                                             | View          | Before | After | Change |
| --------------------------------------------------- | ------------- | -----: | ----: | -----: |
| 100 required fields `Struct`                        | `schema.Type` |  11334 |  3353 | -70.4% |
| 100 optional fields `Struct`                        | `schema.Type` |  12934 |  3853 | -70.2% |
| 100 mutable fields `Struct`                         | `schema.Type` |  12813 |  3930 | -69.3% |
| Nested struct, depth 2 with 100-field leaf          | `schema.Type` |  13906 |  7207 | -48.2% |
| Nested struct, depth 3 with 50-field leaf           | `schema.Type` |   8483 |  4511 | -46.8% |
| Union of two 100-field structs                      | `schema.Type` |  21882 | 11384 | -48.0% |
| Union of ten 10-field structs                       | `schema.Type` |  12850 |  7351 | -42.8% |
| Nested union of five structs with 20-field children | `schema.Type` |  13213 |  7440 | -43.7% |

Reading every schema surface remains intentionally expensive. For example, a flat union where the fixture asks for `Type`, `Encoded`, `Iso`, make input, and both service views stays roughly flat (`21887` -> `21950`, `+0.3%`), because all views are actually requested.

This also makes `Schema.StructWithRest` cheaper to instantiate by removing the eager fixed-field/index-signature compatibility check from the constructor signature. The check is still available as the opt-in `Schema.StructWithRest.ValidateRecords<S, Records>` type, which returns `true` for compatible records or a diagnostic object with the incompatible keys.

This keeps normal schema construction on the cheap path and moves the expensive compatibility proof to the call sites that explicitly ask for it. On a focused fixture with 200 fixed fields and 3 rest records, constructing `Schema.StructWithRest` drops from `66081` to `14124` delta instantiations (`-78.6%`). Explicitly requesting `Schema.StructWithRest.ValidateRecords` remains expensive (`66302` delta instantiations), as expected for the opt-in diagnostic path.
