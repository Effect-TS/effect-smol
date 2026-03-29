# Build Toolchain Modernization: tsdown / Rolldown / OXC / tsgo Migration

## Summary

Migrate the Effect monorepo build pipeline from its current **tsc + Babel + Rollup** stack to a unified **tsdown (unbundle mode) + Rolldown + OXC + tsgo** toolchain. The centerpiece is **tsdown 0.21.7** with `unbundle: true`, which produces 1:1 file output (`src/*.ts` -> `dist/*.js`) suitable for library packages -- not just CLI tools. This was not available when the original plan was written and fundamentally changes the migration strategy.

**Key outcomes:** Build time from ~60s to <20s, type check from ~30s to <5s, devDependencies from 35 to <25, Babel eliminated, native sourcemaps, OXC-powered `.d.ts` generation (40x faster), bundle sizes within 1%.

---

## Architecture: Before and After

### Current Pipeline

```
src/*.ts
  -> tspc -b tsconfig.packages.json   (compile + emit .js + .d.ts, serial per project ref)
  -> babel annotate-pure-calls        (post-process every .js file for /*#__PURE__*/)
  -> dist/*.js + dist/*.d.ts + dist/*.js.map + dist/*.d.ts.map

Bundle analysis (CI):
  Rollup 4 + @rollup/plugin-node-resolve + rollup-plugin-esbuild
  + @rollup/plugin-terser + @rollup/plugin-replace

Type checking:
  tspc -b tsconfig.json               (primary)
  tsgo -b tsconfig.json               (secondary, via check:tsgo)
```

### Target Pipeline

```
src/*.ts
  -> tsdown --unbundle                (OXC transform -> .js, rolldown-plugin-dts -> .d.ts)
                                      (pure annotations via manualPureFunctions / plugin)
                                      (native sourcemaps, no post-processing)
  -> dist/*.js + dist/*.d.ts + dist/*.js.map + dist/*.d.ts.map

Type checking (separate, no emit):
  tsgo --noEmit                       (10x faster Go-based checker)

Bundle analysis (CI):
  Rolldown                            (native Rust, built-in resolve + minify + OXC transform)
```

---

## Verified Tool Versions

| Tool | Version | Role |
|---|---|---|
| [tsdown](https://tsdown.dev/) | 0.21.7 | Library + tool package builds (brings rolldown automatically) |
| [rolldown](https://rolldown.rs/) | 1.0.0-rc.12 | Bundler engine (transitive via tsdown) + standalone for `@effect/bundle` |
| [rolldown-plugin-dts](https://github.com/sxzz/rolldown-plugin-dts) | ^0.23.2 | OXC-powered `.d.ts` generation within tsdown |
| [@typescript/native-preview](https://www.npmjs.com/package/@typescript/native-preview) | 7.0.0-dev.20260201.1 | Go-based type checker (tsgo), already installed |
| [oxc-parser](https://www.npmjs.com/package/oxc-parser) | ^0.121.0 | AST parsing for pure annotation analysis |

---

## Workstream Overview

| # | Workstream | Branch | Depends On | Phase |
|---|---|---|---|---|
| 1 | [tsdown Unbundle POC](#ws-1) | `build/tsdown-unbundle-poc` | -- | A |
| 2 | [Pure Annotation Strategy](#ws-2) | `build/pure-annotation-strategy` | -- | A |
| 3 | [isolatedDeclarations Enablement](#ws-3) | `build/isolated-declarations` | -- | A |
| 4 | [tsdown Full Rollout](#ws-4) | `build/tsdown-full-rollout` | WS1 + WS2 + WS3 | B |
| 5 | [Rolldown Bundle Tool](#ws-5) | `build/rolldown-bundle-tool` | -- | A |
| 6 | [tsgo Default Type Checker](#ws-6) | `build/tsgo-default` | -- | A |
| 7 | [Dependency Cleanup](#ws-7) | `build/dependency-cleanup` | WS4 + WS5 | C |
| 8 | [Tree-Shaking Audit](#ws-8) | `build/treeshake-audit` | WS4 + WS5 | C |

---

## Dependency Graph and Parallelism

```
Phase A (all independent, run in parallel):
  WS1: tsdown Unbundle POC           ████████
  WS2: Pure Annotation Strategy      ████████
  WS3: isolatedDeclarations          ████████
  WS5: Rolldown Bundle Tool          ████████
  WS6: tsgo Default Type Checker     ████████

Phase B (depends on Phase A convergence):
  WS4: tsdown Full Rollout           ░░░░░░░░████████████  (after WS1 + WS2 + WS3)

Phase C (final cleanup, depends on Phase B):
  WS7: Dependency Cleanup            ░░░░░░░░░░░░░░░░░░████████  (after WS4 + WS5)
  WS8: Tree-Shaking Audit            ░░░░░░░░░░░░░░░░░░████████  (after WS4 + WS5)
```

---

<a id="ws-1"></a>
## WS1: tsdown Unbundle POC

**Goal:** Validate that tsdown 0.21.7 with `unbundle: true` can replace the current `tsc -b && babel` pipeline for a representative library package.

**Branch:** `build/tsdown-unbundle-poc`
**Depends on:** Nothing (independent)

### Key Steps

1. Select `@effect/platform-browser` as the POC target (small scope, representative structure, has `sideEffects: []`)
2. Add `tsdown` as a devDependency, create `tsdown.config.ts` with `unbundle: true`:
   ```ts
   import { defineConfig } from "tsdown"
   export default defineConfig({
     entry: ["src/**/*.ts"],
     unbundle: true,
     format: "esm",
     dts: true,       // uses rolldown-plugin-dts internally
     sourcemap: true,
     clean: true,
   })
   ```
3. Validate output structure matches current `dist/` layout (file paths, module format, sourcemaps)
4. Diff JS output against current tsc + Babel baseline
5. Verify `exports` and `publishConfig.exports` fields resolve correctly with tsdown output
6. Run package tests: `pnpm test --filter @effect/platform-browser`
7. Run bundle fixture comparison to check tree-shaking parity

### Acceptance Criteria

- [ ] `tsdown --unbundle` produces 1:1 file output matching the current `dist/` directory structure
- [ ] ESM output is correct (`"type": "module"` compatibility)
- [ ] `.js`, `.d.ts`, `.js.map`, `.d.ts.map` all present and valid
- [ ] Sourcemaps resolve to correct `.ts` source lines
- [ ] Package tests pass
- [ ] Bundle fixture gzip sizes within 1% of baseline
- [ ] `publishConfig.exports` resolves correctly

---

<a id="ws-2"></a>
## WS2: Pure Annotation Strategy

**Goal:** Determine and implement the best approach for adding `/*#__PURE__*/` annotations without Babel, compatible with tsdown's build pipeline.

**Branch:** `build/pure-annotation-strategy`
**Depends on:** Nothing (independent)

### Approaches to Evaluate

| Approach | Description | Pros | Cons |
|---|---|---|---|
| `manualPureFunctions` | tsdown/rolldown built-in config option listing functions to annotate | Zero plugins, fully declarative | Must enumerate every function; maintenance burden; may not emit literal comments in output |
| `@__NO_SIDE_EFFECTS__` | JSDoc directive on function declarations in source | Works with all bundlers, permanent, no build tooling | Requires source code changes to every pure function; clutters source |
| Custom rolldown plugin | Plugin that walks AST during build and inserts annotations | Full control, equivalent behavior to Babel plugin | Must write and maintain the plugin |
| Post-build script | `scripts/annotate-pure.mjs` using `oxc-parser` (already prototyped on `build/oxc-pure-annotations`) | Decoupled from bundler, already tested | Extra build step, requires sourcemap rewrite via magic-string |

### Key Steps

1. Prototype each approach on the WS1 POC package (`@effect/platform-browser`)
2. Compare annotation output against current Babel baseline (file-by-file diff)
3. Measure bundle fixture sizes with each approach to validate tree-shaking
4. Test with multiple downstream bundlers (webpack, esbuild, rollup, rolldown) to confirm annotations are respected
5. Evaluate maintenance burden and compatibility with tsdown's plugin system
6. Select the winning approach and document the rationale
7. Implement across a representative set of packages

### Acceptance Criteria

- [ ] `/*#__PURE__*/` annotations placed at identical call sites as the Babel plugin
- [ ] Bundle fixture gzip sizes within 1% of baseline
- [ ] Approach integrates cleanly with tsdown's build pipeline (no separate post-build step preferred)
- [ ] Downstream bundlers (webpack, esbuild, rollup, rolldown) correctly eliminate unused imports
- [ ] Decision documented with rationale and trade-off analysis

---

<a id="ws-3"></a>
## WS3: isolatedDeclarations Enablement

**Goal:** Audit all package exports for explicit return types, enable `isolatedDeclarations: true` in `tsconfig.base.json`, and unlock OXC-powered `.d.ts` generation (40x faster via `rolldown-plugin-dts`).

**Branch:** `build/isolated-declarations`
**Depends on:** Nothing (independent)

### Background

OXC's `isolatedDeclarationSync()` generates `.d.ts` files per-file with no type-checker dependency. This requires every exported function, class, and variable to have an explicit return type annotation. Effect's strict tsconfig (`strict: true`, `noImplicitAny: true`, `verbatimModuleSyntax: true`) already enforces most of these, but an audit may reveal gaps.

### Key Steps

1. Enable `isolatedDeclarations: true` in `tsconfig.base.json` and run `tsgo -b` to identify all failures
2. Audit all 31 packages for exports with implicit return types (~403 files in `effect` core, ~200 files across other packages)
3. Add explicit return type annotations where missing (this is the bulk of the work)
4. Verify that `rolldown-plugin-dts` (^0.23.2) produces identical `.d.ts` output to tsc
5. Validate declaration maps (`.d.ts.map`) still support IDE go-to-definition
6. Verify `@internal` / `stripInternal` behavior is preserved
7. Run tstyche type-level tests to confirm no regressions

### Acceptance Criteria

- [ ] `isolatedDeclarations: true` enabled in `tsconfig.base.json` without errors
- [ ] All public API exports have explicit return type annotations
- [ ] OXC-emitted `.d.ts` files match tsc baseline (diff clean or documented divergences)
- [ ] Declaration maps work in VS Code (go-to-definition resolves to `.ts` source)
- [ ] `pnpm check:tsgo` passes
- [ ] tstyche type-level tests pass
- [ ] No behavioral changes to emitted code

---

<a id="ws-4"></a>
## WS4: tsdown Full Rollout

**Goal:** Migrate all 31 packages from `tsc -b && babel` to `tsdown --unbundle` as the build command.

**Branch:** `build/tsdown-full-rollout`
**Depends on:** WS1 (POC validated), WS2 (pure annotation strategy chosen), WS3 (isolatedDeclarations enabled)

### Packages (31 total)

| Group | Packages | Count |
|---|---|---|
| Core | `effect` | 1 |
| Platform | `@effect/platform-browser`, `@effect/platform-bun`, `@effect/platform-node`, `@effect/platform-node-shared` | 4 |
| SQL | `@effect/sql-clickhouse`, `@effect/sql-d1`, `@effect/sql-libsql`, `@effect/sql-mssql`, `@effect/sql-mysql2`, `@effect/sql-pg`, `@effect/sql-sqlite-bun`, `@effect/sql-sqlite-do`, `@effect/sql-sqlite-node`, `@effect/sql-sqlite-react-native`, `@effect/sql-sqlite-wasm` | 11 |
| AI | `@effect/ai-anthropic`, `@effect/ai-openai`, `@effect/ai-openai-compat`, `@effect/ai-openrouter` | 4 |
| Atom | `@effect/atom-react`, `@effect/atom-solid`, `@effect/atom-vue` | 3 |
| Other libs | `@effect/opentelemetry`, `@effect/vitest` | 2 |
| Tools | `@effect/ai-codegen`, `@effect/ai-docgen`, `@effect/bundle`, `@effect/openapi-generator`, `@effect/oxc`, `@effect/utils` | 6 |

### Key Steps

1. Create shared tsdown base configuration with `unbundle: true`, the pure annotation strategy from WS2, and `rolldown-plugin-dts`
2. Migrate packages in waves, validating each before proceeding:
   - **Wave 1:** Platform packages (4) + Atom packages (3) -- smallest, fewest dependencies
   - **Wave 2:** SQL packages (11) + AI packages (4) -- medium complexity, similar structure
   - **Wave 3:** `effect` core + `@effect/opentelemetry` + `@effect/vitest` -- largest, most complex types
   - **Wave 4:** Tool packages (6) -- may need bundled output for CLI binaries
3. Update root `package.json` build script to remove the global `tspc -b` / `tsgo -b` compilation step (tsdown handles compilation per-package)
4. Validate each wave: `pnpm test`, bundle fixture comparison, `.d.ts` diff
5. Update CI workflows to use the new build command

### Acceptance Criteria

- [ ] `pnpm build` completes successfully for all 31 packages using tsdown
- [ ] No `tsc -b`, `tsgo -b`, or `babel` in any package-level build script
- [ ] All tests pass on Node, Deno, and Bun
- [ ] Bundle fixture gzip sizes within 1% of baseline
- [ ] `.d.ts` output matches tsc baseline
- [ ] `publishConfig.exports` resolves correctly for all packages
- [ ] Sourcemaps present and valid
- [ ] Build wall-clock time <20s

---

<a id="ws-5"></a>
## WS5: Rolldown Bundle Tool

**Goal:** Replace Rollup + esbuild + Terser + node-resolve in `@effect/bundle` with Rolldown's native bundler.

**Branch:** `build/rolldown-bundle-tool`
**Depends on:** Nothing (independent)

### Dependencies Changed

| Removed | Current Role | Replaced By |
|---|---|---|
| `rollup` | Bundler | `rolldown` built-in |
| `rollup-plugin-esbuild` | JS/TS transformation | Rolldown built-in OXC transform |
| `@rollup/plugin-terser` | Minification | Rolldown built-in `output.minify` |
| `@rollup/plugin-node-resolve` | Module resolution | Rolldown built-in resolution |
| `@rollup/plugin-replace` | Environment replacement | Rolldown built-in `define` |

| Added | Role |
|---|---|
| `rolldown` | Native Rust bundler, Rollup-compatible API |

### Key Steps

1. Add `rolldown` to `packages/tools/bundle/package.json`
2. Rewrite `Rollup.ts` -> `Rolldown.ts` using Rolldown's JS API:
   - `rolldown.rolldown()` replaces `rollup.rollup()`
   - `output.minify: true` replaces Terser plugin
   - Built-in module resolution replaces `@rollup/plugin-node-resolve`
   - Built-in OXC transform replaces `rollup-plugin-esbuild`
   - Built-in `define` replaces `@rollup/plugin-replace`
3. Simplify `Plugins.ts` -- keep only `createResolveLocalPackageImports` (custom workspace resolution) and `rollup-plugin-visualizer`
4. Update `Cli.ts` and `Reporter.ts` module references
5. Run baseline comparison on all 29 fixtures; document any size deltas

### Acceptance Criteria

- [ ] `pnpm --filter @effect/bundle compare` produces valid stats
- [ ] All 29 fixture gzip sizes within 2% of Rollup baseline (minifier differences expected)
- [ ] CI bundle comparison workflow (`bundle-comment.yml`) runs successfully
- [ ] `pnpm --filter @effect/bundle visualize` produces valid HTML report
- [ ] `pnpm --filter @effect/bundle report` output format unchanged

---

<a id="ws-6"></a>
## WS6: tsgo Default Type Checker

**Goal:** Promote `tsgo` from secondary (`check:tsgo`) to the primary type-check command. Already installed as `@typescript/native-preview` 7.0.0-dev.20260201.1.

**Branch:** `build/tsgo-default`
**Depends on:** Nothing (independent)

### Key Steps

1. Verify tsgo parity: run full type-check, diff diagnostics against tsc output
2. Swap script names in root `package.json`:
   - `"check"` -> `tsgo -b tsconfig.json` (primary)
   - `"check:tsc"` -> `tspc -b tsconfig.json` (fallback)
3. Update CI workflows (`.github/workflows/check.yml`) to use tsgo by default
4. Keep tsc as `check:tsc` fallback for debugging or compatibility
5. Update contributing documentation to recommend tsgo

### Acceptance Criteria

- [ ] `pnpm check` runs tsgo across all packages
- [ ] `pnpm check:tsc` works as fallback
- [ ] CI check job passes with tsgo
- [ ] Type-check duration reduced to <5s (from ~30s)
- [ ] All tstyche type-level tests pass
- [ ] Zero type errors

---

<a id="ws-7"></a>
## WS7: Dependency Cleanup

**Goal:** Remove all build dependencies made obsolete by WS1-WS6. This is the final consolidation step.

**Branch:** `build/dependency-cleanup`
**Depends on:** WS4 (tsdown full rollout), WS5 (Rolldown bundle tool)

### Dependencies to Remove (11 packages)

| Package | Current Role | Replaced By |
|---|---|---|
| `@babel/cli` | Babel CLI for post-compile annotation | tsdown (annotations integrated) |
| `@babel/core` | Babel runtime | tsdown |
| `@babel/plugin-transform-export-namespace-from` | Babel plugin for namespace re-exports | tsdown / rolldown handles natively |
| `@babel/plugin-transform-modules-commonjs` | CJS output for tool packages | tsdown handles CJS natively |
| `babel-plugin-annotate-pure-calls` | Pure-call annotation | WS2 strategy (integrated in tsdown) |
| `ts-patch` | TypeScript plugin support (`tspc`) | tsgo (no patching needed) |
| `rollup` | Bundle tool bundler | `rolldown` (WS5) |
| `@rollup/plugin-node-resolve` | Bundle tool module resolution | Rolldown built-in |
| `@rollup/plugin-terser` | Bundle tool minification | Rolldown built-in |
| `rollup-plugin-esbuild` | Bundle tool JS transform | Rolldown built-in |
| `terser` | Standalone minifier | Rolldown built-in |

### Also Remove

- `scripts/annotate-pure.mjs` (if post-build approach is not selected in WS2)
- Per-package `babel` and `annotate` scripts from `package.json` files
- Any `.babelrc` or `babel.config.*` files

### Key Steps

1. Remove all listed packages from root and per-package `package.json` files
2. Remove Babel configuration files and annotation scripts
3. Remove `tspc` references from scripts (replaced by `tsgo`)
4. Run `pnpm install` and verify clean lockfile
5. Run full build + test suite

### Acceptance Criteria

- [ ] `pnpm ls --depth=0` shows none of the removed packages
- [ ] `pnpm-lock.yaml` is clean (no orphaned references)
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes on Node, Deno, and Bun
- [ ] devDependency count reduced from 35 to <25

---

<a id="ws-8"></a>
## WS8: Tree-Shaking Audit

**Goal:** Verify bundle sizes are within tolerance after the full migration, and identify any tree-shaking regressions introduced by the toolchain change.

**Branch:** `build/treeshake-audit`
**Depends on:** WS4 (tsdown full rollout), WS5 (Rolldown bundle tool)

### Key Steps

1. Establish post-migration baseline: run all 29 fixtures with Rolldown bundle tool
2. Compare against pre-migration baseline (stored in CI)
3. Analyze any regressions using `pnpm --filter @effect/bundle visualize`
4. Add new fixtures for common consumer import patterns:
   - `import { Effect } from "effect"` (core only)
   - `import { Schema } from "effect/unstable"` (single module)
   - `import { HttpClient } from "effect/unstable"` (HTTP only)
5. Audit `sideEffects` field accuracy across all 31 packages
6. Test with multiple downstream bundlers (webpack, esbuild, rollup, rolldown) to confirm compatibility
7. Fix any identified regressions (missing annotations, side-effectful initialization, barrel re-export issues)
8. Update baseline and document improvements

### Acceptance Criteria

- [ ] All 29 existing fixtures produce gzip sizes within 1% of pre-migration baseline
- [ ] New consumer-pattern fixtures added and baselined
- [ ] `sideEffects` fields validated against actual module behavior
- [ ] No runtime regressions from any tree-shaking fixes
- [ ] Updated baseline checked into CI
- [ ] Downstream bundler compatibility confirmed (webpack, esbuild, rollup, rolldown)

---

## Risk Register

| Risk | WS | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| tsdown `unbundle` mode does not handle Effect's `exports` map correctly | WS1 | Medium | High | POC on small package first; fallback to tsc + post-build script |
| `manualPureFunctions` does not emit literal `/*#__PURE__*/` comments in output | WS2 | Medium | Medium | Four approaches evaluated in parallel; post-build script already prototyped as fallback |
| `isolatedDeclarations` audit reveals widespread missing return types | WS3 | Medium | Medium | Effect's strict tsconfig already requires most annotations; incremental fixes are mechanical |
| OXC `.d.ts` output diverges from tsc for complex Effect generics | WS3 | Low | High | File-by-file diff against tsc baseline; keep tsc as fallback emitter |
| tsdown 0.21.x has breaking changes before WS4 completes | WS4 | Medium | Medium | Pin exact version in `package.json`; monitor changelog |
| Rolldown minifier produces different output sizes than Terser | WS5 | Low | Low | 2% size tolerance; internal tool only, no consumer impact |
| tsgo has edge-case type-check differences from tsc | WS6 | Low | Medium | tsc kept as `check:tsc` fallback; full test suite validates |
| Removing `ts-patch` breaks `@effect/language-service` plugin | WS7 | Low | Medium | Test language-service independently before removal |
| rolldown 1.0.0-rc.12 stability in production builds | WS4 | Low | High | Extensive testing in POC phase; pin version; keep tsc as emergency fallback |

---

## Success Metrics

| Metric | Current | Target | How to Measure |
|---|---|---|---|
| `pnpm build` wall-clock time | ~60s | <20s | CI build job duration |
| `pnpm check` wall-clock time | ~30s | <5s | CI check job duration (tsgo) |
| `.d.ts` emit duration | ~15s (tsc, serial) | <1s (OXC, parallel) | Per-package build timing |
| Post-compile annotation step | ~8s (Babel) | 0s (integrated in tsdown) | Eliminated as separate step |
| Root devDependency count | 35 | <25 | `pnpm ls --depth=0 --dev` |
| Babel in dependency tree | Present | Absent | `pnpm ls babel` returns empty |
| Bundle fixture gzip sizes | Baseline | Within 1% | CI bundle comparison (`effect-bundle compare`) |
| Source maps | Babel-rewritten (composed) | Native (rolldown, single-pass) | Manual verification in debugger |
| Declaration generation speed | tsc serial (type-checker coupled) | OXC isolatedDeclarations (per-file, 40x faster) | `rolldown-plugin-dts` timing |

---

## Dependencies: Before and After

### Removed (11 packages)

```
@babel/cli
@babel/core
@babel/plugin-transform-export-namespace-from
@babel/plugin-transform-modules-commonjs
babel-plugin-annotate-pure-calls
ts-patch
rollup
@rollup/plugin-node-resolve
@rollup/plugin-terser
rollup-plugin-esbuild
terser
```

### Added (1 package)

```
tsdown   (brings rolldown + rolldown-plugin-dts transitively)
```

**Net change:** -11 packages, +1 package = **10 fewer build dependencies**

---

## Out of Scope

- Migrating `@effect/oxc` linting rules (already on OXC)
- Changing the dprint formatter
- Modifying the changesets release flow
- Vitest + Rolldown integration (deferred until Vitest officially supports Rolldown as a transform backend)

---

## References

- [tsdown](https://tsdown.dev/) -- TypeScript-first build tool built on Rolldown; `unbundle: true` available since v0.21.7
- [Rolldown](https://rolldown.rs/) -- Rust-based bundler with Rollup-compatible API
- [rolldown-plugin-dts](https://github.com/sxzz/rolldown-plugin-dts) -- OXC isolatedDeclarations plugin for tsdown/rolldown
- [OXC Project](https://oxc.rs/) -- Rust-based JS/TS toolchain (parser, transformer, linter)
- [@typescript/native-preview](https://www.npmjs.com/package/@typescript/native-preview) -- Go-based TypeScript compiler (tsgo)
- [oxc-parser](https://www.npmjs.com/package/oxc-parser) -- Standalone OXC parser for AST analysis
