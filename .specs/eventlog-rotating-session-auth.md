# EventLog Rotating Session Identity Proof

## Summary

Add a session-scoped rotating challenge proof to `EventLogRemote` and `EventLogServerUnencrypted` so a client must prove continuity of possession of its identity secret, not just knowledge of the public key.

The protocol becomes a breaking change:

- `Hello` includes a fresh server challenge.
- the client must complete a dedicated `Authenticate` handshake once per socket session before normal reads or writes are allowed.
- the server stores the proof generated from the current session's challenge and requires the previously stored proof on the next session.
- proof failures introduced by this feature use `Forbidden`.
- there is no legacy public-key-only fallback.

This design deliberately follows the existing identity model in the repository: the so-called private key is currently a 32-byte symmetric secret, not an asymmetric signing key. Because the server does not know that secret, the proof is based on deterministic keyed challenge proofs and trust-on-first-use (TOFU) for the first session of a given public key.

## Scope clarification

This repository currently exposes:

- two client transport constructors:
  - `EventLogRemote.fromSocket`
  - `EventLogRemote.fromSocketUnencrypted`
- one server-side handler/runtime path:
  - `EventLogServerUnencrypted.make` / `EventLogServerUnencrypted.makeHandler`

For this change:

- the wire protocol additions must be shared across both client transport variants.
- concrete server-side enforcement lands in `EventLogServerUnencrypted.makeHandler` and the shared runtime created by `EventLogServerUnencrypted.make`.
- storage implementations, including SQL-backed storage, inherit the same runtime auth behavior automatically and must not reimplement protocol authentication separately.
- if a dedicated encrypted server handler is added later, it must reuse the same handshake semantics and protocol message shapes defined here.

## Background

Current behavior:

- `EventLogRemote.fromSocket` and `EventLogRemote.fromSocketUnencrypted` send the caller's `publicKey` on each request.
- `EventLogServerUnencrypted.makeHandler` accepts requests based on the `publicKey` in the message and delegates read / write authorization to `EventLogServerAuth`.
- there is no proof that the caller also possesses the matching secret key material.
- `EventLog.Identity.privateKey` is already a raw 32-byte secret used by `EventLogEncryption` as an AES key.

Relevant code today:

- `packages/effect/src/unstable/eventlog/EventLog.ts` defines `Identity`.
- `packages/effect/src/unstable/eventlog/EventLogEncryption.ts` shows the current symmetric-key model.
- `packages/effect/src/unstable/eventlog/EventLogRemote.ts` defines both encrypted and unencrypted wire protocols and client transports.
- `packages/effect/src/unstable/eventlog/EventLogServerUnencrypted.ts` defines the current server handler and authorization hooks.

## Goals

1. Require a session-level proof of identity beyond `publicKey`.
2. Apply the protocol/authentication design to both remote transport variants:
   - `EventLogRemote.fromSocket`
   - `EventLogRemote.fromSocketUnencrypted`
3. Enforce the handshake in `EventLogServerUnencrypted.makeHandler`.
4. Keep read/write authorization semantics separate from identity proof.
5. Reuse the existing symmetric identity secret instead of introducing a new asymmetric key system.
6. Rotate the proof material from a fresh server-issued challenge for each new socket session.
7. Keep first-session bootstrap intentionally TOFU, per user direction.
8. Use `Forbidden` for new proof-related failures.

## Non-goals

- Replacing the identity model with asymmetric signatures in this change.
- Preserving backward compatibility with legacy clients or servers.
- Changing store mapping rules or eventlog persistence semantics.
- Changing the public shape of `EventLogServerAuth.authorizeRead` / `authorizeWrite`.
- Adding proof fields to normal read/write requests after the session is authenticated.
- Solving distributed proof persistence across multiple server instances or durable client storage across application restarts.
- Cryptographically verifying the very first session for a previously unseen public key.

## User-confirmed decisions

- Scope: apply the design across both protocol variants.
- Compatibility: breaking change, no legacy fallback.
- Auth frequency: once per socket session.
- First auth attempt: the server does not verify it; it stores the first proof and begins the rotation cycle.
- Reads/writes: unchanged at the message level; proof is only for establishing identity.
- New proof failures: use `Forbidden`.

## Design overview

### Session model

Authentication becomes a separate handshake step that happens once per socket session:

1. server sends `Hello` with `remoteId` and a fresh `challenge`.
2. client computes a deterministic proof from that challenge and its identity secret.
3. client sends `Authenticate` before any application-level request.
4. server either:
   - bootstraps trust for a previously unseen public key by storing the proof, or
   - compares the caller's `previousProof` with the stored proof for that public key.
5. on success, server marks the socket session as authenticated for exactly one public key and stores the new proof for the next session.
6. after that, existing `WriteEntries` / `RequestChanges` flows continue unchanged.

A socket session is bound to one identity:

- once authenticated, every request on that socket must use the same `publicKey`.
- attempting to use a different `publicKey` on the same authenticated socket is `Forbidden`.
- if multiple first operations race on the same unauthenticated socket, the first identity that begins authentication binds the socket; concurrent or later operations for a different public key fail.

### Challenge-proof algorithm

Use a deterministic keyed proof derived from the existing secret key material:

- algorithm: `HMAC-SHA-256`
- HMAC key: raw bytes from `Redacted.value(identity.privateKey)`
- input: the raw `Hello.challenge` bytes
- output: 32-byte proof (`Uint8Array`)

Rationale:

- the repository's current identity model is symmetric, not asymmetric.
- the server cannot independently compute the proof because it does not know the secret.
- deterministic output is required because the server verifies the next session by exact proof comparison.
- `AES-GCM` is intentionally not used for this proof because its randomized IV makes the output unsuitable for stable equality comparison across sessions.

Implementation details:

- proof comparison on the server must use a constant-time byte loop.
- store and compare raw bytes, not encoded strings.
- cloned copies of proof arrays must be stored so later mutation of request buffers cannot affect server state.
- the server challenge should be 32 random bytes from `globalThis.crypto.getRandomValues`.

### Proof rotation semantics

For each public key, the server maintains the most recent accepted proof and one fallback proof for robustness:

- `currentProof`: the proof most recently stored for that public key.
- `fallbackProof`: the immediately previous proof, accepted for one extra session to reduce client/server desynchronization risk.

Rotation rules:

1. first successful bootstrap session for `publicKey`:
   - no stored proof exists
   - server does not verify `previousProof`
   - server stores `currentProof = Authenticate.currentProof`
   - `fallbackProof` remains empty
2. later sessions:
   - the client sends `previousProof` whenever it has one cached locally
   - server accepts it if it matches either stored `currentProof` or stored `fallbackProof`
   - on success, server rotates to:
     - new `fallbackProof = old currentProof`
     - new `currentProof = Authenticate.currentProof`
3. if stored proof state exists and neither stored proof matches `previousProof`, authentication fails with `Forbidden`.

This fallback window is intentionally limited to one prior proof. It improves recovery from lost auth acknowledgements or one-step client cache lag without permanently accepting stale proofs.

### Proof-state ownership and atomicity

Server proof state is shared across all sockets created from the same eventlog runtime.

Requirements:

- proof-state updates for a given public key must be atomic.
- concurrent bootstrap or rotation attempts for the same public key must not corrupt the stored proof chain.
- the implementation may use a single in-memory map plus a synchronization primitive, or a per-public-key synchronized structure, as long as reads and writes observe consistent state.

## Protocol changes

### `Hello`

Extend `Hello` with:

- `challenge: Schema.Uint8Array`

`Hello.remoteId` remains unchanged.

### New request: `Authenticate`

Add a new protocol request class shared by encrypted and unencrypted transports:

- `_tag: "Authenticate"`
- `publicKey: Schema.String`
- `currentProof: Schema.Uint8Array`
- `previousProof: Schema.optional(Schema.Uint8Array)`

Semantics:

- `currentProof` is the HMAC of the current session's `Hello.challenge`.
- `previousProof` is the proof last accepted for this public key, if the client has one.
- because the client cannot know whether the server already has proof state, the client should send `previousProof` whenever it has a cached value.
- when the server is bootstrapping a public key with no stored proof state, any provided `previousProof` is ignored.

### New response: `Authenticated`

Add a new protocol response class shared by encrypted and unencrypted transports:

- `_tag: "Authenticated"`
- `publicKey: Schema.String`

Semantics:

- emitted once the session has been authenticated successfully.
- indicates the socket is now bound to that public key for the rest of the session.

### Shared error response: `ProtocolError`

Introduce a shared protocol error response usable by both protocol variants:

- `_tag: "Error"`
- `requestTag: Schema.String`
- `id: Schema.optional(Schema.Number)`
- `publicKey: Schema.optional(Schema.String)`
- `code: Schema.Literals(["Unauthorized", "Forbidden", "NotFound", "InvalidRequest", "InternalServerError"])`
- `message: Schema.String`

Requirements:

- replace the unencrypted-only error shape with a shared response class used in both unions.
- `Authenticate` failures produced by this feature must use:
  - `requestTag: "Authenticate"`
  - `code: "Forbidden"`
- if an unauthenticated client sends `WriteEntries` / `RequestChanges` / `StopChanges` before completing auth, the server returns `Forbidden` for the attempted request tag.
- server-side error emission must explicitly support `Authenticate` and `StopChanges` in addition to the existing request tags.

### Union updates

Update both protocol unions in `EventLogRemote.ts`:

- `ProtocolRequest` includes `Authenticate`.
- `ProtocolRequestUnencrypted` includes `Authenticate`.
- `ProtocolResponse` includes `Authenticated` and `ProtocolError`.
- `ProtocolResponseUnencrypted` includes `Authenticated` and `ProtocolError`.

No proof fields are added to `WriteEntries`, `WriteEntriesUnencrypted`, or `RequestChanges`.

## Client behavior specification

### Shared client rules

Both remote transport constructors must implement the same session-auth model:

- keep per-socket session auth state separate from long-lived proof cache state.
- cache the last locally accepted proof by `remoteId + publicKey` for the lifetime of the remote instance.
- serialize auth attempts per socket.
- once auth begins for one public key, concurrent attempts using a different public key fail instead of piggybacking on the in-flight auth effect.

Receiving a new `Hello` must:

- update `remoteId`.
- replace the current session challenge.
- clear any per-socket authenticated identity marker.
- clear any in-flight auth state associated with the previous socket session.

After an auth failure with `Forbidden`:

- the current socket session is treated as terminal for identity-bound operations.
- the client does not auto-retry auth on that same socket.
- the cached local proof remains unchanged.

### `EventLogRemote.fromSocketUnencrypted`

Add session-auth state to the remote instance:

- `helloChallenge` from the latest `Hello`
- `authenticatedPublicKey` for the current socket session, initially empty
- per-remote proof cache keyed by `remoteId + publicKey` holding the last locally accepted proof
- a serialized in-flight auth effect so concurrent first operations do not send duplicate `Authenticate` requests

Required behavior:

1. receiving `Hello` stores `remoteId` and `challenge`.
2. the first `write(identity, entries)` or `changes(identity, startSequence)` on an unauthenticated session must:
   - compute `currentProof` from the `Hello.challenge`
   - load cached `previousProof` for (remoteId, identity.publicKey) if present
   - send `Authenticate` and wait for `Authenticated`
   - on success, cache `currentProof` as the latest local proof for (remoteId, publicKey) and bind the session to that `publicKey`
3. once authenticated, normal write/change requests proceed exactly as today.
4. if the caller uses a different `publicKey` after the session is authenticated, fail without silently switching identities.
5. auth failure must surface as `EventLogRemoteError` with `method: "authenticate"`.
6. a failed auth attempt must not replace the cached local proof.
7. `StopChanges` should only be sent for authenticated sessions that actually created a subscription.
8. the remote must decode `ProtocolError` and fail pending auth, write, or change operations appropriately.

### `EventLogRemote.fromSocket`

Apply the same session-auth flow as above before encrypted read/write traffic:

- same `Hello.challenge` handling
- same `Authenticate` request/`Authenticated` response flow
- same single-public-key-per-socket rule
- same local proof cache semantics
- same `ProtocolError` handling and `EventLogRemoteError` mapping for auth failures

This change must not alter the existing event payload encryption behavior.

### Concurrency and retry rules

- session auth must be serialized per socket.
- concurrent first write/read calls for the same identity wait on the same auth effect.
- concurrent first write/read calls for different identities on the same socket fail for the loser of the race.
- if auth fails with `Forbidden`, pending callers fail; the remote does not retry automatically.
- after a successful auth, reconnecting or recreating the socket starts a new auth session using the latest locally cached proof.

## Server behavior specification

### Runtime state

Add proof state to `EventLogServerUnencrypted.make` so it is shared across handler instances created from the same runtime:

- `Map<publicKey, { currentProof: Uint8Array; fallbackProof?: Uint8Array }>`

Add per-socket session state inside `makeHandler`:

- `sessionChallenge: Uint8Array` generated when the socket opens
- `authenticatedPublicKey: string | undefined`
- optional session marker that auth has completed

### Socket startup and reset

On each accepted socket:

1. generate a fresh random challenge.
2. send `Hello({ remoteId, challenge })`.
3. do not process application requests until the session authenticates.

If the underlying socket reconnects and a new `Hello` is emitted, that begins a new session and any previous authenticated identity binding no longer applies.

### `Authenticate` handling

Required behavior:

1. if the socket is already authenticated:
   - if `request.publicKey` matches the bound session public key, return `Authenticated` again without rotating anything.
   - otherwise return `Forbidden`.
2. if this is the first auth message on the socket:
   - look up stored proof state for `request.publicKey`.
3. if no proof state exists for that public key:
   - accept this as bootstrap / TOFU
   - ignore `previousProof` if it was provided
   - store a cloned copy of the new current proof from the request
   - mark the socket authenticated for `request.publicKey`
   - respond `Authenticated`
4. if proof state exists:
   - compare the provided `previousProof`, if any, against both stored `currentProof` and stored `fallbackProof`
   - if neither matches, return `Forbidden`
   - if it matches, rotate stored proofs to cloned copies of:
     - `fallbackProof = old currentProof`
     - `currentProof = request.currentProof`
   - mark the socket authenticated for `request.publicKey`
   - respond `Authenticated`

### Request gating and ordering

Before session auth completes:

- `Ping` remains allowed.
- `Authenticate` is allowed.
- `WriteEntries`, `RequestChanges`, and `StopChanges` must fail with `Forbidden`.
- if a chunked message resolves to one of those gated request tags, it must also fail with `Forbidden`.

After session auth completes, the handler must enforce this order for read/write requests:

1. verify the session is authenticated
2. verify the request `publicKey` matches the session-bound `authenticatedPublicKey`
3. only then resolve the store and call `authorizeRead` / `authorizeWrite`

This ordering ensures the new feature remains strictly an identity-proof gate and does not leak store-resolution or authorization behavior before identity has been established.

### Interaction with `EventLogServerAuth`

Keep the auth service focused on authorization:

- do not add proof fields to `authorizeWrite` or `authorizeRead`.
- run session-proof checks before invoking authorization.
- after a session is authenticated, authorization behavior is unchanged.
- existing authorization failures keep their current semantics; only the new proof handshake failures introduced here are mandated to use `Forbidden`.

## Behavioral edge cases

1. **First ever session for a public key**
   - succeeds without verification
   - stores the first proof
2. **Bootstrap request that includes a stale or spurious `previousProof`**
   - still succeeds when the server has no proof state for that public key
   - the provided `previousProof` is ignored
3. **Second session with matching previous proof**
   - succeeds
   - rotates the stored proof
4. **Second session without previous proof**
   - `Forbidden` when the server already has stored proof state
5. **Session with stale proof older than the single fallback window**
   - `Forbidden`
6. **Session authenticated as one public key but request uses another**
   - `Forbidden`
7. **Write/read attempted before auth**
   - `Forbidden`
8. **Unauthenticated `StopChanges`**
   - `Forbidden`
9. **Auth ack lost but client still only has the previous local proof**
   - next session still succeeds once because the server accepts the single fallback proof
10. **Server restart or new runtime instance**
   - stored proof map resets
   - the next session for any public key bootstraps again
11. **Client-side proof cache loss while the server still retains a newer proof**
   - auth fails with `Forbidden` after the one-proof fallback window
   - durable client proof persistence is out of scope for this change

## Acceptance criteria

The feature is complete when:

1. `Hello` includes a challenge in both protocol variants.
2. a new `Authenticate` / `Authenticated` handshake exists in both protocol variants.
3. a shared `ProtocolError` response exists in both protocol variants.
4. `EventLogRemote.fromSocket` authenticates once per socket session before encrypted requests and handles auth failures through `ProtocolError`.
5. `EventLogRemote.fromSocketUnencrypted` authenticates once per socket session before unencrypted requests and handles auth failures through `ProtocolError`.
6. `EventLogServerUnencrypted.makeHandler` forbids reads/writes before auth.
7. the first session for a public key bootstraps by storing proof without verification.
8. bootstrap ignores any provided `previousProof` when no server-side proof state exists.
9. the next session for the same public key must supply a previous proof acceptable under the current/fallback rotation rule and a new current proof.
10. the server rotates stored proofs and accepts the immediately previous proof as a one-step fallback.
11. a socket session is bound to a single public key.
12. proof-state updates per public key are atomic.
13. read/write authorization remains separate from session identity proof.
14. proof-related failures introduced by this feature use `Forbidden`.
15. existing request payload schemas for writes/reads are otherwise unchanged.

## Testing strategy

### Existing test files to extend

- `packages/effect/test/unstable/eventlog/EventLogRemote.test.ts`
- `packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`

### Required new test coverage

#### Remote client tests

1. `Hello` decoding captures the challenge.
2. first `write` on an unauthenticated unencrypted socket sends `Authenticate` before `WriteEntries`.
3. first `changes` on an unauthenticated unencrypted socket sends `Authenticate` before `RequestChanges`.
4. encrypted `fromSocket` performs the same handshake before `WriteEntries` / `RequestChanges`.
5. concurrent first operations for the same identity share one auth handshake.
6. concurrent first operations for different identities on the same socket do not both succeed.
7. auth `Forbidden` surfaces as `EventLogRemoteError` with `method: "authenticate"`.
8. once authenticated, subsequent operations on the same socket do not send another `Authenticate`.
9. a failed auth does not update the local proof cache.
10. receiving a new `Hello` resets per-session auth state.
11. encrypted `fromSocket` also handles `ProtocolError` auth failures.

#### Server handler tests

1. `Hello` includes a challenge.
2. non-auth requests sent before `Authenticate` receive `Forbidden`.
3. unauthenticated `StopChanges` receives `Forbidden`.
4. first-session `Authenticate` bootstraps proof state and allows later requests on that socket.
5. bootstrap ignores a provided `previousProof` when no proof state exists.
6. second session for the same public key requires a matching `previousProof`.
7. missing or mismatched `previousProof` is `Forbidden`.
8. successful re-auth rotates the stored proof.
9. the immediate prior proof is accepted once as fallback.
10. a socket authenticated for one public key rejects read/write requests using another public key.
11. `authorizeWrite` / `authorizeRead` are not called before session auth succeeds.
12. once session auth succeeds, existing read/write authorization behavior still works.
13. concurrent proof-state updates for the same public key do not corrupt rotation state.

### Test helper guidance

- follow the existing socket harness style already used in both eventlog test files.
- add a small deterministic helper for producing test proofs from a known identity and challenge.
- keep tests in the `it.effect` style used by this repository.

## Implementation plan

1. **Implement the end-to-end rotating session auth protocol in one atomic change**
   - add `Hello.challenge`, `Authenticate`, `Authenticated`, and shared `ProtocolError` protocol types and codec updates
   - add the shared deterministic HMAC proof helper and proof-comparison utilities
   - update both `EventLogRemote.fromSocket` and `EventLogRemote.fromSocketUnencrypted` to perform session authentication, bind one public key per socket, cache local proofs, and surface auth failures
   - update `EventLogServerUnencrypted.make` / `makeHandler` to maintain shared proof state, gate unauthenticated requests, enforce identity binding, and rotate proofs atomically
   - update/add the affected tests in `EventLogRemote.test.ts` and `EventLogServerUnencrypted.test.ts` so the new wire protocol passes end-to-end

2. **Run validation and cleanup**
   - run `pnpm lint-fix`
   - run `pnpm test packages/effect/test/unstable/eventlog/EventLogRemote.test.ts`
   - run `pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
   - run `pnpm check:tsgo`
   - run `pnpm docgen`
   - update any affected protocol documentation or inline comments discovered during implementation

## Validation checklist for implementation

- `pnpm lint-fix`
- `pnpm test packages/effect/test/unstable/eventlog/EventLogRemote.test.ts`
- `pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
- `pnpm check:tsgo`
- `pnpm docgen`
