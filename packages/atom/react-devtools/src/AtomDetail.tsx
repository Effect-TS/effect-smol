/**
 * @since 1.0.0
 */
"use client"

import * as Atom from "effect/unstable/reactivity/Atom"
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import * as React from "react"
import {
  actionButtonStyle,
  detailLabelStyle,
  detailPanelStyle,
  detailSectionStyle,
  editableValueStyle,
  editingInputStyle,
  theme
} from "./styles.ts"
import type { NodeSnapshot } from "./useDevtoolsState.ts"

/** @internal */
export interface AtomDetailProps {
  readonly atom: Atom.Atom<any>
  readonly snapshot: NodeSnapshot
  readonly registry: AtomRegistry.AtomRegistry
  readonly onSelect: (atom: Atom.Atom<any>) => void
}

const getLabel = (atom: Atom.Atom<any>): string => atom.label?.[0] ?? String(atom)

const setAtPath = (root: unknown, path: ReadonlyArray<string>, value: unknown): unknown => {
  if (path.length === 0) return value
  const [head, ...tail] = path
  if (Array.isArray(root)) {
    const copy = [...root]
    copy[Number(head)] = setAtPath(copy[Number(head)], tail, value)
    return copy
  }
  return { ...(root as any), [head]: setAtPath((root as any)[head], tail, value) }
}

const removeAtPath = (root: unknown, path: ReadonlyArray<string>): unknown => {
  if (path.length === 0) return root
  if (path.length === 1) {
    if (Array.isArray(root)) return root.filter((_, i) => i !== Number(path[0]))
    const { [path[0]]: _, ...rest } = root as Record<string, unknown>
    return rest
  }
  const [head, ...tail] = path
  if (Array.isArray(root)) {
    const copy = [...root]
    copy[Number(head)] = removeAtPath(copy[Number(head)], tail)
    return copy
  }
  return { ...(root as any), [head]: removeAtPath((root as any)[head], tail) }
}

const appendToArray = (root: unknown, path: ReadonlyArray<string>, value: unknown): unknown => {
  if (path.length === 0) {
    if (Array.isArray(root)) return [...root, value]
    return root
  }
  const [head, ...tail] = path
  if (Array.isArray(root)) {
    const copy = [...root]
    copy[Number(head)] = appendToArray(copy[Number(head)], tail, value)
    return copy
  }
  return { ...(root as any), [head]: appendToArray((root as any)[head], tail, value) }
}

const addKeyToObject = (root: unknown, path: ReadonlyArray<string>, key: string, value: unknown): unknown => {
  if (path.length === 0) {
    return { ...(root as any), [key]: value }
  }
  const [head, ...tail] = path
  if (Array.isArray(root)) {
    const copy = [...root]
    copy[Number(head)] = addKeyToObject(copy[Number(head)], tail, key, value)
    return copy
  }
  return { ...(root as any), [head]: addKeyToObject((root as any)[head], tail, key, value) }
}

const parseValue = (input: string, current: unknown): unknown => {
  if (input === "null") return null
  if (input === "undefined") return undefined
  if (input === "true") return true
  if (input === "false") return false
  if (typeof current === "number") {
    const n = Number(input)
    if (!Number.isNaN(n)) return n
  }
  try {
    return JSON.parse(input)
  } catch {
    return input
  }
}

const EditableValue: React.FC<{
  readonly value: unknown
  readonly editable: boolean
  readonly onEdit: (value: unknown) => void
}> = ({ value, editable, onEdit }) => {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const [hovered, setHovered] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const startEdit = () => {
    if (!editable) return
    setDraft(typeof value === "string" ? value : JSON.stringify(value))
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    const parsed = parseValue(draft, value)
    if (parsed !== value) onEdit(parsed)
  }

  const cancel = () => setEditing(false)

  if (editing) {
    return (
      <input
        ref={inputRef}
        style={editingInputStyle}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") cancel()
        }}
        onBlur={commit}
        data-testid="devtools-inline-edit"
      />
    )
  }

  const color = typeof value === "string" ? theme.green : theme.accent

  return (
    <span
      style={{ ...editableValueStyle(hovered && editable), color }}
      onDoubleClick={startEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-testid="devtools-value-leaf"
    >
      {JSON.stringify(value)}
    </span>
  )
}

const smallButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: theme.textMuted,
  cursor: "pointer",
  padding: "0 3px",
  fontSize: "11px",
  lineHeight: 1,
  fontFamily: theme.fontFamily,
  borderRadius: "2px"
}

const addButtonStyle: React.CSSProperties = {
  ...smallButtonStyle,
  color: theme.accent,
  marginTop: "2px",
  marginLeft: "12px",
  fontSize: "11px"
}

const InlineAddInput: React.FC<{
  readonly placeholder: string
  readonly onSubmit: (value: string) => void
  readonly onCancel: () => void
}> = ({ placeholder, onSubmit, onCancel }) => {
  const [value, setValue] = React.useState("")
  const ref = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <input
      ref={ref}
      style={{ ...editingInputStyle, marginLeft: "12px", marginTop: "2px" }}
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && value) onSubmit(value)
        if (e.key === "Escape") onCancel()
      }}
      onBlur={() => {
        if (value) onSubmit(value)
        else onCancel()
      }}
      data-testid="devtools-add-input"
    />
  )
}

interface JsonTreeProps {
  readonly data: unknown
  readonly depth?: number
  readonly path?: ReadonlyArray<string>
  readonly editable: boolean
  readonly onEdit: (path: ReadonlyArray<string>, value: unknown) => void
  readonly onRemove: (path: ReadonlyArray<string>) => void
  readonly onAppend: (path: ReadonlyArray<string>, value: unknown) => void
  readonly onAddKey: (path: ReadonlyArray<string>, key: string, value: unknown) => void
}

const JsonTree: React.FC<JsonTreeProps> = ({
  data,
  depth = 0,
  path = [],
  editable,
  onEdit,
  onRemove,
  onAppend,
  onAddKey
}) => {
  const [adding, setAdding] = React.useState(false)
  const [addingKey, setAddingKey] = React.useState(false)
  const [hoveredIndex, setHoveredIndex] = React.useState<string | null>(null)

  if (data === null || data === undefined || typeof data !== "object") {
    return <EditableValue value={data} editable={editable} onEdit={(v) => onEdit(path, v)} />
  }

  const isArray = Array.isArray(data)
  const entries = isArray
    ? data.map((v, i) => [String(i), v] as const)
    : Object.entries(data as Record<string, unknown>)

  if (depth > 4) {
    return <span style={{ color: theme.textMuted }}>{isArray ? "[...]" : "{...}"}</span>
  }

  return (
    <details open={depth < 2} style={{ marginLeft: depth > 0 ? "12px" : 0 }}>
      <summary style={{ cursor: "pointer", color: theme.textMuted }}>
        {isArray ? `Array(${data.length})` : `Object(${entries.length})`}
      </summary>
      {entries.map(([key, value]) => (
        <div
          key={key}
          style={{ marginLeft: "12px", marginTop: "2px", display: "flex", alignItems: "flex-start", gap: "2px" }}
          onMouseEnter={() => setHoveredIndex(key)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <div style={{ flex: 1 }}>
            <span style={{ color: theme.accent }}>{key}</span>
            <span style={{ color: theme.textMuted }}>:</span>
            <JsonTree
              data={value}
              depth={depth + 1}
              path={[...path, key]}
              editable={editable}
              onEdit={onEdit}
              onRemove={onRemove}
              onAppend={onAppend}
              onAddKey={onAddKey}
            />
          </div>
          {editable && hoveredIndex === key && (
            <button
              style={{ ...smallButtonStyle, color: theme.red }}
              onClick={() => onRemove([...path, key])}
              title="Remove"
              data-testid="devtools-remove-btn"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {editable && isArray && !adding && (
        <button
          style={addButtonStyle}
          onClick={() => setAdding(true)}
          data-testid="devtools-array-add-btn"
        >
          + Add item
        </button>
      )}
      {editable && isArray && adding && (
        <InlineAddInput
          placeholder="value (Enter to add)"
          onSubmit={(v) => {
            onAppend(path, parseValue(v, undefined))
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      {editable && !isArray && !addingKey && (
        <button
          style={addButtonStyle}
          onClick={() => setAddingKey(true)}
          data-testid="devtools-object-add-btn"
        >
          + Add key
        </button>
      )}
      {editable && !isArray && addingKey && (
        <ObjectAddInput
          onSubmit={(key, val) => {
            onAddKey(path, key, parseValue(val, undefined))
            setAddingKey(false)
          }}
          onCancel={() => setAddingKey(false)}
        />
      )}
    </details>
  )
}

const ObjectAddInput: React.FC<{
  readonly onSubmit: (key: string, value: string) => void
  readonly onCancel: () => void
}> = ({ onSubmit, onCancel }) => {
  const [key, setKey] = React.useState("")
  const [value, setValue] = React.useState("")
  const ref = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div style={{ marginLeft: "12px", marginTop: "2px", display: "flex", gap: "4px", alignItems: "center" }}>
      <input
        ref={ref}
        style={{ ...editingInputStyle, width: "80px" }}
        placeholder="key"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel()
        }}
        data-testid="devtools-addkey-key"
      />
      <span style={{ color: theme.textMuted }}>:</span>
      <input
        style={{ ...editingInputStyle, width: "80px" }}
        placeholder="value"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && key) onSubmit(key, value || "null")
          if (e.key === "Escape") onCancel()
        }}
        data-testid="devtools-addkey-value"
      />
    </div>
  )
}

const copyToClipboard = (value: unknown) => {
  try {
    navigator.clipboard.writeText(typeof value === "string" ? value : JSON.stringify(value, null, 2))
  } catch {
    // clipboard not available
  }
}

/**
 * @since 1.0.0
 * @category components
 */
const atomLinkStyle: React.CSSProperties = {
  color: theme.accent,
  cursor: "pointer",
  textDecoration: "none"
}

const atomLinkCss = `
.edt-atom-link:hover {
  text-decoration: underline;
}
`

export const AtomDetail: React.FC<AtomDetailProps> = ({ atom, snapshot, registry, onSelect }) => {
  const isWritable = Atom.isWritable(atom)

  const apply = (next: unknown) => {
    if (!isWritable) return
    registry.set(atom as Atom.Writable<any, any>, next)
  }

  const handleEdit = (path: ReadonlyArray<string>, value: unknown) => {
    apply(setAtPath(snapshot.value, path, value))
  }

  const handleRemove = (path: ReadonlyArray<string>) => {
    apply(removeAtPath(snapshot.value, path))
  }

  const handleAppend = (path: ReadonlyArray<string>, value: unknown) => {
    apply(appendToArray(snapshot.value, path, value))
  }

  const handleAddKey = (path: ReadonlyArray<string>, key: string, value: unknown) => {
    apply(addKeyToObject(snapshot.value, path, key, value))
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
        <div style={detailLabelStyle}>
          Value
          {isWritable && (
            <span style={{ fontWeight: "normal", textTransform: "none", marginLeft: "8px", fontSize: "10px" }}>
              double-click to edit
            </span>
          )}
        </div>
        <div
          style={{
            background: theme.bgHover,
            padding: "8px",
            borderRadius: "4px",
            overflow: "auto",
            maxHeight: "200px"
          }}
        >
          <JsonTree
            data={snapshot.value}
            editable={isWritable}
            onEdit={handleEdit}
            onRemove={handleRemove}
            onAppend={handleAppend}
            onAddKey={handleAddKey}
          />
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

      <style>{atomLinkCss}</style>

      {/* Dependencies */}
      {snapshot.node.parents.length > 0 && (
        <div style={detailSectionStyle}>
          <div style={detailLabelStyle}>Dependencies ({snapshot.node.parents.length})</div>
          {snapshot.node.parents.map((parent, i) => (
            <div
              key={i}
              className="edt-atom-link"
              style={atomLinkStyle}
              onClick={() => onSelect(parent.atom)}
              data-testid="devtools-dep-link"
            >
              {getLabel(parent.atom)}
            </div>
          ))}
        </div>
      )}

      {/* Dependents */}
      {snapshot.node.children.length > 0 && (
        <div style={detailSectionStyle}>
          <div style={detailLabelStyle}>Dependents ({snapshot.node.children.length})</div>
          {snapshot.node.children.map((child, i) => (
            <div
              key={i}
              className="edt-atom-link"
              style={atomLinkStyle}
              onClick={() => onSelect(child.atom)}
              data-testid="devtools-dep-link"
            >
              {getLabel(child.atom)}
            </div>
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
          <button
            style={actionButtonStyle}
            onClick={() => copyToClipboard(snapshot.value)}
            data-testid="devtools-copy-btn"
          >
            Copy
          </button>
          {!isWritable && (
            <button style={actionButtonStyle} onClick={handleRefresh} data-testid="devtools-refresh-btn">
              Recompute
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
