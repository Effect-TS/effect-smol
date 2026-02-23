/**
 * Framework-agnostic devtools state controller.
 *
 * Manages atom snapshots, selection, and search filtering. Any UI framework
 * can subscribe via `controller.subscribe()` / `controller.getState()` —
 * compatible with React's `useSyncExternalStore`, Vue's `watchEffect`, Solid's
 * `createEffect`, or plain callback-based rendering.
 *
 * @since 1.0.0
 */
import type * as Atom from "effect/unstable/reactivity/Atom"
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import { getLabel } from "./AtomUtils.ts"

/**
 * @since 1.0.0
 * @category models
 */
export interface NodeSnapshot {
  readonly node: AtomRegistry.Node<any>
  readonly value: unknown
}

/**
 * @since 1.0.0
 * @category models
 */
export interface DevtoolsState {
  readonly nodes: ReadonlyMap<Atom.Atom<any>, NodeSnapshot>
  readonly selectedAtom: Atom.Atom<any> | null
  readonly searchQuery: string
}

/**
 * @since 1.0.0
 * @category models
 */
export interface DevtoolsController {
  readonly getState: () => DevtoolsState
  readonly subscribe: (listener: () => void) => () => void
  readonly setSelectedAtom: (atom: Atom.Atom<any> | null) => void
  readonly setSearchQuery: (query: string) => void
  readonly filteredEntries: () => ReadonlyArray<readonly [Atom.Atom<any>, NodeSnapshot]>
  readonly registry: AtomRegistry.AtomRegistry
  readonly dispose: () => void
}

/**
 * Create a devtools controller bound to the given registry.
 *
 * @since 1.0.0
 * @category constructors
 */
export const make = (registry: AtomRegistry.AtomRegistry): DevtoolsController => {
  let nodes = new Map<Atom.Atom<any>, NodeSnapshot>()
  let selectedAtom: Atom.Atom<any> | null = null
  let searchQuery = ""
  const listeners = new Set<() => void>()
  const unsubscribes = new Map<Atom.Atom<any>, () => void>()

  // Stable snapshot — only replaced in notify() so useSyncExternalStore
  // sees a stable reference between state changes.
  let currentState: DevtoolsState = { nodes, selectedAtom, searchQuery }

  // Cached filtered entries — invalidated on nodes/searchQuery change
  let filteredCache: ReadonlyArray<readonly [Atom.Atom<any>, NodeSnapshot]> | null = null
  let filteredNodes: ReadonlyMap<Atom.Atom<any>, NodeSnapshot> | null = null
  let filteredQuery: string | null = null

  const notify = () => {
    currentState = { nodes, selectedAtom, searchQuery }
    filteredCache = null
    for (const listener of listeners) {
      listener()
    }
  }

  const subscribeToAtom = (atom: Atom.Atom<any>) => {
    if (unsubscribes.has(atom)) return
    const unsub = registry.subscribe(atom, () => {
      const currentNode = registry.getNodes().get(atom)
      if (currentNode) {
        const next = new Map(nodes)
        next.set(atom, { node: currentNode, value: currentNode.value() })
        nodes = next
        notify()
      }
    })
    unsubscribes.set(atom, unsub)
  }

  const syncNodes = () => {
    const registryNodes = registry.getNodes()
    const next = new Map<Atom.Atom<any>, NodeSnapshot>()
    const currentAtoms = new Set<Atom.Atom<any>>()

    for (const [key, node] of registryNodes) {
      if (typeof key === "string") continue
      const atom = key as Atom.Atom<any>
      currentAtoms.add(atom)
      next.set(atom, { node, value: node.value() })
      subscribeToAtom(atom)
    }

    // Cleanup subscriptions for removed atoms
    for (const [atom, unsub] of unsubscribes) {
      if (!currentAtoms.has(atom)) {
        unsub()
        unsubscribes.delete(atom)
      }
    }

    // Clear selection if atom was removed
    if (selectedAtom && !currentAtoms.has(selectedAtom)) {
      selectedAtom = null
    }

    nodes = next
    notify()
  }

  // Initial sync + polling for structural changes
  syncNodes()
  const interval = setInterval(syncNodes, 1000)

  const getState = (): DevtoolsState => currentState

  return {
    getState,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setSelectedAtom: (atom: Atom.Atom<any> | null) => {
      if (atom === selectedAtom) return
      selectedAtom = atom
      notify()
    },
    setSearchQuery: (query: string) => {
      if (query === searchQuery) return
      searchQuery = query
      notify()
    },
    filteredEntries: () => {
      if (filteredCache && filteredNodes === nodes && filteredQuery === searchQuery) {
        return filteredCache
      }
      const entries = Array.from(nodes.entries())
      if (!searchQuery) {
        filteredCache = entries
      } else {
        const q = searchQuery.toLowerCase()
        filteredCache = entries.filter(([atom]) => getLabel(atom).toLowerCase().includes(q))
      }
      filteredNodes = nodes
      filteredQuery = searchQuery
      return filteredCache
    },
    registry,
    dispose: () => {
      clearInterval(interval)
      for (const unsub of unsubscribes.values()) {
        unsub()
      }
      unsubscribes.clear()
      listeners.clear()
    }
  }
}
