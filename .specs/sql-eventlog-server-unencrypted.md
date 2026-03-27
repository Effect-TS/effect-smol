# SqlEventLogServerUnencrypted

## Summary

Add a new unstable module, `effect/unstable/eventlog/SqlEventLogServerUnencrypted`, that provides a SQL-backed implementation of `EventLogServerUnencrypted.Storage`.

The module should mirror the public constructor and layer naming of `SqlEventLogServer`, but its runtime behavior must match the semantics of `EventLogServerUnencrypted.makeStorageMemory`:

- stable remote id persistence
- per-store append-only journals
- idempotent writes by `EntryId`
- per-store ordered reads by sequence number
- per-store live change streaming
- transaction bracketing through `sql.withTransaction`

The initial SQL layout should use one shared entries table with a `store_id` column instead of one table per store.

## Background

Relevant existing code:

- `packages/effect/src/unstable/eventlog/EventLogServerUnencrypted.ts` defines the `Storage` contract and the in-memory baseline implementation.
- `packages/effect/src/unstable/eventlog/SqlEventLogServer.ts` shows the desired public API shape and SQL module style.
- `packages/sql/sqlite-node/test/SqlEventLogServer.test.ts` shows current direct SQL eventlog testing style.
- `packages/effect/test/unstable/persistence/PersistedQueueTest.ts` plus the SQL runner files show the reusable integration-suite pattern the user wants for this feature.

## Goals

1. Add a new SQL module for `EventLogServerUnencrypted.Storage`.
2. Keep the public API aligned with `SqlEventLogServer` by exposing `makeStorage(options?)` and `layerStorage(options?)`.
3. Use a single shared SQL table for event rows, keyed by `store_id`.
4. Preserve memory-storage semantics for deduplication, sequencing, reads, and change streams.
5. Support PostgreSQL, MySQL, MSSQL, and SQLite / generic `orElse` DDL branches.
6. Add reusable integration coverage in the same style as the persistence suites.
7. Keep the new storage directly usable by `EventLogServerUnencrypted` without changing that module's public contract.

## Non-goals

- Changing `EventLogServerUnencrypted` auth or store-mapping behavior.
- Adding encryption support or changing `SqlEventLogServer`.
- Introducing new public options beyond `entryTablePrefix`, `remoteIdTable`, and `insertBatchSize`.
- Replacing the single-table design with per-store SQL tables in this change.

## User-confirmed decisions

- Module path: `effect/unstable/eventlog/SqlEventLogServerUnencrypted`.
- Public API names: `makeStorage` and `layerStorage`.
- Storage layout: single entries table with a `store_id` column.
- Options remain aligned with `SqlEventLogServer`.
- Dialect target matches `SqlEventLogServer`.
- Integration tests should use the reusable-suite style used by persistence tests.
- `withTransaction` must delegate to `sql.withTransaction`.

## Public API

Create `packages/effect/src/unstable/eventlog/SqlEventLogServerUnencrypted.ts` and export:

- `makeStorage(options?)` returning `Effect.Effect<EventLogServerUnencrypted.Storage["Service"], SqlError.SqlError, SqlClient.SqlClient | Scope.Scope>`
- `layerStorage(options?)` returning `Layer.Layer<EventLogServerUnencrypted.Storage, SqlError.SqlError, SqlClient.SqlClient>`

Notes:

- No `layerStorageSubtle` equivalent is needed because this module has no encryption dependency.
- After the module is added, implementation must run `pnpm codegen` because barrel files are generated.

## Option semantics

- `entryTablePrefix?` default: `"effect_events"`.
- `remoteIdTable?` default: `"effect_remote_id"`.
- `insertBatchSize?` default: `200`.

For API parity with `SqlEventLogServer`, the option name remains `entryTablePrefix` even though this module uses a single shared table. In this first implementation, the option value is used as the actual shared entries table name.

## Storage model

### Required persisted tables

1. Remote id table
- Same purpose as `SqlEventLogServer`: persist one `RemoteId` for the storage instance.
- If the table already contains a row, reuse it.
- Otherwise create one with `makeRemoteIdUnsafe()`.
- Initialization must be race-safe if two storage instances are created concurrently against the same database. An acceptable strategy is dialect-appropriate insert-if-absent / ignore-on-conflict followed by a re-read of the persisted row.

2. Shared entries table
- Required logical columns: `store_id`, `sequence`, `entry_id`, `event`, `primary_key`, `payload`.
- `entry_id` stores the `EntryId` bytes.
- `payload` stores the unencrypted payload bytes.
- `sequence` is scoped per store, not global.
- Enforce uniqueness for `(store_id, sequence)` and `(store_id, entry_id)`.
- Deduplication is scoped to `(store_id, entry_id)`. The same `EntryId` may be written independently to different stores.

3. Internal store-sequence coordination table
- Add an internal helper table named deterministically as `<entriesTable>_stores`.
- Required logical columns: `store_id` primary key and `next_sequence` integer.
- `next_sequence` means the next available per-store remote sequence number.
- The initial helper row for a store must start at `1`.
- Reserving `n` new entries must atomically allocate `[next_sequence, next_sequence + n - 1]` and then advance `next_sequence` to `next_sequence + n`.
- First-write initialization for a new store must also be race-safe under concurrent writers.
- This helper table is allowed because a single shared entries table still needs deterministic per-store sequence allocation.
- This helper table is internal only and does not change the public API.

### Dialect requirements

Use `sql.onDialectOrElse` and follow the existing eventlog SQL modules for binary column choices:

- PostgreSQL
- MySQL
- MSSQL
- SQLite / generic `orElse`

The shared entries table DDL should be created eagerly during `makeStorage`; only in-memory pubsub resources should be lazy.

Recommended concrete SQL types for string-like columns to keep dialect behavior predictable:

- PostgreSQL: `TEXT` for `store_id`, `event`, and `primary_key`
- MySQL: `VARCHAR(191)` for `store_id`; text-compatible types for `event` and `primary_key`
- MSSQL: `NVARCHAR(191)` for `store_id`; NVARCHAR-compatible types for `event` and `primary_key`
- SQLite / `orElse`: `TEXT` for `store_id`, `event`, and `primary_key`

Binary columns should follow the same backend-specific pattern used by the existing eventlog SQL modules.

## Behavioral specification

### `getId`

- Returns the persistent remote id created or loaded during construction.
- Two storage instances pointed at the same database and `remoteIdTable` must return the same remote id.

### `write(storeId, entries)`

Required semantics:

1. Empty input returns `{ sequenceNumbers: [], committed: [] }`.
2. Sequence numbers are per store and start at `1` for the first committed row of that store.
3. Writes are idempotent by `EntryId` within a store.
4. Duplicate ids inside the same request must not create duplicate rows.
5. The returned `sequenceNumbers` array must align 1:1 with the input array, including repeated ids within the same call.
6. The returned `committed` array must contain only rows newly committed by that call, ordered by ascending `remoteSequence`. Existing rows found during the call must not be re-emitted as committed.
7. Sequences for one store must not affect another store.

Required high-level write flow:

- detect already-committed ids for the target store
- remove duplicate input ids while preserving first-seen order for new ids
- reserve a contiguous sequence range for the accepted new entries in that store
- insert new rows in batches of `insertBatchSize`
- decode new rows into `RemoteEntry` values
- publish only the newly committed rows to the store-scoped pubsub
- return aligned sequence numbers for every original input entry

`write` must execute sequence reservation, row insertion, and sequence-number resolution inside one SQL transaction so helper-table state and inserted rows roll back together on failure. Publication to the in-memory pubsub must happen only after the SQL transaction succeeds.

The implementation must not use one global auto-increment sequence shared by all stores.

### `entries(storeId, startSequence)`

- Return all committed rows for the given store where `remoteSequence > startSequence`.
- Order by ascending `remoteSequence`.
- Unknown stores return an empty array.
- Reconstruct `Entry` and `RemoteEntry` values with the existing eventlog schema types.

Important: this must use strict `>` semantics, matching `makeStorageMemory`.

### `changes(storeId, startSequence)`

- Return a scoped `Queue.Dequeue<RemoteEntry, Cause.Done>`.
- The stream is store-scoped.
- Replay backlog rows with `remoteSequence > startSequence` first.
- Then stream newly committed rows for that same store only.
- Unknown stores should still return a valid dequeue that can receive future writes for that store.

Startup correctness requirements:

- acquire the store pubsub resource
- subscribe
- query backlog using strict `>` filtering
- record the highest replayed sequence as a startup watermark
- enqueue backlog rows
- forward live pubsub rows while filtering to `remoteSequence > watermark`

This startup sequence must avoid both missed rows and duplicate rows.

### `withTransaction(effect)`

- Implement exactly as `sql.withTransaction(effect)`.
- Do not add retry wrappers or custom error remapping here.
- Preserve the wrapped effect's value, error, and requirement types.

### Resource management

- The implementation may use `RcMap` for per-store pubsub resources, mirroring `SqlEventLogServer` style.
- Per-store pubsubs should be lazily created and correctly released.
- `changes` queues must shut down on scope finalization.

### Error behavior

- `makeStorage` may fail with `SqlError.SqlError` during initialization.
- Returned service methods should follow existing SQL storage-module style: operational SQL or schema failures may be defected where the service contract does not expose typed SQL errors.
- No new public error types are introduced.

## Acceptance criteria

The feature is complete when:

1. `effect/unstable/eventlog/SqlEventLogServerUnencrypted` is exported.
2. `makeStorage` returns an `EventLogServerUnencrypted.Storage` service backed by SQL.
3. Remote ids persist across storage instances on the same database.
4. Each store has an independent sequence space starting at `1`.
5. Duplicate entry ids are idempotent per store and do not create duplicate committed rows.
6. `entries` and `changes` both use `remoteSequence > startSequence` semantics.
7. `changes` replays backlog and then streams new rows without duplicate startup delivery.
8. `withTransaction` delegates to `sql.withTransaction`.
9. Integration tests cover shared-table behavior, multi-store isolation, idempotency, live streaming, and transaction rollback.

## Testing strategy

### Reusable suite

Add a reusable storage test suite in the persistence-suite style at `packages/effect/test/unstable/eventlog/SqlEventLogServerUnencryptedStorageTest.ts`.

Recommended shape:

- `suite(name: string, layer: Layer.Layer<EventLogServerUnencrypted.Storage, unknown>)`

### Driver-specific runners

Add runner files for:

- `packages/sql/sqlite-node/test/SqlEventLogServerUnencrypted.test.ts`
- `packages/sql/pg/test/SqlEventLogServerUnencrypted.test.ts`
- `packages/sql/mysql2/test/SqlEventLogServerUnencrypted.test.ts`

Notes:

- SQLite should use an in-memory database.
- PostgreSQL and MySQL should use the existing container-backed test utilities, matching the persistence tests.
- MSSQL support must exist in the implementation, but dedicated MSSQL integration coverage is optional for this first pass unless new test infra is introduced alongside it.
- If driver-specific SQL syntax is needed for sequence reservation or locking, cover that branching with focused tests where feasible even if no MSSQL integration runner is added.

### Required test scenarios

1. remote id persistence across storage instances
2. per-store independent sequence counters
3. idempotent writes within one call and across repeated calls
4. `entries(storeId, startSequence)` strict `>` semantics
5. `changes` backlog replay followed by live delivery without startup duplication
6. an explicit startup-race case for `changes`, proving rows are not lost or duplicated while subscription initialization is in progress
7. transaction commit and rollback through `withTransaction`, including sequence reuse after rollback
8. read and stream isolation between stores
9. the same `EntryId` can be committed independently in two different stores

## Validation checklist for implementation

- `pnpm codegen`
- `pnpm lint-fix`
- `pnpm test packages/sql/sqlite-node/test/SqlEventLogServerUnencrypted.test.ts`
- `pnpm test packages/sql/pg/test/SqlEventLogServerUnencrypted.test.ts`
- `pnpm test packages/sql/mysql2/test/SqlEventLogServerUnencrypted.test.ts`
- `pnpm check:tsgo`
- `pnpm docgen`
- If `pnpm check:tsgo` is still failing because of caches, run `pnpm clean` and retry it.

## Detailed implementation plan

### [x] Task 1 — Add the module scaffold, DDL, and export plumbing

Status:

- completed in this change
- remote id persistence now uses a singleton-key SQL table row so concurrent initializers converge on one persisted id after an insert/re-read race
- constructor-time DDL now creates the remote id table, the shared entries table, and the internal `<entriesTable>_stores` helper table
- `write`, `entries`, and `changes` are still scaffold implementations and remain scheduled for Task 2

Validation target after this task:

- `pnpm codegen`
- `pnpm lint-fix`
- `pnpm check:tsgo`
- `pnpm docgen`

Scope:

- create `packages/effect/src/unstable/eventlog/SqlEventLogServerUnencrypted.ts`
- add `makeStorage(options?)` and `layerStorage(options?)` with the final public types
- implement constructor-time DDL for the remote id table, shared entries table, and `<entriesTable>_stores` helper table
- implement race-safe remote id initialization
- expose `withTransaction: sql.withTransaction`
- run `pnpm codegen` so generated barrels export the module

Why this is one task: it establishes the public API and schema footprint in a form that can compile, typecheck, and be exported independently.

### [ ] Task 2 — Implement core storage behavior

Validation target after this task:

- `pnpm lint-fix`
- `pnpm check:tsgo`
- `pnpm docgen`

Scope:

- implement row schemas and decoders for `Entry` and `RemoteEntry` reconstruction
- implement per-store sequence reservation and first-store initialization logic
- implement transactional `write` semantics, including idempotency and batched inserts
- implement strict-`>` `entries` behavior
- implement store-scoped `changes` behavior with backlog replay and startup watermark filtering
- add internal helper logic needed for SQL reads, writes, and pubsub publication timing

Why this is one task: these behaviors depend on one another and should land together so the service semantics remain internally consistent and type-safe.

### [ ] Task 3 — Add reusable integration coverage and driver runners

Validation target after this task:

- `pnpm lint-fix`
- `pnpm test packages/sql/sqlite-node/test/SqlEventLogServerUnencrypted.test.ts`
- `pnpm test packages/sql/pg/test/SqlEventLogServerUnencrypted.test.ts`
- `pnpm test packages/sql/mysql2/test/SqlEventLogServerUnencrypted.test.ts`
- `pnpm check:tsgo`
- `pnpm docgen`

Scope:

- add `packages/effect/test/unstable/eventlog/SqlEventLogServerUnencryptedStorageTest.ts`
- add sqlite-node, pg, and mysql2 runner files that use the shared suite
- cover remote id persistence, per-store sequences, idempotency, backlog/live streaming, startup-race behavior, transaction rollback with sequence reuse, and store isolation

Why this is one task: the reusable suite and the driver runners need to land together so validations exercise real SQL backends immediately. Splitting them would either leave dead test code with no runner or runner files with missing shared coverage.

### [ ] Task 4 — Add release metadata and perform the final validation pass

Validation target after this task:

- `pnpm codegen`
- `pnpm lint-fix`
- `pnpm test packages/sql/sqlite-node/test/SqlEventLogServerUnencrypted.test.ts`
- `pnpm test packages/sql/pg/test/SqlEventLogServerUnencrypted.test.ts`
- `pnpm test packages/sql/mysql2/test/SqlEventLogServerUnencrypted.test.ts`
- `pnpm check:tsgo`
- `pnpm docgen`

Scope:

- add a changeset for the new module
- rerun repository validations
- fix any generated or formatting drift discovered during the final pass

Why this is one task: the feature is not review-ready without release metadata and a clean validation pass. This task is intentionally limited to changeset + validation cleanup so it remains independently shippable.
