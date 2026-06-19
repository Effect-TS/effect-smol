<script lang="ts">
  import { setRegistry, useAtomPromise } from "@effect/atom-svelte"
  import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
  import type * as Atom from "effect/unstable/reactivity/Atom"
  import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"

  let {
    registry,
    atom
  }: {
    registry: AtomRegistry.AtomRegistry
    atom: () => Atom.Atom<AsyncResult.AsyncResult<number, Error>>
  } = $props()

  setRegistry(registry)
  const value = useAtomPromise(atom)
</script>

{#await value.current}
  <span data-testid="state">pending</span>
{:then n}
  <span data-testid="state">{n}</span>
{:catch error}
  <span data-testid="state">error: {error.message}</span>
{/await}
