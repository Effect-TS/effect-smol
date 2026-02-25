/**
 * Command Implementation
 * ======================
 *
 * Internal implementation details for CLI commands.
 * Public API is in ../Command.ts
 */
import * as Arr from "../../../Array.ts"
import * as Effect from "../../../Effect.ts"
import { YieldableProto } from "../../../internal/core.ts"
import { pipeArguments } from "../../../Pipeable.ts"
import * as Predicate from "../../../Predicate.ts"
import * as ServiceMap from "../../../ServiceMap.ts"
import * as CliError from "../CliError.ts"
import type * as GlobalFlag from "../GlobalFlag.ts"
import type { ArgDoc, ExampleDoc, FlagDoc, HelpDoc, SubcommandGroupDoc } from "../HelpDoc.ts"
import * as Param from "../Param.ts"
import * as Primitive from "../Primitive.ts"
import { type ConfigInternal, reconstructTree } from "./config.ts"

/* ========================================================================== */
/* Types                                                                      */
/* ========================================================================== */

import type { Command, CommandContext, Environment, ParsedTokens } from "../Command.ts"

interface SubcommandGroup {
  readonly group: string | undefined
  readonly commands: Arr.NonEmptyReadonlyArray<Command<any, unknown, unknown, unknown>>
}

/**
 * Internal implementation interface with all the machinery.
 * Use toImpl() to access from internal code.
 */
export interface CommandInternal<Name extends string, Input, E, R> extends Command<Name, Input, E, R> {
  readonly config: ConfigInternal
  readonly service: ServiceMap.Service<CommandContext<Name>, Input>
  readonly annotations: ServiceMap.ServiceMap<never>
  readonly globalFlags: ReadonlyArray<GlobalFlag.GlobalFlag<any>>
  readonly parse: (input: ParsedTokens) => Effect.Effect<Input, CliError.CliError, Environment>
  readonly handle: (
    input: Input,
    commandPath: ReadonlyArray<string>
  ) => Effect.Effect<void, E | CliError.CliError, R | Environment>
  readonly buildHelpDoc: (commandPath: ReadonlyArray<string>) => HelpDoc
}

/* ========================================================================== */
/* Type ID                                                                    */
/* ========================================================================== */

export const TypeId = "~effect/cli/Command" as const

/* ========================================================================== */
/* Casting                                                                    */
/* ========================================================================== */

/**
 * Casts a Command to its internal implementation.
 * For use by internal modules that need access to config, parse, handle, etc.
 */
export const toImpl = <Name extends string, Input, E, R>(
  self: Command<Name, Input, E, R>
): CommandInternal<Name, Input, E, R> => self as CommandInternal<Name, Input, E, R>

/* ========================================================================== */
/* Proto                                                                      */
/* ========================================================================== */

export const Proto = {
  ...YieldableProto,
  pipe() {
    return pipeArguments(this, arguments)
  },
  asEffect(this: Command<any, any, any, any>) {
    return toImpl(this).service.asEffect()
  }
}

/* ========================================================================== */
/* Constructor                                                                */
/* ========================================================================== */

/**
 * Internal command constructor. Only accepts already-parsed ConfigInternal.
 */
export const makeCommand = <const Name extends string, Input, E, R>(options: {
  readonly name: Name
  readonly config: ConfigInternal
  readonly service?: ServiceMap.Service<CommandContext<Name>, Input> | undefined
  readonly annotations?: ServiceMap.ServiceMap<never> | undefined
  readonly globalFlags?: ReadonlyArray<GlobalFlag.GlobalFlag<any>> | undefined
  readonly description?: string | undefined
  readonly shortDescription?: string | undefined
  readonly alias?: string | undefined
  readonly examples?: ReadonlyArray<Command.Example> | undefined
  readonly subcommands?: ReadonlyArray<SubcommandGroup> | undefined
  readonly parse?: ((input: ParsedTokens) => Effect.Effect<Input, CliError.CliError, Environment>) | undefined
  readonly handle?:
    | ((input: Input, commandPath: ReadonlyArray<string>) => Effect.Effect<void, E, R | Environment>)
    | undefined
}): Command<Name, Input, E, R> => {
  const service = options.service ?? ServiceMap.Service<CommandContext<Name>, Input>(`${TypeId}/${options.name}`)
  const config = options.config
  const annotations = options.annotations ?? ServiceMap.empty()
  const globalFlags = options.globalFlags ?? []
  const subcommands = options.subcommands ?? []

  const handle = (
    input: Input,
    commandPath: ReadonlyArray<string>
  ): Effect.Effect<void, CliError.CliError | E, R | Environment> =>
    Predicate.isNotUndefined(options.handle)
      ? options.handle(input, commandPath)
      : Effect.fail(new CliError.ShowHelp({ commandPath }))

  const parse = options.parse ?? Effect.fnUntraced(function*(input: ParsedTokens) {
    const parsedArgs: Param.ParsedArgs = { flags: input.flags, arguments: input.arguments }
    const values = yield* parseParams(parsedArgs, config.orderedParams)
    return reconstructTree(config.tree, values) as Input
  })

  const buildHelpDoc = (commandPath: ReadonlyArray<string>): HelpDoc => {
    const args: Array<ArgDoc> = []
    const flags: Array<FlagDoc> = []

    for (const arg of config.arguments) {
      const singles = Param.extractSingleParams(arg)
      const metadata = Param.getParamMetadata(arg)
      for (const single of singles) {
        args.push({
          name: single.name,
          type: single.typeName ?? Primitive.getTypeName(single.primitiveType),
          description: single.description,
          required: !metadata.isOptional,
          variadic: metadata.isVariadic
        })
      }
    }

    let usage = commandPath.length > 0 ? commandPath.join(" ") : options.name
    if (subcommands.some((group) => group.commands.length > 0)) {
      usage += " <subcommand>"
    }
    usage += " [flags]"
    for (const arg of args) {
      const argName = arg.variadic ? `<${arg.name}...>` : `<${arg.name}>`
      usage += ` ${arg.required ? argName : `[${argName}]`}`
    }

    for (const option of config.flags) {
      const singles = Param.extractSingleParams(option)
      for (const single of singles) {
        const formattedAliases = single.aliases.map((alias) => alias.length === 1 ? `-${alias}` : `--${alias}`)
        flags.push({
          name: single.name,
          aliases: formattedAliases,
          type: single.typeName ?? Primitive.getTypeName(single.primitiveType),
          description: single.description,
          required: single.primitiveType._tag !== "Boolean"
        })
      }
    }

    const subcommandDocs: Array<SubcommandGroupDoc> = []

    for (const group of subcommands) {
      subcommandDocs.push({
        group: group.group,
        commands: Arr.map(group.commands, (subcommand) => ({
          name: subcommand.name,
          alias: subcommand.alias,
          shortDescription: subcommand.shortDescription,
          description: subcommand.description ?? ""
        }))
      })
    }

    const examples: ReadonlyArray<ExampleDoc> = options.examples ?? []

    return {
      description: options.description ?? "",
      usage,
      flags,
      annotations,
      ...(args.length > 0 && { args }),
      ...(subcommandDocs.length > 0 && { subcommands: subcommandDocs }),
      ...(examples.length > 0 && { examples })
    }
  }

  return Object.assign(Object.create(Proto), {
    [TypeId]: TypeId,
    name: options.name,
    examples: options.examples ?? [],
    annotations,
    globalFlags,
    subcommands,
    config,
    service,
    parse,
    handle,
    buildHelpDoc,
    ...(Predicate.isNotUndefined(options.description)
      ? { description: options.description }
      : {}),
    ...(Predicate.isNotUndefined(options.shortDescription)
      ? { shortDescription: options.shortDescription }
      : {}),
    ...(Predicate.isNotUndefined(options.alias)
      ? { alias: options.alias }
      : {})
  })
}

/* ========================================================================== */
/* Helpers                                                                    */
/* ========================================================================== */

/**
 * Parses param values from parsed command arguments into their typed
 * representations.
 */
const parseParams: (parsedArgs: Param.ParsedArgs, params: ReadonlyArray<Param.Any>) => Effect.Effect<
  ReadonlyArray<unknown>,
  CliError.CliError,
  Environment
> = Effect.fnUntraced(function*(parsedArgs, params) {
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

/**
 * Checks for duplicate flag names between parent and child commands.
 */
export const checkForDuplicateFlags = <Name extends string, Input>(
  parent: Command<Name, Input, unknown, unknown>,
  subcommands: ReadonlyArray<Command<any, unknown, unknown, unknown>>
): void => {
  const parentImpl = toImpl(parent)
  const parentOptionNames = new Set<string>()

  const extractNames = (options: ReadonlyArray<Param.Any>): void => {
    for (const option of options) {
      const singles = Param.extractSingleParams(option)
      for (const single of singles) {
        parentOptionNames.add(single.name)
      }
    }
  }

  extractNames(parentImpl.config.flags)

  for (const subcommand of subcommands) {
    const subImpl = toImpl(subcommand)
    for (const option of subImpl.config.flags) {
      const singles = Param.extractSingleParams(option)
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
