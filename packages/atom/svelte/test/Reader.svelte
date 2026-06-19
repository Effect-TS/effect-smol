<script lang="ts">
  import { setRegistry, useAtomValue } from "@effect/atom-svelte"
  import type * as Atom from "effect/unstable/reactivity/Atom"
  import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"

  let {
    registry,
    atom
  }: {
    registry: AtomRegistry.AtomRegistry
    atom: () => Atom.Atom<number>
  } = $props()

  setRegistry(registry)
  const value = useAtomValue(atom, (n) => n * 2)
</script>

<span data-testid="value">{value.current}</span>
