# EventLogServerUnencrypted Storage Simplification

## Overview

Update `packages/effect/src/unstable/eventlog/EventLogServerUnencrypted.ts`
so `EventLogServerUnencrypted` uses exactly one storage service for events /
entries.

The server currently stores and reconciles the same logical entry stream through
both:

- `EventLogServerUnencrypted.Storage` for store-scoped remote history and
  subscriptions
- `EventJournal.EventJournal` for replay, handler execution, and recovery

This specification changes that architecture so `Storage` is the only storage
service used by `EventLogServerUnencrypted` for persisted entries and
processing checkpoints.

`EventJournal` remains a valid module elsewhere in the repository, but it
should no longer be part of the `EventLogServerUnencrypted` persistence
pipeline.

## User Decisions Captured

1. keep `EventLogServerUnencrypted.Storage` as the single storage service
2. `EventJournal` may remain in the repository for other use cases, but not as
   an event / entry store inside `EventLogServerUnencrypted`
3. this change is a storage architecture cleanup only, not a broader protocol,
   auth, mapping, or product redesign
4. existing external behavior should remain intact unless a change is required
   to remove the duplicate storage architecture

## Problem Statement

The current server architecture has two different services carrying overlapping
entry state:

- `Storage` is the source for `requestChanges(...)`, remote sequences,
  duplicate detection, backlog replay, and live subscriptions
- `EventJournal` is the source for handler replay, conflict calculation,
  Reactivity invalidation, and recovery progress

That split creates avoidable complexity:

- the runtime persists an entry into `Storage` and then separately replays it
  into `EventJournal`
- recovery is expressed as reconciliation between two stores rather than as a
  single-store catch-up pass
- failures can leave persisted storage ahead of the processing journal
- the layer graph and tests must provide both services even though only one
  should be responsible for entry storage
- future storage implementations would need to reason about duplicated
  responsibilities

The cleanup goal is not to redesign the feature. It is to make the storage
story internally coherent.

## Goals

- Make `Storage` the sole authoritative persisted store for:
  - committed remote entries
  - per-store remote sequence assignment
  - duplicate detection / idempotency by entry id
  - processing recovery progress for server-side handler execution
  - backlog and live change subscriptions
- Remove `EventJournal.EventJournal` from the runtime dependency graph of
  `EventLogServerUnencrypted`
- Preserve the existing public server behavior for:
  - `ingest(...)`
  - `write(...)`
  - `requestChanges(...)`
  - store mapping and auth
  - shared-store fan-out semantics
  - read-time compaction
  - websocket / HTTP handlers
  - Reactivity invalidation
  - handler reuse through `EventLog.group(...)`
- Preserve recovery semantics: committed-but-not-yet-processed entries must be
  recoverable without double-running handlers or Reactivity invalidation

## Non-Goals

- Removing `EventJournal` from the repository
- Refactoring the separate `EventLog` runtime away from `EventJournal`
- Changing store mapping, auth, or compaction product behavior beyond what is
  required by the storage cleanup
- Introducing a new persistence backend in the same change
- Redesigning the unencrypted wire protocol
- Replacing `EventLog.group(...)` with a new handler API

## Module Surface

### Primary module

- `packages/effect/src/unstable/eventlog/EventLogServerUnencrypted.ts`

### Related modules that may need small follow-up refactors

- `packages/effect/src/unstable/eventlog/EventLog.ts` only if a private or
  internal helper should be extracted so handler execution / Reactivity logic is
  shared without depending on `EventJournal`
- `packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
- generated exports only if the public service types change in a way that
  affects barrels

## Required Architecture Change

### Before

`EventLogServerUnencrypted` currently follows this shape:

1. persist entries to `Storage`
2. replay committed entries into `EventJournal`
3. use `EventJournal` state to decide what has already been processed
4. serve backlog / live changes from `Storage`

This means the same logical event stream is represented twice.

### After

`EventLogServerUnencrypted` must instead follow this shape:

1. persist entries to `Storage`
2. process newly committed or previously unprocessed entries directly from
   `Storage`
3. record processing progress back into `Storage`
4. serve backlog / live changes from that same `Storage`

Any in-memory indexes or semaphores used by the runtime are allowed, but they
must be derived runtime state only. They are coordination helpers, not a second
storage service.

## Public API Expectations

### 1. `Storage`

`Storage` remains the storage abstraction for
`EventLogServerUnencrypted`, but it must grow the minimum capabilities needed
for single-store recovery.

The existing responsibilities remain:

- assign per-store `remoteSequence` values
- deduplicate by entry id within a store
- return one ack sequence per originally submitted entry
- provide `entries(storeId, startSequence)`
- provide `changes(storeId, startSequence)`

The revised service should also expose storage-owned processing progress.

Expected shape:

```ts
export class Storage extends ServiceMap.Service<Storage, {
  readonly getId: Effect.Effect<RemoteId>
  readonly write: (
    storeId: StoreId,
    entries: ReadonlyArray<Entry>
  ) => Effect.Effect<{
    readonly sequenceNumbers: ReadonlyArray<number>
    readonly committed: ReadonlyArray<RemoteEntry>
  }>
  readonly entries: (
    storeId: StoreId,
    startSequence: number
  ) => Effect.Effect<ReadonlyArray<RemoteEntry>>
  readonly changes: (
    storeId: StoreId,
    startSequence: number
  ) => Effect.Effect<Queue.Dequeue<RemoteEntry, Cause.Done>, never, Scope.Scope>
  readonly processedSequence: (storeId: StoreId) => Effect.Effect<number>
  readonly markProcessed: (
    storeId: StoreId,
    remoteSequence: number
  ) => Effect.Effect<void>
}>()("effect/eventlog/EventLogServerUnencrypted/Storage") {}
```

Semantics:

- `processedSequence(storeId)` returns the highest contiguous
  `remoteSequence` that has been durably checkpointed as fully processed for
  that store
- the initial processed sequence for a store is `0`
- `markProcessed(storeId, remoteSequence)` is monotonic and must never move
  backward
- `markProcessed` must be idempotent when called repeatedly with the current
  checkpoint value
- runtime code should only advance `markProcessed` for the next contiguous
  sequence after all earlier entries are already checkpointed; gaps must not be
  skipped
- if a storage implementation persists entries across service recreation, it
  must persist processing progress with the same durability expectations as the
  entries it stores
- `entries` and `changes` continue to expose the canonical remote feed,
  independent of whether an entry has already been processed by handlers

Additional ordering guarantees:

- `write(storeId, entries)` returns `sequenceNumbers` in the same order as
  the submitted input entries
- `write(storeId, entries)` returns `committed` entries in ascending commit
  order
- `entries(storeId, startSequence)` returns all committed entries with
  `remoteSequence > startSequence` in ascending `remoteSequence` order
- `changes(storeId, startSequence)` must first replay backlog entries after
  `startSequence` and then stream future commits without re-emitting backlog
  entries that were already delivered during subscription startup

### 2. `makeStorageMemory`

The in-memory implementation must be updated so it stores, per `StoreId`:

- remote history
- known entry ids for deduplication
- pubsub / subscription infrastructure
- the processed sequence checkpoint

The in-memory implementation should stay simple and remain the reference model
for the single-storage design.

### 3. `EventLogServerUnencrypted.make`

`make` must stop depending on `EventJournal.EventJournal`.

The runtime should instead depend on:

- `Storage`
- `StoreMapping`
- `EventLogServerAuth`
- handler services from `EventLog.group(...)`
- `Reactivity`

### 4. `layer(schema)`

`layer(schema)` must no longer require `EventJournal.EventJournal` in its
input environment.

Expected direction:

```ts
export const layer = <Groups extends EventGroup.Any>(
  _schema: EventLog.EventLogSchema<Groups>
): Layer.Layer<
  EventLogServerUnencrypted,
  never,
  EventGroup.ToService<Groups> | Storage | StoreMapping | EventLogServerAuth
>
```

This is a direct consequence of the storage cleanup and should be treated as an
intended public API simplification.

## Runtime Semantics To Preserve

### 1. Ingest and server-authored writes

These behaviors must remain true:

- `ingest({ publicKey, entries })` resolves the caller's `StoreId`,
  authorizes the batch, persists entries, processes newly committed or pending
  entries, and returns ack / committed metadata
- `write({ storeId, ... })` still writes directly to a store after
  `StoreMapping.hasStore(storeId)` succeeds
- server-authored writes still share the same duplicate detection and sequence
  numbering rules as client-originated writes
- unauthorized writes still reject the full batch

### 2. Shared-store history

These behaviors must remain true:

- multiple public keys may resolve to the same `StoreId`
- one shared store exposes one ordered remote feed
- sequence numbers are scoped to `StoreId`, not `publicKey`
- backlog and live changes are read from canonical `Storage`

### 3. Read-time compaction

These behaviors must remain true:

- compaction applies only when serving `requestChanges(...)`
- compaction operates on the canonical remote feed from `Storage`
- recent entries remain raw
- representative sequences remain strictly monotonic and cursor-safe

### 4. Reactivity invalidation

These behaviors must remain true:

- accepted entries still invalidate registered Reactivity keys
- invalidation is tied to successful server-side processing of an entry
- reconciliation must not cause duplicate invalidation for already processed
  entries

### 5. Handler reuse

Applications must continue to reuse `EventLog.group(...)` handlers.

The implementation may extract or refactor shared internal helper logic if
needed, but the storage cleanup must not force applications onto a different
handler registration API.

## Storage-Backed Processing Model

The key design change is moving recovery and processing progress into
`Storage`.

### 1. Processing checkpoint

For each store, `Storage` owns a checkpoint represented by
`processedSequence(storeId)`.

A remote entry is considered processed only after all server-side work required
for that entry has completed successfully and the checkpoint has advanced,
including:

- handler invocation
- Reactivity invalidation
- any bookkeeping needed so the runtime can safely resume later

An entry is not considered processed merely because a previous runtime attempted
it. It is processed only once the checkpoint in `Storage` durably covers that
entry.

Only after that work succeeds may the runtime advance
`markProcessed(storeId, remoteSequence)`.

### 2. Per-store serialization

For a given `StoreId`, the runtime must serialize processing-critical work.

Normative requirement:

- only one catch-up / processing loop may run at a time for a store
- concurrent `ingest(...)`, `write(...)`, and `requestChanges(...)` calls
  that touch the same store must coordinate behind that per-store processing
  loop

This can be implemented with runtime semaphores or equivalent coordination, but
it must prevent duplicate processing caused by concurrent catch-up attempts.

### 3. Reconciliation / catch-up ordering

Before the runtime mutates or serves a store, it must be able to catch up from
storage in ascending `remoteSequence` order:

1. read `processedSequence(storeId)`
2. read committed entries after that sequence from `Storage`
3. process them in ascending `remoteSequence` order
4. advance `markProcessed` entry-by-entry as processing succeeds

Required ordering points:

- catch-up happens before any new write is accepted for that store
- catch-up happens before `requestChanges(...)` starts serving data for that
  store
- newly committed entries for that store must also be processed in ascending
  `remoteSequence` order

This catch-up pass replaces the current journal reconciliation path.

### 4. Failure behavior

If persistence succeeds but server-side processing fails afterward for remote
sequence `N`:

- the committed entries remain in `Storage`
- entries with sequences `<= N - 1` that were already successfully processed
  remain checkpointed
- sequence `N` must not be checkpointed
- the processed sequence does not advance past the failed entry
- a later store access retries processing starting at sequence `N`
- retries must not double-run already checkpointed entries

If a handler is missing for an event:

- that is not treated as a processing failure
- the runtime may log the missing handler
- the entry still counts as processed once the rest of the processing contract
  completes

### 5. Runtime-only indexes are allowed

The runtime may maintain per-store in-memory state such as:

- semaphores to ensure ordered processing
- derived indexes needed for handler conflict calculation
- cached reconstructed state for a store already loaded into memory

However:

- that state must be reconstructible from `Storage`
- it must not become the authoritative persisted record of entries
- it must not reintroduce a second storage service under a different name

## Handler Execution Requirements

The current server path uses `EventJournal` to drive handler replay. After the
cleanup, handler execution must be driven directly from storage-backed entries.

Requirements:

- continue to provide an `EventLog.Identity` while running handlers
- preserve the current identity behavior for:
  - client-originated ingests, which use the caller's public key
  - server-authored writes, which use the synthetic server-write public key
  - storage recovery / reconciliation work, which may continue to use a
    synthetic recovery public key if needed for logs / identity consistency
- continue to log missing handlers rather than failing the entire processing
  pipeline just because a handler is absent
- preserve the current behavior of Reactivity invalidation after successful
  handler processing

### Conflict behavior

Handler conflict information should remain observationally equivalent to the
current `EventJournal.writeFromRemote`-based behavior for the same committed
store history.

At minimum, the observable handler contract must remain the same:

- handlers still receive the current `entry`
- handlers still receive `conflicts` in the same situations they do today
- conflicts are derived from the same committed store history the runtime has
  already incorporated for that store
- out-of-order recovery should remain safe

Using runtime-derived indexes reconstructed from storage is acceptable here.

## Recovery Across Runtime Recreation

This cleanup must make recovery rely on `Storage`, not on an externally
provided `EventJournal` instance.

Required behavior:

- if a runtime instance is torn down and recreated with the same `Storage`
  service, previously checkpointed entries must not re-run handlers or
  Reactivity invalidation
- if entries were committed but not yet processed, the recreated runtime must be
  able to resume processing them from storage
- tests should model recreation with a shared `Storage` service and fresh
  runtime state to prove that the checkpoint lives in storage rather than in the
  runtime

## Testing Requirements

Update or add focused tests that follow the existing eventlog test style.

### Runtime dependency cleanup

Add or update coverage proving:

1. `EventLogServerUnencrypted.layer(schema)` works without providing
   `EventJournal`
2. helper runtime layers used in tests no longer need an `EventJournal`
   service

### Existing behavior regressions

Keep or update coverage for at least:

1. accepted ingest runs handlers
2. accepted ingest invalidates Reactivity
3. two public keys mapped to one store share one feed and one sequence space
4. different stores remain isolated
5. server-authored writes broadcast to all readers of a shared store
6. server-authored writes remain idempotent when `entryId` is supplied
7. duplicate writes remain idempotent within a store while preserving ack shape
8. server-authored writes still fail with `NotFound` for unknown stores
9. dynamic / static / memory / persisted store mapping helpers still behave the
   same
10. read-time compaction remains cursor-safe
11. websocket and HTTP handlers still produce the same protocol behavior

### New storage-owned recovery coverage

Replace the current dual-storage reconciliation emphasis with tests that prove
storage-owned recovery:

1. when processing fails after `Storage.write(...)` commits an entry,
   a later retry processes the stored backlog exactly once
2. recreating the runtime with the same `Storage` but a fresh runtime layer
   does not duplicate handler execution or Reactivity invalidation for already
   checkpointed entries
3. the processed checkpoint advances only after successful processing
4. `makeStorageMemory` exposes the expected processed-sequence behavior

Preferred test strategies:

- use a failing handler or a test-only `Storage` wrapper that fails after
  commit but before checkpoint advancement
- do not keep using `EventJournal` failure behavior as the mechanism for the
  new recovery tests, because that dependency is exactly what this cleanup is
  removing from the server runtime

## Migration Notes

Applications using `EventLogServerUnencrypted` should observe one main public
change: the runtime no longer requires `EventJournal.EventJournal` in its
layer environment.

Migration expectations:

- remove `EventJournal.layerMemory` or other `EventJournal` providers from
  `EventLogServerUnencrypted` layer wiring
- keep using `layerStorageMemory` or another `Storage` implementation
- keep using the existing store-mapping helpers and auth services unchanged
- do not treat any runtime-only processing cache as a persistence surface

Illustrative direction:

- before:
  `EventLogServerUnencrypted.layer(schema).pipe(Layer.provideMerge(EventJournal.layerMemory), ...)`
- after:
  `EventLogServerUnencrypted.layer(schema).pipe(Layer.provideMerge(EventLogServerUnencrypted.layerStorageMemory), ...)`

`EventJournal` remains available for the rest of the codebase and is not being
removed by this change.

## Validation Expectations

Any implementation produced from this spec must run:

- `pnpm lint-fix`
- targeted tests, at minimum:
  - `pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
- `pnpm check:tsgo`
- `pnpm docgen`
- `pnpm codegen` if exports or barrels change
- add a changeset for the unstable eventlog package changes

## Implementation Plan

The work should be split into the following validation-safe tasks.

### Status

- [x] Task 1: Extend `Storage` to own processing progress
- [ ] Task 2: Switch runtime internals to storage-backed processing
- [ ] Task 3: Remove the public `EventJournal` runtime dependency from the layer API

### Task 1 Notes

- `Storage` now includes `processedSequence(storeId)` and
  `markProcessed(storeId, remoteSequence)`.
- `makeStorageMemory` persists a per-store processed checkpoint alongside
  history, deduplication ids, and pubsub-backed change streaming state.
- Focused storage tests now cover initial checkpoint `0`, monotonic and
  idempotent checkpoint advancement, and checkpoint coexistence with
  `entries` / `changes` behavior.
- Runtime reconciliation still depends on `EventJournal` at this stage (by
  design for Task 1).

### Task 1: Extend `Storage` to own processing progress

Scope:

- add `processedSequence(storeId)` and `markProcessed(storeId, remoteSequence)`
  to the `Storage` service
- update `makeStorageMemory` to track the processed checkpoint alongside the
  existing per-store history, deduplication state, and live pubsub state
- add or update focused storage tests for checkpoint initialization,
  monotonic advancement, idempotency, and interaction with existing history APIs
- keep the current runtime behavior working while these primitives land

Why this task is grouped:

- the new checkpoint primitives and their memory implementation form one atomic
  public-contract change
- this can be validated independently before the runtime stops using
  `EventJournal`

Validation for this task:

- `pnpm lint-fix`
- `pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
- `pnpm check:tsgo`
- `pnpm docgen`
- `pnpm codegen` if exports change

### Task 2: Switch runtime internals to storage-backed processing

Scope:

- replace the journal replay / reconciliation path with a storage-backed
  catch-up loop driven by `processedSequence` and `markProcessed`
- enforce per-store serialization so concurrent operations cannot double-run
  catch-up for the same store
- preserve handler execution, conflict behavior, Reactivity invalidation,
  server-write semantics, shared-store fan-out, and compaction behavior
- if helpful, extract shared internal handler-execution logic from
  `EventLog.ts` so the server can reuse it without depending on
  `EventJournal`
- rewrite recovery-oriented tests so they prove the checkpoint now lives in
  `Storage`, not in `EventJournal`
- remove any now-unused helpers or imports from the updated tests so lint and
  typecheck remain green

Important constraint:

- keep the public `layer(schema)` environment unchanged during this task if
  that makes the refactor easier to land cleanly; public type cleanup can land
  immediately after in Task 3

Why this task is grouped:

- the runtime behavior change is only shippable once reconciliation,
  processing, concurrency control, and recovery-test coverage move together
- splitting the internal refactor from its tests would risk a temporary state
  that passes types but not behavioral validation

Validation for this task:

- `pnpm lint-fix`
- `pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
- any additional touched eventlog tests
- `pnpm check:tsgo`
- `pnpm docgen`
- `pnpm codegen` if exports change

### Task 3: Remove the public `EventJournal` runtime dependency from the layer API

Scope:

- remove `EventJournal.EventJournal` from the internal runtime layer and from
  the exported `layer(schema)` environment type
- update helper runtime layers, examples, docs, and migration notes so they no
  longer provide `EventJournal` for `EventLogServerUnencrypted`
- add the required changeset

Why this task is grouped:

- the public environment simplification is independently understandable and
  shippable once the runtime internals no longer rely on `EventJournal`
- isolating this task makes validation failures easier to diagnose if public
  layer typing or docs need cleanup

Validation for this task:

- `pnpm lint-fix`
- `pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
- any additional touched eventlog tests
- `pnpm check:tsgo`
- `pnpm docgen`
- `pnpm codegen` if exports change

## Out of Scope Follow-Ups

These are not part of this request, but they may become easier after the
cleanup:

- adding a persisted `Storage` implementation that carries both entries and
  processing checkpoints
- extracting more shared event-processing utilities between
  `EventLog` and `EventLogServerUnencrypted`
- further simplification of runtime-internal conflict reconstruction once the
  single-storage design is in place
