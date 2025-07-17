# Effect Package Categorization Plan

## Overview

This plan organizes the 77 top-level files in `packages/effect/src/` into logical subfolders to improve maintainability and developer experience. The categorization follows functional domain boundaries and existing patterns established by the `batching/`, `caching/`, `config/`, `platform/`, `schema/`, and `unstable/` folders.

## Analysis Summary

Based on comprehensive analysis, the 77 files fall into the following functional categories:

### Current Structure

- **Existing organized folders**: 6 folders with 2-15 files each

## Proposed Folder Structure

### 1. **collections/**

**Purpose**: Data structures and collection utilities

- `Array.ts` - Array utilities and operations
- `Chunk.ts` - High-performance immutable sequences
- `HashMap.ts` - Immutable hash-based maps
- `HashSet.ts` - Immutable hash-based sets
- `Iterable.ts` - Lazy sequence processing
- `MutableHashMap.ts` - Mutable hash maps
- `MutableHashSet.ts` - Mutable hash sets
- `MutableList.ts` - Mutable linked lists
- `NonEmptyIterable.ts` - Non-empty sequence guarantees
- `Graph.ts` - Graph data structures
- `Symbol.ts` - Symbol utilities
- `Trie.ts` - Prefix tree structures

### 2. **primitives/**

**Purpose**: Enhanced primitive type wrappers

- `BigDecimal.ts` - Arbitrary precision decimal arithmetic
- `BigInt.ts` - Large integer operations
- `Boolean.ts` - Boolean logic utilities
- `Number.ts` - Numeric operations
- `String.ts` - String manipulation
- `RegExp.ts` - Regular expression utilities

### 3. **data/**

**Purpose**: Core data types and structures

- `Option.ts` - Optional values
- `Result.ts` - Success/failure computations
- `Data.ts` - Structural equality data types
- `Brand.ts` - Branded type system
- `Redacted.ts` - Secure value handling
- `Record.ts` - Immutable key-value mappings
- `Struct.ts` - Object structure utilities
- `Tuple.ts` - Fixed-length array operations
- `Equivalence.ts` - Equivalence relations
- `Order.ts` - Total ordering operations
- `Ordering.ts` - Ordering result manipulation
- `Predicate.ts` - Boolean predicates and type guards
- `Filter.ts` - Filtering operations

### 4. **concurrency/**

**Purpose**: Concurrency primitives and synchronization

- `Deferred.ts` - One-time asynchronous variables
- `FiberHandle.ts` - Fiber container management
- `FiberMap.ts` - Keyed fiber collections
- `FiberSet.ts` - Fiber set collections
- `Queue.ts` - Asynchronous queues
- `PubSub.ts` - Publish-subscribe message hubs
- `Ref.ts` - Thread-safe atomic references
- `MutableRef.ts` - Simple mutable references

### 5. **resources/**

**Purpose**: Resource management

- `LayerMap.ts` - Dynamic layer management
- `RcRef.ts` - Reference-counted references
- `RcMap.ts` - Reference-counted maps
- `Scope.ts` - Resource lifecycle management

### 6. **stream/**

**Purpose**: Streaming data processing

- `Stream.ts` - Lazy pull-based streaming
- `Channel.ts` - Bi-directional I/O operations
- `Sink.ts` - Stream consumption
- `Pull.ts` - Low-level streaming primitives

### 7. **scheduling/**

**Purpose**: Task scheduling and retry logic

- `Schedule.ts` - Retry and repetition strategies

### 8. **time/**

**Purpose**: Time management and temporal utilities

- `Clock.ts` - Time-based operations service
- `Duration.ts` - Time span representation
- `DateTime.ts` - Date and time with timezone support
- `Cron.ts` - Cron expression scheduling

### 9. **logging/**

**Purpose**: Logging and debugging utilities

- `Console.ts` - Console operations service
- `Logger.ts` - Structured logging system
- `LogLevel.ts` - Log level management

### 10. **observability/**

**Purpose**: Monitoring and observability

- `Metric.ts` - Application metrics collection
- `Tracer.ts` - Distributed tracing

### 11. **transactions/**

**Purpose**: Transactional operations and management

- `TxQueue.ts` - Transactional queues
- `TxRef.ts` - Transactional references
- `TxSemaphore.ts` - Transactional semaphores
- `TxChunk.ts` - Transactional chunks
- `TxHashMap.ts` - Transactional hash maps
- `TxHashSet.ts` - Transactional hash sets

### 12. **interfaces/**

**Purpose**: Interfaces

- `Pipeable.ts` - Pipe operation support
- `Equal.ts` - Value equality operations
- `Hash.ts` - Value hashing utilities
- `PrimaryKey.ts` - Unique identifier interface
- `Inspectable.ts` - Inspection and debugging

### 13. **encoding/**

- `Encoding.ts` - Data encoding/decoding utilities

### 13. **runtime/**

- `ManagedRuntime.ts` - Managed runtime lifecycle
- `Runtime.ts` - Effect execution utilities
- `Fiber.ts` - Lightweight concurrency units
- `Scheduler.ts` - Task execution management

### 14. **match/**

- `Match.ts` - Type-safe pattern matching

### 15. **types/**

- `HKT.ts` - Higher-kinded types
- `Types.ts` - Common type utilities
- `Unify.ts` - Type unification system

### 16. **services/**

- `ServiceMap.ts` - Dependency injection container
- `Layer.ts` - Dependency injection system
- `References.ts` - Runtime configuration references

### 17. **testing/**

- `FastCheck.ts` - Property-based testing
- `TestConsole.ts` - Testing console implementation
- `TestClock.ts` - Testable time control

### 17. Remain at the top level

Do not move the following files.

- `Effect.ts` - Core Effect abstraction
- `Exit.ts` - Effect computation results
- `Cause.ts` - Structured error information
- `Utils.ts` - General utilities
- `Function.ts` - Core functional programming utilities

## Implementation Strategy

### Phase 1: Create Folder Structure

1. Create all new subfolders in `packages/effect/src/`
2. Each folder will have an `.index.ts` file, similar to existing patterns like
   `batching/.index.ts`. `index.ts` files are automatically generated using
   `pnpm codegen`.

### Phase 2: Move Files

1. Move files to their respective folders
2. Update internal import paths within moved files

### Phase 3: Update Exports

1. Maintain backward compatibility - all exports should remain the same
2. Update any example files or documentation

### Phase 4: Validation

1. Run `pnpm codegen` to regenerate index files
2. Run `pnpm check` to ensure TypeScript compilation
3. Run `pnpm docgen` to ensure documentation builds
4. Run tests to ensure functionality remains intact

## Rationale

### Benefits

1. **Improved Developer Experience**: Easier to find related functionality
2. **Logical Organization**: Files grouped by functional domain
3. **Maintainability**: Clear separation of concerns
4. **Scalability**: Room for future growth within each category
5. **Consistency**: Follows existing patterns in the codebase

### Considerations

1. **Backward Compatibility**: All public exports remain unchanged
2. **Import Paths**: Internal imports will be updated but public API stays same
3. **Documentation**: Examples and docs will reference new structure internally
4. **Bundle Size**: No impact on bundle size, just reorganization

## Migration Safety

- All public exports remain exactly the same
- No breaking changes to the public API
- Internal organization only - external consumers unaffected
- Comprehensive validation before completion

## Expected Outcome

A well-organized codebase where:

- Related functionality is co-located
- New contributors can easily find relevant code
- Maintenance becomes easier due to logical grouping
- The structure scales well for future additions
- Public API remains completely unchanged
