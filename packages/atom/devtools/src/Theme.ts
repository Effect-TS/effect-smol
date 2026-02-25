/**
 * Color theme constants for atom devtools.
 *
 * @since 1.0.0
 */

/**
 * @since 1.0.0
 * @category theme
 */
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

/**
 * @since 1.0.0
 * @category theme
 */
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
