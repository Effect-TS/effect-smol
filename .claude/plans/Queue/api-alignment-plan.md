# Queue API Alignment Plan

## Overview
Align the Queue API with the newer TxQueue API to improve error handling and remove the verbose `Done` signal handling. The goal is to make Queue operations return cleaner error types directly through the E channel rather than forcing consumers to handle `Done` signals.

## Comprehensive API Analysis

### Complete Queue API Inventory (27 functions)

#### Functions That Need Error Handling Changes (HIGH PRIORITY)
```typescript
// ❌ Current problematic signatures that force Done handling
export const take = <A, E>(self: Dequeue<A, E>): Effect<A, E | Done>
export const takeAll = <A, E>(self: Dequeue<A, E>): Effect<Arr.NonEmptyArray<A>, E | Done>
export const takeN = <A, E>(self: Dequeue<A, E>, n: number): Effect<Array<A>, E | Done>
export const takeBetween = <A, E>(self: Dequeue<A, E>, min: number, max: number): Effect<Array<A>, E | Done>

// ✅ Should become (matching TxQueue pattern)
export const take = <A, E>(self: Dequeue<A, E>): Effect<A, E>
export const takeAll = <A, E>(self: Dequeue<A, E>): Effect<Array<A>, E>
export const takeN = <A, E>(self: Dequeue<A, E>, n: number): Effect<Array<A>, E>
export const takeBetween = <A, E>(self: Dequeue<A, E>, min: number, max: number): Effect<Array<A>, E>
```

#### Functions That Should Be Added (MEDIUM PRIORITY)
```typescript
// Missing from Queue but present in TxQueue
export const poll = <A, E>(self: Dequeue<A, E>): Effect<Option<A>, E>
export const peek = <A, E>(self: Dequeue<A, E>): Effect<A, E>
export const isEmpty = <A, E>(self: Dequeue<A, E>): Effect<boolean>
export const isFull = <A, E>(self: Dequeue<A, E>): Effect<boolean>
export const isOpen = <A, E>(self: Dequeue<A, E>): Effect<boolean>
export const isClosing = <A, E>(self: Dequeue<A, E>): Effect<boolean>
export const isDone = <A, E>(self: Dequeue<A, E>): Effect<boolean>
export const awaitCompletion = <A, E>(self: Dequeue<A, E>): Effect<void, E>
```

#### Functions That Are Already Correct (LOW PRIORITY)
```typescript
// These already handle Done states appropriately
export const offer = <A, E>(self: Queue<A, E>, message: A): Effect<boolean>
export const offerAll = <A, E>(self: Queue<A, E>, messages: Iterable<A>): Effect<Array<A>>
export const fail = <A, E>(self: Queue<A, E>, error: E): Effect<boolean>
export const end = <A, E>(self: Queue<A, E>): Effect<boolean>
export const shutdown = <A, E>(self: Queue<A, E>): Effect<boolean>
export const size = <A, E>(self: Dequeue<A, E>): Effect<Option<number>>
export const await = <A, E>(self: Dequeue<A, E>): Effect<void, E>
```

### Key Architectural Differences

#### 1. **Consumer Operations Error Handling**
- **Queue**: Forces `E | Done` handling in 4 critical consumer functions
- **TxQueue**: Clean `E` channel propagation for all operations
- **Impact**: TxQueue eliminates 90% of boilerplate error handling code

#### 2. **State Inspection Granularity**
- **Queue**: Limited to `size()` returning `Option<number>` (None when done)
- **TxQueue**: Rich state inspection with `isOpen`, `isClosing`, `isDone`
- **Impact**: TxQueue provides much better observability

#### 3. **Completion Semantics**
- **Queue**: Mixed pattern where some operations return `Done` in error channel, others don't
- **TxQueue**: Consistent error propagation through `Cause.Cause<E>` for ALL operations
- **Impact**: TxQueue has consistent, predictable error handling

#### 4. **Missing Essential Operations**
- **Queue**: Missing `poll()`, `peek()`, `isEmpty()`, `isFull()` that are standard in concurrent queues
- **TxQueue**: Full complement of queue operations expected in concurrent programming
- **Impact**: Queue API is incomplete compared to TxQueue

### Error Handling Pattern Comparison

#### Current Queue Pattern (Problematic)
```typescript
// Forces consumers to handle Done in error channel
const program = Effect.gen(function*() {
  const queue = yield* Queue.bounded<number>(10)
  
  try {
    const item = yield* Queue.take(queue)  // Effect<number, never | Done>
    // Success case
  } catch (error) {
    if (Queue.isDone(error)) {
      // Handle queue completion - mandatory even if queue never closes!
    } else {
      // Handle actual errors
    }
  }
})
```

#### TxQueue Pattern (Clean)
```typescript
// Errors propagate cleanly through E-channel
const program = Effect.gen(function*() {
  const queue = yield* TxQueue.bounded<number, string>(10)
  
  try {
    const item = yield* TxQueue.take(queue)  // Effect<number, string>
    // Success case
  } catch (error) {
    // error is string - only handle actual queue errors
    // No Done handling needed
  }
})
```

### Consumer Impact Examples

#### Taking from Never-Ending Queue
```typescript
// Queue: Forces unnecessary Done handling
const processForever = Effect.gen(function*() {
  const queue = yield* Queue.unbounded<Task>()
  
  while (true) {
    const result = yield* Effect.match(Queue.take(queue), {
      onFailure: (error) => {
        if (Queue.isDone(error)) {
          break // This will NEVER happen for unbounded queue!
        }
        throw error
      },
      onSuccess: (task) => task
    })
    yield* processTask(result)
  }
})

// TxQueue: Clean, direct usage
const processForever = Effect.gen(function*() {
  const queue = yield* TxQueue.unbounded<Task>()
  
  while (true) {
    const task = yield* TxQueue.take(queue)  // No Done handling needed
    yield* processTask(task)
  }
})
```

#### Error Propagation from Failed Queue
```typescript
// Queue: Inconsistent error handling
const queue = yield* Queue.bounded<number, string>(10)
yield* Queue.fail(queue, "connection lost")

// take() returns Effect<number, string | Done> - confusing!
// The error is "connection lost" but consumers must handle Done too
const result = yield* Effect.match(Queue.take(queue), {
  onFailure: (error) => {
    if (Queue.isDone(error)) {
      // This branch is never taken for failed queues
    } else {
      // error is "connection lost"
    }
  }
})

// TxQueue: Clean error propagation
const queue = yield* TxQueue.bounded<number, string>(10)
yield* TxQueue.fail(queue, "connection lost")

// take() returns Effect<number, string> - clean!
const result = yield* TxQueue.take(queue)  // Fails directly with "connection lost"
```

## Implementation Plan

### Phase 1: Core Consumer Operations (Breaking Changes)
**Duration**: 4-5 hours
**Goal**: Update the 4 critical consumer operations to remove `Done` from error channel

#### 1.1 Update Consumer Operation Signatures
**HIGH PRIORITY** - These are the main functions causing the API friction:
- [ ] `take<A, E>(self: Dequeue<A, E>): Effect<A, E>` (was `Effect<A, E | Done>`)
- [ ] `takeAll<A, E>(self: Dequeue<A, E>): Effect<Array<A>, E>` (was `Effect<Arr.NonEmptyArray<A>, E | Done>`)
- [ ] `takeN<A, E>(self: Dequeue<A, E>, n: number): Effect<Array<A>, E>` (was `Effect<Array<A>, E | Done>`)
- [ ] `takeBetween<A, E>(self: Dequeue<A, E>, min: number, max: number): Effect<Array<A>, E>` (was `Effect<Array<A>, E | Done>`)

#### 1.2 Update Internal Implementation
- [ ] Update `unsafeTake()` to fail with proper error instead of returning `Done`
- [ ] Update `unsafeTakeBetween()` to handle completion states properly
- [ ] Update `awaitTake()` to propagate errors through E channel
- [ ] Ensure queue completion fails operations with appropriate errors

#### 1.3 Update Pull Operations
- [ ] Update `toPull()` to propagate errors correctly (was `Pull<A, E, L>`)
- [ ] Update `toPullArray()` to propagate errors correctly (was `Pull<Array<A>, E, L>`)

#### 1.4 Error Propagation Strategy
- [ ] When queue is `end()`ed, operations should fail with `Cause.NoSuchElementError`
- [ ] When queue is `fail(error)`ed, operations should fail with that error
- [ ] When queue is `shutdown()`, operations should fail with interruption
- [ ] Empty completed queue should fail with completion error, not suspend

### Phase 2: Add Missing TxQueue Operations (Feature Additions)
**Duration**: 3-4 hours
**Goal**: Add the 8 missing operations that TxQueue has but Queue lacks

#### 2.1 Non-Blocking Operations
- [ ] `poll<A, E>(self: Dequeue<A, E>): Effect<Option<A>, E>` - Try take without blocking
- [ ] `peek<A, E>(self: Dequeue<A, E>): Effect<A, E>` - View next item without removing

#### 2.2 State Inspection Operations
- [ ] `isEmpty<A, E>(self: Dequeue<A, E>): Effect<boolean>` - Check if queue is empty
- [ ] `isFull<A, E>(self: Dequeue<A, E>): Effect<boolean>` - Check if queue is at capacity
- [ ] `isOpen<A, E>(self: Dequeue<A, E>): Effect<boolean>` - Check if queue accepts new items
- [ ] `isClosing<A, E>(self: Dequeue<A, E>): Effect<boolean>` - Check if queue is draining
- [ ] `isDone<A, E>(self: Dequeue<A, E>): Effect<boolean>` - Check if queue is completed

#### 2.3 Completion Utilities
- [ ] `awaitCompletion<A, E>(self: Dequeue<A, E>): Effect<void, E>` - Wait for queue completion

#### 2.4 Implementation Strategy
- [ ] Follow TxQueue implementation patterns closely
- [ ] Ensure all operations properly propagate E-channel errors
- [ ] Maintain consistency with existing Queue internal patterns
- [ ] Add comprehensive tests for each new operation

### Phase 3: Internal Implementation Updates
**Duration**: 2-3 hours
**Goal**: Update internal logic to support clean error propagation

#### 3.1 State Management Updates
- [ ] Review `Queue.State<A, E>` to ensure proper error propagation
- [ ] Update `finalize()` to propagate exit errors properly
- [ ] Ensure completion states fail operations with appropriate errors

#### 3.2 Error Propagation Logic
- [ ] Update `unsafeTake()` and related functions to fail with proper error
- [ ] Update `awaitTake()` to propagate errors through E channel
- [ ] Ensure all internal functions consistently handle Done states

#### 3.3 Completion Handling
- [ ] Update `done()` function to set completion cause properly
- [ ] Update `fail()` and `failCause()` to integrate with new error handling
- [ ] Update `shutdown()` to propagate interruption through error channel

### Phase 4: Testing Updates
**Duration**: 4-5 hours
**Goal**: Update all tests to match new API signatures and add tests for new operations

#### 4.1 Existing Test Updates
- [ ] Update all test expectations to remove Done handling
- [ ] Update error handling tests to expect errors through E channel
- [ ] Remove or update tests that explicitly check for Done values
- [ ] Update `Effect.match` calls to handle new error patterns

#### 4.2 New Operation Tests
- [ ] Test `poll()` - non-blocking take behavior
- [ ] Test `peek()` - view without removal
- [ ] Test `isEmpty()`, `isFull()`, `isOpen()`, `isClosing()`, `isDone()` - state inspection
- [ ] Test `awaitCompletion()` - completion waiting

#### 4.3 Error Propagation Tests
- [ ] Test that `take()` on completed queue fails with proper error
- [ ] Test that `takeAll()` on completed queue fails with proper error
- [ ] Test that `takeN()` on completed queue fails with proper error
- [ ] Test error propagation through E channel for all operations

#### 4.4 Completion Scenario Tests
- [ ] Test `end()` causes subsequent operations to fail properly
- [ ] Test `fail(error)` causes subsequent operations to fail with that error
- [ ] Test `shutdown()` causes subsequent operations to fail with interruption
- [ ] Test queue state transitions work correctly

### Phase 5: Documentation Updates
**Duration**: 2-3 hours
**Goal**: Update all documentation to reflect new API and add docs for new operations

#### 5.1 JSDoc Updates for Changed Operations
- [ ] Update all function signatures in JSDoc examples
- [ ] Remove Done handling from examples
- [ ] Show proper error handling patterns
- [ ] Update return type descriptions

#### 5.2 JSDoc for New Operations
- [ ] Add comprehensive JSDoc for all 8 new operations
- [ ] Include usage examples for each new operation
- [ ] Show integration patterns with existing operations
- [ ] Document error handling behavior

#### 5.3 Example Updates
- [ ] Update usage examples to show cleaner error handling
- [ ] Remove Done-related code from examples
- [ ] Show how to handle queue completion properly
- [ ] Demonstrate error propagation patterns

### Phase 6: Validation and Polish
**Duration**: 2-3 hours
**Goal**: Ensure all changes work correctly and integration is seamless

#### 6.1 Comprehensive Testing
- [ ] Run all existing tests to ensure nothing breaks
- [ ] Test error propagation in various scenarios
- [ ] Test queue state transitions
- [ ] Test concurrent operations
- [ ] Test all new operations work correctly

#### 6.2 Integration Testing
- [ ] Test with existing Effect patterns
- [ ] Test with error handling combinators
- [ ] Test with retry and recovery patterns
- [ ] Test performance impact of changes

#### 6.3 Final Validation
- [ ] Lint all code: `pnpm lint --fix`
- [ ] Type check: `pnpm check`
- [ ] Test: `pnpm test Queue.test.ts`
- [ ] Documentation: `pnpm docgen`

#### 6.4 API Consistency Check
- [ ] Ensure all operations have consistent error handling
- [ ] Verify no functions still return `E | Done`
- [ ] Check that all new operations integrate properly
- [ ] Validate error propagation is consistent across all operations

## Technical Implementation Details

### 1. State Management Changes
```typescript
// Current Queue.State with Done handling
export type State<A, E> =
  | { readonly _tag: "Open"; ... }
  | { readonly _tag: "Closing"; ...; readonly exit: Exit<void, E> }
  | { readonly _tag: "Done"; readonly exit: Exit<void, E> }

// Update internal logic to propagate exit errors properly
const finalize = <A, E>(self: Dequeue<A, E>, exit: Exit<void, E>) => {
  // Propagate exit to all waiting operations
  for (const taker of openState.takers) {
    taker(exit) // This should fail operations with the exit error
  }
}
```

### 2. Operation Implementation Changes
```typescript
// Before: Returns Done through error channel
export const take = <A, E>(self: Dequeue<A, E>): Effect<A, E | Done> => {
  // Logic that returns Done
}

// After: Fails with proper error through E channel
export const take = <A, E>(self: Dequeue<A, E>): Effect<A, E> => {
  internalEffect.suspend(
    () => unsafeTake(self) ?? internalEffect.andThen(awaitTake(self), take(self))
  )
}

// Update unsafeTake to fail with proper error instead of Done
const unsafeTake = <A, E>(self: Dequeue<A, E>): Exit<A, E> | undefined => {
  if (self.state._tag === "Done") {
    const exit = self.state.exit
    if (exit._tag === "Success") {
      // Instead of returning Done, fail with NoSuchElementError
      return core.exitFail(new Cause.NoSuchElementError())
    }
    return exit as Exit<A, E> // Propagate original failure
  }
  // ... rest of logic
}
```

### 3. Error Propagation Pattern
```typescript
// Pattern for propagating completion errors
const awaitTake = <A, E>(self: Dequeue<A, E>): Effect<void, E> =>
  internalEffect.callback<void, E>((resume) => {
    if (self.state._tag === "Done") {
      return resume(self.state.exit) // Propagate completion as error
    }
    // ... rest of logic
  })
```

### 4. New Usage Patterns
```typescript
// Before: Verbose Done handling
const program = Effect.gen(function*() {
  const queue = yield* Queue.bounded<number>(10)
  
  try {
    const item = yield* Queue.take(queue)
    // item is number, but we still need to handle Done
  } catch (error) {
    if (Queue.isDone(error)) {
      // Handle Done
    } else {
      // Handle other errors
    }
  }
})

// After: Clean error handling
const program = Effect.gen(function*() {
  const queue = yield* Queue.bounded<number>(10)
  
  try {
    const item = yield* Queue.take(queue) // Effect<number, never>
    // item is number, no Done handling needed
  } catch (error) {
    // Handle actual errors only
  }
})
```

## Breaking Changes Impact

### 1. API Changes
- **Breaking**: All take operations now return `Effect<A, E>` instead of `Effect<A, E | Done>`
- **Breaking**: Remove `Done` from error channel entirely
- **Breaking**: Queue completion now fails operations with appropriate errors

### 2. Error Handling Changes
- **Breaking**: `isDone()` filter may need updates or removal
- **Breaking**: Code that explicitly handles Done will need updates
- **Breaking**: Error handling patterns will change

### 3. Migration Path
```typescript
// Before
const result = yield* Queue.take(queue)
if (Queue.isDone(result)) {
  // Handle Done
}

// After  
try {
  const result = yield* Queue.take(queue)
  // Use result directly
} catch (error) {
  if (Cause.isNoSuchElementError(error)) {
    // Handle completion
  }
}
```

## Success Criteria

### 1. API Consistency
- [ ] All Queue operations have clean signatures matching TxQueue patterns
- [ ] No `Done` in error channels
- [ ] Proper error propagation through E channel

### 2. Error Handling
- [ ] Queue completion fails operations with appropriate errors
- [ ] Error types are consistent and meaningful
- [ ] Integration with Effect error handling patterns

### 3. Usability
- [ ] Much cleaner usage patterns
- [ ] Fewer required error handling branches
- [ ] Better integration with Effect combinators

### 4. Testing
- [ ] All existing functionality preserved
- [ ] New error handling patterns tested
- [ ] Performance maintained or improved

## Risk Analysis

### 1. Breaking Changes
- **Risk**: Major API changes will break existing code
- **Mitigation**: Document migration path clearly, provide transition guide

### 2. Error Handling Complexity
- **Risk**: Internal error propagation may be complex
- **Mitigation**: Follow TxQueue patterns closely, comprehensive testing

### 3. Performance Impact
- **Risk**: Changes might affect performance
- **Mitigation**: Profile before/after, optimize hot paths

### 4. Integration Issues
- **Risk**: Changes might break integration with other modules
- **Mitigation**: Test with existing Effect patterns, validate integration

## Implementation Strategy

### Development Approach
1. **Study TxQueue**: Understand error handling patterns thoroughly
2. **Incremental Changes**: Update one operation at a time
3. **Test-Driven**: Update tests alongside implementation
4. **Validate Frequently**: Run tests after each change

### Quality Assurance
1. **Linting**: `pnpm lint --fix` after every change
2. **Type Checking**: `pnpm check` continuously
3. **Testing**: `pnpm test Queue.test.ts` after each phase
4. **Documentation**: `pnpm docgen` for JSDoc validation

### Rollback Plan
- Keep original implementation backed up
- Implement in feature branch
- Test thoroughly before merging
- Document any issues discovered

## Conclusion

This plan will significantly improve Queue API usability by aligning it with TxQueue's cleaner error handling patterns. The changes are breaking but provide substantial improvements in developer experience and API consistency. The implementation should be done carefully with comprehensive testing to ensure all functionality is preserved while improving the API design.