/**
 * Static Fish completion script generator.
 *
 * Produces a self-contained completion script from a `CommandDescriptor` —
 * no re-invocation of the CLI at runtime.
 *
 * @internal
 */
import type { ArgumentType, CommandDescriptor, FlagDescriptor, FlagType } from "./CommandDescriptor.ts"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const escapeFishString = (s: string): string => s.replace(/'/g, "\\'")

/**
 * Build a Fish condition that checks the current subcommand path.
 * For root-level completions: no subcommand entered yet
 * For nested: check that the command line contains the parent subcommand
 */
const subcommandCondition = (
  parentPath: ReadonlyArray<string>,
  allSubcommandNames: ReadonlyArray<string>
): string => {
  if (parentPath.length === 0) {
    // Root level — only show when no subcommand is active
    if (allSubcommandNames.length > 0) {
      return `__fish_use_subcommand`
    }
    return ``
  }
  // Nested — check that we've already entered the parent subcommand
  return `__fish_seen_subcommand_from ${parentPath[parentPath.length - 1]}`
}

const flagCompletionArgs = (flag: FlagDescriptor): Array<string> => {
  const args: Array<string> = [`-l ${flag.name}`]
  for (const alias of flag.aliases) {
    if (alias.length === 1) {
      args.push(`-s ${alias}`)
    } else {
      args.push(`-l ${alias}`)
    }
  }
  if (flag.description) {
    args.push(`-d '${escapeFishString(flag.description)}'`)
  }
  const valueArgs = flagValueArgs(flag.type)
  if (valueArgs) {
    args.push(valueArgs)
  }
  return args
}

const flagValueArgs = (type: FlagType): string | undefined => {
  switch (type._tag) {
    case "Boolean":
      return undefined
    case "Choice":
      return `-r -f -a '${type.values.join(" ")}'`
    case "Path":
      if (type.pathType === "directory") return `-r -F`
      return `-r -F`
    default:
      return `-r`
  }
}

const argValueArgs = (type: ArgumentType): string | undefined => {
  switch (type._tag) {
    case "Choice":
      return `-r -f -a '${type.values.join(" ")}'`
    case "Path":
      return `-r -F`
    default:
      return undefined
  }
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

const generateCompletions = (
  executableName: string,
  descriptor: CommandDescriptor,
  parentPath: ReadonlyArray<string>,
  lines: Array<string>
): void => {
  const allSubNames = descriptor.subcommands.map((s) => s.name)
  const condition = subcommandCondition(parentPath, allSubNames)
  const conditionArg = condition ? `-n '${condition}'` : ``

  // Subcommand completions
  for (const sub of descriptor.subcommands) {
    const parts = [`complete -c ${executableName}`]
    if (conditionArg) parts.push(conditionArg)
    parts.push(`-f -a '${escapeFishString(sub.name)}'`)
    if (sub.description) {
      parts.push(`-d '${escapeFishString(sub.description)}'`)
    }
    lines.push(parts.join(" "))
  }

  // Flag completions
  for (const flag of descriptor.flags) {
    const parts = [`complete -c ${executableName}`]
    if (conditionArg) parts.push(conditionArg)
    parts.push(...flagCompletionArgs(flag))
    lines.push(parts.join(" "))

    // Boolean negation
    if (flag.type._tag === "Boolean") {
      const negParts = [`complete -c ${executableName}`]
      if (conditionArg) negParts.push(conditionArg)
      negParts.push(`-l no-${flag.name}`)
      if (flag.description) {
        negParts.push(`-d '${escapeFishString(`Disable ${flag.name}`)}'`)
      }
      lines.push(negParts.join(" "))
    }
  }

  // Argument completions (type hints only)
  for (const arg of descriptor.arguments) {
    const valueArg = argValueArgs(arg.type)
    if (valueArg) {
      const parts = [`complete -c ${executableName}`]
      if (conditionArg) parts.push(conditionArg)
      parts.push(valueArg)
      if (arg.description) {
        parts.push(`-d '${escapeFishString(arg.description)}'`)
      }
      lines.push(parts.join(" "))
    }
  }

  // Recurse into subcommands
  for (const sub of descriptor.subcommands) {
    generateCompletions(executableName, sub, [...parentPath, sub.name], lines)
  }
}

/** @internal */
export const generate = (
  executableName: string,
  descriptor: CommandDescriptor
): string => {
  const lines: Array<string> = []

  lines.push(`###-begin-${executableName}-completions-###`)
  lines.push(`#`)
  lines.push(`# Static completion script for Fish`)
  lines.push(`#`)
  lines.push(`# Installation:`)
  lines.push(`#   ${executableName} --completions fish > ~/.config/fish/completions/${executableName}.fish`)
  lines.push(`#`)
  lines.push(``)

  generateCompletions(executableName, descriptor, [], lines)

  lines.push(``)
  lines.push(`###-end-${executableName}-completions-###`)

  return lines.join("\n")
}
