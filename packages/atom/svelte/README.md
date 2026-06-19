# `@effect/atom-svelte`

Svelte 5 bindings for the Effect Atom modules.

## Installation

```bash
pnpm add @effect/atom-svelte effect svelte
```

## Usage

Provide a registry once, near the root of your app (in SvelteKit, the root `+layout.svelte`):

```svelte
<!-- +layout.svelte -->
<script lang="ts">
  import { setRegistry } from "@effect/atom-svelte"

  setRegistry() // per-tree (per-request under SSR) isolation

  let { children } = $props()
</script>

{@render children()}
```

Read and write atoms from a component:

```svelte
<script lang="ts">
  import { Atom, useAtom } from "@effect/atom-svelte"

  const countAtom = Atom.make(0)
  const [count, setCount] = useAtom(() => countAtom)
</script>

<button onclick={() => setCount((n) => n + 1)}>{count.current}</button>
```

For effectful atoms, `count.current` is an `AsyncResult`; match on it with `AsyncResult.isInitial` / `AsyncResult.isSuccess` / `AsyncResult.isFailure`.

## Notes

- **SSR.** Call `setRegistry()` in the root layout so each request gets an isolated registry. The module-level `defaultRegistry` is shared across requests on the server, so request state would otherwise leak.
- **Hooks are init-time.** Like Svelte's own `getContext`, the `use*` hooks must be called at the top of `<script>`, not inside event handlers, after an `await`, or at module scope.

## Documentation

- **API Reference**: [View the full documentation](https://effect-ts.github.io/effect/docs/atom-svelte).
