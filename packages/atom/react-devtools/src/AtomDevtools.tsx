/**
 * @since 1.0.0
 */
"use client"

declare const process: { readonly env: { readonly NODE_ENV?: string } }

import * as React from "react"
import { AtomDetail } from "./AtomDetail.tsx"
import { AtomList } from "./AtomList.tsx"
import { panelStyle, toggleButtonStyle } from "./styles.ts"
import { useDevtoolsState } from "./useDevtoolsState.ts"

const EffectIcon: React.FC<{ readonly size?: number; readonly color?: string }> = (
  { size = 20, color = "currentColor" }
) => (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M29.8 24.32c.48-.27.64-.86.37-1.32a.72.72 0 00-1.35-.04L15.92 29.94 3.07 22.67a.72.72 0 00-1.35.35c-.27.46-.11 1.05.36 1.32l13.3 7.53c.12.06.24.1.38.12.13.02.26 0 .39-.04.12-.02.24-.06.34-.12l13.3-7.53z"
      fill={color}
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M31.13 16.6c.07-.41-.12-.83-.51-1.05L16.56 7.63a.73.73 0 00-.36-.12.74.74 0 00-.77.1.73.73 0 00-.07.02L1.32 15.52a.72.72 0 00-.5 1.12c-.04.35.1.72.5.95l14.07 7.96a.74.74 0 00.81.03l14.07-7.96c.41-.23.55-.6.5-.96zm-2.9-.04L15.95 9.64 3.67 16.56l12.28 6.95 12.28-6.95z"
      fill={color}
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M31.34 10.61c.53-.3.71-.95.4-1.47a.72.72 0 00-1.5-.39L15.93 16.85 1.66 8.78A.72.72 0 00.16 9.17a.72.72 0 00.4 1.47l14.77 8.36a.74.74 0 00.85-.07l14.77-8.36z"
      fill={color}
    />
    <path d="M2.74 9.68L15.9 1.62l13.16 8.06L15.9 17.2 2.74 9.68z" fill={color} />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M31.33 8.49c.52.3.7.94.4 1.47a.72.72 0 01-1.5.39L15.91 2.29 1.64 10.32a.72.72 0 01-1.5-.39.72.72 0 01.41-1.47L15.33.14a.74.74 0 01.85.07l14.77 8.32z"
      fill={color}
    />
  </svg>
)

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

interface AtomDevtoolsProps {
  readonly initialIsOpen?: boolean
  readonly buttonPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right"
  readonly position?: "top" | "bottom" | "left" | "right"
  readonly nonce?: string
}

const TRANSITION_MS = 250

const AtomDevtoolsImpl: React.FC<AtomDevtoolsProps> = ({
  initialIsOpen = false,
  buttonPosition = "bottom-left",
  position = "bottom"
}) => {
  const [isOpen, setIsOpen] = React.useState(() => readOpen(initialIsOpen))
  // mounted keeps the DOM alive during close animation
  const [mounted, setMounted] = React.useState(isOpen)
  // visible drives the CSS transition (off → on after mount, on → off before unmount)
  const [visible, setVisible] = React.useState(isOpen)
  const state = useDevtoolsState()
  const [btnHovered, setBtnHovered] = React.useState(false)

  // Open: mount first, then make visible after browser paints the hidden state.
  // Close: hide first, then unmount after transition completes.
  React.useEffect(() => {
    if (isOpen) {
      setMounted(true)
      // Double rAF: first frame commits the hidden mount, second frame triggers the transition
      let raf2: number
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true))
      })
      return () => {
        cancelAnimationFrame(raf1)
        cancelAnimationFrame(raf2)
      }
    } else {
      setVisible(false)
      const timer = setTimeout(() => setMounted(false), TRANSITION_MS)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

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

  const btnStyle: React.CSSProperties = {
    ...toggleButtonStyle(buttonPosition),
    transform: btnHovered ? "scale(1.1)" : "scale(1)"
  }

  return (
    <>
      <button
        style={btnStyle}
        onClick={toggle}
        onMouseEnter={() => setBtnHovered(true)}
        onMouseLeave={() => setBtnHovered(false)}
        aria-label={isOpen ? "Close Effect Atom Devtools" : "Open Effect Atom Devtools"}
        data-testid="devtools-toggle"
      >
        {isOpen ? "\u00D7" : <EffectIcon size={20} />}
      </button>
      {mounted && (
        <div style={panelStyle(position, visible)} data-testid="devtools-panel">
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
              onSelect={state.setSelectedAtom}
            />
          )}
        </div>
      )}
    </>
  )
}

const Noop: React.FC<AtomDevtoolsProps> = () => null

/**
 * Floating devtools panel for inspecting atoms in the registry.
 *
 * Place inside a `<RegistryProvider>` to inspect that registry's atoms.
 * Renders nothing in production (`process.env.NODE_ENV === "production"`),
 * allowing bundlers to tree-shake the entire module.
 *
 * @since 1.0.0
 * @category components
 */
export const AtomDevtools: React.FC<AtomDevtoolsProps> = process.env.NODE_ENV === "production" ? Noop : AtomDevtoolsImpl
