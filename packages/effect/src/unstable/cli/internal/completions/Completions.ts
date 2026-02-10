/**
 * Top-level completions dispatcher.
 *
 * Routes to the appropriate shell-specific generator based on the
 * requested shell type.
 *
 * @internal
 */
import * as Bash from "./bash.ts"
import type { CommandDescriptor } from "./CommandDescriptor.ts"
import * as Fish from "./fish.ts"
import * as Zsh from "./zsh.ts"

/** @internal */
export type Shell = "bash" | "zsh" | "fish"

/** @internal */
export const generate = (
  executableName: string,
  shell: Shell,
  descriptor: CommandDescriptor
): string => {
  switch (shell) {
    case "bash":
      return Bash.generate(executableName, descriptor)
    case "zsh":
      return Zsh.generate(executableName, descriptor)
    case "fish":
      return Fish.generate(executableName, descriptor)
  }
}
