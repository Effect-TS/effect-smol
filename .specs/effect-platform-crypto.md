# Effect Platform Crypto Service Specification

## Summary

Add a platform-agnostic `Crypto` service to `effect`. The service provides cryptographic randomness, UUIDv4 generation, and digest operations through an Effect service interface, with platform-specific implementations supplied by runtime packages such as `@effect/platform-node`, `@effect/platform-bun`, and `@effect/platform-browser`.

The service must provide a safe replacement for the current `Random.nextUUIDv4` API, which is pseudo-random and can be unsafe when used without a high-entropy seed. UUIDv4 generation must use native platform APIs such as `crypto.randomUUID` where available.

## Background and Research

Platform services in this repository follow the pattern used by `FileSystem`:

- Core service abstraction: `packages/effect/src/FileSystem.ts`.
- Node wrapper: `packages/platform-node/src/NodeFileSystem.ts`.
- Bun wrapper: `packages/platform-bun/src/BunFileSystem.ts`.
- Shared Node/Bun implementation: `packages/platform-node-shared/src/NodeFileSystem.ts`.

Important conventions from that implementation:

- The service interface lives in `effect` and carries a unique `TypeId` property.
- The service tag is created with `Context.Service`.
- Platform-specific packages expose `layer` values that provide the service.
- Node and Bun can share implementation code when Bun supports the relevant Node API.
- Generated `index.ts` barrel files must not be edited manually; run `pnpm codegen` after adding modules.
- Platform errors should use `PlatformError` where possible.
- Library implementation code should avoid `async` / `await` and `try` / `catch`, using Effect APIs instead.

The current UUID implementation is in `packages/effect/src/Random.ts` as `Random.nextUUIDv4`. It is generated from the `Random` service, which is pseudo-random and seedable. That makes it useful for deterministic testing but inappropriate as a cryptographic UUID source.

## User Requirements and Clarifications

- Add a platform-agnostic `Crypto` Effect service.
- Include a UUIDv4 method so users can stop using `Random.nextUUIDv4` for UUID generation.
- Use `Data.TaggedEnum` for `DigestAlgorithm`.
- Do not place `DigestAlgorithm` in a namespace.
- `randomUUIDv4` must use platform-specific methods where possible, such as `crypto.randomUUID`.
- Because UUID generation should prefer native platform methods, the core service constructor must not derive `randomUUIDv4` from `randomBytes`.
- Ensure detailed documentation for the new `Crypto` module is present.

## Proposed Public API

Add `packages/effect/src/Crypto.ts`.

```ts
import * as Context from "./Context.ts"
import * as Data from "./Data.ts"
import type * as Effect from "./Effect.ts"
import type { PlatformError } from "./PlatformError.ts"

const TypeId = "~effect/platform/Crypto"

export type DigestAlgorithm = Data.TaggedEnum<{
  readonly Sha1: {}
  readonly Sha256: {}
  readonly Sha384: {}
  readonly Sha512: {}
}>

export const DigestAlgorithm = Data.taggedEnum<DigestAlgorithm>()

export interface Crypto {
  readonly [TypeId]: typeof TypeId

  readonly randomBytes: (
    size: number
  ) => Effect.Effect<Uint8Array, PlatformError>

  readonly randomUUIDv4: Effect.Effect<string, PlatformError>

  readonly digest: (
    algorithm: DigestAlgorithm,
    data: Uint8Array
  ) => Effect.Effect<Uint8Array, PlatformError>
}

export const Crypto: Context.Service<Crypto, Crypto> = Context.Service("effect/platform/Crypto")
```

Top-level accessors should be provided for ergonomic use:

```ts
export const randomBytes: (
  size: number
) => Effect.Effect<Uint8Array, PlatformError, Crypto>

export const randomUUIDv4: Effect.Effect<string, PlatformError, Crypto>

export const digest: (
  algorithm: DigestAlgorithm,
  data: Uint8Array
) => Effect.Effect<Uint8Array, PlatformError, Crypto>
```

A constructor is optional. If included, it must only attach the `TypeId` and must require a complete implementation:

```ts
export const make = (impl: Omit<Crypto, typeof TypeId>): Crypto =>
  Crypto.of({ ...impl, [TypeId]: TypeId })
```

The constructor must not derive `randomUUIDv4` from `randomBytes`. UUID generation belongs in platform-specific implementations so native APIs can be used when available.

## Functional Requirements

### Core `Crypto` Module

1. Add `packages/effect/src/Crypto.ts`.
2. Define `TypeId` as `"~effect/platform/Crypto"`.
3. Define `DigestAlgorithm` as a top-level `Data.TaggedEnum`, not inside a namespace.
4. Export `DigestAlgorithm = Data.taggedEnum<DigestAlgorithm>()`.
5. Use variants `Sha1`, `Sha256`, `Sha384`, and `Sha512` unless maintainers prefer exact quoted tags such as `"SHA-256"`.
6. Define `Crypto` with `randomBytes`, `randomUUIDv4`, and `digest`.
7. Define the service tag with `Context.Service("effect/platform/Crypto")`.
8. Add top-level accessors that retrieve the service from context and delegate to it.
9. Keep the core module platform-agnostic; it must not import `node:crypto` or rely directly on `globalThis.crypto`.
10. If a `make` helper is added, make it a simple full-implementation constructor only.

### Digest Algorithm Mapping

1. Platform implementations must map `DigestAlgorithm` variants to the algorithm names expected by their backend.
2. Web Crypto implementations should map:
   - `Sha1` -> `"SHA-1"`.
   - `Sha256` -> `"SHA-256"`.
   - `Sha384` -> `"SHA-384"`.
   - `Sha512` -> `"SHA-512"`.
3. Node implementations can use Web Crypto `subtle.digest` with the same names, or Node hashing APIs if that better fits implementation constraints.
4. Unsupported or malformed algorithms must fail with `PlatformError.badArgument` or an appropriate `PlatformError.systemError`, not throw.

### UUIDv4 Requirements

1. `randomUUIDv4` must return a lowercase UUIDv4 string.
2. It must satisfy the standard UUIDv4 shape: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`, where `y` is one of `8`, `9`, `a`, or `b`.
3. Platform implementations must prefer native UUID APIs:
   - Node: `node:crypto.randomUUID()`.
   - Bun: `node:crypto.randomUUID()` through the shared Node implementation if compatible.
   - Browser: `globalThis.crypto.randomUUID()` when available.
4. Browser implementations may fall back to UUID formatting from `crypto.getRandomValues` only inside the browser platform implementation if `randomUUID` is unavailable but cryptographic random bytes are available.
5. The core `Crypto` module must not derive `randomUUIDv4` from `randomBytes` in `make`.
6. No implementation may use `Random`, `Math.random`, `Date.now`, or `new Date` for UUID generation.

### Random Bytes Requirements

1. `randomBytes(size)` must generate cryptographically secure random bytes.
2. `size` must be a safe non-negative integer.
3. Invalid sizes must fail with `PlatformError.badArgument`.
4. `randomBytes(0)` should succeed with an empty `Uint8Array`.
5. Browser implementations must respect the `crypto.getRandomValues` per-call limit by chunking large requests, typically at `65_536` bytes.
6. Returned byte arrays should be fresh arrays owned by the caller.

### Digest Requirements

1. `digest(algorithm, data)` must compute a cryptographic digest of `data`.
2. The returned value must be a `Uint8Array`.
3. The input `data` must not be mutated.
4. Platform failures must be represented as `PlatformError` values.
5. SHA-1 is included for compatibility with Web Crypto and existing protocols, but documentation must state that SHA-1 should not be used for new security-sensitive designs.

## Platform Implementation Plan

### Node and Bun Shared Implementation

Add `packages/platform-node-shared/src/NodeCrypto.ts`.

Requirements:

1. Import `node:crypto`.
2. Implement `randomBytes` with `crypto.randomBytes`.
3. Implement `randomUUIDv4` with `crypto.randomUUID()`.
4. Implement `digest` with `crypto.webcrypto.subtle.digest` or equivalent Node crypto APIs.
5. Convert backend exceptions and promise rejections to `PlatformError`.
6. Export `layer: Layer.Layer<Crypto.Crypto>`.

Add thin runtime wrappers:

- `packages/platform-node/src/NodeCrypto.ts` re-exports `NodeCrypto.layer`.
- `packages/platform-bun/src/BunCrypto.ts` re-exports the shared layer if Bun compatibility is sufficient.

### Browser Implementation

Add `packages/platform-browser/src/BrowserCrypto.ts`.

Requirements:

1. Use `globalThis.crypto` as the backend.
2. Implement `randomBytes` with `crypto.getRandomValues`, chunking large requests.
3. Implement `randomUUIDv4` with `crypto.randomUUID()` when available.
4. If `crypto.randomUUID` is unavailable, use `getRandomValues` and a private browser-local UUIDv4 formatter.
5. Implement `digest` with `crypto.subtle.digest`.
6. Fail with a clear `PlatformError.systemError({ _tag: "Unknown" })` when required crypto capabilities are unavailable.
7. Do not require Node types or Node imports.

## Service Aggregation

Update Node service aggregation:

- Add `Crypto` to `packages/platform-node/src/NodeServices.ts` imports and `NodeServices` union.
- Merge `NodeCrypto.layer` into `NodeServices.layer`.

Update Bun service aggregation:

- Add `Crypto` to `packages/platform-bun/src/BunServices.ts` imports and `BunServices` union.
- Merge `BunCrypto.layer` into `BunServices.layer`.

No browser aggregate service module currently exists. Do not introduce one solely for this task unless maintainers request it.

## Random Migration Plan

1. Remove or deprecate `Random.nextUUIDv4` after `Crypto.randomUUIDv4` is available.
2. Update `Random` module documentation to remove UUID examples.
3. Update `packages/effect/test/Random.test.ts` to remove UUID-specific tests if the API is removed.
4. Add tests and documentation showing `Crypto.randomUUIDv4` as the replacement.
5. Audit direct uses of `crypto.randomUUID()` and `node:crypto.randomUUID()` separately. Do not mechanically add `Crypto` requirements to unrelated modules unless that module should become platform-service-driven.
6. If a compatibility period is desired, mark `Random.nextUUIDv4` as deprecated and point users to `Crypto.randomUUIDv4`; otherwise remove it in the same change.

## Documentation Requirements

Add detailed JSDoc to `packages/effect/src/Crypto.ts`.

The documentation must explain:

1. `Crypto` is for cryptographic randomness and cryptographic operations.
2. `Random` is for deterministic pseudo-random generation and tests.
3. UUID generation should use `Crypto.randomUUIDv4`, not `Random.nextUUIDv4`.
4. Platform implementations must be provided through layers.
5. SHA-1 is available only for compatibility and should be avoided for new security-sensitive designs.

Include examples for:

1. Generating a UUIDv4.
2. Generating random bytes.
3. Computing a SHA-256 digest.
4. Providing `NodeCrypto.layer`.
5. Providing `BrowserCrypto.layer`.
6. Providing a deterministic fake `Crypto` implementation in tests.

JSDoc examples must compile with docgen.

## Testing Requirements

### Core Tests

Add `packages/effect/test/Crypto.test.ts`.

Test cases:

1. `DigestAlgorithm` constructors create the expected tagged enum values.
2. `randomBytes` accessor delegates to the provided service.
3. `randomUUIDv4` accessor delegates to the provided service.
4. `digest` accessor delegates to the provided service.
5. A custom `Crypto` service can be provided via `Effect.provideService`.

Core tests must not assume platform crypto availability.

### Node Tests

Add `packages/platform-node/test/NodeCrypto.test.ts`.

Test cases:

1. `randomBytes(0)` returns an empty `Uint8Array`.
2. `randomBytes(32)` returns 32 bytes.
3. Invalid sizes fail with `PlatformError`.
4. `randomUUIDv4` returns a valid UUIDv4 string.
5. Two UUIDs generated by the native implementation are not equal in a basic smoke test.
6. SHA-256 digest of a known input matches the known vector.

### Browser Tests

Add `packages/platform-browser/test/BrowserCrypto.test.ts` if the current test environment supports Web Crypto.

Test cases:

1. `randomBytes` delegates to `getRandomValues` and handles chunking.
2. `randomUUIDv4` uses `crypto.randomUUID` when present.
3. `randomUUIDv4` falls back to `getRandomValues` when `randomUUID` is absent but random bytes are available.
4. Missing crypto capabilities fail with `PlatformError`.
5. SHA-256 digest matches a known vector if `crypto.subtle` is available.

### Random Migration Tests

If `Random.nextUUIDv4` is removed:

1. Remove its tests from `packages/effect/test/Random.test.ts`.
2. Keep existing deterministic `Random` tests for numbers, booleans, ranges, shuffling, and seeding.

If `Random.nextUUIDv4` is deprecated instead:

1. Preserve existing behavior temporarily.
2. Add documentation and changeset text warning that it is not appropriate for cryptographic UUIDs.

## Generated Files

After adding modules, run `pnpm codegen`.

Expected generated barrel updates:

- `packages/effect/src/index.ts`.
- `packages/platform-node/src/index.ts`.
- `packages/platform-bun/src/index.ts`.
- `packages/platform-browser/src/index.ts`.

Do not manually edit generated barrel files.

## Changeset Requirements

Add a changeset covering at least:

- `effect`.
- `@effect/platform-node`.
- `@effect/platform-node-shared`.
- `@effect/platform-bun`.
- `@effect/platform-browser`.

The changeset must state:

- A new platform-agnostic `Crypto` service was added.
- `Crypto.randomUUIDv4` provides cryptographically secure UUIDv4 generation through platform implementations.
- `DigestAlgorithm` is represented as a `Data.TaggedEnum`.
- Users should migrate away from `Random.nextUUIDv4` for UUID generation.

## Validation Plan

Run validation in this order:

1. `pnpm lint-fix`.
2. `pnpm codegen`.
3. `pnpm test packages/effect/test/Crypto.test.ts`.
4. `pnpm test packages/platform-node/test/NodeCrypto.test.ts`.
5. `pnpm test packages/platform-browser/test/BrowserCrypto.test.ts` if added.
6. `pnpm test packages/effect/test/Random.test.ts` if `Random` was changed.
7. `pnpm check:tsgo`.
8. If `pnpm check:tsgo` repeatedly fails due to stale caches, run `pnpm clean` and rerun `pnpm check:tsgo`.
9. For localized `effect` package documentation changes, run `cd packages/effect && pnpm docgen`.

## Acceptance Criteria

1. `Crypto` is available from `effect/Crypto`.
2. `DigestAlgorithm` is a top-level `Data.TaggedEnum`, not a namespace member.
3. `Crypto.randomUUIDv4` works through a provided platform service.
4. Node and Bun implementations use native `crypto.randomUUID()` where available.
5. Browser implementation uses native `crypto.randomUUID()` when available and only falls back to `getRandomValues` inside the browser implementation.
6. The core constructor, if present, does not derive UUIDs from random bytes.
7. `randomBytes` validates sizes and returns cryptographically secure random bytes.
8. `digest` supports SHA-1, SHA-256, SHA-384, and SHA-512 through `DigestAlgorithm` values.
9. Platform failures are represented as `PlatformError` values.
10. Core and platform tests pass.
11. JSDoc examples compile with docgen.
12. Generated barrel files are regenerated with `pnpm codegen`.
13. A changeset documents the new service and UUID migration guidance.

## Risks and Mitigations

1. Risk: A derived core `randomUUIDv4` implementation prevents platforms from using optimized or standards-compliant native UUID generation.
   - Mitigation: Require full platform implementations and prohibit `make` from deriving UUIDs.
2. Risk: Browser `crypto.randomUUID` is unavailable in some environments.
   - Mitigation: Fallback to `getRandomValues` only in the browser platform implementation when CSPRNG bytes are available.
3. Risk: `DigestAlgorithm` string inputs invite typos or inconsistent algorithm spelling.
   - Mitigation: Use a top-level `Data.TaggedEnum` and centralize platform mapping.
4. Risk: Existing users rely on deterministic UUIDs from `Random.nextUUIDv4` in tests.
   - Mitigation: Document that deterministic IDs should be provided through a fake `Crypto` service or an explicit test service, not production `Random`.
5. Risk: Adding `Crypto` to service aggregators changes runtime layer composition.
   - Mitigation: Add focused Node/Bun service aggregation checks if existing tests cover service aggregates; otherwise rely on type checking and direct layer tests.

## Open Questions

1. Should `Random.nextUUIDv4` be removed immediately or deprecated for one release cycle?
2. Should `DigestAlgorithm` variants use PascalCase tags (`Sha256`) or exact algorithm tags (`"SHA-256"`) despite less ergonomic constructor access?
3. Should the first `Crypto` surface stay limited to `randomBytes`, `randomUUIDv4`, and `digest`, or should later work add HMAC, signing, verification, encryption, and key import/export?
