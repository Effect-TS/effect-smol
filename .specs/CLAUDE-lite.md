# Claude Instructions

## Project Overview

This is the Effect library repository, focusing on functional programming patterns and effect systems in TypeScript.

## 🚨 HIGHEST PRIORITY RULES 🚨

### ABSOLUTELY FORBIDDEN: try-catch in Effect.gen

**NEVER use `try-catch` blocks inside `Effect.gen` generators!**

- Effect generators handle errors through the Effect type system, not JavaScript exceptions
- Use `Effect.tryPromise`, `Effect.try`, or proper Effect error handling instead
- **CRITICAL**: This will cause runtime errors and break Effect's error handling
- **EXAMPLE OF WHAT NOT TO DO**:
  ```ts
  Effect.gen(function* () {
    try {
      // ❌ WRONG - Never do this in Effect.gen
      const result = yield* someEffect
    } catch (error) {
      // ❌ This will never be reached and breaks Effect semantics
    }
  })
  ```
- **CORRECT PATTERN**:
  ```ts
  Effect.gen(function* () {
    // ✅ Use Effect's built-in error handling
    const result = yield* Effect.result(someEffect)
    if (result._tag === "Failure") {
      // Handle error case
    }
  })
  ```

### ABSOLUTELY FORBIDDEN: Type Assertions

**NEVER EVER use `as never`, `as any`, or `as unknown` type assertions!**

- These break TypeScript's type safety and hide real type errors
- Always fix the underlying type issues instead of masking them
- **FORBIDDEN PATTERNS**:
  ```ts
  // ❌ NEVER do any of these
  const value = something as any
  const value = something as never
  const value = something as unknown
  ```
- **CORRECT APPROACH**: Fix the actual type mismatch by:
  - Using proper generic type parameters
  - Importing correct types
  - Using proper Effect constructors and combinators
  - Adjusting function signatures to match usage

### MANDATORY: Return Yield Pattern for Errors

**ALWAYS use `return yield*` when yielding errors or interrupts in Effect.gen!**

- When yielding `Effect.fail`, `Effect.interrupt`, or other terminal effects, always use `return yield*`
- This makes it clear that the generator function terminates at that point
- **MANDATORY PATTERN**:

  ```ts
  Effect.gen(function* () {
    if (someCondition) {
      // ✅ CORRECT - Always use return yield* for errors
      return yield* Effect.fail("error message")
    }

    if (shouldInterrupt) {
      // ✅ CORRECT - Always use return yield* for interrupts
      return yield* Effect.interrupt
    }

    // Continue with normal flow...
    const result = yield* someOtherEffect
    return result
  })
  ```

- **WRONG PATTERNS**:
  ```ts
  Effect.gen(function* () {
    if (someCondition) {
      // ❌ WRONG - Missing return keyword
      yield* Effect.fail("error message")
      // Unreachable code after error!
    }
  })
  ```
- **CRITICAL**: Always use `return yield*` to make termination explicit and avoid unreachable code

## Development Workflow

### Core Principles

- **Research → Plan → Implement**: Never jump straight to coding
- **Reality Checkpoints**: Regularly validate progress and approach
- **Zero Tolerance for Errors**: All automated checks must pass
- **Clarity over Cleverness**: Choose clear, maintainable solutions

### 🚨 MANDATORY FUNCTION DEVELOPMENT WORKFLOW 🚨

### Mandatory Validation Steps

- **🚨 CRITICAL FIRST STEP**: IMMEDIATELY run `pnpm lint --fix <typescript_file.ts>` after editing ANY TypeScript file
- Always run tests after making changes: `pnpm test run <test_file.ts>`
- Run type checking: `pnpm check`
- Build the project: `pnpm build`
- **MANDATORY AFTER EVERY EDIT**: Always lint TypeScript files that are changed with `pnpm lint --fix <typescript_file.ts>`
- Always check for type errors before committing: `pnpm check`
- **CRITICAL**: Check JSDoc examples compile: `pnpm docgen` - MUST PASS before committing

**ALWAYS follow this EXACT sequence when creating ANY new function:**

1. **Create function** - Write the function implementation in TypeScript file
2. **Lint TypeScript file** - Run `pnpm lint --fix <typescript_file.ts>`
3. **Check compilation** - Run `pnpm check` to ensure it compiles
4. **Write test** - Create comprehensive test for the function in test file
5. **Compile test & lint test file** - Run `pnpm check` then `pnpm lint --fix <test_file.ts>`

**CRITICAL NOTES:**

- **ONLY LINT TYPESCRIPT FILES** (.ts files) - Do NOT lint markdown, JSON, or other file types
- **NEVER SKIP ANY STEP** - This workflow is MANDATORY for every single function created
- **NEVER CONTINUE** to the next step until the current step passes completely
- **NEVER CREATE MULTIPLE FUNCTIONS** without completing this full workflow for each one

This ensures:

- Zero compilation errors at any point
- Clean, properly formatted TypeScript code
- Immediate test coverage for every function
- No accumulation of technical debt

### When Stuck

- Ask for guidance rather than guessing

### When you need to write examples or run code

For efficient example development, use the `./scratchpad/` directory:

```bash
# Create temporary development files
touch ./scratchpad/test-example.ts

# Test execution if needed
pnpm tsx ./scratchpad/test-example.ts
```

**⚠️ Remember to Clean Up:**

```bash
# Clean up test files when done
rm scratchpad/test-*.ts
rm scratchpad/temp*.ts scratchpad/example*.ts
```

### Validation and Testing

**Required Checks (run after every edit):**

```bash
# 1. Fix linting issues immediately
pnpm lint --fix packages/effect/src/ModifiedFile.ts

# 2. Verify examples compile
pnpm docgen

# 3. Verify type checking
pnpm check

# 4. Confirm progress
node scripts/analyze-jsdoc.mjs --file=ModifiedFile.ts
```

## Code Style Guidelines

### TypeScript Quality Standards

- **Type Safety**: NEVER use `any` type or `as any` assertions
- **Explicit Types**: Use concrete types over generic `unknown` where possible
- **Type Annotations**: Add explicit annotations when inference fails
- **Early Returns**: Prefer early returns for better readability
- **Input Validation**: Validate all inputs at boundaries
- **Error Handling**: Use proper Effect error management patterns

### Effect Library Conventions

- Follow existing TypeScript patterns in the codebase
- Use functional programming principles
- Maintain consistency with Effect library conventions
- Use proper Effect constructors (e.g., `Array.make()`, `Chunk.fromIterable()`)
- Prefer `Effect.gen` for monadic composition
- Use `Data.TaggedError` for custom error types
- Implement resource safety with automatic cleanup patterns

### Code Organization

- No comments unless explicitly requested
- Follow existing file structure and naming conventions
- Delete old code when replacing functionality
- **NEVER create new script files or tools unless explicitly requested by the user**
- Choose clarity over cleverness in all implementations

### Implementation Completeness

Code is considered complete only when:

- All linters pass (`pnpm lint`)
- All tests pass (`pnpm test run`)
- All type checks pass (`pnpm check`)
- All JSDoc examples compile (`pnpm docgen`)
- Feature works end-to-end
- Old/deprecated code is removed
- Documentation is updated

## Testing

- Test files are located in `packages/*/test/` directories for each package
- Main Effect library tests: `packages/effect/test/`
- Platform-specific tests: `packages/platform-*/test/`
- Use existing test patterns and utilities
- Always verify implementations with tests
- Run specific tests with: `pnpm test run <filename>`

### Time-Dependent Testing

- **CRITICAL**: When testing time-dependent code (delays, timeouts, scheduling), always use `TestClock` to avoid flaky tests
- Import `TestClock` from `effect/TestClock` and use `TestClock.advance()` to control time progression
- Never rely on real wall-clock time (`Effect.sleep`, `Effect.timeout`) in tests without TestClock
- Examples of time-dependent operations that need TestClock:
  - `Effect.sleep()` and `Effect.delay()`
  - `Effect.timeout()` and `Effect.race()` with timeouts
  - Scheduled operations and retry logic
  - Queue operations with time-based completion
  - Any concurrent operations that depend on timing
- Pattern: Use `TestClock.advance("duration")` to simulate time passage instead of actual delays

### Testing Framework Selection

#### When to Use @effect/vitest

- **MANDATORY**: Use `@effect/vitest` for modules that work with Effect values
- **Effect-based functions**: Functions that return `Effect<A, E, R>` types
- **Modules**: Effect, Stream, Layer, TestClock, etc.
- **Import pattern**: `import { assert, describe, it } from "@effect/vitest"`
- **Test pattern**: `it.effect("description", () => Effect.gen(function*() { ... }))`

#### When to Use Regular vitest

- **MANDATORY**: Use regular `vitest` for pure TypeScript functions
- **Pure functions**: Functions that don't return Effect types (Graph, Data, Equal, etc.)
- **Utility modules**: Graph, Chunk, Array, String, Number, etc.
- **Import pattern**: `import { describe, expect, it } from "vitest"`
- **Test pattern**: `it("description", () => { ... })`

### it.effect Testing Pattern

- **MANDATORY**: Use `it.effect` for all Effect-based tests, not `Effect.runSync` with regular `it`
- **CRITICAL**: Import `{ assert, describe, it }` from `@effect/vitest`, not from `vitest`
- **FORBIDDEN**: Never use `expect` from vitest in Effect tests - use `assert` methods instead
- **PATTERN**: All tests should use `it.effect("description", () => Effect.gen(function*() { ... }))`

#### Correct it.effect Pattern:

```ts
import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as SomeModule from "effect/SomeModule"

describe("ModuleName", () => {
  describe("feature group", () => {
    it.effect("should do something", () =>
      Effect.gen(function* () {
        const result = yield* SomeModule.operation()

        // Use assert methods, not expect
        assert.strictEqual(result, expectedValue)
        assert.deepStrictEqual(complexResult, expectedObject)
        assert.isTrue(booleanResult)
        assert.isFalse(negativeResult)
      })
    )

    it.effect("should handle errors", () =>
      Effect.gen(function* () {
        const txRef = yield* SomeModule.create()
        yield* SomeModule.update(txRef, newValue)

        const value = yield* SomeModule.get(txRef)
        assert.strictEqual(value, newValue)
      })
    )
  })
})
```

#### Wrong Patterns (NEVER USE):

```ts
// ❌ WRONG - Using Effect.runSync with regular it
import { describe, expect, it } from "vitest"
it("test", () => {
  const result = Effect.runSync(
    Effect.gen(function* () {
      return yield* someEffect
    })
  )
  expect(result).toBe(value) // Wrong assertion method
})

// ❌ WRONG - Using expect instead of assert
it.effect("test", () =>
  Effect.gen(function* () {
    const result = yield* someEffect
    expect(result).toBe(value) // Should use assert.strictEqual
  })
)
```

#### Key it.effect Guidelines:

- **Import pattern**: `import { assert, describe, it } from "@effect/vitest"`
- **Test structure**: `it.effect("description", () => Effect.gen(function*() { ... }))`
- **Assertions**: Use `assert.strictEqual`, `assert.deepStrictEqual`, `assert.isTrue`, `assert.isFalse`
- **Effect composition**: All operations inside the generator should yield Effects
- **Error testing**: Use `Effect.exit()` for testing error conditions
- **Transactional testing**: Use `Effect.atomic()` for testing transactional behavior

## Git Workflow

- Main branch: `main`
- Create feature branches for new work
- Only commit when explicitly requested
- Follow conventional commit messages

## Key Directories

### Development & Build

- `packages/` - Main source code for the Effect library and related packages
  - `effect/` - Core Effect library implementation
  - `platform-*` - Platform-specific implementations (e.g., Node.js, Browser, Bun)
- `scripts/` - Build and maintenance scripts
- `bundle/` - Bundle size analysis files
- `docs/` - Generated documentation files
- `coverage/` - Test coverage reports
- `scratchpad/` - Temporary development and testing files
- `patches/` - Package patches for dependencies

### Configuration & Specs

- `.specs/` - Implementation specifications and plans organized by feature
- `.github/` - GitHub Actions workflows and templates
- `.vscode/` - VS Code workspace configuration
- `.changeset/` - Changeset configuration for versioning
