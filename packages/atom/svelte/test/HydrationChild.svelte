<script lang="ts">
  import { useAtomValue } from "@effect/atom-svelte"
  import type * as Atom from "effect/unstable/reactivity/Atom"

  let {
    atom
  }: {
    atom: () => Atom.Atom<number>
  } = $props()

  const value = useAtomValue(atom)
</script>

<span data-testid="hydrated">{value.current}</span>
