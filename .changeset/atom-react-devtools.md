---
"@effect/atom-devtools": minor
"@effect/atom-devtools-react": minor
---

Add `@effect/atom-devtools` and `@effect/atom-devtools-react` packages.

`@effect/atom-devtools` is a framework-agnostic core providing a
`DevtoolsController` (external store pattern), immutable value manipulation
utilities, and display helpers. Any UI framework can subscribe via
`controller.subscribe()` / `controller.getState()`.

`@effect/atom-devtools-react` is a thin React renderer with a floating
devtools panel, searchable atom list, inline editable JSON tree,
array/object add/remove controls, dependency graph navigation, slide
animations, and automatic production mode tree-shaking.
