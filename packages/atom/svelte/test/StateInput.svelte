<script lang="ts">
  import { setRegistry, useAtomState } from "@effect/atom-svelte"
  import type * as Atom from "effect/unstable/reactivity/Atom"
  import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"

  let {
    registry,
    atom
  }: {
    registry: AtomRegistry.AtomRegistry
    atom: () => Atom.Writable<string, string>
  } = $props()

  setRegistry(registry)
  const state = useAtomState(atom)
</script>

<input data-testid="input" bind:value={state.current} />
<span data-testid="value">{state.current}</span>
