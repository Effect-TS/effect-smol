import { idFromTrail } from "../shared.ts"
import { isDirType, isEitherPath, isFileType, optionRequiresValue, type SingleFlagMeta } from "../types.ts"

export const getValueCompleter = (s: SingleFlagMeta): string => {
  if (isDirType(s)) return "_path_files -/"
  if (isFileType(s) || isEitherPath(s)) return "_files"
  return "_message 'value'"
}

export const buildArgumentSpec = (s: SingleFlagMeta): Array<string> => {
  const specs: Array<string> = []
  const desc = s.name

  if (optionRequiresValue(s)) {
    const completer = getValueCompleter(s)
    specs.push(`"--${s.name}=[${desc}]:${s.name.replace(/-/g, "_")}:${completer}"`)
    for (const alias of s.aliases) {
      const prefix = alias.length === 1 ? "-" : "--"
      specs.push(`"${prefix}${alias}=[${desc}]:${s.name.replace(/-/g, "_")}:${completer}"`)
    }
  } else {
    specs.push(`"--${s.name}[${desc}]"`)
    for (const alias of s.aliases) {
      const prefix = alias.length === 1 ? "-" : "--"
      specs.push(`"${prefix}${alias}[${desc}]"`)
    }
  }
  return specs
}

export const buildSubcommandState = (trail: Array<string>): string => `"*::subcommand:->sub_${idFromTrail(trail)}"`

export const generateSubcommandCompletion = (subcommands: ReadonlyArray<any>, trail: Array<string>): Array<string> => {
  const items = subcommands.map((c) => `      '${c.name}:${c.name} command'`)
  return [
    `  sub_${idFromTrail(trail)})`,
    "    local -a subcmds",
    "    subcmds=(",
    ...items,
    "    )",
    "    _describe -t commands 'subcommand' subcmds && ret=0",
    "    ;;"
  ]
}
