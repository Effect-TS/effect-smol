# EventLogServerUnencrypted

## Overview

Add a fully functional new event log server module at
`packages/effect/src/unstable/eventlog/EventLogServerUnencrypted.ts` that
accepts unencrypted event batches over the existing EventLogRemote websocket
protocol, authorizes them through a new required auth service, persists them in
per-public-key sequence order, runs backend event handlers, triggers Reactivity
invalidations just like the client-side EventLog runtime, and serves outbound
change feeds that can be compacted on read for entries older than a configured
age threshold.

This feature is intentionally **read-time compaction, not ingest-time
compaction**:

- all accepted inbound events are stored and processed immediately
- handlers and reactivity run for all newly accepted inbound events
- compaction only affects what the server sends back to clients from
  `RequestChanges`, and only for entries older than a configurable fixed
  duration

The design should reuse existing EventLog patterns as much as possible:

- `EventLog.group(...)` remains the handler authoring API
- the grouping / payload decoding behavior from `EventLog.groupCompaction(...)`
  should be reused or factored into shared internal helpers
- Reactivity invalidation semantics should match `EventLog`
- `SqlEventLogJournal` remains the preferred journal implementation for the
  server-side processing journal when persistence is needed, but adding a
  dedicated SQL transport-storage adapter is **not** required for this change

## User Decisions Captured

The specification reflects the following clarified requirements:

1. authorization is handled by a new required `EventLogServerAuth` service
2. backend handlers should reuse `EventLog.group(...)`
3. compaction applies only to events older than a configurable fixed duration
4. unauthorized writes reject the whole batch
5. `Ack.sequenceNumbers` must use **option A**: one sequence per originally
   submitted event
6. server reactivity invalidation must run for **all accepted incoming events**;
   compaction does not suppress invalidation because compaction only happens on
   outbound reads
7. unencrypted protocol responses need an explicit error message type
8. outbound compaction applies to the feed returned from
   `RequestChanges(startSequence)`

## Goals

- Make `EventLogServerUnencrypted` feature-complete enough to back a real
  backend event-log endpoint.
- Allow the backend to execute the same event handlers authored with
  `EventLog.group(...)` that are already used by clients.
- Ensure accepted remote writes trigger the same Reactivity invalidation pattern
  used by `EventLog`.
- Allow the backend to reject unauthorized public keys before persisting or
  processing a batch.
- Support compacted catch-up feeds for older history while preserving sequence
  cursor compatibility with existing clients.
- Finish the already-started unencrypted protocol support in `EventLogRemote`.

## Non-Goals

- Adding encrypted-protocol error frames in the same change. The explicit error
  response is only required for the unencrypted protocol in this scope.
- Mutating or deleting stored raw events as part of compaction. Compaction is a
  read-time projection.
- Adding a dedicated `SqlEventLogServerUnencrypted` module in the same PR,
  unless it falls out naturally and does not materially expand scope.
- Replacing `EventLog.group(...)` with a new handler DSL.
- Solving client-side garbage collection of already-synced historical raw events
  when a later catch-up response is compacted. The feature only guarantees a
  compacted feed for the requested cursor onward.

## Module Surface

### Primary module

- `packages/effect/src/unstable/eventlog/EventLogServerUnencrypted.ts`

### Existing modules that must change

- `packages/effect/src/unstable/eventlog/EventLogRemote.ts`
- `packages/effect/src/unstable/eventlog/EventLog.ts` (internal refactors /
  shared helpers only, unless a small public adjustment is the cleanest option)
- optionally `packages/effect/src/unstable/eventlog/EventJournal.ts` only if a
  small helper type is needed; avoid unnecessary public API churn

### Tests

- `packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
- update/add targeted tests around `EventLogRemote.ts` if needed
- optionally add integration coverage under sqlite-backed packages only if the
  implementation explicitly depends on SQL behavior

## Public API

### 1. `EventLogServerAuth`

Add a new required service to the unencrypted server module.

```ts
export class EventLogServerAuth extends ServiceMap.Service<EventLogServerAuth, {
  readonly authorizeWrite: (options: {
    readonly publicKey: string
    readonly entries: ReadonlyArray<Entry>
  }) => Effect.Effect<void, EventLogServerAuthError>
  readonly authorizeRead: (publicKey: string) => Effect.Effect<void, EventLogServerAuthError>
}>()("effect/eventlog/EventLogServerUnencrypted/EventLogServerAuth") {}
```

#### Semantics

- `authorizeWrite` is called once per inbound `WriteEntriesUnencrypted` request
  before any persistence, handler execution, or reactivity invalidation
- authorization is **batch-wide**: if it fails, the entire write request is
  rejected
- `authorizeRead` is called before creating a `RequestChanges` subscription
- a helper layer such as `layerAuthAllowAll` is recommended for tests and local
  development, but the service itself must remain required by the main server
  constructor APIs

### 2. `EventLogServerAuthError`

Add a tagged error type for auth rejections.

```ts
export class EventLogServerAuthError extends Data.TaggedError("EventLogServerAuthError")<{
  readonly reason: "Unauthorized" | "Forbidden"
  readonly publicKey: string
  readonly message?: string | undefined
}> {}
```

Exact fields may vary, but the type must be structured enough to map to an
unencrypted protocol error frame.

### 3. `EventLogServerUnencrypted` runtime service

Add a server runtime service, parallel to the client-side `EventLog` runtime,
responsible for:

- registering outbound compactors
- registering reactivity mappings
- processing accepted inbound entries through the server journal + handlers
- exposing enough internal behavior for `makeHandler` and `makeHandlerHttp`

Suggested shape:

```ts
export class EventLogServerUnencrypted extends ServiceMap.Service<EventLogServerUnencrypted, {
  readonly ingest: (options: {
    readonly publicKey: string
    readonly entries: ReadonlyArray<Entry>
  }) => Effect.Effect<{
    readonly sequenceNumbers: ReadonlyArray<number>
    readonly committed: ReadonlyArray<RemoteEntry>
  }, EventLogServerAuthError | EventJournal.EventJournalError>
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

The exact public service surface can be smaller if some methods stay internal,
but the runtime must exist so that compaction + reactivity registration work in
the same compositional style as `EventLog`.

### 4. `layer`

Add a layer constructor, parallel to `EventLog.layer(...)`, for building the
server runtime from handler layers and a processing journal.

```ts
export const layer: <Groups extends EventGroup.Any>(
  schema: EventLog.EventLogSchema<Groups>
) => Layer.Layer<
  EventLogServerUnencrypted,
  never,
  EventGroup.ToService<Groups> | EventJournal.EventJournal
>
```

#### Notes

- handlers are still authored with `EventLog.group(...)`
- the server runtime should read those handler registrations from the produced
  service map exactly like `EventLog` does
- this keeps domain handler code portable between client and server runtimes

### 5. `groupCompaction`

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
) => Layer.Layer<never, never, EventLogServerUnencrypted | R | Event.PayloadSchema<Events>["DecodingServices"]>
```

#### Behavior

- only entries with `entry.createdAtMillis <= now - olderThan` are eligible
- compaction affects only outbound `RequestChanges` responses
- the payload decoding / grouping by primary key semantics should match the
  existing `EventLog.groupCompaction(...)`
- implementation should reuse shared helper logic instead of duplicating the
  full decoder / grouping pipeline if possible

### 6. `groupReactivity`

Add a server-local helper mirroring `EventLog.groupReactivity(...)` so a server
runtime can register per-event invalidation keys without depending on the
client-side `EventLog` service.

### 7. `makeHandler` and `makeHandlerHttp`

Add websocket / HTTP upgrade handlers parallel to `EventLogServer.makeHandler`
and `makeHandlerHttp`.

```ts
export const makeHandler: Effect.Effect<
  (socket: Socket.Socket) => Effect.Effect<void, Socket.SocketError>,
  never,
  EventLogServerUnencrypted | Storage | EventLogServerAuth
>

export const makeHandlerHttp: Effect.Effect<
  Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    HttpServerError.HttpServerError | Socket.SocketError,
    HttpServerRequest.HttpServerRequest | Scope.Scope
  >,
  never,
  EventLogServerUnencrypted | Storage | EventLogServerAuth
>
```

### 8. `Storage`

Add a transport-storage service for per-public-key ordered outbound history.
This is distinct from the processing journal used to execute handlers.

```ts
export class Storage extends ServiceMap.Service<Storage, {
  readonly getId: Effect.Effect<RemoteId>
  readonly write: (
    publicKey: string,
    entries: ReadonlyArray<Entry>
  ) => Effect.Effect<{
    readonly sequenceNumbers: ReadonlyArray<number>
    readonly committed: ReadonlyArray<RemoteEntry>
  }>
  readonly entries: (
    publicKey: string,
    startSequence: number
  ) => Effect.Effect<ReadonlyArray<RemoteEntry>>
  readonly changes: (
    publicKey: string,
    startSequence: number
  ) => Effect.Effect<Queue.Dequeue<RemoteEntry, Cause.Done>, never, Scope.Scope>
}>()("effect/eventlog/EventLogServerUnencrypted/Storage") {}
```

#### Storage semantics

- sequences are monotonically increasing per `publicKey`
- new sequence numbers should begin at `1` for a new `publicKey`
- `write` returns **one sequence number per submitted input entry**
- if an entry is a duplicate by `entry.id`, `write` returns the already-known
  sequence number for that slot and excludes it from `committed`
- only `committed` entries are eligible for server-side handler execution and
  reactivity invalidation

### 9. `makeStorageMemory` / `layerStorageMemory`

Add an in-memory storage implementation parallel to the encrypted server module.
This is required for tests and for a complete initial runtime.

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
  code: Schema.Literal("Unauthorized", "InvalidRequest", "InternalServerError"),
  message: Schema.String
}) {}
```

The exact schema can differ, but it must support:

- correlating write failures to a pending `WriteEntries` request id
- indicating read-subscription failures for `RequestChanges`
- communicating auth failures in a machine-readable form

Update:

- `ProtocolResponseUnencrypted`
- `ProtocolResponseUnencryptedMsgpack`
- `decodeResponseUnencrypted`
- `encodeResponseUnencrypted`

### Codec correctness

Complete the unfinished unencrypted protocol path in `EventLogRemote.ts`:

- `fromSocketUnencrypted` must use the unencrypted request encoder and response
  decoder consistently
- the misspelled `encodeRequestUnsencrypted` helper should be corrected to
  `encodeRequestUnencrypted`
- if the typo is already exported, keep a temporary backwards-compatible alias
  or deprecate it in-place rather than silently breaking consumers

### Error surfacing

Because the server now sends explicit unencrypted protocol errors, the remote
client API must surface them.

#### Required behavior

- a write rejection for a pending request must fail the corresponding
  `remote.write(...)` effect with `EventLogRemoteError`
- a rejected `RequestChanges` subscription must fail the returned dequeue, or an
  equivalent fallible subscription mechanism, with `EventLogRemoteError`
- downstream `EventLog.registerRemote(...)` consumption must handle those
  failures by logging and continuing its normal reconnection / retry behavior

#### Acceptable API adjustment

Since these APIs are unstable, it is acceptable to widen the public error types
if needed, for example:

```ts
readonly write: (...) => Effect.Effect<void, EventLogRemoteError>
readonly changes: (...) => Effect.Effect<Queue.Dequeue<RemoteEntry, EventLogRemoteError>, never, Scope.Scope>
```

If the same widened signature is applied to encrypted remotes for consistency,
that is acceptable even if the encrypted path does not currently emit the new
error frame.

## Runtime Architecture

### 1. Separate transport history from processing journal

The server has two distinct responsibilities:

1. maintain a per-public-key transport feed used by `RequestChanges`
2. run handlers / conflicts / reactivity against a backend processing journal

Use the new unencrypted `Storage` service for (1), and the existing
`EventJournal` service for (2).

This keeps the design aligned with existing abstractions:

- `SqlEventLogJournal` is immediately usable as the server processing journal
- transport compaction remains a read-time projection over per-public-key
  history instead of mutating the journal

### 2. Stable journal origin per public key

Accepted writes must be replayed into the processing journal via
`journal.writeFromRemote(...)`. That requires a stable `RemoteId`.

The runtime should derive a deterministic `RemoteId` from `publicKey` so the
same key maps to the same remote origin across process restarts.

Recommended approach:

- compute a stable 16-byte digest from the UTF-8 encoded `publicKey`
- brand the first 16 bytes as `RemoteId`
- keep this derivation internal to the server runtime

This avoids introducing extra persistence just to map public keys to journal
remote ids.

### 3. Ingest pipeline

For each `WriteEntriesUnencrypted` request:

1. decode request
2. authorize the entire batch via `EventLogServerAuth.authorizeWrite`
3. if auth fails, send `ErrorUnencrypted` and do not persist anything
4. persist raw entries into transport `Storage.write`
5. send `Ack` with `sequenceNumbers.length === request.entries.length`
6. replay only `committed` entries into `EventJournal.writeFromRemote(...)`
7. during replay, run backend handlers and reactivity invalidation exactly once
   per committed entry
8. do not compact during ingest

#### Duplicate handling

If the same entry id is written again for the same public key:

- `Ack.sequenceNumbers` still includes a sequence for that slot
- the duplicate entry is not re-committed to storage
- the duplicate entry is not re-run through handlers
- the duplicate entry does not re-trigger reactivity invalidation

### 4. Handler execution semantics

Server-side handler execution should match the remote-consumption path already
implemented inside `EventLog`.

For each committed inbound entry:

- locate the handler via the service key compiled from `EventLog.group(...)`
- decode the payload with the event schema
- decode conflict payloads with the same schema
- merge handler-required services into the effect environment
- execute the handler
- log handler failures the same way `EventLog` does, rather than failing the
  websocket protocol loop

Implementation should extract or share the common decode / execute / invalidate
logic from `EventLog.ts` rather than copying it into two places.

### 5. Reactivity semantics

Reactivity invalidation must behave the same as accepted remote writes in the
client-side `EventLog` runtime.

For each committed inbound entry:

- look up registered reactivity keys for `entry.event`
- invalidate `{
    [key]: [entry.primaryKey]
  }`
  for each configured key
- perform invalidation after successful handler execution, matching current
  `EventLog` semantics

Because compaction is read-time only, reactivity is based on the accepted raw
inbound entries, not on compacted outbound projections.

## Outbound Compaction

### 1. When compaction runs

Compaction runs only while serving `RequestChanges(publicKey, startSequence)`.

- recent entries remain unmodified in the outbound stream
- only entries older than the configured threshold are eligible
- authorization happens before the subscription is created

### 2. Eligibility rule

For a compactor registered with `olderThan`, an entry is eligible when:

```ts
entry.createdAtMillis <= now - olderThan
```

If an entry is newer than the cutoff, it must be sent through unchanged even if
its event tag belongs to a compaction group.

### 3. Compaction grouping model

Use the same high-level grouping semantics as `EventLog.groupCompaction(...)`:

- only event tags registered by the compactor participate
- decode payloads with the event schemas from the `EventGroup`
- group the candidate entries by `primaryKey`
- pass `{ primaryKey, entries, events, write(...) }` to the compaction effect
- `write(...)` encodes replacement entries back into `Entry`

For implementation, it is acceptable and encouraged to extract shared internal
helpers from `EventLog.groupCompaction(...)` so both runtimes use the same
payload-decoding and replacement-entry construction logic.

### 4. Sequence assignment for compacted outputs

Compaction happens on raw transport history that already has `remoteSequence`
values. Replacement entries sent to clients must preserve cursor monotonicity.

Rule:

- each compacted output entry must be emitted as a `RemoteEntry`
- its `remoteSequence` must be the **maximum** raw sequence consumed for that
  output entry's source bucket
- when a single primary-key bucket produces multiple replacement entries, each
  emitted replacement entry may share that maximum sequence

This ensures clients can continue to use `startSequence = lastKnownSequence`
semantics without needing the missing intermediate raw sequences.

### 5. Filtering relative to `startSequence`

The server must compact first, then apply the outbound sequence filter using the
representative `remoteSequence` of the emitted entries.

That means:

- old raw entries below `startSequence` may still influence a compacted
  replacement entry whose representative sequence is at or above the cursor
- this is required so behind clients can receive a reduced representation of old
  history rather than the full raw backlog

### 6. Streaming behavior

`requestChanges(publicKey, startSequence)` should:

1. subscribe to raw storage changes for that public key
2. read the initial backlog plus live updates
3. compact the eligible historical portion on each emission batch
4. emit recent raw entries unchanged
5. preserve monotonic ordering by `remoteSequence`

A simple and acceptable first implementation may compact the initial backlog and
then pass through live updates unchanged until they age past the threshold on a
future subscription. That matches the requirement without introducing background
reprojection state.

## Authorization and Protocol Errors

### Write rejection

If `authorizeWrite` fails:

- send `ErrorUnencrypted` with a write-correlated request id
- do not send `Ack`
- do not persist transport entries
- do not replay into the processing journal
- do not run handlers
- do not invalidate reactivity

### Read rejection

If `authorizeRead` fails:

- send `ErrorUnencrypted` describing the rejected `RequestChanges`
- do not create a subscription
- do not leak queue resources or a live FiberMap registration

### Internal failures

Internal operational failures should be mapped as follows:

- expected auth failures -> `ErrorUnencrypted`
- expected request validation failures in the unencrypted path ->
  `ErrorUnencrypted`
- unexpected defects / decode corruption / chunk reassembly corruption -> log and
  use the existing connection failure behavior unless an explicit protocol error
  can be sent safely

## Relationship to `SqlEventLogJournal`

`SqlEventLogJournal` is a good fit for the **processing journal** side of this
feature because it already supports:

- `writeFromRemote(...)`
- remote sequence tracking
- conflict-aware effect execution
- local journal persistence

This specification does **not** require `SqlEventLogJournal` to also become the
transport history store used by outbound `RequestChanges`.

Reason:

- transport history is keyed by client `publicKey`
- read-time compaction needs direct access to each public key's outbound stream
- keeping the transport feed as a dedicated server storage abstraction keeps the
  protocol-serving path simpler and mirrors the existing encrypted server module

However, implementation should keep the storage contract narrow enough that a
future SQL-backed transport store can be added without refactoring the runtime.

## Testing Requirements

Add focused tests that follow existing repository patterns.

### Core server tests

Create `packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
covering at minimum:

1. **accepted writes run handlers**
   - compose a runtime from `EventLog.group(...)`
   - write an unencrypted batch through the server handler or runtime ingest path
   - assert handler side effects ran

2. **accepted writes invalidate Reactivity**
   - register a Reactivity observer
   - ingest an event
   - assert invalidation happened for the configured key + primary key

3. **unauthorized write rejects the full batch**
   - `authorizeWrite` fails
   - assert `ErrorUnencrypted` is returned
   - assert no `Ack`
   - assert storage and handler state remain unchanged

4. **unauthorized read rejects subscription**
   - `authorizeRead` fails for `RequestChanges`
   - assert client receives `ErrorUnencrypted`
   - assert no live subscription remains

5. **duplicate writes are idempotent but still ack every input slot**
   - write the same entries twice
   - assert second ack has the same number of sequence numbers as inputs
   - assert handlers/reactivity only run once per unique entry id

6. **read-time compaction only affects old entries**
   - store an old history batch and a recent batch
   - assert only the old portion is compacted
   - assert recent entries pass through raw

7. **compacted outputs preserve cursor progression**
   - request from sequence `0` and from a later cursor
   - assert representative output sequences are monotonic and compatible with
     follow-up requests

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
  - any updated `EventLog` / `EventLogRemote` / SQL event log tests
- `pnpm check:tsgo`
- `pnpm docgen`
- `pnpm codegen` if new module exports or barrel changes are introduced
- add a changeset for the unstable eventlog package changes

## Implementation Plan

The work should be broken into the following atomic, validation-safe tasks.
Tasks are intentionally grouped so each step can pass linting, tests, and type
checking on its own.

### Task 1: Finish unencrypted protocol plumbing in `EventLogRemote`

Scope:

- add `ErrorUnencrypted` to the protocol model
- fix unencrypted encode/decode usage in `fromSocketUnencrypted`
- correct the misspelled unencrypted request encoder export
- plumb protocol errors into pending write handling and read-subscription
  handling
- adjust `EventLogRemote` public error types if required
- update/add focused remote protocol tests

Why this task is grouped:

- protocol message additions and client-side handling must land together or the
  code will not typecheck and tests will fail
- this task is independently shippable because it only completes the unfinished
  unencrypted client transport behavior

Validation for this task:

- targeted `EventLogRemote` tests
- any affected `EventLog` tests if public remote signatures widen

### Task 2: Add auth + transport storage foundations for the unencrypted server

Scope:

- define `EventLogServerAuth` and `EventLogServerAuthError`
- define `Storage`, `makeStorageMemory`, and `layerStorageMemory`
- implement per-public-key sequence assignment and duplicate-aware write results
  with one ack sequence per input entry
- add focused storage / auth unit tests

Why this task is grouped:

- the server runtime cannot be type-safe or testable until auth and storage
  contracts are settled together
- duplicate-aware ack semantics are part of the storage contract, so splitting
  them would create failing intermediate states

Validation for this task:

- new storage/auth tests
- any compile checks for public API additions

### Task 3: Build the server runtime and handler/reactivity integration

Scope:

- add `EventLogServerUnencrypted` runtime service and `layer(...)`
- wire accepted writes through the processing journal using deterministic
  publicKey-derived remote ids
- reuse `EventLog.group(...)`-compiled handlers
- extract or share common handler execution / reactivity helpers from
  `EventLog.ts`
- add `groupReactivity` for the server runtime
- add tests proving handlers and reactivity fire exactly once per committed
  entry

Why this task is grouped:

- handler execution, deterministic remote identity, and reactivity invalidation
  all depend on the same ingest path
- splitting them would produce partial runtime behavior that either fails tests
  or invalidates the core requirement

Validation for this task:

- new server runtime tests
- existing `EventLog` tests to ensure shared refactors do not regress client
  behavior

### Task 4: Add read-time outbound compaction to the server runtime

Scope:

- add server-side `groupCompaction(...)` with `olderThan`
- implement compaction of outbound initial backlog / eligible batches
- preserve representative remote sequences for cursor compatibility
- add tests for old-vs-recent eligibility and cursor progression

Why this task is grouped:

- helper registration, runtime projection logic, and cursor-preservation tests
  must land together to avoid broken feed semantics
- it is independently shippable once runtime ingest already exists

Validation for this task:

- server compaction tests
- existing event log compaction tests, if any shared helper extraction affects
  client behavior

### Task 5: Expose websocket / HTTP handlers and complete integration coverage

Scope:

- implement `makeHandler` and `makeHandlerHttp`
- connect auth, storage, runtime, chunk handling, ack/error responses, and
  change subscriptions
- add end-to-end websocket-level tests for authorized writes, unauthorized
  errors, and change subscriptions
- regenerate exports if necessary and add the required changeset

Why this task is grouped:

- the transport handlers are the first point where all preceding contracts meet;
  partial integration would leave validation broken
- this task yields the complete user-facing module

Validation for this task:

- end-to-end `EventLogServerUnencrypted` tests
- `pnpm lint-fix`
- `pnpm check:tsgo`
- `pnpm docgen`
- `pnpm codegen` if needed

## Open Follow-Ups

These are explicitly out of scope for the initial implementation but should be
kept in mind while designing the API:

- a SQL-backed transport storage implementation for unencrypted server history
- optional success acknowledgements for `RequestChanges` subscriptions
- extending explicit protocol error frames to the encrypted server path
- server-driven compaction snapshots or tombstones for more aggressive client
  backlog reduction
