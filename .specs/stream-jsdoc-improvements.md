## Overview

Restore and follow a concise, consistent JSDoc spec for `packages/effect/src/Stream.ts`.
The goal is a documentation-only pass that standardizes categories, clarifies
summaries, and aligns examples with current Effect 4.x Stream usage.

## Goals

- Standardize `@category` tags with a consistent naming + casing scheme.
- Tighten summaries to be clear and concise while preserving intent.
- Update or add examples where they are missing, outdated, or unclear.
- Ensure `@since` tags are present and correct for public exports.
- Keep documentation consistent with current Stream idioms.

## Non-goals

- No runtime behavior or API changes.
- No changes outside `packages/effect/src/Stream.ts` (other than this spec link).
- No new features, refactors, or type-level changes.

## Constraints

- Do not edit barrel files (`index.ts`) or run `pnpm codegen`.
- Keep existing section markers (`// =====`) unchanged.
- Not all exports require examples. Some type-only exports may only need a
  summary and tags. Focus on the exports that developers will use directly.

## Current Issues (Observed)

- `@category` casing is inconsistent (lowercase and Title Case mixed).
- Examples vary in style and clarity; some use `console.log` and others use
  `Console.log`.
- `@since` tags are not consistently applied across all public exports (TBD).

## Documentation Approach

### Category taxonomy

- Canonical list (Title Case, use hyphens where present today):
  - Accumulation
  - Aggregation
  - Broadcast
  - Constants
  - Constructors
  - De-duplication
  - Destructors
  - Do Notation
  - Encoding
  - Error Handling
  - Filtering
  - Guards
  - Grouping
  - Mapping
  - Merging
  - Models
  - Pipe
  - Racing
  - Rate Limiting
  - Sequencing
  - Services
  - Tracing
  - Type Lambdas
  - Type-level
  - Utils
  - Zipping
- Normalize any other casing variants to the canonical names.

### Summary + detail format

- First line: one-sentence summary of behavior.
- Second paragraph (if needed): key behavioral nuance or common usage pattern.
- Avoid repeating type information already in the signature.

### Examples

- Prefer short, runnable snippets that compile with docgen.
- Use `Effect.gen` for sequencing and `Console.log` for logging.
- Use `Stream.runCollect` (or another Stream runner) to show results only when
  you include output comments.
- If no output is shown, do not call `Effect.run*` in the example.
- If the output format for `Stream.runCollect` is unclear, mark it as TBD and
  confirm with a scratchpad run before finalizing.

### Tags

- Preserve existing `@since` values unless clearly incorrect.
- When missing, align `@since` with the nearest related export in the same
  section (TBD if unclear).
- Ensure `@category` is present and normalized.
- Avoid adding `@param` / `@returns` unless the behavior is non-obvious.

## Scope

Audit and update JSDoc for all public exports in `packages/effect/src/Stream.ts`.

## Acceptance Criteria

- All `@category` tags in `Stream.ts` use the canonical naming + casing scheme.
- Each public export has a concise summary and appropriate tags.
- Examples are consistent in style and compile via `pnpm docgen`.
- No API or runtime behavior changes.
- Section markers and barrel files remain untouched.

## Validation

- `pnpm lint-fix`
- `pnpm test <existing Stream test file>`
- `pnpm check`
- `pnpm build`
- `pnpm docgen`
