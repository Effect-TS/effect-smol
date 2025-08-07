import { Effect } from "effect"
import type * as Option from "effect/data/Option"
import type { LogLevel } from "effect/logging/LogLevel"
import type { FileSystem } from "effect/platform/FileSystem"
import type { Path } from "effect/platform/Path"
import * as CliError from "../CliError.ts"
import type { Command } from "../Command.ts"
import { isFalseValue, isTrueValue } from "../Primitive.ts"
import { helpFlag, logLevelFlag, versionFlag } from "./builtInFlags.ts"
import { lex, type LexResult, type Token } from "./lexer.ts"
import { extractSingleParams, type ParamKind, type Single } from "./param.ts"
import { suggest } from "./suggestions.ts"
import type { ParamParseArgs } from "./types.ts"

export { lex, type LexResult }

/**
 * Parsed arguments for a command *including* potential nested sub-command.
 */
export interface ParsedCommandInput {
  readonly flags: Record<string, ReadonlyArray<string>>
  readonly arguments: ReadonlyArray<string>
  readonly subcommand?: {
    readonly name: string
    readonly parsedInput: ParsedCommandInput
  }
  readonly errors?: ReadonlyArray<CliError.CliError>
}

export const ParsedCommandInput = {
  getCommandPath: (parsedInput: ParsedCommandInput): ReadonlyArray<string> =>
    parsedInput.subcommand
      ? [parsedInput.subcommand.name, ...ParsedCommandInput.getCommandPath(parsedInput.subcommand.parsedInput)]
      : []
}

type FlagParam = Single<unknown, "flag">
type FlagMap = Record<string, ReadonlyArray<string>>
type MutableFlagMap = Record<string, Array<string>>

interface TokenCursor {
  readonly peek: () => Token | undefined
  readonly take: () => Token | undefined
  readonly rest: () => ReadonlyArray<Token>
}

const makeCursor = (tokens: ReadonlyArray<Token>): TokenCursor => {
  let i = 0
  return {
    peek: () => tokens[i],
    take: () => tokens[i++],
    rest: () => tokens.slice(i)
  }
}

/** Map canonicalized names/aliases → Single<A> (O(1) lookup). */
const buildFlagIndex = (singles: ReadonlyArray<Single<unknown>>): Map<string, Single<unknown>> => {
  const lookup = new Map<string, Single<unknown>>()
  for (const single of singles) {
    if (lookup.has(single.name)) throw new Error(`Duplicate option name: ${single.name}`)
    lookup.set(single.name, single)
    for (const alias of single.aliases) {
      if (lookup.has(alias)) throw new Error(`Duplicate option/alias: ${alias}`)
      lookup.set(alias, single)
    }
  }
  return lookup
}

const isFlagToken = (t: Token): t is Extract<Token, { _tag: "LongOption" | "ShortOption" }> =>
  t._tag === "LongOption" || t._tag === "ShortOption"

const flagName = (t: Extract<Token, { _tag: "LongOption" | "ShortOption" }>) =>
  t._tag === "LongOption" ? t.name : t.flag

/** true/false/1/0/yes/no/on/off – if the next token is a boolean literal, return it. */
const peekBooleanLiteral = (next: Token | undefined): string | undefined =>
  next?._tag === "Value" && (isTrueValue(next.value) || isFalseValue(next.value)) ? next.value : undefined

const makeFlagMap = (params: ReadonlyArray<FlagParam>): MutableFlagMap =>
  Object.fromEntries(params.map((p) => [p.name, [] as Array<string>])) as MutableFlagMap

const appendFlagValue = (bag: MutableFlagMap, name: string, raw: string | undefined): void => {
  if (raw !== undefined) bag[name].push(raw)
}

const mergeIntoFlagMap = (into: MutableFlagMap, from: FlagMap | MutableFlagMap): void => {
  for (const k in from) {
    const src = from[k]
    if (src && src.length) {
      for (let i = 0; i < src.length; i++) {
        into[k].push(src[i])
      }
    }
  }
}

const toReadonlyFlagMap = (map: MutableFlagMap): FlagMap => map

/**
 * Consume a recognized flag's value from the cursor:
 * - Inline:   --flag=value / -f=value
 * - Boolean:  implicit "true" or explicit next literal
 * - Other:    consume the next Value token if present
 */
const readFlagValue = (
  cursor: TokenCursor,
  tok: Extract<Token, { _tag: "LongOption" | "ShortOption" }>,
  spec: FlagParam
): string | undefined => {
  if (tok.value !== undefined) return tok.value
  if (spec.primitiveType._tag === "Boolean") {
    const explicit = peekBooleanLiteral(cursor.peek())
    if (explicit !== undefined) cursor.take() // consume the literal
    return explicit ?? "true"
  }
  const next = cursor.peek()
  if (next && next._tag === "Value") {
    cursor.take()
    return next.value
  }
  return undefined
}

const unrecognizedFlagError = (
  token: Token,
  singles: ReadonlyArray<FlagParam>,
  commandPath?: ReadonlyArray<string>
): CliError.UnrecognizedOption | undefined => {
  if (!isFlagToken(token)) return undefined
  const printable = token._tag === "LongOption" ? `--${token.name}` : `-${token.flag}`
  const valid: Array<string> = []
  for (const s of singles) {
    valid.push(s.name)
    for (const alias of s.aliases) {
      valid.push(alias)
    }
  }
  const suggestions = suggest(flagName(token), valid).map((n) => (n.length === 1 ? `-${n}` : `--${n}`))
  return new CliError.UnrecognizedOption({
    option: printable,
    suggestions,
    ...(commandPath && { command: commandPath })
  })
}

/* ====================================================================== */
/* Built-ins peeling – uses the same primitives                           */
/* ====================================================================== */

const builtInFlagParams: ReadonlyArray<FlagParam> = [
  ...extractSingleParams(logLevelFlag),
  ...extractSingleParams(helpFlag)
]

/** Collect only the provided flags; leave everything else untouched as remainder. */
const collectFlagValues = (
  tokens: ReadonlyArray<Token>,
  flags: ReadonlyArray<FlagParam>
): { flagMap: FlagMap; remainder: ReadonlyArray<Token> } => {
  const lookup = buildFlagIndex(flags)
  const flagMap = makeFlagMap(flags)
  const remainder: Array<Token> = []
  const cursor = makeCursor(tokens)

  for (let t = cursor.take(); t; t = cursor.take()) {
    if (!isFlagToken(t)) {
      remainder.push(t)
      continue
    }
    const spec = lookup.get(flagName(t))
    if (!spec) {
      // Not one of the target flags → don't consume a following value
      remainder.push(t)
      continue
    }
    appendFlagValue(flagMap, spec.name, readFlagValue(cursor, t, spec))
  }

  return { flagMap: toReadonlyFlagMap(flagMap), remainder }
}

/**
 * Extract built-in flags using the same machinery.
 */
export const extractBuiltInOptions = (
  tokens: ReadonlyArray<Token>
): Effect.Effect<
  {
    help: boolean
    logLevel: Option.Option<LogLevel>
    version: boolean
    remainder: ReadonlyArray<Token>
  },
  CliError.CliError,
  FileSystem | Path
> =>
  Effect.gen(function*() {
    const { flagMap, remainder } = collectFlagValues(tokens, builtInFlagParams)
    const emptyArgs: ParamParseArgs = { flags: flagMap, arguments: [] }
    const [, help] = yield* helpFlag.parse(emptyArgs)
    const [, logLevel] = yield* logLevelFlag.parse(emptyArgs)
    const [, version] = yield* versionFlag.parse(emptyArgs)
    return { help, logLevel, version, remainder }
  })

/* ====================================================================== */
/* One-level scan                                                         */
/* ====================================================================== */

type LevelLeaf = {
  readonly type: "leaf"
  readonly flags: FlagMap
  readonly arguments: ReadonlyArray<string>
  readonly errors: ReadonlyArray<CliError.CliError>
}

type LevelSubcommand = {
  readonly type: "sub"
  readonly flags: FlagMap
  readonly leadingArguments: ReadonlyArray<string>
  readonly sub: Command<string, unknown, unknown, unknown>
  readonly childTokens: ReadonlyArray<Token>
  readonly errors: ReadonlyArray<CliError.CliError>
}

type LevelResult = LevelLeaf | LevelSubcommand

const isFlagParam = <A>(s: Single<A, ParamKind>): s is Single<A, "flag"> => s.kind === "flag"

const scanCommandLevel = <Name extends string, Input, E, R>(
  tokens: ReadonlyArray<Token>,
  command: Command<Name, Input, E, R>,
  flags: ReadonlyArray<FlagParam>,
  commandPath: ReadonlyArray<string>
): LevelResult => {
  const index = buildFlagIndex(flags)
  const bag = makeFlagMap(flags)
  const operands: Array<string> = []
  const errors: Array<CliError.CliError> = []
  let seenFirstValue = false
  const expectsArgs = command.parsedConfig.arguments.length > 0

  const cursor = makeCursor(tokens)

  for (let t = cursor.take(); t; t = cursor.take()) {
    if (isFlagToken(t)) {
      const spec = index.get(flagName(t))
      if (!spec) {
        const err = unrecognizedFlagError(t, flags, commandPath)
        if (err) errors.push(err)
        // Do not consume a following value; it may be a subcommand or operand
        continue
      }
      appendFlagValue(bag, spec.name, readFlagValue(cursor, t, spec))
      continue
    }

    // Value → only the FIRST value may be a subcommand boundary; others are arguments
    if (t._tag === "Value") {
      if (!seenFirstValue) {
        seenFirstValue = true
        const sub = command.subcommands.find((s) => s.name === t.value)
        if (sub) {
          // Allow parent flags to appear after the subcommand name (npm-style)
          const tail = collectFlagValues(cursor.rest(), flags)
          mergeIntoFlagMap(bag, tail.flagMap)
          return {
            type: "sub",
            flags: toReadonlyFlagMap(bag),
            leadingArguments: [],
            sub,
            childTokens: tail.remainder,
            errors
          }
        } else {
          if (!expectsArgs && command.subcommands.length > 0) {
            const suggestions = suggest(t.value, command.subcommands.map((s) => s.name))
            errors.push(new CliError.UnknownSubcommand({ subcommand: t.value, parent: commandPath, suggestions }))
          }
        }
      }
      operands.push(t.value)
    }
  }

  // Unknown subcommand validation handled inline on first value; remaining checks
  // are deferred to argument parsing.

  return { type: "leaf", flags: toReadonlyFlagMap(bag), arguments: operands, errors }
}

/* ====================================================================== */
/* Public API                                                             */
/* ====================================================================== */

export const parseArgs = <Name extends string, Input, E, R>(
  lexResult: LexResult,
  command: Command<Name, Input, E, R>,
  commandPath: ReadonlyArray<string> = []
): Effect.Effect<ParsedCommandInput, CliError.CliError, FileSystem | Path> =>
  Effect.gen(function*() {
    const { tokens, trailingOperands: afterEndOfOptions } = lexResult
    const newCommandPath = [...commandPath, command.name]

    // Flags available at this level (ignore arguments)
    const singles = command.parsedConfig.flags.flatMap(extractSingleParams)
    const flags = singles.filter(isFlagParam)

    const result = scanCommandLevel(tokens, command, flags, newCommandPath)

    if (result.type === "leaf") {
      return {
        flags: result.flags,
        arguments: [...result.arguments, ...afterEndOfOptions],
        ...(result.errors.length > 0 && { errors: result.errors })
      }
    }

    // Subcommand recursion
    const subLex: LexResult = { tokens: result.childTokens, trailingOperands: [] }
    const subParsed = yield* parseArgs(
      subLex,
      result.sub as unknown as Command<Name, Input, E, R>,
      newCommandPath
    )

    const allErrors = [...result.errors, ...(subParsed.errors || [])]
    return {
      flags: result.flags,
      arguments: [...result.leadingArguments, ...afterEndOfOptions],
      subcommand: { name: result.sub.name, parsedInput: subParsed },
      ...(allErrors.length > 0 && { errors: allErrors })
    }
  })
