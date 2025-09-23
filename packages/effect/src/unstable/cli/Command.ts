import * as Option from "../../data/Option.ts"
import * as Effect from "../../Effect.ts"
import { dual } from "../../Function.ts"
import { type Pipeable, pipeArguments } from "../../interfaces/Pipeable.ts"
import * as Console from "../../logging/Console.ts"
import type * as FileSystem from "../../platform/FileSystem.ts"
import type * as Path from "../../platform/Path.ts"
import * as References from "../../References.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as CliError from "./CliError.ts"
import type { ArgDoc, FlagDoc, HelpDoc, SubcommandDoc } from "./HelpDoc.ts"
import * as HelpFormatter from "./HelpFormatter.ts"
import { generateBashCompletions, generateFishCompletions, generateZshCompletions } from "./internal/completions.ts"
import {
  generateDynamicCompletion,
  handleCompletionRequest,
  isCompletionRequest
} from "./internal/completions/dynamic/index.ts"
import type { CommandConfig, InferConfig, ParsedConfig } from "./internal/config.ts"
import { parseConfig, reconstructConfigTree } from "./internal/config.ts"
import { extractSingleParams, getParamMetadata, type Param } from "./internal/param.ts"
import { extractBuiltInOptions, lex, parseArgs, ParsedCommandInput } from "./internal/parseCommandArgs.ts"
import type { ParamParseArgs } from "./internal/types.ts"
import { getTypeName } from "./Primitive.ts"

/**
 * @since 4.0.0
 * @category models
 */
export interface Command<Name extends string, Input, E = never, R = never> extends Pipeable {
  readonly _tag: "Command"
  readonly name: Name
  readonly description: string
  readonly subcommands: ReadonlyArray<Command<any, unknown, unknown, unknown>>
  // TODO: Do we need this and the parsedConfig?
  readonly config: CommandConfig
  // TODO: I hate this name.
  readonly parsedConfig: ParsedConfig
  readonly handler?: (input: Input) => Effect.Effect<void, E, R>
  readonly tag: ServiceMap.Key<Command.Context<Name>, Input>

  /** @internal */
  readonly handle: (
    input: Input,
    commandPath: ReadonlyArray<string>
  ) => Effect.Effect<void, E | CliError.CliError, R>
  /** @internal */
  readonly parse: (
    input: ParsedCommandInput
  ) => Effect.Effect<Input, CliError.CliError, Environment>
}

/**
 * The environment required by CLI commands, including file system and path operations.
 *
 * @since 4.0.0
 * @category types
 */
export type Environment = FileSystem.FileSystem | Path.Path // | Terminal when available

/**
 * @since 4.0.0
 * @category models
 */
export declare namespace Command {
  /**
   * @since 4.0.0
   * @category models
   */
  export interface Context<Name extends string> {
    readonly _: unique symbol
    readonly name: Name
  }
}

const CommandProto = {
  pipe() {
    return pipeArguments(this, arguments)
  }
}

/**
 * Creates a new Command by cloning an existing one and overriding selected fields.
 * Keeps the surface area small and helps readability when composing commands.
 * @internal
 */
const deriveCommand = <Name extends string, NewInput, E, R>(
  base: Command<Name, any, any, any>,
  overrides: {
    readonly subcommands?: ReadonlyArray<Command<any, unknown, unknown, unknown>>
    readonly handler?: ((input: NewInput) => Effect.Effect<void, E, R>) | undefined
    readonly parse: (
      input: ParsedCommandInput
    ) => Effect.Effect<NewInput, CliError.CliError, Environment>
    readonly handle: (
      input: NewInput,
      commandPath: ReadonlyArray<string>
    ) => Effect.Effect<void, E | CliError.CliError, R>
  }
): Command<Name, NewInput, E, R> => {
  const command = Object.create(CommandProto)
  command._tag = "Command"
  command.name = base.name
  command.description = base.description
  command.config = base.config
  command.subcommands = overrides.subcommands ?? base.subcommands
  command.parsedConfig = base.parsedConfig
  command.handler = overrides.handler ?? base.handler
  command.tag = ServiceMap.Key<Command.Context<Name>, NewInput>(`@effect/cli/Command/${base.name}`)
  command.handle = overrides.handle
  command.parse = overrides.parse
  return Object.freeze(command)
}

/**
 * Parses param values from parsed command arguments into their typed representations.
 * @internal
 */
const parseParams = (
  parsedArgs: ParamParseArgs,
  params: ReadonlyArray<Param<unknown>>
): Effect.Effect<ReadonlyArray<unknown>, CliError.CliError, Environment> => {
  return Effect.gen(function*() {
    const results: Array<unknown> = []
    let currentArguments = parsedArgs.arguments

    for (const option of params) {
      const [remainingArguments, parsed] = yield* option.parse({
        flags: parsedArgs.flags,
        arguments: currentArguments
      })
      results.push(parsed)
      currentArguments = remainingArguments
    }

    return results
  })
}

/**
 * Core constructor for all Command instances.
 * @internal
 */
const makeCore = <Name extends string, Input, E, R>(
  name: Name,
  config: CommandConfig,
  description: string,
  subcommands: ReadonlyArray<Command<any, unknown, unknown, unknown>>,
  handler?: (input: Input) => Effect.Effect<void, E, R>
): Command<Name, Input, E, R> => {
  const parsedConfig = parseConfig(config)
  const tag = ServiceMap.Key<Command.Context<Name>, Input>(`@effect/cli/Command/${name}`)

  const parse = (
    input: ParsedCommandInput
  ): Effect.Effect<Input, CliError.CliError, Environment> => {
    return Effect.gen(function*() {
      const parsedArgs: ParamParseArgs = { flags: input.flags, arguments: input.arguments }
      const allParams = parsedConfig.paramOrder
      const allValues = yield* parseParams(parsedArgs, allParams)
      const reconstructed = reconstructConfigTree(parsedConfig.tree, allValues)
      return reconstructed as Input
    })
  }

  const handle = (input: Input, commandPath: ReadonlyArray<string>) =>
    Effect.gen(function*() {
      if (handler) {
        yield* handler(input)
      } else {
        return yield* Effect.fail(new CliError.ShowHelp({ commandPath }))
      }
    })

  const command = Object.create(CommandProto)
  command._tag = "Command"
  command.name = name
  command.description = description
  command.config = config
  command.subcommands = subcommands
  command.parsedConfig = parsedConfig
  command.handler = handler
  command.tag = tag
  command.handle = handle
  command.parse = parse

  return Object.freeze(command)
}

/**
 * Creates a Command from a name, optional config, optional handler function, and optional description.
 *
 * @example
 * ```ts
 * import * as Command from "effect/cli/Command"
 * import * as Param from "effect/cli/Param"
 * import * as Effect from "effect/Effect"
 * import * as Console from "effect/Console"
 *
 * // Name only
 * const bareCommand = Command.make("init")
 *
 * // With config
 * const configCommand = Command.make("deploy", {
 *   environment: Flag.string("env"),
 *   force: Flag.boolean("force")
 * })
 *
 * // With config and handler
 * const fullCommand = Command.make("deploy", {
 *   environment: Flag.string("env"),
 *   force: Flag.boolean("force")
 * }, (config) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Deploying to ${config.environment}`)
 *   })
 * )
 *
 * // With config, handler, and description
 * const describedCommand = Command.make("deploy", {
 *   environment: Flag.string("env"),
 *   force: Flag.boolean("force")
 * }, (config) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Deploying to ${config.environment}`)
 *   }),
 *   "Deploy the application to a specified environment"
 * )
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const make: {
  <Name extends string>(name: Name): Command<Name, {}, never, never>

  <Name extends string, const Config extends CommandConfig>(
    name: Name,
    config: Config
  ): Command<Name, InferConfig<Config>, never, never>

  <Name extends string, const Config extends CommandConfig, R, E>(
    name: Name,
    config: Config,
    handler: (_: InferConfig<Config>) => Effect.Effect<void, E, R>
  ): Command<Name, InferConfig<Config>, E, R>
} = ((
  name: string,
  config?: CommandConfig,
  handler?: (_: unknown) => Effect.Effect<void, unknown, unknown>
) => {
  const actualConfig = config ?? ({} as CommandConfig)
  return makeCore(name, actualConfig, "", [], handler)
}) as any

/**
 * Adds or replaces the handler for a command.
 *
 * @example
 * ```ts
 * import * as Command from "effect/cli/Command"
 * import * as Param from "effect/cli/Param"
 * import * as Effect from "effect/Effect"
 * import * as Console from "effect/Console"
 *
 * const git = Command.make("git", {
 *   verbose: Flag.boolean("verbose")
 * }).pipe(
 *   Command.withSubcommands([clone, add]),
 *   Command.withHandler((config) =>
 *     Effect.gen(function*() {
 *       // Now config has the subcommand field
 *       yield* Console.log(`Git verbose: ${config.verbose}`)
 *       if (Option.isSome(config.subcommand)) {
 *         yield* Console.log(`Executed subcommand: ${config.subcommand.value.name}`)
 *       }
 *     })
 *   )
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const withHandler: {
  <A, R, E>(
    handler: (_: A) => Effect.Effect<void, E, R>
  ): <Name extends string, XR, XE>(
    self: Command<Name, A, XE, XR>
  ) => Command<Name, A, E, R>
  <Name extends string, A, XR, XE, R, E>(
    self: Command<Name, A, XE, XR>,
    handler: (_: A) => Effect.Effect<void, E, R>
  ): Command<Name, A, E, R>
} = dual(2, <Name extends string, A, XR, XE, R, E>(
  self: Command<Name, A, XE, XR>,
  handler: (_: A) => Effect.Effect<void, E, R>
): Command<Name, A, E, R> => {
  return makeCore<Name, A, E, R>(self.name, self.config, self.description, self.subcommands, handler)
})

/**
 * Adds subcommands to a command, creating a hierarchical command structure.
 *
 * @example
 * ```ts
 * import * as Command from "effect/cli/Command"
 * import * as Param from "effect/cli/Param"
 * import * as Effect from "effect/Effect"
 * import * as Console from "effect/Console"
 *
 * const clone = Command.make("clone", {
 *   repository: Flag.string("repository")
 * }, (config) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Cloning ${config.repository}`)
 *   })
 * )
 *
 * const add = Command.make("add", {
 *   files: Flag.string("files")
 * }, (config) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Adding ${config.files}`)
 *   })
 * )
 *
 * const git = Command.make("git", {}, () => Effect.void).pipe(
 *   Command.withSubcommands([clone, add])
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
/**
 * Checks for duplicate flag names between parent and child commands.
 * @internal
 */
const checkForDuplicateFlags = <Name extends string, Input>(
  parent: Command<Name, Input, unknown, unknown>,
  subcommands: ReadonlyArray<Command<any, unknown, unknown, unknown>>
): void => {
  const parentOptionNames = new Set<string>()

  const extractNames = (options: ReadonlyArray<Param<unknown>>): void => {
    for (const option of options) {
      const singles = extractSingleParams(option)
      for (const single of singles) {
        parentOptionNames.add(single.name)
      }
    }
  }

  extractNames(parent.parsedConfig.flags)

  for (const subcommand of subcommands) {
    for (const option of subcommand.parsedConfig.flags) {
      const singles = extractSingleParams(option)
      for (const single of singles) {
        if (parentOptionNames.has(single.name)) {
          throw new CliError.DuplicateOption({
            option: single.name,
            parentCommand: parent.name,
            childCommand: subcommand.name
          })
        }
      }
    }
  }
}

export const withSubcommands = <const Subcommands extends ReadonlyArray<Command<any, any, any, any>>>(
  ...subcommands: Subcommands
) =>
<Name extends string, Input, E, R>(
  self: Command<Name, Input, E, R>
): Command<
  Name,
  Input & { readonly subcommand: Option.Option<ExtractSubcommandInputs<Subcommands>> },
  ExtractSubcommandErrors<Subcommands>,
  R | Exclude<ExtractSubcommandContext<Subcommands>, Command.Context<Name>>
> => {
  checkForDuplicateFlags(self, subcommands)

  type NewInput = Input & { readonly subcommand: Option.Option<ExtractSubcommandInputs<Subcommands>> }

  // Build a stable name → subcommand index to avoid repeated linear scans
  const subcommandIndex = new Map<string, Command<any, any, any, any>>()
  for (const s of subcommands) subcommandIndex.set(s.name, s)

  const parse = (
    input: ParsedCommandInput
  ): Effect.Effect<NewInput, CliError.CliError, Environment> =>
    Effect.gen(function*() {
      const parentResult = yield* self.parse(input)

      const subRef = input.subcommand
      if (!subRef) {
        return { ...parentResult, subcommand: Option.none() } as NewInput
      }

      const sub = subcommandIndex.get(subRef.name)
      // Parser guarantees valid subcommand names, but guard defensively
      if (!sub) {
        return {
          ...parentResult,
          subcommand: Option.none()
        } as NewInput
      }

      const subResult = yield* sub.parse(subRef.parsedInput)
      const value = { name: sub.name, result: subResult } as ExtractSubcommandInputs<Subcommands>
      return { ...parentResult, subcommand: Option.some(value) } as NewInput
    })

  const handle = (input: NewInput, commandPath: ReadonlyArray<string>) =>
    Effect.gen(function*() {
      if (Option.isSome(input.subcommand)) {
        const selected = input.subcommand.value
        const child = subcommandIndex.get(selected.name)
        if (!child) {
          return yield* Effect.fail(new CliError.ShowHelp({ commandPath }))
        }
        yield* child
          .handle(selected.result, [...commandPath, child.name])
          .pipe(Effect.provideService(self.tag, input))
        return
      }

      if (self.handler) {
        yield* self.handler(input as any)
        return
      }

      return yield* Effect.fail(new CliError.ShowHelp({ commandPath }))
    })

  return deriveCommand<
    Name,
    NewInput,
    ExtractSubcommandErrors<Subcommands>,
    R | Exclude<ExtractSubcommandContext<Subcommands>, Command.Context<Name>>
  >(self, {
    subcommands,
    // Maintain the same handler reference; type-widen for the derived input
    handler: (self.handler as unknown as ((input: NewInput) => Effect.Effect<void, any, any>)) ?? undefined,
    parse,
    handle
  })
}

// Helper to get E from a single Command
type ErrorOf<C> = C extends Command<any, any, infer E, any> ? E : never

// Errors across a tuple (preferred), falling back to array element type
type ExtractSubcommandErrors<T extends ReadonlyArray<unknown>> = T extends readonly [] ? never
  : T extends readonly [infer H, ...infer R] ? ErrorOf<H> | ExtractSubcommandErrors<R>
  : T extends ReadonlyArray<infer C> ? ErrorOf<C>
  : never

type ContextOf<C> = C extends Command<any, any, any, infer R> ? R : never

type ExtractSubcommandContext<T extends ReadonlyArray<unknown>> = T extends readonly [] ? never
  : T extends readonly [infer H, ...infer R] ? ContextOf<H> | ExtractSubcommandContext<R>
  : T extends ReadonlyArray<infer C> ? ContextOf<C>
  : never

type InputOf<C> = C extends Command<infer N, infer I, any, any> ? { readonly name: N; readonly result: I } : never

type ExtractSubcommandInputs<T extends ReadonlyArray<unknown>> = T extends readonly [] ? never
  : T extends readonly [infer H, ...infer R] ? InputOf<H> | ExtractSubcommandInputs<R>
  : T extends ReadonlyArray<infer C> ? InputOf<C>
  : never

/**
 * Sets the description for a command.
 *
 * Descriptions provide users with information about what the command does
 * when they view help documentation.
 *
 * @example
 * ```ts
 * import * as Command from "effect/cli/Command"
 * import * as Param from "effect/cli/Param"
 * import * as Effect from "effect/Effect"
 * import * as Console from "effect/Console"
 *
 * const deploy = Command.make("deploy", {
 *   environment: Flag.string("env")
 * }, (config) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Deploying to ${config.environment}`)
 *   })
 * ).pipe(
 *   Command.withDescription("Deploy the application to a specified environment")
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const withDescription: {
  (description: string): <Name extends string, Input, E, R>(
    self: Command<Name, Input, E, R>
  ) => Command<Name, Input, E, R>
  <Name extends string, Input, E, R>(
    self: Command<Name, Input, E, R>,
    description: string
  ): Command<Name, Input, E, R>
} = dual(2, <Name extends string, Input, E, R>(
  self: Command<Name, Input, E, R>,
  description: string
): Command<Name, Input, E, R> => {
  return makeCore<Name, Input, E, R>(self.name, self.config, description, self.subcommands, self.handler)
})

/**
 * Generates a HelpDoc structure from a Command.
 * This structured data can be formatted for display using HelpFormatter.
 *
 * @since 4.0.0
 * @category help
 */
export const getHelpDoc = <Name extends string, Input>(
  command: Command<Name, Input, unknown, unknown>,
  commandPath?: ReadonlyArray<string>
): HelpDoc => {
  const args: Array<ArgDoc> = []
  const flags: Array<FlagDoc> = []

  // Extract positional arguments
  for (const arg of command.parsedConfig.arguments) {
    const singles = extractSingleParams(arg)
    const metadata = getParamMetadata(arg)

    for (const single of singles) {
      args.push({
        name: single.name,
        type: single.typeName ?? getTypeName(single.primitiveType),
        description: Option.getOrElse(single.description, () => ""),
        required: !metadata.isOptional,
        variadic: metadata.isVariadic
      })
    }
  }

  // Build usage string with positional arguments
  let usage: string
  if (commandPath && commandPath.length > 0) {
    // Use the full command path if provided
    usage = commandPath.join(" ")
  } else {
    // Fall back to just the command name
    usage = command.name
  }

  if (command.subcommands.length > 0) {
    usage += " <subcommand>"
  }
  usage += " [flags]"

  // Add positional arguments to usage
  for (const arg of args) {
    const argName = arg.variadic ? `<${arg.name}...>` : `<${arg.name}>`
    usage += ` ${arg.required ? argName : `[${argName}]`}`
  }

  // Extract flags from options
  const extractFlags = (options: ReadonlyArray<Param<unknown>>): void => {
    for (const option of options) {
      const singles = extractSingleParams(option)
      for (const single of singles) {
        const formattedAliases = single.aliases.map((alias) => alias.length === 1 ? `-${alias}` : `--${alias}`)

        flags.push({
          name: single.name,
          aliases: formattedAliases,
          type: single.typeName ?? getTypeName(single.primitiveType),
          description: Option.getOrElse(single.description, () => ""),
          required: single.primitiveType._tag !== "Boolean"
        })
      }
    }
  }

  extractFlags(command.parsedConfig.flags)

  // Extract subcommand info
  const subcommandDocs: Array<SubcommandDoc> = command.subcommands.map((sub) => ({
    name: sub.name,
    description: sub.description
  }))

  return {
    description: command.description,
    usage,
    flags,
    ...(args.length > 0 && { args }),
    ...(subcommandDocs.length > 0 && { subcommands: subcommandDocs })
  }
}

/**
 * Helper function to get help documentation for a specific command path.
 * Navigates through the command hierarchy to find the right command.
 * @internal
 */
const getHelpForCommandPath = <Name extends string, Input, E, R>(
  command: Command<Name, Input, E, R>,
  commandPath: ReadonlyArray<string>
): HelpDoc => {
  let currentCommand: Command<string, unknown, unknown, unknown> = command as any

  // Navigate through the command path to find the target command
  for (let i = 1; i < commandPath.length; i++) {
    const subcommandName = commandPath[i]
    const subcommand = currentCommand.subcommands.find((sub) => sub.name === subcommandName)
    if (subcommand) {
      currentCommand = subcommand
    }
  }

  return getHelpDoc(currentCommand, commandPath)
}

/**
 * Runs a command with the provided input arguments.
 *
 * @example
 * ```ts
 * import * as Command from "effect/cli/Command"
 * import * as Param from "effect/cli/Param"
 * import * as Effect from "effect/Effect"
 * import * as Console from "effect/Console"
 *
 * const greetCommand = Command.make("greet", {
 *   name: Flag.string("name")
 * }, (config) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Hello, ${config.name}!`)
 *   })
 * )
 *
 * const runGreet = Command.run(greetCommand)
 *
 * // Run with input: ["--name", "Alice"]
 * const program = runGreet(["--name", "Alice"])
 * ```
 *
 * @since 4.0.0
 * @category execution
 */
export const run = <Name extends string, Input, E, R>(
  command: Command<Name, Input, E, R>,
  _config: {
    readonly name: string
    readonly version: string
  }
): (
  input: ReadonlyArray<string>
) => Effect.Effect<void, E | CliError.CliError, R | Environment> =>
(input) =>
  Effect.gen(function*() {
    // Check for dynamic completion request early (before normal parsing)
    if (isCompletionRequest(input)) {
      yield* Effect.sync(() => handleCompletionRequest(command))
      return
    }

    // Parse command arguments (built-ins are extracted automatically)
    const { tokens, trailingOperands } = lex(input)
    const { completions, dynamicCompletions, help, logLevel, remainder, version } = yield* extractBuiltInOptions(tokens)
    const parsedArgs = yield* parseArgs({ tokens: remainder, trailingOperands }, command)
    const helpRenderer = yield* HelpFormatter.HelpRenderer

    if (help) {
      const commandPath = [command.name, ...ParsedCommandInput.getCommandPath(parsedArgs)]
      const helpDoc = getHelpForCommandPath(command, commandPath)
      const helpText = helpRenderer.formatHelpDoc(helpDoc)
      yield* Console.log(helpText)
      return
    } else if (Option.isSome(completions)) {
      const shell = completions.value
      const script = shell === "bash"
        ? generateBashCompletions(command, _config.name)
        : shell === "fish"
        ? generateFishCompletions(command, _config.name)
        : generateZshCompletions(command, _config.name)
      yield* Console.log(script)
      return
    } else if (Option.isSome(dynamicCompletions)) {
      const shell = dynamicCompletions.value
      const script = generateDynamicCompletion(command, _config.name, shell)
      yield* Console.log(script)
      return
    } else if (version && command.subcommands.length === 0) {
      const versionText = helpRenderer.formatVersion(_config.name, _config.version)
      yield* Console.log(versionText)
      return
    }

    // If there are parsing errors and no help was requested, format and display the error
    if (parsedArgs.errors && parsedArgs.errors.length > 0) {
      const error = parsedArgs.errors[0]
      const helpRenderer = yield* HelpFormatter.HelpRenderer
      const commandPath = [command.name, ...ParsedCommandInput.getCommandPath(parsedArgs)]
      const helpDoc = getHelpForCommandPath(command, commandPath)

      // Show the full help first (to stdout with normal colors)
      const helpText = helpRenderer.formatHelpDoc(helpDoc)
      yield* Console.log(helpText)
      yield* Console.log("")

      // Then show the error in a clearly marked ERROR section (to stderr)
      yield* Console.error(helpRenderer.formatError(error))

      return
    }

    const parseResult = yield* Effect.result(command.parse(parsedArgs))
    if (parseResult._tag === "Failure") {
      const error = parseResult.failure
      const helpRenderer = yield* HelpFormatter.HelpRenderer
      const commandPath = [command.name, ...ParsedCommandInput.getCommandPath(parsedArgs)]
      const helpDoc = getHelpForCommandPath(command, commandPath)

      // Show the full help first (to stdout with normal colors)
      const helpText = helpRenderer.formatHelpDoc(helpDoc)
      yield* Console.log(helpText)
      yield* Console.log("")

      // Then show the error in a clearly marked ERROR section (to stderr)
      yield* Console.error(helpRenderer.formatError(error))

      return
    }
    const parsed = parseResult.success

    // Create the execution program
    const program = command.handle(parsed, [command.name])

    // Apply log level if provided via built-ins
    const finalProgram = Option.isSome(logLevel)
      ? Effect.provideService(program, References.MinimumLogLevel, logLevel.value)
      : program

    // Normalize non-CLI errors into CliError.UserError so downstream catchTags
    // can rely on CLI-tagged errors only.
    const normalized = finalProgram.pipe(
      Effect.catch((err) =>
        CliError.isCliError(err) ? Effect.fail(err) : Effect.fail(new CliError.UserError({ cause: err }))
      )
    )
    yield* normalized
  }).pipe(
    Effect.catchTags({
      ShowHelp: (error: CliError.ShowHelp) =>
        Effect.gen(function*() {
          const helpDoc = getHelpForCommandPath(command, error.commandPath)
          const helpRenderer = yield* HelpFormatter.HelpRenderer
          const helpText = helpRenderer.formatHelpDoc(helpDoc)
          yield* Console.log(helpText)
        })
    }),
    // Preserve prior public behavior: surface original handler errors
    Effect.catchTag("UserError", (error: CliError.UserError) => Effect.fail(error.cause as any))
  )
