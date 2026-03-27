# EventLogServerUnencrypted Multi-Replica Transactions

## Overview

Add multi-replica support to
`packages/effect/src/unstable/eventlog/EventLogServerUnencrypted.ts`.

This change must use transactional storage coordination so multiple live server
replicas can share one `Storage` backend without double-running handlers or
Reactivity invalidation.

Unlike the existing storage-checkpoint design, this request requires a stricter
model:

- there is no durable concept of an "unprocessed" entry
- entries become visible in storage only after their handlers have succeeded
- persistence happens as part of the same transaction that owns store-scoped
  write coordination

The user has already added `Storage.withTransaction(...)` as a starting point.

## Relationship To Existing Specs

This is a new specification and does not modify
`.specs/eventlog-server-unencrypted.md`.

That earlier spec describes the single-storage refactor based on persisted
entries plus a processed checkpoint. This new spec intentionally diverges from
that checkpoint model for multi-replica support.

If implemented, this spec supersedes the checkpoint-based recovery path for
`EventLogServerUnencrypted` and replaces it with transactional
process-before-persist semantics.

## Research Summary

Current implementation findings from
`packages/effect/src/unstable/eventlog/EventLogServerUnencrypted.ts`:

- the runtime currently persists entries first via `storage.write(...)`
- it then runs handler / Reactivity processing from persisted storage through
  `processStoreFromStorage(...)`
- coordination is only per-process, using an in-memory
  `Map<string, StoreProcessingState>` and a `Semaphore` per store
- the runtime already exposes `Storage.processedSequence(...)` and
  `Storage.markProcessed(...)` to track persisted-but-not-yet-processed backlog
- `Storage.withTransaction(...)` exists on the service type but is not yet used
  to provide cross-replica coordination

Current test findings from
`packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`:

- the suite currently validates storage-backed recovery through persisted
  unprocessed backlog and processed checkpoints
- there is no current coverage that proves two concurrent runtime layers sharing
  one storage avoid duplicate processing
- the current Reactivity behavior is tied to successful processing, but not to
  transaction commit boundaries

Relevant internal behavior from `packages/effect/src/unstable/eventlog/EventLog.ts`:

- `EventLog.makeReplayFromRemoteEffect(...)` currently invalidates Reactivity
  inline while handlers run
- under a transactional persist-after-processing model, that invalidation timing
  must be split so rollback cannot publish changes that never committed

## User Decisions Captured

1. Create a new specification rather than updating the existing
   `eventlog-server-unencrypted.md` spec.
2. Multiple replicas must preserve exactly-once processing across concurrent
   healthy replicas.
3. There must not be a durable concept of persisted-but-unprocessed entries.
4. Entries should only be persisted after handlers succeed, as part of a
   transaction.
5. `Storage.withTransaction(...)` is the expected starting point for the design.

## Problem Statement

The current runtime is unsafe for multi-replica deployments because processing
ownership is local to one process.

Today, two replicas that share one storage backend can both:

1. see the same committed backlog
2. independently run handlers for that backlog
3. independently invalidate the same Reactivity keys
4. race to advance the processed checkpoint

The existing checkpoint model solves single-runtime crash recovery, but it does
not satisfy the new requirement that entries must only be persisted after
successful processing as part of a transaction.

That means the architecture must change more fundamentally than simply adding a
distributed lease around the current catch-up loop.

The final design must make the committed remote feed contain only entries whose
handler processing already succeeded.

## Goals

- support multiple live `EventLogServerUnencrypted` replicas against one shared
  `Storage` backend
- ensure exactly-once handler execution across concurrent healthy replicas for
  the same committed remote entry
- ensure Reactivity invalidation happens at most once for the same committed
  remote entry across concurrent healthy replicas
- remove the persisted-unprocessed backlog model from
  `EventLogServerUnencrypted`
- make a write batch all-or-nothing: if handler processing fails, no entries
  from that batch are persisted
- preserve the public caller-facing behavior of:
  - `ingest(...)`
  - server-authored `write(...)`
  - `requestChanges(...)`
  - shared-store mapping behavior
  - read-time compaction
  - websocket / HTTP handlers
  - handler reuse through `EventLog.group(...)`
- keep one canonical ordered remote feed per `StoreId`

## Non-Goals

- guaranteeing durable exactly-once semantics for arbitrary external side
  effects performed inside user handlers
- redesigning the wire protocol, auth model, or store mapping APIs
- changing compaction semantics beyond what is required by transactional commit
  visibility
- implementing a new production storage backend in the same change
- altering unrelated `EventLog` or `EventJournal` APIs outside what the server
  needs

## Required Architecture Change

### Before

The server currently uses this high-level flow:

1. resolve / authorize the request
2. write entries into storage
3. process newly committed or previously unprocessed entries from storage
4. mark the processed checkpoint
5. serve reads from the committed feed regardless of whether processing already
   completed

### After

The server must instead use this flow for mutating operations:

1. resolve / authorize the request
2. enter a store-scoped transaction
3. read the already committed store history needed for conflict reconstruction
4. run handler processing for the new batch in sequence order against the
   transactional view of that store
5. if all handler processing succeeds, assign remote sequences and persist the
   new entries in the same transaction
6. commit the transaction
7. only after commit, publish live changes and Reactivity invalidations for the
   newly committed entries

As a result:

- storage never contains persisted entries that still need server-side catch-up
- `requestChanges(...)` reads only fully processed committed entries
- replica coordination happens through transactional store ownership, not
  through per-process replay state

## Transaction Model

### 1. Store-scoped mutual exclusion

`Storage.withTransaction(...)` is the low-level primitive the user has already
added, but the final public server contract should standardize on an explicit
store-scoped transactional helper.

Normative API direction:

- `Storage` should expose `withStoreTransaction(storeId, effect)`
- `withStoreTransaction(...)` runs `effect` with exclusive ownership of that
  store for the duration of the transaction
- all dedupe checks, sequence assignment, committed-history reads, and writes
  for mutating server flows happen inside that store transaction

Normative requirement:

- two replicas must not be able to concurrently commit overlapping writes for
  the same store in a way that double-runs handlers or emits duplicate
  invalidations

Cross-store concurrency should remain possible. The final architecture must not
serialize unrelated stores behind one global lock.

### 2. Batch atomicity

For one `ingest(...)` or server-authored `write(...)` call:

- all newly accepted entries in the batch commit together or not at all
- if handler processing fails for any entry in the batch, the transaction rolls
  back and none of the batch's entries become visible in storage
- entry ids from a rolled-back batch are not treated as durably committed for
  future deduplication

### 3. Visibility rules

Entries written by an in-flight transaction must not appear in:

- `storage.entries(...)`
- `storage.changes(...)`
- `requestChanges(...)`
- websocket or HTTP change streams

until the transaction commits successfully.

Live notifications must be published after commit, never before.

`storage.changes(storeId, startSequence)` must remain a gap-free committed feed:

- it first yields every committed entry with `remoteSequence > startSequence` in
  ascending order
- it then yields future committed entries in commit order without missing a
  commit that lands between initial backlog replay and live subscription setup
- it must surface commits made by other replicas that share the same storage
  backend

If the current `changes(...)` API cannot provide these guarantees without race
windows, the storage contract should be expanded so the runtime has one atomic
backlog-plus-live primitive.

### 4. Handler ordering inside a transaction

Within one store transaction:

- entries in the submitted batch are processed in input order
- sequence assignment for newly committed entries matches that processed order
- later entries in the same batch observe earlier successful entries from the
  same batch as part of their effective store history for conflict calculation
- conflict behavior should remain observationally equivalent to the current
  server for the same final committed history

Clarification:

- reads from storage inside `withStoreTransaction(...)` are against the
  transaction's committed store view
- same-batch visibility before `storage.write(...)` is runtime-derived in memory
  from earlier successful entries in that batch, not from prematurely persisted
  writes

## Storage Contract Expectations

The final `Storage` design should reflect the transactional architecture.

### Persisted state that remains authoritative

- committed remote entries per store
- deduplication state per store
- next sequence number per store
- store-scoped coordination state needed for transactional ownership

### Persisted state that should disappear from the final design

- a separate durable processed checkpoint distinct from the committed feed
- any durable representation of persisted-but-unprocessed entries for this
  server runtime

### Public API direction

The final public contract should support:

- running store-scoped transactional effects
- reading committed entries within that transaction
- writing committed entries within that transaction
- deferring post-commit side effects such as live change publication and
  Reactivity invalidation until commit succeeds

Normative direction:

```ts
export class Storage extends ServiceMap.Service<Storage, {
  readonly getId: Effect.Effect<RemoteId>
  readonly withTransaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  readonly withStoreTransaction: <A, E, R>(
    storeId: StoreId,
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E | EventLogServerStoreError, R>
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
}>()("effect/eventlog/EventLogServerUnencrypted/Storage") {}
```

Notes:

- `withStoreTransaction(...)` is the recommended required API shape for this
  server module
- `withTransaction(...)` remains useful as the lower-level primitive used by
  storage implementations to build `withStoreTransaction(...)`
- `processedSequence(...)` and `markProcessed(...)` are expected to be removed
  or made obsolete by the final architecture

### `changes(...)` backend requirement

For shared multi-replica deployments, `Storage.changes(...)` must be defined as
cross-replica visible.

Required behavior:

- a subscriber attached to replica B must observe a commit performed by replica
  A through the shared storage feed
- this may be implemented with database notifications, polling, or another
  storage-owned mechanism
- the runtime must not assume same-process pubsub alone is sufficient for the
  final shared-backend contract

### `makeStorageMemory`

The in-memory implementation must become the reference model for the new
transactional behavior.

Requirements:

- shared storage state must only publish committed results after transaction
  completion
- transaction rollback must leave history, dedupe state, and live subscribers
  unchanged
- two runtime layers sharing one in-memory storage instance must not double-run
  processing for the same committed entries
- any temporary transaction-local state must remain invisible outside the active
  transaction until commit

## Runtime Semantics To Preserve

### 1. `ingest(...)`

`ingest({ publicKey, entries })` must:

- resolve the caller's `StoreId`
- authorize the batch
- run the batch through the transactional process-before-persist flow
- return the same ack metadata shape as today

Required behavior on failure:

- if handler processing fails, the effect fails and no new entries are committed
- if storage commit fails, the effect fails and no new entries are committed
- no partial prefix of the batch becomes visible

### 2. Server-authored `write(...)`

Server-authored writes must continue to:

- validate the target store exists
- encode payloads from the schema
- share the same deduplication and sequence semantics as client-originated
  writes
- fail with `NotFound` for unknown stores

They must now also use the same store transaction and process-before-persist
rules as `ingest(...)`.

### 3. `requestChanges(...)`

`requestChanges(...)` must no longer perform a pre-read catch-up loop.

Instead it should:

- resolve and authorize the store
- obtain a gap-free committed feed from storage beginning at `startSequence`
- apply existing read-time compaction rules to the initial committed backlog
- continue streaming future committed entries from that same gap-free feed

Because unprocessed persisted entries no longer exist, a read request should not
need to trigger server-side backlog processing before serving data.

Reader consistency requirement:

- a commit that lands while `requestChanges(...)` is being established must not
  be lost between the initial backlog read and the live stream transition
- the runtime should rely on the storage-level `changes(...)` contract for this,
  rather than stitching together a racy `entries(...)` plus `changes(...)`
  sequence in user space

### 4. Shared-store history

These behaviors must remain true:

- multiple public keys may resolve to the same `StoreId`
- one shared store exposes one ordered committed remote feed
- sequence numbers are store-scoped, not public-key-scoped
- all replicas observe the same final committed order

## Reactivity And Post-Commit Side Effects

This area needs an explicit contract because the current implementation
invalidates Reactivity inline while handlers run.

### Required behavior

- user handlers execute before persistence commits
- Reactivity invalidation for newly accepted entries occurs only after the
  transaction commits successfully
- change-stream visibility for newly accepted entries occurs only after the
  transaction commits successfully
- rollback must not publish invalidations or live feed entries for entries that
  never committed

Post-commit failure contract:

- once the storage commit succeeds, `ingest(...)` / `write(...)` are considered
  successful from the caller's perspective
- local post-commit side-effect failures, including Reactivity invalidation or
  auxiliary same-process notifications, must be logged and must not roll back
  the commit or change the returned ack result
- durable visibility through `storage.entries(...)` and `storage.changes(...)`
  is part of the storage commit contract, not a best-effort afterthought

This spec does not require a new distributed Reactivity system across replicas;
it only requires that duplicate processing does not create duplicate local
invalidations for the same committed entry.

### Implementation direction

The runtime may need to split current processing into two phases:

1. transactional handler execution and conflict computation
2. post-commit local publication of:
   - Reactivity invalidation
   - any same-process notification helpers layered above storage

If extracting helpers from `EventLog.ts` makes this cleaner, that is within
scope.

## Failure Semantics

### Handler failure

If a handler fails while processing a batch:

- the transaction rolls back
- the feed remains unchanged
- subscribers receive no new entries
- Reactivity is not invalidated for the failed batch
- a caller retry reprocesses the batch from scratch because nothing committed

### Storage failure during commit

If processing succeeds but persistence fails before commit completes:

- the effect fails
- no entries from the batch become visible
- no post-commit publications occur

### Crash boundaries

This request guarantees exactly-once processing across concurrent healthy
replicas, not crash-atomic exactly-once side effects for arbitrary handlers.

Required behavior around crash-like boundaries:

- if a replica dies before the transaction commits, no new entries become
  visible and another replica may retry the batch from scratch
- if a replica dies after commit, the committed feed remains authoritative and
  readable from any replica through shared storage
- if a replica dies after commit but before local post-commit invalidation,
  this spec does not require distributed replay of that local invalidation

### Duplicate entries

Deduplication must remain per store.

Required behavior:

- duplicates of already committed entry ids remain idempotent and return the
  already committed remote sequence in `sequenceNumbers`
- duplicates inside the same batch return the first committed sequence for each
  repeated submission in that batch
- if two replicas concurrently submit the same entry id to the same store, one
  transaction commits the entry and the losing transaction returns the winning
  committed sequence without creating a second committed entry
- duplicates from a rolled-back batch are not treated as committed duplicates on
  a later retry

Illustrative examples:

- committed duplicate: submitted `[entry-x]`, existing committed sequence `5` ->
  `sequenceNumbers = [5]`, `committed = []`
- same-batch duplicate: submitted `[entry-x, entry-x]` to an empty store ->
  `sequenceNumbers = [1, 1]`, `committed = [sequence 1]`
- concurrent duplicate across replicas: both submit `entry-x` -> exactly one
  committed entry at sequence `N`; both callers observe `sequenceNumbers = [N]`
- rolled-back duplicate retry: failed transaction for `entry-x`, then retry ->
  retry commits as new work because no earlier commit exists

## Testing Requirements

Update or add focused tests in
`packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`.

Keep regression coverage for at least:

1. accepted ingest runs handlers
2. accepted ingest invalidates Reactivity
3. shared-store history across multiple public keys
4. different-store isolation
5. server-authored write fan-out and idempotency
6. store mapping behaviors
7. read-time compaction
8. websocket / HTTP protocol behavior

Add transactional multi-replica coverage for at least:

1. two runtime layers sharing one storage do not double-run handlers for one
   committed entry
2. two runtime layers sharing one storage do not double-invalidate Reactivity
   for one committed entry
3. concurrent writes from different replicas against the same store still commit
   one ordered sequence space
4. concurrent writes against different stores remain isolated and should not be
   forced through one final global serialization path
5. a handler failure leaves storage empty for that attempted batch
6. a handler failure does not publish to `changes(...)`
7. a handler failure does not invalidate Reactivity
8. entries are not visible to `requestChanges(...)` until the surrounding
   transaction commits
9. duplicate entry ids from a rolled-back batch are accepted on a later retry as
   new work
10. `requestChanges(...)` does not lose a commit that lands during backlog-to-
    live transition
11. a commit produced on replica A is observed by a `requestChanges(...)`
    subscriber attached to replica B
12. concurrent duplicate submissions from two replicas return one committed
    sequence and one committed entry
13. same-batch duplicates preserve exact `sequenceNumbers` behavior
14. a post-commit local publication failure does not change caller-visible write
    success once the commit completed
15. `makeStorageMemory` transaction / rollback behavior matches the public
    contract

Preferred test strategy:

- create two or more runtime layers that share the same `Storage` and
  `StoreMapping` services
- use refs, deferreds, or barriers to deterministically overlap concurrent write
  attempts from different replicas
- prefer assertions on committed storage contents and post-commit publications
  over timing-sensitive sleeps

## Migration Notes

The main architectural migration is internal but significant:

- remove any runtime logic that treats storage as a queue of persisted work that
  still needs processing
- stop relying on `processedSequence(...)` / `markProcessed(...)` as the final
  model for this server
- move mutating flows to transactional process-before-persist semantics
- ensure live feed publication and Reactivity invalidation become post-commit
  behavior

Legacy data expectations:

- existing in-memory storage has no migration surface beyond code changes
- if a future durable storage backend already contains processed-checkpoint or
  persisted-backlog state from the old design, the new runtime must ignore that
  legacy state rather than consulting it for correctness
- backend-specific cleanup of obsolete checkpoint columns / keys may be handled
  lazily or in a follow-up migration, but it must not affect the committed feed
  seen by the new runtime

Because this module is unstable, expanding or replacing the `Storage` service
contract is acceptable.

## Validation Expectations

Any implementation produced from this spec must run:

- `pnpm lint-fix`
- `pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
- `pnpm check:tsgo`
- `pnpm clean` and then `pnpm check:tsgo` if caches appear stale
- `pnpm docgen`
- `pnpm codegen` if exports or barrels change
- add a changeset for the unstable eventlog package changes

## Implementation Plan

The work should be split into the following validation-safe tasks.

### Task 1: Introduce transactional storage primitives and a rollback-safe memory model

Scope:

- finalize the `Storage` contract needed for store-scoped transactional writes
- add `withStoreTransaction(storeId, effect)` as an additive API while keeping
  the existing checkpoint-era APIs available for now
- implement the new transaction semantics in `makeStorageMemory`
- make in-memory commit visibility and `changes(...)` semantics transaction-aware
  only for the new transactional path, without breaking the current runtime path
- add focused storage tests for commit visibility, rollback behavior,
  transaction-local dedupe state, and store-scoped contention
- keep the current runtime behavior otherwise unchanged and fully green during
  this task

Why this task is grouped:

- the storage contract plus reference implementation is one atomic foundation
- it can be validated before the runtime fully switches over
- this keeps API design and storage semantics reviewable in isolation

Validation for this task:

- `pnpm lint-fix`
- `pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
- `pnpm check:tsgo`
- `pnpm clean` and then `pnpm check:tsgo` if caches appear stale
- `pnpm docgen`
- `pnpm codegen` if exports change
- add or update a changeset if this task lands as its own PR

### Task 2: Refactor runtime writes to process before persist inside store transactions

Scope:

- replace `persistAndReplay(...)` with a transactional process-before-persist
  workflow
- remove the pre-write / post-write catch-up path for mutating operations
- ensure handler conflict reconstruction still matches current observable
  behavior for committed history and same-batch sequencing
- defer Reactivity invalidation and live-feed publication until after commit
- if `requestChanges(...)` still temporarily reads checkpoint-era state during
  this task, keep that compatibility path aligned with the committed tail so it
  cannot reprocess newly committed entries
- preserve existing regressions while adding integration tests for handler
  rollback, commit visibility, concurrent replica writes against the same shared
  store, and different-store isolation

Why this task is grouped:

- mutating runtime behavior, publication timing, and multi-replica correctness
  need to move together to remain shippable
- splitting these pieces would risk a state that typechecks but still leaks
  uncommitted entries or double-publishes side effects

Validation for this task:

- `pnpm lint-fix`
- `pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
- `pnpm check:tsgo`
- `pnpm clean` and then `pnpm check:tsgo` if caches appear stale
- `pnpm docgen`
- `pnpm codegen` if exports change
- add or update a changeset if this task lands as its own PR

### Task 3: Remove obsolete checkpoint-based processing and finish migration cleanup

Scope:

- simplify `requestChanges(...)` so it serves committed entries without a
  catch-up phase and relies on the gap-free storage feed directly
- remove runtime dependence on persisted processed checkpoints and any other
  persisted-unprocessed concepts that are no longer valid
- delete or replace tests that assume persisted backlog recovery
- update docs, examples, and add the required changeset

Why this task is grouped:

- once transactional writes are stable, the remaining checkpoint cleanup becomes
  a focused, independently reviewable change
- the task stays validation-safe because it removes obsolete architecture only
  after the replacement path is already covered by tests

Validation for this task:

- `pnpm lint-fix`
- `pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
- `pnpm check:tsgo`
- `pnpm clean` and then `pnpm check:tsgo` if caches appear stale
- `pnpm docgen`
- `pnpm codegen` if exports change
- add or update a changeset if this task lands as its own PR

## Out-Of-Scope Follow-Ups

- evaluate a dedicated SQL-backed `Storage` implementation that uses real
  database row locks or advisory locks for store-scoped transactions
- revisit long-running handler guidance if transaction duration becomes a
  practical concern in production storage backends
- consider extracting shared helper layers for post-commit publication if the
  same transactional pattern is needed elsewhere
