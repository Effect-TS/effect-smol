# JSDoc Documentation Enhancement Task

## Objective

Achieve 100% JSDoc documentation coverage for Effect library modules by adding comprehensive `@example` tags and proper `@category` annotations to all exported functions, types, interfaces, and constants.

## Task Overview

You are tasked with systematically improving JSDoc documentation across the Effect library codebase. This involves:

1. **Identifying target files** with missing JSDoc examples using the analysis script
2. **Adding comprehensive @example tags** with working, practical code examples
3. **Ensuring all examples compile** and pass `pnpm docgen` validation
4. **Following Effect library patterns** and best practices
5. **Maintaining consistent documentation quality** across all modules

## Prerequisites

- **CLAUDE.md Understanding**: Read and follow all guidelines in `/CLAUDE.md`
- **Analysis Tool**: Use `node scripts/analyze-jsdoc.mjs` to identify missing documentation
- **Validation**: Ensure `pnpm docgen` passes with zero errors after changes
- **Linting**: Run `pnpm lint --fix` on modified files

## Step-by-Step Process

**MANDATORY: Run `pnpm lint --fix packages/effect/src/TargetFile.ts` after every edit to maintain code quality.**

### 1. Identify Target File

```bash
# Get overall analysis of all files
node scripts/analyze-jsdoc.mjs

# Analyze specific file
node scripts/analyze-jsdoc.mjs --file=FileName.ts
```

**Prioritization Criteria:**
- High number of missing examples
- Core/frequently used modules
- Files with both missing examples AND categories
- Balance between impact and effort

### 2. Read and Understand the Target File

```bash
# Read the file to understand its structure and purpose
Read packages/effect/src/TargetFile.ts
```

**Analysis Points:**
- Module's primary purpose and domain
- Types of exports (functions, types, interfaces, constants)
- Existing documentation patterns
- Import dependencies and usage patterns
- Test files for understanding expected behavior

### 3. Add JSDoc Examples Systematically

**IMPORTANT: After each edit, run linting to fix formatting:**
```bash
# Fix linting issues immediately after making changes
pnpm lint --fix packages/effect/src/TargetFile.ts
```

**Example Structure:**
```typescript
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
```

**Key Requirements:**
- **Working Examples**: All code must compile and be type-safe
- **Practical Usage**: Show real-world use cases, not just API calls
- **Effect Patterns**: Demonstrate proper Effect library usage
- **Multiple Scenarios**: For complex functions, show different use cases
- **Clear Comments**: Explain what each part of the example does
- **Nested Namespace Types**: Always check if types are nested within namespaces and use proper access syntax `Module.Namespace.Type` (e.g., `Request.Request.Success` not `Request.Success`)
- **Type Extractors**: For type-level utilities, demonstrate type extraction using conditional types and `infer`, not instance creation

### 4. Documentation Standards

**Import Patterns:**
```typescript
// Always import what you need
import { Schedule, Effect, Duration, Console } from "effect"

// For type-only imports when needed
import type { Schedule } from "effect"
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
const program = Effect.gen(function* () {
  const result = yield* someEffect
  return result
})

// Use proper error handling
const safeProgram = Effect.gen(function* () {
  const result = yield* Effect.tryPromise({
    try: () => someAsyncOperation(),
    catch: (error) => new CustomError({ message: String(error) })
  })
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

### 5. Handle Complex Functions

**After adding examples for complex functions, immediately run:**
```bash
pnpm lint --fix packages/effect/src/TargetFile.ts
```

**Advanced Functions:**
For low-level or advanced functions that are rarely used directly:

```typescript
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
```

**Type-Level Functions:**
```typescript
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
```

### 6. Validation and Testing

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

**CRITICAL: Always run `pnpm lint --fix` after each edit to prevent accumulation of formatting issues.**

**Success Criteria:**
- ✅ Zero compilation errors in `pnpm docgen`
- ✅ All lint checks pass
- ✅ Examples demonstrate practical usage
- ✅ 100% coverage achieved for target file
- ✅ Documentation follows Effect patterns

### 7. Git Workflow

**Commit Strategy:**
```bash
# Stage changes
git add packages/effect/src/ModifiedFile.ts

# Create descriptive commit
git commit -m "docs(ModuleName): achieve 100% JSDoc documentation coverage

- Add comprehensive JSDoc examples for all X exports
- Document [specific areas like constructors, combinators, etc.]
- Fix compilation errors in existing examples
- Ensure all examples pass docgen validation

Coverage improved from X% to 100% (Y missing examples resolved)

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Quality Standards

### Example Quality Checklist
- [ ] **Compiles successfully** - No TypeScript errors
- [ ] **Proper imports** - All dependencies imported correctly
- [ ] **Realistic scenarios** - Shows actual use cases, not just API syntax
- [ ] **Effect patterns** - Uses Effect.gen, proper error handling, etc.
- [ ] **Clear explanations** - Comments explain what and why
- [ ] **Type safety** - No `any` types or unsafe assertions
- [ ] **Best practices** - Follows Effect library conventions

### Common Pitfalls to Avoid
- ❌ **Using `any` types** - Always use proper TypeScript types
- ❌ **Non-compiling examples** - All code must pass `pnpm docgen`
- ❌ **Import errors** - Check module exports and correct import paths
- ❌ **Namespace confusion** - Use correct type references (e.g., `Schedule.InputMetadata`)
- ❌ **Array vs Tuple issues** - Pay attention to exact type requirements
- ❌ **Missing Effect imports** - Import all necessary Effect modules
- ❌ **Outdated patterns** - Use current Effect API, not deprecated approaches
- ❌ **Incorrect nested type access** - Use `Module.Namespace.Type` syntax for nested types (e.g., `Request.Request.Success` not `Request.Success`)
- ❌ **Wrong type extractor examples** - Type-level utilities should show type extraction, not instance creation

## Success Metrics

**Per File:**
- 100% JSDoc coverage (all exports have @example tags)
- Zero compilation errors in docgen
- All functions have appropriate @category tags
- Examples demonstrate practical, real-world usage

**Per Module Domain:**
- Core modules (Effect, Array, Chunk, etc.) should be prioritized
- Stream/concurrency modules benefit from complex examples
- Utility modules need practical, everyday use cases
- Type-level modules need clear constraint examples

## Reporting Progress

After completing each file:
1. **Run final analysis**: `node scripts/analyze-jsdoc.mjs --file=CompletedFile.ts`
2. **Document completion**: Note the coverage improvement (e.g., "34% → 100%")
3. **Identify next target**: Use analysis to determine next highest-priority file
4. **Update todo list**: Mark current task complete, add next target

## Long-term Impact

This systematic documentation enhancement:
- **Improves developer experience** with comprehensive examples
- **Reduces learning curve** for Effect library adoption
- **Enhances IDE support** with better IntelliSense
- **Ensures maintainability** with consistent documentation patterns
- **Builds institutional knowledge** through practical examples

The goal is not just documentation coverage, but creating a valuable learning resource that helps developers effectively use the Effect library in real-world applications.