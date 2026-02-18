# effect

## 4.0.0-beta.2

### Patch Changes

- [#1302](https://github.com/Effect-TS/effect-smol/pull/1302) [`a22ce73`](https://github.com/Effect-TS/effect-smol/commit/a22ce73b2bd9305b7ba665694d2255c0e6d5a8d0) Thanks @tim-smart! - allow undefined for VariantSchema.Overridable input

- [#1299](https://github.com/Effect-TS/effect-smol/pull/1299) [`ebdabf7`](https://github.com/Effect-TS/effect-smol/commit/ebdabf79ff4e62c8384aa8cf9a8d2787d536ee78) Thanks @tim-smart! - Port `SqlSchema.findOne` from effect v3 to return `Option` on empty results and add `SqlSchema.single` for the fail-on-empty behavior.

- [#1298](https://github.com/Effect-TS/effect-smol/pull/1298) [`8f663bb`](https://github.com/Effect-TS/effect-smol/commit/8f663bb121021bf12bd264e8ae385187cb7a5dae) Thanks @tim-smart! - Add `Effect.catchNoSuchElement`, a renamed port of v3 `Effect.optionFromOptional` that converts `NoSuchElementError` failures into `Option.none`.

## 4.0.0-beta.1

### Patch Changes

- [#1293](https://github.com/Effect-TS/effect-smol/pull/1293) [`0fecf70`](https://github.com/Effect-TS/effect-smol/commit/0fecf70048057623eed7c584a06671773a2b1743) Thanks @mikearnaldi! - Add `Effect.filter` support for synchronous `Filter.Filter` overloads and correctly handle non-effect `Result` return values at runtime.

- [#1294](https://github.com/Effect-TS/effect-smol/pull/1294) [`709569e`](https://github.com/Effect-TS/effect-smol/commit/709569ed76bead9ebb0670599e4d890a07ca5a43) Thanks @tim-smart! - Fix `Prompt.text` and related text prompts to initialize from `default` values so users can edit the default input directly.

## 4.0.0-beta.0

### Major Changes

- [#1183](https://github.com/Effect-TS/effect-smol/pull/1183) [`be642ab`](https://github.com/Effect-TS/effect-smol/commit/be642ab1b3b4cd49e53c9732d7aba1b367fddd66) Thanks @tim-smart! - v4 beta
