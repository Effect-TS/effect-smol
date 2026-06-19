<script lang="ts">
  import { hydrateAtoms, setRegistry } from "@effect/atom-svelte"
  import type * as Atom from "effect/unstable/reactivity/Atom"
  import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
  import type * as Hydration from "effect/unstable/reactivity/Hydration"
  import HydrationChild from "./HydrationChild.svelte"

  let {
    registry,
    state,
    atom
  }: {
    registry: AtomRegistry.AtomRegistry
    state: Iterable<Hydration.DehydratedAtom>
    atom: () => Atom.Atom<number>
  } = $props()

  setRegistry(registry)
  hydrateAtoms(state)
</script>

<HydrationChild {atom} />
