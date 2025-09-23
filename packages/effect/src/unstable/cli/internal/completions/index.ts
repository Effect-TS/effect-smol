import type { Command } from "../../Command.ts"
import { generateBashCompletions } from "./bash.ts"
import { generateFishCompletions } from "./fish.ts"
import type { Shell } from "./types.ts"
import { generateZshCompletions } from "./zsh/index.ts"

export const generateCompletions = <Name extends string, I, E, R>(
  rootCmd: Command<Name, I, E, R>,
  executableName: string,
  shell: Shell
): string => {
  /*
   * TODO(completions)
   * - Add a `completion` subcommand with `show|install|uninstall <shell>` UX; keep `--completions` as hidden alias
   * - Include descriptions for flags/subcommands (zsh `_arguments[...]`, fish `--description`)
   * - Support positional argument completions (type hints, choices)
   * - Auto-complete `choice` values and add dynamic `withCompletions(ctx)` hooks
   * - Consider dynamic completion mode (`__complete`) that consults real parser
   * - Unify parent/child flag visibility policy across shells
   * - Add PowerShell support if needed
   */
  switch (shell) {
    case "bash":
      return generateBashCompletions(rootCmd, executableName)
    case "fish":
      return generateFishCompletions(rootCmd, executableName)
    case "zsh":
      return generateZshCompletions(rootCmd, executableName)
  }
}

// Export the individual generators for testing/advanced usage
export { generateBashCompletions } from "./bash.ts"
export { generateFishCompletions } from "./fish.ts"
export { generateZshCompletions } from "./zsh/index.ts"

// Export dynamic completion functions
export {
  generateDynamicBashCompletion,
  generateDynamicCompletion,
  generateDynamicZshCompletion,
  handleCompletionRequest,
  isCompletionRequest
} from "./dynamic/index.ts"

// Export types for external usage
export type { CommandRow, Shell, SingleFlagMeta } from "./types.ts"
