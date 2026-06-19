<script lang="ts">
  import { setRegistry, useAtom } from "@effect/atom-svelte"
  import type * as Atom from "effect/unstable/reactivity/Atom"
  import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"

  let {
    registry,
    atom
  }: {
    registry: AtomRegistry.AtomRegistry
    atom: () => Atom.Writable<number, number>
  } = $props()

  setRegistry(registry)
  const [count, setCount] = useAtom(atom)
</script>

<button data-testid="btn" onclick={() => setCount((n) => n + 1)}>{count.current}</button>
