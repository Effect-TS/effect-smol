/**
 * @since 1.0.0
 */
"use client"

import * as Atom from "effect/unstable/reactivity/Atom"
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import * as React from "react"
import {
  actionButtonStyle,
  actionInputStyle,
  detailLabelStyle,
  detailPanelStyle,
  detailSectionStyle,
  theme
} from "./styles.ts"
import type { NodeSnapshot } from "./useDevtoolsState.ts"

/** @internal */
export interface AtomDetailProps {
  readonly atom: Atom.Atom<any>
  readonly snapshot: NodeSnapshot
  readonly registry: AtomRegistry.AtomRegistry
}

const getLabel = (atom: Atom.Atom<any>): string => atom.label?.[0] ?? String(atom)

const JsonTree: React.FC<{ readonly data: unknown; readonly depth?: number }> = ({ data, depth = 0 }) => {
  if (data === null || data === undefined || typeof data !== "object") {
    return <span style={{ color: typeof data === "string" ? theme.green : theme.accent }}>{JSON.stringify(data)}</span>
  }
  const entries = Array.isArray(data)
    ? data.map((v, i) => [String(i), v] as const)
    : Object.entries(data as Record<string, unknown>)

  if (entries.length === 0) {
    return <span style={{ color: theme.textMuted }}>{Array.isArray(data) ? "[]" : "{}"}</span>
  }

  if (depth > 4) {
    return <span style={{ color: theme.textMuted }}>{Array.isArray(data) ? "[...]" : "{...}"}</span>
  }

  return (
    <details open={depth < 2} style={{ marginLeft: depth > 0 ? "12px" : 0 }}>
      <summary style={{ cursor: "pointer", color: theme.textMuted }}>
        {Array.isArray(data) ? `Array(${data.length})` : `Object(${entries.length})`}
      </summary>
      {entries.map(([key, value]) => (
        <div key={key} style={{ marginLeft: "12px", marginTop: "2px" }}>
          <span style={{ color: theme.accent }}>{key}</span>
          <span style={{ color: theme.textMuted }}>:</span>
          <JsonTree data={value} depth={depth + 1} />
        </div>
      ))}
    </details>
  )
}

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/**
 * @since 1.0.0
 * @category components
 */
export const AtomDetail: React.FC<AtomDetailProps> = ({ atom, snapshot, registry }) => {
  const [setInput, setSetInput] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const isWritable = Atom.isWritable(atom)

  const handleSet = () => {
    try {
      const parsed = JSON.parse(setInput)
      registry.set(atom as Atom.Writable<any, any>, parsed)
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }

  const handleRefresh = () => {
    registry.refresh(atom)
  }

  return (
    <div style={detailPanelStyle} data-testid="devtools-detail">
      <div style={{ marginBottom: "12px", fontSize: "14px", fontWeight: "bold" }}>
        {getLabel(atom)}
      </div>

      {/* Value */}
      <div style={detailSectionStyle}>
        <div style={detailLabelStyle}>Value</div>
        <div
          style={{
            background: theme.bgHover,
            padding: "8px",
            borderRadius: "4px",
            overflow: "auto",
            maxHeight: "200px"
          }}
        >
          <JsonTree data={snapshot.value} />
        </div>
      </div>

      {/* State */}
      <div style={detailSectionStyle}>
        <div style={detailLabelStyle}>State</div>
        <span>{snapshot.node.state}</span>
        <span style={{ marginLeft: "8px", color: theme.textMuted }}>
          ({snapshot.node.listenerCount} listener{snapshot.node.listenerCount !== 1 ? "s" : ""})
        </span>
      </div>

      {/* Metadata */}
      <div style={detailSectionStyle}>
        <div style={detailLabelStyle}>Metadata</div>
        <div style={{ color: theme.textMuted }}>
          {atom.keepAlive && <div>keepAlive: true</div>}
          {atom.lazy && <div>lazy: true</div>}
          {atom.idleTTL !== undefined && <div>idleTTL: {atom.idleTTL}ms</div>}
        </div>
      </div>

      {/* Dependencies */}
      {snapshot.node.parents.length > 0 && (
        <div style={detailSectionStyle}>
          <div style={detailLabelStyle}>Dependencies ({snapshot.node.parents.length})</div>
          {snapshot.node.parents.map((parent, i) => (
            <div key={i} style={{ color: theme.textMuted }}>{getLabel(parent.atom)}</div>
          ))}
        </div>
      )}

      {/* Dependents */}
      {snapshot.node.children.length > 0 && (
        <div style={detailSectionStyle}>
          <div style={detailLabelStyle}>Dependents ({snapshot.node.children.length})</div>
          {snapshot.node.children.map((child, i) => (
            <div key={i} style={{ color: theme.textMuted }}>{getLabel(child.atom)}</div>
          ))}
        </div>
      )}

      {/* Label stack trace */}
      {atom.label?.[1] && (
        <div style={detailSectionStyle}>
          <div style={detailLabelStyle}>Created at</div>
          <pre style={{ color: theme.textMuted, fontSize: "10px", whiteSpace: "pre-wrap", margin: 0 }}>
            {atom.label[1]}
          </pre>
        </div>
      )}

      {/* Actions */}
      <div style={detailSectionStyle}>
        <div style={detailLabelStyle}>Actions</div>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {isWritable && (
            <>
              <input
                style={actionInputStyle}
                placeholder={safeStringify(snapshot.value)}
                value={setInput}
                onChange={(e) => setSetInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSet()}
                data-testid="devtools-set-input"
              />
              <button style={actionButtonStyle} onClick={handleSet} data-testid="devtools-set-btn">
                Set
              </button>
            </>
          )}
          <button style={actionButtonStyle} onClick={handleRefresh} data-testid="devtools-refresh-btn">
            Refresh
          </button>
        </div>
        {error && <div style={{ color: theme.red, marginTop: "4px", fontSize: "11px" }}>{error}</div>}
      </div>
    </div>
  )
}
