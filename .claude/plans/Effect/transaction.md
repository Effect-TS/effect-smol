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

### Phase 1: Direct Rename and Implementation

1. **Rename Internal Implementation**
   - Rename current `transaction` function to `atomic` 
   - Update internal references and exports
   - Remove any backward compatibility concerns

2. **Implement New Transaction Semantics Immediately**
   - Implement new isolated `transaction` function
   - Force new transaction context even when parent exists
   - No need for gradual migration or deprecation warnings

3. **Update All Internal Usage**
   - Update all existing `Effect.transaction` calls to `Effect.atomic`
   - Ensure transactional data structures use appropriate function
   - Clean up any legacy patterns

### Phase 2: Transaction Isolation Implementation

1. **Create New Transaction Implementation**
   - Implement isolated transaction logic
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

### Phase 3: Complete Codebase Update

1. **Update All Transactional Data Structures**
   - Update TxQueue, TxRef, TxChunk, TxHashMap implementations
   - Replace all `Effect.transaction` with `Effect.atomic` where composing behavior is needed
   - Use new `Effect.transaction` only where isolation is specifically required

2. **Comprehensive Testing**
   - Add comprehensive tests for both behaviors
   - Test nested transaction scenarios
   - Test isolation between parent and child transactions
   - Test conflict resolution between independent transactions
   - Remove any legacy transaction tests

3. **Complete Documentation Overhaul**
   - Rewrite all JSDoc examples using new semantics
   - Document performance implications clearly
   - Provide clear guidance on when to use each approach
   - Remove any legacy documentation references

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

This plan outlines a major version breaking change that fundamentally alters transaction semantics in the Effect library. The approach prioritizes:

1. **Clean Breaking Changes** for major version with no backward compatibility concerns
2. **Clear Semantics** with distinct `atomic` (composing) vs `transaction` (isolated) behavior  
3. **Comprehensive Implementation** updating entire codebase in single release
4. **Complete Documentation** for major version migration

**Request for approval to proceed with implementation following this major version plan.**