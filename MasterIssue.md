# Build Toolchain Modernization: OXC / Rolldown / tsdown Migration

**Labels:** `enhancement`, `build`, `performance`, `dx`
**Milestone:** v4.1

---

## Summary

Migrate the Effect monorepo build pipeline from its current **tsc + Babel + Rollup** stack to a unified **OXC + Rolldown + tsdown** toolchain, reducing build times, improving tree-shaking for downstream consumers, and consolidating the number of moving parts in the pipeline.

### Current Pipeline
```
src/*.ts
  -> tsc/tsgo -b (compilation + declaration emit)
  -> Babel (annotate-pure-calls only)
  -> dist/*.js + dist/*.d.ts

Bundle analysis (CI only):
  Rollup + esbuild plugin + Terser + node-resolve
```

### Target Pipeline
```
src/*.ts
  -> tsgo -b (compilation only, no declaration emit)
  -> OXC transform (pure-call annotation + any post-processing)
  -> dist/*.js

  -> OXC isolatedDeclaration (parallel .d.ts emit)
  -> dist/*.d.ts

Bundle analysis (CI only):
  Rolldown (native Rust bundler, no esbuild/Terser shim)

CJS edge cases (tools packages):
  tsdown
```

---

## Motivation

### Performance
- **Babel is heavyweight for a single plugin.** The entire Babel parser/transformer runs on every file in `dist/` solely to add `/*#__PURE__*/` annotations. OXC's Rust-based transform can do this order-of-magnitude faster.
- **tsc declaration emit is serial and slow.** OXC's `isolatedDeclarationSync()` operates per-file with no type-checker dependency, enabling full parallelization.
- **Rollup + esbuild + Terser** in the bundle tool is three JS-based tools chained together. Rolldown replaces all three with a single native binary.

### Tree-Shaking & Consumer Optimization
- OXC's pure-call annotation is more precise than the Babel plugin, producing tighter `/*#__PURE__*/` placement.
- Rolldown's tree-shaking is compatible with Rollup's but benefits from native-speed scope analysis, enabling more aggressive dead-code elimination in the bundle analysis fixtures.
- Consumers who bundle with Vite 8+ (which ships Rolldown) get native compatibility with the same tool that built the library.

### Typings
- OXC isolated declarations enforce explicit return types on all public API surfaces. Effect already requires this via strict tsconfig, so the migration is low-risk and validates type hygiene.
- Declaration maps (`*.d.ts.map`) remain supported, preserving IDE go-to-definition.

### Maintainability
- Eliminates **Babel** as a build dependency (and its transitive tree: `@babel/core`, `@babel/cli`, `babel-plugin-annotate-pure-calls`).
- Eliminates **four Rollup plugins** from the bundle tool (`rollup-plugin-esbuild`, `@rollup/plugin-terser`, `@rollup/plugin-node-resolve`, `@rollup/plugin-replace`).
- Consolidates on a single transformation runtime (OXC) already used for linting (`@effect/oxc`).

---

## Workstreams

Each workstream maps to a PR. Dependencies are noted; independent streams can land in any order.

| # | Workstream | PR | Depends On |
|---|---|---|---|
| 1 | [Replace Babel with OXC Transform for pure-call annotation](#ws-1) | `build/oxc-pure-annotations` | -- |
| 2 | [OXC Isolated Declarations for .d.ts emit](#ws-2) | `build/oxc-isolated-declarations` | -- |
| 3 | [Migrate Bundle Tool from Rollup to Rolldown](#ws-3) | `build/rolldown-bundle-tool` | -- |
| 4 | [tsgo as Default Compiler](#ws-4) | `build/tsgo-default` | -- |
| 5 | [tsdown for CJS Tool Packages](#ws-5) | `build/tsdown-cjs-tools` | #1 |
| 6 | [Vitest + Rolldown Integration](#ws-6) | `build/vitest-rolldown` | #3 |
| 7 | [Tree-Shaking Audit & Consumer Optimization](#ws-7) | `build/treeshake-audit` | #1, #3 |

---

<a id="ws-1"></a>
### Workstream 1: Replace Babel with OXC Transform

Replace `babel-plugin-annotate-pure-calls` with `oxc-transform` to add `/*#__PURE__*/` annotations. Removes Babel from the build pipeline entirely.

<a id="ws-2"></a>
### Workstream 2: OXC Isolated Declarations

Replace tsc's declaration emit with OXC `isolatedDeclarationSync()`. Runs per-file in parallel, no type-checker required.

<a id="ws-3"></a>
### Workstream 3: Rolldown Bundle Tool

Replace Rollup + esbuild + Terser + node-resolve in `packages/tools/bundle` with Rolldown's native bundler.

<a id="ws-4"></a>
### Workstream 4: tsgo as Default Compiler

Promote `tsgo` from secondary (`build:tsgo`) to the primary build command. Retain `tsc` as fallback.

<a id="ws-5"></a>
### Workstream 5: tsdown for CJS Tool Packages

Use tsdown for any tool packages that require CommonJS output (CLI binaries, tool runners).

<a id="ws-6"></a>
### Workstream 6: Vitest + Rolldown Integration

When Vitest supports Rolldown as its transformation backend, migrate the test configuration.

<a id="ws-7"></a>
### Workstream 7: Tree-Shaking Audit

End-to-end audit of tree-shaking effectiveness across all 29 bundle fixtures using the new Rolldown-based tool, with targeted fixes for any regressions.

---

## Acceptance Criteria

- [ ] `pnpm build` completes without Babel in the dependency tree
- [ ] All 29 bundle fixtures produce equal or smaller gzip sizes vs. current baseline
- [ ] `pnpm check` and type tests pass with OXC-emitted `.d.ts` files
- [ ] CI bundle comparison workflow runs on Rolldown
- [ ] No regressions in `pnpm test` across Node, Deno, and Bun
- [ ] All `@effect/*` packages publish with correct `exports`, `types`, and `sideEffects` fields
- [ ] Build time (wall clock, CI runner) reduced by >= 30%

---

## Out of Scope

- Migrating the `@effect/oxc` linting rules (already on OXC)
- Changing the dprint formatter
- Modifying the changesets release flow

---

## References

- [OXC Project](https://oxc.rs/) -- Rust-based JS/TS toolchain
- [Rolldown](https://rolldown.rs/) -- Rust-based bundler, Rollup-compatible
- [tsdown](https://tsdown.dev/) -- TypeScript-first bundler built on Rolldown
- [Vite 8 + Rolldown RFC](https://github.com/vitejs/vite/discussions/18891)
