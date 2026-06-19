<script lang="ts">
  import { useAtomRefPropValue } from "@effect/atom-svelte"
  import type * as AtomRef from "effect/unstable/reactivity/AtomRef"

  let {
    atomRef
  }: {
    atomRef: () => AtomRef.AtomRef<{ count: number; label: string }>
  } = $props()

  const count = useAtomRefPropValue(atomRef, "count")
</script>

<span data-testid="count">{count.current}</span>
