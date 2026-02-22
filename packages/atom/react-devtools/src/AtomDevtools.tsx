/**
 * @since 1.0.0
 */
"use client"

import * as React from "react"
import { AtomDetail } from "./AtomDetail.tsx"
import { AtomList } from "./AtomList.tsx"
import { panelStyle, toggleButtonStyle } from "./styles.ts"
import { useDevtoolsState } from "./useDevtoolsState.ts"

const STORAGE_KEY = "effect-atom-devtools-open"

const readOpen = (initial: boolean): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) return stored === "true"
  } catch {
    // SSR or restricted storage
  }
  return initial
}

const writeOpen = (value: boolean): void => {
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // SSR or restricted storage
  }
}

/**
 * Floating devtools panel for inspecting atoms in the registry.
 *
 * Place inside a `<RegistryProvider>` to inspect that registry's atoms.
 *
 * @since 1.0.0
 * @category components
 */
export const AtomDevtools: React.FC<{
  readonly initialIsOpen?: boolean
  readonly buttonPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right"
  readonly position?: "top" | "bottom" | "left" | "right"
  readonly nonce?: string
}> = ({
  initialIsOpen = false,
  buttonPosition = "bottom-left",
  position = "bottom"
}) => {
  const [isOpen, setIsOpen] = React.useState(() => readOpen(initialIsOpen))
  const state = useDevtoolsState()

  const toggle = React.useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      writeOpen(next)
      return next
    })
  }, [])

  const selectedSnapshot = state.selectedAtom ? state.nodes.get(state.selectedAtom) : undefined

  // Clear selection if atom was removed
  React.useEffect(() => {
    if (state.selectedAtom && !state.nodes.has(state.selectedAtom)) {
      state.setSelectedAtom(null)
    }
  }, [state.selectedAtom, state.nodes, state.setSelectedAtom])

  return (
    <>
      <button
        style={toggleButtonStyle(buttonPosition)}
        onClick={toggle}
        aria-label={isOpen ? "Close Effect Atom Devtools" : "Open Effect Atom Devtools"}
        data-testid="devtools-toggle"
      >
        {isOpen ? "\u00D7" : "\u269B"}
      </button>
      {isOpen && (
        <div style={panelStyle(position)} data-testid="devtools-panel">
          <AtomList
            nodes={state.nodes}
            selectedAtom={state.selectedAtom}
            onSelect={state.setSelectedAtom}
            searchQuery={state.searchQuery}
            onSearchChange={state.setSearchQuery}
          />
          {state.selectedAtom && selectedSnapshot && (
            <AtomDetail
              atom={state.selectedAtom}
              snapshot={selectedSnapshot}
              registry={state.registry}
            />
          )}
        </div>
      )}
    </>
  )
}
