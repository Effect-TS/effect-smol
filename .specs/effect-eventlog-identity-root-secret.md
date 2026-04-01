# Effect EventLog Identity Root Secret Specification

## Summary

Change `EventLog.Identity` so its public shape contains only:

- `publicKey: string`
- `privateKey: Redacted.Redacted<Uint8Array<ArrayBuffer>>`

The `privateKey` becomes the single root secret for the identity. All other cryptographic material currently stored on the identity, especially the Ed25519 signing key pair used for session authentication, must be derived from this root secret instead of being stored directly on the service.

This is an intentionally breaking change. No backwards-compatibility layer is required for legacy four-field identities.

## Source Request

> We need to change EventLog.Identity to only have publicKey and privateKey, to make it easier to integration with passkeys and other systems.
>
> The signing key pair could be derived from the private key.

Additional clarified requirements from the user:

- `privateKey` should become a single root secret.
- `publicKey` should remain as it is today: an arbitrary string identifier.
- This may be a breaking change.
- Backwards compatibility is not required.
- The goal for now is only to simplify the identity shape.
- Server-side storage may be simplified only if that can be done safely.

## Context

Today `EventLog.Identity` stores four fields:

- `publicKey`: user-visible identifier string
- `privateKey`: AES-GCM encryption secret
- `signingPublicKey`: Ed25519 public key bytes
- `signingPrivateKey`: Ed25519 private key bytes

Current behavior in the codebase:

1. `EventLog.makeIdentity` generates a random UUID for `publicKey`.
2. It generates a random 32-byte `privateKey` for encryption.
3. It separately generates an Ed25519 keypair for session authentication.
4. Identity serialization persists all four fields.
5. Remote authentication and server-side session binding depend on the stored signing key pair.

This makes `Identity` awkward to integrate with systems that want a simpler identity payload or a single source secret.

## Goals

1. Reduce the public `EventLog.Identity` shape to exactly two fields: `publicKey` and `privateKey`.
2. Treat `privateKey` as the single root secret for all client-side cryptographic operations.
3. Derive the session-auth signing keypair from the root secret instead of storing it on `Identity`.
4. Preserve existing runtime behavior for:
   - encrypted EventLog writes / reads
   - unencrypted EventLog writes / reads
   - session authentication between remote clients and servers
5. Keep `publicKey` as an arbitrary string identifier.
6. Avoid unnecessary server-side storage complexity, while preserving security.

## Non-Goals

1. Adding real passkey / WebAuthn support in this change.
2. Making `publicKey` cryptographically derived from or bound to the root secret.
3. Preserving decode compatibility for existing serialized four-field identities.
4. Redesigning the EventLog authentication protocol beyond what is required to support derived signing keys.
5. Removing security checks that currently prevent a different signing key from taking over an existing `publicKey`.

## Required Design

### 1. Public identity model

The public `EventLog.Identity` service must become:

```ts
export class Identity extends ServiceMap.Service<Identity, {
  readonly publicKey: string
  readonly privateKey: Redacted.Redacted<Uint8Array<ArrayBuffer>>
}>()("effect/eventlog/EventLog/Identity") {}
```

The following fields must be removed from the public identity surface:

- `signingPublicKey`
- `signingPrivateKey`

This includes all related exported schemas and serialization helpers.

### 2. Meaning of privateKey

After this change, `identity.privateKey` is no longer “the AES key only”. It is the identity root secret.

The implementation must derive at least two pieces of material from it:

1. encryption key material for AES-GCM entry encryption/decryption
2. Ed25519 signing key material for session authentication

These derived values are internal implementation details and must not be exposed on `EventLog.Identity`.

### 3. Derived key material

The implementation must introduce an internal, deterministic, domain-separated derivation step.

Required properties:

- deterministic: the same root secret always produces the same derived material
- domain-separated: encryption derivation and signing derivation must not reuse the same raw bytes directly
- versioned: derivation labels/constants must include a stable `v1` namespace so the code can evolve later if needed
- cachable: repeated use of the same identity should avoid re-deriving / re-importing expensive crypto material when possible

Minimum required internal outputs:

- AES-GCM importable key material or imported `CryptoKey`
- Ed25519 signing private key bytes or imported `CryptoKey`
- Ed25519 signing public key bytes

### 4. Internal derivation helper contract

The implementation should add a private helper module under the unstable EventLog implementation, preferably in a non-barrel internal location such as `packages/effect/src/unstable/eventlog/internal/`, to avoid unnecessary public API or barrel churn.

The helper should be responsible for deriving and caching identity crypto material. It should expose an internal shape conceptually similar to:

```ts
{
  readonly encryptionKey: CryptoKey
  readonly signingPublicKey: Uint8Array<ArrayBuffer>
  readonly signingPrivateKey: Redacted.Redacted<Uint8Array<ArrayBuffer>>
}
```

External code must not observe this helper directly.

Additional requirements:

- cache by identity instance and/or root secret material, never by `publicKey` alone
- if the implementation must choose between caching imported `CryptoKey` values or raw derived bytes, it must do so consistently and keep the choice private
- derivation labels must be stable and explicit, for example:
  - `effect/eventlog/identity/v1/encryption`
  - `effect/eventlog/identity/v1/signing`
- tests must lock down determinism and domain separation behavior within this repository

Implementation note:

- It is acceptable for the implementation to use a deterministic seed-expansion step plus internal Ed25519 key construction if WebCrypto alone is insufficient.
- Introducing signing derivation must not expand the public API of `EventLog.Identity`.

### 5. Identity generation

`EventLog.makeIdentity` / `EventLogEncryption.generateIdentity` must now generate:

- `publicKey`: same behavior as today (random UUID string)
- `privateKey`: a fresh random 32-byte root secret

It must no longer generate or return a separate signing keypair as part of the identity value.

### 6. Identity serialization

The following public helpers must serialize only the two-field shape:

- `IdentitySchema`
- `decodeIdentityString`
- `encodeIdentityString`

Required encoded JSON shape:

```json
{
  "publicKey": "<string>",
  "privateKey": "<base64>"
}
```

No compatibility shim is required for the legacy four-field encoded format.

Any repository-owned persisted identity blobs, examples, snapshots, or fixtures using the legacy format must be updated or regenerated during implementation.

### 7. Encryption behavior

`EventLogEncryption.makeEncryptionSubtle` must stop reading `identity.signingPublicKey` and `identity.signingPrivateKey` because those fields no longer exist.

Instead:

- AES-GCM encryption/decryption must use encryption material derived from the root secret.
- Session-auth signing must use signing material derived from the root secret.
- Any expensive imports / derivations should be cached per identity instance, similar to the current encryption key cache.

### 8. Remote authentication behavior

`EventLogRemote` currently builds the authentication payload and signature from stored signing key bytes on `Identity`.

After this change it must:

1. derive the signing keypair from `identity.privateKey`
2. use the derived signing public key when building the authenticate request
3. use the derived signing private key when signing the canonical session-auth payload

### 9. Wire protocol compatibility

The external authentication wire protocol must remain unchanged in this change.

This explicitly includes:

- `EventLogMessage.Authenticate`
- `EventLogSessionAuth.SessionAuthPayload`
- the canonical payload encoding structure and field order
- server-side verification against the provided / persisted `signingPublicKey`

The request still carries:

- `publicKey`
- `signingPublicKey`
- Ed25519 signature
- `algorithm: "Ed25519"`

Only the source of the signing keypair changes: it is now derived internally from the root secret.

### 10. Server-side implications

Because the user explicitly wants `publicKey` to remain an arbitrary string, the server **cannot** safely recompute the expected signing public key from `publicKey` alone.

Therefore the current security property must remain:

- an existing `publicKey` must stay bound to a single signing public key

As a result, the server-side session-auth binding storage cannot be removed purely as a consequence of this change.

Allowed simplifications:

- rename helpers or internal variables to better reflect that the server stores a `publicKey -> signingPublicKey` binding
- deduplicate repeated binding code between encrypted and unencrypted storage implementations if convenient
- simplify synthetic identity construction to match the new two-field shape

Disallowed simplification:

- removing persistent or semi-persistent signing-public-key binding for existing `publicKey` values unless the authentication model is also changed

### 11. Synthetic server identities

Some server paths currently inject a synthetic `EventLog.Identity` so handlers can access the active identity context.

After the model change, those synthetic identities must be reduced to the two-field shape.

There are two distinct cases that must preserve current `publicKey` semantics:

1. authenticated client request annotation
   - keep the authenticated client’s real `publicKey`
2. internal server write identity
   - keep the existing synthetic string form, e.g. `effect-eventlog-server-write:${storeId}`

Required behavior:

- preserve the current ability for handlers to access `EventLog.Identity`
- preserve each path’s current `publicKey` semantics
- use a placeholder root secret for synthetic server-provided identities where no real private material exists
- do not rely on those synthetic identities for local signing or encryption operations

This keeps the surface change small and avoids broad handler API changes in the same breaking change.

## Security Constraints

1. Encryption derivation and signing derivation must be domain-separated.
2. The same `publicKey` must not silently bind to multiple signing public keys over time.
3. The change must not weaken the current session-auth verification flow.
4. Removing signing keys from the public identity shape must not leak derived private material through logs, errors, or serialization.
5. Redaction behavior for `privateKey` must remain intact.

## Breaking Changes

This specification intentionally introduces breaking changes:

1. `EventLog.Identity` no longer exposes `signingPublicKey`.
2. `EventLog.Identity` no longer exposes `signingPrivateKey`.
3. Identity JSON/string encoding changes from four fields to two fields.
4. Any downstream code reading stored signing key fields from identities must be updated.
5. Legacy encoded identities are not supported by design.

A changeset should be added during implementation to document the break.

## Acceptance Criteria

The work is complete when all of the following are true:

1. The public `EventLog.Identity` type exposes only `publicKey` and `privateKey`.
2. `EventLog.makeIdentity` returns identities with only those two fields.
3. `encodeIdentityString` and `decodeIdentityString` round-trip the new two-field format.
4. Encrypted EventLog read/write behavior still succeeds using derived encryption material.
5. Remote authentication still succeeds using a signing keypair derived from the root secret.
6. No code in the EventLog implementation reads `identity.signingPublicKey` or `identity.signingPrivateKey` anymore.
7. Server-side binding logic still prevents a second signing key from taking over an existing `publicKey`.
8. Repository validations pass after implementation:
   - `pnpm lint-fix`
   - relevant `pnpm test ...`
   - `pnpm check:tsgo`
   - `pnpm docgen`

## Implementation Plan

The tasks below are intentionally grouped so each task is independently shippable and can pass linting, tests, and typechecking on its own.

### Task Status

- [x] Task 1: Add internal root-secret derivation utilities
- [ ] Task 2: Switch the public identity model to the two-field shape
- [ ] Task 3: Apply optional safe server/storage cleanup

### Task 1: Add internal root-secret derivation utilities

Status: ✅ Completed

Scope:

- Add an internal helper module for deterministic, domain-separated derivation from `EventLog.Identity.privateKey`.
- Prefer placing it in a private internal location such as `packages/effect/src/unstable/eventlog/internal/` so it does not require public export churn.
- Provide internal support for:
  - encryption key derivation/import
  - signing private key derivation/import
  - signing public key derivation
- Add caching appropriate for repeated use of the same identity instance.
- Add a dedicated focused test file for the helper that covers:
  - determinism
  - domain separation
  - cache reuse / memoization behavior for the same identity instance

Why this is atomic:

- It adds internal capability without changing the public `Identity` API yet.
- Existing code can continue using stored signing keys until later tasks switch over.

Validation for this task:

- `pnpm lint-fix`
- `pnpm test packages/effect/test/unstable/eventlog/EventLogIdentityDerivation.test.ts` (or equivalent new focused helper test file)
- `pnpm check:tsgo`
- if a new non-internal module path unexpectedly affects generated barrels, run `pnpm codegen`

Implementation discoveries:

- Added `packages/effect/src/unstable/eventlog/internal/identityRootSecretDerivation.ts` with stable v1 labels:
  - `effect/eventlog/identity/v1/encryption`
  - `effect/eventlog/identity/v1/signing`
- Implemented deterministic derivation as `SHA-256(label || 0x00 || rootSecret)`.
- Implemented deterministic Ed25519 private key material by wrapping the derived 32-byte signing seed in RFC 8410 PKCS#8 bytes, then deriving the public key through WebCrypto key export.
- Added a `WeakMap` cache keyed by identity instance to reuse derived/imported crypto material for repeated use of the same identity object.
- Added focused test coverage in `packages/effect/test/unstable/eventlog/EventLogIdentityDerivation.test.ts` for determinism, domain separation, and cache reuse.

### Task 2: Switch the public identity model to the two-field shape

Status: ⏳ Pending

Scope:

- Update `EventLog.Identity`, `IdentitySchema`, identity encoding/decoding, and `makeIdentity`.
- Remove public `signingPublicKey` / `signingPrivateKey` fields.
- Update `EventLogEncryption` and `EventLogRemote` to consume derived signing/encryption material from Task 1.
- Update server-auth middleware and synthetic identity construction to compile against the new two-field shape.
- Update tests that construct or assert against identity values.
- Add the required changeset documenting the breaking API change.

Why this is atomic:

- This is the minimum full slice that makes the public API change real while keeping the repo green.
- All compile-time references to removed fields are handled together.
- The changeset belongs here so the breaking change is release-ready when this task lands.

Validation for this task:

- `pnpm lint-fix`
- `pnpm test packages/effect/test/unstable/eventlog/EventLog.test.ts`
- `pnpm test packages/effect/test/unstable/eventlog/EventLogRemote.test.ts`
- `pnpm test packages/effect/test/unstable/eventlog/EventLogSessionAuth.test.ts`
- `pnpm test packages/sql/sqlite-node/test/SqlEventLogServerEncrypted.test.ts`
- `pnpm check:tsgo`
- `pnpm docgen`

Implementation notes for Task 2 validation:

- `EventLog.test.ts` should include the new two-field `encodeIdentityString` / `decodeIdentityString` round-trip assertion.
- `EventLogRemote.test.ts` should assert the authenticate request includes the derived `signingPublicKey` and a valid signature, not only the `publicKey` / algorithm fields.

### Task 3: Apply optional safe server/storage cleanup

Status: ⏳ Pending

Scope:

- Audit encrypted and unencrypted server storage/auth-binding code after the identity change.
- Simplify duplicated binding helpers or naming only where security semantics remain unchanged.
- Keep the `publicKey -> signingPublicKey` binding guarantee intact.
- Add or update regression coverage around server-side auth binding behavior if gaps exist.

Why this is atomic:

- The core feature is already complete after Task 2.
- This task is optional cleanup only and can ship independently without risking the primary change.
- If no meaningful safe simplification is found, this task may be skipped.

Validation for this task:

- `pnpm lint-fix`
- targeted eventlog server tests covering the modified modules
- `pnpm check:tsgo`
- `pnpm docgen`

## Test Plan

Implementation should cover at least the following cases:

1. identity string encode/decode round-trips with only `publicKey` and `privateKey`
2. `makeIdentity` returns a two-field identity
3. repeated derivation from the same root secret is deterministic
4. encryption and signing derivations are domain-separated
5. derived encryption material can encrypt and decrypt entries successfully
6. derived signing material can sign and verify session-auth payloads successfully
7. remote authenticate request still includes a valid signing public key and signature
8. server verification still rejects mismatched signatures
9. server binding still prevents re-binding an existing `publicKey` to a different signing public key

## Notes for Implementation

1. Keep the external protocol stable unless implementation constraints make a narrower internal refactor necessary.
2. Do not manually edit barrel `index.ts` files.
3. Prefer `Effect.fnUntraced` for new internal helpers in hot paths.
4. If deterministic Ed25519 derivation requires a small internal utility, keep it private to the unstable EventLog implementation unless a broader reusable abstraction is clearly warranted.
