# Agent Instructions for Effect Library Development

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

### Implementation Specifications

- **Specifications Directory**: `.specs/` contains detailed implementation plans and specifications for all features
- **Organization**: Each specification is organized by feature name (e.g., `effect-transaction-to-atomic-refactor`, `txhashmap-implementation`)
- **Purpose**: Reference these specifications when implementing new features or understanding existing implementation plans

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

## JSDoc Documentation Enhancement

### Overview

Achieve 100% JSDoc documentation coverage for Effect library modules by adding comprehensive `@example` tags and proper `@category` annotations to all exported functions, types, interfaces, and constants.

### Critical Requirements

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

### Finding Missing Documentation

- **For all files**: `node scripts/analyze-jsdoc.mjs`
- **For specific file**: `node scripts/analyze-jsdoc.mjs --file=FileName.ts`
- **Example**: `node scripts/analyze-jsdoc.mjs --file=Effect.ts`
- **Schema files**: `node scripts/analyze-jsdoc.mjs --file=schema/Schema.ts`

### Documentation Enhancement Strategies

#### Single File Approach

For focused, deep documentation work on one complex module:

- Choose one high-priority file
- Work through it systematically
- Ensure 100% completion before moving on

#### Parallel Agent Approach

For maximum efficiency across multiple files simultaneously:

**When to Use Parallel Agents:**

- Working on 5+ files with similar complexity
- Need to quickly improve overall coverage
- Files are independent (no cross-dependencies in examples)
- Have identified top 10-20 priority files

**Parallel Implementation:**

```bash
# 1. Identify top priority files
node scripts/analyze-jsdoc.mjs | head -20

# 2. Deploy multiple agents using Task tool
# Agent 1: Work on File1.ts (X missing examples)
# Agent 2: Work on File2.ts (Y missing examples)
# Agent 3: Work on File3.ts (Z missing examples)
# ... up to 10 agents for maximum efficiency

# 3. Coordinate agent tasks
# - Each agent works on a different file
# - Clear task descriptions with specific file targets
# - Include missing example counts and categories needed
```

**Parallel Agent Task Template:**

```
Complete JSDoc documentation for [RelativePath] ([X] missing examples, [Y] missing categories)

Instructions:
- Read packages/effect/src/[RelativePath] (e.g., Effect.ts or schema/Schema.ts)
- **For schema files**: First read packages/effect/SCHEMA.md for comprehensive understanding
- Add @example tags for all missing exports
- Add missing @category tags
- Follow Effect library patterns
- Ensure all examples compile with pnpm docgen
- Run pnpm lint --fix after each edit

Focus areas:
- [List specific exports needing examples]
- [Note any complex types or patterns]
- [Mention related modules for context]

Schema-specific guidance:
- SCHEMA.md covers v4 model structure, transformations, and usage patterns
- Use Bottom interface understanding (14 type parameters) for accurate examples
- Reference constructor patterns, filtering, and transformation examples

Note: Use relative paths when analyzing progress:
- node scripts/analyze-jsdoc.mjs --file=[RelativePath]
```

### Development Workflow for Documentation

**Step-by-Step Process:**

1. **Identify Target Files**: Use `node scripts/analyze-jsdoc.mjs` to find missing documentation
2. **Prioritize Files**: Focus on high-impact, frequently used modules
3. **Read and Understand**: Analyze the target file structure and purpose
4. **Add Examples Systematically**: Follow the example structure below
5. **Validate**: Ensure all examples compile and lint correctly

**IMPORTANT: After each edit, run linting:**

```bash
pnpm lint --fix packages/effect/src/TargetFile.ts
```

### Scratchpad Development Workflow

For efficient example development, use the `./scratchpad/` directory:

```bash
# Create temporary development files
touch ./scratchpad/test-example.ts

# Check TypeScript compilation
tsc --noEmit ./scratchpad/test-example.ts

# Fix formatting using project rules
pnpm lint --fix ./scratchpad/test-example.ts

# Test execution if needed
pnpm tsx ./scratchpad/test-example.ts
```

**Scratchpad Benefits:**

- ✅ Rapid prototyping of complex examples
- ✅ Safe testing without affecting main codebase
- ✅ Easy iteration on example code
- ✅ Type checking validation before copying to JSDoc

**⚠️ Remember to Clean Up:**

```bash
# Clean up test files when done
rm scratchpad/test-*.ts
rm scratchpad/temp*.ts scratchpad/example*.ts
```

### Writing Examples Guidelines

**Example Structure:**

````typescript
/**
 * Brief description of what the function does.
 *
 * @example
 * ```ts
 * import { ModuleName, Effect } from "effect"
 *
 * // Clear description of what this example demonstrates
 * const example = ModuleName.functionName(params)
 *
 * // Usage in Effect context
 * const program = Effect.gen(function* () {
 *   const result = yield* example
 *   console.log(result)
 * })
 * ```
 *
 * @since version
 * @category appropriate-category
 */
````

**Key Requirements:**

- **Working Examples**: All code must compile and be type-safe
- **Practical Usage**: Show real-world use cases, not just API calls
- **Effect Patterns**: Demonstrate proper Effect library usage
- **Multiple Scenarios**: For complex functions, show different use cases
- **Clear Comments**: Explain what each part of the example does
- **Nested Namespace Types**: Always check if types are nested within namespaces and use proper access syntax `Module.Namespace.Type`
- **Type Extractors**: For type-level utilities, demonstrate type extraction using conditional types and `infer`, not instance creation

**Critical Guidelines:**

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

### Documentation Standards

**Import Patterns:**

```typescript
// Core Effect library imports
import { Console, Duration, Effect, Schedule } from "effect"

// Schema imports (note: lowercase 'schema')
import { Schema } from "effect/schema"

// For mixed usage
import { Effect } from "effect"
import { Schema } from "effect/schema"

// For type-only imports when needed
import type { Schedule } from "effect"
import type { Schema } from "effect/schema"
```

**Error Handling:**

```typescript
// Use Data.TaggedError for custom errors
import { Data } from "effect"

class CustomError extends Data.TaggedError("CustomError")<{
  message: string
}> {}
```

**Effect Patterns:**

```typescript
// Use Effect.gen for monadic composition
const program = Effect.gen(function*() {
  const result = yield* someEffect
  return result
})

// Use proper error handling
const safeProgram = Effect.gen(function*() {
  const result = yield* Effect.tryPromise({
    try: () => someAsyncOperation(),
    catch: (error) => new CustomError({ message: String(error) })
  })
  return result
})
```

**Schema Patterns:**

```typescript
// Basic schema usage
import { Schema } from "effect/schema"

// Simple validation
const result = Schema.decodeUnknownSync(Schema.String)("hello")

// With Effect for async validation
import { Effect } from "effect"
import { Schema } from "effect/schema"

const program = Effect.gen(function*() {
  const validated = yield* Schema.decodeUnknownEffect(Schema.Number)(42)
  return validated
})

// Struct schemas
const PersonSchema = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

// Complex validation with error handling
const safeValidation = Effect.gen(function*() {
  const result = yield* Schema.decodeUnknownEffect(PersonSchema)(input)
  console.log("Valid person:", result)
  return result
})
```

**Categories to Use:**

- `constructors` - Functions that create new instances
- `destructors` - Functions that extract or convert values
- `combinators` - Functions that combine or transform existing values
- `utilities` - Helper functions and common operations
- `predicates` - Functions that return boolean values
- `getters` - Functions that extract properties or values
- `models` - Types, interfaces, and data structures
- `symbols` - Type identifiers and branded types
- `guards` - Type guard functions
- `refinements` - Type refinement functions
- `mapping` - Transformation functions
- `filtering` - Selection and filtering operations
- `folding` - Reduction and aggregation operations
- `sequencing` - Sequential operation combinators
- `error handling` - Error management functions
- `resource management` - Resource lifecycle functions
- `concurrency` - Concurrent operation utilities
- `testing` - Test utilities and helpers
- `interop` - Interoperability functions

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

### Handling Complex Functions

**Advanced Functions:**
For low-level or advanced functions that are rarely used directly:

````typescript
/**
 * Advanced function for [specific use case].
 *
 * @example
 * ```ts
 * import { ModuleName } from "effect"
 *
 * // Note: This is an advanced function for specific use cases
 * // Most users should use simpler alternatives like:
 * const simpleApproach = ModuleName.commonFunction(args)
 * const anotherOption = ModuleName.helperFunction(args)
 *
 * // Advanced usage (when absolutely necessary):
 * const advancedResult = ModuleName.advancedFunction(complexArgs)
 * ```
 */
````

**Type-Level Functions:**

````typescript
/**
 * Type-level constraint function for compile-time safety.
 *
 * @example
 * ```ts
 * import { ModuleName } from "effect"
 *
 * // Ensures type constraint at compile time
 * const constrainedValue = someValue.pipe(
 *   ModuleName.ensureType<SpecificType>()
 * )
 *
 * // This provides compile-time type safety without runtime overhead
 * ```
 */
````

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

**Success Criteria:**

- ✅ Zero compilation errors in `pnpm docgen`
- ✅ All lint checks pass
- ✅ Examples demonstrate practical usage
- ✅ 100% coverage achieved for target file
- ✅ Documentation follows Effect patterns

### Common Issues to Avoid

- ❌ **Using `any` types** - Always use proper TypeScript types
- ❌ **Non-compiling examples** - All code must pass `pnpm docgen`
- ❌ **Import errors** - Check module exports and correct import paths
- ❌ **Namespace confusion** - Use correct type references (e.g., `Schedule.InputMetadata`)
- ❌ **Array vs Tuple issues** - Pay attention to exact type requirements
- ❌ **Missing Effect imports** - Import all necessary Effect modules
- ❌ **Outdated patterns** - Use current Effect API, not deprecated approaches
- ❌ **Incorrect nested type access** - Use `Module.Namespace.Type` syntax for nested types
- ❌ **Wrong type extractor examples** - Type-level utilities should show type extraction, not instance creation
- ❌ **Wrong schema imports** - Use `effect/schema` (lowercase), not `effect/Schema` or `@effect/schema`
- ❌ **Missing Schema import** - Always import Schema when using schema functions
- ❌ **Incorrect validation patterns** - Use `decodeUnknownSync` for sync validation, `decodeUnknownEffect` for async

### Success Metrics

**Per File:**

- 100% JSDoc coverage (all exports have @example tags)
- Zero compilation errors in docgen
- All functions have appropriate @category tags
- Examples demonstrate practical, real-world usage

**Per Module Domain:**

- Core modules (Effect, Array, Chunk, etc.) should be prioritized
- Schema modules (Schema, AST, etc.) benefit from validation examples
- Stream/concurrency modules benefit from complex examples
- Utility modules need practical, everyday use cases
- Type-level modules need clear constraint examples

**Long-term Impact:**

- Improves developer experience with comprehensive examples
- Reduces learning curve for Effect library adoption
- Enhances IDE support with better IntelliSense
- Ensures maintainability with consistent documentation patterns
- Builds institutional knowledge through practical examples

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
  const result = Effect.runSync(
    Effect.gen(function*() {
      return yield* someEffect
    })
  )
  expect(result).toBe(value) // Wrong assertion method
})

// ❌ WRONG - Using expect instead of assert
it.effect("test", () =>
  Effect.gen(function*() {
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

### Core Library

- `packages/effect/src/` - Core Effect library source code
  - `collections/` - Data structures (Array, HashMap, Chunk, etc.)
  - `concurrency/` - Concurrent operations (Fiber, Semaphore, etc.)
  - `data/` - Core data types (Option, Either, Result, etc.)
  - `interfaces/` - Type interfaces (Equal, Hash, Pipeable, etc.)
  - `internal/` - Private implementation details
  - `platform/` - Platform abstractions
  - `streaming/` - Stream operations
  - `schema/` - Schema validation and parsing
  - `unstable/` - Experimental features
- `packages/effect/test/` - Effect library test files
- `packages/effect/dtslint/` - TypeScript definition tests

### Platform Implementations

- `packages/platform-node/src/` - Node.js platform source code
- `packages/platform-node/test/` - Node.js platform tests
- `packages/platform-node-shared/src/` - Shared Node.js utilities source
- `packages/platform-node-shared/test/` - Shared Node.js utilities tests
- `packages/platform-bun/src/` - Bun platform source code
- `packages/vitest/src/` - Vitest utilities source code
- `packages/vitest/test/` - Vitest utilities tests

### Development & Build

- `scripts/` - Build and maintenance scripts
  - `analyze-jsdoc.mjs` - JSDoc coverage analysis tool
  - `docs.mjs` - Documentation generation
  - `version.mjs` - Version management
- `bundle/` - Bundle size analysis files
- `docs/` - Generated documentation files
- `coverage/` - Test coverage reports
- `scratchpad/` - Temporary development and testing files
- `patches/` - Package patches for dependencies

### Configuration & Specs

- `.specs/` - Implementation specifications and plans organized by feature
  - `README.md` - Specification workflow and feature tracking
  - `spec-driven-development-integration/` - Current implementation specs
- `.patterns/` - Development patterns and best practices
  - `README.md` - Pattern organization and usage guide
  - `effect-library-development.md` - Core Effect patterns
  - `testing-patterns.md` - Testing strategies with @effect/vitest
  - `module-organization.md` - Module structure and naming conventions
  - `error-handling.md` - Structured error management patterns
  - `jsdoc-documentation.md` - Documentation standards and examples
  - `platform-integration.md` - Service abstractions and cross-platform patterns
- `.claude/` - Claude AI development commands
  - `commands/new-feature.md` - 5-phase spec-driven development workflow
  - `commands/done-feature.md` - Feature completion and validation workflow
- `.github/` - GitHub Actions workflows and templates
- `.vscode/` - VS Code workspace configuration
- `.changeset/` - Changeset configuration for versioning

## Development Patterns Reference

The `.patterns/` directory contains comprehensive development patterns and best practices for the Effect library. **Always reference these patterns before implementing new functionality** to ensure consistency with established codebase conventions.

### Core Patterns to Follow:

- **Effect Library Development**: Fundamental patterns, forbidden practices, and mandatory patterns
- **Module Organization**: Directory structure, export patterns, naming conventions, and TypeId usage
- **Error Handling**: Data.TaggedError usage, error transformation, and recovery patterns
- **Testing**: @effect/vitest usage, TestClock patterns, and it.effect best practices
- **JSDoc Documentation**: Documentation standards, example formats, and compilation requirements
- **Platform Integration**: Service abstractions, layer composition, and cross-platform patterns

### Pattern Usage Guidelines:

1. **Before coding**: Review relevant patterns in `.patterns/` directory
2. **During implementation**: Follow established conventions and naming patterns
3. **For complex features**: Use patterns as templates for consistent implementation
4. **When stuck**: Reference similar implementations in existing codebase following these patterns

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
