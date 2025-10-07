# API Alignment Plan: Queue.ts vs TxQueue.ts

**Goal:** Align the APIs of Queue.ts (Effect-based) and TxQueue.ts (STM-based) to ensure consistent naming, return types, functionality, and structure while respecting their fundamental differences.

## Overview

Queue.ts provides Effect-based asynchronous queues with backpressure strategies, while TxQueue.ts provides STM-based transactional queues. As TxQueue is the transactional counterpart of Queue, the APIs should mirror each other closely.

**Key Differences to Preserve:**
- **Queue.ts**: Effect-based, supports unsafe synchronous operations
- **TxQueue.ts**: STM-based, all operations are atomic transactions (no unsafe variants needed)

## Critical Issues Identified

### 1. ❌ WRONG: Inconsistent Completion Semantics (HIGHEST PRIORITY)

**Current State:**
- Queue.ts uses local `Done` interface (lines 968-992)
- TxQueue.ts uses `Cause.NoSuchElementError`
- Both represent the same concept: graceful queue completion

**Why This is Wrong:**
- `NoSuchElementError` implies "element not found" (lookup failure)
- Queue completion means "gracefully finished, no more items" (lifecycle event)
- Different types for same semantic meaning = API confusion

**Solution:**
- Create unified `Cause.Done` error type in Cause.ts
- Both queues use `Cause.Done` for completion semantics
- Remove Queue's local `Done` interface
- Migrate TxQueue from `Cause.NoSuchElementError` to `Cause.Done`

### 2. ❌ WRONG: Queue's `done()` Operation (HIGH PRIORITY)

**Current State:**
```typescript
// Queue.ts - Complex signature with Exit
export const done = <A, E>(
  self: Queue<A, E>, 
  exit: Exit<Done extends E ? unknown : never, E>
): Effect<boolean>
```

**Why This is Wrong:**
- Complex conditional type signature
- Takes `Exit` instead of `Cause` (less natural)
- Not present in TxQueue (inconsistency)
- `Cause` is the natural primitive, not `Exit`

**TxQueue's Better Approach:**
```typescript
// TxQueue.ts - Clean signatures
export const fail: <A, E>(self: TxEnqueue<A, E>, error: E) => Effect<boolean>
export const failCause: <A, E>(self: TxEnqueue<A, E>, cause: Cause<E>) => Effect<boolean>
export const end: <A, E>(self: TxEnqueue<A, E | Cause.Done>) => Effect<boolean>
```

**Solution:**
- Remove `done()` and `doneUnsafe()` from Queue.ts
- Make `failCause(cause: Cause<E>)` the primitive in both implementations
- Build `fail` and `end` as convenience wrappers around `failCause`
- Hierarchy: `failCause` → `fail`, `end`

### 3. ❌ WRONG: TxQueue `takeAll` Type Lie (HIGH PRIORITY)

**Current State:**
```typescript
// TxQueue.ts - Says "might be empty" but blocks until non-empty!
export const takeAll = <A, E>(self: TxDequeue<A, E>): Effect<ReadonlyArray<A>, E>
```

**Implementation Reality:**
```typescript
// Blocks until at least 1 item available
if (yield* isEmpty(self)) {
  return yield* Effect.retryTransaction  // ← BLOCKS HERE
}
// Only proceeds when ≥1 item available
```

**Queue.ts Has it Correct:**
```typescript
export const takeAll = <A, E>(self: Dequeue<A, E>): Effect<NonEmptyArray<A>, E>
```

**Solution:**
- Fix TxQueue `takeAll` signature to return `NonEmptyArray<A>`
- Type now accurately reflects runtime behavior

### 4. ❌ WRONG: Queue Missing `interrupt` Operation (HIGH PRIORITY)

**Current State:**
- Queue.ts has NO `interrupt` operation
- Only has `shutdown` which clears AND interrupts immediately
- No way to gracefully close (stop accepting, allow draining)

**TxQueue.ts Has it:**
```typescript
export const interrupt = <A, E>(self: TxEnqueue<A, E>): Effect<boolean>
  // Graceful close - stops accepting, allows draining existing items
```

**Solution:**
- Add `interrupt` to Queue.ts
- Refactor `shutdown` to compose `clear` + `interrupt`

### 5. ❌ WRONG: Inconsistent `clear` Semantics (MEDIUM PRIORITY)

**Current State:**
```typescript
// Queue.ts - Returns Array<A>, category "taking"
export const clear = <A, E>(self: Dequeue<A, E>): Effect<Array<A>, E>

// TxQueue.ts - Returns void, category "combinators"
export const clear = <A, E>(self: TxEnqueue<A, E>): Effect<void>
```

**Solution:**
- Align both to return `Array<A>` (observable operations)
- Fix Queue's category from "taking" to "combinators"
- Change TxQueue to return cleared items

### 6. ❌ WRONG: Queue Missing `Enqueue` Interface (MEDIUM PRIORITY)

**Current State:**
```typescript
// TxQueue.ts - THREE interfaces (correct structure)
TxEnqueue<in A, in E>  // Write-only (contravariant)
TxDequeue<out A, out E>  // Read-only (covariant)
TxQueue<in out A, in out E>  // Full queue (invariant)

// Queue.ts - TWO interfaces (incomplete)
Dequeue<out A, out E>  // Read-only
Queue<in out A, in out E>  // Full queue
// MISSING: Enqueue<in A, in E>
```

**Solution:**
- Add `Enqueue<in A, in E>` interface to Queue.ts
- Update `Queue` to extend both `Enqueue` and `Dequeue`
- Add `isEnqueue` guard and `asEnqueue` converter
- Enables type-safe producer-consumer patterns

### 7. ❌ WRONG: Return Type Inconsistencies (MEDIUM PRIORITY)

**Issue 7a: `offerAll` returns different types**
- Queue.ts: `Effect<Array<A>>` (remaining messages)
- TxQueue.ts: `Effect<Chunk<A>>` (rejected items)
- **Solution:** Both return `Array<A>`

**Issue 7b: Signature patterns need unified `Cause.Done`**
- All `E | Done` → `E | Cause.Done`
- All `Exclude<E, Done>` → `Exclude<E, Cause.Done>`
- All `E | Cause.NoSuchElementError` → `E | Cause.Done`

## Implementation Plan

### Phase 0: Unified Completion API (HIGHEST PRIORITY)

#### Step 1: Create `Cause.Done` Error Type
**File:** `packages/effect/src/Cause.ts` + `packages/effect/src/internal/core.ts`

```typescript
/**
 * Type identifier for Done errors.
 * @since 4.0.0
 * @category symbols
 */
export const DoneTypeId: "~effect/Cause/Done" = "~effect/Cause/Done" as const

/**
 * Represents a graceful completion signal for queues and streams.
 * 
 * `Done` is used to signal that a queue or stream has completed normally
 * and no more elements will be produced. This is distinct from an error
 * or interruption - it represents successful completion.
 *
 * @example
 * ```ts
 * import { Cause, Effect } from "effect"
 * import { Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number, Cause.Done>(10)
 *   
 *   yield* Queue.offer(queue, 1)
 *   yield* Queue.offer(queue, 2)
 *   
 *   // Signal completion
 *   yield* Queue.end(queue)
 *   
 *   // Taking from ended queue fails with Done
 *   const result = yield* Effect.flip(Queue.take(queue))
 *   console.log(Cause.isDone(result)) // true
 * })
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface Done extends YieldableError {
  readonly [DoneTypeId]: typeof DoneTypeId
  readonly _tag: "Done"
}

/**
 * Creates a `Done` error to signal graceful completion.
 * @since 4.0.0
 * @category constructors
 */
export const Done: new() => Done

/**
 * Tests if a value is a `Done` error.
 * @since 4.0.0
 * @category guards
 */
export const isDone: (u: unknown) => u is Done
```

#### Step 2: Remove Queue's `done()` Operations
**File:** `packages/effect/src/Queue.ts`

**DELETE:**
- Line ~816: `done()` operation
- Line ~850: `doneUnsafe()` operation

**REFACTOR:**
```typescript
// Change fail and end to call failCause directly
export const fail = <A, E>(self: Queue<A, E>, error: E): Effect<boolean> =>
  failCause(self, Cause.fail(error))

export const end = <A, E>(self: Queue<A, E | Cause.Done>): Effect<boolean> =>
  failCause(self, Cause.fail(new Cause.Done()))
```

#### Step 3: Migrate Queue.ts Signatures to `Cause.Done`
**File:** `packages/effect/src/Queue.ts`

**Update locations:**
- Line 750: `end` signature
- Line 783: `endUnsafe` signature  
- Line 968-992: **DELETE** local `Done` interface, `isDone`, `filterDone`
- Line 1040: `collect` signature (both patterns)
- Line 1244-1245: `await_` signature
- Line 1434-1446: `into` signatures
- Line 1476: `toPull` signature (both patterns)
- Line 1499-1500: `toPullArray` signature

**Search/Replace patterns:**
```typescript
E | Done                    →    E | Cause.Done
Exclude<E, Done>            →    Exclude<E, Cause.Done>
```

**Add import:**
```typescript
import { Done } from "./Cause.ts"
```

#### Step 4: Migrate TxQueue.ts from `NoSuchElementError` to `Cause.Done`
**File:** `packages/effect/src/stm/TxQueue.ts`

**Update locations:**
- Line 208-211: JSDoc example in `TxEnqueue` interface
- Line 1273-1308: `end` function signature + implementation
- Line 1287: Example type annotation
- Line 1295-1300: JSDoc examples with `isNoSuchElementError`

**Search/Replace patterns:**
```typescript
E | Cause.NoSuchElementError       →    E | Cause.Done
Exclude<E, Cause.NoSuchElementError> →  Exclude<E, Cause.Done>
Cause.NoSuchElementError           →    Cause.Done
Cause.isNoSuchElementError         →    Cause.isDone
new Cause.NoSuchElementError()     →    new Cause.Done()
```

#### Step 5: Add `interrupt` to Queue.ts
**File:** `packages/effect/src/Queue.ts`

```typescript
/**
 * Interrupts the queue, transitioning it to a closing state.
 * Existing items can still be consumed, but no new items will be accepted.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(10)
 *   yield* Queue.offer(queue, 1)
 *   yield* Queue.offer(queue, 2)
 *
 *   // Gracefully close - no more offers, but can drain
 *   yield* Queue.interrupt(queue)
 *
 *   // Can still take existing items
 *   const item = yield* Queue.take(queue)
 *   console.log(item) // 1
 * })
 * ```
 *
 * @category completion
 * @since 4.0.0
 */
export const interrupt = <A, E>(self: Queue<A, E>): Effect<boolean> =>
  Effect.withFiber((fiber) => failCause(self, Cause.interrupt(fiber.id)))
```

#### Step 6: Fix `clear` Semantics
**File:** `packages/effect/src/Queue.ts`

```typescript
// Change category annotation
// @category combinators  (was: taking)
export const clear = <A, E>(self: Dequeue<A, E>): Effect<Array<A>, E>
```

**File:** `packages/effect/src/stm/TxQueue.ts`

```typescript
// Change to return Array<A> instead of void
export const clear = <A, E>(self: TxEnqueue<A, E>): Effect.Effect<Array<A>> =>
  Effect.atomic(
    Effect.gen(function*() {
      const chunk = yield* TxChunk.get(self.items)
      const items = Chunk.toArray(chunk)
      yield* TxChunk.set(self.items, Chunk.empty())
      return items
    })
  )
```

#### Step 7: Refactor `shutdown` Composition
**File:** `packages/effect/src/Queue.ts`

```typescript
export const shutdown = <A, E>(self: Queue<A, E>): Effect<boolean> =>
  Effect.gen(function*() {
    yield* clear(self)        // Clear items first
    return yield* interrupt(self)  // Then interrupt
  })
```

### Phase 1: Interface Structure Alignment

#### Step 1: Add `Enqueue` Interface to Queue.ts
**File:** `packages/effect/src/Queue.ts`

```typescript
const EnqueueTypeId = "~effect/Queue/Enqueue"

/**
 * An `Enqueue` represents the write-only interface of a queue.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Queue } from "effect"
 *
 * const producer = (enqueue: Queue.Enqueue<number>) =>
 *   Effect.gen(function*() {
 *     yield* Queue.offer(enqueue, 1)
 *     yield* Queue.offerAll(enqueue, [2, 3, 4])
 *   })
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface Enqueue<in A, in E = never> extends Inspectable {
  readonly [EnqueueTypeId]: Enqueue.Variance<A, E>
  readonly strategy: "suspend" | "dropping" | "sliding"
  readonly scheduler: Scheduler
  capacity: number
  messages: MutableList.MutableList<any>
  state: Queue.State<any, any>
  scheduleRunning: boolean
}

export declare namespace Enqueue {
  export interface Variance<A, E> {
    _A: Types.Contravariant<A>
    _E: Types.Contravariant<E>
  }
}

/**
 * Type guard to check if a value is an Enqueue.
 * @since 4.0.0
 * @category guards
 */
export const isEnqueue = <A = unknown, E = unknown>(
  u: unknown
): u is Enqueue<A, E> => hasProperty(u, EnqueueTypeId)

/**
 * Convert a Queue to an Enqueue, allowing only write operations.
 * @since 4.0.0
 * @category conversions
 */
export const asEnqueue: <A, E>(self: Queue<A, E>) => Enqueue<A, E> = identity
```

#### Step 2: Update Queue Interface
**File:** `packages/effect/src/Queue.ts`

```typescript
// Change from:
export interface Queue<in out A, in out E = never> extends Dequeue<A, E>

// To:
export interface Queue<in out A, in out E = never> 
  extends Enqueue<A, E>, Dequeue<A, E>
```

#### Step 3: Update Proto
```typescript
const QueueProto = {
  [TypeId]: variance,
  [DequeueTypeId]: variance,
  [EnqueueTypeId]: variance,  // ADD THIS
  ...PipeInspectableProto,
  // ...
}
```

### Phase 2: Critical Return Type Fixes

#### Step 1: Fix TxQueue `takeAll` Return Type
**File:** `packages/effect/src/stm/TxQueue.ts`

```typescript
// Change from:
export const takeAll = <A, E>(self: TxDequeue<A, E>): Effect.Effect<ReadonlyArray<A>, E>

// To:
export const takeAll = <A, E>(self: TxDequeue<A, E>): Effect.Effect<Arr.NonEmptyArray<A>, E>
```

#### Step 2: Align `offerAll` Return Type
**File:** `packages/effect/src/stm/TxQueue.ts`

```typescript
// Change from:
export const offerAll = <A, E>(
  self: TxEnqueue<A, E>, 
  values: Iterable<A>
): Effect.Effect<Chunk.Chunk<A>>

// To:
export const offerAll = <A, E>(
  self: TxEnqueue<A, E>, 
  values: Iterable<A>
): Effect.Effect<Array<A>>

// Update implementation to return Array instead of Chunk
```

### Phase 3: Missing Operations

#### Add to Queue.ts:
- `poll` - non-blocking take (returns `Option<A>`)
- `peek` - inspect without removing

#### Add to TxQueue.ts:
- `collect` - take all until done/error

### Phase 4: Documentation & Validation

1. Update all JSDoc examples to use `Cause.Done`
2. Update test files for both modules
3. Run validation:
   - `pnpm lint --fix` on modified files
   - `pnpm check` for type errors
   - `pnpm docgen` for example compilation
   - `pnpm test` for all tests

## Breaking Changes Summary

### Breaking Change #1: Unified Completion Type
```typescript
// Before
Queue<number, Queue.Done>
TxQueue<number, Cause.NoSuchElementError>

// After (both identical)
Queue<number, Cause.Done>
TxQueue<number, Cause.Done>
```

**Migration:**
```typescript
// Queue users: Change imports
import { Queue } from "effect"
// Remove: import type { Done } from "effect/Queue"
import { Cause } from "effect"

// Type annotations
const queue: Queue<number, Queue.Done>  // Before
const queue: Queue<number, Cause.Done>  // After

// TxQueue users: Similar change
const queue: TxQueue<number, Cause.NoSuchElementError>  // Before
const queue: TxQueue<number, Cause.Done>  // After
```

### Breaking Change #2: Remove `Queue.done()` Operation
```typescript
// Before
yield* Queue.done(queue, Exit.fail(error))
yield* Queue.done(queue, Exit.succeed(undefined))

// After
yield* Queue.failCause(queue, Cause.fail(error))
yield* Queue.end(queue)  // For graceful completion
```

**Migration:**
- Replace `Queue.done(queue, Exit.fail(e))` with `Queue.failCause(queue, Cause.fail(e))`
- Replace `Queue.done(queue, Exit.succeed())` with `Queue.end(queue)`
- No `doneUnsafe` equivalent - use `failCauseUnsafe` or `endUnsafe`

### Breaking Change #3: `takeAll` Return Type
```typescript
// Before (TxQueue)
const items: ReadonlyArray<number> = yield* TxQueue.takeAll(queue)
if (items.length > 0) { ... }  // Unnecessary check!

// After (TxQueue)
const items: NonEmptyArray<number> = yield* TxQueue.takeAll(queue)
// Guaranteed non-empty, no check needed!
```

### Breaking Change #4: `clear` Return Type
```typescript
// Before (TxQueue)
yield* TxQueue.clear(queue)  // Returns void

// After (TxQueue)
const cleared = yield* TxQueue.clear(queue)  // Returns Array<A>
console.log("Cleared items:", cleared)
```

### Breaking Change #5: Queue Interface Structure
```typescript
// Before
Queue extends Dequeue  // Only two interfaces

// After
Queue extends Enqueue, Dequeue  // Three interfaces

// New capabilities
const enqueue: Queue.Enqueue<number> = queue  // Write-only
const dequeue: Queue.Dequeue<number> = queue  // Read-only (existing)
```

**Note:** This is mostly non-breaking as existing code continues to work. Only affects advanced type-level programming.

## Validation Checklist

After implementation, verify:

1. ✅ **No local Done types** - `grep "interface Done" Queue.ts` returns nothing
2. ✅ **No NoSuchElementError in queues** - `grep "NoSuchElementError" Queue.ts TxQueue.ts` returns nothing
3. ✅ **All Exclude patterns updated** - `grep "Exclude<E, Done>" Queue.ts` returns nothing without `Cause.`
4. ✅ **Consistent imports** - Both files import `Done` from `./Cause.ts`
5. ✅ **Tests pass** - `pnpm test Queue.test.ts TxQueue.test.ts`
6. ✅ **Types check** - `pnpm check`
7. ✅ **Examples compile** - `pnpm docgen`
8. ✅ **Both return NonEmptyArray** - `takeAll` signatures match
9. ✅ **Both return Array** - `offerAll` and `clear` signatures match
10. ✅ **Both have interrupt** - Queue and TxQueue have graceful close
11. ✅ **Both have Enqueue** - Three-interface structure matches

## Success Criteria

- ✅ `Cause.Done` exists and is used by both queues
- ✅ Queue's local `Done` type removed
- ✅ TxQueue uses `Cause.Done` (not `NoSuchElementError`)
- ✅ Queue's `done()` operation removed
- ✅ Both queues have `fail`, `failCause`, `end` as completion API
- ✅ Both queues have `interrupt` for graceful close
- ✅ `takeAll` returns `NonEmptyArray<A>` in both queues
- ✅ `offerAll` returns `Array<A>` in both queues
- ✅ `clear` returns `Array<A>` in both queues
- ✅ Both queues have `Enqueue`, `Dequeue`, `Queue` interfaces
- ✅ All signatures use consistent completion types
- ✅ All tests pass
- ✅ `pnpm docgen` succeeds
- ✅ `pnpm check` succeeds

## Rationale

### Why `Cause.Done` Over `NoSuchElementError`?
- **Semantic correctness**: Completion is not "not finding something"
- **Consistency**: Same concept = same type
- **Clarity**: `Done` clearly signals "finished normally"

### Why Remove `Queue.done()`?
- **Simpler API**: `failCause` is more natural than `done(Exit<...>)`
- **Consistency**: TxQueue doesn't have it, shouldn't be different
- **Power**: `Cause<E>` can represent ANY completion scenario
- **Type safety**: Clearer signature without complex conditional types

### Why `takeAll` Returns `NonEmptyArray`?
- **Type honesty**: Implementation blocks until ≥1 item available
- **User benefit**: No unnecessary empty checks
- **Correctness**: Type reflects runtime behavior

### Why Add `Enqueue` Interface?
- **Type safety**: Restrict operations at type level
- **Consistency**: Match TxQueue's structure
- **Patterns**: Enable producer-consumer separation
- **Variance**: Proper contravariant producer type

### Why `clear` Returns `Array<A>`?
- **Observability**: See what was cleared (useful for debugging)
- **Consistency**: Both queues behave the same
- **Less breaking**: Queue already has this signature
