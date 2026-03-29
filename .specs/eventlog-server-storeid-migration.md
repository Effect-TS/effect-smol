# EventLog server StoreId migration

## Summary

Migrate the server-side eventlog modules so `StoreId` is part of server routing instead of being ignored or only partially propagated.

This work has two tracks:

1. **Encrypted server (`EventLogServer`)** must scope journals, deduplication, reads, live change streams, and SQL resources by **`(publicKey, storeId)`** instead of `publicKey` alone.
2. **Unencrypted server (`EventLogServerUnencrypted`)** must update store mapping and request routing so both `publicKey` and `storeId` participate in store resolution for normal read / write flows.

Because clients may request changes for multiple store ids concurrently, this migration also includes the shared protocol/runtime plumbing needed to multiplex change streams by `(publicKey, storeId)`.

This is a planning change only. It does not implement the migration.

## Background and research findings

### Existing shared StoreId support

The repository already has StoreId-aware client/request types in place:

- `EventLog.StoreId` exists in `packages/effect/src/unstable/eventlog/EventLog.ts`
- `EventLogRemote.WriteEntries`
- `EventLogRemote.WriteEntriesUnencrypted`
- `EventLogRemote.RequestChanges`
- `EventLogRemote.Changes`
- `EventLogRemote.ChangesUnencrypted`

All of those message types already include `storeId`.

### Current encrypted server behavior

`packages/effect/src/unstable/eventlog/EventLogServer.ts` is still publicKey-scoped:

- `Storage.write(publicKey, entries)`
- `Storage.entries(publicKey, startSequence)`
- `Storage.changes(publicKey, startSequence)`
- `makeHandler` ignores `request.storeId` for writes and change streams
- in-memory journals / pubsubs / deduplication are keyed only by `publicKey`
- the handler uses one socket-local `latestSequence`, which is not safe once one identity can target multiple stores
- active change subscriptions are keyed only by `publicKey`

`packages/effect/src/unstable/eventlog/SqlEventLogServer.ts` is also still publicKey-scoped:

- the SQL resource/table name is derived from a hash of `publicKey`
- different storeIds under the same publicKey would currently collide into the same backing table

### Current unencrypted server behavior

`packages/effect/src/unstable/eventlog/EventLogServerUnencrypted.ts` already persists entries by `storeId`, but request routing is still resolved from `publicKey` alone:

- `StoreMapping.resolve(publicKey)`
- `StoreMapping.hasStore(storeId)`
- `ingest({ publicKey, entries })`
- `requestChanges(publicKey, startSequence)`
- `makeHandler` ignores the request `storeId` and relies on publicKey-only resolution
- `layerStoreMappingStatic` ignores `publicKey` and does not validate the requested store
- active change subscriptions are keyed only by `publicKey`

### Current client/runtime behavior relevant to the migration

`packages/effect/src/unstable/eventlog/EventLogRemote.ts` already sends `storeId` on write and change requests, but it still keys subscriptions only by `publicKey`:

- `fromSocket` keys `subscriptions` and `identities` by `publicKey`
- `fromSocketUnencrypted` keys `subscriptions` and `identities` by `publicKey`
- `StopChanges` now carries both `publicKey` and `storeId`
- `ProtocolError` now supports optional `storeId`

That means multiple active change streams for different store ids under the same public key cannot be demultiplexed correctly yet.

## User-confirmed decisions

These decisions are confirmed and should be treated as requirements.

### 1. Multiple active change subscriptions per publicKey are required

If a client requests changes for multiple store ids, the runtime must stream changes for **all** of them.

Implications:

- one socket may have multiple active change subscriptions for the same authenticated `publicKey`
- subscriptions must be keyed by `(publicKey, storeId)` rather than `publicKey` alone
- `StopChanges` must become store-aware so one store subscription can be stopped without affecting others
- request error routing for change subscriptions may also need store context so the client can fail the correct subscription queue

### 2. Authenticate remains publicKey-scoped

`Authenticate` does **not** need to be store-aware in this migration.

Implications:

- trusted signing-key bindings remain keyed by `publicKey` only
- handshake verification is identity-only, not store-scoped
- unencrypted normal read / write routing still becomes pair-aware even though authentication does not

### 3. No backward compatibility is required for encrypted SQL storage

The encrypted SQL storage change does **not** need to be backward compatible.

Implications:

- changing the table/resource derivation from `publicKey` to `(publicKey, storeId)` is acceptable
- no compatibility fallback or migration of old publicKey-only encrypted tables is required in this change

## Goals

1. Make encrypted storage and live-stream behavior store-scoped by `(publicKey, storeId)`.
2. Make unencrypted mapping and request routing depend on both `publicKey` and requested `storeId`.
3. Support multiple concurrent change subscriptions for different store ids under the same public key.
4. Ensure handlers and client/runtime plumbing propagate enough store context to route writes, reads, stop requests, and change-stream failures correctly.
5. Preserve per-scope isolation for sequence numbering, deduplication, and streaming.
6. Keep the current session-auth model stable.
7. Add focused tests proving same-publicKey multi-store isolation and multiplexed change streaming.

## Non-goals

- redesigning the session-auth protocol
- adding store-aware Authenticate in this change
- preserving backward compatibility for encrypted SQL storage layout
- redesigning compaction semantics beyond threading the correct store
- adding new persistence backends

## Affected modules

### Code

- `packages/effect/src/unstable/eventlog/EventLogServer.ts`
- `packages/effect/src/unstable/eventlog/SqlEventLogServer.ts`
- `packages/effect/src/unstable/eventlog/EventLogServerUnencrypted.ts`
- `packages/effect/src/unstable/eventlog/EventLogRemote.ts`

### Tests

- `packages/effect/test/unstable/eventlog/EventLogServer.test.ts`
- `packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
- `packages/sql/sqlite-node/test/SqlEventLogServer.test.ts`
- optionally a new focused eventlog protocol/runtime test file if direct multi-subscription coverage is clearer there

## Detailed specification

## 1. Encrypted server: scope by `(publicKey, storeId)`

### 1.1 Storage contract changes

Update `EventLogServer.Storage` so journal operations receive both the authenticated identity and the target store:

- `write(publicKey, storeId, entries)`
- `entries(publicKey, storeId, startSequence)`
- `changes(publicKey, storeId, startSequence)`

The following APIs remain unchanged in this migration:

- `getId`
- `loadSessionAuthBindings`
- `getSessionAuthBinding`
- `putSessionAuthBindingIfAbsent`

### 1.2 Scope semantics

A logical encrypted store scope is the tuple:

- `publicKey`
- `storeId`

Required behavior within one scope:

- preserve the existing encrypted sequence semantics for that scope
- preserve existing deduplication semantics for that scope
- replay and live changes are visible only for that scope

Required isolation across scopes:

- `(publicKey=A, storeId=one)` is isolated from `(A, two)`
- `(A, one)` is isolated from `(B, one)`
- the same `EntryId` may be reused independently across different scopes

### 1.3 Internal scope key helper

Add one internal helper used consistently by encrypted memory storage, encrypted SQL storage, and any handler/client bookkeeping that needs a scope identifier.

Requirements:

- represent the scope unambiguously from both `publicKey` and `storeId`
- do not use naive string concatenation without escaping / encoding
- if a hash is used for SQL table suffixes, use a stable strong digest and treat it as collision-resistant rather than collision-free

### 1.4 Memory storage requirements

`EventLogServer.makeStorageMemory` must:

- scope `knownIds` by `(publicKey, storeId)`
- scope `journals` by `(publicKey, storeId)`
- scope `pubsubs` by `(publicKey, storeId)`
- keep session-auth bindings keyed by `publicKey`

### 1.5 SQL storage requirements

`SqlEventLogServer.makeStorage` must derive its backing table/resource from the full encrypted scope.

Required behavior:

- table/resource lookup uses both `publicKey` and `storeId`
- same publicKey with different storeIds must not share a backing table/resource
- same storeId with different publicKeys must not share a backing table/resource
- existing per-scope write/read/changes semantics remain unchanged apart from the new scope key

### 1.6 Encrypted handler requirements

`EventLogServer.makeHandler` must:

- use `request.storeId` for `WriteEntries`
- use `request.storeId` for `RequestChanges`
- pass both values into storage calls
- emit `Changes` with the correct `storeId`
- support multiple concurrent active change subscriptions for the same `publicKey` across different `storeId` values
- key subscription fibers by `(publicKey, storeId)` rather than `publicKey` alone
- maintain replay/live filtering state per active store subscription rather than one socket-global watermark
- stop only the requested `(publicKey, storeId)` subscription when receiving `StopChanges`

### 1.7 Encrypted acceptance criteria

The encrypted migration is correct when:

1. writes to two different storeIds for the same publicKey do not mix
2. writes to the same storeId for different publicKeys do not mix
3. outgoing `Changes` responses include the requested `storeId`
4. the same `EntryId` can be committed independently in two encrypted scopes
5. two active change subscriptions for `(A, one)` and `(A, two)` can coexist on one socket and each only receives its own store's entries
6. stopping `(A, one)` does not stop `(A, two)`

## 2. Shared protocol/runtime changes for multiplexed change streams

### 2.1 `StopChanges` must include `storeId`

Update `EventLogRemote.StopChanges` to carry:

- `publicKey`
- `storeId`

Required behavior:

- stopping one store subscription must not affect another active store subscription for the same public key
- client and server code must treat `StopChanges` as scoped to `(publicKey, storeId)`

### 2.2 `ProtocolError` should carry `storeId` when request-scoped routing needs it

Because change subscriptions are now multiplexed by `(publicKey, storeId)`, request-scoped errors for change operations need enough context to fail the correct subscription queue.

Required behavior:

- `ProtocolError` should gain optional `storeId`
- `RequestChanges` and `StopChanges` errors should include `storeId` when available
- `WriteEntries*` errors may include `storeId` as well for consistency, but request id remains the primary routing key for writes

### 2.3 `EventLogRemote.fromSocket` requirements

Update the encrypted remote runtime so it can manage multiple store-scoped subscriptions concurrently.

Required behavior:

- key `subscriptions` by `(publicKey, storeId)`
- key any identity/subscription bookkeeping needed for live changes by `(publicKey, storeId)` or otherwise preserve store-correct routing
- route incoming `Changes` messages to the correct store-scoped queue
- route `RequestChanges` / `StopChanges` protocol errors to the correct store-scoped queue using `publicKey + storeId`
- send store-scoped `StopChanges` during subscription finalization

### 2.4 `EventLogRemote.fromSocketUnencrypted` requirements

Apply the same multiplexing rules to the unencrypted remote runtime.

### 2.5 Shared acceptance criteria

The protocol/runtime multiplexing is correct when:

1. a client can request changes for two store ids under the same public key and receive both streams concurrently
2. incoming `Changes` messages are offered to the correct queue for each store
3. failing one store subscription does not fail other store subscriptions for the same public key
4. `StopChanges(publicKey, storeId)` only stops the targeted subscription

## 3. Unencrypted server: make mapping pair-aware for normal routing

### 3.1 StoreMapping API changes

Update `StoreMapping` so normal request routing depends on both `publicKey` and `storeId`.

Preferred API shape:

- `resolve(options: { publicKey: string; storeId: EventLog.StoreId }) => Effect.Effect<EventLog.StoreId, EventLogServerStoreError>`
- `hasStore(options: { publicKey: string; storeId: EventLog.StoreId }) => Effect.Effect<boolean, EventLogServerStoreError>`

Equivalent positional signatures are acceptable if they fit repository style, but all callers must be pair-aware.

### 3.2 Mapping semantics

Required behavior:

- mapping may allow `(A, one)` and reject `(A, two)`
- mapping may allow `(A, one)` and reject `(B, one)`
- the returned store id is the canonical store used for authorization and persistence
- `NotFound` errors should carry the relevant store context where possible

### 3.3 Static mapping layer requirements

Update `layerStoreMappingStatic` so it validates the requested store.

Required behavior:

- it provisions one canonical store id
- `resolve(...)` succeeds only when the requested store matches that canonical store
- `hasStore(...)` returns true only for that canonical store
- it may remain publicKey-agnostic internally, but it must accept `publicKey` in its interface so callers are uniform

### 3.4 Runtime API changes

Update the runtime API so the handler passes the requested store explicitly.

Required changes:

- `ingest({ publicKey, storeId, entries })`
- `requestChanges(publicKey, storeId, startSequence)`

Required internal threading:

- mapping resolution
- store-existence checks
- authorization checks
- persistence calls
- outgoing `ChangesUnencrypted` responses
- error creation where store context is available

`write` already accepts `storeId` and remains store-aware.

### 3.5 Authorization requirements

For normal request routing:

- `authorizeWrite` runs against the canonical store resolved from `(publicKey, requestedStoreId)`
- `authorizeRead` runs against the canonical store resolved from `(publicKey, requestedStoreId)`
- store resolution / not-found behavior occurs before persistence work

### 3.6 Authenticate behavior in this migration

Because `Authenticate` does not carry `storeId`, this migration keeps the current handshake scope:

- first-bind Authenticate remains publicKey-scoped
- trusted signing-key persistence remains publicKey-scoped
- pair-aware `StoreMapping` is **not** required for the Authenticate handshake in this migration

This means the existing first-bind read-check behavior may remain on its current publicKey-scoped path or be refactored internally without changing the wire protocol. The implementation must not accidentally weaken that check without explicit review.

### 3.7 Unencrypted handler requirements

`EventLogServerUnencrypted.makeHandler` must:

- pass `request.storeId` into runtime `ingest`
- pass `request.storeId` into runtime `requestChanges`
- emit `ChangesUnencrypted` with the correct `storeId`
- support multiple concurrent active change subscriptions for the same `publicKey` across different `storeId` values
- key subscription fibers by `(publicKey, storeId)` rather than `publicKey` alone
- stop only the requested `(publicKey, storeId)` subscription when receiving `StopChanges`
- keep error handling aligned with the same request scope

### 3.8 Internal server-write identity

Internal server-generated writes currently synthesize a public key from store id.

Required behavior after this migration:

- internal writes remain scoped to their target store
- synthetic identity formatting must not cause two target stores to collapse into one routing path
- if synthetic public keys are visible to auth or handler code, behavior must remain deterministic for the target store

### 3.9 Unencrypted acceptance criteria

The unencrypted migration is correct when:

1. `ingest` distinguishes same-publicKey requests targeting different storeIds
2. `requestChanges` distinguishes same-publicKey reads targeting different storeIds
3. mapping can allow one `(publicKey, storeId)` pair and reject another
4. `layerStoreMappingStatic` rejects mismatched requested storeIds
5. outgoing `ChangesUnencrypted` responses include the correct `storeId`
6. two active change subscriptions for `(A, one)` and `(A, two)` can coexist on one socket and each only receives its own store's entries
7. stopping `(A, one)` does not stop `(A, two)`

## Testing strategy

### Encrypted tests

Add or update tests for:

1. memory-storage isolation for same publicKey / different storeIds
2. memory-storage isolation for different publicKeys / same storeId
3. per-scope deduplication boundaries
4. handler write routing uses request `storeId`
5. handler change requests only replay the requested store
6. outgoing `Changes` includes the requested `storeId`
7. two active change subscriptions for different store ids under the same public key can coexist on one socket
8. `StopChanges(publicKey, storeId)` stops only the targeted encrypted subscription
9. sqlite SQL storage isolates `(publicKey, storeId)` scopes correctly

### Unencrypted tests

Add or update tests for:

1. `layerStoreMappingStatic` rejects a mismatched requested store id
2. `ingest({ publicKey, storeId, entries })` routes to the requested store
3. `requestChanges(publicKey, storeId, startSequence)` routes to the requested store
4. mapping can distinguish allowed vs rejected `(publicKey, storeId)` pairs
5. same publicKey can interact with different stores without collapsing into one resolved store
6. outgoing `ChangesUnencrypted` includes the correct `storeId`
7. two active change subscriptions for different store ids under the same public key can coexist on one socket
8. `StopChanges(publicKey, storeId)` stops only the targeted unencrypted subscription
9. first-bind Authenticate behavior remains covered after the runtime signature changes

### Protocol/runtime tests

Add or update focused tests for:

1. `EventLogRemote` demultiplexes `Changes` by `(publicKey, storeId)`
2. `EventLogRemote` fails only the targeted subscription queue when a `RequestChanges` error includes `storeId`
3. client finalization sends store-scoped `StopChanges`

### Validation checklist for implementation

- `pnpm lint-fix`
- `pnpm test packages/effect/test/unstable/eventlog/EventLogServer.test.ts`
- `pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
- `pnpm test packages/sql/sqlite-node/test/SqlEventLogServer.test.ts`
- any newly added focused eventlog test files
- `pnpm check:tsgo`
- `pnpm docgen`
- `pnpm codegen` if public files/exports change

A PR implementing this specification must also include a changeset.

## Implementation plan

The tasks below are grouped so each task can land with passing validation on its own.

### Task 1: Encrypted storage scoping ✅ Completed

Scope:

- `EventLogServer.Storage`
- `EventLogServer.makeStorageMemory`
- `SqlEventLogServer.makeStorage`
- encrypted storage-focused tests

Deliverables:

- update the encrypted storage contract to accept `storeId`
- add one internal encrypted scope-key helper
- scope journals, deduplication, pubsubs, and SQL table/resource lookup by `(publicKey, storeId)`
- add or update direct tests proving isolation and per-scope deduplication

Why this is atomic:

- the signature change and both storage implementations must land together to compile
- handler code can remain untouched until the next task if direct storage callers/tests are updated in the same change

Task validation:

- `pnpm lint-fix`
- encrypted storage-focused tests
- `pnpm check:tsgo`

### Task 2: Shared multiplexed change-stream protocol/runtime plumbing ⏳ Pending

Scope:

- `EventLogRemote.ts`
- shared protocol message updates used by both encrypted and unencrypted flows
- focused protocol/runtime tests

Deliverables:

- add `storeId` to `StopChanges`
- add optional `storeId` to `ProtocolError` where needed for request-scoped routing
- key client/runtime change subscriptions by `(publicKey, storeId)`
- route incoming `Changes` and change-request errors to the correct store-scoped queue
- send store-scoped `StopChanges` during finalization
- add/update focused tests for multi-store demultiplexing

Why this is atomic:

- protocol shapes and remote runtime queue routing are tightly coupled
- splitting them would leave the client/runtime unable to compile or validate correctly
- this task can ship before the unencrypted mapping task because it only establishes shared multiplexing behavior

Task validation:

- `pnpm lint-fix`
- focused eventlog protocol/runtime tests
- `pnpm check:tsgo`

### Task 3: Encrypted handler multi-store routing ⏳ Pending

Scope:

- `EventLogServer.makeHandler`
- encrypted handler tests

Deliverables:

- route write/change requests through the new store-scoped storage API
- support multiple active encrypted store subscriptions per public key
- key handler subscriptions by `(publicKey, storeId)`
- emit `Changes` with the correct `storeId`
- stop only the targeted encrypted subscription on `StopChanges`
- add/update tests for encrypted multi-store request routing and selective stop behavior

Why this is atomic:

- it depends on Tasks 1 and 2
- once those foundations exist, the encrypted handler and its tests can ship together without requiring unencrypted mapping changes

Task validation:

- `pnpm lint-fix`
- `pnpm test packages/effect/test/unstable/eventlog/EventLogServer.test.ts`
- `pnpm test packages/sql/sqlite-node/test/SqlEventLogServer.test.ts`
- `pnpm check:tsgo`

### Task 4: Unencrypted mapping and handler/runtime migration ⏳ Pending

Scope:

- `EventLogServerUnencrypted.StoreMapping`
- `layerStoreMappingStatic`
- unencrypted runtime method signatures
- unencrypted handler routing
- unencrypted tests

Deliverables:

- make normal mapping pair-aware for `(publicKey, storeId)`
- update `ingest` and `requestChanges` to accept explicit `storeId`
- thread resolved store context through auth, persistence, and changes responses
- support multiple active unencrypted store subscriptions per public key
- stop only the targeted unencrypted subscription on `StopChanges`
- keep first-bind Authenticate behavior explicitly covered while leaving it publicKey-scoped
- add/update tests for pair-aware routing, multi-store streaming, and selective stop behavior

Why this is atomic:

- mapping signatures, runtime signatures, and handler callers are tightly coupled
- selective stop behavior for unencrypted changes depends on those updated signatures and handlers together
- splitting this more finely would likely leave the package non-compiling or failing tests between steps

Task validation:

- `pnpm lint-fix`
- `pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
- `pnpm check:tsgo`

### Task 5: Final validation and release metadata ⏳ Pending

Scope:

- repository-wide validation
- barrel regeneration if needed
- changeset

Deliverables:

- run the full validation checklist
- run `pnpm codegen` if exports changed
- add a changeset for the server StoreId migration

Why this is atomic:

- it is a final integration task after the code changes above
- it keeps release metadata and full validation separate from the implementation tasks

Task validation:

- `pnpm lint-fix`
- `pnpm test packages/effect/test/unstable/eventlog/EventLogServer.test.ts`
- `pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
- `pnpm test packages/sql/sqlite-node/test/SqlEventLogServer.test.ts`
- any newly added focused eventlog tests
- `pnpm check:tsgo`
- `pnpm docgen`
- `pnpm codegen` when required
