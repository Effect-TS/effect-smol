import type { Command } from "../../Command.ts"
import { getSingles } from "./shared.ts"
import { isDirType, isEitherPath, isFileType, optionRequiresValue } from "./types.ts"

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
        else if (isFileType(s) || isEitherPath(s)) parts.push("-f -a \"(__fish_complete_path (commandline -ct))\"")
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
