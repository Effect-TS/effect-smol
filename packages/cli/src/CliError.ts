/**
 * @since 4.0.0
 */
import * as Data from "effect/data/Data"
import { hasProperty } from "effect/data/Predicate"

/**
 * @since 4.0.0
 * @category TypeId
 */
export const TypeId: TypeId = "@effect/cli/CliError"

/**
 * @since 4.0.0
 * @category TypeId
 */
export type TypeId = "@effect/cli/CliError"

/**
 * @since 4.0.0
 * @category Guards
 */
export const isCliError = (u: unknown): u is CliError => hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category Models
 */
export type CliError =
  | UnrecognizedOption
  | DuplicateOption
  | MissingOption
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
export class UnrecognizedOption extends Data.TaggedError("UnrecognizedOption")<{
  readonly option: string
  readonly command?: ReadonlyArray<string>
  readonly suggestions: ReadonlyArray<string>
}> {
  /**
   * @since 4.0.0
   */
  readonly [TypeId]: TypeId = TypeId
  /**
   * @since 4.0.0
   */
  override get message() {
    const suggestionText = this.suggestions.length > 0
      ? `\n\nDid you mean this?\n\t${this.suggestions.join("\n\t")}`
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
export class DuplicateOption extends Data.TaggedError("DuplicateOption")<{
  readonly option: string
  readonly parentCommand: string
  readonly childCommand: string
}> {
  /**
   * @since 4.0.0
   */
  readonly [TypeId]: TypeId = TypeId
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
export class MissingOption extends Data.TaggedError("MissingOption")<{
  readonly option: string
}> {
  /**
   * @since 4.0.0
   */
  readonly [TypeId]: TypeId = TypeId
  /**
   * @since 4.0.0
   */
  override get message() {
    return `Missing required flag: --${this.option}`
  }
}

/**
 * Error thrown when an option value is invalid.
 *
 * @since 4.0.0
 * @category Models
 */
export class InvalidValue extends Data.TaggedError("InvalidValue")<{
  readonly option: string
  readonly value: string
  readonly expected: string
}> {
  /**
   * @since 4.0.0
   */
  readonly [TypeId]: TypeId = TypeId
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
export class UnknownSubcommand extends Data.TaggedError("UnknownSubcommand")<{
  readonly subcommand: string
  readonly parent?: ReadonlyArray<string>
  readonly suggestions: ReadonlyArray<string>
}> {
  readonly [TypeId]: TypeId = TypeId
  override get message() {
    const suggestionText = this.suggestions.length > 0
      ? `\n\nDid you mean this?\n\t${this.suggestions.join("\n\t")}`
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
export class ShowHelp extends Data.TaggedError("ShowHelp")<{
  readonly commandPath: ReadonlyArray<string>
}> {
  /**
   * @since 4.0.0
   */
  readonly [TypeId]: TypeId = TypeId
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
export class UserError extends Data.TaggedError("UserError")<{
  readonly cause: unknown
}> {
  /**
   * @since 4.0.0
   */
  readonly [TypeId]: TypeId = TypeId
  /**
   * @since 4.0.0
   */
  override get message() {
    return String(this.cause)
  }
}
