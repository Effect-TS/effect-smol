import { getSingles, handlerName } from "../shared.ts"
import type { CommandRow } from "../types.ts"
import { buildArgumentSpec, buildSubcommandState, generateSubcommandCompletion } from "./utils.ts"

export const generateHandlers = (rows: ReadonlyArray<CommandRow>, executableName: string): Array<string> => {
  const handlers: Array<string> = []

  for (const { cmd, trail } of rows) {
    const funcName = handlerName(trail, executableName)
    const flagParams = (cmd.parsedConfig.flags as ReadonlyArray<any>).filter(
      (f: any) => f.kind === "flag"
    )
    const singles = getSingles(flagParams)

    const specs: Array<string> = []
    for (const s of singles) {
      const parts = buildArgumentSpec(s)
      for (const part of parts) {
        specs.push(part)
      }
    }

    if (cmd.subcommands.length > 0) {
      specs.push(buildSubcommandState(trail))
    }

    handlers.push(
      `function ${funcName}() {`,
      "  local ret=1",
      "  local context state line",
      "  typeset -A opt_args"
    )

    if (specs.length > 0) {
      const args = specs.join(" ")
      handlers.push(`  _arguments -C -s -S ${args}`)
    } else {
      handlers.push("  _arguments -C -s -S")
    }

    handlers.push(
      "  ret=$?",
      "  case $state in"
    )

    if (cmd.subcommands.length > 0) {
      const lines = generateSubcommandCompletion(cmd.subcommands, trail)
      for (const line of lines) {
        handlers.push(line)
      }
    }

    handlers.push(
      "  esac",
      "  return ret",
      "}",
      ""
    )
  }

  return handlers
}
