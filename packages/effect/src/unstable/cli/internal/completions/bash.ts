/**
 * Static Bash completion script generator.
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

const escapeForBash = (s: string): string => s.replace(/'/g, "'\\''")

const sanitizeFunctionName = (s: string): string => s.replace(/[^a-zA-Z0-9_]/g, "_")

const flagNamesForWordlist = (flag: FlagDescriptor): Array<string> => {
  const names: Array<string> = [`--${flag.name}`]
  for (const alias of flag.aliases) {
    names.push(alias.length === 1 ? `-${alias}` : `--${alias}`)
  }
  if (flag.type._tag === "Boolean") {
    names.push(`--no-${flag.name}`)
  }
  return names
}

const flagValueCompletion = (type: FlagType): string | undefined => {
  switch (type._tag) {
    case "Boolean":
      return undefined
    case "Choice":
      return `COMPREPLY=( $(compgen -W '${type.values.join(" ")}' -- "$cur") )`
    case "Path":
      if (type.pathType === "directory") return `COMPREPLY=( $(compgen -d -- "$cur") )`
      return `COMPREPLY=( $(compgen -f -- "$cur") )`
    default:
      return undefined
  }
}

const argCompletion = (type: ArgumentType): string | undefined => {
  switch (type._tag) {
    case "Choice":
      return `COMPREPLY=( $(compgen -W '${type.values.join(" ")}' -- "$cur") )`
    case "Path":
      if (type.pathType === "directory") return `COMPREPLY=( $(compgen -d -- "$cur") )`
      return `COMPREPLY=( $(compgen -f -- "$cur") )`
    default:
      return undefined
  }
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

const generateFunction = (
  descriptor: CommandDescriptor,
  parentPath: ReadonlyArray<string>,
  lines: Array<string>
): void => {
  const currentPath = [...parentPath, descriptor.name]
  const funcName = `_${currentPath.map(sanitizeFunctionName).join("_")}`

  lines.push(`${funcName}()`)
  lines.push(`{`)
  lines.push(`  local cur prev words cword`)
  lines.push(`  _init_completion || return`)
  lines.push(``)

  // Build flag-value dispatch
  const flagsWithValues = descriptor.flags.filter((f) => f.type._tag !== "Boolean")
  if (flagsWithValues.length > 0) {
    lines.push(`  # Flag value completions`)
    lines.push(`  case "$prev" in`)
    for (const flag of flagsWithValues) {
      const longNames = [`--${flag.name}`]
      for (const alias of flag.aliases) {
        longNames.push(alias.length === 1 ? `-${alias}` : `--${alias}`)
      }
      const completion = flagValueCompletion(flag.type)
      if (completion) {
        lines.push(`    ${longNames.join("|")})`)
        lines.push(`      ${completion}`)
        lines.push(`      return`)
        lines.push(`      ;;`)
      }
    }
    lines.push(`  esac`)
    lines.push(``)
  }

  // Subcommand dispatch
  if (descriptor.subcommands.length > 0) {
    lines.push(`  # Subcommand dispatch`)
    lines.push(`  local i cmd`)
    lines.push(`  for ((i = 1; i < cword; i++)); do`)
    lines.push(`    case "\${words[i]}" in`)
    for (const sub of descriptor.subcommands) {
      const subFuncName = `_${[...currentPath, sub.name].map(sanitizeFunctionName).join("_")}`
      lines.push(`      ${sub.name})`)
      lines.push(`        ${subFuncName}`)
      lines.push(`        return`)
      lines.push(`        ;;`)
    }
    lines.push(`    esac`)
    lines.push(`  done`)
    lines.push(``)
  }

  // Build word list (subcommands + flags)
  const wordListItems: Array<string> = []
  for (const sub of descriptor.subcommands) {
    wordListItems.push(sub.name)
  }
  for (const flag of descriptor.flags) {
    wordListItems.push(...flagNamesForWordlist(flag))
  }

  if (wordListItems.length > 0) {
    lines.push(`  # Complete subcommands and flags`)
    lines.push(`  if [[ "$cur" == -* ]]; then`)
    const flagWords = descriptor.flags.flatMap(flagNamesForWordlist)
    lines.push(`    COMPREPLY=( $(compgen -W '${flagWords.join(" ")}' -- "$cur") )`)
    lines.push(`    return`)
    lines.push(`  fi`)
    lines.push(``)
  }

  // Positional argument completion
  const argsWithCompletions = descriptor.arguments.filter((a) => argCompletion(a.type) !== undefined)
  if (argsWithCompletions.length > 0) {
    lines.push(`  # Positional argument completions`)
    for (const arg of argsWithCompletions) {
      const comp = argCompletion(arg.type)!
      lines.push(`  ${comp}`)
      lines.push(`  return`)
    }
  } else if (descriptor.subcommands.length > 0) {
    const subNames = descriptor.subcommands.map((s) => s.name)
    lines.push(`  COMPREPLY=( $(compgen -W '${subNames.join(" ")}' -- "$cur") )`)
  }

  lines.push(`}`)
  lines.push(``)

  // Recurse into subcommands
  for (const sub of descriptor.subcommands) {
    generateFunction(sub, currentPath, lines)
  }
}

/** @internal */
export const generate = (
  executableName: string,
  descriptor: CommandDescriptor
): string => {
  const lines: Array<string> = []
  const safeName = sanitizeFunctionName(executableName)

  lines.push(`###-begin-${escapeForBash(executableName)}-completions-###`)
  lines.push(`#`)
  lines.push(`# Static completion script for Bash`)
  lines.push(`#`)
  lines.push(`# Installation:`)
  lines.push(`#   ${escapeForBash(executableName)} --completions bash >> ~/.bashrc`)
  lines.push(`#`)
  lines.push(``)

  generateFunction(descriptor, [], lines)

  lines.push(`complete -F _${safeName} ${escapeForBash(executableName)}`)
  lines.push(`###-end-${escapeForBash(executableName)}-completions-###`)

  return lines.join("\n")
}
