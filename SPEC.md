# Effect Native Router (Unstable)

## Summary

Build a headless, Effect-native router core with strict typing and Effect Schema for SerDe. Initial scope is browser-only route matching plus navigation state wiring via Effect Atom, with a React adapter built in `packages/atom/react`. The API design must align with Effect conventions and be future-proof for data loading, actions, SSR, devtools, and codegen.

## Reference code

- Tanstack Router: `.repos/tanstack-router`
- React Router: `.repos/react-router`

## Goals

- Provide an Effect-native routing core under `packages/effect/src/unstable/`.
- Strictly typed routes, params, and search using Effect Schema for SerDe.
- Browser routing with abstracted history for DI/testing.
- Headless core with adapters; React adapter first via atom-react.
- Idiomatic Effect usage: `Effect`, `Layer`, `Context`, `Ref/Atom`.
- Keep design open for SSR and data features without breaking core contracts.

## Non-goals (v1)

- SSR support and hydration.
- Data loaders, actions, revalidation, caching, prefetch, or transitions.
- File-based routing or code generation.
- Devtools.
- Relative navigation semantics.

## Research Notes (high level)

- TanStack Router: end-to-end type safety, schema-driven search params, nested routes, caching/prefetch, file-based routing with configurable conventions.
- React Router: route objects with loaders/actions/middleware, revalidation, error boundaries, typegen.
- Effect Atom: reactive state container with read/subscribe, can mount/refresh, supports Effect/Stream-backed atoms; good fit for router state and derivations.

## Design Considerations for Future SSR

- Avoid direct DOM access in core; browser integration via history adapter.
- Model the current location as an abstract `Location` (URL + basePath + state) so server can supply it.
- Keep route matching pure and deterministic (no side effects) to enable server precompute.
- Provide a way to serialize/deserialize router state if needed later.
- Keep adapter boundaries explicit so React SSR/hydration can wrap without re-architecture.

## Design Considerations for Future Data/Actions

- Keep route config extensible (extra fields, metadata).
- Preserve a place in the match result for per-route context/data slots.
- Allow middleware hooks in core to wrap navigation evaluation later.
- Keep navigation pipeline structured so load/act/revalidate can be inserted.

## Proposed Architecture

### Modules (new)

- `packages/effect/src/unstable/router/` (new folder)
  - `Router.ts` core router types and construction
  - `Route.ts` route definitions and tree utilities
  - `Match.ts` match results and matching algorithm
  - `History.ts` history abstraction + browser implementation
  - `Location.ts` URL parsing/formatting and search param SerDe
  - `Navigation.ts` navigation intent/result model
  - (no React adapter in core; see `packages/atom/react`)
  - `internal/*` helpers

### Core Concepts

- **Route**: typed node with HttpRouter-style path pattern (`/:param`, `/*`), optional children, and typed search params schema.
- **Router**: constructed from route tree + history adapter + config (basePath, trailing slash normalization).
- **Match**: computed list of matched routes with params/search decoded via Effect Schema.
- **Location**: parsed URL with pathname, search, hash, state.
- **Navigation**: intent (to, replace, state) and resolved result (next location + match).
- **State**: stored in Atom(s) with derived atoms for matches, params, search, etc.

### Typing and SerDe

- Use `Schema` to define search param and params codecs per route.
- Route definitions produce strongly typed params/search at compile time.
- Effect Schema handles all validation and SerDe for params/search and any future route data.
- Decoding failures are surfaced in Effect error channel (typed error type).

### History Abstraction

- Define `History` interface with `get`, `push`, `replace`, `listen`.
- Provide browser implementation using `history` API.
- Register history in `Layer` to allow DI/testing.

### Atom Integration

- Router runtime holds an Atom for current `Location`.
- Derived atoms for match results, params, and search.
- Atom subscriptions drive UI adapters without coupling core to React.

### Error Handling

- Use typed Effect errors for decode/match failures.
- No match resolves to a configured `NotFoundRoute` (TanStack-style).
- React adapter can surface errors via boundary components later.

### React Adapter (v1)

- Implement in `packages/atom/react` with minimal hooks: `useLocation`, `useMatches`, `useNavigate`.
- Context provider wiring router runtime and subscriptions via Atom.
- No data APIs yet.

## Open Questions

- None.

## Acceptance Criteria (v1)

- New unstable router core compiles and is type-safe.
- Browser history adapter + DI layer exists.
- Matching works for nested routes and path params.
- Search param SerDe uses Effect Schema with typed output.
- React adapter can render based on matches and navigate.

## Testing Strategy

- Unit tests for path matching and schema decode.
- Atom-driven state updates on navigation.
- React adapter tests for match rendering and navigation.

## Documentation

- Add minimal usage docs under `packages/effect/src/unstable/router` comments or a dedicated doc file if patterns exist.
- Keep public API doc comments concise.
