## Overview

Improve the JSDoc for `packages/effect/src/Stream.ts` so it is concise, consistent,
and accurate for Effect 4.x. This is a documentation-only pass focused on
summary clarity, category taxonomy, and example correctness.

## Goals

- Standardize `@category` tags with a Stream-specific naming + casing scheme.
- Tighten summaries to be clear and concise while preserving intent.
- Ensure one example per runtime export. Use discretion for type only exports.
- Do not change `@since` tags
- Keep documentation consistent with current Stream idioms.

## Non-goals

- No runtime behavior or API changes.
- No changes outside `packages/effect/src/Stream.ts` (other than this spec link).
- No new features, refactors, or type-level changes.

## Constraints

- Do not edit barrel files (`index.ts`) or run `pnpm codegen`.
- Keep existing section markers (`// =====`) unchanged.
- Not all exports require examples. Some type-only exports may only need a
  summary and tags.
- Focus on the exports that developers will use directly.
- Treat any `export`ed symbol in `Stream.ts` as in scope. Ignore non-exported
  helpers. For re-exports or aliases, update docs at the declaration site in
  `Stream.ts` only.

## Current Issues (Observed)

- Inconsistent `@category` casing and naming (for example, `models` vs `Models`,
  `type-level` vs `Type-Level`, `De-duplication` vs `Deduplication`).
- Some summaries are verbose or redundant for well-known combinators.
- Examples vary in style (for example, `console.log` vs `Console.log`, or using
  `Effect.runPromise` when no output is shown).

## Documentation Approach

### Category taxonomy

- Canonical list (Title Case):
  - Accumulation
  - Aggregation
  - Broadcast
  - Constants
  - Constructors
  - Deduplication
  - Destructors
  - Do Notation
  - Encoding
  - Error Handling
  - Filtering
  - Grouping
  - Guards
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
  - Type-Level
  - Utils
  - Zipping
- Normalize duplicates to the canonical name (for example, `type-level` to
  `Type-Level`, `utils` to `Utils`, `Do notation` to `Do Notation`).
- If a new category is required, add it to this canonical list (Title Case)
  and normalize all usages to match.

### Summary + detail format

- First line: one-sentence summary of the behavior.
- Second paragraph (if needed): key behavioral nuance or common usage pattern.
- Avoid repeating obvious type information already expressed in the signature.

### Examples

- Before writing any examples, first understand the export's behavior and
  intended usage by consulting existing tests, docs, and source code.
- Prefer short, runnable snippets that compile with docgen.
- Include comments that clarify how the exported api is used / works.
- There should only be one example per export.
- Comments are optional and should be minimal when the behavior is obvious.
- Use `Effect.gen` for sequencing, and only use `Effect.runPromise` when needed
  to demonstrate runtime behavior.
- Prefer `Console.log` over `console.log` when demonstrating effectful logging.
  Any log statements should have a comment indicating expected output.
- Add examples only when missing for widely used or non-obvious combinators, or
  when the existing example is outdated or unclear.
- Any output shown in comments should match actual runtime output (use the
  `scratchpad/` for running examples as needed).
- If you are not showing any output comments, **do not** use any Effect.run*
  calls in the example.

### Tags

- Preserve existing `@since` values unless clearly incorrect.
- When missing, align `@since` with the nearest related export in the same
  section or operator family. If a section mixes versions, use the earliest
  version in that group unless the docs or tests indicate otherwise.
- Ensure `@category` is present and normalized.
- Avoid adding `@param` / `@returns` unless the behavior is non-obvious.

## Acceptance Criteria

- All `@category` tags in `Stream.ts` use a consistent naming and casing scheme.
- Each public export has a concise summary and appropriate tags.
- Examples are consistent in style and compile via `pnpm docgen`.
- No API or runtime behavior changes.
- Section markers and barrel files remain untouched.

## Validation

- `pnpm lint-fix`
- `pnpm test packages/effect/test/Stream.test.ts`
- `pnpm check` (if it fails, run `pnpm clean` then re-run `pnpm check`)
- `pnpm build`
- `pnpm docgen`
