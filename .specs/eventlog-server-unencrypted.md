# EventLogServerUnencrypted

## Overview

Update `packages/effect/src/unstable/eventlog/EventLogServerUnencrypted.ts`
so the outstanding feedback is addressed without changing the rest of the
feature direction:

1. simplify `StoreMapping` to the two operations the runtime actually needs:
   `resolve(publicKey)` and `hasStore(storeId)`
2. revise the store-mapping layer story so applications can ergonomically:
   - provide their own dynamic resolver from `publicKey -> StoreId`
   - use one static shared `StoreId` for every user
   - seed an in-memory mapping for tests and local development

The rest of the existing direction remains the same:

- multiple `publicKey` values may share one `StoreId`
- transport history is scoped by `StoreId`
- the server may append events directly to a `StoreId`
- handlers continue to reuse `EventLog.group(...)`
- compaction remains read-time only
- authorization happens after store resolution and before persistence

## User Decisions Captured

The specification reflects the following clarified requirements:

1. authorization is handled by a required `EventLogServerAuth` service
2. backend handlers should reuse `EventLog.group(...)`
3. compaction applies only to events older than a configurable fixed duration
4. unauthorized writes reject the whole batch
5. `Ack.sequenceNumbers` must contain one sequence per originally submitted
   event
6. server Reactivity invalidation must run for all accepted events; compaction
   does not suppress invalidation because compaction only happens on outbound
   reads
7. unencrypted protocol responses need an explicit error message type
8. outbound compaction applies to the feed returned from
   `RequestChanges(startSequence)`
9. multiple `publicKey` values may resolve to the same `StoreId`
10. the server must be able to write directly to a `StoreId` so one write can
    be observed by every `publicKey` mapped to that store
11. `StoreMapping` should be read-only from the runtime's perspective and only
    expose `resolve` and `hasStore`
12. users must have an ergonomic way to provide a custom resolver function for
    dynamic `publicKey -> StoreId` lookup
13. a first-class helper should exist for the common case where all users share
    one static `StoreId`

## Goals

- Keep `EventLogServerUnencrypted` usable as a real backend event-log server.
- Preserve store-scoped transport history and shared sequence spaces.
- Make store resolution easy to supply from application code.
- Remove the unused `StoreMapping.assign(...)` mutation API.
- Keep server-authored writes working through `hasStore(storeId)` validation.
- Preserve the current auth, replay, compaction, and Reactivity semantics.

## Non-Goals

- Adding encrypted-protocol error frames in the same change.
- Introducing a built-in admin or provisioning workflow for store mappings.
- Requiring every application to use one repository-owned persistence strategy
  for store resolution.
- Changing the server's transport / journal / compaction architecture beyond
  what is necessary for the feedback items.
- Replacing `EventLog.group(...)` with a new handler DSL.

## Module Surface

### Primary module

- `packages/effect/src/unstable/eventlog/EventLogServerUnencrypted.ts`

### Existing modules that may need small follow-up changes

- `packages/effect/src/unstable/eventlog/EventLogRemote.ts` only if a store
  mapping API rename affects tests or examples
- tests in `packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`

## Current Implementation Status

The repository already contains most of the broader `EventLogServerUnencrypted`
feature work. This feedback pass should be planned as an incremental cleanup and
API refinement, not as a greenfield implementation.

Already present in the current tree:

- store-scoped `Storage` with shared per-store sequence spaces
- server runtime `ingest(...)`, `write(...)`, and `requestChanges(...)`
- websocket / HTTP handlers
- read-time compaction support
- shared replay / Reactivity integration
- a persisted store-mapping convenience implementation
- extensive server and mapping test coverage

This specification therefore focuses only on the remaining feedback still to be
addressed:

- simplify `StoreMapping` from `resolve + assign + hasStore` to
  `resolve + hasStore`
- add ergonomic resolver-based and static shared-store layer helpers
- revise the in-memory mapping helper to use seeded inputs instead of runtime
  mutation

## Public API

### 1. `StoreId`

Keep the branded `StoreId` type representing the shared event namespace.

`StoreId` semantics do not change:

- transport history is keyed by `StoreId`
- multiple `publicKey` values may resolve to the same `StoreId`
- sequence numbers are scoped to `StoreId`, not to `publicKey`

### 2. `StoreMapping`

Simplify the service to the read-only surface the runtime actually consumes.

`StoreMapping` should be:

```ts
export class StoreMapping extends ServiceMap.Service<StoreMapping, {
  readonly resolve: (publicKey: string) => Effect.Effect<StoreId, EventLogServerStoreError>
  readonly hasStore: (storeId: StoreId) => Effect.Effect<boolean, EventLogServerStoreError>
}>()("effect/eventlog/EventLogServerUnencrypted/StoreMapping") {}
```

Semantics:

- `resolve(publicKey)` runs for every client-originated write and every
  `RequestChanges` request before auth and storage access
- `hasStore(storeId)` is used by server-authored `write(...)` to reject
  unknown target stores
- the runtime treats store mapping as externally managed configuration or lookup
  state
- mapping mutation, provisioning, caching, and persistence strategy belong to
  the layer implementation supplied by the application
- many `publicKey` values may resolve to the same `StoreId`
- active subscriptions remain bound to the `StoreId` resolved when the
  subscription is created; later resolver changes only affect new requests

### 3. Store-mapping constructors and layer helpers

The core ergonomics of this feedback item are the helper APIs around
`StoreMapping`.

#### 3.1 Generic constructor

Add a generic constructor that makes it easy to lift a resolver function into a
`StoreMapping` service.

```ts
export const makeStoreMapping: (options: {
  readonly resolve: (publicKey: string) => Effect.Effect<StoreId, EventLogServerStoreError>
  readonly hasStore: (storeId: StoreId) => Effect.Effect<boolean, EventLogServerStoreError>
}) => Effect.Effect<StoreMapping["Service"]>
```

Rules:

- `resolve` is required
- `hasStore` is required
- `hasStore` is a pure existence check, not a provisioning hook
- the constructor should not impose any persistence model

#### 3.2 Dynamic resolver layer

Add an ergonomic layer helper for the most common application integration path:
"I already know how to resolve a public key at runtime."

```ts
export const layerStoreMappingResolver: (options: {
  readonly resolve: (publicKey: string) => Effect.Effect<StoreId, EventLogServerStoreError>
  readonly hasStore: (storeId: StoreId) => Effect.Effect<boolean, EventLogServerStoreError>
}) => Layer.Layer<StoreMapping>
```

This is the preferred public API for application-specific store lookup.

Resolution timing must be explicit:

- `resolve(publicKey)` is called once per `ingest(...)` call
- `resolve(publicKey)` is called once when `requestChanges(...)` creates a
  subscription
- active subscriptions do not repeatedly re-resolve the key after subscription
  creation
- later mapping changes only affect new requests and new subscriptions

Examples this helper must make straightforward:

- resolving from a SQL query
- resolving from a tenant registry in memory
- resolving from a cache with fallback to persistence
- resolving by computing the store id directly from the public key

#### 3.3 Static shared-store layer

Add a dedicated helper for the common case where every client should read and
write against the same shared store.

```ts
export const layerStoreMappingStatic: (options: {
  readonly storeId: StoreId
}) => Layer.Layer<StoreMapping>
```

Semantics:

- `resolve(_publicKey)` always returns the configured `storeId`
- `hasStore(storeId)` returns `true` only for that configured store
- this helper is the easiest way to run a single shared feed for all users

#### 3.4 Seeded in-memory helper

Revise the in-memory helper so it is useful for tests without exposing a runtime
mutation API.

Suggested shape:

```ts
export const makeStoreMappingMemory: (options?: {
  readonly mappings?: Iterable<readonly [publicKey: string, storeId: StoreId]>
  readonly stores?: Iterable<StoreId>
}) => Effect.Effect<StoreMapping["Service"]>

export const layerStoreMappingMemory: (options?: {
  readonly mappings?: Iterable<readonly [publicKey: string, storeId: StoreId]>
  readonly stores?: Iterable<StoreId>
}) => Layer.Layer<StoreMapping>
```

Semantics:

- mapped stores are automatically considered known by `hasStore`
- `stores` allows provisioning a store for server-authored writes even if no
  public key currently resolves to it
- the known-store set is the union of explicitly seeded `stores` and every
  store id present in `mappings`
- duplicate `stores` entries are deduplicated with set semantics
- duplicate `publicKey` seeds use last-write-wins semantics
- the helper is for tests and local development; it is not the primary
  application integration story

#### 3.5 Persisted convenience helpers

If the current tree keeps a repository-owned persisted mapping helper, it should
be treated as a convenience layer built on top of the simplified
`StoreMapping` contract, not as the primary user story.

If retained:

- it must not require an `assign(...)` method on `StoreMapping`
- it must remain read-only from the runtime's perspective and expose only
  `resolve` and `hasStore`
- it must not perform implicit provisioning or backfill side effects as part of
  `resolve` or `hasStore`
- its options must use names that do not confuse persistence namespaces with
  event `StoreId` values
- it should coexist with, not replace, the resolver and static helpers above

### 4. `EventLogServerStoreError`

Keep the tagged error type for store-resolution and store-existence failures.

It must still distinguish at least:

- missing mapping for a `publicKey`
- unknown target `StoreId` for server-authored writes
- operational persistence / resolver failures

Error requirements:

- missing-mapping failures should include `publicKey` when available and use a
  message that makes the missing resolution explicit
- unknown-store failures should include `storeId` and clearly describe the
  target store as unknown or unprovisioned
- operational failures should preserve the underlying failure context in the
  message or cause chain as much as repository conventions allow

### 5. `EventLogServerAuth`

Keep auth store-aware.

```ts
export class EventLogServerAuth extends ServiceMap.Service<EventLogServerAuth, {
  readonly authorizeWrite: (options: {
    readonly publicKey: string
    readonly storeId: StoreId
    readonly entries: ReadonlyArray<Entry>
  }) => Effect.Effect<void, EventLogServerAuthError>
  readonly authorizeRead: (options: {
    readonly publicKey: string
    readonly storeId: StoreId
  }) => Effect.Effect<void, EventLogServerAuthError>
}>()("effect/eventlog/EventLogServerUnencrypted/EventLogServerAuth") {}
```

Semantics remain unchanged:

- resolve store first
- authorize against `{ publicKey, storeId }`
- reject the whole write batch on auth failure

### 6. `EventLogServerUnencrypted` runtime service

Keep the runtime service shape and behavior, with one important adjustment:
server-authored writes validate targets through `StoreMapping.hasStore(storeId)`
rather than through any provisioning side effect on `StoreMapping`.

Key behaviors that must remain true:

- `ingest(...)` resolves the caller's `StoreId`, authorizes the batch,
  writes to store-scoped transport storage, and replays committed entries into
  the processing journal
- `write(...)` appends a typed event directly to a `StoreId`
- `write(...)` fails with
  `EventLogServerStoreError({ reason: "NotFound", storeId })` when
  `hasStore(storeId)` is false
- both client-ingested and server-authored writes share the same per-store
  transport sequence space, replay path, duplicate handling, and Reactivity
  invalidation semantics

### 7. `layer(schema)`

The runtime layer should continue to depend on:

- `EventGroup.ToService<Groups>`
- `EventJournal.EventJournal`
- `Storage`
- `StoreMapping`
- `EventLogServerAuth`

No additional public runtime dependency is needed for this feedback pass.

### 8. `Storage`

Store-scoped transport storage remains unchanged conceptually:

- history is keyed by `StoreId`
- duplicate detection is per store
- `entries` / `changes` emit entries with `remoteSequence > startSequence`
- shared stores expose one ordered feed to every mapped `publicKey`

## Runtime Architecture

### 1. Resolve before auth and storage access

For every inbound request that names a `publicKey`:

1. call `StoreMapping.resolve(publicKey)`
2. if resolution fails, reject the request explicitly
3. authorize with the resolved `storeId`
4. continue using `storeId` for storage and journal replay

### 2. Server-authored writes use `hasStore`

For every runtime `write({ storeId, ... })` call:

1. call `StoreMapping.hasStore(storeId)`
2. fail with `NotFound` if it returns `false`
3. encode the event payload
4. write to store-scoped transport storage
5. replay committed entries into the processing journal
6. fan out the resulting change to every reader currently bound to that store

This preserves the existing runtime behavior while removing the need for a
mutation-oriented `StoreMapping.assign(...)` API.

### 3. Recovery and replay

The reconciliation story does not change:

- persisted transport entries remain the source of truth once written
- the runtime must be able to replay missing committed entries into the journal
  using the deterministic per-store remote identity
- recovery must remain idempotent

### 4. Read-time compaction

The compaction model does not change:

- compact only when serving `RequestChanges`
- compact only entries older than the configured threshold
- preserve cursor monotonicity via representative sequences
- keep recent entries raw

## Testing Requirements

Add or update focused tests that follow existing repository patterns.

### Store-mapping helper coverage

Add focused coverage for:

1. `layerStoreMappingResolver` resolving dynamically from a user-supplied
   function
2. `layerStoreMappingResolver` surfacing resolver failures as
   `EventLogServerStoreError`
3. `layerStoreMappingStatic({ storeId })` resolving every public key to the
   same shared store
4. `layerStoreMappingStatic({ storeId })` reporting `hasStore` correctly
5. `layerStoreMappingMemory({ mappings, stores })` resolving seeded mappings
   and allowing server-authored writes to seeded stores
6. the simplified store-mapping helpers exposing a read-only runtime contract:
   no `assign`, seeded inputs only, and `write(storeId, ...)` failing when
   `hasStore(storeId)` is false

### Core runtime coverage

Keep or update tests covering at minimum:

1. accepted writes run handlers
2. accepted writes invalidate Reactivity
3. two public keys sharing one store see one sequence space
4. server-authored writes broadcast across shared store membership
5. unauthorized write rejects the full batch
6. unauthorized read rejects subscription
7. missing store mapping rejects read and write
8. server-authored writes are idempotent when `entryId` is supplied
9. duplicate writes are idempotent within a store
10. read-time compaction only affects old entries
11. compacted outputs preserve cursor progression across shared-store readers
12. recovery replays persisted-but-unprocessed entries exactly once
13. resolver changes affect only new subscriptions when a dynamic resolver layer
    returns a different store for later calls


## Migration Notes

This feedback changes the intended public shape of store mapping:

- remove `StoreMapping.assign(...)`
- replace mutable mapping setup in tests or apps with one of:
  - `layerStoreMappingResolver(...)`
  - `layerStoreMappingStatic({ storeId })`
  - `layerStoreMappingMemory({ mappings, stores })`
- server-authored writes now rely exclusively on `hasStore(storeId)` for
  existence checks

If a persisted convenience layer remains exported, its documentation must point
users first to the generic resolver and static helpers.

## Validation Expectations

Any implementation produced from this spec must run:

- `pnpm lint-fix`
- targeted tests, at minimum:
  - `pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
  - any updated store-mapping helper tests
  - any updated `EventLogRemote` or `EventLog` tests touched by the cleanup
- `pnpm check:tsgo`
- `pnpm docgen`
- `pnpm codegen` if exports or barrels change
- add a changeset for the unstable eventlog package changes

## Implementation Plan

The remaining feedback should be implemented in the following validation-safe,
independently shippable tasks. The broader runtime, storage, compaction, and
handler work is already in place and is not repeated here as new scope.

### Task 1: Simplify `StoreMapping` and migrate existing call sites

Status: ✅ Completed

Scope:

- remove `assign(...)` from the `StoreMapping` service
- update the existing runtime code to rely only on `resolve(...)` and `hasStore(...)`
- update server-authored write validation to use `hasStore(storeId)`
- update or remove any repository-owned persisted mapping convenience helper in
  the same task so the module compiles and validates without `assign(...)`
- update existing tests and helper setup that currently depend on runtime
  mutation of mappings
- update docs and type signatures affected by the service simplification

Why this task is grouped:

- the API change is not shippable unless runtime code, tests, and docs migrate
  together
- any persisted helper that still assumes `assign(...)` would break typecheck
  and tests, so its fallout has to land in this same task
- changing the service without updating server-write validation would leave the
  module internally inconsistent

Validation for this task:

- `pnpm lint-fix`
- `pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
- any additional updated eventlog test files
- `pnpm check:tsgo`
- `pnpm docgen`
- `pnpm codegen` if exports change

### Task 2: Add the remaining ergonomic resolver, static, and seeded-memory store-mapping helpers

Status: ✅ Completed

Scope:

- add `makeStoreMapping(...)`
- add `layerStoreMappingResolver(...)`
- add `layerStoreMappingStatic({ storeId })`
- revise `makeStoreMappingMemory` / `layerStoreMappingMemory` to accept
  seeded options instead of exposing a mutation workflow
- add or update tests covering dynamic resolution, static shared-store
  resolution, seeded store existence, and error propagation

Why this task is grouped:

- these helpers are the main user-facing feedback item and should land together
  as one coherent API story
- the tests for these helpers are tightly coupled to their final ergonomic shape

Validation for this task:

- `pnpm lint-fix`
- targeted store-mapping helper tests
- `pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
- `pnpm check:tsgo`
- `pnpm docgen`
- `pnpm codegen` if exports change

## Discoveries During Implementation

- Removing `StoreMapping.assign(...)` required migrating runtime test setup to
  seeded `layerStoreMappingMemory({ mappings, stores })` inputs, so tests no
  longer mutate mapping state at runtime.
- Server-authored `write({ storeId, ... })` now gates exclusively on
  `StoreMapping.hasStore(storeId)`; the previous fallback that inferred
  existence from storage history was removed.
- Persisted mapping tests now seed `@mapping/*` and `@store/*` records directly
  through `Persistence` storage, which keeps `makeStoreMappingPersisted` aligned
  with the read-only `StoreMapping` contract.
- Task 2 now exposes read-only resolver ergonomics through
  `makeStoreMapping(...)`, `layerStoreMappingResolver(...)`, and
  `layerStoreMappingStatic({ storeId })`, so applications can provide dynamic
  or shared-store mapping without runtime mutation APIs.
- Focused tests now cover dynamic resolver behavior through
  `layerStoreMappingResolver`, propagation of resolver failures as
  `EventLogServerStoreError`, and static shared-store resolution plus
  `hasStore`-gated server writes.

## Open Follow-Ups

These are out of scope for this feedback pass but should remain visible:

- a SQL-backed transport storage implementation for unencrypted server history
- encrypted-path parity for explicit protocol errors and shared-store broadcast
- higher-level admin tooling for application-managed store provisioning
- dedicated coverage for repository-owned persisted store-mapping conveniences,
  if those remain exported
- evaluate whether changing `layerStoreMappingMemory` from a layer value to a
  callable helper needs a compatibility shim or explicit migration note for
  unstable consumers
- returning explicit unencrypted `InvalidRequest` protocol errors for malformed
  or undecodable websocket frames instead of closing the connection on decode
  defects
