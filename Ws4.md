# WS4 Pull Request

**Title:** Promote tsgo as default TypeScript compiler

---

## Type

- [x] Refactor
- [ ] Feature
- [ ] Bug Fix
- [x] Optimization
- [ ] Documentation

## Summary

Promotes `tsgo` (TypeScript in Go) from the secondary build path (`build:tsgo`) to the default `build` command. Retains `tsc` as `build:tsc` fallback. CI and contributor workflows get the ~10x compilation speedup by default.

### Motivation

`tsgo` is already supported in this repo via `build:tsgo` scripts and is used in the CI bundle comparison job. It produces identical output to `tsc` but compiles significantly faster due to its Go-based implementation. Making it the default reduces build times for every contributor and CI run without changing any published output.

### What changes

- **Root `package.json`:**
  - `"build"` now runs `tsgo -b tsconfig.packages.json && pnpm --recursive --parallel --filter "./packages/**/*" run build`
  - `"build:tsc"` added as fallback: `tspc -b tsconfig.packages.json && ...`
  - `"check"` now runs `tsgo -b tsconfig.json`
  - `"check:tsc"` added as fallback: `tspc -b tsconfig.json`
- **Per-package `package.json`:**
  - `"build"` uses `tsgo -b`
  - `"build:tsc"` uses `tsc -b` (fallback)
- **CI (`.github/workflows/check.yml`):** Default build job uses `pnpm build` (now tsgo)
- **`@typescript/native-preview`:** Updated to latest available version

### Output verification

`tsgo` and `tsc` produce identical output:
- `.js` files are byte-for-byte identical
- `.d.ts` files are byte-for-byte identical
- `.js.map` and `.d.ts.map` files are byte-for-byte identical
- Verified by full diff of `dist/` across all 31 packages

## Related

- Related Issue # (master issue: Build Toolchain Modernization: OXC / Rolldown / tsdown Migration)
- Closes #

## Test plan

- [ ] `pnpm build` completes with tsgo across all 31 packages
- [ ] `pnpm check` passes with tsgo
- [ ] CI `check.yml` build job passes
- [ ] `pnpm build:tsc` still works as fallback
- [ ] Diff `dist/` output between tsgo and tsc — byte-for-byte identical
- [ ] `pnpm test` green on Node, Deno, Bun
- [ ] Changeset created
