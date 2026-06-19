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

### Two-way binding

`useAtomState` returns a handle whose `current` is both readable and assignable, so it works with `bind:` for `Writable<A, A>` atoms:

```svelte
<script lang="ts">
  import { Atom, useAtomState } from "@effect/atom-svelte"

  const nameAtom = Atom.make("")
  const name = useAtomState(() => nameAtom)
</script>

<input bind:value={name.current} />
```

### Async / Suspense

`useAtomSuspense` turns an `AsyncResult` atom into a handle whose `current` is a promise — pending on `Initial`, resolved on success, rejected on failure. Read it from an `{#await}` block:

```svelte
<script lang="ts">
  import { useAtomSuspense } from "@effect/atom-svelte"
  import { userAtom } from "./atoms.ts"

  const user = useAtomSuspense(() => userAtom)
</script>

{#await user.current}
  <p>Loading…</p>
{:then value}
  <p>{value.name}</p>
{:catch error}
  <p>{error.message}</p>
{/await}
```

With Svelte's experimental async feature enabled, `await` it directly inside a `<svelte:boundary>` whose `pending` snippet renders the loading state.

### AtomRef properties

`useAtomRef` reads an `AtomRef`; `useAtomRefProp` derives a child ref for one property, and `useAtomRefPropValue` reads that property's value reactively.

### SSR hydration

For atoms marked with `Atom.serializable`, dehydrate their values on the server and restore them on the client so the first client render matches the server without refetching.

On the server (e.g. a SvelteKit `load`), populate a registry and dehydrate it:

```ts
import { Atom, AtomRegistry, Hydration } from "@effect/atom-svelte"

export async function load() {
  const registry = AtomRegistry.make()
  // ...drive the serializable atoms you want to ship...
  return { dehydrated: Hydration.dehydrate(registry) }
}
```

On the client, hydrate the current registry once, in the root layout, right after providing it:

```svelte
<!-- +layout.svelte -->
<script lang="ts">
  import { hydrateAtoms, setRegistry } from "@effect/atom-svelte"

  let { data, children } = $props()

  setRegistry()
  hydrateAtoms(data.dehydrated)
</script>

{@render children()}
```

`hydrateAtoms` runs during component initialisation, so values are in place before any descendant reads them. For non-serializable, raw seeding (e.g. plain client state) use `useAtomInitialValues`.

## Notes

- **SSR.** Call `setRegistry()` in the root layout so each request gets an isolated registry. The module-level `defaultRegistry` is shared across requests on the server, so request state would otherwise leak.
- **Hooks are init-time.** Like Svelte's own `getContext`, the `use*` hooks must be called at the top of `<script>`, not inside event handlers, after an `await`, or at module scope.

## Documentation

- **API Reference**: [View the full documentation](https://effect-ts.github.io/effect/docs/atom-svelte).
