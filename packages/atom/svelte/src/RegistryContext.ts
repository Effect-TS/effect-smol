/**
 * Svelte context helpers for the Atom registry used by Effect Atom hooks. The
 * registry stores atom values, schedules update work, and cleans up unused
 * atoms. Sharing one registry through Svelte context lets components in the same
 * tree read and write the same atom state.
 *
 * @since 4.0.0
 */
import type * as Atom from "effect/unstable/reactivity/Atom"
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import * as Hydration from "effect/unstable/reactivity/Hydration"
import { getContext, setContext } from "svelte"

/**
 * The Svelte context key under which the `AtomRegistry` is stored.
 *
 * @category registry
 * @since 4.0.0
 */
export const registryKey: symbol = Symbol.for("@effect/atom-svelte/registryKey")

/**
 * A process-wide default `AtomRegistry`, used when none has been provided via
 * {@link setRegistry}.
 *
 * **Gotchas**
 *
 * On the server this default is shared across requests. Under SSR (e.g.
 * SvelteKit on Cloudflare Workers) call {@link setRegistry} in a root layout so
 * each request gets an isolated registry; otherwise request state can leak.
 *
 * @category registry
 * @since 4.0.0
 */
export const defaultRegistry: AtomRegistry.AtomRegistry = AtomRegistry.make()

/**
 * Provides an `AtomRegistry` to the current component subtree via Svelte
 * context. Must be called during component initialisation (for SvelteKit, in
 * the root `+layout.svelte`).
 *
 * **Gotchas**
 *
 * Like Svelte's own `setContext`, this must run synchronously while a component
 * is initialising. Calling it from an event handler or after an `await` throws.
 *
 * @category registry
 * @since 4.0.0
 */
export const setRegistry = (
  registry: AtomRegistry.AtomRegistry = AtomRegistry.make()
): AtomRegistry.AtomRegistry => {
  setContext(registryKey, registry)
  return registry
}

/**
 * Reads the `AtomRegistry` from Svelte context, falling back to
 * {@link defaultRegistry}. Must be called during component initialisation.
 *
 * @category registry
 * @since 4.0.0
 */
export const injectRegistry = (): AtomRegistry.AtomRegistry =>
  getContext<AtomRegistry.AtomRegistry | undefined>(registryKey) ?? defaultRegistry

const initialValuesSet = new WeakMap<AtomRegistry.AtomRegistry, WeakSet<Atom.Atom<any>>>()

/**
 * Seeds initial values for atoms in the current registry. The first value
 * supplied for a given atom in a given registry wins; later calls are ignored.
 * Useful for hydrating server-rendered atom values on the client.
 *
 * @category registry
 * @since 4.0.0
 */
export const useAtomInitialValues = (
  initialValues: Iterable<readonly [Atom.Atom<any>, any]>
): void => {
  const registry = injectRegistry()
  let set = initialValuesSet.get(registry)
  if (set === undefined) {
    set = new WeakSet()
    initialValuesSet.set(registry, set)
  }
  for (const [atom, value] of initialValues) {
    if (!set.has(atom)) {
      set.add(atom)
      ;(registry as any).ensureNode(atom).setValue(value)
    }
  }
}

/**
 * Applies dehydrated atom state to the current registry, restoring serializable
 * atom values produced on the server by `Hydration.dehydrate`.
 *
 * **When to use**
 *
 * Use to rehydrate server-rendered atom state on the client under SSR. Call it
 * during component initialisation — typically in the root `+layout.svelte`,
 * right after {@link setRegistry} — so the values are preloaded before
 * descendant components read the atoms.
 *
 * **Details**
 *
 * Encoded values are preloaded by serialization key. Entries dehydrated while in
 * an `AsyncResult.Initial` state with a pending `resultPromise` update the
 * matching atom once that promise resolves. The `Hydration` module is re-exported
 * from the package index for producing the dehydrated state on the server.
 *
 * @category hydration
 * @since 4.0.0
 */
export const hydrateAtoms = (state: Iterable<Hydration.DehydratedAtom>): void => {
  Hydration.hydrate(injectRegistry(), state)
}
