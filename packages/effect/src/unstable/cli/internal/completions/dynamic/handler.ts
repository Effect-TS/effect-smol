/**
 * Runtime completion handler for dynamic completion.
 * This processes completion requests from the shell and returns appropriate suggestions.
 */

import type { Command } from "../../../Command.ts"
import { getSingles } from "../shared.ts"
import { optionRequiresValue } from "../types.ts"
import type { SingleFlagMeta } from "../types.ts"

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
interface CompletionItem {
  readonly type: "option" | "command" | "value"
  readonly value: string
  readonly description?: string
}

const formatAlias = (alias: string): string => {
  if (alias.startsWith("-")) {
    return alias
  }
  return alias.length === 1 ? `-${alias}` : `--${alias}`
}

const getTypeLabel = (flag: SingleFlagMeta): string | undefined => {
  if (flag.typeName) {
    switch (flag.typeName) {
      case "directory":
        return "type: directory"
      case "file":
        return "type: file"
      case "either":
      case "path":
        return "type: path"
      default:
        return `type: ${flag.typeName}`
    }
  }

  switch (flag.primitiveTag) {
    case "Boolean":
      return "type: boolean"
    case "Integer":
      return "type: integer"
    case "Float":
      return "type: number"
    case "Date":
      return "type: date"
    case "Path":
      return "type: path"
    default:
      return undefined
  }
}

const buildFlagDescription = (
  flag: SingleFlagMeta,
  options: { readonly isAlias?: boolean }
): string => {
  const parts: Array<string> = []

  if (flag.description) {
    parts.push(flag.description)
  }

  const typeLabel = getTypeLabel(flag)
  if (typeLabel) {
    parts.push(typeLabel)
  }

  if (options.isAlias === true) {
    parts.push(`alias for --${flag.name}`)
  } else if (flag.aliases.length > 0) {
    const aliases = flag.aliases.map(formatAlias).filter((alias) => alias !== `--${flag.name}`)
    if (aliases.length > 0) {
      parts.push(`aliases: ${aliases.join(", ")}`)
    }
  }

  if (parts.length === 0) {
    return `--${flag.name}`
  }

  return parts.join(" — ")
}

const sanitizeDescription = (description: string): string => description.replace(/:/g, "\\:")

export const generateDynamicCompletions = <Name extends string, I, E, R>(
  rootCmd: Command<Name, I, E, R>,
  context: CompletionContext
): Array<string> => {
  const completionFormat = process.env.EFFECT_COMPLETION_FORMAT
  const items = new Map<string, CompletionItem>()

  const addItem = (item: CompletionItem) => {
    const key = `${item.type}|${item.value}`
    if (!items.has(key)) {
      items.set(key, item)
    }
  }

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
      const longForm = `--${s.name}`
      if (longForm.startsWith(currentWord)) {
        addItem({
          type: "option",
          value: longForm,
          description: buildFlagDescription(s, { isAlias: false })
        })
      }
      for (const alias of s.aliases) {
        const token = formatAlias(alias)
        if (token.startsWith(currentWord)) {
          addItem({
            type: "option",
            value: token,
            description: buildFlagDescription(s, { isAlias: true })
          })
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
        addItem({
          type: "command",
          value: subCmd.name,
          description: subCmd.description ?? `${subCmd.name} command`
        })
      }
    }

    // If no subcommands or current word is empty, also show flags
    if (currentCmd.subcommands.length === 0 || currentWord === "") {
      const singles = getSingles(currentCmd.parsedConfig.flags)
      for (const s of singles) {
        const longForm = `--${s.name}`
        if (longForm.startsWith(currentWord)) {
          addItem({
            type: "option",
            value: longForm,
            description: buildFlagDescription(s, { isAlias: false })
          })
        }
      }
    }
  }

  const flatItems = Array.from(items.values())

  if (completionFormat === "zsh") {
    return flatItems.map((item) => {
      const payload = item.description !== undefined
        ? `${item.value}:${sanitizeDescription(item.description)}`
        : item.value
      return `${item.type}\t${payload}`
    })
  }

  return flatItems.map((item) => item.value)
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
