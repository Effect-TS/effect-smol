import type { Command } from "../../Command.ts"
import { flattenCommand, getSingles } from "./shared.ts"
import { isDirType, isEitherPath, isFileType, optionRequiresValue } from "./types.ts"

const optionTokens = (singles: ReadonlyArray<any>): Array<string> => {
  const out: Array<string> = []
  for (const s of singles) {
    for (const a of s.aliases) {
      out.push(a.length === 1 ? `-${a}` : `--${a}`)
    }
    out.push(`--${s.name}`)
  }
  return out
}

/** @internal */
export const generateBashCompletions = <Name extends string, I, E, R>(
  rootCmd: Command<Name, I, E, R>,
  executableName: string
): string => {
  type AnyCommand = Command<any, any, any, any>

  const rows = flattenCommand(rootCmd as AnyCommand)
  const funcCases: Array<string> = []
  const cmdCases: Array<string> = []

  for (const { cmd, trail } of rows) {
    const singles = getSingles(cmd.config.flags)
    const words = [
      ...optionTokens(singles),
      ...cmd.subcommands.map((s) => s.name)
    ]
    const wordList = words.join(" ")

    const optionCases: Array<string> = []
    for (const s of singles) {
      if (!optionRequiresValue(s)) continue
      const prevs = [
        ...s.aliases.map((a) => (a.length === 1 ? `-${a}` : `--${a}`)),
        `--${s.name}`
      ]
      const comp = isDirType(s)
        ? "$(compgen -d \"${cur}\")"
        : (isFileType(s) || isEitherPath(s))
        ? "$(compgen -f \"${cur}\")"
        : "\"${cur}\""
      for (const p of prevs) optionCases.push(`"${p}") COMPREPLY=( ${comp} ); return 0 ;;`)
    }

    if (trail.length > 1) {
      const funcName = `__${executableName}_${trail.join("_")}_opts`
      funcCases.push(
        `            ,${trail.join(" ")})`,
        `                cmd="${funcName}"`,
        "                ;;"
      )
    }

    const funcName = `__${executableName}_${trail.join("_")}_opts`
    cmdCases.push(
      `${funcName})`,
      `    opts="${wordList}"`,
      `    if [[ \${cur} == -* || \${COMP_CWORD} -eq ${trail.length} ]] ; then`,
      `        COMPREPLY=( $(compgen -W "${wordList}" -- "\${cur}") )`,
      "        return 0",
      "    fi",
      "    case \\\"${prev}\\\" in"
    )
    for (const l of optionCases) {
      cmdCases.push(`        ${l}`)
    }
    cmdCases.push(
      "    *)",
      "        COMPREPLY=()",
      "        ;;",
      "    esac",
      `    COMPREPLY=( $(compgen -W "${wordList}" -- "\${cur}") )`,
      "    return 0",
      "    ;;"
    )
  }

  const scriptName = `_${executableName}_bash_completions`
  const lines = [
    `function ${scriptName}() {`,
    "    local i cur prev opts cmd",
    "    COMPREPLY=()",
    "    cur=\\\"${COMP_WORDS[COMP_CWORD]}\\\"",
    "    prev=\\\"${COMP_WORDS[COMP_CWORD-1]}\\\"",
    "    cmd=\\\"\\\"",
    "    opts=\\\"\\\"",
    "    for i in \"${COMP_WORDS[@]}\"; do",
    "        case \"${cmd},${i}\" in",
    `            ,${executableName})`,
    `                cmd="__${executableName}_${executableName}_opts"`,
    "                ;;",
    ...funcCases,
    "            *)",
    "                ;;",
    "        esac",
    "    done",
    "    case \\\"${cmd}\\\" in",
    ...cmdCases.map((l) => `        ${l}`),
    "    esac",
    "}",
    `complete -F ${scriptName} -o nosort -o bashdefault -o default ${executableName}`
  ]
  return lines.join("\n")
}
