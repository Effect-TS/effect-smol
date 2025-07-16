# Plan: Multiple Failure Support for Effect.forEach and Related APIs

## Problem Statement

Currently, `Effect.forEach` only adds one failure when concurrency is set to greater than one. When multiple concurrent operations fail, only the first failure is captured and returned, while subsequent failures are lost. This limits the ability to collect comprehensive error information from concurrent operations.

## Current Behavior Analysis

### Effect.forEach Implementation (`packages/effect/src/internal/effect.ts:3043-3162`)

**Current fail-fast logic (lines 3129-3134):**
```typescript
if (exit._tag === "Failure") {
  if (result === undefined) {
    result = exit              // ← Only first failure is captured
    length = index            // ← Stop scheduling new work
    fibers.forEach((fiber) => fiber.unsafeInterrupt()) // ← Cancel all others
  }
}
```

**Limitations:**
- Multiple concurrent failures are not collected together
- Information about other concurrent failures is lost
- No partial success handling when some effects fail
- No validation patterns for comprehensive error collection
 **`Effect.forEach`** - Currently fail-fast with concurrency > 1

## Solution Design

### 1. Core Implementation Changes

**In `internal/effect.ts` forEach implementation:**

```typescript
// Current fail-fast logic (lines 3129-3134)
if (exit._tag === "Failure") {
  if (result === undefined) {
    result = exit              // ← Only first failure
    length = index            // ← Stop processing
    fibers.forEach((fiber) => fiber.unsafeInterrupt())
  }
}

// New accumulating logic for validate/either modes
if (exit._tag === "Failure") {
  failures.push(exit.cause)  // ← Collect all failures
  if (!done) {
    done = true
    length = index
    fibers.forEach((fiber) => fiber.unsafeInterrupt())
  }
}
```

## Implementation Plan

### Phase 1: Core forEach Enhancement

1. **Modify internal implementation** (`packages/effect/src/internal/effect.ts:3043-3162`)
   - Add failure collection logic
   - Use `Cause.fromFailures()` for combining multiple failures

3. **Add tests** (`packages/effect/test/Effect.test.ts`)
   - Test that multiple failures are collected
   - Test inside an uninterruptable region too
