# TxHashMap Implementation Plan & Context - UPDATED

## Overview

TxHashMap is a transactional hash map data structure that provides atomic operations on key-value pairs within Effect transactions. **UPDATED**: Now uses a `TxRef<HashMap<K, V>>` internally to leverage the newly available immutable HashMap module, ensuring all operations are performed atomically within transactions while benefiting from HashMap's HAMT-based structural sharing.

## Key Implementation Details

### Architecture - UPDATED
- **Backing Store**: Uses `TxRef<HashMap<K, V>>` internally for transactional semantics (changed from MutableHashMap)
- **Immutable Foundation**: Leverages the new HashMap module with HAMT data structure
- **Transaction Integration**: Seamless integration with Effect.transaction
- **Type System**: Proper variance (`TxHashMap<in out K, in out V>`) with type-safe operations
- **Performance**: Benefits from HashMap's O(1) operations and structural sharing

### Transactional Usage Guidelines

**Key Principle:** TxHashMap operations are inherently transactional. They automatically compose when executed within a transaction and act as individual transactions when not explicitly grouped.

**Avoid Redundant Transactions:**
- ❌ `yield* Effect.transaction(TxHashMap.get(map, key))` - Unnecessary for single reads
- ✅ `yield* TxHashMap.get(map, key)` - Direct operation, automatically transactional
- ❌ `yield* Effect.transaction(TxHashMap.set(map, key, value))` - Unnecessary for single updates
- ✅ `yield* TxHashMap.set(map, key, value)` - Direct operation, automatically transactional

**Use Effect.transaction Only For:**
- **Atomic multi-step operations** - Multiple TxHashMap operations that must happen atomically
- **Cross-TxHashMap operations** - Operations involving multiple TxHashMap instances
- **Mixed transactional operations** - Combining TxHashMap with TxRef or other transactional primitives

### API Surface (Proposed ~20 functions) - UPDATED

#### Constructors (3)
- `empty<K, V>(): Effect<TxHashMap<K, V>>`
- `make<K, V>(...entries: Array<readonly [K, V]>): Effect<TxHashMap<K, V>>`
- `fromIterable<K, V>(entries: Iterable<readonly [K, V]>): Effect<TxHashMap<K, V>>`

#### Core Operations (5)
- `get<K, V>(self: TxHashMap<K, V>, key: K): Effect<Option<V>>`
- `set<K, V>(self: TxHashMap<K, V>, key: K, value: V): Effect<void>`
- `has<K, V>(self: TxHashMap<K, V>, key: K): Effect<boolean>`
- `remove<K, V>(self: TxHashMap<K, V>, key: K): Effect<boolean>`
- `clear<K, V>(self: TxHashMap<K, V>): Effect<void>`

#### Query Operations (3)
- `size<K, V>(self: TxHashMap<K, V>): Effect<number>`
- `isEmpty<K, V>(self: TxHashMap<K, V>): Effect<boolean>`
- `isNonEmpty<K, V>(self: TxHashMap<K, V>): Effect<boolean>`

#### Advanced Operations (6) - EXPANDED
- `modify<K, V>(self: TxHashMap<K, V>, key: K, f: (value: V) => V): Effect<Option<V>>`
- `modifyAt<K, V>(self: TxHashMap<K, V>, key: K, f: (opt: Option<V>) => Option<V>): Effect<void>`
- `keys<K, V>(self: TxHashMap<K, V>): Effect<Array<K>>`
- `values<K, V>(self: TxHashMap<K, V>): Effect<Array<V>>`
- `entries<K, V>(self: TxHashMap<K, V>): Effect<Array<[K, V]>>`
- `snapshot<K, V>(self: TxHashMap<K, V>): Effect<HashMap<K, V>>`

#### Bulk Operations (3) - UPDATED
- `union<K, V>(self: TxHashMap<K, V>, other: HashMap<K, V>): Effect<void>`
- `removeMany<K, V>(self: TxHashMap<K, V>, keys: Iterable<K>): Effect<void>`
- `setMany<K, V>(self: TxHashMap<K, V>, entries: Iterable<readonly [K, V]>): Effect<void>`

### Implementation Pattern - UPDATED

```typescript
export interface TxHashMap<in out K, in out V> extends Inspectable, Pipeable {
  readonly [TypeId]: TypeId
  readonly ref: TxRef.TxRef<HashMap.HashMap<K, V>>
}

// Example usage showing transactional semantics with immutable HashMap
const program = Effect.gen(function* () {
  // Create a transactional hash map
  const txMap = yield* TxHashMap.make(["key1", "value1"], ["key2", "value2"])

  // Single operations - no explicit transaction needed
  yield* TxHashMap.set(txMap, "key3", "value3")
  const value = yield* TxHashMap.get(txMap, "key1")
  console.log(value) // Some("value1")

  // Multi-step atomic operation - use explicit transaction
  yield* Effect.transaction(
    Effect.gen(function* () {
      const oldValue = yield* TxHashMap.get(txMap, "key1")
      if (Option.isSome(oldValue)) {
        yield* TxHashMap.set(txMap, "key1", oldValue.value + "_updated")
        yield* TxHashMap.remove(txMap, "key2")
      }
    })
  )

  // Get immutable snapshot of current state
  const snapshot = yield* TxHashMap.snapshot(txMap)
  console.log(HashMap.size(snapshot)) // 2
})
```

## Development Workflow

### Git Flow Strategy

Following the proven TxChunk implementation approach:

#### **Branch Management**
1. **Feature Branch**: `feature/txhashmap` 
   - Branch from `main` (already rebased with HashMap module)
   - All TxHashMap development work
   - Regular commits with incremental progress
   - Push to remote for backup and collaboration

2. **Pull Request Workflow**
   - Create PR early for visibility and feedback
   - Update PR description as implementation progresses
   - Use draft status during development
   - Mark ready for review when complete

#### **Commit Strategy**
```bash
# Phase-based commits following TxChunk pattern
git commit -m "feat: implement TxHashMap core structure and basic constructors

- Add TypeId and TxHashMap interface definition
- Implement empty(), make(), fromIterable() constructors
- Add TxRef<HashMap<K,V>> backing store integration
- Set up dual signature patterns for data-first/data-last
- Add to index.ts exports

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### **Commit Sequence Plan**
1. **Updated Plan Documentation**: Update TxHashMap plan to use HashMap backing store
2. **Initial Setup**: Core structure, TypeId, basic constructors using HashMap
3. **Core Operations**: get, set, has, remove, clear with HashMap operations
4. **Query Operations**: size, isEmpty, isNonEmpty with validation
5. **Advanced Operations**: modify, modifyAt, keys, values, entries, snapshot
6. **Bulk Operations**: union, removeMany, setMany with HashMap operations
7. **Documentation**: Complete JSDoc coverage with working examples
8. **Final Polish**: Consolidation, cleanup, and context documentation

#### **Validation Before Each Commit**
```bash
# Pre-commit validation sequence
pnpm check                                           # Type checking
pnpm test TxHashMap                                 # Tests pass
pnpm lint --fix packages/effect/src/TxHashMap.ts   # Linting
pnpm docgen                                         # Examples compile
pnpm build                                          # Build succeeds
```

#### **PR Management**
- **Title Pattern**: `feat: implement TxHashMap transactional hash map data structure`
- **Description Updates**: Reflect progress and completed features
- **Incremental Reviews**: Allow for feedback during development
- **Merge Strategy**: Squash and merge when complete

### Validation Checklist
- `pnpm check` - Type checking passes
- `pnpm test TxHashMap` - All tests pass  
- `pnpm lint --fix` - Linting passes with auto-fixes
- `pnpm docgen` - Documentation examples compile
- `node scripts/analyze-jsdoc.mjs --file=TxHashMap.ts` - Verify documentation coverage
- `pnpm build` - Build succeeds

### Documentation Standards

All TxHashMap exports must have:
- **@example tags** with working, practical code examples
- **@category tags** using appropriate categories:
  - `constructors` - empty(), make(), fromIterable()
  - `combinators` - get(), set(), has(), remove(), clear(), modify(), etc.
  - `models` - TxHashMap interface and types
  - `symbols` - TypeId and type identifiers

### Example Quality Standards
- **Compiles successfully** - No TypeScript errors in `pnpm docgen`
- **Proper imports** - All dependencies imported correctly including HashMap
- **Realistic scenarios** - Shows actual use cases, not just API syntax
- **Effect patterns** - Uses Effect.gen, proper error handling, transactional semantics
- **Clear explanations** - Comments explain what and why
- **Type safety** - No `any` types or unsafe assertions
- **Efficient transaction usage** - Avoid redundant Effect.transaction calls
- **HashMap integration** - Show proper use of immutable HashMap operations

## File Structure

```
packages/effect/src/
├── TxHashMap.ts         # Main implementation (uses HashMap)
└── index.ts             # Export addition

packages/effect/test/
└── TxHashMap.test.ts    # Comprehensive test suite
```

## Type Safety Patterns - UPDATED

**HashMap Integration**: Leverage HashMap types and operations:
- ✅ Correct: `HashMap.HashMap<NoInfer<K>, NoInfer<V>>`
- ✅ Use HashMap operations: `HashMap.set(map, key, value)`
- ✅ Leverage HashMap type extractors: `HashMap.Key<T>`, `HashMap.Value<T>`

**NoInfer Usage**: Apply NoInfer directly to generic type parameters:
- ✅ Correct: `HashMap.HashMap<NoInfer<K>, NoInfer<V>>`
- ❌ Incorrect: `NoInfer<HashMap.HashMap<K, V>>`

**Equal.Equal Constraints**: For structural equality keys:
- Keys should extend `Equal.Equal` when using structural comparison
- Leverage HashMap's HAMT structure for efficient structural sharing

## Technical Considerations - UPDATED

### Performance
- Leverage HashMap's O(1) operations and HAMT structural sharing
- Benefit from immutable data structure performance characteristics
- Use efficient HashMap operations for bulk updates
- Maintain HashMap's performance advantages in transactional context

### Concurrency
- Follow established TxRef patterns for conflict detection
- Ensure proper version tracking and pending notifications
- Support retry semantics for failed transactions
- Handle concurrent modifications with HashMap's immutable semantics

### API Design
- Maintain consistency with existing Effect patterns
- Support both data-first and data-last function forms
- Implement Pipeable interface for method chaining
- Follow TypeScript best practices for type safety
- Mirror HashMap API where appropriate while adding transactional semantics

### Key Advantages of HashMap Backing Store
- **Immutable by design**: No risk of accidental mutations
- **Structural sharing**: Memory efficient for large maps
- **HAMT performance**: O(1) operations with excellent real-world performance
- **Type safety**: Leverages HashMap's mature type system
- **API consistency**: Familiar HashMap operations in transactional context

## Implementation Phases - UPDATED

### Phase 1: Core Implementation
1. Update plan to reflect HashMap backing store
2. Create TxHashMap.ts with TypeId and basic structure using TxRef<HashMap<K,V>>
3. Implement constructor functions (empty, make, fromIterable) using HashMap constructors
4. Implement core CRUD operations (get, set, has, remove, clear) using HashMap operations
5. Add to index.ts exports

### Phase 2: Advanced Operations
1. Implement query operations (size, isEmpty, isNonEmpty) using HashMap queries
2. Implement modification operations (modify, modifyAt) with HashMap updates
3. Implement extraction operations (keys, values, entries) using HashMap extractors
4. Add snapshot operation to get immutable HashMap copy
5. Add comprehensive dual signature support

### Phase 3: Bulk Operations
1. Implement bulk operations (union, removeMany, setMany) using HashMap bulk operations
2. Optimize performance for bulk operations with HashMap's efficient operations
3. Ensure transactional consistency across bulk operations

### Phase 4: Testing & Documentation
1. Create comprehensive test suite covering all operations with HashMap
2. Test concurrent access scenarios and conflict resolution
3. Test with both referential and structural equality keys using HashMap
4. Add complete JSDoc documentation with working examples
5. Validate with all automated checks

## Success Criteria - UPDATED

1. **Functional**: All operations work correctly in transactional contexts with HashMap
2. **Performance**: Comparable or better performance than MutableHashMap due to structural sharing
3. **Concurrent**: Proper transactional semantics under concurrent access
4. **Key Types**: Support both referential and structural equality keys via HashMap
5. **Tested**: Comprehensive test coverage with edge cases
6. **Documented**: Complete JSDoc with working examples showing HashMap integration
7. **Integrated**: Seamless integration with existing Effect patterns and HashMap module

## Risk Assessment - UPDATED

### Low Risk
- Following proven patterns from TxChunk and TxRef
- Using battle-tested HashMap as backing store (newly available)
- Established transactional infrastructure
- Immutable HashMap eliminates mutation-related bugs

### Medium Risk
- Dual type parameters add complexity
- Key equality semantics require careful handling (mitigated by HashMap)
- Performance optimization for bulk operations
- API surface coordination with HashMap module

### Mitigation Strategies
- Start with minimal viable implementation (Phase 1)
- Extensively test key equality scenarios using HashMap patterns
- Benchmark against HashMap performance directly
- Follow TxChunk patterns for transactional semantics
- Leverage HashMap's mature implementation for reliability

## Implementation Status: 📋 Ready for Approval

The plan has been updated to leverage the newly available HashMap module as the backing store instead of MutableHashMap. This provides significant advantages:

- **Immutable by design** - Eliminates mutation-related bugs
- **Structural sharing** - Better memory efficiency 
- **Proven performance** - HashMap's HAMT implementation is battle-tested
- **Type safety** - Leverages HashMap's mature type system
- **API consistency** - Familiar HashMap operations in transactional context

**Updated Statistics:**
- **Files to Create**: 2 (TxHashMap.ts, TxHashMap.test.ts)
- **Files to Modify**: 1 (index.ts for exports)
- **Estimated API Surface**: ~20 functions across 5 categories (expanded)
- **Test Coverage Target**: 35+ comprehensive tests
- **Documentation**: Complete JSDoc with working examples showing HashMap integration
- **Dependencies**: HashMap module (now available), TxRef, Effect.transaction

**Ready for implementation approval.** The updated plan leverages lessons learned from TxChunk while taking advantage of the new HashMap module for a more robust and performant implementation.