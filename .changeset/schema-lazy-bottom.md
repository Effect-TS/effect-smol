---
"effect": patch
---

Add `Schema.BottomLazy` and use it for schema combinators that compute several independent public views.

Previously, combinators such as `Schema.Struct`, `Schema.Union`, `Schema.Tuple`, and `Schema.decodeTo` extended `Schema.Bottom` by passing fully computed `Type`, `Encoded`, service, constructor input, and `Iso` views as type arguments. TypeScript therefore had to instantiate unused views while checking the inherited `Bottom` shape.

`Schema.BottomLazy` keeps the `Bottom` protocol with lightweight `unknown` view arguments and lets concrete schema interfaces redeclare their precise public views. This preserves the public types while allowing TypeScript to compute only the view that generic code reads.

This also makes `Schema.StructWithRest` cheaper by moving its expensive fixed-field/index-signature compatibility proof out of the constructor signature. The proof remains available as the opt-in `Schema.StructWithRest.ValidateRecords<S, Records>` helper.

Common `Struct` view projections also get cheaper paths for required-only, optional-only, mutable-only, and mixed optional/mutable field shapes, avoiding the fully generic optional-key and mutable-key reconstruction path when it is not needed.

On a medium-sized 48-entity domain-model smoke fixture reading `Type` views, total instantiations dropped from `861098` to `742847` (`-13.7%`). After subtracting the import baseline, the marginal domain-model cost dropped from `147842` to `83343` (`-43.6%`). Focused fixtures showed `Schema.StructWithRest` construction dropping from `66081` to `14124` delta instantiations (`-78.6%`), a 200-field required-only `Struct.Type` projection dropping from `6653` to `2441` delta instantiations (`-63.3%`), and a 200-field mixed optional/mutable `Struct.Type` projection dropping from `7404` to `4372` delta instantiations (`-40.9%`).
