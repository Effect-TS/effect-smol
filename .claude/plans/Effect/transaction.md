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

### Phase 1: Rename and Maintain Backward Compatibility

1. **Rename Internal Implementation**
   - Rename current `transaction` function to `atomic` 
   - Update internal references and exports
   - Maintain all existing behavior

2. **Add Deprecated `transaction` Alias**
   - Create temporary alias: `export const transaction = atomic`
   - Add deprecation warning in JSDoc
   - Update exports in `packages/effect/src/index.ts`

3. **Update Documentation**
   - Update JSDoc for `atomic` to clarify composing behavior
   - Add deprecation notice for old `transaction` usage

### Phase 2: Implement New Transaction Semantics

1. **Create New Transaction Implementation**
   - Implement `transactionIsolated` function
   - Force new transaction context even when parent exists
   - Manage independent journal and state

2. **Transaction Isolation Logic**
   ```typescript
   // Pseudocode for new transaction behavior
   const transaction = <A, E, R>(effect: Effect<A, E, R>) => {
     return Effect.gen(function* () {
       // Always create new transaction context
       const newTransaction = {
         retry: false,
         journal: new Map()
       }
       
       // Execute effect in isolated transaction scope
       return yield* Effect.provide(effect, newTransaction)
     })
   }
   ```

3. **Conflict Resolution Between Parent and Child**
   - Child transaction commits independently
   - Parent transaction unaware of child's changes
   - Potential conflicts handled at parent's commit time

### Phase 3: Update Codebase Usage

1. **Update Transactional Data Structures**
   - Review TxQueue, TxRef, TxChunk, TxHashMap implementations
   - Determine appropriate usage of `atomic` vs `transaction`
   - Most existing usage should switch to `atomic` for current behavior

2. **Update Tests**
   - Add comprehensive tests for both behaviors
   - Test nested transaction scenarios
   - Test isolation between parent and child transactions
   - Test conflict resolution between independent transactions

3. **Update Examples and Documentation**
   - Provide clear examples of when to use each function
   - Document performance implications
   - Update all JSDoc examples

## Detailed Implementation Plan

### File Modifications Required

1. **`packages/effect/src/Effect.ts`**
   - Rename `transaction` to `atomic`
   - Implement new `transaction` with isolation
   - Update exports and internal references

2. **`packages/effect/src/index.ts`**
   - Export both `atomic` and `transaction`
   - Remove old `transaction` export, add new ones

3. **Test Files**
   - `packages/effect/test/Effect.test.ts` - Add transaction isolation tests
   - Update existing transaction tests to use `atomic`

4. **Documentation**
   - Update JSDoc comments throughout
   - Create examples showing differences

### Breaking Changes Assessment

**This is a BREAKING CHANGE because:**
- Existing `Effect.transaction` usage will have different semantics
- Nested transaction behavior changes significantly
- Performance characteristics may differ

**Migration Strategy:**
1. Rename all existing `Effect.transaction` to `Effect.atomic` (preserve behavior)
2. Introduce new `Effect.transaction` with isolated semantics
3. Provide clear migration guide
4. Consider deprecation period with warnings

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
1. **Backward Compatibility** - Existing code expecting composing behavior
2. **Performance Impact** - Isolated transactions may have overhead
3. **Complex Nested Scenarios** - Edge cases with deep nesting

### Mitigation Strategies
1. **Comprehensive Testing** - Cover all edge cases thoroughly
2. **Gradual Migration** - Provide clear migration path
3. **Performance Monitoring** - Benchmark before and after changes
4. **Documentation** - Clear examples of when to use each approach

## Success Criteria

1. **Functional Requirements**
   - `Effect.atomic` maintains exact current behavior
   - `Effect.transaction` provides true isolation
   - All existing tests pass with `atomic` substitution
   - New tests verify isolation behavior

2. **Performance Requirements**
   - No regression in `atomic` performance
   - `transaction` overhead documented and acceptable
   - Memory usage remains reasonable

3. **Documentation Requirements**
   - Clear differentiation between `atomic` and `transaction`
   - Migration guide for existing code
   - Comprehensive examples for both use cases

## Approval Request

This plan outlines a significant refactor that changes fundamental transaction semantics in the Effect library. The approach prioritizes:

1. **Backward Compatibility** through the `atomic` rename
2. **Clear Semantics** with isolated `transaction` behavior  
3. **Comprehensive Testing** to ensure reliability
4. **Thorough Documentation** for proper usage

**Request for approval to proceed with implementation following this plan.**