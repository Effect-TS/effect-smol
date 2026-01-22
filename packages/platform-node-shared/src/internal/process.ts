/**
 * This is a derivative work copyright (c) 2025 Effectful Technologies Inc, under MIT license.
 *
 * Original work copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import * as Arr from "effect/Array"
import type { TemplateExpression, TemplateExpressionItem } from "effect/unstable/process/ChildProcess"

/** @internal */
export const parseTemplates = (
  templates: TemplateStringsArray,
  expressions: ReadonlyArray<TemplateExpression>
): Arr.NonEmptyReadonlyArray<string> => {
  let tokens: ReadonlyArray<string> = []

  for (const [index, template] of templates.entries()) {
    tokens = parseTemplate(templates, expressions, tokens, template, index)
  }

  if (Arr.isReadonlyArrayNonEmpty(tokens)) {
    return tokens
  }

  throw new Error("Template script must not be empty")
}

const parseTemplate = (
  templates: TemplateStringsArray,
  expressions: ReadonlyArray<TemplateExpression>,
  prevTokens: ReadonlyArray<string>,
  template: string,
  index: number
): ReadonlyArray<string> => {
  const rawTemplate = templates.raw[index]

  if (rawTemplate === undefined) {
    throw new Error(`Invalid backslash sequence: ${templates.raw[index]}`)
  }

  const { hasLeadingWhitespace, hasTrailingWhitespace, tokens } = splitByWhitespaces(template, rawTemplate)
  const nextTokens = concatTokens(prevTokens, tokens, hasLeadingWhitespace)

  if (index === expressions.length) {
    return nextTokens
  }

  const expression = expressions[index]
  const expressionTokens = Array.isArray(expression)
    ? expression.map((expression: TemplateExpressionItem) => parseExpression(expression))
    : [parseExpression(expression as TemplateExpressionItem)]

  return concatTokens(nextTokens, expressionTokens, hasTrailingWhitespace)
}

/**
 * Convert valid expressions defined in a template string command (i.e. using
 * `${expression}` into strings.
 */
const parseExpression = (expression: TemplateExpression): string => {
  const type = typeof expression
  if (type === "string") {
    return expression as string // Return strings directly
  }
  return String(expression) // Convert numbers to strings
}

const DELIMITERS = new Set([" ", "\t", "\r", "\n"])

/**
 * Number of characters in backslash escape sequences: \0 \xXX or \uXXXX
 * \cX is allowed in RegExps but not in strings
 * Octal sequences are not allowed in strict mode
 */
const ESCAPE_LENGTH: Record<string, number> = { x: 3, u: 5 }

/**
 * Splits a template string by whitespace while also properly handling escape
 * sequences.
 *
 * As an example, let's review the following valid commands:
 *
 * ```ts
 * ChildProcess.exec`echo foo\n bar`
 * // We should run `["echo", "foo\n", "bar"]`
 *
 * ChildProcess.exec`echo foo
 *  bar`
 * // We should run `["echo", "foo", "bar]`
 * ```
 *
 * The problem is that when we evaluate the template string for both of the above
 * commands, we will end up with the same string "echo foo\n bar".
 *
 * What we really want is to include the escaped character in the arguments for
 * the first command, since it was written explicitly by the user.
 *
 * This is why also having access to the raw template string is useful - in a
 * template string, there are two representations of the same string:
 * 1. `template`     - The processed string (escape sequences are evaluated).
 * 2. `template.raw` - The raw string (escape sequences are literal).
 */
const splitByWhitespaces = (
  template: string,
  rawTemplate: string
): {
  readonly tokens: ReadonlyArray<string>
  readonly hasLeadingWhitespace: boolean
  readonly hasTrailingWhitespace: boolean
} => {
  if (rawTemplate.length === 0) {
    return {
      tokens: [],
      hasLeadingWhitespace: false,
      hasTrailingWhitespace: false
    }
  }

  const hasLeadingWhitespace = DELIMITERS.has(rawTemplate[0])
  const tokens: Array<string> = []

  // Given that escape sequences will have different lengths in the template
  // versus the raw template, we must maintain two indices:
  // - One for the index into the template string
  // - One for the index into the raw template string
  // We also maintain the current cursor position for where we are in the template
  let templateCursor = 0
  for (let templateIndex = 0, rawIndex = 0; templateIndex < template.length; templateIndex += 1, rawIndex += 1) {
    // Use the raw template character to check for actual whitespace
    const rawCharacter = rawTemplate[rawIndex]

    if (DELIMITERS.has(rawCharacter)) {
      // Whitespace found, extract token from template if necessary
      if (templateCursor !== templateIndex) {
        tokens.push(template.slice(templateCursor, templateIndex))
      }
      // Advance the template start index to the current position
      templateCursor = templateIndex + 1
    } else if (rawCharacter === "\\") {
      // Escape sequence detected, check the next raw character
      const nextRawCharacter = rawTemplate[rawIndex + 1]

      if (nextRawCharacter === "\n") {
        // Handle `\` character followed by a newline (i.e. a line continuation) by:
        // - Reversing the template index (backslash-newline is erased in template)
        // - Advancing the raw template index past the line continuation
        templateIndex -= 1
        rawIndex += 1
      } else if (nextRawCharacter === "u" && rawTemplate[rawIndex + 2] === "{") {
        // Handle variable-length unicode escape sequences (i.e. `\u{1F600}`) by:
        // - Advancing the raw template index past the unicode escape sequence
        rawIndex = rawTemplate.indexOf("}", rawIndex + 3)
      } else {
        // Advance raw template index past fixed-length escape sequences:
        // - \n    → 2 chars (backslash + n)
        // - \t    → 2 chars (backslash + t)
        // - \xHH  → 4 chars (backslash + x + H + H)
        // - \uHHHH → 6 chars (backslash + u + H + H + H + H)
        rawIndex += ESCAPE_LENGTH[nextRawCharacter] ?? 1
      }
    }
  }

  // Trailing whitespace only exists if the template cursor is equivalent to the
  // length of the template
  const hasTrailingWhitespace = templateCursor === template.length

  // If we did not end with trailing whitespace, ensure the final token is added
  if (!hasTrailingWhitespace) {
    tokens.push(template.slice(templateCursor))
  }

  return {
    tokens,
    hasLeadingWhitespace,
    hasTrailingWhitespace
  }
}

/**
 * Concatenates two separate sets of string tokens together.
 *
 * If either set is empty or `isSeparated=false`, the last element of `prevTokens`
 * and the first element of `nextTokens` will be joined into a single token.
 */
const concatTokens = (
  prevTokens: ReadonlyArray<string>,
  nextTokens: ReadonlyArray<string>,
  isSeparated: boolean
): ReadonlyArray<string> =>
  isSeparated || prevTokens.length === 0 || nextTokens.length === 0
    ? // Keep the previous and next tokens separate from one another
      [...prevTokens, ...nextTokens]
    : // Join the last token from the previous set and the first token from the next set
      [...prevTokens.slice(0, -1), `${prevTokens.at(-1)}${nextTokens.at(0)}`, ...nextTokens.slice(1)]
