# Agent Instructions

This is the Effect library repository, focusing on functional programming patterns and effect systems in TypeScript.

## Development Workflow

- The git base branch is `main`
- Use `pnpm` as the package manager

### Core Principles

- **Zero Tolerance for Errors**: All automated checks must pass
- **Clarity over Cleverness**: Choose clear, maintainable solutions
- **Conciseness**: Keep code and any wording concise and to the point. Sacrifice grammar for the sake of concision.
- **Reduce comments**: Avoid comments unless absolutely required to explain unusual or complex logic

### Mandatory Validation Steps

- Run `pnpm lint-fix` after editing files
- Always run tests after making changes: `pnpm test <test_file.ts>`
- Run type checking: `pnpm check`
  - If type checking continues to fail, run `pnpm clean` to clear caches, then re-run `pnpm check`
- Build the project: `pnpm build`
- Check JSDoc examples compile: `pnpm docgen`

## Code Style Guidelines

### Effect Library Conventions

- Follow existing TypeScript patterns in the codebase
- Use functional programming principles
- Maintain consistency with Effect library conventions
- Use proper Effect constructors (e.g., `Array.make()`, `Chunk.fromIterable()`)
- Prefer `Effect.gen` for monadic composition
- Use `Data.TaggedError` for custom error types

### Code Organization

- Follow existing file structure and naming conventions
- Delete old code when replacing functionality
- Choose clarity over cleverness in all implementations

### Barrel files

The `index.ts` files are automatically generated. Do not manually edit them. Use
`pnpm codegen` to regenerate barrel files after adding or removing modules.

## Testing

- Test files are located in `packages/*/test/` directories for each package
- Main Effect library tests: `packages/effect/test/`
- Use existing test patterns and utilities
- Always verify implementations with tests
- Run specific tests with: `pnpm test <filename>`

## References

- If you ever need to research the previous version of the Effect library, the
  source code is available in `.agents/effect-old/`

### Time-Dependent Testing

When testing time-dependent code (delays, timeouts, scheduling), always use `TestClock` to avoid flaky tests

- Import `TestClock` from `effect/TestClock`
- Pattern: Use `TestClock.adjust("duration")` to simulate time passage instead of actual delays
- Never rely on real wall-clock time (`Effect.sleep`, `Effect.timeout`) in tests without TestClock
- Examples of time-dependent operations that need TestClock:
  - `Effect.sleep()` and `Effect.delay()`
  - `Effect.timeout()` and `Effect.race()` with timeouts
  - Scheduled operations and retry logic
  - Any concurrent operations that depend on timing

### Testing Framework Selection

#### When to Use @effect/vitest

- **Import pattern**: `import { assert, describe, it } from "@effect/vitest"`
- **Test pattern**: `it.effect("description", () => Effect.gen(function*() { ... }))`
- Use regular `it("description", () => { ... })` for pure TypeScript functions
  that do not involve Effects

### it.effect Testing Pattern

- Use `it.effect` for all Effect-based tests, not `Effect.runSync` with regular `it`
- Import `{ assert, describe, it }` from `@effect/vitest`
- Never use `expect` from vitest in Effect tests - use `assert` methods instead
- All tests should use `it.effect("description", () => Effect.gen(function*() { ... }))`

Before writing tests, look at existing tests in the codebase for similar
functionality to follow established patterns.
