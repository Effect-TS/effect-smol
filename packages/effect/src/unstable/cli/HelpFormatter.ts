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
 * @example
 * ```ts
 * import { HelpFormatter } from "effect/unstable/cli"
 * import * as Effect from "effect/Effect"
 *
 * // Create a custom renderer implementation
 * const customRenderer: HelpFormatter.HelpRenderer = {
 *   formatHelpDoc: (doc) => `Custom Help: ${doc.usage}`,
 *   formatCliError: (error) => `Error: ${error.message}`,
 *   formatError: (error) => `[ERROR] ${error.message}`,
 *   formatVersion: (name, version) => `${name} (${version})`
 * }
 *
 * // Use the custom renderer in a program
 * const program = Effect.gen(function* () {
 *   const renderer = yield* HelpFormatter.HelpRenderer
 *   const helpText = renderer.formatVersion("myapp", "1.0.0")
 *   console.log(helpText)
 * }).pipe(
 *   Effect.provide(HelpFormatter.layer(customRenderer))
 * )
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface HelpRenderer {
  /**
   * Formats a HelpDoc structure into a readable string format.
   *
   * @example
   * ```ts
   * import { HelpFormatter, HelpDoc } from "effect/unstable/cli"
   *
   * const helpDoc: HelpDoc = {
   *   usage: "myapp [options] <file>",
   *   description: "Process files with various options",
   *   flags: [
   *     {
   *       name: "verbose",
   *       aliases: ["-v"],
   *       type: "boolean",
   *       description: "Enable verbose output",
   *       required: false
   *     }
   *   ],
   *   args: [
   *     {
   *       name: "file",
   *       type: "string",
   *       description: "Input file to process",
   *       required: true,
   *       variadic: false
   *     }
   *   ]
   * }
   *
   * const renderer = HelpFormatter.defaultHelpRenderer()
   * const helpText = renderer.formatHelpDoc(helpDoc)
   * console.log(helpText)
   * // Outputs formatted help with sections: DESCRIPTION, USAGE, ARGUMENTS, FLAGS
   * ```
   *
   * @since 4.0.0
   */
  readonly formatHelpDoc: (doc: HelpDoc) => string

  /**
   * Formats a CLI error for display. Default implementation mirrors the error message.
   *
   * @example
   * ```ts
   * import { HelpFormatter, CliError } from "effect/unstable/cli"
   * import * as Data from "effect/Data"
   *
   * class InvalidOption extends Data.TaggedError("InvalidOption")<{
   *   readonly message: string
   * }> {}
   *
   * const renderer = HelpFormatter.defaultHelpRenderer()
   * const error = new InvalidOption({ message: "Unknown flag '--invalid'" })
   * const errorMessage = renderer.formatCliError(error)
   * console.log(errorMessage) // "Unknown flag '--invalid'"
   * ```
   *
   * @since 4.0.0
   */
  readonly formatCliError: (error: CliError.CliError) => string

  /**
   * Formats an error section with proper styling and color reset.
   *
   * @example
   * ```ts
   * import { HelpFormatter, CliError } from "effect/unstable/cli"
   * import * as Data from "effect/Data"
   *
   * class ValidationError extends Data.TaggedError("ValidationError")<{
   *   readonly message: string
   * }> {}
   *
   * const colorRenderer = HelpFormatter.defaultHelpRenderer({ colors: true })
   * const noColorRenderer = HelpFormatter.defaultHelpRenderer({ colors: false })
   *
   * const error = new ValidationError({ message: "Value must be positive" })
   *
   * const coloredError = colorRenderer.formatError(error)
   * console.log(coloredError) // "\n\x1b[1m\x1b[31mERROR\x1b[0m\n  Value must be positive\x1b[0m"
   *
   * const plainError = noColorRenderer.formatError(error)
   * console.log(plainError) // "\nERROR\n  Value must be positive"
   * ```
   *
   * @since 4.0.0
   */
  readonly formatError: (error: CliError.CliError) => string

  /**
   * Formats version output for display.
   *
   * @example
   * ```ts
   * import { HelpFormatter } from "effect/unstable/cli"
   *
   * const colorRenderer = HelpFormatter.defaultHelpRenderer({ colors: true })
   * const noColorRenderer = HelpFormatter.defaultHelpRenderer({ colors: false })
   *
   * const appName = "my-awesome-tool"
   * const version = "1.2.3"
   *
   * const coloredVersion = colorRenderer.formatVersion(appName, version)
   * console.log(coloredVersion) // "\x1b[1mmy-awesome-tool\x1b[0m \x1b[2mv\x1b[0m\x1b[1m1.2.3\x1b[0m"
   *
   * const plainVersion = noColorRenderer.formatVersion(appName, version)
   * console.log(plainVersion) // "my-awesome-tool v1.2.3"
   * ```
   *
   * @since 4.0.0
   */
  readonly formatVersion: (name: string, version: string) => string
}

/**
 * Service reference for the help renderer. Provides a default implementation
 * that can be overridden for custom formatting or testing.
 *
 * @example
 * ```ts
 * import { HelpFormatter } from "effect/unstable/cli"
 * import * as Effect from "effect/Effect"
 *
 * // Access the help renderer service
 * const program = Effect.gen(function* () {
 *   const renderer = yield* HelpFormatter.HelpRenderer
 *
 *   // Format version information
 *   const versionText = renderer.formatVersion("my-cli", "2.1.0")
 *   console.log(versionText) // "my-cli v2.1.0" (with colors if supported)
 *
 *   return versionText
 * })
 *
 * // Run with default renderer
 * const result = Effect.runSync(program)
 * ```
 *
 * @since 4.0.0
 * @category services
 */
export const HelpRenderer: ServiceMap.Reference<HelpRenderer> = ServiceMap.Reference(
  "effect/cli/HelpRenderer",
  { defaultValue: () => defaultHelpRenderer() }
)

/**
 * Creates a Layer that provides a custom HelpRenderer implementation.
 *
 * @example
 * ```ts
 * import { HelpFormatter } from "effect/unstable/cli"
 * import * as Effect from "effect/Effect"
 * import * as Console from "effect/Console"
 *
 * // Create a custom renderer without colors
 * const noColorRenderer = HelpFormatter.defaultHelpRenderer({ colors: false })
 * const NoColorLayer = HelpFormatter.layer(noColorRenderer)
 *
 * // Create a program that uses the custom help renderer
 * const program = Effect.gen(function* () {
 *   const renderer = yield* HelpFormatter.HelpRenderer
 *   const versionText = renderer.formatVersion("my-cli", "1.0.0")
 *   yield* Console.log(`Using custom renderer: ${versionText}`)
 * }).pipe(
 *   Effect.provide(NoColorLayer)
 * )
 *
 * // You can also create completely custom renderers
 * const jsonRenderer: HelpFormatter.HelpRenderer = {
 *   formatHelpDoc: (doc) => JSON.stringify(doc, null, 2),
 *   formatCliError: (error) => JSON.stringify({ error: error.message }),
 *   formatError: (error) => JSON.stringify({ type: "error", message: error.message }),
 *   formatVersion: (name, version) => JSON.stringify({ name, version })
 * }
 * const JsonLayer = HelpFormatter.layer(jsonRenderer)
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
 * import { HelpFormatter } from "effect/unstable/cli"
 * import * as Effect from "effect/Effect"
 * import * as Data from "effect/Data"
 *
 * // Create a renderer without colors for tests or CI environments
 * const noColorRenderer = HelpFormatter.defaultHelpRenderer({ colors: false })
 *
 * // Create a renderer with colors forced on
 * const colorRenderer = HelpFormatter.defaultHelpRenderer({ colors: true })
 *
 * // Auto-detect colors based on terminal support (default behavior)
 * const autoRenderer = HelpFormatter.defaultHelpRenderer()
 *
 * // Use the renderer in a program
 * class MyError extends Data.TaggedError("MyError")<{ message: string }> {}
 *
 * const program = Effect.gen(function* () {
 *   const renderer = colorRenderer
 *
 *   // Format an error with proper styling
 *   const error = new MyError({ message: "Invalid argument provided" })
 *   const errorText = renderer.formatError(error)
 *   console.log(errorText)
 *
 *   // Format version information
 *   const versionText = renderer.formatVersion("my-tool", "1.2.3")
 *   console.log(versionText)
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const defaultHelpRenderer = (options?: { colors?: boolean }): HelpRenderer => {
  const globalProcess = (globalThis as any).process
  const hasProcess = typeof globalProcess === "object" && globalProcess !== null

  const useColor = options?.colors !== undefined
    ? options.colors
    // Auto-detect based on environment
    : (hasProcess &&
      typeof globalProcess.stdout === "object" &&
      globalProcess.stdout !== null &&
      globalProcess.stdout.isTTY === true &&
      globalProcess.env?.NO_COLOR !== "1")

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
    formatError: (error): string => {
      const reset = useColor ? "\x1b[0m" : ""
      const red = useColor ? "\x1b[31m" : ""
      const bold = useColor ? "\x1b[1m" : ""
      return `\n${bold}${red}ERROR${reset}\n  ${error.message}${reset}`
    },
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
