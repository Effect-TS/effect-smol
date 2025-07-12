# Claude Instructions

## 🚨 HIGHEST PRIORITY RULES 🚨

### ABSOLUTELY FORBIDDEN: try-catch in Effect.gen
**NEVER use `try-catch` blocks inside `Effect.gen` generators!**
- Effect generators handle errors through the Effect type system, not JavaScript exceptions
- Use `Effect.tryPromise`, `Effect.try`, or proper Effect error handling instead
- **CRITICAL**: This will cause runtime errors and break Effect's error handling
- **EXAMPLE OF WHAT NOT TO DO**:
  ```ts
  Effect.gen(function*() {
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
  Effect.gen(function*() {
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
  Effect.gen(function*() {
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
  Effect.gen(function*() {
    if (someCondition) {
      // ❌ WRONG - Missing return keyword
      yield* Effect.fail("error message")
      // Unreachable code after error!
    }
  })
  ```
- **CRITICAL**: Always use `return yield*` to make termination explicit and avoid unreachable code

## Project Overview
This is the Effect library repository, focusing on functional programming patterns and effect systems in TypeScript.

## Development Workflow

### Core Principles
- **Research → Plan → Implement**: Never jump straight to coding
- **Reality Checkpoints**: Regularly validate progress and approach
- **Zero Tolerance for Errors**: All automated checks must pass
- **Clarity over Cleverness**: Choose clear, maintainable solutions

### Structured Development Process
1. **Research Phase**
   - Understand the codebase and existing patterns
   - Identify related modules and dependencies
   - Review test files and usage examples
   - Use multiple approaches for complex problems

2. **Planning Phase**
   - Create detailed implementation plan
   - Identify validation checkpoints
   - Consider edge cases and error handling
   - Validate plan before implementation

3. **Implementation Phase**
   - Execute with frequent validation
   - **🚨 CRITICAL**: IMMEDIATELY run `pnpm lint --fix <typescript_file.ts>` after editing ANY TypeScript file
   - Run automated checks at each step
   - Use parallel approaches when possible
   - Stop and reassess if stuck

### 🚨 MANDATORY FUNCTION DEVELOPMENT WORKFLOW 🚨
**ALWAYS follow this EXACT sequence when creating ANY new function:**

1. **Create function** - Write the function implementation in TypeScript file
2. **Lint TypeScript file** - Run `pnpm lint --fix <typescript_file.ts>`
3. **Check compilation** - Run `pnpm tsc` to ensure it compiles
4. **Lint TypeScript file again** - Run `pnpm lint --fix <typescript_file.ts>` again
5. **Ensure compilation** - Run `pnpm tsc` again to double-check
6. **Write test** - Create comprehensive test for the function in test file
7. **Compile test & lint test file** - Run `pnpm tsc` then `pnpm lint --fix <test_file.ts>`

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

### Mandatory Validation Steps
- **🚨 CRITICAL FIRST STEP**: IMMEDIATELY run `pnpm lint --fix <typescript_file.ts>` after editing ANY TypeScript file
- Always run tests after making changes: `pnpm test <test_file.ts>`
- Run type checking: `pnpm check`
- Build the project: `pnpm build`
- **CRITICAL**: Check JSDoc examples compile: `pnpm docgen` - MUST PASS before committing
- **MANDATORY AFTER EVERY EDIT**: Always lint TypeScript files that are changed with `pnpm lint --fix <typescript_file.ts>`
- Always check for type errors before committing: `pnpm check`
- **MANDATORY**: Always run docgen to check for examples errors before committing

### 🚨 TYPESCRIPT LINTING REMINDER 🚨
**NEVER FORGET**: After editing ANY TypeScript file (.ts), IMMEDIATELY run:
```bash
pnpm lint --fix <typescript_file.ts>
```
- This is NOT optional - it must be done after EVERY TypeScript file modification!
- **ONLY lint .ts files** - Do NOT attempt to lint markdown, JSON, or other file types

### When Stuck
- Stop spiraling into complex solutions
- Break down the problem into smaller parts
- Use the Task tool for parallel problem-solving
- Simplify the approach
- Ask for guidance rather than guessing

## Documentation Examples
- **CRITICAL REQUIREMENT**: Check that all JSDoc examples compile: `pnpm docgen`
- This command extracts code examples from JSDoc comments and type-checks them
- **ABSOLUTELY NEVER COMMIT if docgen fails** - Fix ANY and ALL compilation errors in examples before committing
- **MANDATORY**: `pnpm docgen` must pass with ZERO errors before any commit
- **ZERO TOLERANCE**: Even pre-existing errors must be fixed before committing new examples
- **NEVER remove examples to make docgen pass** - Fix the type issues properly instead
- Examples should use correct imports and API usage
- **IMPORTANT**: Only edit `@example` sections in the original source files (e.g., `packages/effect/src/*.ts`)
- **DO NOT** edit files in the `docs/examples/` folder - these are auto-generated from JSDoc comments
- **CRITICAL**: When the JSDoc analysis tool reports false positives (missing examples that actually exist), fix the tool in `scripts/analyze-jsdoc.mjs` to correctly detect existing examples

### Writing Examples Guidelines
- Always check test code to ensure the example reflects correct usage
- **MANDATORY**: All examples must compile without errors when docgen runs
- **CRITICAL**: Use proper JSDoc `@example title` tags, not markdown-style `**Example**` headers
- Convert any existing `**Example** (Title)` sections to `@example Title` format
- Always wrap example code in \`\`\`ts \`\`\` code blocks
- **CRITICAL**: NEVER use `any` type or `as any` assertions in examples - always use proper types and imports
- **FORBIDDEN**: Never use `declare const Service: any` - import actual services or use proper type definitions
- Avoid use of `as unknown` - prefer proper constructors and type-safe patterns
- Make sure category tag is set (e.g., `@category models`, `@category constructors`)
- Use proper Effect library patterns and constructors (e.g., `Array.make()`, `Chunk.fromIterable()`)
- Add explicit type annotations when TypeScript type inference fails
- **NEVER remove examples to fix compilation errors** - always fix the underlying type issues
- **CRITICAL**: Use proper nesting for namespaced types (e.g., `Effect.Effect.Success` not `Effect.Success`, `Effect.All.EffectAny` not `Effect.EffectAny`)
- **MANDATORY**: Always check if types are nested within namespaces and use proper access syntax `Module.Namespace.Type`
- **TYPE EXTRACTORS**: For type-level utilities like `Request.Request.Success<T>`, demonstrate type extraction using conditional types and `infer`, not instance creation

### Finding Missing Documentation
- **For all files**: `node scripts/analyze-jsdoc.mjs`
- **For specific file**: `node scripts/analyze-jsdoc.mjs --file=FileName.ts`
- **Example**: `node scripts/analyze-jsdoc.mjs --file=Effect.ts`
- **Schema files**: `node scripts/analyze-jsdoc.mjs --file=schema/Schema.ts`

### Schema Module Documentation
- **CRITICAL**: When working on schema modules, read `packages/effect/SCHEMA.md` first
- This comprehensive 4000+ line document covers Schema v4 design, model structure, and usage patterns
- Essential sections include:
  - Model and type hierarchy (14 type parameters in Bottom interface)
  - Constructor patterns and default values
  - Transformation and filtering redesign
  - JSON serialization/deserialization
  - Class and union handling
- Use SCHEMA.md examples as reference for accurate JSDoc examples
- Schema modules include: Schema.ts, AST.ts, Check.ts, Transformation.ts, etc.

### Common Issues
- Missing imports (e.g., `Effect`, `Stream`, `Console`)
- Using non-existent API methods
- Type mismatches in function signatures
- Incorrect generic type arguments
- Missing type annotations causing implicit `any` types
- Using direct type assertions instead of proper constructors

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
- All tests pass (`pnpm test`)
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
- Run specific tests with: `pnpm test <filename>`

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
      Effect.gen(function*() {
        const result = yield* SomeModule.operation()
        
        // Use assert methods, not expect
        assert.strictEqual(result, expectedValue)
        assert.deepStrictEqual(complexResult, expectedObject)
        assert.isTrue(booleanResult)
        assert.isFalse(negativeResult)
      }))
    
    it.effect("should handle errors", () =>
      Effect.gen(function*() {
        const txRef = yield* SomeModule.create()
        yield* SomeModule.update(txRef, newValue)
        
        const value = yield* SomeModule.get(txRef)
        assert.strictEqual(value, newValue)
      }))
  })
})
```

#### Wrong Patterns (NEVER USE):
```ts
// ❌ WRONG - Using Effect.runSync with regular it
import { describe, expect, it } from "vitest"
it("test", () => {
  const result = Effect.runSync(Effect.gen(function*() {
    return yield* someEffect
  }))
  expect(result).toBe(value) // Wrong assertion method
})

// ❌ WRONG - Using expect instead of assert
it.effect("test", () => Effect.gen(function*() {
  const result = yield* someEffect
  expect(result).toBe(value) // Should use assert.strictEqual
}))
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

## Packages
- `packages/effect/` - Core Effect library
- `packages/platform-node/` - Node.js platform implementation
- `packages/platform-node-shared/` - Shared Node.js utilities
- `packages/platform-bun/` - Bun platform implementation
- `packages/vitest/` - Vitest testing utilities

## Key Directories
- `packages/effect/src/` - Core Effect library source code
- `packages/effect/test/` - Effect library test files
- `packages/effect/dtslint/` - TypeScript definition tests
- `packages/effect/src/internal/` - Internal implementation details
- `packages/effect/src/schema/` - Schema validation and parsing
- `packages/effect/src/unstable/` - Experimental features (e.g., HTTP client)
- `packages/platform-node/src/` - Node.js platform source code
- `packages/platform-node/test/` - Node.js platform tests
- `packages/platform-node-shared/src/` - Shared Node.js utilities source
- `packages/platform-node-shared/test/` - Shared Node.js utilities tests
- `packages/platform-bun/src/` - Bun platform source code
- `packages/vitest/src/` - Vitest utilities source code
- `packages/vitest/test/` - Vitest utilities tests
- `scripts/` - Build and maintenance scripts
- `bundle/` - Bundle size analysis files

## Problem-Solving Strategies

### When Encountering Complex Issues
1. **Stop and Analyze**: Don't spiral into increasingly complex solutions
2. **Break Down**: Divide complex problems into smaller, manageable parts
3. **Use Parallel Approaches**: Launch multiple Task agents for different aspects
4. **Research First**: Always understand existing patterns before creating new ones
5. **Validate Frequently**: Use reality checkpoints to ensure you're on track
6. **Simplify**: Choose the simplest solution that meets requirements
7. **Ask for Help**: Request guidance rather than guessing

### Effective Task Management
- Use TodoWrite/TodoRead tools for complex multi-step tasks
- Mark tasks as in_progress before starting work
- Complete tasks immediately upon finishing
- Break large tasks into smaller, trackable components

## Performance Considerations
- **Measure First**: Always measure performance before optimizing
- Prefer eager evaluation patterns where appropriate
- Consider memory usage and optimization
- Follow established performance patterns in the codebase
- Prioritize clarity over premature optimization
- Use appropriate data structures for the use case