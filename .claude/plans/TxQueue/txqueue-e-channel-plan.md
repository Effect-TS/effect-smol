# TxQueue E-Channel and Exit Signaling Implementation Plan

## Overview
Extend the existing TxQueue implementation to support an error channel (E) and sophisticated exit signaling, bringing it to full parity with the Queue implementation. This will enable TxQueue to handle queue-level failures and completion states in addition to regular value operations.

## Current State Analysis

### Existing TxQueue Limitations
- **Single Type Parameter**: Currently only supports `TxQueue<A>` 
- **Boolean Shutdown**: Uses simple `TxRef<boolean>` for shutdown state
- **No Error Channel**: Cannot signal queue-level failures to consumers
- **No Exit States**: Missing Open → Closing → Done state progression
- **Limited Integration**: Cannot integrate with Stream error handling

### Target Queue Features to Port
- **Dual Type Parameters**: `Queue<A, E>` with error channel support
- **Exit-Based Completion**: Uses `Exit<void, E>` for sophisticated termination
- **State Progression**: Three-state lifecycle (Open → Closing → Done)
- **Error Propagation**: Take operations return `Effect<A, Option<E>>` or `Effect<[A[], boolean], E>`
- **Completion Operations**: `end()`, `fail()`, `failCause()`, `done()` methods

## Implementation Strategy

### Phase 1: Type System Extension
**Estimated Time**: 3-4 hours

#### 1.1 Interface Redesign
```typescript
// NEW: Dual type parameter support
export interface TxDequeue<out A, out E = never> extends Inspectable {
  readonly [DequeueTypeId]: TxDequeue.Variance<A, E>
  readonly strategy: "bounded" | "unbounded" | "dropping" | "sliding"
  readonly capacity: number
  readonly items: TxChunk.TxChunk<any>
  readonly stateRef: TxRef.TxRef<State<A, E>>  // CHANGED: from shutdownRef
}

export interface TxQueue<in out A, in out E = never> extends TxDequeue<A, E> {
  readonly [TypeId]: TxQueue.Variance<A, E>
}
```

#### 1.2 State Type Definition
```typescript
export type State<A, E> =
  | {
      readonly _tag: "Open"
      readonly pendingTakers: number  // Count of blocked takers
    }
  | {
      readonly _tag: "Closing" 
      readonly pendingTakers: number
      readonly exit: Exit.Exit<void, E>
    }
  | {
      readonly _tag: "Done"
      readonly exit: Exit.Exit<void, E>
    }
```

#### 1.3 Variance Updates
```typescript
export declare namespace TxDequeue {
  export interface Variance<out A, out E> {
    readonly _A: Types.Covariant<A>
    readonly _E: Types.Covariant<E>
  }
}

export declare namespace TxQueue {
  export interface Variance<in out A, in out E> {
    readonly _A: Types.Invariant<A>
    readonly _E: Types.Invariant<E>
  }
}
```

### Phase 2: Constructor Updates
**Estimated Time**: 2-3 hours

#### 2.1 Constructor Signature Updates
```typescript
// All constructors gain E type parameter with never default
export const bounded = <A = never, E = never>(capacity: number): Effect.Effect<TxQueue<A, E>>
export const unbounded = <A = never, E = never>(): Effect.Effect<TxQueue<A, E>>
export const dropping = <A = never, E = never>(capacity: number): Effect.Effect<TxQueue<A, E>>
export const sliding = <A = never, E = never>(capacity: number): Effect.Effect<TxQueue<A, E>>
```

#### 2.2 Internal State Initialization
```typescript
const bounded = <A = never, E = never>(capacity: number): Effect.Effect<TxQueue<A, E>> =>
  Effect.gen(function*() {
    const items = yield* TxChunk.empty<A>()
    const stateRef = yield* TxRef.make<State<A, E>>({ _tag: "Open", pendingTakers: 0 })

    const txQueue = Object.create(TxQueueProto)
    txQueue.strategy = "bounded"
    txQueue.capacity = capacity
    txQueue.items = items
    txQueue.stateRef = stateRef
    return txQueue
  })
```

### Phase 3: Core Operation Updates
**Estimated Time**: 4-5 hours

#### 3.1 Take Operations with Error Handling
```typescript
// Single take - returns Option<E> for queue errors
export const take = <A, E>(self: TxDequeue<A, E>): Effect.Effect<A, Option.Option<E>> =>
  Effect.transaction(
    Effect.gen(function*() {
      const state = yield* TxRef.get(self.stateRef)
      
      // Check if queue is done
      if (state._tag === "Done") {
        if (Exit.isFailure(state.exit)) {
          return yield* Effect.fail(Option.some(Exit.unannotate(state.exit).cause._tag === "Fail" 
            ? Exit.unannotate(state.exit).cause.error 
            : Exit.unannotate(state.exit).cause))
        }
        // Queue ended successfully but no items - retry
        return yield* Effect.retryTransaction
      }

      const currentSize = yield* TxChunk.size(self.items)
      
      // If no items available, increment pending takers and retry
      if (currentSize === 0) {
        if (state._tag === "Open" || state._tag === "Closing") {
          yield* TxRef.update(self.stateRef, (s) => 
            s._tag === "Open" 
              ? { ...s, pendingTakers: s.pendingTakers + 1 }
              : s._tag === "Closing"
              ? { ...s, pendingTakers: s.pendingTakers + 1 }
              : s
          )
        }
        return yield* Effect.retryTransaction
      }

      // Take item and decrement pending takers if any
      const chunk = yield* TxChunk.get(self.items)
      const head = Chunk.head(chunk)
      if (Option.isNone(head)) {
        return yield* Effect.retryTransaction
      }

      yield* TxChunk.drop(self.items, 1)
      
      // Check if we need to transition Closing → Done
      const newSize = yield* TxChunk.size(self.items)
      if (state._tag === "Closing" && newSize === 0 && state.pendingTakers <= 1) {
        yield* TxRef.set(self.stateRef, { _tag: "Done", exit: state.exit })
      } else if (state.pendingTakers > 0) {
        yield* TxRef.update(self.stateRef, (s) => 
          s._tag === "Open" || s._tag === "Closing"
            ? { ...s, pendingTakers: Math.max(0, s.pendingTakers - 1) }
            : s
        )
      }

      return head.value
    })
  )

// Batch operations return [items, done] tuple  
export const takeAll = <A, E>(self: TxDequeue<A, E>): Effect.Effect<readonly [Array<A>, boolean], E> =>
  Effect.gen(function*() {
    const state = yield* TxRef.get(self.stateRef)
    
    if (state._tag === "Done") {
      if (Exit.isFailure(state.exit)) {
        return yield* Effect.fail(/* extract error from exit */)
      }
      return [[], true] as const
    }

    const items = yield* TxChunk.get(self.items)
    yield* TxChunk.set(self.items, Chunk.empty())
    
    const isDone = state._tag === "Closing"
    if (isDone) {
      yield* TxRef.set(self.stateRef, { _tag: "Done", exit: state.exit })
    }
    
    return [Chunk.toReadonlyArray(items), isDone] as const
  })

export const takeN: {
  <A, E>(n: number): (self: TxDequeue<A, E>) => Effect.Effect<readonly [Array<A>, boolean], E>
  <A, E>(self: TxDequeue<A, E>, n: number): Effect.Effect<readonly [Array<A>, boolean], E>
} = dual(2, <A, E>(self: TxDequeue<A, E>, n: number): Effect.Effect<readonly [Array<A>, boolean], E> =>
  Effect.gen(function*() {
    const state = yield* TxRef.get(self.stateRef)
    
    if (state._tag === "Done") {
      if (Exit.isFailure(state.exit)) {
        return yield* Effect.fail(/* extract error from exit */)
      }
      return [[], true] as const
    }

    const chunk = yield* TxChunk.get(self.items)
    const taken = Chunk.take(chunk, n)
    const remaining = Chunk.drop(chunk, n)
    yield* TxChunk.set(self.items, remaining)
    
    const isDone = state._tag === "Closing" && Chunk.isEmpty(remaining)
    if (isDone) {
      yield* TxRef.set(self.stateRef, { _tag: "Done", exit: state.exit })
    }
    
    return [Chunk.toReadonlyArray(taken), isDone] as const
  }))
```

#### 3.2 Offer Operations State Checking
```typescript
export const offer: {
  <A, E>(value: A): (self: TxQueue<A, E>) => Effect.Effect<boolean>
  <A, E>(self: TxQueue<A, E>, value: A): Effect.Effect<boolean>
} = dual(2, <A, E>(self: TxQueue<A, E>, value: A): Effect.Effect<boolean> =>
  Effect.transaction(
    Effect.gen(function*() {
      const state = yield* TxRef.get(self.stateRef)
      
      // Cannot offer to closed/failed queue
      if (state._tag === "Done" || state._tag === "Closing") {
        return false
      }

      // ... existing offer logic for strategies ...
      // (most offer logic remains the same, just check state.tag instead of shutdown boolean)
    })
  ))
```

### Phase 4: Exit Signaling Operations
**Estimated Time**: 3-4 hours

#### 4.1 Completion Operations
```typescript
// End successfully
export const end = <A, E>(self: TxQueue<A, E>): Effect.Effect<boolean> =>
  done(self, Exit.succeed(void 0))

// Fail with error
export const fail: {
  <E>(error: E): <A>(self: TxQueue<A, E>) => Effect.Effect<boolean>
  <A, E>(self: TxQueue<A, E>, error: E): Effect.Effect<boolean>
} = dual(2, <A, E>(self: TxQueue<A, E>, error: E): Effect.Effect<boolean> =>
  done(self, Exit.fail(error)))

// Fail with cause
export const failCause: {
  <E>(cause: Cause.Cause<E>): <A>(self: TxQueue<A, E>) => Effect.Effect<boolean>
  <A, E>(self: TxQueue<A, E>, cause: Cause.Cause<E>): Effect.Effect<boolean>
} = dual(2, <A, E>(self: TxQueue<A, E>, cause: Cause.Cause<E>): Effect.Effect<boolean> =>
  done(self, Exit.failCause(cause)))

// Complete with specific exit
export const done: {
  <E>(exit: Exit.Exit<void, E>): <A>(self: TxQueue<A, E>) => Effect.Effect<boolean>
  <A, E>(self: TxQueue<A, E>, exit: Exit.Exit<void, E>): Effect.Effect<boolean>
} = dual(2, <A, E>(self: TxQueue<A, E>, exit: Exit.Exit<void, E>): Effect.Effect<boolean> =>
  Effect.transaction(
    Effect.gen(function*() {
      const state = yield* TxRef.get(self.stateRef)
      
      if (state._tag !== "Open") {
        return false  // Already closing/done
      }

      const currentSize = yield* TxChunk.size(self.items)
      
      if (currentSize === 0 && state.pendingTakers === 0) {
        // Can transition directly to Done
        yield* TxRef.set(self.stateRef, { _tag: "Done", exit })
      } else {
        // Need to go through Closing state
        yield* TxRef.set(self.stateRef, { 
          _tag: "Closing", 
          pendingTakers: state.pendingTakers,
          exit 
        })
      }

      return true
    })
  ))

// Immediate shutdown (legacy compatibility)
export const shutdown = <A, E>(self: TxQueue<A, E>): Effect.Effect<boolean> =>
  Effect.transaction(
    Effect.gen(function*() {
      yield* TxChunk.set(self.items, Chunk.empty())  // Clear all items
      yield* TxRef.set(self.stateRef, { 
        _tag: "Done", 
        exit: Exit.interrupt(FiberId.none)
      })
      return true
    })
  )
```

#### 4.2 Await Operation
```typescript
// Wait for queue completion
export const await = <A, E>(self: TxDequeue<A, E>): Effect.Effect<void, E> =>
  Effect.transaction(
    Effect.gen(function*() {
      const state = yield* TxRef.get(self.stateRef)
      
      if (state._tag === "Done") {
        if (Exit.isFailure(state.exit)) {
          return yield* Effect.fail(/* extract error from exit */)
        }
        return void 0
      }

      // Not done yet, retry transaction
      return yield* Effect.retryTransaction
    })
  )
```

### Phase 5: State Query Operations
**Estimated Time**: 2 hours

#### 5.1 State Inspection
```typescript
// Check if queue is done (replaces isShutdown)
export const isDone = <A, E>(self: TxDequeue<A, E>): Effect.Effect<boolean> =>
  Effect.gen(function*() {
    const state = yield* TxRef.get(self.stateRef)
    return state._tag === "Done"
  })

// Check if queue is closing
export const isClosing = <A, E>(self: TxDequeue<A, E>): Effect.Effect<boolean> =>
  Effect.gen(function*() {
    const state = yield* TxRef.get(self.stateRef)
    return state._tag === "Closing"
  })

// Check if queue is open
export const isOpen = <A, E>(self: TxDequeue<A, E>): Effect.Effect<boolean> =>
  Effect.gen(function*() {
    const state = yield* TxRef.get(self.stateRef)
    return state._tag === "Open"
  })

// Legacy compatibility
export const isShutdown = <A, E>(self: TxDequeue<A, E>): Effect.Effect<boolean> => isDone(self)
```

### Phase 6: Testing and Integration
**Estimated Time**: 4-5 hours

#### 6.1 New Test Categories
```typescript
describe("TxQueue E-Channel and Exit Signaling", () => {
  describe("error channel behavior", () => {
    it.effect("take fails with queue error when queue fails", () => 
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number, string>(5)
        
        yield* TxQueue.fail(queue, "queue failed")
        
        const result = yield* Effect.flip(TxQueue.take(queue))
        assert.deepStrictEqual(result, Option.some("queue failed"))
      }))

    it.effect("takeAll returns error when queue fails", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number, string>(5)
        yield* TxQueue.offerAll(queue, [1, 2, 3])
        
        yield* TxQueue.fail(queue, "queue failed")
        
        const result = yield* Effect.flip(TxQueue.takeAll(queue))
        assert.strictEqual(result, "queue failed")
      }))
  })

  describe("state transitions", () => {
    it.effect("transitions Open → Closing → Done correctly", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number, never>(5)
        yield* TxQueue.offerAll(queue, [1, 2, 3])
        
        assert.strictEqual(yield* TxQueue.isOpen(queue), true)
        
        yield* TxQueue.end(queue)
        assert.strictEqual(yield* TxQueue.isClosing(queue), true)
        
        yield* TxQueue.takeAll(queue)
        assert.strictEqual(yield* TxQueue.isDone(queue), true)
      }))

    it.effect("direct Open → Done when empty", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number, never>(5)
        
        yield* TxQueue.end(queue)
        assert.strictEqual(yield* TxQueue.isDone(queue), true)
      }))
  })

  describe("completion operations", () => {
    it.effect("end() completes queue successfully", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number, never>(5)
        
        const endResult = yield* TxQueue.end(queue)
        assert.strictEqual(endResult, true)
        
        yield* TxQueue.await(queue)  // Should not fail
      }))

    it.effect("fail() completes queue with error", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number, string>(5)
        
        const failResult = yield* TxQueue.fail(queue, "test error")
        assert.strictEqual(failResult, true)
        
        const result = yield* Effect.flip(TxQueue.await(queue))
        assert.strictEqual(result, "test error")
      }))
  })

  describe("type ergonomics", () => {
    it.effect("default E parameter provides clean typing", () =>
      Effect.gen(function*() {
        // Clean, concise typing with default E = never
        const queue = yield* TxQueue.bounded<number>(5)
        
        yield* TxQueue.offer(queue, 42)
        const item = yield* TxQueue.take(queue)  // Effect<number, never>
        assert.strictEqual(item, 42)
      }))
  })
})
```

#### 6.2 Type Ergonomics Testing
- Verify `TxQueue<number>` infers correctly as `TxQueue<number, never>`
- Test explicit error channel typing `TxQueue<Data, Error>` works as expected
- Test integration with existing Effect error handling patterns

#### 6.3 Performance Testing
- Ensure state management doesn't significantly impact performance
- Verify transaction overhead is acceptable
- Test memory usage under high load

### Phase 7: Documentation and Integration
**Estimated Time**: 3 hours

#### 7.1 JSDoc Updates
- Update all function signatures to include E type parameter
- Add comprehensive examples showing error channel usage
- Document state transition behavior
- Add usage guide for E channel patterns

#### 7.2 Integration Updates
- Update type exports in main index
- Update existing tests to use new API
- Clean up any deprecated patterns

## Technical Considerations

### 1. Type Ergonomics Strategy
- **Default E = never**: Enables shorter type annotations `TxQueue<number>` instead of `TxQueue<number, never>`
- **Type Inference**: Most queues don't need error channel, so default makes common case concise
- **Explicit When Needed**: Use `TxQueue<Data, NetworkError>` when error channel is required
- **Clean Breaking Change**: No legacy compatibility burden, can design optimal API

### 2. Transaction Semantics
- **State Consistency**: All state transitions happen atomically within transactions
- **Retry Logic**: Take operations retry until items available or queue fails
- **Conflict Detection**: State changes trigger transaction retries appropriately

### 3. Error Handling Philosophy
```typescript
// Queue-level errors (E channel) vs operation errors
const queue = TxQueue.bounded<Data, NetworkError>(100)

// Operation succeeds/fails based on queue state, not E channel
const offered: boolean = yield* TxQueue.offer(queue, data)

// E channel errors come from queue completion/failure
const item: Data = yield* TxQueue.take(queue)  // Effect<Data, Option<NetworkError>>

// Explicit queue failure propagates through E channel
yield* TxQueue.fail(queue, new NetworkError("connection lost"))
```

### 4. State Management Design
```typescript
// Three-state progression provides clear lifecycle
Open     → accepting offers, serving takes
Closing  → no new offers, serving remaining items
Done     → no operations, exit value available

// Pending takers tracking enables proper Closing → Done transitions
```

### 5. Integration with Streams
```typescript
// Future: TxQueue should integrate with Stream operations
const stream: Stream<Data, NetworkError> = Stream.fromTxQueue(queue)

// Queue failures become stream failures
// Queue completion becomes stream completion
```

## API Design Examples

### Basic Usage (No E Channel)
```typescript
// Existing patterns continue to work
const queue = yield* TxQueue.bounded<number>(10)  // E = never (default)
yield* TxQueue.offer(queue, 42)
const item = yield* TxQueue.take(queue)           // Effect<number, never>
```

### Error Channel Usage
```typescript
// With error channel
const queue = yield* TxQueue.bounded<Message, NetworkError>(100)

// Take operations can fail with queue errors
const message = yield* TxQueue.take(queue)        // Effect<Message, Option<NetworkError>>

// Batch operations return completion status  
const [messages, done] = yield* TxQueue.takeAll(queue)  // Effect<[Message[], boolean], NetworkError>

// Queue can be failed explicitly
yield* TxQueue.fail(queue, new NetworkError("connection lost"))
```

### State Management
```typescript
// Check queue state
const isOpen = yield* TxQueue.isOpen(queue)
const isClosing = yield* TxQueue.isClosing(queue) 
const isDone = yield* TxQueue.isDone(queue)

// Complete queue gracefully
yield* TxQueue.end(queue)

// Wait for completion
yield* TxQueue.await(queue)  // Fails if queue failed
```

## Success Criteria

1. **✅ Full API Parity**: TxQueue matches Queue E-channel and exit signaling features
2. **✅ Type Ergonomics**: Clean API with sensible defaults (`TxQueue<A>` for common case)
3. **✅ Type Safety**: Proper variance, no any types, correct error propagation
4. **✅ State Consistency**: Atomic state transitions within transactions
5. **✅ Performance**: Minimal overhead for E-channel functionality
6. **✅ Documentation**: Complete JSDoc with examples and usage patterns
7. **✅ Testing**: Comprehensive test coverage including edge cases and type inference

## Dependencies

### New Dependencies
- **Exit**: For exit value representation
- **Cause**: For error cause handling
- **FiberId**: For interruption handling
- **Option**: For optional error wrapping

### Existing Dependencies
- **TxRef**: Enhanced for State<A, E> management
- **TxChunk**: Unchanged, continues to store A values
- **Effect**: Enhanced for E-channel error propagation

## Implementation Strategy

### Breaking Change Approach
Since we don't need backwards compatibility, we can implement this as a clean breaking change:

1. **Update All Signatures**: Add E type parameter to all operations immediately
2. **Replace State Management**: Replace simple shutdown boolean with full state system
3. **Enhanced Error Handling**: All operations updated to handle E-channel errors properly
4. **Clean API Design**: No legacy aliases or deprecated patterns to maintain

## Risks and Mitigation

1. **Complexity Growth**: Mitigate with comprehensive testing and clear documentation
2. **Performance Impact**: Profile and optimize state management operations
3. **Learning Curve**: Provide clear examples and comprehensive documentation
4. **Implementation Scope**: Break into manageable phases with validation at each step

## Request for Approval

This plan provides a comprehensive approach to adding E-channel and exit signaling support to TxQueue with a clean breaking change approach. The implementation follows the established Queue patterns while adapting them for transactional semantics and providing excellent type ergonomics.

**Key Questions for Review:**
1. Is the clean breaking change approach acceptable?
2. Does the state management approach suit transactional context?
3. Are there any Queue features missing from this plan?
4. Should we prioritize any particular phase or feature?

Please review and approve before proceeding with implementation.