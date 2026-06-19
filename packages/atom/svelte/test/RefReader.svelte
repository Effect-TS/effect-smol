<script lang="ts">
  import { useAtomRef } from "@effect/atom-svelte"
  import type * as AtomRef from "effect/unstable/reactivity/AtomRef"

  let {
    atomRef
  }: {
    atomRef: () => AtomRef.ReadonlyRef<number>
  } = $props()

  const value = useAtomRef(atomRef)
</script>

<span data-testid="ref">{value.current}</span>
