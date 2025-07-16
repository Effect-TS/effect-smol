# TxChunk Implementation Plan & Context

## Overview

TxChunk is a transactional chunk data structure that provides Software Transactional Memory (STM) semantics for chunk operations. It uses a `TxRef<Chunk<A>>` internally to ensure all operations are performed atomically within transactions.

## Key Implementation Details

### Architecture
- **Backing Store**: Uses `TxRef<Chunk<A>>` internally for STM semantics
- **Transaction Integration**: Seamless integration with Effect.transaction
- **Type System**: Proper variance (`in out A`) with type-safe operations
- **Performance**: Leverages Chunk's structural sharing for efficiency

### Transactional Usage Guidelines

**Key Principle:** TxChunk operations are inherently transactional. They automatically compose when executed within a transaction and act as individual transactions when not explicitly grouped.

**Avoid Redundant Transactions:**
- ❌ `yield* Effect.transaction(TxChunk.get(txChunk))` - Unnecessary for single reads
- ✅ `yield* TxChunk.get(txChunk)` - Direct operation, automatically transactional
- ❌ `yield* Effect.transaction(TxChunk.append(txChunk, 4))` - Unnecessary for single updates
- ✅ `yield* TxChunk.append(txChunk, 4)` - Direct operation, automatically transactional

**Use Effect.transaction Only For:**
- **Atomic multi-step operations** - Multiple TxChunk operations that must happen atomically
- **Cross-TxChunk operations** - Operations involving multiple TxChunk instances
- **Mixed transactional operations** - Combining TxChunk with TxRef or other STM primitives

### API Surface (21 functions)

#### Constructors (4)
- `make<A>(initial: Chunk<A>): Effect<TxChunk<A>>`
- `empty<A>(): Effect<TxChunk<A>>`
- `fromIterable<A>(iterable: Iterable<A>): Effect<TxChunk<A>>`
- `unsafeMake<A>(ref: TxRef<Chunk<A>>): TxChunk<A>`

#### Core Operations (4)
- `get<A>(self: TxChunk<A>): Effect<Chunk<A>>`
- `set<A>(self: TxChunk<A>, chunk: Chunk<A>): Effect<void>`
- `modify<A, R>(self: TxChunk<A>, f: (current: Chunk<A>) => [R, Chunk<A>]): Effect<R>`
- `update<A>(self: TxChunk<A>, f: (current: Chunk<A>) => Chunk<A>): Effect<void>`

#### Element Operations (5)
- `append<A>(self: TxChunk<A>, element: A): Effect<void>`
- `prepend<A>(self: TxChunk<A>, element: A): Effect<void>`
- `size<A>(self: TxChunk<A>): Effect<number>`
- `isEmpty<A>(self: TxChunk<A>): Effect<boolean>`
- `isNonEmpty<A>(self: TxChunk<A>): Effect<boolean>`

#### Advanced Operations (8)
- `take<A>(self: TxChunk<A>, n: number): Effect<void>`
- `drop<A>(self: TxChunk<A>, n: number): Effect<void>`
- `slice<A>(self: TxChunk<A>, start: number, end: number): Effect<void>`
- `map<A>(self: TxChunk<A>, f: (a: A) => A): Effect<void>`
- `filter<A>(self: TxChunk<A>, predicate: (a: A) => boolean): Effect<void>`
- `appendAll<A>(self: TxChunk<A>, other: Chunk<A>): Effect<void>`
- `prependAll<A>(self: TxChunk<A>, other: Chunk<A>): Effect<void>`
- `concat<A>(self: TxChunk<A>, other: TxChunk<A>): Effect<void>`

### Implementation Pattern

```typescript
export interface TxChunk<in out A> extends Inspectable, Pipeable {
  readonly [TypeId]: TypeId
  readonly ref: TxRef.TxRef<Chunk.Chunk<A>>
}

// Example usage showing transactional semantics
const program = Effect.gen(function* () {
  // Create a TxChunk
  const txChunk = yield* TxChunk.fromIterable([1, 2, 3])

  // Single operations - no explicit transaction needed
  yield* TxChunk.append(txChunk, 4)
  const result = yield* TxChunk.get(txChunk)
  console.log(Chunk.toReadonlyArray(result)) // [1, 2, 3, 4]

  // Multi-step atomic operation - use explicit transaction
  yield* Effect.transaction(
    Effect.gen(function* () {
      yield* TxChunk.append(txChunk, 5)
      yield* TxChunk.prepend(txChunk, 0)
      const size = yield* TxChunk.size(txChunk)
      if (size > 5) yield* TxChunk.take(txChunk, 5)
    })
  )
})
```

## Development Workflow

### Validation Checklist
- `pnpm check` - Type checking passes
- `pnpm test TxChunk` - All tests pass  
- `pnpm lint --fix` - Linting passes with auto-fixes
- `pnpm docgen` - Documentation examples compile
- `node scripts/analyze-jsdoc.mjs --file=TxChunk.ts` - Verify documentation coverage
- `pnpm build` - Build succeeds

### Documentation Standards

All TxChunk exports must have:
- **@example tags** with working, practical code examples
- **@category tags** using appropriate categories:
  - `constructors` - make(), empty(), fromIterable(), unsafeMake()
  - `combinators` - modify(), update(), get(), set(), append(), etc.
  - `models` - TxChunk interface and types
  - `symbols` - TypeId and type identifiers

### Example Quality Standards
- **Compiles successfully** - No TypeScript errors in `pnpm docgen`
- **Proper imports** - All dependencies imported correctly
- **Realistic scenarios** - Shows actual use cases, not just API syntax
- **Effect patterns** - Uses Effect.gen, proper error handling, STM semantics
- **Clear explanations** - Comments explain what and why
- **Type safety** - No `any` types or unsafe assertions
- **Efficient transaction usage** - Avoid redundant Effect.transaction calls

## File Structure

```
packages/effect/src/
├── TxChunk.ts           # Main implementation
└── index.ts             # Export addition

packages/effect/test/
└── TxChunk.test.ts      # Comprehensive test suite
```

## Type Safety Patterns

**NoInfer Usage**: Apply NoInfer directly to generic type parameters, not full types:
- ✅ Correct: `Chunk.Chunk<NoInfer<A>>`
- ❌ Incorrect: `NoInfer<Chunk.Chunk<A>>`

## Technical Considerations

### Performance
- Leverage Chunk's structural sharing for efficient operations
- Minimize object allocations in transaction paths
- Use efficient journal lookup patterns

### Concurrency
- Follow established TxRef patterns for conflict detection
- Ensure proper version tracking and pending notifications
- Support retry semantics for failed transactions

### API Design
- Maintain consistency with existing Effect patterns
- Support both data-first and data-last function forms
- Implement Pipeable interface for method chaining
- Follow TypeScript best practices for type safety

## Success Criteria

1. **Functional**: All operations work correctly in transactional contexts
2. **Performance**: Comparable performance to direct Chunk operations
3. **Concurrent**: Proper STM semantics under concurrent access
4. **Tested**: Comprehensive test coverage with edge cases
5. **Documented**: Complete JSDoc with working examples
6. **Integrated**: Seamless integration with existing Effect patterns

## Implementation Status: ✅ Complete

TxChunk is production-ready and provides a robust, type-safe, high-performance transactional chunk data structure for the Effect ecosystem. It maintains all STM guarantees while providing a familiar, chunk-like API that Effect developers can easily adopt.

**Final Statistics:**
- **Files Created**: 2 (TxChunk.ts, TxChunk.test.ts)
- **Files Modified**: 1 (index.ts for exports)
- **Test Coverage**: 24 comprehensive tests passing
- **Documentation**: Complete JSDoc with working examples
- **Validation**: All automated checks passing