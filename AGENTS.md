# Effect Library - Agent Guide

## Build & Test Commands

- `pnpm build` - Build all packages
- `pnpm test` - Run all tests
- `pnpm test <filename>` - Run specific test file
- `pnpm check` - Type check all packages
- `pnpm lint --fix <file.ts>` - Fix linting (MANDATORY after each TS edit)
- `pnpm docgen` - Validate JSDoc examples compile (MUST PASS before commit)

## Critical Rules

- NEVER use `try-catch` in `Effect.gen` - use Effect error handling
- NEVER use `as any`, `as never`, `as unknown` type assertions
- ALWAYS use `return yield*` for errors: `return yield* Effect.fail("msg")`
- MANDATORY: Run `pnpm lint --fix <file.ts>` after EVERY TypeScript file edit

## Code Style

- Imports: `import { Effect } from "effect"`, `import { Schema } from "effect/schema"`
- Effect patterns: Use `Effect.gen` for composition, `Data.TaggedError` for errors
- Testing: Use `@effect/vitest` with `it.effect` for Effect code, regular `vitest` for pure functions
- TypeScript: Prefer explicit types, no `any`, use proper Effect constructors
- Formatting: 2-space indent, 120 char width, double quotes, no semicolons

## File Structure

- Core: `packages/effect/src/` - Main library
- Tests: `packages/effect/test/` - Test files
- Patterns: `.patterns/` - Development guidelines
- Specs: `.specs/` - Feature specifications
