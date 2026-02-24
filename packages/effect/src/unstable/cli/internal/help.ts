/**
 * Help Documentation
 * ================
 *
 * Internal helpers for generating help documentation.
 * Extracted from command.ts to avoid circular dependencies.
 */
import * as Effect from "../../../Effect.ts"
import type * as ServiceMap from "../../../ServiceMap.ts"
import type { Command } from "../Command.ts"
import type { GlobalFlag } from "../GlobalFlag.ts"
import type { FlagDoc, HelpDoc } from "../HelpDoc.ts"
import * as Param from "../Param.ts"
import * as Primitive from "../Primitive.ts"
import { toImpl } from "./command.ts"

/**
 * Helper function to get help documentation for a specific command path.
 * Navigates through the command hierarchy to find the right command.
 * Reads global flags from the registry and includes them in the help doc.
 */
export const getHelpForCommandPath = <Name extends string, Input, E, R>(
  command: Command<Name, Input, E, R>,
  commandPath: ReadonlyArray<string>,
  registry: ServiceMap.Reference<Set<GlobalFlag<unknown>>>
): Effect.Effect<HelpDoc, never, never> =>
  Effect.gen(function*() {
    let currentCommand: Command.Any = command

    for (let i = 1; i < commandPath.length; i++) {
      const subcommandName = commandPath[i]
      let subcommand: Command.Any | undefined = undefined

      for (const group of currentCommand.subcommands) {
        subcommand = group.commands.find((sub) => sub.name === subcommandName)
        if (subcommand) {
          break
        }
      }

      if (subcommand) {
        currentCommand = subcommand
      }
    }

    const baseDoc = toImpl(currentCommand).buildHelpDoc(commandPath)

    const flags = yield* registry
    const globalFlagDocs: Array<FlagDoc> = []
    for (const flag of flags) {
      const singles = Param.extractSingleParams(flag.flag)
      for (const single of singles) {
        const formattedAliases = single.aliases.map((alias) => alias.length === 1 ? `-${alias}` : `--${alias}`)
        globalFlagDocs.push({
          name: single.name,
          aliases: formattedAliases,
          type: single.typeName ?? Primitive.getTypeName(single.primitiveType),
          description: single.description,
          required: false
        })
      }
    }

    return { ...baseDoc, globalFlags: globalFlagDocs }
  })
