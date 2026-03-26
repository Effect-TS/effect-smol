# EventLogServerUnencrypted

## Overview

Update `packages/effect/src/unstable/eventlog/EventLogServerUnencrypted.ts`
so it supports two new capabilities together:

1. multiple client `publicKey`s may share one persisted `StoreId`
2. the server may append its own events directly to a `StoreId`

`StoreId` is the shared namespace for outbound history:

- multiple `publicKey`s may resolve to the same `StoreId`
- all mapped `publicKey`s observe the same ordered change feed
- client-submitted writes are stored against the resolved `StoreId`
- server-authored writes target a `StoreId` directly and fan out to every
  connected `publicKey` mapped to that store

This remains **read-time compaction, not ingest-time compaction**:

- all accepted inbound and server-authored events are stored and processed
  immediately
- handlers and Reactivity invalidation run for all newly accepted events
- compaction only affects what the server sends back from `RequestChanges`
- compaction applies only to entries older than a configurable fixed duration

The design should continue to reuse existing EventLog patterns:

- `EventLog.group(...)` remains the handler authoring API
- payload decoding / grouping logic from `EventLog.groupCompaction(...)` should
  be reused or factored into shared helpers
- Reactivity invalidation semantics should match `EventLog`
- `SqlEventLogJournal` remains the preferred processing journal when
  persistence is needed

## User Decisions Captured

The specification reflects the following clarified requirements:

1. authorization is handled by a new required `EventLogServerAuth` service
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
9. `publicKey`s must resolve through a persisted mapping to a shared `StoreId`
10. the server must be able to write directly to a `StoreId` so one write can be
    observed by multiple `publicKey`s that share that store

## Goals

- Make `EventLogServerUnencrypted` feature-complete enough to back a real
  backend event-log endpoint.
- Allow several client identities to share one outbound event namespace through
  a persisted `publicKey -> StoreId` mapping.
- Allow the backend to append its own events into a store-scoped feed and have
  those events fan out to every mapped client.
- Allow the backend to execute the same handlers authored with
  `EventLog.group(...)` that are already used by clients.
- Ensure accepted writes and server-authored writes trigger the same Reactivity
  invalidation pattern used by `EventLog`.
- Allow the backend to reject unauthorized reads and writes before persisting or
  processing a batch.
- Support compacted catch-up feeds for older history while preserving cursor
  compatibility.
- Finish the already-started unencrypted protocol support in `EventLogRemote`.

## Non-Goals

- Adding encrypted-protocol error frames in the same change.
- Mutating or deleting stored raw events as part of compaction.
- Broadcasting a server-authored event to every known `publicKey` globally.
  Broadcasting only happens through a shared `StoreId`.
- Automatically rebinding active subscriptions when a mapping changes. Mapping
  changes only affect new requests unless a later change explicitly adds live
  rebinding.
- Replacing `EventLog.group(...)` with a new handler DSL.
- Solving client-side garbage collection of already-synced historical raw events
  when a later catch-up response is compacted.

## Module Surface

### Primary module

- `packages/effect/src/unstable/eventlog/EventLogServerUnencrypted.ts`

### Existing modules that must change

- `packages/effect/src/unstable/eventlog/EventLogRemote.ts`
- `packages/effect/src/unstable/eventlog/EventLog.ts` for shared helper
  extraction only, unless a small public adjustment is cleaner
- optionally `packages/effect/src/unstable/eventlog/EventJournal.ts` if a small
  helper type is needed
- optionally `packages/effect/src/unstable/eventlog/SqlEventLogServer.ts` or a
  nearby module if that is the cleanest place to house a persisted store-mapping
  implementation

### Tests

- `packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
- update/add targeted tests around `EventLogRemote.ts` if needed
- add focused tests for store mapping behavior if a separate file is cleaner

## Public API

### 1. `StoreId`

Add a branded string type representing the shared event namespace for multiple
`publicKey`s.

```ts
export type StoreIdTypeId = "effect/eventlog/EventLogServerUnencrypted/StoreId"

export type StoreId = string & Brand<StoreIdTypeId>

export const StoreId = Schema.String.pipe(Schema.brand(StoreIdTypeId))
```

Semantics:

- `StoreId` is the key used by transport history storage
- all sequence numbers are scoped to `StoreId`, not to `publicKey`
- `StoreId` is server-side API surface; clients continue to speak only in terms
  of `publicKey`

### 2. `StoreMapping`

Add a new required service responsible for persisting `publicKey -> StoreId`
resolution.

```ts
export class StoreMapping extends ServiceMap.Service<StoreMapping, {
  readonly resolve: (publicKey: string) => Effect.Effect<StoreId, EventLogServerStoreError>
  readonly assign: (options: {
    readonly publicKey: string
    readonly storeId: StoreId
  }) => Effect.Effect<void, EventLogServerStoreError>
}>()("effect/eventlog/EventLogServerUnencrypted/StoreMapping") {}
```

Semantics:

- `resolve(publicKey)` is called for every `WriteEntriesUnencrypted` request and
  every `RequestChanges` subscription request before auth and storage access
- one `publicKey` maps to exactly one current `StoreId`
- many `publicKey`s may map to the same `StoreId`
- `assign(...)` is an upsert and implicitly provisions the referenced store; no
  separate store-creation API is required in the initial design
- `assign(...)` must persist the association so a process restart does not
  silently move a key into a different store
- active subscriptions remain bound to the `StoreId` resolved at subscription
  creation time; reassignment only affects future requests

The exact mutation surface may vary if repository conventions prefer a narrower
API, but the implementation must provide both:

- a runtime-resolvable persisted lookup
- an application-facing way to create or update mappings

### 3. `EventLogServerStoreError`

Add a tagged error type for store-resolution and mapping persistence failures.

```ts
export class EventLogServerStoreError extends Data.TaggedError("EventLogServerStoreError")<{
  readonly reason: "NotFound" | "PersistenceFailure"
  readonly publicKey?: string | undefined
  readonly storeId?: StoreId | undefined
  readonly message?: string | undefined
}> {}
```

Exact fields may vary, but the type must be structured enough to distinguish:

- missing mapping for a client key
- writes to an unknown `StoreId`
- operational persistence failures

### 4. `EventLogServerAuth`

Update the required auth service so reads and writes are authorized against the
resolved `StoreId`, not only the raw `publicKey`.

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

Semantics:

- store resolution happens before auth
- `authorizeWrite` is batch-wide; if it fails, the entire write request is
  rejected
- `authorizeRead` runs before creating a `RequestChanges` subscription
- server-authored writes performed through the runtime `write(...)` API are
  trusted internal operations and do not go through `EventLogServerAuth`

### 5. `EventLogServerAuthError`

Keep a tagged error type for auth rejections.

```ts
export class EventLogServerAuthError extends Data.TaggedError("EventLogServerAuthError")<{
  readonly reason: "Unauthorized" | "Forbidden"
  readonly publicKey: string
  readonly storeId?: StoreId | undefined
  readonly message?: string | undefined
}> {}
```

### 6. `EventLogServerUnencrypted` runtime service

Add a server runtime service, parallel to the client-side `EventLog` runtime,
responsible for:

- resolving `publicKey`s to store-scoped transport history
- ingesting accepted client entries
- appending server-authored events directly to a `StoreId`
- registering outbound compactors
- registering Reactivity mappings
- exposing enough behavior for websocket / HTTP handlers

Suggested shape:

```ts
export class EventLogServerUnencrypted extends ServiceMap.Service<EventLogServerUnencrypted, {
  readonly ingest: (options: {
    readonly publicKey: string
    readonly entries: ReadonlyArray<Entry>
  }) => Effect.Effect<{
    readonly storeId: StoreId
    readonly sequenceNumbers: ReadonlyArray<number>
    readonly committed: ReadonlyArray<RemoteEntry>
  }, EventLogServerAuthError | EventLogServerStoreError | EventJournal.EventJournalError>
  readonly write: <Groups extends EventGroup.Any, Tag extends Event.Tag<EventGroup.Events<Groups>>>(options: {
    readonly schema: EventLog.EventLogSchema<Groups>
    readonly storeId: StoreId
    readonly event: Tag
    readonly payload: Event.PayloadWithTag<EventGroup.Events<Groups>, Tag>
    readonly entryId?: EntryId | undefined
  }) => Effect.Effect<
    Event.SuccessWithTag<EventGroup.Events<Groups>, Tag>,
    Event.ErrorWithTag<EventGroup.Events<Groups>, Tag> | EventLogServerStoreError | EventJournal.EventJournalError
  >
  readonly requestChanges: (
    publicKey: string,
    startSequence: number
  ) => Effect.Effect<Queue.Dequeue<RemoteEntry, EventLogRemote.EventLogRemoteError>, never, Scope.Scope>
  readonly registerCompaction: (options: {
    readonly events: ReadonlyArray<string>
    readonly olderThan: Duration.DurationInput
    readonly effect: (options: {
      readonly entries: ReadonlyArray<Entry>
      readonly write: (entry: Entry) => Effect.Effect<void>
    }) => Effect.Effect<void>
  }) => Effect.Effect<void, never, Scope.Scope>
  readonly registerReactivity: (keys: Record<string, ReadonlyArray<string>>) => Effect.Effect<void, never, Scope.Scope>
}>()("effect/eventlog/EventLogServerUnencrypted") {}
```

Behavior:

- `ingest(...)` resolves the caller's `StoreId`, authorizes the write, writes to
  transport storage, replays committed entries into the processing journal, and
  returns the resolved `storeId`
- `write(...)` lets trusted server code append a typed event directly to a
  `StoreId`; the result must become visible to all mapped `publicKey`s through
  `RequestChanges`
- `write(...)` must fail with `EventLogServerStoreError({ reason: "NotFound" })`
  if the target store has not been provisioned through `StoreMapping.assign(...)`
- if `entryId` is omitted, the runtime generates one and the call is not
  idempotent across retries; if `entryId` is provided, duplicate detection is
  performed against that id within the target store
- `write(...)` should run the same payload encoding, handler execution,
  duplicate filtering, and Reactivity invalidation path as accepted client
  writes

### 7. `layer`

Add a layer constructor, parallel to `EventLog.layer(...)`, for building the
server runtime.

```ts
export const layer: <Groups extends EventGroup.Any>(
  schema: EventLog.EventLogSchema<Groups>
) => Layer.Layer<
  EventLogServerUnencrypted,
  never,
  EventGroup.ToService<Groups> |
    EventJournal.EventJournal |
    Storage |
    StoreMapping |
    EventLogServerAuth
>
```

Notes:

- handlers are still authored with `EventLog.group(...)`
- the server runtime should read those registrations from the produced service
  map like `EventLog` does
- the runtime should provide enough context for handlers to distinguish
  client-originated vs server-originated writes; this can stay internal if a new
  public service is unnecessary
- if handler execution needs `EventLog.Identity.publicKey`, client-originated
  writes should expose the submitting key; server-originated writes should use a
  documented synthetic value or internal origin context rather than pretending a
  real client private key exists

### 8. `groupCompaction`

Add a server-local compaction helper mirroring `EventLog.groupCompaction(...)`
but with an age threshold.

```ts
export const groupCompaction: <Events extends Event.Any, R>(
  group: EventGroup.EventGroup<Events>,
  options: {
    readonly olderThan: Duration.DurationInput
  },
  effect: (options: {
    readonly primaryKey: string
    readonly entries: ReadonlyArray<Entry>
    readonly events: ReadonlyArray<Event.TaggedPayload<Events>>
    readonly write: <Tag extends Event.Tag<Events>>(
      tag: Tag,
      payload: Event.PayloadWithTag<Events, Tag>
    ) => Effect.Effect<void, never, Event.PayloadSchemaWithTag<Events, Tag>["EncodingServices"]>
  }) => Effect.Effect<void, never, R>
) => Layer.Layer<
  never,
  never,
  EventLogServerUnencrypted | R | Event.PayloadSchema<Events>["DecodingServices"]
>
```

Behavior:

- only entries with `entry.createdAtMillis <= now - olderThan` are eligible
- compaction affects only outbound `RequestChanges` responses
- payload decoding and grouping by primary key should match
  `EventLog.groupCompaction(...)`
- compaction operates on the store-scoped outbound history, not on a single
  `publicKey`

### 9. `groupReactivity`

Add a server-local helper mirroring `EventLog.groupReactivity(...)` so the
server runtime can register per-event invalidation keys without depending on the
client-side `EventLog` service.

### 10. `makeHandler` and `makeHandlerHttp`

Add websocket / HTTP upgrade handlers parallel to `EventLogServer.makeHandler`
and `makeHandlerHttp`.

```ts
export const makeHandler: Effect.Effect<
  (socket: Socket.Socket) => Effect.Effect<void, Socket.SocketError>,
  never,
  EventLogServerUnencrypted
>

export const makeHandlerHttp: Effect.Effect<
  Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    HttpServerError.HttpServerError | Socket.SocketError,
    HttpServerRequest.HttpServerRequest | Scope.Scope
  >,
  never,
  EventLogServerUnencrypted
>
```

The preferred end state is for transport handlers to depend only on the runtime
service.

### 11. `Storage`

Update transport storage so history is keyed by `StoreId`.

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
}>()("effect/eventlog/EventLogServerUnencrypted/Storage") {}
```

Storage semantics:

- sequences are monotonically increasing per `StoreId`
- new sequence numbers begin at `1` for a new `StoreId`
- `write` returns one sequence number per submitted input entry
- duplicate detection is scoped to `StoreId` by `entry.id`
- `entries(storeId, startSequence)` and `changes(storeId, startSequence)` return
  only entries with `remoteSequence > startSequence`; `startSequence` means
  "last seen sequence", not "first sequence to include"
- only `committed` entries are replayed into handlers and Reactivity
- every `publicKey` mapped to the same `StoreId` reads the same ordered history

### 12. `makeStorageMemory` / `layerStorageMemory`

Add an in-memory storage implementation keyed by `StoreId`. It is required for
tests and local development.

### 13. `makeStoreMappingMemory` / `layerStoreMappingMemory`

Add an in-memory mapping implementation for tests and local development.

This implementation is not sufficient for durable production use; the feature
also requires at least one persisted `StoreMapping` implementation or a clearly
documented adapter story that applications can use immediately.

## EventLogRemote Changes

The existing unencrypted support in `EventLogRemote.ts` is incomplete and must
be finished as part of this work.

### Protocol additions

Add an explicit unencrypted error response:

```ts
export class ErrorUnencrypted extends Schema.Class<ErrorUnencrypted>(
  "effect/eventlog/EventLogRemote/ErrorUnencrypted"
)({
  _tag: Schema.tag("Error"),
  requestTag: Schema.String,
  id: Schema.optional(Schema.Number),
  publicKey: Schema.optional(Schema.String),
  code: Schema.Literal("Unauthorized", "Forbidden", "NotFound", "InvalidRequest", "InternalServerError"),
  message: Schema.String
}) {}
```

The exact schema can differ, but it must support:

- correlating write failures to a pending `WriteEntries` request id
- indicating read-subscription failures for `RequestChanges`
- communicating auth or store-resolution failures in a machine-readable form

Update:

- `ProtocolResponseUnencrypted`
- `ProtocolResponseUnencryptedMsgpack`
- `decodeResponseUnencrypted`
- `encodeResponseUnencrypted`

### Codec correctness

Complete the unfinished unencrypted protocol path in `EventLogRemote.ts`:

- `fromSocketUnencrypted` must use the unencrypted request encoder and response
  decoder consistently
- correct any misspelled unencrypted encoder helper names
- if a typo is already exported, keep a temporary backwards-compatible alias or
  deprecate it in place rather than silently breaking consumers

### Error surfacing

Because the server now sends explicit unencrypted protocol errors, the remote
client API must surface them.

Required behavior:

- a write rejection must fail the corresponding `remote.write(...)` effect with
  `EventLogRemoteError`
- a rejected `RequestChanges` subscription must fail the returned dequeue, or an
  equivalent fallible subscription mechanism, with `EventLogRemoteError`
- downstream `EventLog.registerRemote(...)` consumption must handle those
  failures by logging and continuing its normal retry behavior

## Runtime Architecture

### 1. Separate store-scoped transport history from the processing journal

The server has two distinct responsibilities:

1. maintain a `StoreId`-scoped transport feed used by `RequestChanges`
2. run handlers / conflicts / Reactivity against a backend processing journal

Use the new unencrypted `Storage` service for (1), and the existing
`EventJournal` service for (2).

This keeps the design aligned with existing abstractions:

- transport history is optimized for websocket delivery, cursoring, and
  compaction
- `SqlEventLogJournal` remains usable as the processing journal
- multiple `publicKey`s can share one feed without duplicating raw transport
  entries per key

### 2. Resolve `publicKey` to `StoreId` before auth or storage access

For every inbound client request that names a `publicKey`:

1. resolve `StoreId` via `StoreMapping.resolve(publicKey)`
2. if resolution fails due to missing mapping, reject the request explicitly
3. if resolution fails due to persistence or operational issues, surface an
   internal-server-style protocol error where possible
4. authorize the operation against `{ publicKey, storeId }`
5. continue using `storeId` for storage and journal replay

`StoreId` never needs to cross the public websocket protocol.

### 3. Stable journal origin per `StoreId`

Accepted writes and server-authored writes should replay into the processing
journal through one deterministic remote origin per store.

Recommended approach:

- derive a deterministic `RemoteId` from `StoreId`
- keep the derivation internal to the server runtime
- use that same derived `RemoteId` for both client-authored and server-authored
  writes that target the same store

This ensures journal replay sees one sequence space per shared store feed rather
than one sequence space per individual `publicKey`.

### 4. Client ingest pipeline

For each `WriteEntriesUnencrypted` request:

1. decode request
2. resolve `storeId` from `publicKey`
3. authorize the batch through `EventLogServerAuth.authorizeWrite`
4. if auth or mapping fails, send `ErrorUnencrypted` and do not persist anything
5. persist raw entries into `Storage.write(storeId, entries)`
6. send `Ack` with `sequenceNumbers.length === request.entries.length`
7. replay only `committed` entries into `EventJournal.writeFromRemote(...)`
8. during replay, run backend handlers and Reactivity invalidation exactly once
   per committed entry
9. do not compact during ingest

Duplicate handling:

- duplicate detection is per `StoreId`
- `Ack.sequenceNumbers` still includes a sequence for every input slot
- duplicates are not re-committed to storage
- duplicates are not re-run through handlers
- duplicates do not re-trigger Reactivity invalidation

### 5. Server-authored write pipeline

The runtime must expose a server-local write path for appending events directly
to a store.

For each runtime `write({ storeId, event, payload, schema, entryId? })` call:

1. verify the target store exists
2. locate the handler registration for the event tag from the supplied schema
3. encode the payload using the event schema
4. construct a raw `Entry`
5. persist the entry into `Storage.write(storeId, [entry])`
6. replay any committed entry into `EventJournal.writeFromRemote(...)` using the
   deterministic `RemoteId` for that store
7. run the same handler execution and Reactivity invalidation path used for
   client-ingested writes
8. publish the resulting `RemoteEntry` to live `RequestChanges` subscribers for
   every `publicKey` mapped to that store

Semantics:

- the write is visible to all `publicKey`s that resolve to the target `StoreId`
- the server write bypasses `EventLogServerAuth`
- duplicate detection is the same as for client-ingested entries
- store-scoped sequence numbering is shared with client-originated writes
- retries are only idempotent when the caller supplies an explicit `entryId`

### 6. Recovery from persisted-but-not-processed entries

Transport storage persistence happens before journal replay, so the runtime must
define recovery for the case where `Storage.write` succeeds but processing does
not complete.

Required behavior:

- the committed `Storage` entry remains the source of truth for the outbound
  feed once persisted
- the runtime must be able to recover processing state by comparing the
  deterministic per-store `RemoteId` against `EventJournal.nextRemoteSequence`
  and replaying missing `Storage.entries(storeId, startSequence)` entries
- reconciliation should run at least on startup before serving traffic, and it
  may also run lazily before handling the next write or subscription for a store
- recovery must not duplicate already-processed entries in handlers or
  Reactivity

### 7. Handler execution semantics

Server-side handler execution should match the remote-consumption path already
implemented inside `EventLog`.

For each committed entry, regardless of whether it came from a client or from a
server-local write:

- locate the handler via the service key compiled from `EventLog.group(...)`
- decode the payload with the event schema
- decode conflict payloads with the same schema
- merge handler-required services into the effect environment
- execute the handler
- log handler failures the same way `EventLog` does, rather than failing the
  websocket protocol loop
- provide origin context sufficient to distinguish client-originated and
  server-originated writes

Implementation should extract or share the common decode / execute / invalidate
logic from `EventLog.ts` rather than copying it.

### 8. Reactivity semantics

Reactivity invalidation must behave the same as accepted remote writes in the
client-side `EventLog` runtime.

For each committed entry:

- look up registered Reactivity keys for `entry.event`
- invalidate `{ [key]: [entry.primaryKey] }` for each configured key
- perform invalidation after successful handler execution, matching current
  `EventLog` semantics

Because compaction is read-time only, Reactivity is based on accepted raw
entries, not compacted outbound projections.

## Outbound Compaction

### 1. When compaction runs

Compaction runs only while serving `RequestChanges(publicKey, startSequence)`.

- resolve `publicKey` to `StoreId`
- authorize the read
- subscribe to the store-scoped raw history
- compact the eligible historical portion for that store feed

### 2. Eligibility rule

For a compactor registered with `olderThan`, an entry is eligible when:

```ts
entry.createdAtMillis <= now - olderThan
```

If an entry is newer than the cutoff, it must be sent through unchanged even if
its event tag belongs to a compaction group.

### 3. Cursor semantics

`startSequence` means **the last sequence already seen by the client**.

Required behavior:

- raw storage lookups and live subscriptions must emit only entries with
  `remoteSequence > startSequence`
- the same rule applies after compaction, using the representative sequence of
  each emitted entry
- `startSequence = 0` means "start from the beginning"

### 4. Compaction grouping model

Use the same high-level grouping semantics as `EventLog.groupCompaction(...)`:

- only event tags registered by the compactor participate
- decode payloads with the event schemas from the `EventGroup`
- group candidate entries by `primaryKey`
- pass `{ primaryKey, entries, events, write(...) }` to the compaction effect
- `write(...)` encodes replacement entries back into `Entry`

Compaction operates over the store feed, so old entries produced by one
`publicKey` can be compacted together with old entries produced by another
`publicKey` if they share the same `StoreId`.

### 5. Sequence assignment for compacted outputs

Compaction happens on raw transport history that already has store-scoped
sequence numbers. Replacement entries sent to clients must preserve cursor
monotonicity.

Rules:

- each compacted output entry must be emitted as a `RemoteEntry`
- if one compaction bucket produces a single output entry, its
  `remoteSequence` must be the maximum raw sequence consumed by that bucket
- if one compaction bucket produces multiple output entries, the runtime must
  assign them strictly increasing representative sequences chosen from the raw
  sequence range consumed by that bucket, with the final output taking the
  bucket's maximum raw sequence
- the runtime must never emit multiple entries with the same representative
  sequence, because numeric cursors alone would make resume behavior ambiguous

### 6. Filtering relative to `startSequence`

The server must compact first, then apply the outbound sequence filter using the
representative `remoteSequence` of the emitted entries.

That means old raw entries below `startSequence` may still influence a compacted
replacement entry whose representative sequence is above the cursor.

### 7. Streaming behavior

`requestChanges(publicKey, startSequence)` should:

1. resolve the current `StoreId`
2. subscribe to raw storage changes for that store
3. read the initial backlog plus live updates
4. compact the eligible historical portion on each emission batch or on the
   initial backlog in a simpler first implementation
5. emit recent raw entries unchanged
6. preserve monotonic ordering by `remoteSequence`

## Authorization and Protocol Errors

### Write rejection

If store resolution or `authorizeWrite` fails:

- send `ErrorUnencrypted` with a write-correlated request id
- do not send `Ack`
- do not persist transport entries
- do not replay into the processing journal
- do not run handlers
- do not invalidate Reactivity

### Read rejection

If store resolution or `authorizeRead` fails:

- send `ErrorUnencrypted` describing the rejected `RequestChanges`
- do not create a subscription
- do not leak queue resources or live fiber registrations

### Internal failures

Internal operational failures should be mapped as follows:

- expected auth failures -> `ErrorUnencrypted`
- expected missing store mapping or unknown `StoreId` -> `ErrorUnencrypted`
- unexpected persistence failures / decode corruption / chunk reassembly
  corruption -> log and use the existing connection failure behavior unless an
  explicit protocol error can be sent safely

Recommended error-code mapping:

- `EventLogServerAuthError({ reason: "Unauthorized" })` -> `Unauthorized`
- `EventLogServerAuthError({ reason: "Forbidden" })` -> `Forbidden`
- `EventLogServerStoreError({ reason: "NotFound" })` -> `NotFound`
- request-shape or cursor validation failures -> `InvalidRequest`
- `EventLogServerStoreError({ reason: "PersistenceFailure" })` and unexpected
  operational failures -> `InternalServerError`

## Relationship to Persistence and SQL

`SqlEventLogJournal` is still a good fit for the processing journal because it
already supports:

- `writeFromRemote(...)`
- remote sequence tracking
- conflict-aware effect execution
- durable local journal persistence

This specification also introduces durable `publicKey -> StoreId` mapping as a
required part of the end-to-end design.

Acceptable implementation options:

- add a small persisted `StoreMapping` implementation backed by an existing
  persistence abstraction in the repository
- add a focused SQL-backed mapping implementation if that is the clearest path

Requirements regardless of backend:

- mapping durability must survive restart
- the `StoreMapping` contract must stay narrow enough for alternative backends
- the transport `Storage` contract must remain abstract enough that a future
  SQL-backed store history can be added without redesigning the runtime

## Testing Requirements

Add focused tests that follow existing repository patterns.

### Core server tests

Create `packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
covering at minimum:

1. **accepted writes run handlers**
   - compose a runtime from `EventLog.group(...)`
   - map the caller's `publicKey` to a store
   - write an unencrypted batch through the server handler or runtime ingest path
   - assert handler side effects ran

2. **accepted writes invalidate Reactivity**
   - register a Reactivity observer
   - ingest an event
   - assert invalidation happened for the configured key + primary key

3. **two public keys sharing one store see one sequence space**
   - map two different `publicKey`s to the same `StoreId`
   - ingest writes through both keys
   - assert `RequestChanges` from either key observes one combined ordered feed

4. **server-authored writes broadcast across shared store membership**
   - map two or more `publicKey`s to the same `StoreId`
   - call the runtime `write(...)` API once
   - assert subscribers for each mapped key receive the new event

5. **unauthorized write rejects the full batch**
   - `authorizeWrite` fails
   - assert `ErrorUnencrypted` is returned
   - assert no `Ack`
   - assert storage and handler state remain unchanged

6. **unauthorized read rejects subscription**
   - `authorizeRead` fails for `RequestChanges`
   - assert client receives `ErrorUnencrypted`
   - assert no live subscription remains

7. **missing store mapping rejects read and write**
   - omit a mapping for the target `publicKey`
   - assert explicit unencrypted protocol errors are returned
   - assert nothing is persisted or subscribed

8. **server-authored writes can be retried idempotently when `entryId` is supplied**
   - write the same server-authored event twice with the same explicit `entryId`
   - assert only one entry is committed to storage and handlers run once

9. **duplicate writes are idempotent within a store**
   - write the same entries twice through one key or two keys mapped to the same
     store
   - assert the second ack still has one sequence number per input
   - assert handlers / Reactivity only run once per unique entry id

10. **read-time compaction only affects old entries**
    - store an old history batch and a recent batch in the same store
    - assert only the old portion is compacted
    - assert recent entries pass through raw

11. **compacted outputs preserve cursor progression across shared store readers**
    - request from sequence `0` and from a later cursor through different keys
      mapped to the same store
    - assert representative output sequences are monotonic and compatible with
      follow-up requests

12. **recovery replays persisted-but-unprocessed entries exactly once**
    - simulate a failure after `Storage.write` succeeds but before journal replay
      is fully recorded
    - restart or trigger reconciliation
    - assert handlers and Reactivity catch up without duplicating work

13. **mapping reassignment only affects new subscriptions**
    - start a subscription for a `publicKey`
    - reassign that key to another store
    - assert the live subscription remains on the old store and a new
      subscription binds to the new store

### Store mapping tests

Add focused tests for the mapping implementation covering at minimum:

1. assigning then resolving a `publicKey`
2. multiple `publicKey`s resolving to the same `StoreId`
3. persistence across process or layer restart for the durable implementation
4. expected failure shape for unknown keys

### Remote client tests

Add or update tests around `EventLogRemote` to verify:

1. `fromSocketUnencrypted` uses the unencrypted codec path
2. `ErrorUnencrypted` fails pending writes with `EventLogRemoteError`
3. rejected read subscriptions surface an `EventLogRemoteError`
4. chunked unencrypted messages round-trip correctly

## Validation Expectations

Any implementation produced from this spec must run:

- `pnpm lint-fix`
- targeted tests, at minimum:
  - `pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
  - any updated `EventLog` / `EventLogRemote` / store-mapping tests
- `pnpm check:tsgo`
- `pnpm docgen`
- `pnpm codegen` if new module exports or barrel changes are introduced
- add a changeset for the unstable eventlog package changes

## Implementation Plan

The work should be broken into the following atomic, validation-safe tasks.
Tasks are grouped so each step can pass linting, tests, and type checking on
its own.

### Implementation status snapshot

- [x] Task 1: Finish unencrypted protocol plumbing in `EventLogRemote`
- [x] Task 2: Add store-scoped core types and transport storage
- [x] Task 3: Add store mapping services and implementations
- [x] Task 4: Build store-aware ingest and shared replay helpers
- [ ] Task 5: Add server-authored `write(..., storeId)` support
- [ ] Task 6: Add read-time compaction over store-scoped outbound feeds
- [ ] Task 7: Expose websocket / HTTP handlers and complete integration coverage

### Task 1 implementation notes

- Added explicit unencrypted protocol error frames on the client side via
  `EventLogRemote.ErrorUnencrypted`, including union encode/decode support.
- `fromSocketUnencrypted` now maps unencrypted `Error` frames to
  `EventLogRemoteError` for both pending writes and active change-subscription
  queues.
- Request-change failures now invalidate the failed subscription slot so a
  caller can re-issue `RequestChanges` for the same `publicKey` and receive a
  fresh queue.
- `EventLogRemote` queue / write signatures were widened to surface remote
  protocol failures (`Queue.Dequeue<RemoteEntry, EventLogRemoteError>` and
  `Effect<void, EventLogRemoteError>`).
- No misspelled unencrypted request encoder helper export was found in the
  current tree (`encodeRequestUnencrypted` was already correctly named).
- `pnpm check:tsgo` remains red due pre-existing unused imports in the
  unfinished `EventLogServerUnencrypted.ts` stub (outside the scope of this
  focused Task 1 change).

### Task 1: Finish unencrypted protocol plumbing in `EventLogRemote`

Scope:

- add `ErrorUnencrypted` to the protocol model
- finish the unencrypted encode / decode path in `fromSocketUnencrypted`
- correct any misspelled unencrypted request encoder exports
- plumb protocol errors into pending write handling and read-subscription
  handling
- update focused remote protocol tests

Why this task is grouped:

- protocol messages and client-side error handling must land together or the
  transport path remains broken
- it is independently shippable because it only completes unfinished unstable
  remote behavior

Validation for this task:

- `pnpm lint-fix`
- targeted `EventLogRemote` tests
- `pnpm check:tsgo`
- `pnpm docgen` if public docs are affected
- `pnpm codegen` if exports change

### Task 2: Add store-scoped core types and transport storage

### Task 2 implementation notes

- Implemented `StoreId` branding and `EventLogServerStoreError` in
  `EventLogServerUnencrypted.ts`, alongside `EventLogServerAuth` /
  `EventLogServerAuthError` signatures that now carry resolved `storeId`.
- Refactored unencrypted `Storage` to use store-scoped keys for
  `write(entries)`, `entries(startSequence)`, and `changes(startSequence)`.
- `makeStorageMemory` now keeps sequence numbers per store (starting at `1`),
  deduplicates by `entry.id` within the target store, and returns one ack
  sequence number for every submitted input entry.
- Verified cursor compatibility with `remoteSequence > startSequence` behavior
  for both backlog reads and live change queues.
- Tightened `changes(...)` handoff to avoid replay/live duplication by filtering
  live subscription items at the backlog snapshot cutover sequence.
- Added focused tests in
  `packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
  covering shared store sequence space and store-scoped duplicate semantics.

Follow-up task:

- add a deterministic race test for `changes(storeId, startSequence)` replay/live
  cutover so duplicate suppression is protected against future regressions.

Scope:

- define `StoreId` and `EventLogServerStoreError`
- update `Storage` to be keyed by `StoreId`
- update `makeStorageMemory` / `layerStorageMemory` to use store-scoped sequence
  assignment and duplicate handling
- update `EventLogServerAuth` signatures to receive `storeId`
- add storage-focused tests for shared sequence space and duplicate handling

Why this task is grouped:

- the shared sequence-space contract must land together with the auth signature
  adjustment that depends on `storeId`
- the task is independently shippable because it establishes the core data model
  without changing handler execution yet

Validation for this task:

- `pnpm lint-fix`
- storage-focused tests
- `pnpm check:tsgo`
- `pnpm docgen` if public docs are affected
- `pnpm codegen` if exports change

### Task 3: Add store mapping services and implementations

### Task 3 implementation notes

- Added `StoreMapping` service to
  `EventLogServerUnencrypted.ts` with explicit `resolve(publicKey)` and
  `assign({ publicKey, storeId })` upsert behavior.
- Added `makeStoreMappingMemory` and `layerStoreMappingMemory` for test and
  local-dev use.
- Added a durable adapter path via `makeStoreMappingPersisted` and
  `layerStoreMappingPersisted`, backed by
  `Persistence.BackingPersistence.make(storeId)`, so mappings survive service
  recreation / restart against the same backing store.
- Added targeted mapping coverage to
  `packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
  for:
  - assign + resolve behavior
  - many public keys sharing one store
  - reassignment semantics
  - `NotFound` error shape for unknown keys
  - persistence across mapping-service recreation using backing persistence
  - invalid persisted payload decode mapped to
    `EventLogServerStoreError({ reason: "PersistenceFailure" })`

Discovery / issue note:

- `Schema.decodeUnknown` is not available in the current codebase API; decoding
  for persisted mappings uses `Schema.decodeUnknownEffect`.

Follow-up task:

- add a deterministic test that injects backing-store read/write failures for
  `makeStoreMappingPersisted` (beyond decode failures) so
  `PersistenceFailure` mapping is covered for I/O-level errors too.

Scope:

- add `StoreMapping`, `makeStoreMappingMemory`, and `layerStoreMappingMemory`
- add one durable `StoreMapping` implementation or repository-native persisted
  adapter path that is exercised by tests
- define and test upsert provisioning semantics for `assign(...)`
- add tests for resolution, reassignment, and persistence across restart

Why this task is grouped:

- the mapping contract and its implementations are validation-safe once the core
  `StoreId` types already exist
- the durable mapping path must land together with tests so the persistence
  requirement is not left implicit

Validation for this task:

- `pnpm lint-fix`
- store-mapping tests
- `pnpm check:tsgo`
- `pnpm docgen` if public docs are affected
- `pnpm codegen` if exports change

### Task 4: Build store-aware ingest and shared replay helpers

### Task 4 implementation notes

- Added the `EventLogServerUnencrypted` runtime service skeleton with
  `ingest(...)`, `requestChanges(...)`, `registerCompaction(...)`, and
  `registerReactivity(...)` plus `layer(schema)` wiring.
- `ingest(...)` now performs the required store-aware pipeline:
  `StoreMapping.resolve(publicKey)` -> `EventLogServerAuth.authorizeWrite(...)`
  -> `Storage.write(storeId, entries)` -> replay of only `committed` entries to
  `EventJournal.writeFromRemote(...)`.
- Remote journal replay now uses a deterministic per-store `RemoteId` derived
  from `StoreId` using UUID v5 (stable namespace), reducing collision risk
  while ensuring one shared remote sequence namespace per store across multiple
  mapped `publicKey`s.
- Extracted shared replay logic from `EventLog` into
  `EventLog.makeReplayFromRemoteEffect(...)` and reused it from both client and
  server runtimes so handler execution + Reactivity invalidation stay aligned.
- Added focused ingest tests covering:
  - accepted ingest runs handlers
  - accepted ingest triggers Reactivity invalidation
  - two keys mapped to one store observe one combined feed with shared sequence
    space
  - two distinct stores replay independently even when each starts at sequence
    `1`

- Completed per-store reconciliation for persisted-but-unprocessed transport
  entries by comparing deterministic store `RemoteId` journal sequence state
  (`EventJournal.nextRemoteSequence`) against persisted transport history and
  replaying `Storage.entries(storeId, startSequence)` gaps before serving reads
  or accepting new writes for that store.
- Added an in-memory reconciliation cache (`reconciledStores`) so each runtime
  instance only reconciles a store once unless an ingest replay failure marks the
  store dirty again.
- Added focused reconciliation coverage proving backlog recovery replays
  committed entries after restart/failure and that subsequent reads do not
  duplicate handler execution or Reactivity invalidation work.
- Discovered and fixed an `EventJournal.makeMemory` idempotency issue where
  `writeFromRemote(...)` committed remote entries into the ordered journal but
  did not populate `byId`, allowing duplicate reprocessing across replays.
- Serialized server-side `EventJournal.writeFromRemote(...)` replay paths behind
  a runtime semaphore to avoid duplicate handler / Reactivity execution when
  multiple fibers concurrently trigger reconciliation or ingest replay for the
  same runtime instance.
- Extended reconciliation coverage to include a post-recovery runtime restart
  check so re-running reconciliation with persisted journal state remains
  idempotent (no duplicate handler execution or Reactivity invalidations).

Follow-up tasks:

- wire `registerCompaction(...)` into the store-scoped read path as part of
  Task 6 so compactors influence outbound feeds rather than being registration
  only
- align `EventJournal.nextRemoteSequence(...)` semantics across memory /
  indexeddb / SQL implementations ("last committed remote sequence" vs
  "next sequence") so reconciliation can derive start cursors without
  conservative replay windows

Scope:

- add the `EventLogServerUnencrypted` runtime service skeleton and `layer(...)`
- resolve `publicKey -> StoreId` before auth and storage access
- replay committed entries into `EventJournal.writeFromRemote(...)` using a
  deterministic `RemoteId` per store
- add reconciliation logic for persisted-but-unprocessed entries
- extract or share common handler execution / Reactivity helpers from
  `EventLog.ts`
- add `groupReactivity` for the server runtime
- add tests proving handlers and Reactivity fire exactly once per committed
  entry and that two keys mapped to one store see one combined feed

Why this task is grouped:

- ingest, replay, deterministic store remote identity, reconciliation, and
  shared handler execution all depend on the same runtime path
- splitting them would leave incomplete runtime semantics and failing tests

Validation for this task:

- `pnpm lint-fix`
- new server runtime ingest tests
- existing `EventLog` tests to ensure shared refactors do not regress client
  behavior
- `pnpm check:tsgo`
- `pnpm docgen` if public docs are affected
- `pnpm codegen` if exports change

### Task 5: Add server-authored `write(..., storeId)` support

Scope:

- add the runtime `write({ schema, storeId, event, payload, entryId? })` API
- route server-authored writes through the same encode / persist / replay path
  as ingest
- define behavior for unknown target stores
- ensure one server write is visible to all subscribers whose `publicKey`
  resolves to that store
- add tests for broadcast fan-out, explicit-id retries, and duplicate handling
  of server-authored entries

Why this task is grouped:

- the user-facing requirement is specifically about allowing the server to add
  its own events, and the API plus shared replay path must land together
- it is independently shippable once store-aware ingest already exists

Validation for this task:

- `pnpm lint-fix`
- targeted server-write tests
- `pnpm check:tsgo`
- `pnpm docgen` if public docs are affected
- `pnpm codegen` if exports change

### Task 6: Add read-time compaction over store-scoped outbound feeds

Scope:

- add server-side `groupCompaction(...)` with `olderThan`
- compact store-scoped historical backlog while keeping recent entries raw
- preserve strictly monotonic representative sequences for cursor compatibility
- ensure different keys mapped to the same store observe compatible compacted
  cursors
- add compaction tests

Why this task is grouped:

- helper registration, runtime projection logic, and cursor-preservation tests
  must land together to avoid broken feed semantics
- it is independently shippable once ingest and server-local writes already
  exist

Validation for this task:

- `pnpm lint-fix`
- server compaction tests
- any existing event-log compaction tests affected by shared helper extraction
- `pnpm check:tsgo`
- `pnpm docgen` if public docs are affected
- `pnpm codegen` if exports change

### Task 7: Expose websocket / HTTP handlers and complete integration coverage

Scope:

- implement `makeHandler` and `makeHandlerHttp`
- connect store resolution, auth, storage, runtime, chunk handling, ack/error
  responses, and change subscriptions
- add end-to-end websocket tests for authorized writes, missing mappings,
  unauthorized errors, server-authored broadcasts, and shared-store change
  subscriptions
- regenerate exports if necessary and add the required changeset

Why this task is grouped:

- the transport handlers are where all preceding contracts meet; partial
  integration would leave validation broken
- this task yields the complete user-facing module

Validation for this task:

- `pnpm lint-fix`
- end-to-end `EventLogServerUnencrypted` tests
- `pnpm check:tsgo`
- `pnpm docgen`
- `pnpm codegen` if needed

Every independently shippable task should also add or update a changeset if its
result is intended to land on its own.

## Open Follow-Ups

These are explicitly out of scope for the initial implementation but should be
kept in mind while designing the API:

- a SQL-backed transport storage implementation for unencrypted server history
- encrypted-path parity for explicit protocol errors and store-scoped broadcast
- admin tooling or higher-level workflows for provisioning store mappings in an
  application-specific way
- background snapshotting or server-driven compaction materialization for more
  aggressive backlog reduction
- dedicated `EventLog.registerRemote(...)` integration coverage for fallible
  remote change queues and rejection/recovery behavior
- resolving the placeholder `EventLogServerUnencrypted.ts` scaffold so
  `pnpm check:tsgo` is green again
