import type { Command } from "../../../Command.ts"
import { flattenCommand } from "../shared.ts"
import { generateHandlers } from "./handlers.ts"
import { generateRouter } from "./router.ts"

export const generateZshCompletions = <Name extends string, I, E, R>(
  rootCmd: Command<Name, I, E, R>,
  executableName: string
): string => {
  type AnyCommand = Command<any, any, any, any>

  const rows = flattenCommand(rootCmd as AnyCommand)
  const handlers = generateHandlers(rows, executableName)
  const routerLines = generateRouter(rows, executableName, rootCmd)

  const scriptName = `_${executableName}_zsh_completions`

  const lines: Array<string> = [
    `#compdef ${executableName}`,
    "",
    `function ${scriptName}() {`,
    `  _${executableName}_zsh_route`,
    "}",
    "",
    ...routerLines,
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
