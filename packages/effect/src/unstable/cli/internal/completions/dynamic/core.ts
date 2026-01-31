/**
 * Core dynamic completion functions.
 */

import type { Shell } from "../types.ts"
import { generateDynamicBashCompletion } from "./bash.ts"
import { generateDynamicFishCompletion } from "./fish.ts"
import { generateDynamicZshCompletion } from "./zsh.ts"

/**
 * Generate a dynamic completion script for the specified shell.
 * The script will call the CLI at runtime to get completions.
 *
 * @internal
 */
export const generateDynamicCompletion = (
  executableName: string,
  shell: Shell,
  executablePath?: string
): string => {
  switch (shell) {
    case "bash":
      return generateDynamicBashCompletion(executableName, executablePath)
    case "zsh":
      return generateDynamicZshCompletion(executableName, executablePath)
    case "fish":
      return generateDynamicFishCompletion(executableName, executablePath)
  }
}

/**
 * Check if the current process is a completion request.
 * This checks for the --get-completions flag or COMP_* environment variables.
 *
 * @internal
 */
export const isCompletionRequest = (args: ReadonlyArray<string>): boolean => {
  // Check for explicit completion flag
  if (args.includes("--get-completions")) {
    return true
  }

  // Check for completion environment variables
  if (process.env.COMP_CWORD !== undefined && process.env.COMP_LINE !== undefined) {
    return true
  }

  return false
}
