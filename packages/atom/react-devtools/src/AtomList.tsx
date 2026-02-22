/**
 * @since 1.0.0
 */
"use client"

import type * as Atom from "effect/unstable/reactivity/Atom"
import * as React from "react"
import {
  badgeStyle,
  listenerBadgeStyle,
  listItemRowStyle,
  listPanelStyle,
  listScrollStyle,
  searchInputStyle,
  stateColor,
  theme,
  valuePreviewStyle
} from "./styles.ts"
import type { NodeSnapshot } from "./useDevtoolsState.ts"

/** @internal */
export interface AtomListProps {
  readonly nodes: ReadonlyMap<Atom.Atom<any>, NodeSnapshot>
  readonly selectedAtom: Atom.Atom<any> | null
  readonly onSelect: (atom: Atom.Atom<any>) => void
  readonly searchQuery: string
  readonly onSearchChange: (query: string) => void
}

const getLabel = (atom: Atom.Atom<any>): string => atom.label?.[0] ?? String(atom)

const truncate = (str: string, max: number): string => str.length > max ? str.slice(0, max) + "..." : str

const valuePreview = (value: unknown): string => {
  try {
    return truncate(JSON.stringify(value), 50)
  } catch {
    return String(value)
  }
}

const listItemCss = `
.edt-item {
  padding: 6px 8px;
  cursor: pointer;
  background: transparent;
  border-bottom: 1px solid ${theme.border};
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: background 0.12s ease;
}
.edt-item:hover {
  background: ${theme.bgHover};
}
.edt-item[data-selected="true"] {
  background: ${theme.bgSelected};
}
`

/**
 * @since 1.0.0
 * @category components
 */
export const AtomList: React.FC<AtomListProps> = ({ nodes, selectedAtom, onSelect, searchQuery, onSearchChange }) => {
  const filtered = React.useMemo(() => {
    const entries = Array.from(nodes.entries())
    if (!searchQuery) return entries
    const q = searchQuery.toLowerCase()
    return entries.filter(([atom]) => getLabel(atom).toLowerCase().includes(q))
  }, [nodes, searchQuery])

  return (
    <div style={listPanelStyle}>
      <style>{listItemCss}</style>
      <input
        style={searchInputStyle}
        placeholder="Search atoms..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        data-testid="devtools-search"
      />
      <div style={listScrollStyle}>
        {filtered.map(([atom, snapshot]) => (
          <div
            key={getLabel(atom)}
            className="edt-item"
            data-selected={atom === selectedAtom}
            onClick={() => onSelect(atom)}
            data-testid="devtools-atom-item"
          >
            <div style={listItemRowStyle}>
              <span style={badgeStyle(stateColor(snapshot.node.state))} title={snapshot.node.state} />
              <span>{getLabel(atom)}</span>
              <span style={listenerBadgeStyle}>
                {snapshot.node.listenerCount > 0 ? `${snapshot.node.listenerCount}` : ""}
              </span>
            </div>
            <div style={valuePreviewStyle}>{valuePreview(snapshot.value)}</div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: "12px", color: "#a6adc8", textAlign: "center" }}>
            {searchQuery ? "No matching atoms" : "No atoms in registry"}
          </div>
        )}
      </div>
    </div>
  )
}
