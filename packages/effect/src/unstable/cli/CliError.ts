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
 * @since 4.0.0
 * @category Guards
 */
export const isCliError = (u: unknown): u is CliError => Predicate.hasProperty(u, TypeId)

/**
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
