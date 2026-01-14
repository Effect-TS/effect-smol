## 2026-01-14

- Task EFF-168: record all pretty errors, status uses first error
- Files: packages/opentelemetry/src/Tracer.ts, packages/opentelemetry/test/Tracer.test.ts
- Notes: direct OtelSpan test via NodeTracerProvider
- Blockers: none
- Task EFF-169: audit Filter usage in Effect/Stream APIs for Predicate/Refinement revert
- Files: packages/effect/src/Effect.ts, packages/effect/src/Stream.ts, PROGRESS.md, .lalph/prd.json
- Notes: Effect exports using Filter (catchFilter, catchCauseFilter, tapCauseFilter, filter, filterOrElse, filterOrFail, onErrorFilter, onExitFilter); Stream exports using Filter (filter, partition, partitionQueue, partitionEffect, catchFilter, catchTag/catchTags, catchCauseFilter, split)
- Blockers: none
- Task EFF-176: refactor Effect.filter to effectful predicate
- Files: packages/effect/src/Effect.ts, packages/effect/src/internal/effect.ts, packages/effect/src/Channel.ts, packages/effect/src/unstable/cli/Prompt.ts, packages/effect/test/Effect.test.ts, PROGRESS.md
- Notes: Effect.filter now uses boolean predicate; Channel.filterArrayEffect collects passes manually; Prompt filter uses boolean
- Blockers: lint-fix fails in .agents/effect-old (pre-existing)
- Task EFF-176: verification pass after lint-fix
- Files: packages/effect/test/Effect.test.ts, PROGRESS.md
- Notes: lint-fix reformatted Effect.filter test; ran test/check/build/docgen
- Blockers: none
