# TxSemaphore Implementation Plan

## Overview
Port the TSemaphore module from the main Effect repository to create a new TxSemaphore module for the effect-smol repository. TxSemaphore will be a transactional semaphore providing Software Transactional Memory (STM) semantics for permit management, consistent with the existing TxHashMap, TxQueue, and TxHashSet patterns.

## Source Analysis
**Source**: https://github.com/Effect-TS/effect/blob/main/packages/effect/src/TSemaphore.ts

The original TSemaphore provides:
- Transactional permit management using STM semantics
- Acquire and release operations with permit counts
- Scoped permit acquisition for automatic cleanup
- Atomic operations for concurrent access
- Type-safe permit counting with bounded capacity

## Goals
1. **API Consistency**: Match the local conventions used in TxHashMap and TxQueue
2. **Transaction Semantics**: Use Effect.Effect instead of STM.STM for local patterns
3. **Documentation Standards**: Include mutation vs return behavior documentation
4. **Type Safety**: Maintain type safety and permit counting accuracy
5. **Testing**: Comprehensive test coverage following local patterns

## Implementation Strategy

### Phase 1: Core Structure and Types
**Estimated Time**: 2-3 hours
**🚨 LINT AFTER EVERY CHANGE**: `pnpm lint --fix packages/effect/src/TxSemaphore.ts`

#### 1.1 Basic Types and Interfaces ✅ COMPLETED
- [x] Define TypeId:
  - `export const TypeId: TypeId = "~effect/TxSemaphore"`
- [x] Create `TxSemaphore` interface extending Inspectable and Pipeable
- [x] ~~Add variance interface for type safety~~ (Not needed for non-generic modules)
- [x] Create `TxSemaphore` namespace with type utilities
- [x] Use `@since 4.0.0` annotation for consistency

#### 1.2 Internal Data Structure ✅ COMPLETED
- [x] Design internal semaphore object:
  - `readonly [TypeId]: TypeId`
  - `readonly permitsRef: TxRef.TxRef<number>`
  - `readonly capacity: number`
- [x] Add type guard: `isTxSemaphore(u): u is TxSemaphore`
- [x] Implement Inspectable directly in the semaphore object

### Phase 2: Constructor Functions ✅ COMPLETED
**Estimated Time**: 1-2 hours
**🚨 LINT AFTER EVERY CHANGE**: `pnpm lint --fix packages/effect/src/TxSemaphore.ts`

#### 2.1 Core Constructor ✅ COMPLETED
- [x] `make(permits: number): Effect.Effect<TxSemaphore>` - Create semaphore with initial permits

#### 2.2 Implementation Pattern ✅ COMPLETED
- [x] Use `Effect.gen` with `TxRef.make` to create internal refs
- [x] Create semaphore objects using prototype pattern with proper Inspectable implementation

**Documentation**: ✅ Added **Return behavior** documentation to constructors

### Phase 3: Core Semaphore Operations ✅ COMPLETED
**Estimated Time**: 3-4 hours
**🚨 LINT AFTER EVERY CHANGE**: `pnpm lint --fix packages/effect/src/TxSemaphore.ts`

#### 3.1 Standalone Functions ✅ COMPLETED

**Permit Acquisition Operations:**
- [x] `acquire(self: TxSemaphore): Effect.Effect<void>` - Acquire single permit (blocks if unavailable)
- [x] `acquireN(self: TxSemaphore, n: number): Effect.Effect<void>` - Acquire N permits (blocks if unavailable)
- [x] `tryAcquire(self: TxSemaphore): Effect.Effect<boolean>` - Try acquire, non-blocking
- [x] `tryAcquireN(self: TxSemaphore, n: number): Effect.Effect<boolean>` - Try acquire N permits, non-blocking

**Permit Release Operations:**
- [x] `release(self: TxSemaphore): Effect.Effect<void>` - Release single permit
- [x] `releaseN(self: TxSemaphore, n: number): Effect.Effect<void>` - Release N permits

**Inspection Operations:**
- [x] `available(self: TxSemaphore): Effect.Effect<number>` - Current available permits
- [x] `capacity(self: TxSemaphore): Effect.Effect<number>` - Maximum permits

**Documentation**: ✅ Added appropriate **Mutation behavior** vs **Observer behavior** documentation

### Phase 4: Scoped Operations ✅ COMPLETED
**Estimated Time**: 2-3 hours
**🚨 LINT AFTER EVERY CHANGE**: `pnpm lint --fix packages/effect/src/TxSemaphore.ts`

#### 4.1 Scoped Permit Management ✅ COMPLETED
- [x] `withPermit<A>(self: TxSemaphore, effect: Effect.Effect<A>): Effect.Effect<A>` - Execute with single permit
- [x] `withPermits<A>(self: TxSemaphore, n: number, effect: Effect.Effect<A>): Effect.Effect<A>` - Execute with N permits
- [x] `withPermitScoped(self: TxSemaphore): Effect.Effect<void, never, Scope.Scope>` - Scoped permit acquisition

#### 4.2 Implementation Notes ✅ COMPLETED
- [x] Use `Effect.acquireRelease` for automatic cleanup
- [x] Ensure permits are released even on interruption or errors
- [x] Handle permit counting correctly in all scenarios

### Phase 5: Testing and Validation ✅ COMPLETED
**Estimated Time**: 4-5 hours

#### 5.1 Linting Requirements ✅ COMPLETED
- [x] **🚨 CRITICAL**: Run `pnpm lint --fix packages/effect/src/TxSemaphore.ts` after EVERY edit
- [x] **🚨 CRITICAL**: Run `pnpm lint --fix packages/effect/test/TxSemaphore.test.ts` after EVERY test edit
- [x] Run `pnpm check` for type checking validation
- [x] Run `pnpm docgen` to ensure JSDoc examples compile

#### 5.2 Comprehensive Test Suite
**Constructor Tests:**
- [ ] `make(permits)` - Create semaphore with specified capacity
- [ ] Edge cases: `make(0)`, `make(1)`, large permit counts

**Basic Operations Tests:**
- [ ] `acquire(semaphore)` - Single permit acquisition (blocking behavior)
- [ ] `acquireN(semaphore, n)` - Multiple permit acquisition
- [ ] `release(semaphore)` - Single permit release
- [ ] `releaseN(semaphore, n)` - Multiple permit release
- [ ] `tryAcquire(semaphore)` - Non-blocking acquisition
- [ ] `tryAcquireN(semaphore, n)` - Non-blocking multiple acquisition

**Semaphore State Tests:**
- [ ] `available(semaphore)` - Current available permits
- [ ] `capacity(semaphore)` - Maximum permit capacity
- [ ] Permit counting accuracy across operations

**Scoped Operations Tests:**
- [ ] `withPermit(semaphore, effect)` - Scoped single permit
- [ ] `withPermits(semaphore, n, effect)` - Scoped multiple permits
- [ ] `withPermitScoped(semaphore)` - Manual scoped acquisition
- [ ] Automatic cleanup on success, error, and interruption

**Concurrency and Blocking Tests:**
- [ ] Multiple fibers waiting for permits
- [ ] Fair permit distribution (FIFO behavior)
- [ ] Permit exhaustion and waiting scenarios
- [ ] High contention scenarios

**Edge Cases and Error Conditions:**
- [ ] Acquiring more permits than capacity
- [ ] Releasing more permits than acquired
- [ ] Negative permit counts (should be prevented)
- [ ] Zero permit semaphores
- [ ] Large permit count operations

**Transaction Semantics Tests:**
- [ ] Single operation atomicity (automatic transaction wrapping)
- [ ] Multi-step atomic operations using `Effect.transaction`
- [ ] Retry behavior for blocking operations (`acquire` on empty semaphore)
- [ ] Conflict detection and resolution
- [ ] Transaction rollback scenarios

**Type Safety Tests:**
- [ ] Type guard functions (`isTxSemaphore`)
- [ ] Variance type checking

#### 5.3 Test Implementation Pattern
```typescript
describe("TxSemaphore", () => {
  describe("constructors", () => {
    it.effect("make creates semaphore with specified permits", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(5)
        const available = yield* TxSemaphore.available(semaphore)
        const capacity = yield* TxSemaphore.capacity(semaphore)
        
        assert.strictEqual(available, 5)
        assert.strictEqual(capacity, 5)
      }))
  })
  
  describe("basic operations", () => {
    it.effect("acquire and release work correctly", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(3)
        
        yield* TxSemaphore.acquire(semaphore)
        const available = yield* TxSemaphore.available(semaphore)
        assert.strictEqual(available, 2)
        
        yield* TxSemaphore.release(semaphore)
        const availableAfter = yield* TxSemaphore.available(semaphore)
        assert.strictEqual(availableAfter, 3)
      }))
  })
  
  // ... more test patterns
})
```

#### 5.4 Test Porting Strategy
- [ ] **Adapt STM.commit to Effect.transaction**: Convert STM patterns to Effect patterns
- [ ] **Convert pipe chains**: Adapt functional composition to Effect.gen style
- [ ] **Update imports**: Change from STM imports to Effect/TxSemaphore imports
- [ ] **Preserve test logic**: Keep the same test scenarios and assertions
- [ ] **Add Effect-specific tests**: Test Effect.retryTransaction behavior

#### 5.5 Performance and Integration Tests
- [ ] High-contention scenarios (100+ concurrent acquires)
- [ ] Memory usage patterns for large permit counts
- [ ] Fairness testing for permit distribution
- [ ] Integration with existing Effect patterns
- [ ] Scoped cleanup performance

#### 5.6 Validation Checklist
- [ ] All ported tests pass (target: 25+ test cases)
- [ ] Type checking passes: `pnpm check`
- [ ] Linting passes: `pnpm lint`
- [ ] JSDoc examples compile: `pnpm docgen`
- [ ] No `any` types in implementation or tests
- [ ] 100% test coverage for public API
- [ ] Performance benchmarks within acceptable ranges

### Phase 6: Documentation and Polish
**Estimated Time**: 2-3 hours
**🚨 LINT AFTER EVERY CHANGE**: `pnpm lint --fix packages/effect/src/TxSemaphore.ts`

#### 6.1 JSDoc Documentation
- [ ] Comprehensive examples for each function
- [ ] Usage patterns and best practices
- [ ] Transaction context guidance
- [ ] Scoped operations usage
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
- **CRITICAL: Use Effect.atomic for internal transactions** - never use Effect.transaction in library code
- **CRITICAL: Never expose Effect.Transaction** in public API - keep it internal
- **Handle retry logic** with Effect.retryTransaction inside Effect.atomic
- **Pattern**: `Effect.atomic(Effect.gen(...))` for blocking operations

### 2. Interface Design
```typescript
// TypeId
export const TypeId: TypeId = "~effect/TxSemaphore"

// Variance interface
export interface Variance {
  readonly _tag: "TxSemaphore"
}

// Main interface
export interface TxSemaphore extends Inspectable, Pipeable {
  readonly [TypeId]: TxSemaphore.Variance
  readonly permitsRef: TxRef.TxRef<number>
  readonly capacity: number
}
```

### 3. Implementation Pattern
```typescript
// Constructor implementation
const make = (permits: number): Effect.Effect<TxSemaphore> =>
  Effect.gen(function*() {
    if (permits < 0) {
      return yield* Effect.fail(new Error("Permits must be non-negative"))
    }
    
    const permitsRef = yield* TxRef.make(permits)
    
    return {
      [TypeId]: { _tag: "TxSemaphore" },
      permitsRef,
      capacity: permits,
      [NodeInspectSymbol]() {
        return toJSON(this)
      },
      toJSON() {
        return { _id: "TxSemaphore", capacity: this.capacity }
      }
    }
  })

// Type guard
export const isTxSemaphore = (u: unknown): u is TxSemaphore => 
  hasProperty(u, TypeId)
```

### 4. Error Handling
- **Invalid permit counts**: Validate permit numbers are non-negative
- **Over-release**: Prevent releasing more permits than capacity
- **Underflow**: Handle edge cases in permit counting
- **Type safety**: Prevent runtime errors through strong typing

### 5. Performance Optimization
- **Minimize allocations** in hot paths
- **Efficient counting operations** for permit management
- **Fair scheduling** for waiting operations
- **Memory-conscious** implementation for high permit counts

## API Design Examples

### Constructor API
```typescript
// Create semaphore with specific permit count
const semaphore = yield* TxSemaphore.make(10)
```

### Basic Operations API
```typescript
// Acquire permits (mutation behavior)
yield* TxSemaphore.acquire(semaphore)           // Acquire single permit (blocks if unavailable)
yield* TxSemaphore.acquireN(semaphore, 3)       // Acquire 3 permits (blocks if unavailable)

// Try acquire permits (non-blocking, observer behavior)
const acquired = yield* TxSemaphore.tryAcquire(semaphore)    // Returns boolean
const acquiredN = yield* TxSemaphore.tryAcquireN(semaphore, 2) // Returns boolean

// Release permits (mutation behavior)
yield* TxSemaphore.release(semaphore)           // Release single permit
yield* TxSemaphore.releaseN(semaphore, 3)       // Release 3 permits

// Inspection operations (observer behavior)
const available = yield* TxSemaphore.available(semaphore)    // Current available permits
const capacity = yield* TxSemaphore.capacity(semaphore)      // Maximum permits
```

### Scoped Operations API
```typescript
// Automatic permit management with scopes
const result = yield* TxSemaphore.withPermit(semaphore, 
  Effect.gen(function*() {
    // Do work with permit - automatically released
    return yield* expensiveOperation()
  })
)

const resultN = yield* TxSemaphore.withPermits(semaphore, 3,
  Effect.gen(function*() {
    // Do work with 3 permits - automatically released
    return yield* batchOperation()
  })
)

// Manual scoped permit management
yield* Effect.scoped(
  Effect.gen(function*() {
    yield* TxSemaphore.withPermitScoped(semaphore)
    // Permit held for scope duration
    return yield* longRunningOperation()
  })
)
```

### Transaction API
```typescript
// Multi-step atomic operations
yield* Effect.transaction(
  Effect.gen(function* () {
    yield* TxSemaphore.acquire(resourceSemaphore)
    yield* TxSemaphore.acquire(workerSemaphore)
    // Both permits acquired atomically
    const result = yield* processWithBothResources()
    yield* TxSemaphore.release(resourceSemaphore)
    yield* TxSemaphore.release(workerSemaphore)
    return result
  })
)
```

## Success Criteria
1. **✅ Full API compatibility** with TSemaphore patterns adapted to local conventions
2. **✅ Comprehensive test coverage** with all scenarios covered
3. **✅ Type safety** with no `any` types and proper permit validation
4. **✅ Performance** comparable to other Tx data structures
5. **✅ Documentation** following established mutation/return behavior patterns
6. **✅ Integration** seamlessly with existing Effect patterns

## Dependencies
- **TxRef**: For transactional state management
- **Effect**: For effect management and transactions
- **Scope**: For scoped resource management
- **Function**: For dual signatures (if needed)

## Risks and Mitigation
1. **Complexity of permit counting**: Start with simple single/multiple acquire, ensure accuracy
2. **Transaction semantics**: Follow TxHashMap/TxQueue patterns closely
3. **Scoped operations**: Careful implementation of automatic cleanup
4. **Fairness concerns**: Ensure FIFO behavior for waiting operations

## Git Workflow and Development Workflow

### Branch Strategy
```
main (production)
  ↓
feat/tx-semaphore (feature branch) ✅ CURRENT
```

### Commit Strategy
```bash
# Phase-based commits
git commit -m "feat(TxSemaphore): implement core structure and constructor

- Add TypeId and TxSemaphore interface definition
- Implement make() constructor with permit validation
- Add TxRef<number> backing store for permit counting
- Set up basic permit tracking infrastructure
- Add to index.ts exports

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Quality Gates
- **Pre-Commit Checklist (MANDATORY):**
- [ ] `pnpm lint --fix packages/effect/src/TxSemaphore.ts` ✅ PASS
- [ ] `pnpm lint --fix packages/effect/test/TxSemaphore.test.ts` ✅ PASS (if tests exist)
- [ ] `pnpm check` ✅ NO TYPE ERRORS
- [ ] Phase-specific tests ✅ ALL PASS
- [ ] No `any` types introduced ✅ VERIFIED

## Estimated Timeline
**Total: 12-16 hours**
- Phase 1 (Core Structure): ~2.5 hours
- Phase 2 (Constructors): ~1.5 hours  
- Phase 3 (Core Operations): ~3.5 hours
- Phase 4 (Scoped Operations): ~2.5 hours
- Phase 5 (Testing): ~4.5 hours
- Phase 6 (Documentation): ~2.5 hours

## File Structure
```
packages/effect/src/
├── TxSemaphore.ts         # Main implementation
└── index.ts               # Export addition

packages/effect/test/
└── TxSemaphore.test.ts    # Comprehensive test suite
```

## 🚨 CRITICAL REMINDERS - LINTING ABSOLUTELY MANDATORY

### 🔥 LINTING REQUIREMENTS - NEVER SKIP EVER 🔥
**THE MOST IMPORTANT RULE: LINT IMMEDIATELY AFTER EVERY TYPESCRIPT FILE EDIT**

- **🚨 MANDATORY IMMEDIATE ACTION**: Run `pnpm lint --fix packages/effect/src/TxSemaphore.ts` IMMEDIATELY after EVERY SINGLE edit to the source file
- **🚨 MANDATORY IMMEDIATE ACTION**: Run `pnpm lint --fix packages/effect/test/TxSemaphore.test.ts` IMMEDIATELY after EVERY SINGLE edit to the test file  
- **🚨 MANDATORY IMMEDIATE ACTION**: Run `pnpm check` for type checking after EVERY change - fix ALL type errors immediately
- **🚨 MANDATORY IMMEDIATE ACTION**: Never proceed with type errors - all TypeScript errors must be resolved before continuing
- **🚨 MANDATORY IMMEDIATE ACTION**: Run `pnpm docgen` to validate JSDoc examples before committing

**LINTING WORKFLOW PATTERN:**
```bash
# 1. Edit TypeScript file
# 2. IMMEDIATELY run linting (NO EXCEPTIONS)
pnpm lint --fix packages/effect/src/TxSemaphore.ts
# 3. Fix any issues found
# 4. Continue with next edit only after linting passes
```

**KEY DOCGEN PATTERNS from .claude/context/docgen.md:**
- **Schema imports**: Use `import { Schema } from "effect/schema"` (lowercase 'schema')
- **Nested namespace types**: Use `Module.Namespace.Type` syntax (e.g., `Request.Request.Success` not `Request.Success`)
- **Type extractors**: For type-level utilities, demonstrate type extraction using conditional types and `infer`, not instance creation
- **Effect patterns**: Use `Effect.gen`, proper error handling, no try-catch in generators
- **Working examples**: All JSDoc examples MUST compile with `pnpm docgen`

### Testing Requirements (COMPREHENSIVE)
- **Target**: 25+ test cases covering all operations
- **Coverage**: 100% public API coverage required  
- **Pattern**: Use `it.effect` from `@effect/vitest` 
- **Quality**: All tests must pass before proceeding to next phase

### Effect Library Conventions (FROM CLAUDE.MD)
- **ABSOLUTELY FORBIDDEN**: try-catch in Effect.gen
- **ABSOLUTELY FORBIDDEN**: Type assertions (as never, as any, as unknown)
- **ABSOLUTELY FORBIDDEN**: Using `Effect.transaction` in library code
- **ABSOLUTELY FORBIDDEN**: Exposing `Effect.Transaction` in public API signatures
- **MANDATORY**: Return yield pattern for errors: `return yield* Effect.fail(...)`
- **MANDATORY**: Use `Effect.atomic` whenever Transaction is required (when using `Effect.retryTransaction`)
- **MANDATORY**: Keep public API clean - never propagate Transaction context to users
- **CRITICAL**: IMMEDIATELY run `pnpm lint --fix <file_path>` after editing ANY TypeScript file

### Documentation Standards (FROM DOCGEN.MD)  
- **JSDoc Examples**: Must compile with `pnpm docgen` - zero tolerance for errors
- **Import Patterns**: Follow exact patterns from docgen.md
- **Category Tags**: Use appropriate @category tags (constructors, combinators, utilities, etc.)
- **Practical Examples**: Show real-world use cases, not just API syntax
- **Scratchpad Development**: Use `./scratchpad/` for rapid prototyping, then clean up