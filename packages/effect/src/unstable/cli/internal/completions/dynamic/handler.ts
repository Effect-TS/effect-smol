/**
 * Runtime completion handler for dynamic completion.
 * This processes completion requests from the shell and returns appropriate suggestions.
 */

import type { Command } from "../../../Command.ts"
import { getSingles } from "../shared.ts"
import { optionRequiresValue } from "../types.ts"

interface CompletionContext {
  readonly words: ReadonlyArray<string>
  readonly currentWord: string
  readonly currentIndex: number
  readonly line: string
  readonly point: number
}

/**
 * Extract completion context from environment variables set by the shell.
 */
export const getCompletionContext = (): CompletionContext | null => {
  const cword = process.env.COMP_CWORD
  const line = process.env.COMP_LINE
  const point = process.env.COMP_POINT

  if (!cword || !line) {
    return null
  }

  const currentIndex = parseInt(cword, 10)
  const words = line.split(/\s+/)
  const currentWord = words[currentIndex] || ""

  return {
    words,
    currentWord,
    currentIndex,
    line,
    point: point ? parseInt(point, 10) : line.length
  }
}

/**
 * Generate completions for a command at the current context.
 */
export const generateDynamicCompletions = <Name extends string, I, E, R>(
  rootCmd: Command<Name, I, E, R>,
  context: CompletionContext
): Array<string> => {
  const completions: Array<string> = []

  // Handle edge cases
  if (context.words.length === 0 || context.currentIndex < 1) {
    return []
  }

  // Find the current command context by walking through the words
  let currentCmd: Command<any, any, any, any> = rootCmd as any
  let wordIndex = 1 // Skip executable name

  // Walk through words to find the current command context
  while (wordIndex < context.currentIndex) {
    const word = context.words[wordIndex]

    // Skip options and their values
    if (word.startsWith("-")) {
      const singles = getSingles(currentCmd.parsedConfig.flags)
      const matchingOption = singles.find((s) =>
        word === `--${s.name}` ||
        s.aliases.some((a) => word === (a.length === 1 ? `-${a}` : `--${a}`))
      )

      wordIndex++ // Move past the option

      // If option requires a value and we have more words, skip the value too
      if (matchingOption && optionRequiresValue(matchingOption) && wordIndex < context.currentIndex) {
        wordIndex++ // Skip the option value
      }
    } else {
      // Check if it's a subcommand
      const subCmd = currentCmd.subcommands.find((c: any) => c.name === word)
      if (subCmd) {
        currentCmd = subCmd as any
        wordIndex++
      } else {
        // Unknown word in command path - return empty completions
        // This handles cases like "myapp unknown <TAB>" where "unknown" is not a valid subcommand
        return []
      }
    }
  }

  // Generate completions based on current context
  const currentWord = context.currentWord

  if (currentWord.startsWith("-")) {
    // Complete flags when current word starts with -
    const singles = getSingles(currentCmd.parsedConfig.flags)
    for (const s of singles) {
      if (`--${s.name}`.startsWith(currentWord)) {
        const desc = s.typeName || s.name
        completions.push(`--${s.name}:${desc}`)
      }
      for (const alias of s.aliases) {
        const flag = alias.length === 1 ? `-${alias}` : `--${alias}`
        if (flag.startsWith(currentWord)) {
          completions.push(`${flag}:${s.name}`)
        }
      }
    }
  } else {
    // Check if previous word was an option that requires a value
    if (context.currentIndex > 0) {
      const prevWord = context.words[context.currentIndex - 1]
      if (prevWord && prevWord.startsWith("-")) {
        const singles = getSingles(currentCmd.parsedConfig.flags)
        const matchingOption = singles.find((s) =>
          prevWord === `--${s.name}` ||
          s.aliases.some((a) => prevWord === (a.length === 1 ? `-${a}` : `--${a}`))
        )

        if (matchingOption && optionRequiresValue(matchingOption)) {
          // Return empty to trigger file completion for now
          // In a real implementation, we'd provide value completions based on type
          return []
        }
      }
    }

    // Complete subcommands first
    for (const subCmd of currentCmd.subcommands) {
      if (subCmd.name.startsWith(currentWord)) {
        completions.push(`${subCmd.name}:${subCmd.description || subCmd.name + " command"}`)
      }
    }

    // If no subcommands or current word is empty, also show flags
    if (currentCmd.subcommands.length === 0 || currentWord === "") {
      const singles = getSingles(currentCmd.parsedConfig.flags)
      for (const s of singles) {
        if (`--${s.name}`.startsWith(currentWord)) {
          const desc = s.typeName || s.name
          completions.push(`--${s.name}:${desc}`)
        }
      }
    }
  }

  return completions
}

/**
 * Handle a completion request from the shell.
 * This should be called when the CLI is invoked with --get-completions.
 */
export const handleCompletionRequest = <Name extends string, I, E, R>(
  rootCmd: Command<Name, I, E, R>
): void => {
  const context = getCompletionContext()

  if (!context) {
    // No completion context available
    return
  }

  const completions = generateDynamicCompletions(rootCmd, context)

  // Output completions one per line for the shell to parse
  for (const completion of completions) {
    console.log(completion) // eslint-disable-line no-console
  }
}
