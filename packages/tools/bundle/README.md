# Bundle Size Development Workflow

This package contains the internal bundle-size tooling used to measure Effect
entrypoints with Rollup, minification, and gzip.

## AI Agent Instructions

Use this workflow when a user wants to quickly understand how a local source
change affects bundle size for one or more explicitly selected fixture files.

Do not scan `scratchpad/` or `packages/tools/bundle/fixtures/` for this workflow.
Only measure files that the user explicitly names, or files you create
specifically for the current investigation.

Before running a comparison, ask the user which mode they want:

- default cleanup mode for a single check or one-off investigation;
- keep-base mode for many repeated measurements, followed by explicit cleanup at
  the end.

Use cleanup mode unless the user says they expect to run multiple trials.

### Compare Explicit Scratchpad Fixtures

Prefer the repository-level wrapper:

```sh
pnpm bundle-compare-selected --base main scratchpad/my-fixture.ts
```

You can pass multiple explicit files:

```sh
pnpm bundle-compare-selected --base main \
  scratchpad/schema-codec.ts \
  scratchpad/schema-arbitrary.ts
```

If `--base` is omitted, the script compares against `main`.

By default, the wrapper removes `tmp/bundle-base` before exiting, including on
failure. This avoids leaving extra git worktree state after a one-off
measurement.

For repeated measurements where the user explicitly wants a faster feedback loop,
pass `--keep-base`:

```sh
pnpm bundle-compare-selected --base main --keep-base scratchpad/my-fixture.ts
```

When using `--keep-base`, clean up `tmp/bundle-base` after the last measurement.
The explicit final cleanup command is:

```sh
git worktree remove --force tmp/bundle-base
```

The wrapper:

- builds the current checkout with `pnpm build:tsgo`;
- creates or reuses `tmp/bundle-base` at the requested base ref;
- builds the base checkout when needed and writes
  `tmp/bundle-base/.bundle-build-stamp` only after a successful build;
- reuses a kept base checkout only when its HEAD and `.bundle-build-stamp`
  both match the requested base ref;
- copies only the selected files into the base checkout at the same relative
  paths;
- invokes the internal bundle CLI to compare current vs base sizes.

The selected files are copied into the base checkout so the report isolates
source changes instead of changes to the fixture text.

Expected output is a Markdown table:

```md
| File Name                  | Current Size | Previous Size |    Difference     |
| :------------------------- | :----------: | :-----------: | :---------------: |
| `scratchpad/my-fixture.ts` |   42.10 KB   |   40.80 KB    | +1.30 KB (+3.19%) |
```

### Internal CLI

Use the internal CLI directly only when the base checkout is already prepared
and built:

```sh
node packages/tools/bundle/src/bin.ts compare-selected \
  --base-dir tmp/bundle-base \
  scratchpad/my-fixture.ts
```

The `--base-dir` value must be the root of the base checkout, not the base
fixture directory.

### Current Size Only

If the user only asks for the current bundled size, use:

```sh
pnpm --dir packages/tools/bundle report ../../../scratchpad/my-fixture.ts
```

This does not compare against a base ref.

### Fixture Guidance

Keep temporary fixtures in `scratchpad/`.

Good temporary fixtures are small, focused entrypoints that import public
package APIs:

```ts
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

const schema = Schema.Struct({
  name: Schema.String
})

Schema.decodeUnknownEffect(schema)({ name: "effect" }).pipe(Effect.runFork)
```

Prefer self-contained fixtures. The compare-selected workflow copies only the
explicit entry files into the base checkout. If a fixture imports local relative
helpers, either avoid that shape or make the entry fixture self-contained before
measuring.

Do not add temporary fixtures to `packages/tools/bundle/fixtures/`. That
directory is for stable comparison fixtures used by the regular bundle-size
workflow.

### Cleanup

The wrapper cleans up `tmp/bundle-base` by default. If `--keep-base` was used for
a multi-run investigation, remove the worktree when the user is done.

To remove it:

```sh
git worktree remove --force tmp/bundle-base
```

To verify that cleanup succeeded:

```sh
git worktree list
```

Only the main repository worktree should remain.
