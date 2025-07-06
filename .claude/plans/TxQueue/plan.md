# TxQueue Implementation Plan

## Overview
Port the TQueue module from the main Effect repository to create a new TxQueue module for the effect-smol repository. TxQueue will be a transactional queue data structure providing Software Transactional Memory (STM) semantics for queue operations, consistent with the existing TxHashMap and TxChunk patterns.

## Source Analysis
**Source**: https://github.com/Effect-TS/effect/blob/main/packages/effect/src/TQueue.ts

The original TQueue provides:
- Transactional queue operations using STM semantics
- Multiple queue strategies (bounded, unbounded, dropping, sliding)
- Type-safe generics with variance annotations
- Functional API with curried and non-curried forms
- Atomic operations for concurrent access

## Goals
1. **API Consistency**: Match the local conventions used in TxHashMap and TxChunk
2. **Transaction Semantics**: Use Effect.Effect instead of STM.STM for local patterns
3. **Documentation Standards**: Include mutation vs return behavior documentation
4. **Type Safety**: Maintain type safety and variance annotations where appropriate
5. **Testing**: Comprehensive test coverage following local patterns

## Implementation Strategy

### Phase 1: Core Structure and Types
**Estimated Time**: 2-3 hours

#### 1.1 Basic Types and Interfaces
- [ ] Define `TypeId` constant and type: `export const TypeId: TypeId = "~effect/TxQueue"`
- [ ] Create main `TxQueue<A>` interface extending Inspectable and Pipeable  
- [ ] Add `readonly [TypeId]: TypeId` property to interface
- [ ] Create `TxQueue` namespace with type utilities (like TxHashMap.TxHashMap.Value)
- [ ] Use `@since 4.0.0` annotation for consistency with TxChunk (not 2.0.0 like TxHashMap)

#### 1.2 Queue Strategy Types
- [ ] Define strategy enum: `"bounded" | "unbounded" | "dropping" | "sliding"`
- [ ] Create strategy configuration interfaces
- [ ] Define capacity constraints and behavior patterns

#### 1.3 Internal Data Structure and Prototype
- [ ] Create `TxQueueProto` object with:
  - `[TypeId]: TypeId`
  - `[NodeInspectSymbol]` inspection method
  - `toJSON()` method
  - `toString()` method  
  - `pipe()` method using `pipeArguments`
- [ ] Design internal representation using `TxRef<Chunk.Chunk<A>>` for queue storage
- [ ] Add strategy and capacity tracking with additional TxRefs

### Phase 2: Constructor Functions
**Estimated Time**: 2-3 hours

#### 2.1 Core Constructors (following TxHashMap.empty pattern)
- [ ] `bounded<A = never>(capacity: number): Effect.Effect<TxQueue<A>>`
- [ ] `unbounded<A = never>(): Effect.Effect<TxQueue<A>>`  
- [ ] `dropping<A = never>(capacity: number): Effect.Effect<TxQueue<A>>`
- [ ] `sliding<A = never>(capacity: number): Effect.Effect<TxQueue<A>>`

#### 2.2 Factory Functions (following TxHashMap.make pattern)
- [ ] `make<A>(...items: Array<A>): Effect.Effect<TxQueue<A>>` - Create with initial items
- [ ] `fromIterable<A>(iterable: Iterable<A>): Effect.Effect<TxQueue<A>>` - Create from iterable

#### 2.3 Implementation Pattern
- [ ] Use `Effect.gen` with `TxRef.make` to create internal refs
- [ ] Use `Object.assign(Object.create(TxQueueProto), { /* properties */ })` pattern
- [ ] Store queue items, strategy type, capacity, and shutdown state in separate TxRefs

**Documentation**: Add **Return behavior** documentation to all constructors

### Phase 3: Core Queue Operations
**Estimated Time**: 3-4 hours

#### 3.1 Enqueue Operations (Mutation Functions - following TxHashMap.set pattern)
- [ ] `offer: { <A>(value: A): (self: TxQueue<A>) => Effect.Effect<boolean>; <A>(self: TxQueue<A>, value: A): Effect.Effect<boolean> }`
- [ ] `offerAll: { <A>(values: Iterable<A>): (self: TxQueue<A>) => Effect.Effect<boolean>; <A>(self: TxQueue<A>, values: Iterable<A>): Effect.Effect<boolean> }`
- [ ] Use `dual(2, ...)` for curried implementations
- [ ] Handle strategy-specific behavior (blocking, dropping, sliding)

#### 3.2 Dequeue Operations (Mutation Functions - following TxChunk.take pattern)  
- [ ] `take<A>(self: TxQueue<A>): Effect.Effect<A>` - Remove and return (blocks if empty, uses Effect.retryTransaction)
- [ ] `poll<A>(self: TxQueue<A>): Effect.Effect<Option.Option<A>>` - Try remove, non-blocking
- [ ] `takeAll<A>(self: TxQueue<A>): Effect.Effect<Chunk.Chunk<A>>` - Remove all items
- [ ] Use TxRef.modify for atomic updates

#### 3.3 Inspection Operations (Observer Functions - following TxHashMap.size pattern)
- [ ] `peek<A>(self: TxQueue<A>): Effect.Effect<A>` - View next without removing (blocks if empty)
- [ ] `size<A>(self: TxQueue<A>): Effect.Effect<number>` - Current queue size
- [ ] `isEmpty<A>(self: TxQueue<A>): Effect.Effect<boolean>` - Check if empty  
- [ ] `isFull<A>(self: TxQueue<A>): Effect.Effect<boolean>` - Check if at capacity
- [ ] `capacity<A>(self: TxQueue<A>): Effect.Effect<number>` - Get max capacity (read from TxRef)

**Documentation**: Add appropriate **Mutation behavior** vs **Observer behavior** documentation

### Phase 4: Advanced Operations
**Estimated Time**: 2-3 hours

#### 4.1 Batch Operations
- [ ] `takeN<A>(self: TxQueue<A>, n: number): Effect.Effect<Chunk.Chunk<A>>`
- [ ] `takeWhile<A>(self: TxQueue<A>, predicate: (a: A) => boolean): Effect.Effect<Chunk.Chunk<A>>`
- [ ] `offerIfNotFull<A>(self: TxQueue<A>, value: A): Effect.Effect<boolean>`

#### 4.2 Strategy-Specific Behavior
- [ ] Implement dropping behavior (reject new items when full)
- [ ] Implement sliding behavior (evict old items when full)
- [ ] Handle back-pressure for bounded queues
- [ ] Ensure unbounded queues never block on offer

#### 4.3 Utility Functions
- [ ] `awaitShutdown<A>(self: TxQueue<A>): Effect.Effect<void>` - Wait for empty
- [ ] `shutdown<A>(self: TxQueue<A>): Effect.Effect<void>` - Mark as closed
- [ ] `isShutdown<A>(self: TxQueue<A>): Effect.Effect<boolean>` - Check shutdown status

### Phase 5: Testing and Validation
**Estimated Time**: 3-4 hours

#### 5.1 Unit Tests
- [ ] Constructor tests for all queue types
- [ ] Basic enqueue/dequeue operations
- [ ] Capacity and overflow behavior
- [ ] Strategy-specific behavior (dropping, sliding)
- [ ] Edge cases (empty queue, full queue)

#### 5.2 Transaction Tests
- [ ] Multi-step atomic operations
- [ ] Concurrent access patterns
- [ ] Retry and conflict detection
- [ ] Transaction rollback scenarios

#### 5.3 Performance Tests
- [ ] High-throughput scenarios
- [ ] Memory usage patterns
- [ ] Queue strategy efficiency

### Phase 6: Documentation and Polish
**Estimated Time**: 2-3 hours

#### 6.1 JSDoc Documentation
- [ ] Comprehensive examples for each function
- [ ] Usage patterns and best practices
- [ ] Transaction context guidance
- [ ] Performance considerations

#### 6.2 Code Quality
- [ ] Lint and format all code
- [ ] Type checking validation
- [ ] Remove any `any` types
- [ ] Ensure consistent error handling

#### 6.3 Integration
- [ ] Export from main effect module
- [ ] Update package documentation
- [ ] Verify no breaking changes

## Technical Considerations

### 1. Transaction Semantics
- **Use Effect.Effect instead of STM.STM** to match local patterns
- **Leverage TxRef** for transactional state management
- **Support Effect.transaction** for multi-step operations
- **Handle retry logic** for blocking operations

### 2. Queue Strategies Implementation (simplified, no methods)
```typescript
interface QueueStrategy {
  readonly type: "bounded" | "unbounded" | "dropping" | "sliding"
  readonly capacity?: number
}
```

### 3. Internal Structure (following TxHashMap pattern)
```typescript
// Main interface  
export interface TxQueue<A> extends Inspectable, Pipeable {
  readonly [TypeId]: TypeId
  readonly itemsRef: TxRef.TxRef<Chunk.Chunk<A>>
  readonly strategyRef: TxRef.TxRef<QueueStrategy>
  readonly shutdownRef: TxRef.TxRef<boolean>
}

// Prototype object (following TxHashMapProto pattern)
const TxQueueProto = {
  [TypeId]: TypeId,
  [NodeInspectSymbol](this: TxQueue<unknown>) {
    return toJSON(this)
  },
  toJSON(this: TxQueue<unknown>) {
    return {
      _id: "TxQueue",
      itemsRef: toJSON((this as any).itemsRef),
      strategyRef: toJSON((this as any).strategyRef),
      shutdownRef: toJSON((this as any).shutdownRef)
    }
  },
  toString(this: TxQueue<unknown>) {
    return format(this.toJSON())
  },
  pipe(this: TxQueue<unknown>) {
    return pipeArguments(this, arguments)
  }
}
```

### 4. Error Handling
- **Empty queue operations**: Use retry semantics for blocking operations
- **Capacity violations**: Handle according to strategy
- **Shutdown state**: Reject operations on closed queues
- **Type safety**: Prevent runtime errors through strong typing

### 5. Performance Optimization
- **Minimize allocations** in hot paths
- **Efficient chunk operations** for batch processing
- **Strategy-specific optimizations** for different use cases
- **Memory-conscious** implementation for large queues

## API Design Examples

### Constructor API
```typescript
// Bounded queue with back-pressure
const boundedQueue = yield* TxQueue.bounded<number>(10)

// Dropping queue (rejects new items when full)
const droppingQueue = yield* TxQueue.dropping<string>(5)

// Sliding queue (evicts old items when full)
const slidingQueue = yield* TxQueue.sliding<Task>(3)

// Unbounded queue (limited only by memory)
const unboundedQueue = yield* TxQueue.unbounded<Event>()
```

### Basic Operations API
```typescript
// Enqueue operations (mutation behavior)
yield* TxQueue.offer(queue, item)           // Add single item
yield* TxQueue.offerAll(queue, [1, 2, 3])   // Add multiple items

// Dequeue operations (mutation behavior)
const item = yield* TxQueue.take(queue)      // Remove item (blocks if empty)
const maybe = yield* TxQueue.poll(queue)     // Try remove (non-blocking)
const all = yield* TxQueue.takeAll(queue)    // Remove all items

// Inspection operations (observer behavior)
const next = yield* TxQueue.peek(queue)      // View next item
const size = yield* TxQueue.size(queue)      // Current size
const empty = yield* TxQueue.isEmpty(queue)  // Check if empty
```

### Transaction API
```typescript
// Multi-step atomic operations
yield* Effect.transaction(
  Effect.gen(function* () {
    const item1 = yield* TxQueue.take(inputQueue)
    const item2 = yield* TxQueue.take(inputQueue)
    const result = processItems(item1, item2)
    yield* TxQueue.offer(outputQueue, result)
  })
)
```

## Success Criteria
1. **✅ Full API compatibility** with TQueue patterns adapted to local conventions
2. **✅ Comprehensive test coverage** with all scenarios covered
3. **✅ Type safety** with no `any` types and proper variance
4. **✅ Performance** comparable to other Tx data structures
5. **✅ Documentation** following established mutation/return behavior patterns
6. **✅ Integration** seamlessly with existing Effect patterns

## Dependencies
- **TxRef**: For transactional state management
- **Chunk**: For efficient item storage
- **Effect**: For effect management and transactions
- **Option**: For optional return values
- **Function**: For dual signatures

## Risks and Mitigation
1. **Complexity of queue strategies**: Start with simple bounded/unbounded, add strategies incrementally
2. **Transaction semantics**: Follow TxHashMap/TxChunk patterns closely
3. **Performance concerns**: Profile and optimize after basic functionality
4. **API surface size**: Implement core operations first, add utilities later

## Next Steps
1. Create feature branch ✅
2. Start with Phase 1: Core Structure and Types
3. Implement incrementally with tests for each phase
4. Regular validation against existing Tx patterns
5. Code review and iteration before final PR

---
**Total Estimated Time**: 14-20 hours across 6 phases
**Target Completion**: 2-3 development sessions
**Review Points**: After Phase 2, Phase 4, and Phase 6