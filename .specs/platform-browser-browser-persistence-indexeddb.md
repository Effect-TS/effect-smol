# BrowserPersistence IndexedDB persistence specification

## Overview
Add a new `BrowserPersistence` module to `@effect/platform-browser` that provides an IndexedDB-backed implementation of the unstable `effect/unstable/persistence/Persistence` service.

The new browser implementation should follow the spirit of the existing IndexedDB-backed EventJournal implementation:
- use `globalThis.indexedDB` directly
- manage the database connection with scoped resource acquisition
- wrap IndexedDB request / transaction callbacks in Effect primitives
- surface failures as typed domain errors

This work is planning-only. No implementation is performed by this specification.

## User-confirmed requirements
- Add a new module named `BrowserPersistence` in `packages/platform-browser/src/`.
- Expose both:
  - a backing layer for `Persistence.BackingPersistence`
  - a composed layer for `Persistence.Persistence`
- Access IndexedDB directly via `globalThis.indexedDB`; do **not** depend on the existing `@effect/platform-browser/IndexedDb` service.
- Use a **single** IndexedDB object store and persist `storeId` as a field on each row.
- Configuration should be minimal and only support an optional database name.
- Expired records should be deleted lazily when encountered by reads.
- Reuse the shared persistence test suite where applicable.

## Context from repository research
Relevant existing code and patterns:
- Core persistence API and backing-store contracts:
  - `packages/effect/src/unstable/persistence/Persistence.ts`
- Existing browser module style:
  - `packages/platform-browser/src/BrowserKeyValueStore.ts`
  - `packages/platform-browser/src/index.ts`
- Existing direct IndexedDB implementation pattern:
  - `packages/effect/src/unstable/eventlog/EventJournal.ts` `makeIndexedDb` / `layerIndexedDb`
- Existing browser IndexedDB tests and harness:
  - `packages/platform-browser/test/IndexedDbDatabase.test.ts`
- Shared persistence integration suites:
  - `packages/effect/test/unstable/persistence/PersistedCacheTest.ts`
  - `packages/effect/test/unstable/persistence/PersistedQueueTest.ts`

## Goals
1. Provide an IndexedDB-backed browser implementation for `Persistence.BackingPersistence`.
2. Provide a composed browser layer for `Persistence.Persistence` by reusing core `Persistence.layer`.
3. Keep the browser API small and aligned with current platform-browser module conventions.
4. Ensure TTL semantics match the core persistence expectations, including lazy deletion of expired entries.
5. Validate behavior with both direct backing-store tests and the shared persisted cache suite.

## Non-goals
- Do not introduce richer configuration beyond an optional database name.
- Do not depend on `@effect/platform-browser/IndexedDb`.
- Do not implement one object store per `storeId`.
- Do not add proactive background cleanup for expired entries.
- Do not manually edit generated barrel files; use `pnpm codegen`.

## Public API
Create a new source file:
- `packages/platform-browser/src/BrowserPersistence.ts`

Planned public surface:

```ts
import type * as Layer from "effect/Layer"
import * as Persistence from "effect/unstable/persistence/Persistence"

export interface Options {
  readonly database?: string | undefined
}

export const layerBackingIndexedDb: (
  options?: Options
) => Layer.Layer<Persistence.BackingPersistence>

export const layerIndexedDb: (
  options?: Options
) => Layer.Layer<Persistence.Persistence>
```

### Naming
Use the exact exported names:
- `layerBackingIndexedDb`
- `layerIndexedDb`

These names mirror existing core persistence naming and the EventJournal IndexedDB naming.

## Architectural design

### Layer composition
- `layerBackingIndexedDb` provides `Persistence.BackingPersistence`.
- `layerIndexedDb` is composed by taking core `Persistence.layer` and providing `layerBackingIndexedDb(options)`.
- `BrowserPersistence` must not add any extra environment requirements.

### Direct IndexedDB dependency
The implementation must use `globalThis.indexedDB` directly.
It must **not** require `IndexedDb.IndexedDb` from `packages/platform-browser/src/IndexedDb.ts`.

This means:
- production code uses `globalThis.indexedDB.open(...)`
- tests must install `fake-indexeddb` on `globalThis.indexedDB`

### Scoped resource management
The IndexedDB connection should be opened once per provided layer and kept in scope with:
- `Effect.acquireRelease` for opening / closing the `IDBDatabase`
- `Layer.effect(...)` to construct the service

This matches existing repository patterns and avoids leaking database handles.

## Storage model

### Database
- Default database name: `effect_persistence`
- Configurable override: `options?.database`
- IndexedDB version: `1`

### Object store
Use a single object store:
- object store name: `entries`

Record shape:

```ts
interface EntryRow {
  readonly storeId: string
  readonly id: string
  readonly value: object
  readonly expires: number | null
}
```

### Keys and indexes
- Primary key path: `["storeId", "id"]`
- Required secondary index: `storeId` (non-unique)

### Persisted value representation
- `id` stores the `PrimaryKey.value(key)` string used by core persistence.
- `value` stores the structured-cloneable encoded output that core persistence passes into `BackingPersistenceStore.set` / `setMany`.
- Values must **not** be JSON-stringified in this browser implementation.

This differs from some SQL / Redis implementations because IndexedDB can persist structured-cloneable objects directly.

## Detailed behavioral requirements

### Database initialization
On first open / upgrade:
1. Open the database with the configured name and version `1`.
2. In `onupgradeneeded`, create the `entries` object store with the composite key path.
3. Create the `storeId` secondary index.
4. Any initialization failure must surface as `Persistence.PersistenceError`.

### Clock and TTL handling
- The implementation must use `Clock` / `Effect.clockWith` rather than `Date.now` or `new Date`.
- Expiry timestamps should be computed via `Persistence.unsafeTtlToExpires(clock, ttl)`.
- `expires` is stored as:
  - `null` for non-expiring entries
  - epoch millis for expiring entries

### Transaction requirements
Because expired entries are deleted lazily during read paths:
- `get` must use a transaction mode that allows deletion in the same operation.
- `getMany` must use a transaction mode that allows deletion in the same operation.
- Lazy deletion should happen within the same transaction used for the read whenever possible.

Concretely, the backing-store implementation should use `readwrite` transactions for read operations that may delete expired rows.

### get
Behavior for `BackingPersistenceStore.get`:
1. Read the row by composite key `[storeId, id]`.
2. If the row does not exist, return `undefined`.
3. If the row exists and `expires` is `null` or in the future, return `value`.
4. If the row exists but is expired:
   - delete it lazily in the same operation
   - return `undefined`
5. If the read or delete fails, fail with `PersistenceError`.

### getMany
Behavior for `BackingPersistenceStore.getMany`:
1. Accept a non-empty array of ids.
2. Return an array whose length exactly matches the input length.
3. Preserve input ordering exactly.
4. Preserve duplicates exactly.
5. For each requested key:
   - return `value` when the row exists and is not expired
   - return `undefined` when the row is missing
   - lazily delete expired rows and return `undefined`
6. If any IndexedDB request or transaction fails, fail with `PersistenceError`.

### set
Behavior for `BackingPersistenceStore.set`:
1. Upsert a row for `[storeId, id]`.
2. Store `value` directly as structured clone data.
3. Store `expires` as `null` or computed epoch millis.
4. Fail with `PersistenceError` if the request or transaction fails.

### setMany
Behavior for `BackingPersistenceStore.setMany`:
1. Upsert every entry in the provided non-empty batch in a single `readwrite` transaction.
2. Preserve the exact values passed by core persistence.
3. Compute `expires` per row using the shared clock.
4. Fail with `PersistenceError` if any request or the transaction fails.

### remove
Behavior for `BackingPersistenceStore.remove`:
- Delete the row with composite key `[storeId, id]`.
- Missing rows are not an error.
- Failures map to `PersistenceError`.

### clear
Behavior for `BackingPersistenceStore.clear`:
- Delete only rows belonging to the bound `storeId`.
- `clear` must **not** call `objectStore.clear()`, because that would delete rows for other stores.
- Use the `storeId` secondary index to scan matching rows and delete them.
- Failures map to `PersistenceError`.

### Store isolation
Two persistence stores created with different `storeId` values must remain isolated even when:
- they use the same browser layer instance
- they share the same IndexedDB database
- they use the same logical key ids

### Error mapping
All IndexedDB failures should be mapped to `Persistence.PersistenceError` with operation-specific messages aligned with core persistence conventions.

Expected message patterns:
- `Failed to open backing store database`
- `Failed to get key ${key} from backing store`
- `Failed to getMany from backing store`
- `Failed to set key ${key} in backing store`
- `Failed to setMany in backing store`
- `Failed to remove key ${key} from backing store`
- `Failed to clear backing store`

Both request-level and transaction-level errors must be covered.
If lazy deletion of an expired entry fails, the corresponding read must fail rather than silently succeed.

## Implementation outline

### Module structure
Expected new file:
- `packages/platform-browser/src/BrowserPersistence.ts`

Expected private helpers inside the module:
- a small helper for wrapping `IDBRequest` success / error handling into `Effect.callback`
- a helper for wrapping whole transaction completion / failure when an operation spans multiple requests
- possibly a local row type alias / interface for IndexedDB records

### Core implementation approach
The implementation should mirror the EventJournal IndexedDB style where appropriate:
- construct request wrappers with `Effect.callback`
- use `Effect.sync`, `Effect.suspend`, `Effect.fnUntraced`, and `Effect.acquireRelease`
- avoid `async/await`, `try/catch`, `Date.now`, and Node APIs

### Internal operation strategy
Recommended strategy for each backing store instance:
- Capture the opened `IDBDatabase` and `Clock` in the service construction.
- Bind a `storeId`-specific view through `BackingPersistence.make(storeId)`.
- Use the `entries` object store and composite keys for direct point reads / writes.
- Use the `storeId` index plus cursor iteration for scoped clear.
- Use a single transaction per public backing-store operation.

## Test specification

### Test files to add
Planned test additions in `packages/platform-browser/test/`:
- `BrowserPersistence.test.ts` for direct backing-store behavior
- one integration test file for the shared persisted cache suite, for example:
  - `BrowserPersistencePersistedCache.test.ts`
  - or a similarly named file consistent with package conventions

### Test harness requirements
Because the implementation uses `globalThis.indexedDB` directly:
- install `fake-indexeddb` on `globalThis.indexedDB` in the test environment
- restore any previous global after tests if needed by surrounding tests
- delete the test database between tests
- prefer `describe.sequential` or unique database names to avoid IndexedDB cross-test interference

### Direct backing-store tests
Direct tests should verify at minimum:
1. **set + get**
   - store a value and retrieve it unchanged
2. **setMany + getMany**
   - preserve order
   - include missing keys
   - include duplicate keys if practical
3. **remove**
   - removed keys become `undefined`
4. **clear scoped to storeId**
   - clearing one logical store does not affect another
5. **TTL expiry and lazy deletion**
   - expired rows are returned as `undefined`
   - expired rows are actually removed when read
   - use `TestClock` rather than real time
6. **store isolation**
   - same key under two different `storeId` values remains isolated
7. **custom database option**
   - non-default database names work and are isolated from the default database

### Shared integration coverage
Reuse the shared persistence suite where applicable:
- add `PersistedCacheTest.suite(...)` coverage for `BrowserPersistence.layerIndexedDb(...)`

At this stage, the required shared-suite coverage is for the composed persistence layer through `PersistedCacheTest`.
Direct backing tests cover the low-level storage semantics.

## Files expected to change during implementation
Primary implementation files:
- `packages/platform-browser/src/BrowserPersistence.ts`
- `packages/platform-browser/test/BrowserPersistence.test.ts`
- `packages/platform-browser/test/BrowserPersistencePersistedCache.test.ts` (or equivalent)
- `packages/platform-browser/src/index.ts` via codegen output
- `.changeset/*.md`

Planning metadata files created by this specification task:
- `.specs/README.md`
- `.specs/platform-browser-browser-persistence-indexeddb.md`
- `.lalph/plan.json`

## Validation requirements for implementation
Implementation work must satisfy repository validation requirements.

### Required commands
After code changes:
1. `pnpm lint-fix`
2. targeted tests:
   - `pnpm test packages/platform-browser/test/BrowserPersistence.test.ts`
   - `pnpm test packages/platform-browser/test/BrowserPersistencePersistedCache.test.ts` (or actual filename)
3. `pnpm check:tsgo`
4. package-local docgen because the changes are localized to one package:
   - `cd packages/platform-browser && pnpm docgen`
5. if `check:tsgo` remains blocked by cache issues:
   - `pnpm clean`
   - rerun `pnpm check:tsgo`

### Code style / implementation constraints
The implementation must follow repo rules:
- prefer `Effect.fnUntraced` for internal effectful functions
- do not use `async/await`
- do not use `try/catch`
- do not use `Date.now` or `new Date`
- do not manually edit `packages/platform-browser/src/index.ts`; use `pnpm codegen`
- use `@effect/vitest` patterns for Effect-based tests

## Detailed implementation plan

### Task status
- [x] Task 1 — backing layer and direct backing tests
- [ ] Task 2 — composed layer, public export, shared integration test, changeset

### Implementation discoveries
- `layerBackingIndexedDb` is specified as `Layer.Layer<Persistence.BackingPersistence>` (non-failing layer type). To preserve this API while still constructing typed `PersistenceError` values for IndexedDB open failures, the implementation maps open failures to `PersistenceError` and then uses `Effect.orDie` at layer construction time.
- `clear` can scope deletion to one `storeId` without depending on `IDBKeyRange` by using the `storeId` secondary index with `index.openCursor(storeId)`.

### Task 1 — backing layer and direct backing tests
Implement `BrowserPersistence.layerBackingIndexedDb` and its private IndexedDB helpers, then add direct backing-store tests.

Status: ✅ Completed.

Scope:
- add `packages/platform-browser/src/BrowserPersistence.ts` with:
  - `Options`
  - `layerBackingIndexedDb`
  - internal request / transaction helpers
- implement the IndexedDB database open / upgrade logic
- implement `BackingPersistence.make(storeId)`
- implement `get`, `getMany`, `set`, `setMany`, `remove`, and `clear`
- add `packages/platform-browser/test/BrowserPersistence.test.ts`
- install and manage `fake-indexeddb` globals inside the test harness
- validate lazy TTL deletion, order preservation, store isolation, and custom database names

Shippability constraints:
- this task must pass on its own without requiring barrel export generation
- tests may import the source module directly
- all lint / type / targeted test issues discovered here must be fixed within this task

### Task 2 — composed layer, public export, shared integration test, changeset
Add the composed persistence layer, publish the new module through package exports, add shared integration coverage, and add the changeset.

Status: ⏳ Pending.

Scope:
- add `layerIndexedDb` in `BrowserPersistence.ts`
- run `pnpm codegen` so the package barrel exports include `BrowserPersistence`
- add shared-suite integration coverage using `PersistedCacheTest.suite(...)`
- add a changeset for `@effect/platform-browser`

Notes:
- `packages/platform-browser/package.json` already uses wildcard source exports, so no package export map change is expected unless implementation reveals an issue
- integration coverage should exercise the composed `Persistence.Persistence` layer, not just the backing layer

Shippability constraints:
- this task must pass repository validations together with task 1
- any type or harness fixes needed for the shared suite belong in this task

## Acceptance criteria
The work is complete when all of the following are true:
1. `@effect/platform-browser/BrowserPersistence` exists.
2. The module exports both `layerBackingIndexedDb` and `layerIndexedDb`.
3. The implementation uses `globalThis.indexedDB` directly.
4. Data is stored in one object store with `storeId` as a field and composite primary key.
5. TTL expiry is handled via lazy deletion on reads.
6. Direct backing-store tests pass under `fake-indexeddb`.
7. Shared persisted-cache integration coverage passes for the composed browser layer.
8. The package barrel exports are regenerated.
9. A changeset for `@effect/platform-browser` is added.
10. Required lint, test, docgen, and typecheck commands pass.
