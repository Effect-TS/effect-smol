---
name: effect-migration
description: Migrate Effect TypeScript codebases from v3 to v4. Use when upgrading effect dependencies, fixing v4 type errors, rewriting dissolved package imports, converting Context.Tag/Schema/Effect/Layer APIs to v4 equivalents, or debugging runtime issues after migration. Triggers on effect v4 migration, effect upgrade, @effect/platform removal, Context.Tag to ServiceMap, Schema v4 changes, v3 to v4.
---

# Effect v3 → v4 Migration

## Navigation

```
What phase are you in?
├─ Planning the migration       → §1 Strategy
├─ Updating dependencies        → §2 Dependencies
├─ Rewriting imports            → §3 Imports (references/imports.md)
├─ Mechanical API renames       → §4 Renames (references/renames.md)
├─ Fixing type errors           → §5 Structural (references/structural.md)
├─ Debugging runtime issues     → §6 Gotchas (references/gotchas.md)
└─ Quick lookup of a specific API → references/renames.md tables
```

## Reference Index

| Topic | File | When to Read |
|-------|------|--------------|
| Import rewrites | `references/imports.md` | Rewriting `@effect/*` imports to `effect` / `effect/unstable/*` |
| API renames | `references/renames.md` | Mechanical find-replace of renamed APIs |
| Structural changes | `references/structural.md` | Type system changes, new patterns, removed APIs |
| Gotchas | `references/gotchas.md` | Runtime bugs, type inference traps, things that typecheck but break |

## §1 Strategy

### Execution Order

1. **Dependencies** — update package.json, remove dissolved packages, install
2. **Imports** — rewrite all `@effect/*` import paths
3. **Mechanical renames** — safe find-replace across codebase (parallelizable)
4. **Structural changes** — context-dependent rewrites
5. **Typecheck loop** — `tsc --noEmit`, fix, repeat
6. **Lint cleanup** — merge duplicate imports, fix unused vars
7. **Test** — run tests, fix runtime issues

### Parallelization

Phases 2–3 can run in parallel across independent categories:
- **Imports agent** — all import path rewrites
- **Schema agent** — TaggedError, Union, Literal, parseJson, encode/decode renames
- **Effect agent** — catchAll, fork, Layer, Cause renames
- **Services agent** — Context.Tag → ServiceMap.Service conversions

After all complete: Phase 4 (structural), then Phase 5 (typecheck loop).

### What to Expect

- Most errors are mechanical — ~80% fixed by find-replace
- Expect 3–5 typecheck iterations to reach zero errors
- Structural changes (Schema type system, Logger, Tracer) take the most time
- Import rewrites are tedious but straightforward

## §2 Dependencies

### Dissolved Packages (remove from all package.json)

```
@effect/platform        → import from "effect" or "effect/unstable/*"
@effect/sql             → import from "effect/unstable/sql"
@effect/rpc             → import from "effect/unstable/rpc"
@effect/cluster         → import from "effect/unstable/cluster"
@effect/cli             → import from "effect/unstable/cli"
@effect/experimental    → dissolved (features moved to effect core)
```

### Packages That Stay (update to matching v4 version)

```
effect
@effect/platform-bun
@effect/platform-node
@effect/sql-sqlite-bun
@effect/sql-pg
@effect/vitest
@effect/opentelemetry
@effect/ai-*
@effect/atom-*
```

### Steps

1. Update root `package.json` catalog/versions
2. Remove dissolved deps from every workspace `package.json`
3. Keep driver packages (`@effect/platform-bun`, `@effect/sql-sqlite-bun`, etc.)
4. Run `bun install` / `pnpm install`

## §3 Imports

See `references/imports.md` for the full rewrite table.

**Quick summary:**
- `@effect/platform` FileSystem/Path/PlatformError → `"effect"`
- `@effect/platform` Http*/Command → `"effect/unstable/http"`, `"effect/unstable/process"`
- `@effect/platform` HttpApi* → `"effect/unstable/httpapi"`
- `@effect/sql/*` → `"effect/unstable/sql"`
- `@effect/rpc` → `"effect/unstable/rpc"`
- `@effect/cluster` → `"effect/unstable/cluster"`
- `@effect/cli` → `"effect/unstable/cli"` (Options→Flag, Args→Argument)
- `BunContext` → `BunServices` (from `@effect/platform-bun`)

## §4 Renames

See `references/renames.md` for complete tables.

**Highest-volume renames:**
- `Effect.catchAll` → `Effect.catchEager` (careful: not catchAllCause)
- `Context.Tag("id")<Self, T>()` → `ServiceMap.Service<Self, T>()("id")`
- `Schema.TaggedError` → `Schema.TaggedErrorClass`
- `.annotations({` → `.annotate({` on all Schema types
- `Schema.decodeUnknown(` → `Schema.decodeUnknownEffect(`

## §5 Structural Changes

See `references/structural.md` for patterns requiring context.

**Critical changes:**
- `Schema.Schema<T, E, R>` → `Schema.Schema<T>` (1 param) or `Schema.Codec<T, E, RD, RE>`
- `Runtime.Runtime<R>` removed → `ServiceMap.ServiceMap<R>`
- `Runtime.runFork(rt)(eff)` → `Effect.runForkWith(services)(eff)`
- `Either` module removed → `Result` (Failure/Success instead of Left/Right)
- Logger/Tracer/Span interfaces completely rewritten

## §6 Gotchas

See `references/gotchas.md` for the full list.

**Top traps:**
1. `Effect.ignore` no longer catches defects — use `Effect.ignoreCause` for defects
2. `ServiceMap.Service` is NOT an `Effect` — can't `Tag.pipe(Effect.flatMap(...))`, use `.use(fn)` instead
3. `Fiber.poll(f)` removed — use `f.pollUnsafe()` (sync, returns `Exit | undefined`)
4. `PlatformError` is a namespace — use `PlatformError.PlatformError` for the type
5. `Config.option(Config.string("X"))` can't be piped with `Effect.catchEager` — yield first
6. `.annotations()` silently returns `any` in v4 — must use `.annotate()`
