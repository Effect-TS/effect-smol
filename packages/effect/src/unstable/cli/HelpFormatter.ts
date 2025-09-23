/**
 * @since 4.0.0
 */

import * as Layer from "../../Layer.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as CliError from "./CliError.ts"
import type { HelpDoc } from "./HelpDoc.ts"

/**
 * Service interface for rendering help documentation into formatted text.
 * This allows customization of help output formatting, including color support.
 *
 * @since 4.0.0
 * @category models
 */
export interface HelpRenderer {
  readonly formatHelpDoc: (doc: HelpDoc) => string
  /**
   * Formats a CLI error for display. Default implementation mirrors the error message.
   * @since 4.0.0
   */
  readonly formatCliError: (error: CliError.CliError) => string
  /**
   * Formats version output for display.
   * @since 4.0.0
   */
  readonly formatVersion: (name: string, version: string) => string
}

/**
 * Service reference for the help renderer. Provides a default implementation
 * that can be overridden for custom formatting or testing.
 *
 * @since 4.0.0
 * @category services
 */
export const HelpRenderer: ServiceMap.Reference<HelpRenderer> = ServiceMap.Reference(
  "effect/cli/HelpRenderer",
  {
    defaultValue: () => defaultHelpRenderer({ colors: true })
  }
)

/**
 * Creates a Layer that provides a custom HelpRenderer implementation.
 *
 * @example
 * ```ts
 * import * as HelpFormatter from "effect/cli/HelpFormatter"
 * import * as Effect from "effect/Effect"
 *
 * // Create a custom renderer without colors
 * const noColorRenderer = HelpFormatter.defaultHelpRenderer({ colors: false })
 * const NoColorLayer = HelpFormatter.layer(noColorRenderer)
 *
 * const program = Effect.log("Help will be rendered without colors").pipe(
 *   Effect.provide(NoColorLayer)
 * )
 * ```
 *
 * @since 4.0.0
 * @category layers
 */
export const layer = (renderer: HelpRenderer): Layer.Layer<never> => Layer.succeed(HelpRenderer)(renderer)

/**
 * Creates a default help renderer with configurable options.
 *
 * @example
 * ```ts
 * import * as HelpFormatter from "effect/cli/HelpFormatter"
 *
 * // Create a renderer without colors for tests
 * const noColorRenderer = HelpFormatter.defaultHelpRenderer({ colors: false })
 *
 * // Create a renderer with colors for production
 * const colorRenderer = HelpFormatter.defaultHelpRenderer({ colors: true })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const defaultHelpRenderer = (options: { colors: boolean }): HelpRenderer => {
  const globalProcess = (globalThis as any).process
  const hasProcess = typeof globalProcess === "object" && globalProcess !== null
  const useColor = options.colors &&
    hasProcess &&
    typeof globalProcess.stdout === "object" &&
    globalProcess.stdout !== null &&
    globalProcess.stdout.isTTY === true &&
    globalProcess.env?.NO_COLOR !== "1"

  // Color palette using ANSI escape codes
  const colors = useColor
    ? {
      bold: (text: string): string => `\x1b[1m${text}\x1b[0m`,
      dim: (text: string): string => `\x1b[2m${text}\x1b[0m`,
      cyan: (text: string): string => `\x1b[36m${text}\x1b[0m`,
      green: (text: string): string => `\x1b[32m${text}\x1b[0m`,
      blue: (text: string): string => `\x1b[34m${text}\x1b[0m`,
      yellow: (text: string): string => `\x1b[33m${text}\x1b[0m`,
      magenta: (text: string): string => `\x1b[35m${text}\x1b[0m`
    }
    : {
      bold: (text: string): string => text,
      dim: (text: string): string => text,
      cyan: (text: string): string => text,
      green: (text: string): string => text,
      blue: (text: string): string => text,
      yellow: (text: string): string => text,
      magenta: (text: string): string => text
    }

  return {
    formatHelpDoc: (doc: HelpDoc): string => formatHelpDocImpl(doc, colors),
    formatCliError: (error): string => error.message,
    formatVersion: (name: string, version: string): string =>
      `${colors.bold(name)} ${colors.dim("v")}${colors.bold(version)}`
  }
}

/**
 * Strips ANSI escape codes from a string to calculate visual width.
 * @internal
 */
const stripAnsi = (text: string): string => {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001B\[[0-9;]*m/g, "")
}

/**
 * Gets the visual length of a string (excluding ANSI codes).
 * @internal
 */
const visualLength = (text: string): number => stripAnsi(text).length

/**
 * Helper function to pad strings to a specified width.
 * @internal
 */
const pad = (s: string, width: number) => {
  const actualLength = visualLength(s)
  const padding = Math.max(0, width - actualLength)
  return s + " ".repeat(padding)
}

/**
 * Interface for table rows with left and right columns.
 * @internal
 */
interface Row {
  left: string
  right: string
}

/**
 * Renders a table with aligned columns.
 * @internal
 */
const renderTable = (rows: ReadonlyArray<Row>, widthCap: number) => {
  const col = Math.min(Math.max(...rows.map((r) => visualLength(r.left))) + 4, widthCap)
  return rows.map(({ left, right }) => `  ${pad(left, col)}${right}`).join("\n")
}

/**
 * Color functions interface for help formatting.
 * @internal
 */
interface ColorFunctions {
  readonly bold: (text: string) => string
  readonly dim: (text: string) => string
  readonly cyan: (text: string) => string
  readonly green: (text: string) => string
  readonly blue: (text: string) => string
  readonly yellow: (text: string) => string
  readonly magenta: (text: string) => string
}

/**
 * Internal implementation of help formatting that accepts configurable color functions.
 * @internal
 */
const formatHelpDocImpl = (doc: HelpDoc, colors: ColorFunctions): string => {
  const sections: Array<string> = []

  // Description section
  if (doc.description) {
    sections.push(colors.bold("DESCRIPTION"))
    sections.push(`  ${doc.description}`)
    sections.push("")
  }

  // Usage section
  sections.push(colors.bold("USAGE"))
  sections.push(`  ${colors.cyan(doc.usage)}`)
  sections.push("")

  // Arguments section
  if (doc.args && doc.args.length > 0) {
    sections.push(colors.bold("ARGUMENTS"))

    const argRows: Array<Row> = doc.args.map((arg) => {
      let name = arg.name
      if (arg.variadic) {
        name += "..."
      }

      const coloredName = colors.green(name)
      const coloredType = colors.dim(arg.type)
      const nameType = `${coloredName} ${coloredType}`

      const optionalSuffix = arg.required ? "" : colors.dim(" (optional)")
      const description = (arg.description || "") + optionalSuffix

      return {
        left: nameType,
        right: description
      }
    })

    sections.push(renderTable(argRows, 25))
    sections.push("")
  }

  // Flags section
  if (doc.flags.length > 0) {
    sections.push(colors.bold("FLAGS"))

    const flagRows: Array<Row> = doc.flags.map((flag) => {
      const names: Array<string> = []

      // Add main name with -- prefix first
      names.push(colors.green(`--${flag.name}`))

      // Add aliases after (like -f) to match expected ordering
      for (const alias of flag.aliases) {
        names.push(colors.green(alias))
      }

      const namesPart = names.join(", ")
      const typePart = flag.type !== "boolean" ? ` ${colors.dim(flag.type)}` : ""

      return {
        left: namesPart + typePart,
        right: flag.description || ""
      }
    })

    sections.push(renderTable(flagRows, 30))
    sections.push("")
  }

  // Subcommands section
  if (doc.subcommands && doc.subcommands.length > 0) {
    sections.push(colors.bold("SUBCOMMANDS"))

    const subcommandRows: Array<Row> = doc.subcommands.map((sub) => ({
      left: colors.cyan(sub.name),
      right: sub.description || ""
    }))

    sections.push(renderTable(subcommandRows, 20))
    sections.push("")
  }

  // Remove trailing empty line if present
  if (sections[sections.length - 1] === "") {
    sections.pop()
  }

  return sections.join("\n")
}
