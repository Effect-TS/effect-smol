/**
 * @since 1.0.0
 */
"use client"

import * as AtomUtils from "@effect/atom-devtools/AtomUtils"
import type * as DevtoolsState from "@effect/atom-devtools/DevtoolsState"
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

/** @internal */
export interface AtomListProps {
  readonly entries: ReadonlyArray<readonly [Atom.Atom<any>, DevtoolsState.NodeSnapshot]>
  readonly selectedAtom: Atom.Atom<any> | null
  readonly onSelect: (atom: Atom.Atom<any>) => void
  readonly searchQuery: string
  readonly onSearchChange: (query: string) => void
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
export const AtomList: React.FC<AtomListProps> = ({ entries, selectedAtom, onSelect, searchQuery, onSearchChange }) => (
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
      {entries.map(([atom, snapshot]) => (
        <div
          key={AtomUtils.getLabel(atom)}
          className="edt-item"
          data-selected={atom === selectedAtom}
          onClick={() => onSelect(atom)}
          data-testid="devtools-atom-item"
        >
          <div style={listItemRowStyle}>
            <span style={badgeStyle(stateColor(snapshot.node.state))} title={snapshot.node.state} />
            <span>{AtomUtils.getLabel(atom)}</span>
            <span style={listenerBadgeStyle}>
              {snapshot.node.listenerCount > 0 ? `${snapshot.node.listenerCount}` : ""}
            </span>
          </div>
          <div style={valuePreviewStyle}>{AtomUtils.valuePreview(snapshot.value)}</div>
        </div>
      ))}
      {entries.length === 0 && (
        <div style={{ padding: "12px", color: "#a6adc8", textAlign: "center" }}>
          {searchQuery ? "No matching atoms" : "No atoms in registry"}
        </div>
      )}
    </div>
  </div>
)
