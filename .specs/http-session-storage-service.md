# HTTP Session Service

## Overview

Add a new unstable HTTP session service module that manages cookie-based sessions on top of `Persistence`. The module provides session ID lifecycle management, request/response cookie handling helpers, and typed item storage through a new `HttpSession.key(...)` data type.

This design integrates with `HttpApiSecurity` by using `HttpApiSecurity.apiKey({ in: "cookie" })` (no new security kind), and adds dedicated helpers for session cookie set/clear behavior.

## Request Context + Decisions

- Backing store: `Persistence` service.
- Session cookie default name: `sid`.
- Session ID type: branded `Redacted<string>` (`SessionId`), generated via `crypto.randomUUID()` by default.
- `HttpApiSecurity` integration: use `HttpApiSecurity.apiKey` with cookie location.
- Storage item API: new yieldable key type (`HttpSession.key`) instead of exposing raw `Persistable` items directly.
- Expiration strategy: align with Better Auth session model:
  - `expiresIn` absolute window (default 7 days).
  - `updateAge` refresh threshold (default 1 day).
  - Session refresh can be disabled.

## Goals

- Provide an HTTP session service that is idiomatic for Effect unstable modules.
- Handle session cookie read/set/clear and session ID generation/rotation.
- Use `Persistence.make` and a distinct `storeId` per session.
- Provide typed session key APIs (`HttpSession.key`) for get/set/remove.
- Provide `HttpApiSecurity` helpers for session-cookie security setup.
- Keep defaults secure and browser-compatible.

## Non-Goals

- Implement full auth/user account flows.
- Add a new `HttpApiSecurity` security type.
- Add cross-device session revocation APIs.
- Add background cleanup daemons for orphaned per-session stores.

## Constraints / Existing Architecture

- `HttpApiBuilder.securitySetCookie` already supports `ApiKey` cookies.
- `Persistence` has key-level TTL but no key enumeration; extending TTL for all existing keys is not directly available.
- `Persistable` remains the underlying typed persistence mechanism, but HttpSession should expose an HTTP-session specific key abstraction.

## Module

### File

- `packages/effect/src/unstable/http/HttpSession.ts`

### Public service

The service is split into two layers:

1. A low-level `HttpSession` service with typed key storage operations (`get`, `set`, `remove`, `clear`) and the resolved `id`.
2. Session lifecycle methods that operate on top of `HttpSession` and manage cookie state.

Low-level service (implemented):

```ts
export class HttpSession extends ServiceMap.Service<HttpSession, {
  readonly id: SessionId
  readonly get: <S extends Schema.Top>(
    key: Key<S>
  ) => Effect.Effect<Option.Option<S["Type"]>, HttpSessionError, S["DecodingServices"]>
  readonly set: <S extends Schema.Top>(
    key: Key<S>,
    value: S["Type"]
  ) => Effect.Effect<void, HttpSessionError, S["EncodingServices"]>
  readonly remove: <S extends Schema.Top>(key: Key<S>) => Effect.Effect<void, HttpSessionError>
  readonly clear: Effect.Effect<void, HttpSessionError>
}>()("effect/http/HttpSession") {}
```

Session lifecycle methods (not yet implemented):

```ts
readonly rotate: Effect.Effect<void, HttpSessionError>
```

Maybe make `id` a MutableRef so it can be updated on rotation without requiring
callers to re-resolve the service.

### Session key data type

```ts
type KeyTypeId = "~effect/http/HttpSession/Key"

export interface Key<S extends Schema.Top>
  extends
    Persistable.Persistable<S, Schema.Never>,
    Effect.Yieldable<Key<S>, Option.Option<S["Type"]>, HttpSessionError, HttpSession | S["DecodingServices"]>,
    PrimaryKey.PrimaryKey
{
  readonly [KeyTypeId]: KeyTypeId
  readonly id: string

  readonly getOrFail: Effect.Effect<S["Type"], HttpSessionError, HttpSession | S["DecodingServices"]>
  readonly set: (value: S["Type"]) => Effect.Effect<void, HttpSessionError, HttpSession | S["EncodingServices"]>
  readonly remove: Effect.Effect<void, HttpSessionError, HttpSession>
}

export const key: <S extends Schema.Top>(options: {
  readonly id: string
  readonly schema: S
}) => Key<S>
```

Design notes:

- Base key shape: `Persistable` + `PrimaryKey` + `TypeId` + stable `id`.
- `HttpSession.key(...)` returns this object directly, including read/write operations.
- `yield* key` returns `Option.Option<S["Type"]>` via `session.get(key)`.
- `key.getOrFail` fails with `HttpSessionError(KeyNotFound)` when absent.
- Key operations are effectful in `HttpSession` context and fail with `HttpSessionError`.
- `Yieldable` signature threads `S["DecodingServices"]` and `S["EncodingServices"]` through key operations.

### Constructors / helpers

- `make(options): Effect.Effect<HttpSession["Service"], E, R | Persistence.Persistence | Scope>` — creates the session service by resolving a session ID and opening a persistence store.
  ```ts
  export const make: <E, R>(options: {
    readonly getSessionId: Effect.Effect<Option.Option<SessionId>, E, R>
    readonly timeToLive?: Duration.DurationInput | undefined
    readonly generateSessionId?: Effect.Effect<SessionId> | undefined
  }) => Effect.Effect<HttpSession["Service"], E, R | Persistence.Persistence | Scope>
  ```
- `setCookie(response, options?): Effect.Effect<HttpServerResponse, never, HttpSession>` — dual API, reads `session.id` from context and sets it as cookie value.
- `clearCookie(options?: Cookie["options"]): Effect.Effect<void>`
  - Set expired cookie / `maxAge: 0`.

Request-scoping contract:

- `make` resolves the session ID at construction time from `getSessionId`. If `None`, falls back to `generateSessionId` (default: `crypto.randomUUID()`).
- `make` opens a `Persistence` store scoped to the resolved session ID.
- Key operations (`yield* key`, `key.set`, `key.remove`) require `HttpSession` in context, not direct `Persistence` access by callers.

## Options

### `make` options (implemented)

```ts
{
  readonly getSessionId: Effect.Effect<Option.Option<SessionId>, E, R>
  readonly timeToLive?: Duration.DurationInput // default: 30 minutes
  readonly generateSessionId?: Effect.Effect<SessionId> // default: crypto.randomUUID()
}
```

### `setCookie` options (implemented)

```ts
{
  readonly name?: string      // default: "sid"
  readonly path?: string
  readonly domain?: string
  readonly secure?: boolean   // default: true
  readonly httpOnly?: boolean // default: true
}
```

### Full options (not yet implemented)

The following extended options are planned for HttpSession.make

```ts
export interface Options {
  readonly cookieName?: string // default: "sid"
  readonly cookie?: {
    readonly secure?: boolean // default true
    readonly httpOnly?: boolean // default true
    readonly sameSite?: "lax" | "strict" | "none" // default "lax"
    readonly path?: string // default "/"
    readonly domain?: string | undefined
  }
  readonly storage?: {
    readonly storePrefix?: string // default: "session"
  }
  readonly session?: {
    readonly expiresIn?: Duration.DurationInput // default 7 days
    readonly updateAge?: Duration.DurationInput // default 1 day
    readonly disableRefresh?: boolean // default false
  }
  readonly sessionId?: {
    readonly generate?: Effect.Effect<SessionId> // default crypto.randomUUID()
  }
}
```

## Storage Model

### Store partitioning

- Per-session store id format: `session:${sessionId}` (configurable via `storePrefix`).
- Session data entries are stored in that per-session `PersistenceStore`.
- `Persistence.make` is opened lazily in request scope (or cached per request only), never retained in an unbounded global map.

### Session metadata key

Use a dedicated `Persistable` metadata key in each per-session store:

- key: `SessionMeta` with fixed primary key `"meta"`
- value schema fields:
  - `createdAt` (epoch millis)
  - `expiresAt` (epoch millis)
  - `lastRefreshedAt` (epoch millis)

The metadata key is authoritative for session validity. Data reads/writes require valid metadata.

### Expiration semantics

- On first session creation (`HttpSession.make` path), write metadata with `expiresAt = now + expiresIn`.
- Session is expired when `now >= expiresAt`.
- Refresh threshold is `now - lastRefreshedAt >= updateAge`.
- If refresh enabled and threshold reached, refresh metadata (`expiresAt = now + expiresIn`, `lastRefreshedAt = now`) and append refreshed cookie in response.
- If configured `updateAge > expiresIn`, clamp `updateAge = expiresIn`.

Note on `Persistence` TTL constraints:

- Key-level TTL cannot be uniformly extended for all existing session data keys due missing key enumeration.
- Session validity is enforced by metadata key, not by guaranteed synchronized TTL of every stored item.
- Session data writes use bounded TTL `max(0, expiresAt - now)` to track current session horizon and reduce stale orphan data.

## Cookie and HTTP behavior

- `HttpSession.make` behavior:
  - if valid session id and metadata valid, return id.
  - if missing/invalid/expired, generate UUID v4, initialize metadata
- `rotate` behavior:
  - create new session id + metadata.
  - clear old session store best-effort.
- `clear` behavior:
  - clear current per-session store best-effort.

## HttpApiSecurity Integration

No new `HttpApiSecurity` union member.

### Implemented helpers

The following integration helpers exist in `unstable/httpapi`:

- `HttpApiMiddleware.HttpSession<Self>()(id, { security })` — convenience class factory for creating session middleware that provides `HttpSession` via a security scheme (`Bearer` or `ApiKey`):
  ```ts
  class SessionMiddleware extends HttpApiMiddleware.HttpSession<SessionMiddleware>()("SessionMiddleware", {
    security: HttpApiSecurity.apiKey({ key: "sid", in: "cookie" })
  }) {}
  ```

- `HttpApiBuilder.securityMakeSession(security, options?)` — creates an `HttpSession` service from a security scheme by decoding the cookie/bearer value into a `SessionId`. Maps empty decoded value to `Option.none()` and delegates to `HttpSession.make`.

- `HttpApiBuilder.middlewareHttpSession(service, options?)` — creates a `Layer` for a session middleware service, wiring `Persistence` and security decoding together:
  ```ts
  const SessionLive = HttpApiBuilder.middlewareHttpSession(SessionMiddleware)
  ```

Unimplemented: middlewareHttpSession should set or update the session cookie on
outgoing responses.

## Error Model

`HttpSessionError` tagged error wrapping specific reason types:

```ts
export class HttpSessionError extends Data.TaggedError("HttpSessionError")<{
  readonly reason: PersistenceError | KeyNotFound | Schema.SchemaError
}> {}

export class KeyNotFound extends Data.TaggedError("KeyNotFound")<{
  readonly key: Key<Schema.Top>
}> {}
```

Error sources:

- `key.getOrFail`: `KeyNotFound` when key absent in session store.
- `rotate` (planned): invalid current session when strict rotation path is used.
- Persistence/schema failures wrapped as `HttpSessionError`.

## API Usage Example (target shape)

```ts
import { HttpSession } from "effect/unstable/http"
import { HttpApiBuilder, HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi"

// Define typed session keys
const CurrentUserId = HttpSession.key({
  id: "userId",
  schema: Schema.String
})

// Use keys in effects
Effect.gen(function*() {
  const userId = yield* CurrentUserId // Option<string>
  const required = yield* CurrentUserId.getOrFail // string (or fail)
  yield* CurrentUserId.set("123")
  yield* CurrentUserId.remove
})

// Define session middleware via HttpApi integration
class SessionMiddleware extends HttpApiMiddleware.HttpSession<SessionMiddleware>()("SessionMiddleware", {
  security: HttpApiSecurity.apiKey({ key: "sid", in: "cookie" })
}) {}

const SessionLive = HttpApiBuilder.middlewareHttpSession(SessionMiddleware)
```

## Files Expected to Change (implementation phase)

- `packages/effect/src/unstable/http/HttpSession.ts` (exists)
- `packages/effect/src/unstable/http/index.ts` (barrel export via `pnpm codegen`, not manual edit)
- `packages/effect/src/unstable/httpapi/HttpApiMiddleware.ts` (exists — `HttpSession` factory)
- `packages/effect/src/unstable/httpapi/HttpApiBuilder.ts` (exists — `securityMakeSession`, `middlewareHttpSession`)
- `packages/effect/test/unstable/http/` (new tests)
- `packages/effect/test/unstable/http/HttpSession.test.ts` (new)

## Detailed Implementation Plan

### Task 1: Add public scaffold + export wiring ✅

Completed. `HttpSession.ts` exists with:

- `HttpSession` service class with `id`, `get`, `set`, `remove`, `clear`.
- `Key<S>` type + `HttpSession.key(...)` constructor.
- `HttpSession.make(...)` constructor.
- `setCookie` dual response helper.
- `HttpSessionError` + `KeyNotFound` error types.
- `SessionId` branded type.

Integration helpers also exist:

- `HttpApiMiddleware.HttpSession` factory.
- `HttpApiBuilder.securityMakeSession` + `middlewareHttpSession`.

### Task 2: Implement session lifecycle + persistence metadata

- Implement session lifecycle methods: `rotate`
- Add `SessionMeta` persistable model and initialization logic.
- Implement request cookie extraction for lifecycle methods.
- Enforce metadata validity and expiration checks.
- Implement refresh logic with `expiresIn` / `updateAge` / `disableRefresh`.
- Wire pre-response cookie setting/clearing.
- Add `clearCookie` response helper.
- Add `sameSite` and `path` options to cookie helpers.

- Add lifecycle tests: missing/invalid/expired cookie, metadata missing/corrupt, refresh boundary, rotate, clear.

Shippable state:

- Session IDs and validity semantics are fully enforced with persistence-backed metadata.

Validation for task:

- `pnpm lint-fix`
- `pnpm test packages/effect/test/unstable/http/HttpSession.test.ts`
- `pnpm check` (with `pnpm clean` fallback)
- `pnpm build`
- `pnpm docgen`

### Task 3: Add tests for existing functionality + typed session item operations

- Add `packages/effect/test/unstable/http/HttpSession.test.ts`.
- Cover existing: key creation, `yield* key` behavior, `getOrFail` on absent key, `set`/`remove` round-trip, `clear`, `setCookie` helper.
- Cover existing: `HttpApiMiddleware.HttpSession` + `HttpApiBuilder.middlewareHttpSession` integration.
- Add tests for typed round-trip, absent key (`Option.none`), decode failure propagation, and expired-session behavior.

Shippable state:

- Applications can read/write typed session items using `Persistable`.

Validation for task:

- `pnpm lint-fix`
- `pnpm test packages/effect/test/unstable/http/HttpSession.test.ts`
- `pnpm check` (with `pnpm clean` fallback)
- `pnpm build`
- `pnpm docgen`

### Task 4: Add integration hardening + docs/jsdoc examples

- Add coverage that session security uses `HttpApiSecurity.apiKey({ in: "cookie" })`.
- Add tests for cookie helper behavior parity with existing patterns.
- Add tests for clear-cookie path/domain matching behavior.
- Add jsdoc examples for `HttpSession.key`, `HttpSession.make`, `HttpSession.setCookie`.
- Add jsdoc examples for `HttpApiMiddleware.HttpSession`, `HttpApiBuilder.middlewareHttpSession`.

Shippable state:

- Integration path is verified and documented.

Validation for task:

- `pnpm lint-fix`
- `pnpm test packages/effect/test/unstable/http/HttpSession.test.ts`
- `pnpm check` (with `pnpm clean` fallback)
- `pnpm build`
- `pnpm docgen`

## Acceptance Criteria

- `HttpSession` module exists with service + helpers. ✅
- `HttpSession.make` resolves session ID from caller-provided effect, falling back to generation. ✅
- Session storage is backed by `Persistence` and separated by per-session `storeId` (`session:${sessionId}`). ✅
- Session item definitions use `HttpSession.key({ id, schema })`. ✅
- Keys are yieldable (`yield* key`) and support `.getOrFail`, `.set(value)`, and `.remove`. ✅
- `Persistable` is used internally as storage encoding mechanism. ✅
- `HttpApiSecurity` integration is via `apiKey` cookie scheme. ✅
- `HttpApiMiddleware.HttpSession` and `HttpApiBuilder.middlewareHttpSession` provide middleware wiring. ✅
- `setCookie` sets session ID as cookie with secure defaults. ✅
- `ensureSessionId` is idempotent for repeated calls in one request.
- `clearSession` clears cookie even if store cleanup fails.
- Refresh updates metadata and outgoing cookie when threshold is reached.
- Tests cover lifecycle, persistence operations, and integration behavior.

## Risks + Mitigations

- TTL synchronization limits in `Persistence` can leave stale data keys.
  - Mitigation: metadata-authoritative validity + bounded data key TTL + best-effort clear on logout/rotation.
- Cookie behavior differences across local HTTP vs HTTPS.
  - Mitigation: expose cookie options; document `secure` override for local dev.
- Session fixation concerns.
  - Mitigation: explicit `rotateSessionId` API and recommendation to rotate on privilege changes.

## Open Questions Resolved

- Cookie name: `sid`.
- Session ID type: branded `Redacted<string>` (`SessionId`).
- Session ID generation: `crypto.randomUUID()`.
- Security integration: `HttpApiSecurity.apiKey` cookie mode, with `HttpApiMiddleware.HttpSession` factory.
- Expiration model: Better Auth style (`expiresIn`, `updateAge`, optional refresh disable) — planned, not yet implemented. Current implementation uses simple `timeToLive` (default 30 minutes) on the persistence store.
