/**
 * @since 1.0.0
 */
import type * as React from "react"

/** @internal */
export const theme = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: "12px",
  bg: "#1e1e2e",
  bgHover: "#313244",
  bgSelected: "#45475a",
  text: "#cdd6f4",
  textMuted: "#a6adc8",
  border: "#585b70",
  accent: "#89b4fa",
  green: "#a6e3a1",
  yellow: "#f9e2af",
  red: "#f38ba8",
  zIndex: 99999
} as const

/** @internal */
export const panelStyle = (position: "top" | "bottom" | "left" | "right"): React.CSSProperties => {
  const base: React.CSSProperties = {
    position: "fixed",
    zIndex: theme.zIndex,
    background: theme.bg,
    color: theme.text,
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    borderColor: theme.border,
    borderStyle: "solid",
    borderWidth: 0,
    display: "flex",
    boxSizing: "border-box"
  }
  switch (position) {
    case "bottom":
      return { ...base, bottom: 0, left: 0, right: 0, height: "350px", borderTopWidth: "1px", flexDirection: "row" }
    case "top":
      return { ...base, top: 0, left: 0, right: 0, height: "350px", borderBottomWidth: "1px", flexDirection: "row" }
    case "left":
      return { ...base, top: 0, left: 0, bottom: 0, width: "400px", borderRightWidth: "1px", flexDirection: "column" }
    case "right":
      return { ...base, top: 0, right: 0, bottom: 0, width: "400px", borderLeftWidth: "1px", flexDirection: "column" }
  }
}

/** @internal */
export const toggleButtonStyle = (
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right"
): React.CSSProperties => {
  const pos: React.CSSProperties = {}
  if (corner.includes("top")) pos.top = "8px"
  if (corner.includes("bottom")) pos.bottom = "8px"
  if (corner.includes("left")) pos.left = "8px"
  if (corner.includes("right")) pos.right = "8px"
  return {
    position: "fixed",
    zIndex: theme.zIndex + 1,
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: theme.accent,
    color: theme.bg,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: "16px",
    ...pos
  }
}

/** @internal */
export const listPanelStyle: React.CSSProperties = {
  width: "260px",
  minWidth: "260px",
  borderRight: `1px solid ${theme.border}`,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
}

/** @internal */
export const searchInputStyle: React.CSSProperties = {
  padding: "8px",
  background: theme.bgHover,
  color: theme.text,
  border: "none",
  borderBottom: `1px solid ${theme.border}`,
  fontFamily: theme.fontFamily,
  fontSize: theme.fontSize,
  outline: "none",
  boxSizing: "border-box",
  width: "100%"
}

/** @internal */
export const listItemStyle = (selected: boolean, hovered: boolean): React.CSSProperties => ({
  padding: "6px 8px",
  cursor: "pointer",
  background: selected ? theme.bgSelected : hovered ? theme.bgHover : "transparent",
  borderBottom: `1px solid ${theme.border}`,
  display: "flex",
  flexDirection: "column",
  gap: "2px"
})

/** @internal */
export const badgeStyle = (color: string): React.CSSProperties => ({
  display: "inline-block",
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  background: color,
  marginRight: "6px",
  flexShrink: 0
})

/** @internal */
export const detailPanelStyle: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "12px"
}

/** @internal */
export const detailSectionStyle: React.CSSProperties = {
  marginBottom: "12px"
}

/** @internal */
export const detailLabelStyle: React.CSSProperties = {
  color: theme.textMuted,
  fontSize: "10px",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: "4px"
}

/** @internal */
export const actionButtonStyle: React.CSSProperties = {
  padding: "4px 8px",
  background: theme.accent,
  color: theme.bg,
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontFamily: theme.fontFamily,
  fontSize: theme.fontSize,
  marginRight: "4px"
}

/** @internal */
export const actionInputStyle: React.CSSProperties = {
  padding: "4px 8px",
  background: theme.bgHover,
  color: theme.text,
  border: `1px solid ${theme.border}`,
  borderRadius: "4px",
  fontFamily: theme.fontFamily,
  fontSize: theme.fontSize,
  outline: "none",
  flex: 1
}

/** @internal */
export const stateColor = (state: string): string => {
  switch (state) {
    case "valid":
      return theme.green
    case "stale":
      return theme.yellow
    case "uninitialized":
      return theme.textMuted
    default:
      return theme.red
  }
}

/** @internal */
export const listScrollStyle: React.CSSProperties = {
  overflow: "auto",
  flex: 1
}

/** @internal */
export const listItemRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "4px"
}

/** @internal */
export const valuePreviewStyle: React.CSSProperties = {
  color: theme.textMuted,
  fontSize: "11px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
}

/** @internal */
export const listenerBadgeStyle: React.CSSProperties = {
  fontSize: "10px",
  color: theme.textMuted,
  marginLeft: "auto",
  flexShrink: 0
}
