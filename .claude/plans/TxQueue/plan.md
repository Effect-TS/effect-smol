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
**🚨 LINT AFTER EVERY CHANGE**: `pnpm lint --fix packages/effect/src/TxQueue.ts`

#### 1.1 Basic Types and Interfaces (following Queue.ts pattern)
- [ ] Define separate TypeIds:
  - `export const DequeueTypeId: DequeueTypeId = "~effect/TxQueue/Dequeue"`
  - `export const TypeId: TypeId = "~effect/TxQueue"`
- [ ] Create `TxDequeue<A>` interface (read-only operations) extending Inspectable
- [ ] Create `TxQueue<A>` interface extending `TxDequeue<A>` (full operations)
- [ ] Add variance interfaces for type safety
- [ ] Create `TxQueue` and `TxDequeue` namespaces with type utilities
- [ ] Use `@since 4.0.0` annotation for consistency

#### 1.2 Queue Strategy Types
- [ ] Define strategy enum: `"bounded" | "unbounded" | "dropping" | "sliding"`
- [ ] Create strategy configuration interfaces
- [ ] Define capacity constraints and behavior patterns

#### 1.3 Internal Data Structure (following Queue.ts pattern)
- [ ] Design internal queue object (no prototype pattern needed):
  - `readonly [TypeId]: TxQueue.Variance<A>`
  - `readonly strategy: "bounded" | "unbounded" | "dropping" | "sliding"`
  - `readonly capacity: number`
  - `readonly itemsRef: TxRef.TxRef<Chunk.Chunk<A>>`
  - `readonly shutdownRef: TxRef.TxRef<boolean>`
- [ ] Add type guards: `isTxQueue(u): u is TxQueue<A>` and `isTxDequeue(u): u is TxDequeue<A>`
- [ ] Implement Inspectable directly in the queue object (no separate prototype)

### Phase 2: Constructor Functions
**Estimated Time**: 2-3 hours
**🚨 LINT AFTER EVERY CHANGE**: `pnpm lint --fix packages/effect/src/TxQueue.ts`

#### 2.1 Core Constructors (following TxHashMap.empty pattern)
- [ ] `bounded<A = never>(capacity: number): Effect.Effect<TxQueue<A>>`
- [ ] `unbounded<A = never>(): Effect.Effect<TxQueue<A>>`  
- [ ] `dropping<A = never>(capacity: number): Effect.Effect<TxQueue<A>>`
- [ ] `sliding<A = never>(capacity: number): Effect.Effect<TxQueue<A>>`

#### 2.2 Factory Functions (following TxHashMap.make pattern)
- [ ] `make<A>(...items: Array<A>): Effect.Effect<TxQueue<A>>` - Create with initial items
- [ ] `fromIterable<A>(iterable: Iterable<A>): Effect.Effect<TxQueue<A>>` - Create from iterable

#### 2.3 Implementation Pattern (following Queue.ts pattern)
- [ ] Use `Effect.gen` with `TxRef.make` to create internal refs
- [ ] Create queue objects directly (no prototype):
  ```typescript
  const queue: TxQueue<A> = {
    [TypeId]: { _A: identity },
    strategy: "bounded",
    capacity,
    itemsRef,
    shutdownRef,
    [NodeInspectSymbol]() { return toJSON(this) },
    toJSON() { return { _id: "TxQueue", ... } }
  }
  ```

**Documentation**: Add **Return behavior** documentation to all constructors

### Phase 3: Core Queue Operations
**Estimated Time**: 3-4 hours
**🚨 LINT AFTER EVERY CHANGE**: `pnpm lint --fix packages/effect/src/TxQueue.ts`

#### 3.1 Standalone Functions (following Queue.ts pattern - NO dual signatures)
**Enqueue Operations (work on TxQueue<A>):**
- [ ] `offer<A>(self: TxQueue<A>, value: A): Effect.Effect<boolean>` - Add single item
- [ ] `offerAll<A>(self: TxQueue<A>, values: Iterable<A>): Effect.Effect<Chunk.Chunk<A>>` - Add multiple items, return rejected items
- [ ] Handle strategy-specific behavior directly in function logic

**Dequeue Operations (work on TxDequeue<A>):**  
- [ ] `take<A>(self: TxDequeue<A>): Effect.Effect<A>` - Remove and return (blocks if empty)
- [ ] `poll<A>(self: TxDequeue<A>): Effect.Effect<Option.Option<A>>` - Try remove, non-blocking
- [ ] `takeAll<A>(self: TxDequeue<A>): Effect.Effect<Chunk.Chunk<A>>` - Remove all items
- [ ] `takeN<A>(self: TxDequeue<A>, n: number): Effect.Effect<Chunk.Chunk<A>>` - Take N items

**Inspection Operations (work on TxDequeue<A>):**
- [ ] `peek<A>(self: TxDequeue<A>): Effect.Effect<A>` - View next without removing
- [ ] `size<A>(self: TxDequeue<A>): Effect.Effect<number>` - Current queue size
- [ ] `isEmpty<A>(self: TxDequeue<A>): Effect.Effect<boolean>` - Check if empty  
- [ ] `isFull<A>(self: TxDequeue<A>): Effect.Effect<boolean>` - Check if at capacity

**Queue Management:**
- [ ] `shutdown<A>(self: TxQueue<A>): Effect.Effect<void>` - Mark as closed
- [ ] `isShutdown<A>(self: TxDequeue<A>): Effect.Effect<boolean>` - Check shutdown status

**Documentation**: Add appropriate **Mutation behavior** vs **Observer behavior** documentation

### Phase 4: Advanced Operations
**Estimated Time**: 2-3 hours
**🚨 LINT AFTER EVERY CHANGE**: `pnpm lint --fix packages/effect/src/TxQueue.ts`

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
**Estimated Time**: 4-5 hours

#### 5.1 Linting Requirements (MANDATORY after every file change)
- [ ] **🚨 CRITICAL**: Run `pnpm lint --fix packages/effect/src/TxQueue.ts` after EVERY edit
- [ ] **🚨 CRITICAL**: Run `pnpm lint --fix packages/effect/test/TxQueue.test.ts` after EVERY test edit
- [ ] Run `pnpm check` for type checking validation
- [ ] Run `pnpm docgen` to ensure JSDoc examples compile

#### 5.2 Comprehensive Test Suite (Port from TQueue.test.ts)
**Source**: https://github.com/Effect-TS/effect/blob/main/packages/effect/test/TQueue.test.ts

**Constructor Tests:**
- [ ] `bounded(capacity)` - Create bounded queue with specified capacity
- [ ] `unbounded()` - Create unbounded queue
- [ ] `dropping(capacity)` - Create dropping queue behavior
- [ ] `sliding(capacity)` - Create sliding queue behavior  
- [ ] `make(...items)` - Create queue with initial items
- [ ] `fromIterable(items)` - Create queue from iterable

**Basic Operations Tests:**
- [ ] `offer(queue, item)` - Single item enqueue with strategy behavior
- [ ] `offerAll(queue, items)` - Multiple item enqueue with rejection handling
- [ ] `take(queue)` - Single item dequeue (blocking behavior)
- [ ] `poll(queue)` - Non-blocking take returning Option
- [ ] `takeAll(queue)` - Remove all items atomically
- [ ] `takeN(queue, n)` - Take specific number of items

**Queue State Tests:**
- [ ] `size(queue)` - Current queue size
- [ ] `isEmpty(queue)` - Empty state detection
- [ ] `isFull(queue)` - Full state detection (bounded queues)
- [ ] `peek(queue)` - View next item without removal
- [ ] `capacity` - Queue capacity limits

**Strategy-Specific Tests:**
- [ ] **Bounded**: Back-pressure behavior when full
- [ ] **Unbounded**: No capacity limits, memory-bound only
- [ ] **Dropping**: Reject new items when at capacity  
- [ ] **Sliding**: Evict oldest items when at capacity

**Edge Cases and Error Conditions:**
- [ ] Empty queue operations (take, peek should block or return Option.none)
- [ ] Full queue operations (offer behavior varies by strategy)
- [ ] Undefined and null value handling
- [ ] Large item count operations
- [ ] Boundary conditions (capacity 0, capacity 1)

**Transaction Semantics Tests:**
- [ ] Single operation atomicity (automatic transaction wrapping)
- [ ] Multi-step atomic operations using `Effect.transaction`
- [ ] Retry behavior for blocking operations (`take` on empty queue)
- [ ] Conflict detection and resolution
- [ ] Transaction rollback scenarios

**Queue Management Tests:**  
- [ ] `shutdown(queue)` - Queue closure and cleanup
- [ ] `isShutdown(queue)` - Shutdown state detection
- [ ] Operations on shutdown queues (should reject)

**Type Safety Tests:**
- [ ] TxQueue vs TxDequeue interface separation
- [ ] Type guard functions (`isTxQueue`, `isTxDequeue`)
- [ ] Variance type checking (covariant/invariant)

#### 5.3 Test Implementation Pattern
```typescript
describe("TxQueue", () => {
  describe("constructors", () => {
    it.effect("bounded creates queue with specified capacity", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number>(5)
        const size = yield* TxQueue.size(queue)
        const isEmpty = yield* TxQueue.isEmpty(queue)
        
        assert.strictEqual(size, 0)
        assert.strictEqual(isEmpty, true)
      }))
  })
  
  describe("basic operations", () => {
    it.effect("offer and take work correctly", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<string>(10)
        
        const offered = yield* TxQueue.offer(queue, "hello")
        assert.strictEqual(offered, true)
        
        const item = yield* TxQueue.take(queue)
        assert.strictEqual(item, "hello")
      }))
  })
  
  // ... more test patterns
})
```

#### 5.4 Test Porting Strategy
- [ ] **Adapt STM.commit to Effect.transaction**: Convert STM patterns to Effect patterns
- [ ] **Convert pipe chains**: Adapt functional composition to Effect.gen style
- [ ] **Update imports**: Change from STM imports to Effect/TxQueue imports
- [ ] **Preserve test logic**: Keep the same test scenarios and assertions
- [ ] **Add Effect-specific tests**: Test Effect.retryTransaction behavior

#### 5.5 Performance and Integration Tests
- [ ] High-throughput scenarios (1000+ items)
- [ ] Memory usage patterns for large queues
- [ ] Concurrent producer/consumer scenarios
- [ ] Queue strategy efficiency comparisons
- [ ] Integration with existing Effect patterns

#### 5.6 Validation Checklist
- [ ] All ported tests pass (target: 40+ test cases)
- [ ] Type checking passes: `pnpm check`
- [ ] Linting passes: `pnpm lint`
- [ ] JSDoc examples compile: `pnpm docgen`
- [ ] No `any` types in implementation or tests
- [ ] 100% test coverage for public API
- [ ] Performance benchmarks within acceptable ranges

### Phase 6: Documentation and Polish
**Estimated Time**: 2-3 hours
**🚨 LINT AFTER EVERY CHANGE**: `pnpm lint --fix packages/effect/src/TxQueue.ts`

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

### 2. Interface Separation (following Queue.ts pattern)
```typescript
// TypeIds
export const DequeueTypeId: DequeueTypeId = "~effect/TxQueue/Dequeue"
export const TypeId: TypeId = "~effect/TxQueue"

// Variance interfaces
export interface Variance<A> {
  _A: Types.Covariant<A>
}

// Dequeue interface (read-only operations)
export interface TxDequeue<out A> extends Inspectable {
  readonly [DequeueTypeId]: TxDequeue.Variance<A>
  readonly strategy: "bounded" | "unbounded" | "dropping" | "sliding"
  readonly capacity: number
  readonly itemsRef: TxRef.TxRef<Chunk.Chunk<A>>
  readonly shutdownRef: TxRef.TxRef<boolean>
}

// Queue interface (full operations)
export interface TxQueue<in out A> extends TxDequeue<A> {
  readonly [TypeId]: TxQueue.Variance<A>
}
```

### 3. Implementation Pattern (following Queue.ts - no prototypes)
```typescript
// Constructor implementation
const bounded = <A = never>(capacity: number): Effect.Effect<TxQueue<A>> =>
  Effect.gen(function*() {
    const itemsRef = yield* TxRef.make(Chunk.empty<A>())
    const shutdownRef = yield* TxRef.make(false)
    
    return {
      [DequeueTypeId]: { _A: identity },
      [TypeId]: { _A: identity },
      strategy: "bounded" as const,
      capacity,
      itemsRef,
      shutdownRef,
      [NodeInspectSymbol]() {
        return toJSON(this)
      },
      toJSON() {
        return { _id: "TxQueue", strategy: this.strategy, capacity: this.capacity }
      }
    }
  })

// Type guards
export const isTxQueue = <A = unknown>(u: unknown): u is TxQueue<A> => 
  hasProperty(u, TypeId)

export const isTxDequeue = <A = unknown>(u: unknown): u is TxDequeue<A> => 
  hasProperty(u, DequeueTypeId)
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

### Basic Operations API (following Queue.ts pattern)
```typescript
// Enqueue operations (work on TxQueue, mutation behavior)
const accepted = yield* TxQueue.offer(queue, item)           // Returns boolean
const rejected = yield* TxQueue.offerAll(queue, [1, 2, 3])   // Returns rejected items

// Dequeue operations (work on TxDequeue, mutation behavior)  
const item = yield* TxQueue.take(queue)      // Remove item (blocks if empty)
const maybe = yield* TxQueue.poll(queue)     // Try remove (non-blocking)
const all = yield* TxQueue.takeAll(queue)    // Remove all items
const some = yield* TxQueue.takeN(queue, 3)  // Take N items

// Inspection operations (work on TxDequeue, observer behavior)
const next = yield* TxQueue.peek(queue)      // View next item
const size = yield* TxQueue.size(queue)      // Current size
const empty = yield* TxQueue.isEmpty(queue)  // Check if empty
const full = yield* TxQueue.isFull(queue)    // Check if full

// Queue management
yield* TxQueue.shutdown(queue)               // Close queue
const closed = yield* TxQueue.isShutdown(queue) // Check if closed
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
**Total Estimated Time**: 17-24 hours across 6 phases
**Target Completion**: 3-4 development sessions  
**Review Points**: After Phase 2, Phase 4, and Phase 6

## 🚨 CRITICAL REMINDERS

### Linting Requirements (NEVER SKIP)
- **MANDATORY**: Run `pnpm lint --fix packages/effect/src/TxQueue.ts` after EVERY source file edit
- **MANDATORY**: Run `pnpm lint --fix packages/effect/test/TxQueue.test.ts` after EVERY test file edit
- **MANDATORY**: Run `pnpm check` for type checking after major changes
- **MANDATORY**: Run `pnpm docgen` to validate JSDoc examples before committing

### Testing Requirements (COMPREHENSIVE)
- **Target**: 40+ test cases ported from TQueue.test.ts
- **Coverage**: 100% public API coverage required
- **Adaptation**: Convert STM patterns to Effect patterns
- **Quality**: All tests must pass before proceeding to next phase