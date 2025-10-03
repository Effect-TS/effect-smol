/**
 * @since 4.0.0
 */
import * as Predicate from "../../data/Predicate.ts"
import * as Schema from "../../schema/Schema.ts"

/**
 * @since 4.0.0
 * @category TypeId
 */
export const TypeId = "~effect/cli/CliError"

/**
 * Type guard to check if a value is a CLI error.
 *
 * @example
 * ```ts
 * import { CliError } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const handleError = (error: unknown) => {
 *   if (CliError.isCliError(error)) {
 *     console.log("CLI Error:", error.message)
 *     return Effect.succeed("Handled CLI error")
 *   }
 *   return Effect.fail("Unknown error")
 * }
 *
 * const program = Effect.gen(function* () {
 *   try {
 *     // Some CLI operation that might fail
 *     yield* someCliOperation()
 *   } catch (error) {
 *     yield* handleError(error)
 *   }
 * })
 * ```
 *
 * @since 4.0.0
 * @category Guards
 */
export const isCliError = (u: unknown): u is CliError => Predicate.hasProperty(u, TypeId)

/**
 * Union type representing all possible CLI error conditions.
 *
 * @example
 * ```ts
 * import { CliError } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const handleCliError = (error: CliError) => {
 *   switch (error._tag) {
 *     case "UnrecognizedOption":
 *       console.log(`Unknown flag: ${error.option}`)
 *       break
 *     case "MissingOption":
 *       console.log(`Required flag missing: ${error.option}`)
 *       break
 *     case "InvalidValue":
 *       console.log(`Invalid value: ${error.value} for ${error.option}`)
 *       break
 *     case "ShowHelp":
 *       // Display help for the command path
 *       console.log(`Help requested for: ${error.commandPath.join(" ")}`)
 *       break
 *     default:
 *       console.log(error.message)
 *   }
 * }
 * ```
 *
 * @since 4.0.0
 * @category Models
 */
export type CliError =
  | UnrecognizedOption
  | DuplicateOption
  | MissingOption
  | MissingArgument
  | InvalidValue
  | UnknownSubcommand
  | ShowHelp
  | UserError

/**
 * Error thrown when an unrecognized option is encountered.
 *
 * @example
 * ```ts
 * import { CliError } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * // Creating an unrecognized option error
 * const unrecognizedError = new CliError.UnrecognizedOption({
 *   option: "--unknown-flag",
 *   command: ["deploy", "production"],
 *   suggestions: ["--verbose", "--force"]
 * })
 *
 * console.log(unrecognizedError.message)
 * // "Unrecognized flag: --unknown-flag in command deploy production
 * //
 * //  Did you mean this?
 * //    --verbose
 * //    --force"
 *
 * // In CLI parsing context
 * const parseCommand = Effect.gen(function* () {
 *   // If parsing encounters unknown flag
 *   return yield* Effect.fail(unrecognizedError)
 * })
 * ```
 *
 * @since 4.0.0
 * @category Models
 */
export class UnrecognizedOption extends Schema.ErrorClass(`${TypeId}/UnrecognizedOption`)({
  _tag: Schema.tag("UnrecognizedOption"),
  option: Schema.String,
  command: Schema.optional(Schema.Array(Schema.String)),
  suggestions: Schema.Array(Schema.String)
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  override get message() {
    const suggestionText = this.suggestions.length > 0
      ? `\n\n  Did you mean this?\n    ${this.suggestions.join("\n    ")}`
      : ""
    const baseMessage = this.command
      ? `Unrecognized flag: ${this.option} in command ${this.command.join(" ")}`
      : `Unrecognized flag: ${this.option}`
    return baseMessage + suggestionText
  }
}

/**
 * Error thrown when duplicate option names are detected between parent and child commands.
 *
 * @example
 * ```ts
 * import { CliError } from "effect/unstable/cli"
 *
 * const duplicateError = new CliError.DuplicateOption({
 *   option: "--verbose",
 *   parentCommand: "myapp",
 *   childCommand: "deploy"
 * })
 *
 * console.log(duplicateError.message)
 * // "Duplicate flag name "--verbose" in parent command "myapp" and subcommand "deploy".
 * // Parent will always claim this flag (Mode A semantics). Consider renaming one of them to avoid confusion."
 * ```
 *
 * @since 4.0.0
 * @category Models
 */
export class DuplicateOption extends Schema.ErrorClass(`${TypeId}/DuplicateOption`)({
  _tag: Schema.tag("DuplicateOption"),
  option: Schema.String,
  parentCommand: Schema.String,
  childCommand: Schema.String
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  override get message() {
    return `Duplicate flag name "${this.option}" in parent command "${this.parentCommand}" and subcommand "${this.childCommand}". ` +
      `Parent will always claim this flag (Mode A semantics). Consider renaming one of them to avoid confusion.`
  }
}

/**
 * Error thrown when a required option is missing.
 *
 * @example
 * ```ts
 * import { CliError } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const missingOptionError = new CliError.MissingOption({
 *   option: "api-key"
 * })
 *
 * console.log(missingOptionError.message)
 * // "Missing required flag: --api-key"
 *
 * // In validation context
 * const validateRequiredOptions = Effect.gen(function* () {
 *   const apiKey = yield* getOption("api-key")
 *   if (!apiKey) {
 *     return yield* Effect.fail(missingOptionError)
 *   }
 *   return apiKey
 * })
 * ```
 *
 * @since 4.0.0
 * @category Models
 */
export class MissingOption extends Schema.ErrorClass(`${TypeId}/MissingOption`)({
  _tag: Schema.tag("MissingOption"),
  option: Schema.String
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  override get message() {
    return `Missing required flag: --${this.option}`
  }
}

/**
 * Error thrown when a required positional argument is missing.
 *
 * @example
 * ```ts
 * import { CliError } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const missingArgError = new CliError.MissingArgument({
 *   argument: "target"
 * })
 *
 * console.log(missingArgError.message)
 * // "Missing required argument: target"
 *
 * // In argument parsing
 * const parseArguments = Effect.gen(function* () {
 *   const args = yield* getArguments()
 *   if (args.length === 0) {
 *     return yield* Effect.fail(missingArgError)
 *   }
 *   return args[0]
 * })
 * ```
 *
 * @since 4.0.0
 * @category Models
 */
export class MissingArgument extends Schema.ErrorClass(`${TypeId}/MissingArgument`)({
  _tag: Schema.tag("MissingArgument"),
  argument: Schema.String
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  override get message() {
    return `Missing required argument: ${this.argument}`
  }
}

/**
 * Error thrown when an option value is invalid.
 *
 * @example
 * ```ts
 * import { CliError } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const invalidValueError = new CliError.InvalidValue({
 *   option: "port",
 *   value: "abc123",
 *   expected: "integer between 1 and 65535"
 * })
 *
 * console.log(invalidValueError.message)
 * // "Invalid value for flag --port: "abc123". Expected: integer between 1 and 65535"
 *
 * // In value validation
 * const validatePortValue = (value: string) => Effect.gen(function* () {
 *   const port = Number(value)
 *   if (isNaN(port) || port < 1 || port > 65535) {
 *     return yield* Effect.fail(invalidValueError)
 *   }
 *   return port
 * })
 * ```
 *
 * @since 4.0.0
 * @category Models
 */
export class InvalidValue extends Schema.ErrorClass(`${TypeId}/InvalidValue`)({
  _tag: Schema.tag("InvalidValue"),
  option: Schema.String,
  value: Schema.String,
  expected: Schema.String
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  override get message() {
    return `Invalid value for flag --${this.option}: "${this.value}". Expected: ${this.expected}`
  }
}

/**
 * Error thrown when an unknown subcommand is encountered.
 *
 * @example
 * ```ts
 * import { CliError } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const unknownSubcommandError = new CliError.UnknownSubcommand({
 *   subcommand: "deplyo", // typo
 *   parent: ["myapp"],
 *   suggestions: ["deploy", "destroy"]
 * })
 *
 * console.log(unknownSubcommandError.message)
 * // "Unknown subcommand "deplyo" for "myapp"
 * //
 * //  Did you mean this?
 * //    deploy
 * //    destroy"
 *
 * // In subcommand parsing
 * const parseSubcommand = (subcommand: string) => Effect.gen(function* () {
 *   const validCommands = ["deploy", "destroy", "status"]
 *   if (!validCommands.includes(subcommand)) {
 *     return yield* Effect.fail(unknownSubcommandError)
 *   }
 *   return subcommand
 * })
 * ```
 *
 * @since 4.0.0
 * @category Models
 */
export class UnknownSubcommand extends Schema.ErrorClass(`${TypeId}/UnknownSubcommand`)({
  _tag: Schema.tag("UnknownSubcommand"),
  subcommand: Schema.String,
  parent: Schema.optional(Schema.Array(Schema.String)),
  suggestions: Schema.Array(Schema.String)
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  override get message() {
    const suggestionText = this.suggestions.length > 0
      ? `\n\n  Did you mean this?\n    ${this.suggestions.join("\n    ")}`
      : ""
    return this.parent
      ? `Unknown subcommand "${this.subcommand}" for "${this.parent.join(" ")}"${suggestionText}`
      : `Unknown subcommand "${this.subcommand}"${suggestionText}`
  }
}

/**
 * Control flow indicator when help is requested via --help flag.
 * This is not an error but uses the error channel for control flow.
 *
 * @example
 * ```ts
 * import { CliError } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const showHelpIndicator = new CliError.ShowHelp({
 *   commandPath: ["myapp", "deploy", "production"]
 * })
 *
 * console.log(showHelpIndicator.message)
 * // "Help requested"
 *
 * // In help flag handling
 * const handleHelpFlag = Effect.gen(function* () {
 *   const shouldShowHelp = yield* checkHelpFlag()
 *   if (shouldShowHelp) {
 *     return yield* Effect.fail(showHelpIndicator)
 *   }
 *   return yield* continueWithCommand()
 * })
 *
 * // In error handling
 * const handleCliErrors = (error: CliError) => {
 *   if (error._tag === "ShowHelp") {
 *     // Display help for the command path
 *     return displayHelp(error.commandPath)
 *   }
 *   // Handle other errors...
 * }
 * ```
 *
 * @since 4.0.0
 * @category Models
 */
export class ShowHelp extends Schema.ErrorClass(`${TypeId}/ShowHelp`)({
  _tag: Schema.tag("ShowHelp"),
  commandPath: Schema.Array(Schema.String)
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  override get message() {
    return "Help requested"
  }
}

/**
 * Wrapper for user (handler) errors to unify under CLI error channel when desired.
 *
 * @example
 * ```ts
 * import { CliError } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * // Wrapping user errors
 * const userError = new CliError.UserError({
 *   cause: new Error("Database connection failed")
 * })
 *
 * // In command handler
 * const deployCommand = Effect.gen(function* () {
 *   try {
 *     yield* connectToDatabase()
 *     yield* performDeployment()
 *   } catch (error) {
 *     // Wrap user errors to unify error handling
 *     return yield* Effect.fail(new CliError.UserError({ cause: error }))
 *   }
 * })
 *
 * // In error handling
 * const handleError = (error: CliError) => {
 *   if (error._tag === "UserError") {
 *     console.log("Command failed:", error.cause)
 *     return Effect.succeed(1) // Exit code 1
 *   }
 *   // Handle other CLI errors...
 * }
 * ```
 *
 * @since 4.0.0
 * @category Models
 */
export class UserError extends Schema.ErrorClass(`${TypeId}/UserError`)({
  _tag: Schema.tag("UserError"),
  cause: Schema.Defect
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId
}
