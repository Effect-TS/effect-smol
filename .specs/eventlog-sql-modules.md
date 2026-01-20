# SQL EventLog Modules

## Requirements

### Functional
- Add `SqlEventLogJournal` under `packages/effect/src/unstable/eventlog/SqlEventLogJournal.ts` that provides a SQL-backed `EventJournal` implementation with `make` and `layer` constructors.
- Implement `entries`, `write`, `writeFromRemote`, `withRemoteUncommited`, `nextRemoteSequence`, `changes`, and `destroy` using `SqlClient` + `SqlSchema` and wrap `SqlError`/`SchemaError` failures in `EventJournalError`.
- Add `SqlEventLogServer` under `packages/effect/src/unstable/eventlog/SqlEventLogServer.ts` that provides a SQL-backed `EventLogServer.Storage` with `makeStorage`, `layerStorage`, and `layerStorageSubtle`.
- Support dialect-specific DDL for pg/mysql/mssql/sqlite to match effect-old schemas for entry, remotes, and encrypted entry tables.
- Use `EventLogEncryption.sha256String` to derive per-public-key table names and persist a stable `remote_id` row in a dedicated table.
- Export new modules from `effect/unstable/eventlog` via `pnpm codegen` (no manual index edits).
- Add integration tests that exercise the SQL-backed journal and server storage using a real `SqlClient`.

### Non-functional
- Follow existing Effect patterns (`Effect.gen`, `Layer`, `ServiceMap`) and keep implementations concise.
- Use ASCII-only source unless a file already requires Unicode.
- Preserve `@since 4.0.0` JSDoc blocks and avoid extra comments.

## Design

### Module layout and exports
- `packages/effect/src/unstable/eventlog/SqlEventLogJournal.ts`
  - `make(options?)` -> `Effect.Effect<EventJournal.Service, SqlError, SqlClient>`
  - `layer(options?)` -> `Layer.Layer<EventJournal, SqlError, SqlClient>`
- `packages/effect/src/unstable/eventlog/SqlEventLogServer.ts`
  - `makeStorage(options?)` -> `Effect.Effect<EventLogServer.Storage.Service, SqlError, SqlClient | EventLogEncryption | Scope>`
  - `layerStorage(options?)` -> `Layer.Layer<EventLogServer.Storage, SqlError, SqlClient | EventLogEncryption>`
  - `layerStorageSubtle(options?)` -> `Layer.Layer<EventLogServer.Storage, SqlError, SqlClient>`
- Run `pnpm codegen` to update `packages/effect/src/unstable/eventlog/index.ts`.

### Data model (SQL)
- Event journal tables:
  - Entries table (default `effect_event_journal`): `id`, `event`, `primary_key`, `payload`, `timestamp`.
  - Remotes table (default `effect_event_remotes`): `remote_id`, `entry_id`, `sequence`, composite PK `(remote_id, entry_id)`.
  - Dialect types:
    - Postgres: `UUID`, `BYTEA`, `TEXT`, `BIGINT`.
    - MySQL: `BINARY(16)`, `BLOB`, `TEXT`, `BIGINT`.
    - MSSQL: `UNIQUEIDENTIFIER`, `VARBINARY(MAX)`, `NVARCHAR(MAX)`, `BIGINT`.
    - SQLite/other: `BLOB`, `TEXT`, `INTEGER`.
  - Store timestamps as `EventJournal.entryIdMillis(entry.id)` and decode into `EventJournal.Entry` via `Schema.transform`.
- Event log server storage:
  - Remote ID table (default `effect_remote_id`) with a single `remote_id` row.
  - Per-public-key tables with prefix `effect_events_<hash>` and columns `sequence`, `iv`, `entry_id`, `encrypted_entry`.
  - Table name uses `EventLogEncryption.sha256String(publicKey).slice(0, 16)`.

### Behavior
- Journal `write` uses `makeEntryIdUnsafe`, inserts the entry, runs the user effect inside `sql.withTransaction`, then publishes via `PubSub`.
- Journal `writeFromRemote` runs inside `sql.withTransaction`, inserts entries/remotes, filters existing IDs, runs optional compaction, and computes conflicts via timestamped queries on `event` + `primary_key`.
- Journal `nextRemoteSequence` returns `0` when no rows (use `COALESCE`/null checks), otherwise `max + 1`.
- Server `write` batches inserts by `insertBatchSize`, uses `ON CONFLICT DO NOTHING`, re-reads inserted rows ordered by `sequence`, and publishes to PubSub.
- Server `changes` uses `Queue.make`, seeds with initial entries, forwards PubSub updates, and returns `Queue.asDequeue`.

### Testing
- Add integration tests in `packages/sql/sqlite-node/test/SqlEventLogJournal.test.ts` and `packages/sql/sqlite-node/test/SqlEventLogServer.test.ts`.
- Use `SqliteClient.make({ filename: ":memory:" })` with `Reactivity.layer` to avoid filesystem setup.
- Journal tests: `write` persists entries; `writeFromRemote` respects compaction/conflicts; `withRemoteUncommited` filters by remote; `nextRemoteSequence` handles empty state.
- Server tests: `makeStorage` persists `remote_id`; `write` returns ordered sequences and dedupes; `entries`/`changes` stream entries from a start sequence.

## Acceptance Criteria
- `SqlEventLogJournal` and `SqlEventLogServer` compile in `packages/effect/src/unstable/eventlog/` with expected APIs.
- SQL schemas match the effect-old dialect behavior and use current EventLog/EventJournal types and constructors.
- Errors in `SqlEventLogJournal` are wrapped in `EventJournalError` with correct `method` labels.
- `SqlEventLogServer` storage uses `RcMap`, `PubSub`, and `Queue` to deliver changes and maintain deduplication.
- Barrel exports are updated via `pnpm codegen`.
- Required checks pass: `pnpm lint-fix`, `pnpm test <new test files>`, `pnpm check`, `pnpm build`, `pnpm docgen`.
