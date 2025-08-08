import type { Command } from "../Command.ts"
import { extractSingleParams } from "./param.ts"
import type { Param } from "./param.ts"

type Shell = "bash" | "zsh" | "fish"

interface SingleFlagMeta {
  readonly name: string
  readonly aliases: ReadonlyArray<string>
  readonly primitiveTag: string
  readonly typeName?: string
}

const getSingles = (flags: ReadonlyArray<Param<unknown>>): ReadonlyArray<SingleFlagMeta> =>
  flags
    .flatMap(extractSingleParams)
    .filter((s: any) => s.kind === "flag")
    .map((s: any) => ({
      name: s.name,
      aliases: s.aliases,
      primitiveTag: s.primitiveType._tag,
      ...(s.typeName !== undefined ? { typeName: s.typeName } : {})
    }))

const optionTokens = (singles: ReadonlyArray<SingleFlagMeta>): Array<string> => {
  const out: Array<string> = []
  for (const s of singles) {
    for (const a of s.aliases) {
      out.push(a.length === 1 ? `-${a}` : `--${a}`)
    }
    out.push(`--${s.name}`)
  }
  return out
}

const optionRequiresValue = (s: SingleFlagMeta): boolean => s.primitiveTag !== "Boolean"

const isDirType = (s: SingleFlagMeta): boolean => s.typeName === "directory"
const isFileType = (s: SingleFlagMeta): boolean => s.typeName === "file"

/* -------------------------------------------------------------------------------------------------
 * Bash
 * -------------------------------------------------------------------------------------------------*/

export const generateBashCompletions = <Name extends string, I, E, R>(
  rootCmd: Command<Name, I, E, R>,
  executableName: string
): string => {
  type AnyCommand = Command<any, any, any, any>
  const flatten = (cmd: AnyCommand, parents: Array<string> = []): Array<{ trail: Array<string>; cmd: AnyCommand }> => {
    const here = [...parents, cmd.name]
    const rows = [{ trail: here, cmd }]
    for (const c of cmd.subcommands) {
      const nested = flatten(c as AnyCommand, here)
      for (const row of nested) rows.push(row)
    }
    return rows
  }

  const rows = flatten(rootCmd as AnyCommand)
  const funcCases: Array<string> = []
  const cmdCases: Array<string> = []

  for (const { cmd, trail } of rows) {
    const singles = getSingles(cmd.parsedConfig.flags)
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
        : isFileType(s)
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
      `        COMPREPLY=( $(compgen -W "${wordList}" -- "${"${cur}"}") )`,
      "        return 0",
      "    fi",
      "    case \"${prev}\" in"
    )
    for (const l of optionCases) {
      cmdCases.push(`        ${l}`)
    }
    cmdCases.push(
      "    *)",
      "        COMPREPLY=()",
      "        ;;",
      "    esac",
      `    COMPREPLY=( $(compgen -W "${wordList}" -- "${"${cur}"}") )`,
      "    return 0",
      "    ;;"
    )
  }

  const scriptName = `_${executableName}_bash_completions`
  const lines = [
    `function ${scriptName}() {`,
    "    local i cur prev opts cmd",
    "    COMPREPLY=()",
    "    cur=\"${COMP_WORDS[COMP_CWORD]}\"",
    "    prev=\"${COMP_WORDS[COMP_CWORD-1]}\"",
    "    cmd=\"\"",
    "    opts=\"\"",
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
    "    case \"${cmd}\" in",
    ...cmdCases.map((l) => `        ${l}`),
    "    esac",
    "}",
    `complete -F ${scriptName} -o nosort -o bashdefault -o default ${executableName}`
  ]
  return lines.join("\n")
}

/* -------------------------------------------------------------------------------------------------
 * Fish
 * -------------------------------------------------------------------------------------------------*/

export const generateFishCompletions = <Name extends string, I, E, R>(
  rootCmd: Command<Name, I, E, R>,
  executableName: string
): string => {
  type AnyCommand = Command<any, any, any, any>
  const lines: Array<string> = []

  const dfs = (cmd: AnyCommand, parents: Array<string> = []) => {
    const trail = [...parents, cmd.name]
    const singles = getSingles(cmd.parsedConfig.flags)

    for (const sub of cmd.subcommands) {
      const parts = [
        "complete",
        `-c ${executableName}`,
        ...(trail.length === 1
          ? ["-n \"__fish_use_subcommand\""]
          : [`-n "__fish_seen_subcommand_from ${trail[trail.length - 1]}"`]),
        "-f",
        `-a "${sub.name}"`
      ]
      lines.push(parts.join(" "))
    }

    for (const s of singles) {
      const tokens: Array<string> = []
      if (s.name) tokens.push(`-l ${s.name}`)
      for (const a of s.aliases) tokens.push(`-s ${a}`)
      if (optionRequiresValue(s)) tokens.push("-r")
      const parts = [
        "complete",
        `-c ${executableName}`,
        ...(trail.length === 1
          ? ["-n \"__fish_use_subcommand\""]
          : [`-n "__fish_seen_subcommand_from ${trail[trail.length - 1]}"`]),
        ...tokens
      ]
      if (optionRequiresValue(s)) {
        if (isDirType(s)) parts.push("-f -a \"(__fish_complete_directories (commandline -ct))\"")
        else if (isFileType(s)) parts.push("-f -a \"(__fish_complete_path (commandline -ct))\"")
      } else {
        parts.push("-f")
      }
      lines.push(parts.join(" "))
    }

    for (const sub of cmd.subcommands) dfs(sub as AnyCommand, trail)
  }

  dfs(rootCmd as AnyCommand)
  return lines.join("\n")
}

/* -------------------------------------------------------------------------------------------------
 * Zsh
 * -------------------------------------------------------------------------------------------------*/

export const generateZshCompletions = <Name extends string, I, E, R>(
  rootCmd: Command<Name, I, E, R>,
  executableName: string
): string => {
  type AnyCommand = Command<any, any, any, any>
  const flatten = (cmd: AnyCommand, parents: Array<string> = []): Array<{ trail: Array<string>; cmd: AnyCommand }> => {
    const here = parents.concat(cmd.name)
    let out = [{ trail: here, cmd }]
    for (const c of cmd.subcommands) {
      out = out.concat(flatten(c as AnyCommand, here))
    }
    return out
  }

  const rows = flatten(rootCmd as AnyCommand)
  const body: Array<string> = []
  const handlers: Array<string> = []

  for (const { cmd, trail } of rows) {
    const funcName = `_${executableName}_${trail.join("_")}_handler`
    // Fix: Only pass flags of kind "flag" to getSingles
    const flagParams = cmd.parsedConfig.flags.filter(
      (f): f is Param<unknown, "flag"> => f.kind === "flag"
    )
    const singles = getSingles(flagParams)

    const specs: Array<string> = []
    for (const s of singles) {
      const names = [
        ...s.aliases.map((a) => (a.length === 1 ? `-${a}` : `--${a}`)),
        `--${s.name}`
      ].join("|")
      const desc = ""
      if (optionRequiresValue(s)) specs.push(`"${names}[${desc}]:${s.name}:->${s.name}"`)
      else specs.push(`"${names}[${desc}]"`)
    }

    if (cmd.subcommands.length > 0) specs.push(`"*::subcommand:->sub_${trail.join("_")}"`)

    handlers.push(
      `function ${funcName}() {`,
      "  local ret=1",
      "  local context state line",
      "  typeset -A opt_args",
      `  _arguments -s -S ${specs.join(" ")}`,
      "  case $state in"
    )

    if (cmd.subcommands.length > 0) {
      const items = cmd.subcommands.map((c) => `'${c.name}'`).join(" ")
      handlers.push(
        `  sub_${trail.join("_")})`,
        `    _describe -t commands 'subcommand' (${items})`,
        "    ;;"
      )
    }

    for (const s of singles) {
      if (!optionRequiresValue(s)) continue
      handlers.push(
        `  ${s.name})`,
        isDirType(s) ? "    _path_files -/" : isFileType(s) ? "    _path_files" : "    _message 'value'",
        "    ;;"
      )
    }

    handlers.push("  esac", "  return ret", "}", "")

    body.push(`            ${trail.join(" ")})`, `                ${funcName}`, "                ;;")
  }

  const scriptName = `_${executableName}_zsh_completions`
  const lines: Array<string> = [
    `#compdef ${executableName}`,
    "",
    `function ${scriptName}() {`,
    "  local context state line",
    "  typeset -A opt_args",
    "  local ret=1",
    "",
    "  local -a words; words=(\"${words[@]}\")",
    "  local i cmd=",
    "  for i in \"${words[@]}\"; do",
    "    case \"$cmd $i\" in",
    `      "${executableName}") cmd="${executableName}" ;;`,
    ...body,
    "      *) ;;",
    "    esac",
    "  done",
    "  return ret",
    "}",
    "",
    ...handlers,
    "",
    `if [ "$funcstack[1]" = "${scriptName}" ]; then`,
    `  ${scriptName} "$@"`,
    "else",
    `  compdef ${scriptName} ${executableName}`,
    "fi"
  ]
  return lines.join("\n")
}

export const generateCompletions = <Name extends string, I, E, R>(
  rootCmd: Command<Name, I, E, R>,
  executableName: string,
  shell: Shell
): string => {
  switch (shell) {
    case "bash":
      return generateBashCompletions(rootCmd, executableName)
    case "fish":
      return generateFishCompletions(rootCmd, executableName)
    case "zsh":
      return generateZshCompletions(rootCmd, executableName)
  }
}
