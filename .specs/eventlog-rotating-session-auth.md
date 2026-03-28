# EventLog Asymmetric Session Challenge Authentication

## Summary

Define an asymmetric session-auth handshake for EventLogRemote, EventLogServer, and EventLogServerUnencrypted with a single authentication path.

Protocol behavior:

- Hello includes a fresh server challenge.
- the client must complete Authenticate once per socket session before reads or writes are allowed.
- Authenticate carries a signing public key and an Ed25519 signature over a canonical session payload.
- the server verifies the signature and uses a trust-on-first-auth publicKey -> signingPublicKey binding.
- handshake failures use Forbidden.
- the protocol has no public-key-only fallback.
- first successful auth for an unknown publicKey persists its signingPublicKey binding after signature/challenge verification.
- EventLogServerUnencrypted additionally requires an auth read check before that first-bind persistence.

## Security baseline

The baseline is strict and uniform:

- authentication requires a valid Ed25519 challenge signature plus a persistent key binding.
- first successful auth for an unknown publicKey creates and persists its key binding after signature/challenge verification.
- EventLogServerUnencrypted requires an auth read check before first-bind persistence; EventLogServer does not.
- existing publicKey bindings must match exactly and are never silently replaced during Authenticate.
- key-binding state is persistent and fail-closed when durable storage is required.
- challenge values are single-use and short-lived.
- production deployments must use encrypted transport.
- unencrypted transport is only for explicitly enabled local/test environments.

## Scope clarification

This repository exposes:

- two client transport constructors:
  - EventLogRemote.fromSocket
  - EventLogRemote.fromSocketUnencrypted
- two server-side handler/runtime paths:
  - EventLogServer.make / EventLogServer.makeHandler
  - EventLogServerUnencrypted.make / EventLogServerUnencrypted.makeHandler

In this design:

- wire protocol additions are shared across both client transport variants.
- concrete server-side enforcement lands in EventLogServer.makeHandler and EventLogServerUnencrypted.makeHandler, plus shared runtime state created by each make.
- trusted key bindings are stored via the Storage service used by each concrete server type.
- storage implementations, including SQL-backed storage, provide binding persistence for their server type but do not reimplement protocol authentication.
- EventLogServer and EventLogServerUnencrypted share protocol message shapes and handshake semantics, with one difference: EventLogServerUnencrypted runs a pre-bind auth read check for unknown publicKey first-auth, while EventLogServer does not.

## Context

Protocol context:

- EventLogRemote.fromSocket and EventLogRemote.fromSocketUnencrypted send the caller publicKey on requests.
- EventLogServer.makeHandler and EventLogServerUnencrypted.makeHandler accept requests by publicKey and delegate read/write authorization to EventLogServerAuth.
- session authentication requires cryptographic proof-of-possession for identity key material.

Relevant code:

- packages/effect/src/unstable/eventlog/EventLog.ts defines Identity.
- packages/effect/src/unstable/eventlog/EventLogEncryption.ts defines payload encryption behavior.
- packages/effect/src/unstable/eventlog/EventLogRemote.ts defines wire protocols and client transports.
- packages/effect/src/unstable/eventlog/EventLogServer.ts defines the encrypted server handler and authorization hooks.
- packages/effect/src/unstable/eventlog/EventLogServerUnencrypted.ts defines the unencrypted server handler and authorization hooks.

## Goals

1. Require session-level cryptographic identity proof beyond publicKey.
2. Apply one handshake design across both remote transport variants.
3. Enforce handshake completion in EventLogServer.makeHandler and EventLogServerUnencrypted.makeHandler before read/write requests.
4. Keep read/write authorization semantics separate from identity proof.
5. Use direct asymmetric signature verification.
6. Enforce one trust path: trust-on-first-auth publicKey -> signingPublicKey binding.
7. Use Forbidden as the required error code for handshake failures.

## Non-goals

- Designing a full PKI / CA system.
- Supporting clients or servers that use different handshake formats.
- Changing store mapping rules or eventlog persistence semantics.
- Changing public shape of EventLogServerAuth.authorizeRead / authorizeWrite.
- Adding signature fields to normal read/write requests after the session is authenticated.
- Defining a distributed key management control plane.

## Identity model

Identity includes the logical identity field and signing keys.

Required Identity fields:

- publicKey: string (logical eventlog identity key)
- privateKey: payload-encryption secret
- signingPublicKey: Uint8Array (Ed25519 public key)
- signingPrivateKey: Redacted<Uint8Array> (Ed25519 private key)

Requirements:

- makeIdentityUnsafe generates an Ed25519 keypair.
- identity codecs encode/decode signing keys.
- payload encryption behavior is independent from handshake auth.

## Design overview

### Session model

Authentication is a dedicated step once per socket session:

1. server sends Hello(remoteId, challenge).
2. client signs canonical auth payload containing context, remoteId, challenge, publicKey, signingPublicKey.
3. client sends Authenticate before application-level write/read requests.
4. server verifies the signature and checks or creates the persistent key binding.
5. on success, server binds session to one publicKey.
6. WriteEntries / RequestChanges proceed after authentication succeeds.

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

Authentication uses trust on first auth for logical identity bindings.

Binding model:

- trusted state maps publicKey -> signingPublicKey.
- if a binding already exists, Authenticate must match it exactly.
- if no binding exists, Authenticate atomically creates the first binding after signature/challenge verification.
- EventLogServerUnencrypted requires a pre-bind auth read check for unknown publicKey first-auth.
- EventLogServer does not run that pre-bind auth read check.
- Authenticate never changes an existing binding.
- mismatched signingPublicKey is Forbidden.
- concurrent first-bind races for the same publicKey are resolved by the first persisted binding; losing conflicting attempts are Forbidden.

Operational requirements:

- trusted bindings are persisted across restarts through the Storage service for the active server type.
- loading bindings from Storage must fail closed (server refuses startup when required binding source is unavailable in production mode).
- first binding creation happens during successful Authenticate; in EventLogServerUnencrypted this occurs only after the auth read check passes. key rotation is an explicit administrative action outside normal Authenticate request handling.
- first-bind, bind, and bind-mismatch events are audit logged.

### Transport security requirements

- production deployments must use encrypted channels.
- fromSocketUnencrypted is test/local only and must require an explicit unsafe enable flag.
- server startup emits a strong warning when unsafe unencrypted mode is enabled.

## Protocol

### Hello

Hello contains:

- remoteId: Schema.String
- challenge: Schema.Uint8Array

### Request: Authenticate

Shared request class for encrypted and unencrypted transports:

- _tag: Authenticate
- publicKey: Schema.String
- signingPublicKey: Schema.Uint8Array
- signature: Schema.Uint8Array
- algorithm: Schema.Literal(Ed25519)

Semantics:

- signature is over the canonical auth payload for the session challenge.
- signingPublicKey verifies the signature.
- publicKey is the logical eventlog identity key used by authorization and mapping.

### Response: Authenticated

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
- Authenticate failures must use:
  - requestTag: Authenticate
  - code: Forbidden
- unauthenticated WriteEntries / RequestChanges / StopChanges must return Forbidden.
- server-side error emission explicitly supports Authenticate and StopChanges.

### Protocol unions

In EventLogRemote.ts:

- ProtocolRequest includes Authenticate.
- ProtocolRequestUnencrypted includes Authenticate.
- ProtocolResponse includes Authenticated and ProtocolError.
- ProtocolResponseUnencrypted includes Authenticated and ProtocolError.

WriteEntries, WriteEntriesUnencrypted, and RequestChanges carry no signature fields.

## Client behavior specification

### Shared client rules

Both remote transport constructors must:

- keep per-socket session-auth state separate from identity material.
- serialize auth attempts per socket.
- fail conflicting identity auth attempts on the same socket.

Receiving Hello must:

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
3. once authenticated, write/change flows proceed without an additional Authenticate on that socket session.
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

Payload encryption semantics are independent from session authentication.

### Concurrency and retry rules

- session auth is serialized per socket.
- concurrent first operations for same identity share one auth effect.
- concurrent first operations for different identities on one socket do not both succeed.
- no automatic retry after Forbidden.
- reconnect/new socket performs fresh challenge-signature auth.

## Server behavior specification

### Runtime state

EventLogServer.make and EventLogServerUnencrypted.make each hold shared trusted key-binding state for all handlers in their runtime:

- Map<publicKey, signingPublicKey>

Persistence requirement:

- trusted bindings must be loaded from and persisted to the Storage service for that server type so first-auth trust survives restarts.
- in-memory trusted bindings are test/local only and require explicit unsafe enable flag.

Per-socket state in each makeHandler:

- sessionChallenge: Uint8Array
- sessionChallengeIssuedAt: timestamp
- authenticatedPublicKey: string | undefined

### Socket startup and reset

On socket accept:

1. generate fresh random challenge.
2. capture challenge issue time.
3. send Hello({ remoteId, challenge }).
4. gate application requests until auth succeeds.

Hello starts a session and clears any previous identity binding.

### Authenticate handling

Required behavior:

1. if socket already authenticated:
   - same publicKey => return Authenticated again.
   - different publicKey => Forbidden.
2. verify algorithm is Ed25519.
3. verify challenge is within TTL.
4. canonicalize payload using request fields plus current session remoteId/challenge.
5. verify signature with Ed25519.
   - verification failure => Forbidden.
6. load trusted binding for request.publicKey.
7. if no trusted binding exists:
   - EventLogServerUnencrypted: run an auth read check for request.publicKey via EventLogServerAuth.
   - EventLogServerUnencrypted: auth read check failure => Forbidden and do not persist a binding.
   - EventLogServer: skip pre-bind auth read check.
   - atomically persist request.signingPublicKey as the trusted binding for request.publicKey through the server type's Storage service.
   - if that first-bind persistence fails because another binding won a concurrent race, reload and continue mismatch handling.
8. if trusted binding differs from request.signingPublicKey => Forbidden.
9. mark socket authenticated for request.publicKey.
10. return Authenticated.

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

Authorization is separate from handshake proof:

- do not add signature fields to authorizeWrite / authorizeRead.
- run signature/challenge handshake checks first.
- EventLogServerUnencrypted runs authorizeRead as a pre-bind auth read check for unknown publicKey first-auth.
- EventLogServer does not run a pre-bind auth read check.
- post-auth authorization behavior follows the authorization contract.
- handshake failures use Forbidden.

## Behavioral edge cases

1. Unknown publicKey (no trusted binding yet)
   - EventLogServer: first valid Authenticate creates the binding and succeeds.
   - EventLogServerUnencrypted: first valid Authenticate runs auth read check, then creates the binding and succeeds.
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
8. Concurrent first auth for the same publicKey with different signingPublicKey values
   - first persisted binding wins; losing attempt is Forbidden.
9. Restart with durable trusted binding store
   - first-seen bindings are preserved in Storage; trust continuity retained.
10. Startup with missing required binding source in production mode
   - fail closed and refuse startup.
11. Restart in explicit local/test in-memory mode
   - trusted bindings follow local fixture setup; server emits unsafe mode warning.

## Acceptance criteria

Feature is complete when:

1. Hello includes challenge in both protocol variants.
2. Authenticate / Authenticated exists in both protocol variants.
3. shared ProtocolError exists in both protocol variants.
4. fromSocket authenticates once per socket session before encrypted requests.
5. fromSocketUnencrypted authenticates once per socket session before unencrypted requests.
6. EventLogServer.makeHandler and EventLogServerUnencrypted.makeHandler both forbid reads/writes before auth.
7. Authenticate verifies Ed25519 signature over canonical payload.
8. EventLogServerUnencrypted runs an auth read check before creating and persisting publicKey -> signingPublicKey binding on first successful Authenticate for an unknown publicKey.
9. EventLogServer creates and persists publicKey -> signingPublicKey binding on first successful Authenticate for an unknown publicKey without a pre-bind auth read check.
10. existing bindings must match exactly; mismatches are rejected (Forbidden).
11. binding persistence via Storage is required for production mode.
12. challenge TTL and single-use rules are enforced.
13. one socket session binds to one publicKey.
14. read/write authorization remains separate from handshake proof; only EventLogServerUnencrypted performs the pre-bind auth read check for unknown publicKey first-auth.
15. handshake failures use Forbidden.
16. request payload schemas for reads/writes contain no handshake-specific fields.

## Testing strategy

### Test files

- packages/effect/test/unstable/eventlog/EventLogRemote.test.ts
- packages/effect/test/unstable/eventlog/EventLogServer.test.ts
- packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts

### Required test coverage

#### Remote client tests

1. Hello decoding captures challenge.
2. first write on unauthenticated unencrypted socket sends Authenticate before WriteEntries.
3. first changes on unauthenticated unencrypted socket sends Authenticate before RequestChanges.
4. encrypted fromSocket performs same handshake before WriteEntries / RequestChanges.
5. concurrent first operations for same identity share one auth handshake.
6. concurrent first operations for different identities do not both succeed.
7. auth Forbidden surfaces as EventLogRemoteError with method authenticate.
8. once authenticated, no extra Authenticate for subsequent operations.
9. receiving Hello resets per-session auth state.
10. fromSocket handles ProtocolError auth failures.
11. canonical auth payload encoding is deterministic and byte-stable.

#### Server handler tests

1. Hello includes challenge.
2. non-auth requests before Authenticate receive Forbidden.
3. unauthenticated StopChanges receives Forbidden.
4. valid Authenticate signature with a matching trusted binding succeeds and unlocks requests on that session.
5. invalid signature returns Forbidden.
6. mismatched signingPublicKey for known publicKey returns Forbidden.
7. concurrent first-auth attempts for the same publicKey with different signingPublicKey values allow only one binding to win.
8. challenge TTL expiry returns Forbidden.
9. replayed signature from older challenge returns Forbidden.
10. authenticated socket rejects read/write with different publicKey.
11. post-auth authorization behavior follows the authorization contract.
12. production mode refuses startup when the required Storage-backed binding persistence is unavailable.

#### EventLogServerUnencrypted-specific tests

1. valid first-time Authenticate signature for an unknown publicKey runs auth read check, creates a trusted binding, and unlocks requests on that session.
2. failed auth read check for an unknown publicKey returns Forbidden and does not persist a trusted binding.
3. authorizeWrite is not called before auth succeeds, and authorizeRead is only called pre-auth for the unknown-key first-bind auth read check.

#### EventLogServer-specific tests

1. valid first-time Authenticate signature for an unknown publicKey creates a trusted binding without a pre-bind auth read check and unlocks requests on that session.
2. authorizeWrite and authorizeRead are not called before auth succeeds, including unknown-key first-bind Authenticate handling.

### Test helper guidance

- use existing socket harness style in eventlog server test files.
- add shared helpers for canonical payload encoding and Ed25519 test signing.
- keep tests in it.effect style.

## Implementation plan

### Phase 1 — protocol schema and union wiring

- [x] add `Hello.challenge` to `EventLogRemote.Hello`
- [x] add shared `Authenticate` request schema
- [x] add shared `Authenticated` response schema
- [x] replace unencrypted-only error schema with shared `ProtocolError`
- [x] wire `Authenticate` into both request unions
- [x] wire `Authenticated` + `ProtocolError` into both response unions
- [x] update immediate call sites/tests impacted by the union changes (constructor fields and discriminated-union switch coverage)

### Discovery / implementation notes (current task)

- Added shared `EventLogSessionAuth` helpers for canonical length-prefixed payload encoding/decoding plus Ed25519 sign/verify wrappers.
- Canonical payload signing and verification now share one implementation path (`encodeSessionAuthPayload` + `signSessionAuthPayloadBytes` / `verifySessionAuthPayloadBytes`) to avoid future client/server duplication when wiring `Authenticate` handling.
- Helper validation rejects malformed signing public keys, malformed signature lengths, and malformed canonical payload bytes prior to cryptographic verification.
- Session-auth helpers now also provide server-side challenge utilities (`makeSessionAuthChallenge`, default TTL constant, expiry checks) and one-call request verification (`verifySessionAuthenticateRequest`) that enforces algorithm, challenge TTL, single-use, and canonical signature verification.
- Canonical encoding now normalizes `remoteId` bytes to a hex string before signing to keep signatures stable across `Uint8Array` / `Buffer` runtime representations.
- Client remotes now keep per-socket auth state (latest Hello remoteId/challenge, authenticated publicKey, failed-forbidden marker, and in-flight auth deferred) and force Authenticate before the first write/changes request.
- Concurrent auth attempts are serialized per socket: same publicKey shares one in-flight auth effect, different publicKeys fail locally with `EventLogRemoteError({ method: "authenticate" })`.
- Receiving a new Hello resets the current authenticated binding and clears in-flight auth for the previous session challenge.
- For backward compatibility with existing `Identity` values that do not yet carry signing keys, the client currently derives and caches an Ed25519 keypair per identity instance when explicit signing keys are missing.
- Server handlers now generate fresh random Hello challenges, enforce pre-auth request gating (Ping + Authenticate only), emit `ProtocolError(Authenticate, Forbidden)` for auth failures, and enforce one-publicKey-per-socket after auth in both encrypted and unencrypted handlers.
- Added dedicated encrypted-server protocol tests (`EventLogServer.test.ts`) and expanded unencrypted-server tests to cover pre-auth gating, successful Authenticate unlocks, invalid signature/expired challenge rejection, and post-auth publicKey mismatch rejection.
- `EventLogServer.Storage` / `EventLogServerUnencrypted.Storage` now expose persistent session-auth binding primitives (`loadSessionAuthBindings`, `getSessionAuthBinding`, `putSessionAuthBindingIfAbsent`) implemented by both memory and SQL storage layers.
- Encrypted and unencrypted handlers now preload persisted bindings at construction time and enforce strict `publicKey -> signingPublicKey` matching during Authenticate; mismatches always emit `ProtocolError({ requestTag: Authenticate, code: Forbidden })`.
- First-bind races now use atomic `put-if-absent` persistence plus reload-on-conflict mismatch checks so only one signing key can win concurrent first-auth attempts.
- `EventLogServerUnencrypted.make` now centralizes TOFU binding policy in `authenticateSession`: unknown keys run the pre-bind `authorizeRead` check before persistence, while known-key mismatches are rejected without re-binding.
- Added server tests covering restart persistence and conflicting concurrent first-bind attempts for both encrypted and unencrypted handlers, plus an unencrypted authorization-failure regression path that still allows first Authenticate before post-auth request denials.
- This task validated with: `pnpm lint-fix`, `pnpm test packages/effect/test/unstable/eventlog/EventLogServer.test.ts`, `pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`, `pnpm check:tsgo`, and `pnpm docgen`.

### Phase 2 — handshake execution and trust binding (pending)

- [x] add canonical auth payload encode + Ed25519 sign/verify helpers
- [x] add client session-auth flow to `fromSocket` and `fromSocketUnencrypted`
- [x] add server auth gating / signature verification in `EventLogServer.makeHandler` and `EventLogServerUnencrypted.makeHandler`
- [x] add trust-on-first-auth binding load/store integration via each server `Storage` service
- [x] enforce server-type first-bind behavior difference (unencrypted pre-bind auth read check; encrypted none)
- [x] add remaining remote/server handshake tests and hardening coverage

### Phase 3 — validation and cleanup

- [x] run `pnpm lint-fix`
- [x] run `pnpm test packages/effect/test/unstable/eventlog/EventLogRemote.test.ts`
- [x] run `pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts`
- [x] run `pnpm test packages/effect/test/unstable/eventlog/EventLogServer.test.ts`
- [x] run `pnpm test packages/effect/test/unstable/eventlog/EventLogSessionAuth.test.ts`
- [x] run `pnpm check:tsgo`
- [x] run `pnpm docgen`
- [x] refresh protocol docs and inline comments where needed

## Validation checklist

- [x] pnpm lint-fix
- [x] pnpm test packages/effect/test/unstable/eventlog/EventLogRemote.test.ts
- [x] pnpm test packages/effect/test/unstable/eventlog/EventLogServer.test.ts
- [x] pnpm test packages/effect/test/unstable/eventlog/EventLogServerUnencrypted.test.ts
- [x] pnpm test packages/effect/test/unstable/eventlog/EventLogSessionAuth.test.ts
- [x] pnpm check:tsgo
- [x] pnpm docgen
