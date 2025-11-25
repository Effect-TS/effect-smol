/**
 * Parsing pipeline for CLI commands
 * --------------------------------
 * 1. `lexer` turns argv into tokens.
 * 2. `extractBuiltInOptions` peels off built-ins (help/version/completions).
 * 3. `parseArgs` recursively scans one command level at a time:
 *    - collect this level's flags
 *    - detect an optional subcommand (only the first value can open one)
 *    - forward any remaining tokens to the child
 *
 * Invariants
 * - Parent flags may appear before or after the subcommand name (npm-style).
 * - Only the very first Value token may be interpreted as a subcommand name.
 * - Errors accumulate; no exceptions are thrown from the parser.
 */
import * as Option from "../../../data/Option.ts"
import * as Effect from "../../../Effect.ts"
import type { LogLevel } from "../../../LogLevel.ts"
import type { FileSystem } from "../../../platform/FileSystem.ts"
import type { Path } from "../../../platform/Path.ts"
import * as CliError from "../CliError.ts"
import type { Command, RawInput } from "../Command.ts"
import * as Param from "../Param.ts"
import { isFalseValue, isTrueValue } from "../Primitive.ts"
import { suggest } from "./auto-suggest.ts"
import { completionsFlag, dynamicCompletionsFlag, helpFlag, logLevelFlag, versionFlag } from "./builtInFlags.ts"
import { type LexResult, type Token } from "./lexer.ts"

/** @internal */
export const getCommandPath = (parsedInput: RawInput): ReadonlyArray<string> =>
  parsedInput.subcommand
    ? [parsedInput.subcommand.name, ...getCommandPath(parsedInput.subcommand.parsedInput)]
    : []

type FlagParam = Param.Single<typeof Param.Flag, unknown>
type FlagMap = Record<string, ReadonlyArray<string>>
type MutableFlagMap = Record<string, Array<string>>

type FlagSpec = {
  readonly params: ReadonlyArray<FlagParam>
  readonly index: Map<string, FlagParam>
}

type FlagBag = {
  readonly add: (name: string, raw: string | undefined) => void
  readonly merge: (from: FlagMap | MutableFlagMap) => void
  readonly snapshot: () => FlagMap
}

type CommandContext<Name extends string, Input, E, R> = {
  readonly command: Command<Name, Input, E, R>
  readonly commandPath: ReadonlyArray<string>
  readonly flagSpec: FlagSpec
}

/* ====================================================================== */
/* Cursor (token navigation)                                               */
/* ====================================================================== */

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

/* ====================================================================== */
/* Flag tables                                                             */
/* ====================================================================== */

/** Map canonicalized names/aliases → Single<A> (O(1) lookup). */
const buildFlagIndex = (
  singles: ReadonlyArray<Param.Single<typeof Param.Flag, unknown>>
): Map<string, Param.Single<typeof Param.Flag, unknown>> => {
  const lookup = new Map<string, Param.Single<typeof Param.Flag, unknown>>()
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

const buildSubcommandIndex = (
  subcommands: ReadonlyArray<Command<string, unknown, unknown, unknown>>
): Map<string, Command<string, unknown, unknown, unknown>> => new Map(subcommands.map((sub) => [sub.name, sub]))

const makeFlagSpec = (params: ReadonlyArray<FlagParam>): FlagSpec => ({
  params,
  index: buildFlagIndex(params)
})

const makeFlagBag = (params: ReadonlyArray<FlagParam>): FlagBag => {
  const map = makeFlagMap(params)
  return {
    add: (name, raw) => appendFlagValue(map, name, raw),
    merge: (from) => mergeIntoFlagMap(map, from),
    snapshot: () => toReadonlyFlagMap(map)
  }
}

/* ====================================================================== */
/* Flag bag & values                                                       */
/* ====================================================================== */

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
  ...Param.extractSingleParams(logLevelFlag),
  ...Param.extractSingleParams(helpFlag),
  ...Param.extractSingleParams(versionFlag),
  ...Param.extractSingleParams(completionsFlag),
  ...Param.extractSingleParams(dynamicCompletionsFlag)
]

const builtInFlagSpec = makeFlagSpec(builtInFlagParams)

/** Collect only the provided flags; leave everything else untouched as remainder. */
const collectFlagValues = (
  tokens: ReadonlyArray<Token>,
  spec: FlagSpec
): { flagMap: FlagMap; remainder: ReadonlyArray<Token> } => {
  const flagMap = makeFlagMap(spec.params)
  const remainder: Array<Token> = []
  const cursor = makeCursor(tokens)

  for (let t = cursor.take(); t; t = cursor.take()) {
    if (!isFlagToken(t)) {
      remainder.push(t)
      continue
    }
    const param = spec.index.get(flagName(t))
    if (!param) {
      // Not one of the target flags → don't consume a following value
      remainder.push(t)
      continue
    }
    appendFlagValue(flagMap, param.name, readFlagValue(cursor, t, param))
  }

  return { flagMap: toReadonlyFlagMap(flagMap), remainder }
}

/**
 * Extract built-in flags using the same machinery.
 *
 * @internal
 */
export const extractBuiltInOptions = (
  tokens: ReadonlyArray<Token>
): Effect.Effect<
  {
    help: boolean
    logLevel: LogLevel | undefined
    version: boolean
    completions: "bash" | "zsh" | "fish" | undefined
    dynamicCompletions: "bash" | "zsh" | "fish" | undefined
    remainder: ReadonlyArray<Token>
  },
  CliError.CliError,
  FileSystem | Path
> =>
  Effect.gen(function*() {
    const { flagMap, remainder } = collectFlagValues(tokens, builtInFlagSpec)
    const emptyArgs: Param.ParsedArgs = { flags: flagMap, arguments: [] }
    const [, help] = yield* helpFlag.parse(emptyArgs)
    const [, logLevel] = yield* logLevelFlag.parse(emptyArgs)
    const [, version] = yield* versionFlag.parse(emptyArgs)
    const [, completions] = yield* completionsFlag.parse(emptyArgs)
    const [, dynamicCompletions] = yield* dynamicCompletionsFlag.parse(emptyArgs)
    return {
      help,
      logLevel: Option.getOrUndefined(logLevel),
      version,
      completions: Option.getOrUndefined(completions),
      dynamicCompletions: Option.getOrUndefined(dynamicCompletions),
      remainder
    }
  })

/* ====================================================================== */
/* One-level scan                                                         */
/* ====================================================================== */

type LeafResult = {
  readonly _tag: "Leaf"
  readonly flags: FlagMap
  readonly arguments: ReadonlyArray<string>
  readonly errors: ReadonlyArray<CliError.CliError>
}

type SubcommandResult = {
  readonly _tag: "Sub"
  readonly flags: FlagMap
  readonly leadingArguments: ReadonlyArray<string>
  readonly sub: Command<string, unknown, unknown, unknown>
  readonly childTokens: ReadonlyArray<Token>
  readonly errors: ReadonlyArray<CliError.CliError>
}

type LevelResult = LeafResult | SubcommandResult

interface ParseState {
  readonly flags: FlagBag
  readonly arguments: Array<string>
  readonly errors: Array<CliError.CliError>
  seenFirstValue: boolean
}

const makeParseState = (flagSpec: FlagSpec): ParseState => ({
  flags: makeFlagBag(flagSpec.params),
  arguments: [],
  errors: [],
  seenFirstValue: false
})

const toLeafResult = (state: ParseState): LeafResult => ({
  _tag: "Leaf",
  flags: state.flags.snapshot(),
  arguments: state.arguments,
  errors: state.errors
})

const isFlagParam = <A>(s: Param.Single<Param.ParamKind, A>): s is Param.Single<typeof Param.Flag, A> =>
  s.kind === "flag"

const scanCommandLevel = <Name extends string, Input, E, R>(
  tokens: ReadonlyArray<Token>,
  context: CommandContext<Name, Input, E, R>
): LevelResult => {
  const { command, commandPath, flagSpec } = context
  const { index } = flagSpec
  const subIndex = buildSubcommandIndex(command.subcommands)
  const state = makeParseState(flagSpec)
  const expectsArgs = command.config.arguments.length > 0
  const cursor = makeCursor(tokens)

  const handleFlag = (t: Extract<Token, { _tag: "LongOption" | "ShortOption" }>) => {
    const spec = index.get(flagName(t))
    if (!spec) {
      const err = unrecognizedFlagError(t, flagSpec.params, commandPath)
      if (err) state.errors.push(err)
      return
    }
    state.flags.add(spec.name, readFlagValue(cursor, t, spec))
  }

  const handleFirstValue = (value: string): SubcommandResult | undefined => {
    const sub = subIndex.get(value)
    if (sub) {
      // Allow parent flags to appear after the subcommand name (npm-style)
      const tail = collectFlagValues(cursor.rest(), flagSpec)
      state.flags.merge(tail.flagMap)
      return {
        _tag: "Sub",
        flags: state.flags.snapshot(),
        leadingArguments: [],
        sub,
        childTokens: tail.remainder,
        errors: state.errors
      }
    }

    if (!expectsArgs && subIndex.size > 0) {
      const suggestions = suggest(value, command.subcommands.map((s) => s.name))
      state.errors.push(new CliError.UnknownSubcommand({ subcommand: value, parent: commandPath, suggestions }))
    }
    return undefined
  }

  for (let t = cursor.take(); t; t = cursor.take()) {
    if (isFlagToken(t)) {
      handleFlag(t)
      continue
    }

    if (t._tag === "Value") {
      if (!state.seenFirstValue) {
        state.seenFirstValue = true
        const sub = handleFirstValue(t.value)
        if (sub) return sub
      }
      state.arguments.push(t.value)
    }
  }

  return toLeafResult(state)
}

/* ====================================================================== */
/* Public API                                                             */
/* ====================================================================== */

/** @internal */
export const parseArgs = <Name extends string, Input, E, R>(
  lexResult: LexResult,
  command: Command<Name, Input, E, R>,
  commandPath: ReadonlyArray<string> = []
): Effect.Effect<RawInput, CliError.CliError, FileSystem | Path> =>
  Effect.gen(function*() {
    const { tokens, trailingOperands: afterEndOfOptions } = lexResult
    const newCommandPath = [...commandPath, command.name]

    // Flags available at this level (ignore arguments)
    const singles = command.config.flags.flatMap(Param.extractSingleParams)
    const flagParams = singles.filter(isFlagParam)
    const flagSpec = makeFlagSpec(flagParams)

    const result = scanCommandLevel(tokens, {
      command,
      commandPath: newCommandPath,
      flagSpec
    })

    if (result._tag === "Leaf") {
      return {
        flags: result.flags,
        arguments: [...result.arguments, ...afterEndOfOptions],
        ...(result.errors.length > 0 && { errors: result.errors })
      }
    }

    const subLex: LexResult = { tokens: result.childTokens, trailingOperands: [] }
    const subParsed = yield* parseArgs(
      subLex,
      result.sub as unknown as Command<Name, Input, E, R>,
      newCommandPath
    )

    const allErrors = [...result.errors, ...(subParsed.errors ?? [])]
    return {
      flags: result.flags,
      arguments: [...result.leadingArguments, ...afterEndOfOptions],
      subcommand: { name: result.sub.name, parsedInput: subParsed },
      ...(allErrors.length > 0 && { errors: allErrors })
    }
  })
