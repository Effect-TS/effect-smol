# Effect/Stream “Previously Known As” JSDoc

## Requirements

### Functional

- Establish an explicit list of Effect and Stream exports that need “Previously Known As” updates and share it for review.
- Add “Previously Known As” JSDoc sections for Effect and Stream APIs that are renamed relative to Effect 3.x.
- Skip brand-new APIs that do not have a 3.x predecessor name.
- Investigate similar renaming patterns to identify additional mappings (for example, repeatEffect* -> fromEffect*).
- Update only exported APIs in `packages/effect/src/Effect.ts` and `packages/effect/src/Stream.ts`.
- Follow the existing “Previously Known As” section style already used in the codebase.
- Ensure each entry maps to the relevant Effect 3.x name(s) from `.repos/effect-old`.
- Avoid duplicate or contradictory mappings when a “Previously Known As” section already exists.

### Non-functional

- Keep documentation concise and aligned with existing Effect JSDoc conventions.
- Do not modify `index.ts` barrel files directly.
- Use ASCII-only text unless a non-ASCII character is already present in the surrounding docs.

## Design

- Inspect existing “Previously Known As” sections in `packages/effect/src/Effect.ts` (and other modules like `Layer.ts` / `Queue.ts`) to mirror formatting:
  - Section header: `**Previously Known As**`
  - Intro line: `This API replaces the following from Effect 3.x:`
  - Bullet list of prior names in backticks.
- Build a mapping of renamed Effect and Stream exports by comparing current APIs against `.repos/effect-old` (3.x):
  - Compare against `.repos/effect-old/packages/effect/src/Effect.ts` and `.repos/effect-old/packages/effect/src/Stream.ts` as the canonical sources.
  - Focus on renamed exports, not stable carry-overs or brand-new APIs.
  - Capture multiple prior names where relevant.
- Apply the “Previously Known As” blocks directly on the exported declarations in `Effect.ts` and `Stream.ts` only.
- For overloaded exports, add the block once on the primary JSDoc entry.
- Keep existing “Previously Known As” blocks unchanged unless a missing 3.x mapping needs to be added.
- Keep existing JSDoc structure intact; insert the new section in the same relative position as other “Previously Known As” entries (after usage/details and before examples where applicable).

## Review List (Initial)

### Effect

Missing “Previously Known As”:

- `Effect.catchFilter` <- `Effect.catchSome`
- `Effect.catchCauseFilter` <- `Effect.catchSomeCause`
- `Effect.tapCause` <- `Effect.tapErrorCause`
  Missing “Previously Known As” (confirmed):
- `Effect.result` <- `Effect.either`
  Existing entries already present:
- `Effect.andThen` <- `Effect.zipRight`
- `Effect.tap` <- `Effect.zipLeft`
- `Effect.catch` <- `Effect.catchAll`
- `Effect.catchCause` <- `Effect.catchAllCause`
- `Effect.catchDefect` <- `Effect.catchAllDefect`

### Stream

Missing “Previously Known As” (confirmed):

- `Stream.bufferArray` <- `Stream.bufferChunks`
- `Stream.callback` <- `Stream.async`, `Stream.asyncEffect`, `Stream.asyncPush`, `Stream.asyncScoped`
- `Stream.catch` <- `Stream.catchAll`
- `Stream.catchCause` <- `Stream.catchAllCause`
- `Stream.catchFilter` <- `Stream.catchSome`
- `Stream.catchCauseFilter` <- `Stream.catchSomeCause`
- `Stream.combineArray` <- `Stream.combineChunks`
- `Stream.flattenArray` <- `Stream.flattenChunks`
- `Stream.flattenIterable` <- `Stream.flattenIterables`
- `Stream.fromArray` <- `Stream.fromChunk`
- `Stream.fromArrays` <- `Stream.fromChunks`
- `Stream.fromEffectRepeat` <- `Stream.repeatEffect`
- `Stream.fromEffectSchedule` <- `Stream.repeatEffectWithSchedule`
- `Stream.mapArray` <- `Stream.mapChunks`
- `Stream.mapArrayEffect` <- `Stream.mapChunksEffect`
- `Stream.runForEachArray` <- `Stream.runForEachChunk`
- `Stream.tapCause` <- `Stream.tapErrorCause`
- `Stream.zipWithArray` <- `Stream.zipWithChunks`
- `Stream.repeatEffect` -> `Stream.fromEffectRepeat`
- `Stream.repeatEffectWithSchedule` -> `Stream.fromEffectSchedule`

## Acceptance Criteria

- A reviewable list of Effect and Stream exports that need updates is produced and approved.
- Every renamed exported API in `packages/effect/src/Effect.ts` has a “Previously Known As” section using the standard format.
- Every renamed exported API in `packages/effect/src/Stream.ts` has a “Previously Known As” section using the standard format.
- Brand-new exports without a 3.x predecessor name do not add a “Previously Known As” section.
- No internal-only declarations are modified.
- JSDoc examples and formatting remain valid and consistent with existing style.
- Required checks pass after implementation: `pnpm lint-fix`, `pnpm test <target>`, `pnpm check`, `pnpm build`, `pnpm docgen`.
