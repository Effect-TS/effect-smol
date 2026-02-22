/**
 * @since 1.0.0
 */
"use client"

import * as RegistryContext from "@effect/atom-react/RegistryContext"
import type * as Atom from "effect/unstable/reactivity/Atom"
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import * as React from "react"

/** @internal */
export interface NodeSnapshot {
  readonly node: AtomRegistry.Node<any>
  readonly value: unknown
}

/** @internal */
export interface DevtoolsState {
  readonly nodes: ReadonlyMap<Atom.Atom<any>, NodeSnapshot>
  readonly selectedAtom: Atom.Atom<any> | null
  readonly searchQuery: string
}

const emptyMap = new Map<Atom.Atom<any>, NodeSnapshot>()

/** @internal */
export const useDevtoolsState = () => {
  const registry = React.useContext(RegistryContext.RegistryContext)
  const [nodes, setNodes] = React.useState<ReadonlyMap<Atom.Atom<any>, NodeSnapshot>>(emptyMap)
  const [selectedAtom, setSelectedAtom] = React.useState<Atom.Atom<any> | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")

  React.useEffect(() => {
    const unsubscribes = new Map<Atom.Atom<any>, () => void>()

    const syncNodes = () => {
      const registryNodes = registry.getNodes()
      const next = new Map<Atom.Atom<any>, NodeSnapshot>()

      // Track which atoms exist now
      const currentAtoms = new Set<Atom.Atom<any>>()

      for (const [key, node] of registryNodes) {
        if (typeof key === "string") continue
        const atom = key as Atom.Atom<any>
        currentAtoms.add(atom)
        next.set(atom, { node, value: node.value() })

        // Subscribe to new atoms
        if (!unsubscribes.has(atom)) {
          const unsub = registry.subscribe(atom, () => {
            setNodes((prev) => {
              const updated = new Map(prev)
              const currentNode = registry.getNodes().get(atom)
              if (currentNode) {
                updated.set(atom, { node: currentNode, value: currentNode.value() })
              }
              return updated
            })
          })
          unsubscribes.set(atom, unsub)
        }
      }

      // Cleanup removed atoms
      for (const [atom, unsub] of unsubscribes) {
        if (!currentAtoms.has(atom)) {
          unsub()
          unsubscribes.delete(atom)
        }
      }

      setNodes(next)
    }

    syncNodes()
    const interval = setInterval(syncNodes, 1000)

    return () => {
      clearInterval(interval)
      for (const unsub of unsubscribes.values()) {
        unsub()
      }
      unsubscribes.clear()
    }
  }, [registry])

  return {
    nodes,
    selectedAtom,
    setSelectedAtom,
    searchQuery,
    setSearchQuery,
    registry
  } as const
}
