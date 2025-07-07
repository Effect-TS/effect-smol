# Effect.transaction to Effect.atomic Refactor Plan

## Overview

This plan outlines the refactoring of the current `Effect.transaction` function to `Effect.atomic` and the creation of a new `Effect.transaction` function with different transaction composition semantics.

## Current State Analysis

### Existing Behavior
- `Effect.transaction` currently **composes with parent transactions**
- Nested transactions share the parent's journal and state
- All operations in nested calls participate in the parent's atomicity
- Uses optimistic STM with version-based conflict detection
- Automatically retries on conflicts

### Key Implementation Details
- Located in `packages/effect/src/Effect.ts` (lines 8608-8847)
- Uses `Transaction` service with journal and retry flag
- Checks for existing transaction: `if (fiber.services.unsafeMap.has(Transaction.key))`
- Reuses parent transaction when found

## Proposed Changes

### 1. Rename `Effect.transaction` to `Effect.atomic`

**New Behavior for `Effect.atomic`:**
- Maintains current composing behavior
- Nested `Effect.atomic` calls participate in parent transaction
- Shares journal and atomicity scope with parent

**API Signature (unchanged):**
```typescript
export const atomic: <A, E, R>(effect: Effect<A, E, R>) => Effect<A, E, Exclude<R, Transaction>>
```

### 2. Create New `Effect.transaction`

**New Behavior for `Effect.transaction`:**
- Always creates a new transaction boundary
- Does NOT compose with parent transactions
- Nested transactions are independent and isolated
- Each transaction has its own journal and commit/rollback behavior

**API Signature:**
```typescript
export const transaction: <A, E, R>(effect: Effect<A, E, R>) => Effect<A, E, Exclude<R, Transaction>>
```

## Implementation Strategy

**Note: This is for a new major version of Effect - breaking changes are acceptable.**

### Phase 1: Complete Rename to Effect.atomic

1. **Rename Core Implementation**
   - Rename current `transaction` function to `atomic` in `packages/effect/src/Effect.ts`
   - Update internal references and exports
   - Update `packages/effect/src/index.ts` exports

2. **Update All Library Module Usage**
   - **Priority**: Update all transactional data structures first:
     - `packages/effect/src/TxRef.ts` - Replace all `Effect.transaction` with `Effect.atomic`
     - `packages/effect/src/TxQueue.ts` - Replace all `Effect.transaction` with `Effect.atomic`  
     - `packages/effect/src/TxChunk.ts` - Replace all `Effect.transaction` with `Effect.atomic`
     - `packages/effect/src/TxHashMap.ts` - Replace all `Effect.transaction` with `Effect.atomic`
   - Search for any other internal usage of `Effect.transaction` throughout the codebase
   - **Principle**: Library modules should use atomic blocks, not isolated transactions

3. **Update All Tests**
   - Replace all `Effect.transaction` with `Effect.atomic` in test files
   - Ensure all existing tests pass with renamed function
   - No new functionality yet - just preserve existing behavior

4. **Update All Documentation**
   - Update JSDoc examples to use `Effect.atomic`
   - Update any markdown documentation references
   - Clear indication that this preserves current behavior

### Phase 2: Validate Atomic Implementation

1. **Comprehensive Testing**
   - Run full test suite to ensure no regressions
   - Verify all transactional data structures work correctly
   - Test nested atomic scenarios
   - Ensure performance is unchanged

2. **Documentation Verification**
   - Verify all JSDoc examples compile with `Effect.atomic`
   - Run `pnpm docgen` to ensure no documentation errors
   - Update any remaining references

3. **Code Review and Cleanup**
   - Search for any missed `Effect.transaction` references
   - Clean up any legacy patterns
   - Ensure consistent usage throughout codebase

### Phase 3: Implement New Isolated Effect.transaction (Future)

**Note: This phase comes after Phase 1 & 2 are completely finished**

1. **Design Isolated Transaction Semantics**
   - Design transaction isolation logic
   - Plan conflict resolution between parent and child transactions
   - Consider performance implications of isolation

2. **Implement New Transaction Function**
   - Create new isolated `Effect.transaction` implementation
   - Force new transaction context even when parent exists
   - Manage independent journal and state

3. **Add Isolation Tests and Documentation**
   - Add comprehensive tests for isolation behavior
   - Document when to use `atomic` vs `transaction`
   - Provide clear usage examples for both patterns

## Detailed Implementation Plan

### File Modifications Required

#### Phase 1: Rename to Effect.atomic

1. **Core Implementation Files**
   - `packages/effect/src/Effect.ts` - Rename `transaction` function to `atomic`
   - `packages/effect/src/index.ts` - Update exports to export `atomic` instead of `transaction`

2. **Transactional Data Structure Files (Priority)**
   - `packages/effect/src/TxRef.ts` - Replace all `Effect.transaction` → `Effect.atomic`
   - `packages/effect/src/TxQueue.ts` - Replace all `Effect.transaction` → `Effect.atomic`
   - `packages/effect/src/TxChunk.ts` - Replace all `Effect.transaction` → `Effect.atomic`
   - `packages/effect/src/TxHashMap.ts` - Replace all `Effect.transaction` → `Effect.atomic`

3. **Test Files**
   - `packages/effect/test/TxRef.test.ts` - Update to use `Effect.atomic`
   - `packages/effect/test/TxQueue.test.ts` - Update to use `Effect.atomic`
   - `packages/effect/test/TxChunk.test.ts` - Update to use `Effect.atomic`
   - `packages/effect/test/TxHashMap.test.ts` - Update to use `Effect.atomic`
   - `packages/effect/test/Effect.test.ts` - Update existing transaction tests
   - Any other test files using `Effect.transaction`

4. **Documentation Files**
   - Update all JSDoc examples in transactional modules
   - Update any README or markdown files referencing `Effect.transaction`

#### Phase 2: Validation (No file changes, just verification)

#### Phase 3: New Effect.transaction (Future)
   - `packages/effect/src/Effect.ts` - Add new isolated `transaction` function
   - New test files for isolation behavior
   - New documentation for usage patterns

### Breaking Changes Assessment

**This is a BREAKING CHANGE for new major version:**
- Existing `Effect.transaction` usage will have different semantics after rename to `Effect.atomic`
- Nested transaction behavior changes significantly with new isolated `Effect.transaction`
- Performance characteristics may differ between `atomic` and `transaction`
- All existing code using `Effect.transaction` must be updated

**Major Version Migration Strategy:**
1. **Direct Breaking Change**: Rename all existing `Effect.transaction` to `Effect.atomic` immediately
2. **Clean Implementation**: Implement new `Effect.transaction` with isolated semantics without backward compatibility
3. **Complete Codebase Update**: Update all internal usage, tests, and documentation in single release
4. **Clear Documentation**: Provide comprehensive migration guide for major version upgrade

## Testing Strategy

### Unit Tests Required

1. **Atomic Behavior Tests**
   ```typescript
   test("atomic composes with parent transaction", () => {
     // Verify nested atomic calls share journal
   })
   ```

2. **Transaction Isolation Tests**
   ```typescript
   test("transaction creates independent boundaries", () => {
     // Verify child transaction doesn't affect parent
   })
   ```

3. **Conflict Resolution Tests**
   ```typescript
   test("isolated transactions handle conflicts correctly", () => {
     // Test parent-child conflict scenarios
   })
   ```

4. **Performance Tests**
   - Compare overhead of isolated vs composing transactions
   - Benchmark nested transaction scenarios

### Integration Tests

- Test with all transactional data structures
- Test complex nested scenarios
- Test error handling and rollback behavior

## Documentation Updates

### JSDoc Examples

**Effect.atomic Example:**
```typescript
/**
 * @example
 * import { Effect, TxRef } from "effect"
 * 
 * // Composes with parent transaction
 * const program = Effect.gen(function* () {
 *   const ref1 = yield* TxRef.make(0)
 *   const ref2 = yield* TxRef.make(0)
 *   
 *   yield* Effect.atomic(Effect.gen(function* () {
 *     yield* TxRef.set(ref1, 1)
 *     yield* Effect.atomic(Effect.gen(function* () {
 *       yield* TxRef.set(ref2, 2) // Same transaction as parent
 *     }))
 *   }))
 * })
 */
```

**Effect.transaction Example:**
```typescript
/**
 * @example
 * import { Effect, TxRef } from "effect"
 * 
 * // Creates isolated transaction boundary
 * const program = Effect.gen(function* () {
 *   const ref = yield* TxRef.make(0)
 *   
 *   yield* Effect.transaction(Effect.gen(function* () {
 *     yield* TxRef.set(ref, 1)
 *     
 *     yield* Effect.transaction(Effect.gen(function* () {
 *       yield* TxRef.set(ref, 2) // Independent transaction
 *     })) // Commits immediately
 *     
 *     // ref is now 2, even if this transaction retries
 *   }))
 * })
 */
```

## Risk Assessment

### High Risk Areas
1. **Comprehensive Breaking Changes** - All existing `Effect.transaction` usage changes
2. **Performance Impact** - Isolated transactions may have overhead
3. **Complex Nested Scenarios** - Edge cases with deep nesting and mixed usage

### Mitigation Strategies
1. **Comprehensive Testing** - Cover all edge cases thoroughly with complete test suite overhaul
2. **Clean Cut Migration** - Complete migration in single major version release
3. **Performance Monitoring** - Benchmark before and after changes with clear performance documentation
4. **Extensive Documentation** - Clear examples, migration guides, and usage patterns for major version

## Success Criteria

1. **Functional Requirements**
   - `Effect.atomic` maintains exact current behavior of old `Effect.transaction`
   - `Effect.transaction` provides true isolation with independent transaction boundaries
   - All codebase usage updated to use appropriate function (`atomic` vs `transaction`)
   - Comprehensive test suite covering both behaviors and interaction scenarios

2. **Performance Requirements**
   - No regression in `atomic` performance (same as old `transaction`)
   - `transaction` isolation overhead documented and acceptable
   - Memory usage remains reasonable for both approaches
   - Clear performance characteristics documentation

3. **Documentation Requirements**
   - Complete JSDoc overhaul with new semantics
   - Clear differentiation between `atomic` and `transaction` usage
   - Major version migration guide
   - Comprehensive examples for both use cases and interaction patterns

## Approval Request

This plan outlines a phased major version breaking change approach. **Phase 1 focuses exclusively on the rename from `Effect.transaction` to `Effect.atomic`** while preserving all current behavior.

### Phase 1 Priorities:

1. **Library-First Approach**: Update all internal library modules to use `Effect.atomic`
2. **Principle**: Library internals use atomic blocks, transactions are user-facing isolation concerns
3. **No New Functionality**: Just rename while preserving exact current behavior
4. **Complete Validation**: Ensure all tests pass and documentation compiles

### Future Phases:
- Phase 2: Validation and cleanup
- Phase 3: Implement new isolated `Effect.transaction` (separate effort)

**Request for approval to proceed with Phase 1: Complete rename from `Effect.transaction` to `Effect.atomic` throughout the entire codebase.**