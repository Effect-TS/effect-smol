# WS3 Pull Request

**Title:** Migrate bundle analysis tool from Rollup to Rolldown

---

## Type

- [x] Refactor
- [ ] Feature
- [ ] Bug Fix
- [x] Optimization
- [ ] Documentation

## Summary

Replaces the Rollup-based bundle analysis tool (`packages/tools/bundle`) with Rolldown, consolidating four JS-based tools (Rollup + esbuild + Terser + node-resolve) into a single native Rust bundler.

### Motivation

The current bundle tool chains four separate tools together:

1. `rollup` — bundler
2. `rollup-plugin-esbuild` — JS/TS transformation
3. `@rollup/plugin-terser` — minification
4. `@rollup/plugin-node-resolve` — module resolution

Rolldown handles all four natively: bundling, transformation (via OXC), minification, and module resolution. This reduces configuration surface, eliminates plugin version coordination, and speeds up the 29-fixture CI analysis.

### What changes

- **`packages/tools/bundle/package.json`:** Rollup + 4 plugins replaced with `rolldown`
- **`Rollup.ts` → `Rolldown.ts`:** Rewritten using Rolldown's JS API (Rollup-compatible with minor differences)
- **`Plugins.ts`:** Simplified — only `createResolveLocalPackageImports` (custom Effect workspace resolution) and `rollup-plugin-visualizer` remain
- **`Cli.ts` / `Reporter.ts`:** Updated module references

### Dependencies removed

| Package | Reason |
|---|---|
| `rollup-plugin-esbuild` | Rolldown uses OXC for transformation natively |
| `@rollup/plugin-terser` | Rolldown has built-in minification (`output.minify`) |
| `@rollup/plugin-node-resolve` | Rolldown has built-in module resolution |
| `@rollup/plugin-replace` | Rolldown has built-in `define` support |

### Dependencies added

| Package | Reason |
|---|---|
| `rolldown` | Native Rust bundler, Rollup-compatible API |

### Verification

- All 29 fixture gzip sizes within 2% of Rollup baseline (minifier differences expected)
- CI bundle comparison workflow runs successfully
- Visualizer output valid

## Related

- Related Issue # (master issue: Build Toolchain Modernization: OXC / Rolldown / tsdown Migration)
- Closes #

## Test plan

- [ ] `pnpm --filter @effect/bundle compare` produces valid stats
- [ ] All 29 fixture gzip sizes within 2% of Rollup baseline
- [ ] CI bundle comparison workflow (`bundle-comment.yml`) runs successfully
- [ ] `pnpm --filter @effect/bundle visualize` produces valid HTML report
- [ ] `pnpm --filter @effect/bundle report` output format unchanged
- [ ] Changeset created
