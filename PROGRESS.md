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

## 2026-01-15

### Task EFF-176: shift Channel.filterArrayEffect to effectful predicate; rename filter test variable

- Files: packages/effect/src/Channel.ts, packages/effect/test/Effect.test.ts, PROGRESS.md
- Notes: filterArrayEffect uses Effect.filter predicate; ran pnpm lint-fix/test/check/build/docgen
- Blockers: none

### Task EFF-198: update Channel.filterArray to Predicate/Refinement

- Files: packages/effect/src/Channel.ts, packages/effect/src/Stream.ts, packages/effect/src/unstable/encoding/Ndjson.ts, .lalph/prd.json, PROGRESS.md
- Notes: filterArray uses Array.filter + non-empty guard; Stream.filter keeps Filter.Filter via partitionFilter; Ndjson uses predicate; ran pnpm lint-fix/test/check/build/docgen
- Blockers: none

### Task EFF-181: refactor Stream.filter to Predicate/Refinement

- Files: packages/effect/src/Stream.ts, packages/effect/src/unstable/reactivity/AtomRegistry.ts, packages/effect/test/Stream.test.ts, packages/platform-node/test/HttpApi.test.ts, PROGRESS.md
- Notes: Stream.filter uses Predicate/Refinement via Filter.fromPredicate; updated callers to use guards; ran pnpm lint-fix/test/check/build/docgen
- Blockers: none

### Task EFF-197: update Channel.filter overloads

- Files: packages/effect/src/Channel.ts, packages/effect/src/Stream.ts, .lalph/prd.json, PROGRESS.md
- Notes: Channel.filter uses Predicate/Refinement via Filter.fromPredicate; filterArray uses Arr.filter with non-empty guard; zipLatestAll filters undefined via refinement; tapError uses Effect.as to normalize; ran pnpm lint-fix/test/check/build/docgen
- Blockers: none

### Task EFF-178: refactor Effect.filterOrFail

- Files: packages/effect/src/Effect.ts, packages/effect/src/internal/effect.ts, packages/effect/src/unstable/http/HttpClient.ts, packages/effect/src/unstable/sql/Migrator.ts, PROGRESS.md
- Notes: filterOrFail now accepts predicate/refinement; internal impl checks predicate directly; Migrator uses Effect.isEffect; HttpClient filterOrFail updated; ran pnpm lint-fix/test/check/build/docgen
- Blockers: none

### Task EFF-189: refactor Stream.split

- Files: packages/effect/src/Stream.ts, packages/effect/test/Stream.test.ts, PROGRESS.md
- Notes: split now uses predicate/refinement delimiter; updated split tests/docs; ran pnpm lint-fix/test/check/build/docgen
- Blockers: none

### Task EFF-207: port Effect.catchIf from effect 3

- Files: packages/effect/src/internal/effect.ts, packages/effect/src/Effect.ts, packages/effect/test/Effect.test.ts, PROGRESS.md
- Notes: added catchIf implementation + docs; added error-handling test; ran pnpm lint-fix/test/check/build/docgen
- Blockers: none

### Task EFF-207: update catchIf/catchFilter docs

- Files: packages/effect/src/Effect.ts, PROGRESS.md
- Notes: removed catchSome reference in docs; ran pnpm lint-fix/test/check/build/docgen
- Blockers: none

### Task EFF-177: refactor Effect.filterOrElse

- Files: packages/effect/src/internal/effect.ts, packages/effect/src/Effect.ts, packages/effect/src/unstable/http/HttpClient.ts, PROGRESS.md
- Notes: filterOrElse uses Predicate/Refinement; filterOrFail/filterOrFailCause inline Filter handling; HttpClient filterOrElse accepts predicate/refinement; ran pnpm lint-fix/test/check/build/docgen
- Blockers: none

### Task EFF-177: refactor Effect.filterOrElse follow-ups

- Files: packages/effect/src/internal/effect.ts, packages/effect/src/unstable/http/HttpClient.ts, PROGRESS.md
- Notes: filterOrFailCause uses Predicate/Refinement overloads; removed unused Filter import; ran pnpm lint-fix/test/check/build/docgen
- Blockers: none

### Task EFF-207: adjust catchFilter docs wording

- Files: packages/effect/src/Effect.ts, PROGRESS.md
- Notes: clarify catchFilter docs use Filter module; ran pnpm lint-fix/test/check/build/docgen
- Blockers: none

### Task EFF-207: refresh catchFilter docs example

- Files: packages/effect/src/Effect.ts, PROGRESS.md
- Notes: use Filter module in catchFilter docs/example; ran pnpm lint-fix/test/check/build/docgen
- Blockers: none
