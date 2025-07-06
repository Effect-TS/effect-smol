# TxHashMap Implementation Plan & Context

## Overview

TxHashMap is a transactional hash map data structure that provides atomic operations on key-value pairs within Effect transactions. It uses a `TxRef<MutableHashMap<K, V>>` internally to ensure all operations are performed atomically within transactions.

## Key Implementation Details

### Architecture
- **Backing Store**: Uses `TxRef<MutableHashMap<K, V>>` internally for transactional semantics
- **Transaction Integration**: Seamless integration with Effect.transaction
- **Type System**: Proper variance (`TxHashMap<in out K, in out V>`) with type-safe operations
- **Performance**: Leverages MutableHashMap's O(1) operations and hybrid storage strategy

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

### API Surface (Proposed ~18 functions)

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

#### Advanced Operations (4)
- `modify<K, V>(self: TxHashMap<K, V>, key: K, f: (value: V) => V): Effect<Option<V>>`
- `modifyAt<K, V>(self: TxHashMap<K, V>, key: K, f: (opt: Option<V>) => Option<V>): Effect<void>`
- `keys<K, V>(self: TxHashMap<K, V>): Effect<Array<K>>`
- `values<K, V>(self: TxHashMap<K, V>): Effect<Array<V>>`

#### Bulk Operations (3)
- `union<K, V>(self: TxHashMap<K, V>, other: MutableHashMap<K, V>): Effect<void>`
- `intersect<K, V>(self: TxHashMap<K, V>, other: MutableHashMap<K, V>): Effect<void>`
- `difference<K, V>(self: TxHashMap<K, V>, other: MutableHashMap<K, V>): Effect<void>`

### Implementation Pattern

```typescript
export interface TxHashMap<in out K, in out V> extends Inspectable, Pipeable {
  readonly [TypeId]: TypeId
  readonly ref: TxRef.TxRef<MutableHashMap.MutableHashMap<K, V>>
}

// Example usage showing transactional semantics
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

  const finalSize = yield* TxHashMap.size(txMap)
  console.log(finalSize) // 2
})
```

## Development Workflow

### Git Flow Strategy

Following the proven TxChunk implementation approach:

#### **Branch Management**
1. **Feature Branch**: `feature/txhashmap` 
   - Branch from `main`
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
- Add basic TxRef backing store integration
- Set up dual signature patterns for data-first/data-last
- Add to index.ts exports

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### **Commit Sequence Plan**
1. **Plan Documentation**: Commit TxHashMap implementation plan and create feature branch
   ```bash
   git add .claude/plans/TxHashMap/plan.md
   git commit -m "docs: add TxHashMap implementation plan with comprehensive design

   - Define TxHashMap as transactional hash map using TxRef<MutableHashMap<K,V>>
   - Plan ~18 functions across constructors, core ops, queries, advanced ops, bulk ops
   - Include git workflow strategy following TxChunk success patterns
   - Document transactional usage guidelines and validation procedures
   - Set up 8-phase implementation approach with quality gates

   🤖 Generated with [Claude Code](https://claude.ai/code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   
   git checkout -b feature/txhashmap
   git push -u origin feature/txhashmap
   ```
2. **Initial Setup**: Core structure, TypeId, basic constructors
3. **Core Operations**: get, set, has, remove, clear with tests
4. **Query Operations**: size, isEmpty, isNonEmpty with validation
5. **Advanced Operations**: modify, modifyAt, keys, values
6. **Bulk Operations**: union, intersect, difference
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
- **Proper imports** - All dependencies imported correctly
- **Realistic scenarios** - Shows actual use cases, not just API syntax
- **Effect patterns** - Uses Effect.gen, proper error handling, transactional semantics
- **Clear explanations** - Comments explain what and why
- **Type safety** - No `any` types or unsafe assertions
- **Efficient transaction usage** - Avoid redundant Effect.transaction calls

## File Structure

```
packages/effect/src/
├── TxHashMap.ts         # Main implementation
└── index.ts             # Export addition

packages/effect/test/
└── TxHashMap.test.ts    # Comprehensive test suite
```

## Type Safety Patterns

**NoInfer Usage**: Apply NoInfer directly to generic type parameters:
- ✅ Correct: `MutableHashMap.MutableHashMap<NoInfer<K>, NoInfer<V>>`
- ❌ Incorrect: `NoInfer<MutableHashMap.MutableHashMap<K, V>>`

**Equal.Equal Constraints**: For structural equality keys:
- Keys should extend `Equal.Equal` when using structural comparison
- Leverage MutableHashMap's hybrid storage strategy (referential vs structural)

## Technical Considerations

### Performance
- Leverage MutableHashMap's O(1) operations and hybrid storage
- Minimize object allocations in transaction paths
- Use efficient journal lookup patterns
- Maintain MutableHashMap's performance characteristics

### Concurrency
- Follow established TxRef patterns for conflict detection
- Ensure proper version tracking and pending notifications
- Support retry semantics for failed transactions
- Handle concurrent modifications to same keys

### API Design
- Maintain consistency with existing Effect patterns
- Support both data-first and data-last function forms
- Implement Pipeable interface for method chaining
- Follow TypeScript best practices for type safety
- Mirror MutableHashMap API where appropriate

### Key Differences from TxChunk
- **Dual type parameters**: `<K, V>` instead of single `<A>`
- **Option returns**: get() returns `Option<V>` instead of direct value
- **Key-based operations**: Operations centered around key-value pairs
- **Structural equality**: Support for Equal.Equal keys with hash buckets
- **Remove operations**: Return boolean indicating success

## Implementation Phases

### Phase 1: Core Implementation
1. Create TxHashMap.ts with TypeId and basic structure
2. Implement constructor functions (empty, make, fromIterable)
3. Implement core CRUD operations (get, set, has, remove, clear)
4. Add to index.ts exports

### Phase 2: Advanced Operations
1. Implement query operations (size, isEmpty, isNonEmpty)
2. Implement modification operations (modify, modifyAt)
3. Implement extraction operations (keys, values)
4. Add comprehensive dual signature support

### Phase 3: Bulk Operations
1. Implement set operations (union, intersect, difference)
2. Optimize performance for bulk operations
3. Ensure transactional consistency across bulk operations

### Phase 4: Testing & Documentation
1. Create comprehensive test suite covering all operations
2. Test concurrent access scenarios and conflict resolution
3. Test with both referential and structural equality keys
4. Add complete JSDoc documentation with working examples
5. Validate with all automated checks

## Success Criteria

1. **Functional**: All operations work correctly in transactional contexts
2. **Performance**: Comparable performance to direct MutableHashMap operations
3. **Concurrent**: Proper transactional semantics under concurrent access
4. **Key Types**: Support both referential and structural equality keys
5. **Tested**: Comprehensive test coverage with edge cases
6. **Documented**: Complete JSDoc with working examples
7. **Integrated**: Seamless integration with existing Effect patterns

## Risk Assessment

### Low Risk
- Following proven patterns from TxChunk and TxRef
- Using battle-tested MutableHashMap as backing store
- Established transactional infrastructure

### Medium Risk
- Dual type parameters add complexity
- Key equality semantics require careful handling
- Performance optimization for bulk operations
- More complex API surface than TxChunk

### Mitigation Strategies
- Start with minimal viable implementation (Phase 1)
- Extensively test key equality scenarios
- Benchmark against MutableHashMap performance
- Follow TxChunk patterns for transactional semantics

## Implementation Status: 📋 Planning

Ready for implementation approval. The plan leverages lessons learned from TxChunk while accounting for the unique challenges of a key-value transactional data structure.

**Proposed Statistics:**
- **Files to Create**: 2 (TxHashMap.ts, TxHashMap.test.ts)
- **Files to Modify**: 1 (index.ts for exports)
- **Estimated API Surface**: ~18 functions across 5 categories
- **Test Coverage Target**: 30+ comprehensive tests
- **Documentation**: Complete JSDoc with working examples