---
root: false
targets: ["*"]
description: "Testing guidelines for Effect-based tests using @effect/vitest and TestClock"
globs: ["**/test/**/*.ts", "**/*.test.ts", "**/*.spec.ts"]
---

# Testing

- Test files are located in `packages/*/test/` directories for each package
- Main Effect library tests: `packages/effect/test/`
- Use existing test patterns and utilities
- Always verify implementations with tests
- Run specific tests with: `pnpm test <filename>`

## Time-Dependent Testing

When testing time-dependent code (delays, timeouts, scheduling), always use `TestClock` to avoid flaky tests

- Import `TestClock` from `effect/TestClock`
- Pattern: Use `TestClock.adjust("duration")` to simulate time passage instead of actual delays
- Never rely on real wall-clock time (`Effect.sleep`, `Effect.timeout`) in tests without TestClock
- Examples of time-dependent operations that need TestClock:
  - `Effect.sleep()` and `Effect.delay()`
  - `Effect.timeout()` and `Effect.race()` with timeouts
  - Scheduled operations and retry logic
  - Any concurrent operations that depend on timing

## Testing Framework Selection

### When to Use @effect/vitest

- **Import pattern**: `import { assert, describe, it } from "@effect/vitest"`
- **Test pattern**: `it.effect("description", () => Effect.gen(function*() { ... }))`
- Use regular `it("description", () => { ... })` for pure TypeScript functions
  that do not involve Effects

## it.effect Testing Pattern

- Use `it.effect` for all Effect-based tests, not `Effect.runSync` with regular `it`
- Import `{ assert, describe, it }` from `@effect/vitest`
- Never use `expect` from vitest in Effect tests - use `assert` methods instead
- All tests should use `it.effect("description", () => Effect.gen(function*() { ... }))`

Before writing tests, look at existing tests in the codebase for similar
functionality to follow established patterns.
