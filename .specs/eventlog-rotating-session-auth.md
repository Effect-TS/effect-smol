# EventLog Asymmetric Session Challenge Authentication

## Summary

Define a breaking asymmetric session-auth handshake for EventLogRemote and EventLogServerUnencrypted with a single authentication path.

Protocol behavior:

- Hello includes a fresh server challenge.
- the client must complete Authenticate once per socket session before reads or writes are allowed.
- Authenticate carries a signing public key and an Ed25519 signature over a canonical session payload.
- the server verifies the signature and requires a pre-provisioned publicKey -> signingPublicKey binding.
- handshake failures introduced here use Forbidden.
- there is no legacy public-key-only fallback.
- there is no first-seen auto-registration path.

## Security baseline

The baseline is strict and uniform:

- authentication requires a valid Ed25519 challenge signature plus a pre-provisioned key binding.
- unknown publicKey bindings are always rejected.
- key-binding state is persistent and managed outside Authenticate flow.
- challenge values are single-use and short-lived.
- production deployments must use encrypted transport.
- unencrypted transport is only for explicitly enabled local/test environments.

## Scope clarification

This repository currently exposes:

- two client transport constructors:
  - EventLogRemote.fromSocket
  - EventLogRemote.fromSocketUnencrypted
- one server-side handler/runtime path:
  - EventLogServerUnencrypted.make / EventLogServerUnencrypted.makeHandler

For this feature:

- wire protocol additions are shared across both client transport variants.
- concrete server-side enforcement lands in EventLogServerUnencrypted.makeHandler and the shared runtime created by EventLogServerUnencrypted.make.
- storage implementations, including SQL-backed storage, inherit runtime auth behavior and do not reimplement protocol authentication.
- if a dedicated encrypted server handler is added later, it reuses the same handshake semantics and protocol message shapes defined here.

## Background

Current behavior:

- EventLogRemote.fromSocket and EventLogRemote.fromSocketUnencrypted send the caller publicKey on each request.
- EventLogServerUnencrypted.makeHandler accepts requests by publicKey and delegates read/write authorization to EventLogServerAuth.
- there is no cryptographic proof-of-possession for identity key material at session start.

Relevant code:

- packages/effect/src/unstable/eventlog/EventLog.ts defines Identity.
- packages/effect/src/unstable/eventlog/EventLogEncryption.ts defines payload encryption behavior.
- packages/effect/src/unstable/eventlog/EventLogRemote.ts defines wire protocols and client transports.
- packages/effect/src/unstable/eventlog/EventLogServerUnencrypted.ts defines the server handler and authorization hooks.

## Goals

1. Require session-level cryptographic identity proof beyond publicKey.
2. Apply one handshake design across both remote transport variants.
3. Enforce handshake completion in EventLogServerUnencrypted.makeHandler before read/write requests.
4. Keep read/write authorization semantics separate from identity proof.
5. Use direct asymmetric signature verification.
6. Enforce one trust path: pre-provisioned publicKey -> signingPublicKey binding.
7. Keep Forbidden as the required error code for handshake failures.

## Non-goals

- Designing a full PKI / CA system.
- Preserving backward compatibility with legacy clients or servers.
- Changing store mapping rules or eventlog persistence semantics.
- Changing public shape of EventLogServerAuth.authorizeRead / authorizeWrite.
- Adding signature fields to normal read/write requests after the session is authenticated.
- Defining a distributed key management control plane in this feature.

## Identity model additions

Identity keeps the existing logical identity field and adds signing keys.

Required Identity fields:

- publicKey: string (logical eventlog identity key, unchanged role)
- privateKey: existing payload-encryption secret (unchanged role)
- signingPublicKey: Uint8Array (Ed25519 public key)
- signingPrivateKey: Redacted<Uint8Array> (Ed25519 private key)

Requirements:

- makeIdentityUnsafe generates an Ed25519 keypair.
- identity codecs encode/decode signing keys.
- existing payload encryption behavior remains independent from handshake auth.

## Design overview

### Session model

Authentication is a dedicated step once per socket session:

1. server sends Hello(remoteId, challenge).
2. client signs canonical auth payload containing context, remoteId, challenge, publicKey, signingPublicKey.
3. client sends Authenticate before application-level write/read requests.
4. server verifies signature and checks pre-provisioned key binding.
5. on success, server binds session to one publicKey.
6. existing WriteEntries / RequestChanges behavior proceeds unchanged.

Socket identity binding rules:

- one authenticated socket session maps to one publicKey.
- any post-auth request with different publicKey returns Forbidden.
- concurrent first operations on an unauthenticated socket race; first successful identity binds, conflicting identities fail.

### Signature algorithm

Use Ed25519 only.

- algorithm: Ed25519
- signature source key: Identity.signingPrivateKey
- verification key: Authenticate.signingPublicKey
- challenge source: 32 random bytes from globalThis.crypto.getRandomValues

Canonical signed payload fields:

- context: eventlog-auth-v1
- remoteId
- challenge bytes
- publicKey
- signingPublicKey bytes

Requirements:

- payload encoding is canonical and byte-stable.
- verification fails on malformed key lengths or malformed signatures.
- signature verification result is required for authentication success.

### Challenge lifecycle requirements

- challenge length: 32 bytes minimum.
- challenge entropy: cryptographically secure randomness.
- challenge TTL: default 30 seconds, configurable tighter but not looser than 5 minutes.
- challenge use: single-use per session authentication.
- stale challenge behavior: Authenticate after expiry returns Forbidden and should close the socket.

### Key-binding requirements

Authentication requires a pre-provisioned binding for every accepted logical identity.

Binding model:

- trusted state maps publicKey -> signingPublicKey.
- Authenticate must match that binding exactly.
- Authenticate never creates or changes bindings.
- unknown publicKey is Forbidden.
- mismatched signingPublicKey is Forbidden.

Operational requirements:

- trusted bindings are persisted across restarts.
- loading bindings must fail closed (server refuses startup when required binding source is unavailable in production mode).
- binding creation/rotation is an explicit administrative action outside normal Authenticate request handling.
- bind and bind-mismatch events are audit logged.

### Transport security requirements

- production deployments must use encrypted channels.
- fromSocketUnencrypted is test/local only and must require an explicit unsafe enable flag.
- server startup emits a strong warning when unsafe unencrypted mode is enabled.

## Protocol changes

### Hello

Extend Hello with:

- challenge: Schema.Uint8Array

Hello.remoteId remains unchanged.

### New request: Authenticate

Shared request class for encrypted and unencrypted transports:

- _tag: Authenticate
- publicKey: Schema.String
- signingPublicKey: Schema.Uint8Array
- signature: Schema.Uint8Array
- algorithm: Schema.Literal(Ed25519)

Semantics:

- signature is over canonical auth payload for the current session challenge.
- signingPublicKey verifies the signature.
- publicKey remains the logical eventlog identity key used by authorization and mapping.

### New response: Authenticated

Shared response class for encrypted and unencrypted transports:

- _tag: Authenticated
- publicKey: Schema.String

Semantics:

- emitted after successful session authentication.
- confirms socket is bound to that publicKey for session lifetime.

### Shared error response: ProtocolError

Shared error response for both protocol variants:

- _tag: Error
- requestTag: Schema.String
- id: Schema.optional(Schema.Number)
- publicKey: Schema.optional(Schema.String)
- code: Schema.Literals([Unauthorized, Forbidden, NotFound, InvalidRequest, InternalServerError])
- message: Schema.String

Requirements:

- use one shared class in both protocol unions.
- Authenticate failures from this feature must use:
  - requestTag: Authenticate
  - code: Forbidden
- unauthenticated WriteEntries / RequestChanges / StopChanges must return Forbidden.
- server-side error emission explicitly supports Authenticate and StopChanges.

### Union additions

In EventLogRemote.ts:

- ProtocolRequest includes Authenticate.
- ProtocolRequestUnencrypted includes Authenticate.
- ProtocolResponse includes Authenticated and ProtocolError.
- ProtocolResponseUnencrypted includes Authenticated and ProtocolError.

No signature fields are added to WriteEntries, WriteEntriesUnencrypted, or RequestChanges.

## Client behavior specification

### Shared client rules

Both remote transport constructors must:

- keep per-socket session-auth state separate from identity material.
- serialize auth attempts per socket.
- fail conflicting identity auth attempts on the same socket.

Receiving new Hello must:

- set remoteId.
- set current session challenge.
- clear authenticatedPublicKey marker.
- clear in-flight auth state tied to the previous session.

After auth failure with Forbidden:

- treat current socket session as terminal for identity-bound operations.
- do not auto-retry auth on that same socket.

### EventLogRemote.fromSocketUnencrypted

Session-auth state:

- helloChallenge from latest Hello
- authenticatedPublicKey for current socket session
- serialized in-flight auth effect

Required behavior:

1. receiving Hello stores remoteId and challenge.
2. first write(identity, entries) or changes(identity, startSequence) on unauthenticated session must:
   - canonicalize auth payload
   - sign with identity.signingPrivateKey
   - send Authenticate(publicKey, signingPublicKey, signature, algorithm)
   - wait for Authenticated
   - bind session to that publicKey
3. once authenticated, write/change flows stay unchanged.
4. using different publicKey after session auth fails locally and/or returns Forbidden.
5. auth failure surfaces as EventLogRemoteError with method: authenticate.
6. StopChanges is sent only for authenticated sessions with active subscription.
7. ProtocolError is decoded and mapped for pending auth/write/change operations.

### EventLogRemote.fromSocket

Apply same session-auth flow before encrypted write/read traffic:

- same Hello challenge handling
- same Authenticate / Authenticated handshake
- same single-publicKey-per-socket rule
- same ProtocolError mapping

Payload encryption semantics remain unchanged.

### Concurrency and retry rules

- session auth is serialized per socket.
- concurrent first operations for same identity share one auth effect.
- concurrent first operations for different identities on one socket do not both succeed.
- no automatic retry after Forbidden.
- reconnect/new socket performs fresh challenge-signature auth.

## Server behavior specification

### Runtime state

EventLogServerUnencrypted.make holds shared trusted key-binding state for all handlers in the runtime:

- Map<publicKey, signingPublicKey>

Persistence requirement:

- trusted bindings must be backed by durable storage in production mode.
- in-memory trusted bindings are test/local only and require explicit unsafe enable flag.

Per-socket state in makeHandler:

- sessionChallenge: Uint8Array
- sessionChallengeIssuedAt: timestamp
- authenticatedPublicKey: string | undefined

### Socket startup and reset

On socket accept:

1. generate fresh random challenge.
2. capture challenge issue time.
3. send Hello({ remoteId, challenge }).
4. gate application requests until auth succeeds.

A new Hello starts a new session and clears previous identity binding.

### Authenticate handling

Required behavior:

1. if socket already authenticated:
   - same publicKey => return Authenticated again.
   - different publicKey => Forbidden.
2. verify algorithm is Ed25519.
3. verify challenge is still within TTL.
4. canonicalize payload using request fields plus current session remoteId/challenge.
5. verify signature with Ed25519.
   - verification failure => Forbidden.
6. load trusted binding for request.publicKey.
   - no trusted binding => Forbidden.
   - trusted binding differs from request.signingPublicKey => Forbidden.
7. mark socket authenticated for request.publicKey.
8. return Authenticated.

Failure hardening:

- repeated Authenticate failures should be rate-limited per source and publicKey.
- server may close socket immediately on malformed Authenticate payloads.

### Request gating and ordering

Before auth:

- Ping allowed.
- Authenticate allowed.
- WriteEntries / RequestChanges / StopChanges return Forbidden.
- chunked messages resolving to those tags also return Forbidden.

After auth, server enforces:

1. session authenticated check.
2. request publicKey equals authenticatedPublicKey.
3. then store resolution and authorizeRead / authorizeWrite.

This prevents authorization/store side effects before identity proof.

### Interaction with EventLogServerAuth

Authorization remains separate:

- do not add signature fields to authorizeWrite / authorizeRead.
- run handshake checks first.
- post-auth authorization behavior remains unchanged.
- newly introduced handshake failures use Forbidden.

## Behavioral edge cases

1. Unknown publicKey (no trusted binding)
   - Forbidden.
2. Known publicKey with different signingPublicKey
   - Forbidden.
3. Invalid signature with valid-looking payload
   - Forbidden.
4. Replay of signature from old challenge
   - Forbidden.
5. Authenticated as one publicKey but request uses another
   - Forbidden.
6. Write/read before auth
   - Forbidden.
7. Unauthenticated StopChanges
   - Forbidden.
8. Restart with durable trusted binding store
   - bindings preserved; trust continuity retained.
9. Startup with missing required binding source in production mode
   - fail closed and refuse startup.
10. Restart in explicit local/test in-memory mode
   - trusted bindings follow local fixture setup; server emits unsafe mode warning.

## Acceptance criteria

Feature is complete when:

1. Hello includes challenge in both protocol variants.
2. Authenticate / Authenticated exists in both protocol variants.
3. shared ProtocolError exists in both protocol variants.
4. fromSocket authenticates once per socket session before encrypted requests.
5. fromSocketUnencrypted authenticates once per socket session before unencrypted requests.
6. makeHandler forbids reads/writes before auth.
7. Authenticate verifies Ed25519 signature over canonical payload.
8. server requires a pre-provisioned publicKey -> signingPublicKey binding.
9. unknown bindings are rejected (Forbidden).
10. binding persistence is required for production mode.
11. challenge TTL and single-use rules are enforced.
12. one socket session binds to one publicKey.
13. read/write authorization remains separate from handshake proof.
14. handshake failures introduced here use Forbidden.
15. request payload schemas for reads/writes are otherwise unchanged.

## Testing strategy

### Existing test files to extend

- packages/effect/test/unstable/eventlog/EventLogRemote.test.ts
- packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts

### Required new test coverage

#### Remote client tests

1. Hello decoding captures challenge.
2. first write on unauthenticated unencrypted socket sends Authenticate before WriteEntries.
3. first changes on unauthenticated unencrypted socket sends Authenticate before RequestChanges.
4. encrypted fromSocket performs same handshake before WriteEntries / RequestChanges.
5. concurrent first operations for same identity share one auth handshake.
6. concurrent first operations for different identities do not both succeed.
7. auth Forbidden surfaces as EventLogRemoteError with method authenticate.
8. once authenticated, no extra Authenticate for subsequent operations.
9. new Hello resets per-session auth state.
10. fromSocket handles ProtocolError auth failures.
11. canonical auth payload encoding is deterministic and byte-stable.

#### Server handler tests

1. Hello includes challenge.
2. non-auth requests before Authenticate receive Forbidden.
3. unauthenticated StopChanges receives Forbidden.
4. valid Authenticate signature with matching trusted binding succeeds and unlocks later requests.
5. invalid signature returns Forbidden.
6. unknown publicKey binding returns Forbidden.
7. mismatched signingPublicKey for known publicKey returns Forbidden.
8. challenge TTL expiry returns Forbidden.
9. replayed signature from older challenge returns Forbidden.
10. authenticated socket rejects read/write with different publicKey.
11. authorizeWrite / authorizeRead are not called before auth succeeds.
12. post-auth authorization behavior remains unchanged.
13. production mode refuses startup when required trusted binding storage is unavailable.

### Test helper guidance

- use existing socket harness style in both eventlog test files.
- add shared helpers for canonical payload encoding and Ed25519 test signing.
- keep tests in it.effect style.

## Implementation plan

1. Implement asymmetric session-auth protocol end-to-end in one atomic commit
   - add Hello.challenge, Authenticate, Authenticated, shared ProtocolError protocol types and codec changes
   - add canonical payload encode + Ed25519 sign/verify helpers
   - add Identity signing key fields and constructors/codecs
   - add client session-auth logic to fromSocket and fromSocketUnencrypted
   - add server signature verification, request gating, trusted binding checks, and durable binding integration hooks
   - add server config for strict defaults (pre-provisioned bindings required, unsafe unencrypted mode opt-in)
   - extend remote/server tests for handshake correctness and hardening behaviors

2. Validation and cleanup
   - run pnpm lint-fix
   - run pnpm test packages/effect/test/unstable/eventlog/EventLogRemote.test.ts
   - run pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts
   - run pnpm check:tsgo
   - run pnpm docgen
   - refresh protocol docs and inline comments where needed

## Validation checklist

- pnpm lint-fix
- pnpm test packages/effect/test/unstable/eventlog/EventLogRemote.test.ts
- pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts
- pnpm check:tsgo
- pnpm docgen
