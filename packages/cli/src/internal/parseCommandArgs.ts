import { Effect } from "effect"
import type * as Option from "effect/data/Option"
import type { LogLevel } from "effect/logging/LogLevel"
import type { FileSystem } from "effect/platform/FileSystem"
import type { Path } from "effect/platform/Path"
import * as CliError from "../CliError.ts"
import type { Command } from "../Command.ts"
import { isFalseValue, isTrueValue } from "../Primitive.ts"
import { helpFlag, logLevelFlag } from "./builtInFlags.ts"
import { lex, type LexResult, type Token } from "./lexer.ts"
import { extractSingleParams, type ParamKind, type Single } from "./param.ts"
import { suggest } from "./suggestions.ts"

export { lex, type LexResult }

/**
 * Parsed arguments for a command *including* potential nested sub-command.
 */
export interface ParsedCommandArgs {
  readonly options: Record<string, ReadonlyArray<string>>
  readonly operands: ReadonlyArray<string>
  readonly subcommand?: {
    readonly name: string
    readonly args: ParsedCommandArgs
  }
  readonly errors?: ReadonlyArray<CliError.CliError>
}

export const ParsedCommandArgs = {
  getCommandPath: (parsedArgs: ParsedCommandArgs): ReadonlyArray<string> => {
    return parsedArgs.subcommand
      ? [parsedArgs.subcommand.name, ...ParsedCommandArgs.getCommandPath(parsedArgs.subcommand.args)]
      : []
  }
}

/* ====================================================================== */
/* Helpers copied from internal/args.ts                                   */
/* ====================================================================== */

const extractValues = (tokens: ReadonlyArray<Token>): ReadonlyArray<string> => {
  return tokens.flatMap((tok) => tok._tag === "Value" ? [tok.value] : [])
}

const checkForUnrecognizedOptions = (
  tokens: ReadonlyArray<Token>,
  validOptions: ReadonlyArray<Single<any>>,
  command?: ReadonlyArray<string>
): CliError.UnrecognizedOption | undefined => {
  for (const token of tokens) {
    if (token._tag === "LongOption" || token._tag === "ShortOption") {
      const flag = token._tag === "LongOption" ? `--${token.name}` : `-${token.flag}`
      const flagName = token._tag === "LongOption" ? token.name : token.flag

      // Build list of valid flag names for suggestions
      const validFlagNames: Array<string> = []
      for (const option of validOptions) {
        validFlagNames.push(option.name)
        for (const alias of option.aliases) {
          validFlagNames.push(alias)
        }
      }

      const suggestions = suggest(flagName, validFlagNames).map((name) => name.length === 1 ? `-${name}` : `--${name}`)

      return new CliError.UnrecognizedOption({
        option: flag,
        suggestions,
        ...(command && { command })
      })
    }
  }
  return undefined
}

const findSubcommand = (
  tokens: ReadonlyArray<Token>,
  subcommands: ReadonlyArray<Command<string, any, any, any>>
): { subcommand: Command<string, any, any, any>; index: number } | undefined => {
  if (subcommands.length === 0) return undefined

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    if (tok._tag === "Value") {
      const subcommand = subcommands.find((s) => s.name === tok.value)
      if (subcommand) {
        return { subcommand, index: i }
      }
    }
  }

  return undefined
}

// Create Singles for built-in options
const builtInSingles: ReadonlyArray<Single<any>> = [
  ...extractSingleParams(logLevelFlag),
  ...extractSingleParams(helpFlag)
]

/**
 * Extract built-in options from tokens using the same peelArgs logic.
 * Returns the parsed built-in options and remaining tokens.
 */
export const extractBuiltInOptions = (
  tokens: ReadonlyArray<Token>
): Effect.Effect<
  { help: boolean; logLevel: Option.Option<LogLevel>; remainder: ReadonlyArray<Token> },
  CliError.CliError,
  FileSystem | Path
> =>
  Effect.gen(function*() {
    const { options, remainder } = peelArgs(tokens, builtInSingles)

    // Parse the built-in options from the extracted options
    const [, help] = yield* helpFlag.parse({ options, operands: [] })
    const [, logLevel] = yield* logLevelFlag.parse({ options, operands: [] })

    return { help, logLevel, remainder }
  })

/* ====================================================================== */
/* Helper functions for peelArgs                                          */
/* ====================================================================== */

/** Fast O(1) look-up of canonicalized names/aliases → Single<A> */
const buildLookup = (singles: ReadonlyArray<Single<any>>): Map<string, Single<any>> => {
  const lookup = new Map<string, Single<any>>()
  for (const single of singles) {
    // Check for duplicate before inserting
    if (lookup.has(single.name)) {
      // TODO: Do not simply throw, return a CliError.DuplicateOption
      throw new Error(`Duplicate option name: ${single.name}`)
    }
    lookup.set(single.name, single)
    for (const alias of single.aliases) {
      if (lookup.has(alias)) {
        throw new Error(`Duplicate option/alias: ${alias}`)
      }
      lookup.set(alias, single)
    }
  }
  return lookup
}

/** Push parsed value (or implied boolean) into {name: [...]} */
const push = (
  opt: Single<any>,
  raw: string | undefined,
  store: Record<string, Array<string>>
): void => {
  if (raw !== undefined) {
    store[opt.name].push(raw)
  }
}

/** Decide whether the next token is a boolean literal we should swallow */
const booleanExplicit = (next: Token | undefined): string | undefined => {
  return next?._tag === "Value" && (isTrueValue(next.value) || isFalseValue(next.value))
    ? next.value
    : undefined
}

/* ====================================================================== */
/* peelArgs – parse *this* level and return what is left over             */
/* ====================================================================== */

interface ParsedAndRemainder {
  readonly options: Record<string, ReadonlyArray<string>>
  readonly remainder: ReadonlyArray<Token>
}

const peelArgs = (
  tokens: ReadonlyArray<Token>,
  singles: ReadonlyArray<Single<any>>
): ParsedAndRemainder => {
  const lookup = buildLookup(singles)
  const options: Record<string, Array<string>> = Object.fromEntries(
    singles.map((s) => [s.name, [] as Array<string>])
  )
  const remainder: Array<Token> = []

  for (let i = 0; i < tokens.length;) {
    const tok = tokens[i]

    // ── 1. Plain operand ────────────────────────────────────────────────
    if (tok._tag === "Value") {
      remainder.push(tok)
      i++
      continue
    }

    // ── 2. Option – do we care? ─────────────────────────────────────────
    const key = tok._tag === "LongOption" ?
      tok.name :
      tok._tag === "ShortOption" ?
      tok.flag :
      undefined
    const opt = key ? lookup.get(key) : undefined
    if (!opt) {
      remainder.push(tok)
      i++
      continue
    }

    // ── 3. We own this option. Extract value(s). ────────────────────────
    if (tok.value !== undefined) { // --foo=bar / -f=bar
      push(opt, tok.value, options)
      i++
      continue
    }

    if (opt.primitiveType._tag === "Boolean") { // boolean flag
      const explicit = booleanExplicit(tokens[i + 1])
      push(opt, explicit ?? "true", options)
      i += explicit ? 2 : 1
      continue
    }

    const next = tokens[i + 1] // --port 8080
    if (next && next._tag === "Value") {
      push(opt, next.value, options)
      i += 2
    } else {
      // value missing – leave for downstream validation
      i++
    }
  }

  return { options, remainder }
}

/* ====================================================================== */
/* Main recursive parser                                                  */
/* ====================================================================== */

const isOptionSingle = <A>(s: Single<A, ParamKind>): s is Single<A, "option"> => s.kind === "option"

type RouteResult =
  | {
    readonly type: "leaf"
    readonly operands: ReadonlyArray<string>
    readonly errors: ReadonlyArray<CliError.CliError>
  }
  | {
    readonly type: "subcommand"
    readonly parentOperands: ReadonlyArray<string>
    readonly sub: Command<string, any, any, any>
    readonly tokens: ReadonlyArray<Token>
    readonly errors: ReadonlyArray<CliError.CliError>
  }

const analyzeRemainder = <Name extends string>(
  remainder: ReadonlyArray<Token>,
  command: Command<Name, any, any, any>,
  optionSingles: ReadonlyArray<Single<any, "option">>,
  commandPath: ReadonlyArray<string>
): RouteResult => {
  const errors: Array<CliError.CliError> = []
  const subcommandMatch = findSubcommand(remainder, command.subcommands)

  if (!subcommandMatch) {
    // Check for unknown subcommand first
    if (command.subcommands.length > 0) {
      const firstValue = remainder.find((tok) => tok._tag === "Value")
      if (firstValue) {
        const suggestions = suggest(firstValue.value, command.subcommands.map((s) => s.name))
        errors.push(
          new CliError.UnknownSubcommand({
            subcommand: firstValue.value,
            parent: commandPath,
            suggestions
          })
        )
      }
    }

    // Check for unrecognized options
    const error = checkForUnrecognizedOptions(remainder, optionSingles, commandPath)
    if (error) {
      errors.push(error)
    }

    return { type: "leaf", operands: extractValues(remainder), errors }
  }

  const { index: subIndex, subcommand: sub } = subcommandMatch
  const beforeSubcommand = remainder.slice(0, subIndex)

  // Check for unrecognized options before subcommand
  const error = checkForUnrecognizedOptions(beforeSubcommand, optionSingles, commandPath)
  if (error) {
    errors.push(error)
  }

  return {
    type: "subcommand",
    parentOperands: extractValues(beforeSubcommand),
    sub,
    tokens: remainder.slice(subIndex + 1),
    errors
  }
}

export const parseArgs = <Name extends string, Input, E, R>(
  lexResult: LexResult,
  command: Command<Name, Input, E, R>,
  commandPath: ReadonlyArray<string> = []
): Effect.Effect<
  ParsedCommandArgs,
  CliError.CliError,
  FileSystem | Path
> =>
  Effect.gen(function*() {
    const { tokens, trailingOperands: afterEndOfOptions } = lexResult
    const newCommandPath = [...commandPath, command.name]

    // Parse options cleanly
    const parsedConfig = command.parsedConfig
    const singles = parsedConfig.options.flatMap(extractSingleParams)
    const optionSingles = singles.filter(isOptionSingle)
    const { options, remainder } = peelArgs(tokens, optionSingles)

    // Analyze what's left and route accordingly
    const route = analyzeRemainder(remainder, command, optionSingles, newCommandPath)

    switch (route.type) {
      case "leaf":
        return {
          options,
          operands: [...route.operands, ...afterEndOfOptions],
          ...(route.errors.length > 0 && { errors: route.errors })
        }

      case "subcommand": {
        // Create new lex result for subcommand (no afterEndOfOptions since they belong to parent)
        const subLexResult: LexResult = {
          tokens: route.tokens,
          trailingOperands: []
        }
        const subParsed = yield* parseArgs(
          subLexResult,
          route.sub,
          newCommandPath
        )

        // Combine errors from this level and subcommand level
        const allErrors = [...route.errors, ...(subParsed.errors || [])]

        return {
          options,
          operands: [...route.parentOperands, ...afterEndOfOptions],
          subcommand: { name: route.sub.name, args: subParsed },
          ...(allErrors.length > 0 && { errors: allErrors })
        }
      }
    }
  })
