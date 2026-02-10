/**
 * Static Zsh completion script generator.
 *
 * Produces a self-contained completion script from a `CommandDescriptor` —
 * no re-invocation of the CLI at runtime.
 *
 * @internal
 */
import type {
  ArgumentDescriptor,
  ArgumentType,
  CommandDescriptor,
  FlagDescriptor,
  FlagType
} from "./CommandDescriptor.ts"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const escapeZshDescription = (s: string): string => s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "'\\''")

const sanitizeFunctionName = (s: string): string => s.replace(/[^a-zA-Z0-9_]/g, "_")

const flagSpec = (flag: FlagDescriptor): Array<string> => {
  const specs: Array<string> = []
  const desc = flag.description ? `[${escapeZshDescription(flag.description)}]` : ""
  const valueAction = flagValueAction(flag.type)

  const longSpec = `--${flag.name}${desc}${valueAction}`
  specs.push(`'${longSpec}'`)

  for (const alias of flag.aliases) {
    const aliasSpec = alias.length === 1
      ? `-${alias}${desc}${valueAction}`
      : `--${alias}${desc}${valueAction}`
    specs.push(`'${aliasSpec}'`)
  }

  if (flag.type._tag === "Boolean") {
    specs.push(`'--no-${flag.name}${desc}'`)
  }

  return specs
}

const flagValueAction = (type: FlagType): string => {
  switch (type._tag) {
    case "Boolean":
      return ""
    case "Choice":
      return `:value:(${type.values.join(" ")})`
    case "Path":
      if (type.pathType === "directory") return `:directory:_directories`
      return `:file:_files`
    case "Integer":
      return `:integer:`
    case "Float":
      return `:float:`
    case "Date":
      return `:date:`
    default:
      return `:string:`
  }
}

const argSpec = (arg: ArgumentDescriptor): string => {
  const desc = arg.description ? escapeZshDescription(arg.description) : arg.name
  const action = argValueAction(arg.type)
  const prefix = arg.variadic ? "*" : arg.required ? "" : ""
  return `'${prefix}:${desc}:${action}'`
}

const argValueAction = (type: ArgumentType): string => {
  switch (type._tag) {
    case "Choice":
      return `(${type.values.join(" ")})`
    case "Path":
      if (type.pathType === "directory") return `_directories`
      return `_files`
    default:
      return ``
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

  lines.push(`${funcName}() {`)

  // Subcommand handling
  if (descriptor.subcommands.length > 0) {
    lines.push(`  local -a commands`)
    lines.push(`  commands=(`)
    for (const sub of descriptor.subcommands) {
      const desc = sub.description ? escapeZshDescription(sub.description) : ""
      lines.push(`    '${sub.name}:${desc}'`)
    }
    lines.push(`  )`)
    lines.push(``)
    lines.push(`  _arguments -C \\`)

    // Add flag specs
    for (const flag of descriptor.flags) {
      for (const spec of flagSpec(flag)) {
        lines.push(`    ${spec} \\`)
      }
    }

    // Add argument specs
    for (const arg of descriptor.arguments) {
      lines.push(`    ${argSpec(arg)} \\`)
    }

    lines.push(`    '1:command:->command' \\`)
    lines.push(`    '*::arg:->args'`)
    lines.push(``)
    lines.push(`  case "$state" in`)
    lines.push(`    command)`)
    lines.push(`      _describe -t commands 'commands' commands`)
    lines.push(`      ;;`)
    lines.push(`    args)`)
    lines.push(`      case "$words[1]" in`)
    for (const sub of descriptor.subcommands) {
      const subFuncName = `_${[...currentPath, sub.name].map(sanitizeFunctionName).join("_")}`
      lines.push(`        ${sub.name})`)
      lines.push(`          ${subFuncName}`)
      lines.push(`          ;;`)
    }
    lines.push(`      esac`)
    lines.push(`      ;;`)
    lines.push(`  esac`)
  } else {
    // Leaf command: just flags and arguments
    const hasSpecs = descriptor.flags.length > 0 || descriptor.arguments.length > 0
    if (hasSpecs) {
      lines.push(`  _arguments \\`)
      for (const flag of descriptor.flags) {
        for (const spec of flagSpec(flag)) {
          lines.push(`    ${spec} \\`)
        }
      }
      for (const arg of descriptor.arguments) {
        lines.push(`    ${argSpec(arg)} \\`)
      }
      // Remove trailing backslash from last line
      const lastIdx = lines.length - 1
      lines[lastIdx] = lines[lastIdx].replace(/ \\$/, "")
    }
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

  lines.push(`#compdef ${executableName}`)
  lines.push(`###-begin-${executableName}-completions-###`)
  lines.push(`#`)
  lines.push(`# Static completion script for Zsh`)
  lines.push(`#`)
  lines.push(`# Installation:`)
  lines.push(`#   ${executableName} --completions zsh > ~/.zsh/completions/_${executableName}`)
  lines.push(`#   then add ~/.zsh/completions to your fpath`)
  lines.push(`#`)
  lines.push(``)

  generateFunction(descriptor, [], lines)

  lines.push(`# Handle both direct invocation and autoload`)
  lines.push(`if [[ "\${zsh_eval_context[-1]}" == "loadautofunc" ]]; then`)
  lines.push(`  _${safeName} "$@"`)
  lines.push(`else`)
  lines.push(`  compdef _${safeName} ${executableName}`)
  lines.push(`fi`)
  lines.push(`###-end-${executableName}-completions-###`)

  return lines.join("\n")
}
