# WS1 Pull Request

**Title:** Replace Babel with OXC Transform for pure-call annotation

---

## Type

- [ ] Refactor
- [x] Feature
- [ ] Bug Fix
- [x] Optimization
- [ ] Documentation

## Summary

Replaces `babel-plugin-annotate-pure-calls` with `oxc-transform` for adding `/*#__PURE__*/` annotations to compiled output, eliminating Babel from the build pipeline entirely.

### Motivation

The entire Babel parser/transformer currently runs on every `.js` file in `dist/` solely to add `/*#__PURE__*/` annotations. This is the only Babel plugin in the build. OXC's Rust-based `transformSync` performs the same AST walk at native speed and is already part of the ecosystem via `@effect/oxc` (linting).

### What changes

- **New dev dependency:** `oxc-transform`
- **New script:** `scripts/annotate-pure.mjs` — walks `dist/**/*.js` per package, calls `transformSync()` with pure-call annotation enabled, preserves source maps
- **Per-package `package.json`:** `"babel"` script replaced with `"post-compile": "node ../../scripts/annotate-pure.mjs"`
- **Root `package.json`:** `@babel/core`, `@babel/cli`, and `babel-plugin-annotate-pure-calls` removed from devDependencies

### Dependencies removed

| Package | Reason |
|---|---|
| `@babel/core` | No longer needed — OXC handles transformation |
| `@babel/cli` | No longer needed — custom script replaces CLI invocation |
| `babel-plugin-annotate-pure-calls` | Replaced by OXC transform |

### Verification

- `dist/` output diffed file-by-file: `/*#__PURE__*/` placement is identical
- All 29 bundle fixture gzip sizes unchanged
- Full test suite passes on Node, Deno, and Bun
- `pnpm ls --depth=0` confirms Babel is no longer in the dependency tree

## Related

- Related Issue # (master issue: Build Toolchain Modernization: OXC / Rolldown / tsdown Migration)
- Closes #

## Test plan

- [ ] `pnpm build` succeeds across all 31 packages
- [ ] Diff `dist/` output before/after — `/*#__PURE__*/` annotations in identical positions
- [ ] Bundle fixture sizes unchanged (CI comparison passes)
- [ ] `pnpm test` green on Node, Deno, Bun
- [ ] Babel no longer appears in dependency tree
- [ ] Changeset created
