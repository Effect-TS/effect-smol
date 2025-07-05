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

### 1. Identify Target Files and Strategy

```bash
# Get overall analysis of all files (includes schema subdirectory)
node scripts/analyze-jsdoc.mjs

# Analyze specific file using relative paths from packages/effect/src/
node scripts/analyze-jsdoc.mjs --file=FileName.ts

# Examples:
# Root files
node scripts/analyze-jsdoc.mjs --file=Effect.ts
node scripts/analyze-jsdoc.mjs --file=Array.ts

# Schema files (use relative path)
node scripts/analyze-jsdoc.mjs --file=schema/Schema.ts
node scripts/analyze-jsdoc.mjs --file=schema/AST.ts
```

**Prioritization Criteria:**
- High number of missing examples
- Core/frequently used modules
- Files with both missing examples AND categories
- Balance between impact and effort

### Strategy Options

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

**Parallel Benefits:**
- ✅ 10x faster coverage improvement
- ✅ Consistent documentation patterns across modules
- ✅ Systematic approach to large codebases
- ✅ Efficient resource utilization

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
// Core Effect library imports
import { Schedule, Effect, Duration, Console } from "effect"

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

**Schema Patterns:**
```typescript
// Basic schema usage
import { Schema } from "effect/schema"

// Simple validation
const result = Schema.decodeUnknownSync(Schema.String)("hello")

// With Effect for async validation
import { Effect } from "effect"
import { Schema } from "effect/schema"

const program = Effect.gen(function* () {
  const validated = yield* Schema.decodeUnknownEffect(Schema.Number)(42)
  return validated
})

// Struct schemas
const PersonSchema = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

// Complex validation with error handling
const safeValidation = Effect.gen(function* () {
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
node scripts/analyze-jsdoc.mjs --file=ModifiedFile.ts (use relative paths like schema/Schema.ts)
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
- ❌ **Wrong schema imports** - Use `effect/schema` (lowercase), not `effect/Schema` or `@effect/schema`
- ❌ **Missing Schema import** - Always import Schema when using schema functions like `decodeUnknownSync`
- ❌ **Incorrect validation patterns** - Use `decodeUnknownSync` for sync validation, `decodeUnknownEffect` for async

## Success Metrics

**Per File:**
- 100% JSDoc coverage (all exports have @example tags)
- Zero compilation errors in docgen
- All functions have appropriate @category tags
- Examples demonstrate practical, real-world usage

**Per Module Domain:**
- Core modules (Effect, Array, Chunk, etc.) should be prioritized
- Schema modules (Schema, AST, etc.) benefit from validation examples
  - **IMPORTANT**: Read `packages/effect/SCHEMA.md` for comprehensive schema understanding
  - This 4000+ line document covers v4 improvements, model structure, and usage patterns
  - Essential for writing accurate schema examples and understanding API design
- Stream/concurrency modules benefit from complex examples
- Utility modules need practical, everyday use cases
- Type-level modules need clear constraint examples

## Reporting Progress

### Single File Completion
After completing each file:
1. **Run final analysis**: `node scripts/analyze-jsdoc.mjs --file=CompletedFile.ts` (use relative paths like `schema/Schema.ts` for schema files)
2. **Document completion**: Note the coverage improvement (e.g., "34% → 100%")
3. **Identify next target**: Use analysis to determine next highest-priority file
4. **Update todo list**: Mark current task complete, add next target

### Parallel Agent Coordination
After deploying multiple agents:

**During Execution:**
1. **Monitor agent progress**: Check on individual agent completion
2. **Track overall improvement**: Run periodic analysis to see coverage gains
3. **Handle blockers**: Address any compilation issues agents encounter
4. **Coordinate dependencies**: Ensure agents don't conflict on shared modules

**After Parallel Completion:**
```bash
# 1. Validate all agent work
pnpm docgen  # Must pass with zero errors

# 2. Check overall progress
node scripts/analyze-jsdoc.mjs

# 3. Identify remaining gaps
# Focus on files not covered by agents

# 4. Plan next phase
# Deploy new agents for remaining high-priority files
```

**Parallel Success Metrics:**
- ✅ All agents complete their assigned files
- ✅ Zero compilation errors across all modified files
- ✅ Significant coverage improvement (e.g., 85% → 95%)
- ✅ Consistent documentation quality across all files
- ✅ No conflicts or duplicate work between agents

**Next Phase Planning:**
After successful parallel execution, identify:
- Files still needing attention
- Complex modules requiring focused single-file approach
- Quality improvements needed in completed files
- Documentation gaps in specialized domains

## Long-term Impact

This systematic documentation enhancement:
- **Improves developer experience** with comprehensive examples
- **Reduces learning curve** for Effect library adoption
- **Enhances IDE support** with better IntelliSense
- **Ensures maintainability** with consistent documentation patterns
- **Builds institutional knowledge** through practical examples

The goal is not just documentation coverage, but creating a valuable learning resource that helps developers effectively use the Effect library in real-world applications.