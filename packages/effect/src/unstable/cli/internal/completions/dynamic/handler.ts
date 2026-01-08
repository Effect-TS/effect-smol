/**
 * Runtime completion handler for dynamic completion.
 * This processes completion requests from the shell and returns appropriate suggestions.
 */

import type { Command } from "../../../Command.ts"
import { toImpl } from "../../command.ts"
import { getSingles } from "../shared.ts"
import { optionRequiresValue } from "../types.ts"
import type { FlagDescriptor } from "../types.ts"

interface CompletionContext {
  readonly words: ReadonlyArray<string>
  readonly currentWord: string
  readonly currentIndex: number
  readonly line: string
  readonly point: number
}

/**
 * Extract completion context from environment variables set by the shell.
 *
 * @internal
 */
export const getCompletionContext = (): CompletionContext | null => {
  const cword = process.env.COMP_CWORD
  const rawLine = process.env.COMP_LINE
  const point = process.env.COMP_POINT

  if (!cword) {
    return null
  }

  const currentIndex = parseInt(cword, 10)

  const markerIndex = process.argv.indexOf("--get-completions")
  const argvWords = markerIndex >= 0 ? process.argv.slice(markerIndex + 1) : []

  const fallbackLine = rawLine ?? ""
  const fallbackWords = fallbackLine.length > 0 ? fallbackLine.split(/\s+/) : []
  const words = argvWords.length > 0 ? argvWords : fallbackWords

  if (words.length === 0 && fallbackLine.length === 0) {
    return null
  }

  const line = rawLine ?? words.join(" ")
  const currentWord = words[currentIndex] ?? ""

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

const lookupFlag = (
  token: string,
  flags: ReadonlyArray<FlagDescriptor>
): FlagDescriptor | undefined =>
  flags.find((flag) =>
    token === `--${flag.name}` ||
    flag.aliases.some((a) => token === (a.length === 1 ? `-${a}` : `--${a}`))
  )

const formatAlias = (alias: string): string => {
  if (alias.startsWith("-")) {
    return alias
  }
  return alias.length === 1 ? `-${alias}` : `--${alias}`
}

const getTypeLabel = (flag: FlagDescriptor): string | undefined => {
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

const buildFlagDescription = (flag: FlagDescriptor): string => {
  const parts: Array<string> = []
  const aliasParts = flag.aliases
    .map(formatAlias)
    .filter((alias) => alias !== `--${flag.name}`)

  const baseDescription = flag.description ?? `--${flag.name}`

  if (aliasParts.length > 0) {
    parts.push(`${aliasParts.join(", ")}  -- ${baseDescription}`)
  } else {
    parts.push(baseDescription)
  }

  const typeLabel = getTypeLabel(flag)
  if (typeLabel) {
    parts.push(typeLabel)
  }

  return parts.join(" — ")
}

const addFlagCandidates = (
  addItem: (item: CompletionItem) => void,
  flag: FlagDescriptor,
  query: string,
  includeAliases: boolean
) => {
  const description = buildFlagDescription(flag)
  const longForm = `--${flag.name}`

  if (longForm.startsWith(query)) {
    addItem({
      type: "option",
      value: longForm,
      description
    })
  }

  if (includeAliases) {
    for (const alias of flag.aliases) {
      const token = formatAlias(alias)
      if (token.startsWith(query)) {
        addItem({
          type: "option",
          value: token,
          description
        })
      }
    }
  }
}

const sanitizeDescription = (description: string): string =>
  description
    .replace(/\\/g, "\\\\")
    .replace(/\t/g, " ")
    .replace(/\n/g, " ")
    .replace(/:/g, "\\:")

export const generateDynamicCompletions = <Name extends string, I, E, R>(
  rootCmd: Command<Name, I, E, R>,
  context: CompletionContext
): Array<string> => {
  const completionFormat = process.env.EFFECT_COMPLETION_FORMAT || (process.env.FISH_COMPLETION ? "fish" : undefined)
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
  let currentCmd: Command.Any = rootCmd
  let wordIndex = 1 // Skip executable name

  // Walk through words to find the current command context
  while (wordIndex < context.currentIndex) {
    const word = context.words[wordIndex]

    // Skip options and their values
    if (word.startsWith("-")) {
      const eqIndex = word.indexOf("=")
      const optionToken = eqIndex === -1 ? word : word.slice(0, eqIndex)
      const hasInlineValue = eqIndex !== -1

      if (optionToken.startsWith("-") && !optionToken.startsWith("--") && optionToken.length > 2) {
        wordIndex++
        continue
      }

      const singles = getSingles(toImpl(currentCmd).config.flags)
      const matchingFlag = lookupFlag(optionToken, singles)

      wordIndex++ // Move past the option

      if (
        matchingFlag && optionRequiresValue(matchingFlag) && !hasInlineValue && wordIndex < context.currentIndex
      ) {
        wordIndex++ // Skip the option value
      }
    } else {
      // Check if it's a subcommand
      const subCmd = currentCmd.subcommands.find((c) => c.name === word)
      if (subCmd) {
        currentCmd = subCmd
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

  const singles = getSingles(toImpl(currentCmd).config.flags)
  const equalIndex = currentWord.indexOf("=")
  if (currentWord.startsWith("-") && equalIndex !== -1) {
    const optionToken = currentWord.slice(0, equalIndex)
    const matchingFlag = lookupFlag(optionToken, singles)

    if (matchingFlag && optionRequiresValue(matchingFlag)) {
      const candidateKind = matchingFlag.typeName ?? (matchingFlag.primitiveTag === "Path" ? "path" : undefined)
      const fileKind = candidateKind === "directory" || candidateKind === "file" || candidateKind === "either" ||
          candidateKind === "path"
        ? candidateKind
        : undefined

      if (completionFormat === "zsh" && fileKind) {
        return [`files\t${fileKind}`]
      }

      return []
    }
  }

  if (currentWord.startsWith("-")) {
    // Complete flags when current word starts with -
    const includeAliases = !currentWord.startsWith("--")
    for (const s of singles) {
      addFlagCandidates(addItem, s, currentWord, includeAliases)
    }
  } else {
    // Check if previous word was an option that requires a value
    if (context.currentIndex > 0) {
      const prevWord = context.words[context.currentIndex - 1]
      if (prevWord && prevWord.startsWith("-")) {
        const prevEqIndex = prevWord.indexOf("=")
        const prevToken = prevEqIndex === -1 ? prevWord : prevWord.slice(0, prevEqIndex)
        const matchingFlag = lookupFlag(prevToken, singles)

        if (matchingFlag && optionRequiresValue(matchingFlag)) {
          const candidateKind = matchingFlag.typeName ?? (matchingFlag.primitiveTag === "Path" ? "path" : undefined)
          const fileKind = candidateKind === "directory" || candidateKind === "file" || candidateKind === "either" ||
              candidateKind === "path"
            ? candidateKind
            : undefined

          if (completionFormat === "zsh" && fileKind) {
            return [`files\t${fileKind}`]
          }

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

    // If no subcommands or current word is empty, also show flags (long form only)
    if (currentCmd.subcommands.length === 0 || currentWord === "") {
      for (const s of singles) {
        addFlagCandidates(addItem, s, currentWord, false)
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

  if (completionFormat === "fish") {
    return flatItems.map((item) => {
      // Fish uses tab-separated value and description format
      return item.description !== undefined
        ? `${item.value}\t${item.description}`
        : item.value
    })
  }

  return flatItems.map((item) => item.value)
}

/**
 * Handle a completion request from the shell.
 * This should be called when the CLI is invoked with --get-completions.
 *
 * @internal
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
    console.log(completion) // oxlint-disable-line no-console
  }
}
