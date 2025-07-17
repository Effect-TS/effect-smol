# JSDoc Examples Import Fix Plan

## Overview

Following the module categorization reorganization (`.specs/categorization/plan.md` - make sure to read this first), there are JSDoc examples that have broken imports. This plan outlines a systematic approach to fix all these imports using 10 concurrent tasks.

First run `pnpm docgen` to identify the examples with import errors, and then
run it again after each task to ensure all examples compile correctly.

## Task Breakdown

- Run `pnpm docgen` to generate the initial list of files with import errors.
- Each task will handle a subset of the files, processing them concurrently.
- Each task will focus on fixing import paths based on the new module structure.
- Each task will run `pnpm docgen` after processing its files to ensure all examples compile correctly.

## Analysis Summary

### Most Affected Imports (by frequency)

- **Option** (77 occurrences) - moved to `data/Option`
  - `import { Option } from "effect/data"`
  - `import * as Option from "effect/data/Option"`
- **Fiber** (32 occurrences) - moved to `runtime/Fiber`
  - `import { Fiber } from "effect/runtime"`
  - `import * as Fiber from "effect/runtime/Fiber"`
- **Ref** (24 occurrences) - moved to `concurrency/Ref`
- **Brand** (23 occurrences) - moved to `data/Brand`
- **Equivalence** (22 occurrences) - moved to `data/Equivalence`
- **Deferred** (22 occurrences) - moved to `concurrency/Deferred`
- **FiberMap** (21 occurrences) - moved to `concurrency/FiberMap`
- **MutableRef** (18 occurrences) - moved to `concurrency/MutableRef`
- **MutableList** (18 occurrences) - moved to `collections/MutableList`
- **FiberHandle** (17 occurrences) - moved to `concurrency/FiberHandle`
- **FiberSet** (16 occurrences) - moved to `concurrency/FiberSet`
- **Filter** (14 occurrences) - moved to `data/Filter`

### Import Error Types

1. **TS2305**: Module '"effect"' has no exported member 'X' - Main exports need updating
2. **TS2307**: Cannot find module 'effect/X' - Direct module imports need path updates

## Import Fix Patterns

### Pattern 1: Main Export Updates

```typescript
// Before
import { Effect, Option, Ref } from "effect"

// After
import { Effect } from "effect"
import { Ref } from "effect/concurrency"
import { Option } from "effect/data"
```

### Pattern 2: Direct Import Updates

```typescript
// Before
import * as Option from "effect/Option"

// After
import * as Option from "effect/data/Option"
```

### Pattern 3: Mixed Import Updates

```typescript
// Before
import { Effect, Option, Ref } from "effect"
import * as Array from "effect/Array"

// After
import { Effect } from "effect"
import * as Array from "effect/collections/Array"
import { Ref } from "effect/concurrency"
import { Option } from "effect/data"
```

## Implementation Steps

1. **Parallel Processing**: Each task will process its assigned files concurrently
2. **Import Detection**: Use regex patterns to identify import statements
3. **Path Resolution**: Update import paths based on the new folder structure
4. **Testing**: After every file change, run `pnpm docgen` to verify all examples compile
5. **Linting**: Run `pnpm lint --fix` to ensure code style consistency
6. **Validation**: Run `pnpm check` after each batch to ensure compilation
7. **Testing**: Run `pnpm docgen` to verify all examples compile

## Success Criteria

- All 354 files with import errors are fixed
- `pnpm docgen` runs without any import-related errors
- No regression in functionality
- All imports follow the new module organization

## Risk Mitigation

- Create backups before making changes
- Test changes incrementally
- Use version control to track changes
- Validate each task's output before proceeding
