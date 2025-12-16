/**
 * Built-in options that are automatically available for CLI commands.
 * @since 4.0.0
 * @internal
 */

import type { LogLevel } from "../../../LogLevel.ts"
import * as Option from "../../../Option.ts"
import * as Flag from "../Flag.ts"

/**
 * Built-in --log-level option with all Effect LogLevel values.
 * Maps CLI strings to proper LogLevel constants.
 *
 * @since 4.0.0
 * @internal
 */
export const logLevelFlag: Flag.Flag<Option.Option<LogLevel>> = Flag
  .choiceWithValue(
    "log-level",
    [
      ["all", "All"],
      ["trace", "Trace"],
      ["debug", "Debug"],
      ["info", "Info"],
      ["warn", "Warn"],
      ["warning", "Warn"], // alias
      ["error", "Error"],
      ["fatal", "Fatal"],
      ["none", "None"]
    ] as const
  )
  .pipe(
    Flag.optional,
    Flag.withDescription("Sets the minimum log level for the command")
  )

/**
 * Built-in --help/-h option.
 *
 * @since 4.0.0
 * @internal
 */
export const helpFlag: Flag.Flag<boolean> = Flag
  .boolean("help")
  .pipe(
    Flag.withAlias("h"),
    Flag.withDescription("Show help information")
  )

/**
 * Built-in --version option.
 *
 * @since 4.0.0
 * @internal
 */
export const versionFlag: Flag.Flag<boolean> = Flag
  .boolean("version")
  .pipe(
    Flag.withDescription("Show version information")
  )

/**
 * Built-in --completions option to print shell completion scripts.
 * Generates a dynamic completion shim that calls the CLI at runtime.
 * Accepts one of: bash | zsh | fish | sh (alias of bash).
 *
 * @since 4.0.0
 * @internal
 */
export const completionsFlag: Flag.Flag<Option.Option<"bash" | "zsh" | "fish">> = Flag
  .choice("completions", ["bash", "zsh", "fish", "sh"] as const)
  .pipe(
    Flag.optional,
    // Map "sh" to "bash" while preserving Option-ness
    Flag.map((v) => Option.map(v, (s) => (s === "sh" ? "bash" : s))),
    Flag.withDescription("Print shell completion script for the given shell")
  )
