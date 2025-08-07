/**
 * Built-in options that are automatically available for CLI commands.
 * @since 4.0.0
 * @internal
 */

import type * as Option from "effect/data/Option"
import type { LogLevel } from "effect/logging/LogLevel"
import * as Flag from "./flag.ts"

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
