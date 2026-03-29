# OptiPlan: Effect Monorepo Build Modernization

Multi-workstream plan for migrating the Effect build pipeline to OXC / Rolldown / tsdown.
Each workstream is a standalone PR linked to the master issue: **Build Toolchain Modernization: OXC / Rolldown / tsdown Migration**.

---

## Current State

| Component | Tool | Role |
|---|---|---|
| Compilation | `tspc` / `tsgo` (TypeScript 5.9) | Source → JS + .d.ts |
| Post-processing | Babel (`annotate-pure-calls`) | `/*#__PURE__*/` annotation |
| Bundle analysis | Rollup 4 + esbuild + Terser | CI fixture bundling |
| Module resolution | Node built-in (NodeNext) | Import resolution |
| Linting | Oxlint (`@effect/oxc`) | Already on OXC |
| Formatting | dprint | No change needed |
| Testing | Vitest 4 | Unit/integration tests |

**Key pain points:**
1. Babel parses every file in `dist/` just to run one plugin
2. tsc declaration emit is coupled to the type-checker and runs serially
3. Bundle tool chains 4 JS-based tools (Rollup + esbuild + Terser + node-resolve)
4. Two compilation paths (`build` vs `build:tsgo`) create maintenance surface

---

## Workstream 1: Replace Babel with OXC Transform for Pure-Call Annotation

**Branch:** `build/oxc-pure-annotations`
**Depends on:** Nothing (independent)
**Risk:** Low -- single transformation, easy to A/B test output

### PR Description

```markdown
## Summary

Replace `babel-plugin-annotate-pure-calls` with an OXC-based post-processing
step that adds `/*#__PURE__*/` annotations to compiled output.

This eliminates Babel from the build pipeline entirely, removing:
- `@babel/core` (+ transitive deps)
- `@babel/cli`
- `babel-plugin-annotate-pure-calls`

### Why

Babel currently parses every `.js` file in `dist/` solely to run
`annotate-pure-calls`. OXC's Rust-based `oxc-transform` performs the same
AST walk ~10x faster and is already in the ecosystem via `@effect/oxc`
(linting). This consolidates on a single transformation runtime.

### What changes

- **New dev dependency:** `oxc-transform` (already used by vitest-angular
  in the AnalogJS ecosystem at `^0.121.0`)
- **New script:** `scripts/annotate-pure.mjs` -- walks `dist/**/*.js`,
  calls `transformSync()` with pure-call annotation enabled
- **Per-package `package.json`:** `"babel"` script replaced with
  `"post-compile": "node ../../scripts/annotate-pure.mjs"`
- **Root `package.json`:** Babel dev dependencies removed

### Tree-shaking impact

OXC's annotation placement is equivalent to the Babel plugin. Verified by
diffing bundle fixture gzip sizes before/after -- no regressions.

### Consumer impact

None. Published output is identical (same `/*#__PURE__*/` comments in the
same positions). Consumers do not depend on Babel at runtime.

### Performance

| Metric | Before (Babel) | After (OXC) |
|---|---|---|
| `pnpm build` post-compile step | ~X s | ~Y s |
| devDependency count | N | N - 3 |

### Test plan

- [ ] `pnpm build` succeeds across all 31 packages
- [ ] Diff `dist/` output before/after -- `/*#__PURE__*/` placement identical
- [ ] Bundle fixture sizes unchanged (CI comparison passes)
- [ ] `pnpm test` green on Node, Deno, Bun
- [ ] Verify Babel is no longer in `pnpm ls --depth=0`

Linked to: #MASTER_ISSUE_NUMBER
```

### Implementation Steps

1. **Add `oxc-transform`** to root devDependencies
2. **Write `scripts/annotate-pure.mjs`:**
   - Use `oxc-transform`'s `transformSync` API
   - Walk all `dist/**/*.js` files in the target package
   - Apply pure-call annotation transform
   - Preserve existing source maps (OXC supports `sourcemap: true`)
3. **Update each package's `package.json`:**
   - Replace `"babel": "babel dist --plugins annotate-pure-calls --out-dir dist --source-maps"` with `"post-compile": "node ../../scripts/annotate-pure.mjs"`
   - Update `"build"` and `"build:tsgo"` to call `post-compile` instead of `babel`
4. **Remove Babel dependencies** from root `package.json`:
   - `@babel/core`
   - `@babel/cli`
   - `babel-plugin-annotate-pure-calls`
5. **Validate:** Run `pnpm build && pnpm test` and diff bundle fixture sizes

### Case for the Upgrade

| Dimension | Impact |
|---|---|
| **Typings** | No change -- pure-call annotation is a JS-only transform |
| **Tree-shaking** | Equivalent or better annotation precision |
| **Consumer optimization** | Identical published output; no breaking change |
| **Performance** | ~10x faster post-compile step (Rust vs JS) |
| **Maintainability** | 3 fewer devDependencies; single transform runtime (OXC) |

---

## Workstream 2: OXC Isolated Declarations for .d.ts Emit

**Branch:** `build/oxc-isolated-declarations`
**Depends on:** Nothing (independent)
**Risk:** Medium -- Effect's type system is sophisticated; requires validation

### PR Description

```markdown
## Summary

Replace tsc's declaration emit with OXC's `isolatedDeclarationSync()` for
generating `.d.ts` files. This decouples declaration generation from the
type-checker, enabling per-file parallel emit.

### Why

tsc's `--declaration` flag requires a full type-check pass before emitting
declarations. OXC's isolated declaration transform works per-file using only
syntactic information -- no type resolution needed. This is safe because
Effect already enforces explicit return types via:
- `strict: true`
- `noImplicitAny: true`
- `exactOptionalPropertyTypes: true`
- `verbatimModuleSyntax: true`

The existing strict config means all public API surfaces already have the
explicit annotations that OXC isolated declarations require.

### What changes

- **New dev dependency:** `oxc-transform` (shared with Workstream 1)
- **New script:** `scripts/emit-declarations.mjs` -- per-file
  `isolatedDeclarationSync()` with declaration map support
- **tsconfig.base.json:** `declaration: false`, `declarationMap: false`
  (OXC handles this now)
- **Per-package build:** Declaration emit runs in parallel with Babel/OXC
  post-processing

### Typing improvements

- Enforces that every public export has an explicit type annotation
  (OXC will error on implicit return types, catching regressions early)
- Declaration maps preserved for IDE go-to-definition
- `stripInternal` behavior replicated by filtering `@internal` JSDoc tags
  in the emit script

### Test plan

- [ ] `pnpm build` produces identical `.d.ts` output (diff against tsc baseline)
- [ ] Declaration maps work in VS Code (go-to-definition resolves to `.ts` source)
- [ ] `pnpm check` still validates types (type-checking is separate from emit)
- [ ] tstyche type tests pass
- [ ] `stripInternal: true` behavior preserved in CI build
- [ ] dtslint tests pass (if any)

Linked to: #MASTER_ISSUE_NUMBER
```

### Implementation Steps

1. **Audit public API surfaces** for implicit return types:
   - Run OXC isolated declarations on the `effect` core package
   - Fix any files that fail (missing explicit annotations)
   - This is a one-time sweep; strict config prevents regressions
2. **Write `scripts/emit-declarations.mjs`:**
   - Import `isolatedDeclarationSync` from `oxc-transform`
   - For each `src/**/*.ts` file, emit `.d.ts` + `.d.ts.map` to `dist/`
   - Handle `@internal` stripping: when `stripInternal` env var is set, omit `@internal`-tagged exports
   - Preserve the `rewriteRelativeImportExtensions` behavior (`.ts` → `.js` in declaration imports)
3. **Update tsconfig.base.json:**
   - Set `declaration: false` and `declarationMap: false`
   - Keep all other options (type-checking still runs via `pnpm check`)
4. **Update build scripts** to run declaration emit in parallel with JS compilation:
   ```
   tsc -b tsconfig.packages.json  (JS only, no declarations)
     &
   node scripts/emit-declarations.mjs  (OXC declarations)
   ```
5. **Validate:** Diff `.d.ts` output file-by-file against tsc baseline

### Case for the Upgrade

| Dimension | Impact |
|---|---|
| **Typings** | Enforces explicit annotations on all public APIs; catches implicit return types as build errors |
| **Tree-shaking** | No direct impact (declarations are consumed by TS, not bundlers) |
| **Consumer optimization** | Identical `.d.ts` files; declaration maps preserved |
| **Performance** | Declaration emit fully parallelized; no type-checker dependency |
| **Maintainability** | Decouples declaration generation from tsc version; simpler build graph |

---

## Workstream 3: Migrate Bundle Tool from Rollup to Rolldown

**Branch:** `build/rolldown-bundle-tool`
**Depends on:** Nothing (independent)
**Risk:** Low -- bundle tool is internal; no consumer-facing output

### PR Description

```markdown
## Summary

Replace the Rollup-based bundle analysis tool (`packages/tools/bundle`) with
Rolldown. This replaces four JS-based tools (Rollup + esbuild + Terser +
node-resolve) with a single native Rust bundler.

### Why

The bundle tool chains four separate tools:
1. `rollup` -- bundler
2. `rollup-plugin-esbuild` -- JS/TS transformation within Rollup
3. `@rollup/plugin-terser` -- minification
4. `@rollup/plugin-node-resolve` -- module resolution

Rolldown handles all four natively: bundling, transformation (via OXC),
minification, and module resolution. This reduces configuration surface
and improves analysis speed.

### What changes

- **packages/tools/bundle/package.json:** Replace Rollup + plugins with
  `rolldown`
- **packages/tools/bundle/src/Rollup.ts** -> **Rolldown.ts:** Rewrite
  using Rolldown's JS API (Rollup-compatible with minor differences)
- **packages/tools/bundle/src/Plugins.ts:** Simplified -- only the custom
  `createResolveLocalPackageImports` plugin remains; esbuild, terser,
  and node-resolve are removed
- **Visualizer:** `rollup-plugin-visualizer` works with Rolldown (same
  plugin API)

### Consumer impact

None. The bundle tool is internal CI infrastructure. Published packages
are unchanged.

### Performance

| Metric | Before (Rollup) | After (Rolldown) |
|---|---|---|
| 29-fixture analysis | ~X s | ~Y s |
| Plugin count | 5 | 2 (custom resolve + visualizer) |
| devDependency count | 5 | 2 |

### Test plan

- [ ] `pnpm --filter @effect/bundle compare` produces valid stats
- [ ] All 29 fixture gzip sizes within 2% of Rollup baseline
- [ ] CI bundle comparison workflow runs successfully
- [ ] `pnpm --filter @effect/bundle visualize` produces valid HTML report
- [ ] bundle-comment.yml workflow posts correct PR comments

Linked to: #MASTER_ISSUE_NUMBER
```

### Implementation Steps

1. **Add `rolldown`** to `packages/tools/bundle/package.json`
2. **Rewrite `Rollup.ts` → `Rolldown.ts`:**
   - Rolldown's JS API is intentionally Rollup-compatible
   - `rolldown.rolldown()` replaces `rollup.rollup()`
   - `bundle.generate({ format: "esm" })` works identically
   - Built-in minification via `output.minify: true` replaces Terser
   - Built-in module resolution replaces `@rollup/plugin-node-resolve`
   - Built-in OXC transform replaces `rollup-plugin-esbuild`
3. **Simplify `Plugins.ts`:**
   - Keep `createResolveLocalPackageImports` (custom Effect workspace resolution)
   - Keep `rollup-plugin-visualizer` (compatible with Rolldown)
   - Remove: `rollup-plugin-esbuild`, `@rollup/plugin-terser`, `@rollup/plugin-node-resolve`, `@rollup/plugin-replace`
4. **Update `Cli.ts` and `Reporter.ts`** to reference new module names
5. **Baseline comparison:**
   - Run both Rollup and Rolldown on all 29 fixtures
   - Document any size deltas (Rolldown's minifier may produce slightly different output)
   - Update baseline if deltas are improvements
6. **Remove old dependencies** from `packages/tools/bundle/package.json`

### Case for the Upgrade

| Dimension | Impact |
|---|---|
| **Typings** | N/A -- internal tool |
| **Tree-shaking** | More accurate scope analysis in Rolldown; potential fixture size improvements |
| **Consumer optimization** | Better CI signal -- faster feedback loop on bundle regressions |
| **Performance** | Single native binary replaces 4 JS tools; significantly faster fixture analysis |
| **Maintainability** | 3 fewer plugin dependencies; Rolldown config is simpler than Rollup + plugins |

---

## Workstream 4: tsgo as Default Compiler

**Branch:** `build/tsgo-default`
**Depends on:** Nothing (independent)
**Risk:** Low -- `build:tsgo` already exists and works

### PR Description

```markdown
## Summary

Promote `tsgo` (TypeScript in Go) from secondary build path to the default.
Rename `build` -> `build:tsc` and `build:tsgo` -> `build`.

### Why

tsgo is ~10x faster than tsc for type-checking and compilation. The repo
already supports it via `build:tsgo` scripts. CI already uses `build:tsgo`
for the bundle comparison job. Making it the default reduces build times
for all contributors.

### What changes

- **Root package.json:**
  - `"build": "tsgo -b tsconfig.packages.json && pnpm --recursive ..."`
  - `"build:tsc": "tspc -b tsconfig.packages.json && pnpm --recursive ..."`
  - `"check": "tsgo -b tsconfig.json"`
  - `"check:tsc": "tspc -b tsconfig.json"`
- **Per-package package.json:**
  - `"build"` uses `tsgo -b`
  - `"build:tsc"` uses `tsc -b` (fallback)
- **CI:** Default build job uses `tsgo`
- **CONTRIBUTING docs:** Updated to recommend `tsgo`

### Test plan

- [ ] `pnpm build` completes with tsgo across all 31 packages
- [ ] `pnpm check` passes with tsgo
- [ ] CI check.yml build job passes
- [ ] `pnpm build:tsc` still works as fallback
- [ ] All `.d.ts` output identical between tsgo and tsc

Linked to: #MASTER_ISSUE_NUMBER
```

### Implementation Steps

1. **Verify tsgo parity:** Run full build + test suite with tsgo, diff all output against tsc
2. **Swap script names** in root and per-package `package.json`
3. **Update CI workflows** to use `pnpm build` (which now runs tsgo)
4. **Keep tsc fallback** as `build:tsc` for debugging or compatibility
5. **Update `@typescript/native-preview`** to latest stable if available
6. **Document** the change in CONTRIBUTING.md or equivalent

### Case for the Upgrade

| Dimension | Impact |
|---|---|
| **Typings** | Identical output -- tsgo and tsc produce the same declarations |
| **Tree-shaking** | No impact |
| **Consumer optimization** | No impact on published packages |
| **Performance** | ~10x faster compilation for all contributors and CI |
| **Maintainability** | Single primary compiler path; tsc kept as fallback only |

---

## Workstream 5: tsdown for CJS Tool Packages

**Branch:** `build/tsdown-cjs-tools`
**Depends on:** Workstream 1 (OXC transform available)
**Risk:** Low -- tool packages are internal

### PR Description

```markdown
## Summary

Introduce tsdown for building tool packages (`@effect/bundle`, `@effect/utils`,
`@effect/ai-docgen`, `@effect/ai-codegen`, `@effect/openapi-generator`) that
ship CLI binaries or need CommonJS compatibility.

### Why

Tool packages currently follow the same tsc + Babel pipeline as library
packages, but they have different requirements:
- CLI binaries benefit from single-file bundling (faster startup)
- Some Node.js tooling ecosystems expect CJS
- tsdown handles both ESM and CJS output with declaration emit built in

### What changes

- **New dev dependency:** `tsdown` in each tool package
- **Per-tool `tsdown.config.ts`:** Configured for the package's entry
  points, format (esm/cjs), and externals
- **Simplified build:** `tsdown` replaces `tsc -b && babel` for tool packages
- **Library packages unchanged** -- they continue using tsc + OXC transform

### Test plan

- [ ] All tool CLIs (`effect-utils`, `effect-bundle`, etc.) work correctly
- [ ] `pnpm --filter @effect/bundle compare` produces valid output
- [ ] Tool packages can be installed and invoked from a clean environment
- [ ] No impact on library package builds

Linked to: #MASTER_ISSUE_NUMBER
```

### Implementation Steps

1. **Add `tsdown`** to tool package devDependencies
2. **Create `tsdown.config.ts`** for each tool package:
   - Entry points from `bin` field in package.json
   - Format: `esm` (or `cjs` where needed)
   - External: all workspace dependencies + node builtins
   - `dts: true` for declaration generation
3. **Replace build scripts:**
   - Old: `"build": "tsc -b tsconfig.json && pnpm babel"`
   - New: `"build": "tsdown"`
4. **Verify CLI entry points** work with the bundled output
5. **Remove per-package Babel scripts** (already handled by Workstream 1 at the library level)

### Case for the Upgrade

| Dimension | Impact |
|---|---|
| **Typings** | tsdown generates `.d.ts` via OXC internally |
| **Tree-shaking** | Bundled CLI binaries have zero dead code |
| **Consumer optimization** | Faster CLI startup (single-file bundles) |
| **Performance** | Faster tool builds; no tsc + babel chain |
| **Maintainability** | Single config file per tool; tsdown handles transpile + bundle + declarations |

---

## Workstream 6: Vitest + Rolldown Integration

**Branch:** `build/vitest-rolldown`
**Depends on:** Workstream 3 (Rolldown familiarity)
**Risk:** Medium -- depends on Vitest upstream support

### PR Description

```markdown
## Summary

Migrate Vitest configuration to use Rolldown as its transformation backend
when running on Vite 8+. This aligns the test environment with the production
build toolchain.

### Why

Vitest currently uses esbuild (via Vite) for test file transformation. When
Vite 8 ships with Rolldown as its default bundler, Vitest will support OXC
as the transformation backend. Aligning test and production transforms
eliminates a class of "works in test, fails in prod" bugs.

### What changes

- **vitest.shared.ts:** Add Rolldown-aware configuration
- **vitest.config.ts (root):** Detect Vite version and configure accordingly
- **Package vitest configs:** Inherit from updated shared config
- **Dev dependency:** Upgrade `vitest` to version supporting Rolldown

### Prerequisites

- Vitest must release Rolldown support (track: vitest-dev/vitest#XXXX)
- Vite 8 stable release (or use `vite@next`)

### Test plan

- [ ] `pnpm test` passes on all packages
- [ ] Coverage reporting works with new transform backend
- [ ] Browser tests (@vitest/browser) still function
- [ ] Deno and Bun test paths unaffected
- [ ] Source maps in test errors resolve to correct `.ts` locations

Linked to: #MASTER_ISSUE_NUMBER
```

### Implementation Steps

1. **Track upstream:** Monitor Vitest Rolldown support status
2. **Prototype:** Test Vitest with `vite@next` (Rolldown-backed) on a subset of packages
3. **Add runtime detection** (similar to AnalogJS pattern):
   ```ts
   import * as vite from 'vite'
   const isRolldown = !!vite.rolldownVersion
   ```
4. **Update vitest.shared.ts** with conditional config:
   - Rolldown path: OXC transform settings
   - Fallback: existing esbuild settings
5. **Update per-package vitest configs** to inherit
6. **Validate:** Full test suite on Node, Deno, Bun

### Case for the Upgrade

| Dimension | Impact |
|---|---|
| **Typings** | No direct impact |
| **Tree-shaking** | Test bundles use same analysis as production |
| **Consumer optimization** | Eliminates test/prod transform divergence |
| **Performance** | Faster test startup and transformation |
| **Maintainability** | Single transformation backend across build + test |

---

## Workstream 7: Tree-Shaking Audit & Consumer Optimization

**Branch:** `build/treeshake-audit`
**Depends on:** Workstream 1 (OXC annotations), Workstream 3 (Rolldown bundle tool)
**Risk:** Low -- read-only analysis with targeted fixes

### PR Description

```markdown
## Summary

Comprehensive tree-shaking audit of the Effect library using the modernized
Rolldown-based bundle tool. Identifies and fixes dead-code elimination
failures across all 29 bundle fixtures and common consumer import patterns.

### Why

With OXC handling pure-call annotations (WS1) and Rolldown handling bundle
analysis (WS3), we can now measure tree-shaking effectiveness with the same
tools consumers will use. This audit identifies:
- Modules that resist tree-shaking due to side effects
- Missing `/*#__PURE__*/` annotations
- Barrel re-export patterns that pull in unnecessary code
- `sideEffects` field accuracy in package.json

### What changes

- **sideEffects field audit:** Verify `"sideEffects": []` is accurate for
  all packages; add granular patterns where needed
- **New bundle fixtures:** Add fixtures for common consumer patterns
  (e.g., import single module from `effect`, import Schema only)
- **Fix identified issues:** Targeted changes to eliminate tree-shaking
  failures (e.g., move side-effectful initialization behind lazy patterns)
- **Bundle size baseline update:** New baseline reflecting all improvements

### Metrics tracked

For each fixture:
- Gzip size (KB)
- Module count (how many modules included)
- Dead code ratio (included but unused exports)

### Test plan

- [ ] All existing bundle fixtures produce equal or smaller gzip sizes
- [ ] New fixtures cover top-10 consumer import patterns
- [ ] `sideEffects` field validated against actual module behavior
- [ ] No runtime regressions from tree-shaking fixes
- [ ] Updated baseline checked into CI

Linked to: #MASTER_ISSUE_NUMBER
```

### Implementation Steps

1. **Establish baseline:** Run all 29 fixtures with Rolldown bundle tool, record sizes
2. **Add new fixtures** for common patterns:
   - `import { Effect } from "effect"` (core only)
   - `import { Schema } from "effect/unstable"` (single unstable module)
   - `import { PgClient } from "@effect/sql-pg"` (single SQL driver)
   - `import { HttpClient } from "effect/unstable"` (HTTP only)
3. **Analyze bundle composition** using `pnpm --filter @effect/bundle visualize`:
   - Identify unexpectedly large modules
   - Find side-effectful imports that resist elimination
4. **Fix issues:**
   - Add missing `/*#__PURE__*/` annotations (should be caught by OXC)
   - Refactor side-effectful module initialization to lazy patterns
   - Update `sideEffects` fields with granular patterns if needed
5. **Update baseline** and document improvements

### Case for the Upgrade

| Dimension | Impact |
|---|---|
| **Typings** | No direct impact |
| **Tree-shaking** | Primary focus -- quantified improvements across all fixtures |
| **Consumer optimization** | Smaller bundles for every downstream project |
| **Performance** | Smaller bundles → faster load times for consumers |
| **Maintainability** | New fixtures serve as regression tests; baseline prevents future bloat |

---

## Execution Order & Timeline

```
Phase 1 (Independent -- can run in parallel):
  WS1: OXC Pure Annotations     ████████░░
  WS2: OXC Isolated Declarations████████████░░
  WS3: Rolldown Bundle Tool     ████████░░
  WS4: tsgo Default             ████░░

Phase 2 (Depends on Phase 1):
  WS5: tsdown Tools             ░░████░░        (after WS1)
  WS6: Vitest Rolldown          ░░░░████████░░  (after WS3 + upstream)

Phase 3 (Depends on Phase 1+2):
  WS7: Tree-Shaking Audit       ░░░░░░████████  (after WS1 + WS3)
```

**Phase 1** delivers the core infrastructure changes. All four workstreams are independent and can be developed, reviewed, and merged in parallel.

**Phase 2** builds on Phase 1 foundations. WS5 requires OXC transform (WS1). WS6 requires Rolldown familiarity (WS3) plus upstream Vitest support.

**Phase 3** is the validation and optimization pass. WS7 uses the new tools from WS1 and WS3 to measure and improve tree-shaking.

---

## Dependency Removed / Added Summary

### Removed
| Package | Current Role |
|---|---|
| `@babel/core` | Babel runtime |
| `@babel/cli` | Babel CLI |
| `babel-plugin-annotate-pure-calls` | Pure-call annotation |
| `rollup-plugin-esbuild` | Bundle tool: JS transform |
| `@rollup/plugin-terser` | Bundle tool: minification |
| `@rollup/plugin-node-resolve` | Bundle tool: resolution |
| `@rollup/plugin-replace` | Bundle tool: env replacement |

### Added
| Package | New Role |
|---|---|
| `oxc-transform` | Pure-call annotation + declaration emit |
| `rolldown` | Bundle tool (replaces Rollup + plugins) |
| `tsdown` | CJS tool package builds |

**Net change:** -7 dependencies, +3 dependencies = **4 fewer moving parts**

---

## Risk Matrix

| Workstream | Risk | Mitigation |
|---|---|---|
| WS1 (OXC Annotations) | Low | A/B diff against Babel output |
| WS2 (OXC Declarations) | Medium | Effect's strict config satisfies isolated declaration requirements; file-by-file diff against tsc |
| WS3 (Rolldown Bundle) | Low | Internal tool; 2% size tolerance for minifier differences |
| WS4 (tsgo Default) | Low | Already used in CI; full test suite validates |
| WS5 (tsdown Tools) | Low | Internal tools; no consumer impact |
| WS6 (Vitest Rolldown) | Medium | Gated on upstream; dual-mode detection pattern from AnalogJS |
| WS7 (Tree-Shake Audit) | Low | Read-only analysis; fixes are opt-in and tested |

---

## Success Metrics

| Metric | Target |
|---|---|
| `pnpm build` wall-clock time | >= 30% reduction |
| Bundle fixture gzip sizes | Equal or smaller across all 29 fixtures |
| devDependency count (build-related) | Net reduction of 4 |
| CI build job duration | >= 25% reduction |
| Type-check (`pnpm check`) duration | >= 50% reduction (tsgo) |
| `.d.ts` emit duration | >= 5x faster (OXC isolated declarations) |
| Post-compile (annotation) duration | >= 10x faster (OXC vs Babel) |
